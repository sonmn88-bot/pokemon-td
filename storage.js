// ===== STORAGE.JS - v28 세션 B: 보관함 + 랜덤 합성 + 레시피 + 합성 연출 =====
// (설계서 §3) 뽑기 결과는 보관함으로 → 보관함/필드에서 같은 등급 3개를 골라 랜덤 합성.
// App 프로토타입 확장 방식 (ui-builders.js와 동일). index.html에서 ui-builders.js 다음에 로드.

Object.assign(App.prototype, {
  // ---------- 상태 ----------
  _storageReset() {
    this._inventory = [];
    this._mergeState = { history: [] };
    this._placingId = null;
    this._uidSeq = 0;
  },

  _addToStorage(defs) {
    if (!this._inventory) this._storageReset();
    for (const d of defs) { d._uid = ++this._uidSeq; this._inventory.push(d); }
    this.renderStorageStrip();
  },

  _takeFromStorageById(id) {
    const i = this._inventory.findIndex(d => d.id === id);
    return i >= 0 ? this._inventory.splice(i, 1)[0] : null;
  },

  _placeFromStorage(id, slotIdx) {
    const slot = this.engine?.towerSlots[slotIdx];
    if (!slot || slot.occupied) return false;
    const def = this._takeFromStorageById(id);
    if (!def) return false;
    this._placePulledTower(def, slotIdx);
    const g = window.GRADES[def.grade];
    this.showWaveAnnounce(`${def.name} 배치!`, g.color);
    this._placingId = null;
    this.renderStorageStrip();
    return true;
  },

  // ---------- 하단 보관함 바 ----------
  // 같은 종은 하나로 묶어 ×N 표시 (좁은 모바일 화면에서도 많이 보이게)
  _storageGroups() {
    const map = new Map();
    for (const d of this._inventory || []) {
      if (!map.has(d.id)) map.set(d.id, { def: d, count: 0 });
      map.get(d.id).count++;
    }
    const order = window.MERGE_ORDER;
    return [...map.values()].sort((a, b) =>
      order.indexOf(b.def.grade) - order.indexOf(a.def.grade) || a.def.name.localeCompare(b.def.name));
  },

  // 합성 가능한 게 있는지 (버튼에 빨간 점)
  _mergeAvailable() {
    const counts = {};
    for (const d of this._allMaterials().map(m => m.def)) counts[d.grade] = (counts[d.grade] || 0) + 1;
    if (['normal', 'rare', 'epic'].some(g => (counts[g] || 0) >= 3)) return true;
    const defs = this._allMaterials().map(m => m.def);
    return (window.RECIPES || []).some(r => r.pick(defs, { miracle: this.engine?._miracle }));
  },

  renderStorageStrip() {
    const strip = document.getElementById('storage-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const groups = this._storageGroups();
    const MAX = 7;

    const mergeBtn = document.createElement('button');
    mergeBtn.className = 'tower-btn storage-merge-btn';
    mergeBtn.innerHTML = `<span class="tower-btn-emoji">${ICON('flask', 24)}</span><span class="tower-btn-name">합성</span><span class="tower-btn-cost">${(this._inventory||[]).length}개 보관</span>`;
    if (this.engine && this._mergeAvailable()) mergeBtn.classList.add('has-dot');
    mergeBtn.title = '같은 등급 3개 → 다음 등급 랜덤 / 유니크 레시피';
    mergeBtn.addEventListener('click', () => this.openMergePanel());
    strip.appendChild(mergeBtn);

    for (const { def, count } of groups.slice(0, MAX)) {
      const g = window.GRADES[def.grade];
      const b = document.createElement('button');
      // v3.6: 같은 종 3개(확정 진화) = 초록 점, 필드의 메가 원본에 먹일 수 있으면 '먹이' 표시
      const feedable = window.MEGA?.canFeed && this.engine?.towers.some(t => t.def && (t.def.id === def.id || t.def.megaOf === def.id || ((def.grade === 'epic' || def.grade === 'legend') && t.def.type === def.type)) && MEGA.canFeed(this, t) > 0); // v3.8 먹이 재료 확장
      b.className = 'storage-item' + (this._placingId === def.id ? ' placing' : '') + (count >= 3 ? ' ready' : '');
      b.style.setProperty('--gc', g.color);
      b.innerHTML = `<span class="si-emoji">${PKM(def, 30)}</span><span class="si-stars">${'★'.repeat(g.stars)}</span>${count > 1 ? `<span class="si-count">×${count}</span>` : ''}${feedable ? '<span class="si-feed">먹이</span>' : window.MEGA_OF?.[def.id] ? `<span class="si-mega">${ICON('gem', 11)}</span>` : ''}`;
      b.title = `${def.name} (${g.name}) - 탭해서 배치`;
      b.addEventListener('click', () => this._onStorageItemTap(def.id));
      strip.appendChild(b);
    }
    if (groups.length > MAX) {
      const more = document.createElement('button');
      more.className = 'storage-item more';
      more.textContent = `+${groups.length - MAX}`;
      more.addEventListener('click', () => this.openMergePanel());
      strip.appendChild(more);
    }
  },

  _onStorageItemTap(id) {
    if (!this.engine) return;
    const sel = this.engine.selectedSlotIdx;
    if (sel !== null && sel !== undefined && !this.engine.towerSlots[sel]?.occupied) {
      this._placeFromStorage(id, sel);
      return;
    }
    this._placingId = this._placingId === id ? null : id;
    if (this._placingId) this.showWaveAnnounce('빈 슬롯을 탭해서 배치', '#6aa8ff');
    this.renderStorageStrip();
  },

  // ---------- 재료 목록 (보관함 + 필드) ----------
  _allMaterials(includeField = true) {
    const list = (this._inventory || []).map(d => ({ key: 's' + d._uid, kind: 'store', def: d, uid: d._uid }));
    if (includeField && this.engine) {
      this.engine.towerSlots.forEach((s, i) => {
        if (s.occupied && s.tower?._gachaId) list.push({ key: 'f' + i, kind: 'field', def: s.tower.def, slotIdx: i });
      });
    }
    return list;
  },

  _consumeMaterials(entries) {
    for (const m of entries) {
      if (m.kind === 'store') {
        const i = this._inventory.findIndex(d => d._uid === m.uid);
        if (i >= 0) this._inventory.splice(i, 1);
      } else {
        const slot = this.engine.towerSlots[m.slotIdx];
        if (slot?.tower) {
          this.engine.towers = this.engine.towers.filter(t => t !== slot.tower);
          if (this.engine.selectedTower === slot.tower) { this.engine.selectedTower = null; document.getElementById('tower-panel')?.remove(); }
          slot.occupied = false; slot.tower = null;
        }
      }
    }
    if (window.applyTowerSynergies) window.applyTowerSynergies(this.engine.towers);
  },

  _trackNewTower(def) {
    if (!this.missionTracker) return;
    const st = this.missionTracker.stats;
    st.mergeCount++;
    st.collectedIds.add(def.id);
    if (['rare','epic','legend','unique'].includes(def.grade)) st.totalRareCount++;
    if (['epic','legend','unique'].includes(def.grade)) st.totalEpicCount++;
    if (['legend','unique'].includes(def.grade)) st.totalLegendCount++;
    if (def.grade === 'unique') st.totalUniqueCount++;
    this.missionTracker.check();
  },

  // ---------- 합성 패널 ----------
  openMergePanel() {
    if (!this.engine) return;
    document.querySelector('.merge-overlay')?.remove();
    if (!this._mergeUi) this._mergeUi = { grade: 'normal', field: true, sel: new Set() };
    const ui = this._mergeUi;
    ui.sel = new Set();

    const overlay = document.createElement('div');
    overlay.className = 'merge-overlay';
    document.getElementById('game-screen').appendChild(overlay);

    const render = () => {
      const mats = this._allMaterials(ui.field);
      const byKey = new Map(mats.map(m => [m.key, m]));
      for (const k of [...ui.sel]) if (!byKey.has(k)) ui.sel.delete(k);
      const selected = [...ui.sel].map(k => byKey.get(k));
      const allDefs = this._allMaterials(true).map(m => m.def);
      const gradeCount = g => mats.filter(m => m.def.grade === g).length;

      // 레시피
      const recipeHtml = (window.RECIPES || []).map(r => {
        const ok = !!r.pick(allDefs, { miracle: this.engine._miracle }) && this.engine.gold >= r.cost;
        return `<button class="mg-recipe ${ok ? 'ready' : ''}" data-recipe="${r.id}" ${ok ? '' : 'disabled'}>
          <span class="mg-r-emoji">${window.GachaTowerDefs?.[r.id] ? PKM(window.GachaTowerDefs[r.id], 40) : r.emoji}</span>
          <span class="mg-r-text"><b>${r.name}</b><small>${r.desc}</small></span>
          <span class="mg-r-go">${ok ? '제작' : ICON('lock', 16)}</span></button>`;
      }).join('');

      const tabs = window.MERGE_ORDER.map(g => {
        const G = window.GRADES[g];
        return `<button class="mg-tab ${ui.grade === g ? 'on' : ''}" data-grade="${g}" style="--gc:${G.color}">${'★'.repeat(G.stars)} ${G.name}<i>${gradeCount(g)}</i></button>`;
      }).join('');

      const list = mats.filter(m => m.def.grade === ui.grade)
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'store' ? -1 : 1) || a.def.name.localeCompare(b.def.name));
      const G = window.GRADES[ui.grade];
      const cards = list.length ? list.map(m => `
        <button class="mg-card ${ui.sel.has(m.key) ? 'sel' : ''}" data-key="${m.key}" style="--gc:${G.color}">
          ${m.kind === 'field' ? '<span class="mg-field">필드</span>' : ''}
          ${window.MEGA_OF?.[m.def.id] ? '<span class="mg-megabadge">메가</span>' : ''}<span class="mg-emoji">${PKM(m.def, 34)}</span><span class="mg-name">${m.def.name}</span>
        </button>`).join('') : `<div class="mg-empty">이 등급의 포켓몬이 없어요</div>`;

      const n = selected.length;
      const sameGrade = n === 3 && selected.every(m => m.def.grade === selected[0].def.grade);
      const canRandom = sameGrade && !!window.NEXT_GRADE[selected[0].def.grade];
      const evoId = n === 3 && selected.every(m => m.def.id === selected[0].def.id) ? window.MERGE_EVOLUTION[selected[0].def.id] : null;
      const sellSum = selected.reduce((a, m) => a + (window.SELL_VALUE[m.def.grade] || 0), 0);
      const nextG = window.NEXT_GRADE[ui.grade] ? window.GRADES[window.NEXT_GRADE[ui.grade]] : null;

      overlay.innerHTML = `
        <div class="mg-head"><div class="mg-title">${ICON('flask', 20)} 합성 연구소</div><button class="mg-x" data-act="close" aria-label="닫기">${ICON('close', 18)}</button></div>
        <div class="mg-recipes">${recipeHtml}</div>
        <div class="mg-tabs">${tabs}</div>
        <div class="mg-opts">
          <label><input type="checkbox" data-act="field" ${ui.field ? 'checked' : ''}> 필드 타워도 재료로</label>
          <button class="mg-auto" data-act="auto">자동 3개</button>
          <button class="mg-auto all" data-act="all" ${window.NEXT_GRADE[ui.grade] ? '' : 'disabled'}>한 번에 전부</button>
        </div>
        <div class="mg-grid">${cards}</div>
        ${(this.engine._luckyCoins || 0) > 0 ? `<div class="mg-coin">행운의 동전 ${this.engine._luckyCoins}개 — 다음 랜덤 합성은 2개 중 선택</div>` : ''}
        <div class="mg-hint">${nextG ? `같은 등급 아무거나 3개 → <b style="color:${nextG.color}">${nextG.name}</b> 랜덤 · 같은 종 3개면 확정 진화도 가능` : '이 등급은 랜덤 합성이 없어요 (유니크는 위 레시피로)'}</div>
        <div class="mg-actions">
          <button class="mg-btn rnd" data-act="random" ${canRandom ? '' : 'disabled'}>${ICON('dice', 16)}랜덤 합성 <span class="mg-n">${n}/3</span></button>
          <button class="mg-btn evo" data-act="evolve" ${evoId ? '' : 'disabled'}>${ICON('sparkle', 15)}확정 진화${evoId ? ' → ' + [].concat(evoId).map(x => window.GachaTowerDefs[x].name).join('/') + (Array.isArray(evoId) ? ' 중 1' : '') : ''}</button>
          <button class="mg-btn sell" data-act="sell" ${n ? '' : 'disabled'}>판매 +${sellSum}</button>
        </div>`;

      overlay.querySelector('[data-act="close"]').onclick = () => { overlay.remove(); this.renderStorageStrip(); };
      overlay.querySelector('[data-act="field"]').onchange = e => { ui.field = e.target.checked; render(); };
      overlay.querySelectorAll('.mg-tab').forEach(b => b.onclick = () => { ui.grade = b.dataset.grade; ui.sel.clear(); render(); });
      overlay.querySelectorAll('.mg-card').forEach(b => b.onclick = () => {
        const k = b.dataset.key;
        if (ui.sel.has(k)) ui.sel.delete(k); else if (ui.sel.size < 3) ui.sel.add(k);
        render();
      });
      overlay.querySelector('[data-act="auto"]').onclick = () => {
        ui.sel.clear();
        // 보관함 우선, 그다음 필드. 같은 종이 3개 이상이면 그걸 먼저 (확정 진화 가능하게)
        const pool = list.slice();
        const byId = {}; pool.forEach(m => (byId[m.def.id] = byId[m.def.id] || []).push(m));
        const triple = Object.values(byId).find(a => a.length >= 3);
        (triple || pool).slice(0, 3).forEach(m => ui.sel.add(m.key));
        render();
      };
      // v3.2: 일괄 합성 - 보관함의 이 등급을 3개씩 전부 합성 (같은 종 3개는 확정 진화 우선, 필드 타워는 건드리지 않음)
      overlay.querySelector('[data-act="all"]').onclick = () => {
        const grade = ui.grade;
        if (!window.NEXT_GRADE[grade]) return;
        const results = [];
        for (;;) {
          // 💎 메가 원본(리자몽 등)은 먹이기용으로 남겨둠
          const pool = this._allMaterials(false).filter(m => m.def.grade === grade && !window.MEGA_OF?.[m.def.id]);
          if (pool.length < 3) break;
          const byId = {}; pool.forEach(m => (byId[m.def.id] = byId[m.def.id] || []).push(m));
          const triple = Object.values(byId).find(a => a.length >= 3 && window.MERGE_EVOLUTION[a[0].def.id]);
          const use = (triple || pool).slice(0, 3);
          this._consumeMaterials(use);
          let res;
          if (triple) res = { ...window.GachaTowerDefs[window.getEvolutionId(use[0].def.id)], _starLevel: 1 };
          else {
            this._mergeState.jumpChance = this.engine._mergeJumpChance || 0;
            this._mergeState.pityWeight = this.engine._pityWeight || 1.5;
            res = window.rollRandomMerge(grade, this._mergeState);
          }
          this._addToStorage([res]); this._trackNewTower(res); results.push(res);
        }
        const keptMega = this._allMaterials(false).filter(m => m.def.grade === grade && window.MEGA_OF?.[m.def.id]).length;
        const onField = this._allMaterials(true).filter(m => m.kind === 'field' && m.def.grade === grade).length;
        const note = [keptMega ? `메가 원본 ${keptMega}마리는 남겨뒀어요` : '', onField ? `배치된 ${onField}마리는 그대로예요` : ''].filter(Boolean).join(' · ');
        if (!results.length) { this.showWaveAnnounce('합성할 보관함 포켓몬이 3마리 미만이에요' + (note ? `<br><span style="font-size:0.7em">${note}</span>` : ''), '#ff5c7a'); return; }
        this.SFX.play(results.some(d => d.grade === 'legend') ? 'pull_epic' : 'merge');
        overlay.remove(); this.openMergePanel();
        const ov = document.createElement('div');
        ov.className = 'merge-bulk';
        ov.innerHTML = `<div class="mb-card"><b>⚡ ${results.length}번 합성 완료</b><div class="mb-row">${results.map(d =>
          `<span style="--gc:${window.GRADES[d.grade].color}">${PKM(d, 40)}<i>${d.name}</i></span>`).join('')}</div>${note ? `<small>${note}</small>` : ''}<small>탭해서 닫기</small></div>`;
        ov.onclick = () => ov.remove();
        document.getElementById('game-screen').appendChild(ov);
      };
      overlay.querySelector('[data-act="random"]').onclick = () => {
        if (!canRandom) return;
        const grade = selected[0].def.grade;
        this._consumeMaterials(selected);
        this._mergeState.jumpChance = this.engine._mergeJumpChance || 0;
        this._mergeState.pityWeight = this.engine._pityWeight || 1.5;
        this._mergeState.jumped = false;
        const res = window.rollRandomMerge(grade, this._mergeState);
        overlay.remove();
        const finish = d => { this._addToStorage([d]); this._trackNewTower(d); this.openMergePanel(); };
        if ((this.engine._luckyCoins || 0) > 0) {
          // 🪙 행운의 동전: 후보 2개 중 선택
          this.engine._luckyCoins--;
          const jumped1 = this._mergeState.jumped;
          this._mergeState.jumped = false;
          const res2 = window.rollRandomMerge(grade, this._mergeState);
          this._playMergeChoice([res, res2], jumped1 || this._mergeState.jumped, finish);
        } else {
          this._playMergeReveal(res, { jumped: this._mergeState.jumped }, () => finish(res));
        }
      };
      overlay.querySelector('[data-act="evolve"]').onclick = () => {
        if (!evoId) return;
        this._consumeMaterials(selected);
        const res = { ...window.GachaTowerDefs[window.getEvolutionId(selected[0].def.id)], _starLevel: 1 };
        overlay.remove();
        this._playMergeReveal(res, { evolve: true }, () => { this._addToStorage([res]); this._trackNewTower(res); this.openMergePanel(); });
      };
      overlay.querySelector('[data-act="sell"]').onclick = () => {
        if (!n) return;
        this._consumeMaterials(selected);
        this.engine.addGold(sellSum);
        this.SFX.play('buy');
        this.showWaveAnnounce(`${n}개 판매 +${sellSum}g`, '#34d399');
        ui.sel.clear(); render(); this.renderStorageStrip();
      };
      overlay.querySelectorAll('[data-recipe]').forEach(b => b.onclick = () => {
        const r = window.RECIPES.find(x => x.id === b.dataset.recipe);
        const all = this._allMaterials(true);
        const idx = r.pick(all.map(m => m.def), { miracle: this.engine._miracle });
        if (!idx) return;
        // v3.8: 재료 레전드를 직접 고름 (자동 선택은 아끼던 레전드가 들어가는 문제)
        const legs = all.filter(m => m.def.grade === 'legend');
        const need = r.id === 'mew' ? 3 : 2, distinct = r.id === 'mew';
        if (legs.length > need && !(r.id === 'mew' && this.engine._miracle && new Set(legs.map(m => m.def.id)).size < 3)) {
          this._pickRecipeLegends(r, legs, need, distinct, picked => {
            if (!this.engine.spendGold(r.cost)) { this.showWaveAnnounce('골드가 부족해요', '#ff5c7a'); return; }
            const used = r.id === 'mewtwo' ? [all.find(m => m.def.id === 'mew'), ...picked] : picked;
            this._consumeMaterials(used);
            const res = { ...window.GachaTowerDefs[r.id], _starLevel: 1 };
            const birds = r.id === 'mew' && ['articuno','zapdos','moltres'].every(id => used.some(m => m.def.id === id));
            overlay.remove();
            this._playMergeReveal(res, { recipe: true, birds }, () => { this._addToStorage([res]); this._trackNewTower(res); this.openMergePanel(); });
          });
          return;
        }
        if (!this.engine.spendGold(r.cost)) return;
        const used = idx.map(i => all[i]);
        const birds = r.id === 'mew' && ['articuno','zapdos','moltres'].every(id => used.some(m => m.def.id === id));
        this._consumeMaterials(used);
        const res = { ...window.GachaTowerDefs[r.id], _starLevel: 1 };
        overlay.remove();
        this._playMergeReveal(res, { recipe: true, birds }, () => { this._addToStorage([res]); this._trackNewTower(res); this.openMergePanel(); });
      });
    };
    render();
  },

  // v3.8 레시피 재료 선택 (뮤: 서로 다른 레전드 3 / 뮤츠: 레전드 2)
  _pickRecipeLegends(r, legs, need, distinct, done) {
    const ov = document.createElement('div');
    ov.className = 'merge-overlay recipe-pick';
    const sel = new Set();
    const draw = () => {
      const ids = [...sel].map(k => legs.find(m => m.key === k).def.id);
      const ok = sel.size === need && (!distinct || new Set(ids).size === need);
      ov.innerHTML = `<div class="mg-head"><div class="mg-title">${r.name} 재료 고르기</div><button class="mg-x" data-x aria-label="닫기">${ICON('close', 18)}</button></div>
        <div class="mg-hint">${distinct ? '서로 다른 레전드' : '레전드'} ${need}마리를 고르세요 · ${sel.size}/${need}${r.cost ? ` · ${ICON('coin', 12)}${r.cost}` : ''}</div>
        <div class="mg-grid">${legs.map(m => `<button class="mg-card ${sel.has(m.key) ? 'sel' : ''}" data-k="${m.key}" style="--gc:${window.GRADES.legend.color}">
          ${m.kind === 'field' ? '<span class="mg-field">필드</span>' : ''}<span class="mg-emoji">${PKM(m.def, 34)}</span><span class="mg-name">${m.def.name}${(m.def._stack || 1) > 1 ? ' ★' + m.def._stack : ''}</span></button>`).join('')}</div>
        <div class="mg-actions"><button class="mg-btn evo" data-go ${ok ? '' : 'disabled'}>${ICON('sparkle', 15)}${r.name} 만들기</button></div>`;
      ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        if (sel.has(k)) sel.delete(k);
        else if (sel.size < need) {
          const id = legs.find(m => m.key === k).def.id;
          if (distinct && [...sel].some(x => legs.find(m => m.key === x).def.id === id)) { this.showWaveAnnounce('같은 종은 1마리만', '#ff5c7a'); return; }
          sel.add(k);
        }
        draw();
      });
      ov.querySelector('[data-x]').onclick = () => ov.remove();
      ov.querySelector('[data-go]').onclick = () => { if (!ok) return; ov.remove(); done([...sel].map(k => legs.find(m => m.key === k))); };
    };
    draw();
    document.getElementById('game-screen').appendChild(ov);
  },

  // ---------- 행운의 동전: 후보 2개 중 선택 ----------
  _playMergeChoice(defs, jumped, done) {
    const ov = document.createElement('div');
    ov.className = 'merge-reveal choice';
    const big = defs.some(d => d.grade === 'legend' || d.grade === 'unique');
    if (big) ov.classList.add('cutin');
    ov.style.setProperty('--gc', window.GRADES[defs[0].grade].color);
    ov.innerHTML = `<div class="mr-pick-title">행운의 동전 — 하나를 고르세요${jumped ? ' (2단 상승!)' : ''}</div>
      <div class="mr-pick-row">${defs.map((d, i) => {
        const G = window.GRADES[d.grade];
        return `<div class="mr-card shown" data-i="${i}" style="--gc:${G.color}"><div class="mr-emoji">${PKM(d, 72)}</div>
          <div class="mr-name"><div class="mr-tag">${'★'.repeat(G.stars)} ${G.name}</div><b>${d.name}</b><small>${d.desc || ''}</small></div></div>`;
      }).join('')}</div>`;
    document.getElementById('game-screen').appendChild(ov);
    this.SFX.play('pull_epic');
    ov.querySelectorAll('[data-i]').forEach(c => c.addEventListener('click', () => {
      ov.remove();
      done(defs[Number(c.dataset.i)]);
    }));
  },

  // ---------- 합성 연출: 슬롯머신 → 공개 (탭하면 스킵) ----------
  _playMergeReveal(def, opts, done) {
    const G = window.GRADES[def.grade];
    const pool = (window.GRADE_POOLS[def.grade] || [def.id]).map(id => window.GachaTowerDefs[id]).filter(Boolean);
    const big = def.grade === 'legend' || def.grade === 'unique';
    const ov = document.createElement('div');
    ov.className = 'merge-reveal';
    ov.style.setProperty('--gc', G.color);
    ov.innerHTML = `<div class="mr-card spinning"><div class="mr-emoji">❓</div><div class="mr-name">합성 중...</div></div><div class="mr-skip">탭해서 건너뛰기</div>`;
    document.getElementById('game-screen').appendChild(ov);
    const card = ov.querySelector('.mr-card'), em = ov.querySelector('.mr-emoji'), nm = ov.querySelector('.mr-name');

    let phase = 'spin', t = 0, delay = 55, timer = null, closeTimer = null;
    const finish = () => { if (phase === 'closed') return; phase = 'closed'; clearTimeout(timer); clearTimeout(closeTimer); ov.remove(); done && done(); };
    const reveal = () => {
      phase = 'shown'; clearTimeout(timer);
      card.classList.remove('spinning'); card.classList.add('shown');
      if (big) ov.classList.add('cutin');
      em.innerHTML = PKM(def, 72);
      const tag = opts.birds ? '🌟 전설의 새 3신조! ' : opts.jumped ? '🍀 행운의 2단 상승! ' : opts.evolve ? '✨ 진화! ' : '';
      nm.innerHTML = `<div class="mr-tag">${tag}${'★'.repeat(G.stars)} ${G.name}</div><b>${def.name}</b><small>${def.desc || ''}</small>`;
      ov.querySelector('.mr-skip').textContent = '탭해서 계속';
      this.SFX.play(big ? 'merge' : def.grade === 'epic' ? 'pull_epic' : 'pull_rare');
      if (big) { try { navigator.vibrate && navigator.vibrate([60, 40, 120]); } catch (e) {} this.engine?.triggerScreenShake(8, 0.35); }
      closeTimer = setTimeout(finish, big ? 2600 : 1500);
    };
    const spin = () => {
      if (phase !== 'spin') return;
      const d = pool[Math.floor(Math.random() * pool.length)];
      em.innerHTML = PKM(d, 72); nm.textContent = d.name;
      t += delay; delay *= 1.12; // 점점 느려지는 슬롯머신
      if (t >= 1200) reveal(); else timer = setTimeout(spin, delay);
    };
    ov.addEventListener('click', () => { if (phase === 'spin') reveal(); else finish(); });
    this.SFX.play('pull_normal');
    spin();
  },
});
