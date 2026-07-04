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


// v27-7: 죽은 코드 정리 - 여기부터 있던 TowerBase/makeTower/TowerRegistry/applyTowerSynergies(구버전)는
// 실제 게임에서 전혀 안 쓰이는 옛날 기본타워 시스템이었음 (현재는 gacha.js의 가챠타워 시스템만 사용).
// Projectile/ChainBolt/AoeBurst만 실제로 쓰여서 남겨두고 나머지는 삭제함 (파일 용량 절감, 로딩 속도 개선).
window.AoeBurst = AoeBurst;
window.ChainBolt = ChainBolt;
window.Projectile = Projectile;
