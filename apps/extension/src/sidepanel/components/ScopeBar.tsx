import React from 'react';
import type { NoteScope } from '@tabnotes/shared';
import { useSidePanelStore } from '../store';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';
import { AppIcon, type AppIconName } from './AppIcon';

export interface ScopeOption {
  value: NoteScope;
  label: string;
  icon: AppIconName;
  desc: string;
}

/**
 * Scope selector bar (URL / Domain / Projects / Global) shown in the Note view.
 * Reads the active scope from the store; the change handler is passed in (it
 * also reloads context notes in the monolith). Extracted verbatim — no behavior
 * change.
 */
export function ScopeBar({
  scopeOptions,
  onScopeChange,
  tabLoading,
}: {
  scopeOptions: ScopeOption[];
  onScopeChange: (s: NoteScope) => void;
  tabLoading: boolean;
}) {
  const { t } = useTranslation();
  const scope = useSidePanelStore((s) => s.scope);

  return (
    <div className="sp-scope-bar">
      {scopeOptions.map((opt) => (
        <button
          key={opt.value}
          className={`sp-scope-btn ${scope === opt.value ? 'active' : ''}`}
          onClick={() => onScopeChange(opt.value)}
          disabled={tabLoading}
        >
          <span className="sp-scope-icon">
            <AppIcon name={opt.icon} size={14} />
          </span>
          <span>{t(`scope.${opt.value}` as TranslationKey)}</span>
        </button>
      ))}
    </div>
  );
}

export default ScopeBar;
