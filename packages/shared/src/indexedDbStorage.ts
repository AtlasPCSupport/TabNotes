import type { Note, StorageData } from './types';
import { DEFAULT_STORAGE, getScopeCollectionKey, type StorageAdapter } from './storage';
import { generateId } from './utils';

const DEFAULT_DB_NAME = 'tabnotes-mobile';
const DEFAULT_STORE_NAME = 'kv';
const STORAGE_KEY = 'tabnotes_data';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
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
      nextNotes[id] = migrateNote({ ...(value as Partial<Note>), id });
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
    private readonly storeName = DEFAULT_STORE_NAME,
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

  async get(): Promise<StorageData> {
    try {
      const raw = await this.getRaw<StorageData>(STORAGE_KEY);
      const normalized = normalizeStorage(raw);
      if (raw && JSON.stringify(raw) !== JSON.stringify(normalized)) {
        await this.setRaw(STORAGE_KEY, normalized);
      }
      return normalized;
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

