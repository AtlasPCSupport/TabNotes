import React from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { AppIcon } from '../AppIcon';

/**
 * AI Assistant (Groq API key) settings section. The actual persistence is done
 * by the parent via `saveGroqKey`. Extracted verbatim — no behavior change.
 */
export function AiSettings({
  groqKey,
  groqKeyInput,
  setGroqKeyInput,
  groqKeyVisible,
  setGroqKeyVisible,
  saveGroqKey,
  onOpenChat,
}: {
  groqKey: string;
  groqKeyInput: string;
  setGroqKeyInput: (v: string) => void;
  groqKeyVisible: boolean;
  setGroqKeyVisible: (updater: (v: boolean) => boolean) => void;
  saveGroqKey: (key: string) => void;
  onOpenChat: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">{t('settingsSections.aiAssistant')}</div>
      <div className="sp-settings-row-info" style={{ marginBottom: 10 }}>
        <div className="sp-settings-row-title">{t('settings.groqKey')}</div>
        <div className="sp-settings-row-desc">
          {t('settingsSections.groqKeyDesc')}{' '}
          <a
            href="https://console.groq.com"
            target="_blank"
            rel="noopener"
            style={{ color: 'var(--accent)' }}
          >
            console.groq.com
          </a>
        </div>
      </div>
            <p className="sp-settings-row-desc" style={{ margin: '0 0 10px' }}>
        {t('settingsSections.groqPrivacyNotice')}
      </p>
      <div className="sp-groq-key-row">

        <input
          className="sp-groq-key-input"
          type={groqKeyVisible ? 'text' : 'password'}
          placeholder="gsk_…"
          value={groqKeyInput}
          onChange={(e) => setGroqKeyInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              saveGroqKey(groqKeyInput.trim());
            }
          }}
        />
        <button
          className="sp-groq-key-eye"
          onClick={() => setGroqKeyVisible((v) => !v)}
          title={groqKeyVisible ? t('settingsSections.hide') : t('settingsSections.show')}
        >
          <AppIcon name={groqKeyVisible ? 'unlock' : 'lock'} size={14} />
        </button>
        <button className="sp-groq-key-save" onClick={() => saveGroqKey(groqKeyInput.trim())}>
          {t('common.save')}
        </button>
      </div>
            {groqKey && (
        <div className="sp-groq-key-status">
          <AppIcon name="check" size={13} /> {t('settingsSections.keySaved')} —{' '}
          <button className="sp-groq-open-chat" onClick={onOpenChat}>
            {t('settingsSections.openChat')} →
          </button>{' '}
          <button
            className="sp-groq-open-chat"
            onClick={() => {
              setGroqKeyInput('');
              saveGroqKey('');
            }}
          >
            {t('settingsSections.removeKey')}
          </button>
        </div>
      )}
    </div>
  );
}

export default AiSettings;
