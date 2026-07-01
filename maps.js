// ===== MAPS.JS - 맵 3종 =====

const MapDefs = {

  // ===== 1. 태초마을 숲 =====
  forest: {
    name:'태초마을 숲',
    bgColor:'#2a5418', bgImage:'assets/bg_forest.jpg',
    pathColor:'#c8a44a', pathColorDark:'#7a5510',
    pathHighlight:'rgba(255,235,160,0.22)',
    pathArrow:'rgba(255,210,80,0.32)', pathWidth:34,

    getPaths(w, h) {
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
      // 각 구간마다 좌우에 균등 배치
      return [
        // 구간1 옆
        {x:w*0.03, y:h*0.48},{x:w*0.03, y:h*0.88},
        // 구간2 옆
        {x:w*0.15, y:h*0.10},{x:w*0.15, y:h*0.50},
        // 구간3 옆
        {x:w*0.29, y:h*0.10},{x:w*0.29, y:h*0.88},
        // 구간4 옆
        {x:w*0.43, y:h*0.10},{x:w*0.43, y:h*0.50},
        // 구간5 옆
        {x:w*0.57, y:h*0.88},{x:w*0.57, y:h*0.10},
        // 구간6 옆
        {x:w*0.71, y:h*0.10},{x:w*0.71, y:h*0.50},
        // 구간7 옆
        {x:w*0.85, y:h*0.10},{x:w*0.85, y:h*0.88},
        // 구간8 옆
        {x:w*0.96, y:h*0.50},{x:w*0.96, y:h*0.10},
        // 코너 보조
        {x:w*0.08, y:h*0.50},{x:w*0.22, y:h*0.50},
        {x:w*0.36, y:h*0.50},{x:w*0.50, y:h*0.50},
        {x:w*0.64, y:h*0.50},{x:w*0.78, y:h*0.50},
      ];
    },

    drawBg(ctx, w, h) {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#1a4010'); g.addColorStop(0.5,'#2d5c1a'); g.addColorStop(1,'#1a3a0e');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // 풀밭 패치
      for(let i=0;i<50;i++){
        const rx=(Math.sin(i*137.5)*0.5+0.5)*w, ry=(Math.sin(i*97.3)*0.5+0.5)*h;
        const r=25+Math.sin(i*43.7)*15;
        const gp=ctx.createRadialGradient(rx,ry,0,rx,ry,r);
        gp.addColorStop(0,'rgba(55,100,25,0.3)'); gp.addColorStop(1,'transparent');
        ctx.fillStyle=gp; ctx.beginPath(); ctx.ellipse(rx,ry,r,r*0.7,0,0,Math.PI*2); ctx.fill();
      }
      // 나무
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const trees=[[0.03,0.08,28],[0.11,0.05,24],[0.20,0.08,26],[0.30,0.05,22],[0.40,0.08,26],
        [0.50,0.05,24],[0.60,0.08,28],[0.70,0.05,22],[0.80,0.08,26],[0.90,0.05,24],[0.97,0.08,22],
        [0.03,0.93,26],[0.12,0.96,22],[0.22,0.93,28],[0.32,0.96,24],[0.42,0.93,22],
        [0.52,0.96,26],[0.62,0.93,24],[0.72,0.96,28],[0.82,0.93,22],[0.92,0.96,24]];
      for(const [rx,ry,sz] of trees){
        ctx.save(); ctx.globalAlpha=0.20; ctx.filter='blur(3px)';
        ctx.font=`${sz}px serif`; ctx.fillText('🌲',rx*w+3,ry*h+5); ctx.restore();
        ctx.save(); ctx.globalAlpha=0.80; ctx.font=`${sz}px serif`;
        ctx.fillText('🌲',rx*w,ry*h); ctx.restore();
      }
      const deco=[[0.33,0.48,'🌸',14],[0.59,0.48,'🌸',14],[0.44,0.12,'🌺',13],[0.88,0.12,'🌺',12]];
      for(const [rx,ry,em,sz] of deco){
        ctx.save(); ctx.globalAlpha=0.55; ctx.font=`${sz}px serif`; ctx.fillText(em,rx*w,ry*h); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha=0.9; ctx.font='28px serif'; ctx.fillText('🏰',w*0.985,h*0.70);
      ctx.font='18px serif'; ctx.fillText('🚩',8,h*0.70); ctx.restore();
    },
  },

  // ===== 2. 홍련체육관 도시 =====
  city: {
    name:'홍련체육관 도시',
    bgColor:'#180600', bgImage:'assets/bg_city.jpg',
    pathColor:'#6b4428', pathColorDark:'#3a1a08',
    pathHighlight:'rgba(255,120,40,0.18)',
    pathArrow:'rgba(255,140,60,0.32)', pathWidth:34,

    getPaths(w, h) {
      return [[
        {x:-40,     y:h*0.80},
        {x:w*0.10,  y:h*0.80},
        {x:w*0.10,  y:h*0.20},
        {x:w*0.28,  y:h*0.20},
        {x:w*0.28,  y:h*0.60},
        {x:w*0.46,  y:h*0.60},
        {x:w*0.46,  y:h*0.20},
        {x:w*0.64,  y:h*0.20},
        {x:w*0.64,  y:h*0.80},
        {x:w*0.82,  y:h*0.80},
        {x:w*0.82,  y:h*0.40},
        {x:w+40,    y:h*0.40},
      ]];
    },

    getSlots(w, h) {
      return [
        {x:w*0.03, y:h*0.55},{x:w*0.03, y:h*0.88},
        {x:w*0.19, y:h*0.10},{x:w*0.19, y:h*0.45},
        {x:w*0.19, y:h*0.88},
        {x:w*0.37, y:h*0.10},{x:w*0.37, y:h*0.40},
        {x:w*0.37, y:h*0.78},
        {x:w*0.55, y:h*0.10},{x:w*0.55, y:h*0.40},
        {x:w*0.55, y:h*0.88},
        {x:w*0.73, y:h*0.10},{x:w*0.73, y:h*0.55},
        {x:w*0.73, y:h*0.88},
        {x:w*0.93, y:h*0.22},{x:w*0.93, y:h*0.62},
      ];
    },

    drawBg(ctx, w, h) {
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#0f0400'); g.addColorStop(0.5,'#200800'); g.addColorStop(1,'#100300');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // 용암 웅덩이
      const pools=[[0.10,0.32,55,28],[0.38,0.55,70,32],[0.60,0.30,60,26],[0.80,0.62,65,30],[0.22,0.78,50,24]];
      for(const [rx,ry,rw,rh] of pools){
        const lg=ctx.createRadialGradient(rx*w,ry*h,2,rx*w,ry*h,rw);
        lg.addColorStop(0,'rgba(255,140,0,0.55)'); lg.addColorStop(0.5,'rgba(220,60,0,0.25)'); lg.addColorStop(1,'transparent');
        ctx.fillStyle=lg; ctx.beginPath(); ctx.ellipse(rx*w,ry*h,rw,rh,0,0,Math.PI*2); ctx.fill();
      }
      // 건물
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const blds=[[0.03,0.5,30],[0.15,0.88,24],[0.50,0.45,26],[0.75,0.14,28],[0.95,0.68,30]];
      for(const [rx,ry,sz] of blds){
        ctx.save(); ctx.globalAlpha=0.35; ctx.font=`${sz}px serif`; ctx.fillText('🏢',rx*w,ry*h); ctx.restore();
      }
      const fires=[[0.22,0.93],[0.48,0.07],[0.76,0.93],[0.93,0.10]];
      for(const [rx,ry] of fires){ ctx.save(); ctx.globalAlpha=0.6; ctx.font='18px serif'; ctx.fillText('🔥',rx*w,ry*h); ctx.restore(); }
      ctx.save(); ctx.globalAlpha=0.9; ctx.font='26px serif'; ctx.fillText('🏯',w*0.985,h*0.50);
      ctx.font='16px serif'; ctx.fillText('🚩',8,h*0.50); ctx.restore();
    },
  },

  // ===== 3. 라벤더 동굴 =====
  cave: {
    name:'라벤더 동굴',
    bgColor:'#050210', bgImage:'assets/bg_cave.jpg',
    pathColor:'#3e2860', pathColorDark:'#1e1030',
    pathHighlight:'rgba(180,120,255,0.18)',
    pathArrow:'rgba(160,120,255,0.28)', pathWidth:32,
    ghostBonus:0.30,

    getPaths(w, h) {
      return [
        [{x:-40,y:h*0.26},{x:w*0.22,y:h*0.26},{x:w*0.22,y:h*0.12},{x:w*0.58,y:h*0.12},{x:w*0.58,y:h*0.50},{x:w+40,y:h*0.50}],
        [{x:-40,y:h*0.74},{x:w*0.22,y:h*0.74},{x:w*0.22,y:h*0.88},{x:w*0.58,y:h*0.88},{x:w*0.58,y:h*0.50},{x:w+40,y:h*0.50}],
      ];
    },

    getSlots(w, h) {
      return [
        {x:w*0.10,y:h*0.14},{x:w*0.42,y:h*0.07},
        {x:w*0.42,y:h*0.22},{x:w*0.66,y:h*0.16},
        {x:w*0.10,y:h*0.86},{x:w*0.42,y:h*0.93},
        {x:w*0.42,y:h*0.78},{x:w*0.66,y:h*0.84},
        {x:w*0.75,y:h*0.62},{x:w*0.85,y:h*0.35},
        {x:w*0.85,y:h*0.65},{x:w*0.95,y:h*0.50},
      ];
    },

    drawBg(ctx, w, h) {
      const g=ctx.createRadialGradient(w*0.5,h*0.5,0,w*0.5,h*0.5,w*0.9);
      g.addColorStop(0,'#0d0528'); g.addColorStop(0.6,'#07021a'); g.addColorStop(1,'#020108');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // 별
      ctx.save();
      for(let i=0;i<120;i++){
        const sx=(Math.sin(i*113.7)*0.5+0.5)*w, sy=(Math.sin(i*79.3)*0.5+0.5)*h;
        const sz2=i%7===0?2.5:i%3===0?1.5:0.8, sa=0.3+(Math.sin(i*67.9)*0.5+0.5)*0.6;
        ctx.globalAlpha=sa; ctx.fillStyle=i%5===0?'#e8d0ff':'#ffffff';
        ctx.shadowColor='#d0b0ff'; ctx.shadowBlur=sz2*3;
        ctx.beginPath(); ctx.arc(sx,sy,sz2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // 성운
      const neb=[[0.12,0.50,180,'#4a00a0'],[0.45,0.15,160,'#6a00c0'],[0.45,0.85,160,'#4a00a0'],[0.72,0.50,200,'#3a0090']];
      for(const [rx,ry,r,col] of neb){
        const ng=ctx.createRadialGradient(rx*w,ry*h,0,rx*w,ry*h,r);
        ng.addColorStop(0,col+'40'); ng.addColorStop(1,'transparent');
        ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(rx*w,ry*h,r,0,Math.PI*2); ctx.fill();
      }
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const decos=[[0.06,0.50,'⛪',24],[0.30,0.50,'🪦',18],[0.56,0.50,'👻',18],[0.75,0.34,'🕯️',16],[0.75,0.66,'🕯️',16]];
      for(const [rx,ry,em,sz] of decos){ ctx.save(); ctx.globalAlpha=0.30; ctx.font=`${sz}px serif`; ctx.fillText(em,rx*w,ry*h); ctx.restore(); }
      ctx.save(); ctx.globalAlpha=0.85; ctx.font='24px serif'; ctx.fillText('💀',w*0.985,h*0.50);
      ctx.font='16px serif'; ctx.fillText('👻',8,h*0.26); ctx.fillText('👻',8,h*0.74); ctx.restore();
    },
  },
};
