import type { ExportData, ExportPrefs, Note, StorageData, Workspace } from './types';
import { decryptText, encryptText } from './crypto';
import { exportData, getScopeCollectionKey, STORAGE_VERSION } from './storage';

export const MANUAL_BACKUP_KIND = 'tabnotes.backup';
export const MANUAL_BACKUP_SCHEMA = 1;
export const DRIVE_BACKUP_KIND = 'tabnotes.driveBackup';
export const DRIVE_BACKUP_SCHEMA = 1;

export type BackupStorageSettings = Pick<
  StorageData,
  'activeWorkspaceId' | 'defaultScope' | 'theme' | 'markdownEnabled' | 'language'
>;

export type DriveBackupStorageSettings = BackupStorageSettings;

export interface ManualBackupEnvelope {
  kind: typeof MANUAL_BACKUP_KIND;
  schema: typeof MANUAL_BACKUP_SCHEMA;
  storageVersion: number;
  exportedAt: number;
  exportedAtIso: string;
  data: ExportData;
  storage: BackupStorageSettings;
}

export interface DriveBackupEnvelope {
  kind: typeof DRIVE_BACKUP_KIND;
  schema: typeof DRIVE_BACKUP_SCHEMA;
  storageVersion: number;
  exportedAt: number;
  syncedAt: string;
  sourceDeviceId: string;
  data: ExportData;
  storage: DriveBackupStorageSettings;
}

export interface EncryptedManualBackupEnvelope {
  kind: typeof ENCRYPTED_MANUAL_BACKUP_KIND;
  schema: typeof ENCRYPTED_MANUAL_BACKUP_SCHEMA;
  encryptedData: string;
}

export type BackupImportSource = 'legacy' | 'manual' | 'drive';

export interface ParsedBackupImport {
  source: BackupImportSource;
  storageVersion: number;
  exportedAt: number;
  data: ExportData;
  storage?: BackupStorageSettings;
}

/** Stable categories suitable for import UI messages and telemetry. */
export type BackupImportFailureReason =
  | 'invalid-json'
  | 'too-large'
  | 'unsupported-format'
  | 'unsupported-schema'
  | 'invalid-envelope'
  | 'invalid-data'
  | 'duplicate-id'
  | 'limit-exceeded';

export type BackupImportParseResult =
  | { ok: true; value: ParsedBackupImport }
  | { ok: false; reason: BackupImportFailureReason };

export interface BackupImportSummary {
  notesAdded: number;
  notesUpdated: number;
  workspacesAdded: number;
  workspacesUpdated: number;
  storageSettingsRestored: number;
}

export interface BackupImportResult {
  data: StorageData;
  summary: BackupImportSummary;
  source: BackupImportSource;
}

export interface DriveBackupMergeSummary {
  notesAdded: number;
  notesUpdated: number;
  notesKeptLocal: number;
  workspacesAdded: number;
  workspacesUpdated: number;
  workspacesKeptLocal: number;
}

export interface DriveBackupMergeResult {
  data: StorageData;
  summary: DriveBackupMergeSummary;
}

const EMPTY_SUMMARY: DriveBackupMergeSummary = {
  notesAdded: 0,
  notesUpdated: 0,
  notesKeptLocal: 0,
  workspacesAdded: 0,
  workspacesUpdated: 0,
  workspacesKeptLocal: 0,
};

const EMPTY_IMPORT_SUMMARY: BackupImportSummary = {
  notesAdded: 0,
  notesUpdated: 0,
  workspacesAdded: 0,
  workspacesUpdated: 0,
  storageSettingsRestored: 0,
};

export const MAX_BACKUP_IMPORT_BYTES = 10 * 1024 * 1024;
/**
 * A 10 MiB plaintext backup expands after AES-GCM (44 bytes of header/tag) and
 * base64 encoding. Allow its encrypted representation while continuing to cap
 * the decrypted JSON at {@link MAX_BACKUP_IMPORT_BYTES} before parsing it.
 */
export const MAX_BACKUP_IMPORT_ENCRYPTED_PAYLOAD_LENGTH =
  4 * Math.ceil((MAX_BACKUP_IMPORT_BYTES + 44) / 3);
/** Maximum on-disk JSON size accepted for a password-encrypted backup. */
export const MAX_ENCRYPTED_MANUAL_BACKUP_FILE_BYTES = 14 * 1024 * 1024;
export const MAX_BACKUP_IMPORT_NOTES = 10_000;
export const MAX_BACKUP_IMPORT_WORKSPACES = 1_000;
export const MAX_BACKUP_IMPORT_TAGS_PER_NOTE = 100;
export const MAX_BACKUP_IMPORT_TAG_LENGTH = 100;
export const MAX_BACKUP_IMPORT_TITLE_LENGTH = 500;
export const MAX_BACKUP_IMPORT_CONTENT_LENGTH = 1_000_000;

const ENCRYPTED_MANUAL_BACKUP_KIND = 'tabnotes.encryptedBackup';
const ENCRYPTED_MANUAL_BACKUP_SCHEMA = 1;
export const MAX_BACKUP_IMPORT_VERSIONS_PER_NOTE = 5;

const MAX_ID_LENGTH = 256;
const MAX_SCOPE_KEY_LENGTH = 4_096;
const MAX_TITLE_LENGTH = MAX_BACKUP_IMPORT_TITLE_LENGTH;
const MAX_NOTE_CONTENT_LENGTH = MAX_BACKUP_IMPORT_CONTENT_LENGTH;
const MAX_TAGS_PER_NOTE = MAX_BACKUP_IMPORT_TAGS_PER_NOTE;
const MAX_TAG_LENGTH = MAX_BACKUP_IMPORT_TAG_LENGTH;
const MAX_FOLDER_LENGTH = 200;
const MAX_COLOR_LENGTH = 64;
const MAX_VERSIONS_PER_NOTE = MAX_BACKUP_IMPORT_VERSIONS_PER_NOTE;
const MAX_WORKSPACE_NAME_LENGTH = 250;
const MAX_PREF_RECORD_ENTRIES = 1_000;
const MAX_TIMESTAMP = 8_640_000_000_000_000;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ENCRYPTED_MANUAL_BACKUP_KEYS = new Set(['kind', 'schema', 'encryptedData']);
const MANUAL_BACKUP_KEYS = new Set([
  'kind',
  'schema',
  'storageVersion',
  'exportedAt',
  'exportedAtIso',
  'data',
  'storage',
]);
const DRIVE_BACKUP_KEYS = new Set([
  'kind',
  'schema',
  'storageVersion',
  'exportedAt',
  'syncedAt',
  'sourceDeviceId',
  'data',
  'storage',
]);
const EXPORT_DATA_KEYS = new Set(['version', 'exportedAt', 'notes', 'workspaces', 'prefs']);
const NOTE_KEYS = new Set([
  'id',
  'workspaceId',
  'scope',
  'scopeKey',
  'title',
  'content',
  'tags',
  'folder',
  'versions',
  'reminderAt',
  'encrypted',
  'encryptedData',
  'createdAt',
  'updatedAt',
]);
const NOTE_VERSION_KEYS = new Set(['content', 'title', 'savedAt']);
const WORKSPACE_KEYS = new Set(['id', 'name', 'color', 'createdAt', 'updatedAt']);
const PREF_KEYS = new Set([
  'colors',
  'folderColors',
  'pins',
  'fontsize',
  'align',
  'features',
  'digest',
  'streak',
  'backupRemindDays',
  'language',
]);
const DIGEST_KEYS = new Set(['enabled', 'time']);
const STREAK_KEYS = new Set(['count', 'lastDate']);
const BACKUP_STORAGE_KEYS = new Set([
  'activeWorkspaceId',
  'defaultScope',
  'theme',
  'markdownEnabled',
  'language',
]);
function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => !DANGEROUS_KEYS.has(key) && allowed.has(key));
}

function hasNoExtraArrayProperties(value: unknown[]): boolean {
  return Object.keys(value).length === value.length;
}

function isFiniteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
  );
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_TIMESTAMP
  );
}

function isString(value: unknown, max: number, required = false): value is string {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}

function isOptionalString(value: unknown, max: number): value is string | undefined {
  return value === undefined || isString(value, max);
}

/** Returns whether a value has the expected encrypted manual-backup envelope shape. */
export function isEncryptedManualBackupEnvelope(
  value: unknown
): value is EncryptedManualBackupEnvelope {
  return (
    isRecord(value) &&
    requireExactKeys(value, ENCRYPTED_MANUAL_BACKUP_KEYS) &&
    value.kind === ENCRYPTED_MANUAL_BACKUP_KIND &&
    value.schema === ENCRYPTED_MANUAL_BACKUP_SCHEMA &&
    isString(value.encryptedData, MAX_BACKUP_IMPORT_ENCRYPTED_PAYLOAD_LENGTH, true)
  );
}

function isExportData(value: unknown): value is ExportData {
  if (!isRecord(value) || !requireExactKeys(value, EXPORT_DATA_KEYS)) return false;
  if (!isFiniteNonNegativeInteger(value.version) || !isTimestamp(value.exportedAt)) return false;
  if (
    !Array.isArray(value.notes) ||
    value.notes.length > MAX_BACKUP_IMPORT_NOTES ||
    !hasNoExtraArrayProperties(value.notes)
  )
    return false;
  if (
    !Array.isArray(value.workspaces) ||
    value.workspaces.length > MAX_BACKUP_IMPORT_WORKSPACES ||
    !hasNoExtraArrayProperties(value.workspaces)
  )
    return false;
  return (
    value.notes.every(isValidNote) &&
    value.workspaces.every(isValidWorkspace) &&
    isValidExportPrefs(value.prefs)
  );
}

function isValidNote(value: unknown): value is Note {
  if (!isRecord(value) || !requireExactKeys(value, NOTE_KEYS)) return false;
  if (
    !isString(value.id, MAX_ID_LENGTH, true) ||
    !isValidScope(value.scope) ||
    !isString(value.scopeKey, MAX_SCOPE_KEY_LENGTH) ||
    !isString(value.content, MAX_NOTE_CONTENT_LENGTH)
  ) {
    return false;
  }
  if (value.workspaceId !== null && !isOptionalString(value.workspaceId, MAX_ID_LENGTH))
    return false;
  if (
    !isOptionalString(value.title, MAX_TITLE_LENGTH) ||
    !isOptionalString(value.folder, MAX_FOLDER_LENGTH) ||
    !isOptionalString(value.encryptedData, MAX_BACKUP_IMPORT_ENCRYPTED_PAYLOAD_LENGTH)
  ) {
    return false;
  }
  if (
    !Array.isArray(value.tags) ||
    value.tags.length > MAX_TAGS_PER_NOTE ||
    !hasNoExtraArrayProperties(value.tags) ||
    !value.tags.every((tag) => isString(tag, MAX_TAG_LENGTH, true))
  ) {
    return false;
  }
  if (
    value.versions !== undefined &&
    (!Array.isArray(value.versions) ||
      value.versions.length > MAX_VERSIONS_PER_NOTE ||
      !hasNoExtraArrayProperties(value.versions) ||
      !value.versions.every(
        (version) =>
          isRecord(version) &&
          requireExactKeys(version, NOTE_VERSION_KEYS) &&
          isString(version.content, MAX_NOTE_CONTENT_LENGTH) &&
          isOptionalString(version.title, MAX_TITLE_LENGTH) &&
          isTimestamp(version.savedAt)
      ))
  ) {
    return false;
  }
  if (value.reminderAt !== undefined && !isTimestamp(value.reminderAt)) return false;
  if (value.encrypted !== undefined && typeof value.encrypted !== 'boolean') return false;
  return isTimestamp(value.createdAt) && isTimestamp(value.updatedAt);
}

function isValidWorkspace(value: unknown): value is Workspace {
  return (
    isRecord(value) &&
    requireExactKeys(value, WORKSPACE_KEYS) &&
    isString(value.id, MAX_ID_LENGTH, true) &&
    isString(value.name, MAX_WORKSPACE_NAME_LENGTH, true) &&
    (value.color === undefined || isString(value.color, MAX_COLOR_LENGTH, true)) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  );
}

function isValidExportPrefs(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || !requireExactKeys(value, PREF_KEYS)) return false;

  const validRecord = (entry: unknown, isValue: (item: unknown) => boolean) =>
    isRecord(entry) &&
    Object.keys(entry).length <= MAX_PREF_RECORD_ENTRIES &&
    Object.entries(entry).every(
      ([key, item]) =>
        !DANGEROUS_KEYS.has(key) && isString(key, MAX_ID_LENGTH, true) && isValue(item)
    );

  if (
    value.colors !== undefined &&
    !validRecord(value.colors, (item) => isString(item, MAX_COLOR_LENGTH, true))
  ) {
    return false;
  }
  if (
    value.folderColors !== undefined &&
    !validRecord(value.folderColors, (item) => isString(item, MAX_COLOR_LENGTH, true))
  ) {
    return false;
  }
  if (
    value.pins !== undefined &&
    (!Array.isArray(value.pins) ||
      value.pins.length > MAX_BACKUP_IMPORT_NOTES ||
      !hasNoExtraArrayProperties(value.pins) ||
      !value.pins.every((pin) => isString(pin, MAX_ID_LENGTH, true)))
  ) {
    return false;
  }
  if (
    value.fontsize !== undefined &&
    ![11, 12, 13, 14, 15, 16].includes(value.fontsize as number)
  ) {
    return false;
  }
  if (
    value.align !== undefined &&
    value.align !== 'left' &&
    value.align !== 'center' &&
    value.align !== 'right'
  ) {
    return false;
  }
  if (
    value.features !== undefined &&
    !validRecord(value.features, (item) => typeof item === 'boolean')
  ) {
    return false;
  }
  if (
    value.digest !== undefined &&
    (!isRecord(value.digest) ||
      !requireExactKeys(value.digest, DIGEST_KEYS) ||
      (value.digest.enabled !== undefined && typeof value.digest.enabled !== 'boolean') ||
      (value.digest.time !== undefined &&
        (typeof value.digest.time !== 'string' || value.digest.time.length > 5)))
  ) {
    return false;
  }
  if (
    value.streak !== undefined &&
    (!isRecord(value.streak) ||
      !requireExactKeys(value.streak, STREAK_KEYS) ||
      (value.streak.count !== undefined &&
        (!isFiniteNonNegativeInteger(value.streak.count) || value.streak.count > 1_000_000)) ||
      (value.streak.lastDate !== undefined &&
        (typeof value.streak.lastDate !== 'string' || value.streak.lastDate.length > 10)))
  ) {
    return false;
  }
  if (
    value.backupRemindDays !== undefined &&
    ![0, 7, 14, 30].includes(value.backupRemindDays as number)
  ) {
    return false;
  }
  return value.language === undefined || isValidLanguage(value.language);
}

function isValidScope(value: unknown): value is BackupStorageSettings['defaultScope'] {
  return value === 'url' || value === 'domain' || value === 'workspace' || value === 'global';
}

function isValidTheme(value: unknown): value is BackupStorageSettings['theme'] {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isValidLanguage(value: unknown): value is NonNullable<BackupStorageSettings['language']> {
  return value === 'en' || value === 'es';
}

function parseBackupStorageSettings(value: unknown): BackupStorageSettings | null {
  if (!isRecord(value) || !requireExactKeys(value, BACKUP_STORAGE_KEYS)) return null;
  if (!isValidScope(value.defaultScope)) return null;
  if (!isValidTheme(value.theme)) return null;
  if (typeof value.markdownEnabled !== 'boolean') return null;
  if (
    value.activeWorkspaceId !== null &&
    value.activeWorkspaceId !== undefined &&
    typeof value.activeWorkspaceId !== 'string'
  ) {
    return null;
  }
  if (value.language !== undefined && !isValidLanguage(value.language)) return null;

  return {
    activeWorkspaceId: value.activeWorkspaceId ?? null,
    defaultScope: value.defaultScope,
    theme: value.theme,
    markdownEnabled: value.markdownEnabled,
    language: value.language,
  };
}

/** Returns false without JSON parsing when a user import exceeds the applicable size limit. */
export function isBackupImportTextWithinLimit(
  text: string,
  maxBytes = MAX_BACKUP_IMPORT_BYTES
): boolean {
  return text.length <= maxBytes && new TextEncoder().encode(text).byteLength <= maxBytes;
}

/**
 * Encrypted backup envelopes are larger than the 10 MiB plaintext they may
 * contain. This guard bounds only their serialized outer JSON; decrypted data
 * is always checked against {@link MAX_BACKUP_IMPORT_BYTES} before parsing.
 */
export function isEncryptedManualBackupTextWithinLimit(text: string): boolean {
  return isBackupImportTextWithinLimit(text, MAX_ENCRYPTED_MANUAL_BACKUP_FILE_BYTES);
}

function createBackupStorageSettings(storage: StorageData): BackupStorageSettings {
  return {
    activeWorkspaceId: storage.activeWorkspaceId,
    defaultScope: storage.defaultScope,
    theme: storage.theme,
    markdownEnabled: storage.markdownEnabled,
    language: storage.language,
  };
}

export function createManualBackupEnvelope(
  storage: StorageData,
  prefs?: ExportPrefs,
  now = Date.now()
): ManualBackupEnvelope {
  const data = exportData(storage, now);
  if (prefs && Object.keys(prefs).length > 0) {
    data.prefs = prefs;
  }

  return {
    kind: MANUAL_BACKUP_KIND,
    schema: MANUAL_BACKUP_SCHEMA,
    storageVersion: storage.version ?? STORAGE_VERSION,
    exportedAt: now,
    exportedAtIso: new Date(now).toISOString(),
    data,
    storage: createBackupStorageSettings(storage),
  };
}

export async function createEncryptedManualBackupEnvelope(
  backup: ManualBackupEnvelope,
  password: string
): Promise<EncryptedManualBackupEnvelope> {
  return {
    kind: ENCRYPTED_MANUAL_BACKUP_KIND,
    schema: ENCRYPTED_MANUAL_BACKUP_SCHEMA,
    encryptedData: await encryptText(JSON.stringify(backup), password),
  };
}

export async function decryptEncryptedManualBackupEnvelope(
  value: unknown,
  password: string
): Promise<ManualBackupEnvelope | null> {
  if (!isEncryptedManualBackupEnvelope(value)) return null;
  const rawBase64 = value.encryptedData.replace(/^tnenc:v\d+:/, '');
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(rawBase64)
  ) {
    return null;
  }
  try {
    const decrypted = await decryptText(value.encryptedData, password);
    if (!isBackupImportTextWithinLimit(decrypted)) return null;
    return parseManualBackupEnvelope(JSON.parse(decrypted));
  } catch {
    return null;
  }
}

export function parseManualBackupEnvelope(value: unknown): ManualBackupEnvelope | null {
  if (!isRecord(value) || !requireExactKeys(value, MANUAL_BACKUP_KEYS)) return null;
  if (value.kind !== MANUAL_BACKUP_KIND || value.schema !== MANUAL_BACKUP_SCHEMA) return null;
  if (!isFiniteNonNegativeInteger(value.storageVersion)) return null;
  if (!isTimestamp(value.exportedAt)) return null;
  if (!isString(value.exportedAtIso, 64, true) || !Number.isFinite(Date.parse(value.exportedAtIso)))
    return null;
  if (!isExportData(value.data)) return null;

  const storage = parseBackupStorageSettings(value.storage);
  if (!storage) return null;

  return {
    kind: MANUAL_BACKUP_KIND,
    schema: MANUAL_BACKUP_SCHEMA,
    storageVersion: value.storageVersion,
    exportedAt: value.exportedAt,
    exportedAtIso: value.exportedAtIso,
    data: value.data,
    storage,
  };
}

export function createDriveBackupEnvelope(
  storage: StorageData,
  sourceDeviceId: string,
  prefs?: ExportPrefs,
  now = Date.now()
): DriveBackupEnvelope {
  const data = exportData(storage, now);
  if (prefs && Object.keys(prefs).length > 0) {
    data.prefs = prefs;
  }

  return {
    kind: DRIVE_BACKUP_KIND,
    schema: DRIVE_BACKUP_SCHEMA,
    storageVersion: storage.version ?? STORAGE_VERSION,
    exportedAt: now,
    syncedAt: new Date(now).toISOString(),
    sourceDeviceId,
    data,
    storage: createBackupStorageSettings(storage),
  };
}

export function parseDriveBackupEnvelope(value: unknown): DriveBackupEnvelope | null {
  if (!isRecord(value) || !requireExactKeys(value, DRIVE_BACKUP_KEYS)) return null;
  if (value.kind !== DRIVE_BACKUP_KIND || value.schema !== DRIVE_BACKUP_SCHEMA) return null;
  if (!isFiniteNonNegativeInteger(value.storageVersion)) return null;
  if (!isTimestamp(value.exportedAt)) return null;
  if (!isString(value.syncedAt, 64, true) || !Number.isFinite(Date.parse(value.syncedAt)))
    return null;
  if (!isString(value.sourceDeviceId, MAX_ID_LENGTH, true)) return null;
  if (!isExportData(value.data)) return null;
  const storage = parseBackupStorageSettings(value.storage);
  if (!storage) return null;

  return {
    kind: DRIVE_BACKUP_KIND,
    schema: DRIVE_BACKUP_SCHEMA,
    storageVersion: value.storageVersion,
    exportedAt: value.exportedAt,
    syncedAt: value.syncedAt,
    sourceDeviceId: value.sourceDeviceId,
    data: value.data,
    storage,
  };
}

function normalizeParsedData(data: ExportData): ExportData | null {
  const noteIds = new Set<string>();
  const workspaceIds = new Set<string>();
  const notes: Note[] = [];
  const workspaces: Workspace[] = [];

  for (const note of data.notes) {
    if (noteIds.has(note.id)) return null;
    noteIds.add(note.id);
    notes.push({
      ...note,
      tags: [...new Set(note.tags.map((tag) => tag.trim()))],
      ...(note.versions === undefined
        ? {}
        : { versions: note.versions.map((version) => ({ ...version })) }),
    });
  }
  for (const workspace of data.workspaces) {
    if (workspaceIds.has(workspace.id)) return null;
    workspaceIds.add(workspace.id);
    workspaces.push({ ...workspace });
  }

  return {
    version: data.version,
    exportedAt: data.exportedAt,
    notes,
    workspaces,
    ...(data.prefs === undefined ? {} : { prefs: structuredClone(data.prefs) }),
  };
}

export function parseBackupImportResult(value: unknown): BackupImportParseResult {
  const manual = parseManualBackupEnvelope(value);
  if (manual) {
    const data = normalizeParsedData(manual.data);
    return data
      ? {
          ok: true,
          value: {
            source: 'manual',
            storageVersion: manual.storageVersion,
            exportedAt: manual.exportedAt,
            data,
            storage: { ...manual.storage },
          },
        }
      : { ok: false, reason: 'duplicate-id' };
  }

  const drive = parseDriveBackupEnvelope(value);
  if (drive) {
    const data = normalizeParsedData(drive.data);
    return data
      ? {
          ok: true,
          value: {
            source: 'drive',
            storageVersion: drive.storageVersion,
            exportedAt: drive.exportedAt,
            data,
            storage: { ...drive.storage },
          },
        }
      : { ok: false, reason: 'duplicate-id' };
  }

  if (isRecord(value) && value.kind !== undefined) {
    if (value.kind === MANUAL_BACKUP_KIND || value.kind === DRIVE_BACKUP_KIND) {
      return {
        ok: false,
        reason: value.schema !== 1 ? 'unsupported-schema' : 'invalid-envelope',
      };
    }
    return { ok: false, reason: 'unsupported-format' };
  }
  if (!isExportData(value)) return { ok: false, reason: 'invalid-data' };
  const data = normalizeParsedData(value);
  return data
    ? {
        ok: true,
        value: {
          source: 'legacy',
          storageVersion: data.version,
          exportedAt: data.exportedAt,
          data,
        },
      }
    : { ok: false, reason: 'duplicate-id' };
}

export function parseBackupImport(value: unknown): ParsedBackupImport | null {
  const result = parseBackupImportResult(value);
  return result.ok ? result.value : null;
}

/** Parses user-provided backup JSON after enforcing the 10 MiB import limit. */
export function parseBackupImportJson(text: string): ParsedBackupImport | null {
  if (!isBackupImportTextWithinLimit(text)) return null;
  try {
    return parseBackupImport(JSON.parse(text));
  } catch {
    return null;
  }
}

export function parseBackupImportJsonResult(text: string): BackupImportParseResult {
  if (!isBackupImportTextWithinLimit(text)) return { ok: false, reason: 'too-large' };
  try {
    return parseBackupImportResult(JSON.parse(text));
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
}

export function applyBackupImport(
  parsed: ParsedBackupImport,
  current: StorageData
): BackupImportResult {
  const next: StorageData = {
    ...current,
    notes_url: { ...current.notes_url },
    notes_domain: { ...current.notes_domain },
    notes_workspace: { ...current.notes_workspace },
    notes_global: { ...current.notes_global },
    workspaces: { ...current.workspaces },
    version: Math.max(current.version ?? 0, parsed.storageVersion ?? 0, STORAGE_VERSION),
  };
  const summary = { ...EMPTY_IMPORT_SUMMARY };

  for (const note of parsed.data.notes) {
    const collectionKey = getScopeCollectionKey(note.scope);
    const existingCollectionKeys = [
      'notes_url',
      'notes_domain',
      'notes_workspace',
      'notes_global',
    ] as const;
    const existed = existingCollectionKeys.some((key) => Boolean(next[key][note.id]));

    // Note IDs are globally unique even though storage is partitioned by scope.
    // A restored note may have moved scopes since the previous backup, so remove
    // any stale copies before writing its authoritative imported version.
    for (const key of existingCollectionKeys) {
      if (key === collectionKey || !next[key][note.id]) continue;
      const remaining = { ...next[key] };
      delete remaining[note.id];
      next[key] = remaining;
    }
    next[collectionKey] = { ...next[collectionKey], [note.id]: note };
    if (existed) summary.notesUpdated += 1;
    else summary.notesAdded += 1;
  }

  for (const workspace of parsed.data.workspaces) {
    const existed = Boolean(next.workspaces[workspace.id]);
    next.workspaces = { ...next.workspaces, [workspace.id]: workspace };
    if (existed) summary.workspacesUpdated += 1;
    else summary.workspacesAdded += 1;
  }

  if (parsed.storage) {
    next.defaultScope = parsed.storage.defaultScope;
    next.theme = parsed.storage.theme;
    next.markdownEnabled = parsed.storage.markdownEnabled;
    next.language = parsed.storage.language;
    next.activeWorkspaceId =
      parsed.storage.activeWorkspaceId && next.workspaces[parsed.storage.activeWorkspaceId]
        ? parsed.storage.activeWorkspaceId
        : null;
    summary.storageSettingsRestored = parsed.storage.language ? 5 : 4;
  }

  return { data: next, summary, source: parsed.source };
}

const NOTE_COLLECTION_KEYS = [
  'notes_url',
  'notes_domain',
  'notes_workspace',
  'notes_global',
] as const;

function findStoredNote(data: StorageData, id: string): Note | null {
  for (const collectionKey of NOTE_COLLECTION_KEYS) {
    const note = data[collectionKey][id];
    if (note) return note;
  }
  return null;
}

function putStoredNote(data: StorageData, note: Note): void {
  const targetCollectionKey = getScopeCollectionKey(note.scope);
  for (const collectionKey of NOTE_COLLECTION_KEYS) {
    if (collectionKey === targetCollectionKey || !data[collectionKey][note.id]) continue;
    const remaining = { ...data[collectionKey] };
    delete remaining[note.id];
    data[collectionKey] = remaining;
  }
  data[targetCollectionKey] = { ...data[targetCollectionKey], [note.id]: note };
}

function mergeNoteIntoStorage(
  next: StorageData,
  note: Note,
  summary: DriveBackupMergeSummary
): void {
  const local = findStoredNote(next, note.id);

  if (!local) {
    putStoredNote(next, note);
    summary.notesAdded += 1;
    return;
  }

  if ((note.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    putStoredNote(next, note);
    summary.notesUpdated += 1;
    return;
  }

  summary.notesKeptLocal += 1;
}

function mergeWorkspaceIntoStorage(
  next: StorageData,
  workspace: Workspace,
  summary: DriveBackupMergeSummary
): void {
  const local = next.workspaces[workspace.id];

  if (!local) {
    next.workspaces = { ...next.workspaces, [workspace.id]: workspace };
    summary.workspacesAdded += 1;
    return;
  }

  if ((workspace.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    next.workspaces = { ...next.workspaces, [workspace.id]: workspace };
    summary.workspacesUpdated += 1;
    return;
  }

  summary.workspacesKeptLocal += 1;
}

export function mergeDriveBackupEnvelope(
  envelope: DriveBackupEnvelope,
  current: StorageData
): DriveBackupMergeResult {
  const next: StorageData = {
    ...current,
    notes_url: { ...current.notes_url },
    notes_domain: { ...current.notes_domain },
    notes_workspace: { ...current.notes_workspace },
    notes_global: { ...current.notes_global },
    workspaces: { ...current.workspaces },
    activeWorkspaceId: envelope.storage.activeWorkspaceId,
    defaultScope: envelope.storage.defaultScope,
    theme: envelope.storage.theme,
    markdownEnabled: envelope.storage.markdownEnabled,
    language: envelope.storage.language,
    version: Math.max(current.version ?? 0, envelope.storageVersion ?? 0, STORAGE_VERSION),
  };
  const summary = { ...EMPTY_SUMMARY };

  for (const note of envelope.data.notes) {
    mergeNoteIntoStorage(next, note, summary);
  }

  for (const workspace of envelope.data.workspaces) {
    mergeWorkspaceIntoStorage(next, workspace, summary);
  }

  return { data: next, summary };
}
