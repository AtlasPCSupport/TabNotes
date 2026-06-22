import type { ExportData, ExportPrefs, Note, NoteScope, StorageData, Workspace } from './types';
import { parseDriveBackupEnvelope, type DriveBackupStorageSettings } from './backup';
import { DEFAULT_STORAGE, exportData, getScopeCollectionKey, STORAGE_VERSION } from './storage';

export const DRIVE_SYNC_KIND = 'tabnotes.driveSync';
export const DRIVE_SYNC_SCHEMA = 2;
export const TOMBSTONE_RETENTION_MS = 1000 * 60 * 60 * 24 * 90;

type SyncEntityType = 'note' | 'workspace';

export interface SyncTombstone {
  entityType: SyncEntityType;
  id: string;
  scope?: NoteScope;
  workspaceId?: string | null;
  deletedAt: number;
  sourceDeviceId: string;
}

export interface DriveSyncEnvelope {
  kind: typeof DRIVE_SYNC_KIND;
  schema: typeof DRIVE_SYNC_SCHEMA;
  storageVersion: number;
  exportedAt: number;
  syncedAt: string;
  syncRevision: number;
  sourceDeviceId: string;
  data: ExportData;
  storage: DriveBackupStorageSettings;
  tombstones: SyncTombstone[];
}

export interface CreateDriveSyncOptions {
  sourceDeviceId: string;
  previous?: DriveSyncEnvelope | null;
  tombstones?: SyncTombstone[];
  prefs?: ExportPrefs;
  now?: number;
}

export interface DriveSyncMergeOptions {
  sourceDeviceId: string;
  localTombstones?: SyncTombstone[];
  lastSyncedAt?: number;
  now?: number;
}

export interface DriveSyncMergeSummary {
  notesAdded: number;
  notesUpdated: number;
  notesKeptLocal: number;
  notesDeleted: number;
  noteConflictsCreated: number;
  workspacesAdded: number;
  workspacesUpdated: number;
  workspacesKeptLocal: number;
  workspacesDeleted: number;
  tombstonesAdded: number;
  tombstonesKept: number;
}

export interface DriveSyncMergeResult {
  data: StorageData;
  tombstones: SyncTombstone[];
  summary: DriveSyncMergeSummary;
}

const EMPTY_SUMMARY: DriveSyncMergeSummary = {
  notesAdded: 0,
  notesUpdated: 0,
  notesKeptLocal: 0,
  notesDeleted: 0,
  noteConflictsCreated: 0,
  workspacesAdded: 0,
  workspacesUpdated: 0,
  workspacesKeptLocal: 0,
  workspacesDeleted: 0,
  tombstonesAdded: 0,
  tombstonesKept: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidScope(value: unknown): value is NoteScope {
  return value === 'url' || value === 'domain' || value === 'workspace' || value === 'global';
}

function isExportData(value: unknown): value is ExportData {
  return (
    isRecord(value) &&
    typeof value.version === 'number' &&
    typeof value.exportedAt === 'number' &&
    Array.isArray(value.notes) &&
    Array.isArray(value.workspaces)
  );
}

function createStorageSettings(storage: StorageData): DriveBackupStorageSettings {
  return {
    activeWorkspaceId: storage.activeWorkspaceId,
    defaultScope: storage.defaultScope,
    theme: storage.theme,
    markdownEnabled: storage.markdownEnabled,
    language: storage.language,
  };
}

function normalizeStorageData(raw: StorageData): StorageData {
  return {
    ...DEFAULT_STORAGE,
    ...raw,
    notes_url: { ...(raw.notes_url ?? {}) },
    notes_domain: { ...(raw.notes_domain ?? {}) },
    notes_workspace: { ...(raw.notes_workspace ?? {}) },
    notes_global: { ...(raw.notes_global ?? {}) },
    workspaces: { ...(raw.workspaces ?? {}) },
    version: Math.max(raw.version ?? 0, STORAGE_VERSION),
  };
}

function cloneStorage(raw: StorageData): StorageData {
  return normalizeStorageData(raw);
}

function isSyncTombstone(value: unknown): value is SyncTombstone {
  if (!isRecord(value)) return false;
  if (value.entityType !== 'note' && value.entityType !== 'workspace') return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (typeof value.deletedAt !== 'number') return false;
  if (typeof value.sourceDeviceId !== 'string' || !value.sourceDeviceId) return false;
  if (value.scope !== undefined && !isValidScope(value.scope)) return false;
  if (
    value.workspaceId !== undefined &&
    value.workspaceId !== null &&
    typeof value.workspaceId !== 'string'
  ) {
    return false;
  }
  return true;
}

function parseStorageSettings(value: unknown): DriveBackupStorageSettings | null {
  if (!isRecord(value)) return null;
  if (!isValidScope(value.defaultScope)) return null;
  if (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system') return null;
  if (typeof value.markdownEnabled !== 'boolean') return null;
  if (
    value.activeWorkspaceId !== null &&
    value.activeWorkspaceId !== undefined &&
    typeof value.activeWorkspaceId !== 'string'
  ) {
    return null;
  }
  if (value.language !== undefined && value.language !== 'en' && value.language !== 'es') return null;

  return {
    activeWorkspaceId: value.activeWorkspaceId ?? null,
    defaultScope: value.defaultScope,
    theme: value.theme,
    markdownEnabled: value.markdownEnabled,
    language: value.language,
  };
}

function tombstoneKey(tombstone: Pick<SyncTombstone, 'entityType' | 'id'>): string {
  return `${tombstone.entityType}:${tombstone.id}`;
}

function mergeTombstones(
  left: SyncTombstone[],
  right: SyncTombstone[],
  now: number,
): { tombstones: SyncTombstone[]; added: number; kept: number } {
  const cutoff = now - TOMBSTONE_RETENTION_MS;
  const merged = new Map<string, SyncTombstone>();
  let added = 0;
  let kept = 0;

  for (const tombstone of [...left, ...right]) {
    if (tombstone.deletedAt < cutoff) continue;
    const key = tombstoneKey(tombstone);
    const current = merged.get(key);
    if (!current || tombstone.deletedAt > current.deletedAt) {
      if (current) kept += 1;
      else added += 1;
      merged.set(key, tombstone);
    } else {
      kept += 1;
    }
  }

  return {
    tombstones: [...merged.values()].sort((a, b) => b.deletedAt - a.deletedAt),
    added,
    kept,
  };
}

function findLocalNote(data: StorageData, id: string): Note | null {
  for (const scope of ['url', 'domain', 'workspace', 'global'] as const) {
    const collection = data[getScopeCollectionKey(scope)];
    if (collection[id]) return collection[id];
  }
  return null;
}

function removeNote(data: StorageData, id: string): boolean {
  let removed = false;
  for (const scope of ['url', 'domain', 'workspace', 'global'] as const) {
    const key = getScopeCollectionKey(scope);
    if (data[key][id]) {
      const nextCollection = { ...data[key] };
      delete nextCollection[id];
      data[key] = nextCollection;
      removed = true;
    }
  }
  return removed;
}

function putNote(data: StorageData, note: Note): void {
  removeNote(data, note.id);
  const collectionKey = getScopeCollectionKey(note.scope);
  data[collectionKey] = { ...data[collectionKey], [note.id]: note };
}

function removeWorkspace(data: StorageData, id: string): boolean {
  if (!data.workspaces[id]) return false;

  const workspaces = { ...data.workspaces };
  delete workspaces[id];
  data.workspaces = workspaces;
  if (data.activeWorkspaceId === id) data.activeWorkspaceId = null;

  for (const scope of ['url', 'domain', 'workspace', 'global'] as const) {
    const key = getScopeCollectionKey(scope);
    const nextCollection = { ...data[key] };
    let changed = false;
    for (const note of Object.values(nextCollection)) {
      if (note.workspaceId === id) {
        delete nextCollection[note.id];
        changed = true;
      }
    }
    if (changed) data[key] = nextCollection;
  }

  return true;
}

function putWorkspace(data: StorageData, workspace: Workspace): void {
  data.workspaces = { ...data.workspaces, [workspace.id]: workspace };
}

function normalizeTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function noteSemanticSignature(note: Note): Record<string, unknown> {
  return {
    id: note.id,
    workspaceId: note.workspaceId,
    scope: note.scope,
    scopeKey: note.scopeKey,
    title: note.title ?? '',
    content: note.content,
    tags: normalizeTags(note.tags),
    folder: note.folder ?? '',
    reminderAt: note.reminderAt ?? null,
    encrypted: note.encrypted ?? false,
    encryptedData: note.encryptedData ?? '',
  };
}

function notesDiffer(left: Note, right: Note): boolean {
  const leftSignature = noteSemanticSignature(left);
  const rightSignature = noteSemanticSignature(right);
  for (const key of Object.keys(leftSignature)) {
    const leftValue = leftSignature[key];
    const rightValue = rightSignature[key];
    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      if (leftValue.length !== rightValue.length) return true;
      if (leftValue.some((value, index) => value !== rightValue[index])) return true;
      continue;
    }
    if (leftValue !== rightValue) return true;
  }
  return false;
}

function conflictNoteId(remote: Note, sourceDeviceId: string): string {
  return `${remote.id}__conflict__${sourceDeviceId}__${remote.updatedAt}`;
}

function createConflictNote(remote: Note, sourceDeviceId: string, now: number): Note {
  return {
    ...remote,
    id: conflictNoteId(remote, sourceDeviceId),
    title: remote.title ? `${remote.title} (conflict copy)` : 'Conflict copy',
    tags: [...new Set([...(remote.tags ?? []), 'conflict'])],
    versions: remote.versions ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function newestTombstoneFor(
  tombstones: SyncTombstone[],
  entityType: SyncEntityType,
  id: string,
): SyncTombstone | null {
  let result: SyncTombstone | null = null;
  for (const tombstone of tombstones) {
    if (tombstone.entityType !== entityType || tombstone.id !== id) continue;
    if (!result || tombstone.deletedAt > result.deletedAt) result = tombstone;
  }
  return result;
}

export function createDriveSyncEnvelope(
  storage: StorageData,
  options: CreateDriveSyncOptions,
): DriveSyncEnvelope {
  const now = options.now ?? Date.now();
  const data = exportData(storage, now);
  if (options.prefs && Object.keys(options.prefs).length > 0) {
    data.prefs = options.prefs;
  }

  const tombstones = mergeTombstones(
    options.previous?.tombstones ?? [],
    options.tombstones ?? [],
    now,
  ).tombstones;

  return {
    kind: DRIVE_SYNC_KIND,
    schema: DRIVE_SYNC_SCHEMA,
    storageVersion: storage.version ?? STORAGE_VERSION,
    exportedAt: now,
    syncedAt: new Date(now).toISOString(),
    syncRevision: (options.previous?.syncRevision ?? 0) + 1,
    sourceDeviceId: options.sourceDeviceId,
    data,
    storage: createStorageSettings(storage),
    tombstones,
  };
}

export function parseDriveSyncEnvelope(value: unknown): DriveSyncEnvelope | null {
  if (!isRecord(value)) return null;
  if (value.kind !== DRIVE_SYNC_KIND || value.schema !== DRIVE_SYNC_SCHEMA) return null;
  if (typeof value.storageVersion !== 'number') return null;
  if (typeof value.exportedAt !== 'number') return null;
  if (typeof value.syncedAt !== 'string') return null;
  if (typeof value.syncRevision !== 'number') return null;
  if (typeof value.sourceDeviceId !== 'string') return null;
  if (!isExportData(value.data)) return null;
  if (!Array.isArray(value.tombstones)) return null;

  const storage = parseStorageSettings(value.storage);
  if (!storage) return null;
  const tombstones = value.tombstones.filter(isSyncTombstone);

  return {
    kind: DRIVE_SYNC_KIND,
    schema: DRIVE_SYNC_SCHEMA,
    storageVersion: value.storageVersion,
    exportedAt: value.exportedAt,
    syncedAt: value.syncedAt,
    syncRevision: value.syncRevision,
    sourceDeviceId: value.sourceDeviceId,
    data: value.data,
    storage,
    tombstones,
  };
}

export function parseAnyDriveSyncEnvelope(value: unknown): DriveSyncEnvelope | null {
  const sync = parseDriveSyncEnvelope(value);
  if (sync) return sync;

  const legacy = parseDriveBackupEnvelope(value);
  if (!legacy) return null;

  return {
    kind: DRIVE_SYNC_KIND,
    schema: DRIVE_SYNC_SCHEMA,
    storageVersion: legacy.storageVersion,
    exportedAt: legacy.exportedAt,
    syncedAt: legacy.syncedAt,
    syncRevision: 1,
    sourceDeviceId: legacy.sourceDeviceId,
    data: legacy.data,
    storage: legacy.storage,
    tombstones: [],
  };
}

export function createDeleteTombstone(
  entity: Pick<SyncTombstone, 'entityType' | 'id' | 'scope' | 'workspaceId'>,
  sourceDeviceId: string,
  deletedAt = Date.now(),
): SyncTombstone {
  return {
    entityType: entity.entityType,
    id: entity.id,
    scope: entity.scope,
    workspaceId: entity.workspaceId,
    deletedAt,
    sourceDeviceId,
  };
}

export function mergeDriveSyncEnvelope(
  remote: DriveSyncEnvelope,
  local: StorageData,
  options: DriveSyncMergeOptions,
): DriveSyncMergeResult {
  const now = options.now ?? Date.now();
  const next = cloneStorage(local);
  const summary = { ...EMPTY_SUMMARY };
  const mergedTombstones = mergeTombstones(options.localTombstones ?? [], remote.tombstones, now);
  const tombstones = mergedTombstones.tombstones;
  summary.tombstonesAdded = mergedTombstones.added;
  summary.tombstonesKept = mergedTombstones.kept;

  for (const tombstone of tombstones) {
    if (tombstone.entityType === 'workspace') {
      const workspace = next.workspaces[tombstone.id];
      if (workspace && tombstone.deletedAt >= (workspace.updatedAt ?? 0)) {
        if (removeWorkspace(next, tombstone.id)) summary.workspacesDeleted += 1;
      }
      continue;
    }

    const localNote = findLocalNote(next, tombstone.id);
    if (localNote && tombstone.deletedAt >= (localNote.updatedAt ?? 0)) {
      if (removeNote(next, tombstone.id)) summary.notesDeleted += 1;
    }
  }

  for (const workspace of remote.data.workspaces) {
    const tombstone = newestTombstoneFor(tombstones, 'workspace', workspace.id);
    if (tombstone && tombstone.deletedAt >= (workspace.updatedAt ?? 0)) continue;

    const localWorkspace = next.workspaces[workspace.id];
    if (!localWorkspace) {
      putWorkspace(next, workspace);
      summary.workspacesAdded += 1;
      continue;
    }

    if ((workspace.updatedAt ?? 0) > (localWorkspace.updatedAt ?? 0)) {
      putWorkspace(next, workspace);
      summary.workspacesUpdated += 1;
    } else {
      summary.workspacesKeptLocal += 1;
    }
  }

  for (const note of remote.data.notes) {
    const tombstone = newestTombstoneFor(tombstones, 'note', note.id);
    if (tombstone && tombstone.deletedAt >= (note.updatedAt ?? 0)) continue;

    const localNote = findLocalNote(next, note.id);
    if (!localNote) {
      putNote(next, note);
      summary.notesAdded += 1;
      continue;
    }

    const localChanged = options.lastSyncedAt ? (localNote.updatedAt ?? 0) > options.lastSyncedAt : false;
    const remoteChanged = options.lastSyncedAt ? (note.updatedAt ?? 0) > options.lastSyncedAt : false;
    const shouldCreateConflict =
      localChanged &&
      remoteChanged &&
      notesDiffer(localNote, note) &&
      remote.sourceDeviceId !== options.sourceDeviceId;

    if (shouldCreateConflict) {
      const conflict = createConflictNote(note, remote.sourceDeviceId, now);
      if (!findLocalNote(next, conflict.id)) {
        putNote(next, conflict);
        summary.noteConflictsCreated += 1;
      }
      summary.notesKeptLocal += 1;
      continue;
    }

    if ((note.updatedAt ?? 0) > (localNote.updatedAt ?? 0)) {
      putNote(next, note);
      summary.notesUpdated += 1;
    } else {
      summary.notesKeptLocal += 1;
    }
  }

  next.activeWorkspaceId =
    remote.storage.activeWorkspaceId && next.workspaces[remote.storage.activeWorkspaceId]
      ? remote.storage.activeWorkspaceId
      : next.activeWorkspaceId;
  next.defaultScope = remote.storage.defaultScope;
  next.theme = remote.storage.theme;
  next.markdownEnabled = remote.storage.markdownEnabled;
  next.language = remote.storage.language;
  next.version = Math.max(next.version ?? 0, remote.storageVersion ?? 0, STORAGE_VERSION);

  return { data: next, tombstones, summary };
}
