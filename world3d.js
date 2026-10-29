// ===== WORLD3D.JS — v3.14 진짜 3D 월드 (Three.js + Kenney Nature Kit, CC0) =====
// 지형(언덕·파인 길·둑)·조명·그림자·거리 안개·3D 나무/바위는 여기서 WebGL로 그림.
// 포켓몬·적·이펙트는 기존 2D 코드 그대로 위 캔버스에 그리되, 엔진이 3D 좌표를 화면에 투영해서 붙임.
// 3D 장면은 정적이라 카메라가 움직일 때만 다시 렌더 → 평소 GPU 비용 거의 0 (발열).
import * as THREE from 'three';
import { GLTFLoader } from './lib/three/loaders/GLTFLoader.js';

const W3 = { ok: false };
window.World3D = W3;

let R = null, scene, cam, sun, hemi, cvs, root = null;
let Wpx = 1, Hpx = 1, dirty = true, hf = null, built = null;
const E = new Float32Array(16);          // 투영·시점 행렬 (매 카메라 변경 시 갱신)
let camPos = new THREE.Vector3();
let occluders = [];                       // 화면상 나무 영역 (유닛 가림 판정)

// 카메라: 오른쪽 위로 멀어지는 대각 시점
const VIEW = { fov: 50, el: 44 * Math.PI / 180, yaw: 9 * Math.PI / 180 };
W3.groundK = Math.sin(VIEW.el);           // 바닥 세로 압축률(세워 그리는 스프라이트 보정용)

const THEMES = {
  forest: { sky: 0xc4dde6, fog: 0xbfd6d2, ground: [0x5c9a38, 0x6dab44, 0x8ab84f, 0x4a8a33], low: 0x3c6e2c, side: 0x7d7a4a,
    path: [0xd2ad74, 0xbd935d, 0x8e6b46], slot: 0x9b958a, amp: 22, sunC: 0xfff0d4, sunI: 2.2, hemiS: 0xdcefff, hemiG: 0x5a6a30, hemiI: 1.45, props: 'forest' },
  volcano: { sky: 0x3b1a12, fog: 0x4a2016, ground: [0x3d2b25, 0x4b3029, 0x2f2321, 0x58372b], low: 0x231310, side: 0x2a1a14,
    path: [0x7a5440, 0x664532, 0x3e2a20], slot: 0x7d6d63, amp: 26, sunC: 0xffb48a, sunI: 2.2, hemiS: 0xff9a6a, hemiG: 0x2a0a00, hemiI: 0.9, props: null },
  cave: { sky: 0x130d24, fog: 0x1b1531, ground: [0x3b3549, 0x463e57, 0x302b3d, 0x4e4662], low: 0x221d2e, side: 0x2a2438,
    path: [0x625284, 0x4f416d, 0x302548], slot: 0x8c849b, amp: 24, sunC: 0xd0c0ff, sunI: 1.9, hemiS: 0x8a7acc, hemiG: 0x140f20, hemiI: 0.95, props: null },
};

// 모델 색: Kenney 기본(민트) → 자연색
const MAT_COLORS = { leafsGreen: 0x4f9638, leafsDark: 0x2f6b34, grass: 0x5e9f3c, woodBark: 0x6e4a30, woodBarkDark: 0x553a2a, dirt: 0x7d6046, woodInner: 0xd2b98f, stone: 0x9a968e };

W3.init = function (host, gameCanvas) {
  try {
    cvs = document.createElement('canvas'); cvs.id = 'world3d';
    cvs.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
    host.insertBefore(cvs, gameCanvas);
    R = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, powerPreference: 'low-power' });
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(VIEW.fov, 1, 5, 9000);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.8;
    scene.add(sun); scene.add(sun.target);
    W3.ok = true;
  } catch (e) { console.warn('[3D] WebGL 사용 불가 → 2D', e); W3.ok = false; if (cvs) cvs.remove(); }
  return W3.ok;
};

W3.resize = function (w, h) {
  if (!R) return;
  Wpx = w; Hpx = h; R.setSize(w, h, false);
  cam.aspect = w / h; cam.updateProjectionMatrix(); dirty = true;
};

// ---------- 높이맵 ----------
// 맵 안: 완만한 언덕(길이 오르내림) + 길은 둑이 있는 골짜기 + 타워 자리는 평평한 단
// 맵 밖: 바깥으로 갈수록 솟는 숲 언덕(분지 느낌, 지평선)
function outerH(x, y, W, H, amp, nz) {
  const o = Math.max(0, -x, x - W, -y, y - H);
  return (_fbm(nz, x / 260, y / 260, 4) - 0.5) * 2 * amp + o * 0.32 + Math.max(0, o - 300) * 0.25;
}
function buildHF(W, H, path, slots, pw, amp) {
  const nz = _vnoise(1234), S = 9, M = 160;
  const nx = Math.ceil((W + 2 * M) / S) + 1, ny = Math.ceil((H + 2 * M) / S) + 1;
  const h = new Float32Array(nx * ny), pd = new Float32Array(nx * ny);
  const pS = path.filter((_, i) => i % 2 === 0), r0 = pw / 2 - 2, r1 = pw / 2 + 26;
  const slotBase = slots.map(s => outerH(s.x, s.y, W, H, amp, nz) + 1.5);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = -M + i * S, y = -M + j * S, k = j * nx + i;
    let v = outerH(x, y, W, H, amp, nz);
    const d = _distToPath(x, y, pS); pd[k] = d;
    v -= 3.5 * (1 - _sstep(r0, r1, d));                                  // 길: 살짝 파인 흙길(완만한 둑)
    for (let q = 0; q < slots.length; q++) {                              // 타워 자리 평평한 단
      const s = slots[q], dd = Math.hypot(s.x - x, s.y - y);
      if (dd < 36) { const t = 1 - _sstep(20, 36, dd); v = v * (1 - t) + slotBase[q] * t; }
    }
    h[k] = v;
  }
  return { S, M, nx, ny, h, pd, W, H, amp, nz };
}
function hAt(x, y) {
  if (!hf) return 0;
  const fx = (x + hf.M) / hf.S, fy = (y + hf.M) / hf.S;
  if (fx < 0 || fy < 0 || fx >= hf.nx - 1 || fy >= hf.ny - 1) return outerH(x, y, hf.W, hf.H, hf.amp, hf.nz);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, n = hf.nx, a = hf.h;
  return (a[j * n + i] * (1 - u) + a[j * n + i + 1] * u) * (1 - v) + (a[(j + 1) * n + i] * (1 - u) + a[(j + 1) * n + i + 1] * u) * v;
}
function pdAt(x, y) {
  const i = Math.round((x + hf.M) / hf.S), j = Math.round((y + hf.M) / hf.S);
  if (i < 0 || j < 0 || i >= hf.nx || j >= hf.ny) return 1e4;
  return hf.pd[j * hf.nx + i];
}
W3.heightAt = hAt;

// ---------- 지형 메시 (안쪽 촘촘·바깥 성기게, 한 장의 격자라 이음새 없음) ----------
function axis(min, max, inner0, inner1, fine) {
  const a = [];
  for (let v = min; v < inner0; v += Math.max(fine, Math.min(70, (inner0 - v) * 0.18))) a.push(v);
  for (let v = inner0; v <= inner1; v += fine) a.push(v);
  const tail = []; for (let v = max; v > inner1 + fine; v -= Math.max(fine, Math.min(70, (v - inner1) * 0.18))) tail.push(v);
  return a.concat(tail.reverse());
}
function buildTerrain(th) {
  const { W, H } = hf, FAR = 2200;
  const xs = axis(-FAR, W + FAR, -hf.M, W + hf.M, 9), ys = axis(-FAR, H + FAR, -hf.M, H + hf.M, 9);
  const nx = xs.length, ny = ys.length, pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const nz2 = _vnoise(4321), C = th.ground.map(c => new THREE.Color(c)), low = new THREE.Color(th.low), side = new THREE.Color(th.side);
  const pc = new THREE.Color(th.path[2]), tmp = new THREE.Color();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], y = ys[j], z = hAt(x, y), k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = z; pos[k + 2] = y;
    const n = _fbm(nz2, x / 170, y / 170, 3), m = _fbm(nz2, x / 45 + 50, y / 45, 2);
    tmp.copy(C[0]).lerp(C[2], _sstep(0.52, 0.72, n)).lerp(C[3], _sstep(0.45, 0.28, n)).lerp(C[1], m * 0.5);
    const base = outerH(x, y, W, H, hf.amp, hf.nz);
    tmp.lerp(low, Math.max(0, Math.min(0.6, (base - z) * 0.08 + (-base) * 0.012)));   // 낮은 곳·골짜기 짙게
    const inW = x > -hf.M && x < W + hf.M && y > -hf.M && y < H + hf.M;
    if (inW) { const d = pdAt(x, y); tmp.lerp(pc, 0.55 * (1 - _sstep(14, 30, d))); }  // 길 둑: 흙빛
    col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
  }
  const idx = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if ((i + j) % 2) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- 길: 지형 위에 얹은 띠(가장자리 부드럽게, 가운데 밝은 흙) ----------
function buildPath(path, pw, th) {
  const pts = [];
  for (let i = 1, carry = 0; i < path.length; i++) {
    const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    let t = carry;
    for (; t < L; t += 5) pts.push({ x: a.x + (b.x - a.x) * t / L, y: a.y + (b.y - a.y) * t / L });
    carry = t - L;
  }
  const n = pts.length, OFF = [-1.18, -0.62, 0, 0.62, 1.18], LIFT = [0.15, 0.7, 0.9, 0.7, 0.15];
  const cols = [th.path[2], th.path[1], th.path[0], th.path[1], th.path[2]].map(c => new THREE.Color(c));
  const nz = _vnoise(77), pos = [], col = [], idx = [], tmp = new THREE.Color();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n], o = pts[(i - 1 + n) % n];
    let tx = q.x - o.x, ty = q.y - o.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const r = pw / 2 * (1 + 0.1 * Math.sin(i * 0.09) + 0.06 * Math.sin(i * 0.31 + 1));
    for (let k = 0; k < 5; k++) {
      const x = p.x - ty * r * OFF[k], y = p.y + tx * r * OFF[k];
      pos.push(x, hAt(x, y) + LIFT[k], y);
      tmp.copy(cols[k]).multiplyScalar(0.9 + 0.2 * _fbm(nz, x / 18, y / 18, 2)); col.push(tmp.r, tmp.g, tmp.b);
    }
    if (i < n) for (let k = 0; k < 4; k++) { const a = i * 5 + k, b = a + 1, c = a + 5, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  return m;
}

// ---------- 모델 로드 (색 보정·캐시) ----------
const loader = new GLTFLoader(), models = {};
function loadModel(name) {
  if (!models[name]) models[name] = new Promise(res => loader.load(`assets/3d/${name}.glb`, gl => {
    const parts = [];
    gl.scene.updateMatrixWorld(true);
    gl.scene.traverse(o => {
      if (!o.isMesh) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
        const c = MAT_COLORS[m.name]; const nm = new THREE.MeshLambertMaterial({ color: c !== undefined ? c : m.color, flatShading: true });
        return nm;
      });
      parts.push({ geo: o.geometry, mat: Array.isArray(o.material) ? mats : mats[0], mtx: o.matrixWorld.clone() });
    });
    res(parts);
  }, undefined, () => res([])));
  return models[name];
}
async function addInstances(group, name, list, shadow) {
  if (!list.length) return;
  const parts = await loadModel(name), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, list.length);
    list.forEach((o, i) => {
      q.setFromAxisAngle(up, o.rot);
      M.compose(new THREE.Vector3(o.x, hAt(o.x, o.y) - 0.5, o.y), q, new THREE.Vector3(o.s * (o.sx || 1), o.s * (o.sy || 1), o.s * (o.sx || 1)));
      im.setMatrixAt(i, M.clone().multiply(p.mtx));
    });
    im.castShadow = shadow; im.receiveShadow = true;
    group.add(im);
  }
}

// ---------- 소품 배치 (숲) ----------
const FOREST = {
  outer: ['tree_pineRoundA', 'tree_pineRoundC', 'tree_default', 'tree_pineDefaultA', 'tree_oak', 'tree_pineTallA_detailed', 'tree_fat', 'tree_pineRoundE', 'tree_detailed', 'tree_tall'],
  grove: ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_pineRoundA', 'tree_pineTallB_detailed', 'tree_plateau'],
  bush: ['plant_bush', 'plant_bushDetailed', 'plant_bushLarge', 'plant_bushSmall'],
  grass: ['grass', 'grass_large', 'grass_leafs', 'grass_leafsLarge'],
  flower: ['flower_redA', 'flower_redB', 'flower_yellowA', 'flower_yellowB', 'flower_purpleA', 'flower_purpleB'],
  rock: ['rock_largeA', 'rock_largeB', 'rock_largeC', 'stone_largeA'],
  pebble: ['rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallFlatA', 'rock_smallFlatB', 'stone_smallA', 'stone_smallB'],
  forestFloor: ['mushroom_red', 'mushroom_redGroup', 'mushroom_tanGroup', 'log', 'stump_round', 'stump_old'],
};
function placeForest(W, H, path, slots, pw) {
  const rnd = _mapRng(4242), pick = a => a[Math.floor(rnd() * a.length)], out = {}, trees = [];
  const add = (name, x, y, s, extra) => { (out[name] = out[name] || []).push({ x, y, s, rot: rnd() * Math.PI * 2, ...(extra || {}) }); };
  const pS = path.filter((_, i) => i % 2 === 0);
  const clr = (x, y) => Math.min(_distToPath(x, y, pS) - pw / 2, ...slots.map(s => Math.hypot(s.x - x, s.y - y) - 26));
  const farFromTrees = (x, y, r) => trees.every(t => Math.hypot(t.x - x, t.y - y) > (t.r + r) * 0.8);
  // ① 바깥 숲: 맵 밖 언덕을 빽빽한 숲으로 (멀수록 크게 — 분지를 둘러싼 숲)
  // 카메라가 왼쪽 아래에서 오른쪽 위를 보므로 먼 쪽(위·오른쪽)은 깊게, 가까운 쪽(왼쪽·아래)은 얇게 (삼각형 수 절약)
  for (let y = -440; y < H + 240; y += 34) for (let x = -260; x < W + 440; x += 34) {
    const jx = x + (rnd() - 0.5) * 30, jy = y + (rnd() - 0.5) * 30, o = Math.max(-jx, jx - W, -jy, jy - H);
    if (o < 6 || o > (jx > W || jy < 0 ? 430 : 230)) continue;
    if (rnd() < 0.18 + Math.min(0.6, o / 140)) { const s = 46 + rnd() * 34 + Math.min(40, o * 0.08); if (_distToPath(jx, jy, pS) > pw / 2 + s * 0.45) { add(pick(FOREST.outer), jx, jy, s); trees.push({ x: jx, y: jy, r: s * 0.35, s, out: true }); } }
    else if (o < 160 && rnd() < 0.5) add(pick(FOREST.bush), jx, jy, 34 + rnd() * 26);
  }
  // ② 맵 안 빈터: 길·타워에서 먼 곳에 나무 군락 + 밑에 덤불·버섯·통나무
  const cand = [];
  for (let y = 16; y < H - 8; y += 12) for (let x = 12; x < W - 12; x += 12) { const c = clr(x, y); if (c > 24) cand.push({ x, y, c }); }
  cand.sort((a, b) => b.c - a.c);
  const groves = [];
  for (const c of cand) { if (groves.length >= 16) break; if (groves.every(g => Math.hypot(g.x - c.x, g.y - c.y) > 80)) groves.push(c); }
  for (const g of groves) {
    const s = Math.min(70, 22 + g.c * 1.0);
    if (g.c > 30 && farFromTrees(g.x, g.y, s * 0.35)) {
      add(pick(FOREST.grove), g.x, g.y, s); trees.push({ x: g.x, y: g.y, r: s * 0.35, s });
      for (let i = 0; i < 3; i++) { const a = rnd() * 6.28, d = s * (0.3 + rnd() * 0.25); add(pick(FOREST.bush), g.x + Math.cos(a) * d, g.y + Math.sin(a) * d, 26 + rnd() * 16); }
      if (rnd() < 0.7) add(pick(FOREST.forestFloor), g.x + (rnd() - 0.5) * s * 0.7, g.y + (rnd() - 0.5) * s * 0.5, 30 + rnd() * 12);
    } else {
      for (let i = 0; i < 3; i++) add(pick(FOREST.bush), g.x + (rnd() - 0.5) * 30, g.y + (rnd() - 0.5) * 20, 22 + rnd() * 14);
    }
  }
  // ③ 꽃밭·풀: 빈 땅 곳곳에 무리 지어 (작아서 타워·적을 가리지 않음)
  const nz = _vnoise(99);
  for (let t = 0; t < 2600; t++) {
    const x = rnd() * W, y = rnd() * H, n = _fbm(nz, x / 120, y / 120, 2), c = clr(x, y);
    if (c < 6) continue;
    if (n > 0.6 && rnd() < 0.5) add(pick(FOREST.flower), x, y, 26 + rnd() * 14);
    else if (rnd() < 0.22) add(pick(FOREST.grass), x, y, 26 + rnd() * 18);
  }
  // ④ 길 가장자리 자갈·바위 (굽이 바깥쪽에 큰 바위)
  for (let i = 0; i < path.length; i += 3) {
    const p = path[i], q = path[(i + 2) % path.length], tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1, side = rnd() < 0.5 ? 1 : -1;
    const d = pw / 2 + 2 + rnd() * 5, x = p.x - ty / tl * d * side, y = p.y + tx / tl * d * side;
    if (rnd() < 0.22 && clr(x, y) > -pw / 2 - 1) add(pick(FOREST.pebble), x, y, 12 + rnd() * 12);
  }
  for (let i = 10; i < path.length - 10; i += 14) {
    const a = path[i - 10], p = path[i], b = path[i + 10];
    let turn = Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x); while (turn > Math.PI) turn -= 6.283; while (turn < -Math.PI) turn += 6.283;
    if (Math.abs(turn) < 0.8 || rnd() < 0.4) continue;
    const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, sg = turn > 0 ? 1 : -1, d = pw / 2 + 16;
    const x = p.x + ty / tl * d * sg, y = p.y - tx / tl * d * sg;
    if (clr(x, y) > 4) { add(pick(FOREST.rock), x, y, 22 + rnd() * 10); add(pick(FOREST.pebble), x + 12, y + 6, 14); }
  }
  return { out, trees };
}

// ---------- 월드 생성 ----------
W3.build = async function ({ W, H, path, slots, pw, theme }) {
  if (!R) return;
  const th = THEMES[theme] || THEMES.forest, key = theme + W + 'x' + H;
  if (built === key) return;
  built = key;
  if (root) { scene.remove(root); root.traverse(o => { if (o.isMesh && o.geometry && !o.isInstancedMesh) o.geometry.dispose(); }); }
  root = new THREE.Group(); scene.add(root);
  hf = buildHF(W, H, path, slots, pw, th.amp);
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.fog, 900, 2600);
  hemi.color.set(th.hemiS); hemi.groundColor.set(th.hemiG); hemi.intensity = th.hemiI;
  sun.color.set(th.sunC); sun.intensity = th.sunI;
  // 햇빛: 왼쪽 위 뒤쪽에서 → 그림자는 오른쪽 아래(카메라 쪽)로
  sun.position.set(W * 0.5 - 520, 760, H * 0.5 - 620); sun.target.position.set(W * 0.5, 0, H * 0.5);
  const sc = sun.shadow.camera; sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900; sc.near = 100; sc.far = 2600; sc.updateProjectionMatrix();
  root.add(buildTerrain(th));
  root.add(buildPath(path, pw, th));
  // 타워 자리: 땅에 박힌 낮은 돌판 (각진 low-poly)
  const sg = new THREE.CylinderGeometry(19, 21.5, 6, 9), sm = new THREE.MeshLambertMaterial({ color: th.slot, flatShading: true });
  const sIm = new THREE.InstancedMesh(sg, sm, slots.length), M = new THREE.Matrix4(), q = new THREE.Quaternion();
  slots.forEach((s, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7); M.compose(new THREE.Vector3(s.x, hAt(s.x, s.y) + 1, s.y), q, new THREE.Vector3(1, 1, 1)); sIm.setMatrixAt(i, M); });
  sIm.receiveShadow = true; sIm.castShadow = true; root.add(sIm);
  occluders = [];
  W3._trees = [];
  if (th.props === 'forest') {
    const { out, trees } = placeForest(W, H, path, slots, pw);
    W3._trees = trees.filter(t => !t.out || t.x > -120 && t.x < W + 120 && t.y > -120 && t.y < H + 120);
    await Promise.all(Object.entries(out).map(([name, list]) => addInstances(root, name, list, !/^(grass|flower|rock_small|stone_small)/.test(name))));
  }
  R.shadowMap.needsUpdate = true; dirty = true;
};

// ---------- 카메라 ----------
// 엔진 카메라 {x, y, zoom}: x,y = 바라보는 땅 지점, zoom = 그 지점에서 월드 1칸이 화면 몇 px인지
W3.setView = function (x, y, zoom) {
  const baseD = (Hpx / 2) / Math.tan(VIEW.fov * Math.PI / 360), dist = baseD / zoom;
  const tz = hAt(x, y) * 0.5, hx = Math.sin(VIEW.yaw), hy = -Math.cos(VIEW.yaw);
  const p = new THREE.Vector3(x - hx * dist * Math.cos(VIEW.el), tz + dist * Math.sin(VIEW.el), y - hy * dist * Math.cos(VIEW.el));
  if (p.distanceToSquared(cam.position) < 1e-6 && !dirty) return;
  cam.position.copy(p); cam.lookAt(x, tz, y); cam.updateMatrixWorld(); camPos.copy(p);
  if (scene.fog) { scene.fog.near = dist * 1.05; scene.fog.far = dist * 2.6; } // 판은 선명, 바깥 숲만 멀수록 안개
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  E.set(m.elements); dirty = true;
  // 유닛 가림 판정용: 맵 안·가장자리 나무의 화면 사각형(밑동~꼭대기)
  occluders = W3._trees.map(t => {
    const b = W3.project(t.x, t.y), top = W3.project(t.x, t.y, hAt(t.x, t.y) + t.s * 1.25), hw = t.s * 0.36 * b.s;
    return { x0: b.x - hw, x1: b.x + hw, y0: top.y, y1: b.y - hw * 0.25, d: b.d };
  });
};
W3.render = function () { if (dirty && R && root) { R.render(scene, cam); dirty = false; } };

// 월드 (x, y[, 높이]) → 화면 px {x, y, s(그 지점 1칸 px), d(깊이)}
const _pr = { x: 0, y: 0, s: 1, d: 1 };
W3.project = function (x, y, z, out) {
  if (z === undefined) z = hAt(x, y);
  const e = E, w = e[3] * x + e[7] * z + e[11] * y + e[15];
  const o = out || { x: 0, y: 0, s: 1, d: 1 };
  o.x = ((e[0] * x + e[4] * z + e[8] * y + e[12]) / w * 0.5 + 0.5) * Wpx;
  o.y = (0.5 - (e[1] * x + e[5] * z + e[9] * y + e[13]) / w * 0.5) * Hpx;
  o.s = cam.projectionMatrix.elements[5] * Hpx * 0.5 / w; o.d = w;
  return o;
};
// 화면 px → 땅 위 월드 좌표 (시선과 지형의 교점)
W3.pick = function (sx, sy) {
  const v = new THREE.Vector3((sx / Wpx) * 2 - 1, 1 - (sy / Hpx) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
  let t = (0 - cam.position.y) / v.y;
  for (let k = 0; k < 4; k++) { const x = cam.position.x + v.x * t, y = cam.position.z + v.z * t; t = (hAt(x, y) - cam.position.y) / v.y; }
  return { x: cam.position.x + v.x * t, y: cam.position.z + v.z * t };
};
// 유닛이 나무·언덕 뒤에 가려졌는지 (가려지면 반투명으로 그림)
W3.occluded = function (x, y, P) {
  for (const o of occluders) if (P.x > o.x0 && P.x < o.x1 && P.y > o.y0 && P.y < o.y1 && P.d > o.d + 6) return true;
  const z = hAt(x, y) + 10, dx = camPos.x - x, dy = camPos.y - z, dz = camPos.z - y;
  for (let k = 1; k <= 14; k++) { const t = k / 40; if (hAt(x + dx * t, y + dz * t) > z + dy * t + 1) return true; }
  return false;
};
// 화면에 맵 전체(타워 자리)가 들어오는 줌·중심 계산 (top~bottom = HUD 아래~하단 바 위)
W3.fit = function (slots, top, bottom, path) {
  let cx = 0, cy = 0; for (const s of slots) { cx += s.x; cy += s.y; } cx /= slots.length; cy /= slots.length;
  let zoom = 0.6, x = cx, y = cy;
  const box = () => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const s of slots) { const p = W3.project(s.x, s.y); x0 = Math.min(x0, p.x - 22 * p.s); x1 = Math.max(x1, p.x + 22 * p.s); y0 = Math.min(y0, p.y - 58 * p.s); y1 = Math.max(y1, p.y + 18 * p.s); }
    // 길 전체(왼쪽 복귀 세로길 포함)도 화면 안에 — 몹이 지나는 곳이 잘리지 않게
    if (path) for (let i = 0; i < path.length; i += 4) { const p = W3.project(path[i].x, path[i].y); x0 = Math.min(x0, p.x - 18 * p.s); x1 = Math.max(x1, p.x + 18 * p.s); y0 = Math.min(y0, p.y - 40 * p.s); y1 = Math.max(y1, p.y + 14 * p.s); }
    return { x0, x1, y0, y1 }; };
  for (let it = 0; it < 18; it++) {
    dirty = true; W3.setView(x, y, zoom);
    const b = box(), sh = (bottom - top) / (b.y1 - b.y0), sw = Wpx / (b.x1 - b.x0);
    zoom *= Math.pow(Math.min(sh, sw), 0.7);
    const g = W3.pick((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2), c = W3.pick(Wpx / 2, (top + bottom) / 2);
    x += (g.x - c.x) * 0.8; y += (g.y - c.y) * 0.8;
  }
  dirty = true; W3.setView(x, y, zoom);
  return { x, y, zoom };
};
W3.markDirty = () => { dirty = true; };
W3.info = () => R && R.info;
W3.stats = () => { const o = {}; root.traverse(m => { if (m.isInstancedMesh) { const t = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; const k = m.geometry.uuid.slice(0, 4); o[k] = o[k] || { t, n: m.count, tot: 0 }; o[k].tot += t * m.count; } }); return Object.values(o).sort((a, b) => b.tot - a.tot).slice(0, 12); };
