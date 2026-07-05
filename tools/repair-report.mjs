// 修繕用レポート: 学年ごとに「余分な字 / 欠落字 / 問題がない字」を圧縮表示
import { readFileSync } from "node:fs";
import vm from "node:vm";

const CANONICAL = {
  "2": "引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話",
  "3": "悪安暗医委意育員院飲運泳駅央横屋温化荷界開階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿所暑助昭消商章勝乗植申身神真深進世整昔全相送想息速族他打対待代第題炭短談着注柱丁帳調追定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒病品負部服福物平返勉放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和",
  "4": "愛案以衣位茨印英栄媛塩岡億加果貨課芽賀改械害街各覚潟完官管関観願岐希季旗器機議求泣給挙漁共協鏡競極熊訓軍郡群径景芸欠結建健験固功好香候康佐差菜最埼材崎昨札刷察参産散残氏司試児治滋辞鹿失借種周祝順初松笑唱焼照城縄臣信井成省清静席積折節説浅戦選然争倉巣束側続卒孫帯隊達単置仲沖兆低底的典伝徒努灯働特徳栃奈梨熱念敗梅博阪飯飛必票標不夫付府阜富副兵別辺変便包法望牧末満未民無約勇要養浴利陸良料量輪類令冷例連老労録",
};

for (const grade of ["2", "3", "4"]) {
  const src = readFileSync(new URL(`../js/data-grade${grade}.js`, import.meta.url), "utf8");
  let ex = {};
  const ctx = { __export: (o) => { ex = o; } };
  vm.createContext(ctx);
  vm.runInContext(src + "\n;__export({KANJI_DATA, ALL_QUESTIONS, CATEGORIES, EXTRA_KANJI: typeof EXTRA_KANJI==='undefined'?{}:EXTRA_KANJI});", ctx);
  const canon = new Set(CANONICAL[grade]);
  const keys = new Set(Object.keys(ex.KANJI_DATA));
  const qAns = new Set(ex.ALL_QUESTIONS.map(q => q.ans));
  const extraKeys = Object.keys(ex.KANJI_DATA).filter(k => !canon.has(k));
  const missingData = [...canon].filter(k => !keys.has(k));
  const noQuestion = [...canon].filter(k => !qAns.has(k));
  const badAns = [...qAns].filter(a => !canon.has(a));
  console.log(`=== grade${grade} (KANJI_DATA:${keys.size} / uniqQ:${qAns.size} / cats:${ex.CATEGORIES.length}) ===`);
  console.log(`配当外のKANJI_DATAキー(${extraKeys.length}): ${extraKeys.join("")}`);
  console.log(`KANJI_DATA欠落(${missingData.length}): ${missingData.join("")}`);
  console.log(`問題がない字(${noQuestion.length}): ${noQuestion.join("")}`);
  console.log(`配当外の正解(${badAns.length}): ${badAns.join(" / ")}`);
}
