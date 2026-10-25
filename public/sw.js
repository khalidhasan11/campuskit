/* CampusKit Service Worker — Versioned App-Shell Cache with Safe Cleanup & Privacy Guard */
const CACHE_PREFIX = 'campuskit-shell-';
const CACHE_VERSION = '__CAMPUSKIT_SW_VERSION__';
const CACHE_NAME = CACHE_PREFIX + (CACHE_VERSION.includes('__CAMPUSKIT') ? 'v1.0.0-dev' : CACHE_VERSION);

// All precache entries are scope-relative ('./...'). They are resolved against
// the service worker's own registration scope below, so the same sw.js works
// at a domain root AND under a subpath such as GitHub Pages' /campuskit/ —
// a root-absolute '/index.html' would 404 (or fetch the wrong app) there.
const CORE_PRECACHE_URLS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './icon.svg',
  './apple-touch-icon.png',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-192x192.png',
  './pwa-maskable-512x512.png',
  /*__CAMPUSKIT_BUILD_ASSETS__*/
];

// The scope this SW was registered with (always the directory containing
// sw.js, e.g. '/' at a root or '/campuskit/' on a project site). Fall back
// to the SW script's own directory if registration is not available yet.
const SW_SCOPE = (() => {
  try {
    if (self.registration && self.registration.scope) return self.registration.scope;
  } catch {
    // fall through to the location-derived scope
  }
  const href = self.location.href;
  return href.slice(0, href.lastIndexOf('/') + 1);
})();

const scopeUrl = (relativeUrl) => new URL(relativeUrl, SW_SCOPE).href;

function scopeRelativePath(requestUrl) {
  const scopePath = new URL(SW_SCOPE).pathname;
  if (requestUrl.pathname.startsWith(scopePath)) {
    return requestUrl.pathname.slice(scopePath.length);
  }
  return requestUrl.pathname.replace(/^\/+/, '');
}

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
    pathname.includes('/@vite/') ||
    pathname.includes('/__vite')
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
          const absoluteUrl = scopeUrl(url);
          try {
            const response = await fetch(absoluteUrl, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(absoluteUrl, response);
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
            cache.put(scopeUrl('./index.html'), networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cachedIndex =
            (await cache.match(scopeUrl('./index.html'))) || (await cache.match(scopeUrl('./')));
          if (cachedIndex) return cachedIndex;
          const cachedOffline = await cache.match(scopeUrl('./offline.html'));
          if (cachedOffline) return cachedOffline;
          return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  const isImmutableAsset =
    scopeRelativePath(requestUrl).startsWith('assets/') ||
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
