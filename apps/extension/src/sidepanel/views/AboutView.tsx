import React from 'react';
import { useSidePanelStore } from '../store';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { useTranslation, type TranslationKey } from '@tabnotes/i18n';

/** Static About screen. Extracted verbatim (Task 5.2) — no behavior change. */
export function AboutView() {
  const { t } = useTranslation();
  const setView = useSidePanelStore((s) => s.setView);
  const setSettingsTarget = useSidePanelStore((s) => s.setSettingsTarget);
  const categories: {
    titleKey: TranslationKey;
    icon: AppIconName;
    color: string;
    itemKeys: TranslationKey[];
  }[] = [
    {
      titleKey: 'about.categories.editor.title',
      icon: 'note',
      color: 'var(--accent)',
      itemKeys: [
        'about.categories.editor.richText',
        'about.categories.editor.markdown',
        'about.categories.editor.alignment',
        'about.categories.editor.dateTime',
        'about.categories.editor.shortcuts',
      ],
    },
    {
      titleKey: 'about.categories.organization.title',
      icon: 'folder',
      color: '#0ea5e9',
      itemKeys: [
        'about.categories.organization.scopes',
        'about.categories.organization.multipleNotes',
        'about.categories.organization.workspaces',
        'about.categories.organization.tags',
      ],
    },
    {
      titleKey: 'about.categories.productivity.title',
      icon: 'spark',
      color: '#f59e0b',
      itemKeys: [
        'about.categories.productivity.templates',
        'about.categories.productivity.wiki',
        'about.categories.productivity.commands',
        'about.categories.productivity.clipper',
        'about.categories.productivity.streak',
        'about.categories.productivity.reminders',
      ],
    },
    {
      titleKey: 'about.categories.intelligence.title',
      icon: 'graph',
      color: 'var(--accent)',
      itemKeys: [
        'about.categories.intelligence.suggestions',
        'about.categories.intelligence.chat',
        'about.categories.intelligence.graph',
      ],
    },
    {
      titleKey: 'about.categories.privacy.title',
      icon: 'shield',
      color: '#22c55e',
      itemKeys: [
        'about.categories.privacy.history',
        'about.categories.privacy.export',
        'about.categories.privacy.encryption',
        'about.categories.privacy.localFirst',
        'about.categories.privacy.openSource',
      ],
    },
  ];

  return (
    <div className="sp-settings-view">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => {
            setSettingsTarget(null);
            setView('settings');
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ← {t('common.back')}
        </button>
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
          }}
        >
          {t('about.title')}
        </span>
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0 20px' }}>
        <div
          style={{
            width: 48,
            height: 48,
            background: 'linear-gradient(135deg, #f2c735, #dcae19)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-ink)',
            fontSize: 22,
            fontWeight: 800,
            margin: '0 auto 12px',
            boxShadow: '0 4px 16px rgba(220,174,25,0.28)',
          }}
        >
          T
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.4px', marginBottom: 6 }}>
          TabNotes
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            maxWidth: 240,
            margin: '0 auto',
          }}
        >
          {t('about.tagline')}
        </div>
      </div>

      {categories.map((cat) => (
        <div key={cat.titleKey} className="sp-settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 7,
                background: cat.color + '20',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name={cat.icon} size={14} />
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--text)',
                letterSpacing: '-0.2px',
              }}
            >
              {t(cat.titleKey)}
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {cat.itemKeys.map((itemKey) => (
              <li
                key={itemKey}
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <span style={{ color: cat.color, marginTop: 1, flexShrink: 0 }}>•</span>
                {t(itemKey)}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        <a
          href="https://github.com/mikepchelper-spec/TabNotes"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            padding: '10px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {t('about.viewGithub')}
        </a>
        <div
          style={{
            textAlign: 'center',
            fontSize: 10.5,
            color: 'var(--text-subtle)',
            paddingBottom: 4,
          }}
        >
          {t('about.license')}
        </div>
      </div>
    </div>
  );
}

export default AboutView;
