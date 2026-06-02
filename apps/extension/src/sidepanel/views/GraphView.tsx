import React from 'react';
import type { Note } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { ICONS } from '../icons';
import { NoteGraph } from '../editor/NoteGraph';

/**
 * Note graph view. Reads notes + active note from the store; note selection is
 * delegated to the parent (the monolith still owns `selectNote`). Extracted
 * verbatim (Task 3.1/3.4) — no behavior change.
 */
export function GraphView({ onSelectNote }: { onSelectNote: (n: Note) => void }) {
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);
  const setView = useSidePanelStore((s) => s.setView);

  return (
    <div className="sp-graph-view">
      <div className="sp-graph-header">
        <span className="sp-graph-title">{ICONS.graph} Note Graph</span>
        <button className="sp-icon-btn" style={{ fontSize: 11 }} onClick={() => setView('note')}>
          ✕
        </button>
      </div>
      <div className="sp-graph-legend">
        <span className="sp-graph-legend-item">
          <span style={{ color: '#2b5be8' }}>─</span> Wiki link
        </span>
        <span className="sp-graph-legend-item">
          <span style={{ color: '#c8d0e0' }}>╌</span> Shared tag
        </span>
        <span className="sp-graph-legend-sep" />
        <span
          className="sp-graph-legend-item"
          style={{ color: 'var(--text-subtle)', fontSize: 10 }}
        >
          Click a node to open note
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
          No notes yet. Create some notes to see the graph.
        </p>
      )}
      <div className="sp-graph-stats">
        <span>
          {allNotes.length} note{allNotes.length !== 1 ? 's' : ''}
        </span>
        <span>·</span>
        <span>{allNotes.filter((n) => /\[\[/.test(n.content)).length} with wiki links</span>
      </div>
    </div>
  );
}

export default GraphView;
