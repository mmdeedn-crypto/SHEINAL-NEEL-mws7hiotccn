const CACHE='shein-neel-shell-v16';
const OTA_CACHE='shein-neel-ota-content-v1';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('shein-neel-')&&k!==CACHE&&k!==OTA_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin){
  if(['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com','cdnjs.cloudflare.com','i.pinimg.com'].includes(url.hostname)){
   event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(req);if(hit)return hit;try{const res=await fetch(req);if(res.ok)cache.put(req,res.clone());return res}catch(e){return hit||Response.error()}}));
  }return;
 }
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   const ota=await caches.open(OTA_CACHE);
   const updated=await ota.match(req,{ignoreSearch:true});
   if(updated)return updated;
   try{const res=await fetch(req);const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}
   catch(e){return caches.match('./index.html').then(r=>r||caches.match('./'))}
  })());
  return;
 }
 event.respondWith(caches.match(req).then(hit=>{const fresh=fetch(req).then(res=>{if(res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));return res}).catch(()=>hit);return hit||fresh}));
});
