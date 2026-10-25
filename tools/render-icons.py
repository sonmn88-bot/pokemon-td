# tools/icon-src.js 의 SVG를 assets/icons/*.png (256px, 투명배경) 로 굽는다.
# 사용: python3 tools/render-icons.py   (Playwright 필요)
import asyncio, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = subprocess.check_output(['node', '-e', "const {ICON_SRC}=require('./tools/icon-src.js');process.stdout.write(JSON.stringify(ICON_SRC))"], cwd=ROOT)
ICONS = json.loads(src)
OUT = os.path.join(ROOT, 'assets', 'icons'); os.makedirs(OUT, exist_ok=True)
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 128, 'height': 128}, device_scale_factor=2)
        for name, body in ICONS.items():
            if not body: continue
            await pg.set_content(f'<html><body style="margin:0;background:transparent"><svg id="s" xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">{body}</svg></body></html>')
            await pg.locator('#s').screenshot(path=os.path.join(OUT, name + '.png'), omit_background=True)
        await b.close()
    print('rendered', len([k for k in ICONS if ICONS[k]]))
asyncio.run(main())
