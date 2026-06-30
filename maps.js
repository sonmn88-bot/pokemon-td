// ===== MAPS.JS - 맵 3종 정의 =====

const MapDefs = {

  // ===== 태초마을 숲 =====
  forest: {
    name: '태초마을 숲',
    bgColor: '#1a3a1a',
    pathColor: '#6b4c2a',

    getPaths(w, h) {
      // 구불구불한 단일 경로
      return [[
        { x: -30,       y: h * 0.72 },
        { x: w * 0.15,  y: h * 0.72 },
        { x: w * 0.15,  y: h * 0.28 },
        { x: w * 0.38,  y: h * 0.28 },
        { x: w * 0.38,  y: h * 0.72 },
        { x: w * 0.62,  y: h * 0.72 },
        { x: w * 0.62,  y: h * 0.28 },
        { x: w * 0.85,  y: h * 0.28 },
        { x: w * 0.85,  y: h * 0.72 },
        { x: w + 30,    y: h * 0.72 },
      ]];
    },

    getSlots(w, h) {
      return [
        // 1번 구간 옆
        { x: w * 0.06,  y: h * 0.50 },
        { x: w * 0.06,  y: h * 0.85 },
        // 2번 구간 옆
        { x: w * 0.27,  y: h * 0.50 },
        { x: w * 0.27,  y: h * 0.14 },
        // 3번 구간 옆
        { x: w * 0.50,  y: h * 0.50 },
        { x: w * 0.50,  y: h * 0.14 },
        // 4번 구간 옆
        { x: w * 0.73,  y: h * 0.50 },
        { x: w * 0.73,  y: h * 0.14 },
        // 5번 구간 옆
        { x: w * 0.93,  y: h * 0.50 },
        { x: w * 0.93,  y: h * 0.85 },
      ];
    },

    drawBg(ctx, w, h) {
      // 나무 점점이
      const trees = [
        [0.05, 0.1], [0.22, 0.05], [0.45, 0.08], [0.68, 0.05], [0.9, 0.1],
        [0.05, 0.9], [0.22, 0.92], [0.45, 0.9], [0.68, 0.92], [0.9, 0.88],
        [0.32, 0.50], [0.58, 0.50],
      ];
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [rx, ry] of trees) {
        ctx.globalAlpha = 0.5;
        ctx.fillText('🌲', rx * w, ry * h);
      }
      ctx.globalAlpha = 1;
    },
  },

  // ===== 홍련체육관 도시 =====
  city: {
    name: '홍련체육관 도시',
    bgColor: '#1a0a0a',
    pathColor: '#555566',

    getPaths(w, h) {
      // 짧고 직선에 가까운 경로
      return [[
        { x: -30,       y: h * 0.50 },
        { x: w * 0.20,  y: h * 0.50 },
        { x: w * 0.20,  y: h * 0.22 },
        { x: w * 0.50,  y: h * 0.22 },
        { x: w * 0.50,  y: h * 0.78 },
        { x: w * 0.80,  y: h * 0.78 },
        { x: w * 0.80,  y: h * 0.50 },
        { x: w + 30,    y: h * 0.50 },
      ]];
    },

    getSlots(w, h) {
      return [
        { x: w * 0.10,  y: h * 0.30 },
        { x: w * 0.10,  y: h * 0.70 },
        { x: w * 0.35,  y: h * 0.10 },
        { x: w * 0.35,  y: h * 0.40 },
        { x: w * 0.65,  y: h * 0.60 },
        { x: w * 0.65,  y: h * 0.90 },
        { x: w * 0.90,  y: h * 0.30 },
        { x: w * 0.90,  y: h * 0.65 },
      ];
    },

    drawBg(ctx, w, h) {
      // 도시 그리드 패턴
      ctx.save();
      ctx.strokeStyle = 'rgba(255,80,80,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.restore();
      // 건물 이모지
      const blds = [[0.03,0.5],[0.15,0.88],[0.55,0.45],[0.75,0.12],[0.92,0.7]];
      ctx.font = '20px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [rx, ry] of blds) {
        ctx.globalAlpha = 0.4;
        ctx.fillText('🏢', rx * w, ry * h);
      }
      ctx.globalAlpha = 1;
    },
  },

  // ===== 라벤더 동굴 =====
  cave: {
    name: '라벤더 동굴',
    bgColor: '#0d0a1a',
    pathColor: '#3a2a5a',
    ghostBonus: 0.30, // 유령타입 HP +30%

    getPaths(w, h) {
      // 2갈래 경로 (위/아래)
      return [
        // 위쪽 경로
        [
          { x: -30,       y: h * 0.28 },
          { x: w * 0.25,  y: h * 0.28 },
          { x: w * 0.25,  y: h * 0.15 },
          { x: w * 0.60,  y: h * 0.15 },
          { x: w * 0.60,  y: h * 0.50 },
          { x: w + 30,    y: h * 0.50 },
        ],
        // 아래쪽 경로
        [
          { x: -30,       y: h * 0.72 },
          { x: w * 0.25,  y: h * 0.72 },
          { x: w * 0.25,  y: h * 0.85 },
          { x: w * 0.60,  y: h * 0.85 },
          { x: w * 0.60,  y: h * 0.50 },
          { x: w + 30,    y: h * 0.50 },
        ],
      ];
    },

    getSlots(w, h) {
      return [
        // 위쪽 경로 옆
        { x: w * 0.12,  y: h * 0.15 },
        { x: w * 0.40,  y: h * 0.10 },
        { x: w * 0.40,  y: h * 0.32 },
        { x: w * 0.75,  y: h * 0.25 },
        // 아래쪽 경로 옆
        { x: w * 0.12,  y: h * 0.85 },
        { x: w * 0.40,  y: h * 0.68 },
        { x: w * 0.40,  y: h * 0.90 },
        { x: w * 0.75,  y: h * 0.75 },
        // 중앙
        { x: w * 0.80,  y: h * 0.50 },
      ];
    },

    drawBg(ctx, w, h) {
      // 안개 효과
      const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w * 0.7);
      grad.addColorStop(0, 'rgba(100,50,150,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // 유령 이모지
      const ghosts = [[0.1,0.5],[0.45,0.50],[0.88,0.50],[0.7,0.38]];
      ctx.font = '18px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [rx, ry] of ghosts) {
        ctx.globalAlpha = 0.25;
        ctx.fillText('👻', rx * w, ry * h);
      }
      ctx.globalAlpha = 1;
    },
  },
};
