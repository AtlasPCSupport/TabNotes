// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CaptureHub } from './CaptureHub';

vi.mock('@tabnotes/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./AppIcon', () => ({ AppIcon: () => null }));

let root: Root;
let host: HTMLDivElement;
const handlers = {
  onNewNote: vi.fn(async () => {}),
  onClipSelection: vi.fn(async (_target: 'current' | 'new') => {}),
  onCaptureScreenshot: vi.fn(),
  onCaptureArea: vi.fn(),
};

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<CaptureHub disabled={false} {...handlers} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

for (const target of ['current', 'new'] as const) {
  for (const [label, handler] of [
    ['clipSelection', 'onClipSelection'],
    ['screenshot', 'onCaptureScreenshot'],
    ['crop', 'onCaptureArea'],
  ] as const) {
    it(`routes ${label} to the common ${target} destination`, async () => {
      await act(async () => host.querySelector<HTMLButtonElement>('.sp-capture-trigger')!.click());
      const destination = host.querySelector('select')!;
      await act(async () => {
        destination.value = target;
        destination.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const action = [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(
        (button) => button.querySelector('strong')?.textContent === `captureHub.${label}`
      )!;
      await act(async () => action.click());
      expect(handlers[handler]).toHaveBeenCalledExactlyOnceWith(target);
      expect(handlers.onNewNote).not.toHaveBeenCalled();
      expect(host.querySelector('[role="menu"]')).toBeNull();
    });
  }
}

it('keeps blank-note creation separate and closes with Escape', async () => {
  const trigger = host.querySelector<HTMLButtonElement>('.sp-capture-trigger')!;
  await act(async () => trigger.click());
  expect(host.querySelector('.sp-capture-destination')?.textContent).toContain(
    'captureHub.chooseDestination'
  );
  expect(host.querySelector('.sp-capture-step-actions')?.textContent).toContain(
    'captureHub.chooseCapture'
  );
  expect(host.querySelectorAll('.sp-capture-step-number')).toHaveLength(2);
  expect(host.querySelector('select')?.closest('label')).not.toBeNull();
  expect(host.querySelectorAll('[role="menuitem"]')).toHaveLength(4);
  await act(async () => host.querySelector<HTMLButtonElement>('.sp-capture-blank')!.click());
  expect(handlers.onNewNote).toHaveBeenCalledOnce();
  await act(async () => trigger.click());
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(host.querySelector('[role="menu"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('disables all actions on restricted pages', async () => {
  await act(async () => root.render(<CaptureHub disabled {...handlers} />));
  await act(async () => host.querySelector<HTMLButtonElement>('.sp-capture-trigger')!.click());
  expect(
    [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].every(
      (button) => button.disabled
    )
  ).toBe(true);
});
