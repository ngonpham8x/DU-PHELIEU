/* Phase 4E: static PWA cache only; never cache account, Firestore or API responses. */
const CACHE_NAME = 'dunhua-pwa-static-v4g';
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/logo-horizontal.svg', '/icon.svg', '/favicon.ico', '/pwa-192x192.png', '/pwa-512x512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith('dunhua-')&&k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__/'))return;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));
    return;
  }
  const isStatic=/\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?|json)$/.test(url.pathname);
  if(!isStatic)return;
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
    if(response.ok&&response.type==='basic'){
      const copy=response.clone();e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(req,copy)));
    }
    return response;
  })));
});
