import React, { useState, useEffect, useCallback } from 'react';
import {
  Note,
  NoteScope,
  ChromeStorageAdapter,
  NotesService,
  WorkspacesService,
  StorageData,
  normalizeDomain,
  stripFormatting,
  editorHtmlToPlainText,
  isChecklistContent,
  parseChecklistItems,
  withStorageLock,
} from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import i18n, { resolveLanguage } from '@tabnotes/i18n';
import {
  FLOATING_REQUEST_STORAGE_KEY,
  normalizeFloatingAction,
  type FloatingAction,
  type FloatingRequest,
} from '../../shared/floating';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

const PENDING_CLIP_STORAGE_KEY = 'tn_pending_clip';
const DRIVE_SYNC_REQUEST_MIN_MS = 60_000;

interface PendingClip {
  text: string;
  sourceUrl?: string;
  sourceTitle?: string;
  target?: 'current' | 'new';
}

function normalizePendingClip(value: unknown): PendingClip | null {
  if (!value || typeof value !== 'object') return null;
  const clip = value as Partial<PendingClip>;
  const text = typeof clip.text === 'string' ? clip.text.trim() : '';
  if (!text) return null;
  return {
    text,
    sourceUrl: typeof clip.sourceUrl === 'string' ? clip.sourceUrl : undefined,
    sourceTitle: typeof clip.sourceTitle === 'string' ? clip.sourceTitle : undefined,
    target: clip.target === 'new' ? 'new' : 'current',
  };
}

function formatClipMarkdown(clip: PendingClip, fallbackUrl: string): string {
  const sourceUrl = clip.sourceUrl || fallbackUrl;
  const sourceTitle = clip.sourceTitle || sourceUrl || 'Source';
  const quotedText = clip.text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n');

  return sourceUrl ? `\n\n${quotedText}\n\n- [${sourceTitle}](${sourceUrl})` : `\n\n${quotedText}`;
}

interface UseChromeStorageAndTabsProps {
  adapter: React.MutableRefObject<ChromeStorageAdapter>;
  noteSvc: React.MutableRefObject<NotesService>;
  wsSvc: React.MutableRefObject<WorkspacesService>;
  contentSavedRef: React.MutableRefObject<string>;
  lastSaveTs: React.MutableRefObject<number>;
  editorRef: React.RefObject<HTMLDivElement>;

  // Callbacks and refs
  activeNoteIdRef: React.MutableRefObject<string | null>;
  scopeRef: React.MutableRefObject<NoteScope>;
  currentUrlRef: React.MutableRefObject<string>;
  wsIdRef: React.MutableRefObject<string | null>;
  addNoteToContextRef: React.MutableRefObject<() => Promise<void>>;
  floatingRequestRef: React.MutableRefObject<
    (action: FloatingAction, request?: FloatingRequest) => Promise<void>
  >;
  flushPendingSave: () => Promise<void>;
  isDraftDirty: () => boolean;
  onCaptureFailure: () => void;
}

export function useChromeStorageAndTabs({
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
}: UseChromeStorageAndTabsProps) {
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState('09:00');
  const [backupRemindDays, setBackupRemindDays] = useState<number>(7);

  // Offline / sync status
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const [syncedToast, setSyncedToast] = useState(false);
  const [clipFeedback, setClipFeedback] = useState(false);
  const lastDriveSyncRequestRef = React.useRef(0);
  const ownerWindowRef = React.useRef<number | null>(null);

  const consumeFloatingRequest = useCallback(async () => {
    // Options and standalone panel tabs share storage, but must not steal the
    // request from Chrome's real side panel. getCurrent() is undefined there.
    if (await cr.tabs.getCurrent()) return;
    if (document.visibilityState !== 'visible') return;
    const request = await withStorageLock(async () => {
      const data = await cr.storage.local.get(FLOATING_REQUEST_STORAGE_KEY);
      const value = data[FLOATING_REQUEST_STORAGE_KEY] as FloatingRequest | undefined;
      if (!value || !normalizeFloatingAction(value.action)) return null;
      if (typeof value.windowId === 'number') {
        const window = await cr.windows.getCurrent();
        if (window.id !== value.windowId) return null;
      }
      if (value.sourceUrl && currentUrlRef.current !== value.sourceUrl) return null;
      await cr.storage.local.remove(FLOATING_REQUEST_STORAGE_KEY);
      return Date.now() - value.requestedAt > 30_000 ? null : value;
    });
    if (request) await floatingRequestRef.current(request.action, request);
  }, [currentUrlRef, floatingRequestRef]);

  // Store setters
  const setView = useSidePanelStore((s) => s.setView);
  const setThemeState = useSidePanelStore((s) => s.setThemeState);
  const setMdState = useSidePanelStore((s) => s.setMdState);
  const setPreview = useSidePanelStore((s) => s.setPreview);
  const setScope = useSidePanelStore((s) => s.setScope);
  const setActiveNoteId = useSidePanelStore((s) => s.setActiveNoteId);
  const setCurrentUrl = useSidePanelStore((s) => s.setCurrentUrl);
  const setCurrentDomain = useSidePanelStore((s) => s.setCurrentDomain);
  const setAllNotes = useSidePanelStore((s) => s.setAllNotes);
  const setContextNotes = useSidePanelStore((s) => s.setContextNotes);
  const setWorkspaces = useSidePanelStore((s) => s.setWorkspaces);
  const setActiveWorkspaceId = useSidePanelStore((s) => s.setActiveWorkspaceId);
  const setDefaultScopeState = useSidePanelStore((s) => s.setDefaultScope);
  const setLanguageState = useSidePanelStore((s) => s.setLanguageState);

  const setContent = useSidePanelStore((s) => s.setContent);
  const setTitle = useSidePanelStore((s) => s.setTitle);
  const setTags = useSidePanelStore((s) => s.setTags);
  const setSaved = useSidePanelStore((s) => s.setSaved);
  const setChecklistMode = useSidePanelStore((s) => s.setChecklistMode);
  const setChecklistItems = useSidePanelStore((s) => s.setChecklistItems);

  const applyCleanNoteToEditor = useCallback(
    async (note: Note | null) => {
      if (note) note = await noteSvc.current.getEditorNote(note);
      useSidePanelStore.setState({
        noteUnlocked: Boolean(note && noteSvc.current.isUnlocked(note.id)),
        editorVersions:
          note?.encrypted && !noteSvc.current.isUnlocked(note.id) ? [] : (note?.versions ?? []),
      });
      const nextContent = note?.content ?? '';
      activeNoteIdRef.current = note?.id ?? null;
      contentSavedRef.current = nextContent;
      setActiveNoteId(note?.id ?? null);
      setContent(nextContent);
      setTitle(note?.title ?? '');
      setTags(note?.tags.join(', ') ?? '');
      const plainContent = editorHtmlToPlainText(nextContent);
      const isChecklist = isChecklistContent(plainContent);
      setChecklistMode(isChecklist);
      setChecklistItems(isChecklist ? parseChecklistItems(plainContent) : []);
      setSaved(false);
      setPreview(false);
    },
    [
      activeNoteIdRef,
      contentSavedRef,
      setActiveNoteId,
      setContent,
      setPreview,
      setSaved,
      setChecklistItems,
      setChecklistMode,
      setTags,
      setTitle,
      noteSvc,
    ]
  );

  const requestDriveSyncIfEnabled = useCallback(() => {
    if (!cr?.runtime?.sendMessage || !navigator.onLine) return;
    const now = Date.now();
    if (now - lastDriveSyncRequestRef.current < DRIVE_SYNC_REQUEST_MIN_MS) return;
    lastDriveSyncRequestRef.current = now;
    cr.runtime.sendMessage({ type: 'DRIVE_SYNC_IF_ENABLED' }, () => {
      // Automatic remote pulls are best-effort; Settings exposes detailed Drive errors.
      void cr.runtime.lastError;
    });
  }, []);

  const refreshAllNotes = useCallback(async () => {
    const notes = await noteSvc.current.getAllNotes();
    setAllNotes(notes);
    return notes;
  }, [noteSvc, setAllNotes]);

  const appendClipToCurrentNote = useCallback(
    async (rawClip: unknown, requestedTarget?: 'current' | 'new'): Promise<boolean> => {
      const clip = normalizePendingClip(rawClip);
      if (!clip) return false;
      await flushPendingSave();

      const state = useSidePanelStore.getState();
      const destination = {
        id: activeNoteIdRef.current,
        url: currentUrlRef.current,
        scope: scopeRef.current,
        workspaceId: wsIdRef.current,
      };
      const sourceUrl = clip.sourceUrl || currentUrlRef.current;
      const target = requestedTarget ?? clip.target ?? 'current';
      const useCurrentNote = target === 'current';
      const nextContent =
        useCurrentNote && state.content.trim()
          ? `${state.content}${formatClipMarkdown(clip, currentUrlRef.current)}`
          : formatClipMarkdown(clip, currentUrlRef.current).trimStart();
      const parsedTags = (useCurrentNote ? state.tags : '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const title = stripFormatting(
        (useCurrentNote ? state.title : '') || clip.sourceTitle || sourceUrl || ''
      );

      setSaved(false);

      let savedNote =
        useCurrentNote && destination.id
          ? await noteSvc.current.updateNote(destination.id, {
              content: nextContent,
              title: title || undefined,
              tags: parsedTags,
            })
          : await noteSvc.current.createNote({
              scope: destination.scope,
              url: destination.url || sourceUrl,
              workspaceId: destination.workspaceId,
              content: nextContent,
              title: title || undefined,
              tags: parsedTags,
            });

      if (!savedNote) return false;
      if (
        activeNoteIdRef.current !== destination.id ||
        currentUrlRef.current !== destination.url ||
        scopeRef.current !== destination.scope ||
        wsIdRef.current !== destination.workspaceId
      ) {
        await refreshAllNotes();
        return true;
      }
      savedNote = await noteSvc.current.getEditorNote(savedNote);
      useSidePanelStore.setState({
        noteUnlocked: noteSvc.current.isUnlocked(savedNote.id),
        editorVersions: savedNote.versions ?? [],
      });

      activeNoteIdRef.current = savedNote.id;
      setActiveNoteId(savedNote.id);
      setContent(savedNote.content);
      setTitle(savedNote.title ?? '');
      setTags(savedNote.tags.join(', '));
      const plainContent = editorHtmlToPlainText(savedNote.content);
      const checklist = isChecklistContent(plainContent);
      setChecklistMode(checklist);
      setChecklistItems(checklist ? parseChecklistItems(plainContent) : []);
      setContextNotes(
        await noteSvc.current.getNotesByScope(
          scopeRef.current,
          currentUrlRef.current || sourceUrl,
          wsIdRef.current
        )
      );
      contentSavedRef.current = savedNote.content;
      lastSaveTs.current = Date.now();
      setView('note');
      setSaved(true);
      setClipFeedback(true);
      await refreshAllNotes();

      setTimeout(() => editorRef.current?.focus(), 120);
      setTimeout(() => setSaved(false), 2000);
      setTimeout(() => setClipFeedback(false), 2000);
      return true;
    },
    [
      activeNoteIdRef,
      flushPendingSave,
      contentSavedRef,
      currentUrlRef,
      editorRef,
      lastSaveTs,
      noteSvc,
      refreshAllNotes,
      scopeRef,
      setContent,
      setContextNotes,
      setActiveNoteId,
      setChecklistItems,
      setChecklistMode,
      setSaved,
      setTags,
      setTitle,
      setView,
      wsIdRef,
    ]
  );

  const consumePendingClip = useCallback(async () => {
    const clip = await withStorageLock(async () => {
      const data = await cr.storage.local.get(PENDING_CLIP_STORAGE_KEY);
      const request = data[PENDING_CLIP_STORAGE_KEY] as
        | (PendingClip & { windowId?: number; tabId?: number })
        | undefined;
      if (!normalizePendingClip(request)) return null;
      if (typeof request?.windowId === 'number') {
        const window = await cr.windows.getCurrent();
        if (window.id !== request.windowId) return null;
      }
      if (typeof request?.tabId === 'number' && request.sourceUrl !== currentUrlRef.current)
        return null;
      await cr.storage.local.remove(PENDING_CLIP_STORAGE_KEY);
      return request;
    });
    if (clip) await appendClipToCurrentNote(clip);
  }, [appendClipToCurrentNote, currentUrlRef]);

  const loadContextNotes = useCallback(
    async (url: string, sc: NoteScope, wsId: string | null, preferNoteId?: string | null) => {
      await flushPendingSave();
      if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
        setContextNotes([]);
        setActiveWorkspaceId(wsId);
        await applyCleanNoteToEditor(null);
        return;
      }

      const notes = await noteSvc.current.getNotesByScope(sc, url, wsId);
      setContextNotes(notes);

      const pick = preferNoteId
        ? (notes.find((n) => n.id === preferNoteId) ?? notes[0] ?? null)
        : (notes[0] ?? null);

      await applyCleanNoteToEditor(pick);
    },
    [noteSvc, setContextNotes, setActiveWorkspaceId, applyCleanNoteToEditor, flushPendingSave]
  );

  const switchToTab = useCallback(
    async (url: string) => {
      await flushPendingSave();
      setTabLoading(true);
      setCurrentUrl(url);
      setCurrentDomain(normalizeDomain(url));
      currentUrlRef.current = url;

      await Promise.all([
        refreshAllNotes(),
        loadContextNotes(url, scopeRef.current, wsIdRef.current),
      ]);
      setTabLoading(false);
      // The click may arrive while this panel is still switching to its source tab.
      await consumeFloatingRequest().catch(onCaptureFailure);
    },
    [
      consumeFloatingRequest,
      onCaptureFailure,
      loadContextNotes,
      refreshAllNotes,
      setCurrentDomain,
      setCurrentUrl,
      currentUrlRef,
      scopeRef,
      wsIdRef,
      flushPendingSave,
    ]
  );

  // Online / offline detection
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setPendingSyncIds((prev) => {
        if (prev.size > 0) {
          setSyncedToast(true);
          setTimeout(() => setSyncedToast(false), 3000);
        }
        return new Set();
      });
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // CLIP_TEXT listener (legacy Web Clipper bridge)
  useEffect(() => {
    if (!cr?.runtime?.onMessage) return;
    const handler = (msg: {
      type: string;
      text: string;
      sourceUrl: string;
      sourceTitle: string;
    }) => {
      if (msg.type !== 'CLIP_TEXT') return;
      void appendClipToCurrentNote(msg);
    };
    cr.runtime.onMessage.addListener(handler);
    return () => cr.runtime.onMessage.removeListener(handler);
  }, [appendClipToCurrentNote]);

  // Cross-tab real-time sync
  useEffect(() => {
    if (!cr?.storage?.onChanged) return;
    let t: ReturnType<typeof setTimeout>;

    const handler = (
      changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
      area: string
    ) => {
      if (area === 'local' && changes[PENDING_CLIP_STORAGE_KEY]?.newValue) {
        void consumePendingClip().catch(onCaptureFailure);
        return;
      }
      if (area === 'local' && changes[FLOATING_REQUEST_STORAGE_KEY]?.newValue) {
        void consumeFloatingRequest().catch(onCaptureFailure);
        return;
      }
      if (area === 'local' && changes['tn_quick_capture']?.newValue) {
        cr.storage.local.remove('tn_quick_capture');
        addNoteToContextRef.current().then(() => {
          setView('note');
          setTimeout(() => editorRef.current?.focus(), 120);
        });
        return;
      }
      if (area !== 'local' || !changes['tabnotes_data']) return;
      if (Date.now() - lastSaveTs.current < 1200) return;

      clearTimeout(t);
      t = setTimeout(async () => {
        const allUpdated = await noteSvc.current.getAllNotes();
        setAllNotes(allUpdated);
        const ctxUpdated = await noteSvc.current.getNotesByScope(
          scopeRef.current,
          currentUrlRef.current,
          wsIdRef.current
        );
        setContextNotes(ctxUpdated);

        const storageData = await adapter.current.get();
        const wsList = await wsSvc.current.getAll();
        setWorkspaces(wsList);
        const wsId = await wsSvc.current.getActive();
        setActiveWorkspaceId(wsId);
        wsIdRef.current = wsId;

        const resolvedLng = resolveLanguage(
          (storageData as unknown as { language?: string }).language ??
            cr?.i18n?.getUILanguage?.() ??
            navigator.language
        );
        setLanguageState(resolvedLng);
        i18n.changeLanguage(resolvedLng);

        if (storageData.theme) {
          setThemeState(storageData.theme);
        }

        const id = activeNoteIdRef.current;
        if (id) {
          const remote = ctxUpdated.find((n) => n.id === id) ?? allUpdated.find((n) => n.id === id);
          const nextNote = remote ?? ctxUpdated[0] ?? null;
          if (!isDraftDirty() && useSidePanelStore.getState().content === contentSavedRef.current) {
            await applyCleanNoteToEditor(nextNote);
          }
        }
      }, 250);
    };

    cr.storage.onChanged.addListener(handler);
    return () => {
      cr.storage.onChanged.removeListener(handler);
      clearTimeout(t);
    };
  }, [
    consumeFloatingRequest,
    consumePendingClip,
    onCaptureFailure,
    applyCleanNoteToEditor,
    isDraftDirty,
    addNoteToContextRef,
    floatingRequestRef,
    appendClipToCurrentNote,
    setView,
    editorRef,
    lastSaveTs,
    noteSvc,
    setAllNotes,
    scopeRef,
    currentUrlRef,
    wsIdRef,
    setContextNotes,
    wsSvc,
    setWorkspaces,
    setActiveWorkspaceId,
    activeNoteIdRef,
    contentSavedRef,
    setContent,
    setActiveNoteId,
    setSaved,
    setTitle,
    setTags,
    setChecklistItems,
    setChecklistMode,
    adapter,
    setLanguageState,
    setThemeState,
  ]);

  // Initial load
  useEffect(() => {
    if (!cr?.tabs) {
      setLoading(false);
      return;
    }

    const init = async () => {
      const [storageData, wsId, wsList] = await Promise.all([
        adapter.current.get(),
        wsSvc.current.getActive(),
        wsSvc.current.getAll(),
      ]);

      const sc: NoteScope = (storageData as StorageData).defaultScope ?? 'domain';
      setDefaultScopeState(sc);
      setScope(sc);
      scopeRef.current = sc;
      setActiveWorkspaceId(wsId);
      wsIdRef.current = wsId;
      setWorkspaces(wsList);
      setMdState(storageData.markdownEnabled ?? false);
      const themeValue =
        (storageData as unknown as { theme: 'light' | 'dark' | 'system' }).theme ?? 'system';
      setThemeState(themeValue);

      const resolvedLng = resolveLanguage(
        (storageData as unknown as { language?: string }).language ??
          cr?.i18n?.getUILanguage?.() ??
          navigator.language
      );
      setLanguageState(resolvedLng);
      i18n.changeLanguage(resolvedLng);

      // Load daily digest settings
      if (cr?.storage?.local?.get) {
        const digestResult = await new Promise<Record<string, unknown>>((res) =>
          cr.storage.local.get('tn_digest', res)
        );
        const d = digestResult['tn_digest'] as { enabled?: boolean; time?: string } | undefined;
        if (d) {
          setDigestEnabled(d.enabled ?? false);
          setDigestTime(d.time ?? '09:00');
        }
      }

      // Load writing streak
      if (cr?.storage?.local?.get) {
        const sr = await new Promise<Record<string, unknown>>((res) =>
          cr.storage.local.get('tn_streak', res)
        );
        const s = sr['tn_streak'] as { count?: number } | undefined;
        if (s?.count) setStreak(s.count);
      }

      await refreshAllNotes();

      const ownerWindow = await cr.windows.getCurrent();
      ownerWindowRef.current = ownerWindow.id;
      const tabs = await new Promise<{ url?: string }[]>((resolve) =>
        cr.tabs.query({ active: true, currentWindow: true }, resolve)
      );
      const url = tabs[0]?.url ?? '';
      setCurrentUrl(url);
      setCurrentDomain(normalizeDomain(url));
      currentUrlRef.current = url;
      await loadContextNotes(url, sc, wsId);

      await consumePendingClip().catch(onCaptureFailure);

      const qcData = await new Promise<Record<string, unknown>>((res) =>
        cr.storage.local.get('tn_quick_capture', res)
      );
      if (qcData['tn_quick_capture']) {
        cr.storage.local.remove('tn_quick_capture');
        await addNoteToContextRef.current();
        setView('note');
        setTimeout(() => editorRef.current?.focus(), 120);
      }

      await consumeFloatingRequest();

      setLoading(false);
      requestDriveSyncIfEnabled();
    };

    void init().catch(() => {
      setStorageError(true);
      setLoading(false);
    });
  }, [
    adapter,
    consumeFloatingRequest,
    consumePendingClip,
    onCaptureFailure,
    wsSvc,
    setDefaultScopeState,
    setScope,
    scopeRef,
    setActiveWorkspaceId,
    wsIdRef,
    setWorkspaces,
    setMdState,
    setThemeState,
    setLanguageState,
    refreshAllNotes,
    setCurrentUrl,
    setCurrentDomain,
    currentUrlRef,
    loadContextNotes,
    appendClipToCurrentNote,
    addNoteToContextRef,
    floatingRequestRef,
    setView,
    editorRef,
    requestDriveSyncIfEnabled,
  ]);

  useEffect(() => {
    const onFocus = () => requestDriveSyncIfEnabled();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestDriveSyncIfEnabled();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [requestDriveSyncIfEnabled]);

  // Tab event listeners
  useEffect(() => {
    if (!cr?.tabs) return;

    const onActivated = (info: { tabId: number; windowId: number }) => {
      if (ownerWindowRef.current !== null && info.windowId !== ownerWindowRef.current) return;
      cr.tabs.get(info.tabId, (tab: { url?: string }) => {
        if (cr.runtime.lastError) return;
        const url = tab?.url ?? '';
        if (url !== currentUrlRef.current) switchToTab(url);
      });
    };

    const onUpdated = (
      _tabId: number,
      changeInfo: { status?: string },
      tab: { active?: boolean; url?: string; windowId?: number }
    ) => {
      if (ownerWindowRef.current !== null && tab.windowId !== ownerWindowRef.current) return;
      if (!tab.active) return;
      if (changeInfo.status === 'complete' && tab.url && tab.url !== currentUrlRef.current) {
        switchToTab(tab.url);
      }
    };

    cr.tabs.onActivated.addListener(onActivated);
    cr.tabs.onUpdated.addListener(onUpdated);
    return () => {
      cr.tabs.onActivated.removeListener(onActivated);
      cr.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [switchToTab, currentUrlRef]);

  const saveDigest = (enabled: boolean, time: string) => {
    cr?.runtime?.sendMessage({ type: 'SET_DIGEST', enabled, time });
  };

  return {
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
    setSyncedToast,
    clipFeedback,
    refreshAllNotes,
    loadContextNotes,
    switchToTab,
    saveDigest,
    appendClipToCurrentNote,
  };
}
