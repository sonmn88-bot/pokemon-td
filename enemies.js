// ===== ENEMIES.JS - 적 12종 + 이동 시스템 =====

// 적 캐릭터 이미지 (실사 포켓몬 스프라이트)
const EnemySpriteImages = {
  abo: 'assets/enemies/abo.png',
  golbat: 'assets/enemies/golbat.png',
  jigglypuff: 'assets/enemies/jigglypuff.png',
  gastly: 'assets/enemies/gastly.png',
  paras: 'assets/enemies/paras.png',
  phantump: 'assets/enemies/phantump.png',
  lapras: 'assets/enemies/lapras.png',
  gyarados: 'assets/enemies/gyarados.png',
  weezing: 'assets/enemies/weezing.png',
  scyther: 'assets/enemies/scyther.png',
  lugia: 'assets/enemies/lugia.png',
  mewtwo: 'assets/enemies/mewtwo.png',
  rattata: 'assets/enemies/rattata.png',
  zubat: 'assets/enemies/zubat.png',
  koffing: 'assets/enemies/koffing.png',
  magnemite: 'assets/enemies/magnemite.png',
  onix: 'assets/enemies/onix.png',
  haunter: 'assets/enemies/haunter.png',
  electrode: 'assets/enemies/electrode.png',
  dragonite: 'assets/enemies/dragonite.png',
};

// ===== 경로 진행도 계산 유틸 =====
function pathProgress(path, distTraveled) {
  let remaining = distTraveled;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i+1].x - path[i].x;
    const dy = path[i+1].y - path[i].y;
    const segLen = Math.hypot(dx, dy);
    if (remaining <= segLen) {
      return {
        x: path[i].x + (dx / segLen) * remaining,
        y: path[i].y + (dy / segLen) * remaining,
        segment: i,
        ratio: distTraveled / totalPathLength(path),
      };
    }
    remaining -= segLen;
  }
  return { x: path[path.length-1].x, y: path[path.length-1].y, segment: path.length-1, ratio: 1 };
}

function totalPathLength(path) {
  let len = 0;
  for (let i = 0; i < path.length - 1; i++) {
    len += Math.hypot(path[i+1].x - path[i].x, path[i+1].y - path[i].y);
  }
  return len;
}

// ===== 적 타입 정의 =====
const EnemyTypes = {
  // ─── 1~5웨이브 메인 ───
    type: 'grass',
  abo: {
    name: '아보',     emoji: '🐍',
    hp: 112,  speed: 88, reward: 8,  size: 18,
    color: '#8bc34a',
    special: null,
  },
    type: 'psychic',
  golbat: {
    name: '골뱃',     emoji: '🦇',
    hp: 84,  speed: 118, reward: 12, size: 20,
    color: '#9c27b0',
    special: 'flying',   // 배리어 무시
    flyHeight: 8,        // 위아래 흔들림
  },
    type: 'normal',
  jigglypuff: {
    name: '질퍽이',   emoji: '🔴',
    hp: 168, speed: 64, reward: 10, size: 22,
    color: '#f48fb1',
    special: 'poisonImmune',
  },
    type: 'psychic',
  gastly: {
    name: '고오스',   emoji: '👻',
    hp: 98,  speed: 94, reward: 15, size: 20,
    color: '#673ab7',
    special: 'ghost',    // 물리 데미지 50% 감소
    ghostAlpha: 0.65,
  },
    type: 'grass',
  paras: {
    name: '파라스',   emoji: '🍄',
    hp: 125,  speed: 70, reward: 12, size: 20,
    color: '#ff7043',
    special: 'spore',    // 근처 타워 디버프
    sporeRange: 80,
    sporeCooldown: 0, sporeInterval: 4,
  },

  // ─── 6~10웨이브 ───
    type: 'grass',
  phantump: {
    name: '팬텀',     emoji: '🌲',
    hp: 280, speed: 53, reward: 25, size: 24,
    color: '#5d4037',
    special: 'regen',    // 초당 HP 5 재생
    regenRate: 5,
  },
    type: 'water',
  lapras: {
    name: '라프라스', emoji: '🦭',
    hp: 182, speed: 82, reward: 20, size: 22,
    color: '#ce93d8',
    special: 'iceImmune',
  },
    type: 'water',
  gyarados: {
    name: '갸라도스',  emoji: '🐲',
    hp: 489, speed: 59, reward: 40, size: 30,
    color: '#1565c0',
    special: 'rage',     // 피격 시 분노 = 속도 +20% (최대 3스택)
    rageStacks: 0, maxRageStacks: 3,
  },

  // ─── 11~15웨이브 ───
    type: 'psychic',
  weezing: {
    name: '또가스',   emoji: '💨',
    hp: 210, speed: 64, reward: 30, size: 26,
    color: '#78909c',
    special: 'explode',  // 사망 시 범위 데미지
    explodeRadius: 60, explodeDamage: 30,
  },
    type: 'grass',
  scyther: {
    name: '스라크',   emoji: '🦗',
    hp: 392, speed: 88, reward: 35, size: 26,
    color: '#66bb6a',
    special: 'armor',    // 물리 데미지 90% 감소
  },

  // ─── 보스 ───
    type: 'water',
  lugia: {
    name: '루기아',   emoji: '🕊️',
    hp: 2520, speed: 47, reward: 120, size: 40,
    color: '#b0bec5',
    special: 'boss',
    isBoss: true,
  },
    type: 'psychic',
  mewtwo: {
    name: '뮤츠',    emoji: '🔮',
    hp: 7000, speed: 64, reward: 300, size: 44,
    color: '#7c4dff',
    special: 'finalBoss',
    isBoss: true,
    shieldHp: 1000,   // 방어막 (먼저 제거해야 함)
    shieldActive: true,
    teleportCooldown: 0, teleportInterval: 8,
  },

  // ─── 콘텐츠 확장: 추가 포켓몬 8종 ───
    type: 'normal',
  rattata: {
    name: '꼬렛',     emoji: '🐭',
    hp: 56,  speed: 140, reward: 6, size: 16,
    color: '#a1887f',
    special: 'swift',     // 매우 빠름, 타겟팅 우선순위 낮춤 트릭용
  },
    type: 'psychic',
  zubat: {
    name: '주뱃',     emoji: '🦋',
    hp: 70,  speed: 112, reward: 9, size: 18,
    color: '#7e57c2',
    special: 'flying',
    flyHeight: 6,
  },
    type: 'psychic',
  koffing: {
    name: '또도가스', emoji: '☁️',
    hp: 140, speed: 59, reward: 14, size: 20,
    color: '#90a4ae',
    special: 'poisonAura',  // 주변 적 면역 부여(단순화: 자기 자신만 면역 적용은 poisonImmune로 처리)
    poisonImmune: true,
  },
    type: 'electric',
  magnemite: {
    name: '코일(야생)', emoji: '🧲',
    hp: 118,  speed: 76, reward: 13, size: 18,
    color: '#fdd835',
    special: 'shockImmune',  // 스턴 저항 50%
    stunResist: 0.5,
  },
    type: 'normal',
  onix: {
    name: '롱스톤',   emoji: '🪨',
    hp: 364, speed: 47, reward: 28, size: 28,
    color: '#8d6e63',
    special: 'armor',
  },
    type: 'psychic',
  haunter: {
    name: '고우스트', emoji: '👤',
    hp: 196, speed: 100, reward: 22, size: 22,
    color: '#5e35b1',
    special: 'ghost',
    ghostAlpha: 0.6,
  },
    type: 'electric',
  electrode: {
    name: '마그넷',   emoji: '🔴',
    hp: 154, speed: 106, reward: 18, size: 20,
    color: '#e53935',
    special: 'explode',
    explodeRadius: 70, explodeDamage: 40,
  },
    type: 'water',
  dragonite: {
    name: '망나뇽',   emoji: '🐉',
    hp: 1260, speed: 70, reward: 80, size: 34,
    color: '#fb8c00',
    special: 'flying',
    flyHeight: 10,
    isBoss: false,
  },
};

// ===== ENEMY CLASS =====
class Enemy {
  constructor(typeId, path, engine) {
    const def = EnemyTypes[typeId];
    if (!def) throw new Error(`Unknown enemy type: ${typeId}`);

    this.typeId = typeId;
    this.def = def;
    this.name = def.name;
    this.emoji = def.emoji;
    this.path = path;
    this.engine = engine;

    // 스탯
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = def.speed;
    this.reward = def.reward;
    this.size = def.size;
    this.color = def.color;
    this.isBoss = !!def.isBoss;
    this.typeTag = def.type || 'normal';

    // 동굴 맵 유령 보너스
    if (engine.currentMap.ghostBonus && (def.special === 'ghost' || typeId === 'gastly' || typeId === 'phantump')) {
      this.maxHp = Math.floor(this.maxHp * (1 + engine.currentMap.ghostBonus));
      this.hp = this.maxHp;
    }

    // 특수 상태
    this.shieldHp = def.shieldHp || 0;
    this.shieldActive = def.shieldActive || false;
    this.rageStacks = 0;

    // 이동
    this.distTraveled = 0;
    this.totalLen = totalPathLength(path);
    this.x = path[0].x;
    this.y = path[0].y;
    this.flyOffset = 0;
    this.flyTime = Math.random() * Math.PI * 2;

    // 상태이상
    this.slowed = 0;        // 슬로우 잔여 시간
    this.slowFactor = 1;    // 0~1
    this.stunned = 0;       // 스턴 잔여 시간
    this.burning = 0;       // 화상 잔여 시간
    this.burnDamage = 0;
    this.poisoned = 0;      // 독 잔여 시간
    this.poisonDamage = 0;
    this.frozen = 0;        // 빙결 잔여 시간

    // 피격 플래시
    this.flashTimer = 0;

    this.dead = false;
    this.reachedEnd = false;

    // 스포어 타이머
    this.sporeTimer = def.sporeCooldown || 0;

    // 뮤츠 텔레포트
    this.teleportTimer = def.teleportCooldown || 0;
  }

  // ===== UPDATE =====
  update(dt) {
    if (this.dead || this.reachedEnd) return;

    // 스턴 중이면 이동 안 함
    if (this.stunned > 0) {
      this.stunned -= dt;
    } else if (this.frozen > 0) {
      this.frozen -= dt;
    } else {
      // 이동 속도
      let spd = this.speed;
      if (this.slowed > 0) {
        spd *= this.slowFactor;
        this.slowed -= dt;
        if (this.slowed <= 0) this.slowFactor = 1;
      }
      // 분노 스택
      if (this.def.special === 'rage') {
        spd *= (1 + this.rageStacks * 0.2);
      }

      this.distTraveled += spd * dt;
    }

    // 위치 갱신
    const pos = pathProgress(this.path, this.distTraveled);
    this.x = pos.x;
    this.y = pos.y;

    // 비행 흔들림
    if (this.def.special === 'flying') {
      this.flyTime += dt * 3;
      this.flyOffset = Math.sin(this.flyTime) * this.def.flyHeight;
    }

    // 순환 트랙: 한 바퀴 돌면 처음으로 (더 이상 도착=라이프 손실 아님)
    if (pos.ratio >= 1) {
      this.laps = (this.laps || 0) + 1;
      this.distTraveled = this.distTraveled % this.totalLen;
      const wrapped = pathProgress(this.path, this.distTraveled);
      this.x = wrapped.x; this.y = wrapped.y;
    }

    // DoT 처리
    if (this.burning > 0) {
      this.burning -= dt;
      this.takeDamage(this.burnDamage * dt, 'fire');
    }
    if (this.poisoned > 0) {
      this.poisoned -= dt;
      this.takeDamage(this.poisonDamage * dt, 'poison');
    }

    // 재생
    if (this.def.special === 'regen') {
      this.hp = Math.min(this.maxHp, this.hp + this.def.regenRate * dt);
    }

    // 스포어 (파라스)
    if (this.def.special === 'spore') {
      this.sporeTimer -= dt;
      if (this.sporeTimer <= 0) {
        this.sporeTimer = this.def.sporeInterval;
        this.doSpore();
      }
    }

    // 뮤츠 텔레포트
    if (this.def.special === 'finalBoss') {
      this.teleportTimer -= dt;
      if (this.teleportTimer <= 0) {
        this.teleportTimer = this.def.teleportInterval;
        this.doTeleport();
      }
    }

    // 플래시 타이머
    if (this.flashTimer > 0) this.flashTimer -= dt;
  }

  // ===== DAMAGE =====
  takeDamage(amount, type) {
    if (this.dead) return;

    // 방어막 (뮤츠)
    if (this.shieldActive && this.shieldHp > 0) {
      this.shieldHp -= amount;
      if (this.shieldHp <= 0) {
        this.shieldActive = false;
        this.shieldHp = 0;
        this.engine.spawnFloatingText('방어막 파괴!', this.x, this.y - 30, '#ff6b6b');
      }
      return;
    }

    // 특수 방어
    let dmg = amount;
    if (this.def.special === 'ghost' && type === 'physical') dmg *= 0.5;
    if (this.def.special === 'armor' && type === 'physical') dmg *= 0.1;

    this.hp -= dmg;
    this.flashTimer = 0.1;

    // 분노 (갸라도스)
    if (this.def.special === 'rage' && this.rageStacks < this.def.maxRageStacks) {
      this.rageStacks++;
    }

    if (this.hp <= 0) this.die();
  }

  applyStatus(status, duration, factor) {
    switch (status) {
      case 'slow':
        if (this.def.special === 'iceImmune') return;
        if (duration > this.slowed) {
          this.slowed = duration;
          this.slowFactor = Math.min(this.slowFactor, factor || 0.5);
        }
        break;
      case 'stun':
        if (this.def.stunResist) duration *= (1 - this.def.stunResist);
        if (duration > this.stunned) this.stunned = duration;
        break;
      case 'burn':
        if (this.def.special === 'poisonImmune') return; // 독/화상 면역은 불에도 약한 건 아니나 단순화
        this.burning = duration;
        this.burnDamage = factor || 10;
        break;
      case 'poison':
        if (this.def.special === 'poisonImmune' || this.def.poisonImmune) return;
        this.poisoned = duration;
        this.poisonDamage = factor || 8;
        break;
      case 'freeze':
        if (this.def.special === 'iceImmune') return;
        this.frozen = duration;
        break;
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;

    // 폭발 (또가스)
    if (this.def.special === 'explode') {
      this.doExplode();
    }

    // 파티클
    this.engine.spawnHitParticle(this.x, this.y, this.color);
  }

  doExplode() {
    const r = this.def.explodeRadius;
    const dmg = this.def.explodeDamage;
    for (const e of this.engine.enemies) {
      if (e !== this && !e.dead) {
        if (Math.hypot(e.x - this.x, e.y - this.y) < r) {
          // 다른 적에게 데미지 없음 (플레이어 라이프에 영향)
        }
      }
    }
    // 타워 디버프는 2단계에서
    this.engine.spawnHitParticle(this.x, this.y, '#ff9800');
    this.engine.spawnHitParticle(this.x, this.y, '#ffeb3b');
    this.engine.spawnFloatingText('💥 폭발!', this.x, this.y - 20, '#ff9800');
  }

  doSpore() {
    // 근처 타워를 디버프 (2단계에서 구현)
    this.engine.spawnFloatingText('🍄', this.x, this.y - 20, '#ff7043');
  }

  doTeleport() {
    // 경로를 앞으로 20% 점프
    const jumpDist = this.totalLen * 0.15;
    this.distTraveled = Math.min(this.distTraveled + jumpDist, this.totalLen * 0.95);
    this.engine.spawnHitParticle(this.x, this.y, '#7c4dff');
    this.engine.spawnFloatingText('✨ 순간이동!', this.x, this.y - 30, '#b39ddb');
  }

  // ===== DRAW =====
  draw(ctx) {
    if (this.dead || this.reachedEnd) return;

    const drawY = this.y + this.flyOffset;
    const s = this.size;

    ctx.save();

    // 스턴/빙결 효과
    if (this.stunned > 0 || this.frozen > 0) {
      ctx.shadowColor = this.frozen > 0 ? '#81d4fa' : '#fff176';
      ctx.shadowBlur = 8;
    }

    // 유령 반투명
    if (this.def.special === 'ghost') {
      ctx.globalAlpha = this.def.ghostAlpha;
    }

    // 피격 플래시
    if (this.flashTimer > 0) {
      ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.5;
    }

    // 방어막 (뮤츠)
    if (this.shieldActive) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, drawY, s * 0.9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180,140,255,0.7)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#7c4dff';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }

    // 몸통: 이미지 스프라이트 (없으면 원+이모지 폴백)
    const imgPath = EnemySpriteImages[this.typeId];
    const img = imgPath ? window.loadSpriteImage(imgPath) : null;

    if (this._elite === 'gold') {
      // 골드 엘리트 = 흑화(섀도) 버전: 어둡고 채도 높은 필터로 위압감 연출
      ctx.filter = 'brightness(0.45) saturate(2.1) hue-rotate(265deg) contrast(1.25)';
    }

    if (img && img.complete && img.naturalWidth > 0) {
      const drawSize = s * 1.7;
      if (this.flashTimer > 0) {
        // 피격 시 흰색 실루엣 오버레이
        ctx.save();
        ctx.drawImage(img, this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        ctx.restore();
      } else {
        ctx.drawImage(img, this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
      }
    } else {
      // 폴백: 도형 + 이모지
      ctx.beginPath();
      ctx.arc(this.x, drawY, s * 0.62, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.font = `${s * 0.9}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.def.emoji, this.x, drawY);
    }

    ctx.restore();

    // HP바
    this.drawHpBar(ctx, drawY);

    // 상태이상 아이콘
    this.drawStatusIcons(ctx, drawY);
  }

  drawHpBar(ctx, drawY) {
    const bw = Math.max(this.size * 1.6, 36);
    const bh = this.isBoss ? 7 : 5;
    const bx = this.x - bw / 2;
    const by = drawY - this.size * 0.7 - bh - 3;
    const ratio = Math.max(0, this.hp / this.maxHp);

    // 방어막 바 (뮤츠)
    if (this.def.shieldHp) {
      const shieldRatio = Math.max(0, this.shieldHp / this.def.shieldHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by - bh - 2, bw, bh);
      ctx.fillStyle = '#b39ddb';
      ctx.fillRect(bx, by - bh - 2, bw * shieldRatio, bh);
    }

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, 3);
    ctx.fill();

    // HP 색상
    ctx.fillStyle = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ffeb3b' : '#f44336';
    roundRect(ctx, bx, by, bw * ratio, bh, 2);
    ctx.fill();
  }

  drawStatusIcons(ctx, drawY) {
    let icons = [];
    if (this.slowed > 0)   icons.push('🔵');
    if (this.stunned > 0)  icons.push('⭐');
    if (this.burning > 0)  icons.push('🔥');
    if (this.poisoned > 0) icons.push('☠️');
    if (this.frozen > 0)   icons.push('❄️');
    if (this.rageStacks > 0) icons.push('😡');
    if (icons.length === 0) return;

    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const iconY = drawY + this.size * 0.7 + 8;
    icons.forEach((ic, i) => {
      ctx.fillText(ic, this.x + (i - (icons.length-1)/2) * 13, iconY);
    });
  }
}

// ===== 유틸 =====
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
