const CACHE = 'dauphim-v2.4';
const STATIC_ASSETS = [
    './',
    'index.html',
    'home.html',
    'watch.html',
    'detail.html',
    'styles.css',
    'app.js',
    'home.js',
    'detail.js',
    'data-loader.js',
    'data.js',
    'video-config.js',
    'android-menu.js',
    'manifest.json',
    'icon.svg',
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC_ASSETS))
    );
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

    // Network-first for data and scripts to guarantee instant updates
    if (url.pathname.endsWith('.json') || url.pathname.endsWith('.js')) {
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
