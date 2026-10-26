import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from '@tabnotes/i18n';
import { AppIcon } from './AppIcon';

interface Point {
  x: number;
  y: number;
}

interface Selection extends Point {
  width: number;
  height: number;
}

export interface VisibleAreaCropperProps {
  source: string | null;
  onCancel: () => void;
  onSave: (dataUrl: string) => Promise<void>;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function getSelection(start: Point, current: Point, width: number, height: number): Selection {
  const x = clamp(Math.min(start.x, current.x), 0, width);
  const y = clamp(Math.min(start.y, current.y), 0, height);
  const right = clamp(Math.max(start.x, current.x), 0, width);
  const bottom = clamp(Math.max(start.y, current.y), 0, height);
  return { x, y, width: right - x, height: bottom - y };
}

/** Crop a captured screenshot in the extension page without injecting code into the site. */
export function VisibleAreaCropper({ source, onCancel, onSave }: VisibleAreaCropperProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Point | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!source) return;
    setSelection(null);
    // Data URLs can finish loading before this effect; do not erase their onLoad dimensions.
    const image = imageRef.current;
    setNaturalSize({
      width: image?.complete ? image.naturalWidth : 0,
      height: image?.complete ? image.naturalHeight : 0,
    });
    setError(false);
  }, [source]);

  useEffect(() => {
    if (!source) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, [source]);

  if (!source) return null;

  const getPoint = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!naturalSize.width || !naturalSize.height) return;
    const point = getPoint(event);
    dragStartRef.current = point;
    setSelection({ ...point, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    const viewport = viewportRef.current;
    if (!start || !viewport) return;
    const point = getPoint(event);
    setSelection(getSelection(start, point, viewport.clientWidth, viewport.clientHeight));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStartRef.current = null;
  };

  const saveCrop = async () => {
    if (saving) return;
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport || !selection || selection.width < 2 || selection.height < 2) return;

    const scaleX = image.naturalWidth / viewport.clientWidth;
    const scaleY = image.naturalHeight / viewport.clientHeight;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(selection.width * scaleX));
    canvas.height = Math.max(1, Math.round(selection.height * scaleY));
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(
      image,
      Math.round(selection.x * scaleX),
      Math.round(selection.y * scaleY),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(canvas.toDataURL('image/jpeg', 0.84));
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sp-crop-backdrop" role="presentation">
      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          onCancel();
        }}
        className="sp-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-crop-title"
        data-testid="visible-area-cropper"
      >
        <header className="sp-crop-header">
          <div>
            <div className="sp-crop-kicker">{t('captureHub.cropKicker')}</div>
            <h2 id="sp-crop-title">{t('captureHub.cropTitle')}</h2>
          </div>
          <button
            type="button"
            className="sp-icon-btn"
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <AppIcon name="close" size={17} />
          </button>
        </header>

        <p className="sp-crop-instruction">{t('captureHub.cropInstruction')}</p>

        <div
          className="sp-crop-viewport"
          ref={viewportRef}
          style={
            naturalSize.width
              ? { aspectRatio: `${naturalSize.width} / ${naturalSize.height}` }
              : undefined
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {!error && (
            <img
              ref={imageRef}
              src={source}
              alt={t('captureHub.cropPreview')}
              draggable={false}
              onLoad={(event) =>
                setNaturalSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              onError={() => setError(true)}
            />
          )}
          {error && <div className="sp-crop-error">{t('captureHub.cropError')}</div>}
          {selection && selection.width >= 2 && selection.height >= 2 && (
            <div
              className="sp-crop-selection"
              style={{
                left: `${selection.x}px`,
                top: `${selection.y}px`,
                width: `${selection.width}px`,
                height: `${selection.height}px`,
              }}
            >
              <span>{t('captureHub.cropSelected')}</span>
            </div>
          )}
        </div>

        <footer className="sp-crop-actions">
          {saveFailed && <span role="alert">{t('editor.saveFailed')}</span>}
          <button type="button" className="sp-crop-btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="sp-crop-btn primary"
            disabled={saving || !selection || selection.width < 2 || selection.height < 2 || error}
            onClick={saveCrop}
          >
            <AppIcon name="crop" size={15} />
            {t('captureHub.cropSave')}
          </button>
        </footer>
      </dialog>
    </div>
  );
}

export default VisibleAreaCropper;
