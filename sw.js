// ════════════════════════════════════════
// AET MonBudget — Service Worker
// Permet le fonctionnement hors-ligne et l'installation PWA
// ════════════════════════════════════════

const CACHE_NAME = 'aet-monbudget-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Installation : mise en cache des ressources essentielles
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Si certaines ressources n'existent pas encore, on continue quand même
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Stratégie : Network First (toujours essayer le réseau, fallback cache si hors ligne)
self.addEventListener('fetch', (event) => {
  // Ne pas intercepter les requêtes vers Firebase / APIs externes
  const url = event.request.url;
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('firestore') ||
      url.includes('gstatic.com') ||
      url.includes('cloudflareinsights') ||
      url.includes('effectivecpmnetwork') ||
      url.includes('highperformanceformat') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre à jour le cache avec la nouvelle version
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Hors ligne : utiliser le cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
