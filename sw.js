const CACHE = 'habit-bic-static-v1';
const FILES = [
  './',
  './index.html',
  './app.js',
  './firebase-config.js'
];
self.addEventListener('install', evt=>{
  evt.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
});
self.addEventListener('fetch', evt=>{
  evt.respondWith(caches.match(evt.request).then(r=>r||fetch(evt.request)));
});
