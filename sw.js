const CACHE_NAME = 'portale-aziendale-v18';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './idroclima-app-192.png',
    './idroclima-app-512.png',
    './idroclima-drop-48.png'
];

self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keyList) => Promise.all(
            keyList.map((key) => key !== CACHE_NAME ? caches.delete(key) : undefined)
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
    const requestUrl = new URL(evt.request.url);

    if (requestUrl.hostname.includes('script.google.com') || requestUrl.hostname.includes('googleusercontent.com')) {
        return;
    }

    if (evt.request.method !== 'GET') {
        return;
    }

    const isLocalAsset = requestUrl.origin === self.location.origin;
    const isFreshAsset = isLocalAsset && (
        evt.request.mode === 'navigate' ||
        requestUrl.pathname.endsWith('.html') ||
        requestUrl.pathname.endsWith('.js') ||
        requestUrl.pathname.endsWith('.css') ||
        requestUrl.pathname.endsWith('manifest.json')
    );

    if (isFreshAsset) {
        evt.respondWith(
            fetch(evt.request)
                .then((networkResponse) => {
                    const responseCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, responseCopy));
                    return networkResponse;
                })
                .catch(() => caches.match(evt.request))
        );
        return;
    }

    evt.respondWith(
        caches.match(evt.request).then((cachedResponse) => {
            return cachedResponse || fetch(evt.request).then((networkResponse) => {
                if (isLocalAsset) {
                    const responseCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, responseCopy));
                }
                return networkResponse;
            });
        })
    );
});
