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
    const top = h * 0.15, bot = h * 0.82, gap = (bot - top) / (ROWS - 1); // 위 HUD·아래 바에 안 가리게
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
        if (ys.length && ys[0] - 72 > h * 0.15 && half === 0) cand.push(ys[0] - 72);                       // 맨 위 길 바깥 (HUD 아래만)
        if (ys.length && ys[ys.length - 1] + 72 < h * 0.86 && half === 0) cand.push(ys[ys.length - 1] + 72); // 맨 아래 길 바깥 (하단 바 위만)
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

  // 3) v3.13 계단식 언덕(테라스): 길 줄 사이마다 단 경계 → 아래 단일수록 어둡게 + 절벽 단면
  const ys = L.ys || [];
  for (let r = 0; r + 1 < ys.length; r++) {
    const yb = ys[r] + (ys[r + 1] - ys[r]) * 0.8, ltr = r % 2 === 0; // 아래 길 쪽에 붙여서 타워 자리 줄과 안 겹치게       // 짝수 줄은 오른쪽에서, 홀수 줄은 왼쪽에서 아래 단으로 내려감
    const x0 = ltr ? w * 0.11 : w * 0.30, x1 = ltr ? w * 0.80 : w * 0.985;
    // 아래 단 전체를 살짝 어둡게 (높이 차)
    ctx.fillStyle = 'rgba(0,0,0,0.11)'; ctx.fillRect(0, yb, w, h - yb);
    // 절벽 윗선(불규칙) + 단면
    const pts = []; for (let x = x0; x <= x1; x += 10) pts.push([x, yb + (rnd() - 0.5) * 7]);
    const FH = 30; // 절벽 높이
    const face = ctx.createLinearGradient(0, yb, 0, yb + FH);
    face.addColorStop(0, map.cliffTop || 'rgba(92,70,44,0.95)'); face.addColorStop(0.55, map.cliffMid || 'rgba(58,42,26,0.85)'); face.addColorStop(1, 'rgba(20,14,8,0)');
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts) ctx.lineTo(x, y);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + FH - 4 + (i % 3) * 3);
    ctx.closePath(); ctx.fillStyle = face; ctx.fill();
    for (let i = 0; i < pts.length - 1; i += 1 + (i % 2)) { const [x, y] = pts[i];                       // 세로 바위 결(단면 질감)
      ctx.strokeStyle = `rgba(0,0,0,${0.18 + rnd() * 0.2})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 1 + rnd() * 4, y + 12 + rnd() * 12); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(x0, yb + FH - 6, x1 - x0, 8);                     // 절벽 아래 그림자
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.strokeStyle = map.cliffLight || 'rgba(255,236,190,0.42)'; ctx.lineWidth = 2.5; ctx.stroke();      // 단 가장자리 빛
    ctx.strokeStyle = 'rgba(90,150,60,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] - 2); for (const [x, y] of pts) ctx.lineTo(x, y - 2); if (!map.deco || map.deco.theme === 'forest') ctx.stroke(); // 단 위 풀 테두리
    for (let i = 0; i < pts.length; i += 2) { const [x, y] = pts[i];                                     // 절벽 바위 결
      ctx.fillStyle = `rgba(0,0,0,${0.18 + rnd() * 0.15})`; ctx.fillRect(x + rnd() * 6, y + 6 + rnd() * 10, 2 + rnd() * 5, 1.5); }
  }

  // 4) v3.13 장식: 이모지 대신 직접 그린 나무·바위·수정 (길·타워 자리 피해서)
  const deco = map.deco;
  if (!deco || !deco.big) return;
  const drawDeco = (kind, x, y, sz) => {
    const sh = () => { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + sz * 0.15, y + sz * 0.45, sz * 0.55, sz * 0.18, 0, 0, 7); ctx.fill(); };
    const shade = (base, light) => { const g = ctx.createRadialGradient(x - sz * 0.2, y - sz * 0.3, 1, x, y, sz * 0.7); g.addColorStop(0, light); g.addColorStop(1, base); return g; };
    if (kind === 'pine') { sh(); ctx.fillStyle = '#4a3420'; ctx.fillRect(x - sz * 0.06, y + sz * 0.1, sz * 0.12, sz * 0.3);
      for (let k = 0; k < 3; k++) { const yy = y - sz * 0.15 * k, ww = sz * (0.5 - k * 0.12); ctx.fillStyle = shade('#1f4d24', '#4f8f3f'); ctx.beginPath(); ctx.moveTo(x, yy - sz * 0.42); ctx.lineTo(x + ww, yy + sz * 0.15); ctx.lineTo(x - ww, yy + sz * 0.15); ctx.closePath(); ctx.fill(); } }
    else if (kind === 'tree') { sh(); ctx.fillStyle = '#4a3420'; ctx.fillRect(x - sz * 0.06, y, sz * 0.12, sz * 0.38);
      for (const [dx, dy, rr] of [[-0.2, -0.05, 0.3], [0.2, -0.05, 0.3], [0, -0.28, 0.34]]) { ctx.fillStyle = shade('#285c2a', '#62a64c'); ctx.beginPath(); ctx.arc(x + dx * sz, y + dy * sz, rr * sz, 0, 7); ctx.fill(); } }
    else if (kind === 'rock' || kind === 'pebble') { if (kind === 'rock') sh();
      const n = 7, pts = []; for (let k = 0; k < n; k++) { const a = k / n * 6.283, rr = sz * (0.32 + rnd() * 0.14); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75]); }
      ctx.fillStyle = shade(map.rockDark || '#5a5a60', map.rockLight || '#a8a8ad'); ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke(); }
    else if (kind === 'spire') { sh(); ctx.fillStyle = shade('#3a2418', '#7a4a2a'); ctx.beginPath(); ctx.moveTo(x - sz * 0.3, y + sz * 0.3); ctx.lineTo(x - sz * 0.08, y - sz * 0.5); ctx.lineTo(x + sz * 0.1, y - sz * 0.35); ctx.lineTo(x + sz * 0.3, y + sz * 0.3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,40,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - sz * 0.05, y - sz * 0.3); ctx.lineTo(x + sz * 0.02, y + sz * 0.1); ctx.stroke(); }
    else if (kind === 'crystal' || kind === 'crystal_s') { if (kind === 'crystal') sh();
      for (const [dx, hh, ww] of [[-0.18, 0.5, 0.14], [0.05, 0.75, 0.16], [0.22, 0.42, 0.12]]) { const g = ctx.createLinearGradient(x + dx * sz, y - hh * sz, x + dx * sz, y + sz * 0.2); g.addColorStop(0, '#e9d8ff'); g.addColorStop(1, '#6b3fb5');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x + dx * sz, y - hh * sz); ctx.lineTo(x + (dx + ww) * sz, y + sz * 0.05); ctx.lineTo(x + dx * sz, y + sz * 0.22); ctx.lineTo(x + (dx - ww) * sz, y + sz * 0.05); ctx.closePath(); ctx.fill(); } }
    else if (kind === 'bush') { for (const [dx, dy] of [[-0.18, 0], [0.18, 0], [0, -0.12]]) { ctx.fillStyle = shade('#2c5f2a', '#5d9b47'); ctx.beginPath(); ctx.arc(x + dx * sz, y + dy * sz, sz * 0.26, 0, 7); ctx.fill(); } }
    else if (kind === 'flower') { const c = ['#ffd84a', '#ff8fb1', '#ffffff', '#b18cff'][Math.floor(rnd() * 4)]; for (let k = 0; k < 4; k++) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + (rnd() - 0.5) * sz, y + (rnd() - 0.5) * sz * 0.6, 1.8, 0, 7); ctx.fill(); } }
    else if (kind === 'grass') { ctx.strokeStyle = 'rgba(120,190,90,0.7)'; ctx.lineWidth = 1.2; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * 3, y + 4); ctx.lineTo(x + k * 4.5, y - sz * 0.5); ctx.stroke(); } }
    else if (kind === 'ember' || kind === 'glow') { const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 0.6); g.addColorStop(0, kind === 'ember' ? 'rgba(255,140,40,0.55)' : 'rgba(190,140,255,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2); }
    else if (kind === 'crack') { ctx.strokeStyle = 'rgba(255,110,30,0.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - sz * 0.5, y); ctx.lineTo(x - sz * 0.1, y - 3); ctx.lineTo(x + sz * 0.2, y + 2); ctx.lineTo(x + sz * 0.5, y - 2); ctx.stroke(); }
  };
  ctx.save();
  const count = Math.round((w * h) / 7000);
  for (let n = 0, tries = 0; n < count && tries < count * 6; tries++) {
    const x = 14 + rnd() * (w - 28), y = 14 + rnd() * (h - 28);
    if (_distToPath(x, y, pathS) < 36) continue;
    if (slots.some(s => (s.x - x)**2 + (s.y - y)**2 < 42*42)) continue;
    const hv = H[Math.round(y / S) * gw + Math.round(x / S)] || 0;
    const big = hv > 0.2 && rnd() < 0.6, pool = big ? deco.big : deco.small;
    const kind = pool[Math.floor(rnd() * pool.length)];
    drawDeco(kind, x, y, (big ? 24 : 12) * (0.8 + rnd() * 0.5));
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
    pathArrow:'rgba(255,225,150,0.20)', pathWidth:22, rim:'#6b5a3e', rimLight:'#a8916a',
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
    pathTextures:['assets/textures/brick_02.jpg','assets/textures/brick_03.jpg'],
    pathTileSize:46,
    pathColor:'#6b4428', pathColorDark:'#2a1206',
    pathArrow:'rgba(255,160,90,0.22)', pathWidth:22, rim:'#3a2618', rimLight:'#7a5232', cliffTop:'rgba(40,18,8,0.9)', cliffLight:'rgba(255,140,60,0.35)', rockDark:'#2e1d16', rockLight:'#6e4a36',
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
    pathTextures:['assets/textures/ground_01.jpg','assets/textures/ground_02.jpg'],
    pathTileSize:48,
    pathColor:'#3e2860', pathColorDark:'#160b26',
    pathArrow:'rgba(190,160,255,0.20)', pathWidth:22, rim:'#2b2040', rimLight:'#5e4a86', cliffTop:'rgba(20,10,40,0.9)', cliffLight:'rgba(190,160,255,0.35)', rockDark:'#26203a', rockLight:'#5a4f7a',
    ghostBonus:0.30,
    deco:{ big:['crystal','rock'], small:['crystal_s','pebble','glow'], theme:'cave' },
    getPaths:(w,h)=>NaturalLayout.getPaths(w,h),
    getSlots:(w,h)=>NaturalLayout.getSlots(w,h),
    drawBg(ctx,w,h){ drawNaturalTerrain(ctx,w,h,this); },
  },
};
