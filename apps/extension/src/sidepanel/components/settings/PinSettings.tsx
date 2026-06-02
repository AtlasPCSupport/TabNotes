import React from 'react';
import type { PinHash } from '@tabnotes/shared';
import { ICONS } from '../../icons';
import { useTranslation } from '@tabnotes/i18n';

/**
 * Security / PIN-lock settings section. Self-contained: receives the PIN state
 * and the three handlers (save/remove/lock) from the parent. Extracted verbatim
 * from the Settings view — no behavior change.
 */
export function PinSettings({
  pinHash,
  pinSetInput,
  setPinSetInput,
  pinSetConfirm,
  setPinSetConfirm,
  pinSetFeedback,
  savePin,
  removePin,
  lockNow,
}: {
  pinHash: PinHash | null;
  pinSetInput: string;
  setPinSetInput: (v: string) => void;
  pinSetConfirm: string;
  setPinSetConfirm: (v: string) => void;
  pinSetFeedback: string;
  savePin: () => void;
  removePin: () => void;
  lockNow: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="sp-settings-section">
      <div className="sp-settings-label">
        {ICONS.lock} {t('settingsSections.securityPinLock')}
      </div>
      <div className="sp-settings-row-info" style={{ marginBottom: 10 }}>
        {t('settingsSections.pinLockDesc')}
      </div>
      {pinHash ? (
        <>
          <div className="sp-settings-row">
            <span className="sp-pin-status">
              {ICONS.check} {t('pin.enabled')}
            </span>
            <button className="sp-pin-action" onClick={lockNow}>
              {t('pin.lockNow')}
            </button>
          </div>
          <div className="sp-pin-fields">
            <input
              className="sp-pin-field"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('settingsSections.newPinPlaceholder')}
              value={pinSetInput}
              onChange={(e) => setPinSetInput(e.target.value)}
            />
            <input
              className="sp-pin-field"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('settingsSections.confirmNewPinPlaceholder')}
              value={pinSetConfirm}
              onChange={(e) => setPinSetConfirm(e.target.value)}
            />
          </div>
          <div className="sp-pin-buttons">
            <button className="sp-pin-action" onClick={savePin}>
              {t('pin.changePin')}
            </button>
            <button className="sp-pin-action danger" onClick={removePin}>
              {t('pin.removePin')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="sp-pin-fields">
            <input
              className="sp-pin-field"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('settingsSections.setPinPlaceholder')}
              value={pinSetInput}
              onChange={(e) => setPinSetInput(e.target.value)}
            />
            <input
              className="sp-pin-field"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder={t('settingsSections.confirmPinPlaceholder')}
              value={pinSetConfirm}
              onChange={(e) => setPinSetConfirm(e.target.value)}
            />
          </div>
          <button className="sp-pin-action" onClick={savePin} disabled={!pinSetInput}>
            {t('pin.enable')}
          </button>
        </>
      )}
      {pinSetFeedback && <div className="sp-pin-feedback">{pinSetFeedback}</div>}
    </div>
  );
}

export default PinSettings;
