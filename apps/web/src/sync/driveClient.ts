export interface WebDriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export class WebDriveApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'WebDriveApiError';
  }
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const BACKUP_FILENAME = 'tabnotes-backup.json';
const DRIVE_FILE_FIELDS = 'id,name,modifiedTime,size';

function escapeDriveQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function parseErrorResponse(response: Response): Promise<{ message: string; reason?: string }> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
    };
    const reason = body.error?.errors?.[0]?.reason;
    const message = body.error?.message ?? body.error?.errors?.[0]?.message ?? response.statusText;
    return { message, reason };
  } catch {
    return { message: response.statusText };
  }
}

async function driveFetch<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new WebDriveApiError(response.status, parsed.message, parsed.reason);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function findWebBackupFile(token: string): Promise<WebDriveFile | null> {
  const q = `name='${escapeDriveQueryString(BACKUP_FILENAME)}' and trashed=false`;
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q,
    pageSize: '1',
    fields: `files(${DRIVE_FILE_FIELDS})`,
  });
  const data = await driveFetch<{ files?: WebDriveFile[] }>(token, `${DRIVE_API}/files?${params}`);
  return data.files?.[0] ?? null;
}

export async function createWebBackupFile(token: string, payload: unknown): Promise<WebDriveFile> {
  const metadata = {
    name: BACKUP_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }), BACKUP_FILENAME);

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: DRIVE_FILE_FIELDS,
  });
  return driveFetch<WebDriveFile>(token, `${UPLOAD_API}/files?${params}`, {
    method: 'POST',
    body: form,
  });
}

export async function updateWebBackupFile(
  token: string,
  fileId: string,
  payload: unknown,
): Promise<WebDriveFile> {
  const params = new URLSearchParams({
    uploadType: 'media',
    fields: DRIVE_FILE_FIELDS,
  });
  return driveFetch<WebDriveFile>(token, `${UPLOAD_API}/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function saveWebBackupFile(
  token: string,
  payload: unknown,
  knownFileId?: string,
): Promise<WebDriveFile> {
  if (knownFileId) {
    try {
      return await updateWebBackupFile(token, knownFileId, payload);
    } catch (error) {
      if (!(error instanceof WebDriveApiError) || error.status !== 404) throw error;
    }
  }

  const existing = await findWebBackupFile(token);
  if (existing) return updateWebBackupFile(token, existing.id, payload);
  return createWebBackupFile(token, payload);
}

export async function loadWebBackupFile(token: string, fileId?: string): Promise<unknown | null> {
  const file = fileId ? ({ id: fileId, name: BACKUP_FILENAME } as WebDriveFile) : await findWebBackupFile(token);
  if (!file) return null;

  const response = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const parsed = await parseErrorResponse(response);
    throw new WebDriveApiError(response.status, parsed.message, parsed.reason);
  }
  return response.json();
}

