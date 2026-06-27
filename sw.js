const CACHE_NAME = 'aet-monbudget-v12-final';
const CORE_ASSETS = [
  './',
  './index.html',
  './sw.js',
  './assets/js/aet-commerce-pro.js'
];
const OPTIONAL_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/css/aet-enhancements.css',
  './assets/js/aet-enhancements.js',
  './assets/js/aet-ai-chat.js'
];

async function cacheOptional(cache, assets) {
  await Promise.allSettled(assets.map(async (asset) => {
    try { await cache.add(asset); } catch (_) {}
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await cacheOptional(cache, OPTIONAL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isHTML = event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (isHTML) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title:'AET MonBudget', body:'Nouvelle alerte budgétaire' };
  event.waitUntil(self.registration.showNotification(data.title || 'AET MonBudget', {
    body: data.body || 'Notification',
    icon: './icon-192.png',
    badge: './icon-192.png'
  }));
});
