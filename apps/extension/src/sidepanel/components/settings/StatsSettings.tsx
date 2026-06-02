import React from 'react';
import { useSidePanelStore } from '../../store';
import { useTranslation } from '@tabnotes/i18n';

/**
 * Stats settings section — note/workspace/tag counts. Reads entirely from the
 * store. Extracted verbatim from the Settings view — no behavior change.
 */
export function StatsSettings() {
  const { t } = useTranslation();
  const allNotes = useSidePanelStore((s) => s.allNotes);
  const workspaces = useSidePanelStore((s) => s.workspaces);

  const stats = [
    { label: t('settingsSections.statsNotes'), value: allNotes.length },
    { label: t('settingsSections.statsWorkspaces'), value: workspaces.length },
    { label: t('settingsSections.statsTags'), value: [...new Set(allNotes.flatMap((n) => n.tags))].length },
  ];

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settingsSections.statsTitle')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              padding: '10px 8px',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px' }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 1 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StatsSettings;
