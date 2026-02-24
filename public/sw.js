const CACHE_NAME = 'sapt-v4-csp-fix';
const ASSETS = [
    '/',
    '/principal.html',
    '/login.html',
    '/index.html',
    '/inventario.html',
    '/scripts/inventario.js',
    '/js/inventory-ui.js',
    '/styles/inventario-new.css',
    '/styles/style.css',
    '/theme-dark.css',
    '/theme.js',
    '/img/logo-empresarial.png',
    '/img/principal.png',
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
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
    // Force immediate activation
    self.skipWaiting();
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
    // Take control immediately
    return self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', event => {
    // NO cachear páginas de reporte ni PDFs para evitar conflictos de CSP
    if (event.request.url.includes('reporte_') ||
        event.request.url.includes('/pdf/') ||
        event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cacheRes => {
                return cacheRes || fetch(event.request);
            })
    );
});
