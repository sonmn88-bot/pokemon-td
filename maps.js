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
    key: 'potion', name: '상처약', emoji: '🧪', cost: 60,
    desc: '영웅 스킬 쿨다운 즉시 50% 감소',
    buy(engine) {
      for (const h of engine.heroes)
        h.cooldowns = h.cooldowns.map(c => c * 0.5);
      engine.spawnFloatingText('🧪 쿨다운 50%↓', engine.width/2, 80, '#06d6a0');
    }
  },
  {
    key: 'superpotion', name: '고급상처약', emoji: '💊', cost: 140,
    desc: '모든 타워 데미지 영구 +20%',
    buy(engine) {
      for (const t of engine.towers) t.buffDmgMul = (t.buffDmgMul || 1) * 1.20;
      engine._shopDmgMul = (engine._shopDmgMul || 1) * 1.20;
      engine.spawnFloatingText('💊 전체 데미지 +20%!', engine.width/2, 80, '#ce93d8');
    }
  },
  {
    key: 'revive', name: '기력의조각', emoji: '💎', cost: 100,
    desc: '영웅 스킬 쿨다운 전체 초기화',
    buy(engine) {
      for (const h of engine.heroes)
        h.cooldowns = h.cooldowns.map(() => 0);
      engine.spawnFloatingText('💎 스킬 초기화!', engine.width/2, 80, '#4fc3f7');
    }
  },
  {
    key: 'rangeorb', name: '사거리 구슬', emoji: '🔵', cost: 120,
    desc: '모든 타워 사거리 영구 +20%',
    buy(engine) {
      for (const t of engine.towers) t.buffRangeMul = (t.buffRangeMul || 1) * 1.20;
      engine._shopRangeMul = (engine._shopRangeMul || 1) * 1.20;
      engine.spawnFloatingText('🔵 전체 사거리 +20%!', engine.width/2, 80, '#4fc3f7');
    }
  },
  {
    key: 'speedorb', name: '속도 구슬', emoji: '🟢', cost: 130,
    desc: '모든 타워 공격속도 영구 +15%',
    buy(engine) {
      for (const t of engine.towers) {
        t._shopSpeedMul = (t._shopSpeedMul || 1) * 1.15;
      }
      engine._shopSpeedMul = (engine._shopSpeedMul || 1) * 1.15;
      engine.spawnFloatingText('🟢 공격속도 +15%!', engine.width/2, 80, '#06d6a0');
    }
  },
  {
    key: 'oranberry', name: '오카열매', emoji: '🍊', cost: 90,
    desc: '라이프 +3 즉시 회복',
    buy(engine) {
      engine.lives = Math.min(engine.lives + 3, 99);
      engine.onLivesChange && engine.onLivesChange(engine.lives);
      engine.spawnFloatingText('🍊 라이프 +3!', engine.width/2, 80, '#ff6b6b');
    }
  },
  {
    key: 'rarecandy', name: '이상한사탕', emoji: '🍬', cost: 200,
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
