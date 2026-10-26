import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';

export interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

const STEPS = ['scope', 'capture', 'privacy'] as const;

/** A short, first-run-only explanation of the product's core mental model. */
export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastStep = step === STEPS.length - 1;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [open]);

  if (!open) return null;

  const advance = () => {
    if (lastStep) onComplete();
    else setStep((current) => current + 1);
  };

  return (
    <div className="tn-onboarding-overlay" role="presentation">
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          onComplete();
        }}
        className="tn-onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tn-onboarding-title"
        data-testid="onboarding-dialog"
      >
        <div className="tn-onboarding-progress" aria-label={t('onboarding.progress')}>
          {STEPS.map((name, index) => (
            <span
              key={name}
              className={`tn-onboarding-dot${index === step ? ' active' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>

        {step === 0 && (
          <>
            <p className="tn-onboarding-kicker">{t('onboarding.scopeKicker')}</p>
            <h2 id="tn-onboarding-title">{t('onboarding.scopeTitle')}</h2>
            <p className="tn-onboarding-copy">{t('onboarding.scopeDescription')}</p>
            <div className="tn-onboarding-scopes">
              <p>
                <strong>{t('scope.url')}</strong>
                {t('onboarding.scopeUrl')}
              </p>
              <p>
                <strong>{t('scope.domain')}</strong>
                {t('onboarding.scopeDomain')}
              </p>
              <p>
                <strong>{t('scope.workspace')}</strong>
                {t('onboarding.scopeWorkspace')}
              </p>
              <p>
                <strong>{t('scope.global')}</strong>
                {t('onboarding.scopeGlobal')}
              </p>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="tn-onboarding-kicker">{t('onboarding.captureKicker')}</p>
            <h2 id="tn-onboarding-title">{t('onboarding.captureTitle')}</h2>
            <p className="tn-onboarding-copy">{t('onboarding.captureDescription')}</p>
            <div className="tn-onboarding-tip">
              <strong>{t('onboarding.captureTipTitle')}</strong>
              <span>{t('onboarding.captureTipDescription')}</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="tn-onboarding-kicker">{t('onboarding.privacyKicker')}</p>
            <h2 id="tn-onboarding-title">{t('onboarding.privacyTitle')}</h2>
            <p className="tn-onboarding-copy">{t('onboarding.privacyDescription')}</p>
            <div className="tn-onboarding-tip">
              <strong>{t('onboarding.privacyTipTitle')}</strong>
              <span>{t('onboarding.privacyTipDescription')}</span>
            </div>
          </>
        )}

        <footer className="tn-onboarding-actions">
          {step === 0 ? (
            <button type="button" className="tn-onboarding-skip" onClick={onComplete}>
              {t('onboarding.skip')}
            </button>
          ) : (
            <button
              type="button"
              className="tn-onboarding-skip"
              onClick={() => setStep((current) => current - 1)}
            >
              {t('common.back')}
            </button>
          )}
          <button type="button" className="tn-onboarding-next" onClick={advance} autoFocus>
            {lastStep ? t('onboarding.start') : t('onboarding.next')}
          </button>
        </footer>
      </dialog>
    </div>
  );
}
