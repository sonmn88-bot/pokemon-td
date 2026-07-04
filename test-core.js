// v27-7: 핵심 로직 자동 점검 스크립트 (요청7)
// 사용법: node test-core.js
// gacha.js/shop.js를 그대로 불러와서(window 스텁) 확률표/미션/합체레시피 등 핵심 데이터의
// 흔한 실수(합계 안맞음, 참조 깨짐, 필드 누락)를 자동으로 잡아냅니다.
// 코드를 고칠 때마다 이거 한 번 돌려보면, 플레이해보기 전에 구조적 버그를 미리 잡을 수 있습니다.

const fs = require('fs');
const path = require('path');

let failCount = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`✅ ${name}`); }
  else { console.log(`❌ ${name}${detail ? ' - ' + detail : ''}`); failCount++; }
}

// ---- window 스텁 후 gacha.js / shop.js 로드 ----
const sandbox = { window: {}, console };
sandbox.window.loadSpriteImage = () => ({});
sandbox.window.AoeBurst = function(){};
sandbox.window.ChainBolt = function(){};
sandbox.window.Projectile = function(){};
sandbox.window.TowerSpriteImages = {};

const vm = require('vm');
const ctx = vm.createContext(sandbox);

function loadScript(file) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}

try {
  loadScript('gacha.js');
  loadScript('shop.js');
} catch (e) {
  console.log('❌ 스크립트 로드 실패:', e.message);
  process.exit(1);
}

const w = sandbox.window;

// ---- 1. 뽑기 확률표 합계가 100에 가까운지 ----
for (const key in w.PULL_TABLES || {}) {
  const sum = w.PULL_TABLES[key].reduce((s, x) => s + x.weight, 0);
  check(`PULL_TABLES.${key} 확률 합계 ≈100`, Math.abs(sum - 100) < 0.5, `실제: ${sum}`);
}

// ---- 2. GRADE_POOLS의 모든 id가 GachaTowerDefs에 실존하는지 ----
for (const grade in w.GRADE_POOLS || {}) {
  for (const id of w.GRADE_POOLS[grade]) {
    check(`GRADE_POOLS.${grade} 항목 '${id}' 존재`, !!w.GachaTowerDefs[id], '정의 안됨');
  }
}

// ---- 3. MERGE_EVOLUTION의 모든 from/to id가 GachaTowerDefs에 실존하는지 ----
for (const from in w.MERGE_EVOLUTION || {}) {
  const to = w.MERGE_EVOLUTION[from];
  check(`합체 레시피 '${from}'→'${to}' 둘 다 존재`, !!w.GachaTowerDefs[from] && !!w.GachaTowerDefs[to]);
}

// ---- 4. MissionDefs 필드 무결성 (reward 없거나 rewardType 같은 유령필드 재발 방지) ----
for (const m of w.MissionDefs || []) {
  check(`미션 '${m.id}' reward>0`, typeof m.reward === 'number' && m.reward > 0, `reward: ${m.reward}`);
  check(`미션 '${m.id}' condition 함수`, typeof m.condition === 'function');
  check(`미션 '${m.id}' rewardType 유령필드 없음`, m.rewardType === undefined, '옛날 버그 재발! rewardType 필드는 안 씀');
}

// ---- 5. TypeUpgrades 각 항목 필드 무결성 ----
for (const type in w.TypeUpgrades || {}) {
  for (const [i, tier] of w.TypeUpgrades[type].entries()) {
    check(`TypeUpgrades.${type}[${i}] cost>0`, tier.cost > 0);
    check(`TypeUpgrades.${type}[${i}] val>0`, tier.val > 0);
  }
}

// ---- 6. ShopItems cost>0, buy 함수 존재 ----
for (const item of w.ShopItems || []) {
  check(`ShopItems '${item.key}' cost>0`, item.cost > 0);
  check(`ShopItems '${item.key}' buy 함수`, typeof item.buy === 'function');
}

console.log('\n' + (failCount === 0 ? `🎉 전부 통과! (핵심 데이터 이상 없음)` : `⚠️  ${failCount}개 항목 실패 - 위 ❌ 항목 확인 필요`));
process.exit(failCount === 0 ? 0 : 1);
