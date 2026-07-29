// ===== ENEMIES.JS - 적 12종 + 이동  시스템 =====

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
  abo: {
    type: 'grass',
    name: '아보',     emoji: '🐍',
    hp: 203,  speed: 88, reward: 1,  size: 18,
    color: '#8bc34a',
    special: 'split',   // 죽을 때 약한 개체 2마리로 분裂
  },
  golbat: {
    type: 'psychic',
    name: '골뱃',     emoji: '🦇',
    hp: 122,  speed: 139, reward: 1, size: 20,
    color: '#9c27b0',
    special: 'flying',   // 배리어 무시
    flyHeight: 8,        // 위아래 흔들림
  },
  jigglypuff: {
    type: 'normal',
    name: '질퍽이',   emoji: '🔴',
    hp: 244, speed: 52, reward: 1, size: 22,
    color: '#f48fb1',
    special: 'poisonImmune',
  },
  gastly: {
    type: 'psychic',
    name: '고오스',   emoji: '👻',
    hp: 142,  speed: 94, reward: 1, size: 20,
    color: '#673ab7',
    special: 'ghost',    // 물리 데미지 50% 감소
    ghostAlpha: 0.65,
  },
  paras: {
    type: 'grass',
    name: '파라스',   emoji: '🍄',
    hp: 181,  speed: 70, reward: 1, size: 20,
    color: '#ff7043',
    special: 'spore',    // 근처 타워 디버프
    sporeRange: 80,
    sporeCooldown: 0, sporeInterval: 4,
  },

  // ─── 6~10웨이브 ───
  phantump: {
    type: 'grass',
    name: '팬텀',     emoji: '🌲',
    hp: 406, speed: 43, reward: 2, size: 24,
    color: '#5d4037',
    special: 'regen',    // 초당 HP 5 재생
    regenRate: 5,
  },
  lapras: {
    type: 'water',
    name: '라프라스', emoji: '🦭',
    hp: 264, speed: 82, reward: 1, size: 22,
    color: '#ce93d8',
    special: 'iceImmune',
  },
  gyarados: {
    type: 'water',
    name: '갸라도스',  emoji: '🐲',
    hp: 709, speed: 48, reward: 3, size: 30,
    color: '#1565c0',
    special: 'rage',     // 피격 시 분노 = 속도 +20% (최대 3스택)
    rageStacks: 0, maxRageStacks: 3,
  },

  // ─── 11~15웨이브 ───
  weezing: {
    type: 'fire',
    name: '또가스',   emoji: '💨',
    hp: 304, speed: 52, reward: 2, size: 26,
    color: '#78909c',
    special: 'explode',  // 사망 시 범위 데미지
    explodeRadius: 60, explodeDamage: 30,
  },
  scyther: {
    type: 'grass',
    name: '스라크',   emoji: '🦗',
    hp: 568, speed: 88, reward: 2, size: 26,
    color: '#66bb6a',
    special: 'armor',    // 물리 데미지 90% 감소
  },

  // ─── 보스 ───
  lugia: {
    type: 'water',
    name: '루기아',   emoji: '🕊️',
    hp: 3654, speed: 39, reward: 8, size: 40,
    color: '#b0bec5',
    special: 'boss',
    isBoss: true,
  },
  mewtwo: {
    type: 'psychic',
    name: '뮤츠',    emoji: '🔮',
    hp: 10150, speed: 52, reward: 22, size: 44,
    color: '#7c4dff',
    special: 'finalBoss',
    isBoss: true,
    shieldHp: 1000,   // 방어막 (먼저 제거해야 함)
    shieldActive: true,
    teleportCooldown: 0, teleportInterval: 14,
  },

  // ─── 콘텐츠 확장: 추가 포켓몬 8종 ───
  rattata: {
    type: 'normal',
    name: '꼬렛',     emoji: '🐭',
    hp: 81,  speed: 165, reward: 1, size: 16,
    color: '#a1887f',
    special: 'swift',     // 매우 빠름, 타겟팅 우선순위 낮춤 트릭용
  },
  zubat: {
    type: 'psychic',
    name: '주뱃',     emoji: '🦋',
    hp: 102,  speed: 132, reward: 1, size: 18,
    color: '#7e57c2',
    special: 'flying',
    flyHeight: 6,
  },
  koffing: {
    type: 'psychic',
    name: '또도가스', emoji: '☁️',
    hp: 203, speed: 48, reward: 1, size: 20,
    color: '#90a4ae',
    special: 'poisonAura',  // 주변 적 면역 부여(단순화: 자기 자신만 면역 적용은 poisonImmune로 처리)
    poisonImmune: true,
  },
  magnemite: {
    type: 'electric',
    name: '코일(야생)', emoji: '🧲',
    hp: 171,  speed: 76, reward: 1, size: 18,
    color: '#fdd835',
    special: 'shockImmune',  // 스턴 저항 50%
    stunResist: 0.5,
  },
  onix: {
    type: 'normal',
    name: '롱스톤',   emoji: '🪨',
    hp: 528, speed: 39, reward: 2, size: 28,
    color: '#8d6e63',
    special: 'armor',
  },
  haunter: {
    type: 'psychic',
    name: '고우스트', emoji: '👤',
    hp: 284, speed: 100, reward: 2, size: 22,
    color: '#5e35b1',
    special: 'ghost',
    ghostAlpha: 0.6,
  },
  electrode: {
    type: 'electric',
    name: '마그넷',   emoji: '🔴',
    hp: 223, speed: 125, reward: 1, size: 20,
    color: '#e53935',
    special: 'explode',
    explodeRadius: 70, explodeDamage: 40,
  },
  dragonite: {
    type: 'water',
    name: '망나뇽',   emoji: '🐉',
    hp: 1827, speed: 70, reward: 6, size: 34,
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
    this._stunImmune = 0;   // v27-10: 스턴 면역 잔여시간 (연속스턴락 방지)
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

    // v27-14 버그수정: 스턴+빙결이 각각 활성화되어 있을 때 if/else if 구조 때문에 빙결 타이머가
    // 스턴이 끝날 때까지 아예 멈춰있어서 두 지속시간이 순차로 더해지고 있었음(요청2의 근본 원인).
    // 이제 둘 다 독립적으로 동시에 감소함 - "못 움직이는 상태"인 건 같지만 시간은 각자 흐름.
    if (this.stunned > 0) {
      this.stunned -= dt;
      if (this.stunned <= 0) this._stunImmune = 1.8; // 스턴 풀리면 잠깐 면역시간 부여 (연속스턴락 방지)
    }
    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) this._stunImmune = Math.max(this._stunImmune || 0, 1.8);
    }
    if (this.stunned > 0 || this.frozen > 0) {
      // 못 움직이는 상태 - 이동 스킵
    } else {
      if (this._stunImmune > 0) this._stunImmune -= dt;
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
    // v27-14: 도트데미지(화상/독) 완전 제거 (요청 - 반복 재발해서 아예 매커니즘을 없앰).
    // 상태이상 발동 시점에 총량을 즉발로 이미 지급했으므로, 여기서는 시각효과(아이콘)용으로 시간만 감소시킴.
    if (this.burning > 0) this.burning -= dt;
    if (this.poisoned > 0) this.poisoned -= dt;
    if (this._burnCooldown > 0) this._burnCooldown -= dt;
    if (this._spawnGraceTimer > 0) this._spawnGraceTimer -= dt; // v27-34: 보스 스폰유예 감소
    if (this._poisonCooldown > 0) this._poisonCooldown -= dt;

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
    // v27-34: 보스 스폰 유예기간 - 등장 직후 순삭 방지용 안전장치 (요청: 원인불문 최소 생존시간 보장)
    if (this._spawnGraceTimer > 0) dmg *= 0.15; // v27-35: 60%감소로도 부족해서 85%감소로 대폭 강화

    // v27-36: 보스 초당 데미지 상한 (요청 - "체력 올려도 중첩버그면 소용없다"는 지적이 맞음. 숨은 배율버그를
    // 못 찾아도 결과적으로 순삭을 물리적으로 차단하기 위해, 보스는 최대체력의 12%까지만 1초 안에 받도록 제한)
    if (this.isBoss && this.maxHp > 0) {
      const now = performance.now();
      if (!this._dmgWindowStart || now - this._dmgWindowStart > 1000) {
        this._dmgWindowStart = now;
        this._dmgWindowTotal = 0;
      }
      const capPerWindow = this.maxHp * 0.12;
      const remaining = Math.max(0, capPerWindow - this._dmgWindowTotal);
      dmg = Math.min(dmg, remaining);
      this._dmgWindowTotal += dmg;
    }

    this.hp -= dmg;
    this.flashTimer = 0.1;

    // v27-7: 데미지 숫자 표시 (요청1 - 지금까지 전혀 없었음). DOT 미세틱(0.x 데미지)은 스팸 방지로 제외
    if (dmg >= 1 && this.engine?.spawnFloatingText) {
      const size = dmg >= 30 ? 15 : dmg >= 10 ? 12 : 10;
      const color = dmg >= 30 ? '#ff5252' : dmg >= 10 ? '#ffd60a' : '#fff';
      this.engine.spawnFloatingText(`-${Math.round(dmg)}`, this.x + (Math.random()*16-8), this.y - 14, color, { fontSize: size, life: 0.5 });
    }

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
          // v27-8: 슬로우 하한 완화 (요청3) - 최대 70%감속까지만 (거의 정지 방지)
          this.slowFactor = Math.max(0.42, Math.min(this.slowFactor, factor || 0.5));
        }
        break;
      case 'stun':
        if (this.def.stunResist) duration *= (1 - this.def.stunResist);
        // v27-10: 스턴 면역시간 도입 - 스턴 풀린 직후 1.8초간은 새 스턴이 15%만 반영됨
        if (this._stunImmune > 0) duration *= 0.15;
        // v27-10: 발동 자체가 35% 확률로 줄었으니, 발동했을 때는 조금 더 확실히 멈추도록 상한 상향(1.2→1.6초)
        duration = Math.min(duration, 1.6);
        if (this.stunned > 0) {
          this.stunned = Math.min(1.6, this.stunned + duration * 0.35);
        } else if (duration > this.stunned) {
          this.stunned = duration;
        }
        break;
      case 'burn':
        if (this.def.special === 'poisonImmune') return; // 독/화상 면역은 불에도 약한 건 아니나 단순화
        // v27-19 버그수정: 여러 화염타워가 번갈아 때리면 화상이 계속 재발동되어 사실상 도트처럼
        // 반복 대미지가 들어가고 있었음. burning 지속시간과 별개로 "발동 쿨다운"을 둬서 확실히 막음.
        if ((this._burnCooldown || 0) > 0) break;
        this._burnCooldown = 7.5; // v27-37: 클러스터에서 연쇄폭발처럼 들리는 문제로 쿨다운 연장
        duration = Math.min(duration, 3.5);
        {
          this.burning = duration;
          this.burnDamage = factor || 10;
          const total = duration * this.burnDamage;
          const radius = 42; // v27-40: 55→42px로 축소 (밀집 클러스터에서 화상 폭발 누적효과 완화)
          if (this.engine) {
            let hitAny = false;
            for (const e of this.engine.enemies) {
              if (e.dead || e.reachedEnd) continue;
              const d = Math.hypot(e.x - this.x, e.y - this.y);
              if (d <= radius) {
                // v27-22 버그수정: 스플래시로 맞는 주변 적들은 쿨다운이 안 걸려서, 클러스터 안의 적이
                // 여러 화염타워의 폭발에 계속 무방비로 맞아 "드드드드" 반복피해를 입던 진짜 원인이었음.
                if ((e._burnCooldown || 0) > 0) continue;
                e._burnCooldown = 7.5;
                e.takeDamage(e === this ? total : total * 0.5, 'fire'); // 원래 대상 100%, 주변은 50%
                hitAny = true;
              }
            }
            if (hitAny && window.AoeBurst) this.engine.particles.push(new AoeBurst(this.x, this.y, radius, '#ff7043'));
          } else {
            this.takeDamage(total, 'fire');
          }
        }
        break;
      case 'poison':
        if (this.def.special === 'poisonImmune' || this.def.poisonImmune) return;
        // v27-19: 독도 화상과 동일하게 재발동 쿨다운 적용 (여러 독타워가 번갈아 때려서 반복되던 문제 방지)
        if ((this._poisonCooldown || 0) > 0) break;
        this._poisonCooldown = 7.5;
        {
          this.poisoned = duration;
          this.poisonDamage = factor || 8;
          const total = duration * this.poisonDamage;
          const SPREAD_RANGE = 65, MAX_TARGETS = 4; // v27-40: 90→65px로 축소 (밀집한 풀타입 클러스터에서 전파범위가 넓어 누적효과가 컸음)
          let targets = [this];
          if (this.engine) {
            const nearby = this.engine.enemies
              .filter(e => e !== this && !e.dead && !e.reachedEnd && Math.hypot(e.x - this.x, e.y - this.y) <= SPREAD_RANGE)
              .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y))
              .slice(0, MAX_TARGETS - 1);
            targets = targets.concat(nearby);
          }
          const per = total / targets.length;
          for (const tgt of targets) {
            if ((tgt._poisonCooldown || 0) > 0) continue; // v27-22: 전파 대상도 쿨다운 체크
            tgt._poisonCooldown = 7.5;
            tgt.takeDamage(per, 'poison');
            if (tgt !== this) { tgt.poisoned = Math.max(tgt.poisoned, 0.6); tgt.poisonDamage = 0; } // 살짝 독기운 표시만(추가 데미지는 안 나감, 논스택 유지)
          }
        }
        break;
      case 'freeze':
        if (this.def.special === 'iceImmune') return;
        // v27-14: 빙결도 스턴과 동일한 보호장치 적용 (면역시간+갱신감쇠) - 요청: 빙결+스턴 중첩으로 영구멈춤
        if (this._stunImmune > 0) duration *= 0.15;
        duration = Math.min(duration, 1.8);
        if (this.frozen > 0) {
          this.frozen = Math.min(1.8, this.frozen + duration * 0.35);
        } else if (duration > this.frozen) {
          this.frozen = duration;
        }
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
    // v27-4: 분裂 (아보) - 죽을 때 약한 개체 2마리로 분裂
    if (this.def.special === 'split' && !this._isSplitChild) {
      for (let i = 0; i < 2; i++) {
        const child = new Enemy(this.typeId, this.path, this.engine);
        child._isSplitChild = true;
        child.maxHp = Math.round(this.maxHp * 0.35);
        child.hp = child.maxHp;
        child.reward = Math.max(1, Math.round(this.reward * 0.4));
        child.size = this.size * 0.7;
        child.distTraveled = this.distTraveled;
        child.speed = this.speed * 1.15;
        this.engine.enemies.push(child);
      }
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
    // v27-4 fix: 파티클을 2번 호출하면 타격음 확률도 2번 굴러서 유독 시끄럽게 들리던 문제 - 1번만 호출
    this.engine.spawnHitParticle(this.x, this.y, '#ff9800');
    this.engine.spawnFloatingText('💥 폭발!', this.x, this.y - 20, '#ff9800');
  }

  doSpore() {
    // 근처 타워를 디버프 (2단계에서 구현)
    this.engine.spawnFloatingText('🍄', this.x, this.y - 20, '#ff7043');
  }

  doTeleport() {
    // v27-61 버그수정: 기존 15%/8초 점프가 누적되면서 오른쪽 지그재그 구간(타워 사거리가 닿는 곳)을
    // 통째로 건너뛰어버려서, 뮤츠가 계속 왼쪽 복귀통로 근처에서만 맴도는 것처럼 보이던 버그
    // (요청: "뮤츠 소환하면 왼쪽길로만 워프해서 오른쪽 타워가 못 때림"). 점프폭을 줄이고 주기를 늘림.
    const jumpDist = this.totalLen * 0.06;
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

    // v27-16: 현상금 몬스터 시각효과 (요청2)
    if (this._bounty) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, drawY, s * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,214,10,${0.6 + Math.sin(Date.now()*0.01)*0.3})`;
      ctx.lineWidth = 3; ctx.shadowColor = '#ffd60a'; ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
      ctx.font = '14px serif'; ctx.textAlign = 'center';
      ctx.fillText('💰', this.x, drawY - s * 1.6);
    }

    // 스턴/빙결 효과 (v27-38: shadowBlur 대신 저비용 방식 - 다수의 적이 동시에 CC 걸리면 부담이 컸음)
    let ccGlow = null;
    if (this.stunned > 0 || this.frozen > 0) {
      ccGlow = this.frozen > 0 ? '#81d4fa' : '#fff176';
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

    // v27-38: 스턴/빙결 저비용 링 (shadowBlur 대신)
    if (ccGlow) {
      ctx.save();
      ctx.beginPath(); ctx.arc(this.x, drawY, s * 1.05, 0, Math.PI * 2);
      ctx.strokeStyle = ccGlow; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // 몸통: 이미지 스프라이트 (없으면 원+이모지 폴백)
    const imgPath = EnemySpriteImages[this.typeId];
    const img = imgPath ? window.loadSpriteImage(imgPath) : null;
    const isDarkElite = this._elite === 'gold'; // v27-38: ctx.filter(4중 체인, 매우 비쌈) 대신 저비용 틴트로 교체

    if (img && img.complete && img.naturalWidth > 0) {
      const drawSize = s * 1.7;
      // v27-10: 이미지 여백 자동크롭 적용
      const b = window.SpriteBoundsCache?.[imgPath];
      if (this.flashTimer > 0) {
        // 피격 시 흰색 실루엣 오버레이
        ctx.save();
        if (b) ctx.drawImage(img, b.x, b.y, b.w, b.h, this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        else ctx.drawImage(img, this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        ctx.restore();
      } else {
        if (b) ctx.drawImage(img, b.x, b.y, b.w, b.h, this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        else ctx.drawImage(img, this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
        if (isDarkElite) {
          // v27-38: 골드 엘리트 흑화 연출 - filter 대신 저비용 색조 오버레이
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = 'rgba(60,0,90,0.55)';
          ctx.fillRect(this.x - drawSize / 2, drawY - drawSize / 2, drawSize, drawSize);
          ctx.restore();
        }
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
    const ratio = Math.max(0, this.hp / this.maxHp);
    // v27-62 최적화: 풀피(한 대도 안 맞은) 일반 몬스터는 HP바 생략 - 필드 100마리+ 상황에서
    // 대부분이 풀피라 라운드렉트×2를 크게 절감. 정보 손실도 없음(풀피 바는 정보가치가 없으므로).
    // 보스/방어막 몬스터는 항상 표시 (존재감/게임정보상 중요).
    if (ratio >= 0.999 && !this.isBoss && !this.def.shieldHp) return;
    const bw = Math.max(this.size * 1.6, 36);
    const bh = this.isBoss ? 7 : 5;
    const bx = this.x - bw / 2;
    const by = drawY - this.size * 0.7 - bh - 3;

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


 
