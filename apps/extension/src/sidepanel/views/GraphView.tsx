import React from 'react';
import type { Note } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { NoteGraph } from '../editor/NoteGraph';
import { AppIcon } from '../components/AppIcon';
import { useTranslation } from '@tabnotes/i18n';

/**
 * Note graph view. Reads notes + active note from the store; note selection is
 * delegated to the parent (the monolith still owns `selectNote`). Extracted
 * verbatim (Task 3.1/3.4) — no behavior change.
 */
export function GraphView({ onSelectNote }: { onSelectNote: (n: Note) => void }) {
  const { t } = useTranslation();
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);
  const setView = useSidePanelStore((s) => s.setView);

  return (
    <div className="sp-graph-view">
      <div className="sp-graph-header">
        <span className="sp-graph-title">
          <AppIcon name="graph" size={15} /> {t('graph.title')}
        </span>
        <button className="sp-icon-btn" style={{ fontSize: 11 }} onClick={() => setView('note')}>
          <AppIcon name="close" size={13} />
        </button>
      </div>
      <div className="sp-graph-legend">
        <span className="sp-graph-legend-item">
          <span style={{ color: 'var(--accent)' }}>─</span> {t('graph.wikiLink')}
        </span>
        <span className="sp-graph-legend-item">
          <span style={{ color: '#c8d0e0' }}>╌</span> {t('graph.sharedTag')}
        </span>
        <span className="sp-graph-legend-sep" />
        <span
          className="sp-graph-legend-item"
          style={{ color: 'var(--text-subtle)', fontSize: 10 }}
        >
          {t('graph.openNodeHint')}
        </span>
      </div>
      <NoteGraph
        notes={allNotes}
        activeId={activeNoteId}
        onSelect={(n) => {
          onSelectNote(n);
          setView('note');
        }}
      />
      {allNotes.length === 0 && (
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-subtle)',
            fontSize: 13,
            marginTop: 24,
          }}
        >
          {t('graph.empty')}
        </p>
      )}
      <div className="sp-graph-stats">
        <span>{t('noteList.noteCount', { count: allNotes.length })}</span>
        <span>·</span>
        <span>
          {t('graph.withWikiLinks', {
            count: allNotes.filter((n) => /\[\[/.test(n.content)).length,
          })}
        </span>
      </div>
    </div>
  );
}

export default GraphView;
