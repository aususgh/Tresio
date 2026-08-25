const CACHE_NAME = 'squad-app-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log('Archivos en caché');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Limpiando caché antiguo');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Estrategia Cache First (busca primero en caché, luego en la red)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            if (response) {
                return response; // Devuelve del caché
            }
            return fetch(event.request); // Devuelve de la red
        })
    );
});