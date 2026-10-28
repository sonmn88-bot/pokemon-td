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

    // v28 세션E: 강화 시트 열기 버튼 (타입강화+상점)
    {
      const ub = document.createElement('button');
      ub.className = 'tower-btn upg-open-btn';
      ub.innerHTML = `<span class="tower-btn-emoji">${ICON('upgrade', 24)}</span><span class="tower-btn-name">강화</span><span class="tower-btn-cost">상점</span>`;
      ub.title = '타입 강화 + 상점 (단축키: U)';
      ub.addEventListener('click', () => this.toggleUpgradeSheet());
      scroll.appendChild(ub);
    }

    // 뽑기 버튼 3종 (v27 fix: cost를 여기 하드코딩하지 말고 실제 과금 기준인 PULL_COSTS에서 읽어오도록 - 안 그러면 가격 바꿀 때마다 표시랑 실제가 어긋남)
    const pulls = [
      { key:'normal',  label:'일반',  color:'#a7adba', icon:'capsule', hotkey:'1' },
      { key:'premium', label:'프리미엄',   color:'#5b9dff', icon:'capsuleBlue', hotkey:'2' },
      { key:'gamble',  label:'도박',  color:'#ffc24b', icon:'dice', hotkey:'3' },
      { key:'ten',     label:'10연',  color:'#b18cff', icon:'capsules', ten:true, hotkey:'4' },
    ];

    for (const p of pulls) {
      const cost = window.PULL_COSTS?.[p.key] ?? 0;
      const btn = document.createElement('button');
      btn.className = 'tower-btn gacha-btn';
      btn.dataset.pullKey = p.key;
      btn.style.borderColor = p.color + '60';
      btn.innerHTML = `
        <span class="hotkey-badge">${p.hotkey}</span>
        <span class="tower-btn-emoji">${ICON(p.icon, 26)}</span>
        <span class="tower-btn-name" style="color:${p.color}">${p.label}</span>
        <span class="tower-btn-cost">${ICON('coin', 11)}${cost}</span>
      `;
      btn.title = p.key === 'gamble' ? '2~5성 확정! (단, 4성 극희귀·5성 극악희귀, 고가) (단축키: ' + p.hotkey + ')' :
                  p.key === 'ten'    ? '10개 묶음 (개당 90g, 일반뽑기와 동일 확률=1성만) (단축키: ' + p.hotkey + ')' :
                  p.key === 'premium'? '1~3성 (3성은 희귀) (단축키: ' + p.hotkey + ')' : '1성(노말)만 나옵니다 (단축키: ' + p.hotkey + ')';
      btn.addEventListener('click', () => this.doPull(p.key, btn));
      scroll.appendChild(btn);
    }

    // v28: 보관함 스트립 (합성 버튼 + 보관 중인 포켓몬) - 기존 '1개 더 뽑으면 합체' 힌트를 대체
    const strip = document.createElement('div');
    strip.id = 'storage-strip';
    strip.className = 'storage-strip';
    scroll.appendChild(strip);

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
      btn.innerHTML = `
        <span class="tower-btn-emoji"><img class="pk" src="assets/heroes/${heroId}.png" width="30" height="30" alt=""></span>
        <span class="tower-btn-name">${def.name}</span>
        <span class="tower-btn-cost">이동</span>
      `;
      btn.title = def.passive;
      btn.addEventListener('click', () => this.selectHeroToPlace(heroId, btn));
      scroll.prepend(btn); // v3.6: 보관함이 쌓여도 바로 누를 수 있게 맨 왼쪽
    }

    this.els.towerBar.appendChild(scroll);
    this._towerBarScroll = scroll;
    this.refreshPullButtons();
    this.renderStorageStrip && this.renderStorageStrip();
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
      const evolveId = [].concat(window.MERGE_EVOLUTION?.[t._gachaId] || [])[0];
      const evolveDef = evolveId ? window.GachaTowerDefs?.[evolveId] : null;
      const synergyInfo = ''; // v28 세션E: 시너지 제거됨
      const refund = (window.SELL_VALUE || {})[def.grade] || 40; // v28: 판매가 단일 기준

      // v27: 스탯 옆 (+%) 강화 표시 + 다음 강화 힌트
      const dmgPct = Math.round(((t.buffDmgMul||1) - 1) * 100);
      const rangePct = Math.round(((t.buffRangeMul||1) - 1) * 100);
      const spdPct = Math.round(((t._shopSpeedMul||1) - 1) * 100);
      const dmgTag = dmgPct !== 0 ? `<i>+${dmgPct}%</i>` : '';
      const rangeTag = rangePct !== 0 ? `<i>+${rangePct}%</i>` : '';
      const spdTag = spdPct !== 0 ? `<i>+${spdPct}%</i>` : '';
      const masteryTag = ''; // v28 세션E: 숙련도 제거
      const flavor = window.FLAVOR_TEXT?.[def.id];
      const flavorTag = flavor ? `<div class="tp-flavor">${flavor}</div>` : '';
      const tuLevel = window.TypeUpgradeLevels?.[def.type] || 0;
      const tuNext = window.TypeUpgrades?.[def.type]?.[tuLevel];
      const upgradeHint = tuNext
        ? `<div class="tp-hint">${ICON('upgrade', 14)}<span>강화 → <b>${tuNext.label}</b> ${ICON('coin', 12)}${tuNext.cost}</span></div>`
        : `<div class="tp-hint done">${ICON('upgrade', 14)}<span>이 타입 강화 최대 단계</span></div>`;
      // v27-23: 데미지 배율 breakdown (요청1) - 여러 배율이 어디서 왔는지 한눈에
      const teMul = window.typeEffectiveness && t.target ? window.typeEffectiveness(def.type, t.target.typeTag) : 1;
      const breakdown = `
        <div class="tp-calc">
          <span>데미지 계산</span> 기본${def.damage}${t.flatDmg>0?`+강화${Math.round(t.flatDmg)}`:''}
          × 타입강화${(t.buffDmgMul||1).toFixed(2)}
          ${(t._auraDmgMul||1)>1?`× 지원오라${t._auraDmgMul.toFixed(2)}`:''}
          ${(t._heroDmgMul||1)>1?`× 영웅${t._heroDmgMul.toFixed(2)}`:''}
          ${teMul!==1?`× 상성${teMul.toFixed(1)}`:''}
          = <span style="color:#ffc24b">${Math.round(t.damage)}</span>
        </div>`;

      panel.innerHTML = `
        <div class="tp-head" style="--gc:${grade.color}">
          <span class="tp-thumb">${window.PKM ? PKM(def, 44) : ''}</span>
          <div class="tp-title">
            <b class="tower-panel-name">${def.name}</b>
            <span class="tp-grade">${'★'.repeat(grade.stars)} ${def.mega ? '메가' : grade.name}${def.desc ? `<i>${def.desc}</i>` : ''}</span>
          </div>
        </div>
        <div class="tp-stats">
          <div><small>${ICON('sword', 13)}공격력</small><b>${Math.round(t.damage)}${dmgTag}</b></div>
          <div><small>${ICON('timer', 13)}공격 속도</small><b>${t.fireRate.toFixed(1)}/s${spdTag}</b></div>
          <div><small>${ICON('bolt', 13)}초당 피해</small><b>${dps}</b></div>
          <div><small>${ICON('range', 13)}사거리</small><b>${Math.round(t.range)}${rangeTag}</b></div>
        </div>
        ${upgradeHint}
        ${breakdown}
        ${flavorTag}
        ${this._megaPanelHtml ? `<div class="mega-box">${this._megaPanelHtml(t)}</div>` : ''}
        <div class="tower-panel-btns">
          <button class="tp-btn tp-recall" data-action="recall">${ICON('bag', 15)}보관함으로</button>
          ${window.canUseTM && window.canUseTM(t) ? `<button class="tp-btn" data-action="tm" style="grid-column:1 / -1" title=""태그 1개를 랜덤으로 배움 (타워당 1회)">${ICON('disc', 15)}기술머신 ${window.TM_COST}</button>` : ''}
          <button class="tp-btn tp-sell" data-action="sell">${ICON('sell', 15)}판매 +${refund}</button>
        </div>
      `;
      // v28: 필드 타워를 보관함으로 회수 (무료) - 합성 재료로 쓰거나 자리 재배치용
      panel.querySelector('[data-action="recall"]')?.addEventListener('click', () => {
        this.engine.towers = this.engine.towers.filter(x => x !== t);
        const slot = this.engine.towerSlots[slotIdx];
        if (slot) { slot.occupied = false; slot.tower = null; }
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        this.engine.selectedTower = null;
        panel.remove();
        this._addToStorage([{ ...def, _starLevel: 1 }]);
        this.showWaveAnnounce(`${def.name} 보관함으로`, '#a78bfa');
      });

      this._bindMegaPanel && this._bindMegaPanel(panel, t, slotIdx);
      // v28 세션D: 기술머신 - 에픽·레전드에 랜덤 태그 1개 (회수해도 유지)
      panel.querySelector('[data-action="tm"]')?.addEventListener('click', () => {
        if (!this.engine.spendGold(window.TM_COST)) { this.showWaveAnnounce('골드가 부족해요', '#ff5c7a'); return; }
        const tag = window.applyTM(t);
        this.engine.spawnFloatingText(`${window.DEX_TAGS[tag]} 습득!`, t.x, t.y - 36, '#6aa8ff');
        this.SFX && this.SFX.play && this.SFX.play('merge');
        panel.remove(); this.engine.selectedTower = null;
      });

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
        let evoPick; const evoTower = window._createGachaTower((evoPick = window.GachaTowerDefs[window.getEvolutionId(t._gachaId)] || evolveDef), currentSlot.x, currentSlot.y, this.engine);
        evoTower._evolveGlowTimer = 1.2; // v27-5: 합체진화 연출 (item1)
        this.engine.towers = this.engine.towers.filter(x => x !== currentSlot.tower);
        this.engine.towers.push(evoTower);
        currentSlot.tower = evoTower;
        this.engine.selectedTower = evoTower;
        if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
        const evoGrade = window.GRADES[evoPick.grade];
        this.engine.spawnFloatingText(`${evoPick.name}!`, currentSlot.x, currentSlot.y-40, evoGrade.color);
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
      label.textContent = `${hero.name} Lv${hero.level}`;
      infoCol.appendChild(label);

      const expOuter = document.createElement('div');
      expOuter.className = 'hero-exp-bar-outer';
      expOuter.style.cssText = 'width:100%;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin-top:3px;overflow:hidden;';
      const expInner = document.createElement('div');
      expInner.className = 'hero-exp-bar-inner';
      expInner.dataset.heroId = hero.id;
      expInner.style.cssText = `height:100%;background:#5b9dff;width:${Math.min(100, (hero.exp/hero.expToNext)*100)}%;transition:width 0.2s;`;
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
        btn.innerHTML = `<span class="hotkey-badge">${hotkeyMap[idx]||''}</span><span class="skill-emoji">${idx === 0 ? (ICON(_ht, 22) || ICON('bolt', 22)) : ICON('sparkle', 20)}</span><span class="skill-cd"></span>`;
        btn.title = `${skill.name}: ${skill.desc}${hotkeyMap[idx] ? ` (단축키: ${hotkeyMap[idx]})` : ''}`;
        btn.addEventListener('click', () => {
          if (hero.cast(idx, this.engine)) {
            this.showWaveAnnounce(`${skill.name}!`, '#ffc24b');
          }
        });
        wrap.appendChild(btn);
      });

      // v3.3: 변신 아이템을 얻었으면 ✨ 버튼이 반짝임 → 누르면 변신 연출
      if (this.engine._heroItemPending) {
        const evoBtn = document.createElement('button');
        evoBtn.className = 'skill-btn hero-evo-btn';
        evoBtn.innerHTML = `<span class="skill-emoji">${ICON('sparkle', 20)}</span>`;
        evoBtn.title = `${this.engine._heroItemPending.item}: 눌러서 변신`;
        evoBtn.addEventListener('click', () => this._playHeroTransform());
        wrap.appendChild(evoBtn);
      }
      // v3.7 거다이맥스 (피카츄·라이츄 최종 각성 스킬)
      if (hero._awaken && (hero.id === 'pikachu')) {
        const gb = document.createElement('button');
        gb.className = 'skill-btn gmax-btn';
        gb.dataset.heroId = hero.id;
        gb.innerHTML = `<span class="skill-emoji">${ICON('bolt', 22)}</span><span class="skill-cd"></span>`;
        gb.title = '거다이맥스: 20초 거대화 (공격력 ×1.5 · 광역), 쿨 90초';
        gb.addEventListener('click', () => { if (window.castGmax && castGmax(hero, this.engine)) this.showWaveAnnounce('거다이맥스!', '#ffe14a'); });
        wrap.appendChild(gb);
      }
      // v3.7 메가스톤 2개 → 최종 각성 아이템 교환 (웨이브 50+, 레벨 진화 후)
      const eng = this.engine;
      if (!eng._heroItemGot && hero.evolved && (eng.currentWave || 0) >= 50 && (eng._megaStones || 0) >= 2 && this._dropHeroItem) {
        const xb = document.createElement('button');
        xb.className = 'skill-btn stone-ex-btn';
        xb.innerHTML = `<span class="skill-emoji">${ICON('gem', 20)}</span><span class="skill-cd">2</span>`;
        xb.title = '메가스톤 2개로 최종 각성 아이템 교환';
        xb.addEventListener('click', () => { if ((eng._megaStones || 0) < 2) return; eng._megaStones -= 2; this._refreshMegaHud(); this._dropHeroItem('교환'); });
        wrap.appendChild(xb);
      }
      // 스킬트리 버튼 (SP 있을 때만 강조)
      const treeBtn = document.createElement('button');
      treeBtn.className = 'skill-btn skill-tree-btn';
      treeBtn.dataset.heroId = hero.id;
      treeBtn.innerHTML = `<span class="skill-emoji">${ICON(hero.skillPoints > 0 ? 'upgrade' : 'chart', 20)}</span>`;
      treeBtn.title = `스킬트리 (SP: ${hero.skillPoints})`;
      if (hero.skillPoints > 0) treeBtn.style.borderColor = '#ffc24b';
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
          lbl.textContent = `${hero.name} Lv${hero.level}`;
        }
      }
      const gbtn = bar.querySelector('.gmax-btn'); // 거다이맥스 쿨·지속 표시
      if (gbtn) {
        const on = hero._gmaxTimer > 0, cd = hero._gmaxCd || 0;
        gbtn.classList.toggle('on-cooldown', !on && cd > 0); gbtn.classList.toggle('active', on);
        gbtn.querySelector('.skill-cd').textContent = on ? Math.ceil(hero._gmaxTimer) : cd > 0 ? Math.ceil(cd) : '';
        if (!on && cd > 0) gbtn.style.setProperty('--cdp', Math.min(1, cd / 90).toFixed(3));
      }
      hero.def.skills.forEach((skill, idx) => {
        const btn = bar.querySelector(`.skill-btn[data-hero-id="${hero.id}"][data-skill-idx="${idx}"]`);
        if (!btn) return;
        const cd = hero.cooldowns[idx];
        const cdEl = btn.querySelector('.skill-cd');
        if (cd > 0) {
          btn.classList.add('on-cooldown');
          cdEl.textContent = Math.ceil(cd);
          const full = hero._skillCd ? hero._skillCd(idx) : cd; // v3.6 원형 쿨타임 (남은 비율)
          btn.style.setProperty('--cdp', Math.min(1, cd / (full || cd)).toFixed(3));
        } else {
          btn.classList.remove('on-cooldown');
          cdEl.textContent = '';
        }
      });
    }
  },

  // v28 세션E: 타입강화 + 상점 → '강화 시트' 하나로 통합 (상시 노출 바 제거 → 맵이 더 넓게 보임)
  // 시트는 게임을 멈추지 않고 열어둔 채 플레이 가능 (몬스터볼 연타 등). 닫혀 있을 땐 하단 🛠 버튼에 살 수 있음 표시만.
  buildTypeUpgradeBar() {
    document.getElementById('type-upgrade-bar')?.remove(); // 옛 상시바 잔재
    let sheet = document.getElementById('upgrade-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'upgrade-sheet';
      sheet.innerHTML = `<div class="us-head"><span>${ICON('upgrade', 18)} 강화 · 상점</span><button class="us-close" aria-label="닫기">✕</button></div>
        <div class="us-label">타입 강화 <small>해당 타입 타워 전부 · 등급별 고정 데미지 + 6%</small></div>
        <div class="us-grid us-types"></div>
        <div class="us-label">상점 <small>웨이브마다 사용 횟수 초기화</small></div>
        <div class="us-grid us-shop"></div>`;
      sheet.querySelector('.us-close').onclick = () => this.toggleUpgradeSheet(false);
      document.getElementById('game-screen').appendChild(sheet);
    }
    if (!window.TypeUpgrades || !window.TYPES || !this.engine) return;
    const grid = sheet.querySelector('.us-types');
    grid.innerHTML = '';
    const F = window.TYPE_FLAT_PER_TIER || {};
    for (const typeKey in window.TypeUpgrades) {
      const typeInfo = window.TYPES[typeKey];
      const level = window.TypeUpgradeLevels?.[typeKey] || 0;
      const nextUpg = window.getTypeUpgradeAt(typeKey, level);
      const k = nextUpg.flat || 0;
      const fieldCnt = this.engine.towers.filter(t => t.def?.type === typeKey).length;
      const btn = document.createElement('button');
      btn.className = 'us-card';
      btn.style.setProperty('--c', typeInfo.color);
      btn.disabled = this.engine.gold < nextUpg.cost;
      btn.innerHTML = `<b>${ICON(typeKey, 18)} ${typeInfo.name} <span class="us-lv">Lv${level}</span></b>
        <span class="us-desc">노말+${F.normal*k} · 에픽+${F.epic*k} · +${Math.round((nextUpg.val||0)*100)}%</span>
        <span class="us-meta">필드 ${fieldCnt}마리</span>
        <span class="us-cost">${ICON('coin', 12)}${nextUpg.cost}</span>`;
      btn.title = `${nextUpg.label}: 노말+${F.normal*k} 레어+${F.rare*k} 에픽+${F.epic*k} 레전드+${F.legend*k} (+${Math.round((nextUpg.val||0)*100)}%)`;
      btn.addEventListener('click', () => {
        if (window.applyTypeUpgrade(typeKey, this.engine)) {
          if (!this.missionTracker.stats.typeUpgrades) this.missionTracker.stats.typeUpgrades = {};
          this.missionTracker.stats.typeUpgrades[typeKey] = (this.missionTracker.stats.typeUpgrades[typeKey]||0) + 1;
          this.missionTracker.check();
          this.SFX.play('buy');
          this.buildTypeUpgradeBar();
        } else this.showWaveAnnounce('골드 부족!', '#ff5c7a');
      });
      grid.appendChild(btn);
    }
    this.buildShopBar();
  },

  toggleUpgradeSheet(open) {
    const sheet = document.getElementById('upgrade-sheet');
    if (!sheet) return;
    const on = open === undefined ? !sheet.classList.contains('open') : open;
    sheet.classList.toggle('open', on);
    document.querySelector('.upg-open-btn')?.classList.toggle('active', on);
    if (on) this.buildTypeUpgradeBar();
  },

  // 닫혀 있을 때도 '지금 살 수 있는 강화가 있다'는 점만 하단 버튼에 표시 (DOM 재생성 없이 가볍게)
  _refreshUpgradeDot() {
    const btn = document.querySelector('.upg-open-btn');
    if (!btn || !this.engine || !window.TypeUpgrades) return;
    const g = this.engine.gold;
    const can = Object.keys(window.TypeUpgrades).some(t => g >= window.getTypeUpgradeAt(t, window.TypeUpgradeLevels?.[t] || 0).cost);
    btn.classList.toggle('has-dot', can);
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
        <span class="spell-emoji">${spell.icon ? ICON(spell.icon, 16) : spell.emoji}</span>
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

  // v28 세션 C: 3갈래 × 4단계 스킬트리 화면 (모바일에서도 설명이 보이도록 노드 안에 표시)
  openSkillTree(hero) {
    document.querySelector('.skilltree-overlay')?.remove();
    const tree = window.SkillTrees[hero.id];
    if (!tree) return;
    const overlay = document.createElement('div');
    overlay.className = 'skilltree-overlay st2';
    document.getElementById('game-screen').appendChild(overlay);
    const EVO_NAMES = { flareon:'부스터', jolteon:'쥬피썬더', vaporeon:'샤미드' };

    const render = () => {
      const spent = [...hero.unlockedSkills].reduce((a, id) => a + (tree.nodes.find(n => n.id === id)?.cost || 0), 0);
      const cols = tree.branches.map((b, bi) => {
        const match = b.evo && hero.evolved === b.evo;
        const head = `<div class="st2-head" style="--bc:${b.color}">
            <div class="st2-bname">${b.emoji} ${b.name}</div>
            ${b.evo ? `<div class="st2-evo ${match ? 'on' : ''}">${match ? '✨ 진화 일치 ×1.5' : EVO_NAMES[b.evo] + ' 진화 시 ×1.5'}</div>` : ''}
          </div>`;
        const nodes = tree.nodes.filter(n => n.branch === bi).sort((a, b) => a.tier - b.tier).map(n => {
          const have = hero.unlockedSkills.has(n.id);
          const reqOk = !n.requires || hero.unlockedSkills.has(n.requires);
          const can = !have && reqOk && hero.skillPoints >= n.cost;
          const cls = have ? 'have' : can ? 'can' : reqOk ? 'poor' : 'lock';
          return `<button class="st2-node ${cls} ${n.tier === 4 ? 'cap' : ''}" data-id="${n.id}" style="--bc:${b.color}">
              <div class="st2-top"><span class="st2-emoji">${n.emoji}</span><span class="st2-cost">${have ? '✓' : n.cost + 'SP'}</span></div>
              <div class="st2-name">${n.name}</div>
              <div class="st2-desc">${n.desc.replace('[캡스톤] ', '')}</div>
            </button>`;
        }).join('<div class="st2-link"></div>');
        return `<div class="st2-col">${head}${nodes}</div>`;
      }).join('');
      overlay.innerHTML = `
        <div class="st2-bar">
          <div class="st2-title">${hero.skin.emoji} ${hero.name} 스킬트리</div>
          <div class="sp-badge">SP ${hero.skillPoints}</div>
          <button class="mg-x" data-act="close">✕</button>
        </div>
        <div class="st2-sub">Lv${hero.level} · 사용 ${spent}SP · 만렙까지 총 25SP → 갈래 2개 반 선택 · ${hero.def.passive || ''}</div>
        <div class="st2-grid">${cols}</div>`;
      overlay.querySelector('[data-act="close"]').onclick = () => overlay.remove();
      overlay.querySelectorAll('.st2-node').forEach(el => el.onclick = () => {
        const n = tree.nodes.find(x => x.id === el.dataset.id);
        if (hero.unlockedSkills.has(n.id)) return;
        if (n.requires && !hero.unlockedSkills.has(n.requires)) {
          const req = tree.nodes.find(x => x.id === n.requires);
          this.showWaveAnnounce(`먼저 '${req.name}'을(를) 찍어야 해요`, '#ff5c7a'); return;
        }
        if (hero.skillPoints < n.cost) { this.showWaveAnnounce(`SP가 부족해요 (${n.cost}SP 필요)`, '#ff5c7a'); return; }
        if (hero.unlockSkillNode(n.id, this.engine)) {
          this.SFX.play('skill');
          render();
          this.buildHeroSkillBar();
        }
      });
    };
    render();
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

  // v27-18: 종합 전력 요약 (요청E) - 타입별 배율/최고시너지/타워수를 한 화면에
  openPowerSummary() {
    const existing = document.querySelector('.power-overlay');
    if (existing) { existing.remove(); return; }
    if (!this.engine) return;
    const overlay = document.createElement('div');
    overlay.className = 'power-overlay mission-overlay';
    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.textContent = '종합 전력 요약';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.className = 'mission-list';
    for (const typeKey in window.TypeUpgrades || {}) {
      const info = window.TYPES?.[typeKey];
      const lv = window.TypeUpgradeLevels?.[typeKey] || 0;
      let mul = 1;
      let flatTiers = 0;
      for (let i = 0; i < lv; i++) { const u = window.getTypeUpgradeAt(typeKey, i); mul *= (1 + u.val); flatTiers += (u.flat || 0); }
      const towerCount = this.engine.towers.filter(t => t.def?.type === typeKey).length;
      const row = document.createElement('div');
      row.className = 'mission-item';
      row.innerHTML = `
        <div>${info?.emoji || ''} ${info?.name || typeKey} (타워 ${towerCount}개)</div>
        <div style="color:#ffc24b">레어 기준 +${Math.round((window.TYPE_FLAT_PER_TIER?.rare||5)*flatTiers)} · x${mul.toFixed(2)} (강화 ${lv}단계)</div>
      `;
      list.appendChild(row);
    }
    const totalRow = document.createElement('div');
    totalRow.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15);font-size:12px;color:#ccc;';
    totalRow.innerHTML = `
      <div>총 배치 타워: ${this.engine.towers.length}개</div>
      <div>보유 종류: ${this.missionTracker?.stats?.collectedIds?.size || 0}종</div>
    `;
    list.appendChild(totalRow);
    overlay.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'shop-close-btn';
    closeBtn.textContent = '닫기';
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.appendChild(closeBtn);
    document.getElementById('game-screen').appendChild(overlay);
  },

  openSynergyChart() {
    const existing = document.querySelector('.synergy-overlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'synergy-overlay mission-overlay'; // 미션판과 동일한 위치/스타일 재사용

    const title = document.createElement('div');
    title.className = 'skilltree-title';
    title.textContent = '합치기 레시피 & 시너지 조합표';
    overlay.appendChild(title);

    const list = document.createElement('div');
    list.className = 'mission-list';

    // v27-4: 합치기 레시피 (item3 - 원래 요청하신 "조합표") - 같은 타워 3개 모으면 합쳐지는 표
    const mergeHeader = document.createElement('div');
    mergeHeader.style.cssText = 'font-size:12px;color:#ffc24b;font-weight:700;margin:4px 0 2px;';
    mergeHeader.textContent = '합치기 (동일 타워 3개 → 상위 등급)';
    list.appendChild(mergeHeader);

    if (window.MERGE_EVOLUTION && window.GachaTowerDefs) {
      for (const fromId in window.MERGE_EVOLUTION) {
        const toId = [].concat(window.MERGE_EVOLUTION[fromId])[0];
        const fromDef = window.GachaTowerDefs[fromId];
        const toDef = window.GachaTowerDefs[toId];
        if (!fromDef || !toDef) continue;
        const gachaOnly = ['mew'].includes(toId) ? '' : ''; // 자리표시
        const isMergeOnly = toId === 'mew';
        const row = document.createElement('div');
        row.className = 'mission-item';
        row.innerHTML = `
          <div>${fromDef.emoji}${fromDef.name} ×3 → ${toDef.emoji}${toDef.name}${isMergeOnly ? ' <span style=\"color:#ff5c7a;font-size:9px\">(합치기 전용! 뽑기로 안 나옴)</span>' : ''}</div>
          <div style="color:${window.GRADES?.[toDef.grade]?.color || '#fff'};font-size:10px">${window.GRADES?.[toDef.grade]?.name || ''}</div>
        `;
        list.appendChild(row);
      }
    }

    const synergyHeader = document.createElement('div');
    synergyHeader.style.cssText = 'font-size:12px;color:#5b9dff;font-weight:700;margin:14px 0 2px;';
    synergyHeader.textContent = '배치 시너지 (150px 이내 인접 배치시 발동)';
    list.appendChild(synergyHeader);

    // 동일 타입
    const sameRow = document.createElement('div');
    sameRow.className = 'mission-item';
    sameRow.innerHTML = `<div>같은 타입끼리</div><div style="color:#ffc24b">+8 데미지</div>`;
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
          <div style="color:#ffc24b">+${pair.bonus} 데미지</div>
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
    title.textContent = '미션 보드';
    overlay.appendChild(title);

    // v27-6: 전체 도감 수집 진행률 표시 (요청1 - 영구보너스 대신 진행상황만)
    const tracker0 = this.missionTracker;
    if (window.GRADE_POOLS && tracker0) {
      const allIds = [...window.GRADE_POOLS.normal, ...window.GRADE_POOLS.rare, ...window.GRADE_POOLS.epic, ...window.GRADE_POOLS.legend, ...window.GRADE_POOLS.unique, 'mew'];
      const collected = allIds.filter(id => tracker0.stats.collectedIds.has(id)).length;
      const dexBar = document.createElement('div');
      dexBar.style.cssText = 'text-align:center;color:#ffc24b;font-size:13px;margin-bottom:8px;';
      dexBar.textContent = `도감 수집: ${collected}/${allIds.length}종`;
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
        <span class="mission-status ${done ? 'done' : ''}">${done ? '완료' : ''}</span>
        <div class="mission-info">
          <div class="mission-name">${m.name}</div>
          <div class="mission-desc">${m.desc}${progressStr}</div>
        </div>
        <div class="mission-reward">${ICON('coin', 13)}${m.reward}</div>
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
    this._refreshUpgradeDot();
    const sheet = document.getElementById('upgrade-sheet');
    // 시트가 닫혀 있으면 다시 그리지 않음 (골드 바뀔 때마다 호출되므로 - 모바일 부하 절약)
    if (!sheet || !sheet.classList.contains('open') || !window.ShopItems || !this.engine) return;
    const grid = sheet.querySelector('.us-shop');
    // 타입강화 카드 활성/비활성만 갱신
    sheet.querySelectorAll('.us-types .us-card').forEach((c, i) => {
      const t = Object.keys(window.TypeUpgrades)[i];
      c.disabled = this.engine.gold < window.getTypeUpgradeAt(t, window.TypeUpgradeLevels?.[t] || 0).cost;
    });
    if (!this.engine._shopBuyCount) this.engine._shopBuyCount = {};
    grid.innerHTML = '';
    for (const item of window.ShopItems) {
      const cost = window.shopItemCost(item, this.engine);
      const waveUses = (this.engine._shopWaveUses || {})[item.key] || 0;
      const pw = item.perWave ? item.perWave + (item.key === 'monsterball' ? (this.engine._cardMods?.ballExtra || 0) : 0) : 0; // v3.5 카드 '볼 주머니'
      const used = (item.oneTime && this.engine._oneTimeUsed?.[item.key]) || (pw && waveUses >= pw);
      const left = pw ? `${pw - waveUses}/${pw}회` : item.oneTime ? '1회' : '';
      const btn = document.createElement('button');
      btn.className = 'us-card shop';
      btn.disabled = used || this.engine.gold < cost;
      btn.innerHTML = `<b>${item.icon ? ICON(item.icon, 18) : item.emoji} ${item.name}</b><span class="us-desc">${item.desc}</span>
        <span class="us-meta">${used ? '사용 완료' : left}</span><span class="us-cost">${ICON('coin', 12)}${cost}</span>`;
      btn.addEventListener('click', () => {
        if (used) return;
        if (!this.engine.spendGold(cost)) { this.showWaveAnnounce('골드가 부족합니다', '#ff5c7a'); return; }
        const result = item.buy(this.engine);
        if (result === false) { this.engine.addGold(cost); return; } // 대상 없음 등 → 환불
        if (item.scaling) this.engine._shopBuyCount[item.key] = (this.engine._shopBuyCount[item.key] || 0) + 1;
        if (item.perWave) { if (!this.engine._shopWaveUses) this.engine._shopWaveUses = {}; this.engine._shopWaveUses[item.key] = (this.engine._shopWaveUses[item.key] || 0) + 1; }
        if (item.oneTime) { if (!this.engine._oneTimeUsed) this.engine._oneTimeUsed = {}; this.engine._oneTimeUsed[item.key] = true; }
        this.SFX.play('buy');
        this.showWaveAnnounce(`${item.name} 사용!`, '#34d399');
        this.buildShopBar();
      });
      grid.appendChild(btn);
    }
  },

  // ===== v28 세션E: 결과 공유 카드 (1080×1350, 인스타 4:5) =====
  async buildShareCard() {
    const e = this.engine;
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const loadImg = (src) => new Promise(res => {
      if (!src) return res(null);
      const im = new Image(); const to = setTimeout(() => res(null), 2500);
      im.onload = () => { clearTimeout(to); res(im); }; im.onerror = () => { clearTimeout(to); res(null); };
      im.src = src;
    });
    const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
    const font = (px, w = 800) => `${w} ${px}px "Pretendard Variable", Pretendard, -apple-system, sans-serif`;
    const GR = window.GRADES, ORDER = ['unique','legend','epic','rare','normal'];

    // 배경
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0b1230'); bg.addColorStop(0.55, '#1a0f3a'); bg.addColorStop(1, '#06121c');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { // 별 (고정 시드)
      const x = (i * 397) % W, y = (i * 613) % H, r = (i % 3) + 1;
      g.fillStyle = `rgba(255,255,255,${0.08 + (i % 5) * 0.04})`; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const glow = g.createRadialGradient(W / 2, 430, 40, W / 2, 430, 520);
    glow.addColorStop(0, 'rgba(255,194,75,0.22)'); glow.addColorStop(1, 'rgba(255,194,75,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);

    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffc24b'; g.font = font(44, 900); g.fillText('POKÉMON TD', W / 2, 90);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = font(28, 700);
    const d = new Date(); g.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} · 엔드리스`, W / 2, 140);

    // 웨이브 (메인 숫자)
    g.fillStyle = '#fff'; g.font = font(250, 900); g.fillText(String(e.currentWave), W / 2, 360);
    g.fillStyle = '#6aa8ff'; g.font = font(48, 900); g.fillText('WAVE', W / 2, 510);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = font(40, 800);
    g.fillText(`${(e.score || 0).toLocaleString()}점`, W / 2, 580);

    // 영웅 + MVP 카드
    const hero = e.heroes && e.heroes[0];
    const heroId = hero ? (hero.evolved || hero.id) : (this.starterHero || 'pikachu');
    const heroName = hero ? ((hero.evolved && hero.def.evolution?.options.find(o => o.id === hero.evolved)?.name) || hero.def.name) : heroId;
    const stats = e._towerDamageStats || {};
    const mvpId = Object.keys(stats).sort((a, b) => stats[b] - stats[a])[0];
    const mvp = mvpId && window.GachaTowerDefs[mvpId];
    const [heroImg, mvpImg] = await Promise.all([
      loadImg(`assets/heroes/${heroId}.png`), loadImg(mvp && window.TowerSpriteImages[mvp.id]),
    ]);
    const card = (x, label, name, img, emoji, color) => {
      rr(x, 640, 440, 250, 34); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fill();
      g.lineWidth = 3; g.strokeStyle = color; g.stroke();
      g.textAlign = 'left'; g.fillStyle = color; g.font = font(28, 800); g.fillText(label, x + 32, 690);
      g.fillStyle = '#fff'; g.font = font(42, 900); g.fillText(name, x + 32, 760, 230);
      if (img) g.drawImage(img, x + 270, 680, 150, 150);
      else { g.textAlign = 'center'; g.font = font(110, 400); g.fillText(emoji, x + 345, 760); }
      g.textAlign = 'center';
    };
    card(80, '영웅', heroName, heroImg, '⚡', '#ffc24b');
    card(560, 'MVP', mvp ? mvp.name : '-', mvpImg, mvp ? mvp.emoji : '❔', mvp ? GR[mvp.grade].color : '#888');

    // 덱 6마리 (필드에서 등급 높은 순, 같은 종 1번만)
    const seen = new Set();
    const deck = e.towers.map(t => t.def).filter(df => df && !seen.has(df.id) && seen.add(df.id))
      .sort((a, b) => ORDER.indexOf(a.grade) - ORDER.indexOf(b.grade) || (stats[b.id] || 0) - (stats[a.id] || 0)).slice(0, 6);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = font(30, 800); g.fillText('나의 덱', W / 2, 950);
    const imgs = await Promise.all(deck.map(df => loadImg(window.TowerSpriteImages[df.id])));
    const cw = 150, gap = 22, startX = (W - (cw * 6 + gap * 5)) / 2;
    for (let i = 0; i < 6; i++) {
      const x = startX + i * (cw + gap), y = 990, df = deck[i];
      rr(x, y, cw, 190, 26); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill();
      if (!df) continue;
      g.lineWidth = 3; g.strokeStyle = GR[df.grade].color; g.stroke();
      if (imgs[i]) g.drawImage(imgs[i], x + 15, y + 12, 120, 120);
      else { g.font = font(80, 400); g.fillStyle = '#fff'; g.fillText(df.emoji, x + cw / 2, y + 72); }
      g.fillStyle = GR[df.grade].color; g.font = font(26, 800); g.fillText(df.name, x + cw / 2, y + 160, cw - 12);
    }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.font = font(26, 700);
    g.fillText('sonmn88-bot.github.io/pokemon-td', W / 2, 1290);
    return c;
  },

  async shareResultCard(btn) {
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = '카드 만드는 중...'; }
    try {
      const canvas = await this.buildShareCard();
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], `pokemontd-wave${this.engine.currentWave}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '포켓몬TD', text: `웨이브 ${this.engine.currentWave} 도달!` }).catch(() => {});
      } else { // 공유 미지원(PC 등) → 이미지 저장
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
    } catch (err) { console.warn('share card', err); this.showWaveAnnounce('카드 생성 실패', '#ff5c7a'); }
    if (btn) { btn.disabled = false; btn.textContent = label; }
  },

  buildBossSummonButton() {
    let bar = document.getElementById('boss-summon-bar');
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.id = 'boss-summon-bar';
    bar.style.cssText = 'position:absolute;left:8px;bottom:calc(var(--bar-h,82px) + 12px);z-index:19;display:flex;flex-direction:column;gap:3px;background:rgba(20,5,5,0.75);border-radius:10px;padding:5px;border:1px solid rgba(255,60,60,0.3);';
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

    // v3.6: 필드를 가리지 않게 접기 (접힌 상태 기억)
    const fold = document.createElement('button');
    fold.className = 'bs-fold';
    fold.setAttribute('aria-label', '보스 소환 접기/펼치기');
    const setFold = f => { bar.classList.toggle('folded', f); fold.innerHTML = f ? `${ICON('monster', 16)}<span>보스</span>` : ICON('close', 14); try { localStorage.setItem('pokemontd_bsfold', f ? '1' : '0'); } catch (_) {} };
    fold.addEventListener('click', () => setFold(!bar.classList.contains('folded')));
    bar.prepend(fold);
    let f0 = matchMedia('(max-width:560px)').matches; try { const v = localStorage.getItem('pokemontd_bsfold'); if (v) f0 = v === '1'; } catch (_) {}
    setFold(f0);

    this._updateBossSummonUI();
  }
});
