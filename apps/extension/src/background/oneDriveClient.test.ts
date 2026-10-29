import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_STORAGE, createDriveSyncEnvelope } from '@tabnotes/shared';
import {
  graphRequest,
  parseOneDriveSnapshot,
  readOneDriveSnapshots,
  writeOneDriveSnapshot,
} from './oneDriveClient';

vi.mock('./oneDriveAuth', () => ({ getOneDriveToken: vi.fn(async () => 'synthetic-token') }));
const device = '11111111-1111-4111-8111-111111111111';
const snapshot = () =>
  createDriveSyncEnvelope(structuredClone(DEFAULT_STORAGE), { sourceDeviceId: device });
const payload = () => ({ kind: 'tabnotes.oneDriveSync', schema: 1, snapshot: snapshot() });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('requires a OneDrive wrapper and deeply validates notes before merging', () => {
  expect(parseOneDriveSnapshot(payload()).sourceDeviceId).toBe(device);
  expect(() => parseOneDriveSnapshot(snapshot())).toThrow('ONEDRIVE_INVALID_BACKUP');
  const value = payload();
  value.snapshot.data.notes.push({ id: 'invalid' } as never);
  expect(() => parseOneDriveSnapshot(value)).toThrow('ONEDRIVE_INVALID_BACKUP');
});

it('rejects malformed deletion ledgers instead of silently dropping entries', () => {
  const value = payload();
  value.snapshot.tombstones.push({ id: 'bad' } as never);
  expect(() => parseOneDriveSnapshot(value)).toThrow('ONEDRIVE_INVALID_BACKUP');
});

it('rejects reserved object keys in remote deletion markers', () => {
  const value = payload();
  value.snapshot.tombstones.push({
    entityType: 'note',
    id: '__proto__',
    deletedAt: Date.now(),
    sourceDeviceId: device,
  });
  expect(() => parseOneDriveSnapshot(value)).toThrow('ONEDRIVE_INVALID_BACKUP');
});

it('rejects a foreign pagination endpoint before attaching any token', async () => {
  await expect(graphRequest('https://attacker.test/v1.0/me/drive/')).rejects.toThrow(
    'ONEDRIVE_INVALID_ENDPOINT'
  );
  expect(fetch).not.toHaveBeenCalled();
});

it('loads only profile snapshots from the app folder, not unrelated files', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ parentReference: { driveId: 'test-drive' } }))
    .mockResolvedValueOnce(
      Response.json({
        value: [
          { id: 'test-file', name: `tabnotes-${device}.json`, size: 500, file: {} },
          { id: 'unrelated-file', name: 'do-not-touch.txt', size: 100, file: {} },
        ],
      })
    )
    .mockResolvedValueOnce(Response.json(payload()));
  const result = await readOneDriveSnapshots();
  expect(result.driveId).toBe('test-drive');
  expect(result.snapshots).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(vi.mocked(fetch).mock.calls[2][0]).toBe(
    'https://graph.microsoft.com/v1.0/me/drive/items/test-file/content'
  );
});

it('does not treat a folder/network error as an empty backup', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 403 }));
  await expect(readOneDriveSnapshots()).rejects.toMatchObject({ status: 403 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('writes only its own profile file, with no write replay after an ambiguous failure', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(writeOneDriveSnapshot(snapshot())).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
    `https://graph.microsoft.com/v1.0/me/drive/special/approot:/tabnotes-${device}.json:/content`
  );
  expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'PUT', credentials: 'omit' });
});

it('rejects oversized metadata before downloading a backup', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(Response.json({ parentReference: { driveId: 'test-drive' } }))
    .mockResolvedValueOnce(
      Response.json({
        value: [
          { id: 'large', name: `tabnotes-${device}.json`, size: 200 * 1024 * 1024, file: {} },
        ],
      })
    );
  await expect(readOneDriveSnapshots()).rejects.toThrow('ONEDRIVE_BACKUP_TOO_LARGE');
  expect(fetch).toHaveBeenCalledTimes(2);
});
