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
    this.buildTowerBar();
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
  }

  buildTowerBar() {
    this.els.towerBar.innerHTML = '';
    this.els.towerBar.classList.add('tower-bar-real');

    const scroll = document.createElement('div');
    scroll.className = 'tower-bar-scroll';

    for (const meta of window.TowerMeta) {
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.dataset.towerKey = meta.key;
      btn.innerHTML = `
        <span class="tower-btn-emoji">${meta.emoji}</span>
        <span class="tower-btn-name">${meta.name}</span>
        <span class="tower-btn-cost">💰${meta.cost}</span>
      `;
      btn.title = meta.desc;
      btn.addEventListener('click', () => this.selectTowerType(meta.key, btn));
      scroll.appendChild(btn);
    }

    for (const heroId of ['pikachu', 'mew', 'togepi']) {
      const def = window.HeroDefs[heroId];
      const btn = document.createElement('button');
      btn.className = 'tower-btn hero-btn';
      btn.dataset.heroKey = heroId;
      const skinId = this.selectedHeroSkins[heroId];
      const skin = window.SkinDefs[heroId][skinId];
      btn.innerHTML = `
        <span class="tower-btn-emoji">${skin.emoji}</span>
        <span class="tower-btn-name">${def.name}</span>
        <span class="tower-btn-cost">영웅</span>
      `;
      btn.title = def.passive;
      btn.addEventListener('click', () => this.selectHeroToPlace(heroId, btn));
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openSkinPicker(heroId); });
      let pressTimer;
      btn.addEventListener('touchstart', () => { pressTimer = setTimeout(() => this.openSkinPicker(heroId), 500); });
      btn.addEventListener('touchend', () => clearTimeout(pressTimer));
      scroll.appendChild(btn);
    }

    this.els.towerBar.appendChild(scroll);
    this._towerBarScroll = scroll;
  }

  refreshTowerBarAffordability() {
    if (!this.engine || !this._towerBarScroll) return;
    const gold = this.engine.gold;
    this._towerBarScroll.querySelectorAll('.tower-btn').forEach(btn => {
      const key = btn.dataset.towerKey;
      if (key) {
        const meta = window.TowerMeta.find(m => m.key === key);
        btn.disabled = gold < meta.cost;
      } else if (btn.dataset.heroKey) {
        const placed = this.engine.heroes.some(h => h.id === btn.dataset.heroKey);
        btn.disabled = placed;
      }
    });
  }

  selectTowerType(key, btnEl) {
    if (!this.engine) return;
    this.placingHero = null;
    this.engine.selectedTowerType = this.engine.selectedTowerType === key ? null : key;
    this.engine.selectedTower = null;
    this._towerBarScroll.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    if (this.engine.selectedTowerType) btnEl.classList.add('active');
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

    this.engine.onGoldChange  = g => { this.els.goldVal.textContent = g; this.refreshTowerBarAffordability(); };
    this.engine.onLivesChange = l => {
      this.els.livesVal.textContent = l;
      document.getElementById('hud-lives').style.color = l <= 5 ? '#ff4444' : '';
    };
    this.engine.onWaveChange  = (w, t) => {
      this.els.waveVal.textContent = w;
      this.els.waveTotal.textContent = t;
    };
    this.engine.onWaveComplete = (wave, bonus) => {
      this.els.btnWave.disabled = false;
      this.els.btnWave.textContent = wave >= this.engine.totalWaves ? '🏆 완료!' : `▶ 웨이브 ${wave + 1}`;
      this.showWaveAnnounce(`Wave ${wave} 클리어! +${bonus}g`, '#ffd60a');
      if (wave % 5 === 0 && wave < this.engine.totalWaves) {
        setTimeout(() => this.openShop(), 600);
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
        const slot = this.engine.towerSlots[slotIdx];
        window.applyOrbBonuses(slot.tower, this.engine);
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
      this.syncTowerPanel();
    };
  }

  // ===== 타워 업그레이드/판매 패널 =====
  syncTowerPanel() {
    let panel = document.getElementById('tower-panel');
    if (this.engine.selectedTower) {
      const t = this.engine.selectedTower;
      const slotIdx = this.engine.towerSlots.findIndex(s => s.tower === t);
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tower-panel';
        document.getElementById('game-screen').appendChild(panel);
      }
      const upgCost = t.upgradeCost();
      panel.innerHTML = `
        <div class="tower-panel-name">${t.def.evolutions[t.level - 1]} ${t.name}</div>
        <div class="tower-panel-stats">⚔️ ${Math.round(t.damage)}  ·  📏 ${Math.round(t.range)}  ·  ⏱️ ${t.fireRate.toFixed(1)}/s</div>
        <div class="tower-panel-btns">
          ${upgCost !== null ? `<button class="tp-btn tp-upgrade">⬆ 강화 (💰${upgCost})</button>` : `<button class="tp-btn tp-maxed" disabled>MAX</button>`}
          <button class="tp-btn tp-sell">💸 판매 (+${Math.floor(t.totalSpent * 0.7)}g)</button>
        </div>
      `;
      panel.querySelector('.tp-upgrade')?.addEventListener('click', () => {
        if (t.upgrade(this.engine)) this.syncTowerPanel();
      });
      panel.querySelector('.tp-sell').addEventListener('click', () => {
        this.engine.sellTower(slotIdx);
        this.engine.selectedTower = null;
        this.engine.selectedSlotIdx = null;
        panel.remove();
      });
      panel.style.display = 'flex';
    } else if (panel) {
      panel.remove();
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
      label.textContent = `${hero.skin.emoji} ${hero.name}`;
      wrap.appendChild(label);
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

    if (e.startWave(wave)) {
      this.els.btnWave.disabled = true;
      this.els.btnWave.textContent = '⏳ 진행 중...';
      this.showWaveAnnounce(`Wave ${e.currentWave}`, '#ffd60a');
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
    this.els.gameScreen.classList.remove('active');
    this.els.mapSelect.classList.add('active');

    const ctx = this.els.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.els.canvas.width, this.els.canvas.height);

    document.querySelectorAll('.end-overlay').forEach(el => el.remove());
    document.querySelectorAll('.wave-announce').forEach(el => el.remove());
    document.querySelectorAll('.shop-overlay').forEach(el => el.remove());
    document.querySelectorAll('.skin-picker').forEach(el => el.remove());

    const skillBar = document.getElementById('hero-skill-bar');
    if (skillBar) skillBar.innerHTML = '';
    const spellBar = document.getElementById('spell-bar');
    if (spellBar) spellBar.innerHTML = '';
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.app = new App();
});
