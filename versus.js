// ===== VERSUS.JS — v3.16 2인 대전 =====
// 구조: 각자 자기 폰에서 원래 게임을 그대로 돌리고(몹 위치 동기화 X → 렉·끊김에 강함),
//   방 문서 하나로 ① 대기실(준비·동시 시작) ② 2초마다 서로의 요약(웨이브·처치·목숨·필드) ③ 보낸 몬스터 누적 수를 주고받음.
// 견제: 처치 25마리마다 자동으로 상대에게 3마리 + 상점 '몬스터 보내기'(쫄몹·엘리트·미니보스).
// 승패: 목숨이 먼저 0이 되는 쪽이 패배, 상대가 20초 이상 응답 없으면 자동 승리.
// 전송: Firestore 컬렉션 pokemontd_rooms (콘솔 규칙에서 이 컬렉션 읽기·쓰기 허용 필요)
//   테스트용: 주소에 ?vslocal=1 이면 같은 기기 두 창끼리 BroadcastChannel로 연결
(function () {
  const COL = 'pokemontd_rooms', SYNC_MS = 2000, LOST_MS = 20000, SPAWN_GAP = 380;
  // v3.16 공정 대전: 같은 시드(웨이브·특성 동일) + 공용 웨이브 시계(배속·스킵 잠금) + 30웨이브 결승 + 25웨이브부터 서든데스
  // v3.18: 70웨이브까지 공용 시계 → 이후 '결전': 웨이브 없이 몹이 한 마리씩 끝없이(점점 빠르고 강하게), 골드 더 — 먼저 무너지는 쪽이 패배
  const WAVE_SEC = 60, FINAL_WAVE = 70, SUDDEN = 60;
  const ENDLESS_HP = T => Math.pow(1.07, T / 10), ENDLESS_GAP = T => Math.max(0.3, 1.1 - T / 500), ENDLESS_CARD = 120;
  const inc = w => 95 + 4 * w + 0.15 * w * w;                  // 웨이브당 골드 수입 추정치(처치+클리어+이자 측정값에 맞춘 식)
  const sudden = w => w >= SUDDEN;

  // ---------- 전송 계층 ----------
  const setPath = (obj, path, val) => { const ks = path.split('.'); let o = obj; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] = o[ks[i]] && typeof o[ks[i]] === 'object' ? o[ks[i]] : {}; o[ks[ks.length - 1]] = val; };
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  function makeNet() {
    const local = /[?&]vslocal=1/.test(location.search) || !(window.firebase && firebase.firestore && firebase.apps && firebase.apps.length);
    if (!local) {
      const db = firebase.firestore(), ref = c => db.collection(COL).doc(c), FV = firebase.firestore.FieldValue;
      return {
        kind: 'firestore',
        create: (c, d) => ref(c).set(d),
        get: async c => { const s = await ref(c).get(); return s.exists ? s.data() : null; },
        update: (c, set, inc) => { const p = { ...set }; for (const k in inc || {}) p[k] = FV.increment(inc[k]); return ref(c).update(p); },
        listen: (c, cb) => ref(c).onSnapshot(s => s.exists && cb(s.data()), err => cb(null, err)),
        remove: c => ref(c).delete().catch(() => {}),
      };
    }
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('pokemontd_vs') : null, subs = {};
    const read = c => { try { return JSON.parse(localStorage.getItem('vsroom_' + c)); } catch (_) { return null; } };
    const write = (c, d) => { localStorage.setItem('vsroom_' + c, JSON.stringify(d)); bc && bc.postMessage(c); (subs[c] || []).forEach(f => f(d)); };
    if (bc) bc.onmessage = ev => { const d = read(ev.data); if (d) (subs[ev.data] || []).forEach(f => f(d)); };
    return {
      kind: 'local',
      create: async (c, d) => write(c, d),
      get: async c => read(c),
      update: (c, set, inc) => {                                                       // 두 창이 동시에 고쳐도 덮어쓰지 않게 잠금
        const run = () => { const d = read(c); if (!d) throw new Error('no room'); for (const k in set || {}) setPath(d, k, set[k]); for (const k in inc || {}) setPath(d, k, (getPath(d, k) || 0) + inc[k]); write(c, d); };
        return navigator.locks ? navigator.locks.request('vsroom_' + c, async () => run()) : Promise.resolve().then(run);
      },
      listen: (c, cb) => { (subs[c] = subs[c] || []).push(cb); const d = read(c); if (d) setTimeout(() => cb(d), 0); return () => { subs[c] = subs[c].filter(f => f !== cb); }; },
      remove: async c => localStorage.removeItem('vsroom_' + c),
    };
  }

  // 상점에 대전 중에만 붙는 '몬스터 보내기'
  // 가격 = 그 웨이브 수입의 몇 배 (서든데스엔 반값·2배 수량). 받은 쪽은 잡으면 현상금(가격의 일부)을 받음
  const VS_ITEMS = [
    { key: 'vs_small', icon: 'sword', name: '몬스터 보내기 ×8', mul: 0.6, bounty: 0.3, desc: '상대 필드에 이번 웨이브 몬스터 8마리', vs: 'small', n: 8 },
    { key: 'vs_elite', icon: 'sword', name: '엘리트 보내기 ×3', mul: 1.2, bounty: 0.4, desc: '상대에게 황금 엘리트 3마리 (체력 2.2배·빠름)', vs: 'elite', n: 3 },
    { key: 'vs_boss', icon: 'crown', name: '미니보스 보내기', mul: 3, bounty: 0.4, perWave: 1, desc: '상대에게 미니보스 1마리 (웨이브당 1회)', vs: 'boss', n: 1 },
  ];
  const itemCost = (it, w) => Math.round(it.mul * inc(w) * 1.4 * (sudden(w) ? 0.5 : 1) / 5) * 5; // ×1.4 = 대전 수입 배율(1.6)에 맞춤
  const AUTO = w => (3 + Math.floor(w / 5)) * (sudden(w) ? 2 : 1); // 웨이브를 시간 안에 다 잡으면 자동으로 보내는 수

  const HEROES = [['pikachu', '피카츄'], ['togepi', '토게피'], ['eevee', '이브이']], STARTERS = [['bulbasaur', '이상해씨'], ['charmander', '파이리'], ['squirtle', '꼬부기']];
  const heroImg = id => `<img src="assets/heroes/${id}.png" alt="">`;
  const starterImg = id => (window.GachaTowerDefs && GachaTowerDefs[id] && window.PKM) ? PKM(GachaTowerDefs[id], 26) : '';

  const VS = window.Versus = {
    net: null, code: null, me: null, opp: null, room: null, unsub: null, active: false,
    kills: 0, sentAuto: 0, recv: { small: 0, elite: 0, boss: 0 }, pending: [], timer: null, spawnTimer: null, ended: false,

    // ---------- 로비 UI ----------
    openMenu() {
      const app = window.app; if (!app) return;
      this.net = this.net || makeNet();
      document.querySelector('.vs-overlay')?.remove();
      const ov = document.createElement('div'); ov.className = 'vs-overlay';
      const name = (() => { try { return localStorage.getItem('pokemontd_vsname') || ''; } catch (_) { return ''; } })();
      ov.innerHTML = `<div class="vs-box"><div class="vs-title">2인 대전</div>
        <input class="vs-name" maxlength="10" placeholder="내 이름" value="${name.replace(/"/g, '')}">
        <button class="vs-btn primary" data-a="create">방 만들기</button>
        <div class="vs-join"><input class="vs-code" inputmode="numeric" maxlength="4" placeholder="방 코드 4자리"><button class="vs-btn" data-a="join">참가</button></div>
        <div class="vs-msg"></div>
        <button class="vs-btn ghost" data-a="close">닫기</button></div>`;
      document.body.appendChild(ov);
      const msg = t => { ov.querySelector('.vs-msg').textContent = t; };
      const myName = () => { const n = ov.querySelector('.vs-name').value.trim() || '트레이너'; try { localStorage.setItem('pokemontd_vsname', n); } catch (_) {} return n; };
      ov.querySelector('[data-a="close"]').onclick = () => ov.remove();
      ov.querySelector('[data-a="create"]').onclick = async () => {
        const code = String(1000 + Math.floor(Math.random() * 9000));
        try {
          await this.net.create(code, { code, state: 'lobby', startAt: 0, winner: null, created: Date.now(), seed: (Math.random() * 1e9) >>> 0, speed: 1,
            p1: { name: myName(), ready: false, hb: Date.now(), hero: app.starterHero || 'pikachu', starter: 'charmander' }, p2: null,
            st: {}, send: { p1: { small: 0, elite: 0, boss: 0 }, p2: { small: 0, elite: 0, boss: 0 } } });
          ov.remove(); this._enter(code, 'p1');
        } catch (e) { msg(this._errText(e)); }
      };
      ov.querySelector('[data-a="join"]').onclick = async () => {
        const code = ov.querySelector('.vs-code').value.trim();
        if (!/^\d{4}$/.test(code)) return msg('코드 4자리를 입력하세요');
        try {
          const d = await this.net.get(code);
          if (!d) return msg('없는 방이에요');
          if (d.state !== 'lobby') return msg('이미 시작한 방이에요');
          if (d.p2 && d.p2.hb && Date.now() - d.p2.hb < LOST_MS) return msg('방이 꽉 찼어요');
          await this.net.update(code, { p2: { name: myName(), ready: false, hb: Date.now(), hero: app.starterHero || 'pikachu', starter: 'charmander' } });
          ov.remove(); this._enter(code, 'p2');
        } catch (e) { msg(this._errText(e)); }
      };
    },
    _errText(e) { return /permission/i.test(String(e && (e.code || e.message))) ? '서버 권한이 없어요 (Firebase 규칙에 pokemontd_rooms 허용 필요)' : '연결 실패: ' + (e && e.message || e); },

    _enter(code, me) {
      this.code = code; this.me = me; this.opp = me === 'p1' ? 'p2' : 'p1'; this.ended = false;
      this.kills = 0; this.sentAuto = 0; this.recv = { small: 0, elite: 0, boss: 0 }; this.pending = []; this._resultShown = false; this._done = false; this._counting = false; this.active = false;
      if (this.unsub) { this.unsub(); this.unsub = null; } clearInterval(this.timer); clearInterval(this.spawnTimer);
      const ov = document.createElement('div'); ov.className = 'vs-overlay vs-lobby';
      ov.innerHTML = `<div class="vs-box"><div class="vs-title">대기실</div><div class="vs-code-big">${code}</div><small class="vs-sub">상대에게 이 코드를 알려주세요</small>
        <div class="vs-players"></div>
        <div class="vs-pick"><span>내 영웅</span>${HEROES.map(([id, n]) => `<button data-hero="${id}" title="${n}">${heroImg(id)}</button>`).join('')}</div>
        <div class="vs-pick"><span>시작 몬스터</span>${STARTERS.map(([id, n]) => `<button data-st="${id}" title="${n}">${starterImg(id)}</button>`).join('')}</div>
        <div class="vs-speed"><span>배속 (방장이 선택 · 둘 다 고정)</span><button data-sp="1">1×</button><button data-sp="2">2×</button></div>
        <small class="vs-sub">웨이브는 둘에게 같은 시각에 와요 · 10웨이브마다 카드 · ${SUDDEN}웨이브부터 서든데스 · ${FINAL_WAVE}웨이브 뒤 결전(끝없이 강해지는 몹)</small>
        <button class="vs-btn primary" data-a="ready">준비</button><button class="vs-btn ghost" data-a="leave">나가기</button><div class="vs-msg"></div></div>`;
      document.body.appendChild(ov);
      this._lobby = ov;
      ov.querySelector('[data-a="leave"]').onclick = () => this.leave();
      ov.querySelector('[data-a="ready"]').onclick = () => { const r = !(this.room && this.room[this.me] && this.room[this.me].ready); this.net.update(code, { [`${this.me}.ready`]: r, [`${this.me}.hb`]: Date.now() }).catch(e => this._lobbyMsg(this._errText(e))); };
      ov.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { if (this.room && this.room[this.me] && this.room[this.me].ready) return; this.net.update(code, { [`${this.me}.hero`]: b.dataset.hero }).catch(() => {}); });
      ov.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { if (this.room && this.room[this.me] && this.room[this.me].ready) return; this.net.update(code, { [`${this.me}.starter`]: b.dataset.st }).catch(() => {}); });
      ov.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { if (this.me === 'p1') this.net.update(code, { speed: Number(b.dataset.sp) }).catch(() => {}); });
      this.unsub = this.net.listen(code, (d, err) => { if (err) return this._lobbyMsg(this._errText(err)); this._onRoom(d); });
      this.timer = setInterval(() => this._tick(), SYNC_MS);
    },
    _lobbyMsg(t) { const m = this._lobby && this._lobby.querySelector('.vs-msg'); if (m) m.textContent = t; },

    _onRoom(d) {
      if (!d) return;
      this.room = d;
      if (this._lobby && d.state === 'lobby') {
        const row = (p, k) => `<div class="vs-p ${p && p.ready ? 'ready' : ''}"><b>${k === this.me ? '나' : '상대'}</b><span>${p ? p.name : '기다리는 중…'}</span>${p ? `<em class="vs-pk">${heroImg(p.hero || 'pikachu')}${starterImg(p.starter || 'charmander')}</em>` : ''}<i>${p ? (p.ready ? '준비 완료' : '대기') : ''}</i></div>`;
        this._lobby.querySelector('.vs-players').innerHTML = row(d.p1, 'p1') + row(d.p2, 'p2');
        this._lobby.querySelector('[data-a="ready"]').textContent = d[this.me] && d[this.me].ready ? '준비 취소' : '준비';
        const mine = d[this.me] || {}, locked = !!mine.ready;                             // 준비 누르면 선택 잠금
        this._lobby.querySelectorAll('[data-hero]').forEach(b => { b.classList.toggle('on', b.dataset.hero === (mine.hero || 'pikachu')); b.disabled = locked; });
        this._lobby.querySelectorAll('[data-st]').forEach(b => { b.classList.toggle('on', b.dataset.st === (mine.starter || 'charmander')); b.disabled = locked; });
        this._lobby.querySelectorAll('[data-sp]').forEach(b => { b.classList.toggle('on', Number(b.dataset.sp) === (d.speed || 1)); b.disabled = this.me !== 'p1'; });
        if (d.p1 && d.p2 && d.p1.ready && d.p2.ready) this.net.update(this.code, { state: 'countdown', startAt: Date.now() + 3500 }).catch(() => {}); // 둘 중 누구든 (방장 화면이 꺼져 있어도 시작)
      }
      if ((d.state === 'countdown' || d.state === 'playing') && !this.active && !this._counting && this._lobby) this._countdown(Date.now() + (d.state === 'playing' ? 300 : 3500)); // 받은 순간 기준 → 폰 시계 차이 무관
      if (this.active) {
        this._renderPanel();
        const s = d.send && d.send[this.opp];                                           // 상대가 보낸 누적 수 → 새로 온 만큼 소환 대기열에
        if (s) for (const k of ['small', 'elite', 'boss']) { const n = (s[k] || 0) - this.recv[k]; if (n > 0) { this.recv[k] += n; this._incoming(k, n); } }
        if (d.state === 'ended' && !this._resultShown) this._finish(d.winner === this.me ? 'win' : d.winner === 'draw' ? 'draw' : 'lose', d.why);
        // 결승: 둘 다 끝났으면 방장이 판정 (목숨 많은 쪽 → 필드 몹 적은 쪽 → 처치 많은 쪽)
        const a = (d.st || {}).p1, b = (d.st || {}).p2;
        if (this.me === 'p1' && d.state === 'playing' && a && b && a.done && b.done) {
          const cmp = (a.l - b.l) || (b.f - a.f) || (a.k - b.k);
          this.net.update(this.code, { state: 'ended', winner: cmp > 0 ? 'p1' : cmp < 0 ? 'p2' : 'draw', why: `${FINAL_WAVE}웨이브 결승 판정` }).catch(() => {});
        }
      }
    },

    _countdown(at) {
      this._counting = true;
      const ov = this._lobby; if (ov) ov.querySelector('.vs-box').innerHTML = '<div class="vs-title">곧 시작!</div><div class="vs-count"></div>';
      const step = () => {
        const left = Math.ceil((at - Date.now()) / 1000);
        if (left > 0) { const c = ov && ov.querySelector('.vs-count'); if (c) c.textContent = left; setTimeout(step, 200); return; }
        ov && ov.remove(); this._lobby = null; this._counting = false; this._startAt = at;
        try { this._start(); } catch (err) {                                              // 시작 실패를 조용히 멈추지 않게 알림 + 기록
          window.Leaderboard && Leaderboard.log && Leaderboard.log('vs_start', String(err && err.stack || err));
          alert('대전 시작 중 오류가 났어요. 다시 시도해 주세요.\n' + (err && err.message || err)); this.leave();
        }
      };
      step();
    },

    // ---------- 게임 연동 ----------
    _start() {
      const app = window.app, room = this.room || {};
      this.active = true;
      // 같은 시드로 시작 → 두 사람의 판 특성·강조 몬스터·웨이브 구성이 똑같음 (뽑기 운만 다름)
      const mine = room[this.me] || {};
      app.starterHero = mine.hero || 'pikachu'; app._vsStarter = mine.starter || 'charmander';   // 대기실에서 고른 영웅·시작 몬스터
      // 대전 전용 밸런스(혼자 하기는 그대로): 토게피 공격 6→9 (골드 +20%는 heroes.js에서 _vsGoldMul 보고 적용)
      const tg = window.HeroDefs && HeroDefs.togepi && HeroDefs.togepi.attack;
      if (tg && this._tgDmg === undefined) { this._tgDmg = tg.baseDamage; tg.baseDamage = 9; }
      app._vsRng = _mapRng(room.seed || 1);                                             // 판 특성·강조 몬스터를 시드로 (이전 판 기록과 무관)
      try { app.startGame(); } finally { app._vsRng = null; }
      const e = app.engine;
      e._runSeed = room.seed || 1; window.__wavePlan = {};
      // v3.17 대전 경제: 웨이브가 시계대로 와서 혼자 할 때보다 준비 시간이 짧음 → 시작 골드 600, 처치·클리어 골드 ×1.6,
      //   초반 몹 체력 낮춤(1~8웨이브 75% → 16웨이브에 100%). 판매 환급 등엔 배율 없음(무한 골드 방지)
      e._vsGoldMul = 1.6; e.addGold(300);
      const spawn = e._spawnEnemy.bind(e);
      e._spawnEnemy = (item) => { spawn(item); const en = e.enemies[e.enemies.length - 1], w = e.currentWave || 1;
        if (en && !en.isBoss && !en._vsHp) { const m = w <= 8 ? 0.75 : w < 16 ? 0.75 + (w - 8) / 8 * 0.25 : 1; en.maxHp = Math.round(en.maxHp * m); en.hp = Math.min(en.hp, en.maxHp); en._vsHp = 1; } };
      this.speed = room.speed || 1; this.startAt = this._startAt || Date.now(); e.speedMul = this.speed; // 공용 시계 기준 = 각자 카운트다운이 끝난 순간
      document.getElementById('game-screen').classList.add('vs-mode');          // 배속·웨이브 버튼 숨김 (공용 시계)
      if (this.me === 'p1') this.net.update(this.code, { state: 'playing' }).catch(() => {});
      const die = e._onEnemyDie.bind(e);                                                // 처치 집계 + 받은 몹 현상금
      e._onEnemyDie = (en) => {
        die(en);
        if (en._vsSent) { if (en._vsBounty) { e.addGold(en._vsBounty); e.spawnFloatingText(`막기 보상 +${en._vsBounty}g`, en.x, en.y - 26, '#34d399'); } return; }
        this.kills++;
      };
      const wc = e.onWaveComplete;                                                       // 시간 안에 다 잡으면 자동 견제
      e.onWaveComplete = (w, g, x) => { wc && wc(w, g, x); if (this.active && !this.ended && w <= FINAL_WAVE) this._send('small', AUTO(w), true); };
      const over = e.onGameOver;
      e.onGameOver = () => {
        if (!this.ended) this.net.update(this.code, { state: 'ended', winner: this.opp, why: '목숨이 다 떨어졌어요' }).catch(() => {});
        this.ended = true; this._resultShown = true; this._cleanup(false);
        app.showWaveAnnounce('패배… 상대가 더 오래 버텼어요', '#ff5c7a'); over && over();
      };
      window.ShopItems.push(...VS_ITEMS.map(it => ({ ...it, costFn: eng => itemCost(it, Math.max(1, eng.currentWave || 1)),
        buy: eng => { const w = Math.max(1, eng.currentWave || 1); this._send(it.vs, it.n * (sudden(w) ? 2 : 1)); } })));
      this._panel = document.createElement('div'); this._panel.id = 'vs-panel';
      document.getElementById('game-screen').appendChild(this._panel);
      this._renderPanel();
      this.spawnTimer = setInterval(() => { this._spawnPending(); this._clock(); }, SPAWN_GAP);
    },
    // 공용 웨이브 시계: 시작 시각 기준 WAVE_SEC(게임초)마다 다음 웨이브 — 못 다 잡았으면 남은 몹은 필드에 둔 채 다음 웨이브
    _clock() {
      const app = window.app, e = app && app.engine; if (!e || !this.active || this.ended) return;
      const el = (Date.now() - this.startAt) / 1000 * this.speed, target = Math.min(FINAL_WAVE, Math.floor(el / WAVE_SEC) + 1);
      this._nextIn = Math.max(0, Math.ceil((WAVE_SEC - el % WAVE_SEC) / this.speed));
      if (target > (e.currentWave || 0)) {
        if (e.state === 'wave') e.timeoutWave(); if (e.state === 'idle') app.sendWave();
        const done = (e.currentWave || 0) - 1;                                            // 10웨이브 지날 때마다 카드 (멈추지 않음)
        if (done > 0 && done % 10 === 0 && this._cardAt !== done && app._offerCards && !app._cardOpen) { this._cardAt = done; app._offerCards(done); }
      }
      if (el >= FINAL_WAVE * WAVE_SEC) this._endless(el - FINAL_WAVE * WAVE_SEC);
      if (this._panel) this._renderPanel();
    },
    // 결전: 몹이 한 마리씩 끝없이 (간격 1.1초 → 0.3초, 체력 10초마다 ×1.07), 처치 골드 ×2.5, 2분마다 카드
    _endless(T) {
      const app = window.app, e = app.engine;
      if (!this._endOn) {
        this._endOn = true; this._endNext = 0; this._endCard = ENDLESS_CARD; e._vsGoldMul = 2.5;
        app.showWaveAnnounce('결전 시작! 몬스터가 끊임없이 나와요 · 처치 골드 2.5배', '#ff5c7a');
        try { navigator.vibrate && navigator.vibrate([80, 40, 160]); } catch (_) {}
      }
      let n = 0;
      while (T >= this._endNext && n++ < 6) {                                             // 한 번에 최대 6마리 (멈췄다 돌아와도 폭주 X)
        const plan = waveTypePlan(FINAL_WAVE + 1 + Math.floor(this._endNext / 60)), ids = plan.mainIds.concat(plan.secIds);
        e.activeSpawns++; e._spawnEnemy({ type: ids[Math.floor(Math.random() * ids.length)] });
        const en = e.enemies[e.enemies.length - 1];
        if (en && !en.isBoss) { const m = ENDLESS_HP(this._endNext); en.maxHp = Math.round(en.maxHp * m); en.hp = en.maxHp; en._vsHp = 1; }
        this._endNext += ENDLESS_GAP(this._endNext);
      }
      if (T >= this._endNext) this._endNext = T;                                          // 밀린 건 버림 (동시 방출 금지)
      if (T >= this._endCard && app._offerCards && !app._cardOpen) { this._endCard += ENDLESS_CARD; app._offerCards(e.currentWave); }
      this._endT = T;
    },
    _send(kind, n, auto) {
      this.net.update(this.code, {}, { [`send.${this.me}.${kind}`]: n }).catch(() => {});
      const label = { small: '몬스터', elite: '황금 엘리트', boss: '미니보스' }[kind];
      window.app.showWaveAnnounce(`${auto ? `처치 ${this.kills}! ` : ''}상대에게 ${label} ${n}마리 보냄`, '#ff9f43');
    },
    _incoming(kind, n) {
      for (let i = 0; i < n; i++) this.pending.push(kind);                               // 한꺼번에 쏟아지지 않게 0.38초 간격으로 소환
      const label = { small: '몬스터', elite: '황금 엘리트', boss: '미니보스' }[kind];
      window.app.showWaveAnnounce(`상대가 ${label} ${n}마리를 보냈다!`, '#ff5c7a');
      try { navigator.vibrate && navigator.vibrate(80); } catch (_) {}
    },
    _spawnPending() {
      const e = window.app && window.app.engine; if (!e || !this.active || this.ended || !this.pending.length || !e.running) return;
      const kind = this.pending.shift(), w = Math.max(1, e.currentWave || 1);
      const plan = typeof waveTypePlan === 'function' ? waveTypePlan(w) : null, ids = plan ? plan.mainIds.concat(plan.secIds) : ['rattata'];
      e.activeSpawns++;
      if (kind === 'boss') e._spawnEnemy({ type: MINIBOSS_POOL[Math.floor(Math.random() * MINIBOSS_POOL.length)], bossTier: true, hpMul: 6 + w * 0.25, rewardMul: 2 });
      else e._spawnEnemy({ type: ids[Math.floor(Math.random() * ids.length)] });
      const en = e.enemies[e.enemies.length - 1]; if (!en) return;
      en._vsSent = true; en._bounty = false;
      const it = VS_ITEMS.find(x => x.vs === kind); en._vsBounty = Math.round(itemCost(it, w) * it.bounty / it.n);
      if (kind === 'elite' && en._elite !== 'gold') { const wasSilver = en._elite === 'silver', base = wasSilver ? en.maxHp / 1.5 : en.maxHp; en._elite = 'gold'; en.maxHp = Math.floor(base * 2.2); en.hp = en.maxHp; en.speed *= wasSilver ? 1.13 : 1.3; } // 받은 엘리트는 항상 황금
    },
    _tick() {
      if (!this.code) return;
      const e = window.app && window.app.engine, set = { [`${this.me}.hb`]: Date.now() };
      if (this.active && e && !this._done) set[`st.${this.me}`] = { w: e.currentWave || 0, k: this.kills, l: Math.max(0, e.lives || 0), f: e.enemies.length };
      this.net.update(this.code, set).catch(() => {});
      const o = this.room && this.room[this.opp];
      if (this.active && !this.ended && o && o.hb && Date.now() - o.hb > LOST_MS) {        // 상대 연결 끊김 → 승리
        this.net.update(this.code, { state: 'ended', winner: this.me }).catch(() => {});
        this._finish('win', '상대 연결이 끊겼어요');
      }
    },
    _renderPanel() {
      if (!this._panel || !this.room) return;
      const st = this.room.st || {}, o = st[this.opp] || {}, m = st[this.me] || {}, on = this.room[this.opp] || {};
      const e = window.app.engine;
      const me = { w: e ? e.currentWave : m.w, k: this.kills, l: e ? Math.max(0, e.lives) : m.l, f: e ? e.enemies.length : m.f };
      const row = (who, s, cls) => `<div class="vs-row ${cls}"><b>${who}</b><span>W${s.w || 0}</span><span>처치 ${s.k || 0}</span><span>❤ ${s.l ?? '-'}</span><span>필드 ${s.f || 0}</span></div>`;
      const w = me.w || 0, T = this._endT || 0, mmss = `${Math.floor(T / 60)}:${String(Math.floor(T % 60)).padStart(2, '0')}`;
      const head = this._endOn ? `결전 ${mmss} · 몹 체력 ×${ENDLESS_HP(T).toFixed(1)}` : w >= FINAL_WAVE ? `마지막 웨이브 · 결전까지 ${this._nextIn ?? '-'}초` : `다음 웨이브 ${this._nextIn ?? '-'}초 · ${FINAL_WAVE}웨이브 뒤 결전`;
      this._panel.innerHTML = `<div class="vs-head ${sudden(w) ? 'sd' : ''}">${sudden(w) ? '서든데스 · ' : ''}${head}</div>` + row(on.name || '상대', o, 'opp') + row('나', me, 'me')
        + (this.pending.length ? `<div class="vs-inc">받는 중 ${this.pending.length}</div>` : '');
    },
    _finish(res, why) {
      if (this._resultShown) return;
      this.ended = true; this._resultShown = true;
      const app = window.app, e = app.engine;
      e && e.stop();
      const T = { win: ['승리!', '#ffd34d', '상대의 목숨이 먼저 다 떨어졌어요'], lose: ['패배', '#ff5c7a', '상대가 더 잘 버텼어요'], draw: ['무승부', '#9ecbff', '완전히 같은 기록이에요'] }[res];
      const ov = document.createElement('div'); ov.className = 'vs-overlay';
      ov.innerHTML = `<div class="vs-box"><div class="vs-title" style="color:${T[1]}">${T[0]}</div><small class="vs-sub">${why || T[2]}</small>
        <div class="vs-sub">웨이브 ${e ? e.currentWave : '-'} · 처치 ${this.kills} · 목숨 ${e ? Math.max(0, e.lives) : '-'}</div><button class="vs-btn primary" data-a="ok">나가기</button></div>`;
      document.body.appendChild(ov);
      ov.querySelector('[data-a="ok"]').onclick = () => { ov.remove(); this.leave(); app.backToMapSelect ? app.backToMapSelect() : location.reload(); };
      this._cleanup(false);
    },
    _cleanup(removeRoom) {
      clearInterval(this.timer); clearInterval(this.spawnTimer); this.timer = this.spawnTimer = null;
      this.unsub && this.unsub(); this.unsub = null;
      if (window.ShopItems) for (let i = window.ShopItems.length - 1; i >= 0; i--) if (window.ShopItems[i].vs) window.ShopItems.splice(i, 1);
      this._panel && this._panel.remove(); this._panel = null; this._done = false; this._endOn = false; this._endT = 0; this._cardAt = 0;
      document.getElementById('game-screen')?.classList.remove('vs-mode');
      const tg = window.HeroDefs && HeroDefs.togepi && HeroDefs.togepi.attack;          // 대전 끝나면 혼자 하기 수치로 되돌림
      if (tg && this._tgDmg !== undefined) { tg.baseDamage = this._tgDmg; this._tgDmg = undefined; }
      if (removeRoom && this.code && this.net) this.net.remove(this.code);
      this.active = false;
    },
    leave() {
      this._lobby && this._lobby.remove(); this._lobby = null;
      if (this.code && this.room && this.room.state === 'lobby' && this.me === 'p2') this.net.update(this.code, { p2: null }).catch(() => {});
      this._cleanup(this.me === 'p1' && (!this.room || this.room.state !== 'playing'));
      this.code = null; this.room = null; this._resultShown = false;
    },
  };

  // 영웅 선택 화면에 '2인 대전' 버튼
  document.addEventListener('DOMContentLoaded', () => {
    const start = document.getElementById('btn-endless-start'); if (!start) return;
    const b = document.createElement('button'); b.id = 'btn-versus'; b.textContent = '2인 대전';
    b.onclick = () => VS.openMenu();
    start.after(b);
  });
})();
