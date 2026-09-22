const CACHE = 'ealing-civic-commons-pwa-v1';
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
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
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
