/* =========================================================
   りかラボ アプリ本体
   ---------------------------------------------------------
   かんじラボで実証済みの夢中化スタックを最初から搭載:
   デイリー目標・連続日数・XP/称号・単元⭐・にがてとっくん・
   問題マスター・バッジ・時間計測・きょうの10もん・演出。
   保存は rika_state_v1 の1キーに集約（設計書 §6）。
   ========================================================= */

/* ---------- 状態 ---------- */
const SAVE_KEY = 'rika_state_v1';
const DAILY_GOAL = 10;
const MASTER_N = 2;      // 同じ問題に2回正解でマスター
const QUIZ_N = 10;       // きょうの10もん・にがてとっくんの問題数

let S = null;            // セーブデータ全体
let quiz = null;         // 進行中クイズ {qs, idx, correctN, unitKey, title}
let streak = 0;          // セッション内の連続正解
let lastActivity = Date.now();

function defaultState() {
  return {
    grade: '3',
    xp: 0,
    daily: { date: '', solved: 0, goalDone: false, streak: 0, lastDate: '' },
    qstats: {},   // "3:plant:0" -> {c, w}
    weak: {},     // "3:plant:0" -> 回数
    unitBest: {}, // "3:plant" -> ⭐0-3
    badges: {},
    time: { days: {}, total: 0 },
  };
}

function load() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
  S = Object.assign(defaultState(), p || {});
  for (const k of ['daily', 'qstats', 'weak', 'unitBest', 'badges', 'time']) {
    S[k] = Object.assign(defaultState()[k], (p || {})[k] || {});
  }
  if (!RIKA_DATA[S.grade]) S.grade = '3';
  const today = dayKey(new Date());
  if (S.daily.date !== today) {
    S.daily.date = today; S.daily.solved = 0; S.daily.goalDone = false;
  }
}

function save() {
  // 時間記録は直近60日だけ保持
  const keys = Object.keys(S.time.days);
  if (keys.length > 60) {
    keys.sort((a, b) => new Date(a) - new Date(b)).slice(0, keys.length - 60)
        .forEach(k => delete S.time.days[k]);
  }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}

function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

/* ---------- 起動 ---------- */
window.addEventListener('DOMContentLoaded', () => {
  load();
  renderHome();
  setupTimeTracking();
  if (typeof KSound !== 'undefined') { KSound.init(); setupSoundControls(); }
  greetComeback();
});

function setupSoundControls() {
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

function sfx(name, arg) { if (typeof KSound !== 'undefined') KSound[name](arg); }

/* ---------- 汎用UI ---------- */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

let toastTimer = 0;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function dropConfetti(n) {
  const emo = ['🎉', '⭐', '🧪', '✨'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = emo[i % emo.length];
    s.style.left = (Math.random() * 100) + 'vw';
    s.style.animationDelay = (Math.random() * 0.9) + 's';
    s.style.fontSize = (13 + Math.random() * 15) + 'px';
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 4000);
  }
}

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- XP・称号 ---------- */
const TITLES = [
  [1, 'みならい けんきゅういん'], [3, 'けんきゅういん'], [6, 'じっけんマスター'],
  [10, 'はかせの たまご'], [15, 'りかはかせ'], [22, 'てんさい はかせ'], [30, 'りかレジェンド'],
];
function xpNeed(lv) { return 20 + (lv - 1) * 12; }
function xpLevel() {
  let lv = 1, rest = S.xp;
  while (rest >= xpNeed(lv)) { rest -= xpNeed(lv); lv++; }
  return { lv, rest, need: xpNeed(lv) };
}
function titleFor(lv) { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (lv >= l) t = n; return t; }

function addXp(n) {
  const before = xpLevel().lv;
  S.xp += n;
  const after = xpLevel().lv;
  if (after > before) {
    sfx('fanfare'); dropConfetti(18);
    showToast(`🎉 レベルアップ！ Lv.${after} になった！`);
    const nt = titleFor(after);
    if (nt !== titleFor(before)) setTimeout(() => showToast(`✨ しょうごうが「${nt}」に しんか！`), 1700);
  }
  renderStatusPanel();
}

/* ---------- バッジ ---------- */
const BADGES = [
  { id: 'goal1',  icon: '🎯', name: 'はじめての もくひょう', cond: () => S.daily.goalDone },
  { id: 'd3',     icon: '🔥', name: '3日 れんぞく',  cond: () => S.daily.streak >= 3 },
  { id: 'd7',     icon: '🏵️', name: '7日 れんぞく',  cond: () => S.daily.streak >= 7 },
  { id: 'perfect',icon: '💯', name: '全問 せいかい',  cond: () => quiz && quiz.finishedPerfect },
  { id: 'hot10',  icon: '⚡', name: '10れんぞく せいかい', cond: () => streak >= 10 },
  { id: 'm50',    icon: '⭐', name: '50問 マスター',  cond: () => masteredTotal() >= 50 },
  { id: 'c100',   icon: '📖', name: '通算 100問 せいかい', cond: () => totalCorrect() >= 100 },
  { id: 's3g',    icon: '🌟', name: '学年の単元 ぜんぶ⭐3', grade: true, big: true,
    cond: () => RIKA_DATA[S.grade].units.every(u => (S.unitBest[S.grade + ':' + u.id] || 0) >= 3) },
  { id: 't60',    icon: '⏱', name: 'るいけい 1時間', cond: () => S.time.total >= 3600 },
  { id: 't300',   icon: '🕰️', name: 'るいけい 5時間', cond: () => S.time.total >= 18000 },
];
function badgeId(b) { return b.grade ? b.id + ':' + S.grade : b.id; }
function masteredTotal() { return Object.values(S.qstats).filter(r => r.c >= MASTER_N).length; }
function totalCorrect() { return Object.values(S.qstats).reduce((s, r) => s + r.c, 0); }

function checkBadges() {
  let newly = 0;
  for (const b of BADGES) {
    const id = badgeId(b);
    if (!S.badges[id] && b.cond()) {
      S.badges[id] = true; newly++;
      setTimeout(() => { showToast(`🏆 バッジかくとく！「${b.name}」`); sfx('fanfare'); }, 1200 * newly);
      if (b.big) setTimeout(() => { dropConfetti(60); showToast('🌟 がくねんはかせ たんじょう！おめでとう！！'); sfx('fanfare'); }, 1200 * newly + 1500);
    }
  }
  if (newly) { save(); renderBadgeRow(); }
}

function renderBadgeRow() {
  document.getElementById('badgeRow').innerHTML = BADGES.map(b => {
    const on = !!S.badges[badgeId(b)];
    return `<span class="badge-chip ${on ? 'on' : ''}" title="${b.name}">
      <span class="b-icon">${b.icon}</span><span class="b-name">${b.name}</span></span>`;
  }).join('');
}

/* ---------- デイリー ---------- */
function bumpDaily(correct) {
  const today = dayKey(new Date());
  if (S.daily.lastDate !== today) {
    const yesterday = dayKey(new Date(Date.now() - 86400000));
    S.daily.streak = (S.daily.lastDate === yesterday) ? (S.daily.streak || 0) + 1 : 1;
    S.daily.lastDate = today;
    if (S.daily.streak >= 2) setTimeout(() => showToast(`🔥 ${S.daily.streak}日 れんぞくで けんきゅう中！えらい！`), 900);
  }
  S.daily.solved++;
  timeRec(today).solved++;
  if (!S.daily.goalDone && S.daily.solved >= DAILY_GOAL) {
    S.daily.goalDone = true;
    addXp(10);
    setTimeout(() => { showToast('🎯 きょうの もくひょう たっせい！'); sfx('fanfare'); dropConfetti(24); }, 700);
  }
  renderStatusPanel();
  renderTimePanel();
}

function greetComeback() {
  try {
    if (sessionStorage.getItem('rika_greeted')) return;
    const returning = S.xp > 0 || S.daily.lastDate;
    if (!returning || S.daily.lastDate === dayKey(new Date())) return;
    sessionStorage.setItem('rika_greeted', '1');
    setTimeout(() => {
      const w = Object.keys(S.weak).length;
      showToast(w > 0 ? `おかえり！🩹 にがての ${w}問が まっているよ` : 'おかえり！🎯 きょうも 10問 がんばろう！');
    }, 800);
  } catch (e) {}
}

/* ---------- 時間計測 ---------- */
function timeRec(k) { return S.time.days[k] || (S.time.days[k] = { sec: 0, solved: 0 }); }

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
    if (Date.now() - lastActivity > 60000) return; // 60秒さわっていなければ休憩
    const r = timeRec(dayKey(new Date()));
    r.sec += 5;
    S.time.total += 5;
    if (r.sec % 30 === 0) { save(); renderTimePanel(); checkBadges(); }
  }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
}

function renderTimePanel() {
  const el = document.getElementById('timePanel');
  const today = dayKey(new Date());
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = dayKey(d);
    const rec = S.time.days[k];
    days.push({ k, dow: '日月火水木金土'[d.getDay()], sec: rec ? rec.sec : 0, solved: rec ? (rec.solved || 0) : 0, isToday: k === today });
  }
  const week = days.reduce((s, d) => s + d.sec, 0);
  const max = Math.max(300, ...days.map(d => d.sec));
  el.innerHTML = `
    <div class="tp-head"><span>📊 べんきょうのきろく</span>
      <span class="tp-sums">きょう <b>${fmtTime(days[6].sec)}</b> ・ 7日間 <b>${fmtTime(week)}</b> ・ るいけい <b>${fmtTime(S.time.total)}</b></span>
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

/* ---------- ホーム ---------- */
function renderHome() {
  renderStatusPanel();
  renderBadgeRow();
  renderTimePanel();
  renderGradeTabs();
  renderUnits();
  renderGlobalPct();
}

function goHome() { renderHome(); showScreen('home'); }

function renderStatusPanel() {
  const L = xpLevel();
  const nextTitle = TITLES.find(([l]) => l > L.lv);
  const n = Math.min(DAILY_GOAL, S.daily.solved);
  document.getElementById('statusPanel').innerHTML = `
    <div class="dp-level" title="せいかいで XPがたまるよ！">
      <span class="dp-lv">Lv.${L.lv}</span>
      <div class="dp-level-info">
        <span class="dp-title">${titleFor(L.lv)}</span>
        <div class="dp-xp-wrap"><div class="dp-xp" style="width:${L.rest / L.need * 100}%"></div></div>
        ${nextTitle ? `<span class="dp-next">つぎ: Lv.${nextTitle[0]} ${nextTitle[1]}</span>` : ''}
      </div>
    </div>
    <div class="dp-streak"><span class="dp-fire">🔥</span><b>${S.daily.streak || 0}</b><span class="dp-unit">日れんぞく</span></div>
    <div class="dp-goal">
      <div class="dp-label">🎯 きょうのもくひょう <b>${S.daily.goalDone ? 'たっせい！✔' : n + ' / ' + DAILY_GOAL + '問'}</b></div>
      <div class="dp-bar-wrap"><div class="dp-bar${S.daily.goalDone ? ' done' : ''}" style="width:${n / DAILY_GOAL * 100}%"></div></div>
    </div>
    <button class="dp-ten" onclick="startDailyTen()">▶️ 10もん<span>スタート</span></button>`;
}

function renderGradeTabs() {
  document.getElementById('gradeTabs').innerHTML = ['3', '4', '5', '6'].map(g =>
    `<button class="grade-tab ${S.grade === g ? 'active' : ''}" onclick="setGrade('${g}')">${g}年生</button>`).join('');
}

function setGrade(g) {
  S.grade = g;
  save();
  renderGradeTabs();
  renderUnits();
  renderGlobalPct();
  renderBadgeRow(); // 学年バッジの対象が変わる
}

function unitStats(g, u) {
  const total = u.qs.length;
  let mastered = 0, seen = 0;
  for (let i = 0; i < total; i++) {
    const r = S.qstats[`${g}:${u.id}:${i}`];
    if (r && r.c >= MASTER_N) mastered++;
    if (r && (r.c + r.w) > 0) seen++;
  }
  return { total, mastered, seen };
}

function renderUnits() {
  const g = S.grade;
  const units = RIKA_DATA[g].units;

  // がくねんはかせへの道（⭐合計）
  const totalStars = units.reduce((s, u) => s + (S.unitBest[g + ':' + u.id] || 0), 0);
  document.getElementById('unitHead').innerHTML =
    `たんげんを えらぼう <span class="head-stars">🌟 がくねんはかせへの道 ⭐ ${totalStars} / ${units.length * 3}</span>`;

  // にがてとっくんカード（全学年ぶん）
  const weakKeys = Object.keys(S.weak);
  const weakCard = weakKeys.length ? `
    <div class="unit-card weak-card" onclick="startWeakQuiz()">
      <div class="uc-header"><span class="uc-emoji">🩹</span>
        <div><div class="uc-name">にがてとっくん</div><div class="uc-count">にがてな問題 ${weakKeys.length}問</div></div>
      </div>
      <div class="uc-note">せいかいすると そつぎょうできるよ！</div>
    </div>` : '';

  document.getElementById('unitGrid').innerHTML = weakCard + units.map(u => {
    const st = unitStats(g, u);
    const stars = S.unitBest[g + ':' + u.id] || 0;
    const starsHtml = st.seen > 0 || stars > 0
      ? `<span class="uc-stars">${'⭐'.repeat(stars)}${'<i>☆</i>'.repeat(3 - stars)}</span>` : '';
    return `
    <div class="unit-card" onclick="startUnitQuiz('${u.id}')">
      <div class="uc-header"><span class="uc-emoji">${u.emoji}</span>
        <div><div class="uc-name">${u.name}</div><div class="uc-count">${st.total}問</div></div>
        ${starsHtml}
      </div>
      <div class="uc-bar-wrap"><div class="uc-bar" style="width:${st.mastered / st.total * 100}%"></div></div>
      <div class="uc-foot">
        <span>${st.seen > 0 ? 'ちょうせん中' : 'みちょうせん'}</span>
        <span>${st.mastered > 0 ? '⭐ マスター ' + st.mastered + '/' + st.total : ''}</span>
      </div>
    </div>`;
  }).join('');
}

function renderGlobalPct() {
  const g = S.grade;
  let total = 0, mastered = 0;
  for (const u of RIKA_DATA[g].units) {
    const st = unitStats(g, u);
    total += st.total; mastered += st.mastered;
  }
  document.getElementById('globalPct').textContent = total ? Math.round(mastered / total * 100) + '%' : '0%';
}

/* ---------- クイズ生成 ---------- */
function qByKey(key) {
  const [g, uid, idx] = key.split(':');
  const u = (RIKA_DATA[g] || { units: [] }).units.find(u => u.id === uid);
  return u ? u.qs[parseInt(idx, 10)] : null;
}

// 問題データ → 出題オブジェクト（選択肢は {t, ok} でシャッフル。indexOfに頼らない）
function buildQ(key, review) {
  const q = qByKey(key);
  if (!q) return null;
  return {
    key, review: !!review,
    text: q.q, explain: q.ex,
    choices: shuffleArr([{ t: q.c, ok: true }, ...q.d.map(t => ({ t, ok: false }))]),
  };
}

function allKeysOfGrade(g) {
  const keys = [];
  for (const u of RIKA_DATA[g].units)
    for (let i = 0; i < u.qs.length; i++) keys.push(`${g}:${u.id}:${i}`);
  return keys;
}

function startUnitQuiz(uid) {
  const g = S.grade;
  const u = RIKA_DATA[g].units.find(u => u.id === uid);
  if (!u) return;
  const qs = shuffleArr(u.qs.map((_, i) => buildQ(`${g}:${uid}:${i}`)));
  beginQuiz(qs, `${u.emoji} ${u.name}`, `${qs.length}問の チャレンジ！`, g + ':' + uid);
}

// にがて → まだやっていない → 正解が少ない の順で10問
function startDailyTen() {
  const g = S.grade;
  const weakKeys = shuffleArr(Object.keys(S.weak));
  const rest = allKeysOfGrade(g).filter(k => !S.weak[k]);
  const unseen = shuffleArr(rest.filter(k => !S.qstats[k]));
  const seen = shuffleArr(rest.filter(k => S.qstats[k]))
    .sort((a, b) => (S.qstats[a].c || 0) - (S.qstats[b].c || 0));
  const keys = [...weakKeys.map(k => [k, true]), ...unseen.map(k => [k, false]), ...seen.map(k => [k, true])]
    .slice(0, QUIZ_N);
  const qs = shuffleArr(keys.map(([k, rev]) => buildQ(k, rev)).filter(Boolean));
  beginQuiz(qs, '▶️ きょうの10もん', 'にがて・あたらしい もんだいから おまかせで えらんだよ！', null);
}

function startWeakQuiz() {
  const keys = shuffleArr(Object.keys(S.weak)).slice(0, QUIZ_N + 2);
  const qs = keys.map(k => buildQ(k, true)).filter(Boolean);
  if (!qs.length) return;
  beginQuiz(qs, '🩹 にがてとっくん', 'せいかいして そつぎょうしよう！', null);
}

/* ---------- クイズ進行 ---------- */
function beginQuiz(qs, title, subtitle, unitKey) {
  if (!qs.length) { showToast('もんだいが ないよ…'); return; }
  quiz = { qs, idx: 0, correctN: 0, unitKey, title, wrongKeys: [] };
  streak = 0;
  document.getElementById('quizTitle').textContent = title;
  document.getElementById('quizSubtitle').textContent = subtitle;
  renderQuizQ();
  showScreen('quiz');
}

function renderQuizQ() {
  const q = quiz.qs[quiz.idx];
  document.getElementById('qNum').textContent = `${quiz.idx + 1} / ${quiz.qs.length}`;
  document.getElementById('progBar').style.width = (quiz.idx / quiz.qs.length * 100) + '%';
  document.getElementById('quizQ').innerHTML =
    (q.review ? '<span class="review-tag">ふくしゅう</span> ' : '') + q.text;
  document.getElementById('quizChoices').innerHTML =
    q.choices.map((c, i) => `<button class="quick-choice" onclick="answerQuiz(${i})">${c.t}</button>`).join('');
  const ex = document.getElementById('quizExplain');
  ex.innerHTML = ''; ex.classList.remove('show');
  window.scrollTo(0, 0);
}

function answerQuiz(i) {
  const q = quiz.qs[quiz.idx];
  if (q.done) return;
  q.done = true;
  const btns = document.querySelectorAll('.quick-choice');
  btns.forEach(b => b.disabled = true);
  const ok = q.choices[i].ok;
  btns[q.choices.findIndex(c => c.ok)].classList.add('correct');
  if (!ok) btns[i].classList.add('wrong');
  const ex = document.getElementById('quizExplain');
  ex.innerHTML = (ok ? '<b class="qe-ok">⭕ せいかい！</b> ' : '<b class="qe-ng">✕ ざんねん…</b> ') + q.explain;
  ex.classList.add('show');

  const r = S.qstats[q.key] || (S.qstats[q.key] = { c: 0, w: 0 });
  if (ok) {
    quiz.correctN++; streak++;
    r.c++;
    if (r.c === MASTER_N) showToast('⭐ この問題を マスターした！');
    if (S.weak[q.key]) {
      S.weak[q.key]--;
      if (S.weak[q.key] <= 0) { delete S.weak[q.key]; showToast('🎓 にがてから そつぎょう！'); }
    }
    sfx('correct', streak);
    addXp(q.review ? 3 : 2);
    if (streak === 3 || streak === 5 || streak === 10) showToast(`🔥 ${streak}れんぞく せいかい！すごい！`);
  } else {
    streak = 0;
    r.w++;
    S.weak[q.key] = Math.min(9, (S.weak[q.key] || 0) + 1);
    quiz.wrongKeys.push(q.key);
    sfx('wrong');
  }
  bumpDaily(ok);
  save();
  checkBadges();
  setTimeout(() => {
    quiz.idx++;
    if (quiz.idx >= quiz.qs.length) finishQuiz();
    else renderQuizQ();
  }, ok ? 1100 : 2300);
}

function finishQuiz() {
  const total = quiz.qs.length;
  const pct = Math.round(quiz.correctN / total * 100);
  const perfect = quiz.correctN === total;
  quiz.finishedPerfect = perfect;

  // 単元の⭐（過去ベスト保持）
  let starsHtml = '';
  if (quiz.unitKey) {
    const st = pct === 100 ? 3 : pct >= 80 ? 2 : pct >= 60 ? 1 : 0;
    S.unitBest[quiz.unitKey] = Math.max(S.unitBest[quiz.unitKey] || 0, st);
    starsHtml = '⭐'.repeat(st) + '<i>☆</i>'.repeat(3 - st)
      + (st < 3 ? `<span class="res-stars-hint">${st === 2 ? '100点で ⭐3！' : '80点いじょうで ⭐2！'}</span>` : '');
  }

  addXp(5 + (perfect ? 10 : 0));
  save();
  checkBadges();

  document.getElementById('resScore').textContent = `${quiz.correctN} / ${total}`;
  document.getElementById('resStars').innerHTML = starsHtml;
  document.getElementById('resMsg').textContent =
    perfect ? '🎉 パーフェクト！すごい！' : pct >= 80 ? '🌟 よくできました！' : pct >= 60 ? '👍 がんばりました！' : '📖 もう少し がんばろう！';
  document.getElementById('resReward').innerHTML =
    `かくとくXP <b>+${quiz.correctN * 2 + 5 + (perfect ? 10 : 0)}</b>${perfect ? '（パーフェクトボーナス +10 こみ！）' : ''}`;

  const wrongN = quiz.wrongKeys.length;
  document.getElementById('resActions').innerHTML = `
    ${wrongN ? `<button class="res-btn wrong-retry" onclick="retryWrong()">✍️ まちがえた${wrongN}問を やりなおす</button>` : ''}
    <button class="res-btn" onclick="goHome()">🏠 ホームへ</button>
    <button class="res-btn primary" onclick="retrySame()">🔄 もういちど</button>`;

  if (perfect) { dropConfetti(36); sfx('fanfare'); }
  else if (pct >= 80) { dropConfetti(14); sfx('fanfare'); }
  else sfx('cheer');

  showScreen('result');
}

function retryWrong() {
  const keys = [...new Set(quiz.wrongKeys)];
  const qs = shuffleArr(keys.map(k => buildQ(k, true)).filter(Boolean));
  beginQuiz(qs, quiz.title + ' ・ふくしゅう', 'まちがえた問題に リベンジ！', null);
}

function retrySame() {
  if (quiz.unitKey) startUnitQuiz(quiz.unitKey.split(':')[1]);
  else if (quiz.title.includes('にがて')) startWeakQuiz();
  else startDailyTen();
}
