// ドリル用マスターデータ（js/data-grade{1,5,6}.js）から
//   1. 漢字タワーディフェンス用の追加 QDATA（kanji-td/js/data/questions-data-extra.js）
//   2. 漢字サバイバー用の4択クイズ JSON（../godot/data/kanji/grade{1,5,6}.json）
// を機械生成する。マスターデータを直したら再実行するだけでよい。
import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";

const GRADES = ["1", "5", "6"];

function loadGrade(grade) {
  const src = readFileSync(new URL(`../js/data-grade${grade}.js`, import.meta.url), "utf8");
  let exported = {};
  const ctx = { __export: (o) => { exported = o; } };
  vm.createContext(ctx);
  vm.runInContext(src + "\n;__export({KANJI_DATA});", ctx);
  return exported.KANJI_DATA;
}

// 決定的な擬似乱数（生成結果を再現可能にする）
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWrongs(rand, pool, n, exclude) {
  const cand = pool.filter(x => !exclude.includes(x));
  const out = [];
  while (out.length < n && cand.length > 0) {
    const i = Math.floor(rand() * cand.length);
    out.push(cand.splice(i, 1)[0]);
  }
  return out;
}

// ---------- 1. kanji-td 用 ----------
let tdOut = `/* 自動生成ファイル — 編集しないこと
   生成元: js/data-grade{1,5,6}.js
   再生成: node tools/generate-grade-data.mjs
   1・5・6年生の漢字カード（読み・意味から自動出題）。部首・画数は未設定(null)のため
   ぶしゅ・かくすう問題は自動的にスキップされる。 */\n`;

// ---------- 2. サバイバー用 ----------
for (const grade of GRADES) {
  const data = loadGrade(grade);
  const entries = Object.entries(data).map(([k, [yomi, imi]]) => ({
    k, y: yomi.split("・"), m: imi,
  }));

  // --- TD: QDATA へ追加するブロック ---
  const cards = entries.map(e =>
    `      { k: ${JSON.stringify(e.k)}, y: ${JSON.stringify(e.y)}, m: ${JSON.stringify(e.m)}, b: null, s: null }`
  ).join(",\n");
  tdOut += `\nQDATA[${JSON.stringify(grade)}] = {\n  kanji: [\n${cards}\n  ],\n` +
    `  okurigana: [], jukugoYomi: [], jukugoFill: [], homophone: [], taigi: [], strokeFacts: [],\n};\n`;

  // --- サバイバー: yomi / kaki の4択問題 ---
  const rand = mulberry32(20260705 + Number(grade));
  const readings = entries.map(e => e.y[0]);
  const kanjis = entries.map(e => e.k);
  const questions = [];
  entries.forEach((e, i) => {
    // yomi: 「漢字」の読みは？
    const wrongY = pickWrongs(rand, readings, 3, e.y);
    questions.push({
      id: `g${grade}_y_${String(i + 1).padStart(3, "0")}`,
      grade: Number(grade),
      level: i % 2 === 0 ? 1 : 2,
      type: "yomi",
      question: `「${e.k}」の読みは？`,
      choices: [e.y[0], ...wrongY],
      answer: 0,
    });
    // kaki: 読み→漢字（同じ読みを持つ字は誤答にしない）
    const sameReading = entries.filter(o => o.y.includes(e.y[0])).map(o => o.k);
    const wrongK = pickWrongs(rand, kanjis, 3, sameReading);
    questions.push({
      id: `g${grade}_k_${String(i + 1).padStart(3, "0")}`,
      grade: Number(grade),
      level: i % 2 === 0 ? 2 : 3,
      type: "kaki",
      question: `「${e.y[0]}」と読む漢字は？`,
      choices: [e.k, ...wrongK],
      answer: 0,
    });
  });
  const json = "[\n" + questions.map(q => JSON.stringify(q)).join(",\n") + "\n]\n";
  const outPath = new URL(`../../godot/data/kanji/grade${grade}.json`, import.meta.url);
  writeFileSync(outPath, json);
  console.log(`survivor grade${grade}: ${questions.length}問 -> ${outPath.pathname}`);
}

writeFileSync(new URL("../kanji-td/js/data/questions-data-extra.js", import.meta.url), tdOut);
console.log("kanji-td: questions-data-extra.js を生成");
