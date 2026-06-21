const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
  callback?: (response: TokenResponse) => void;
}

interface GoogleIdentityApi {
  accounts?: {
    oauth2?: {
      initTokenClient(options: {
        client_id: string;
        scope: string;
        prompt?: string;
        callback: (response: TokenResponse) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function getConfiguredClientId(): string | null {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const trimmed = value?.trim();
  return trimmed || null;
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Identity failed to load.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity failed to load.'));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export function hasGoogleClientId(): boolean {
  return Boolean(getConfiguredClientId());
}

export async function requestGoogleDriveToken(interactive: boolean): Promise<string> {
  const clientId = getConfiguredClientId();
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID for the TabNotes web app.');
  }

  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity is unavailable.');

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_APPDATA_SCOPE,
      prompt: interactive ? 'consent' : '',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error('Google returned no access token.'));
          return;
        }
        resolve(response.access_token);
      },
    });

    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

export function revokeGoogleDriveToken(token: string): Promise<void> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) return Promise.resolve();
  return new Promise((resolve) => oauth2.revoke(token, resolve));
}

