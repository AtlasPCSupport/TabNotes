import React, { useEffect, useState, useRef } from 'react';
import {
  Note,
  NoteScope,
  Workspace,
  ChromeStorageAdapter,
  NotesService,
  WorkspacesService,
  exportData,
  importData,
  formatRelativeTime,
} from '@tabnotes/shared';
import './options.css';

const SCOPE_OPTIONS: { value: NoteScope; label: string; icon: string; desc: string }[] = [
  { value: 'url', label: 'URL', icon: '🔗', desc: 'Notes tied to exact page URLs' },
  { value: 'domain', label: 'Domain', icon: '🌐', desc: 'One note shared across a site' },
  { value: 'workspace', label: 'Workspace', icon: '⊞', desc: 'Notes linked to your workspace' },
  { value: 'global', label: 'Global', icon: '🌍', desc: 'A single global scratchpad' },
];

type Tab = 'notes' | 'workspaces' | 'settings';

const WORKSPACE_COLORS = [
  { value: '#2f6dff', label: 'Blue' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#10b981', label: 'Green' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
];

export default function OptionsApp() {
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [defaultScope, setDefaultScope] = useState<NoteScope>('domain');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [newWsName, setNewWsName] = useState('');
  const [newWsColor, setNewWsColor] = useState('#2f6dff');
  const [editWsId, setEditWsId] = useState<string | null>(null);
  const [editWsName, setEditWsName] = useState('');
  const [editWsColor, setEditWsColor] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const adapter = useRef(new ChromeStorageAdapter());
  const notesService = useRef(new NotesService(adapter.current));
  const workspacesService = useRef(new WorkspacesService(adapter.current));

  const load = async () => {
    const [n, w, activeWs, data] = await Promise.all([
      notesService.current.getAllNotes(),
      workspacesService.current.getAll(),
      workspacesService.current.getActive(),
      adapter.current.get(),
    ]);
    setNotes(n);
    setWorkspaces(w);
    setActiveWorkspaceId(activeWs);
    setDefaultScope(data.defaultScope);
    setTheme(data.theme);
  };

  useEffect(() => {
    load();
    // Apply theme
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
  }, []);

  const handleSetDefaultScope = async (s: NoteScope) => {
    setDefaultScope(s);
    await adapter.current.set({ defaultScope: s });
  };

  const handleTheme = async (t: typeof theme) => {
    setTheme(t);
    await adapter.current.set({ theme: t });
    if (t === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    await workspacesService.current.create(newWsName.trim(), newWsColor);
    setNewWsName('');
    setNewWsColor('#2f6dff');
    await load();
  };

  const handleUpdateWorkspace = async (id: string) => {
    if (!editWsName.trim()) return;
    await workspacesService.current.update(id, { name: editWsName.trim(), color: editWsColor });
    setEditWsId(null);
    setEditWsName('');
    await load();
  };

  const handleDeleteWorkspace = async (id: string) => {
    if (!confirm('Delete this workspace?')) return;
    await workspacesService.current.delete(id);
    await load();
  };

  const handleSetActiveWorkspace = async (id: string | null) => {
    await workspacesService.current.setActive(id);
    setActiveWorkspaceId(id);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await notesService.current.deleteNote(id);
    await load();
  };

  const handleExport = async () => {
    const data = await adapter.current.get();
    const exported = exportData(data);
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabnotes-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const current = await adapter.current.get();
      const merged = importData(imported, current);
      await adapter.current.set(merged);
      await load();
      setImportStatus('Import successful!');
    } catch {
      setImportStatus('Import failed — invalid file.');
    }
    setTimeout(() => setImportStatus(null), 3000);
    if (fileRef.current) fileRef.current.value = '';
  };

  const SCOPE_ICONS: Record<string, string> = { url: '🔗', domain: '🌐', workspace: '⊞', global: '🌍' };

  return (
    <div className="options-root">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">T</div>
          <span className="logo-text">TabNotes</span>
        </div>
        <nav className="sidebar-nav">
          {([['notes', '✎', 'Notes'], ['workspaces', '⊞', 'Workspaces'], ['settings', '⚙', 'Settings']] as const).map(([tab, icon, label]) => (
            <button
              key={tab}
              className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>v1.0.0 · Local-first</span>
        </div>
      </aside>

      {/* Content */}
      <main className="content">
        {activeTab === 'notes' && (
          <div className="section">
            <div className="section-header">
              <h1>Notes</h1>
              <span className="badge">{notes.length}</span>
            </div>
            {notes.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">✎</div>
                <div className="empty-title">No notes yet</div>
                <div className="empty-desc">Open the extension popup to create your first note.</div>
              </div>
            )}
            <div className="notes-list">
              {notes.map((note) => (
                <div key={note.id} className="note-card">
                  <div className="note-meta">
                    <span>{SCOPE_ICONS[note.scope]}</span>
                    <span className="note-scope">{note.scope}</span>
                    {note.scopeKey && <span className="note-key">{note.scopeKey}</span>}
                    <span className="note-time">{formatRelativeTime(note.updatedAt)}</span>
                  </div>
                  {note.title && <div className="note-title">{note.title}</div>}
                  <div className="note-content">{note.content || <em>Empty note</em>}</div>
                  <button className="delete-btn" onClick={() => handleDeleteNote(note.id)}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'workspaces' && (
          <div className="section">
            <div className="section-header">
              <h1>Workspaces</h1>
              <span className="badge">{workspaces.length}</span>
            </div>
            <form onSubmit={handleCreateWorkspace} className="create-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  placeholder="New workspace name..."
                  className="text-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary">Create</button>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Color:</span>
                {WORKSPACE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewWsColor(c.value)}
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: c.value,
                      border: newWsColor === c.value ? '2px solid var(--color-text)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      padding: 0,
                      transform: newWsColor === c.value ? 'scale(1.1)' : 'none',
                      transition: 'transform 0.1s ease',
                    }}
                    title={c.label}
                  />
                ))}
              </div>
            </form>
            <div className="ws-list">
              <div
                className={`ws-card ${activeWorkspaceId === null ? 'active' : ''}`}
                onClick={() => handleSetActiveWorkspace(null)}
              >
                <span>🌍</span>
                <div className="ws-info">
                  <div className="ws-name">Global (No Workspace)</div>
                  <div className="ws-count">{notes.filter((n) => !n.workspaceId).length} notes</div>
                </div>
                {activeWorkspaceId === null && <span className="active-badge">Active</span>}
              </div>
              {workspaces.map((ws) => {
                const isEditing = editWsId === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`ws-card ${activeWorkspaceId === ws.id ? 'active' : ''}`}
                    onClick={() => !isEditing && handleSetActiveWorkspace(ws.id)}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="ws-avatar" style={{ backgroundColor: ws.color || 'var(--color-accent)' }}>
                        {ws.name[0].toUpperCase()}
                      </div>
                      <div className="ws-info" style={{ flex: 1 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                autoFocus
                                value={editWsName}
                                onChange={(e) => setEditWsName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateWorkspace(ws.id); if (e.key === 'Escape') setEditWsId(null); }}
                                className="text-input"
                                style={{ padding: '4px 8px', fontSize: '13px', flex: 1 }}
                              />
                              <button onClick={() => handleUpdateWorkspace(ws.id)} className="btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }}>Save</button>
                              <button onClick={() => setEditWsId(null)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}>Cancel</button>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {WORKSPACE_COLORS.map((c) => (
                                <button
                                  key={c.value}
                                  type="button"
                                  onClick={() => setEditWsColor(c.value)}
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: c.value,
                                    border: editWsColor === c.value ? '2px solid var(--color-text)' : '1px solid var(--color-border)',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                  title={c.label}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="ws-name">{ws.name}</div>
                            <div className="ws-count">{notes.filter((n) => n.workspaceId === ws.id).length} notes</div>
                          </>
                        )}
                      </div>
                      {activeWorkspaceId === ws.id && !isEditing && <span className="active-badge">Active</span>}
                      {!isEditing && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditWsId(ws.id);
                              setEditWsName(ws.name);
                              setEditWsColor(ws.color || '#2f6dff');
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id); }}
                            style={{ cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="section">
            <div className="section-header"><h1>Settings</h1></div>

            <div className="setting-group">
              <div className="setting-label">Theme</div>
              <div className="theme-btns">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    className={`theme-btn ${theme === t ? 'active' : ''}`}
                    onClick={() => handleTheme(t)}
                  >
                    {t === 'light' ? '☀ Light' : t === 'dark' ? '☽ Dark' : '◑ System'}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-label">Default Note Scope</div>
              <div className="scope-list">
                {SCOPE_OPTIONS.map((s) => (
                  <label key={s.value} className={`scope-option ${defaultScope === s.value ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="defaultScope"
                      value={s.value}
                      checked={defaultScope === s.value}
                      onChange={() => handleSetDefaultScope(s.value)}
                    />
                    <span>{s.icon}</span>
                    <div>
                      <div className="scope-option-label">{s.label}</div>
                      <div className="scope-option-desc">{s.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-label">Data</div>
              <div className="data-stats">
                <div className="stat"><div className="stat-val">{notes.length}</div><div className="stat-label">Notes</div></div>
                <div className="stat-divider" />
                <div className="stat"><div className="stat-val">{workspaces.length}</div><div className="stat-label">Workspaces</div></div>
              </div>
              <div className="data-btns">
                <button className="btn-secondary" onClick={handleExport}>↓ Export JSON</button>
                <label className="btn-secondary">
                  ↑ Import JSON
                  <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                </label>
              </div>
              {importStatus && (
                <div className={`import-status ${importStatus.includes('success') ? 'success' : 'error'}`}>
                  {importStatus}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
