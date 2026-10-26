import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { AppIcon } from './AppIcon';

export interface CaptureHubProps {
  disabled: boolean;
  onNewNote: () => Promise<void>;
  onCaptureScreenshot: () => void;
  onCaptureArea: () => void;
  onClipSelection: (target: 'current' | 'new') => Promise<void>;
}

/** One compact entry point for the capture actions already available in TabNotes. */
export function CaptureHub({
  disabled,
  onNewNote,
  onCaptureScreenshot,
  onCaptureArea,
  onClipSelection,
}: CaptureHubProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!hubRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div className={`sp-capture-hub${open ? ' open' : ''}`} ref={hubRef} data-testid="capture-hub">
      <button
        type="button"
        className="sp-capture-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <AppIcon name="camera" size={14} />
        <span>{t('captureHub.label')}</span>
        <AppIcon name={open ? 'chevronUp' : 'chevronDown'} size={13} />
      </button>

      {open && (
        <div className="sp-capture-menu" role="menu" aria-label={t('captureHub.label')}>
          <button
            type="button"
            className="sp-capture-action"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              void onNewNote();
            }}
          >
            <AppIcon name="note" size={15} />
            <span>
              <strong>{t('captureHub.newNote')}</strong>
              <small>{t('captureHub.newNoteDesc')}</small>
            </span>
          </button>

          <button
            type="button"
            className="sp-capture-action"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onCaptureArea();
            }}
          >
            <AppIcon name="crop" size={15} />
            <span>
              <strong>{t('captureHub.crop')}</strong>
              <small>{t('captureHub.cropDesc')}</small>
            </span>
          </button>

          <button
            type="button"
            className="sp-capture-action"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onCaptureScreenshot();
            }}
          >
            <AppIcon name="camera" size={15} />
            <span>
              <strong>{t('captureHub.screenshot')}</strong>
              <small>{t('captureHub.screenshotDesc')}</small>
            </span>
          </button>

          <button
            type="button"
            className="sp-capture-action"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              void onClipSelection('current');
            }}
          >
            <AppIcon name="doc" size={15} />
            <span>
              <strong>{t('captureHub.clipCurrent')}</strong>
              <small>{t('captureHub.clipCurrentDesc')}</small>
            </span>
          </button>

          <button
            type="button"
            className="sp-capture-action"
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              void onClipSelection('new');
            }}
          >
            <AppIcon name="doc" size={15} />
            <span>
              <strong>{t('captureHub.clipNew')}</strong>
              <small>{t('captureHub.clipNewDesc')}</small>
            </span>
          </button>

          <div className="sp-capture-hint" role="note">
            <AppIcon name="doc" size={15} />
            <span>
              <strong>{t('captureHub.clipSelection')}</strong>
              <small>{t('captureHub.clipSelectionDesc')}</small>
            </span>
          </div>

          <div className="sp-capture-shortcut">
            <kbd>Ctrl+Shift+N</kbd>
            <span>{t('captureHub.shortcut')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaptureHub;
