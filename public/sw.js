// GhumneChalo Service Worker — Web Push, Background Notifications & PWA Offline Caching
// Version: 1.2.0

const CACHE_NAME = 'ghumnechalo-pwa-v1.2.0';
const STATIC_CACHE_NAME = 'ghumnechalo-static-v1.2.0';

// Essential App Shell resources to precache
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-72.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== STATIC_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Validates and sanitizes destination URLs to prevent open redirect vulnerabilities
 */
function sanitizeDestination(url) {
  if (!url || typeof url !== 'string') return '/notifications';
  // Allow safe relative paths
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url;
  }
  try {
    const parsed = new URL(url, self.location.origin);
    if (parsed.origin === self.location.origin) {
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // ignore parse error and fallback
  }
  return '/notifications';
}

// -----------------------------------------------------------------------------
// PUSH NOTIFICATIONS (Phase 11C Preserved)
// -----------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = {
    title: 'GhumneChalo Travel Update',
    body: 'You have a new travel notification.',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: '/notifications',
    },
  };

  if (event.data) {
    try {
      const json = event.data.json();
      payload = {
        title: typeof json.title === 'string' && json.title.trim() ? json.title : payload.title,
        body: typeof json.body === 'string' && json.body.trim() ? json.body : payload.body,
        icon: json.icon || payload.icon,
        badge: json.badge || payload.badge,
        data: {
          url: sanitizeDestination(
            json.actionUrl || json.url || (json.data && json.data.actionUrl) || '/notifications'
          ),
          id: json.id || (json.data && json.data.id),
        },
      };
    } catch {
      try {
        const text = event.data.text();
        if (text && text.trim()) {
          payload.body = text.trim();
        }
      } catch {
        // use default payload
      }
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    data: payload.data,
    vibrate: [100, 50, 100],
    requireInteraction: false,
    tag: payload.data.id ? `notif-${payload.data.id}` : undefined,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = sanitizeDestination(
    event.notification.data && event.notification.data.url
  );

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// -----------------------------------------------------------------------------
// FETCH & OFFLINE CACHING (Phase 12A PWA Foundation)
// -----------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Skip non-GET requests (mutations always require live network)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Skip cross-origin external API requests (e.g. Google APIs, Open-Meteo) unless needed
  if (url.origin !== self.location.origin) {
    return;
  }

  // 3. API Routes: Network First with no sensitive credential caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'NETWORK_OFFLINE',
              message: 'You are offline. Live API calls are unavailable.',
            },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 4. Static Immutable Assets (images, fonts, scripts, styles): Cache First with network fallback
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|avif|ico|woff|woff2|css|js)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. HTML Navigation Requests: Network First -> Fallback to cached page -> Fallback to /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Serve offline fallback page
          const offlinePage = await caches.match('/offline');
          if (offlinePage) {
            return offlinePage;
          }
          return new Response('Offline — GhumneChalo', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }
});
