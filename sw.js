const CACHE_NAME = 'squad-app-v2'; // Cambiado a v2 para invalidar el caché anterior
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Instalación: Fuerza al nuevo Service Worker a activarse inmediatamente
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Archivos en caché actualizados');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activación: Limpia cachés antiguos y toma el control
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Limpiando caché antiguo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia Network First: Prioriza la red para ver cambios al recargar
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return networkResponse;
            })
            .catch(() => caches.match(event.request)) // Si estás offline, usa el caché guardado
    );
});
