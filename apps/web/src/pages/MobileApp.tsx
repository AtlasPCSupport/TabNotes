import React, { useEffect, useMemo, useState } from 'react';
import { formatRelativeTime, type Note, type NoteScope } from '@tabnotes/shared';
import { useNotesStore } from '../store/notes';

function fieldStyle(): React.CSSProperties {
  return {
    width: '100%',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    background: 'var(--color-bg-card)',
    color: 'var(--color-text)',
    padding: '11px 12px',
    fontSize: 'var(--text-sm)',
    outline: 'none',
  };
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-accent)' : 'var(--color-bg-card)',
    color: active ? '#fff' : 'var(--color-text-muted)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

function getWorkspaceFolders(notes: Note[], workspaceId: string | null): string[] {
  return [...new Set(
    notes
      .filter((note) => note.workspaceId === workspaceId)
      .map((note) => note.folder?.trim())
      .filter((folder): folder is string => Boolean(folder)),
  )].sort((a, b) => a.localeCompare(b));
}

function noteMatches(note: Note, query: string): boolean {
  if (!query.trim()) return true;
  const text = `${note.title ?? ''} ${note.content} ${note.tags.join(' ')} ${note.folder ?? ''}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

function displayFolderName(value: string): string {
  return value.startsWith('/') ? value.slice(1) : value;
}

export default function MobileAppPage() {
  const {
    notes,
    workspaces,
    sync,
    load,
    createNote,
    updateNote,
    deleteNote,
    syncWithDrive,
    disconnectDrive,
  } = useNotesStore();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [query, setQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  const folders = useMemo(() => getWorkspaceFolders(notes, workspaceId), [notes, workspaceId]);
  const selectedNote = selectedNoteId ? notes.find((note) => note.id === selectedNoteId) ?? null : null;
  const visibleNotes = notes
    .filter((note) => note.workspaceId === workspaceId)
    .filter((note) => !folder || note.folder === folder)
    .filter((note) => noteMatches(note, query));

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const syncLabel =
    sync.status === 'ok'
      ? `Synced ${sync.lastSyncIso ? formatRelativeTime(Date.parse(sync.lastSyncIso)) : ''}`
      : sync.status === 'local'
        ? 'Local changes pending'
        : sync.status === 'syncing'
          ? 'Syncing with Drive'
          : sync.status === 'setup_required'
            ? 'Drive setup required'
            : sync.status === 'error'
              ? 'Sync needs attention'
              : 'Drive disconnected';

  function startNewNote() {
    setSelectedNoteId(null);
    setTitle('');
    setContent('');
    setTags('');
  }

  function selectNote(note: Note) {
    setSelectedNoteId(note.id);
    setTitle(note.title ?? '');
    setContent(note.content);
    setTags(note.tags.join(', '));
    setFolder(note.folder ?? '');
  }

  async function saveCurrentNote() {
    if (!content.trim() && !title.trim()) return;
    setSaving(true);
    const parsedTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (selectedNote) {
      await updateNote(selectedNote.id, {
        title: title.trim() || undefined,
        content,
        tags: parsedTags,
        folder: folder || undefined,
      });
    } else {
      const scope: NoteScope = workspaceId ? 'workspace' : 'global';
      const note = await createNote({
        scope,
        workspaceId,
        title: title.trim() || undefined,
        content,
        tags: parsedTags,
        folder: folder || undefined,
      });
      setSelectedNoteId(note.id);
    }
    setSaving(false);
  }

  async function removeSelectedNote() {
    if (!selectedNote) return;
    const ok = confirm('Delete this note? It will be deleted from synced devices after Drive sync.');
    if (!ok) return;
    await deleteNote(selectedNote.id);
    startNewNote();
  }

  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 920, margin: '0 auto' }}>
      <section
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 22,
          background: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-md)',
          padding: 'clamp(16px, 4vw, 26px)',
          display: 'grid',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <div>
            <p style={{ color: 'var(--color-accent)', fontSize: 11, fontWeight: 800, letterSpacing: 0.4 }}>
              TABNOTES MOBILE
            </p>
            <h1 style={{ fontSize: 'clamp(28px, 8vw, 42px)', lineHeight: 1.02, marginTop: 6 }}>
              Notes from your phone.
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
              Read, create, and sync notes with the same private Drive app data used by the extension.
            </p>
          </div>
          <button
            onClick={() => syncWithDrive(true)}
            disabled={sync.status === 'syncing'}
            style={{
              border: 'none',
              borderRadius: 999,
              background: 'var(--color-accent)',
              color: '#fff',
              padding: '10px 14px',
              fontWeight: 800,
              cursor: sync.status === 'syncing' ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {sync.status === 'syncing' ? 'Syncing' : 'Sync'}
          </button>
        </div>

        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            background: 'var(--color-bg-subtle)',
            padding: 14,
            display: 'grid',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 'var(--text-sm)' }}>{syncLabel}</strong>
            {sync.status !== 'setup_required' && (
              <button
                onClick={disconnectDrive}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 999,
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-muted)',
                  padding: '5px 10px',
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            )}
          </div>
          {sync.lastError && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)' }}>{sync.lastError}</p>
          )}
          {sync.status === 'setup_required' && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              Add VITE_GOOGLE_CLIENT_ID with a Google OAuth Web Application client ID before enabling Drive sync.
            </p>
          )}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
          gap: 16,
        }}
        className="mobile-app-grid"
      >
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 18,
              background: 'var(--color-bg-card)',
              padding: 14,
              display: 'grid',
              gap: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Workspace
              <select
                value={workspaceId ?? ''}
                onChange={(event) => {
                  setWorkspaceId(event.target.value || null);
                  setFolder('');
                  startNewNote();
                }}
                style={fieldStyle()}
              >
                <option value="">Global notes</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              <button type="button" onClick={() => setFolder('')} style={pillStyle(folder === '')}>
                All
              </button>
              {folders.map((item) => (
                <button key={item} type="button" onClick={() => setFolder(item)} style={pillStyle(folder === item)}>
                  {displayFolderName(item)}
                </button>
              ))}
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes"
              style={fieldStyle()}
            />
          </div>

          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 18,
              background: 'var(--color-bg-card)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{selectedWorkspace?.name ?? 'Global notes'}</strong>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: 2 }}>
                {visibleNotes.length} note{visibleNotes.length === 1 ? '' : 's'}
              </p>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {visibleNotes.length === 0 ? (
                <div style={{ padding: 18, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  No notes in this view.
                </div>
              ) : (
                visibleNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => selectNote(note)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border)',
                      background: selectedNoteId === note.id ? 'var(--color-accent-subtle)' : 'transparent',
                      color: 'var(--color-text)',
                      padding: 14,
                      cursor: 'pointer',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: 'var(--text-sm)' }}>
                      {note.title || note.content.slice(0, 48) || 'Untitled'}
                    </strong>
                    <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
                      {note.folder ? `${displayFolderName(note.folder)} · ` : ''}
                      {formatRelativeTime(note.updatedAt)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 18,
            background: 'var(--color-bg-card)',
            padding: 14,
            display: 'grid',
            gap: 12,
            alignContent: 'start',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <strong>{selectedNote ? 'Edit note' : 'New note'}</strong>
            <button
              onClick={startNewNote}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 999,
                background: 'var(--color-bg-subtle)',
                color: 'var(--color-text-muted)',
                padding: '6px 10px',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
            >
              New
            </button>
          </div>

          <label style={{ display: 'grid', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Existing category
            <select value={folder} onChange={(event) => setFolder(event.target.value)} style={fieldStyle()}>
              <option value="">No category</option>
              {folders.map((item) => (
                <option key={item} value={item}>
                  {displayFolderName(item)}
                </option>
              ))}
            </select>
          </label>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            style={fieldStyle()}
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write a note from your phone"
            style={{ ...fieldStyle(), minHeight: 220, resize: 'vertical', lineHeight: 1.6 }}
          />
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="tags, separated, by comma"
            style={fieldStyle()}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={saveCurrentNote}
              disabled={saving || (!content.trim() && !title.trim())}
              style={{
                flex: '1 1 160px',
                border: 'none',
                borderRadius: 12,
                background: 'var(--color-accent)',
                color: '#fff',
                padding: '12px 14px',
                fontWeight: 800,
                cursor: saving ? 'wait' : 'pointer',
                opacity: saving || (!content.trim() && !title.trim()) ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving' : selectedNote ? 'Save note' : 'Add note'}
            </button>
            {selectedNote && (
              <button
                onClick={removeSelectedNote}
                style={{
                  border: '1px solid var(--color-danger-subtle)',
                  borderRadius: 12,
                  background: 'var(--color-danger-subtle)',
                  color: 'var(--color-danger)',
                  padding: '12px 14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
