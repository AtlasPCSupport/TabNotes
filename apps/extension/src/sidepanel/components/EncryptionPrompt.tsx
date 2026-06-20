import React, { useState, useEffect } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { AppIcon } from './AppIcon';

export interface EncryptionPromptProps {
  showEncPrompt: 'lock' | 'unlock' | null;
  setShowEncPrompt: (mode: 'lock' | 'unlock' | null) => void;
  onLockNote: (password: string) => Promise<boolean>;
  onUnlockNote: (password: string) => Promise<boolean>;
}

export function EncryptionPrompt({
  showEncPrompt,
  setShowEncPrompt,
  onLockNote,
  onUnlockNote,
}: EncryptionPromptProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Reset local state when prompt changes/closes
  useEffect(() => {
    setPassword('');
    setError('');
  }, [showEncPrompt]);

  if (!showEncPrompt) return null;

  const handleConfirm = async () => {
    if (!password) return;
    setError('');
    
    const success = showEncPrompt === 'lock'
      ? await onLockNote(password)
      : await onUnlockNote(password);

    if (success) {
      setShowEncPrompt(null);
    } else {
      setError(
        showEncPrompt === 'lock'
          ? t('encryption.encryptionFailed')
          : t('encryption.wrongPassword')
      );
    }
  };

  const handleCancel = () => {
    setShowEncPrompt(null);
  };

  return (
    <div className="tn-enc-overlay">
      <div className="tn-enc-dialog">
        <div className="tn-enc-title">
          <AppIcon name={showEncPrompt === 'lock' ? 'lock' : 'key'} size={16} />
          <span>
            {showEncPrompt === 'lock' ? t('encryption.encryptNote') : t('encryption.decryptNote')}
          </span>
        </div>
        <p className="tn-enc-desc">
          {showEncPrompt === 'lock'
            ? t('encryption.encryptDesc')
            : t('encryption.decryptDesc')}
        </p>
        <input
          className="tn-enc-input"
          type="password"
          placeholder={t('encryption.passwordPlaceholder')}
          value={password}
          autoFocus
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleConfirm();
            }
            if (e.key === 'Escape') {
              handleCancel();
            }
          }}
        />
        {error && <p className="tn-enc-error">{error}</p>}
        <div className="tn-enc-actions">
          <button className="tn-enc-cancel" onClick={handleCancel}>
            {t('common.cancel')}
          </button>
          <button
            className="tn-enc-confirm"
            onClick={handleConfirm}
            disabled={!password}
          >
            {showEncPrompt === 'lock' ? t('encryption.encrypt') : t('encryption.decrypt')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EncryptionPrompt;
