import { create } from 'zustand';
import { createContextSlice } from './contextSlice';
import { createSettingsSlice } from './settingsSlice';
import { createNoteListSlice } from './noteListSlice';
import { createEditorSlice } from './editorSlice';
import type { SidePanelState } from './types';

/**
 * The side panel store. A single Zustand store composed from per-concern slice
 * creators. As the monolith is decomposed, additional slices are spread in here
 * alongside the existing ones.
 *
 * Usage: subscribe with a narrow selector to avoid over-rendering, e.g.
 *   const view = useSidePanelStore((s) => s.view);
 * In long-lived callbacks (storage.onChanged, timers) read live state with
 * `useSidePanelStore.getState()` rather than captured/destructured values.
 */
export const useSidePanelStore = create<SidePanelState>()((...a) => ({
  ...createContextSlice(...a),
  ...createSettingsSlice(...a),
  ...createNoteListSlice(...a),
  ...createEditorSlice(...a),
}));

export type { SidePanelState, View } from './types';
export { runtime } from './runtime';
