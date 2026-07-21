import React from 'react';
import { Note, formatRelativeTime } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { useTranslation, type TranslationKey } from '@tabnotes/i18n';
import { AppIcon, type AppIconName } from '../components/AppIcon';

export interface ScopeOption {
  value: Note['scope'];
  label: string;
  icon: AppIconName;
  desc: string;
}

/**
 * "All Notes" browser: search, tag filter, scope groups, bulk select/delete,
 * and a new-note FAB. Note collections + pins come from the store; the
 * search/select/delete state and the open/create/delete handlers are passed in
 * (still owned by the monolith during the migration). Extracted verbatim
 * (Task 4.3) — no behavior change.
 */
export function AllNotesView(props: {
  scopeOptions: ScopeOption[];
  filteredNotes: Note[];
  allTags: string[];
  searchQ: string;
  setSearchQ: (v: string) => void;
  tagFilter: string | null;
  setTagFilter: (v: string | null) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  selectedId: string | null;
  setSelectedId: (v: string | null) => void;
  bulkSelectedIds: Set<string>;
  setBulkSelectedIds: (updater: (prev: Set<string>) => Set<string>) => void;
  clearBulkSelection: () => void;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: (v: boolean) => void;
  deleteCardConfirmId: string | null;
  setDeleteCardConfirmId: (v: string | null) => void;
  collapsedScopes: Set<string>;
  toggleScope: (sc: string) => void;
  onOpenNote: (n: Note) => void;
  onDeleteCard: (id: string) => void;
  onBulkDelete: () => void;
  onCreateNote: () => void;
  selectAllInView: () => void;
}) {
  const { t } = useTranslation();
  const {
    scopeOptions,
    filteredNotes,
    allTags,
    searchQ,
    setSearchQ,
    tagFilter,
    setTagFilter,
    selectMode,
    setSelectMode,
    selectedId,
    setSelectedId,
    bulkSelectedIds,
    setBulkSelectedIds,
    clearBulkSelection,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    deleteCardConfirmId,
    setDeleteCardConfirmId,
    collapsedScopes,
    toggleScope,
    onOpenNote,
    onDeleteCard,
    onBulkDelete,
    onCreateNote,
    selectAllInView,
  } = props;

  const pinnedNotes = useSidePanelStore((s) => s.pinnedNotes);

  return (
    <div className="sp-all-view">
      <div className="sp-search-wrap">
        <div className="sp-search-inner">
          <span className="sp-search-icon">
            <AppIcon name="search" size={14} />
          </span>
          <input
            className="sp-search-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t('noteList.searchPlaceholder')}
            autoFocus
          />
          {searchQ && (
            <button
              onClick={() => setSearchQ('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-subtle)',
                fontSize: 12,
                padding: 0,
                fontFamily: 'var(--font)',
              }}
            >
              <AppIcon name="close" size={13} />
            </button>
          )}
        </div>
        <button
          className={`sp-select-toggle${selectMode ? ' active' : ''}`}
          title={selectMode ? t('noteList.cancelSelection') : t('noteList.selectMultiple')}
          onClick={() => {
            setSelectMode(!selectMode);
            clearBulkSelection();
            setBulkDeleteConfirm(false);
            setDeleteCardConfirmId(null);
          }}
        >
          {selectMode ? t('common.cancel') : <AppIcon name="check" size={15} />}
        </button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="sp-tag-chips">
          {tagFilter && (
            <button className="sp-tag-chip clear" onClick={() => setTagFilter(null)}>
              <AppIcon name="close" size={11} /> {t('noteList.clear')}
            </button>
          )}
          {allTags.map((t) => (
            <button
              key={t}
              className={`sp-tag-chip${tagFilter === t ? ' active' : ''}`}
              onClick={() => setTagFilter(tagFilter === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="sp-notes-list">
        {filteredNotes.length === 0 ? (
          <div className="sp-empty-state">
            <div className="sp-empty-icon">
              <AppIcon name="note" size={30} />
            </div>
            <div className="sp-empty-title">
              {searchQ || tagFilter ? t('noteList.noResultsTitle') : t('noteList.noNotesTitle')}
            </div>
            <div className="sp-empty-desc">
              {searchQ
                ? t('noteList.nothingMatched', { query: searchQ })
                : tagFilter
                  ? t('noteList.noTagged', { tag: tagFilter })
                  : t('noteList.startWriting')}
            </div>
          </div>
        ) : (
          scopeOptions
            .map((scopeOpt) => ({
              scopeOpt,
              notes: filteredNotes.filter((n) => n.scope === scopeOpt.value),
            }))
            .map(({ scopeOpt, notes }) => {
              const isCollapsed = collapsedScopes.has(scopeOpt.value);
              return (
                <div key={scopeOpt.value} className="sp-scope-group">
                  <button className="sp-group-header" onClick={() => toggleScope(scopeOpt.value)}>
                    <span className="sp-group-chevron">
                      <AppIcon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={13} />
                    </span>
                    <span className="sp-group-icon">
                      <AppIcon name={scopeOpt.icon} size={14} />
                    </span>
                    <span className="sp-group-label">
                      {t(`scope.${scopeOpt.value}` as TranslationKey)}
                    </span>
                    <span className={`sp-group-count${notes.length === 0 ? ' empty' : ''}`}>
                      {notes.length}
                    </span>
                  </button>

                  {!isCollapsed && notes.length === 0 && (
                    <div className="sp-group-empty">
                      {t('noteList.noScopeNotes', {
                        scope: t(`scope.${scopeOpt.value}` as TranslationKey).toLowerCase(),
                      })}
                    </div>
                  )}

                  {!isCollapsed &&
                    notes.length > 0 &&
                    notes.map((n) => {
                      const isSelected = selectedId === n.id;
                      const isBulkSelected = bulkSelectedIds.has(n.id);
                      return (
                        <div
                          key={n.id}
                          className={`sp-note-card${isSelected ? ' selected' : ''}${deleteCardConfirmId === n.id ? ' delete-confirm' : ''}${selectMode && isBulkSelected ? ' bulk-selected' : ''}${selectMode ? ' select-mode' : ''}`}
                          onClick={(e) => {
                            if (selectMode) {
                              setBulkDeleteConfirm(false);
                              setBulkSelectedIds((prev) => {
                                const next = new Set(prev);
                                next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                                return next;
                              });
                              return;
                            }
                            if ((e.target as HTMLElement).closest('.sp-card-delete')) return;
                            if (deleteCardConfirmId === n.id) {
                              setDeleteCardConfirmId(null);
                              return;
                            }
                            setDeleteCardConfirmId(null);
                            setSelectedId(isSelected ? null : n.id);
                            onOpenNote(n);
                          }}
                        >
                          {selectMode && (
                            <span
                              className={`sp-card-checkbox${isBulkSelected ? ' checked' : ''}`}
                            >
                              {isBulkSelected ? <AppIcon name="check" size={12} /> : ''}
                            </span>
                          )}
                          <div className="sp-card-top">
                            {pinnedNotes.has(n.id) && (
                              <span className="sp-card-pin" title={t('noteList.pinned')}>
                                <AppIcon name="pin" size={12} />
                              </span>
                            )}
                            <span className="sp-card-time">{formatRelativeTime(n.updatedAt)}</span>
                            {!selectMode && (
                              <button
                                className={`sp-card-delete${deleteCardConfirmId === n.id ? ' confirming' : ''}`}
                                title={
                                  deleteCardConfirmId === n.id
                                    ? t('noteList.clickToConfirmDelete')
                                    : t('noteList.deleteNote')
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (deleteCardConfirmId === n.id) {
                                    onDeleteCard(n.id);
                                  } else {
                                    setDeleteCardConfirmId(n.id);
                                  }
                                }}
                              >
                                {deleteCardConfirmId === n.id ? (
                                  t('common.confirmDelete')
                                ) : (
                                  <AppIcon name="trash" size={13} />
                                )}
                              </button>
                            )}
                          </div>
                          {n.title && <div className="sp-card-title">{n.title}</div>}
                          {n.content && <div className="sp-card-excerpt">{n.content}</div>}
                          {n.tags.length > 0 && (
                            <div className="sp-card-tags">
                              {n.tags.slice(0, 4).map((t) => (
                                <span key={t} className="sp-card-tag">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="sp-card-scope-ctx">
                            <span className="sp-card-scope-icon">
                              <AppIcon
                                name={
                                  scopeOptions.find((s) => s.value === n.scope)?.icon ?? 'note'
                                }
                                size={11}
                              />
                            </span>
                            <span className="sp-card-scope-key">{n.scopeKey || n.scope}</span>
                            {n.scope === 'url' && n.scopeKey && (
                              <a
                                href={n.scopeKey}
                                target="_blank"
                                rel="noopener"
                                className="sp-card-open-url"
                                onClick={(e) => e.stopPropagation()}
                                title={t('noteList.openUrl')}
                              >
                                <AppIcon name="arrowUpRight" size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div className="sp-bulk-bar">
          <span className="sp-bulk-count">
            {bulkSelectedIds.size === 0
              ? t('noteList.tapToSelect')
              : t('noteList.selected', { count: bulkSelectedIds.size })}
          </span>
          {bulkSelectedIds.size > 0 && (
            <>
              <button className="sp-bulk-select-all" onClick={selectAllInView}>
                {bulkSelectedIds.size === filteredNotes.length
                  ? t('noteList.deselectAll')
                  : t('noteList.selectAll')}
              </button>
              <button
                className={`sp-bulk-delete${bulkDeleteConfirm ? ' confirming' : ''}`}
                onClick={() => {
                  if (bulkDeleteConfirm) {
                    onBulkDelete();
                  } else {
                    setBulkDeleteConfirm(true);
                  }
                }}
              >
                {bulkDeleteConfirm
                  ? t('noteList.confirmDeleteSelected', { count: bulkSelectedIds.size })
                  : t('noteList.deleteCount', { count: bulkSelectedIds.size })}
              </button>
            </>
          )}
        </div>
      )}

      <button className="sp-fab" title={t('noteList.newNote')} onClick={onCreateNote}>
        <AppIcon name="plus" size={20} strokeWidth={2.6} />
      </button>
    </div>
  );
}

export default AllNotesView;
