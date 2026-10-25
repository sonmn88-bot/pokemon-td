import asyncio, sys, json
from playwright.async_api import async_playwright
URL, OUT = sys.argv[1], sys.argv[2]

async def run(p, hero):
    errors = []
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    await pg.goto(URL)
    await pg.click('#btn-start')
    await pg.click(f'[data-hero="{hero}"]')
    await pg.click('#btn-endless-start')
    await pg.wait_for_timeout(400)
    await pg.evaluate("document.querySelector('.skin-picker div[style*=\"cursor\"]')?.click()")
    r = {'hero': hero}
    # 영웅 배치 + 타워 몇 개 + 전기타워
    await pg.evaluate(f"""(()=>{{
      const e=app.engine; e.gold=99999;
      app.placingHero='{hero}';
      app.engine.handleTap(e.width/2, e.height/2);
      const ids=['magnemite','magneton','zapdos','charmander','squirtle','magnemite','magnemite'];
      ids.forEach((id,k)=>{{ const i=e.towerSlots.findIndex(s=>!s.occupied); app._placePulledTower({{...GachaTowerDefs[id]}}, i); }});
    }})()""")
    r['hero_placed'] = await pg.evaluate("app.engine.heroes.length")
    # 레벨 25 만들고 SP 전부 찍기 (갈래 0,1 완주 + 갈래2 두 단계)
    await pg.evaluate("""(()=>{ const h=app.engine.heroes[0]; h.gainExp(1e9, app.engine);
      if (h.evolutionPending) h.evolve(h.def.evolution.options[0].id, app.engine); })()""")
    r['level'] = await pg.evaluate("app.engine.heroes[0].level")
    r['sp'] = await pg.evaluate("app.engine.heroes[0].skillPoints")
    r['evolved'] = await pg.evaluate("app.engine.heroes[0].evolved || null")
    await pg.evaluate("document.querySelector('.skin-picker')?.remove(); app.engine.start && app.engine.start();")
    await pg.evaluate("app.openSkillTree(app.engine.heroes[0])")
    await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'{OUT}_{hero}_tree0.png')
    order = await pg.evaluate("""(()=>{ const t=SkillTrees[app.engine.heroes[0].id]; const o=[];
      for (const b of [0,1]) for (let k=1;k<=4;k++) o.push(t.nodes.find(n=>n.branch===b&&n.tier===k).id);
      for (let k=1;k<=2;k++) o.push(t.nodes.find(n=>n.branch===2&&n.tier===k).id); return o; })()""")
    for nid in order:
        await pg.evaluate(f"document.querySelector('.st2-node[data-id=\"{nid}\"]').click()")
    r['unlocked'] = await pg.evaluate("app.engine.heroes[0].unlockedSkills.size")
    r['sp_left'] = await pg.evaluate("app.engine.heroes[0].skillPoints")
    # 잠긴 노드 탭(3갈래 3단계) → 안내만, 언락 안 됨
    lock = await pg.evaluate("SkillTrees[app.engine.heroes[0].id].nodes.find(n=>n.branch===2&&n.tier===4).id")
    await pg.evaluate(f"document.querySelector('.st2-node[data-id=\"{lock}\"]').click()")
    r['locked_stays_locked'] = await pg.evaluate(f"!app.engine.heroes[0].unlockedSkills.has('{lock}')")
    await pg.screenshot(path=f'{OUT}_{hero}_tree.png')
    await pg.evaluate("document.querySelector('.skilltree-overlay')?.remove()")
    # 웨이브 + 스킬 사용
    await pg.evaluate("document.querySelector('.speed-btn[data-speed=\"3\"]').click(); app.sendWave()")
    await pg.wait_for_timeout(2500)
    await pg.evaluate("const h=app.engine.heroes[0]; h.cast(0, app.engine); h.cast(1, app.engine);")
    await pg.wait_for_timeout(1500)
    r['tower_heroMuls'] = await pg.evaluate("app.engine.towers.slice(0,4).map(t=>[t._gachaId, +(t._heroDmgMul||1).toFixed(2), +(t._heroSpeedMul||1).toFixed(2)])")
    r['hero_dmg'] = await pg.evaluate("Math.round(app.engine.heroes[0].attackDamage)")
    r['engine_hooks'] = await pg.evaluate("({gold:app.engine._togepiGoldMul, cap:app.engine._interestCapBonus, jump:app.engine._mergeJumpChance, pity:app.engine._pityWeight, free:app.engine._freePullEvery, miracle:app.engine._miracle})")
    r['cooldowns'] = await pg.evaluate("app.engine.heroes[0].cooldowns.map(c=>Math.round(c))")
    r['errors'] = errors[:6]
    await b.close()
    return r

async def main():
    async with async_playwright() as p:
        for h in ['pikachu', 'togepi', 'eevee']:
            print(json.dumps(await run(p, h), ensure_ascii=False))

asyncio.run(main())
