const CACHE_NAME = 'tabnotes-web-shell-v6';
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
    event.respondWith(fetch(request).catch(() => caches.match(shellUrl())));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
