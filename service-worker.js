// Increment the cache version any time a deploy includes breaking changes.
// In production this value could be derived from a build hash to ensure
// clients always fetch the latest assets.
const CACHE_NAME = 'dashboard-cache-v3';
const OFFLINE_URLS = [
  './',
  './index.html',
  './style.css',
  './js/main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Use a network-first strategy for navigational requests so that
  // index.html and other HTML pages are always up to date while still
  // falling back to the cached version when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch (err) {
          return (await caches.match(request)) || (await caches.match('./index.html'));
        }
      })()
    );
    return;
  }

  // Bypass cache for Firestore requests and provide a fallback response on errors
  if (request.url.includes('firestore.googleapis.com')) {
    event.respondWith(
      fetch(request).catch(() => new Response(null, { status: 503 }))
    );
    return;
  }

  // Cache-first for all other requests with network fallback
  event.respondWith(
    caches.match(request)
      .then(res => res || fetch(request))
      .catch(() => fetch(request))
  );
});

// Allow the page to trigger an update of the service worker immediately.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
