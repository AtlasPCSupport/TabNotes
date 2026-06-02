import React from 'react';
import type { Note } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { ICONS } from '../icons';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';

export interface Template {
  label: string;
  title: string;
  content: string;
  dynamic?: boolean;
}

export const TEMPLATES: Template[] = [
  {
    label: 'Meeting',
    title: 'Meeting Notes',
    content: '## Attendees\n- \n\n## Agenda\n1. \n\n## Decisions\n- \n\n## Action Items\n- [ ] ',
  },
  {
    label: 'To-Do',
    title: 'To-Do List',
    content: '## Today\n- [ ] \n- [ ] \n- [ ] \n\n## This week\n- [ ] \n- [ ] ',
  },
  {
    label: 'Research',
    title: 'Research',
    content: '## Goal\n\n## Sources\n- \n\n## Key findings\n\n## Summary\n',
  },
  {
    label: 'Daily Log',
    title: '',
    content: '',
    dynamic: true,
  },
];

const FolderIcon = ({ color }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sp-folder-svg" style={{ flexShrink: 0 }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sp-folder-svg" style={{ flexShrink: 0 }}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

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

export interface NoteTreeProps {
  tabLoading: boolean;
  isDragging: boolean;
  dragOverFolder: string | null;
  showNewFolder: boolean;
  setShowNewFolder: (v: boolean) => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  newFolderRef: React.RefObject<HTMLInputElement>;
  templatesRef: React.RefObject<HTMLDivElement>;
  showTemplates: boolean;
  setShowTemplates: (v: boolean) => void;
  folderMenuRef: React.RefObject<HTMLDivElement>;
  renameFolder: (oldPath: string, newName: string, newColor?: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
  
  createFolder: () => Promise<void>;
  applyTemplate: (tpl: Template) => void;
  
  addNoteToContext: (folder?: string) => Promise<void>;
  selectNote: (n: Note) => void;
  deletePillNote: (id: string) => Promise<void>;
  
  handleDragStart: (e: React.DragEvent, noteId: string) => void;
  handleDragEnd: () => void;
  handleDragOver: (e: React.DragEvent, folder: string | null) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, folder: string | null) => void;
  
  deletePillConfirmId: string | null;
  setDeletePillConfirmId: (v: string | null) => void;
}

export function NoteTree({
  tabLoading,
  isDragging,
  dragOverFolder,
  showNewFolder,
  setShowNewFolder,
  newFolderName,
  setNewFolderName,
  newFolderRef,
  templatesRef,
  showTemplates,
  setShowTemplates,
  folderMenuRef,
  renameFolder,
  deleteFolder,
  createFolder,
  applyTemplate,
  addNoteToContext,
  selectNote,
  deletePillNote,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  deletePillConfirmId,
  setDeletePillConfirmId,
}: NoteTreeProps) {
  const { t } = useTranslation();
  const contextNotes = useSidePanelStore((s) => s.contextNotes);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);
  const folderColors = useSidePanelStore((s) => s.folderColors);
  const noteColors = useSidePanelStore((s) => s.noteColors);
  const pinnedNotes = useSidePanelStore((s) => s.pinnedNotes);
  const expandedFolders = useSidePanelStore((s) => s.expandedFolders);
  const setExpandedFolders = useSidePanelStore((s) => s.setExpandedFolders);

  const [settingsFolder, setSettingsFolder] = React.useState<string | null>(null);
  const [renameFolderVal, setRenameFolderVal] = React.useState<string>('');
  const [folderColorVal, setFolderColorVal] = React.useState<string>('');

  const toggleFolderExpanded = (folder: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  // Derive folder list strictly from contextNotes (current tab scope notes)
  const scopeFolders = React.useMemo(() => {
    return [
      ...new Set(contextNotes.map((n) => n.folder).filter(Boolean) as string[]),
    ].sort();
  }, [contextNotes]);

  // Loose notes (not in any folder), sorted with pinned first
  const looseNotes = React.useMemo(() => {
    return contextNotes
      .filter((n) => !n.folder)
      .sort((a, b) => {
        const aPin = pinnedNotes.has(a.id) ? 0 : 1;
        const bPin = pinnedNotes.has(b.id) ? 0 : 1;
        return aPin - bPin;
      });
  }, [contextNotes, pinnedNotes]);

  return (
    <div className={`sp-notes-tree${isDragging ? ' dragging-active' : ''}`} ref={folderMenuRef}>
      {/* 2. Folders & Loose Notes Header */}
      <div className="sp-tree-header">
        <span className="sp-tree-title">{t('folders.title')}</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button
            className="sp-tree-btn"
            onClick={() => setShowNewFolder(true)}
            title={t('folders.addFolder')}
            disabled={tabLoading}
          >
            ＋
          </button>
          <div style={{ position: 'relative' }} ref={templatesRef}>
            <button
              className="sp-tree-btn"
              onClick={() => setShowTemplates(!showTemplates)}
              title={t('templates.insert')}
              disabled={tabLoading}
            >
              ≡
            </button>
            {showTemplates && (
              <div className="sp-templates-dropdown" style={{ top: 'calc(100% + 4px)', right: 0 }}>
                {TEMPLATES.map((tpl) => {
                  const tplKey = tpl.label.toLowerCase().replace(/\s+/g, '').replace('-', '');
                  return (
                    <button
                      key={tpl.label}
                      className="sp-template-item"
                      onClick={() => {
                        applyTemplate(tpl);
                        setShowTemplates(false);
                      }}
                    >
                      {t(`templates.${tplKey}` as TranslationKey, tpl.label)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New folder form */}
      {showNewFolder && (
        <form
          className="sp-tree-new-folder-form"
          onSubmit={(e) => {
            e.preventDefault();
            createFolder();
          }}
        >
          <input
            ref={newFolderRef}
            className="sp-tree-input"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t('folders.newFolder') + '…'}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowNewFolder(false);
                setNewFolderName('');
              }
            }}
          />
          <button type="submit" className="sp-tree-confirm-btn">
            ✓
          </button>
        </form>
      )}

      {/* 3. Vertical scrollable tree list */}
      <div
        className={`sp-tree-list${dragOverFolder === 'loose' ? ' drag-over' : ''}`}
        onDragOver={(e) => handleDragOver(e, 'loose')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        {/* Folders first */}
        {scopeFolders.map((folder) => {
          const isExpanded = !!expandedFolders[folder];
          const folderNotes = contextNotes
            .filter((n) => n.folder === folder)
            .sort((a, b) => {
              const aPin = pinnedNotes.has(a.id) ? 0 : 1;
              const bPin = pinnedNotes.has(b.id) ? 0 : 1;
              return aPin - bPin;
            });
          const color = folderColors[folder];

          return (
            <div key={folder} className="sp-tree-folder-group">
              <div
                className={`sp-tree-folder-row${isExpanded ? ' expanded' : ''}${dragOverFolder === folder ? ' drag-over' : ''}`}
                onClick={() => toggleFolderExpanded(folder)}
                onDragOver={(e) => handleDragOver(e, folder)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder)}
              >
                <div
                  className="sp-tree-folder-pill"
                  style={{ backgroundColor: color || 'transparent' }}
                />
                <span className="sp-tree-folder-chevron">
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="sp-tree-folder-icon">
                  <FolderIcon color={color} />
                </span>
                <span className="sp-tree-folder-name">
                  {folder.replace(/^\//, '')}
                </span>
                <span className="sp-tree-folder-count">
                  ({folderNotes.length})
                </span>

                {/* Add note inside folder shortcut */}
                <button
                  className="sp-tree-folder-menu"
                  style={{ opacity: 1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    addNoteToContext(folder);
                  }}
                  title={t('folders.addNoteInFolder')}
                >
                  ＋
                </button>

                {/* Folder menu ⋯ */}
                <button
                  className="sp-tree-folder-menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSettingsFolder(folder);
                    setRenameFolderVal(folder.replace(/^\//, ''));
                    setFolderColorVal(folderColors[folder] || '');
                  }}
                  title={t('folders.folderOptions')}
                >
                  ⋯
                </button>
              </div>

              {/* Expanded cascade notes inside folder */}
              {isExpanded && (
                <div className="sp-tree-folder-children">
                  {folderNotes.length === 0 ? (
                    <div className="sp-tree-note-empty">{t('folders.noNotesInFolder')}</div>
                  ) : (
                    folderNotes.map((n) => {
                      const isActive = n.id === activeNoteId;
                      const isConfirm = deletePillConfirmId === n.id;
                      const isPinned = pinnedNotes.has(n.id);
                      const noteColor = noteColors[n.id];

                      return (
                        <div
                          key={n.id}
                          className={`sp-tree-note-row${isActive ? ' active' : ''}`}
                          onClick={() => {
                            if (isConfirm) {
                              deletePillNote(n.id);
                            } else {
                              setDeletePillConfirmId(null);
                              selectNote(n);
                            }
                          }}
                          title={isConfirm ? t('folders.clickToConfirmDelete') : n.title || t('folders.untitledNote')}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, n.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <div
                            className="sp-tree-folder-pill"
                            style={{ backgroundColor: noteColor || 'transparent' }}
                          />
                          <span className="sp-tree-note-icon">
                            {isPinned ? ICONS.pin : '📝'}
                          </span>
                          <span className="sp-tree-note-title">
                            {isConfirm ? t('common.confirmDelete') : n.title || t('folders.untitledNote')}
                          </span>
                          {isActive && (
                            <button
                              className="sp-tree-note-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletePillConfirmId(isConfirm ? null : n.id);
                              }}
                              title={t('folders.deleteNote')}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Loose notes at the end */}
        {looseNotes.map((n) => {
          const isActive = n.id === activeNoteId;
          const isConfirm = deletePillConfirmId === n.id;
          const isPinned = pinnedNotes.has(n.id);
          const noteColor = noteColors[n.id];

          return (
            <div
              key={n.id}
              className={`sp-tree-note-row loose${isActive ? ' active' : ''}`}
              onClick={() => {
                if (isConfirm) {
                  deletePillNote(n.id);
                } else {
                  setDeletePillConfirmId(null);
                  selectNote(n);
                }
              }}
              title={isConfirm ? t('folders.clickToConfirmDelete') : n.title || t('folders.untitledNote')}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, n.id)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="sp-tree-folder-pill"
                style={{ backgroundColor: noteColor || 'transparent' }}
              />
              <span className="sp-tree-note-icon">
                {isPinned ? ICONS.pin : '📝'}
              </span>
              <span className="sp-tree-note-title">
                {isConfirm ? t('common.confirmDelete') : n.title || t('folders.untitledNote')}
              </span>
              {isActive && (
                <button
                  className="sp-tree-note-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletePillConfirmId(isConfirm ? null : n.id);
                  }}
                  title={t('folders.deleteNote')}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="sp-tree-divider" />

      {/* 4. Bottom Actions & Settings */}
      <div className="sp-tree-footer">
        <div
          className="sp-tree-nav-row add-btn"
          onClick={() => addNoteToContext()}
          title={t('folders.addNote')}
        >
          <span className="sp-tree-folder-icon">
            <PlusIcon />
          </span>
          <span className="sp-tree-folder-name">{t('folders.addNote')}</span>
        </div>
      </div>

      {/* ── Folder settings modal ── */}
      {settingsFolder && (
        <div className="sp-modal-overlay" onClick={() => setSettingsFolder(null)}>
          <div className="sp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-header">
              <h3>{t('folders.folderSettings')}</h3>
              <button className="sp-modal-close" onClick={() => setSettingsFolder(null)}>✕</button>
            </div>
            <div className="sp-modal-body">
              <div className="sp-field-group">
                <label>{t('folders.folderName')}</label>
                <input
                  type="text"
                  className="sp-modal-input"
                  value={renameFolderVal}
                  onChange={(e) => setRenameFolderVal(e.target.value)}
                  placeholder={t('folders.newFolder') + '...'}
                  autoFocus
                />
              </div>
              <div className="sp-field-group">
                <label>{t('folders.selectColor')}</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setFolderColorVal('')}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'transparent',
                      border: !folderColorVal ? '2px solid var(--accent)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-subtle)',
                      padding: 0,
                    }}
                    title={t('folders.noFolder')}
                  >
                    ✕
                  </button>
                  {WORKSPACE_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFolderColorVal(c.value)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: c.value,
                        border: folderColorVal === c.value ? '2.5px solid var(--text)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="sp-modal-footer">
              <button
                className="btn-danger"
                onClick={async () => {
                  if (confirm(t('folders.confirmDelete', { name: settingsFolder.replace(/^\//, '') }))) {
                    await deleteFolder(settingsFolder);
                    setSettingsFolder(null);
                  }
                }}
              >
                {t('common.delete')}
              </button>
              <div style={{ flex: 1 }} />
              <button
                className="btn-secondary"
                onClick={() => setSettingsFolder(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (!renameFolderVal.trim() || !settingsFolder) return;
                  await renameFolder(settingsFolder, renameFolderVal.trim(), folderColorVal);
                  setSettingsFolder(null);
                }}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NoteTree;
