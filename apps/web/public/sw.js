// ponytail: nombre fijo, así que los bundles viejos de deploys anteriores
// quedan en el cache. Son unos cientos de KB por deploy; si molesta, el
// nombre pasa a llevar el hash del build.
const CACHE_NAME = 'fittrack-v1';
// './' es la carcasa offline. Se puede precachear porque la navegación va a
// red primero y solo cae acá cuando no hay conexión.
const ASSETS_TO_CACHE = [
  './',
  './manifest.json',
  './favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  // La navegación va a red primero: así un deploy se ve enseguida. La copia
  // en cache es solo el respaldo para abrir la app sin conexión.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Assets con hash en el nombre: cache first, y se llena a medida que se
  // piden. Solo /assets/: los GIF de movimientos son 126MB y llenarían el
  // disco del teléfono sin que nada los pode.
  const esAsset = new URL(event.request.url).pathname.startsWith('/assets/');

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((res) => {
        if (esAsset && res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return res;
      });
    })
  );
});
