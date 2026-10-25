// ===== MAPS.JS - 맵 3종 (v3.0 자연 지형 리뉴얼) =====
// 세 맵은 같은 지형 배치(길·타워 자리)를 공유 → 존이 바뀌어도 타워 위치가 그대로 유지됨.
// 바뀌는 건 바닥 텍스처·색·장식뿐.
//
// 길: 직각 지그재그 대신, 구불구불한 산길처럼 '흔들리는 제어점 + 부드러운 곡선(Catmull-Rom)'으로 만든 순환 트랙.
//     줄 간격·커브 위치·흔들림이 고정 시드로 매번 같게 나옴(랜덤이지만 판마다 동일 → 공정).
// 타워 자리: 격자 대신 길 근처 '쓸모 있는 거리' 안에서 서로 일정 간격을 두고 자연스럽게 흩뿌림.
// 높낮이: 길은 골짜기(낮음), 타워 자리는 작은 언덕(높음) + 완만한 노이즈 → 음영(힐셰이드)으로 표현.

// ---- 고정 시드 난수 ----
function _mapRng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---- 닫힌 Catmull-Rom 곡선 → 촘촘한 꺾은선 (적 이동 로직은 꺾은선 그대로 사용) ----
function _closedSpline(ctrl, step) {
  const n = ctrl.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    const seg = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2*p1.x + (-p0.x + p2.x)*t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*t2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*t3),
        y: 0.5 * (2*p1.y + (-p0.y + p2.y)*t + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*t2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*t3),
      });
    }
  }
  out.push({ ...out[0] }); // 루프 닫기 (마지막 점 = 첫 점)
  return out;
}

// 점 → 꺾은선 최단거리
function _distToPath(x, y, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dy = b.y - a.y, L = dx*dx + dy*dy;
    let t = L ? ((x - a.x)*dx + (y - a.y)*dy) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = a.x + dx*t - x, ey = a.y + dy*t - y, d = ex*ex + ey*ey;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ---- 공통 지형 (w,h = 월드 크기). 같은 크기면 캐시 재사용 ----
const NaturalLayout = {
  _cache: null,
  build(w, h) {
    const key = Math.round(w) + 'x' + Math.round(h);
    if (this._cache && this._cache.key === key) return this._cache;
    const rnd = _mapRng(20261025);
    const ROWS = 6;                              // 구불구불한 가로 줄 수 (짝수 → 마지막 줄이 왼쪽에서 끝남)
    const top = h * 0.12, bot = h * 0.88, gap = (bot - top) / (ROWS - 1);
    const corridorX = w * 0.055;                 // 왼쪽 복귀로
    const leftTurn = w * 0.19, rightTurn = w * 0.90;
    const ys = [];
    for (let r = 0; r < ROWS; r++) ys.push(top + gap * r + (r > 0 && r < ROWS - 1 ? (rnd() - 0.5) * gap * 0.38 : 0));

    const ctrl = [];
    for (let r = 0; r < ROWS; r++) {
      const ltr = r % 2 === 0;
      const y = ys[r];
      const xs = ltr ? (r === 0 ? corridorX + w*0.05 : leftTurn) : rightTurn - rnd() * w * 0.10;
      const xe = ltr ? rightTurn - rnd() * w * 0.10 : (r === ROWS - 1 ? corridorX + w*0.06 : leftTurn + rnd() * w * 0.08);
      const MID = 4;                             // 줄 하나에 흔들림 점 3개 → 언덕을 휘감는 느낌
      for (let k = 0; k <= MID + 1; k++) {
        const t = k / (MID + 1);
        const wob = (k === 0 || k === MID + 1) ? 0 : (rnd() - 0.5) * gap * 0.62;
        ctrl.push({ x: xs + (xe - xs) * (t + (k && k <= MID ? (rnd() - 0.5) * 0.08 : 0)), y: y + wob });
      }
      if (r < ROWS - 1) {                        // 다음 줄로 넘어가는 둥근 커브 꼭짓점
        const midY = (y + ys[r + 1]) / 2;
        ctrl.push(ltr ? { x: Math.min(w * 0.955, xe + gap * 0.42), y: midY } : { x: Math.max(corridorX + w*0.085, xe - gap * 0.42), y: midY });
      }
    }
    // 왼쪽 복귀로: 아래 → 위, 살짝 휘어짐
    ctrl.push({ x: corridorX, y: bot + gap * 0.18 });
    for (let k = 1; k <= 3; k++) ctrl.push({ x: corridorX + (rnd() - 0.5) * w * 0.022, y: bot - (bot - top) * k / 4 });
    ctrl.push({ x: corridorX, y: top - gap * 0.18 });

    const path = _closedSpline(ctrl, 7);

    // ---- 타워 자리: 길에서 40~105px, 서로 64px 이상, 길이 많이 지나가는 곳(커버리지) 우선 ----
    const target = Math.round(Math.min(50, Math.max(38, (w * h) / 23000)));
    const cand = [];
    for (let y = 40; y < h - 40; y += 13) for (let x = 40; x < w - 40; x += 13) {
      const px = x + (rnd() - 0.5) * 10, py = y + (rnd() - 0.5) * 10;
      const d = _distToPath(px, py, path);
      if (d < 42 || d > 105) continue;
      let near = 0;                               // 사거리(~150) 안에 지나가는 길 점 수 = 쓸모
      for (let i = 0; i < path.length; i += 3) { const q = path[i]; if ((q.x-px)**2 + (q.y-py)**2 < 22500) near++; }
      cand.push({ x: px, y: py, score: near * (0.75 + rnd() * 0.5) - Math.abs(d - 64) * 0.4 });
    }
    cand.sort((a, b) => b.score - a.score);
    const slots = [];
    for (const c of cand) {
      if (slots.length >= target) break;
      if (slots.every(s => (s.x - c.x)**2 + (s.y - c.y)**2 >= 64*64)) slots.push({ x: Math.round(c.x), y: Math.round(c.y) });
    }
    slots.sort((a, b) => a.y - b.y || a.x - b.x);  // 위→아래 순서 (인덱스 안정)

    this._cache = { key, path, slots, ys, gap };
    return this._cache;
  },
  getPaths(w, h) { return [this.build(w, h).path]; },
  getSlots(w, h) { return this.build(w, h).slots.map(s => ({ ...s })); },
};

// ---- 높낮이 음영 + 자연 장식 (배경 캐시에 1회만 그림) ----
function drawNaturalTerrain(ctx, w, h, map) {
  const L = NaturalLayout.build(w, h), path = L.path, slots = L.slots;
  const rnd = _mapRng(777);
  // 1) 높이맵 (저해상도) - 노이즈 언덕 + 타워 자리 둔덕 + 길 골짜기
  const S = 8, gw = Math.ceil(w / S) + 1, gh = Math.ceil(h / S) + 1;
  const H = new Float32Array(gw * gh);
  const blobs = [];
  for (let i = 0; i < 26; i++) blobs.push({ x: rnd() * w, y: rnd() * h, r: 90 + rnd() * 220, a: (rnd() - 0.35) * 1.1 });
  const pathS = path.filter((_, i) => i % 2 === 0);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = gx * S, y = gy * S;
    let v = 0;
    for (const b of blobs) { const d2 = (x - b.x)**2 + (y - b.y)**2; v += b.a * Math.exp(-d2 / (2 * b.r * b.r)); }
    for (const s of slots) { const d2 = (x - s.x)**2 + (y - s.y)**2; if (d2 < 3600) v += 0.32 * Math.exp(-d2 / 900); }
    const dp = _distToPath(x, y, pathS);
    v -= 0.9 * Math.exp(-(dp * dp) / (2 * 38 * 38));
    H[gy * gw + gx] = v;
  }
  // 2) 힐셰이드: 왼쪽 위에서 빛 → 밝은 면/그늘, 낮은 곳은 살짝 더 어둡게
  const sc = document.createElement('canvas'); sc.width = gw; sc.height = gh;
  const sctx = sc.getContext('2d'), img = sctx.createImageData(gw, gh), D = img.data;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx;
    const dx = H[gy * gw + Math.min(gw - 1, gx + 1)] - H[gy * gw + Math.max(0, gx - 1)];
    const dy = H[Math.min(gh - 1, gy + 1) * gw + gx] - H[Math.max(0, gy - 1) * gw + gx];
    const shade = (-dx - dy) * 3.2;               // 빛 방향 (-1,-1)
    const low = Math.max(0, -H[i]) * 0.22;        // 골짜기 그늘
    const lit = shade > 0;
    const a = Math.min(0.42, Math.abs(shade) * 0.5 + (lit ? 0 : low));
    D[i*4] = lit ? 255 : 10; D[i*4+1] = lit ? 244 : 12; D[i*4+2] = lit ? 214 : 20;
    D[i*4+3] = Math.round((lit ? a * 0.16 : Math.min(0.5, a + low)) * 255);
  }
  sctx.putImageData(img, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sc, 0, 0, gw * S, gh * S);
  // 등고선 느낌의 아주 옅은 높은 지대 하이라이트
  for (const b of blobs) if (b.a > 0.45) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 0.8);
    g.addColorStop(0, 'rgba(255,240,200,0.06)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  ctx.restore();

  // 3) 자연 장식 - 길·타워 자리를 피해서, 높은 곳엔 큰 것(나무/바위), 낮은 곳엔 작은 것(풀/꽃)
  const deco = map.deco || [];
  if (!deco.length) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const count = Math.round((w * h) / 9000);
  for (let n = 0, tries = 0; n < count && tries < count * 6; tries++) {
    const x = 14 + rnd() * (w - 28), y = 14 + rnd() * (h - 28);
    if (_distToPath(x, y, pathS) < 34) continue;
    if (slots.some(s => (s.x - x)**2 + (s.y - y)**2 < 40*40)) continue;
    const hv = H[Math.round(y / S) * gw + Math.round(x / S)] || 0;
    const big = deco.filter(d => d[2] === 'big'), small = deco.filter(d => d[2] !== 'big');
    const pool = hv > 0.25 && big.length ? big : small.length ? small : big;
    const [em, size] = pool[Math.floor(rnd() * pool.length)];
    const sz = size * (0.75 + rnd() * 0.5);
    ctx.globalAlpha = 0.22; ctx.font = `${sz}px serif`; ctx.fillText(em, x + sz * 0.12, y + sz * 0.18); // 그림자
    ctx.globalAlpha = 0.55 + rnd() * 0.35; ctx.fillText(em, x, y);
    n++;
  }
  ctx.restore();
}

const MapDefs = {
  // ===== 1. 태초마을 숲 =====
  forest: {
    name:'태초마을 숲',
    bgColor:'#2a5418',
    // 실사 잔디/흙길 텍스처 (Cethiel, CC0 - opengameart.org)
    bgTextures:['assets/textures/grass_01.jpg','assets/textures/grass_02.jpg','assets/textures/grass_03.jpg','assets/textures/grass_04.jpg'],
    bgTileSize:280,
    pathTextures:['assets/textures/dirt_02.jpg','assets/textures/dirt_03.jpg'],
    pathTileSize:44,
    pathColor:'#c8a44a', pathColorDark:'#5a4320',
    pathArrow:'rgba(255,225,150,0.20)', pathWidth:22,
    deco:[['🌲',30,'big'],['🌳',28,'big'],['🪨',18,'big'],['🌿',13],['🌼',11],['🍄',12],['🌱',11]],
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h){ drawNaturalTerrain(ctx,w,h,this); },
  },

  // ===== 2. 홍련체육관 도시 (화산 지대) =====
  city: {
    name:'홍련체육관 도시',
    bgColor:'#180600',
    bgTextures:['assets/textures/lava_01.jpg','assets/textures/lava_02.jpg'],
    bgTileSize:420,
    pathTextures:['assets/textures/brick_02.jpg','assets/textures/brick_03.jpg'],
    pathTileSize:46,
    pathColor:'#6b4428', pathColorDark:'#2a1206',
    pathArrow:'rgba(255,160,90,0.22)', pathWidth:22,
    deco:[['🌋',30,'big'],['🪨',20,'big'],['🔥',14],['🪨',12],['🏮',13]],
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h){ drawNaturalTerrain(ctx,w,h,this); },
  },

  // ===== 3. 라벤더 동굴 =====
  cave: {
    name:'라벤더 동굴',
    bgColor:'#050210',
    bgImage:'assets/textures/cave_bg.jpg',
    pathTextures:['assets/textures/ground_01.jpg','assets/textures/ground_02.jpg'],
    pathTileSize:48,
    pathColor:'#3e2860', pathColorDark:'#160b26',
    pathArrow:'rgba(190,160,255,0.20)', pathWidth:22,
    ghostBonus:0.30,
    deco:[['🪨',22,'big'],['🪦',18,'big'],['💎',12],['🍄',12],['🦴',11],['🕯️',12]],
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h){ drawNaturalTerrain(ctx,w,h,this); },
  },
};
