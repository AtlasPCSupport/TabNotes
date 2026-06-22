const TRUSTED_WEB_ORIGIN = 'https://tabnotes.atlaspcsupport.com';
const WEB_SYNC_UPDATED_MESSAGE = 'TABNOTES_WEB_SYNC_UPDATED';
const WEB_APP_SOURCE = 'tabnotes-web-app';
const EXTENSION_BRIDGE_SOURCE = 'tabnotes-extension-bridge';

interface WebSyncUpdatedMessage {
  source?: unknown;
  type?: unknown;
  version?: unknown;
  sentAt?: unknown;
}

interface RuntimeResponse {
  ok?: boolean;
  error?: string;
}

function isWebSyncUpdatedMessage(value: unknown): value is WebSyncUpdatedMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as WebSyncUpdatedMessage;
  return message.source === WEB_APP_SOURCE && message.type === WEB_SYNC_UPDATED_MESSAGE;
}

function postAck(ok: boolean, error?: string): void {
  window.postMessage(
    {
      source: EXTENSION_BRIDGE_SOURCE,
      type: 'TABNOTES_EXTENSION_SYNC_ACK',
      ok,
      error,
      sentAt: Date.now(),
    },
    TRUSTED_WEB_ORIGIN
  );
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || event.origin !== TRUSTED_WEB_ORIGIN) return;
  if (!isWebSyncUpdatedMessage(event.data)) return;

  chrome.runtime.sendMessage(
    {
      type: 'DRIVE_SYNC_IF_ENABLED',
      source: 'web-content-script',
      requestedAt: Date.now(),
    },
    (response: RuntimeResponse | undefined) => {
      const error = chrome.runtime.lastError?.message ?? response?.error;
      postAck(Boolean(response?.ok) && !error, error);
    }
  );
});
