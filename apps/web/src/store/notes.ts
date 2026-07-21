import { create } from 'zustand';
import {
  TOMBSTONE_RETENTION_MS,
  applyBackupImport,
  createDeleteTombstone,
  createDriveSyncEnvelope,
  IndexedDbStorageAdapter,
  decryptEncryptedManualBackupEnvelope,
  isBackupImportTextWithinLimit,
  isEncryptedManualBackupEnvelope,
  isEncryptedManualBackupTextWithinLimit,
  mergeDriveSyncEnvelope,
  NotesService,
  parseAnyDriveSyncEnvelope,
  parseBackupImportResult,
  WorkspacesService,
  type DriveSyncEnvelope,
  type Note,
  type NoteScope,
  type StorageData,
  type SyncTombstone,
  type Workspace,
} from '@tabnotes/shared';
import {
  findWebBackupFile,
  loadWebBackupFile,
  saveWebBackupFile,
  WebDriveApiError,
} from '../sync/driveClient';
import {
  hasConfiguredGoogleClientId,
  hasGoogleClientId,
  requestGoogleDriveToken,
  revokeGoogleDriveToken,
} from '../sync/googleIdentity';
import { notifyExtensionDriveUpdated } from '../sync/extensionBridge';

const SYNC_META_KEY = 'tabnotes_web_sync_meta';
const MISSING_CLIENT_ID_ERROR =
  'Missing Google OAuth Web Application client ID for the TabNotes web app.';
const AUTO_SYNC_DELAY_MS = 1_200;

type SyncStatus =
  | 'offline'
  | 'local'
  | 'setup_required'
  | 'disconnected'
  | 'syncing'
  | 'ok'
  | 'error';

interface WebSyncMeta {
  deviceId: string;
  fileId?: string;
  remoteModifiedTime?: string;
  lastSyncAt?: number;
  lastSyncIso?: string;
  tombstones: SyncTombstone[];
}

interface SyncState {
  status: SyncStatus;
  configured: boolean;
  lastSyncIso?: string;
  lastError?: string;
  remoteModifiedTime?: string;
  pendingTombstones: number;
}

interface NotesStore {
  notes: Note[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  defaultScope: NoteScope;
  markdownEnabled: boolean;
  loading: boolean;
  sync: SyncState;
  load: () => Promise<void>;
  createNote: (params: {
    scope: NoteScope;
    url?: string;
    workspaceId?: string | null;
    content?: string;
    title?: string;
    tags?: string[];
    folder?: string;
  }) => Promise<Note>;
  updateNote: (
    id: string,
    updates: Partial<Pick<Note, 'content' | 'title' | 'tags' | 'folder'>>
  ) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  createWorkspace: (name: string, color?: string) => Promise<Workspace>;
  updateWorkspace: (
    id: string,
    updates: Partial<Pick<Workspace, 'name' | 'color'>>
  ) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string | null) => Promise<void>;
  setDefaultScope: (scope: NoteScope) => Promise<void>;
  setMarkdownEnabled: (enabled: boolean) => Promise<void>;
  exportData: () => Promise<StorageData>;
  importData: (data: string, password?: string) => Promise<void>;
  hasRecoverySnapshot: () => Promise<boolean>;
  restorePreImportSnapshot: () => Promise<boolean>;
  syncWithDrive: (interactive?: boolean) => Promise<void>;
  disconnectDrive: () => Promise<void>;
}

const adapter = new IndexedDbStorageAdapter();
const notesService = new NotesService(adapter);
const workspacesService = new WorkspacesService(adapter);
let inMemoryToken: string | null = null;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let webSyncInFlight: Promise<void> | null = null;
const TRANSIENT_RETRY_DELAYS_MS = [250, 1_000] as const;

function createDeviceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function syncErrorMessage(error: unknown): string {
  if (error instanceof WebDriveApiError) return `${error.status}: ${error.reason ?? error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isTransientWebDriveError(error: unknown): boolean {
  return (
    error instanceof WebDriveApiError &&
    (error.status === 408 || error.status === 429 || error.status >= 500)
  );
}

function waitForRetry(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function retryTransientDriveOperation<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientWebDriveError(error) || attempt === TRANSIENT_RETRY_DELAYS_MS.length)
        throw error;
      await waitForRetry(TRANSIENT_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

function resolveLoadedSyncStatus(sync: SyncState, configured: boolean): SyncStatus {
  if (!configured) return 'setup_required';
  return sync.status === 'setup_required' ? 'disconnected' : sync.status;
}

function resolveLoadedSyncError(sync: SyncState, configured: boolean): string | undefined {
  if (configured && sync.lastError === MISSING_CLIENT_ID_ERROR) return undefined;
  return sync.lastError;
}

async function getSyncMeta(): Promise<WebSyncMeta> {
  const current = await adapter.getMeta<Partial<WebSyncMeta>>(SYNC_META_KEY);
  if (current?.deviceId) {
    return {
      deviceId: current.deviceId,
      fileId: current.fileId,
      remoteModifiedTime: current.remoteModifiedTime,
      lastSyncAt: current.lastSyncAt,
      lastSyncIso: current.lastSyncIso,
      tombstones: pruneTombstones(current.tombstones ?? []),
    };
  }

  const next: WebSyncMeta = {
    deviceId: createDeviceId(),
    tombstones: [],
  };
  await adapter.setMeta(SYNC_META_KEY, next);
  return next;
}

async function setSyncMeta(patch: Partial<WebSyncMeta>): Promise<WebSyncMeta> {
  const current = await getSyncMeta();
  const next: WebSyncMeta = {
    ...current,
    ...patch,
    tombstones: pruneTombstones(patch.tombstones ?? current.tombstones ?? []),
  };
  if (Object.prototype.hasOwnProperty.call(patch, 'fileId') && patch.fileId === undefined) {
    delete next.fileId;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'remoteModifiedTime') &&
    patch.remoteModifiedTime === undefined
  ) {
    delete next.remoteModifiedTime;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'lastSyncAt') && patch.lastSyncAt === undefined) {
    delete next.lastSyncAt;
  }
  if (
    Object.prototype.hasOwnProperty.call(patch, 'lastSyncIso') &&
    patch.lastSyncIso === undefined
  ) {
    delete next.lastSyncIso;
  }
  await adapter.setMeta(SYNC_META_KEY, next);
  return next;
}

async function addTombstone(tombstone: SyncTombstone): Promise<void> {
  const meta = await getSyncMeta();
  const key = `${tombstone.entityType}:${tombstone.id}`;
  const tombstones = new Map(
    meta.tombstones.map((item) => [`${item.entityType}:${item.id}`, item])
  );
  const current = tombstones.get(key);
  if (!current || tombstone.deletedAt > current.deletedAt) tombstones.set(key, tombstone);
  await setSyncMeta({ tombstones: [...tombstones.values()] });
}

async function getToken(interactive: boolean): Promise<string> {
  if (inMemoryToken && !interactive) return inMemoryToken;
  inMemoryToken = await requestGoogleDriveToken(interactive);
  return inMemoryToken;
}

function getNoteFromState(notes: Note[], id: string): Note | undefined {
  return notes.find((note) => note.id === id);
}

function markLocalChanges(sync: SyncState): SyncState {
  return {
    ...sync,
    status: sync.configured || hasGoogleClientId() ? 'local' : sync.status,
  };
}

function scheduleAutoSync(syncWithDrive: () => Promise<void>): void {
  if (!inMemoryToken) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void syncWithDrive();
  }, AUTO_SYNC_DELAY_MS);
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

async function syncWebDriveOnce(
  interactive: boolean,
  set: (partial: Partial<NotesStore> | ((state: NotesStore) => Partial<NotesStore>)) => void,
  get: () => NotesStore
): Promise<void> {
  if (!(await hasConfiguredGoogleClientId())) {
    set({
      sync: {
        ...get().sync,
        configured: false,
        status: 'setup_required',
        lastError: MISSING_CLIENT_ID_ERROR,
      },
    });
    return;
  }

  set({ sync: { ...get().sync, status: 'syncing', lastError: undefined } });

  try {
    const token = await getToken(interactive);
    const meta = await getSyncMeta();
    const remoteFile = await retryTransientDriveOperation(() => findWebBackupFile(token));
    const rawRemote = remoteFile
      ? await retryTransientDriveOperation(() => loadWebBackupFile(token, remoteFile.id))
      : null;
    const remoteEnvelope = rawRemote ? parseAnyDriveSyncEnvelope(rawRemote) : null;
    if (rawRemote && !remoteEnvelope) {
      throw new Error('Drive backup is missing or uses an unsupported format.');
    }
    let local = await adapter.get();
    let tombstones = meta.tombstones;
    const previous: DriveSyncEnvelope | null = remoteEnvelope;
    const now = Date.now();

    if (remoteEnvelope) {
      const merged = mergeDriveSyncEnvelope(remoteEnvelope, local, {
        sourceDeviceId: meta.deviceId,
        localTombstones: meta.tombstones,
        lastSyncedAt: meta.lastSyncAt,
        now,
      });
      local = merged.data;
      tombstones = merged.tombstones;
      await adapter.set(local);
    }

    const envelope = createDriveSyncEnvelope(local, {
      sourceDeviceId: meta.deviceId,
      previous,
      tombstones,
      now: now + 1,
    });
    const file = await retryTransientDriveOperation(() =>
      saveWebBackupFile(token, envelope, remoteFile?.id ?? meta.fileId)
    );
    const nextMeta = await setSyncMeta({
      fileId: file.id,
      remoteModifiedTime: file.modifiedTime,
      lastSyncAt: now + 1,
      lastSyncIso: new Date(now + 1).toISOString(),
      tombstones,
    });

    await get().load();
    set({
      sync: {
        status: 'ok',
        configured: true,
        lastSyncIso: nextMeta.lastSyncIso,
        remoteModifiedTime: nextMeta.remoteModifiedTime,
        pendingTombstones: nextMeta.tombstones.length,
      },
    });
    void notifyExtensionDriveUpdated();
  } catch (error) {
    set({
      sync: {
        ...get().sync,
        status: 'error',
        configured: hasGoogleClientId(),
        lastError: syncErrorMessage(error),
      },
    });
  }
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  workspaces: [],
  activeWorkspaceId: null,
  defaultScope: 'domain',
  markdownEnabled: false,
  loading: false,
  sync: {
    status: hasGoogleClientId() ? 'disconnected' : 'setup_required',
    configured: hasGoogleClientId(),
    pendingTombstones: 0,
  },

  load: async () => {
    set({ loading: true });
    const [notes, workspaces, activeWorkspaceId, data, meta, driveConfigured] = await Promise.all([
      notesService.getAllNotes(),
      workspacesService.getAll(),
      workspacesService.getActive(),
      adapter.get(),
      getSyncMeta(),
      hasConfiguredGoogleClientId(),
    ]);
    set({
      notes,
      workspaces,
      activeWorkspaceId,
      defaultScope: data.defaultScope,
      markdownEnabled: data.markdownEnabled ?? false,
      loading: false,
      sync: {
        ...get().sync,
        configured: driveConfigured,
        status: resolveLoadedSyncStatus(get().sync, driveConfigured),
        lastError: resolveLoadedSyncError(get().sync, driveConfigured),
        lastSyncIso: meta.lastSyncIso,
        remoteModifiedTime: meta.remoteModifiedTime,
        pendingTombstones: meta.tombstones.length,
      },
    });
  },

  createNote: async ({
    scope,
    url = 'https://tabnotes.app/mobile',
    workspaceId,
    content,
    title,
    tags,
    folder,
  }) => {
    const fallbackWorkspaceId = get().activeWorkspaceId;
    const note = await notesService.createNote({
      scope,
      url,
      workspaceId: workspaceId === undefined ? fallbackWorkspaceId : workspaceId,
      content,
      title,
      tags,
      folder,
    });
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
    return note;
  },

  updateNote: async (id, updates) => {
    await notesService.updateNote(id, updates);
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  deleteNote: async (id) => {
    const note = getNoteFromState(get().notes, id);
    if (note) {
      const meta = await getSyncMeta();
      await addTombstone(
        createDeleteTombstone(
          { entityType: 'note', id, scope: note.scope, workspaceId: note.workspaceId },
          meta.deviceId
        )
      );
    }
    await notesService.deleteNote(id);
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  createWorkspace: async (name, color) => {
    const workspace = await workspacesService.create(name, color);
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
    return workspace;
  },

  updateWorkspace: async (id, updates) => {
    await workspacesService.update(id, updates);
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  deleteWorkspace: async (id) => {
    const meta = await getSyncMeta();
    await addTombstone(
      createDeleteTombstone({ entityType: 'workspace', id, workspaceId: id }, meta.deviceId)
    );
    await workspacesService.delete(id);
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  setActiveWorkspace: async (id) => {
    await workspacesService.setActive(id);
    set({ activeWorkspaceId: id });
  },

  setDefaultScope: async (scope) => {
    await adapter.set({ defaultScope: scope });
    set({ defaultScope: scope, sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  setMarkdownEnabled: async (enabled) => {
    await adapter.set({ markdownEnabled: enabled });
    set({ markdownEnabled: enabled, sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  exportData: () => adapter.get(),

  importData: async (jsonStr, password) => {
    let rawBackup: unknown;
    try {
      rawBackup = JSON.parse(jsonStr);
    } catch {
      throw new Error('The selected file is not valid JSON.');
    }

    const encrypted = isEncryptedManualBackupEnvelope(rawBackup);
    if (
      !(encrypted
        ? isEncryptedManualBackupTextWithinLimit(jsonStr)
        : isBackupImportTextWithinLimit(jsonStr))
    ) {
      throw new Error('The selected file is too large.');
    }
    if (encrypted && !password) {
      throw new Error('A password is required for this encrypted backup.');
    }
    const decrypted = encrypted
      ? await decryptEncryptedManualBackupEnvelope(rawBackup, password!)
      : rawBackup;
    const result = decrypted ? parseBackupImportResult(decrypted) : null;
    if (!result?.ok) {
      throw new Error('The selected file is not a supported TabNotes backup.');
    }
    const backup = result.value;

    const current = await adapter.get();
    // Finish all deterministic processing before taking the checkpoint, so a
    // rejected backup never changes the available recovery snapshot.
    const restored = applyBackupImport(backup, current);
    await adapter.createRecoverySnapshot?.('before-backup-import');
    await adapter.set(restored.data);
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
  },

  hasRecoverySnapshot: async () => Boolean(await adapter.getRecoverySnapshot?.()),

  restorePreImportSnapshot: async () => {
    const snapshot = await adapter.restoreRecoverySnapshot?.();
    if (!snapshot) return false;
    await adapter.clearRecoverySnapshot?.();
    await get().load();
    set({ sync: markLocalChanges(get().sync) });
    scheduleAutoSync(() => get().syncWithDrive(false));
    return true;
  },

  syncWithDrive: async (interactive = true) => {
    if (webSyncInFlight) return webSyncInFlight;

    const sync = syncWebDriveOnce(interactive, set, get);
    webSyncInFlight = sync;
    try {
      await sync;
    } finally {
      if (webSyncInFlight === sync) webSyncInFlight = null;
    }
  },

  disconnectDrive: async () => {
    if (inMemoryToken) await revokeGoogleDriveToken(inMemoryToken);
    inMemoryToken = null;
    const meta = await getSyncMeta();
    await setSyncMeta({ fileId: undefined, remoteModifiedTime: undefined });
    set({
      sync: {
        status: hasGoogleClientId() ? 'disconnected' : 'setup_required',
        configured: hasGoogleClientId(),
        lastSyncIso: meta.lastSyncIso,
        pendingTombstones: meta.tombstones.length,
      },
    });
  },
}));
