// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OneDriveSyncSettings } from './OneDriveSyncSettings';
import { ONEDRIVE_ORIGINS } from '../../../shared/oneDrive';

vi.mock('@tabnotes/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let root: Root;
let host: HTMLDivElement;
let state: Record<string, unknown>;
const request = vi.fn();
const send = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  state = { enabled: false, supportedIdentity: true, googleEnabled: false, status: 'disconnected' };
  request.mockReset().mockResolvedValue(true);
  send
    .mockReset()
    .mockImplementation(({ type }: { type: string }, callback: (r: unknown) => void) => {
      if (type === 'ONEDRIVE_CONNECT') state = { ...state, enabled: true, status: 'ok' };
      if (type === 'ONEDRIVE_DISCONNECT')
        state = { ...state, enabled: false, status: 'disconnected' };
      callback({ ok: true, result: state });
    });
  vi.stubGlobal('chrome', {
    runtime: { sendMessage: send },
    permissions: { request },
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;

it('requests optional Microsoft origins only on a user connect click', async () => {
  await act(async () => root.render(<OneDriveSyncSettings />));
  expect(request).not.toHaveBeenCalled();
  await act(async () => button('oneDrive.connect').click());
  expect(request).toHaveBeenCalledExactlyOnceWith({ origins: ONEDRIVE_ORIGINS });
  expect(send).toHaveBeenCalledWith({ type: 'ONEDRIVE_CONNECT' }, expect.any(Function));
  expect(button('oneDrive.syncNow')).toBeDefined();
  await act(async () => button('oneDrive.disconnect').click());
  expect(button('oneDrive.connect')).toBeDefined();
  expect(send).toHaveBeenCalledWith({ type: 'ONEDRIVE_DISCONNECT' }, expect.any(Function));
});

it('does not sign in or upload if optional site permission is denied', async () => {
  request.mockResolvedValue(false);
  await act(async () => root.render(<OneDriveSyncSettings />));
  await act(async () => button('oneDrive.connect').click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('oneDrive.permissionDenied');
  expect(send).not.toHaveBeenCalledWith({ type: 'ONEDRIVE_CONNECT' }, expect.any(Function));
});

it('does not silently replace an enabled Google provider', async () => {
  state.googleEnabled = true;
  await act(async () => root.render(<OneDriveSyncSettings />));
  expect(button('oneDrive.connect').disabled).toBe(true);
  expect(host.textContent).toContain('oneDrive.googleFirst');
});

it('explains a new/unregistered extension identity without attempting sign-in', async () => {
  state.supportedIdentity = false;
  await act(async () => root.render(<OneDriveSyncSettings />));
  expect(button('oneDrive.connect').disabled).toBe(true);
  expect(host.textContent).toContain('oneDrive.identity');
});

it('offers reconnect when authorization expires and never opens login on render', async () => {
  state = { ...state, enabled: true, status: 'reconnect', lastError: 'ONEDRIVE_RECONNECT' };
  await act(async () => root.render(<OneDriveSyncSettings />));
  expect(button('oneDrive.reconnect')).toBeDefined();
  expect(button('oneDrive.syncNow').disabled).toBe(true);
  expect(request).not.toHaveBeenCalled();
  expect(host.textContent).toContain('oneDrive.reconnectInfo');
});
