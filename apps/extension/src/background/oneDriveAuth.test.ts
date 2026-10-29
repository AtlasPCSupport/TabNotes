import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ONEDRIVE_ORIGINS } from '../shared/oneDrive';
import {
  createPkce,
  readAuthorizationCode,
  getOneDriveToken,
  disconnectOneDriveAuth,
} from './oneDriveAuth';

const redirect = 'https://noabjgjemigfaimfahmbnlccibmkmaam.chromiumapp.org/onedrive';
let data: Record<string, unknown>;
let auth: ReturnType<typeof vi.fn>;
let set: ReturnType<typeof vi.fn>;
let grant: ReturnType<typeof vi.fn>;

beforeEach(() => {
  data = {};
  grant = vi.fn(async () => true);
  set = vi.fn(async (values: Record<string, unknown>) => {
    Object.assign(data, values);
  });
  auth = vi.fn(async ({ url }: { url: string }) => {
    const state = new URL(url).searchParams.get('state');
    return `${redirect}?code=synthetic-code&state=${state}`;
  });
  vi.stubGlobal('chrome', {
    runtime: { id: 'noabjgjemigfaimfahmbnlccibmkmaam' },
    permissions: { contains: grant },
    identity: { getRedirectURL: vi.fn(() => redirect), launchWebAuthFlow: auth },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: data[key] })),
        set,
        remove: vi.fn(async (key: string) => {
          delete data[key];
        }),
        setAccessLevel: vi.fn(async () => {}),
      },
    },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        access_token: 'synthetic-token',
        refresh_token: 'synthetic-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'Files.ReadWrite.AppFolder',
      })
    )
  );
});
afterEach(async () => {
  await disconnectOneDriveAuth();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('uses independent cryptographic state and S256 PKCE without any secret', async () => {
  const pkce = await createPkce();
  expect(pkce.verifier).toMatch(/^[\w-]{43}$/);
  expect(pkce.state).toMatch(/^[\w-]{43}$/);
  expect(pkce.state).not.toBe(pkce.verifier);
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pkce.verifier))
  );
  expect(pkce.challenge).toBe(
    btoa(String.fromCharCode(...hash))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  );
});

it.each([
  `${redirect}?code=x&state=wrong`,
  `${redirect}/wrong?code=x&state=state`,
  'https://attacker.test/onedrive?code=x&state=state',
  `${redirect}?code=x&state=state&state=state`,
  `${redirect}?code=x&code=y&state=state`,
  `${redirect}?code=x&state=state#token=bad`,
  `${redirect}?state=state`,
])('rejects an unbound or malformed callback %s', (callback) => {
  expect(() => readAuthorizationCode(callback, redirect, 'state')).toThrow(
    'ONEDRIVE_INVALID_CALLBACK'
  );
});

it('handles cancellation without accepting or persisting credentials', async () => {
  auth.mockRejectedValue(new Error('User closed window'));
  await expect(getOneDriveToken(true)).rejects.toThrow('ONEDRIVE_AUTH_CANCELLED');
  expect(set).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('stores credentials only after validation and restricts content-script access', async () => {
  await expect(getOneDriveToken(true)).resolves.toBe('synthetic-token');
  const request = new URL(auth.mock.calls[0][0].url);
  expect(request.searchParams.get('response_type')).toBe('code');
  expect(request.searchParams.get('code_challenge_method')).toBe('S256');
  expect(request.searchParams.get('scope')).toBe(
    'offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder'
  );
  const body = vi.mocked(fetch).mock.calls[0][1]!.body as URLSearchParams;
  expect(body.has('client_secret')).toBe(false);
  expect(body.get('code_verifier')).toHaveLength(43);
  expect(chrome.storage.local.setAccessLevel).toHaveBeenCalledWith({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
  expect(Object.keys(data)).toEqual(['tn_onedrive_auth']);
  await expect(getOneDriveToken()).resolves.toBe('synthetic-token');
  expect(auth).toHaveBeenCalledTimes(1);
});

it('does not launch background sign-in when credentials are absent', async () => {
  await expect(getOneDriveToken()).rejects.toThrow('ONEDRIVE_RECONNECT');
  expect(auth).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects missing site access without launching authorization', async () => {
  grant.mockResolvedValue(false);
  await expect(getOneDriveToken(true)).rejects.toThrow('ONEDRIVE_PERMISSION_REQUIRED');
  expect(grant).toHaveBeenCalledWith({ origins: ONEDRIVE_ORIGINS });
  expect(auth).not.toHaveBeenCalled();
});

it('rotates refresh tokens without reopening the login window', async () => {
  await getOneDriveToken(true);
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      access_token: 'new-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'Files.ReadWrite.AppFolder',
    })
  );
  await expect(getOneDriveToken(false, true)).resolves.toBe('new-token');
  expect(auth).toHaveBeenCalledTimes(1);
  expect(data.tn_onedrive_auth).toMatchObject({ refreshToken: 'new-refresh' });
});

it('does not persist tokens without the requested app-folder scope', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    Response.json({
      access_token: 'bad',
      refresh_token: 'bad',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'User.Read',
    })
  );
  await expect(getOneDriveToken(true)).rejects.toThrow('ONEDRIVE_INVALID_TOKEN');
  expect(set).not.toHaveBeenCalled();
});

it('does not reconnect after disconnect while a token exchange is in flight', async () => {
  let finish!: (value: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const attempt = getOneDriveToken(true);
  const assertion = expect(attempt).rejects.toThrow('ONEDRIVE_CANCELLED');
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  await disconnectOneDriveAuth();
  finish(
    Response.json({
      access_token: 'late',
      refresh_token: 'late',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'Files.ReadWrite.AppFolder',
    })
  );
  await assertion;
  expect(data.tn_onedrive_auth).toBeUndefined();
});
