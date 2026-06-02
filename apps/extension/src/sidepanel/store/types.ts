import type { Note, NoteScope, Workspace } from '@tabnotes/shared';
import type { Language } from '@tabnotes/i18n';

/** The side panel's top-level views, mirrored from the existing `view` state. */
export type View = 'note' | 'all' | 'settings' | 'graph' | 'chat' | 'about';

export type Theme = 'light' | 'dark' | 'system';
export type Align = 'left' | 'center' | 'right';

/** Feature flags toggled from Settings. */
export interface Features {
  formattingBar: boolean;
  smartSuggestions: boolean;
  writingStreak: boolean;
  wikiLinks: boolean;
  cmdPalette: boolean;
  chatView: boolean;
  noteGraph: boolean;
}

export const DEFAULT_FEATURES: Features = {
  formattingBar: true,
  smartSuggestions: true,
  writingStreak: true,
  wikiLinks: true,
  cmdPalette: true,
  chatView: true,
  noteGraph: true,
};

/** A setter that accepts a value or a functional updater, like React's setState. */
export type Updater<T> = T | ((prev: T) => T);

/**
 * Context slice — view routing and tab/workspace context.
 */
export interface ContextSlice {
  view: View;
  currentUrl: string;
  currentDomain: string;
  scope: NoteScope;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  defaultScope: NoteScope;

  setView: (view: View) => void;
  setScope: (scope: NoteScope) => void;
  setCurrentUrl: (url: string) => void;
  setCurrentDomain: (domain: string) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setDefaultScope: (scope: NoteScope) => void;
}

/**
 * Settings slice — appearance, feature flags, editor prefs. Setters that mirror
 * useState (accepting a value or updater) keep the bridged call sites identical.
 */
export interface SettingsSlice {
  theme: Theme;
  markdownEnabled: boolean;
  features: Features;
  fontSize: number;
  defaultAlign: Align;
  language: Language;

  setThemeState: (v: Updater<Theme>) => void;
  setMdState: (v: Updater<boolean>) => void;
  setFeatures: (v: Updater<Features>) => void;
  setFontSizeState: (v: Updater<number>) => void;
  setDefaultAlignState: (v: Updater<Align>) => void;
  setLanguageState: (v: Updater<Language>) => void;
}

/**
 * Note list slice — the note collections and per-note/folder presentation
 * state previously held as useState in the monolith. Setters mirror useState
 * (value or updater) so bridged call sites are unchanged.
 */
export interface NoteListSlice {
  allNotes: Note[];
  contextNotes: Note[];
  noteColors: Record<string, string>;
  pinnedNotes: Set<string>;
  folderColors: Record<string, string>;
  expandedFolders: Record<string, boolean>;

  setAllNotes: (v: Updater<Note[]>) => void;
  setContextNotes: (v: Updater<Note[]>) => void;
  setNoteColors: (v: Updater<Record<string, string>>) => void;
  setPinnedNotes: (v: Updater<Set<string>>) => void;
  setFolderColors: (v: Updater<Record<string, string>>) => void;
  setExpandedFolders: (v: Updater<Record<string, boolean>>) => void;
}

/**
 * Editor slice — the core editable note fields. Setters mirror useState so the
 * autosave/sync call sites (including functional updaters on `content`) work
 * unchanged. Timing refs (saveTimer/contentSaved/lastSaveTs) stay in `runtime`.
 */
export interface EditorSlice {
  activeNoteId: string | null;
  content: string;
  title: string;
  tags: string;
  saved: boolean;
  preview: boolean;

  setActiveNoteId: (v: Updater<string | null>) => void;
  setContent: (v: Updater<string>) => void;
  setTitle: (v: Updater<string>) => void;
  setTags: (v: Updater<string>) => void;
  setSaved: (v: Updater<boolean>) => void;
  setPreview: (v: Updater<boolean>) => void;
}

/**
 * The composed side panel store state. As each slice is extracted it is added
 * to this intersection type.
 */
export type SidePanelState = ContextSlice & SettingsSlice & NoteListSlice & EditorSlice;
