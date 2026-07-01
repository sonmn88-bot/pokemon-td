// ===== GACHA.JS - 랜덤 뽑기 + 합치기 + 등급 시스템 =====

// ===== 등급 정의 =====
const GRADES = {
  normal:  { name:'노말',   color:'#9e9e9e', glow:'rgba(158,158,158,0.5)', stars:1, bg:'#2a2a2a' },
  rare:    { name:'레어',   color:'#4fc3f7', glow:'rgba(79,195,247,0.6)',  stars:2, bg:'#0d2035' },
  epic:    { name:'에픽',   color:'#ce93d8', glow:'rgba(206,147,216,0.7)', stars:3, bg:'#1e0d35' },
  legend:  { name:'레전드', color:'#ffd60a', glow:'rgba(255,214,10,0.8)',  stars:4, bg:'#2a1d00' },
  unique:  { name:'유니크', color:'#ff6b6b', glow:'rgba(255,107,107,0.9)', stars:5, bg:'#2a0000',
             rainbow:true },
};

// ===== 풀 타워 정의 (25종) =====
// 기존 8종 + 17종 추가, 등급별로 배분
const GachaTowerDefs = {
  // ===== 노말 (7종) =====
  rattata_g: {
    id:'rattata_g', name:'꼬렛', emoji:'🐭', grade:'normal',
    pokemonId:'rattata',
    damage:8, range:160, fireRate:2.2, special:'빠른 연사',
    color:'#a1887f',
    desc:'빠른 연사 속도',
    fire(t, e) { _basicShot(t, e, '#a1887f', '🐭', null, 360); }
  },
  zubat_g: {
    id:'zubat_g', name:'주뱃', emoji:'🦋', grade:'normal',
    pokemonId:'zubat',
    damage:7, range:200, fireRate:1.5, special:'비행 감지',
    color:'#7e57c2', desc:'하늘 적 감지',
    fire(t, e) { _basicShot(t, e, '#9c27b0', '🦋', {type:'slow',duration:0.8,factor:0.75}, 380); }
  },
  abo_g: {
    id:'abo_g', name:'아보', emoji:'🐍', grade:'normal',
    pokemonId:'abo',
    damage:10, range:175, fireRate:1.3, special:'독',
    color:'#8bc34a', desc:'독 DoT 부여',
    fire(t, e) { _basicShot(t, e, '#7cb342', '🍃', {type:'poison',duration:2.5,factor:5}, 330); }
  },
  paras_g: {
    id:'paras_g', name:'파라스', emoji:'🍄', grade:'normal',
    pokemonId:'paras',
    damage:9, range:165, fireRate:1.2, special:'포자 슬로우',
    color:'#ff7043', desc:'포자로 슬로우',
    fire(t, e) { _basicShot(t, e, '#ff7043', '🍄', {type:'slow',duration:1.5,factor:0.7}, 310); }
  },
  squirtle_g: {
    id:'squirtle_g', name:'꼬부기', emoji:'🐢', grade:'normal',
    pokemonId:'squirtle',
    damage:11, range:180, fireRate:1.1, special:'슬로우',
    color:'#29b6f6', desc:'물대포 슬로우',
    fire(t, e) { _basicShot(t, e, '#4fc3f7', '💧', {type:'slow',duration:1.8,factor:0.65}, 360); }
  },
  bulbasaur_g: {
    id:'bulbasaur_g', name:'이상해씨', emoji:'🌱', grade:'normal',
    pokemonId:'bulbasaur',
    damage:12, range:185, fireRate:1.2, special:'독 DoT',
    color:'#66bb6a', desc:'독으로 지속 피해',
    fire(t, e) { _basicShot(t, e, '#8bc34a', '🍃', {type:'poison',duration:3,factor:6}, 340); }
  },
  magnemite_g: {
    id:'magnemite_g', name:'코일', emoji:'🧲', grade:'normal',
    pokemonId:'magnemite',
    damage:14, range:170, fireRate:1.4, special:'전기 스턴',
    color:'#fdd835', desc:'전기 충격 스턴',
    fire(t, e) { _basicShot(t, e, '#ffeb3b', '⚡', {type:'stun',duration:0.3}, 500); }
  },

  // ===== 레어 (5종) =====
  charmander_g: {
    id:'charmander_g', name:'파이리', emoji:'🦎', grade:'rare',
    pokemonId:'charmander',
    damage:18, range:190, fireRate:3.5, special:'화염 관통',
    color:'#ff5722', desc:'관통 화염탄',
    fire(t, e) {
      const p = new Projectile(t.x,t.y,t.target,{engine:e,speed:500,damage:t.damage,
        color:'#ff7043',size:5,dmgType:'special',emoji:'🔥',
        piercing:true,pierceWidth:26,status:{type:'burn',duration:2,factor:8}});
      e.projectiles.push(p);
    }
  },
  geodude_g: {
    id:'geodude_g', name:'꼬마돌', emoji:'🪨', grade:'rare',
    pokemonId:'geodude',
    damage:22, range:175, fireRate:0.95, special:'범위 스턴',
    color:'#8d6e63', desc:'돌 던지기 범위 스턴',
    fire(t, e) {
      const p = new Projectile(t.x,t.y,t.target,{engine:e,speed:380,damage:t.damage,
        color:'#a1887f',size:8,dmgType:'physical',emoji:'🪨',
        splash:50,status:{type:'stun',duration:0.5}});
      e.projectiles.push(p);
    }
  },
  abra_g: {
    id:'abra_g', name:'케이시', emoji:'🔮', grade:'rare',
    pokemonId:'abra',
    damage:16, range:220, fireRate:1.3, special:'다중 슬로우',
    color:'#ba68c8', desc:'2타겟 동시 공격',
    fire(t, e) {
      const targets = e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
        .sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for (const tgt of targets) {
        e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#ce93d8',size:4,beam:true,beamLife:0.15}));
        tgt.takeDamage(t.damage,'special');
        tgt.applyStatus('slow',2.0,0.55);
        e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8');
      }
    }
  },
  golbat_g: {
    id:'golbat_g', name:'골뱃', emoji:'🦇', grade:'rare',
    pokemonId:'golbat',
    damage:15, range:210, fireRate:2.0, special:'비행+흡혈',
    color:'#9c27b0', desc:'공중 적 우선 + 흡혈',
    fire(t, e) {
      _basicShot(t, e, '#9c27b0', '🦇', {type:'slow',duration:1.2,factor:0.6}, 420, (enemy)=>{
        t._hp = (t._hp||100) + 5; // 흡혈 (시각적)
        e.spawnFloatingText('♥+5', t.x, t.y-24, '#e91e63');
      });
    }
  },
  jigglypuff_g: {
    id:'jigglypuff_g', name:'질퍽이', emoji:'🔴', grade:'rare',
    pokemonId:'jigglypuff',
    damage:12, range:200, fireRate:1.0, special:'광역 노래',
    color:'#f48fb1', desc:'주기적 광역 슬로우',
    fire(t, e) {
      t._songTimer = (t._songTimer||0) + 1/t.fireRate;
      if (t._songTimer >= 4) {
        t._songTimer = 0;
        for (const en of e.enemies) {
          if (!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
            en.applyStatus('slow',2.5,0.5);
        }
        e.particles.push(new AoeBurst(t.x,t.y,t.range,'#f48fb1'));
        e.spawnFloatingText('🎵',t.x,t.y-30,'#f48fb1');
      }
      _basicShot(t, e, '#f48fb1', '🎵', null, 320);
    }
  },

  // ===== 에픽 (5종) =====
  snorlax_g: {
    id:'snorlax_g', name:'잠만보', emoji:'😴', grade:'epic',
    pokemonId:'snorlax',
    damage:35, range:170, fireRate:0.85, special:'하품 광역 스턴',
    color:'#9575cd', desc:'주기적 광역 스턴',
    fire(t, e) {
      t._yawnTimer = (t._yawnTimer||0) + 1/t.fireRate;
      if (t._yawnTimer >= 4.5) {
        t._yawnTimer = 0;
        for (const en of e.enemies)
          if (!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=120)
            en.applyStatus('stun',2.2,0);
        e.particles.push(new AoeBurst(t.x,t.y,120,'#9575cd'));
        e.spawnFloatingText('💤하품!',t.x,t.y-30,'#ce93d8');
      }
      _basicShot(t,e,'#7e57c2','💤',{type:'stun',duration:1.2},280);
    }
  },
  jynx_g: {
    id:'jynx_g', name:'쥬레곤', emoji:'❄️', grade:'epic',
    pokemonId:'jynxline',
    damage:24, range:225, fireRate:1.2, special:'빙결+분열',
    color:'#80deea', desc:'빙결 + 2발 분열',
    fire(t, e) {
      const sorted = e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
        .sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,2);
      for (const tgt of sorted) {
        e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:440,damage:t.damage,
          color:'#80deea',size:6,dmgType:'special',emoji:'❄️',
          status:{type:'freeze',duration:1.5}}));
      }
    }
  },
  magneton_g: {
    id:'magneton_g', name:'레어코일', emoji:'⚡', grade:'epic',
    pokemonId:'voltorb',
    damage:28, range:200, fireRate:1.5, special:'체인 번개',
    color:'#ffd600', desc:'체인 번개 3연쇄',
    fire(t, e) {
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:600,damage:t.damage,
        color:'#ffeb3b',size:5,dmgType:'special',emoji:'⚡',
        status:{type:'stun',duration:0.6},chain:3,chainRange:150}));
    }
  },
  haunter_g: {
    id:'haunter_g', name:'고우스트', emoji:'👤', grade:'epic',
    pokemonId:'haunter',
    damage:26, range:215, fireRate:1.3, special:'유령 관통',
    color:'#5e35b1', desc:'모든 방어 무시',
    fire(t, e) {
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:360,damage:t.damage*1.5,
        color:'#7c4dff',size:7,dmgType:'special',emoji:'👻',
        status:{type:'slow',duration:2,factor:0.5}}));
    }
  },
  dragonair_g: {
    id:'dragonair_g', name:'드래곤에어', emoji:'🐉', grade:'epic',
    pokemonId:'dragonite',
    damage:30, range:235, fireRate:1.1, special:'용의 분노',
    color:'#4fc3f7', desc:'주기적 전체 슬로우+데미지',
    fire(t, e) {
      t._rageTimer = (t._rageTimer||0) + 1/t.fireRate;
      if (t._rageTimer >= 6) {
        t._rageTimer = 0;
        for (const en of e.enemies)
          if (!en.dead&&!en.reachedEnd) { en.takeDamage(t.damage*0.5,'special'); en.applyStatus('slow',2,0.55); }
        e.particles.push(new AoeBurst(t.x,t.y,t.range,'#4fc3f7'));
        e.spawnFloatingText('🌊용의분노!',t.x,t.y-30,'#29b6f6');
      }
      _basicShot(t,e,'#4fc3f7','🐉',{type:'slow',duration:1.5,factor:0.6},400);
    }
  },

  // ===== 레전드 (5종) =====
  charizard_g: {
    id:'charizard_g', name:'리자몽', emoji:'🔥', grade:'legend',
    pokemonId:'charmander',
    damage:55, range:240, fireRate:4.5, special:'불대문자 폭발',
    color:'#ff5722', desc:'관통+폭발 25%',
    fire(t, e) {
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:520,damage:t.damage,
        color:'#ff7043',size:6,dmgType:'special',emoji:'🔥',
        piercing:true,pierceWidth:28,status:{type:'burn',duration:3,factor:14},
        onHit:(en)=>{
          if(Math.random()<0.25){
            for(const e2 of e.enemies) if(Math.hypot(e2.x-en.x,e2.y-en.y)<70) e2.takeDamage(t.damage*1.2,'special');
            e.particles.push(new AoeBurst(en.x,en.y,70,'#ff6f00'));
            e.spawnFloatingText('💥불대문자!',en.x,en.y-22,'#ff6f00');
          }
        }}));
    }
  },
  blastoise_g: {
    id:'blastoise_g', name:'거북왕', emoji:'🌊', grade:'legend',
    pokemonId:'squirtle',
    damage:50, range:250, fireRate:1.4, special:'하이드로펌프',
    color:'#1565c0', desc:'강력한 넉백+슬로우',
    fire(t, e) {
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:400,damage:t.damage,
        color:'#1e88e5',size:8,dmgType:'physical',emoji:'💦',
        splash:65,status:{type:'slow',duration:3.5,factor:0.3},knockback:55}));
    }
  },
  venusaur_g: {
    id:'venusaur_g', name:'이상해꽃', emoji:'🌳', grade:'legend',
    pokemonId:'bulbasaur',
    damage:42, range:265, fireRate:1.5, special:'태양광선',
    color:'#2e7d32', desc:'독+태양광선 조합',
    fire(t, e) {
      t._sunTimer=(t._sunTimer||0)+1/t.fireRate;
      if(t._sunTimer>=3){
        t._sunTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
          en.takeDamage(t.damage*2,'special');
        e.particles.push(new AoeBurst(t.x,t.y,t.range,'#cddc39'));
        e.spawnFloatingText('☀️태양광선!',t.x,t.y-32,'#cddc39');
      }
      _basicShot(t,e,'#7cb342','🍃',{type:'poison',duration:4,factor:15},340);
    }
  },
  alakazam_g: {
    id:'alakazam_g', name:'후딘', emoji:'✨', grade:'legend',
    pokemonId:'abra',
    damage:48, range:285, fireRate:1.5, special:'염동력 5타',
    color:'#7b1fa2', desc:'5타겟 동시 공격+슬로우',
    fire(t, e) {
      const targets = e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
        .sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,5);
      for(const tgt of targets){
        e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#ce93d8',size:4,beam:true,beamLife:0.18}));
        let dmg=t.damage;
        if(Math.random()<0.4){dmg*=2.8;e.spawnFloatingText('💥크리!',tgt.x,tgt.y-18,'#f48fb1');}
        tgt.takeDamage(dmg,'special');
        tgt.applyStatus('slow',2.5,0.38);
        e.spawnHitParticle(tgt.x,tgt.y,'#ba68c8');
      }
    }
  },
  zapmagneton_g: {
    id:'zapmagneton_g', name:'자포코일', emoji:'🌟', grade:'legend',
    pokemonId:'voltorb',
    damage:45, range:230, fireRate:1.7, special:'EMP 폭발',
    color:'#f9a825', desc:'광역 EMP 즉발 폭발',
    fire(t, e) {
      t._empTimer=(t._empTimer||0)+1/t.fireRate;
      if(t._empTimer>=3){
        t._empTimer=0;
        for(const en of e.enemies)
          if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=130){
            en.takeDamage(t.damage,'special');
            en.applyStatus('stun',1.8,0);
          }
        e.particles.push(new AoeBurst(t.x,t.y,130,'#ffeb3b'));
        e.spawnFloatingText('⚡EMP!',t.x,t.y-32,'#ffeb3b');
        return;
      }
      _basicShot(t,e,'#ffeb3b','⚡',{type:'stun',duration:0.8},620,null,3,140);
    }
  },

  // ===== 유니크 (3종) =====
  pikachu_ace: {
    id:'pikachu_ace', name:'피카츄ACE', emoji:'⚡', grade:'unique',
    pokemonId:'pikachu',
    damage:80, range:300, fireRate:2.5, special:'100만볼트+체인',
    color:'#ffd600', desc:'5체인 번개+광역EMP',
    fire(t, e) {
      e.projectiles.push(new Projectile(t.x,t.y,t.target,{engine:e,speed:650,damage:t.damage,
        color:'#fff176',size:6,dmgType:'special',emoji:'⚡',
        status:{type:'stun',duration:1.0},chain:5,chainRange:180}));
      t._aceTimer=(t._aceTimer||0)+1/t.fireRate;
      if(t._aceTimer>=5){
        t._aceTimer=0;
        for(const en of e.enemies)
          if(!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
            en.takeDamage(t.damage*1.5,'special');
        e.particles.push(new AoeBurst(t.x,t.y,t.range,'#fff176'));
        e.spawnFloatingText('⚡100만볼트!',t.x,t.y-36,'#ffd600');
      }
    }
  },
  articuno_g: {
    id:'articuno_g', name:'아티쿠노', emoji:'🦅', grade:'unique',
    pokemonId:'jynxline',
    damage:70, range:310, fireRate:1.3, special:'눈보라 전체',
    color:'#80deea', desc:'전체 빙결+분열3발',
    fire(t, e) {
      const sorted = e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
        .sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,3);
      for(const tgt of sorted)
        e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,speed:460,damage:t.damage,
          color:'#b3e5fc',size:7,dmgType:'special',emoji:'❄️',
          status:{type:'freeze',duration:2.8}}));
      t._blizTimer=(t._blizTimer||0)+1/t.fireRate;
      if(t._blizTimer>=6){
        t._blizTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd) en.applyStatus('slow',3.5,0.3);
        e.particles.push(new AoeBurst(t.x,t.y,t.range,'#b3e5fc'));
        e.spawnFloatingText('🌨️눈보라!',t.x,t.y-36,'#80deea');
      }
    }
  },
  mewtwo_tower: {
    id:'mewtwo_tower', name:'뮤츠', emoji:'🔮', grade:'unique',
    pokemonId:'mewtwo',
    damage:100, range:320, fireRate:1.6, special:'사이킥 전지전능',
    color:'#7c4dff', desc:'전체 슬로우+크리+광역',
    fire(t, e) {
      const all = e.enemies.filter(en=>!en.dead&&!en.reachedEnd&&Math.hypot(en.x-t.x,en.y-t.y)<=t.range)
        .sort((a,b)=>b.distTraveled-a.distTraveled).slice(0,6);
      for(const tgt of all){
        let dmg=t.damage;
        if(Math.random()<0.35){dmg*=3;e.spawnFloatingText('🔮크리!',tgt.x,tgt.y-20,'#b39ddb');}
        e.projectiles.push(new Projectile(t.x,t.y,tgt,{engine:e,color:'#b39ddb',size:5,beam:true,beamLife:0.2}));
        tgt.takeDamage(dmg,'special');
        tgt.applyStatus('slow',2.5,0.35);
        e.spawnHitParticle(tgt.x,tgt.y,'#7c4dff');
      }
      t._psyTimer=(t._psyTimer||0)+1/t.fireRate;
      if(t._psyTimer>=4){
        t._psyTimer=0;
        for(const en of e.enemies) if(!en.dead&&!en.reachedEnd) en.applyStatus('slow',1.5,0.5);
        e.particles.push(new AoeBurst(t.x,t.y,t.range,'#7c4dff'));
      }
    }
  },
};

// ===== 헬퍼 함수 =====
function _basicShot(tower, engine, color, emoji, status, speed, onHit, chain, chainRange) {
  if (!tower.target) return;
  engine.projectiles.push(new Projectile(tower.x, tower.y, tower.target, {
    engine, speed:speed||380, damage:tower.damage,
    color, size:5, dmgType:'special', emoji, status, onHit,
    chain:chain||0, chainRange:chainRange||140,
  }));
}

// ===== 뽑기 확률표 =====
const PULL_TABLES = {
  normal: [   // 일반 뽑기 (50g)
    {grade:'normal', weight:70},
    {grade:'rare',   weight:25},
    {grade:'epic',   weight:4.5},
    {grade:'legend', weight:0.49},
    {grade:'unique', weight:0.01},
  ],
  premium: [  // 프리미엄 (120g)
    {grade:'normal', weight:30},
    {grade:'rare',   weight:45},
    {grade:'epic',   weight:20},
    {grade:'legend', weight:4.5},
    {grade:'unique', weight:0.5},
  ],
  gamble: [   // 도박 (200g)
    {grade:'normal', weight:5},
    {grade:'rare',   weight:25},
    {grade:'epic',   weight:45},
    {grade:'legend', weight:22},
    {grade:'unique', weight:3},
  ],
};

const PULL_COSTS = { normal:50, premium:120, gamble:200, ten:450 };

// 등급별 타워 목록
const GRADE_POOLS = {
  normal:  ['rattata_g','zubat_g','abo_g','paras_g','squirtle_g','bulbasaur_g','magnemite_g'],
  rare:    ['charmander_g','geodude_g','abra_g','golbat_g','jigglypuff_g'],
  epic:    ['snorlax_g','jynx_g','magneton_g','haunter_g','dragonair_g'],
  legend:  ['charizard_g','blastoise_g','venusaur_g','alakazam_g','zapmagneton_g'],
  unique:  ['pikachu_ace','articuno_g','mewtwo_tower'],
};

// ===== 합치기 진화 테이블 =====
// 같은 타워 3개 → 진화
const MERGE_EVOLUTION = {
  // 노말 3개 → 레어
  'rattata_g':    'charmander_g',
  'zubat_g':      'golbat_g',
  'abo_g':        'geodude_g',
  'paras_g':      'jigglypuff_g',
  'squirtle_g':   'geodude_g',
  'bulbasaur_g':  'charmander_g',
  'magnemite_g':  'abra_g',
  // 레어 3개 → 에픽
  'charmander_g': 'snorlax_g',
  'geodude_g':    'magneton_g',
  'abra_g':       'alakazam_g',   // 미리 상위 등급 진화
  'golbat_g':     'haunter_g',
  'jigglypuff_g': 'jynx_g',
  // 에픽 3개 → 레전드
  'snorlax_g':    'blastoise_g',
  'jynx_g':       'articuno_g',   // 유니크 직행
  'magneton_g':   'zapmagneton_g',
  'haunter_g':    'alakazam_g',
  'dragonair_g':  'charizard_g',
  // 레전드 3개 → 유니크
  'charizard_g':  'pikachu_ace',
  'blastoise_g':  'mewtwo_tower',
  'venusaur_g':   'mewtwo_tower',
  'alakazam_g':   'mewtwo_tower',
  'zapmagneton_g':'pikachu_ace',
};

// ===== 뽑기 함수 =====
function rollGrade(tableKey) {
  const table = PULL_TABLES[tableKey];
  const total = table.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const entry of table) {
    r -= entry.weight;
    if (r <= 0) return entry.grade;
  }
  return table[table.length - 1].grade;
}

function rollTower(tableKey) {
  const grade = rollGrade(tableKey);
  const pool = GRADE_POOLS[grade];
  const id = pool[Math.floor(Math.random() * pool.length)];
  return { ...GachaTowerDefs[id], _starLevel: 1 };
}

function rollTen(engine, spendFn) {
  if (!spendFn(PULL_COSTS.ten)) return null;
  const results = [];
  for (let i = 0; i < 10; i++) {
    // 10연 중 8번째는 에픽 보장
    const key = (i === 7) ? 'gamble' : 'normal';
    results.push(rollTower(key));
  }
  return results;
}

// ===== 합치기 체크 =====
// 같은 타워 id가 3개 이상 있을 때 자동 합치기
function checkMerge(towers, towerSlots, engine) {
  const counts = {};
  for (const slot of towerSlots) {
    if (!slot.occupied || !slot.tower) continue;
    const id = slot.tower._gachaId;
    if (!id) continue;
    if (!counts[id]) counts[id] = [];
    counts[id].push(slot);
  }
  for (const id in counts) {
    if (counts[id].length >= 3) {
      const slots = counts[id].slice(0, 3);
      const evoId = MERGE_EVOLUTION[id];
      if (!evoId || !GachaTowerDefs[evoId]) continue;

      // 첫 슬롯에 진화된 타워 배치, 나머지 2개 제거
      const evoDef = GachaTowerDefs[evoId];
      const targetSlot = slots[0];

      // 기존 타워 제거
      for (let i = 1; i < 3; i++) {
        const s = slots[i];
        engine.towers = engine.towers.filter(t => t !== s.tower);
        s.occupied = false; s.tower = null;
      }

      // 새 진화 타워 생성
      const evoTower = _createGachaTower(evoDef, targetSlot.x, targetSlot.y);
      targetSlot.tower = evoTower;
      engine.towers = engine.towers.filter(t => t !== slots[0].tower);
      engine.towers.push(evoTower);

      engine.spawnFloatingText(`✨ ${evoDef.name} 진화!`, targetSlot.x, targetSlot.y - 36, GRADES[evoDef.grade].color);
      engine.particles.push(new AoeBurst(targetSlot.x, targetSlot.y, 60, GRADES[evoDef.grade].color));
      engine.triggerScreenShake(5, 0.2);

      if (window.applyTowerSynergies) window.applyTowerSynergies(engine.towers);
      return true; // 한번에 하나씩
    }
  }
  return false;
}

// ===== 가챠 타워 클래스 팩토리 =====
function _createGachaTower(def, x, y) {
  const t = {
    x, y,
    _gachaId: def.id,
    def, // 호환용
    name: def.name,
    level: 1,
    path: null,
    totalSpent: 0,
    cooldown: 0,
    fireFlash: 0,
    _rotAngle: 0,
    synergyBonus: 0,
    buffRangeMul: 1,
    buffDmgMul: 1,
    target: null,
    get range() { return (def.range + this.synergyBonus * 2) * this.buffRangeMul; },
    get damage() { return (def.damage + this.synergyBonus) * this.buffDmgMul; },
    get fireRate() { return def.fireRate; },
    upgradeCost() { return null; }, // 가챠는 합치기로 업그레이드
    findTarget(enemies) {
      if (this.target && !this.target.dead && !this.target.reachedEnd) {
        if (Math.hypot(this.target.x-this.x,this.target.y-this.y) <= this.range) return this.target;
      }
      let best=null, bestP=-1;
      for (const e of enemies) {
        if (e.dead||e.reachedEnd) continue;
        const d=Math.hypot(e.x-this.x,e.y-this.y);
        if (d>this.range) continue;
        if (e.distTraveled>bestP) { bestP=e.distTraveled; best=e; }
      }
      return best;
    },
    update(dt, enemies, engine) {
      this.engine=engine;
      this.cooldown-=dt;
      if(this.fireFlash>0) this.fireFlash-=dt;
      this._rotAngle+=dt*0.5;
      this.target=this.findTarget(enemies);
      if(this.target&&this.cooldown<=0){
        this.cooldown=1/this.fireRate;
        this.fireFlash=0.1;
        def.fire(this, engine);
      }
    },
    draw(ctx) {
      const grade = GRADES[def.grade];

      // 합치기 가능 표시 (같은 타워 3개 이상)
      if (this.engine) {
        const sameCount = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === def.id).length;
        if (sameCount >= 3) {
          ctx.save();
          ctx.beginPath(); ctx.arc(this.x, this.y, 30, 0, Math.PI*2);
          ctx.strokeStyle = `rgba(6,214,160,${0.5 + Math.sin(Date.now()*0.006)*0.3})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#06d6a0'; ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.restore();
        }
      }
      if (def.grade !== 'normal') {
        ctx.save();
        ctx.beginPath(); ctx.arc(this.x,this.y,28,0,Math.PI*2);
        const g=ctx.createRadialGradient(this.x,this.y,4,this.x,this.y,28);
        g.addColorStop(0,grade.color+'30'); g.addColorStop(1,'transparent');
        ctx.fillStyle=g; ctx.fill();
        if (def.grade==='unique') {
          // 무지개 회전링
          const hue = (Date.now()*0.1) % 360;
          ctx.strokeStyle=`hsla(${hue},100%,65%,0.7)`;
          ctx.lineWidth=2.5; ctx.setLineDash([5,4]);
          ctx.beginPath(); ctx.arc(this.x,this.y,26,0,Math.PI*2); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // 발사 플래시
      if (this.fireFlash > 0) {
        ctx.save();
        ctx.globalAlpha=(this.fireFlash/0.1)*0.4;
        ctx.beginPath(); ctx.arc(this.x,this.y,26,0,Math.PI*2);
        ctx.fillStyle=grade.color; ctx.fill();
        ctx.restore();
      }

      // 베이스 패드
      ctx.save();
      ctx.beginPath(); ctx.arc(this.x,this.y+3,22,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(this.x,this.y,21,0,Math.PI*2);
      ctx.fillStyle=grade.bg+'cc';
      ctx.strokeStyle=grade.color;
      ctx.lineWidth=def.grade==='unique'?3:2;
      if(def.grade!=='normal') { ctx.shadowColor=grade.color; ctx.shadowBlur=10; }
      ctx.fill(); ctx.stroke();

      // 포켓몬 이미지
      const imgPath = window.TowerSpriteImages?.[def.pokemonId] ||
                      `assets/towers/${def.pokemonId}.png` ||
                      `assets/enemies/${def.pokemonId}.png`;
      const img = window.loadSpriteImage?.(imgPath);
      const sz = 28 + (def.grade==='unique'?6:def.grade==='legend'?4:def.grade==='epic'?2:0);
      if (img && img.complete && img.naturalWidth>0) {
        ctx.drawImage(img, this.x-sz/2, this.y-sz/2, sz, sz);
      } else {
        ctx.font=`${sz*0.85}px serif`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(def.emoji, this.x, this.y);
      }
      ctx.restore();

      // 등급 뱃지 (우상단)
      ctx.save();
      ctx.font='bold 8px -apple-system,sans-serif';
      ctx.fillStyle=grade.color;
      ctx.shadowColor='rgba(0,0,0,0.9)'; ctx.shadowBlur=3;
      ctx.textAlign='center';
      ctx.fillText('★'.repeat(GRADES[def.grade].stars), this.x, this.y-22);
      ctx.restore();
    },
  };
  return t;
}

// ===== 미션 시스템 =====
const MissionDefs = [
  { id:'first_rare',  name:'첫 레어!',    desc:'레어 이상 타워 뽑기',       reward:80,  rewardType:'gold', condition:(s)=>s.totalRareCount>=1 },
  { id:'first_epic',  name:'에픽 등장!',  desc:'에픽 이상 타워 뽑기',       reward:150, rewardType:'gold', condition:(s)=>s.totalEpicCount>=1 },
  { id:'first_legend',name:'레전드!',     desc:'레전드 이상 타워 뽑기',     reward:300, rewardType:'gold', condition:(s)=>s.totalLegendCount>=1 },
  { id:'first_unique', name:'유니크!',    desc:'유니크 타워 뽑기',          reward:500, rewardType:'gold', condition:(s)=>s.totalUniqueCount>=1 },
  { id:'first_merge', name:'첫 합치기!',  desc:'합치기로 타워 진화',         reward:100, rewardType:'gold', condition:(s)=>s.mergeCount>=1 },
  { id:'merge5',      name:'합치기 장인', desc:'합치기 5회 달성',            reward:200, rewardType:'gold', condition:(s)=>s.mergeCount>=5 },
  { id:'combo10',     name:'콤보 10!',   desc:'콤보 10 달성',               reward:80,  rewardType:'gold', condition:(s)=>s.maxCombo>=10 },
  { id:'combo30',     name:'콤보 마스터', desc:'콤보 30 달성',               reward:200, rewardType:'gold', condition:(s)=>s.maxCombo>=30 },
  { id:'wave5',       name:'웨이브 5',   desc:'웨이브 5 클리어',            reward:120, rewardType:'gold', condition:(s)=>s.wavesCleared>=5 },
  { id:'wave10',      name:'웨이브 10',  desc:'웨이브 10 클리어',           reward:200, rewardType:'gold', condition:(s)=>s.wavesCleared>=10 },
  { id:'boss1',       name:'첫 보스 처치',desc:'보스 1마리 처치',           reward:250, rewardType:'gold', condition:(s)=>s.bossKills>=1 },
  { id:'noleak5',     name:'퍼펙트 5',   desc:'웨이브 5까지 라이프 손실 없음',reward:300,rewardType:'gold', condition:(s)=>s.wavesCleared>=5&&s.livesLost===0 },
  { id:'towers8',     name:'군대 집결',  desc:'타워 8개 동시 배치',         reward:150, rewardType:'gold', condition:(s)=>s.maxTowersDeployed>=8 },
  { id:'gamble5',     name:'도박꾼',     desc:'도박 뽑기 5회',              reward:100, rewardType:'gold', condition:(s)=>s.gambleCount>=5 },
  { id:'ten_pull',    name:'10연 도전',  desc:'10연 뽑기 1회',              reward:120, rewardType:'gold', condition:(s)=>s.tenPullCount>=1 },
];

class MissionTracker {
  constructor() {
    this.stats = {
      totalRareCount:0, totalEpicCount:0, totalLegendCount:0, totalUniqueCount:0,
      mergeCount:0, maxCombo:0, wavesCleared:0, bossKills:0,
      livesLost:0, maxTowersDeployed:0, gambleCount:0, tenPullCount:0,
    };
    this.completed = new Set();
    this.onComplete = null; // callback(mission)
  }
  update(engine) {
    this.stats.maxTowersDeployed = Math.max(this.stats.maxTowersDeployed, engine.towers.length);
    if (engine.comboCount > this.stats.maxCombo) this.stats.maxCombo = engine.comboCount;
  }
  check() {
    for (const m of MissionDefs) {
      if (!this.completed.has(m.id) && m.condition(this.stats)) {
        this.completed.add(m.id);
        this.onComplete && this.onComplete(m);
      }
    }
  }
}

// ===== 전역 등록 =====
window.GRADES = GRADES;
window.GachaTowerDefs = GachaTowerDefs;
window.GRADE_POOLS = GRADE_POOLS;
window.PULL_COSTS = PULL_COSTS;
window.rollTower = rollTower;
window.rollTen = rollTen;
window.checkMerge = checkMerge;
window._createGachaTower = _createGachaTower;
window.MissionDefs = MissionDefs;
window.MissionTracker = MissionTracker;
window.MERGE_EVOLUTION = MERGE_EVOLUTION;
// 이미지 경로 재사용
window.TowerSpriteImages = {
  bulbasaur:'assets/towers/bulbasaur.png', charmander:'assets/towers/charmander.png',
  squirtle:'assets/towers/squirtle.png',   voltorb:'assets/towers/voltorb.png',
  jynxline:'assets/towers/jynxline.png',   geodude:'assets/towers/geodude.png',
  abra:'assets/towers/abra.png',           snorlax:'assets/towers/snorlax.png',
  pikachu:'assets/heroes/pikachu.png',     mewtwo:'assets/enemies/mewtwo.png',
};
