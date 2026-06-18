import type { StateCreator } from 'zustand';
import type { ContextSlice, SidePanelState } from './types';

/**
 * Context slice creator — view routing + tab/workspace context.
 *
 * Slice creators take the standard Zustand `(set, get, store)` signature and
 * return only this slice's fields. They are merged in store/index.ts.
 */
export const createContextSlice: StateCreator<SidePanelState, [], [], ContextSlice> = (set) => ({
  view: 'note',
  currentUrl: '',
  currentDomain: '',
  scope: 'domain',
  workspaces: [],
  activeWorkspaceId: null,
  defaultScope: 'domain',
  settingsTarget: null,
  settingsTargetVersion: 0,

  setView: (view) => set({ view }),
  setSettingsTarget: (settingsTarget) =>
    set((state) => ({
      settingsTarget,
      settingsTargetVersion:
        settingsTarget === null ? state.settingsTargetVersion : state.settingsTargetVersion + 1,
    })),
  setScope: (scope) => set({ scope }),
  setCurrentUrl: (currentUrl) => set({ currentUrl }),
  setCurrentDomain: (currentDomain) => set({ currentDomain }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setDefaultScope: (defaultScope) => set({ defaultScope }),
});
