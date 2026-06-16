const GOOGLE_OAUTH_PLACEHOLDER = 'REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com';

function runtimeErrorMessage(): string | null {
  return chrome.runtime.lastError?.message ?? null;
}

function normalizeToken(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object' && 'token' in result) {
    const token = (result as { token?: unknown }).token;
    return typeof token === 'string' ? token : null;
  }
  return null;
}

export function getOAuthSetupStatus(): { configured: boolean; clientId?: string; reason?: string } {
  const manifest = chrome.runtime.getManifest() as chrome.runtime.Manifest & {
    oauth2?: { client_id?: string; scopes?: string[] };
  };
  const clientId = manifest.oauth2?.client_id;
  const scopes = manifest.oauth2?.scopes ?? [];

  if (!clientId || clientId === GOOGLE_OAUTH_PLACEHOLDER || clientId.includes('REPLACE_WITH')) {
    return {
      configured: false,
      clientId,
      reason: 'Google OAuth client ID is not configured for this extension build.',
    };
  }

  if (!scopes.includes('https://www.googleapis.com/auth/drive.appdata')) {
    return {
      configured: false,
      clientId,
      reason: 'Missing Google Drive appDataFolder OAuth scope.',
    };
  }

  return { configured: true, clientId };
}

export async function getGoogleAuthToken(interactive: boolean): Promise<string> {
  const setup = getOAuthSetupStatus();
  if (!setup.configured) {
    throw new Error(setup.reason ?? 'Google OAuth is not configured.');
  }

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      const error = runtimeErrorMessage();
      if (error) {
        reject(new Error(error));
        return;
      }

      const token = normalizeToken(result);
      if (!token) {
        reject(new Error('Google returned no auth token.'));
        return;
      }

      resolve(token);
    });
  });
}

export async function isGoogleConnected(): Promise<boolean> {
  try {
    await getGoogleAuthToken(false);
    return true;
  } catch {
    return false;
  }
}

export async function refreshGoogleAuthToken(previousToken?: string): Promise<string> {
  if (previousToken) {
    await new Promise<void>((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: previousToken }, () => resolve());
    });
  }
  return getGoogleAuthToken(false);
}

export async function disconnectGoogle(): Promise<void> {
  try {
    const token = await getGoogleAuthToken(false);
    await new Promise<void>((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, () => resolve());
    });
  } catch {
    // Already disconnected or not configured.
  }
}
