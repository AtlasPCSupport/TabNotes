import {
  ChromeStorageAdapter,
  createDeleteTombstone,
  createDriveSyncEnvelope,
  mergeDriveSyncEnvelope,
  withStorageLock,
  type StorageData,
  type SyncTombstone,
} from '@tabnotes/shared';
import {
  ONEDRIVE_AUTO_ALARM,
  ONEDRIVE_PERIODIC_ALARM,
  ONEDRIVE_SYNC_KEY,
  ONEDRIVE_REMOTE_APPLY_KEY,
  type OneDriveState,
  type OneDriveStatus,
} from '../shared/oneDrive';
import {
  disconnectOneDriveAuth,
  getOneDriveToken,
  oneDriveHasCredentials,
  oneDriveIdentitySupported,
  oneDrivePermissionsGranted,
  OneDriveAuthError,
} from './oneDriveAuth';
import { readOneDriveSnapshots, writeOneDriveSnapshot, OneDriveApiError } from './oneDriveClient';

const COLLECTIONS = ['notes_url', 'notes_domain', 'notes_workspace', 'notes_global'] as const;
const adapter = new ChromeStorageAdapter();
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
let controller: AbortController | null = null;

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation, operation);
  queue = result.catch(() => undefined);
  return result;
}

function prune(tombstones: SyncTombstone[] = []): SyncTombstone[] {
  // Inactive profiles retain old snapshots indefinitely. Expiring these markers
  // would resurrect their deleted notes when those snapshots are read again.
  return tombstones.filter((t) => Number.isFinite(t.deletedAt));
}

async function getState(): Promise<OneDriveState> {
  const stored = (await chrome.storage.local.get(ONEDRIVE_SYNC_KEY))[ONEDRIVE_SYNC_KEY] as
    | Partial<OneDriveState>
    | undefined;
  return {
    enabled: false,
    status: 'disconnected',
    ...stored,
    tombstones: prune(stored?.tombstones),
  };
}

async function patchState(patch: Partial<OneDriveState>): Promise<OneDriveState> {
  // All state changes, including tombstones, use the same cross-context lock as notes.
  return withStorageLock(async () => {
    const state = { ...(await getState()), ...patch };
    await chrome.storage.local.set({ [ONEDRIVE_SYNC_KEY]: state });
    return state;
  });
}

export async function getOneDriveStatus(): Promise<OneDriveStatus> {
  const [state, connected, permissionsGranted, google] = await Promise.all([
    getState(),
    oneDriveHasCredentials(),
    oneDrivePermissionsGranted(),
    chrome.storage.local.get('tn_drive_sync'),
  ]);
  return {
    enabled: state.enabled,
    status: state.status,
    deviceId: state.deviceId,
    driveId: state.driveId,
    lastSyncedAt: state.lastSyncedAt,
    lastError: state.lastError,
    connected,
    permissionsGranted,
    supportedIdentity: oneDriveIdentitySupported(),
    googleEnabled: Boolean(google.tn_drive_sync?.enabled),
  };
}

function check(current: number): void {
  if (current !== generation) throw new Error('ONEDRIVE_CANCELLED');
}

async function sync(current: number, signal: AbortSignal): Promise<void> {
  check(current);
  const before = await getState();
  if (!before.enabled) return;
  await patchState({ status: 'syncing', lastError: undefined });
  const remote = await readOneDriveSnapshots(signal);
  check(current);
  // A refreshed token must not silently route a profile's history to a different account.
  if (before.driveId && before.driveId !== remote.driveId)
    throw new OneDriveAuthError('ONEDRIVE_ACCOUNT_CHANGED');
  const deviceId = before.deviceId ?? crypto.randomUUID();
  const own = remote.snapshots.find((s) => s.sourceDeviceId === deviceId);
  const now = Date.now();
  const snapshot = await withStorageLock(async () => {
    check(current);
    let local = await adapter.get();
    const latest = await getState();
    let tombstones = latest.tombstones ?? [];
    // Snapshots can carry an already-created conflict copy whose original
    // timestamps predate this profile's latest sync. Those originals still
    // represent concurrent edits: do not let the checkpoint hide one variant.
    const conflictBases = new Set(
      [
        ...COLLECTIONS.flatMap((key) => Object.values(local[key])),
        ...remote.snapshots.flatMap((s) => s.data.notes),
      ]
        .map((note) => /^(.*)__conflict__[0-9a-f-]{36}__\d+$/i.exec(note.id)?.[1])
        .filter((id): id is string => Boolean(id))
    );
    for (const payload of remote.snapshots) {
      for (const conflictPass of [false, true]) {
        const notes = payload.data.notes.filter(
          (note) => conflictBases.has(note.id) === conflictPass
        );
        if (conflictPass && notes.length === 0) continue;
        const batch = { ...payload, data: { ...payload.data, notes } };
        const merged = mergeDriveSyncEnvelope(batch, local, {
          sourceDeviceId: deviceId,
          localTombstones: tombstones,
          // On first connection preserve both versions of a colliding note ID.
          lastSyncedAt: conflictPass ? 1 : (before.lastSyncedAt ?? 1),
          now,
          tombstoneRetentionMs: Infinity,
        });
        // Automatic note sync must not switch the user's language, theme, scope
        // or active project to whichever device snapshot was read last.
        merged.data.theme = local.theme;
        merged.data.language = local.language;
        merged.data.defaultScope = local.defaultScope;
        merged.data.markdownEnabled = local.markdownEnabled;
        merged.data.activeWorkspaceId =
          local.activeWorkspaceId && merged.data.workspaces[local.activeWorkspaceId]
            ? local.activeWorkspaceId
            : null;
        local = merged.data;
        tombstones = merged.tombstones;
      }
    }
    // Persist the merged data and deletion ledger together before any network write.
    // An upload failure must never discard a remote conflict/deletion already read.
    check(current);
    await chrome.storage.local.set({
      tabnotes_data: local,
      [ONEDRIVE_REMOTE_APPLY_KEY]: { at: now },
      [ONEDRIVE_SYNC_KEY]: { ...latest, driveId: remote.driveId, deviceId, tombstones },
    });
    return createDriveSyncEnvelope(local, {
      sourceDeviceId: deviceId,
      previous: own,
      tombstones,
      now,
      tombstoneRetentionMs: Infinity,
    });
  });
  check(current);
  await writeOneDriveSnapshot(snapshot, signal);
  check(current);
  // A note edited during upload has updatedAt > this checkpoint and will be
  // included in the next queued sync, rather than incorrectly marked uploaded.
  await patchState({ status: 'ok', lastSyncedAt: now, lastError: undefined });
}

export function syncOneDrive(manual = false): Promise<OneDriveStatus> {
  const current = generation;
  return serialize(async () => {
    try {
      if (!(await getState()).enabled) return getOneDriveStatus();
      check(current);
      controller = new AbortController();
      await sync(current, controller.signal);
    } catch (error) {
      if (current !== generation) return getOneDriveStatus();
      const reconnect =
        error instanceof OneDriveAuthError ||
        (error instanceof OneDriveApiError && error.status === 401);
      await patchState({
        status: reconnect ? 'reconnect' : 'error',
        lastError: reconnect
          ? 'ONEDRIVE_RECONNECT'
          : error instanceof Error
            ? error.message
            : 'ONEDRIVE_SYNC_FAILED',
      });
      if (manual) {
        throw Object.assign(new Error(reconnect ? 'ONEDRIVE_RECONNECT' : 'ONEDRIVE_SYNC_FAILED'), {
          cause: error,
        });
      }
    } finally {
      controller = null;
    }
    return getOneDriveStatus();
  });
}

export async function connectOneDrive(): Promise<OneDriveStatus> {
  const current = generation;
  await serialize(async () => {
    const google = (await chrome.storage.local.get('tn_drive_sync')).tn_drive_sync;
    if (google?.enabled) throw new Error('ONEDRIVE_DISCONNECT_GOOGLE_FIRST');
    check(current);
    await getOneDriveToken(true);
    check(current);
    // Account/file identity is checked in sync before uploading any notes.
    await withStorageLock(async () => {
      const googleNow = (await chrome.storage.local.get('tn_drive_sync')).tn_drive_sync;
      if (googleNow?.enabled) throw new Error('ONEDRIVE_DISCONNECT_GOOGLE_FIRST');
      const state = await getState();
      check(current);
      await chrome.storage.local.set({
        [ONEDRIVE_SYNC_KEY]: { ...state, enabled: true, status: 'syncing' },
      });
    });
    await scheduleOneDrivePeriodicSync();
  });
  return syncOneDrive(true);
}

export async function disconnectOneDrive(): Promise<OneDriveStatus> {
  generation += 1;
  controller?.abort();
  // Invalidate auth immediately, not after an in-flight network request.
  await disconnectOneDriveAuth();
  return serialize(async () => {
    await chrome.alarms.clear(ONEDRIVE_AUTO_ALARM);
    await chrome.alarms.clear(ONEDRIVE_PERIODIC_ALARM);
    await patchState({
      enabled: false,
      status: 'disconnected',
      lastError: undefined,
      driveId: undefined,
      deviceId: undefined,
      lastSyncedAt: undefined,
      tombstones: [],
    });
    return getOneDriveStatus();
  });
}

export async function recordOneDriveChange(oldValue: unknown, newValue: unknown): Promise<void> {
  const before = oldValue as StorageData | undefined;
  const after = newValue as StorageData | undefined;
  if (!before || !after) return;
  await withStorageLock(async () => {
    const state = await getState();
    if (!state.enabled) return;
    const deviceId = state.deviceId ?? crypto.randomUUID();
    const at = Date.now();
    const deleted: SyncTombstone[] = [];
    const newIds = new Set(COLLECTIONS.flatMap((key) => Object.keys(after[key] ?? {})));
    for (const workspace of Object.values(before.workspaces ?? {})) {
      if (!after.workspaces?.[workspace.id])
        deleted.push(
          createDeleteTombstone(
            { entityType: 'workspace', id: workspace.id, workspaceId: workspace.id },
            deviceId,
            at
          )
        );
    }
    for (const note of COLLECTIONS.flatMap((key) => Object.values(before[key] ?? {}))) {
      if (!newIds.has(note.id))
        deleted.push(
          createDeleteTombstone(
            { entityType: 'note', id: note.id, scope: note.scope, workspaceId: note.workspaceId },
            deviceId,
            at
          )
        );
    }
    await chrome.storage.local.set({
      [ONEDRIVE_SYNC_KEY]: {
        ...state,
        deviceId,
        tombstones: prune([...(state.tombstones ?? []), ...deleted]),
      },
    });
    await chrome.alarms.create(ONEDRIVE_AUTO_ALARM, { when: Date.now() + 3000 });
  });
}

export async function scheduleOneDrivePeriodicSync(): Promise<void> {
  const state = await getState();
  if (state.enabled)
    await chrome.alarms.create(ONEDRIVE_PERIODIC_ALARM, { delayInMinutes: 1, periodInMinutes: 5 });
  else await chrome.alarms.clear(ONEDRIVE_PERIODIC_ALARM);
}

export async function handleOneDriveAlarm(name: string): Promise<boolean> {
  if (name !== ONEDRIVE_AUTO_ALARM && name !== ONEDRIVE_PERIODIC_ALARM) return false;
  await syncOneDrive();
  return true;
}

export function handleOneDriveMessage(
  msg: { type?: string },
  sender: chrome.runtime.MessageSender,
  reply: (response: unknown) => void
): boolean {
  const actions: Record<string, () => Promise<OneDriveStatus>> = {
    ONEDRIVE_STATUS: getOneDriveStatus,
    ONEDRIVE_CONNECT: connectOneDrive,
    ONEDRIVE_SYNC: () => syncOneDrive(true),
    ONEDRIVE_DISCONNECT: disconnectOneDrive,
  };
  const action = actions[msg.type ?? ''];
  if (!action) return false;
  // Only the extension's own UI may operate a cloud account, never page/content messages.
  const url = sender.url ?? '';
  if (
    sender.id !== chrome.runtime.id ||
    ![
      chrome.runtime.getURL('sidepanel/index.html'),
      chrome.runtime.getURL('options/index.html'),
    ].includes(url)
  ) {
    reply({ ok: false, error: 'ONEDRIVE_UNTRUSTED_SENDER' });
    return false;
  }
  void action().then(
    (result) => reply({ ok: true, result }),
    (error) =>
      reply({
        ok: false,
        error:
          error instanceof Error && /^ONEDRIVE_[A-Z_0-9]+$/.test(error.message)
            ? error.message
            : 'ONEDRIVE_SYNC_FAILED',
      })
  );
  return true;
}
