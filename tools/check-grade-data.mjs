// ドリル用 data-gradeN.js の整合性チェック
// 使い方: node tools/check-grade-data.mjs 1 80
import { readFileSync } from "node:fs";
import vm from "node:vm";

const grade = process.argv[2];
const expected = parseInt(process.argv[3], 10);
const src = readFileSync(new URL(`../js/data-grade${grade}.js`, import.meta.url), "utf8");
let exported = {};
const ctx = { __export: (obj) => { exported = obj; } };
vm.createContext(ctx);
vm.runInContext(src + "\n;__export({KANJI_DATA, CATEGORIES, ALL_QUESTIONS, EXTRA_KANJI: typeof EXTRA_KANJI === 'undefined' ? {} : EXTRA_KANJI, STORAGE_KEY});", ctx);

const { KANJI_DATA, CATEGORIES, ALL_QUESTIONS, EXTRA_KANJI, STORAGE_KEY } = exported;

// 学習指導要領の配当漢字（正式リスト、2020年度以降）との照合。
// 出典: Wikipedia「学年別漢字配当表」で全学年を照合済み（2026-07-05）
const CANONICAL = {
  "1": "一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六",
  "2": "引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話",
  "3": "悪安暗医委意育員院飲運泳駅央横屋温化荷界開階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿所暑助昭消商章勝乗植申身神真深進世整昔全相送想息速族他打対待代第題炭短談着注柱丁帳調追定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒病品負部服福物平返勉放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和",
  "4": "愛案以衣位茨印英栄媛塩岡億加果貨課芽賀改械害街各覚潟完官管関観願岐希季旗器機議求泣給挙漁共協鏡競極熊訓軍郡群径景芸欠結建健験固功好香候康佐差菜最埼材崎昨札刷察参産散残氏司試児治滋辞鹿失借種周祝順初松笑唱焼照城縄臣信井成省清静席積折節説浅戦選然争倉巣束側続卒孫帯隊達単置仲沖兆低底的典伝徒努灯働特徳栃奈梨熱念敗梅博阪飯飛必票標不夫付府阜富副兵別辺変便包法望牧末満未民無約勇要養浴利陸良料量輪類令冷例連老労録",
  "5": "圧囲移因永営衛易益液演応往桜可仮価河過快解格確額刊幹慣眼紀基寄規喜技義逆久旧救居許境均禁句型経潔件険検限現減故個護効厚耕航鉱構興講告混査再災妻採際在財罪殺雑酸賛士支史志枝師資飼示似識質舎謝授修述術準序招証象賞条状常情織職制性政勢精製税責績接設絶祖素総造像増則測属率損貸態団断築貯張停提程適統堂銅導得毒独任燃能破犯判版比肥非費備評貧布婦武復複仏粉編弁保墓報豊防貿暴脈務夢迷綿輸余容略留領歴",
  "6": "胃異遺域宇映延沿恩我灰拡革閣割株干巻看簡危机貴揮疑吸供胸郷勤筋系敬警劇激穴絹券権憲源厳己呼誤后孝皇紅降鋼刻穀骨困砂座済裁策冊蚕至私姿視詞誌磁射捨尺若樹収宗就衆従縦縮熟純処署諸除承将傷障蒸針仁垂推寸盛聖誠舌宣専泉洗染銭善奏窓創装層操蔵臓存尊退宅担探誕段暖値宙忠著庁頂腸潮賃痛敵展討党糖届難乳認納脳派拝背肺俳班晩否批秘俵腹奮並陛閉片補暮宝訪亡忘棒枚幕密盟模訳郵優預幼欲翌乱卵覧裏律臨朗論",
};
const kanjiKeys = Object.keys(KANJI_DATA);
const qAns = ALL_QUESTIONS.map(q => q.ans);
const uniqueAns = new Set(qAns);
const errors = [];

// 0. 正式配当リストとの照合（リストがある学年のみ）
if (CANONICAL[grade]) {
  const canon = new Set(CANONICAL[grade]);
  if (canon.size !== expected) errors.push(`内蔵の正式リスト自体が ${canon.size} 字（期待 ${expected}）`);
  for (const k of kanjiKeys) if (!canon.has(k)) errors.push(`配当外の漢字が混入: ${k}`);
  for (const k of canon) if (!KANJI_DATA[k]) errors.push(`配当漢字が欠落: ${k}`);
}

// 1. 字数（配当外の復習問題は許容し、配当漢字のカバー数で判定する）
if (kanjiKeys.length !== expected) errors.push(`KANJI_DATA が ${kanjiKeys.length} 字（期待 ${expected}）`);
const canonSet = CANONICAL[grade] ? new Set(CANONICAL[grade]) : null;
const covered = canonSet ? [...uniqueAns].filter(a => canonSet.has(a)).length : uniqueAns.size;
if (covered !== expected) errors.push(`配当漢字のうち問題があるのは ${covered} 字（期待 ${expected}）`);

// 2. KANJI_DATA と問題の対応
for (const k of kanjiKeys) if (!uniqueAns.has(k)) errors.push(`問題がない漢字: ${k}`);
for (const a of uniqueAns) if (!KANJI_DATA[a] && !(EXTRA_KANJI || {})[a]) errors.push(`データがない正解: ${a}`);

// 3. カテゴリ keys の整合
const catKanji = new Set();
for (const c of CATEGORIES) {
  for (const k of c.keys) {
    if (!KANJI_DATA[k] && !(EXTRA_KANJI || {})[k]) errors.push(`cat${c.id} keys にデータなし: ${k}`);
    catKanji.add(k);
  }
}
for (const k of kanjiKeys) if (!catKanji.has(k)) errors.push(`どのカテゴリにも入っていない: ${k}`);

// 4. 問題の cat id が存在するか / 穴埋めマーカー
const catIds = new Set(CATEGORIES.map(c => c.id));
for (const q of ALL_QUESTIONS) {
  if (!catIds.has(q.cat)) errors.push(`不明な cat: ${JSON.stringify(q)}`);
  if (!q.q.includes("〔　〕")) errors.push(`〔　〕がない問題: ${q.q}`);
  if (!q.yomi || !q.hint) errors.push(`yomi/hint 欠落: ${q.ans}`);
}

// 5. STORAGE_KEY
if (!STORAGE_KEY || !STORAGE_KEY.includes(grade === "2" ? "kanji_" : `kanji${grade}_`))
  errors.push(`STORAGE_KEY が不正: ${STORAGE_KEY}`);

if (errors.length) {
  console.log(`NG grade${grade}:`);
  for (const e of errors) console.log("  - " + e);
  process.exit(1);
}
console.log(`OK grade${grade}: 漢字${kanjiKeys.length}字 / 問題${ALL_QUESTIONS.length}問 / カテゴリ${CATEGORIES.length} / key=${STORAGE_KEY}`);
