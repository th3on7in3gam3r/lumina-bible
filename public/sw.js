const CACHE_NAME = 'lumina-bible-v5';
const ASSETS = [
    '/lumina-bible/',
    '/lumina-bible/index.html',
    '/lumina-bible/manifest.json',
    '/lumina-bible/icon-192.png',
    '/lumina-bible/icon-512.png',
    '/lumina-bible/favicon.png',
    '/lumina-bible/assets/index-KInlSePu.js',
    '/lumina-bible/assets/index-BwE9mvh6.css'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Bypass Service Worker for API calls and non-GET requests
    if (e.request.url.includes('/api/') || e.request.method !== 'GET') {
        return;
    }
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
