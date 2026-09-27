// No student data or authenticated API response is stored in an offline cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<h1>You are offline</h1><p>Reconnect to securely access Blessed Vines School.</p>',{headers:{'Content-Type':'text/html'}})));});
