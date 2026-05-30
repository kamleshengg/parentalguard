const CACHE_NAME = 'parentalguard-child-v1';
const ASSETS = [
  '/child/',
  '/child/index.html',
  '/child/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    // Network first for API calls
    e.respondWith(
      fetch(e.request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Background sync for location updates
self.addEventListener('sync', (e) => {
  if (e.tag === 'location-sync') {
    e.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  const cache = await caches.open('pending-data');
  const keys = await cache.keys();
  for (const key of keys) {
    const response = await cache.match(key);
    const data = await response.json();
    try {
      await fetch('/api/location/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      await cache.delete(key);
    } catch (e) {}
  }
}

// Push notifications
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'ParentalGuard', {
      body: data.body || 'New notification',
      icon: '/child/icon-192.png',
      badge: '/child/badge-72.png',
      tag: data.tag || 'default',
    })
  );
});
