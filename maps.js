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

  // 3) v3.13 소품 그림자·바닥 데칼은 평평하니 배경 캐시에 구움 (서 있는 소품 본체는 엔진이 유닛과 함께 앞뒤 정렬해서 그림)
  const P = buildMapProps(w, h, map);
  ctx.save();
  for (const d of P.decals) { const im = _propCanvas(d.key, d.w, d.h, d.filter); if (!im) continue; ctx.globalAlpha = d.a; ctx.drawImage(im, d.x - d.w / 2, d.y - d.h / 2, d.w, d.h); }
  ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (const o of P.props) { ctx.beginPath(); ctx.ellipse(o.x + o.w * 0.06, o.y - 1, o.w * 0.44, Math.max(3, o.w * 0.11), 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// ===== v3.13 소품(3/4 시점): CC0 Glitch 아트 스프라이트를 테마별로 배치 =====
// h: 월드 기준 높이(px). 큰 나무는 가장자리·빈터, 덤불/바위는 길 앞쪽에 붙여 길이 살짝 가려지게(깊이감)
const PROP_SETS = {
  forest: {
    big: [['tree_oak', 118], ['tree_pine', 128], ['tree_oak', 100], ['tree_pine', 110], ['tree_oak', 132], ['tree_acacia', 74]],
    mid: [['bush_a', 30], ['bush_b', 27], ['bush_tall', 32], ['flower_bush', 38], ['flower_bush2', 28], ['pampas', 42], ['pampas2', 44], ['rock_mound', 26], ['bush_a', 26], ['bush_tall', 28]],
    edge: [['bush_a', 26], ['bush_b', 24], ['bush_wide', 20], ['flower_bush2', 24], ['rock_mound', 22, 'brightness(0.85)'], ['pampas', 34], ['bush_tall', 26]],
    small: [['mush_red', 16], ['flowers', 22], ['rock_dull', 12, 'brightness(0.62) sepia(0.3)'], ['flowers', 18]],
    decal: [['decal_flowers', 9]],
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
  if (filter) g.filter = filter;
  g.drawImage(im, 0, 0, c.width, c.height);
  return (_propCache[ck] = c);
}
window.propCanvas = _propCanvas;
const PROP_ASPECT = { bush_a:2.8, bush_b:2.59, bush_tall:1.7, bush_wide:4.27, crystal_a:1.69, crystal_b:1.13, crystal_c:0.93, decal_flowers:10.2, decal_grass:5.08, dirt_mound:1.33, flower_bush:0.78, flower_bush2:1.94, flowers:0.6, mush_hood:0.72, mush_purple:0.44, mush_red:0.74, pampas:0.69, pampas2:0.65, rock_dull:2.05, rock_dull2:4, rock_mound:2.52, rock_sparkly:3.02, stalagmite:0.63, stones:1.56, stump:1.67, tree_acacia:1.6, tree_acacia2:2.19, tree_bare:0.88, tree_oak:0.74, tree_pine:0.41 };

let _propsCache = null;
function buildMapProps(w, h, map) {
  const theme = (map.deco && map.deco.theme) || 'forest', set = PROP_SETS[theme] || PROP_SETS.forest;
  const key = theme + '|' + w + 'x' + h;
  if (_propsCache && _propsCache.key === key) return _propsCache;
  const L = NaturalLayout.build(w, h), slots = L.slots, path = L.path, pathS = path.filter((_, i) => i % 2 === 0);
  const rnd = _mapRng(theme === 'forest' ? 4242 : theme === 'cave' ? 9191 : 6161);
  const pw = map.pathWidth || 30, props = [], decals = [];
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const mk = (def, sc) => { const ph = def[1] * sc, w2 = ph * (PROP_ASPECT[def[0]] || 1); return { key: def[0], w: w2, h: ph, f: def[2] }; };
  // 타워(자리 위로 ~45px 솟음)를 가리지 않게: 소품이 서 있는 박스와 슬롯이 겹치면 탈락
  const slotFree = (x, y, o) => !slots.some(s => Math.abs(s.x - x) < o.w / 2 + 20 && s.y > y - o.h * (window.STAND_K || 1.13) - 26 && s.y < y + 30);
  const pathClear = (x, y, o, pad) => !pathS.some(p => Math.abs(p.x - x) < o.w / 2 + pad && p.y > y - o.h * 1.13 - pad && p.y < y + pad);
  const spaced = (x, y, o, k) => !props.some(q => Math.abs(q.x - x) < (q.w + o.w) * k && Math.abs(q.y - y) < Math.max(10, (q.h + o.h) * 0.18));
  const add = (o, x, y) => { o.x = x; o.y = y; o.flip = rnd() < 0.5; o.filter = o.f || (PROP_NOFILTER[o.key] ? '' : (set.filter || '')); props.push(o); _propImg(o.key); };

  // ① 큰 나무/바위: 빈터와 맵 가장자리(좌우 끝은 슬롯이 없어 숲 경계처럼)
  const nBig = Math.round(w * h / 20000);
  for (let n = 0, t = 0; n < nBig && t < nBig * 40; t++) {
    const edge = rnd() < 0.55, x = edge ? (rnd() < 0.5 ? -10 + rnd() * w * 0.12 : w * 0.9 + rnd() * w * 0.12) : rnd() * w;
    const y = 30 + rnd() * (h - 34), o = mk(pick(set.big), 0.85 + rnd() * 0.35);
    if (x < o.w * 0.3 || x > w - o.w * 0.3) continue; // 배경 캐시 밖으로 잘리지 않게
    if (!slotFree(x, y, o) || !pathClear(x, y, o, 10) || !spaced(x, y, o, 0.32)) continue;
    add(o, x, y); n++;
  }
  // ② 길 앞쪽 가림막: 길 아래 가장자리에 덤불/바위를 붙여 길과 지나가는 적의 발밑이 살짝 가려지게 (먼 쪽=위쪽에 더 많이)
  for (let i = 6; i < path.length - 6; i += 3) {
    const p = path[i], q = path[i + 2] || p, dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    if (Math.abs(dy) > len * 0.6) continue;                 // 세로로 꺾이는 구간은 제외 (가로 구간만)
    const prob = 0.12 + 0.30 * (1 - p.y / h);
    if (rnd() > prob) continue;
    const o = mk(pick(set.edge), 0.85 + rnd() * 0.3), x = p.x + (rnd() - 0.5) * 10, y = p.y + pw * 0.5 + 3 + rnd() * 6;
    if (x < 8 || x > w - 8 || !slotFree(x, y, o) || !spaced(x, y, o, 0.45)) continue;
    add(o, x, y);
  }
  // ③ 중간 덤불·바위 ④ 작은 버섯·꽃·돌 (길·슬롯을 피해 무리 지어)
  const scatter = (arr, n0, sc0, scR, pad, k) => {
    for (let n = 0, t = 0; n < n0 && t < n0 * 30; t++) {
      let x = rnd() * w, y = 10 + rnd() * h;
      if (props.length && rnd() < 0.45) { const a = pick(props); x = a.x + (rnd() - 0.5) * (a.w + 40); y = a.y + (rnd() - 0.3) * 30; } // 군락
      const o = mk(pick(arr), sc0 + rnd() * scR);
      if (x < o.w * 0.3 || x > w - o.w * 0.3 || y > h - 3 || !slotFree(x, y, o) || !pathClear(x, y, o, pad) || !spaced(x, y, o, k)) continue;
      add(o, x, y); n++;
    }
  };
  scatter(set.mid, Math.round(w * h / 11000), 0.8, 0.45, 8, 0.4);
  scatter(set.small, Math.round(w * h / 16000), 0.8, 0.5, 4, 0.5);
  // ⑤ 바닥 데칼(평면, 배경에 구움)
  for (let n = 0, t = 0, n0 = set.decal.length ? Math.round(w * h / 20000) : 0; n < n0 && t < n0 * 20; t++) {
    const x = rnd() * w, y = rnd() * h, o = mk(pick(set.decal), 0.8 + rnd() * 0.6);
    if (_distToPath(x, y, pathS) < pw * 0.5 + 10 || slots.some(s => (s.x - x) ** 2 + (s.y - y) ** 2 < 900)) continue;
    o.x = x; o.y = y; o.a = 0.55 + rnd() * 0.35; o.filter = set.filter || ''; decals.push(o); _propImg(o.key); n++;
  }
  // 길(적이 지나는 곳)이 소품 뒤에 있을 때만 매 프레임 깊이 정렬 대상(dyn), 나머지는 정적 레이어에 1회 구움 (발열)
  const K = window.STAND_K || 1.13;
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
    pathTileSize:96, trees:true,
    pathColor:'#c8a44a', pathColorDark:'#5a4320',
    pathArrow:'rgba(255,225,150,0.20)', pathWidth:30, rim:'#6b5a3e', rimLight:'#a8916a',
    deco:{ big:['pine','tree','rock'], small:['bush','flower','grass'], theme:'forest' },
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
    pathTextures:['assets/terrain/rock.jpg'],
    pathTileSize:90, pathTint:'rgba(40,12,0,0.30)', bgDim:0.5, soilColor:a=>`rgba(24,10,6,${a*1.6})`,
    pathColor:'#6b4428', pathColorDark:'#2a1206',
    pathArrow:'rgba(255,160,90,0.22)', pathWidth:30, rim:'#3a2618', rimLight:'#7a5232', cliffTop:'rgba(40,18,8,0.9)', cliffLight:'rgba(255,140,60,0.35)', rockDark:'#2e1d16', rockLight:'#6e4a36',
    deco:{ big:['rock','spire'], small:['ember','pebble','crack'], theme:'volcano' },
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h){ drawNaturalTerrain(ctx,w,h,this); },
  },

  // ===== 3. 라벤더 동굴 =====
  cave: {
    name:'라벤더 동굴',
    bgColor:'#050210',
    bgImage:'assets/textures/cave_bg.jpg',
    pathTextures:['assets/terrain/slate.jpg'],
    pathTileSize:110, pathTint:'rgba(28,18,60,0.50)', soilColor:a=>`rgba(14,8,30,${a*1.6})`,
    pathColor:'#3e2860', pathColorDark:'#160b26',
    pathArrow:'rgba(190,160,255,0.20)', pathWidth:30, rim:'#2b2040', rimLight:'#5e4a86', cliffTop:'rgba(20,10,40,0.9)', cliffLight:'rgba(190,160,255,0.35)', rockDark:'#26203a', rockLight:'#5a4f7a',
    ghostBonus:0.30,
    deco:{ big:['crystal','rock'], small:['crystal_s','pebble','glow'], theme:'cave' },
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h){ drawNaturalTerrain(ctx,w,h,this); },
  },
};
