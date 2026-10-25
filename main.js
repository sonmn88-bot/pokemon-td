// ===== MAIN.JS - 화면 관리 + HUD + 절차적 웨이브 생성(엔드리스) + 타워/영웅/상점 통합 =====

const WAVES_PER_ZONE = 30; // v27: 30웨이브씩 3존 순환(1~90), 90에서 왕 조우 후엔 존 전환 없이 그 자리에서 무한 강화
const ZONE_MAPS = ['forest', 'cave', 'city']; // 1~30 태초마을 숲 / 31~60 라벤더 동굴(우주 성운 테마) / 61~90 홍련체육관 도시(화산)
const ZONE_LABELS = ['🌲 초원 지대', '🌌 우주 동굴', '🌋 화산 도시'];
const KING_WAVE = 90;
// v27-4: 90웨이브부터는 존 전환 없이 마지막 존(화산 도시)에 고정 - "왕 조우 후 무한강화" 구조 (item 9)
function zoneIndexForWave(n) { return n >= KING_WAVE ? ZONE_MAPS.length - 1 : Math.floor((n - 1) / WAVES_PER_ZONE) % ZONE_MAPS.length; }
function zoneCycleForWave(n) { return n < KING_WAVE ? 0 : Math.floor((n - KING_WAVE) / WAVES_PER_ZONE); } // v27-39 버그수정: 90웨이브 이전에도 30웨이브마다 증가하고 있었음 - wave44에서 이미 물량이 248마리로 계산되던 진짜 원인 (요청4 - "한번에 너무 많이 나온다"는 반복 지적)

// 웨이브 진행도에 따라 열리는 적 티어 (기존 20웨이브 손수 작성 대신 공식으로 생성 - 튜닝 비용 최소화)
const ENEMY_TIERS = {
  t1: ['abo','rattata','jigglypuff','zubat','koffing'],
  t2: ['golbat','gastly','paras','magnemite','phantump'],
  t3: ['lapras','weezing','scyther','onix','haunter'],
  t4: ['gyarados','electrode','dragonite'],
};
const MINIBOSS_POOL = ['gyarados', 'dragonite'];
const BOSS_POOL = ['lugia', 'raikou', 'entei', 'hooh']; // v3.1: 스이쿤·라이코·앤테이·칠색조 (왕 루기아는 따로)

// v27-3: 보스 난이도 추가 상향 - 기본 배율을 더 키우고, 소환 시점 웨이브에 비례해서도 더 강해지게
// (10라운드째에도 5단계까지 다 잡히던 문제 - 고정배율만으론 후반에 상대적으로 계속 약해지므로 웨이브연동 필수)
const BOSS_TIERS = [
  { tier: 1, type: 'gyarados', label: '링곰',   hpMul: 1.4, rewardMul: 42,  minWave: 1  }, // v27-46: 잡기 어려워진 만큼 보상 추가 인상
  { tier: 2, type: 'dragonite', label: '마기라스',    hpMul: 2.0, rewardMul: 75, minWave: 15 },
  { tier: 3, type: 'lugia',    label: '스이쿤',      hpMul: 2.8, rewardMul: 115, minWave: 35 },
  { tier: 4, type: 'hooh',     label: '칠색조',        hpMul: 3.8, rewardMul: 170, minWave: 55 },
  { tier: 5, type: 'mewtwo',   label: '루기아(각성)',  hpMul: 5.2, rewardMul: 250, minWave: 75 },
];
const BOSS_SUMMON_COOLDOWN = 180; // v27-42: 60→180(3배) - 스킵 대비 정면승부 보상을 늘리기 위해 쿨다운도 늘림
// v27-46 버그수정: 이전엔 (티어배율)×(웨이브배율) 형태로 곱연산되어 있어서 지수적으로 폭주하고 있었음
// (예: 루기아가 웨이브35에 도달 가능한 시점에 이미 체력 90만+ 였음 - "루기아부터 거의 못 잡는다"는
// 지적의 원인). 곱연산 대신 통제된 덧셈식 공식으로 전면 재설계.
function bossWaveScaleMul(wave) { return 3 + Math.max(0, wave) * 0.15; }

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
  // v3.2: 이번 판 몬스터 편성 - 강조된 특성 2가지는 3배 자주 등장
  const emph = window.app?.engine?._runEmphasis;
  if (emph && typeof EnemyTypes !== 'undefined') {
    const fav = pool.filter(id => emph.includes(EnemyTypes[id]?.special));
    for (let i = 0; i < 2; i++) pool = pool.concat(fav);
  }

  // 웨이브가 진행될수록 더 많이, 더 빽빽하게 스폰 (계속 돌면서 잡는 느낌). cycle이 늘수록(90웨이브 이후 반복) 한번 더 강화
  let enemyCount = Math.min(140, Math.round(18 + n * 1.0)) + cycle * 10; // v28 (설계서 §2): 18+웨이브, 최대 140 (+90 이후 사이클당 10) // v27-39: 선형계수 4.6→1.3 대폭 하향 (요청4 - wave44에 이미 228마리로 계산되어 단일 웨이브가 필드상한을 넘어서던 근본 문제)
  if (window.app?.engine?._runTrait?.key === 'swarm') enemyCount = Math.round(enemyCount * 1.25);
  const baseInterval = Math.max(0.30, 0.85 - n * 0.014); // v28: 최소 간격 0.30초
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
    // v27-32 버그수정: 존보스가 소환보스와 달리 별도 체력배율이 전혀 없어서 일반몹 수준(예: 갸라도스
    // 기본체력 489)으로 취급되고 있었음 - "초반 보스가 너무 빨리 죽는다"는 문제의 진짜 원인이었을 가능성 높음
    arr.push({ type: BOSS_POOL[Math.floor(Math.random() * BOSS_POOL.length)], delay: lastDelay + 4, bossTier: true, hpMul: 12 + n * 0.4, rewardMul: 6, megaDrop: n % 20 === 0 }); // v27-46: 보상 추가 인상
  } else if (n % 10 === 0) {
    arr.push({ type: MINIBOSS_POOL[Math.floor(Math.random() * MINIBOSS_POOL.length)], delay: lastDelay + 4, bossTier: true, hpMul: 8 + n * 0.3, rewardMul: 3.5, megaDrop: n % 20 === 0 }); // v27-46: 보상 추가 인상
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
            king_victory: { freq:[392,523,659,784,988],dur:0.9, vol:0.18, type:'triangle' }, // v27-18: 왕 처치 전용 징글 (요청H)
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
          // v27-44: 자주 반복되는 타격음(폭발 등)에 살짝 랜덤 피치를 줘서 계속 들어도 덜 지치게 함 (요청4)
          const pitchVariance = (type === 'hit' || type === 'shoot') ? (0.9 + Math.random() * 0.2) : 1;
          const freqs = cfg.freq.map(f => f * pitchVariance);
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
      btnRecenter: document.getElementById('btn-recenter'),
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

  // v27-17: 왕 처치 기록 갤러리 (요청4)
  _recordKingKill() {
    try {
      const list = JSON.parse(localStorage.getItem('pokemontd_king_records') || '[]');
      const mvpDmg = this.engine._towerDamageStats || {};
      let mvpId = null, best = 0;
      for (const id in mvpDmg) { if (mvpDmg[id] > best) { best = mvpDmg[id]; mvpId = id; } }
      const mvpName = mvpId && window.GachaTowerDefs?.[mvpId]?.name;
      list.unshift({ wave: this.engine.currentWave, score: this.engine.score || 0, mvp: mvpName || '-', date: new Date().toLocaleDateString('ko-KR') });
      localStorage.setItem('pokemontd_king_records', JSON.stringify(list.slice(0, 20)));
    } catch (e) {}
  }

  async _showGlobalRanking() {
    const overlay = document.createElement('div');
    overlay.className = 'skin-picker';
    overlay.innerHTML = `
      <div class="skin-picker-title" id="rank-title" style="cursor:default;user-select:none;">🌍 전체 랭킹</div>
      <div style="display:flex;gap:6px;margin-bottom:6px;">
        <button id="rank-clear-btn" style="display:none;font-size:10px;padding:4px 8px;border-radius:6px;border:1px solid rgba(255,80,80,0.4);background:transparent;color:#ff5c7a;cursor:pointer;">🗑️ 전체 초기화</button>
      </div>
      <div id="rank-list-body" style="color:#888;padding:20px;">불러오는 중...</div>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    let isAdmin = false;
    const ADMIN_PASSWORD = window.ADMIN_PASSWORD || 'pokemontd2026'; // v27-42: firebase-config.js 등에서 재정의 가능

    const renderRows = async () => {
      const body = overlay.querySelector('#rank-list-body');
      if (!body) return;
      const rows = await window.Leaderboard.fetchTop(20);
      if (!overlay.isConnected) return;
      if (!rows.length) { body.textContent = '아직 등록된 기록이 없습니다.'; return; }
      body.style.cssText = 'max-width:380px;max-height:50vh;overflow-y:auto;color:#ddd;font-size:12px;';
      body.innerHTML = rows.map((r, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:6px;">
          <span>#${i+1} ${r.name}</span>
          <span style="color:#ffc24b">🏅${(r.score||0).toLocaleString()}</span>
          <span style="color:#5b9dff">Wave ${r.wave}</span>
          ${isAdmin ? `<button data-rank-del="${r.id}" style="font-size:10px;padding:2px 6px;border-radius:5px;border:none;background:#ff5c7a;color:#fff;cursor:pointer;">삭제</button>` : ''}
        </div>`).join('');
      if (isAdmin) {
        body.querySelectorAll('[data-rank-del]').forEach(btn => {
          btn.addEventListener('click', async () => {
            btn.textContent = '...';
            await window.Leaderboard.deleteEntry(btn.dataset.rankDel);
            renderRows();
          });
        });
      }
    };

    const rankTitle = overlay.querySelector('#rank-title');
    const clearBtn = overlay.querySelector('#rank-clear-btn');
    // v27-49: 눈에 띄는 관리자 버튼 대신, 제목을 5번 빠르게 연속 탭하면 진입 (요청5 - 잘 안 보이는 곳에)
    let tapCount = 0, tapTimer = null;
    rankTitle.addEventListener('click', () => {
      if (isAdmin) return;
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 1500);
      if (tapCount < 5) return;
      tapCount = 0;
      const pw = prompt('관리자 비밀번호를 입력하세요');
      if (pw === ADMIN_PASSWORD) {
        isAdmin = true;
        clearBtn.style.display = 'inline-block';
        renderRows();
      } else if (pw !== null) {
        alert('비밀번호가 틀렸습니다.');
      }
    });
    clearBtn.addEventListener('click', async () => {
      if (!confirm('전체 랭킹을 정말 초기화하시겠습니까? 되돌릴 수 없습니다.')) return;
      clearBtn.textContent = '초기화 중...';
      const res = await window.Leaderboard.clearAll();
      clearBtn.textContent = '🗑️ 전체 초기화';
      renderRows();
      if (res.ok) alert(`${res.count}개 기록이 삭제되었습니다.`);
    });

    if (!window.Leaderboard || !window.Leaderboard.isEnabled()) {
      overlay.querySelector('#rank-list-body').innerHTML =
        '<div style="text-align:center;color:#888;max-width:280px;">랭킹 서버가 아직 설정되지 않았습니다.<br>(firebase-config.js 설정 필요)</div>';
      return;
    }
    await renderRows();
  }

  _showKingHallOfFame() {
    let records = [];
    try { records = JSON.parse(localStorage.getItem('pokemontd_king_records') || '[]'); } catch (e) {}
    const overlay = document.createElement('div');
    overlay.className = 'skin-picker';
    overlay.innerHTML = `
      <div class="skin-picker-title">👑 왕 처치 명예의 전당</div>
      <div style="max-width:380px;max-height:50vh;overflow-y:auto;color:#ddd;font-size:12px;">
        ${records.length === 0 ? '<div style="text-align:center;color:#888;padding:20px">아직 왕을 처치한 기록이 없습니다</div>' :
          records.map((r, i) => `
            <div style="display:flex;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:6px;">
              <span>#${i+1} · Wave ${r.wave}</span>
              <span style="color:#ffc24b">🏅${r.score.toLocaleString()}</span>
              <span style="color:#5b9dff">⭐${r.mvp}</span>
              <span style="color:#888">${r.date}</span>
            </div>`).join('')}
      </div>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
  }

  // v27-17: 영웅 궁극기 발동시 화면 테두리 플래시 (요청5)
  _flashScreenEdge() {
    let el = document.getElementById('skill-flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'skill-flash';
      document.getElementById('game-screen').appendChild(el);
    }
    el.classList.remove('flash-active');
    void el.offsetWidth; // 리플로우 강제 (애니메이션 재시작용)
    el.classList.add('flash-active');
  }

  // v27-18: 이번 판 한정 랜덤 시드특성 (요청G) - 영구 강화 아님, 이번 판에만 적용되는 색다른 조건
  _applyRunSeedTrait() {
    const traits = [
      { key:'goldBoom',   name:'💰 골드 풍년',   desc:'이번 판 모든 골드 획득 +20%' },
      { key:'swarm',      name:'👾 몬스터 창궐', desc:'몹 물량 +25%, 대신 체력 -12%' },
      { key:'eliteEra',   name:'⚔️ 정예의 시대', desc:'엘리트 몬스터 등장 확률 2배' },
      { key:'headStart',  name:'🚀 빠른 출발',   desc:'시작 골드 +200' },
      { key:'luckyStart', name:'🍀 행운의 시작', desc:'행운의 동전 1개 지급 (랜덤 합성 2택)' },
    ];
    const trait = traits[Math.floor(Math.random() * traits.length)];
    this.engine._runTrait = trait;
    if (trait.key === 'headStart') this.engine.addGold(200);
    if (trait.key === 'luckyStart') this.engine._luckyCoins = (this.engine._luckyCoins || 0) + 1;
    this._runTraitInfo = trait;
    const badge = document.getElementById('hud-trait');
    if (badge) { badge.title = `${trait.name} — ${trait.desc}`; badge.textContent = trait.name.split(' ')[0]; }
    setTimeout(() => this.showWaveAnnounce(`${trait.name} — ${trait.desc}`, '#5b9dff'), 600);
  }

  bindMapSelect() {
    const startBtn = document.getElementById('btn-endless-start');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
    const skinBtn = document.getElementById('btn-title-skin');
    if (skinBtn) skinBtn.addEventListener('click', () => this.openSkinPicker(this.starterHero || 'pikachu'));
    const howtoBtn = document.getElementById('btn-howto');
    if (howtoBtn) howtoBtn.addEventListener('click', () => this._showHowToPlay());
    const hofBtn = document.getElementById('btn-hof');
    if (hofBtn) hofBtn.addEventListener('click', () => this._showKingHallOfFame());
    const rankBtn = document.getElementById('btn-globalrank');
    if (rankBtn) rankBtn.addEventListener('click', () => this._showGlobalRanking());
  }

  // v27-7: 신규 유저 온보딩 - 간단한 게임방법 요약 (요청3)
  _showHowToPlay() {
    const overlay = document.createElement('div');
    overlay.className = 'skin-picker';
    overlay.innerHTML = `
      <div class="skin-picker-title">❓ 게임 방법</div>
      <div style="max-width:420px;text-align:left;color:#ddd;font-size:13px;line-height:1.9;padding:0 16px;max-height:60vh;overflow-y:auto;">
        <b style="color:#ffc24b">🎯 목표</b> — 필드에 몬스터가 <b>200마리</b> 쌓이면 끝. 웨이브를 최대한 오래 버티세요. 웨이브는 끝이 없어요.<br><br>
        <b style="color:#ffc24b">🎰 뽑기</b> — 하단 캡슐 버튼으로 포켓몬을 뽑아요. 빈 자리를 먼저 누르고 뽑으면 바로 배치, 아니면 보관함으로 가요. 일반(1성) · 프리미엄(1~3성) · 도박(2~5성) · 10연.<br><br>
        <b style="color:#ffc24b">🧪 합성</b> — 플라스크 버튼. 같은 등급 아무거나 3마리 → 다음 등급 랜덤, 같은 포켓몬 3마리 → 진화가 확정. <b>⚡⚡ 한 번에 전부</b>를 누르면 보관함의 그 등급을 전부 합성해요(배치된 타워는 그대로).<br><br>
        <b style="color:#ffc24b">💗 유니크</b> — 뮤 = 서로 다른 레전드 3마리, 뮤츠 = 뮤 + 레전드 2마리 + 2000골드. 합성 연구소 위쪽 레시피에서 만들어요.<br><br>
        <b style="color:#ffc24b">⬆ 강화 · 상점</b> — 하단 화살표 버튼. 타입 강화는 그 타입 타워 전부(등급별 고정 데미지 + 6%), 상점은 몬스터볼·대피시키기 같은 긴급 아이템이에요. 열어둔 채로 플레이할 수 있어요.<br><br>
        <b style="color:#ffc24b">💰 골드</b> — 처치 골드 + 웨이브 클리어 보너스 + <b>이자</b>(10골드당 1, 최대 30). 모아두면 이자가 붙어요.<br><br>
        <b style="color:#ffc24b">⚡ 영웅</b> — 맵에 놓고 길 근처로 옮겨요. 레벨이 오르면 스킬 포인트로 스킬트리를 찍어요(영웅을 누르면 열림).<br><br>
        <b style="color:#ffc24b">👹 보스</b> — 왼쪽 아래에서 직접 소환하면 큰 보상. 30웨이브마다 구역이 바뀌고 전설 보스가, 90웨이브엔 왕 루기아가 나와요.<br><br>
        <b style="color:#ffc24b">💎 메가진화</b> — 리자몽·거북왕·이상해꽃·갸라도스·쁘사이저·독침붕·프테라·캥카·피죤투·후딘·팬텀·썬더를 필드에 두고 누르면 <b>🍖 먹이기</b>로 보관함의 같은 포켓몬을 흡수해 ★이 올라요(★당 +35%). ★3 + 메가스톤이면 메가진화, 이후 ★5까지 계속 키울 수 있어요. 메가스톤은 <b>20웨이브마다 나오는 보스</b>에서 확률로만 나와요(30%부터 점점 올라감).<br><br>
        <b style="color:#ffc24b">🧭 이번 판 편성</b> — 시작할 때 이번 판에 많이 나오는 몬스터 특성 2가지와 추천 메가를 알려줘요. 유니크·메가는 같은 종 1마리만 배치할 수 있고, 필드에 서로 다른 타입이 4·5·6종이면 전체 공격력 +10·20·30%(상단 🌈).<br><br>
        <b style="color:#ffc24b">✨ 영웅 변신</b> — 15웨이브 이후 가끔(또는 20웨이브 보스에서) 영웅 전용 아이템이 떨어지면 변신해요. 피카츄→거다이맥스, 토게틱→토게키스, 이브이 계열은 금빛 각성.<br><br>
        <b style="color:#ffc24b">💿 기술머신</b> — 에픽·레전드 타워를 누르면 1500골드에 특성 1개를 배울 수 있어요(타워당 1번).
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
    const colors = { 140: ['#3a2f00','#ffc24b'], 160: ['#3a1f00','#ff9800'], 180: ['#3a0000','#ff3b3b'] };
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
        // v27-50: 이상해씨/파이리/꼬부기 선택처럼 영웅도 특징을 간략히 보여줌 (요청3)
        const descEl = document.getElementById('starter-hero-desc');
        if (descEl) descEl.textContent = `${btn.textContent.split(' ')[0]} ${btn.title}`;
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
      if (k === 'u') { e.preventDefault(); this.toggleUpgradeSheet(); return; } // v28 세션E: 강화 시트

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
            this.showWaveAnnounce(`${skill.emoji} ${skill.name}!`, '#ffc24b');
            this._flashScreenEdge(); // v27-17: 궁극기 발동 화면 테두리 플래시 (요청5)
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
    this.els.btnBack.addEventListener('click', () => {
      // v27-20: 뒤로가기 확인 팝업 (요청4) - 실수로 진행중인 판이 꺼지는 것 방지
      if (this.engine && (this.engine.state === 'wave' || this.engine.state === 'idle' || this.engine.state === 'paused')) {
        if (confirm('타이틀로 돌아가시겠습니까? 진행 중인 게임은 저장되지 않습니다.')) this.backToMapSelect();
      } else {
        this.backToMapSelect();
      }
    });
    this.els.btnMenu.addEventListener('click', () => this.togglePause());
    if (this.els.btnRecenter) this.els.btnRecenter.addEventListener('click', () => {
      // v27-47: 카메라를 월드 중앙(대략 첫번째 영웅 위치가 있으면 그쪽)으로 되돌림 (요청A)
      if (!this.engine) return;
      const hero = this.engine.heroes[0];
      this.engine.camera.x = hero ? hero.x : this.engine.worldWidth / 2;
      this.engine.camera.y = hero ? hero.y : this.engine.worldHeight / 2;
      this.engine.camera.zoom = Math.max(this.engine.minZoom, Math.min(this.engine.maxZoom,
        Math.min(this.engine.width / this.engine.worldWidth, this.engine.height / this.engine.worldHeight) * 1.15));
      this.engine.clampCamera();
    });
    const btnMission = document.getElementById('btn-mission');
    if (btnMission) btnMission.addEventListener('click', () => this.openMissionBoard());
    const btnSynergy = document.getElementById('btn-synergy');
    if (btnSynergy) btnSynergy.addEventListener('click', () => this.openSynergyChart());
    const btnPower = document.getElementById('btn-power');
    if (btnPower) btnPower.addEventListener('click', () => this.openPowerSummary());
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
    // v27-63: 카메라 원위치 버튼 (요청 - 화면이 확대/이동된 채 못 돌아오는 문제의 복구 수단)
    const camBtn = document.getElementById('btn-cam-reset');
    if (camBtn) camBtn.addEventListener('click', () => {
      if (this.engine) { this.engine.resetCamera(); this.showWaveAnnounce('🧭 화면 원위치', '#5b9dff'); }
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
    // v27-44: 슬롯을 선택 안 했어도 뽑을 수 있게 허용 - 결과는 보관함으로 감 (요청2 - 먼저 뽑고 나중에 배치)
    // 단, "점유된 슬롯을 선택한 채로" 뽑으려는 건 실수일 가능성이 높아서 계속 막음.
    // v28: 빈 슬롯을 선택한 상태면 바로 배치, 아니면(미선택/점유 슬롯) 보관함으로 - 막지 않음
    const noSlotSelected = slotIdx === null || !!this.engine.towerSlots[slotIdx]?.occupied;

    const cost = pullKey === 'ten' ? window.PULL_COSTS.ten : window.PULL_COSTS[pullKey];
    if (!this.engine.spendGold(cost)) {
      this.showWaveAnnounce('골드가 부족합니다', '#ff5c7a');
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
        }
        this.missionTracker.check();
      }
      return;
    }

    // 단일 뽑기
    const towerDef = window.rollTower(pullKey);
    if (noSlotSelected) {
      // v27-44: 슬롯 없이 뽑았으면 보관함으로 (요청2)
      this._addToStorage([towerDef]);
      const gg = window.GRADES?.[towerDef.grade];
      this.showWaveAnnounce(`${towerDef.emoji} ${towerDef.name} 획득! → 🎒보관함`, gg?.color || '#5b9dff');
    } else {
      this._placePulledTower(towerDef, slotIdx);
    }

    // 뽑기 등급 팝업 + 효과음
    const gradeSound = {normal:'pull_normal', rare:'pull_rare', epic:'pull_epic', legend:'pull_epic', unique:'merge'};
    const isRareReveal = towerDef.grade === 'epic' || towerDef.grade === 'legend' || towerDef.grade === 'unique';
    if (isRareReveal) {
      // v27-5: 에픽 이상은 짧은 서스펜스 연출 후 공개 (요청B: 가챠의 재미)
      let flick = 0;
      const flickInterval = setInterval(() => {
        this.showWaveAnnounce('❓❓❓', flick % 2 ? '#fff' : '#ffc24b');
        flick++;
        if (flick >= 3) {
          clearInterval(flickInterval);
          this.SFX.play(gradeSound[towerDef.grade] || 'pull_normal');
          const g = window.GRADES?.[towerDef.grade];
          this.showWaveAnnounce(`${towerDef.emoji} ${g?.name||""} ${towerDef.name}`, g?.color||"#ffc24b");
        }
      }, 220);
    } else {
      this.SFX.play(gradeSound[towerDef.grade] || 'pull_normal');
      if (towerDef.grade === 'rare') {
        const g = window.GRADES?.[towerDef.grade];
        this.showWaveAnnounce(`${towerDef.emoji} ${g?.name||""} ${towerDef.name}`, g?.color||"#ffc24b");
      }
    }
    // v27-5: 합체 힌트 (요청) - 뽑은 직후 동일 타워 보유수 체크해서 알려줌
    if (this.engine) {
      // v28: 필드 + 보관함 합산
      const sameCount = this._allMaterials(true).filter(m => m.def.id === towerDef.id).length;
      if (sameCount === 3 && window.MERGE_EVOLUTION[towerDef.id]) {
        setTimeout(() => this.showWaveAnnounce(`🧬 ${towerDef.emoji} ${towerDef.name} 3마리! 합성 연구소에서 확정 진화 가능`, '#34d399'), 900);
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
    // v3.2 (B): 유니크·메가는 같은 종 1마리만 필드에 - 넘치면 보관함으로
    if (def.grade === 'unique' && this.engine.towers.some(t => t._gachaId === def.id)) {
      this._addToStorage([def]);
      this.showWaveAnnounce(`${def.name}은(는) 필드에 1마리만 둘 수 있어요 → 보관함`, '#ff5c7a');
      return;
    }
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
    // v28 버그수정: 예전엔 결과를 보관함에 넣고, 카드 선택/닫기 때 또 넣어서 같은 포켓몬이 2배로 쌓였음.
    // 이제 보관함에 1번만 넣고, 카드를 탭하면 (빈 슬롯이 선택돼 있을 때) 보관함에서 꺼내 배치.
    this._addToStorage(results);
    const canPlace = slotIdx !== null && slotIdx !== undefined && !this.engine.towerSlots[slotIdx]?.occupied;
    const overlay = document.createElement('div');
    overlay.className = 'tenpull-overlay';
    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.textContent = canPlace ? '🌟 10연 뽑기 — 하나를 탭하면 선택한 슬롯에 배치 (나머지는 보관함)' : '🌟 10연 뽑기 — 전부 보관함에 들어갔어요';
    overlay.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'tenpull-grid';
    const order = window.MERGE_ORDER;
    for (const def of results.slice().sort((a, b) => order.indexOf(b.grade) - order.indexOf(a.grade))) {
      const grade = window.GRADES[def.grade];
      const card = document.createElement('div');
      card.className = `tenpull-card grade-${def.grade}`;
      card.style.borderColor = grade.color;
      card.style.boxShadow = `0 0 12px ${grade.glow}`;
      card.innerHTML = `<div class="tp-emoji">${PKM(def, 40)}</div><div class="tp-name" style="color:${grade.color}">${def.name}</div><div class="tp-grade">${'★'.repeat(grade.stars)}</div><div class="tp-grade-name">${grade.name}</div>`;
      if (canPlace) card.addEventListener('click', () => { overlay.remove(); this._placeFromStorage(def.id, slotIdx); });
      grid.appendChild(card);
    }
    overlay.appendChild(grid);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '확인';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    document.getElementById('game-screen').appendChild(overlay);
  }

  // v28: 예전 보관함 버튼/목록은 하단 보관함 스트립(storage.js)으로 대체 - 기존 호출 호환용
  _refreshInventoryBtn() { this.renderStorageStrip && this.renderStorageStrip(); }
  _openInventory() { this.openMergePanel && this.openMergePanel(); }

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
        '#ffc24b'
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
          this.showWaveAnnounce(`${s.name} 스킨은 잠겨있습니다`, '#ff5c7a');
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
    this.spellMgr.cooldowns = { trainingCamp: 0, netTrap: 0 }; // v27-46: 포켓몬센터/마스터볼→훈련소/그물망함정으로 개명
    // v27: 새 게임 시작시 타입강화 레벨 초기화 (이전 판 값이 남아있던 버그 방지)
    if (window.TypeUpgradeLevels) { for (const t in window.TypeUpgradeLevels) window.TypeUpgradeLevels[t] = 0; }

    // v28 버그수정: 보관함이 판마다 초기화되지 않아 이전 판 타워가 다음 판으로 넘어오고 있었음
    this._storageReset();
    // 미션 트래커 초기화
    this.missionTracker = new MissionTracker();
    this.missionTracker.onComplete = (mission) => this._onMissionComplete(mission);

    this.engine.onGoldChange  = g => {
      this.els.goldVal.textContent = Math.round(g);
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
      this._updateBossSummonUI(); // v27-36 버그수정: 웨이브 넘어가도 소환버튼 잠김상태가 안 풀리던 문제
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
      // v27-16: 보스 약점 타입 힌트 (요청1 - 타입상성 이제 실제 작동하니 시각화)
      let weakHint = '';
      if (window.TYPE_CYCLE && boss.typeTag) {
        const di = window.TYPE_CYCLE.indexOf(boss.typeTag);
        if (di >= 0) {
          const weakType = window.TYPE_CYCLE[(di - 1 + window.TYPE_CYCLE.length) % window.TYPE_CYCLE.length];
          const info = window.TYPES?.[weakType];
          if (info) weakHint = `<br><span style="font-size:0.75em;color:${info.color}">💡 ${info.emoji}${info.name} 타입에 약함!</span>`;
        }
      }
      const el = document.createElement('div');
      el.className = 'wave-announce boss';
      el.innerHTML = boss._isKing
        ? `👑 ${boss.def.emoji} 바다의 신 루기아 (왕) 등장!<br><span style="font-size:0.85em;font-style:italic">"…감히 내 영역에 발을 들이다니."</span>${weakHint}<br><span style="font-size:0.65em">⚠️ 이후로는 존 이동 없이 이 자리에서 무한 강화 모드로 진입합니다</span>`
        : `${boss.def.emoji} ${boss.name} 등장!<br><span style="font-size:0.7em">⚠️ 보스</span>${weakHint}`;
      document.getElementById('game-screen').appendChild(el);
      setTimeout(() => el.remove(), boss._isKing ? 4500 : 2800);
      this.engine.triggerScreenShake(boss._isKing ? 16 : 10, boss._isKing ? 0.6 : 0.4);
    };
    const origLoseLife = this.engine.loseLife.bind(this.engine);
    this.engine.loseLife = (n) => { this.SFX.play('life_lost'); origLoseLife(n); };
    this.engine.onKingDefeated = () => {
      this.showWaveAnnounce('👑 왕을 처치했습니다! 무한 강화 모드 진입 - 20웨이브마다 적이 새로운 능력을 얻습니다', '#ffc24b');
      this.SFX.play('king_victory'); // v27-18: 왕 처치 전용 승리 징글 (요청H)
      this.BGM.start('infinite'); // v27-7: 무한강화 진입시 전용 BGM으로 전환 (요청5)
      this._recordKingKill(); // v27-17: 왕 처치 기록 갤러리 (요청4)
    };
    this.engine.onWaveComplete = (wave, bonus, timedOut) => {
      this._megaWaveClear && this._megaWaveClear(wave);
      // v28: 토게피 '황금알' - N웨이브마다 무료 프리미엄 뽑기
      const every = this.engine._freePullEvery || 0;
      if (every > 0 && wave % every === 0) {
        const d = window.rollTower('premium');
        this._addToStorage([d]);
        setTimeout(() => this.showWaveAnnounce(`🥚 황금알! ${d.emoji} ${d.name} 획득 → 🎒`, '#ffc24b'), 700);
      }
      if (hudTimer) hudTimer.style.display = 'none';
      this.els.btnWave.disabled = false;
      if (!timedOut) this.SFX.play('wave_clear');
      // v27: 엔드리스 - 클리어 개념 없이 항상 자동으로 다음 웨이브 카운트다운
      this._startAutoWaveCountdown(wave + 1);
      if (!timedOut) {
        // v27-17: 웨이브 클리어 문구 다양화 (요청2) - 필드에 남은 적이 없으면 "완벽 클리어"
        const remaining = this.engine.enemies.length;
        const clearMsg = remaining === 0 ? `✨ 완벽한 클리어! Wave ${wave} +${bonus}g` : `Wave ${wave} 완료! +${bonus}g`;
        this.showWaveAnnounce(clearMsg, '#ffc24b');
      }
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

    this.els.goldVal.textContent = Math.round(this.engine.gold);
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
    this._applyRunSeedTrait(); // v27-18: 이번 판 한정 랜덤 시드특성 (요청G)
    this._megaRunInit && this._megaRunInit(); // v3.2: 메가스톤·편성·영웅 아이템
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
      card.innerHTML = `<div style="font-size:36px">${PKM(def, 52)}</div><div style="color:#fff;font-size:13px;margin-top:6px">${def.name}</div><div style="color:#888;font-size:10px;margin-top:4px">${def.desc||''}</div>`;
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
        this.showWaveAnnounce(`${def.emoji} ${def.name}(으)로 시작! (영구 데미지+15% 시그니처)`, '#ffc24b');
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
      // v28: 영웅 update는 engine.update가 이미 하고 있음 - 여기서 또 돌리면 스킬쿨/스탯이 2배속으로
      // 도는 버그였음 (v27-58 복구). 시뮬레이션 부분은 매 서브스텝, DOM 갱신은 프레임당 1회만.
      if (this.engine.state === 'wave' || this.engine.state === 'idle') this.spellMgr.update(this.engine.dt);
      if (this.engine._bossSummonCooldown > 0) this.engine._bossSummonCooldown -= this.engine.dt;
      if (this.engine.state === 'wave') this._waveTimer += this.engine.dt;
      if (this.engine._isLastSubstep === false) return;
      if (this.engine.state === 'wave' || this.engine.state === 'idle') {
        this.updateSpellBarUI();
        this.updateHeroSkillBarUI();
      }
      // 버그수정: 쿨이 0이 되는 순간에도 한 번 더 갱신해야 '1초 남음'에 멈춰 있지 않음
      if (this.engine._bossSummonCooldown > 0) { this._bossCdShown = true; this._updateBossSummonUI(); }
      else if (this._bossCdShown) { this._bossCdShown = false; this._updateBossSummonUI(); }
      // v27-46: 논리 해상도를 고정하는 방식으로 바뀌면서, 이 감시는 "진짜 방향전환"(세로↔가로)일 때만
      // 필요함 - 단순 창 크기 조절은 이제 게임 로직에 영향을 주지 않아야 하므로 의도적으로 무시함.
      this._dimCheckTimer = (this._dimCheckTimer || 0) + this.engine.dt;
      if (this._dimCheckTimer >= 1) {
        this._dimCheckTimer = 0;
        const cw = this.engine.canvas.clientWidth, ch = this.engine.canvas.clientHeight;
        const isPortraitNow = ch > cw;
        const wasPortrait = (this.engine._logicalHeight || 0) > (this.engine._logicalWidth || 1);
        if (cw > 0 && ch > 0 && isPortraitNow !== wasPortrait) {
          this.engine._logicalWidth = null; // 강제로 재결정하도록 초기화
          this._realignAfterResize();
        }
      }
      // v27-45: 스킵 버튼에 현재 밀린(대기중) 몹 수를 실시간 표시 (요청3 - 스킵 판단에 도움)
      if (this.engine.state === 'wave' && this.els.btnWave) {
        const backlog = this.engine.spawnQueue ? this.engine.spawnQueue.length : 0;
        this.els.btnWave.textContent = backlog > 0
          ? `⏭ 스킵 · 대기 ${backlog}`
          : '⏭ 다음 웨이브';
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
          const col = cnt >= 160 ? '#ff5252' : cnt >= 120 ? '#ffab40' : cnt >= 80 ? '#ffc24b' : '#34d399';
          if (cell) cell.style.color = cnt >= 80 ? col : '';
          const gauge = document.getElementById('field-gauge'); // v28 세션E: 0~200 진행바
          if (gauge) { gauge.style.width = Math.min(100, cnt / 2) + '%'; gauge.style.background = col; }
        }
      }
      // v27-24: 황금 시간 이벤트 완전 제거함 (요청 - 게임을 시작도 안 했는데 idle 상태에서 계속 발동돼서
      // 가만히 놔둬도 골드가 쌓이는 심각한 문제가 있었음. 아예 매커니즘 삭제.
      // v27-36: 미니 현상금 이벤트 완전 제거함 (요청 - 금방 잡히는데 돈만 많이 줘서 경제에 안 좋았음)
      // v27-5: 초반 유도미션용 트래킹 (요청C)
      if (this.missionTracker) {
        if (this.engine.currentWave <= 3 && this.engine.towers.length >= 6) this.missionTracker.stats.earlyDeploy4 = true;
      }
      // 웨이브 진행 중 타이머 + 남은 적 표시
      if (this.engine.state === 'wave') {
        this._updateWaveHUD();
      } else {
        this._waveTimer = 0;
        const timerEl = document.getElementById('hud-wave-info');
        if (timerEl) timerEl.textContent = '';
      }
    };

    // v28: 영웅은 engine.draw()가 카메라 변환 안에서 이미 그림. 여기서 카메라 밖(화면좌표)에 한 번 더
    // 그리던 코드가 "영웅이 2마리로 보이는" 원인이었음 (v27-58 복구) - 래퍼 제거.

    const origPlace = this.engine.placeTower.bind(this.engine);
    this.engine.placeTower = (TowerClass, slotIdx) => {
      const result = origPlace(TowerClass, slotIdx);
      if (result) {
        window.applyTowerSynergies(this.engine.towers);
      }
      return result;
    };

    const origTap = this.engine.handleTap.bind(this.engine);
    this.engine.handleTap = (sx, sy) => {
      if (this.placingHero) {
        // v27-47: 카메라 시스템 대응 - 화면좌표를 월드좌표로 변환 (기존엔 화면좌표를 그대로
        // 월드좌표처럼 써서, 카메라가 이동/줌 된 상태에서 엉뚱한 곳에 영웅이 배치되고 있었음)
        const { x, y } = this.engine.screenToWorld(sx, sy);
        // 슬롯이든 빈 곳이든 어디든 배치 가능 (월드 범위 안이면)
        {
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
          px = Math.max(20, Math.min(this.engine.worldWidth - 20, px));
          py = Math.max(20, Math.min(this.engine.worldHeight - 20, py));

          const skinId = this.selectedHeroSkins[this.placingHero];
          // 이미 배치된 영웅이면 위치만 이동
          // v27-48 버그수정: 영웅이 2마리로 늘어나는 문제 방어 - id 매칭에 실패하는 경우가 있어도
          // 이 게임은 영웅이 항상 1명뿐이므로, 이미 영웅이 하나라도 있으면 무조건 "이동"으로 처리
          // (새로 생성하지 않음)해서 중복 생성 자체를 원천 차단.
          const existing = this.engine.heroes[0];
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
      origTap(sx, sy);
      const selIdx = this.engine.selectedSlotIdx;
      // v28: 보관함에서 고른 포켓몬을 들고 있으면, 탭한 빈 슬롯에 바로 배치
      if (this._placingId && selIdx !== null && !this.engine.towerSlots[selIdx].occupied) {
        this._placeFromStorage(this._placingId, selIdx);
        document.querySelectorAll('.gacha-btn').forEach(b => b.classList.remove('slot-ready'));
        this.syncTowerPanel();
        return;
      }
      if (selIdx !== null && !this.engine.towerSlots[selIdx].occupied) {
        document.querySelectorAll('.gacha-btn').forEach(b => b.classList.add('slot-ready'));
        this.showWaveAnnounce('🎯 뽑기 버튼을 클릭!', '#6aa8ff');
      } else {
        document.querySelectorAll('.gacha-btn').forEach(b => b.classList.remove('slot-ready'));
      }
      this.syncTowerPanel();
    };
  }

  // ===== 타워 패널 (가챠 전용) =====
  // v27-4: 시너지 조합표/미션판/타워바 등 UI 빌드 메서드는 ui-builders.js로 분리됨

  // v27-43: 웨이브 대기시간 완전 제거 (요청2 - 스킵해도 또 기다려야하고, 대기중에도 또 눌러야해서
  // 사실상 두 번 눌러야 하던 문제). 이제 웨이브가 끝나면 카운트다운 없이 바로 다음 웨이브 시작.
  _startAutoWaveCountdown(nextWave) {
    if (this._autoWaveTimer) clearTimeout(this._autoWaveTimer);
    this._showWavePreview(nextWave);
    this.els.btnWave.textContent = `▶ Wave ${nextWave}`;
    this._autoWaveTimer = setTimeout(() => {
      if (!this.engine || this.engine.state !== 'idle') return;
      this.sendWave();
    }, 150); // 최소한의 시각적 여유(0.15초)만 두고 즉시 진행
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
    if (e.state !== 'wave') { this.showWaveAnnounce('웨이브 진행 중에만 소환 가능', '#ff5c7a'); return; }
    if ((e._bossSummonCooldown || 0) > 0) return;
    // v27-28: 보스 티어별 최소 웨이브 요구 (요청: 초반부터 뮤츠까지 쉽게 소환/처치되던 문제)
    if (e.currentWave < tierDef.minWave) {
      this.showWaveAnnounce(`🔒 ${tierDef.label}은(는) 웨이브 ${tierDef.minWave} 이후에 소환 가능`, '#ff5c7a');
      return;
    }
    const waveMul = bossWaveScaleMul(e.currentWave);
    e._spawnEnemy({ type: tierDef.type, bossTier: tier, hpMul: tierDef.hpMul * waveMul, rewardMul: tierDef.rewardMul });
    e._bossSummonCooldown = BOSS_SUMMON_COOLDOWN;
    this.showWaveAnnounce(`🔮 ${tierDef.label}(${tier}성) 소환!`, '#ff5c7a');
    if (this.missionTracker) { this.missionTracker.stats.bossSummons = (this.missionTracker.stats.bossSummons||0) + 1; this.missionTracker.check(); }
    this._updateBossSummonUI();
  }

  _updateBossSummonUI() {
    const bar = document.getElementById('boss-summon-bar');
    if (!bar || !this.engine) return;
    bar.querySelectorAll('.boss-tier-chip').forEach(chip => {
      chip.style.borderColor = Number(chip.dataset.tier) === this._bossSummonTier ? '#ffc24b' : 'rgba(255,255,255,0.2)';
      chip.style.background = Number(chip.dataset.tier) === this._bossSummonTier ? 'rgba(255,194,75,0.25)' : 'rgba(0,0,0,0.4)';
    });
    const btn = document.getElementById('boss-summon-btn');
    if (!btn) return;
    const cd = this.engine._bossSummonCooldown || 0;
    const tierDef = BOSS_TIERS.find(t => t.tier === this._bossSummonTier);
    if (cd > 0) {
      btn.disabled = true;
      btn.textContent = `⏳ 재사용 대기 (${Math.ceil(cd)}s)`;
    } else if (this.engine.currentWave < (tierDef.minWave || 1)) {
      btn.disabled = true;
      btn.textContent = `🔒 웨이브 ${tierDef.minWave} 이후 소환가능`;
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
  _tryTapHero(sx, sy) {
    if (!this.engine) return false;
    // v27-47: 화면좌표를 월드좌표로 변환 (요청A - 카메라 팬/줌 대응)
    const { x, y } = this.engine.screenToWorld(sx, sy);
    const radius = 38 / this.engine.camera.zoom;
    for (const hero of this.engine.heroes) {
      if (Math.hypot(hero.x - x, hero.y - y) < radius) {
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
    // v27-50: 타워 패널처럼 영웅도 데미지 breakdown 표시 (요청4 - "영웅은 타워처럼 공식이 안 뜬다")
    const a = hero.def.attack;
    const baseLv = a ? Math.round(a.baseDamage + (hero.level-1)*a.damagePerLevel) : 0;
    const skillBonus = hero._skillVal('atkDmg', 0) + (hero._multiTargetDmgBonus || 0);
    const evoMul = hero._evoStatMul || 1;
    const typeMul = hero._typeUpgradeDmgMul ? hero._typeUpgradeDmgMul() : 1;
    const breakdown = `
      <div style="font-size:9.5px;color:#999;margin:4px 0;line-height:1.5;border-top:1px dashed rgba(255,255,255,0.1);padding-top:3px;">
        📐 데미지 breakdown: 기본${baseLv}(Lv${hero.level})
        × 스킬${(1+skillBonus).toFixed(2)}
        ${evoMul!==1?`× 진화${evoMul.toFixed(2)}`:''}
        × 타입강화${typeMul.toFixed(2)}
        = <span style="color:#ffc24b">${Math.round(hero.attackDamage)}</span>
      </div>`;
    panel.innerHTML = `
      <div class="tower-panel-name">${hero.skin.emoji} ${hero.name} Lv${hero.level} ${typeTag}</div>
      <div class="tower-panel-stats">⚔️${Math.round(hero.attackDamage)} · 📏${Math.round(hero.attackRange)} · ✨EXP ${expPct}%</div>
      <div style="font-size:10px;color:#aaa;margin:2px 0">${hero.def.passive || ''}</div>
      ${breakdown}
      <div class="tower-panel-btns">
        <button class="tp-btn" data-action="close">닫기</button>
      </div>
    `;
    panel.querySelector('[data-action="close"]').addEventListener('click', () => panel.remove());
  }

  bindCanvasInput() {
    // v27-63: 모바일에서 브라우저 자체의 "페이지 확대"가 어쩌다 발동되면(더블탭/핀치줌 오인식)
    // 사파리는 되돌릴 방법을 안 줘서 화면이 확대된 채 게임을 망치는 문제 (요청).
    // CSS touch-action:none만으로는 iOS 사파리가 무시하는 경우가 있어 3중으로 차단:
    // 1) iOS 전용 gesture 이벤트(페이지 핀치줌의 근원) 차단 - 게임 카메라 핀치줌은
    //    canvas의 touch 이벤트로 처리되므로 영향 없음
    ['gesturestart','gesturechange','gestureend'].forEach(ev =>
      document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
    // 2) 더블클릭 줌 차단
    document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
    // 3) 비인터랙티브 요소(패널 여백 등)에서의 빠른 연속탭 → 사파리 더블탭줌 휴리스틱 차단.
    //    버튼/입력요소/랭킹타이틀(관리자 5탭)은 제외해서 뽑기 연타 등 정상 연타 UX는 그대로 유지.
    let _lastTapEnd = 0;
    document.addEventListener('touchend', (e) => {
      const t = Date.now();
      const isInteractive = e.target.closest && e.target.closest('button, input, select, textarea, a, #rank-title, #game-canvas');
      if (!isInteractive && t - _lastTapEnd < 320) e.preventDefault();
      _lastTapEnd = t;
    }, { passive: false });

    // v27-36: 모바일은 마우스 호버가 없어서 title 속성(스킬/아이템 설명)을 볼 방법이 없었음 (요청8).
    // 버튼을 터치하는 순간 title 텍스트를 짧게 화면에 띄워주고, 원래 탭 동작(클릭)은 그대로 진행되게 함
    // (설명 확인과 실제 사용을 방해하지 않고 동시에 되도록 - preventDefault 안 씀).
    document.addEventListener('touchstart', (e) => {
      let el = e.target;
      while (el && el !== document.body && !el.title) el = el.parentElement;
      if (el && el.title) {
        this.showWaveAnnounce(el.title, '#5b9dff');
      }
    }, { passive: true });


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
    const touchDist = (e) => {
      if (e.touches.length < 2) return null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      return Math.hypot(dx, dy);
    };

    // v27-47: 팬(드래그)/줌(핀치) 제스처 상태 (요청A - 카메라 시스템)
    let gestureStart = null;   // {x,y} 화면좌표, 탭인지 드래그인지 구분용
    let didPan = false;
    let pinchStartDist = null, pinchStartZoom = 1;
    const PAN_THRESHOLD = 24; // v27-48: 10→24px로 완화 (요청3 - 자연스러운 탭 손떨림도 팬으로 오인되어 탭이 씹히던 문제)

    let lastTouchTapTime = 0;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length >= 2) {
        const d = touchDist(e);
        pinchStartDist = (d && d > 5) ? d : null; // v27-49: 거리가 너무 작으면(손가락 거의 겹침) 나누기 안전장치
        pinchStartZoom = this.engine.camera.zoom;
        return;
      }
      lastTouchTapTime = Date.now(); // v27-21: 터치 직후 합성 click이 중복 발동되는 것 방지용 (요청11)
      const pos = getPos(e);
      gestureStart = pos; didPan = false;
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length >= 2 && pinchStartDist) {
        // 핀치 줌
        const d = touchDist(e);
        if (d) {
          const cam = this.engine.camera;
          cam.zoom = Math.max(this.engine.minZoom, Math.min(this.engine.maxZoom, pinchStartZoom * (d / pinchStartDist)));
          this.engine.clampCamera();
        }
        return;
      }
      const pos = getPos(e);
      if (gestureStart) {
        const dx = pos.x - gestureStart.x, dy = pos.y - gestureStart.y;
        if (didPan || Math.hypot(dx, dy) > PAN_THRESHOLD) {
          didPan = true;
          const cam = this.engine.camera;
          cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom;
          this.engine.clampCamera();
          gestureStart = pos;
          return;
        }
      }
      this.engine.handleHover(pos.x, pos.y);
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      if (pinchStartDist && e.touches.length < 2) pinchStartDist = null;
      if (!didPan && gestureStart) {
        if (this._tryTapHero(gestureStart.x, gestureStart.y)) { gestureStart = null; return; }
        this.engine.handleTap(gestureStart.x, gestureStart.y);
      }
      gestureStart = null;
    });

    canvas.addEventListener('click', e => {
      // v27-21 버그수정: 터치 직후에는 브라우저가 합성 click을 한 번 더 쏴서 탭 하나에 handleTap이
      // 두 번 불리고 있었음(선택→즉시재선택 등으로 "안 눌리는 것처럼" 보이던 원인 추정). 800ms 내 중복 무시.
      if (Date.now() - lastTouchTapTime < 800) return;
      const pos = getPos(e);
      if (this._tryTapHero(pos.x, pos.y)) return;
      this.engine.handleTap(pos.x, pos.y);
    });

    // v27-47: 데스크탑 마우스 드래그로도 팬 가능하게
    let mouseDown = false, mouseDidPan = false, mouseStart = null;
    canvas.addEventListener('mousedown', e => {
      mouseDown = true; mouseDidPan = false; mouseStart = getPos(e);
    });
    canvas.addEventListener('mousemove', e => {
      const pos = getPos(e);
      if (mouseDown && mouseStart) {
        const dx = pos.x - mouseStart.x, dy = pos.y - mouseStart.y;
        if (mouseDidPan || Math.hypot(dx, dy) > PAN_THRESHOLD) {
          mouseDidPan = true;
          const cam = this.engine.camera;
          cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom;
          this.engine.clampCamera();
          mouseStart = pos;
          return;
        }
      }
      this.engine.handleHover(pos.x, pos.y);
    });
    canvas.addEventListener('mouseup', e => {
      if (!mouseDidPan) {
        const pos = getPos(e);
        if (!this._tryTapHero(pos.x, pos.y)) this.engine.handleTap(pos.x, pos.y);
      }
      mouseDown = false; mouseStart = null;
    });
    // v27-47: 마우스 휠로 줌 (데스크탑)
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const cam = this.engine.camera;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      cam.zoom = Math.max(this.engine.minZoom, Math.min(this.engine.maxZoom, cam.zoom * factor));
      this.engine.clampCamera();
    }, { passive: false });

    this._resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
      // v27-46: 논리 해상도 고정 방식으로 바뀌면서, 단순 창 크기 조절은 이제 무시해야 함(게임 로직에
      // 영향 주면 안 됨). 진짜 방향전환(세로↔가로)일 때만 논리 해상도를 재결정함.
      clearTimeout(this._resizeDebounceTimer);
      this._resizeDebounceTimer = setTimeout(() => {
        if (!this.engine) return;
        const cw = this.engine.canvas.clientWidth, ch = this.engine.canvas.clientHeight;
        const isPortraitNow = ch > cw;
        const wasPortrait = (this.engine._logicalHeight || 0) > (this.engine._logicalWidth || 1);
        if (cw > 0 && ch > 0 && isPortraitNow !== wasPortrait) {
          this.engine._logicalWidth = null;
          this._realignAfterResize();
        }
      }, 300);
    });
  }

  // v27-28: 리사이즈/레이아웃변경 후 적·영웅 위치 재정렬 (재사용 가능하게 메서드로 분리 - 요청: 여전히
  // "몬스터 안보이는데 필드에 있다"는 문제가 있어서, window resize 이벤트 없이도 내부 CSS 레이아웃
  // 변경만으로 캔버스 표시크기가 바뀌는 경우까지 잡기 위해 매 프레임 감시도 추가함)
  _realignAfterResize() {
    if (!this.engine) return;
    const oldW = this.engine.worldWidth || 1, oldH = this.engine.worldHeight || 1;
    const oldEnemyRatios = this.engine.enemies.map(en => ({
      en, ratio: en.totalLen ? (en.distTraveled / en.totalLen) : 0,
    }));
    const oldHeroRatios = this.engine.heroes.map(h => ({ h, rx: h.x / oldW, ry: h.y / oldH }));
    this.engine.resize();
    this.engine.buildPaths();
    this.engine.buildTowerSlots();
    this.engine._bgDirty = true;
    this.engine.clampCamera(); // v27-47: 새 월드 크기에 맞게 카메라도 재조정
    const newPath = this.engine.paths && this.engine.paths[0];
    if (newPath) {
      const newLen = typeof totalPathLength === 'function' ? totalPathLength(newPath) : 0;
      for (const { en, ratio } of oldEnemyRatios) {
        if (en.dead) continue;
        en.path = newPath;
        en.totalLen = newLen;
        en.distTraveled = newLen * ratio;
      }
    }
    for (const { h, rx, ry } of oldHeroRatios) {
      h.x = rx * this.engine.worldWidth;
      h.y = ry * this.engine.worldHeight;
    }
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
      this.showWaveAnnounce(ZONE_LABELS[nextZone], '#9cc4ff');
    }

    const wave = generateWave(nextWave);

    // v27-5: 랜덤 이벤트 웨이브 (요청: 다채로움) - 보스/왕 웨이브는 제외, 15% 확률
    e._globalGoldMul = 1; e._waveSpeedMul = 1; e._waveHpMul = 1;
    const isBossWave = nextWave === KING_WAVE || nextWave % 10 === 0;
    if (!isBossWave && nextWave >= 3 && Math.random() < 0.15) {
      const events = [
        { name:'💰 골드 러쉬', color:'#ffc24b', apply:()=>{ e._globalGoldMul = 2.2; } },
        { name:'⚡ 스피드 웨이브', color:'#5b9dff', apply:()=>{ e._waveSpeedMul = 1.5; e._waveHpMul = 0.75; } },
        { name:'🛡️ 정예 웨이브', color:'#ff5c7a', apply:()=>{ e._waveHpMul = 1.6; e._globalGoldMul = 1.8; } },
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
      this.showWaveAnnounce(`👑 왕이 기다리고 있습니다... (Wave ${nextWave})`, '#ffc24b');
    } else if (nextWave % 30 === 0) {
      this.showWaveAnnounce(`🔮 존 보스 등장! (Wave ${nextWave})`, '#ff5c7a');
    } else if (nextWave % 10 === 0) {
      this.showWaveAnnounce(`☠️ 중간보스 등장! (Wave ${nextWave})`, '#ffab40');
    }

    // v27-9: 왕/보스 웨이브는 시간제한을 짧게 고정 - 못 잡아도 빠르게 다음 웨이브로 넘어가도록 (요청3)
    const isBossOrKingWave = nextWave === KING_WAVE || nextWave % 10 === 0;
    const timeLimit = isBossOrKingWave ? 22 : waveTimeLimit(wave, this.difficulty, this.engine);
    if (e.startWave(wave, timeLimit)) {
      this.els.btnWave.disabled = false;
      this.els.btnWave.textContent = '⏭ 스킵 (남은 적 놔두고 진행)';
      setTimeout(() => this.showWaveAnnounce(`Wave ${e.currentWave}`, '#ffc24b'), 100);
    }
  }

  showWaveAnnounce(text, color) {
    // v27-16: 배속(3x 등)에서 알림이 실시간 기준 2.2초 동안 안 사라져서 여러 개가 겹쳐 보이던 문제.
    // 활성 알림들을 배열로 관리해서 세로로 살짝 어긋나게 쌓고, 너무 많으면 오래된 것부터 즉시 정리.
    if (!this._activeAnnounces) this._activeAnnounces = [];
    const MAX_STACK = 3;
    while (this._activeAnnounces.length >= MAX_STACK) {
      const old = this._activeAnnounces.shift();
      old.el.remove();
      clearTimeout(old.timer);
    }
    const el = document.createElement('div');
    el.className = 'wave-announce';
    el.style.color = color;
    if (/<(br|span|b)\b/.test(text)) el.innerHTML = text; else el.textContent = text; // 내부 문구만 들어옴 (줄바꿈·작은 글씨 지원)
    document.getElementById('game-screen').appendChild(el);
    const entry = { el, timer: null };
    this._activeAnnounces.push(entry);
    this._repositionAnnounces();
    entry.timer = setTimeout(() => {
      el.remove();
      const idx = this._activeAnnounces.indexOf(entry);
      if (idx >= 0) this._activeAnnounces.splice(idx, 1);
      this._repositionAnnounces();
    }, 1700 / (this.engine?.speedMul || 1)); // 배속이 빠를수록 조금 더 빨리 사라지게
  }

  // v27-16: 알림들을 세로로 살짝 어긋나게 배치 (겹침 방지)
  _repositionAnnounces() {
    if (!this._activeAnnounces) return;
    this._activeAnnounces.forEach((entry, i) => {
      const offset = (i - (this._activeAnnounces.length - 1) / 2) * 46;
      entry.el.style.top = `calc(50% + ${offset}px)`;
    });
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
      bestEl.style.cssText = 'color:#ffc24b;font-size:15px;margin-bottom:8px;';
      bestEl.textContent = `🏆 최고 기록: ${best != null ? best : reached}`;
      overlay.appendChild(bestEl);

      // v27-6: 이번 판 요약 (요청4) - MVP타워/최고시너지/사용 종수
      const summary = document.createElement('div');
      summary.style.cssText = 'background:rgba(0,0,0,0.3);border-radius:10px;padding:10px 16px;margin:6px 0;font-size:12px;color:#ccc;text-align:left;min-width:220px;';
      // v3.2: 실제로 들어간 데미지 기준 (예전엔 '공격 횟수 × 공격력'이라 뮤츠처럼 특수 공격하는 타워가 빠졌음)
      const ds = this.engine._dmgStats || {};
      const total = Object.values(ds).reduce((a, r) => a + r.dmg, 0) || 1;
      const rows = Object.entries(ds).filter(([k]) => k !== 'other').sort((a, b) => b[1].dmg - a[1].dmg).slice(0, 6);
      const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n);
      const mvpRow = rows.find(([k]) => k !== 'hero');
      const mvpDef = mvpRow && window.GachaTowerDefs?.[mvpRow[0]];
      const heroName = this.engine.heroes?.[0]?.name || '영웅';
      const rowHtml = rows.map(([k, r], i) => {
        const d = k === 'hero' ? null : window.GachaTowerDefs?.[k];
        const nm = d ? d.name : heroName;
        const cnt = d ? this.engine.towers.filter(t => t._gachaId === k).length : 1;
        const pct = Math.round(r.dmg / total * 100);
        const col = d ? window.GRADES[d.grade].color : '#ffc24b';
        return `<div class="rs-row"><span class="rs-rank">${i + 1}</span>${d ? PKM(d, 26) : '⚡'}<span class="rs-name" style="color:${col}">${nm}${cnt > 1 ? ` ×${cnt}` : ''}</span>
          <span class="rs-bar"><i style="width:${pct}%;background:${col}"></i></span><span class="rs-num">${fmt(r.dmg)} · ${pct}% · ${r.kills}킬</span></div>`;
      }).join('');
      const varietyCount = new Set(this.engine.towers.map(t => t.def?.type)).size;
      // v27-18: 사망 서사 (요청F)
      const dc = this.engine._deathCause;
      const deathLine = dc ? `<div style="color:#ff5c7a;font-style:italic;margin-top:4px">💀 ${dc.name} ${dc.count}마리에게 둘러싸여 무너졌습니다</div>` : '';
      summary.innerHTML = `
        <div style="color:#ffc24b;font-weight:700;margin-bottom:6px;">📊 이번 판 요약 — 데미지 순위</div>
        ${rowHtml || '<div>기록 없음</div>'}
        <div class="rs-foot">총 데미지 ${fmt(total)} · 필드 ${this.engine.towers.length}마리 · 타입 ${varietyCount}종 · 점수 ${(this.engine.score||0).toLocaleString()}</div>
        ${deathLine}
      `;
      overlay.appendChild(summary);

      // v27-18/20: 전체 랭킹 제출 UI (요청 - 끝났을 때 이름+기록 저장)
      if (window.Leaderboard && window.Leaderboard.isEnabled()) {
        const rankBox = document.createElement('div');
        rankBox.style.cssText = 'display:flex;gap:6px;margin:8px 0;align-items:center;';
        rankBox.innerHTML = `
          <input id="rank-name-input" maxlength="12" placeholder="이름 입력 (최대 12자)"
            style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.4);color:#fff;font-size:13px;">
          <button id="rank-submit-btn" style="padding:8px 14px;border-radius:8px;border:none;background:#ffc24b;color:#1a1200;font-weight:700;font-size:13px;cursor:pointer;">🏆 랭킹 등록</button>
        `;
        overlay.appendChild(rankBox);
        const submitBtn = rankBox.querySelector('#rank-submit-btn');
        const nameInput = rankBox.querySelector('#rank-name-input');
        const blockUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        submitBtn.addEventListener('click', async () => {
          submitBtn.disabled = true; submitBtn.textContent = '등록 중...';
          window.addEventListener('beforeunload', blockUnload); // v27-26: 등록 중 새로고침/닫기 방지 (요청1)
          const res = await window.Leaderboard.submitScore(nameInput.value, this.engine.score || 0, reached);
          window.removeEventListener('beforeunload', blockUnload);
          if (!submitBtn.isConnected) return; // v27-26: 등록 대기 중 화면이 닫혔으면 안전하게 중단
          // 실패 원인을 화면에 표시 (permission-denied = Firestore 보안 규칙 만료/차단)
          submitBtn.textContent = res.ok ? '✅ 등록 완료!' : res.code === 'permission-denied' ? '❌ 서버 권한 오류' : '❌ 등록 실패';
          if (!res.ok) { submitBtn.disabled = false; submitBtn.title = res.reason || ''; console.warn('[랭킹]', res.code, res.reason); }
        });
      } else {
        // v27-20: 조용히 안 보이던 것 대신 명확한 안내 (요청6 - 등록UI가 아예 안보여서 헷갈렸음)
        const noticeEl = document.createElement('div');
        noticeEl.style.cssText = 'font-size:11px;color:#888;margin:6px 0;text-align:center;';
        noticeEl.textContent = '🌍 랭킹 서버 미설정 (firebase-config.js에 본인 Firebase 프로젝트 값을 입력해야 등록 가능)';
        overlay.appendChild(noticeEl);
      }
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

    // v28 세션E: 인스타 4:5 결과 카드 공유
    const shareBtn = document.createElement('button');
    shareBtn.className = 'end-btn';
    shareBtn.style.cssText = 'background:linear-gradient(135deg,#a78bfa,#6aa8ff);margin-bottom:8px;';
    shareBtn.textContent = '📸 결과 카드 공유';
    shareBtn.addEventListener('click', () => this.shareResultCard(shareBtn));
    overlay.appendChild(shareBtn);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'end-btn';
    retryBtn.style.cssText = 'background:linear-gradient(135deg,#ff9800,#ff5722);margin-bottom:8px;';
    retryBtn.textContent = '🔄 바로 다시 도전';
    retryBtn.addEventListener('click', () => {
      overlay.remove();
      this.backToMapSelect();
      this.startGame(); // v27-44: 화면 두 번 안 거치고 바로 재시작 (요청1)
    });
    overlay.appendChild(retryBtn);

    const btn = document.createElement('button');
    btn.className = 'end-btn';
    btn.textContent = '처음으로';
    btn.addEventListener('click', () => { overlay.remove(); this.backToMapSelect(); });
    overlay.appendChild(btn);

    gameScreen.appendChild(overlay);
  }

  backToMapSelect() {
    if (this._autoWaveTimer) { clearTimeout(this._autoWaveTimer); this._autoWaveTimer = null; }
    if (this._resizeDebounceTimer) { clearTimeout(this._resizeDebounceTimer); this._resizeDebounceTimer = null; } // v27-26: 안 쓰는 타이머 정리
    this.BGM.stop();
    if (this.engine) { this.engine.stop(); this.engine = null; }
    this.els.btnMenu.innerHTML = ICON('pause', 18);
    document.getElementById('upgrade-sheet')?.classList.remove('open');
    document.querySelector('.upg-open-btn')?.classList.remove('active');
    // 배속 초기화
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.toggle('active', b.dataset.speed === '1'));
    document.querySelectorAll('.gacha-btn').forEach(b => b.classList.remove('slot-ready'));
    this.els.gameScreen.classList.remove('active');
    this.els.mapSelect.classList.add('active');
    this._refreshBestWaveLabel();

    const ctx = this.els.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);

    document.querySelectorAll('.end-overlay,.pause-overlay,.wave-announce,.shop-overlay,.skin-picker,.skilltree-overlay,.mission-overlay,.synergy-overlay,.power-overlay,#field-warning-banner,#field-danger-vignette,#wave-preview').forEach(el => el.remove());
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
    // v27-24 버그수정: 'wave' 상태에서만 작동해서, 웨이브 사이 idle 상태(꽤 자주 있음)에선
    // 눌러도 아무 반응이 없어 "의미없는 버튼"처럼 보였음 (요청5) - idle도 지원하도록 확장.
    if (this.engine.state === 'wave' || this.engine.state === 'idle') {
      this._pausedFromState = this.engine.state;
      this.engine.state = 'paused';
      this.engine.stop();
      this.els.btnMenu.innerHTML = ICON('play', 18);
      // v28 세션E: 일시정지 메뉴 (웨이브 버튼과 겹치던 '← 맵' 버튼을 여기로 옮김)
      const ov = document.createElement('div');
      ov.className = 'pause-overlay';
      ov.innerHTML = `<div class="po-card"><div class="po-title">⏸ 일시정지</div>
        <button class="po-btn go">▶ 계속하기</button><button class="po-btn quit">🏠 타이틀로</button>${(this.engine._errLog || []).length ? `<div class="po-err">오류 기록 ${this.engine._errCount}건 (스크린샷 보내주세요)<br>${this.engine._errLog.map(m => m.replace(/</g, '&lt;')).join('<br>')}</div>` : ''}</div>`;
      ov.querySelector('.go').onclick = () => this.togglePause();
      ov.querySelector('.quit').onclick = () => { if (confirm('타이틀로 돌아가시겠습니까? 진행 중인 게임은 저장되지 않습니다.')) { ov.remove(); this.backToMapSelect(); } };
      document.getElementById('game-screen').appendChild(ov);
    } else if (this.engine.state === 'paused') {
      this.engine.state = this._pausedFromState || 'wave';
      this.engine.start();
      this.els.btnMenu.innerHTML = ICON('pause', 18);
      document.querySelector('.pause-overlay')?.remove();
    }
  }
}

// ===== BOOT =====
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('i[data-ic]').forEach(el => { el.outerHTML = ICON(el.dataset.ic, 18); }); // v3.0 아이콘
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
  const COLORS = ['#ffc24b','#6aa8ff','#f48fb1','#34d399','#a78bfa','#ff5c7a'];
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
    if (frame % 2 === 1) return; // v28: 타이틀은 장식용이라 30fps (방치 시 배터리 절약)

    W = canvas.clientWidth; H = canvas.clientHeight;
    if (canvas.width !== W || canvas.height !== H) { canvas.width=W; canvas.height=H; }

    // 배경
    ctx.fillStyle = '#030612';
    ctx.fillRect(0, 0, W, H);

    // 성운 orb
    for (const o of orbs) {
      o.phase += o.speed * 2;
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
      p.x += p.vx * 0.032; p.y += p.vy * 0.032;
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
        ctx.fillStyle = p.color; // shadowBlur 대신 반투명 큰 원으로 글로우 (저비용)
        ctx.globalAlpha *= 0.35;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r*2.2, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha /= 0.35;
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
