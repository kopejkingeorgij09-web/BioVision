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
    {ok: B.reviewDone(c.today), label: 'Разбор', sub: B.reviewDone(c.today) ? 'есть' : B.hasReview(d) ? 'нет плана' : 'вечером'}
  ];
  const must = st.filter(s => !s.soft), done = must.filter(s => s.ok).length;
  return `<section class="card day-steps">
    <div class="row between"><h2>День закрыт на ${Math.round(done / must.length * 100)}%</h2><span class="muted mono">${r.xp > 0 ? '+' : ''}${(c.days[c.today] || {}).xp || 0} XP сегодня</span></div>
    ${B.bar(done / must.length, 'day')}
    <ol class="steps">${st.map(s => `<li class="${s.ok ? 'ok' : ''}"><i>${s.ok ? icon('check') : ''}</i><b>${s.label}</b><span>${s.sub}</span></li>`).join('')}</ol>
    <p class="hint">Для закрытия дня нужны план, два главных дела из трёх и вечерний разбор с планом на завтра. Привычки дают опыт отдельно.</p>
  </section>`;
}

/* редактор плана на любой день: до трёх главных дел и «если-то» к каждому (когда и где) */
B.planPicker = (date, hint) => {
  const d = B.day(date), when = d.when || {};
  const top = (d.top || []).map(B.task).filter(Boolean);
  const ids = new Set(d.top || []);
  const cand = top.length < 3 ? B.candidates(date).filter(t => !ids.has(t.id)).slice(0, 6) : [];
  return `<div class="planpick" data-d="${date}">
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    ${top.map((t, i) => `<div class="pick on"><span class="n">${i + 1}</span><span class="grow"><b>${esc(t.title)}</b>
      <input class="ifthen" value="${esc(when[t.id] || '')}" placeholder="Когда и где? Например: в 16:00 в библиотеке" data-in="ifthen" data-d="${date}" data-id="${t.id}"></span>
      <button class="icon-btn sm" data-act="topDel" data-d="${date}" data-id="${t.id}" aria-label="Убрать">${icon('x')}</button></div>`).join('')}
    ${top.length < 3 ? `<div class="add-line"><input class="top-new" placeholder="${top.length ? 'Ещё одно главное дело' : 'Главное дело'}" data-enter="topNew" data-d="${date}"><button class="btn sm" data-act="topNew" data-d="${date}">${icon('plus')}</button></div>
    ${cand.length ? `<div class="pick-list">${cand.map(t => `<button class="pick" data-act="topAdd" data-d="${date}" data-id="${t.id}">${icon('plus')}<span class="grow">${esc(t.title)}</span>${t.due ? B.dueLabel(t) : ''}</button>`).join('')}</div>` : ''}` : ''}
  </div>`;
};

function planCard(c, d){
  const top = (d.top || []).map(B.task).filter(Boolean);
  if (!top.length || B._editPlan){
    return `<section class="card plan">
      <div class="row between"><h2>${icon('sun')}План на сегодня</h2>${top.length ? `<button class="btn sm ghost" data-act="planDone">Готово</button>` : ''}</div>
      ${B.planPicker(c.today, 'До трёх главных дел. Первое самое неприятное, его делаешь до обеда. Допиши, когда и где сядешь за каждое: так план превращается в решение.')}
    </section>`;
  }
  const done = top.filter(t => t.done).length, when = d.when || {};
  return `<section class="card plan">
    <div class="row between"><h2>${icon('star')}Главное сегодня <span class="muted">${done}/${top.length}</span></h2><button class="btn sm ghost" data-act="planEdit">Изменить</button></div>
    <div class="tasks">${top.map((t, i) => B.taskRow(t, {frog: i === 0 && !t.done, cls: 'top', when: when[t.id]})).join('')}</div>
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
    <div class="shad-top"><span class="cchip c-${p.c}">${esc(course.name || p.c)}</span><span class="mono">${it.kind === 'web' ? '' : 'ДЗ · '}${esc(p.code)}</span>${it.from ? `<span class="mono muted">${it.from}–${it.to}</span>` : `<span class="muted">${it.kind === 'hw' ? 'до ' : ''}${B.fmtS(it.kind === 'web' ? p.w.date : p.h.date)}</span>`}</div>
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

function deadlineCard(c){
  const list = B.tasks().filter(t => t.dl && !t.done && t.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  if (!list.length) return '';
  return `<section class="card dl-card"><h2>${icon('flame')}Дедлайны</h2>
    ${list.map(t => { const k = B.diff(c.today, t.due), subs = t.subs || [], dn = subs.filter(x => x.done).length;
      return `<button class="dl-row ${k < 0 ? 'late' : k <= 3 ? 'near' : ''}" data-act="openTask" data-id="${t.id}">
        <span class="dl-n"><b>${k < 0 ? -k : k}</b><small>${k < 0 ? 'дн. назад' : k === 0 ? 'сегодня' : B.plural(k, 'день', 'дня', 'дней')}</small></span>
        <span class="grow"><span class="task-title">${esc(t.title)}</span><span class="task-meta">${B.fmtW(t.due)}${subs.length ? ` · шагов ${dn}/${subs.length}` : ''}</span>${subs.length ? B.bar(dn / subs.length, 'thin') : ''}</span>
      </button>`; }).join('')}
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
  const val = B.habitVal(h, date), done = val > 0;
  let sub = '';
  if (h.auto === 'read'){ const m = B.readMin(date); sub = `${m}/${h.min || 30} мин`; }
  else if (h.kind === 'weekly'){ const ws = B.weekStart(date); let k = 0; for (let i = 0; i < 7; i++) if (B.habitDone(h, B.add(ws, i))) k++; sub = `${k}/${h.target || 3} за неделю`; }
  const act = h.auto === 'read' ? 'href="#/read"' : h.auto === 'sport' ? 'href="#/sport"' : '';
  const tag = act ? 'a' : 'button';
  if (val === 0.5) sub = 'минимум' + (h.mini ? ': ' + esc(h.mini) : '');
  else if (!done && h.mini && !h.auto) sub = 'хотя бы: ' + esc(h.mini);
  return `<${tag} class="hchip ${done ? 'on' : ''} ${val === 0.5 ? 'half' : ''}" ${act || `data-act="habitToggle" data-id="${h.id}" data-d="${date}"`}>
    <i>${done ? icon('check') : icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b>${sub ? `<small>${sub}</small>` : ''}</span></${tag}>`;
};
/* нажатие: нет → сделано → минимум (если задан) → нет */
B.acts.habitToggle = el => {
  const id = el.dataset.id, date = el.dataset.d, h = B.get('h_' + id) || {};
  let gain = 0;
  B.editDay(date, d => {
    d.h = d.h || {}; const v = d.h[id];
    if (!v){ d.h[id] = 1; gain = B.XP.habit; }
    else if (v === 1 && h.mini){ d.h[id] = 0.5; gain = -B.XP.habit / 2; }
    else delete d.h[id];
  });
  if (gain > 0) B.xpToast(gain, 'привычка');
  else if (gain < 0) B.toast('Отмечена минимальная версия: серия держится, опыт вдвое меньше');
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
  const has = B.reviewDone(c.today), h = new Date().getHours();
  if (has) return `<section class="card review done"><h2>${icon('pen')}Разбор дня написан</h2><p class="muted">${d.review.mood ? 'Настроение ' + '●'.repeat(d.review.mood) + ' · ' : ''}<a href="#/journal">открыть дневник</a></p></section>`;
  return `<section class="card review ${h >= 19 || h < 4 ? 'hot' : ''}">
    <h2>${icon('pen')}Вечерний разбор</h2>
    <p class="hint">Пять минут перед сном: что сделал, что не вышло и почему, и три главных дела на завтра. Без этого день не закрывается.</p>
    <a class="btn ${h >= 19 || h < 4 ? 'primary' : ''}" href="#/journal">Написать разбор</a>
  </section>`;
}

function weekCard(c){
  const ws = B.weekStart(c.today), prev = B.get('wk_' + B.add(ws, -7)), cur = B.get('wk_' + ws);
  let html = '';
  if (prev && (prev.change || '').trim()) html += `<section class="card week-note"><div class="eyebrow">На этой неделе меняю</div><p>${esc(prev.change)}</p></section>`;
  if (B.wd(c.today) >= 5 && !(cur && (cur.change || '').trim())) html += `<a class="card week-cta" href="#/stats">${icon('chart')}<span class="grow"><b>Подведи итоги недели</b><small>5 минут: что мешало и что меняешь</small></span>${icon('right')}</a>`;
  return html;
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
      ${weekCard(c)}
      <div class="cols">
        <div class="col">
          ${planCard(c, d)}
          ${todayTasks(c, d)}
          ${deadlineCard(c)}
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
const pdate = el => el.dataset.d || B.today();
B.acts.topAdd = el => {
  const t = pdate(el); let n = 0;
  B.editDay(t, d => { d.top = (d.top || []).filter(id => B.task(id)); if (d.top.length < 3 && !d.top.includes(el.dataset.id)) d.top.push(el.dataset.id); d.planAt = d.planAt || Date.now(); n = d.top.length; });
  const tk = B.task(el.dataset.id);
  if (tk && (!tk.due || tk.due < t)) B.updTask(tk.id, {due: t});
  if (t === B.today()) B._editPlan = n < 3;
};
B.acts.topDel = el => B.editDay(pdate(el), d => { d.top = (d.top || []).filter(id => id !== el.dataset.id); });
B.acts.topNew = el => {
  const box = el.closest('.planpick'), inp = box && box.querySelector('.top-new'), t = pdate(el);
  const v = inp ? inp.value.trim() : ''; if (!v) return;
  const tk = B.addQuick(v, {due: t}); if (!tk) return;
  B.acts.topAdd({dataset: {id: tk.id, d: t}});
  setTimeout(() => { const i = B.$(`.planpick[data-d="${t}"] .top-new`); if (i) i.focus(); }, 30);
};
B.inputs.ifthen = el => B.editDay(el.dataset.d, d => { d.when = Object.assign({}, d.when, {[el.dataset.id]: el.value}); }, true);
B.acts.planEdit = () => { B._editPlan = true; B.render(); };
B.acts.planDone = () => { B._editPlan = false; B.render(); };
B.acts.quickToday = () => {
  const inp = B.$('#quickToday'), v = inp.value.trim(); if (!v) return;
  const tk = B.addQuick(v, {due: B.today()});
  if (tk) B.toast(`Добавлено: ${esc(tk.title)}${tk.due !== B.today() ? ' · ' + B.rel(tk.due) : ''}`);
  setTimeout(() => { const i = B.$('#quickToday'); if (i) i.focus(); }, 30);
};
})();
