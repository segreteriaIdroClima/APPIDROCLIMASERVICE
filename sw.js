const CACHE_SCOPE = 'idroclima-procedures-'+new URL(self.registration.scope).pathname.replace(/[^a-z0-9]/gi,'_');
const CACHE_NAME = CACHE_SCOPE+'-pwa48';
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
        caches.open(CACHE_NAME).then(cache => {
            const assets = [...ASSETS_TO_CACHE, ...ASSETS_TO_CACHE.filter(asset=>/\.(js|css)$/.test(asset)).map(asset=>asset+'?v='+ (asset==='./jsQR.js'?'27':'pwa48'))];
            return cache.addAll(assets.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'})));
        }).then(()=>self.skipWaiting())
    );
});

self.addEventListener('activate', (evt) => {
    evt.waitUntil(
        caches.keys().then((keyList) => Promise.all(
            keyList.map((key) => key.startsWith(CACHE_SCOPE+'-') && key !== CACHE_NAME && key !== CACHE_SCOPE+'-account' ? caches.delete(key) : undefined)
        ))
    );
    self.clients.claim();
});

// Cache only known static resources for this release. Operational data stays on the network.
const STATIC_PATHS = new Set(ASSETS_TO_CACHE.map(asset=>new URL(asset,self.registration.scope).pathname));
self.addEventListener('fetch', evt => {
    const request=evt.request,url=new URL(request.url);
    if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
    const known=STATIC_PATHS.has(url.pathname);
    const version=url.searchParams.get('v');
    const singleVersion=[...url.searchParams.keys()].every(key=>key==='v');
    const versioned=known&&singleVersion&&(version==='pwa48'||(url.pathname.endsWith('/jsQR.js')&&version==='27'));
    const binary=known&&!url.search&&/\.(png|mjs)$/.test(url.pathname);
    // Configuration and HTML always check the network for updated destinations/releases.
    const fast=request.mode!=='navigate'&&!url.pathname.endsWith('/release-config.js')&&(versioned||binary);
    evt.respondWith((async()=>{
        const cache=await caches.open(CACHE_NAME);
        if(fast){const hit=await cache.match(request);if(hit)return hit;}
        try{
            const response=await fetch(request,{cache:'no-cache'});
            if(known&&response.ok&&response.type!=='opaque')await cache.put(request,response.clone());
            return response;
        }catch(error){
            const fallback=known?await cache.match(request):null;
            if(fallback)return fallback;
            if(request.mode==='navigate'){
                const home=await cache.match(new URL('index.html',self.registration.scope));
                if(home)return home;
            }
            throw error;
        }
    })());
});

/* PROCEDURES ADDITION: only generic payloads; never cache documents or API tokens. */
const ACCOUNT_CACHE=CACHE_SCOPE+'-account';
const ACCOUNT_URL=new URL('__push_account__',self.registration.scope).href;
let accountWrite=Promise.resolve();
self.addEventListener('message',evt=>{if(!evt.source?.url?.startsWith(self.registration.scope)||evt.data?.type!=='IDROCLIMA_PUSH_ACCOUNT')return;accountWrite=accountWrite.catch(()=>{}).then(async()=>{const cache=await caches.open(ACCOUNT_CACHE);if(evt.data.userId)await cache.put(ACCOUNT_URL,new Response(JSON.stringify({userId:String(evt.data.userId)})));else await cache.delete(ACCOUNT_URL);});evt.waitUntil(accountWrite.then(()=>evt.ports?.[0]?.postMessage({ok:true}),()=>evt.ports?.[0]?.postMessage({ok:false})));});
self.addEventListener('push',evt=>{evt.waitUntil((async()=>{let data;try{data=evt.data.json();}catch{return;}await accountWrite;const cache=await caches.open(ACCOUNT_CACHE),stored=await cache.match(ACCOUNT_URL);if(!stored||String((await stored.json()).userId)!==String(data.userId))return;await self.registration.showNotification(data.isTest?'Notifica di prova Idroclima':'Procedure per i lavori caricati',{body:'Apri le procedure'+(/^\d{4}-\d{2}-\d{2}$/.test(data.date)?' del '+data.date.split('-').reverse().join('/'):' collegate alla tua giornata')+'.',icon:new URL('idroclima-app-192.png',self.registration.scope).href,badge:new URL('idroclima-drop-48.png',self.registration.scope).href,tag:data.tag,renotify:true,requireInteraction:true,data:{userId:String(data.userId),dayKey:String(data.dayKey||''),revision:String(data.revision||'')}});})());});
self.addEventListener('notificationclick',evt=>{evt.notification.close();evt.waitUntil((async()=>{const cache=await caches.open(ACCOUNT_CACHE),stored=await cache.match(ACCOUNT_URL);if(!stored||String((await stored.json()).userId)!==evt.notification.data?.userId)return;const target=new URL('index.html?procedures=today',self.registration.scope);if(evt.notification.data.dayKey)target.searchParams.set('dayKey',evt.notification.data.dayKey);const url=target.href;const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(w=>w.url.startsWith(self.registration.scope));if(existing){await existing.focus();existing.postMessage({type:'IDROCLIMA_PROCEDURES_OPEN',dayKey:evt.notification.data.dayKey||''});}else await self.clients.openWindow(url);})());});
