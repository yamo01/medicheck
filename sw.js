/* MediCheck — Service Worker
   Rôle : mettre en cache les fichiers statiques et les deux bases .db
   pour un usage hors-ligne. Stratégie cache-first, avec repli réseau. */

const CACHE_NAME = 'medicheck-v1';
const PRECACHE_URLS = [
  './',
  'medicine-check.html',
  'manifest.json',
  'src/sql-wasm.js',
  'src/sql-wasm.wasm',
  'src/drugs_fr.db',
  'src/drugs_be.db',
  'src/logo-icon.svg',
  'src/logo-name.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
