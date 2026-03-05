const CACHE_NAME = 'lumina-bible-v7';
const ASSETS = [
    '/lumina-bible/',
    '/lumina-bible/index.html',
    '/lumina-bible/manifest.json',
    '/lumina-bible/icon-192.png',
    '/lumina-bible/icon-512.png',
    '/lumina-bible/favicon.png',
    '/lumina-bible/assets/index-uMaqaJ8Q.js',
    '/lumina-bible/assets/index-NtkbJtD3.css'
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
    // 1. COMPLETELY IGNORE API CALLS (Don't even call respondWith)
    if (e.request.url.includes('/api/') || e.request.method !== 'GET') {
        return;
    }

    // 2. Handle static assets with cache-first strategy
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            return cachedResponse || fetch(e.request);
        })
    );
});
