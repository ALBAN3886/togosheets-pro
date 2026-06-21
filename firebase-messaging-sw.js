/**
 * ═══════════════════════════════════════════════════════════
 * AET MonBudget — Service Worker Firebase Cloud Messaging
 * ═══════════════════════════════════════════════════════════
 * À placer à la RACINE du site (même niveau que index.html),
 * PAS dans assets/js/. Firebase Messaging exige ce fichier
 * accessible à l'URL exacte /firebase-messaging-sw.js.
 *
 * Gère l'affichage des notifications reçues quand l'application
 * est fermée ou en arrière-plan.
 * ═══════════════════════════════════════════════════════════
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ⚠️ Doit correspondre EXACTEMENT à la config Firebase utilisée dans index.html
firebase.initializeApp({
  apiKey:            "AIzaSyB5hpkRlFZ9HFRRbpQlvpHwMNDja37Nr2s",
  authDomain:         "gestion-salaire-9d3e9.firebaseapp.com",
  databaseURL:        "https://gestion-salaire-9d3e9-default-rtdb.firebaseio.com",
  projectId:          "gestion-salaire-9d3e9",
  storageBucket:      "gestion-salaire-9d3e9.firebasestorage.app",
  messagingSenderId:  "1090226725870",
  appId:              "1:1090226725870:web:d16c25eb46397b3f2de4ff"
});

const messaging = firebase.messaging();

// Notification affichée quand l'app est fermée / en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'AET MonBudget';
  const options = {
    body: payload?.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

// Clic sur la notification → ouvre / focus l'application
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const hadWindow = clientsArr.find(c => c.url.includes(self.location.origin));
      if (hadWindow) return hadWindow.focus();
      return self.clients.openWindow('/');
    })
  );
});
