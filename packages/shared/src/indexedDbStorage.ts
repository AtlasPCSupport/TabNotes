import type { Note, StorageData } from './types';
import type { RecoverySnapshot } from './storage';
import { DEFAULT_STORAGE, getScopeCollectionKey, type StorageAdapter } from './storage';
import { generateId } from './utils';

const DEFAULT_DB_NAME = 'tabnotes-mobile';
const DEFAULT_STORE_NAME = 'kv';
const STORAGE_KEY = 'tabnotes_data';
const RECOVERY_SNAPSHOT_KEY = 'tabnotes_recovery_snapshot';
const LEGACY_LOCAL_STORAGE_KEY = STORAGE_KEY;
const LOCAL_STORAGE_MIGRATION_KEY = 'tabnotes_local_storage_migration_v1';
const LOCAL_STORAGE_MIGRATION_BACKUP_KEY = 'tabnotes_local_storage_pre_migration_backup_v1';

export const INDEXED_DB_LOCAL_STORAGE_MIGRATION_VERSION = 1;

interface LocalStorageMigrationMarker {
  version: number;
  migratedAt: number;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

function migrateNote(raw: Partial<Note>): Note {
  return {
    id: raw.id ?? generateId(),
    workspaceId: raw.workspaceId ?? null,
    scope: raw.scope ?? 'global',
    scopeKey: raw.scopeKey ?? '',
    title: raw.title,
    content: raw.content ?? '',
    tags: raw.tags ?? [],
    folder: raw.folder,
    versions: raw.versions ?? [],
    reminderAt: raw.reminderAt,
    encrypted: raw.encrypted,
    encryptedData: raw.encryptedData,
    createdAt: raw.createdAt ?? Date.now(),
    updatedAt: raw.updatedAt ?? Date.now(),
  };
}

function normalizeStorage(raw: unknown): StorageData {
  const parsed = typeof raw === 'object' && raw !== null ? (raw as Partial<StorageData>) : {};
  const storage = {
    ...DEFAULT_STORAGE,
    ...parsed,
    notes_url: { ...(parsed.notes_url ?? {}) },
    notes_domain: { ...(parsed.notes_domain ?? {}) },
    notes_workspace: { ...(parsed.notes_workspace ?? {}) },
    notes_global: { ...(parsed.notes_global ?? {}) },
    workspaces: { ...(parsed.workspaces ?? {}) },
  } as StorageData;

  if (parsed.notes) {
    for (const noteValue of Object.values(parsed.notes)) {
      const note = migrateNote(noteValue as Partial<Note>);
      const key = getScopeCollectionKey(note.scope);
      storage[key] = { ...storage[key], [note.id]: note };
    }
    delete storage.notes;
  }

  for (const key of ['notes_url', 'notes_domain', 'notes_workspace', 'notes_global'] as const) {
    const nextNotes: Record<string, Note> = {};
    for (const [id, value] of Object.entries(storage[key] ?? {})) {
      const note = migrateNote({ ...(value as Partial<Note>), id });
      const targetKey = getScopeCollectionKey(note.scope);
      if (targetKey === key) {
        nextNotes[id] = note;
      } else {
        storage[targetKey] = { ...storage[targetKey], [note.id]: note };
      }
    }
    storage[key] = nextNotes;
  }

  return storage;
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly dbName = DEFAULT_DB_NAME,
    private readonly storeName = DEFAULT_STORE_NAME
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB.'));
    });

    return this.dbPromise;
  }

  private async getRaw<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    const transaction = db.transaction(this.storeName, 'readonly');
    const store = transaction.objectStore(this.storeName);
    const value = await requestToPromise<T | undefined>(store.get(key));
    await transactionDone(transaction);
    return value;
  }

  private async setRaw(key: string, value: unknown): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.put(value, key);
    await transactionDone(transaction);
  }

  /**
   * Imports the original web-app localStorage payload exactly once. The marker
   * is stored with the data so a user who later clears IndexedDB can opt into a
   * fresh migration deliberately, rather than silently overwriting newer data.
   */
  private async migrateLegacyLocalStorage(): Promise<StorageData | undefined> {
    if (typeof localStorage === 'undefined') return undefined;

    const marker = await this.getRaw<LocalStorageMigrationMarker>(LOCAL_STORAGE_MIGRATION_KEY);
    if (marker?.version === INDEXED_DB_LOCAL_STORAGE_MIGRATION_VERSION) return undefined;

    let legacyRaw: unknown;
    try {
      const serialized = localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      legacyRaw = serialized ? JSON.parse(serialized) : undefined;
    } catch {
      // A malformed legacy payload must never prevent the new store from opening.
      legacyRaw = undefined;
    }

    if (legacyRaw === undefined) return undefined;

    const migrated = normalizeStorage(legacyRaw);
    const db = await this.open();
    const transaction = db.transaction(this.storeName, 'readwrite');
    const store = transaction.objectStore(this.storeName);
    store.put(migrated, STORAGE_KEY);
    store.put(legacyRaw, LOCAL_STORAGE_MIGRATION_BACKUP_KEY);
    store.put(
      {
        version: INDEXED_DB_LOCAL_STORAGE_MIGRATION_VERSION,
        migratedAt: Date.now(),
      } satisfies LocalStorageMigrationMarker,
      LOCAL_STORAGE_MIGRATION_KEY
    );
    await transactionDone(transaction);
    return migrated;
  }

  private async ensureData(): Promise<StorageData> {
    const raw = await this.getRaw<StorageData>(STORAGE_KEY);
    if (raw) {
      const normalized = normalizeStorage(raw);
      if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
        await this.setRaw(STORAGE_KEY, normalized);
      }
      return normalized;
    }

    return (await this.migrateLegacyLocalStorage()) ?? structuredClone(DEFAULT_STORAGE);
  }

  async get(): Promise<StorageData> {
    try {
      return await this.ensureData();
    } catch {
      return structuredClone(DEFAULT_STORAGE);
    }
  }

  async set(data: Partial<StorageData>): Promise<void> {
    const run = this.writeChain.then(async () => {
      const current = await this.get();
      await this.setRaw(STORAGE_KEY, { ...current, ...data });
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async update(mutator: (current: StorageData) => Partial<StorageData>): Promise<StorageData> {
    const run = this.writeChain.then(async () => {
      const current = await this.get();
      const next = { ...current, ...mutator(current) };
      await this.setRaw(STORAGE_KEY, next);
      return next;
    });
    this.writeChain = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  async createRecoverySnapshot(reason: string, now = Date.now()): Promise<RecoverySnapshot> {
    const run = this.writeChain.then(async () => {
      const snapshot: RecoverySnapshot = {
        createdAt: now,
        reason,
        data: await this.get(),
      };
      await this.setRaw(RECOVERY_SNAPSHOT_KEY, snapshot);
      return snapshot;
    });
    this.writeChain = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  async getRecoverySnapshot(): Promise<RecoverySnapshot | undefined> {
    const snapshot = await this.getRaw<RecoverySnapshot>(RECOVERY_SNAPSHOT_KEY);
    if (
      !snapshot ||
      typeof snapshot.createdAt !== 'number' ||
      typeof snapshot.reason !== 'string'
    ) {
      return undefined;
    }
    return { ...snapshot, data: normalizeStorage(snapshot.data) };
  }

  async restoreRecoverySnapshot(): Promise<RecoverySnapshot | undefined> {
    const run = this.writeChain.then(async () => {
      const snapshot = await this.getRecoverySnapshot();
      if (!snapshot) return undefined;
      await this.setRaw(STORAGE_KEY, snapshot.data);
      return snapshot;
    });
    this.writeChain = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  async clearRecoverySnapshot(): Promise<void> {
    const run = this.writeChain.then(async () => {
      const db = await this.open();
      const transaction = db.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).delete(RECOVERY_SNAPSHOT_KEY);
      await transactionDone(transaction);
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async clear(): Promise<void> {
    const run = this.writeChain.then(async () => {
      const db = await this.open();
      const transaction = db.transaction(this.storeName, 'readwrite');
      transaction.objectStore(this.storeName).delete(STORAGE_KEY);
      await transactionDone(transaction);
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return this.getRaw<T>(key);
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    return this.setRaw(key, value);
  }
}
