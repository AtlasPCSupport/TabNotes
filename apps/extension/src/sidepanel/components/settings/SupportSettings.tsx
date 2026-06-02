import React from 'react';
import { useSidePanelStore } from '../../store';
import { useTranslation } from '@tabnotes/i18n';

/**
 * Support + Pro card + About button. Reads only `setView` from the store.
 * Extracted verbatim from the Settings view — no behavior change.
 */
export function SupportSettings() {
  const { t } = useTranslation();
  const setView = useSidePanelStore((s) => s.setView);

  return (
    <>
      <div className="sp-settings-section sp-coffee-section">
        <div className="sp-settings-label">{t('settingsSections.supportTitle')}</div>
        <a
          href="https://www.paypal.com/paypalme/atlaspcsupport"
          target="_blank"
          rel="noopener"
          className="sp-coffee-btn"
        >
          {t('settingsSections.buyCoffee')}
        </a>
      </div>

      <div className="sp-pro-card">
        <div className="sp-pro-title">{t('settingsSections.proTitle')}</div>
        <div className="sp-pro-desc">
          {t('settingsSections.proDesc')}
        </div>
        <a
          href="https://github.com/mikepchelper-spec/TabNotes"
          target="_blank"
          rel="noopener"
          className="sp-pro-btn"
        >
          {t('settingsSections.viewGithub')}
        </a>
      </div>

      <button
        onClick={() => setView('about')}
        style={{
          width: '100%',
          marginTop: 6,
          padding: '10px 14px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          color: 'var(--text-muted)',
          fontSize: 12,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-muted)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
        }}
      >
        <span>✦</span> {t('settingsSections.aboutApp')}
      </button>
    </>
  );
}

export default SupportSettings;
