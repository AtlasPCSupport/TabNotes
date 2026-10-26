// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { VisibleAreaCropper } from './VisibleAreaCropper';

vi.mock('@tabnotes/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./AppIcon', () => ({ AppIcon: () => null }));

afterEach(() => vi.restoreAllMocks());

it('keeps dimensions of an already loaded screenshot when initializing the crop dialog', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(648);
  vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(729);
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <VisibleAreaCropper source="data:image/jpeg;base64,QA" onCancel={vi.fn()} onSave={vi.fn()} />
      );
    });
    const viewport = host.querySelector<HTMLElement>('.sp-crop-viewport');
    expect(viewport?.style.aspectRatio).toBe('648 / 729');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
