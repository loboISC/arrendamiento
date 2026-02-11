const CACHE_NAME = 'sapt-v2';
const ASSETS = [
    '/',
    '/principal.html',
    '/login.html',
    '/index.html',
    '/styles/style.css',
    '/theme-dark.css',
    '/theme.js',
    '/img/logo-empresarial.png',
    '/img/Video de WhatsApp 2025-09-02 a las 12.21.45_e0937468 (3).gif',
    '/img/principal.png'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching assets');
                return cache.addAll(ASSETS);
            })
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            );
        })
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cacheRes => {
                return cacheRes || fetch(event.request);
            })
    );
});
