// ===== SPRITES.JS - 벡터 캐릭터 애니메이션 엔진 =====
// 핵심 설계: 모든 캐릭터는 SpriteRig를 통해 그려진다.
// 지금은 도형(원/곡선)으로 그리지만, 나중에 이미지로 교체할 때
// SpriteRig.drawFrame()만 이미지 버전으로 바꾸면 호출부(Enemy/Tower/Hero)는 무수정.

// ===== 애니메이션 상태 정의 =====
// 모든 캐릭터가 공유하는 표준 상태셋
const AnimState = {
  IDLE: 'idle',
  WALK: 'walk',
  ATTACK: 'attack',
  HIT: 'hit',
  DEATH: 'death',
};

// ===== SPRITE RIG: 캐릭터 1체의 애니메이션 컨트롤러 =====
class SpriteRig {
  constructor(drawFn, opts = {}) {
    this.drawFn = drawFn;          // (ctx, x, y, frameInfo) => void  — 도형 그리기 함수 (나중에 이미지로 교체 지점)
    this.state = AnimState.IDLE;
    this.stateTime = 0;
    this.walkCycle = Math.random() * Math.PI * 2; // 개체별 위상차로 동기화 방지
    this.attackQueued = false;
    this.attackDuration = opts.attackDuration || 0.25;
    this.hitDuration = opts.hitDuration || 0.15;
    this.bobAmount = opts.bobAmount ?? 3;
    this.bobSpeed = opts.bobSpeed ?? 8;
    this.facingX = 1; // 1: 오른쪽, -1: 왼쪽
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.stateTime = 0;
  }

  triggerAttack() {
    this.setState(AnimState.ATTACK);
  }

  triggerHit() {
    // 공격 중이 아니면 히트 리액션
    if (this.state !== AnimState.ATTACK) {
      this._pendingHit = this.hitDuration;
    }
  }

  update(dt, isMoving) {
    this.stateTime += dt;

    if (this._pendingHit > 0) {
      this._pendingHit -= dt;
    }

    if (this.state === AnimState.ATTACK) {
      if (this.stateTime >= this.attackDuration) {
        this.setState(isMoving ? AnimState.WALK : AnimState.IDLE);
      }
    } else if (this.state === AnimState.DEATH) {
      // 죽음 상태는 외부에서 명시적으로 빠져나감
    } else {
      this.setState(isMoving ? AnimState.WALK : AnimState.IDLE);
    }

    if (this.state === AnimState.WALK) {
      this.walkCycle += dt * this.bobSpeed;
    } else {
      this.walkCycle += dt * this.bobSpeed * 0.3; // idle도 살짝 숨쉬기
    }
  }

  // 현재 프레임 정보 계산 (bob, squash, tilt 등)
  getFrameInfo() {
    const t = this.stateTime;
    let bobY = 0, squash = 1, stretch = 1, tilt = 0, scale = 1, flash = false;

    switch (this.state) {
      case AnimState.IDLE:
        bobY = Math.sin(this.walkCycle) * (this.bobAmount * 0.4);
        squash = 1 + Math.sin(this.walkCycle) * 0.02;
        break;
      case AnimState.WALK:
        bobY = Math.abs(Math.sin(this.walkCycle)) * this.bobAmount;
        tilt = Math.sin(this.walkCycle) * 0.08;
        squash = 1 - Math.abs(Math.sin(this.walkCycle)) * 0.05;
        break;
      case AnimState.ATTACK: {
        const p = Math.min(t / this.attackDuration, 1);
        // 윈드업 → 임팩트 → 복귀
        if (p < 0.35) {
          const wp = p / 0.35;
          scale = 1 - wp * 0.12;
          tilt = -wp * 0.25 * this.facingX;
        } else if (p < 0.55) {
          const ip = (p - 0.35) / 0.2;
          scale = 0.88 + ip * 0.3;
          tilt = (-0.25 + ip * 0.45) * this.facingX;
        } else {
          const rp = (p - 0.55) / 0.45;
          scale = 1.18 - rp * 0.18;
          tilt = 0.2 * (1 - rp) * this.facingX;
        }
        break;
      }
      case AnimState.DEATH: {
        const p = Math.min(t / 0.4, 1);
        scale = 1 - p;
        tilt = p * Math.PI * 0.5;
        break;
      }
    }

    if (this._pendingHit > 0) {
      flash = true;
      const shake = Math.sin(this._pendingHit * 60) * 2;
      bobY += shake;
    }

    return { bobY, squash, stretch, tilt, scale, flash };
  }

  draw(ctx, x, y, size, color) {
    const info = this.getFrameInfo();
    this.drawFn(ctx, x, y - info.bobY, size, color, info, this.facingX);
  }
}

// ===== 공용 도형 그리기 헬퍼 =====
function drawBlobBody(ctx, x, y, size, color, info) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(info.tilt);
  ctx.scale(info.scale * (info.squash || 1), info.scale * (2 - (info.squash || 1)));

  // 그림자
  ctx.save();
  ctx.translate(0, size * 0.55);
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  ctx.restore();

  // 몸통
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = info.flash ? '#ffffff' : color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// 눈 그리기 (감정 표현용 공용 헬퍼)
function drawEyes(ctx, x, y, size, spacing = 0.22, eyeSize = 0.1, mood = 'normal') {
  ctx.save();
  ctx.translate(x, y);
  const ex = size * spacing;
  const ey = -size * 0.05;
  const r = size * eyeSize;

  ctx.fillStyle = '#1a1a1a';
  if (mood === 'angry') {
    // 화남: 사선 눈
    ctx.save();
    ctx.translate(-ex, ey);
    ctx.rotate(0.3);
    ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
    ctx.restore();
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(-0.3);
    ctx.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
    ctx.restore();
  } else if (mood === 'sleepy') {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = r * 0.6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-ex - r, ey); ctx.lineTo(-ex + r, ey); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - r, ey); ctx.lineTo(ex + r, ey); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-ex, ey, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    // 하이라이트
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-ex + r * 0.35, ey - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex + r * 0.35, ey - r * 0.35, r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ===== 이미지 스프라이트 로더 =====
const SpriteImageCache = {};
function loadSpriteImage(path) {
  if (SpriteImageCache[path]) return SpriteImageCache[path];
  const img = new Image();
  img.src = path;
  SpriteImageCache[path] = img;
  return img;
}

// 이미지 기반 그리기 함수 팩토리
// SpriteRig의 drawFn 시그니처(ctx, x, y, size, color, info, facing)를 그대로 따른다.
// info(bobY는 이미 SpriteRig.draw에서 y에 반영됨, squash/tilt/scale/flash만 여기서 사용)
function makeImageDrawFn(imgPath, opts = {}) {
  const img = loadSpriteImage(imgPath);
  const baseScale = opts.scale || 1;
  return function drawImageSprite(ctx, x, y, size, color, info, facing) {
    if (!img.complete || img.naturalWidth === 0) {
      // 이미지 로딩 전: 임시 원형 플레이스홀더
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.restore();
      return;
    }

    const w = size * 2 * baseScale * (info.scale || 1);
    const h = size * 2 * baseScale * (info.scale || 1);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(info.tilt || 0);
    if (facing < 0) ctx.scale(-1, 1);

    if (info.flash) {
      // 피격 플래시: 흰색 실루엣 오버레이
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }

    ctx.restore();
  };
}

window.loadSpriteImage = loadSpriteImage;
window.makeImageDrawFn = makeImageDrawFn;

// ===== 영웅 캐릭터별 그리기 함수 =====

function drawPikachuBody(ctx, x, y, size, color, info, facing) {
  drawBlobBody(ctx, x, y, size, color, info);
  ctx.save();
  ctx.translate(x, y - info.bobY);
  ctx.rotate(info.tilt);
  ctx.scale(info.scale, info.scale);

  // 귀 (뾰족, 검은 끝)
  const earSway = Math.sin(info.tilt * 3) * 0.1;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * size * 0.32, -size * 0.5);
    ctx.rotate(side * (0.35 + earSway));
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, 0);
    ctx.lineTo(size * 0.1, 0);
    ctx.lineTo(0, -size * 0.55);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 귀끝 검은색
    ctx.beginPath();
    ctx.moveTo(-size * 0.06, -size * 0.32);
    ctx.lineTo(size * 0.06, -size * 0.32);
    ctx.lineTo(0, -size * 0.55);
    ctx.closePath();
    ctx.fillStyle = '#2d2d2d';
    ctx.fill();
    ctx.restore();
  }

  // 볼 (전기주머니)
  ctx.fillStyle = '#e53935';
  ctx.beginPath(); ctx.arc(-size * 0.42, size * 0.08, size * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(size * 0.42, size * 0.08, size * 0.13, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
  drawEyes(ctx, x, y - info.bobY, size, 0.22, 0.09, 'normal');

  // 공격 시 전기 스파크
  if (info.scale > 1.05) {
    ctx.save();
    ctx.translate(x, y - info.bobY - size * 0.7);
    ctx.fillStyle = '#fff176';
    ctx.font = `${size * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('⚡', 0, 0);
    ctx.restore();
  }
}

function drawMewBody(ctx, x, y, size, color, info, facing) {
  drawBlobBody(ctx, x, y, size, color, info);
  ctx.save();
  ctx.translate(x, y - info.bobY);
  ctx.rotate(info.tilt);
  ctx.scale(info.scale, info.scale);

  // 긴 꼬리 (곡선, 흔들림)
  const tailWag = Math.sin(Date.now() * 0.003 + info.tilt) * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.4);
  ctx.quadraticCurveTo(size * 0.5, size * 0.7 + tailWag * 10, size * 0.7, size * 0.3 + tailWag * 20);
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 동그란 머리 위 안테나
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.75, 0, -size * 0.85);
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.06;
  ctx.stroke();

  ctx.restore();
  drawEyes(ctx, x, y - info.bobY, size, 0.2, 0.1, 'normal');

  if (info.scale > 1.05) {
    ctx.save();
    ctx.translate(x, y - info.bobY - size * 0.7);
    ctx.font = `${size * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🔮', 0, 0);
    ctx.restore();
  }
}

function drawTogepiBody(ctx, x, y, size, color, info, facing) {
  // 토게피는 알 모양 — 둥근 삼각형 실루엣
  ctx.save();
  ctx.translate(x, y - info.bobY);
  ctx.rotate(info.tilt);
  ctx.scale(info.scale * (info.squash || 1), info.scale * (2 - (info.squash || 1)));

  // 그림자
  ctx.save();
  ctx.translate(0, size * 0.55);
  ctx.scale(1, 0.3);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();
  ctx.restore();

  // 알 몸통 (삼각 라운드)
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.6);
  ctx.quadraticCurveTo(size * 0.55, -size * 0.1, size * 0.4, size * 0.5);
  ctx.quadraticCurveTo(0, size * 0.65, -size * 0.4, size * 0.5);
  ctx.quadraticCurveTo(-size * 0.55, -size * 0.1, 0, -size * 0.6);
  ctx.closePath();
  ctx.fillStyle = info.flash ? '#ffffff' : color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 갈색 삼각 무늬 (알 껍질)
  ctx.fillStyle = '#6d4c41';
  for (const [dx, dy, r] of [[-0.22, 0.25, 0.13], [0.22, 0.3, 0.11], [0, 0.5, 0.1]]) {
    ctx.beginPath();
    ctx.moveTo(dx * size, (dy - r) * size);
    ctx.lineTo((dx - r * 0.8) * size, (dy + r * 0.6) * size);
    ctx.lineTo((dx + r * 0.8) * size, (dy + r * 0.6) * size);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  drawEyes(ctx, x, y - info.bobY, size, 0.18, 0.08, 'normal');

  if (info.scale > 1.05) {
    ctx.save();
    ctx.translate(x, y - info.bobY - size * 0.7);
    ctx.font = `${size * 0.5}px serif`;
    ctx.textAlign = 'center';
    ctx.fillText('✨', 0, 0);
    ctx.restore();
  }
}

const HeroDrawFns = {
  pikachu: makeImageDrawFn('assets/heroes/pikachu.png', { scale: 1.5 }),
  mew: makeImageDrawFn('assets/heroes/mew.png', { scale: 1.5 }),
  togepi: makeImageDrawFn('assets/heroes/togepi.png', { scale: 1.5 }),
};

window.AnimState = AnimState;
window.SpriteRig = SpriteRig;
window.drawBlobBody = drawBlobBody;
window.drawEyes = drawEyes;
window.HeroDrawFns = HeroDrawFns;
