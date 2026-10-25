# v28: 실제 브라우저로 플레이 흐름 자동 점검 (시작→뽑기→보관함→합성→레시피→배치→웨이브)
# 사용법: python3 -m http.server 8765 실행 후  python3 test-play.py http://localhost:8765/index.html out 390 844
import asyncio, sys, json
from playwright.async_api import async_playwright

URL = sys.argv[1]
OUT = sys.argv[2]
VW, VH = int(sys.argv[3]), int(sys.argv[4])

async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': VW, 'height': VH}, device_scale_factor=2, has_touch=True)
        pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
        pg.on('console', lambda m: errors.append('CONSOLE ' + m.text) if m.type == 'error' and 'sw' not in m.text.lower() and 'favicon' not in m.text.lower() and 'firebase' not in m.text.lower() and '404' not in m.text else None)
        await pg.goto(URL, wait_until='load')
        await pg.click('#btn-start')
        await pg.click('#btn-endless-start')
        await pg.wait_for_timeout(500)
        # 스타터 선택
        await pg.evaluate("document.querySelector('.skin-picker div[style*=\"cursor\"]')?.click()")
        await pg.wait_for_timeout(300)
        r = {}
        r['start_towers'] = await pg.evaluate("app.engine.towers.length")
        await pg.evaluate("app.engine.gold = 99999; app.engine.selectedSlotIdx = null;")
        for _ in range(9):
            await pg.evaluate("app.doPull('normal')")
        r['inv_after_9pulls'] = await pg.evaluate("app._inventory.length")
        r['strip_children'] = await pg.evaluate("document.getElementById('storage-strip').children.length")
        r['merge_dot'] = await pg.evaluate("document.querySelector('.storage-merge-btn').classList.contains('has-dot')")
        # 10연 (중복 버그 확인)
        before = await pg.evaluate("app._inventory.length")
        await pg.evaluate("app.doPull('ten')")
        await pg.wait_for_timeout(200)
        r['ten_pull_added'] = (await pg.evaluate("app._inventory.length")) - before
        await pg.evaluate("document.querySelector('.tenpull-overlay .skin-picker-close').click()")
        r['ten_after_close'] = (await pg.evaluate("app._inventory.length")) - before
        # 합성 연구소 → 자동 → 랜덤 합성
        await pg.evaluate("app.openMergePanel()")
        await pg.wait_for_timeout(250)
        await pg.screenshot(path=OUT + '_merge_panel.png')
        await pg.click('[data-act="auto"]')
        r['selected'] = await pg.evaluate("document.querySelectorAll('.mg-card.sel').length")
        n_rare_before = await pg.evaluate("app._inventory.filter(d=>d.grade==='rare').length")
        await pg.click('[data-act="random"]')
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + '_spin.png')
        await pg.evaluate("document.querySelector('.merge-reveal')?.click()")  # 스킵 → 공개
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + '_reveal.png')
        await pg.evaluate("document.querySelector('.merge-reveal')?.click()")  # 닫기
        await pg.wait_for_timeout(300)
        r['rare_gained'] = (await pg.evaluate("app._inventory.filter(d=>d.grade==='rare').length")) - n_rare_before
        r['panel_reopened'] = await pg.evaluate("!!document.querySelector('.merge-overlay')")
        # 레시피: 3신조 → 뮤
        await pg.evaluate("document.querySelector('.merge-overlay')?.remove(); app._addToStorage(['articuno','zapdos','moltres'].map(id=>({...GachaTowerDefs[id]}))); app.openMergePanel();")
        await pg.wait_for_timeout(200)
        r['mew_recipe_ready'] = await pg.evaluate("!document.querySelector('[data-recipe=\"mew\"]').disabled")
        await pg.click('[data-recipe="mew"]')
        await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('.merge-reveal')?.click()"); await pg.wait_for_timeout(600)
        await pg.screenshot(path=OUT + '_mew.png')
        await pg.evaluate("document.querySelector('.merge-reveal')?.click()"); await pg.wait_for_timeout(300)
        r['has_mew'] = await pg.evaluate("app._inventory.some(d=>d.id==='mew')")
        r['legends_left'] = await pg.evaluate("app._inventory.filter(d=>d.grade==='legend').length")
        await pg.evaluate("document.querySelector('.merge-overlay')?.remove()")
        # 보관함에서 배치: 탭 → 슬롯 탭 흐름
        empty = await pg.evaluate("app.engine.towerSlots.findIndex(s=>!s.occupied)")
        await pg.evaluate("app.engine.selectedSlotIdx=null; app._onStorageItemTap(app._inventory[0].id)")
        r['placing_mode'] = await pg.evaluate("app._placingId")
        t_before = await pg.evaluate("app.engine.towers.length")
        await pg.evaluate(f"(()=>{{const s=app.engine.towerSlots[{empty}]; const c=app.engine.camera; const sx=(s.x-c.x)*c.zoom+app.engine.width/2, sy=(s.y-c.y)*c.zoom+app.engine.height/2; app.engine.handleTap(sx,sy);}})()")
        r['placed_by_tap'] = (await pg.evaluate("app.engine.towers.length")) - t_before
        # 필드 타워 회수
        r['inv_before_recall'] = await pg.evaluate("app._inventory.length")
        # 웨이브 진행 (3배속)
        await pg.evaluate("document.querySelector('.speed-btn[data-speed=\"3\"]').click(); app.sendWave()")
        await pg.wait_for_timeout(3500)
        r['wave'] = await pg.evaluate("app.engine.currentWave")
        r['enemies'] = await pg.evaluate("app.engine.enemies.length")
        r['armor_w1'] = await pg.evaluate("app.engine.enemies[0]?.armor")
        r['hero_count_draw_ok'] = await pg.evaluate("typeof app.engine.draw === 'function'")
        await pg.screenshot(path=OUT + '_game.png')
        r['errors'] = errors[:10]
        print(json.dumps(r, ensure_ascii=False, indent=1))
        await b.close()

asyncio.run(main())
