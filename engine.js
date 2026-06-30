// ===== ENGINE.JS - 코어 게임 엔진 =====

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.running = false;
    this.lastTime = 0;
    this.dt = 0;

    // 게임 상태
    this.state = 'idle'; // idle | wave | paused | gameover | victory
    this.gold = 200;
    this.lives = 20;
    this.currentWave = 0;
    this.totalWaves = 20;

    // 엔티티
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.particles = [];
    this.towerSlots = [];

    // 현재 맵
    this.currentMap = null;
    this.paths = [];        // 맵에 따라 1개 또는 2개 경로

    // UI 콜백
    this.onGoldChange = null;
    this.onLivesChange = null;
    this.onWaveChange = null;
    this.onStateChange = null;
    this.onWaveComplete = null;
    this.onGameOver = null;
    this.onVictory = null;

    // 웨이브 스포너
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.activeSpawns = 0;

    // 선택 상태
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.selectedSlotIdx = null;
  }

  // ===== INIT =====
  init(mapId) {
    this.resize();
    this.currentMap = MapDefs[mapId];
    this.buildPaths();
    this.buildTowerSlots();
    this.start();
  }

  resize() {
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  buildPaths() {
    const w = this.width, h = this.height;
    this.paths = this.currentMap.getPaths(w, h);
  }

  buildTowerSlots() {
    const w = this.width, h = this.height;
    this.towerSlots = this.currentMap.getSlots(w, h).map(pos => ({
      x: pos.x, y: pos.y,
      occupied: false,
      tower: null
    }));
  }

  // ===== LOOP =====
  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  stop() { this.running = false; }

  loop(timestamp) {
    if (!this.running) return;
    this.dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;
    this.update();
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  }

  // ===== UPDATE =====
  update() {
    if (this.state !== 'wave' && this.state !== 'idle') return;

    // 스폰
    if (this.state === 'wave') {
      this.updateSpawn();
    }

    // 적 이동
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(this.dt);
      if (e.reachedEnd) {
        this.enemies.splice(i, 1);
        this.loseLife(1);
      } else if (e.dead) {
        this.collectReward(e);
        this.enemies.splice(i, 1);
      }
    }

    // 타워 공격
    for (const t of this.towers) {
      t.update(this.dt, this.enemies, this);
    }

    // 발사체
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(this.dt);
      if (this.projectiles[i].done) this.projectiles.splice(i, 1);
    }

    // 파티클
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(this.dt);
      if (this.particles[i].dead) this.particles.splice(i, 1);
    }

    // 웨이브 클리어 체크
    if (this.state === 'wave' && this.spawnQueue.length === 0 && this.activeSpawns <= 0 && this.enemies.length === 0) {
      this.waveCleared();
    }
  }

  // ===== SPAWN =====
  startWave(waveData) {
    if (this.state !== 'idle') return false;
    this.currentWave++;
    this.state = 'wave';
    this.spawnQueue = [...waveData];
    this.spawnTimer = 0;
    this.activeSpawns = waveData.length;
    this.onWaveChange && this.onWaveChange(this.currentWave, this.totalWaves);
    this.onStateChange && this.onStateChange('wave');
    return true;
  }

  updateSpawn() {
    this.spawnTimer += this.dt;
    while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnQueue[0].delay) {
      const item = this.spawnQueue.shift();
      this.spawnEnemy(item);
    }
  }

  spawnEnemy(item) {
    // cave 맵은 2갈래 경로
    const pathIdx = item.pathIdx !== undefined ? item.pathIdx : 0;
    const path = this.paths[pathIdx] || this.paths[0];
    const enemy = new Enemy(item.type, path, this);
    this.enemies.push(enemy);
  }

  // ===== WAVE CLEAR =====
  waveCleared() {
    this.state = 'idle';
    const bonus = 30 + this.currentWave * 10;
    this.addGold(bonus);
    this.onWaveComplete && this.onWaveComplete(this.currentWave, bonus);
    if (this.currentWave >= this.totalWaves) {
      this.triggerVictory();
    } else {
      this.onStateChange && this.onStateChange('idle');
    }
  }

  // ===== GOLD / LIVES =====
  addGold(amount) {
    this.gold += amount;
    this.onGoldChange && this.onGoldChange(this.gold);
  }

  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.onGoldChange && this.onGoldChange(this.gold);
    return true;
  }

  collectReward(enemy) {
    this.addGold(enemy.reward);
    this.spawnFloatingText(`+${enemy.reward}g`, enemy.x, enemy.y, '#ffd60a');
  }

  loseLife(n = 1) {
    this.lives = Math.max(0, this.lives - n);
    this.onLivesChange && this.onLivesChange(this.lives);
    this.spawnRedFlash();
    if (this.lives <= 0) this.triggerGameOver();
  }

  // ===== END =====
  triggerGameOver() {
    this.state = 'gameover';
    this.onGameOver && this.onGameOver(this.lives);
    this.onStateChange && this.onStateChange('gameover');
  }

  triggerVictory() {
    this.state = 'victory';
    const stars = this.lives >= 15 ? 3 : this.lives >= 8 ? 2 : 1;
    this.onVictory && this.onVictory(stars);
    this.onStateChange && this.onStateChange('victory');
  }

  // ===== TOWER PLACEMENT =====
  placeTower(TowerClass, slotIdx) {
    const slot = this.towerSlots[slotIdx];
    if (!slot || slot.occupied) return false;
    const t = new TowerClass(slot.x, slot.y);
    if (!this.spendGold(t.cost)) return false;
    slot.occupied = true;
    slot.tower = t;
    this.towers.push(t);
    this.spawnFloatingText(t.name, slot.x, slot.y - 24, '#ffffff');
    return true;
  }

  sellTower(slotIdx) {
    const slot = this.towerSlots[slotIdx];
    if (!slot || !slot.occupied) return;
    const t = slot.tower;
    const refund = Math.floor(t.totalSpent * 0.7);
    this.addGold(refund);
    this.towers = this.towers.filter(x => x !== t);
    slot.occupied = false;
    slot.tower = null;
    this.spawnFloatingText(`+${refund}g`, slot.x, slot.y, '#06d6a0');
  }

  // ===== PARTICLES / FX =====
  spawnFloatingText(text, x, y, color) {
    this.particles.push(new FloatingText(text, x, y, color));
  }

  spawnRedFlash() {
    this.particles.push(new RedFlash(this.width, this.height));
  }

  spawnHitParticle(x, y, color) {
    for (let i = 0; i < 5; i++) {
      this.particles.push(new Spark(x, y, color));
    }
  }

  // ===== DRAW =====
  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 맵 배경
    this.drawMap(ctx);

    // 경로
    this.drawPaths(ctx);

    // 타워 슬롯
    this.drawSlots(ctx);

    // 타워
    for (const t of this.towers) t.draw(ctx);

    // 적
    for (const e of this.enemies) e.draw(ctx);

    // 발사체
    for (const p of this.projectiles) p.draw(ctx);

    // 파티클
    for (const p of this.particles) p.draw(ctx);

    // 선택 범위 표시
    if (this.selectedTower) {
      this.drawRange(ctx, this.selectedTower);
    }
    if (this.selectedSlotIdx !== null && this.selectedTowerType) {
      // 배치 전 미리보기
      this.drawPlacementPreview(ctx);
    }
  }

  drawMap(ctx) {
    const map = this.currentMap;
    ctx.fillStyle = map.bgColor;
    ctx.fillRect(0, 0, this.width, this.height);

    // 맵별 패턴/데코
    if (map.drawBg) map.drawBg(ctx, this.width, this.height);
  }

  drawPaths(ctx) {
    for (const path of this.paths) {
      // 경로 그림자
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 38;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();

      // 경로 본체
      ctx.save();
      ctx.strokeStyle = this.currentMap.pathColor;
      ctx.lineWidth = 32;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.restore();

      // 경로 테두리 (밝은 선)
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 32;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([60, 40]);
      ctx.lineDashOffset = -performance.now() * 0.02;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  drawSlots(ctx) {
    for (let i = 0; i < this.towerSlots.length; i++) {
      const s = this.towerSlots[i];
      if (s.occupied) continue;

      const isHighlighted = this.selectedTowerType !== null;
      const isHovered = this.selectedSlotIdx === i;

      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 20, 0, Math.PI * 2);

      if (isHovered) {
        ctx.fillStyle = 'rgba(76,201,240,0.25)';
        ctx.strokeStyle = '#4cc9f0';
        ctx.lineWidth = 2;
      } else if (isHighlighted) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // + 아이콘
      if (isHighlighted) {
        ctx.save();
        ctx.strokeStyle = isHovered ? '#4cc9f0' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x - 7, s.y); ctx.lineTo(s.x + 7, s.y);
        ctx.moveTo(s.x, s.y - 7); ctx.lineTo(s.x, s.y + 7);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawRange(ctx, tower) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,214,10,0.5)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(255,214,10,0.05)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawPlacementPreview(ctx) {
    if (this.selectedSlotIdx === null) return;
    const slot = this.towerSlots[this.selectedSlotIdx];
    const TClass = window.TowerRegistry && window.TowerRegistry[this.selectedTowerType];
    if (!TClass) return;
    const range = new TClass(0, 0).range;
    ctx.save();
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, range, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(76,201,240,0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(76,201,240,0.06)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ===== INPUT =====
  handleTap(x, y) {
    // 슬롯 탭
    const slotIdx = this.nearestSlot(x, y, 36);
    if (slotIdx !== null) {
      if (this.towerSlots[slotIdx].occupied) {
        this.selectedTower = this.towerSlots[slotIdx].tower;
        this.selectedSlotIdx = slotIdx;
        this.selectedTowerType = null;
      } else if (this.selectedTowerType) {
        const TClass = window.TowerRegistry && window.TowerRegistry[this.selectedTowerType];
        if (TClass) {
          this.placeTower(TClass, slotIdx);
        }
        this.selectedSlotIdx = null;
      } else {
        this.selectedSlotIdx = slotIdx;
        this.selectedTower = null;
      }
      return;
    }
    // 빈 곳 탭 → 해제
    this.selectedTower = null;
    this.selectedSlotIdx = null;
  }

  handleHover(x, y) {
    if (!this.selectedTowerType) return;
    const idx = this.nearestSlot(x, y, 50);
    this.selectedSlotIdx = idx;
  }

  nearestSlot(x, y, radius) {
    let best = null, bestDist = radius;
    for (let i = 0; i < this.towerSlots.length; i++) {
      const s = this.towerSlots[i];
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }
}

// ===== FLOATING TEXT PARTICLE =====
class FloatingText {
  constructor(text, x, y, color) {
    this.text = text; this.x = x; this.y = y;
    this.color = color; this.alpha = 1;
    this.vy = -60; this.life = 0; this.maxLife = 0.9;
    this.dead = false;
  }
  update(dt) {
    this.life += dt;
    this.y += this.vy * dt;
    this.vy *= 0.95;
    this.alpha = 1 - this.life / this.maxLife;
    if (this.life >= this.maxLife) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// ===== RED FLASH =====
class RedFlash {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.alpha = 0.35; this.life = 0; this.maxLife = 0.4;
    this.dead = false;
  }
  update(dt) {
    this.life += dt;
    this.alpha = 0.35 * (1 - this.life / this.maxLife);
    if (this.life >= this.maxLife) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = '#e63946';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }
}

// ===== SPARK PARTICLE =====
class Spark {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 80;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.r = 3 + Math.random() * 3;
    this.alpha = 1; this.life = 0; this.maxLife = 0.3 + Math.random() * 0.2;
    this.dead = false;
  }
  update(dt) {
    this.life += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;
    this.alpha = 1 - this.life / this.maxLife;
    if (this.life >= this.maxLife) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
