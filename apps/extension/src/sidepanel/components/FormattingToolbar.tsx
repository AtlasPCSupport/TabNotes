import React from 'react';
import { useTranslation, type TranslationKey } from '@tabnotes/i18n';

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
  { key: 'red', value: '#ef4444' },
  { key: 'orange', value: '#f97316' },
  { key: 'yellow', value: '#ca8a04' },
  { key: 'green', value: '#16a34a' },
  { key: 'blue', value: '#2b5be8' },
  { key: 'purple', value: '#9333ea' },
  { key: 'pink', value: '#db2777' },
  { key: 'gray', value: '#6b7280' },
];

const HIGHLIGHT_COLORS = [
  { key: 'yellow', value: '#fef08a' },
  { key: 'green', value: '#bbf7d0' },
  { key: 'blue', value: '#bfdbfe' },
  { key: 'pink', value: '#fbcfe8' },
  { key: 'orange', value: '#fed7aa' },
  { key: 'purple', value: '#e9d5ff' },
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

function ToolbarGroup({
  label,
  ariaLabel,
  children,
}: {
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-fmt-group" aria-label={ariaLabel}>
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
  const { t } = useTranslation();

  return (
    <div className="sp-fmt-toolbar" ref={fmtRef} aria-label={t('formatting.toolbar')}>
      <ToolbarGroup
        label={t('formatting.text')}
        ariaLabel={t('formatting.groupControls', { label: t('formatting.text') })}
      >
        <FormatButton
          className="sp-fmt-bold"
          active={fmtActive.bold}
          onPress={() => wrapSel('**', '**')}
          title={t('formatting.boldTitle')}
          ariaLabel={t('formatting.bold')}
        >
          <b>B</b>
        </FormatButton>
        <FormatButton
          className="sp-fmt-italic"
          active={fmtActive.italic}
          onPress={() => wrapSel('*', '*')}
          title={t('formatting.italicTitle')}
          ariaLabel={t('formatting.italic')}
        >
          <em>I</em>
        </FormatButton>
        <FormatButton
          className="sp-fmt-underline"
          active={fmtActive.underline}
          onPress={() => wrapSel('__', '__')}
          title={t('formatting.underlineTitle')}
          ariaLabel={t('formatting.underline')}
        >
          <u>U</u>
        </FormatButton>
        <FormatButton
          className="sp-fmt-strike"
          active={fmtActive.strike}
          onPress={() => wrapSel('~~', '~~')}
          title={t('formatting.strikethrough')}
          ariaLabel={t('formatting.strikethrough')}
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

      <ToolbarGroup
        label={t('formatting.mark')}
        ariaLabel={t('formatting.groupControls', { label: t('formatting.mark') })}
      >
        <FormatButton
          className="sp-fmt-code"
          active={fmtActive.code}
          onPress={() => wrapSel('`', '`')}
          title={t('formatting.inlineCode')}
          ariaLabel={t('formatting.inlineCode')}
        >
          {'</>'}
        </FormatButton>
        <FormatButton
          className="sp-fmt-highlight-btn"
          active={fmtActive.highlight}
          onPress={() => wrapSel('==', '==')}
          title={t('formatting.highlight')}
          ariaLabel={t('formatting.highlight')}
        >
          <span className="sp-fmt-highlight-glyph">H</span>
        </FormatButton>
      </ToolbarGroup>

      <ToolbarGroup
        label={t('formatting.color')}
        ariaLabel={t('formatting.groupControls', { label: t('formatting.color') })}
      >
        <div className="sp-fmt-color-wrap">
          <button
            type="button"
            className="sp-fmt-btn sp-fmt-color-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColorPicker(!showColorPicker);
              setColorMode('text');
            }}
            title={t('formatting.textHighlightColor')}
            aria-label={t('formatting.textAndHighlightColor')}
            aria-haspopup="dialog"
            aria-expanded={showColorPicker}
          >
            <span className="sp-fmt-color-glyph">A</span>
          </button>
          {showColorPicker && (
            <div
              className="sp-fmt-color-popup"
              role="dialog"
              aria-label={t('formatting.chooseColor')}
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
                  {t('formatting.text')}
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
                  {t('formatting.mark')}
                </button>
              </div>
              <div className="sp-fmt-swatch-grid">
                {(colorMode === 'text' ? TEXT_COLORS : HIGHLIGHT_COLORS).map((c) => {
                  const name = t(`formatting.colors.${c.key}` as TranslationKey);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className="sp-fmt-swatch"
                      style={{ backgroundColor: c.value }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyColor(c.value, colorMode);
                      }}
                      title={name}
                      aria-label={t(
                        colorMode === 'text'
                          ? 'formatting.textColor'
                          : 'formatting.highlightColor',
                        { name }
                      )}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ToolbarGroup>
    </div>
  );
}

export default FormattingToolbar;
