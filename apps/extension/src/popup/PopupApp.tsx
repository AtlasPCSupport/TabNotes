import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Note, NoteScope,
  ChromeStorageAdapter, NotesService, WorkspacesService, Workspace,
  normalizeUrl, normalizeDomain, formatRelativeTime, generateId,
} from '@tabnotes/shared';
import './popup.css';

const SCOPE_OPTIONS: { value: NoteScope; label: string; icon: string }[] = [
  { value: 'url',       label: 'URL',       icon: '🔗' },
  { value: 'domain',    label: 'Domain',    icon: '🌐' },
  { value: 'workspace', label: 'Workspace', icon: '⊞' },
  { value: 'global',    label: 'Global',    icon: '🌍' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chromeApi: any = (typeof globalThis !== 'undefined' && (globalThis as Record<string,unknown>).chrome) ? (globalThis as Record<string,unknown>).chrome : null;

export default function PopupApp() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentDomain, setCurrentDomain] = useState('');
  const [scope, setScope] = useState<NoteScope>('domain');
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const noteIdRef = useRef<string | null>(null);

  const adapter = useRef(new ChromeStorageAdapter());
  const notesService = useRef(new NotesService(adapter.current));
  const workspacesService = useRef(new WorkspacesService(adapter.current));

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setTheme(mq.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => {
      mq.removeEventListener('change', handler);
      clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const loadNote = useCallback(async (s: NoteScope, url: string, wsId: string | null) => {
    const existing = await notesService.current.getNoteByScope(s, url, wsId);
    noteIdRef.current = existing?.id ?? null;
    setNote(existing);
    setContent(existing?.content ?? '');
    setTitle(existing?.title ?? '');
    setTags(existing?.tags.join(', ') ?? '');
  }, []);

  useEffect(() => {
    if (!chromeApi?.tabs) {
      setLoading(false);
      return;
    }
    chromeApi.tabs.query({ active: true, currentWindow: true }, async (tabs: {url?: string}[]) => {
      const url = tabs[0]?.url ?? '';
      setCurrentUrl(url);
      setCurrentDomain(normalizeDomain(url));
      const [wsList, activeWsId, storageData] = await Promise.all([
        workspacesService.current.getAll(),
        workspacesService.current.getActive(),
        adapter.current.get(),
      ]);
      setWorkspaces(wsList);
      setActiveWorkspaceId(activeWsId);
      const savedScope = storageData.defaultScope ?? 'domain';
      setScope(savedScope);
      await loadNote(savedScope, url, activeWsId);
      setLoading(false);
    });
  }, [loadNote]);

  const handleScopeChange = async (s: NoteScope) => {
    clearTimeout(saveTimer.current);
    setScope(s);
    noteIdRef.current = null;
    await loadNote(s, currentUrl, activeWorkspaceId);
  };

  const saveNote = useCallback(async (c: string, t: string, tg: string) => {
    const parsedTags = tg.split(',').map((s) => s.trim()).filter(Boolean);
    const id = noteIdRef.current;
    if (id) {
      const updated = await notesService.current.updateNote(id, { content: c, title: t || undefined, tags: parsedTags });
      if (updated) {
        setNote(updated);
      }
    } else {
      const newId = generateId();
      noteIdRef.current = newId;
      const created = await notesService.current.createNote({
        id: newId,
        scope, url: currentUrl, workspaceId: activeWorkspaceId,
        content: c, title: t || undefined, tags: parsedTags,
      });
      setNote(created);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [scope, currentUrl, activeWorkspaceId]);

  const scheduleAutosave = useCallback((c: string, t: string, tg: string) => {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(c, t, tg), 600);
  }, [saveNote]);

  const scopeKey = scope === 'url' ? normalizeUrl(currentUrl)
    : scope === 'domain' ? currentDomain
    : scope === 'workspace' ? (workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? 'Default')
    : 'Global';

  if (loading) {
    return <div className="popup-loading"><div className="spinner" /></div>;
  }

  return (
    <div className="popup-root">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-logo">
          <div className="logo-icon">T</div>
          <span className="logo-text">TabNotes</span>
        </div>
        <button className="icon-btn" onClick={() => chromeApi?.runtime?.openOptionsPage()} title="Settings">⚙</button>
      </div>

      {/* Scope switcher */}
      <div className="scope-bar">
        {SCOPE_OPTIONS.map((opt) => (
          <button key={opt.value} className={`scope-btn ${scope === opt.value ? 'active' : ''}`} onClick={() => handleScopeChange(opt.value)} title={opt.label}>
            <span className="scope-icon">{opt.icon}</span>
            <span className="scope-label">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Context bar */}
      <div className="scope-context">
        <span className="scope-key" title={scopeKey}>{scopeKey || 'Global note'}</span>
        {saved && <span className="saved-badge">✓ Saved</span>}
      </div>

      {/* Title */}
      <input className="note-title" value={title} onChange={(e) => { setTitle(e.target.value); scheduleAutosave(content, e.target.value, tags); }} placeholder="Title (optional)" />

      {/* Editor */}
      <textarea className="note-editor" value={content} onChange={(e) => { setContent(e.target.value); scheduleAutosave(e.target.value, title, tags); }} placeholder={`Write your ${scope} note here…`} autoFocus />

      {/* Tags */}
      <div className="tags-bar">
        <span className="tags-label">Tags:</span>
        <input className="tags-input" value={tags} onChange={(e) => { setTags(e.target.value); scheduleAutosave(content, title, e.target.value); }} placeholder="tag1, tag2" />
      </div>

      {/* Footer */}
      <div className="popup-footer">
        <span className="footer-meta">{note ? formatRelativeTime(note.updatedAt) : 'New note'}</span>
        <span className="footer-count">{content.length} chars</span>
      </div>
    </div>
  );
}
