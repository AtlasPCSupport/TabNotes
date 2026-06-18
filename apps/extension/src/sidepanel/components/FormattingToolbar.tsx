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
  fontSize: number;
  changeFontSize: (dir: 1 | -1) => void;
  fontSizeMinusTitle: string;
  fontSizePlusTitle: string;
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

interface FormatButtonProps {
  className: string;
  active?: boolean;
  disabled?: boolean;
  title: string;
  ariaLabel: string;
  onPress: () => void;
  children: React.ReactNode;
}

function FormatButton({
  className,
  active = false,
  disabled = false,
  title,
  ariaLabel,
  onPress,
  children,
}: FormatButtonProps) {
  return (
    <button
      type="button"
      className={`sp-fmt-btn ${className}${active ? ' sp-fmt-active' : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        if (disabled) return;
        onPress();
      }}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sp-fmt-group" aria-label={`${label} formatting controls`}>
      <span className="sp-fmt-group-label">{label}</span>
      {children}
    </div>
  );
}

export function FormattingToolbar({
  fmtRef,
  fmtActive,
  wrapSel,
  applyColor,
  fontSize,
  changeFontSize,
  fontSizeMinusTitle,
  fontSizePlusTitle,
  showColorPicker,
  setShowColorPicker,
  colorMode,
  setColorMode,
}: FormattingToolbarProps) {
  return (
    <div className="sp-fmt-toolbar" ref={fmtRef} aria-label="Formatting toolbar">
      <ToolbarGroup label="Text">
        <FormatButton
          className="sp-fmt-bold"
          active={fmtActive.bold}
          onPress={() => wrapSel('**', '**')}
          title="Bold (Ctrl+B)"
          ariaLabel="Bold"
        >
          <b>B</b>
        </FormatButton>
        <FormatButton
          className="sp-fmt-italic"
          active={fmtActive.italic}
          onPress={() => wrapSel('*', '*')}
          title="Italic (Ctrl+I)"
          ariaLabel="Italic"
        >
          <em>I</em>
        </FormatButton>
        <FormatButton
          className="sp-fmt-underline"
          active={fmtActive.underline}
          onPress={() => wrapSel('__', '__')}
          title="Underline (Ctrl+U)"
          ariaLabel="Underline"
        >
          <u>U</u>
        </FormatButton>
        <FormatButton
          className="sp-fmt-strike"
          active={fmtActive.strike}
          onPress={() => wrapSel('~~', '~~')}
          title="Strikethrough"
          ariaLabel="Strikethrough"
        >
          <s>S</s>
        </FormatButton>
        <FormatButton
          className="sp-fmt-size-btn sp-fmt-size-minus"
          disabled={fontSize <= 11}
          onPress={() => changeFontSize(-1)}
          title={fontSizeMinusTitle}
          ariaLabel={fontSizeMinusTitle}
        >
          A-
        </FormatButton>
        <FormatButton
          className="sp-fmt-size-btn sp-fmt-size-plus"
          disabled={fontSize >= 16}
          onPress={() => changeFontSize(1)}
          title={fontSizePlusTitle}
          ariaLabel={fontSizePlusTitle}
        >
          A+
        </FormatButton>
      </ToolbarGroup>

      <ToolbarGroup label="Mark">
        <FormatButton
          className="sp-fmt-code"
          active={fmtActive.code}
          onPress={() => wrapSel('`', '`')}
          title="Inline code"
          ariaLabel="Inline code"
        >
          {'</>'}
        </FormatButton>
        <FormatButton
          className="sp-fmt-highlight-btn"
          active={fmtActive.highlight}
          onPress={() => wrapSel('==', '==')}
          title="Highlight selected text"
          ariaLabel="Highlight selected text"
        >
          <span className="sp-fmt-highlight-glyph">H</span>
        </FormatButton>
      </ToolbarGroup>

      <ToolbarGroup label="Color">
        <div className="sp-fmt-color-wrap">
          <button
            type="button"
            className="sp-fmt-btn sp-fmt-color-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorPicker(!showColorPicker);
              setColorMode('text');
            }}
            title="Text / highlight color"
            aria-label="Text and highlight color"
            aria-haspopup="dialog"
            aria-expanded={showColorPicker}
          >
            <span className="sp-fmt-color-glyph">A</span>
          </button>
          {showColorPicker && (
            <div
              className="sp-fmt-color-popup"
              role="dialog"
              aria-label="Choose text or highlight color"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="sp-fmt-color-tabs">
                <button
                  type="button"
                  className={`sp-fmt-mode-btn${colorMode === 'text' ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setColorMode('text');
                  }}
                  aria-pressed={colorMode === 'text'}
                >
                  Text
                </button>
                <button
                  type="button"
                  className={`sp-fmt-mode-btn${colorMode === 'highlight' ? ' active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setColorMode('highlight');
                  }}
                  aria-pressed={colorMode === 'highlight'}
                >
                  Mark
                </button>
              </div>
              <div className="sp-fmt-swatch-grid">
                {(colorMode === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="sp-fmt-swatch"
                    style={{ backgroundColor: c.value }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyColor(c.value, colorMode);
                    }}
                    title={c.name}
                    aria-label={`${c.name} ${colorMode} color`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ToolbarGroup>
    </div>
  );
}

export default FormattingToolbar;
