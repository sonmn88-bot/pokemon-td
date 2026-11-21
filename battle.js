// ===== BATTLE.JS - v4.4 포켓몬 배틀 (2인 대전 안의 3:3 턴제 모드) =====
// 이 게임만의 규칙: 모든 포켓몬은 능력치 '총합이 같고'(등급 차이 없음) 모양만 다름(탱커·속공·공격형), 기술은 도감 태그·역할에서 자동 생성.
// 승패는 상성(6속성 순환 1.4/0.7)·기술 특성·교체 판단으로 갈림. 아무 3마리나 고름. 매 턴 기술/교체/회복약 → 교체·약 먼저, 그다음 선제도·스피드 순.
// 트레이너 5명(레드·블루·그린·옐로우·로켓단)은 각자 패시브 1개 + 회복약 1개. 연습 모드: CPU 쉬움·보통·어려움.
// 온라인: 두 사람의 선택을 방 문서(acts)에 쌓고, 양쪽이 같은 시드로 같은 계산(replay)을 해서 결과가 항상 똑같음 (동기화 어긋남 없음)
(function () {
  'use strict';
  const TURN_SEC = 45, HB_MS = 5000;
  const PROF = { H: { hp: 1.12, atk: 1.0, def: 1.12, spd: 0.76 }, N: { hp: 1, atk: 1, def: 1, spd: 1 }, F: { hp: 0.92, atk: 1.16, def: 0.9, spd: 1.3 } }; // 시뮬 4000판: 탱커 57%·속공 44% → 속공은 공격도 높게
  const ROLE = { dealer: { atk: 1.12 }, aoe: {}, control: { def: 1.05, atk: 0.94 }, support: { hp: 1.12, def: 1.08, atk: 0.86 }, execute: { atk: 1.06, spd: 1.05 }, boss: { atk: 1.05, hp: 1.05 } };
  const TKR = { fire: '불꽃', water: '물', electric: '전기', grass: '풀', psychic: '에스퍼', normal: '노말' };
  const ST_KR = { burn: '화상', poison: '독', shock: '감전', freeze: '빙결' };
  const STAT_KR = { atk: '공격', def: '방어', spd: '스피드' };
  // 트레이너 패시브 수치 (CPU끼리 대량 대결로 승률을 맞춤 — 바꾸면 PokeBattle._engine으로 다시 확인)
  const TP = { redCrit: 0.12, blueFresh: 1.4, greenHeal: 0.014, yellowCure: 0.6, yellowDot: 0.5, yellowItems: 2, rocketFx: 1.5, rocketEntry: 1, rocketEntryCh: 0.5 };
  const TRAINERS = {
    red:    { name: '레드',   color: '#e5484d', style: '공격형', desc: `모든 기술의 급소율 +${Math.round(TP.redCrit * 100)}%p` },
    blue:   { name: '블루',   color: '#3b82f6', style: '전략형', desc: `새로 나온 포켓몬의 첫 공격 위력 +${Math.round((TP.blueFresh - 1) * 100)}%` },
    green:  { name: '그린',   color: '#22a06b', style: '회복형', desc: `매 턴 끝에 나와 있는 포켓몬 체력 ${+(TP.greenHeal * 100).toFixed(1)}% 회복` },
    yellow: { name: '옐로우', color: '#f5b400', style: '교감형', desc: `회복약 ${TP.yellowItems}개, 화상·독 피해 절반, 턴 끝마다 상태이상이 ${TP.yellowCure * 100}% 확률로 풀림` },
    rocket: { name: '로켓단', color: '#a1264f', style: '방해형', desc: `상태이상을 걸 확률 ×${TP.rocketFx}, 상대가 새로 내보낸 포켓몬은 ${TP.rocketEntryCh * 100}% 확률로 스피드 -${TP.rocketEntry}` },
  };
  const TR_IDS = Object.keys(TRAINERS);
  // 기술 (이 게임 고유 이름). kind: atk/status, fx: 부가효과
  const BASIC = { fire: ['불씨 돌진', '작열 강타'], water: ['물보라 쏘기', '해일 포격'], electric: ['찌릿 펀치', '낙뢰 강타'], grass: ['잎날 베기', '거목 내려치기'], psychic: ['염동 파동', '정신 붕괴파'], normal: ['박치기 돌격', '전력 돌격'] };
  const TAGMOVE = {
    burn: { name: '불티 흩뿌리기', power: 52, acc: 100, pp: 10, fx: { st: 'burn', ch: 0.5 } },
    poison: { name: '독가루 바람', power: 40, acc: 100, pp: 10, fx: { st: 'poison', ch: 0.5 } },
    slow: { name: '끈끈한 덫', power: 45, acc: 100, pp: 10, fx: { stage: ['spd', -1, 'foe'] } },
    stun: { name: '전류 스파크', power: 45, acc: 100, pp: 10, fx: { st: 'shock', ch: 0.3 } },
    freeze: { name: '냉기 일섬', power: 55, acc: 95, pp: 8, fx: { st: 'freeze', ch: 0.3 } },
    chain: { name: '연속 타격', power: 28, acc: 95, pp: 10, fx: { hits: [2, 4] } },
    multi: { name: '흩뿌리기 사격', power: 65, acc: 90, pp: 10, fx: {} },
    knockback: { name: '날려버리기', power: 40, acc: 100, pp: 8, fx: { force: true } },
    crit: { name: '급소 노리기', power: 62, acc: 100, pp: 10, fx: { crit: 0.35 } },
    pierce: { name: '관통 일격', power: 52, acc: 100, pp: 10, fx: { pierce: true } },
    antiAir: { name: '대공 사격', power: 66, acc: 100, pp: 10, fx: { vsFast: 1.5 } },
    gold: { name: '럭키 펀치', power: 68, acc: 100, pp: 10, fx: { crit: 0.3 } },
    blast: { name: '자폭 돌진', power: 130, acc: 100, pp: 5, fx: { recoil: 0.2 } },
    stack: { name: '기 모으기 타격', power: 50, acc: 100, pp: 10, fx: { stack: 25 } },
    range: { name: '선제 저격', power: 30, acc: 100, pp: 10, pri: 1, fx: {} },
  };
  const ROLEMOVE = {
    dealer: { name: '집중', kind: 'status', pp: 5, fx: { stage: ['atk', 2, 'self'] } },
    aoe: { name: '휩쓸기', power: 50, acc: 100, pp: 10, fx: { stage: ['def', -1, 'foe'] } },
    control: { name: '발묶기', kind: 'status', acc: 100, pp: 10, fx: { stage: ['spd', -2, 'foe'], stage2: ['atk', -1, 'foe'] } },
    support: { name: '응급 처치', kind: 'status', pp: 2, fx: { heal: 0.4 } },
    execute: { name: '마무리 일격', power: 45, acc: 100, pp: 8, fx: { finisher: 0.4 } },
    boss: { name: '끝장 추격', power: 62, acc: 95, pp: 8, fx: { pierce: true } },
  };
  const GUARD = { name: '방어 태세', kind: 'status', pp: 5, fx: { stage: ['def', 2, 'self'] } };
  const STRUGGLE = { name: '안간힘', power: 30, acc: 100, pp: 99, fx: {} };

  // ---------- 데이터 ----------
  const roster = () => Object.values(window.GachaTowerDefs || {}).filter(d => d.no >= 1 && d.no <= 151).sort((a, b) => a.no - b.no);
  const vary = (no, k) => 1 + (((no * k) % 13) - 6) / 100;
  // 모든 포켓몬 능력치 총합 동일 (등급 무관). 프로필·역할·종마다 작은 개성으로 '모양'만 바꾸고 평균 배율이 1이 되게 정규화
  const BASE = { hp: 150, atk: 62, def: 60, spd: 60 };
  function statsOf(d) {
    const P = PROF[d.profile] || PROF.N, R = ROLE[d.role] || {};
    const f = { hp: P.hp * (R.hp || 1) * vary(d.no, 7), atk: P.atk * (R.atk || 1) * vary(d.no, 11), def: P.def * (R.def || 1) * vary(d.no, 5), spd: P.spd * (R.spd || 1) * vary(d.no, 3) };
    const avg = (f.hp + f.atk + f.def + f.spd) / 4;
    const o = {}; for (const k in BASE) o[k] = Math.round(BASE[k] * f[k] / avg); return o;
  }
  const shapeOf = d => ({ H: '탱커형', N: '균형형', F: '속공형' }[d.profile] || '균형형');
  function movesOf(d) {
    const t = d.type, [b1, b2] = BASIC[t] || BASIC.normal, mk = (o, extra) => Object.assign({ type: t, kind: 'atk', acc: 100, fx: {} }, o, extra || {});
    const tag = (d.tags || []).find(x => TAGMOVE[x]);
    return [mk({ name: b1, power: 55, pp: 20 }), mk({ name: b2, power: 85, acc: 85, pp: 8 }), mk(tag ? TAGMOVE[tag] : GUARD), mk(ROLEMOVE[d.role] || GUARD)];
  }

  // ---------- 규칙 엔진 (순수 계산, 같은 입력·시드 → 같은 결과) ----------
  const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const stageMul = s => (s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s));
  const eff = (a, b) => (window.typeEffectiveness ? typeEffectiveness(a, b) : 1);
  function mkMon(id) {
    const d = GachaTowerDefs[id], s = statsOf(d), moves = movesOf(d);
    return { id, name: d.name, type: d.type, grade: d.grade, s, maxHp: s.hp, hp: s.hp, status: null, stT: 0, stg: { atk: 0, def: 0, spd: 0 }, pp: moves.map(m => m.pp), moves, fresh: true, stack: 0 };
  }
  function newState(p1, p2) {
    const side = p => ({ name: p.name || '트레이너', trainer: TRAINERS[p.trainer] ? p.trainer : 'red', mons: (p.team || []).map(mkMon), active: 0, item: p.trainer === 'yellow' ? TP.yellowItems : 1 });
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
      if (st.side[foeOf(s)].trainer === 'rocket' && R() < TP.rocketEntryCh) { m.stg.spd = Math.max(-3, m.stg.spd - TP.rocketEntry); ev.push({ t: 'stage', side: s, name: m.name, stat: 'spd', d: -TP.rocketEntry }); }
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
      const stageFx = ([k, d, who]) => { if (who === 'self') return applyStage(me, s, k, d); const extra = d < 0 && sd.trainer === 'rocket' && R() < TP.rocketFx - 1 ? -1 : 0; applyStage(tg, f, k, d + extra); };
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
          const tr = TRAINERS[sd.trainer] ? sd.trainer : 'red';
          const trMul = tr === 'blue' && me.fresh ? TP.blueFresh : 1;
          const critCh = (fx.crit || 0.0625) + (tr === 'red' ? TP.redCrit : 0), crit = R() < critCh;
          let dmg = power * (atk / def) * 0.45 * stab * e * trMul * (crit ? 1.5 : 1) * (0.9 + R() * 0.1);
          dmg = Math.max(1, Math.round(dmg)); tg.hp = Math.max(0, tg.hp - dmg); done += dmg;
          ev.push({ t: 'dmg', side: f, amt: dmg, hp: tg.hp, max: tg.maxHp, eff: e, crit });
        }
        if (hits > 1) say(`${hits}번 맞혔다!`);
        if (fx.stack) me.stack = Math.min(3, me.stack + 1);
        if (fx.recoil && me.hp > 0) { const r = Math.max(1, Math.round(me.maxHp * fx.recoil)); me.hp = Math.max(0, me.hp - r); ev.push({ t: 'recoil', side: s, amt: r, hp: me.hp, max: me.maxHp }); }
        if (tg.hp > 0 && fx.st && !tg.status && R() < fx.ch * (sd.trainer === 'rocket' ? TP.rocketFx : 1)) applySt(tg, f, fx.st);
        if (tg.hp > 0 && fx.stage) stageFx(fx.stage);
        if (tg.hp > 0 && fx.force) { const others = fsd.mons.map((m, i) => i).filter(i => i !== fsd.active && fsd.mons[i].hp > 0); if (others.length) doSwitch(f, others[Math.floor(R() * others.length)], true); }
      } else {
        if (fx.heal) { const h = Math.round(me.maxHp * fx.heal); me.hp = Math.min(me.maxHp, me.hp + h); ev.push({ t: 'heal', side: s, name: me.name, hp: me.hp, max: me.maxHp }); }
        if (fx.stage) stageFx(fx.stage); if (fx.stage2) stageFx(fx.stage2);
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
      if (m.status === 'burn' || m.status === 'poison') { const d = Math.max(1, Math.round(m.maxHp * (m.status === 'burn' ? 0.06 : 0.1) * (sd.trainer === 'yellow' ? TP.yellowDot : 1))); m.hp = Math.max(0, m.hp - d); ev.push({ t: 'dot', side: s, name: m.name, st: m.status, amt: d, hp: m.hp, max: m.maxHp }); if (m.hp <= 0) { m._fe = 1; ev.push({ t: 'faint', side: s, name: m.name }); } }
      if (m.hp > 0 && sd.trainer === 'green' && m.hp < m.maxHp) { m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * TP.greenHeal)); ev.push({ t: 'heal', side: s, name: m.name, hp: m.hp, max: m.maxHp, small: true }); }
      if (m.hp > 0 && sd.trainer === 'yellow' && m.status && R() < TP.yellowCure) { const k = m.status; m.status = null; ev.push({ t: 'cure', side: s, name: m.name, st: k }); }
    }
    checkWin();
    st.step++;
    if (!st.winner) {
      const need = ['p1', 'p2'].filter(s => act(st.side[s]).hp <= 0 && alive(st.side[s]).length);
      if (need.length) { st.phase = 'replace'; st.need = need; } else { st.phase = 'turn'; st.need = ['p1', 'p2']; }
    } else st.need = [];
    return ev;
  }

  // ---------- CPU (연습 상대): lv 0 쉬움 / 1 보통 / 2 어려움 ----------
  // 어려움: 실제 데미지 식으로 기대 피해를 계산하고, 상대 기술에 약하면 버티는 포켓몬으로 교체
  function expDmg(st, s, me, foe, mv) {
    if (mv.kind === 'status') return 0;
    const sd = st.side[s], hits = mv.fx.hits ? (mv.fx.hits[0] + mv.fx.hits[1]) / 2 : 1;
    let p = mv.power * (mv.fx.finisher && foe.hp / foe.maxHp < mv.fx.finisher ? 2 : 1) * (mv.fx.vsFast && spdOf(foe) > spdOf(me) ? mv.fx.vsFast : 1);
    const atk = me.s.atk * stageMul(me.stg.atk) * (me.status === 'burn' ? 0.8 : 1), def = foe.s.def * (mv.fx.pierce ? 0.75 : stageMul(foe.stg.def));
    const crit = (mv.fx.crit || 0.0625) + (sd.trainer === 'red' ? TP.redCrit : 0);
    return p * hits * (atk / def) * 0.45 * (mv.type === me.type ? 1.2 : 1) * eff(mv.type, foe.type) * (1 + crit * 0.5) * (sd.trainer === 'blue' && me.fresh ? TP.blueFresh : 1) * (mv.acc / 100) * 0.95;
  }
  const bestHit = (st, s, me, foe) => me.moves.reduce((m, mv, i) => (me.pp[i] > 0 ? Math.max(m, expDmg(st, s, me, foe, mv)) : m), 0);
  function cpuChoose(st, s, R, lv = 1) {
    const sd = st.side[s], me = act(sd), f = foeOf(s), foe = act(st.side[f]);
    if (lv >= 2 && st.phase === 'turn') { // 어려움: 확실히 쓰러뜨릴 수 있으면 그 기술(느리면 선제기 우선), 아니면 아래 판단을 덜 흔들리게
      const ko = me.moves.map((m, i) => ({ m, i })).filter(({ m, i }) => me.pp[i] > 0 && m.kind !== 'status' && expDmg(st, s, me, foe, m) / (m.acc / 100) * 0.9 >= foe.hp);
      if (ko.length) { const slow = spdOf(foe) > spdOf(me), pick = (slow && ko.find(x => x.m.pri)) || ko.sort((a, b) => b.m.acc - a.m.acc)[0]; return { t: 'move', i: pick.i }; }
    }
    if (st.phase === 'replace') {
      let best = -1, bv = -1e9;
      sd.mons.forEach((m, i) => { if (m.hp <= 0 || i === sd.active) return;
        const v = lv >= 2 ? bestHit(st, s, m, foe) / foe.hp - bestHit(st, f, foe, m) / m.hp : eff(m.type, foe.type) * 2 - eff(foe.type, m.type) + m.hp / m.maxHp + (lv === 0 ? R() * 3 : 0);
        if (v > bv) { bv = v; best = i; } });
      return { t: 'switch', to: best };
    }
    if (lv === 0 && R() < 0.45) { const ok = me.moves.map((m, i) => i).filter(i => me.pp[i] > 0); return { t: 'move', i: ok[Math.floor(R() * ok.length)] }; }
    if (sd.item > 0 && me.hp / me.maxHp < (lv >= 2 ? 0.35 : 0.3) && R() < 0.75) return { t: 'item' };
    if (lv >= 2) { // 버티기 힘든 상성이면 교체 (상대 최고 기대 피해가 내 남은 체력의 70%+ 이고, 맞받아치기 약할 때)
      const threat = bestHit(st, f, foe, me), mine = bestHit(st, s, me, foe);
      const foeFirst = spdOf(foe) > spdOf(me);
      if (threat >= me.hp * (foeFirst ? 0.8 : 1.1) && mine < foe.hp * 0.5) { // 내가 먼저 못 쓰러뜨리고, 맞으면 쓰러지는 경우만
        let bi = -1, bv = 0; sd.mons.forEach((m, i) => { if (i === sd.active || m.hp <= 0) return; const v = bestHit(st, s, m, foe) / foe.hp - bestHit(st, f, foe, m) / m.hp; if (v > bv) { bv = v; bi = i; } });
        if (bi >= 0 && bv > 0.3 && R() < 0.7) return { t: 'switch', to: bi };
      }
    } else if (eff(foe.type, me.type) > 1 && me.hp / me.maxHp < 0.6 && R() < 0.35) {
      const i = sd.mons.findIndex((m, k) => k !== sd.active && m.hp > m.maxHp * 0.4 && eff(foe.type, m.type) <= 1); if (i >= 0) return { t: 'switch', to: i };
    }
    let best = 0, bv = -1;
    me.moves.forEach((m, i) => {
      if (me.pp[i] <= 0) return; let v;
      if (m.kind === 'status') v = m.fx.heal ? (me.hp / me.maxHp < 0.45 ? 80 : 0) : m.fx.stage ? (m.fx.stage[2] === 'self' ? (me.hp / me.maxHp > 0.7 && me.stg[m.fx.stage[0]] < 2 ? 45 : 3) : (foe.stg[m.fx.stage[0]] > -2 ? 28 : 2)) : 8;
      else v = m.power * eff(m.type, foe.type) * (m.type === me.type ? 1.2 : 1) * (m.acc / 100) * (m.fx.hits ? 3 : 1) * (m.fx.finisher && foe.hp / foe.maxHp < 0.4 ? 2 : 1) * 0.35;
      v *= lv >= 2 ? 0.97 + R() * 0.06 : 0.85 + R() * 0.3; if (v > bv) { bv = v; best = i; }
    });
    return { t: 'move', i: best };
  }
  // CPU 팀: 아무 3마리 (어려움은 서로 다른 타입 3개로 상성 커버)
  // 어려움: 내 팀(foeTeam) 타입을 보고 맞받아치는 타입으로 고름 (나를 이기는 타입 우선, 나에게 지는 타입 피함)
  const cpuTeam = (R, lv = 1, foeTeam) => { const all = roster(), team = [], types = new Set();
    if (lv >= 2 && foeTeam && foeTeam.length) {
      const ft = foeTeam.map(id => GachaTowerDefs[id].type), score = d => ft.reduce((a, t) => a + (eff(d.type, t) - 1) - (eff(t, d.type) - 1), 0) + (d.role === 'support' || d.profile === 'H' ? 0.15 : 0) + R() * 0.5;
      const ranked = all.slice().sort((a, b) => score(b) - score(a));
      for (const d of ranked) { if (team.length >= 3) break; if (types.has(d.type) && team.length < 2) continue; team.push(d.id); types.add(d.type); }
      return team;
    }
    while (team.length < 3) { const d = all[Math.floor(R() * all.length)]; if (team.includes(d.id)) continue; team.push(d.id); types.add(d.type); } return team; };

  // ---------- 화면 ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const img = (id, cls = '') => { const p = window.TowerSpriteImages && window.TowerSpriteImages[id]; /* towers.js의 옛 const와 이름이 같아 window.로 읽음 */ return p ? `<img class="${cls}" src="${p}" alt="" draggable="false">` : `<span class="${cls} pb-noimg">${window.ICON ? ICON(GachaTowerDefs[id].type, 40) : ''}</span>`; };
  const tIcon = (t, n = 16) => (window.ICON ? ICON(t, n) : '');
  const typeChip = t => `<i class="pb-type" style="--tc:var(--t-${t})">${tIcon(t, 13)}${TKR[t]}</i>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sfx = k => { try { window.GameAudio && GameAudio.sfx.play(k); } catch (_) {} };
  // 트레이너 엠블럼 (자체 디자인 SVG: 색 원판 + 모자 실루엣 / 로켓단은 로켓 문양)
  const CAP = '<path d="M15 33c0-10 6-16.5 14-16.5S43 23 43 33z" fill="#fff"/><path d="M11 33.5h36c0 3.2-2.6 5-5.8 5H14.6c-2.4 0-3.6-2.1-3.6-5z" fill="#fff" opacity=".86"/><path d="M29 16.5c-2.5 3.2-3.3 9-3.3 16.5" stroke="var(--tc)" stroke-width="2.2" fill="none" opacity=".55"/>';
  const ROCKET = '<path d="M29 9c7.5 5.5 10.5 14 10.5 23l-4 6.5h-13l-4-6.5C18.5 23 21.5 14.5 29 9z" fill="#fff"/><circle cx="29" cy="24" r="4.2" fill="var(--tc)"/><path d="M22.5 37.5 16 46l8.5-3.6zm13 0L42 46l-8.5-3.6z" fill="#fff" opacity=".86"/>';
  const emblem = (id, size = 48) => { const T = TRAINERS[id] || TRAINERS.red;
    return `<svg class="pb-emb" width="${size}" height="${size}" viewBox="0 0 58 58" style="--tc:${T.color}" aria-hidden="true"><defs><radialGradient id="g-${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs><circle cx="29" cy="29" r="27" fill="${T.color}"/><circle cx="29" cy="29" r="27" fill="url(#g-${id})"/><circle cx="29" cy="29" r="25.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>${id === 'rocket' ? ROCKET : CAP}</svg>`; };
  const LV_KR = ['쉬움', '보통', '어려움'];
  const STAT_LBL = { hp: '체력', atk: '공격', def: '방어', spd: '스피드' };

  const PB = window.PokeBattle = {
    root: null, net: null, code: null, me: 'p1', room: null, unsub: null, st: null, seed: 1, cpu: false, cpuLv: 1, busy: false, hbT: null, tmT: null,

    _root() { document.getElementById('pb-root')?.remove(); const r = document.createElement('div'); r.id = 'pb-root'; document.body.appendChild(r); this.root = r; return r; },
    close() {
      this.unsub && this.unsub(); this.unsub = null; clearInterval(this.hbT); clearInterval(this.tmT);
      if (this.code && this.net && !this.cpu) this.net.update(this.code, { [`${this.me}.left`]: true }).catch(() => {});
      this.root && this.root.remove(); this.root = null; this.code = null; this.room = null; this.st = null;
    },
    myName() { try { return localStorage.getItem('pokemontd_vsname') || '트레이너'; } catch (_) { return '트레이너'; } },
    _pref(k, v) { try { if (v === undefined) return localStorage.getItem('pokemontd_pb_' + k); localStorage.setItem('pokemontd_pb_' + k, v); } catch (_) { return null; } },

    // ----- 메뉴 -----
    openMenu() {
      const r = this._root();
      r.innerHTML = `<div class="pb-menu">
        <div class="pb-hero">${['red', 'blue', 'green', 'yellow', 'rocket'].map((id, i) => `<span style="--i:${i}">${emblem(id, 46)}</span>`).join('')}</div>
        <div class="pb-h1">포켓몬 배틀</div>
        <p class="pb-sub">151마리 모두 같은 힘. 상성과 기술, 교체 타이밍으로 이기는 3:3 턴제 대결</p>
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
        try { await this.net.create(code, { code, kind: 'battle', state: 'pick', created: Date.now(), seed: (Math.random() * 1e9) >>> 0, p1: { name: this.myName(), hb: Date.now(), ready: false }, p2: null, acts: {} });
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

    // ----- 팀 고르기 (격투게임식 얼굴 격자) -----
    openPick() {
      const r = this._root(), all = roster();
      let team = [], trainer = TRAINERS[this._pref('trainer')] ? this._pref('trainer') : 'red', filter = 'all', focus = all[0].id, ready = false;
      this.cpuLv = Math.max(0, Math.min(2, +(this._pref('lv') ?? 1)));
      const render = () => {
        const d = GachaTowerDefs[focus], s = statsOf(d), mv = movesOf(d), max = { hp: 200, atk: 85, def: 85, spd: 85 }, T = TRAINERS[trainer];
        r.innerHTML = `<div class="pb-pick">
          <header class="pb-top"><button class="pb-x" data-a="back" aria-label="뒤로">${window.ICON ? ICON('back', 20) : '‹'}</button><b>${this.cpu ? '연습 모드' : '방 ' + this.code}</b><span class="pb-count">${team.length}/3</span></header>
          <div class="pb-trainers" role="radiogroup" aria-label="트레이너">${TR_IDS.map(id => `<button role="radio" aria-checked="${trainer === id}" data-tr="${id}" class="${trainer === id ? 'on' : ''}" style="--tc:${TRAINERS[id].color}" ${ready ? 'disabled' : ''}>${emblem(id, 34)}<b>${TRAINERS[id].name}</b><small>${TRAINERS[id].style}</small></button>`).join('')}</div>
          <p class="pb-trdesc" style="--tc:${T.color}"><b>${T.name}</b> ${T.desc}${trainer === "yellow" ? "" : ". 회복약 1개"}</p>
          <div class="pb-team">${[0, 1, 2].map(i => { const id = team[i]; return id ? `<button class="pb-slot" data-rm="${i}" aria-label="${esc(GachaTowerDefs[id].name)} 빼기" style="--tc:var(--t-${GachaTowerDefs[id].type})">${img(id)}<span>${esc(GachaTowerDefs[id].name)}</span>${i === 0 ? '<i>선봉</i>' : ''}</button>` : `<div class="pb-slot empty">${i === 0 ? '선봉' : '빈 자리'}</div>`; }).join('')}</div>
          <section class="pb-detail" style="--tc:var(--t-${d.type})">${img(d.id, 'pb-dimg')}<div class="pb-dinfo"><div class="pb-dname"><b>${esc(d.name)}</b>${typeChip(d.type)}<span class="pb-shape">${shapeOf(d)}</span></div>
            <div class="pb-stats">${['hp', 'atk', 'def', 'spd'].map(k => `<div><span>${STAT_LBL[k]}</span><i><b style="width:${Math.min(100, s[k] / max[k] * 100)}%"></b></i><em>${s[k]}</em></div>`).join('')}</div>
            <div class="pb-mvs">${mv.map(m => `<span style="--tc:var(--t-${m.type})" title="${esc(this._moveDesc(m))}">${esc(m.name)}<small>${m.kind === 'status' ? '변화' : m.power}</small></span>`).join('')}</div></div></section>
          <nav class="pb-filter" aria-label="타입 거르기">${['all', 'fire', 'water', 'electric', 'grass', 'psychic', 'normal'].map(t => `<button data-f="${t}" class="${filter === t ? 'on' : ''}" ${t !== 'all' ? `style="--tc:var(--t-${t})"` : ''}>${t === 'all' ? '전체' : tIcon(t, 15) + TKR[t]}</button>`).join('')}</nav>
          <div class="pb-grid">${all.filter(x => filter === 'all' || x.type === filter).map(x => { const inT = team.includes(x.id), full = !inT && team.length >= 3;
            return `<button class="pb-face ${inT ? 'in' : ''} ${focus === x.id ? 'focus' : ''} ${full ? 'full' : ''}" data-id="${x.id}" style="--tc:var(--t-${x.type})" aria-label="${esc(x.name)}">${img(x.id)}<span>${esc(x.name)}</span>${inT ? `<i>${team.indexOf(x.id) + 1}</i>` : ''}</button>`; }).join('')}</div>
          <footer class="pb-bottom">${this.cpu ? `<div class="pb-lv" role="radiogroup" aria-label="CPU 난이도">${LV_KR.map((t, i) => `<button role="radio" aria-checked="${this.cpuLv === i}" data-lv="${i}" class="${this.cpuLv === i ? 'on' : ''}">${t}</button>`).join('')}</div>` : `<span class="pb-wait">${this._pickWaitText(ready)}</span>`}
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
          if (this.cpu) { this.seed = (Math.random() * 1e9) >>> 0; const R = rngOf(this.seed ^ 77); this.startBattle({ name: this.myName(), trainer, team }, { name: `CPU · ${LV_KR[this.cpuLv]}`, trainer: TR_IDS[Math.floor(R() * TR_IDS.length)], team: cpuTeam(R, this.cpuLv, team) }); return; }
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
          const w = this.root && this.root.querySelector('.pb-wait'); if (w) w.textContent = this._pickWaitText(d[this.me] && d[this.me].ready);
        });
        clearInterval(this.hbT); this.hbT = setInterval(() => this.code && this.net.update(this.code, { [`${this.me}.hb`]: Date.now() }).catch(() => {}), HB_MS);
      }
    },
    _pickWaitText(ready) {
      const o = this.room && this.room[this.me === 'p1' ? 'p2' : 'p1'];
      return !o ? `코드 ${this.code}를 친구에게 알려주세요` : o.ready ? `상대(${esc(o.name)}) 준비 완료` : `상대(${esc(o.name)})가 팀을 고르는 중`;
    },
    _moveDesc(m) {
      const f = m.fx || {}, o = [];
      if (m.kind !== 'status') o.push(`위력 ${m.power}`); if (m.acc && m.acc < 100) o.push(`명중 ${m.acc}`); if (m.pri) o.push('먼저 공격');
      if (f.st) o.push(`${Math.round(f.ch * 100)}% ${ST_KR[f.st]}`); if (f.stage) o.push(`${f.stage[2] === 'self' ? '내' : '상대'} ${STAT_KR[f.stage[0]]} ${f.stage[1] > 0 ? '+' : ''}${f.stage[1]}`);
      if (f.hits) o.push(`${f.hits[0]}~${f.hits[1]}회 공격`); if (f.crit) o.push(`급소율 ${Math.round(f.crit * 100)}%`); if (f.pierce) o.push('방어 무시');
      if (f.force) o.push('상대 강제 교체'); if (f.recoil) o.push(`반동 ${f.recoil * 100}%`); if (f.stack) o.push('쓸수록 위력 상승'); if (f.heal) o.push(`체력 ${f.heal * 100}% 회복`);
      if (f.finisher) o.push(`상대 체력 ${f.finisher * 100}% 미만이면 위력 2배`); if (f.vsFast) o.push('나보다 빠른 상대에게 강함');
      return o.join(', ');
    },

    // ----- 배틀 -----
    startBattle(p1, p2, seed) {
      if (seed) this.seed = seed;
      this.st = newState(p1, p2); this.view = JSON.parse(JSON.stringify(this.st)); this.busy = false; this.acts = {}; this._sent = {};
      const r = this._root(), foe = foeOf(this.me), F = this.st.side[foe], M = this.st.side[this.me];
      r.innerHTML = `<div class="pb-battle">
        <div class="pb-bar foe"><span class="pb-balls" data-s="${foe}"></span><b>${esc(F.name)}</b>${emblem(F.trainer, 28)}</div>
        <div class="pb-field">
          <div class="pb-plat foe"></div><div class="pb-plat me"></div>
          <div class="pb-card foe" data-s="${foe}"></div><div class="pb-mon foe" data-s="${foe}"></div>
          <div class="pb-mon me" data-s="${this.me}"></div><div class="pb-card me" data-s="${this.me}"></div>
        </div>
        <div class="pb-bar me">${emblem(M.trainer, 28)}<b>${esc(M.name)}</b><span class="pb-balls" data-s="${this.me}"></span><button class="pb-ff" data-a="ff">기권</button></div>
        <div class="pb-log" aria-live="polite">대결 시작!</div>
        <div class="pb-cmd"></div></div>`;
      r.querySelector('[data-a="ff"]').onclick = () => { if (confirm('기권하면 바로 패배해요. 기권할까요?')) this._forfeit(); };
      ['p1', 'p2'].forEach(s => this._drawSide(s));
      this._intro(M, F);
      if (!this.cpu) {
        this.unsub && this.unsub();
        this.unsub = this.net.listen(this.code, d => { if (d) { this.room = d; this._pump(); } });
        clearInterval(this.hbT); this.hbT = setInterval(() => this.code && this.net.update(this.code, { [`${this.me}.hb`]: Date.now() }).catch(() => {}), HB_MS);
      }
      setTimeout(() => this._pump(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 1900);
    },
    // 시작 연출 (이 모드의 단 하나의 큰 연출): 두 트레이너 카드가 양쪽에서 들어와 VS
    _intro(M, F) {
      const ov = document.createElement('div'); ov.className = 'pb-intro';
      const card = (sd, side) => `<div class="pb-ic ${side}" style="--tc:${TRAINERS[sd.trainer].color}">${emblem(sd.trainer, 64)}<div><b>${esc(sd.name)}</b><small>${TRAINERS[sd.trainer].name} · ${TRAINERS[sd.trainer].style}</small><span>${sd.mons.map(m => img(m.id)).join('')}</span></div></div>`;
      ov.innerHTML = `${card(F, 'foe')}<div class="pb-vs">VS</div>${card(M, 'me')}`;
      this.root.appendChild(ov); sfx('wave_start');
      setTimeout(() => ov.classList.add('out'), 1500); setTimeout(() => ov.remove(), 1850);
    },
    _actsFor(stepNo) { return this.cpu ? (this.acts[stepNo] || {}) : ((this.room && this.room.acts && this.room.acts[stepNo]) || {}); },
    async _pump() {
      if (this.busy || !this.st) return; this.busy = true;
      try {
        for (;;) {
          if (this.st.winner) { this._result(); break; }
          const a = this._actsFor(this.st.step);
          if (this.cpu) for (const s of this.st.need) if (s !== this.me && !a[s]) { a[s] = cpuChoose(this.st, s, rngOf((this.seed + this.st.step * 7919) >>> 0), this.cpuLv); this.acts[this.st.step] = a; }
          if (!this.cpu) { const o = this.room && this.room[foeOf(this.me)]; if (o && (o.left || (o.hb && Date.now() - o.hb > 40000))) { this.st.winner = this.me; this._result('상대가 대결을 나갔어요'); break; } }
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
      this.root.querySelector('.pb-cmd').innerHTML = this.cpu ? '' : '<div class="pb-wait2">상대의 선택을 기다리는 중</div>';
      if (this.cpu) { (this.acts[no] = this.acts[no] || {})[this.me] = action; this._pump(); }
      else this.net.update(this.code, { [`acts.${no}.${this.me}`]: action }).catch(() => { this._sent[no] = false; this._askInput(); });
    },
    _waitInput() { const c = this.root.querySelector('.pb-cmd'); if (c) c.innerHTML = `<div class="pb-wait2">${this.st.phase === 'replace' ? '상대가 다음 포켓몬을 고르는 중' : '상대의 선택을 기다리는 중'}</div>`; },
    _askInput() {
      const c = this.root.querySelector('.pb-cmd'), sd = this.st.side[this.me], m = act(sd), foe = act(this.st.side[foeOf(this.me)]);
      const team = only => `<div class="pb-swl">${sd.mons.map((x, i) => { const e = eff(foe.type, x.type); return `<button data-sw="${i}" ${x.hp <= 0 || i === sd.active ? 'disabled' : ''}>${img(x.id)}<span>${esc(x.name)} ${typeChip(x.type)}${x.hp > 0 && i !== sd.active ? (e > 1 ? '<em class="pb-risk dn">상대에게 약함</em>' : e < 1 ? '<em class="pb-risk up">상대에게 강함</em>' : '') : ''}</span><i class="pb-hpbar"><b style="width:${x.hp / x.maxHp * 100}%"></b></i><small>${x.hp <= 0 ? '기절' : i === sd.active ? '싸우는 중' : `${x.hp}/${x.maxHp}${x.status ? ' · ' + ST_KR[x.status] : ''}`}</small></button>`; }).join('')}</div>${only ? '' : '<button class="pb-btn ghost" data-a="cancel">돌아가기</button>'}`;
      if (this.st.phase === 'replace') { c.innerHTML = `<div class="pb-ask">다음에 내보낼 포켓몬</div>${team(true)}`; c.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => this._submit({ t: 'switch', to: +b.dataset.sw })); this._timer(() => this._submit({ t: 'switch', to: sd.mons.findIndex((x, i) => x.hp > 0 && i !== sd.active) })); return; }
      const main = () => {
        const moves = m.pp.every(p => p <= 0) ? `<button data-mv="-1" style="--tc:var(--t-normal)"><b>${STRUGGLE.name}</b><span>기술을 모두 써서 마지막 힘을 짜낸다</span></button>`
          : m.moves.map((mv, i) => { const e = mv.kind === 'status' ? 1 : eff(mv.type, foe.type); return `<button data-mv="${i}" style="--tc:var(--t-${mv.type})" ${m.pp[i] <= 0 ? 'disabled' : ''} title="${esc(this._moveDesc(mv))}"><b>${tIcon(mv.type, 16)}${esc(mv.name)}</b><span>${esc(this._moveDesc(mv)) || '부가효과 없음'}</span><em>${m.pp[i]}/${mv.pp}</em>${e > 1 ? '<i class="up">효과 큼</i>' : e < 1 ? '<i class="dn">효과 약함</i>' : ''}</button>`; }).join('');
        c.innerHTML = `<div class="pb-moves">${moves}</div><div class="pb-acts"><button data-a="sw">교체</button><button data-a="item" ${sd.item > 0 ? '' : 'disabled'}>회복약 ${sd.item}</button>${this.cpu ? '' : '<span class="pb-timer" aria-label="남은 시간"></span>'}</div>`;
        c.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => this._submit({ t: 'move', i: +b.dataset.mv }));
        c.querySelector('[data-a="sw"]').onclick = () => { c.innerHTML = `<div class="pb-ask">누구로 바꿀까요?</div>${team(false)}`; c.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => this._submit({ t: 'switch', to: +b.dataset.sw })); c.querySelector('[data-a="cancel"]').onclick = main; };
        c.querySelector('[data-a="item"]').onclick = () => this._submit({ t: 'item' });
      };
      main();
      this._timer(() => this._submit(validate(this.st, this.me, null)));
    },
    _timer(onEnd) {
      if (this.cpu) return; clearInterval(this.tmT); let left = TURN_SEC;
      const tick = () => { const el = this.root && this.root.querySelector('.pb-timer'); if (el) { el.textContent = left; el.classList.toggle('low', left <= 10); } if (left-- <= 0) { clearInterval(this.tmT); onEnd(); } };
      tick(); this.tmT = setInterval(tick, 1000);
    },

    // ----- 그리기·연출 -----
    _drawSide(s) {
      const sd = this.view.side[s], m = sd.mons[sd.active], r = this.root; if (!r) return;
      const card = r.querySelector(`.pb-card[data-s="${s}"]`), mon = r.querySelector(`.pb-mon[data-s="${s}"]`), balls = r.querySelector(`.pb-balls[data-s="${s}"]`);
      if (balls) balls.innerHTML = sd.mons.map(x => `<i class="${x.hp <= 0 ? 'out' : ''}" title="${esc(x.name)}"></i>`).join('');
      const pct = m.hp / m.maxHp;
      if (card) card.innerHTML = `<div class="pb-cname"><b>${esc(m.name)}</b>${tIcon(m.type, 18)}${m.status ? `<em class="pb-st ${m.status}">${ST_KR[m.status]}</em>` : ''}</div>
        <div class="pb-hprow"><span>HP</span><i class="pb-hp"><b style="width:${pct * 100}%" class="${pct < 0.25 ? 'red' : pct < 0.5 ? 'yel' : ''}"></b></i></div>${s === this.me ? `<span class="pb-hpn">${m.hp} / ${m.maxHp}</span>` : ''}
        <span class="pb-stg">${['atk', 'def', 'spd'].filter(k => m.stg[k]).map(k => `<i class="${m.stg[k] > 0 ? 'up' : 'dn'}">${STAT_KR[k]} ${m.stg[k] > 0 ? '+' : ''}${m.stg[k]}</i>`).join('')}</span>`;
      if (mon && mon.dataset.id !== m.id + ':' + sd.active) { mon.dataset.id = m.id + ':' + sd.active; mon.innerHTML = img(m.id, 'pb-sprite'); mon.classList.remove('faint'); }
      if (mon) mon.classList.toggle('faint', m.hp <= 0);
    },
    _log(t) { const l = this.root && this.root.querySelector('.pb-log'); if (l) l.textContent = t; },
    _who(s) { return s === this.me ? '' : '상대 '; },
    async _play(ev) {
      const fast = document.hidden, W = ms => (fast ? 0 : sleep(ms)), r = this.root; if (!r) return;
      const monEl = s => r.querySelector(`.pb-mon[data-s="${s}"]`);
      const cur = s => this.view.side[s].mons[this.view.side[s].active];
      const setHp = (s, hp) => { cur(s).hp = hp; this._drawSide(s); };
      const anim = (s, k) => { const el = monEl(s); if (el) { el.classList.remove(k); void el.offsetWidth; el.classList.add(k); } return el; };
      for (const e of ev) {
        if (!this.root) return;
        if (e.t === 'use') { this._log(`${this._who(e.side)}${e.name}의 ${e.move}!`); if (e.kind !== 'status') anim(e.side, 'lunge'); else anim(e.side, 'charge'); sfx(e.kind === 'status' ? 'skill' : 'tap'); await W(650); }
        else if (e.t === 'dmg') { const el = anim(e.side, 'hit'); if (el) this._pop(el, `-${e.amt}`, e.crit ? 'crit' : e.eff > 1 ? 'big' : ''); setHp(e.side, e.hp); sfx(e.crit ? 'pull_epic' : 'hit');
          if (e.crit) this._log('급소에 맞았다!'); else if (e.eff > 1) this._log('상성이 좋다! 큰 피해 (×1.4)'); else if (e.eff < 1) this._log('상성이 나쁘다… 피해가 줄었다 (×0.7)'); await W(e.crit || e.eff !== 1 ? 750 : 450); }
        else if (e.t === 'miss') { this._log('빗나갔다!'); await W(550); }
        else if (e.t === 'recoil') { setHp(e.side, e.hp); this._log(`반동으로 ${e.amt} 피해를 입었다`); await W(500); }
        else if (e.t === 'status') { cur(e.side).status = e.st; this._drawSide(e.side); anim(e.side, 'st-' + e.st); this._log(`${this._who(e.side)}${e.name}은(는) ${ST_KR[e.st]} 상태가 됐다!`); sfx('skill'); await W(650); }
        else if (e.t === 'cure') { cur(e.side).status = null; this._drawSide(e.side); this._log(e.st === 'freeze' ? `${this._who(e.side)}${e.name}의 얼음이 녹았다!` : `${this._who(e.side)}${e.name}의 ${ST_KR[e.st]}이(가) 나았다!`); await W(550); }
        else if (e.t === 'cant') { this._log(`${this._who(e.side)}${e.name}은(는) ${e.why}!`); await W(650); }
        else if (e.t === 'stage') { cur(e.side).stg[e.stat] += e.d; this._drawSide(e.side); if (e.d) anim(e.side, e.d > 0 ? 'buff' : 'debuff'); this._log(e.d === 0 ? `${STAT_KR[e.stat]}은(는) 더 변하지 않는다` : `${this._who(e.side)}${e.name}의 ${STAT_KR[e.stat]} ${e.d > 0 ? '상승' : '하락'}${Math.abs(e.d) > 1 ? ' (크게)' : ''}`); await W(550); }
        else if (e.t === 'heal' || e.t === 'item') { if (e.t === 'item') cur(e.side).status = null; setHp(e.side, e.hp); if (!e.small) { anim(e.side, 'buff'); this._log(e.t === 'item' ? `${this._who(e.side)}회복약 사용! ${e.name}의 체력이 회복됐다` : `${this._who(e.side)}${e.name}의 체력이 회복됐다`); sfx('buy'); } await W(e.small ? 250 : 550); }
        else if (e.t === 'dot') { setHp(e.side, e.hp); anim(e.side, 'hit'); this._log(`${this._who(e.side)}${e.name}은(는) ${ST_KR[e.st]} 때문에 피해를 입었다`); await W(500); }
        else if (e.t === 'faint') { const el = monEl(e.side); el && el.classList.add('faint'); this._log(`${this._who(e.side)}${e.name}은(는) 쓰러졌다!`); sfx('life_lost'); await W(900); }
        else if (e.t === 'switch') { const sd = this.view.side[e.side]; sd.mons[sd.active].stg = { atk: 0, def: 0, spd: 0 }; sd.active = e.idx; this._drawSide(e.side); anim(e.side, 'enter');
          this._log(e.forced ? `${this._who(e.side)}${e.name}이(가) 끌려 나왔다!` : e.side === this.me ? `가라, ${e.name}!` : `상대가 ${e.name}을(를) 내보냈다!`); sfx('place'); await W(700); }
        else if (e.t === 'msg') { this._log(e.text); await W(450); }
      }
    },
    _pop(el, text, cls) { const p = document.createElement('span'); p.className = 'pb-pop ' + (cls || ''); p.textContent = text; el.appendChild(p); setTimeout(() => p.remove(), 900); },
    _forfeit() { if (!this.st || this.st.winner) return; this.st.winner = foeOf(this.me); if (!this.cpu) this.net.update(this.code, { [`${this.me}.left`]: true }).catch(() => {}); this._result('기권했어요'); },
    _result(why) {
      clearInterval(this.tmT); const w = this.st.winner, win = w === this.me, draw = w === 'draw';
      if (!this.cpu && this.code) this.net.update(this.code, { state: 'ended', winner: w }).catch(() => {});
      sfx(win ? 'record' : draw ? 'wave_clear' : 'gameover');
      const M = this.st.side[this.me], left = M.mons.filter(m => m.hp > 0).length;
      const ov = document.createElement('div'); ov.className = 'pb-result';
      ov.innerHTML = `<div class="pb-rbox" style="--tc:${TRAINERS[M.trainer].color}">${emblem(M.trainer, 72)}<div class="pb-h1 ${win ? 'win' : draw ? '' : 'lose'}">${win ? '승리' : draw ? '무승부' : '패배'}</div>
        <p class="pb-sub">${why ? esc(why) : win ? `${left}마리가 남아 이겼어요` : '다음엔 상성이 좋은 포켓몬으로 교체해 보세요'}</p>
        <div class="pb-rteam">${M.mons.map(m => `<span class="${m.hp <= 0 ? 'out' : ''}">${img(m.id)}</span>`).join('')}</div>
        ${this.cpu ? '<button class="pb-btn primary" data-a="again">같은 팀으로 다시</button><button class="pb-btn" data-a="pick">팀 다시 고르기</button>' : ''}<button class="pb-btn ghost" data-a="exit">나가기</button></div>`;
      this.root.appendChild(ov);
      ov.querySelector('[data-a="exit"]').onclick = () => this.close();
      const ag = ov.querySelector('[data-a="again"]'); if (ag) ag.onclick = () => { const s = this.st.side; const me = { name: s.p1.name, trainer: s.p1.trainer, team: s.p1.mons.map(m => m.id) }; this.seed = (Math.random() * 1e9) >>> 0; const R = rngOf(this.seed ^ 77); this.startBattle(me, { name: `CPU · ${LV_KR[this.cpuLv]}`, trainer: TR_IDS[Math.floor(R() * TR_IDS.length)], team: cpuTeam(R, this.cpuLv, me.team) }); };
      const pk = ov.querySelector('[data-a="pick"]'); if (pk) pk.onclick = () => { this.st = null; this.openPick(); };
    },
  };
  // 테스트·밸런스 확인용 (콘솔/시뮬에서 사용)
  PB._engine = { TP, TRAINERS, statsOf, movesOf, newState, step, cpuChoose, cpuTeam, rngOf, roster };
})();
