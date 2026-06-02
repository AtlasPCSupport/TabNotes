import React from 'react';
import { Note, stripFormatting, renderMarkdown } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';

export interface ReferencePanelProps {
  refNoteId: string | null;
  setRefNoteId: (id: string | null) => void;
  setShowRefPanel: (v: boolean) => void;
}

function pillLabel(n: Note, idx: number): string {
  if (n.title?.trim()) return stripFormatting(n.title.trim()).slice(0, 18) || `Note ${idx + 1}`;
  const plain = stripFormatting(n.content);
  if (plain.trim()) {
    const first = plain.split('\n')[0];
    return first.length > 18 ? first.slice(0, 18) + '…' : first || `Note ${idx + 1}`;
  }
  return `Note ${idx + 1}`;
}

export function ReferencePanel({
  refNoteId,
  setRefNoteId,
  setShowRefPanel,
}: ReferencePanelProps) {
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const contextNotes = useSidePanelStore((s) => s.contextNotes);
  const activeNoteId = useSidePanelStore((s) => s.activeNoteId);

  return (
    <div className="sp-ref-panel">
      <div className="sp-ref-panel-header">
        <span className="sp-ref-panel-title">Reference</span>
        <button
          className="sp-icon-btn"
          style={{ fontSize: 11 }}
          onClick={() => {
            setRefNoteId(null);
            setShowRefPanel(false);
          }}
        >
          ✕
        </button>
      </div>
      {refNoteId === null ? (
        <div className="sp-ref-note-list">
          {contextNotes.filter((n) => n.id !== activeNoteId).length === 0 ? (
            <div className="sp-ref-empty">No other notes in this scope to reference.</div>
          ) : (
            contextNotes
              .filter((n) => n.id !== activeNoteId)
              .map((n, i) => (
                <button
                  key={n.id}
                  className="sp-ref-note-item"
                  onClick={() => setRefNoteId(n.id)}
                >
                  <span className="sp-ref-note-label">{pillLabel(n, i)}</span>
                  <span className="sp-ref-note-preview">
                    {stripFormatting(n.content).slice(0, 60) || '—'}
                  </span>
                </button>
              ))
          )}
          {allNotes
            .filter((n) => n.id !== activeNoteId && !contextNotes.find((c) => c.id === n.id))
            .slice(0, 8)
            .map((n, i) => (
              <button
                key={n.id}
                className="sp-ref-note-item"
                onClick={() => setRefNoteId(n.id)}
              >
                <span className="sp-ref-note-label">{pillLabel(n, i)}</span>
                <span className="sp-ref-note-preview" style={{ color: 'var(--text-subtle)' }}>
                  {n.scope} · {stripFormatting(n.content).slice(0, 40) || '—'}
                </span>
              </button>
            ))}
        </div>
      ) : (
        (() => {
          const rn = allNotes.find((n) => n.id === refNoteId);
          if (!rn) return null;
          return (
            <div className="sp-ref-note-view">
              <div className="sp-ref-note-view-header">
                <button className="sp-ref-back" onClick={() => setRefNoteId(null)}>
                  ← Back
                </button>
                <span className="sp-ref-note-view-title">{rn.title || pillLabel(rn, 0)}</span>
              </div>
              <div
                className="sp-ref-note-content sp-markdown-preview"
                dangerouslySetInnerHTML={{
                  __html: rn.content
                    ? renderMarkdown(rn.content)
                    : '<p style="color:var(--text-subtle);font-style:italic">Empty note</p>',
                }}
              />
            </div>
          );
        })()
      )}
    </div>
  );
}

export default ReferencePanel;
