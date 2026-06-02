import type { StateCreator } from 'zustand';
import type { EditorSlice, SidePanelState, Updater } from './types';

function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

/**
 * Editor slice creator — the core editable note fields (content, title, tags,
 * active note, saved/preview flags). Autosave scheduling and the cross-tab
 * dirty-check still run in the component using the `runtime` registry; this
 * slice only owns the reactive editor state.
 */
export const createEditorSlice: StateCreator<SidePanelState, [], [], EditorSlice> = (set) => ({
  activeNoteId: null,
  content: '',
  title: '',
  tags: '',
  saved: false,
  preview: false,

  setActiveNoteId: (v) => set((s) => ({ activeNoteId: resolve<string | null>(s.activeNoteId, v) })),
  setContent: (v) => set((s) => ({ content: resolve<string>(s.content, v) })),
  setTitle: (v) => set((s) => ({ title: resolve<string>(s.title, v) })),
  setTags: (v) => set((s) => ({ tags: resolve<string>(s.tags, v) })),
  setSaved: (v) => set((s) => ({ saved: resolve<boolean>(s.saved, v) })),
  setPreview: (v) => set((s) => ({ preview: resolve<boolean>(s.preview, v) })),
});
