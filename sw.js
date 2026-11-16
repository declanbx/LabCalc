// Offline cache. The app's own files are served from the cache at once and refreshed from the
// network in the background, so a new version reaches the phone on the next launch. The pinned
// library files never change, so they are served from the cache only.
// Bump CACHE_NAME when the list below changes.
const CACHE_NAME = 'labcalc-v2';
const ASSETS = [
  './',
  './index.html',
  './calc.js',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.26.10/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) {
    event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        });
        if (cached) {
          event.waitUntil(fresh.catch(() => {}));
          return cached;
        }
        return fresh;
      })
    )
  );
});
