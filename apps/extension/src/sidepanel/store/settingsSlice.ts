import type { StateCreator } from 'zustand';
import {
  DEFAULT_FEATURES,
  type Align,
  type Features,
  type SettingsSlice,
  type SidePanelState,
  type Theme,
  type Updater,
} from './types';
import { type Language, DEFAULT_LANGUAGE } from '@tabnotes/i18n';

/** Resolve a value-or-updater against the previous value. */
function resolve<T>(prev: T, next: Updater<T>): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

/**
 * Settings slice creator — appearance, feature flags, and editor prefs.
 *
 * Setters accept a value or a functional updater so the monolith's existing
 * call sites (e.g. `setFeatures((prev) => ...)`, `setMdState((p) => !p)`) work
 * unchanged through the bridge. Persistence still happens in the component's
 * wrapper functions; these setters only own the reactive state.
 */
export const createSettingsSlice: StateCreator<SidePanelState, [], [], SettingsSlice> = (set) => ({
  theme: 'system',
  markdownEnabled: false,
  features: DEFAULT_FEATURES,
  fontSize: 13,
  defaultAlign: 'left',
  language: DEFAULT_LANGUAGE,

  setThemeState: (v) => set((s) => ({ theme: resolve<Theme>(s.theme, v) })),
  setMdState: (v) => set((s) => ({ markdownEnabled: resolve<boolean>(s.markdownEnabled, v) })),
  setFeatures: (v) => set((s) => ({ features: resolve<Features>(s.features, v) })),
  setFontSizeState: (v) => set((s) => ({ fontSize: resolve<number>(s.fontSize, v) })),
  setDefaultAlignState: (v) => set((s) => ({ defaultAlign: resolve<Align>(s.defaultAlign, v) })),
  setLanguageState: (v) => set((s) => ({ language: resolve<Language>(s.language, v) })),
});
