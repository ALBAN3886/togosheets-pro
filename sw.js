const CACHE_NAME = 'aet-monbudget-v2';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/aet-enhancements.css',
  './assets/js/aet-enhancements.js'
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
