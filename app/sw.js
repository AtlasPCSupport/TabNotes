// Replaced by the build script so a new shell never overwrites the active cache.
const CACHE_NAME = 'tabnotes-web-shell-51dc890f926dcf5f';
const scopeUrl = new URL(self.registration.scope);
const shellUrl = (path = '') => new URL(path, scopeUrl).toString();
const SHELL_URLS = [
  shellUrl(),
  shellUrl('manifest.webmanifest'),
  shellUrl('favicon.svg'),
  shellUrl('icon192.png'),
  shellUrl('icon512.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(SHELL_URLS);
        const index = await cache.match(shellUrl());
        const html = await index.text();
        const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map((match) => new URL(match[1], scopeUrl))
          .filter((url) => url.origin === scopeUrl.origin && url.pathname.includes('/assets/'))
          .map((url) => url.toString());
        await cache.addAll(assets);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tabnotes-web-shell-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/tabnotes.config.json')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.open(CACHE_NAME)).match(shellUrl()))
    );
    return;
  }

  // Only public shell assets belong in this offline cache, not arbitrary same-origin data.
  const isAsset = url.pathname.startsWith(new URL('assets/', scopeUrl).pathname);
  if (!isAsset && !SHELL_URLS.includes(url.href)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Module requests include Origin; precache requests may not. These hashed,
      // same-origin public files do not vary by account or request headers.
      const cached = await cache.match(request, { ignoreVary: isAsset });
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          event.waitUntil(cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
