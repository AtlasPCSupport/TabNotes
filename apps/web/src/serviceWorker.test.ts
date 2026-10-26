import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const match = vi.fn().mockResolvedValue('cached asset');
  const cache = { match, put: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['tabnotes-web-shell-old', 'tabnotes-web-shell-__BUILD_ID__', 'other-app']),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockRejectedValue(new Error('offline'));
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(source, {
    URL, caches, fetch,
    self: {
      registration: { scope: 'https://qa.invalid/app/' },
      location: { origin: 'https://qa.invalid' },
      clients: { claim },
      addEventListener: (type: string, callback: (event: unknown) => void) => listeners.set(type, callback),
    },
  });
  return { listeners, caches, match, fetch, claim };
}

it('finds precached public modules despite Vary: Origin and uses only its active cache', async () => {
  const w = worker();
  const request = { url: 'https://qa.invalid/app/assets/main-123.js', method: 'GET', mode: 'cors' };
  const respondWith = vi.fn();
  w.listeners.get('fetch')!({ request, respondWith });
  await expect(respondWith.mock.calls[0][0]).resolves.toBe('cached asset');
  expect(w.caches.open).toHaveBeenCalledWith('tabnotes-web-shell-__BUILD_ID__');
  expect(w.match).toHaveBeenCalledWith(request, { ignoreVary: true });
  expect(w.fetch).not.toHaveBeenCalled();
});

it('does not cache arbitrary same-origin data or another app assets', () => {
  const w = worker();
  for (const path of ['/app/private-data', '/another-app/assets/main.js']) {
    const respondWith = vi.fn();
    w.listeners.get('fetch')!({ request: { url: `https://qa.invalid${path}`, method: 'GET' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
});

it('uses its own shell offline and removes only outdated TabNotes caches', async () => {
  const w = worker();
  const respondWith = vi.fn();
  w.listeners.get('fetch')!({ request: { url: 'https://qa.invalid/app/notes', method: 'GET', mode: 'navigate' }, respondWith });
  await expect(respondWith.mock.calls[0][0]).resolves.toBe('cached asset');
  expect(w.match).toHaveBeenCalledWith('https://qa.invalid/app/');
  const waitUntil = vi.fn();
  w.listeners.get('activate')!({ waitUntil });
  await waitUntil.mock.calls[0][0];
  expect(w.caches.delete.mock.calls).toEqual([['tabnotes-web-shell-old']]);
  expect(w.claim).toHaveBeenCalledOnce();
});
