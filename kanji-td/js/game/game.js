/* =========================================================
   ゲーム本体（ループ・ウェーブ・建設・スキル・コンボ）
   ========================================================= */

const Game = {
  stage: null,
  canvas: null,
  ctx: null,
  mapCache: null,       // 背景の描き置きキャンバス

  running: false,
  paused: false,
  speed: 1,
  time: 0,              // ゲーム内経過時間（秒）

  coins: 0,
  life: 0,
  waveIdx: -1,          // 現在のウェーブ番号（0始まり）
  waveState: "ready",   // ready(次ウェーブ待ち) / running
  waveCountdown: 0,     // 自動開始までの秒数
  spawnQueue: [],       // { at:出現時刻, t:敵ID }

  enemies: [],
  towers: [],
  projectiles: [],

  pathPx: [],           // ピクセル座標の経路
  pathCellSet: null,    // 道が通っているセル "c,r"

  // コンボ＆スキル
  combo: 0,
  skillGauge: 0,

  // このゲームの成績
  session: null,

  selectedTowerType: null,
  selectedTower: null,

  _raf: 0,
  _lastTs: 0,

  /* =========================================
     開始・終了
     ========================================= */

  start(stageId) {
    this.stage = STAGES.find(s => s.id === stageId);
    const st = this.stage;

    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");

    this.running = true;
    this.paused = false;
    this.speed = 1;
    this.time = 0;
    this.coins = st.startCoins + levelCoinBonus(SaveMgr.data.level);
    this.life = st.baseHp;
    this.waveIdx = -1;
    this.waveState = "ready";
    this.waveCountdown = 8;
    this.spawnQueue = [];
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.combo = 0;
    this.skillGauge = 0;
    this.selectedTowerType = null;
    this.selectedTower = null;
    this.session = { kills: 0, correct: 0, wrong: 0, maxCombo: 0, coinsEarned: 0, towersBuilt: 0 };
    FX.reset();

    // 経路をピクセルに変換
    this.pathPx = st.path.map(([c, r]) => ({
      x: c * GRID.cell + GRID.cell / 2,
      y: r * GRID.cell + GRID.cell / 2,
    }));
    this.buildPathCells();
    this.buildMapCache();
    this.buildPalette();
    this.hideTowerPopup();

    document.getElementById("btn-speed").textContent = "▶ x1";
    BGM.play("battle");
    this.resize();
    this.updateHUD();

    this._lastTs = 0;
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(ts => this.loop(ts));
  },

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  },

  /* =========================================
     経路・マップ描画キャッシュ
     ========================================= */

  buildPathCells() {
    this.pathCellSet = new Set();
    // 各セルの中心が道から34px以内なら「道セル」
    for (let c = 0; c < GRID.cols; c++) {
      for (let r = 0; r < GRID.rows; r++) {
        const cx = c * GRID.cell + GRID.cell / 2;
        const cy = r * GRID.cell + GRID.cell / 2;
        if (this.distToPath(cx, cy) < 36) this.pathCellSet.add(c + "," + r);
      }
    }
  },

  distToPath(x, y) {
    let min = Infinity;
    for (let i = 0; i < this.pathPx.length - 1; i++) {
      const a = this.pathPx[i], b = this.pathPx[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      let t = len2 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
      if (d < min) min = d;
    }
    return min;
  },

  buildMapCache() {
    const th = this.stage.theme;
    const cv = document.createElement("canvas");
    cv.width = GRID.w;
    cv.height = GRID.h;
    const g = cv.getContext("2d");

    // 市松模様の地面
    for (let c = 0; c < GRID.cols; c++) {
      for (let r = 0; r < GRID.rows; r++) {
        g.fillStyle = (c + r) % 2 === 0 ? th.bg1 : th.bg2;
        g.fillRect(c * GRID.cell, r * GRID.cell, GRID.cell, GRID.cell);
      }
    }

    // 道（ふち→本体の二重描き）
    g.lineCap = "round";
    g.lineJoin = "round";
    const drawPath = (w, color) => {
      g.strokeStyle = color;
      g.lineWidth = w;
      g.beginPath();
      this.pathPx.forEach((p, i) => i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y));
      g.stroke();
    };
    drawPath(44, th.pathEdge);
    drawPath(34, th.path);

    // かざり（シード付き乱数で毎回同じ配置）
    let seed = this.stage.id * 7777 + 1;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    g.textAlign = "center";
    g.textBaseline = "middle";
    let placed = 0, tries = 0;
    while (placed < 16 && tries < 200) {
      tries++;
      const c = Math.floor(rnd() * GRID.cols);
      const r = Math.floor(rnd() * GRID.rows);
      if (this.pathCellSet.has(c + "," + r)) continue;
      const x = c * GRID.cell + GRID.cell / 2 + (rnd() - 0.5) * 14;
      const y = r * GRID.cell + GRID.cell / 2 + (rnd() - 0.5) * 14;
      g.globalAlpha = 0.5 + rnd() * 0.4;
      g.font = `${18 + Math.floor(rnd() * 14)}px sans-serif`;
      g.fillText(th.deco[Math.floor(rnd() * th.deco.length)], x, y);
      placed++;
    }
    g.globalAlpha = 1;

    this.mapCache = cv;
  },

  /* =========================================
     メインループ
     ========================================= */

  loop(ts) {
    if (!this.running) return;
    if (!this._lastTs) this._lastTs = ts;
    let dt = Math.min(0.05, (ts - this._lastTs) / 1000);
    this._lastTs = ts;

    if (!this.paused) {
      for (let i = 0; i < this.speed; i++) this.update(dt);
    }
    this.draw();
    this._raf = requestAnimationFrame(t => this.loop(t));
  },

  update(dt) {
    this.time += dt;

    // スキルゲージの自然回復
    this.skillGauge = Math.min(SKILL_GAUGE.max, this.skillGauge + SKILL_GAUGE.perSecond * dt);

    // ウェーブ管理
    if (this.waveState === "ready") {
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) this.startWave();
    } else {
      // 出現キュー処理
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.time) {
        const ev = this.spawnQueue.shift();
        this.spawnEnemy(ev.t);
      }
    }

    // エンティティ更新
    for (const t of this.towers) t.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    for (const e of this.enemies) {
      e.update(dt, this.time, this);
      if (e.reached) this.onLeak(e);
    }
    this.enemies = this.enemies.filter(e => !e.dead && !e.reached);

    FX.update(dt);

    // ウェーブクリア判定
    if (this.waveState === "running" && !this.spawnQueue.length && !this.enemies.length) {
      this.onWaveCleared();
    }

    this.updateHUD();
  },

  /* =========================================
     ウェーブ
     ========================================= */

  startWave() {
    this.waveIdx++;
    this.waveState = "running";

    // 出現キューを組み立てる
    const wave = this.stage.waves[this.waveIdx];
    this.spawnQueue = [];
    for (const grp of wave) {
      for (let i = 0; i < grp.n; i++) {
        this.spawnQueue.push({ at: this.time + (grp.delay || 0) + i * grp.gap, t: grp.t });
      }
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);

    const hasBoss = wave.some(g => ENEMIES[g.t].boss);
    this.showWaveBanner(hasBoss ? "👹 ボスウェーブ！" : `ウェーブ ${this.waveIdx + 1}`, hasBoss);
    if (hasBoss) { SFX.bossRoar(); FX.shake(10); BGM.play("boss"); }
  },

  spawnEnemy(typeId) {
    const hpMul = this.stage.hpMul * (1 + this.waveIdx * WAVE_HP_RAMP);
    this.enemies.push(new Enemy(typeId, hpMul, this.pathPx));
    if (ENEMIES[typeId].boss) {
      this.showWaveBanner(`${ENEMIES[typeId].icon} ${ENEMIES[typeId].name} が あらわれた！`, true);
      SFX.bossRoar();
      FX.shake(12);
    }
  },

  onWaveCleared() {
    if (this.waveIdx >= this.stage.waves.length - 1) {
      this.endGame(true);
      return;
    }
    // クリアボーナス
    const bonus = 40 + this.waveIdx * 10;
    this.gainCoins(bonus, this.pathPx[this.pathPx.length - 2]);
    this.waveState = "ready";
    this.waveCountdown = 6;
    // ボス曲から通常曲に戻す
    if (BGM.current === "boss") BGM.play("battle");
  },

  // 「つぎのウェーブ」を早く呼ぶ（残り秒数×5コインのボーナス）
  callWaveEarly() {
    if (this.waveState !== "ready") return;
    const bonus = Math.floor(this.waveCountdown) * 5;
    if (bonus > 0) {
      this.coins += bonus;
      FX.text(GRID.w / 2, GRID.h / 2, `はやおしボーナス +${bonus}🪙`, "#ffd54d", 20);
    }
    this.waveCountdown = 0;
  },

  showWaveBanner(text, isBoss) {
    const el = document.getElementById("wave-banner");
    el.textContent = text;
    el.classList.remove("hidden", "boss");
    if (isBoss) el.classList.add("boss");
    // アニメを再発火させる
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => el.classList.add("hidden"), 1800);
  },

  /* =========================================
     戦闘イベント
     ========================================= */

  onEnemyKilled(enemy) {
    const buffs = this.getBuffs();
    const coin = Math.round(enemy.def.coin * buffs.coinMul);
    this.gainCoins(coin, enemy);
    this.session.kills++;
    SaveMgr.bump("kills");
    if (enemy.def.boss) {
      SaveMgr.bump("bossKills");
      FX.explosion(enemy.x, enemy.y, "#ff5d6c");
      FX.explosion(enemy.x + 15, enemy.y - 10, "#ffd54d");
      FX.shake(14);
      SFX.explosion();
    } else {
      FX.burst(enemy.x, enemy.y, "#ffd54d", 8, 110, 3);
    }
    this.skillGauge = Math.min(SKILL_GAUGE.max, this.skillGauge + SKILL_GAUGE.perKill * buffs.chargeMul);
  },

  gainCoins(amount, at) {
    this.coins += amount;
    this.session.coinsEarned += amount;
    if (at) FX.text(at.x, at.y - 16, `+${amount}`, "#ffd54d", 14);
  },

  onLeak(enemy) {
    this.life -= enemy.def.dmg;
    FX.hitFlash();
    FX.shake(enemy.def.boss ? 16 : 8);
    SFX.wrong();
    const base = this.pathPx[this.pathPx.length - 1];
    FX.text(Math.min(base.x, GRID.w - 60), base.y - 30, `-${enemy.def.dmg}❤️`, "#ff5d6c", 20);
    if (this.life <= 0) {
      this.life = 0;
      this.endGame(false);
    }
  },

  /* =========================================
     コンボ
     ========================================= */

  // コンボ段階ごとのバフ
  getBuffs() {
    return {
      rateMul: this.combo >= 3 ? 1.2 : 1,     // 攻撃速度
      dmgMul: this.combo >= 5 ? 1.25 : 1,     // 攻撃力
      coinMul: this.combo >= 8 ? 1.5 : 1,     // コイン
      chargeMul: this.combo >= 12 ? 2 : 1,    // スキルチャージ
    };
  },

  COMBO_MILESTONES: {
    3: "⚡ こうげきそくど UP!",
    5: "💪 こうげきりょく UP!",
    8: "🪙 コイン 1.5ばい!",
    12: "✨ スキルチャージ 2ばい!",
  },

  onCorrectAnswer() {
    this.combo++;
    this.session.maxCombo = Math.max(this.session.maxCombo, this.combo);
    this.session.correct++;
    SaveMgr.bump("maxCombo", this.combo);
    const buffs = this.getBuffs();
    this.skillGauge = Math.min(SKILL_GAUGE.max, this.skillGauge + SKILL_GAUGE.perCorrect * buffs.chargeMul);

    const msg = this.COMBO_MILESTONES[this.combo];
    if (msg) this.showComboBanner(`🔥 ${this.combo} COMBO! ${msg}`);
    else if (this.combo >= 3) this.showComboBanner(`🔥 ${this.combo} COMBO!`);
  },

  onWrongAnswer() {
    if (this.combo >= 3) this.showComboBanner("💔 コンボが きれた…");
    this.combo = 0;
    this.session.wrong++;
  },

  showComboBanner(text) {
    const el = document.getElementById("combo-banner");
    el.textContent = text;
    el.classList.remove("hidden");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => el.classList.add("hidden"), 1100);
  },

  /* =========================================
     クイズをはさむアクション共通処理
     ========================================= */

  askQuiz(context, onCorrect) {
    this.paused = true;
    this.hideTowerPopup();
    Quiz.ask({
      grade: SaveMgr.data.settings.grade,
      context,
      onDone: (result) => {
        this.paused = false;
        if (result.correct) {
          this.onCorrectAnswer();
          onCorrect();
        } else {
          this.onWrongAnswer();
        }
        SaveMgr.save();
        this.updateHUD();
      },
    });
  },

  /* =========================================
     タワー建設・強化・売却
     ========================================= */

  buildPalette() {
    const pal = document.getElementById("tower-palette");
    pal.innerHTML = Object.values(TOWERS).map(t => `
      <button class="tower-btn" data-type="${t.id}" title="${t.desc}">
        <span class="t-icon">${t.icon}</span>
        <span class="t-name">${t.name}</span>
        <span class="t-cost">${t.cost}</span>
      </button>
    `).join("");
    pal.querySelectorAll(".tower-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        this.selectedTower = null;
        this.hideTowerPopup();
        this.selectedTowerType = this.selectedTowerType === type ? null : type;
        this.refreshPalette();
      });
    });
  },

  refreshPalette() {
    document.querySelectorAll("#tower-palette .tower-btn").forEach(btn => {
      const def = TOWERS[btn.dataset.type];
      btn.classList.toggle("selected", this.selectedTowerType === btn.dataset.type);
      btn.classList.toggle("poor", this.coins < def.cost);
    });
  },

  cellFree(col, row) {
    if (col < 0 || col >= GRID.cols || row < 0 || row >= GRID.rows) return false;
    if (this.pathCellSet.has(col + "," + row)) return false;
    return !this.towers.some(t => t.col === col && t.row === row);
  },

  requestBuild(col, row) {
    const def = TOWERS[this.selectedTowerType];
    if (!def || !this.cellFree(col, row)) return;
    if (this.coins < def.cost) {
      FX.text(col * GRID.cell + 30, row * GRID.cell + 30, "コインがたりない！", "#ff5d6c", 15);
      return;
    }
    this.askQuiz(`${def.icon} ${def.name}タワーを たてる`, () => {
      this.coins -= def.cost;
      const tower = new Tower(def.id, col, row);
      this.towers.push(tower);
      this.session.towersBuilt++;
      SaveMgr.bump("towersBuilt");
      SFX.build();
      FX.ring(tower.x, tower.y, def.color, 55);
      FX.burst(tower.x, tower.y, def.color, 12, 100, 4);
    });
  },

  requestUpgrade(tower) {
    if (tower.level >= TOWER_UPGRADE.maxLevel) return;
    const cost = tower.upgradeCost();
    if (this.coins < cost) return;
    this.askQuiz(`${tower.def.icon} ${tower.def.name}タワーを きょうか`, () => {
      this.coins -= cost;
      tower.invested += cost;
      tower.level++;
      SFX.build();
      FX.ring(tower.x, tower.y, "#ffd54d", 65);
      FX.burst(tower.x, tower.y, "#ffd54d", 16, 130, 4);
      FX.text(tower.x, tower.y - 34, "LEVEL UP!", "#ffd54d", 15);
    });
  },

  sellTower(tower) {
    const value = tower.sellValue();
    this.towers = this.towers.filter(t => t !== tower);
    this.gainCoins(value, tower);
    this.selectedTower = null;
    this.hideTowerPopup();
    SFX.coin();
  },

  /* ---------- タワー操作ポップアップ ---------- */

  showTowerPopup(tower) {
    const popup = document.getElementById("tower-popup");
    const maxed = tower.level >= TOWER_UPGRADE.maxLevel;
    const upCost = tower.upgradeCost();
    popup.innerHTML = `
      <div class="tp-title">${tower.def.icon} ${tower.def.name}タワー Lv.${tower.level}</div>
      <div class="tp-stats">こうげき ${Math.round(tower.dmg)} ／ しゃてい ${Math.round(tower.range)}<br>${tower.def.desc}</div>
      ${maxed
        ? `<button disabled>⭐ さいだいレベル</button>`
        : `<button class="up" id="tp-up" ${this.coins < upCost ? "disabled" : ""}>⬆ きょうか（🪙${upCost}）</button>`}
      <button class="sell" id="tp-sell">💰 うる（+🪙${tower.sellValue()}）</button>
    `;
    popup.classList.remove("hidden");

    // キャンバス上の論理座標 → 画面座標に変換して配置
    const rect = this.canvas.getBoundingClientRect();
    const wrapRect = document.getElementById("canvas-wrap").getBoundingClientRect();
    const scale = rect.width / GRID.w;
    let px = rect.left - wrapRect.left + tower.x * scale - 85;
    let py = rect.top - wrapRect.top + (tower.y * scale) + 26;
    px = Math.max(4, Math.min(wrapRect.width - 180, px));
    if (py + 150 > wrapRect.height) py = rect.top - wrapRect.top + tower.y * scale - 165;
    popup.style.left = px + "px";
    popup.style.top = py + "px";

    const upBtn = document.getElementById("tp-up");
    if (upBtn) upBtn.addEventListener("click", () => this.requestUpgrade(tower));
    document.getElementById("tp-sell").addEventListener("click", () => this.sellTower(tower));
  },

  hideTowerPopup() {
    document.getElementById("tower-popup").classList.add("hidden");
  },

  /* =========================================
     スキル
     ========================================= */

  openSkillMenu() {
    if (this.paused) return;
    this.paused = true;
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");
    layer.innerHTML = `
      <div class="modal-box">
        <h2>✨ スキルをえらぼう</h2>
        <div style="text-align:center;font-size:0.8rem;font-weight:800;color:var(--text2);margin-bottom:10px">
          ゲージ：${Math.floor(this.skillGauge)} / ${SKILL_GAUGE.max}（もんだいに せいかいで はつどう！）
        </div>
        <div class="mission-list">
          ${Object.values(SKILLS).map(s => `
            <button class="mission-item" data-skill="${s.id}" ${this.skillGauge < s.cost ? "disabled" : ""}
              style="text-align:left;border:1px solid var(--border)">
              <span class="m-icon">${s.icon}</span>
              <span class="m-body">
                <span class="m-name">${s.name}</span>
                <span class="m-desc" style="display:block">${s.desc}</span>
              </span>
              <span class="m-count">⚡${s.cost}</span>
            </button>
          `).join("")}
        </div>
        <div class="modal-close-row">
          <button class="modal-btn" id="skill-cancel">とじる</button>
        </div>
      </div>
    `;
    layer.querySelectorAll("[data-skill]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.skill;
        layer.classList.add("hidden");
        layer.innerHTML = "";
        this.paused = false;
        this.useSkill(id);
      });
    });
    document.getElementById("skill-cancel").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
      this.paused = false;
    });
  },

  useSkill(skillId) {
    const skill = SKILLS[skillId];
    if (this.skillGauge < skill.cost) return;
    this.askQuiz(`${skill.icon} ${skill.name} を はつどう`, () => {
      this.skillGauge -= skill.cost;
      SaveMgr.bump("skillsUsed");
      SFX.skill();
      this.applySkill(skillId);
    });
  },

  applySkill(skillId) {
    const alive = this.enemies.filter(e => !e.dead && !e.reached);
    switch (skillId) {
      case "meteor": {
        FX.shake(18);
        SFX.explosion();
        for (const e of alive) {
          FX.explosion(e.x, e.y, "#ff9f43");
          e.damage(260, { true_: true }, this);
        }
        FX.text(GRID.w / 2, GRID.h / 2, "☄️ メテオ！！", "#ff9f43", 30);
        break;
      }
      case "freeze": {
        for (const e of alive) {
          e.freezeUntil = this.time + 4;
          FX.burst(e.x, e.y, "#5eead4", 6, 70, 3);
        }
        FX.text(GRID.w / 2, GRID.h / 2, "🧊 ぜんたいとうけつ！", "#5eead4", 26);
        break;
      }
      case "bolt": {
        const targets = alive.sort((a, b) => b.hp - a.hp).slice(0, 8);
        for (const e of targets) {
          FX.beam([{ x: e.x, y: 0 }, { x: e.x, y: e.y }], "#ffd54d");
          FX.burst(e.x, e.y, "#ffd54d", 10, 130, 4);
          e.damage(160, { magic: true }, this);
        }
        FX.shake(10);
        FX.text(GRID.w / 2, GRID.h / 2, "🌩️ らいげき！", "#ffd54d", 26);
        break;
      }
      case "goldrush": {
        this.gainCoins(200, null);
        SFX.coin();
        FX.text(GRID.w / 2, GRID.h / 2, "💰 +200コイン！", "#ffd54d", 28);
        for (let i = 0; i < 5; i++) {
          FX.burst(GRID.w / 2 + (Math.random() - 0.5) * 200, GRID.h / 2 + (Math.random() - 0.5) * 120, "#ffd54d", 8, 120, 4);
        }
        break;
      }
      case "heal": {
        this.life = Math.min(this.stage.baseHp, this.life + 5);
        const base = this.pathPx[this.pathPx.length - 1];
        FX.burst(Math.min(base.x, GRID.w - 40), base.y, "#3ecf8e", 20, 100, 4);
        FX.text(GRID.w / 2, GRID.h / 2, "💖 HPかいふく！", "#3ecf8e", 26);
        break;
      }
    }
  },

  // 雷タワーの連鎖攻撃
  fireChain(tower, first, dmg) {
    const targets = [first];
    let current = first;
    for (let i = 1; i < tower.def.chain; i++) {
      let next = null, best = Infinity;
      for (const e of this.enemies) {
        if (e.dead || e.reached || targets.includes(e)) continue;
        if (e.def.fly && !tower.def.air) continue;
        const d = Math.hypot(e.x - current.x, e.y - current.y);
        if (d < 110 && d < best) { best = d; next = e; }
      }
      if (!next) break;
      targets.push(next);
      current = next;
    }
    const points = [{ x: tower.x, y: tower.y - 14 }, ...targets.map(e => ({ x: e.x, y: e.y }))];
    FX.beam(points, tower.def.color);
    SFX.hit();
    targets.forEach((e, i) => {
      e.damage(dmg * Math.pow(0.75, i), {}, this);
      FX.burst(e.x, e.y, tower.def.color, 5, 90, 3);
    });
  },

  /* =========================================
     ゲーム終了・結果
     ========================================= */

  endGame(win) {
    if (!this.running) return;
    this.stop();
    this.hideTowerPopup();
    BGM.stop(); // ファンファーレ／敗北音を聞かせる
    if (win) SFX.fanfare(); else SFX.lose();

    const s = this.session;
    const hpRatio = this.life / this.stage.baseHp;
    const stars = win ? (hpRatio >= 1 ? 3 : hpRatio >= 0.6 ? 2 : 1) : 0;
    const score = s.kills * 10 + s.correct * 25 + this.life * 40 + s.maxCombo * 30 + (win ? this.stage.id * 100 : 0);

    const d = SaveMgr.data;
    d.totalScore += score;

    if (win) {
      SaveMgr.bump("clears");
      if (hpRatio >= 1) SaveMgr.bump("perfectClears");
      const rec = d.stages[this.stage.id] || { stars: 0, bestScore: 0 };
      rec.stars = Math.max(rec.stars, stars);
      rec.bestScore = Math.max(rec.bestScore, score);
      d.stages[this.stage.id] = rec;
      // 星の合計を再計算
      d.stats.stars = Object.values(d.stages).reduce((sum, r) => sum + r.stars, 0);
    }

    // XP計算
    let xp = (win ? 60 + this.stage.id * 25 : 15) + s.correct * 2 + stars * 15;

    // 実績チェック
    const newAch = SaveMgr.checkAchievements();
    for (const a of newAch) {
      xp += a.xp;
      showToast(a.icon, `実績かいじょ！「${a.name}」 +${a.xp}XP`);
    }

    // デイリーチェック
    const daily = SaveMgr.checkDaily();
    if (daily) {
      xp += daily.xp;
      showToast("🎯", `デイリーたっせい！ +${daily.xp}XP`);
    }

    const ups = SaveMgr.addXp(xp);
    SaveMgr.save();
    if (ups > 0) setTimeout(() => showLevelUp(SaveMgr.data.level), 600);

    Screens.showResult({
      win, stars, score, xp,
      stage: this.stage,
      kills: s.kills, correct: s.correct, wrong: s.wrong,
      maxCombo: s.maxCombo, coinsEarned: s.coinsEarned,
      lifeLeft: this.life, baseHp: this.stage.baseHp,
      newAch,
    });
  },

  quitToHome() {
    this.stop();
    Screens.showHome();
  },

  /* =========================================
     HUD
     ========================================= */

  updateHUD() {
    document.querySelector("#hud-life span").textContent = this.life;
    document.querySelector("#hud-coin span").textContent = this.coins;
    document.querySelector("#hud-wave span").textContent = `${Math.max(1, this.waveIdx + 1)}/${this.stage.waves.length}`;

    const comboEl = document.getElementById("hud-combo");
    comboEl.querySelector(".combo-num").textContent = this.combo;
    comboEl.classList.toggle("hot", this.combo >= 3);

    // スキルゲージ
    const pct = (this.skillGauge / SKILL_GAUGE.max) * 100;
    document.getElementById("skill-gauge-fill").style.width = pct + "%";
    const minCost = Math.min(...Object.values(SKILLS).map(s => s.cost));
    document.getElementById("btn-skill").disabled = this.skillGauge < minCost;

    // つぎのウェーブボタン
    const waveBtn = document.getElementById("btn-next-wave");
    if (this.waveState === "ready" && this.running) {
      waveBtn.classList.remove("hidden");
      waveBtn.textContent = `⚔️ つぎのウェーブ（${Math.ceil(this.waveCountdown)}）`;
    } else {
      waveBtn.classList.add("hidden");
    }

    this.refreshPalette();
  },

  /* =========================================
     入力
     ========================================= */

  setupInput() {
    const canvas = document.getElementById("game-canvas");

    canvas.addEventListener("pointerdown", (ev) => {
      if (!this.running || this.paused) return;
      const rect = canvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width * GRID.w;
      const y = (ev.clientY - rect.top) / rect.height * GRID.h;
      const col = Math.floor(x / GRID.cell);
      const row = Math.floor(y / GRID.cell);

      // 既存タワーをタップ → 操作ポップアップ
      const tower = this.towers.find(t => Math.hypot(t.x - x, t.y - y) < GRID.cell * 0.5);
      if (tower) {
        this.selectedTower = tower;
        this.selectedTowerType = null;
        this.refreshPalette();
        this.showTowerPopup(tower);
        return;
      }

      this.selectedTower = null;
      this.hideTowerPopup();

      // 建設モード中 → 建設リクエスト
      if (this.selectedTowerType) {
        this.requestBuild(col, row);
      }
    });

    document.getElementById("btn-next-wave").addEventListener("click", () => this.callWaveEarly());
    document.getElementById("btn-skill").addEventListener("click", () => this.openSkillMenu());

    document.getElementById("btn-speed").addEventListener("click", () => {
      this.speed = this.speed === 1 ? 2 : 1;
      document.getElementById("btn-speed").textContent = `▶ x${this.speed}`;
    });

    document.getElementById("btn-pause").addEventListener("click", () => this.openPauseMenu());
    document.getElementById("btn-quit").addEventListener("click", () => this.openPauseMenu());

    window.addEventListener("resize", () => { if (this.running) this.resize(); });
  },

  openPauseMenu() {
    if (this.paused) return;
    this.paused = true;
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");
    layer.innerHTML = `
      <div class="modal-box" style="text-align:center">
        <h2>⏸ いちじていし</h2>
        <div class="modal-close-row" style="flex-direction:column;gap:10px;align-items:center">
          <button class="modal-btn primary" id="pause-resume" style="min-width:200px">▶ つづける</button>
          <button class="modal-btn" id="pause-quit" style="min-width:200px">🏠 ホームにもどる</button>
        </div>
      </div>
    `;
    document.getElementById("pause-resume").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
      this.paused = false;
    });
    document.getElementById("pause-quit").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
      this.quitToHome();
    });
  },

  /* =========================================
     描画
     ========================================= */

  resize() {
    const wrap = document.getElementById("canvas-wrap");
    const availW = wrap.clientWidth - 8;
    const availH = wrap.clientHeight - 8;
    const scale = Math.min(availW / GRID.w, availH / GRID.h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = GRID.w * scale + "px";
    this.canvas.style.height = GRID.h * scale + "px";
    this.canvas.width = GRID.w * dpr;
    this.canvas.height = GRID.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  draw() {
    const ctx = this.ctx;
    ctx.save();

    // 画面揺れ
    if (FX.shakePower > 0) {
      ctx.translate((Math.random() - 0.5) * FX.shakePower, (Math.random() - 0.5) * FX.shakePower);
    }

    // 背景（キャッシュ）
    ctx.drawImage(this.mapCache, 0, 0);

    // 建設モード：置けるセルをハイライト
    if (this.selectedTowerType) {
      const def = TOWERS[this.selectedTowerType];
      ctx.fillStyle = "rgba(142, 224, 110, 0.14)";
      for (let c = 0; c < GRID.cols; c++) {
        for (let r = 0; r < GRID.rows; r++) {
          if (this.cellFree(c, r)) {
            ctx.fillRect(c * GRID.cell + 4, r * GRID.cell + 4, GRID.cell - 8, GRID.cell - 8);
          }
        }
      }
      // 選択中タワーの案内
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "900 15px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${def.icon} おきたい ばしょを タップ！`, GRID.w / 2, 22);
    }

    // 入口と拠点
    const spawn = this.pathPx[0];
    const base = this.pathPx[this.pathPx.length - 1];
    ctx.font = "34px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🌀", Math.max(spawn.x, 24), spawn.y);
    ctx.font = "40px sans-serif";
    ctx.fillText("🏰", Math.min(base.x, GRID.w - 30), base.y);

    // タワー
    for (const t of this.towers) t.draw(ctx, t === this.selectedTower);

    // 敵（下にいるものを手前に）
    const sorted = this.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of sorted) e.draw(ctx, this.time);

    // 弾
    for (const p of this.projectiles) p.draw(ctx);

    // エフェクト
    FX.draw(ctx);

    ctx.restore();

    // 被ダメージの赤フラッシュ
    if (FX.flash > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 60, 70, ${FX.flash * 0.7})`;
      ctx.fillRect(0, 0, GRID.w, GRID.h);
      ctx.restore();
    }
  },
};
