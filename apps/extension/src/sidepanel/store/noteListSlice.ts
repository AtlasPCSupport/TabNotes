import type { StateCreator } from 'zustand';
import type { Note } from '@tabnotes/shared';
import type { NoteListSlice, SidePanelState, Updater } from './types';

function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

/**
 * Note list slice creator — note collections and per-note/folder presentation
 * state. Persistence (localStorage for colors/pins/folder colors, services for
 * notes) remains in the component wrappers during the migration; these setters
 * only own the reactive state.
 */
export const createNoteListSlice: StateCreator<SidePanelState, [], [], NoteListSlice> = (set) => ({
  allNotes: [],
  contextNotes: [],
  noteColors: {},
  pinnedNotes: new Set<string>(),
  folderColors: {},
  expandedFolders: {},

  setAllNotes: (v) => set((s) => ({ allNotes: resolve<Note[]>(s.allNotes, v) })),
  setContextNotes: (v) => set((s) => ({ contextNotes: resolve<Note[]>(s.contextNotes, v) })),
  setNoteColors: (v) =>
    set((s) => ({ noteColors: resolve<Record<string, string>>(s.noteColors, v) })),
  setPinnedNotes: (v) => set((s) => ({ pinnedNotes: resolve<Set<string>>(s.pinnedNotes, v) })),
  setFolderColors: (v) =>
    set((s) => ({ folderColors: resolve<Record<string, string>>(s.folderColors, v) })),
  setExpandedFolders: (v) =>
    set((s) => ({ expandedFolders: resolve<Record<string, boolean>>(s.expandedFolders, v) })),
});
