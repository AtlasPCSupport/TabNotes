import { useState, useEffect } from 'react';
import { hashPin, verifyPin, PBKDF2_V2_ITERATIONS } from '@tabnotes/shared';
import { useTranslation } from '@tabnotes/i18n';
import type { PinHash } from '@tabnotes/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr: any =
  typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).chrome
    ? (globalThis as Record<string, unknown>).chrome
    : null;

export function usePinLock() {
  const { t } = useTranslation();
  const [pinHash, setPinHash] = useState<PinHash | null>(null);
  const [pinLocked, setPinLocked] = useState(false);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  // Settings: set/change/remove PIN inputs
  const [pinSetInput, setPinSetInput] = useState('');
  const [pinSetConfirm, setPinSetConfirm] = useState('');
  const [pinSetFeedback, setPinSetFeedback] = useState('');

  // Load the side panel PIN config; if a PIN is set, start locked.
  useEffect(() => {
    cr?.storage?.local?.get('tn_pin', (res: Record<string, unknown>) => {
      const stored = res?.tn_pin as PinHash | undefined;
      if (stored?.salt && stored?.hash) {
        setPinHash(stored);
        setPinLocked(true);
      }
    });
  }, []);

  const savePin = async () => {
    if (pinSetInput.length < 4) {
      setPinSetFeedback(t('pin.minLength'));
      return;
    }
    if (pinSetInput !== pinSetConfirm) {
      setPinSetFeedback(t('pin.mismatch'));
      return;
    }
    const hashed = await hashPin(pinSetInput);
    setPinHash(hashed);
    cr?.storage?.local?.set({ tn_pin: hashed });
    setPinSetInput('');
    setPinSetConfirm('');
    setPinSetFeedback(t('pin.saved'));
    setTimeout(() => setPinSetFeedback(''), 2500);
  };

  const removePin = () => {
    setPinHash(null);
    setPinLocked(false);
    cr?.storage?.local?.remove('tn_pin');
    setPinSetInput('');
    setPinSetConfirm('');
    setPinSetFeedback(t('pin.removed'));
    setTimeout(() => setPinSetFeedback(''), 2500);
  };

  const lockNow = () => {
    if (pinHash) {
      setPinEntry('');
      setPinError('');
      setPinLocked(true);
    }
  };

  const submitPinUnlock = async () => {
    if (!pinHash) {
      setPinLocked(false);
      return;
    }
    const ok = await verifyPin(pinEntry, pinHash);
    if (ok) {
      if (pinHash.iterations !== PBKDF2_V2_ITERATIONS || pinHash.version !== 2) {
        const migrated = await hashPin(pinEntry);
        setPinHash(migrated);
        cr?.storage?.local?.set({ tn_pin: migrated });
      }
      setPinLocked(false);
      setPinEntry('');
      setPinError('');
    } else {
      setPinError(t('pin.incorrect'));
      setPinEntry('');
    }
  };

  return {
    pinHash,
    pinLocked,
    setPinLocked,
    pinEntry,
    setPinEntry,
    pinError,
    setPinError,
    pinSetInput,
    setPinSetInput,
    pinSetConfirm,
    setPinSetConfirm,
    pinSetFeedback,
    savePin,
    removePin,
    lockNow,
    submitPinUnlock,
  };
}
