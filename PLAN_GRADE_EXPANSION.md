# 修正計画 — 学年グレード拡張（1年・5年・6年の追加）

作成日: 2026-07-05
**状況: 全工程 完了（2026-07-05）。** 手順1〜7まで実施済み。マスターデータを直す場合は
`node tools/check-grade-data.mjs <学年> <字数>` で検証し、`node tools/generate-grade-data.mjs` で再生成する。
対象リポジトリ: `hirokitsuzuki-sketch.github.io`（漢字ラボ本体）+ `godot`（漢字サバイバー）

## 目的

1. **漢字サバイバー**: 学年別の難易度（出題学年）を 1〜6年生 + おまかせ で切り替え可能にする
2. **漢字ラボの全コンテンツ**（漢字ドリル / 漢字タワーディフェンス / 漢字サバイバー）に **1年生・5年生・6年生** のグレードを追加する

対象漢字数（学習指導要領の配当漢字）:
| 学年 | 字数 |
|---|---|
| 1年生 | 80字 |
| 5年生 | 193字 |
| 6年生 | 191字 |

## 現状の構造と必要な変更

### A. 漢字ドリル（柊くんの漢字マスター）
- 実体: `grade{2,3,4}.html` + `js/data-grade{2,3,4}.js` + 共通 `js/kanji-app.js`
- データ形式（学年ごとに1ファイル）:
  - `KANJI_DATA`: `漢字 → [読み, 意味, 使い方の例]`
  - `CATEGORIES`: テーマ別カテゴリ（id/name/emoji/color/keys）
  - `ALL_QUESTIONS`: `{cat, q(穴埋め文), ans(漢字), yomi, hint}` の配列
  - `EXTRA_KANJI` / `STORAGE_KEY`（localStorage キーは学年ごとに固有）
- **変更**: `data-grade{1,5,6}.js` と `grade{1,5,6}.html` を新規作成。`index.html` にカード3枚と進捗表示を追加

### B. 漢字タワーディフェンス（kanji-td）
- 問題データ: `js/data/questions-data.js` の `QDATA = {"2":…,"3":…,"4":…}`
  - 各学年 `kanji: [{k,y,m,b,s}]`（読み/意味/部首/画数から問題を自動生成）+ 任意の追加問題種別
- 学年選択: `js/ui/screens.js` の `["2","3","4","mix"]` チップ、`js/core/quiz.js` の `gradePool()`（mix=["2","3","4"]）、図鑑タブ
- **変更**: `QDATA` に `"1","5","6"` を追加、学年チップ/ミックス/図鑑タブを6学年対応に

### C. 漢字サバイバー（godot リポジトリ）
- 問題データ: `data/kanji/grade{2,3,4}.json`（4択クイズ形式 `{id,grade,level,type,question,choices,answer}`）
- 学年設定: メニューの切替ボタン（`main_menu.gd` の order `[0,2,3,4]`）→ `quiz_engine.gd` が `SaveGame.data.settings.grade` を参照
- **変更**:
  - `data/kanji/grade{1,5,6}.json` を追加
  - `data_store.gd`: 読込学年 `[2,3,4]` → `[1,2,3,4,5,6]`
  - `quiz_engine.gd`: おまかせ=`[2,3,4]` → 全学年、上位学年ミックスの上限 `<4` → `<6`
  - `main_menu.gd`: 切替 order を `[0,1,2,3,4,5,6]` に
  - `collection_screen.gd`: 図鑑の学年ループを 1〜6 に
  - Web を再ビルドして `kanji-survivor/` に再配置

## 実施方針 — マスターデータ1本 + 自動生成

3コンテンツで同じ漢字情報（読み・意味・例語）を使うため、**手書きするのはドリル用データ（A）だけ**にし、
残り2形式は Node スクリプトで機械変換して生成する:

```
js/data-grade{1,5,6}.js  （手書き・マスター）
        │  tools/generate-grade-data.mjs（新規・Node）
        ├─→ kanji-td 用 QDATA の "1","5","6" ブロック（{k,y,m,b:null,s:null} 形式）
        └─→ サバイバー用 data/kanji/grade{1,5,6}.json
             （yomi型: 「漢字」の読みは？ / kaki型: 読み→漢字。誤答は同学年の他の漢字から自動選出）
```

- TD の部首(b)・画数(s)は当面 null（nullで問題種別から自動除外される設計）
- サバイバーの level(難易度1〜3)は読みの複雑さ（読み数・文字数）で機械割当
- 1問ごとの手書き穴埋め文はドリルの `ALL_QUESTIONS` にのみ必要（1漢字1問 + カテゴリ分け）

## 作業手順

1. ✅ この計画を保存
2. マスターデータ作成（手書き）: `js/data-grade1.js`（80字）→ `data-grade5.js`（193字）→ `data-grade6.js`（191字）
3. ドリルページ: `grade{1,5,6}.html` 作成、`index.html` にカード・進捗を追加
4. 生成スクリプト `tools/generate-grade-data.mjs` 作成 → TD/サバイバー用データを生成
5. TD の学年セレクター・mix・図鑑を6学年対応に修正
6. サバイバー（godot）の4ファイル修正 + 生成JSONを配置 → headless検証 → Web再ビルド → `kanji-survivor/` 更新
7. 両リポジトリをコミット & push

## 検証

- ドリル: 各学年ページで カテゴリ表示 / 出題 / 答え合わせ / 進捗保存（localStorageキーが学年ごとに独立していること）
- TD: 学年チップ 1〜6 + ミックスで問題が出ること（ブラウザで目視）
- サバイバー: `--headless --quit-after N -- --autostart` でエラーゼロ、DataStore の読込件数ログに grade1/5/6 が出ること
- 漢字リストの字数チェック: 1年=80 / 5年=193 / 6年=191 をスクリプトで機械検証

## リスク・注意

- 配当漢字リストの正確性が最重要（誤字・学年違いは学習コンテンツとして致命的）→ 字数の機械チェック + 生成前に重複チェックを入れる
- 5・6年生は抽象語が多く、例文の言い回しが難しくなりすぎないよう注意（対象はあくまで小学生）
- ドリルの localStorage キーは `kanji_state`(2年)/`kanji3_state`/`kanji4_state` が既存。新学年は `kanji1_state`/`kanji5_state`/`kanji6_state` で統一
