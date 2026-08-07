// La version viene en la URL con la que main.tsx registra este archivo, y sale
// del hash del build. Con un nombre fijo, los bundles de cada deploy se
// acumulaban para siempre: el handler de `activate` borra todo cache cuyo
// nombre no sea el actual, pero el nombre nunca cambiaba.
//
// Se lee de la query y no de una constante para que este archivo siga siendo
// estatico en public/, que es lo que lo mantiene simple.
const VERSION = new URL(self.location.href).searchParams.get('v') ?? 'dev';
const CACHE_NAME = `fittrack-${VERSION}`;
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
            return caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, copia))
              .catch(() => {})
              .then(() => res);
          }
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Bundles y fuentes: cache first, y se llena a medida que se piden. Solo
  // esas dos rutas, que son chicas y no cambian; los GIF de movimientos son
  // 126MB y llenarían el disco del teléfono sin que nada los pode.
  const ruta = new URL(event.request.url).pathname;
  const esAsset = ruta.startsWith('/assets/') || ruta.startsWith('/fonts/');

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
