import React from 'react';
import { useTranslation, Language } from '@tabnotes/i18n';

interface LanguageSettingsProps {
  language: Language;
  setLanguage: (lng: Language) => Promise<void>;
}

export function LanguageSettings({ language, setLanguage }: LanguageSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settings.language')}</div>
      <div className="sp-settings-row" style={{ display: 'block', marginTop: 6 }}>
        <select
          className="sp-settings-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            color: 'var(--text)',
            fontFamily: 'var(--font)',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
    </div>
  );
}

export default LanguageSettings;
