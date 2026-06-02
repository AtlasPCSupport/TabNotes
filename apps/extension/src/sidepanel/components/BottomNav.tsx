import React from 'react';
import { useSidePanelStore } from '../store';
import { ICONS } from '../icons';
import { useTranslation } from '@tabnotes/i18n';

/**
 * Persistent bottom navigation. Reads view + chat feature flag from the store;
 * note count and groq-key indicator are passed in (still owned by the monolith
 * during the migration). Extracted verbatim (Task 3.2) — no behavior change.
 */
export function BottomNav({
  allNotesCount,
  groqKey,
}: {
  allNotesCount: number;
  groqKey: string;
}) {
  const { t } = useTranslation();
  const view = useSidePanelStore((s) => s.view);
  const setView = useSidePanelStore((s) => s.setView);
  const chatEnabled = useSidePanelStore((s) => s.features.chatView);

  return (
    <div className="sp-bottom-nav">
      <button
        className={`sp-nav-btn${view === 'note' ? ' active' : ''}`}
        onClick={() => setView('note')}
      >
        <span className="sp-nav-icon">{ICONS.note}</span>
        <span className="sp-nav-label">{t('nav.note')}</span>
      </button>
      <button
        className={`sp-nav-btn${view === 'all' ? ' active' : ''}`}
        onClick={() => setView('all')}
      >
        <span className="sp-nav-icon">{ICONS.list}</span>
        <span className="sp-nav-label">{t('nav.allNotes')}</span>
        {allNotesCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 'calc(50% - 18px)',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 8,
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: 99,
              minWidth: 14,
              textAlign: 'center',
              lineHeight: '14px',
            }}
          >
            {allNotesCount}
          </span>
        )}
      </button>
      {chatEnabled && (
        <button
          className={`sp-nav-btn${view === 'chat' ? ' active' : ''}`}
          onClick={() => setView('chat')}
        >
          <span className="sp-nav-icon">{ICONS.chat}</span>
          <span className="sp-nav-label">{t('nav.ask')}</span>
          {groqKey && <span className="sp-nav-ai-dot" />}
        </button>
      )}
      <button
        className={`sp-nav-btn${view === 'settings' ? ' active' : ''}`}
        onClick={() => setView('settings')}
      >
        <span className="sp-nav-icon">{ICONS.settings}</span>
        <span className="sp-nav-label">{t('nav.settings')}</span>
      </button>
    </div>
  );
}

export default BottomNav;
