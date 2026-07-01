// ===== ENGINE.JS - 완전 재설계 v3 =====

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0; this.height = 0;
    this.running = false; this.lastTime = 0; this.dt = 0;

    // 상태
    this.state = 'idle';
    this.gold = 150;
    this.lives = 20;
    this.currentWave = 0;
    this.totalWaves = 20;
    this.speedMul = 1;

    // 엔티티
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.particles = [];
    this.towerSlots = [];
    this.heroes = [];

    // 맵
    this.currentMap = null;
    this.paths = [];

    // 스폰
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.activeSpawns = 0;

    // 선택
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.selectedSlotIdx = null;

    // FX
    this.shakeTimer = 0;
    this.shakeAmt = 0;

    // 콤보 시스템
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMaxTime = 3.0;
    this.comboMul = 1;

    // 보스 트래킹
    this.activeBoss = null;

    // 배치 포인트 (Arknights DP)
    this.deployPoints = 8;
    this.maxDeployPoints = 12;
    this.deployRegenRate = 0.5; // 초당 회복

    // 골드 보너스
    this._globalGoldMul = 1;

    // 콜백
    this.onGoldChange = null;
    this.onLivesChange = null;
    this.onWaveChange = null;
    this.onStateChange = null;
    this.onWaveComplete = null;
    this.onGameOver = null;
    this.onVictory = null;
    this.onComboChange = null;
    this.onBossAppear = null;

    // 캐시
    this._bgCanvas = null;
    this._bgDirty = true;
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
  }

  init(mapId) {
    this.resize();
    this.currentMap = MapDefs[mapId];
    this.buildPaths();
    this.buildTowerSlots();
    this._bgDirty = true;
    this.start();
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w; this.height = h;
    this._bgDirty = true;
  }

  buildPaths() {
    const HUD = 52, BAR = 82, PAD = 14;
    const safeTop = HUD + PAD;
    const safeBot = this.height - BAR - PAD;
    const safeH = safeBot - safeTop;

    const rawPaths = this.currentMap.getPaths(this.width, this.height);
    this.paths = rawPaths.map(path =>
      path.map(pt => ({
        x: pt.x,
        y: safeTop + (pt.y / this.height) * safeH,
      }))
    );
  }
  buildTowerSlots() {
    const HUD = 52, BAR = 82, PAD = 14;
    const safeTop = HUD + PAD;
    const safeBot = this.height - BAR - PAD;
    const safeH = safeBot - safeTop;

    this.towerSlots = this.currentMap.getSlots(this.width, this.height).map(p => {
      // 슬롯 y를 safe zone(HUD아래~타워바위)으로 리매핑
      const ratio = p.y / this.height;
      const safeY = safeTop + ratio * safeH;
      return { x: p.x, y: safeY, occupied: false, tower: null };
    });
  }

  start() { this.running = true; this.lastTime = performance.now(); requestAnimationFrame(t=>this.loop(t)); }
  stop() { this.running = false; }

  loop(ts) {
    if (!this.running) return;
    const raw = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.dt = raw * this.speedMul;
    this.update();
    this.draw();
    requestAnimationFrame(t=>this.loop(t));
  }

  update() {
    if (this.state !== 'wave' && this.state !== 'idle') return;

    if (this.state === 'wave') {
      this.updateSpawn();
      // DP 재생
      this.deployPoints = Math.min(this.maxDeployPoints, this.deployPoints + this.deployRegenRate * this.dt);
    }

    // 콤보 타이머
    if (this.comboCount > 0) {
      this.comboTimer -= this.dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMul = 1;
        this.onComboChange && this.onComboChange(0, 1);
      }
    }

    // 적 이동
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(this.dt);
      if (e.reachedEnd) { this.enemies.splice(i,1); this.loseLife(1); }
      else if (e.dead) { this._onEnemyDie(e); this.enemies.splice(i,1); }
    }

    // 보스 트래킹
    this.activeBoss = this.enemies.find(e => e.isBoss && !e.dead && !e.reachedEnd) || null;

    // 타워
    for (const t of this.towers) t.update(this.dt, this.enemies, this);
    // 영웅
    for (const h of this.heroes) h.update(this.dt, this);
    // 발사체
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(this.dt);
      if (this.projectiles[i].done) this.projectiles.splice(i,1);
    }
    // 파티클 캡
    if (this.particles.length > 150) this.particles.splice(0, this.particles.length - 150);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(this.dt);
      if (this.particles[i].dead) this.particles.splice(i,1);
    }

    // 웨이브 클리어
    if (this.state === 'wave' && this.spawnQueue.length === 0 && this.activeSpawns <= 0 && this.enemies.length === 0) {
      this.waveCleared();
    }

    if (this.shakeTimer > 0) this.shakeTimer -= this.dt;
  }

  _onEnemyDie(enemy) {
    const baseReward = enemy.reward;
    const bonus = Math.floor(baseReward * (this._globalGoldMul - 1));
    this.addGold(baseReward + bonus);
    this.spawnFloatingText(`+${baseReward + bonus}g`, enemy.x, enemy.y - 10, '#ffd60a');

    // 콤보 시스템
    this.comboCount++;
    this.comboTimer = this.comboMaxTime;
    this.comboMul = Math.min(3.0, 1 + (this.comboCount - 1) * 0.1);
    this.onComboChange && this.onComboChange(this.comboCount, this.comboMul);

    if (this.comboCount >= 5) {
      this.particles.push(new ComboFlash(enemy.x, enemy.y, this.comboCount));
    }

    // 영웅 경험치
    for (const h of this.heroes) {
      h.gainExp(enemy.reward * 0.5, this);
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
      this._spawnEnemy(item);
    }
  }

  _spawnEnemy(item) {
    const pathIdx = item.pathIdx !== undefined ? item.pathIdx : 0;
    const path = this.paths[pathIdx] || this.paths[0];
    const enemy = new Enemy(item.type, path, this);

    // 엘리트 변형 (10% 확률)
    if (!enemy.isBoss && Math.random() < 0.10) {
      enemy._elite = Math.random() < 0.15 ? 'gold' : 'silver';
      const mul = enemy._elite === 'gold' ? 2.2 : 1.5;
      enemy.maxHp = Math.floor(enemy.maxHp * mul);
      enemy.hp = enemy.maxHp;
      enemy.speed *= (enemy._elite === 'gold' ? 1.3 : 1.15);
      enemy.reward = Math.floor(enemy.reward * (enemy._elite === 'gold' ? 2.5 : 1.8));
    }

    this.enemies.push(enemy);
    this.activeSpawns--;
    if (enemy.isBoss) this.onBossAppear && this.onBossAppear(enemy);
  }

  waveCleared() {
    this.state = 'idle';
    const bonus = 20 + this.currentWave * 7;
    this.addGold(bonus);
    this.onWaveComplete && this.onWaveComplete(this.currentWave, bonus);
    if (this.currentWave >= this.totalWaves) this.triggerVictory();
    else this.onStateChange && this.onStateChange('idle');
  }

  // ===== GOLD / LIVES =====
  addGold(n) { this.gold += n; this.onGoldChange && this.onGoldChange(this.gold); }
  spendGold(n) { if (this.gold < n) return false; this.gold -= n; this.onGoldChange && this.onGoldChange(this.gold); return true; }
  loseLife(n=1) {
    this.lives = Math.max(0, this.lives - n);
    this.onLivesChange && this.onLivesChange(this.lives);
    this.shakeTimer = 0.35; this.shakeAmt = 7;
    this.particles.push(new RedFlash(this.width, this.height));
    if (this.lives <= 0) this.triggerGameOver();
  }
  triggerGameOver() {
    this.state = 'gameover';
    this.onGameOver && this.onGameOver();
  }
  triggerVictory() {
    this.state = 'victory';
    const stars = this.lives >= 15 ? 3 : this.lives >= 8 ? 2 : 1;
    this.onVictory && this.onVictory(stars);
  }

  // ===== TOWER =====
  placeTower(TowerClass, slotIdx) {
    const slot = this.towerSlots[slotIdx];
    if (!slot || slot.occupied) return false;
    const t = new TowerClass(slot.x, slot.y);
    if (!this.spendGold(t.cost)) return false;
    slot.occupied = true; slot.tower = t;
    this.towers.push(t);
    if (window.applyTowerSynergies) window.applyTowerSynergies(this.towers);
    this.spawnHitParticle(slot.x, slot.y, '#4cc9f0');
    return true;
  }
  sellTower(slotIdx) {
    const slot = this.towerSlots[slotIdx];
    if (!slot || !slot.occupied) return;
    const t = slot.tower;
    const refund = Math.floor(t.totalSpent * 0.7);
    this.addGold(refund);
    this.spawnFloatingText(`+${refund}g`, slot.x, slot.y, '#06d6a0');
    this.towers = this.towers.filter(x=>x!==t);
    slot.occupied = false; slot.tower = null;
    if (window.applyTowerSynergies) window.applyTowerSynergies(this.towers);
  }

  // ===== FX =====
  spawnFloatingText(text, x, y, color, opts={}) { this.particles.push(new FloatingText(text,x,y,color,opts)); }
  spawnHitParticle(x, y, color) { for (let i=0;i<6;i++) this.particles.push(new Spark(x,y,color)); }
  triggerScreenShake(amt=5, dur=0.2) { this.shakeAmt=amt; this.shakeTimer=dur; }

  // ===== DRAW =====
  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shakeTimer > 0) {
      const s = (this.shakeTimer/0.35)*this.shakeAmt;
      ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
    }
    ctx.clearRect(-20,-20,this.width+40,this.height+40);

    this._drawBgCached(ctx);
    this.drawPaths(ctx);
    this.drawSlots(ctx);

    for (const t of this.towers) t.draw(ctx);
    for (const h of this.heroes) h.draw(ctx);

    // Y순 정렬
    const sorted = [...this.enemies].sort((a,b)=>a.y-b.y);
    for (const e of sorted) e.draw(ctx);

    for (const p of this.projectiles) p.draw(ctx);
    for (const p of this.particles) p.draw(ctx);

    if (this.selectedTower) this._drawRange(ctx, this.selectedTower);
    if (this.selectedSlotIdx !== null && this.selectedTowerType) this._drawPreview(ctx);

    // 보스 HP바
    if (this.activeBoss) this._drawBossBar(ctx);

    ctx.restore();
  }

  _drawBgCached(ctx) {
    if (this._bgDirty || !this._bgCanvas ||
        this._bgCanvas.width !== this.width || this._bgCanvas.height !== this.height) {
      const bc = document.createElement('canvas');
      bc.width = this.width; bc.height = this.height;
      const bctx = bc.getContext('2d');
      const map = this.currentMap;

      // 배경 이미지 있으면 사용, 없으면 단색
      if (map.bgImage) {
        if (!this._bgImg || this._bgImg._src !== map.bgImage) {
          const im = new Image();
          im._src = map.bgImage;
          im.src = map.bgImage;
          this._bgImg = im;
        }
        if (this._bgImg.complete && this._bgImg.naturalWidth > 0) {
          // 커버 방식으로 그리기
          const ir = this._bgImg.naturalWidth / this._bgImg.naturalHeight;
          const cr = this.width / this.height;
          let sx=0,sy=0,sw=this._bgImg.naturalWidth,sh=this._bgImg.naturalHeight;
          if (ir > cr) { sw = sh*cr; sx=(this._bgImg.naturalWidth-sw)/2; }
          else { sh=sw/cr; sy=(this._bgImg.naturalHeight-sh)/2; }
          bctx.drawImage(this._bgImg, sx,sy,sw,sh, 0,0,this.width,this.height);
          // 어두운 오버레이로 게임과 어우러지게
          bctx.fillStyle='rgba(0,0,0,0.22)';
          bctx.fillRect(0,0,this.width,this.height);
        } else {
          // 로드 전: 단색 폴백, 로드 완료 후 캐시 무효화
          bctx.fillStyle = map.bgColor;
          bctx.fillRect(0,0,this.width,this.height);
          this._bgImg.onload = () => { this._bgDirty = true; };
        }
      } else {
        bctx.fillStyle = map.bgColor;
        bctx.fillRect(0,0,this.width,this.height);
      }

      // 맵별 이모지/장식 오버레이
      if (map.drawBg) map.drawBg(bctx, this.width, this.height);
      this._bgCanvas = bc; this._bgDirty = false;
    }
    ctx.drawImage(this._bgCanvas, 0, 0);
  }

  drawPaths(ctx) {
    for (const path of this.paths) {
      const map = this.currentMap;
      const pw = map.pathWidth || 34;

      // 외곽 그림자
      ctx.save(); ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=pw+12;
      ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
      ctx.stroke(); ctx.restore();

      // 경로 어두운 테두리
      ctx.save(); ctx.strokeStyle=map.pathColorDark||map.pathColor;
      ctx.lineWidth=pw+6; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
      ctx.stroke(); ctx.restore();

      // 경로 본체
      ctx.save(); ctx.strokeStyle=map.pathColor;
      ctx.lineWidth=pw; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
      ctx.stroke(); ctx.restore();

      // 하이라이트 (밝은 중앙선)
      ctx.save(); ctx.strokeStyle=map.pathHighlight||'rgba(255,255,255,0.10)';
      ctx.lineWidth=pw*0.32; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
      for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
      ctx.stroke(); ctx.restore();

      // 방향 화살표
      this._drawArrows(ctx, path, map);
    }
  }

  _drawArrows(ctx, path, map) {
    const interval = 85;
    let acc = 0;
    for (let i=0; i<path.length-1; i++) {
      const dx=path[i+1].x-path[i].x, dy=path[i+1].y-path[i].y;
      const len=Math.hypot(dx,dy);
      const ux=dx/len, uy=dy/len;
      let d = interval - (acc%interval);
      while (d <= len) {
        const ax=path[i].x+ux*d, ay=path[i].y+uy*d;
        ctx.save(); ctx.translate(ax,ay); ctx.rotate(Math.atan2(dy,dx));
        ctx.beginPath();
        ctx.moveTo(-7,-4.5); ctx.lineTo(5,0); ctx.lineTo(-7,4.5);
        ctx.strokeStyle=map.pathArrow||'rgba(255,220,120,0.25)';
        ctx.lineWidth=1.8; ctx.lineJoin='round'; ctx.stroke();
        ctx.restore();
        d += interval;
      }
      acc += len;
    }
  }

  drawSlots(ctx) {
    for (let i=0; i<this.towerSlots.length; i++) {
      const s = this.towerSlots[i];
      if (s.occupied) continue;
      const isHL = this.selectedTowerType !== null;
      const isHov = this.selectedSlotIdx === i;

      ctx.save();
      // 바닥 그림자
      ctx.beginPath(); ctx.arc(s.x, s.y+3, 22, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();

      ctx.beginPath(); ctx.arc(s.x, s.y, 21, 0, Math.PI*2);
      if (isHov) {
        const g=ctx.createRadialGradient(s.x,s.y-3,2,s.x,s.y,21);
        g.addColorStop(0,'rgba(76,201,240,0.6)'); g.addColorStop(1,'rgba(76,201,240,0.1)');
        ctx.fillStyle=g; ctx.strokeStyle='#4cc9f0'; ctx.lineWidth=2.5;
        ctx.shadowColor='#4cc9f0'; ctx.shadowBlur=16;
      } else if (isHL) {
        ctx.fillStyle='rgba(255,255,255,0.14)'; ctx.strokeStyle='rgba(255,255,255,0.65)'; ctx.lineWidth=1.5;
      } else {
        ctx.fillStyle='rgba(70,50,30,0.40)'; ctx.strokeStyle='rgba(180,130,60,0.50)'; ctx.lineWidth=1.5;
      }
      ctx.fill(); ctx.stroke();

      // + 아이콘
      ctx.shadowBlur=0;
      ctx.strokeStyle=isHov?'#4cc9f0':(isHL?'rgba(255,255,255,0.8)':'rgba(200,160,80,0.55)');
      ctx.lineWidth=isHov?2.5:1.5; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(s.x-9,s.y); ctx.lineTo(s.x+9,s.y);
      ctx.moveTo(s.x,s.y-9); ctx.lineTo(s.x,s.y+9);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawRange(ctx, tower) {
    ctx.save();
    ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI*2);
    ctx.strokeStyle='rgba(255,214,10,0.65)'; ctx.lineWidth=2;
    ctx.fillStyle='rgba(255,214,10,0.07)';
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  _drawPreview(ctx) {
    if (this.selectedSlotIdx === null) return;
    const slot = this.towerSlots[this.selectedSlotIdx];
    const TClass = window.TowerRegistry && window.TowerRegistry[this.selectedTowerType];
    if (!TClass) return;
    const range = new TClass(0,0).range;
    ctx.save();
    ctx.beginPath(); ctx.arc(slot.x, slot.y, range, 0, Math.PI*2);
    ctx.strokeStyle='rgba(76,201,240,0.55)'; ctx.lineWidth=2;
    ctx.fillStyle='rgba(76,201,240,0.08)';
    ctx.fill(); ctx.stroke(); ctx.restore();
  }

  _drawBossBar(ctx) {
    const boss = this.activeBoss;
    if (!boss || boss.dead) return;
    const W = this.width;
    const bw = Math.min(W * 0.5, 400);
    const bx = (W - bw) / 2;
    const by = 60; // HUD 아래
    const bh = 14;
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const isRage = ratio < 0.5;

    ctx.save();

    // 배경 패널
    ctx.fillStyle='rgba(0,0,0,0.75)';
    this._roundRect(ctx, bx-2, by-18, bw+4, bh+24, 8);
    ctx.fill();

    // 이름 + 이모지
    ctx.font='bold 11px -apple-system,sans-serif';
    ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=4;
    ctx.fillText(`${boss.def.emoji} ${boss.name}`, bx+bw/2, by-4);

    // HP 바 배경
    ctx.fillStyle='rgba(40,20,20,0.8)';
    this._roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();

    // HP 바
    const barColor = isRage
      ? `hsl(${10 + Math.sin(Date.now()*0.01)*10}, 90%, 55%)`
      : `hsl(${ratio * 110}, 80%, 50%)`;
    ctx.fillStyle=barColor;
    if (isRage) { ctx.shadowColor='#ff4444'; ctx.shadowBlur=10; }
    this._roundRect(ctx, bx, by, bw*ratio, bh, 4);
    ctx.fill();

    // 50% 분노선
    ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bx+bw*0.5,by); ctx.lineTo(bx+bw*0.5,by+bh); ctx.stroke();

    // 방어막 (뮤츠)
    if (boss.shieldHp > 0 && boss.def.shieldHp) {
      const sRatio = Math.max(0, boss.shieldHp / boss.def.shieldHp);
      ctx.fillStyle='rgba(180,140,255,0.7)';
      ctx.shadowColor='#b39ddb'; ctx.shadowBlur=6;
      this._roundRect(ctx, bx, by-6, bw*sRatio, 5, 3);
      ctx.fill();
    }

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  // ===== INPUT =====
  handleTap(x, y) {
    const slotIdx = this.nearestSlot(x, y, 42);
    if (slotIdx !== null) {
      if (this.towerSlots[slotIdx].occupied) {
        this.selectedTower = this.towerSlots[slotIdx].tower;
        this.selectedSlotIdx = slotIdx; this.selectedTowerType = null;
      } else if (this.selectedTowerType) {
        const TClass = window.TowerRegistry && window.TowerRegistry[this.selectedTowerType];
        if (TClass) this.placeTower(TClass, slotIdx);
        this.selectedSlotIdx = null;
      } else {
        this.selectedSlotIdx = slotIdx; this.selectedTower = null;
      }
      return;
    }
    this.selectedTower = null; this.selectedSlotIdx = null;
  }
  handleHover(x, y) {
    if (!this.selectedTowerType) return;
    this.selectedSlotIdx = this.nearestSlot(x, y, 65);
  }
  nearestSlot(x, y, radius) {
    let best=null, bestD=radius;
    for (let i=0; i<this.towerSlots.length; i++) {
      const s=this.towerSlots[i], d=Math.hypot(x-s.x,y-s.y);
      if (d<bestD) { bestD=d; best=i; }
    }
    return best;
  }
}

// ===== 파티클 클래스들 =====
class FloatingText {
  constructor(text, x, y, color, opts={}) {
    this.text=text; this.x=x; this.y=y; this.color=color;
    this.alpha=1; this.vy=opts.vy||-75; this.life=0;
    this.maxLife=opts.life||1.0; this.fontSize=opts.fontSize||14; this.dead=false;
  }
  update(dt) {
    this.life+=dt; this.y+=this.vy*dt; this.vy*=0.93;
    this.alpha=Math.max(0,1-this.life/this.maxLife);
    if(this.life>=this.maxLife) this.dead=true;
  }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha=this.alpha;
    ctx.font=`bold ${this.fontSize}px -apple-system,sans-serif`;
    ctx.fillStyle=this.color; ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=5;
    ctx.fillText(this.text,this.x,this.y); ctx.restore();
  }
}

class RedFlash {
  constructor(w,h) { this.w=w;this.h=h;this.alpha=0.4;this.life=0;this.maxLife=0.4;this.dead=false; }
  update(dt) { this.life+=dt;this.alpha=0.4*(1-this.life/this.maxLife);if(this.life>=this.maxLife)this.dead=true; }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha=Math.max(0,this.alpha);
    const g=ctx.createRadialGradient(this.w/2,this.h/2,this.h*0.3,this.w/2,this.h/2,this.w*0.85);
    g.addColorStop(0,'rgba(230,57,70,0)'); g.addColorStop(1,'rgba(230,57,70,0.95)');
    ctx.fillStyle=g; ctx.fillRect(0,0,this.w,this.h); ctx.restore();
  }
}

class Spark {
  constructor(x,y,color) {
    this.x=x;this.y=y;this.color=color;
    const a=Math.random()*Math.PI*2,s=90+Math.random()*130;
    this.vx=Math.cos(a)*s;this.vy=Math.sin(a)*s-25;
    this.gravity=200;this.r=2.5+Math.random()*3;
    this.alpha=1;this.life=0;this.maxLife=0.4+Math.random()*0.3;this.dead=false;
  }
  update(dt) {
    this.life+=dt;this.x+=this.vx*dt;this.y+=this.vy*dt;
    this.vy+=this.gravity*dt;this.vx*=0.91;
    this.alpha=Math.max(0,1-this.life/this.maxLife);
    if(this.life>=this.maxLife)this.dead=true;
  }
  draw(ctx) {
    ctx.save();ctx.globalAlpha=this.alpha;ctx.fillStyle=this.color;
    ctx.shadowColor=this.color;ctx.shadowBlur=7;
    ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fill();ctx.restore();
  }
}

class BurstRing {
  constructor(x,y,maxR,color){this.x=x;this.y=y;this.maxR=maxR;this.color=color;this.life=0;this.maxLife=0.4;this.dead=false;}
  update(dt){this.life+=dt;if(this.life>=this.maxLife)this.dead=true;}
  draw(ctx){

    const t=this.life/this.maxLife,r=this.maxR*t;
    ctx.save();ctx.globalAlpha=(1-t)*0.7;ctx.strokeStyle=this.color;ctx.lineWidth=3*(1-t)+1;
    ctx.shadowColor=this.color;ctx.shadowBlur=12;
    ctx.beginPath();ctx.arc(this.x,this.y,r,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=(1-t)*0.14;ctx.fillStyle=this.color;ctx.fill();ctx.restore();
  }
}

class ComboFlash {
  constructor(x,y,combo){
    this.x=x;this.y=y;this.combo=combo;
    this.life=0;this.maxLife=1.2;this.dead=false;
    this.scale=0;
  }
  update(dt){
    this.life+=dt;
    if(this.life<0.15) this.scale=this.life/0.15;
    else this.scale=1-(this.life-0.15)/this.maxLife;
    this.y-=30*dt;
    if(this.life>=this.maxLife)this.dead=true;
  }
  draw(ctx){
    ctx.save();ctx.globalAlpha=Math.max(0,this.scale);
    ctx.translate(this.x,this.y);ctx.scale(this.scale,this.scale);
    ctx.font='bold 22px -apple-system,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.strokeStyle='rgba(0,0,0,0.9)';ctx.lineWidth=4;
    const color=this.combo>=20?'#ff6b6b':this.combo>=10?'#ffd60a':'#06d6a0';
    ctx.strokeText(`${this.combo}콤보!`,0,0);
    ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=16;
    ctx.fillText(`${this.combo}콤보!`,0,0);
    ctx.restore();
  }
}
window.BurstRing = BurstRing;
window.ComboFlash = ComboFlash;
window.FloatingText = FloatingText;
window.Spark = Spark;
