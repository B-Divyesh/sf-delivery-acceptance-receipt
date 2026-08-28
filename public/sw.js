const VERSION = 'delivery-receipt-v1.0.3';
const SHELL = [
  '/', '/index.html', '/privacy/', '/terms/', '/offline.html',
  '/assets/main.js', '/assets/app.css', '/manifest.webmanifest',
  '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png',
  '/assets/hero-cassette-720.avif', '/assets/hero-cassette-1200.avif',
  '/assets/hero-cassette-720.webp', '/assets/hero-cassette-1200.webp', '/assets/hero-cassette.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const updated = keys.some((key) => key.startsWith('delivery-receipt-') && key !== VERSION);
    await Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
    if (updated) {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.postMessage({ type: 'UPDATE_READY' }));
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    if (url.hostname.endsWith('sociobot.in')) {
      event.respondWith(fetch(event.request));
    }
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(async () => (await caches.match(event.request, { ignoreVary: true })) || (await caches.match('/', { ignoreVary: true })) || caches.match('/offline.html', { ignoreVary: true })));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
