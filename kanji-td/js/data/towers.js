/* =========================================================
   タワー定義
   ---------------------------------------------------------
   cost   : 設置コスト
   dmg    : 攻撃力（レベルアップで upMul 倍ずつ強化）
   range  : 射程（ピクセル・論理座標960x540基準）
   rate   : 攻撃間隔（秒）
   air    : 飛行タイプを攻撃できるか
   magic  : true なら防御力（armor）を無視
   splash : 範囲ダメージの半径
   slow   : {mul:移動速度倍率, dur:効果秒}
   poison : {dps:毎秒ダメージ, dur:効果秒}
   chain  : 連鎖攻撃する敵の数
   ========================================================= */

const TOWERS = {
  arrow: {
    id: "arrow", name: "弓", icon: "🏹", color: "#8ee06e",
    cost: 100, dmg: 13, range: 130, rate: 0.5,
    air: true,
    desc: "れんしゃが はやい きほんの タワー",
  },
  magic: {
    id: "magic", name: "魔法", icon: "🔮", color: "#a78bfa",
    cost: 170, dmg: 26, range: 145, rate: 0.9,
    air: true, magic: true,
    desc: "ぼうぎょりょくを むしする まほうだん",
  },
  ice: {
    id: "ice", name: "氷", icon: "❄️", color: "#5eead4",
    cost: 140, dmg: 8, range: 115, rate: 0.8,
    air: true, slow: { mul: 0.55, dur: 2.0 },
    desc: "てきの あしを おそくする",
  },
  fire: {
    id: "fire", name: "炎", icon: "🔥", color: "#ff9f43",
    cost: 190, dmg: 20, range: 105, rate: 1.0,
    air: false, splash: 55,
    desc: "はんいこうげき！ひこうタイプには あたらない",
  },
  thunder: {
    id: "thunder", name: "雷", icon: "⚡", color: "#ffd54d",
    cost: 230, dmg: 28, range: 140, rate: 1.25,
    air: true, chain: 3,
    desc: "3たいまで れんさして こうげき",
  },
  poison: {
    id: "poison", name: "毒", icon: "☠️", color: "#b06ee0",
    cost: 150, dmg: 6, range: 120, rate: 0.7,
    air: true, poison: { dps: 7, dur: 4 },
    desc: "どくで じわじわ ダメージ",
  },
};

// タワー強化の設定
const TOWER_UPGRADE = {
  maxLevel: 3,           // 最大レベル
  costMul: 0.8,          // 強化コスト = 設置コスト × costMul × 現レベル
  dmgMul: 1.45,          // 強化ごとの攻撃力倍率
  rangeAdd: 12,          // 強化ごとの射程加算
  rateMul: 0.9,          // 強化ごとの攻撃間隔倍率（小さいほど速い）
  sellRate: 0.6,         // 売却時の返金率（投資額に対して）
};
