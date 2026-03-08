const CACHE_NAME = 'lumina-bible-v10';
const ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/favicon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // COMPLETELY IGNORE API CALLS
    if (e.request.url.includes('/api/') || e.request.method !== 'GET') {
        return;
    }

    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(e.request).then((response) => {
                // Don't cache non-successful responses or browser extensions
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Dynamically cache Vite assets (js/css) since their hashes change
                if (e.request.url.includes('/assets/')) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseToCache);
                    });
                }
                
                return response;
            });
        })
    );
});
