const CACHE_NAME = 'lumina-bible-v1';
const ASSETS = [
    '/lumina-bible/',
    '/lumina-bible/index.html',
    '/lumina-bible/manifest.json',
    '/lumina-bible/icon-192.png',
    '/lumina-bible/icon-512.png',
    '/lumina-bible/favicon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
