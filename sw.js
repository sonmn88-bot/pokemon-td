const CACHE = 'pokemon-td-v12';
const ASSETS = [
  '/pokemon-td/',
  '/pokemon-td/index.html',
  '/pokemon-td/style.css',
  '/pokemon-td/engine.js',
  '/pokemon-td/maps.js',
  '/pokemon-td/enemies.js',
  '/pokemon-td/towers.js',
  '/pokemon-td/heroes.js',
  '/pokemon-td/shop.js',
  '/pokemon-td/gacha.js',
  '/pokemon-td/main.js',
  '/pokemon-td/sprites.js',
  '/pokemon-td/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .catch(err => console.warn('SW cache failed:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => r))
  );
});
