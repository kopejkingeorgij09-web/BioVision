/* Режим бамбука: экран «Сегодня».
   Утренний план из трёх главных дел, задачи на сегодня, вебы ШАДа, шаг большого дела, привычки, фокус и вечерний разбор. */
(function(){
const {esc, icon} = B;
B.views = B.views || {};

function greet(){
  const h = new Date().getHours();
  if (h < 5) return 'Поздно. Разбор и спать';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
B.levelCard = (c, compact) => {
  const {next} = B.mileFor(c.height);
  return `<a class="lvl ${compact ? 'compact' : ''}" href="#/bamboo">
    <div class="lvl-ring">${B.ring(c.frac, 58)}<b>${c.level}</b></div>
    <div class="lvl-body">
      <div class="lvl-top"><span>Уровень ${c.level}</span><span class="mono">${c.into}/${c.need} XP</span></div>
      ${B.bar(c.frac, 'xp')}
      <div class="lvl-sub">${icon('bamboo')} бамбук <b>${B.fmtH(c.height)}</b>${next ? ` · до «${esc(next[1])}» ${B.fmtH(next[0] - c.height)}` : ''}</div>
    </div>
    <div class="streak ${c.live ? 'on' : ''}" title="Серия закрытых дней">${icon('flame')}<b>${c.live}</b></div>
  </a>`;
};

function yesterdayNote(c){
  const y = B.add(c.today, -1), r = c.days[y];
  if (!r) return '';
  if (r.result === 'good') return `<div class="note good">${icon('leaf')}<div><b>Вчера день закрыт.</b> ${r.xp > 0 ? '+' + r.xp + ' XP, ' : ''}серия ${c.streak} ${B.plural(c.streak, 'день', 'дня', 'дней')}. Держи темп.</div></div>`;
  if (r.result === 'frozen') return `<div class="note frozen">${icon('moon')}<div><b>Вчера день не закрыт, сработала заморозка недели.</b> Серия сохранена, но следующий провал на этой неделе уже со штрафом. <a href="#/journal/${y}">Что помешало?</a></div></div>`;
  if (r.result === 'fail') return `<div class="note bad">${icon('leaf')}<div><b>Вчера день не закрыт: ${B.XP.fail} XP, на бамбуке сухой лист.</b> ${!r.top ? 'Не было плана.' : r.topDone < r.needTop ? `Главных дел сделано ${r.topDone} из ${r.top}.` : ''} ${!r.review ? 'Не написан разбор.' : ''} <a href="#/journal/${y}">Разобрать вчера</a></div></div>`;
  return '';
}

function steps(c, d){
  const r = c.days[c.today] || {top: 0, topDone: 0, needTop: 0};
  const daily = B.habits().filter(h => h.kind !== 'weekly');
  const hd = daily.filter(h => B.habitDone(h, c.today)).length;
  const st = [
    {ok: r.top > 0, label: 'План', sub: r.top ? `${r.top} ${B.plural(r.top, 'дело', 'дела', 'дел')}` : 'нет'},
    {ok: r.top > 0 && r.topDone >= r.needTop, label: 'Главное', sub: `${r.topDone}/${r.needTop || 2}`},
    {ok: daily.length > 0 && hd === daily.length, label: 'Привычки', sub: `${hd}/${daily.length}`, soft: true},
    {ok: B.hasReview(d), label: 'Разбор', sub: B.hasReview(d) ? 'есть' : 'вечером'}
  ];
  const must = st.filter(s => !s.soft), done = must.filter(s => s.ok).length;
  return `<section class="card day-steps">
    <div class="row between"><h2>День закрыт на ${Math.round(done / must.length * 100)}%</h2><span class="muted mono">${r.xp > 0 ? '+' : ''}${(c.days[c.today] || {}).xp || 0} XP сегодня</span></div>
    ${B.bar(done / must.length, 'day')}
    <ol class="steps">${st.map(s => `<li class="${s.ok ? 'ok' : ''}"><i>${s.ok ? icon('check') : ''}</i><b>${s.label}</b><span>${s.sub}</span></li>`).join('')}</ol>
    <p class="hint">Для закрытия дня нужны план, два главных дела из трёх и вечерний разбор. Привычки дают опыт отдельно.</p>
  </section>`;
}

function planCard(c, d){
  const top = (d.top || []).map(B.task).filter(Boolean);
  if (!top.length || B._editPlan){
    const ids = new Set(d.top || []);
    const cand = B.candidates().filter(t => !ids.has(t.id)).slice(0, 8);
    return `<section class="card plan">
      <div class="row between"><h2>${icon('sun')}Утренний план</h2>${top.length ? `<button class="btn sm ghost" data-act="planDone">Готово</button>` : ''}</div>
      <p class="hint">Выбери до трёх главных дел на сегодня. Первое пусть будет самым неприятным: его делаешь до обеда, пока есть силы.</p>
      ${top.length ? `<div class="tasks">${top.map((t, i) => `<div class="pick on"><span class="n">${i + 1}</span><span class="grow">${esc(t.title)}</span><button class="icon-btn sm" data-act="topDel" data-id="${t.id}">${icon('x')}</button></div>`).join('')}</div>` : ''}
      ${top.length < 3 ? `<div class="add-line"><input id="topNew" placeholder="Новое главное дело" data-enter="topNew"><button class="btn sm" data-act="topNew">${icon('plus')}</button></div>
      ${cand.length ? `<div class="pick-list">${cand.map(t => `<button class="pick" data-act="topAdd" data-id="${t.id}">${icon('plus')}<span class="grow">${esc(t.title)}</span>${t.due ? B.dueLabel(t) : ''}</button>`).join('')}</div>` : ''}` : ''}
    </section>`;
  }
  const done = top.filter(t => t.done).length;
  return `<section class="card plan">
    <div class="row between"><h2>${icon('star')}Главное сегодня <span class="muted">${done}/${top.length}</span></h2><button class="btn sm ghost" data-act="planEdit">Изменить</button></div>
    <div class="tasks">${top.map((t, i) => B.taskRow(t, {frog: i === 0 && !t.done, cls: 'top'})).join('')}</div>
  </section>`;
}

function todayTasks(c, d){
  const t = c.today, ids = new Set(d.top || []);
  const list = B.tasks().filter(x => !ids.has(x.id) && !x.done && x.due && x.due <= t)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.pri || 4) - (b.pri || 4) || (a.time || '99').localeCompare(b.time || '99'));
  const doneToday = B.tasks().filter(x => x.done && x.doneAt && B.dayOf(x.doneAt) === t && !ids.has(x.id));
  const late = list.filter(x => x.due < t).length;
  return `<section class="card">
    <div class="row between"><h2>${icon('list')}Дела на сегодня</h2>${late ? `<span class="tag late">${late} просрочено</span>` : ''}</div>
    <div class="add-line quick"><input id="quickToday" placeholder="Добавить дело на сегодня" data-enter="quickToday"><button class="btn sm" data-act="quickToday">${icon('plus')}</button></div>
    ${list.length ? `<div class="tasks">${list.map(x => B.taskRow(x)).join('')}</div>` : `<p class="empty">На сегодня больше ничего. Можно взять шаг большого дела.</p>`}
    ${doneToday.length ? `<details class="done-fold"><summary>Сделано сегодня: ${doneToday.length}</summary><div class="tasks">${doneToday.map(x => B.taskRow(x)).join('')}</div></details>` : ''}
  </section>`;
}

const SHORT = ['Не начат', 'Смотрю', 'Веб ✓', 'ДЗ ✓', 'Закрыт'];
B.shadRow = (it, date) => {
  const p = it.p, s = B.shadStage(p.n), course = B.shad.courses[p.c] || {};
  const ok = s >= it.need, late = !ok && date < B.today();
  return `<div class="shad-row ${ok ? 'ok' : ''} ${late ? 'late' : ''}">
    <div class="shad-top"><span class="cchip c-${p.c}">${esc(course.name || p.c)}</span><span class="mono">${it.kind === 'web' ? 'Веб' : 'ДЗ'} ${esc(p.code)}</span>${it.from ? `<span class="mono muted">${it.from}–${it.to}</span>` : `<span class="muted">${B.fmtS(it.kind === 'web' ? p.w.date : p.h.date)}</span>`}</div>
    <div class="shad-title">${esc(p.t)}</div>
    <div class="seg" role="group" aria-label="Стадия">${B.SHAD_STAGES.map((l, i) => `<button class="${s === i ? 'on' : ''} ${i <= s ? 'fill' : ''}" data-act="shadSet" data-n="${p.n}" data-s="${i}" title="${l}">${SHORT[i]}</button>`).join('')}</div>
  </div>`;
};
B.acts.shadSet = el => {
  const n = +el.dataset.n, s = +el.dataset.s, cur = B.shadStage(n);
  B.setShadStage(n, cur === s ? Math.max(0, s - 1) : s);
};
function shadCard(c){
  const items = B.shadOn(c.today), late = B.shadLate().filter(x => !items.some(y => y.p.n === x.p.n)).slice(0, 3);
  if (!items.length && !late.length) return '';
  return `<section class="card">
    <div class="row between"><h2>${icon('chart')}ШАД</h2><a class="muted" href="../shad/">трекер →</a></div>
    ${items.map(it => B.shadRow(it, c.today)).join('')}
    ${late.length ? `<div class="sub-h">Хвосты</div>${late.map(it => B.shadRow(it, '0')).join('')}` : ''}
  </section>`;
}

function bigCard(){
  const big = B.tasks().filter(t => t.big && !t.done);
  if (!big.length) return '';
  return `<section class="card big-card">
    <h2>${icon('steps')}Большие дела: шаг на сегодня</h2>
    <p class="hint">Не надо делать всё. Один шаг в день, и через месяц семестровая домашка закрыта.</p>
    ${big.slice(0, 3).map(t => {
      const st = B.nextStep(t), subs = t.subs || [], d = subs.filter(s => s.done).length;
      return `<div class="big-row">
        <button class="big-title" data-act="openTask" data-id="${t.id}">${esc(t.title)}<span class="muted mono">${d}/${subs.length}</span></button>
        ${B.bar(subs.length ? d / subs.length : 0)}
        ${st ? `<div class="step"><button class="chk sm" data-act="stepDone" data-id="${t.id}" data-sid="${st.id}">${icon('check')}</button><span class="grow">${esc(st.t)}</span><button class="btn sm primary" data-act="subFocus" data-id="${t.id}" data-sid="${st.id}">${icon('play')}25 мин</button></div>`
          : `<button class="btn sm" data-act="openTask" data-id="${t.id}">${icon('plus')} Разбить на шаги</button>`}
      </div>`;
    }).join('')}
  </section>`;
}
B.acts.stepDone = el => {
  const t = B.task(el.dataset.id);
  const subs = (t.subs || []).map(s => s.id === el.dataset.sid ? Object.assign({}, s, {done: true, doneAt: Date.now()}) : s);
  B.saveTask(Object.assign({}, t, {subs}));
  B.xpToast(B.XP.sub, 'шаг сделан');
};

B.habitChip = (h, date) => {
  const done = B.habitDone(h, date);
  let sub = '';
  if (h.auto === 'read'){ const m = B.readMin(date); sub = `${m}/${h.min || 30} мин`; }
  else if (h.kind === 'weekly'){ const ws = B.weekStart(date); let k = 0; for (let i = 0; i < 7; i++) if (B.habitDone(h, B.add(ws, i))) k++; sub = `${k}/${h.target || 3} за неделю`; }
  const act = h.auto === 'read' ? 'href="#/read"' : h.auto === 'sport' ? 'href="#/sport"' : '';
  const tag = act ? 'a' : 'button';
  return `<${tag} class="hchip ${done ? 'on' : ''}" ${act || `data-act="habitToggle" data-id="${h.id}" data-d="${date}"`}>
    <i>${done ? icon('check') : icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b>${sub ? `<small>${sub}</small>` : ''}</span></${tag}>`;
};
B.acts.habitToggle = el => {
  const id = el.dataset.id, date = el.dataset.d;
  let on = false;
  B.editDay(date, d => { d.h = d.h || {}; if (d.h[id]) delete d.h[id]; else { d.h[id] = 1; on = true; } });
  if (on) B.xpToast(B.XP.habit, 'привычка');
};
function habitsCard(c){
  const hs = B.habits(); if (!hs.length) return '';
  return `<section class="card">
    <div class="row between"><h2>${icon('habit')}Привычки</h2><a class="muted" href="#/habits">все →</a></div>
    <div class="hchips">${hs.map(h => B.habitChip(h, c.today)).join('')}</div>
  </section>`;
}

function focusCard(c, d){
  const pomo = d.pomo || [], min = pomo.reduce((a, p) => a + (p.min || 0), 0);
  const tm = B.timerState && B.timerState();
  return `<section class="card focus-mini">
    <div class="grow"><h2>${icon('timer')}Фокус</h2><p class="muted">${pomo.length ? `${pomo.length} ${B.plural(pomo.length, 'помидор', 'помидора', 'помидоров')} · ${B.mins(min)}` : 'Сегодня ещё ни одного помидора'}</p></div>
    ${tm && tm.running ? `<a class="btn primary" href="#/focus">${icon('timer')} Идёт таймер</a>` : `<button class="btn" data-act="five">5 минут</button><a class="btn primary" href="#/focus">${icon('play')} 25 минут</a>`}
  </section>`;
}
B.acts.five = () => B.startFocus(null, null, 5);

function reviewCard(c, d){
  const has = B.hasReview(d), h = new Date().getHours();
  if (has) return `<section class="card review done"><h2>${icon('pen')}Разбор дня написан</h2><p class="muted">${d.review.mood ? 'Настроение ' + '●'.repeat(d.review.mood) + ' · ' : ''}<a href="#/journal">открыть дневник</a></p></section>`;
  return `<section class="card review ${h >= 19 || h < 4 ? 'hot' : ''}">
    <h2>${icon('pen')}Вечерний разбор</h2>
    <p class="hint">Пять минут перед сном: что сделал, что не вышло и почему, что главное завтра. Без разбора день не закрывается.</p>
    <a class="btn ${h >= 19 || h < 4 ? 'primary' : ''}" href="#/journal">Написать разбор</a>
  </section>`;
}

function insightsCard(){
  const tips = (B.insights ? B.insights() : []).slice(0, 2);
  if (!tips.length) return '';
  return `<section class="card insights"><h2>${icon('sparkle')}Подсказки</h2>
    <ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>
    <button class="btn sm ghost" data-act="aiWeek">${icon('sparkle')} Разобрать неделю в Claude</button></section>`;
}

B.views.today = {
  title: 'Сегодня',
  render(){
    const c = B.calc(), d = B.day(c.today);
    const date = B.parse(c.today);
    return `<div class="page today">
      <header class="page-h">
        <div><div class="eyebrow">${B.WDF[B.wd(c.today)]}, ${date.getDate()} ${B.MONG[date.getMonth()]}</div><h1>${greet()}</h1></div>
      </header>
      ${B.levelCard(c)}
      ${yesterdayNote(c)}
      <div class="cols">
        <div class="col">
          ${planCard(c, d)}
          ${todayTasks(c, d)}
          ${shadCard(c)}
          ${bigCard()}
        </div>
        <div class="col">
          ${steps(c, d)}
          ${habitsCard(c)}
          ${focusCard(c, d)}
          ${reviewCard(c, d)}
          ${insightsCard()}
        </div>
      </div>
    </div>`;
  }
};

/* план дня */
B.acts.topAdd = el => {
  const t = B.today(); let n = 0;
  B.editDay(t, d => { d.top = (d.top || []).filter(id => B.task(id)); if (d.top.length < 3 && !d.top.includes(el.dataset.id)) d.top.push(el.dataset.id); d.planAt = d.planAt || Date.now(); n = d.top.length; });
  const tk = B.task(el.dataset.id);
  if (tk && !tk.due) B.updTask(tk.id, {due: t});
  if (n >= 3) B._editPlan = false;
};
B.acts.topDel = el => B.editDay(B.today(), d => { d.top = (d.top || []).filter(id => id !== el.dataset.id); });
B.acts.topNew = () => {
  const inp = B.$('#topNew'), v = inp.value.trim(); if (!v) return;
  const tk = B.addQuick(v, {due: B.today()}); if (!tk) return;
  if (!tk.due) B.updTask(tk.id, {due: B.today()}, true);
  B.acts.topAdd({dataset: {id: tk.id}});
  setTimeout(() => { const i = B.$('#topNew'); if (i) i.focus(); }, 30);
};
B.acts.planEdit = () => { B._editPlan = true; B.render(); };
B.acts.planDone = () => { B._editPlan = false; B.render(); };
B.acts.quickToday = () => {
  const inp = B.$('#quickToday'), v = inp.value.trim(); if (!v) return;
  const tk = B.addQuick(v, {due: B.today()});
  if (tk) B.toast(`Добавлено: ${esc(tk.title)}${tk.due !== B.today() ? ' · ' + B.rel(tk.due) : ''}`);
  setTimeout(() => { const i = B.$('#quickToday'); if (i) i.focus(); }, 30);
};
})();
