import React from 'react';
import type { Workspace } from '@tabnotes/shared';
import { useTranslation, type Language } from '@tabnotes/i18n';
import { useSidePanelStore } from '../store';
import { AppIcon } from './AppIcon';

const USFlag = () => (
  <svg viewBox="0 0 19 13" width="16" height="11" style={{ borderRadius: '1.5px', display: 'block' }}>
    <rect width="19" height="13" fill="#ffffff" />
    <rect width="19" height="1" fill="#b22234" />
    <rect y="2" width="19" height="1" fill="#b22234" />
    <rect y="4" width="19" height="1" fill="#b22234" />
    <rect y="6" width="19" height="1" fill="#b22234" />
    <rect y="8" width="19" height="1" fill="#b22234" />
    <rect y="10" width="19" height="1" fill="#b22234" />
    <rect y="12" width="19" height="1" fill="#b22234" />
    <rect width="8" height="7" fill="#3c3b6e" />
    <circle cx="2" cy="1.75" r="0.45" fill="#ffffff" />
    <circle cx="4" cy="1.75" r="0.45" fill="#ffffff" />
    <circle cx="6" cy="1.75" r="0.45" fill="#ffffff" />
    <circle cx="3" cy="3.5" r="0.45" fill="#ffffff" />
    <circle cx="5" cy="3.5" r="0.45" fill="#ffffff" />
    <circle cx="2" cy="5.25" r="0.45" fill="#ffffff" />
    <circle cx="4" cy="5.25" r="0.45" fill="#ffffff" />
    <circle cx="6" cy="5.25" r="0.45" fill="#ffffff" />
  </svg>
);

const ESFlag = () => (
  <svg viewBox="0 0 3 2" width="16" height="11" style={{ borderRadius: '1.5px', display: 'block' }}>
    <rect width="3" height="2" fill="#c60b1e" />
    <rect y="0.5" width="3" height="1" fill="#ffc400" />
  </svg>
);

/**
 * Top header: logo, workspace quick-switcher dropdown, and action buttons
 * (streak, offline indicator, graph toggle, theme toggle, settings).
 *
 * View/theme/workspace data come from the store; workspace switching and the
 * dropdown open-state are passed in (the switch handler reloads context notes
 * in the monolith). Extracted verbatim — no behavior change.
 */
export function HeaderBar({
  activeWs,
  wsDropdown,
  setWsDropdown,
  wsDropdownRef,
  onSwitchWorkspace,
  onToggleTheme,
  tabLoading,
  streak,
  isOnline,
  pendingSyncCount,
  syncedToast,
  language,
  setLanguage,
}: {
  activeWs: Workspace | undefined;
  wsDropdown: boolean;
  setWsDropdown: (v: boolean) => void;
  wsDropdownRef: React.RefObject<HTMLDivElement>;
  onSwitchWorkspace: (id: string | null) => void;
  onToggleTheme: () => void;
  tabLoading: boolean;
  streak: number;
  isOnline: boolean;
  pendingSyncCount: number;
  syncedToast: boolean;
  language: Language;
  setLanguage: (lng: Language) => Promise<void>;
}) {
  const { t } = useTranslation();
  const view = useSidePanelStore((s) => s.view);
  const setView = useSidePanelStore((s) => s.setView);
  const setSettingsTarget = useSidePanelStore((s) => s.setSettingsTarget);
  const theme = useSidePanelStore((s) => s.theme);
  const workspaces = useSidePanelStore((s) => s.workspaces);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);
  const features = useSidePanelStore((s) => s.features);

  return (
    <div className="sp-header">
      <div className="sp-logo">
        <div className="sp-logo-mark">T</div>
        <span className="sp-logo-text">TabNotes</span>
      </div>
      <div className="sp-ws-dropdown-wrap" ref={wsDropdownRef}>
        <div
          className={`sp-workspace-pill${wsDropdown ? ' open' : ''}`}
          onClick={() => setWsDropdown(!wsDropdown)}
        >
          <div
            className="sp-workspace-dot"
            style={{
              background: activeWs ? activeWs.color || 'var(--accent)' : 'var(--text-subtle)',
            }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>
            {activeWs ? activeWs.name : t('header.noWorkspace')}
          </span>
          <span className="sp-ws-chevron">
            <AppIcon name={wsDropdown ? 'chevronUp' : 'chevronDown'} size={12} />
          </span>
        </div>
        {wsDropdown && (
          <div className="sp-ws-dropdown">
            <div
              className={`sp-ws-option${activeWorkspaceId === null ? ' active' : ''}`}
              onClick={() => onSwitchWorkspace(null)}
            >
              <AppIcon name="global" size={14} /> {t('header.noWorkspace')}
              {activeWorkspaceId === null && (
                <span className="sp-ws-check">
                  <AppIcon name="check" size={13} />
                </span>
              )}
            </div>
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={`sp-ws-option${activeWorkspaceId === ws.id ? ' active' : ''}`}
                onClick={() => onSwitchWorkspace(ws.id)}
              >
                <span
                  className="sp-workspace-dot"
                  style={{
                    background: ws.color || 'var(--accent)',
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    marginRight: 8,
                    flexShrink: 0,
                  }}
                />
                {ws.name}
                {activeWorkspaceId === ws.id && (
                  <span className="sp-ws-check">
                    <AppIcon name="check" size={13} />
                  </span>
                )}
              </div>
            ))}
            <div className="sp-ws-divider" />
            <div
              className="sp-ws-option manage"
              onClick={() => {
                setWsDropdown(false);
                setSettingsTarget('workspace');
                setView('settings');
              }}
            >
              <AppIcon name="settings" size={14} /> {t('header.manageWorkspaces')}
            </div>
          </div>
        )}
      </div>

      <div className="sp-lang-selector">
        <button
          className={`sp-lang-flag-btn${language === 'en' ? ' active' : ''}`}
          onClick={() => setLanguage('en')}
          title="English"
        >
          <USFlag />
        </button>
        <button
          className={`sp-lang-flag-btn${language === 'es' ? ' active' : ''}`}
          onClick={() => setLanguage('es')}
          title="Español"
        >
          <ESFlag />
        </button>
      </div>

      <div className="sp-header-actions">
        {tabLoading && (
          <div className="sp-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
        )}

        {/* Writing streak */}
        {features.writingStreak && streak >= 2 && (
          <div className="tn-streak-badge" title={t('header.streakTitle', { count: streak })}>
            <AppIcon name="flame" size={13} /> {streak}
          </div>
        )}

        {/* Connection status indicator */}
        {!isOnline && (
          <div
            className="tn-offline-badge"
            title={
              pendingSyncCount > 0
                ? t('header.offlineQueued', { count: pendingSyncCount })
                : t('header.offlineSaved')
            }
          >
            <span className="tn-offline-dot" />
            {pendingSyncCount > 0 && <span className="tn-offline-count">{pendingSyncCount}</span>}
          </div>
        )}
        {syncedToast && (
          <div className="tn-synced-toast">
            <AppIcon name="check" size={12} /> {t('header.allSynced')}
          </div>
        )}

        {features.noteGraph && (
          <button
            className={`sp-icon-btn${view === 'graph' ? ' active' : ''}`}
            onClick={() => setView(view === 'graph' ? 'note' : 'graph')}
            title={t('header.noteGraph')}
          >
            <AppIcon name="graph" size={15} />
          </button>
        )}
          <button
          className="sp-icon-btn"
          onClick={onToggleTheme}
          title={t('header.toggleTheme')}
        >
          <AppIcon name={theme === 'dark' ? 'light' : 'dark'} size={15} />
        </button>
        <button
          className="sp-icon-btn"
          onClick={() => {
            setSettingsTarget(null);
            setView('settings');
          }}
          title={t('header.settings')}
        >
          <AppIcon name="settings" size={15} />
        </button>
      </div>
    </div>
  );
}

export default HeaderBar;
