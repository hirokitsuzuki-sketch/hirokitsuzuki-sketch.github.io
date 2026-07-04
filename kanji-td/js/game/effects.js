/* =========================================================
   演出（パーティクル・画面揺れ・フローティングテキスト）
   ========================================================= */

const FX = {
  particles: [],
  floats: [],
  beams: [],   // 雷などの線エフェクト
  rings: [],
  shakePower: 0,
  flash: 0,     // 画面全体の赤フラッシュ（被ダメージ時）

  reset() {
    this.particles = [];
    this.floats = [];
    this.beams = [];
    this.rings = [];
    this.shakePower = 0;
    this.flash = 0;
  },

  /* ---------- 生成 ---------- */

  burst(x, y, color, n = 10, speed = 120, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
        color, size: size * (0.5 + Math.random()),
        grav: 60,
      });
    }
  },

  explosion(x, y, color = "#ff9f43") {
    this.burst(x, y, color, 22, 200, 6);
    this.burst(x, y, "#ffe08a", 10, 120, 3);
    this.ring(x, y, color, 60);
    this.shake(7);
  },

  ring(x, y, color, maxR = 50) {
    this.rings.push({ x, y, r: 6, maxR, color, life: 0.35, maxLife: 0.35 });
  },

  beam(points, color = "#ffd54d") {
    this.beams.push({ points, color, life: 0.22, maxLife: 0.22 });
  },

  text(x, y, str, color = "#fff", size = 16) {
    this.floats.push({ x, y, str, color, size, life: 0.9, vy: -46 });
  },

  shake(power) { this.shakePower = Math.max(this.shakePower, power); },
  hitFlash() { this.flash = 0.35; },

  /* ---------- 更新・描画 ---------- */

  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const f of this.floats) { f.y += f.vy * dt; f.life -= dt; }
    this.floats = this.floats.filter(f => f.life > 0);

    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter(b => b.life > 0);

    for (const r of this.rings) { r.life -= dt; r.r += (r.maxR - r.r) * dt * 12; }
    this.rings = this.rings.filter(r => r.life > 0);

    this.shakePower = Math.max(0, this.shakePower - dt * 26);
    this.flash = Math.max(0, this.flash - dt);
  },

  draw(ctx) {
    // ビーム（雷）
    for (const b of this.beams) {
      ctx.save();
      ctx.globalAlpha = b.life / b.maxLife;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i < b.points.length; i++) {
        const p = b.points[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else {
          // ギザギザさせる
          const prev = b.points[i - 1];
          const midX = (prev.x + p.x) / 2 + (Math.random() - 0.5) * 16;
          const midY = (prev.y + p.y) / 2 + (Math.random() - 0.5) * 16;
          ctx.lineTo(midX, midY);
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // リング
    for (const r of this.rings) {
      ctx.save();
      ctx.globalAlpha = (r.life / r.maxLife) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // パーティクル
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // フローティングテキスト
    for (const f of this.floats) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.font = `900 ${f.size}px sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText(f.str, f.x, f.y);
      ctx.restore();
    }
  },
};

/* ---------- DOMベースの演出 ---------- */

// トースト通知（実績解除・デイリー達成など）
function showToast(icon, text) {
  let area = document.getElementById("toast-area");
  if (!area) {
    area = document.createElement("div");
    area.id = "toast-area";
    document.body.appendChild(area);
  }
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span style="font-size:1.3rem">${icon}</span><span>${text}</span>`;
  area.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// レベルアップ演出
function showLevelUp(level) {
  const el = document.createElement("div");
  el.className = "levelup-overlay";
  el.innerHTML = `
    <div class="lu-text">🎉 LEVEL UP!</div>
    <div class="lu-sub">プレイヤーレベル ${level} になった！</div>
  `;
  document.body.appendChild(el);
  SFX.levelup();
  setTimeout(() => el.remove(), 2300);
}
