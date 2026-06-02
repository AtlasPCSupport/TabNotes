import React from 'react';
import { Note, stripFormatting } from '@tabnotes/shared';

/**
 * Visual graph of notes connected by wiki links and shared tags.
 * Extracted verbatim from the side panel monolith (Task 3.1) — no behavior change.
 */
export function NoteGraph({
  notes,
  activeId,
  onSelect,
}: {
  notes: Note[];
  activeId: string | null;
  onSelect: (n: Note) => void;
}) {
  const W = 310,
    H = 280,
    cx = W / 2,
    cy = H / 2;
  const active = notes.find((n) => n.id === activeId);
  const others = notes.filter((n) => n.id !== activeId).slice(0, 9);

  const wikiLinks = new Set<string>();
  if (active) {
    for (const m of [...active.content.matchAll(/\[\[(.+?)\]\]/g)])
      wikiLinks.add(m[1].toLowerCase());
  }

  const nodes = others.map((n, i) => {
    const angle = (i / Math.max(others.length, 1)) * 2 * Math.PI - Math.PI / 2;
    const r = 105;
    const label = stripFormatting(n.title || n.content.trim().split('\n')[0]).slice(0, 10);
    const linked = wikiLinks.has((n.title || '').toLowerCase());
    const shared = active ? active.tags.filter((t) => n.tags.includes(t)).length : 0;
    return {
      note: n,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      label,
      linked,
      shared,
    };
  });

  return (
    <svg width={W} height={H} style={{ display: 'block', margin: 'auto', overflow: 'visible' }}>
      {nodes
        .filter((n) => n.linked || n.shared > 0)
        .map((n, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={n.linked ? '#2b5be8' : '#c8d0e0'}
            strokeWidth={n.linked ? 1.8 : 1}
            strokeDasharray={n.linked ? 'none' : '5 3'}
            opacity={0.65}
          />
        ))}
      {nodes.map((n) => (
        <g key={n.note.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(n.note)}>
          <circle
            cx={n.x}
            cy={n.y}
            r={20}
            fill={n.linked ? '#edf1ff' : 'var(--bg-card, #fff)'}
            stroke={n.linked ? '#2b5be8' : n.shared > 0 ? '#5c83f5' : '#c8d0e0'}
            strokeWidth={n.linked || n.shared > 0 ? 2 : 1}
          />
          <text
            x={n.x}
            y={n.y + 4}
            textAnchor="middle"
            fontSize={8.5}
            fill="var(--text, #222)"
            fontFamily="system-ui,sans-serif"
          >
            {n.label}
          </text>
        </g>
      ))}
      {active && (
        <g>
          <circle cx={cx} cy={cy} r={26} fill="#2b5be8" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize={9}
            fill="#fff"
            fontFamily="system-ui,sans-serif"
            fontWeight="600"
          >
            {(active.title || stripFormatting(active.content).split('\n')[0]).slice(0, 13)}
          </text>
        </g>
      )}
      {!active && (
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          fontSize={11}
          fill="#aaa"
          fontFamily="system-ui"
        >
          No note selected
        </text>
      )}
    </svg>
  );
}

export default NoteGraph;
