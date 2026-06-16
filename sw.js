/* ══════════════════════════════════════════════
   AET MonBudget — Service Worker v2.0
   Alban Eloh Technology
   ══════════════════════════════════════════════ */

const CACHE_NAME = 'aet-monbudget-v2';
const STATIC_CACHE = 'aet-static-v2';
const DYNAMIC_CACHE = 'aet-dynamic-v2';

// Fichiers à mettre en cache immédiatement
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
];

// ── INSTALL : mise en cache statique ──
self.addEventListener('install', event => {
  console.log('[SW] Install v2');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE : nettoyage des anciens caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activate v2');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH : stratégie Network First avec fallback cache ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes Firebase, Google Fonts, CDN externes
  if (
    url.hostname.includes('firebasejs') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('cdnjs') ||
    url.protocol === 'chrome-extension:'
  ) {
    return; // laisser le navigateur gérer
  }

  // Pour les fichiers locaux : Cache First (perf)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Fallback : page principale si navigation
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }
});

// ── BACKGROUND SYNC (pour les transactions hors-ligne) ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    console.log('[SW] Background sync: transactions');
  }
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'AET MonBudget';
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: './icon-192.png',
    badge: './icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || './' },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || './')
    );
  }
});
