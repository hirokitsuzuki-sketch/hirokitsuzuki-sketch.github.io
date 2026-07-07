/* =========================================================
   漢字ドリル用サウンド（BGM＋効果音）
   ---------------------------------------------------------
   Web Audio API で合成するため外部ファイル不要。
   設定は全学年ページ共通で localStorage に保存。
   ブラウザの自動再生制限のため、BGM は最初のタップで開始。
   ========================================================= */

const KSound = {
  KEY: 'kanji_sound_settings',
  sfxOn: true,
  bgmOn: true,
  ctx: null,
  unlocked: false,
  _bgmTimer: null,
  _step: 0,
  _nextTime: 0,

  /* ---------- 初期化・設定 ---------- */

  init() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY));
      if (s) {
        if (typeof s.sfx === 'boolean') this.sfxOn = s.sfx;
        if (typeof s.bgm === 'boolean') this.bgmOn = s.bgm;
      }
    } catch (e) {}

    // 最初のタップ／クリックで再生開始（自動再生制限対策）
    const unlock = () => {
      this.unlocked = true;
      if (this.bgmOn && !this._bgmTimer) this._startBgm();
    };
    document.addEventListener('pointerdown', unlock, { capture: true });

    // タブが隠れたら音を止める
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.bgmOn || this.sfxOn) this.ctx.resume();
    });
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify({ sfx: this.sfxOn, bgm: this.bgmOn }));
    } catch (e) {}
  },

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    this.save();
    if (this.sfxOn) this.tone(880, 0.08, 'square', 0.06);
    return this.sfxOn;
  },

  toggleBgm() {
    this.bgmOn = !this.bgmOn;
    this.save();
    if (!this.bgmOn) this._haltBgm();
    else if (this.unlocked) this._startBgm();
    return this.bgmOn;
  },

  ensureCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  /* ---------- 効果音 ---------- */

  tone(freq, dur, type = 'square', vol = 0.1, slide = 0, when = 0) {
    if (!this.sfxOn) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  // ⭕ 正解。れんぞく正解（streak）が続くほど音が高くなる
  correct(streak = 1) {
    const up = Math.min(6, Math.max(0, streak - 1)) * 40;
    this.tone(659 + up, 0.09, 'square', 0.08);
    this.tone(880 + up, 0.09, 'square', 0.08, 0, 0.09);
    this.tone(1319 + up, 0.16, 'square', 0.08, 0, 0.18);
  },

  // ✕ まちがい（責めないやわらかい音）
  wrong() {
    this.tone(330, 0.15, 'triangle', 0.09, -60);
    this.tone(262, 0.22, 'triangle', 0.08, -40, 0.12);
  },

  // 答え合わせボタン
  reveal() {
    this.tone(523, 0.08, 'triangle', 0.08);
    this.tone(784, 0.12, 'triangle', 0.08, 0, 0.08);
  },

  // リザルト：大成功（80%以上）
  fanfare() {
    [523, 523, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.09, 0, i * 0.12));
  },

  // リザルト：がんばったね（80%未満）
  cheer() {
    [392, 523, 659].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.09, 0, i * 0.14));
  },

  /* ---------- BGM（やさしいループ・8小節） ---------- */

  BGM: {
    bpm: 84,
    melType: 'triangle', melVol: 0.028,
    bassType: 'sine', bassVol: 0.042,
    // C - G - Am - F ／ C - G - F - C（8分音符 × 64ステップ）
    mel: [
      72, null, 76, null, 79, null, 76, null,
      74, null, 71, null, 74, null, 79, null,
      76, null, 72, null, 69, null, 72, null,
      77, null, 76, null, 74, null, 72, null,
      72, null, 76, null, 79, null, 84, null,
      83, null, 79, null, 74, null, 79, null,
      81, null, 77, null, 76, null, 74, null,
      72, null, null, null, 67, null, 72, null,
    ],
    bass: [
      48, null, null, null, 55, null, null, null,
      43, null, null, null, 50, null, null, null,
      45, null, null, null, 52, null, null, null,
      41, null, null, null, 48, null, null, null,
      48, null, null, null, 55, null, null, null,
      43, null, null, null, 50, null, null, null,
      41, null, null, null, 48, null, null, null,
      48, null, null, null, 43, null, 48, null,
    ],
  },

  _startBgm() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    this._haltBgm();
    this._step = 0;
    this._nextTime = ctx.currentTime + 0.06;
    // 少し先までノートを予約し続ける（タイマーのブレを吸収）
    this._bgmTimer = setInterval(() => this._schedule(), 40);
  },

  _haltBgm() {
    clearInterval(this._bgmTimer);
    this._bgmTimer = null;
  },

  _schedule() {
    const ctx = this.ctx;
    const t = this.BGM;
    if (!ctx) return;
    const stepDur = 60 / t.bpm / 2; // 8分音符の長さ

    while (this._nextTime < ctx.currentTime + 0.18) {
      const i = this._step % t.mel.length;
      if (t.mel[i] != null) this._note(t.mel[i], this._nextTime, stepDur * 0.9, t.melType, t.melVol);
      if (t.bass[i] != null) this._note(t.bass[i], this._nextTime, stepDur * 0.95, t.bassType, t.bassVol);
      this._step++;
      this._nextTime += stepDur;
    }
  },

  // MIDIノート番号で発音
  _note(midi, when, dur, type, vol) {
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  },
};
