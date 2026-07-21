import { afterEach, describe, expect, it, vi } from 'vitest';
import { findBackupFile, loadBackupFile, parseRetryAfterMs } from './driveClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

function errorResponse(
  status: number,
  body: unknown,
  retryAfter?: string,
  statusText = 'Drive request failed'
): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: retryAfter ? { 'Retry-After': retryAfter, 'Content-Type': 'application/json' } : undefined,
  });
}

describe('parseRetryAfterMs', () => {
  it('parses Retry-After delay seconds', () => {
    expect(parseRetryAfterMs('1.5')).toBe(1_500);
    expect(parseRetryAfterMs('0')).toBe(0);
  });

  it('parses Retry-After HTTP dates relative to the supplied clock', () => {
    const now = Date.UTC(2025, 0, 1, 0, 0, 0);
    expect(parseRetryAfterMs('Wed, 01 Jan 2025 00:00:05 GMT', now)).toBe(5_000);
    expect(parseRetryAfterMs('Wed, 01 Jan 2024 00:00:00 GMT', now)).toBe(0);
  });

  it('ignores invalid Retry-After values', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('not-a-date')).toBeUndefined();
    expect(parseRetryAfterMs('-1')).toBeUndefined();
    expect(parseRetryAfterMs('1e+308')).toBeUndefined();
  });
});

describe('Drive API errors', () => {
  it('exposes the Drive reason and Retry-After on failed file lookups', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        errorResponse(
          403,
          { error: { message: 'Quota exceeded', errors: [{ reason: 'rateLimitExceeded' }] } },
          '2.5'
        )
      )
    );

    await expect(findBackupFile('token')).rejects.toMatchObject({
      name: 'DriveApiError',
      status: 403,
      message: 'Quota exceeded',
      reason: 'rateLimitExceeded',
      retryAfterMs: 2_500,
    });
  });

  it('preserves retry metadata when a backup download returns a non-JSON error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('gateway unavailable', { status: 503, statusText: 'Unavailable', headers: { 'Retry-After': '1' } }))
    );

    await expect(loadBackupFile('token', 'backup-file')).rejects.toMatchObject({
      name: 'DriveApiError',
      status: 503,
      message: 'Unavailable',
      retryAfterMs: 1_000,
    });
  });
});
