/* =========================================================
   エンティティ（敵・タワー・弾）
   ========================================================= */

/* ---------- 敵 ---------- */

class Enemy {
  /**
   * @param {string} typeId  ENEMIES のキー
   * @param {number} hpMul   HP倍率（ステージ×ウェーブ）
   * @param {Array}  path    ピクセル座標のウェイポイント配列
   */
  constructor(typeId, hpMul, path) {
    const def = ENEMIES[typeId];
    this.def = def;
    this.typeId = typeId;
    this.maxHp = Math.round(def.hp * hpMul);
    this.hp = this.maxHp;
    this.path = path;
    this.dist = 0;          // 道のりの進行距離
    this.x = path[0].x;
    this.y = path[0].y;
    this.dead = false;
    this.reached = false;   // 拠点に到達したか
    this.slowUntil = 0;     // ゲーム内時刻
    this.slowMul = 1;
    this.freezeUntil = 0;
    this.poisons = [];      // { dps, until }
    this.wobble = Math.random() * Math.PI * 2; // ゆらゆらアニメ用

    // 経路の全長を計算
    this.segLens = [];
    this.totalLen = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const l = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
      this.segLens.push(l);
      this.totalLen += l;
    }
  }

  // 現在の移動速度（スロー・凍結を考慮）
  currentSpeed(now) {
    if (now < this.freezeUntil) return 0;
    let spd = this.def.spd;
    if (now < this.slowUntil) spd *= this.slowMul;
    return spd;
  }

  update(dt, now, game) {
    if (this.dead || this.reached) return;

    // 毒ダメージ
    for (const p of this.poisons) {
      if (now < p.until) this.damage(p.dps * dt, { true_: true, silent: true }, game);
    }
    this.poisons = this.poisons.filter(p => now < p.until);
    if (this.dead) return;

    // 移動
    this.dist += this.currentSpeed(now) * dt;
    this.wobble += dt * 6;
    if (this.dist >= this.totalLen) {
      this.reached = true;
      return;
    }
    // dist から座標を求める
    let d = this.dist;
    for (let i = 0; i < this.segLens.length; i++) {
      if (d <= this.segLens[i]) {
        const t = d / this.segLens[i];
        const a = this.path[i], b = this.path[i + 1];
        this.x = a.x + (b.x - a.x) * t;
        this.y = a.y + (b.y - a.y) * t - (this.def.fly ? 10 + Math.sin(this.wobble) * 5 : 0);
        return;
      }
      d -= this.segLens[i];
    }
  }

  /**
   * ダメージを与える
   * opts.magic : 防御力無視
   * opts.true_ : 完全固定ダメージ（毒）
   */
  damage(amount, opts = {}, game) {
    if (this.dead) return 0;
    let dmg = amount;
    if (!opts.magic && !opts.true_) dmg = Math.max(1, dmg - this.def.armor);
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (game) game.onEnemyKilled(this);
    }
    return dmg;
  }

  applySlow(mul, dur, now) {
    this.slowMul = Math.min(this.slowMul === 1 || now > this.slowUntil ? mul : this.slowMul, mul);
    this.slowUntil = Math.max(this.slowUntil, now + dur);
  }

  applyPoison(dps, dur, now) {
    // 同時に効く毒は最大3つまで（無限スタック防止）
    if (this.poisons.length < 3) this.poisons.push({ dps, until: now + dur });
    else this.poisons[0].until = now + dur;
  }

  draw(ctx, now) {
    const size = this.def.size;
    ctx.save();
    ctx.translate(this.x, this.y);

    // 凍結中は青く
    if (now < this.freezeUntil) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(94,234,212,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }

    // 影
    if (!this.def.fly) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(0, size * 0.42, size * 0.4, size * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 本体（絵文字）
    const bounce = this.def.fly ? 0 : Math.abs(Math.sin(this.wobble)) * -3;
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.def.icon, 0, bounce);

    // 状態アイコン
    ctx.font = "11px sans-serif";
    let sx = -10;
    if (now < this.slowUntil && now >= this.freezeUntil) { ctx.fillText("❄️", sx, -size * 0.72); sx += 13; }
    if (this.poisons.some(p => now < p.until)) { ctx.fillText("☠️", sx, -size * 0.72); }

    // HPバー
    const w = size * 1.05, h = this.def.boss ? 7 : 5;
    const ratio = this.hp / this.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(-w / 2, -size * 0.62 - h, w, h);
    ctx.fillStyle = ratio > 0.5 ? "#3ecf8e" : ratio > 0.25 ? "#ffd54d" : "#ff5d6c";
    ctx.fillRect(-w / 2, -size * 0.62 - h, w * ratio, h);

    ctx.restore();
  }
}

/* ---------- タワー ---------- */

class Tower {
  constructor(typeId, col, row) {
    this.def = TOWERS[typeId];
    this.typeId = typeId;
    this.col = col;
    this.row = row;
    this.x = col * GRID.cell + GRID.cell / 2;
    this.y = row * GRID.cell + GRID.cell / 2;
    this.level = 1;
    this.cooldown = 0;
    this.invested = this.def.cost; // 売却額計算用
    this.recoil = 0;               // 発射アニメ
  }

  // レベル補正込みのステータス
  get dmg() { return this.def.dmg * Math.pow(TOWER_UPGRADE.dmgMul, this.level - 1); }
  get range() { return this.def.range + TOWER_UPGRADE.rangeAdd * (this.level - 1); }
  get rate() { return this.def.rate * Math.pow(TOWER_UPGRADE.rateMul, this.level - 1); }

  upgradeCost() { return Math.round(this.def.cost * TOWER_UPGRADE.costMul * this.level / 10) * 10; }
  sellValue() { return Math.round(this.invested * TOWER_UPGRADE.sellRate / 10) * 10; }

  update(dt, game) {
    this.cooldown -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (this.cooldown > 0) return;

    // コンボバフ：攻撃速度・攻撃力
    const buffs = game.getBuffs();

    // ターゲット：射程内で一番進んでいる敵
    let target = null;
    for (const e of game.enemies) {
      if (e.dead || e.reached) continue;
      if (e.def.fly && !this.def.air) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= this.range && (!target || e.dist > target.dist)) target = e;
    }
    if (!target) return;

    this.cooldown = this.rate / buffs.rateMul;
    this.recoil = 1;
    const dmg = this.dmg * buffs.dmgMul;

    if (this.def.chain) {
      // 雷：即着弾でチェーン
      game.fireChain(this, target, dmg);
    } else {
      game.projectiles.push(new Projectile(this, target, dmg));
      SFX.shoot();
    }
  }

  draw(ctx, selected) {
    const c = GRID.cell;
    ctx.save();
    ctx.translate(this.x, this.y);

    // 台座
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.arc(0, c * 0.18, c * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.def.color + "33";
    ctx.strokeStyle = this.def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, c * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 本体（絵文字）：発射時に少し縮む
    const s = 1 - this.recoil * 0.12;
    ctx.font = `${Math.round(c * 0.52 * s)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.def.icon, 0, -2);

    // レベルピップ
    ctx.fillStyle = "#ffd54d";
    for (let i = 0; i < this.level; i++) {
      ctx.beginPath();
      ctx.arc(-10 + i * 10, c * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 選択中は射程円を表示
    if (selected) {
      ctx.save();
      ctx.strokeStyle = this.def.color;
      ctx.fillStyle = this.def.color + "1a";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/* ---------- 弾 ---------- */

class Projectile {
  constructor(tower, target, dmg) {
    this.def = tower.def;
    this.x = tower.x;
    this.y = tower.y - 14;
    this.target = target;
    this.dmg = dmg;
    this.speed = 420;
    this.dead = false;
  }

  update(dt, game) {
    if (this.dead) return;
    // ターゲット消滅時はその場で消える（炎は着弾扱い）
    if (this.target.dead || this.target.reached) {
      if (this.def.splash) this.explode(game, this.x, this.y);
      this.dead = true;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step + 8) {
      this.hit(game);
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }

  hit(game) {
    this.dead = true;
    const now = game.time;
    if (this.def.splash) {
      this.explode(game, this.target.x, this.target.y);
      return;
    }
    this.target.damage(this.dmg, { magic: this.def.magic }, game);
    if (this.def.slow) this.target.applySlow(this.def.slow.mul, this.def.slow.dur, now);
    if (this.def.poison) this.target.applyPoison(this.def.poison.dps, this.def.poison.dur, now);
    FX.burst(this.target.x, this.target.y, this.def.color, 5, 90, 3);
    SFX.hit();
  }

  // 炎の範囲爆発
  explode(game, x, y) {
    FX.explosion(x, y, this.def.color);
    SFX.explosion();
    for (const e of game.enemies) {
      if (e.dead || e.reached || e.def.fly) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= this.def.splash) e.damage(this.dmg, {}, game);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.def.color;
    ctx.shadowColor = this.def.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.def.splash ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
