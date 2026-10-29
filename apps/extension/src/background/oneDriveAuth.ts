import { ONEDRIVE_CLIENT_ID, ONEDRIVE_ORIGINS } from '../shared/oneDrive';

const AUTH_KEY = 'tn_onedrive_auth';
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SCOPE = 'https://graph.microsoft.com/Files.ReadWrite.AppFolder';
const SCOPES = `offline_access ${SCOPE}`;
let generation = 0;
let pending: Promise<string> | null = null;

interface Credentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class OneDriveAuthError extends Error {
  constructor(message = 'ONEDRIVE_RECONNECT') {
    super(message);
    this.name = 'OneDriveAuthError';
  }
}

export function oneDriveIdentitySupported(): boolean {
  // These are the two exact redirect origins registered by the publisher.
  return ['pniapenkdphjolncppcichbahomfiffj', 'noabjgjemigfaimfahmbnlccibmkmaam'].includes(
    chrome.runtime.id
  );
}

export function oneDrivePermissionsGranted(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ONEDRIVE_ORIGINS });
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createPkce(): Promise<{
  verifier: string;
  challenge: string;
  state: string;
}> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  return {
    verifier,
    challenge: base64url(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    ),
    state: base64url(crypto.getRandomValues(new Uint8Array(32))),
  };
}

export function readAuthorizationCode(callback: string, redirect: string, state: string): string {
  const actual = new URL(callback);
  const expected = new URL(redirect);
  if (
    actual.origin !== expected.origin ||
    actual.pathname !== expected.pathname ||
    actual.hash ||
    actual.searchParams.getAll('state').length !== 1 ||
    actual.searchParams.get('state') !== state
  ) {
    throw new OneDriveAuthError('ONEDRIVE_INVALID_CALLBACK');
  }
  if (actual.searchParams.has('error')) throw new OneDriveAuthError('ONEDRIVE_AUTH_CANCELLED');
  const code = actual.searchParams.get('code');
  if (!code || actual.searchParams.getAll('code').length !== 1)
    throw new OneDriveAuthError('ONEDRIVE_INVALID_CALLBACK');
  return code;
}

async function credentials(): Promise<Credentials | undefined> {
  const value = (await chrome.storage.local.get(AUTH_KEY))[AUTH_KEY] as Credentials | undefined;
  return value &&
    typeof value.accessToken === 'string' &&
    typeof value.refreshToken === 'string' &&
    Number.isFinite(value.expiresAt)
    ? value
    : undefined;
}

async function exchange(
  params: URLSearchParams,
  current: number,
  oldRefreshToken?: string
): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) {
    // Do not expose the provider body: it may contain credentials or identifiers.
    if (response.status === 400 || response.status === 401) throw new OneDriveAuthError();
    throw new Error(`ONEDRIVE_TOKEN_HTTP_${response.status}`);
  }
  const value = (await response.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    token_type?: unknown;
    scope?: unknown;
  };
  const granted = typeof value.scope === 'string' ? value.scope.split(' ') : [];
  if (
    typeof value.access_token !== 'string' ||
    !value.access_token ||
    value.token_type?.toString().toLowerCase() !== 'bearer' ||
    typeof value.expires_in !== 'number' ||
    !Number.isFinite(value.expires_in) ||
    value.expires_in <= 0 ||
    value.expires_in > 86400 ||
    !granted.some((scope) => scope === SCOPE || scope === 'Files.ReadWrite.AppFolder')
  ) {
    throw new OneDriveAuthError('ONEDRIVE_INVALID_TOKEN');
  }
  const refreshToken =
    typeof value.refresh_token === 'string' && value.refresh_token
      ? value.refresh_token
      : oldRefreshToken;
  if (!refreshToken) throw new OneDriveAuthError('ONEDRIVE_NO_OFFLINE_ACCESS');
  if (current !== generation) throw new OneDriveAuthError('ONEDRIVE_CANCELLED');
  // Content scripts do not access local storage in TabNotes. Restrict credentials
  // (and notes) to trusted extension contexts before persisting any token.
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  if (current !== generation) throw new OneDriveAuthError('ONEDRIVE_CANCELLED');
  await chrome.storage.local.set({
    [AUTH_KEY]: {
      accessToken: value.access_token,
      refreshToken,
      expiresAt: Date.now() + value.expires_in * 1000,
    } satisfies Credentials,
  });
  if (current !== generation) {
    await chrome.storage.local.remove(AUTH_KEY);
    throw new OneDriveAuthError('ONEDRIVE_CANCELLED');
  }
  return value.access_token;
}

async function acquire(interactive: boolean, forceRefresh: boolean): Promise<string> {
  const current = generation;
  if (!oneDriveIdentitySupported()) throw new OneDriveAuthError('ONEDRIVE_IDENTITY_NOT_CONFIGURED');
  if (!(await oneDrivePermissionsGranted()))
    throw new OneDriveAuthError('ONEDRIVE_PERMISSION_REQUIRED');
  if (interactive) {
    const pkce = await createPkce();
    const redirect = chrome.identity.getRedirectURL('onedrive');
    const params = new URLSearchParams({
      client_id: ONEDRIVE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirect,
      response_mode: 'query',
      scope: SCOPES,
      state: pkce.state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    let callback: string | undefined;
    try {
      callback = await chrome.identity.launchWebAuthFlow({
        url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`,
        interactive: true,
      });
    } catch {
      throw new OneDriveAuthError('ONEDRIVE_AUTH_CANCELLED');
    }
    if (!callback || current !== generation) throw new OneDriveAuthError('ONEDRIVE_AUTH_CANCELLED');
    return exchange(
      new URLSearchParams({
        client_id: ONEDRIVE_CLIENT_ID,
        grant_type: 'authorization_code',
        code: readAuthorizationCode(callback, redirect, pkce.state),
        redirect_uri: redirect,
        code_verifier: pkce.verifier,
        scope: SCOPES,
      }),
      current
    );
  }
  const stored = await credentials();
  if (!stored) throw new OneDriveAuthError();
  if (!forceRefresh && stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  return exchange(
    new URLSearchParams({
      client_id: ONEDRIVE_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
      scope: SCOPES,
    }),
    current,
    stored.refreshToken
  );
}

export function getOneDriveToken(interactive = false, forceRefresh = false): Promise<string> {
  if (pending) return pending;
  const operation = acquire(interactive, forceRefresh);
  pending = operation;
  void operation
    .finally(() => {
      if (pending === operation) pending = null;
    })
    .catch(() => undefined);
  return operation;
}

export async function oneDriveHasCredentials(): Promise<boolean> {
  return Boolean(await credentials());
}

export async function disconnectOneDriveAuth(): Promise<void> {
  generation += 1;
  await chrome.storage.local.remove(AUTH_KEY);
}
