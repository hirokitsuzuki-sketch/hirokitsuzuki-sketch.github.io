"use strict";

/* ============================================================
 * 算数クロスワード(Cross Math)
 * 3x3の数字マスを演算子でつなぎ、横・縦それぞれが正しい数式に
 * なるように空欄の数字を埋めるパズル。
 * ============================================================ */

const OPS = ["+", "-", "×", "÷"];

// 3x3盤面・単純消去法での解探索では、実測上5マス空欄が上限
// (6マス以上は現在のロジックではほぼ解けるパターンが見つからない)。
// 到達可能な範囲で3段階の難易度を分ける。
const DIFFICULTY = {
  easy: 2,
  normal: 3,
  hard: 5,
};

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randOp() {
  return OPS[randInt(0, OPS.length - 1)];
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function applyOp(a, op, b) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "×": return a * b;
    case "÷": return (b !== 0 && a % b === 0) ? a / b : null;
    default: return null;
  }
}

const OP_PRECEDENCE = { "×": 2, "÷": 2, "+": 1, "-": 1 };

/**
 * [a,b,c] を [op1,op2] で四則演算の優先順位(×÷が先)に従って評価する。
 * 途中計算も含め、負数・非整数・割り切れない場合は null。
 * 例: 1+7÷2 は 7÷2 を先に計算するため割り切れず null(このような
 * 「左から順に計算しないと成立しない式」は問題として採用されない)。
 */
function evalChain(nums, ops) {
  let result;
  if (OP_PRECEDENCE[ops[1]] > OP_PRECEDENCE[ops[0]]) {
    // 例: a + b × c → b×c を先に計算
    const right = applyOp(nums[1], ops[1], nums[2]);
    if (right === null || right < 0 || !Number.isInteger(right)) return null;
    result = applyOp(nums[0], ops[0], right);
  } else {
    const left = applyOp(nums[0], ops[0], nums[1]);
    if (left === null || left < 0 || !Number.isInteger(left)) return null;
    result = applyOp(left, ops[1], nums[2]);
  }
  if (result === null || result < 0 || !Number.isInteger(result)) return null;
  return result;
}

/** 3x3の数字・演算子・結果がすべて整合する盤面を作る(乱数リトライ方式) */
function generateSolvedGrid() {
  const MAX_TRIES = 20000;
  for (let t = 0; t < MAX_TRIES; t++) {
    const N = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) N[i][j] = randInt(1, 9);
    }

    const rowOp = [[randOp(), randOp()], [randOp(), randOp()], [randOp(), randOp()]];
    const colOp = [[randOp(), randOp()], [randOp(), randOp()], [randOp(), randOp()]];

    const R = [];
    let ok = true;
    for (let i = 0; i < 3; i++) {
      const r = evalChain(N[i], rowOp[i]);
      if (r === null) { ok = false; break; }
      R.push(r);
    }
    if (!ok) continue;

    const C = [];
    for (let j = 0; j < 3; j++) {
      const colNums = [N[0][j], N[1][j], N[2][j]];
      const c = evalChain(colNums, colOp[j]);
      if (c === null) { ok = false; break; }
      C.push(c);
    }
    if (!ok) continue;

    return { N, rowOp, colOp, R, C };
  }
  return null;
}

/**
 * blanks(空欄にする [i,j] の配列)が、論理的な絞り込みだけで
 * すべて一意に解けるかを検証する(ブルートフォースで候補を絞る)。
 */
function isDeducible(solved, blanks) {
  const { N, rowOp, colOp, R, C } = solved;
  const known = N.map((row, i) => row.map((v, j) =>
    blanks.some(([bi, bj]) => bi === i && bj === j) ? null : v
  ));

  let progress = true;
  let remaining = blanks.length;
  while (progress && remaining > 0) {
    progress = false;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (known[i][j] !== null) continue;
        const candidates = [];
        for (let v = 1; v <= 9; v++) {
          const rowOk = checkLine(known[i], rowOp[i], R[i], j, v);
          const colOk = checkLine([known[0][j], known[1][j], known[2][j]], colOp[j], C[j], i, v);
          if (rowOk !== false && colOk !== false) candidates.push(v);
        }
        if (candidates.length === 1) {
          known[i][j] = candidates[0];
          remaining--;
          progress = true;
        }
      }
    }
  }
  return remaining === 0;
}

/**
 * line(3要素、対象位置のみ仮に v を入れる)が ops で target になるか判定。
 * line 内に v を入れても他に null が残る場合は「まだ判定できない」= true 扱い。
 */
function checkLine(line, ops, target, idx, v) {
  const test = line.slice();
  test[idx] = v;
  if (test.some((x) => x === null)) return true; // 未確定なので制約なし
  return evalChain(test, ops) === target;
}

/** 難易度に応じて空欄パターンを決め、論理的に解ける盤面を1つ作る */
function generatePuzzle(difficultyKey) {
  const targetBlanks = DIFFICULTY[difficultyKey] ?? DIFFICULTY.normal;
  const allCells = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) allCells.push([i, j]);

  for (let attempt = 0; attempt < 200; attempt++) {
    const solved = generateSolvedGrid();
    if (!solved) continue;
    for (let k = targetBlanks; k >= 1; k--) {
      for (let tries = 0; tries < 300; tries++) {
        const blanks = shuffle(allCells).slice(0, k);
        if (isDeducible(solved, blanks)) {
          return { solved, blanks };
        }
      }
    }
  }
  return null;
}

/* ============================================================ */

const state = {
  solved: null,
  blanks: [],
  difficulty: "normal",
  startedAt: 0,
  timerId: null,
  solvedCount: 0,
};

const gridEl = document.getElementById("grid");
const timeEl = document.getElementById("time");
const messageEl = document.getElementById("message");
const solvedCountEl = document.getElementById("solved-count");
const difficultyButtons = document.querySelectorAll(".diff-btn");
const newPuzzleBtn = document.getElementById("new-puzzle");
const checkBtn = document.getElementById("check");
const hintBtn = document.getElementById("hint");

function isBlank(i, j) {
  return state.blanks.some(([bi, bj]) => bi === i && bj === j);
}

function buildCellPlan() {
  // 7x7の概念グリッド。type: number-given / number-blank / op / eq / result / filler
  const cells = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      cells.push(classifyCell(r, c));
    }
  }
  return cells;
}

function classifyCell(r, c) {
  const isNumRow = r === 0 || r === 2 || r === 4;
  const isNumCol = c === 0 || c === 2 || c === 4;

  if (isNumRow && isNumCol) {
    const i = r / 2, j = c / 2;
    const blank = isBlank(i, j);
    return { r, c, type: blank ? "number-blank" : "number-given", i, j, value: state.solved.N[i][j] };
  }
  if (isNumRow && (c === 1 || c === 3)) {
    const i = r / 2;
    const k = (c - 1) / 2;
    return { r, c, type: "op", value: state.solved.rowOp[i][k] };
  }
  if (isNumCol && (r === 1 || r === 3)) {
    const j = c / 2;
    const k = (r - 1) / 2;
    return { r, c, type: "op", value: state.solved.colOp[j][k] };
  }
  if (isNumRow && c === 5) {
    return { r, c, type: "eq" };
  }
  if (isNumRow && c === 6) {
    const i = r / 2;
    return { r, c, type: "result", value: state.solved.R[i] };
  }
  if (isNumCol && r === 5) {
    return { r, c, type: "eq" };
  }
  if (isNumCol && r === 6) {
    const j = c / 2;
    return { r, c, type: "result", value: state.solved.C[j] };
  }
  return { r, c, type: "filler" };
}

function renderGrid() {
  gridEl.innerHTML = "";
  const cells = buildCellPlan();
  for (const cell of cells) {
    const el = document.createElement("div");
    el.className = "cell cell-" + cell.type;
    el.style.gridRowStart = cell.r + 1;
    el.style.gridColumnStart = cell.c + 1;

    switch (cell.type) {
      case "number-given":
        el.textContent = String(cell.value);
        break;
      case "number-blank": {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 2;
        input.className = "cell-input";
        input.dataset.i = cell.i;
        input.dataset.j = cell.j;
        input.addEventListener("input", () => {
          input.value = input.value.replace(/[^0-9]/g, "").slice(0, 2);
          el.classList.remove("correct", "incorrect");
        });
        el.appendChild(input);
        break;
      }
      case "op":
        el.textContent = cell.value;
        break;
      case "eq":
        el.textContent = "=";
        break;
      case "result":
        el.textContent = String(cell.value);
        el.classList.add("result-badge");
        break;
      case "filler":
        break;
    }
    gridEl.appendChild(el);
  }
}

function startTimer() {
  stopTimer();
  state.startedAt = Date.now();
  state.timerId = setInterval(() => {
    const sec = Math.floor((Date.now() - state.startedAt) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    timeEl.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

function newPuzzle() {
  messageEl.textContent = "";
  messageEl.className = "message";
  const puzzle = generatePuzzle(state.difficulty);
  if (!puzzle) {
    messageEl.textContent = "パズルの生成に失敗しました。もう一度お試しください。";
    messageEl.className = "message error";
    return;
  }
  state.solved = puzzle.solved;
  state.blanks = puzzle.blanks;
  renderGrid();
  startTimer();
}

function checkAnswers() {
  const inputs = gridEl.querySelectorAll(".cell-input");
  let allFilled = true;
  let allCorrect = true;
  inputs.forEach((input) => {
    const i = Number(input.dataset.i);
    const j = Number(input.dataset.j);
    const cellEl = input.parentElement;
    cellEl.classList.remove("correct", "incorrect");
    if (input.value === "") {
      allFilled = false;
      return;
    }
    const correct = Number(input.value) === state.solved.N[i][j];
    cellEl.classList.add(correct ? "correct" : "incorrect");
    if (!correct) allCorrect = false;
  });

  if (!allFilled) {
    messageEl.textContent = "空いているマスをすべて埋めてね";
    messageEl.className = "message";
    return;
  }
  if (allCorrect) {
    stopTimer();
    state.solvedCount++;
    solvedCountEl.textContent = String(state.solvedCount);
    messageEl.textContent = `せいかい！ ${timeEl.textContent} でクリア`;
    messageEl.className = "message success";
  } else {
    messageEl.textContent = "まちがいがあるよ。赤いマスを見直してね";
    messageEl.className = "message error";
  }
}

function giveHint() {
  const inputs = Array.from(gridEl.querySelectorAll(".cell-input")).filter((el) => el.value === "");
  if (inputs.length === 0) return;
  const target = inputs[randInt(0, inputs.length - 1)];
  const i = Number(target.dataset.i);
  const j = Number(target.dataset.j);
  target.value = String(state.solved.N[i][j]);
  target.parentElement.classList.add("correct");
}

difficultyButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    difficultyButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.difficulty = btn.dataset.diff;
    newPuzzle();
  });
});

newPuzzleBtn.addEventListener("click", newPuzzle);
checkBtn.addEventListener("click", checkAnswers);
hintBtn.addEventListener("click", giveHint);

newPuzzle();
