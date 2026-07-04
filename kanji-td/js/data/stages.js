/* =========================================================
   ステージ定義
   ---------------------------------------------------------
   path  : 敵の通り道（セル座標 [列, 行]。盤面は 16列 × 9行）
           最初の点は画面外（-1）から、最後は画面外（16）へ抜ける
   hpMul : このステージの敵HP倍率
   waves : ウェーブごとの出現リスト
           { t:敵ID, n:体数, gap:出現間隔秒, delay:ウェーブ開始からの遅れ秒 }
   theme : 背景・道の色とかざり
   ========================================================= */

const STAGES = [
  {
    id: 1, name: "草原", emoji: "🌾", sub: "はじまりの平原",
    hpMul: 1.0, startCoins: 230, baseHp: 20,
    theme: {
      bg1: "#2d4a22", bg2: "#3a5c2c", path: "#a8834f", pathEdge: "#7a5c33",
      deco: ["🌲", "🌳", "🌼", "🍄"],
    },
    path: [[-1, 4], [3, 4], [3, 1], [8, 1], [8, 7], [12, 7], [12, 3], [16, 3]],
    waves: [
      [{ t: "slime", n: 6, gap: 1.1 }],
      [{ t: "slime", n: 9, gap: 0.9 }],
      [{ t: "slime", n: 6, gap: 0.9 }, { t: "wolf", n: 3, gap: 0.8, delay: 5 }],
      [{ t: "wolf", n: 6, gap: 0.7 }, { t: "slime", n: 6, gap: 0.9, delay: 3 }],
      [{ t: "knight", n: 4, gap: 1.4 }, { t: "slime", n: 8, gap: 0.7, delay: 2 }],
      [{ t: "bat", n: 6, gap: 0.9 }, { t: "wolf", n: 4, gap: 0.7, delay: 4 }],
      [{ t: "golem", n: 2, gap: 3 }, { t: "knight", n: 4, gap: 1.2, delay: 2 }, { t: "bat", n: 4, gap: 0.8, delay: 6 }],
      [{ t: "boss", n: 1, gap: 1 }, { t: "slime", n: 10, gap: 0.8, delay: 3 }],
    ],
  },
  {
    id: 2, name: "洞窟", emoji: "🕳️", sub: "くらやみの迷宮",
    hpMul: 1.4, startCoins: 250, baseHp: 20,
    theme: {
      bg1: "#241f33", bg2: "#2e2842", path: "#55496b", pathEdge: "#3c3350",
      deco: ["🪨", "💎", "🕸️", "🍄"],
    },
    path: [[-1, 1], [5, 1], [5, 5], [2, 5], [2, 8], [10, 8], [10, 2], [14, 2], [14, 6], [16, 6]],
    waves: [
      [{ t: "slime", n: 8, gap: 0.9 }, { t: "bat", n: 3, gap: 1, delay: 4 }],
      [{ t: "bat", n: 7, gap: 0.8 }],
      [{ t: "knight", n: 5, gap: 1.2 }, { t: "slime", n: 6, gap: 0.8, delay: 3 }],
      [{ t: "wolf", n: 8, gap: 0.6 }],
      [{ t: "bat", n: 8, gap: 0.7 }, { t: "knight", n: 4, gap: 1.3, delay: 3 }],
      [{ t: "golem", n: 3, gap: 2.5 }, { t: "bat", n: 5, gap: 0.8, delay: 4 }],
      [{ t: "knight", n: 7, gap: 1 }, { t: "wolf", n: 6, gap: 0.6, delay: 4 }],
      [{ t: "golem", n: 3, gap: 2 }, { t: "bat", n: 8, gap: 0.6, delay: 3 }],
      [{ t: "dragon", n: 1, gap: 1 }, { t: "bat", n: 8, gap: 0.9, delay: 3 }],
    ],
  },
  {
    id: 3, name: "火山", emoji: "🌋", sub: "もえさかる大地",
    hpMul: 1.9, startCoins: 270, baseHp: 20,
    theme: {
      bg1: "#3a1a12", bg2: "#4a2416", path: "#6e3a24", pathEdge: "#502a18",
      deco: ["🌋", "🔥", "🪨", "💀"],
    },
    path: [[-1, 7], [4, 7], [4, 3], [1, 3], [1, 0.5], [8, 0.5], [8, 5], [13, 5], [13, 1], [16, 1]],
    waves: [
      [{ t: "slime", n: 10, gap: 0.8 }],
      [{ t: "knight", n: 6, gap: 1.1 }],
      [{ t: "golem", n: 3, gap: 2.2 }, { t: "wolf", n: 6, gap: 0.6, delay: 3 }],
      [{ t: "bat", n: 10, gap: 0.6 }],
      [{ t: "knight", n: 6, gap: 1 }, { t: "golem", n: 2, gap: 3, delay: 2 }],
      [{ t: "wolf", n: 12, gap: 0.5 }],
      [{ t: "golem", n: 4, gap: 2 }, { t: "bat", n: 6, gap: 0.7, delay: 4 }],
      [{ t: "knight", n: 8, gap: 0.9 }, { t: "wolf", n: 8, gap: 0.5, delay: 5 }],
      [{ t: "golem", n: 5, gap: 1.8 }, { t: "bat", n: 8, gap: 0.6, delay: 3 }],
      [{ t: "boss", n: 1, gap: 1 }, { t: "knight", n: 6, gap: 1.2, delay: 4 }, { t: "bat", n: 6, gap: 0.8, delay: 8 }],
    ],
  },
  {
    id: 4, name: "雪山", emoji: "🏔️", sub: "こごえる白銀",
    hpMul: 2.5, startCoins: 290, baseHp: 20,
    theme: {
      bg1: "#2a3b52", bg2: "#37496a", path: "#c9d6e8", pathEdge: "#93a8c4",
      deco: ["🌨️", "⛄", "🌲", "🧊"],
    },
    path: [[-1, 0.5], [6, 0.5], [6, 4], [2, 4], [2, 7.5], [9, 7.5], [9, 3], [13, 3], [13, 7], [16, 7]],
    waves: [
      [{ t: "wolf", n: 8, gap: 0.7 }],
      [{ t: "slime", n: 10, gap: 0.7 }, { t: "wolf", n: 5, gap: 0.6, delay: 4 }],
      [{ t: "knight", n: 7, gap: 1 }],
      [{ t: "wolf", n: 10, gap: 0.5 }, { t: "bat", n: 5, gap: 0.8, delay: 3 }],
      [{ t: "golem", n: 4, gap: 2 }],
      [{ t: "bat", n: 12, gap: 0.5 }],
      [{ t: "wolf", n: 10, gap: 0.45 }, { t: "knight", n: 5, gap: 1.1, delay: 3 }],
      [{ t: "golem", n: 4, gap: 1.8 }, { t: "wolf", n: 8, gap: 0.5, delay: 4 }],
      [{ t: "knight", n: 10, gap: 0.8 }, { t: "bat", n: 8, gap: 0.6, delay: 5 }],
      [{ t: "dragon", n: 1, gap: 1 }, { t: "wolf", n: 10, gap: 0.6, delay: 3 }],
    ],
  },
  {
    id: 5, name: "城", emoji: "🏰", sub: "まおうの居城",
    hpMul: 3.3, startCoins: 320, baseHp: 20,
    theme: {
      bg1: "#2e2438", bg2: "#3a2d47", path: "#8a7a96", pathEdge: "#5f5370",
      deco: ["🏰", "⚔️", "🕯️", "🦴"],
    },
    path: [[-1, 4], [2, 4], [2, 1], [7, 1], [7, 7.5], [4, 7.5], [4, 5], [11, 5], [11, 1], [14, 1], [14, 8], [16, 8]],
    waves: [
      [{ t: "slime", n: 12, gap: 0.6 }],
      [{ t: "knight", n: 8, gap: 0.9 }],
      [{ t: "wolf", n: 12, gap: 0.45 }],
      [{ t: "golem", n: 5, gap: 1.8 }],
      [{ t: "bat", n: 14, gap: 0.45 }],
      [{ t: "knight", n: 8, gap: 0.8 }, { t: "wolf", n: 8, gap: 0.5, delay: 4 }],
      [{ t: "boss", n: 1, gap: 1 }, { t: "slime", n: 10, gap: 0.7, delay: 3 }],
      [{ t: "golem", n: 6, gap: 1.5 }, { t: "bat", n: 8, gap: 0.6, delay: 4 }],
      [{ t: "wolf", n: 14, gap: 0.4 }, { t: "knight", n: 6, gap: 0.9, delay: 4 }],
      [{ t: "dragon", n: 1, gap: 1 }, { t: "golem", n: 4, gap: 2, delay: 4 }],
      [{ t: "knight", n: 10, gap: 0.7 }, { t: "bat", n: 10, gap: 0.5, delay: 4 }, { t: "golem", n: 3, gap: 2.5, delay: 8 }],
      [{ t: "boss", n: 1, gap: 1 }, { t: "dragon", n: 1, gap: 1, delay: 8 }, { t: "wolf", n: 10, gap: 0.6, delay: 3 }],
    ],
  },
];

// 盤面のサイズ（論理座標）
const GRID = { cols: 16, rows: 9, cell: 60, w: 960, h: 540 };

// ウェーブが進むごとの敵HP追加倍率
const WAVE_HP_RAMP = 0.12;
