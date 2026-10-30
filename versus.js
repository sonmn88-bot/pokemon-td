// ===== VERSUS.JS — v3.16 2인 대전 =====
// 구조: 각자 자기 폰에서 원래 게임을 그대로 돌리고(몹 위치 동기화 X → 렉·끊김에 강함),
//   방 문서 하나로 ① 대기실(준비·동시 시작) ② 2초마다 서로의 요약(웨이브·처치·목숨·필드) ③ 보낸 몬스터 누적 수를 주고받음.
// 견제: 처치 25마리마다 자동으로 상대에게 3마리 + 상점 '몬스터 보내기'(쫄몹·엘리트·미니보스).
// 승패: 목숨이 먼저 0이 되는 쪽이 패배, 상대가 20초 이상 응답 없으면 자동 승리.
// 전송: Firestore 컬렉션 pokemontd_rooms (콘솔 규칙에서 이 컬렉션 읽기·쓰기 허용 필요)
//   테스트용: 주소에 ?vslocal=1 이면 같은 기기 두 창끼리 BroadcastChannel로 연결
(function () {
  const COL = 'pokemontd_rooms', SYNC_MS = 2000, KILLS_PER_SEND = 25, AUTO_SEND = 3, LOST_MS = 20000, SPAWN_GAP = 380;

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
  const VS_ITEMS = [
    { key: 'vs_small', icon: 'sword', name: '몬스터 보내기 ×8', cost: 250, perWaveCost: 12, desc: '상대 필드에 이번 웨이브 몬스터 8마리', vs: 'small', n: 8 },
    { key: 'vs_elite', icon: 'sword', name: '엘리트 보내기 ×3', cost: 700, perWaveCost: 28, desc: '상대에게 황금 엘리트 3마리 (체력 2.2배·빠름)', vs: 'elite', n: 3 },
    { key: 'vs_boss', icon: 'crown', name: '미니보스 보내기', cost: 2000, perWaveCost: 60, perWave: 1, desc: '상대에게 미니보스 1마리 (웨이브당 1회)', vs: 'boss', n: 1 },
  ];

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
          await this.net.create(code, { code, state: 'lobby', startAt: 0, winner: null, created: Date.now(),
            p1: { name: myName(), ready: false, hb: Date.now() }, p2: null,
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
          await this.net.update(code, { p2: { name: myName(), ready: false, hb: Date.now() } });
          ov.remove(); this._enter(code, 'p2');
        } catch (e) { msg(this._errText(e)); }
      };
    },
    _errText(e) { return /permission/i.test(String(e && (e.code || e.message))) ? '서버 권한이 없어요 (Firebase 규칙에 pokemontd_rooms 허용 필요)' : '연결 실패: ' + (e && e.message || e); },

    _enter(code, me) {
      this.code = code; this.me = me; this.opp = me === 'p1' ? 'p2' : 'p1'; this.ended = false;
      this.kills = 0; this.sentAuto = 0; this.recv = { small: 0, elite: 0, boss: 0 }; this.pending = [];
      const ov = document.createElement('div'); ov.className = 'vs-overlay vs-lobby';
      ov.innerHTML = `<div class="vs-box"><div class="vs-title">대기실</div><div class="vs-code-big">${code}</div><small class="vs-sub">상대에게 이 코드를 알려주세요</small>
        <div class="vs-players"></div><button class="vs-btn primary" data-a="ready">준비</button><button class="vs-btn ghost" data-a="leave">나가기</button><div class="vs-msg"></div></div>`;
      document.body.appendChild(ov);
      this._lobby = ov;
      ov.querySelector('[data-a="leave"]').onclick = () => this.leave();
      ov.querySelector('[data-a="ready"]').onclick = () => { const r = !(this.room && this.room[this.me] && this.room[this.me].ready); this.net.update(code, { [`${this.me}.ready`]: r, [`${this.me}.hb`]: Date.now() }).catch(e => this._lobbyMsg(this._errText(e))); };
      this.unsub = this.net.listen(code, (d, err) => { if (err) return this._lobbyMsg(this._errText(err)); this._onRoom(d); });
      this.timer = setInterval(() => this._tick(), SYNC_MS);
    },
    _lobbyMsg(t) { const m = this._lobby && this._lobby.querySelector('.vs-msg'); if (m) m.textContent = t; },

    _onRoom(d) {
      if (!d) return;
      this.room = d;
      if (this._lobby && d.state === 'lobby') {
        const row = (p, k) => `<div class="vs-p ${p && p.ready ? 'ready' : ''}"><b>${k === this.me ? '나' : '상대'}</b><span>${p ? p.name : '기다리는 중…'}</span><i>${p ? (p.ready ? '준비 완료' : '대기') : ''}</i></div>`;
        this._lobby.querySelector('.vs-players').innerHTML = row(d.p1, 'p1') + row(d.p2, 'p2');
        this._lobby.querySelector('[data-a="ready"]').textContent = d[this.me] && d[this.me].ready ? '준비 취소' : '준비';
        if (this.me === 'p1' && d.p1 && d.p2 && d.p1.ready && d.p2.ready) this.net.update(this.code, { state: 'countdown', startAt: Date.now() + 3500 });
      }
      if (d.state === 'countdown' && !this.active && !this._counting) this._countdown(d.startAt);
      if (this.active) {
        this._renderPanel();
        const s = d.send && d.send[this.opp];                                           // 상대가 보낸 누적 수 → 새로 온 만큼 소환 대기열에
        if (s) for (const k of ['small', 'elite', 'boss']) { const n = (s[k] || 0) - this.recv[k]; if (n > 0) { this.recv[k] += n; this._incoming(k, n); } }
        if (d.state === 'ended' && !this.ended) this._finish(d.winner === this.me);
      }
    },

    _countdown(at) {
      this._counting = true;
      const ov = this._lobby; if (ov) ov.querySelector('.vs-box').innerHTML = '<div class="vs-title">곧 시작!</div><div class="vs-count"></div>';
      const step = () => {
        const left = Math.ceil((at - Date.now()) / 1000);
        if (left > 0) { const c = ov && ov.querySelector('.vs-count'); if (c) c.textContent = left; setTimeout(step, 200); return; }
        ov && ov.remove(); this._lobby = null; this._counting = false; this._start();
      };
      step();
    },

    // ---------- 게임 연동 ----------
    _start() {
      const app = window.app;
      this.active = true;
      app.startGame();
      const e = app.engine;
      if (this.me === 'p1') this.net.update(this.code, { state: 'playing' }).catch(() => {});
      const die = e._onEnemyDie.bind(e);                                                // 처치 집계 + 자동 견제
      e._onEnemyDie = (en) => {
        die(en);
        if (en._vsSent) return;                                                          // 받은 몬스터는 다시 돌려보내지 않음
        this.kills++;
        if (this.kills % KILLS_PER_SEND === 0) { this.sentAuto += AUTO_SEND; this._send('small', AUTO_SEND, true); }
      };
      const over = e.onGameOver;
      e.onGameOver = () => { if (!this.ended) this.net.update(this.code, { state: 'ended', winner: this.opp }).catch(() => {}); this.ended = true; this._resultShown = true; this._cleanup(false); window.app.showWaveAnnounce('패배… 상대가 더 오래 버텼어요', '#ff5c7a'); over && over(); };
      window.ShopItems.push(...VS_ITEMS.map(it => ({ ...it, buy: () => { this._send(it.vs, it.n); } })));
      this._panel = document.createElement('div'); this._panel.id = 'vs-panel';
      document.getElementById('game-screen').appendChild(this._panel);
      this._renderPanel();
      this.spawnTimer = setInterval(() => this._spawnPending(), SPAWN_GAP);
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
      if (kind === 'elite' && en._elite !== 'gold') { const wasSilver = en._elite === 'silver', base = wasSilver ? en.maxHp / 1.5 : en.maxHp; en._elite = 'gold'; en.maxHp = Math.floor(base * 2.2); en.hp = en.maxHp; en.speed *= wasSilver ? 1.13 : 1.3; } // 받은 엘리트는 항상 황금
    },
    _tick() {
      if (!this.code) return;
      const e = window.app && window.app.engine, set = { [`${this.me}.hb`]: Date.now() };
      if (this.active && e) set[`st.${this.me}`] = { w: e.currentWave || 0, k: this.kills, l: Math.max(0, e.lives || 0), f: e.enemies.length };
      this.net.update(this.code, set).catch(() => {});
      const o = this.room && this.room[this.opp];
      if (this.active && !this.ended && o && o.hb && Date.now() - o.hb > LOST_MS) {        // 상대 연결 끊김 → 승리
        this.net.update(this.code, { state: 'ended', winner: this.me }).catch(() => {});
        this._finish(true, '상대 연결이 끊겼어요');
      }
    },
    _renderPanel() {
      if (!this._panel || !this.room) return;
      const st = this.room.st || {}, o = st[this.opp] || {}, m = st[this.me] || {}, on = this.room[this.opp] || {};
      const e = window.app.engine;
      const me = { w: e ? e.currentWave : m.w, k: this.kills, l: e ? Math.max(0, e.lives) : m.l, f: e ? e.enemies.length : m.f };
      const row = (who, s, cls) => `<div class="vs-row ${cls}"><b>${who}</b><span>W${s.w || 0}</span><span>처치 ${s.k || 0}</span><span>❤ ${s.l ?? '-'}</span><span>필드 ${s.f || 0}</span></div>`;
      this._panel.innerHTML = row(on.name || '상대', o, 'opp') + row('나', me, 'me')
        + (this.pending.length ? `<div class="vs-inc">받는 중 ${this.pending.length}</div>` : '');
    },
    _finish(win, why) {
      if (this.ended && this._resultShown) return;
      this.ended = true; this._resultShown = true;
      const app = window.app, e = app.engine;
      if (win) {
        e && e.stop();
        const ov = document.createElement('div'); ov.className = 'vs-overlay';
        ov.innerHTML = `<div class="vs-box"><div class="vs-title" style="color:#ffd34d">승리!</div><small class="vs-sub">${why || '상대의 목숨이 먼저 다 떨어졌어요'}</small>
          <div class="vs-sub">웨이브 ${e ? e.currentWave : '-'} · 처치 ${this.kills}</div><button class="vs-btn primary" data-a="ok">나가기</button></div>`;
        document.body.appendChild(ov);
        ov.querySelector('[data-a="ok"]').onclick = () => { ov.remove(); this.leave(); app.backToMapSelect ? app.backToMapSelect() : location.reload(); };
      }
      this._cleanup(false);
    },
    _cleanup(removeRoom) {
      clearInterval(this.timer); clearInterval(this.spawnTimer); this.timer = this.spawnTimer = null;
      this.unsub && this.unsub(); this.unsub = null;
      if (window.ShopItems) for (let i = window.ShopItems.length - 1; i >= 0; i--) if (window.ShopItems[i].vs) window.ShopItems.splice(i, 1);
      this._panel && this._panel.remove(); this._panel = null;
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
