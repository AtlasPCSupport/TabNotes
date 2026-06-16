import type { ExportData, ExportPrefs, Note, StorageData, Workspace } from './types';
import { exportData, getScopeCollectionKey, STORAGE_VERSION } from './storage';

export const DRIVE_BACKUP_KIND = 'tabnotes.driveBackup';
export const DRIVE_BACKUP_SCHEMA = 1;

export type DriveBackupStorageSettings = Pick<
  StorageData,
  'activeWorkspaceId' | 'defaultScope' | 'theme' | 'markdownEnabled' | 'language'
>;

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

export function createDriveBackupEnvelope(
  storage: StorageData,
  sourceDeviceId: string,
  prefs?: ExportPrefs,
  now = Date.now(),
): DriveBackupEnvelope {
  const data = exportData(storage);
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
    storage: {
      activeWorkspaceId: storage.activeWorkspaceId,
      defaultScope: storage.defaultScope,
      theme: storage.theme,
      markdownEnabled: storage.markdownEnabled,
      language: storage.language,
    },
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
  if (!isRecord(value.storage)) return null;

  const storage = value.storage as Partial<DriveBackupStorageSettings>;
  if (!storage.defaultScope || !storage.theme || typeof storage.markdownEnabled !== 'boolean') {
    return null;
  }

  return value as unknown as DriveBackupEnvelope;
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
