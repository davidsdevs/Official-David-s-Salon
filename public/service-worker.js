/**
 * Service Worker - CACHING DISABLED FOR DEVELOPMENT
 */

const CACHE_NAME = 'davids-salon-v2-DISABLED';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install - Caching DISABLED');
  self.skipWaiting();
});

// Activate event - delete all caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate - Clearing all caches');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - NO CACHING, always fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Network error', { status: 503 });
    })
  );
});

// Push notifications still work
self.addEventListener('push', (event) => {
  let notificationData = {
    title: "David's Salon",
    body: 'You have a new notification',
    icon: '/logo.jpg'
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
