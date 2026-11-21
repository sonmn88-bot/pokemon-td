// ===== BATTLE.JS - v4.4 포켓몬 배틀 (2인 대전 안의 3:3 턴제 모드) =====
// 이 게임만의 규칙: 능력치는 도감(pokedex.js)의 등급·역할·프로필에서, 기술은 태그·역할에서 자동 생성. 상성은 6속성 순환(1.4/0.7).
// 팀 예산 9(노말1·레어2·에픽3·레전드4·유니크6)로 3마리. 매 턴 기술/교체/회복약 → 교체·약 먼저, 그다음 선제도·스피드 순.
// 온라인: 두 사람의 선택을 방 문서(acts)에 쌓고, 양쪽이 같은 시드로 같은 계산(replay)을 해서 결과가 항상 똑같음 (동기화 어긋남 없음)
(function () {
  'use strict';
  const BUDGET = 9, TURN_SEC = 45, HB_MS = 5000;
  const COST = { normal: 1, rare: 2, epic: 3, legend: 4, unique: 6 }; // 유니크 5→6: CPU 1500판에서 1+3+5 조합 승률 80%
  const GM = { normal: 1, rare: 1.18, epic: 1.38, legend: 1.6, unique: 1.62 }; // 유니크 1.75→1.62 (비용 6이라도 승률 73%였음)
  const PROF = { H: { hp: 1.25, atk: 1.15, def: 1.2, spd: 0.72 }, N: { hp: 1, atk: 1, def: 1, spd: 1 }, F: { hp: 0.85, atk: 0.97, def: 0.85, spd: 1.32 } };
  const ROLE = { dealer: { atk: 1.12 }, aoe: {}, control: { def: 1.05, atk: 0.94 }, support: { hp: 1.12, def: 1.08, atk: 0.86 }, execute: { atk: 1.06, spd: 1.05 }, boss: { atk: 1.05, hp: 1.05 } };
  const TKR = { fire: '불꽃', water: '물', electric: '전기', grass: '풀', psychic: '에스퍼', normal: '노말' };
  const ST_KR = { burn: '화상', poison: '독', shock: '감전', freeze: '빙결' };
  const STAT_KR = { atk: '공격', def: '방어', spd: '스피드' };
  // 트레이너 패시브 수치 (CPU 600판 시뮬로 승률 맞춤 — 바꾸면 PokeBattle._engine으로 다시 확인)
  const TP = { pikaCrit: 0.10, pikaElec: 1.15, togeHeal: 0.025, eeveeFresh: 1.3 };
  const TRAINERS = {
    pikachu: { name: '피카츄', desc: `전기 충전 — 모든 기술 급소율 +${TP.pikaCrit * 100}%p, 전기 기술 위력 +${Math.round((TP.pikaElec - 1) * 100)}%` },
    togepi: { name: '토게피', desc: `행복의 기운 — 매 턴 끝에 나와 있는 포켓몬 체력 ${TP.togeHeal * 100}% 회복` },
    eevee: { name: '이브이', desc: `적응의 재능 — 새로 나온 포켓몬의 첫 공격 위력 +${Math.round((TP.eeveeFresh - 1) * 100)}%` },
  };
  // 기술 (이 게임 고유 이름). kind: atk/status, fx: 부가효과
  const BASIC = { fire: ['불씨 돌진', '작열 강타'], water: ['물보라 쏘기', '해일 포격'], electric: ['찌릿 펀치', '낙뢰 강타'], grass: ['잎날 베기', '거목 내려치기'], psychic: ['염동 파동', '정신 붕괴파'], normal: ['박치기 돌격', '전력 돌격'] };
  const TAGMOVE = {
    burn: { name: '불티 흩뿌리기', power: 45, acc: 100, pp: 10, fx: { st: 'burn', ch: 0.4 } },
    poison: { name: '독가루 바람', power: 40, acc: 100, pp: 10, fx: { st: 'poison', ch: 0.5 } },
    slow: { name: '끈끈한 덫', power: 35, acc: 100, pp: 10, fx: { stage: ['spd', -1, 'foe'] } },
    stun: { name: '전류 스파크', power: 45, acc: 100, pp: 10, fx: { st: 'shock', ch: 0.3 } },
    freeze: { name: '냉기 일섬', power: 50, acc: 95, pp: 8, fx: { st: 'freeze', ch: 0.2 } },
    chain: { name: '연속 타격', power: 22, acc: 95, pp: 10, fx: { hits: [2, 4] } },
    multi: { name: '흩뿌리기 사격', power: 65, acc: 90, pp: 10, fx: {} },
    knockback: { name: '날려버리기', power: 40, acc: 100, pp: 8, fx: { force: true } },
    crit: { name: '급소 노리기', power: 60, acc: 100, pp: 10, fx: { crit: 0.35 } },
    pierce: { name: '관통 일격', power: 60, acc: 100, pp: 10, fx: { pierce: true } },
    antiAir: { name: '대공 사격', power: 60, acc: 100, pp: 10, fx: { vsFast: 1.3 } },
    gold: { name: '럭키 펀치', power: 50, acc: 100, pp: 10, fx: { crit: 0.2 } },
    blast: { name: '자폭 돌진', power: 120, acc: 100, pp: 5, fx: { recoil: 0.25 } },
    stack: { name: '기 모으기 타격', power: 40, acc: 100, pp: 10, fx: { stack: 20 } },
    range: { name: '선제 저격', power: 40, acc: 100, pp: 10, pri: 1, fx: {} },
  };
  const ROLEMOVE = {
    dealer: { name: '집중', kind: 'status', pp: 5, fx: { stage: ['atk', 2, 'self'] } },
    aoe: { name: '휩쓸기', power: 50, acc: 100, pp: 10, fx: { stage: ['def', -1, 'foe'] } },
    control: { name: '발묶기', kind: 'status', acc: 100, pp: 10, fx: { stage: ['spd', -2, 'foe'] } },
    support: { name: '응급 처치', kind: 'status', pp: 3, fx: { heal: 0.45 } },
    execute: { name: '마무리 일격', power: 45, acc: 100, pp: 8, fx: { finisher: 0.4 } },
    boss: { name: '끝장 추격', power: 70, acc: 95, pp: 8, fx: { pierce: true } },
  };
  const GUARD = { name: '방어 태세', kind: 'status', pp: 5, fx: { stage: ['def', 2, 'self'] } };
  const STRUGGLE = { name: '안간힘', power: 30, acc: 100, pp: 99, fx: {} };

  // ---------- 데이터 ----------
  const roster = () => Object.values(window.GachaTowerDefs || {}).filter(d => d.no >= 1 && d.no <= 151).sort((a, b) => a.no - b.no);
  const vary = (no, k) => 1 + (((no * k) % 13) - 6) / 100;
  function statsOf(d) {
    const g = GM[d.grade] || 1, P = PROF[d.profile] || PROF.N, R = ROLE[d.role] || {};
    return { hp: Math.round(110 * g * P.hp * (R.hp || 1) * vary(d.no, 7)), atk: Math.round(52 * g * P.atk * (R.atk || 1) * vary(d.no, 11)),
      def: Math.round(50 * g * P.def * (R.def || 1) * vary(d.no, 5)), spd: Math.round(50 * Math.sqrt(g) * P.spd * (R.spd || 1) * vary(d.no, 3)) };
  }
  function movesOf(d) {
    const t = d.type, [b1, b2] = BASIC[t] || BASIC.normal, mk = (o, extra) => Object.assign({ type: t, kind: 'atk', acc: 100, fx: {} }, o, extra || {});
    const tag = (d.tags || []).find(x => TAGMOVE[x]);
    return [mk({ name: b1, power: 55, pp: 20 }), mk({ name: b2, power: 85, acc: 85, pp: 8 }), mk(tag ? TAGMOVE[tag] : GUARD), mk(ROLEMOVE[d.role] || GUARD)];
  }
  const costOf = d => COST[d.grade] || 1;

  // ---------- 규칙 엔진 (순수 계산, 같은 입력·시드 → 같은 결과) ----------
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const stageMul = s => (s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s));
  const eff = (a, b) => (window.typeEffectiveness ? typeEffectiveness(a, b) : 1);
  function mkMon(id) {
    const d = GachaTowerDefs[id], s = statsOf(d), moves = movesOf(d);
    return { id, name: d.name, type: d.type, grade: d.grade, s, maxHp: s.hp, hp: s.hp, status: null, stT: 0, stg: { atk: 0, def: 0, spd: 0 }, pp: moves.map(m => m.pp), moves, fresh: true, stack: 0 };
  }
  function newState(p1, p2) {
    const side = p => ({ name: p.name || '트레이너', trainer: p.trainer || 'pikachu', mons: (p.team || []).map(mkMon), active: 0, item: 1 });
    return { side: { p1: side(p1), p2: side(p2) }, step: 1, phase: 'turn', need: ['p1', 'p2'], winner: null };
  }
  const alive = sd => sd.mons.filter(m => m.hp > 0);
  const act = sd => sd.mons[sd.active];
  const foeOf = s => (s === 'p1' ? 'p2' : 'p1');
  const spdOf = m => m.s.spd * stageMul(m.stg.spd) * (m.status === 'shock' ? 0.7 : 1);

  function validate(st, s, a) {
    const sd = st.side[s], m = act(sd);
    if (st.phase === 'replace') { const i = a && a.to; return Number.isInteger(i) && sd.mons[i] && sd.mons[i].hp > 0 && i !== sd.active ? { t: 'switch', to: i } : { t: 'switch', to: sd.mons.findIndex(x => x.hp > 0) }; }
    if (a && a.t === 'switch' && Number.isInteger(a.to) && sd.mons[a.to] && sd.mons[a.to].hp > 0 && a.to !== sd.active) return a;
    if (a && a.t === 'item' && sd.item > 0) return a;
    if (a && a.t === 'move' && m.pp[a.i] > 0) return a;
    const i = m.pp.findIndex(p => p > 0); return i >= 0 ? { t: 'move', i } : { t: 'move', i: -1 };
  }

  // 한 단계 진행: acts = { p1: {...}, p2: {...} } (필요한 쪽만). 반환: 이벤트 목록
  function step(st, acts, seed) {
    const R = rngOf((seed ^ Math.imul(st.step, 2654435761)) >>> 0), ev = [];
    const say = text => ev.push({ t: 'msg', text });
    const doSwitch = (s, to, forced) => {
      const sd = st.side[s], from = act(sd); from.stg = { atk: 0, def: 0, spd: 0 }; from.stack = 0;
      sd.active = to; const m = act(sd); m.fresh = true;
      ev.push({ t: 'switch', side: s, idx: to, name: m.name, forced: !!forced });
    };
    if (st.phase === 'replace') {
      for (const s of st.need) doSwitch(s, validate(st, s, acts[s]).to);
      st.step++; st.phase = 'turn'; st.need = ['p1', 'p2']; return ev;
    }
    const A = { p1: validate(st, 'p1', acts.p1), p2: validate(st, 'p2', acts.p2) };
    const pri = s => (A[s].t !== 'move' ? 6 : (A[s].i >= 0 ? act(st.side[s]).moves[A[s].i].pri || 0 : 0));
    const order = ['p1', 'p2'].map(s => ({ s, p: pri(s), v: spdOf(act(st.side[s])), r: R() })).sort((a, b) => b.p - a.p || b.v - a.v || a.r - b.r);
    const actor = { p1: act(st.side.p1), p2: act(st.side.p2) };
    for (const { s } of order) {
      const sd = st.side[s], me = act(sd), f = foeOf(s), fsd = st.side[f];
      if (st.winner) break;
      const a = A[s];
      if (a.t === 'switch') { doSwitch(s, a.to); continue; }
      if (a.t === 'item') { sd.item--; const h = Math.round(me.maxHp * 0.5); me.hp = Math.min(me.maxHp, me.hp + h); me.status = null; ev.push({ t: 'item', side: s, name: me.name, hp: me.hp, max: me.maxHp }); continue; }
      if (me !== actor[s] || me.hp <= 0) continue; // 교체·기절로 바뀐 포켓몬은 예약된 기술을 못 씀
      // 상태이상으로 행동 불가
      if (me.status === 'freeze') { me.stT++; if (R() < 0.3 || me.stT >= 3) { me.status = null; ev.push({ t: 'cure', side: s, name: me.name, st: 'freeze' }); } else { ev.push({ t: 'cant', side: s, name: me.name, why: '얼어서 움직일 수 없다' }); continue; } }
      if (me.status === 'shock' && R() < 0.25) { ev.push({ t: 'cant', side: s, name: me.name, why: '몸이 저려서 움직일 수 없다' }); continue; }
      const mv = a.i >= 0 ? me.moves[a.i] : STRUGGLE; if (a.i >= 0) me.pp[a.i]--;
      const tg = act(fsd);
      ev.push({ t: 'use', side: s, name: me.name, move: mv.name, mtype: mv.type || me.type, kind: mv.kind || 'atk' });
      if (mv.acc && mv.acc < 100 && mv.kind !== 'status' && R() * 100 >= mv.acc) { ev.push({ t: 'miss', side: f }); me.fresh = false; continue; }
      if (mv.kind === 'status' && mv.acc && R() * 100 >= mv.acc) { ev.push({ t: 'miss', side: f }); continue; }
      const fx = mv.fx || {};
      if (mv.kind !== 'status') {
        const hits = fx.hits ? fx.hits[0] + Math.floor(R() * (fx.hits[1] - fx.hits[0] + 1)) : 1;
        let done = 0;
        for (let h = 0; h < hits && tg.hp > 0; h++) {
          let power = mv.power + (fx.stack ? me.stack * fx.stack : 0);
          if (fx.finisher && tg.hp / tg.maxHp < fx.finisher) power *= 2;
          if (fx.vsFast && spdOf(tg) > spdOf(me)) power *= fx.vsFast;
          const atk = me.s.atk * stageMul(me.stg.atk) * (me.status === 'burn' ? 0.8 : 1);
          const def = tg.s.def * (fx.pierce ? 0.75 : stageMul(tg.stg.def));
          const e = eff(mv.type || me.type, tg.type), stab = (mv.type || me.type) === me.type ? 1.2 : 1;
          const tr = TRAINERS[sd.trainer] ? sd.trainer : 'pikachu';
          const trMul = (tr === 'pikachu' && (mv.type || me.type) === 'electric' ? TP.pikaElec : 1) * (tr === 'eevee' && me.fresh ? TP.eeveeFresh : 1);
          const critCh = (fx.crit || 0.0625) + (tr === 'pikachu' ? TP.pikaCrit : 0), crit = R() < critCh;
          let dmg = power * (atk / def) * 0.45 * stab * e * trMul * (crit ? 1.5 : 1) * (0.9 + R() * 0.1);
          dmg = Math.max(1, Math.round(dmg)); tg.hp = Math.max(0, tg.hp - dmg); done += dmg;
          ev.push({ t: 'dmg', side: f, amt: dmg, hp: tg.hp, max: tg.maxHp, eff: e, crit });
        }
        if (hits > 1) say(`${hits}번 맞혔다!`);
        if (fx.stack) me.stack = Math.min(3, me.stack + 1);
        if (fx.recoil && me.hp > 0) { const r = Math.max(1, Math.round(me.maxHp * fx.recoil)); me.hp = Math.max(0, me.hp - r); ev.push({ t: 'recoil', side: s, amt: r, hp: me.hp, max: me.maxHp }); }
        if (tg.hp > 0 && fx.st && !tg.status && R() < fx.ch) applySt(tg, f, fx.st);
        if (tg.hp > 0 && fx.stage) applyStage(fx.stage[2] === 'self' ? me : tg, fx.stage[2] === 'self' ? s : f, fx.stage[0], fx.stage[1]);
        if (tg.hp > 0 && fx.force) { const others = fsd.mons.map((m, i) => i).filter(i => i !== fsd.active && fsd.mons[i].hp > 0); if (others.length) doSwitch(f, others[Math.floor(R() * others.length)], true); }
      } else {
        if (fx.heal) { const h = Math.round(me.maxHp * fx.heal); me.hp = Math.min(me.maxHp, me.hp + h); ev.push({ t: 'heal', side: s, name: me.name, hp: me.hp, max: me.maxHp }); }
        if (fx.stage) applyStage(fx.stage[2] === 'self' ? me : tg, fx.stage[2] === 'self' ? s : f, fx.stage[0], fx.stage[1]);
      }
      me.fresh = false;
      for (const x of [tg, me]) if (x.hp <= 0 && !x._fe) { x._fe = 1; ev.push({ t: 'faint', side: x === me ? s : f, name: x.name }); }
      checkWin();
    }
    function applySt(m, side, k) {
      if ((k === 'burn' || k === 'freeze') && m.type === 'fire') return; if (k === 'shock' && m.type === 'electric') return;
      m.status = k; m.stT = 0; ev.push({ t: 'status', side, name: m.name, st: k });
    }
    function applyStage(m, side, k, d) {
      const before = m.stg[k]; m.stg[k] = Math.max(-3, Math.min(3, before + d));
      ev.push({ t: 'stage', side, name: m.name, stat: k, d: m.stg[k] - before });
    }
    function checkWin() {
      const a1 = alive(st.side.p1).length, a2 = alive(st.side.p2).length;
      if (!a1 || !a2) st.winner = !a1 && !a2 ? 'draw' : !a1 ? 'p2' : 'p1';
    }
    // 턴 끝: 화상·독, 토게피 회복
    if (!st.winner) for (const s of ['p1', 'p2']) {
      const sd = st.side[s], m = act(sd); if (m.hp <= 0) continue;
      if (m.status === 'burn' || m.status === 'poison') { const d = Math.max(1, Math.round(m.maxHp * (m.status === 'burn' ? 0.06 : 0.1))); m.hp = Math.max(0, m.hp - d); ev.push({ t: 'dot', side: s, name: m.name, st: m.status, amt: d, hp: m.hp, max: m.maxHp }); if (m.hp <= 0) { m._fe = 1; ev.push({ t: 'faint', side: s, name: m.name }); } }
      if (m.hp > 0 && sd.trainer === 'togepi' && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * TP.togeHeal)); ev.push({ t: 'heal', side: s, name: m.name, hp: m.hp, max: m.maxHp, small: true }); }
    }
    checkWin();
    st.step++;
    if (!st.winner) {
      const need = ['p1', 'p2'].filter(s => act(st.side[s]).hp <= 0 && alive(st.side[s]).length);
      if (need.length) { st.phase = 'replace'; st.need = need; } else { st.phase = 'turn'; st.need = ['p1', 'p2']; }
    } else st.need = [];
    return ev;
  }

  // ---------- CPU (연습 상대) ----------
  function cpuChoose(st, s, R) {
    const sd = st.side[s], me = act(sd), foe = act(st.side[foeOf(s)]);
    if (st.phase === 'replace') { let best = -1, bv = -1e9; sd.mons.forEach((m, i) => { if (m.hp <= 0 || i === sd.active) return; const v = eff(m.type, foe.type) * 2 - eff(foe.type, m.type) + m.hp / m.maxHp; if (v > bv) { bv = v; best = i; } }); return { t: 'switch', to: best }; }
    if (sd.item > 0 && me.hp / me.maxHp < 0.3 && R() < 0.7) return { t: 'item' };
    if (eff(foe.type, me.type) > 1 && me.hp / me.maxHp < 0.6 && R() < 0.35) {
      const i = sd.mons.findIndex((m, k) => k !== sd.active && m.hp > m.maxHp * 0.4 && eff(foe.type, m.type) <= 1); if (i >= 0) return { t: 'switch', to: i };
    }
    let best = 0, bv = -1;
    me.moves.forEach((m, i) => {
      if (me.pp[i] <= 0) return; let v;
      if (m.kind === 'status') v = m.fx.heal ? (me.hp / me.maxHp < 0.45 ? 120 : 0) : m.fx.stage ? (m.fx.stage[2] === 'self' ? (me.hp / me.maxHp > 0.7 && me.stg[m.fx.stage[0]] < 2 ? 70 : 5) : (foe.stg[m.fx.stage[0]] > -2 ? 40 : 3)) : 10;
      else v = m.power * eff(m.type, foe.type) * (m.type === me.type ? 1.2 : 1) * (m.acc / 100) * (m.fx.hits ? 3 : 1) * (m.fx.finisher && foe.hp / foe.maxHp < 0.4 ? 2 : 1);
      v *= 0.85 + R() * 0.3; if (v > bv) { bv = v; best = i; }
    });
    return { t: 'move', i: best };
  }
  const cpuTeam = R => { const all = roster(); const team = []; let left = BUDGET; for (let k = 0; k < 3; k++) { const ok = all.filter(d => costOf(d) <= left - (2 - k) && !team.includes(d.id)); const pick = ok.sort((a, b) => costOf(b) - costOf(a)).slice(0, 25)[Math.floor(R() * Math.min(25, ok.length))]; team.push(pick.id); left -= costOf(pick); } return team; };

  // ---------- 화면 ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (id, cls = '') => { const p = window.TowerSpriteImages && window.TowerSpriteImages[id]; /* towers.js의 옛 const와 이름이 같아 window.로 읽음 */ return p ? `<img class="${cls}" src="${p}" alt="" draggable="false">` : `<span class="${cls} pb-noimg">${window.ICON ? ICON(GachaTowerDefs[id].type, 40) : ''}</span>`; };
  const typeChip = t => `<i class="pb-type" style="--tc:var(--t-${t})">${TKR[t]}</i>`;
  const stars = g => '★'.repeat((window.GRADES && GRADES[g] && GRADES[g].stars) || 1);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sfx = k => { try { window.GameAudio && GameAudio.sfx.play(k); } catch (_) {} };

  const PB = window.PokeBattle = {
    root: null, net: null, code: null, me: 'p1', room: null, unsub: null, st: null, seed: 1, cpu: false, applied: 0, busy: false, hbT: null, tmT: null,

    _root() { document.getElementById('pb-root')?.remove(); const r = document.createElement('div'); r.id = 'pb-root'; document.body.appendChild(r); this.root = r; return r; },
    close() {
      this.unsub && this.unsub(); this.unsub = null; clearInterval(this.hbT); clearInterval(this.tmT);
      if (this.code && this.net && !this.cpu) this.net.update(this.code, { [`${this.me}.left`]: true }).catch(() => {});
      this.root && this.root.remove(); this.root = null; this.code = null; this.room = null; this.st = null;
    },
    myName() { try { return localStorage.getItem('pokemontd_vsname') || '트레이너'; } catch (_) { return '트레이너'; } },

    // ----- 메뉴 -----
    openMenu() {
      const r = this._root();
      r.innerHTML = `<div class="pb-menu"><div class="pb-h1">포켓몬 배틀</div><p class="pb-sub">팀 예산 ${BUDGET} 안에서 3마리 · 교체하며 싸우는 턴제 대결</p>
        <button class="pb-btn primary" data-a="cpu">CPU와 연습</button>
        <button class="pb-btn" data-a="create">방 만들기</button>
        <div class="pb-join"><input class="pb-code" inputmode="numeric" maxlength="4" placeholder="방 코드 4자리"><button class="pb-btn" data-a="join">참가</button></div>
        <div class="pb-msg"></div><button class="pb-btn ghost" data-a="close">닫기</button></div>`;
      const msg = t => { r.querySelector('.pb-msg').textContent = t; };
      r.querySelector('[data-a="close"]').onclick = () => this.close();
      r.querySelector('[data-a="cpu"]').onclick = () => { this.cpu = true; this.me = 'p1'; this.openPick(); };
      r.querySelector('[data-a="create"]').onclick = async () => {
        this.net = this.net || Versus.makeNet(); this.cpu = false;
        const code = String(1000 + Math.floor(Math.random() * 9000));
        try { await this.net.create(code, { code, kind: 'battle', state: 'pick', created: Date.now(), seed: (Math.random() * 1e9) >>> 0, p1: { name: this.myName(), hb: Date.now(), ready: false }, p2: null, acts: {} });
          this.code = code; this.me = 'p1'; this.openPick(); } catch (e) { msg(Versus._errText(e)); }
      };
      r.querySelector('[data-a="join"]').onclick = async () => {
        this.net = this.net || Versus.makeNet(); this.cpu = false;
        const code = r.querySelector('.pb-code').value.trim(); if (!/^\d{4}$/.test(code)) return msg('코드 4자리를 입력하세요');
        try { const d = await this.net.get(code);
          if (!d || d.kind !== 'battle') return msg('없는 배틀 방이에요'); if (d.state !== 'pick') return msg('이미 시작한 방이에요');
          if (d.p2 && d.p2.hb && Date.now() - d.p2.hb < Versus.LOST_MS) return msg('방이 꽉 찼어요');
          await this.net.update(code, { p2: { name: this.myName(), hb: Date.now(), ready: false } });
          this.code = code; this.me = 'p2'; this.openPick(); } catch (e) { msg(Versus._errText(e)); }
      };
    },

    // ----- 팀 고르기 (격투게임식 얼굴 격자) -----
    openPick() {
      const r = this._root(), all = roster(); let team = [], trainer = 'pikachu', filter = 'all', focus = all[0].id, ready = false;
      const used = () => team.reduce((a, id) => a + costOf(GachaTowerDefs[id]), 0);
      const render = () => {
        const d = GachaTowerDefs[focus], s = statsOf(d), mv = movesOf(d), max = { hp: 220, atk: 110, def: 105, spd: 95 };
        r.innerHTML = `<div class="pb-pick">
          <div class="pb-top"><button class="pb-x" data-a="back" aria-label="뒤로">‹</button><b>${this.cpu ? 'CPU 연습' : '방 ' + this.code}</b><span class="pb-budget">예산 <em>${used()}</em>/${BUDGET}</span></div>
          <div class="pb-trainers">${Object.entries(TRAINERS).map(([id, t]) => `<button data-tr="${id}" class="${trainer === id ? 'on' : ''}" ${ready ? 'disabled' : ''}><img src="assets/heroes/${id}.png" alt=""><span>${t.name}</span></button>`).join('')}</div>
          <p class="pb-trdesc">${TRAINERS[trainer].desc} · 회복약 1개</p>
          <div class="pb-team">${[0, 1, 2].map(i => { const id = team[i]; return id ? `<button class="pb-slot" data-rm="${i}">${img(id)}<span>${esc(GachaTowerDefs[id].name)}</span><i>${costOf(GachaTowerDefs[id])}</i></button>` : `<div class="pb-slot empty">${i === 0 ? '선봉' : i + 1}</div>`; }).join('')}</div>
          <div class="pb-detail">${img(d.id, 'pb-dimg')}<div class="pb-dinfo"><b>${esc(d.name)} <small style="color:${(window.GRADES && GRADES[d.grade] || {}).color}">${stars(d.grade)}</small></b>${typeChip(d.type)} <span class="pb-cost">비용 ${costOf(d)}</span>
            <div class="pb-stats">${['hp', 'atk', 'def', 'spd'].map(k => `<div><span>${{ hp: '체력', atk: '공격', def: '방어', spd: '스피드' }[k]}</span><i><b style="width:${Math.min(100, s[k] / max[k] * 100)}%"></b></i><em>${s[k]}</em></div>`).join('')}</div>
            <div class="pb-mvs">${mv.map(m => `<span style="--tc:var(--t-${m.type})">${esc(m.name)}<small>${m.kind === 'status' ? '변화' : m.power}</small></span>`).join('')}</div></div></div>
          <div class="pb-filter">${['all', 'fire', 'water', 'electric', 'grass', 'psychic', 'normal'].map(t => `<button data-f="${t}" class="${filter === t ? 'on' : ''}">${t === 'all' ? '전체' : TKR[t]}</button>`).join('')}</div>
          <div class="pb-grid">${all.filter(x => filter === 'all' || x.type === filter).map(x => { const inT = team.includes(x.id), over = !inT && (team.length >= 3 || used() + costOf(x) > BUDGET - (2 - team.length)); return `<button class="pb-face ${inT ? 'in' : ''} ${focus === x.id ? 'focus' : ''} ${over ? 'over' : ''}" data-id="${x.id}" style="--gc:${(window.GRADES && GRADES[x.grade] || {}).color}">${img(x.id)}<span>${esc(x.name)}</span><i>${costOf(x)}</i></button>`; }).join('')}</div>
          <div class="pb-bottom"><span class="pb-wait">${this._pickWaitText(ready)}</span><button class="pb-btn primary" data-a="ready" ${team.length === 3 ? '' : 'disabled'}>${ready ? '준비 취소' : team.length === 3 ? '배틀 시작' : `${3 - team.length}마리 더 고르세요`}</button></div></div>`;
        r.querySelector('[data-a="back"]').onclick = () => { this.close(); this.openMenu(); };
        r.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { trainer = b.dataset.tr; render(); });
        r.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
        r.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { if (ready) return; team.splice(+b.dataset.rm, 1); render(); });
        r.querySelectorAll('.pb-face').forEach(b => b.onclick = () => {
          const id = b.dataset.id; if (ready) { focus = id; return render(); }
          if (focus === id || team.includes(id)) { if (team.includes(id)) team = team.filter(x => x !== id); else if (!b.classList.contains('over')) team.push(id); }
          focus = id; sfx('tap'); render();
        });
        const grid = r.querySelector('.pb-grid'); if (grid && this._gridScroll) grid.scrollTop = this._gridScroll; grid && grid.addEventListener('scroll', () => { this._gridScroll = grid.scrollTop; });
        r.querySelector('[data-a="ready"]').onclick = () => {
          if (team.length !== 3) return;
          if (this.cpu) { const R = rngOf(Date.now() >>> 0); this.seed = (Math.random() * 1e9) >>> 0; this.startBattle({ name: this.myName(), trainer, team }, { name: 'CPU', trainer: ['pikachu', 'togepi', 'eevee'][Math.floor(R() * 3)], team: cpuTeam(R) }); return; }
          ready = !ready; this.net.update(this.code, { [`${this.me}.ready`]: ready, [`${this.me}.trainer`]: trainer, [`${this.me}.team`]: team, [`${this.me}.hb`]: Date.now() }).catch(() => {}); render();
        };
      };
      this._pickRender = render; render();
      if (!this.cpu) {
        this.unsub && this.unsub();
        this.unsub = this.net.listen(this.code, (d, err) => {
          if (!d) return; this.room = d;
          if (d.state === 'battle' && !this.st) return this.startBattle(d.p1, d.p2, d.seed);
          if (d.p1 && d.p2 && d.p1.ready && d.p2.ready && d.state === 'pick') this.net.update(this.code, { state: 'battle' }).catch(() => {});
          const w = this.root && this.root.querySelector('.pb-wait'); if (w) w.textContent = this._pickWaitText(d[this.me] && d[this.me].ready);
        });
        clearInterval(this.hbT); this.hbT = setInterval(() => this.code && this.net.update(this.code, { [`${this.me}.hb`]: Date.now() }).catch(() => {}), HB_MS);
      }
    },
    _pickWaitText(ready) {
      if (this.cpu) return '한 번 누르면 정보 · 한 번 더 누르면 팀에 넣기 · 첫 번째가 선봉';
      const o = this.room && this.room[this.me === 'p1' ? 'p2' : 'p1'];
      return !o ? `코드 ${this.code} · 상대를 기다리는 중` : o.ready ? `${esc(o.name)} 준비 완료` : `${esc(o.name)} 고르는 중`;
    },

    // ----- 배틀 -----
    startBattle(p1, p2, seed) {
      if (seed) this.seed = seed;
      this.st = newState(p1, p2); this.view = JSON.parse(JSON.stringify(this.st)); this.applied = 0; this.busy = false; this.acts = {}; this._sent = {};
      const r = this._root(); const foe = foeOf(this.me);
      r.innerHTML = `<div class="pb-battle">
        <div class="pb-bar foe"><b>${esc(this.st.side[foe].name)}</b><span class="pb-balls" data-s="${foe}"></span><img class="pb-trimg" src="assets/heroes/${this.st.side[foe].trainer}.png" alt=""></div>
        <div class="pb-field">
          <div class="pb-card foe" data-s="${foe}"></div><div class="pb-mon foe" data-s="${foe}"></div>
          <div class="pb-mon me" data-s="${this.me}"></div><div class="pb-card me" data-s="${this.me}"></div>
        </div>
        <div class="pb-bar me"><img class="pb-trimg" src="assets/heroes/${this.st.side[this.me].trainer}.png" alt=""><b>${esc(this.st.side[this.me].name)}</b><span class="pb-balls" data-s="${this.me}"></span><button class="pb-ff" data-a="ff">기권</button></div>
        <div class="pb-log">배틀 시작!</div>
        <div class="pb-cmd"></div></div>`;
      r.querySelector('[data-a="ff"]').onclick = () => { if (confirm('기권할까요?')) this._forfeit(); };
      ['p1', 'p2'].forEach(s => this._drawSide(s));
      sfx('wave_start');
      if (!this.cpu) {
        this.unsub && this.unsub();
        this.unsub = this.net.listen(this.code, d => { if (d) { this.room = d; this._pump(); } });
        clearInterval(this.hbT); this.hbT = setInterval(() => this.code && this.net.update(this.code, { [`${this.me}.hb`]: Date.now() }).catch(() => {}), HB_MS);
      }
      setTimeout(() => this._pump(), 400);
    },
    _actsFor(stepNo) { return this.cpu ? (this.acts[stepNo] || {}) : ((this.room && this.room.acts && this.room.acts[stepNo]) || {}); },
    async _pump() {
      if (this.busy || !this.st) return; this.busy = true;
      try {
        for (;;) {
          if (this.st.winner) { this._result(); break; }
          const a = this._actsFor(this.st.step);
          if (this.cpu) for (const s of this.st.need) if (s !== this.me && !a[s]) { a[s] = cpuChoose(this.st, s, rngOf((this.seed + this.st.step * 7919) >>> 0)); this.acts[this.st.step] = a; }
          if (!this.cpu) { const o = this.room && this.room[foeOf(this.me)]; if (o && (o.left || (o.hb && Date.now() - o.hb > 40000))) { this.st.winner = this.me; this._result('상대가 나갔어요'); break; } }
          if (this.st.need.every(s => a[s])) {
            const ev = step(this.st, a, this.seed); await this._play(ev); this.view = JSON.parse(JSON.stringify(this.st)); ['p1', 'p2'].forEach(s => this._drawSide(s)); continue;
          }
          if (this.st.need.includes(this.me) && !a[this.me]) this._askInput(); else this._waitInput();
          break;
        }
      } finally { this.busy = false; }
    },
    _submit(action) {
      const no = this.st.step; if (this._sent[no]) return; this._sent[no] = true; clearInterval(this.tmT);
      this.root.querySelector('.pb-cmd').innerHTML = '<div class="pb-wait2">상대의 선택을 기다리는 중…</div>';
      if (this.cpu) { (this.acts[no] = this.acts[no] || {})[this.me] = action; this._pump(); }
      else this.net.update(this.code, { [`acts.${no}.${this.me}`]: action }).catch(() => { this._sent[no] = false; this._askInput(); });
    },
    _waitInput() { const c = this.root.querySelector('.pb-cmd'); if (c) c.innerHTML = `<div class="pb-wait2">${this.st.phase === 'replace' ? '상대가 다음 포켓몬을 고르는 중…' : '상대의 선택을 기다리는 중…'}</div>`; },
    _askInput() {
      const c = this.root.querySelector('.pb-cmd'), sd = this.st.side[this.me], m = act(sd), foe = act(this.st.side[foeOf(this.me)]);
      const team = (only) => `<div class="pb-swl">${sd.mons.map((x, i) => `<button data-sw="${i}" ${x.hp <= 0 || i === sd.active ? 'disabled' : ''}>${img(x.id)}<span>${esc(x.name)} ${typeChip(x.type)}</span><i><b style="width:${x.hp / x.maxHp * 100}%"></b></i><em>${x.hp}/${x.maxHp}${x.status ? ' · ' + ST_KR[x.status] : ''}</em></button>`).join('')}</div>${only ? '' : '<button class="pb-btn ghost" data-a="cancel">취소</button>'}`;
      if (this.st.phase === 'replace') { c.innerHTML = `<div class="pb-ask">다음 포켓몬을 고르세요</div>${team(true)}`; c.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => this._submit({ t: 'switch', to: +b.dataset.sw })); this._timer(() => this._submit({ t: 'switch', to: sd.mons.findIndex((x, i) => x.hp > 0 && i !== sd.active) })); return; }
      const main = () => {
        c.innerHTML = `<div class="pb-moves">${m.moves.map((mv, i) => { const e = mv.kind === 'status' ? 1 : eff(mv.type, foe.type); return `<button data-mv="${i}" style="--tc:var(--t-${mv.type})" ${m.pp[i] <= 0 ? 'disabled' : ''}><b>${esc(mv.name)}</b><span>${TKR[mv.type]} · ${mv.kind === 'status' ? '변화' : '위력 ' + mv.power}${mv.acc && mv.acc < 100 ? ' · 명중 ' + mv.acc : ''}</span><em>${m.pp[i]}/${mv.pp}</em>${e > 1 ? '<i class="up">상성 ▲</i>' : e < 1 ? '<i class="dn">상성 ▼</i>' : ''}</button>`; }).join('')}</div>
          <div class="pb-acts"><button data-a="sw">교체</button><button data-a="item" ${sd.item > 0 ? '' : 'disabled'}>회복약 ${sd.item}</button><span class="pb-timer"></span></div>`;
        c.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => this._submit({ t: 'move', i: +b.dataset.mv }));
        c.querySelector('[data-a="sw"]').onclick = () => { c.innerHTML = `<div class="pb-ask">누구로 바꿀까요?</div>${team(false)}`; c.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => this._submit({ t: 'switch', to: +b.dataset.sw })); c.querySelector('[data-a="cancel"]').onclick = main; };
        c.querySelector('[data-a="item"]').onclick = () => this._submit({ t: 'item' });
        if (m.pp.every(p => p <= 0)) c.querySelector('.pb-moves').innerHTML = `<button data-mv="-1" style="--tc:var(--t-normal)"><b>${STRUGGLE.name}</b><span>기술을 다 썼다 · 위력 ${STRUGGLE.power}</span></button>`, c.querySelector('[data-mv="-1"]').onclick = () => this._submit({ t: 'move', i: -1 });
      };
      main();
      this._timer(() => this._submit(validate(this.st, this.me, null)));
    },
    _timer(onEnd) {
      if (this.cpu) return; clearInterval(this.tmT); let left = TURN_SEC;
      const tick = () => { const el = this.root && this.root.querySelector('.pb-timer'); if (el) el.textContent = left + '초'; if (left-- <= 0) { clearInterval(this.tmT); onEnd(); } };
      tick(); this.tmT = setInterval(tick, 1000);
    },

    // ----- 그리기·연출 -----
    _drawSide(s) {
      const sd = this.view.side[s], m = sd.mons[sd.active], r = this.root; if (!r) return;
      const card = r.querySelector(`.pb-card[data-s="${s}"]`), mon = r.querySelector(`.pb-mon[data-s="${s}"]`), balls = r.querySelector(`.pb-balls[data-s="${s}"]`);
      if (balls) balls.innerHTML = sd.mons.map(x => `<i class="${x.hp <= 0 ? 'out' : ''}"></i>`).join('');
      if (card) card.innerHTML = `<b>${esc(m.name)} <small>${stars(m.grade)}</small></b>${typeChip(m.type)}${m.status ? `<em class="pb-st ${m.status}">${ST_KR[m.status]}</em>` : ''}
        <i class="pb-hp"><b style="width:${m.hp / m.maxHp * 100}%" class="${m.hp / m.maxHp < 0.25 ? 'red' : m.hp / m.maxHp < 0.5 ? 'yel' : ''}"></b></i>${s === this.me ? `<span class="pb-hpn">${m.hp} / ${m.maxHp}</span>` : ''}
        <span class="pb-stg">${['atk', 'def', 'spd'].filter(k => m.stg[k]).map(k => `${STAT_KR[k]}${m.stg[k] > 0 ? '+' : ''}${m.stg[k]}`).join(' ')}</span>`;
      if (mon && mon.dataset.id !== m.id + ':' + sd.active) { mon.dataset.id = m.id + ':' + sd.active; mon.innerHTML = img(m.id, 'pb-sprite'); mon.classList.remove('faint'); }
      if (mon) mon.classList.toggle('faint', m.hp <= 0);
    },
    _log(t) { const l = this.root && this.root.querySelector('.pb-log'); if (l) l.textContent = t; },
    _who(s) { return s === this.me ? '' : '상대 '; },
    async _play(ev) {
      const fast = document.hidden, W = ms => (fast ? 0 : sleep(ms)), r = this.root; if (!r) return;
      const monEl = s => r.querySelector(`.pb-mon[data-s="${s}"]`);
      const setHp = (s, hp) => { this.view.side[s].mons[this.view.side[s].active].hp = hp; this._drawSide(s); };
      for (const e of ev) {
        if (!this.root) return;
        if (e.t === 'use') { this._log(`${this._who(e.side)}${e.name}의 ${e.move}!`); const el = monEl(e.side); if (e.kind !== 'status' && el) { el.classList.remove('lunge'); void el.offsetWidth; el.classList.add('lunge'); } sfx(e.kind === 'status' ? 'skill' : 'tap'); await W(650); }
        else if (e.t === 'dmg') { const el = monEl(e.side); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); this._pop(el, `-${e.amt}`, e.crit ? 'crit' : ''); } setHp(e.side, e.hp); sfx(e.crit ? 'pull_epic' : 'hit');
          if (e.crit) this._log('급소에 맞았다!'); else if (e.eff > 1) this._log('상성 우세! 큰 피해 (×1.4)'); else if (e.eff < 1) this._log('상성 열세… 피해가 줄었다 (×0.7)'); await W(e.crit || e.eff !== 1 ? 700 : 450); }
        else if (e.t === 'miss') { this._log('빗나갔다!'); await W(550); }
        else if (e.t === 'recoil') { setHp(e.side, e.hp); this._log(`반동으로 ${e.amt} 피해!`); await W(500); }
        else if (e.t === 'status') { this.view.side[e.side].mons[this.view.side[e.side].active].status = e.st; this._drawSide(e.side); this._log(`${this._who(e.side)}${e.name}은(는) ${ST_KR[e.st]} 상태가 됐다!`); sfx('skill'); await W(650); }
        else if (e.t === 'cure') { this.view.side[e.side].mons[this.view.side[e.side].active].status = null; this._drawSide(e.side); this._log(`${this._who(e.side)}${e.name}의 얼음이 녹았다!`); await W(550); }
        else if (e.t === 'cant') { this._log(`${this._who(e.side)}${e.name}은(는) ${e.why}!`); await W(650); }
        else if (e.t === 'stage') { const m = this.view.side[e.side].mons[this.view.side[e.side].active]; m.stg[e.stat] += e.d; this._drawSide(e.side); this._log(e.d === 0 ? `${STAT_KR[e.stat]}이(가) 더 변하지 않는다` : `${this._who(e.side)}${e.name}의 ${STAT_KR[e.stat]} ${e.d > 0 ? '상승 ▲' : '하락 ▼'}${Math.abs(e.d) > 1 ? ' (크게)' : ''}`); await W(550); }
        else if (e.t === 'heal' || e.t === 'item') { setHp(e.side, e.hp); if (e.t === 'item') this.view.side[e.side].mons[this.view.side[e.side].active].status = null, this._drawSide(e.side); if (!e.small) this._log(e.t === 'item' ? `${this._who(e.side)}회복약 사용! ${e.name} 체력 회복` : `${this._who(e.side)}${e.name}의 체력이 회복됐다`); if (!e.small) sfx('buy'); await W(e.small ? 250 : 550); }
        else if (e.t === 'dot') { setHp(e.side, e.hp); this._log(`${this._who(e.side)}${e.name}은(는) ${ST_KR[e.st]} 피해를 입었다`); await W(500); }
        else if (e.t === 'faint') { const el = monEl(e.side); el && el.classList.add('faint'); this._log(`${this._who(e.side)}${e.name}은(는) 쓰러졌다!`); sfx('life_lost'); await W(900); }
        else if (e.t === 'switch') { const sd = this.view.side[e.side]; const prev = sd.mons[sd.active]; prev.stg = { atk: 0, def: 0, spd: 0 }; sd.active = e.idx; this._drawSide(e.side); const el = monEl(e.side); if (el) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
          this._log(e.forced ? `${this._who(e.side)}${e.name}이(가) 끌려나왔다!` : e.side === this.me ? `가랏, ${e.name}!` : `상대는 ${e.name}을(를) 내보냈다!`); sfx('place'); await W(700); }
        else if (e.t === 'msg') { this._log(e.text); await W(450); }
      }
    },
    _pop(el, text, cls) { const p = document.createElement('span'); p.className = 'pb-pop ' + (cls || ''); p.textContent = text; el.appendChild(p); setTimeout(() => p.remove(), 900); },
    _forfeit() { if (!this.st || this.st.winner) return; this.st.winner = foeOf(this.me); if (!this.cpu) this.net.update(this.code, { [`${this.me}.left`]: true }).catch(() => {}); this._result('기권'); },
    _result(why) {
      clearInterval(this.tmT); const w = this.st.winner, win = w === this.me, draw = w === 'draw';
      if (!this.cpu && this.code) this.net.update(this.code, { state: 'ended', winner: w }).catch(() => {});
      sfx(win ? 'record' : draw ? 'wave_clear' : 'gameover');
      const ov = document.createElement('div'); ov.className = 'pb-result';
      ov.innerHTML = `<div class="pb-rbox"><div class="pb-h1 ${win ? 'win' : draw ? '' : 'lose'}">${win ? '승리!' : draw ? '무승부' : '패배'}</div>${why ? `<p class="pb-sub">${esc(why)}</p>` : ''}
        <div class="pb-rteam">${this.st.side[this.me].mons.map(m => `<span class="${m.hp <= 0 ? 'out' : ''}">${img(m.id)}</span>`).join('')}</div>
        ${this.cpu ? '<button class="pb-btn primary" data-a="again">다시 하기</button>' : ''}<button class="pb-btn" data-a="exit">나가기</button></div>`;
      this.root.appendChild(ov);
      ov.querySelector('[data-a="exit"]').onclick = () => { this.close(); };
      const ag = ov.querySelector('[data-a="again"]'); if (ag) ag.onclick = () => { this.st = null; this.openPick(); };
    },
  };
  // 테스트·밸런스 확인용 (콘솔/시뮬에서 사용)
  PB._engine = { TP, statsOf, movesOf, newState, step, cpuChoose, cpuTeam, rngOf, roster, costOf, BUDGET };
})();
