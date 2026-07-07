let state = {
  currentCat: null, currentQuestions: [], revealed: false,
  scores: {}, learnedKanji: new Set(), writingMode: 0, eraserMode: {},
  wrongList: [], lastWrong: [], currentTitle: '',
  catStars: {}, weak: {}, mastery: {}
};
let answeredCount = 0, correctCount = 0, streak = 0, lastPct = -1;

window.addEventListener('DOMContentLoaded', () => {
  loadState(); loadDaily(); loadBadges(); loadTimeData(); loadXp(); loadQuick();
  renderDailyPanel(); renderBadgeRow(); renderTimePanel();
  renderCatGrid(); renderKanjiGrid(); updateGlobalProgress();
  setupTimeTracking();
  if (typeof KSound !== 'undefined') { KSound.init(); setupSoundControls(); }
  greetComeback();
});

// おかえりメッセージ（その日はじめての訪問時に1回だけ）
function greetComeback(){
  try{
    if(sessionStorage.getItem('kanji_greeted')) return;
    const isReturning = xpData.xp>0 || daily.lastDate;
    if(!isReturning || daily.lastDate===dayKey(new Date())) return;
    sessionStorage.setItem('kanji_greeted','1');
    setTimeout(()=>{
      const w=Object.keys(state.weak).length;
      showToast(w>0?`おかえり！🩹 にがての ${w}字が まっているよ`:'おかえり！🎯 きょうも 10問 がんばろう！');
    },800);
  }catch(e){}
}

/* =========================================================
   勉強時間の記録（全学年共通・localStorage）
   ---------------------------------------------------------
   5秒ごとに「画面が見えている ＆ 60秒以内に操作があった」時だけ
   勉強時間として加算する（開きっぱなしは数えない）。
   日別に秒数と解いた問題数を保存し、直近7日をグラフ表示。
   ========================================================= */
const TIME_KEY = 'kanji_time_v1';
const TIME_TICK = 5;        // 加算間隔（秒）
const TIME_IDLE = 60000;    // この時間(ms)操作がなければ休憩とみなす
const TIME_KEEP_DAYS = 60;  // 保持する日数
let timeData = null, lastActivity = Date.now();

function loadTimeData() {
  try { timeData = JSON.parse(localStorage.getItem(TIME_KEY)); } catch (e) { timeData = null; }
  if (!timeData || typeof timeData !== 'object' || !timeData.days) timeData = { days: {}, total: 0 };
}

function saveTimeData() {
  const keys = Object.keys(timeData.days);
  if (keys.length > TIME_KEEP_DAYS) {
    keys.sort((a, b) => new Date(a) - new Date(b))
        .slice(0, keys.length - TIME_KEEP_DAYS)
        .forEach(k => delete timeData.days[k]);
  }
  try { localStorage.setItem(TIME_KEY, JSON.stringify(timeData)); } catch (e) {}
}

function timeRec(k) { return timeData.days[k] || (timeData.days[k] = { sec: 0, solved: 0 }); }

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return m + '分';
  return Math.floor(m / 60) + '時間' + (m % 60 > 0 ? (m % 60) + '分' : '');
}

function setupTimeTracking() {
  ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev =>
    document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (document.hidden) return;
    if (Date.now() - lastActivity > TIME_IDLE) return;
    const r = timeRec(dayKey(new Date()));
    r.sec += TIME_TICK;
    timeData.total += TIME_TICK;
    if (r.sec % 30 === 0) { saveTimeData(); renderTimePanel(); checkBadges(); }
  }, TIME_TICK * 1000);
  // 画面を離れる時に保存
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveTimeData(); });
  window.addEventListener('pagehide', saveTimeData);
}

// 「べんきょうのきろく」パネル（直近7日のミニグラフ）
function renderTimePanel() {
  let el = document.getElementById('timePanel');
  if (!el) {
    const anchor = document.getElementById('badgeRow') || document.getElementById('dailyPanel');
    if (!anchor) return;
    el = document.createElement('div');
    el.id = 'timePanel'; el.className = 'time-panel';
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
  }
  const today = dayKey(new Date());
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = dayKey(d);
    const rec = timeData.days[k];
    days.push({
      k, dow: '日月火水木金土'[d.getDay()],
      sec: rec ? rec.sec : 0, solved: rec ? (rec.solved || 0) : 0,
      isToday: k === today,
    });
  }
  const week = days.reduce((s, d) => s + d.sec, 0);
  const max = Math.max(300, ...days.map(d => d.sec)); // 最低スケール5分
  el.innerHTML = `
    <div class="tp-head"><span>📊 べんきょうのきろく</span>
      <span class="tp-sums">きょう <b>${fmtTime(days[6].sec)}</b> ・ 7日間 <b>${fmtTime(week)}</b> ・ るいけい <b>${fmtTime(timeData.total)}</b></span>
    </div>
    <div class="tp-chart">
      ${days.map(d => `
        <div class="tp-col${d.isToday ? ' today' : ''}" title="${d.k}：${fmtTime(d.sec)}・${d.solved}問">
          <div class="tp-val">${d.isToday ? fmtTime(d.sec) : ''}</div>
          <div class="tp-bar-area"><div class="tp-bar${d.sec === 0 ? ' empty' : ''}" style="height:${Math.max(4, Math.round(d.sec / max * 100))}%"></div></div>
          <div class="tp-dow">${d.dow}</div>
        </div>`).join('')}
    </div>`;
}

/* =========================================================
   きょうのもくひょう＋れんぞく日数（全学年共通・localStorage）
   ========================================================= */
const DAILY_KEY = 'kanji_daily_v1';
const DAILY_GOAL = 10; // 1日の目標問題数
let daily = null;

function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

function loadDaily() {
  try { daily = JSON.parse(localStorage.getItem(DAILY_KEY)); } catch (e) { daily = null; }
  if (!daily || typeof daily !== 'object') {
    daily = { date: '', solved: 0, correct: 0, goalDone: false, streak: 0, lastDate: '' };
  }
  const today = dayKey(new Date());
  if (daily.date !== today) {
    daily.date = today; daily.solved = 0; daily.correct = 0; daily.goalDone = false;
    daily.quick = 0; // クイックもんだいの日次ボーナスもリセット
  }
}

function saveDaily() {
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch (e) {}
}

// 1問採点するたびに呼ばれる
function bumpDaily(correct) {
  const today = dayKey(new Date());
  if (daily.lastDate !== today) {
    // きょう最初の1問 → れんぞく日数を判定
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    daily.streak = (daily.lastDate === yesterday) ? (daily.streak || 0) + 1 : 1;
    daily.lastDate = today;
    if (daily.streak >= 2) setTimeout(() => showToast(`🔥 ${daily.streak}日 れんぞくで べんきょう中！えらい！`), 900);
  }
  daily.solved++;
  if (correct) daily.correct++;
  // 日別きろく（グラフ用）にも問題数を記録
  timeRec(today).solved++;
  saveTimeData();
  renderTimePanel();
  if (!daily.goalDone && daily.solved >= DAILY_GOAL) {
    daily.goalDone = true;
    addXp(10); // もくひょう達成ボーナス
    setTimeout(() => { showToast('🎯 きょうの もくひょう たっせい！'); sfx('fanfare'); dropConfetti(24); }, 700);
  }
  saveDaily();
  renderDailyPanel();
}

/* =========================================================
   レベル＆しょうごう（全学年共通のXP。正解で獲得、復習は割増）
   ========================================================= */
const XP_KEY = 'kanji_xp_v1';
let xpData = { xp: 0 };

const TITLES = [
  [1,'かんじ みならい'],[3,'かんじ れんしゅうせい'],[5,'かんじ ファイター'],
  [8,'かんじ ハンター'],[12,'かんじ ナイト'],[16,'かんじ マスター'],
  [20,'グランドマスター'],[25,'かんじ はかせ'],[30,'かんじ レジェンド'],
];

function loadXp(){ try{ const p=JSON.parse(localStorage.getItem(XP_KEY)); if(p&&typeof p.xp==='number') xpData=p; }catch(e){} }
function saveXp(){ try{ localStorage.setItem(XP_KEY,JSON.stringify(xpData)); }catch(e){} }

function xpNeed(lv){ return 20+(lv-1)*12; }  // レベルごとの必要XP（ゆるやかに増加）
function xpLevel(){
  let lv=1, rest=xpData.xp;
  while(rest>=xpNeed(lv)){ rest-=xpNeed(lv); lv++; }
  return { lv, rest, need: xpNeed(lv) };
}
function titleFor(lv){ let t=TITLES[0][1]; for(const [l,n] of TITLES) if(lv>=l) t=n; return t; }

function addXp(n){
  const before=xpLevel().lv;
  xpData.xp+=n;
  saveXp();
  const after=xpLevel().lv;
  if(after>before){
    sfx('fanfare'); dropConfetti(18);
    showToast(`🎉 レベルアップ！ Lv.${after} になった！`);
    const newTitle=titleFor(after);
    if(newTitle!==titleFor(before)) setTimeout(()=>showToast(`✨ しょうごうが「${newTitle}」に しんか！`),1700);
  }
  renderDailyPanel();
}

/* =========================================================
   バッジ（獲得は全学年共通キー、字数系は学年別ID）
   ========================================================= */
const BADGE_KEY = 'kanji_badges_v1';
let badges = {};

const BADGES = [
  { id:'goal1',   icon:'🎯', name:'はじめての もくひょう', cond:()=>daily.goalDone },
  { id:'d3',      icon:'🔥', name:'3日 れんぞく',          cond:()=>daily.streak>=3 },
  { id:'d7',      icon:'🏵️', name:'7日 れんぞく',          cond:()=>daily.streak>=7 },
  { id:'perfect', icon:'💯', name:'全問 せいかい',          cond:()=>lastPct===100 },
  { id:'hot10',   icon:'⚡', name:'10れんぞく せいかい',    cond:()=>streak>=10 },
  { id:'m10',     icon:'⭐', name:'10字 マスター',   grade:true, cond:()=>masteredCount()>=10 },
  { id:'half',    icon:'🌗', name:'はんぶん おぼえた', grade:true, cond:()=>learnedRatio()>=0.5 },
  { id:'all',     icon:'👑', name:'ぜんぶ おぼえた',  grade:true, cond:()=>learnedRatio()>=1 },
  { id:'t60',     icon:'⏱', name:'るいけい 1時間',  cond:()=>timeData&&timeData.total>=3600 },
  { id:'t300',    icon:'🕰️', name:'るいけい 5時間',  cond:()=>timeData&&timeData.total>=18000 },
  { id:'s3all',   icon:'🌟', name:'ぜんカテゴリ ⭐3', grade:true, big:true,
    cond:()=>CATEGORIES.every(c=>(state.catStars[c.id]||0)>=3) },
  { id:'q10',     icon:'⚡', name:'クイック 10回',   cond:()=>quickData.total>=10 },
  { id:'q50',     icon:'🌩️', name:'クイック 50回',   cond:()=>quickData.total>=50 },
];

function badgeId(b){ return b.grade ? b.id+':'+STORAGE_KEY : b.id; }
function masteredCount(){ return getAllUniqueKanji().filter(k=>(state.mastery[k]||0)>=3).length; }
function learnedRatio(){
  const all=getAllUniqueKanji();
  return all.length?all.filter(k=>state.learnedKanji.has(k)).length/all.length:0;
}

function loadBadges(){ try{ badges=JSON.parse(localStorage.getItem(BADGE_KEY))||{}; }catch(e){ badges={}; } }
function saveBadges(){ try{ localStorage.setItem(BADGE_KEY,JSON.stringify(badges)); }catch(e){} }

function checkBadges(){
  let newly=0;
  for(const b of BADGES){
    const id=badgeId(b);
    if(!badges[id] && b.cond()){
      badges[id]=true; newly++;
      setTimeout(()=>{ showToast(`🏆 バッジかくとく！「${b.name}」`); sfx('fanfare'); }, 1200*newly);
      if(b.big) setTimeout(()=>{ dropConfetti(60); showToast('🌟 がくねんマスター たんじょう！おめでとう！！'); sfx('fanfare'); }, 1200*newly+1500);
    }
  }
  if(newly){ saveBadges(); renderBadgeRow(); }
}

// バッジ一覧（デイリーパネルの下）。未獲得は薄く見せて「次の目標」にする
function renderBadgeRow(){
  let el=document.getElementById('badgeRow');
  if(!el){
    const panel=document.getElementById('dailyPanel');
    if(!panel) return;
    el=document.createElement('div');
    el.id='badgeRow'; el.className='badge-row';
    panel.parentNode.insertBefore(el,panel.nextSibling);
  }
  el.innerHTML = BADGES.map(b=>{
    const on=!!badges[badgeId(b)];
    return `<span class="badge-chip ${on?'on':''}" title="${b.name}">
      <span class="b-icon">${b.icon}</span><span class="b-name">${b.name}</span></span>`;
  }).join('');
}

// ホーム上部の「きょうのもくひょう」パネル（HTMLは変更せずJSから挿入）
function renderDailyPanel() {
  let el = document.getElementById('dailyPanel');
  if (!el) {
    const home = document.getElementById('screen-home');
    const anchor = home && home.querySelector('.tab-bar');
    if (!anchor) return;
    el = document.createElement('div');
    el.id = 'dailyPanel';
    el.className = 'daily-panel';
    home.insertBefore(el, anchor);
  }
  const n = Math.min(DAILY_GOAL, daily.solved);
  const L = xpLevel();
  el.innerHTML = `
    <div class="dp-level" title="せいかいで XPがたまるよ！">
      <span class="dp-lv">Lv.${L.lv}</span>
      <div class="dp-level-info">
        <span class="dp-title">${titleFor(L.lv)}</span>
        <div class="dp-xp-wrap"><div class="dp-xp" style="width:${L.rest / L.need * 100}%"></div></div>
      </div>
    </div>
    <div class="dp-streak"><span class="dp-fire">🔥</span><b>${daily.streak || 0}</b><span class="dp-unit">日れんぞく</span></div>
    <div class="dp-goal">
      <div class="dp-label">🎯 きょうのもくひょう <b>${daily.goalDone ? 'たっせい！✔' : n + ' / ' + DAILY_GOAL + '問'}</b></div>
      <div class="dp-bar-wrap"><div class="dp-bar${daily.goalDone ? ' done' : ''}" style="width:${n / DAILY_GOAL * 100}%"></div></div>
    </div>
    <button class="dp-ten" onclick="startDailyTen()">▶️ 10もん<span>スタート</span></button>`;
}

/* ---------- サウンドON/OFFボタン（ヘッダーに挿入） ---------- */
function setupSoundControls() {
  const header = document.querySelector('header');
  if (!header) return;
  const wrap = document.createElement('div');
  wrap.className = 'sound-controls';
  wrap.innerHTML = `
    <button class="sound-btn" id="btnBgm" title="BGMのON/OFF"></button>
    <button class="sound-btn" id="btnSfx" title="こうかおんのON/OFF"></button>`;
  header.insertBefore(wrap, header.querySelector('.progress-global'));
  const refresh = () => {
    document.getElementById('btnBgm').textContent = KSound.bgmOn ? '🎵' : '🚫';
    document.getElementById('btnSfx').textContent = KSound.sfxOn ? '🔊' : '🔇';
    document.getElementById('btnBgm').classList.toggle('off', !KSound.bgmOn);
    document.getElementById('btnSfx').classList.toggle('off', !KSound.sfxOn);
  };
  document.getElementById('btnBgm').addEventListener('click', () => { KSound.toggleBgm(); refresh(); });
  document.getElementById('btnSfx').addEventListener('click', () => { KSound.toggleSfx(); refresh(); });
  refresh();
}

function sfx(name, arg) {
  if (typeof KSound !== 'undefined') KSound[name](arg);
}

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (p.scores)       state.scores = p.scores;
      if (p.learnedKanji) state.learnedKanji = new Set(p.learnedKanji);
      if (p.catStars)     state.catStars = p.catStars;
      if (p.weak)         state.weak = p.weak;
      if (p.mastery)      state.mastery = p.mastery;
    }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      scores: state.scores,
      learnedKanji: Array.from(state.learnedKanji),
      catStars: state.catStars,
      weak: state.weak,
      mastery: state.mastery
    }));
  } catch(e) {}
}

function getKanjiData(kanji) {
  const extra = typeof EXTRA_KANJI !== 'undefined' ? EXTRA_KANJI : {};
  return KANJI_DATA[kanji] || extra[kanji] || null;
}

function getAllUniqueKanji() {
  return Array.from(new Set(ALL_QUESTIONS.map(q => q.ans))).sort();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) =>
    b.classList.toggle('active',(i===0&&tab==='quiz')||(i===1&&tab==='list')));
  document.getElementById('tab-quiz').style.display = tab==='quiz'?'block':'none';
  document.getElementById('tab-list').style.display = tab==='list'?'block':'none';
}

function renderCatGrid() {
  // にがてとっくんカード（にがてな字がある時だけ先頭に表示）
  const weakKanji=Object.keys(state.weak);
  const weakCard=weakKanji.length?`
    <div class="cat-card weak-card" onclick="startWeakQuiz()">
      <div class="cat-header"><span class="cat-emoji">🩹</span>
        <div><div class="cat-name">にがてとっくん</div><div class="cat-count">にがてな漢字 ${weakKanji.length}字</div></div>
      </div>
      <div class="weak-chips">${weakKanji.slice(0,10).map(k=>`<span>${k}</span>`).join('')}${weakKanji.length>10?'<span>…</span>':''}</div>
      <div class="cat-score"><span>せいかいすると そつぎょうできるよ！</span></div>
    </div>`:'';
  // がくねんマスターへの道：⭐の合計をカテゴリ見出しに表示
  const headEl=document.querySelector('#tab-quiz .section-head');
  if(headEl){
    const totalStars=CATEGORIES.reduce((s,c)=>s+(state.catStars[c.id]||0),0);
    const maxStars=CATEGORIES.length*3;
    headEl.innerHTML=`カテゴリを選ぼう <span class="head-stars">🌟 がくねんマスターへの道 ⭐ ${totalStars} / ${maxStars}</span>`;
  }
  // クイックもんだいカード（くり返しボーナスの予告つき）
  const plays=daily?(daily.quick||0):0;
  const quickCard=`
    <div class="cat-card quick-entry" onclick="startQuickQuiz()">
      <div class="cat-header"><span class="cat-emoji">⚡</span>
        <div><div class="cat-name">クイックもんだい</div><div class="cat-count">4たくで ${QUICK_N}問 ・ タップでこたえる</div></div>
      </div>
      <div class="cat-score">
        <span>きょう ${plays}回クリア</span>
        <span class="quick-bonus-tag">つぎのクリアで +${quickBonus(plays+1)}XP</span>
      </div>
    </div>`;
  document.getElementById('catGrid').innerHTML = weakCard + quickCard + CATEGORIES.map(cat => {
    const sc=state.scores[cat.id]||{correct:0,total:0};
    const total=ALL_QUESTIONS.filter(q=>q.cat===cat.id).length;
    // 進捗バーは「正解したことのある漢字の数」基準（再挑戦しても下がらない）
    const kanjiInCat=Array.from(new Set(ALL_QUESTIONS.filter(q=>q.cat===cat.id).map(q=>q.ans)));
    const learnedInCat=kanjiInCat.filter(k=>state.learnedKanji.has(k)).length;
    const barW=kanjiInCat.length>0?(learnedInCat/kanjiInCat.length*100):0;
    const stars=state.catStars[cat.id]||0;
    const starsHtml=sc.total>0||stars>0
      ? `<span class="cat-stars">${'⭐'.repeat(stars)}${'<i>☆</i>'.repeat(3-stars)}</span>` : '';
    return `<div class="cat-card ${cat.color}" onclick="startQuiz(${cat.id})">
      <div class="cat-header"><span class="cat-emoji">${cat.emoji}</span>
        <div><div class="cat-name">${cat.name}</div><div class="cat-count">${total}問</div></div>
        ${starsHtml}
      </div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${barW}%"></div></div>
      <div class="cat-score">
        <span>${sc.total>0?'前回 '+sc.correct+' / '+sc.total+'問':'未挑戦'}</span>
        <span>${learnedInCat>0?'✅ '+learnedInCat+'/'+kanjiInCat.length+'字':''}</span>
      </div></div>`;
  }).join('');
}

function renderKanjiGrid() {
  const all = getAllUniqueKanji();
  const masterCount = all.filter(k=>(state.mastery[k]||0)>=3).length;
  document.getElementById('kanjiGrid').innerHTML = all.map(k => {
    const d=getKanjiData(k); const learned=state.learnedKanji.has(k);
    const master=(state.mastery[k]||0)>=3;
    return `<div class="kanji-chip ${master?'master':learned?'learned':''}" onclick="showKanjiModal('${k}')">
      ${master?'<span class="chip-star">⭐</span>':''}
      <span class="kanji-char">${k}</span>
      <span class="kanji-read">${d?d[0].split('・')[0]:''}</span></div>`;
  }).join('');
  // 一覧タブの見出しにマスター数を表示
  const head=document.querySelector('#tab-list .section-head');
  if(head) head.textContent=`習った漢字をチェック（⭐マスター ${masterCount} / ${all.length}字・3回せいかいでマスター）`;
}

function startQuiz(catId) {
  beginQuiz(catId, ALL_QUESTIONS.filter(q=>q.cat===catId), false);
}

// まちがえた問題だけをやりなおす
function retryWrong() {
  if(!state.lastWrong.length) return;
  const qs=state.lastWrong.map(q=>Object.assign({},q,{review:true}));
  if(state.currentCat!==null) beginQuiz(state.currentCat, qs, true);
  else beginQuizCustom(state.currentTitle.replace(' ・ふくしゅう','')+' ・ふくしゅう','まちがえた問題にリベンジ！',null,qs);
}

function beginQuiz(catId, questions, isReview) {
  const cat=CATEGORIES[catId];
  beginQuizCustom(
    cat.emoji+' '+cat.name+(isReview?' ・ふくしゅう':''),
    isReview?'まちがえた問題にリベンジ！':`${questions.length}問のチャレンジ`,
    catId, questions);
}

function beginQuizCustom(title, subtitle, catId, questions) {
  state.currentCat=catId;
  state.currentTitle=title;
  state.currentQuestions=questions;
  state.revealed=false; state.eraserMode={}; state.writingMode=0;
  state.wrongList=[];
  answeredCount=0; correctCount=0; streak=0;
  document.getElementById('quizTitle').textContent=title;
  document.getElementById('quizSubtitle').textContent=subtitle;
  document.getElementById('qNum').textContent=questions.length+'問';
  document.getElementById('qOf').textContent='全問';
  document.getElementById('progBar').style.width='0%';
  renderQuestions(); showScreen('quiz'); window.scrollTo(0,0);
}

// きょうの10もん：にがて → まだ正解していない字 → マスター未満の字 の順で自動編成
function startDailyTen() {
  const chosen=[]; const usedKanji=new Set();
  const push=(q,review)=>{
    if(chosen.length>=10||usedKanji.has(q.ans)) return;
    usedKanji.add(q.ans);
    chosen.push(review?Object.assign({},q,{review:true}):Object.assign({},q));
  };
  const weakSet=new Set(Object.keys(state.weak));
  for(const q of shuffleArr(ALL_QUESTIONS.filter(q=>weakSet.has(q.ans)))) push(q,true);
  if(chosen.length<10)
    for(const q of shuffleArr(ALL_QUESTIONS.filter(q=>!state.learnedKanji.has(q.ans)))) push(q,false);
  if(chosen.length<10)
    for(const q of shuffleArr(ALL_QUESTIONS.filter(q=>(state.mastery[q.ans]||0)<3))) push(q,true);
  if(chosen.length<10)
    for(const q of shuffleArr(ALL_QUESTIONS)) push(q,true);
  beginQuizCustom('▶️ きょうの10もん','にがて・あたらしい じから おまかせで えらんだよ！',null,shuffleArr(chosen));
}

/* =========================================================
   クイックもんだい（4択×10問・くりかえしボーナス）
   ---------------------------------------------------------
   学年データから よみ/かんじあて/いみ/文の穴うめ を自動生成。
   選択肢の重複と「別の正しい読みが誤答になる」問題を排除
   （選択肢は {t, ok} オブジェクトで持ち、indexOfに頼らない）。
   4択の正解は学習記録として weak・デイリー・XPに反映するが、
   learnedKanji / mastery は書き取りドリル専用のまま。
   ========================================================= */
const QUICK_N = 10;
const QUICK_KEY = 'kanji_quick_v1';
const QUICK_LADDER = [0, 5, 8, 12, 16, 20]; // きょうn回目クリアのボーナスXP
let quickData = { total: 0 };
let quick = null;

function loadQuick(){ try{ const p=JSON.parse(localStorage.getItem(QUICK_KEY)); if(p&&typeof p.total==='number') quickData=p; }catch(e){} }
function saveQuick(){ try{ localStorage.setItem(QUICK_KEY,JSON.stringify(quickData)); }catch(e){} }
function quickBonus(n){ return n<=5 ? QUICK_LADDER[n] : 5; } // 6回目からは+5

function readingsOf(k){ const d=getKanjiData(k); return d&&d[0]?d[0].split('・'):[]; }

// 誤答3つを選ぶ（正解・他の誤答とテキスト重複しない）。足りなければnull
function pickQuickChoices(correctText, pool, toText){
  const out=[];
  for(const o of shuffleArr(pool)){
    const t=toText(o);
    if(t!==correctText && !out.includes(t)) out.push(t);
    if(out.length===3) break;
  }
  if(out.length<3) return null;
  return shuffleArr([{t:correctText,ok:true}, ...out.map(t=>({t,ok:false}))]);
}

// 1字ぶんの4択問題を作る（作れるタイプをランダムに試す）
function buildQuickQ(k, allK){
  const d=getKanjiData(k); if(!d) return null;
  const my=readingsOf(k);
  for(const type of shuffleArr(['yomi','kanji','imi','fill'])){
    let q=null;
    if(type==='yomi' && my.length){
      // 誤答に この字の別の読みを出さない
      const pool=allK.filter(o=>o!==k && readingsOf(o).length && !my.includes(readingsOf(o)[0]));
      const ch=pickQuickChoices(my[0], pool, o=>readingsOf(o)[0]);
      if(ch) q={type,k,choices:ch,html:`「<b class="qq-focus">${k}</b>」の よみかたは？`,
        explain:`「${k}」は「${d[0]}」と よむよ`};
    } else if(type==='kanji' && my.length){
      const r=my[0];
      // 同じ読みを持つ字は誤答にしない
      const pool=allK.filter(o=>o!==k && !readingsOf(o).includes(r));
      const ch=pickQuickChoices(k, pool, o=>o);
      if(ch) q={type,k,choices:ch,html:`「<b class="qq-focus">${r}</b>」と よむ かんじは？`,
        explain:`「${r}」は「${k}」（${d[1]}）`};
    } else if(type==='imi'){
      // 意味が同じ字は誤答にしない
      const pool=allK.filter(o=>o!==k && (getKanjiData(o)||[])[1]!==d[1]);
      const ch=pickQuickChoices(k, pool, o=>o);
      if(ch) q={type,k,choices:ch,html:`「${d[1]}」<br>この いみの かんじは？`,
        explain:`せいかいは「${k}」（${my[0]||''}）`};
    } else if(type==='fill'){
      const sent=ALL_QUESTIONS.find(x=>x.ans===k && x.q && x.q.includes('〔　〕'));
      if(sent){
        // 読みがかぶる字（同音で文に入り得る字）は誤答にしない
        const pool=allK.filter(o=>o!==k && !readingsOf(o).some(r=>my.includes(r)));
        const ch=pickQuickChoices(k, pool, o=>o);
        if(ch) q={type,k,choices:ch,
          html:`${sent.q.replace('〔　〕','<span class="qq-blank">◯</span>')}<br><span class="qq-sub">◯に はいる かんじは？</span>`,
          explain:`せいかいは「${k}」：${sent.q.replace('〔　〕',k)}`};
      }
    }
    if(q) return q;
  }
  return null;
}

// にがて → まだ正解していない字 → その他 の順で10問ぶんの字を選ぶ
function buildQuickQuestions(){
  const allK=getAllUniqueKanji().filter(k=>getKanjiData(k));
  const weakSet=new Set(Object.keys(state.weak));
  const order=[
    ...shuffleArr(allK.filter(k=>weakSet.has(k))),
    ...shuffleArr(allK.filter(k=>!weakSet.has(k)&&!state.learnedKanji.has(k))),
    ...shuffleArr(allK.filter(k=>!weakSet.has(k)&&state.learnedKanji.has(k))),
  ];
  const qs=[];
  for(const k of order){
    if(qs.length>=QUICK_N) break;
    const q=buildQuickQ(k,allK);
    if(q) qs.push(q);
  }
  return qs;
}

function startQuickQuiz(){
  const qs=buildQuickQuestions();
  if(qs.length<4){ showToast('もんだいを つくれなかった…'); return; }
  quick={ qs, idx:0, correctN:0 };
  ensureQuickScreen();
  renderQuickQ();
  showScreen('quick');
}

function ensureQuickScreen(){
  if(document.getElementById('screen-quick')) return;
  const div=document.createElement('div');
  div.id='screen-quick'; div.className='screen';
  document.getElementById('app').appendChild(div);
}

function renderQuickQ(){
  const q=quick.qs[quick.idx];
  document.getElementById('screen-quick').innerHTML=`
    <div class="quiz-header">
      <button class="back-btn" onclick="goHome()">←</button>
      <div>
        <div class="quiz-title">⚡ クイックもんだい</div>
        <div class="quiz-subtitle">タップで こたえよう！</div>
      </div>
      <div class="quiz-progress"><div class="qnum">${quick.idx+1} / ${quick.qs.length}</div></div>
    </div>
    <div class="prog-bar-wrap"><div class="prog-bar" style="width:${quick.idx/quick.qs.length*100}%"></div></div>
    <div class="quick-card">
      <div class="quick-q">${q.html}</div>
      <div class="quick-choices">
        ${q.choices.map((c,i)=>`<button class="quick-choice" onclick="answerQuick(${i})">${c.t}</button>`).join('')}
      </div>
      <div class="quick-explain" id="quickExplain"></div>
    </div>`;
  window.scrollTo(0,0);
}

function answerQuick(i){
  const q=quick.qs[quick.idx];
  if(q.done) return;
  q.done=true;
  const btns=document.querySelectorAll('.quick-choice');
  btns.forEach(b=>b.disabled=true);
  const ok=q.choices[i].ok;
  btns[q.choices.findIndex(c=>c.ok)].classList.add('correct');
  if(!ok) btns[i].classList.add('wrong');
  const ex=document.getElementById('quickExplain');
  ex.innerHTML=(ok?'<b class="qe-ok">⭕ せいかい！</b> ':'<b class="qe-ng">✕ ざんねん…</b> ')+q.explain;
  ex.classList.add('show');
  if(ok){
    quick.correctN++; streak++;
    sfx('correct',streak);
    addXp(1);
    if(state.weak[q.k]){
      state.weak[q.k]--;
      if(state.weak[q.k]<=0){ delete state.weak[q.k]; showToast(`🎓「${q.k}」を にがてから そつぎょう！`); }
    }
  } else {
    streak=0;
    sfx('wrong');
    state.weak[q.k]=Math.min(9,(state.weak[q.k]||0)+1);
  }
  saveState();
  bumpDaily(ok);
  checkBadges();
  setTimeout(()=>{
    quick.idx++;
    if(quick.idx>=quick.qs.length) finishQuick();
    else renderQuickQ();
  }, ok?900:1900);
}

function finishQuick(){
  quickData.total++; saveQuick();
  daily.quick=(daily.quick||0)+1; saveDaily();
  const plays=daily.quick;
  const bonus=quickBonus(plays);
  const perfect=quick.correctN===quick.qs.length;
  addXp(bonus+(perfect?10:0));
  checkBadges();
  if(perfect) dropConfetti(30);
  else if(quick.correctN>=quick.qs.length*0.8) dropConfetti(12);
  sfx(quick.correctN>=quick.qs.length*0.8?'fanfare':'cheer');
  renderCatGrid();
  document.getElementById('screen-quick').innerHTML=`
    <div class="results-hero">
      <div class="results-score">${quick.correctN} / ${quick.qs.length}</div>
      <div class="results-msg">${perfect?'🎉 パーフェクト！':quick.correctN>=8?'🌟 すごい！':'👍 よくがんばった！'}</div>
      <div class="quick-reward">
        ⚡ きょう ${plays}回目クリア！ ボーナス <b>+${bonus}XP</b>${perfect?' ＋ パーフェクト <b>+10XP</b>':''}
        <div class="quick-next">${plays<5?`つぎのクリアは ボーナス <b>+${quickBonus(plays+1)}XP</b>！もういちど やってみよう！`:'きょうは たくさん がんばったね！'}</div>
      </div>
    </div>
    <div class="results-actions">
      <button class="res-btn" onclick="goHome()">🏠 ホームへ</button>
      <button class="res-btn primary" onclick="startQuickQuiz()">⚡ もういちど</button>
    </div>`;
  window.scrollTo(0,0);
}

// にがてとっくん：まちがえた字の問題だけで練習（1字1問・最大12問）
function startWeakQuiz() {
  const weakSet=new Set(Object.keys(state.weak));
  if(weakSet.size===0) return;
  const byKanji={};
  for(const q of shuffleArr(ALL_QUESTIONS.filter(q=>weakSet.has(q.ans)))){
    if(!byKanji[q.ans]) byKanji[q.ans]=q;
  }
  const qs=shuffleArr(Object.values(byKanji)).slice(0,12).map(q=>Object.assign({},q,{review:true}));
  beginQuizCustom('🩹 にがてとっくん','にがてな漢字に せいかいして そつぎょうしよう！',null,qs);
}

function shuffleArr(arr){
  const a=arr.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

function retryQuiz() { if(state.currentCat!==null) startQuiz(state.currentCat); }

function renderQuestions() {
  document.getElementById('questionsList').innerHTML = state.currentQuestions.map((q,i) => {
    const sentence=q.q.replace('〔　〕',`<span class="q-blank" id="blank-${i}">　　</span>`);
    const rev=q.review?`<span class="review-tag">復習</span>`:'';
    return `<div class="q-card" id="qcard-${i}">
      <span class="result-badge" id="badge-${i}"></span>
      <div class="q-num">問${i+1}${rev}</div>
      <div class="q-sentence">${sentence}</div>
      <div class="q-hint">ヒント：${q.hint}</div>
      <div class="canvas-wrap" id="cwrap-${i}">
        <div class="canvas-toolbar">
          <button class="canvas-btn" id="eraser-${i}" onclick="toggleEraser(${i})">消しゴム</button>
          <button class="canvas-btn" onclick="clearCanvas(${i})">全消去</button>
          <span style="font-size:11px;color:var(--text2);align-self:center">指やマウスで書いてみよう</span>
        </div>
        <canvas class="writing-canvas" id="canvas-${i}" width="600" height="120"></canvas>
      </div>
      <div class="answer-section" id="ans-${i}">
        <div class="answer-label">正解</div>
        <div class="answer-kanji">${q.ans}</div>
        <div class="answer-meta">${getAnswerMeta(q.ans)}</div>
      </div>
      <div class="self-check" id="check-${i}">
        <button class="sc-btn sc-correct" onclick="markAnswer(${i},true)">⭕ 正解！</button>
        <button class="sc-btn sc-wrong" onclick="markAnswer(${i},false)">✕ まちがえた</button>
      </div></div>`;
  }).join('');
  const btn=document.getElementById('revealBtn');
  btn.textContent='📋 答え合わせ'; btn.className='reveal-btn'; btn.disabled=false;
  requestAnimationFrame(() => {
    state.currentQuestions.forEach((_,i)=>initCanvas(i));
    applyMode(state.writingMode);
  });
}

function getAnswerMeta(kanji) {
  const d=getKanjiData(kanji); if(!d) return '';
  return `読み：<span>${d[0]}</span><br>意味：<span>${d[1]}</span><br>使い方：<span>${d[2]}</span>`;
}

function setMode(m) {
  state.writingMode=m;
  document.getElementById('modeBtn0').classList.toggle('active',m===0);
  document.getElementById('modeBtn1').classList.toggle('active',m===1);
  applyMode(m);
}
function applyMode(m) {
  state.currentQuestions.forEach((_,i)=>{
    const cw=document.getElementById('cwrap-'+i);
    if(cw) cw.classList.toggle('show',m===1);
  });
}

function initCanvas(i) {
  const canvas=document.getElementById('canvas-'+i); if(!canvas) return;
  const ctx=canvas.getContext('2d');
  ctx.strokeStyle='#e8eaf6'; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
  let drawing=false;
  function getPos(e){
    const r=canvas.getBoundingClientRect();
    const sx=canvas.width/r.width, sy=canvas.height/r.height;
    const s=e.touches?e.touches[0]:e;
    return{x:(s.clientX-r.left)*sx,y:(s.clientY-r.top)*sy};
  }
  function startDraw(e){e.preventDefault();drawing=true;const p=getPos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)}
  function draw(e){
    e.preventDefault();if(!drawing)return;const p=getPos(e);
    if(state.eraserMode[i]){ctx.globalCompositeOperation='destination-out';ctx.lineWidth=20}
    else{ctx.globalCompositeOperation='source-over';ctx.lineWidth=3;ctx.strokeStyle='#e8eaf6'}
    ctx.lineTo(p.x,p.y);ctx.stroke();ctx.beginPath();ctx.moveTo(p.x,p.y);
  }
  function endDraw(e){if(e)e.preventDefault();drawing=false;ctx.globalCompositeOperation='source-over';ctx.lineWidth=3}
  canvas.addEventListener('mousedown',startDraw);canvas.addEventListener('mousemove',draw);
  canvas.addEventListener('mouseup',endDraw);canvas.addEventListener('mouseleave',endDraw);
  canvas.addEventListener('touchstart',startDraw,{passive:false});
  canvas.addEventListener('touchmove',draw,{passive:false});
  canvas.addEventListener('touchend',endDraw,{passive:false});
}
function toggleEraser(i){
  state.eraserMode[i]=!state.eraserMode[i];
  const b=document.getElementById('eraser-'+i);
  if(b) b.classList.toggle('eraser-active',state.eraserMode[i]);
}
function clearCanvas(i){
  const c=document.getElementById('canvas-'+i);
  if(c) c.getContext('2d').clearRect(0,0,c.width,c.height);
}

function revealAnswers(){
  state.revealed=true;
  sfx('reveal');
  state.currentQuestions.forEach((_,i)=>{
    document.getElementById('ans-'+i).classList.add('show');
    document.getElementById('check-'+i).classList.add('show');
  });
  const btn=document.getElementById('revealBtn');
  btn.textContent='✅ 答えを確認中…'; btn.className='reveal-btn revealed'; btn.disabled=true;
  document.getElementById('progBar').style.width='30%';
  showToast('答えと照らし合わせて自己採点してね！');
}

function markAnswer(i,correct){
  const card=document.getElementById('qcard-'+i);
  const badge=document.getElementById('badge-'+i);
  const check=document.getElementById('check-'+i);
  if(card.classList.contains('answered-correct')||card.classList.contains('answered-wrong')) return;
  card.classList.add(correct?'answered-correct':'answered-wrong');
  badge.textContent=correct?'⭕':'✕'; badge.classList.add('show');
  check.style.opacity='0.4'; check.style.pointerEvents='none';
  answeredCount++;
  const kanji=state.currentQuestions[i].ans;
  if(correct){
    correctCount++; streak++;
    state.learnedKanji.add(kanji);
    // マスター段階（3回せいかいで⭐マスター）
    state.mastery[kanji]=Math.min(99,(state.mastery[kanji]||0)+1);
    if(state.mastery[kanji]===3) showToast(`⭐「${kanji}」を マスターした！`);
    // にがてから1歩そつぎょう
    if(state.weak[kanji]){
      state.weak[kanji]--;
      if(state.weak[kanji]<=0){ delete state.weak[kanji]; showToast(`🎓「${kanji}」を にがてから そつぎょう！`); }
    }
    sfx('correct', streak);
    addXp(state.currentQuestions[i].review?3:2); // 復習の正解は割増XP
    if(streak===3||streak===5||streak===10||streak===15) showToast(`🔥 ${streak}れんぞく せいかい！すごい！`);
  } else {
    streak=0;
    state.wrongList.push(state.currentQuestions[i]);
    state.weak[kanji]=Math.min(9,(state.weak[kanji]||0)+1);
    sfx('wrong');
  }
  saveState(); // 途中でやめても記録が消えないように毎回保存
  bumpDaily(correct);
  checkBadges();
  const pct=30+(answeredCount/state.currentQuestions.length)*70;
  document.getElementById('progBar').style.width=pct+'%';
  if(answeredCount===state.currentQuestions.length){
    if(state.currentCat!==null){
      state.scores[state.currentCat]={correct:correctCount,total:answeredCount};
      // 星評価（過去ベストを保持）: 100%=⭐3 / 80%=⭐2 / 60%=⭐1
      const p=Math.round(correctCount/answeredCount*100);
      const st=p===100?3:p>=80?2:p>=60?1:0;
      state.catStars[state.currentCat]=Math.max(state.catStars[state.currentCat]||0,st);
    }
    state.lastWrong=state.wrongList.slice();
    saveState();
    setTimeout(()=>showResults(correctCount,answeredCount),400);
  }
}

function showResults(correct,total){
  const pct=Math.round(correct/total*100);
  lastPct=pct;
  addXp(5+(pct===100?10:0)); // 完走ボーナス＋パーフェクトボーナス
  checkBadges();
  document.getElementById('resScore').textContent=pct+'%';
  document.getElementById('resLabel').textContent=`${correct} / ${total} 問正解`;
  let msg,sub;
  if(pct===100){msg='🎉 全問正解！すごい！';sub='パーフェクト！次のカテゴリにもチャレンジしよう！'}
  else if(pct>=80){msg='🌟 よくできました！';sub='もう少しで完璧！もう一度やってみよう。'}
  else if(pct>=60){msg='👍 がんばりました！';sub='まちがえた漢字を確認してもう一度練習しよう。'}
  else{msg='📖 もう少しがんばろう！';sub='まちがえた問題を中心に練習しよう。'}
  document.getElementById('resMsg').textContent=msg;
  document.getElementById('resSub').textContent=sub;
  renderResultStars(pct);
  if(pct>=80){sfx('fanfare');}else{sfx('cheer');}
  if(pct===100) dropConfetti(40);
  else if(pct>=80) dropConfetti(14);
  updateRetryWrongButton();
  answeredCount=0; correctCount=0;
  showScreen('results'); updateGlobalProgress(); renderCatGrid(); renderKanjiGrid();
}

// リザルトに星評価を表示（カテゴリ挑戦時のみ）
function renderResultStars(pct){
  let el=document.getElementById('resStars');
  if(!el){
    el=document.createElement('div');
    el.id='resStars'; el.className='res-stars';
    const label=document.getElementById('resLabel');
    if(!label) return;
    label.parentNode.insertBefore(el,label.nextSibling);
  }
  if(state.currentCat===null){el.style.display='none';return;}
  el.style.display='';
  const st=pct===100?3:pct>=80?2:pct>=60?1:0;
  el.innerHTML='⭐'.repeat(st)+'<i>☆</i>'.repeat(3-st)
    +(st<3?`<span class="res-stars-hint">${st===2?'100点で ⭐3！':'80点いじょうで ⭐2！'}</span>`:'');
}

// 「まちがえた問題だけ やりなおす」ボタン（まちがいがある時だけ表示）
function updateRetryWrongButton(){
  let btn=document.getElementById('retryWrongBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='retryWrongBtn'; btn.className='res-btn wrong-retry';
    btn.onclick=retryWrong;
    const actions=document.querySelector('.results-actions');
    if(!actions) return;
    actions.insertBefore(btn, actions.firstChild);
  }
  const n=state.lastWrong.length;
  btn.textContent=`✍️ まちがえた${n}問を やりなおす`;
  btn.style.display=n>0?'':'none';
}

// 🎉 おいわいの紙吹雪
function dropConfetti(n){
  const emo=['🎉','⭐','🌸','✨'];
  for(let i=0;i<n;i++){
    const s=document.createElement('span');
    s.className='confetti';
    s.textContent=emo[i%emo.length];
    s.style.left=(Math.random()*100)+'vw';
    s.style.animationDelay=(Math.random()*0.9)+'s';
    s.style.fontSize=(13+Math.random()*15)+'px';
    document.body.appendChild(s);
    setTimeout(()=>s.remove(),4000);
  }
}

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  window.scrollTo(0,0);
}
function goHome(){answeredCount=0;correctCount=0;showScreen('home');updateGlobalProgress();renderCatGrid();}
// 全体進捗＝「正解したことのある漢字」÷「この学年の漢字数」
// （トップページの表示と同じ基準。再挑戦しても下がらない）
function updateGlobalProgress(){
  const all=getAllUniqueKanji();
  const learned=all.filter(k=>state.learnedKanji.has(k)).length;
  document.getElementById('globalPct').textContent=all.length>0?Math.round(learned/all.length*100)+'%':'0%';
}

function showKanjiModal(kanji){
  const d=getKanjiData(kanji);
  document.getElementById('modalKanji').textContent=kanji;
  document.getElementById('modalRead').textContent=d?d[0]:kanji;
  document.getElementById('modalMeaning').textContent=d?d[1]:'';
  document.getElementById('modalEx').textContent=d?d[2]:'';
  // マスター進捗（せいかい回数）
  let m=document.getElementById('modalMastery');
  if(!m){
    m=document.createElement('div');
    m.id='modalMastery'; m.className='modal-mastery';
    const read=document.getElementById('modalRead');
    read.parentNode.insertBefore(m,read.nextSibling);
  }
  const c=state.mastery[kanji]||0;
  m.textContent = c>=3?`⭐ マスター！（せいかい ${c}回）`
    : c>0?`せいかい ${c}回 ・ あと${3-c}回で ⭐マスター`
    : 'せいかいすると マスターに ちかづくよ';
  // 「この字をれんしゅう」ボタン（気づき→練習の距離をゼロに）
  let pb=document.getElementById('modalPractice');
  if(!pb){
    pb=document.createElement('button');
    pb.id='modalPractice'; pb.className='modal-practice';
    const closeBtn=document.querySelector('#modal .modal-close');
    if(closeBtn) closeBtn.parentNode.insertBefore(pb,closeBtn);
  }
  pb.textContent=`✍️ 「${kanji}」を れんしゅうする`;
  pb.onclick=()=>{ closeModal(); startKanjiPractice(kanji); };
  document.getElementById('modal').classList.add('show');
}

// その字の問題だけで集中練習
function startKanjiPractice(k){
  const qs=shuffleArr(ALL_QUESTIONS.filter(q=>q.ans===k)).map(q=>Object.assign({},q,{review:true}));
  if(!qs.length){ showToast('この字の もんだいが みつからないよ…'); return; }
  beginQuizCustom(`✍️ 「${k}」を れんしゅう`,'この字だけ しゅうちゅうとっくん！',null,qs);
}
function closeModal(e){
  if(!e||e.target.id==='modal'||e.target.classList.contains('modal-close'))
    document.getElementById('modal').classList.remove('show');
}
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}
