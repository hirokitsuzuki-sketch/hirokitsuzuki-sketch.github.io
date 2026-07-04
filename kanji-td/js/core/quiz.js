/* =========================================================
   クイズエンジン
   ---------------------------------------------------------
   QDATA から四択問題をランダム生成し、モーダルで出題する。
   Quiz.ask({ grade, context, onDone }) で呼び出す。
   結果は onDone({ correct, timeout }) で返る。
   ========================================================= */

const Quiz = {
  TIME_LIMIT: 12, // 秒

  // 全学年の漢字 → エントリ の逆引き（図鑑用）
  kanjiMap: {},

  init() {
    for (const g of Object.keys(QDATA)) {
      for (const e of QDATA[g].kanji) {
        this.kanjiMap[e.k] = { grade: g, entry: e };
      }
    }
  },

  /* ---------- ユーティリティ ---------- */

  rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // 設定から出題学年のプールを決める
  gradePool(grade) {
    if (grade === "mix") return ["2", "3", "4"];
    return [grade];
  },

  /* ---------- 問題生成 ---------- */

  // 出題タイプと重み
  TYPES: [
    ["yomi", 3], ["kanji", 3], ["imi", 2], ["bushu", 1.5],
    ["okurigana", 2], ["jukugoYomi", 2], ["jukugoFill", 1.5],
    ["homophone", 1.5], ["taigi", 2], ["strokeCount", 1], ["strokeFacts", 0.5],
  ],

  pickType() {
    const total = this.TYPES.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * total;
    for (const [type, w] of this.TYPES) {
      r -= w;
      if (r <= 0) return type;
    }
    return "yomi";
  },

  // 問題を1問生成する。{ typeLabel, text, choices, correctIdx, explain, zukan } を返す
  generate(gradeSetting) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const grade = this.rand(this.gradePool(gradeSetting));
      const type = this.pickType();
      const q = this.build(type, grade);
      if (q) return q;
    }
    // 保険：必ず作れる読み問題
    return this.build("yomi", this.rand(this.gradePool(gradeSetting)));
  },

  build(type, grade) {
    const D = QDATA[grade];
    const K = D.kanji;

    switch (type) {
      case "yomi": {
        const e = this.rand(K);
        const wrongs = this.shuffle(K.filter(o => o.k !== e.k && o.y[0] !== e.y[0])).slice(0, 3).map(o => o.y[0]);
        if (wrongs.length < 3) return null;
        return this.pack("よみかた", `「<span class="focus">${e.k}</span>」の よみかたは？`,
          e.y[0], wrongs, `「${e.k}」は「${e.y.join("・")}」と よむよ`, [e.k]);
      }

      case "kanji": {
        const e = this.rand(K);
        // 同じ読みを持つ漢字は誤答にしない
        const wrongs = this.shuffle(K.filter(o => o.k !== e.k && !o.y.includes(e.y[0]))).slice(0, 3).map(o => o.k);
        if (wrongs.length < 3) return null;
        return this.pack("かんじ", `「<span class="focus">${e.y[0]}</span>」と よむ かんじは？`,
          e.k, wrongs, `「${e.y[0]}」は「${e.k}」（${e.m}）`, [e.k]);
      }

      case "imi": {
        const e = this.rand(K);
        if (Math.random() < 0.5) {
          const wrongs = this.shuffle(K.filter(o => o.k !== e.k)).slice(0, 3).map(o => o.k);
          if (wrongs.length < 3) return null;
          return this.pack("いみ", `「${e.m}」<br>この いみの かんじは？`,
            e.k, wrongs, `せいかいは「${e.k}」（${e.y[0]}）`, [e.k]);
        } else {
          const wrongs = this.shuffle(K.filter(o => o.k !== e.k)).slice(0, 3).map(o => o.m);
          if (wrongs.length < 3) return null;
          return this.pack("いみ", `「<span class="focus">${e.k}</span>」の いみは？`,
            e.m, wrongs, `「${e.k}」（${e.y[0]}）は「${e.m}」`, [e.k]);
        }
      }

      case "bushu": {
        const withBushu = K.filter(o => o.b);
        const target = this.rand(withBushu);
        if (!target) return null;
        const same = withBushu.filter(o => o.b === target.b && o.k !== target.k);
        const diff = withBushu.filter(o => o.b !== target.b);
        if (same.length < 1 || diff.length < 3) return null;
        const correct = this.rand(same);
        const wrongs = this.shuffle(diff).slice(0, 3).map(o => o.k);
        return this.pack("ぶしゅ", `「<span class="focus">${target.k}</span>」と おなじ ぶしゅ（${target.b}）の かんじは？`,
          correct.k, wrongs, `「${target.k}」と「${correct.k}」は どちらも「${target.b}」`, [target.k, correct.k]);
      }

      case "okurigana": {
        const item = this.rand(D.okurigana);
        if (!item) return null;
        return this.pack("おくりがな", `「<span class="focus">${item.y}</span>」<br>ただしい かきかたは？`,
          item.c, item.w, `せいかいは「${item.c}」`, [item.c[0]]);
      }

      case "jukugoYomi": {
        const item = this.rand(D.jukugoYomi);
        if (!item) return null;
        return this.pack("じゅくご", `「<span class="focus">${item.w}</span>」の よみかたは？`,
          item.c, item.d, `「${item.w}」は「${item.c}」と よむよ`, item.w.split(""));
      }

      case "jukugoFill": {
        const item = this.rand(D.jukugoFill);
        if (!item) return null;
        const chars = item.w.split("");
        const correct = chars[item.blank];
        const shown = chars.map((c, i) => i === item.blank ? "◯" : c).join("");
        return this.pack("じゅくご", `「<span class="focus">${shown}</span>」（${item.y}）<br>◯に はいる かんじは？`,
          correct, item.d, `せいかいは「${item.w}」（${item.y}）`, [correct]);
      }

      case "homophone": {
        const item = this.rand(D.homophone);
        if (!item) return null;
        return this.pack("つかいわけ", `${item.s.replace("○○", `<span class="focus">${item.y}</span>`)}<br>ただしい かきかたは？`,
          item.c, item.d, `せいかいは「${item.c}」`, [item.c[0]]);
      }

      case "taigi": {
        const item = this.rand(D.taigi);
        if (!item) return null;
        return this.pack(item.rel === "はんたい" ? "はんたいご" : "にたことば",
          `「<span class="focus">${item.q}</span>」と ${item.rel}の いみの ことばは？`,
          item.c, item.d, `「${item.q}」⇔「${item.c}」`, []);
      }

      case "strokeCount": {
        const withS = K.filter(o => o.s);
        const e = this.rand(withS);
        if (!e) return null;
        const offsets = this.shuffle([-2, -1, 1, 2, 3]).slice(0, 3);
        const wrongs = offsets.map(o => Math.max(1, e.s + o) + "かく");
        if (new Set(wrongs.concat([e.s + "かく"])).size < 4) return null;
        return this.pack("かくすう", `「<span class="focus">${e.k}</span>」は ぜんぶで なんかくで かく？`,
          e.s + "かく", wrongs, `「${e.k}」は ${e.s}かくだよ`, [e.k]);
      }

      case "strokeFacts": {
        const item = this.rand(D.strokeFacts);
        if (!item) return null;
        return this.pack("かきかた", item.q, item.c, item.d, `せいかいは「${item.c}」`, []);
      }
    }
    return null;
  },

  // 問題オブジェクトに詰める（選択肢をシャッフル）
  pack(typeLabel, text, correct, wrongs, explain, zukanChars) {
    const choices = this.shuffle([correct, ...wrongs.slice(0, 3)]);
    return {
      typeLabel, text, choices,
      correctIdx: choices.indexOf(correct),
      explain,
      zukan: (zukanChars || []).filter(c => this.kanjiMap[c]),
    };
  },

  /* ---------- 出題モーダル ---------- */

  ask({ grade, context, onDone }) {
    const q = this.generate(grade);
    const layer = document.getElementById("modal-layer");
    layer.classList.remove("hidden");

    const R = 20; // タイマー円の半径
    const CIRC = 2 * Math.PI * R;

    layer.innerHTML = `
      <div class="modal-box quiz-box">
        <div class="quiz-head">
          <span class="quiz-type-chip">${q.typeLabel}</span>
          <span style="font-size:0.75rem;font-weight:800;color:var(--text2)">${context || ""}</span>
          <div class="quiz-timer">
            <svg width="46" height="46">
              <circle cx="23" cy="23" r="${R}" fill="none" stroke="#2a3150" stroke-width="4"/>
              <circle id="quiz-ring" cx="23" cy="23" r="${R}" fill="none" stroke="#4f9eff" stroke-width="4"
                stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
            </svg>
            <span class="tnum" id="quiz-tnum">${this.TIME_LIMIT}</span>
          </div>
        </div>
        <div class="quiz-q">${q.text}</div>
        <div class="quiz-choices">
          ${q.choices.map((c, i) => `<button class="quiz-choice" data-i="${i}">${c}</button>`).join("")}
        </div>
        <div class="quiz-explain" id="quiz-explain"></div>
      </div>
    `;

    const ring = document.getElementById("quiz-ring");
    const tnum = document.getElementById("quiz-tnum");
    const buttons = Array.from(layer.querySelectorAll(".quiz-choice"));
    let remaining = this.TIME_LIMIT;
    let finished = false;

    const timer = setInterval(() => {
      remaining -= 0.1;
      if (remaining < 0) remaining = 0;
      ring.style.strokeDashoffset = CIRC * (1 - remaining / this.TIME_LIMIT);
      ring.style.stroke = remaining < 4 ? "#ff5d6c" : "#4f9eff";
      tnum.textContent = Math.ceil(remaining);
      if (remaining <= 0 && !finished) finish(-1); // 時間切れ
    }, 100);

    const finish = (chosenIdx) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      buttons.forEach(b => b.disabled = true);

      const correct = chosenIdx === q.correctIdx;
      const explainEl = document.getElementById("quiz-explain");

      // 正解の選択肢を光らせる
      buttons[q.correctIdx].classList.add("correct");
      if (!correct && chosenIdx >= 0) buttons[chosenIdx].classList.add("wrong");

      if (correct) {
        SFX.correct();
        explainEl.innerHTML = `<span class="ok">せいかい！</span> ${q.explain}`;
      } else {
        SFX.wrong();
        explainEl.innerHTML = `<span class="ng">${chosenIdx < 0 ? "じかんぎれ…" : "ざんねん…"}</span> ${q.explain}`;
      }

      // 図鑑に記録
      for (const c of q.zukan) SaveMgr.recordZukan(c, correct);
      SaveMgr.bump(correct ? "correct" : "wrong");
      SaveMgr.save();

      // 正解は短く、不正解は答えを見せるため少し長く表示
      setTimeout(() => {
        layer.classList.add("hidden");
        layer.innerHTML = "";
        onDone({ correct, timeout: chosenIdx < 0 });
      }, correct ? 850 : 1900);
    };

    buttons.forEach(b => {
      b.addEventListener("click", () => finish(parseInt(b.dataset.i, 10)));
    });
  },
};
