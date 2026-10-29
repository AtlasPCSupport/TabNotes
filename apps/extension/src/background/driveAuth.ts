const GOOGLE_OAUTH_CLIENT_ID_PATTERN = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;
const PUBLISHED_EXTENSION_ID = 'pniapenkdphjolncppcichbahomfiffj';
const UNPACKED_BUILD_REASON =
  'Google Drive sync is available in the Chrome Web Store build. This unpacked build has a different extension ID.';

export type OAuthSetupReasonCode = 'edge_auth_required' | 'identity_unavailable';

function isMicrosoftEdge(): boolean {
  if (typeof navigator === 'undefined') return false;
  const brands = (
    navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand: string }> };
    }
  ).userAgentData?.brands;
  return (
    brands?.some(({ brand }) => brand === 'Microsoft Edge') === true ||
    /\bEdg(?:A|iOS)?\//.test(navigator.userAgent)
  );
}

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

export function getOAuthSetupStatus(): {
  configured: boolean;
  clientId?: string;
  reason?: string;
  reasonCode?: OAuthSetupReasonCode;
} {
  const manifest = chrome.runtime.getManifest() as chrome.runtime.Manifest & {
    oauth2?: { client_id?: string; scopes?: string[] };
  };
  const clientId = manifest.oauth2?.client_id;
  const scopes = manifest.oauth2?.scopes ?? [];

  // Edge exposes getAuthToken in some versions but rejects every invocation.
  // Keep this guard until a separately registered web-auth flow is validated.
  if (isMicrosoftEdge()) {
    return {
      configured: false,
      clientId,
      reasonCode: 'edge_auth_required',
      reason:
        'Google Drive sign-in in Microsoft Edge requires a separate authentication integration. Local notes and manual backups remain available. Google Drive in Chrome is unaffected.',
    };
  }

  if (typeof chrome.identity?.getAuthToken !== 'function') {
    return {
      configured: false,
      clientId,
      reasonCode: 'identity_unavailable',
      reason:
        'This browser cannot use the current Google Drive sign-in method. Local notes and manual backups remain available.',
    };
  }

  if (chrome.runtime.id && chrome.runtime.id !== PUBLISHED_EXTENSION_ID) {
    return {
      configured: false,
      clientId,
      reason: UNPACKED_BUILD_REASON,
    };
  }

  if (!clientId || !GOOGLE_OAUTH_CLIENT_ID_PATTERN.test(clientId)) {
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
  const setup = getOAuthSetupStatus();
  if (!setup.configured) throw new Error(setup.reason ?? 'Google OAuth is not configured.');
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
