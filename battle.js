// ===== BATTLE.JS - v5 포켓몬 배틀: 3:3 동시 출전 실시간 ATB 난전 (2인 대전 안의 모드) =====
// 규칙: 151마리 능력치 총합 동일(모양만 다름). 6마리가 동시에 필드에, 각자 스피드만큼 행동 게이지가 참.
//   기본기(게이지 50) · 주력기(100) · 특수기(70). 기술 아이콘을 상대(또는 아군)에게 끌어다 놓아 사용 (탭→탭도 가능).
//   전열(1번)이 살아 있으면 후열을 노린 단일 공격은 ×0.7(엄호). 빠를수록 자주 치지만 한 방은 약함(속도 보정).
//   밀어내기(상대 게이지 감소)·끊기(곧 행동할 상대를 되돌림)·도발(단일 공격을 나에게)로 타이밍 싸움.
// 연습: CPU 쉬움·보통·어려움, 기술을 고르는 동안 시간 0.25배. 온라인: 방장(p1) 기준 진행, 상대 입력은 방 문서로 전달,
//   방장이 '몇 번째 틱에 적용'을 기록하면 양쪽이 같은 결정적 계산을 함 (늦게 받은 쪽은 되감아 다시 계산 = 롤백)
// 3D 경기장은 arena3d.js (필요할 때만 불러옴)
(function () {
  'use strict';
  const TPS = 20, GK = 0.42, LIMIT = 180 * TPS, BUSY = 12, HB_MS = 5000, ITEM_CD = 8 * TPS;
  const PROF = { H: { hp: 1.15, atk: 1.08, def: 1.1, spd: 0.86 }, N: { hp: 1, atk: 1, def: 1, spd: 1 }, F: { hp: 0.92, atk: 1.16, def: 0.9, spd: 1.3 } };
  const ROLE = { dealer: { atk: 1.12 }, aoe: {}, control: { def: 1.05, atk: 0.94 }, support: { hp: 1.12, def: 1.08, atk: 0.86 }, execute: { atk: 1.06, spd: 1.05 }, boss: { atk: 1.1, hp: 1.08 } };
  const TKR = { fire: '불꽃', water: '물', electric: '전기', grass: '풀', psychic: '에스퍼', normal: '노말' };
  const TCOL = { fire: 0xff6b3d, water: 0x3fa9ff, electric: 0xffd84a, grass: 0x58d06b, psychic: 0xc77dff, normal: 0xe8e8f0 };
  const ST_KR = { burn: '화상', poison: '독', shock: '감전', freeze: '빙결' };
  const STAT_KR = { atk: '공격', def: '방어', spd: '스피드' };
  // 트레이너 패시브 (CPU끼리 대량 대결로 승률 맞춤 — PokeBattle._engine으로 다시 확인)
  const TP = { redCrit: 0.18, blueFirst: 1.55, greenRegen: 0.003, yellowItems: 2, yellowDot: 0.5, rocketFx: 1.5, rocketSlow: 0.95 };
  const TRAINERS = {
    red:    { name: '레드',   color: '#e5484d', style: '공격형', desc: `모든 기술의 급소율 +${Math.round(TP.redCrit * 100)}%p` },
    blue:   { name: '블루',   color: '#3b82f6', style: '전략형', desc: `포켓몬마다 첫 공격 위력 +${Math.round((TP.blueFirst - 1) * 100)}%` },
    green:  { name: '그린',   color: '#22a06b', style: '회복형', desc: `아군 전체가 초당 체력 ${+(TP.greenRegen * 100).toFixed(1)}% 회복` },
    yellow: { name: '옐로우', color: '#f5b400', style: '교감형', desc: `회복약 ${TP.yellowItems}개, 화상·독 피해 절반` },
    rocket: { name: '로켓단', color: '#a1264f', style: '방해형', desc: `상태이상 확률 ×${TP.rocketFx}, 상대 게이지 속도 -${Math.round((1 - TP.rocketSlow) * 100)}%` },
  };
  const TR_IDS = Object.keys(TRAINERS);
  const BASIC = { fire: ['불씨 돌진', '작열 강타'], water: ['물보라 쏘기', '해일 포격'], electric: ['찌릿 펀치', '낙뢰 강타'], grass: ['잎날 베기', '거목 내려치기'], psychic: ['염동 파동', '정신 붕괴파'], normal: ['박치기 돌격', '전력 돌격'] };
  // 주력기(게이지 100): 태그가 있으면 태그 기술, 없으면 타입 강타
  const TAGMOVE = {
    burn: { name: '불티 폭풍', power: 82, fx: { st: 'burn', ch: 0.45 } },
    poison: { name: '독가루 바람', power: 78, fx: { st: 'poison', ch: 0.55 } },
    slow: { name: '끈끈한 덫', power: 102, fx: { slow: 9 } },
    stun: { name: '전류 스파크', power: 82, fx: { st: 'shock', ch: 0.4 } },
    freeze: { name: '냉기 일섬', power: 104, fx: { st: 'freeze', ch: 0.6 } },
    chain: { name: '연속 타격', power: 24, fx: { hits: [2, 4] } },
    multi: { name: '흩뿌리기 사격', power: 50, tgt: 'foes', fx: {} },
    knockback: { name: '날려버리기', power: 78, fx: { push: 40 } },
    crit: { name: '급소 노리기', power: 88, fx: { crit: 0.35 } },
    pierce: { name: '관통 일격', power: 86, fx: { pierce: true } },
    antiAir: { name: '대공 사격', power: 90, fx: { vsFast: 1.6 } },
    gold: { name: '럭키 펀치', power: 62, fx: { crit: 0.1 } },
    blast: { name: '자폭 돌진', power: 96, fx: { recoil: 0.28 } },
    stack: { name: '기 모으기 타격', power: 92, fx: { stack: 42 } },
    range: { name: '끊어치기', power: 70, fx: { push: 25, cut: true } },
  };
  const BASIC_POW = 40, MAIN_POW = 95, SP_COST = 70, DMG_K = 0.22, SPD_EXP = 0.3; // DMG_K: 판 길이(약 1분) / SPD_EXP: 빠를수록 한 방 약하게

  // ---------- 데이터 ----------
  const roster = () => Object.values(window.GachaTowerDefs || {}).filter(d => d.no >= 1 && d.no <= 151).sort((a, b) => a.no - b.no);
  const vary = (no, k) => 1 + (((no * k) % 13) - 6) / 100;
  const BASE = { hp: 150, atk: 62, def: 60, spd: 60 };
  function statsOf(d) { // 모든 포켓몬 능력치 총합 동일. 모양만 다름
    const P = PROF[d.profile] || PROF.N, R = ROLE[d.role] || {};
    const f = { hp: P.hp * (R.hp || 1) * vary(d.no, 7), atk: P.atk * (R.atk || 1) * vary(d.no, 11), def: P.def * (R.def || 1) * vary(d.no, 5), spd: P.spd * (R.spd || 1) * vary(d.no, 3) };
    const avg = (f.hp + f.atk + f.def + f.spd) / 4, o = {}; for (const k in BASE) o[k] = Math.round(BASE[k] * f[k] / avg); return o;
  }
  const shapeOf = d => ({ H: '탱커형', N: '균형형', F: '속공형' }[d.profile] || '균형형');
  const cycleSec = s => +(100 / (s.spd * GK)).toFixed(1);
  function specialOf(d) { // 특수기(게이지 70): 역할·체형별
    if (d.role === 'support') return { name: '응급 처치', kind: 'heal', tgt: 'ally', fx: { heal: 0.32 } };
    if (d.profile === 'H') return { name: '도발', kind: 'buff', tgt: 'self', fx: { taunt: 4, stage: ['def', 1] } };
    if (d.role === 'dealer') return { name: '필살 일격', power: 72, tgt: 'foe', fx: { crit: 0.45 } };
    if (d.role === 'aoe') return { name: '휩쓸기', power: 14, tgt: 'foes', fx: { debuff: ['def', -1] } };
    if (d.role === 'control') return { name: '발묶기', kind: 'debuff', tgt: 'foe', fx: { slow: 8, push: 38 } };
    if (d.role === 'execute') return { name: '마무리 일격', power: 62, tgt: 'foe', fx: { finisher: 0.4 } };
    if (d.role === 'boss') return { name: '끝장 추격', power: 92, tgt: 'foe', fx: { pierce: true } };
    return { name: '방어 태세', kind: 'buff', tgt: 'self', fx: { stage: ['def', 2] } };
  }
  function movesOf(d) {
    const t = d.type, [b1, b2] = BASIC[t] || BASIC.normal, tag = (d.tags || []).find(x => TAGMOVE[x]);
    const mk = (o, slot, cost) => Object.assign({ type: t, kind: 'atk', tgt: 'foe', acc: 100, fx: {}, slot, cost }, o);
    return [mk({ name: b1, power: BASIC_POW }, 'basic', 50), mk(tag ? TAGMOVE[tag] : { name: b2, power: MAIN_POW, acc: 92 }, 'main', 100), mk(specialOf(d), 'special', SP_COST)];
  }

  // ---------- 규칙 엔진 (결정적: 같은 시드·같은 입력 틱 → 같은 결과) ----------
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const stageMul = s => (s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s));
  const eff = (a, b) => (window.typeEffectiveness ? typeEffectiveness(a, b) : 1);
  const foeOf = s => (s === 'p1' ? 'p2' : 'p1');
  function mkUnit(id, i, R) {
    const d = GachaTowerDefs[id], s = statsOf(d);
    return { id, name: d.name, type: d.type, s, maxHp: s.hp, hp: s.hp, g: 10 + Math.floor(R() * 20), row: i === 0 ? 0 : 1, i, st: null, stT: 0, slowT: 0, tauntT: 0, busy: 0,
      stg: { atk: 0, def: 0, spd: 0 }, moves: movesOf(d), first: true, stack: 0 };
  }
  function newState(p1, p2, seed) {
    const R = rngOf(seed ^ 0xabc);
    const side = p => ({ name: p.name || '트레이너', trainer: TRAINERS[p.trainer] ? p.trainer : 'red', items: p.trainer === 'yellow' ? TP.yellowItems : 1, itemCd: 0, units: (p.team || []).map((id, i) => mkUnit(id, i, R)) });
    return { t: 0, seed, side: { p1: side(p1), p2: side(p2) }, winner: null, why: '' };
  }
  const alive = sd => sd.units.filter(u => u.hp > 0);
  const rate = (st, s, u) => u.s.spd * stageMul(u.stg.spd) * GK / TPS * (u.st === 'shock' ? 0.5 : 1) * (u.slowT > 0 ? 0.6 : 1) * (u.st === 'freeze' ? 0 : 1) * (st.side[foeOf(s)].trainer === 'rocket' ? TP.rocketSlow : 1);
  const canUse = (u, m) => u.hp > 0 && u.busy <= 0 && u.st !== 'freeze' && u.g >= m.cost;
  function validTargets(st, s, m) {
    if (m.tgt === 'ally') return st.side[s].units.filter(u => u.hp > 0).map(u => ({ s, i: u.i }));
    if (m.tgt === 'foe') return st.side[foeOf(s)].units.filter(u => u.hp > 0).map(u => ({ s: foeOf(s), i: u.i }));
    return [];
  }
  function tick(st, ev) { // 한 틱: 게이지·상태이상·시간제한
    st.t++;
    for (const s of ['p1', 'p2']) {
      const sd = st.side[s]; if (sd.itemCd > 0) sd.itemCd--;
      for (const u of sd.units) {
        if (u.hp <= 0) continue;
        if (u.busy > 0) u.busy--; else u.g = Math.min(100, u.g + rate(st, s, u));
        if (u.slowT > 0) u.slowT--; if (u.tauntT > 0) u.tauntT--;
        if (u.st && --u.stT <= 0) { ev.push({ k: 'cure', s, i: u.i, st: u.st }); u.st = null; }
        if (st.t % TPS === 0) {
          if (u.st === 'burn' || u.st === 'poison') { const d = Math.max(1, Math.round(u.maxHp * (u.st === 'burn' ? 0.02 : 0.03) * (sd.trainer === 'yellow' ? TP.yellowDot : 1))); u.hp = Math.max(0, u.hp - d); ev.push({ k: 'dot', s, i: u.i, amt: d, st: u.st }); if (u.hp <= 0) ev.push({ k: 'faint', s, i: u.i }); }
          if (u.hp > 0 && sd.trainer === 'green' && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + Math.max(1, Math.round(u.maxHp * TP.greenRegen)));
        }
      }
    }
    checkEnd(st);
  }
  function checkEnd(st) {
    if (st.winner) return;
    const a = alive(st.side.p1).length, b = alive(st.side.p2).length;
    if (!a || !b) { st.winner = !a && !b ? 'draw' : !a ? 'p2' : 'p1'; return; }
    if (st.t >= LIMIT) { const pct = s => st.side[s].units.reduce((x, u) => x + u.hp / u.maxHp, 0); const d = pct('p1') - pct('p2'); st.winner = Math.abs(d) < 0.01 ? 'draw' : d > 0 ? 'p1' : 'p2'; st.why = '시간 종료 — 남은 체력 비교'; }
  }
  // 행동: a = { s, i, m: 0|1|2|'item', ts, ti }. 잘못된 입력은 무시
  function apply(st, a, ev) {
    if (st.winner || !a || !st.side[a.s]) return false;
    const s = a.s, f = foeOf(s), sd = st.side[s], R = rngOf((st.seed + Math.imul(st.t + 1, 2654435761) + (s === 'p1' ? 17 : 91) + (a.i | 0) * 7) >>> 0);
    if (a.m === 'item') {
      const u = sd.units[a.ti]; if (!u || u.hp <= 0 || sd.items <= 0 || sd.itemCd > 0) return false;
      sd.items--; sd.itemCd = ITEM_CD; u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.4)); const had = u.st; u.st = null;
      ev.push({ k: 'item', s, i: u.i, hp: u.hp, cured: had }); return true;
    }
    const me = sd.units[a.i]; if (!me) return false; const m = me.moves[a.m]; if (!m || !canUse(me, m)) return false;
    let tgts = [];
    if (m.tgt === 'self') tgts = [me];
    else if (m.tgt === 'foes') tgts = alive(st.side[f]);
    else if (m.tgt === 'ally') { const t = sd.units[a.ti]; if (!t || t.hp <= 0) return false; tgts = [t]; }
    else { let t = st.side[f].units[a.ti]; if (!t || t.hp <= 0) t = alive(st.side[f])[0];
      const taunter = alive(st.side[f]).find(x => x.tauntT > 0); if (taunter && taunter !== t) { t = taunter; ev.push({ k: 'msg', text: `${t.name}의 도발! 공격이 끌려간다` }); }
      tgts = [t]; }
    me.g -= m.cost; me.busy = BUSY;
    ev.push({ k: 'act', s, i: me.i, move: m.name, mtype: m.type, kind: m.kind, slot: m.slot, fx: Object.keys(m.fx || {}), fxst: (m.fx || {}).st, foes: m.tgt === 'foes', tgts: tgts.map(t => ({ s: sd.units.includes(t) ? s : f, i: t.i })) });
    const fx = m.fx || {};
    function stage(u, side, k, d) { const b = u.stg[k]; u.stg[k] = Math.max(-3, Math.min(3, b + d)); ev.push({ k: 'stage', s: side, i: u.i, stat: k, d: u.stg[k] - b }); }
    function hitFx(t, side) {
      if (fx.st && !t.st && R() < fx.ch * (sd.trainer === 'rocket' ? TP.rocketFx : 1) && !((fx.st === 'burn' || fx.st === 'freeze') && t.type === 'fire') && !(fx.st === 'shock' && t.type === 'electric')) {
        t.st = fx.st; t.stT = (fx.st === 'freeze' ? 3 : fx.st === 'shock' ? 5 : 8) * TPS; ev.push({ k: 'status', s: side, i: t.i, st: fx.st }); }
      if (fx.slow) { t.slowT = fx.slow * TPS; ev.push({ k: 'slow', s: side, i: t.i }); }
      if (fx.push) { const cut = fx.cut && t.g >= 85; t.g = Math.max(0, t.g - (cut ? 45 : fx.push)); ev.push({ k: 'push', s: side, i: t.i, cut }); }
      if (fx.debuff) stage(t, side, fx.debuff[0], fx.debuff[1]);
    }
    if (m.kind === 'heal') { for (const t of tgts) { t.hp = Math.min(t.maxHp, t.hp + Math.round(t.maxHp * fx.heal)); if (t.st === 'burn' || t.st === 'poison') t.st = null; ev.push({ k: 'heal', s, i: t.i, hp: t.hp }); } }
    else if (m.kind === 'buff') { if (fx.taunt) { me.tauntT = fx.taunt * TPS; ev.push({ k: 'taunt', s, i: me.i }); } if (fx.stage) stage(me, s, fx.stage[0], fx.stage[1]); }
    else if (m.kind === 'debuff') { for (const t of tgts) hitFx(t, f); }
    else {
      const tr = sd.trainer;
      for (const t of tgts) {
        if (t.hp <= 0) continue;
        if (m.acc < 100 && R() * 100 >= m.acc) { ev.push({ k: 'miss', s: f, i: t.i }); continue; }
        const hits = fx.hits ? fx.hits[0] + Math.floor(R() * (fx.hits[1] - fx.hits[0] + 1)) : 1;
        for (let h = 0; h < hits && t.hp > 0; h++) {
          let p = m.power + (fx.stack ? me.stack * fx.stack : 0);
          if (fx.finisher && t.hp / t.maxHp < fx.finisher) p *= 2;
          if (fx.vsFast && t.s.spd > me.s.spd) p *= fx.vsFast;
          const atk = me.s.atk * stageMul(me.stg.atk) * (me.st === 'burn' ? 0.8 : 1), def = t.s.def * (fx.pierce ? 0.75 : stageMul(t.stg.def));
          const e = eff(m.type, t.type), stab = m.type === me.type ? 1.2 : 1;
          const cover = t.row === 1 && m.tgt === 'foe' && st.side[f].units[0].hp > 0 ? 0.7 : 1;  // 전열 엄호
          const spdComp = Math.pow(60 / me.s.spd, SPD_EXP);                                    // 빠르면 한 방이 약함
          const crit = R() < (fx.crit || 0.0625) + (tr === 'red' ? TP.redCrit : 0);
          let dmg = p * (atk / def) * DMG_K * stab * e * cover * spdComp * (crit ? 1.5 : 1) * (tr === 'blue' && me.first ? TP.blueFirst : 1) * (0.9 + R() * 0.1);
          dmg = Math.max(1, Math.round(dmg)); t.hp = Math.max(0, t.hp - dmg);
          ev.push({ k: 'dmg', s: f, i: t.i, amt: dmg, eff: e, crit, cover: cover < 1, hp: t.hp });
          if (t.hp <= 0) ev.push({ k: 'faint', s: f, i: t.i });
        }
        if (hits > 1) ev.push({ k: 'msg', text: `${hits}번 맞혔다!` });
        if (t.hp > 0) hitFx(t, f);
      }
      if (fx.stack) me.stack = Math.min(3, me.stack + 1);
      if (fx.recoil) { const r = Math.round(me.maxHp * fx.recoil); me.hp = Math.max(0, me.hp - r); ev.push({ k: 'dot', s, i: me.i, amt: r, st: 'recoil' }); if (me.hp <= 0) ev.push({ k: 'faint', s, i: me.i }); }
      me.first = false;
    }
    checkEnd(st); return true;
  }

  // ---------- CPU (lv 0 쉬움 / 1 보통 / 2 어려움) ----------
  function expDmg(st, s, me, t, m) {
    if (!m.power) return 0; const f = foeOf(s);
    const cover = t.row === 1 && m.tgt === 'foe' && st.side[f].units[0].hp > 0 ? 0.7 : 1, hits = m.fx.hits ? 3 : 1;
    return m.power * hits * (me.s.atk * stageMul(me.stg.atk) / (t.s.def * stageMul(t.stg.def))) * DMG_K * (m.type === me.type ? 1.2 : 1) * eff(m.type, t.type) * cover * Math.pow(60 / me.s.spd, SPD_EXP) * (m.fx.finisher && t.hp / t.maxHp < m.fx.finisher ? 2 : 1) * (m.acc / 100);
  }
  function cpuThink(st, s, lv, R, mem) {
    const sd = st.side[s], f = foeOf(s), foes = alive(st.side[f]), acts = [];
    if (!foes.length) return acts;
    if (sd.items > 0 && sd.itemCd <= 0) { const low = alive(sd).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if (low && low.hp / low.maxHp < 0.3 && R() < [0.2, 0.5, 0.9][lv]) acts.push({ s, m: 'item', ti: low.i }); }
    for (const u of alive(sd)) {
      if (u.busy > 0 || u.st === 'freeze' || u.g < 50) continue;
      const key = s + u.i; if (mem[key] == null) mem[key] = Math.floor([40, 12, 4][lv] * (0.6 + R() * 0.8)); if (mem[key] > 0) { mem[key]--; continue; } // 반응 지연
      let best = null, bv = -1;
      u.moves.forEach((m, k) => {
        if (!canUse(u, m)) return; let v = 0, ti = foes[0].i;
        if (m.kind === 'heal') { const low = alive(sd).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; v = low.hp / low.maxHp < 0.5 ? 60 * (1 - low.hp / low.maxHp) : 0; ti = low.i; }
        else if (m.kind === 'buff') v = m.fx.taunt ? (alive(sd).some(x => x !== u && x.hp / x.maxHp < 0.5) && u.hp / u.maxHp > 0.5 ? 28 : 4) : (u.hp / u.maxHp > 0.6 && u.stg[m.fx.stage[0]] < 2 ? 22 : 2);
        else if (m.kind === 'debuff') { const fast = foes.slice().sort((a, b) => b.g - a.g)[0]; v = fast.slowT > 0 ? 3 : 18 + fast.g / 10; ti = fast.i; }
        else if (m.tgt === 'foes') v = foes.reduce((x, t) => x + expDmg(st, s, u, t, m), 0);
        else { for (const t of foes) { let d = expDmg(st, s, u, t, m); if (lv >= 1) d *= d >= t.hp ? 2.2 : 1 + (1 - t.hp / t.maxHp) * (lv >= 2 ? 0.9 : 0.3); if (lv === 0) d *= 0.5 + R(); if (d > v) { v = d; ti = t.i; } } }
        if (lv === 0) v *= 0.6 + R() * 0.8;
        if (m.slot === 'basic' && u.g < 100) { const kill = foes.some(t => expDmg(st, s, u, t, m) >= t.hp); if (!kill && R() > [0.6, 0.25, 0.1][lv]) v = -1; } // 50에서 끊을지, 100까지 모을지
        if (v > bv) { bv = v; best = { s, i: u.i, m: k, ts: m.tgt === 'ally' ? s : f, ti }; }
      });
      if (best && lv === 0 && R() < 0.5) { const ok = u.moves.map((m, k) => k).filter(k => canUse(u, u.moves[k]) && u.moves[k].tgt !== 'ally'); if (ok.length) { const k = ok[Math.floor(R() * ok.length)]; best = { s, i: u.i, m: k, ts: f, ti: foes[Math.floor(R() * foes.length)].i }; bv = 1; } }
      if (best && bv > 0) { acts.push(best); mem[key] = null; }
      else if (u.g >= 100) mem[key] = null;
    }
    return acts;
  }
  const cpuTeam = (R, lv = 1, foeTeam) => {
    const all = roster(), team = [], types = new Set();
    if (lv >= 2 && foeTeam && foeTeam.length) { // 어려움: 내 팀 타입을 보고 상성으로 맞받아침, 탱커를 전열에
      const ft = foeTeam.map(id => GachaTowerDefs[id].type), score = d => ft.reduce((a, t) => a + (eff(d.type, t) - 1) - (eff(t, d.type) - 1), 0) + R() * 0.5;
      for (const d of all.slice().sort((a, b) => score(b) - score(a))) { if (team.length >= 3) break; if (types.has(d.type) && team.length < 2) continue; team.push(d.id); types.add(d.type); }
      const front = team.map(id => GachaTowerDefs[id]).sort((a, b) => (b.profile === 'H') - (a.profile === 'H'))[0].id; return [front, ...team.filter(x => x !== front)];
    }
    while (team.length < 3) { const d = all[Math.floor(R() * all.length)]; if (!team.includes(d.id)) team.push(d.id); } return team;
  };

  // ---------- 화면 공통 ----------
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const srcOf = id => window.TowerSpriteImages && window.TowerSpriteImages[id]; /* towers.js의 옛 const와 이름이 같아 window.로 읽음 */
  const img = (id, cls = '') => { const p = srcOf(id); return p ? `<img class="${cls}" src="${p}" alt="" draggable="false">` : `<span class="${cls} pb-noimg">${window.ICON ? ICON(GachaTowerDefs[id].type, 40) : ''}</span>`; };
  const tIcon = (t, n = 16) => (window.ICON ? ICON(t, n) : '');
  const typeChip = t => `<i class="pb-type" style="--tc:var(--t-${t})">${tIcon(t, 13)}${TKR[t]}</i>`;
  const sfx = k => { try { window.GameAudio && GameAudio.sfx.play(k); } catch (_) {} };
  const CAP = '<path d="M15 33c0-10 6-16.5 14-16.5S43 23 43 33z" fill="#fff"/><path d="M11 33.5h36c0 3.2-2.6 5-5.8 5H14.6c-2.4 0-3.6-2.1-3.6-5z" fill="#fff" opacity=".86"/><path d="M29 16.5c-2.5 3.2-3.3 9-3.3 16.5" stroke="var(--tc)" stroke-width="2.2" fill="none" opacity=".55"/>';
  const ROCKET = '<path d="M29 9c7.5 5.5 10.5 14 10.5 23l-4 6.5h-13l-4-6.5C18.5 23 21.5 14.5 29 9z" fill="#fff"/><circle cx="29" cy="24" r="4.2" fill="var(--tc)"/><path d="M22.5 37.5 16 46l8.5-3.6zm13 0L42 46l-8.5-3.6z" fill="#fff" opacity=".86"/>';
  let embN = 0;
  const emblem = (id, size = 48) => { const T = TRAINERS[id] || TRAINERS.red, gid = 'pbg' + (embN++);
    return `<svg class="pb-emb" width="${size}" height="${size}" viewBox="0 0 58 58" style="--tc:${T.color}" aria-hidden="true"><defs><radialGradient id="${gid}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs><circle cx="29" cy="29" r="27" fill="${T.color}"/><circle cx="29" cy="29" r="27" fill="url(#${gid})"/><circle cx="29" cy="29" r="25.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>${id === 'rocket' ? ROCKET : CAP}</svg>`; };
  const LV_KR = ['쉬움', '보통', '어려움'];
  const STAT_LBL = { hp: '체력', atk: '공격', def: '방어', spd: '스피드' };
  const SLOT_KR = { basic: '기본기', main: '주력기', special: '특수기' };
  const moveDesc = m => { const f = m.fx || {}, o = [];
    if (m.power) o.push(`위력 ${m.power}${f.hits ? ` ×${f.hits[0]}~${f.hits[1]}` : ''}`); if (m.acc < 100) o.push(`명중 ${m.acc}`);
    if (m.tgt === 'foes') o.push('상대 전체'); if (m.tgt === 'ally') o.push('아군 1마리'); if (f.st) o.push(`${Math.round(f.ch * 100)}% ${ST_KR[f.st]}`);
    if (f.slow) o.push(`${f.slow}초 둔화`); if (f.push) o.push(f.cut ? '게이지 밀기·끊기' : `게이지 -${f.push}`); if (f.crit) o.push(`급소 ${Math.round(f.crit * 100)}%`); if (f.pierce) o.push('방어 무시');
    if (f.recoil) o.push(`반동 ${Math.round(f.recoil * 100)}%`); if (f.stack) o.push('쓸수록 강해짐'); if (f.heal) o.push(`체력 ${Math.round(f.heal * 100)}% 회복`); if (f.taunt) o.push(`${f.taunt}초 도발·방어 +1`);
    else if (f.stage) o.push(`${STAT_KR[f.stage[0]]} +${f.stage[1]}`); if (f.debuff) o.push(`방어 ${f.debuff[1]}`); if (f.finisher) o.push(`체력 ${f.finisher * 100}% 미만 2배`); if (f.vsFast) o.push('빠른 상대에게 강함');
    return o.join(' · '); };

  const PB = window.PokeBattle = {
    root: null, net: null, code: null, me: 'p1', room: null, unsub: null, st: null, cpu: false, cpuLv: 1, hbT: null, arena: null,

    _root() { this._stopLoop(); document.getElementById('pb-root')?.remove(); const r = document.createElement('div'); r.id = 'pb-root'; document.body.appendChild(r); this.root = r; return r; },
    close() {
      this._stopLoop(); this.unsub && this.unsub(); this.unsub = null; clearInterval(this.hbT); window.removeEventListener('keydown', this._key);
      if (this.code && this.net && !this.cpu) this.net.update(this.code, { [`${this.me}.left`]: true }).catch(() => {});
      this.root && this.root.remove(); this.root = null; this.code = null; this.room = null; this.st = null;
    },
    myName() { try { return localStorage.getItem('pokemontd_vsname') || '트레이너'; } catch (_) { return '트레이너'; } },
    _pref(k, v) { try { if (v === undefined) return localStorage.getItem('pokemontd_pb_' + k); localStorage.setItem('pokemontd_pb_' + k, v); } catch (_) { return null; } },

    // ----- 메뉴 -----
    openMenu() {
      const r = this._root();
      r.innerHTML = `<div class="pb-menu">
        <div class="pb-hero">${TR_IDS.map((id, i) => `<span style="--i:${i}">${emblem(id, 46)}</span>`).join('')}</div>
        <div class="pb-h1">포켓몬 배틀</div>
        <p class="pb-sub">3마리가 한꺼번에 나서는 실시간 난전. 게이지가 찬 포켓몬의 기술을 상대에게 끌어다 놓으세요</p>
        <button class="pb-btn primary" data-a="cpu">연습하기 (CPU)</button>
        <button class="pb-btn" data-a="create">친구와 대결 · 방 만들기</button>
        <div class="pb-join"><input class="pb-code" inputmode="numeric" maxlength="4" placeholder="방 코드 4자리" aria-label="방 코드"><button class="pb-btn" data-a="join">참가</button></div>
        <div class="pb-msg" role="alert"></div><button class="pb-btn ghost" data-a="close">닫기</button></div>`;
      const msg = t => { r.querySelector('.pb-msg').textContent = t; };
      r.querySelector('[data-a="close"]').onclick = () => this.close();
      r.querySelector('[data-a="cpu"]').onclick = () => { this.cpu = true; this.me = 'p1'; this.openPick(); };
      r.querySelector('[data-a="create"]').onclick = async () => {
        this.net = this.net || Versus.makeNet(); this.cpu = false;
        const code = String(1000 + Math.floor(Math.random() * 9000));
        try { await this.net.create(code, { code, kind: 'battle', state: 'pick', created: Date.now(), seed: (Math.random() * 1e9) >>> 0, p1: { name: this.myName(), hb: Date.now(), ready: false }, p2: null, log: {}, cmd: {} });
          this.code = code; this.me = 'p1'; this.openPick(); } catch (e) { msg(Versus._errText(e)); }
      };
      r.querySelector('[data-a="join"]').onclick = async () => {
        this.net = this.net || Versus.makeNet(); this.cpu = false;
        const code = r.querySelector('.pb-code').value.trim(); if (!/^\d{4}$/.test(code)) return msg('방 코드 4자리를 입력하세요');
        try { const d = await this.net.get(code);
          if (!d || d.kind !== 'battle') return msg('그 코드의 배틀 방이 없어요. 코드를 다시 확인하세요'); if (d.state !== 'pick') return msg('이미 대결이 시작된 방이에요');
          if (d.p2 && d.p2.hb && Date.now() - d.p2.hb < Versus.LOST_MS) return msg('이미 두 명이 들어간 방이에요');
          await this.net.update(code, { p2: { name: this.myName(), hb: Date.now(), ready: false } });
          this.code = code; this.me = 'p2'; this.openPick(); } catch (e) { msg(Versus._errText(e)); }
      };
    },

    // ----- 팀 고르기: 위 = 내 3마리 큰 초상(전열 크게, 트레이너 엠블럼 워터마크), 아래 = 얼굴 격자 -----
    openPick() {
      const r = this._root(), all = roster();
      let team = [], trainer = TRAINERS[this._pref('trainer')] ? this._pref('trainer') : 'red', filter = 'all', focus = all[0].id, ready = false;
      this.cpuLv = Math.max(0, Math.min(2, +(this._pref('lv') ?? 1)));
      const oppHtml = () => { const o = this.room && this.room[this.me === 'p1' ? 'p2' : 'p1'], rd = !this.cpu && !!(o && o.ready);
        const nm = this.cpu ? `CPU · ${LV_KR[this.cpuLv]}` : o ? esc(o.name) : '상대를 기다리는 중';
        return `<span class="pb-oppvs">VS</span><b>${nm}</b><span class="pb-qs">${[0, 1, 2].map(() => `<i class="pb-q ${rd ? 'ok' : ''}">${rd ? '✓' : '?'}</i>`).join('')}</span><small>${this.cpu ? '대결이 시작되면 CPU 팀이 공개돼요' : rd ? '준비 완료' : o ? '팀을 고르는 중' : '코드 ' + this.code}</small>`; };
      this._oppHtml = oppHtml;
      const render = () => {
        const d = GachaTowerDefs[focus], s = statsOf(d), mv = movesOf(d), max = { hp: 200, atk: 85, def: 85, spd: 85 }, T = TRAINERS[trainer];
        const slot = (i, lbl) => { const id = team[i], x = id && GachaTowerDefs[id]; return `<button class="pb-por ${i === 0 ? 'front' : ''} ${id ? '' : 'empty'}" ${id ? `data-rm="${i}" aria-label="${esc(x.name)} 빼기"` : 'disabled'} style="--tc:var(--t-${x ? x.type : 'normal'})">${id ? img(id, 'pb-porimg') : ''}<span class="pb-porlbl">${lbl}</span>${id ? `<b>${esc(x.name)}</b>` : '<b class="pb-porph">비어 있음</b>'}</button>`; };
        r.innerHTML = `<div class="pb-pick">
          <header class="pb-top"><button class="pb-x" data-a="back" aria-label="뒤로">${window.ICON ? ICON('back', 20) : '‹'}</button><b>${this.cpu ? '연습 모드' : '방 ' + this.code}</b><span class="pb-count">${team.length}/3</span></header>
          <div class="pb-opp">${oppHtml()}</div>
          <section class="pb-stage" style="--tc:${T.color}"><div class="pb-stagebg">${emblem(trainer, 170)}</div>${slot(0, '전열 · 1')}<div class="pb-back">${slot(1, '후열 · 2')}${slot(2, '후열 · 3')}</div></section>
          <div class="pb-trainers" role="radiogroup" aria-label="트레이너">${TR_IDS.map(id => `<button role="radio" aria-checked="${trainer === id}" data-tr="${id}" class="${trainer === id ? 'on' : ''}" style="--tc:${TRAINERS[id].color}" ${ready ? 'disabled' : ''}>${emblem(id, 30)}<b>${TRAINERS[id].name}</b></button>`).join('')}</div>
          <p class="pb-trdesc" style="--tc:${T.color}"><b>${T.name} · ${T.style}</b> ${T.desc}${trainer === 'yellow' ? '' : '. 회복약 1개'}</p>
          <section class="pb-detail" style="--tc:var(--t-${d.type})">${img(d.id, 'pb-dimg')}<div class="pb-dinfo"><div class="pb-dname"><b>${esc(d.name)}</b>${typeChip(d.type)}<span class="pb-shape">${shapeOf(d)} · 게이지 ${cycleSec(s)}초</span></div>
            <div class="pb-stats">${['hp', 'atk', 'def', 'spd'].map(k => `<div><span>${STAT_LBL[k]}</span><i><b style="width:${Math.min(100, s[k] / max[k] * 100)}%"></b></i><em>${s[k]}</em></div>`).join('')}</div>
            <div class="pb-mvs">${mv.map(m => `<span style="--tc:var(--t-${m.type})" title="${esc(moveDesc(m))}"><small>${SLOT_KR[m.slot]} ${m.cost}</small>${esc(m.name)}</span>`).join('')}</div></div></section>
          <nav class="pb-filter" aria-label="타입 거르기">${['all', 'fire', 'water', 'electric', 'grass', 'psychic', 'normal'].map(t => `<button data-f="${t}" class="${filter === t ? 'on' : ''}" ${t !== 'all' ? `style="--tc:var(--t-${t})"` : ''}>${t === 'all' ? '전체' : tIcon(t, 15) + TKR[t]}</button>`).join('')}</nav>
          <div class="pb-grid">${all.filter(x => filter === 'all' || x.type === filter).map(x => { const inT = team.includes(x.id), full = !inT && team.length >= 3;
            return `<button class="pb-face ${inT ? 'in' : ''} ${focus === x.id ? 'focus' : ''} ${full ? 'full' : ''}" data-id="${x.id}" style="--tc:var(--t-${x.type})" aria-label="${esc(x.name)}">${img(x.id)}<span>${esc(x.name)}</span>${inT ? `<i>${team.indexOf(x.id) + 1}</i>` : ''}</button>`; }).join('')}</div>
          <footer class="pb-bottom">${this.cpu ? `<div class="pb-lv" role="radiogroup" aria-label="CPU 난이도">${LV_KR.map((t, i) => `<button role="radio" aria-checked="${this.cpuLv === i}" data-lv="${i}" class="${this.cpuLv === i ? 'on' : ''}">${t}</button>`).join('')}</div>` : `<span class="pb-wait">${this._pickWaitText()}</span>`}
            <button class="pb-btn primary" data-a="ready" ${team.length === 3 ? '' : 'disabled'}>${ready ? '준비 취소' : team.length === 3 ? (this.cpu ? '대결 시작' : '준비 완료') : `${3 - team.length}마리 더`}</button></footer></div>`;
        r.querySelector('[data-a="back"]').onclick = () => { this.close(); this.openMenu(); };
        r.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { trainer = b.dataset.tr; this._pref('trainer', trainer); sfx('tap'); render(); });
        r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; this._gridScroll = 0; render(); });
        r.querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { this.cpuLv = +b.dataset.lv; this._pref('lv', this.cpuLv); render(); });
        r.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (ready) return; team.splice(+b.dataset.rm, 1); render(); });
        r.querySelectorAll('.pb-face').forEach(b => b.onclick = () => {
          const id = b.dataset.id;
          if (!ready && (focus === id || team.includes(id))) { if (team.includes(id)) team = team.filter(x => x !== id); else if (team.length < 3) team.push(id); }
          focus = id; sfx('tap'); render();
        });
        const grid = r.querySelector('.pb-grid'); if (grid) { grid.scrollTop = this._gridScroll || 0; grid.addEventListener('scroll', () => { this._gridScroll = grid.scrollTop; }, { passive: true }); }
        r.querySelector('[data-a="ready"]').onclick = () => {
          if (team.length !== 3) return;
          if (this.cpu) { const seed = (Math.random() * 1e9) >>> 0, R = rngOf(seed ^ 77); this.startBattle({ name: this.myName(), trainer, team }, { name: `CPU · ${LV_KR[this.cpuLv]}`, trainer: TR_IDS[Math.floor(R() * TR_IDS.length)], team: cpuTeam(R, this.cpuLv, team) }, seed); return; }
          ready = !ready; this.net.update(this.code, { [`${this.me}.ready`]: ready, [`${this.me}.trainer`]: trainer, [`${this.me}.team`]: team, [`${this.me}.hb`]: Date.now() }).catch(() => {}); render();
        };
      };
      render();
      if (!this.cpu) {
        this.unsub && this.unsub();
        this.unsub = this.net.listen(this.code, d => {
          if (!d) return; this.room = d;
          if (d.state === 'battle' && !this.st) return this.startBattle(d.p1, d.p2, d.seed);
          if (d.p1 && d.p2 && d.p1.ready && d.p2.ready && d.state === 'pick') this.net.update(this.code, { state: 'battle' }).catch(() => {});
          const w = this.root && this.root.querySelector('.pb-wait'); if (w) w.textContent = this._pickWaitText();
          const op = this.root && this.root.querySelector('.pb-opp'); if (op && this._oppHtml) op.innerHTML = this._oppHtml();
        });
        clearInterval(this.hbT); this.hbT = setInterval(() => this.code && this.net.update(this.code, { [`${this.me}.hb`]: Date.now() }).catch(() => {}), HB_MS);
      }
    },
    _pickWaitText() {
      const o = this.room && this.room[this.me === 'p1' ? 'p2' : 'p1'];
      return !o ? `코드 ${this.code}를 친구에게 알려주세요` : o.ready ? `상대(${esc(o.name)}) 준비 완료` : `상대(${esc(o.name)})가 팀을 고르는 중`;
    },

    // ----- 대결 -----
    async startBattle(p1, p2, seed) {
      this.st = newState(p1, p2, seed); this.mem = {}; this.log = []; this.snaps = []; this.cmdN = 0; this.hostSeen = 0; this.sel = null; this.aim = null; this.seenEv = new Set(); this._resultShown = false;
      const r = this._root(), foe = foeOf(this.me), F = this.st.side[foe], M = this.st.side[this.me];
      r.innerHTML = `<div class="pb-battle">
        <div class="pb-arena"></div>
        <div class="pb-hudtop"><span class="pb-tr">${emblem(F.trainer, 26)}<b>${esc(F.name)}</b></span><span class="pb-clock" aria-label="남은 시간">3:00</span><button class="pb-ff" data-a="ff">기권</button></div>
        <div class="pb-fcards">${F.units.map(u => `<div class="pb-fc" data-i="${u.i}" style="--tc:var(--t-${u.type});order:${[2, 1, 3][u.i]}"><div class="pb-fcn"><b>${esc(u.name)}</b>${tIcon(u.type, 14)}<small>${u.i === 0 ? '전열' : '후열'}</small></div><em class="pb-stc"></em><i class="pb-hpb"><b></b></i><i class="pb-gb"><b></b></i></div>`).join('')}</div>
        <div class="pb-ticker" aria-live="polite"></div>
        <div class="pb-tray" hidden></div>
        <div class="pb-mycards">${M.units.map(u => `<button class="pb-mc" data-i="${u.i}" style="--tc:var(--t-${u.type})" aria-label="${esc(u.name)} 선택 (${u.i + 1})">${img(u.id, 'pb-mcimg')}<span class="pb-mcn"><b>${esc(u.name)}</b><small>${u.i === 0 ? '전열' : '후열'}</small></span><em class="pb-stc"></em><span class="pb-mchp"></span><i class="pb-hpb"><b></b></i><i class="pb-gb"><b></b><s></s></i><kbd>${u.i + 1}</kbd></button>`).join('')}
          <button class="pb-itembtn" data-a="item" aria-label="회복약">${window.ICON ? ICON('candy', 22) : ''}<span>회복약</span><b></b></button></div>
        <div class="pb-loading">경기장 준비 중</div></div>`;
      r.querySelector('[data-a="ff"]').onclick = () => { if (confirm('기권하면 바로 패배해요. 기권할까요?')) this._forfeit(); };
      try { const mod = await import('./arena3d.js'); if (!this.root) return; this.arena = mod.createArena(r.querySelector('.pb-arena'));
        const side = s => (s === this.me ? 'me' : 'foe');
        for (const s of ['p1', 'p2']) this.st.side[s].units.forEach(u => this.arena.setUnit(side(s), u.i, srcOf(u.id), side(s) === 'me'));
      } catch (e) { console.warn('3D 경기장 실패', e); r.querySelector('.pb-arena').classList.add('fallback'); }
      r.querySelector('.pb-loading')?.remove();
      this._bindInput(); this._drawHud();
      if (this.cpu) { const tip = document.createElement('div'); tip.className = 'pb-tip'; tip.textContent = '게이지가 찬 내 카드를 탭 → 기술을 상대에게 끌어다 놓기'; r.querySelector('.pb-battle').appendChild(tip); this._tip = tip; setTimeout(() => tip.remove(), 9000); }
      this._intro(M, F);
      if (!this.cpu) {
        this.unsub && this.unsub();
        this.unsub = this.net.listen(this.code, d => { if (d) this._onRoom(d); });
        clearInterval(this.hbT); this.hbT = setInterval(() => this.code && this.net.update(this.code, { [`${this.me}.hb`]: Date.now() }).catch(() => {}), HB_MS);
      }
      setTimeout(() => this._startLoop(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 1800);
    },
    _intro(M, F) {
      const ov = document.createElement('div'); ov.className = 'pb-intro';
      const card = (sd, side) => `<div class="pb-ic ${side}" style="--tc:${TRAINERS[sd.trainer].color}">${emblem(sd.trainer, 64)}<div><b>${esc(sd.name)}</b><small>${TRAINERS[sd.trainer].name} · ${TRAINERS[sd.trainer].style}</small><span>${sd.units.map(u => img(u.id)).join('')}</span></div></div>`;
      ov.innerHTML = `${card(F, 'foe')}<div class="pb-vs">VS</div>${card(M, 'me')}`;
      this.root.appendChild(ov); sfx('wave_start');
      setTimeout(() => ov.classList.add('out'), 1450); setTimeout(() => ov.remove(), 1800);
    },
    // 시뮬레이션: 고정 20틱/초. 연습에서 기술을 고르는 동안 0.25배(불릿타임)
    _startLoop() {
      cancelAnimationFrame(this.raf); let last = performance.now(), acc = 0, uiAcc = 0;
      const loop = now => {
        if (!this.st || !this.root) return; this.raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        if (!this.st.winner) { acc += dt * (this.cpu && this.sel ? 0.25 : 1); let n = 0; while (acc >= 1 / TPS && n++ < 8) { acc -= 1 / TPS; this._step(); if (this.st.winner) break; } }
        this.root.classList.toggle('slow', !!(this.cpu && this.sel));
        uiAcc += dt; if (uiAcc > 0.08) { uiAcc = 0; this._drawHud(); }
        if (this.st.winner && !this._resultShown && (this.cpu || this.me === 'p1' || (this.room && this.room.state === 'ended'))) this._result();
      };
      this.raf = requestAnimationFrame(loop);
    },
    _stopLoop() { cancelAnimationFrame(this.raf); this.raf = 0; if (this.arena) { this.arena.dispose(); this.arena = null; } },
    _step() {
      const st = this.st, ev = [];
      if (st.t % TPS === 0) { this.snaps.push(JSON.stringify(st)); if (this.snaps.length > 40) this.snaps.shift(); }
      for (const L of this.log) if (L.tk === st.t + 1) apply(st, L.a, ev);
      if (this.cpu) { const R = rngOf((st.seed + st.t * 7919) >>> 0); for (const a of cpuThink(st, foeOf(this.me), this.cpuLv, R, this.mem)) apply(st, a, ev); }
      tick(st, ev);
      this._fx(ev);
    },
    // 입력 → 기록. 연습·방장: 다음 틱 / 손님: 방 문서로 보내면 방장이 적용 틱을 정함
    _commit(a) {
      a.s = this.me; if (this._tip) { this._tip.remove(); this._tip = null; }
      if (this.cpu) { this.log.push({ tk: this.st.t + 1, a }); return; }
      if (this.me === 'p1') { const tk = this.st.t + 2, k = this.log.length; this.log.push({ tk, a }); this.net.update(this.code, { [`log.${k}`]: { tk, a } }).catch(() => {}); }
      else { const n = this.cmdN++; this.net.update(this.code, { [`cmd.${n}`]: a }).catch(() => {}); }
    },
    _onRoom(d) {
      this.room = d; const o = d[foeOf(this.me)];
      if (o && (o.left || (o.hb && Date.now() - o.hb > 40000)) && this.st && !this.st.winner) { this.st.winner = this.me; this.st.why = '상대가 대결을 나갔어요'; }
      if (!this.st) return;
      if (this.me === 'p1') {
        const cmds = d.cmd || {}; while (cmds[this.hostSeen]) { const a = { ...cmds[this.hostSeen], s: 'p2' }, tk = this.st.t + 2, k = this.log.length; this.log.push({ tk, a }); this.net.update(this.code, { [`log.${k}`]: { tk, a } }).catch(() => {}); this.hostSeen++; }
        if (this.st.winner && d.state !== 'ended') this.net.update(this.code, { state: 'ended', winner: this.st.winner, why: this.st.why || '' }).catch(() => {});
      } else {
        const L = d.log || {}; let rewind = Infinity;
        while (L[this.log.length]) { const e = L[this.log.length]; this.log.push(e); if (e.tk <= this.st.t) rewind = Math.min(rewind, e.tk); }
        if (rewind < Infinity) this._rollback(rewind);
        if (d.state === 'ended' && d.winner) { this.st.winner = d.winner; this.st.why = d.why || this.st.why; }
      }
    },
    _rollback(tk) { // 이미 지난 틱의 기록을 받으면: 그 전 저장점으로 되돌려 다시 계산
      const now = this.st.t; let snap = null;
      for (let k = this.snaps.length - 1; k >= 0; k--) { const s = JSON.parse(this.snaps[k]); if (s.t < tk) { snap = s; this.snaps.length = k + 1; break; } }
      if (!snap) return;
      this.st = snap; const ev = [];
      while (this.st.t < now) { for (const L of this.log) if (L.tk === this.st.t + 1) apply(this.st, L.a, ev); tick(this.st, ev); if (this.st.t % TPS === 0) { this.snaps.push(JSON.stringify(this.st)); if (this.snaps.length > 40) this.snaps.shift(); } }
      this._fx(ev.filter(e => e.k === 'faint' || e.k === 'act' || e.k === 'dmg'), true);
    },

    // ----- 입력: 내 카드 탭 → 기술 트레이 → 기술을 상대(아군)에게 끌어다 놓기 (또는 탭 → 대상 탭) -----
    _bindInput() {
      const r = this.root;
      r.querySelectorAll('.pb-mc').forEach(b => b.onclick = () => this._select(+b.dataset.i));
      r.querySelector('[data-a="item"]').onclick = () => this._openTray('item');
      window.removeEventListener('keydown', this._key);
      this._key = e => { if (!this.st) return; if (['1', '2', '3'].includes(e.key)) this._select(+e.key - 1); if (e.key === 'Escape') this._closeTray(); };
      window.addEventListener('keydown', this._key);
      r.querySelector('.pb-arena').addEventListener('pointerdown', e => { if (this.aim) { const h = this.arena && this.arena.hitTest(e.clientX, e.clientY); if (h) this._fire(this.aim.m, h); else this._closeTray(); } });
    },
    _select(i) {
      const u = this.st.side[this.me].units[i]; if (!u || u.hp <= 0 || this.st.winner) return;
      if (this.sel && this.sel.i === i) return this._closeTray();
      if (u.g < 50 || u.busy > 0 || u.st === 'freeze') { this._tick(u.st === 'freeze' ? `${u.name}은(는) 얼어 있다` : `${u.name}의 게이지가 아직이에요 (50부터)`); return; }
      this.sel = { i }; sfx('tap'); this._openTray(i);
    },
    _openTray(i) {
      const tray = this.root.querySelector('.pb-tray'), sd = this.st.side[this.me];
      this._clearMarks(); this.aim = null;
      if (i === 'item') {
        if (sd.items <= 0 || sd.itemCd > 0) return this._tick(sd.items <= 0 ? '회복약을 다 썼어요' : '회복약은 잠시 뒤에 다시 쓸 수 있어요');
        this.sel = { i: 'item' };
        tray.innerHTML = `<div class="pb-trayh"><b>회복약</b> 아군에게 끌어다 놓으세요 · 체력 40%와 상태이상 회복</div><div class="pb-moves one"><button class="pb-mv" data-m="item" style="--tc:#3ddc97"><span class="pb-mvi">${window.ICON ? ICON('candy', 28) : ''}</span><b>회복약</b><small>남은 ${sd.items}개</small></button></div>`;
      } else {
        const u = sd.units[i];
        const tn = this._taunter();
        tray.innerHTML = `<div class="pb-trayh">${tn ? `<b class="pb-tauntnote">상대 ${esc(tn.name)}가 도발 중</b> 단일 공격은 ${esc(tn.name)}에게만 갈 수 있어요 (${Math.ceil(tn.tauntT / TPS)}초)` : `<b>${esc(u.name)}</b> 기술 아이콘을 상대에게 끌어다 놓으세요`}</div><div class="pb-moves">${u.moves.map((m, k) => { const ok = canUse(u, m);
          return `<button class="pb-mv ${ok ? '' : 'off'}" data-m="${k}" style="--tc:var(--t-${m.type})"><span class="pb-mvi">${tIcon(m.type, 28)}<i>${m.cost}</i></span><b>${esc(m.name)}</b><small>${SLOT_KR[m.slot]}</small><em>${esc(moveDesc(m))}</em></button>`; }).join('')}</div>`;
      }
      tray.hidden = false; this._drawHud();
      tray.querySelectorAll('.pb-mv').forEach(b => b.addEventListener('pointerdown', e => this._dragStart(e, b.dataset.m)));
    },
    _closeTray() { this.sel = null; this.aim = null; const t = this.root && this.root.querySelector('.pb-tray'); if (t) t.hidden = true; this._clearMarks(); this.root && this.root.querySelector('.pb-ghost')?.remove(); this._drawHud(); },
    _clearMarks() { if (!this.arena) return; for (const sd of ['me', 'foe']) for (let i = 0; i < 3; i++) this.arena.mark(sd, i, false); },
    _taunter() { const F = this.st.side[foeOf(this.me)]; return F.units.find(u => u.hp > 0 && u.tauntT > 0) || null; },
    _moveOf(mk) { if (mk === 'item') return { tgt: 'ally', kind: 'heal', type: 'grass', item: true }; const u = this.st.side[this.me].units[this.sel.i]; return u && u.moves[+mk]; },
    _dragStart(e, mk) {
      if (!this.sel) return; const m = this._moveOf(mk); if (!m) return;
      if (!m.item) { const u = this.st.side[this.me].units[this.sel.i]; if (!canUse(u, m)) { this._tick(`게이지 ${m.cost}이 필요해요`); return; } }
      e.preventDefault();
      if (m.tgt === 'self' || m.tgt === 'foes') { this._fire(mk, null); return; } // 대상 없는 기술은 누르면 바로
      const sx = e.clientX, sy = e.clientY, btn = e.currentTarget, side = s => (s === this.me ? 'me' : 'foe'); let moved = false, ghost = null, hover = null;
      const tn = m.tgt === 'foe' ? this._taunter() : null;
      const valid = h => h && (m.tgt === 'ally' ? h.side === 'me' : h.side === 'foe' && (!tn || h.i === tn.i));
      let list = m.item ? this.st.side[this.me].units.filter(u => u.hp > 0).map(u => ({ s: this.me, i: u.i })) : validTargets(this.st, this.me, m);
      if (tn) list = list.filter(t => t.i === tn.i);
      list.forEach(t => this.arena && this.arena.mark(side(t.s), t.i, true, m.tgt === 'ally' ? 0x3ddc97 : tn ? 0xff5c7a : 0xffd34d));
      const foeFront = this.st.side[foeOf(this.me)].units[0]; let lastHint = null;
      const mv = ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { moved = true; ghost = btn.querySelector('.pb-mvi').cloneNode(true); ghost.className = 'pb-ghost'; ghost.style.setProperty('--tc', getComputedStyle(btn).getPropertyValue('--tc')); this.root.appendChild(ghost); }
        if (ghost) { ghost.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 30}px)`; const h = this.arena && this.arena.hitTest(ev.clientX, ev.clientY); hover = valid(h) ? h : null; ghost.classList.toggle('on', !!hover); this.arena && this.arena.lit(hover && hover.side, hover && hover.i); this.root.querySelectorAll('.pb-fc').forEach(el => el.classList.toggle('lit', !!(hover && hover.side === 'foe' && +el.dataset.i === hover.i)));
          const hint = hover && hover.side === 'foe' && m.tgt === 'foe' && hover.i !== 0 && foeFront.hp > 0 ? '전열이 살아 있어 피해 ×0.7' : (h && !hover && tn && h.side === 'foe') ? `도발 중이라 ${tn.name}만 노릴 수 있어요` : null; if (hint && hint !== lastHint) this._tick(hint); lastHint = hint; }
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); ghost && ghost.remove(); this.arena && this.arena.lit(null, null); this.root.querySelectorAll('.pb-fc.lit').forEach(el => el.classList.remove('lit'));
        if (moved) { if (hover) this._fire(mk, hover); else if (!(tn && !hover)) this._tick(m.tgt === 'ally' ? '아군 위에 놓아야 해요' : '상대 포켓몬 위에 놓아야 해요'); }
        else { this.aim = { m: mk }; this._tick(m.tgt === 'ally' ? '회복할 아군을 탭하세요' : tn ? `도발 중인 ${tn.name}를 탭하세요` : '공격할 상대를 탭하세요'); }
      };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    },
    _fire(mk, h) {
      if (!this.sel) return; const m = this._moveOf(mk); if (!m) return;
      if (h && ((m.tgt === 'ally') !== (h.side === 'me'))) { this._tick(m.tgt === 'ally' ? '아군에게 써야 해요' : '상대에게 써야 해요'); return; }
      const tn = m.tgt === 'foe' ? this._taunter() : null; if (h && tn && h.side === 'foe' && h.i !== tn.i) { this._tick(`상대 ${tn.name}가 도발 중이라 ${tn.name}에게 갑니다`); h = { side: 'foe', i: tn.i }; }
      const ts = h ? (h.side === 'me' ? this.me : foeOf(this.me)) : null;
      this._commit(mk === 'item' ? { m: 'item', ti: h ? h.i : 0 } : { i: this.sel.i, m: +mk, ts, ti: h ? h.i : 0 }); sfx('tap'); this._closeTray();
    },

    // ----- 그리기 -----
    _drawHud() {
      const r = this.root, st = this.st; if (!r || !st) return;
      const M = st.side[this.me], F = st.side[foeOf(this.me)];
      const left = Math.max(0, LIMIT - st.t), clk = r.querySelector('.pb-clock'); if (clk) { clk.textContent = `${Math.floor(left / TPS / 60)}:${String(Math.floor(left / TPS) % 60).padStart(2, '0')}`; clk.classList.toggle('low', left < 30 * TPS); }
      const put = (el, u) => {
        if (!el) return; el.classList.toggle('dead', u.hp <= 0);
        const hp = el.querySelector('.pb-hpb b'), g = el.querySelector('.pb-gb b'), pct = u.hp / u.maxHp;
        hp.style.width = pct * 100 + '%'; hp.className = pct < 0.25 ? 'red' : pct < 0.5 ? 'yel' : '';
        g.style.width = u.g + '%'; el.classList.toggle('half', u.hp > 0 && u.g >= 50 && u.g < 100 && !u.busy && u.st !== 'freeze'); el.classList.toggle('full', u.hp > 0 && u.g >= 100 && !u.busy && u.st !== 'freeze');
        const sc = el.querySelector('.pb-stc'), tags = [u.st ? ST_KR[u.st] : '', u.tauntT > 0 ? '도발' : '', u.slowT > 0 ? '둔화' : ''].filter(Boolean); sc.textContent = tags.join(' '); sc.className = 'pb-stc ' + (u.st || '');
        const n = el.querySelector('.pb-mchp'); if (n) n.textContent = u.hp > 0 ? `${u.hp}/${u.maxHp}` : '기절';
      };
      r.querySelectorAll('.pb-mc').forEach(el => { put(el, M.units[+el.dataset.i]); el.classList.toggle('sel', !!(this.sel && this.sel.i === +el.dataset.i)); });
      r.querySelectorAll('.pb-fc').forEach(el => put(el, F.units[+el.dataset.i]));
      if (this.arena) for (const sd of ['p1', 'p2']) this.st.side[sd].units.forEach(u => this.arena.setTaunt(sd === this.me ? 'me' : 'foe', u.i, u.hp > 0 && u.tauntT > 0));
      const ib = r.querySelector('.pb-itembtn'); if (ib) { ib.querySelector('b').textContent = M.items; ib.classList.toggle('off', M.items <= 0 || M.itemCd > 0); ib.classList.toggle('sel', !!(this.sel && this.sel.i === 'item')); }
      if (this.sel && this.sel.i !== 'item') { const u = M.units[this.sel.i]; if (!u || u.hp <= 0) return this._closeTray(); r.querySelectorAll('.pb-tray .pb-mv').forEach(b => b.classList.toggle('off', !canUse(u, u.moves[+b.dataset.m]))); }
    },
    _tick(t) { const el = this.root && this.root.querySelector('.pb-ticker'); if (!el) return; el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); },
    _fx(ev, quiet) {
      const A = this.arena, side = s => (s === this.me ? 'me' : 'foe'), U = (s, i) => A && A.units[side(s)][i];
      for (const e of ev) {
        const key = e.k + ':' + e.s + ':' + e.i + ':' + (e.amt || '') + ':' + (e.move || '') + ':' + Math.floor(this.st.t / 4); if (quiet && this.seenEv.has(key)) continue; this.seenEv.add(key); if (this.seenEv.size > 500) this.seenEv = new Set();
        const u = U(e.s, e.i), nm = () => (this.st.side[e.s].units[e.i] || {}).name, who = e.s === this.me ? '' : '상대 ';
        if (e.k === 'act') { if (u && A) { const spec = { type: e.mtype, slot: e.slot, kind: e.kind, fx: e.fx || [], fxst: e.fxst, foes: e.foes, miss: ev.some(x => x.k === 'miss' && e.tgts.some(t => t.s === x.s && t.i === x.i)) };
            const tos = e.tgts.map(t => U(t.s, t.i)).filter(Boolean); this._spec = spec; if (e.kind === 'atk') A.lunge(u, tos[0]); A.cast(u, tos, spec); }
          this._tick(`${who}${nm()}의 ${e.move}!`); sfx(e.kind && e.kind !== 'atk' ? 'skill' : 'tap'); }
        else if (e.k === 'dmg') { const dl = A && this._spec ? A.delayOf(this._spec) * 1000 : 300; setTimeout(() => { if (A && u) A.accent(u, { crit: e.crit, eff: e.eff }); this._pop(e.s, e.i, `-${e.amt}`, e.crit ? 'crit' : e.eff > 1 ? 'big' : e.eff < 1 ? 'weak' : ''); sfx(e.crit ? 'pull_epic' : 'hit'); }, dl);
          if (e.crit) this._tick('급소에 맞았다!'); else if (e.eff > 1) this._tick('상성이 좋다! ×1.4'); else if (e.eff < 1) this._tick('상성이 나쁘다… ×0.7'); else if (e.cover) this._tick('전열이 엄호해서 피해가 줄었다 ×0.7'); }
        else if (e.k === 'faint') { setTimeout(() => A && u && A.faint(u), 450); this._tick(`${who}${nm()}은(는) 쓰러졌다!`); sfx('life_lost'); if (this.sel && e.s === this.me && this.sel.i === e.i) this._closeTray(); }
        else if (e.k === 'miss') this._tick('빗나갔다!');
        else if (e.k === 'status') { u && A.setTint(u, e.st === 'freeze' ? 0x9fd8ff : e.st === 'burn' ? 0xffb199 : e.st === 'poison' ? 0xd7a6ff : 0xfff08a); this._tick(`${who}${nm()}은(는) ${ST_KR[e.st]} 상태!`); }
        else if (e.k === 'cure') { u && A.setTint(u, null); }
        else if (e.k === 'heal' || e.k === 'item') { this._pop(e.s, e.i, '회복', 'heal'); if (e.k === 'item') { u && A && A.cast(u, [u], { type: 'grass', kind: 'heal', fx: [] }); u && A.setTint(u, null); this._tick(`${who}회복약! ${nm()} 회복`); } sfx('buy'); }
        else if (e.k === 'dot' && e.st !== 'recoil') this._pop(e.s, e.i, `-${e.amt}`, 'dot');
        else if (e.k === 'push') this._pop(e.s, e.i, e.cut ? '끊기!' : '게이지↓', 'push');
        else if (e.k === 'taunt') { this._tick(`${who}${nm()}의 도발! 4초 동안 단일 공격이 ${nm()}에게 끌려요`); }
        else if (e.k === 'stage' && e.d) this._pop(e.s, e.i, `${STAT_KR[e.stat]}${e.d > 0 ? '↑' : '↓'}`, e.d > 0 ? 'up' : 'down');
        else if (e.k === 'slow') this._pop(e.s, e.i, '둔화', 'down');
        else if (e.k === 'msg') this._tick(e.text);
      }
    },
    _pop(s, i, text, cls) {
      if (!this.arena || !this.root) return; const q = this.arena.rectOf(s === this.me ? 'me' : 'foe', i); if (!q) return;
      const p = document.createElement('span'); p.className = 'pb-pop ' + (cls || ''); p.textContent = text; p.style.left = q.cx + 'px'; p.style.top = (q.top + (q.bottom - q.top) * 0.25) + 'px';
      this.root.appendChild(p); setTimeout(() => p.remove(), 900);
    },
    _forfeit() { if (!this.st || this.st.winner) return; this.st.winner = foeOf(this.me); this.st.why = '기권했어요'; if (!this.cpu) this.net.update(this.code, { [`${this.me}.left`]: true, state: 'ended', winner: this.st.winner, why: '상대가 기권했어요' }).catch(() => {}); },
    _result() {
      this._resultShown = true; this._closeTray(); const w = this.st.winner, win = w === this.me, draw = w === 'draw', M = this.st.side[this.me];
      sfx(win ? 'record' : draw ? 'wave_clear' : 'gameover');
      const left = M.units.filter(u => u.hp > 0).length, ov = document.createElement('div'); ov.className = 'pb-result';
      ov.innerHTML = `<div class="pb-rbox" style="--tc:${TRAINERS[M.trainer].color}">${emblem(M.trainer, 72)}<div class="pb-h1 ${win ? 'win' : draw ? '' : 'lose'}">${win ? '승리' : draw ? '무승부' : '패배'}</div>
        <p class="pb-sub">${this.st.why ? esc(this.st.why) : win ? `${left}마리가 남아 이겼어요` : '상성 좋은 상대에게 기술을 끌어다 놓아 보세요'}</p>
        <div class="pb-rteam">${M.units.map(u => `<span class="${u.hp <= 0 ? 'out' : ''}">${img(u.id)}</span>`).join('')}</div>
        ${this.cpu ? '<button class="pb-btn primary" data-a="again">같은 팀으로 다시</button><button class="pb-btn" data-a="pick">팀 다시 고르기</button>' : ''}<button class="pb-btn ghost" data-a="exit">나가기</button></div>`;
      this.root.appendChild(ov);
      ov.querySelector('[data-a="exit"]').onclick = () => this.close();
      const ag = ov.querySelector('[data-a="again"]'); if (ag) ag.onclick = () => { const s = this.st.side.p1, me = { name: s.name, trainer: s.trainer, team: s.units.map(u => u.id) }, seed = (Math.random() * 1e9) >>> 0, R = rngOf(seed ^ 77); this.startBattle(me, { name: `CPU · ${LV_KR[this.cpuLv]}`, trainer: TR_IDS[Math.floor(R() * TR_IDS.length)], team: cpuTeam(R, this.cpuLv, me.team) }, seed); };
      const pk = ov.querySelector('[data-a="pick"]'); if (pk) pk.onclick = () => { this.st = null; this.openPick(); };
    },
  };
  // 밸런스 확인용: 화면 없이 CPU끼리 한 판
  function simulate(t1, t2, tr1, tr2, lv1, lv2, seed) {
    const st = newState({ team: t1, trainer: tr1 }, { team: t2, trainer: tr2 }, seed), mem = {}, ev = [];
    while (!st.winner) { const R = rngOf((seed + st.t * 7919) >>> 0); for (const a of cpuThink(st, 'p1', lv1, R, mem)) apply(st, a, ev); for (const a of cpuThink(st, 'p2', lv2, R, mem)) apply(st, a, ev); tick(st, ev); ev.length = 0; }
    return st;
  }
  PB._engine = { TP, TRAINERS, TPS, statsOf, movesOf, newState, apply, tick, cpuThink, cpuTeam, rngOf, roster, simulate, cycleSec };
})();
