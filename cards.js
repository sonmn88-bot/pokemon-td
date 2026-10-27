// ===== CARDS.JS - v3.5 강화 카드 (10웨이브마다 3장 중 1장) =====
// 참고: 뱀파이어 서바이버즈(중복=레벨업) · 하데스(계열 가중치·듀오) · 슬레이 더 스파이어(리롤·보스 후 희귀 보장) · 발라트로(특이한 효과)
// 원칙: 등급별 체감 세기 통일 · 지금 쓸모없는 카드는 안 나옴 · 위험 카드 없음
//       카드 1장마다 몬스터 '적응'(체력 +4%)으로 너무 쉬워지는 것 방지
const CARD_TIERS = {
  common:   { name:'일반', color:'#a7adba', w:55 },
  rare:     { name:'희귀', color:'#5b9dff', w:28 },
  epic:     { name:'영웅', color:'#b18cff', w:13 },
  legend:   { name:'전설', color:'#ffc24b', w:3.5 },
  myth:     { name:'신화', color:'#ff5c7a', w:0.5 },
  combo:    { name:'조합', color:'#34d399', w:0 },
};
const TIER_ORDER = ['common','rare','epic','legend','myth'];
const LV_SCALE = [0, 1, 1.8, 2.5, 3.1, 3.6];           // 중복 레벨 → 효과 배율 (갈수록 덜 오름)
const TYPE_KR = { fire:'불꽃', water:'물', grass:'풀', electric:'전기', psychic:'에스퍼', normal:'노말' };
const ADAPT_PER_CARD = 0.04;

const hasType = (e, ty) => e.towers.some(t => t.def && t.def.type === ty);
const hasMega = e => e.towers.some(t => t.def && t.def.mega) || (window.app?._inventory || []).some(d => d.mega);
const hasMegaBase = e => e.towers.some(t => t.def && window.MEGA_OF?.[t.def.id]) || (window.app?._inventory || []).some(d => window.MEGA_OF?.[d.id]);
const hasHero = e => (e.heroes || []).length > 0;

const CARD_DEFS = [];
// ---- 타입별 카드 (6타입 × 5장) ----
for (const ty of Object.keys(TYPE_KR)) {
  const K = TYPE_KR[ty], cond = e => hasType(e, ty);
  CARD_DEFS.push(
    { id:`dmg_${ty}`,   tier:'common', tags:[ty], icon:ty, name:`${K}의 힘`,     desc:lv => `${K} 타워 공격력 +${Math.round(30 * LV_SCALE[lv])}%`, cond },
    { id:`rng_${ty}`,   tier:'common', tags:[ty], icon:ty, name:`${K}의 시야`,   desc:lv => `${K} 타워 사거리 +${Math.round(20 * LV_SCALE[lv])}%`, cond },
    { id:`strike_${ty}`,tier:'rare',   tags:[ty], icon:ty, name:`${K} 강타`,     desc:lv => `${K} 타워 3번째 공격마다 ${(2 + lv * 0.5).toFixed(1)}배 강타`, cond },
    { id:`spd_${ty}`,   tier:'epic',   tags:[ty], icon:ty, name:`${K} 연사`,     desc:lv => `${K} 타워 공격 속도 +${Math.round(35 * LV_SCALE[lv])}%`, cond },
    { id:`ult_${ty}`,   tier:'legend', tags:[ty], icon:ty, name:`${K}의 극의`,   desc:lv => `${K} 타워 공격력 ×${(1 + 0.6 * LV_SCALE[lv]).toFixed(2)}`, cond },
  );
}
// ---- 공용 카드 ----
CARD_DEFS.push(
  { id:'all_dmg',   tier:'common', tags:['all'],    icon:'upgrade', name:'총력전',       desc:lv => `모든 타워 공격력 +${Math.round(10 * LV_SCALE[lv])}%` },
  { id:'interest',  tier:'common', tags:['gold'],   icon:'coin',    name:'저축왕',       desc:lv => `이자 상한 +${15 * lv}` },
  { id:'hero_dmg',  tier:'common', tags:['hero'],   icon:'medal',   name:'트레이너의 응원', desc:lv => `영웅 공격력 +${Math.round(30 * LV_SCALE[lv])}%`, cond:hasHero },
  { id:'status',    tier:'common', tags:['status'], icon:'flask',   name:'지독한 상태이상', desc:lv => `화상·독·감속·스턴 지속 +${Math.round(50 * LV_SCALE[lv])}%` },
  { id:'wave_gold', tier:'rare',   tags:['gold'],   icon:'coin',    name:'승리 수당',     desc:lv => `웨이브 클리어 보너스 +${Math.round(50 * LV_SCALE[lv])}%` },
  { id:'feed2',     tier:'rare',   tags:['mega'],   icon:'build',   name:'포식',         desc:lv => `먹이기 할 때 ${Math.min(60, 20 * lv)}% 확률로 ★ 2단계`, cond:hasMegaBase },
  { id:'ball',      tier:'rare',   tags:['gold'],   icon:'net',     name:'볼 주머니',     desc:lv => `몬스터볼 웨이브당 +${2 * lv}회` },
  { id:'boss_dmg',  tier:'rare',   tags:['boss'],   icon:'monster', name:'보스 사냥꾼',   desc:lv => `보스·엘리트에게 +${Math.round(40 * LV_SCALE[lv])}%` },
  { id:'underdog',  tier:'epic',   tags:['all'],    icon:'capsule', name:'약자의 반란',   desc:lv => `노말·레어 타워 공격력 ×${(1 + 1.5 * LV_SCALE[lv]).toFixed(1)}`,
    cond:e => e.towers.some(t => t.def && (t.def.grade === 'normal' || t.def.grade === 'rare')) },
  { id:'resonance', tier:'epic',   tags:['mega'],   icon:'psychic', name:'메가 공명',     desc:lv => `메가 1마리당 같은 타입 타워 +${Math.round(15 * LV_SCALE[lv])}%`, cond:hasMega },
  { id:'hero_cd',   tier:'epic',   tags:['hero'],   icon:'timer',   name:'숙련된 지휘',   desc:lv => `영웅 스킬 쿨타임 -${Math.round(Math.min(0.6, 0.2 * LV_SCALE[lv]) * 100)}%`, cond:hasHero },
  { id:'all_spd',   tier:'epic',   tags:['all'],    icon:'wave',    name:'전군 돌격',     desc:lv => `모든 타워 공격 속도 +${Math.round(15 * LV_SCALE[lv])}%` },
  { id:'stone',     tier:'legend', tags:['mega'],   icon:'normal',  name:'각성의 돌',     desc:lv => `메가스톤 확률 +${20 * lv}%p`, cond:hasMegaBase, max:2 },
  { id:'clone',     tier:'legend', tags:['all'],    icon:'disc',    name:'분신술',       desc:() => `가장 강한 타워의 분신(공격력 50%)이 빈 자리에 생김`, max:3,
    cond:e => e.towerSlots.some(s => !s.occupied) && e.towers.length > 0 },
  { id:'timestop',  tier:'legend', tags:['boss'],   icon:'timer',   name:'시간 정지',     desc:lv => `보스가 나오면 ${3 + 2 * lv}초 동안 모든 적 정지`, max:3 },
  { id:'master',    tier:'myth',   tags:['all'],    icon:'normal',  name:'포켓몬 마스터', desc:() => `필드에 6타입이 모두 있으면 전체 공격력 ×1.8`, max:1 },
  { id:'infinite',  tier:'myth',   tags:['hero'],   icon:'electric',name:'무한 동력',     desc:() => `영웅 스킬 쿨타임 ½ · 영웅 공격력 ×1.5`, max:1, cond:hasHero },
  { id:'doppel',    tier:'myth',   tags:['all'],    icon:'psychic', name:'도플갱어',     desc:() => `다음 카드 선택 때 3장 모두 획득`, max:1 },
  // ---- 조합 카드: 두 계열 카드를 가지고 있으면 섞여 나옴 ----
  { id:'wildfire',  tier:'combo', tags:['fire','grass'],    icon:'fire',     name:'산불',        desc:() => `불꽃·풀 타워 +25% · 화상/독 걸린 적은 모든 공격에 +30% 피해`, max:1, need:['fire','grass'] },
  { id:'shockwater',tier:'combo', tags:['electric','water'],icon:'electric', name:'감전수',      desc:() => `전기·물 타워 +25% · 감속된 적에게 전기 피해 +50%`, max:1, need:['electric','water'] },
  { id:'psybreak',  tier:'combo', tags:['psychic','boss'],  icon:'psychic',  name:'사이코 브레이크', desc:() => `보스가 잃은 체력 비율만큼 에스퍼 피해 증가 (최대 2배)`, max:1, need:['psychic','boss'] },
  { id:'bond',      tier:'combo', tags:['mega','hero'],     icon:'medal',    name:'유대',        desc:() => `영웅 근처(200) 메가 공격력 +40% · 영웅 공격력 +30%`, max:1, need:['mega','hero'] },
  { id:'jackpot',   tier:'combo', tags:['gold'],            icon:'dice',     name:'잭팟',        desc:() => `도박 뽑기 비용 -30% · 이자 상한 +20`, max:1, need:['gold','gold'] },
);

// ---------- 효과 집계 ----------
function cardMods(e) {
  const c = e._cards || {}, lv = id => c[id] || 0, S = id => LV_SCALE[lv(id)] || 0;
  const m = { typeDmg:{}, typeRng:{}, typeSpd:{}, typeUlt:{}, strike:{} };
  for (const ty of Object.keys(TYPE_KR)) {
    m.typeDmg[ty] = 1 + 0.3 * S(`dmg_${ty}`);
    m.typeRng[ty] = 1 + 0.2 * S(`rng_${ty}`);
    m.typeSpd[ty] = 1 + 0.35 * S(`spd_${ty}`);
    m.typeUlt[ty] = 1 + 0.6 * S(`ult_${ty}`);
    m.strike[ty] = lv(`strike_${ty}`) ? 2 + lv(`strike_${ty}`) * 0.5 : 0;
  }
  if (lv('wildfire')) { m.typeDmg.fire += 0.25; m.typeDmg.grass += 0.25; }
  if (lv('shockwater')) { m.typeDmg.electric += 0.25; m.typeDmg.water += 0.25; }
  m.allDmg = 1 + 0.1 * S('all_dmg');
  m.allSpd = 1 + 0.15 * S('all_spd');
  m.underdog = 1 + 1.5 * S('underdog');
  m.resonance = 0.15 * S('resonance');
  m.heroDmg = (1 + 0.3 * S('hero_dmg')) * (lv('infinite') ? 1.5 : 1) * (lv('bond') ? 1.3 : 1);
  m.heroCd = Math.max(0.3, (1 - Math.min(0.6, 0.2 * S('hero_cd'))) * (lv('infinite') ? 0.5 : 1));
  m.statusDur = 1 + 0.5 * S('status');
  m.interestCap = 15 * lv('interest') + (lv('jackpot') ? 20 : 0);
  m.waveGold = 1 + 0.5 * S('wave_gold');
  m.feed2 = Math.min(0.6, 0.2 * lv('feed2'));
  m.ballExtra = 2 * lv('ball');
  m.bossDmg = 1 + 0.4 * S('boss_dmg');
  m.stoneAdd = 0.2 * lv('stone');
  m.timestop = lv('timestop') ? 3 + 2 * lv('timestop') : 0;
  m.master = !!lv('master'); m.wildfire = !!lv('wildfire'); m.shockwater = !!lv('shockwater');
  m.psybreak = !!lv('psybreak'); m.bond = !!lv('bond'); m.jackpot = !!lv('jackpot');
  return m;
}

// 타워별 상시 배율 (applyTowerSynergies에서 매번 다시 계산)
function applyCardsToTowers(e, towers) {
  const m = e._cardMods; if (!m) return;
  const megaByType = {};
  for (const t of towers) if (t.def?.mega) megaByType[t.def.type] = (megaByType[t.def.type] || 0) + 1;
  const sixTypes = new Set(towers.map(t => t.def?.type)).size >= 6;
  const hero = e.heroes && e.heroes[0];
  for (const t of towers) {
    const d = t.def; if (!d) continue;
    let dmg = m.typeDmg[d.type] * m.typeUlt[d.type] * m.allDmg;
    if (d.grade === 'normal' || d.grade === 'rare') dmg *= m.underdog;
    if (megaByType[d.type]) dmg *= 1 + m.resonance * megaByType[d.type];
    if (m.master && sixTypes) dmg *= 1.8;
    if (m.bond && d.mega && hero && Math.hypot(hero.x - t.x, hero.y - t.y) < 200) dmg *= 1.4;
    t._cardDmg = dmg;
    t._cardRng = m.typeRng[d.type];
    t._cardSpd = m.typeSpd[d.type] * m.allSpd;
    t._cardStrike = m.strike[d.type];
  }
}

// 맞는 순간의 상황별 배율 (적 takeDamage에서 호출)
function cardHitMul(e, en, src) {
  const m = e._cardMods; if (!m || !src || !src._gachaId) return 1;
  let mul = 1;
  if (en.isBoss || en._elite) mul *= m.bossDmg;
  if (m.wildfire && (en.burning > 0 || en.poisoned > 0)) mul *= 1.3;
  if (m.shockwater && src.def?.type === 'electric' && en.slowed > 0) mul *= 1.5;
  if (m.psybreak && en.isBoss && src.def?.type === 'psychic') mul *= 1 + Math.min(1, 1 - en.hp / en.maxHp);
  if (e._dmgStrike) mul *= e._dmgStrike;
  return mul;
}

window.CARDS = { CARD_DEFS, CARD_TIERS, cardMods, applyCardsToTowers, cardHitMul, ADAPT_PER_CARD };

// ================= UI · 흐름 =================
Object.assign(App.prototype, {
  _cardsInit() {
    const e = this.engine;
    e._cards = {}; e._cardCount = 0; e._cardRerolls = 0; e._cardCommonStreak = 0; e._cardDoppel = false;
    e._cardMods = cardMods(e);
    this._refreshCardHud();
  },

  _cardTagCounts() {
    const e = this.engine, cnt = {};
    for (const id in e._cards) { const d = CARD_DEFS.find(c => c.id === id); if (d) for (const t of d.tags) cnt[t] = (cnt[t] || 0) + e._cards[id]; }
    return cnt;
  },

  _rollCards(guaranteeRare) {
    const e = this.engine, w = e.currentWave, owned = e._cards, tagCnt = this._cardTagCounts();
    const fieldTypes = {}; for (const t of e.towers) if (t.def) fieldTypes[t.def.type] = (fieldTypes[t.def.type] || 0) + 1;
    const topType = Object.keys(fieldTypes).sort((a, b) => fieldTypes[b] - fieldTypes[a])[0];
    // 웨이브가 오를수록 높은 등급 확률 상승
    const boost = Math.min(1, w / 100);
    const tierW = { common: 55 - 20 * boost, rare: 28 + 4 * boost, epic: 13 + 6 * boost, legend: 3.5 + 4.5 * boost, myth: 0.5 + 1 * boost };
    const avail = CARD_DEFS.filter(c => {
      const lv = owned[c.id] || 0;
      if (lv >= (c.max || 5)) return false;
      if (c.cond && !c.cond(e)) return false;
      if (c.need) { const nc = c.need.reduce((o, t) => (o[t] = (o[t] || 0) + 1, o), {}); for (const t in nc) if ((tagCnt[t] || 0) < nc[t]) return false; }
      return true;
    });
    const picks = [];
    for (let k = 0; k < 3; k++) {
      // 등급 먼저 → 그 등급에서 계열 가중치로 카드
      const forceRare = (k === 0 && guaranteeRare);
      let tier;
      const combos = avail.filter(c => c.tier === 'combo' && !picks.includes(c));
      if (combos.length && Math.random() < 0.12) tier = 'combo';
      else {
        const tiers = TIER_ORDER.filter(t => !(forceRare && t === 'common'));
        let r = Math.random() * tiers.reduce((a, t) => a + tierW[t], 0);
        tier = tiers[tiers.length - 1];
        for (const t of tiers) { r -= tierW[t]; if (r <= 0) { tier = t; break; } }
      }
      let pool = avail.filter(c => c.tier === tier && !picks.includes(c));
      for (let ti = TIER_ORDER.indexOf(tier); !pool.length && ti >= 0; ti--) pool = avail.filter(c => c.tier === TIER_ORDER[ti] && !picks.includes(c));
      if (!pool.length) pool = avail.filter(c => !picks.includes(c));
      if (!pool.length) break;
      const wts = pool.map(c => {
        let wt = 1;
        for (const t of c.tags) wt *= 1 + 0.5 * (tagCnt[t] || 0);       // 이미 고른 계열이 더 잘 나옴
        if (topType && c.tags.includes(topType)) wt *= 1.25;           // 필드 주력 타입
        if (owned[c.id]) wt *= 1.3;                                     // 레벨업 후보
        return wt;
      });
      let r = Math.random() * wts.reduce((a, b) => a + b, 0), pick = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) { r -= wts[i]; if (r <= 0) { pick = pool[i]; break; } }
      picks.push(pick);
    }
    return picks;
  },

  _offerCards(wave) {
    const e = this.engine;
    const guarantee = wave % 20 === 0 || e._cardCommonStreak >= 3;
    const cards = this._rollCards(guarantee);
    if (!cards.length) return false;
    this._cardOpen = true;
    e.stop();
    this._showCardOverlay(cards);
    return true;
  },

  _showCardOverlay(cards) {
    const e = this.engine;
    document.querySelector('.card-overlay')?.remove();
    const ov = document.createElement('div');
    ov.className = 'card-overlay';
    const rerollCost = e._cardRerolls === 0 ? 0 : Math.round((80 + e.currentWave * 6) * e._cardRerolls);
    const skipGold = 100 + e.currentWave * 5;
    const adapt = Math.round((Math.pow(1 + ADAPT_PER_CARD, e._cardCount) - 1) * 100);
    ov.innerHTML = `<div class="co-head"><span class="co-kicker">웨이브 ${e.currentWave} 보상</span><b>${e._cardDoppel ? '도플갱어 — 3장 모두 획득' : '강화 카드 1장 선택'}</b>
        <small>카드를 고를수록 몬스터 체력이 적응해요 <em>+${adapt}%</em> → <em>+${Math.round((Math.pow(1 + ADAPT_PER_CARD, e._cardCount + 1) - 1) * 100)}%</em></small></div>
      <div class="co-row">${cards.map((c, i) => {
        const T = CARD_TIERS[c.tier], lv = (e._cards[c.id] || 0) + 1;
        return `<button class="co-card" data-i="${i}" data-tier="${c.tier}" style="--tc:${T.color}">
          <span class="co-tier">${T.name}${lv > 1 ? `<i>Lv ${lv}</i>` : ''}</span>
          <span class="co-icon">${ICON(c.icon, 40)}</span>
          <b class="co-name">${c.name}</b>
          <span class="co-desc">${String(c.desc(lv)).replace(/([+\-×]?\d+(?:\.\d+)?(?:%p|%|배|초|회)?)/g, '<em>$1</em>')}</span>
          <span class="co-tags">${c.tags.filter(t => t !== 'all').map(t => `<i>${TYPE_KR[t] || { gold:'경제', hero:'영웅', mega:'메가', status:'상태이상', boss:'보스' }[t] || t}</i>`).join('')}</span>
        </button>`; }).join('')}</div>
      <div class="co-actions">
        <button class="co-btn reroll" ${e.gold < rerollCost ? 'disabled' : ''}>${ICON('refresh', 16)}다시 뽑기 <span class="co-cost">${rerollCost ? ICON('coin', 14) + rerollCost : '무료'}</span></button>
        <button class="co-btn skip">건너뛰기 <span class="co-cost">+${ICON('coin', 14)}${skipGold}</span></button>
      </div>`;
    document.getElementById('game-screen').appendChild(ov);
    const close = () => { ov.remove(); this._cardOpen = false; this.engine.start(); if (this._pendingAutoWave) { this._pendingAutoWave = false; this.sendWave(); } };
    ov.querySelectorAll('.co-card').forEach(b => b.onclick = () => {
      if (e._cardDoppel) { e._cardDoppel = false; cards.forEach(c => this._takeCard(c)); }
      else this._takeCard(cards[Number(b.dataset.i)]);
      close();
    });
    ov.querySelector('.reroll').onclick = () => {
      if (rerollCost && !e.spendGold(rerollCost)) return;
      e._cardRerolls++;
      this._showCardOverlay(this._rollCards(false));
    };
    ov.querySelector('.skip').onclick = () => { e.addGold(skipGold); close(); };
  },

  _takeCard(c) {
    const e = this.engine;
    e._cards[c.id] = (e._cards[c.id] || 0) + 1;
    e._cardCount++;
    e._cardCommonStreak = c.tier === 'common' ? e._cardCommonStreak + 1 : 0;
    e._cardMods = cardMods(e);
    if (c.id === 'doppel') e._cardDoppel = true;
    if (c.id === 'clone') this._cardClone();
    window.applyTowerSynergies && window.applyTowerSynergies(e.towers);
    this.SFX && this.SFX.play(c.tier === 'legend' || c.tier === 'myth' ? 'pull_epic' : 'buy');
    this.showWaveAnnounce(`${c.name}${e._cards[c.id] > 1 ? ' Lv' + e._cards[c.id] : ''}!`, CARD_TIERS[c.tier].color);
    this._refreshCardHud();
  },

  _cardClone() {
    const e = this.engine;
    const best = e.towers.filter(t => !t.def._clone).sort((a, b) => b.damage * b.fireRate - a.damage * a.fireRate)[0];
    const i = e.towerSlots.findIndex(s => !s.occupied);
    if (!best || i < 0) return;
    const d = { ...best.def, id: best.def.id, damage: best.def.damage * 0.5, _clone: true, name: best.def.name + '(분신)' };
    const s = e.towerSlots[i], t = window._createGachaTower(d, s.x, s.y, e);
    t._evolveGlowTimer = 1.2;
    s.occupied = true; s.tower = t; e.towers.push(t);
  },

  _refreshCardHud() {
    const el = document.getElementById('hud-cards');
    if (!el || !this.engine) return;
    const n = this.engine._cardCount || 0;
    el.style.display = n ? '' : 'none';
    el.querySelector('span').textContent = n;
  },

  _openCardList() {
    const e = this.engine; if (!e) return;
    document.querySelector('.card-list')?.remove();
    const ov = document.createElement('div');
    ov.className = 'card-overlay card-list';
    const ids = Object.keys(e._cards || {});
    ov.innerHTML = `<div class="co-head"><b>내 강화 카드 ${e._cardCount}장</b><small>몬스터 적응 체력 +${Math.round((Math.pow(1 + ADAPT_PER_CARD, e._cardCount) - 1) * 100)}% · 탭해서 닫기</small></div>
      <div class="cl-grid">${ids.map(id => { const c = CARD_DEFS.find(x => x.id === id), T = CARD_TIERS[c.tier], lv = e._cards[id];
        return `<div class="cl-item" style="--tc:${T.color}"><span class="cl-ic">${ICON(c.icon, 24)}</span><div><b>${c.name}${lv > 1 ? ' Lv' + lv : ''}</b><small>${c.desc(lv)}</small></div></div>`; }).join('') || '아직 없어요'}</div>`;
    ov.onclick = () => ov.remove();
    document.getElementById('game-screen').appendChild(ov);
  },
});
