let state = {
  currentCat: null, currentQuestions: [], revealed: false,
  scores: {}, learnedKanji: new Set(), writingMode: 0, eraserMode: {},
  wrongList: [], lastWrong: [], currentTitle: '',
  catStars: {}, weak: {}, mastery: {}
};
let answeredCount = 0, correctCount = 0, streak = 0, lastPct = -1;

window.addEventListener('DOMContentLoaded', () => {
  loadState(); loadDaily(); loadBadges();
  renderDailyPanel(); renderBadgeRow(); renderCatGrid(); renderKanjiGrid(); updateGlobalProgress();
  if (typeof KSound !== 'undefined') { KSound.init(); setupSoundControls(); }
});

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
  if (!daily.goalDone && daily.solved >= DAILY_GOAL) {
    daily.goalDone = true;
    setTimeout(() => { showToast('🎯 きょうの もくひょう たっせい！'); sfx('fanfare'); dropConfetti(24); }, 700);
  }
  saveDaily();
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
  el.innerHTML = `
    <div class="dp-streak"><span class="dp-fire">🔥</span><b>${daily.streak || 0}</b><span class="dp-unit">日れんぞく</span></div>
    <div class="dp-goal">
      <div class="dp-label">🎯 きょうのもくひょう <b>${daily.goalDone ? 'たっせい！✔' : n + ' / ' + DAILY_GOAL + '問'}</b></div>
      <div class="dp-bar-wrap"><div class="dp-bar${daily.goalDone ? ' done' : ''}" style="width:${n / DAILY_GOAL * 100}%"></div></div>
    </div>`;
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
  document.getElementById('catGrid').innerHTML = weakCard + CATEGORIES.map(cat => {
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
  document.getElementById('modal').classList.add('show');
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
