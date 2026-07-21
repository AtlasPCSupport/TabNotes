import {
  DEFAULT_ENTITLEMENTS,
  DEFAULT_STORAGE,
  ENTITLEMENTS_STORAGE_KEY,
  TOMBSTONE_RETENTION_MS,
  createDeleteTombstone,
  createDriveSyncEnvelope,
  hasFeature,
  mergeDriveSyncEnvelope,
  parseAnyDriveSyncEnvelope,
  type EntitlementState,
  type ExportPrefs,
  type Note,
  type StorageData,
  type SyncTombstone,
  type Workspace,
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
export const DRIVE_REMOTE_APPLY_STORAGE_KEY = 'tn_drive_remote_apply';
const DRIVE_AUTO_SYNC_ALARM = 'tn_drive_auto_sync';
const DRIVE_PERIODIC_SYNC_ALARM = 'tn_drive_periodic_sync';
const SYNC_DEBOUNCE_MS = 3_000;
const PERIODIC_SYNC_MINUTES = 5;
const TRANSIENT_RETRY_DELAYS_MS = [250, 1_000] as const;
export const MAX_RETRY_DELAY_MS = 30_000;

type DriveBackupSkipReason = 'cancelled' | 'disabled' | 'up-to-date';

type DriveBackupOutcome =
  | { state: DriveSyncState; error?: undefined; skipped?: DriveBackupSkipReason }
  | { state: DriveSyncState; error: unknown; skipped?: DriveBackupSkipReason };

interface DriveBackupInFlight {
  generation: number;
  promise: Promise<DriveBackupOutcome>;
}

class DriveBackupCancelledError extends Error {
  constructor() {
    super('Drive backup was cancelled because Drive Sync was disconnected.');
  }
}

let driveBackupInFlight: DriveBackupInFlight | null = null;
let driveOperationQueue: Promise<void> = Promise.resolve();
let driveSyncGeneration = 0;

function enqueueDriveOperation<T>(operation: () => Promise<T>): Promise<T> {
  const queued = driveOperationQueue.then(operation, operation);
  driveOperationQueue = queued.then(
    () => undefined,
    () => undefined
  );
  return queued;
}

type DriveSyncStatus =
  | 'idle'
  | 'syncing'
  | 'ok'
  | 'error'
  | 'disconnected'
  | 'setup_required'
  | 'blocked';
type DriveSyncSource = 'auto' | 'external' | 'manual' | 'connect';

export interface DriveSyncState {
  enabled: boolean;
  status: DriveSyncStatus;
  deviceId?: string;
  fileId?: string;
  remoteModifiedTime?: string;
  lastSyncAt?: string;
  lastSyncedAt?: number;
  lastRestoreAt?: string;
  lastError?: string;
  tombstones?: SyncTombstone[];
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
    notes_url: {
      ...DEFAULT_STORAGE.notes_url,
      ...((raw as Partial<StorageData> | undefined)?.notes_url ?? {}),
    },
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
    workspaces: {
      ...DEFAULT_STORAGE.workspaces,
      ...((raw as Partial<StorageData> | undefined)?.workspaces ?? {}),
    },
  };
}

function getAllNotes(data: StorageData): Note[] {
  return [
    ...Object.values(data.notes_url ?? {}),
    ...Object.values(data.notes_domain ?? {}),
    ...Object.values(data.notes_workspace ?? {}),
    ...Object.values(data.notes_global ?? {}),
  ];
}

function getAllWorkspaces(data: StorageData): Workspace[] {
  return Object.values(data.workspaces ?? {});
}

function hasLocalChangesSinceLastSync(data: StorageData, state: DriveSyncState): boolean {
  const lastSyncedAt = state.lastSyncedAt ?? 0;
  if (!lastSyncedAt) return true;

  return (
    getAllNotes(data).some((note) => (note.updatedAt ?? note.createdAt ?? 0) > lastSyncedAt) ||
    getAllWorkspaces(data).some(
      (workspace) => (workspace.updatedAt ?? workspace.createdAt ?? 0) > lastSyncedAt
    ) ||
    (state.tombstones ?? []).some((tombstone) => tombstone.deletedAt > lastSyncedAt)
  );
}

function pruneTombstones(tombstones: SyncTombstone[], now = Date.now()): SyncTombstone[] {
  const cutoff = now - TOMBSTONE_RETENTION_MS;
  const byEntity = new Map<string, SyncTombstone>();

  for (const tombstone of tombstones) {
    if (tombstone.deletedAt < cutoff) continue;
    const key = `${tombstone.entityType}:${tombstone.id}`;
    const current = byEntity.get(key);
    if (!current || tombstone.deletedAt > current.deletedAt) byEntity.set(key, tombstone);
  }

  return [...byEntity.values()].sort((a, b) => b.deletedAt - a.deletedAt);
}

function getRemovedWorkspaces(oldData: StorageData, newData: StorageData): Workspace[] {
  return Object.values(oldData.workspaces ?? {}).filter(
    (workspace) => !newData.workspaces?.[workspace.id]
  );
}

function getRemovedNotes(
  oldData: StorageData,
  newData: StorageData,
  removedWorkspaceIds: Set<string>
): Note[] {
  const currentNoteIds = new Set(getAllNotes(newData).map((note) => note.id));
  return getAllNotes(oldData).filter((note) => {
    if (currentNoteIds.has(note.id)) return false;
    if (note.workspaceId && removedWorkspaceIds.has(note.workspaceId)) return false;
    return true;
  });
}

async function getDriveState(): Promise<DriveSyncState> {
  const result = await chromeGet(DRIVE_SYNC_STORAGE_KEY);
  return {
    ...DEFAULT_DRIVE_STATE,
    ...((result[DRIVE_SYNC_STORAGE_KEY] as Partial<DriveSyncState> | undefined) ?? {}),
    tombstones: pruneTombstones(
      (result[DRIVE_SYNC_STORAGE_KEY] as Partial<DriveSyncState> | undefined)?.tombstones ?? []
    ),
  };
}

async function setDriveState(patch: Partial<DriveSyncState>): Promise<DriveSyncState> {
  const current = await getDriveState();
  const next = Object.fromEntries(
    Object.entries({
      ...current,
      ...patch,
      tombstones: pruneTombstones(patch.tombstones ?? current.tombstones ?? []),
    }).filter(([, value]) => value !== undefined)
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
    await setDriveState({
      status: 'blocked',
      lastError: 'Google Drive Sync requires TabNotes Pro.',
    });
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

export function driveErrorMessage(error: unknown): string {
  if (error instanceof DriveApiError) return `${error.status}: ${error.reason ?? error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isTransientDriveError(error: unknown): error is DriveApiError {
  return (
    error instanceof DriveApiError &&
    (error.status === 408 ||
      error.status === 429 ||
      error.status >= 500 ||
      (error.status === 403 &&
        (error.reason === 'rateLimitExceeded' || error.reason === 'userRateLimitExceeded')))
  );
}

export function retryDelayFor(error: DriveApiError, attempt: number): number {
  if (error.retryAfterMs !== undefined) return Math.min(error.retryAfterMs, MAX_RETRY_DELAY_MS);
  const baseDelay = TRANSIENT_RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_DELAY_MS;
  const jitter = Math.round(baseDelay * 0.2 * Math.random());
  return Math.min(baseDelay + jitter, MAX_RETRY_DELAY_MS);
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/** Retries only idempotent Drive reads after transient failures. */
export async function retryTransientDriveRead<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDriveError(error) || attempt === TRANSIENT_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await waitForRetry(retryDelayFor(error, attempt));
    }
  }
  throw lastError;
}

async function getBackupFileAfterStaleIdRecovery(
  token: string,
  fileId?: string
): Promise<{ payload: unknown | null; resolvedFileId?: string }> {
  const loadFile = async (resolvedFileId: string) => ({
    payload: await retryTransientDriveRead(() => loadBackupFile(token, resolvedFileId)),
    resolvedFileId,
  });
  const findAndLoadCurrentFile = async () => {
    const fallbackFile = await retryTransientDriveRead(() => findBackupFile(token));
    return fallbackFile ? loadFile(fallbackFile.id) : { payload: null };
  };

  if (!fileId) return findAndLoadCurrentFile();

  try {
    return await loadFile(fileId);
  } catch (error) {
    if (!(error instanceof DriveApiError) || error.status !== 404) throw error;
    return findAndLoadCurrentFile();
  }
}

function assertDriveBackupCurrent(generation: number): void {
  if (generation !== driveSyncGeneration) throw new DriveBackupCancelledError();
}

async function saveCurrentBackupWithToken(
  token: string,
  generation: number
): Promise<DriveSyncState> {
  assertDriveBackupCurrent(generation);
  const latestState = await getDriveState();
  const { token: activeToken, remoteBackup } = await withFreshGoogleToken(
    token,
    async (candidateToken) => ({
      token: candidateToken,
      remoteBackup: await getBackupFileAfterStaleIdRecovery(candidateToken, latestState.fileId),
    })
  );
  assertDriveBackupCurrent(generation);
  const remoteEnvelope = remoteBackup.payload
    ? parseAnyDriveSyncEnvelope(remoteBackup.payload)
    : null;
  if (remoteBackup.payload && !remoteEnvelope) {
    throw new Error('Drive backup is missing or uses an unsupported format.');
  }
  const deviceId = await ensureDeviceId();
  let local = await getCurrentStorage();
  let tombstones = latestState.tombstones ?? [];
  const now = Date.now();

  if (remoteEnvelope) {
    const merged = mergeDriveSyncEnvelope(remoteEnvelope, local, {
      sourceDeviceId: deviceId,
      localTombstones: tombstones,
      lastSyncedAt: latestState.lastSyncedAt,
      now,
    });
    local = merged.data;
    tombstones = merged.tombstones;
    await chromeSet({
      tabnotes_data: local,
      [DRIVE_REMOTE_APPLY_STORAGE_KEY]: { at: now, source: 'drive-sync' },
    });
    await applyBackupPrefs(remoteEnvelope.data.prefs);
  }

  const prefs = await collectBackupPrefs(local);
  const envelope = createDriveSyncEnvelope(local, {
    sourceDeviceId: deviceId,
    previous: remoteEnvelope,
    tombstones,
    prefs,
    now: now + 1,
  });
  // A timed-out or throttled write has an unknown remote outcome. Surface the
  // error instead of replaying it and potentially overwriting a newer backup.
  assertDriveBackupCurrent(generation);
  const file = await saveBackupFile(activeToken, envelope, remoteBackup.resolvedFileId);
  assertDriveBackupCurrent(generation);

  return setDriveState({
    enabled: true,
    status: 'ok',
    fileId: file.id,
    remoteModifiedTime: file.modifiedTime,
    lastSyncAt: new Date(now + 1).toISOString(),
    lastSyncedAt: now + 1,
    tombstones,
    lastError: undefined,
  });
}

async function shouldSkipAutomaticSync(token: string, state: DriveSyncState): Promise<boolean> {
  const local = await getCurrentStorage();
  if (hasLocalChangesSinceLastSync(local, state)) return false;

  const remoteFile = await retryTransientDriveRead(() => findBackupFile(token));
  if (!remoteFile) return false;
  return Boolean(state.remoteModifiedTime && state.remoteModifiedTime === remoteFile.modifiedTime);
}

/**
 * Retry a read/preparation operation once with a refreshed token after 401.
 * This must not wrap a Drive write: its remote outcome can be ambiguous.
 */
async function withFreshGoogleToken<T>(
  token: string,
  operation: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await operation(token);
  } catch (error) {
    if (!(error instanceof DriveApiError) || error.status !== 401) throw error;
    return operation(await refreshGoogleAuthToken(token));
  }
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

async function getCurrentStorage(): Promise<StorageData> {
  const result = await chromeGet('tabnotes_data');
  return normalizeStorageData(result.tabnotes_data);
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

export function connectDriveSync() {
  return enqueueDriveOperation(async () => {
    await assertDriveFeatureAllowed();
    await assertOAuthConfigured();

    const token = await getGoogleAuthToken(true);
    const backupFile = await withFreshGoogleToken(token, (activeToken) =>
      retryTransientDriveRead(() => findBackupFile(activeToken))
    );

    await setDriveState({
      enabled: true,
      status: backupFile ? 'idle' : 'syncing',
      fileId: backupFile?.id,
      remoteModifiedTime: backupFile?.modifiedTime,
      lastError: undefined,
    });

    if (!backupFile) {
      const outcome = await performDriveBackupOnce(
        'connect',
        token,
        driveSyncGeneration,
        await getDriveState()
      );
      await adaptDriveBackupOutcome(outcome, 'connect');
    }

    await scheduleDrivePeriodicSync();

    return {
      ...(await getDriveSyncStatus()),
      hasBackup: Boolean(backupFile),
    };
  });
}

function throwsDriveBackupFailure(source: DriveSyncSource): boolean {
  return source === 'manual' || source === 'connect';
}

async function adaptDriveBackupOutcome(
  outcome: DriveBackupOutcome,
  source: DriveSyncSource
): Promise<DriveSyncState> {
  if (outcome.error) {
    if (throwsDriveBackupFailure(source)) throw new Error(driveErrorMessage(outcome.error));
    return outcome.state;
  }

  return outcome.state;
}

function mustRetrySkippedBackup(source: DriveSyncSource, skipped?: DriveBackupSkipReason): boolean {
  if (skipped === 'disabled') return source === 'manual' || source === 'connect';
  return skipped === 'up-to-date' && source !== 'auto';
}

function sourceRequiresEnabledDriveSync(source: DriveSyncSource): boolean {
  return source === 'auto' || source === 'external';
}

function startDriveBackup(source: DriveSyncSource, existingToken?: string): Promise<DriveBackupOutcome> {
  const inFlight = driveBackupInFlight;
  // Disconnect advances the generation before its state change is serialized.
  // Calls that arrive afterward must queue behind that disconnect rather than
  // inherit the cancelled operation's pre-disconnect state.
  if (inFlight?.generation === driveSyncGeneration) return inFlight.promise;

  const nextInFlight = { generation: driveSyncGeneration } as DriveBackupInFlight;
  nextInFlight.promise = enqueueDriveOperation(async () => {
    const state = await getDriveState();
    if (!state.enabled && sourceRequiresEnabledDriveSync(source)) {
      return { state, skipped: 'disabled' as const };
    }
    return performDriveBackupOnce(source, existingToken, nextInFlight.generation, state);
  }).then(
    (outcome) => {
      if (driveBackupInFlight === nextInFlight) driveBackupInFlight = null;
      return outcome;
    },
    (error) => {
      if (driveBackupInFlight === nextInFlight) driveBackupInFlight = null;
      throw error;
    }
  );
  driveBackupInFlight = nextInFlight;
  return nextInFlight.promise;
}

export async function performDriveBackup(
  source: DriveSyncSource = 'manual',
  existingToken?: string
): Promise<DriveSyncState> {
  const outcome = await startDriveBackup(source, existingToken);
  if (mustRetrySkippedBackup(source, outcome.skipped)) {
    return performDriveBackup(source, existingToken);
  }
  return adaptDriveBackupOutcome(outcome, source);
}

async function backupFailureOutcome(
  error: unknown,
  preserveCurrentState = false
): Promise<DriveBackupOutcome> {
  try {
    return {
      state: preserveCurrentState ? await getDriveState() : await failDriveSync(error, false),
      error,
    };
  } catch {
    return {
      state: {
        ...DEFAULT_DRIVE_STATE,
        status: 'error',
        lastError: driveErrorMessage(error),
      },
      error,
    };
  }
}

async function performDriveBackupOnce(
  source: DriveSyncSource,
  existingToken: string | undefined,
  generation: number,
  currentState: DriveSyncState
): Promise<DriveBackupOutcome> {
  try {
    await assertDriveFeatureAllowed();
    await assertOAuthConfigured();
  } catch (error) {
    return backupFailureOutcome(error, true);
  }

  try {
    const token = existingToken ?? (await getGoogleAuthToken(false));
    if (source === 'auto') {
      const shouldSkip = await withFreshGoogleToken(token, (activeToken) =>
        shouldSkipAutomaticSync(activeToken, currentState)
      );
      if (shouldSkip) {
        assertDriveBackupCurrent(generation);
        return {
          state: await setDriveState({
            status: currentState.enabled ? 'ok' : currentState.status,
            lastError: undefined,
          }),
          skipped: 'up-to-date' as const,
        };
      }
    }
    const outcome = { state: await saveCurrentBackupWithToken(token, generation) };
    await scheduleDrivePeriodicSync();
    return outcome;
  } catch (error) {
    if (error instanceof DriveBackupCancelledError) {
      return { state: await getDriveState(), skipped: 'cancelled' };
    }
    return backupFailureOutcome(error);
  }
}

export function restoreDriveBackup() {
  return enqueueDriveOperation(async () => {
    await assertDriveFeatureAllowed();
    await assertOAuthConfigured();

    const state = await getDriveState();
    const token = await getGoogleAuthToken(false);
    const remoteBackup = await withFreshGoogleToken(token, (activeToken) =>
      getBackupFileAfterStaleIdRecovery(activeToken, state.fileId)
    );
    const envelope = parseAnyDriveSyncEnvelope(remoteBackup.payload);
    if (!envelope) throw new Error('Drive backup is missing or uses an unsupported format.');

    const current = await getCurrentStorage();
    const merged = mergeDriveSyncEnvelope(envelope, current, {
      sourceDeviceId: await ensureDeviceId(),
      localTombstones: state.tombstones ?? [],
      lastSyncedAt: state.lastSyncedAt,
    });
    await chromeSet({
      tabnotes_data: merged.data,
      [DRIVE_REMOTE_APPLY_STORAGE_KEY]: { at: Date.now(), source: 'drive-restore' },
    });
    await applyBackupPrefs(envelope.data.prefs);
    const nextState = await setDriveState({
      enabled: true,
      status: 'ok',
      fileId: remoteBackup.resolvedFileId,
      lastRestoreAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncedAt: Date.now(),
      tombstones: merged.tombstones,
      lastError: undefined,
    });
    await scheduleDrivePeriodicSync();

    return {
      ...nextState,
      ...(await getDriveSyncStatus()),
      restoredAt: envelope.syncedAt,
      summary: merged.summary,
    };
  });
}

export async function recordDriveDeletionTombstones(
  oldValue: unknown,
  newValue: unknown
): Promise<number> {
  const state = await getDriveState();
  const oldData = normalizeStorageData(oldValue);
  const newData = normalizeStorageData(newValue);
  const removedWorkspaces = getRemovedWorkspaces(oldData, newData);
  const removedWorkspaceIds = new Set(removedWorkspaces.map((workspace) => workspace.id));
  const removedNotes = getRemovedNotes(oldData, newData, removedWorkspaceIds);
  if (removedWorkspaces.length === 0 && removedNotes.length === 0) return 0;

  const deviceId = await ensureDeviceId();
  const deletedAt = Date.now();
  const tombstones = [
    ...(state.tombstones ?? []),
    ...removedWorkspaces.map((workspace) =>
      createDeleteTombstone(
        { entityType: 'workspace', id: workspace.id, workspaceId: workspace.id },
        deviceId,
        deletedAt
      )
    ),
    ...removedNotes.map((note) =>
      createDeleteTombstone(
        { entityType: 'note', id: note.id, scope: note.scope, workspaceId: note.workspaceId },
        deviceId,
        deletedAt
      )
    ),
  ];

  await setDriveState({
    tombstones,
    status: state.status === 'disconnected' ? state.status : 'idle',
  });
  return removedWorkspaces.length + removedNotes.length;
}

export function disconnectDriveSync(): Promise<DriveSyncState> {
  driveSyncGeneration += 1;
  return enqueueDriveOperation(async () => {
    await disconnectGoogle();
    await chromeAlarmClear(DRIVE_AUTO_SYNC_ALARM);
    await chromeAlarmClear(DRIVE_PERIODIC_SYNC_ALARM);
    return setDriveState({
      enabled: false,
      status: 'disconnected',
      lastError: undefined,
    });
  });
}

export async function scheduleDriveAutoSync(): Promise<void> {
  const state = await getDriveState();
  if (!state.enabled || !state.lastSyncedAt) return;
  await chromeAlarmClear(DRIVE_AUTO_SYNC_ALARM);
  chrome.alarms.create(DRIVE_AUTO_SYNC_ALARM, { when: Date.now() + SYNC_DEBOUNCE_MS });
}

export async function scheduleDrivePeriodicSync(): Promise<void> {
  const state = await getDriveState();
  await chromeAlarmClear(DRIVE_PERIODIC_SYNC_ALARM);
  if (!state.enabled) return;
  chrome.alarms.create(DRIVE_PERIODIC_SYNC_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: PERIODIC_SYNC_MINUTES,
  });
}

export async function handleDriveAlarm(alarmName: string): Promise<boolean> {
  if (alarmName !== DRIVE_AUTO_SYNC_ALARM && alarmName !== DRIVE_PERIODIC_SYNC_ALARM) return false;
  await performDriveBackup('auto');
  return true;
}

export function handleDriveMessage(
  msg: { type?: string },
  sendResponse: (response?: unknown) => void
): boolean {
  const actions: Record<string, () => Promise<unknown>> = {
    DRIVE_GET_STATUS: getDriveSyncStatus,
    DRIVE_CONNECT: connectDriveSync,
    DRIVE_SYNC_NOW: () => performDriveBackup('manual'),
    DRIVE_SYNC_IF_ENABLED: () => performDriveBackup('auto'),
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
