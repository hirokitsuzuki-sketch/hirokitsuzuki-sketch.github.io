/* =========================================================
   敵定義
   ---------------------------------------------------------
   hp    : 基本HP（ステージ・ウェーブ倍率がかかる）
   spd   : 移動速度（ピクセル/秒・論理座標基準）
   armor : 防御力（物理ダメージから引かれる。魔法・毒は無視）
   fly   : 飛行タイプ（対空タワーしか当たらない）
   coin  : 倒したときのコイン
   dmg   : 拠点に到達したときのダメージ
   size  : 描画サイズ
   ========================================================= */

const ENEMIES = {
  slime: {
    id: "slime", name: "スライム", icon: "👾",
    hp: 32, spd: 42, armor: 0, coin: 10, dmg: 1, size: 30,
    desc: "ふつうの てき。まずは これを たおそう",
  },
  wolf: {
    id: "wolf", name: "シャドウウルフ", icon: "🐺",
    hp: 22, spd: 92, armor: 0, coin: 12, dmg: 1, size: 30,
    desc: "あしが はやい！氷タワーで おそくしよう",
  },
  knight: {
    id: "knight", name: "アーマーナイト", icon: "🛡️",
    hp: 65, spd: 30, armor: 6, coin: 18, dmg: 1, size: 32,
    desc: "ぼうぎょが かたい。魔法タワーが よくきく",
  },
  golem: {
    id: "golem", name: "ゴーレム", icon: "🗿",
    hp: 170, spd: 21, armor: 2, coin: 26, dmg: 2, size: 38,
    desc: "HPが とてもたかい。毒や炎で じわじわ けずろう",
  },
  bat: {
    id: "bat", name: "ヘルバット", icon: "🦇",
    hp: 26, spd: 62, armor: 0, fly: true, coin: 15, dmg: 1, size: 28,
    desc: "そらを とぶ。炎タワーは あたらない！",
  },
  boss: {
    id: "boss", name: "まおう", icon: "👹",
    hp: 900, spd: 17, armor: 8, coin: 150, dmg: 5, size: 56, boss: true,
    desc: "ステージさいごの きょうてき。そうりょくせんだ！",
  },
  dragon: {
    id: "dragon", name: "ドラゴン", icon: "🐉",
    hp: 750, spd: 24, armor: 4, fly: true, coin: 160, dmg: 5, size: 54, boss: true,
    desc: "そらとぶ ボス。たいくうタワーを そろえよう",
  },
};
