const CACHE_NAME = 'sapt-v6-sw-networkfirst-docs';
const ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/styles/style.css',
    '/theme.js'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching assets');
                // Cache individually to avoid addAll failing on missing resources
                return Promise.allSettled(
                    ASSETS.map(asset =>
                        cache.add(asset).catch(err => {
                            console.warn(`[SW] Failed to cache ${asset}:`, err.message);
                        })
                    )
                );
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

self.addEventListener('push', event => {
    let data = {};

    try {
        data = event.data ? event.data.json() : {};
    } catch (error) {
        console.warn('[SW] Push payload no JSON:', error);
    }

    const title = data.title || 'Actualizacion de pedido';
    const options = {
        body: data.body || 'Hay una nueva actualizacion disponible.',
        icon: data.icon || '/assets/images/LOGO_ANDAMIOS_02.png',
        badge: data.badge || '/assets/images/badge-36x36.png',
        tag: data.tag || 'seguimiento-logistica',
        requireInteraction: Boolean(data.requireInteraction),
        data: {
            url: data.url || '/seguimiento_cliente.html'
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
    event.notification.close();

    const targetUrl = event.notification?.data?.url || '/seguimiento_cliente.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }

            return null;
        })
    );
});
