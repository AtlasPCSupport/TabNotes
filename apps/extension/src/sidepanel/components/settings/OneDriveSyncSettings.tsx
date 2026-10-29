import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { ONEDRIVE_ORIGINS, ONEDRIVE_SYNC_KEY, type OneDriveStatus } from '../../../shared/oneDrive';

function send(type: string): Promise<OneDriveStatus> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type },
      (response: { ok?: boolean; result?: OneDriveStatus; error?: string } | undefined) => {
        if (chrome.runtime.lastError || !response?.ok || !response.result)
          reject(new Error(response?.error ?? 'ONEDRIVE_SYNC_FAILED'));
        else resolve(response.result);
      }
    );
  });
}

export function OneDriveSyncSettings() {
  const { t } = useTranslation();
  const [state, setState] = useState<OneDriveStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    void send('ONEDRIVE_STATUS').then(setState, () => setError('ONEDRIVE_SYNC_FAILED'));
  }, []);
  useEffect(() => {
    refresh();
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && (changes[ONEDRIVE_SYNC_KEY] || changes.tn_drive_sync)) refresh();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }, [refresh]);

  const run = async (type: string) => {
    setBusy(true);
    setError(null);
    try {
      setState(await send(type));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ONEDRIVE_SYNC_FAILED');
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const connect = () => {
    // Invoke permissions.request directly inside the actual click gesture.
    setBusy(true);
    setError(null);
    void chrome.permissions.request({ origins: ONEDRIVE_ORIGINS }).then(
      (granted) => {
        if (granted) return run('ONEDRIVE_CONNECT');
        setError('ONEDRIVE_PERMISSION_REQUIRED');
        setBusy(false);
      },
      () => {
        setError('ONEDRIVE_PERMISSION_REQUIRED');
        setBusy(false);
      }
    );
  };
  const message = error ?? state?.lastError;
  const explainError = (code: string) => {
    if (code === 'ONEDRIVE_DISCONNECT_GOOGLE_FIRST') return t('oneDrive.googleFirst');
    if (code === 'ONEDRIVE_RECONNECT') return t('oneDrive.reconnectInfo');
    if (code === 'ONEDRIVE_AUTH_CANCELLED') return t('oneDrive.cancelled');
    if (code === 'ONEDRIVE_PERMISSION_REQUIRED') return t('oneDrive.permissionDenied');
    return t('oneDrive.failed');
  };
  const active = state?.enabled;
  const reconnect = state?.status === 'reconnect';
  return (
    <section className="sp-drive-sync" data-testid="onedrive-settings" aria-label="OneDrive">
      <div className="sp-drive-sync-header">
        <div>
          <div className="sp-drive-sync-title">{t('oneDrive.title')}</div>
          <div className="sp-drive-sync-desc">{t('oneDrive.description')}</div>
        </div>
        <span
          className={`sp-drive-sync-badge ${state?.status === 'ok' ? 'ok' : state?.status === 'error' || reconnect ? 'warn' : 'idle'}`}
        >
          {busy || state?.status === 'syncing'
            ? t('oneDrive.working')
            : reconnect
              ? t('oneDrive.reconnect')
              : state?.status === 'error'
                ? t('oneDrive.attention')
                : active
                  ? t('oneDrive.connected')
                  : t('oneDrive.disconnected')}
        </span>
      </div>
      <div className="sp-drive-sync-meta">
        {t('oneDrive.lastSync', {
          time: state?.lastSyncedAt
            ? new Date(state.lastSyncedAt).toLocaleString()
            : t('settingsSections.driveNever'),
        })}
      </div>
      <p className="sp-drive-sync-warning">{t('oneDrive.encryption')}</p>
      {state && !state.supportedIdentity && (
        <p className="sp-drive-sync-warning">{t('oneDrive.identity')}</p>
      )}
      {state?.googleEnabled && !active && (
        <p className="sp-drive-sync-warning">{t('oneDrive.googleFirst')}</p>
      )}
      {message && (
        <p role="alert" className="sp-drive-sync-warning">
          {explainError(message)}
        </p>
      )}
      <div className="sp-drive-sync-actions">
        {(!active || reconnect) && (
          <button
            className="sp-drive-btn primary"
            disabled={busy || !state?.supportedIdentity || Boolean(state?.googleEnabled)}
            onClick={connect}
          >
            {reconnect ? t('oneDrive.reconnect') : t('oneDrive.connect')}
          </button>
        )}
        {active && (
          <>
            <button
              className="sp-drive-btn primary"
              disabled={busy || reconnect}
              onClick={() => void run('ONEDRIVE_SYNC')}
            >
              {t('oneDrive.syncNow')}
            </button>
            <button
              className="sp-drive-btn ghost"
              disabled={busy}
              onClick={() => void run('ONEDRIVE_DISCONNECT')}
            >
              {t('oneDrive.disconnect')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
