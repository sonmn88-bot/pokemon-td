// v4 사운드: 녹음 샘플(CC0, assets/audio) 기반 효과음 + 배경음. 기존 SFX.play / BGM.start·stop 이름 그대로.
// - 첫 터치 때 AudioContext 생성·잠금 해제 (iOS), 효과음은 그때 한꺼번에 미리 디코드
// - 같은 소리 연타는 간격 제한(THROTTLE), 동시 재생 최대 MAX_VOICES → 후반 대량 처치에도 소리·CPU 폭주 없음
// - 배경음은 지금 곡 1개만 메모리에 둠, 곡 전환은 0.6초 크로스페이드
// - 설정(효과음·배경음 켜고 끄기)은 localStorage 'pokemontd_audio'
(function () {
  const BASE = 'assets/audio/';
  const SFX_LIST = ['tap','buy','pop','hit','pull_normal','pull_rare','pull_epic','pull_legend','merge','wave_start','wave_clear',
    'boss','king_victory','life_lost','skill','place','sell','card','evolve','gameover','record'];
  const VOL = { tap:.35, buy:.5, pop:.22, hit:.16, pull_normal:.45, pull_rare:.55, pull_epic:.6, pull_legend:.7, merge:.55,
    wave_start:.45, wave_clear:.5, boss:.65, king_victory:.7, life_lost:.55, skill:.5, place:.5, sell:.5, card:.5,
    evolve:.6, gameover:.6, record:.6 };
  const THROTTLE = { hit: 70, pop: 90, tap: 40, buy: 60, place: 60, sell: 60, life_lost: 150, pull_normal: 50 };
  const VARY = { hit: .12, pop: .15, tap: .05, buy: .06, place: .08 }; // 반복음 피치 흔들기 (덜 지침)
  const MAX_VOICES = 10;
  const BGM_FILES = { field: 'bgm_field.mp3', field2: 'bgm_field2.mp3', boss: 'bgm_boss.mp3', battle1: 'bgm_battle1.mp3', battle2: 'bgm_battle2.mp3', battle3: 'bgm_battle3.mp3' };
  const BGM_GAIN = { battle1: 0.5, battle2: 0.5, battle3: 0.5 }; // 곡마다 크기 보정 (기본 BGM_VOL 대비)
  const BGM_VOL = 0.32;

  let settings = { sfx: true, bgm: true };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('pokemontd_audio') || '{}')); } catch (_) {}
  const save = () => { try { localStorage.setItem('pokemontd_audio', JSON.stringify(settings)); } catch (_) {} };

  let ctx = null, master = null, sfxBus = null, bgmBus = null, loading = false;
  const buffers = {}, lastPlay = {};
  let voices = 0;

  function ensureCtx() {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master); // 여러 소리 겹쳐도 찢어지지 않게
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 1 : 0; sfxBus.connect(comp);
    bgmBus = ctx.createGain(); bgmBus.gain.value = settings.bgm ? 1 : 0; bgmBus.connect(master);
    return ctx;
  }
  async function loadBuf(file) {
    const res = await fetch(BASE + file); if (!res.ok) throw new Error(file + ' ' + res.status);
    const ab = await res.arrayBuffer();
    return await new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no)); // 콜백형: 구형 사파리 호환
  }
  function preloadSfx() {
    if (loading || !ensureCtx()) return; loading = true;
    SFX_LIST.forEach(n => loadBuf(n + '.mp3').then(b => { buffers[n] = b; }).catch(() => {}));
  }
  // 첫 터치에 잠금 해제 + 미리 로드
  const unlock = () => { ensureCtx(); preloadSfx(); if (BGM._want && !BGM._src) BGM._play(BGM._want); };
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, unlock, { passive: true, capture: true }));
  // 버튼 누름 소리 (공통, 아주 작게)
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled) SFX.play('tap'); }, true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });

  const SFX = {
    play(name, opt) {
      if (!settings.sfx || !ctx || ctx.state !== 'running') return;
      const buf = buffers[name]; if (!buf) return;
      const now = performance.now(), gap = THROTTLE[name] || 30;
      if (lastPlay[name] && now - lastPlay[name] < gap) return;
      if (voices >= MAX_VOICES) return;
      lastPlay[name] = now;
      try {
        const src = ctx.createBufferSource(); src.buffer = buf;
        const v = VARY[name]; if (v) src.playbackRate.value = 1 - v + Math.random() * v * 2;
        if (opt && opt.rate) src.playbackRate.value *= opt.rate;
        const g = ctx.createGain(); g.gain.value = (VOL[name] || .5) * (opt && opt.vol != null ? opt.vol : 1);
        src.connect(g); g.connect(sfxBus);
        voices++; src.onended = () => { voices--; try { g.disconnect(); } catch (_) {} };
        src.start();
      } catch (_) {}
    },
  };

  const BGM = {
    _want: null, _cur: null, _src: null, _gain: null, _token: 0,
    // mapId → 곡. 'infinite'·'boss'는 보스곡, 동굴·도시는 2번 곡
    _pick(mapId) {
      if (mapId === 'battle') return 'battle' + (1 + Math.floor(Math.random() * 3)); // 포켓몬 배틀: 3곡 중 무작위
      if (mapId === 'boss' || mapId === 'infinite') return 'boss';
      const w = window.app?.engine?.currentWave || 0;
      if (w >= 90) return 'boss';
      return (mapId === 'cave' || mapId === 'city') ? 'field2' : 'field';
    },
    start(mapId) { const k = this._pick(mapId || 'forest'); this._want = k; if (ctx && ctx.state === 'running') this._play(k); },
    stop() { this._want = null; this._fadeOut(); this._cur = null; },
    _fadeOut() {
      if (!this._src) return;
      const s = this._src, g = this._gain, t = ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.6);
      setTimeout(() => { try { s.stop(); s.disconnect(); g.disconnect(); } catch (_) {} }, 700);
      this._src = null; this._gain = null;
    },
    async _play(k) {
      if (!settings.bgm || !ensureCtx()) return;
      if (this._cur === k && this._src) return;
      this._cur = k; const token = ++this._token;
      let buf;
      try { buf = await loadBuf(BGM_FILES[k]); } catch (_) { return; }
      if (token !== this._token || this._want !== k) return; // 로딩 중 다른 곡 요청됨
      this._fadeOut();
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(bgmBus);
      g.gain.linearRampToValueAtTime(BGM_VOL * (1 + (BGM_GAIN[k] || 0)), ctx.currentTime + 0.8);
      src.start(); this._src = src; this._gain = g;
    },
  };

  window.GameAudio = {
    sfx: SFX, bgm: BGM,
    get settings() { return { ...settings }; },
    set(key, on) {
      settings[key] = !!on; save(); ensureCtx();
      if (key === 'sfx' && sfxBus) sfxBus.gain.value = on ? 1 : 0;
      if (key === 'bgm') { if (bgmBus) bgmBus.gain.value = on ? 1 : 0; if (on && BGM._want) { BGM._cur = null; BGM._play(BGM._want); } }
    },
  };
})();
