import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

type DriveStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'disconnected' | 'setup_required' | 'blocked';

interface DriveSyncState {
  enabled?: boolean;
  connected?: boolean;
  setupRequired?: boolean;
  setupReason?: string;
  featureAllowed?: boolean;
  entitlementMode?: 'launch_free' | 'license';
  status?: DriveStatus;
  lastSyncAt?: string;
  lastRestoreAt?: string;
  lastError?: string;
  remoteModifiedTime?: string;
  hasBackup?: boolean;
  restoredAt?: string;
  summary?: {
    notesAdded: number;
    notesUpdated: number;
    notesKeptLocal: number;
    workspacesAdded: number;
    workspacesUpdated: number;
    workspacesKeptLocal: number;
  };
}

interface DriveMessageResponse {
  ok: boolean;
  result?: DriveSyncState;
  error?: string;
}

function sendDriveMessage(type: string): Promise<DriveSyncState> {
  return new Promise((resolve, reject) => {
    if (!cr?.runtime?.sendMessage) {
      reject(new Error('Chrome runtime is unavailable.'));
      return;
    }

    cr.runtime.sendMessage({ type }, (response: DriveMessageResponse | undefined) => {
      const error = cr.runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error ?? 'Drive action failed.'));
        return;
      }
      resolve(response.result ?? {});
    });
  });
}

function restoreReminderAlarms(): Promise<void> {
  return new Promise((resolve) => {
    if (!cr?.runtime?.sendMessage) {
      resolve();
      return;
    }

    cr.runtime.sendMessage({ type: 'RESTORE_REMINDER_ALARMS' }, () => {
      resolve();
    });
  });
}

function formatTimestamp(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return fallback;
  }
}

function statusTone(status: DriveStatus | undefined): 'ok' | 'warn' | 'idle' {
  if (status === 'ok') return 'ok';
  if (status === 'error' || status === 'setup_required' || status === 'blocked') return 'warn';
  return 'idle';
}

export function DriveSyncSettings() {
  const { t } = useTranslation();
  const [state, setState] = useState<DriveSyncState>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await sendDriveMessage('DRIVE_GET_STATUS');
      setState(next);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const runAction = async (type: string, successMessage: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await sendDriveMessage(type);
      setState(next);
      setFeedback(successMessage);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({ ...prev, status: 'error', lastError: message }));
      setFeedback(message);
      return null;
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleConnect = async () => {
    const next = await runAction('DRIVE_CONNECT', t('settingsSections.driveConnected'));
    if (next?.hasBackup) {
      const shouldRestore = window.confirm(t('settingsSections.driveRestoreConfirm'));
      if (shouldRestore) {
        const restored = await runAction('DRIVE_RESTORE', t('settingsSections.driveRestoreSuccess'));
        if (restored) await restoreReminderAlarms();
      }
    }
  };

  const handleRestore = async () => {
    const shouldRestore = window.confirm(t('settingsSections.driveRestoreConfirm'));
    if (shouldRestore) {
      const restored = await runAction('DRIVE_RESTORE', t('settingsSections.driveRestoreSuccess'));
      if (restored) await restoreReminderAlarms();
    }
  };

  const statusLabel = state.setupRequired
    ? t('settingsSections.driveSetupRequired')
    : state.status === 'syncing'
      ? t('settingsSections.driveSyncing')
      : state.connected || state.enabled
        ? t('settingsSections.driveConnectedStatus')
        : t('settingsSections.driveNotConnected');
  const lastSync = formatTimestamp(state.lastSyncAt, t('settingsSections.driveNever'));
  const canUse = state.featureAllowed !== false && !state.setupRequired;
  const isConnected = Boolean(state.connected || state.enabled);

  return (
    <div className="sp-drive-sync">
      <div className="sp-drive-sync-header">
        <div>
          <div className="sp-drive-sync-title">{t('settingsSections.driveSync')}</div>
          <div className="sp-drive-sync-desc">{t('settingsSections.driveSyncDesc')}</div>
        </div>
        <span className={`sp-drive-sync-badge ${statusTone(state.status)}`}>{statusLabel}</span>
      </div>

      <div className="sp-drive-sync-meta">
        <span>{t('settingsSections.driveLastSync', { time: lastSync })}</span>
        {state.entitlementMode === 'launch_free' && (
          <span>{t('settingsSections.driveFreeLaunch')}</span>
        )}
      </div>

      {state.setupRequired && (
        <div className="sp-drive-sync-warning">
          {state.setupReason ?? t('settingsSections.driveSetupMissing')}
        </div>
      )}

      {state.lastError && !state.setupRequired && (
        <div className="sp-drive-sync-warning">{state.lastError}</div>
      )}

      <div className="sp-drive-sync-actions">
        {!isConnected ? (
          <button className="sp-drive-btn primary" disabled={busy || !canUse} onClick={handleConnect}>
            {busy ? t('settingsSections.driveWorking') : t('settingsSections.driveConnect')}
          </button>
        ) : (
          <>
            <button
              className="sp-drive-btn primary"
              disabled={busy || !canUse}
              onClick={() => runAction('DRIVE_SYNC_NOW', t('settingsSections.driveSyncSuccess'))}
            >
              {t('settingsSections.driveSyncNow')}
            </button>
            <button className="sp-drive-btn" disabled={busy || !canUse} onClick={handleRestore}>
              {t('settingsSections.driveRestore')}
            </button>
            <button
              className="sp-drive-btn ghost"
              disabled={busy}
              onClick={() => runAction('DRIVE_DISCONNECT', t('settingsSections.driveDisconnected'))}
            >
              {t('settingsSections.driveDisconnect')}
            </button>
          </>
        )}
      </div>

      {feedback && <div className="sp-drive-sync-feedback">{feedback}</div>}
    </div>
  );
}

export default DriveSyncSettings;
