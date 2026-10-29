// ===== GACHA.JS - 포켓몬 랜덤 뽑기 시스템 v3 =====
// 1세대 핵심 31종, 타입별 특성, 진화 체계

// ===== 등급 정의 =====
const GRADES = {
  normal:  { name:'노말',   color:'#a7adba', glow:'rgba(158,158,158,0.5)', stars:1, bg:'#2a2a2a' },
  rare:    { name:'레어',   color:'#5b9dff', glow:'rgba(79,195,247,0.6)',  stars:2, bg:'#0d2035' },
  epic:    { name:'에픽',   color:'#b18cff', glow:'rgba(206,147,216,0.7)', stars:3, bg:'#1e0d35' },
  legend:  { name:'레전드', color:'#ffc24b', glow:'rgba(255,194,75,0.8)',  stars:4, bg:'#2a1d00' },
  unique:  { name:'유니크', color:'#ff5c7a', glow:'rgba(255,107,107,0.9)', stars:5, bg:'#2a0000', rainbow:true },
};

// ===== 영구 버프 상한선 (상점/타입강화 중첩으로 인한 밸런스 붕괴 방지) =====
// 사거리는 특히 낮게 캡: '전범위 타워'가 나오지 않도록.
// v27: 영구강화 상한 제거 (기존엔 range1.35/dmg1.9/speed1.5로 막혀있었음) - 대신 상점 가격이 살수록 비싸짐
const BUFF_CAPS = { range: 999, damage: 999, speed: 999 };

// ===== 속성 상성 (6속성 순환: 불→풀→물→전기→에스퍼→노말→불) =====
// 각 속성은 정확히 하나를 이기고(1.4배) 하나에게 진다(0.7배). 전략적 타워 배치 유도용.
const TYPE_CYCLE = ['fire','grass','water','electric','psychic','normal'];
function typeEffectiveness(atkType, defType) {
  if (!atkType || !defType || atkType === defType) return 1;
  const ai = TYPE_CYCLE.indexOf(atkType), di = TYPE_CYCLE.indexOf(defType);
  if (ai < 0 || di < 0) return 1;
  if ((ai + 1) % TYPE_CYCLE.length === di) return 1.4; // 상성 우위
  if ((di + 1) % TYPE_CYCLE.length === ai) return 0.7; // 상성 열세
  return 1;
}
window.typeEffectiveness = typeEffectiveness;
window.TYPE_CYCLE = TYPE_CYCLE;

// ===== 타입 정의 (6종으로 간소화: 고스트→에스퍼, 땅→노말, 얼음→물, 바위→풀 흡수) =====
const TYPES = {
  fire:    { name:'불꽃', color:'#ff5722', emoji:'🔥', effect:'burn' },
  water:   { name:'물',   color:'#29b6f6', emoji:'💧', effect:'slow' },
  grass:   { name:'풀',   color:'#66bb6a', emoji:'🌿', effect:'poison' },
  electric:{ name:'전기', color:'#ffd600', emoji:'⚡', effect:'stun' },
  psychic: { name:'에스퍼',color:'#ba68c8', emoji:'🔮', effect:'slow_multi' },
  normal:  { name:'노말', color:'#bdbdbd', emoji:'⬜', effect:'basic' },
};

// ===== 타워 정의 (31종) =====
const GachaTowerDefs = {

  // ===== 노말 (12종) =====
  bulbasaur: {
    id:'bulbasaur', name:'이상해씨', emoji:'🌱', grade:'normal', type:'grass', pokemonId:'bulbasaur',
    damage:12, range:185, fireRate:1.2, desc:'독 DoT 부여',
    fire(t,e){ _shot(t,e,'#8bc34a','🍃',{type:'poison',duration:4,factor:11},340); }
  },
  charmander: {
    id:'charmander', name:'파이리', emoji:'🦎', grade:'normal', type:'fire', pokemonId:'charmander',
    damage:14, range:175, fireRate:1.8, desc:'화상 DoT',
    fire(t,e){ _shot(t,e,'#ff7043','🔥',{type:'burn',duration:2,factor:5.2},450); }
  },
  squirtle: {
    id:'squirtle', name:'꼬부기', emoji:'🐢', grade:'normal', type:'water', pokemonId:'squirtle',
    damage:11, range:185, fireRate:1.1, desc:'슬로우',
    fire(t,e){ _shot(t,e,'#5b9dff','💧',{type:'slow',duration:1.8,factor:0.65},360); }
  },
  pidgey: {
    id:'pidgey', name:'구구', emoji:'🐦', grade:'normal', type:'normal', pokemonId:'pidgey',
    damage:10, range:210, fireRate:2.2, desc:'비행형 적에게 데미지 +50%',
    fire(t,e){
      if(!t.target) return;
      const dmg = t.target?.def?.special === 'flying' ? t.damage * 1.5 : t.damage;
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:520,damage:dmg,color:'#bcaaa4',size:5,dmgType:'special',emoji:'🪶'}));
    }
  },
  rattata: {
    id:'rattata', name:'꼬렛', emoji:'🐭', grade:'normal', type:'normal', pokemonId:'rattata',
    damage:9, range:160, fireRate:2.8, desc:'같은 타겟 연속 공격시 데미지 누적(최대+50%)',
    fire(t,e){
      if(!t.target) return;
      if(t._lastTarget===t.target){ t._biteStack=Math.min(5,(t._biteStack||0)+1); } else { t._biteStack=0; }
      t._lastTarget=t.target;
      const dmg=t.damage*(1+t._biteStack*0.1);
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:420,damage:dmg,color:'#a1887f',size:5,dmgType:'special',emoji:'🐭'}));
    }
  },
  clefairy: {
    id:'clefairy', name:'피삐', emoji:'⭐', grade:'normal', type:'normal', pokemonId:'clefairy',
    damage:8, range:195, fireRate:1.0, desc:'주변 타워 데미지 +10%',
    fire(t,e){
      _shot(t,e,'#f48fb1','⭐',null,320);
    }
  },
  oddish: {
    id:'oddish', name:'뚜벅초', emoji:'🌿', grade:'normal', type:'grass', pokemonId:'oddish',
    damage:10, range:180, fireRate:1.1, desc:'광역 독 포자',
    fire(t,e){
      _shot(t,e,'#7cb342','🍃',{type:'poison',duration:4.5,factor:10},320);
      t._sporeTimer=(t._sporeTimer||0)+1/t.fireRate;
      if(t._sporeTimer>=5){ t._sporeTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=100) en.applyStatus('slow',2,0.7);
        e.particles.push(new AoeBurst(t.x,t.y,100,'#7cb342'));
      }
    }
  },
  diglett: {
    id:'diglett', name:'디그다', emoji:'🏔️', grade:'normal', type:'normal', pokemonId:'diglett',
    damage:15, range:155, fireRate:1.0, desc:'넉백',
    fire(t,e){ _shot(t,e,'#d4a056','💨',{type:'stun',duration:0.3},300,null,0,0,35); }
  },
  psyduck: {
    id:'psyduck', name:'고라파덕', emoji:'🦆', grade:'normal', type:'water', pokemonId:'psyduck',
    damage:11, range:190, fireRate:1.2, desc:'혼란 슬로우',
    fire(t,e){ _shot(t,e,'#ffcc02','💫',{type:'slow',duration:2,factor:0.6},350); }
  },
  growlithe: {
    id:'growlithe', name:'가디', emoji:'🐕', grade:'normal', type:'fire', pokemonId:'growlithe',
    damage:13, range:175, fireRate:2.0, desc:'화염 속사',
    fire(t,e){ _shot(t,e,'#ff6d00','🔥',{type:'burn',duration:1.5,factor:4.5},480); }
  },
  abra: {
    id:'abra', name:'케이시', emoji:'🔮', grade:'normal', type:'psychic', pokemonId:'abra',
    damage:13, range:200, fireRate:1.3, desc:'2타겟 에스퍼',
    fire(t,e){
      const targets=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for(const tgt of targets){ e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#b18cff',size:4,beam:true,beamLife:0.15})); tgt.takeDamage(t.damage,'special'); tgt.applyStatus('slow',1.5,0.65); e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8'); }
    }
  },
  magnemite: {
    id:'magnemite', name:'코일', emoji:'🧲', grade:'normal', type:'electric', pokemonId:'magnemite',
    damage:14, range:170, fireRate:1.5, desc:'전기 스턴',
    fire(t,e){ _shot(t,e,'#ffeb3b','⚡',{type:'stun',duration:0.35},500); }
  },

  // v27-17: 정통 진화라인 정비 (요청) - 구구/꼬렛/피삐/뚜벅초/디그다/고라파덕/가디의 진짜 진화형 신규 추가
  pidgeotto: {
    id:'pidgeotto', name:'피죤', emoji:'🐦', grade:'rare', type:'normal', pokemonId:'pidgey',
    damage:20, range:235, fireRate:2.3, desc:'비행형 적에게 데미지 +70%',
    fire(t,e){
      if(!t.target) return;
      const dmg = t.target?.def?.special === 'flying' ? t.damage * 1.7 : t.damage;
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:560,damage:dmg,color:'#bcaaa4',size:5,dmgType:'special',emoji:'🪶'}));
    }
  },
  raticate: {
    id:'raticate', name:'레트라', emoji:'🐀', grade:'rare', type:'normal', pokemonId:'rattata',
    damage:19, range:175, fireRate:3.4, desc:'같은 타겟 연속 공격시 데미지 누적(최대+80%, 강화판)',
    fire(t,e){
      if(!t.target) return;
      if(t._lastTarget===t.target){ t._biteStack=Math.min(8,(t._biteStack||0)+1); } else { t._biteStack=0; }
      t._lastTarget=t.target;
      const dmg=t.damage*(1+t._biteStack*0.1);
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:460,damage:dmg,color:'#8d6e63',size:5,dmgType:'special',emoji:'🐀'}));
    }
  },
  clefable: {
    id:'clefable', name:'픽시블', emoji:'💫', grade:'rare', type:'normal', pokemonId:'clefairy',
    damage:18, range:225, fireRate:1.1, desc:'주변 타워 데미지 +25% (강화판)',
    fire(t,e){
      _shot(t,e,'#f8bbd0','💫',null,340);
    }
  },
  gloom: {
    id:'gloom', name:'리본초', emoji:'🌺', grade:'rare', type:'grass', pokemonId:'oddish',
    damage:22, range:195, fireRate:1.2, desc:'광역 독 포자 (강화판)',
    fire(t,e){
      _shot(t,e,'#7cb342','🍃',{type:'poison',duration:4.5,factor:12},330,null,60);
      t._sporeTimer=(t._sporeTimer||0)+1/t.fireRate;
      if(t._sporeTimer>=4.5){ t._sporeTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=115) en.applyStatus('slow',2.2,0.6);
        e.particles.push(new AoeBurst(t.x,t.y,115,'#7cb342'));
      }
    }
  },
  dugtrio: {
    id:'dugtrio', name:'닥트리오', emoji:'🏔️', grade:'rare', type:'normal', pokemonId:'diglett',
    damage:24, range:170, fireRate:1.2, desc:'강한 넉백+스턴',
    fire(t,e){ _shot(t,e,'#d4a056','💨',{type:'stun',duration:0.7},320,null,0,0,55); }
  },
  golduck: {
    id:'golduck', name:'골덕', emoji:'🦆', grade:'rare', type:'water', pokemonId:'psyduck',
    damage:20, range:215, fireRate:1.35, desc:'강한 슬로우',
    fire(t,e){ _shot(t,e,'#5b9dff','💫',{type:'slow',duration:3,factor:0.45},380); }
  },
  arcanine: {
    id:'arcanine', name:'윈디', emoji:'🐕', grade:'rare', type:'fire', pokemonId:'growlithe',
    damage:23, range:200, fireRate:2.4, desc:'강화 화염 속사',
    fire(t,e){ _shot(t,e,'#ff6d00','🔥',{type:'burn',duration:2,factor:8},520); }
  },

  // ===== 레어 (8종) =====
  ivysaur: {
    // v27-16: 이상해씨의 정상 진화(이상해풀) - 실제 이미지 없어도 이상해씨 이미지로 폴백(pokemonId)됨
    id:'ivysaur', name:'이상해풀', emoji:'🌿', grade:'rare', type:'grass', pokemonId:'bulbasaur',
    damage:24, range:200, fireRate:1.2, desc:'광역 독 포자 (강화판)',
    fire(t,e){ _shot(t,e,'#7cb342','🍃',{type:'poison',duration:4,factor:9},330,null,55); }
  },
  charmeleon: {
    id:'charmeleon', name:'리자드', emoji:'🔥', grade:'rare', type:'fire', pokemonId:'charmander',
    damage:22, range:195, fireRate:1.7, desc:'화염 (단일 대상)', // v27-41: 발사속도 2.5→1.7 (요청: 리자드가 클러스터에서 너무 빠르게 연쇄점화시킴)
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:520,damage:t.damage,color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',status:{type:'burn',duration:2.5,factor:7.5}})); }
  },
  wartortle: {
    id:'wartortle', name:'어니부기', emoji:'💧', grade:'rare', type:'water', pokemonId:'squirtle',
    damage:26, range:215, fireRate:1.3, desc:'강한 슬로우+넉백',
    fire(t,e){ _shot(t,e,'#1e88e5','💦',{type:'slow',duration:3,factor:0.45},380,null,0,55); }
  },
  kadabra: {
    id:'kadabra', name:'윤겔라', emoji:'✨', grade:'rare', type:'psychic', pokemonId:'abra',
    damage:24, range:240, fireRate:1.4, desc:'3타겟 에스퍼',
    fire(t,e){
      const targets=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,3);
      for(const tgt of targets){ e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#b18cff',size:4,beam:true,beamLife:0.15})); tgt.takeDamage(t.damage,'special'); tgt.applyStatus('slow',2.5,0.5); e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8'); }
    }
  },
  geodude: {
    id:'geodude', name:'꼬마돌', emoji:'🪨', grade:'rare', type:'grass', pokemonId:'geodude',
    damage:28, range:175, fireRate:0.95, desc:'범위 스턴',
    fire(t,e){ _shot(t,e,'#a1887f','🪨',{type:'stun',duration:0.6},380,null,55); }
  },
  gastly: {
    // v27-17: 이름 오표기 수정 (고우스트→고스트, '고우스트'는 사실 haunter의 한글명이었음)
    id:'gastly', name:'고스트', emoji:'👻', grade:'rare', type:'psychic', pokemonId:'gastly',
    damage:22, range:215, fireRate:1.3, desc:'방어 무시',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:360,damage:t.damage*1.6,color:'#7c4dff',size:7,dmgType:'special',emoji:'👻',status:{type:'slow',duration:2,factor:0.5}})); }
  },
  lickitung: {
    id:'lickitung', name:'내룸벨트', emoji:'👅', grade:'rare', type:'normal', pokemonId:'lickitung',
    damage:20, range:165, fireRate:0.8, desc:'광역 스턴 혀',
    fire(t,e){ _shot(t,e,'#f48fb1','👅',{type:'stun',duration:1.0},280,null,65); }
  },
  horsea: {
    id:'horsea', name:'콘치', emoji:'🌊', grade:'rare', type:'water', pokemonId:'horsea',
    damage:18, range:205, fireRate:1.8, desc:'물대포 연사',
    fire(t,e){ _shot(t,e,'#0288d1','💦',{type:'slow',duration:1.5,factor:0.55},420); }
  },
  magneton: {
    id:'magneton', name:'레어코일', emoji:'⚡', grade:'rare', type:'electric', pokemonId:'magnemite',
    damage:26, range:200, fireRate:1.5, desc:'체인 번개 3연쇄',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:600,damage:t.damage,color:'#ffeb3b',size:5,dmgType:'special',emoji:'⚡',status:{type:'stun',duration:0.6},chain:3,chainRange:150})); }
  },
  dratini: {
    id:'dratini', name:'미뇽', emoji:'🐉', grade:'rare', type:'water', pokemonId:'dratini',
    damage:22, range:195, fireRate:1.3, desc:'용의숨결 관통',
    fire(t,e){ _shot(t,e,'#4dd0e1','🌊',{type:'slow',duration:1.8,factor:0.5},450); }
  },

  // ===== 에픽 (6종) =====
  venusaur: {
    // v27-16: 이상해풀의 정상 진화(이상해꽃) - pokemonId 폴백으로 이상해씨 이미지 재사용
    id:'venusaur', name:'이상해꽃', emoji:'🌺', grade:'epic', type:'grass', pokemonId:'bulbasaur',
    damage:40, range:220, fireRate:1.1, desc:'광역 독 포자 (최종 강화)',
    fire(t,e){ _shot(t,e,'#558b2f','🍃',{type:'poison',duration:4.5,factor:14},340,null,70); }
  },
  pidgeot: {
    id:'pidgeot', name:'피죤투', emoji:'🐦', grade:'epic', type:'normal', pokemonId:'pidgey',
    damage:36, range:265, fireRate:2.6, desc:'비행형 적에게 데미지 +120%',
    fire(t,e){
      if(!t.target) return;
      const dmg = t.target?.def?.special === 'flying' ? t.damage * 2.2 : t.damage;
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:620,damage:dmg,color:'#bcaaa4',size:6,dmgType:'special',emoji:'🪶'}));
    }
  },
  vileplume: {
    id:'vileplume', name:'라플레시아', emoji:'🌺', grade:'epic', type:'grass', pokemonId:'oddish',
    damage:40, range:210, fireRate:1.25, desc:'맹독 포자 + 광역 슬로우',
    fire(t,e){
      _shot(t,e,'#6a1b9a','🍃',{type:'poison',duration:5,factor:18},350,null,75);
      t._sporeTimer=(t._sporeTimer||0)+1/t.fireRate;
      if(t._sporeTimer>=4){ t._sporeTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=130) en.applyStatus('slow',2.5,0.5);
        e.particles.push(new AoeBurst(t.x,t.y,130,'#6a1b9a'));
      }
    }
  },
  haunter: {
    // v27-17: 고스트 진화라인 정비 - 고스트(gastly)의 정통 진화형. 전용 이미지 없으면 적 폴더의 haunter.png로 자동 대체됨
    id:'haunter', name:'고우스트', emoji:'👻', grade:'epic', type:'psychic', pokemonId:'haunter',
    damage:40, range:230, fireRate:1.4, desc:'방어 무시 + 강한 슬로우',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:400,damage:t.damage*1.8,color:'#7c4dff',size:8,dmgType:'special',emoji:'👻',status:{type:'slow',duration:2.5,factor:0.4}})); }
  },
  charizard: {
    id:'charizard', name:'리자몽', emoji:'🐉', grade:'epic', type:'fire', pokemonId:'charmander',
    damage:50, range:240, fireRate:2.5, desc:'폭발 25% (단일 대상)', // v27-41: 발사속도 3.5→2.5 (리자드와 동일한 이유)
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:520,damage:t.damage,color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',status:{type:'burn',duration:3,factor:10.5},
        onHit:(en)=>{ if(Math.random()<0.25){ for(const e2 of e.enemies) if(e2!==en && !e2.dead && !e2.reachedEnd && Math.hypot(e2.x-en.x,e2.y-en.y)<70) e2.takeDamage(t.damage*0.6,'special'); e.particles.push(new AoeBurst(en.x,en.y,70,'#ff6f00')); }}}));
    }
  },
  blastoise: {
    id:'blastoise', name:'거북왕', emoji:'🌊', grade:'epic', type:'water', pokemonId:'squirtle',
    damage:45, range:255, fireRate:1.4, desc:'하이드로펌프 넉백',
    fire(t,e){ _shot(t,e,'#1565c0','💦',{type:'slow',duration:3.5,factor:0.3},400,null,65,65); }
  },
  alakazam: {
    id:'alakazam', name:'후딘', emoji:'🌟', grade:'epic', type:'psychic', pokemonId:'abra',
    damage:44, range:280, fireRate:1.5, desc:'5타겟+크리티컬',
    fire(t,e){
      const targets=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,5);
      for(const tgt of targets){ let dmg=t.damage; if(Math.random()<0.35){dmg*=2.8;e.spawnFloatingText('크리!',tgt.x,tgt.y-18,'#f48fb1');} e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#b18cff',size:4,beam:true,beamLife:0.18})); tgt.takeDamage(dmg,'special'); tgt.applyStatus('slow',2.5,0.38); e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8'); }
    }
  },
  gyarados: {
    id:'gyarados', name:'갸라도스', emoji:'🐲', grade:'epic', type:'water', pokemonId:'gyarados',
    damage:40, range:240, fireRate:1.2, desc:'분노 광역+슬로우',
    fire(t,e){
      _shot(t,e,'#1e88e5','🌊',{type:'slow',duration:2.5,factor:0.45},400,null,60);
      t._rageTimer=(t._rageTimer||0)+1/t.fireRate;
      if(t._rageTimer>=9){ t._rageTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range) { en.takeDamage(t.damage*0.35,'special'); en.applyStatus('slow',2,0.55); } e.particles.push(new AoeBurst(t.x,t.y,t.range,'#5b9dff')); e.spawnFloatingText('분노!',t.x,t.y-30,'#29b6f6'); }
    }
  },
  lapras: {
    id:'lapras', name:'라프라스', emoji:'🧊', grade:'epic', type:'water', pokemonId:'lapras',
    damage:36, range:250, fireRate:1.2, desc:'빙결+분열 2발',
    fire(t,e){
      const sorted=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for(const tgt of sorted) e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:440,damage:t.damage,color:'#80deea',size:6,dmgType:'special',emoji:'❄️',status:{type:'freeze',duration:2.0}}));
    }
  },
  aerodactyl: {
    id:'aerodactyl', name:'프테라', emoji:'🦅', grade:'epic', type:'grass', pokemonId:'aerodactyl',
    damage:42, range:260, fireRate:1.8, desc:'고속타+기절',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:620,damage:t.damage,color:'#78909c',size:6,dmgType:'physical',emoji:'🪨',status:{type:'stun',duration:0.5}})); }
  },
  dragonair: {
    id:'dragonair', name:'신뇽', emoji:'🐲', grade:'epic', type:'water', pokemonId:'dragonair',
    damage:52, range:250, fireRate:1.5, desc:'용의파동+슬로우',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:500,damage:t.damage,color:'#4dd0e1',size:6,dmgType:'special',emoji:'🌊',status:{type:'slow',duration:2.2,factor:0.45}})); }
  },

  // ===== 레전드 (3종) =====
  articuno: {
    id:'articuno', name:'프리져', emoji:'🦅', grade:'legend', type:'water', pokemonId:'articuno',
    damage:65, range:310, fireRate:1.3, desc:'눈보라 전체+빙결',
    fire(t,e){
      const sorted=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,3);
      for(const tgt of sorted) e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:460,damage:t.damage,color:'#b3e5fc',size:7,dmgType:'special',emoji:'❄️',status:{type:'freeze',duration:2.8}}));
      t._blizTimer=(t._blizTimer||0)+1/t.fireRate;
      if(t._blizTimer>=6){ t._blizTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range) en.applyStatus('slow',3.5,0.3); e.particles.push(new AoeBurst(t.x,t.y,t.range,'#b3e5fc')); e.spawnFloatingText('눈보라!',t.x,t.y-36,'#80deea'); }
    }
  },
  zapdos: {
    id:'zapdos', name:'썬더', emoji:'⚡', grade:'legend', type:'electric', pokemonId:'zapdos',
    damage:60, range:300, fireRate:2.0, desc:'EMP+체인 5연쇄',
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:650,damage:t.damage,color:'#fff176',size:6,dmgType:'special',emoji:'⚡',status:{type:'stun',duration:1.0},chain:5,chainRange:180}));
      t._empTimer=(t._empTimer||0)+1/t.fireRate;
      if(t._empTimer>=8){ t._empTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range*0.6) { en.takeDamage(t.damage*0.8,'special'); en.applyStatus('stun',1.5,0); } e.particles.push(new AoeBurst(t.x,t.y,t.range*0.6,'#fff176')); }
    }
  },
  moltres: {
    id:'moltres', name:'파이어', emoji:'🔥', grade:'legend', type:'fire', pokemonId:'moltres',
    damage:70, range:295, fireRate:3.0, desc:'불꽃폭풍 광역',
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:540,damage:t.damage,color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',status:{type:'burn',duration:4,factor:13.5},
        onHit:(en)=>{ if(Math.random()<0.4){ for(const e2 of e.enemies) if(e2!==en && !e2.dead && !e2.reachedEnd && Math.hypot(e2.x-en.x,e2.y-en.y)<90) e2.takeDamage(t.damage*0.65,'special'); e.particles.push(new AoeBurst(en.x,en.y,90,'#ff6f00')); }}}));
    }
  },
  dragonite: {
    id:'dragonite', name:'망나뇽', emoji:'🐉', grade:'legend', type:'water', pokemonId:'dragonite',
    damage:80, range:300, fireRate:1.8, desc:'보스 사냥꾼: 사거리 안 보스를 자동 조준 · 보스에게 2배 · 크리 25%(2.5배) · 넉백 + 광역폭발',
    fire(t,e){
      // v3.11: 보스가 사거리 안에 있으면 무조건 보스를 노림 (어그로), 보스·엘리트에게 2배, 크리 25%, 일반 적 넉백 30%
      const r2=t.range*t.range, boss=e.enemies.find(en=>en.isBoss&&!en.dead&&!en.reachedEnd&&(en.x-t.x)**2+(en.y-t.y)**2<=r2);
      const tgt=boss||t.target; if(!tgt) return;
      const crit=Math.random()<0.25, bossMul=(tgt.isBoss||tgt._elite)?2:1, dmg=t.damage*bossMul*(crit?2.5:1);
      if(crit) e.spawnFloatingText('크리!',tgt.x,tgt.y-24,'#fb8c00');
      e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:560,damage:dmg,color:'#fb8c00',size:crit?9:7,dmgType:'special',
        onHit:(en)=>{ e.particles.push(new AoeBurst(en.x,en.y,70,'#fb8c00')); if(!en.isBoss&&!en.dead&&Math.random()<0.3) en.distTraveled=Math.max(0,en.distTraveled-35);
          for(const e2 of e.enemies) if(e2!==en&&!e2.dead&&!e2.reachedEnd&&Math.hypot(e2.x-en.x,e2.y-en.y)<70) e2.takeDamage(t.damage*0.35,'special'); }}));
    }
  },
  gengar: {
    // v27-17: 고스트 라인 최종진화. 전용 이미지 없으면 haunter.png(적 폴더)로 자동 대체됨
    id:'gengar', name:'팬텀', emoji:'👻', grade:'legend', type:'psychic', pokemonId:'haunter',
    damage:62, range:250, fireRate:1.6, desc:'완전 방어무시 + 광역 슬로우',
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:420,damage:t.damage*2,color:'#4a148c',size:9,dmgType:'true',/* v3.11: 설명대로 방어 완전 무시 */
        onHit:(en)=>{ e.particles.push(new AoeBurst(en.x,en.y,90,'#4a148c')); for(const e2 of e.enemies) if(!e2.dead&&!e2.reachedEnd&&Math.hypot(e2.x-en.x,e2.y-en.y)<90) e2.applyStatus('slow',2.5,0.45); }}));
    }
  },

  // ===== 유니크 (2종) =====
  mewtwo: {
    id:'mewtwo', name:'뮤츠', emoji:'🔮', grade:'unique', type:'psychic', pokemonId:'mewtwo',
    damage:100, range:320, fireRate:1.6, desc:'전지전능 6타겟+크리',
    fire(t,e){
      const all=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,4);
      for(const tgt of all){ let dmg=t.damage; if(Math.random()<0.35){dmg*=3;e.spawnFloatingText('크리!',tgt.x,tgt.y-20,'#b39ddb');} e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#b39ddb',size:5,beam:true,beamLife:0.2})); tgt.takeDamage(dmg,'special'); tgt.applyStatus('slow',2.5,0.35); e.spawnHitParticle(tgt.x,tgt.y,'#7c4dff'); }
      t._psyTimer=(t._psyTimer||0)+1/t.fireRate;
      if(t._psyTimer>=4){ t._psyTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range) en.applyStatus('slow',1.5,0.5); e.particles.push(new AoeBurst(t.x,t.y,t.range,'#7c4dff')); }
    }
  },
  // v3.8 히든: 도박 뽑기(2000)에서만 1% — 붉은 갸라도스 (등급 풀에 없음, 레시피·합성으로 못 얻음)
  shiny_gyarados: {
    id:'shiny_gyarados', name:'붉은 갸라도스', emoji:'', grade:'unique', type:'water', pokemonId:'gyarados', hidden:true,
    damage:115, range:280, fireRate:1.1, desc:'히든 · 파괴광선(일직선 관통) + 6초마다 역린(범위 2배 피해·감속)',
    fire(t,e){
      const tgt=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled)[0];
      if(tgt){
        const dx=tgt.x-t.x, dy=tgt.y-t.y, L=Math.hypot(dx,dy)||1, ux=dx/L, uy=dy/L, ex=t.x+ux*t.range, ey=t.y+uy*t.range;
        e.projectiles.push(new Projectile(t.x,t.y,{x:ex,y:ey},{engine:e,color:'#ff4d5e',size:7,beam:true,beamLife:0.22}));
        for(const en of e.enemies){ if(en.dead||en.reachedEnd) continue; const px=en.x-t.x, py=en.y-t.y, along=px*ux+py*uy; if(along<0||along>t.range) continue;
          if(Math.abs(px*uy-py*ux)<=26){ en.takeDamage(t.damage,'special'); e.spawnHitParticle(en.x,en.y,'#ff4d5e'); } }
      }
      t._rageT=(t._rageT||0)+1/t.fireRate;
      if(t._rageT>=6){ t._rageT=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range*0.7){ en.takeDamage(t.damage*2,'special'); en.applyStatus('slow',2,0.5); }
        e.particles.push(new AoeBurst(t.x,t.y,t.range*0.7,'#ff4d5e')); e.spawnFloatingText('역린!',t.x,t.y-34,'#ff4d5e'); }
    }
  },
  // v3.9 히든 2: 검은 리자몽 — 6초마다 유성 화염(적 위치 6곳 대폭발 + 화상)
  shiny_charizard: {
    id:'shiny_charizard', name:'검은 리자몽', emoji:'', grade:'unique', type:'fire', pokemonId:'charizard', hidden:true,
    damage:120, range:270, fireRate:1.2, desc:'히든 · 화염 숨결(3마리 관통·화상) + 6초마다 블래스트번(유성 6발 대폭발)',
    fire(t,e){
      const tg=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,3);
      for(const en of tg){ e.projectiles.push(new Projectile(t.x,t.y,en,{engine:e,color:'#ff7a2e',size:6,beam:true,beamLife:0.2})); en.takeDamage(t.damage,'special'); en.applyStatus('burn',3,t.damage*0.12); }
      t._metT=(t._metT||0)+1/t.fireRate;
      if(t._metT>=6){ t._metT=0;
        const pool=e.enemies.filter(en=>!en.dead&&!en.reachedEnd).sort(()=>Math.random()-0.5).slice(0,6);
        pool.forEach((p,k)=>setTimeout(()=>{ if(!e.enemies) return; e.particles.push(new AoeBurst(p.x,p.y,90,'#ff7a2e'));
          for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-p.x,en.y-p.y)<=90){ en.takeDamage(t.damage*2.5,'special'); en.applyStatus('burn',4,t.damage*0.15); } }, k*120));
        e.triggerScreenShake&&e.triggerScreenShake(7,0.5); e.spawnFloatingText('블래스트번!',t.x,t.y-36,'#ff7a2e',{fontSize:16,life:1}); }
    }
  },
  // v3.9 히든 3: 분홍 망나뇽 — 8초마다 용성군(필드 전체 피해 + 뒤로 밀기)
  shiny_dragonite: {
    id:'shiny_dragonite', name:'분홍 망나뇽', emoji:'', grade:'unique', type:'psychic', pokemonId:'dragonite', hidden:true,
    damage:110, range:300, fireRate:1.0, desc:'히든 · 2마리 강타(넉백) + 8초마다 용성군(필드 전체 1.5배 피해·뒤로 밀기)',
    fire(t,e){
      const tg=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for(const en of tg){ e.projectiles.push(new Projectile(t.x,t.y,en,{engine:e,color:'#ff8fd0',size:7,beam:true,beamLife:0.2})); en.takeDamage(t.damage*1.3,'special'); if(Math.random()<0.4) en.distTraveled=Math.max(0,en.distTraveled-30); }
      t._dracoT=(t._dracoT||0)+1/t.fireRate;
      if(t._dracoT>=8){ t._dracoT=0;
        for(const en of e.enemies){ if(en.dead||en.reachedEnd) continue; en.takeDamage(t.damage*1.5,'special'); if(!en.isBoss) en.distTraveled=Math.max(0,en.distTraveled-60); }
        const cx=e.camera?e.camera.x:t.x, cy=e.camera?e.camera.y:t.y;
        for(let k=0;k<4;k++) setTimeout(()=>e.particles.push(new AoeBurst(cx+(Math.random()-0.5)*300,cy+(Math.random()-0.5)*500,160,'#ff8fd0')),k*90);
        e.triggerScreenShake&&e.triggerScreenShake(10,0.6); e.spawnFloatingText('용성군!',t.x,t.y-36,'#ff8fd0',{fontSize:16,life:1}); }
    }
  },
  mew: {
    id:'mew', name:'뮤', emoji:'💗', grade:'unique', type:'psychic', pokemonId:'mew',
    damage:80, range:330, fireRate:1.4, desc:'전체버프+변신',
    fire(t,e){
      const all=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,4);
      for(const tgt of all){ e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#f48fb1',size:5,beam:true,beamLife:0.18})); tgt.takeDamage(t.damage,'special'); tgt.applyStatus('slow',3,0.4); }
      t._buffTimer=(t._buffTimer||0)+1/t.fireRate;
      if(t._buffTimer>=8){
        t._buffTimer=0;
        // v27-29 버그수정: 뮤의 전체버프가 상한 없이 8초마다 전체 타워 데미지를 영구 복리 누적하고
        // 있었음(요청 - 화상 아니어도 잘못된 지속피해 원인 재검토). 완전 자동발동이라 사실상 시간이
        // 지날수록 전체 데미지가 무한히 커지는 구조였음. 최대 25회(약 +64%)로 상한을 둠.
        e._mewBuffStacks = (e._mewBuffStacks || 0) + 1;
        if (e._mewBuffStacks <= 25) {
          for(const tw of e.towers) tw.buffDmgMul=(tw.buffDmgMul||1)*1.02;
          e.spawnFloatingText('전체버프!',t.x,t.y-30,'#f48fb1');
        }
      }
    }
  },
};

// v27-6: 도감 플레이버 텍스트 (요청3 - 짧은 원작 감성 문구, 타워패널에 표시)
const FLAVOR_TEXT = {
  bulbasaur:'등에 있는 씨앗에 영양분이 가득 차 있다.', charmander:'꼬리 불이 꺼지면 생명이 위험해진다.',
  ivysaur:'등의 봉오리가 커질수록 서있기 힘들어한다.', venusaur:'큰 꽃에 햇빛을 모아 힘으로 바꾼다는 이상해씨의 최종 진화형.',
  pidgeotto:'세력권을 정해두고 그 안을 계속 순찰한다.', pidgeot:'한번 날면 마하 2의 속도로 활공한다는 최강의 새.',
  raticate:'수염으로 주변 상황을 살피는 야행성 포켓몬.', clefable:'평소엔 부끄럼이 많아 잘 나타나지 않는다.',
  gloom:'입에서 나오는 꿀이 강렬한 악취를 풍긴다.', vileplume:'세상에서 가장 큰 꽃을 피운다는 포켓몬.',
  dugtrio:'세 마리가 지하 깊은 곳에서 뿌리처럼 이어져 있다.', golduck:'물속에서는 인어로 오해받기도 한다는 포켓몬.',
  arcanine:'예로부터 그 늠름한 모습으로 사랑받아온 포켓몬.',
  haunter:'혀로 핥인 상대는 계속 몸이 떨린다는 무서운 소문.', gengar:'그림자에 숨어 장난칠 상대를 노린다는 포켓몬.',
  squirtle:'등껍질 속에서 몸을 웅크리면 방어력이 급상승.', pidgey:'겁이 많지만 날개짓만은 재빠르다.',
  rattata:'무엇이든 갉아대는 습성 때문에 이빨이 계속 자란다.', clefairy:'보름달이 뜨면 춤을 춘다는 전설이 있다.',
  oddish:'낮엔 땅에 몸을 묻고 밤에만 움직인다.', diglett:'지상에 보이는 건 몸의 일부일 뿐이다.',
  psyduck:'늘 두통에 시달려서 머리를 감싸쥐고 있다.', growlithe:'충성심이 강해 주인을 끝까지 지킨다.',
  abra:'하루의 대부분을 잠으로 보내며 힘을 모은다.', magnemite:'전자석의 힘으로 공중에 떠있다.',
  charmeleon:'성격이 거칠어져 다루기 어려워진다.', wartortle:'복슬복슬한 꼬리는 나이의 상징.',
  kadabra:'주위에 강한 염력파를 뿜어내 기계를 오작동시킨다.', geodude:'산길에 굴러다니는 바위로 착각하기 쉽다.',
  gastly:'가스로 이루어진 몸이라 바람이 불면 흩어진다.', lickitung:'긴 혀로 뭐든 핥아서 맛을 확인한다.',
  horsea:'꼬리를 감아 해초나 산호에 몸을 고정한다.', magneton:'마그네미트 세 마리가 강한 자력으로 뭉쳤다.',
  dratini:'허물을 벗을 때마다 더 강해진다는 신비한 포켓몬.', charizard:'입에서 불꽃을 내뿜으면 근처 온도가 급상승.',
  blastoise:'등의 대포는 물을 압축해서 쏘아낸다.', alakazam:'IQ 5000, 인류의 지혜를 초월했다는 두뇌.',
  gyarados:'평소엔 얌전하지만 화나면 마을 하나를 가라앉힌다.', lapras:'사람을 태우고 바다를 건너주는 다정한 포켓몬.',
  aerodactyl:'호박 속 화석에서 부활한 고대의 포켓몬.', dragonair:'몸의 구슬에 신비한 힘을 모은다는 전설.',
  articuno:'날갯짓 한 번에 눈이 흩날린다는 전설의 새.', zapdos:'뇌운을 두르고 하늘을 가르는 전설의 새.',
  moltres:'날개에서 떨어지는 불씨가 봄을 알린다는 전설.', dragonite:'바다에서 조난자를 육지까지 데려다준다는 이야기.',
  mewtwo:'인류가 만들어낸 가장 강력하고 잔혹한 포켓몬.', mew:'모든 포켓몬의 유전자를 담고 있다는 환상의 포켓몬.',
};
window.FLAVOR_TEXT = FLAVOR_TEXT;

// ===== v27: 밸런스 재설계 - 기본 스탯 전체 하향 (초반엔 약하게, 업그레이드 투자가 중요해지도록) =====
// v27-3: 사거리 추가 하향 (0.93 -> 0.72) - 위치별 배치가 의미 있어지고, 사거리 강화템 구매가 가치있어지도록
// v27-59: 데미지는 등급 구분 없이 똑같이 46%로 깎여서 노말/레어가 절대값이 너무 작아지고(5~10대),
// 유니크가 레전드랑 DPS가 거의 안 갈리는 문제가 있었음 (요청: "합쳐서 등급 올리는 의미가 느껴지게").
// 등급별로 다른 배율을 줘서 등급이 오를수록 격차가 더 크게 벌어지도록 재설계.
// v28 (설계서 §4): 등급별 '평균 기본 데미지'를 절대값 목표에 맞춤 (단계당 약 2.5배).
// 같은 등급 안의 상대 차이(종마다 다른 개성)는 그대로 유지하고 평균만 목표로 스케일.
const GRADE_BASE_DMG = { normal:8, rare:20, epic:50, legend:120, unique:280 };
{
  const sum = {}, cnt = {};
  for (const id in GachaTowerDefs) { const g = GachaTowerDefs[id].grade; sum[g] = (sum[g]||0) + GachaTowerDefs[id].damage; cnt[g] = (cnt[g]||0) + 1; }
  for (const id in GachaTowerDefs) {
    const d = GachaTowerDefs[id];
    const avg = sum[d.grade] / cnt[d.grade];
    d.damage   = Math.round(d.damage * (GRADE_BASE_DMG[d.grade] / avg) * 10) / 10;
    d.fireRate = Math.round(d.fireRate * 0.68 * 100) / 100;
    d.range    = Math.round(d.range * 0.72);
  }
}
// v27-59 버그수정: 파이어(moltres)만 기본 공속이 3.0으로 다른 레전드(1.3~2.0)보다 훨씬 빨라서
// 혼자 유니크보다 DPS가 세지는 이상치였음 - 다른 레전드 수준으로 조정
GachaTowerDefs.moltres.fireRate = Math.round(2.0 * 0.68 * 100) / 100;

// ===== 헬퍼 =====
function _shot(tower, engine, color, emoji, status, speed, onHit, splash, knockback) {
  if (!tower.target) return;
  // v27-6: MVP 집계용 데미지 출력량 트래킹 (요청4 - 게임오버 요약화면)
  engine.projectiles.push(new Projectile(tower.x, tower.y, tower.target, {
    engine, speed:speed||380, damage:tower.damage,
    color, size:5, dmgType:'special', emoji, status, onHit,
    splash:splash||0, knockback:knockback||0,
  }));
}

// ===== 뽑기 확률 =====
// v27-3: 도박뽑기 확률이 너무 후해서 초반부터 전설급을 금방 채웠던 문제 - 확률 낮추고 가격 상향
const PULL_TABLES = {
  // v27-20: 뽑기 확률 전면 재설계 (요청8)
  normal:   [{grade:'normal',weight:100}], // 일반뽑기 = 1성(노말)만 나옴
  premium:  [{grade:'normal',weight:62},{grade:'rare',weight:37},{grade:'epic',weight:1}], // 1~3성, 3성은 극희귀
  gamble:   [{grade:'rare',weight:52},{grade:'epic',weight:41.5},{grade:'legend',weight:6.3},{grade:'unique',weight:0.2}], // 2~5성, 4성 극악 5성 극극극극극악
  ten_base: [{grade:'normal',weight:100}], // 10연뽑 = 일반뽑기 10번 묶음(동일확률, 개당만 할인)
};
const PULL_COSTS = { normal:100, premium:260, gamble:2000, ten:900 }; // v27-43: 도박뽑기 3000→2000 (요청5)

const GRADE_POOLS = {
  normal:  ['bulbasaur','charmander','squirtle','pidgey','rattata','clefairy','oddish','diglett','psyduck','growlithe','abra','magnemite'],
  rare:    ['charmeleon','wartortle','kadabra','geodude','gastly','lickitung','horsea','magneton','dratini','ivysaur','pidgeotto','raticate','clefable','gloom','dugtrio','golduck','arcanine'],
  epic:    ['charizard','blastoise','alakazam','gyarados','lapras','aerodactyl','dragonair','venusaur','pidgeot','vileplume','haunter'],
  legend:  ['articuno','zapdos','moltres','dragonite','gengar'],
  unique:  ['mewtwo'], // v27-4: mew는 가챠풀에서 제외 - 합치기(전설 3개→유니크)로만 획득 가능 (item3)
};

// ===== 합치기 진화 =====
const MERGE_EVOLUTION = {
  // 노말 3개 → 레어 (전부 정통 진화형으로 정비, v27-17)
  bulbasaur:'ivysaur',   charmander:'charmeleon', squirtle:'wartortle',
  pidgey:'pidgeotto',    rattata:'raticate',      clefairy:'clefable',
  oddish:'gloom',        diglett:'dugtrio',       psyduck:'golduck',
  growlithe:'arcanine',  abra:'kadabra',          magnemite:'magneton',
  // 레어 3개 → 에픽 (정통 진화가 있는 건 정통으로, 없는 건 타입 맞춰 합류)
  charmeleon:'charizard',wartortle:'blastoise',   kadabra:'alakazam',
  geodude:'aerodactyl',  lickitung:'blastoise',   gastly:'haunter',
  horsea:'gyarados',     magneton:'aerodactyl',
  dratini:'dragonair',   ivysaur:'venusaur',
  pidgeotto:'pidgeot',   raticate:'lapras',       clefable:'alakazam',
  gloom:'vileplume',     dugtrio:'aerodactyl',    golduck:'gyarados',
  arcanine:'charizard',
  // 에픽 3개 → 레전드
  charizard:'moltres',   blastoise:'articuno',    alakazam:'zapdos',
  gyarados:'articuno',   lapras:'articuno',       aerodactyl:'zapdos',
  dragonair:'dragonite', venusaur:'articuno',
  pidgeot:'zapdos',      vileplume:'articuno',    haunter:'gengar',
  // v28: 레전드 3개 → 유니크 확정 경로 제거 - 유니크는 레시피(RECIPES) 전용 (설계서 §3)
};

// ===== v28 (설계서 §3): 랜덤 합성 · 레시피 =====
// 같은 등급 아무거나 3개 → 다음 등급 랜덤 (랜타디 방식). 유니크는 랜덤으로 절대 안 나옴.
const NEXT_GRADE = { normal:'rare', rare:'epic', epic:'legend' };
const MERGE_ORDER = ['normal','rare','epic','legend','unique'];
// 숨은 천장: 같은 계열(역할군, 없으면 타입)이 3연속 나오면 다른 계열 가중치 ×1.5 (겉보기엔 완전 랜덤)
function _pityKey(def) { return def.role || def.type; }
// v3.8 메가 원본 끌림: 필드에 메가 원본(★5 미만)이 있으면 그 등급 결과의 25%가 그 종으로 → 먹이(같은 종) 확보
//   쁘사이저·프테라·캥카처럼 진화 단계가 없는 종은 같은 종을 모을 방법이 우연뿐이라 먹이 버튼이 사실상 안 떴음
function _megaPull(grade) {
  const e = window.app && app.engine; if (!e || !window.MEGA_OF || Math.random() >= 0.25) return null;
  const ids = [...new Set(e.towers.filter(t => t.def && ((t.def._stack || 1) < 5)).map(t => // 메가 원본·레전드, 그리고 ★5 미만 메가는 그 원본 종
    t.def.mega ? t.def.megaOf : (MEGA_OF[t.def.id] || t.def.grade === 'legend') ? t.def.id : null)
    .filter(id => id && GachaTowerDefs[id] && GachaTowerDefs[id].grade === grade))];
  return ids.length ? ids[Math.floor(Math.random() * ids.length)] : null;
}
function rollRandomMerge(grade, state = {}) {
  let target = NEXT_GRADE[grade];
  if (!target) return null;
  // 토게틱 등 '2등급 상승' 훅 (노말·레어 합성에만, 결과 상한 레전드)
  if (state.jumpChance && (grade === 'normal' || grade === 'rare') && Math.random() < state.jumpChance) {
    target = NEXT_GRADE[target] || target;
    state.jumped = true;
  }
  const pool = GRADE_POOLS[target] || [];
  const hist = state.history || (state.history = []);
  const locked = hist.length >= 3 && hist.slice(-3).every(k => k === hist[hist.length - 1]) ? hist[hist.length - 1] : null;
  const pw = state.pityWeight || 1.5; // 토게피 '직감' 노드면 2.5
  const tw = (window.DEX_TYPE_W && window.DEX_TYPE_W[target]) || {};
  const weights = pool.map(id => ((locked && _pityKey(GachaTowerDefs[id]) !== locked) ? pw : 1) * (tw[id] || 1));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0), id = pool[pool.length - 1];
  for (let k = 0; k < pool.length; k++) { r -= weights[k]; if (r <= 0) { id = pool[k]; break; } }
  id = _megaPull(target) || id;
  const def = GachaTowerDefs[id];
  hist.push(_pityKey(def)); if (hist.length > 6) hist.shift();
  return { ...def, _starLevel: 1 };
}
// 유니크 레시피 - items: 재료 후보 배열(def 목록). pick(items)는 소모할 재료 인덱스 배열 또는 null
const RECIPES = [
  { id:'mew', name:'뮤', emoji:'💗', cost:0,
    desc:'서로 다른 레전드 3종',
    pick(items, opts = {}) {
      const seen = new Set(), idx = [];
      items.forEach((d, i) => { if (d.grade === 'legend' && !seen.has(d.id) && idx.length < 3) { seen.add(d.id); idx.push(i); } });
      if (idx.length === 3) return idx;
      // 토게피 '기적': 서로 다른 레전드 2종 + 에픽 3개로도 가능
      if (opts.miracle && idx.length === 2) {
        const epics = []; items.forEach((d, i) => { if (d.grade === 'epic' && epics.length < 3) epics.push(i); });
        if (epics.length === 3) return [...idx, ...epics];
      }
      return null;
    } },
  { id:'mewtwo', name:'뮤츠', emoji:'🔮', cost:2000,
    desc:'뮤 + 레전드 아무거나 2 + 2000골드',
    pick(items) {
      const mew = items.findIndex(d => d.id === 'mew');
      if (mew < 0) return null;
      const legs = []; items.forEach((d, i) => { if (d.grade === 'legend' && legs.length < 2) legs.push(i); });
      return legs.length === 2 ? [mew, ...legs] : null;
    } },
];

// ===== 뽑기 함수 =====
function rollGrade(tableKey) {
  const table = PULL_TABLES[tableKey] || PULL_TABLES.normal;
  const total = table.reduce((s,t)=>s+t.weight,0);
  let r = Math.random()*total;
  for(const entry of table){ r-=entry.weight; if(r<=0) return entry.grade; }
  return table[table.length-1].grade;
}
function rollTower(tableKey) {
  const grade = rollGrade(tableKey);
  const pool = GRADE_POOLS[grade];
  // v28 세션D: 타입 균등 (pokedex.js의 DEX_TYPE_W) - 타입을 먼저 고르고 그 안에서 종 선택
  const tw = (window.DEX_TYPE_W && window.DEX_TYPE_W[grade]) || {};
  let r = Math.random() * pool.reduce((a, id) => a + (tw[id] || 1), 0), id = pool[pool.length - 1];
  for (const k of pool) { r -= (tw[k] || 1); if (r <= 0) { id = k; break; } }
  id = _megaPull(grade) || id;
  return {...GachaTowerDefs[id], _starLevel:1};
}

// v27: 이미 구매한 타입강화를 새 타워 생성시점에 소급 적용 (이게 없어서 업그레이드가 안 먹는 것처럼 보였음)
function _computeTypeBuffMuls(type) {
  const level = TypeUpgradeLevels[type] || 0;
  let dmg = 1, range = 1, speed = 1, flatTiers = 0;
  // v27-10: 요청 반영 - 어떤 타입/단계를 올리든 항상 데미지가 오르도록 통일 (기존엔 물=사거리만, 전기=공속만 식으로
  // 타입에 따라 데미지가 전혀 안 오르는 경우가 있어서 "속성 업글했는데 공격력이 안 오른다"는 혼란이 있었음)
  for (let i = 0; i < level; i++) {
    const u = getTypeUpgradeAt(type, i); // v27-4: 무한티어 대응 (5단계 이후도 소급적용)
    dmg *= (1 + u.val);
    flatTiers += (u.flat || 0);
  }
  return { dmg, range, speed, flatTiers };
}

// ===== 타워 생성 =====
function _createGachaTower(def, x, y, engine) {
  const muls = _computeTypeBuffMuls(def.type);
  // v27-5: 숙련도 (item2) - 같은 포켓몬을 중복으로 뽑을수록 그 포켓몬 전용 데미지 보너스 (합체 안 해도 저등급이 계속 쓸모 있어짐)
  const masteryMul = 1; // v28 세션E: 숙련도 제거 (151종이라 같은 종 중복이 드묾 - 확정진화가 대체)
  const t = {
    x, y, _gachaId:def.id, def,
    name:def.name, level:1, path:null, totalSpent:0,
    cooldown:0, fireFlash:0, _rotAngle:0, _bobPhase: Math.random()*Math.PI*2,
    synergyBonus:0, buffRangeMul:muls.range, buffDmgMul:muls.dmg, _shopSpeedMul:muls.speed, target:null, masteryMul,
    flatDmg:(TYPE_FLAT_PER_TIER[def.grade]||2)*muls.flatTiers, // v28: 이미 산 타입강화 소급 적용
    _tempDmgMul:1, _pokecenterTimer:0, _auraDmgMul:1, // v27-29: 임시버프+오라 전용 필드 (영구곱연산 버그 수정)
    get range(){ return (def.range+(this.synergyBonus*2))*Math.min(this.buffRangeMul, BUFF_CAPS.range)*(this._heroRangeMul||1)*(this._cardRng||1); },
    get damage(){
      const base = (def.damage+this.synergyBonus+(this.flatDmg||0))*Math.min(this.buffDmgMul, BUFF_CAPS.damage)*this.masteryMul*(this._tempDmgMul||1)*(this._auraDmgMul||1)*(this._heroDmgMul||1)*(this._divMul||1)*(1+((this.def&&this.def.hidden)?0.8:0.35)*(((this.def&&this.def._stack)||1)-1))*(this._cardDmg||1); // v3.2: 타입 다양성 · 각성 ★ · v3.5 카드
      const mul = window.typeEffectiveness ? window.typeEffectiveness(def.type, this.target && this.target.typeTag) : 1;
      return base * mul;
    },
    get fireRate(){ return def.fireRate*Math.min(this._shopSpeedMul||1, BUFF_CAPS.speed)*(this._tempSpeedMul||1)*(this._heroSpeedMul||1)*(this._cardSpd||1); },
    upgradeCost(){ return null; },
    findTarget(enemies){
      // v27-62 최적화: Math.hypot(제곱근)을 거리² 비교로 대체 - 결과는 완전히 동일하고 sqrt 비용만 제거
      const r2 = this.range * this.range;
      if(this.target&&!this.target.dead&&!this.target.reachedEnd){
        const dx=this.target.x-this.x, dy=this.target.y-this.y;
        if(dx*dx+dy*dy<=r2) return this.target;
      }
      // v27-25: 타겟이 없을 때의 전체스캔을 초당 최대 10회로 제한 (요청2 - 필드 밀집시 매프레임 O(타워x적)
      // 전수조사가 누적되어 모바일 프레임드랍 유발 가능성) - 유효 타겟 있을 때는 기존처럼 즉시 반환하니 반응성 손실 없음
      const nowMs = performance.now();
      if (this._lastScanAt && nowMs - this._lastScanAt < 100 && this._noTargetCache !== undefined) {
        return this._noTargetCache;
      }
      let best=null,bestP=-1;
      for(const e of enemies){
        if(e.dead||e.reachedEnd) continue;
        const dx=e.x-this.x, dy=e.y-this.y;
        if(dx*dx+dy*dy>r2) continue;
        if(e.distTraveled>bestP){ bestP=e.distTraveled; best=e; }
      }
      this._lastScanAt = nowMs;
      this._noTargetCache = best;
      return best;
    },
    update(dt,enemies,engine){
      this.engine=engine;
      this.cooldown-=dt;
      if(this.fireFlash>0) this.fireFlash-=dt;
      if(this._typeGlowTimer>0) this._typeGlowTimer-=dt;
      if(this._evolveGlowTimer>0) this._evolveGlowTimer-=dt; // v27-5: 합체진화 연출 (item1)
      // v27-29 버그수정: 포켓몬센터 임시버프가 만료 처리가 아예 없어서 재사용할 때마다 데미지가
      // 영구적으로 곱연산 누적되고 있었음(핵심 버그) - 이제 타이머 소진시 정상적으로 원상복귀됨
      if(this._pokecenterTimer>0){
        this._pokecenterTimer-=dt;
        if(this._pokecenterTimer<=0){ this._tempDmgMul=1; this._tempSpeedMul=1; }
      }
      this._rotAngle+=dt*0.5;
      this.target=this.findTarget(enemies);
      if(this.target&&this.cooldown<=0){
        this.cooldown=1/this.fireRate;
        this.fireFlash=0.1;
        this._shots = (this._shots || 0) + 1; // v3.5 카드 '강타': 3번째 공격마다 배율
        engine._dmgStrike = (this._cardStrike && this._shots % 3 === 0) ? this._cardStrike : 0;
        engine._dmgSrc = this; def.fire(this,engine); engine._dmgSrc = null; engine._dmgStrike = 0; // v3.2: 실제 데미지 귀속 (MVP 정확도)
      }
    },
    draw(ctx){
      const grade=GRADES[def.grade];
      const typeInfo=TYPES[def.type]||TYPES.normal;

      // v3.6 행동 가능 링: 합성은 보관함에서 하므로 '같은 타워 3개' 대신 메가진화(골드)·먹이기(초록) 가능할 때만
      if(this.engine && window.MEGA && window.app){
        const nowMs2 = Date.now();
        if(!this._actAt || nowMs2 - this._actAt > 500){
          this._actAt = nowMs2;
          this._act = MEGA.canMega(app, this) ? 'mega' : MEGA.canFeed(app, this) > 0 ? 'feed' : null;
        }
        if(this._act){
          const c = this._act === 'mega' ? '255,194,75' : '52,211,153';
          ctx.save(); ctx.beginPath(); ctx.arc(this.x,this.y,30,0,Math.PI*2);
          ctx.strokeStyle=`rgba(${c},0.22)`; ctx.lineWidth=6; ctx.stroke();
          ctx.strokeStyle=`rgba(${c},${0.55+Math.sin(nowMs2*0.006)*0.3})`; ctx.lineWidth=2.2;
          if(this._act === 'feed') ctx.setLineDash([4,3]);
          ctx.stroke(); ctx.restore();
        }
      }
      // 유니크 무지개 링
      if(def.grade==='unique'){
        ctx.save(); const hue=(Date.now()*0.1)%360;
        ctx.strokeStyle=`hsla(${hue},100%,65%,0.8)`;
        ctx.lineWidth=2.5; ctx.setLineDash([5,4]);
        ctx.beginPath(); ctx.arc(this.x,this.y,27,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
      // v27-17: 숙련도 각성(20/20 마스터) 오라 (요청1) - 무지개링과 겹쳐도 구분되게 바깥쪽 큰 링으로
      if(false){ // v28 세션E: 숙련도 제거 // 20중복 = 1+20*0.02 = 1.4
        ctx.save(); const hue2=(Date.now()*0.08+120)%360;
        // v27-62 최적화: shadowBlur 제거 - 반투명 굵은 링으로 글로우 대체
        ctx.strokeStyle=`hsla(${hue2},90%,70%,0.25)`; ctx.lineWidth=4;
        ctx.beginPath(); ctx.arc(this.x,this.y,35+Math.sin(Date.now()*0.004)*2,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle=`hsla(${hue2},90%,70%,0.55)`; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(this.x,this.y,35+Math.sin(Date.now()*0.004)*2,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }
      // 합체·메가진화 직후 연출 (v3.6: 빛기둥 + 방사 광선 + 이중 확장 링, 스프라이트는 아래에서 흰 실루엣→원래 색)
      if(this._evolveGlowTimer>0){
        const p = Math.min(1, Math.max(0, 1 - this._evolveGlowTimer/1.2)); // 0→1 진행도 (범위 고정 - 음수 반지름 방지)
        const ease = 1 - Math.pow(1 - p, 3);
        ctx.save();
        // 빛기둥
        const pillarA = Math.max(0, 1 - p * 1.4);
        if (pillarA > 0) {
          const pw = 26 * (1 - p * 0.6);
          const g = ctx.createLinearGradient(0, this.y - 90, 0, this.y + 20);
          g.addColorStop(0, grade.color + '00'); g.addColorStop(0.6, grade.color + 'aa'); g.addColorStop(1, '#ffffff');
          ctx.globalAlpha = pillarA * 0.7; ctx.fillStyle = g;
          ctx.fillRect(this.x - pw / 2, this.y - 90, pw, 110);
        }
        // 방사 광선
        ctx.globalAlpha = Math.max(0, 1 - p) * 0.8; ctx.strokeStyle = grade.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const ang = i * Math.PI / 4 + p * 0.6, r0 = 18 + ease * 16, r1 = r0 + 10 * (1 - p);
          ctx.beginPath(); ctx.moveTo(this.x + Math.cos(ang) * r0, this.y + Math.sin(ang) * r0);
          ctx.lineTo(this.x + Math.cos(ang) * r1, this.y + Math.sin(ang) * r1); ctx.stroke();
        }
        // 확장 링
        ctx.globalAlpha = Math.max(0, 1 - p);
        ctx.beginPath(); ctx.arc(this.x, this.y, 22 + ease * 34, 0, Math.PI * 2);
        ctx.lineWidth = 3 * (1 - p) + 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(this.x, this.y, 14 + ease * 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.globalAlpha = Math.max(0, (1 - p) * 0.7); ctx.stroke();
        ctx.restore();
      }
      // 타입 강화 직후 색깔 링 (어떤 타워가 방금 버프받았는지 명확히 표시)
      if(this._typeGlowTimer>0){
        ctx.save(); ctx.globalAlpha=Math.min(1,this._typeGlowTimer/1.6);
        ctx.beginPath(); ctx.arc(this.x,this.y,25,0,Math.PI*2);
        ctx.strokeStyle=this._typeGlowColor; ctx.lineWidth=3;
        ctx.shadowColor=this._typeGlowColor; ctx.shadowBlur=0; ctx.stroke(); ctx.restore();
      }
      // 발사 플래시
      if(this.fireFlash>0){
        ctx.save(); ctx.globalAlpha=(this.fireFlash/0.1)*0.35;
        ctx.beginPath(); ctx.arc(this.x,this.y,26,0,Math.PI*2);
        ctx.fillStyle=typeInfo.color; ctx.fill(); ctx.restore();
      }
      // 베이스 패드 (v3.6: 등급별로 1회 그려둔 메달 받침 - 그림자·입체 테두리·하이라이트)
      ctx.save();
      if (!window.__3d) ctx.drawImage(towerBaseSprite(def.grade), this.x-30, this.y-30, 60, 60); // 3D: 엔진이 바닥에 붙여 그림
      // 포켓몬 이미지: 진화단계 전용(id) 이미지 우선, 없으면 라인 공통(pokemonId) 이미지로 폴백
      // v27 fix: towers 폴더에 이미지가 없으면 같은 이름의 enemies 폴더 이미지로 자동 폴백 (파일 중복 업로드 불필요)
      const imgPath=window.TowerSpriteImages?.[def.id] || window.TowerSpriteImages?.[def.pokemonId]
        || window.EnemySpriteImages?.[def.id] || window.EnemySpriteImages?.[def.pokemonId];
      const img=imgPath?window.loadSpriteImage?.(imgPath):null;
      const gradeBonus={normal:0,rare:2,epic:5,legend:7,unique:10};
      const sz=34+(gradeBonus[def.grade]||0);
      if(img&&img.complete&&img.naturalWidth>0){
        // v27-10: 이미지 여백 자동크롭 적용 - 스프라이트마다 다른 여백 비율을 통일해서 원 안에 고르게 꽉 차 보이게
        const b = window.SpriteBoundsCache?.[imgPath];
        const nw = b ? b.w : img.naturalWidth, nh = b ? b.h : img.naturalHeight;
        const asp=nw/nh;
        const dw=asp>=1?sz:sz*asp, dh=asp>=1?sz/asp:sz;
        // v27-58: 정적인 이미지가 밋밋해 보여서, 살짝 위아래로 숨쉬듯 흔들리는 아이들 애니메이션 추가
        // (타워별로 위상차를 둬서 전부 같은 박자로 안 움직이게 함)
        const bobY = Math.sin(this._rotAngle*2.2 + this._bobPhase) * 2.2;
        // v3.13 세워 그리기: 받침은 땅에, 포켓몬은 받침 위에 발을 딛고 서 있게 (세로 STAND_K배, 발끝 기준)
        const SK = window.STAND_K || 1, sh = dh * SK, feet = this.y + dh * 0.3, sy = feet - sh + bobY;
        ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.beginPath(); ctx.ellipse(this.x, feet - 1, dw * 0.34, 4, 0, 0, Math.PI * 2); ctx.fill();
        if (b) ctx.drawImage(window.litSprite ? litSprite(img) : img, b.x, b.y, b.w, b.h, this.x-dw/2, sy, dw, sh); // 3D: 햇빛 방향 입체감
        else ctx.drawImage(window.litSprite ? litSprite(img) : img,this.x-dw/2,sy,dw,sh);
        if (this._evolveGlowTimer > 0.6 && window.tintedSprite) { // 진화 직후 0.6초: 흰 실루엣이 걷히며 새 모습 등장
          ctx.globalAlpha = Math.min(1, (this._evolveGlowTimer - 0.6) / 0.6);
          ctx.drawImage(tintedSprite(img, imgPath, b, '#ffffff'), this.x-dw/2, sy, dw, sh);
          ctx.globalAlpha = 1;
        }
      } else {
        const ti = window.ICON_IMG && ICON_IMG(def.type); // v3.0: 이미지 없는 포켓몬 = 타입 배지 + 이름 첫 글자
        if (ti && ti.complete) ctx.drawImage(ti, this.x - sz*0.42, this.y - sz*0.42, sz*0.84, sz*0.84);
        ctx.font=`900 ${Math.round(sz*0.3)}px Pretendard,-apple-system,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.strokeText(def.name[0], this.x, this.y + sz*0.42);
        ctx.fillStyle='#fff'; ctx.fillText(def.name[0], this.x, this.y + sz*0.42);
      }
      // 등급 별 (v3.6: 텍스트 ★ 대신 받침 아래 작은 별 리본)
      ctx.drawImage(towerStarSprite(def.grade), this.x-20, this.y+14, 40, 12);
      // 타입 배지
      const tb = window.ICON_IMG && ICON_IMG(def.type);
      if (tb && tb.complete) {
        ctx.beginPath(); ctx.arc(this.x+17, this.y-16, 7.5, 0, Math.PI*2); ctx.fillStyle='rgba(12,14,20,0.85)'; ctx.fill();
        ctx.drawImage(tb, this.x+11, this.y-22, 12, 12);
      }
      ctx.restore();
    },
  };
  if (engine && window.applyShopBuffs) window.applyShopBuffs(t, engine);
  return t;
}

// ===== v3.6 타워 받침·별 스프라이트 (등급별 1회 렌더, 3배 해상도) =====
const _towerSpriteCache = {};
function _shade(hex, amt) { // amt -1..1 : 어둡게/밝게
  const n = parseInt(hex.slice(1), 16), f = amt < 0 ? 0 : 255, t = Math.abs(amt);
  const c = sh => Math.round(((n >> sh) & 255) * (1 - t) + f * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
// v3.13 받침: 어두운 원판을 없애고 땅 위 링만 (포켓몬이 배경에 자연스럽게 서 있게, 영웅처럼). 3D 기울기가 링을 납작하게 보여줌
function towerBaseSprite(gradeKey) {
  const k = 'base_' + gradeKey;
  if (_towerSpriteCache[k]) return _towerSpriteCache[k];
  const G = GRADES[gradeKey] || GRADES.normal, S = 3, c = document.createElement('canvas');
  c.width = c.height = 60 * S;
  const x = c.getContext('2d'); x.scale(S, S); x.translate(30, 30);
  const sh = x.createRadialGradient(1, 2, 4, 1, 2, 20); sh.addColorStop(0, 'rgba(0,0,0,0.30)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); // 접지 그림자
  x.fillStyle = sh; x.beginPath(); x.arc(1, 2, 20, 0, Math.PI * 2); x.fill();
  const col = gradeKey === 'normal' ? '#e8eef5' : G.color;
  if (gradeKey !== 'normal') { x.strokeStyle = col; x.globalAlpha = 0.22; x.lineWidth = 6; x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.stroke(); } // 은은한 등급 빛
  x.globalAlpha = gradeKey === 'normal' ? 0.5 : 0.9; x.strokeStyle = col; x.lineWidth = 1.8; x.beginPath(); x.arc(0, 0, 20, 0, Math.PI * 2); x.stroke();
  x.globalAlpha = 0.45; x.strokeStyle = '#fff'; x.lineWidth = 0.8; x.beginPath(); x.arc(0, 0, 20, Math.PI * 1.1, Math.PI * 1.7); x.stroke();
  return (_towerSpriteCache[k] = c);
}
function towerStarSprite(gradeKey) {
  const k = 'star_' + gradeKey;
  if (_towerSpriteCache[k]) return _towerSpriteCache[k];
  const G = GRADES[gradeKey] || GRADES.normal, n = G.stars, S = 3, c = document.createElement('canvas');
  c.width = 40 * S; c.height = 12 * S;
  const x = c.getContext('2d'); x.scale(S, S);
  const w = 6 + n * 7, l = 20 - w / 2;
  x.fillStyle = 'rgba(10,12,18,0.88)'; x.beginPath(); x.roundRect(l, 1, w, 10, 5); x.fill();
  x.strokeStyle = G.color + '88'; x.lineWidth = 0.8; x.stroke();
  x.fillStyle = G.color;
  for (let i = 0; i < n; i++) {
    const cx = l + 6.5 + i * 7, cy = 6;
    x.beginPath();
    for (let j = 0; j < 10; j++) { const r = j % 2 ? 1.35 : 3.1, a = -Math.PI / 2 + j * Math.PI / 5; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    x.closePath(); x.fill();
  }
  return (_towerSpriteCache[k] = c);
}

// ===== 시너지 (타입별) =====
// v27-4: 시너지 페어 확장 (기존엔 ice/ghost 타입 참조가 있었는데 실제 TYPES엔 그 타입 자체가 없어서 죽은 코드였음)
// 6타입 전체 조합(15쌍) 커버 - 조합 다양성을 위해 전부 정의
const SYNERGY_PAIRS = {
  'fire|water':    { bonus: 5, label:'수증기' },
  'fire|grass':    { bonus: 4, label:'그을림' },
  'fire|electric': { bonus: 6, label:'점화폭발' },
  'fire|psychic':  { bonus: 5, label:'화염투시' },
  'fire|normal':   { bonus: 5, label:'열기지원' },
  'water|grass':   { bonus: 6, label:'생명의비' },
  'water|electric':{ bonus: 5, label:'감전수류' },
  'water|psychic': { bonus: 5, label:'심해투시' },
  'water|normal':  { bonus: 5, label:'급류지원' },
  'grass|electric':{ bonus: 5, label:'자연전류' },
  'grass|psychic': { bonus: 6, label:'포자투시' },
  'grass|normal':  { bonus: 5, label:'광합성지원' },
  'electric|psychic':{ bonus: 6, label:'뇌파공명' },
  'electric|normal':{ bonus: 5, label:'전류지원' },
  'psychic|normal':{ bonus: 5, label:'염력지원' },
};
function applyTowerSynergies(towers) {
  // v27-46: 일반 타입 시너지(같은/유사 타입 근접 배치 보너스) 완전 제거함 (요청4 - "너무 랜덤이라
  // 없애도 될 것 같다"). 피삐/픽시블 전용 오라는 그 타워 고유 능력이라 유지함.
  for(const t of towers) { t.synergyBonus=0; t._auraDmgMul=1; }
  // v3.2 (D): 필드의 서로 다른 타입 수 보너스 - 4종 +10% / 5종 +20% / 6종 +30% (위치 무관)
  const _types = new Set(towers.map(t => t.def && t.def.type).filter(Boolean)).size;
  const _div = _types >= 6 ? 1.3 : _types >= 5 ? 1.2 : _types >= 4 ? 1.1 : 1;
  for (const t of towers) t._divMul = _div;
  if (window.app && window.app._onDiversityChange) window.app._onDiversityChange(_types, _div);
  if (window.CARDS && window.app && window.app.engine) window.CARDS.applyCardsToTowers(window.app.engine, towers); // v3.5 카드
  for(let i=0;i<towers.length;i++){
    for(let j=i+1;j<towers.length;j++){
      const a=towers[i],b=towers[j];
      if(!a.def||!b.def) continue;
      const dist = Math.hypot(a.x-b.x,a.y-b.y);
      // v28 세션D: '지원' 역할 포켓몬 전부 오라 (등급별 +15~40%, 반경 150, 중첩 안 됨 - 가장 큰 것만)
      if (dist >= 150) continue;
      const aw = window.DEX_TEMPLATE && window.DEX_TEMPLATE.supportAura;
      if (aw && a.def.role==='support' && !a.def._signature) b._auraDmgMul=Math.max(b._auraDmgMul,1+aw[a.def.grade]);
      if (aw && b.def.role==='support' && !b.def._signature) a._auraDmgMul=Math.max(a._auraDmgMul,1+aw[b.def.grade]);
    }
  }
}

// ===== 타입 업그레이드 (6종, v27: 3단계 -> 5단계 확장 + 가격 상향) =====
// v28 (설계서 §5): % 곱연산 → '등급별 절대값 + 6%'. 노말(8뎀)도 올리면 확실히 체감되고,
// 무한강화는 선형이라 후반 화력 폭주를 막음. flat = 등급별 고정치 배수, val = 타워 %, heroVal = 영웅 %.
const TYPE_FLAT_PER_TIER = { normal:2, rare:5, epic:12, legend:28, unique:65 };
const _TU_COSTS = [120, 300, 600, 1000, 1600]; // v3.0: 첫 강화 문턱 낮춤 (200→120)
const _TU_NAMES = { fire:'대화염', water:'대해일', electric:'초전도', grass:'대자연', psychic:'초능력', normal:'만능' };
const _TU_KR = { fire:'불꽃', water:'물', electric:'전기', grass:'풀', psychic:'에스퍼', normal:'노말' };
const TypeUpgrades = {};
for (const t of ['fire','water','electric','grass','psychic','normal']) {
  TypeUpgrades[t] = _TU_COSTS.map((cost, i) => ({
    cost, label: i === 4 ? _TU_NAMES[t] : `${_TU_KR[t]} 강화 ${i+1}`, buff:'dmg', flat:1, val:0.06, heroVal:0.15,
  }));
}
// 타입별 업그레이드 레벨 추적
const TypeUpgradeLevels = {};
for(const t in TypeUpgrades) TypeUpgradeLevels[t]=0;

// v27-4: 5단계 이후에도 계속 강화 가능하도록 무한 반복 티어 생성 (엔드리스라 후반에 쓸 곳이 없어지는 문제 방지)
// 마지막 티어의 버프 종류를 유지하되, 가격은 계속 오르고 효과는 완만하게 체감(그래도 0은 안 됨)
function getTypeUpgradeAt(type, level) {
  const upgrades = TypeUpgrades[type];
  if (level < upgrades.length) return upgrades[level];
  const last = upgrades[upgrades.length - 1];
  const extra = level - upgrades.length + 1; // 1,2,3...
  // v27-46 버그수정: 기존엔 효과값이 0.86^n로 계속 줄어드는데 비용은 1.55^n로 계속 올라서, 후반
  // 투자가 갈수록 무의미해지고 있었음 (요청: "1500원쯤 되면 올리기 힘든데 그만큼 세지지도 않음").
  // 효과값 감쇠를 없애서 비싸지는 만큼 확실히 강해지도록 함 (전략적 몰빵 투자가 실제로 유효해짐).
  return {
    cost: Math.round(last.cost * Math.pow(1.45, extra)),
    label: `${TYPES[type].name} 초월강화 ${extra}`,
    buff: 'dmg', flat: 0.5, val: 0, heroVal: 0.06, // v28: 선형 (고정치 절반만, % 없음)
  };
}

function applyTypeUpgrade(type, engine) {
  const level = TypeUpgradeLevels[type]||0;
  const upg = getTypeUpgradeAt(type, level);
  if(!engine.spendGold(upg.cost)) return false;
  TypeUpgradeLevels[type]++;
  const color = TYPES[type].color;
  // v27-10: 어떤 타입/단계든 항상 데미지가 오르도록 통일
  for(const t of engine.towers){
    if(!t.def||t.def.type!==type) continue;
    t.buffDmgMul=(t.buffDmgMul||1)*(1+upg.val);
    t.flatDmg=(t.flatDmg||0)+(TYPE_FLAT_PER_TIER[t.def.grade]||2)*upg.flat; // v28: 등급별 절대값
    if(window.AoeBurst) engine.particles.push(new AoeBurst(t.x,t.y,44,color));
    t._typeGlowColor = color; t._typeGlowTimer = 1.6; // 잠시 색깔 테두리로 강조
  }
  engine.spawnFloatingText(`${upg.label}!`, engine.width/2, 80, color);
  return true;
}

// ===== 미션 =====
const MissionDefs = [
  // v28 세션E: 30개 → 12개 (합성 · 등급 · 웨이브 이정표 · 영웅/강화). 보상은 이번 판 골드만 (영구 성장 없음)
  {id:'first_merge', name:'첫 합성',       desc:'합성 연구소에서 합성 1회',        reward:30,  condition:(s)=>s.mergeCount>=1},
  {id:'merge5',      name:'합성 장인',     desc:'합성 5회',                        reward:150, condition:(s)=>s.mergeCount>=5},
  {id:'first_epic',  name:'에픽 등장',     desc:'에픽 포켓몬 획득',                reward:60,  condition:(s)=>s.totalEpicCount>=1},
  {id:'first_legend',name:'전설의 시작',   desc:'레전드 포켓몬 획득',              reward:300, condition:(s)=>s.totalLegendCount>=1},
  {id:'collect_mew', name:'환상의 포켓몬', desc:'레시피로 뮤 획득',                reward:500, condition:(s)=>s.collectedIds.has('mew')},
  {id:'hero_evolve', name:'진화의 순간',   desc:'영웅 진화',                       reward:100, condition:(s)=>!!s.heroEvolved},
  {id:'type_all5',   name:'만능 조련사',   desc:'6개 타입 모두 강화 1단계 이상',   reward:150,
    condition:(s)=>Object.keys(window.TypeUpgrades||{}).every(t=>(s.typeUpgrades?.[t]||0)>=1)},
  {id:'boss1',       name:'보스 사냥',     desc:'보스 처치',                       reward:200, condition:(s)=>s.bossKills>=1},
  {id:'wave10',      name:'웨이브 10',     desc:'웨이브 10 클리어',                reward:80,  condition:(s)=>s.wavesCleared>=10},
  {id:'wave30',      name:'웨이브 30',     desc:'웨이브 30 클리어',                reward:250, condition:(s)=>s.wavesCleared>=30},
  {id:'wave60',      name:'웨이브 60',     desc:'웨이브 60 클리어',                reward:500, condition:(s)=>s.wavesCleared>=60},
  {id:'wave90',      name:'3존 완주',      desc:'웨이브 90 도달',                  reward:800, condition:(s)=>s.wavesCleared>=90},
];

class MissionTracker {
  constructor(){
    this.stats={totalRareCount:0,totalEpicCount:0,totalLegendCount:0,totalUniqueCount:0,mergeCount:0,maxCombo:0,wavesCleared:0,bossKills:0,livesLost:0,maxTowersDeployed:0,gambleCount:0,tenPullCount:0,typeUpgrades:{},timeouts:0,eliteGoldKills:0,heroEvolved:false,hardWavesCleared:0,collectedIds:new Set()};
    this.completed=new Set(); this.onComplete=null;
  }
  update(engine){
    this.stats.maxTowersDeployed=Math.max(this.stats.maxTowersDeployed,engine.towers.length);
  }
  check(){ for(const m of MissionDefs){ if(!this.completed.has(m.id)&&m.condition(this.stats)){ this.completed.add(m.id); this.onComplete&&this.onComplete(m); } } }
}

// ===== 이미지 경로 =====
window.TowerSpriteImages = {
  bulbasaur:'assets/towers/bulbasaur.png', charmander:'assets/towers/charmander.png',
  squirtle:'assets/towers/squirtle.png',   magnemite:'assets/towers/magnemite.png',
  abra:'assets/towers/abra.png',           geodude:'assets/towers/geodude.png',
  gastly:'assets/towers/gastly.png',       gyarados:'assets/towers/gyarados.png',
  lapras:'assets/towers/lapras.png',       lugia:'assets/enemies/lugia.png',
  mewtwo:'assets/towers/mewtwo.png',      rattata:'assets/towers/rattata.png',
  zubat:'assets/towers/zubat.png',        golbat:'assets/towers/golbat.png',
  dragonite:'assets/towers/dragonite.png',
  lickitung:'assets/towers/lickitung.png', horsea:'assets/towers/horsea.png',
  aerodactyl:'assets/towers/aerodactyl.png', articuno:'assets/towers/articuno.png',
  zapdos:'assets/towers/zapdos.png',       moltres:'assets/towers/moltres.png',
  // 노말 티어 (미보유였던 것들)
  clefairy:'assets/towers/clefairy.png',   oddish:'assets/towers/oddish.png',
  diglett:'assets/towers/diglett.png',     psyduck:'assets/towers/psyduck.png',
  growlithe:'assets/towers/growlithe.png', pidgey:'assets/towers/pidgey.png',
  // 진화단계 전용 이미지 (id 기준 - pokemonId 공통 이미지보다 우선 적용됨)
  charmeleon:'assets/towers/charmeleon.png', charizard:'assets/towers/charizard.png',
  wartortle:'assets/towers/wartortle.png',   blastoise:'assets/towers/blastoise.png',
  kadabra:'assets/towers/kadabra.png',       alakazam:'assets/towers/alakazam.png',
  magneton:'assets/towers/magneton.png',
  dratini:'assets/towers/dratini.png', dragonair:'assets/towers/dragonair.png',
  dragonite:'assets/towers/dragonite.png',
  mew:'assets/heroes/mew.png',
  // v27-47: 신규 타워 이미지 11종 연결
  pidgeotto:'assets/towers/pidgeotto.png', pidgeot:'assets/towers/pidgeot.png',
  raticate:'assets/towers/raticate.png',   clefable:'assets/towers/clefable.png',
  gloom:'assets/towers/gloom.png',         vileplume:'assets/towers/vileplume.png',
  dugtrio:'assets/towers/dugtrio.png',     golduck:'assets/towers/golduck.png',
  arcanine:'assets/towers/arcanine.png',   haunter:'assets/towers/haunter.png',
  gengar:'assets/towers/gengar.png',
};

// ===== 전역 등록 =====
window.GRADES=GRADES; window.TYPES=TYPES;
window.GachaTowerDefs=GachaTowerDefs;
window.GRADE_POOLS=GRADE_POOLS;
// v3.9 히든 이로치 스프라이트: 원본 그림의 특정 색 범위만 바꿔 1회 생성 (붉은 갸라도스·검은 리자몽·분홍 망나뇽)
(function makeShinySprites(){
  if (typeof document === 'undefined') return;
  window.TowerSpriteImages = window.TowerSpriteImages || {};
  const RULES = {
    shiny_gyarados:  { src:'gyarados',  map:[{ h:[170,260], shift:150 }] },                       // 파랑 → 빨강
    shiny_charizard: { src:'charizard', map:[{ h:[8,40], lmax:0.7, dark:0.32 }, { h:[160,230], shift:180 }] }, // 주황 몸 → 검정(밝은 꼬리 불꽃은 유지), 청록 날개 안쪽 → 빨강
    shiny_dragonite: { src:'dragonite', map:[{ h:[18,55], shift:-55, sat:1.1 }] },                 // 주황 → 분홍
  };
  const hsl2rgb = (h, s, l) => { const C = (1 - Math.abs(2 * l - 1)) * s, hp = ((h % 360) + 360) % 360 / 60, X = C * (1 - Math.abs(hp % 2 - 1)), m = l - C / 2;
    const [r, g, b] = hp < 1 ? [C, X, 0] : hp < 2 ? [X, C, 0] : hp < 3 ? [0, C, X] : hp < 4 ? [0, X, C] : hp < 5 ? [X, 0, C] : [C, 0, X]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; };
  for (const [id, R] of Object.entries(RULES)) {
    window.TowerSpriteImages[id] = `assets/towers/${R.src}.png`; // 변환 전 임시
    const im = new Image();
    im.onload = () => { try {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        if (p[i+3] < 10) continue;
        const r = p[i] / 255, g = p[i+1] / 255, b = p[i+2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
        if (dd < 0.12) continue;
        let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; if (h < 0) h += 360;
        const sat = dd / (1 - Math.abs(2 * l - 1) || 1);
        const rule = R.map.find(m => h >= m.h[0] && h <= m.h[1] && (!m.lmax || l <= m.lmax)); if (!rule) continue;
        const out = rule.dark ? hsl2rgb(h, sat * 0.12, l * rule.dark + 0.06) : hsl2rgb(h + rule.shift, Math.min(1, sat * (rule.sat || 1)), l);
        p[i] = out[0]; p[i+1] = out[1]; p[i+2] = out[2];
      }
      x.putImageData(d, 0, 0);
      window.TowerSpriteImages[id] = c.toDataURL();
    } catch (_) {} };
    im.src = `assets/towers/${R.src}.png`;
  }
})();
window.PULL_COSTS=PULL_COSTS;
window.PULL_TABLES=PULL_TABLES;
window.rollTower=rollTower;
window.checkMerge=checkMerge;
window._createGachaTower=_createGachaTower;
window.MissionDefs=MissionDefs;
window.MissionTracker=MissionTracker;
window.MERGE_EVOLUTION=MERGE_EVOLUTION;
window.SELL_VALUE={ normal:40, rare:110, epic:600, legend:2000, unique:10000 }; // v3.9: 에픽·레전드·유니크 판매가 상향 (도박 기대 판매가 ≈520 < 2000이라 되팔기 이득 없음)
// 판매가: 등급 기준 × 히든 3배 × 먹이로 올린 ★당 +50%
window.sellValue = def => Math.round(((window.SELL_VALUE[def && def.grade] || 40) * (def && def.hidden ? 3 : 1)) * (1 + 0.5 * (((def && def._stack) || 1) - 1)));
window.NEXT_GRADE=NEXT_GRADE; window.MERGE_ORDER=MERGE_ORDER; window.rollRandomMerge=rollRandomMerge; window.RECIPES=RECIPES;
window.TypeUpgrades=TypeUpgrades;
window.TypeUpgradeLevels=TypeUpgradeLevels;
window.applyTypeUpgrade=applyTypeUpgrade;
window.getTypeUpgradeAt=getTypeUpgradeAt;
window.TYPE_FLAT_PER_TIER=TYPE_FLAT_PER_TIER;
window.applyTowerSynergies=applyTowerSynergies;
window.SYNERGY_PAIRS=SYNERGY_PAIRS;

function checkMerge(towers, towerSlots, engine) {
  const counts={};
  for(const slot of towerSlots){ if(!slot.occupied||!slot.tower) continue; const id=slot.tower._gachaId; if(!id) continue; if(!counts[id]) counts[id]=[]; counts[id].push(slot); }
  for(const id in counts){
    if(counts[id].length>=3){
      const slots=counts[id].slice(0,3); const evoId=window.getEvolutionId?getEvolutionId(id):MERGE_EVOLUTION[id];
      if(!evoId||!GachaTowerDefs[evoId]) continue;
      const evoDef=GachaTowerDefs[evoId]; const targetSlot=slots[0];
      for(let i=1;i<3;i++){ const s=slots[i]; engine.towers=engine.towers.filter(t=>t!==s.tower); s.occupied=false; s.tower=null; }
      const evoTower=_createGachaTower(evoDef,targetSlot.x,targetSlot.y,engine);
      targetSlot.tower=evoTower; engine.towers=engine.towers.filter(t=>t!==slots[0].tower); engine.towers.push(evoTower);
      engine.spawnFloatingText(`${evoDef.name} 진화!`,targetSlot.x,targetSlot.y-36,GRADES[evoDef.grade].color);
      engine.particles.push(new BurstRing(targetSlot.x,targetSlot.y,60,GRADES[evoDef.grade].color));
      engine.triggerScreenShake(5,0.2);
      if(window.applyTowerSynergies) window.applyTowerSynergies(engine.towers);
      return true;
    }
  }
  return false;
}
