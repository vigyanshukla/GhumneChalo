// GhumneChalo Service Worker — Web Push, Background Notifications & PWA Offline Caching
// Version: 1.4.0

const CACHE_NAME = 'ghumnechalo-pwa-v1.4.0';
const STATIC_CACHE_NAME = 'ghumnechalo-static-v1.4.0';

// Essential App Shell resources to precache
const PRECACHE_ASSETS = [
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-72.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const res = await fetch(asset, { cache: 'no-cache' });
            if (res && (res.status === 200 || res.type === 'opaque')) {
              await cache.put(asset, res);
            }
          } catch (err) {
            console.warn('[SW] Precache item skip:', asset, err);
          }
        })
      );
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

  // 3. API Routes: Network First with timeout protection so PWA never hangs
  if (url.pathname.startsWith('/api/')) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    event.respondWith(
      fetch(request, { signal: controller.signal })
        .then((res) => {
          clearTimeout(timeoutId);
          return res;
        })
        .catch(() => {
          clearTimeout(timeoutId);
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'NETWORK_OFFLINE',
                message: 'You are offline or the request timed out.',
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

  // 5. Next.js App Router RSC (React Server Component) requests & Data Prefetching
  const isRscRequest =
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-State-Tree') ||
    url.searchParams.has('_rsc') ||
    url.pathname.includes('/_next/data/');

  if (isRscRequest) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    event.respondWith(
      fetch(request, { signal: controller.signal })
        .then((networkResponse) => {
          clearTimeout(timeoutId);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          clearTimeout(timeoutId);
          // 1. Try exact cached RSC request
          const cached = await caches.match(request);
          if (cached) return cached;

          // 2. Try match without query params
          const pathOnly = await caches.match(url.pathname);
          if (pathOnly) return pathOnly;

          // 3. Graceful fallback: return a clean empty RSC stream so Next.js doesn't crash with a Vercel 500
          return new Response('', {
            status: 200,
            headers: {
              'Content-Type': 'text/x-component',
              'X-GhumneChalo-Offline': 'true',
            },
          });
        })
    );
    return;
  }

  // 6. HTML Navigation Requests: Network First -> Fallback to cached page -> Fallback to /offline
  if (request.mode === 'navigate') {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    event.respondWith(
      fetch(request, { signal: controller.signal })
        .then((networkResponse) => {
          clearTimeout(timeoutId);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          clearTimeout(timeoutId);

          // 1. Try exact requested page from cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // 2. Try match without search params or pathname only
          const urlMatch = await caches.match(url.pathname);
          if (urlMatch) {
            return urlMatch;
          }

          // 3. Fallback to /offline page
          const offlinePage = await caches.match('/offline');
          if (offlinePage) {
            return offlinePage;
          }

          // 4. Try matching /offline in STATIC_CACHE_NAME explicitly
          try {
            const staticCache = await caches.open(STATIC_CACHE_NAME);
            const staticOffline = await staticCache.match('/offline');
            if (staticOffline) {
              return staticOffline;
            }
          } catch {}

          // 5. Hard fallback to self-contained HTML offline shell so Vercel error is NEVER shown
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Offline | GhumneChalo</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#09090b;color:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1.5rem;box-sizing:border-box}.card{background:#18181b;border:1px solid #27272a;border-radius:1.25rem;padding:2rem;max-width:28rem;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)}.icon{display:inline-flex;padding:1rem;background:rgba(245,158,11,0.1);border-radius:1rem;color:#f59e0b;font-size:2rem;margin-bottom:1rem}h1{margin:0 0 0.5rem;font-size:1.5rem;font-weight:700}p{color:#a1a1aa;font-size:0.875rem;line-height:1.5;margin:0 0 1.5rem}.btn{display:inline-block;padding:0.75rem 1.5rem;background:#2563eb;color:#fff;text-decoration:none;border-radius:0.75rem;font-weight:600;font-size:0.875rem;margin:0.25rem}.btn-sec{background:#27272a;color:#e4e4e7}</style></head><body><div class="card"><div class="icon">✈️</div><h1>You are Offline</h1><p>GhumneChalo keeps your travel plans alive offline. Your previously loaded trips and search destinations are safely stored.</p><a href="/trips" class="btn">View Saved Trips</a><a href="/explore" class="btn btn-sec">Offline Explore</a></div></body></html>',
            {
              status: 200,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }
});
