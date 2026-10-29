// ===== WORLD3D.JS — v3.14 3D 월드 (Three.js + Kenney Nature Kit, CC0) =====
// 지형(완만한 언덕·흙길)·조명·그림자·테두리 소품은 여기서 WebGL로 그림.
// 포켓몬·적·이펙트는 기존 2D 코드 그대로 위 캔버스에 그리되, 엔진이 3D 좌표를 화면에 투영해서 붙임.
// 그림체 기준: 포켓몬 공식 일러스트처럼 밝고 깔끔하게 — 사진풍 텍스처 X, 단색 로우폴리 + 부드러운 음영.
// 발열: 장면은 카메라가 바뀔 때만 렌더, 움직이는 동안은 저해상도 → 멈추면 선명하게 한 번 더.
import * as THREE from 'three';
import { GLTFLoader } from './lib/three/loaders/GLTFLoader.js';

const W3 = { ok: false };
window.World3D = W3;

let R = null, scene, cam, sun, hemi, cvs, root = null;
let Wpx = 1, Hpx = 1, dirty = true, hf = null, built = null;
let fullPR = 1, lowRes = false, lastMove = 0;
const E = new Float32Array(16);
const camPos = new THREE.Vector3();
let occluders = [], slotGroup = null;

// 카메라: 살짝 오른쪽 위로 멀어지는 시점 (판이 화면을 꽉 채우도록 위에서 비스듬히)
const VIEW = { fov: 45, el: 55 * Math.PI / 180, yaw: 8 * Math.PI / 180 };
W3.groundK = Math.sin(VIEW.el);

// ---------- 맵 테마 = 공통 규칙: 팔레트 + 테두리 소품 세트 + 모델 재질 색 ----------
// 새 맵은 이 표에 한 줄 추가하면 같은 품질로 나옴
const THEMES = {
  forest: {
    sky: 0xc8e8f6, fog: 0xd6eef4, ground: [0x7cc94e, 0x6bbb43, 0x94d25c, 0x5fb03f], low: 0x55a23a, edge: 0x4f9238,
    path: [0xf0d8a0, 0xe0c084, 0xc8a46a], sunC: 0xfff3da, sunI: 2.0, hemiS: 0xeef8ff, hemiG: 0x6e8e46, hemiI: 1.35, amp: 14,
    rim: ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_default'],
    under: ['plant_bush', 'plant_bushLarge', 'plant_bushDetailed'],
    deco: ['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'grass_large', 'grass', 'mushroom_redGroup'],
    rock: ['rock_largeA', 'rock_smallC', 'stone_smallB'],
    mat: { leafsGreen: 0x63c04c, leafsDark: 0x449f4c, grass: 0x6fc251, woodBark: 0x9b6b45, woodBarkDark: 0x7d5538, dirt: 0xab7d55, stone: 0xc2bfb6, _defaultMat: 0xf2efe6 },
  },
  volcano: {
    sky: 0xffc8a2, fog: 0xf0b896, ground: [0x6e554b, 0x62493f, 0x7d6255, 0x574038], low: 0x473129, edge: 0x3f2b24,
    path: [0xe1aa78, 0xcb915f, 0xa66d46], sunC: 0xffd2b0, sunI: 1.9, hemiS: 0xffd8c0, hemiG: 0x5a3020, hemiI: 1.4, amp: 18,
    rim: ['rock_tallA', 'rock_tallB', 'rock_tallC', 'rock_tallD', 'rock_tallE', 'stone_tallA', 'stone_tallC'],
    under: ['rock_largeA', 'rock_largeD'], deco: ['rock_smallA', 'rock_smallC', 'stump_old'], rock: ['rock_largeB', 'rock_smallB'],
    mat: { dirt: 0x5b4038, grass: 0x6a4d40, stone: 0x5d5250, _defaultMat: 0x4e4442, woodBark: 0x4a3530 },
  },
  cave: {
    sky: 0x2e2846, fog: 0x3a3358, ground: [0x625a7c, 0x564f70, 0x6f6889, 0x4d4766], low: 0x3e3856, edge: 0x37314e,
    path: [0xc7b7e6, 0xb3a2d6, 0x8f7eb6], sunC: 0xdcd2ff, sunI: 1.7, hemiS: 0xc4b8ff, hemiG: 0x2a2240, hemiI: 1.5, amp: 16,
    rim: ['stone_tallA', 'stone_tallB', 'stone_tallC', 'stone_tallD', 'stone_tallE', 'rock_tallB'],
    under: ['stone_largeA', 'rock_largeC'], deco: ['mushroom_tanGroup', 'mushroom_redGroup', 'stone_smallA'], rock: ['rock_smallA', 'stone_smallB'],
    mat: { stone: 0x8a7eb2, dirt: 0x6a5f8c, grass: 0x7b6fa6, _defaultMat: 0xe8e0ff, colorRed: 0xc58cff },
    glow: { colorRed: 0x6a2fa8, _defaultMat: 0x3a3060 },                         // 동굴 버섯은 은은하게 빛남
  },
};

W3.init = function (host, gameCanvas) {
  try {
    cvs = document.createElement('canvas'); cvs.id = 'world3d';
    cvs.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;';
    host.insertBefore(cvs, gameCanvas);
    R = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, powerPreference: 'low-power' });
    fullPR = Math.min(2, window.devicePixelRatio || 1);
    R.setPixelRatio(fullPR);
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(VIEW.fov, 1, 5, 6000);
    hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.8; sun.shadow.radius = 3;
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

// ---------- 높이맵: 맵 안은 완만, 길은 살짝 낮게, 타워 자리는 평평, 맵 밖은 낮은 언덕으로 감쌈 ----------
function outerH(x, y, W, H, amp, nz) {
  const o = Math.max(0, -x, x - W, -y, y - H);
  return (_fbm(nz, x / 300, y / 300, 3) - 0.5) * 2 * amp + o * 0.22;
}
function buildHF(W, H, path, slots, pw, amp) {
  const nz = _vnoise(1234), S = 9, M = 160;
  const nx = Math.ceil((W + 2 * M) / S) + 1, ny = Math.ceil((H + 2 * M) / S) + 1;
  const h = new Float32Array(nx * ny), pd = new Float32Array(nx * ny);
  const pS = path.filter((_, i) => i % 2 === 0), r0 = pw / 2 - 2, r1 = pw / 2 + 24;
  const slotBase = slots.map(s => outerH(s.x, s.y, W, H, amp, nz) + 1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = -M + i * S, y = -M + j * S, k = j * nx + i;
    let v = outerH(x, y, W, H, amp, nz);
    const d = _distToPath(x, y, pS); pd[k] = d;
    v -= 2.5 * (1 - _sstep(r0, r1, d));
    for (let q = 0; q < slots.length; q++) {
      const s = slots[q], dd = Math.hypot(s.x - x, s.y - y);
      if (dd < 34) { const t = 1 - _sstep(18, 34, dd); v = v * (1 - t) + slotBase[q] * t; }
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

// ---------- 지형: 부드러운 음영 + 맑은 색 그라데이션 (안쪽 촘촘, 바깥 성기게) ----------
function axis(min, max, inner0, inner1, fine) {
  const a = [];
  for (let v = min; v < inner0; v += Math.max(fine, Math.min(70, (inner0 - v) * 0.2))) a.push(v);
  for (let v = inner0; v <= inner1; v += fine) a.push(v);
  const tail = []; for (let v = max; v > inner1 + fine; v -= Math.max(fine, Math.min(70, (v - inner1) * 0.2))) tail.push(v);
  return a.concat(tail.reverse());
}
function buildTerrain(th) {
  const { W, H } = hf, FAR = 1400;
  const xs = axis(-FAR, W + FAR, -hf.M, W + hf.M, 9), ys = axis(-FAR, H + FAR, -hf.M, H + hf.M, 9);
  const nx = xs.length, ny = ys.length, pos = new Float32Array(nx * ny * 3), col = new Float32Array(nx * ny * 3);
  const nz2 = _vnoise(4321), C = th.ground.map(c => new THREE.Color(c)), low = new THREE.Color(th.low), edge = new THREE.Color(th.edge);
  const pc = new THREE.Color(th.path[2]), tmp = new THREE.Color();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = xs[i], y = ys[j], z = hAt(x, y), k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = z; pos[k + 2] = y;
    const n = _fbm(nz2, x / 220, y / 220, 3);
    tmp.copy(C[0]).lerp(C[2], _sstep(0.55, 0.75, n) * 0.8).lerp(C[3], _sstep(0.45, 0.25, n) * 0.8);
    tmp.lerp(low, Math.max(0, Math.min(0.5, (outerH(x, y, W, H, hf.amp, hf.nz) - z) * 0.12)));
    const o = Math.max(0, -x, x - W, -y, y - H);
    tmp.lerp(edge, Math.min(0.55, o / 260));                                   // 맵 밖은 조금씩 짙게 → 판에 시선
    if (o < hf.M - 5) { const d = pdAt(x, y); tmp.lerp(pc, 0.35 * (1 - _sstep(12, 26, d))); } // 길 가장자리 흙빛 번짐
    col[k] = tmp.r; col[k + 1] = tmp.g; col[k + 2] = tmp.b;
  }
  const idx = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- 길: 지형 위 띠 (가운데 밝은 모래빛, 가장자리는 풀색으로 부드럽게 녹아듦) ----------
function buildPath(path, pw, th) {
  const pts = [];
  for (let i = 1, carry = 0; i < path.length; i++) {
    const a = path[i - 1], b = path[i], L = Math.hypot(b.x - a.x, b.y - a.y);
    let t = carry;
    for (; t < L; t += 5) pts.push({ x: a.x + (b.x - a.x) * t / L, y: a.y + (b.y - a.y) * t / L });
    carry = t - L;
  }
  const n = pts.length, OFF = [-1.22, -0.92, -0.5, 0, 0.5, 0.92, 1.22], LIFT = [0.1, 0.55, 0.8, 0.9, 0.8, 0.55, 0.1], NC = OFF.length;
  const ground = new THREE.Color(th.ground[0]), cols = [ground, new THREE.Color(th.path[2]), new THREE.Color(th.path[1]), new THREE.Color(th.path[0]), new THREE.Color(th.path[1]), new THREE.Color(th.path[2]), ground];
  const nz = _vnoise(77), pos = [], col = [], idx = [], tmp = new THREE.Color();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n], o = pts[(i - 1 + n) % n];
    let tx = q.x - o.x, ty = q.y - o.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const r = pw / 2 * (1 + 0.08 * Math.sin(i * 0.09) + 0.05 * Math.sin(i * 0.31 + 1));
    for (let k = 0; k < NC; k++) {
      const x = p.x - ty * r * OFF[k], y = p.y + tx * r * OFF[k];
      pos.push(x, hAt(x, y) + LIFT[k], y);
      tmp.copy(cols[k]); if (k > 0 && k < NC - 1) tmp.multiplyScalar(0.96 + 0.08 * _fbm(nz, x / 30, y / 30, 2));
      col.push(tmp.r, tmp.g, tmp.b);
    }
    if (i < n) for (let k = 0; k < NC - 1; k++) { const a = i * NC + k, b = a + 1, c = a + NC, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  return m;
}

// ---------- 타워 자리: 돌 대신 땅 위 '자국'(옅은 링 + 살짝 눌린 원) ----------
function buildSlotMarks(slots) {
  const grp = new THREE.Group();
  const ring = new THREE.InstancedMesh(new THREE.RingGeometry(15.5, 19, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), slots.length);
  const disc = new THREE.InstancedMesh(new THREE.CircleGeometry(15.5, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false }), slots.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), one = new THREE.Vector3(1, 1, 1);
  slots.forEach((s, i) => { M.compose(new THREE.Vector3(s.x, hAt(s.x, s.y) + 0.6, s.y), q, one); ring.setMatrixAt(i, M); disc.setMatrixAt(i, M); });
  ring.renderOrder = disc.renderOrder = 2;
  grp.add(disc, ring);
  return grp;
}

// ---------- 모델 (Kenney Nature Kit) — 테마별 재질 색으로 칠해 캐시 ----------
const loader = new GLTFLoader(), raw = {}, models = {};
function loadRaw(name) {
  if (!raw[name]) raw[name] = new Promise(res => loader.load(`assets/3d/${name}.glb`, gl => {
    const parts = []; gl.scene.updateMatrixWorld(true);
    gl.scene.traverse(o => { if (o.isMesh) parts.push({ geo: o.geometry, mats: (Array.isArray(o.material) ? o.material : [o.material]).map(m => ({ name: m.name, color: m.color.getHex() })), arr: Array.isArray(o.material), mtx: o.matrixWorld.clone() }); });
    res(parts);
  }, undefined, () => res([])));
  return raw[name];
}
async function loadModel(name, th) {
  const key = name + '|' + th.key;
  if (!models[key]) models[key] = loadRaw(name).then(parts => parts.map(p => {
    const mats = p.mats.map(m => new THREE.MeshLambertMaterial({ color: th.mat[m.name] !== undefined ? th.mat[m.name] : m.color, flatShading: true,
      emissive: th.glow && th.glow[m.name] !== undefined ? th.glow[m.name] : 0x000000 }));
    return { geo: p.geo, mat: p.arr ? mats : mats[0], mtx: p.mtx };
  }));
  return models[key];
}
async function addInstances(group, name, list, th, shadow) {
  if (!list.length) return;
  const parts = await loadModel(name, th), M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, list.length);
    list.forEach((o, i) => {
      q.setFromAxisAngle(up, o.rot);
      M.compose(new THREE.Vector3(o.x, hAt(o.x, o.y) - 0.5, o.y), q, new THREE.Vector3(o.s, o.s, o.s));
      im.setMatrixAt(i, M.clone().multiply(p.mtx));
    });
    im.castShadow = shadow; im.receiveShadow = true;
    group.add(im);
  }
}

// ---------- 배치: 테두리만 얇게 + 안쪽은 아주 조금 (깔끔하게) ----------
function placeProps(W, H, path, slots, pw, th) {
  const rnd = _mapRng(4242), pick = a => a[Math.floor(rnd() * a.length)], out = {}, trees = [];
  const add = (name, x, y, s) => { (out[name] = out[name] || []).push({ x, y, s, rot: rnd() * Math.PI * 2 }); };
  const pS = path.filter((_, i) => i % 2 === 0);
  const dP = (x, y) => _distToPath(x, y, pS) - pw / 2, dS = (x, y) => Math.min(...slots.map(s => Math.hypot(s.x - x, s.y - y) - 24));
  const clr = (x, y) => Math.min(dP(x, y), dS(x, y));
  // ① 테두리: 맵 밖 0~130 띠에 큰 소품(나무/바위기둥) 한두 겹 + 밑에 덤불
  for (let y = -150; y < H + 150; y += 34) for (let x = -150; x < W + 150; x += 34) {
    const jx = x + (rnd() - 0.5) * 28, jy = y + (rnd() - 0.5) * 28, o = Math.max(-jx, jx - W, -jy, jy - H);
    if (o < 8 || o > 130 || dP(jx, jy) < 26 || rnd() < 0.25) continue;
    const s = 46 + rnd() * 26;
    add(pick(th.rim), jx, jy, s); trees.push({ x: jx, y: jy, s: s * 1.4 });
    if (rnd() < 0.45) add(pick(th.under), jx + (rnd() - 0.5) * 30, jy + 14, 26 + rnd() * 14);
  }
  // ② 안쪽: 가장 넓은 빈터 몇 곳에만 작은 나무·덤불, 풀·꽃은 드문드문
  const cand = [];
  for (let y = 20; y < H - 10; y += 14) for (let x = 14; x < W - 14; x += 14) { const c = clr(x, y); if (c > 30) cand.push({ x, y, c }); }
  cand.sort((a, b) => b.c - a.c);
  const groves = [];
  for (const c of cand) { if (groves.length >= 6) break; if (groves.every(g => Math.hypot(g.x - c.x, g.y - c.y) > 120)) groves.push(c); }
  for (const g of groves) {
    const s = Math.min(48, 18 + g.c * 0.55);
    add(pick(th.rim), g.x, g.y, s); trees.push({ x: g.x, y: g.y, s: s * 1.4 });
    add(pick(th.under), g.x + s * 0.5, g.y + s * 0.25, 22 + rnd() * 8);
  }
  const nz = _vnoise(99);
  for (let t = 0; t < 1400; t++) {
    const x = rnd() * W, y = rnd() * H;
    if (clr(x, y) < 8 || _fbm(nz, x / 130, y / 130, 2) < 0.6) continue;
    if (rnd() < 0.25) add(pick(th.deco), x, y, 24 + rnd() * 10);
  }
  for (let i = 10; i < path.length - 10; i += 14) {                         // 길 굽이 바깥 바위
    const a = path[i - 10], p = path[i], b = path[i + 10];
    let turn = Math.atan2(b.y - p.y, b.x - p.x) - Math.atan2(p.y - a.y, p.x - a.x); while (turn > Math.PI) turn -= 6.283; while (turn < -Math.PI) turn += 6.283;
    if (Math.abs(turn) < 0.9 || rnd() < 0.5) continue;
    const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1, sg = turn > 0 ? 1 : -1, d = pw / 2 + 16;
    const x = p.x + ty / tl * d * sg, y = p.y - tx / tl * d * sg;
    if (clr(x, y) > 4) add(pick(th.rock), x, y, 18 + rnd() * 8);
  }
  return { out, trees };
}

// ---------- 월드 생성 ----------
W3.build = async function ({ W, H, path, slots, pw, theme: tk }) {
  if (!R) return;
  const th = Object.assign({ key: tk }, THEMES[tk] || THEMES.forest), key = tk + W + 'x' + H;
  if (built === key) return;
  built = key;
  if (root) { scene.remove(root); root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry) o.geometry.dispose(); }); }
  root = new THREE.Group(); scene.add(root);
  hf = buildHF(W, H, path, slots, pw, th.amp);
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.fog, 900, 2400);
  hemi.color.set(th.hemiS); hemi.groundColor.set(th.hemiG); hemi.intensity = th.hemiI;
  sun.color.set(th.sunC); sun.intensity = th.sunI;
  sun.position.set(W * 0.5 - 480, 820, H * 0.5 - 560); sun.target.position.set(W * 0.5, 0, H * 0.5);   // 왼쪽 위 뒤에서 → 그림자는 오른쪽 아래
  const sc = sun.shadow.camera; sc.left = -800; sc.right = 800; sc.top = 800; sc.bottom = -800; sc.near = 100; sc.far = 2600; sc.updateProjectionMatrix();
  slotGroup = buildSlotMarks(slots);
  root.add(buildTerrain(th), buildPath(path, pw, th), slotGroup);
  const { out, trees } = placeProps(W, H, path, slots, pw, th);
  W3._trees = trees;
  await Promise.all(Object.entries(out).map(([name, list]) => addInstances(root, name, list, th, /tree|tall|bush|rock_large|stone_large/.test(name))));
  R.shadowMap.needsUpdate = true; dirty = true;
};

// ---------- 카메라 ----------
// 엔진 카메라 {x, y, zoom}: x,y = 바라보는 땅 지점, zoom = 그 지점에서 월드 1칸이 화면 몇 px인지
W3.setView = function (x, y, zoom) {
  const baseD = (Hpx / 2) / Math.tan(VIEW.fov * Math.PI / 360), dist = baseD / zoom;
  const tz = hAt(x, y) * 0.5, hx = Math.sin(VIEW.yaw), hy = -Math.cos(VIEW.yaw);
  const p = new THREE.Vector3(x - hx * dist * Math.cos(VIEW.el), tz + dist * Math.sin(VIEW.el), y - hy * dist * Math.cos(VIEW.el));
  const moved = p.distanceToSquared(cam.position) > 1e-6;
  if (!moved && !dirty) return;
  if (moved) { lastMove = performance.now(); if (!lowRes && R) { lowRes = true; R.setPixelRatio(Math.max(0.75, fullPR * 0.5)); } } // 움직이는 중엔 저해상도
  cam.position.copy(p); cam.lookAt(x, tz, y); cam.updateMatrixWorld(); camPos.copy(p);
  if (scene.fog) { scene.fog.near = dist * 1.0; scene.fog.far = dist * 2.4; }
  const m = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  E.set(m.elements); dirty = true;
  occluders = (W3._trees || []).map(t => {
    const b = W3.project(t.x, t.y), top = W3.project(t.x, t.y, hAt(t.x, t.y) + t.s), hw = t.s * 0.32 * b.s;
    return { x0: b.x - hw, x1: b.x + hw, y0: top.y, y1: b.y - hw * 0.25, d: b.d };
  });
};
W3.render = function () {
  if (!R || !root) return;
  if (lowRes && performance.now() - lastMove > 220) { lowRes = false; R.setPixelRatio(fullPR); dirty = true; }  // 멈추면 선명하게 한 번
  if (dirty) { R.render(scene, cam); dirty = false; }
};

// 월드 (x, y[, 높이]) → 화면 px {x, y, s(그 지점 1칸 px), d(깊이)}
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
  for (let k = 1; k <= 12; k++) { const t = k / 40; if (hAt(x + dx * t, y + dz * t) > z + dy * t + 1) return true; }
  return false;
};
// 화면에 길·타워 자리 전체가 꽉 차게 들어오는 줌·중심 (top~bottom = HUD 아래~하단 바 위). 바깥 테두리는 최소로
W3.fit = function (slots, top, bottom, path) {
  let cx = 0, cy = 0; for (const s of slots) { cx += s.x; cy += s.y; } cx /= slots.length; cy /= slots.length;
  let zoom = 0.6, x = cx, y = cy;
  const box = () => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const s of slots) { const p = W3.project(s.x, s.y); x0 = Math.min(x0, p.x - 22 * p.s); x1 = Math.max(x1, p.x + 22 * p.s); y0 = Math.min(y0, p.y - 52 * p.s); y1 = Math.max(y1, p.y + 16 * p.s); }
    if (path) for (let i = 0; i < path.length; i += 4) { const p = W3.project(path[i].x, path[i].y); x0 = Math.min(x0, p.x - 17 * p.s); x1 = Math.max(x1, p.x + 17 * p.s); y0 = Math.min(y0, p.y - 34 * p.s); y1 = Math.max(y1, p.y + 12 * p.s); }
    return { x0, x1, y0, y1 };
  };
  for (let it = 0; it < 20; it++) {
    dirty = true; W3.setView(x, y, zoom);
    const b = box(), sh = (bottom - top) / (b.y1 - b.y0), sw = Wpx * 0.98 / (b.x1 - b.x0);
    zoom *= Math.pow(Math.min(sh, sw), 0.7);
    const g = W3.pick((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2), c = W3.pick(Wpx / 2, (top + bottom) / 2);
    x += (g.x - c.x) * 0.8; y += (g.y - c.y) * 0.8;
  }
  dirty = true; W3.setView(x, y, zoom);
  return { x, y, zoom };
};
W3.markDirty = () => { dirty = true; };
// 확장 부지 등으로 자리가 바뀌면 바닥 자국만 다시
W3.setSlots = function (slots) {
  if (!root) return;
  if (slotGroup) root.remove(slotGroup);
  slotGroup = buildSlotMarks(slots); root.add(slotGroup); dirty = true;
};
W3.info = () => R && R.info;
