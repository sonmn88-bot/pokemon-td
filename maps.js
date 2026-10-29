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
    const ROWS = 4;                              // v3.13: 6→4줄 (한 바퀴가 너무 길어 늦게 돌아오던 문제). 짝수 → 마지막 줄이 왼쪽에서 끝남
    const top = h * 0.10, bot = h * 0.88, gap = (bot - top) / (ROWS - 1); // 기울기 맞춤 줌이 HUD~하단 바 사이에 맵을 맞추므로 세로 전체 사용
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

    // ---- 타워 자리 (균형 배치): 세로줄로 길을 훑어서 '두 길 사이 띠'마다 1/3·2/3 높이에 2줄로 지그재그 배치 ----
    // → 어느 자리든 가까운 길까지 ~70px, 먼 길까지도 사거리 안. 가로 간격은 목표 개수에 맞춰 균등.
    const target = Math.round(Math.min(52, Math.max(40, (w * h) / 22000)));
    const crossings = (x) => {
      const out = [];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) out.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x));
      }
      return out.sort((p, q) => p - q);
    };
    const ledges = []; for (let r = 0; r + 1 < ys.length; r++) ledges.push(ys[r] + (ys[r + 1] - ys[r]) * 0.8); // 테라스 절벽 y
    const place = (sp) => {
      const res = [], x0 = w * 0.12, x1 = w * 0.92; // v3.13: 맵이 좁아진 만큼 가로 범위 확대
      const n = Math.max(2, Math.round((x1 - x0) / sp) + 1);
      for (let k = 0; k < n; k++) for (const half of [0, 1]) {
        const x = x0 + (x1 - x0) * (k + half * 0.5) / (n - 0.5);
        const ys = crossings(x);
        const cand = [];
        if (ys.length && ys[0] - 72 > h * 0.03 && half === 0) cand.push(ys[0] - 72);                       // 맨 위 길 바깥 (HUD 아래만)
        if (ys.length && ys[ys.length - 1] + 72 < h * 0.97 && half === 0) cand.push(ys[ys.length - 1] + 72); // 맨 아래 길 바깥 (하단 바 위만)
        for (let j = 0; j < ys.length - 1; j++) {
          const g = ys[j + 1] - ys[j];
          if (g < 92) continue;                                                                   // 커브 안쪽 좁은 틈은 제외
          if (g < 175) { if (half === 0) cand.push(ys[j] + g / 2); }                              // 좁은 띠: 가운데 1줄
          else cand.push(ys[j] + g * (half ? 2 / 3 : 1 / 3));                                     // 넓은 띠: 2줄 지그재그
        }
        for (const y of cand) {
          const d = _distToPath(x, y, path);
          if (d < 44 || d > 120) continue;
          if (ledges.some(yb => y > yb - 24 && y < yb + 34)) continue;                             // v3.13: 절벽(단 경계) 위엔 자리 안 만듦
          if (res.every(s => (s.x - x) ** 2 + (s.y - y) ** 2 >= 56 * 56)) res.push({ x: Math.round(x), y: Math.round(y) });
        }
      }
      return res;
    };
    let slots = place(70);                          // 가로 간격을 바꿔가며 목표 개수에 가장 가까운 배치 선택
    for (let sp = 40; sp <= 400; sp += 2) { const r = place(sp); if (Math.abs(r.length - target) < Math.abs(slots.length - target)) slots = r; }
    slots.sort((a, b) => a.y - b.y || a.x - b.x);  // 위→아래 순서 (인덱스 안정)

    this._cache = { key, path, slots, ys, gap };
    return this._cache;
  },
  getPaths(w, h) { return [this.build(w, h).path]; },
  getSlots(w, h) { return this.build(w, h).slots.map(s => ({ ...s })); },
};

// ---- 값 노이즈 + fBm (지형 높낮이·색 얼룩용, 고정 시드) ----
function _vnoise(seed) {
  const rnd = _mapRng(seed), val = new Float32Array(256), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) { val[i] = rnd(); perm[i] = i; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
  const hv = (i, j) => val[perm[(perm[i & 255] + j) & 255]], sm = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
    const a = hv(xi, yi), b = hv(xi + 1, yi), c = hv(xi, yi + 1), d = hv(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function _fbm(n, x, y, oct) { let a = 0, amp = 0.5, f = 1, sum = 0; for (let o = 0; o < oct; o++) { a += amp * n(x * f + o * 17.3, y * f - o * 9.1); sum += amp; f *= 2.03; amp *= 0.5; } return a / sum; }
const _sstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---- v3.13 지형 명암 (배경 캐시에 1회): 높이맵 → 햇빛(왼쪽 위) 음영 + 골짜기 그늘 + 색 얼룩 + 바깥 비네트 ----
// 길은 바닥이 평평한 골짜기(둑이 있는 길), 타워 자리는 살짝 볼록 → 빛 방향에 따라 둑의 한쪽은 밝고 한쪽은 그늘.
// M: 맵 바깥 여백(원근으로 보이는 가장자리까지 땅이 이어지게)
function drawNaturalTerrain(ctx, w, h, map, M = 0) {
  const L = NaturalLayout.build(w, h), path = L.path, slots = L.slots;
  const pw = map.pathWidth || 30, pathS = path.filter((_, i) => i % 2 === 0);
  const nz = _vnoise(1234), nz2 = _vnoise(4321);
  const x0 = -M, y0 = -M, S = 6, gw = Math.ceil((w + 2 * M) / S) + 1, gh = Math.ceil((h + 2 * M) / S) + 1;
  const Hm = new Float32Array(gw * gh), r0 = pw * 0.5 + 1, r1 = r0 + 24;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = x0 + gx * S, y = y0 + gy * S;
    let v = (_fbm(nz, x / 210, y / 210, 4) - 0.5) * 2.0;                 // 완만한 언덕
    const d = _distToPath(x, y, pathS);
    v -= 0.62 * (1 - _sstep(r0, r1, d));                                   // 길 골짜기(평평한 바닥 + 둑)
    for (const s of slots) { const d2 = (x - s.x) ** 2 + (y - s.y) ** 2; if (d2 < 2500) v += 0.16 * Math.exp(-d2 / 700); }
    Hm[gy * gw + gx] = v;
  }
  // 햇빛: 왼쪽 위에서 비스듬히 (x 오른쪽, y 아래, z 위)
  const lx = -0.55, ly = -0.62, lz = 0.56, ll = Math.hypot(lx, ly, lz), Lx = lx / ll, Ly = ly / ll, Lz = lz / ll, Z = 34 / (2 * S);
  const shadeC = document.createElement('canvas'), aoC = document.createElement('canvas'), colC = document.createElement('canvas');
  for (const c of [shadeC, aoC, colC]) { c.width = gw; c.height = gh; }
  const sI = shadeC.getContext('2d').createImageData(gw, gh), aI = aoC.getContext('2d').createImageData(gw, gh), cI = colC.getContext('2d').createImageData(gw, gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const i = gy * gw + gx, k = i * 4, v = Hm[i];
    const dx = (Hm[gy * gw + Math.min(gw - 1, gx + 1)] - Hm[gy * gw + Math.max(0, gx - 1)]) * Z;
    const dy = (Hm[Math.min(gh - 1, gy + 1) * gw + gx] - Hm[Math.max(0, gy - 1) * gw + gx]) * Z;
    const nl = Math.hypot(dx, dy, 1), lam = (-dx * Lx - dy * Ly + Lz) / nl - Lz;   // 평지 대비 밝기 차
    const g = Math.max(0, Math.min(255, 128 + lam * 170));
    sI.data[k] = g; sI.data[k + 1] = g; sI.data[k + 2] = g; sI.data[k + 3] = 255;
    const ao = Math.max(0, Math.min(1, -v * 0.55));                                  // 낮은 곳일수록 어둡게(습하고 그늘진 골짜기)
    const m = 255 - ao * 45; aI.data[k] = m; aI.data[k + 1] = m; aI.data[k + 2] = m + ao * 12; aI.data[k + 3] = 255;
    // 색 얼룩: 마른 풀(노란 연두) / 짙은 풀 / 높은 곳은 햇빛에 바랜 밝은 풀
    const n = _fbm(nz2, (x0 + gx * S) / 300, (y0 + gy * S) / 300, 3);
    const dry = _sstep(0.56, 0.74, n), lush = _sstep(0.44, 0.27, n), hi = Math.max(0, Math.min(1, v * 0.8));
    const aDry = dry * 0.26 + hi * 0.10, aLush = lush * 0.30;
    if (aDry >= aLush) { cI.data[k] = 196; cI.data[k + 1] = 182; cI.data[k + 2] = 92; cI.data[k + 3] = aDry * 255; }
    else { cI.data[k] = 22; cI.data[k + 1] = 58; cI.data[k + 2] = 26; cI.data[k + 3] = aLush * 255; }
  }
  shadeC.getContext('2d').putImageData(sI, 0, 0); aoC.getContext('2d').putImageData(aI, 0, 0); colC.getContext('2d').putImageData(cI, 0, 0);
  const W2 = gw * S, H2 = gh * S;
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(colC, x0, y0, W2, H2);
  ctx.globalCompositeOperation = 'soft-light'; ctx.drawImage(shadeC, x0, y0, W2, H2);
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(aoC, x0, y0, W2, H2);
  // 햇빛 쪽(왼쪽 위) 따뜻한 빛 + 반대쪽은 차분하게
  ctx.globalCompositeOperation = 'soft-light';
  const sun = ctx.createRadialGradient(w * 0.05, -h * 0.05, 0, w * 0.05, -h * 0.05, Math.hypot(w, h) * 1.1);
  sun.addColorStop(0, 'rgba(255,226,160,0.9)'); sun.addColorStop(0.5, 'rgba(255,226,160,0.25)'); sun.addColorStop(1, 'rgba(40,60,90,0.5)');
  ctx.fillStyle = sun; ctx.fillRect(x0, y0, w + 2 * M, h + 2 * M);
  // 맵 바깥 여백은 점점 어둡게(시선이 판 안으로)
  ctx.globalCompositeOperation = 'source-over';
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.55, w / 2, h / 2, Math.hypot(w, h) * 0.62 + M);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,14,4,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(x0, y0, w + 2 * M, h + 2 * M);
  ctx.restore();

  // 소품 그림자·바닥 데칼은 평평하니 여기서 구움 (서 있는 본체는 엔진이 그림)
  const P = buildMapProps(w, h, map);
  ctx.save();
  for (const d of P.decals) { const im = _propCanvas(d.key, d.w, d.h, d.filter); if (!im) continue; ctx.globalAlpha = d.a; ctx.drawImage(im, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h); }
  ctx.globalAlpha = 1;
  const soft = (cx, cy, rx, ry, a) => { // 가장자리가 부드러운 타원 그림자 (filter 없이 — 사파리 호환)
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(8,16,4,${a})`); g.addColorStop(0.6, `rgba(8,16,4,${a * 0.6})`); g.addColorStop(1, 'rgba(8,16,4,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  for (const o of P.props) {
    if (o.h > 60) soft(o.x + o.w * 0.38, o.y + o.w * 0.08, o.w * 0.62, o.w * 0.26, 0.34); // 나무: 햇빛 반대쪽(오른쪽 아래)으로 드리운 그림자
    soft(o.x + o.w * 0.06, o.y + 1, o.w * 0.5, Math.max(3, o.w * 0.14), 0.42);             // 밑동 접지 그림자
  }
  ctx.restore();
}

// ===== v3.13 소품(3/4 시점): CC0 Glitch 아트 스프라이트를 테마별로 배치 =====
// h: 월드 기준 높이(px). 큰 나무는 가장자리·빈터, 덤불/바위는 길 앞쪽에 붙여 길이 살짝 가려지게(깊이감)
const PROP_SETS = {
  forest: {
    tree: [['tree_oak', 112], ['tree_oak', 124], ['tree_pine', 126], ['tree_pine', 112], ['tree_oak', 100]],
    farTree: [['tree_oak', 96], ['tree_oak', 84], ['tree_pine', 110], ['tree_oak', 104], ['bush_tall', 34]],
    bush: [['bush_a', 26], ['bush_b', 24], ['bush_tall', 28], ['bush_a', 22], ['bush_b', 20]],
    under: [['mush_red', 14], ['mush_hood', 15], ['flowers', 18]],
    flower: [['flowers', 20], ['flower_bush2', 24], ['flower_bush', 30], ['flowers', 16]],
    rock: [['rock_mound', 22, 'dark:0.18'], ['rock_mound', 17, 'dark:0.2'], ['rock_dull', 11, 'dark:0.4,30,26,14']],
    grass: [['pampas', 30], ['pampas2', 32]],
    decal: [['decal_flowers', 8]],
  },
  volcano: {
    filter: 'brightness(0.45) sepia(0.6) saturate(1.6) hue-rotate(-15deg)',
    big: [['tree_bare', 112], ['stalagmite', 78], ['tree_bare', 96], ['stalagmite', 64], ['rock_mound', 44]],
    mid: [['rock_mound', 30], ['dirt_mound', 30], ['stalagmite', 40], ['rock_dull', 18], ['pampas2', 36]],
    edge: [['rock_mound', 24], ['dirt_mound', 24], ['rock_dull', 15], ['rock_mound', 20]],
    small: [['rock_dull', 11], ['dirt_mound', 12]],
    decal: [],
  },
  cave: {
    filter: 'brightness(0.5) sepia(0.4) hue-rotate(215deg) saturate(0.9)',
    big: [['stalagmite', 92], ['crystal_c', 56], ['stalagmite', 76], ['crystal_a', 44], ['stalagmite', 64]],
    mid: [['crystal_b', 24], ['mush_hood', 28], ['rock_dull', 16], ['crystal_a', 30], ['rock_mound', 26], ['stalagmite', 40]],
    edge: [['crystal_b', 20], ['rock_dull', 14], ['mush_purple', 20], ['rock_mound', 20]],
    small: [['mush_purple', 18], ['crystal_b', 14], ['rock_dull', 10]],
    decal: [],
  },
};
const PROP_NOFILTER = { crystal_a: 1, crystal_b: 1, crystal_c: 1, mush_purple: 1 };
const _propImgs = {};
function _propImg(key) {
  let im = _propImgs[key];
  if (!im) { im = _propImgs[key] = new Image(); im.onload = () => { clearTimeout(_propImgs._t); _propImgs._t = setTimeout(() => { if (window.app && app.engine) app.engine._bgDirty = true; }, 200); }; im.src = 'assets/props/' + key + '.png'; }
  return im;
}
// 미리 축소·색보정한 캔버스(매 프레임 큰 원본을 줄이며 그리지 않게). 화면 배율(줌×CSS×DPR)을 감안해 2.4배 해상도
const _propCache = {};
function _propCanvas(key, w, h, filter) {
  const ck = key + '|' + Math.round(w) + '|' + (filter || '');
  if (_propCache[ck]) return _propCache[ck];
  const im = _propImg(key);
  if (!im.complete || !im.naturalWidth) return null;
  const R = 2.4, c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w * R)); c.height = Math.max(2, Math.round(h * R));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  const dk = filter && filter.startsWith('dark:') ? filter.slice(5).split(',') : null; // 'dark:알파,r,g,b' = 원본 모양 그대로 어둡게(사파리 호환)
  if (filter && !dk) g.filter = filter;
  g.drawImage(im, 0, 0, c.width, c.height);
  if (dk) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(${dk[1] || 20},${dk[2] || 26},${dk[3] || 12},${dk[0]})`; g.fillRect(0, 0, c.width, c.height); }
  return (_propCache[ck] = c);
}
window.propCanvas = _propCanvas; window.propImg = _propImg;
const PROP_ASPECT = { bush_a:2.8, bush_b:2.59, bush_tall:1.7, bush_wide:4.27, crystal_a:1.69, crystal_b:1.13, crystal_c:0.93, decal_flowers:10.2, decal_grass:5.08, dirt_mound:1.33, flower_bush:0.78, flower_bush2:1.94, flowers:0.6, mush_hood:0.72, mush_purple:0.44, mush_red:0.74, pampas:0.69, pampas2:0.65, rock_dull:2.05, rock_dull2:4, rock_mound:2.52, rock_sparkly:3.02, stalagmite:0.63, stones:1.56, stump:1.67, tree_acacia:1.6, tree_acacia2:2.19, tree_bare:0.88, tree_oak:0.74, tree_pine:0.41 };

let _propsCache = null;
// v3.13 자연 배치: 아무 데나 뿌리지 않고 '숲이 생길 만한 곳'에만 —
//   ① 빈터(길·타워에서 먼 곳)에 나무 군락 + 밑에 덤불·버섯  ② 맵 테두리(특히 먼 쪽 위·오른쪽)는 숲 경계
//   ③ 길 굽이 바깥쪽엔 밀려난 바위·풀  ④ 곧은 길 앞 가장자리에 낮은 덤불(길이 살짝 가려지는 깊이감)  ⑤ 꽃밭 몇 군데
function buildMapProps(w, h, map) {
  const theme = (map.deco && map.deco.theme) || 'forest', set = PROP_SETS[theme];
  const key = theme + '|' + w + 'x' + h;
  if (_propsCache && _propsCache.key === key) return _propsCache;
  if (theme !== 'forest' || !set) return (_propsCache = { key, props: [], decals: [] }); // 숲 맵 확정 후 다른 맵 적용
  const L = NaturalLayout.build(w, h), slots = L.slots, path = L.path, pathS = path.filter((_, i) => i % 2 === 0);
  const rnd = _mapRng(4242), pw = map.pathWidth || 30, K = window.STAND_K || 1.24, props = [], decals = [];
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const mk = (def, sc) => { const ph = def[1] * sc; return { key: def[0], w: ph * (PROP_ASPECT[def[0]] || 1), h: ph, filter: def[2] || '' }; };
  // 타워(자리 위로 ~50px 솟음)·빈 자리를 가리지 않게
  const slotFree = (x, y, o) => !slots.some(s => Math.abs(s.x - x) < o.w * 0.45 + 22 && s.y > y - o.h * K - 30 && s.y < y + 26);
  const pathClear = (x, y, o, pad) => !pathS.some(p => Math.abs(p.x - x) < o.w * 0.42 + pad && p.y > y - o.h * K * 0.9 - pad && p.y < y + pad);
  const spaced = (x, y, o) => !props.some(q => Math.abs(q.x - x) < (q.w + o.w) * 0.3 && Math.abs(q.y - y) < 14);
  const add = (o, x, y, pad = 4) => { if (!slotFree(x, y, o) || !pathClear(x, y, o, pad) || !spaced(x, y, o)) return null; o.x = x; o.y = y; o.flip = rnd() < 0.5; props.push(o); _propImg(o.key); return o; };
  // 나무 크기를 자리에 맞춤: 뒤(위)쪽 타워 자리를 가리지 않는 최대 높이, 폭은 빈터 여유 이내. 좁으면 소나무
  const fitTree = (x, y, c) => {
    let maxH = 150;
    for (const s of slots) if (s.y < y + 26 && Math.abs(s.x - x) < 60) { if (s.y > y - 40) return null; maxH = Math.min(maxH, (y - s.y - 30) / K); }
    const def = c < 46 || rnd() < 0.4 ? ['tree_pine', 130] : ['tree_oak', 124];
    const hh = Math.min(maxH, def[1] * (0.8 + rnd() * 0.3), (c * 2.5) / (PROP_ASPECT[def[0]] || 1));
    if (hh < 58) return null;
    const t = mk(def, hh / def[1]); t._x = x; t._y = y; return t;
  };
  const clr = (x, y) => Math.min(_distToPath(x, y, pathS) - pw / 2, ...slots.map(s => Math.hypot(s.x - x, s.y - y) - 30));

  // ① 빈터 찾기: 12px 격자에서 길·타워와의 여유가 큰 곳 (국소 최대)
  const cand = [];
  for (let y = 24; y < h - 6; y += 12) for (let x = 16; x < w - 16; x += 12) { const c = clr(x, y); if (c > 22) cand.push({ x, y, c }); }
  cand.sort((a, b) => b.c - a.c);
  const groves = [];
  for (const c of cand) { if (groves.length >= 15) break; if (groves.every(g => Math.hypot(g.x - c.x, g.y - c.y) > 92)) groves.push(c); }
  const used = [];
  for (const g of groves) {
    if (g.c >= 30) {
      const t = fitTree(g.x + (rnd() - 0.5) * 10, g.y + 8, g.c);
      if (t && add(t, t._x, t._y, 6)) {
        if (g.c >= 58 && rnd() < 0.75) { const t2 = mk(pick(set.tree), 0.7 + rnd() * 0.2); add(t2, g.x + (rnd() < 0.5 ? -1 : 1) * t.w * (0.38 + rnd() * 0.15), g.y - 6 + rnd() * 10, 6); }
        for (let i = 0, n = 2 + Math.floor(rnd() * 2); i < n; i++) add(mk(pick(set.bush), 0.85 + rnd() * 0.3), g.x + (rnd() - 0.5) * t.w * 0.9, g.y + 12 + rnd() * 10);
        if (rnd() < 0.6) add(mk(pick(set.under), 0.9 + rnd() * 0.3), g.x + (rnd() - 0.5) * t.w * 0.6, g.y + 18 + rnd() * 6);
        used.push(g); continue;
      }
    }
    // 작은 빈터: 덤불 무리 + 풀
    for (let i = 0, n = 2 + Math.floor(rnd() * 2); i < n; i++) add(mk(pick(set.bush), 0.8 + rnd() * 0.3), g.x + (rnd() - 0.5) * 34, g.y + (rnd() - 0.5) * 14);
    if (rnd() < 0.5) add(mk(pick(set.grass), 0.8 + rnd() * 0.3), g.x + (rnd() - 0.5) * 30, g.y + 6);
    used.push(g);
  }
  // ② 숲 경계: 먼 쪽(위·오른쪽)은 키 큰 나무 줄, 가까운 쪽(왼쪽·아래)은 낮은 덤불만 드문드문
  // 맵 위 바깥 = 숲 가장자리: 낮은 덤불·어린 소나무만(큰 숲은 판 뒤 지평선 레이어가 그림 — 캔버스 끝에서 잘리지 않게)
  for (const y0 of [-70, -44, -18, 4]) for (let x = -40; x < w + 100; x += 16 + rnd() * 20) {
    const r = rnd(), def = r < 0.2 ? ['tree_pine', 58] : r < 0.45 ? ['bush_tall', 30] : pick(set.bush);
    add(mk(def, 0.95 + rnd() * 0.45), x, y0 + rnd() * 12, 6);
  }
  for (let y = 30; y < h * 0.85; y += 26 + rnd() * 30) add(mk(pick(set.farTree), 0.8 + rnd() * 0.35), w + 8 + rnd() * 90, y, 8);
  for (let y = 60; y < h; y += 70 + rnd() * 60) add(mk(pick(set.bush), 0.9 + rnd() * 0.3), -6 - rnd() * 30, y);
  for (let x = 0; x < w; x += 80 + rnd() * 70) add(mk(rnd() < 0.6 ? pick(set.bush) : pick(set.grass), 0.9 + rnd() * 0.3), x, h - 2 - rnd() * 8);
  // ②-b 작은 수풀 무리: 노이즈가 높은 곳에만 몰려 나게(균일하게 뿌리지 않음) — 낮아서 뒤 타워를 안 가림
  const nzP = _vnoise(77);
  for (let t = 0, n = 0; t < 1400 && n < 24; t++) {
    const x = 20 + rnd() * (w - 40), y = 20 + rnd() * (h - 30);
    if (_fbm(nzP, x / 140, y / 140, 2) < 0.54 || clr(x, y) < 12) continue;
    let k = 0;
    for (let i = 0, m = 2 + Math.floor(rnd() * 3); i < m; i++) {
      const r = rnd(), def = r < 0.45 ? pick(set.bush) : r < 0.65 ? pick(set.grass) : r < 0.85 ? pick(set.flower) : set.rock[1];
      if (add(mk(def, 0.7 + rnd() * 0.3), x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 16)) k++;
    }
    if (k) n++;
  }
  // ③ 길 굽이 바깥: 밀려난 바위 무리 / ④ 곧은 구간 앞 가장자리: 낮은 덤불·풀
  let skip = 0, nextEdge = 90;
  for (let i = 8, acc = 0; i < path.length - 8; i++) {
    const a = path[i - 8], p = path[i], b = path[i + 8];
    const a1 = Math.atan2(p.y - a.y, p.x - a.x), a2 = Math.atan2(b.y - p.y, b.x - p.x);
    let turn = a2 - a1; while (turn > Math.PI) turn -= 2 * Math.PI; while (turn < -Math.PI) turn += 2 * Math.PI;
    acc += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y);
    if (skip > 0) { skip--; continue; }
    if (Math.abs(turn) > 0.9) {                                   // 굽이: 바깥쪽 법선
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, sgn = turn > 0 ? 1 : -1;
      const nx = (ty / tl) * sgn, ny = (-tx / tl) * sgn, d = pw / 2 + 12;
      const cx = p.x + nx * d, cy = p.y + ny * d;
      if (add(mk(set.rock[0], 0.9 + rnd() * 0.3), cx, cy, 2)) {
        add(mk(set.rock[2], 0.9 + rnd() * 0.4), cx + 14 + rnd() * 6, cy + 4, 2);
        if (rnd() < 0.6) add(mk(pick(set.grass), 0.75 + rnd() * 0.2), cx - 16 - rnd() * 6, cy - 2, 2);
      }
      skip = 40; continue;
    }
    if (acc > nextEdge && Math.abs(b.y - a.y) < Math.abs(b.x - a.x) * 0.5) {   // 가로 구간 앞(아래) 가장자리
      nextEdge = acc + 120 + rnd() * 140;
      if (rnd() < 0.7) add(mk(rnd() < 0.7 ? pick(set.bush) : pick(set.grass), 0.75 + rnd() * 0.25), p.x + (rnd() - 0.5) * 12, p.y + pw / 2 + 4 + rnd() * 4, 0);
    }
  }
  // ⑤ 꽃밭: 나무 군락과 떨어진 중간 빈터 3곳
  let meadows = 0;
  for (const c of cand) {
    if (meadows >= 3) break;
    if (c.c > 40 || used.some(g => Math.hypot(g.x - c.x, g.y - c.y) < 90)) continue;
    used.push(c); meadows++;
    for (let i = 0, n = 3 + Math.floor(rnd() * 3); i < n; i++) add(mk(pick(set.flower), 0.8 + rnd() * 0.3), c.x + (rnd() - 0.5) * 44, c.y + (rnd() - 0.5) * 20, 2);
    for (let i = 0; i < 2; i++) { const o = mk(set.decal[0], 0.9 + rnd() * 0.4); o.x = c.x + (rnd() - 0.5) * 40; o.y = c.y + (rnd() - 0.5) * 18; o.a = 0.8; decals.push(o); _propImg(o.key); }
  }
  // 길(적이 지나는 곳)이 소품 뒤에 있을 때만 매 프레임 깊이 정렬 대상(dyn), 나머지는 배경에 1회 구움 (발열)
  for (const o of props) o.dyn = pathS.some(p => Math.abs(p.x - o.x) < o.w / 2 + 12 && p.y < o.y && p.y > o.y - o.h * K - 8);
  props.sort((a, b) => a.y - b.y);
  return (_propsCache = { key, props, decals });
}
window.buildMapProps = buildMapProps;

const MapDefs = {
  // ===== 1. 태초마을 숲 =====
  forest: {
    name:'태초마을 숲',
    bgColor:'#2a5418',
    // 실사 잔디/흙길 텍스처 (Cethiel, CC0 - opengameart.org)
    bgTextures:['assets/terrain/grass_a.jpg','assets/terrain/grass_b.jpg'], // v3.13 CC0 손그림 잔디
    bgTileSize:300,
    pathTextures:['assets/terrain/cobble.jpg'], // CC0 손그림 자갈 돌바닥
    pathTileSize:96, trees:true, haze:'150,178,172',
    horizon:[['tree_oak', 120], ['tree_pine', 150], ['tree_oak', 104], ['tree_pine', 128], ['tree_acacia', 80]], // 판 뒤 지평선 숲
    pathColor:'#c8a44a', pathColorDark:'#5a4320',
    pathArrow:'rgba(255,225,150,0.20)', pathWidth:30, rim:'#6b5a3e', rimLight:'#a8916a',
    deco:{ big:['pine','tree','rock'], small:['bush','flower','grass'], theme:'forest' },
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h,M){ drawNaturalTerrain(ctx,w,h,this,M); },
  },

  // ===== 2. 홍련체육관 도시 (화산 지대) =====
  city: {
    name:'홍련체육관 도시',
    bgColor:'#180600',
    bgTextures:['assets/textures/lava_01.jpg','assets/textures/lava_02.jpg'],
    bgTileSize:420,
    pathTextures:['assets/terrain/rock.jpg'],
    pathTileSize:90, pathTint:'rgba(40,12,0,0.30)', bgDim:0.5, haze:'64,30,22', soilColor:a=>`rgba(24,10,6,${a*1.6})`,
    pathColor:'#6b4428', pathColorDark:'#2a1206',
    pathArrow:'rgba(255,160,90,0.22)', pathWidth:30, rim:'#3a2618', rimLight:'#7a5232', cliffTop:'rgba(40,18,8,0.9)', cliffLight:'rgba(255,140,60,0.35)', rockDark:'#2e1d16', rockLight:'#6e4a36',
    deco:{ big:['rock','spire'], small:['ember','pebble','crack'], theme:'volcano' },
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h,M){ drawNaturalTerrain(ctx,w,h,this,M); },
  },

  // ===== 3. 라벤더 동굴 =====
  cave: {
    name:'라벤더 동굴',
    bgColor:'#050210',
    bgImage:'assets/textures/cave_bg.jpg',
    pathTextures:['assets/terrain/slate.jpg'],
    pathTileSize:110, pathTint:'rgba(28,18,60,0.50)', haze:'30,26,52', soilColor:a=>`rgba(14,8,30,${a*1.6})`,
    pathColor:'#3e2860', pathColorDark:'#160b26',
    pathArrow:'rgba(190,160,255,0.20)', pathWidth:30, rim:'#2b2040', rimLight:'#5e4a86', cliffTop:'rgba(20,10,40,0.9)', cliffLight:'rgba(190,160,255,0.35)', rockDark:'#26203a', rockLight:'#5a4f7a',
    ghostBonus:0.30,
    deco:{ big:['crystal','rock'], small:['crystal_s','pebble','glow'], theme:'cave' },
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h,M){ drawNaturalTerrain(ctx,w,h,this,M); },
  },
};
