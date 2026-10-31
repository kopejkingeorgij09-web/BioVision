/* Режим бамбука: «Итоги». Неделя, месяц или всё время: опыт по дням, закрытые дни, фокус, чтение, спорт, привычки.
   Для недели ещё разбор: причины переносов и вопрос «что меняю на следующей неделе» (документ wk_<понедельник>).
   Внизу перемотка: каким был бамбук в любой прошлый день. */
(function(){
const {esc, icon} = B;
let mode = 'week', anchor = null, replay = null, playT = null;

function range(){
  const t = B.today(), c = B.calc();
  if (mode === 'week'){ const ws = anchor || B.weekStart(t); return {from: ws, to: B.add(ws, 6), label: `${B.fmtS(ws)} – ${B.fmtS(B.add(ws, 6))}`}; }
  if (mode === 'month'){
    const a = B.parse(anchor || t.slice(0, 8) + '01'), from = B.ymd(new Date(a.getFullYear(), a.getMonth(), 1, 12)), to = B.ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0, 12));
    return {from, to, label: `${B.MONF[a.getMonth()]} ${a.getFullYear()}`};
  }
  return {from: c.start, to: t, label: `с ${B.fmt(c.start)}`};
}
function days(r){ const out = []; for (let d = r.from; d <= r.to; d = B.add(d, 1)) out.push(d); return out; }

function summary(list){
  const c = B.calc(), t = B.today();
  let xp = 0, good = 0, past = 0, pomoMin = 0, read = 0, sport = 0, hv = 0, hn = 0;
  const hs = B.habits().filter(h => h.kind !== 'weekly');
  list.forEach(d => {
    const r = c.days[d]; if (!r) return;
    xp += r.xp;
    if (d < t){ past++; if (r.result === 'good') good++; }
    pomoMin += (B.day(d).pomo || []).reduce((a, p) => a + (p.min || 0), 0);
    read += B.readMin(d);
    if (d <= t) hs.forEach(h => { if (h.created && d < h.created) return; hn++; hv += B.habitVal(h, d); });
  });
  sport = B.workouts().filter(w => list.includes(w.date)).length;
  return {xp, good, past, pomoMin, read, sport, hab: hn ? hv / hn : 0};
}

function xpChart(list){
  const c = B.calc();
  let pts = list.map(d => ({k: d, v: (c.days[d] || {}).xp || 0, r: (c.days[d] || {}).result || '', l: B.parse(d).getDate()}));
  if (pts.length > 45){   // всё время: по неделям
    const by = {}; pts.forEach(p => { const w = B.weekStart(p.k); by[w] = by[w] || {k: w, v: 0, r: 'week', l: B.fmtS(w)}; by[w].v += p.v; });
    pts = Object.values(by);
  }
  const max = Math.max(50, ...pts.map(p => Math.abs(p.v)));
  const step = Math.ceil(pts.length / 8);
  return `<div class="bars ${pts.length > 10 ? 'dense' : ''}">${pts.map((p, i) => `<div class="bar-col r-${p.r}" title="${p.r === 'week' ? 'неделя с ' + p.l : B.fmtW(p.k)}: ${p.v > 0 ? '+' : ''}${p.v} XP">
    <span class="bv">${pts.length <= 10 && p.v ? p.v : ''}</span><span class="bw"><i style="height:${(Math.max(0, p.v) / max * 100).toFixed(1)}%"></i></span>
    <span class="bl">${pts.length <= 10 ? B.WD[B.wd(p.k)] : i % step === 0 ? p.l : ''}</span></div>`).join('')}</div>
    <div class="legend"><span><i class="lgd good"></i>закрыт</span><span><i class="lgd fail"></i>провал</span><span><i class="lgd frozen"></i>заморозка</span></div>`;
}

function weekReview(r){
  const reasons = {};
  B.tasks().forEach(t => (t.postpones || []).forEach(p => { const d = B.dayOf(p.at); if (d >= r.from && d <= r.to) reasons[p.why] = (reasons[p.why] || 0) + 1; }));
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const doc = B.get('wk_' + r.from) || {};
  const c = B.calc(), list = days(r).filter(d => c.days[d]);
  const best = list.slice().sort((a, b) => c.days[b].xp - c.days[a].xp)[0];
  const ended = r.to < B.today() || B.wd(B.today()) >= 5;
  return `<section class="card">
    <h2>${icon('pen')}Разбор недели</h2>
    ${best ? `<p class="muted">Лучший день: ${B.WDF[B.wd(best)]}, ${c.days[best].xp} XP.</p>` : ''}
    ${top.length ? `<div class="sub-h">Почему переносил</div><ul class="plain dots">${top.map(([w, n]) => `<li>${esc(w)} <span class="muted">× ${n}</span></li>`).join('')}</ul>` : '<p class="muted">Переносов не было.</p>'}
    ${B.habits().length ? `<div class="sub-h">Привычки</div><div class="hrates">${B.habits().map(h => { let v = 0, n = 0; days(r).forEach(d => { if (d > B.today() || (h.created && d < h.created)) return; n++; v += B.habitVal(h, d); });
      const rate = h.kind === 'weekly' ? Math.min(1, v / (h.target || 3)) : n ? v / n : 0;
      return `<div class="hrate"><span>${esc(h.name)}</span>${B.bar(rate)}<b class="mono">${Math.round(rate * 100)}%</b></div>`; }).join('')}</div>` : ''}
    ${ended ? `<label class="field">Что меняю на следующей неделе<textarea rows="3" data-in="wkChange" data-w="${r.from}" placeholder="Одно-два конкретных изменения. Например: телефон в другой комнате во время помидоров">${esc(doc.change || '')}</textarea></label>
      <p class="hint">Ответ будет висеть на главном экране всю следующую неделю.</p>` : '<p class="hint">Разбор недели откроется с субботы.</p>'}
    <button class="btn ghost" data-act="aiWeek">${icon('sparkle')} Разобрать неделю в Claude</button>
  </section>`;
}
B.inputs.wkChange = el => B.put('wk_' + el.dataset.w, {change: el.value, at: Date.now()}, true);

/* бамбук на выбранный день */
function snapshot(date){
  const c = B.calc(), r = c.days[date];
  if (!r) return null;
  const lv = B.levelOf(r.total), ds = {};
  for (const k in c.days) if (k <= date) ds[k] = c.days[k];
  return {height: lv.height, level: lv.L, days: ds};
}
function replayCard(){
  const c = B.calc(), all = Object.keys(c.days).sort();
  if (all.length < 2) return '';
  const i = replay == null ? all.length - 1 : Math.min(replay, all.length - 1), d = all[i], s = snapshot(d);
  return `<section class="card">
    <h2>${icon('bamboo')}Как рос бамбук</h2>
    <div class="row between"><span id="rpDate">${B.fmtW(d)}</span><b class="mono" id="rpH">${B.fmtH(s.height)} · ур. ${s.level}</b></div>
    <div class="row"><button class="icon-btn" data-act="rpPlay" aria-label="Проиграть">${icon(playT ? 'pause' : 'play')}</button>
      <input type="range" class="grow" min="0" max="${all.length - 1}" value="${i}" data-in="rpSlide" aria-label="День"></div>
    <div class="scene-wrap mini" id="rpScene">${B.bambooScene(s)}</div>
  </section>`;
}
function drawReplay(i){
  const c = B.calc(), all = Object.keys(c.days).sort(), d = all[i], s = snapshot(d);
  const box = B.$('#rpScene'); if (!box || !s) return;
  box.innerHTML = B.bambooScene(s);
  B.$('#rpDate').textContent = B.fmtW(d); B.$('#rpH').textContent = `${B.fmtH(s.height)} · ур. ${s.level}`;
  const svg = box.querySelector('svg'); box.scrollTop = Math.max(0, B.bambooTopY(s.height, svg) - box.clientHeight * 0.4);
}
B.inputs.rpSlide = el => { replay = +el.value; drawReplay(replay); };
B.acts.rpPlay = () => {
  if (playT){ clearInterval(playT); playT = null; B.render(); return; }
  const all = Object.keys(B.calc().days).sort();
  replay = (replay == null || replay >= all.length - 1) ? 0 : replay;
  B.render();
  playT = setInterval(() => {
    const sl = B.$('[data-in=rpSlide]');
    if (!sl || replay >= all.length - 1){ clearInterval(playT); playT = null; if (sl) B.render(); return; }
    replay++; sl.value = replay; drawReplay(replay);
  }, Math.max(40, Math.min(250, 6000 / all.length)));
};

B.views.stats = {
  title: 'Итоги',
  render(){
    const r = range(), list = days(r), s = summary(list);
    return `<div class="page stats-page">
      <header class="page-h"><div><div class="eyebrow">Итоги</div><h1>${esc(r.label)}</h1></div>
        <div class="row">${mode !== 'all' ? `<button class="icon-btn" data-act="stShift" data-k="-1" aria-label="Назад">${icon('left')}</button><button class="icon-btn" data-act="stShift" data-k="1" aria-label="Вперёд">${icon('right')}</button>` : ''}</div></header>
      <div class="toggle wide st-mode">${[['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="stMode" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="cols">
        <div class="col">
          <section class="card"><div class="kpis">
            <div class="kpi"><b>${s.good}/${s.past}</b><span>дней закрыто</span></div>
            <div class="kpi"><b>${s.xp > 0 ? '+' : ''}${B.num(s.xp)}</b><span>XP</span></div>
            <div class="kpi"><b>${B.num(s.pomoMin / 60, 1)} ч</b><span>фокуса</span></div>
            <div class="kpi"><b>${B.mins(s.read)}</b><span>чтения</span></div>
            <div class="kpi"><b>${s.sport}</b><span>тренировок</span></div>
            <div class="kpi"><b>${Math.round(s.hab * 100)}%</b><span>ежедневных привычек</span></div>
          </div></section>
          <section class="card"><h2>${icon('chart')}Опыт по дням</h2>${xpChart(list)}</section>
          ${mode === 'week' ? weekReview(r) : ''}
        </div>
        <div class="col">${replayCard()}</div>
      </div>
    </div>`;
  },
  mount(){ const b = B.$('#rpScene'); if (b){ const all = Object.keys(B.calc().days).sort(); drawReplay(replay == null ? all.length - 1 : Math.min(replay, all.length - 1)); } }
};
B.acts.stMode = el => { mode = el.dataset.k; anchor = null; B.render(); };
B.acts.stShift = el => {
  const k = +el.dataset.k, r = range();
  if (mode === 'week') anchor = B.add(r.from, 7 * k);
  else { const a = B.parse(r.from); anchor = B.ymd(new Date(a.getFullYear(), a.getMonth() + k, 1, 12)); }
  B.render();
};
})();
