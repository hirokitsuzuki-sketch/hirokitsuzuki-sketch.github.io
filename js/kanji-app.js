let state = {
  currentCat: null, currentQuestions: [], revealed: false,
  scores: {}, learnedKanji: new Set(), writingMode: 0, eraserMode: {}
};
let answeredCount = 0, correctCount = 0;

window.addEventListener('DOMContentLoaded', () => {
  loadState(); renderCatGrid(); renderKanjiGrid(); updateGlobalProgress();
});

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (p.scores)       state.scores = p.scores;
      if (p.learnedKanji) state.learnedKanji = new Set(p.learnedKanji);
    }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      scores: state.scores,
      learnedKanji: Array.from(state.learnedKanji)
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
  document.getElementById('catGrid').innerHTML = CATEGORIES.map(cat => {
    const sc=state.scores[cat.id]||{correct:0,total:0};
    const total=ALL_QUESTIONS.filter(q=>q.cat===cat.id).length;
    const barW=sc.total>0?(sc.correct/sc.total*100):0;
    const pct=sc.total>0?Math.round(sc.correct/sc.total*100):0;
    return `<div class="cat-card ${cat.color}" onclick="startQuiz(${cat.id})">
      <div class="cat-header"><span class="cat-emoji">${cat.emoji}</span>
        <div><div class="cat-name">${cat.name}</div><div class="cat-count">${total}問</div></div>
      </div>
      <div class="cat-bar-wrap"><div class="cat-bar" style="width:${barW}%"></div></div>
      <div class="cat-score">
        <span>${sc.total>0?sc.correct+'問正解 / '+sc.total+'問':'未挑戦'}</span>
        <span>${sc.total>0?pct+'%':''}</span>
      </div></div>`;
  }).join('');
}

function renderKanjiGrid() {
  const all = getAllUniqueKanji();
  document.getElementById('kanjiGrid').innerHTML = all.map(k => {
    const d=getKanjiData(k); const learned=state.learnedKanji.has(k);
    return `<div class="kanji-chip ${learned?'learned':''}" onclick="showKanjiModal('${k}')">
      <span class="kanji-char">${k}</span>
      <span class="kanji-read">${d?d[0].split('・')[0]:''}</span></div>`;
  }).join('');
}

function startQuiz(catId) {
  state.currentCat=catId;
  state.currentQuestions=ALL_QUESTIONS.filter(q=>q.cat===catId);
  state.revealed=false; state.eraserMode={}; state.writingMode=0;
  answeredCount=0; correctCount=0;
  const cat=CATEGORIES[catId];
  document.getElementById('quizTitle').textContent=cat.emoji+' '+cat.name;
  document.getElementById('quizSubtitle').textContent=`${state.currentQuestions.length}問のチャレンジ`;
  document.getElementById('qNum').textContent=state.currentQuestions.length+'問';
  document.getElementById('qOf').textContent='全問';
  document.getElementById('progBar').style.width='0%';
  renderQuestions(); showScreen('quiz'); window.scrollTo(0,0);
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
  answeredCount++; if(correct){correctCount++;state.learnedKanji.add(state.currentQuestions[i].ans);}
  const pct=30+(answeredCount/state.currentQuestions.length)*70;
  document.getElementById('progBar').style.width=pct+'%';
  if(answeredCount===state.currentQuestions.length){
    state.scores[state.currentCat]={correct:correctCount,total:answeredCount};
    saveState();
    setTimeout(()=>showResults(correctCount,answeredCount),400);
  }
}

function showResults(correct,total){
  const pct=Math.round(correct/total*100);
  document.getElementById('resScore').textContent=pct+'%';
  document.getElementById('resLabel').textContent=`${correct} / ${total} 問正解`;
  let msg,sub;
  if(pct===100){msg='🎉 全問正解！すごい！';sub='パーフェクト！次のカテゴリにもチャレンジしよう！'}
  else if(pct>=80){msg='🌟 よくできました！';sub='もう少しで完璧！もう一度やってみよう。'}
  else if(pct>=60){msg='👍 がんばりました！';sub='まちがえた漢字を確認してもう一度練習しよう。'}
  else{msg='📖 もう少しがんばろう！';sub='まちがえた問題を中心に練習しよう。'}
  document.getElementById('resMsg').textContent=msg;
  document.getElementById('resSub').textContent=sub;
  answeredCount=0; correctCount=0;
  showScreen('results'); updateGlobalProgress(); renderCatGrid(); renderKanjiGrid();
}

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  window.scrollTo(0,0);
}
function goHome(){answeredCount=0;correctCount=0;showScreen('home');updateGlobalProgress();renderCatGrid();}
function updateGlobalProgress(){
  const totalQ=ALL_QUESTIONS.length;
  let totalC=0; Object.values(state.scores).forEach(sc=>totalC+=sc.correct);
  document.getElementById('globalPct').textContent=totalQ>0?Math.round(totalC/totalQ*100)+'%':'0%';
}

function showKanjiModal(kanji){
  const d=getKanjiData(kanji);
  document.getElementById('modalKanji').textContent=kanji;
  document.getElementById('modalRead').textContent=d?d[0]:kanji;
  document.getElementById('modalMeaning').textContent=d?d[1]:'';
  document.getElementById('modalEx').textContent=d?d[2]:'';
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
