// ===== MEGA.JS - v3.2 메가진화 · 각성 스택 · 메가스톤 · 영웅 변신 · 몬스터 편성 · 타입 다양성 =====
// 로드 순서: storage.js 다음 (App.prototype 확장 + GachaTowerDefs 등록)
//
// 흐름 [v3.10]: 원본을 같은 종 먹이로 ★5 → ★5 + 메가스톤 → 메가 ★1 → '★5 원본'을 먹여 메가 ★5까지 (★당 +35%)
// 메가스톤: 20웨이브 보스에서만 확률 드롭 (30% → 20웨이브마다 +10%p, 최대 90%, 100웨이브부터 25% 확률로 2개)

const STACK_BONUS = 0.35;   // ★ 하나당 공격력 +35%
const STACK_MAX = 5;
const MEGA_NEED_STACK = 5; // v3.10: 원본 ★5 + 메가스톤 → 메가 ★1. 메가는 '★5 원본'을 먹이로 먹어 ★5까지 성장

// ---- 공용 헬퍼 ----
function _mgTargets(t, e, n, range) {
  const r2 = (range || t.range) ** 2;
  return e.enemies.filter(en => !en.dead && !en.reachedEnd && ((en.x - t.x) ** 2 + (en.y - t.y) ** 2) <= r2)
    .sort((a, b) => b.distTraveled - a.distTraveled).slice(0, n);
}
function _mgBeam(t, e, tgt, color, life = 0.18) {
  e.projectiles.push(new Projectile(t.x, t.y, tgt, { engine: e, color, size: 5, beam: true, beamLife: life }));
}
function _mgArea(e, x, y, r, dmg, type, fn) {
  for (const en of e.enemies) if (!en.dead && !en.reachedEnd && Math.hypot(en.x - x, en.y - y) <= r) { en.takeDamage(dmg, type); fn && fn(en); }
  if (window.AoeBurst) e.particles.push(new AoeBurst(x, y, r, '#ffffff'));
}
const _isFly = en => en.def?.special === 'flying';

// ---- 메가 13종 (각자 잘 잡는 상대가 다름) ----
// dmgMul/fireRate는 뮤츠(4타겟+크리) 대비 ★3에서 약간 아래, ★5에서 위가 되도록 맞춤
const MEGA_DEFS = [
  { id:'mega_charizard_x', base:'charizard', name:'메가리자몽X', type:'fire', emoji:'🔥', fr:1.0, range:150,
    desc:'근접 폭발 일격 · 방어 절반 무시 · 화상 → 장갑에 강함',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return; _mgBeam(t, e, tgt, '#3fa9ff', 0.22);
      tgt.takeDamage(t.damage * 4.2, 'splash'); tgt.applyStatus('burn', 2.5, t.damage * 0.4);
      _mgArea(e, tgt.x, tgt.y, 55, t.damage * 1.2, 'splash'); } },
  { id:'mega_charizard_y', base:'charizard', name:'메가리자몽Y', type:'fire', emoji:'☀️', fr:0.7, range:190,
    desc:'넓은 화염 기둥 · 범위 화상 → 분열·물량에 강함',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return; _mgBeam(t, e, tgt, '#ff7a1a', 0.25);
      _mgArea(e, tgt.x, tgt.y, 95, t.damage * 1.9, 'fire', en => en.applyStatus('burn', 2, t.damage * 0.3)); } },
  { id:'mega_blastoise', base:'blastoise', name:'메가거북왕', type:'water', emoji:'🌊', fr:0.75, range:220,
    desc:'일직선 관통 물대포 · 넉백 → 줄지어 오는 적에 강함',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return; _mgBeam(t, e, tgt, '#5bb8ff', 0.25);
      const dx = tgt.x - t.x, dy = tgt.y - t.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, reach = t.range * 1.3;
      for (const en of e.enemies) { if (en.dead || en.reachedEnd) continue;
        const px = en.x - t.x, py = en.y - t.y, along = px * ux + py * uy; if (along < 0 || along > reach) continue;
        if (Math.abs(px * uy - py * ux) < 26) { en.takeDamage(t.damage * 2.4, 'special'); if (Math.random() < 0.25) en.distTraveled = Math.max(0, en.distTraveled - 30); } } } },
  { id:'mega_gyarados', base:'gyarados', name:'메가갸라도스', type:'water', emoji:'🐉', fr:1.1, range:170,
    desc:'같은 적을 계속 물수록 공격 속도 상승(최대 2.5배) → 보스에 강함',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return;
      t._rage = (t._rageTgt === tgt) ? Math.min(15, (t._rage || 0) + 1) : 0; t._rageTgt = tgt;
      t._tempSpeedMul = 1 + t._rage * 0.1; _mgBeam(t, e, tgt, '#29b6f6');
      tgt.takeDamage(t.damage * (tgt.isBoss ? 3.6 : 2.6), 'special'); } },
  { id:'mega_venusaur', base:'venusaur', name:'메가이상해꽃', type:'grass', emoji:'🌺', fr:0.7, range:180,
    desc:'독 장판 · 재생 봉쇄 → 재생하는 적에 강함',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return; _mgBeam(t, e, tgt, '#7cd36a', 0.25);
      _mgArea(e, tgt.x, tgt.y, 85, t.damage * 1.7, 'poison', en => { en.applyStatus('poison', 4, t.damage * 0.25); en._noRegen = 5; }); } },
  { id:'mega_pinsir', base:'pinsir', name:'메가쁘사이저', type:'grass', emoji:'🪲', fr:0.9, range:150, dmgMul:1.3,
    desc:'체력 18% 이하 즉사(보스 제외) · 30% 크리 → 체력 많은 적',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return; _mgBeam(t, e, tgt, '#c9a46a');
      const crit = Math.random() < 0.3; tgt.takeDamage(t.damage * (crit ? 7.5 : 3.0), 'special');
      if (!tgt.dead && !tgt.isBoss && tgt.hp / tgt.maxHp <= 0.18) { tgt.hp = 0; tgt.die(); e.spawnFloatingText('처형', tgt.x, tgt.y - 22, '#ff5252'); } } },
  { id:'mega_beedrill', base:'beedrill', name:'메가독침붕', type:'grass', emoji:'🐝', fr:2.2, range:150,
    desc:'초고속 3연침 · 독 중첩 → 단일 고체력',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return;
      for (let i = 0; i < 3; i++) e.projectiles.push(new Projectile(t.x, t.y, tgt, { engine: e, speed: 700, damage: t.damage * 0.55, color: '#e8d24a', size: 3, dmgType: 'special',
        status: { type: 'poison', duration: 3, factor: t.damage * 0.08 } })); } },
  { id:'mega_aerodactyl', base:'aerodactyl', name:'메가프테라', type:'grass', emoji:'🦖', fr:1.0, range:180, dmgMul:1.3,
    desc:'2마리 공격 · 비행 ×2.5 · 넉백 → 비행에 강함',
    fire(t, e) { for (const tgt of _mgTargets(t, e, 2)) { _mgBeam(t, e, tgt, '#b9a3d6');
      tgt.takeDamage(t.damage * 1.9 * (_isFly(tgt) ? 2.5 : 1), 'special'); if (Math.random() < 0.3) tgt.distTraveled = Math.max(0, tgt.distTraveled - 40); } } },
  { id:'mega_kangaskhan', base:'kangaskhan', name:'메가캥카', type:'normal', emoji:'🦘', fr:1.2, range:160,
    desc:'엄마+아기 2연타(2타째 60%) · 2마리 → 무난한 만능',
    fire(t, e) { for (const tgt of _mgTargets(t, e, 2)) { _mgBeam(t, e, tgt, '#d9b38c');
      tgt.takeDamage(t.damage * 1.7, 'special'); if (!tgt.dead) tgt.takeDamage(t.damage * 1.0, 'special'); } } },
  { id:'mega_pidgeot', base:'pidgeot', name:'메가피죤투', type:'normal', emoji:'🦅', fr:1.0, range:300,
    desc:'가장 긴 사거리 · 2마리 · 비행 ×2.5 → 비행에 강함',
    fire(t, e) { for (const tgt of _mgTargets(t, e, 2)) { _mgBeam(t, e, tgt, '#f2e2a0');
      tgt.takeDamage(t.damage * 1.8 * (_isFly(tgt) ? 2.5 : 1), 'special'); } } },
  { id:'mega_alakazam', base:'alakazam', name:'메가후딘', type:'psychic', emoji:'🥄', fr:1.0, range:220,
    desc:'5마리 동시 공격 · 30% 스턴 → 빠른 적에 강함',
    fire(t, e) { for (const tgt of _mgTargets(t, e, 5)) { _mgBeam(t, e, tgt, '#e7c46a');
      tgt.takeDamage(t.damage * 0.95, 'special'); if (Math.random() < 0.3) tgt.applyStatus('stun', 0.5); } } },
  { id:'mega_gengar', base:'gengar', name:'메가팬텀', type:'psychic', emoji:'👻', fr:0.9, range:190, needGrade:'legend', dmgMul:2.3,
    desc:'방어 완전 무시 · 2마리 · 그림자 속박(20% 1초 정지) → 장갑·유령에 강함',
    fire(t, e) { for (const tgt of _mgTargets(t, e, 2)) { _mgBeam(t, e, tgt, '#7a4dd6', 0.22);
      tgt.takeDamage(t.damage * 2.3, 'true'); if (Math.random() < 0.2) tgt.applyStatus('stun', 1.0); } } },
  { id:'awakened_zapdos', base:'zapdos', name:'각성 썬더', type:'electric', emoji:'⚡', fr:0.9, range:210, needGrade:'legend', dmgMul:2.3,
    desc:'8번 연쇄 번개 · 감전 → 물량에 강함',
    fire(t, e) { const [tgt] = _mgTargets(t, e, 1); if (!tgt) return;
      e.projectiles.push(new Projectile(t.x, t.y, tgt, { engine: e, speed: 900, damage: t.damage * 1.6, color: '#ffe066', size: 6, dmgType: 'special',
        chain: 8, chainRange: 170, status: { type: 'stun', duration: 0.3 } })); } },
];

// 등록 (유니크 등급 · 메가 표시). 공격력 = 뮤츠 기본 공격력 기준
(function registerMegas() {
  const mt = GachaTowerDefs.mewtwo;
  const base = mt ? mt.damage : 280;
  window.MEGA_OF = {};
  for (const m of MEGA_DEFS) {
    GachaTowerDefs[m.id] = { id: m.id, name: m.name, emoji: m.emoji, grade: 'unique', type: m.type, pokemonId: m.id,
      damage: Math.round(base * 0.75 * (m.dmgMul || 1)) /* v3.8: 0.62→0.75, 희귀 메가(쁘사이저·프테라) ×1.3 */, fireRate: m.fr, range: m.range, desc: m.desc, fire: m.fire, mega: true, megaOf: m.base, _signature: true };
    window.TowerSpriteImages[m.id] = `assets/towers/${m.id}.png`;
    (window.MEGA_OF[m.base] = window.MEGA_OF[m.base] || []).push(m.id);
  }
  if (mt) mt.desc = '전지전능 4타겟+크리 (필드에 1마리만)'; // 뮤츠 조정(C)은 gacha.js에서 6→4타겟
})();

// ---- 스택(★)·메가 판정 ----
function towerStack(t) { return (t && t.def && t.def._stack) || 1; }
// v3.8 먹이기 확장: 같은 종이 거의 안 모여 메가 표시만 있고 못 먹이던 문제 + 먹이 없는 레전드가 버려지던 문제
//   대상: 에픽·레전드 전부 + 메가. 재료: 같은 종 우선, 없으면 같은 타입의 에픽 이상(유니크·메가 제외)
const FEED_GRADES = { epic: 1, legend: 1 };
function _feedOk(t) { return t && t.def && (t.def.mega || t.def.hidden || FEED_GRADES[t.def.grade]) && towerStack(t) < STACK_MAX; }
function _feedMats(app, t) {
  const sameId = t.def.mega ? t.def.megaOf : t.def.id;
  const inv = app._inventory || [];
  if (t.def.mega) { // 메가 먹이 = ★5 원본 (보관함 우선, 그다음 필드)
    const five = d => d.id === sameId && ((d._stack || 1) >= STACK_MAX);
    const field = app.engine.towers.filter(x => x !== t && x.def && five(x.def)).map(x => ({ __field: x, id: x.def.id }));
    return inv.filter(five).concat(field);
  }
  const same = inv.filter(d => d.id === sameId);
  if (t.def.mega || (window.MEGA_OF || {})[t.def.id] || t.def.grade === 'legend') return same; // 메가 계열·레전드는 무조건 같은 종만
  const alt = inv.filter(d => d.id !== sameId && d.type === t.def.type && d.grade === 'epic' && !d.mega && !(window.MEGA_OF || {})[d.id]); // 일반 에픽만 같은 타입 에픽으로
  return same.concat(alt.sort((x, y) => (x.grade === 'epic' ? 0 : 1) - (y.grade === 'epic' ? 0 : 1))); // 에픽부터 소모
}
function canFeed(app, t) { return _feedOk(t) ? _feedMats(app, t).length : 0; }
function feedTower(app, t) {
  if (!_feedOk(t)) return false;
  const mat = _feedMats(app, t)[0];
  if (!mat) return false;
  if (mat.__field) { // 필드의 ★5 원본을 먹이로
    const slot = app.engine.towerSlots.find(s => s.tower === mat.__field); if (!slot) return false;
    app.engine.towers = app.engine.towers.filter(x => x !== mat.__field); slot.occupied = false; slot.tower = null;
  } else { const i = app._inventory.indexOf(mat); if (i < 0) return false; app._inventory.splice(i, 1); }
  const plus = (app.engine._cardMods && Math.random() < app.engine._cardMods.feed2) ? 2 : 1; // v3.5 카드 '포식'
  t.def = { ...t.def, _stack: Math.min(STACK_MAX, towerStack(t) + plus) };
  return true;
}
function canMega(app, t) {
  return !!(t && t.def && !t.def.mega && window.MEGA_OF[t.def.id] && towerStack(t) >= MEGA_NEED_STACK && (app.engine._megaStones || 0) > 0);
}

// ---- 메가스톤 드롭 ----
function megaStoneChance(wave) { return Math.min(0.9, 0.3 + 0.1 * (Math.floor(wave / 20) - 1)); }

// ---- 몬스터 편성 (판마다 2가지 강조) ----
const RUN_EMPHASIS = [
  { key:'flying',  label:'🦅 비행',  hint:'메가피죤투·메가프테라' },
  { key:'armor',   label:'🛡 장갑',  hint:'메가팬텀·메가리자몽X' },
  { key:'regen',   label:'💚 재생',  hint:'메가이상해꽃' },
  { key:'split',   label:'🔣 분열',  hint:'메가리자몽Y·각성 썬더' },
  { key:'ghost',   label:'👻 유령',  hint:'메가팬텀·메가후딘' },
  { key:'swift',   label:'💨 고속',  hint:'메가후딘' },
  { key:'explode', label:'💥 폭발',  hint:'메가거북왕' },
];

// ---- 영웅 변신 아이템 ----
const HERO_ITEMS = {
  // v3.7: 레벨 진화(웨이브 30쯤) 다음의 '최종 각성' — 웨이브 50부터 드롭, 60에 확정, 메가스톤 2개로 교환 가능
  pikachu: { item:'다이맥스 밴드', icon:'electric', gmax:true, formName:'거다이맥스', desc:'새 스킬: 20초 거대화 (공격력 ×1.5 · 광역)' },
  raichu:  { item:'다이맥스 밴드', icon:'electric', gmax:true, formName:'거다이맥스', desc:'새 스킬: 20초 거대화 (공격력 ×1.5 · 광역)' },
  togepi:  { item:'빛의돌', icon:'sparkle', form:'togekiss', formName:'토게키스', desc:'행복의알 공속 +20% · 메트로놈 2개 동시' },
  togetic: { item:'빛의돌', icon:'sparkle', form:'togekiss', formName:'토게키스', desc:'행복의알 공속 +20% · 메트로놈 2개 동시' },
  eevee:   { item:'빛나는 비늘', icon:'sparkle', shine:true, desc:'공격력 +10%' },
  vaporeon:{ item:'빛나는 비늘', icon:'water', shine:true, desc:'적응: 받는 피해 증가 +15% 추가' },
  jolteon: { item:'빛나는 비늘', icon:'electric', shine:true, desc:'기본공격 연쇄 +2' },
  flareon: { item:'빛나는 비늘', icon:'fire', shine:true, desc:'크리티컬 +15% · 기본공격 광역' },
};

window.MEGA = { STACK_BONUS, STACK_MAX, MEGA_NEED_STACK, towerStack, canFeed, feedTower, feedMats: (app, t) => (_feedOk(t) ? _feedMats(app, t) : []), canMega, megaStoneChance, RUN_EMPHASIS, HERO_ITEMS };

// ================= 게임 연동 (App 확장) =================
Object.assign(App.prototype, {
  _megaRunInit() {
    const e = this.engine;
    e._megaStones = 0;
    e._heroItemGot = false;
    const pick = RUN_EMPHASIS.slice().sort(() => Math.random() - 0.5).slice(0, 2);
    e._runEmphasis = pick.map(p => p.key);
    e._runSeed = (Math.random() * 1e9) >>> 0; window.__wavePlan = {}; // v3.14 웨이브 편성 시드(판마다 다름)
    e._runEmphasisInfo = pick;
    this._refreshMegaHud();
    setTimeout(() => this.showWaveAnnounce(`이번 판 몬스터: ${pick.map(p => p.label.replace(/^\S+\s+/, '')).join(' · ')} 많음<br><span style="font-size:0.65em">추천 메가: ${pick.map(p => p.hint).join(' / ')}</span>`, '#6aa8ff'), 3200);
    // 보스 처치 → 메가스톤 / 웨이브 클리어 → 영웅 아이템
    const origDie = e._onEnemyDie.bind(e);
    e._onEnemyDie = (en) => { origDie(en); if (en._megaDrop) this._rollMegaStone(en); };
  },

  _rollMegaStone(en) {
    const e = this.engine, w = e.currentWave;
    const chance = en._isKing ? 1 : Math.min(0.95, megaStoneChance(w) + (e._cardMods ? e._cardMods.stoneAdd : 0));
    let n = Math.random() < chance ? 1 : 0;
    if (n && w >= 100 && Math.random() < 0.25) n = 2;
    if (w >= 50 && Math.random() < 0.35) this._dropHeroItem('보스'); // v3.7: 최종 각성은 웨이브 50부터
    if (!n) { e.spawnFloatingText(`메가스톤 안 나옴 (${Math.round(chance * 100)}%)`, en.x, en.y - 30, '#9aa3b2'); return; }
    e._megaStones = (e._megaStones || 0) + n;
    this.SFX && this.SFX.play('pull_epic');
    this.showWaveAnnounce(`메가스톤 ${n}개 획득! (보유 ${e._megaStones})`, '#b18cff');
    this._refreshMegaHud();
  },

  _megaWaveClear(wave) {
    if (wave === 50) this.buildHeroSkillBar && this.buildHeroSkillBar(); // 메가스톤 교환 버튼 노출
    if (wave >= 60) this._dropHeroItem('천장'); // v3.7: 60까지 못 얻었으면 확정
    else if (wave >= 50 && Math.random() < 0.05) this._dropHeroItem('웨이브');
  },

  _dropHeroItem(from) {
    const e = this.engine, h = e.heroes && e.heroes[0];
    if (!h || e._heroItemGot || !h.evolved) return; // 레벨 진화 먼저
    const info = HERO_ITEMS[h.evolved || h.id] || HERO_ITEMS[h.id];
    if (!info) return;
    e._heroItemGot = true;
    e._heroItemPending = info;                    // 바로 적용하지 않고, 플레이어가 눌러서 변신
    this.SFX && this.SFX.play('pull_epic');
    this._flashScreenEdge && this._flashScreenEdge();
    const pop = document.createElement('div');
    pop.className = 'hero-item-pop';
    pop.innerHTML = `<div class="hip-icon">${ICON(info.icon, 40)}</div><b>${info.item} 획득!</b><small>${info.desc}<br>영웅 바의 반짝이는 버튼을 눌러 최종 각성하세요</small>`;
    document.getElementById('game-screen').appendChild(pop);
    setTimeout(() => pop.remove(), 4200);
    this.buildHeroSkillBar && this.buildHeroSkillBar();
  },

  // 변신 연출: 화면 가득 빛 → 영웅이 커지며 하얗게 → 새 모습 등장. 영웅마다 색이 다름
  _playHeroTransform() {
    const e = this.engine, h = e.heroes && e.heroes[0], info = e._heroItemPending;
    if (!h || !info) return;
    e._heroItemPending = null;
    const theme = { pikachu:['#ffe14a','#fff6b0','✦'], raichu:['#ffb02e','#ffe9a0','✦'], togepi:['#ff9ed8','#c9f2ff','✦'], togetic:['#ff9ed8','#c9f2ff','✦'] }[h.evolved || h.id] || ['#ffc24b','#fff3c4','✦'];
    const before = `assets/heroes/${h.evolved || h.id}.png`, after = info.form ? `assets/heroes/${info.form}.png` : info.gmax ? 'assets/heroes/gmax_pikachu.png' : before;
    const ov = document.createElement('div');
    ov.className = 'hero-evo';
    ov.style.setProperty('--c1', theme[0]); ov.style.setProperty('--c2', theme[1]);
    ov.innerHTML = `<div class="he-rays"></div><div class="he-ring"></div><img class="he-img" src="${before}" alt=""><div class="he-flash"></div>
      <div class="he-sparks">${Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--d:${(i % 3) * 0.15}s">${theme[2]}</i>`).join('')}</div>
      <div class="he-title">${info.gmax ? '거다이맥스 해금' : (info.formName || h.name) + ' 최종 각성'}!</div><div class="he-sub">${info.desc}</div>`;
    document.getElementById('game-screen').appendChild(ov);
    this.SFX && this.SFX.play('pull_epic');
    const img = ov.querySelector('.he-img');
    setTimeout(() => { img.src = after; if (info.shine) img.classList.add('shine'); ov.classList.add('done'); this.SFX && this.SFX.play('merge'); }, 1500);
    setTimeout(() => {
      h._transformed = info; h._awaken = true; h._formMul = 1.1;
      if (info.form) { h._formImg = window.loadSpriteImage ? window.loadSpriteImage(after) : null; h._formName = info.formName; }
      e.triggerScreenShake && e.triggerScreenShake(9, 0.4);
      if (window.AoeBurst) for (let k = 0; k < 3; k++) e.particles.push(new AoeBurst(h.x, h.y, 60 + k * 40, theme[0]));
      this.buildHeroSkillBar && this.buildHeroSkillBar();
    }, 1600);
    setTimeout(() => ov.classList.add('out'), 2900);
    setTimeout(() => ov.remove(), 3400);
    ov.addEventListener('click', () => { if (ov.classList.contains('done')) ov.classList.add('out'); });
  },

  _onDiversityChange(types, mul) {
    const el = document.getElementById('hud-div');
    if (!el) return;
    el.style.display = types >= 2 ? '' : 'none';
    el.querySelector('span').textContent = `${types}종${mul > 1 ? ' +' + Math.round((mul - 1) * 100) + '%' : ''}`;
    el.style.color = mul > 1 ? '#34d399' : '';
    if (this._lastDivMul && mul > this._lastDivMul) this.showWaveAnnounce(`타입 ${types}종! 전체 공격력 +${Math.round((mul - 1) * 100)}%`, '#34d399');
    this._lastDivMul = mul;
  },

  _refreshMegaHud() {
    const el = document.getElementById('hud-stones');
    if (!el || !this.engine) return;
    const n = this.engine._megaStones || 0;
    el.style.display = n > 0 ? '' : 'none';
    const v = el.querySelector('span'); if (v) v.textContent = n;
    if ((this.engine.currentWave || 0) >= 50) this.buildHeroSkillBar && this.buildHeroSkillBar();
  },

  // 타워 패널에 붙일 버튼 HTML + 이벤트
  _megaPanelHtml(t) {
    if (!t || !t.def) return '';
    const st = towerStack(t), feedN = canFeed(this, t);
    const isBase = !!window.MEGA_OF[t.def.id];
    if (!isBase && !t.def.mega && !t.def.hidden && !FEED_GRADES[t.def.grade]) return '';
    let h = `<div class="mg-stack">${'★'.repeat(st)}${'☆'.repeat(STACK_MAX - st)} <small>각성 ★${st} · 공격력 +${Math.round((st - 1) * (t.def.hidden ? 0.8 : STACK_BONUS) * 100)}%${t.def.hidden ? ' (히든 ★당 +80%)' : ''}</small></div>`;
    const megaLine = isBase || t.def.mega || t.def.grade === 'legend' || t.def.hidden, feedName = t.def.mega ? (GachaTowerDefs[t.def.megaOf] || {}).name : t.def.name;
    if (st < STACK_MAX) h += `<button class="tp-btn ${feedN ? 'tp-upgrade' : ''}" data-action="feed" style="grid-column:1 / -1" ${feedN ? '' : 'disabled'}>먹이기 · ${t.def.mega ? `★5 ${feedName}` : t.def.hidden || megaLine ? `보관함의 ${feedName}` : '같은 종이나 같은 타입 에픽'} ${feedN}마리</button>`;
    if (t.def.mega && !feedN && st < STACK_MAX) h += `<div class="mg-hint">${feedName}을(를) 한 마리 더 ★5로 키우면 메가의 먹이가 돼요 (필드·보관함 모두 가능)</div>`;
    else if (megaLine && !feedN && st < STACK_MAX) h += `<div class="mg-hint">${feedName}을(를) 뽑거나 합성하면 보관함에 쌓여요 (이 타워가 필드에 있으면 같은 등급 결과의 25%가 ${feedName})</div>`;
    if (isBase) {
      const stones = this.engine._megaStones || 0;
      for (const mid of window.MEGA_OF[t.def.id]) {
        const md = GachaTowerDefs[mid], ok = canMega(this, t);
        h += `<button class="tp-btn mega-btn" data-action="mega" data-mega="${mid}" ${ok ? '' : 'disabled'} title="${md.desc}">${md.name}${ok ? '' : st < MEGA_NEED_STACK ? ` (★${MEGA_NEED_STACK} 필요)` : ` (스톤 ${stones})`}</button>`;
      }
    }
    return h;
  },
  _bindMegaPanel(panel, t, slotIdx) {
    panel.querySelector('[data-action="feed"]')?.addEventListener('click', () => {
      if (!feedTower(this, t)) return;
      this.engine.spawnFloatingText(`★${towerStack(t)} 각성!`, t.x, t.y - 36, '#ffc24b');
      this.SFX && this.SFX.play('merge');
      this.renderStorageStrip && this.renderStorageStrip();
      this.syncTowerPanel();
    });
    panel.querySelectorAll('[data-action="mega"]').forEach(b => b.addEventListener('click', () => {
      if (!canMega(this, t)) return;
      const mid = b.dataset.mega;
      if (this.engine.towers.some(x => x._gachaId === mid)) { this.showWaveAnnounce('같은 메가는 필드에 1마리만', '#ff5c7a'); return; }
      this.engine._megaStones--;
      const slot = this.engine.towerSlots[slotIdx];
      const nd = { ...GachaTowerDefs[mid], _stack: 1, _tmTag: t.def._tmTag }; // 메가는 ★1부터 다시 성장
      const nt = window._createGachaTower(nd, slot.x, slot.y, this.engine);
      nt._evolveGlowTimer = 1.2; // (2로 넣었던 게 화면 깨짐 원인 - 반지름이 음수가 됐음)
      this.engine.towers = this.engine.towers.filter(x => x !== t); this.engine.towers.push(nt);
      slot.tower = nt; this.engine.selectedTower = nt;
      window.applyTowerSynergies && window.applyTowerSynergies(this.engine.towers);
      this._refreshMegaHud();
      this._trackNewTower && this._trackNewTower(nd);
      this._playMergeReveal ? this._playMergeReveal(nd, { recipe: true }, () => this.syncTowerPanel()) : this.syncTowerPanel();
      this.engine.triggerScreenShake && this.engine.triggerScreenShake(8, 0.35);
    }));
  },
});
