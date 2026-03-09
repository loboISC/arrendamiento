const CACHE_NAME = 'sapt-v6-sw-networkfirst-docs';
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
    return self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const requestUrl = new URL(event.request.url);
    const isExternal = requestUrl.origin !== self.location.origin;

    // No intercept external CDNs (amCharts/jsdelivr/etc) to avoid CSP issues via SW.
    if (isExternal) {
        return;
    }

    // HTML/document requests should be network-first so latest JS changes are reflected.
    if (event.request.mode === 'navigate' || event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request)
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
                    return res;
                })
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    return cached || Response.error();
                })
        );
        return;
    }

    // Do not cache reports/PDF/API calls.
    if (
        event.request.url.includes('reporte_') ||
        event.request.url.includes('/pdf/') ||
        event.request.url.includes('/api/')
    ) {
        event.respondWith(
            fetch(event.request).catch(err => {
                console.warn('[SW] Network fetch failed (bypass route):', err);
                return Response.error();
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cacheRes => {
            if (cacheRes) return cacheRes;
            return fetch(event.request).catch(err => {
                console.warn('[SW] Fetch failed, probably server is down:', err);
                return Response.error();
            });
        })
    );
});
