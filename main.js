// ===== MAIN.JS - 화면 관리 + HUD + 웨이브 데이터 20개 + 타워/영웅/상점 통합 =====

// ===== 웨이브 데이터 20개 =====
const WaveData = [
  /* W1  */ [ ...seq('abo',14,1.2,0) ],
  /* W2  */ [ ...seq('abo',10,1.0,0), ...seq('jigglypuff',6,1.8,0,8) ],
  /* W3  */ [ ...seq('abo',10,0.9,0), ...seq('rattata',8,0.6,0,4), ...seq('paras',6,1.8,0,9) ],
  /* W4  */ [ ...seq('jigglypuff',8,1.3,0), ...seq('paras',6,1.3,0,6), ...seq('abo',6,0.7,0,12), ...seq('zubat',6,1.0,0,14) ],
  /* W5  */ [ ...seq('abo',15,0.6,0), ...seq('jigglypuff',8,1.3,0,4), ...seq('koffing',5,1.8,0,10), ...seq('paras',6,1.8,0,14) ],
  /* W6  */ [ ...seq('gastly',10,1.3,0), ...seq('lapras',5,1.8,0,8), ...seq('zubat',8,1.0,0,12) ],
  /* W7  */ [ ...seq('golbat',10,0.9,0), ...seq('gastly',8,1.1,0,5), ...seq('magnemite',6,1.3,0,10) ],
  /* W8  */ [ ...seq('phantump',6,1.8,0), ...seq('lapras',7,1.3,0,6), ...seq('haunter',6,1.6,0,12) ],
  /* W9  */ [ ...seq('gastly',12,0.7,0), ...seq('phantump',6,1.8,0,6), ...seq('golbat',6,0.9,0,12), ...seq('electrode',4,1.8,0,16) ],
  /* W10 */ [ ...seq('abo',8,1.0,0), ...seq('lapras',6,1.3,0,6), {type:'gyarados',delay:12}, ...seq('gastly',7,0.9,0,14) ],
  /* W11 */ [ ...seq('weezing',8,1.8,0), ...seq('paras',8,1.3,0,8), ...seq('onix',5,1.8,0,14) ],
  /* W12 */ [ ...seq('scyther',6,2.2,0), ...seq('weezing',6,1.8,0,8), ...seq('electrode',6,1.3,0,14) ],
  /* W13 */ [ ...seq('scyther',5,1.8,0), ...seq('weezing',8,1.3,0,5), ...seq('onix',5,1.8,0,10), {type:'gyarados',delay:18} ],
  /* W14 */ [ ...seq('weezing',9,1.1,0), ...seq('scyther',8,1.6,0,6), ...seq('golbat',9,0.7,0,14), ...seq('haunter',7,1.1,0,18) ],
  /* W15 */ [ ...seq('scyther',8,1.3,0), ...seq('weezing',8,1.3,0,6), ...seq('phantump',6,1.8,0,10), ...seq('onix',5,1.8,0,16), {type:'gyarados',delay:24} ],
  /* W16 */ [ ...seq('golbat',12,0.7,0), ...seq('gastly',12,0.7,0,5), ...seq('dragonite',2,0,0,12), {type:'lugia',delay:18} ],
  /* W17 */ [ ...seq('abo',8,0.7,0), ...seq('scyther',6,1.3,0,3), ...seq('weezing',6,1.3,0,8), ...seq('dragonite',3,2.8,0,12), ...seq('gyarados',3,3.5,0,16) ],
  /* W18 */ [ ...seq('gastly',10,0.7,0), ...seq('phantump',8,1.3,0,4), ...seq('lapras',9,0.9,0,10), ...seq('onix',6,1.3,0,16), {type:'lugia',delay:22} ],
  /* W19 */ [ ...seq('scyther',9,0.9,0), ...seq('weezing',9,0.9,0,5), ...seq('gyarados',4,2.8,0,10), ...seq('dragonite',3,2.8,0,18), ...seq('golbat',12,0.5,0,22), {type:'lugia',delay:28} ],
  /* W20 */ [
    ...seq('gastly',12,0.5,0), ...seq('scyther',9,0.9,0,4),
    ...seq('weezing',9,0.9,0,8), {type:'gyarados',delay:12},
    ...seq('dragonite',4,2.5,0,16), {type:'lugia',delay:22},
    {type:'mewtwo',delay:36},
  ],
]

function seq(type, count, interval, pathIdx = 0, startDelay = 0) {
  const arr = [];
  for (let i = 0; i < count; i++) arr.push({ type, delay: startDelay + i * interval, pathIdx });
  return arr;
}

// 순환 트랙 제한시간: 마지막 스폰 시각 + 처치 여유시간(난이도별 가감)
function waveTimeLimit(wave, difficulty) {
  const lastDelay = wave.reduce((m, item) => Math.max(m, item.delay), 0);
  const dm = (window.DifficultyMods && window.DifficultyMods[difficulty]) || { timeBonus: 0 };
  const killBuffer = 26 + dm.timeBonus;
  return Math.max(15, Math.round(lastDelay + killBuffer));
}

// ===== APP CONTROLLER =====
class App {
  constructor() {
    this.engine = null;
    this.currentMapId = null;
    this.spellMgr = new SpellManager();
    this.selectedHeroSkins = { pikachu: 'default', mew: 'default', togepi: 'default', charizard: 'default', blastoise: 'default', eevee: 'default' };
    this.placingHero = null;
    this._autoWaveTimer = null;
    this._inventory = [];

    // ===== 효과음 시스템 (Web Audio API) =====
    this.SFX = {
      ctx: null,
      _get() { if (!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)(); return this.ctx; },
      play(type) {
        try {
          const ctx = this._get();
          const g = ctx.createGain();
          g.connect(ctx.destination);
          const o = ctx.createOscillator();
          o.connect(g);
          // 부드러운 사운드로 전면 교체: square/sawtooth(거친 지지직 소리) → sine/triangle
          const configs = {
            shoot:      { freq:[440,300],   dur:0.09, vol:0.09, type:'triangle' },
            hit:        { freq:[260,160],   dur:0.11, vol:0.10, type:'sine' },
            wave_clear: { freq:[523,659,784],dur:0.55, vol:0.15, type:'sine' },
            wave_start: { freq:[330,440],   dur:0.22, vol:0.13, type:'sine' },
            pull_normal:{ freq:[440,550],   dur:0.16, vol:0.11, type:'sine' },
            pull_rare:  { freq:[550,700,880],dur:0.32, vol:0.14, type:'sine' },
            pull_epic:  { freq:[440,660,880,1100],dur:0.5,vol:0.16,type:'sine' },
            merge:      { freq:[523,659,784,1047],dur:0.6,vol:0.17,type:'sine' },
            boss:       { freq:[150,120,100],dur:0.85, vol:0.16, type:'triangle' },
            buy:        { freq:[440,550],   dur:0.16, vol:0.11, type:'sine' },
            life_lost:  { freq:[260,210,170],dur:0.45, vol:0.13, type:'sine' },
            skill:      { freq:[660,880],   dur:0.22, vol:0.13, type:'sine' },
          };
          const cfg = configs[type] || configs.hit;
          o.type = cfg.type;
          const freqs = cfg.freq;
          const stepDur = cfg.dur / freqs.length;
          const t0 = ctx.currentTime;
          o.frequency.setValueAtTime(freqs[0], t0);
          freqs.forEach((f, i) => {
            // 계단식(끊김/지지직) 대신 부드러운 선형 램프로 주파수 전환
            o.frequency.linearRampToValueAtTime(f, t0 + i * stepDur + stepDur * 0.9);
          });
          // 어택 램프: 0에서 시작해 살짝 올라갔다 내려가는 자연스러운 엔벨로프 (클릭/팝 노이즈 방지)
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(cfg.vol, t0 + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0008, t0 + cfg.dur);
          o.start(t0);
          o.stop(t0 + cfg.dur + 0.05);
        } catch(e) {}
      }
    };

    // ===== BGM 시스템 (Web Audio API 절차적 생성) =====
    this.BGM = {
      ctx: null, nodes: [], playing: false,
      _get() {
        if (!this.ctx) this.ctx = new (window.AudioContext||window.webkitAudioContext)();
        return this.ctx;
      },
      stop() {
        this.nodes.forEach(n => { try { n.stop(); } catch(e){} });
        this.nodes = []; this.playing = false;
      },
      start(mapId) {
        this.stop();
        try {
          const ctx = this._get();
          // 맵별 음계/템포
          const themes = {
            forest: { notes:[261,294,330,349,392,440,494,523], tempo:0.4, vol:0.06, wave:'sine' },
            city:   { notes:[220,247,262,294,330,370,392,440], tempo:0.3, vol:0.06, wave:'triangle' },
            cave:   { notes:[196,220,233,261,294,311,349,392], tempo:0.5, vol:0.05, wave:'sine' },
          };
          const theme = themes[mapId] || themes.forest;
          const master = ctx.createGain();
          master.gain.value = theme.vol;
          // 리버브 효과
          const conv = ctx.createConvolver();
          const revLen = ctx.sampleRate * 1.5;
          const revBuf = ctx.createBuffer(2, revLen, ctx.sampleRate);
          for (let ch=0; ch<2; ch++) {
            const d = revBuf.getChannelData(ch);
            for (let i=0; i<revLen; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/revLen, 2);
          }
          conv.buffer = revBuf;
          const revGain = ctx.createGain(); revGain.gain.value = 0.25;
          master.connect(conv); conv.connect(revGain); revGain.connect(ctx.destination);
          master.connect(ctx.destination);

          // 멜로디 루프
          const playMelody = () => {
            if (!this.playing) return;
            const notes = theme.notes;
            const seq = [0,2,4,2,5,4,3,2,1,0,2,4,7,6,4,2];
            seq.forEach((ni, i) => {
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.connect(g); g.connect(master);
              o.type = theme.wave;
              o.frequency.value = notes[ni % notes.length];
              const t = ctx.currentTime + i * theme.tempo;
              g.gain.setValueAtTime(0, t);
              g.gain.linearRampToValueAtTime(0.8, t + 0.02);
              g.gain.exponentialRampToValueAtTime(0.001, t + theme.tempo * 0.85);
              o.start(t); o.stop(t + theme.tempo);
              this.nodes.push(o);
            });
            // 루프
            setTimeout(playMelody, seq.length * theme.tempo * 1000);
          };

          // 베이스 드론
          const bass = ctx.createOscillator();
          const bassGain = ctx.createGain();
          bass.connect(bassGain); bassGain.connect(master);
          bass.type = 'sine';
          bass.frequency.value = theme.notes[0] * 0.5;
          bassGain.gain.value = 0.3;
          bass.start(); this.nodes.push(bass);

          this.playing = true;
          playMelody();
        } catch(e) { console.warn('BGM failed:', e); }
      }
    };

    this.els = {
      mapSelect: document.getElementById('map-select-screen'),
      gameScreen: document.getElementById('game-screen'),
      canvas: document.getElementById('game-canvas'),
      livesVal: document.getElementById('lives-val'),
      goldVal: document.getElementById('gold-val'),
      waveVal: document.getElementById('wave-val'),
      waveTotal: document.getElementById('wave-total'),
      btnWave: document.getElementById('btn-wave'),
      btnBack: document.getElementById('btn-back'),
      btnMenu: document.getElementById('btn-menu'),
      towerBar: document.getElementById('tower-bar'),
    };

    this.bindMapSelect();
    this.difficulty = 'normal';
    this.bindDifficultySelect();
    this.bindButtons();
    this.bindHotkeys();
    this.bindSpeedButtons();
    this.buildTowerBar();
    this.bindTitleScreen();
  }

  bindTitleScreen() {
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        document.getElementById('title-screen').classList.remove('active');
        document.getElementById('map-select-screen').classList.add('active');
      });
    }
    const backBtn = document.getElementById('btn-title-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        document.getElementById('map-select-screen').classList.remove('active');
        document.getElementById('title-screen').classList.add('active');
        initTitleCanvas();
      });
    }
  }

  bindMapSelect() {
    document.querySelectorAll('.map-card').forEach(card => {
      card.addEventListener('click', () => this.startGame(card.dataset.map));
    });
  }

  bindDifficultySelect() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.difficulty = btn.dataset.diff;
        document.querySelectorAll('.diff-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  // ===== PC 단축키 =====
  // 슬롯을 마우스로 선택한 뒤 숫자키로 즉시 뽑기, X로 즉시 판매, 스페이스로 웨이브 시작, QWER로 영웅 스킬
  bindHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.engine || !this.els.gameScreen.classList.contains('active')) return;
      // 입력창/오버레이가 떠 있으면 무시
      if (document.querySelector('.shop-overlay, .skilltree-overlay, .tenpull-overlay, .mission-overlay, .end-overlay')) return;
      const k = e.key.toLowerCase();

      // 1~4: 선택된 슬롯에 즉시 뽑기
      if (['1','2','3','4'].includes(k)) {
        const map = { '1':'normal', '2':'premium', '3':'gamble', '4':'ten' };
        e.preventDefault();
        this.doPull(map[k]);
        return;
      }
      // X / Delete / Backspace: 선택된 타워 즉시 판매
      if (k === 'x' || k === 'delete' || k === 'backspace') {
        if (this.engine.selectedTower && this.engine.selectedSlotIdx !== null) {
          e.preventDefault();
          this.engine.sellTower(this.engine.selectedSlotIdx);
          this.engine.selectedTower = null; this.engine.selectedSlotIdx = null;
          document.querySelector('.tower-info-panel')?.remove();
        }
        return;
      }
      // 스페이스: 웨이브 시작 (idle일 때만)
      if (k === ' ') {
        if (this.engine.state === 'idle') { e.preventDefault(); this.sendWave(); }
        return;
      }
      // QWER: 배치된 영웅 순서대로 스킬1/스킬2
      const skillKeyMap = { q:[0,0], w:[0,1], e:[1,0], r:[1,1] };
      if (skillKeyMap[k]) {
        const [heroIdx, skillIdx] = skillKeyMap[k];
        const hero = this.engine.heroes[heroIdx];
        if (hero) {
          e.preventDefault();
          if (hero.cast(skillIdx, this.engine)) {
            const skill = hero.def.skills[skillIdx];
            this.showWaveAnnounce(`${skill.emoji} ${skill.name}!`, '#ffd60a');
          }
        }
        return;
      }
    });
  }

  bindButtons() {
    this.els.btnWave.addEventListener('click', () => this.sendWave());
    this.els.btnBack.addEventListener('click', () => this.backToMapSelect());
    this.els.btnMenu.addEventListener('click', () => this.togglePause());
    const btnMission = document.getElementById('btn-mission');
    if (btnMission) btnMission.addEventListener('click', () => this.openMissionBoard());
  }

  bindSpeedButtons() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.engine) return;
        const speed = parseFloat(btn.dataset.speed);
        this.engine.speedMul = speed;
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  _updateWaveHUD() {
    const e = this.engine;
    const remaining = e.enemies.length + e.spawnQueue.length;
    const waveEl = document.getElementById('wave-val');
    if (waveEl) {
      const secs = Math.floor(this._waveTimer);
      const rem = remaining > 0 ? ` (${remaining}마리)` : '';
      document.getElementById('hud-wave').title = `${secs}초 경과${rem}`;
    }
    // 웨이브 버튼에 남은 적 수 표시
    const btn = this.els.btnWave;
    if (btn && btn.disabled) {
      btn.textContent = remaining > 0 ? `⏳ 남은 적 ${remaining}마리` : '⏳ 마무리 중...';
    }
  }

  buildTowerBar() {
    this.els.towerBar.innerHTML = '';
    this.els.towerBar.classList.add('tower-bar-real');

    const scroll = document.createElement('div');
    scroll.className = 'tower-bar-scroll gacha-bar';

    // 뽑기 버튼 3종
    const pulls = [
      { key:'normal',  label:'일반 뽑기',  cost:50,  color:'#9e9e9e', emoji:'🎰', hotkey:'1' },
      { key:'premium', label:'프리미엄',   cost:120, color:'#4fc3f7', emoji:'💎', hotkey:'2' },
      { key:'gamble',  label:'도박 뽑기',  cost:200, color:'#ffd60a', emoji:'🎲', hotkey:'3' },
      { key:'ten',     label:'10연 뽑기',  cost:450, color:'#ce93d8', emoji:'🌟', ten:true, hotkey:'4' },
    ];

    for (const p of pulls) {
      const btn = document.createElement('button');
      btn.className = 'tower-btn gacha-btn';
      btn.dataset.pullKey = p.key;
      btn.style.borderColor = p.color + '60';
      btn.innerHTML = `
        <span class="hotkey-badge">${p.hotkey}</span>
        <span class="tower-btn-emoji">${p.emoji}</span>
        <span class="tower-btn-name" style="color:${p.color}">${p.label}</span>
        <span class="tower-btn-cost">💰${p.cost}</span>
      `;
      btn.title = p.key === 'gamble' ? '에픽~레전드 확률 높음! (단축키: ' + p.hotkey + ')' :
                  p.key === 'ten'    ? '10개! 에픽 1개 보장 (단축키: ' + p.hotkey + ')' :
                  p.key === 'premium'? '레어~에픽 위주 (단축키: ' + p.hotkey + ')' : '노말~레어 위주 (단축키: ' + p.hotkey + ')';
      btn.addEventListener('click', () => this.doPull(p.key, btn));
      scroll.appendChild(btn);
    }

    // 구분선
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;background:rgba(255,255,255,0.1);margin:4px 2px;flex-shrink:0';
    scroll.appendChild(sep);

    // 영웅 버튼들
    const heroUnlockWave = { pikachu:0, mew:5, togepi:10, charizard:8, blastoise:13, eevee:3 };
    for (const heroId of ['pikachu', 'mew', 'togepi', 'charizard', 'blastoise', 'eevee']) {
      const def = window.HeroDefs[heroId];
      const btn = document.createElement('button');
      const unlockWave = heroUnlockWave[heroId];
      const unlocked = !this.engine || this.engine.currentWave >= unlockWave;
      btn.className = 'tower-btn hero-btn' + (unlocked ? '' : ' hero-btn-locked');
      btn.dataset.heroKey = heroId;
      const skinId = this.selectedHeroSkins[heroId];
      const skin = window.SkinDefs[heroId][skinId];
      btn.innerHTML = `
        <span class="tower-btn-emoji">${skin.emoji}</span>
        <span class="tower-btn-name">${def.name}</span>
        <span class="tower-btn-cost">${unlocked ? '👆이동 🎨스킨' : `🔒W${unlockWave}`}</span>
        ${!unlocked ? '<span class="lock-badge">🔒</span>' : ''}
      `;
      btn.title = unlocked ? def.passive : `웨이브 ${unlockWave} 이후 해금`;
      btn.addEventListener('click', () => {
        if (!unlocked && this.engine && this.engine.currentWave < unlockWave) {
          this.showWaveAnnounce(`웨이브 ${unlockWave} 이후 해금됩니다`, '#ff6b6b');
          return;
        }
        this.selectHeroToPlace(heroId, btn);
      });
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openSkinPicker(heroId); });
      let pressTimer;
      btn.addEventListener('touchstart', () => { pressTimer = setTimeout(() => this.openSkinPicker(heroId), 500); });
      btn.addEventListener('touchend', () => clearTimeout(pressTimer));
      scroll.appendChild(btn);
    }

    this.els.towerBar.appendChild(scroll);
    this._towerBarScroll = scroll;
    this.refreshPullButtons();
  }

  refreshPullButtons() {
    if (!this._towerBarScroll) return;
    const gold = this.engine ? this.engine.gold : 999;
    this._towerBarScroll.querySelectorAll('.gacha-btn').forEach(btn => {
      const key = btn.dataset.pullKey;
      const cost = key === 'ten' ? window.PULL_COSTS.ten : window.PULL_COSTS[key];
      btn.disabled = gold < cost;
    });
  }

  doPull(pullKey, btnEl) {
    if (!this.engine) return;
    const slotIdx = this.engine.selectedSlotIdx;
    if (slotIdx === null || this.engine.towerSlots[slotIdx]?.occupied) {
      this.showWaveAnnounce('빈 슬롯을 먼저 클릭하세요! 🎯', '#ffd60a');
      return;
    }

    const cost = pullKey === 'ten' ? window.PULL_COSTS.ten : window.PULL_COSTS[pullKey];
    if (!this.engine.spendGold(cost)) {
      this.showWaveAnnounce('골드가 부족합니다', '#ff6b6b');
      return;
    }

    if (pullKey === 'ten') {
      const results = [];
      for (let i = 0; i < 10; i++) {
        // index 4, 8번째는 에픽 보장
        const key = (i === 4 || i === 8) ? 'gamble' : 'ten_base';
        results.push(window.rollTower(key));
      }
      this._showTenPullResult(results, slotIdx);
      if (this.missionTracker) {
        this.missionTracker.stats.tenPullCount++;
        this.missionTracker.check();
      }
      return;
    }

    // 단일 뽑기
    const towerDef = window.rollTower(pullKey);
    this._placePulledTower(towerDef, slotIdx);

    // 뽑기 등급 팝업 + 효과음
    const gradeSound = {normal:'pull_normal', rare:'pull_rare', epic:'pull_epic', legend:'pull_epic', unique:'merge'};
    this.SFX.play(gradeSound[towerDef.grade] || 'pull_normal');
    if (towerDef.grade !== 'normal') {
      const g = window.GRADES?.[towerDef.grade]; this.showWaveAnnounce(`${towerDef.emoji} ${g?.name||""} ${towerDef.name}`, g?.color||"#ffd60a");
    }

    // 미션 트래킹
    if (this.missionTracker) {
      if (towerDef.grade === 'rare' || towerDef.grade === 'epic' || towerDef.grade === 'legend' || towerDef.grade === 'unique')
        this.missionTracker.stats.totalRareCount++;
      if (towerDef.grade === 'epic' || towerDef.grade === 'legend' || towerDef.grade === 'unique')
        this.missionTracker.stats.totalEpicCount++;
      if (towerDef.grade === 'legend' || towerDef.grade === 'unique')
        this.missionTracker.stats.totalLegendCount++;
      if (towerDef.grade === 'unique')
        this.missionTracker.stats.totalUniqueCount++;
      if (pullKey === 'gamble') this.missionTracker.stats.gambleCount++;
      this.missionTracker.check();
    }

    btnEl.classList.add('active');
    setTimeout(() => btnEl.classList.remove('active'), 300);
  }

  _placePulledTower(def, slotIdx) {
    const slot = this.engine.towerSlots[slotIdx];
    if (!slot || slot.occupied) return;
    const tower = window._createGachaTower(def, slot.x, slot.y);
    slot.occupied = true;
    slot.tower = tower;
    this.engine.towers.push(tower);
    this.engine.selectedSlotIdx = null;
    this.engine.selectedTower = null;

    if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
    this.refreshPullButtons();
  }

  _showTenPullResult(results, slotIdx) {
    // 모든 10개를 보관함에 추가 + 팝업으로 보여줌
    if (!this._inventory) this._inventory = [];
    this._inventory.push(...results);

    const overlay = document.createElement('div');
    overlay.className = 'tenpull-overlay';

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.innerHTML = `🌟 10연 뽑기 — 배치할 타워 선택 (나머지→보관함)`;
    overlay.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'tenpull-grid';

    for (const def of results) {
      const grade = window.GRADES[def.grade];
      const card = document.createElement('div');
      card.className = `tenpull-card grade-${def.grade}`;
      card.style.borderColor = grade.color;
      card.style.boxShadow = `0 0 12px ${grade.glow}`;
      card.innerHTML = `
        <div class="tp-emoji">${def.emoji}</div>
        <div class="tp-name" style="color:${grade.color}">${def.name}</div>
        <div class="tp-grade">${'★'.repeat(grade.stars)}</div>
        <div class="tp-grade-name">${grade.name}</div>
      `;
      card.style.cursor = 'pointer';
      card.title = '클릭해서 배치';
      card.addEventListener('click', () => {
        overlay.remove();
        this.engine.selectedSlotIdx = slotIdx;
        this._placePulledTower(def, slotIdx);
        const gd = window.GRADES?.[def.grade];
        this.showWaveAnnounce(`${def.emoji} ${def.name} 배치!`, gd?.color||'#ffd60a');
        const others = results.filter(r => r !== def);
        this._inventory.push(...others);
        this._refreshInventoryBtn();
      });
      grid.appendChild(card);
    }
    overlay.appendChild(grid);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '전부 보관함에 넣기';
    closeBtn.addEventListener('click', () => {
      overlay.remove();
      this._inventory.push(...results);
      this._refreshInventoryBtn();
    });
    overlay.appendChild(closeBtn);
    document.getElementById('game-screen').appendChild(overlay);

    if (this.missionTracker) {
      for (const def of results) {
        if (def.grade !== 'normal') this.missionTracker.stats.totalRareCount++;
        if (['epic','legend','unique'].includes(def.grade)) this.missionTracker.stats.totalEpicCount++;
        if (['legend','unique'].includes(def.grade)) this.missionTracker.stats.totalLegendCount++;
        if (def.grade === 'unique') this.missionTracker.stats.totalUniqueCount++;
      }
      this.missionTracker.stats.tenPullCount++;
      this.missionTracker.check();
    }
  }

  _refreshInventoryBtn() {
    // 보관함 버튼 (타워바 맨 앞) 업데이트
    let invBtn = document.getElementById('inventory-btn');
    if (!invBtn) {
      invBtn = document.createElement('button');
      invBtn.id = 'inventory-btn';
      invBtn.className = 'tower-btn';
      invBtn.style.cssText = 'border-color:rgba(255,214,10,0.5);background:rgba(255,214,10,0.1);';
      if (this._towerBarScroll) this._towerBarScroll.prepend(invBtn);
    }
    const count = this._inventory ? this._inventory.length : 0;
    invBtn.innerHTML = `
      <span class="tower-btn-emoji">🎒</span>
      <span class="tower-btn-name" style="color:#ffd60a">보관함</span>
      <span class="tower-btn-cost">${count}개</span>
    `;
    invBtn.style.display = count > 0 ? '' : 'none';
    invBtn.onclick = () => this._openInventory();
  }

  _openInventory() {
    const slotIdx = this.engine?.selectedSlotIdx;
    if (slotIdx === null || slotIdx === undefined || this.engine.towerSlots[slotIdx]?.occupied) {
      this.showWaveAnnounce('빈 슬롯을 먼저 클릭하세요!', '#ffd60a');
      return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'tenpull-overlay';
    overlay.innerHTML = `<div class="skilltree-title">🎒 보관함 — 배치할 타워를 선택하세요</div>`;
    const grid = document.createElement('div');
    grid.className = 'tenpull-grid';

    (this._inventory || []).forEach((def, idx) => {
      const grade = window.GRADES[def.grade];
      const card = document.createElement('div');
      card.className = `tenpull-card grade-${def.grade}`;
      card.style.borderColor = grade.color;
      card.style.boxShadow = `0 0 10px ${grade.glow}`;
      card.innerHTML = `
        <div class="tp-emoji">${def.emoji}</div>
        <div class="tp-name" style="color:${grade.color}">${def.name}</div>
        <div class="tp-grade">${'★'.repeat(grade.stars)}</div>
        <div class="tp-grade-name">${grade.name}</div>
      `;
      card.addEventListener('click', () => {
        this._inventory.splice(idx, 1);
        overlay.remove();
        this._placePulledTower(def, slotIdx);
        this.showWaveAnnounce(`${def.emoji} ${def.name} 배치!`, grade.color);
        this._refreshInventoryBtn();
      });
      grid.appendChild(card);
    });

    overlay.appendChild(grid);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    document.getElementById('game-screen').appendChild(overlay);
  }

  selectHeroToPlace(heroId, btnEl) {
    if (!this.engine) return;
    const alreadyPlaced = this.engine.heroes.some(h => h.id === heroId);
    this.engine.selectedTowerType = null;
    this.placingHero = this.placingHero === heroId ? null : heroId;
    this._towerBarScroll?.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    if (this.placingHero) {
      btnEl.classList.add('active');
      const emoji = btnEl.querySelector('.tower-btn-emoji')?.textContent || '';
      this.showWaveAnnounce(
        alreadyPlaced ? emoji + ' 화면 어디든 탭해서 이동!' : emoji + ' 화면 어디든 탭해서 배치!',
        '#ffd60a'
      );
    }
  }

  openEvolutionPicker(hero) {
    const existing = document.querySelector('.skin-picker');
    if (existing) existing.remove();
    if (this.engine) this.engine.stop();

    const overlay = document.createElement('div');
    overlay.className = 'skin-picker';
    const title = document.createElement('div');
    title.className = 'skin-picker-title';
    title.textContent = `✨ ${hero.def.name} 진화! 어떤 모습으로 진화할까?`;
    overlay.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'skin-grid';
    for (const option of hero.def.evolution.options) {
      const card = document.createElement('div');
      card.className = 'skin-card';
      card.style.borderColor = option.color;
      card.innerHTML = `
        <div class="skin-emoji" style="color:${option.color}">✨</div>
        <div class="skin-name">${option.name}</div>
        <div style="font-size:10px;color:${option.color};margin-top:2px">${option.focus || ''}</div>
      `;
      card.addEventListener('click', () => {
        hero.evolve(option.id, this.engine);
        overlay.remove();
        if (this.engine) this.engine.start();
      });
      grid.appendChild(card);
    }
    overlay.appendChild(grid);
    document.getElementById('game-screen').appendChild(overlay);
  }

  openSkinPicker(heroId) {
    const existing = document.querySelector('.skin-picker');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'skin-picker';
    const skins = window.SkinDefs[heroId];
    const title = document.createElement('div');
    title.className = 'skin-picker-title';
    title.textContent = `${window.HeroDefs[heroId].name} 스킨 선택`;
    overlay.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'skin-grid';
    for (const skinId in skins) {
      const s = skins[skinId];
      const unlocked = window.HeroProgress.isUnlocked(heroId, skinId);
      const card = document.createElement('div');
      card.className = 'skin-card' + (unlocked ? '' : ' locked') + (this.selectedHeroSkins[heroId] === skinId ? ' selected' : '');
      card.innerHTML = `
        <div class="skin-emoji">${s.emoji}</div>
        <div class="skin-name">${s.name}</div>
        ${unlocked ? '' : '<div class="skin-lock">🔒</div>'}
      `;
      card.addEventListener('click', () => {
        if (!unlocked) {
          this.showWaveAnnounce(`${s.name} 스킨은 잠겨있습니다`, '#ff6b6b');
          return;
        }
        this.selectedHeroSkins[heroId] = skinId;
        if (this.engine) {
          const placed = this.engine.heroes.find(h => h.id === heroId);
          if (placed) placed.skinId = skinId;
        }
        this.buildTowerBar();
        overlay.remove();
      });
      grid.appendChild(card);
    }
    overlay.appendChild(grid);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  }

  startGame(mapId) {
    this.currentMapId = mapId;
    this.els.mapSelect.classList.remove('active');
    this.els.gameScreen.classList.add('active');
    this.BGM.start(mapId);

    this.engine = new GameEngine(this.els.canvas);
    this.engine.heroes = [];
    this.engine.spellMgr = this.spellMgr;
    this.spellMgr.cooldowns = { pokecenter: 0, masterball: 0 };

    // 미션 트래커 초기화
    this.missionTracker = new MissionTracker();
    this.missionTracker.onComplete = (mission) => this._onMissionComplete(mission);

    this.engine.onGoldChange  = g => { this.els.goldVal.textContent = g; this.refreshPullButtons(); };
    this.engine.onHitSound = () => { if (Math.random() < 0.3) this.SFX.play('hit'); };
    this.engine.onLivesChange = l => {
      this.els.livesVal.textContent = l;
      document.getElementById('hud-lives').style.color = l <= 5 ? '#ff4444' : '';
    };
    this.engine.onWaveChange  = (w, t) => {
      this.els.waveVal.textContent = w;
      this.els.waveTotal.textContent = t;
    };
    const hudTimer = document.getElementById('hud-timer');
    const timerVal = document.getElementById('timer-val');
    this.engine.onWaveTimerChange = (remaining, total) => {
      if (!hudTimer) return;
      if (remaining <= 0 && this.engine.state !== 'wave') { hudTimer.style.display = 'none'; return; }
      hudTimer.style.display = 'flex';
      timerVal.textContent = Math.ceil(remaining);
      hudTimer.classList.toggle('timer-danger', remaining <= 8);
      hudTimer.classList.toggle('timer-warn', remaining > 8 && remaining <= 18);
    };
    this.engine.onWaveTimeout = (penalty, survivorCount) => {
      if (hudTimer) hudTimer.style.display = 'none';
      this.showWaveAnnounce(`⏱ 시간 초과! 놓친 ${survivorCount}마리 -${penalty} 라이프`, '#ff4444');
      if (this.missionTracker) { this.missionTracker.stats.timeouts = (this.missionTracker.stats.timeouts||0) + 1; }
    };
    this.engine.onEliteKill = () => {
      if (!this.missionTracker) return;
      this.missionTracker.stats.eliteGoldKills = (this.missionTracker.stats.eliteGoldKills||0) + 1;
      this.missionTracker.check();
    };
    this.engine.onHeroEvolutionReady = (hero) => this.openEvolutionPicker(hero);
    this.engine.onComboChange = (count, mul) => {
      const comboCell = document.getElementById('hud-combo');
      const comboVal = document.getElementById('combo-val');
      const comboMul = document.getElementById('combo-mul');
      if (count > 0) {
        comboCell.style.display = 'flex';
        comboVal.textContent = count;
        comboMul.textContent = `×${mul.toFixed(1)}`;
        comboCell.style.borderColor = count >= 20 ? 'rgba(255,60,60,0.5)' : count >= 10 ? 'rgba(255,214,10,0.4)' : 'rgba(255,143,0,0.3)';
      } else {
        comboCell.style.display = 'none';
      }
    };
    this.engine.onBossAppear = (boss) => {
      this.SFX.play('boss');
      const el = document.createElement('div');
      el.className = 'wave-announce boss';
      el.innerHTML = `${boss.def.emoji} ${boss.name} 등장!<br><span style="font-size:0.7em">⚠️ 보스</span>`;
      document.getElementById('game-screen').appendChild(el);
      setTimeout(() => el.remove(), 2800);
      this.engine.triggerScreenShake(10, 0.4);
    };
    const origLoseLife = this.engine.loseLife.bind(this.engine);
    this.engine.loseLife = (n) => { this.SFX.play('life_lost'); origLoseLife(n); };
    this.engine.onWaveComplete = (wave, bonus, timedOut) => {
      if (hudTimer) hudTimer.style.display = 'none';
      this.els.btnWave.disabled = false;
      if (!timedOut) this.SFX.play('wave_clear');
      if (wave >= this.engine.totalWaves) {
        this.els.btnWave.textContent = '🏆 완료!';
      } else {
        // 자동 웨이브 카운트다운 10초
        this._startAutoWaveCountdown(wave + 1);
      }
      if (!timedOut) this.showWaveAnnounce(`Wave ${wave} 클리어! +${bonus}g`, '#ffd60a');
      if (wave === 5)  this.showWaveAnnounce('✨ 뮤 해금!', '#f48fb1');
      if (wave === 8)  { this.showWaveAnnounce('🔥 리자몽 해금!', '#ff5722'); if (this.missionTracker) this.missionTracker.stats.heroCharizard = true; }
      if (wave === 10) this.showWaveAnnounce('✨ 토게피 해금!', '#fff9c4');
      if (wave === 13) { this.showWaveAnnounce('🌊 거북왕 해금!', '#0288d1'); if (this.missionTracker) this.missionTracker.stats.heroBlastoise = true; }
      if (this.missionTracker && this.difficulty === 'hard' && !timedOut) {
        this.missionTracker.stats.hardWavesCleared = (this.missionTracker.stats.hardWavesCleared||0) + 1;
      }
      this.buildTowerBar();
      if (this.missionTracker) {
        this.missionTracker.stats.wavesCleared = wave;
        this.missionTracker.check();
      }
      if (wave % 5 === 0 && wave < this.engine.totalWaves) {
        setTimeout(() => this.openShop(), 700);
      }
    };
    this.engine.onGameOver = () => this.showEndScreen(false, 0);
    this.engine.onVictory  = (stars) => {
      this.checkSkinUnlocks(stars);
      this.showEndScreen(true, stars);
    };

    this.engine.totalWaves = 20;
    const dm = (window.DifficultyMods && window.DifficultyMods[this.difficulty]) || { livesStart:20, goldStart:250 };
    this.engine.difficulty = this.difficulty;
    this.engine.lives = dm.livesStart;
    this.engine.gold = dm.goldStart;
    this.engine.init(mapId);

    this.els.goldVal.textContent = this.engine.gold;
    this.els.livesVal.textContent = this.engine.lives;
    this.els.waveVal.textContent = 0;
    this.els.waveTotal.textContent = 20;
    this.els.btnWave.textContent = '▶ 웨이브 1';
    this.els.btnWave.disabled = false;

    this.bindCanvasInput();
    this.buildTowerBar();
    this.buildSpellBar();
    this.buildTypeUpgradeBar();
    this.startHeroLoop();
  }

  startHeroLoop() {
    this._waveTimer = 0;
    const origUpdate = this.engine.update.bind(this.engine);
    this.engine.update = () => {
      origUpdate();
      if (this.engine.state === 'wave' || this.engine.state === 'idle') {
        for (const h of this.engine.heroes) h.update(this.engine.dt, this.engine);
        this.spellMgr.update(this.engine.dt);
        this.updateSpellBarUI();
        this.updateHeroSkillBarUI();
      }
      // 웨이브 진행 중 타이머 + 남은 적 표시
      if (this.engine.state === 'wave') {
        this._waveTimer += this.engine.dt;
        this._updateWaveHUD();
      } else {
        this._waveTimer = 0;
        const timerEl = document.getElementById('hud-wave-info');
        if (timerEl) timerEl.textContent = '';
      }
    };

    const origDraw = this.engine.draw.bind(this.engine);
    this.engine.draw = () => {
      origDraw();
      for (const h of this.engine.heroes) h.draw(this.engine.ctx);
    };

    const origPlace = this.engine.placeTower.bind(this.engine);
    this.engine.placeTower = (TowerClass, slotIdx) => {
      const result = origPlace(TowerClass, slotIdx);
      if (result) {
        window.applyTowerSynergies(this.engine.towers);
      }
      return result;
    };

    const origTap = this.engine.handleTap.bind(this.engine);
    this.engine.handleTap = (x, y) => {
      if (this.placingHero) {
        // 슬롯이든 빈 곳이든 어디든 배치 가능
        const HUD = 52, BAR = 82;
        if (y > HUD && y < this.engine.height - BAR) {
          const skinId = this.selectedHeroSkins[this.placingHero];
          // 이미 배치된 영웅이면 위치만 이동
          const existing = this.engine.heroes.find(h => h.id === this.placingHero);
          if (existing) {
            existing.x = x; existing.y = y;
          } else {
            const hero = new Hero(this.placingHero, x, y, skinId);
            this.engine.heroes.push(hero);
            this.buildHeroSkillBar();
          }
          this.placingHero = null;
          this._towerBarScroll?.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
          this.refreshPullButtons();
        }
        return;
      }
      origTap(x, y);
      const selIdx = this.engine.selectedSlotIdx;
      if (selIdx !== null && !this.engine.towerSlots[selIdx].occupied) {
        document.querySelectorAll('.gacha-btn').forEach(b => b.classList.add('slot-ready'));
        this.showWaveAnnounce('🎯 뽑기 버튼을 클릭!', '#4cc9f0');
      } else {
        document.querySelectorAll('.gacha-btn').forEach(b => b.classList.remove('slot-ready'));
      }
      this.syncTowerPanel();
    };
  }

  // ===== 타워 패널 (가챠 전용) =====
  syncTowerPanel() {
    let panel = document.getElementById('tower-panel');
    if (!this.engine.selectedTower) { panel?.remove(); return; }

    const t = this.engine.selectedTower;
    const slotIdx = this.engine.towerSlots.findIndex(s => s.tower === t);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tower-panel';
      document.getElementById('game-screen').appendChild(panel);
    }

    const def = t.def || t;
    const isGacha = !!t._gachaId;

    if (isGacha) {
      // ===== 가챠 타워 패널 =====
      const grade = window.GRADES?.[def.grade] || { name:'?', color:'#fff', stars:1 };
      const dps = (t.damage * t.fireRate).toFixed(1);
      const sameSlots = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === t._gachaId);
      const sameCount = sameSlots.length;
      const canMerge = sameCount >= 3;
      const evolveId = window.MERGE_EVOLUTION?.[t._gachaId];
      const evolveDef = evolveId ? window.GachaTowerDefs?.[evolveId] : null;
      const synergyInfo = t.synergyBonus > 0
        ? `<span style="color:#ffd60a;font-size:10px">⚡시너지 +${t.synergyBonus}</span>` : '';
      const refundCosts = {normal:35, rare:84, epic:140, legend:240, unique:420};
      const refund = refundCosts[def.grade] || 35;

      panel.innerHTML = `
        <div class="tower-panel-name" style="color:${grade.color}">
          ${def.emoji} ${def.name} ${'★'.repeat(grade.stars)} <span style="font-size:10px">${grade.name}</span>
        </div>
        <div class="tower-panel-stats">⚔️${Math.round(t.damage)} · ⏱️${t.fireRate.toFixed(1)}/s · DPS:${dps} · 📏${Math.round(t.range)} ${synergyInfo}</div>
        <div style="font-size:10px;color:#aaa;margin:2px 0">${def.desc||''}</div>
        <div style="font-size:10px;margin:3px 0;color:${canMerge?'#ffd60a':'#888'}">
          ${canMerge
            ? `✅ 합치기 가능! (${sameCount}/3)${evolveDef?' → '+evolveDef.emoji+evolveDef.name:''}`
            : `동일 타워 ${sameCount}/3${evolveDef?' (목표: '+evolveDef.emoji+evolveDef.name+')':''}`}
        </div>
        <div class="tower-panel-btns">
          ${canMerge
            ? `<button class="tp-btn tp-upgrade" data-action="merge">✨ 합치기 진화!</button>`
            : `<button class="tp-btn tp-maxed" disabled>합치기 ${sameCount}/3</button>`}
          <button class="tp-btn tp-sell" data-action="sell">💸 +${refund}g</button>
        </div>
      `;

      panel.querySelector('[data-action="merge"]')?.addEventListener('click', () => {
        const allSameSlots = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === t._gachaId);
        if (allSameSlots.length < 3 || !evolveDef) return;
        // 현재 선택 슬롯을 항상 진화 위치로 고정
        const currentSlot = this.engine.towerSlots[slotIdx];
        const otherSlots = allSameSlots.filter(s => s !== currentSlot).slice(0, 2);
        const mergeSlots = [currentSlot, ...otherSlots];
        for (let i = 1; i < 3; i++) {
          this.engine.towers = this.engine.towers.filter(x => x !== mergeSlots[i].tower);
          mergeSlots[i].occupied = false; mergeSlots[i].tower = null;
        }
        const evoTower = window._createGachaTower(evolveDef, currentSlot.x, currentSlot.y);
        this.engine.towers = this.engine.towers.filter(x => x !== currentSlot.tower);
        this.engine.towers.push(evoTower);
        currentSlot.tower = evoTower;
        this.engine.selectedTower = evoTower;
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        const evoGrade = window.GRADES[evolveDef.grade];
        this.engine.spawnFloatingText(`✨ ${evolveDef.name}!`, currentSlot.x, currentSlot.y-40, evoGrade.color);
        this.engine.particles.push(new BurstRing(currentSlot.x, currentSlot.y, 70, evoGrade.color));
        this.engine.triggerScreenShake(6, 0.25);
        if (this.missionTracker) { this.missionTracker.stats.mergeCount++; this.missionTracker.check(); }
        this.SFX.play('merge');
        this.syncTowerPanel();
      });

      panel.querySelector('[data-action="sell"]')?.addEventListener('click', () => {
        // 실제 gold 환급
        this.engine.addGold(refund);
        this.engine.towers = this.engine.towers.filter(x => x !== t);
        const slot = this.engine.towerSlots[slotIdx];
        if (slot) { slot.occupied = false; slot.tower = null; }
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        this.engine.selectedTower = null;
        panel.remove();
        this.refreshPullButtons();
      });
    } else {
      // ===== 기존 업그레이드 타워 패널 (영웅 슬롯 등) =====
      const dps = (t.damage * t.fireRate).toFixed(1);
      panel.innerHTML = `
        <div class="tower-panel-name">${t.name}</div>
        <div class="tower-panel-stats">⚔️${Math.round(t.damage)} · ⏱️${t.fireRate.toFixed(1)}/s · DPS:${dps}</div>
        <div class="tower-panel-btns">
          <button class="tp-btn tp-sell" data-action="sell">💸 판매</button>
        </div>
      `;
      panel.querySelector('[data-action="sell"]')?.addEventListener('click', () => {
        this.engine.sellTower(slotIdx);
        this.engine.selectedTower = null; panel.remove();
      });
    }
  }

  buildHeroSkillBar() {
    let bar = document.getElementById('hero-skill-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'hero-skill-bar';
      document.getElementById('game-screen').appendChild(bar);
    }
    bar.innerHTML = '';
    for (const hero of this.engine.heroes) {
      const wrap = document.createElement('div');
      wrap.className = 'hero-skills-group';
      const label = document.createElement('div');
      label.className = 'hero-skills-label';
      label.textContent = `${hero.skin.emoji} ${hero.name} Lv${hero.level}`;
      wrap.appendChild(label);

      // 스킬 버튼
      const heroIdx = this.engine.heroes.indexOf(hero);
      const hotkeyMap = [['Q','W'],['E','R']][heroIdx] || [];
      hero.def.skills.forEach((skill, idx) => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.dataset.heroId = hero.id;
        btn.dataset.skillIdx = idx;
        btn.innerHTML = `<span class="hotkey-badge">${hotkeyMap[idx]||''}</span><span class="skill-emoji">${skill.emoji}</span><span class="skill-cd"></span>`;
        btn.title = `${skill.name}: ${skill.desc}${hotkeyMap[idx] ? ` (단축키: ${hotkeyMap[idx]})` : ''}`;
        btn.addEventListener('click', () => {
          if (hero.cast(idx, this.engine)) {
            this.showWaveAnnounce(`${skill.emoji} ${skill.name}!`, '#ffd60a');
          }
        });
        wrap.appendChild(btn);
      });

      // 스킬트리 버튼 (SP 있을 때만 강조)
      const treeBtn = document.createElement('button');
      treeBtn.className = 'skill-btn skill-tree-btn';
      treeBtn.dataset.heroId = hero.id;
      treeBtn.innerHTML = `<span class="skill-emoji">${hero.skillPoints > 0 ? '🌟' : '📊'}</span>`;
      treeBtn.title = `스킬트리 (SP: ${hero.skillPoints})`;
      if (hero.skillPoints > 0) treeBtn.style.borderColor = '#ffd60a';
      treeBtn.addEventListener('click', () => this.openSkillTree(hero));
      wrap.appendChild(treeBtn);

      bar.appendChild(wrap);
    }
  }

  updateHeroSkillBarUI() {
    const bar = document.getElementById('hero-skill-bar');
    if (!bar) return;
    for (const hero of this.engine.heroes) {
      hero.def.skills.forEach((skill, idx) => {
        const btn = bar.querySelector(`.skill-btn[data-hero-id="${hero.id}"][data-skill-idx="${idx}"]`);
        if (!btn) return;
        const cd = hero.cooldowns[idx];
        const cdEl = btn.querySelector('.skill-cd');
        if (cd > 0) {
          btn.classList.add('on-cooldown');
          cdEl.textContent = Math.ceil(cd);
        } else {
          btn.classList.remove('on-cooldown');
          cdEl.textContent = '';
        }
      });
    }
  }

  buildTypeUpgradeBar() {
    let bar = document.getElementById('type-upgrade-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'type-upgrade-bar';
      document.getElementById('game-screen').appendChild(bar);
    }
    bar.innerHTML = '';
    if (!window.TypeUpgrades || !window.TYPES) return;

    for (const typeKey in window.TypeUpgrades) {
      const typeInfo = window.TYPES[typeKey];
      const upgrades = window.TypeUpgrades[typeKey];
      const level = window.TypeUpgradeLevels?.[typeKey] || 0;
      if (level >= upgrades.length) continue; // 다 올렸으면 숨김

      const nextUpg = upgrades[level];
      const btn = document.createElement('button');
      btn.className = 'type-upg-btn';
      btn.dataset.typeKey = typeKey;
      btn.style.borderColor = typeInfo.color + '60';
      btn.innerHTML = `
        <span>${typeInfo.emoji}</span>
        <span style="font-size:9px;color:${typeInfo.color}">${typeInfo.name}</span>
        <span style="font-size:8px;color:#ffd60a">💰${nextUpg.cost}</span>
        <span style="font-size:7px;color:#888">${'●'.repeat(level)}${'○'.repeat(upgrades.length-level)}</span>
      `;
      btn.title = `${nextUpg.label}: ${nextUpg.cost}g`;
      btn.addEventListener('click', () => {
        if (!this.engine) return;
        if (window.applyTypeUpgrade(typeKey, this.engine)) {
          if (!this.missionTracker.stats.typeUpgrades) this.missionTracker.stats.typeUpgrades = {};
          this.missionTracker.stats.typeUpgrades[typeKey] = (this.missionTracker.stats.typeUpgrades[typeKey]||0) + 1;
          this.missionTracker.check();
          this.SFX.play('buy');
          this.buildTypeUpgradeBar(); // 갱신
        } else {
          this.showWaveAnnounce('골드 부족!', '#ff6b6b');
        }
      });
      bar.appendChild(btn);
    }
  }

  buildSpellBar() {
    let bar = document.getElementById('spell-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'spell-bar';
      document.getElementById('game-screen').appendChild(bar);
    }
    bar.innerHTML = '';
    for (const key in window.GlobalSpells) {
      const spell = window.GlobalSpells[key];
      const btn = document.createElement('button');
      btn.className = 'spell-btn';
      btn.dataset.spellKey = key;
      btn.innerHTML = `
        <span class="spell-emoji">${spell.emoji}</span>
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:1px">
          <span class="spell-name" style="font-size:11px;font-weight:700">${spell.name}</span>
          <span style="font-size:9px;color:#888;line-height:1.2">${spell.desc}</span>
        </div>
        <span class="spell-cd"></span>
      `;
      btn.title = `${spell.name}: ${spell.desc} (쿨타임 ${spell.cooldown}초)`;
      btn.addEventListener('click', () => { this.spellMgr.cast(key, this.engine); });
      bar.appendChild(btn);
    }
  }

  updateSpellBarUI() {
    const bar = document.getElementById('spell-bar');
    if (!bar) return;
    for (const key in window.GlobalSpells) {
      const btn = bar.querySelector(`.spell-btn[data-spell-key="${key}"]`);
      if (!btn) continue;
      const cd = this.spellMgr.cooldowns[key];
      const cdEl = btn.querySelector('.spell-cd');
      if (cd > 0) {
        btn.classList.add('on-cooldown');
        cdEl.textContent = Math.ceil(cd);
      } else {
        btn.classList.remove('on-cooldown');
        cdEl.textContent = '';
      }
    }
  }

  openSkillTree(hero) {
    const existing = document.querySelector('.skilltree-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'skilltree-overlay';

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.innerHTML = `${hero.skin.emoji} ${hero.name} 스킬트리 <span class="sp-badge">SP: ${hero.skillPoints}</span>`;
    overlay.appendChild(title);

    const tree = window.SkillTrees[hero.id];
    if (tree) {
      const grid = document.createElement('div');
      grid.className = 'skilltree-grid';

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const node = tree.nodes.find(n => n.col === col && n.row === row);
          const cell = document.createElement('div');
          if (node) {
            const isUnlocked = hero.unlockedSkills.has(node.id);
            const canUnlock = !isUnlocked && hero.skillPoints >= node.cost &&
                              (!node.requires || hero.unlockedSkills.has(node.requires));
            cell.className = `st-node ${isUnlocked ? 'unlocked' : ''} ${canUnlock ? 'available' : ''} ${!isUnlocked && !canUnlock ? 'locked' : ''}`;
            cell.innerHTML = `
              <div class="st-emoji">${node.emoji}</div>
              <div class="st-name">${node.name}</div>
              <div class="st-cost">${isUnlocked ? '✅' : `💎${node.cost}`}</div>
            `;
            cell.title = node.desc;
            if (canUnlock) {
              cell.addEventListener('click', () => {
                if (hero.unlockSkillNode(node.id, this.engine)) {
                  this.openSkillTree(hero); // 새로고침
                  this.buildHeroSkillBar();
                }
              });
            }
          } else {
            cell.className = 'st-node empty';
          }
          grid.appendChild(cell);
        }
      }
      overlay.appendChild(grid);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  }

  _onMissionComplete(mission) {
    // 보상 지급
    if (mission.rewardType === 'gold' && this.engine) {
      this.engine.addGold(mission.reward);
    }
    // 팝업
    const el = document.createElement('div');
    el.className = 'mission-popup';
    el.innerHTML = `
      <div class="mission-popup-title">🎯 미션 완료!</div>
      <div class="mission-popup-name">${mission.name}</div>
      <div class="mission-popup-reward">+${mission.reward}g 획득!</div>
    `;
    document.getElementById('game-screen').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  openMissionBoard() {
    const existing = document.querySelector('.mission-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'mission-overlay';

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.textContent = '🎯 미션 보드';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.className = 'mission-list';

    const tracker = this.missionTracker;
    for (const m of window.MissionDefs) {
      const done = tracker && tracker.completed.has(m.id);
      const item = document.createElement('div');
      item.className = `mission-item ${done ? 'done' : ''}`;
      item.innerHTML = `
        <span class="mission-status">${done ? '✅' : '⬜'}</span>
        <div class="mission-info">
          <div class="mission-name">${m.name}</div>
          <div class="mission-desc">${m.desc}</div>
        </div>
        <div class="mission-reward">💰${m.reward}</div>
      `;
      list.appendChild(item);
    }
    overlay.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  }

  _startAutoWaveCountdown(nextWave) {
    if (this._autoWaveTimer) clearInterval(this._autoWaveTimer);
    let remaining = 10;
    this.els.btnWave.textContent = `▶ Wave ${nextWave} (${remaining}초)`;
    this._autoWaveTimer = setInterval(() => {
      remaining--;
      if (!this.engine || this.engine.state !== 'idle') {
        clearInterval(this._autoWaveTimer);
        return;
      }
      if (remaining <= 0) {
        clearInterval(this._autoWaveTimer);
        this.els.btnWave.textContent = `▶ Wave ${nextWave}`;
        this.sendWave();
      } else {
        this.els.btnWave.textContent = `▶ Wave ${nextWave} (${remaining}초)`;
      }
    }, 1000);
  }

  openShop() {
    if (!this.engine) return;
    this.engine.stop();
    const overlay = document.createElement('div');
    overlay.className = 'shop-overlay';

    const title = document.createElement('div');
    title.className = 'shop-title';
    title.textContent = `🛒 상점 (보유 골드: ${this.engine.gold}g)`;
    overlay.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    if (!this.engine._shopBuyCount) this.engine._shopBuyCount = {};
    for (const item of window.ShopItems) {
      const card = document.createElement('div');
      card.className = 'shop-card';
      const bought = this.engine._shopBuyCount[item.key] || 0;
      const soldOut = item.maxBuys && bought >= item.maxBuys;
      card.innerHTML = `
        <div class="shop-emoji">${item.emoji}</div>
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
        <button class="shop-buy-btn" ${soldOut ? 'disabled' : ''}>${soldOut ? '품절' : `💰${item.cost}`}</button>
      `;
      const buyBtn = card.querySelector('.shop-buy-btn');
      buyBtn.addEventListener('click', () => {
        if (soldOut) return;
        if (this.engine.gold < item.cost) {
          this.showWaveAnnounce('골드가 부족합니다', '#ff6b6b');
          return;
        }
        this.engine.spendGold(item.cost);
          item.buy(this.engine);
          this.engine._shopBuyCount[item.key] = (this.engine._shopBuyCount[item.key] || 0) + 1;
          title.textContent = `🛒 상점 (보유 골드: ${this.engine.gold}g)`;
          this.SFX.play('buy');
          this.showWaveAnnounce(`${item.emoji} ${item.name} 사용!`, '#06d6a0');
          if (item.maxBuys && this.engine._shopBuyCount[item.key] >= item.maxBuys) {
            buyBtn.disabled = true; buyBtn.textContent = '품절';
          }
      });
      grid.appendChild(card);
    }
    overlay.appendChild(grid);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'shop-close-btn';
    closeBtn.textContent = '상점 닫고 계속하기';
    closeBtn.addEventListener('click', () => { overlay.remove(); this.engine.start(); });
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  }

  checkSkinUnlocks(stars) {
    if (stars >= 3) {
      window.HeroProgress.unlockSkin('pikachu', 'christmas');
      window.HeroProgress.unlockSkin('mew', 'sakura');
    }
    if (stars >= 2) {
      window.HeroProgress.unlockSkin('togepi', 'christmas');
    }
    if (stars >= 1) {
      window.HeroProgress.unlockSkin('pikachu', 'sakura');
    }
  }

  bindCanvasInput() {
    const canvas = this.els.canvas;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      // canvas.width는 DPR 적용된 물리 픽셀, rect.width는 CSS 픽셀
      // engine 내부는 논리 좌표(CSS px)로 동작하므로 그냥 CSS 좌표 사용
      return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
      };
    };

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const pos = getPos(e);
      this.engine.handleTap(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const pos = getPos(e);
      this.engine.handleHover(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('click', e => {
      const pos = getPos(e);
      this.engine.handleTap(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', e => {
      const pos = getPos(e);
      this.engine.handleHover(pos.x, pos.y);
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
      this.engine.buildPaths();
      // 슬롯은 재빌드하지 않음 - 타워 배치 유지
      this.engine._bgDirty = true;
    });
  }

  sendWave() {
    const e = this.engine;
    if (!e || e.state !== 'idle') return;
    const waveIdx = e.currentWave;
    if (waveIdx >= WaveData.length) return;

    let wave = WaveData[waveIdx];

    // 보스 웨이브 경고
    const bossWaves = { 10: '⚠️ 갸라도스 중간보스 등장!', 16: '☠️ 루기아 준보스 등장!', 20: '🔮 최종보스 뮤츠!' };
    const nextWave = waveIdx + 1;
    if (bossWaves[nextWave]) {
      const el = document.createElement('div');
      el.className = 'wave-announce boss';
      el.textContent = bossWaves[nextWave];
      document.getElementById('game-screen').appendChild(el);
      setTimeout(() => el.remove(), 2500);
    }

    const timeLimit = waveTimeLimit(wave, this.difficulty);
    if (e.startWave(wave, timeLimit)) {
      this.els.btnWave.disabled = true;
      this.els.btnWave.textContent = '⏳ 진행 중...';
      setTimeout(() => this.showWaveAnnounce(`Wave ${e.currentWave}`, '#ffd60a'), 100);
    }
  }

  showWaveAnnounce(text, color) {
    const el = document.createElement('div');
    el.className = 'wave-announce';
    el.style.color = color;
    el.textContent = text;
    document.getElementById('game-screen').appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  showEndScreen(victory, stars) {
    this.engine.stop();
    const gameScreen = document.getElementById('game-screen');

    const overlay = document.createElement('div');
    overlay.className = 'end-overlay';

    const title = document.createElement('div');
    title.className = 'end-title ' + (victory ? 'victory' : 'gameover');
    title.textContent = victory ? '🏆 VICTORY!' : '💀 GAME OVER';
    overlay.appendChild(title);

    if (victory && stars > 0) {
      const starEl = document.createElement('div');
      starEl.className = 'end-stars';
      starEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
      overlay.appendChild(starEl);

      if (stars >= 1) {
        const unlockMsg = document.createElement('div');
        unlockMsg.className = 'end-unlock-msg';
        unlockMsg.textContent = '🎁 새로운 영웅 스킨이 해금되었습니다!';
        overlay.appendChild(unlockMsg);
      }
    }

    const btn = document.createElement('button');
    btn.className = 'end-btn';
    btn.textContent = '처음으로';
    btn.addEventListener('click', () => { overlay.remove(); this.backToMapSelect(); });
    overlay.appendChild(btn);

    gameScreen.appendChild(overlay);
  }

  backToMapSelect() {
    if (this._autoWaveTimer) { clearInterval(this._autoWaveTimer); this._autoWaveTimer = null; }
    this.BGM.stop();
    if (this.engine) { this.engine.stop(); this.engine = null; }
    // 배속 초기화
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b.dataset.speed === '1'));
    document.querySelectorAll('.gacha-btn').forEach(b => b.classList.remove('slot-ready'));
    this.els.gameScreen.classList.remove('active');
    this.els.mapSelect.classList.add('active');

    const ctx = this.els.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);

    document.querySelectorAll('.end-overlay,.wave-announce,.shop-overlay,.skin-picker,.skilltree-overlay').forEach(el => el.remove());
    const tp = document.getElementById('tower-panel');
    if (tp) tp.remove();

    const skillBar = document.getElementById('hero-skill-bar');
    if (skillBar) skillBar.innerHTML = '';
    const spellBar = document.getElementById('spell-bar');
    if (spellBar) spellBar.innerHTML = '';

    // 콤보 숨김
    const comboCell = document.getElementById('hud-combo');
    if (comboCell) comboCell.style.display = 'none';

    this.buildTowerBar();
  }

  togglePause() {
    if (!this.engine) return;
    if (this.engine.state === 'wave') {
      this.engine.state = 'paused';
      this.engine.stop();
      this.els.btnMenu.textContent = '▶';
    } else if (this.engine.state === 'paused') {
      this.engine.state = 'wave';
      this.engine.start();
      this.els.btnMenu.textContent = '☰';
    }
  }
}

// ===== BOOT =====
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  window.app = new App();
  initTitleCanvas();
});

// ===== 타이틀 화면 파티클 =====
function initTitleCanvas() {
  const canvas = document.getElementById('title-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W; canvas.height = H;

  const particles = [];
  const COLORS = ['#ffd60a','#4cc9f0','#f48fb1','#06d6a0','#c084fc','#ff6b6b'];
  const EMOJIS = ['⭐','✨','💫','🌟','⚡','💎'];

  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random()-0.5) * 20, vy: -15 - Math.random() * 25,
      r: 1 + Math.random() * 2.5,
      alpha: 0.3 + Math.random() * 0.5,
      color: COLORS[Math.floor(Math.random()*COLORS.length)],
      emoji: Math.random() < 0.15 ? EMOJIS[Math.floor(Math.random()*EMOJIS.length)] : null,
      size: 10 + Math.random() * 14,
      spin: (Math.random()-0.5) * 0.05,
      rot: Math.random() * Math.PI * 2,
    });
  }

  // 큰 배경 원들 (성운 느낌)
  const orbs = Array.from({length:5}, () => ({
    x: Math.random()*W, y: Math.random()*H,
    r: 80 + Math.random()*160,
    color: COLORS[Math.floor(Math.random()*COLORS.length)],
    phase: Math.random()*Math.PI*2, speed: 0.003 + Math.random()*0.004
  }));

  let frame = 0;
  function loop() {
    if (!document.getElementById('title-screen')?.classList.contains('active')) return;
    requestAnimationFrame(loop);
    frame++;

    W = canvas.clientWidth; H = canvas.clientHeight;
    if (canvas.width !== W || canvas.height !== H) { canvas.width=W; canvas.height=H; }

    // 배경
    ctx.fillStyle = '#030612';
    ctx.fillRect(0, 0, W, H);

    // 성운 orb
    for (const o of orbs) {
      o.phase += o.speed;
      const pulse = Math.sin(o.phase) * 0.15 + 0.85;
      const g = ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r*pulse);
      g.addColorStop(0, o.color + '12');
      g.addColorStop(0.5, o.color + '06');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(o.x,o.y,o.r*pulse,0,Math.PI*2); ctx.fill();
    }

    // 파티클
    for (const p of particles) {
      p.x += p.vx * 0.016; p.y += p.vy * 0.016;
      p.rot += p.spin;
      if (p.y < -30) { p.y = H + 10; p.x = Math.random()*W; }

      ctx.save();
      ctx.globalAlpha = p.alpha * (0.7 + Math.sin(frame*0.04 + p.rot)*0.3);
      if (p.emoji) {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.font = `${p.size}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(p.emoji, 0, 0);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // 하단 그라디언트 오버레이
    const grad = ctx.createLinearGradient(0, H*0.6, 0, H);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, 'rgba(3,6,18,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H*0.6, W, H*0.4);
  }
  loop();
}
