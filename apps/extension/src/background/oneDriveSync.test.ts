import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_STORAGE,
  createDriveSyncEnvelope,
  type Note,
  type StorageData,
} from '@tabnotes/shared';
import { ONEDRIVE_SYNC_KEY } from '../shared/oneDrive';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  write: vi.fn(),
  auth: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('./oneDriveClient', () => ({
  readOneDriveSnapshots: mocks.read,
  writeOneDriveSnapshot: mocks.write,
  OneDriveApiError: class extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
}));
vi.mock('./oneDriveAuth', () => ({
  getOneDriveToken: mocks.auth,
  disconnectOneDriveAuth: mocks.disconnect,
  oneDriveHasCredentials: async () => true,
  oneDriveIdentitySupported: () => true,
  oneDrivePermissionsGranted: async () => true,
  OneDriveAuthError: class extends Error {},
}));

const localDevice = '11111111-1111-4111-8111-111111111111';
const remoteDevice = '22222222-2222-4222-8222-222222222222';
let stored: Record<string, unknown>;
let api: typeof import('./oneDriveSync');
const note = (id: string, text: string, updatedAt = Date.now()): Note => ({
  id,
  content: text,
  title: id,
  workspaceId: null,
  scope: 'global',
  scopeKey: 'global',
  tags: [],
  versions: [],
  createdAt: 10,
  updatedAt,
});
const data = (notes: Note[] = []): StorageData => ({
  ...structuredClone(DEFAULT_STORAGE),
  theme: 'dark',
  language: 'es',
  notes_global: Object.fromEntries(notes.map((n) => [n.id, n])),
});

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  stored = {
    tabnotes_data: data(),
    [ONEDRIVE_SYNC_KEY]: { enabled: true, status: 'ok', deviceId: localDevice, lastSyncedAt: 1000 },
  };
  const get = vi.fn((keys: string | string[], callback?: (value: unknown) => void) => {
    const value = structuredClone(
      Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((k) => [k, stored[k]]))
    );
    callback?.(value);
    return Promise.resolve(value);
  });
  const set = vi.fn((values: Record<string, unknown>, callback?: () => void) => {
    Object.assign(stored, JSON.parse(JSON.stringify(values)));
    callback?.();
    return Promise.resolve();
  });
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-extension',
      getURL: (path: string) => `chrome-extension://test-extension/${path}`,
    },
    storage: { local: { get, set } },
    alarms: { create: vi.fn(async () => {}), clear: vi.fn(async () => true) },
  });
  mocks.read.mockResolvedValue({ driveId: 'test-drive', snapshots: [] });
  mocks.write.mockResolvedValue(undefined);
  mocks.auth.mockResolvedValue('test-token');
  mocks.disconnect.mockResolvedValue(undefined);
  api = await import('./oneDriveSync');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('uploads local notes with the existing wire schema wrapped by the new transport', async () => {
  stored.tabnotes_data = data([note('local', 'local content')]);
  const state = await api.syncOneDrive(true);
  expect(state.status).toBe('ok');
  expect(state).not.toHaveProperty('tombstones');
  expect(mocks.write.mock.calls[0][0].data.notes[0].content).toBe('local content');
  expect(mocks.write.mock.calls[0][0].sourceDeviceId).toBe(localDevice);
});

it('merges remote notes without replacing local language, theme or note scope', async () => {
  const remote = createDriveSyncEnvelope(
    {
      ...data([note('remote', 'remote content')]),
      theme: 'light',
      language: 'en',
      defaultScope: 'url',
    },
    { sourceDeviceId: remoteDevice }
  );
  mocks.read.mockResolvedValue({ driveId: 'test-drive', snapshots: [remote] });
  await api.syncOneDrive(true);
  expect(stored.tabnotes_data).toMatchObject({
    theme: 'dark',
    language: 'es',
    defaultScope: 'domain',
    notes_global: { remote: { content: 'remote content' } },
  });
});

it('preserves both edits when two devices change the same note', async () => {
  stored.tabnotes_data = data([note('shared', 'local edit', 2000)]);
  const remote = createDriveSyncEnvelope(data([note('shared', 'remote edit', 3000)]), {
    sourceDeviceId: remoteDevice,
  });
  mocks.read.mockResolvedValue({ driveId: 'test-drive', snapshots: [remote] });
  await api.syncOneDrive(true);
  const notes = Object.values((stored.tabnotes_data as StorageData).notes_global);
  expect(notes.map((n) => n.content)).toEqual(
    expect.arrayContaining(['local edit', 'remote edit'])
  );
  expect(notes).toHaveLength(2);
});

it('propagates the other original edit even after a conflict copy advanced the local checkpoint', async () => {
  const edgeEdit = note('shared', 'edge edit', 3000);
  const edgeConflict = {
    ...edgeEdit,
    id: `shared__conflict__${localDevice}__3000`,
    title: 'shared (conflict copy)',
    tags: ['conflict'],
    createdAt: 5000,
    updatedAt: 5000,
  };
  stored.tabnotes_data = data([edgeEdit]);
  stored[ONEDRIVE_SYNC_KEY] = {
    enabled: true,
    status: 'ok',
    deviceId: localDevice,
    lastSyncedAt: 6000,
  };
  mocks.read.mockResolvedValue({
    driveId: 'test-drive',
    snapshots: [
      createDriveSyncEnvelope(data([note('shared', 'chrome edit', 2000), edgeConflict]), {
        sourceDeviceId: remoteDevice,
      }),
    ],
  });
  await api.syncOneDrive(true);
  const contents = Object.values((stored.tabnotes_data as StorageData).notes_global).map(
    (n) => n.content
  );
  expect(contents).toContain('edge edit');
  expect(contents).toContain('chrome edit');
});

it('retains local deletion tombstones so a remote snapshot cannot resurrect a note', async () => {
  const n = note('deleted', 'old content', Date.now() - 1000);
  await api.recordOneDriveChange(data([n]), data());
  const remote = createDriveSyncEnvelope(data([n]), { sourceDeviceId: remoteDevice });
  mocks.read.mockResolvedValue({ driveId: 'test-drive', snapshots: [remote] });
  await api.syncOneDrive(true);
  expect((stored.tabnotes_data as StorageData).notes_global.deleted).toBeUndefined();
  expect(mocks.write.mock.calls[0][0].tombstones).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'deleted', entityType: 'note' })])
  );
});

it('does not write anything when a remote backup is corrupt or inaccessible', async () => {
  const initial = structuredClone(stored.tabnotes_data);
  mocks.read.mockRejectedValue(new Error('ONEDRIVE_INVALID_BACKUP'));
  await expect(api.syncOneDrive(true)).rejects.toThrow('ONEDRIVE_SYNC_FAILED');
  expect(mocks.write).not.toHaveBeenCalled();
  expect(stored.tabnotes_data).toEqual(initial);
});

it('does not resurrect deleted notes from inactive profiles after ninety days', async () => {
  const deletedAt = Date.now() - 1000 * 60 * 60 * 24 * 120;
  const deletion = {
    entityType: 'note' as const,
    id: 'old-deletion',
    scope: 'global' as const,
    deletedAt,
    sourceDeviceId: localDevice,
  };
  stored[ONEDRIVE_SYNC_KEY] = {
    ...(stored[ONEDRIVE_SYNC_KEY] as object),
    tombstones: [deletion],
  };
  mocks.read.mockResolvedValue({
    driveId: 'test-drive',
    snapshots: [
      createDriveSyncEnvelope(data([note('old-deletion', 'stale', deletedAt - 1000)]), {
        sourceDeviceId: remoteDevice,
      }),
    ],
  });
  await api.syncOneDrive(true);
  expect((stored.tabnotes_data as StorageData).notes_global['old-deletion']).toBeUndefined();
  expect(mocks.write.mock.calls[0][0].tombstones).toContainEqual(deletion);
});

it('retains merged notes and the deletion ledger when upload fails', async () => {
  mocks.read.mockResolvedValue({
    driveId: 'test-drive',
    snapshots: [
      createDriveSyncEnvelope(data([note('remote', 'keep after upload failure')]), {
        sourceDeviceId: remoteDevice,
      }),
    ],
  });
  mocks.write.mockRejectedValue(new Error('Offline'));
  await expect(api.syncOneDrive(true)).rejects.toThrow('ONEDRIVE_SYNC_FAILED');
  expect((stored.tabnotes_data as StorageData).notes_global.remote.content).toBe(
    'keep after upload failure'
  );
  expect((stored[ONEDRIVE_SYNC_KEY] as { lastSyncedAt: number }).lastSyncedAt).toBe(1000);
});

it('does not upload to a different account after a silent token/account change', async () => {
  stored[ONEDRIVE_SYNC_KEY] = {
    enabled: true,
    status: 'ok',
    driveId: 'original-account',
    deviceId: localDevice,
  };
  await expect(api.syncOneDrive(true)).rejects.toThrow('ONEDRIVE_RECONNECT');
  expect(mocks.write).not.toHaveBeenCalled();
});

it('disconnects without deleting local notes or cloud files and cancels a pending read', async () => {
  const initial = structuredClone(stored.tabnotes_data);
  let finish!: (value: unknown) => void;
  mocks.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const sync = api.syncOneDrive();
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  const disconnect = api.disconnectOneDrive();
  finish({ driveId: 'test-drive', snapshots: [] });
  await sync;
  const state = await disconnect;
  expect(state.enabled).toBe(false);
  expect(state.status).toBe('disconnected');
  expect(stored.tabnotes_data).toEqual(initial);
  expect(mocks.write).not.toHaveBeenCalled();
});

it('refuses a second cloud provider without disconnecting or changing Google Drive', async () => {
  stored.tn_drive_sync = { enabled: true, fileId: 'original-google-backup' };
  await expect(api.connectOneDrive()).rejects.toThrow('ONEDRIVE_DISCONNECT_GOOGLE_FIRST');
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(stored.tn_drive_sync).toEqual({ enabled: true, fileId: 'original-google-backup' });
});

it('rejects a content-script sender before operating credentials or syncing', () => {
  const reply = vi.fn();
  expect(
    api.handleOneDriveMessage(
      { type: 'ONEDRIVE_CONNECT' },
      { id: 'test-extension', url: 'https://example.com/' },
      reply
    )
  ).toBe(false);
  expect(reply).toHaveBeenCalledWith({ ok: false, error: 'ONEDRIVE_UNTRUSTED_SENDER' });
  expect(mocks.auth).not.toHaveBeenCalled();
});

it('records a change made during upload for the next sync rather than marking it uploaded', async () => {
  const first = note('local', 'first revision', Date.now() - 2000);
  stored.tabnotes_data = data([first]);
  mocks.write.mockImplementationOnce(async () => {
    const local = stored.tabnotes_data as StorageData;
    stored.tabnotes_data = {
      ...local,
      notes_global: {
        ...local.notes_global,
        local: { ...first, content: 'new edit while uploading', updatedAt: Date.now() + 1000 },
      },
    };
  });
  const result = await api.syncOneDrive(true);
  const latest = (stored.tabnotes_data as StorageData).notes_global.local;
  expect(latest.content).toBe('new edit while uploading');
  expect(latest.updatedAt).toBeGreaterThan(result.lastSyncedAt!);
  await api.syncOneDrive(true);
  expect(mocks.write.mock.calls[1][0].data.notes).toEqual(
    expect.arrayContaining([expect.objectContaining({ content: 'new edit while uploading' })])
  );
});
