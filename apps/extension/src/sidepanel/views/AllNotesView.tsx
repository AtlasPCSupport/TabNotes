import React from 'react';
import { Note, formatRelativeTime } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { ICONS } from '../icons';

export interface ScopeOption {
  value: Note['scope'];
  label: string;
  icon: string;
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
          <span className="sp-search-icon">⌕</span>
          <input
            className="sp-search-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search notes, titles, tags…"
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
              ✕
            </button>
          )}
        </div>
        <button
          className={`sp-select-toggle${selectMode ? ' active' : ''}`}
          title={selectMode ? 'Cancel selection' : 'Select multiple notes'}
          onClick={() => {
            setSelectMode(!selectMode);
            clearBulkSelection();
            setBulkDeleteConfirm(false);
            setDeleteCardConfirmId(null);
          }}
        >
          {selectMode ? 'Cancel' : '☑'}
        </button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="sp-tag-chips">
          {tagFilter && (
            <button className="sp-tag-chip clear" onClick={() => setTagFilter(null)}>
              ✕ Clear
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
            <div className="sp-empty-icon">{ICONS.note}</div>
            <div className="sp-empty-title">
              {searchQ || tagFilter ? 'No results' : 'No notes yet'}
            </div>
            <div className="sp-empty-desc">
              {searchQ
                ? `Nothing matched "${searchQ}"`
                : tagFilter
                  ? `No notes tagged #${tagFilter}`
                  : 'Switch to Note tab and start writing.'}
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
                    <span className="sp-group-chevron">{isCollapsed ? '▸' : '▾'}</span>
                    <span className="sp-group-icon">{scopeOpt.icon}</span>
                    <span className="sp-group-label">{scopeOpt.label}</span>
                    <span className={`sp-group-count${notes.length === 0 ? ' empty' : ''}`}>
                      {notes.length}
                    </span>
                  </button>

                  {!isCollapsed && notes.length === 0 && (
                    <div className="sp-group-empty">
                      No {scopeOpt.label.toLowerCase()} notes yet
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
                              {isBulkSelected ? '✓' : ''}
                            </span>
                          )}
                          <div className="sp-card-top">
                            {pinnedNotes.has(n.id) && (
                              <span className="sp-card-pin" title="Pinned">
                                {ICONS.pin}
                              </span>
                            )}
                            <span className="sp-card-time">{formatRelativeTime(n.updatedAt)}</span>
                            {!selectMode && (
                              <button
                                className={`sp-card-delete${deleteCardConfirmId === n.id ? ' confirming' : ''}`}
                                title={
                                  deleteCardConfirmId === n.id
                                    ? 'Click to confirm delete'
                                    : 'Delete note'
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
                                {deleteCardConfirmId === n.id ? 'Delete?' : ICONS.trash}
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
                              {scopeOptions.find((s) => s.value === n.scope)?.icon}
                            </span>
                            <span className="sp-card-scope-key">{n.scopeKey || n.scope}</span>
                            {n.scope === 'url' && n.scopeKey && (
                              <a
                                href={n.scopeKey}
                                target="_blank"
                                rel="noopener"
                                className="sp-card-open-url"
                                onClick={(e) => e.stopPropagation()}
                                title="Open this URL"
                              >
                                ↗
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
              ? 'Tap notes to select'
              : `${bulkSelectedIds.size} selected`}
          </span>
          {bulkSelectedIds.size > 0 && (
            <>
              <button className="sp-bulk-select-all" onClick={selectAllInView}>
                {bulkSelectedIds.size === filteredNotes.length ? 'Deselect all' : 'Select all'}
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
                  ? `Confirm delete ${bulkSelectedIds.size}`
                  : `Delete ${bulkSelectedIds.size}`}
              </button>
            </>
          )}
        </div>
      )}

      <button className="sp-fab" title="New note" onClick={onCreateNote}>
        +
      </button>
    </div>
  );
}

export default AllNotesView;
