import type { StateCreator } from 'zustand';
import type { ChecklistItem } from '@tabnotes/shared';
import type { ChecklistSlice, SidePanelState, Updater } from './types';

function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (value: T) => T)(prev) : next;
}

/**
 * Checklist slice creator — checklist presentation state for the active note.
 * Content conversion and persistence stay in the app coordinator so mode
 * changes share the same autosave path as the rich-text editor.
 */
export const createChecklistSlice: StateCreator<SidePanelState, [], [], ChecklistSlice> = (
  set
) => ({
  checklistMode: false,
  checklistItems: [],

  setChecklistMode: (v) =>
    set((state) => ({ checklistMode: resolve<boolean>(state.checklistMode, v) })),
  setChecklistItems: (v) =>
    set((state) => ({
      checklistItems: resolve<ChecklistItem[]>(state.checklistItems, v),
    })),
});
