/* CampusKit Service Worker — Versioned App-Shell Cache with Safe Cleanup & Privacy Guard */
const CACHE_PREFIX = 'campuskit-shell-';
const CACHE_VERSION = '__CAMPUSKIT_SW_VERSION__';
const CACHE_NAME = CACHE_PREFIX + (CACHE_VERSION.includes('__CAMPUSKIT') ? 'v1.0.0-dev' : CACHE_VERSION);

const CORE_PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-192x192.png',
  '/pwa-maskable-512x512.png',
  /*__CAMPUSKIT_BUILD_ASSETS__*/
];

function isPrivateOrUncacheable(requestUrl, request) {
  if (request.method !== 'GET') return true;
  if (
    requestUrl.protocol === 'blob:' ||
    requestUrl.protocol === 'data:' ||
    requestUrl.protocol === 'chrome-extension:'
  ) {
    return true;
  }
  if (requestUrl.origin !== self.location.origin) return true;
  const pathname = requestUrl.pathname.toLowerCase();
  if (
    pathname.includes('/attachment') ||
    pathname.includes('/private') ||
    pathname.includes('/user-blob') ||
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/__vite')
  ) {
    return true;
  }
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        CORE_PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch {
            // Ignored when installing while offline
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve(false);
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return;
  }

  if (isPrivateOrUncacheable(requestUrl, request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            cache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cachedIndex = (await cache.match('/index.html')) || (await cache.match('/'));
          if (cachedIndex) return cachedIndex;
          const cachedOffline = await cache.match('/offline.html');
          if (cachedOffline) return cachedOffline;
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  const isImmutableAsset =
    requestUrl.pathname.startsWith('/assets/') ||
    requestUrl.pathname.endsWith('.png') ||
    requestUrl.pathname.endsWith('.svg') ||
    requestUrl.pathname.endsWith('.webmanifest');

  if (isImmutableAsset) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error('Network unavailable and asset not cached');
      }
    })()
  );
});
