// ===== MAPS.JS - 맵 3종 =====

const MapDefs = {

  // ===== 1. 태초마을 숲 =====
  forest: {
    name:'태초마을 숲',
    bgColor:'#2a5418',
    // v27-58: 실사 잔디/흙길 텍스처 (Cethiel, CC0 - opengameart.org)
    bgTextures:['assets/textures/grass_01.jpg','assets/textures/grass_02.jpg','assets/textures/grass_03.jpg','assets/textures/grass_04.jpg'],
    bgTileSize:280,
    pathTextures:['assets/textures/dirt_02.jpg','assets/textures/dirt_03.jpg'],
    pathTileSize:44,
    pathColor:'#c8a44a', pathColorDark:'#7a5510',
    pathHighlight:'rgba(255,235,160,0.16)',
    pathArrow:'rgba(255,210,80,0.32)', pathWidth:20,

    // 순환 트랙 (스타 랜덤디펜스 스타일): 적이 사각 트랙을 계속 돌며,
    // 제한시간 내에 처치해야 한다. 슬롯은 트랙 안쪽에 격자로 배치.
    loopMargin: {x:0.09, y:0.13},
    slotGrid: {cols:5, rows:4},

    // v27-24 버그수정: 대각선으로 그려지던 문제(중간 꺾이는 점 누락) 수정 - 세로이동/가로이동을
    // 항상 분리된 점으로 나눠서 직각 지그재그가 되도록 함. 5단으로 확장 (요청 - 더 꼬불꼬불하게)
    getPaths(w, h) {
      const mx = w*0.15, my = h*0.20;
      const innerGap = w*0.08; // 지그재그가 왼쪽에서 멈추는 지점 (왼쪽 가장자리는 복귀 통로로 남김)
      const FOLDS = 6; // v27-47: 카메라로 넓게 볼 수 있게 되어 4→6단으로 확장 (요청A - 월드가 커진 만큼 더 꼬불꼬불하게)
      const pts = [{x:mx, y:my}, {x:w-mx, y:my}];
      let curX = w-mx;
      for (let i = 1; i <= FOLDS; i++) {
        const y = my + (h - 2*my) * (i / (FOLDS + 1));
        const goLeft = i % 2 === 1;
        const nextX = goLeft ? mx+innerGap : w-mx;
        pts.push({ x: curX, y });      // 세로로 내려감 (x는 그대로)
        pts.push({ x: nextX, y });     // 가로로 이동 (y는 그대로)
        curX = nextX;
      }
      pts.push({ x: curX, y: h-my });  // 마지막 밴드까지 세로로 내려감
      pts.push({ x: mx, y: h-my });    // 바닥을 가로질러 왼쪽 끝으로
      pts.push({ x: mx, y: my });      // 왼쪽 가장자리를 타고 복귀 (루프 닫힘)
      return [pts];
    },

    // v27-22: 지그재그 경로의 3개 밴드(위/중간/아래) 사이 공간에 슬롯 배치 - 경로 선과 안 겹치게
    getSlots(w, h) {
      const slots = [];
      const mx = w*0.15, my = h*0.20;
      const innerGap = w*0.08;
      const FOLDS = 6; // v27-47: getPaths와 동일해야 밴드가 맞물림 (4→6단 확장)
      // 밴드 경계 y좌표들 (getPaths의 꺾이는 지점과 동일하게 계산)
      const bounds = [my];
      for (let i = 1; i <= FOLDS; i++) bounds.push(my + (h - 2*my) * (i / (FOLDS + 1)));
      bounds.push(h - my);
      const bandY = [];
      for (let i = 0; i < bounds.length - 1; i++) bandY.push((bounds[i] + bounds[i+1]) / 2); // 각 밴드 중앙
      const x0 = mx + innerGap + w*0.05, x1 = w - mx - w*0.04;
      // v27-24: 좁은 화면(모바일)에서는 슬롯이 너무 촘촘해지지 않도록 컬럼수를 줄임 (요청1)
      const cols = w < 500 ? 4 : w < 750 ? 5 : 6;
      for (const y of bandY) {
        for (let c = 0; c < cols; c++) {
          slots.push({ x: x0 + (x1-x0) * (c/(cols-1)), y });
        }
      }
      // 왼쪽 복귀 통로 옆 여유공간에도 세로로 슬롯 몇 개 추가 (공간 활용)
      const leftX = mx * 0.5 + innerGap * 0.15;
      for (let i = 0; i < bounds.length - 1; i++) {
        slots.push({ x: leftX, y: (bounds[i] + bounds[i+1]) / 2 });
      }
      return slots;
    },

    drawBg(ctx, w, h) {
      // v27-58: 바닥은 이제 실사 잔디 텍스처(bgTextures)가 채움. 여기선 음영 패치/장식만 추가.
      // 풀밭 패치 (짙은 그림자로 질감에 입체감 추가)
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
    bgColor:'#180600',
    // v27-58: 실사 용암/벽돌 텍스처 (CC0 - opengameart.org)
    bgTextures:['assets/textures/lava_01.jpg','assets/textures/lava_02.jpg'],
    bgTileSize:420,
    pathTextures:['assets/textures/brick_02.jpg','assets/textures/brick_03.jpg'],
    pathTileSize:46,
    pathColor:'#6b4428', pathColorDark:'#3a1a08',
    pathHighlight:'rgba(255,120,40,0.14)',
    pathArrow:'rgba(255,140,60,0.32)', pathWidth:20,

    // v27-3: 존 전환해도 타워 위치가 깨지지 않도록 3맵 모두 동일한 트랙/슬롯 좌표 사용 (숲맵 기준 통일)
    // v27-24 버그수정: 대각선으로 그려지던 문제(중간 꺾이는 점 누락) 수정 - 세로이동/가로이동을
    // 항상 분리된 점으로 나눠서 직각 지그재그가 되도록 함. 5단으로 확장 (요청 - 더 꼬불꼬불하게)
    getPaths(w, h) {
      const mx = w*0.15, my = h*0.20;
      const innerGap = w*0.08; // 지그재그가 왼쪽에서 멈추는 지점 (왼쪽 가장자리는 복귀 통로로 남김)
      const FOLDS = 6; // v27-47: 카메라로 넓게 볼 수 있게 되어 4→6단으로 확장 (요청A - 월드가 커진 만큼 더 꼬불꼬불하게)
      const pts = [{x:mx, y:my}, {x:w-mx, y:my}];
      let curX = w-mx;
      for (let i = 1; i <= FOLDS; i++) {
        const y = my + (h - 2*my) * (i / (FOLDS + 1));
        const goLeft = i % 2 === 1;
        const nextX = goLeft ? mx+innerGap : w-mx;
        pts.push({ x: curX, y });      // 세로로 내려감 (x는 그대로)
        pts.push({ x: nextX, y });     // 가로로 이동 (y는 그대로)
        curX = nextX;
      }
      pts.push({ x: curX, y: h-my });  // 마지막 밴드까지 세로로 내려감
      pts.push({ x: mx, y: h-my });    // 바닥을 가로질러 왼쪽 끝으로
      pts.push({ x: mx, y: my });      // 왼쪽 가장자리를 타고 복귀 (루프 닫힘)
      return [pts];
    },

    // v27-22: 지그재그 경로의 3개 밴드(위/중간/아래) 사이 공간에 슬롯 배치 - 경로 선과 안 겹치게
    getSlots(w, h) {
      const slots = [];
      const mx = w*0.15, my = h*0.20;
      const innerGap = w*0.08;
      const FOLDS = 6; // v27-47: getPaths와 동일해야 밴드가 맞물림 (4→6단 확장)
      // 밴드 경계 y좌표들 (getPaths의 꺾이는 지점과 동일하게 계산)
      const bounds = [my];
      for (let i = 1; i <= FOLDS; i++) bounds.push(my + (h - 2*my) * (i / (FOLDS + 1)));
      bounds.push(h - my);
      const bandY = [];
      for (let i = 0; i < bounds.length - 1; i++) bandY.push((bounds[i] + bounds[i+1]) / 2); // 각 밴드 중앙
      const x0 = mx + innerGap + w*0.05, x1 = w - mx - w*0.04;
      // v27-24: 좁은 화면(모바일)에서는 슬롯이 너무 촘촘해지지 않도록 컬럼수를 줄임 (요청1)
      const cols = w < 500 ? 4 : w < 750 ? 5 : 6;
      for (const y of bandY) {
        for (let c = 0; c < cols; c++) {
          slots.push({ x: x0 + (x1-x0) * (c/(cols-1)), y });
        }
      }
      // 왼쪽 복귀 통로 옆 여유공간에도 세로로 슬롯 몇 개 추가 (공간 활용)
      const leftX = mx * 0.5 + innerGap * 0.15;
      for (let i = 0; i < bounds.length - 1; i++) {
        slots.push({ x: leftX, y: (bounds[i] + bounds[i+1]) / 2 });
      }
      return slots;
    },

    drawBg(ctx, w, h) {
      // v27-58: 바닥은 이제 실사 용암 텍스처(bgTextures)가 채움. 여기선 밝은 글로우 웅덩이만 덧그려서 포인트를 줌.
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
    bgColor:'#050210',
    // v27-58: 실사 동굴 배경(커버 방식) + 돌길 텍스처 (CC0 - opengameart.org)
    bgImage:'assets/textures/cave_bg.jpg',
    pathTextures:['assets/textures/ground_01.jpg','assets/textures/ground_02.jpg'],
    pathTileSize:48,
    pathColor:'#3e2860', pathColorDark:'#1e1030',
    pathHighlight:'rgba(180,120,255,0.16)',
    pathArrow:'rgba(160,120,255,0.28)', pathWidth:20,
    ghostBonus:0.30,

    // v27-3: 존 전환해도 타워 위치가 깨지지 않도록 3맵 모두 동일한 트랙/슬롯 좌표 사용 (숲맵 기준 통일)
    // v27-24 버그수정: 대각선으로 그려지던 문제(중간 꺾이는 점 누락) 수정 - 세로이동/가로이동을
    // 항상 분리된 점으로 나눠서 직각 지그재그가 되도록 함. 5단으로 확장 (요청 - 더 꼬불꼬불하게)
    getPaths(w, h) {
      const mx = w*0.15, my = h*0.20;
      const innerGap = w*0.08; // 지그재그가 왼쪽에서 멈추는 지점 (왼쪽 가장자리는 복귀 통로로 남김)
      const FOLDS = 6; // v27-47: 카메라로 넓게 볼 수 있게 되어 4→6단으로 확장 (요청A - 월드가 커진 만큼 더 꼬불꼬불하게)
      const pts = [{x:mx, y:my}, {x:w-mx, y:my}];
      let curX = w-mx;
      for (let i = 1; i <= FOLDS; i++) {
        const y = my + (h - 2*my) * (i / (FOLDS + 1));
        const goLeft = i % 2 === 1;
        const nextX = goLeft ? mx+innerGap : w-mx;
        pts.push({ x: curX, y });      // 세로로 내려감 (x는 그대로)
        pts.push({ x: nextX, y });     // 가로로 이동 (y는 그대로)
        curX = nextX;
      }
      pts.push({ x: curX, y: h-my });  // 마지막 밴드까지 세로로 내려감
      pts.push({ x: mx, y: h-my });    // 바닥을 가로질러 왼쪽 끝으로
      pts.push({ x: mx, y: my });      // 왼쪽 가장자리를 타고 복귀 (루프 닫힘)
      return [pts];
    },

    // v27-22: 지그재그 경로의 3개 밴드(위/중간/아래) 사이 공간에 슬롯 배치 - 경로 선과 안 겹치게
    getSlots(w, h) {
      const slots = [];
      const mx = w*0.15, my = h*0.20;
      const innerGap = w*0.08;
      const FOLDS = 6; // v27-47: getPaths와 동일해야 밴드가 맞물림 (4→6단 확장)
      // 밴드 경계 y좌표들 (getPaths의 꺾이는 지점과 동일하게 계산)
      const bounds = [my];
      for (let i = 1; i <= FOLDS; i++) bounds.push(my + (h - 2*my) * (i / (FOLDS + 1)));
      bounds.push(h - my);
      const bandY = [];
      for (let i = 0; i < bounds.length - 1; i++) bandY.push((bounds[i] + bounds[i+1]) / 2); // 각 밴드 중앙
      const x0 = mx + innerGap + w*0.05, x1 = w - mx - w*0.04;
      // v27-24: 좁은 화면(모바일)에서는 슬롯이 너무 촘촘해지지 않도록 컬럼수를 줄임 (요청1)
      const cols = w < 500 ? 4 : w < 750 ? 5 : 6;
      for (const y of bandY) {
        for (let c = 0; c < cols; c++) {
          slots.push({ x: x0 + (x1-x0) * (c/(cols-1)), y });
        }
      }
      // 왼쪽 복귀 통로 옆 여유공간에도 세로로 슬롯 몇 개 추가 (공간 활용)
      const leftX = mx * 0.5 + innerGap * 0.15;
      for (let i = 0; i < bounds.length - 1; i++) {
        slots.push({ x: leftX, y: (bounds[i] + bounds[i+1]) / 2 });
      }
      return slots;
    },

    drawBg(ctx, w, h) {
      // v27-58: 바닥/배경은 이제 실사 동굴 사진(bgImage)이 채움. 불투명 그라디언트는 제거하고
      // 살짝 어두운 톤만 얹어서(반투명) 사진 위에 별/성운을 자연스럽게 겹침.
      ctx.fillStyle='rgba(5,2,16,0.28)'; ctx.fillRect(0,0,w,h);
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
