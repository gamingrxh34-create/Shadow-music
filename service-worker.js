const CACHE_NAME = 'shadow-music-v2-cache-v11';
const ASSETS = [
  './?v=11',
  './index.html?v=11',
  './css/style.css?v=11',
  './css/player.css?v=11',
  './js/app.js?v=11',
  './js/player.js?v=11',
  './js/search.js?v=11',
  './js/playlists.js?v=11',
  './js/recentlyPlayed.js?v=11',
  './js/indexeddb.js?v=11',
  './js/downloads.js?v=11',
  './data/songs.json?v=11',
  './data/artists.json?v=11',
  './manifest.json?v=11'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('.mp3') || e.request.destination === 'audio') return;
  
  if (e.request.url.includes('.json')) {
    e.respondWith(
      fetch(e.request)
        .then(netRes => {
          const copy = netRes.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          return netRes;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(caches.match(e.request).then(res => {
    return res || fetch(e.request).then(netRes => {
      if (!netRes || netRes.status !== 200 || netRes.type !== 'basic') return netRes;
      const copy = netRes.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
      return netRes;
    });
  }));
});
