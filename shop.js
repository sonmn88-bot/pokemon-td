// ===== SHOP.JS - 상점 아이템 + 글로벌 스펠 =====

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
    key: 'potion', name: '골드 두루마리', emoji: '📜', cost: 90,
    desc: '다음 웨이브 클리어 보상 골드 2배',
    buy(engine) {
      engine._nextWaveGoldMul = 2;
      engine.spawnFloatingText('📜 다음 웨이브 보상 2배!', engine.width/2, 80, '#ffd60a');
    }
  },
  {
    key: 'superpotion', name: '고급상처약', emoji: '💊', cost: 140, maxBuys: 3,
    desc: '모든 타워 데미지 영구 +12% (최대 3회, 상한 있음)',
    buy(engine) {
      for (const t of engine.towers) t.buffDmgMul = (t.buffDmgMul || 1) * 1.12;
      engine._shopDmgMul = (engine._shopDmgMul || 1) * 1.12;
      engine.spawnFloatingText('💊 전체 데미지 +12%!', engine.width/2, 80, '#ce93d8');
    }
  },
  {
    key: 'revive', name: '확장 부지', emoji: '🏗️', cost: 180, maxBuys: 2,
    desc: '트랙 안쪽에 빈 배치슬롯 1개 즉시 추가 (최대 2회)',
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
      if (best && bestMinDist > 55) {
        engine.towerSlots.push({ x: best.x, y: best.y, occupied: false, tower: null });
        engine.spawnFloatingText('🏗️ 새 슬롯 확보!', best.x, best.y, '#06d6a0');
      } else {
        engine.spawnFloatingText('공간이 부족합니다', engine.width/2, 80, '#ff6b6b');
      }
    }
  },
  {
    key: 'rangeorb', name: '사거리 구슬', emoji: '🔵', cost: 120, maxBuys: 2,
    desc: '모든 타워 사거리 영구 +8% (최대 2회, 상한 있음 - 전범위 방지)',
    buy(engine) {
      for (const t of engine.towers) t.buffRangeMul = (t.buffRangeMul || 1) * 1.08;
      engine._shopRangeMul = (engine._shopRangeMul || 1) * 1.08;
      engine.spawnFloatingText('🔵 전체 사거리 +8%!', engine.width/2, 80, '#4fc3f7');
    }
  },
  {
    key: 'speedorb', name: '속도 구슬', emoji: '🟢', cost: 130, maxBuys: 3,
    desc: '모든 타워 공격속도 영구 +10% (최대 3회, 상한 있음)',
    buy(engine) {
      for (const t of engine.towers) {
        t._shopSpeedMul = (t._shopSpeedMul || 1) * 1.10;
      }
      engine._shopSpeedMul = (engine._shopSpeedMul || 1) * 1.10;
      engine.spawnFloatingText('🟢 공격속도 +10%!', engine.width/2, 80, '#06d6a0');
    }
  },
  {
    key: 'oranberry', name: '오카열매', emoji: '🍊', cost: 160,
    desc: '라이프 +3 즉시 회복',
    buy(engine) {
      engine.lives = Math.min(engine.lives + 3, 99);
      engine.onLivesChange && engine.onLivesChange(engine.lives);
      engine.spawnFloatingText('🍊 라이프 +3!', engine.width/2, 80, '#ff6b6b');
    }
  },
  {
    key: 'rarecandy', name: '이상한사탕', emoji: '🍬', cost: 350, maxBuys: 1,
    desc: '랜덤 타워 1개를 한 등급 상위로 진화',
    buy(engine) {
      const gachaSlots = engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId);
      if (!gachaSlots.length) {
        engine.spawnFloatingText('진화할 타워 없음', engine.width/2, 80, '#aaa');
        return;
      }
      const slot = gachaSlots[Math.floor(Math.random() * gachaSlots.length)];
      const t = slot.tower;
      const evoId = window.MERGE_EVOLUTION?.[t._gachaId];
      const evoDef = evoId ? window.GachaTowerDefs?.[evoId] : null;
      if (evoDef) {
        const evoTower = window._createGachaTower(evoDef, slot.x, slot.y);
        engine.towers = engine.towers.filter(x => x !== t);
        engine.towers.push(evoTower);
        slot.tower = evoTower;
        if (window.applyTowerSynergies) window.applyTowerSynergies(engine.towers);
        const grade = window.GRADES?.[evoDef.grade];
        engine.spawnFloatingText(`🍬 ${evoDef.name} 진화!`, slot.x, slot.y-36, grade?.color||'#ffd60a');
      } else {
        engine.spawnFloatingText('이미 최고 등급!', slot.x, slot.y-20, '#ffd60a');
      }
    }
  },
];

// ===== 글로벌 스펠 =====
const GlobalSpells = {
  pokecenter: {
    name: '포켓몬센터', emoji: '🏥', cooldown: 90,
    desc: '라이프 +5 회복 + 모든 타워 8초간 데미지 +30%',
    cast(engine) {
      engine.lives = Math.min(engine.lives + 5, 99);
      engine.onLivesChange && engine.onLivesChange(engine.lives);
      for (const t of engine.towers) {
        t.buffDmgMul = (t.buffDmgMul || 1) * 1.3;
        t._pokecenterTimer = 8;
      }
      engine.spawnFloatingText('🏥 포켓몬센터! 라이프+5 / 데미지+30%', engine.width/2, 80, '#06d6a0');
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

// 타워 업그레이드 시 상점 버프 재적용
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
