const CACHE = 'ealing-civic-commons-pwa-v1';
// Fingerprinted build output (/assets/name.<hash>.ext) never changes, so it is
// served from cache first; a new deploy brings new names rather than new content.
const ASSET_CACHE = 'ealing-civic-commons-assets-v1';
const HASHED_ASSET = /^\/assets\/(.+)\.[0-9a-f]{10}\.(js|css)$/;
const APP_SHELL = [
  '/offline.html',
  '/brand/ealing-oak-approved.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => undefined))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE && key !== ASSET_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Civic data and APIs should stay live rather than becoming a stale offline mirror.
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  const hashed = url.pathname.match(HASHED_ASSET);
  if (hashed) {
    event.respondWith(cachedAsset(request, url, hashed));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(async () => (await caches.match('/offline.html')) || new Response(
          'Civic Commons is offline. Reconnect to load the latest civic record.',
          { headers: { 'content-type': 'text/plain; charset=utf-8' } }
        ))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && ['style', 'script', 'image', 'font'].includes(request.destination)) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error())
  );
});

async function cachedAsset(request, url, [, name, ext]) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(url.pathname);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && !/text\/html/i.test(response.headers.get('content-type') || '')) {
    await cache.put(url.pathname, response.clone());
    // Drop earlier builds of the same file so the cache stays one copy per asset.
    for (const key of await cache.keys()) {
      const old = new URL(key.url).pathname.match(HASHED_ASSET);
      if (old && old[1] === name && old[2] === ext && old[0] !== url.pathname) await cache.delete(key);
    }
  }
  return response;
}
