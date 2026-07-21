import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriveApiError } from './driveClient';
import {
  DRIVE_SYNC_STORAGE_KEY,
  MAX_RETRY_DELAY_MS,
  isTransientDriveError,
  retryDelayFor,
  retryTransientDriveRead,
} from './driveSync';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createChromeStorage(initial: Record<string, unknown>) {
  const data = { ...initial };
  const get = vi.fn(
    (keys: string | string[], callback: (result: Record<string, unknown>) => void) => {
      const requested = Array.isArray(keys) ? keys : [keys];
      callback(Object.fromEntries(requested.map((key) => [key, data[key]])));
    }
  );
  const set = vi.fn((values: Record<string, unknown>, callback: () => void) => {
    Object.assign(data, values);
    callback();
  });

  return { data, get, set };
}

function installChrome(
  storage: ReturnType<typeof createChromeStorage>,
  options: { configured?: boolean } = {}
) {
  const configured = options.configured ?? true;
  const alarms = {
    create: vi.fn(),
    clear: vi.fn((_name: string, callback: () => void) => callback()),
  };
  vi.stubGlobal('chrome', {
    runtime: {
      getManifest: () => ({
        oauth2: configured
          ? {
              client_id: '1234567890-test.apps.googleusercontent.com',
              scopes: ['https://www.googleapis.com/auth/drive.appdata'],
            }
          : {},
      }),
      lastError: undefined,
    },
    storage: { local: { get: storage.get, set: storage.set } },
    identity: {
      getAuthToken: vi.fn((_options: unknown, callback: (token: string) => void) => callback('token')),
      removeCachedAuthToken: vi.fn((_options: unknown, callback: () => void) => callback()),
    },
    alarms,
  });
  return alarms;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock('./driveClient');
  vi.resetModules();
});

describe('Drive sync retry policy', () => {
  it.each([408, 429, 500, 503])('treats HTTP %i as transient', (status) => {
    expect(isTransientDriveError(new DriveApiError(status, 'temporary'))).toBe(true);
  });

  it.each(['rateLimitExceeded', 'userRateLimitExceeded'])(
    'retries Drive 403 %s responses and honors Retry-After',
    async (reason) => {
      const error = new DriveApiError(403, 'limited', reason, 0);
      expect(isTransientDriveError(error)).toBe(true);
      expect(retryDelayFor(error, 0)).toBe(0);
      expect(retryDelayFor(new DriveApiError(403, 'limited', reason, 90_000), 0)).toBe(
        MAX_RETRY_DELAY_MS
      );

      let attempts = 0;
      await expect(
        retryTransientDriveRead(async () => {
          attempts += 1;
          if (attempts === 1) throw error;
          return 'backup';
        })
      ).resolves.toBe('backup');
      expect(attempts).toBe(2);
    }
  );

  it.each([400, 401, 403, 404])('does not retry HTTP %i without a rate-limit reason', (status) => {
    expect(isTransientDriveError(new DriveApiError(status, 'permanent'))).toBe(false);
  });

  it('does not retry ordinary errors', () => {
    expect(isTransientDriveError(new Error('offline'))).toBe(false);
  });

  it('honors Retry-After while bounding the wait time', () => {
    expect(retryDelayFor(new DriveApiError(429, 'limited', undefined, 1_234), 0)).toBe(1_234);
    expect(retryDelayFor(new DriveApiError(429, 'limited', undefined, 90_000), 0)).toBe(30_000);
  });

  it('uses bounded exponential retry delays when Retry-After is absent', () => {
    const error = new DriveApiError(503, 'unavailable');
    const firstDelay = retryDelayFor(error, 0);
    const secondDelay = retryDelayFor(error, 1);
    expect(firstDelay).toBeGreaterThanOrEqual(250);
    expect(firstDelay).toBeLessThanOrEqual(300);
    expect(secondDelay).toBeGreaterThanOrEqual(1_000);
    expect(secondDelay).toBeLessThanOrEqual(1_200);
    expect(retryDelayFor(error, 2)).toBe(MAX_RETRY_DELAY_MS);
  });

  it('replays transient read failures but stops on permanent errors', async () => {
    let attempts = 0;
    await expect(
      retryTransientDriveRead(async () => {
        attempts += 1;
        if (attempts < 3) throw new DriveApiError(503, 'unavailable', undefined, 0);
        return 'backup';
      })
    ).resolves.toBe('backup');
    expect(attempts).toBe(3);

    attempts = 0;
    await expect(
      retryTransientDriveRead(async () => {
        attempts += 1;
        throw new DriveApiError(404, 'missing');
      })
    ).rejects.toMatchObject({ status: 404 });
    expect(attempts).toBe(1);
  });

  it.each(['rateLimitExceeded', 'userRateLimitExceeded'])(
    'retries quota-limited reads for 403 %s without turning other 403s into retries',
    async (reason) => {
      let attempts = 0;
      await expect(
        retryTransientDriveRead(async () => {
          attempts += 1;
          if (attempts === 1) throw new DriveApiError(403, 'quota limited', reason, 0);
          return 'backup';
        })
      ).resolves.toBe('backup');
      expect(attempts).toBe(2);

      attempts = 0;
      await expect(
        retryTransientDriveRead(async () => {
          attempts += 1;
          throw new DriveApiError(403, 'forbidden', 'insufficientPermissions');
        })
      ).rejects.toMatchObject({ reason: 'insufficientPermissions' });
      expect(attempts).toBe(1);
    }
  );
});

describe('performDriveBackup coalescing', () => {
  it('queues an explicit backup behind an automatic backup that skips as up-to-date', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: {
        enabled: true,
        status: 'ok',
        lastSyncedAt: Date.now(),
        remoteModifiedTime: 'remote-v1',
      },
      tabnotes_data: {},
    });
    installChrome(storage);

    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => {
          await sleep(20);
          return { id: 'backup-file', modifiedTime: 'remote-v1' };
        }),
        loadBackupFile: vi.fn(async () => null),
        saveBackupFile: vi.fn(async () => ({ id: 'backup-file', modifiedTime: 'remote-v2' })),
      };
    });

    const { performDriveBackup: backup } = await import('./driveSync');
    const automatic = backup('auto');
    await sleep(0);
    const manual = backup('manual');

    await expect(automatic).resolves.toMatchObject({ status: 'ok' });
    await expect(manual).resolves.toMatchObject({ status: 'ok', remoteModifiedTime: 'remote-v2' });

    const { saveBackupFile } = await import('./driveClient');
    expect(saveBackupFile).toHaveBeenCalledTimes(1);
  });

  it('runs an external backup after a queued disconnect instead of sharing it', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'ok' },
      tabnotes_data: {},
    });
    installChrome(storage);

    let resolveFirstRemoteRead: (() => void) | undefined;
    let notifyFirstRemoteReadStarted: (() => void) | undefined;
    const firstRemoteRead = new Promise<void>((resolve) => {
      resolveFirstRemoteRead = resolve;
    });
    const firstRemoteReadStarted = new Promise<void>((resolve) => {
      notifyFirstRemoteReadStarted = resolve;
    });
    let finds = 0;
    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => {
          finds += 1;
          if (finds === 1) {
            notifyFirstRemoteReadStarted?.();
            await firstRemoteRead;
          }
          return null;
        }),
        loadBackupFile: vi.fn(async () => null),
        saveBackupFile: vi.fn(async () => ({ id: 'backup-file', modifiedTime: 'remote-v1' })),
      };
    });

    const { disconnectDriveSync: disconnect, performDriveBackup: backup } = await import('./driveSync');
    const firstBackup = backup('external');
    await firstRemoteReadStarted;
    const disconnectPromise = disconnect();
    const secondBackup = backup('external');
    resolveFirstRemoteRead?.();

    await expect(firstBackup).resolves.toEqual(expect.any(Object));
    await expect(disconnectPromise).resolves.toMatchObject({ enabled: false, status: 'disconnected' });
    await expect(secondBackup).resolves.toMatchObject({ enabled: false, status: 'disconnected' });

    const { findBackupFile, saveBackupFile } = await import('./driveClient');
    expect(findBackupFile).toHaveBeenCalledTimes(1);
    expect(saveBackupFile).not.toHaveBeenCalled();
  });

  it('does not write after disconnect cancels an in-flight backup', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'ok' },
      tabnotes_data: {},
    });
    installChrome(storage);

    let resolveRemoteRead: (() => void) | undefined;
    let notifyRemoteReadStarted: (() => void) | undefined;
    const remoteRead = new Promise<void>((resolve) => {
      resolveRemoteRead = resolve;
    });
    const remoteReadStarted = new Promise<void>((resolve) => {
      notifyRemoteReadStarted = resolve;
    });
    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => {
          notifyRemoteReadStarted?.();
          await remoteRead;
          return null;
        }),
        loadBackupFile: vi.fn(async () => null),
        saveBackupFile: vi.fn(async () => ({ id: 'backup-file', modifiedTime: 'remote-v1' })),
      };
    });

    const { disconnectDriveSync: disconnect, performDriveBackup: backup } = await import('./driveSync');
    const backupPromise = backup('external');
    await remoteReadStarted;
    const disconnectPromise = disconnect();
    resolveRemoteRead?.();

    await expect(backupPromise).resolves.toEqual(expect.any(Object));
    await expect(disconnectPromise).resolves.toMatchObject({ enabled: false, status: 'disconnected' });

    const { saveBackupFile } = await import('./driveClient');
    expect(saveBackupFile).not.toHaveBeenCalled();
    expect(storage.data[DRIVE_SYNC_STORAGE_KEY]).toMatchObject({
      enabled: false,
      status: 'disconnected',
    });
  });

  it('does not persist a completion state after disconnect begins during a write', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'ok' },
      tabnotes_data: {},
    });
    installChrome(storage);

    let resolveWrite: (() => void) | undefined;
    let notifyWriteStarted: (() => void) | undefined;
    const write = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      notifyWriteStarted = resolve;
    });
    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => null),
        loadBackupFile: vi.fn(),
        saveBackupFile: vi.fn(async () => {
          notifyWriteStarted?.();
          await write;
          return { id: 'backup-file', modifiedTime: 'remote-v1' };
        }),
      };
    });

    const { disconnectDriveSync: disconnect, performDriveBackup: backup } = await import('./driveSync');
    const backupPromise = backup('external');
    await writeStarted;
    const disconnectPromise = disconnect();
    const completionStateWriteCountAtDisconnect = storage.set.mock.calls.filter(([values]) => {
      const state = values[DRIVE_SYNC_STORAGE_KEY] as { enabled?: boolean; status?: string };
      return state.enabled === true && state.status === 'ok';
    }).length;
    resolveWrite?.();

    await expect(backupPromise).resolves.toEqual(expect.any(Object));
    await expect(disconnectPromise).resolves.toMatchObject({ enabled: false, status: 'disconnected' });
    expect(
      storage.set.mock.calls.filter(([values]) => {
        const state = values[DRIVE_SYNC_STORAGE_KEY] as { enabled?: boolean; status?: string };
        return state.enabled === true && state.status === 'ok';
      })
    ).toHaveLength(completionStateWriteCountAtDisconnect);
    expect(storage.data[DRIVE_SYNC_STORAGE_KEY]).toMatchObject({
      enabled: false,
      status: 'disconnected',
    });
  });

  it('updates a stale file ID after recovering the current backup', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'ok', fileId: 'stale-file' },
      tabnotes_data: {},
    });
    installChrome(storage);

    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => ({ id: 'current-file', modifiedTime: 'remote-v1' })),
        loadBackupFile: vi.fn(async (_token, fileId) => {
          if (fileId === 'stale-file') throw new actual.DriveApiError(404, 'missing');
          return null;
        }),
        saveBackupFile: vi.fn(async (_token, _payload, fileId) => ({
          id: fileId ?? 'unexpected-file',
          modifiedTime: 'remote-v2',
        })),
      };
    });

    const { performDriveBackup: backup } = await import('./driveSync');
    await expect(backup('manual')).resolves.toMatchObject({ fileId: 'current-file' });

    const { findBackupFile, loadBackupFile, saveBackupFile } = await import('./driveClient');
    expect(loadBackupFile).toHaveBeenNthCalledWith(1, 'token', 'stale-file');
    expect(findBackupFile).toHaveBeenCalledTimes(1);
    expect(loadBackupFile).toHaveBeenNthCalledWith(2, 'token', 'current-file');
    expect(saveBackupFile).toHaveBeenCalledWith('token', expect.any(Object), 'current-file');
  });

  it('serializes a restore behind an in-flight backup', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'idle' },
      tabnotes_data: {},
    });
    installChrome(storage);

    let resolveWrite: (() => void) | undefined;
    let notifyWriteStarted: (() => void) | undefined;
    const write = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    const writeStarted = new Promise<void>((resolve) => {
      notifyWriteStarted = resolve;
    });
    let savedPayload: unknown = null;
    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => ({ id: 'backup-file', modifiedTime: 'remote-v1' })),
        // The backup observes no existing content, then the queued restore reads
        // the payload that the backup wrote after it has completed.
        loadBackupFile: vi.fn(async () => savedPayload),
        saveBackupFile: vi.fn(async (_token, payload) => {
          savedPayload = payload;
          notifyWriteStarted?.();
          await write;
          return { id: 'backup-file', modifiedTime: 'remote-v1' };
        }),
      };
    });

    const { performDriveBackup: backup, restoreDriveBackup: restore } = await import('./driveSync');
    const backupPromise = backup('external');
    await writeStarted;
    const restorePromise = restore();

    const { loadBackupFile } = await import('./driveClient');
    expect(loadBackupFile).toHaveBeenCalledTimes(1);

    resolveWrite!();
    await expect(backupPromise).resolves.toMatchObject({ status: 'ok' });
    await expect(restorePromise).resolves.toMatchObject({ status: 'ok' });
    expect(loadBackupFile).toHaveBeenCalledTimes(2);
  });

  it('does not refresh or replay a write that returns 401', async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'idle' },
      tabnotes_data: {},
    });
    installChrome(storage);

    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => null),
        loadBackupFile: vi.fn(),
        saveBackupFile: vi.fn(async () => {
          throw new actual.DriveApiError(401, 'write unauthorized');
        }),
      };
    });

    const { performDriveBackup: backup } = await import('./driveSync');
    await expect(backup('manual')).rejects.toThrow('write unauthorized');

    const { saveBackupFile } = await import('./driveClient');
    expect(saveBackupFile).toHaveBeenCalledTimes(1);
    expect(chrome.identity.removeCachedAuthToken).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rate limited'],
    [503, 'service unavailable'],
  ])('does not replay an ambiguous HTTP %i write outcome', async (status, message) => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'idle' },
      tabnotes_data: {},
    });
    installChrome(storage);

    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => null),
        loadBackupFile: vi.fn(),
        saveBackupFile: vi.fn(async () => {
          throw new actual.DriveApiError(status, message, undefined, 0);
        }),
      };
    });

    const { performDriveBackup: backup } = await import('./driveSync');
    await expect(backup('manual')).rejects.toThrow(message);

    const { saveBackupFile } = await import('./driveClient');
    expect(saveBackupFile).toHaveBeenCalledTimes(1);
  });

  it("shares one write while preserving each caller's failure semantics", async () => {
    vi.resetModules();
    const storage = createChromeStorage({
      [DRIVE_SYNC_STORAGE_KEY]: { enabled: true, status: 'idle' },
      tabnotes_data: {},
    });
    installChrome(storage);

    vi.doMock('./driveClient', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./driveClient')>();
      return {
        ...actual,
        findBackupFile: vi.fn(async () => null),
        loadBackupFile: vi.fn(),
        saveBackupFile: vi.fn(async () => {
          await sleep(20);
          throw new DriveApiError(500, 'write failed');
        }),
      };
    });

    const { performDriveBackup: backup } = await import('./driveSync');
    const manual = backup('manual');
    await sleep(0);
    const automatic = backup('auto');

    await expect(manual).rejects.toThrow('write failed');
    await expect(automatic).resolves.toMatchObject({ status: 'error', lastError: 'write failed' });

    const { saveBackupFile } = await import('./driveClient');
    expect(saveBackupFile).toHaveBeenCalledTimes(1);
  });
});
