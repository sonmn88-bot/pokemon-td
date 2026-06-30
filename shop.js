// ===== SHOP.JS - 상점(5웨이브마다) + 글로벌 스펠 2종 =====

// ===== 상점 아이템 정의 =====
const ShopItems = [
  {
    key: 'monsterball', name: '몬스터볼', emoji: '⚪', cost: 80,
    desc: '약한 적 1체를 포획해 즉시 제거 (보스 제외)',
    use(engine) {
      let target = null, minHp = Infinity;
      for (const e of engine.enemies) {
        if (e.dead || e.reachedEnd || e.isBoss) continue;
        if (e.hp < minHp) { minHp = e.hp; target = e; }
      }
      if (!target) return false;
      engine.spawnFloatingText('⚪ 포획!', target.x, target.y, '#fff');
      target.hp = 0;
      target.die();
      return true;
    }
  },
  {
    key: 'potion', name: '상처약', emoji: '🧪', cost: 60,
    desc: '영웅 스킬 쿨다운 즉시 50% 감소',
    use(engine) {
      if (!engine.heroes || engine.heroes.length === 0) return false;
      for (const h of engine.heroes) {
        h.cooldowns = h.cooldowns.map(c => c * 0.5);
      }
      return true;
    }
  },
  {
    key: 'superpotion', name: '고급상처약', emoji: '💊', cost: 140,
    desc: '모든 타워 데미지 +20% (영구, 이번 게임)',
    use(engine) {
      engine._globalTowerDmgMul = (engine._globalTowerDmgMul || 1) * 1.2;
      for (const t of engine.towers) t.buffDmgMul = (t.buffDmgMul || 1) * 1.2;
      return true;
    }
  },
  {
    key: 'revive', name: '기력의조각', emoji: '💎', cost: 100,
    desc: '영웅 스킬 쿨다운 즉시 전체 초기화',
    use(engine) {
      if (!engine.heroes || engine.heroes.length === 0) return false;
      for (const h of engine.heroes) h.cooldowns = h.cooldowns.map(() => 0);
      return true;
    }
  },
  {
    key: 'electricorb', name: '전기구슬', emoji: '🟡', cost: 120,
    desc: '전기 타워 사거리 +30% (영구)',
    use(engine) {
      engine._electricOrbBonus = (engine._electricOrbBonus || 1) * 1.3;
      return true;
    }
  },
  {
    key: 'fireorb', name: '불꽃구슬', emoji: '🔥', cost: 120,
    desc: '불꽃 타워 데미지 +25% (영구)',
    use(engine) {
      engine._fireOrbBonus = (engine._fireOrbBonus || 1) * 1.25;
      return true;
    }
  },
  {
    key: 'oranberry', name: '오카열매', emoji: '🍊', cost: 90,
    desc: '라이프 +3',
    use(engine) {
      engine.lives += 3;
      engine.onLivesChange && engine.onLivesChange(engine.lives);
      return true;
    }
  },
  {
    key: 'focusband', name: '기합의띠', emoji: '🎗️', cost: 150,
    desc: '다음 5웨이브 동안 타워 전체 무적(파괴 불가 - 이 게임엔 타워 파괴 없음, 대신 쿨감소 +20%)',
    use(engine) {
      for (const t of engine.towers) t._focusBand = 5;
      engine._focusBandWaves = 5;
      return true;
    }
  },
];

// ===== 영구 보너스 적용 헬퍼 (타워 생성/업그레이드 시 호출) =====
function applyOrbBonuses(tower, engine) {
  if (tower.def.id === 'voltorb' && engine._electricOrbBonus) {
    tower.buffRangeMul = (tower.buffRangeMul || 1) * engine._electricOrbBonus;
  }
  if (tower.def.id === 'charmander' && engine._fireOrbBonus) {
    tower.buffDmgMul = (tower.buffDmgMul || 1) * engine._fireOrbBonus;
  }
}

// ===== 글로벌 스펠 2종 =====
const GlobalSpells = {
  pokecenter: {
    name: '포켓몬센터', emoji: '🏥', cooldown: 90,
    desc: '라이프 +5, 모든 타워 8초간 데미지 +30%',
    cast(engine) {
      engine.lives = Math.min(engine.lives + 5, 99);
      engine.onLivesChange && engine.onLivesChange(engine.lives);
      for (const t of engine.towers) {
        t.buffDmgMul = (t.buffDmgMul || 1) * 1.3;
        t._pokecenterTimer = 8;
      }
      engine.spawnFloatingText('🏥 포켓몬센터 발동!', engine.width / 2, 80, '#06d6a0');
    }
  },
  masterball: {
    name: '마스터볼', emoji: '🟣', cooldown: 60,
    desc: '전체 적에게 큰 피해 + 슬로우',
    cast(engine) {
      for (const e of engine.enemies) {
        if (e.dead || e.reachedEnd) continue;
        e.takeDamage(80, 'special');
        e.applyStatus('slow', 3, 0.4);
      }
      engine.particles.push(new AoeBurst(engine.width / 2, engine.height / 2, Math.max(engine.width, engine.height), '#7c4dff'));
      engine.spawnFloatingText('🟣 마스터볼 발동!', engine.width / 2, 80, '#7c4dff');
    }
  },
};

// ===== 스펠 쿨다운 상태 매니저 =====
class SpellManager {
  constructor() {
    this.cooldowns = { pokecenter: 0, masterball: 0 };
  }
  update(dt) {
    for (const k in this.cooldowns) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] -= dt;
    }
  }
  canCast(key) {
    return this.cooldowns[key] <= 0;
  }
  cast(key, engine) {
    if (!this.canCast(key)) return false;
    GlobalSpells[key].cast(engine);
    this.cooldowns[key] = GlobalSpells[key].cooldown;
    return true;
  }
}

window.ShopItems = ShopItems;
window.GlobalSpells = GlobalSpells;
window.SpellManager = SpellManager;
window.applyOrbBonuses = applyOrbBonuses;
