/* =========================================================
   画面管理（ホーム・結果・図鑑・実績・ミッション）
   ========================================================= */

const Screens = {

  /* =========================================
     ホーム画面
     ========================================= */

  showHome() {
    document.getElementById("screen-game").classList.add("hidden");
    const home = document.getElementById("screen-home");
    home.classList.remove("hidden");
    BGM.play("home");

    const d = SaveMgr.data;
    SaveMgr.refreshDaily();
    const need = xpForLevel(d.level);
    const daily = SaveMgr.getDailyChallenge();
    const dailyCur = Math.min(daily.goal, d.daily.stats[daily.key] || 0);
    const achCount = Object.keys(d.ach).length;

    home.innerHTML = `
      <div class="home-inner">
        <div class="home-title">
          <div class="big">⚔️ かんじの塔 🏯</div>
          <div class="sub">漢字タワーディフェンス - タワーをたてて きょてんをまもれ！</div>
        </div>

        <div class="player-bar">
          <div class="player-level-badge"><span class="lv">Lv</span><span class="num">${d.level}</span></div>
          <div class="info">
            <div class="name">ぼうえいたいちょう</div>
            <div class="xp-bar"><div class="xp-fill" style="width:${Math.min(100, d.xp / need * 100)}%"></div></div>
            <div class="xp-label">XP ${d.xp} / ${need}</div>
          </div>
          <div class="score">るいけいスコア<b>${d.totalScore.toLocaleString()}</b></div>
        </div>

        <div class="daily-box ${d.daily.done ? "done" : ""}">
          <span class="icon">🎯</span>
          <div class="d-info">
            デイリーチャレンジ：${daily.desc}
            <div class="d-progress">${d.daily.done ? "" : `${dailyCur} / ${daily.goal}（ごほうび +${daily.xp}XP）`}</div>
          </div>
          ${d.daily.done ? '<span class="d-done-mark">たっせい！✔</span>' : ""}
        </div>

        <div class="section-h">📚 もんだいの がくねん</div>
        <div class="grade-select">
          ${["1", "2", "3", "4", "5", "6", "mix"].map(g => `
            <button class="grade-chip ${d.settings.grade === g ? "active" : ""}" data-grade="${g}">
              ${g === "mix" ? "🌈 ミックス" : g + "年生"}
            </button>
          `).join("")}
        </div>

        <div class="section-h">🗺️ ステージをえらぼう</div>
        <div class="stage-list">
          ${STAGES.map(st => {
            const rec = d.stages[st.id];
            const unlocked = st.id === 1 || (d.stages[st.id - 1] && d.stages[st.id - 1].stars > 0);
            const stars = rec ? rec.stars : 0;
            return `
              <button class="stage-card ${unlocked ? "" : "locked"}" data-stage="${st.id}" ${unlocked ? "" : "disabled"}>
                <span class="s-emoji">${st.emoji}</span>
                <div class="s-name">${st.name}</div>
                <div class="s-sub">${st.sub}・${st.waves.length}ウェーブ</div>
                <div class="s-stars">
                  ${[1, 2, 3].map(i => `<span class="${i <= stars ? "" : "off"}">⭐</span>`).join("")}
                </div>
                ${rec && rec.bestScore ? `<div class="s-sub">ベスト ${rec.bestScore.toLocaleString()}</div>` : ""}
              </button>
            `;
          }).join("")}
        </div>

        <div class="section-h">📋 メニュー</div>
        <div class="menu-row">
          <button class="menu-btn" id="menu-zukan"><span class="m-icon">📖</span>かんじ図鑑</button>
          <button class="menu-btn" id="menu-ach"><span class="m-icon">🏆</span>実績<span class="m-badge">${achCount}/${ACHIEVEMENTS.length}</span></button>
          <button class="menu-btn" id="menu-mission"><span class="m-icon">📜</span>ミッション</button>
          <button class="menu-btn" id="menu-howto"><span class="m-icon">❓</span>あそびかた</button>
          <button class="menu-btn" id="menu-sound"><span class="m-icon">${d.settings.sound ? "🔊" : "🔇"}</span>こうかおん ${d.settings.sound ? "ON" : "OFF"}</button>
          <button class="menu-btn" id="menu-bgm"><span class="m-icon">${d.settings.bgm !== false ? "🎵" : "🚫"}</span>BGM ${d.settings.bgm !== false ? "ON" : "OFF"}</button>
          <button class="menu-btn" id="menu-reset"><span class="m-icon">🗑️</span>データけす</button>
        </div>

        <div class="home-footer">
          <a href="../index.html">← かんじラボにもどる</a><br><br>
          もんだいに せいかいすると タワーが たてられるよ！れんぞくせいかいで パワーアップ！
        </div>
      </div>
    `;

    // イベント設定
    home.querySelectorAll(".grade-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        d.settings.grade = btn.dataset.grade;
        SaveMgr.save();
        this.showHome();
      });
    });
    home.querySelectorAll(".stage-card:not(.locked)").forEach(btn => {
      btn.addEventListener("click", () => this.startGame(parseInt(btn.dataset.stage, 10)));
    });
    document.getElementById("menu-zukan").addEventListener("click", () => this.showZukan());
    document.getElementById("menu-ach").addEventListener("click", () => this.showAchievements());
    document.getElementById("menu-mission").addEventListener("click", () => this.showMissions());
    document.getElementById("menu-howto").addEventListener("click", () => this.showHowto());
    document.getElementById("menu-sound").addEventListener("click", () => { SFX.toggle(); this.showHome(); });
    document.getElementById("menu-bgm").addEventListener("click", () => { BGM.toggle(); this.showHome(); });
    document.getElementById("menu-reset").addEventListener("click", () => {
      this.confirm("ほんとうに データを ぜんぶ けしますか？", () => {
        SaveMgr.reset();
        this.showHome();
      });
    });
  },

  /* =========================================
     ゲーム開始
     ========================================= */

  startGame(stageId) {
    const go = () => {
      document.getElementById("screen-home").classList.add("hidden");
      document.getElementById("screen-game").classList.remove("hidden");
      Game.start(stageId);
    };
    if (!SaveMgr.data.settings.seenHowto) {
      SaveMgr.data.settings.seenHowto = true;
      SaveMgr.save();
      this.showHowto(go);
    } else {
      go();
    }
  },

  /* =========================================
     結果画面
     ========================================= */

  showResult(r) {
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");

    const nextStage = STAGES.find(s => s.id === r.stage.id + 1);
    const showNext = r.win && nextStage;

    layer.innerHTML = `
      <div class="modal-box result-box">
        <div class="result-title ${r.win ? "win" : "lose"}">${r.win ? "🎉 ステージクリア！" : "💀 きょてんが やられた…"}</div>
        <div style="font-weight:800;color:var(--text2);font-size:0.85rem">${r.stage.emoji} ${r.stage.name}</div>
        <div class="result-stars">
          ${[1, 2, 3].map(i => `<span class="star ${i <= r.stars ? "on" : ""}">⭐</span>`).join("")}
        </div>
        <div class="result-score">SCORE ${r.score.toLocaleString()}</div>
        <div style="font-size:0.8rem;font-weight:800;color:var(--green)">+${r.xp} XP</div>
        <div class="result-grid">
          <div class="result-item">たおした てき <b>${r.kills}</b></div>
          <div class="result-item">さいだいコンボ <b>${r.maxCombo}</b></div>
          <div class="result-item">せいかい <b style="color:var(--green)">${r.correct}</b></div>
          <div class="result-item">まちがい <b style="color:var(--red)">${r.wrong}</b></div>
          <div class="result-item">のこりHP <b>${r.lifeLeft}/${r.baseHp}</b></div>
          <div class="result-item">かせいだコイン <b style="color:var(--gold)">${r.coinsEarned}</b></div>
        </div>
        ${r.win && r.stars < 3 ? `<div style="font-size:0.75rem;font-weight:700;color:var(--text2)">HPを へらさず クリアすると ⭐3つ！</div>` : ""}
        ${r.newAch.length ? `<div class="result-new">🏆 あたらしい実績 ${r.newAch.length}こ かいじょ！</div>` : ""}
        <div class="modal-close-row" style="flex-wrap:wrap;gap:8px">
          <button class="modal-btn" id="res-home">🏠 ホーム</button>
          <button class="modal-btn ${showNext ? "" : "primary"}" id="res-retry">🔄 もういちど</button>
          ${showNext ? `<button class="modal-btn primary" id="res-next">▶ つぎのステージ</button>` : ""}
        </div>
      </div>
    `;

    const close = () => { layer.classList.add("hidden"); layer.innerHTML = ""; };
    document.getElementById("res-home").addEventListener("click", () => { close(); this.showHome(); });
    document.getElementById("res-retry").addEventListener("click", () => { close(); this.startGame(r.stage.id); });
    if (showNext) {
      document.getElementById("res-next").addEventListener("click", () => { close(); this.startGame(nextStage.id); });
    }
  },

  /* =========================================
     かんじ図鑑
     ========================================= */

  showZukan(tab = "2") {
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");

    const entries = QDATA[tab].kanji;
    const z = SaveMgr.data.zukan;
    const learned = entries.filter(e => z[e.k] && z[e.k].c >= 3).length;
    const seen = entries.filter(e => z[e.k] && z[e.k].s > 0).length;

    layer.innerHTML = `
      <div class="modal-box">
        <h2>📖 かんじ図鑑</h2>
        <div class="zukan-tabs">
          ${["1", "2", "3", "4", "5", "6"].map(g => `<button class="zukan-tab ${g === tab ? "active" : ""}" data-tab="${g}">${g}年生</button>`).join("")}
        </div>
        <div class="zukan-stat">であった ${seen} / マスター（3回せいかい） <span style="color:var(--gold)">${learned}</span> / ぜんぶ ${entries.length}</div>
        <div class="zukan-detail" id="zukan-detail">
          <div class="zm" style="padding-top:24px">かんじを タップすると くわしく みられるよ</div>
        </div>
        <div class="zukan-grid">
          ${entries.map((e, i) => {
            const rec = z[e.k];
            const cls = rec && rec.c >= 3 ? "master" : rec && rec.s > 0 ? "seen" : "unseen";
            return `<button class="zukan-cell ${cls}" data-i="${i}">${e.k}</button>`;
          }).join("")}
        </div>
        <div class="modal-close-row">
          <button class="modal-btn" id="zukan-close">とじる</button>
        </div>
      </div>
    `;

    layer.querySelectorAll(".zukan-tab").forEach(btn => {
      btn.addEventListener("click", () => this.showZukan(btn.dataset.tab));
    });
    layer.querySelectorAll(".zukan-cell").forEach(btn => {
      btn.addEventListener("click", () => {
        const e = entries[parseInt(btn.dataset.i, 10)];
        const rec = z[e.k];
        document.getElementById("zukan-detail").innerHTML = `
          <div class="zk">${e.k}</div>
          <div class="zy">よみ：${e.y.join("・")}</div>
          <div class="zm">${e.m}${e.b ? `　／　ぶしゅ：${e.b}` : ""}${e.s ? `　／　${e.s}かく` : ""}</div>
          <div class="zc">${rec ? `せいかい ${rec.c}かい ／ 出題 ${rec.s}かい ${rec.c >= 3 ? "⭐マスター！" : ""}` : "まだ もんだいに でていないよ"}</div>
        `;
      });
    });
    document.getElementById("zukan-close").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
    });
  },

  /* =========================================
     実績
     ========================================= */

  showAchievements() {
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");
    const d = SaveMgr.data;

    layer.innerHTML = `
      <div class="modal-box">
        <h2>🏆 実績（${Object.keys(d.ach).length}/${ACHIEVEMENTS.length}）</h2>
        <div class="ach-list">
          ${ACHIEVEMENTS.map(a => `
            <div class="ach-item ${d.ach[a.id] ? "unlocked" : "locked"}">
              <span class="a-icon">${a.icon}</span>
              <div class="a-body">
                <div class="a-name">${a.name}</div>
                <div class="a-desc">${a.desc}（+${a.xp}XP）</div>
              </div>
              <span>${d.ach[a.id] ? "✅" : "🔒"}</span>
            </div>
          `).join("")}
        </div>
        <div class="modal-close-row"><button class="modal-btn" id="ach-close">とじる</button></div>
      </div>
    `;
    document.getElementById("ach-close").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
    });
  },

  /* =========================================
     ミッション
     ========================================= */

  showMissions() {
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");
    const stats = SaveMgr.data.stats;

    layer.innerHTML = `
      <div class="modal-box">
        <h2>📜 ミッション</h2>
        <div class="mission-list">
          ${MISSIONS.map(m => {
            const cur = Math.min(m.goal, stats[m.key] || 0);
            const done = cur >= m.goal;
            return `
              <div class="mission-item ${done ? "done" : ""}">
                <span class="m-icon">${m.icon}</span>
                <div class="m-body">
                  <div class="m-name">${m.name}${done ? " ✅" : ""}</div>
                  <div class="m-desc">${m.desc}（${m.goal}）</div>
                  <div class="m-bar"><div class="m-fill" style="width:${cur / m.goal * 100}%"></div></div>
                </div>
                <span class="m-count">${cur}/${m.goal}</span>
              </div>
            `;
          }).join("")}
        </div>
        <div class="modal-close-row"><button class="modal-btn" id="mission-close">とじる</button></div>
      </div>
    `;
    document.getElementById("mission-close").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
    });
  },

  /* =========================================
     あそびかた
     ========================================= */

  showHowto(onClose) {
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");
    layer.innerHTML = `
      <div class="modal-box">
        <h2>❓ あそびかた</h2>
        <div class="howto-step"><span class="h-num">1</span><div class="h-text">てきが みちを とおって <b>🏰きょてん</b>に むかってくるよ。とうたつされると HPが へっちゃう！</div></div>
        <div class="howto-step"><span class="h-num">2</span><div class="h-text">したの <b>タワーボタン</b>をえらんで、あいている ばしょを タップ！<b>かんじもんだいに せいかい</b>すると タワーが たつよ。</div></div>
        <div class="howto-step"><span class="h-num">3</span><div class="h-text">タワーを タップすると <b>きょうか</b>できる。きょうかにも もんだいに せいかいしよう！</div></div>
        <div class="howto-step"><span class="h-num">4</span><div class="h-text"><b>れんぞくせいかい（コンボ）</b>で こうげきそくど・こうげきりょく・コインが パワーアップ！まちがえると コンボは リセット…</div></div>
        <div class="howto-step"><span class="h-num">5</span><div class="h-text">ゲージが たまったら <b>✨スキル</b>！いんせきや ぜんたいとうけつで ピンチを きりぬけろ！</div></div>
        <div class="modal-close-row">
          <button class="modal-btn primary" id="howto-close">わかった！</button>
        </div>
      </div>
    `;
    document.getElementById("howto-close").addEventListener("click", () => {
      layer.classList.add("hidden");
      layer.innerHTML = "";
      if (onClose) onClose();
    });
  },

  /* =========================================
     確認ダイアログ
     ========================================= */

  confirm(message, onYes) {
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");
    layer.innerHTML = `
      <div class="modal-box" style="text-align:center">
        <h2>⚠️ かくにん</h2>
        <p style="font-weight:700;font-size:0.9rem;margin:10px 0">${message}</p>
        <div class="modal-close-row">
          <button class="modal-btn" id="cf-no">やめる</button>
          <button class="modal-btn primary" id="cf-yes">はい</button>
        </div>
      </div>
    `;
    const close = () => { layer.classList.add("hidden"); layer.innerHTML = ""; };
    document.getElementById("cf-no").addEventListener("click", close);
    document.getElementById("cf-yes").addEventListener("click", () => { close(); onYes(); });
  },
};
