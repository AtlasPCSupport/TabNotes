import React from 'react';
import type { Features } from '../../store/types';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';

const FEATURE_ROWS: { key: keyof Features; label: string; desc: string }[] = [
  {
    key: 'formattingBar',
    label: 'Formatting Toolbar',
    desc: 'B / I / U / color bar above the editor',
  },
  {
    key: 'smartSuggestions',
    label: 'Smart Suggestions',
    desc: 'Related notes appear while you write',
  },
  { key: 'writingStreak', label: 'Writing Streak', desc: 'Day-streak badge in the header' },
  { key: 'wikiLinks', label: 'Wiki Links', desc: '[[Note name]] autocomplete' },
  { key: 'cmdPalette', label: 'Command Palette', desc: 'Ctrl+K quick actions' },
  { key: 'chatView', label: 'Ask Your Notes', desc: 'AI chat tab powered by Groq' },
  { key: 'noteGraph', label: 'Note Graph', desc: 'Visual relationship graph' },
];

/**
 * "Active Features" settings section — the feature-flag toggles. Extracted
 * verbatim from the Settings view — no behavior change.
 */
export function FeatureToggles({
  features,
  toggleFeature,
}: {
  features: Features;
  toggleFeature: (key: keyof Features) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settings.activeFeatures')}</div>
      {FEATURE_ROWS.map((f) => (
        <div key={f.key} className="sp-settings-row" style={{ marginTop: 8 }}>
          <div className="sp-settings-row-info">
            <div className="sp-settings-row-title">{t(`settingsSections.features.${f.key}` as TranslationKey, f.label)}</div>
            <div className="sp-settings-row-desc">{t(`settingsSections.features.${f.key}Desc` as TranslationKey, f.desc)}</div>
          </div>
          <button
            className={`sp-toggle ${features[f.key] ? 'on' : 'off'}`}
            onClick={() => toggleFeature(f.key)}
          >
            <div className="sp-toggle-knob" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default FeatureToggles;
