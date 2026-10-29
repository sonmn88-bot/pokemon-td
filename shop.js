// ===== SHOP.JS - 상점 아이템 + 글로벌 스펠 (v27: 상시노출, 상한 대신 누적가격) =====

// v27: 영구 강화류는 상한(maxBuys) 대신 살수록 가격이 올라가는 방식으로 변경
function shopItemCost(item, engine) {
  // v28 (설계서 §5): 웨이브 연동 가격 - 몹 체력은 지수로 오르는데 즉사형 아이템 가격이 고정이면 후반 정답템이 됨
  if (item.perWaveCost) return Math.round(item.cost + (engine.currentWave || 0) * item.perWaveCost);
  if (item.key === 'luckycoin') return Math.round(item.cost * (1 - (engine._coinDiscount || 0))); // 토게피 '동전 수집'
  if (!item.scaling) return item.cost;
  const n = (engine._shopBuyCount && engine._shopBuyCount[item.key]) || 0;
  return Math.round(item.cost * Math.pow(1.28, n)); // v27-46: 1.4→1.28 (요청8: 슬롯 늘려서 합체 수월하게)
}

const ShopItems = [
  {
    key: 'monsterball', icon:'net', name: '몬스터볼', emoji: '⚪', cost: 80, perWaveCost: 4, perWave: 2,
    desc: '가장 앞선 적 1체 즉시 제거 (보스 제외, 웨이브당 2회)',
    buy(engine) {
      const target = engine.enemies
        .filter(e => !e.dead && !e.reachedEnd && !e.isBoss)
        .sort((a,b) => b.distTraveled - a.distTraveled)[0];
      if (target) {
        target.die ? target.die() : (target.dead = true);
        engine.addGold(target.reward);
        engine.spawnFloatingText('포획!', target.x, target.y - 20, '#fff');
      } else {
        engine.spawnFloatingText('대상 없음', engine.camera.x, engine.camera.y, '#aaa');
      }
    }
  },
  {
    key: 'evacuate', icon:'swirl', name: '대피시키기', emoji: '🌀', cost: 100, perWaveCost: 10, perWave: 1,
    desc: '체력 비율 하위 15% 즉시 처치 (최대 10마리, 웨이브당 1회)',
    buy(engine) {
      // v27-46: 거의 안 쓰이던 블리자드(슬로우) 대체 - 이 게임의 핵심 압박인 "필드 누적"에
      // 직접 대응하는 아이템으로 교체 (요청10 - 쓸만한 상점 아이템 브레인스토밍)
      const alive = engine.enemies.filter(e => !e.dead && !e.reachedEnd && !e.isBoss);
      if (!alive.length) { engine.spawnFloatingText('대피시킬 적이 없습니다', engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#888'); return; }
      alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp)); // 체력비율 낮은 순
      const n = Math.min(10, Math.max(1, Math.round(alive.length * 0.15)));
      for (let i = 0; i < n; i++) alive[i].takeDamage(alive[i].maxHp * 10, 'special');
      if (window.AoeBurst) engine.particles.push(new AoeBurst(engine.camera.x, engine.camera.y, Math.max(engine.width, engine.height)*0.6/engine.camera.zoom, '#9575cd'));
      engine.spawnFloatingText(`대피 완료! ${n}마리 정리`, engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#9575cd');
    }
  },
  {
    key: 'revive', icon:'build', name: '확장 부지', emoji: '🏗️', cost: 450, scaling: true,
    desc: '트랙 안쪽에 빈 배치슬롯 1개 즉시 추가 (살수록 비싸짐)',
    buy(engine) {
      // v3.15: 길 위·화면 밖·기존 자리와 겹치는 곳을 빼고, 길에서 사거리 안(30~110)인 빈 땅 중 가장 여유 있는 곳을 격자로 전수 탐색
      const w = engine.worldWidth, h = engine.worldHeight, path = engine.paths[0] || [], pw = (engine.currentMap && engine.currentMap.pathWidth) || 30;
      const pS = path.filter((_, i) => i % 2 === 0), MIN_DIST = 52;
      let best = null, bestScore = -1;
      for (let y = h * 0.05; y <= h * 0.95; y += 8) for (let x = w * 0.07; x <= w * 0.93; x += 8) {
        const dp = window._distToPath ? _distToPath(x, y, pS) : 999;
        if (dp < pw / 2 + 24 || dp > 110) continue;                          // 길 위 X, 길에서 너무 멀어도 X
        let md = Infinity; for (const s2 of engine.towerSlots) md = Math.min(md, Math.hypot(s2.x - x, s2.y - y));
        if (md < MIN_DIST) continue;
        const score = Math.min(md, 90) - Math.abs(dp - 60) * 0.3;           // 다른 자리와 넉넉히 + 길에서 적당한 거리
        if (score > bestScore) { bestScore = score; best = { x: Math.round(x), y: Math.round(y) }; }
      }
      if (!best) {
        engine.spawnFloatingText('공간이 부족합니다', engine.camera.x, engine.camera.y, '#ff5c7a');
        return false; // 실패 시 골드 환불
      }
      engine.towerSlots.push({ x: best.x, y: best.y, occupied: false, tower: null });
      if (engine.w3 && engine.w3.setSlots) engine.w3.setSlots(engine.towerSlots); // 3D 바닥 자국도 갱신
      engine.spawnFloatingText('새 슬롯 확보!', best.x, best.y, '#34d399');
      engine.camera.x += (best.x - engine.camera.x) * 0.5; engine.camera.y += (best.y - engine.camera.y) * 0.5; engine.clampCamera(); // 새 자리 쪽으로 화면 이동
    }
  },
  {
    // v28 (설계서 §5): 랜덤 합성에 '선택'을 한 번 끼워넣는 아이템 - 운 + 판단
    key: 'luckycoin', icon:'luckycoin', name: '행운의 동전', emoji: '🪙', cost: 300,
    desc: '다음 랜덤 합성 결과를 2개 중에서 고름 (여러 개 모아둘 수 있음)',
    buy(engine) {
      engine._luckyCoins = (engine._luckyCoins || 0) + 1;
      window.app?.renderStorageStrip?.();
      engine.spawnFloatingText(`행운의 동전 ${engine._luckyCoins}개 보유`, engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#ffc24b');
    }
  },
  {
    key: 'rarecandy', icon:'candy', name: '이상한사탕', emoji: '🍬', cost: 2500, oneTime: true,
    desc: '고른 에픽 타워 1개를 랜덤 레전드로 진화 (게임당 1회) — 에픽 타워를 누른 뒤 정보창에서도 사용 가능',
    buy(engine) {
      // v3.8: 랜덤 대상 → 플레이어가 고른 타워. 선택된 에픽 타워가 없으면 안내만 하고 환불
      const t = engine.selectedTower, slot = t && engine.towerSlots.find(s => s.tower === t);
      if (!slot || t.def?.grade !== 'epic') {
        window.app && app.showWaveAnnounce('먼저 진화시킬 에픽 타워를 눌러 선택하세요', '#ff8fb1');
        return false;
      }
      return useRareCandy(engine, slot);
    }
  },
];

// ===== 글로벌 스펠 =====
const GlobalSpells = {
  // v27-46: 포켓몬센터(데미지버프)는 영웅스킬 "행복의알"과 정확히 겹치는 효과라 의미가 옅었음.
  // "훈련소"로 교체 - 공속을 올려서 데미지 버프와는 다른 결의 효과, 여전히 영웅스킬과 안 겹침.
  trainingCamp: {
    name: '훈련소', icon:'dumbbell', emoji: '🏋️', cooldown: 150,
    desc: '모든 타워 6초간 공격속도 +25%',
    cast(engine) {
      for (const t of engine.towers) {
        t._tempSpeedMul = 1.25;
        t._pokecenterTimer = 6; // 기존 만료처리 로직 재사용 (이름은 유지, 내용은 공용 타이머)
      }
      engine.spawnFloatingText('훈련소! 전체 공속+25%', engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#34d399');
    }
  },
  // v27-46: 마스터볼(전체 즉발피해+슬로우)은 영웅 궁극기들과 데미지 성격이 겹쳤음.
  // "그물망 함정"으로 교체 - 데미지 없이 강력한 스턴만 걸어서, 그 사이 타워들이 자유롭게 몰아치게
  // 해주는 순수 유틸 스킬로 차별화.
  netTrap: {
    name: '그물망 함정', icon:'web', emoji: '🕸️', cooldown: 100,
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
      engine.spawnFloatingText(`그물망 함정! ${n}마리 스턴`, engine.camera.x, engine.camera.y - (engine.height/2 - 80)/engine.camera.zoom, '#7c4dff');
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

// v3.8 이상한사탕: 선택한 에픽 → 랜덤 레전드 (타워 정보창 버튼과 상점 공용)
function useRareCandy(engine, slot) {
  const t = slot && slot.tower;
  if (!t || t.def?.grade !== 'epic') return false;
  const legendPool = window.GRADE_POOLS?.legend || [];
  const evoDef = window.GachaTowerDefs?.[legendPool[Math.floor(Math.random() * legendPool.length)]];
  if (!evoDef) return false;
  const evoTower = window._createGachaTower(evoDef, slot.x, slot.y, engine);
  evoTower._evolveGlowTimer = 1.2;
  engine.towers = engine.towers.filter(x => x !== t);
  engine.towers.push(evoTower);
  slot.tower = evoTower;
  engine.selectedTower = null;
  if (window.applyTowerSynergies) window.applyTowerSynergies(engine.towers);
  engine.spawnFloatingText(`${evoDef.name} 진화!`, slot.x, slot.y - 36, window.GRADES?.[evoDef.grade]?.color || '#ffc24b');
  return true;
}
window.useRareCandy = useRareCandy;
