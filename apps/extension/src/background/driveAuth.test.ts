import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  disconnectGoogle,
  getGoogleAuthToken,
  getOAuthSetupStatus,
  isGoogleConnected,
  refreshGoogleAuthToken,
} from './driveAuth';

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
  it.each([
    { userAgent: 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0' },
    {
      userAgent: 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36',
      userAgentData: { brands: [{ brand: 'Microsoft Edge' }] },
    },
  ])('does not invoke an unsupported Edge API, even if it exists', async (navigatorValue) => {
    const getAuthToken = installChrome(PUBLISHED_EXTENSION_ID);
    vi.stubGlobal('navigator', navigatorValue);
    expect(getOAuthSetupStatus()).toMatchObject({
      configured: false,
      reasonCode: 'edge_auth_required',
    });
    await expect(getGoogleAuthToken(true)).rejects.toThrow('Microsoft Edge');
    await expect(getGoogleAuthToken(false)).rejects.toThrow('Microsoft Edge');
    await expect(isGoogleConnected()).resolves.toBe(false);
    await expect(refreshGoogleAuthToken('old-token')).rejects.toThrow('Microsoft Edge');
    await expect(disconnectGoogle()).resolves.toBeUndefined();
    expect(getAuthToken).not.toHaveBeenCalled();
  });

  it('fails safely when the identity API is missing', async () => {
    installChrome(PUBLISHED_EXTENSION_ID);
    vi.stubGlobal('navigator', { userAgent: 'Other browser' });
    vi.stubGlobal('chrome', { ...chrome, identity: undefined });
    expect(getOAuthSetupStatus()).toMatchObject({
      configured: false,
      reasonCode: 'identity_unavailable',
    });
    await expect(getGoogleAuthToken(true)).rejects.toThrow(
      'Local notes and manual backups remain available'
    );
  });

  it('preserves the native Chrome login, refresh and disconnect paths', async () => {
    const getAuthToken = installChrome(PUBLISHED_EXTENSION_ID);
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36' });
    const removeCachedAuthToken = vi.fn((_options: unknown, callback: () => void) => callback());
    vi.stubGlobal('chrome', { ...chrome, identity: { getAuthToken, removeCachedAuthToken } });
    getAuthToken.mockImplementation(
      (_options: unknown, callback: (result: { token: string }) => void) =>
        callback({ token: 'chrome-token' })
    );
    await expect(getGoogleAuthToken(true)).resolves.toBe('chrome-token');
    expect(getAuthToken).toHaveBeenLastCalledWith({ interactive: true }, expect.any(Function));
    await expect(refreshGoogleAuthToken('old-token')).resolves.toBe('chrome-token');
    expect(removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'old-token' },
      expect.any(Function)
    );
    expect(getAuthToken).toHaveBeenLastCalledWith({ interactive: false }, expect.any(Function));
    await expect(disconnectGoogle()).resolves.toBeUndefined();
    expect(removeCachedAuthToken).toHaveBeenLastCalledWith(
      { token: 'chrome-token' },
      expect.any(Function)
    );
  });

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
