import { describe, it, expect, beforeEach } from 'vitest';
import {
  NotesService,
  WorkspacesService,
  exportData,
  importData,
  DEFAULT_STORAGE,
  type StorageAdapter,
} from './storage';
import type { StorageData } from './types';

/** Simple in-memory adapter for testing the services. */
class MemoryAdapter implements StorageAdapter {
  private data: StorageData = structuredClone(DEFAULT_STORAGE);
  async get(): Promise<StorageData> {
    return structuredClone(this.data);
  }
  async set(patch: Partial<StorageData>): Promise<void> {
    this.data = { ...this.data, ...structuredClone(patch) };
  }
  async update(mutator: (current: StorageData) => Partial<StorageData>): Promise<StorageData> {
    const patch = mutator(structuredClone(this.data));
    this.data = { ...this.data, ...structuredClone(patch) };
    return structuredClone(this.data);
  }
  async clear(): Promise<void> {
    this.data = structuredClone(DEFAULT_STORAGE);
  }
}

describe('NotesService', () => {
  let adapter: MemoryAdapter;
  let svc: NotesService;
  beforeEach(() => {
    adapter = new MemoryAdapter();
    svc = new NotesService(adapter);
  });

  it('creates a note in the correct scope collection', async () => {
    const note = await svc.createNote({ scope: 'domain', url: 'https://example.com', content: 'hi' });
    expect(note.scope).toBe('domain');
    expect(note.scopeKey).toBe('example.com');
    const all = await svc.getAllNotes();
    expect(all).toHaveLength(1);
  });

  it('isolates notes between scopes', async () => {
    await svc.createNote({ scope: 'url', url: 'https://example.com/a', content: 'url note' });
    await svc.createNote({ scope: 'domain', url: 'https://example.com/a', content: 'domain note' });
    const urlNotes = await svc.getNotesByScope('url', 'https://example.com/a');
    const domainNotes = await svc.getNotesByScope('domain', 'https://example.com/a');
    expect(urlNotes).toHaveLength(1);
    expect(domainNotes).toHaveLength(1);
    expect(urlNotes[0].content).toBe('url note');
    expect(domainNotes[0].content).toBe('domain note');
  });

  it('snapshots a version on content change', async () => {
    const note = await svc.createNote({ scope: 'global', url: '', content: 'v1' });
    const updated = await svc.updateNote(note.id, { content: 'v2' });
    expect(updated?.content).toBe('v2');
    expect(updated?.versions).toHaveLength(1);
    expect(updated?.versions?.[0].content).toBe('v1');
  });

  it('does not snapshot when content is unchanged', async () => {
    const note = await svc.createNote({ scope: 'global', url: '', content: 'same' });
    const updated = await svc.updateNote(note.id, { title: 'new title' });
    expect(updated?.versions).toHaveLength(0);
  });

  it('deletes a note', async () => {
    const note = await svc.createNote({ scope: 'global', url: '', content: 'bye' });
    await svc.deleteNote(note.id);
    expect(await svc.getAllNotes()).toHaveLength(0);
  });

  it('moves a note across scope collections without losing note data', async () => {
    const note = await svc.createNote({
      scope: 'domain',
      url: 'https://example.com/path',
      content: 'payload',
      title: 'Source title',
      tags: ['alpha'],
      folder: '/Research',
    });
    await svc.updateNote(note.id, {
      content: 'payload v2',
      reminderAt: Date.now() + 60_000,
      encrypted: true,
      encryptedData: 'ciphertext',
    });

    const moved = await svc.moveNote(note.id, {
      scope: 'global',
      workspaceId: null,
      folder: null,
    });
    const data = await adapter.get();

    expect(data.notes_domain[note.id]).toBeUndefined();
    expect(data.notes_global[note.id]).toEqual(moved);
    expect(moved).toMatchObject({
      id: note.id,
      scope: 'global',
      scopeKey: '',
      workspaceId: null,
      content: 'payload v2',
      title: 'Source title',
      tags: ['alpha'],
      folder: undefined,
      encrypted: true,
      encryptedData: 'ciphertext',
    });
    expect(moved?.createdAt).toBe(note.createdAt);
    expect(moved?.versions?.[0].content).toBe('payload');
  });

  it('moves a workspace note between projects and recomputes the scope key', async () => {
    const wsSvc = new WorkspacesService(adapter);
    const source = await wsSvc.create('Source');
    const target = await wsSvc.create('Target');
    const note = await svc.createNote({
      scope: 'workspace',
      url: '',
      workspaceId: source.id,
      content: 'project note',
    });

    const moved = await svc.moveNote(note.id, { workspaceId: target.id });

    expect(moved?.scope).toBe('workspace');
    expect(moved?.workspaceId).toBe(target.id);
    expect(moved?.scopeKey).toBe(target.id);
    expect(await svc.getNotesByScope('workspace', '', source.id)).toHaveLength(0);
    expect(await svc.getNotesByScope('workspace', '', target.id)).toHaveLength(1);
  });

  it('moves only the folder while keeping the note in the same collection', async () => {
    const note = await svc.createNote({
      scope: 'url',
      url: 'https://example.com/article?utm_source=news#section',
      content: 'url note',
    });

    const moved = await svc.moveNote(note.id, { folder: 'Inbox' });
    const data = await adapter.get();

    expect(moved?.scope).toBe('url');
    expect(moved?.scopeKey).toBe('https://example.com/article');
    expect(moved?.folder).toBe('/Inbox');
    expect(data.notes_url[note.id]).toEqual(moved);
    expect(data.notes_domain[note.id]).toBeUndefined();
    expect(data.notes_workspace[note.id]).toBeUndefined();
    expect(data.notes_global[note.id]).toBeUndefined();
  });

  it('recomputes domain and URL keys when changing note categories', async () => {
    const note = await svc.createNote({ scope: 'global', url: '', content: 'portable' });

    const domainNote = await svc.moveNote(note.id, {
      scope: 'domain',
      url: 'https://www.example.com/path?utm_source=ad',
    });
    expect(domainNote?.scopeKey).toBe('example.com');

    const urlNote = await svc.moveNote(note.id, {
      scope: 'url',
      url: 'https://www.example.com/path?utm_source=ad#anchor',
    });
    expect(urlNote?.scopeKey).toBe('https://www.example.com/path');
  });

  it('rejects invalid URL-scope moves without mutating storage', async () => {
    const note = await svc.createNote({ scope: 'global', url: '', content: 'safe' });

    await expect(svc.moveNote(note.id, { scope: 'url' })).rejects.toThrow(
      /without a source URL/i,
    );

    const data = await adapter.get();
    expect(data.notes_global[note.id]).toMatchObject({ scope: 'global', content: 'safe' });
    expect(data.notes_url[note.id]).toBeUndefined();
  });
});

describe('WorkspacesService', () => {
  it('cascades note deletion when a workspace is removed', async () => {
    const adapter = new MemoryAdapter();
    const wsSvc = new WorkspacesService(adapter);
    const notesSvc = new NotesService(adapter);
    const ws = await wsSvc.create('Project X', '#fff');
    await notesSvc.createNote({ scope: 'workspace', url: '', workspaceId: ws.id, content: 'ws note' });
    await wsSvc.setActive(ws.id);

    await wsSvc.delete(ws.id);
    expect(await wsSvc.getAll()).toHaveLength(0);
    expect(await wsSvc.getActive()).toBeNull();
    const remaining = (await notesSvc.getAllNotes()).filter((n) => n.workspaceId === ws.id);
    expect(remaining).toHaveLength(0);
  });

  it('cascades workspace deletion across every note scope', async () => {
    const adapter = new MemoryAdapter();
    const wsSvc = new WorkspacesService(adapter);
    const notesSvc = new NotesService(adapter);
    const ws = await wsSvc.create('Project X', '#fff');

    await Promise.all([
      notesSvc.createNote({ scope: 'url', url: 'https://example.com/a', workspaceId: ws.id }),
      notesSvc.createNote({ scope: 'domain', url: 'https://example.com/a', workspaceId: ws.id }),
      notesSvc.createNote({ scope: 'workspace', url: '', workspaceId: ws.id }),
      notesSvc.createNote({ scope: 'global', url: '', workspaceId: ws.id }),
      notesSvc.createNote({ scope: 'global', url: '', workspaceId: null, content: 'keep' }),
    ]);

    await wsSvc.delete(ws.id);

    const remaining = await notesSvc.getAllNotes();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ content: 'keep', workspaceId: null });
  });
});

describe('exportData / importData', () => {
  it('round-trips notes and workspaces', async () => {
    const adapter = new MemoryAdapter();
    const notesSvc = new NotesService(adapter);
    const wsSvc = new WorkspacesService(adapter);
    await wsSvc.create('WS', '#000');
    await notesSvc.createNote({ scope: 'domain', url: 'https://a.com', content: 'note' });

    const exported = exportData(await adapter.get());
    expect(exported.notes).toHaveLength(1);
    expect(exported.workspaces).toHaveLength(1);

    const fresh = structuredClone(DEFAULT_STORAGE);
    const restored = importData(exported, fresh);
    const restoredNotes = [
      ...Object.values(restored.notes_url),
      ...Object.values(restored.notes_domain),
      ...Object.values(restored.notes_workspace),
      ...Object.values(restored.notes_global),
    ];
    expect(restoredNotes).toHaveLength(1);
    expect(Object.values(restored.workspaces)).toHaveLength(1);
  });
});

describe('LocalStorageAdapter write serialization', () => {
  beforeEach(() => {
    // Minimal localStorage stub (jsdom does not reliably expose one here).
    const store = new Map<string, string>();
    const mock = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    };
    (globalThis as unknown as { localStorage: typeof mock }).localStorage = mock;
  });

  it('does not clobber concurrent writes to different keys', async () => {
    const { LocalStorageAdapter } = await import('./storage');
    const adapter = new LocalStorageAdapter();

    // Fire many concurrent writes that each patch a different field. With a
    // naive read-modify-write, later writes would overwrite earlier ones
    // because they all read the same initial (empty) state.
    await Promise.all([
      adapter.set({ theme: 'dark' }),
      adapter.set({ defaultScope: 'url' }),
      adapter.set({ markdownEnabled: true }),
      adapter.set({ activeWorkspaceId: 'ws-1' }),
    ]);

    const final = await adapter.get();
    expect(final.theme).toBe('dark');
    expect(final.defaultScope).toBe('url');
    expect(final.markdownEnabled).toBe(true);
    expect(final.activeWorkspaceId).toBe('ws-1');
  });

  it('preserves notes across interleaved service writes', async () => {
    const { LocalStorageAdapter } = await import('./storage');
    const adapter = new LocalStorageAdapter();
    const svc = new NotesService(adapter);

    // Concurrently create several notes; all should survive.
    await Promise.all([
      svc.createNote({ scope: 'global', url: '', content: 'a' }),
      svc.createNote({ scope: 'global', url: '', content: 'b' }),
      svc.createNote({ scope: 'domain', url: 'https://x.com', content: 'c' }),
    ]);

    const all = await svc.getAllNotes();
    expect(all).toHaveLength(3);
  });
});
