// ===== ARENA3D.JS — v5 포켓몬 배틀 3D 실내 스타디움 (Three.js) =====
// 어두운 돔 + 관중석 조명 띠 + 네온 라인 바닥(캔버스로 그린 텍스처) + 팀색 받침 6개(전열 1·후열 2, 길로 연결) + 스포트라이트.
// 포켓몬은 2D 일러스트를 받침 위에 세운 빌보드(스프라이트). 이펙트: 투사체·충격파·피격 번쩍임·쓰러짐.
// battle.js가 import('./arena3d.js')로 필요할 때만 불러옴. 화면 좌표 변환(hitTest·rectOf)으로 드래그 타깃 판정.
import * as THREE from 'three';

const TEAM = { me: 0x3b82f6, foe: 0xef4444 };
// 진형 좌표: [전열, 후열 왼쪽, 후열 오른쪽]. 내 팀은 카메라 쪽(z+), 상대는 안쪽(z-)
const POS = {
  me:  [[0, 0, 3.6], [-4.6, 0, 7.4], [4.6, 0, 7.4]],
  foe: [[0, 0, -3.6], [-4.6, 0, -7.4], [4.6, 0, -7.4]],
};

function floorTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d'), C = 512;
  const bg = g.createRadialGradient(C, C, 60, C, C, 520); bg.addColorStop(0, '#16203f'); bg.addColorStop(0.7, '#0e1530'); bg.addColorStop(1, '#070b1a');
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 1024);
  // 팀 진영 색 (아래 = 내 팀 파랑, 위 = 상대 빨강)
  for (const [y, col] of [[C + 250, 'rgba(59,130,246,0.22)'], [C - 250, 'rgba(239,68,68,0.20)']]) { const r = g.createRadialGradient(C, y, 10, C, y, 330); r.addColorStop(0, col); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 1024, 1024); }
  // 육각 격자 (아주 옅게)
  g.strokeStyle = 'rgba(120,160,255,0.06)'; g.lineWidth = 1.5; const hs = 34;
  for (let y = 0; y < 1100; y += hs * 1.5) for (let x = 0; x < 1100; x += hs * Math.sqrt(3)) { const ox = (Math.round(y / (hs * 1.5)) % 2) * hs * Math.sqrt(3) / 2; g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; g.lineTo(x + ox + hs * Math.cos(a), y + hs * Math.sin(a)); } g.closePath(); g.stroke(); }
  // 네온 라인: 바깥 원·중앙선·센터 서클
  const glow = (fn, col, w) => { g.save(); g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 18; g.lineWidth = w; g.beginPath(); fn(); g.stroke(); g.restore(); };
  glow(() => g.arc(C, C, 470, 0, Math.PI * 2), 'rgba(140,190,255,0.85)', 5);
  glow(() => g.arc(C, C, 455, 0, Math.PI * 2), 'rgba(140,190,255,0.25)', 2);
  glow(() => { g.moveTo(C - 470, C); g.lineTo(C + 470, C); }, 'rgba(230,240,255,0.75)', 4);
  glow(() => g.arc(C, C, 92, 0, Math.PI * 2), 'rgba(230,240,255,0.8)', 4);
  glow(() => g.arc(C, C, 30, 0, Math.PI * 2), 'rgba(255,200,80,0.9)', 5);
  // 진영 경계 호 (전열 선)
  glow(() => g.arc(C, C, 230, 0.15 * Math.PI, 0.85 * Math.PI), 'rgba(59,130,246,0.7)', 3);
  glow(() => g.arc(C, C, 230, 1.15 * Math.PI, 1.85 * Math.PI), 'rgba(239,68,68,0.7)', 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function radialTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(1, outer); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function padTexture(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), col = '#' + hex.toString(16).padStart(6, '0');
  const bg = g.createRadialGradient(128, 128, 10, 128, 128, 128); bg.addColorStop(0, '#2a3557'); bg.addColorStop(1, '#141b33'); g.fillStyle = bg; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
  g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 12; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.globalAlpha = 0.6; g.beginPath(); g.arc(128, 128, 78, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.35; g.beginPath(); g.arc(128, 128, 40, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createArena(host, opts = {}) {
  const R = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  host.appendChild(R.domElement); R.domElement.className = 'pb-gl';
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a16); scene.fog = new THREE.Fog(0x070a16, 26, 60);
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

  // 돔: 위로 갈수록 밝은 남색 그라데이션 (정점 색)
  { const geo = new THREE.SphereGeometry(70, 32, 16), col = [], p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 70, c = new THREE.Color(0x05070f).lerp(new THREE.Color(0x1b2a55), Math.max(0, y) ** 0.7); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }))); }
  // 관중석: 바깥 계단 링 + 점점이 켜진 조명
  { const stand = new THREE.Mesh(new THREE.CylinderGeometry(34, 28, 7, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c1226, roughness: 0.9, side: THREE.BackSide }));
    stand.position.y = 2.2; scene.add(stand);
    const dotG = new THREE.SphereGeometry(0.09, 6, 4), n = 700, inst = new THREE.InstancedMesh(dotG, new THREE.MeshBasicMaterial({ color: 0xffffff }), n), m = new THREE.Matrix4(), cc = new THREE.Color();
    const pal = [0x9cc4ff, 0xffd27a, 0xff8fa3, 0xffffff, 0x8fffd0];
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, h = Math.random(), r = 28.5 + h * 5.6; m.setPosition(Math.cos(a) * r, -0.6 + h * 6.6, Math.sin(a) * r); inst.setMatrixAt(i, m); inst.setColorAt(i, cc.setHex(pal[i % pal.length]).multiplyScalar(0.35 + Math.random() * 0.65)); }
    scene.add(inst);
    // 지붕 조명 링
    const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 0.18, 8, 96), new THREE.MeshBasicMaterial({ color: 0xbcd4ff })); ring.rotation.x = Math.PI / 2; ring.position.y = 17; scene.add(ring);
  }
  // 바닥
  const floor = new THREE.Mesh(new THREE.CircleGeometry(19, 96), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.42, metalness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.0 }));
  floor.material.emissiveMap = floor.material.map; floor.material.emissiveIntensity = 0.55; floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const apron = new THREE.Mesh(new THREE.RingGeometry(19, 27, 96), new THREE.MeshStandardMaterial({ color: 0x0b1022, roughness: 0.8 })); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.01; scene.add(apron);
  // 조명
  scene.add(new THREE.HemisphereLight(0x9fb8ff, 0x141a30, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 18, 10); scene.add(key);
  for (const [z, col] of [[6, 0x8fb8ff], [-6, 0xff9a9a]]) { const sp = new THREE.SpotLight(col, 60, 40, 0.55, 0.6, 1.6); sp.position.set(0, 16, z * 1.2); sp.target.position.set(0, 0, z); scene.add(sp, sp.target); }

  // 받침 + 같은 팀 받침을 잇는 길
  const glowTex = radialTex(), shadowTex = radialTex('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)');
  const pads = {};
  for (const side of ['me', 'foe']) {
    const col = TEAM[side], top = padTexture(col); pads[side] = [];
    POS[side].forEach(([x, , z], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const r = i === 0 ? 2.3 : 2.0;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.32, 48), [new THREE.MeshStandardMaterial({ color: 0x1a2340, roughness: 0.6, metalness: 0.3 }), new THREE.MeshStandardMaterial({ map: top, roughness: 0.5, emissive: 0xffffff, emissiveMap: top, emissiveIntensity: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x1a2340 })]);
      body.position.y = 0.16; g.add(body);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color: col })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.33; g.add(rim);
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(r * 3.2, r * 3.2), new THREE.MeshBasicMaterial({ map: glowTex, color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; g.add(halo);
      // 타깃 표시 고리 (드래그 중 강조)
      const mark = new THREE.Mesh(new THREE.RingGeometry(r * 1.12, r * 1.3, 64), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      mark.rotation.x = -Math.PI / 2; mark.position.y = 0.36; g.add(mark);
      scene.add(g); pads[side].push({ g, rim, halo, mark, r });
    });
    const [[fx, , fz], [lx, , lz], [rx, , rz]] = POS[side];
    for (const [ax, az] of [[lx, lz], [rx, rz]]) {
      const len = Math.hypot(ax - fx, az - fz), path = new THREE.Mesh(new THREE.PlaneGeometry(0.9, len), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
      path.rotation.x = -Math.PI / 2; path.rotation.z = Math.atan2(ax - fx, az - fz); path.position.set((ax + fx) / 2, 0.015, (az + fz) / 2); scene.add(path);
    }
  }

  // 포켓몬 빌보드
  const loader = new THREE.TextureLoader(), units = { me: [], foe: [] };
  const UH = 3.3; // 포켓몬 높이(월드 단위)
  function setUnit(side, i, src, flip) {
    const old = units[side][i]; if (old) { old.group.parent && old.group.parent.remove(old.group); }
    const [x, , z] = POS[side][i], group = new THREE.Group(); group.position.set(x, 0.34, z);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; group.add(sh);
    const mat = new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), spr = new THREE.Sprite(mat);
    spr.center.set(0.5, 0); spr.scale.set(UH, UH, 1); group.add(spr);
    const u = { group, spr, mat, shadow: sh, base: new THREE.Vector3(x, 0.34, z), side, i, flash: 0, flashCol: new THREE.Color(1, 1, 1), tint: new THREE.Color(1, 1, 1), lunge: null, fainted: false, fade: 1 };
    if (src) loader.load(src, tex => { tex.colorSpace = THREE.SRGBColorSpace; if (flip) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; } mat.map = tex; mat.needsUpdate = true; const a = tex.image.width / tex.image.height; spr.scale.set(UH * Math.min(1.25, a), UH * Math.min(1.25, a) / a, 1); });
    scene.add(group); units[side][i] = u; return u;
  }

  // 이펙트
  const fx = [];
  function burst(pos, color, big) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.42, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); m.lookAt(cam.position); scene.add(m); fx.push({ m, t: 0, d: big ? 0.5 : 0.35, kind: 'ring', s: big ? 7 : 4.5 });
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); g.position.copy(pos); g.scale.setScalar(big ? 3.2 : 2.2); scene.add(g); fx.push({ m: g, t: 0, d: 0.3, kind: 'glow' });
  }
  function center(u) { return new THREE.Vector3().copy(u.group.position).add(new THREE.Vector3(0, u.spr.scale.y * 0.5, 0)); }
  function projectile(from, to, color, onHit) {
    const a = center(from), b = center(to), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(1.3); s.position.copy(a); scene.add(s); fx.push({ m: s, t: 0, d: 0.32, kind: 'proj', a, b, onHit });
  }
  function lunge(u, target) { const dir = new THREE.Vector3().subVectors(target ? target.group.position : new THREE.Vector3(0, 0, 0), u.base).setY(0).normalize(); u.lunge = { t: 0, dir }; }
  function hit(u, color, big) { u.flash = 1; u.flashCol.set(color || 0xffffff); u.shake = big ? 0.5 : 0.3; burst(center(u), color || 0xffffff, big); }
  function faint(u) { u.fainted = true; }
  function revive(u) { u.fainted = false; u.fade = 1; u.mat.opacity = 1; }
  function setTint(u, hex) { u.tint.set(hex == null ? 0xffffff : hex); }
  function mark(side, i, on, col) { const p = pads[side][i]; if (!p) return; p.mark.material.opacity = on ? 0.95 : 0; if (col) p.mark.material.color.set(col); }
  function aura(u, color) { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); g.position.copy(center(u)); g.scale.setScalar(4); scene.add(g); fx.push({ m: g, t: 0, d: 0.55, kind: 'glow' }); }

  // 화면 좌표
  const v = new THREE.Vector3();
  function rectOf(side, i) {
    const u = units[side][i]; if (!u) return null; const r = R.domElement.getBoundingClientRect();
    const toScr = p => { v.copy(p).project(cam); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
    const base = u.group.position, w = u.spr.scale.x, h = u.spr.scale.y;
    const [x0, y0] = toScr(new THREE.Vector3(base.x - w / 2, base.y, base.z)), [x1, y1] = toScr(new THREE.Vector3(base.x + w / 2, base.y + h, base.z));
    return { left: Math.min(x0, x1), right: Math.max(x0, x1), top: Math.min(y0, y1), bottom: Math.max(y0, y1), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function hitTest(x, y) { let best = null, bd = 1e9; for (const side of ['me', 'foe']) units[side].forEach((u, i) => { if (!u || u.fainted) return; const q = rectOf(side, i); if (!q) return; const pad = 18; if (x >= q.left - pad && x <= q.right + pad && y >= q.top - pad && y <= q.bottom + pad) { const d = Math.hypot(x - q.cx, y - q.cy); if (d < bd) { bd = d; best = { side, i }; } } }); return best; }

  // 카메라: 내 팀 뒤 위에서 상대 쪽을 내려다봄. 세로 화면이면 더 멀리
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1; R.setSize(w, h, false); cam.aspect = w / h;
    const portrait = w / h < 1; cam.fov = portrait ? 58 : 44; cam.position.set(0, portrait ? 13.5 : 10, portrait ? 21 : 17.5); cam.lookAt(0, 0.6, portrait ? -1.4 : -1); cam.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  let raf = 0, last = performance.now(), alive = true, tAll = 0;
  function frame(now) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; tAll += dt;
    for (const side of ['me', 'foe']) units[side].forEach(u => {
      if (!u) return; let off = 0, sx = 0;
      if (u.lunge) { u.lunge.t += dt; const k = u.lunge.t / 0.36; off = k < 1 ? Math.sin(k * Math.PI) * 1.4 : 0; if (k >= 1) u.lunge = null; }
      if (u.shake > 0) { u.shake -= dt; sx = Math.sin(tAll * 70) * 0.12 * (u.shake / 0.5); }
      const bob = u.fainted ? 0 : Math.sin(tAll * 2.2 + u.i * 1.7 + (u.side === 'foe' ? 1 : 0)) * 0.05;
      u.group.position.set(u.base.x + (u.lunge ? u.lunge.dir.x * off : 0) + sx, u.base.y + bob, u.base.z + (u.lunge ? u.lunge.dir.z * off : 0));
      if (u.flash > 0) u.flash = Math.max(0, u.flash - dt * 5);
      u.mat.color.copy(u.tint).lerp(u.flashCol, u.flash * 0.85);
      if (u.fainted) { u.fade = Math.max(0, u.fade - dt * 2.2); u.mat.opacity = u.fade; u.group.position.y -= (1 - u.fade) * 0.8; u.shadow.material.opacity = u.fade; }
    });
    for (let k = fx.length - 1; k >= 0; k--) { const f = fx[k]; f.t += dt; const p = Math.min(1, f.t / f.d);
      if (f.kind === 'ring') { f.m.scale.setScalar(1 + p * f.s); f.m.material.opacity = 0.9 * (1 - p); }
      else if (f.kind === 'glow') { f.m.material.opacity = 1 - p; }
      else if (f.kind === 'proj') { f.m.position.lerpVectors(f.a, f.b, p); f.m.position.y += Math.sin(p * Math.PI) * 1.6; if (p >= 1 && f.onHit) { f.onHit(); f.onHit = null; } }
      if (p >= 1) { scene.remove(f.m); f.m.material.dispose(); f.m.geometry && f.m.geometry.dispose && f.kind !== 'glow' && f.kind !== 'proj' && f.m.geometry.dispose(); fx.splice(k, 1); } }
    pads.me.concat(pads.foe).forEach((p, k) => { if (p.mark.material.opacity > 0) p.mark.rotation.z = tAll * 0.8; p.halo.material.opacity = 0.3 + Math.sin(tAll * 1.6 + k) * 0.05; });
    R.render(scene, cam);
  }
  raf = requestAnimationFrame(frame);

  return {
    setUnit, projectile, lunge, hit, faint, revive, setTint, mark, aura, rectOf, hitTest, units,
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); scene.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); }); R.dispose(); R.domElement.remove(); },
  };
}
