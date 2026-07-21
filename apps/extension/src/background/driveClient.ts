export interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export class DriveApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILENAME = 'tabnotes-backup.json';
const DRIVE_FILE_FIELDS = 'id,name,modifiedTime,size';

function escapeDriveQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function parseRetryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const milliseconds = Math.round(seconds * 1_000);
  if (Number.isFinite(milliseconds) && milliseconds >= 0) return milliseconds;
  if (/^-/.test(value.trim())) return undefined;
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : undefined;
}

async function parseErrorResponse(response: Response): Promise<{
  message: string;
  reason?: string;
  retryAfterMs?: number;
}> {
  const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
  try {
    const body = (await response.json()) as {
      error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    const reason = body.error?.errors?.[0]?.reason;
    const message = body.error?.message ?? body.error?.errors?.[0]?.message ?? response.statusText;
    return { message, reason, retryAfterMs };
  } catch {
    return { message: response.statusText, retryAfterMs };
  }
}

async function driveFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new DriveApiError(response.status, parsed.message, parsed.reason, parsed.retryAfterMs);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function findBackupFile(token: string): Promise<DriveFile | null> {
  const q = `name='${escapeDriveQueryString(BACKUP_FILENAME)}' and trashed=false`;
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    pageSize: '1',
    fields: `files(${DRIVE_FILE_FIELDS})`,
  });
  const data = await driveFetch<{ files?: DriveFile[] }>(token, `${DRIVE_API}/files?${params}`);
  return data.files?.[0] ?? null;
}

export async function createBackupFile(token: string, payload: unknown): Promise<DriveFile> {
  const metadata = {
    name: BACKUP_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append(
    'file',
    new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    BACKUP_FILENAME
  );

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: DRIVE_FILE_FIELDS,
  });
  return driveFetch<DriveFile>(token, `${UPLOAD_API}/files?${params}`, {
    method: 'POST',
    body: form,
  });
}

export async function updateBackupFile(
  token: string,
  fileId: string,
  payload: unknown
): Promise<DriveFile> {
  const params = new URLSearchParams({
    uploadType: 'media',
    fields: DRIVE_FILE_FIELDS,
  });
  return driveFetch<DriveFile>(token, `${UPLOAD_API}/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function saveBackupFile(
  token: string,
  payload: unknown,
  knownFileId?: string
): Promise<DriveFile> {
  if (knownFileId) {
    try {
      return await updateBackupFile(token, knownFileId, payload);
    } catch (error) {
      if (!(error instanceof DriveApiError) || error.status !== 404) throw error;
    }
  }

  const existing = await findBackupFile(token);
  if (existing) return updateBackupFile(token, existing.id, payload);
  return createBackupFile(token, payload);
}

export async function loadBackupFile(token: string, fileId?: string): Promise<unknown | null> {
  const file = fileId
    ? ({ id: fileId, name: BACKUP_FILENAME } as DriveFile)
    : await findBackupFile(token);
  if (!file) return null;

  const response = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new DriveApiError(response.status, parsed.message, parsed.reason, parsed.retryAfterMs);
  }

  return response.json();
}
