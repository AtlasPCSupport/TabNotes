import type { Note, NoteVersion, Workspace, StorageData, ExportData, NoteScope } from './types';
import { generateId, getScopeKey } from './utils';

export const STORAGE_VERSION = 3;

export const DEFAULT_STORAGE: StorageData = {
  notes_url: {},
  notes_domain: {},
  notes_workspace: {},
  notes_global: {},
  workspaces: {},
  activeWorkspaceId: null,
  defaultScope: 'domain',
  theme: 'system',
  markdownEnabled: false,
  language: undefined,
  version: STORAGE_VERSION,
};

export interface StorageAdapter {
  get(): Promise<StorageData>;
  set(data: Partial<StorageData>): Promise<void>;
  /**
   * Atomically read-modify-write. The mutator receives the freshest state and
   * returns a partial patch to merge. The whole operation runs inside the
   * serialized write chain, so concurrent updates cannot clobber each other.
   */
  update(mutator: (current: StorageData) => Partial<StorageData>): Promise<StorageData>;
  clear(): Promise<void>;
}

export function getScopeCollectionKey(scope: NoteScope): 'notes_url' | 'notes_domain' | 'notes_workspace' | 'notes_global' {
  switch (scope) {
    case 'url': return 'notes_url';
    case 'domain': return 'notes_domain';
    case 'workspace': return 'notes_workspace';
    case 'global': return 'notes_global';
  }
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

export class LocalStorageAdapter implements StorageAdapter {
  private key = 'tabnotes_data';
  /** Serializes writes so concurrent set() calls cannot clobber each other. */
  private writeChain: Promise<void> = Promise.resolve();

  async get(): Promise<StorageData> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return { ...DEFAULT_STORAGE };
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const storage = { ...DEFAULT_STORAGE, ...parsed } as StorageData;

      // Perform migration if legacy "notes" exists
      if (parsed.notes) {
        for (const note of Object.values(parsed.notes as Record<string, unknown>)) {
          const migrated = migrateNote(note as Partial<Note>);
          const collKey = getScopeCollectionKey(migrated.scope);
          storage[collKey] = { ...storage[collKey], [migrated.id]: migrated };
        }
        delete storage.notes;
        // Save migrated data immediately
        localStorage.setItem(this.key, JSON.stringify(storage));
      } else {
        // Ensure note fields are migrated
        for (const key of ['notes_url', 'notes_domain', 'notes_workspace', 'notes_global'] as const) {
          const notes: Record<string, Note> = {};
          for (const [id, note] of Object.entries(storage[key] ?? {})) {
            notes[id] = migrateNote(note as Partial<Note>);
          }
          storage[key] = notes;
        }
      }
      return storage;
    } catch {
      return { ...DEFAULT_STORAGE };
    }
  }

  async set(data: Partial<StorageData>): Promise<void> {
    // Queue this write behind any in-flight write. The read happens inside the
    // chained task so it always observes the result of the previous write.
    const run = this.writeChain.then(async () => {
      const current = await this.get();
      localStorage.setItem(this.key, JSON.stringify({ ...current, ...data }));
    });
    // Keep the chain alive even if a write rejects.
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async update(mutator: (current: StorageData) => Partial<StorageData>): Promise<StorageData> {
    const run = this.writeChain.then(async () => {
      const current = await this.get();
      const next = { ...current, ...mutator(current) };
      localStorage.setItem(this.key, JSON.stringify(next));
      return next;
    });
    this.writeChain = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  async clear(): Promise<void> {
    const run = this.writeChain.then(async () => {
      localStorage.removeItem(this.key);
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }
}

export class ChromeStorageAdapter implements StorageAdapter {
  /** Serializes writes so concurrent set() calls cannot clobber each other. */
  private writeChain: Promise<void> = Promise.resolve();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get api(): any {
    return typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
      ? (globalThis as Record<string, unknown>).chrome
      : null;
  }

  async get(): Promise<StorageData> {
    const api = this.api;
    return new Promise((resolve) => {
      if (!api?.storage) { resolve({ ...DEFAULT_STORAGE }); return; }
      api.storage.local.get('tabnotes_data', (result: Record<string, unknown>) => {
        const parsed = result['tabnotes_data'] as Record<string, unknown> | undefined;
        const storage = { ...DEFAULT_STORAGE, ...parsed } as StorageData;

        // Perform migration if legacy "notes" exists
        if (parsed?.notes) {
          for (const note of Object.values(parsed.notes as Record<string, unknown>)) {
            const migrated = migrateNote(note as Partial<Note>);
            const collKey = getScopeCollectionKey(migrated.scope);
            storage[collKey] = { ...storage[collKey], [migrated.id]: migrated };
          }
          delete storage.notes;
          // Save migrated data immediately
          api.storage.local.set({ tabnotes_data: storage }, () => {
            resolve(storage);
          });
        } else {
          // Ensure note fields are migrated
          for (const key of ['notes_url', 'notes_domain', 'notes_workspace', 'notes_global'] as const) {
            const notes: Record<string, Note> = {};
            for (const [id, note] of Object.entries(storage[key] ?? {})) {
              notes[id] = migrateNote(note as Partial<Note>);
            }
            storage[key] = notes;
          }
          resolve(storage);
        }
      });
    });
  }

  async set(data: Partial<StorageData>): Promise<void> {
    // Queue this write behind any in-flight write so the read-modify-write is
    // atomic relative to other writes (prevents last-write-wins clobbering).
    const run = this.writeChain.then(async () => {
      const current = await this.get();
      const updated = { ...current, ...data };
      const api = this.api;
      await new Promise<void>((resolve) => {
        if (!api?.storage) { resolve(); return; }
        api.storage.local.set({ tabnotes_data: updated }, () => resolve());
      });
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async update(mutator: (current: StorageData) => Partial<StorageData>): Promise<StorageData> {
    const run = this.writeChain.then(async () => {
      const current = await this.get();
      const next = { ...current, ...mutator(current) };
      const api = this.api;
      await new Promise<void>((resolve) => {
        if (!api?.storage) { resolve(); return; }
        api.storage.local.set({ tabnotes_data: next }, () => resolve());
      });
      return next;
    });
    this.writeChain = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  async clear(): Promise<void> {
    const run = this.writeChain.then(async () => {
      const api = this.api;
      await new Promise<void>((resolve) => {
        if (!api?.storage) { resolve(); return; }
        api.storage.local.remove('tabnotes_data', () => resolve());
      });
    });
    this.writeChain = run.catch(() => undefined);
    return run;
  }
}

export class NotesService {
  constructor(private adapter: StorageAdapter) {}

  async getAllNotes(): Promise<Note[]> {
    const data = await this.adapter.get();
    const all = [
      ...Object.values(data.notes_url ?? {}),
      ...Object.values(data.notes_domain ?? {}),
      ...Object.values(data.notes_workspace ?? {}),
      ...Object.values(data.notes_global ?? {}),
    ];
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getNoteByScope(scope: NoteScope, url: string, workspaceId?: string | null): Promise<Note | null> {
    const notes = await this.getNotesByScope(scope, url, workspaceId);
    return notes[0] ?? null;
  }

  async getNotesByScope(scope: NoteScope, url: string, workspaceId?: string | null): Promise<Note[]> {
    const data = await this.adapter.get();
    const collKey = getScopeCollectionKey(scope);
    const scopeKey = getScopeKey(scope, url, workspaceId);
    return Object.values(data[collKey] ?? {})
      .filter((n) => n.scope === scope && n.scopeKey === scopeKey && n.workspaceId === (workspaceId ?? null))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async createNote(params: {
    scope: NoteScope; url: string;
    workspaceId?: string | null; content?: string; title?: string; tags?: string[]; folder?: string;
    id?: string;
  }): Promise<Note> {
    const now = Date.now();
    const note: Note = {
      id: params.id ?? generateId(),
      workspaceId: params.workspaceId ?? null,
      scope: params.scope,
      scopeKey: getScopeKey(params.scope, params.url, params.workspaceId),
      title: params.title,
      content: params.content ?? '',
      tags: params.tags ?? [],
      folder: params.folder,
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
    const collKey = getScopeCollectionKey(params.scope);
    await this.adapter.update((data) => ({
      [collKey]: { ...(data[collKey] ?? {}), [note.id]: note },
    }));
    return note;
  }

  async updateNote(
    id: string,
    updates: Partial<Pick<Note, 'content' | 'title' | 'tags' | 'folder' | 'reminderAt' | 'encrypted' | 'encryptedData'>>,
  ): Promise<Note | null> {
    let result: Note | null = null;
    await this.adapter.update((data) => {
      let foundScope: NoteScope | null = null;
      let note: Note | null = null;
      for (const scope of ['url', 'domain', 'workspace', 'global'] as NoteScope[]) {
        const collKey = getScopeCollectionKey(scope);
        if (data[collKey]?.[id]) {
          foundScope = scope;
          note = data[collKey][id];
          break;
        }
      }
      if (!foundScope || !note) return {};

      // Snapshot version before content changes (keep max 5)
      const versions: NoteVersion[] = [...(note.versions ?? [])];
      if (updates.content !== undefined && updates.content !== note.content) {
        versions.push({ content: note.content, title: note.title, savedAt: note.updatedAt });
        if (versions.length > 5) versions.splice(0, versions.length - 5);
      }

      const updated: Note = { ...note, ...updates, versions, updatedAt: Date.now() };
      result = updated;
      const collKey = getScopeCollectionKey(foundScope);
      return { [collKey]: { ...(data[collKey] ?? {}), [id]: updated } };
    });
    return result;
  }

  async deleteNote(id: string): Promise<void> {
    await this.adapter.update((data) => {
      for (const scope of ['url', 'domain', 'workspace', 'global'] as NoteScope[]) {
        const collKey = getScopeCollectionKey(scope);
        if (data[collKey]?.[id]) {
          const notes = { ...data[collKey] };
          delete notes[id];
          return { [collKey]: notes };
        }
      }
      return {};
    });
  }

  async getOrCreateNote(params: { scope: NoteScope; url: string; workspaceId?: string | null }): Promise<Note> {
    return (await this.getNoteByScope(params.scope, params.url, params.workspaceId))
      ?? this.createNote(params);
  }
}

export class WorkspacesService {
  constructor(private adapter: StorageAdapter) {}

  async getAll(): Promise<Workspace[]> {
    const data = await this.adapter.get();
    return Object.values(data.workspaces).sort((a, b) => a.createdAt - b.createdAt);
  }

  async create(name: string, color?: string): Promise<Workspace> {
    const now = Date.now();
    const workspace: Workspace = { id: generateId(), name, color, createdAt: now, updatedAt: now };
    await this.adapter.update((data) => ({
      workspaces: { ...data.workspaces, [workspace.id]: workspace },
    }));
    return workspace;
  }

  async update(id: string, updates: Partial<Pick<Workspace, 'name' | 'color'>>): Promise<Workspace | null> {
    let result: Workspace | null = null;
    await this.adapter.update((data) => {
      const ws = data.workspaces[id];
      if (!ws) return {};
      const updated: Workspace = { ...ws, ...updates, updatedAt: Date.now() };
      result = updated;
      return { workspaces: { ...data.workspaces, [id]: updated } };
    });
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.adapter.update((data) => {
      const workspaces = { ...data.workspaces };
      delete workspaces[id];

      // Cascading delete notes belonging to this workspace
      const notes_workspace = { ...data.notes_workspace };
      for (const noteId of Object.keys(notes_workspace)) {
        if (notes_workspace[noteId].workspaceId === id) {
          delete notes_workspace[noteId];
        }
      }
      const activeWorkspaceId = data.activeWorkspaceId === id ? null : data.activeWorkspaceId;
      return { workspaces, activeWorkspaceId, notes_workspace };
    });
  }

  async setActive(id: string | null): Promise<void> {
    await this.adapter.set({ activeWorkspaceId: id });
  }

  async getActive(): Promise<string | null> {
    return (await this.adapter.get()).activeWorkspaceId;
  }
}

export function exportData(data: StorageData): ExportData {
  const allNotes = [
    ...Object.values(data.notes_url ?? {}),
    ...Object.values(data.notes_domain ?? {}),
    ...Object.values(data.notes_workspace ?? {}),
    ...Object.values(data.notes_global ?? {}),
  ];
  return {
    version: STORAGE_VERSION,
    exportedAt: Date.now(),
    notes: allNotes,
    workspaces: Object.values(data.workspaces),
  };
}

export function importData(exported: ExportData, current: StorageData): StorageData {
  const next = { ...current };
  
  next.notes_url = { ...current.notes_url };
  next.notes_domain = { ...current.notes_domain };
  next.notes_workspace = { ...current.notes_workspace };
  next.notes_global = { ...current.notes_global };
  
  for (const n of exported.notes) {
    const collKey = getScopeCollectionKey(n.scope);
    next[collKey] = { ...next[collKey], [n.id]: n };
  }
  
  const workspaces = { ...current.workspaces };
  for (const ws of exported.workspaces) workspaces[ws.id] = ws;
  
  return { ...next, workspaces };
}
