// ===== MAPS.JS - 킹덤러쉬 스타일 맵 3종 =====

const MapDefs = {

  // ===== 1. 태초마을 숲 =====
  forest: {
    name:'태초마을 숲',
    bgColor:'#2a5418', bgImage:'assets/bg_forest.jpg',
    pathColor:'#c8a44a',
    pathColorDark:'#7a5510',
    pathHighlight:'rgba(255,235,160,0.22)',
    pathArrow:'rgba(255,210,80,0.32)',
    pathWidth:36,

    getPaths(w, h) {
      // 촘촘한 8구간 지그재그
      return [[
        {x:-40,     y:h*0.75},
        {x:w*0.08,  y:h*0.75},
        {x:w*0.08,  y:h*0.20},
        {x:w*0.22,  y:h*0.20},
        {x:w*0.22,  y:h*0.75},
        {x:w*0.36,  y:h*0.75},
        {x:w*0.36,  y:h*0.20},
        {x:w*0.50,  y:h*0.20},
        {x:w*0.50,  y:h*0.75},
        {x:w*0.64,  y:h*0.75},
        {x:w*0.64,  y:h*0.20},
        {x:w*0.78,  y:h*0.20},
        {x:w*0.78,  y:h*0.75},
        {x:w*0.92,  y:h*0.75},
        {x:w*0.92,  y:h*0.20},
        {x:w+40,    y:h*0.20},
      ]];
    },

    getSlots(w, h) {
      return [
        {x:w*0.03, y:h*0.50},{x:w*0.03, y:h*0.88},
        {x:w*0.15, y:h*0.10},{x:w*0.15, y:h*0.50},
        {x:w*0.29, y:h*0.10},{x:w*0.29, y:h*0.88},
        {x:w*0.43, y:h*0.10},{x:w*0.43, y:h*0.50},
        {x:w*0.57, y:h*0.88},{x:w*0.57, y:h*0.10},
        {x:w*0.71, y:h*0.10},{x:w*0.71, y:h*0.50},
        {x:w*0.85, y:h*0.10},{x:w*0.85, y:h*0.88},
        {x:w*0.96, y:h*0.50},{x:w*0.96, y:h*0.10},
        {x:w*0.08, y:h*0.50},{x:w*0.22, y:h*0.50},
        {x:w*0.36, y:h*0.50},{x:w*0.50, y:h*0.50},
        {x:w*0.64, y:h*0.50},{x:w*0.78, y:h*0.50},
      ];
    },

    drawBg(ctx, w, h) {
      // 기본 초원 그라디언트
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a4010');
      g.addColorStop(0.4, '#2d5c1a');
      g.addColorStop(1, '#1a3a0e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      // 입체 풀밭 패치 (밝고 어두운 영역으로 지형 느낌)
      const patches = [
        [0.08,0.18,110,80,'#3a7020'],[0.28,0.45,90,70,'#1a4010'],
        [0.55,0.18,120,85,'#358018'],[0.75,0.45,100,75,'#264a14'],
        [0.18,0.82,130,60,'#3a7020'],[0.68,0.82,110,65,'#2a5a18'],
        [0.42,0.62,80,55,'#1e4812'],
      ];
      for (const [rx,ry,rw,rh,col] of patches) {
        const gp = ctx.createRadialGradient(rx*w,ry*h,0,rx*w,ry*h,rw);
        gp.addColorStop(0, col+'99');
        gp.addColorStop(1, 'transparent');
        ctx.fillStyle = gp;
        ctx.beginPath(); ctx.ellipse(rx*w,ry*h,rw,rh,0,0,Math.PI*2); ctx.fill();
      }

      // 꽃 + 덤불 장식 (입체 그림자 포함)
      const flora = [
        [0.04,0.12,'🌳',34],[0.12,0.06,'🌲',30],[0.22,0.09,'🌳',32],[0.34,0.06,'🌲',28],
        [0.46,0.10,'🌳',34],[0.58,0.07,'🌲',30],[0.70,0.09,'🌳',32],[0.82,0.06,'🌲',28],
        [0.92,0.10,'🌳',30],[0.97,0.06,'🌲',26],
        [0.04,0.91,'🌲',32],[0.14,0.94,'🌳',28],[0.26,0.91,'🌲',30],[0.38,0.93,'🌳',26],
        [0.50,0.91,'🌲',32],[0.62,0.93,'🌳',28],[0.74,0.91,'🌲',30],[0.86,0.94,'🌳',26],
        [0.96,0.92,'🌲',28],
      ];
      ctx.textAlign='center'; ctx.textBaseline='middle';
      for (const [rx,ry,em,sz] of flora) {
        // 그림자
        ctx.save(); ctx.globalAlpha=0.25;
        ctx.filter='blur(3px)';
        ctx.font=`${sz}px serif`;
        ctx.fillText(em, rx*w+4, ry*h+6);
        ctx.restore();
        // 본체
        ctx.save(); ctx.globalAlpha=0.85;
        ctx.font=`${sz}px serif`;
        ctx.fillText(em, rx*w, ry*h);
        ctx.restore();
      }

      // 중간 장식 (꽃, 버섯)
      const deco = [
        [0.33,0.48,'🌸',16],[0.59,0.48,'🌸',16],[0.15,0.48,'🌿',14],
        [0.44,0.15,'🌺',16],[0.88,0.15,'🌺',14],[0.63,0.15,'🍄',14],
      ];
      for (const [rx,ry,em,sz] of deco) {
        ctx.save(); ctx.globalAlpha=0.60;
        ctx.font=`${sz}px serif`;
        ctx.fillText(em, rx*w, ry*h);
        ctx.restore();
      }

      // 입출구 마커
      ctx.save(); ctx.globalAlpha=0.95;
      ctx.font='30px serif'; ctx.fillText('🏰', w*0.985, h*0.70);
      ctx.font='18px serif'; ctx.fillText('🚩', 8, h*0.70);
      ctx.restore();

      // 경로 위 잔디 질감 (점선)
      ctx.save();
      ctx.strokeStyle='rgba(255,255,220,0.06)'; ctx.lineWidth=1; ctx.setLineDash([2,18]);
      for (let y=h*0.1; y<h*0.95; y+=18) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    },
  },

  // ===== 2. 홍련체육관 도시 (용암 도시) =====
  city: {
    name:'홍련체육관 도시',
    bgColor:'#180600', bgImage:'assets/bg_city.jpg',
    pathColor:'#6b4428',
    pathColorDark:'#3a1a08',
    pathHighlight:'rgba(255,120,40,0.18)',
    pathArrow:'rgba(255,140,60,0.32)',
    pathWidth:36,

    getPaths(w, h) {
      // 도시 블록 패턴 - 격자형 긴 경로
      return [[
        {x:-40,      y:h*0.80},
        {x:w*0.12,   y:h*0.80},
        {x:w*0.12,   y:h*0.20},
        {x:w*0.30,   y:h*0.20},
        {x:w*0.30,   y:h*0.60},
        {x:w*0.48,   y:h*0.60},
        {x:w*0.48,   y:h*0.20},
        {x:w*0.66,   y:h*0.20},
        {x:w*0.66,   y:h*0.80},
        {x:w*0.84,   y:h*0.80},
        {x:w*0.84,   y:h*0.40},
        {x:w+40,     y:h*0.40},
      ]];
    },

    getSlots(w, h) {
      return [
        {x:w*0.04, y:h*0.60},{x:w*0.04, y:h*0.92},
        {x:w*0.21, y:h*0.10},{x:w*0.21, y:h*0.50},
        {x:w*0.21, y:h*0.90},
        {x:w*0.39, y:h*0.10},{x:w*0.39, y:h*0.40},
        {x:w*0.39, y:h*0.75},
        {x:w*0.57, y:h*0.10},{x:w*0.57, y:h*0.40},
        {x:w*0.57, y:h*0.90},
        {x:w*0.75, y:h*0.10},{x:w*0.75, y:h*0.60},
        {x:w*0.75, y:h*0.92},
        {x:w*0.93, y:h*0.20},{x:w*0.93, y:h*0.60},
      ];
    },

    drawBg(ctx, w, h) {
      // 어두운 화산 기반
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#0f0400'); g.addColorStop(0.5,'#200800'); g.addColorStop(1,'#100300');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

      // 용암 풀 (여러 개, glow 효과)
      const lavaPools = [
        [0.10,0.32,55,30],[0.38,0.55,70,35],[0.60,0.30,60,28],
        [0.80,0.62,65,32],[0.22,0.78,50,25],[0.70,0.78,55,28],
      ];
      for (const [rx,ry,rw,rh] of lavaPools) {
        // 용암 바닥
        ctx.save();
        const lg = ctx.createRadialGradient(rx*w,ry*h,2,rx*w,ry*h,rw);
        lg.addColorStop(0,'rgba(255,140,0,0.55)');
        lg.addColorStop(0.5,'rgba(220,60,0,0.30)');
        lg.addColorStop(1,'transparent');
        ctx.fillStyle=lg;
        ctx.beginPath(); ctx.ellipse(rx*w,ry*h,rw,rh,0,0,Math.PI*2); ctx.fill();
        // 테두리 glow
        ctx.strokeStyle='rgba(255,100,0,0.4)'; ctx.lineWidth=1.5;
        ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.ellipse(rx*w,ry*h,rw*0.7,rh*0.7,0,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // 균열 라인
      ctx.save();
      ctx.strokeStyle='rgba(255,80,0,0.20)'; ctx.lineWidth=1.5;
      const cracks = [
        [[0.05,0.5],[0.15,0.45],[0.12,0.55]],
        [[0.45,0.1],[0.52,0.18],[0.48,0.25]],
        [[0.65,0.7],[0.72,0.78],[0.68,0.85]],
        [[0.85,0.3],[0.90,0.38],[0.88,0.45]],
      ];
      for (const pts of cracks) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0]*w, pts[0][1]*h);
        for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i][0]*w, pts[i][1]*h);
        ctx.stroke();
      }
      ctx.restore();

      // 건물 실루엣
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const buildings = [
        [0.03,0.5,32],[0.14,0.86,26],[0.30,0.5,30],[0.55,0.45,28],
        [0.75,0.14,30],[0.95,0.68,32],[0.47,0.93,26],
      ];
      for (const [rx,ry,sz] of buildings) {
        ctx.save();
        ctx.globalAlpha=0.40;
        ctx.filter='blur(1px)'; ctx.font=`${sz}px serif`;
        ctx.fillText('🏢', rx*w+3, ry*h+5);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha=0.50; ctx.font=`${sz}px serif`;
        ctx.fillText('🏢', rx*w, ry*h);
        ctx.restore();
      }

      // 불꽃 + 연기
      const fires = [[0.22,0.93],[0.48,0.07],[0.76,0.93],[0.93,0.10],[0.05,0.85]];
      for (const [rx,ry] of fires) {
        ctx.save(); ctx.globalAlpha=0.65;
        ctx.font='20px serif'; ctx.fillText('🔥', rx*w, ry*h);
        ctx.restore();
      }

      // 전체 빨간 안개
      const fog = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w*0.8);
      fog.addColorStop(0,'transparent');
      fog.addColorStop(1,'rgba(60,0,0,0.35)');
      ctx.fillStyle=fog; ctx.fillRect(0,0,w,h);

      // 입출구
      ctx.save(); ctx.globalAlpha=0.90;
      ctx.font='28px serif'; ctx.fillText('🏯', w*0.985, h*0.50);
      ctx.font='18px serif'; ctx.fillText('🚩', 8, h*0.50);
      ctx.restore();
    },
  },

  // ===== 3. 라벤더 동굴 (유령 마을) =====
  cave: {
    name:'라벤더 동굴',
    bgColor:'#050210', bgImage:'assets/bg_cave.jpg',
    pathColor:'#3e2860',
    pathColorDark:'#1e1030',
    pathHighlight:'rgba(180,120,255,0.18)',
    pathArrow:'rgba(160,120,255,0.28)',
    pathWidth:32,
    ghostBonus:0.30,

    getPaths(w, h) {
      return [
        [
          {x:-40,      y:h*0.26},
          {x:w*0.22,   y:h*0.26},
          {x:w*0.22,   y:h*0.12},
          {x:w*0.58,   y:h*0.12},
          {x:w*0.58,   y:h*0.50},
          {x:w+40,     y:h*0.50},
        ],
        [
          {x:-40,      y:h*0.74},
          {x:w*0.22,   y:h*0.74},
          {x:w*0.22,   y:h*0.88},
          {x:w*0.58,   y:h*0.88},
          {x:w*0.58,   y:h*0.50},
          {x:w+40,     y:h*0.50},
        ],
      ];
    },

    getSlots(w, h) {
      return [
        {x:w*0.10, y:h*0.14}, {x:w*0.42, y:h*0.07},
        {x:w*0.42, y:h*0.22}, {x:w*0.66, y:h*0.16},
        {x:w*0.10, y:h*0.86}, {x:w*0.42, y:h*0.93},
        {x:w*0.42, y:h*0.78}, {x:w*0.66, y:h*0.84},
        {x:w*0.75, y:h*0.62},
      ];
    },

    drawBg(ctx, w, h) {
      // 짙은 우주 배경
      const g = ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,w*0.9);
      g.addColorStop(0,'#0d0528'); g.addColorStop(0.6,'#07021a'); g.addColorStop(1,'#020108');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

      // 별 (크기 3단계)
      ctx.save();
      for (let i=0; i<120; i++) {
        const sx=(Math.sin(i*113.7)*0.5+0.5)*w;
        const sy=(Math.sin(i*79.3)*0.5+0.5)*h;
        const sz=i%7===0?2.5:i%3===0?1.5:0.8;
        const sa=0.3+(Math.sin(i*67.9)*0.5+0.5)*0.6;
        ctx.globalAlpha=sa;
        ctx.fillStyle=i%5===0?'#e8d0ff':i%4===0?'#c0e8ff':'#ffffff';
        ctx.shadowColor='#d0b0ff'; ctx.shadowBlur=sz*3;
        ctx.beginPath(); ctx.arc(sx,sy,sz,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 보라 성운 (큰 글로우 패치)
      const nebulae = [
        [0.12,0.50,180,'#4a00a0'],[0.45,0.15,160,'#6a00c0'],
        [0.45,0.85,160,'#4a00a0'],[0.72,0.50,200,'#3a0090'],
        [0.90,0.28,140,'#5500b0'],[0.90,0.72,140,'#4500a0'],
      ];
      ctx.save();
      for (const [rx,ry,r,col] of nebulae) {
        const ng = ctx.createRadialGradient(rx*w,ry*h,0,rx*w,ry*h,r);
        ng.addColorStop(0,col+'40'); ng.addColorStop(0.5,col+'18'); ng.addColorStop(1,'transparent');
        ctx.fillStyle=ng;
        ctx.beginPath(); ctx.arc(rx*w,ry*h,r,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();

      // 묘지/유령 장식
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const decos = [
        [0.06,0.50,'⛪',26],[0.30,0.50,'🪦',20],[0.56,0.50,'💀',18],
        [0.75,0.34,'🕯️',18],[0.75,0.66,'🕯️',18],
        [0.88,0.20,'🦇',20],[0.88,0.80,'🦇',20],
        [0.18,0.20,'🌙',22],[0.18,0.80,'🌙',22],
      ];
      for (const [rx,ry,em,sz] of decos) {
        // 그림자
        ctx.save(); ctx.globalAlpha=0.20;
        ctx.filter='blur(4px)'; ctx.font=`${sz}px serif`;
        ctx.fillText(em,rx*w+3,ry*h+4);
        ctx.restore();
        ctx.save(); ctx.globalAlpha=0.35;
        ctx.font=`${sz}px serif`;
        ctx.fillText(em,rx*w,ry*h);
        ctx.restore();
      }

      // 바닥 안개
      const mist = ctx.createLinearGradient(0,h*0.7,0,h);
      mist.addColorStop(0,'transparent');
      mist.addColorStop(1,'rgba(60,0,100,0.30)');
      ctx.fillStyle=mist; ctx.fillRect(0,h*0.7,w,h*0.3);

      // 입출구
      ctx.save(); ctx.globalAlpha=0.90;
      ctx.font='26px serif'; ctx.fillText('💀', w*0.985, h*0.50);
      ctx.font='16px serif'; ctx.fillText('👻', 8, h*0.26);
      ctx.fillText('👻', 8, h*0.74);
      ctx.restore();
    },
  },
};
