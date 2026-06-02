import React from 'react';
import type { NoteScope } from '@tabnotes/shared';
import { ICONS } from '../../icons';
import { useTranslation, TranslationKey } from '@tabnotes/i18n';

export interface ScopeOption {
  value: NoteScope;
  label: string;
  icon: string;
  desc: string;
}

/**
 * Default Scope + Daily Digest settings sections. Extracted verbatim from the
 * Settings view — no behavior change.
 */
export function ScopeDigestSettings({
  scopeOptions,
  defaultScope,
  setDefaultScope,
  digestEnabled,
  setDigestEnabled,
  digestTime,
  setDigestTime,
  saveDigest,
}: {
  scopeOptions: ScopeOption[];
  defaultScope: NoteScope;
  setDefaultScope: (s: NoteScope) => void;
  digestEnabled: boolean;
  setDigestEnabled: (v: boolean) => void;
  digestTime: string;
  setDigestTime: (v: string) => void;
  saveDigest: (enabled: boolean, time: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="sp-settings-section">
        <div className="sp-settings-label">{t('settingsSections.defaultScope')}</div>
        <div className="sp-scope-grid">
          {scopeOptions.map((s) => (
            <div
              key={s.value}
              className={`sp-scope-row${defaultScope === s.value ? ' active' : ''}`}
              onClick={() => setDefaultScope(s.value)}
            >
              <span className="sp-scope-row-icon">{s.icon}</span>
              <div className="sp-scope-row-info">
                <div className="sp-scope-row-name">{t(`scope.${s.value}` as TranslationKey, s.label)}</div>
                <div className="sp-scope-row-desc">{t(`scope.${s.value}Desc` as TranslationKey, s.desc)}</div>
              </div>
              {defaultScope === s.value && <span className="sp-scope-row-check">✓</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="sp-settings-section">
        <div className="sp-settings-label">{t('settings.dailyDigest')}</div>
        <div className="sp-settings-row">
          <div className="sp-settings-row-info">
            <div className="sp-settings-row-title">{t('settingsSections.morningNotification')}</div>
            <div className="sp-settings-row-desc">{t('settingsSections.dailySummaryDesc')}</div>
          </div>
          <button
            className={`sp-toggle ${digestEnabled ? 'on' : 'off'}`}
            onClick={() => {
              const next = !digestEnabled;
              setDigestEnabled(next);
              saveDigest(next, digestTime);
            }}
          >
            <div className="sp-toggle-knob" />
          </button>
        </div>
        {digestEnabled && (
          <div className="sp-digest-time-row">
            <span className="sp-digest-time-label">{t('settingsSections.sendDigestAt')}</span>
            <input
              type="time"
              className="sp-digest-time-input"
              value={digestTime}
              onChange={(e) => {
                setDigestTime(e.target.value);
                saveDigest(digestEnabled, e.target.value);
              }}
            />
          </div>
        )}
        {digestEnabled && (
          <div className="sp-digest-preview">
            <span className="sp-digest-preview-icon">{ICONS.doc}</span>
            <span>
              {t('settingsSections.digestPreviewText', { time: digestTime })}
              <br />
              <em>{t('settingsSections.digestPreviewSample')}</em>
            </span>
          </div>
        )}
      </div>
    </>
  );
}

export default ScopeDigestSettings;
