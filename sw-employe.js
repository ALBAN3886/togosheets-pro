/* ═══════════════════════════════════════════════
 * AET Commerce Employé — Service Worker PWA
 * Synchronisé: installation tolérante aux assets absents
 * ═══════════════════════════════════════════════ */
const CACHE_NAME = 'aet-employe-v12-final';
const CORE_ASSETS = [
  './employe.html',
  './sw-employe.js'
];
const OPTIONAL_ASSETS = [
  './manifest-employe.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
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
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (url.includes('firebase') || url.includes('firestore') || url.includes('googleapis.com/identitytoolkit')) {
    event.respondWith(fetch(event.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./employe.html')))
  );
});
