// ===== HEROES.JS - 영웅 3종 + 스킨 시스템 + 레벨업 =====

// ===== 스킨 정의 =====
// 능력치는 동일, 비주얼(이모지/색상/이펙트컬러)만 차별화
const SkinDefs = {
  pikachu: {
    default:   { name: '기본',     emoji: '⚡', color: '#ffd600', unlocked: true,  fxColor: '#fff176' },
    christmas: { name: '크리스마스', emoji: '🎅', color: '#e53935', unlocked: false, fxColor: '#ffcdd2', badge: '🎄' },
    sakura:    { name: '벚꽃',     emoji: '🌸', color: '#f8bbd0', unlocked: false, fxColor: '#fce4ec', badge: '🌸' },
    halloween: { name: '할로윈',   emoji: '🎃', color: '#ff6f00', unlocked: false, fxColor: '#bf360c', badge: '🦇' },
  },
  mew: {
    default:   { name: '기본',     emoji: '💗', color: '#f48fb1', unlocked: true,  fxColor: '#f8bbd0' },
    christmas: { name: '크리스마스', emoji: '🎁', color: '#66bb6a', unlocked: false, fxColor: '#c8e6c9', badge: '🎄' },
    sakura:    { name: '벚꽃',     emoji: '🌷', color: '#ce93d8', unlocked: false, fxColor: '#f3e5f5', badge: '🌸' },
  },
  togepi: {
    default:   { name: '기본',     emoji: '🥚', color: '#fff9c4', unlocked: true,  fxColor: '#fffde7' },
    christmas: { name: '크리스마스', emoji: '⛄', color: '#81d4fa', unlocked: false, fxColor: '#e1f5fe', badge: '🎄' },
    sakura:    { name: '벚꽃',     emoji: '🌺', color: '#ffab91', unlocked: false, fxColor: '#fbe9e7', badge: '🌸' },
  },
};

// ===== 영웅 기본 정의 =====
const HeroDefs = {
  pikachu: {
    id: 'pikachu', name: '피카츄', baseColor: '#ffd600',
    role: '전기 딜러',
    passive: '전기 타입 타워 데미지 +15%',
    passiveApply(engine) {
      for (const t of engine.towers) {
        if (t.def && t.def.id === 'voltorb') t.buffDmgMul = 1.15;
      }
    },
    skills: [
      {
        name: '100만볼트', emoji: '⚡', cooldown: 14,
        desc: '범위 내 모든 적에게 전기 데미지 + 감전',
        cast(hero, engine) {
          const r = 140 + hero.level * 10;
          for (const e of engine.enemies) {
            if (e.dead || e.reachedEnd) continue;
            if (Math.hypot(e.x - hero.x, e.y - hero.y) <= r) {
              e.takeDamage(40 + hero.level * 15, 'special');
              e.applyStatus('stun', 0.8, 0);
            }
          }
          engine.particles.push(new AoeBurst(hero.x, hero.y, r, hero.skinFx));
          engine.spawnFloatingText('⚡100만볼트!', hero.x, hero.y - 30, '#ffeb3b');
        }
      },
      {
        name: '전광석화', emoji: '💨', cooldown: 10,
        desc: '가장 강한 적 1체에게 즉시 큰 피해',
        cast(hero, engine) {
          let target = null, maxHp = -1;
          for (const e of engine.enemies) {
            if (e.dead || e.reachedEnd) continue;
            if (e.hp > maxHp) { maxHp = e.hp; target = e; }
          }
          if (target) {
            target.takeDamage(150 + hero.level * 50, 'special');
            engine.particles.push(new ChainBolt(hero.x, hero.y, target.x, target.y));
            engine.spawnFloatingText('💨 전광석화!', target.x, target.y - 20, '#ffd600');
          }
        }
      },
    ],
  },

  mew: {
    id: 'mew', name: '뮤', baseColor: '#f48fb1',
    role: '광역 슬로우 / 버프',
    passive: '모든 타워 사거리 +10%',
    passiveApply(engine) {
      for (const t of engine.towers) t.buffRangeMul = 1.10;
    },
    skills: [
      {
        name: '사이킥', emoji: '🔮', cooldown: 13,
        desc: '범위 내 모든 적 슬로우',
        cast(hero, engine) {
          const r = 150 + hero.level * 10;
          for (const e of engine.enemies) {
            if (e.dead || e.reachedEnd) continue;
            if (Math.hypot(e.x - hero.x, e.y - hero.y) <= r) {
              e.applyStatus('slow', 3, 0.4);
              e.takeDamage(20 + hero.level * 8, 'special');
            }
          }
          engine.particles.push(new AoeBurst(hero.x, hero.y, r, hero.skinFx));
          engine.spawnFloatingText('🔮 사이킥!', hero.x, hero.y - 30, '#ce93d8');
        }
      },
      {
        name: '변신', emoji: '✨', cooldown: 20,
        desc: '가장 약한 적 1체를 일시적으로 무력화',
        cast(hero, engine) {
          let target = null, minHp = Infinity;
          for (const e of engine.enemies) {
            if (e.dead || e.reachedEnd || e.isBoss) continue;
            if (e.hp < minHp) { minHp = e.hp; target = e; }
          }
          if (target) {
            target.applyStatus('stun', 4 + hero.level * 0.5, 0);
            engine.spawnFloatingText('✨ 변신!', target.x, target.y - 20, '#f8bbd0');
          }
        }
      },
    ],
  },

  togepi: {
    id: 'togepi', name: '토게피', baseColor: '#fff9c4',
    role: '서포터 / 회복',
    passive: '피격(라이프 손실) 시 적 전체에 반사 데미지',
    passiveApply(engine) {
      engine._togepiReflect = true;
    },
    skills: [
      {
        name: '메트로놈', emoji: '🎲', cooldown: 16,
        desc: '랜덤 대형 효과 (광역뎀/전체슬로우/전체스턴 중 1)',
        cast(hero, engine) {
          const roll = Math.floor(Math.random() * 3);
          const r = 9999;
          if (roll === 0) {
            for (const e of engine.enemies) { if (!e.dead && !e.reachedEnd) e.takeDamage(60 + hero.level * 20, 'special'); }
            engine.spawnFloatingText('🎲 메트로놈: 전체 피해!', hero.x, hero.y - 30, '#ffd54f');
          } else if (roll === 1) {
            for (const e of engine.enemies) { if (!e.dead && !e.reachedEnd) e.applyStatus('slow', 3, 0.4); }
            engine.spawnFloatingText('🎲 메트로놈: 전체 슬로우!', hero.x, hero.y - 30, '#4fc3f7');
          } else {
            for (const e of engine.enemies) { if (!e.dead && !e.reachedEnd) e.applyStatus('stun', 1.2, 0); }
            engine.spawnFloatingText('🎲 메트로놈: 전체 스턴!', hero.x, hero.y - 30, '#ba68c8');
          }
        }
      },
      {
        name: '행복의알', emoji: '🥚', cooldown: 18,
        desc: '모든 타워 데미지 +25% (8초)',
        cast(hero, engine) {
          for (const t of engine.towers) {
            t.buffDmgMul = (t.buffDmgMul || 1) * 1.25;
            t._happyEggTimer = 8;
          }
          engine.spawnFloatingText('🥚 행복의알!', hero.x, hero.y - 30, '#fff59d');
        }
      },
    ],
  },
};

// ===== HERO CLASS =====
class Hero {
  constructor(heroId, x, y, skinId = 'default') {
    this.id = heroId;
    this.def = HeroDefs[heroId];
    this.x = x; this.y = y;
    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.skinId = skinId;

    this.cooldowns = this.def.skills.map(() => 0);
    this.castFlash = [0, 0];

    // 벡터 애니메이션 리그
    const drawFn = (window.HeroDrawFns && window.HeroDrawFns[heroId]) || null;
    this.rig = drawFn ? new window.SpriteRig(drawFn, { attackDuration: 0.3, bobAmount: 2.5, bobSpeed: 3 }) : null;
  }

  get skin() { return SkinDefs[this.id][this.skinId] || SkinDefs[this.id].default; }
  get skinFx() { return this.skin.fxColor; }
  get name() { return this.def.name; }

  _skinHueShift() {
    // 스킨별 고정 색조 회전값 (이미지 1장으로 변형 차별화)
    const map = { christmas: 320, sakura: 200, halloween: 60 };
    return map[this.skinId] || 0;
  }

  gainExp(amount, engine) {
    this.exp += amount;
    while (this.exp >= this.expToNext && this.level < 5) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.floor(this.expToNext * 1.4);
      engine && engine.spawnFloatingText(`${this.def.name} Lv${this.level}!`, this.x, this.y - 40, '#ffd60a');
    }
  }

  update(dt, engine) {
    this.def.passiveApply(engine);

    for (let i = 0; i < this.cooldowns.length; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i] -= dt;
      if (this.castFlash[i] > 0) this.castFlash[i] -= dt;
    }

    if (this.rig) this.rig.update(dt, false); // 영웅은 고정 배치(이동 없음)
  }

  canCast(idx) {
    return this.cooldowns[idx] <= 0;
  }

  cast(idx, engine) {
    if (!this.canCast(idx)) return false;
    const skill = this.def.skills[idx];
    skill.cast(this, engine);
    this.cooldowns[idx] = skill.cooldown;
    this.castFlash[idx] = 0.3;
    if (this.rig) this.rig.triggerAttack();
    return true;
  }

  draw(ctx) {
    const skin = this.skin;

    if (this.rig) {
      // 벡터/이미지 애니메이션 렌더링
      ctx.save();
      // 오라
      ctx.beginPath();
      ctx.arc(this.x, this.y, 32, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, 32);
      grad.addColorStop(0, skin.color + '40');
      grad.addColorStop(1, skin.color + '00');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // 스킨이 기본이 아니면 색조 필터로 차별화 (이미지 자체는 1장만 보유)
      const needsTint = this.skinId !== 'default';
      if (needsTint) {
        ctx.save();
        ctx.filter = `hue-rotate(${this._skinHueShift()}deg) saturate(1.3)`;
      }

      this.rig.draw(ctx, this.x, this.y, 24, skin.color);

      if (needsTint) ctx.restore();

      // 스킨 뱃지
      if (skin.badge) {
        ctx.save();
        ctx.font = '13px serif';
        ctx.textAlign = 'center';
        ctx.fillText(skin.badge, this.x + 17, this.y - 17);
        ctx.restore();
      }

      // 레벨 표시
      ctx.save();
      ctx.font = 'bold 10px -apple-system, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(`Lv${this.level}`, this.x, this.y + 34);
      ctx.restore();
      return;
    }

    // 폴백: 리그 없으면 기존 이모지 방식
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, 30, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(this.x, this.y, 5, this.x, this.y, 30);
    grad.addColorStop(0, skin.color + '55');
    grad.addColorStop(1, skin.color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    ctx.strokeStyle = skin.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(skin.emoji, this.x, this.y);

    if (skin.badge) {
      ctx.font = '14px serif';
      ctx.fillText(skin.badge, this.x + 18, this.y - 18);
    }

    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`Lv${this.level}`, this.x, this.y + 34);

    ctx.restore();
  }
}

// ===== 영웅/스킨 보유 데이터 (로컬 진행 상태) =====
const HeroProgress = {
  unlockedSkins: {
    pikachu: ['default'],
    mew: ['default'],
    togepi: ['default'],
  },
  unlockSkin(heroId, skinId) {
    if (!this.unlockedSkins[heroId].includes(skinId)) {
      this.unlockedSkins[heroId].push(skinId);
    }
  },
  isUnlocked(heroId, skinId) {
    return this.unlockedSkins[heroId].includes(skinId);
  },
};

window.HeroDefs = HeroDefs;
window.SkinDefs = SkinDefs;
window.Hero = Hero;
window.HeroProgress = HeroProgress;
