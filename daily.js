// v4 일일 도전 + 판 종료 리포트 보강
// - 오늘의 도전: 날짜 시드 하나로 영웅·판 특성·강조 몬스터·웨이브 구성·뽑기/합성/카드 운이 모두 같음 → 실력만 비교
//   여러 번 도전 가능, 최고 기록만 남김. 랭킹은 기존 컬렉션에 daily 필드를 붙여 등록 (leaderboard.js fetchDaily)
// - 판 종료: 신기록/최고까지 남은 웨이브, 무너진 원인 타입 → 대응 타입 팁
(function () {
  const HEROES = ['pikachu', 'togepi', 'eevee'];
  const HERO_KO = { pikachu: '피카츄', togepi: '토게피', eevee: '이브이' };
  const TYPE_KO = { fire: '불꽃', water: '물', electric: '전기', grass: '풀', psychic: '에스퍼', normal: '노말' };

  function todayKey() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  function dayNum(key) { const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100, d = key % 100; return Math.floor(Date.UTC(y, m - 1, d) / 864e5); }
  function info() { const key = todayKey(); return { key, seed: (key * 2654435761) >>> 0, hero: HEROES[dayNum(key) % HEROES.length] }; }
  function loadBest() { try { const r = JSON.parse(localStorage.getItem('pokemontd_daily') || 'null'); return r && r.key === todayKey() ? r : null; } catch (_) { return null; } }
  function saveBest(wave, score) {
    const cur = loadBest(); if (cur && (cur.wave > wave || (cur.wave === wave && cur.score >= score))) return false;
    try { localStorage.setItem('pokemontd_daily', JSON.stringify({ key: todayKey(), wave, score })); } catch (_) {}
    return true;
  }

  const Daily = {
    start() {
      const app = window.app; if (!app) return;
      const d = info();
      app._daily = d; app.starterHero = d.hero;
      document.querySelectorAll('#starter-hero-select .diff-btn').forEach(b => b.classList.toggle('active', b.dataset.hero === d.hero));
      window.GachaRng.r = _mapRng((d.seed ^ 0x9e3779b9) >>> 0);
      app._vsRng = _mapRng(d.seed); app._dailyLaunch = true;
      try { app.startGame(); } finally { app._vsRng = null; app._dailyLaunch = false; }
      if (app.engine) { app.engine._runSeed = d.seed; window.__wavePlan = {}; }
      const m = Math.floor(d.key / 100) % 100, day = d.key % 100;
      setTimeout(() => app.showWaveAnnounce(`오늘의 도전 · ${m}/${day} · ${HERO_KO[d.hero]}`, '#ffc24b'), 300);
    },
    renderButton() {
      const start = document.getElementById('btn-endless-start'); if (!start) return;
      let b = document.getElementById('btn-daily');
      if (!b) { b = document.createElement('button'); b.id = 'btn-daily'; b.onclick = () => Daily.start(); start.after(b); }
      const d = info(), best = loadBest();
      b.innerHTML = `<span class="dl-main">오늘의 도전</span><span class="dl-sub">${HERO_KO[d.hero]} 고정 · 모두 같은 운 · ${best ? `내 최고 ${best.wave}웨이브` : '아직 기록 없음'}</span>`;
    },
    async showRank(host) {
      const box = document.createElement('div'); box.className = 'dl-rank'; box.textContent = '오늘의 순위 불러오는 중...';
      const firstBtn = host.querySelector('.end-btn'); firstBtn ? firstBtn.before(box) : host.appendChild(box); // 버튼들 위에
      const rows = window.Leaderboard && Leaderboard.isEnabled() ? await Leaderboard.fetchDaily(todayKey(), 10) : [];
      if (!box.isConnected) return;
      box.innerHTML = rows.length ? `<b>오늘의 순위</b>` + rows.map((r, i) => `<div class="dl-row"><span>${i + 1}</span><span class="nm"></span><span>${r.wave}웨이브</span><span>${Number(r.score).toLocaleString()}</span></div>`).join('')
        : '<b>오늘의 순위</b><div class="dl-empty">아직 등록된 기록이 없어요. 첫 기록을 남겨보세요</div>';
      box.querySelectorAll('.nm').forEach((el, i) => { el.textContent = rows[i].name; }); // 이름은 textContent로 (HTML 주입 방지)
    },
  };
  window.Daily = Daily;

  // ---- App 연동 ----
  const P = App.prototype;
  const origStart = P.startGame;
  P.startGame = function (...a) {
    if (!this._dailyLaunch) { this._daily = null; window.GachaRng.r = null; } // 일반·대전 시작이면 시드 해제
    return origStart.apply(this, a);
  };
  const origRec = P._recordBestWave;
  P._recordBestWave = function () {
    try { this._prevBestWave = parseInt(localStorage.getItem('pokemontd_best_wave') || '0', 10); } catch (_) { this._prevBestWave = 0; }
    return origRec.apply(this, arguments);
  };
  const origBack = P.backToMapSelect;
  P.backToMapSelect = function () { const r = origBack.apply(this, arguments); Daily.renderButton(); return r; };

  const origEnd = P.showEndScreen;
  P.showEndScreen = function (victory, stars, best) {
    const e = this.engine, daily = this._daily;
    origEnd.apply(this, arguments);
    const ovs = document.querySelectorAll('#game-screen .end-overlay'), ov = ovs[ovs.length - 1]; if (!ov || !e) return;
    const reached = e.currentWave || 0, title = ov.querySelector('.end-title');
    // 1) 기록 줄: 신기록 / 최고까지 N웨이브
    const line = document.createElement('div'); line.className = 'end-record';
    if (daily) {
      const isBest = saveBest(reached, Math.round(e.score || 0));
      line.innerHTML = isBest ? '<em>오늘의 도전 최고 기록!</em>' : `오늘 최고 ${loadBest().wave}웨이브 · 이번 ${reached}웨이브`;
    } else if (!victory) {
      const prev = this._prevBestWave || 0;
      line.innerHTML = reached > prev ? `<em>신기록!</em> 이전 최고 ${prev} → ${reached}웨이브`
        : prev - reached <= 5 ? `최고 기록까지 <em>${prev - reached + 1}웨이브</em> 남았어요` : `최고 기록 ${prev}웨이브`;
    }
    if (line.innerHTML && title) { title.after(line); if (/신기록|최고 기록!/.test(line.textContent)) this.SFX.play('record'); }
    // 2) 무너진 원인: 필드에 남은 적의 주 타입 → 이기는 타입 팁
    if (!victory && window.TYPE_CYCLE) {
      const cnt = {}; for (const en of e.enemies) { const t = en.typeTag || en.type || (en.def && en.def.type); if (t && TYPE_CYCLE.includes(t)) cnt[t] = (cnt[t] || 0) + 1; }
      const total = Object.values(cnt).reduce((a, b) => a + b, 0), top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      if (top && total >= 8 && top[1] / total >= 0.35) {
        const C = TYPE_CYCLE, ct = C[(C.indexOf(top[0]) - 1 + C.length) % C.length];
        const mine = e.towers.filter(t => t.def && t.def.type === ct).length;
        const tip = document.createElement('div'); tip.className = 'end-tip';
        tip.innerHTML = `${ICON(top[0], 16)} 남은 적의 ${Math.round(top[1] / total * 100)}%가 <b>${TYPE_KO[top[0]]}</b> · 이기는 타입 ${ICON(ct, 16)} <b>${TYPE_KO[ct]}</b>가 필드에 ${mine}마리 — 다음 판엔 ${mine < 3 ? '더 늘려보세요' : '강화를 우선해보세요'}`;
        (ov.querySelector('.end-record') || title)?.after(tip);
      }
    }
    // 3) 일일 도전: 순위 보기 + 다시 도전도 일일로
    if (daily) {
      Daily.showRank(ov);
      const retry = [...ov.querySelectorAll('.end-btn')].find(b => b.textContent.includes('다시 도전'));
      if (retry) { const nb = retry.cloneNode(true); nb.textContent = '오늘의 도전 다시'; nb.onclick = () => { ov.remove(); this.backToMapSelect(); Daily.start(); }; retry.replaceWith(nb); }
    }
  };

  document.addEventListener('DOMContentLoaded', () => Daily.renderButton());
  if (document.readyState !== 'loading') Daily.renderButton();
})();
