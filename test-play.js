// test-play.py의 Node 버전 (이 환경엔 파이썬 Playwright가 없음): 시작→뽑기→보관함→합성→레시피→배치→웨이브
// 사용법: python3 -m http.server 8765 실행 후  node test-play.js http://localhost:8765/index.html out 390 844
const { chromium } = require('playwright');
const [URL, OUT, VW, VH] = [process.argv[2], process.argv[3] || 'out', +process.argv[4] || 390, +process.argv[5] || 844];
(async () => {
  const errors = [];
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1, hasTouch: true });
  pg.on('pageerror', e => errors.push('PAGEERROR ' + e));
  pg.on('console', m => { const t = m.text().toLowerCase(); if (m.type() === 'error' && !/sw|favicon|firebase|404/.test(t)) errors.push('CONSOLE ' + m.text()); });
  const r = {};
  await pg.goto(URL, {waitUntil:'load'});
  await pg.click('#btn-start');
  await pg.click('#btn-endless-start');
  await pg.waitForTimeout(500);
  // 스타터 선택
  await pg.evaluate("document.querySelector('.skin-picker div[style*=\"cursor\"]')?.click()");
  await pg.waitForTimeout(300);
  r['start_towers'] = await pg.evaluate("app.engine.towers.length");
  await pg.evaluate("app.engine.gold = 99999; app.engine.selectedSlotIdx = null;");
  for (let i = 0; i < 9; i++) await pg.evaluate("app.doPull('normal')");
  r['inv_after_9pulls'] = await pg.evaluate("app._inventory.length");
  r['strip_children'] = await pg.evaluate("document.getElementById('storage-strip').children.length");
  r['merge_dot'] = await pg.evaluate("document.querySelector('.storage-merge-btn').classList.contains('has-dot')");
  // 10연 (중복 버그 확인)
  const before = await pg.evaluate("app._inventory.length");
  await pg.evaluate("app.doPull('ten')");
  await pg.waitForTimeout(200);
  r['ten_pull_added'] = (await pg.evaluate("app._inventory.length")) - before;
  await pg.evaluate("document.querySelector('.tenpull-overlay .skin-picker-close')?.click()");
  r['ten_after_close'] = (await pg.evaluate("app._inventory.length")) - before;
  // 합성 연구소 → 자동 → 랜덤 합성
  await pg.evaluate("app.openMergePanel()");
  await pg.waitForTimeout(250);
  await pg.screenshot({path: OUT + '_merge_panel.png'});
  await pg.click('[data-act="auto"]');
  r['selected'] = await pg.evaluate("document.querySelectorAll('.mg-card.sel').length");
  const n_rare_before = await pg.evaluate("app._inventory.filter(d=>d.grade==='rare').length");
  await pg.click('[data-act="random"]');
  await pg.waitForTimeout(400);
  await pg.screenshot({path: OUT + '_spin.png'});
  await pg.evaluate("document.querySelector('.merge-reveal')?.click()") // 스킵 → 공개;
  await pg.waitForTimeout(500);
  await pg.screenshot({path: OUT + '_reveal.png'});
  await pg.evaluate("document.querySelector('.merge-reveal')?.click()") // 닫기;
  await pg.waitForTimeout(300);
  r['rare_gained'] = (await pg.evaluate("app._inventory.filter(d=>d.grade==='rare').length")) - n_rare_before;
  r['panel_reopened'] = await pg.evaluate("!!document.querySelector('.merge-overlay')");
  // 레시피: 3신조 → 뮤
  await pg.evaluate("document.querySelector('.merge-overlay')?.remove(); app._addToStorage(['articuno','zapdos','moltres'].map(id=>({...GachaTowerDefs[id]}))); app.openMergePanel();");
  await pg.waitForTimeout(200);
  r['mew_recipe_ready'] = await pg.evaluate("!document.querySelector('[data-recipe=\"mew\"]').disabled");
  await pg.click('[data-recipe="mew"]');
  await pg.waitForTimeout(300);
  await pg.evaluate("document.querySelector('.merge-reveal')?.click()"); await pg.waitForTimeout(600);
  await pg.screenshot({path: OUT + '_mew.png'});
  await pg.evaluate("document.querySelector('.merge-reveal')?.click()"); await pg.waitForTimeout(300);
  r['has_mew'] = await pg.evaluate("app._inventory.some(d=>d.id==='mew')");
  r['legends_left'] = await pg.evaluate("app._inventory.filter(d=>d.grade==='legend').length");
  await pg.evaluate("document.querySelector('.merge-overlay')?.remove()");
  // 보관함에서 배치: 탭 → 슬롯 탭 흐름
  const empty = await pg.evaluate("app.engine.towerSlots.findIndex(s=>!s.occupied)");
  await pg.evaluate("app.engine.selectedSlotIdx=null; app._onStorageItemTap(app._inventory[0].id)");
  r['placing_mode'] = await pg.evaluate("app._placingId");
  const t_before = await pg.evaluate("app.engine.towers.length");
  await pg.evaluate(`(()=>{const s=app.engine.towerSlots[${empty}]; const c=app.engine.camera; const sx=(s.x-c.x)*c.zoom+app.engine.width/2, sy=(s.y-c.y)*c.zoom+app.engine.height/2; app.engine.handleTap(sx,sy);})()`);
  r['placed_by_tap'] = (await pg.evaluate("app.engine.towers.length")) - t_before;
  // 필드 타워 회수
  r['inv_before_recall'] = await pg.evaluate("app._inventory.length");
  // 웨이브 진행 (3배속)
  await pg.evaluate("document.querySelector('.speed-btn[data-speed=\"3\"]').click(); app.sendWave()");
  await pg.waitForTimeout(3500);
  r['wave'] = await pg.evaluate("app.engine.currentWave");
  r['enemies'] = await pg.evaluate("app.engine.enemies.length");
  r['armor_w1'] = await pg.evaluate("app.engine.enemies[0]?.armor");
  r['hero_count_draw_ok'] = await pg.evaluate("typeof app.engine.draw === 'function'");
  await pg.screenshot({path: OUT + '_game.png'});
  r['errors'] = errors.slice(0,10);
  r['errors'] = errors.slice(0, 10);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
