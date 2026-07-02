// ===== GACHA.JS - 포켓몬 랜덤 뽑기 시스템 v3 =====
// 1세대 핵심 31종, 타입별 특성, 진화 체계

// ===== 등급 정의 =====
const GRADES = {
  normal:  { name:'노말',   color:'#9e9e9e', glow:'rgba(158,158,158,0.5)', stars:1, bg:'#2a2a2a' },
  rare:    { name:'레어',   color:'#4fc3f7', glow:'rgba(79,195,247,0.6)',  stars:2, bg:'#0d2035' },
  epic:    { name:'에픽',   color:'#ce93d8', glow:'rgba(206,147,216,0.7)', stars:3, bg:'#1e0d35' },
  legend:  { name:'레전드', color:'#ffd60a', glow:'rgba(255,214,10,0.8)',  stars:4, bg:'#2a1d00' },
  unique:  { name:'유니크', color:'#ff6b6b', glow:'rgba(255,107,107,0.9)', stars:5, bg:'#2a0000', rainbow:true },
};

// ===== 영구 버프 상한선 (상점/타입강화 중첩으로 인한 밸런스 붕괴 방지) =====
// 사거리는 특히 낮게 캡: '전범위 타워'가 나오지 않도록.
const BUFF_CAPS = { range: 1.35, damage: 1.9, speed: 1.5 };

// ===== 타입 정의 =====
const TYPES = {
  fire:    { name:'불꽃', color:'#ff5722', emoji:'🔥', effect:'burn' },
  water:   { name:'물',   color:'#29b6f6', emoji:'💧', effect:'slow' },
  grass:   { name:'풀',   color:'#66bb6a', emoji:'🌿', effect:'poison' },
  electric:{ name:'전기', color:'#ffd600', emoji:'⚡', effect:'stun' },
  psychic: { name:'에스퍼',color:'#ba68c8', emoji:'🔮', effect:'slow_multi' },
  ice:     { name:'얼음', color:'#80deea', emoji:'❄️', effect:'freeze' },
  rock:    { name:'바위', color:'#8d6e63', emoji:'🪨', effect:'stun_aoe' },
  ghost:   { name:'고스트',color:'#5e35b1', emoji:'👻', effect:'pierce' },
  normal:  { name:'노말', color:'#bdbdbd', emoji:'⬜', effect:'basic' },
  ground:  { name:'땅',   color:'#d4a056', emoji:'🏔️', effect:'knockback' },
};

// ===== 타워 정의 (31종) =====
const GachaTowerDefs = {

  // ===== 노말 (12종) =====
  bulbasaur: {
    id:'bulbasaur', name:'이상해씨', emoji:'🌱', grade:'normal', type:'grass', pokemonId:'bulbasaur',
    damage:12, range:185, fireRate:1.2, desc:'독 DoT 부여',
    fire(t,e){ _shot(t,e,'#8bc34a','🍃',{type:'poison',duration:3,factor:6},340); }
  },
  charmander: {
    id:'charmander', name:'파이리', emoji:'🦎', grade:'normal', type:'fire', pokemonId:'charmander',
    damage:14, range:175, fireRate:1.8, desc:'화상 DoT',
    fire(t,e){ _shot(t,e,'#ff7043','🔥',{type:'burn',duration:2,factor:7},450); }
  },
  squirtle: {
    id:'squirtle', name:'꼬부기', emoji:'🐢', grade:'normal', type:'water', pokemonId:'squirtle',
    damage:11, range:185, fireRate:1.1, desc:'슬로우',
    fire(t,e){ _shot(t,e,'#4fc3f7','💧',{type:'slow',duration:1.8,factor:0.65},360); }
  },
  pidgey: {
    id:'pidgey', name:'구구', emoji:'🐦', grade:'normal', type:'normal', pokemonId:'pidgey',
    damage:10, range:210, fireRate:2.2, desc:'빠른 연사, 비행 감지',
    fire(t,e){ _shot(t,e,'#bcaaa4','🪶',null,520); }
  },
  rattata: {
    id:'rattata', name:'꼬렛', emoji:'🐭', grade:'normal', type:'normal', pokemonId:'rattata',
    damage:9, range:160, fireRate:2.8, desc:'초고속 연사',
    fire(t,e){ _shot(t,e,'#a1887f','🐭',null,420); }
  },
  clefairy: {
    id:'clefairy', name:'피삐', emoji:'⭐', grade:'normal', type:'normal', pokemonId:'clefairy',
    damage:8, range:195, fireRate:1.0, desc:'주변 타워 데미지 +10%',
    fire(t,e){
      _shot(t,e,'#f48fb1','⭐',null,320);
      for(const tw of e.towers) if(tw!==t&&Math.hypot(tw.x-t.x,tw.y-t.y)<130) tw.buffDmgMul=(tw.buffDmgMul||1)*1.001;
    }
  },
  oddish: {
    id:'oddish', name:'뚜벅초', emoji:'🌿', grade:'normal', type:'grass', pokemonId:'oddish',
    damage:10, range:180, fireRate:1.1, desc:'광역 독 포자',
    fire(t,e){
      _shot(t,e,'#7cb342','🍃',{type:'poison',duration:3.5,factor:5},320);
      t._sporeTimer=(t._sporeTimer||0)+1/t.fireRate;
      if(t._sporeTimer>=5){ t._sporeTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=100) en.applyStatus('slow',2,0.7);
        e.particles.push(new AoeBurst(t.x,t.y,100,'#7cb342'));
      }
    }
  },
  diglett: {
    id:'diglett', name:'디그다', emoji:'🏔️', grade:'normal', type:'ground', pokemonId:'diglett',
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
    fire(t,e){ _shot(t,e,'#ff6d00','🔥',{type:'burn',duration:1.5,factor:6},480); }
  },
  abra: {
    id:'abra', name:'케이시', emoji:'🔮', grade:'normal', type:'psychic', pokemonId:'abra',
    damage:13, range:200, fireRate:1.3, desc:'2타겟 에스퍼',
    fire(t,e){
      const targets=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for(const tgt of targets){ e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#ce93d8',size:4,beam:true,beamLife:0.15})); tgt.takeDamage(t.damage,'special'); tgt.applyStatus('slow',1.5,0.65); e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8'); }
    }
  },
  magnemite: {
    id:'magnemite', name:'코일', emoji:'🧲', grade:'normal', type:'electric', pokemonId:'magnemite',
    damage:14, range:170, fireRate:1.5, desc:'전기 스턴',
    fire(t,e){ _shot(t,e,'#ffeb3b','⚡',{type:'stun',duration:0.35},500); }
  },

  // ===== 레어 (8종) =====
  charmeleon: {
    id:'charmeleon', name:'리자드', emoji:'🔥', grade:'rare', type:'fire', pokemonId:'charmander',
    damage:22, range:195, fireRate:2.5, desc:'관통 화염',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:520,damage:t.damage,color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',piercing:true,pierceWidth:28,status:{type:'burn',duration:2.5,factor:10}})); }
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
      for(const tgt of targets){ e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#ce93d8',size:4,beam:true,beamLife:0.15})); tgt.takeDamage(t.damage,'special'); tgt.applyStatus('slow',2.5,0.5); e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8'); }
    }
  },
  geodude: {
    id:'geodude', name:'꼬마돌', emoji:'🪨', grade:'rare', type:'rock', pokemonId:'geodude',
    damage:28, range:175, fireRate:0.95, desc:'범위 스턴',
    fire(t,e){ _shot(t,e,'#a1887f','🪨',{type:'stun',duration:0.6},380,null,55); }
  },
  gastly: {
    id:'gastly', name:'고우스트', emoji:'👻', grade:'rare', type:'ghost', pokemonId:'gastly',
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

  // ===== 에픽 (6종) =====
  charizard: {
    id:'charizard', name:'리자몽', emoji:'🐉', grade:'epic', type:'fire', pokemonId:'charmander',
    damage:50, range:240, fireRate:3.5, desc:'관통+폭발 25%',
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:520,damage:t.damage,color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',piercing:true,pierceWidth:28,status:{type:'burn',duration:3,factor:14},
        onHit:(en)=>{ if(Math.random()<0.25){ for(const e2 of e.enemies) if(Math.hypot(e2.x-en.x,e2.y-en.y)<70) e2.takeDamage(t.damage*1.2,'special'); e.particles.push(new AoeBurst(en.x,en.y,70,'#ff6f00')); }}}));
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
      for(const tgt of targets){ let dmg=t.damage; if(Math.random()<0.35){dmg*=2.8;e.spawnFloatingText('💥크리!',tgt.x,tgt.y-18,'#f48fb1');} e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#ce93d8',size:4,beam:true,beamLife:0.18})); tgt.takeDamage(dmg,'special'); tgt.applyStatus('slow',2.5,0.38); e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8'); }
    }
  },
  gyarados: {
    id:'gyarados', name:'갸라도스', emoji:'🐲', grade:'epic', type:'water', pokemonId:'gyarados',
    damage:40, range:240, fireRate:1.2, desc:'분노 광역+슬로우',
    fire(t,e){
      _shot(t,e,'#1e88e5','🌊',{type:'slow',duration:2.5,factor:0.45},400,null,60);
      t._rageTimer=(t._rageTimer||0)+1/t.fireRate;
      if(t._rageTimer>=6){ t._rageTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd) { en.takeDamage(t.damage*0.5,'special'); en.applyStatus('slow',2,0.55); } e.particles.push(new AoeBurst(t.x,t.y,t.range,'#4fc3f7')); e.spawnFloatingText('🌊분노!',t.x,t.y-30,'#29b6f6'); }
    }
  },
  lapras: {
    id:'lapras', name:'라프라스', emoji:'🧊', grade:'epic', type:'ice', pokemonId:'lapras',
    damage:36, range:250, fireRate:1.2, desc:'빙결+분열 2발',
    fire(t,e){
      const sorted=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for(const tgt of sorted) e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:440,damage:t.damage,color:'#80deea',size:6,dmgType:'special',emoji:'❄️',status:{type:'freeze',duration:2.0}}));
    }
  },
  aerodactyl: {
    id:'aerodactyl', name:'프테라', emoji:'🦅', grade:'epic', type:'rock', pokemonId:'aerodactyl',
    damage:42, range:260, fireRate:1.8, desc:'고속 관통타',
    fire(t,e){ e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:620,damage:t.damage,color:'#78909c',size:6,dmgType:'physical',emoji:'🪨',piercing:true,pierceWidth:30,status:{type:'stun',duration:0.5}})); }
  },

  // ===== 레전드 (3종) =====
  articuno: {
    id:'articuno', name:'프리져', emoji:'🦅', grade:'legend', type:'ice', pokemonId:'articuno',
    damage:65, range:310, fireRate:1.3, desc:'눈보라 전체+빙결',
    fire(t,e){
      const sorted=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,3);
      for(const tgt of sorted) e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:460,damage:t.damage,color:'#b3e5fc',size:7,dmgType:'special',emoji:'❄️',status:{type:'freeze',duration:2.8}}));
      t._blizTimer=(t._blizTimer||0)+1/t.fireRate;
      if(t._blizTimer>=6){ t._blizTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd) en.applyStatus('slow',3.5,0.3); e.particles.push(new AoeBurst(t.x,t.y,t.range,'#b3e5fc')); e.spawnFloatingText('🌨️눈보라!',t.x,t.y-36,'#80deea'); }
    }
  },
  zapdos: {
    id:'zapdos', name:'썬더', emoji:'⚡', grade:'legend', type:'electric', pokemonId:'zapdos',
    damage:60, range:300, fireRate:2.0, desc:'EMP+체인 5연쇄',
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:650,damage:t.damage,color:'#fff176',size:6,dmgType:'special',emoji:'⚡',status:{type:'stun',duration:1.0},chain:5,chainRange:180}));
      t._empTimer=(t._empTimer||0)+1/t.fireRate;
      if(t._empTimer>=5){ t._empTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range) { en.takeDamage(t.damage*1.5,'special'); en.applyStatus('stun',1.5,0); } e.particles.push(new AoeBurst(t.x,t.y,t.range,'#fff176')); }
    }
  },
  moltres: {
    id:'moltres', name:'파이어', emoji:'🔥', grade:'legend', type:'fire', pokemonId:'moltres',
    damage:70, range:295, fireRate:3.0, desc:'불꽃폭풍 광역',
    fire(t,e){
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:540,damage:t.damage,color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',piercing:true,pierceWidth:30,status:{type:'burn',duration:4,factor:18},
        onHit:(en)=>{ if(Math.random()<0.4){ for(const e2 of e.enemies) if(Math.hypot(e2.x-en.x,e2.y-en.y)<90) e2.takeDamage(t.damage*1.3,'special'); e.particles.push(new AoeBurst(en.x,en.y,90,'#ff6f00')); }}}));
    }
  },

  // ===== 유니크 (2종) =====
  mewtwo: {
    id:'mewtwo', name:'뮤츠', emoji:'🔮', grade:'unique', type:'psychic', pokemonId:'mewtwo',
    damage:100, range:320, fireRate:1.6, desc:'전지전능 6타겟+크리',
    fire(t,e){
      const all=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,6);
      for(const tgt of all){ let dmg=t.damage; if(Math.random()<0.35){dmg*=3;e.spawnFloatingText('🔮크리!',tgt.x,tgt.y-20,'#b39ddb');} e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#b39ddb',size:5,beam:true,beamLife:0.2})); tgt.takeDamage(dmg,'special'); tgt.applyStatus('slow',2.5,0.35); e.spawnHitParticle(tgt.x,tgt.y,'#7c4dff'); }
      t._psyTimer=(t._psyTimer||0)+1/t.fireRate;
      if(t._psyTimer>=4){ t._psyTimer=0; for(const en of e.enemies) if(!en.dead&&!en.reachedEnd) en.applyStatus('slow',1.5,0.5); e.particles.push(new AoeBurst(t.x,t.y,t.range,'#7c4dff')); }
    }
  },
  mew: {
    id:'mew', name:'뮤', emoji:'💗', grade:'unique', type:'psychic', pokemonId:'mew',
    damage:80, range:330, fireRate:1.4, desc:'전체버프+변신',
    fire(t,e){
      const all=e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range).sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,4);
      for(const tgt of all){ e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#f48fb1',size:5,beam:true,beamLife:0.18})); tgt.takeDamage(t.damage,'special'); tgt.applyStatus('slow',3,0.4); }
      t._buffTimer=(t._buffTimer||0)+1/t.fireRate;
      if(t._buffTimer>=8){ t._buffTimer=0; for(const tw of e.towers) tw.buffDmgMul=(tw.buffDmgMul||1)*1.02; e.spawnFloatingText('💗전체버프!',t.x,t.y-30,'#f48fb1'); }
    }
  },
};

// ===== 헬퍼 =====
function _shot(tower, engine, color, emoji, status, speed, onHit, splash, knockback) {
  if (!tower.target) return;
  engine.projectiles.push(new Projectile(tower.x, tower.y, tower.target, {
    engine, speed:speed||380, damage:tower.damage,
    color, size:5, dmgType:'special', emoji, status, onHit,
    splash:splash||0, knockback:knockback||0,
  }));
}

// ===== 뽑기 확률 =====
const PULL_TABLES = {
  normal:   [{grade:'normal',weight:60},{grade:'rare',weight:32},{grade:'epic',weight:7},{grade:'legend',weight:0.9},{grade:'unique',weight:0.1}],
  premium:  [{grade:'normal',weight:20},{grade:'rare',weight:48},{grade:'epic',weight:26},{grade:'legend',weight:5.5},{grade:'unique',weight:0.5}],
  gamble:   [{grade:'normal',weight:3},{grade:'rare',weight:17},{grade:'epic',weight:48},{grade:'legend',weight:28},{grade:'unique',weight:4}],
  ten_base: [{grade:'normal',weight:15},{grade:'rare',weight:50},{grade:'epic',weight:28},{grade:'legend',weight:6.5},{grade:'unique',weight:0.5}],
};
const PULL_COSTS = { normal:50, premium:120, gamble:200, ten:450 };

const GRADE_POOLS = {
  normal:  ['bulbasaur','charmander','squirtle','pidgey','rattata','clefairy','oddish','diglett','psyduck','growlithe','abra','magnemite'],
  rare:    ['charmeleon','wartortle','kadabra','geodude','gastly','lickitung','horsea','magneton'],
  epic:    ['charizard','blastoise','alakazam','gyarados','lapras','aerodactyl'],
  legend:  ['articuno','zapdos','moltres'],
  unique:  ['mewtwo','mew'],
};

// ===== 합치기 진화 =====
const MERGE_EVOLUTION = {
  // 노말 3개 → 레어
  bulbasaur:'oddish',    charmander:'charmeleon', squirtle:'wartortle',
  pidgey:'horsea',       rattata:'lickitung',     clefairy:'kadabra',
  oddish:'gastly',       diglett:'geodude',       psyduck:'horsea',
  growlithe:'charmeleon',abra:'kadabra',          magnemite:'magneton',
  // 레어 3개 → 에픽
  charmeleon:'charizard',wartortle:'blastoise',   kadabra:'alakazam',
  geodude:'aerodactyl',  gastly:'alakazam',       lickitung:'blastoise',
  horsea:'gyarados',     magneton:'zapdos',
  // 에픽 3개 → 레전드
  charizard:'moltres',   blastoise:'articuno',    alakazam:'mewtwo',
  gyarados:'articuno',   lapras:'articuno',       aerodactyl:'zapdos',
  // 레전드 3개 → 유니크
  articuno:'mew',        zapdos:'mewtwo',         moltres:'mew',
};

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
  const id = pool[Math.floor(Math.random()*pool.length)];
  return {...GachaTowerDefs[id], _starLevel:1};
}

// ===== 타워 생성 =====
function _createGachaTower(def, x, y) {
  const t = {
    x, y, _gachaId:def.id, def,
    name:def.name, level:1, path:null, totalSpent:0,
    cooldown:0, fireFlash:0, _rotAngle:0,
    synergyBonus:0, buffRangeMul:1, buffDmgMul:1, target:null,
    get range(){ return (def.range+(this.synergyBonus*2))*Math.min(this.buffRangeMul, BUFF_CAPS.range); },
    get damage(){ return (def.damage+this.synergyBonus)*Math.min(this.buffDmgMul, BUFF_CAPS.damage); },
    get fireRate(){ return def.fireRate*Math.min(this._shopSpeedMul||1, BUFF_CAPS.speed); },
    upgradeCost(){ return null; },
    findTarget(enemies){
      if(this.target&&!this.target.dead&&!this.target.reachedEnd){
        if(Math.hypot(this.target.x-this.x,this.target.y-this.y)<=this.range) return this.target;
      }
      let best=null,bestP=-1;
      for(const e of enemies){
        if(e.dead||e.reachedEnd) continue;
        const d=Math.hypot(e.x-this.x,e.y-this.y);
        if(d>this.range) continue;
        if(e.distTraveled>bestP){ bestP=e.distTraveled; best=e; }
      }
      return best;
    },
    update(dt,enemies,engine){
      this.engine=engine;
      this.cooldown-=dt;
      if(this.fireFlash>0) this.fireFlash-=dt;
      this._rotAngle+=dt*0.5;
      this.target=this.findTarget(enemies);
      if(this.target&&this.cooldown<=0){
        this.cooldown=1/this.fireRate;
        this.fireFlash=0.1;
        def.fire(this,engine);
      }
    },
    draw(ctx){
      const grade=GRADES[def.grade];
      const typeInfo=TYPES[def.type]||TYPES.normal;

      // 합치기 가능 링
      if(this.engine){
        const sameCount=this.engine.towerSlots.filter(s=>s.occupied&&s.tower?._gachaId===def.id).length;
        if(sameCount>=3){
          ctx.save(); ctx.beginPath(); ctx.arc(this.x,this.y,30,0,Math.PI*2);
          ctx.strokeStyle=`rgba(6,214,160,${0.5+Math.sin(Date.now()*0.006)*0.3})`;
          ctx.lineWidth=2.5; ctx.shadowColor='#06d6a0'; ctx.shadowBlur=10; ctx.stroke(); ctx.restore();
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
      // 등급 오라
      if(def.grade!=='normal'){
        ctx.save(); ctx.beginPath(); ctx.arc(this.x,this.y,28,0,Math.PI*2);
        const g=ctx.createRadialGradient(this.x,this.y,4,this.x,this.y,28);
        g.addColorStop(0,grade.color+'28'); g.addColorStop(1,'transparent');
        ctx.fillStyle=g; ctx.fill(); ctx.restore();
      }
      // 발사 플래시
      if(this.fireFlash>0){
        ctx.save(); ctx.globalAlpha=(this.fireFlash/0.1)*0.35;
        ctx.beginPath(); ctx.arc(this.x,this.y,26,0,Math.PI*2);
        ctx.fillStyle=typeInfo.color; ctx.fill(); ctx.restore();
      }
      // 베이스 패드
      ctx.save();
      ctx.beginPath(); ctx.arc(this.x,this.y+3,22,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(this.x,this.y,21,0,Math.PI*2);
      ctx.fillStyle=grade.bg+'cc';
      ctx.strokeStyle=grade.color; ctx.lineWidth=def.grade==='unique'?3:2;
      if(def.grade!=='normal'){ ctx.shadowColor=grade.color; ctx.shadowBlur=8; }
      ctx.fill(); ctx.stroke();
      // 포켓몬 이미지: 진화단계 전용(id) 이미지 우선, 없으면 라인 공통(pokemonId) 이미지로 폴백
      const imgPath=window.TowerSpriteImages?.[def.id] || window.TowerSpriteImages?.[def.pokemonId];
      const img=imgPath?window.loadSpriteImage?.(imgPath):null;
      const gradeBonus={normal:0,rare:2,epic:5,legend:7,unique:10};
      const sz=34+(gradeBonus[def.grade]||0);
      if(img&&img.complete&&img.naturalWidth>0){
        const asp=img.naturalWidth/img.naturalHeight;
        const dw=asp>=1?sz:sz*asp, dh=asp>=1?sz/asp:sz;
        ctx.drawImage(img,this.x-dw/2,this.y-dh/2,dw,dh);
      } else {
        ctx.font=`${sz*0.8}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(def.emoji,this.x,this.y);
      }
      // 등급 별
      ctx.font='bold 8px -apple-system,sans-serif';
      ctx.fillStyle=grade.color; ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=3;
      ctx.textAlign='center';
      ctx.fillText('★'.repeat(GRADES[def.grade].stars),this.x,this.y-23);
      // 타입 배지
      ctx.font='9px serif';
      ctx.fillText(typeInfo.emoji,this.x+18,this.y-18);
      ctx.restore();
    },
  };
  return t;
}

// ===== 시너지 (타입별) =====
function applyTowerSynergies(towers) {
  for(const t of towers) t.synergyBonus=0;
  for(let i=0;i<towers.length;i++){
    for(let j=i+1;j<towers.length;j++){
      const a=towers[i],b=towers[j];
      if(!a.def||!b.def) continue;
      if(Math.hypot(a.x-b.x,a.y-b.y)>150) continue;
      // 같은 타입 인접: 시너지
      if(a.def.type===b.def.type){ a.synergyBonus+=8; b.synergyBonus+=8; }
      // 물+얼음
      else if((a.def.type==='water'&&b.def.type==='ice')||(a.def.type==='ice'&&b.def.type==='water')){ a.synergyBonus+=5; b.synergyBonus+=5; }
      // 불꽃+전기
      else if((a.def.type==='fire'&&b.def.type==='electric')||(a.def.type==='electric'&&b.def.type==='fire')){ a.synergyBonus+=6; b.synergyBonus+=6; }
      // 풀+독(고스트)
      else if((a.def.type==='grass'&&b.def.type==='ghost')||(a.def.type==='ghost'&&b.def.type==='grass')){ a.synergyBonus+=5; b.synergyBonus+=7; }
    }
  }
}

// ===== 타입 업그레이드 =====
const TypeUpgrades = {
  fire:     [{cost:200,label:'불꽃 강화 1',buff:'dmg',val:0.15},{cost:400,label:'불꽃 강화 2',buff:'dmg',val:0.20},{cost:800,label:'대화염',buff:'dmg',val:0.30}],
  water:    [{cost:200,label:'물 강화 1',buff:'range',val:0.15},{cost:400,label:'물 강화 2',buff:'slow',val:0.1},{cost:800,label:'대해일',buff:'range',val:0.25}],
  electric: [{cost:200,label:'전기 강화 1',buff:'speed',val:0.15},{cost:400,label:'전기 강화 2',buff:'chain',val:1},{cost:800,label:'초전도',buff:'speed',val:0.25}],
  grass:    [{cost:200,label:'풀 강화 1',buff:'poison',val:0.15},{cost:400,label:'풀 강화 2',buff:'range',val:0.15},{cost:800,label:'대자연',buff:'dmg',val:0.25}],
  psychic:  [{cost:200,label:'에스퍼 강화 1',buff:'target',val:1},{cost:400,label:'에스퍼 강화 2',buff:'dmg',val:0.20},{cost:800,label:'초능력',buff:'target',val:2}],
  ice:      [{cost:200,label:'얼음 강화 1',buff:'freeze',val:0.3},{cost:400,label:'얼음 강화 2',buff:'split',val:1},{cost:800,label:'절대영도',buff:'freeze',val:0.5}],
  rock:     [{cost:200,label:'바위 강화 1',buff:'stun',val:0.3},{cost:400,label:'바위 강화 2',buff:'dmg',val:0.20},{cost:800,label:'암석폭발',buff:'splash',val:30}],
  ghost:    [{cost:200,label:'고스트 강화 1',buff:'pierce',val:1},{cost:400,label:'고스트 강화 2',buff:'dmg',val:0.25},{cost:800,label:'저주',buff:'all',val:0.15}],
  ground:   [{cost:200,label:'땅 강화 1',buff:'knockback',val:20},{cost:400,label:'땅 강화 2',buff:'splash',val:25},{cost:800,label:'지진',buff:'stun',val:0.5}],
  normal:   [{cost:150,label:'노말 강화 1',buff:'speed',val:0.10},{cost:300,label:'노말 강화 2',buff:'dmg',val:0.10},{cost:600,label:'만능',buff:'all',val:0.10}],
};
// 타입별 업그레이드 레벨 추적
const TypeUpgradeLevels = {};
for(const t in TypeUpgrades) TypeUpgradeLevels[t]=0;

function applyTypeUpgrade(type, engine) {
  const level = TypeUpgradeLevels[type]||0;
  const upgrades = TypeUpgrades[type];
  if(level >= upgrades.length) return false;
  const upg = upgrades[level];
  if(!engine.spendGold(upg.cost)) return false;
  TypeUpgradeLevels[type]++;
  // 해당 타입 타워 전체에 버프 적용
  for(const t of engine.towers){
    if(!t.def||t.def.type!==type) continue;
    if(upg.buff==='dmg'||upg.buff==='all') t.buffDmgMul=(t.buffDmgMul||1)*(1+upg.val);
    if(upg.buff==='range'||upg.buff==='all') t.buffRangeMul=(t.buffRangeMul||1)*(1+upg.val);
    if(upg.buff==='speed'||upg.buff==='all') t._shopSpeedMul=(t._shopSpeedMul||1)*(1+upg.val);
  }
  engine.spawnFloatingText(`${TYPES[type].emoji} ${upg.label}!`, engine.width/2, 80, TYPES[type].color);
  return true;
}

// ===== 미션 =====
const MissionDefs = [
  {id:'first_rare',  name:'첫 레어!',    desc:'레어 타워 뽑기',       reward:80,  condition:(s)=>s.totalRareCount>=1},
  {id:'first_epic',  name:'에픽 등장!',  desc:'에픽 타워 뽑기',       reward:150, condition:(s)=>s.totalEpicCount>=1},
  {id:'first_legend',name:'레전드!',     desc:'레전드 타워 뽑기',     reward:300, condition:(s)=>s.totalLegendCount>=1},
  {id:'first_unique',name:'유니크!',     desc:'유니크 타워 뽑기',     reward:500, condition:(s)=>s.totalUniqueCount>=1},
  {id:'first_merge', name:'첫 합치기!',  desc:'합치기로 진화',         reward:100, condition:(s)=>s.mergeCount>=1},
  {id:'merge5',      name:'합치기 장인', desc:'합치기 5회',            reward:200, condition:(s)=>s.mergeCount>=5},
  {id:'combo10',     name:'콤보 10!',   desc:'콤보 10 달성',          reward:80,  condition:(s)=>s.maxCombo>=10},
  {id:'combo30',     name:'콤보 마스터',desc:'콤보 30 달성',           reward:200, condition:(s)=>s.maxCombo>=30},
  {id:'wave5',       name:'웨이브 5',   desc:'웨이브 5 클리어',       reward:120, condition:(s)=>s.wavesCleared>=5},
  {id:'wave10',      name:'웨이브 10',  desc:'웨이브 10 클리어',      reward:200, condition:(s)=>s.wavesCleared>=10},
  {id:'boss1',       name:'보스 처치',  desc:'보스 처치',              reward:250, condition:(s)=>s.bossKills>=1},
  {id:'type_fire',   name:'불꽃 마스터',desc:'불꽃 타입 업그레이드 3단계',reward:300,condition:(s)=>(s.typeUpgrades?.fire||0)>=3},
  {id:'type_water',  name:'물 마스터',  desc:'물 타입 업그레이드 3단계',  reward:300,condition:(s)=>(s.typeUpgrades?.water||0)>=3},
  {id:'towers8',     name:'군대 집결',  desc:'타워 8개 배치',          reward:150, condition:(s)=>s.maxTowersDeployed>=8},
  {id:'ten_pull',    name:'10연 도전',  desc:'10연 뽑기 1회',          reward:120, condition:(s)=>s.tenPullCount>=1},
  {id:'perfect5',    name:'완벽한 방어',desc:'시간초과 없이 웨이브 5 클리어',reward:180,condition:(s)=>s.wavesCleared>=5&&!s.timeouts},
  {id:'shadow_hunt', name:'흑화 사냥꾼',desc:'흑화(골드 엘리트) 5마리 처치',reward:200,condition:(s)=>(s.eliteGoldKills||0)>=5},
  {id:'hero_charizard',name:'화염의 파트너',desc:'리자몽 영웅 해금',    reward:150, condition:(s)=>!!s.heroCharizard},
  {id:'hero_blastoise',name:'심해의 파트너',desc:'거북왕 영웅 해금',    reward:150, condition:(s)=>!!s.heroBlastoise},
  {id:'hard_clear',  name:'하드 정복자',desc:'하드 난이도 웨이브 10 클리어',reward:400,condition:(s)=>(s.hardWavesCleared||0)>=10},
];

class MissionTracker {
  constructor(){
    this.stats={totalRareCount:0,totalEpicCount:0,totalLegendCount:0,totalUniqueCount:0,mergeCount:0,maxCombo:0,wavesCleared:0,bossKills:0,livesLost:0,maxTowersDeployed:0,gambleCount:0,tenPullCount:0,typeUpgrades:{},timeouts:0,eliteGoldKills:0,heroCharizard:false,heroBlastoise:false,hardWavesCleared:0};
    this.completed=new Set(); this.onComplete=null;
  }
  update(engine){
    this.stats.maxTowersDeployed=Math.max(this.stats.maxTowersDeployed,engine.towers.length);
    if(engine.comboCount>this.stats.maxCombo) this.stats.maxCombo=engine.comboCount;
  }
  check(){ for(const m of MissionDefs){ if(!this.completed.has(m.id)&&m.condition(this.stats)){ this.completed.add(m.id); this.onComplete&&this.onComplete(m); } } }
}

// ===== 이미지 경로 =====
window.TowerSpriteImages = {
  bulbasaur:'assets/towers/bulbasaur.png', charmander:'assets/towers/charmander.png',
  squirtle:'assets/towers/squirtle.png',   magnemite:'assets/towers/magnemite.png',
  abra:'assets/towers/abra.png',           geodude:'assets/towers/geodude.png',
  gastly:'assets/towers/gastly.png',       gyarados:'assets/enemies/gyarados.png',
  lapras:'assets/towers/lapras.png',       lugia:'assets/enemies/lugia.png',
  mewtwo:'assets/enemies/mewtwo.png',      rattata:'assets/towers/rattata.png',
  zubat:'assets/enemies/zubat.png',        golbat:'assets/enemies/golbat.png',
  dragonite:'assets/enemies/dragonite.png',
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
};

// ===== 전역 등록 =====
window.GRADES=GRADES; window.TYPES=TYPES;
window.GachaTowerDefs=GachaTowerDefs;
window.GRADE_POOLS=GRADE_POOLS;
window.PULL_COSTS=PULL_COSTS;
window.rollTower=rollTower;
window.checkMerge=checkMerge;
window._createGachaTower=_createGachaTower;
window.MissionDefs=MissionDefs;
window.MissionTracker=MissionTracker;
window.MERGE_EVOLUTION=MERGE_EVOLUTION;
window.TypeUpgrades=TypeUpgrades;
window.TypeUpgradeLevels=TypeUpgradeLevels;
window.applyTypeUpgrade=applyTypeUpgrade;
window.applyTowerSynergies=applyTowerSynergies;

function checkMerge(towers, towerSlots, engine) {
  const counts={};
  for(const slot of towerSlots){ if(!slot.occupied||!slot.tower) continue; const id=slot.tower._gachaId; if(!id) continue; if(!counts[id]) counts[id]=[]; counts[id].push(slot); }
  for(const id in counts){
    if(counts[id].length>=3){
      const slots=counts[id].slice(0,3); const evoId=MERGE_EVOLUTION[id];
      if(!evoId||!GachaTowerDefs[evoId]) continue;
      const evoDef=GachaTowerDefs[evoId]; const targetSlot=slots[0];
      for(let i=1;i<3;i++){ const s=slots[i]; engine.towers=engine.towers.filter(t=>t!==s.tower); s.occupied=false; s.tower=null; }
      const evoTower=_createGachaTower(evoDef,targetSlot.x,targetSlot.y);
      targetSlot.tower=evoTower; engine.towers=engine.towers.filter(t=>t!==slots[0].tower); engine.towers.push(evoTower);
      engine.spawnFloatingText(`✨ ${evoDef.name} 진화!`,targetSlot.x,targetSlot.y-36,GRADES[evoDef.grade].color);
      engine.particles.push(new BurstRing(targetSlot.x,targetSlot.y,60,GRADES[evoDef.grade].color));
      engine.triggerScreenShake(5,0.2);
      if(window.applyTowerSynergies) window.applyTowerSynergies(engine.towers);
      return true;
    }
  }
  return false;
}
