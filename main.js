// ===== MAIN.JS - 화면 관리 + HUD + 절차적 웨이브 생성(엔드리스) + 타워/영웅/상점 통합 =====

const WAVES_PER_ZONE = 30; // v27: 30웨이브씩 3존 순환(1~90), 90에서 왕 조우 후엔 존 전환 없이 그 자리에서 무한 강화
const ZONE_MAPS = ['forest', 'cave', 'city']; // 1~30 태초마을 숲 / 31~60 라벤더 동굴(우주 성운 테마) / 61~90 홍련체육관 도시(화산)
const ZONE_LABELS = ['🌲 초원 지대', '🌌 우주 동굴', '🌋 화산 도시'];
const KING_WAVE = 90;
// v27-4: 90웨이브부터는 존 전환 없이 마지막 존(화산 도시)에 고정 - "왕 조우 후 무한강화" 구조 (item 9)
function zoneIndexForWave(n) { return n >= KING_WAVE ? ZONE_MAPS.length - 1 : Math.floor((n - 1) / WAVES_PER_ZONE) % ZONE_MAPS.length; }
function zoneCycleForWave(n) { return Math.floor((n - 1) / WAVES_PER_ZONE); } // 난이도 스케일링용으로는 계속 증가 (30웨이브마다 한단계씩)

// 웨이브 진행도에 따라 열리는 적 티어 (기존 20웨이브 손수 작성 대신 공식으로 생성 - 튜닝 비용 최소화)
const ENEMY_TIERS = {
  t1: ['abo','rattata','jigglypuff','zubat','koffing'],
  t2: ['golbat','gastly','paras','magnemite','phantump'],
  t3: ['lapras','weezing','scyther','onix','haunter'],
  t4: ['gyarados','electrode','dragonite'],
};
const MINIBOSS_POOL = ['gyarados', 'dragonite'];
const BOSS_POOL = ['lugia', 'mewtwo'];

// v27-3: 보스 난이도 추가 상향 - 기본 배율을 더 키우고, 소환 시점 웨이브에 비례해서도 더 강해지게
// (10라운드째에도 5단계까지 다 잡히던 문제 - 고정배율만으론 후반에 상대적으로 계속 약해지므로 웨이브연동 필수)
const BOSS_TIERS = [
  { tier: 1, type: 'gyarados', label: '갸라도스',   hpMul: 10, rewardMul: 5  },
  { tier: 2, type: 'dragonite', label: '망나뇽',    hpMul: 18, rewardMul: 9  },
  { tier: 3, type: 'lugia',    label: '루기아',      hpMul: 30, rewardMul: 14 },
  { tier: 4, type: 'mewtwo',   label: '뮤츠',        hpMul: 48, rewardMul: 20 },
  { tier: 5, type: 'mewtwo',   label: '뮤츠(각성)',  hpMul: 80, rewardMul: 30 },
];
const BOSS_SUMMON_COOLDOWN = 60;
function bossWaveScaleMul(wave) { return 1 + Math.max(0, wave) * 0.07; } // 웨이브 진행할수록 소환보스도 계속 강해짐

// v27-4: 존별 적 타입 편향 (item17) - 존마다 특정 타입이 더 자주 나와서 전략적 예측/대응 여지를 줌
const ZONE_TYPE_BIAS = ['grass', 'psychic', 'fire']; // 숲=풀 위주 / 동굴=에스퍼 위주 / 도시=불 위주

// v27-6: 다음 웨이브 등장 가능 타입 미리보기 (요청6 - 랜덤roll 없이 풀 구성만 계산, 실제 스폰과 분리된 순수함수)
function previewWaveTypes(n) {
  const posInZone = ((n - 1) % WAVES_PER_ZONE) + 1;
  const progress = posInZone / WAVES_PER_ZONE;
  let pool = [...ENEMY_TIERS.t1];
  if (progress > 0.15) pool = pool.concat(ENEMY_TIERS.t2);
  if (progress > 0.42) pool = pool.concat(ENEMY_TIERS.t3);
  if (progress > 0.68) pool = pool.concat(ENEMY_TIERS.t4);
  if (typeof EnemyTypes === 'undefined') return [];
  const types = new Set(pool.map(id => EnemyTypes[id]?.type).filter(Boolean));
  return [...types];
}

function generateWave(n) {
  const posInZone = ((n - 1) % WAVES_PER_ZONE) + 1; // 1~30, 존이 바뀌어도 난이도 곡선은 동일 패턴 반복
  const cycle = zoneCycleForWave(n); // 90웨이브 넘어가서 같은 존이 다시 나올 때마다 +1씩 계속 강해짐
  const progress = posInZone / WAVES_PER_ZONE;
  let pool = [...ENEMY_TIERS.t1];
  if (progress > 0.15) pool = pool.concat(ENEMY_TIERS.t2);
  if (progress > 0.42) pool = pool.concat(ENEMY_TIERS.t3);
  if (progress > 0.68) pool = pool.concat(ENEMY_TIERS.t4);

  // 존별 편향: 해당 존 선호 타입 몬스터를 풀에 추가로 더 넣어서(가중치 효과) 등장 빈도를 높임
  const zoneIdx = zoneIndexForWave(n);
  const favType = ZONE_TYPE_BIAS[zoneIdx];
  if (typeof EnemyTypes !== 'undefined' && favType) {
    const favored = pool.filter(id => EnemyTypes[id]?.type === favType);
    for (let i = 0; i < 2; i++) pool = pool.concat(favored); // 3배 가중치
  }

  // 웨이브가 진행될수록 더 많이, 더 빽빽하게 스폰 (계속 돌면서 잡는 느낌). cycle이 늘수록(90웨이브 이후 반복) 한번 더 강화
  const enemyCount = Math.round(26 + n * 4.6 + cycle * 20);
  const baseInterval = Math.max(0.26, 0.85 - n * 0.014);
  const streams = 1 + Math.min(4, Math.floor(n / 6));

  const arr = [];
  for (let s = 0; s < streams; s++) {
    let delay = s * (baseInterval * 2.2);
    const countThisStream = Math.round(enemyCount / streams);
    for (let i = 0; i < countThisStream; i++) {
      const type = pool[Math.floor(Math.random() * pool.length)];
      arr.push({ type, delay });
      delay += baseInterval * streams * (0.75 + Math.random() * 0.5);
    }
  }
  arr.sort((a, b) => a.delay - b.delay);

  const lastDelay = arr.length ? arr[arr.length - 1].delay : 0;
  // v27-4: 90웨이브 = 왕(King) 조우, 이후엔 존전환 없이 무한강화만 계속 (item 9)
  if (n === KING_WAVE) {
    arr.push({ type: 'mewtwo', delay: lastDelay + 5, isKing: true });
  } else if (n % 30 === 0) {
    arr.push({ type: BOSS_POOL[Math.floor(Math.random() * BOSS_POOL.length)], delay: lastDelay + 4 });
  } else if (n % 10 === 0) {
    arr.push({ type: MINIBOSS_POOL[Math.floor(Math.random() * MINIBOSS_POOL.length)], delay: lastDelay + 4 });
  }

  return arr;
}

function seq(type, count, interval, pathIdx = 0, startDelay = 0) {
  const arr = [];
  for (let i = 0; i < count; i++) arr.push({ type, delay: startDelay + i * interval, pathIdx });
  return arr;
}

// 순환 트랙 제한시간: 마지막 스폰 시각 + 처치 여유시간(난이도별 가감)
// 여유시간은 실제 트랙 한 바퀴 길이(화면 크기에 비례)를 기준으로 계산 — 큰 화면일수록 트랙이 길어지므로 시간도 늘어나야 함
function waveTimeLimit(wave, difficulty, engine) {
  // v27-10: 복잡한 랩타임 기반 계산 대신 100초 고정으로 단순화 (요청: 웨이브 시간이 너무 길었음)
  return 100;
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
            boss:       { freq:[150,120,100],dur:0.85, vol:0.09, type:'triangle' },
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
            // v27-7: 왕 조우 이후 무한강화 구간 전용 테마 - 더 빠르고 낮은 음역으로 긴장감 부여 (요청5)
            infinite: { notes:[164,174,196,220,164,196,174,146], tempo:0.24, vol:0.07, wave:'sawtooth' },
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
    this.starterHero = 'pikachu';
    this.bindDifficultySelect();
    this.bindStarterHeroSelect();
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
        this._refreshBestWaveLabel();
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
    const startBtn = document.getElementById('btn-endless-start');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
    const skinBtn = document.getElementById('btn-title-skin');
    if (skinBtn) skinBtn.addEventListener('click', () => this.openSkinPicker(this.starterHero || 'pikachu'));
    const howtoBtn = document.getElementById('btn-howto');
    if (howtoBtn) howtoBtn.addEventListener('click', () => this._showHowToPlay());
  }

  // v27-7: 신규 유저 온보딩 - 간단한 게임방법 요약 (요청3)
  _showHowToPlay() {
    const overlay = document.createElement('div');
    overlay.className = 'skin-picker';
    overlay.innerHTML = `
      <div class="skin-picker-title">❓ 게임 방법</div>
      <div style="max-width:420px;text-align:left;color:#ddd;font-size:13px;line-height:1.9;padding:0 16px;max-height:60vh;overflow-y:auto;">
        <b style="color:#ffd60a">🎯 목표</b> — 라이프가 아니라 <b>필드에 쌓이는 몬스터 수(200마리)</b>로 게임오버가 결정됩니다. 최대한 오래 버티세요.<br><br>
        <b style="color:#ffd60a">🎰 뽑기</b> — 골드로 타워를 뽑아 빈 슬롯에 배치하세요. 등급이 높을수록 강합니다.<br><br>
        <b style="color:#ffd60a">🧬 합체</b> — 같은 타워 3개를 모으면 상위 등급으로 합쳐집니다 (🔗 버튼에서 전체 레시피 확인 가능).<br><br>
        <b style="color:#ffd60a">🔗 시너지</b> — 같은 타입이나 궁합 좋은 타입끼리 150px 이내에 배치하면 데미지가 오릅니다.<br><br>
        <b style="color:#ffd60a">⭐ 숙련도</b> — 같은 포켓몬을 중복으로 뽑기만 해도 그 포켓몬 전용 데미지가 조금씩 오릅니다.<br><br>
        <b style="color:#ffd60a">🔥 타입강화</b> — 화면 하단 바에서 타입별로 영구 강화를 살 수 있습니다.<br><br>
        <b style="color:#ffd60a">👑 왕</b> — 90웨이브에 강력한 왕이 등장합니다. 처치하면 그 자리에서 무한히 강해지는 몹들과 계속 싸우게 됩니다.<br><br>
        <b style="color:#ffd60a">🎯 미션 / 📖 도감</b> — 상단 버튼에서 확인 가능, 완료시 골드 보상.
      </div>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '시작하기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
  }

  // v27-4: 타이틀 진입/게임오버 후 복귀할 때마다 최고 기록 갱신
  // (기존 window.storage는 Claude 아티팩트 전용 API라 실제 배포본에서 동작 안 했음 - localStorage로 교체)
  _refreshBestWaveLabel() {
    const label = document.getElementById('best-wave-label');
    if (!label) return;
    try {
      const val = parseInt(localStorage.getItem('pokemontd_best_wave') || '0', 10);
      label.textContent = `🏆 최고 도달 웨이브: ${val || 0}`;
    } catch (e) { label.textContent = '🏆 최고 도달 웨이브: -'; }
  }

  _recordBestWave() {
    const reached = this.engine ? this.engine.currentWave : 0;
    try {
      const prevBest = parseInt(localStorage.getItem('pokemontd_best_wave') || '0', 10);
      const best = Math.max(prevBest, reached);
      if (best !== prevBest) localStorage.setItem('pokemontd_best_wave', String(best));
      // v27-4: 최고 점수도 같이 기록 (item19)
      const score = this.engine ? (this.engine.score || 0) : 0;
      const prevBestScore = parseInt(localStorage.getItem('pokemontd_best_score') || '0', 10);
      if (score > prevBestScore) localStorage.setItem('pokemontd_best_score', String(score));
      return best;
    } catch (e) { return reached; }
  }

  // v27: 필드 누적 몬스터 경고 배너 (70/80/90 색상 단계, 100에서 게임오버)
  _showFieldWarning(count, level) {
    let el = document.getElementById('field-warning-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'field-warning-banner';
      el.style.cssText = 'position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:150;padding:6px 14px;border-radius:10px;font-weight:bold;font-size:12px;pointer-events:none;transition:opacity 0.3s;white-space:nowrap;';
      document.getElementById('game-screen').appendChild(el);
    }
    const colors = { 140: ['#3a2f00','#ffd60a'], 160: ['#3a1f00','#ff9800'], 180: ['#3a0000','#ff3b3b'] };
    const [bg, fg] = colors[level] || colors[140];
    el.style.background = bg; el.style.color = fg; el.style.border = `1px solid ${fg}`;
    el.textContent = `⚠️ 필드에 몬스터 ${count}마리 (200마리에서 게임오버!)`;
    el.style.opacity = '1';
    clearTimeout(this._fieldWarnHideTimer);
    this._fieldWarnHideTimer = setTimeout(() => { if (el) el.style.opacity = '0'; }, 4000);
  }

  bindDifficultySelect() {
    document.querySelectorAll('.diff-btn[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.difficulty = btn.dataset.diff;
        document.querySelectorAll('.diff-btn[data-diff]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
  }

  bindStarterHeroSelect() {
    document.querySelectorAll('#starter-hero-select .diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.starterHero = btn.dataset.hero;
        document.querySelectorAll('#starter-hero-select .diff-btn').forEach(b => b.classList.toggle('active', b === btn));
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
      // C: 선택된 타워 합치기 진화 (패널에 합치기 버튼이 떠 있을 때)
      if (k === 'c') {
        const mergeBtn = document.querySelector('[data-action="merge"]');
        if (mergeBtn && !mergeBtn.disabled) { e.preventDefault(); mergeBtn.click(); }
        return;
      }
      // H: 배치된 영웅 이동모드 토글 (여러 영웅이 있으면 순서대로 순환)
      if (k === 'h') {
        const placed = this.engine.heroes;
        if (!placed.length) return;
        this._heroMoveCycleIdx = ((this._heroMoveCycleIdx ?? -1) + 1) % placed.length;
        const heroId = placed[this._heroMoveCycleIdx].id;
        const btn = document.querySelector(`.hero-btn[data-hero-key="${heroId}"]`);
        if (btn) { e.preventDefault(); this.selectHeroToPlace(heroId, btn); }
        return;
      }
    });
  }

  bindButtons() {
    this.els.btnWave.addEventListener('click', () => {
      if (this.engine && this.engine.state === 'wave') this._skipWave();
      else this.sendWave();
    });
    this.els.btnBack.addEventListener('click', () => this.backToMapSelect());
    this.els.btnMenu.addEventListener('click', () => this.togglePause());
    const btnMission = document.getElementById('btn-mission');
    if (btnMission) btnMission.addEventListener('click', () => this.openMissionBoard());
    const btnSynergy = document.getElementById('btn-synergy');
    if (btnSynergy) btnSynergy.addEventListener('click', () => this.openSynergyChart());
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
        // index 4, 8번째는 프리미엄급 보장 (기존엔 gamble 테이블 써서 전설이 이중으로 자주 나왔음)
        const key = 'ten_base'; // v27-9: 보장슬롯(구 premium) 제거 - 그냥 10개 다 일반뽑기와 동일 확률 (요청5)
        results.push(window.rollTower(key));
      }
      this._showTenPullResult(results, slotIdx);
      if (this.missionTracker) {
        this.missionTracker.stats.tenPullCount++;
        // v27-5 fix: 10연뽑 결과가 등급별 카운트/보유목록에 전혀 반영이 안 되고 있었음
        for (const r of results) {
          if (r.grade === 'rare' || r.grade === 'epic' || r.grade === 'legend' || r.grade === 'unique')
            this.missionTracker.stats.totalRareCount++;
          if (r.grade === 'epic' || r.grade === 'legend' || r.grade === 'unique')
            this.missionTracker.stats.totalEpicCount++;
          if (r.grade === 'legend' || r.grade === 'unique')
            this.missionTracker.stats.totalLegendCount++;
          if (r.grade === 'unique')
            this.missionTracker.stats.totalUniqueCount++;
          this.missionTracker.stats.collectedIds.add(r.id);
          if (!this.engine._masteryLevel) this.engine._masteryLevel = {};
          this.engine._masteryLevel[r.id] = (this.engine._masteryLevel[r.id] || 0) + 1; // v27-5: 숙련도 (item2)
          const newMastery = 1 + Math.min(20, this.engine._masteryLevel[r.id]) * 0.02;
          for (const s of this.engine.towerSlots) {
            if (s.occupied && s.tower?._gachaId === r.id) s.tower.masteryMul = newMastery;
          }
        }
        this.missionTracker.check();
      }
      return;
    }

    // 단일 뽑기
    const towerDef = window.rollTower(pullKey);
    this._placePulledTower(towerDef, slotIdx);

    // 뽑기 등급 팝업 + 효과음
    const gradeSound = {normal:'pull_normal', rare:'pull_rare', epic:'pull_epic', legend:'pull_epic', unique:'merge'};
    const isRareReveal = towerDef.grade === 'epic' || towerDef.grade === 'legend' || towerDef.grade === 'unique';
    if (isRareReveal) {
      // v27-5: 에픽 이상은 짧은 서스펜스 연출 후 공개 (요청B: 가챠의 재미)
      let flick = 0;
      const flickInterval = setInterval(() => {
        this.showWaveAnnounce('❓❓❓', flick % 2 ? '#fff' : '#ffd60a');
        flick++;
        if (flick >= 3) {
          clearInterval(flickInterval);
          this.SFX.play(gradeSound[towerDef.grade] || 'pull_normal');
          const g = window.GRADES?.[towerDef.grade];
          this.showWaveAnnounce(`${towerDef.emoji} ${g?.name||""} ${towerDef.name}`, g?.color||"#ffd60a");
        }
      }, 220);
    } else {
      this.SFX.play(gradeSound[towerDef.grade] || 'pull_normal');
      if (towerDef.grade === 'rare') {
        const g = window.GRADES?.[towerDef.grade];
        this.showWaveAnnounce(`${towerDef.emoji} ${g?.name||""} ${towerDef.name}`, g?.color||"#ffd60a");
      }
    }
    // v27-5: 합체 힌트 (요청) - 뽑은 직후 동일 타워 보유수 체크해서 알려줌
    if (this.engine) {
      const sameCount = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === towerDef.id).length;
      if (sameCount === 3) {
        setTimeout(() => this.showWaveAnnounce(`🧬 ${towerDef.emoji} ${towerDef.name} 3개 모임! 합체 가능해요`, '#06d6a0'), 900);
      } else if (sameCount === 2) {
        setTimeout(() => this.showWaveAnnounce(`🧬 ${towerDef.emoji} ${towerDef.name} 1개만 더 모으면 합체!`, '#ffd60a'), 900);
      }
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
      this.missionTracker.stats.collectedIds.add(towerDef.id); // v27-5: 전체모으기 미션용
      if (!this.engine._masteryLevel) this.engine._masteryLevel = {};
      this.engine._masteryLevel[towerDef.id] = (this.engine._masteryLevel[towerDef.id] || 0) + 1; // v27-5: 숙련도 (item2)
      const newMastery = 1 + Math.min(20, this.engine._masteryLevel[towerDef.id]) * 0.02;
      for (const s of this.engine.towerSlots) {
        if (s.occupied && s.tower?._gachaId === towerDef.id) s.tower.masteryMul = newMastery;
      }
      this.missionTracker.check();
    }

    if (btnEl) {
      btnEl.classList.add('active');
      setTimeout(() => btnEl.classList.remove('active'), 300);
    }
  }

  _placePulledTower(def, slotIdx) {
    const slot = this.engine.towerSlots[slotIdx];
    if (!slot || slot.occupied) return;
    const tower = window._createGachaTower(def, slot.x, slot.y, this.engine);
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
      // v27-5: 합체 힌트 뱃지 (요청) - 보드에 배치된 것 + 보관함(이번 10연 포함) 합산
      const boardCount = this.engine ? this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === def.id).length : 0;
      const invCount = (this._inventory || []).filter(x => x.id === def.id).length;
      const totalCount = boardCount + invCount;
      const mergeBadge = totalCount >= 3
        ? '<div style="position:absolute;top:2px;right:2px;font-size:9px;color:#06d6a0;background:rgba(0,0,0,0.6);border-radius:6px;padding:1px 4px;">🧬합체가능</div>'
        : totalCount === 2
        ? '<div style="position:absolute;top:2px;right:2px;font-size:9px;color:#ffd60a;background:rgba(0,0,0,0.6);border-radius:6px;padding:1px 4px;">🧬1개더</div>'
        : '';
      card.style.position = 'relative';
      card.innerHTML = `
        ${mergeBadge}
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

    document.body.appendChild(overlay);
  }

  startGame(mapId) {
    // v27: 난이도/맵 선택 화면 제거 - 항상 1존(초원)부터 엔드리스 시작
    mapId = ZONE_MAPS[0];
    this._currentZone = 0;
    this.currentMapId = mapId;
    this.els.mapSelect.classList.remove('active');
    this.els.gameScreen.classList.add('active');
    this.BGM.start(mapId);

    this.engine = new GameEngine(this.els.canvas);
    this.engine.heroes = [];
    this.engine.spellMgr = this.spellMgr;
    this.spellMgr.cooldowns = { pokecenter: 0, masterball: 0 };
    // v27: 새 게임 시작시 타입강화 레벨 초기화 (이전 판 값이 남아있던 버그 방지)
    if (window.TypeUpgradeLevels) { for (const t in window.TypeUpgradeLevels) window.TypeUpgradeLevels[t] = 0; }

    // 미션 트래커 초기화
    this.missionTracker = new MissionTracker();
    this.missionTracker.onComplete = (mission) => this._onMissionComplete(mission);

    this.engine.onGoldChange  = g => {
      this.els.goldVal.textContent = g;
      this.refreshPullButtons();
      this.buildShopBar();
      // v27-5: 누적 획득 골드 트래킹 (미션용)
      if (this.missionTracker) {
        const prev = this._lastGoldForMission ?? g;
        if (g > prev) this.missionTracker.stats.totalGoldEarned = (this.missionTracker.stats.totalGoldEarned || 0) + (g - prev);
        this._lastGoldForMission = g;
        this.missionTracker.check();
      }
    };
    this.engine.onHitSound = () => { if (Math.random() < 0.18) this.SFX.play('hit'); };
    this.engine.onLivesChange = l => {
      // v27: 라이프 HUD 숨김 (필드누적 게임오버로 대체됨, 화면 안 씀)
      if (this.els.livesVal) this.els.livesVal.textContent = l;
    };
    this.engine.onWaveChange  = (w, t) => {
      this.els.waveVal.textContent = w;
      this.els.waveTotal.textContent = '∞';
    };
    this.engine.onScoreChange = (score) => {
      const el = document.getElementById('score-val');
      if (el) el.textContent = score.toLocaleString();
      if (this.missionTracker) {
        this.missionTracker.stats.maxScore = Math.max(this.missionTracker.stats.maxScore || 0, score);
        this.missionTracker.check();
      }
    };
    const hudTimer = document.getElementById('hud-timer');
    const timerVal = document.getElementById('timer-val');
    this.engine.onWaveTimerChange = (remaining, total) => {
      if (!hudTimer) return;
      if (remaining <= 0 && this.engine.state !== 'wave') { hudTimer.style.display = 'none'; return; }
      hudTimer.style.display = 'flex';
      timerVal.textContent = Math.ceil(remaining);
      hudTimer.classList.toggle('timer-danger', remaining <= 8 && remaining > 3);
      hudTimer.classList.toggle('timer-critical', remaining <= 3);
      hudTimer.classList.toggle('timer-warn', remaining > 8 && remaining <= 18);
    };
    this.engine.onWaveTimeout = (penalty, survivorCount) => {
      if (hudTimer) hudTimer.style.display = 'none';
      this.showWaveAnnounce(`⏱ 시간 초과! 남은 ${survivorCount}마리는 필드에 그대로 (페널티 없음)`, '#ffab40');
      if (this.missionTracker) { this.missionTracker.stats.timeouts = (this.missionTracker.stats.timeouts||0) + 1; }
    };
    this.engine.onFieldWarning = (count, level) => this._showFieldWarning(count, level);
    this.engine.onZoneChange = (idx, zoneMapId) => { /* sendWave에서 이미 BGM/안내 처리함 */ };
    this.engine.onEliteKill = () => {
      if (!this.missionTracker) return;
      this.missionTracker.stats.eliteGoldKills = (this.missionTracker.stats.eliteGoldKills||0) + 1;
      this.missionTracker.check();
    };
    this.engine.onHeroEvolutionReady = (hero) => this.openEvolutionPicker(hero);
    this.engine.onHeroEvolved = () => {
      if (this.missionTracker) { this.missionTracker.stats.heroEvolved = true; this.missionTracker.check(); }
    };
    this.engine.onComboChange = (count, mul) => {
      // v27: 콤보 HUD 제거 (모바일에서 배속버튼 가리던 문제) - 내부 콤보 로직/미션 트래킹은 그대로 유지, 표시만 안 함
    };
    this.engine.onBossAppear = (boss) => {
      this.SFX.play('boss');
      const el = document.createElement('div');
      el.className = 'wave-announce boss';
      el.innerHTML = boss._isKing
        ? `👑 ${boss.def.emoji} 궁극의 뮤츠 (왕) 등장!<br><span style="font-size:0.85em;font-style:italic">"…감히 내 영역에 발을 들이다니."</span><br><span style="font-size:0.65em">⚠️ 이후로는 존 이동 없이 이 자리에서 무한 강화 모드로 진입합니다</span>`
        : `${boss.def.emoji} ${boss.name} 등장!<br><span style="font-size:0.7em">⚠️ 보스</span>`;
      document.getElementById('game-screen').appendChild(el);
      setTimeout(() => el.remove(), boss._isKing ? 4500 : 2800);
      this.engine.triggerScreenShake(boss._isKing ? 16 : 10, boss._isKing ? 0.6 : 0.4);
    };
    const origLoseLife = this.engine.loseLife.bind(this.engine);
    this.engine.loseLife = (n) => { this.SFX.play('life_lost'); origLoseLife(n); };
    this.engine.onKingDefeated = () => {
      this.showWaveAnnounce('👑 왕을 처치했습니다! 무한 강화 모드 진입 - 20웨이브마다 적이 새로운 능력을 얻습니다', '#ffd60a');
      this.BGM.start('infinite'); // v27-7: 무한강화 진입시 전용 BGM으로 전환 (요청5)
    };
    this.engine.onWaveComplete = (wave, bonus, timedOut) => {
      if (hudTimer) hudTimer.style.display = 'none';
      this.els.btnWave.disabled = false;
      if (!timedOut) this.SFX.play('wave_clear');
      // v27: 엔드리스 - 클리어 개념 없이 항상 자동으로 다음 웨이브 카운트다운
      this._startAutoWaveCountdown(wave + 1);
      if (!timedOut) this.showWaveAnnounce(`Wave ${wave} 완료! +${bonus}g`, '#ffd60a');
      if (this.missionTracker && this.difficulty === 'hard' && !timedOut) {
        this.missionTracker.stats.hardWavesCleared = (this.missionTracker.stats.hardWavesCleared||0) + 1;
      }
      this.buildTowerBar();
      if (this.missionTracker) {
        this.missionTracker.stats.wavesCleared = wave;
        this.missionTracker.check();
      }
    };
    this.engine.onGameOver = () => { const best = this._recordBestWave(); this.showEndScreen(false, 0, best); };
    this.engine.onVictory  = (stars) => {
      this.checkSkinUnlocks(stars);
      this.showEndScreen(true, stars);
    };

    this.engine.totalWaves = 999999; // v27: 엔드리스 - 사실상 무한
    this.engine.endless = true;
    const dm = (window.DifficultyMods && window.DifficultyMods[this.difficulty]) || { livesStart:20, goldStart:250 };
    this.engine.difficulty = this.difficulty;
    this.engine.lives = dm.livesStart;
    this.engine.gold = dm.goldStart;
    this.engine.init(mapId);

    this.els.goldVal.textContent = this.engine.gold;
    this.els.livesVal.textContent = this.engine.lives;
    this.els.waveVal.textContent = 0;
    this.els.waveTotal.textContent = '∞';
    this.els.btnWave.textContent = '▶ 웨이브 1';
    this.els.btnWave.disabled = false;

    this.bindCanvasInput();
    this.buildTowerBar();
    this.buildSpellBar();
    this.buildTypeUpgradeBar();
    this.buildShopBar();
    this.buildBossSummonButton();
    this.startHeroLoop();
    this._showStarterTowerPicker(); // v27-5: 시작 시 스타터 타워 3택1 (요청B - 초반 결정 유도)
  }

  // v27-5: 시작 스타터 타워 선택 (무료, 즉시 배치) - 초반에 첫 결정을 하게 만들어 몰입 유도
  _showStarterTowerPicker() {
    if (!window.GachaTowerDefs) return;
    // v27-5 fix: 랜덤 3종 대신 진짜 스타터 3종(이상해씨/파이리/꼬부기) 고정 - 상징성 있는 선택으로
    const picks = ['bulbasaur', 'charmander', 'squirtle'].filter(id => window.GachaTowerDefs[id]);
    const overlay = document.createElement('div');
    overlay.className = 'skin-picker'; // 기존 풀스크린 오버레이 스타일 재사용
    const title = document.createElement('div');
    title.className = 'skin-picker-title';
    title.textContent = '🎁 시작 타워를 하나 골라주세요 (무료)';
    overlay.appendChild(title);
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;';
    for (const id of picks) {
      const def = window.GachaTowerDefs[id];
      if (!def) continue;
      const card = document.createElement('div');
      card.style.cssText = 'cursor:pointer;background:rgba(20,20,40,0.85);border:2px solid rgba(255,255,255,0.2);border-radius:14px;padding:16px;text-align:center;min-width:100px;transition:transform 0.15s;';
      card.innerHTML = `<div style="font-size:36px">${def.emoji}</div><div style="color:#fff;font-size:13px;margin-top:6px">${def.name}</div><div style="color:#888;font-size:10px;margin-top:4px">${def.desc||''}</div>`;
      card.addEventListener('click', () => {
        const emptySlot = this.engine.towerSlots.find(s => !s.occupied);
        if (emptySlot) {
          const tower = window._createGachaTower(def, emptySlot.x, emptySlot.y, this.engine);
          // v27-5: 스타터 시그니처 보너스 - 처음 고른 타워는 평생 데미지 +15% (선택의 무게감)
          tower.buffDmgMul = (tower.buffDmgMul || 1) * 1.15;
          tower._isStarter = true;
          emptySlot.occupied = true; emptySlot.tower = tower;
          this.engine.towers.push(tower);
          if (this.missionTracker) this.missionTracker.stats.collectedIds.add(def.id);
        }
        overlay.remove();
        this.showWaveAnnounce(`${def.emoji} ${def.name}(으)로 시작! (영구 데미지+15% 시그니처)`, '#ffd60a');
      });
      grid.appendChild(card);
    }
    overlay.appendChild(grid);
    document.body.appendChild(overlay);
  }

  startHeroLoop() {
    this._waveTimer = 0;
    this.engine._bossSummonCooldown = 0;
    const origUpdate = this.engine.update.bind(this.engine);
    this.engine.update = () => {
      origUpdate();
      if (this.engine.state === 'wave' || this.engine.state === 'idle') {
        for (const h of this.engine.heroes) h.update(this.engine.dt, this.engine);
        this.spellMgr.update(this.engine.dt);
        this.updateSpellBarUI();
        this.updateHeroSkillBarUI();
      }
      if (this.engine._bossSummonCooldown > 0) {
        this.engine._bossSummonCooldown -= this.engine.dt;
        this._updateBossSummonUI();
      }
      // v27-6: 필드 위험 비네트 (요청2, 절제된 연출)
      if (this.engine.endless) {
        let vig = document.getElementById('field-danger-vignette');
        if (!vig) {
          vig = document.createElement('div');
          vig.id = 'field-danger-vignette';
          document.getElementById('game-screen').appendChild(vig);
        }
        vig.classList.toggle('active', this.engine.enemies.length >= 180);
        // v27-13: 필드 몬스터수 상시 HUD 갱신 (요청5 - 스킵 타이밍 판단용으로 항상 보여야 함)
        const fcEl = document.getElementById('field-count-val');
        if (fcEl) {
          const cnt = this.engine.enemies.length;
          fcEl.textContent = cnt;
          const cell = document.getElementById('hud-field');
          if (cell) cell.style.color = cnt >= 160 ? '#ff5252' : cnt >= 120 ? '#ffab40' : cnt >= 80 ? '#ffd60a' : '';
        }
      }
      // v27-6: 최고 시너지 달성치 추적 (요청4 - 게임오버 요약화면 MVP용)
      if (this.engine.towers.length) {
        const maxSyn = this.engine.towers.reduce((m,t)=>Math.max(m,t.synergyBonus||0), 0);
        this.engine._maxSynergySeen = Math.max(this.engine._maxSynergySeen||0, maxSyn);
      }
      // v27-5: 초반 유도미션용 트래킹 (요청C)
      if (this.missionTracker) {
        if (this.engine.currentWave <= 3 && this.engine.towers.length >= 6) this.missionTracker.stats.earlyDeploy4 = true;
        if (this.engine.towers.some(t => (t.synergyBonus||0) > 0)) this.missionTracker.stats.firstSynergy = true;
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
          // v27-9 버그수정: 영웅을 타워 슬롯 바로 위/근처에 놓으면 탭 판정이 겹쳐서
          // 이후로 그 자리를 탭해도 아무 반응이 없어지던 문제 - 슬롯과 45px 이내면 밀어냄
          let px = x, py = y;
          for (const s of this.engine.towerSlots) {
            const d = Math.hypot(s.x - px, s.y - py);
            if (d < 60) {
              const angle = Math.atan2(py - s.y, px - s.x) || Math.random() * Math.PI * 2;
              px = s.x + Math.cos(angle) * 61;
              py = s.y + Math.sin(angle) * 61;
            }
          }
          px = Math.max(20, Math.min(this.engine.width - 20, px));
          py = Math.max(HUD + 20, Math.min(this.engine.height - BAR - 20, py));

          const skinId = this.selectedHeroSkins[this.placingHero];
          // 이미 배치된 영웅이면 위치만 이동
          const existing = this.engine.heroes.find(h => h.id === this.placingHero);
          if (existing) {
            existing.x = px; existing.y = py;
          } else {
            const hero = new Hero(this.placingHero, px, py, skinId);
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
  // v27-4: 시너지 조합표/미션판/타워바 등 UI 빌드 메서드는 ui-builders.js로 분리됨

  _startAutoWaveCountdown(nextWave) {
    if (this._autoWaveTimer) clearInterval(this._autoWaveTimer);
    // v27-5: 초반 페이스 압축 (요청E) - 웨이브10까지는 대기시간을 짧게 (지루함 방지)
    let remaining = nextWave <= 10 ? 4 : 10;
    this.els.btnWave.textContent = `▶ Wave ${nextWave} (${remaining}초)`;
    this._showWavePreview(nextWave); // v27-6: 다음웨이브 타입 미리보기 (요청6)
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

  // v27-6: 다음 웨이브 등장 타입 미리보기 UI (요청6 - 전략적 타입강화 타이밍 고민 유도)
  _showWavePreview(nextWave) {
    let el = document.getElementById('wave-preview');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wave-preview';
      el.style.cssText = 'position:absolute;left:50%;bottom:calc(var(--bar-h,82px) + 140px);transform:translateX(-50%);z-index:19;display:flex;gap:4px;align-items:center;background:rgba(0,0,0,0.5);border-radius:8px;padding:4px 8px;font-size:11px;color:#aaa;pointer-events:none;';
      document.getElementById('game-screen').appendChild(el);
    }
    const types = typeof previewWaveTypes === 'function' ? previewWaveTypes(nextWave) : [];
    const icons = types.map(t => window.TYPES?.[t]?.emoji || '').join(' ');
    el.innerHTML = `다음 웨이브: ${icons || '?'}`;
  }

  // v27: 상시노출 상점바 (기존 5웨이브마다 뜨던 팝업 대신, 게임 멈추지 않음)

  // v27: 보스 소환 (스타 UMS 게이트 방식) - 영웅스킬바 옆 상시노출, 레벨별 쿨다운
  // v27-2: 단일 쿨다운(60초) + 등급 선택 방식 (한번에 여러 등급 동시소환 방지)

  _summonBoss(tier) {
    const e = this.engine;
    const tierDef = BOSS_TIERS.find(t => t.tier === tier);
    if (!e || !tierDef) return;
    if (e.state !== 'wave') { this.showWaveAnnounce('웨이브 진행 중에만 소환 가능', '#ff6b6b'); return; }
    if ((e._bossSummonCooldown || 0) > 0) return;
    const waveMul = bossWaveScaleMul(e.currentWave);
    e._spawnEnemy({ type: tierDef.type, bossTier: tier, hpMul: tierDef.hpMul * waveMul, rewardMul: tierDef.rewardMul });
    e._bossSummonCooldown = BOSS_SUMMON_COOLDOWN;
    this.showWaveAnnounce(`🔮 ${tierDef.label}(${tier}성) 소환!`, '#ff6b6b');
    if (this.missionTracker) { this.missionTracker.stats.bossSummons = (this.missionTracker.stats.bossSummons||0) + 1; this.missionTracker.check(); }
    this._updateBossSummonUI();
  }

  _updateBossSummonUI() {
    const bar = document.getElementById('boss-summon-bar');
    if (!bar || !this.engine) return;
    bar.querySelectorAll('.boss-tier-chip').forEach(chip => {
      chip.style.borderColor = Number(chip.dataset.tier) === this._bossSummonTier ? '#ffd60a' : 'rgba(255,255,255,0.2)';
      chip.style.background = Number(chip.dataset.tier) === this._bossSummonTier ? 'rgba(255,214,10,0.25)' : 'rgba(0,0,0,0.4)';
    });
    const btn = document.getElementById('boss-summon-btn');
    if (!btn) return;
    const cd = this.engine._bossSummonCooldown || 0;
    const tierDef = BOSS_TIERS.find(t => t.tier === this._bossSummonTier);
    if (cd > 0) {
      btn.disabled = true;
      btn.textContent = `⏳ 재사용 대기 (${Math.ceil(cd)}s)`;
    } else {
      btn.disabled = false;
      btn.textContent = `🔮 ${tierDef.label} 소환`;
    }
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

  // v27: 영웅 탭 감지 - 타워처럼 공격력/사거리/레벨 패널 표시 (요청7)
  _tryTapHero(x, y) {
    if (!this.engine) return false;
    for (const hero of this.engine.heroes) {
      if (Math.hypot(hero.x - x, hero.y - y) < 32) {
        this._showHeroPanel(hero);
        return true;
      }
    }
    document.getElementById('hero-panel')?.remove();
    return false;
  }

  _showHeroPanel(hero) {
    let panel = document.getElementById('hero-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'hero-panel';
      document.getElementById('game-screen').appendChild(panel);
    }
    const expPct = Math.min(100, Math.round((hero.exp / hero.expToNext) * 100));
    const heroType = window.HERO_TYPE_MAP?.[hero.evolved || hero.id];
    const typeInfo = heroType ? window.TYPES?.[heroType] : null;
    const typeTag = typeInfo ? `<span style="color:${typeInfo.color}">${typeInfo.emoji} ${typeInfo.name}속성</span>` : '';
    panel.innerHTML = `
      <div class="tower-panel-name">${hero.skin.emoji} ${hero.name} Lv${hero.level} ${typeTag}</div>
      <div class="tower-panel-stats">⚔️${Math.round(hero.attackDamage)} · 📏${Math.round(hero.attackRange)} · ✨EXP ${expPct}%</div>
      <div style="font-size:10px;color:#aaa;margin:2px 0">${hero.def.passive || ''}</div>
      <div class="tower-panel-btns">
        <button class="tp-btn" data-action="skin">🎨 스킨 변경</button>
        <button class="tp-btn" data-action="close">닫기</button>
      </div>
    `;
    panel.querySelector('[data-action="skin"]').addEventListener('click', () => this.openSkinPicker(hero.id));
    panel.querySelector('[data-action="close"]').addEventListener('click', () => panel.remove());
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
      if (this._tryTapHero(pos.x, pos.y)) return;
      this.engine.handleTap(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const pos = getPos(e);
      this.engine.handleHover(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('click', e => {
      const pos = getPos(e);
      if (this._tryTapHero(pos.x, pos.y)) return;
      this.engine.handleTap(pos.x, pos.y);
    });

    canvas.addEventListener('mousemove', e => {
      const pos = getPos(e);
      this.engine.handleHover(pos.x, pos.y);
    });

    window.addEventListener('resize', () => {
      this.engine.resize();
      this.engine.buildPaths();
      this.engine.buildTowerSlots();
      this.engine._bgDirty = true;
    });
  }

  // v27-10: 웨이브 강제 스킵 (요청8 - 잔여 몹 1마리 때문에 100초를 다 기다려야 하던 문제)
  _skipWave() {
    if (!this.engine || this.engine.state !== 'wave') return;
    this.engine.timeoutWave();
    this.showWaveAnnounce('⏭ 웨이브 스킵! (남은 적은 필드에 그대로 남음)', '#ffab40');
  }

  sendWave() {
    const e = this.engine;
    if (!e || e.state !== 'idle') return;
    const waveIdx = e.currentWave;
    const nextWave = waveIdx + 1;

    // v27: 30웨이브 경계에서 존(맵) 전환
    const nextZone = zoneIndexForWave(nextWave);
    if (nextZone !== this._currentZone) {
      this._currentZone = nextZone;
      const zoneMapId = ZONE_MAPS[nextZone];
      this.currentMapId = zoneMapId;
      e.switchZone(zoneMapId, nextZone);
      this.buildTowerBar();
      this.BGM.start(zoneMapId);
      this.showWaveAnnounce(ZONE_LABELS[nextZone], '#7fe3ff');
    }

    const wave = generateWave(nextWave);

    // v27-5: 랜덤 이벤트 웨이브 (요청: 다채로움) - 보스/왕 웨이브는 제외, 15% 확률
    e._globalGoldMul = 1; e._waveSpeedMul = 1; e._waveHpMul = 1;
    const isBossWave = nextWave === KING_WAVE || nextWave % 10 === 0;
    if (!isBossWave && nextWave >= 3 && Math.random() < 0.15) {
      const events = [
        { name:'💰 골드 러쉬', color:'#ffd60a', apply:()=>{ e._globalGoldMul = 2.2; } },
        { name:'⚡ 스피드 웨이브', color:'#4fc3f7', apply:()=>{ e._waveSpeedMul = 1.5; e._waveHpMul = 0.75; } },
        { name:'🛡️ 정예 웨이브', color:'#ff6b6b', apply:()=>{ e._waveHpMul = 1.6; e._globalGoldMul = 1.8; } },
      ];
      const ev = events[Math.floor(Math.random() * events.length)];
      ev.apply();
      this._currentWaveEvent = ev;
      this.showWaveAnnounce(`${ev.name}! (Wave ${nextWave})`, ev.color);
    } else {
      this._currentWaveEvent = null;
    }

    // 보스 웨이브 경고
    if (nextWave === KING_WAVE) {
      this.showWaveAnnounce(`👑 왕이 기다리고 있습니다... (Wave ${nextWave})`, '#ffd60a');
    } else if (nextWave % 30 === 0) {
      this.showWaveAnnounce(`🔮 존 보스 등장! (Wave ${nextWave})`, '#ff6b6b');
    } else if (nextWave % 10 === 0) {
      this.showWaveAnnounce(`☠️ 중간보스 등장! (Wave ${nextWave})`, '#ffab40');
    }

    // v27-9: 왕/보스 웨이브는 시간제한을 짧게 고정 - 못 잡아도 빠르게 다음 웨이브로 넘어가도록 (요청3)
    const isBossOrKingWave = nextWave === KING_WAVE || nextWave % 10 === 0;
    const timeLimit = isBossOrKingWave ? 22 : waveTimeLimit(wave, this.difficulty, this.engine);
    if (e.startWave(wave, timeLimit)) {
      this.els.btnWave.disabled = false;
      this.els.btnWave.textContent = '⏭ 스킵 (남은 적 놔두고 진행)';
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

  showEndScreen(victory, stars, best) {
    this.engine.stop();
    const gameScreen = document.getElementById('game-screen');

    const overlay = document.createElement('div');
    overlay.className = 'end-overlay';

    const title = document.createElement('div');
    title.className = 'end-title ' + (victory ? 'victory' : 'gameover');
    title.textContent = victory ? '🏆 VICTORY!' : '💀 GAME OVER';
    overlay.appendChild(title);

    if (!victory) {
      const reached = this.engine ? this.engine.currentWave : 0;
      const info = document.createElement('div');
      info.style.cssText = 'color:#fff;font-size:16px;margin:6px 0 2px;';
      info.textContent = `도달 웨이브: ${reached}`;
      overlay.appendChild(info);
      const bestEl = document.createElement('div');
      bestEl.style.cssText = 'color:#ffd60a;font-size:15px;margin-bottom:8px;';
      bestEl.textContent = `🏆 최고 기록: ${best != null ? best : reached}`;
      overlay.appendChild(bestEl);

      // v27-6: 이번 판 요약 (요청4) - MVP타워/최고시너지/사용 종수
      const summary = document.createElement('div');
      summary.style.cssText = 'background:rgba(0,0,0,0.3);border-radius:10px;padding:10px 16px;margin:6px 0;font-size:12px;color:#ccc;text-align:left;min-width:220px;';
      const dmgStats = this.engine._towerDamageStats || {};
      let mvpId = null, mvpDmg = 0;
      for (const id in dmgStats) { if (dmgStats[id] > mvpDmg) { mvpDmg = dmgStats[id]; mvpId = id; } }
      const mvpDef = mvpId && window.GachaTowerDefs?.[mvpId];
      const varietyCount = this.missionTracker?.stats?.collectedIds?.size || 0;
      const maxSynergy = this.engine._maxSynergySeen || 0;
      summary.innerHTML = `
        <div style="color:#ffd60a;font-weight:700;margin-bottom:4px;">📊 이번 판 요약</div>
        <div>⭐ MVP 타워: ${mvpDef ? `${mvpDef.emoji} ${mvpDef.name}` : '-'}</div>
        <div>🔗 최고 시너지: +${maxSynergy}</div>
        <div>🎲 사용한 포켓몬 종류: ${varietyCount}종</div>
        <div>🏅 최종 점수: ${(this.engine.score||0).toLocaleString()}</div>
      `;
      overlay.appendChild(summary);
    }

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
    this._refreshBestWaveLabel();

    const ctx = this.els.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);

    document.querySelectorAll('.end-overlay,.wave-announce,.shop-overlay,.skin-picker,.skilltree-overlay,.mission-overlay,.synergy-overlay,#field-warning-banner,#field-danger-vignette,#wave-preview').forEach(el => el.remove());
    const shopBar = document.getElementById('shop-bar');
    if (shopBar) shopBar.innerHTML = '';
    const bossBtn = document.getElementById('boss-summon-bar');
    if (bossBtn) bossBtn.remove();
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
