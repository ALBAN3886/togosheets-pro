const CACHE_NAME = 'aet-monbudget-v5';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/css/aet-enhancements.css',
  './assets/js/aet-enhancements.js',
  './assets/js/aet-commerce-pro.js',
  './assets/js/aet-ai-chat.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Stratégie réseau-d'abord pour index.html : on veut toujours la
  // dernière version de la page principale, avec repli sur le cache
  // hors-ligne. Les autres fichiers restent cache-first (rapide).
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
