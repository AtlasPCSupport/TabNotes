import type { ExportData, ExportPrefs, Note, StorageData, Workspace } from './types';
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

export type BackupImportSource = 'legacy' | 'manual' | 'drive';

export interface ParsedBackupImport {
  source: BackupImportSource;
  storageVersion: number;
  exportedAt: number;
  data: ExportData;
  storage?: BackupStorageSettings;
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExportData(value: unknown): value is ExportData {
  if (!isRecord(value)) return false;
  return (
    typeof value.version === 'number' &&
    typeof value.exportedAt === 'number' &&
    Array.isArray(value.notes) &&
    Array.isArray(value.workspaces)
  );
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
  if (!isRecord(value)) return null;
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
  now = Date.now(),
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

export function parseManualBackupEnvelope(value: unknown): ManualBackupEnvelope | null {
  if (!isRecord(value)) return null;
  if (value.kind !== MANUAL_BACKUP_KIND || value.schema !== MANUAL_BACKUP_SCHEMA) return null;
  if (typeof value.storageVersion !== 'number') return null;
  if (typeof value.exportedAt !== 'number') return null;
  if (typeof value.exportedAtIso !== 'string') return null;
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
  now = Date.now(),
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
  if (!isRecord(value)) return null;
  if (value.kind !== DRIVE_BACKUP_KIND || value.schema !== DRIVE_BACKUP_SCHEMA) return null;
  if (typeof value.storageVersion !== 'number') return null;
  if (typeof value.exportedAt !== 'number') return null;
  if (typeof value.syncedAt !== 'string') return null;
  if (typeof value.sourceDeviceId !== 'string') return null;
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

export function parseBackupImport(value: unknown): ParsedBackupImport | null {
  const manual = parseManualBackupEnvelope(value);
  if (manual) {
    return {
      source: 'manual',
      storageVersion: manual.storageVersion,
      exportedAt: manual.exportedAt,
      data: manual.data,
      storage: manual.storage,
    };
  }

  const drive = parseDriveBackupEnvelope(value);
  if (drive) {
    return {
      source: 'drive',
      storageVersion: drive.storageVersion,
      exportedAt: drive.exportedAt,
      data: drive.data,
      storage: drive.storage,
    };
  }

  if (isExportData(value)) {
    return {
      source: 'legacy',
      storageVersion: value.version,
      exportedAt: value.exportedAt,
      data: value,
    };
  }

  return null;
}

export function applyBackupImport(parsed: ParsedBackupImport, current: StorageData): BackupImportResult {
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
    const existed = Boolean(next[collectionKey]?.[note.id]);
    next[collectionKey] = { ...(next[collectionKey] ?? {}), [note.id]: note };
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

function mergeNoteIntoStorage(next: StorageData, note: Note, summary: DriveBackupMergeSummary): void {
  const collectionKey = getScopeCollectionKey(note.scope);
  const collection = { ...(next[collectionKey] ?? {}) };
  const local = collection[note.id];

  if (!local) {
    collection[note.id] = note;
    next[collectionKey] = collection;
    summary.notesAdded += 1;
    return;
  }

  if ((note.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
    collection[note.id] = note;
    next[collectionKey] = collection;
    summary.notesUpdated += 1;
    return;
  }

  summary.notesKeptLocal += 1;
}

function mergeWorkspaceIntoStorage(
  next: StorageData,
  workspace: Workspace,
  summary: DriveBackupMergeSummary,
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
  current: StorageData,
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
