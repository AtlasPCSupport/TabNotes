import React from 'react';

export interface FormattingToolbarProps {
  fmtRef: React.RefObject<HTMLDivElement>;
  fmtActive: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    code: boolean;
    highlight: boolean;
  };
  wrapSel: (prefix: string, suffix?: string) => void;
  applyColor: (color: string, mode: 'text' | 'highlight') => void;
  showColorPicker: boolean;
  setShowColorPicker: (v: boolean) => void;
  colorMode: 'text' | 'highlight';
  setColorMode: (v: 'text' | 'highlight') => void;
}

const TEXT_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2b5be8' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Gray', value: '#6b7280' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Purple', value: '#e9d5ff' },
];

export function FormattingToolbar({
  fmtRef,
  fmtActive,
  wrapSel,
  applyColor,
  showColorPicker,
  setShowColorPicker,
  colorMode,
  setColorMode,
}: FormattingToolbarProps) {
  return (
    <div className="sp-fmt-toolbar" ref={fmtRef}>
      <button
        className={`sp-fmt-btn sp-fmt-bold${fmtActive.bold ? ' sp-fmt-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          wrapSel('**', '**');
        }}
        title="Bold (Ctrl+B)"
      >
        <b>B</b>
      </button>
      <button
        className={`sp-fmt-btn sp-fmt-italic${fmtActive.italic ? ' sp-fmt-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          wrapSel('*', '*');
        }}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button
        className={`sp-fmt-btn sp-fmt-underline${fmtActive.underline ? ' sp-fmt-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          wrapSel('__', '__');
        }}
        title="Underline (Ctrl+U)"
      >
        <u>U</u>
      </button>
      <button
        className={`sp-fmt-btn sp-fmt-strike${fmtActive.strike ? ' sp-fmt-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          wrapSel('~~', '~~');
        }}
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <button
        className={`sp-fmt-btn sp-fmt-code${fmtActive.code ? ' sp-fmt-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          wrapSel('`', '`');
        }}
        title="Inline code"
      >
        {'</>'}
      </button>
      <div className="sp-fmt-sep" />
      {/* Highlight — yellow background on selected text */}
      <button
        className={`sp-fmt-btn sp-fmt-highlight-btn${fmtActive.highlight ? ' sp-fmt-active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          wrapSel('==', '==');
        }}
        title="Highlight selected text"
      >
        <span
          style={{
            background: fmtActive.highlight ? 'transparent' : '#fef08a',
            padding: '0 3px',
            borderRadius: 2,
            color: fmtActive.highlight ? 'inherit' : '#333',
          }}
        >
          H
        </span>
      </button>
      {/* Text & highlight color picker */}
      <div style={{ position: 'relative' }}>
        <button
          className="sp-fmt-btn sp-fmt-color-btn"
          onMouseDown={(e) => {
            e.preventDefault();
            setShowColorPicker(!showColorPicker);
            setColorMode('text');
          }}
          title="Text / highlight color"
        >
          <span
            style={{
              borderBottom: '3px solid currentColor',
              paddingBottom: 1,
              fontWeight: 700,
            }}
          >
            A
          </span>
        </button>
        {showColorPicker && (
          <div
            className="sp-fmt-color-popup"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <button
                style={{
                  flex: 1,
                  fontSize: 9,
                  padding: '2px 4px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background:
                    colorMode === 'text' ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: colorMode === 'text' ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setColorMode('text');
                }}
              >
                Text
              </button>
              <button
                style={{
                  flex: 1,
                  fontSize: 9,
                  padding: '2px 4px',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background:
                    colorMode === 'highlight' ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: colorMode === 'highlight' ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setColorMode('highlight');
                }}
              >
                Mark
              </button>
            </div>
            {colorMode === 'text'
              ? TEXT_COLORS.map((c) => (
                  <div
                    key={c.value}
                    className="sp-fmt-swatch"
                    style={{ background: c.value }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyColor(c.value, 'text');
                    }}
                    title={c.name}
                  />
                ))
              : HIGHLIGHT_COLORS.map((c) => (
                  <div
                    key={c.value}
                    className="sp-fmt-swatch"
                    style={{ background: c.value }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyColor(c.value, 'highlight');
                    }}
                    title={c.name}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FormattingToolbar;
