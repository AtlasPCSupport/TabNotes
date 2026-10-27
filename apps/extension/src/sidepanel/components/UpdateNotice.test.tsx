// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UPDATE_NOTICE_KEY } from '../../shared/updateNotice';
import { UpdateNotice } from './UpdateNotice';

const { setView } = vi.hoisted(() => ({ setView: vi.fn() }));
vi.mock('../store', () => ({
  useSidePanelStore: (select: (state: { setView: typeof setView }) => unknown) =>
    select({ setView }),
}));
vi.mock('@tabnotes/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./AppIcon', () => ({ AppIcon: () => null }));

let root: Root;
let host: HTMLDivElement;
let pending: unknown;
let changed: (data: Record<string, chrome.storage.StorageChange>, area: string) => void;
const remove = vi.fn();
const removeListener = vi.fn();

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  pending = undefined;
  remove.mockImplementation(async () => {
    pending = undefined;
    changed({ [UPDATE_NOTICE_KEY]: {} }, 'local');
  });
  vi.stubGlobal('chrome', {
    runtime: { getManifest: () => ({ version: '2.12.2' }) },
    storage: {
      local: { get: async () => ({ [UPDATE_NOTICE_KEY]: pending }), remove },
      onChanged: {
        addListener: (listener: typeof changed) => {
          changed = listener;
        },
        removeListener,
      },
    },
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  expect(removeListener).toHaveBeenCalled();
  host.remove();
  vi.unstubAllGlobals();
});

for (const version of [undefined, '2.12.1', 'invalid']) {
  it(`does not show a notice for ${version ?? 'a new installation'}`, async () => {
    pending = version;
    await act(async () => root.render(<UpdateNotice />));
    expect(host.textContent).toBe('');
  });
}

it('opens About and persists acknowledgement only in its UI metadata key', async () => {
  pending = '2.12.2';
  await act(async () => root.render(<UpdateNotice />));
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('.sp-update-link')!.click());
  expect(setView).toHaveBeenCalledExactlyOnceWith('about');
  expect(remove).toHaveBeenCalledExactlyOnceWith(UPDATE_NOTICE_KEY);
  expect(host.textContent).toBe('');
});

it('synchronizes other panels and ignores unrelated storage changes', async () => {
  await act(async () => root.render(<UpdateNotice />));
  await act(async () => changed({ [UPDATE_NOTICE_KEY]: { newValue: '2.12.2' } }, 'sync'));
  expect(host.textContent).toBe('');
  await act(async () => changed({ [UPDATE_NOTICE_KEY]: { newValue: '2.12.2' } }, 'local'));
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => changed({ tabnotes_data: { newValue: {} } }, 'local'));
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('.sp-update-dismiss')!.click());
  expect(setView).not.toHaveBeenCalled();
  expect(host.textContent).toBe('');
});

it('does not hide the notice if acknowledgement cannot be saved', async () => {
  pending = '2.12.2';
  remove.mockRejectedValue(new Error('Storage unavailable'));
  await act(async () => root.render(<UpdateNotice />));
  await act(async () => host.querySelector<HTMLButtonElement>('.sp-update-dismiss')!.click());
  expect(host.querySelector('[role="status"]')).not.toBeNull();
});
