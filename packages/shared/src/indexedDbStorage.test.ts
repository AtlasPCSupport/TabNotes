import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  INDEXED_DB_LOCAL_STORAGE_MIGRATION_VERSION,
  IndexedDbStorageAdapter,
} from './indexedDbStorage';

const LEGACY_STORAGE_KEY = 'tabnotes_data';
const STORE_NAME = 'kv';
const MIGRATION_MARKER_KEY = 'tabnotes_local_storage_migration_v1';
const MIGRATION_BACKUP_KEY = 'tabnotes_local_storage_pre_migration_backup_v1';
let databaseSequence = 0;
let legacyStorage: Storage;

function databaseName(): string {
  databaseSequence += 1;
  return `tabnotes-indexeddb-test-${databaseSequence}`;
}

function readStoreValue<T>(dbName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const getRequest = transaction.objectStore(STORE_NAME).get(key);
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => resolve(getRequest.result as T | undefined);
      transaction.oncomplete = () => database.close();
    };
  });
}

beforeEach(() => {
  const entries = new Map<string, string>();
  legacyStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: legacyStorage });
});

afterEach(() => {
  legacyStorage.clear();
});

describe('IndexedDbStorageAdapter localStorage migration', () => {
  it('imports and normalizes legacy browser data once without deleting its source', async () => {
    const dbName = databaseName();
    const legacy = {
      notes: {
        legacyNote: {
          id: 'legacyNote',
          scope: 'domain',
          scopeKey: 'example.com',
          content: 'Previously saved note',
          createdAt: 10,
          updatedAt: 20,
        },
      },
      workspaces: {},
      activeWorkspaceId: null,
      defaultScope: 'domain',
      theme: 'dark',
      markdownEnabled: true,
      version: 1,
    };
    legacyStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacy));

    const adapter = new IndexedDbStorageAdapter(dbName);
    const data = await adapter.get();

    expect(data.notes_domain.legacyNote).toMatchObject({
      id: 'legacyNote',
      scope: 'domain',
      content: 'Previously saved note',
      tags: [],
    });
    expect(data.notes).toBeUndefined();
    expect(data.theme).toBe('dark');
    expect(data.markdownEnabled).toBe(true);
    expect(legacyStorage.getItem(LEGACY_STORAGE_KEY)).toBe(JSON.stringify(legacy));
    await expect(readStoreValue(dbName, MIGRATION_BACKUP_KEY)).resolves.toEqual(legacy);
    await expect(readStoreValue(dbName, MIGRATION_MARKER_KEY)).resolves.toMatchObject({
      version: INDEXED_DB_LOCAL_STORAGE_MIGRATION_VERSION,
    });
  });

  it('does not overwrite persisted IndexedDB data when legacy data changes later', async () => {
    const dbName = databaseName();
    legacyStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        notes_global: {
          first: {
            id: 'first',
            scope: 'global',
            scopeKey: '',
            content: 'first migration',
            createdAt: 1,
            updatedAt: 1,
          },
        },
      })
    );

    const adapter = new IndexedDbStorageAdapter(dbName);
    await adapter.get();
    await adapter.set({ theme: 'dark' });
    legacyStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        notes_global: {
          second: {
            id: 'second',
            scope: 'global',
            scopeKey: '',
            content: 'must not replace IndexedDB',
            createdAt: 2,
            updatedAt: 2,
          },
        },
      })
    );

    const reloaded = await new IndexedDbStorageAdapter(dbName).get();

    expect(reloaded.notes_global.first?.content).toBe('first migration');
    expect(reloaded.notes_global.second).toBeUndefined();
    expect(reloaded.theme).toBe('dark');
  });

  it('uses defaults for malformed legacy data and remains eligible for a future valid migration', async () => {
    const dbName = databaseName();
    legacyStorage.setItem(LEGACY_STORAGE_KEY, 'not-json');
    const adapter = new IndexedDbStorageAdapter(dbName);

    expect((await adapter.get()).notes_global).toEqual({});
    await expect(readStoreValue(dbName, MIGRATION_MARKER_KEY)).resolves.toBeUndefined();

    legacyStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        notes_global: {
          recovered: {
            id: 'recovered',
            scope: 'global',
            scopeKey: '',
            content: 'recovered legacy data',
            createdAt: 3,
            updatedAt: 3,
          },
        },
      })
    );

    expect((await adapter.get()).notes_global.recovered?.content).toBe('recovered legacy data');
  });

  it('serializes concurrent updates without losing either mutation', async () => {
    const adapter = new IndexedDbStorageAdapter(databaseName());

    await Promise.all([
      adapter.update((current) => ({
        notes_global: {
          ...current.notes_global,
          first: {
            id: 'first',
            workspaceId: null,
            scope: 'global',
            scopeKey: 'global',
            content: 'first update',
            tags: [],
            createdAt: 1,
            updatedAt: 1,
          },
        },
      })),
      adapter.update((current) => ({
        notes_global: {
          ...current.notes_global,
          second: {
            id: 'second',
            workspaceId: null,
            scope: 'global',
            scopeKey: 'global',
            content: 'second update',
            tags: [],
            createdAt: 2,
            updatedAt: 2,
          },
        },
      })),
    ]);

    await expect(adapter.get()).resolves.toMatchObject({
      notes_global: {
        first: { content: 'first update' },
        second: { content: 'second update' },
      },
    });
  });

  it('creates, restores, and clears a recovery snapshot', async () => {
    const adapter = new IndexedDbStorageAdapter(databaseName());
    await adapter.set({ theme: 'dark' });
    await adapter.createRecoverySnapshot('before-import', 123);
    await adapter.set({ theme: 'light' });

    await expect(adapter.getRecoverySnapshot()).resolves.toMatchObject({
      createdAt: 123,
      reason: 'before-import',
      data: { theme: 'dark' },
    });
    await expect(adapter.restoreRecoverySnapshot()).resolves.toMatchObject({
      data: { theme: 'dark' },
    });
    await expect(adapter.get()).resolves.toMatchObject({ theme: 'dark' });
    await adapter.clearRecoverySnapshot();
    await expect(adapter.getRecoverySnapshot()).resolves.toBeUndefined();
  });

  it('normalizes notes to the collection specified by their scope', async () => {
    const adapter = new IndexedDbStorageAdapter(databaseName());
    await adapter.set({
      notes_url: {
        misplaced: {
          id: 'misplaced',
          workspaceId: null,
          scope: 'global',
          scopeKey: 'global',
          content: 'must live in global collection',
          tags: [],
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    const data = await adapter.get();

    expect(data.notes_url.misplaced).toBeUndefined();
    expect(data.notes_global.misplaced).toMatchObject({ scope: 'global' });
  });
});
