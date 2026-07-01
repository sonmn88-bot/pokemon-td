const CACHE = 'pokemon-td-v8';
const ASSETS = [
  '/', '/index.html', '/style.css',
  '/engine.js', '/maps.js', '/enemies.js', '/towers.js', '/sprites.js', '/heroes.js', '/shop.js', '/main.js',
  '/manifest.json',
  '/assets/heroes/pikachu.png', '/assets/heroes/mew.png', '/assets/heroes/togepi.png',
  '/assets/towers/bulbasaur.png', '/assets/towers/charmander.png', '/assets/towers/squirtle.png',
  '/assets/towers/voltorb.png', '/assets/towers/jynxline.png', '/assets/towers/geodude.png',
  '/assets/towers/abra.png', '/assets/towers/snorlax.png',
  '/assets/enemies/abo.png', '/assets/enemies/golbat.png', '/assets/enemies/jigglypuff.png',
  '/assets/enemies/gastly.png', '/assets/enemies/paras.png', '/assets/enemies/phantump.png',
  '/assets/enemies/lapras.png', '/assets/enemies/gyarados.png', '/assets/enemies/weezing.png',
  '/assets/enemies/scyther.png', '/assets/enemies/lugia.png', '/assets/enemies/mewtwo.png',
  '/assets/enemies/rattata.png', '/assets/enemies/zubat.png', '/assets/enemies/koffing.png',
  '/assets/enemies/magnemite.png', '/assets/enemies/onix.png', '/assets/enemies/haunter.png',
  '/assets/enemies/electrode.png', '/assets/enemies/dragonite.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
