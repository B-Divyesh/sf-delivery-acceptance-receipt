export function serviceWorkerSource(version: string, shell: string[]): string {
  return `const VERSION = ${JSON.stringify(version)};
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const updated = keys.some((key) => key.startsWith('delivery-receipt-') && key !== VERSION);
    await Promise.all(keys.filter((key) => key.startsWith('delivery-receipt-') && key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
    if (updated) (await self.clients.matchAll({ type: 'window' })).forEach((client) => client.postMessage({ type: 'UPDATE_READY' }));
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(async () => {
      const direct = await caches.match(event.request, { ignoreVary: true });
      if (direct) return direct;
      if (url.pathname === '/demo' || url.pathname === '/demo/') return (await caches.match('/demo/index.html')) || (await caches.match('/index.html'));
      if (url.pathname.startsWith('/ack/')) return (await caches.match('/index.html')) || (await caches.match('/'));
      return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
    }));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(VERSION).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});`;
}
