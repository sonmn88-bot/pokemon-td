// ===== ENGINE.JS - 완전 재설계 v3 =====

// 난이도별 적 스탯/보상/제한시간 배율
const DifficultyMods = {
  easy:   { name:'이지',  hpMul:0.72, speedMul:0.88, rewardMul:1.20, livesStart:26, goldStart:300, timeBonus:12 },
  normal: { name:'노말',  hpMul:1.00, speedMul:1.00, rewardMul:1.00, livesStart:20, goldStart:300, timeBonus:0  },
  hard:   { name:'하드',  hpMul:1.40, speedMul:1.15, rewardMul:0.88, livesStart:15, goldStart:220, timeBonus:-8 },
};
window.DifficultyMods = DifficultyMods;

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 0; this.height = 0;
    this.running = false; this.lastTime = 0; this.dt = 0;

    // 상태
    this.state = 'idle';
    this.gold = 180; // 실제 시작 골드는 DifficultyMods.goldStart가 덮어씀
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

    // v27-47: 카메라 팬/줌 시스템 (요청A) - 월드는 화면(viewport)보다 넓고, 카메라가 그 안을 비춤
    this.camera = { x: 0, y: 0, zoom: 1 }; // x,y = 화면 중앙에 보이는 월드 좌표
    this.worldWidth = 0; this.worldHeight = 0;
    this.minZoom = 0.8; this.maxZoom = 2.2; // v27-49: 0.6→0.8 (요청3 - 너무 축소하면 슬롯이 작아져서 탭이 잘 안 찍히는 문제)

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

    // 웨이브 제한시간 (순환 트랙 - 시간 내 처치 못하면 페널티)
    this.waveTimeLimit = 45;
    this.waveTimeRemaining = 0;

    // ===== v27: 엔드리스 모드 =====
    this.endless = true;
    this.fieldGameOverAt = 200;
    this.fieldWarnLevels = [140, 160, 180];
    this._fieldWarnFired = {};
    this.onFieldWarning = null; // (count, level)
    this.onZoneChange = null;   // (zoneIdx, mapId)

    // 난이도 (이지/노말/하드) - startGame에서 설정
    this.difficulty = 'normal';

    // 골드 보너스
    this._globalGoldMul = 1;
    this._waveSpeedMul = 1;   // v27-5: 이벤트웨이브(스피드웨이브)용
    this._waveHpMul = 1;      // v27-5: 이벤트웨이브(정예웨이브)용
    this._goldenTimeActive = false; this._goldenTimeGoldMul = 1; // v27-17: 황금시간 이벤트(요청3)

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
    this.onKingDefeated = null;
    this.score = 0;
    this.killScore = 0;
    this.onScoreChange = null;
    this.onWaveTimerChange = null;
    this.onWaveTimeout = null;
    this.onEliteKill = null;
    this.onHeroEvolutionReady = null;
    this.onHeroEvolved = null;

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
    // v27-46: 캔버스 "논리 해상도"를 최초 1회만 결정하고 이후로는 고정함 (요청1&6 - 데스크탑에서
    // 브라우저 창을 늘렸다 줄였다 하면서 슬롯 간격/타워 사거리의 상대적 커버리지를 편법으로 바꿀 수
    // 있었음. 창을 줄이면 같은 절대 픽셀 사거리가 상대적으로 더 넓어지는 식). 논리 좌표는 고정하고
    // 캔버스는 CSS(width:100%;height:100%)로 화면에 맞게 시각적으로만 확대/축소되게 함 - 게임 로직
    // 좌표는 전혀 안 바뀌므로 창 크기로 유불리를 만들 수 없음.
    if (!this._logicalWidth) {
      // 최초 1회: 실제 화면 비율 기반으로 논리 해상도 결정 (모바일/데스크탑 등 실제 기기 차이는 반영)
      this._logicalWidth = this.canvas.clientWidth || 1200;
      this._logicalHeight = this.canvas.clientHeight || 700;
      this.canvas.width = this._logicalWidth;
      this.canvas.height = this._logicalHeight;
    }
    this.width = this._logicalWidth;
    this.height = this._logicalHeight;
    // v27-47: 월드는 뷰포트보다 넓게 (요청A: 카메라로 팬/줌해서 보는 넓은 맵)
    this.worldWidth = this.width * 1.7;
    this.worldHeight = this.height * 1.7;
    if (!this._cameraInited) {
      this._cameraInited = true;
      this.camera.x = this.worldWidth / 2;
      this.camera.y = this.worldHeight / 2;
      this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom,
        Math.min(this.width / this.worldWidth, this.height / this.worldHeight) * 1.15));
    }
    this._bgDirty = true;
  }

  // v27-47: 카메라가 월드 밖으로 안 나가게 고정 (요청A)
  // v27-63: 카메라 원위치 (요청 - 화면이 확대/이동된 채 돌아오지 못하는 경우의 복구 수단)
  resetCamera() {
    this.camera.x = this.worldWidth / 2;
    this.camera.y = this.worldHeight / 2;
    this.camera.zoom = Math.max(this.minZoom, Math.min(this.maxZoom,
      Math.min(this.width / this.worldWidth, this.height / this.worldHeight) * 1.15));
    this.clampCamera();
  }
  clampCamera() {
    const viewW = this.width / this.camera.zoom, viewH = this.height / this.camera.zoom;
    const halfW = viewW / 2, halfH = viewH / 2;
    if (viewW >= this.worldWidth) this.camera.x = this.worldWidth / 2;
    else this.camera.x = Math.max(halfW, Math.min(this.worldWidth - halfW, this.camera.x));
    if (viewH >= this.worldHeight) this.camera.y = this.worldHeight / 2;
    else this.camera.y = Math.max(halfH, Math.min(this.worldHeight - halfH, this.camera.y));
  }

  // v27-47: 화면 좌표 → 월드 좌표 변환 (입력처리에서 사용)
  screenToWorld(sx, sy) {
    return {
      x: this.camera.x + (sx - this.width / 2) / this.camera.zoom,
      y: this.camera.y + (sy - this.height / 2) / this.camera.zoom,
    };
  }

  buildPaths() {
    // v27-47: 카메라 시스템 도입으로 월드 크기(worldWidth/Height) 기준으로 생성 (요청A).
    // 기존의 HUD/BAR 여백 개념은 필요 없음 - UI는 화면에 고정되고 월드는 카메라로 자유롭게 움직이며 봄.
    const rawPaths = this.currentMap.getPaths(this.worldWidth, this.worldHeight);
    this.paths = rawPaths;
  }
  buildTowerSlots() {
    // v27-47: 카메라 시스템 도입으로 월드 크기 기준으로 생성 (요청A)
    const rawSlots = this.currentMap.getSlots(this.worldWidth, this.worldHeight);
    const prevSlots = this.towerSlots;
    this.towerSlots = rawSlots.map((p, i) => {
      const prev = prevSlots && prevSlots[i];
      const slot = { x: p.x, y: p.y, occupied: !!(prev && prev.occupied), tower: (prev && prev.tower) || null };
      if (slot.tower) { slot.tower.x = slot.x; slot.tower.y = slot.y; }
      return slot;
    });
    // v27-43 버그수정: 확장부지로 만든 슬롯이 "타워가 이미 놓여있을 때만"(occupied) 보존되고 있었음.
    // 슬롯을 사왔는데 아직 타워를 안 놓은 상태로 존이 바뀌면(30/60/90웨이브) 그 슬롯 자체가 사라지고
    // 있었음 (요청1 - "슬롯 추가했는데 존 바뀌면 없어진다"는 문제의 진짜 원인). occupied 여부와 무관하게
    // 기본격자 밖의 슬롯은 전부 보존하도록 수정.
    if (prevSlots && prevSlots.length > rawSlots.length) {
      for (let i = rawSlots.length; i < prevSlots.length; i++) {
        if (prevSlots[i]) this.towerSlots.push(prevSlots[i]);
      }
    }
  }

  start() { this.running = true; this.lastTime = performance.now(); requestAnimationFrame(t=>this.loop(t)); }
  stop() { this.running = false; }

  loop(ts) {
    if (!this.running) return;
    const raw = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    // v28: 서브스텝 시뮬레이션 (3배속 끊김의 근본수정, v27-62 복구) - 배속을 dt에 한 번에 곱하면
    // 한 프레임에 이동거리가 3배가 되어 뚝뚝 끊겨보임. 최대 1/50초 단위로 잘게 쪼개서 여러 번 실행.
    const total = raw * this.speedMul;
    const MAX_STEP = 1 / 50;
    let remaining = total;
    while (remaining > 0.0001) {
      this.dt = Math.min(remaining, MAX_STEP);
      remaining -= this.dt;
      this._isLastSubstep = remaining <= 0.0001; // main.js의 UI 갱신은 마지막 서브스텝에서만
      this.update();
    }
    this.dt = total;
    // 유휴 절전: idle + 필드에 아무것도 없으면 렌더링 절반(≈30fps)
    const isQuiet = this.state === 'idle' && this.enemies.length === 0 &&
                    this.projectiles.length === 0 && this.particles.length === 0;
    this._frameSkip = (this._frameSkip || 0) + 1;
    if (!isQuiet || this._frameSkip % 2 === 0) this.draw();
    requestAnimationFrame(t=>this.loop(t));
  }

  update() {
    if (this.state !== 'wave' && this.state !== 'idle') return;

    // v27-11: 스폰 처리를 'wave' 상태 여부와 무관하게 항상 진행 (요청5 - 스킵해도 남은 몬스터가 계속 나오게)
    if (this.spawnQueue.length > 0) this.updateSpawn();

    if (this.state === 'wave') {
      // DP 재생
      this.deployPoints = Math.min(this.maxDeployPoints, this.deployPoints + this.deployRegenRate * this.dt);
      // 웨이브 제한시간 (시간 내 전멸 못 시키면 남은 적 수만큼 라이프 손실)
      this.waveTimeRemaining -= this.dt;
      this._waveElapsed = (this._waveElapsed || 0) + this.dt;
      // DOM 갱신은 초당 4회로 제한 (서브스텝마다 DOM을 건드리면 모바일 부담)
      this._timerUiAcc = (this._timerUiAcc || 0) + this.dt;
      if (this._timerUiAcc >= 0.25) {
        this._timerUiAcc = 0;
        this.onWaveTimerChange && this.onWaveTimerChange(Math.max(0, this.waveTimeRemaining), this.waveTimeLimit);
      }
      if (this.waveTimeRemaining <= 0) this.timeoutWave();
    }


    // 적 이동 (순환 트랙 - 더 이상 '도착'으로 라이프를 잃지 않음, 시간 내 처치해야 함)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(this.dt);
      if (e.dead) { this._onEnemyDie(e); this.enemies.splice(i,1); }
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

    // ===== v27: 엔드리스 - 필드 누적 몬스터 수로 게임오버 판정 =====
    if (this.endless && (this.state === 'wave' || this.state === 'idle')) {
      const count = this.enemies.length;
      this._peakFieldCount = Math.max(this._peakFieldCount || 0, count); // v27-5: 위험보너스용 (item D)
      // v27-24: 필드 안정 보너스 완전 제거함 (요청) - 게임 시작 전 idle 상태에서도 계속 발동돼서
      // 가만히 놔둬도 골드가 쌓이는 문제가 있었음.
      for (const lvl of this.fieldWarnLevels) {
        if (count >= lvl && !this._fieldWarnFired[lvl]) {
          this._fieldWarnFired[lvl] = true;
          this.onFieldWarning && this.onFieldWarning(count, lvl);
        }
        if (count < lvl - 5) this._fieldWarnFired[lvl] = false;
      }
      if (count >= this.fieldGameOverAt) this.triggerGameOver();
    }

    if (this.shakeTimer > 0) this.shakeTimer -= this.dt;
  }

  _onEnemyDie(enemy) {
    if (enemy._elite === 'gold') {
      this.onEliteKill && this.onEliteKill(enemy);
      // v27-16: 골드 엘리트 고유 기믹 (요청4) - 처치시 주변 적에게 폭발 데미지 (클러스터 정리 보상)
      const novaDmg = 25 + this.currentWave * 0.8;
      let hitCount = 0;
      for (const e2 of this.enemies) {
        if (e2 === enemy || e2.dead || e2.reachedEnd) continue;
        if (Math.hypot(e2.x - enemy.x, e2.y - enemy.y) <= 90) { e2.takeDamage(novaDmg, 'special'); hitCount++; }
      }
      if (hitCount > 0) {
        if (window.AoeBurst) this.particles.push(new AoeBurst(enemy.x, enemy.y, 90, '#ffc24b'));
        this.spawnFloatingText(`✨골드 엘리트 폭발! ${hitCount}마리 추가타격`, enemy.x, enemy.y - 45, '#ffc24b');
      }
    }
    if (enemy._isKing) this.onKingDefeated && this.onKingDefeated();
    // v28 (설계서 §5): 킬 골드가 웨이브에 따라 성장 (기본보상 × (1 + 웨이브/30))
    const baseReward = Math.max(1, Math.round(enemy.reward * (1.5 + this.currentWave / 20))); // v3.0: 처치 골드 상향 (웨이브10 기준 ×1.33→×2.0)
    const traitGoldMul = this._runTrait?.key === 'goldBoom' ? 1.2 : 1;
    const effectiveGoldMul = this._globalGoldMul * (this._goldenTimeActive ? this._goldenTimeGoldMul : 1) * traitGoldMul;
    const bonus = Math.floor(baseReward * (effectiveGoldMul - 1));
    // v27-16: 현상금 몬스터 보너스 (요청2)
    let bountyBonus = 0;
    if (enemy._bounty) { bountyBonus = 40 + Math.round(this.currentWave * 1.5); this.spawnFloatingText(`💰현상금 +${bountyBonus}g!`, enemy.x, enemy.y - 30, '#ffc24b'); }
    this.addGold(baseReward + bonus + bountyBonus);
    this.spawnFloatingText(`+${baseReward + bonus}g`, enemy.x, enemy.y - 10, '#ffc24b');

    // v27-4: 점수 공식 (item 13,19) - 생존이 지배적, 킬은 보너스 수준
    // 일반킬 1-3(엘리트는 조금 더), 미니보스 25, 일반보스 80, 왕 120
    let killScore = 1;
    if (enemy._isKing) killScore = 200; // v27-42: 스킵 대비 정면승부 보상 강화 (120→200)
    else if (enemy.isBoss) killScore = 150; // 80→150
    else if (enemy._elite) killScore = enemy._elite === 'gold' ? 5 : 3;
    else killScore = enemy.def?.special ? 2 : 1; // 기믹 있는 몹은 조금 더
    this.killScore = (this.killScore || 0) + killScore;
    this.score = Math.round(this.currentWave * 12 + this.killScore);
    this.onScoreChange && this.onScoreChange(this.score);

    // 영웅 경험치
    for (const h of this.heroes) {
      h.gainExp(enemy.reward * 0.5, this);
    }
  }

  // ===== SPAWN =====
  startWave(waveData, timeLimit) {
    if (this.state !== 'idle') return false;
    this.currentWave++;
    this.state = 'wave';
    // v27-14 버그수정: 연속 스킵하면 이월 큐가 계속 쌓여서, 나중에 한꺼번에 몰아서 스폰되며
    // 필드 누적수가 갑자기 확 튀는 문제가 있었음 (요청4). 백로그 상한을 둬서 너무 많이 쌓이지 않게 함.
    const carryOver = this.spawnQueue.length;
    if (carryOver > 0) {
      const offset = this.spawnTimer;
      let merged = this.spawnQueue.concat(waveData.map(item => ({ ...item, delay: item.delay + offset + 2 })));
      // v27-20: 백로그 상한을 완전히 제거 (요청3) - 예전엔 70개 넘으면 "곧 나올 것"들이 통째로 삭제돼서
      // 스킵을 아무리 많이 해도 결국 몬스터 상당수가 영원히 안 나오는 사실상 무료스킵이 되고 있었음.
      // 이제 몇 번을 스킵하든 큐에 있는 몬스터는 전부 나중에라도 반드시 나옵니다 (밀린 만큼 필드가 위험해짐 - 의도된 페널티).
      // v28: 삭제 없이 + 최소 간격 강제 (v27-61 복구) - 밀린 큐가 동시에 '스폰 가능' 상태가 되어
      // 한꺼번에 쏟아지며 게임오버되던 문제 방지. 아무리 밀려도 0.12초 간격보다 촘촘해지지 않음.
      merged.sort((a, b) => a.delay - b.delay);
      const MIN_GAP = 0.12;
      for (let i = 1; i < merged.length; i++) {
        if (merged[i].delay < merged[i-1].delay + MIN_GAP) merged[i].delay = merged[i-1].delay + MIN_GAP;
      }
      this.spawnQueue = merged;
    } else {
      this.spawnQueue = [...waveData];
      this.spawnTimer = 0;
    }
    this.activeSpawns = this.spawnQueue.length;
    this._waveElapsed = 0;
    this._shopWaveUses = {}; // v28: 상점 웨이브당 사용 횟수 초기화
    this.waveTimeRemaining = timeLimit || this.waveTimeLimit;
    this.onWaveChange && this.onWaveChange(this.currentWave, this.totalWaves);
    this.onWaveTimerChange && this.onWaveTimerChange(this.waveTimeRemaining, this.waveTimeRemaining);
    this.onStateChange && this.onStateChange('wave');
    return true;
  }

  // v27: 시간 초과 - 페널티 없이 자동으로 다음 웨이브 진행. 살아남은 적은 필드에 그대로 남아 누적됨(필드 누적 게임오버 판정용)
  // v27-11: 시간 초과/스킵 - 페널티는 없지만, 요청5에 따라 아직 안 나온 몬스터를 그냥 삭제하지 않고
  // 백그라운드에서 계속 스폰되도록 큐를 유지함 (스킵이 "물량을 통째로 씹고 진행"하는 공짜 스킵이 되지 않게)
  timeoutWave() {
    if (this.state !== 'wave') return;
    this.state = 'idle';
    this._payInterest(false); // v28: 시간초과/스킵으로 넘어가도 이자는 지급 (웨이브 보너스는 없음)
    this.onWaveTimerChange && this.onWaveTimerChange(0, this.waveTimeLimit);
    this.onWaveTimeout && this.onWaveTimeout(0, this.enemies.length);
    this.onWaveComplete && this.onWaveComplete(this.currentWave, 0, true);
    if (!this.endless && this.currentWave >= this.totalWaves) this.triggerVictory();
    else this.onStateChange && this.onStateChange('idle');
  }

  updateSpawn() {
    this.spawnTimer += this.dt;
    // v27-25: 한꺼번에 밀려있던 스폰이 단일 프레임에 전부 처리되면 순간 버벅임(스터터)을 유발할 수 있어
    // 프레임당 스폰 처리 개수에 상한을 둠 (요청3 - 안정성). 나머지는 다음 프레임에 이어서 처리되므로
    // 몬스터가 사라지지는 않고, 아주 살짝(수 프레임) 늦게 나오는 정도의 차이만 생김.
    let spawnedThisFrame = 0;
    const MAX_SPAWN_PER_FRAME = 15;
    while (this.spawnQueue.length > 0 && this.spawnTimer >= this.spawnQueue[0].delay && spawnedThisFrame < MAX_SPAWN_PER_FRAME) {
      const item = this.spawnQueue.shift();
      this._spawnEnemy(item);
      spawnedThisFrame++;
    }
  }

  _spawnEnemy(item) {
    const pathIdx = item.pathIdx !== undefined ? item.pathIdx : 0;
    const path = this.paths[pathIdx] || this.paths[0];
    const enemy = new Enemy(item.type, path, this);

    // v27-5: 웨이브 진행에 따른 연속 체력 스케일링 (기존엔 티어 전환/사이클 외엔 몹 자체 체력이 안 늘었음)
    // v27-11: 90웨이브 이후(왕 처치 후 무한강화) 체력 스케일링을 훨씬 가파르게 - 기존엔 웨이브 220에서도
    // 3.94배 수준이라 계속 도배해서 잡을 수 있었음. 이제 90 이후로는 복합 성장으로 훨씬 위협적이게.
    // v28 (설계서 §2): 몹 체력을 플레이어 화력과 같은 모양(지수)으로. 기존엔 90웨이브까지 선형(+1.4%)이라
    // 곱연산으로 성장하는 타워 화력을 못 따라가서 "너무 쉬워지는" 근본 원인이었음.
    // 초반(5웨이브까지)은 기존과 동일하게 유지 - 1~2성 구간의 아슬아슬함은 그대로.
    if (!item.isKing && !item.bossTier) {
      let waveHpMul = Math.pow(1.045, Math.max(0, this.currentWave - 5));
      if (this.currentWave > 90) waveHpMul *= Math.pow(1.07, this.currentWave - 90) / Math.pow(1.045, this.currentWave - 90);
      if (this._runTrait?.key === 'swarm') waveHpMul *= 0.88;
      enemy.maxHp = Math.round(enemy.maxHp * waveHpMul);
      enemy.hp = enemy.maxHp;
    }
    // v28: 방어력 (타격당 고정 차감) - 등급 격차를 실제로 체감되게 만드는 핵심 장치
    enemy.armor = Math.floor(this.currentWave / 6);

    // v27-5: 이벤트웨이브 배율 (요청: 초반 다채로움) - 왕/보스는 제외
    if (!item.isKing && !item.bossTier) {
      if (this._waveSpeedMul !== 1) enemy.speed *= this._waveSpeedMul;
      if (this._waveHpMul !== 1) { enemy.maxHp = Math.round(enemy.maxHp * this._waveHpMul); enemy.hp = enemy.maxHp; }
    }

    // 난이도 배율
    const dm = DifficultyMods[this.difficulty] || DifficultyMods.normal;
    if (dm.hpMul !== 1) { enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * dm.hpMul)); enemy.hp = enemy.maxHp; }
    if (dm.speedMul !== 1) enemy.speed *= dm.speedMul;
    if (dm.rewardMul !== 1) enemy.reward = Math.max(1, Math.round(enemy.reward * dm.rewardMul));

    // v27-4: 90웨이브 왕(King) - 일반 보스보다 훨씬 강력, 고유 표식
    if (item.isKing) {
      enemy.maxHp = Math.round(enemy.maxHp * 60);
      enemy.hp = enemy.maxHp;
      enemy.reward = Math.round(enemy.reward * 40);
      enemy.isBoss = true;
      enemy._isKing = true;
      enemy._spawnGraceTimer = 8; // v27-35: 유예기간도 연장
    }

    // v27: 수동 보스소환 등급 배율 (1~5단계, 너무 약해서 순삭당하던 문제 수정)
    if (item.bossTier) {
      enemy.maxHp = Math.round(enemy.maxHp * item.hpMul);
      enemy.hp = enemy.maxHp;
      enemy.reward = Math.round(enemy.reward * item.rewardMul);
      enemy._bossTier = item.bossTier;
      enemy.isBoss = true;
      // v27-34: 보스 스폰 유예기간 (요청 - 원인이 뭐든 결과적으로 3초컷 자체를 막기 위한 안전장치)
      // 등장 후 5초간은 받는 피해가 60%로 감소, 이후 서서히 정상으로 회복. 최소 생존시간을 보장함.
      enemy._spawnGraceTimer = 7;
    }

    // 엘리트 변형 (10% 확률, 수동소환 보스는 제외)
    const eliteChance = this._runTrait?.key === 'eliteEra' ? 0.20 : 0.10;
    if (!enemy.isBoss && Math.random() < eliteChance) {
      enemy._elite = Math.random() < 0.15 ? 'gold' : 'silver';
      const mul = enemy._elite === 'gold' ? 2.2 : 1.5;
      enemy.maxHp = Math.floor(enemy.maxHp * mul);
      enemy.hp = enemy.maxHp;
      enemy.speed *= (enemy._elite === 'gold' ? 1.3 : 1.15);
      enemy.reward = Math.floor(enemy.reward * (enemy._elite === 'gold' ? 2.5 : 1.8));
    }

    // v27-4: 왕(90웨이브) 처치 후 무한강화 구간 - 20웨이브마다 새로운 능력 순차 추가 (item 10)
    if (!enemy.isBoss && this.currentWave > 90) {
      const postKing = this.currentWave - 90;
      if (postKing >= 20 && Math.random() < 0.18) {
        // 1단계(110웨이브+): 방어막 (기존 뮤츠 방어막 시스템 재사용)
        enemy.shieldActive = true;
        enemy.shieldHp = Math.round(enemy.maxHp * 0.25);
      }
      if (postKing >= 40 && Math.random() < 0.15) {
        // 2단계(130웨이브+): 재생 (기존 라프라스 regen 시스템 재사용, 공유 def 오염 방지 위해 클론)
        enemy.def = { ...enemy.def, special: 'regen', regenRate: enemy.maxHp * 0.01 };
      }
      if (postKing >= 60) {
        // 3단계(150웨이브+): 전체 이동속도 +20%
        enemy.speed *= 1.2;
      }
    }

    this.enemies.push(enemy);
    this.activeSpawns--;
    if (enemy.isBoss) this.onBossAppear && this.onBossAppear(enemy);
  }

  waveCleared() {
    this.state = 'idle';
    // v28 (설계서 §5): 웨이브 클리어 보너스 10 + 웨이브×1.5 (최대 150). 위험보너스는 이자와 역할이
    // 겹쳐서 제거 (단순화).
    let bonus = Math.round(Math.min(220, Math.round(25 + this.currentWave * 3)) * (this._waveBonusMul || 1)); // v3.0: 10+1.5w→25+3w
    if (this._nextWaveGoldMul) { bonus = Math.round(bonus * this._nextWaveGoldMul); this._nextWaveGoldMul = null; }
    this._peakFieldCount = 0;
    this.addGold(bonus);
    const interest = this._payInterest(true);
    this.score = Math.round(this.currentWave * 12 + (this.killScore || 0));
    this.onScoreChange && this.onScoreChange(this.score);
    this.onWaveComplete && this.onWaveComplete(this.currentWave, bonus + interest, false);
    if (!this.endless && this.currentWave >= this.totalWaves) this.triggerVictory();
    else this.onStateChange && this.onStateChange('idle');
  }

  // v28: 이자 (설계서 §5) - 웨이브가 끝날 때 보유 골드 10당 1골드, 상한 30(+영웅 보너스, 최대 45).
  // "지금 뽑을까, 모아서 이자 받을까"를 매 웨이브 고민하게 만드는 장치. 클리어/시간초과 둘 다 지급.
  _payInterest(cleared) {
    // 스킵 연타로 이자만 빼먹는 것 방지: 시간초과/스킵은 웨이브가 20초 이상 진행됐을 때만 지급
    if (!cleared && (this._waveElapsed || 0) < 20) return 0;
    const cap = Math.min(45, 30 + (this._interestCapBonus || 0));
    const interest = Math.min(cap, Math.floor(this.gold / 10));
    if (interest > 0) {
      this.gold = Math.round(this.gold + interest); // 이자는 골드 배율(토게피 등) 미적용
      this.onGoldChange && this.onGoldChange(this.gold);
      this.spawnFloatingText(`🏦 이자 +${interest}g`, this.camera.x, this.camera.y - (this.height/2 - 110)/this.camera.zoom, '#34d399');
    }
    return interest;
  }

  // ===== GOLD / LIVES =====
  addGold(n) {
    // v27-49 버그수정: 토게피의 골드보너스가 설정만 되고 실제 골드 계산에 전혀 반영이 안 되고
    // 있었음(요청4 - 영웅 밸런스 재검토 중 발견). 여기서 실제로 곱해지도록 연결.
    const mul = this._togepiGoldMul || 1;
    this.gold = Math.round(this.gold + n * mul);
    this.onGoldChange && this.onGoldChange(this.gold);
  } // v27-27: 부동소수점 오차 누적 방지 (요청: 833.300000000001 표시버그)
  spendGold(n) { if (this.gold < n) return false; this.gold = Math.round(this.gold - n); this.onGoldChange && this.onGoldChange(this.gold); return true; }
  loseLife(n=1) {
    this.lives = Math.max(0, this.lives - n);
    this.onLivesChange && this.onLivesChange(this.lives);
    this.shakeTimer = 0.35; this.shakeAmt = 7;
    this.particles.push(new RedFlash(this.width, this.height));
    if (this.lives <= 0) this.triggerGameOver();
  }
  triggerGameOver() {
    this.state = 'gameover';
    // v27-18: 사망 서사 (요청F) - 게임오버 시점에 필드에 가장 많던 적 종류를 기록
    const counts = {};
    for (const e of this.enemies) {
      if (e.dead) continue;
      counts[e.name] = (counts[e.name] || 0) + 1;
    }
    let topName = null, topCount = 0;
    for (const name in counts) { if (counts[name] > topCount) { topCount = counts[name]; topName = name; } }
    this._deathCause = topName ? { name: topName, count: topCount } : null;
    this.onGameOver && this.onGameOver();
  }

  // v27: 존(맵) 전환 - 기존 타워는 절대좌표 유지로 그대로 남음
  switchZone(mapId, zoneIdx) {
    this.currentMap = MapDefs[mapId];
    this.buildPaths();
    this.buildTowerSlots();
    this._bgDirty = true;
    this.onZoneChange && this.onZoneChange(zoneIdx, mapId);
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
    this.spawnHitParticle(slot.x, slot.y, '#6aa8ff');
    return true;
  }
  sellTower(slotIdx) {
    const slot = this.towerSlots[slotIdx];
    if (!slot || !slot.occupied) return;
    const t = slot.tower;
    // v27-46 버그수정: totalSpent가 초기화만 되고 어디서도 증가하지 않아서 판매 환불이 항상 0골드였음
    // (요청8 - "1성/2성 팔았을 때 돈이 너무 적게 들어오는지 체크해봐" → 사실은 0원이었음).
    // 정확한 지출 이력 추적 대신, 신뢰성 있는 등급 기반 고정 판매가로 교체.
    const refund = (window.SELL_VALUE || {})[t.def?.grade] || 40; // v28: 판매가 단일 기준
    this.addGold(refund);
    this.spawnFloatingText(`+${refund}g`, slot.x, slot.y, '#34d399');
    this.towers = this.towers.filter(x=>x!==t);
    slot.occupied = false; slot.tower = null;
    if (window.applyTowerSynergies) window.applyTowerSynergies(this.towers);
  }

  // ===== FX =====
  spawnFloatingText(text, x, y, color, opts={}) { this.particles.push(new FloatingText(text,x,y,color,opts)); }
  spawnHitParticle(x, y, color) { for (let i=0;i<6;i++) this.particles.push(new Spark(x,y,color)); this.onHitSound && this.onHitSound(); }
  triggerScreenShake(amt=5, dur=0.2) { this.shakeAmt=amt; this.shakeTimer=dur; }

  // ===== DRAW =====
  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    // v27-47: 카메라 변환 (요청A) - 이 시점부터 그리는 모든 것은 "월드 좌표"로 취급되어
    // 카메라 위치/줌에 따라 화면에 매핑됨. 개별 draw() 메서드들은 전혀 몰라도 됨.
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);
    if (this.shakeTimer > 0) {
      const s = (this.shakeTimer/0.35)*this.shakeAmt;
      ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
    }

    this._drawBgCached(ctx); // v28: 경로(drawPaths)는 정적이라 배경 캐시에 함께 구움 (매 프레임 X)
    this.drawSlots(ctx);

    // v28: 뷰포트 컬링 (v27-62 복구) - 카메라 밖 개체는 안 그림
    const cullMargin = 80;
    const viewHalfW = this.width / 2 / this.camera.zoom + cullMargin;
    const viewHalfH = this.height / 2 / this.camera.zoom + cullMargin;
    const cx = this.camera.x, cy = this.camera.y;
    const inView = (o) => Math.abs(o.x - cx) <= viewHalfW && Math.abs(o.y - cy) <= viewHalfH;

    for (const t of this.towers) if (inView(t)) t.draw(ctx);
    for (const h of this.heroes) h.draw(ctx);

    // Y순 정렬 (제자리 정렬 - 매 프레임 배열 복사 제거)
    this.enemies.sort((a,b)=>a.y-b.y);
    for (const e of this.enemies) if (inView(e)) e.draw(ctx);

    for (const p of this.projectiles) if (inView(p)) p.draw(ctx);
    // v27-47: RedFlash(전체화면 빨간 비네트)는 스크린 좌표 기준이라 카메라 변환 밖에서 그려야 함
    // (안에서 그리면 카메라 위치/줌에 따라 화면을 제대로 못 덮는 버그가 생김)
    for (const p of this.particles) if (!(p instanceof RedFlash) && (p.x === undefined || inView(p))) p.draw(ctx);

    if (this.selectedTower) this._drawRange(ctx, this.selectedTower);
    if (this.selectedSlotIdx !== null && this.selectedTowerType) this._drawPreview(ctx);

    ctx.restore();

    // 화면 고정 이펙트 (카메라 변환 영향 안 받음)
    for (const p of this.particles) if (p instanceof RedFlash) p.draw(ctx);

    // v27-47: 보스 HP바는 화면 상단 고정 UI라서 카메라 변환 밖(화면좌표)에서 그림
    if (this.activeBoss) this._drawBossBar(ctx);
  }

  // v28: 텍스처 여러 장을 모자이크로 합쳐(일부 반전) 반복 티를 줄인 CanvasPattern. 로딩 전엔 null.
  _getMosaicPattern(ctx, key, urls, worldTileSize) {
    if (!this._texCache) this._texCache = {};
    const cacheKey = key + '_' + worldTileSize;
    let entry = this._texCache[cacheKey];
    if (!entry) {
      entry = { images: [], loaded: 0, ready: false, pattern: null };
      urls.forEach((u, i) => {
        const im = new Image();
        im.onload = () => { if (++entry.loaded === urls.length) { entry.ready = true; this._bgDirty = true; } };
        im.src = u;
        entry.images[i] = im;
      });
      this._texCache[cacheKey] = entry;
    }
    if (!entry.ready) return null;
    if (!entry.pattern) {
      const sz = entry.images[0].naturalWidth || 512;
      const cols = entry.images.length >= 2 ? 2 : 1;
      const rows = Math.ceil(entry.images.length / cols);
      const mc = document.createElement('canvas');
      mc.width = sz * cols; mc.height = sz * rows;
      const mctx = mc.getContext('2d');
      entry.images.forEach((im, i) => {
        const x0 = (i % cols) * sz, y0 = Math.floor(i / cols) * sz;
        const fx = (i * 7) % 3 === 0, fy = (i * 11) % 4 === 0;
        mctx.save();
        mctx.translate(x0 + (fx ? sz : 0), y0 + (fy ? sz : 0));
        mctx.scale(fx ? -1 : 1, fy ? -1 : 1);
        mctx.drawImage(im, 0, 0, sz, sz);
        mctx.restore();
      });
      const pat = ctx.createPattern(mc, 'repeat');
      if (pat && pat.setTransform) { try { pat.setTransform(new DOMMatrix().scale(worldTileSize / sz)); } catch (e) {} }
      entry.pattern = pat;
    }
    return entry.pattern;
  }

  _drawBgCached(ctx) {
    // v27-36: 배경이 까매지는 문제 방어 (요청3) - width/height가 비정상(0 이하 등)이면 배경 재생성을
    // 건너뛰고 기존 캐시를 그대로 사용 (레이아웃 과도기에 순간적으로 크기가 이상해지는 경우 대비)
    if (this.worldWidth <= 0 || this.worldHeight <= 0) {
      if (this._bgCanvas) ctx.drawImage(this._bgCanvas, 0, 0);
      return;
    }
    if (this._bgDirty || !this._bgCanvas ||
        this._bgCanvas.width !== this.worldWidth || this._bgCanvas.height !== this.worldHeight) {
      const bc = document.createElement('canvas');
      bc.width = this.worldWidth; bc.height = this.worldHeight; // v27-47: 배경도 월드 크기 전체로
      const bctx = bc.getContext('2d');
      const map = this.currentMap;

      // v28: 반복 타일 텍스처(잔디/용암) 우선 - 모자이크 패턴 (v27-58 복구)
      if (map.bgTextures) {
        const pat = this._getMosaicPattern(bctx, map.name + '_bg', map.bgTextures, map.bgTileSize || 300);
        bctx.fillStyle = pat || map.bgColor;
        bctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
        bctx.fillStyle = 'rgba(0,0,0,0.30)'; // 게임 톤(어두운)과 어우러지게
        bctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
      } else if (map.bgImage) {
        if (!this._bgImg || this._bgImg._src !== map.bgImage) {
          const im = new Image();
          im._src = map.bgImage;
          im.src = map.bgImage;
          this._bgImg = im;
        }
        if (this._bgImg.complete && this._bgImg.naturalWidth > 0) {
          // 커버 방식으로 그리기
          const ir = this._bgImg.naturalWidth / this._bgImg.naturalHeight;
          const cr = this.worldWidth / this.worldHeight;
          let sx=0,sy=0,sw=this._bgImg.naturalWidth,sh=this._bgImg.naturalHeight;
          if (ir > cr) { sw = sh*cr; sx=(this._bgImg.naturalWidth-sw)/2; }
          else { sh=sw/cr; sy=(this._bgImg.naturalHeight-sh)/2; }
          bctx.drawImage(this._bgImg, sx,sy,sw,sh, 0,0,this.worldWidth,this.worldHeight);
          // 어두운 오버레이로 게임과 어우러지게
          bctx.fillStyle='rgba(0,0,0,0.22)';
          bctx.fillRect(0,0,this.worldWidth,this.worldHeight);
        } else {
          // 로드 전: 단색 폴백, 로드 완료 후 캐시 무효화
          bctx.fillStyle = map.bgColor;
          bctx.fillRect(0,0,this.worldWidth,this.worldHeight);
          this._bgImg.onload = () => { this._bgDirty = true; };
        }
      } else {
        bctx.fillStyle = map.bgColor;
        bctx.fillRect(0,0,this.worldWidth,this.worldHeight);
      }

      // 맵별 이모지/장식 오버레이
      if (map.drawBg) map.drawBg(bctx, this.worldWidth, this.worldHeight);
      this.drawPaths(bctx); // v28: 정적인 경로를 캐시에 1회만 그림
      this._bgCanvas = bc; this._bgDirty = false;
    }
    ctx.drawImage(this._bgCanvas, 0, 0);
  }

  drawPaths(ctx) {
    for (const path of this.paths) {
      const map = this.currentMap;
      const pw = map.pathWidth || 34;

      // v3.0 자연 지형: 딱딱한 테두리 대신 '닳은 흙 가장자리'를 흐리게 → 골짜기 바닥 길처럼
      const trace = () => { ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y); for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y); };
      ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.filter='blur(6px)'; ctx.strokeStyle='rgba(0,0,0,0.32)'; ctx.lineWidth=pw+22; trace(); ctx.stroke();   // 골짜기 그늘
      ctx.filter='blur(3px)'; ctx.strokeStyle=map.pathColorDark||map.pathColor; ctx.globalAlpha=0.75;
      ctx.lineWidth=pw+9; trace(); ctx.stroke();                                                                   // 흙 가장자리
      ctx.filter='none'; ctx.globalAlpha=1;
      let pathFill = map.pathColor;
      if (map.pathTextures) {
        const ppat = this._getMosaicPattern(ctx, map.name + '_path', map.pathTextures, map.pathTileSize || 40);
        if (ppat) pathFill = ppat;
      }
      ctx.strokeStyle=pathFill; ctx.lineWidth=pw; trace(); ctx.stroke();                                          // 길 바닥
      ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=pw*0.55; ctx.setLineDash([2,9]); trace(); ctx.stroke();   // 바퀴/발자국 자국
      ctx.setLineDash([]); ctx.restore();

      // 방향 화살표
      this._drawArrows(ctx, path, map);
    }
  }

  _drawArrows(ctx, path, map) {
    const interval = 120;
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
    const margin = 40;
    const halfW = this.width / 2 / this.camera.zoom + margin;
    const halfH = this.height / 2 / this.camera.zoom + margin;
    for (let i=0; i<this.towerSlots.length; i++) {
      const s = this.towerSlots[i];
      if (s.occupied) continue;
      if (Math.abs(s.x - this.camera.x) > halfW || Math.abs(s.y - this.camera.y) > halfH) continue;
      const isHL = this.selectedTowerType !== null;
      const isHov = this.selectedSlotIdx === i;
      const isMouseHover = this.hoveredSlotIdx === i && !isHov; // v27-49: 데스크탑 마우스 호버 표시 (배치모드 하이라이트와 안 겹치게)

      ctx.save();
      // v28 세션E: 빈 슬롯 = '돌 받침대' (미리 구워둔 스프라이트 1장을 drawImage - 매 프레임 그라디언트 생성 없음)
      ctx.globalAlpha = (isHov || isMouseHover || isHL) ? 0.9 : 0.5; // v3.0: 평소엔 반투명 - 지형에 녹아들게
      ctx.drawImage(this._getPedestal(), s.x - 26, s.y - 22, 52, 52);
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 20, 15, 0, 0, Math.PI*2);
      if (isHov) {
        ctx.fillStyle='rgba(106,168,255,0.35)'; ctx.strokeStyle='#6aa8ff'; ctx.lineWidth=2.5;
        ctx.fill(); ctx.stroke();
      } else if (isMouseHover) {
        ctx.fillStyle='rgba(106,168,255,0.18)'; ctx.strokeStyle='rgba(106,168,255,0.75)'; ctx.lineWidth=2;
        ctx.fill(); ctx.stroke();
      } else if (isHL) {
        ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=1.5; ctx.stroke();
      }

      // + 아이콘
      ctx.shadowBlur=0;
      ctx.strokeStyle=isHov?'#6aa8ff':(isHL?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.16)');
      ctx.lineWidth=isHov?2.5:1.5; ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(s.x-6,s.y); ctx.lineTo(s.x+6,s.y);
      ctx.moveTo(s.x,s.y-6); ctx.lineTo(s.x,s.y+6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 돌 받침대 스프라이트 (한 번만 생성, 3배 해상도로 구워 줌해도 선명)
  _getPedestal() {
    if (this._pedestal) return this._pedestal;
    const S = 3, c = document.createElement('canvas'); c.width = c.height = 52 * S;
    const g = c.getContext('2d'); g.scale(S, S);
    const cx = 26, cy = 22;
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(cx, cy + 9, 23, 13, 0, 0, Math.PI*2); g.fill(); // 그림자
    g.fillStyle = '#5b5348'; g.beginPath(); g.ellipse(cx, cy + 5, 22, 15, 0, 0, Math.PI*2); g.fill();          // 옆면
    const top = g.createLinearGradient(0, cy - 16, 0, cy + 14);
    top.addColorStop(0, '#b9b0a2'); top.addColorStop(1, '#857b6d');
    g.fillStyle = top; g.beginPath(); g.ellipse(cx, cy, 22, 15, 0, 0, Math.PI*2); g.fill();                    // 윗면
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(cx, cy, 15, 9.5, 0, 0, Math.PI*2); g.fill();     // 안쪽 오목
    g.strokeStyle = 'rgba(60,50,40,0.35)'; g.lineWidth = 0.8;                                                  // 돌 금
    g.beginPath(); g.moveTo(cx - 17, cy - 4); g.lineTo(cx - 11, cy - 1); g.lineTo(cx - 13, cy + 5); g.stroke();
    g.beginPath(); g.moveTo(cx + 12, cy - 9); g.lineTo(cx + 16, cy - 3); g.stroke();
    return (this._pedestal = c);
  }

  _drawRange(ctx, tower) {
    ctx.save();
    ctx.beginPath(); ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI*2);
    ctx.strokeStyle='rgba(255,194,75,0.65)'; ctx.lineWidth=2;
    ctx.fillStyle='rgba(255,194,75,0.07)';
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
    ctx.strokeStyle='rgba(106,168,255,0.55)'; ctx.lineWidth=2;
    ctx.fillStyle='rgba(106,168,255,0.08)';
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
    ctx.font='bold 11px Pretendard,-apple-system,sans-serif';
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
  handleTap(sx, sy) {
    // v27-47: 화면좌표로 들어오는 입력을 월드좌표로 변환 (요청A - 카메라 팬/줌 대응)
    const { x, y } = this.screenToWorld(sx, sy);
    const radius = 50 / this.camera.zoom; // 줌과 무관하게 화면상 탭 관용범위가 일정하도록
    const slotIdx = this.nearestSlot(x, y, radius);
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
  handleHover(sx, sy) {
    const { x, y } = this.screenToWorld(sx, sy);
    // v27-49: 배치모드와 무관하게 항상 호버 슬롯을 갱신 (요청: 데스크탑에서 마우스 갖다대면
    // 클릭 가능한 걸 파랗게 알 수 있으면 좋겠다는 요청)
    this.hoveredSlotIdx = this.nearestSlot(x, y, 50 / this.camera.zoom);
    if (!this.selectedTowerType) return;
    this.selectedSlotIdx = this.nearestSlot(x, y, 65 / this.camera.zoom);
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
    ctx.font=`bold ${this.fontSize}px Pretendard,-apple-system,sans-serif`;
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
    g.addColorStop(0,'rgba(244,63,94,0)'); g.addColorStop(1,'rgba(244,63,94,0.95)');
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
    ctx.font='bold 22px Pretendard,-apple-system,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.strokeStyle='rgba(0,0,0,0.9)';ctx.lineWidth=4;
    const color=this.combo>=20?'#ff5c7a':this.combo>=10?'#ffc24b':'#34d399';
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
