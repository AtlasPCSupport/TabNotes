import {
  DEFAULT_STORAGE,
  MAX_BACKUP_IMPORT_BYTES,
  isBackupImportTextWithinLimit,
  parseAnyDriveSyncEnvelope,
  parseBackupImport,
  type DriveSyncEnvelope,
} from '@tabnotes/shared';
import { getOneDriveToken } from './oneDriveAuth';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SNAPSHOT_NAME =
  /^tabnotes-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/i;
const MAX_DEVICES = 100;

export class OneDriveApiError extends Error {
  constructor(readonly status: number) {
    super(`ONEDRIVE_HTTP_${status}`);
  }
}

export async function graphRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const url = new URL(path, `${GRAPH}/`);
  if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/me/drive/')) {
    throw new Error('ONEDRIVE_INVALID_ENDPOINT');
  }
  const read = !init.method || init.method === 'GET';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = await getOneDriveToken(false, attempt === 1);
    const response = await fetch(url.href, {
      ...init,
      credentials: 'omit',
      headers: {
        ...Object.fromEntries(new Headers(init.headers)),
        Authorization: `Bearer ${token}`,
      },
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    if (response.status === 401 && read && attempt === 0) continue;
    if (!response.ok) throw new OneDriveApiError(response.status);
    return response;
  }
  throw new OneDriveApiError(401);
}

export function parseOneDriveSnapshot(value: unknown): DriveSyncEnvelope {
  const wrapper = value as { kind?: unknown; schema?: unknown; snapshot?: unknown } | null;
  if (wrapper?.kind !== 'tabnotes.oneDriveSync' || wrapper.schema !== 1)
    throw new Error('ONEDRIVE_INVALID_BACKUP');
  const snapshot = parseAnyDriveSyncEnvelope(wrapper.snapshot);
  const data = snapshot ? parseBackupImport(snapshot.data) : null;
  const raw = wrapper.snapshot as { tombstones?: unknown[] };
  if (
    !snapshot ||
    !data ||
    snapshot.storageVersion > DEFAULT_STORAGE.version ||
    !Number.isFinite(snapshot.syncRevision) ||
    snapshot.syncRevision < 1 ||
    !Number.isFinite(snapshot.exportedAt) ||
    !Number.isFinite(Date.parse(snapshot.syncedAt)) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      snapshot.sourceDeviceId
    ) ||
    !Array.isArray(raw.tombstones) ||
    snapshot.tombstones.length !== raw.tombstones.length ||
    snapshot.tombstones.length > 100_000 ||
    snapshot.tombstones.some(
      (t) =>
        !Number.isFinite(t.deletedAt) ||
        t.deletedAt < 0 ||
        t.deletedAt > 8_640_000_000_000_000 ||
        ['__proto__', 'constructor', 'prototype'].includes(t.id) ||
        t.id.length > 256 ||
        !t.id ||
        t.sourceDeviceId.length > 256
    )
  ) {
    throw new Error('ONEDRIVE_INVALID_BACKUP');
  }
  return { ...snapshot, data: data.data };
}

async function boundedText(response: Response, maxBytes: number): Promise<string> {
  if (Number(response.headers.get('Content-Length')) > maxBytes)
    throw new Error('ONEDRIVE_BACKUP_TOO_LARGE');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('ONEDRIVE_INVALID_BACKUP');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error('ONEDRIVE_BACKUP_TOO_LARGE');
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

export async function readOneDriveSnapshots(signal?: AbortSignal): Promise<{
  driveId: string;
  snapshots: DriveSyncEnvelope[];
}> {
  const root = (await (await graphRequest('me/drive/special/approot', { signal })).json()) as {
    parentReference?: { driveId?: unknown };
  };
  const driveId = root.parentReference?.driveId;
  if (typeof driveId !== 'string' || !driveId || driveId.length > 256)
    throw new Error('ONEDRIVE_INVALID_FOLDER');
  let next: string | undefined =
    `${GRAPH}/me/drive/special/approot/children?$select=id,name,size,file&$top=200`;
  const files: { id: string; name: string; size: number }[] = [];
  let pages = 0;
  while (next) {
    if (++pages > 10) throw new Error('ONEDRIVE_TOO_MANY_FILES');
    const listing = (await (await graphRequest(next, { signal })).json()) as {
      value?: { id?: string; name?: string; size?: number; file?: unknown }[];
      '@odata.nextLink'?: string;
    };
    if (!Array.isArray(listing.value)) throw new Error('ONEDRIVE_INVALID_FOLDER');
    for (const item of listing.value) {
      if (!item.name || !SNAPSHOT_NAME.test(item.name)) continue;
      if (
        !item.id ||
        !item.file ||
        typeof item.size !== 'number' ||
        !Number.isFinite(item.size) ||
        item.size < 0
      )
        throw new Error('ONEDRIVE_INVALID_BACKUP');
      files.push({ id: item.id, name: item.name, size: item.size });
    }
    next = listing['@odata.nextLink'];
    if (
      files.length > MAX_DEVICES ||
      files.reduce((sum, f) => sum + f.size, 0) > MAX_BACKUP_IMPORT_BYTES
    ) {
      throw new Error('ONEDRIVE_BACKUP_TOO_LARGE');
    }
  }
  const snapshots: DriveSyncEnvelope[] = [];
  let remaining = MAX_BACKUP_IMPORT_BYTES;
  for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
    const response = await graphRequest(`me/drive/items/${encodeURIComponent(file.id)}/content`, {
      signal,
    });
    const text = await boundedText(response, remaining);
    remaining -= new TextEncoder().encode(text).byteLength;
    const snapshot = parseOneDriveSnapshot(JSON.parse(text));
    if (`tabnotes-${snapshot.sourceDeviceId}.json`.toLowerCase() !== file.name.toLowerCase())
      throw new Error('ONEDRIVE_INVALID_BACKUP');
    snapshots.push(snapshot);
  }
  return { driveId, snapshots };
}

/** One writer per profile file; another device never overwrites this snapshot.
 * No automatic retry: a failed write can have an unknown remote outcome. */
export async function writeOneDriveSnapshot(
  snapshot: DriveSyncEnvelope,
  signal?: AbortSignal
): Promise<void> {
  const name = `tabnotes-${snapshot.sourceDeviceId}.json`;
  if (!SNAPSHOT_NAME.test(name)) throw new Error('ONEDRIVE_INVALID_DEVICE');
  const payload = { kind: 'tabnotes.oneDriveSync', schema: 1, snapshot };
  parseOneDriveSnapshot(payload);
  const text = JSON.stringify(payload);
  if (!isBackupImportTextWithinLimit(text)) throw new Error('ONEDRIVE_BACKUP_TOO_LARGE');
  await graphRequest(`me/drive/special/approot:/${name}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: text,
    signal,
  });
}
