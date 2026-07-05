/* =========================================================
   BGM（Web Audio APIでチップチューン風に合成・外部ファイル不要）
   ---------------------------------------------------------
   8分音符のステップシーケンサー。トラックは32ステップ（4小節）ループ。
   ノートはMIDIノート番号（69 = ラ = 440Hz）、null は休符。
   BGM.play("home" | "battle" | "boss") で切り替え、stop() で停止。
   ブラウザの自動再生制限のため、最初のタップで再生が始まる。
   ========================================================= */

const BGM_TRACKS = {
  // ホーム：ゆったり C - Am - F - G
  home: {
    bpm: 88, melType: "triangle", melVol: 0.035, bassType: "sine", bassVol: 0.05, hat: false,
    mel: [
      72, null, 76, null, 79, null, 76, null,
      69, null, 72, null, 76, null, 72, null,
      77, null, 72, null, 69, null, 72, null,
      74, null, 71, null, 67, null, 71, null,
    ],
    bass: [
      48, null, null, null, 55, null, null, null,
      45, null, null, null, 52, null, null, null,
      41, null, null, null, 48, null, null, null,
      43, null, null, null, 50, null, null, null,
    ],
  },
  // バトル：アップテンポ Am - F - C - G
  battle: {
    bpm: 132, melType: "square", melVol: 0.03, bassType: "triangle", bassVol: 0.055, hat: true,
    mel: [
      69, null, 72, 74, 76, 74, 72, 69,
      69, null, 65, 69, 72, null, 69, 65,
      67, null, 64, 67, 72, null, 76, 74,
      71, null, 67, 71, 74, 72, 71, 67,
    ],
    bass: [
      45, null, 45, 52, null, 45, 52, null,
      41, null, 41, 48, null, 41, 48, null,
      48, null, 48, 55, null, 48, 55, null,
      43, null, 43, 50, null, 43, 50, null,
    ],
  },
  // ボス戦：緊迫 Dm - Bb - Gm - A
  boss: {
    bpm: 148, melType: "square", melVol: 0.032, bassType: "sawtooth", bassVol: 0.04, hat: true,
    mel: [
      74, null, 77, 74, 81, null, 79, 77,
      74, null, 77, 74, 82, null, 81, 79,
      79, null, 74, 70, 74, null, 70, 74,
      69, null, 73, 69, 76, null, 73, 76,
    ],
    bass: [
      50, 50, null, 50, 50, null, 50, 50,
      46, 46, null, 46, 46, null, 46, 46,
      43, 43, null, 43, 43, null, 43, 43,
      45, 45, null, 45, 45, null, 45, 47,
    ],
  },
};

const BGM = {
  enabled: true,
  unlocked: false,   // ユーザー操作後にtrue（自動再生制限対策）
  current: null,     // 再生したいトラック名
  track: null,
  timer: null,
  step: 0,
  nextTime: 0,

  init() {
    this.enabled = SaveMgr.data.settings.bgm !== false;

    // 最初のタップ／クリックで再生開始できるようにする
    const unlock = () => {
      this.unlocked = true;
      if (this.current && this.enabled && !this.timer) this._start(this.current);
    };
    document.addEventListener("pointerdown", unlock, { capture: true });

    // タブが隠れたら音を止める
    document.addEventListener("visibilitychange", () => {
      if (!SFX.ctx) return;
      if (document.hidden) SFX.ctx.suspend();
      else if (this.enabled || SFX.enabled) SFX.ctx.resume();
    });
  },

  play(name) {
    if (this.current === name && this.timer) return; // すでに再生中
    this.current = name;
    if (this.enabled && this.unlocked) this._start(name);
  },

  stop() {
    this.current = null;
    this._halt();
  },

  toggle() {
    this.enabled = !this.enabled;
    SaveMgr.data.settings.bgm = this.enabled;
    SaveMgr.save();
    if (!this.enabled) this._halt();
    else if (this.current && this.unlocked) this._start(this.current);
    return this.enabled;
  },

  _halt() {
    clearInterval(this.timer);
    this.timer = null;
  },

  _start(name) {
    const ctx = SFX.ensureCtx();
    if (!ctx) return;
    this._halt();
    this.track = BGM_TRACKS[name];
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.06;
    // 少し先までノートを予約し続ける（タイマーのブレを吸収）
    this.timer = setInterval(() => this._schedule(), 40);
  },

  _schedule() {
    const ctx = SFX.ctx;
    const t = this.track;
    if (!ctx || !t) return;
    const stepDur = 60 / t.bpm / 2; // 8分音符の長さ

    while (this.nextTime < ctx.currentTime + 0.18) {
      const i = this.step % t.mel.length;
      if (t.mel[i] != null) this._note(t.mel[i], this.nextTime, stepDur * 0.9, t.melType, t.melVol);
      if (t.bass[i] != null) this._note(t.bass[i], this.nextTime, stepDur * 0.95, t.bassType, t.bassVol);
      if (t.hat && i % 2 === 1) this._hat(this.nextTime);
      this.step++;
      this.nextTime += stepDur;
    }
  },

  // MIDIノート番号で発音
  _note(midi, when, dur, type, vol) {
    const ctx = SFX.ctx;
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

  // ハイハット風の短いノイズ
  _hat(when) {
    const ctx = SFX.ctx;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, when);
    src.connect(gain).connect(ctx.destination);
    src.start(when);
  },
};
