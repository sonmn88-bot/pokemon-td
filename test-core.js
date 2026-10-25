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
  loadScript('pokedex.js');
  loadScript('shop.js');
  loadScript('heroes.js');
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
  const to = [].concat(w.MERGE_EVOLUTION[from]);
  check(`합체 레시피 '${from}'→'${to}' 둘 다 존재`, !!w.GachaTowerDefs[from] && to.every(x => !!w.GachaTowerDefs[x]));
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

// ---- 7. v28 랜덤 합성 · 레시피 ----
{
  const st = {};
  let wrong = 0, uniq = 0;
  for (let i = 0; i < 3000; i++) {
    const g = ['normal','rare','epic'][i % 3];
    const r = w.rollRandomMerge(g, st);
    if (!r || r.grade !== w.NEXT_GRADE[g]) wrong++;
    if (r && r.grade === 'unique') uniq++;
  }
  check('랜덤 합성: 항상 다음 등급', wrong === 0, `${wrong}건 오류`);
  check('랜덤 합성: 유니크는 절대 안 나옴', uniq === 0);
  check('랜덤 합성: 레전드는 랜덤 합성 불가', w.rollRandomMerge('legend', {}) === null);
  let jumpMax = true;
  for (let i = 0; i < 500; i++) { const r = w.rollRandomMerge('rare', { jumpChance: 1 }); if (r.grade !== 'legend') jumpMax = false; }
  check('2등급 점프: 결과 상한 레전드', jumpMax);
  const D = id => w.GachaTowerDefs[id];
  const mew = w.RECIPES.find(r => r.id === 'mew'), mt = w.RECIPES.find(r => r.id === 'mewtwo');
  check('레시피 뮤: 서로 다른 레전드 3종이면 가능', !!mew.pick([D('articuno'), D('zapdos'), D('gengar')]));
  check('레시피 뮤: 같은 레전드 3개면 불가', mew.pick([D('zapdos'), D('zapdos'), D('zapdos')]) === null);
  check('레시피 뮤츠: 뮤+레전드2 가능', !!mt.pick([D('mew'), D('gengar'), D('zapdos')]));
  check('레전드 3개 → 유니크 확정 경로 없음', !Object.keys(w.MERGE_EVOLUTION).some(k => [].concat(w.MERGE_EVOLUTION[k]).some(x => D(x)?.grade === 'unique')));
  for (const g of ['normal','rare','epic','legend','unique']) check(`판매가 정의: ${g}`, (w.SELL_VALUE?.[g] || 0) > 0);
}

// ---- 8. v28 영웅 스킬트리 무결성 ----
{
  const KNOWN = ['critChance','critMul','chainAtk','lightning','thunderDouble','elecSpeed','elecRange','elecDmg','chargeAll',
    'stunPlus','voltSlow','cdReduce','bossStun','goldBonus','interestCap','waveBonus','freePull','pityBoost','coinDiscount',
    'jump','miracle','eggDur','eggPower','metroDouble','eggSpeed','atkDmg','adaptDmg','burstSplash','fireRate','burstDur',
    'burstCd','atkSlow','skillRange','globalDmg','vulnerable'];
  const trees = vm.runInContext('SkillTrees', ctx);
  for (const hid of ['pikachu','togepi','eevee']) {
    const t = trees[hid];
    check(`스킬트리 ${hid}: 3갈래 × 4단계 = 12노드`, t && t.branches.length === 3 && t.nodes.length === 12);
    check(`스킬트리 ${hid}: 갈래당 10SP (2갈래 반만 가능)`, [0,1,2].every(b => t.nodes.filter(n => n.branch === b).reduce((a, n) => a + n.cost, 0) === 10));
    const bad = t.nodes.filter(n => !n.desc || !n.fx || Object.keys(n.fx).some(k => !KNOWN.includes(k)));
    check(`스킬트리 ${hid}: 모든 노드 설명·효과 키 유효`, bad.length === 0, bad.map(n => n.id).join(','));
    check(`스킬트리 ${hid}: 노드 id 중복 없음`, new Set(t.nodes.map(n => n.id)).size === 12);
  }
}

// ---- 9. v28 세션D: 151 도감 ----
{
  const defs = Object.values(w.GachaTowerDefs);
  check('도감: 정확히 151마리', defs.length === 151, `실제 ${defs.length}`);
  check('도감: 번호 1~151 빠짐없음', new Set(defs.map(d => d.no)).size === 151 && defs.every(d => d.no >= 1 && d.no <= 151));
  const cnt = {}; defs.forEach(d => cnt[d.grade] = (cnt[d.grade] || 0) + 1);
  check('도감: 등급 분포 N52/R60/E32/L5/U2', cnt.normal === 52 && cnt.rare === 60 && cnt.epic === 32 && cnt.legend === 5 && cnt.unique === 2, JSON.stringify(cnt));
  const bad = defs.filter(d => !(d.damage > 0) || !(d.fireRate > 0) || !(d.range > 0) || typeof d.fire !== 'function' || !w.TYPES[d.type] || !d.desc);
  check('도감: 모든 종 수치·공격·타입·설명 유효', bad.length === 0, bad.map(d => d.id).join(','));
  check('도감: 이미지 경로 151개', defs.every(d => !!w.TowerSpriteImages[d.id]));
  for (const g of ['normal','rare','epic','legend']) check(`도감: ${g} 풀에 전기 타입 있음`, w.GRADE_POOLS[g].some(id => w.GachaTowerDefs[id].type === 'electric'));
  check('도감: 뮤는 뽑기 풀 제외', !w.GRADE_POOLS.unique.includes('mew'));
  const ev = new Set(); for (let i = 0; i < 300; i++) ev.add(w.getEvolutionId('eevee'));
  check('도감: 이브이 진화 3갈래 랜덤', ev.size === 3);
  check('도감: 진화는 항상 상위 등급', Object.keys(w.MERGE_EVOLUTION).every(k => [].concat(w.MERGE_EVOLUTION[k]).every(x => w.MERGE_ORDER.indexOf(D2(x).grade) > w.MERGE_ORDER.indexOf(D2(k).grade))));
  function D2(id) { return w.GachaTowerDefs[id]; }
  const names = { clefairy:'삐삐', clefable:'픽시', gloom:'냄새꼬', gastly:'고오스', abra:'캐이시', oddish:'뚜벅쵸', lickitung:'내루미', horsea:'쏘드라', goldeen:'콘치', pidgeotto:'피죤', pidgeot:'피죤투' };
  const wrong = Object.keys(names).filter(k => w.GachaTowerDefs[k].name !== names[k]);
  check('도감: 한글 이름 교정 반영', wrong.length === 0, wrong.join(','));
  // 타입 균등: 노말 뽑기 6000회 → 타입별 비율 대략 균등
  const tc = {}; for (let i = 0; i < 6000; i++) { const t = w.rollTower('normal').type; tc[t] = (tc[t] || 0) + 1; }
  const types = Object.keys(tc), vals = Object.values(tc);
  check('도감: 노말 뽑기 타입 균등 (최대/최소 < 1.3)', Math.max(...vals) / Math.min(...vals) < 1.3, JSON.stringify(tc));
  // DPS 템플릿 검증: 같은 등급 딜러 표준형 DPS가 등급 순서대로 증가
  const dps = g => { const l = defs.filter(d => d.grade === g); return l.reduce((a, d) => a + d.damage * d.fireRate, 0) / l.length; };
  check('도감: 평균 DPS 등급 순 증가', dps('normal') < dps('rare') && dps('rare') < dps('epic') && dps('epic') < dps('legend'), ['normal','rare','epic','legend'].map(g => dps(g).toFixed(1)).join('/'));
}

console.log('\n' + (failCount === 0 ? `🎉 전부 통과! (핵심 데이터 이상 없음)` : `⚠️  ${failCount}개 항목 실패 - 위 ❌ 항목 확인 필요`));
process.exit(failCount === 0 ? 0 : 1);
