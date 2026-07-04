/* =========================================================
   効果音（Web Audio APIで合成・外部ファイル不要）
   ========================================================= */

const SFX = {
  ctx: null,
  enabled: true,

  init() {
    this.enabled = SaveMgr.data.settings.sound;
  },

  ensureCtx() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { return null; }
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  toggle() {
    this.enabled = !this.enabled;
    SaveMgr.data.settings.sound = this.enabled;
    SaveMgr.save();
    return this.enabled;
  },

  // 基本のトーン再生
  tone(freq, dur, type = "square", vol = 0.12, slide = 0) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  },

  // ノイズ（爆発用）
  noise(dur, vol = 0.15) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(gain).connect(ctx.destination);
    src.start();
  },

  /* ---- 場面ごとのショートカット ---- */
  shoot() { this.tone(880, 0.06, "square", 0.04, -300); },
  hit() { this.tone(220, 0.08, "sawtooth", 0.06, -80); },
  explosion() { this.noise(0.3, 0.18); this.tone(80, 0.3, "sine", 0.15, -40); },
  coin() { this.tone(988, 0.07, "square", 0.07); setTimeout(() => this.tone(1319, 0.12, "square", 0.07), 70); },
  correct() {
    this.tone(659, 0.1, "square", 0.09);
    setTimeout(() => this.tone(880, 0.1, "square", 0.09), 100);
    setTimeout(() => this.tone(1319, 0.18, "square", 0.09), 200);
  },
  wrong() { this.tone(180, 0.28, "sawtooth", 0.1, -60); },
  build() { this.tone(440, 0.08, "square", 0.08); setTimeout(() => this.tone(660, 0.1, "square", 0.08), 80); },
  skill() {
    for (let i = 0; i < 5; i++) setTimeout(() => this.tone(440 + i * 160, 0.12, "triangle", 0.1), i * 60);
  },
  bossRoar() { this.tone(70, 0.7, "sawtooth", 0.2, 30); this.noise(0.5, 0.1); },
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, "square", 0.1), i * 110));
  },
  fanfare() {
    [523, 523, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "square", 0.1), i * 140));
  },
  lose() { [400, 350, 300, 200].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, "sawtooth", 0.09), i * 180)); },
};
