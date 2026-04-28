const CACHE = 'dauphim-v1';
const STATIC_ASSETS = [
    './',
    'index.html',
    'watch.html',
    'styles.css',
    'app.js',
    'home.js',
    'data-loader.js',
    'data.js',
    'video-config.js',
    'android-menu.js',
    'manifest.json',
    'icon.svg',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Pass through: external origins (CDN, fonts, HLS streams)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Network-first for data.json (content changes)
    if (url.pathname.endsWith('data.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for static assets
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
