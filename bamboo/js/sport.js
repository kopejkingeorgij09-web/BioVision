/* Режим бамбука: тренировки. Зал (упражнения, подходы, вес), кардио (время, дистанция), самочувствие,
   шаблоны с последними весами, личные рекорды и график рабочего веса по упражнению. */
(function(){
const {esc, icon} = B;
B.SPORT_TYPES = {home: 'Дома', tread: 'Беговая дорожка', gym: 'Зал', run: 'Бег на улице', bike: 'Велосипед', walk: 'Ходьба', stretch: 'Растяжка', other: 'Другое'};
const CARDIO = new Set(['tread', 'run', 'bike', 'walk']);
const BASIC = ['Отжимания', 'Подтягивания'];
let chartW = null;
const STRENGTH = new Set(['gym', 'home', 'other']);
const FEEL = ['', 'тяжело', 'так себе', 'нормально', 'хорошо', 'огонь'];
let W = null, chartEx = null;

/* по каждому упражнению: для каждого веса (дома это доп. вес, +0 кг без него) лучший подход и история по датам */
function exStats(){
  const st = {};
  B.workouts().slice().reverse().forEach(w => (w.ex || []).forEach(e => {
    const n = (e.name || '').trim(); if (!n) return;
    const k = n.toLowerCase(), x = st[k] = st[k] || {name: n, last: null, by: {}, n: 0};
    x.n++;
    const day = {};
    (e.sets || []).forEach(q => { const wt = +q.w || 0, r = +q.r || 0; if (!r) return; day[wt] = Math.max(day[wt] || 0, r); });
    for (const wt in day){ const b = x.by[wt] = x.by[wt] || {best: 0, date: '', hist: []}; b.hist.push([w.date, day[wt]]); if (day[wt] > b.best){ b.best = day[wt]; b.date = w.date; } }
    x.last = e.sets;
  }));
  return st;
}

function lineChart(hist){
  if (hist.length < 2) return `<p class="muted">${hist.length ? `Пока одна запись: ${hist[0][1]} повт. Нужна ещё хотя бы одна тренировка.` : 'Нет записей.'}</p>`;
  const W_ = 320, H = 120, px = 28, py = 14;
  const ys = hist.map(h => h[1]), mn = Math.min(...ys), mx = Math.max(...ys), span = mx - mn || 1;
  const pts = hist.map((h, i) => [px + i / (hist.length - 1) * (W_ - px - 8), H - py - (h[1] - mn) / span * (H - 2 * py)]);
  return `<svg class="line" viewBox="0 0 ${W_} ${H}" role="img" aria-label="Повторы в лучшем подходе">
    <text x="2" y="${py + 4}" class="ax">${mx}</text><text x="2" y="${H - py + 4}" class="ax">${mn}</text>
    <polyline points="${pts.map(p => p.join(',')).join(' ')}" class="ln"/>
    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="pt"><title>${B.fmtS(hist[i][0])}: ${hist[i][1]} повт.</title></circle>`).join('')}
  </svg>`;
}

B.views.sport = {
  title: 'Спорт',
  render(){
    const t = B.today(), ws = B.weekStart(t), goal = B.cfg().sportGoal || 3;
    const all = B.workouts(), week = all.filter(w => w.date >= ws && w.date <= t);
    const st = exStats(), exs = Object.values(st).sort((a, b) => b.n - a.n);
    if ((!chartEx || !st[chartEx]) && exs.length) chartEx = exs[0].name.toLowerCase();
    const mon = t.slice(0, 7), dist = all.filter(w => w.date.startsWith(mon)).reduce((a, w) => a + (+w.dist || 0), 0);
    const minMon = all.filter(w => w.date.startsWith(mon)).reduce((a, w) => a + (+w.min || 0), 0);
    const tpls = B.cfg().templates || [];
    return `<div class="page sport-page">
      <header class="page-h"><div><div class="eyebrow">Тренировки</div><h1>Турник, отжимания, дорожка</h1></div>
        <button class="btn primary" data-act="wNew">${icon('plus')} Тренировка</button></header>
      <div class="cols">
        <div class="col">
          <section class="card">
            <div class="row">
              <div class="lvl-ring">${B.ring(week.length / goal, 72)}<b>${week.length}</b></div>
              <div class="grow"><h2>На этой неделе ${week.length} из ${goal}</h2>
                <div class="week7 static">${Array.from({length: 7}, (_, i) => B.add(ws, i)).map(d => `<span class="d7 ${all.some(w => w.date === d) ? 'on' : ''} ${d === t ? 'now' : ''}"><span>${B.WD[B.wd(d)]}</span><i>${all.some(w => w.date === d) ? icon('check') : ''}</i></span>`).join('')}</div>
              </div>
            </div>
            ${tpls.length ? `<div class="sub-h">Начать по шаблону</div><div class="chips">${tpls.map((p, i) => `<button class="chip" data-act="wTpl" data-i="${i}">${icon('dumbbell')}${esc(p.name)}</button>`).join('')}</div>` : ''}
          </section>
          <section class="card">
            <h2>${icon('run')}Последние</h2>
            ${all.slice(0, 12).map(w => `<button class="wrow" data-act="wOpen" data-id="${w.id}">
              <span class="wdate"><b>${B.parse(w.date).getDate()}</b>${B.MON[B.parse(w.date).getMonth()]}</span>
              <span class="grow"><b>${esc(B.SPORT_TYPES[w.type] || w.type)}${w.name ? ' · ' + esc(w.name) : ''}</b>
              <span class="muted">${[w.min ? B.mins(+w.min) : '', w.dist ? w.dist + ' км' : '', (w.ex || []).length ? (w.ex || []).map(e => esc(e.name)).filter(Boolean).slice(0, 3).join(', ') : '', w.feel ? FEEL[w.feel] : ''].filter(Boolean).join(' · ')}</span></span>
            </button>`).join('') || '<p class="empty">Пока ни одной. Запиши первую: даже три подхода отжиманий считаются.</p>'}
          </section>
        </div>
        <div class="col">
          <section class="card"><div class="kpis">
            <div class="kpi"><b>${all.filter(w => w.date.startsWith(mon)).length}</b><span>за месяц</span></div>
            <div class="kpi"><b>${B.mins(minMon)}</b><span>в движении</span></div>
            <div class="kpi"><b>${B.num(dist, 1)} км</b><span>дистанция</span></div>
          </div></section>
          ${exs.length ? progressCard(st, exs) : ''}
        </div>
      </div>
    </div>`;
  }
};
function progressCard(st, exs){
  const x = st[chartEx]; if (!x) return '';
  const ws = Object.keys(x.by).map(Number).sort((a, b) => a - b);
  if (chartW == null || !x.by[chartW]) chartW = ws[0];
  const plus = w => (w > 0 ? '+' : '') + B.num(w, 1) + ' кг';
  return `<section class="card">
    <h2>${icon('chart')}Прогресс</h2>
    <div class="chips">${exs.slice(0, 8).map(e => `<button class="chip ${chartEx === e.name.toLowerCase() ? 'on' : ''}" data-act="chartEx" data-k="${esc(e.name.toLowerCase())}">${esc(e.name)}</button>`).join('')}</div>
    ${ws.length > 1 ? `<div class="chips wsel">${ws.map(w => `<button class="chip ${w === chartW ? 'on' : ''}" data-act="chartW" data-w="${w}">${plus(w)}</button>`).join('')}</div>` : ''}
    <p class="muted">Лучший подход ${plus(chartW)}: <b>${x.by[chartW].best} повт.</b> (${B.fmtS(x.by[chartW].date)})</p>
    ${lineChart(x.by[chartW].hist)}
    <table class="tbl"><thead><tr><th>Вес</th><th>Рекорд</th><th>Когда</th></tr></thead>
      <tbody>${ws.map(w => `<tr><td class="mono">${plus(w)}</td><td class="mono">${x.by[w].best} повт.</td><td class="muted">${B.fmtS(x.by[w].date)}</td></tr>`).join('')}</tbody></table>
    <p class="hint">Дома вес считается дополнительным: +0 кг значит без утяжеления.</p>
  </section>`;
}
B.acts.chartEx = el => { chartEx = el.dataset.k; chartW = null; B.render(); };
B.acts.chartW = el => { chartW = +el.dataset.w; B.render(); };

/* ---------- редактор тренировки ---------- */
function exList(){ return Object.values(exStats()).map(x => x.name); }
function form(){
  const w = W, str = STRENGTH.has(w.type), car = CARDIO.has(w.type);
  return `<h2>${w._new ? 'Новая тренировка' : 'Тренировка'}</h2>
    <div class="ed-grid">
      <label>Дата<input type="date" value="${w.date}" max="${B.today()}" data-in="wf" data-k="date"></label>
      <label>Тип<select data-in="wType">${Object.entries(B.SPORT_TYPES).map(([k, l]) => `<option value="${k}" ${w.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Минут<input type="number" min="1" inputmode="numeric" value="${w.min || ''}" data-in="wf" data-k="min"></label>
      ${car ? `<label>Дистанция, км<input type="number" min="0" step="0.1" inputmode="decimal" value="${w.dist || ''}" data-in="wf" data-k="dist"></label>` : `<label>Название<input value="${esc(w.name || '')}" placeholder="Например: турник" data-in="wf" data-k="name"></label>`}
    </div>
    ${str ? `<div class="ed-sec"><div class="sec-h">${icon('dumbbell')} Упражнения</div>
      <datalist id="exNames">${exList().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      ${(w.ex || []).map((e, i) => `<div class="ex">
        <div class="row"><input class="grow" list="exNames" value="${esc(e.name)}" placeholder="Упражнение" data-in="exName" data-i="${i}"><button class="icon-btn sm" data-act="exDel" data-i="${i}">${icon('x')}</button></div>
        <div class="sets">${(e.sets || []).map((s, j) => `<div class="set"><span class="muted mono">${j + 1}</span>
          <input type="number" min="0" inputmode="numeric" value="${s.r || ''}" placeholder="повт" data-in="setF" data-i="${i}" data-j="${j}" data-k="r"><span class="muted">×</span>
          <input type="number" min="0" step="0.5" inputmode="decimal" value="${s.w || ''}" placeholder="${w.type === 'gym' ? 'кг' : '+0 кг'}" data-in="setF" data-i="${i}" data-j="${j}" data-k="w">
          <button class="icon-btn sm" data-act="setDel" data-i="${i}" data-j="${j}">${icon('x')}</button></div>`).join('')}
          <button class="btn sm ghost" data-act="setAdd" data-i="${i}">${icon('plus')} подход</button></div>
      </div>`).join('')}
      <div class="chips">${BASIC.concat(exList().filter(n => !BASIC.includes(n))).slice(0, 6).filter(n => !(w.ex || []).some(e => e.name === n)).map(n => `<button class="chip" data-act="exQuick" data-n="${esc(n)}">${icon('plus')}${esc(n)}</button>`).join('')}
        <button class="chip" data-act="exAdd">${icon('plus')}Другое</button></div>
      ${w.type !== 'gym' ? '<p class="hint">Подход: повторы × доп. вес. Без утяжеления оставь вес пустым.</p>' : ''}</div>` : ''}
    <div class="field">Самочувствие<div class="chips">${[1, 2, 3, 4, 5].map(i => `<button class="chip ${w.feel === i ? 'on' : ''}" data-act="wFeel" data-v="${i}">${FEEL[i]}</button>`).join('')}</div></div>
    <label class="field">Заметка<textarea rows="2" data-in="wf" data-k="note" placeholder="Что получилось, что болит, что в следующий раз">${esc(w.note || '')}</textarea></label>
    <div class="row between wrap">
      ${w._new ? '<span></span>' : `<button class="btn ghost danger" data-act="wDel">${icon('trash')} Удалить</button>`}
      <div class="row">${str && (w.ex || []).length ? `<button class="btn ghost" data-act="wTplSave">В шаблоны</button>` : ''}<button class="btn primary" data-act="wSave">Сохранить</button></div>
    </div>`;
}
const redraw = () => B.sheet(form());
B.acts.wNew = () => { W = {_new: true, id: B.uid(), date: B.today(), type: 'home', min: '', ex: [], feel: 0}; redraw(); };
B.acts.wOpen = el => { W = JSON.parse(JSON.stringify(B.get('w_' + el.dataset.id))); redraw(); };
B.acts.wTpl = el => {
  const p = (B.cfg().templates || [])[+el.dataset.i]; if (!p) return;
  const st = exStats();
  W = {_new: true, id: B.uid(), date: B.today(), type: p.type || 'gym', name: p.name, min: '', feel: 0,
    ex: p.ex.map(n => ({name: n, sets: (st[n.toLowerCase()] && st[n.toLowerCase()].last ? st[n.toLowerCase()].last : [{r: '', w: ''}]).map(s => ({r: s.r, w: s.w}))}))};
  redraw();
};
B.inputs.wf = el => { W[el.dataset.k] = el.value; };
B.inputs.wType = el => { W.type = el.value; redraw(); };
B.inputs.exName = el => { W.ex[+el.dataset.i].name = el.value; };
B.inputs.setF = el => { W.ex[+el.dataset.i].sets[+el.dataset.j][el.dataset.k] = el.value; };
B.acts.exQuick = el => {
  const n = el.dataset.n, last = (exStats()[n.toLowerCase()] || {}).last;
  W.ex = (W.ex || []).concat({name: n, sets: (last && last.length ? last : [{r: '', w: ''}]).map(q => ({r: q.r, w: q.w}))});
  redraw();
};
B.acts.exAdd = () => { W.ex = (W.ex || []).concat({name: '', sets: [{r: '', w: ''}]}); redraw(); setTimeout(() => { const l = B.$$('.ex input[list]'); if (l.length) l[l.length - 1].focus(); }, 40); };
B.acts.exDel = el => { W.ex.splice(+el.dataset.i, 1); redraw(); };
B.acts.setAdd = el => { const e = W.ex[+el.dataset.i]; const last = e.sets[e.sets.length - 1] || {r: '', w: ''}; e.sets.push({r: last.r, w: last.w}); redraw(); };
B.acts.setDel = el => { W.ex[+el.dataset.i].sets.splice(+el.dataset.j, 1); redraw(); };
B.acts.wFeel = el => { W.feel = +el.dataset.v; redraw(); };
B.acts.wSave = () => {
  const isNew = W._new, w = Object.assign({}, W); delete w._new;
  w.ex = (w.ex || []).filter(e => (e.name || '').trim()).map(e => ({name: e.name.trim(), sets: (e.sets || []).filter(s => s.r || s.w).map(s => ({r: +s.r || 0, w: +s.w || 0}))}));
  w.min = +w.min || 0; w.dist = +w.dist || 0; w.at = w.at || Date.now();
  if (!w.date) w.date = B.today();
  B.put('w_' + w.id, w);
  W = null; B.closeSheet();
  if (isNew) B.xpToast(B.XP.sport, 'за тренировку');
};
B.acts.wDel = async () => {
  if (!(await B.confirm('Удалить тренировку?', 'Удалить', true))) return;
  B.put('w_' + W.id, null); W = null; B.closeSheet();
};
B.acts.wTplSave = async () => {
  const name = await B.dialog(`<h3>Шаблон тренировки</h3><label class="field">Название<input id="tplName" value="${esc(W.name || '')}" placeholder="Например, Верх А" autofocus></label>
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="tplOk">Сохранить</button></div>`);
  if (!name) return;
  const tpls = (B.cfg().templates || []).filter(p => p.name !== name).concat({name, type: W.type, ex: W.ex.map(e => e.name.trim()).filter(Boolean)});
  B.setCfg({templates: tpls}); B.toast('Шаблон сохранён'); redraw();
};
B.acts.tplOk = () => { const v = B.$('#tplName').value.trim(); if (v) B.closeDialog(v); };
})();
