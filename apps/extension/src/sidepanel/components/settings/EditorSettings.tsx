import React from 'react';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';

/**
 * Editor settings section: markdown preview toggle, font size, text alignment.
 * Receives the relevant state + handlers from the parent. Extracted verbatim
 * from the Settings view — no behavior change.
 */
export function EditorSettings({
  markdownEnabled,
  setMarkdown,
  fontSize,
  changeFontSize,
  defaultAlign,
  setDefaultAlign,
}: {
  markdownEnabled: boolean;
  setMarkdown: (v: boolean) => void;
  fontSize: number;
  changeFontSize: (dir: 1 | -1) => void;
  defaultAlign: 'left' | 'center' | 'right';
  setDefaultAlign: (a: 'left' | 'center' | 'right') => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settingsSections.editor')}</div>

      {/* Markdown preview toggle */}
      <div className="sp-settings-row">
        <div className="sp-settings-row-info">
          <div className="sp-settings-row-title">{t('settingsSections.markdownPreview')}</div>
          <div className="sp-settings-row-desc">{t('settingsSections.markdownPreviewDesc')}</div>
        </div>
        <button
          className={`sp-toggle ${markdownEnabled ? 'on' : 'off'}`}
          onClick={() => setMarkdown(!markdownEnabled)}
        >
          <div className="sp-toggle-knob" />
        </button>
      </div>

      {/* Font size */}
      <div className="sp-settings-row" style={{ marginTop: 10 }}>
        <div className="sp-settings-row-info">
          <div className="sp-settings-row-title">{t('settingsSections.fontSize')}</div>
          <div className="sp-settings-row-desc">{t('settingsSections.fontSizeDesc')}</div>
        </div>
        <div className="sp-fontsize-control">
          <button
            className="sp-fontsize-btn"
            onClick={() => changeFontSize(-1)}
            disabled={fontSize <= 11}
          >
            A−
          </button>
          <span className="sp-fontsize-val">{fontSize}px</span>
          <button
            className="sp-fontsize-btn"
            onClick={() => changeFontSize(1)}
            disabled={fontSize >= 16}
          >
            A+
          </button>
        </div>
      </div>

      {/* Text alignment */}
      <div className="sp-settings-row" style={{ marginTop: 10 }}>
        <div className="sp-settings-row-info">
          <div className="sp-settings-row-title">{t('settingsSections.textAlign')}</div>
          <div className="sp-settings-row-desc">{t('settingsSections.textAlignDesc')}</div>
        </div>
        <div className="sp-align-control">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              className={`sp-align-btn${defaultAlign === a ? ' active' : ''}`}
              onClick={() => setDefaultAlign(a)}
              title={t(`settingsSections.align${a}` as TranslationKey)}
            >
              {a === 'left' ? '⬤◯◯' : a === 'center' ? '◯⬤◯' : '◯◯⬤'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EditorSettings;
