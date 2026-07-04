/* =========================================================
   セーブ管理（LocalStorage）
   ========================================================= */

const SaveMgr = {
  KEY: "kanjiTD_save_v1",
  data: null,

  defaultData() {
    return {
      xp: 0,
      level: 1,
      totalScore: 0,
      // 累計スタッツ（実績・ミッション判定に使う）
      stats: {
        kills: 0, correct: 0, wrong: 0, maxCombo: 0,
        towersBuilt: 0, clears: 0, bossKills: 0,
        skillsUsed: 0, stars: 0, perfectClears: 0,
      },
      // ステージ記録 { "1": {stars, bestScore} }
      stages: {},
      // 漢字図鑑 { "海": {s:出題回数, c:正解回数} }
      zukan: {},
      // 実績 { id: true }
      ach: {},
      // デイリーチャレンジ
      daily: { date: "", stats: {}, done: false },
      settings: { grade: "2", sound: true, seenHowto: false },
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 欠けたキーをデフォルトで補完（バージョンアップ対策）
        this.data = Object.assign(this.defaultData(), parsed);
        this.data.stats = Object.assign(this.defaultData().stats, parsed.stats || {});
        this.data.settings = Object.assign(this.defaultData().settings, parsed.settings || {});
      } else {
        this.data = this.defaultData();
      }
    } catch (e) {
      this.data = this.defaultData();
    }
    this.refreshDaily();
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) { /* プライベートモードなどでは保存できない */ }
  },

  reset() {
    this.data = this.defaultData();
    this.refreshDaily();
    this.save();
  },

  /* ---------- XP・レベル ---------- */

  // XPを加算し、上がったレベル数を返す
  addXp(amount) {
    const d = this.data;
    d.xp += amount;
    let ups = 0;
    while (d.xp >= xpForLevel(d.level)) {
      d.xp -= xpForLevel(d.level);
      d.level++;
      ups++;
    }
    if (ups > 0) this.save();
    return ups;
  },

  /* ---------- スタッツ ---------- */

  // 累計＆デイリー両方のカウンタを進める
  bump(key, amount = 1) {
    const s = this.data.stats;
    if (key === "maxCombo") {
      s.maxCombo = Math.max(s.maxCombo, amount);
      const ds = this.data.daily.stats;
      ds.maxCombo = Math.max(ds.maxCombo || 0, amount);
    } else {
      s[key] = (s[key] || 0) + amount;
      const ds = this.data.daily.stats;
      ds[key] = (ds[key] || 0) + amount;
    }
  },

  /* ---------- 図鑑 ---------- */

  recordZukan(kanjiChar, correct) {
    const z = this.data.zukan;
    if (!z[kanjiChar]) z[kanjiChar] = { s: 0, c: 0 };
    z[kanjiChar].s++;
    if (correct) z[kanjiChar].c++;
  },

  /* ---------- 実績 ---------- */

  // 新規解除された実績のリストを返す
  checkAchievements() {
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.data.ach[a.id] && a.cond(this.data.stats)) {
        this.data.ach[a.id] = true;
        this.data.xp += 0; // XPはトースト側で addXp する
        unlocked.push(a);
      }
    }
    return unlocked;
  },

  /* ---------- デイリーチャレンジ ---------- */

  todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  },

  refreshDaily() {
    const today = this.todayKey();
    if (this.data.daily.date !== today) {
      this.data.daily = { date: today, stats: {}, done: false };
    }
  },

  getDailyChallenge() {
    // 日付文字列から安定したインデックスを作る
    const key = this.data.daily.date;
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return DAILY_TEMPLATES[h % DAILY_TEMPLATES.length];
  },

  // デイリー達成チェック。達成した瞬間ならチャレンジ定義を返す
  checkDaily() {
    if (this.data.daily.done) return null;
    const ch = this.getDailyChallenge();
    const cur = this.data.daily.stats[ch.key] || 0;
    if (cur >= ch.goal) {
      this.data.daily.done = true;
      return ch;
    }
    return null;
  },
};
