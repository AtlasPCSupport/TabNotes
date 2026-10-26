import React, { useEffect, useRef, useCallback } from 'react';
import {
  Note,
  NoteScope,
  type MoveNoteTarget,
  ChromeStorageAdapter,
  NotesService,
  WorkspacesService,
  normalizeDomain,
  stripFormatting,
  editorHtmlToPlainText,
  parseChecklistItems,
  serializeChecklist,
  checklistItemsToPlainText,
  isChecklistContent,
  generateId,
  type ChecklistItem,
} from '@tabnotes/shared';
import { useSidePanelStore } from './store';
import { ViewHost } from './views/ViewHost';
import { usePinLock } from './hooks/usePinLock';
import { useFolderManager } from './hooks/useFolderManager';
import { useChromeStorageAndTabs } from './hooks/useChromeStorageAndTabs';
import { useNoteActions } from './hooks/useNoteActions';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWorkspaceManager } from './hooks/useWorkspaceManager';
import { usePreferences } from './hooks/usePreferences';
import { useSidePanelUiState } from './hooks/useSidePanelUiState';
import { BottomNav } from './components/BottomNav';
import { ScopeBar } from './components/ScopeBar';
import { HeaderBar } from './components/HeaderBar';
import { ContextStrip } from './components/ContextStrip';
import { CaptureHub } from './components/CaptureHub';
import { NoteTree, type Template } from './components/NoteTree';
import { CommandPalette } from './components/CommandPalette';
import { EncryptionPrompt } from './components/EncryptionPrompt';
import { OnboardingDialog } from './components/OnboardingDialog';
import { VisibleAreaCropper } from './components/VisibleAreaCropper';
import { PendingReminders } from './components/PendingReminders';
import { AppIcon } from './components/AppIcon';
import { useTranslation } from '@tabnotes/i18n';
import { formatEditorDateTime } from './utils/dateTime';
import { insertTextAtSelection } from './utils/editorCommands';
import type { FloatingAction, FloatingRequest } from '../shared/floating';
import { Autosave } from './utils/autosave';
import { SCOPE_OPTIONS, templateDateLocale, templateFieldKey } from './sidepanelConfig';
import {
  DEFAULT_SNOOZE_MINUTES,
  OPEN_REMINDER_REQUEST_STORAGE_KEY,
  PENDING_REMINDERS_STORAGE_KEY,
  normalizePendingReminders,
  removePendingReminder,
} from '../shared/reminders';
import './sidepanel.css';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

const ONBOARDING_STORAGE_KEY = 'tn_onboarding_version';
const ONBOARDING_VERSION = 1;

interface RuntimeResponse {
  ok?: boolean;
  error?: string;
  reminderAt?: number;
  dataUrl?: string;
  text?: string;
  sourceUrl?: string;
  sourceTitle?: string;
}

function sendRuntimeMessage(message: Record<string, unknown>): Promise<RuntimeResponse | null> {
  return new Promise((resolve, reject) => {
    if (!cr?.runtime?.sendMessage) {
      resolve(null);
      return;
    }

    cr.runtime.sendMessage(message, (response: RuntimeResponse | undefined) => {
      const lastError = cr.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response ?? null);
    });
  });
}

const SCREENSHOT_DATA_URL_RE = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildScreenshotMarkup(dataUrl: string, label: string, timestamp: string): string | null {
  if (!SCREENSHOT_DATA_URL_RE.test(dataUrl)) return null;

  const alt = escapeHtmlAttribute(`${label} ${timestamp}`);
  return `<br><img src="${escapeHtmlAttribute(dataUrl)}" alt="${alt}"><br>`;
}

// ── Crypto utilities ──────────────────────────────────────────
// AES-256-GCM encryption now lives in @tabnotes/shared (crypto.ts), where it
// is unit-tested. encryptText / decryptText are imported above.

// ── Note graph component ──────────────────────────────────────
// Extracted to editor/NoteGraph.tsx (Task 3.1); imported above.

// ── Feature flags type now lives in store/types (DEFAULT_FEATURES imported) ──

export default function SidePanelApp() {
  const { t, i18n } = useTranslation();
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [cropSource, setCropSource] = React.useState<string | null>(null);
  const [captureFeedback, setCaptureFeedback] = React.useState<string | null>(null);
  const onCaptureFailure = useCallback(() => setCaptureFeedback(t('captureHub.failed')), [t]);
  const captureSourceRef = useRef<FloatingRequest | undefined>();
  type CaptureDestination = {
    id: string | null;
    activeId: string | null;
    url: string;
    scope: NoteScope;
    workspaceId: string | null;
  };
  const cropDestinationRef = useRef<CaptureDestination | null>(null);

  // Services
  const adapter = useRef(new ChromeStorageAdapter());
  const noteSvc = useRef(new NotesService(adapter.current));
  const wsSvc = useRef(new WorkspacesService(adapter.current));
  const autosave = useRef(new Autosave());
  const [saveError, setSaveError] = React.useState(false);
  const isDraftDirty = useCallback(() => autosave.current.hasPending(), []);
  const flushPendingSave = useCallback(async () => {
    try {
      await autosave.current.flush();
    } catch (error) {
      setSaveError(true);
      throw error;
    }
  }, []);
  const contentSavedRef = useRef(''); // last content persisted — dirty-check for cross-tab sync
  const lastSaveTs = useRef(0); // timestamp of our most recent save — skip our own writes

  // Refs for stable autosave (no stale closures)
  const activeNoteIdRef = useRef<string | null>(null);
  const scopeRef = useRef<NoteScope>('domain');
  const currentUrlRef = useRef('');
  const wsIdRef = useRef<string | null>(null);

  // Zustand Store Hooks / Selectors
  const view = useSidePanelStore((s) => s.view);
  const setView = useSidePanelStore((s) => s.setView);
  const theme = useSidePanelStore((s) => s.theme);
  const setPreview = useSidePanelStore((s) => s.setPreview);

  const currentUrl = useSidePanelStore((s) => s.currentUrl);
  const setCurrentUrl = useSidePanelStore((s) => s.setCurrentUrl);
  const setCurrentDomain = useSidePanelStore((s) => s.setCurrentDomain);

  const setContextNotes = useSidePanelStore((s) => s.setContextNotes);
  const workspaces = useSidePanelStore((s) => s.workspaces);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);

  const scope = useSidePanelStore((s) => s.scope);
  const setScope = useSidePanelStore((s) => s.setScope);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);
  const setActiveNoteId = useSidePanelStore((s) => s.setActiveNoteId);
  const content = useSidePanelStore((s) => s.content);
  const setContent = useSidePanelStore((s) => s.setContent);
  const title = useSidePanelStore((s) => s.title);
  const setTitle = useSidePanelStore((s) => s.setTitle);
  const tags = useSidePanelStore((s) => s.tags);
  const setTags = useSidePanelStore((s) => s.setTags);
  const setSaved = useSidePanelStore((s) => s.setSaved);
  const checklistMode = useSidePanelStore((s) => s.checklistMode);
  const setChecklistMode = useSidePanelStore((s) => s.setChecklistMode);
  const checklistItems = useSidePanelStore((s) => s.checklistItems);
  const setChecklistItems = useSidePanelStore((s) => s.setChecklistItems);

  const noteColors = useSidePanelStore((s) => s.noteColors);
  const setNoteColors = useSidePanelStore((s) => s.setNoteColors);
  const setPinnedNotes = useSidePanelStore((s) => s.setPinnedNotes);
  const setFolderColors = useSidePanelStore((s) => s.setFolderColors);
  const setExpandedFolders = useSidePanelStore((s) => s.setExpandedFolders);

  const setFontSizeState = useSidePanelStore((s) => s.setFontSizeState);
  const setDefaultAlignState = useSidePanelStore((s) => s.setDefaultAlignState);
  const setFeatures = useSidePanelStore((s) => s.setFeatures);

  // Quick-capture: ref so the storage.onChanged handler can call it without stale closure
  const addNoteToContextRef = useRef<() => Promise<void>>(async () => {});
  const floatingRequestRef = useRef<
    (action: FloatingAction, request?: FloatingRequest) => Promise<void>
  >(async () => {});

  // Rich editor ref (contentEditable div)
  const editorRef = useRef<HTMLDivElement>(null);

  // Invoke Chrome Storage and Tabs Synchronization hook
  const {
    loading,
    storageError,
    tabLoading,
    setTabLoading,
    streak,
    setStreak,
    digestEnabled,
    setDigestEnabled,
    digestTime,
    setDigestTime,
    backupRemindDays,
    setBackupRemindDays,
    isOnline,
    pendingSyncIds,
    setPendingSyncIds,
    syncedToast,
    clipFeedback,
    refreshAllNotes,
    loadContextNotes,
    saveDigest,
    appendClipToCurrentNote,
  } = useChromeStorageAndTabs({
    adapter,
    noteSvc,
    wsSvc,
    contentSavedRef,
    lastSaveTs,
    editorRef,
    activeNoteIdRef,
    scopeRef,
    currentUrlRef,
    wsIdRef,
    addNoteToContextRef,
    floatingRequestRef,
    flushPendingSave,
    isDraftDirty,
    onCaptureFailure,
  });

  // Local UI / Interactive States

  const importInputRef = useRef<HTMLInputElement>(null);

  // Invoke Note Actions hook (Import / Export / PDF / Encryption)
  const {
    dataFeedback,
    canRestoreImport,
    restorePreImportSnapshot,
    exportCurrentNote,
    exportToPDF,
    handleLockNote,
    handleUnlockNote,
    handleExport,
    handleImport,
  } = useNoteActions({
    flushPendingSave,
    contentSavedRef,
    adapter,
    noteSvc,
    wsSvc,
    refreshAllNotes,
    setContextNotes,
    scopeRef,
    currentUrlRef,
    wsIdRef,
    activeNoteIdRef,
    importInputRef,
    setBackupRemindDays,
  });

  // Ephemeral panel controls stay local to the panel and out of the persisted store.
  const {
    deletePillConfirmId,
    setDeletePillConfirmId,
    deleteCardConfirmId,
    setDeleteCardConfirmId,
    searchQ,
    setSearchQ,
    inboxOnly,
    setInboxOnly,
    contentFilter,
    setContentFilter,
    selectedId,
    setSelectedId,
    selectMode,
    setSelectMode,
    bulkSelectedIds,
    setBulkSelectedIds,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    collapsedScopes,
    toggleScope,
    tagFilter,
    setTagFilter,
    showEncPrompt,
    setShowEncPrompt,
    showHistory,
    setShowHistory,
    historyRef,
    showReminderPicker,
    setShowReminderPicker,
    reminderRef,
    reminderInput,
    setReminderInput,
    pendingReminders,
    setPendingReminders,
    refNoteId,
    setRefNoteId,
    showRefPanel,
    setShowRefPanel,
    showTemplates,
    setShowTemplates,
    templatesRef,
    colorPickerNoteId,
    setColorPickerNoteId,
  } = useSidePanelUiState();

  useEffect(() => {
    if (!cr?.storage?.local) return;
    cr.storage.local.get(ONBOARDING_STORAGE_KEY, (result: Record<string, unknown>) => {
      setShowOnboarding(result[ONBOARDING_STORAGE_KEY] !== ONBOARDING_VERSION);
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    cr?.storage?.local?.set({ [ONBOARDING_STORAGE_KEY]: ONBOARDING_VERSION });
  }, []);

  // Invoke PIN Lock hook
  const {
    pinHash,
    pinLocked,
    pinEntry,
    setPinEntry,
    pinError,
    setPinError,
    pinSetInput,
    setPinSetInput,
    pinSetConfirm,
    setPinSetConfirm,
    pinSetFeedback,
    savePin,
    removePin,
    lockNow,
    submitPinUnlock,
  } = usePinLock();

  // ── Note Selection Callback ──
  const hydrateChecklistForContent = useCallback(
    (noteContent: string) => {
      const plainContent = editorHtmlToPlainText(noteContent);
      const isChecklist = isChecklistContent(plainContent);
      setChecklistMode(isChecklist);
      setChecklistItems(isChecklist ? parseChecklistItems(plainContent) : []);
    },
    [setChecklistItems, setChecklistMode]
  );

  const selectNote = useCallback(
    async (n: Note) => {
      setTabLoading(true);
      try {
        await flushPendingSave();
        n = await noteSvc.current.getEditorNote(n);
        useSidePanelStore.setState({
          noteUnlocked: noteSvc.current.isUnlocked(n.id),
          editorVersions:
            n.encrypted && !noteSvc.current.isUnlocked(n.id) ? [] : (n.versions ?? []),
        });
        setActiveNoteId(n.id);
        activeNoteIdRef.current = n.id;
        contentSavedRef.current = n.content;
        hydrateChecklistForContent(n.content);
        setContent(n.content);
        setTitle(stripFormatting(n.title ?? ''));
        setTags(n.tags.join(', '));
        setSaved(false);
        setPreview(false);
      } finally {
        setTabLoading(false);
      }
    },
    [
      hydrateChecklistForContent,
      setActiveNoteId,
      setContent,
      setTitle,
      setTags,
      setSaved,
      flushPendingSave,
      setTabLoading,
      setPreview,
    ]
  );

  // Invoke Folder Manager hook
  const {
    showNewFolder,
    setShowNewFolder,
    newFolderName,
    setNewFolderName,
    showMovePicker,
    setShowMovePicker,
    newFolderRef,
    folderMenuRef,
    dragOverFolder,
    isDragging,
    createFolder,
    renameFolder,
    deleteFolder,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFolderManager({
    currentUrlRef,
    scopeRef,
    wsIdRef,
    noteSvc,
    adapter,
    selectNote,
    refreshAllNotes,
    setContextNotes,
  });

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);
  useEffect(() => {
    currentUrlRef.current = currentUrl;
  }, [currentUrl]);
  // Invoke Workspace and Reminder manager hook
  const {
    editWsName,
    setEditWsName,
    editWsColor,
    setEditWsColor,
    newWsNameInput,
    setNewWsNameInput,
    newWsColorInput,
    setNewWsColorInput,
    wsDropdown,
    setWsDropdown,
    wsDropdownRef,
    onSetActiveWorkspace,
    onSwitchWorkspace,
    onUpdateWorkspace,
    onDeleteWorkspace,
    onCreateWorkspace,
    onSetReminder,
    onClearReminder,
  } = useWorkspaceManager({
    flushPendingSave,
    wsSvc,
    noteSvc,
    wsIdRef,
    activeNoteId,
    currentUrlRef,
    scopeRef,
    refreshAllNotes,
    loadContextNotes,
  });

  // Invoke Preferences hook
  const {
    copied,
    focusMode,
    setFocusMode,
    setTheme,
    setMarkdown,
    setDefaultScope,
    copyNote,
    togglePin,
    changeFontSize,
    setDefaultAlign,
    toggleFeature,
    language,
    setLanguage,
  } = usePreferences({
    adapter,
    title,
    content,
  });

  const openPendingReminder = useCallback(
    async (noteId: string, dismiss = true) => {
      await flushPendingSave();

      const notes = await refreshAllNotes();
      const note = notes.find((candidate) => candidate.id === noteId);
      if (!note) {
        if (dismiss) {
          setPendingReminders((prev) => removePendingReminder(prev, noteId));
          await sendRuntimeMessage({ type: 'DISMISS_REMINDER', noteId }).catch(() => null);
        }
        return;
      }

      if (note.workspaceId !== wsIdRef.current) {
        await onSetActiveWorkspace(note.workspaceId ?? null);
      }

      setScope(note.scope);
      scopeRef.current = note.scope;

      const contextForNote = notes
        .filter(
          (candidate) =>
            candidate.scope === note.scope &&
            candidate.scopeKey === note.scopeKey &&
            candidate.workspaceId === (note.workspaceId ?? null)
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      setContextNotes(contextForNote);

      if (note.scope === 'url') {
        setCurrentUrl(note.scopeKey);
        currentUrlRef.current = note.scopeKey;
        setCurrentDomain(normalizeDomain(note.scopeKey));
      } else if (note.scope === 'domain') {
        const contextUrl = `https://${note.scopeKey}/`;
        setCurrentUrl(contextUrl);
        currentUrlRef.current = contextUrl;
        setCurrentDomain(note.scopeKey);
      }

      selectNote(note);
      setView('note');
      setShowRefPanel(false);

      if (dismiss) {
        setPendingReminders((prev) => removePendingReminder(prev, noteId));
        await sendRuntimeMessage({ type: 'DISMISS_REMINDER', noteId }).catch(() => null);
      }

      setTimeout(() => editorRef.current?.focus(), 120);
    },
    [
      refreshAllNotes,
      onSetActiveWorkspace,
      setScope,
      setContextNotes,
      setCurrentUrl,
      setCurrentDomain,
      selectNote,
      setView,
      setShowRefPanel,
      setPendingReminders,
      flushPendingSave,
    ]
  );

  const dismissPendingReminder = useCallback(
    async (noteId: string) => {
      setPendingReminders((prev) => removePendingReminder(prev, noteId));
      await sendRuntimeMessage({ type: 'DISMISS_REMINDER', noteId }).catch(() => null);
    },
    [setPendingReminders]
  );

  const snoozePendingReminder = useCallback(
    async (noteId: string) => {
      setPendingReminders((prev) => removePendingReminder(prev, noteId));
      const response = await sendRuntimeMessage({
        type: 'SNOOZE_REMINDER',
        noteId,
        minutes: DEFAULT_SNOOZE_MINUTES,
      }).catch(() => null);

      if (response?.ok === false) {
        await dismissPendingReminder(noteId);
        return;
      }

      await refreshAllNotes();
    },
    [dismissPendingReminder, refreshAllNotes, setPendingReminders]
  );

  useEffect(() => {
    if (!cr?.storage?.local) return;

    cr.storage.local.get(
      [PENDING_REMINDERS_STORAGE_KEY, OPEN_REMINDER_REQUEST_STORAGE_KEY],
      (result: Record<string, unknown>) => {
        setPendingReminders(normalizePendingReminders(result[PENDING_REMINDERS_STORAGE_KEY]));
        const request = result[OPEN_REMINDER_REQUEST_STORAGE_KEY] as
          | { noteId?: unknown }
          | undefined;
        if (typeof request?.noteId === 'string') {
          openPendingReminder(request.noteId);
          cr.storage.local.remove(OPEN_REMINDER_REQUEST_STORAGE_KEY);
        }
      }
    );

    const handler = (
      changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
      area: string
    ) => {
      if (area !== 'local') return;

      if (changes[PENDING_REMINDERS_STORAGE_KEY]) {
        setPendingReminders(
          normalizePendingReminders(changes[PENDING_REMINDERS_STORAGE_KEY].newValue)
        );
      }

      const request = changes[OPEN_REMINDER_REQUEST_STORAGE_KEY]?.newValue as
        | { noteId?: unknown }
        | undefined;
      if (typeof request?.noteId === 'string') {
        openPendingReminder(request.noteId);
        cr.storage.local.remove(OPEN_REMINDER_REQUEST_STORAGE_KEY);
      }
    };

    cr.storage.onChanged.addListener(handler);
    return () => cr.storage.onChanged.removeListener(handler);
  }, [openPendingReminder, setPendingReminders]);

  // ── Load extra prefs from localStorage ───────────────────────
  useEffect(() => {
    try {
      const colors = localStorage.getItem('tn_colors');
      if (colors) setNoteColors(JSON.parse(colors));
      const pins = localStorage.getItem('tn_pins');
      if (pins) setPinnedNotes(new Set(JSON.parse(pins)));
      const fs = localStorage.getItem('tn_fontsize');
      if (fs) setFontSizeState(Number(fs));
      const al = localStorage.getItem('tn_align') as 'left' | 'center' | 'right' | null;
      if (al) setDefaultAlignState(al);
      const ft = localStorage.getItem('tn_features');
      if (ft) setFeatures((prev) => ({ ...prev, ...JSON.parse(ft) }));
      const fColors = localStorage.getItem('tn_folder_colors');
      if (fColors) setFolderColors(JSON.parse(fColors));
    } catch {
      /* ignore */
    }
  }, [
    setNoteColors,
    setPinnedNotes,
    setFontSizeState,
    setDefaultAlignState,
    setFeatures,
    setFolderColors,
  ]);

  // ── Click outside → close templates dropdown ─────────────────
  useEffect(() => {
    if (!showTemplates) return;
    const handle = (e: MouseEvent) => {
      if (!templatesRef.current?.contains(e.target as Node)) setShowTemplates(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showTemplates, setShowTemplates, templatesRef]);

  // ── Click outside → close color picker ───────────────────────
  useEffect(() => {
    if (!colorPickerNoteId) return;
    const handle = (e: MouseEvent) => {
      const el = document.querySelector('.sp-color-picker');
      if (el && !el.contains(e.target as Node)) setColorPickerNoteId(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [colorPickerNoteId, setColorPickerNoteId]);

  // ── Scope switch ──────────────────────────────────────────────
  const handleScopeChange = async (s: NoteScope) => {
    await flushPendingSave();
    setScope(s);
    scopeRef.current = s;
    setPreview(false);
    await loadContextNotes(currentUrlRef.current, s, wsIdRef.current);
    await refreshAllNotes();
  };

  const updateStreak = React.useCallback(async () => {
    if (!cr?.storage?.local) return;
    const today = new Date().toISOString().split('T')[0];
    const sr = await new Promise<Record<string, unknown>>((res) =>
      cr.storage.local.get('tn_streak', res)
    );
    const s = sr['tn_streak'] as { count?: number; lastDate?: string } | undefined;
    if (s?.lastDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const newCount = s?.lastDate === yStr ? (s.count ?? 0) + 1 : 1;
    await new Promise<void>((res) =>
      cr.storage.local.set({ tn_streak: { count: newCount, lastDate: today } }, res)
    );
    setStreak(newCount);
  }, [setStreak]);

  const addNoteToContext = async (folderName?: string) => {
    await flushPendingSave();
    const url = currentUrlRef.current;
    if (!url || url.startsWith('chrome://')) return;
    const folder = folderName || undefined;
    const created = await noteSvc.current.createNote({
      scope: scopeRef.current,
      url,
      workspaceId: wsIdRef.current,
      folder,
    });
    if (folder) {
      setExpandedFolders((prev) => ({ ...prev, [folder]: true }));
    }
    const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
    setContextNotes(notes);
    await selectNote(created);
    await refreshAllNotes();
    updateStreak();
  };
  addNoteToContextRef.current = addNoteToContext;

  // ── Autosave — uses refs, never stale ────────────────────────
  const saveNote = useCallback(
    async (
      c: string,
      t: string,
      tg: string,
      context = {
        id: activeNoteIdRef.current,
        url: currentUrlRef.current,
        scope: scopeRef.current,
        workspaceId: wsIdRef.current,
      }
    ) => {
      const id = context.id;
      const parsedTags = tg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      let saved: Note | null = null;

      if (id) {
        saved = await noteSvc.current.updateNote(id, {
          content: c,
          title: t || undefined,
          tags: parsedTags,
        });
      }
      if (!saved) {
        const url = context.url;
        if (!url || url.startsWith('chrome://')) return;
        saved = await noteSvc.current.createNote({
          id: id ?? undefined,
          scope: context.scope,
          url,
          workspaceId: context.workspaceId,
          content: c,
          title: t || undefined,
          tags: parsedTags,
        });
      }

      const stillActive =
        activeNoteIdRef.current === id &&
        currentUrlRef.current === context.url &&
        scopeRef.current === context.scope &&
        wsIdRef.current === context.workspaceId;
      if (saved && stillActive) {
        activeNoteIdRef.current = saved.id;
        setActiveNoteId(saved.id);
        // Refresh context notes to reflect updated title in pill
        const url = currentUrlRef.current;
        const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
        setContextNotes(notes);
        const editorNote = await noteSvc.current.getEditorNote(saved);
        useSidePanelStore.setState({ editorVersions: editorNote.versions ?? [] });
      }

      // Track what we just saved so cross-tab sync can tell it's not a remote change
      if (stillActive) contentSavedRef.current = c;
      lastSaveTs.current = Date.now();

      // Track offline queue — note saved locally; will "sync" when reconnected
      if (!navigator.onLine && saved?.id) {
        setPendingSyncIds((prev) => new Set([...prev, saved.id]));
      }

      setSaved(true);
      setSaveError(false);
      await refreshAllNotes();
      updateStreak();
      setTimeout(() => setSaved(false), 2000);
    },
    [refreshAllNotes, updateStreak, setContextNotes, setActiveNoteId, setSaved, setPendingSyncIds]
  );

  const moveNote = useCallback(
    async (noteId: string, target: MoveNoteTarget) => {
      await flushPendingSave();

      // Flush pending editor changes before relocating a currently open note.
      if (activeNoteIdRef.current === noteId) {
        await saveNote(content, title, tags);
      }

      const moved = await noteSvc.current.moveNote(noteId, target);
      if (!moved) return;

      const destinationWorkspaceId = moved.workspaceId ?? null;
      if (destinationWorkspaceId !== wsIdRef.current) {
        await onSetActiveWorkspace(destinationWorkspaceId);
      } else {
        wsIdRef.current = destinationWorkspaceId;
      }

      setScope(moved.scope);
      scopeRef.current = moved.scope;

      let contextUrl = currentUrlRef.current;
      if (moved.scope === 'url') {
        contextUrl = moved.scopeKey;
        setCurrentDomain(normalizeDomain(contextUrl));
      } else if (moved.scope === 'domain') {
        contextUrl = `https://${moved.scopeKey}/`;
        setCurrentDomain(moved.scopeKey);
      } else if (!contextUrl) {
        contextUrl = 'https://tabnotes.local/';
      }

      setCurrentUrl(contextUrl);
      currentUrlRef.current = contextUrl;

      await loadContextNotes(contextUrl, moved.scope, destinationWorkspaceId, moved.id);
      const movedInContext = useSidePanelStore
        .getState()
        .contextNotes.find((note) => note.id === moved.id);
      selectNote(movedInContext ?? moved);

      await refreshAllNotes();
    },
    [
      content,
      title,
      tags,
      saveNote,
      flushPendingSave,
      onSetActiveWorkspace,
      setScope,
      setCurrentDomain,
      setCurrentUrl,
      loadContextNotes,
      selectNote,
      refreshAllNotes,
    ]
  );

  const schedule = useCallback(
    (c: string, t: string, tg: string) => {
      setSaved(false);
      const id = activeNoteIdRef.current ?? generateId();
      activeNoteIdRef.current = id;
      const context = {
        id,
        url: currentUrlRef.current,
        scope: scopeRef.current,
        workspaceId: wsIdRef.current,
      };
      autosave.current.schedule(
        () => saveNote(c, t, tg, context),
        () => setSaveError(true)
      );
    },
    [saveNote, setSaved]
  );

  // ── Checklist mode (Google Keep style) ─────────────────────────
  const saveChecklist = useCallback(
    (items: ChecklistItem[]) => {
      const nextContent = serializeChecklist(items);
      setContent(nextContent);
      schedule(nextContent, title, tags);
    },
    [schedule, setContent, tags, title]
  );

  const toggleChecklistMode = useCallback(() => {
    if (checklistMode) {
      const nextContent = checklistItemsToPlainText(checklistItems);
      setChecklistMode(false);
      setChecklistItems([]);
      setContent(nextContent);
      schedule(nextContent, title, tags);
      return;
    }

    const items = parseChecklistItems(editorHtmlToPlainText(content));
    setChecklistMode(true);
    setChecklistItems(items);
    saveChecklist(items);
  }, [
    checklistItems,
    checklistMode,
    content,
    saveChecklist,
    schedule,
    setChecklistItems,
    setChecklistMode,
    setContent,
    tags,
    title,
  ]);

  // ── Screenshot capture ───────────────────────────────────────
  const appendScreenshot = async (
    dataUrl: string,
    label: string,
    destination: CaptureDestination
  ) => {
    await flushPendingSave();
    const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    const insert = buildScreenshotMarkup(dataUrl, label, ts);
    if (!insert) throw new Error('INVALID_IMAGE');
    const current = destination.id
      ? (await noteSvc.current.getAllNotes()).find((note) => note.id === destination.id)
      : null;
    if (destination.id && !current) throw new Error('NOTE_REMOVED');
    const editorNote = current ? await noteSvc.current.getEditorNote(current) : null;
    const saved = editorNote
      ? await noteSvc.current.updateNote(editorNote.id, { content: editorNote.content + insert })
      : await noteSvc.current.createNote({
          scope: destination.scope,
          url: destination.url,
          workspaceId: destination.workspaceId,
          content: insert,
        });
    if (
      saved &&
      activeNoteIdRef.current === destination.activeId &&
      currentUrlRef.current === destination.url &&
      scopeRef.current === destination.scope &&
      wsIdRef.current === destination.workspaceId
    ) {
      setContextNotes(
        await noteSvc.current.getNotesByScope(
          destination.scope,
          destination.url,
          destination.workspaceId
        )
      );
      await selectNote(saved);
    }
    await refreshAllNotes();
    setCaptureFeedback(t('captureHub.saved'));
  };

  const startCapture = async (crop: boolean, target: 'current' | 'new' = 'current') => {
    const destination = {
      id: target === 'new' ? null : activeNoteIdRef.current,
      activeId: activeNoteIdRef.current,
      url: currentUrlRef.current,
      scope: scopeRef.current,
      workspaceId: wsIdRef.current,
    };
    const source = captureSourceRef.current;
    setCaptureFeedback(t('captureHub.capturing'));
    try {
      await flushPendingSave();
      // A first draft receives its ID during flush.
      if (target === 'current' && !destination.id) {
        destination.id = activeNoteIdRef.current;
        destination.activeId = activeNoteIdRef.current;
      }
      const window = await cr.windows.getCurrent();
      const response = await sendRuntimeMessage({
        type: 'CAPTURE_TAB',
        sourceUrl: destination.url,
        tabId: source?.tabId,
        windowId: source?.windowId ?? window.id,
      });
      if (!response?.dataUrl || response.error)
        throw new Error(response?.error || 'CAPTURE_FAILED');
      if (crop) {
        cropDestinationRef.current = destination;
        setCropSource(response.dataUrl);
        setCaptureFeedback(null);
      } else await appendScreenshot(response.dataUrl, 'Screenshot', destination);
    } catch {
      setCaptureFeedback(t('captureHub.failed'));
    }
  };
  const captureScreenshot = () => {
    void startCapture(false);
  };

  const requestSelectionPermission = useCallback((): Promise<boolean> => {
    const url = currentUrlRef.current;
    if (!cr?.permissions?.request) return Promise.resolve(true);
    try {
      const page = new URL(url);
      if (page.protocol !== 'http:' && page.protocol !== 'https:') return Promise.resolve(false);
      return new Promise((resolve) => {
        cr.permissions.request(
          { origins: [`${page.protocol}//${page.host}/*`] },
          (granted: boolean) => resolve(granted)
        );
      });
    } catch {
      return Promise.resolve(false);
    }
  }, [currentUrlRef]);

  const clipSelection = useCallback(
    async (target: 'current' | 'new') => {
      if (!(await requestSelectionPermission())) {
        setCaptureFeedback(t('captureHub.permissionDenied'));
        return;
      }
      const response = await sendRuntimeMessage({
        type: 'GET_SELECTED_TEXT',
        sourceUrl: currentUrlRef.current,
        tabId: captureSourceRef.current?.tabId,
        windowId: captureSourceRef.current?.windowId,
      });
      const text = response?.text?.trim();
      if (response?.error) {
        setCaptureFeedback(t('captureHub.failed'));
        return;
      }
      if (!text) {
        setCaptureFeedback(t('captureHub.noSelection'));
        return;
      }
      await appendClipToCurrentNote(
        {
          text,
          sourceUrl: response?.sourceUrl || currentUrlRef.current,
          sourceTitle: response?.sourceTitle,
        },
        target
      );
    },
    [appendClipToCurrentNote, currentUrlRef, requestSelectionPermission, t]
  );

  const saveCroppedScreenshot = async (dataUrl: string) => {
    const destination = cropDestinationRef.current;
    if (!destination) return;
    try {
      await appendScreenshot(dataUrl, 'Cropped screenshot', destination);
      setCropSource(null);
      cropDestinationRef.current = null;
    } catch (error) {
      setCaptureFeedback(t('captureHub.failed'));
      throw error;
    }
  };

  floatingRequestRef.current = async (action, request) => {
    captureSourceRef.current = request;
    setView('note');
    try {
      if (action === 'new-note') await addNoteToContextRef.current();
      else if (action === 'clip-current' || action === 'clip-new')
        await clipSelection(action === 'clip-new' ? 'new' : 'current');
      else
        await startCapture(action.startsWith('crop'), action.endsWith('-new') ? 'new' : 'current');
    } catch {
      setCaptureFeedback(t('captureHub.failed'));
    } finally {
      captureSourceRef.current = undefined;
    }
  };

  // Export to PDF is handled by useNoteActions hook

  // Note encryption is handled by useNoteActions hook

  // Daily digest saving is handled by useChromeStorageAndTabs hook

  // ── Bulk delete selected notes ────────────────────────────────
  const bulkDeleteNotes = async () => {
    await flushPendingSave();
    const ids = Array.from(bulkSelectedIds);
    await Promise.all(ids.map((id) => noteSvc.current.deleteNote(id)));
    setBulkSelectedIds(new Set());
    setBulkDeleteConfirm(false);
    setSelectMode(false);
    // If active note was deleted, reset editor
    if (bulkSelectedIds.has(activeNoteIdRef.current ?? '')) {
      const url = currentUrlRef.current;
      const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
      setContextNotes(notes);
      const next = notes[0] ?? null;
      activeNoteIdRef.current = next?.id ?? null;
      contentSavedRef.current = next?.content ?? '';
      setActiveNoteId(next?.id ?? null);
      setContent(next?.content ?? '');
      setTitle(next?.title ?? '');
      setTags(next?.tags.join(', ') ?? '');
      hydrateChecklistForContent(next?.content ?? '');
      setSaved(false);
    }
    await refreshAllNotes();
  };

  // ── Delete note by id (from list card) ───────────────────────
  const deleteCardNote = async (id: string) => {
    await flushPendingSave();
    await noteSvc.current.deleteNote(id);
    setDeleteCardConfirmId(null);
    // If we deleted the active note, clear editor
    if (id === activeNoteIdRef.current) {
      const url = currentUrlRef.current;
      const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
      setContextNotes(notes);
      const next = notes[0] ?? null;
      activeNoteIdRef.current = next?.id ?? null;
      contentSavedRef.current = next?.content ?? '';
      setActiveNoteId(next?.id ?? null);
      setContent(next?.content ?? '');
      setTitle(next?.title ?? '');
      setTags(next?.tags.join(', ') ?? '');
      hydrateChecklistForContent(next?.content ?? '');
      setSaved(false);
    }
    await refreshAllNotes();
  };

  // ── Delete note by id (from pill ×) ──────────────────────────
  const deletePillNote = async (id: string) => {
    await flushPendingSave();
    await noteSvc.current.deleteNote(id);
    const url = currentUrlRef.current;
    const notes = await noteSvc.current.getNotesByScope(scopeRef.current, url, wsIdRef.current);
    setContextNotes(notes);
    setDeletePillConfirmId(null);
    // If we deleted the active note, switch to first remaining
    if (id === activeNoteIdRef.current) {
      const next = notes[0] ?? null;
      activeNoteIdRef.current = next?.id ?? null;
      contentSavedRef.current = next?.content ?? '';
      setActiveNoteId(next?.id ?? null);
      setContent(next?.content ?? '');
      setTitle(next?.title ?? '');
      setTags(next?.tags.join(', ') ?? '');
      hydrateChecklistForContent(next?.content ?? '');
      setSaved(false);
    }
    await refreshAllNotes();
  };

  // ── Insert date/time at cursor ────────────────────────────────
  const insertDatetime = () => {
    const el = editorRef.current;
    const str = formatEditorDateTime();
    if (el) {
      insertTextAtSelection(el, str);
      const html = el.innerHTML;
      setContent(html);
      schedule(html, title, tags);
    } else {
      const next = content + (content ? '\n' : '') + str;
      setContent(next);
      schedule(next, title, tags);
    }
  };

  // Keyboard Shortcuts Hook
  useKeyboardShortcuts({
    content,
    title,
    tags,
    focusMode,
    setFocusMode,
    saveNote: flushPendingSave,
    insertDatetime,
  });

  // Exporting is handled by useNoteActions hook

  // ── Note color ────────────────────────────────────────────────
  const setNoteColor = (noteId: string, color: string) => {
    const next = { ...noteColors };
    if (color) next[noteId] = color;
    else delete next[noteId];
    setNoteColors(next);
    localStorage.setItem('tn_colors', JSON.stringify(next));
    setColorPickerNoteId(null);
  };

  // Folder operations are handled by useFolderManager hook

  // ── Apply template ────────────────────────────────────────────
  const applyTemplate = (tpl: Template) => {
    let newTitle = t(templateFieldKey(tpl.id, 'title'));
    let newContent = t(templateFieldKey(tpl.id, 'content'));

    if (tpl.dynamic) {
      const d = new Date();
      const activeLanguage = i18n.resolvedLanguage || i18n.language || language;
      newTitle = d.toLocaleDateString(templateDateLocale(activeLanguage), {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      newContent = t(templateFieldKey(tpl.id, 'content'), { date: newTitle });
    }

    setTitle(newTitle);
    setContent(newContent);
    schedule(newContent, newTitle, tags);
    setShowTemplates(false);
    setTimeout(() => editorRef.current?.focus(), 50);
  };

  // ── Export / Import ───────────────────────────────────────────
  // Import/Export and feedback are handled by useNoteActions hook

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const isRestrictedUrl =
    !currentUrl ||
    currentUrl.startsWith('chrome://') ||
    currentUrl.startsWith('chrome-extension://');

  useEffect(() => {
    const flush = () => {
      void flushPendingSave().catch(() => setSaveError(true));
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, [flushPendingSave]);

  if (storageError)
    return (
      <div className="sp-root" role="alert">
        <p>{t('editor.storageFailed')}</p>
        <button type="button" onClick={() => location.reload()}>
          {t('editor.retrySave')}
        </button>
      </div>
    );

  if (loading) {
    return (
      <div className="sp-loading">
        <div className="sp-spinner" />
        <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{t('common.loading')}</span>
      </div>
    );
  }

  // PIN lock management is handled by usePinLock hook

  if (pinLocked && pinHash) {
    return (
      <div className="sp-root">
        <div className="sp-pin-lock">
          <div className="sp-pin-lock-icon">
            <AppIcon name="lock" size={30} />
          </div>
          <div className="sp-pin-lock-title">{t('pin.locked')}</div>
          <div className="sp-pin-lock-desc">{t('pin.enterPin')}</div>
          <form
            className="sp-pin-lock-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitPinUnlock();
            }}
          >
            <input
              className="sp-pin-lock-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pinEntry}
              placeholder={t('pin.enterPinPlaceholder')}
              onChange={(e) => {
                setPinEntry(e.target.value);
                setPinError('');
              }}
            />
            <button type="submit" className="sp-pin-lock-btn" disabled={!pinEntry}>
              {t('pin.unlock')}
            </button>
          </form>
          {pinError && <div className="sp-pin-lock-error">{pinError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`sp-root${focusMode ? ' focus-mode' : ''}`}>
      {captureFeedback && (
        <div role="status" className="sp-data-feedback">
          {captureFeedback}
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => setCaptureFeedback(null)}
          >
            ×
          </button>
        </div>
      )}
      {saveError && (
        <div role="alert" className="sp-data-feedback error">
          {t('editor.saveFailed')}
          <button
            type="button"
            onClick={() =>
              void flushPendingSave()
                .then(() => setSaveError(false))
                .catch(() => setSaveError(true))
            }
          >
            {t('editor.retrySave')}
          </button>
        </div>
      )}
      {/* ── Header ── */}
      <HeaderBar
        activeWs={activeWs}
        wsDropdown={wsDropdown}
        setWsDropdown={setWsDropdown}
        wsDropdownRef={wsDropdownRef}
        onSwitchWorkspace={onSwitchWorkspace}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        tabLoading={tabLoading}
        streak={streak}
        isOnline={isOnline}
        pendingSyncCount={pendingSyncIds.size}
        syncedToast={syncedToast}
        language={language}
        setLanguage={setLanguage}
        onOpenOnboarding={() => setShowOnboarding(true)}
      />

      {/* ── Scope bar ── */}
      {view === 'note' && (
        <ScopeBar
          scopeOptions={SCOPE_OPTIONS}
          onScopeChange={handleScopeChange}
          tabLoading={tabLoading}
        />
      )}

      {/* ── Context strip ── */}
      {view === 'note' && <ContextStrip tabLoading={tabLoading} />}

      {view === 'note' && (
        <CaptureHub
          disabled={isRestrictedUrl || tabLoading}
          onNewNote={addNoteToContext}
          onCaptureScreenshot={(target) => {
            void startCapture(false, target);
          }}
          onCaptureArea={(target) => {
            void startCapture(true, target);
          }}
          onClipSelection={clipSelection}
        />
      )}

      <PendingReminders
        reminders={pendingReminders}
        onOpen={openPendingReminder}
        onSnooze={snoozePendingReminder}
        onDismiss={dismissPendingReminder}
      />

      {/* ── Main Layout (Sidebar Tree + Content) ── */}
      <div className="sp-main-layout">
        {!isRestrictedUrl && (
          <NoteTree
            tabLoading={tabLoading}
            isDragging={isDragging}
            dragOverFolder={dragOverFolder}
            showNewFolder={showNewFolder}
            setShowNewFolder={setShowNewFolder}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            newFolderRef={newFolderRef}
            templatesRef={templatesRef}
            showTemplates={showTemplates}
            setShowTemplates={setShowTemplates}
            folderMenuRef={folderMenuRef}
            renameFolder={renameFolder}
            deleteFolder={deleteFolder}
            createFolder={createFolder}
            applyTemplate={applyTemplate}
            addNoteToContext={addNoteToContext}
            selectNote={selectNote}
            deletePillNote={deletePillNote}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            deletePillConfirmId={deletePillConfirmId}
            setDeletePillConfirmId={setDeletePillConfirmId}
          />
        )}

        <ViewHost
          tabLoading={tabLoading}
          isRestrictedUrl={isRestrictedUrl}
          selectNote={selectNote}
          checklistMode={checklistMode}
          checklistItems={checklistItems}
          setChecklistItems={setChecklistItems}
          toggleChecklistMode={toggleChecklistMode}
          saveChecklist={saveChecklist}
          editorRef={editorRef}
          onSetReminder={onSetReminder}
          onClearReminder={onClearReminder}
          setShowReminderPicker={setShowReminderPicker}
          setShowHistory={setShowHistory}
          showRefPanel={showRefPanel}
          setShowRefPanel={setShowRefPanel}
          setShowEncPrompt={setShowEncPrompt}
          insertDatetime={insertDatetime}
          copyNote={copyNote}
          clipFeedback={clipFeedback}
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          colorPickerNoteId={colorPickerNoteId}
          setColorPickerNoteId={setColorPickerNoteId}
          onSetNoteColor={setNoteColor}
          schedule={schedule}
          showMovePicker={showMovePicker}
          setShowMovePicker={setShowMovePicker}
          moveNote={moveNote}
          copied={copied}
          showHistory={showHistory}
          historyRef={historyRef}
          showReminderPicker={showReminderPicker}
          reminderRef={reminderRef}
          reminderInput={reminderInput}
          setReminderInput={setReminderInput}
          exportCurrentNote={exportCurrentNote}
          exportToPDF={exportToPDF}
          captureScreenshot={captureScreenshot}
          refNoteId={refNoteId}
          setRefNoteId={setRefNoteId}
          searchQ={searchQ}
          setSearchQ={setSearchQ}
          inboxOnly={inboxOnly}
          setInboxOnly={setInboxOnly}
          contentFilter={contentFilter}
          setContentFilter={setContentFilter}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          tagFilter={tagFilter}
          setTagFilter={setTagFilter}
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          bulkSelectedIds={bulkSelectedIds}
          setBulkSelectedIds={setBulkSelectedIds}
          bulkDeleteConfirm={bulkDeleteConfirm}
          setBulkDeleteConfirm={setBulkDeleteConfirm}
          collapsedScopes={collapsedScopes}
          toggleScope={toggleScope}
          deleteCardConfirmId={deleteCardConfirmId}
          setDeleteCardConfirmId={setDeleteCardConfirmId}
          deleteCardNote={deleteCardNote}
          bulkDeleteNotes={bulkDeleteNotes}
          addNoteToContext={addNoteToContext}
          togglePin={togglePin}
          toggleFeature={toggleFeature}
          setTheme={setTheme}
          pinHash={pinHash}
          pinSetInput={pinSetInput}
          setPinSetInput={setPinSetInput}
          pinSetConfirm={pinSetConfirm}
          setPinSetConfirm={setPinSetConfirm}
          pinSetFeedback={pinSetFeedback}
          savePin={savePin}
          removePin={removePin}
          lockNow={lockNow}
          setMarkdown={setMarkdown}
          changeFontSize={changeFontSize}
          setDefaultAlign={setDefaultAlign}
          setDefaultScope={setDefaultScope}
          digestEnabled={digestEnabled}
          setDigestEnabled={setDigestEnabled}
          digestTime={digestTime}
          setDigestTime={setDigestTime}
          saveDigest={saveDigest}
          editWsName={editWsName}
          setEditWsName={setEditWsName}
          editWsColor={editWsColor}
          setEditWsColor={setEditWsColor}
          newWsNameInput={newWsNameInput}
          setNewWsNameInput={setNewWsNameInput}
          newWsColorInput={newWsColorInput}
          setNewWsColorInput={setNewWsColorInput}
          onSetActiveWorkspace={onSetActiveWorkspace}
          onUpdateWorkspace={onUpdateWorkspace}
          onDeleteWorkspace={onDeleteWorkspace}
          onCreateWorkspace={onCreateWorkspace}
          handleExport={handleExport}
          handleImport={handleImport}
          importInputRef={importInputRef}
          dataFeedback={dataFeedback}
          canRestoreImport={canRestoreImport}
          restorePreImportSnapshot={restorePreImportSnapshot}
          backupRemindDays={backupRemindDays}
          setBackupRemind={(days) => {
            setBackupRemindDays(days);
            cr?.storage?.local?.set({ tn_backup_remind: { days } });
            cr?.runtime?.sendMessage({ type: 'SET_BACKUP_REMIND', days });
          }}
          language={language}
          setLanguage={setLanguage}
        />
      </div>

      <CommandPalette
        setFocusMode={setFocusMode}
        addNoteToContext={addNoteToContext}
        selectNote={selectNote}
        captureScreenshot={captureScreenshot}
        exportToPDF={exportToPDF}
        handleScopeChange={handleScopeChange}
        loadContextNotes={loadContextNotes}
        currentUrlRef={currentUrlRef}
        scopeRef={scopeRef}
        wsIdRef={wsIdRef}
      />

      <EncryptionPrompt
        showEncPrompt={showEncPrompt}
        setShowEncPrompt={setShowEncPrompt}
        onLockNote={handleLockNote}
        onUnlockNote={handleUnlockNote}
      />

      <OnboardingDialog open={showOnboarding} onComplete={completeOnboarding} />

      <VisibleAreaCropper
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onSave={saveCroppedScreenshot}
      />

      {/* ── Bottom nav ── */}
      <BottomNav />
    </div>
  );
}
