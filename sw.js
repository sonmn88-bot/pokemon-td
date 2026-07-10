const CACHE = 'pokemon-td-v29';
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
  '/pokemon-td/leaderboard.js',
  '/pokemon-td/firebase-config.js',
  '/pokemon-td/ui-builders.js',
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

// v27-7: 네트워크 우선 전략으로 전환 (기존 캐시우선 방식이 이번 세션 내내 "배포했는데 반영 안됨" 문제의
// 근본 원인이었음 - 매번 캐시버전을 수동으로 올려야 새 배포가 적용됐음). 이제 온라인이면 항상 최신 파일을
// 받아오고, 오프라인일 때만 캐시로 폴백 - PWA 오프라인 지원은 유지하면서 배포 반영 문제는 해결됨.
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 성공한 응답은 캐시에도 갱신해둠 (다음 오프라인 대비)
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
