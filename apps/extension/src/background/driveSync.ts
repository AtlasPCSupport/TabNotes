import {
  DEFAULT_ENTITLEMENTS,
  DEFAULT_STORAGE,
  ENTITLEMENTS_STORAGE_KEY,
  createDriveBackupEnvelope,
  hasFeature,
  mergeDriveBackupEnvelope,
  parseDriveBackupEnvelope,
  type EntitlementState,
  type ExportPrefs,
  type StorageData,
} from '@tabnotes/shared';
import {
  disconnectGoogle,
  getGoogleAuthToken,
  getOAuthSetupStatus,
  isGoogleConnected,
  refreshGoogleAuthToken,
} from './driveAuth';
import { DriveApiError, findBackupFile, loadBackupFile, saveBackupFile } from './driveClient';

export const DRIVE_SYNC_STORAGE_KEY = 'tn_drive_sync';
const DRIVE_AUTO_SYNC_ALARM = 'tn_drive_auto_sync';
const SYNC_DEBOUNCE_MS = 3_000;

type DriveSyncStatus = 'idle' | 'syncing' | 'ok' | 'error' | 'disconnected' | 'setup_required' | 'blocked';
type DriveSyncSource = 'auto' | 'manual' | 'connect';

export interface DriveSyncState {
  enabled: boolean;
  status: DriveSyncStatus;
  deviceId?: string;
  fileId?: string;
  remoteModifiedTime?: string;
  lastSyncAt?: string;
  lastRestoreAt?: string;
  lastError?: string;
}

const DEFAULT_DRIVE_STATE: DriveSyncState = {
  enabled: false,
  status: 'disconnected',
};

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function chromeGet(keys: string | string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      const error = chrome.runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve(result);
    });
  });
}

function chromeSet(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = chrome.runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

function chromeAlarmClear(name: string): Promise<void> {
  return new Promise((resolve) => chrome.alarms.clear(name, () => resolve()));
}

function normalizeStorageData(raw: unknown): StorageData {
  return {
    ...DEFAULT_STORAGE,
    ...((raw as Partial<StorageData> | undefined) ?? {}),
    notes_url: { ...DEFAULT_STORAGE.notes_url, ...((raw as Partial<StorageData> | undefined)?.notes_url ?? {}) },
    notes_domain: {
      ...DEFAULT_STORAGE.notes_domain,
      ...((raw as Partial<StorageData> | undefined)?.notes_domain ?? {}),
    },
    notes_workspace: {
      ...DEFAULT_STORAGE.notes_workspace,
      ...((raw as Partial<StorageData> | undefined)?.notes_workspace ?? {}),
    },
    notes_global: {
      ...DEFAULT_STORAGE.notes_global,
      ...((raw as Partial<StorageData> | undefined)?.notes_global ?? {}),
    },
    workspaces: { ...DEFAULT_STORAGE.workspaces, ...((raw as Partial<StorageData> | undefined)?.workspaces ?? {}) },
  };
}

async function getDriveState(): Promise<DriveSyncState> {
  const result = await chromeGet(DRIVE_SYNC_STORAGE_KEY);
  return {
    ...DEFAULT_DRIVE_STATE,
    ...((result[DRIVE_SYNC_STORAGE_KEY] as Partial<DriveSyncState> | undefined) ?? {}),
  };
}

async function setDriveState(patch: Partial<DriveSyncState>): Promise<DriveSyncState> {
  const current = await getDriveState();
  const next = Object.fromEntries(
    Object.entries({ ...current, ...patch }).filter(([, value]) => value !== undefined),
  ) as unknown as DriveSyncState;
  await chromeSet({ [DRIVE_SYNC_STORAGE_KEY]: next });
  return next;
}

async function ensureDeviceId(): Promise<string> {
  const current = await getDriveState();
  if (current.deviceId) return current.deviceId;
  const deviceId = createDeviceId();
  await setDriveState({ deviceId });
  return deviceId;
}

async function getEntitlements(): Promise<EntitlementState> {
  const result = await chromeGet(ENTITLEMENTS_STORAGE_KEY);
  return {
    ...DEFAULT_ENTITLEMENTS,
    ...((result[ENTITLEMENTS_STORAGE_KEY] as Partial<EntitlementState> | undefined) ?? {}),
  };
}

async function assertDriveFeatureAllowed(): Promise<void> {
  const entitlements = await getEntitlements();
  if (!hasFeature('drive_sync', entitlements)) {
    await setDriveState({ status: 'blocked', lastError: 'Google Drive Sync requires TabNotes Pro.' });
    throw new Error('Google Drive Sync requires TabNotes Pro.');
  }
}

async function assertOAuthConfigured(): Promise<void> {
  const setup = getOAuthSetupStatus();
  if (!setup.configured) {
    await setDriveState({ status: 'setup_required', lastError: setup.reason });
    throw new Error(setup.reason ?? 'Google OAuth is not configured.');
  }
}

function driveErrorMessage(error: unknown): string {
  if (error instanceof DriveApiError) return `${error.status}: ${error.reason ?? error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

async function saveCurrentBackupWithToken(token: string): Promise<DriveSyncState> {
  const envelope = await createCurrentBackupEnvelope();
  const latestState = await getDriveState();
  const file = await saveBackupFile(token, envelope, latestState.fileId);

  return setDriveState({
    enabled: true,
    status: 'ok',
    fileId: file.id,
    remoteModifiedTime: file.modifiedTime,
    lastSyncAt: new Date().toISOString(),
    lastError: undefined,
  });
}

async function failDriveSync(error: unknown, shouldThrow: boolean): Promise<DriveSyncState> {
  const message = driveErrorMessage(error);
  const state = await setDriveState({ status: 'error', lastError: message });
  if (shouldThrow) throw new Error(message);
  return state;
}

async function collectBackupPrefs(storage: StorageData): Promise<ExportPrefs> {
  const result = await chromeGet(['tn_digest', 'tn_streak', 'tn_backup_remind']);
  const prefs: ExportPrefs = {};
  if (result.tn_digest) prefs.digest = result.tn_digest as ExportPrefs['digest'];
  if (result.tn_streak) prefs.streak = result.tn_streak as ExportPrefs['streak'];
  if (result.tn_backup_remind) {
    prefs.backupRemindDays = (result.tn_backup_remind as { days?: number })?.days ?? 7;
  }
  if (storage.language) prefs.language = storage.language;
  return prefs;
}

async function createCurrentBackupEnvelope() {
  const result = await chromeGet('tabnotes_data');
  const storage = normalizeStorageData(result.tabnotes_data);
  const prefs = await collectBackupPrefs(storage);
  const deviceId = await ensureDeviceId();
  return createDriveBackupEnvelope(storage, deviceId, prefs);
}

async function applyBackupPrefs(prefs: ExportPrefs | undefined): Promise<void> {
  if (!prefs) return;
  const updates: Record<string, unknown> = {};
  if (prefs.digest != null) updates.tn_digest = prefs.digest;
  if (prefs.streak != null) updates.tn_streak = prefs.streak;
  if (prefs.backupRemindDays != null) updates.tn_backup_remind = { days: prefs.backupRemindDays };
  if (Object.keys(updates).length > 0) await chromeSet(updates);
}

export async function getDriveSyncStatus() {
  const [state, entitlements] = await Promise.all([getDriveState(), getEntitlements()]);
  const setup = getOAuthSetupStatus();
  const connected = setup.configured ? await isGoogleConnected() : false;

  return {
    ...state,
    connected,
    setupRequired: !setup.configured,
    setupReason: setup.reason,
    featureAllowed: hasFeature('drive_sync', entitlements),
    entitlementMode: entitlements.mode,
  };
}

export async function connectDriveSync() {
  await assertDriveFeatureAllowed();
  await assertOAuthConfigured();

  const token = await getGoogleAuthToken(true);
  const backupFile = await findBackupFile(token);

  await setDriveState({
    enabled: true,
    status: backupFile ? 'idle' : 'syncing',
    fileId: backupFile?.id,
    remoteModifiedTime: backupFile?.modifiedTime,
    lastError: undefined,
  });

  if (!backupFile) {
    await performDriveBackup('connect', token);
  }

  return {
    ...(await getDriveSyncStatus()),
    hasBackup: Boolean(backupFile),
  };
}

export async function performDriveBackup(source: DriveSyncSource = 'manual', existingToken?: string) {
  await assertDriveFeatureAllowed();
  await assertOAuthConfigured();

  const currentState = await getDriveState();
  if (!currentState.enabled && source === 'auto') return currentState;

  await setDriveState({ status: 'syncing', lastError: undefined });

  let token = existingToken;
  try {
    token = token ?? (await getGoogleAuthToken(false));
    return await saveCurrentBackupWithToken(token);
  } catch (error) {
    if (error instanceof DriveApiError && error.status === 401 && token) {
      try {
        const freshToken = await refreshGoogleAuthToken(token);
        return await saveCurrentBackupWithToken(freshToken);
      } catch (retryError) {
        return failDriveSync(retryError, source !== 'auto');
      }
    }

    return failDriveSync(error, source !== 'auto');
  }
}

export async function restoreDriveBackup() {
  await assertDriveFeatureAllowed();
  await assertOAuthConfigured();

  const state = await getDriveState();
  const token = await getGoogleAuthToken(false);
  const rawBackup = await loadBackupFile(token, state.fileId);
  const envelope = parseDriveBackupEnvelope(rawBackup);
  if (!envelope) throw new Error('Drive backup is missing or uses an unsupported format.');

  const result = await chromeGet('tabnotes_data');
  const current = normalizeStorageData(result.tabnotes_data);
  const merged = mergeDriveBackupEnvelope(envelope, current);
  await chromeSet({ tabnotes_data: merged.data });
  await applyBackupPrefs(envelope.data.prefs);
  await setDriveState({
    enabled: true,
    status: 'ok',
    lastRestoreAt: new Date().toISOString(),
    lastError: undefined,
  });

  return {
    ...(await getDriveSyncStatus()),
    restoredAt: envelope.syncedAt,
    summary: merged.summary,
  };
}

export async function disconnectDriveSync() {
  await disconnectGoogle();
  await chromeAlarmClear(DRIVE_AUTO_SYNC_ALARM);
  return setDriveState({
    enabled: false,
    status: 'disconnected',
    lastError: undefined,
  });
}

export async function scheduleDriveAutoSync(): Promise<void> {
  const state = await getDriveState();
  if (!state.enabled) return;
  await chromeAlarmClear(DRIVE_AUTO_SYNC_ALARM);
  chrome.alarms.create(DRIVE_AUTO_SYNC_ALARM, { when: Date.now() + SYNC_DEBOUNCE_MS });
}

export async function handleDriveAlarm(alarmName: string): Promise<boolean> {
  if (alarmName !== DRIVE_AUTO_SYNC_ALARM) return false;
  await performDriveBackup('auto');
  return true;
}

export function handleDriveMessage(
  msg: { type?: string },
  sendResponse: (response?: unknown) => void,
): boolean {
  const actions: Record<string, () => Promise<unknown>> = {
    DRIVE_GET_STATUS: getDriveSyncStatus,
    DRIVE_CONNECT: connectDriveSync,
    DRIVE_SYNC_NOW: () => performDriveBackup('manual'),
    DRIVE_RESTORE: restoreDriveBackup,
    DRIVE_DISCONNECT: disconnectDriveSync,
  };
  const action = msg.type ? actions[msg.type] : undefined;
  if (!action) return false;

  action()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: driveErrorMessage(error) }));
  return true;
}
