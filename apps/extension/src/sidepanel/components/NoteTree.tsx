import React from 'react';
import type { Note } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';
import { AppIcon } from './AppIcon';

export type TemplateId = 'meeting' | 'todo' | 'research' | 'dailylog';

export interface Template {
  id: TemplateId;
  dynamic?: boolean;
}

export const TEMPLATES: Template[] = [
  { id: 'meeting' },
  { id: 'todo' },
  { id: 'research' },
  { id: 'dailylog', dynamic: true },
];

const WORKSPACE_COLORS = [
  { value: '#2f6dff', key: 'blue' },
  { value: '#ef4444', key: 'red' },
  { value: '#f59e0b', key: 'orange' },
  { value: '#10b981', key: 'green' },
  { value: '#8b5cf6', key: 'purple' },
  { value: '#ec4899', key: 'pink' },
  { value: '#6366f1', key: 'indigo' },
  { value: '#14b8a6', key: 'teal' },
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
    return [...new Set(contextNotes.map((n) => n.folder).filter(Boolean) as string[])].sort();
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
            <AppIcon name="folderPlus" size={15} />
          </button>
          <div style={{ position: 'relative' }} ref={templatesRef}>
            <button
              className="sp-tree-btn"
              onClick={() => setShowTemplates(!showTemplates)}
              title={t('templates.insert')}
              disabled={tabLoading}
            >
              <AppIcon name="template" size={15} />
            </button>
            {showTemplates && (
              <div className="sp-templates-dropdown">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    className="sp-template-item"
                    onClick={() => {
                      applyTemplate(tpl);
                      setShowTemplates(false);
                    }}
                  >
                    {t(`templates.${tpl.id}.label` as TranslationKey)}
                  </button>
                ))}
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
            <AppIcon name="check" size={14} />
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
                  <AppIcon name={isExpanded ? 'chevronDown' : 'chevronRight'} size={13} />
                </span>
                <span className="sp-tree-folder-icon">
                  <AppIcon
                    name="folder"
                    size={18}
                    strokeWidth={2.2}
                    style={{ color: color || 'currentColor' }}
                  />
                </span>
                <span className="sp-tree-folder-name">{folder.replace(/^\//, '')}</span>
                <span className="sp-tree-folder-count">({folderNotes.length})</span>

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
                  <AppIcon name="plus" size={13} />
                </button>

                {/* Folder menu */}
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
                  <AppIcon name="more" size={14} />
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
                          title={
                            isConfirm
                              ? t('folders.clickToConfirmDelete')
                              : n.title || t('folders.untitledNote')
                          }
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, n.id)}
                          onDragEnd={handleDragEnd}
                        >
                          <div
                            className="sp-tree-folder-pill"
                            style={{ backgroundColor: noteColor || 'transparent' }}
                          />
                          <span className="sp-tree-note-icon">
                            <AppIcon name={isPinned ? 'pin' : 'note'} size={13} />
                          </span>
                          <span className="sp-tree-note-title">
                            {isConfirm
                              ? t('common.confirmDelete')
                              : n.title || t('folders.untitledNote')}
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
                              <AppIcon name="close" size={12} />
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
              title={
                isConfirm ? t('folders.clickToConfirmDelete') : n.title || t('folders.untitledNote')
              }
              draggable={true}
              onDragStart={(e) => handleDragStart(e, n.id)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="sp-tree-folder-pill"
                style={{ backgroundColor: noteColor || 'transparent' }}
              />
              <span className="sp-tree-note-icon">
                <AppIcon name={isPinned ? 'pin' : 'note'} size={13} />
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
                  <AppIcon name="close" size={12} />
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
            <AppIcon name="plus" size={18} strokeWidth={2.5} />
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
              <button className="sp-modal-close" onClick={() => setSettingsFolder(null)}>
                <AppIcon name="close" size={14} />
              </button>
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
                      border: !folderColorVal
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
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
                    <AppIcon name="close" size={10} />
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
                        border:
                          folderColorVal === c.value
                            ? '2.5px solid var(--text)'
                            : '1px solid var(--border)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      title={t(`formatting.colors.${c.key}` as TranslationKey)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="sp-modal-footer">
              <button
                className="btn-danger"
                onClick={async () => {
                  if (
                    confirm(t('folders.confirmDelete', { name: settingsFolder.replace(/^\//, '') }))
                  ) {
                    await deleteFolder(settingsFolder);
                    setSettingsFolder(null);
                  }
                }}
              >
                {t('common.delete')}
              </button>
              <div style={{ flex: 1 }} />
              <button className="btn-secondary" onClick={() => setSettingsFolder(null)}>
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
