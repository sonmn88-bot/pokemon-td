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

// ===== 스킬트리 정의 (v28 세션 C · 설계서 §6) =====
// 영웅마다 3갈래 × 4단계. 단계 비용 1/2/3/4 → 갈래당 10SP. 만렙(25)까지 SP 총 25 → 2갈래 반만 찍을 수 있음.
// 같은 갈래의 이전 단계를 찍어야 다음 단계가 열림 (4단계 = 캡스톤, 갈래 완주 보상).
// fx: 효과 키 → 값 (Hero._skillVal로 합산). 설명(desc)과 실제 효과가 반드시 일치해야 함.
// 이브이: 갈래의 evo가 선택한 진화와 같으면 그 갈래 수치 효과 ×1.5.
function _tree(branches, rows) {
  const nodes = [];
  rows.forEach((row, b) => row.forEach((n, t) => nodes.push({
    ...n, branch: b, col: b, row: t, tier: t + 1, cost: t + 1,
    requires: t > 0 ? row[t - 1].id : null, evo: branches[b].evo || null,
  })));
  return { branches, nodes };
}

const SkillTrees = {
  // ⚡ 피카츄 — 전기 몰빵 캐리
  pikachu: _tree(
    [{ name:'번개딜', emoji:'⚡', color:'#ffd600' }, { name:'전기군단', emoji:'🔋', color:'#f59e0b' }, { name:'감전제어', emoji:'🌀', color:'#5b9dff' }],
    [
      [ { id:'pk_crit',  name:'급소', emoji:'💥', desc:'기본공격 25% 확률로 2.2배 크리티컬', fx:{critChance:0.25, critMul:0.2} },
        { id:'pk_chain', name:'연쇄번개', emoji:'⛓️', desc:'기본공격이 주변 적 2명에게 튕김(70%)', fx:{chainAtk:2} },
        { id:'pk_bolt',  name:'낙뢰', emoji:'🌩️', desc:'기본공격 20% 확률로 광역 번개(60%·짧은 스턴)', fx:{lightning:0.20} },
        { id:'pk_cap1',  name:'뇌격', emoji:'⚡', desc:'[캡스톤] 100만볼트가 0.6초 뒤 한 번 더 터짐', fx:{thunderDouble:1} } ],
      [ { id:'pk_spd',   name:'과충전', emoji:'🔌', desc:'전기 타워 공격속도 +12%', fx:{elecSpeed:0.12} },
        { id:'pk_rng',   name:'전자기장', emoji:'📡', desc:'전기 타워 사거리 +12%', fx:{elecRange:0.12} },
        { id:'pk_edmg',  name:'고전압', emoji:'🔆', desc:'전기 타워 공격력 +15%', fx:{elecDmg:0.15} },
        { id:'pk_cap2',  name:'충전', emoji:'🔋', desc:'[캡스톤] 전기 타워 5개마다 모든 타워 공격력 +5%', fx:{chargeAll:0.05} } ],
      [ { id:'pk_stun',  name:'마비', emoji:'😵', desc:'기본공격·100만볼트 스턴 +0.3초', fx:{stunPlus:0.3} },
        { id:'pk_field', name:'감속장', emoji:'🧲', desc:'100만볼트 맞은 적 3초간 40% 감속', fx:{voltSlow:0.4} },
        { id:'pk_cd',    name:'오버로드', emoji:'⏱️', desc:'모든 스킬 쿨다운 -25%', fx:{cdReduce:0.25} },
        { id:'pk_cap3',  name:'정전', emoji:'🌑', desc:'[캡스톤] 100만볼트가 보스도 1.5초 확정 스턴', fx:{bossStun:1.5} } ],
    ]),

  // 🥚 토게피 — 행운 · 경제
  togepi: _tree(
    [{ name:'경제', emoji:'💰', color:'#ffc24b' }, { name:'행운합성', emoji:'🍀', color:'#34d399' }, { name:'응원', emoji:'📣', color:'#f48fb1' }],
    [
      [ { id:'tg_gold',  name:'행운', emoji:'🍀', desc:'모든 골드 획득 +15%', fx:{goldBonus:0.15} },
        { id:'tg_int',   name:'저축', emoji:'🏦', desc:'이자 상한 +10 (최대 45)', fx:{interestCap:10} },
        { id:'tg_wave',  name:'보너스', emoji:'🎁', desc:'웨이브 클리어 보너스 +50%', fx:{waveBonus:0.5} },
        { id:'tg_cap1',  name:'황금알', emoji:'🥚', desc:'[캡스톤] 15웨이브마다 무료 프리미엄 뽑기 1회', fx:{freePull:15} } ],
      [ { id:'tg_pity',  name:'직감', emoji:'🔮', desc:'숨은 천장 강화 (안 나온 계열 가중치 1.5→2.5배)', fx:{pityBoost:1.0} },
        { id:'tg_coin',  name:'동전 수집', emoji:'🪙', desc:'행운의 동전 가격 -50%', fx:{coinDiscount:0.5} },
        { id:'tg_jump',  name:'대박', emoji:'🎰', desc:'노말·레어 랜덤 합성 시 2등급 상승 확률 +3%p', fx:{jump:0.03} },
        { id:'tg_cap2',  name:'기적', emoji:'🌈', desc:'[캡스톤] 뮤 레시피에서 레전드 1개를 에픽 3개로 대체 가능', fx:{miracle:1} } ],
      [ { id:'tg_dur',   name:'긴 응원', emoji:'⏳', desc:'행복의알 지속시간 +4초', fx:{eggDur:4} },
        { id:'tg_pow',   name:'열띤 응원', emoji:'📣', desc:'행복의알 공격력 효과 +10%p', fx:{eggPower:0.10} },
        { id:'tg_metro', name:'더블 메트로놈', emoji:'🎲', desc:'메트로놈이 서로 다른 효과 2개를 동시에 발동', fx:{metroDouble:1} },
        { id:'tg_cap3',  name:'축복', emoji:'✨', desc:'[캡스톤] 행복의알 동안 모든 타워 공격속도 +20%', fx:{eggSpeed:0.20} } ],
    ]),

  // 🦊 이브이 — 진화 분기. 고른 진화와 같은 갈래는 효과 ×1.5
  eevee: _tree(
    [{ name:'불꽃', emoji:'🔥', color:'#ff5722', evo:'flareon' }, { name:'전기', emoji:'⚡', color:'#ffd600', evo:'jolteon' }, { name:'물', emoji:'💧', color:'#29b6f6', evo:'vaporeon' }],
    [
      [ { id:'ev_f1',  name:'열정', emoji:'🔥', desc:'기본공격 데미지 +15%', fx:{atkDmg:0.15} },
        { id:'ev_f2',  name:'불꽃 송곳니', emoji:'💥', desc:'기본공격 20% 확률로 2배 크리티컬', fx:{critChance:0.20} },
        { id:'ev_f3',  name:'열풍', emoji:'🌪️', desc:'적응 스킬 데미지 +60%', fx:{adaptDmg:0.6} },
        { id:'ev_fc',  name:'부스터 각성', emoji:'☄️', desc:'[캡스톤] 다재다능 중 기본공격이 광역(60px·60%)', fx:{burstSplash:1} } ],
      [ { id:'ev_j1',  name:'기민함', emoji:'💨', desc:'기본공격 속도 +18%', fx:{fireRate:0.18} },
        { id:'ev_j2',  name:'방전', emoji:'⛓️', desc:'기본공격이 주변 적 2명에게 튕김(70%)', fx:{chainAtk:2} },
        { id:'ev_j3',  name:'지구력', emoji:'⏳', desc:'다재다능 지속시간 +3초', fx:{burstDur:3} },
        { id:'ev_jc',  name:'쥬피썬더 각성', emoji:'⚡', desc:'[캡스톤] 다재다능 쿨다운 -40%', fx:{burstCd:0.4} } ],
      [ { id:'ev_v1',  name:'물대포', emoji:'💧', desc:'기본공격이 적을 1.5초간 30% 감속', fx:{atkSlow:0.3} },
        { id:'ev_v2',  name:'파도', emoji:'🌊', desc:'적응 스킬 범위 +40%', fx:{skillRange:0.4} },
        { id:'ev_v3',  name:'치유의 물', emoji:'💠', desc:'모든 타워 공격력 +8%', fx:{globalDmg:0.08} },
        { id:'ev_vc',  name:'샤미드 각성', emoji:'🫧', desc:'[캡스톤] 적응에 맞은 적은 5초간 받는 피해 +20%', fx:{vulnerable:0.2} } ],
    ]),
};

// ===== 영웅 기본 정의 =====
const HeroDefs = {
  pikachu: {
    id:'pikachu', name:'피카츄', baseColor:'#ffd600',
    role:'전기 딜러',
    passive:'전기 타워 1개당 전기 타워 공격력 +2% (최대 30%) · 라이츄: +3% (최대 45%)',
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
    // v28: 패시브는 Hero._applyAura()에서 타워 전용 배율(_heroDmgMul 등)로 매 프레임 계산 (덮어쓰기 버그 방지)
    passiveApply(engine, hero) {},
    skills:[
      {
        name:'100만볼트', emoji:'⚡', baseCooldown:28,
        desc:'범위 내 모든 적에게 전기 데미지 + 감전',
        cast(hero, engine, recast) {
          // v27-60: 레벨만 반영하던 고정 데미지 → 오토어택 데미지(타입강화/진화 다 반영됨) 비례로 변경
          const r = (140 + hero.level * 10) * (1 + hero._skillVal('skillRange', 0));
          const dmg = hero.attackDamage * 1.8;
          const stun = 0.9 + hero._skillVal('stunPlus', 0);
          const slow = hero._skillVal('voltSlow', 0), bossStun = hero._skillVal('bossStun', 0);
          for (const e of engine.enemies) {
            if (e.dead||e.reachedEnd) continue;
            if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
              e.takeDamage(dmg, 'special');
              e.applyStatus('stun', stun, 0);
              if (slow) e.applyStatus('slow', 3, 1 - slow);
              if (bossStun && e.isBoss) e.stunned = Math.max(e.stunned || 0, bossStun); // 정전: 면역 무시
            }
          }
          if (!recast && hero._skillVal('thunderDouble', 0)) hero._recastTimer = 0.6; // 뇌격
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
    passive:'골드 획득 +10% · 이자 상한 +5 · 토게틱: 노말·레어 합성 10% 확률 2등급 상승',
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
      // v28 (설계서 §6): 직접 화력은 최하, 대신 경제·합성 운 담당
      engine._togepiGoldMul = 1.10 + hero._skillVal('goldBonus', 0);
      engine._interestCapBonus = 5 + hero._skillVal('interestCap', 0);
      engine._waveBonusMul = 1 + hero._skillVal('waveBonus', 0);
      engine._mergeJumpChance = (hero.evolved === 'togetic' ? 0.10 : 0) + hero._skillVal('jump', 0);
      engine._pityWeight = 1.5 + hero._skillVal('pityBoost', 0);
      engine._coinDiscount = hero._skillVal('coinDiscount', 0);
      engine._miracle = hero._skillVal('miracle', 0) > 0;
      engine._freePullEvery = hero._skillVal('freePull', 0);
    },
    skills:[
      {
        name:'메트로놈', emoji:'🎲', baseCooldown:33,
        desc:'랜덤 대형 효과 발동',
        cast(hero, engine) {
          // v28: 더블 메트로놈 노드면 서로 다른 효과 2개 동시 발동
          const rolls = [0,1,2,3].sort(() => Math.random() - 0.5).slice(0, hero._skillVal('metroDouble', 0) ? 2 : 1);
          for (const roll of rolls) {
          if (roll === 0) {
            const dmg = hero.attackDamage * 1.6; // v27-60: 고정값 → 오토어택 비례로 통일
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.takeDamage(dmg,'special'); }
            engine.spawnFloatingText('🎲전체 피해!', hero.x, hero.y-32, '#ffd54f');
          } else if (roll === 1) {
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.applyStatus('slow',3.5,0.38); }
            engine.spawnFloatingText('🎲전체 슬로우!', hero.x, hero.y-32, '#5b9dff');
          } else if (roll === 2) {
            for (const e of engine.enemies) { if (!e.dead&&!e.reachedEnd) e.applyStatus('stun',1.5,0); }
            engine.spawnFloatingText('🎲전체 스턴!', hero.x, hero.y-32, '#ba68c8');
          } else {
            engine.addGold(50 + hero.level * 10);
            engine.spawnFloatingText(`🎲골드 획득! +${50+hero.level*10}g`, hero.x, hero.y-32, '#ffc24b');
          }
          }
        }
      },
      {
        name:'행복의알', emoji:'🥚', baseCooldown:36,
        desc:'모든 타워 공격력 +25~40% (레벨 비례, 8초)',
        cast(hero, engine) {
          // v27-29 버그수정: buffDmgMul(영구필드)에 직접 곱하고 타이머 해제 로직이 아예 없어서,
          // 쿨다운 24초마다 재사용할 때마다 데미지가 영구적으로 복리 누적되고 있었음(요청 - 지속피해
          // 원인 재검토 결과 발견. 셋 중 쿨다운이 제일 짧아 가장 심각했을 가능성). 임시배율 필드로 교체.
          // v27-60: 고정 +25%는 레벨을 올려도 안 세지는 유일한 스킬이었음 - 레벨 비례로 변경(Lv1=+25%, Lv25=+40%)
          const mul = 1 + 0.25 + hero.level * 0.006 + hero._skillVal('eggPower', 0);
          const dur = 8 + hero._skillVal('eggDur', 0), spd = hero._skillVal('eggSpeed', 0);
          for (const t of engine.towers) {
            t._tempDmgMul = mul;
            if (spd) t._tempSpeedMul = 1 + spd; // 축복
            t._pokecenterTimer = dur; // 타워 update()의 만료처리 로직 재사용
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
  passive:'모든 타워 공격력 +5% · Lv12에 3갈래 진화 (같은 갈래 스킬트리 효과 ×1.5)',
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
  passiveApply(engine, hero) {}, // v28: Hero._applyAura()에서 처리
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
        const dmg = hero.attackDamage * dmgMul * (1 + hero._skillVal('adaptDmg', 0));
        const vuln = hero._skillVal('vulnerable', 0);
        for (const e of engine.enemies) {
          if (e.dead||e.reachedEnd) continue;
          if (Math.hypot(e.x-hero.x,e.y-hero.y) <= r) {
            e.takeDamage(dmg, 'special');
            e.applyStatus('slow', slowDur, slowFactor);
            if (vuln) { e._vulnTimer = 5; e._vulnMul = 1 + vuln; } // 샤미드 각성
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
        hero._burstTimer = 4 + hero.level * 0.12 + hero._skillVal('burstDur', 0); // 레벨이 오를수록 지속시간도 늘어남
        engine.particles.push(new AoeBurst(hero.x, hero.y, 60, hero._evoColor || '#b18cff'));
        engine.spawnFloatingText('🌈다재다능!', hero.x, hero.y-32, '#b18cff');
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
    this.skinId = 'default'; // v3.2: 스킨 시스템 제거 (색만 바꾸는 수준이라 의미가 없었음)
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
    // v3.2: 적 체력이 웨이브마다 지수로 오르니 영웅도 같은 곡선으로 성장 (예전엔 레벨 비례 직선이라 후반에 무의미)
    const w = window.app?.engine?.currentWave || 0;
    const waveScale = Math.pow(1.04, Math.max(0, w - 5));
    return base * this._typeUpgradeDmgMul() * waveScale;
  }

  // v27-8: 영웅도 해당 속성의 타입강화 영향을 받도록 추가 (기존엔 전혀 반영 안 되고 있었음)
  _typeUpgradeDmgMul() {
    const type = HERO_TYPE_MAP[this.evolved || this.id];
    if (!type || !window.getTypeUpgradeAt || !window.TypeUpgradeLevels) return 1;
    const level = window.TypeUpgradeLevels[type] || 0;
    let mul = 1;
    for (let i = 0; i < level; i++) {
      { const u = window.getTypeUpgradeAt(type, i); mul *= (1 + (u.heroVal ?? u.val)); } // v28: 영웅은 heroVal(단계당 15%, 무한 6%)
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
  // v28: 노드 fx 합산. 이브이는 고른 진화와 같은 갈래 노드의 수치 효과 ×1.5 (플래그형 효과는 그대로)
  // (예전엔 크리티컬 노드 값이 객체라 합산에서 통째로 무시돼 크리티컬이 아예 안 터지던 버그가 있었음)
  _skillVal(type, defaultVal = 0) {
    const tree = SkillTrees[this.id];
    if (!tree) return defaultVal;
    let total = defaultVal;
    for (const nodeId of this.unlockedSkills) {
      const node = tree.nodes.find(n => n.id === nodeId);
      const v = node?.fx?.[type];
      if (typeof v !== 'number') continue;
      const boosted = node.evo && node.evo === this.evolved && !['thunderDouble','burstSplash','metroDouble','miracle','freePull'].includes(type);
      total += boosted ? v * 1.5 : v;
    }
    return total;
  }

  _skillCd(idx) {
    const base = this.def.skills[idx].baseCooldown;
    let reduce = this._skillVal('cdReduce', 0);
    if (this.id === 'eevee' && idx === 1) reduce += this._skillVal('burstCd', 0); // 쥬피썬더 각성
    return base * Math.max(0.3, 1 - reduce);
  }

  // v28: 영웅이 타워에 주는 효과를 '전용 배율'로 매 프레임 새로 계산 → 덮어쓰기/누적 버그 원천 차단
  // (예전엔 패시브가 tower.buffDmgMul을 max()로 덮어써서 타입강화 효과가 지워지거나 영구 누적됐음)
  _applyAura(engine) {
    const elecCount = engine.towers.filter(t => t.def?.type === 'electric').length;
    const isPika = this.id === 'pikachu';
    const per = this.evolved ? 0.03 : 0.02, cap = this.evolved ? 0.45 : 0.30;
    const allDmg = (this.id === 'eevee' ? 0.05 : 0) + this._skillVal('globalDmg', 0)
                 + Math.floor(elecCount / 5) * this._skillVal('chargeAll', 0);
    const eDmg = (isPika ? Math.min(cap, elecCount * per) : 0) + this._skillVal('elecDmg', 0);
    const eSpd = this._skillVal('elecSpeed', 0), eRng = this._skillVal('elecRange', 0);
    for (const t of engine.towers) {
      const elec = t.def?.type === 'electric';
      t._heroDmgMul = 1 + allDmg + (elec ? eDmg : 0);
      t._heroSpeedMul = 1 + (elec ? eSpd : 0);
      t._heroRangeMul = 1 + (elec ? eRng : 0);
    }
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
    engine && engine.spawnFloatingText(`✨ ${node.name}!`, this.x, this.y-40, '#a78bfa');
    return true;
  }

  gainExp(amount, engine) {
    this.exp += amount;
    while (this.exp >= this.expToNext && this.level < 25) {
      this.exp -= this.expToNext;
      this.level++;
      this.skillPoints++;
      this.expToNext = Math.floor(this.expToNext * 1.30);
      engine && engine.spawnFloatingText(`${this.def.name} Lv${this.level}! +SP`, this.x, this.y-42, '#ffc24b');
      engine && engine.particles && engine.particles.push(new AoeBurst(this.x, this.y, 50, '#ffc24b'));

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
    const critChance = this._skillVal('critChance', 0);
    if (critChance > 0 && Math.random() < critChance) {
      dmg *= 2 + this._skillVal('critMul', 0);
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
    const chainAtk = Math.round(this._skillVal('chainAtk', 0));
    let status = a.status ? {...a.status} : null;
    if (status && status.type === 'stun') status.duration += this._skillVal('stunPlus', 0); // 마비
    const atkSlow = this._skillVal('atkSlow', 0);
    if (atkSlow > 0) status = { type:'slow', duration:1.5, factor: 1 - Math.min(0.5, atkSlow) }; // 물대포
    const splash = (this._burstTimer > 0 && this._skillVal('burstSplash', 0)) ? 60 : 0; // 부스터 각성
    const proj = new Projectile(this.x, this.y, this.attackTarget, {
      engine, speed:440, damage:dmg, color:a.projColor, size:6,
      dmgType:a.dmgType||'special', emoji:a.projEmoji,
      status, chain: chainAtk || 0, chainRange: 140, splash,
    });
    engine.projectiles.push(proj);
    if (isCrit) engine.spawnFloatingText(`💥크리!`, this.attackTarget.x, this.attackTarget.y-20, '#ff5c7a');
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
    this._applyAura(engine);
    if (this._recastTimer > 0) { // 뇌격: 100만볼트 재발동
      this._recastTimer -= dt;
      if (this._recastTimer <= 0) this.def.skills[0].cast(this, engine, true);
    }

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
      ctx.font = 'bold 10px Pretendard,-apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = this.skillPoints > 0 ? '#ffc24b' : '#fff';
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
      ctx.font = 'bold 10px Pretendard,-apple-system,sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = this.skillPoints > 0 ? '#ffc24b' : '#fff';
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
      ctx.font = 'bold 10px Pretendard,-apple-system,sans-serif';
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
