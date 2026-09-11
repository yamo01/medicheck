/* MediCheck — Service Worker
   Rôle : mettre en cache les fichiers statiques et les deux bases .db
   pour un usage hors-ligne.

   Deux stratégies, et non plus une seule :
   - le code de l'app (HTML, manifeste) et les fiches RCP passent par le
     réseau d'abord ;
   - les fichiers lourds et figés (bases, WebAssembly, logos) passent par le
     cache d'abord.

   Les fiches RCP (rcp_fr/, rcp_be/, rcp_eu/) sont petites (~10 Ko) et leur
   contenu change quand on réextrait les RCP. En « cache d'abord », une
   personne qui avait consulté un médicament gardait l'ancienne fiche
   indéfiniment — par exemple sans les tableaux de posologie ajoutés ensuite.

   La stratégie « cache d'abord » appliquée à tout servait l'ancienne page
   après chaque mise en ligne. L'utilisateur restait une visite en retard :
   il voyait la version précédente, et la nouvelle n'arrivait qu'au
   chargement suivant.

   Quand une base .db change (nouvel import BDPM ou SAM), incrémenter
   CACHE_NAME. Cela vide le cache et force un téléchargement neuf. */

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

/* Ces adresses doivent venir du serveur quand il est joignable : le code de
   l'app, et les fiches RCP. Le cache ne sert qu'en cas de coupure. */
function isAppCode(url) {
  const path = url.pathname;
  return path.endsWith('/') || path.endsWith('.html') || path.endsWith('manifest.json');
}
function isRcpSheet(url) {
  return /\/rcp_(fr|be|eu)\/.+\.json$/.test(url.pathname);
}

/* Range une réponse valide dans le cache, sans bloquer la réponse rendue. */
function putInCache(request, response) {
  if (!response || !response.ok) return;
  const clone = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
}

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

  if (isAppCode(url) || isRcpSheet(url)) {
    // Réseau d'abord. Le cache ne sert qu'en cas de coupure.
    event.respondWith(
      fetch(event.request)
        .then(response => { putInCache(event.request, response); return response; })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache d'abord. Ces fichiers ne changent pas pour une même version.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => { putInCache(event.request, response); return response; });
    })
  );
});
