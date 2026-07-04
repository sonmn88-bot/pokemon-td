// ===== SHOP.JS - 상점 아이템 + 글로벌 스펠 (v27: 상시노출, 상한 대신 누적가격) =====

// v27: 영구 강화류는 상한(maxBuys) 대신 살수록 가격이 올라가는 방식으로 변경
function shopItemCost(item, engine) {
  if (!item.scaling) return item.cost;
  const n = (engine._shopBuyCount && engine._shopBuyCount[item.key]) || 0;
  return Math.round(item.cost * Math.pow(1.4, n));
}

const ShopItems = [
  {
    key: 'monsterball', name: '몬스터볼', emoji: '⚪', cost: 80,
    desc: '가장 앞선 적 1체 즉시 제거 (보스 제외)',
    buy(engine) {
      const target = engine.enemies
        .filter(e => !e.dead && !e.reachedEnd && !e.isBoss)
        .sort((a,b) => b.distTraveled - a.distTraveled)[0];
      if (target) {
        target.die ? target.die() : (target.dead = true);
        engine.addGold(target.reward);
        engine.spawnFloatingText('⚪ 포획!', target.x, target.y - 20, '#fff');
      } else {
        engine.spawnFloatingText('대상 없음', engine.width/2, engine.height/2, '#aaa');
      }
    }
  },
  {
    key: 'blizzard', name: '블리자드', emoji: '❄️', cost: 110,
    desc: '필드의 모든 적 3초간 50% 슬로우 (엔드리스 필드누적 대응용)',
    buy(engine) {
      let n = 0;
      for (const e of engine.enemies) {
        if (e.dead || e.reachedEnd) continue;
        if (e.applyStatus) e.applyStatus('slow', 3, 0.5);
        else { e.slowed = 3; e.slowFactor = 0.5; }
        n++;
      }
      if (window.AoeBurst) engine.particles.push(new AoeBurst(engine.width/2, engine.height/2, Math.max(engine.width, engine.height), '#80deea'));
      engine.spawnFloatingText(`❄️ 블리자드! 적 ${n}마리 슬로우`, engine.width/2, 80, '#80deea');
    }
  },
  {
    key: 'revive', name: '확장 부지', emoji: '🏗️', cost: 180, scaling: true,
    desc: '트랙 안쪽에 빈 배치슬롯 1개 즉시 추가 (살수록 비싸짐)',
    buy(engine) {
      const w = engine.width, h = engine.height;
      const HUD=52, BAR=82, PAD=20;
      const top = HUD+PAD, bot = h-BAR-PAD;
      let best = null, bestMinDist = -1;
      for (let tries=0; tries<40; tries++) {
        const x = w*0.18 + Math.random()*w*0.64;
        const y = top + Math.random()*(bot-top);
        let minDist = Infinity;
        for (const s of engine.towerSlots) minDist = Math.min(minDist, Math.hypot(s.x-x, s.y-y));
        if (minDist > bestMinDist) { bestMinDist = minDist; best = {x,y}; }
      }
      if (best && bestMinDist > 46) {
        engine.towerSlots.push({ x: best.x, y: best.y, occupied: false, tower: null });
        engine.spawnFloatingText('🏗️ 새 슬롯 확보!', best.x, best.y, '#06d6a0');
      } else {
        engine.spawnFloatingText('공간이 부족합니다', engine.width/2, 80, '#ff6b6b');
        return false; // v27-8 버그수정: 실패해도 return false가 없어서 골드가 환불 안 되고 그냥 나갔던 문제
      }
    }
  },
  {
    key: 'rarecandy', name: '이상한사탕', emoji: '🍬', cost: 350, oneTime: true,
    desc: '3성(에픽) 타워 1개를 레전드로 진화 (게임당 1회만 사용 가능)',
    buy(engine) {
      // v27 fix: 아무 등급이나 무한정 되던 걸 3성(epic) 한정 + 1회용으로 변경 (안 그러면 도배해서 다 5성 만들어버림)
      const gachaSlots = engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId && s.tower.def?.grade === 'epic');
      if (!gachaSlots.length) {
        engine.spawnFloatingText('3성(에픽) 타워가 없습니다', engine.width/2, 80, '#aaa');
        return false; // 구매 취소 (골드 안 깎임, 1회 소모 안 함)
      }
      const slot = gachaSlots[Math.floor(Math.random() * gachaSlots.length)];
      const t = slot.tower;
      const evoId = window.MERGE_EVOLUTION?.[t._gachaId];
      const evoDef = evoId ? window.GachaTowerDefs?.[evoId] : null;
      if (evoDef) {
        const evoTower = window._createGachaTower(evoDef, slot.x, slot.y, engine);
        evoTower._evolveGlowTimer = 1.2;
        engine.towers = engine.towers.filter(x => x !== t);
        engine.towers.push(evoTower);
        slot.tower = evoTower;
        if (window.applyTowerSynergies) window.applyTowerSynergies(engine.towers);
        const grade = window.GRADES?.[evoDef.grade];
        engine.spawnFloatingText(`🍬 ${evoDef.name} 진화!`, slot.x, slot.y-36, grade?.color||'#ffd60a');
      } else {
        engine.spawnFloatingText('이미 최고 등급!', slot.x, slot.y-20, '#ffd60a');
        return false;
      }
    }
  },
];

// ===== 글로벌 스펠 =====
const GlobalSpells = {
  pokecenter: {
    name: '포켓몬센터', emoji: '🏥', cooldown: 90,
    desc: '모든 타워 8초간 데미지 +30%',
    cast(engine) {
      // v27: 라이프 회복 제거 (필드누적 게임오버로 바뀌어 라이프가 의미없어짐)
      for (const t of engine.towers) {
        t.buffDmgMul = (t.buffDmgMul || 1) * 1.3;
        t._pokecenterTimer = 8;
      }
      engine.spawnFloatingText('🏥 포켓몬센터! 전체 데미지+30%', engine.width/2, 80, '#06d6a0');
    }
  },
  masterball: {
    name: '마스터볼', emoji: '🟣', cooldown: 60,
    desc: '전체 적 즉시 큰 피해 + 3초 슬로우',
    cast(engine) {
      for (const e of engine.enemies) {
        if (e.dead || e.reachedEnd) continue;
        e.takeDamage(80, 'special');
        e.applyStatus('slow', 3, 0.4);
      }
      if (window.AoeBurst)
        engine.particles.push(new AoeBurst(engine.width/2, engine.height/2,
          Math.max(engine.width, engine.height), '#7c4dff'));
      engine.spawnFloatingText('🟣 마스터볼! 전체 피해+슬로우', engine.width/2, 80, '#7c4dff');
    }
  },
};

// 타워 생성/업그레이드 시 상점 버프 재적용
function applyShopBuffs(tower, engine) {
  if (engine._shopDmgMul)   tower.buffDmgMul   = (tower.buffDmgMul||1)   * engine._shopDmgMul;
  if (engine._shopRangeMul) tower.buffRangeMul = (tower.buffRangeMul||1) * engine._shopRangeMul;
  if (engine._shopSpeedMul) tower._shopSpeedMul = (tower._shopSpeedMul||1) * engine._shopSpeedMul;
}

class SpellManager {
  constructor() {
    this.cooldowns = {};
    for (const k in GlobalSpells) this.cooldowns[k] = 0;
  }
  update(dt) {
    for (const k in this.cooldowns)
      if (this.cooldowns[k] > 0) this.cooldowns[k] -= dt;
  }
  cast(key, engine) {
    const spell = GlobalSpells[key];
    if (!spell || this.cooldowns[key] > 0 || !engine) return false;
    spell.cast(engine);
    this.cooldowns[key] = spell.cooldown;
    return true;
  }
}

window.ShopItems = ShopItems;
window.GlobalSpells = GlobalSpells;
window.SpellManager = SpellManager;
window.applyShopBuffs = applyShopBuffs;
window.shopItemCost = shopItemCost;
