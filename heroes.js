// ===== HEROES.JS - 영웅 3종 + 스킬트리 + 스킨 시스템 =====

// ===== 스킨 정의 =====
const SkinDefs = {
  pikachu: {
    default:   { name:'기본',     emoji:'⚡', color:'#ffd600', unlocked:true,  fxColor:'#fff176' },
    christmas: { name:'크리스마스',emoji:'🎅', color:'#e53935', unlocked:false, fxColor:'#ffcdd2', badge:'🎄' },
    sakura:    { name:'벚꽃',     emoji:'🌸', color:'#f8bbd0', unlocked:false, fxColor:'#fce4ec', badge:'🌸' },
    halloween: { name:'할로윈',   emoji:'🎃', color:'#ff6f00', unlocked:false, fxColor:'#bf360c', badge:'🦇' },
  },
  mew: {
    default:   { name:'기본',     emoji:'💗', color:'#f48fb1', unlocked:true,  fxColor:'#f8bbd0' },
    christmas: { name:'크리스마스',emoji:'🎁', color:'#66bb6a', unlocked:false, fxColor:'#c8e6c9', badge:'🎄' },
    sakura:    { name:'벚꽃',     emoji:'🌷', color:'#ce93d8', unlocked:false, fxColor:'#f3e5f5', badge:'🌸' },
  },
  togepi: {
    default:   { name:'기본',     emoji:'🥚', color:'#fff9c4', unlocked:true,  fxColor:'#fffde7' },
    christmas: { name:'크리스마스',emoji:'⛄', color:'#81d4fa', unlocked:false, fxColor:'#e1f5fe', badge:'🎄' },
    sakura:    { name:'벚꽃',     emoji:'🌺', color:'#ffab91', unlocked:false, fxColor:'#fbe9e7', badge:'🌸' },
  },
  charizard: {
    default: { name:'기본', emoji:'🔥', color:'#ff5722', unlocked:true, fxColor:'#ffab91' },
  },
  blastoise: {
    default: { name:'기본', emoji:'🐢', color:'#0288d1', unlocked:true, fxColor:'#81d4fa' },
  },
  eevee: {
    default: { name:'기본', emoji:'🦊', color:'#a1887f', unlocked:true, fxColor:'#d7ccc8' },
  },
};

// ===== 스킬트리 정의 =====
// 3x3 트리, 레벨업시 포인트 1개 획득
// 노드 구조: { id, name, emoji, desc, cost(포인트), requires(id), type, value }
const SkillTrees = {
  // ===== 피카츄 (전기 딜러) - 포켓몬덱스: 전기쥐, 볼트태클, 철벽, 전기충격 =====
  pikachu: {
    nodes: [
      // Row 0 - 기본기
      {id:'jolt1',   name:'전기충격',  emoji:'⚡', desc:'기본공격 데미지 +18%', cost:1, requires:null, col:0, row:0, type:'atkDmg', value:0.18},
      {id:'volt1',   name:'볼트',      emoji:'🔵', desc:'기본공격 사거리 +15%', cost:1, requires:null, col:1, row:0, type:'atkRange', value:0.15},
      {id:'swift1',  name:'전광석화',  emoji:'💨', desc:'공격속도 +20%',         cost:1, requires:null, col:2, row:0, type:'fireRate', value:0.20},
      // Row 1
      {id:'para2',   name:'마비분말',  emoji:'🌀', desc:'기본공격 스턴 확률 +25%',cost:1, requires:'jolt1', col:0, row:1, type:'stunChance', value:0.25},
      {id:'crit2',   name:'크리티컬',  emoji:'💥', desc:'30% 확률 2.5배 크리',   cost:1, requires:'volt1', col:1, row:1, type:'crit', value:{chance:0.30, mul:2.5}},
      {id:'aoe2',    name:'방전',      emoji:'🌩️', desc:'100만볼트 범위 +50%',   cost:1, requires:'swift1', col:2, row:1, type:'skillRange', value:0.50},
      // Row 2
      {id:'thunder3',name:'천둥',      emoji:'⛈️', desc:'20% 확률 번개 소환(광역)',cost:2, requires:'para2', col:0, row:2, type:'lightning', value:0.20},
      {id:'raichu3', name:'라이츄화',  emoji:'⭐', desc:'기본공격 체인 번개 3연쇄',cost:2, requires:'crit2', col:1, row:2, type:'chainAtk', value:3},
      {id:'overload3',name:'오버로드', emoji:'🔮', desc:'모든 스킬 쿨다운 -35%',  cost:2, requires:'aoe2',  col:2, row:2, type:'cdReduce', value:0.35},
      // Row 3
      {id:'iron4',   name:'철벽',      emoji:'🛡️', desc:'스턴 지속시간 +0.5초 추가', cost:2, requires:'thunder3', col:0, row:3, type:'stunDur', value:0.5},
      {id:'volt4',   name:'볼트태클',  emoji:'💫', desc:'기본공격 후 폭발(소형 광역)',cost:2, requires:'raichu3',  col:1, row:3, type:'atkSplash', value:60},
      {id:'cd4',     name:'전기구슬',  emoji:'🟡', desc:'전광석화 쿨다운 -5초',   cost:2, requires:'overload3', col:2, row:3, type:'skillCd', skillIdx:1, value:-5},
    ]
  },

  // ===== 뮤 (광역 서포터) - 포켓몬덱스: 사이킥, 오리진포스, 변신, 메가진화 =====
  mew: {
    nodes: [
      // Row 0
      {id:'psycho1', name:'사이킥',    emoji:'🔮', desc:'기본공격 데미지 +15%',    cost:1, requires:null, col:0, row:0, type:'atkDmg', value:0.15},
      {id:'range1',  name:'에어리어',  emoji:'🔵', desc:'타워 전체 사거리 +8%p',   cost:1, requires:null, col:1, row:0, type:'passiveRange', value:0.08},
      {id:'slow1',   name:'슬로우빔', emoji:'🐌', desc:'슬로우 효과 -10%p 강화',   cost:1, requires:null, col:2, row:0, type:'slowBoost', value:0.10},
      // Row 1
      {id:'barrier2',name:'배리어',   emoji:'🛡️', desc:'라이프 손실 20% 확률 무효',cost:1, requires:'psycho1', col:0, row:1, type:'barrier', value:0.20},
      {id:'clone2',  name:'분신',     emoji:'👥', desc:'기본공격 35% 확률 2발 발사',cost:1, requires:'range1',  col:1, row:1, type:'doubleShot', value:0.35},
      {id:'mind2',   name:'마인드블라스트',emoji:'💫',desc:'사이킥 범위 +60%',     cost:1, requires:'slow1',   col:2, row:1, type:'skillRange', value:0.60},
      // Row 2
      {id:'heal3',   name:'힐링웨이브',emoji:'💚',desc:'웨이브 클리어시 라이프 +2', cost:2, requires:'barrier2', col:0, row:2, type:'waveHeal', value:2},
      {id:'transform3',name:'변신+',  emoji:'✨', desc:'변신 스킬 무력화 +3초',    cost:2, requires:'clone2',   col:1, row:2, type:'skillBoost', skillIdx:1, value:3},
      {id:'omni3',   name:'전지전능', emoji:'🌟', desc:'타워 전체 데미지 +12%',     cost:2, requires:'mind2',    col:2, row:2, type:'globalDmg', value:0.12},
      // Row 3
      {id:'mega4',   name:'메가진화', emoji:'💠', desc:'5초마다 자동 사이킥 발동',  cost:2, requires:'heal3',    col:0, row:3, type:'autoCast', value:5},
      {id:'origin4', name:'오리진포스',emoji:'🌈',desc:'기본공격이 5타겟 동시 공격',cost:2, requires:'transform3',col:1, row:3, type:'multiTarget', value:5},
      {id:'space4',  name:'시공간제어',emoji:'🌀',desc:'모든 스킬 쿨다운 -40%',    cost:2, requires:'omni3',    col:2, row:3, type:'cdReduce', value:0.40},
    ]
  },

  // ===== 토게피 (행운/지원) - 포켓몬덱스: 메트로놈, 행복의알, 소원별, 요정바람 =====
  togepi: {
    nodes: [
      // Row 0
      {id:'luck1',   name:'행운',     emoji:'🍀', desc:'골드 획득 +20%',          cost:1, requires:null, col:0, row:0, type:'goldBonus', value:0.20},
      {id:'fairy1',  name:'요정바람', emoji:'🌸', desc:'기본공격 데미지 +15%',     cost:1, requires:null, col:1, row:0, type:'atkDmg', value:0.15},
      {id:'cd1',     name:'응원',     emoji:'📣', desc:'스킬 쿨다운 -25%',         cost:1, requires:null, col:2, row:0, type:'cdReduce', value:0.25},
      // Row 1
      {id:'jackpot2',name:'잭팟',     emoji:'🎰', desc:'킬시 8% 확률 추가 +15g',  cost:1, requires:'luck1',  col:0, row:1, type:'killGold', value:{chance:0.08, amount:15}},
      {id:'egg2',    name:'행복의알', emoji:'🥚', desc:'메트로놈 쿨다운 -5초',     cost:1, requires:'fairy1', col:1, row:1, type:'skillCd', skillIdx:0, value:-5},
      {id:'wish2',   name:'소원별',   emoji:'🌠', desc:'라이프 최대 +5',           cost:1, requires:'cd1',    col:2, row:1, type:'maxLives', value:5},
      // Row 2
      {id:'charm3',  name:'매혹',     emoji:'💕', desc:'주변 적 이동속도 영구-10%',cost:2, requires:'jackpot2',col:0, row:2, type:'passiveSlow', value:0.10},
      {id:'dazzle3', name:'눈부심',   emoji:'✨', desc:'행복의알 데미지 이펙트 추가',cost:2, requires:'egg2',   col:1, row:2, type:'eggBurst', value:1},
      {id:'togetic3',name:'토게틱화', emoji:'🦋', desc:'사거리 +20%, 공격속도 +20%',cost:2, requires:'wish2',  col:2, row:2, type:'allBoost', value:0.20},
      // Row 3
      {id:'gold4',   name:'황금알',   emoji:'💰', desc:'웨이브 보상 골드 +60%',    cost:2, requires:'charm3',  col:0, row:3, type:'waveGold', value:0.60},
      {id:'metro4',  name:'메트로놈+',emoji:'🎲', desc:'메트로놈 효과 2배 강화',   cost:2, requires:'dazzle3', col:1, row:3, type:'metroBoost', value:2},
      {id:'harmony4',name:'조화',     emoji:'🌟', desc:'모든 영웅 스킬 쿨다운 공유 -20%',cost:2, requires:'togetic3',col:2, row:3, type:'harmonyAura', value:0.20},
    ]
  }
};

// ===== 리자몽 (불꽃 딜러) =====
SkillTrees.charizard = {
  nodes: [
    {id:'cz_dmg1',  name:'불꽃엄니', emoji:'🔥', desc:'기본공격 데미지 +18%',   cost:1, requires:null, col:0, row:0, type:'atkDmg', value:0.18},
    {id:'cz_rng1',  name:'비행',     emoji:'🦇', desc:'기본공격 사거리 +15%',   cost:1, requires:null, col:1, row:0, type:'atkRange', value:0.15},
    {id:'cz_spd1',  name:'질풍날개', emoji:'💨', desc:'공격속도 +20%',          cost:1, requires:null, col:2, row:0, type:'fireRate', value:0.20},
    {id:'cz_crit2', name:'급소각오', emoji:'💥', desc:'30% 확률 2.5배 크리',    cost:1, requires:'cz_dmg1', col:0, row:1, type:'crit', value:{chance:0.30, mul:2.5}},
    {id:'cz_aoe2',  name:'화염방사', emoji:'🌋', desc:'불꽃보라기 범위 +50%',   cost:1, requires:'cz_rng1', col:1, row:1, type:'skillRange', value:0.50},
    {id:'cz_cd2',   name:'속공',     emoji:'⏱️', desc:'모든 스킬 쿨다운 -20%', cost:1, requires:'cz_spd1', col:2, row:1, type:'cdReduce', value:0.20},
    {id:'cz_glb3',  name:'투지',     emoji:'💪', desc:'타워 전체 데미지 +12%',  cost:2, requires:'cz_crit2', col:0, row:2, type:'globalDmg', value:0.12},
    {id:'cz_multi3',name:'멀티스케일',emoji:'🛡️',desc:'기본공격 3타겟 동시 공격',cost:2, requires:'cz_aoe2', col:1, row:2, type:'multiTarget', value:3},
    {id:'cz_life3', name:'생명력',   emoji:'❤️', desc:'라이프 최대 +5',        cost:2, requires:'cz_cd2', col:2, row:2, type:'maxLives', value:5},
    {id:'cz_mega4', name:'메가진화X',emoji:'⭐', desc:'모든 스킬 쿨다운 -40%',  cost:2, requires:'cz_glb3', col:0, row:3, type:'cdReduce', value:0.40},
    {id:'cz_king4', name:'불꽃의왕', emoji:'👑', desc:'기본공격 데미지 +30%',   cost:2, requires:'cz_multi3', col:1, row:3, type:'atkDmg', value:0.30},
    {id:'cz_tank4', name:'용의보호막',emoji:'🐉',desc:'라이프 최대 +8',        cost:2, requires:'cz_life3', col:2, row:3, type:'maxLives', value:8},
  ]
};

// ===== 거북왕 (물 제어/서포터) =====
SkillTrees.blastoise = {
  nodes: [
    {id:'bs_dmg1',  name:'수포',     emoji:'💧', desc:'기본공격 데미지 +15%',    cost:1, requires:null, col:0, row:0, type:'atkDmg', value:0.15},
    {id:'bs_rng1',  name:'조준사격', emoji:'🎯', desc:'기본공격 사거리 +18%',    cost:1, requires:null, col:1, row:0, type:'atkRange', value:0.18},
    {id:'bs_slow1', name:'급류',     emoji:'🌊', desc:'타워 전체 슬로우 효과 강화',cost:1, requires:null, col:2, row:0, type:'slowBoost', value:0.10},
    {id:'bs_range2',name:'수압포',   emoji:'🔵', desc:'타워 전체 사거리 +8%p',   cost:1, requires:'bs_dmg1', col:0, row:1, type:'passiveRange', value:0.08},
    {id:'bs_skr2',  name:'해일',     emoji:'🌊', desc:'하이드로펌프 범위 +55%',  cost:1, requires:'bs_rng1', col:1, row:1, type:'skillRange', value:0.55},
    {id:'bs_life2', name:'등껍질',   emoji:'🛡️', desc:'라이프 최대 +5',        cost:1, requires:'bs_slow1', col:2, row:1, type:'maxLives', value:5},
    {id:'bs_glb3',  name:'격려',     emoji:'📣', desc:'타워 전체 데미지 +12%',   cost:2, requires:'bs_range2', col:0, row:2, type:'globalDmg', value:0.12},
    {id:'bs_cd3',   name:'재정비',   emoji:'⏱️', desc:'모든 스킬 쿨다운 -25%',  cost:2, requires:'bs_skr2', col:1, row:2, type:'cdReduce', value:0.25},
    {id:'bs_wheal3',name:'치유의물', emoji:'💚', desc:'웨이브 클리어시 라이프 +2',cost:2, requires:'bs_life2', col:2, row:2, type:'waveHeal', value:2},
    {id:'bs_mega4', name:'메가진화X',emoji:'⭐', desc:'모든 스킬 쿨다운 -40%',   cost:2, requires:'bs_glb3', col:0, row:3, type:'cdReduce', value:0.40},
    {id:'bs_king4', name:'심해의왕', emoji:'👑', desc:'기본공격 데미지 +30%',    cost:2, requires:'bs_cd3', col:1, row:3, type:'atkDmg', value:0.30},
    {id:'bs_tank4', name:'철벽방어', emoji:'🏰', desc:'라이프 최대 +8',         cost:2, requires:'bs_wheal3', col:2, row:3, type:'maxLives', value:8},
  ]
};

// ===== 이브이 (만능형 - 진화로 특화됨) =====
SkillTrees.eevee = {
  nodes: [
    {id:'ev_dmg1',  name:'몸통박치기', emoji:'⭐', desc:'기본공격 데미지 +15%',   cost:1, requires:null, col:0, row:0, type:'atkDmg', value:0.15},
    {id:'ev_rng1',  name:'예민한감각', emoji:'👁️', desc:'기본공격 사거리 +16%',   cost:1, requires:null, col:1, row:0, type:'atkRange', value:0.16},
    {id:'ev_spd1',  name:'기민함',   emoji:'💨', desc:'공격속도 +18%',           cost:1, requires:null, col:2, row:0, type:'fireRate', value:0.18},
    {id:'ev_crit2', name:'약점포착', emoji:'💥', desc:'25% 확률 2.2배 크리',      cost:1, requires:'ev_dmg1', col:0, row:1, type:'crit', value:{chance:0.25, mul:2.2}},
    {id:'ev_skr2',  name:'집중',     emoji:'🔵', desc:'스킬 범위 +45%',          cost:1, requires:'ev_rng1', col:1, row:1, type:'skillRange', value:0.45},
    {id:'ev_cd2',   name:'순응',     emoji:'⏱️', desc:'모든 스킬 쿨다운 -20%',   cost:1, requires:'ev_spd1', col:2, row:1, type:'cdReduce', value:0.20},
    {id:'ev_glb3',  name:'유대',     emoji:'💗', desc:'타워 전체 데미지 +10%',    cost:2, requires:'ev_crit2', col:0, row:2, type:'globalDmg', value:0.10},
    {id:'ev_multi3',name:'다재다능', emoji:'🌈', desc:'기본공격 2타겟 동시 공격', cost:2, requires:'ev_skr2', col:1, row:2, type:'multiTarget', value:2},
    {id:'ev_life3', name:'생명력',   emoji:'❤️', desc:'라이프 최대 +5',          cost:2, requires:'ev_cd2', col:2, row:2, type:'maxLives', value:5},
    {id:'ev_final4',name:'진화의빛', emoji:'✨', desc:'모든 스킬 쿨다운 -35%',    cost:2, requires:'ev_glb3', col:0, row:3, type:'cdReduce', value:0.35},
    {id:'ev_king4', name:'베테랑',   emoji:'👑', desc:'기본공격 데미지 +25%',     cost:2, requires:'ev_multi3', col:1, row:3, type:'atkDmg', value:0.25},
    {id:'ev_tank4', name:'수호본능', emoji:'🛡️', desc:'라이프 최대 +8',          cost:2, requires:'ev_life3', col:2, row:3, type:'maxLives', value:8},
  ]
};

// ===== 영웅 기본 정의 =====
const HeroDefs = {
  pikachu: {
    id:'pikachu', name:'피카츄', baseColor:'#ffd600',
    role:'전기 딜러',
    passive:'전기 타워 데미지 +15%',
    evolution:{ level:15, options:[
      { id:'raichu', name:'라이츄', color:'#ff9800', statMul:1.20 },
    ]},
    attack:{
      baseRange:175, baseDamage:10, baseFireRate:1.1,
      rangePerLevel:7, damagePerLevel:3,
      projColor:'#fff176', projEmoji:'⚡', dmgType:'special',
      status:{type:'stun', duration:0.15},
    },
    passiveApply(engine, hero) {
      const dmgMul = 1.15 + (hero ? hero._skillVal('passiveRange', 0) : 0);
      for (const t of engine.towers) {
        if (t.def?.id === 'voltorb') t.buffDmgMul = dmgMul;
      }
    },
    skills:[
      {
        name:'100만볼트', emoji:'⚡', baseCooldown:14,
        desc:'범위 내 모든 적에게 전기 데미지 + 감전',
        cast(hero, engine) {
          const r = (140 + hero.level * 10) * (1 + hero._skillVal('skillRange', 0));
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd) continue;
            if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
              e.takeDamage(40 + hero.level * 15, 'special');
              e.applyStatus('stun', 0.9, 0);
            }
          }
          engine.particles.push(new AoeBurst(hero.x, hero.y, r, '#fff176'));
          engine.spawnFloatingText('⚡100만볼트!', hero.x, hero.y-32, '#ffeb3b');
        }
      },
      {
        name:'전광석화', emoji:'💨', baseCooldown:10,
        desc:'가장 강한 적에게 즉시 막대한 피해',
        cast(hero, engine) {
          let target=null, maxHp=-1;
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd) continue;
            if (e.hp > maxHp) { maxHp=e.hp; target=e; }
          }
          if (target) {
            target.takeDamage(160 + hero.level * 55, 'special');
            engine.particles.push(new ChainBolt(hero.x, hero.y, target.x, target.y));
            engine.spawnFloatingText('💨전광석화!', target.x, target.y-22, '#ffd600');
          }
        }
      },
    ],
  },

  mew: {
    id:'mew', name:'뮤', baseColor:'#f48fb1',
    role:'광역 슬로우 / 버프',
    passive:'모든 타워 사거리 +10%',
    attack:{
      baseRange:220, baseDamage:12, baseFireRate:1.1,
      rangePerLevel:8, damagePerLevel:3,
      projColor:'#ce93d8', projEmoji:'🔮', dmgType:'special',
      status:{type:'slow', duration:1.5, factor:0.7},
    },
    passiveApply(engine, hero) {
      const bonus = 0.10 + (hero ? hero._skillVal('passiveRange', 0) : 0);
      for (const t of engine.towers) t.buffRangeMul = 1 + bonus;
    },
    skills:[
      {
        name:'사이킥', emoji:'🔮', baseCooldown:13,
        desc:'범위 내 모든 적 슬로우 + 데미지',
        cast(hero, engine) {
          const r = (150 + hero.level * 10) * (1 + hero._skillVal('skillRange', 0));
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd) continue;
            if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
              e.applyStatus('slow', 3.5, 0.38);
              e.takeDamage(22 + hero.level * 9, 'special');
            }
          }
          engine.particles.push(new AoeBurst(hero.x, hero.y, r, '#ce93d8'));
          engine.spawnFloatingText('🔮사이킥!', hero.x, hero.y-32, '#ce93d8');
        }
      },
      {
        name:'변신', emoji:'✨', baseCooldown:20,
        desc:'가장 약한 적 무력화 (4초)',
        cast(hero, engine) {
          let target=null, minHp=Infinity;
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd||e.isBoss) continue;
            if (e.hp < minHp) { minHp=e.hp; target=e; }
          }
          if (target) {
            target.applyStatus('stun', 4.5 + hero.level * 0.5, 0);
            engine.spawnFloatingText('✨변신!', target.x, target.y-22, '#f8bbd0');
          }
        }
      },
    ],
  },

  togepi: {
    id:'togepi', name:'토게피', baseColor:'#fff9c4',
    role:'서포터 / 행운',
    passive:'피격 반사 데미지 + 골드 보너스',
    evolution:{ level:15, options:[
      { id:'togetic', name:'토게틱', color:'#f8bbd0', statMul:1.20 },
    ]},
    attack:{
      baseRange:165, baseDamage:7, baseFireRate:1.0,
      rangePerLevel:6, damagePerLevel:2,
      projColor:'#fff59d', projEmoji:'✨', dmgType:'special',
    },
    passiveApply(engine, hero) {
      engine._togepiReflect = true;
      engine._togepiGoldMul = 1 + (hero ? hero._skillVal('goldBonus', 0) : 0);
    },
    skills:[
      {
        name:'메트로놈', emoji:'🎲', baseCooldown:16,
        desc:'랜덤 대형 효과 발동',
        cast(hero, engine) {
          const roll = Math.floor(Math.random() * 4);
          if (roll === 0) {
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.takeDamage(65+hero.level*22,'special'); }
            engine.spawnFloatingText('🎲전체 피해!', hero.x, hero.y-32, '#ffd54f');
          } else if (roll === 1) {
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.applyStatus('slow',3.5,0.38); }
            engine.spawnFloatingText('🎲전체 슬로우!', hero.x, hero.y-32, '#4fc3f7');
          } else if (roll === 2) {
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.applyStatus('stun',1.5,0); }
            engine.spawnFloatingText('🎲전체 스턴!', hero.x, hero.y-32, '#ba68c8');
          } else {
            engine.gold += 50 + hero.level * 10;
            engine.onGoldChange && engine.onGoldChange(engine.gold);
            engine.spawnFloatingText(`🎲골드 획득! +${50+hero.level*10}g`, hero.x, hero.y-32, '#ffd60a');
          }
        }
      },
      {
        name:'행복의알', emoji:'🥚', baseCooldown:18,
        desc:'모든 타워 데미지 +25% (8초)',
        cast(hero, engine) {
          for (const t of engine.towers) {
            t.buffDmgMul = (t.buffDmgMul||1) * 1.25;
            t._happyEggTimer = 8;
          }
          engine.spawnFloatingText('🥚행복의알!', hero.x, hero.y-32, '#fff59d');
        }
      },
    ],
  },
};

// ===== 리자몽 (불꽃 타입 영웅) =====
HeroDefs.charizard = {
  id:'charizard', name:'리자몽', baseColor:'#ff5722',
  role:'화염 딜러',
  passive:'불꽃 타입 타워 데미지 +15%',
  attack:{
    baseRange:210, baseDamage:18, baseFireRate:1.2,
    rangePerLevel:6, damagePerLevel:4,
    projColor:'#ff7043', projEmoji:'🔥', dmgType:'special',
    status:{type:'burn', duration:2, factor:8},
  },
  passiveApply(engine, hero) {
    const dmgMul = 1.15 + (hero ? hero._skillVal('passiveRange', 0) : 0);
    for (const t of engine.towers) if (t.def?.type === 'fire') t.buffDmgMul = dmgMul;
  },
  skills:[
    {
      name:'불꽃보라기', emoji:'🔥', baseCooldown:13,
      desc:'범위 내 모든 적에게 화염 데미지 + 화상',
      cast(hero, engine) {
        const r = (150 + hero.level * 10) * (1 + hero._skillVal('skillRange', 0));
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
            e.takeDamage(36 + hero.level * 13, 'special');
            e.applyStatus('burn', 3, 12 + hero.level);
          }
        }
        engine.particles.push(new AoeBurst(hero.x, hero.y, r, '#ff5722'));
        engine.spawnFloatingText('🔥불꽃보라기!', hero.x, hero.y-32, '#ff7043');
      }
    },
    {
      name:'용의날개', emoji:'🐉', baseCooldown:19,
      desc:'모든 적에게 큰 피해 + 3초 슬로우',
      cast(hero, engine) {
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          e.takeDamage(70 + hero.level * 24, 'special');
          e.applyStatus('slow', 3, 0.45);
        }
        engine.particles.push(new AoeBurst(hero.x, hero.y, Math.max(engine.width,engine.height), '#ff3d00'));
        engine.spawnFloatingText('🐉용의날개!', hero.x, hero.y-32, '#ff5722');
      }
    },
  ],
};

// ===== 거북왕 (물 타입 영웅) =====
HeroDefs.blastoise = {
  id:'blastoise', name:'거북왕', baseColor:'#0288d1',
  role:'제어 / 서포터',
  passive:'물 타입 타워 사거리 +10%',
  attack:{
    baseRange:220, baseDamage:14, baseFireRate:1.1,
    rangePerLevel:7, damagePerLevel:3,
    projColor:'#4fc3f7', projEmoji:'💧', dmgType:'special',
    status:{type:'slow', duration:1.8, factor:0.65},
  },
  passiveApply(engine, hero) {
    const bonus = 0.10 + (hero ? hero._skillVal('passiveRange', 0) : 0);
    for (const t of engine.towers) if (t.def?.type === 'water') t.buffRangeMul = 1 + bonus;
  },
  skills:[
    {
      name:'하이드로펌프', emoji:'🌊', baseCooldown:13,
      desc:'범위 내 모든 적 큰 슬로우 + 데미지',
      cast(hero, engine) {
        const r = (150 + hero.level * 10) * (1 + hero._skillVal('skillRange', 0));
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
            e.applyStatus('slow', 3.5, 0.35);
            e.takeDamage(24 + hero.level * 9, 'special');
          }
        }
        engine.particles.push(new AoeBurst(hero.x, hero.y, r, '#0288d1'));
        engine.spawnFloatingText('🌊하이드로펌프!', hero.x, hero.y-32, '#4fc3f7');
      }
    },
    {
      name:'쉘아머', emoji:'🛡️', baseCooldown:20,
      desc:'라이프 +4 회복 + 주변 적 2.5초 스턴',
      cast(hero, engine) {
        engine.lives = Math.min(engine.lives + 4, 99);
        engine.onLivesChange && engine.onLivesChange(engine.lives);
        const r = 130 + hero.level * 8;
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) e.applyStatus('stun', 2.5, 0);
        }
        engine.spawnFloatingText('🛡️쉘아머! 라이프+4', hero.x, hero.y-32, '#81d4fa');
      }
    },
  ],
};

// ===== 이브이 (만능형, 레벨12에 3갈래 진화 선택) =====
HeroDefs.eevee = {
  id:'eevee', name:'이브이', baseColor:'#a1887f',
  role:'만능형 (진화로 특화)',
  passive:'모든 타워 데미지 +5%',
  attack:{
    baseRange:170, baseDamage:7, baseFireRate:0.95,
    rangePerLevel:6, damagePerLevel:2,
    projColor:'#d7ccc8', projEmoji:'⭐', dmgType:'special',
  },
  evolution:{ level:12, options:[
    { id:'vaporeon', name:'샤미드',   color:'#29b6f6', statMul:1.28, focus:'물(사거리 특화)' },
    { id:'jolteon',  name:'쥬피썬더', color:'#ffd600', statMul:1.28, focus:'전기(공속 특화)' },
    { id:'flareon',  name:'부스터',   color:'#ff5722', statMul:1.28, focus:'불(데미지 특화)' },
  ]},
  passiveApply(engine, hero) {
    const mul = 1.05 + (hero ? hero._skillVal('passiveRange', 0) : 0);
    for (const t of engine.towers) t.buffDmgMul = Math.max(t.buffDmgMul || 1, mul);
  },
  skills:[
    {
      name:'적응', emoji:'🌀', baseCooldown:14,
      desc:'범위 내 모든 적 슬로우 + 소량 피해',
      cast(hero, engine) {
        const r = (140 + hero.level * 8) * (1 + hero._skillVal('skillRange', 0));
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
            e.takeDamage(18 + hero.level * 6, 'special');
            e.applyStatus('slow', 2.5, 0.5);
          }
        }
        engine.particles.push(new AoeBurst(hero.x, hero.y, r, hero._evoColor || '#a1887f'));
        engine.spawnFloatingText('🌀적응!', hero.x, hero.y-32, '#d7ccc8');
      }
    },
    {
      name:'재빠른몸놀림', emoji:'💨', baseCooldown:20,
      desc:'모든 스킬 쿨다운 즉시 30% 감소',
      cast(hero, engine) {
        for (const h of engine.heroes) h.cooldowns = h.cooldowns.map(c => c * 0.7);
        engine.spawnFloatingText('💨재빠른몸놀림!', hero.x, hero.y-32, '#fff59d');
      }
    },
  ],
};

// ===== HERO CLASS =====
class Hero {
  constructor(heroId, x, y, skinId='default') {
    this.id = heroId;
    this.def = HeroDefs[heroId];
    this.x = x; this.y = y;
    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.skinId = skinId;

    // 스킬 쿨다운
    this.cooldowns = this.def.skills.map(() => 0);
    this.castFlash = [0, 0];

    // 자동 공격
    this.attackTarget = null;
    this.attackCooldown = 0;

    // 스킬트리
    this.skillPoints = 1;   // 시작시 1포인트
    this.unlockedSkills = new Set();

    // 애니메이션
    const drawFn = (window.HeroDrawFns && window.HeroDrawFns[heroId]) || null;
    this.rig = drawFn ? new window.SpriteRig(drawFn, {attackDuration:0.3, bobAmount:2.5, bobSpeed:3}) : null;
  }

  get skin() { return SkinDefs[this.id][this.skinId] || SkinDefs[this.id].default; }
  get skinFx() { return this.skin.fxColor; }
  get name() { return this.def.name; }

  get attackRange() {
    const a = this.def.attack;
    if (!a) return 0;
    return (a.baseRange + (this.level-1)*a.rangePerLevel) * (1 + this._skillVal('atkRange', 0)) * (this._evoStatMul || 1);
  }
  get attackDamage() {
    const a = this.def.attack;
    if (!a) return 0;
    return (a.baseDamage + (this.level-1)*a.damagePerLevel) * (1 + this._skillVal('atkDmg', 0)) * (this._evoStatMul || 1);
  }
  get attackFireRate() {
    const a = this.def.attack;
    if (!a) return 0;
    return a.baseFireRate * (1 + this._skillVal('fireRate', 0));
  }

  // 스킬트리 값 합산
  _skillVal(type, defaultVal = 0) {
    const tree = SkillTrees[this.id];
    if (!tree) return defaultVal;
    let total = defaultVal;
    for (const nodeId of this.unlockedSkills) {
      const node = tree.nodes.find(n => n.id === nodeId);
      if (node && node.type === type) {
        if (typeof node.value === 'number') total += node.value;
      }
    }
    return total;
  }

  _skillCd(idx) {
    const base = this.def.skills[idx].baseCooldown;
    const reduce = this._skillVal('cdReduce', 0);
    return base * (1 - reduce);
  }

  unlockSkillNode(nodeId, engine) {
    const tree = SkillTrees[this.id];
    if (!tree) return false;
    const node = tree.nodes.find(n => n.id === nodeId);
    if (!node) return false;
    if (this.unlockedSkills.has(nodeId)) return false;
    if (this.skillPoints < node.cost) return false;
    if (node.requires && !this.unlockedSkills.has(node.requires)) return false;
    this.skillPoints -= node.cost;
    this.unlockedSkills.add(nodeId);

    // 즉발 효과
    if (node.type === 'maxLives' && engine) {
      engine.lives += node.value;
      engine.onLivesChange && engine.onLivesChange(engine.lives);
    }
    engine && engine.spawnFloatingText(`✨ ${node.name}!`, this.x, this.y-40, '#c084fc');
    return true;
  }

  gainExp(amount, engine) {
    this.exp += amount;
    while (this.exp >= this.expToNext && this.level < 25) {
      this.exp -= this.expToNext;
      this.level++;
      this.skillPoints++;
      this.expToNext = Math.floor(this.expToNext * 1.30);
      engine && engine.spawnFloatingText(`${this.def.name} Lv${this.level}! +SP`, this.x, this.y-42, '#ffd60a');
      engine && engine.particles && engine.particles.push(new AoeBurst(this.x, this.y, 50, '#ffd60a'));

      // 진화 체크 (스킬트리로 전략 짜다가 한참 뒤에 진화하도록 레벨 게이트)
      const evo = this.def.evolution;
      if (evo && !this.evolved && !this.evolutionPending && this.level >= evo.level) {
        if (evo.options.length === 1) {
          this._evolve(evo.options[0], engine);
        } else {
          this.evolutionPending = true;
          engine && engine.onHeroEvolutionReady && engine.onHeroEvolutionReady(this);
        }
      }
    }
  }

  // 진화 실행 (단일 경로는 자동, 다중 경로는 evolutionPending 상태에서 evolve() 수동 호출)
  _evolve(option, engine) {
    this.evolved = option.id;
    this.evolutionPending = false;
    this._evoStatMul = option.statMul || 1.2;
    this._evoColor = option.color;
    engine && engine.spawnFloatingText(`✨ ${option.name}(으)로 진화!`, this.x, this.y-46, option.color);
    engine && engine.particles && engine.particles.push(new AoeBurst(this.x, this.y, 70, option.color));
    engine && engine.triggerScreenShake && engine.triggerScreenShake(6, 0.3);
    engine && engine.onHeroEvolved && engine.onHeroEvolved(this);
  }
  evolve(optionId, engine) {
    const evo = this.def.evolution;
    if (!evo || !this.evolutionPending) return false;
    const option = evo.options.find(o => o.id === optionId);
    if (!option) return false;
    this._evolve(option, engine);
    return true;
  }

  _skinHueShift() {
    const map = {christmas:320, sakura:200, halloween:60};
    return map[this.skinId] || 0;
  }

  findAttackTarget(enemies) {
    if (this.attackTarget && !this.attackTarget.dead && !this.attackTarget.reachedEnd) {
      if (Math.hypot(this.attackTarget.x-this.x,this.attackTarget.y-this.y) <= this.attackRange)
        return this.attackTarget;
    }
    let best=null, bestProgress=-1;
    for (const e of enemies) {
      if (e.dead||e.reachedEnd) continue;
      if (Math.hypot(e.x-this.x,e.y-this.y) > this.attackRange) continue;
      if (e.distTraveled > bestProgress) { bestProgress=e.distTraveled; best=e; }
    }
    return best;
  }

  fireBasicAttack(engine) {
    const a = this.def.attack;
    if (!a || !this.attackTarget) return;
    let dmg = this.attackDamage;
    let isCrit = false;
    const critChance = this._skillVal('crit', null);
    if (critChance && typeof critChance === 'object' && Math.random() < critChance.chance) {
      dmg *= critChance.mul;
      isCrit = true;
    }
    // 스킬트리: lightning (가끔 번개소환)
    const lightningChance = this._skillVal('lightning', 0);
    if (lightningChance > 0 && Math.random() < lightningChance) {
      engine.particles.push(new AoeBurst(this.attackTarget.x, this.attackTarget.y, 80, '#fff176'));
      for (const e of engine.enemies) {
        if (e.dead||e.reachedEnd) continue;
        if (Math.hypot(e.x-this.attackTarget.x,e.y-this.attackTarget.y) < 80) {
          e.takeDamage(dmg * 0.6, 'special');
          e.applyStatus('stun', 0.3, 0);
        }
      }
    }
    // 스킬트리: chainAtk (체인번개)
    const chainAtk = this._skillVal('chainAtk', 0);
    const proj = new Projectile(this.x, this.y, this.attackTarget, {
      engine, speed:440, damage:dmg, color:a.projColor, size:6,
      dmgType:a.dmgType||'special', emoji:a.projEmoji,
      status:a.status ? {...a.status} : null,
      chain: chainAtk || 0, chainRange: 140,
    });
    engine.projectiles.push(proj);
    if (isCrit) engine.spawnFloatingText(`💥크리!`, this.attackTarget.x, this.attackTarget.y-20, '#ff6b6b');
    if (this.rig) this.rig.triggerAttack();

    // 스킬트리: doubleShot
    const dblChance = this._skillVal('doubleShot', 0);
    if (dblChance > 0 && Math.random() < dblChance) {
      const proj2 = new Projectile(this.x, this.y, this.attackTarget, {
        engine, speed:440, damage:dmg, color:a.projColor, size:6,
        dmgType:a.dmgType||'special', emoji:a.projEmoji,
        status:a.status ? {...a.status} : null,
      });
      engine.projectiles.push(proj2);
    }
  }

  update(dt, engine) {
    this.def.passiveApply(engine, this);

    for (let i = 0; i < this.cooldowns.length; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i] -= dt;
      if (this.castFlash[i] > 0) this.castFlash[i] -= dt;
    }

    // 자동 공격
    if (this.def.attack && engine.enemies) {
      this.attackCooldown -= dt;
      this.attackTarget = this.findAttackTarget(engine.enemies);
      if (this.attackTarget && this.attackCooldown <= 0) {
        this.attackCooldown = 1 / this.attackFireRate;
        this.fireBasicAttack(engine);
      }
    }

    if (this.rig) this.rig.update(dt, false);
  }

  canCast(idx) { return this.cooldowns[idx] <= 0; }

  cast(idx, engine) {
    if (!this.canCast(idx)) return false;
    const skill = this.def.skills[idx];
    skill.cast(this, engine);
    this.cooldowns[idx] = this._skillCd(idx);
    this.castFlash[idx] = 0.3;
    return true;
  }

  draw(ctx) {
    const skin = this.skin;

    // 사거리 점선
    if (this.def.attack) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.attackRange, 0, Math.PI * 2);
      ctx.strokeStyle = skin.color + '28';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const auraColor = this._evoColor || skin.color;
    const spriteKey = this.evolved || this.id;
    const spritePath = window.HeroSpriteImages && window.HeroSpriteImages[spriteKey];
    const spriteImg = spritePath ? window.loadSpriteImage(spritePath) : null;

    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      ctx.save();
      // 오라 (진화했으면 진화 타입 색, 아니면 스킨 색)
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.evolved ? 36 : 30, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(this.x,this.y,5,this.x,this.y,this.evolved?36:30);
      grad.addColorStop(0, auraColor + (this.evolved ? '60' : '40'));
      grad.addColorStop(1, auraColor + '00');
      ctx.fillStyle = grad;
      ctx.fill();
      if (this.evolved) {
        ctx.strokeStyle = auraColor + '80'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(this.x, this.y, 30 + Math.sin(Date.now()*0.004)*3, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();

      const drawSize = 46;
      ctx.save();
      ctx.drawImage(spriteImg, this.x - drawSize/2, this.y - drawSize/2, drawSize, drawSize);
      ctx.restore();

      if (skin.badge) {
        ctx.save();
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.fillText(skin.badge, this.x+17, this.y-17);
        ctx.restore();
      }

      ctx.save();
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = this.skillPoints > 0 ? '#ffd60a' : '#fff';
      ctx.fillText(`Lv${this.level}${this.skillPoints>0?' ✦':''}`, this.x, this.y+34);
      ctx.restore();
      return;
    }

    if (this.rig) {
      ctx.save();
      // 오라
      ctx.beginPath();
      ctx.arc(this.x, this.y, 32, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(this.x,this.y,5,this.x,this.y,32);
      grad.addColorStop(0, skin.color + '45');
      grad.addColorStop(1, skin.color + '00');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      const needsTint = this.skinId !== 'default';
      if (needsTint) {
        ctx.save();
        ctx.filter = `hue-rotate(${this._skinHueShift()}deg) saturate(1.3)`;
      }
      this.rig.draw(ctx, this.x, this.y, 24, skin.color);
      if (needsTint) ctx.restore();

      if (skin.badge) {
        ctx.save();
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.fillText(skin.badge, this.x+17, this.y-17);
        ctx.restore();
      }

      // 레벨 + 스킬포인트
      ctx.save();
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = this.skillPoints > 0 ? '#ffd60a' : '#fff';
      ctx.fillText(`Lv${this.level}${this.skillPoints>0?' ✦':''}`, this.x, this.y+34);
      ctx.restore();
    } else {
      // 폴백
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
      ctx.strokeStyle = skin.color; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '28px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(skin.emoji, this.x, this.y);
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Lv${this.level}`, this.x, this.y+34);
      ctx.restore();
    }
  }
}

const HeroProgress = {
  unlockedSkins:{ pikachu:['default'], mew:['default'], togepi:['default'] },
  unlockSkin(heroId, skinId) {
    if (!this.unlockedSkins[heroId].includes(skinId)) this.unlockedSkins[heroId].push(skinId);
  },
  isUnlocked(heroId, skinId) { return this.unlockedSkins[heroId].includes(skinId); },
};

// ===== 영웅 이미지 (기본형은 SpriteRig/이모지 폴백 유지, 진화형+이브이 계열은 실제 이미지) =====
window.HeroSpriteImages = {
  raichu:'assets/heroes/raichu.png',
  togetic:'assets/heroes/togetic.png',
  eevee:'assets/heroes/eevee.png',
  vaporeon:'assets/heroes/vaporeon.png',
  jolteon:'assets/heroes/jolteon.png',
  flareon:'assets/heroes/flareon.png',
};

window.HeroDefs = HeroDefs;
window.SkinDefs = SkinDefs;
window.SkillTrees = SkillTrees;
window.Hero = Hero;
window.HeroProgress = HeroProgress;
