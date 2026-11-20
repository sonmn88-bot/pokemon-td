// v4 밸런스 시뮬레이터: 실제 게임 코드를 화면 없는 브라우저에서 자동 플레이 봇으로 빠르게 돌려 숫자로 비교
// 사용법: node tools/sim.js [판수/영웅=6] [최대웨이브=150]
//   → 영웅별 도달 웨이브(평균·중앙·최소·최대), 데미지 상위 포켓몬 점유율(쏠림 확인), 판당 소요시간
// 봇 규칙(v2, 사람 흉내): 웨이브 자동 시작 · 이자용 골드 저축 · 몸수 6 전엔 일반 뽑기, 이후 프리미엄 + 주력 타입 강화 ·
//   같은 등급 3개면 랜덤 합성 · 보관함 상위 등급은 필드 최저 등급과 교체 · 카드·진화는 첫 번째 · 영웅 3명은 동시에(페이지 3개)
// 렌더링 없이 engine.update()만 고정 dt로 호출 → 실제 시간보다 수십 배 빠름
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const RUNS = +process.argv[2] || 6, MAXW = +process.argv[3] || 150;
const HEROES = (process.env.SIM_HEROES || 'pikachu,togepi,eevee').split(',');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.webp': 'image/webp' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  });
});

// 페이지 안에서 도는 한 판 (문자열로 주입)
const RUN_IN_PAGE = async ({ hero, maxWave }) => {
  const app = window.app, ORDER = window.MERGE_ORDER;
  document.querySelectorAll('.end-overlay,.skin-picker,.card-overlay,.merge-overlay').forEach(o => o.remove());
  if (app.engine) app.backToMapSelect();
  app.starterHero = hero; app.startGame();
  await new Promise(r => setTimeout(r, 50));
  document.querySelector('.skin-picker div[style*="cursor"]')?.click(); // 시작 타워 = 첫 번째
  const e = app.engine; e.stop(); e.start = () => {}; // 실시간 루프 끄고 직접 돌림
  app._startAutoWaveCountdown = () => {}; // 자동 카운트다운 타이머 대신 봇이 시작
  let over = false; const prevGO = e.onGameOver; e.onGameOver = () => { over = true; };
  const gi = g => ORDER.indexOf(g);
  const bot = () => {
    const co = document.querySelector('.card-overlay .co-card'); if (co) co.click();
    const evo = document.querySelector('.skin-picker .skin-card'); if (evo) evo.click(); // 영웅 진화 선택 = 첫 번째 (예전엔 창을 지워서 진화를 못 했음)
    document.querySelectorAll('.merge-reveal,.merge-overlay,.mb-overlay,.skin-picker').forEach(o => o.remove());
    // 영웅 스킬: 적이 5마리 이상이면 쿨 끝난 스킬 사용 (사람이 Q/W 누르듯)
    if (e.enemies.length >= 5) for (const h of e.heroes) (h.def.skills || []).forEach((_, i) => { if (h.canCast(i)) h.cast(i, e); });
    // 보스 소환(사람이 쓰는 큰 골드 수입원): 필드가 한산하고 쿨이 끝났으면, 열린 티어 중 두 번째로 높은 것
    if (e.state === 'wave' && (e._bossSummonCooldown || 0) <= 0 && e.enemies.length < 25) {
      const open = BOSS_TIERS.filter(t => e.currentWave >= t.minWave);
      if (open.length) app._summonBoss(open[Math.max(0, open.length - 2)].tier);
    }
    // 위험(필드 120+): 몬스터볼로 가장 앞선 적 제거 (웨이브당 제한 지킴)
    if (e.enemies.length >= 120) {
      const it = window.ShopItems.find(i => i.key === 'monsterball'), used = (e._shopWaveUses && e._shopWaveUses.monsterball) || 0;
      if (it && used < it.perWave && e.spendGold(window.shopItemCost(it, e))) { it.buy(e); e._shopWaveUses = e._shopWaveUses || {}; e._shopWaveUses.monsterball = used + 1; }
    }
    // v2 봇: 사람처럼 이자 저축(웨이브 10골드당 1, 상한 30 → 300골드 유지가 이득) + 주력 타입 강화 + 필드가 차면 프리미엄
    const w = e.currentWave, danger = e.enemies.length >= 50, reserve = w >= 4 && !danger ? Math.min(300, 40 + w * 20) : 0, PC = window.PULL_COSTS; // 위험하면 저축 없이 전부 투입
    const field = e.towers.filter(t => t._gachaId), cnt = {};
    field.forEach(t => { cnt[t.def.type] = (cnt[t.def.type] || 0) + 1; });
    const dom = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    // 1) 몸수 6마리 전에는 뽑기 우선, 이후엔 주력 타입 강화가 뽑기 2번 값보다 싸면 강화
    if (dom && field.length >= 6 && window.applyTypeUpgrade) {
      const nu = window.getTypeUpgradeAt(dom[0], window.TypeUpgradeLevels[dom[0]] || 0);
      if (nu && nu.cost <= PC.normal * 2.5 && e.gold - nu.cost >= reserve) window.applyTypeUpgrade(dom[0], e);
    }
    // 2) 뽑기 → 빈 자리 우선 (저축분은 남김)
    let guard = 20;
    while (guard-- > 0) {
      const empty = e.towerSlots.findIndex(s => !s.occupied);
      if (empty < 0 && (app._inventory || []).length >= 12) break;
      const key = field.length >= 6 && e.gold - PC.premium >= reserve ? 'premium' : 'normal';
      if (e.gold - PC[key] < reserve) break;
      e.selectedSlotIdx = empty >= 0 ? empty : null; app.doPull(key); e.selectedSlotIdx = null;
    }
    // 2) 같은 등급 3개(보관함 우선) → 랜덤 합성
    for (let k = 0; k < 6; k++) {
      const mats = app._allMaterials(true); let done = false;
      for (const g of ['normal', 'rare', 'epic']) {
        const pick = mats.filter(m => m.def.grade === g && !m.def._isStarter).sort((a, b) => (a.kind === 'store' ? 0 : 1) - (b.kind === 'store' ? 0 : 1)).slice(0, 3);
        if (pick.length === 3) { app._consumeMaterials(pick); app._addToStorage([window.rollRandomMerge(g, app._mergeState || {})]); done = true; break; }
      }
      if (!done) break;
    }
    // 3) 보관함 → 빈 자리 / 더 높은 등급이면 필드 최저 등급과 교체
    const inv = (app._inventory || []).slice().sort((a, b) => gi(b.grade) - gi(a.grade));
    for (const d of inv) {
      let idx = e.towerSlots.findIndex(s => !s.occupied);
      if (idx < 0) {
        let low = -1, lg = 99; e.towerSlots.forEach((s, i) => { if (s.tower && s.tower._gachaId && gi(s.tower.def.grade) < lg) { lg = gi(s.tower.def.grade); low = i; } });
        if (low < 0 || lg >= gi(d.grade)) break;
        const old = e.towerSlots[low].tower.def; app._consumeMaterials([{ kind: 'field', slotIdx: low, def: old }]); app._addToStorage([old]); idx = low;
      }
      app._placeFromStorage(d.id, idx);
    }
  };
  const DT = 1 / 30; let t = 0, lastBot = 0; const trace = [];
  const t0 = performance.now();
  while (!over && e.currentWave < maxWave && t < 60 * 60 * 3) {
    if (e.state === 'idle') { trace.push([e.currentWave, Math.round(e.gold), e.towers.length, (app._inventory || []).length, e.enemies.length, document.querySelectorAll('.skin-picker,.card-overlay,.evo-overlay,[class*=overlay]').length]); app.sendWave(); }
    if (t - lastBot >= 0.5) { try { bot(); } catch (err) { console.error('bot', err.message); } lastBot = t; }
    for (let i = 0; i < 15; i++) { e.dt = DT; e._isLastSubstep = i === 14; try { e.update(); } catch (err) { console.error('upd', err.message); } t += DT; if (over) break; }
    if (((t * 30) | 0) % 900 === 0) await new Promise(r => setTimeout(r, 0)); // 가끔 양보 (setTimeout 콜백 처리)
  }
  e.onGameOver = prevGO;
  const ds = e._dmgStats || {}, tot = Object.values(ds).reduce((a, r) => a + r.dmg, 0) || 1;
  const top = Object.entries(ds).sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 3).map(([k, r]) => [k, Math.round(r.dmg / tot * 100)]);
  return { wave: e.currentWave, over, top, towers: e.towers.length, sec: Math.round(t), ms: Math.round(performance.now() - t0), errs: e._errCount || 0, trace, errLog: (e._errLog || []).slice(0, 3) };
};

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/index.html`;
  const b = await chromium.launch();
  const errs = [], out = {};
  // 영웅마다 페이지 1개씩 동시에 (CPU 코어 활용 → 3배 빠름)
  await Promise.all(HEROES.map(async hero => {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', x => errs.push(String(x)));
    await pg.goto(url, { waitUntil: 'load' });
    await pg.evaluate(() => { localStorage.setItem('pokemontd_audio', '{"sfx":false,"bgm":false}'); });
    out[hero] = [];
    for (let i = 0; i < RUNS; i++) {
      const r = await pg.evaluate(RUN_IN_PAGE, { hero, maxWave: MAXW });
      out[hero].push(r); if (process.env.SIM_DEBUG) console.log(JSON.stringify({ trace: r.trace, errLog: r.errLog }));
      process.stdout.write(`${hero} #${i + 1}: 웨이브 ${r.wave}${r.over ? '' : '(상한)'} · 상위 ${r.top.map(([k, p]) => k + ' ' + p + '%').join(', ')} · ${r.ms}ms\n`);
    }
  }));
  console.log('\n=== 요약 (도달 웨이브) ===');
  const topCount = {};
  for (const hero of HEROES) {
    const w = out[hero].map(r => r.wave).sort((a, b) => a - b), avg = w.reduce((a, b) => a + b, 0) / w.length;
    console.log(`${hero.padEnd(8)} 평균 ${avg.toFixed(1)} · 중앙 ${w[w.length >> 1]} · 최소 ${w[0]} · 최대 ${w[w.length - 1]}`);
    out[hero].forEach(r => r.top[0] && (topCount[r.top[0][0]] = (topCount[r.top[0][0]] || 0) + 1));
  }
  const all = HEROES.flatMap(h => out[h].filter(r => r.over).map(r => r.wave)), bins = {};
  all.forEach(w => { const k = Math.floor(w / 10) * 10; bins[k] = (bins[k] || 0) + 1; });
  console.log('사망 웨이브 분포(10단위):', Object.entries(bins).map(([k, n]) => `${k}~${+k + 9}: ${n}`).join(' · '));
  console.log('MVP 빈도:', Object.entries(topCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
  if (errs.length) console.log('페이지 오류:', errs.slice(0, 5));
  fs.writeFileSync(path.join(ROOT, 'tools', 'sim-result.json'), JSON.stringify(out, null, 1));
  await b.close(); server.close();
})();
