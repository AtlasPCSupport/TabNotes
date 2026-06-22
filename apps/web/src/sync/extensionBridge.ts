import { cleanRuntimeString, getRuntimeConfig } from './runtimeConfig';

const DEFAULT_EXTENSION_ID = 'pniapenkdphjolncppcichbahomfiffj';
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const MESSAGE_TIMEOUT_MS = 2_000;
const WEB_SYNC_UPDATED_MESSAGE = 'TABNOTES_WEB_SYNC_UPDATED';
const WEB_APP_SOURCE = 'tabnotes-web-app';

interface ChromeRuntimeBridge {
  lastError?: { message?: string };
  sendMessage(
    extensionId: string,
    message: Record<string, unknown>,
    responseCallback?: (response?: unknown) => void
  ): void;
}

declare global {
  interface Window {
    chrome?: {
      runtime?: ChromeRuntimeBridge;
    };
  }
}

interface ExtensionBridgeResult {
  attempted: boolean;
  delivered: boolean;
  error?: string;
}

function createSyncUpdatedPayload(): Record<string, unknown> {
  return {
    source: WEB_APP_SOURCE,
    type: WEB_SYNC_UPDATED_MESSAGE,
    version: 1,
    sentAt: Date.now(),
  };
}

function postContentScriptSyncMessage(): boolean {
  try {
    window.postMessage(createSyncUpdatedPayload(), window.location.origin);
    return true;
  } catch {
    return false;
  }
}

function cleanExtensionId(value: unknown): string | null {
  const extensionId = cleanRuntimeString(value);
  return extensionId && EXTENSION_ID_PATTERN.test(extensionId) ? extensionId : null;
}

async function getConfiguredExtensionId(): Promise<string | null> {
  const buildTimeId = cleanExtensionId(import.meta.env.VITE_TABNOTES_EXTENSION_ID);
  if (buildTimeId) return buildTimeId;

  const config = await getRuntimeConfig();
  return (
    cleanExtensionId(config.extensionId) ??
    cleanExtensionId(config.VITE_TABNOTES_EXTENSION_ID) ??
    DEFAULT_EXTENSION_ID
  );
}

export async function notifyExtensionDriveUpdated(): Promise<ExtensionBridgeResult> {
  const postedToContentScript = postContentScriptSyncMessage();
  const extensionId = await getConfiguredExtensionId();
  const runtime = window.chrome?.runtime;

  if (!extensionId || !runtime?.sendMessage) {
    return { attempted: postedToContentScript, delivered: false };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: ExtensionBridgeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    const timeout = window.setTimeout(() => {
      finish({
        attempted: true,
        delivered: false,
        error: 'Extension bridge timed out.',
      });
    }, MESSAGE_TIMEOUT_MS);

    try {
      runtime.sendMessage(extensionId, createSyncUpdatedPayload(), (response) => {
        const error = runtime.lastError?.message;
        if (error) {
          finish({ attempted: true, delivered: false, error });
          return;
        }

        const result = response as { ok?: boolean; error?: string } | undefined;
        finish({
          attempted: true,
          delivered: result?.ok !== false,
          error: result?.error,
        });
      });
    } catch (error) {
      finish({
        attempted: true,
        delivered: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
