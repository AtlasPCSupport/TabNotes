import { create } from 'zustand';
import {
  Note, Workspace, NoteScope,
  LocalStorageAdapter, NotesService, WorkspacesService, StorageData,
  importData as mergeImport, ExportData,
} from '@tabnotes/shared';

const adapter = new LocalStorageAdapter();
const notesService = new NotesService(adapter);
const workspacesService = new WorkspacesService(adapter);

interface NotesStore {
  notes: Note[];
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  defaultScope: NoteScope;
  markdownEnabled: boolean;
  loading: boolean;
  load: () => Promise<void>;
  createNote: (params: { scope: NoteScope; url?: string; content?: string; title?: string; tags?: string[] }) => Promise<Note>;
  updateNote: (id: string, updates: Partial<Pick<Note, 'content' | 'title' | 'tags'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  createWorkspace: (name: string, color?: string) => Promise<Workspace>;
  updateWorkspace: (id: string, updates: Partial<Pick<Workspace, 'name' | 'color'>>) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  setActiveWorkspace: (id: string | null) => Promise<void>;
  setDefaultScope: (scope: NoteScope) => Promise<void>;
  setMarkdownEnabled: (enabled: boolean) => Promise<void>;
  exportData: () => Promise<StorageData>;
  importData: (data: string) => Promise<void>;
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  workspaces: [],
  activeWorkspaceId: null,
  defaultScope: 'domain',
  markdownEnabled: false,
  loading: false,

  load: async () => {
    set({ loading: true });
    const [notes, workspaces, activeWorkspaceId, data] = await Promise.all([
      notesService.getAllNotes(),
      workspacesService.getAll(),
      workspacesService.getActive(),
      adapter.get(),
    ]);
    set({ notes, workspaces, activeWorkspaceId, defaultScope: data.defaultScope, markdownEnabled: data.markdownEnabled ?? false, loading: false });
  },

  createNote: async ({ scope, url = 'https://tabnotes.app', content, title, tags }) => {
    const { activeWorkspaceId } = get();
    const note = await notesService.createNote({ scope, url, workspaceId: activeWorkspaceId, content, title, tags });
    await get().load();
    return note;
  },

  updateNote: async (id, updates) => { await notesService.updateNote(id, updates); await get().load(); },
  deleteNote: async (id) => { await notesService.deleteNote(id); await get().load(); },

  createWorkspace: async (name, color) => {
    const ws = await workspacesService.create(name, color);
    await get().load();
    return ws;
  },

  updateWorkspace: async (id, updates) => { await workspacesService.update(id, updates); await get().load(); },
  deleteWorkspace: async (id) => { await workspacesService.delete(id); await get().load(); },

  setActiveWorkspace: async (id) => { await workspacesService.setActive(id); set({ activeWorkspaceId: id }); },

  setDefaultScope: async (scope) => { await adapter.set({ defaultScope: scope }); set({ defaultScope: scope }); },
  setMarkdownEnabled: async (enabled) => { await adapter.set({ markdownEnabled: enabled }); set({ markdownEnabled: enabled }); },

  exportData: () => adapter.get(),

  importData: async (jsonStr) => {
    const parsed = JSON.parse(jsonStr) as ExportData;
    const current = await adapter.get();
    const merged = mergeImport(parsed, current);
    await adapter.set(merged);
    await get().load();
  },
}));
