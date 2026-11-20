// v4 밸런스 시뮬레이터: 실제 게임 코드를 화면 없는 브라우저에서 자동 플레이 봇으로 빠르게 돌려 숫자로 비교
// 사용법: node tools/sim.js [판수/영웅=6] [최대웨이브=150]
//   → 영웅별 도달 웨이브(평균·중앙·최소·최대), 데미지 상위 포켓몬 점유율(쏠림 확인), 판당 소요시간
// 봇 v4: 사용자 실제 플레이 방식(보스 계속 소환·쿨마다 전체 주문·영웅 스킬, 센 타워 초입/보조 중간 배치, 먹이 재료 남기기,
//   스톤 뜨면 즉시 메가, 레전드로 빈 자리 채우기, 부지 확장, 후반 10연) + 골드는 'DPS ÷ 비용' 비교. 상세·설정·유지보수: tools/SIM.md
// 출력: 판마다 보스 소환/처치/골드, 메가·★, 지출 내역 / 요약: 평균·사망 분포·지출 비중·MVP
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
const RUN_IN_PAGE = async ({ hero, maxWave, STRAT }) => {
  // ===== 전략 설정 (SIM_STRAT='{"boss":"none"}' 처럼 JSON으로 덮어써서 비교) — 규칙이 바뀌면 여기부터 고침 =====
  const P = Object.assign({
    boss: 'max',          // max: 쿨마다 열린 최고 티어 / low: 1티어 / none: 안 함 (보스는 필드 1마리로 계산 → 쌓아두고 나중에 잡기)
    spells: 'always',     // always: 쿨마다 전체 주문(적 5+) / danger: 위험할 때만
    tenFromWave: 20,      // 이 웨이브부터(또는 자리가 다 차면) 일반 뽑기 대신 900 모아 10연 (100 절약)
    interest: 300,        // 이자용 저축 상한 (필드 위험하면 0)
    place: 'smart',       // smart: 센 타워 = 길 많이 덮는 초입, 감속·빙결·스턴 = 중간 / first: 빈 자리 아무 데나
    rearrangeEvery: 3,    // 몇 웨이브마다 배치 재정렬
    utilSlots: 3,         // 중간에 둘 보조(감속·빙결·스턴) 타워 수
  }, STRAT || {});
  const BOSS = P.boss;
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
  // ===== 봇 v3: 사람처럼 '골드 1당 늘어나는 화력'으로 행동을 고름 =====
  const ST = { boss: { summon: 0, kill: 0, gold: 0 }, spend: {}, megas: 0, feeds: 0, evolves: 0, recipes: [], spells: 0, cardsTaken: 0, cardsSkipped: 0, tm: 0, candy: 0, items: 0 };
  const spent = (k, g) => { ST.spend[k] = (ST.spend[k] || 0) + g; };
  const origDie = e._onEnemyDie.bind(e);
  e._onEnemyDie = en => { if (typeof en._bossTier === 'number') { ST.boss.kill++; ST.boss.gold += Math.round(en.reward || 0); } origDie(en); };
  const GD = {}; for (const g of ORDER) { const l = Object.values(GachaTowerDefs).filter(d => d.grade === g && !d.mega); GD[g] = l.length ? l.reduce((a, d) => a + d.damage * (d.fireRate || 1), 0) / l.length : 0; }
  const EV = k => window.PULL_TABLES[k].reduce((a, x) => a + x.weight * (GD[x.grade] || 0), 0) / window.PULL_TABLES[k].reduce((a, x) => a + x.weight, 0);
  const tdps = t => { try { return t.damage * t.fireRate * (t.def.mega || t.def.grade === 'unique' ? 2 : 1); } catch (_) { return 0; } }; // 메가·유니크는 다중 타겟이라 ×2로 어림
  const defDps = d => (GD[d.grade] || 0) * (1 + 0.35 * (((d._stack) || 1) - 1));
  const KR = { fire: '불꽃', water: '물', electric: '전기', grass: '풀', psychic: '에스퍼', normal: '노말' };
  const EEVEE = { flareon: 'fire', jolteon: 'electric', vaporeon: 'water' };
  // 슬롯 점수: 사거리(160) 안 길 점 수, 초입일수록 가중(최대 2배) / mid: 덮는 길의 평균 위치(0=입구, 1=끝)
  let SS = null; const slotScore = () => { if (SS && SS.n === e.towerSlots.length) return SS;
    const path = (e.paths && e.paths[0]) || [], pts = path.filter((_, i) => i % 2 === 0), L = pts.length || 1;
    SS = { n: e.towerSlots.length, v: e.towerSlots.map(s => { let sc = 0, mi = 0, c = 0; pts.forEach((p, i) => { if ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 <= 160 * 160) { sc += 1 + (1 - i / L); mi += i / L; c++; } }); return { sc, mid: c ? mi / c : 0.5 }; }) }; return SS; };
  const isUtil = t => t.def && Array.isArray(t.def.tags) && t.def.tags.some(x => x === 'slow' || x === 'freeze' || x === 'stun') && !t.def.mega;
  const emptyIdx = () => { const ids = e.towerSlots.map((s, i) => i).filter(i => !e.towerSlots[i].occupied); if (!ids.length) return -1;
    if (P.place !== 'smart') return ids[0]; const S = slotScore().v; return ids.sort((a, b) => S[b].sc - S[a].sc)[0]; };
  // 재정렬: 보조 타워 상위 N개는 중간(mid 0.3~0.7) 중 점수 높은 자리, 나머지는 DPS 순으로 점수 높은 자리 (위치만 바꿈)
  const rearrange = () => {
    if (P.place !== 'smart') return; const S = slotScore().v, ts = e.towers.filter(t => t._gachaId); if (!ts.length) return;
    const util = ts.filter(isUtil).sort((a, b) => tdps(b) - tdps(a)).slice(0, P.utilSlots), main = ts.filter(t => !util.includes(t)).sort((a, b) => tdps(b) - tdps(a));
    const free = e.towerSlots.map((s, i) => i), take = (pred) => { const c = free.filter(pred).sort((a, b) => S[b].sc - S[a].sc)[0] ?? free.sort((a, b) => S[b].sc - S[a].sc)[0]; free.splice(free.indexOf(c), 1); return c; };
    const plan = []; util.forEach(t => plan.push([t, take(i => S[i].mid > 0.3 && S[i].mid < 0.7)])); main.forEach(t => plan.push([t, take(() => true)]));
    e.towerSlots.forEach(s => { if (s.tower && s.tower._gachaId) { s.tower = null; s.occupied = false; } });
    plan.forEach(([t, i]) => { const s = e.towerSlots[i]; s.tower = t; s.occupied = true; t.x = s.x; t.y = s.y; });
    applyTowerSynergies(e.towers);
  };
  let lastRearrange = -99;
  const typeShare = () => { const c = {}; e.towers.forEach(t => { if (t.def) c[t.def.type] = (c[t.def.type] || 0) + tdps(t); }); return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  const bot = () => {
    const w = e.currentWave, n = e.enemies.length, h = e.heroes[0];
    // --- 선택 창: 카드(주력 타입·등급 점수, 약하면 건너뛰기=골드+적응 없음) / 진화(이브이는 주력 타입) ---
    const cards = [...document.querySelectorAll('.card-overlay .co-card')];
    if (cards.length) {
      const dom = typeShare().slice(0, 2).map(x => KR[x[0]]), tierW = { common: 1, rare: 2, epic: 3, legend: 4 };
      const sc = cards.map(c => (tierW[c.dataset.tier] || 1) + ([...c.querySelectorAll('.co-tags i')].some(i => dom.includes(i.textContent)) ? 2 : 0) + (c.querySelectorAll('.co-tags i').length === 0 ? 1 : 0));
      const bi = sc.indexOf(Math.max(...sc));
      if (sc[bi] >= 2 || !document.querySelector('.card-overlay .skip')) { cards[bi].click(); ST.cardsTaken++; } else { document.querySelector('.card-overlay .skip').click(); ST.cardsSkipped++; }
    }
    const evoCards = [...document.querySelectorAll('.skin-picker .skin-card')];
    if (evoCards.length && h) {
      const dom = typeShare()[0], opts = h.def.evolution?.options || [];
      let k = opts.findIndex(o => dom && EEVEE[o.id] === dom[0]); if (k < 0) k = 0;
      (evoCards[k] || evoCards[0]).click();
    }
    document.querySelectorAll('.merge-reveal,.merge-overlay,.mb-overlay,.skin-picker,.hero-evo,.hero-item-pop').forEach(o => o.remove());
    // --- 영웅: 스킬·거다이맥스·스킬포인트·변신 아이템 (공짜 행동은 항상) ---
    if (h) {
      if (n >= 5) (h.def.skills || []).forEach((_, i) => { if (h.canCast(i)) h.cast(i, e); });
      if (n >= 20 && window.castGmax) castGmax(h, e);
      const tree = window.SkillTrees && SkillTrees[h.id];
      if (tree && h.skillPoints > 0) for (const nd of tree.nodes.slice().sort((a, b) => a.cost - b.cost)) if (h.skillPoints >= nd.cost) h.unlockSkillNode(nd.id, e);
      if (e._heroItemPending) app._playHeroTransform();
    }
    // --- 주문(무료, 쿨타임): 그물망은 필드 위험할 때, 훈련소는 적 많을 때 ---
    if (n >= (P.spells === 'always' ? 5 : 90) && app.spellMgr.cast('netTrap', e)) ST.spells++;
    if (n >= (P.spells === 'always' ? 5 : 35) && app.spellMgr.cast('trainingCamp', e)) ST.spells++;
    if (w - lastRearrange >= P.rearrangeEvery) { rearrange(); lastRearrange = w; }
    // --- 보스 소환: 쿨 될 때마다 열린 최고 티어 (필드는 1마리로 계산, 나중에 잡으면 큰 골드) ---
    if (BOSS !== 'none' && e.state === 'wave' && (e._bossSummonCooldown || 0) <= 0 && n < 160) {
      const open = BOSS_TIERS.filter(t => w >= t.minWave);
      if (open.length) { app._summonBoss(open[BOSS === 'low' ? 0 : open.length - 1].tier); ST.boss.summon++; }
    }
    // --- 위험 대응 아이템: 필드 150+ 대피, 175+ 몬스터볼 ---
    const useItem = (key, need) => { const it = ShopItems.find(i => i.key === key), u = (e._shopWaveUses && e._shopWaveUses[key]) || 0;
      if (n >= need && it && u < it.perWave) { const c = shopItemCost(it, e); if (e.spendGold(c)) { it.buy(e); e._shopWaveUses = e._shopWaveUses || {}; e._shopWaveUses[key] = u + 1; spent('위험아이템', c); ST.items++; } } };
    useItem('evacuate', 150); useItem('monsterball', 175);
    // --- 무료 성장: 먹이기(★) → 메가진화 → 확정 진화 → 레시피 ---
    for (const t of e.towers.slice()) while (MEGA.canFeed(app, t) && MEGA.feedTower(app, t)) ST.feeds++;
    for (const t of e.towers.slice()) if (MEGA.canMega(app, t)) {
      const mid = MEGA_OF[t.def.id].find(m => !e.towers.some(x => x._gachaId === m)); if (!mid) continue;
      const slot = e.towerSlots.find(s => s.tower === t); if (!slot) continue;
      e._megaStones--; const nt = _createGachaTower({ ...GachaTowerDefs[mid], _stack: 1 }, slot.x, slot.y, e);
      e.towers = e.towers.filter(x => x !== t); e.towers.push(nt); slot.tower = nt; applyTowerSynergies(e.towers); ST.megas++;
    }
    if (e._heroItemGot === false && w >= 50 && (e._megaStones || 0) >= 2 && !e.towers.some(t => MEGA_OF[t.def?.id])) { e._megaStones -= 2; app._dropHeroItem('교환'); }
    for (let k = 0; k < 4; k++) { // 같은 종 3마리(보관함) → 확정 진화
      const by = {}; (app._inventory || []).forEach(d => { if (MERGE_EVOLUTION[d.id]) (by[d.id] = by[d.id] || []).push(d); });
      const tri = Object.values(by).find(a => a.length >= 3 && !e.towers.some(t => t.def && t.def.id === a[0].id && FEEDABLE(t))); if (!tri) break;
      const use = app._allMaterials(false).filter(m => m.def.id === tri[0].id).slice(0, 3);
      app._consumeMaterials(use); app._addToStorage([{ ...GachaTowerDefs[getEvolutionId(tri[0].id)], _starLevel: 1 }]); ST.evolves++;
    }
    const slotsFull = emptyIdx() < 0;
    for (const r of RECIPES) { // 레시피는 자리가 모자랄 때만 (레전드 3 → 유니크 1로 자리 확보), 뮤츠는 골드 여유 있을 때
      if (!slotsFull || (r.cost && e.gold < r.cost + 300)) continue;
      if (e.towers.some(t => t._gachaId === r.id) || (app._inventory || []).some(d => d.id === r.id)) continue; // 유니크는 필드 1마리 → 이미 있으면 만들지 않음
      const all = app._allMaterials(true), idx = r.pick(all.map(m => m.def), { miracle: e._miracle }); if (!idx) continue;
      if (r.cost && !e.spendGold(r.cost)) continue; if (r.cost) spent('레시피', r.cost);
      app._consumeMaterials(idx.map(i => all[i])); app._addToStorage([{ ...GachaTowerDefs[r.id], _starLevel: 1 }]); ST.recipes.push(r.id + '@' + w);
    }
    // --- 골드 쓰기: 후보마다 (늘어나는 DPS ÷ 비용) 비교해 가장 좋은 것부터. 위험하지 않으면 이자 300 저축 ---
    const danger = n >= 100, reserve = w >= 4 && !danger ? Math.min(300, 40 + w * 20) : 0;
    for (let k = 0; k < 12; k++) {
      const empty = emptyIdx() >= 0, C = [];
      const tenPhase = w >= P.tenFromWave || !empty; // 사람: 초반엔 빨리 잡으려 일반 뽑기, 여유 생기면 무조건 900 모아 10연
      if (!tenPhase || danger) C.push({ k: 'normal', cost: PULL_COSTS.normal, v: EV('normal') * (empty ? 1 : 0.25) }); // 위험하면 바로 일반 뽑기
      if (tenPhase) C.push({ k: 'ten', cost: PULL_COSTS.ten, v: EV('normal') * 10 * (empty ? 1 : 0.25) });
      if (!tenPhase || danger) C.push({ k: 'premium', cost: PULL_COSTS.premium, v: EV('premium') * (empty ? 1 : 0.35) }); // 10연 단계엔 900 모으려고 안 씀
      if (!empty && w >= 30) C.push({ k: 'gamble', cost: PULL_COSTS.gamble, v: EV('gamble') * 0.5 });
      for (const [ty] of typeShare()) {
        const nu = getTypeUpgradeAt(ty, TypeUpgradeLevels[ty] || 0), tw = e.towers.filter(t => t.def && t.def.type === ty);
        const v = tw.reduce((a, t) => a + tdps(t) * (nu.val || 0) + (TYPE_FLAT_PER_TIER[t.def.grade] || 2) * (nu.flat || 0) * t.fireRate, 0);
        C.push({ k: 'type', ty, cost: nu.cost, v });
      }
      const tmT = e.towers.filter(t => canUseTM(t)).sort((a, b) => tdps(b) - tdps(a))[0];
      if (tmT) C.push({ k: 'tm', t: tmT, cost: TM_COST, v: tdps(tmT) * 0.3 });
      const ep = !(e._oneTimeUsed && e._oneTimeUsed.rarecandy) && e.towers.filter(t => t.def && t.def.grade === 'epic').sort((a, b) => tdps(a) - tdps(b))[0];
      if (ep) { const it = ShopItems.find(i => i.key === 'rarecandy'); C.push({ k: 'candy', t: ep, cost: shopItemCost(it, e), v: Math.max(0, GD.legend - tdps(ep)) }); }
      if (!empty) { const it = ShopItems.find(i => i.key === 'revive'), best = (app._inventory || []).reduce((m, d) => Math.max(m, defDps(d)), 0); C.push({ k: 'plot', cost: shopItemCost(it, e), v: Math.max(EV('normal'), best) * 0.9 }); }
      const ok = C.filter(c => c.cost > 0 && e.gold - c.cost >= reserve && c.v > 0).sort((a, b) => b.v / b.cost - a.v / a.cost);
      const c = ok[0]; if (!c) break;
      if (c.k === 'ten') { if (e.gold < PULL_COSTS.ten) break; const ei = emptyIdx(); e.selectedSlotIdx = ei >= 0 ? ei : null; app.doPull('ten'); e.selectedSlotIdx = null; spent('10연', c.cost); }
      else if (c.k === 'normal' || c.k === 'premium' || c.k === 'gamble') { const ei = emptyIdx(); e.selectedSlotIdx = ei >= 0 ? ei : null; app.doPull(c.k); e.selectedSlotIdx = null; spent(c.k === 'normal' ? '일반뽑기' : c.k === 'premium' ? '프리미엄' : '도박', c.cost); }
      else if (c.k === 'type') { if (!applyTypeUpgrade(c.ty, e)) break; spent('타입강화', c.cost); }
      else if (c.k === 'tm') { if (!e.spendGold(TM_COST)) break; applyTM(c.t); spent('기술머신', c.cost); ST.tm++; }
      else if (c.k === 'candy') { const slot = e.towerSlots.find(s => s.tower === c.t); if (!slot || !e.spendGold(c.cost)) break; if (!useRareCandy(e, slot)) { e.addGold(c.cost); break; } e._oneTimeUsed = e._oneTimeUsed || {}; e._oneTimeUsed.rarecandy = true; spent('이상한사탕', c.cost); ST.candy++; }
      else if (c.k === 'plot') { const it = ShopItems.find(i => i.key === 'revive'); if (!e.spendGold(c.cost)) break; it.buy(e); spent('부지확장', c.cost); }
    }
    // --- 합성: 먹이 재료(필드 성장 대상과 같은 종·등급 / 메가 원본 종)는 '아래에 쌓아' 두고, 나머지는 3개씩 → 상위 등급 (레전드까지) ---
    const keep = d => e.towers.some(t => t.def && FEEDABLE(t) && (t.def.mega ? t.def.megaOf === d.id : (t.def.id === d.id && t.def.grade === d.grade))) || (MEGA_OF[d.id] && e.towers.some(t => t.def && (t.def.id === d.id || t.def.megaOf === d.id)));
    const fieldMin = () => { let lo = null; e.towerSlots.forEach((s, i) => { if (s.tower && s.tower._gachaId && (!lo || tdps(s.tower) < lo.d)) lo = { i, d: tdps(s.tower) }; }); return lo; };
    // --- 배치: 빈 자리(점수 높은 곳), 없으면 필드 최약체보다 센 것과 교체 (빠진 것은 보관함 → 합성 재료) ---
    const place = () => { const inv = (app._inventory || []).slice().sort((a, b) => defDps(b) - defDps(a));
      for (const d of inv) { let idx = emptyIdx();
        if (idx < 0) { const lo = fieldMin(); if (!lo || lo.d >= defDps(d) * 0.95) break;
          const old = e.towerSlots[lo.i].tower.def; app._consumeMaterials([{ kind: 'field', slotIdx: lo.i, def: old }]); app._addToStorage([old]); idx = lo.i; }
        app._placeFromStorage(d.id, idx); } };
    place(); // 빈 자리 먼저 채우고 남는 것만 합성
    for (let k = 0; k < 10; k++) {
      const inv = app._allMaterials(false).filter(m => !keep(m.def)); let done = false;
      for (const g of ['normal', 'rare', 'epic']) {
        const pool = inv.filter(m => m.def.grade === g);
        if (pool.length >= 3 && (emptyIdx() < 0 || g !== 'normal' || pool.length >= 6)) { app._consumeMaterials(pool.slice(0, 3)); app._addToStorage([rollRandomMerge(g, app._mergeState || {})]); done = true; break; }
      }
      if (!done) break;
    }
    place(); // 합성으로 생긴 것 배치
  };
  const FEEDABLE = t => t.def && (t.def.mega || ['epic', 'legend', 'unique'].includes(t.def.grade)) && ((t.def._stack || 1) < 5);
  const DT = 1 / 30; let t = 0, lastBot = 0; const trace = [];
  const t0 = performance.now();
  while (!over && e.currentWave < maxWave && t < 60 * 60 * 8) { // 게임시간 8시간 상한
    if (e.state === 'idle') { trace.push([e.currentWave, Math.round(e.gold), e.towers.length, (app._inventory || []).length, e.enemies.length, document.querySelectorAll('.skin-picker,.card-overlay,.evo-overlay,[class*=overlay]').length]); app.sendWave(); }
    if (t - lastBot >= 0.5) { try { bot(); } catch (err) { console.error('bot', err.message); } lastBot = t; }
    for (let i = 0; i < 15; i++) { e.dt = DT; e._isLastSubstep = i === 14; try { e.update(); } catch (err) { console.error('upd', err.message); } t += DT; if (over) break; }
    if (((t * 30) | 0) % 900 === 0) await new Promise(r => setTimeout(r, 0)); // 가끔 양보 (setTimeout 콜백 처리)
  }
  e.onGameOver = prevGO;
  const ds = e._dmgStats || {}, tot = Object.values(ds).reduce((a, r) => a + r.dmg, 0) || 1;
  const top = Object.entries(ds).sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 3).map(([k, r]) => [k, Math.round(r.dmg / tot * 100)]);
  return { wave: e.currentWave, over, top, towers: e.towers.length, sec: Math.round(t), ms: Math.round(performance.now() - t0), errs: e._errCount || 0, st: ST, maxStar: Math.max(1, ...e.towers.map(t => (t.def && t.def._stack) || 1)), megaOnField: e.towers.filter(t => t.def && t.def.mega).map(t => t.def.id + '★' + (t.def._stack || 1)), stones: e._megaStones || 0, trace, errLog: (e._errLog || []).slice(0, 3) };
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
      const r = await pg.evaluate(RUN_IN_PAGE, { hero, maxWave: MAXW, STRAT: Object.assign(process.env.SIM_BOSS ? { boss: process.env.SIM_BOSS } : {}, JSON.parse(process.env.SIM_STRAT || '{}')) });
      out[hero].push(r); if (process.env.SIM_DEBUG) console.log(JSON.stringify({ trace: r.trace, errLog: r.errLog }));
      const st = r.st, sp = Object.entries(st.spend).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, g]) => k + ' ' + (g >= 1000 ? (g / 1000).toFixed(1) + 'K' : g)).join(' ');
      process.stdout.write(`${hero} #${i + 1}: 웨이브 ${r.wave}${r.over ? '' : '(상한)'} · 상위 ${r.top.map(([k, p]) => k + ' ' + p + '%').join(', ')}\n` +
        `   보스 소환 ${st.boss.summon}·처치 ${st.boss.kill}·골드 ${st.boss.gold} | 메가 ${st.megas}(${r.megaOnField.join(',') || '-'}) 스톤 ${r.stones} | 먹이 ${st.feeds} 최고★${r.maxStar} | 확정진화 ${st.evolves} 레시피 ${st.recipes.join(',') || '-'} | 카드 ${st.cardsTaken}/건너뜀 ${st.cardsSkipped} | 지출 ${sp} | ${Math.round(r.ms / 1000)}초\n`);
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
  const runs = HEROES.flatMap(h => out[h]), avg = f => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
  console.log(`평균: 보스 소환 ${avg(r => r.st.boss.summon)} · 처치 ${avg(r => r.st.boss.kill)} · 보스 골드 ${avg(r => r.st.boss.gold)} | 메가 ${avg(r => r.st.megas)} · 최고★ ${avg(r => r.maxStar)} · 먹이 ${avg(r => r.st.feeds)} | 확정진화 ${avg(r => r.st.evolves)}`);
  const spendTot = {}; runs.forEach(r => Object.entries(r.st.spend).forEach(([k, g]) => spendTot[k] = (spendTot[k] || 0) + g)); const sTot = Object.values(spendTot).reduce((a, b) => a + b, 0) || 1;
  console.log('지출 비중:', Object.entries(spendTot).sort((a, b) => b[1] - a[1]).map(([k, g]) => `${k} ${Math.round(g / sTot * 100)}%`).join(' · '));
  console.log('MVP 빈도:', Object.entries(topCount).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
  if (errs.length) console.log('페이지 오류:', errs.slice(0, 5));
  fs.writeFileSync(path.join(ROOT, 'tools', 'sim-result.json'), JSON.stringify(out, null, 1));
  await b.close(); server.close();
})();
