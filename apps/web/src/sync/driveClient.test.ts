import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findWebBackupFile, loadWebBackupFile, saveWebBackupFile } from './driveClient';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('web Drive client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds the backup inside the private app-data space', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: 'file-1', name: 'tabnotes-backup.json' }] })
    );

    await expect(findWebBackupFile('token')).resolves.toEqual({
      id: 'file-1',
      name: 'tabnotes-backup.json',
    });

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get('spaces')).toBe('appDataFolder');
    expect(requestUrl.searchParams.get('pageSize')).toBe('1');
    expect(fetchMock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer token');
  });

  it('recovers from a stale file id before updating the current backup', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'File not found' } }, 404))
      .mockResolvedValueOnce(
        jsonResponse({ files: [{ id: 'current-file', name: 'tabnotes-backup.json' }] })
      )
      .mockResolvedValueOnce(jsonResponse({ id: 'current-file', name: 'tabnotes-backup.json' }));

    await expect(saveWebBackupFile('token', { revision: 3 }, 'stale-file')).resolves.toEqual({
      id: 'current-file',
      name: 'tabnotes-backup.json',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/files/current-file');
  });

  it('exposes structured API errors when restoring a backup fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'Permission denied' } }, 403));

    await expect(loadWebBackupFile('token', 'file-1')).rejects.toMatchObject({
      name: 'WebDriveApiError',
      status: 403,
      message: 'Permission denied',
    });
  });
});
