// ===== HEROES.JS - 영웅 3종 + 스킬트리 + 스킨 시스템 =====

// v27-10: 영웅별 속성 매핑 (요청5 - 어떤 타입강화가 이 영웅에게 적용되는지 UI에 표시하기 위해)
const HERO_TYPE_MAP = {
  pikachu:'electric', raichu:'electric',
  togepi:'normal', togetic:'normal',
  eevee:'normal', vaporeon:'water', jolteon:'electric', flareon:'fire',
};
window.HERO_TYPE_MAP = HERO_TYPE_MAP;

// ===== 스킨 정의 =====
const SkinDefs = {
  pikachu: {
    default:   { name:'기본',     emoji:'⚡', color:'#ffd600', unlocked:true,  fxColor:'#fff176' },
    christmas: { name:'크리스마스',emoji:'🎅', color:'#e53935', unlocked:false, fxColor:'#ffcdd2', badge:'🎄' },
    sakura:    { name:'벚꽃',     emoji:'🌸', color:'#f8bbd0', unlocked:false, fxColor:'#fce4ec', badge:'🌸' },
    halloween: { name:'할로윈',   emoji:'🎃', color:'#ff6f00', unlocked:false, fxColor:'#bf360c', badge:'🦇' },
  },
  togepi: {
    default:   { name:'기본',     emoji:'🥚', color:'#fff9c4', unlocked:true,  fxColor:'#fffde7' },
    christmas: { name:'크리스마스',emoji:'⛄', color:'#81d4fa', unlocked:false, fxColor:'#e1f5fe', badge:'🎄' },
    sakura:    { name:'벚꽃',     emoji:'🌺', color:'#ffab91', unlocked:false, fxColor:'#fbe9e7', badge:'🌸' },
  },
  eevee: {
    default:   { name:'기본',       emoji:'🦊', color:'#a1887f', unlocked:true,  fxColor:'#d7ccc8' },
    christmas: { name:'크리스마스', emoji:'🎅', color:'#c62828', unlocked:false, fxColor:'#ffcdd2', badge:'🎄' },
    sakura:    { name:'벚꽃',       emoji:'🌸', color:'#f8bbd0', unlocked:false, fxColor:'#fce4ec', badge:'🌸' },
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
      {id:'para2',   name:'마비분말',  emoji:'🌀', desc:'기본공격 스턴 확률 +25%',cost:1, requires:'jolt1', col:0, row:1, type:'atkDmg', value:0.14},
      {id:'crit2',   name:'크리티컬',  emoji:'💥', desc:'30% 확률 2.5배 크리',   cost:1, requires:'volt1', col:1, row:1, type:'crit', value:{chance:0.30, mul:2.5}},
      {id:'aoe2',    name:'방전',      emoji:'🌩️', desc:'100만볼트 범위 +50%',   cost:1, requires:'swift1', col:2, row:1, type:'skillRange', value:0.50},
      // Row 2
      {id:'thunder3',name:'천둥',      emoji:'⛈️', desc:'20% 확률 번개 소환(광역)',cost:2, requires:'para2', col:0, row:2, type:'lightning', value:0.20},
      {id:'raichu3', name:'라이츄화',  emoji:'⭐', desc:'기본공격 체인 번개 3연쇄',cost:2, requires:'crit2', col:1, row:2, type:'chainAtk', value:3},
      {id:'overload3',name:'오버로드', emoji:'🔮', desc:'모든 스킬 쿨다운 -35%',  cost:2, requires:'aoe2',  col:2, row:2, type:'cdReduce', value:0.35},
      // Row 3
      {id:'iron4',   name:'철벽',      emoji:'🛡️', desc:'스턴 지속시간 +0.5초 추가', cost:2, requires:'thunder3', col:0, row:3, type:'atkDmg', value:0.10},
      {id:'volt4',   name:'볼트태클',  emoji:'💫', desc:'기본공격 후 폭발(소형 광역)',cost:2, requires:'raichu3',  col:1, row:3, type:'atkDmg', value:0.16},
      {id:'cd4',     name:'전기구슬',  emoji:'🟡', desc:'전광석화 쿨다운 -5초',   cost:2, requires:'overload3', col:2, row:3, type:'cdReduce', value:0.10},
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
      {id:'jackpot2',name:'잭팟',     emoji:'🎰', desc:'킬시 8% 확률 추가 +15g',  cost:1, requires:'luck1',  col:0, row:1, type:'goldBonus', value:0.10},
      {id:'egg2',    name:'행복의알', emoji:'🥚', desc:'공격력 +12%',     cost:1, requires:'fairy1', col:1, row:1, type:'atkDmg', value:0.12},
      {id:'wish2',   name:'소원별',   emoji:'🌠', desc:'사거리 +10%',           cost:1, requires:'cd1',    col:2, row:1, type:'atkRange', value:0.10},
      // Row 2
      {id:'charm3',  name:'매혹',     emoji:'💕', desc:'주변 적 이동속도 영구-10%',cost:2, requires:'jackpot2',col:0, row:2, type:'atkDmg', value:0.12},
      {id:'dazzle3', name:'눈부심',   emoji:'✨', desc:'행복의알 데미지 이펙트 추가',cost:2, requires:'egg2',   col:1, row:2, type:'atkDmg', value:0.10},
      {id:'togetic3',name:'토게틱화', emoji:'🦋', desc:'사거리 +20%, 공격속도 +20%',cost:2, requires:'wish2',  col:2, row:2, type:'atkRange', value:0.20},
      // Row 3
      {id:'gold4',   name:'황금알',   emoji:'💰', desc:'웨이브 보상 골드 +60%',    cost:2, requires:'charm3',  col:0, row:3, type:'goldBonus', value:0.30},
      {id:'metro4',  name:'메트로놈+',emoji:'🎲', desc:'메트로놈 효과 2배 강화',   cost:2, requires:'dazzle3', col:1, row:3, type:'atkDmg', value:0.16},
      {id:'harmony4',name:'조화',     emoji:'🌟', desc:'모든 영웅 스킬 쿨다운 공유 -20%',cost:2, requires:'togetic3',col:2, row:3, type:'cdReduce', value:0.20},
    ]
  }
};

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
    {id:'ev_life3', name:'적응력',   emoji:'🌈', desc:'공격력 +14%',          cost:2, requires:'ev_cd2', col:2, row:2, type:'atkDmg', value:0.14},
    {id:'ev_final4',name:'진화의빛', emoji:'✨', desc:'모든 스킬 쿨다운 -35%',    cost:2, requires:'ev_glb3', col:0, row:3, type:'cdReduce', value:0.35},
    {id:'ev_king4', name:'베테랑',   emoji:'👑', desc:'기본공격 데미지 +25%',     cost:2, requires:'ev_multi3', col:1, row:3, type:'atkDmg', value:0.25},
    {id:'ev_tank4', name:'수호본능', emoji:'🛡️', desc:'전체 타워 데미지 +8%',          cost:2, requires:'ev_life3', col:2, row:3, type:'globalDmg', value:0.08},
  ]
};

// ===== 영웅 기본 정의 =====
const HeroDefs = {
  pikachu: {
    id:'pikachu', name:'피카츄', baseColor:'#ffd600',
    role:'전기 딜러',
    passive:'전기 타워 데미지 +15%',
    evolution:{ level:15, options:[
      // v27-60: 데미지 특화로 통일(다른 강화 요소는 패시브 쪽에서 담당)
      { id:'raichu', name:'라이츄', color:'#ff9800', dmgMul:1.35, rangeMul:1.15, fireRateMul:1.0 },
    ]},
    attack:{
      baseRange:119, baseDamage:10, baseFireRate:1.1,
      rangePerLevel:7, damagePerLevel:3,
      projColor:'#fff176', projEmoji:'⚡', dmgType:'special',
      status:{type:'stun', duration:0.15},
    },
    passiveApply(engine, hero) {
      // v27-49 버그수정: 실존하지 않는 'voltorb' 타워 id를 체크하고 있어서 이 패시브가 완전히
      // 죽어있었음 (요청4 - "피카츄로 하면 유독 어렵다"의 진짜 원인). 리자몽/거북왕처럼 타입 기준으로 수정.
      // v27-60: "전기 포켓몬을 많이 모으면 강해지는 전략"으로 - 전기 타워 수에 비례해 추가 보너스
      // (진화(라이츄) 전엔 소폭, 진화 후엔 더 크게 - 몰빵 전략이 진화 이후 확실히 보상받도록)
      const electricCount = engine.towers.filter(t => t.def?.type === 'electric').length;
      const perTower = hero.evolved ? 0.035 : 0.02;
      const stackBonus = Math.min(electricCount * perTower, hero.evolved ? 0.70 : 0.30); // 상한선
      const dmgMul = 1.15 + stackBonus + (hero ? hero._skillVal('passiveRange', 0) : 0);
      for (const t of engine.towers) {
        if (t.def?.type === 'electric') t.buffDmgMul = Math.max(t.buffDmgMul||1, dmgMul);
      }
    },
    skills:[
      {
        name:'100만볼트', emoji:'⚡', baseCooldown:28,
        desc:'범위 내 모든 적에게 전기 데미지 + 감전',
        cast(hero, engine) {
          // v27-60: 레벨만 반영하던 고정 데미지 → 오토어택 데미지(타입강화/진화 다 반영됨) 비례로 변경
          const r = (140 + hero.level * 10) * (1 + hero._skillVal('skillRange', 0));
          const dmg = hero.attackDamage * 1.8;
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd) continue;
            if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
              e.takeDamage(dmg, 'special');
              e.applyStatus('stun', 0.9, 0);
            }
          }
          engine.particles.push(new AoeBurst(hero.x, hero.y, r, '#fff176'));
          engine.spawnFloatingText('⚡100만볼트!', hero.x, hero.y-32, '#ffeb3b');
        }
      },
      {
        name:'전광석화', emoji:'💨', baseCooldown:21,
        desc:'가장 강한 적에게 즉시 막대한 피해',
        cast(hero, engine) {
          let target=null, maxHp=-1;
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd) continue;
            if (e.hp > maxHp) { maxHp=e.hp; target=e; }
          }
          if (target) {
            // v27-60: 고정 데미지 → 오토어택 데미지 비례 (타입강화/진화 반영)
            target.takeDamage(hero.attackDamage * 4.5, 'special');
            engine.particles.push(new ChainBolt(hero.x, hero.y, target.x, target.y));
            engine.spawnFloatingText('💨전광석화!', target.x, target.y-22, '#ffd600');
          }
        }
      },
    ],
  },

  togepi: {
    id:'togepi', name:'토게피', baseColor:'#fff9c4',
    role:'서포터 / 행운',
    passive:'전체 타워 데미지 소폭 증가 + 골드 보너스',
    evolution:{ level:15, options:[
      // v27-60: 서포터 역할에 맞게 한 스탯 몰빵 대신 고르게 - 대신 패시브/스킬(행복의알) 쪽이 진짜 힘
      { id:'togetic', name:'토게틱', color:'#f8bbd0', dmgMul:1.15, rangeMul:1.35, fireRateMul:1.10 },
    ]},
    attack:{
      baseRange:112, baseDamage:9, baseFireRate:1.0,
      rangePerLevel:6, damagePerLevel:4, // v27-46: damagePerLevel 2→4 (요청5: 성장이 너무 약했음)
      projColor:'#fff59d', projEmoji:'✨', dmgType:'special',
    },
    passiveApply(engine, hero) {
      // v27-49 버그수정: "피격 반사 데미지"가 실제로는 아무데도 체크되지 않는 죽은 플래그였음
      // (요청4 - 영웅 밸런스 재검토 중 발견). 다른 영웅들(뮤츠/이브이)처럼 실제 작동하는 전체
      // 소폭 데미지 보너스로 교체.
      const mul = 1.08 + (hero ? hero._skillVal('passiveRange', 0) : 0);
      for (const t of engine.towers) t.buffDmgMul = Math.max(t.buffDmgMul || 1, mul);
      engine._togepiGoldMul = 1 + (hero ? hero._skillVal('goldBonus', 0) : 0);
    },
    skills:[
      {
        name:'메트로놈', emoji:'🎲', baseCooldown:33,
        desc:'랜덤 대형 효과 발동',
        cast(hero, engine) {
          const roll = Math.floor(Math.random() * 4);
          if (roll === 0) {
            const dmg = hero.attackDamage * 1.6; // v27-60: 고정값 → 오토어택 비례로 통일
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.takeDamage(dmg,'special'); }
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
        name:'행복의알', emoji:'🥚', baseCooldown:36,
        desc:'모든 타워 데미지 증가 (레벨에 비례, 8초)',
        cast(hero, engine) {
          // v27-29 버그수정: buffDmgMul(영구필드)에 직접 곱하고 타이머 해제 로직이 아예 없어서,
          // 쿨다운 24초마다 재사용할 때마다 데미지가 영구적으로 복리 누적되고 있었음(요청 - 지속피해
          // 원인 재검토 결과 발견. 셋 중 쿨다운이 제일 짧아 가장 심각했을 가능성). 임시배율 필드로 교체.
          // v27-60: 고정 +25%는 레벨을 올려도 안 세지는 유일한 스킬이었음 - 레벨 비례로 변경(Lv1=+25%, Lv25=+40%)
          const mul = 1 + 0.25 + hero.level * 0.006;
          for (const t of engine.towers) {
            t._tempDmgMul = mul;
            t._pokecenterTimer = 8; // 타워 update()의 만료처리 로직 재사용
          }
          engine.spawnFloatingText('🥚행복의알!', hero.x, hero.y-32, '#fff59d');
        }
      },
    ],
  },
};


// ===== 이브이 (만능형, 레벨12에 3갈래 진화 선택) =====
HeroDefs.eevee = {
  id:'eevee', name:'이브이', baseColor:'#a1887f',
  role:'만능형 (진화로 특화)',
  passive:'모든 타워 데미지 +5%',
  attack:{
    baseRange:116, baseDamage:7, baseFireRate:0.95,
    rangePerLevel:6, damagePerLevel:2,
    projColor:'#d7ccc8', projEmoji:'⭐', dmgType:'special',
  },
  evolution:{ level:12, options:[
    // v27-60: "사거리 특화"는 DPS에 실질적 의미가 없다는 지적 반영 - 샤미드는 사거리 대신
    // 슬로우/CC 기능을 실제로 강화하는 쪽으로 재설계 (아래 '적응' 스킬에서 분기 처리)
    { id:'vaporeon', name:'샤미드',   color:'#29b6f6', dmgMul:1.10, rangeMul:1.30, fireRateMul:1.00, focus:'물(슬로우 서포터 특화)' },
    { id:'jolteon',  name:'쥬피썬더', color:'#ffd600', dmgMul:1.10, rangeMul:1.05, fireRateMul:1.45, focus:'전기(공속 특화)' },
    { id:'flareon',  name:'부스터',   color:'#ff5722', dmgMul:1.45, rangeMul:1.05, fireRateMul:1.00, focus:'불(데미지 특화)' },
  ]},
  passiveApply(engine, hero) {
    const mul = 1.05 + (hero ? hero._skillVal('passiveRange', 0) : 0);
    for (const t of engine.towers) t.buffDmgMul = Math.max(t.buffDmgMul || 1, mul);
  },
  skills:[
    {
      name:'적응', emoji:'🌀', baseCooldown:28,
      desc:'범위 내 모든 적 슬로우 + 소량 피해 (진화 시 특성 강화)',
      cast(hero, engine) {
        // v27-60: 고정 데미지 → 오토어택 비례로 변경 + 진화별 실제 기능 차등
        // (기존엔 샤미드/쥬피썬더/부스터가 색깔만 다르고 완전히 같은 스킬이었음)
        const r = (140 + hero.level * 8) * (1 + hero._skillVal('skillRange', 0));
        let dmgMul = 1.5, slowDur = 2.5, slowFactor = 0.5;
        if (hero.evolved === 'vaporeon') { dmgMul = 1.2; slowDur = 4.0; slowFactor = 0.65; }      // 물: 슬로우 서포터
        else if (hero.evolved === 'flareon') { dmgMul = 2.0; slowDur = 1.5; slowFactor = 0.30; }   // 불: 데미지 특화
        // 쥬피썬더는 기본값 유지 (공속 특화는 오토어택 fireRateMul로 이미 충분히 반영됨)
        const dmg = hero.attackDamage * dmgMul;
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
            e.takeDamage(dmg, 'special');
            e.applyStatus('slow', slowDur, slowFactor);
          }
        }
        engine.particles.push(new AoeBurst(hero.x, hero.y, r, hero._evoColor || '#a1887f'));
        engine.spawnFloatingText('🌀적응!', hero.x, hero.y-32, '#d7ccc8');
      }
    },
    {
      // v27-60: 기존 "쿨다운 즉시 30% 감소"는 다른 영웅들의 즉발 딜/CC 스킬에 비해 체감이
      // 약하다는 지적(요청) - 이브이의 "다재다능(여러 형태로 진화 가능)" 컨셉에 맞게, 짧은 시간
      // 데미지·공속·사거리를 전부 끌어올리는 올스탯 버스트로 교체 (진화 후에도 그대로 사용 가능)
      name:'다재다능', emoji:'🌈', baseCooldown:32,
      desc:'짧은 시간 데미지+공속+사거리 대폭 상승',
      cast(hero, engine) {
        hero._burstTimer = 4 + hero.level * 0.12; // 레벨이 오를수록 지속시간도 늘어남
        engine.particles.push(new AoeBurst(hero.x, hero.y, 60, hero._evoColor || '#ce93d8'));
        engine.spawnFloatingText('🌈다재다능!', hero.x, hero.y-32, '#ce93d8');
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
    this._bobPhase = Math.random() * Math.PI * 2; // v27-51: 아이들 모션 위상차

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
  get name() { return this.evolved ? (this._evoName || this.def.name) : this.def.name; }

  get attackRange() {
    const a = this.def.attack;
    if (!a) return 0;
    const burst = (this._burstTimer > 0) ? 1.3 : 1;
    return (a.baseRange + (this.level-1)*a.rangePerLevel) * (1 + this._skillVal('atkRange', 0)) * (this._evoRangeMul || 1) * burst;
  }
  get attackDamage() {
    const a = this.def.attack;
    if (!a) return 0;
    const burst = (this._burstTimer > 0) ? 1.4 : 1;
    const base = (a.baseDamage + (this.level-1)*a.damagePerLevel) * (1 + this._skillVal('atkDmg', 0) + (this._multiTargetDmgBonus || 0)) * (this._evoDmgMul || 1) * burst;
    return base * this._typeUpgradeDmgMul();
  }

  // v27-8: 영웅도 해당 속성의 타입강화 영향을 받도록 추가 (기존엔 전혀 반영 안 되고 있었음)
  _typeUpgradeDmgMul() {
    const type = HERO_TYPE_MAP[this.evolved || this.id];
    if (!type || !window.getTypeUpgradeAt || !window.TypeUpgradeLevels) return 1;
    const level = window.TypeUpgradeLevels[type] || 0;
    let mul = 1;
    for (let i = 0; i < level; i++) {
      mul *= (1 + window.getTypeUpgradeAt(type, i).val); // v27-10: 항상 데미지 반영으로 통일
    }
    return mul;
  }
  get attackFireRate() {
    const a = this.def.attack;
    if (!a) return 0;
    const burst = (this._burstTimer > 0) ? 1.4 : 1;
    // v27-60 버그수정: 진화 배율이 공속엔 전혀 안 붙고 있었음 - "쥬피썬더는 공속특화"가
    // 사실상 이름만 붙어있고 실제 공속은 이브이랑 완전히 같았던 문제 (요청: 진화별 실제 기능 차등)
    return a.baseFireRate * (1 + this._skillVal('fireRate', 0)) * (this._evoFireRateMul || 1) * burst;
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
    // v27-60: 데미지/사거리/공속을 각각 다른 배율로 - 진화마다 "숫자만 다른 같은 유닛"이 아니라
    // 진짜 역할이 갈리도록 (요청: "샤미드 같은 애들 너무 약함... 기능적인 면이 더 들어가야")
    const fallback = option.statMul || 1.2;
    this._evoDmgMul = option.dmgMul || fallback;
    this._evoRangeMul = option.rangeMul || fallback;
    this._evoFireRateMul = option.fireRateMul || 1.0;
    this._evoColor = option.color;
    this._evoName = option.name; // v27 fix: 진화 후 이름이 안 바뀌던 버그
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
    // v27-49 버그수정: 여러 영웅의 스킬트리에 'globalDmg'(전체타워 데미지) 노드가 7개나 있는데
    // 전부 아무데도 안 읽혀서 죽어있었음 (요청4 - 영웅 재점검 중 발견). 여기서 일괄 적용.
    const gDmg = this._skillVal('globalDmg', 0);
    if (gDmg > 0) for (const t of engine.towers) t.buffDmgMul = Math.max(t.buffDmgMul || 1, 1 + gDmg);
    // v27-49: 'multiTarget'(멀티스케일 등)도 동일하게 죽어있었음 - 기본공격 데미지 보너스로 대체 적용
    const mTarget = this._skillVal('multiTarget', 0);
    if (mTarget > 0) this._multiTargetDmgBonus = mTarget * 0.08; // 노드값(타겟수)에 비례한 데미지 보너스로 근사

    for (let i = 0; i < this.cooldowns.length; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i] -= dt;
      if (this.castFlash[i] > 0) this.castFlash[i] -= dt;
    }
    if (this._burstTimer > 0) this._burstTimer -= dt; // v27-60: 이브이 '다재다능' 스킬 지속시간

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
      // v27-51: 정지된 느낌이 없게 살짝 위아래로 부드럽게 움직이는 아이들 모션 추가 (요청2)
      const bob = Math.sin(Date.now()*0.0022 + (this._bobPhase||0)) * 2.5;
      const _b = window.SpriteBoundsCache?.[window.HeroSpriteImages?.[spriteKey]];
      ctx.save();
      if (_b) ctx.drawImage(spriteImg, _b.x, _b.y, _b.w, _b.h, this.x - drawSize/2, this.y - drawSize/2 + bob, drawSize, drawSize);
      else ctx.drawImage(spriteImg, this.x - drawSize/2, this.y - drawSize/2 + bob, drawSize, drawSize);
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
  unlockedSkins:{ pikachu:['default'], eevee:['default'], togepi:['default'] }, // v27-50 버그수정: 여기 'mew'가 남아있고 정작 실제 3번째 영웅인 'eevee'가 없어서, 이브이 스킨 해금시 오류가 날 수 있었음
  unlockSkin(heroId, skinId) {
    if (!this.unlockedSkins[heroId].includes(skinId)) this.unlockedSkins[heroId].push(skinId);
  },
  isUnlocked(heroId, skinId) { return this.unlockedSkins[heroId].includes(skinId); },
};

// ===== 영웅 이미지 (기본형 포함 전부 실제 이미지 사용) =====
window.HeroSpriteImages = {
  pikachu:'assets/heroes/pikachu.png', // v27-51: 기본형도 실제 이미지로 업그레이드
  togepi:'assets/heroes/togepi.png',
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
