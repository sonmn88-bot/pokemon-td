// ===== ARENA3D.JS — v5 포켓몬 배틀 3D 실내 스타디움 (Three.js) =====
// 어두운 돔 + 관중석 조명 띠 + 네온 라인 바닥(캔버스로 그린 텍스처) + 팀색 받침 6개(전열 1·후열 2, 길로 연결) + 스포트라이트.
// 포켓몬은 2D 일러스트를 받침 위에 세운 빌보드(스프라이트). 이펙트: 투사체·충격파·피격 번쩍임·쓰러짐.
// battle.js가 import('./arena3d.js')로 필요할 때만 불러옴. 화면 좌표 변환(hitTest·rectOf)으로 드래그 타깃 판정.
import * as THREE from 'three';

const TEAM = { me: 0x3b82f6, foe: 0xef4444 };
// 진형 좌표: [전열, 후열 왼쪽, 후열 오른쪽]. 내 팀은 카메라 쪽(z+), 상대는 안쪽(z-)
const POS = {
  me:  [[0, 0, 3.2], [-3.9, 0, 6.6], [3.9, 0, 6.6]],
  foe: [[0, 0, -3.2], [-3.9, 0, -6.6], [3.9, 0, -6.6]],
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
      const taunt = new THREE.Mesh(new THREE.RingGeometry(r * 1.3, r * 1.52, 64), new THREE.MeshBasicMaterial({ color: 0xff3c5c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); taunt.rotation.x = -Math.PI / 2; taunt.position.y = 0.37; g.add(taunt); taunt.userData.on = false;
      scene.add(g); pads[side].push({ g, rim, halo, mark, r, taunt });
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

  // ---------- 이펙트: 타입마다 모양이 다르고, 기술 종류(기본/주력/특수)·특성(빙결·독·연쇄·밀어내기…)이 덧붙음 ----------
  const TC = { fire: 0xff6b3d, water: 0x3fa9ff, electric: 0xffd84a, grass: 0x58d06b, psychic: 0xc77dff, normal: 0xf0f0f8 };
  const mkTex = draw => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const TX = {
    glow: glowTex,
    flame: mkTex(g => { const r = g.createRadialGradient(64, 88, 4, 64, 76, 56); r.addColorStop(0, 'rgba(255,255,235,1)'); r.addColorStop(.4, 'rgba(255,196,80,.95)'); r.addColorStop(1, 'rgba(255,90,10,0)'); g.fillStyle = r; g.beginPath(); g.moveTo(64, 4); g.bezierCurveTo(98, 42, 114, 72, 100, 100); g.bezierCurveTo(90, 124, 38, 124, 28, 100); g.bezierCurveTo(14, 72, 32, 44, 64, 4); g.fill(); }),
    drop: mkTex(g => { const r = g.createRadialGradient(56, 84, 4, 64, 80, 50); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(190,225,255,.9)'); g.fillStyle = r; g.beginPath(); g.moveTo(64, 6); g.bezierCurveTo(84, 40, 104, 62, 104, 86); g.bezierCurveTo(104, 112, 24, 112, 24, 86); g.bezierCurveTo(24, 62, 44, 40, 64, 6); g.fill(); }),
    leaf: mkTex(g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(10, 64); g.quadraticCurveTo(64, 2, 118, 64); g.quadraticCurveTo(64, 126, 10, 64); g.fill(); g.strokeStyle = 'rgba(0,70,20,.45)'; g.lineWidth = 5; g.beginPath(); g.moveTo(14, 64); g.lineTo(112, 64); g.stroke(); }),
    star: mkTex(g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 2); g.quadraticCurveTo(70, 58, 126, 64); g.quadraticCurveTo(70, 70, 64, 126); g.quadraticCurveTo(58, 70, 2, 64); g.quadraticCurveTo(58, 58, 64, 2); g.fill(); }),
    shard: mkTex(g => { const r = g.createLinearGradient(40, 0, 90, 128); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(150,215,255,.9)'); g.fillStyle = r; g.beginPath(); g.moveTo(64, 2); g.lineTo(94, 64); g.lineTo(64, 126); g.lineTo(34, 64); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.stroke(); }),
    bubble: mkTex(g => { g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 6; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 32, 3.6, 4.5); g.stroke(); }),
    ring: mkTex(g => { g.strokeStyle = '#fff'; g.lineWidth = 9; g.shadowColor = '#fff'; g.shadowBlur = 10; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); }),
    plus: mkTex(g => { g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillRect(50, 14, 28, 100); g.fillRect(14, 50, 100, 28); }),
    streak: mkTex(g => { const r = g.createLinearGradient(0, 0, 128, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(.6, 'rgba(255,255,255,.9)'); r.addColorStop(1, '#fff'); g.fillStyle = r; g.beginPath(); g.moveTo(0, 64); g.lineTo(110, 52); g.quadraticCurveTo(128, 64, 110, 76); g.closePath(); g.fill(); }),
    arrow: mkTex(g => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 6); g.lineTo(112, 64); g.lineTo(80, 64); g.lineTo(80, 122); g.lineTo(48, 122); g.lineTo(48, 64); g.lineTo(16, 64); g.closePath(); g.fill(); }),
  };
  const FXS = 1.45; // 이펙트 전체 크기 배율 (모바일 작은 화면에서도 또렷하게)
  const V = (x, y, z) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a);
  const parts = [], rings = [], shots = [], timers = [];
  let shakeT = 0, shakeAmp = 0;
  const shake = a => { shakeAmp = Math.max(shakeAmp, a); shakeT = 0.3; };
  const after = (sec, fn) => timers.push({ t: sec, fn });
  function spawn(o) { // 파티클 한 개 (스프라이트)
    if (parts.length > 320) return;
    const mat = new THREE.SpriteMaterial({ map: TX[o.tex] || TX.glow, color: o.color == null ? 0xffffff : o.color, transparent: true, depthWrite: false, blending: o.normal ? THREE.NormalBlending : THREE.AdditiveBlending, opacity: 1, rotation: o.rot || 0 });
    const s = new THREE.Sprite(mat); s.position.copy(o.pos); s.scale.setScalar(o.s0 * FXS); if (o.sx) s.scale.x = o.s0 * FXS * o.sx; scene.add(s);
    parts.push({ s, mat, vel: o.vel || V(0, 0, 0), life: o.life, t: 0, s0: o.s0 * FXS, s1: (o.s1 == null ? o.s0 : o.s1) * FXS, sx: o.sx || 1, grav: o.grav || 0, spin: o.spin || 0, drag: o.drag || 0, delay: o.delay || 0, fade: o.fade == null ? 1.2 : o.fade });
    if (o.delay) s.visible = false;
  }
  function ring(pos, color, size, dur, flat = true) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(pos); if (flat) { m.rotation.x = -Math.PI / 2; m.position.y = 0.07; } else m.lookAt(cam.position);
    m.scale.setScalar(0.1); scene.add(m); rings.push({ m, t: 0, d: dur, s: size * 1.15 });
  }
  function bolt(a, b, color, width = 1, life = 0.2, jag = 0.55) { // 번개: 지그재그 점들을 빛 스프라이트로 이어 그림 (살짝 깜빡임)
    for (let rep = 0; rep < 2; rep++) {
      const n = 16, dir = new THREE.Vector3().subVectors(b, a), len = dir.length(), side = new THREE.Vector3(-dir.z, 0, dir.x).normalize(), up = V(0, 1, 0);
      for (let i = 0; i <= n; i++) { const p = i / n, j = i === 0 || i === n ? 0 : 1, pos = new THREE.Vector3().lerpVectors(a, b, p).addScaledVector(side, rnd(-jag, jag) * j).addScaledVector(up, rnd(-jag, jag) * j);
        spawn({ tex: 'glow', pos, color, life, s0: 0.9 * width, s1: 0.25 * width, delay: rep * 0.07, fade: 1 }); spawn({ tex: 'glow', pos, color: 0xffffff, life: life * 0.8, s0: 0.38 * width, s1: 0.12, delay: rep * 0.07, fade: 1 }); }
    }
  }
  function shot(o) { // 날아가는 투사체 {a,b,dur,arc,tex,color,size,trail,off,onHit,miss}
    const mat = new THREE.SpriteMaterial({ map: TX[o.tex] || TX.glow, color: o.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, rotation: o.rot || 0 }), s = new THREE.Sprite(mat);
    s.scale.setScalar(o.size * FXS); s.position.copy(o.a); scene.add(s); shots.push(Object.assign({ s, mat, t: -(o.delay || 0), arc: 0, spin: 0 }, o));
  }
  const center = u => new THREE.Vector3().copy(u.group.position).add(new THREE.Vector3(0, u.spr.scale.y * 0.5, 0));
  const footOf = u => V(u.group.position.x, 0.1, u.group.position.z);
  function lunge(u, target) { const dir = new THREE.Vector3().subVectors(target ? target.group.position : new THREE.Vector3(0, 0, 0), u.base).setY(0).normalize(); u.lunge = { t: 0, dir }; }
  // 도착까지 걸리는 시간(초): 화면 숫자·번쩍임 타이밍 맞춤
  const TRAVEL = { fire: 0.32, water: 0.36, electric: 0.12, grass: 0.42, psychic: 0.5, normal: 0.2 };
  function delayOf(spec) { const f = spec.fx || []; return (TRAVEL[spec.type] || 0.25) + (spec.foes ? 0.14 : 0) + (f.includes('hits') ? 0.2 : 0); }

  // 타입별 날아가는 모양 + 도착 효과
  function fly(type, from, to, a, b, big, spec, delay = 0, k = 1) {
    const miss = spec.miss, tb = miss ? new THREE.Vector3().subVectors(b, a).normalize().multiplyScalar(4).add(b) : b, dur = TRAVEL[type] || 0.25, col = TC[type] || 0xffffff;
    const done = () => { if (miss) { spawn({ tex: 'glow', pos: tb.clone(), color: col, life: 0.3, s0: 0.8, s1: 0.1 }); return; } impact(to, type, big * k, spec); };
    if (type === 'electric') { // 번개는 즉시 줄기. 주력기는 하늘에서 내리꽂음
      after(delay, () => { bolt(a, tb, col, 1.25 * big, 0.26); spawn({ tex: 'glow', pos: a.clone(), color: col, life: 0.25, s0: 2.2, s1: 0.2 });
        if (spec.slot === 'main' && !miss) { bolt(V(b.x + 0.4, 14, b.z), b, 0xffffff, 1.5, 0.26, 0.9); shake(0.3); } after(0.1, done); });
      return;
    }
    const base = { a: a.clone(), b: tb, dur, color: col, onHit: done, delay };
    if (type === 'fire') shot({ ...base, tex: 'flame', size: 1.3 * big, arc: 1.1, trail(p) { spawn({ tex: 'glow', pos: p.clone().add(V(rnd(-.15, .15), rnd(-.1, .2), rnd(-.15, .15))), vel: V(rnd(-.4, .4), rnd(.4, 1.4), rnd(-.4, .4)), color: 0xff8a3a, life: 0.4, s0: 0.55 * big, s1: 0.05 }); spawn({ tex: 'flame', pos: p.clone(), color: 0xffb060, life: 0.28, s0: 0.7 * big, s1: 0.1 }); } });
    else if (type === 'water') shot({ ...base, tex: 'drop', size: 1.1 * big, arc: 1.6, color: 0xbfe6ff, trail(p) { spawn({ tex: 'drop', pos: p.clone(), vel: V(rnd(-.5, .5), rnd(0, .6), rnd(-.5, .5)), color: 0x6fc2ff, life: 0.5, s0: 0.38 * big, s1: 0.1, grav: 7, fade: 1 }); } });
    else if (type === 'grass') { const n = Math.round(5 * big); for (let i = 0; i < n; i++) { const ph = i / n * Math.PI * 2; shot({ ...base, delay: delay + i * 0.025, dur: dur + 0.04, tex: 'leaf', color: i % 2 ? 0x7be08a : 0x3fb85a, size: 0.7 * Math.min(1.4, big), arc: 0.6, spin: 9, rot: ph, off(p) { const r = Math.sin(p * Math.PI) * 0.95; return V(Math.cos(ph + p * 9) * r * 0.5, Math.sin(ph + p * 9) * r, Math.sin(ph + p * 9 + 1.5) * r * 0.5); }, onHit: i === 0 ? done : null, trail(p) { if (Math.random() < 0.4) spawn({ tex: 'glow', pos: p.clone(), color: 0x9cf0a8, life: 0.3, s0: 0.3, s1: 0.02 }); } }); } }
    else if (type === 'psychic') shot({ ...base, tex: 'glow', size: 1.6 * big, color: 0xc77dff, arc: 0.5, off(p) { return V(Math.sin(p * 18) * 0.35, Math.cos(p * 18) * 0.35, 0); }, trail(p, dt) { spawn({ tex: 'ring', pos: p.clone(), color: 0xe0b0ff, life: 0.32, s0: 0.4, s1: 1.7 * big, fade: 1 }); spawn({ tex: 'star', pos: p.clone().add(V(rnd(-.3, .3), rnd(-.3, .3), rnd(-.3, .3))), color: 0xffe6ff, life: 0.35, s0: 0.3, s1: 0.04, vel: V(0, .6, 0) }); } });
    else shot({ ...base, tex: 'star', size: 1.0 * big, arc: 0.35, color: 0xffffff, spin: 14, dur: 0.2, trail(p) { spawn({ tex: 'glow', pos: p.clone(), color: 0xffffff, life: 0.22, s0: 0.65 * big, s1: 0.05 }); } });
  }
  // 도착 효과
  function impact(to, type, big, spec) {
    const c = center(to), ft = footOf(to), col = TC[type] || 0xffffff, F = spec.fx || [], n = Math.round(10 * big);
    to.flash = 1; to.flashCol.set(col); to.shake = 0.28 * Math.min(2, big); if (big > 1.4) shake(0.22 * big);
    spawn({ tex: 'glow', pos: c.clone(), color: col, life: 0.3, s0: 1.4 * big, s1: 3.4 * big });
    if (type === 'fire') { ring(ft, 0xff8a3a, 4.2 * big, 0.5); for (let i = 0; i < n; i++) spawn({ tex: 'flame', pos: c.clone().add(V(rnd(-.5, .5), rnd(-.6, .2), rnd(-.3, .3))), vel: V(rnd(-1.6, 1.6), rnd(1.4, 4), rnd(-1.6, 1.6)), life: rnd(.45, .8), s0: rnd(.8, 1.4) * big * .8, s1: 0.1, grav: -1.5 }); for (let i = 0; i < n * 1.4; i++) spawn({ tex: 'glow', pos: c.clone(), vel: V(rnd(-3.5, 3.5), rnd(-1, 4), rnd(-3.5, 3.5)), color: 0xffa04a, life: rnd(.4, .9), s0: .28, s1: .03, grav: 4 }); }
    else if (type === 'water') { ring(ft, 0x7fd0ff, 5.2 * big, 0.6); ring(ft, 0xffffff, 3 * big, 0.45); for (let i = 0; i < n * 1.4; i++) { const a = rnd(0, 6.28), sp = rnd(1.5, 4); spawn({ tex: 'drop', pos: c.clone(), vel: V(Math.cos(a) * sp, rnd(2, 5), Math.sin(a) * sp), color: 0x9bdcff, life: rnd(.6, 1), s0: rnd(.3, .55), s1: .1, grav: 11, fade: 1 }); } }
    else if (type === 'electric') { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), sp = rnd(3, 7); spawn({ tex: 'star', pos: c.clone(), vel: V(Math.cos(a) * sp, rnd(-1, 4), Math.sin(a) * sp), color: 0xfff08a, life: rnd(.2, .4), s0: rnd(.4, .9), s1: .05, spin: rnd(-12, 12) }); } ring(ft, 0xffe14a, 3.4 * big, 0.3); spawn({ tex: 'star', pos: c.clone(), color: 0xffffff, life: 0.22, s0: 3.2 * big, s1: 0.4, spin: 6 }); }
    else if (type === 'grass') { ring(ft, 0x6be07a, 4 * big, 0.55); for (let i = 0; i < n * 1.2; i++) { const a = rnd(0, 6.28), sp = rnd(1, 3.4); spawn({ tex: 'leaf', pos: c.clone(), vel: V(Math.cos(a) * sp, rnd(1, 4), Math.sin(a) * sp), color: i % 2 ? 0x7be08a : 0x3fb85a, life: rnd(.7, 1.1), s0: rnd(.4, .7), s1: .15, grav: 3.5, spin: rnd(-9, 9), fade: 1 }); } }
    else if (type === 'psychic') { for (let i = 0; i < 3; i++) spawn({ tex: 'ring', pos: c.clone(), color: i === 1 ? 0xffffff : 0xc77dff, life: 0.5, s0: 0.5, s1: (3.2 + i * 1.5) * big, delay: i * 0.1, fade: 1 }); for (let i = 0; i < n; i++) spawn({ tex: 'star', pos: c.clone().add(V(rnd(-1, 1), rnd(-1, 1), rnd(-.5, .5))), vel: V(0, rnd(.8, 2.4), 0), color: 0xf0c8ff, life: rnd(.6, 1), s0: rnd(.3, .6), s1: .05, spin: rnd(-4, 4) }); to.tint.set(0xe0b0ff); after(0.45, () => { to.tint.set(0xffffff); }); }
    else { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; spawn({ tex: 'streak', pos: c.clone().add(V(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0)), vel: V(Math.cos(a) * 4, Math.sin(a) * 4, 0), color: 0xffffff, life: 0.28, s0: 1.2 * big, s1: 0.3, rot: a, fade: 1 }); } spawn({ tex: 'star', pos: c.clone(), color: 0xffffff, life: 0.3, s0: 2.6 * big, s1: 0.6 }); ring(ft, 0xffffff, 3.6 * big, 0.35); }
    // 특성 덧붙임
    if (F.includes('st')) { const st = spec.fxst; if (st === 'freeze') { ring(ft, 0xa8e4ff, 4.4, 0.6); for (let i = 0; i < 9; i++) { const a = rnd(0, 6.28), sp = rnd(1.5, 3.5); spawn({ tex: 'shard', pos: c.clone(), vel: V(Math.cos(a) * sp, rnd(.5, 3.2), Math.sin(a) * sp), color: 0xcfeeff, life: rnd(.6, 1), s0: rnd(.35, .7), s1: .1, grav: 4, spin: rnd(-6, 6), fade: 1 }); } }
      else if (st === 'poison') { for (let i = 0; i < 7; i++) spawn({ tex: 'bubble', pos: c.clone().add(V(rnd(-.8, .8), rnd(-.8, .4), rnd(-.4, .4))), vel: V(0, rnd(.6, 1.6), 0), color: 0xc27cff, life: rnd(.9, 1.4), s0: rnd(.25, .5), s1: rnd(.5, .8), fade: 1 }); }
      else if (st === 'burn') { for (let i = 0; i < 6; i++) spawn({ tex: 'glow', pos: c.clone().add(V(rnd(-.7, .7), rnd(-.6, .3), 0)), vel: V(0, rnd(.8, 1.8), 0), color: 0xff7a2a, life: rnd(.8, 1.4), s0: .36, s1: .05, delay: rnd(0, .5) }); }
      else if (st === 'shock') { for (let i = 0; i < 6; i++) spawn({ tex: 'star', pos: c.clone().add(V(rnd(-.8, .8), rnd(-.8, .8), 0)), color: 0xfff08a, life: 0.2, s0: rnd(.4, .7), s1: .05, delay: i * 0.09, spin: 8 }); } }
    if (F.includes('push')) { ring(ft, 0xffffff, 5.6, 0.4); const dir = new THREE.Vector3().subVectors(to.group.position, V(0, 0, 0)).setY(0).normalize(); to.knock = { t: 0, dir }; shake(0.2); }
    if (F.includes('slow')) { ring(ft, 0x9a7bff, 3.6, 0.8); for (let i = 0; i < 5; i++) spawn({ tex: 'bubble', pos: ft.clone().add(V(rnd(-.8, .8), 0.3, rnd(-.8, .8))), vel: V(0, rnd(.2, .6), 0), color: 0x8a6bd0, life: 1.1, s0: .4, s1: .5, normal: false, fade: 1 }); }
    if (F.includes('recoil')) { spawn({ tex: 'glow', pos: c.clone(), color: 0xff9a3a, life: 0.5, s0: 2, s1: 7 * big }); ring(ft, 0xff8a3a, 7, 0.6); for (let i = 0; i < 12; i++) spawn({ tex: 'flame', pos: c.clone(), vel: V(rnd(-4, 4), rnd(1, 5), rnd(-4, 4)), life: .7, s0: 1.2, s1: .1, grav: -1 }); shake(0.5); }
    if (F.includes('pierce')) { spawn({ tex: 'streak', pos: c.clone(), color: 0xffffff, life: 0.25, s0: 4, s1: 6, rot: 0, fade: 1 }); }
  }
  function accent(u, o) { // 급소·상성 강조 (피해가 확정된 뒤)
    if (!u) return; const c = center(u);
    if (o.crit) { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; spawn({ tex: 'star', pos: c.clone(), vel: V(Math.cos(a) * 5, Math.sin(a) * 5 + 1, 0), color: 0xffd34d, life: .4, s0: .7, s1: .1, spin: 6 }); } spawn({ tex: 'star', pos: c.clone(), color: 0xffe9a0, life: .3, s0: 4, s1: 1 }); shake(0.35); }
    else if (o.eff > 1) { ring(footOf(u), 0xff8a5a, 5, 0.45); }
    else if (o.eff < 1) { spawn({ tex: 'glow', pos: c.clone(), color: 0x8a94a8, life: .5, s0: 1.4, s1: 2.4, normal: true }); }
  }
  // 날아가지 않는 기술: 이득(회복·강화)·방해·광역
  function cast(from, tos, spec) {
    const type = spec.type || 'normal', slot = spec.slot || 'basic', kind = spec.kind || 'atk', F = spec.fx || [], col = TC[type] || 0xffffff, big = slot === 'main' ? 1.55 : slot === 'special' ? 1.25 : 1, a = center(from);
    if (kind === 'heal') { for (const to of tos) { const c = center(to); ring(footOf(to), 0x5be39a, 3.8, 0.7); for (let i = 0; i < 8; i++) spawn({ tex: 'plus', pos: c.clone().add(V(rnd(-.9, .9), rnd(-1.2, .2), rnd(-.4, .4))), vel: V(0, rnd(.8, 1.8), 0), color: 0x5be39a, life: rnd(.8, 1.3), s0: rnd(.25, .45), s1: .05, delay: rnd(0, .3), fade: 1 }); to.flash = .6; to.flashCol.set(0x5be39a); } return; }
    if (kind === 'buff') { const tb = tos[0] || from, c = center(tb); if (F.includes('taunt')) { for (let i = 0; i < 3; i++) ring(footOf(tb), 0xff5c7a, 7 + i * 2, 0.7 + i * 0.1, true); spawn({ tex: 'glow', pos: c.clone(), color: 0xff3c5c, life: .5, s0: 2, s1: 6 }); shake(0.3); }
      else { ring(footOf(tb), col, 3.6, 0.6); ring(footOf(tb), 0xffffff, 2.2, 0.45); for (let i = 0; i < 7; i++) spawn({ tex: 'arrow', pos: c.clone().add(V(rnd(-1, 1), rnd(-1.2, 0), rnd(-.4, .4))), vel: V(0, rnd(1.2, 2.4), 0), color: 0xffd34d, life: rnd(.7, 1.1), s0: rnd(.25, .4), s1: .08, delay: rnd(0, .3), fade: 1 }); tb.flash = .5; tb.flashCol.set(0xffd34d); } return; }
    if (kind === 'debuff') { for (const to of tos) { const c = center(to); bolt(a, c, 0xb59bff, 0.6, 0.25, 0.3); ring(footOf(to), 0x9a7bff, 4, 0.7); for (let i = 0; i < 6; i++) spawn({ tex: 'arrow', pos: c.clone().add(V(rnd(-.8, .8), rnd(0, 1), 0)), vel: V(0, -rnd(1, 2), 0), color: 0x9fb4ff, life: .9, s0: .35, s1: .08, delay: rnd(0, .3), fade: 1, rot: Math.PI }); to.flash = .5; to.flashCol.set(0x9a7bff); } return; }
    if (spec.foes) { const fc = tos.length ? center(tos[0]) : a; ring(footOf(from), col, 6, 0.5); after(0.05, () => { const f0 = tos.length ? footOf(tos[0]) : V(0, 0.1, 0); ring(V(f0.x, 0.1, f0.z * 0.7), col, 16, 0.7); }); shake(0.25); }
    const hits = F.includes('hits') ? 3 : 1;
    tos.forEach((to, k) => { const b = center(to); for (let h = 0; h < hits; h++) fly(type, from, to, a, b, big, spec, (spec.foes ? 0.1 + k * 0.09 : 0) + h * 0.1, hits > 1 ? 0.7 : 1); });
  }
  function flashHit(u, color, big) { if (!u) return; u.flash = 1; u.flashCol.set(color || 0xffffff); u.shake = big ? 0.5 : 0.3; }
  function faint(u) { u.fainted = true; const c = center(u); for (let i = 0; i < 14; i++) spawn({ tex: 'glow', pos: c.clone().add(V(rnd(-.8, .8), rnd(-1, 1), 0)), vel: V(rnd(-1, 1), rnd(.5, 2.5), rnd(-1, 1)), color: 0xdde6ff, life: rnd(.6, 1.1), s0: rnd(.25, .5), s1: .02, fade: 1 }); }
  function revive(u) { u.fainted = false; u.fade = 1; u.mat.opacity = 1; }
  function setTint(u, hex) { u.tint.set(hex == null ? 0xffffff : hex); }
  const DEFMARK = 0xffd34d;
  function mark(side, i, on, col) { const p = pads[side][i]; if (!p) return; p.mark.material.opacity = on ? 0.95 : 0; p.mark.scale.setScalar(1); p.mark.material.color.set(col || DEFMARK); p.mark.userData.base = col || DEFMARK; }
  function lit(side, i) { for (const sd of ['me', 'foe']) pads[sd].forEach((p, k) => { const on = sd === side && k === i && i != null; p.mark.scale.setScalar(on ? 1.2 : 1); if (p.mark.material.opacity > 0) p.mark.material.color.set(on ? 0xffffff : (p.mark.userData.base || DEFMARK)); }); }
  function setTaunt(side, i, on) { const p = pads[side][i]; if (p) p.taunt.userData.on = !!on; }
  function aura(u, color) { cast(u, [u], { type: 'normal', kind: 'buff', fx: [] }); }
  function stepFx(dt) {
    for (let k = timers.length - 1; k >= 0; k--) { const m = timers[k]; m.t -= dt; if (m.t <= 0) { timers.splice(k, 1); try { m.fn(); } catch (_) {} } }
    for (let k = shots.length - 1; k >= 0; k--) { const o = shots[k]; o.t += dt; if (o.t < 0) { o.s.visible = false; continue; } o.s.visible = true; const p = Math.min(1, o.t / o.dur);
      o.s.position.lerpVectors(o.a, o.b, p); o.s.position.y += Math.sin(p * Math.PI) * o.arc; if (o.off) o.s.position.add(o.off(p)); if (o.spin) o.mat.rotation += o.spin * dt; if (o.trail) o.trail(o.s.position, dt, p);
      if (p >= 1) { o.onHit && o.onHit(); scene.remove(o.s); o.mat.dispose(); shots.splice(k, 1); } }
    for (let k = rings.length - 1; k >= 0; k--) { const r = rings[k]; r.t += dt; const p = Math.min(1, r.t / r.d); r.m.scale.setScalar(Math.max(0.05, r.s * (1 - (1 - p) * (1 - p)))); r.m.material.opacity = 0.95 * (1 - p); if (p >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(k, 1); } }
    for (let k = parts.length - 1; k >= 0; k--) { const q = parts[k]; if (q.delay > 0) { q.delay -= dt; if (q.delay <= 0) q.s.visible = true; continue; }
      q.t += dt; const p = q.t / q.life; if (p >= 1) { scene.remove(q.s); q.mat.dispose(); parts.splice(k, 1); continue; }
      q.s.position.addScaledVector(q.vel, dt); q.vel.y -= q.grav * dt; if (q.drag) q.vel.multiplyScalar(1 - q.drag * dt);
      const sc = q.s0 + (q.s1 - q.s0) * p; q.s.scale.set(sc * q.sx, sc, 1); q.mat.opacity = Math.pow(1 - p, q.fade); if (q.spin) q.mat.rotation += q.spin * dt; }
  }

  // 화면 좌표 (드래그 타깃 판정·숫자 팝업 위치)
  const v = new THREE.Vector3();
  function rectOf(side, i) {
    const u = units[side][i]; if (!u) return null; const r = R.domElement.getBoundingClientRect();
    const toScr = p => { v.copy(p).project(cam); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
    const base = u.group.position, w = u.spr.scale.x, h = u.spr.scale.y;
    const [x0, y0] = toScr(new THREE.Vector3(base.x - w / 2, base.y, base.z)), [x1, y1] = toScr(new THREE.Vector3(base.x + w / 2, base.y + h, base.z));
    return { left: Math.min(x0, x1), right: Math.max(x0, x1), top: Math.min(y0, y1), bottom: Math.max(y0, y1), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  // 가장 가까운 대상: 포켓몬 몸통 안에서만 판정 (겹치면 중심이 가장 가까운 쪽)
  function hitTest(x, y) { let best = null, bd = 1e9; for (const side of ['me', 'foe']) units[side].forEach((u, i) => { if (!u || u.fainted) return; const q = rectOf(side, i); if (!q) return; const pad = 14; if (x >= q.left - pad && x <= q.right + pad && y >= q.top - pad && y <= q.bottom + pad) { const d = Math.hypot(x - q.cx, y - q.cy); if (d < bd) { bd = d; best = { side, i }; } } }); return best; }

  // 카메라: 내 팀 뒤 위에서 상대 쪽을 내려다봄. 세로 화면이면 더 멀리
  const YAW = 0.42, camPos0 = new THREE.Vector3(), look0 = new THREE.Vector3();
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1; R.setSize(w, h, false); cam.aspect = w / h;
    // 세로 화면: 위에서 더 내려다보게(빈 하늘을 줄이고 양옆 후열이 잘리지 않게), 가로 너비 기준으로 거리 맞춤
    const portrait = w / h < 1, a = w / h; cam.fov = portrait ? 50 : 42;
    const dist = portrait ? Math.max(22.5, 15.2 / a) : 19, yaw = YAW; // 옆으로 돌아간 시점 → 진형이 대각선으로 놓임
    cam.position.set(Math.sin(yaw) * dist * 0.8, dist * 0.8, Math.cos(yaw) * dist * 0.8); look0.set(portrait ? -1.0 : 0, 0, portrait ? 0.6 : 0); cam.lookAt(look0); cam.updateProjectionMatrix(); camPos0.copy(cam.position);
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
      let kx = 0, kz = 0; if (u.knock) { u.knock.t += dt; const kk = u.knock.t / 0.5; if (kk < 1) { const m = Math.sin(kk * Math.PI) * 0.9; kx = u.knock.dir.x * m; kz = u.knock.dir.z * m; } else u.knock = null; }
      u.group.position.set(u.base.x + (u.lunge ? u.lunge.dir.x * off : 0) + sx + kx, u.base.y + bob, u.base.z + (u.lunge ? u.lunge.dir.z * off : 0) + kz);
      if (u.flash > 0) u.flash = Math.max(0, u.flash - dt * 5);
      u.mat.color.copy(u.tint).lerp(u.flashCol, u.flash * 0.85);
      if (u.fainted) { u.fade = Math.max(0, u.fade - dt * 2.2); u.mat.opacity = u.fade; u.group.position.y -= (1 - u.fade) * 0.8; u.shadow.material.opacity = u.fade; }
    });
    stepFx(dt);
    pads.me.concat(pads.foe).forEach((p, k) => { p.taunt.material.opacity = p.taunt.userData.on ? 0.55 + Math.sin(tAll * 7) * 0.3 : 0; if (p.mark.material.opacity > 0) p.mark.rotation.z = tAll * 0.8; p.halo.material.opacity = 0.3 + Math.sin(tAll * 1.6 + k) * 0.05; });
    if (shakeT > 0) { shakeT -= dt; const a = shakeAmp * Math.max(0, shakeT / 0.3); cam.position.set(camPos0.x + rnd(-a, a), camPos0.y + rnd(-a, a), camPos0.z + rnd(-a, a)); cam.lookAt(look0); if (shakeT <= 0) { shakeAmp = 0; cam.position.copy(camPos0); cam.lookAt(look0); } }
    R.render(scene, cam);
  }
  raf = requestAnimationFrame(frame);

  return {
    setUnit, cast, accent, delayOf, flashHit, lunge, faint, revive, setTint, mark, lit, setTaunt, aura, shake, rectOf, hitTest, units,
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); scene.traverse(o => { o.geometry && o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); }); R.dispose(); R.domElement.remove(); },
  };
}
