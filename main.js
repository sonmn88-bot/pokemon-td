// ===== MAIN.JS - 화면 관리 + HUD + 웨이브 데이터 20개 + 타워/영웅/상점 통합 =====

// ===== 웨이브 데이터 20개 =====
const WaveData = [
  /* W1 */ [ ...seq('abo', 8, 1.5, 0) ],
  /* W2 */ [ ...seq('abo', 5, 1.2, 0), ...seq('jigglypuff', 3, 2.0, 0, 9) ],
  /* W3 */ [ ...seq('abo', 6, 1.0, 0), ...seq('rattata', 6, 0.6, 0, 4), ...seq('paras', 4, 2.0, 0, 9) ],
  /* W4 */ [ ...seq('jigglypuff', 5, 1.5, 0), ...seq('paras', 4, 1.5, 0, 6), ...seq('abo', 4, 0.8, 0, 12), ...seq('zubat', 4, 1.0, 0, 14) ],
  /* W5 */ [ ...seq('abo', 10, 0.7, 0), ...seq('jigglypuff', 5, 1.5, 0, 4), ...seq('koffing', 3, 2.0, 0, 10), ...seq('paras', 4, 2.0, 0, 14) ],

  /* W6 */ [ ...seq('gastly', 6, 1.5, 0), ...seq('lapras', 3, 2.0, 0, 8), ...seq('zubat', 5, 1.0, 0, 12) ],
  /* W7 */ [ ...seq('golbat', 6, 1.0, 0), ...seq('gastly', 5, 1.2, 0, 5), ...seq('magnemite', 4, 1.5, 0, 10) ],
  /* W8 */ [ ...seq('phantump', 4, 2.0, 0), ...seq('lapras', 5, 1.5, 0, 6), ...seq('haunter', 4, 1.8, 0, 12) ],
  /* W9 */ [ ...seq('gastly', 8, 0.8, 0), ...seq('phantump', 4, 2.0, 0, 6), ...seq('golbat', 4, 1.0, 0, 12), ...seq('electrode', 3, 2.0, 0, 16) ],
  /* W10 - 갸라도스 중간보스 */ [
    ...seq('abo', 6, 1.0, 0), ...seq('lapras', 4, 1.5, 0, 6),
    { type: 'gyarados', delay: 12 },
    ...seq('gastly', 5, 1.0, 0, 14),
  ],

  /* W11 */ [ ...seq('weezing', 5, 2.0, 0), ...seq('paras', 5, 1.5, 0, 8), ...seq('onix', 3, 2.0, 0, 14) ],
  /* W12 */ [ ...seq('scyther', 4, 2.5, 0), ...seq('weezing', 4, 2.0, 0, 8), ...seq('electrode', 4, 1.5, 0, 14) ],
  /* W13 */ [ ...seq('scyther', 3, 2.0, 0), ...seq('weezing', 5, 1.5, 0, 5), ...seq('onix', 3, 2.0, 0, 10), ...seq('gyarados', 1, 0, 0, 18) ],
  /* W14 */ [ ...seq('weezing', 6, 1.2, 0), ...seq('scyther', 5, 1.8, 0, 6), ...seq('golbat', 6, 0.8, 0, 14), ...seq('haunter', 5, 1.2, 0, 18) ],
  /* W15 */ [ ...seq('scyther', 5, 1.5, 0), ...seq('weezing', 5, 1.5, 0, 6), ...seq('phantump', 4, 2.0, 0, 10), ...seq('onix', 3, 2.0, 0, 16), ...seq('gyarados', 1, 0, 0, 24) ],

  /* W16 - 루기아 준보스 */ [
    ...seq('golbat', 8, 0.8, 0), ...seq('gastly', 8, 0.8, 0, 5), ...seq('dragonite', 1, 0, 0, 12),
    { type: 'lugia', delay: 18 },
  ],

  /* W17 */ [ ...seq('abo', 5, 0.8, 0), ...seq('scyther', 4, 1.5, 0, 3), ...seq('weezing', 4, 1.5, 0, 8), ...seq('dragonite', 2, 3.0, 0, 12), ...seq('gyarados', 2, 4.0, 0, 16) ],
  /* W18 */ [ ...seq('gastly', 6, 0.8, 0), ...seq('phantump', 5, 1.5, 0, 4), ...seq('lapras', 6, 1.0, 0, 10), ...seq('onix', 4, 1.5, 0, 16), { type: 'lugia', delay: 22 } ],
  /* W19 */ [ ...seq('scyther', 6, 1.0, 0), ...seq('weezing', 6, 1.0, 0, 5), ...seq('gyarados', 3, 3.0, 0, 10), ...seq('dragonite', 2, 3.0, 0, 18), ...seq('golbat', 8, 0.6, 0, 22), { type: 'lugia', delay: 28 } ],

  /* W20 - 뮤츠 최종보스 */ [
    ...seq('gastly', 8, 0.6, 0), ...seq('scyther', 6, 1.0, 0, 4), ...seq('weezing', 6, 1.0, 0, 8),
    ...seq('dragonite', 2, 4.0, 0, 14),
    { type: 'gyarados', delay: 18 },
    { type: 'lugia', delay: 26 },
    { type: 'mewtwo', delay: 36 },
  ],
];

function seq(type, count, interval, pathIdx = 0, startDelay = 0) {
  const arr = [];
  for (let i = 0; i < count; i++) arr.push({ type, delay: startDelay + i * interval, pathIdx });
  return arr;
}

function splitForCave(wave) {
  return wave.map((item, i) => ({ ...item, pathIdx: i % 2 === 0 ? 0 : 1 }));
}

// ===== APP CONTROLLER =====
class App {
  constructor() {
    this.engine = null;
    this.currentMapId = null;
    this.spellMgr = new SpellManager();
    this.selectedHeroSkins = { pikachu: 'default', mew: 'default', togepi: 'default' };
    this.placingHero = null;

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
    this.bindButtons();
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

  buildTowerBar() {
    this.els.towerBar.innerHTML = '';
    this.els.towerBar.classList.add('tower-bar-real');

    const scroll = document.createElement('div');
    scroll.className = 'tower-bar-scroll gacha-bar';

    // 뽑기 버튼 3종
    const pulls = [
      { key:'normal',  label:'일반 뽑기',  cost:50,  color:'#9e9e9e', emoji:'🎰' },
      { key:'premium', label:'프리미엄',   cost:120, color:'#4fc3f7', emoji:'💎' },
      { key:'gamble',  label:'도박 뽑기',  cost:200, color:'#ffd60a', emoji:'🎲' },
      { key:'ten',     label:'10연 뽑기',  cost:450, color:'#ce93d8', emoji:'🌟', ten:true },
    ];

    for (const p of pulls) {
      const btn = document.createElement('button');
      btn.className = 'tower-btn gacha-btn';
      btn.dataset.pullKey = p.key;
      btn.style.borderColor = p.color + '60';
      btn.innerHTML = `
        <span class="tower-btn-emoji">${p.emoji}</span>
        <span class="tower-btn-name" style="color:${p.color}">${p.label}</span>
        <span class="tower-btn-cost">💰${p.cost}</span>
      `;
      btn.title = p.key === 'gamble' ? '에픽~레전드 확률 높음!' :
                  p.key === 'ten'    ? '10개! 에픽 1개 보장' :
                  p.key === 'premium'? '레어~에픽 위주' : '노말~레어 위주';
      btn.addEventListener('click', () => this.doPull(p.key, btn));
      scroll.appendChild(btn);
    }

    // 구분선
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;background:rgba(255,255,255,0.1);margin:4px 2px;flex-shrink:0';
    scroll.appendChild(sep);

    // 영웅 버튼들
    const heroUnlockWave = { pikachu:0, mew:5, togepi:10 };
    for (const heroId of ['pikachu', 'mew', 'togepi']) {
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
        <span class="tower-btn-cost">${unlocked ? '영웅' : `🔒W${unlockWave}`}</span>
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
        // 8번째(index 7)는 에픽 보장
        results.push(i === 7 ? window.rollTower('gamble') : window.rollTower('normal'));
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

    // 뽑기 등급 팝업
    const grade = window.GRADES[towerDef.grade];
    if (towerDef.grade !== 'normal') {
      this.showWaveAnnounce(`${towerDef.emoji} ${grade.name}! ${towerDef.name}`, grade.color);
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
    // 10연 결과 팝업 — 그 중 하나를 선택해서 슬롯에 배치
    const overlay = document.createElement('div');
    overlay.className = 'tenpull-overlay';

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.innerHTML = '🌟 10연 뽑기 결과 — 하나를 선택하세요!';
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
      card.addEventListener('click', () => {
        overlay.remove();
        // 선택된 것만 배치
        this.engine.selectedSlotIdx = slotIdx;
        this._placePulledTower(def, slotIdx);
        this.showWaveAnnounce(`${def.emoji} ${def.name} 배치!`, grade.color);

        // 미션
        if (this.missionTracker) {
          if (def.grade !== 'normal') this.missionTracker.stats.totalRareCount++;
          if (['epic','legend','unique'].includes(def.grade)) this.missionTracker.stats.totalEpicCount++;
          if (['legend','unique'].includes(def.grade)) this.missionTracker.stats.totalLegendCount++;
          if (def.grade === 'unique') this.missionTracker.stats.totalUniqueCount++;
          this.missionTracker.stats.tenPullCount++;
          this.missionTracker.check();
        }
      });
      grid.appendChild(card);
    }

    overlay.appendChild(grid);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '취소 (골드 환불 없음)';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  }

  selectHeroToPlace(heroId, btnEl) {
    if (!this.engine) return;
    if (this.engine.heroes.some(h => h.id === heroId)) {
      this.showWaveAnnounce('이미 배치된 영웅입니다', '#ff6b6b');
      return;
    }
    this.engine.selectedTowerType = null;
    this.placingHero = this.placingHero === heroId ? null : heroId;
    this._towerBarScroll.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    if (this.placingHero) btnEl.classList.add('active');
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

    this.engine = new GameEngine(this.els.canvas);
    this.engine.heroes = [];
    this.engine.spellMgr = this.spellMgr;
    this.spellMgr.cooldowns = { pokecenter: 0, masterball: 0 };

    // 미션 트래커 초기화
    this.missionTracker = new MissionTracker();
    this.missionTracker.onComplete = (mission) => this._onMissionComplete(mission);

    this.engine.onGoldChange  = g => { this.els.goldVal.textContent = g; this.refreshPullButtons(); };
    this.engine.onLivesChange = l => {
      this.els.livesVal.textContent = l;
      document.getElementById('hud-lives').style.color = l <= 5 ? '#ff4444' : '';
    };
    this.engine.onWaveChange  = (w, t) => {
      this.els.waveVal.textContent = w;
      this.els.waveTotal.textContent = t;
    };
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
      const el = document.createElement('div');
      el.className = 'wave-announce boss';
      el.innerHTML = `${boss.def.emoji} ${boss.name} 등장!<br><span style="font-size:0.7em">⚠️ 보스</span>`;
      document.getElementById('game-screen').appendChild(el);
      setTimeout(() => el.remove(), 2800);
      this.engine.triggerScreenShake(10, 0.4);
    };
    this.engine.onWaveComplete = (wave, bonus) => {
      this.els.btnWave.disabled = false;
      this.els.btnWave.textContent = wave >= this.engine.totalWaves ? '🏆 완료!' : `▶ 웨이브 ${wave + 1}`;
      this.showWaveAnnounce(`Wave ${wave} 클리어! +${bonus}g`, '#ffd60a');
      if (wave === 5)  this.showWaveAnnounce('✨ 뮤 해금!', '#f48fb1');
      if (wave === 10) this.showWaveAnnounce('✨ 토게피 해금!', '#fff9c4');
      this.buildTowerBar();
      // 미션 트래킹
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
    this.startHeroLoop();
  }

  startHeroLoop() {
    const origUpdate = this.engine.update.bind(this.engine);
    this.engine.update = () => {
      origUpdate();
      if (this.engine.state === 'wave' || this.engine.state === 'idle') {
        for (const h of this.engine.heroes) h.update(this.engine.dt, this.engine);
        this.spellMgr.update(this.engine.dt);
        this.updateSpellBarUI();
        this.updateHeroSkillBarUI();
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
        const idx = this.engine.nearestSlot(x, y, 50);
        if (idx !== null && !this.engine.towerSlots[idx].occupied) {
          const slot = this.engine.towerSlots[idx];
          const skinId = this.selectedHeroSkins[this.placingHero];
          const hero = new Hero(this.placingHero, slot.x, slot.y, skinId);
          this.engine.heroes.push(hero);
          this.placingHero = null;
          this._towerBarScroll.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
          this.buildHeroSkillBar();
          this.refreshTowerBarAffordability();
        }
        return;
      }
      origTap(x, y);
      // 빈 슬롯 선택 시 뽑기 버튼 강조
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
        const slots = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === t._gachaId).slice(0,3);
        if (slots.length < 3 || !evolveDef) return;
        // 1번 슬롯에 진화 타워, 나머지 2개 제거
        for (let i = 1; i < 3; i++) {
          this.engine.towers = this.engine.towers.filter(x => x !== slots[i].tower);
          slots[i].occupied = false; slots[i].tower = null;
        }
        const evoTower = window._createGachaTower(evolveDef, slots[0].x, slots[0].y);
        this.engine.towers = this.engine.towers.filter(x => x !== slots[0].tower);
        this.engine.towers.push(evoTower);
        slots[0].tower = evoTower;
        this.engine.selectedTower = evoTower;
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        const evoGrade = window.GRADES[evolveDef.grade];
        this.engine.spawnFloatingText(`✨ ${evolveDef.name}!`, slots[0].x, slots[0].y-40, evoGrade.color);
        this.engine.particles.push(new BurstRing(slots[0].x, slots[0].y, 70, evoGrade.color));
        this.engine.triggerScreenShake(6, 0.25);
        if (this.missionTracker) { this.missionTracker.stats.mergeCount++; this.missionTracker.check(); }
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
      hero.def.skills.forEach((skill, idx) => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.dataset.heroId = hero.id;
        btn.dataset.skillIdx = idx;
        btn.innerHTML = `<span class="skill-emoji">${skill.emoji}</span><span class="skill-cd"></span>`;
        btn.title = `${skill.name}: ${skill.desc}`;
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
      btn.innerHTML = `<span class="spell-emoji">${spell.emoji}</span><span class="spell-name">${spell.name}</span><span class="spell-cd"></span>`;
      btn.title = spell.desc;
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

      for (let row = 0; row < 3; row++) {
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
    for (const item of window.ShopItems) {
      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML = `
        <div class="shop-emoji">${item.emoji}</div>
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
        <button class="shop-buy-btn">💰${item.cost}</button>
      `;
      const buyBtn = card.querySelector('.shop-buy-btn');
      buyBtn.addEventListener('click', () => {
        if (this.engine.gold < item.cost) {
          this.showWaveAnnounce('골드가 부족합니다', '#ff6b6b');
          return;
        }
        if (item.use(this.engine)) {
          this.engine.spendGold(item.cost);
          title.textContent = `🛒 상점 (보유 골드: ${this.engine.gold}g)`;
          this.showWaveAnnounce(`${item.emoji} ${item.name} 사용!`, '#06d6a0');
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
      return {
        x: (t.clientX - rect.left) * (canvas.width / rect.width),
        y: (t.clientY - rect.top)  * (canvas.height / rect.height),
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
      this.engine.buildTowerSlots();
    });
  }

  sendWave() {
    const e = this.engine;
    if (!e || e.state !== 'idle') return;
    const waveIdx = e.currentWave;
    if (waveIdx >= WaveData.length) return;

    let wave = WaveData[waveIdx];
    if (this.currentMapId === 'cave') wave = splitForCave(wave);

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

    if (e.startWave(wave)) {
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
