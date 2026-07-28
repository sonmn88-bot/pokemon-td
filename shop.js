// ===== SHOP.JS - 상점 아이템 + 글로벌 스펠 (v27: 상시노출, 상한 대신 누적가격) =====

// v27: 영구 강화류는 상한(maxBuys) 대신 살수록 가격이 올라가는 방식으로 변경
function shopItemCost(item, engine) {
  if (!item.scaling) return item.cost;
  const n = (engine._shopBuyCount && engine._shopBuyCount[item.key]) || 0;
  return Math.round(item.cost * Math.pow(1.28, n)); // v27-46: 1.4→1.28 (요청8: 슬롯 늘려서 합체 수월하게)
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
        engine.spawnFloatingText('대상 없음', engine.camera.x, engine.camera.y, '#aaa');
      }
    }
  },
  {
    key: 'evacuate', name: '대피시키기', emoji: '🌀', cost: 140,
    desc: '필드에서 체력이 가장 낮은 적 20%를 즉시 처치 (필드 정리용)',
    buy(engine) {
      // v27-46: 거의 안 쓰이던 블리자드(슬로우) 대체 - 이 게임의 핵심 압박인 "필드 누적"에
      // 직접 대응하는 아이템으로 교체 (요청10 - 쓸만한 상점 아이템 브레인스토밍)
      const alive = engine.enemies.filter(e => !e.dead && !e.reachedEnd && !e.isBoss);
      if (!alive.length) { engine.spawnFloatingText('대피시킬 적이 없습니다', engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#888'); return; }
      alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)); // 체력비율 낮은 순
      const n = Math.max(1, Math.round(alive.length * 0.2));
      for (let i = 0; i < n; i++) alive[i].takeDamage(alive[i].maxHp * 10, 'special');
      if (window.AoeBurst) engine.particles.push(new AoeBurst(engine.camera.x, engine.camera.y, Math.max(engine.width, engine.height)*0.6/engine.camera.zoom, '#9575cd'));
      engine.spawnFloatingText(`🌀 대피 완료! ${n}마리 정리`, engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#9575cd');
    }
  },
  {
    key: 'revive', name: '확장 부지', emoji: '🏗️', cost: 450, scaling: true,
    desc: '트랙 안쪽에 빈 배치슬롯 1개 즉시 추가 (살수록 비싸짐)',
    buy(engine) {
      const w = engine.worldWidth, h = engine.worldHeight; // v27-47: 카메라 시스템 도입으로 월드 크기 기준
      // v27-36: 5단 지그재그 맵 좌표에 맞춰 탐색범위 재조정
      const mx = w*0.15, my = h*0.20, innerGap = w*0.30;
      const top = my + h*0.03, bot = h - my - h*0.03;
      const xMin = mx+innerGap+w*0.03, xMax = w-mx-w*0.05;
      let best = null, bestMinDist = -1;
      for (let tries=0; tries<60; tries++) {
        const x = xMin + Math.random()*(xMax-xMin);
        const y = top + Math.random()*(bot-top);
        let minDist = Infinity;
        for (const s of engine.towerSlots) minDist = Math.min(minDist, Math.hypot(s.x-x, s.y-y));
        if (minDist > bestMinDist) { bestMinDist = minDist; best = {x,y}; }
      }
      // v27-42 버그수정: 순수 랜덤 60번 시도가 가끔 전부 나쁜 자리만 뽑혀서 실패하고 있었음
      // (요청1 - "공간 없다고 뜨는데 나중엔 또 된다"는 게 바로 이 랜덤운 문제였음). 랜덤이 실패하면
      // 격자를 촘촘히 훑는 체계적 탐색으로 한 번 더 확인해서, 진짜 공간이 없을 때만 실패하도록 함.
      // v27-43 버그수정: 최소거리 임계값이 고정 55px이었는데, 좁은 모바일 화면(탐색범위 자체가 몇백px밖에
      // 안 됨)에서는 슬롯 1~2개만 추가해도 이 조건을 만족하는 자리가 금방 없어져서 "1~2개밖에 안했는데
      // 벌써 안된다"는 문제가 있었음 (요청1). 화면폭에 비례하는 값으로 변경 (탭 안전거리 38px는 유지).
      const MIN_DIST = Math.max(38, Math.min(55, w * 0.09));
      if (!best || bestMinDist <= MIN_DIST) {
        const GRID = 14;
        for (let gx = 0; gx <= GRID; gx++) {
          for (let gy = 0; gy <= GRID; gy++) {
            const x = xMin + (xMax-xMin) * (gx/GRID);
            const y = top + (bot-top) * (gy/GRID);
            let minDist = Infinity;
            for (const s of engine.towerSlots) minDist = Math.min(minDist, Math.hypot(s.x-x, s.y-y));
            if (minDist > bestMinDist) { bestMinDist = minDist; best = {x,y}; }
          }
        }
      }
      if (best && bestMinDist > MIN_DIST) {
        engine.towerSlots.push({ x: best.x, y: best.y, occupied: false, tower: null });
        engine.spawnFloatingText('🏗️ 새 슬롯 확보!', best.x, best.y, '#06d6a0');
      } else {
        engine.spawnFloatingText('공간이 부족합니다', engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#ff6b6b');
        return false; // v27-8 버그수정: 실패해도 return false가 없어서 골드가 환불 안 되고 그냥 나갔던 문제
      }
    }
  },
  {
    key: 'rarecandy', name: '이상한사탕', emoji: '🍬', cost: 2500, oneTime: true,
    desc: '3성(에픽) 타워 1개를 레전드로 진화 (게임당 1회만 사용 가능) - 후반 전략용 고가 아이템',
    buy(engine) {
      // v27 fix: 아무 등급이나 무한정 되던 걸 3성(epic) 한정 + 1회용으로 변경 (안 그러면 도배해서 다 5성 만들어버림)
      const gachaSlots = engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId && s.tower.def?.grade === 'epic');
      if (!gachaSlots.length) {
        engine.spawnFloatingText('3성(에픽) 타워가 없습니다', engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#aaa');
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
  // v27-46: 포켓몬센터(데미지버프)는 영웅스킬 "행복의알"과 정확히 겹치는 효과라 의미가 옅었음.
  // "훈련소"로 교체 - 공속을 올려서 데미지 버프와는 다른 결의 효과, 여전히 영웅스킬과 안 겹침.
  trainingCamp: {
    name: '훈련소', emoji: '🏋️', cooldown: 150,
    desc: '모든 타워 6초간 공격속도 +25%',
    cast(engine) {
      for (const t of engine.towers) {
        t._tempSpeedMul = 1.25;
        t._pokecenterTimer = 6; // 기존 만료처리 로직 재사용 (이름은 유지, 내용은 공용 타이머)
      }
      engine.spawnFloatingText('🏋️ 훈련소! 전체 공속+25%', engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#06d6a0');
    }
  },
  // v27-46: 마스터볼(전체 즉발피해+슬로우)은 영웅 궁극기들과 데미지 성격이 겹쳤음.
  // "그물망 함정"으로 교체 - 데미지 없이 강력한 스턴만 걸어서, 그 사이 타워들이 자유롭게 몰아치게
  // 해주는 순수 유틸 스킬로 차별화.
  netTrap: {
    name: '그물망 함정', emoji: '🕸️', cooldown: 100,
    desc: '전체 적 2.5초 확정 스턴 (데미지 없음)',
    cast(engine) {
      let n = 0;
      for (const e of engine.enemies) {
        if (e.dead || e.reachedEnd || e.isBoss) continue; // 보스는 스턴 면역(밸런스)
        e.applyStatus('stun', 2.5, 0);
        n++;
      }
      if (window.AoeBurst)
        engine.particles.push(new AoeBurst(engine.camera.x, engine.camera.y,
          Math.max(engine.width, engine.height)/engine.camera.zoom, '#7c4dff'));
      engine.spawnFloatingText(`🕸️ 그물망 함정! ${n}마리 스턴`, engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#7c4dff');
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
