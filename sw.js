const CACHE_SCOPE = 'idroclima-procedures-'+new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi,'_');
const CACHE_NAME = CACHE_SCOPE+'-pwa47';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './admin-tools.js',
    './messages.js',
    './messages.css',
    './loading-ui.js',
    './loading-ui.css',
    './idroclima-drop-180.png',
    './release-config.js',
    './procedures-day.js',
    './procedures-day.css',
    './pdf.min.mjs',
    './pdf.worker.min.mjs',
    './jsQR.js',
    './manifest.json',
    './idroclima-app-192.png',
    './idroclima-app-512.png',
    './idroclima-drop-48.png'
];

self.addEventListener('install', (evt) => {
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'}))))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keyList) => Promise.all(
            keyList.map((key) => key.startsWith(CACHE_SCOPE+'-') && key !== CACHE_NAME && key !== CACHE_SCOPE+'-account' ? caches.delete(key) : undefined)
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
            fetch(evt.request,{cache:'no-cache'})
                .then((networkResponse) => {
                    const responseCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(evt.request, responseCopy));
                    return networkResponse;
                })
                .catch(() => caches.open(CACHE_NAME).then(cache=>cache.match(evt.request,{ignoreSearch:true})))
        );
        return;
    }

    evt.respondWith(
        caches.open(CACHE_NAME).then(cache=>cache.match(evt.request,{ignoreSearch:true})).then((cachedResponse) => {
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

/* PROCEDURES ADDITION: only generic payloads; never cache documents or API tokens. */
const ACCOUNT_CACHE=CACHE_SCOPE+'-account';
const ACCOUNT_URL=new URL('__push_account__',self.registration.scope).href;
let accountWrite=Promise.resolve();
self.addEventListener('message',evt=>{if(!evt.source?.url?.startsWith(self.registration.scope)||evt.data?.type!=='IDROCLIMA_PUSH_ACCOUNT')return;accountWrite=accountWrite.catch(()=>{}).then(async()=>{const cache=await caches.open(ACCOUNT_CACHE);if(evt.data.userId)await cache.put(ACCOUNT_URL,new Response(JSON.stringify({userId:String(evt.data.userId)})));else await cache.delete(ACCOUNT_URL);});evt.waitUntil(accountWrite.then(()=>evt.ports?.[0]?.postMessage({ok:true}),()=>evt.ports?.[0]?.postMessage({ok:false})));});
self.addEventListener('push',evt=>{evt.waitUntil((async()=>{let data;try{data=evt.data.json();}catch{return;}await accountWrite;const cache=await caches.open(ACCOUNT_CACHE),stored=await cache.match(ACCOUNT_URL);if(!stored||String((await stored.json()).userId)!==String(data.userId))return;await self.registration.showNotification(data.isTest?'Notifica di prova Idroclima':'Procedure per i lavori caricati',{body:'Apri le procedure'+(/^\d{4}-\d{2}-\d{2}$/.test(data.date)?' del '+data.date.split('-').reverse().join('/'):' collegate alla tua giornata')+'.',icon:new URL('idroclima-app-192.png',self.registration.scope).href,badge:new URL('idroclima-drop-48.png',self.registration.scope).href,tag:data.tag,renotify:true,requireInteraction:true,data:{userId:String(data.userId),dayKey:String(data.dayKey||''),revision:String(data.revision||'')}});})());});
self.addEventListener('notificationclick',evt=>{evt.notification.close();evt.waitUntil((async()=>{const cache=await caches.open(ACCOUNT_CACHE),stored=await cache.match(ACCOUNT_URL);if(!stored||String((await stored.json()).userId)!==evt.notification.data?.userId)return;const target=new URL('index.html?procedures=today',self.registration.scope);if(evt.notification.data.dayKey)target.searchParams.set('dayKey',evt.notification.data.dayKey);const url=target.href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(w=>w.url.startsWith(self.registration.scope));if(existing){await existing.focus();existing.postMessage({type:'IDROCLIMA_PROCEDURES_OPEN',dayKey:evt.notification.data.dayKey||''});}else await self.clients.openWindow(url);})());});
