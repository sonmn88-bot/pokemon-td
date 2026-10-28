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
    this.src = opts.engine ? opts.engine._dmgSrc : null; // v3.2: 이 투사체를 쏜 타워 (데미지 집계용)
    this.strike = opts.engine ? opts.engine._dmgStrike || 0 : 0; // v3.5 카드 강타
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
    // v27-39 버그수정: 타겟이 정확히 이 지점에서 죽으면(dist=0) 속도가 0,0이 되어 화면밖 판정에도
    // 안 걸려서 그 자리에 영원히 박제되는 투사체가 생기고 있었음 (요청3). 이전 방향을 유지하도록 함.
    if (dist > 0) { this.vx = dx / dist; this.vy = dy / dist; }
    else if (!this.vx && !this.vy) { this.vx = 1; this.vy = 0; } // 방향 정보가 아예 없으면 임의 방향으로라도 진행
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
    const prevSrc = this.engine && this.engine._dmgSrc, prevStrike = this.engine && this.engine._dmgStrike;
    if (this.engine) { this.engine._dmgSrc = this.src; this.engine._dmgStrike = this.strike; }
    enemy.takeDamage(this.damage, this.dmgType);
    // v27-10: 스턴은 지금까지 맞을 때마다 100% 발동이었음 - 확률제(35%)로 변경해서
    // 전기타워 연사에 계속 멈춰있던 문제를 근본적으로 완화 (다른 상태이상은 그대로 100% 유지)
    if (this.status && (!['stun','freeze'].includes(this.status.type) || Math.random() < 0.35)) {
      enemy.applyStatus(this.status.type, this.status.duration, this.status.factor);
    }
    // v27-10: 넉백도 매타격 100%였던 것을 확률제(40%)로 변경 (요청6 - 거북왕 등 넉백이 너무 세서 진행 자체가 막히던 문제)
    if (this.knockback > 0 && Math.random() < 0.22) enemy.distTraveled = Math.max(0, enemy.distTraveled - this.knockback * 0.6);
    if (this.splash > 0 && this.engine) {
      for (const e of this.engine.enemies) {
        if (e === enemy || e.dead || e.reachedEnd) continue;
        if (Math.hypot(e.x - enemy.x, e.y - enemy.y) < this.splash) {
          e.takeDamage(this.damage * 0.6, 'splash'); // v28: 부가타는 방어 50%
          if (this.status && (!['stun','freeze'].includes(this.status.type) || Math.random() < 0.35)) e.applyStatus(this.status.type, this.status.duration * 0.6, this.status.factor);
        }
      }
      this.engine && this.engine.particles.push(new BurstRing(enemy.x, enemy.y, this.splash, this.color));
    }
    if (this.chain > 0 && this.engine) this._doChain(enemy, this.chain);
    this.engine && this.engine.spawnHitParticle(enemy.x, enemy.y, this.color);
    const tierH = this._tier();
    if (tierH && this.engine && this.src && ((this.src._fxN = (this.src._fxN || 0) + 1) % 2 === 0) && this.engine.particles.length < 120)
      this.engine.particles.push(new BurstRing(enemy.x, enemy.y, tierH === 'legend' ? 26 : 34, TIER_FX[tierH].color));
    this.onHit && this.onHit(enemy);
    if (this.engine) { this.engine._dmgSrc = prevSrc; this.engine._dmgStrike = prevStrike; }
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
    nearest.takeDamage(this.damage * 0.7, 'splash'); // v28: 연쇄도 부가타
    if (this.status && (!['stun','freeze'].includes(this.status.type) || Math.random() < 0.35)) nearest.applyStatus(this.status.type, this.status.duration, this.status.factor);
    this._doChain(nearest, rem - 1);
  }

  // v3.6 공격 연출: 이모지 글자 대신 타입별 미리 그린 스프라이트 + 꼬리 1획 (fillText·shadowBlur 없음 → 더 가벼움)
  // v3.6 상위 등급 연출: 레전드(금빛 링)·유니크(무지개 링)·메가(푸른 십자 섬광) — 오라 1장 추가 + 2타마다 타격 링
  _tier() {
    if (this._tr !== undefined) return this._tr;
    const d = this.src && this.src.def;
    return (this._tr = !d ? null : d.mega ? 'mega' : d.grade === 'unique' ? 'unique' : d.grade === 'legend' ? 'legend' : null);
  }
  _type() {
    if (this._ty) return this._ty;
    const t = this.src && this.src.def && this.src.def.type;
    return (this._ty = PROJ_STYLE[t] ? t : 'normal');
  }
  draw(ctx) {
    const ty = this._type(), st = PROJ_STYLE[ty];
    if (this.beam) {
      const alpha = Math.max(0, 1 - this.life / this.beamLife);
      const x1 = this.bx1, y1 = this.by1, x2 = this.bx2, y2 = this.by2;
      ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1);
      if (ty === 'electric' || ty === 'psychic') { // 번개는 지그재그, 에스퍼는 물결
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, N = 8;
        for (let i = 1; i < N; i++) {
          const k = i / N, off = ty === 'electric' ? (Math.random() - 0.5) * 16 : Math.sin(k * Math.PI * 4 + this.life * 40) * 6;
          ctx.lineTo(x1 + dx * k + nx * off, y1 + dy * k + ny * off);
        }
      }
      ctx.lineTo(x2, y2);
      const tierB = this._tier();
      if (tierB) { ctx.strokeStyle = TIER_FX[tierB].color; ctx.lineWidth = this.size * 4; ctx.globalAlpha = alpha * 0.25; ctx.stroke(); }
      ctx.strokeStyle = st.glow; ctx.lineWidth = this.size * 2.6; ctx.globalAlpha = alpha * 0.35; ctx.stroke();
      ctx.strokeStyle = st.core; ctx.lineWidth = Math.max(1.5, this.size * 0.7); ctx.globalAlpha = alpha; ctx.stroke();
      ctx.restore();
      return;
    }
    // 꼬리: 지나온 점들을 한 번에 이어 그림 (점 6개 원 → 선 1획)
    const tr = this.trail;
    if (tr.length > 1) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(tr[0].x, tr[0].y);
      for (let i = 1; i < tr.length; i++) {
        const j = ty === 'electric' ? (Math.random() - 0.5) * 6 : 0;
        ctx.lineTo(tr[i].x + j, tr[i].y + j);
      }
      ctx.lineTo(this.x, this.y);
      const tierT = this._tier();
      ctx.strokeStyle = tierT ? TIER_FX[tierT].color : st.glow; ctx.globalAlpha = st.trailA + (tierT ? 0.15 : 0); ctx.lineWidth = this.size * st.trailW * (tierT ? 1.5 : 1); ctx.stroke();
      ctx.restore();
    }
    const tier = this._tier(), spr = projSprite(ty), d = this.size * (tier ? 4.2 : 3.4);
    ctx.save(); ctx.translate(this.x, this.y);
    if (tier) { const a = tierAura(tier), ad = d * 1.9; ctx.save(); ctx.rotate(performance.now() * 0.004); ctx.drawImage(a, -ad / 2, -ad / 2, ad, ad); ctx.restore(); }
    ctx.rotate(st.spin ? performance.now() * 0.014 : Math.atan2(this.vy, this.vx));
    ctx.drawImage(spr, -d / 2, -d / 2, d, d);
    ctx.restore();
  }
}

// 타입별 투사체 모양 (3배 해상도로 1회 렌더 후 재사용)
const PROJ_STYLE = {
  fire:     { core:'#fff3c4', glow:'#ff7a2e', trailA:0.45, trailW:1.3 },
  water:    { core:'#e6f6ff', glow:'#3aa8ff', trailA:0.35, trailW:0.9 },
  grass:    { core:'#eaffd9', glow:'#5fcf63', trailA:0.25, trailW:0.6, spin:true },
  electric: { core:'#fffbe0', glow:'#ffd84a', trailA:0.6,  trailW:0.5 },
  psychic:  { core:'#ffe9ff', glow:'#c77dff', trailA:0.35, trailW:1.0 },
  normal:   { core:'#ffffff', glow:'#c3c8d2', trailA:0.3,  trailW:0.7 },
};
const TIER_FX = { legend:{ color:'#ffc24b' }, unique:{ color:'#ff7ab0' }, mega:{ color:'#7fd3ff' } };
function tierAura(tier) {
  const k = 'aura_' + tier;
  if (_projCache[k]) return _projCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.translate(32, 32);
  if (tier === 'unique') { // 무지개 고리
    const g = x.createConicGradient ? x.createConicGradient(0, 0, 0) : null;
    if (g) { ['#ff5c7a','#ffc24b','#6dffa8','#5b9dff','#c77dff','#ff5c7a'].forEach((col, i) => g.addColorStop(i / 5, col)); x.strokeStyle = g; } else x.strokeStyle = '#ff7ab0';
    x.lineWidth = 3; x.globalAlpha = 0.9; x.beginPath(); x.arc(0, 0, 22, 0, Math.PI * 2); x.stroke();
  } else if (tier === 'mega') { // 십자 섬광
    for (const [w, h] of [[30, 2.2], [2.2, 30], [18, 1.4], [1.4, 18]]) {
      const g = x.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h)); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#7fd3ff00');
      x.save(); if (w === 18 || h === 18) x.rotate(Math.PI / 4); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
    x.strokeStyle = 'rgba(127,211,255,.7)'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.stroke();
  } else { // 레전드: 금빛 점선 고리 + 빛
    const g = x.createRadialGradient(0, 0, 8, 0, 0, 28); g.addColorStop(0, '#ffc24b55'); g.addColorStop(1, '#ffc24b00');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 28, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#ffd97a'; x.lineWidth = 2; x.setLineDash([5, 4]); x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.stroke();
  }
  return (_projCache[k] = c);
}
const _projCache = {};
function projSprite(ty) {
  if (_projCache[ty]) return _projCache[ty];
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d'), st = PROJ_STYLE[ty]; x.translate(24, 24);
  const glow = (r, a) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, st.glow + 'cc'); g.addColorStop(1, st.glow + '00'); x.globalAlpha = a; x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; };
  if (ty === 'fire') { // 진행 방향(+x)으로 뾰족한 불덩이
    glow(22, 0.8);
    const g = x.createRadialGradient(4, 0, 1, 0, 0, 13); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.35, '#ffc247'); g.addColorStop(0.75, '#ff6a1f'); g.addColorStop(1, '#d9300f00');
    x.fillStyle = g; x.beginPath(); x.moveTo(14, 0); x.quadraticCurveTo(4, -10, -12, -4); x.quadraticCurveTo(-6, 0, -12, 4); x.quadraticCurveTo(4, 10, 14, 0); x.fill();
  } else if (ty === 'water') { // 물방울 (+x가 둥근 앞쪽)
    glow(18, 0.55);
    const g = x.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#b9e6ff'); g.addColorStop(1, '#1f7fe0');
    x.fillStyle = g; x.beginPath(); x.moveTo(-13, 0); x.quadraticCurveTo(-2, -9, 6, -7); x.arc(6, 0, 7, -Math.PI / 2, Math.PI / 2); x.quadraticCurveTo(-2, 9, -13, 0); x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(7, -3, 2.6, 1.6, -0.4, 0, Math.PI * 2); x.fill();
  } else if (ty === 'grass') { // 회전하는 잎
    glow(16, 0.45);
    const g = x.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#2f9a4a'); g.addColorStop(1, '#9be86a');
    x.fillStyle = g; x.beginPath(); x.moveTo(-13, 0); x.quadraticCurveTo(0, -11, 13, 0); x.quadraticCurveTo(0, 11, -13, 0); x.fill();
    x.strokeStyle = 'rgba(230,255,210,.8)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-11, 0); x.lineTo(11, 0); x.stroke();
  } else if (ty === 'electric') { // 밝은 핵 + 가시 4개
    glow(20, 0.8);
    x.fillStyle = '#fff8c8'; x.beginPath();
    for (let i = 0; i < 8; i++) { const r = i % 2 ? 4 : 14, a = i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 4.5, 0, Math.PI * 2); x.fill();
  } else if (ty === 'psychic') { // 보랏빛 구슬 + 고리
    glow(20, 0.7);
    const g = x.createRadialGradient(-3, -3, 1, 0, 0, 10); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#e3a6ff'); g.addColorStop(1, '#8e3fd6');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 9, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(240,200,255,.8)'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(0, 0, 15, 5, 0.5, 0, Math.PI * 2); x.stroke();
  } else { // 노말: 흰 파편 별
    glow(16, 0.5);
    x.fillStyle = '#f4f6fb'; x.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 11, a = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    x.closePath(); x.fill();
  }
  return (_projCache[ty] = c);
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
    ctx.beginPath();ctx.moveTo(this.x1,this.y1);
    for(const s of this.segs){
      ctx.lineTo(this.x1+(this.x2-this.x1)*s.t+s.ox,
                 this.y1+(this.y2-this.y1)*s.t+s.oy);
    }
    ctx.lineTo(this.x2,this.y2);ctx.stroke();ctx.restore();
  }
}

class AoeBurst {
  // v3.6 특수기능 연출: 충격파(미리 그린 색별 스프라이트 1장) + 두 겹 링 + 방사 파편 + 바닥 문양. 0.6초
  constructor(x,y,radius,color){
    this.x=x;this.y=y;this.maxR=radius;this.color=color;
    this.life=0;this.maxLife=0.6;this.dead=false;
    this.rot=Math.random()*Math.PI;
  }
  update(dt){this.life+=dt;if(this.life>=this.maxLife)this.dead=true;}
  draw(ctx){
    const t=this.life/this.maxLife, e=1-Math.pow(1-t,3), r=this.maxR*e, R=this.maxR;
    ctx.save();
    // 충격파 면
    const sw=aoeWave(this.color), d=r*2.1;
    ctx.globalAlpha=(1-t)*0.85; ctx.drawImage(sw,this.x-d/2,this.y-d/2,d,d);
    // 바깥 링 + 늦게 따라오는 안쪽 링
    ctx.strokeStyle=this.color; ctx.lineWidth=3.5*(1-t)+1;
    ctx.beginPath(); ctx.arc(this.x,this.y,r,0,Math.PI*2); ctx.stroke();
    const r2=R*Math.max(0,e-0.18);
    if(r2>4){ ctx.globalAlpha=(1-t)*0.6; ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(this.x,this.y,r2,0,Math.PI*2); ctx.stroke(); }
    // 방사 파편 10줄
    ctx.globalAlpha=(1-t)*0.9; ctx.strokeStyle=this.color; ctx.lineWidth=2; ctx.lineCap='round'; ctx.beginPath();
    for(let i=0;i<10;i++){ const a=this.rot+i*Math.PI/5, r0=r*0.72, r1=r0+R*0.16*(1-t); ctx.moveTo(this.x+Math.cos(a)*r0,this.y+Math.sin(a)*r0); ctx.lineTo(this.x+Math.cos(a)*r1,this.y+Math.sin(a)*r1); }
    ctx.stroke();
    // 바닥 문양 (시전 위치, 회전 점선 원)
    if(t<0.7){ ctx.globalAlpha=(0.7-t)*0.9; ctx.setLineDash([6,5]); ctx.lineDashOffset=-t*60; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(this.x,this.y,Math.min(30,R*0.3),0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
}
const _aoeCache={};
function aoeWave(color){ // 가운데 투명·가장자리 진한 충격파 원 (색별 1회)
  if(_aoeCache[color]) return _aoeCache[color];
  const raw=color; if(!/^#[0-9a-f]{6}$/i.test(color)){ const t=document.createElement('canvas').getContext('2d'); t.fillStyle=color; color=/^#[0-9a-f]{6}$/i.test(t.fillStyle)?t.fillStyle:'#ffffff'; } // 이름·rgba 색도 #rrggbb로
  const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,20,64,64,62); g.addColorStop(0,color+'00'); g.addColorStop(0.75,color+'40'); g.addColorStop(0.95,color+'a0'); g.addColorStop(1,color+'00');
  x.fillStyle=g; x.beginPath(); x.arc(64,64,62,0,Math.PI*2); x.fill();
  return (_aoeCache[raw]=c);
}
window.AoeBurst = AoeBurst;


// v27-7: 죽은 코드 정리 - 여기부터 있던 TowerBase/makeTower/TowerRegistry/applyTowerSynergies(구버전)는
// 실제 게임에서 전혀 안 쓰이는 옛날 기본타워 시스템이었음 (현재는 gacha.js의 가챠타워 시스템만 사용).
// Projectile/ChainBolt/AoeBurst만 실제로 쓰여서 남겨두고 나머지는 삭제함 (파일 용량 절감, 로딩 속도 개선).
window.AoeBurst = AoeBurst;
window.ChainBolt = ChainBolt;
window.Projectile = Projectile;
