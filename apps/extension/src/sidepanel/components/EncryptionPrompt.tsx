import React, { useState, useEffect } from 'react';
import { ICONS } from '../icons';

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
      setError(showEncPrompt === 'lock' ? 'Encryption failed.' : 'Wrong password.');
    }
  };

  const handleCancel = () => {
    setShowEncPrompt(null);
  };

  return (
    <div className="tn-enc-overlay">
      <div className="tn-enc-dialog">
        <div className="tn-enc-title">
          {showEncPrompt === 'lock'
            ? `${ICONS.lock} Encrypt note`
            : `${ICONS.key} Decrypt note`}
        </div>
        <p className="tn-enc-desc">
          {showEncPrompt === 'lock'
            ? "Enter a password to encrypt this note with AES-256. You'll need the same password to read it again."
            : 'Enter your password to decrypt and restore this note.'}
        </p>
        <input
          className="tn-enc-input"
          type="password"
          placeholder="Password…"
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
            Cancel
          </button>
          <button
            className="tn-enc-confirm"
            onClick={handleConfirm}
            disabled={!password}
          >
            {showEncPrompt === 'lock' ? 'Encrypt' : 'Decrypt'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EncryptionPrompt;
