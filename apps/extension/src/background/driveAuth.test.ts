import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleAuthToken, getOAuthSetupStatus } from './driveAuth';

const PUBLISHED_EXTENSION_ID = 'pniapenkdphjolncppcichbahomfiffj';

function installChrome(runtimeId: string) {
  const getAuthToken = vi.fn();
  vi.stubGlobal('chrome', {
    runtime: {
      id: runtimeId,
      getManifest: () => ({
        oauth2: {
          client_id: '770771238390-p2lkbe0j4vk2ihco2s50dhd9dq956en0.apps.googleusercontent.com',
          scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        },
      }),
      lastError: undefined,
    },
    identity: { getAuthToken },
  });
  return getAuthToken;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Google Drive OAuth setup', () => {
  it('accepts the published Store extension ID', () => {
    installChrome(PUBLISHED_EXTENSION_ID);

    expect(getOAuthSetupStatus()).toMatchObject({ configured: true });
  });

  it('does not send the Store OAuth client from an unpacked clone', async () => {
    const getAuthToken = installChrome('abcdefghijklmnopabcdefghijklmnop');

    expect(getOAuthSetupStatus()).toMatchObject({
      configured: false,
      reason: expect.stringContaining('unpacked build'),
    });
    await expect(getGoogleAuthToken(true)).rejects.toThrow('unpacked build');
    expect(getAuthToken).not.toHaveBeenCalled();
  });
});
