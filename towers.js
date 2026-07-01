// ===== TOWERS.JS - 타워 8계열 + 2갈래 업그레이드 분기 + 시너지 시스템 =====
// BTD6 크로스패스 방식 참고: Lv2에서 A/B 경로 선택, 완전히 다른 특성으로 분기

// ===== 이미지 맵 =====
const TowerSpriteImages = {
  bulbasaur:'assets/towers/bulbasaur.png', charmander:'assets/towers/charmander.png',
  squirtle:'assets/towers/squirtle.png',   voltorb:'assets/towers/voltorb.png',
  jynxline:'assets/towers/jynxline.png',   geodude:'assets/towers/geodude.png',
  abra:'assets/towers/abra.png',           snorlax:'assets/towers/snorlax.png',
};

// ===== 발사체 =====
class Projectile {
  constructor(x, y, target, opts) {
    this.x = x; this.y = y; this.target = target;
    this.speed = opts.speed || 420;
    this.damage = opts.damage || 10;
    this.color = opts.color || '#fff';
    this.size = opts.size || 5;
    this.dmgType = opts.dmgType || 'physical';
    this.piercing = !!opts.piercing;
    this.pierceWidth = opts.pierceWidth || 28;
    this.splash = opts.splash || 0;
    this.status = opts.status || null;
    this.knockback = opts.knockback || 0;
    this.chain = opts.chain || 0;
    this.chainRange = opts.chainRange || 140;
    this.onHit = opts.onHit || null;
    this.engine = opts.engine;
    this.done = false;
    this.trail = [];
    this.emoji = opts.emoji || null;
    this.beam = !!opts.beam;
    this.beamLife = opts.beamLife || 0.15;
    this.life = 0;
    this.vx = 0; this.vy = 0;

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
      if (!this.piercing) { this.done = true; return; }
    }
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();

    let tx, ty;
    if (this.target && !this.target.dead && !this.target.reachedEnd) {
      tx = this.target.x; ty = this.target.y;
    } else {
      tx = this.x + this.vx * 10; ty = this.y + this.vy * 10;
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

    if (this.piercing && this.engine) {
      for (const e of this.engine.enemies) {
        if (e.dead || e.reachedEnd || e._hitByProj === this) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) < this.pierceWidth) {
          e._hitByProj = this;
          this.hit(e);
        }
      }
      if (this.x < -100 || this.x > this.engine.width + 100 ||
          this.y < -100 || this.y > this.engine.height + 100) this.done = true;
    }
  }

  hit(enemy) {
    if (!enemy || enemy.dead) return;
    enemy.takeDamage(this.damage, this.dmgType);
    if (this.status) enemy.applyStatus(this.status.type, this.status.duration, this.status.factor);
    if (this.knockback > 0) enemy.distTraveled = Math.max(0, enemy.distTraveled - this.knockback);
    if (this.splash > 0 && this.engine) {
      for (const e of this.engine.enemies) {
        if (e === enemy || e.dead || e.reachedEnd) continue;
        if (Math.hypot(e.x - enemy.x, e.y - enemy.y) < this.splash) {
          e.takeDamage(this.damage * 0.6, this.dmgType);
          if (this.status) e.applyStatus(this.status.type, this.status.duration * 0.6, this.status.factor);
        }
      }
      this.engine && this.engine.particles.push(new BurstRing(enemy.x, enemy.y, this.splash, this.color));
    }
    if (this.chain > 0 && this.engine) this._doChain(enemy, this.chain);
    this.engine && this.engine.spawnHitParticle(enemy.x, enemy.y, this.color);
    this.onHit && this.onHit(enemy);
  }

  _doChain(from, rem) {
    if (rem <= 0) return;
    let nearest = null, bestD = this.chainRange;
    for (const e of this.engine.enemies) {
      if (e === from || e.dead || e.reachedEnd || e._chainedBy === this) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < bestD) { bestD = d; nearest = e; }
    }
    if (!nearest) return;
    nearest._chainedBy = this;
    this.engine.particles.push(new ChainBolt(from.x, from.y, nearest.x, nearest.y));
    nearest.takeDamage(this.damage * 0.7, this.dmgType);
    if (this.status) nearest.applyStatus(this.status.type, this.status.duration, this.status.factor);
    this._doChain(nearest, rem - 1);
  }

  draw(ctx) {
    if (this.beam) {
      const alpha = 1 - this.life / this.beamLife;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 14;
      ctx.lineCap = 'round';
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
      const a = (i / this.trail.length) * 0.3;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    if (this.emoji) {
      ctx.font = `${this.size * 2.4}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.emoji, this.x, this.y);
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ===== 비주얼 이펙트 =====
class ChainBolt {
  constructor(x1,y1,x2,y2) {
    this.x1=x1;this.y1=y1;this.x2=x2;this.y2=y2;
    this.life=0;this.maxLife=0.22;this.dead=false;
    this.segs = Array.from({length:5},(_,i)=>({
      t:(i+1)/6,ox:(Math.random()-0.5)*18,oy:(Math.random()-0.5)*18
    }));
  }
  update(dt){this.life+=dt;if(this.life>=this.maxLife)this.dead=true;}
  draw(ctx){
    const alpha=1-this.life/this.maxLife;
    ctx.save();ctx.globalAlpha=Math.max(0,alpha);
    ctx.strokeStyle='#ffeb3b';ctx.lineWidth=2.5;
    ctx.shadowColor='#fff176';ctx.shadowBlur=12;
    ctx.beginPath();ctx.moveTo(this.x1,this.y1);
    for(const s of this.segs){
      ctx.lineTo(this.x1+(this.x2-this.x1)*s.t+s.ox,
                 this.y1+(this.y2-this.y1)*s.t+s.oy);
    }
    ctx.lineTo(this.x2,this.y2);ctx.stroke();ctx.restore();
  }
}

class AoeBurst {
  constructor(x,y,radius,color){
    this.x=x;this.y=y;this.maxR=radius;this.color=color;
    this.life=0;this.maxLife=0.4;this.dead=false;
  }
  update(dt){this.life+=dt;if(this.life>=this.maxLife)this.dead=true;}
  draw(ctx){
    const t=this.life/this.maxLife,r=this.maxR*t;
    ctx.save();
    ctx.globalAlpha=(1-t)*0.65;
    ctx.strokeStyle=this.color;ctx.lineWidth=3*(1-t)+1;
    ctx.shadowColor=this.color;ctx.shadowBlur=12;
    ctx.beginPath();ctx.arc(this.x,this.y,r,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=(1-t)*0.12;
    ctx.fillStyle=this.color;ctx.fill();
    ctx.restore();
  }
}

// ===== 타워 베이스 =====
class TowerBase {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.level = 1;
    this.path = null;   // null | 'A' | 'B' — Lv2 분기
    this.target = null;
    this.cooldown = 0;
    this.angle = 0;
    this.fireFlash = 0;
    this.buffRangeMul = 1;
    this.buffDmgMul = 1;
    this.synergyBonus = 0;    // 인접 시너지 보너스
    this._rotAngle = 0;       // Lv3 회전 오라
  }

  get stats() {
    const lv = this.def.levels[this.level - 1];
    if (!lv) return this.def.levels[this.def.levels.length - 1];
    // 분기 오버라이드
    if (this.path && lv.paths && lv.paths[this.path]) {
      return { ...lv, ...lv.paths[this.path] };
    }
    return lv;
  }
  get cost() { return this.def.levels[0].cost; }
  get range() { return this.stats.range * this.buffRangeMul; }
  get damage() { return (this.stats.damage + this.synergyBonus) * this.buffDmgMul; }
  get fireRate() { return this.stats.fireRate; }
  get name() { return `${this.def.name}${this.path ? ` [${this.path}]` : ''} Lv${this.level}`; }
  get maxLevel() { return this.def.levels.length; }

  upgradeCost() {
    if (this.level >= this.maxLevel) return null;
    const next = this.def.levels[this.level];
    return next ? next.cost : null;
  }
  upgrade(engine) {
    const cost = this.upgradeCost();
    if (cost === null) return false;
    if (!engine.spendGold(cost)) return false;
    this.totalSpent += cost;
    this.level++;
    engine.spawnFloatingText(`⬆ ${this.name}`, this.x, this.y - 32, '#ffd60a');
    engine.particles.push(new AoeBurst(this.x, this.y, 40, '#ffd60a'));
    return true;
  }
  // 경로 선택 (Lv2에서 A 또는 B)
  choosePath(pathKey, engine) {
    if (this.level < 2 || this.path !== null) return false;
    this.path = pathKey;
    const desc = this.def.pathDesc ? this.def.pathDesc[pathKey] : pathKey;
    engine.spawnFloatingText(`✨ ${desc}`, this.x, this.y - 36, '#c084fc');
    engine.particles.push(new AoeBurst(this.x, this.y, 50, '#c084fc'));
    return true;
  }

  findTarget(enemies) {
    if (this.target && !this.target.dead && !this.target.reachedEnd) {
      const d = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (d <= this.range) return this.target;
    }
    let best = null, bestProgress = -1;
    for (const e of enemies) {
      if (e.dead || e.reachedEnd) continue;
      if (e.def.special === 'flying' && this.def.groundOnly) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d > this.range) continue;
      if (e.distTraveled > bestProgress) { bestProgress = e.distTraveled; best = e; }
    }
    return best;
  }

  update(dt, enemies, engine) {
    this.engine = engine;
    this.cooldown -= dt;
    if (this.fireFlash > 0) this.fireFlash -= dt;
    this._rotAngle += dt * (this.level >= 3 ? 1.2 : 0.4);

    this.target = this.findTarget(enemies);
    if (this.target) {
      this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    }
    if (this.target && this.cooldown <= 0) {
      this.cooldown = 1 / this.fireRate;
      this.fireFlash = 0.1;
      this.fire(engine);
    }
  }

  fire(engine) {}

  draw(ctx) {
    const s = this;

    // 시너지 링
    if (s.synergyBonus > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 28, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,214,10,${0.3 + Math.sin(s._rotAngle * 2) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Lv3: 회전 오라 파티클
    if (s.level >= 3) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s._rotAngle);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const ox = Math.cos(a) * 24, oy = Math.sin(a) * 24;
        ctx.beginPath();
        ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = s.def.color + 'cc';
        ctx.shadowColor = s.def.color;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }

    // 베이스 패드
    ctx.save();
    ctx.beginPath();
    ctx.arc(s.x, s.y, 22, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(s.x, s.y-5, 2, s.x, s.y, 22);
    grad.addColorStop(0, 'rgba(60,60,80,0.7)');
    grad.addColorStop(1, 'rgba(20,20,35,0.7)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = s.def.color + '88';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 캐릭터 이미지
    const imgPath = TowerSpriteImages[s.def.id];
    const img = imgPath ? window.loadSpriteImage(imgPath) : null;
    const charSize = 32 + (s.level - 1) * 3;
    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
      const pulse = s.fireFlash > 0 ? 1 + (s.fireFlash / 0.1) * 0.1 : 1;
      ctx.translate(s.x, s.y);
      ctx.scale(pulse, pulse);
      ctx.drawImage(img, -charSize/2, -charSize/2, charSize, charSize);
    } else {
      const emoji = s.def.evolutions[Math.min(s.level - 1, s.def.evolutions.length - 1)];
      ctx.font = '24px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, s.x, s.y);
    }
    ctx.restore();

    // 발사 플래시
    if (s.fireFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (s.fireFlash / 0.1) * 0.35;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = s.def.color;
      ctx.fill();
      ctx.restore();
    }

    // 레벨 점 + 경로 뱃지
    ctx.save();
    for (let i = 0; i < s.level; i++) {
      ctx.beginPath();
      ctx.arc(s.x - (s.level - 1) * 5 + i * 10, s.y + 27, 3, 0, Math.PI * 2);
      ctx.fillStyle = s.def.color;
      ctx.shadowColor = s.def.color;
      ctx.shadowBlur = 4;
      ctx.fill();
    }
    if (s.path) {
      ctx.font = 'bold 9px -apple-system, sans-serif';
      ctx.fillStyle = s.path === 'A' ? '#4cc9f0' : '#f48fb1';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 0;
      ctx.fillText(s.path, s.x + 20, s.y - 20);
    }
    ctx.restore();
  }
}

function makeTower(def) {
  return class extends TowerBase {
    constructor(x, y) {
      super(x, y);
      this.def = def;
      this.totalSpent = this.cost;
    }
    fire(engine) { def.fire(this, engine); }
  };
}

// ===== 시너지 시스템 =====
// 타워 배치/업그레이드 시 인접 타워(반경 120px)와 특정 조합 체크
const SynergyRules = [
  // [타워A, 타워B, A보너스, B보너스, 설명]
  ['bulbasaur', 'voltorb',   6, 6,  '전기독 시너지'],
  ['charmander','bulbasaur', 5, 5,  '불꽃+자연 시너지'],
  ['squirtle',  'geodude',   4, 8,  '물+암석 시너지'],
  ['voltorb',   'abra',      7, 5,  '전기+사이킥 시너지'],
  ['jynxline',  'squirtle',  6, 6,  '얼음+물 시너지'],
  ['snorlax',   'charmander',4, 6,  '불꽃 분노 시너지'],
];

function applyTowerSynergies(towers) {
  // 모든 시너지 초기화
  for (const t of towers) t.synergyBonus = 0;
  // 인접 체크
  for (let i = 0; i < towers.length; i++) {
    for (let j = i + 1; j < towers.length; j++) {
      const a = towers[i], b = towers[j];
      if (!a.def || !b.def) continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 150) continue;
      for (const [idA, idB, bonA, bonB, desc] of SynergyRules) {
        if (a.def.id === idA && b.def.id === idB) {
          a.synergyBonus += bonA; b.synergyBonus += bonB;
        } else if (a.def.id === idB && b.def.id === idA) {
          a.synergyBonus += bonB; b.synergyBonus += bonA;
        }
      }
    }
  }
}

// ===== 1. 이상해씨 계열 =====
// 경로A: 독 전문 (맹독 + 포자 구름)  경로B: 태양 전문 (태양광선 + 성장 회복)
const BulbasaurTower = makeTower({
  id:'bulbasaur', name:'이상해씨', color:'#66bb6a',
  evolutions:['🌱','🌿','🌳'],
  pathDesc:{A:'맹독사', B:'태양계'},
  levels:[
    { cost:60,  damage:10, range:185, fireRate:1.2, poisonDmg:6,  poisonDur:3   },
    { cost:90,  damage:16, range:210, fireRate:1.3, poisonDmg:10, poisonDur:3.5,
      paths:{
        A:{ damage:14, poisonDmg:16, poisonDur:5, statusUpgrade:'venom' },
        B:{ damage:20, range:240,    fireRate:1.0, sunbeam:true  },
      }
    },
    { cost:160, damage:26, range:240, fireRate:1.4, poisonDmg:18, poisonDur:4, splash:55,
      paths:{
        A:{ poisonDmg:28, poisonDur:6, splash:0, sporeSlow:true },
        B:{ damage:42, range:280, sunbeam:true, sunbeamInterval:3 },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed:340, damage:t.damage, color:'#8bc34a', size:6,
      dmgType:'special', emoji:'🍃',
      status:{type:'poison', duration: s.venom ? s.poisonDur : s.poisonDur, factor: s.venom ? s.poisonDmg * 1.5 : s.poisonDmg},
      splash: s.splash || 0,
    });
    engine.projectiles.push(p);

    if (s.sunbeam) {
      t._sunTimer = (t._sunTimer||0) + 1/t.fireRate;
      if (t._sunTimer >= (s.sunbeamInterval||5)) {
        t._sunTimer = 0;
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-t.x,e.y-t.y) <= t.range) e.takeDamage(t.damage*1.8,'special');
        }
        engine.particles.push(new AoeBurst(t.x, t.y, t.range, '#cddc39'));
        engine.spawnFloatingText('☀️', t.x, t.y-38, '#cddc39');
      }
    }
  }
});

// ===== 2. 파이리 계열 =====
// 경로A: 화염방사(관통+DoT)  경로B: 폭발 전문(광역폭발+충격파)
const CharmanderTower = makeTower({
  id:'charmander', name:'파이리', color:'#ff5722',
  evolutions:['🦎','🔥','🐉'],
  pathDesc:{A:'화염방사', B:'불대문자'},
  levels:[
    { cost:70,  damage:8,  range:170, fireRate:4.0, burnDmg:5,  burnDur:2   },
    { cost:110, damage:12, range:195, fireRate:5.0, burnDmg:8,  burnDur:2.5,
      paths:{
        A:{ fireRate:7, piercing:true, burnDmg:10 },
        B:{ damage:20, splash:50, explodeChance:0.3 },
      }
    },
    { cost:190, damage:18, range:230, fireRate:6.0, burnDmg:14, burnDur:3, explodeChance:0.25,
      paths:{
        A:{ fireRate:10, burnDmg:22, piercing:true },
        B:{ damage:35, splash:80, explodeChance:0.55, shockwave:true },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    const p = new Projectile(t.x, t.y, t.target, {
      engine, speed:520, damage:t.damage, color:'#ff7043', size:5,
      dmgType:'special', emoji:'🔥',
      piercing: !!s.piercing, pierceWidth:28,
      status:{type:'burn', duration:s.burnDur, factor:s.burnDmg},
      splash: s.splash||0,
      onHit:(enemy)=>{
        if (s.explodeChance && Math.random() < s.explodeChance) {
          const r = (s.splash||0) + 45;
          engine.particles.push(new AoeBurst(enemy.x, enemy.y, r, '#ff6f00'));
          for (const e2 of engine.enemies) {
            if (e2.dead||e2.reachedEnd) continue;
            if (Math.hypot(e2.x-enemy.x,e2.y-enemy.y) < r) e2.takeDamage(t.damage*1.3,'special');
          }
          if (s.shockwave) {
            // 추가 충격파 (더 큰 범위, 스턴)
            for (const e2 of engine.enemies) {
              if (e2.dead||e2.reachedEnd) continue;
              if (Math.hypot(e2.x-enemy.x,e2.y-enemy.y) < r * 1.6) e2.applyStatus('stun',0.4);
            }
            engine.particles.push(new AoeBurst(enemy.x, enemy.y, r*1.6, '#ffcc02'));
          }
          engine.spawnFloatingText('💥', enemy.x, enemy.y-22, '#ff6f00');
        }
      }
    });
    engine.projectiles.push(p);
  }
});

// ===== 3. 꼬부기 계열 =====
// 경로A: 슬로우 전문(빙결+넉백)  경로B: 물대포(고데미지+관통)
const SquirtleTower = makeTower({
  id:'squirtle', name:'꼬부기', color:'#29b6f6',
  evolutions:['🐢','💧','🌊'],
  pathDesc:{A:'냉각 포', B:'수압포'},
  levels:[
    { cost:65,  damage:12, range:180, fireRate:1.0, slowFactor:0.70, slowDur:1.5 },
    { cost:100, damage:20, range:205, fireRate:1.1, slowFactor:0.55, slowDur:2.0,
      paths:{
        A:{ slowFactor:0.40, slowDur:3.0, knockback:25 },
        B:{ damage:32, fireRate:1.4, piercing:true },
      }
    },
    { cost:175, damage:32, range:240, fireRate:1.3, slowFactor:0.40, slowDur:2.5, knockback:35,
      paths:{
        A:{ slowFactor:0.25, slowDur:4.0, knockback:60, splash:55 },
        B:{ damage:55, piercing:true, splash:50, fireRate:1.6 },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    engine.projectiles.push(new Projectile(t.x, t.y, t.target, {
      engine, speed:380, damage:t.damage, color:'#4fc3f7', size:7,
      dmgType:'physical', emoji:'💧',
      piercing: !!s.piercing, pierceWidth:30,
      splash: s.splash||0,
      status:{type:'slow', duration:s.slowDur, factor:s.slowFactor},
      knockback: s.knockback||0,
    }));
  }
});

// ===== 4. 코일 계열 =====
// 경로A: 체인 번개(광역 체인)  경로B: EMP(광역 스턴 + 빙결)
const VoltorbTower = makeTower({
  id:'voltorb', name:'코일', color:'#ffd600',
  evolutions:['🔵','⚡','🌟'],
  pathDesc:{A:'체인 방전', B:'EMP 폭발'},
  levels:[
    { cost:75,  damage:15, range:170, fireRate:1.3, stunDur:0.4, chain:0 },
    { cost:115, damage:24, range:195, fireRate:1.4, stunDur:0.6, chain:1,
      paths:{
        A:{ chain:2, chainRange:160, chainDecay:0.8 },
        B:{ stunDur:1.2, empSplash:70 },
      }
    },
    { cost:200, damage:38, range:225, fireRate:1.6, stunDur:0.8, chain:3,
      paths:{
        A:{ chain:5, chainRange:200, damage:42 },
        B:{ stunDur:2.0, empSplash:120, freeze:true },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    if (s.empSplash) {
      // EMP: 발사체 없이 즉발 광역
      t._empTimer = (t._empTimer||0) + 1/t.fireRate;
      const interval = s.freeze ? 2.5 : 3.5;
      if (t._empTimer >= interval) {
        t._empTimer = 0;
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-t.x,e.y-t.y) <= s.empSplash) {
            e.takeDamage(t.damage, 'special');
            e.applyStatus(s.freeze ? 'freeze' : 'stun', s.stunDur, 0);
          }
        }
        engine.particles.push(new AoeBurst(t.x, t.y, s.empSplash, '#ffeb3b'));
        engine.spawnFloatingText('⚡EMP', t.x, t.y-36, '#ffeb3b');
        return;
      }
    }
    engine.projectiles.push(new Projectile(t.x, t.y, t.target, {
      engine, speed:620, damage:t.damage, color:'#ffeb3b', size:5,
      dmgType:'special', emoji:'⚡',
      status:{type:'stun', duration:s.stunDur},
      chain: s.chain, chainRange: s.chainRange||140,
    }));
  }
});

// ===== 5. 쥬쥬 계열 =====
// 경로A: 빙결 전문(냉동빔+분열)  경로B: 눈보라(광역 슬로우 지속)
const JigglypuffIceTower = makeTower({
  id:'jynxline', name:'쥬쥬', color:'#80deea',
  evolutions:['🎵','❄️','🧊'],
  pathDesc:{A:'냉동빔', B:'눈보라'},
  levels:[
    { cost:70,  damage:11, range:185, fireRate:1.1, freezeDur:0.7 },
    { cost:110, damage:18, range:215, fireRate:1.2, freezeDur:1.0,
      paths:{
        A:{ freezeDur:1.8, splitShot:2 },
        B:{ freezeDur:0.6, blizzardTick:true, aoeRange:120 },
      }
    },
    { cost:185, damage:28, range:250, fireRate:1.3, freezeDur:1.3,
      paths:{
        A:{ freezeDur:2.5, splitShot:3, damage:35 },
        B:{ blizzardTick:true, aoeRange:180, slowFactor:0.3, slowDur:3 },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    const shots = s.splitShot || 1;
    for (let si = 0; si < shots; si++) {
      const targets = [];
      if (si === 0) {
        targets.push(t.target);
      } else {
        // 추가 발사체는 다른 타겟을 찾음
        const sorted = engine.enemies
          .filter(e=>!e.dead&&!e.reachedEnd&&Math.hypot(e.x-t.x,e.y-t.y)<=t.range)
          .sort((a,b)=>b.distTraveled-a.distTraveled);
        if (sorted[si]) targets.push(sorted[si]);
      }
      for (const tgt of targets) {
        if (!tgt) continue;
        engine.projectiles.push(new Projectile(t.x, t.y, tgt, {
          engine, speed:440, damage:t.damage, color:'#80deea', size:6,
          dmgType:'special', emoji:'❄️',
          status:{type:'freeze', duration:s.freezeDur},
        }));
      }
    }
    if (s.blizzardTick) {
      t._blizTimer = (t._blizTimer||0) + 1/t.fireRate;
      if (t._blizTimer >= 2.5) {
        t._blizTimer = 0;
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-t.x,e.y-t.y)<=s.aoeRange) {
            e.applyStatus('slow', s.slowDur||2, s.slowFactor||0.5);
          }
        }
        engine.particles.push(new AoeBurst(t.x, t.y, s.aoeRange, '#b3e5fc'));
      }
    }
  }
});

// ===== 6. 꼬마돌 계열 =====
// 경로A: 지진(광역+스턴)  경로B: 바리케이드(슬로우+방어막)
const GeodudeTower = makeTower({
  id:'geodude', name:'꼬마돌', color:'#8d6e63',
  evolutions:['🪨','⛰️','🗿'],
  pathDesc:{A:'지진', B:'바리케이드'},
  groundOnly:true,
  levels:[
    { cost:65,  damage:20, range:160, fireRate:0.9, stunDur:0.35, splash:0   },
    { cost:105, damage:32, range:185, fireRate:1.0, stunDur:0.55, splash:50,
      paths:{
        A:{ stunDur:0.9, splash:80, quake:true },
        B:{ damage:16, splash:0, slow:true, slowFactor:0.5, slowDur:2.5, wall:true },
      }
    },
    { cost:180, damage:50, range:210, fireRate:1.1, stunDur:0.75, splash:80,
      paths:{
        A:{ stunDur:1.5, splash:120, quake:true, quakeR:160 },
        B:{ slow:true, slowFactor:0.3, slowDur:4, wall:true, knockback:50 },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    engine.projectiles.push(new Projectile(t.x, t.y, t.target, {
      engine, speed:400, damage:t.damage, color:'#a1887f', size:8,
      dmgType:'physical', emoji:'🪨',
      status: s.slow
        ? {type:'slow', duration:s.slowDur, factor:s.slowFactor}
        : {type:'stun', duration:s.stunDur},
      splash: s.splash,
      knockback: s.knockback||0,
      onHit:(enemy)=>{
        if (s.quake) {
          const r = s.quakeR || s.splash * 1.4;
          engine.particles.push(new AoeBurst(enemy.x, enemy.y, r, '#6d4c41'));
          for (const e2 of engine.enemies) {
            if (e2.dead||e2.reachedEnd) continue;
            if (Math.hypot(e2.x-enemy.x,e2.y-enemy.y) < r) {
              e2.takeDamage(t.damage*0.4,'physical');
              e2.applyStatus('stun', s.stunDur*0.6, 0);
            }
          }
          engine.spawnFloatingText('🌋지진!', enemy.x, enemy.y-24, '#8d6e63');
        }
      }
    }));
  }
});

// ===== 7. 케이시 계열 =====
// 경로A: 염동력(다중타겟+슬로우빔)  경로B: 미래예측(높은 단일 데미지+크리티컬)
const AbraTower = makeTower({
  id:'abra', name:'케이시', color:'#ba68c8',
  evolutions:['🔮','🧠','✨'],
  pathDesc:{A:'염동력', B:'미래예측'},
  levels:[
    { cost:80,  damage:14, range:205, fireRate:1.2, slowFactor:0.65, slowDur:1.5, targets:1 },
    { cost:125, damage:22, range:235, fireRate:1.3, slowFactor:0.5,  slowDur:2.0, targets:2,
      paths:{
        A:{ targets:3, slowFactor:0.38 },
        B:{ targets:1, damage:40, critChance:0.3, critMul:2.5 },
      }
    },
    { cost:210, damage:36, range:270, fireRate:1.4, slowFactor:0.4,  slowDur:2.5, targets:3,
      paths:{
        A:{ targets:5, slowFactor:0.25, slowDur:3.5 },
        B:{ targets:1, damage:70, critChance:0.5, critMul:3.5, dmgAll:true },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    const sorted = engine.enemies
      .filter(e=>!e.dead&&!e.reachedEnd&&Math.hypot(e.x-t.x,e.y-t.y)<=t.range)
      .sort((a,b)=>b.distTraveled-a.distTraveled);
    const count = Math.min(s.targets, sorted.length);

    for (let i = 0; i < count; i++) {
      const tgt = sorted[i];
      let dmg = t.damage;
      let isCrit = false;
      if (s.critChance && Math.random() < s.critChance) {
        dmg *= s.critMul;
        isCrit = true;
      }
      engine.projectiles.push(new Projectile(t.x, t.y, tgt, {
        engine, color:'#ce93d8', size:4, beam:true, beamLife:0.18,
      }));
      tgt.takeDamage(dmg, 'special');
      tgt.applyStatus('slow', s.slowDur, s.slowFactor);
      engine.spawnHitParticle(tgt.x, tgt.y, '#ba68c8');
      if (isCrit) engine.spawnFloatingText(`💥×${s.critMul}`, tgt.x, tgt.y-20, '#f48fb1');
    }
    if (s.dmgAll && sorted.length > count) {
      // 전체 타겟에 약한 사이킥 파장
      for (const e of engine.enemies) {
        if (e.dead||e.reachedEnd) continue;
        if (Math.hypot(e.x-t.x,e.y-t.y)<=t.range) {
          e.applyStatus('slow', 1.0, 0.7);
        }
      }
    }
  }
});

// ===== 8. 잠만보 계열 =====
// 경로A: 하품 스턴(광역 스턴+저주)  경로B: 벽 (근접 슬랩+블록)
const SnorlaxTower = makeTower({
  id:'snorlax', name:'잠만보', color:'#9575cd',
  evolutions:['😴','😪','👹'],
  pathDesc:{A:'저주의 하품', B:'거대 슬랩'},
  levels:[
    { cost:100, damage:18, range:155, fireRate:0.8, yawnDur:1.2 },
    { cost:150, damage:30, range:175, fireRate:0.9, yawnDur:1.6,
      paths:{
        A:{ yawnDur:2.5, yawnAoe:100, curse:true },
        B:{ damage:55, splash:70, knockback:45 },
      }
    },
    { cost:240, damage:48, range:200, fireRate:1.0, yawnDur:2.0,
      paths:{
        A:{ yawnDur:3.5, yawnAoe:150, curse:true, curseDmgMul:1.4 },
        B:{ damage:90, splash:110, knockback:80, almighty:true },
      }
    },
  ],
  fire(t, engine) {
    const s = t.stats;
    if (s.yawnAoe) {
      t._yawnTimer = (t._yawnTimer||0) + 1/t.fireRate;
      if (t._yawnTimer >= 4) {
        t._yawnTimer = 0;
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-t.x,e.y-t.y)<=s.yawnAoe) {
            e.applyStatus('stun', s.yawnDur, 0);
            if (s.curse) e.takeDamage(t.damage * (s.curseDmgMul||1.2), 'special');
          }
        }
        engine.particles.push(new AoeBurst(t.x, t.y, s.yawnAoe, '#9575cd'));
        engine.spawnFloatingText('💤하품!', t.x, t.y-34, '#ce93d8');
        return;
      }
    }
    engine.projectiles.push(new Projectile(t.x, t.y, t.target, {
      engine, speed:300, damage:t.damage, color:'#7e57c2', size:9,
      dmgType:'special', emoji:'💤',
      status:{type:'stun', duration:s.yawnDur},
      splash: s.splash||0,
      knockback: s.knockback||0,
      onHit:(enemy)=>{
        if (s.almighty) {
          // 적 주변 모두 넉백
          for (const e2 of engine.enemies) {
            if (e2.dead||e2.reachedEnd) continue;
            if (Math.hypot(e2.x-enemy.x,e2.y-enemy.y) < s.splash) {
              e2.distTraveled = Math.max(0, e2.distTraveled - s.knockback * 0.6);
            }
          }
          engine.spawnFloatingText('👊 대박!', enemy.x, enemy.y-24, '#9575cd');
        }
      }
    }));
  }
});

// ===== 타워 메타 =====
const TowerMeta = [
  { key:'bulbasaur',  cls:BulbasaurTower,       name:'이상해씨', emoji:'🌱', cost:60,  desc:'독DoT · A:맹독 B:태양광선' },
  { key:'charmander', cls:CharmanderTower,      name:'파이리',   emoji:'🦎', cost:70,  desc:'화염관통 · A:방사 B:폭발' },
  { key:'squirtle',   cls:SquirtleTower,        name:'꼬부기',   emoji:'🐢', cost:65,  desc:'슬로우 · A:냉각 B:수압' },
  { key:'voltorb',    cls:VoltorbTower,         name:'코일',     emoji:'🔵', cost:75,  desc:'스턴 · A:체인 B:EMP' },
  { key:'jynxline',   cls:JigglypuffIceTower,   name:'쥬쥬',     emoji:'🎵', cost:70,  desc:'빙결 · A:냉동빔 B:눈보라' },
  { key:'geodude',    cls:GeodudeTower,         name:'꼬마돌',   emoji:'🪨', cost:65,  desc:'스턴 · A:지진 B:바리케이드' },
  { key:'abra',       cls:AbraTower,            name:'케이시',   emoji:'🔮', cost:80,  desc:'다중슬로우 · A:염동력 B:크리' },
  { key:'snorlax',    cls:SnorlaxTower,         name:'잠만보',   emoji:'😴', cost:100, desc:'하품스턴 · A:저주 B:슬랩' },
];

window.TowerRegistry = {};
for (const m of TowerMeta) window.TowerRegistry[m.key] = m.cls;
window.TowerMeta = TowerMeta;
window.SynergyRules = SynergyRules;
window.applyTowerSynergies = applyTowerSynergies;
// gacha.js에서 사용하는 파티클 클래스 공개
window.AoeBurst = AoeBurst;
window.ChainBolt = ChainBolt;
window.Projectile = Projectile;
