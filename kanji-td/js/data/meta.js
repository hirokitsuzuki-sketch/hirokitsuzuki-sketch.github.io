/* =========================================================
   メタ要素定義（実績・ミッション・デイリー・レベル）
   ---------------------------------------------------------
   実績・ミッションの cond は SaveMgr.data.stats を受け取って
   判定する関数。stats のキー:
     kills, correct, wrong, maxCombo, towersBuilt, clears,
     bossKills, skillsUsed, stars(合計), perfectClears
   ========================================================= */

const ACHIEVEMENTS = [
  { id: "first_kill", icon: "⚔️", name: "はじめての討伐", desc: "てきを1たい たおす", xp: 20, cond: s => s.kills >= 1 },
  { id: "kill100", icon: "🗡️", name: "モンスターハンター", desc: "てきを 100たい たおす", xp: 100, cond: s => s.kills >= 100 },
  { id: "kill500", icon: "🏆", name: "せんじょうの英雄", desc: "てきを 500たい たおす", xp: 300, cond: s => s.kills >= 500 },
  { id: "first_clear", icon: "🚩", name: "はじめての勝利", desc: "ステージを1つ クリアする", xp: 50, cond: s => s.clears >= 1 },
  { id: "combo5", icon: "🔥", name: "コンボビギナー", desc: "5コンボを たっせいする", xp: 40, cond: s => s.maxCombo >= 5 },
  { id: "combo10", icon: "💥", name: "コンボマスター", desc: "10コンボを たっせいする", xp: 100, cond: s => s.maxCombo >= 10 },
  { id: "combo15", icon: "🌟", name: "コンボレジェンド", desc: "15コンボを たっせいする", xp: 200, cond: s => s.maxCombo >= 15 },
  { id: "correct50", icon: "📖", name: "かんじ見習い", desc: "もんだいに 50もん せいかいする", xp: 60, cond: s => s.correct >= 50 },
  { id: "correct200", icon: "🎓", name: "かんじ博士", desc: "もんだいに 200もん せいかいする", xp: 200, cond: s => s.correct >= 200 },
  { id: "boss1", icon: "👹", name: "ボスバスター", desc: "ボスを たおす", xp: 80, cond: s => s.bossKills >= 1 },
  { id: "tower30", icon: "🏗️", name: "けんちく家", desc: "タワーを 30こ たてる", xp: 60, cond: s => s.towersBuilt >= 30 },
  { id: "skill10", icon: "✨", name: "スキルつかい", desc: "スキルを 10かい つかう", xp: 60, cond: s => s.skillsUsed >= 10 },
  { id: "perfect1", icon: "💎", name: "パーフェクト", desc: "HPまんたんで クリアする", xp: 100, cond: s => s.perfectClears >= 1 },
  { id: "star15", icon: "⭐", name: "スターコレクター", desc: "星を ぜんぶで 15こ あつめる", xp: 400, cond: s => s.stars >= 15 },
];

const MISSIONS = [
  { id: "m_kill", icon: "⚔️", name: "討伐ミッション", desc: "てきを たおす", goal: 300, key: "kills", xp: 150 },
  { id: "m_correct", icon: "📝", name: "かんじミッション", desc: "もんだいに せいかいする", goal: 150, key: "correct", xp: 150 },
  { id: "m_tower", icon: "🏗️", name: "けんせつミッション", desc: "タワーを たてる", goal: 50, key: "towersBuilt", xp: 100 },
  { id: "m_clear", icon: "🚩", name: "クリアミッション", desc: "ステージを クリアする", goal: 10, key: "clears", xp: 200 },
  { id: "m_skill", icon: "✨", name: "スキルミッション", desc: "スキルを つかう", goal: 20, key: "skillsUsed", xp: 100 },
  { id: "m_boss", icon: "👹", name: "ボスミッション", desc: "ボスを たおす", goal: 5, key: "bossKills", xp: 200 },
];

// デイリーチャレンジ（日付で1つ選ばれる）
const DAILY_TEMPLATES = [
  { desc: "きょう もんだいに 20もん せいかいしよう", key: "correct", goal: 20, xp: 120 },
  { desc: "きょう てきを 60たい たおそう", key: "kills", goal: 60, xp: 120 },
  { desc: "きょう ステージを 1かい クリアしよう", key: "clears", goal: 1, xp: 100 },
  { desc: "きょう 8コンボを だそう", key: "maxCombo", goal: 8, xp: 150 },
  { desc: "きょう タワーを 8こ たてよう", key: "towersBuilt", goal: 8, xp: 100 },
];

// プレイヤーレベル：次のレベルに必要なXP
function xpForLevel(level) {
  return 100 + (level - 1) * 80;
}

// レベルによる開始コインボーナス
function levelCoinBonus(level) {
  return Math.min(150, (level - 1) * 8);
}
