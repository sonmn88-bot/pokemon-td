// ===== UI-BUILDERS.JS =====
// v27-7: main.js가 2200줄+로 너무 커져서 UI 빌드 관련 메서드들을 분리했습니다 (요청4).
// App 클래스 자체는 main.js에 그대로 있고, 여기서는 프로토타입에 메서드를 추가하는 방식으로 확장합니다.
// (클래식 스크립트라 전역 스코프를 공유하므로, main.js가 이 파일보다 먼저 로드되어 App 클래스가
//  정의된 후 이 파일이 실행되면 안전하게 동작합니다. index.html에서 main.js 다음에 이 파일을 로드하세요.)
Object.assign(App.prototype, {
  buildTowerBar() {
    this.els.towerBar.innerHTML = '';
    this.els.towerBar.classList.add('tower-bar-real');

    const scroll = document.createElement('div');
    scroll.className = 'tower-bar-scroll gacha-bar';

    // 뽑기 버튼 3종 (v27 fix: cost를 여기 하드코딩하지 말고 실제 과금 기준인 PULL_COSTS에서 읽어오도록 - 안 그러면 가격 바꿀 때마다 표시랑 실제가 어긋남)
    const pulls = [
      { key:'normal',  label:'일반 뽑기',  color:'#9e9e9e', emoji:'🎰', hotkey:'1' },
      { key:'premium', label:'프리미엄',   color:'#4fc3f7', emoji:'💎', hotkey:'2' },
      { key:'gamble',  label:'도박 뽑기',  color:'#ffd60a', emoji:'🎲', hotkey:'3' },
      { key:'ten',     label:'10연 뽑기',  color:'#ce93d8', emoji:'🌟', ten:true, hotkey:'4' },
    ];

    for (const p of pulls) {
      const cost = window.PULL_COSTS?.[p.key] ?? 0;
      const btn = document.createElement('button');
      btn.className = 'tower-btn gacha-btn';
      btn.dataset.pullKey = p.key;
      btn.style.borderColor = p.color + '60';
      btn.innerHTML = `
        <span class="hotkey-badge">${p.hotkey}</span>
        <span class="tower-btn-emoji">${p.emoji}</span>
        <span class="tower-btn-name" style="color:${p.color}">${p.label}</span>
        <span class="tower-btn-cost">💰${cost}</span>
      `;
      btn.title = p.key === 'gamble' ? '에픽~레전드 확률 높음! (단축키: ' + p.hotkey + ')' :
                  p.key === 'ten'    ? '10개 묶음 (개당 45g, 확률은 일반뽑기와 동일) (단축키: ' + p.hotkey + ')' :
                  p.key === 'premium'? '레어~에픽 위주 (단축키: ' + p.hotkey + ')' : '노말~레어 위주 (단축키: ' + p.hotkey + ')';
      btn.addEventListener('click', () => this.doPull(p.key, btn));
      scroll.appendChild(btn);
    }

    // 구분선
    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px;background:rgba(255,255,255,0.1);margin:4px 2px;flex-shrink:0';
    scroll.appendChild(sep);

    // 영웅 버튼 (게임 시작 시 고른 1명만 - 뮤/리자몽/거북왕은 더 이상 영웅으로 쓰지 않음)
    {
      const heroId = this.starterHero || 'pikachu';
      const def = window.HeroDefs[heroId];
      const btn = document.createElement('button');
      btn.className = 'tower-btn hero-btn';
      btn.dataset.heroKey = heroId;
      const skinId = this.selectedHeroSkins[heroId];
      const skin = window.SkinDefs[heroId][skinId];
      btn.innerHTML = `
        <span class="tower-btn-emoji">${skin.emoji}</span>
        <span class="tower-btn-name">${def.name}</span>
        <span class="tower-btn-cost">👆이동 🎨스킨</span>
      `;
      btn.title = def.passive;
      btn.addEventListener('click', () => this.selectHeroToPlace(heroId, btn));
      btn.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openSkinPicker(heroId); });
      let pressTimer;
      btn.addEventListener('touchstart', () => { pressTimer = setTimeout(() => this.openSkinPicker(heroId), 500); });
      btn.addEventListener('touchend', () => clearTimeout(pressTimer));
      scroll.appendChild(btn);
    }

    this.els.towerBar.appendChild(scroll);
    this._towerBarScroll = scroll;
    this.refreshPullButtons();
  },

  syncTowerPanel() {
    let panel = document.getElementById('tower-panel');
    if (!this.engine.selectedTower) { panel?.remove(); return; }

    const t = this.engine.selectedTower;
    const slotIdx = this.engine.towerSlots.findIndex(s => s.tower === t);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'tower-panel';
      document.getElementById('game-screen').appendChild(panel);
    }

    const def = t.def || t;
    const isGacha = !!t._gachaId;

    if (isGacha) {
      // ===== 가챠 타워 패널 =====
      const grade = window.GRADES?.[def.grade] || { name:'?', color:'#fff', stars:1 };
      const dps = (t.damage * t.fireRate).toFixed(1);
      const sameSlots = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === t._gachaId);
      const sameCount = sameSlots.length;
      const canMerge = sameCount >= 3;
      const evolveId = window.MERGE_EVOLUTION?.[t._gachaId];
      const evolveDef = evolveId ? window.GachaTowerDefs?.[evolveId] : null;
      const synergyInfo = t.synergyBonus > 0
        ? `<span style="color:#ffd60a;font-size:10px">⚡시너지 +${t.synergyBonus}</span>`
        : `<span style="color:#888;font-size:10px" title="같은 타입 타워를 150px 이내에 배치하면 데미지 시너지가 붙습니다">⚡시너지 없음 (150px 이내 같은 타입 배치시 발동)</span>`;
      const refundCosts = {normal:35, rare:84, epic:140, legend:240, unique:420};
      const refund = refundCosts[def.grade] || 35;

      // v27: 스탯 옆 (+%) 강화 표시 + 다음 강화 힌트
      const dmgPct = Math.round(((t.buffDmgMul||1) - 1) * 100);
      const rangePct = Math.round(((t.buffRangeMul||1) - 1) * 100);
      const spdPct = Math.round(((t._shopSpeedMul||1) - 1) * 100);
      const dmgTag = dmgPct !== 0 ? ` <span style="color:#4fc3f7">(+${dmgPct}%)</span>` : '';
      const rangeTag = rangePct !== 0 ? ` <span style="color:#4fc3f7">(+${rangePct}%)</span>` : '';
      const spdTag = spdPct !== 0 ? ` <span style="color:#4fc3f7">(+${spdPct}%)</span>` : '';
      // v27-5: 숙련도 표시 (item2)
      const masteryLv = this.engine?._masteryLevel?.[def.id] || 0;
      const masteryTag = masteryLv > 0
        ? `<div style="font-size:10px;color:#ce93d8;margin-top:2px">⭐ 숙련도 ${Math.min(20,masteryLv)}/20 (데미지 +${Math.min(20,masteryLv)*2}%) - 같은 포켓몬 더 뽑을수록 증가</div>`
        : '';
      const flavor = window.FLAVOR_TEXT?.[def.id];
      const flavorTag = flavor ? `<div style="font-size:9.5px;color:#777;font-style:italic;margin-top:3px;max-width:220px;">"${flavor}"</div>` : '';
      const tuLevel = window.TypeUpgradeLevels?.[def.type] || 0;
      const tuNext = window.TypeUpgrades?.[def.type]?.[tuLevel];
      const upgradeHint = tuNext
        ? `<div style="font-size:10px;color:#7fe3ff;margin-top:2px">💡 하단 타입강화바에서 "${tuNext.label}"(💰${tuNext.cost}) 올리면 이 타워가 강해져요</div>`
        : `<div style="font-size:10px;color:#888;margin-top:2px">💡 이 타입 강화 최대 단계 달성</div>`;

      panel.innerHTML = `
        <div class="tower-panel-name" style="color:${grade.color}">
          ${def.emoji} ${def.name} ${'★'.repeat(grade.stars)} <span style="font-size:10px">${grade.name}</span>
        </div>
        <div class="tower-panel-stats">⚔️${Math.round(t.damage)}${dmgTag} · ⏱️${t.fireRate.toFixed(1)}/s${spdTag} · DPS:${dps} · 📏${Math.round(t.range)}${rangeTag} ${synergyInfo}</div>
        ${upgradeHint}
        ${masteryTag}
        ${flavorTag}
        <div style="font-size:10px;color:#aaa;margin:2px 0">${def.desc||''}</div>
        <div style="font-size:10px;margin:3px 0;color:${canMerge?'#ffd60a':'#888'}">
          ${canMerge
            ? `✅ 합치기 가능! (${sameCount}/3)${evolveDef?' → '+evolveDef.emoji+evolveDef.name:''}`
            : `동일 타워 ${sameCount}/3${evolveDef?' (목표: '+evolveDef.emoji+evolveDef.name+')':''}`}
        </div>
        <div class="tower-panel-btns">
          ${canMerge
            ? `<button class="tp-btn tp-upgrade" data-action="merge">✨ 합치기 진화!</button>`
            : `<button class="tp-btn tp-maxed" disabled>합치기 ${sameCount}/3</button>`}
          <button class="tp-btn tp-sell" data-action="sell">💸 +${refund}g</button>
        </div>
      `;

      panel.querySelector('[data-action="merge"]')?.addEventListener('click', () => {
        const allSameSlots = this.engine.towerSlots.filter(s => s.occupied && s.tower?._gachaId === t._gachaId);
        if (allSameSlots.length < 3 || !evolveDef) return;
        // 현재 선택 슬롯을 항상 진화 위치로 고정
        const currentSlot = this.engine.towerSlots[slotIdx];
        const otherSlots = allSameSlots.filter(s => s !== currentSlot).slice(0, 2);
        const mergeSlots = [currentSlot, ...otherSlots];
        for (let i = 1; i < 3; i++) {
          this.engine.towers = this.engine.towers.filter(x => x !== mergeSlots[i].tower);
          mergeSlots[i].occupied = false; mergeSlots[i].tower = null;
        }
        const evoTower = window._createGachaTower(evolveDef, currentSlot.x, currentSlot.y, this.engine);
        evoTower._evolveGlowTimer = 1.2; // v27-5: 합체진화 연출 (item1)
        this.engine.towers = this.engine.towers.filter(x => x !== currentSlot.tower);
        this.engine.towers.push(evoTower);
        currentSlot.tower = evoTower;
        this.engine.selectedTower = evoTower;
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        const evoGrade = window.GRADES[evolveDef.grade];
        this.engine.spawnFloatingText(`✨ ${evolveDef.name}!`, currentSlot.x, currentSlot.y-40, evoGrade.color);
        this.engine.particles.push(new BurstRing(currentSlot.x, currentSlot.y, 70, evoGrade.color));
        this.engine.triggerScreenShake(6, 0.25);
        if (this.missionTracker) { this.missionTracker.stats.mergeCount++; this.missionTracker.check(); }
        this.SFX.play('merge');
        this.syncTowerPanel();
      });

      panel.querySelector('[data-action="sell"]')?.addEventListener('click', () => {
        // 실제 gold 환급
        this.engine.addGold(refund);
        this.engine.towers = this.engine.towers.filter(x => x !== t);
        const slot = this.engine.towerSlots[slotIdx];
        if (slot) { slot.occupied = false; slot.tower = null; }
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        this.engine.selectedTower = null;
        panel.remove();
        this.refreshPullButtons();
      });
    } else {
      // ===== 기존 업그레이드 타워 패널 (영웅 슬롯 등) =====
      const dps = (t.damage * t.fireRate).toFixed(1);
      panel.innerHTML = `
        <div class="tower-panel-name">${t.name}</div>
        <div class="tower-panel-stats">⚔️${Math.round(t.damage)} · ⏱️${t.fireRate.toFixed(1)}/s · DPS:${dps}</div>
        <div class="tower-panel-btns">
          <button class="tp-btn tp-sell" data-action="sell">💸 판매</button>
        </div>
      `;
      panel.querySelector('[data-action="sell"]')?.addEventListener('click', () => {
        this.engine.sellTower(slotIdx);
        this.engine.selectedTower = null; panel.remove();
      });
    }
  },

  buildHeroSkillBar() {
    let bar = document.getElementById('hero-skill-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'hero-skill-bar';
      document.getElementById('game-screen').appendChild(bar);
    }
    bar.innerHTML = '';
    for (const hero of this.engine.heroes) {
      const wrap = document.createElement('div');
      wrap.className = 'hero-skills-group';

      // v27 fix: label+경험치바를 세로 컬럼으로 묶어야 가로 flex 그룹 안에서 제대로 보임
      const infoCol = document.createElement('div');
      infoCol.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;min-width:64px;';
      const label = document.createElement('div');
      label.className = 'hero-skills-label';
      const _ht = window.HERO_TYPE_MAP?.[hero.evolved || hero.id];
      const _ti = _ht ? window.TYPES?.[_ht] : null;
      label.textContent = `${hero.skin.emoji} ${hero.name} Lv${hero.level} ${_ti ? _ti.emoji : ''}`;
      infoCol.appendChild(label);

      const expOuter = document.createElement('div');
      expOuter.className = 'hero-exp-bar-outer';
      expOuter.style.cssText = 'width:100%;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin-top:3px;overflow:hidden;';
      const expInner = document.createElement('div');
      expInner.className = 'hero-exp-bar-inner';
      expInner.dataset.heroId = hero.id;
      expInner.style.cssText = `height:100%;background:#4fc3f7;width:${Math.min(100, (hero.exp/hero.expToNext)*100)}%;transition:width 0.2s;`;
      expOuter.appendChild(expInner);
      infoCol.appendChild(expOuter);
      wrap.appendChild(infoCol);

      // 스킬 버튼
      const heroIdx = this.engine.heroes.indexOf(hero);
      const hotkeyMap = [['Q','W'],['E','R']][heroIdx] || [];
      hero.def.skills.forEach((skill, idx) => {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.dataset.heroId = hero.id;
        btn.dataset.skillIdx = idx;
        btn.innerHTML = `<span class="hotkey-badge">${hotkeyMap[idx]||''}</span><span class="skill-emoji">${skill.emoji}</span><span class="skill-cd"></span>`;
        btn.title = `${skill.name}: ${skill.desc}${hotkeyMap[idx] ? ` (단축키: ${hotkeyMap[idx]})` : ''}`;
        btn.addEventListener('click', () => {
          if (hero.cast(idx, this.engine)) {
            this.showWaveAnnounce(`${skill.emoji} ${skill.name}!`, '#ffd60a');
          }
        });
        wrap.appendChild(btn);
      });

      // 스킬트리 버튼 (SP 있을 때만 강조)
      const treeBtn = document.createElement('button');
      treeBtn.className = 'skill-btn skill-tree-btn';
      treeBtn.dataset.heroId = hero.id;
      treeBtn.innerHTML = `<span class="skill-emoji">${hero.skillPoints > 0 ? '🌟' : '📊'}</span>`;
      treeBtn.title = `스킬트리 (SP: ${hero.skillPoints})`;
      if (hero.skillPoints > 0) treeBtn.style.borderColor = '#ffd60a';
      treeBtn.addEventListener('click', () => this.openSkillTree(hero));
      wrap.appendChild(treeBtn);

      bar.appendChild(wrap);
    }
  },

  updateHeroSkillBarUI() {
    const bar = document.getElementById('hero-skill-bar');
    if (!bar) return;
    for (const hero of this.engine.heroes) {
      const label = bar.querySelector(`.hero-skills-group .hero-skills-label`);
      const expInner = bar.querySelector(`.hero-exp-bar-inner[data-hero-id="${hero.id}"]`);
      if (expInner) {
        expInner.style.width = `${Math.min(100, (hero.exp/hero.expToNext)*100)}%`;
        const grp = expInner.closest('.hero-skills-group');
        const lbl = grp?.querySelector('.hero-skills-label');
        if (lbl) {
          const _ht2 = window.HERO_TYPE_MAP?.[hero.evolved || hero.id];
          const _ti2 = _ht2 ? window.TYPES?.[_ht2] : null;
          lbl.textContent = `${hero.skin.emoji} ${hero.name} Lv${hero.level} ${_ti2 ? _ti2.emoji : ''}`;
        }
      }
      hero.def.skills.forEach((skill, idx) => {
        const btn = bar.querySelector(`.skill-btn[data-hero-id="${hero.id}"][data-skill-idx="${idx}"]`);
        if (!btn) return;
        const cd = hero.cooldowns[idx];
        const cdEl = btn.querySelector('.skill-cd');
        if (cd > 0) {
          btn.classList.add('on-cooldown');
          cdEl.textContent = Math.ceil(cd);
        } else {
          btn.classList.remove('on-cooldown');
          cdEl.textContent = '';
        }
      });
    }
  },

  buildTypeUpgradeBar() {
    let bar = document.getElementById('type-upgrade-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'type-upgrade-bar';
      document.getElementById('game-screen').appendChild(bar);
    }
    bar.innerHTML = '';
    if (!window.TypeUpgrades || !window.TYPES) return;

    // v27-4: 최다 투자 속성 뱃지 계산 (item11) - 레벨이 가장 높은 타입에 표시 (1 이상이고 유일할 때만)
    let topType = null, topLevel = 0, tieCount = 0;
    for (const tk in window.TypeUpgrades) {
      const lv = window.TypeUpgradeLevels?.[tk] || 0;
      if (lv > topLevel) { topLevel = lv; topType = tk; tieCount = 1; }
      else if (lv === topLevel && lv > 0) { tieCount++; }
    }
    const showBadge = topType && topLevel > 0 && tieCount === 1;

    for (const typeKey in window.TypeUpgrades) {
      const typeInfo = window.TYPES[typeKey];
      const maxBaseTiers = window.TypeUpgrades[typeKey].length;
      const level = window.TypeUpgradeLevels?.[typeKey] || 0;
      // v27-4: 5단계 이후에도 숨기지 않고 무한 반복 강화로 계속 표시

      const nextUpg = window.getTypeUpgradeAt(typeKey, level);
      const dotsStr = level < maxBaseTiers
        ? '●'.repeat(level) + '○'.repeat(maxBaseTiers-level)
        : '★'.repeat(Math.min(5, level - maxBaseTiers + 1)); // 5단계 이후는 별로 계속 누적 표시
      const btn = document.createElement('button');
      btn.className = 'type-upg-btn';
      btn.dataset.typeKey = typeKey;
      btn.style.borderColor = typeInfo.color + '60';
      btn.style.position = 'relative';
      if (showBadge && typeKey === topType) {
        btn.style.boxShadow = `0 0 10px ${typeInfo.color}`;
      }
      btn.innerHTML = `
        ${showBadge && typeKey === topType ? '<span style="position:absolute;top:-6px;right:-4px;font-size:11px;">👑</span>' : ''}
        <span>${typeInfo.emoji}</span>
        <span style="font-size:9px;color:${typeInfo.color}">${typeInfo.name}</span>
        <span style="font-size:8px;color:#ffd60a">💰${nextUpg.cost}</span>
        <span style="font-size:7px;color:#888">${dotsStr}</span>
      `;
      btn.title = (showBadge && typeKey === topType ? '👑 가장 많이 투자한 속성\n' : '') + `${nextUpg.label}: ${nextUpg.cost}g`;
      btn.addEventListener('click', () => {
        if (!this.engine) return;
        if (window.applyTypeUpgrade(typeKey, this.engine)) {
          if (!this.missionTracker.stats.typeUpgrades) this.missionTracker.stats.typeUpgrades = {};
          this.missionTracker.stats.typeUpgrades[typeKey] = (this.missionTracker.stats.typeUpgrades[typeKey]||0) + 1;
          this.missionTracker.check();
          this.SFX.play('buy');
          this.buildTypeUpgradeBar(); // 갱신
        } else {
          this.showWaveAnnounce('골드 부족!', '#ff6b6b');
        }
      });
      bar.appendChild(btn);
    }
    this.buildShopBar(); // v27 fix: 상점을 별도줄 대신 타입강화바 같은 줄 옆에 이어붙임
  },

  buildSpellBar() {
    let bar = document.getElementById('spell-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'spell-bar';
      document.getElementById('game-screen').appendChild(bar);
    }
    bar.innerHTML = '';
    for (const key in window.GlobalSpells) {
      const spell = window.GlobalSpells[key];
      const btn = document.createElement('button');
      btn.className = 'spell-btn';
      btn.dataset.spellKey = key;
      btn.innerHTML = `
        <span class="spell-emoji">${spell.emoji}</span>
        <span class="spell-name" style="font-size:10px;font-weight:700">${spell.name}</span>
        <span class="spell-cd"></span>
      `;
      btn.title = `${spell.name}: ${spell.desc} (쿨타임 ${spell.cooldown}초)`;
      btn.addEventListener('click', () => { this.spellMgr.cast(key, this.engine); });
      bar.appendChild(btn);
    }
  },

  updateSpellBarUI() {
    const bar = document.getElementById('spell-bar');
    if (!bar) return;
    for (const key in window.GlobalSpells) {
      const btn = bar.querySelector(`.spell-btn[data-spell-key="${key}"]`);
      if (!btn) continue;
      const cd = this.spellMgr.cooldowns[key];
      const cdEl = btn.querySelector('.spell-cd');
      if (cd > 0) {
        btn.classList.add('on-cooldown');
        cdEl.textContent = Math.ceil(cd);
      } else {
        btn.classList.remove('on-cooldown');
        cdEl.textContent = '';
      }
    }
  },

  openSkillTree(hero) {
    const existing = document.querySelector('.skilltree-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'skilltree-overlay';

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.innerHTML = `${hero.skin.emoji} ${hero.name} 스킬트리 <span class="sp-badge">SP: ${hero.skillPoints}</span>`;
    overlay.appendChild(title);

    const tree = window.SkillTrees[hero.id];
    if (tree) {
      const grid = document.createElement('div');
      grid.className = 'skilltree-grid';

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const node = tree.nodes.find(n => n.col === col && n.row === row);
          const cell = document.createElement('div');
          if (node) {
            const isUnlocked = hero.unlockedSkills.has(node.id);
            const canUnlock = !isUnlocked && hero.skillPoints >= node.cost &&
                              (!node.requires || hero.unlockedSkills.has(node.requires));
            cell.className = `st-node ${isUnlocked ? 'unlocked' : ''} ${canUnlock ? 'available' : ''} ${!isUnlocked && !canUnlock ? 'locked' : ''}`;
            cell.innerHTML = `
              <div class="st-emoji">${node.emoji}</div>
              <div class="st-name">${node.name}</div>
              <div class="st-cost">${isUnlocked ? '✅' : `💎${node.cost}`}</div>
            `;
            cell.title = node.desc;
            if (canUnlock) {
              cell.addEventListener('click', () => {
                if (hero.unlockSkillNode(node.id, this.engine)) {
                  this.openSkillTree(hero); // 새로고침
                  this.buildHeroSkillBar();
                }
              });
            }
          } else {
            cell.className = 'st-node empty';
          }
          grid.appendChild(cell);
        }
      }
      overlay.appendChild(grid);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  },

  _onMissionComplete(mission) {
    // v27-4 버그수정: mission.rewardType==='gold' 체크가 있었는데 MissionDefs엔 애초에 rewardType 필드 자체가 없어서
    // 이 조건이 항상 false였음 -> 지금까지 미션 보상이 한 번도 실제로 지급된 적이 없었던 치명적 버그였음
    if (mission.reward && this.engine) {
      this.engine.addGold(mission.reward);
    }
    // 팝업
    const el = document.createElement('div');
    el.className = 'mission-popup';
    el.innerHTML = `
      <div class="mission-popup-title">🎯 미션 완료!</div>
      <div class="mission-popup-name">${mission.name}</div>
      <div class="mission-popup-reward">+${mission.reward}g 획득!</div>
    `;
    document.getElementById('game-screen').appendChild(el);
    setTimeout(() => el.remove(), 3000);
  },

  openSynergyChart() {
    const existing = document.querySelector('.synergy-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'synergy-overlay mission-overlay'; // 미션판과 동일한 위치/스타일 재사용

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.textContent = '🧬 합치기 레시피 & 시너지 조합표';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.className = 'mission-list';

    // v27-4: 합치기 레시피 (item3 - 원래 요청하신 "조합표") - 같은 타워 3개 모으면 합쳐지는 표
    const mergeHeader = document.createElement('div');
    mergeHeader.style.cssText = 'font-size:12px;color:#ffd60a;font-weight:700;margin:4px 0 2px;';
    mergeHeader.textContent = '🧬 합치기 (동일 타워 3개 → 상위 등급)';
    list.appendChild(mergeHeader);

    if (window.MERGE_EVOLUTION && window.GachaTowerDefs) {
      for (const fromId in window.MERGE_EVOLUTION) {
        const toId = window.MERGE_EVOLUTION[fromId];
        const fromDef = window.GachaTowerDefs[fromId];
        const toDef = window.GachaTowerDefs[toId];
        if (!fromDef || !toDef) continue;
        const gachaOnly = ['mew'].includes(toId) ? '' : ''; // 자리표시
        const isMergeOnly = toId === 'mew';
        const row = document.createElement('div');
        row.className = 'mission-item';
        row.innerHTML = `
          <div>${fromDef.emoji}${fromDef.name} ×3 → ${toDef.emoji}${toDef.name}${isMergeOnly ? ' <span style=\"color:#ff6b6b;font-size:9px\">(합치기 전용! 뽑기로 안 나옴)</span>' : ''}</div>
          <div style="color:${window.GRADES?.[toDef.grade]?.color || '#fff'};font-size:10px">${window.GRADES?.[toDef.grade]?.name || ''}</div>
        `;
        list.appendChild(row);
      }
    }

    const synergyHeader = document.createElement('div');
    synergyHeader.style.cssText = 'font-size:12px;color:#4fc3f7;font-weight:700;margin:14px 0 2px;';
    synergyHeader.textContent = '🔗 배치 시너지 (150px 이내 인접 배치시 발동)';
    list.appendChild(synergyHeader);

    // 동일 타입
    const sameRow = document.createElement('div');
    sameRow.className = 'mission-item';
    sameRow.innerHTML = `<div>⚡⚡ 같은 타입끼리</div><div style="color:#ffd60a">+8 데미지</div>`;
    list.appendChild(sameRow);

    if (window.SYNERGY_PAIRS && window.TYPES) {
      for (const key in window.SYNERGY_PAIRS) {
        const [ta, tb] = key.split('|');
        const pair = window.SYNERGY_PAIRS[key];
        const infoA = window.TYPES[ta], infoB = window.TYPES[tb];
        const row = document.createElement('div');
        row.className = 'mission-item';
        row.innerHTML = `
          <div>${infoA.emoji}${infoB.emoji} ${infoA.name}+${infoB.name} <span style="color:#888;font-size:10px">(${pair.label})</span></div>
          <div style="color:#ffd60a">+${pair.bonus} 데미지</div>
        `;
        list.appendChild(row);
      }
    }
    overlay.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'shop-close-btn';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  },

  openMissionBoard() {
    const existing = document.querySelector('.mission-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'mission-overlay';

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.textContent = '🎯 미션 보드';
    overlay.appendChild(title);

    // v27-6: 전체 도감 수집 진행률 표시 (요청1 - 영구보너스 대신 진행상황만)
    const tracker0 = this.missionTracker;
    if (window.GRADE_POOLS && tracker0) {
      const allIds = [...window.GRADE_POOLS.normal, ...window.GRADE_POOLS.rare, ...window.GRADE_POOLS.epic, ...window.GRADE_POOLS.legend, ...window.GRADE_POOLS.unique, 'mew'];
      const collected = allIds.filter(id => tracker0.stats.collectedIds.has(id)).length;
      const dexBar = document.createElement('div');
      dexBar.style.cssText = 'text-align:center;color:#ffd60a;font-size:13px;margin-bottom:8px;';
      dexBar.textContent = `📖 도감 수집: ${collected}/${allIds.length}종`;
      overlay.appendChild(dexBar);
    }

    const list = document.createElement('div');
    list.className = 'mission-list';

    const tracker = this.missionTracker;
    for (const m of window.MissionDefs) {
      const done = tracker && tracker.completed.has(m.id);
      // v27-6: 수집형 미션은 진행률(n/총) 같이 표시
      let progressStr = '';
      if (window.GRADE_POOLS && tracker) {
        const gradeMap = { collect_normal:'normal', collect_rare:'rare', collect_epic:'epic', collect_legend:'legend' };
        const g = gradeMap[m.id];
        if (g) {
          const need = window.GRADE_POOLS[g];
          const have = need.filter(id => tracker.stats.collectedIds.has(id)).length;
          progressStr = ` (${have}/${need.length})`;
        }
      }
      const item = document.createElement('div');
      item.className = `mission-item ${done ? 'done' : ''}`;
      item.innerHTML = `
        <span class="mission-status">${done ? '✅' : '⬜'}</span>
        <div class="mission-info">
          <div class="mission-name">${m.name}</div>
          <div class="mission-desc">${m.desc}${progressStr}</div>
        </div>
        <div class="mission-reward">💰${m.reward}</div>
      `;
      list.appendChild(item);
    }
    overlay.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'skin-picker-close';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);

    document.getElementById('game-screen').appendChild(overlay);
  },

  buildShopBar() {
    // v27 fix: 별도 줄(#shop-bar) 대신 타입강화바(#type-upgrade-bar) 안에 이어붙임
    const bar = document.getElementById('type-upgrade-bar');
    if (!bar) return;
    document.getElementById('shop-bar')?.remove(); // 예전 별도줄 잔재 정리
    bar.querySelectorAll('.shop-bar-btn, .shop-bar-divider').forEach(b => b.remove());
    if (!window.ShopItems || !this.engine) return;
    if (!this.engine._shopBuyCount) this.engine._shopBuyCount = {};
    const divider = document.createElement('div');
    divider.className = 'shop-bar-divider';
    divider.style.cssText = 'flex:0 0 auto;width:1px;align-self:stretch;background:rgba(255,255,255,0.15);margin:4px 2px;';
    bar.appendChild(divider);
    for (const item of window.ShopItems) {
      const cost = window.shopItemCost(item, this.engine);
      const used = item.oneTime && this.engine._oneTimeUsed?.[item.key];
      const btn = document.createElement('button');
      btn.className = 'shop-bar-btn';
      btn.disabled = used || this.engine.gold < cost;
      btn.innerHTML = used
        ? `<span style="opacity:0.4">${item.emoji}</span><span style="font-size:8px;color:#888">사용완료</span>`
        : `<span>${item.emoji}</span><span style="font-size:8px;color:#ffd60a">💰${cost}</span>`;
      btn.title = used ? `${item.name}: 이미 사용함 (게임당 1회)` : `${item.name}: ${item.desc}`;
      btn.addEventListener('click', () => {
        if (used) return;
        if (!this.engine.spendGold(cost)) {
          this.showWaveAnnounce('골드가 부족합니다', '#ff6b6b');
          return;
        }
        const result = item.buy(this.engine);
        if (result === false) {
          // 구매 취소 조건(예: 대상 없음) - 골드 환불
          this.engine.addGold(cost);
          return;
        }
        if (item.scaling) this.engine._shopBuyCount[item.key] = (this.engine._shopBuyCount[item.key] || 0) + 1;
        if (item.oneTime) {
          if (!this.engine._oneTimeUsed) this.engine._oneTimeUsed = {};
          this.engine._oneTimeUsed[item.key] = true;
        }
        this.SFX.play('buy');
        this.showWaveAnnounce(`${item.emoji} ${item.name} 사용!`, '#06d6a0');
        this.buildShopBar();
      });
      bar.appendChild(btn);
    }
  },

  buildBossSummonButton() {
    let bar = document.getElementById('boss-summon-bar');
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = 'boss-summon-bar';
    bar.style.cssText = 'position:absolute;left:8px;bottom:calc(var(--bar-h,82px) + 100px);z-index:19;display:flex;flex-direction:column;gap:3px;background:rgba(20,5,5,0.75);border-radius:10px;padding:5px;border:1px solid rgba(255,60,60,0.3);';
    document.getElementById('game-screen').appendChild(bar);

    if (this._bossSummonTier == null) this._bossSummonTier = 1;

    const tierRow = document.createElement('div');
    tierRow.style.cssText = 'display:flex;gap:3px;';
    for (const t of BOSS_TIERS) {
      const chip = document.createElement('button');
      chip.className = 'boss-tier-chip';
      chip.dataset.tier = t.tier;
      chip.textContent = t.tier;
      chip.title = `${t.label} (체력×${t.hpMul}, 보상×${t.rewardMul})`;
      chip.style.cssText = 'width:22px;height:22px;border-radius:6px;border:1.5px solid rgba(255,255,255,0.2);background:rgba(0,0,0,0.4);color:#fff;font-size:11px;cursor:pointer;padding:0;';
      chip.addEventListener('click', () => { this._bossSummonTier = t.tier; this._updateBossSummonUI(); });
      tierRow.appendChild(chip);
    }
    bar.appendChild(tierRow);

    const summonBtn = document.createElement('button');
    summonBtn.id = 'boss-summon-btn';
    summonBtn.style.cssText = 'padding:5px 8px;border-radius:8px;border:1.5px solid rgba(255,60,60,0.5);background:rgba(60,5,5,0.9);color:#fff;font-size:10px;cursor:pointer;';
    summonBtn.addEventListener('click', () => this._summonBoss(this._bossSummonTier));
    bar.appendChild(summonBtn);

    this._updateBossSummonUI();
  }
});
