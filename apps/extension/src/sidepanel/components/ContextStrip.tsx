import React from 'react';
import { normalizeUrl } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { useTranslation } from '@tabnotes/i18n';

/**
 * ContextStrip component.
 * Displays the current context path/key (e.g. page URL, domain, or workspace name)
 * along with the count of notes in this scope and the "Saved" badge.
 * Subscribes to the store for context notes, url, scope, workspace lists, and loading/saved states.
 */
export function ContextStrip({
  tabLoading,
}: {
  tabLoading: boolean;
}) {
  const { t } = useTranslation();
  const scope = useSidePanelStore((s) => s.scope);
  const currentUrl = useSidePanelStore((s) => s.currentUrl);
  const currentDomain = useSidePanelStore((s) => s.currentDomain);
  const workspaces = useSidePanelStore((s) => s.workspaces);
  const activeWorkspaceId = useSidePanelStore((s) => s.activeWorkspaceId);
  const contextNotes = useSidePanelStore((s) => s.contextNotes);
  const saved = useSidePanelStore((s) => s.saved);

  const scopeKey =
    scope === 'url'
      ? normalizeUrl(currentUrl)
      : scope === 'domain'
        ? currentDomain
        : scope === 'workspace'
          ? (workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? t('scope.workspace'))
          : t('scope.global');

  return (
    <div className="sp-context-strip">
      <span className="sp-context-key" title={scopeKey}>
        {tabLoading ? t('common.switching') : scopeKey || '—'}
      </span>
      <div className="sp-context-right">
        {!tabLoading && contextNotes.length > 0 && (
          <span className="sp-context-count">
            {t('noteList.noteCount', { count: contextNotes.length })}
          </span>
        )}
        {saved && (
          <span className="sp-save-badge">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 5L4 7L8 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t('common.savedBadge')}
          </span>
        )}
      </div>
    </div>
  );
}

export default ContextStrip;
