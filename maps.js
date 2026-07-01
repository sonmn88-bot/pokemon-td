// ===== MAPS.JS - 맵 3종 완전 재설계 (킹덤러쉬 스타일) =====

const MapDefs = {

  // ===== 태초마을 숲 (초록 왕국 스타일) =====
  forest: {
    name: '태초마을 숲',
    bgColor: '#2d5a1b',
    pathColor: '#c8a45a',
    pathColorDark: '#8b6914',
    pathHighlight: 'rgba(255,240,180,0.18)',
    pathArrow: 'rgba(255,220,100,0.30)',
    pathWidth: 34,

    getPaths(w, h) {
      return [[
        { x: -40,        y: h * 0.70 },
        { x: w * 0.13,   y: h * 0.70 },
        { x: w * 0.13,   y: h * 0.25 },
        { x: w * 0.37,   y: h * 0.25 },
        { x: w * 0.37,   y: h * 0.70 },
        { x: w * 0.63,   y: h * 0.70 },
        { x: w * 0.63,   y: h * 0.25 },
        { x: w * 0.87,   y: h * 0.25 },
        { x: w * 0.87,   y: h * 0.70 },
        { x: w + 40,     y: h * 0.70 },
      ]];
    },

    getSlots(w, h) {
      return [
        { x: w * 0.05,  y: h * 0.56 },
        { x: w * 0.05,  y: h * 0.84 },
        { x: w * 0.21,  y: h * 0.48 },
        { x: w * 0.07,  y: h * 0.33 },
        { x: w * 0.26,  y: h * 0.16 },
        { x: w * 0.45,  y: h * 0.16 },
        { x: w * 0.45,  y: h * 0.50 },
        { x: w * 0.28,  y: h * 0.64 },
        { x: w * 0.50,  y: h * 0.84 },
        { x: w * 0.67,  y: h * 0.84 },
        { x: w * 0.69,  y: h * 0.50 },
        { x: w * 0.53,  y: h * 0.33 },
        { x: w * 0.72,  y: h * 0.16 },
        { x: w * 0.91,  y: h * 0.16 },
        { x: w * 0.93,  y: h * 0.50 },
        { x: w * 0.79,  y: h * 0.64 },
        { x: w * 0.95,  y: h * 0.84 },
        { x: w * 0.93,  y: h * 0.56 },
      ];
    },

    drawBg(ctx, w, h) {
      // 초원 그라디언트 레이어
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1e4a0f');
      g.addColorStop(0.5, '#2d5a1b');
      g.addColorStop(1, '#1e4a0f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 풀밭 노이즈 패턴
      ctx.save();
      for (let i = 0; i < 60; i++) {
        const rx = (Math.sin(i * 137.5) * 0.5 + 0.5) * w;
        const ry = (Math.sin(i * 97.3) * 0.5 + 0.5) * h;
        const r = 20 + (Math.sin(i * 43.7) * 0.5 + 0.5) * 35;
        const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, r);
        grad.addColorStop(0, 'rgba(60,110,30,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // 나무들 (크기 차이 있게)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const trees = [
        [0.03,0.09,28],[0.09,0.04,22],[0.19,0.07,26],[0.31,0.05,24],[0.43,0.09,20],
        [0.55,0.05,26],[0.67,0.08,22],[0.79,0.06,28],[0.91,0.09,24],[0.97,0.05,20],
        [0.03,0.92,26],[0.11,0.95,22],[0.24,0.90,28],[0.36,0.94,24],[0.48,0.91,20],
        [0.60,0.95,26],[0.72,0.90,22],[0.84,0.94,28],[0.95,0.91,24],
      ];
      for (const [rx, ry, sz] of trees) {
        ctx.globalAlpha = 0.75;
        ctx.font = `${sz}px serif`;
        ctx.fillText('🌲', rx * w, ry * h);
      }

      // 꽃/버섯 장식
      const deco = [
        [0.32,0.50,'🌸',16],[0.58,0.50,'🌸',16],
        [0.15,0.50,'🌿',14],[0.62,0.13,'🍄',14],
        [0.37,0.13,'🌺',16],[0.87,0.13,'🌺',14],
      ];
      for (const [rx, ry, em, sz] of deco) {
        ctx.globalAlpha = 0.55;
        ctx.font = `${sz}px serif`;
        ctx.fillText(em, rx * w, ry * h);
      }

      // 성문(출발/도착) 표시
      ctx.globalAlpha = 0.9;
      ctx.font = '28px serif';
      ctx.fillText('🏰', w * 0.97, h * 0.70);
      ctx.font = '22px serif';
      ctx.fillText('🚩', 0, h * 0.70);

      ctx.globalAlpha = 1;
    },
  },

  // ===== 홍련체육관 도시 (화산/용암 도시 스타일) =====
  city: {
    name: '홍련체육관 도시',
    bgColor: '#1a0800',
    pathColor: '#7a5535',
    pathColorDark: '#4a2a10',
    pathHighlight: 'rgba(255,120,40,0.15)',
    pathArrow: 'rgba(255,150,60,0.30)',
    pathWidth: 34,

    getPaths(w, h) {
      return [[
        { x: -40,        y: h * 0.50 },
        { x: w * 0.18,   y: h * 0.50 },
        { x: w * 0.18,   y: h * 0.20 },
        { x: w * 0.50,   y: h * 0.20 },
        { x: w * 0.50,   y: h * 0.80 },
        { x: w * 0.82,   y: h * 0.80 },
        { x: w * 0.82,   y: h * 0.50 },
        { x: w + 40,     y: h * 0.50 },
      ]];
    },

    getSlots(w, h) {
      return [
        { x: w * 0.08,  y: h * 0.36 },
        { x: w * 0.18,  y: h * 0.66 },
        { x: w * 0.31,  y: h * 0.12 },
        { x: w * 0.38,  y: h * 0.35 },
        { x: w * 0.62,  y: h * 0.65 },
        { x: w * 0.69,  y: h * 0.88 },
        { x: w * 0.92,  y: h * 0.36 },
        { x: w * 0.82,  y: h * 0.64 },
      ];
    },

    drawBg(ctx, w, h) {
      // 어두운 용암 배경
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a0800');
      g.addColorStop(0.5, '#2a0e00');
      g.addColorStop(1, '#120600');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 용암 균열 (glow spots)
      ctx.save();
      const lava = [
        [0.12,0.3],[0.35,0.7],[0.55,0.35],[0.72,0.15],[0.88,0.65],[0.22,0.88],[0.65,0.82]
      ];
      for (const [rx,ry] of lava) {
        const gr = ctx.createRadialGradient(rx*w,ry*h,0,rx*w,ry*h,50+Math.random()*30);
        gr.addColorStop(0,'rgba(255,100,0,0.18)');
        gr.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(rx*w,ry*h,80,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 그리드 (포장도로)
      ctx.save();
      ctx.strokeStyle = 'rgba(200,80,0,0.07)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 45) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 45) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      }
      ctx.restore();

      // 건물/장식
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const blds = [
        [0.03,0.5,30],[0.15,0.88,24],[0.30,0.5,28],[0.55,0.45,26],
        [0.75,0.12,28],[0.92,0.7,30],[0.46,0.92,24],
      ];
      for (const [rx,ry,sz] of blds) {
        ctx.globalAlpha = 0.45;
        ctx.font = `${sz}px serif`;
        ctx.fillText('🏢', rx*w, ry*h);
      }

      // 불꽃 장식
      const fires = [[0.25,0.92],[0.48,0.08],[0.75,0.92],[0.92,0.08]];
      for (const [rx,ry] of fires) {
        ctx.globalAlpha = 0.6;
        ctx.font = '20px serif';
        ctx.fillText('🔥', rx*w, ry*h);
      }

      // 입출구
      ctx.globalAlpha = 0.9;
      ctx.font = '28px serif';
      ctx.fillText('🏯', w*0.97, h*0.50);
      ctx.font = '20px serif';
      ctx.fillText('🚩', 0, h*0.50);
      ctx.globalAlpha = 1;
    },
  },

  // ===== 라벤더 동굴 (유령 마을 스타일) =====
  cave: {
    name: '라벤더 동굴',
    bgColor: '#07030f',
    pathColor: '#4a3566',
    pathColorDark: '#2a1a44',
    pathHighlight: 'rgba(180,120,255,0.15)',
    pathArrow: 'rgba(180,140,255,0.25)',
    pathWidth: 32,
    ghostBonus: 0.30,

    getPaths(w, h) {
      return [
        // 위 경로
        [
          { x: -40,       y: h * 0.26 },
          { x: w * 0.22,  y: h * 0.26 },
          { x: w * 0.22,  y: h * 0.13 },
          { x: w * 0.58,  y: h * 0.13 },
          { x: w * 0.58,  y: h * 0.50 },
          { x: w + 40,    y: h * 0.50 },
        ],
        // 아래 경로
        [
          { x: -40,       y: h * 0.74 },
          { x: w * 0.22,  y: h * 0.74 },
          { x: w * 0.22,  y: h * 0.87 },
          { x: w * 0.58,  y: h * 0.87 },
          { x: w * 0.58,  y: h * 0.50 },
          { x: w + 40,    y: h * 0.50 },
        ],
      ];
    },

    getSlots(w, h) {
      return [
        { x: w * 0.10, y: h * 0.14 },
        { x: w * 0.40, y: h * 0.07 },
        { x: w * 0.40, y: h * 0.22 },
        { x: w * 0.66, y: h * 0.16 },
        { x: w * 0.10, y: h * 0.86 },
        { x: w * 0.40, y: h * 0.93 },
        { x: w * 0.40, y: h * 0.78 },
        { x: w * 0.66, y: h * 0.84 },
        { x: w * 0.75, y: h * 0.62 },
      ];
    },

    drawBg(ctx, w, h) {
      // 짙은 보라/검정 배경
      const g = ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,w*0.8);
      g.addColorStop(0,'#0f061e');
      g.addColorStop(1,'#03010a');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,w,h);

      // 신비한 보라빛 안개
      ctx.save();
      const mists = [
        [0.1,0.5,200],[0.45,0.15,180],[0.45,0.85,180],
        [0.7,0.5,220],[0.9,0.3,150],[0.9,0.7,150],
      ];
      for (const [rx,ry,r] of mists) {
        const gm = ctx.createRadialGradient(rx*w,ry*h,0,rx*w,ry*h,r);
        gm.addColorStop(0,'rgba(120,60,200,0.12)');
        gm.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle = gm;
        ctx.beginPath(); ctx.arc(rx*w,ry*h,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 별빛 (작은 점들)
      ctx.save();
      for (let i = 0; i < 80; i++) {
        const sx = (Math.sin(i*113.7)*0.5+0.5)*w;
        const sy = (Math.sin(i*79.3)*0.5+0.5)*h;
        const sr = 0.5 + (Math.sin(i*43.1)*0.5+0.5)*1.5;
        const sa = 0.2 + (Math.sin(i*67.9)*0.5+0.5)*0.5;
        ctx.globalAlpha = sa;
        ctx.fillStyle = '#e8d0ff';
        ctx.beginPath(); ctx.arc(sx,sy,sr,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 묘비/유령 장식
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const decos = [
        [0.05,0.50,'⛪',24],[0.30,0.50,'🪦',18],[0.55,0.50,'👻',20],
        [0.75,0.35,'🕯️',16],[0.75,0.65,'🕯️',16],[0.88,0.22,'🦇',18],[0.88,0.78,'🦇',18],
      ];
      for (const [rx,ry,em,sz] of decos) {
        ctx.globalAlpha = 0.30;
        ctx.font = `${sz}px serif`;
        ctx.fillText(em,rx*w,ry*h);
      }

      // 입출구
      ctx.globalAlpha = 0.85;
      ctx.font = '26px serif';
      ctx.fillText('👻', w*0.97, h*0.50);
      ctx.font = '18px serif';
      ctx.fillText('🚩', 0, h*0.26);
      ctx.fillText('🚩', 0, h*0.74);
      ctx.globalAlpha = 1;
    },
  },
};
