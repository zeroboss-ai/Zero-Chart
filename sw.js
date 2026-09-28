// Zero Chart — High-Performance Trading Terminal Service Worker
const CACHE_NAME = 'zero-chart-v2.7.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/zero-chart.css',
  './js/zero-chart-app.js',
  './js/watchlist-data.js',
  './js/feeds/binance-feed.js',
  './js/feeds/commodity-feed.js',
  './js/feeds/multi-feed.js',
  './js/feeds/openalgo-feed.js',
  './lib/openalgo-charts.standalone.js',
  './lib/openalgo-charts.mjs',
  './lib/openalgo-charts.indicators.mjs',
  './lib/openalgo-charts.widget.mjs',
  './lib/openalgo-charts.trade.mjs',
  './assets/zero-chart-logo.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

// 1. Install: Precache App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial failure:', err);
      });
    })
  );
});

// 2. Activate: Purge Outdated Caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch: Network-First with Cache Fallback for instant updates
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Live market API calls, WebSockets, or POST requests bypass cache
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.protocol.startsWith('ws')
  ) {
    return;
  }

  // Network-first strategy so fresh code and indicators are always served immediately
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
