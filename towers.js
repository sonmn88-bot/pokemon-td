// ===== TOWERS.JS - 타워 8계열 + Lv1~3 업그레이드 =====

// 타워 캐릭터 이미지 (실사 포켓몬 스프라이트). 로드는 sprites.js의 loadSpriteImage 재사용.
const TowerSpriteImages = {
  bulbasaur: 'assets/towers/bulbasaur.png',
  charmander: 'assets/towers/charmander.png',
  squirtle: 'assets/towers/squirtle.png',
  voltorb: 'assets/towers/voltorb.png',
  jynxline: 'assets/towers/jynxline.png',
  geodude: 'assets/towers/geodude.png',
  abra: 'assets/towers/abra.png',
  snorlax: 'assets/towers/snorlax.png',
};

// ===== 발사체 클래스 =====
class Projectile {
  constructor(x, y, target, opts) {
    this.x = x; this.y = y;
    this.target = target;
    this.speed = opts.speed || 400;
    this.damage = opts.damage || 10;
    this.color = opts.color || '#fff';
    this.size = opts.size || 5;
    this.dmgType = opts.dmgType || 'physical';
    this.piercing = !!opts.piercing;          // 관통 (화염방사)
    this.pierceWidth = opts.pierceWidth || 0;
    this.splash = opts.splash || 0;           // 범위 데미지 반경
    this.status = opts.status || null;        // {type, duration, factor}
    this.knockback = opts.knockback || 0;     // 넉백 거리
    this.chain = opts.chain || 0;             // 체인 횟수 (전기)
    this.chainRange = opts.chainRange || 120;
    this.onHit = opts.onHit || null;
    this.engine = opts.engine;
    this.done = false;
    this.trail = [];
    this.emoji = opts.emoji || null;
    this.beam = !!opts.beam;                  // 즉시 직선 빔 (사이킥/태양광선 등)
    this.beamLife = opts.beamLife || 0.15;
    this.life = 0;

    if (this.beam && target) {
      this.bx1 = x; this.by1 = y;
      this.bx2 = target.x; this.by2 = target.y;
    }
  }

  update(dt) {
    if (this.beam) {
      this.life += dt;
      if (this.life >= this.beamLife) this.done = true;
      return;
    }

    if (!this.target || this.target.dead || this.target.reachedEnd) {
      // 타겟 사라지면 직진 후 소멸 (피어싱이면 계속)
      if (!this.piercing) { this.done = true; return; }
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    let tx, ty;
    if (this.target && !this.target.dead && !this.target.reachedEnd) {
      tx = this.target.x; ty = this.target.y;
    } else {
      tx = this.x + (this.vx || 0) * 10;
      ty = this.y + (this.vy || 0) * 10;
    }

    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    this.vx = dist > 0 ? dx / dist : 0;
    this.vy = dist > 0 ? dy / dist : 0;

    const moveDist = this.speed * dt;

    if (!this.piercing && this.target && dist <= moveDist) {
      this.x = tx; this.y = ty;
      this.hit(this.target);
      this.done = true;
      return;
    }

    this.x += this.vx * moveDist;
    this.y += this.vy * moveDist;

    // 피어싱: 경로상의 모든 적과 충돌 체크
    if (this.piercing && this.engine) {
      for (const e of this.engine.enemies) {
        if (e.dead || e.reachedEnd) continue;
        if (e._hitByProj === this) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < (this.pierceWidth || 24)) {
          e._hitByProj = this;
          this.hit(e);
        }
      }
      // 화면 밖 나가면 소멸
      if (this.x < -50 || this.x > this.engine.width + 50 ||
          this.y < -50 || this.y > this.engine.height + 50) {
        this.done = true;
      }
    }
  }

  hit(enemy) {
    if (!enemy || enemy.dead) return;
    enemy.takeDamage(this.damage, this.dmgType);

    if (this.status) {
      enemy.applyStatus(this.status.type, this.status.duration, this.status.factor);
    }

    if (this.knockback > 0) {
      enemy.distTraveled = Math.max(0, enemy.distTraveled - this.knockback);
    }

    if (this.splash > 0 && this.engine) {
      for (const e of this.engine.enemies) {
        if (e === enemy || e.dead || e.reachedEnd) continue;
        const d = Math.hypot(e.x - enemy.x, e.y - enemy.y);
        if (d < this.splash) {
          e.takeDamage(this.damage * 0.6, this.dmgType);
          if (this.status) e.applyStatus(this.status.type, this.status.duration * 0.6, this.status.factor);
        }
      }
      this.engine.spawnHitParticle(enemy.x, enemy.y, this.color);
    }

    // 체인 (전기)
    if (this.chain > 0 && this.engine) {
      this.doChain(enemy, this.chain);
    }

    this.engine && this.engine.spawnHitParticle(enemy.x, enemy.y, this.color);
    this.onHit && this.onHit(enemy);
  }

  doChain(fromEnemy, remaining) {
    if (remaining <= 0) return;
    let nearest = null, bestD = this.chainRange;
    for (const e of this.engine.enemies) {
      if (e === fromEnemy || e.dead || e.reachedEnd || e._chainedBy === this) continue;
      const d = Math.hypot(e.x - fromEnemy.x, e.y - fromEnemy.y);
      if (d < bestD) { bestD = d; nearest = e; }
    }
    if (!nearest) return;
    nearest._chainedBy = this;
    this.engine.particles.push(new ChainBolt(fromEnemy.x, fromEnemy.y, nearest.x, nearest.y));
    nearest.takeDamage(this.damage * 0.7, this.dmgType);
    if (this.status) nearest.applyStatus(this.status.type, this.status.duration, this.status.factor);
    this.doChain(nearest, remaining - 1);
  }

  draw(ctx) {
    if (this.beam) {
      const alpha = 1 - this.life / this.beamLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(this.bx1, this.by1);
      ctx.lineTo(this.bx2, this.by2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // 트레일
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      ctx.save();
      ctx.globalAlpha = (i / this.trail.length) * 0.35;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (this.emoji) {
      ctx.font = `${this.size * 2.2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.emoji, this.x, this.y);
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 전기 체인 비주얼
class ChainBolt {
  constructor(x1, y1, x2, y2) {
    this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
    this.life = 0; this.maxLife = 0.2; this.dead = false;
  }
  update(dt) {
    this.life += dt;
    if (this.life >= this.maxLife) this.dead = true;
  }
  draw(ctx) {
    const alpha = 1 - this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffeb3b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    // 지그재그
    const segs = 4;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const mx = this.x1 + (this.x2 - this.x1) * t + (Math.random() - 0.5) * 14;
      const my = this.y1 + (this.y2 - this.y1) * t + (Math.random() - 0.5) * 14;
      ctx.lineTo(i === segs ? this.x2 : mx, i === segs ? this.y2 : my);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// 범위 폭발/지진 비주얼
class AoeBurst {
  constructor(x, y, radius, color) {
    this.x = x; this.y = y; this.maxR = radius; this.color = color;
    this.life = 0; this.maxLife = 0.35; this.dead = false;
  }
  update(dt) {
    this.life += dt;
    if (this.life >= this.maxLife) this.dead = true;
  }
  draw(ctx) {
    const t = this.life / this.maxLife;
    const r = this.maxR * t;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.6;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - t) * 0.15;
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

// ===== 타워 베이스 클래스 =====
class TowerBase {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.level = 1;
    this.target = null;
    this.cooldown = 0;
    this.angle = 0;
    this.totalSpent = this.cost;
    this.fireFlash = 0;
    this.buffRangeMul = 1;   // 뮤 패시브용
    this.buffDmgMul = 1;     // 영웅 버프용
  }

  get stats() { return this.def.levels[this.level - 1]; }
  get cost() { return this.def.levels[0].cost; }
  get range() { return this.stats.range * this.buffRangeMul; }
  get damage() { return this.stats.damage * this.buffDmgMul; }
  get fireRate() { return this.stats.fireRate; }
  get name() { return `${this.def.name} Lv${this.level}`; }
  get maxLevel() { return this.def.levels.length; }

  upgradeCost() {
    if (this.level >= this.maxLevel) return null;
    return this.def.levels[this.level].cost;
  }

  upgrade(engine) {
    const cost = this.upgradeCost();
    if (cost === null) return false;
    if (!engine.spendGold(cost)) return false;
    this.level++;
    this.totalSpent += cost;
    engine.spawnFloatingText(`⬆ Lv${this.level}`, this.x, this.y - 30, '#ffd60a');
    return true;
  }

  findTarget(enemies) {
    // 기존 타겟 유효하면 유지 (range 안에 있으면)
    if (this.target && !this.target.dead && !this.target.reachedEnd) {
      const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (d <= this.range) return this.target;
    }
    // 가장 진행도 높은 (출구에 가까운) 적 우선
    let best = null, bestProgress = -1;
    for (const e of enemies) {
      if (e.dead || e.reachedEnd) continue;
      if (e.def.special === 'flying' && this.def.groundOnly) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d > this.range) continue;
      const progress = e.distTraveled;
      if (progress > bestProgress) { bestProgress = progress; best = e; }
    }
    return best;
  }

  update(dt, enemies, engine) {
    this.engine = engine;
    this.cooldown -= dt;
    if (this.fireFlash > 0) this.fireFlash -= dt;

    this.target = this.findTarget(enemies);
    if (this.target) {
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      this.angle = Math.atan2(dy, dx);
    }

    if (this.target && this.cooldown <= 0) {
      this.cooldown = 1 / this.fireRate;
      this.fireFlash = 0.08;
      this.fire(engine);
    }
  }

  fire(engine) {
    // 서브클래스에서 구현
  }

  draw(ctx) {
    ctx.save();
    // 베이스 패드
    ctx.beginPath();
    ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.strokeStyle = this.def.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 레벨 점
    for (let i = 0; i < this.level; i++) {
      ctx.beginPath();
      ctx.arc(this.x - 10 + i * 10, this.y + 26, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = this.def.color;
      ctx.fill();
    }

    // 발사 플래시
    if (this.fireFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.fireFlash / 0.08 * 0.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = this.def.color;
      ctx.fill();
      ctx.restore();
    }

    // 캐릭터 이미지 (레벨에 따라 살짝 확대 + 강화 시 반짝임)
    const imgPath = TowerSpriteImages[this.def.id];
    const img = imgPath ? window.loadSpriteImage(imgPath) : null;
    const charSize = 34 + (this.level - 1) * 4;

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(this.x, this.y);
      // 발사 시 살짝 펄스
      const pulse = this.fireFlash > 0 ? 1 + (this.fireFlash / 0.08) * 0.08 : 1;
      ctx.scale(pulse, pulse);
      ctx.drawImage(img, -charSize / 2, -charSize / 2, charSize, charSize);
      ctx.restore();
    } else {
      // 이미지 없음/로딩중 폴백: 이모지
      const emoji = this.def.evolutions[this.level - 1];
      ctx.font = '26px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, this.x, this.y);
    }
    ctx.restore();
  }
}

// ===== 타워 정의 헬퍼 =====
function makeTower(def) {
  return class extends TowerBase {
    constructor(x, y) {
      super(x, y);
      this.def = def;
    }
    fire(engine) {
      def.fire(this, engine);
    }
  };
}

// ===== 1. 이상해씨 계열 - 독 DoT / 태양광선 범위 =====
const BulbasaurTower = makeTower({
  id: 'bulbasaur', name: '이상해씨', color: '#4caf50',
  evolutions: ['🌱', '🌿', '🌳'],
  groundOnly: false,
  levels: [
    { cost: 60,  damage: 8,  range: 110, fireRate: 1.2, poisonDmg: 5,  poisonDur: 3 },
    { cost: 90,  damage: 14, range: 130, fireRate: 1.3, poisonDmg: 9,  poisonDur: 3.5 },
    { cost: 160, damage: 24, range: 155, fireRate: 1.5, poisonDmg: 16, poisonDur: 4, splash: 50 },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 320, damage: t.damage, color: '#7cb342', size: 6,
      dmgType: 'special', emoji: '🍃',
      status: { type: 'poison', duration: s.poisonDur, factor: s.poisonDmg },
      splash: s.splash || 0,
    });
    engine.projectiles.push(p);
    // Lv3: 태양광선 - 주기적으로 범위 전체 적에게 추가 데미지
    if (t.level >= 3) {
      t._sunbeamTimer = (t._sunbeamTimer || 0) + 1;
      if (t._sunbeamTimer >= 4) {
        t._sunbeamTimer = 0;
        for (const e of engine.enemies) {
          if (e.dead || e.reachedEnd) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) <= t.range) {
            e.takeDamage(t.damage * 1.5, 'special');
          }
        }
        engine.particles.push(new AoeBurst(t.x, t.y, t.range, '#aed581'));
        engine.spawnFloatingText('☀️ 태양광선!', t.x, t.y - 36, '#cddc39');
      }
    }
  }
});

// ===== 2. 파이리 계열 - 화염방사 관통 / 불대문자 폭발 =====
const CharmanderTower = makeTower({
  id: 'charmander', name: '파이리', color: '#ff5722',
  evolutions: ['🦎', '🔥', '🐉'],
  groundOnly: false,
  levels: [
    { cost: 70,  damage: 6,  range: 100, fireRate: 4, burnDmg: 4, burnDur: 2 },
    { cost: 110, damage: 9,  range: 115, fireRate: 5, burnDmg: 7, burnDur: 2.5 },
    { cost: 190, damage: 15, range: 135, fireRate: 6, burnDmg: 12, burnDur: 3, explodeChance: 0.25 },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 500, damage: t.damage, color: '#ff7043', size: 5,
      dmgType: 'special', emoji: '🔥', piercing: true, pierceWidth: 26,
      status: { type: 'burn', duration: s.burnDur, factor: s.burnDmg },
      onHit: (enemy) => {
        if (t.level >= 3 && Math.random() < s.explodeChance) {
          engine.particles.push(new AoeBurst(enemy.x, enemy.y, 55, '#ff6f00'));
          for (const e2 of engine.enemies) {
            if (e2.dead || e2.reachedEnd) continue;
            if (Math.hypot(e2.x - enemy.x, e2.y - enemy.y) < 55) {
              e2.takeDamage(t.damage * 1.2, 'special');
            }
          }
          engine.spawnFloatingText('💥 불대문자!', enemy.x, enemy.y - 20, '#ff6f00');
        }
      }
    });
    engine.projectiles.push(p);
  }
});

// ===== 3. 꼬부기 계열 - 물대포 슬로우 / 하이드로펌프 넉백 =====
const SquirtleTower = makeTower({
  id: 'squirtle', name: '꼬부기', color: '#29b6f6',
  evolutions: ['🐢', '💧', '🌊'],
  groundOnly: false,
  levels: [
    { cost: 65,  damage: 10, range: 105, fireRate: 1.0, slowFactor: 0.7, slowDur: 1.5 },
    { cost: 100, damage: 17, range: 120, fireRate: 1.1, slowFactor: 0.55, slowDur: 2 },
    { cost: 175, damage: 28, range: 140, fireRate: 1.3, slowFactor: 0.4, slowDur: 2.5, knockback: 30 },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 360, damage: t.damage, color: '#4fc3f7', size: 7,
      dmgType: 'physical', emoji: '💧',
      status: { type: 'slow', duration: s.slowDur, factor: s.slowFactor },
      knockback: s.knockback || 0,
    });
    engine.projectiles.push(p);
  }
});

// ===== 4. 코일 계열 - 전기충격 스턴 / 번개 체인 =====
const VoltorbTower = makeTower({
  id: 'voltorb', name: '코일', color: '#ffd600',
  evolutions: ['🔵', '⚡', '🌟'],
  groundOnly: false,
  levels: [
    { cost: 75,  damage: 12, range: 100, fireRate: 1.3, stunDur: 0.4, chain: 0 },
    { cost: 115, damage: 20, range: 115, fireRate: 1.4, stunDur: 0.6, chain: 1 },
    { cost: 200, damage: 32, range: 130, fireRate: 1.6, stunDur: 0.8, chain: 3 },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 600, damage: t.damage, color: '#ffeb3b', size: 5,
      dmgType: 'special', emoji: '⚡',
      status: { type: 'stun', duration: s.stunDur },
      chain: s.chain, chainRange: 130,
    });
    engine.projectiles.push(p);
  }
});

// ===== 5. 쥬쥬 계열 - 냉동빔 / 눈보라 전체슬로우 =====
const JigglypuffIceTower = makeTower({
  id: 'jynxline', name: '쥬쥬', color: '#80deea',
  evolutions: ['🎵', '❄️', '🧊'],
  groundOnly: false,
  levels: [
    { cost: 70,  damage: 9,  range: 110, fireRate: 1.1, freezeDur: 0.6 },
    { cost: 110, damage: 15, range: 125, fireRate: 1.2, freezeDur: 0.9 },
    { cost: 185, damage: 24, range: 145, fireRate: 1.3, freezeDur: 1.2, blizzard: true },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 420, damage: t.damage, color: '#80deea', size: 6,
      dmgType: 'special', emoji: '❄️',
      status: { type: 'freeze', duration: s.freezeDur },
    });
    engine.projectiles.push(p);
    // Lv3: 눈보라 - 주기적으로 사거리 내 전체 슬로우
    if (t.level >= 3) {
      t._blizzardTimer = (t._blizzardTimer || 0) + 1 / t.fireRate;
      if (t._blizzardTimer >= 5) {
        t._blizzardTimer = 0;
        for (const e of engine.enemies) {
          if (e.dead || e.reachedEnd) continue;
          if (Math.hypot(e.x - t.x, e.y - t.y) <= t.range) {
            e.applyStatus('slow', 2, 0.5);
          }
        }
        engine.particles.push(new AoeBurst(t.x, t.y, t.range, '#b3e5fc'));
        engine.spawnFloatingText('🌨️ 눈보라!', t.x, t.y - 36, '#80deea');
      }
    }
  }
});

// ===== 6. 꼬마돌 계열 - 돌던지기 스턴 / 지진 범위 =====
const GeodudeTower = makeTower({
  id: 'geodude', name: '꼬마돌', color: '#8d6e63',
  evolutions: ['🪨', '⛰️', '🗿'],
  groundOnly: true, // 비행 무시 불가
  levels: [
    { cost: 65,  damage: 16, range: 95,  fireRate: 0.9, stunDur: 0.3, splash: 0 },
    { cost: 105, damage: 26, range: 105, fireRate: 1.0, stunDur: 0.5, splash: 40 },
    { cost: 180, damage: 42, range: 120, fireRate: 1.1, stunDur: 0.7, splash: 70 },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 380, damage: t.damage, color: '#a1887f', size: 7,
      dmgType: 'physical', emoji: '🪨',
      status: { type: 'stun', duration: s.stunDur },
      splash: s.splash,
      onHit: (enemy) => {
        if (t.level >= 3) {
          engine.particles.push(new AoeBurst(enemy.x, enemy.y, s.splash, '#6d4c41'));
        }
      }
    });
    engine.projectiles.push(p);
  }
});

// ===== 7. 케이시 계열 - 사이킥 슬로우 / 염동력 (다중 타겟) =====
const AbraTower = makeTower({
  id: 'abra', name: '케이시', color: '#ba68c8',
  evolutions: ['🔮', '🧠', '✨'],
  groundOnly: false,
  levels: [
    { cost: 80,  damage: 11, range: 120, fireRate: 1.2, slowFactor: 0.65, slowDur: 1.5, targets: 1 },
    { cost: 125, damage: 18, range: 140, fireRate: 1.3, slowFactor: 0.5, slowDur: 2, targets: 2 },
    { cost: 210, damage: 30, range: 165, fireRate: 1.4, slowFactor: 0.4, slowDur: 2.5, targets: 3 },
  ],
  fire(t, engine) {
    const s = t.stats;
    // 염동력: 여러 타겟에 동시 빔
    const targets = [];
    const sorted = engine.enemies
      .filter(e => !e.dead && !e.reachedEnd && Math.hypot(e.x - t.x, e.y - t.y) <= t.range)
      .sort((a, b) => b.distTraveled - a.distTraveled);
    for (let i = 0; i < Math.min(s.targets, sorted.length); i++) targets.push(sorted[i]);

    for (const target of targets) {
      engine.projectiles.push(new Projectile(t.x, t.y, target, {
        engine, color: '#ce93d8', size: 4, beam: true, beamLife: 0.15,
      }));
      target.takeDamage(t.damage, 'special');
      target.applyStatus('slow', s.slowDur, s.slowFactor);
      engine.spawnHitParticle(target.x, target.y, '#ba68c8');
    }
  }
});

// ===== 8. 잠만보 - 탱커형 (적 차단) / 하품 스턴 / 저주 =====
const SnorlaxTower = makeTower({
  id: 'snorlax', name: '잠만보', color: '#9575cd',
  evolutions: ['😴', '😪', '👹'],
  groundOnly: true,
  levels: [
    { cost: 100, damage: 14, range: 90,  fireRate: 0.8, yawnDur: 1.0, curseDmg: 1.0 },
    { cost: 150, damage: 24, range: 100, fireRate: 0.9, yawnDur: 1.5, curseDmg: 1.3 },
    { cost: 240, damage: 40, range: 115, fireRate: 1.0, yawnDur: 2.0, curseDmg: 1.6 },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed: 300, damage: t.damage * s.curseDmg, color: '#7e57c2', size: 8,
      dmgType: 'special', emoji: '💤',
      status: { type: 'stun', duration: s.yawnDur },
    });
    engine.projectiles.push(p);
  }
});

// ===== 타워 메타데이터 (상점/배치 UI용) =====
const TowerMeta = [
  { key: 'bulbasaur', cls: BulbasaurTower, name: '이상해씨', emoji: '🌱', cost: 60, desc: '독 DoT + 태양광선' },
  { key: 'charmander', cls: CharmanderTower, name: '파이리', emoji: '🦎', cost: 70, desc: '관통 화염 + 폭발' },
  { key: 'squirtle', cls: SquirtleTower, name: '꼬부기', emoji: '🐢', cost: 65, desc: '슬로우 + 넉백' },
  { key: 'voltorb', cls: VoltorbTower, name: '코일', emoji: '🔵', cost: 75, desc: '스턴 + 체인 번개' },
  { key: 'jynxline', cls: JigglypuffIceTower, name: '쥬쥬', emoji: '🎵', cost: 70, desc: '빙결 + 눈보라' },
  { key: 'geodude', cls: GeodudeTower, name: '꼬마돌', emoji: '🪨', cost: 65, desc: '스턴 + 지진 범위' },
  { key: 'abra', cls: AbraTower, name: '케이시', emoji: '🔮', cost: 80, desc: '다중 슬로우 염동력' },
  { key: 'snorlax', cls: SnorlaxTower, name: '잠만보', emoji: '😴', cost: 100, desc: '하품 스턴 + 저주' },
];

// ===== 전역 등록 =====
window.TowerRegistry = {};
for (const m of TowerMeta) {
  window.TowerRegistry[m.key] = m.cls;
}
window.TowerMeta = TowerMeta;
