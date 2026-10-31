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
  if (r.result === 'fail') return `<div class="note bad">${icon('leaf')}<div><b>Вчера день не закрыт: ${B.XP.fail} XP, на бамбуке сухой лист.</b> ${!r.top ? 'Не было плана.' : r.top < 2 ? 'В плане было меньше двух дел.' : r.topDone < 2 ? `Главных дел сделано ${r.topDone} из ${r.top}.` : ''} ${!r.review ? 'Не написан разбор.' : ''} <a href="#/journal/${y}">Разобрать вчера</a></div></div>`;
  return '';
}

function steps(c, d){
  const r = c.days[c.today] || {top: 0, topDone: 0, needTop: 0};
  const daily = B.habits().filter(h => h.kind !== 'weekly'), weekly = B.habits().filter(h => h.kind === 'weekly');
  const hd = daily.filter(h => B.habitDone(h, c.today)).length;
  const st = [
    {ok: r.top >= 2 && r.topDone >= 2, label: 'Главное', sub: !r.top ? 'нет плана' : r.top < 2 ? 'нужно 2 дела' : `${r.topDone}/2`},
    {ok: daily.length > 0 && hd === daily.length, label: 'Ежедневные', sub: `${hd}/${daily.length}`, soft: true},
    {ok: B.reviewDone(c.today), label: 'Разбор', sub: B.reviewDone(c.today) ? 'есть' : B.hasReview(d) ? 'нет плана' : 'вечером'}
  ];
  const must = st.filter(s => !s.soft), done = must.filter(s => s.ok).length;
  return `<section class="card day-steps">
    <div class="row between"><h2>День закрыт на ${Math.round(done / must.length * 100)}%</h2><span class="muted mono">${r.xp > 0 ? '+' : ''}${(c.days[c.today] || {}).xp || 0} XP сегодня</span></div>
    ${B.bar(done / must.length, 'day')}
    <ol class="steps s3">${st.map(s => `<li class="${s.ok ? 'ok' : ''}"><i>${s.ok ? icon('check') : ''}</i><b>${s.label}</b><span>${s.sub}</span></li>`).join('')}</ol>
    ${weekly.length ? `<div class="wk-line">${weekly.map(h => { let k = 0; const ws = B.weekStart(c.today); for (let i = 0; i < 7; i++) if (B.habitDone(h, B.add(ws, i))) k++;
      return `<span class="${k >= (h.target || 3) ? 'ok' : ''}">${icon(h.icon || 'habit')}${esc(h.name)} на неделе <b>${k}/${h.target || 3}</b></span>`; }).join('')}</div>` : ''}
    <p class="hint">День закрывают два сделанных главных дела (в плане хотя бы два) и вечерний разбор с планом на завтра. Привычки дают опыт отдельно.</p>
  </section>`;
}

/* редактор плана на любой день: до трёх главных дел и «если-то» к каждому (когда и где) */
/* список дел на день с коронами: коронованные (главные, до трёх) наверху, остальные ниже, по важности.
   Используется на «Сегодня» и в вечернем разборе для завтрашнего дня. */
let qCrown = false, qPri = 4;
B.dayList = (date, opts = {}) => {
  const d = B.day(date), ids = d.top || [], t = B.today();
  const crowned = ids.map(B.task).filter(x => x && !x.deleted);
  const cset = new Set(crowned.map(x => x.id));
  const rest = B.tasks().filter(x => !cset.has(x.id) && !x.done && x.due && x.due <= date)
    .sort((a, b) => (a.pri || 4) - (b.pri || 4) || a.due.localeCompare(b.due) || (a.time || '99').localeCompare(b.time || '99'));
  const doneDay = date === t ? B.tasks().filter(x => x.done && x.doneAt && B.dayOf(x.doneAt) === t && !cset.has(x.id)) : [];
  const n = crowned.length, nd = crowned.filter(x => x.done).length;
  const row = x => B.taskRow(x, {crownDate: date, when: (d.when || {})[x.id], cls: cset.has(x.id) ? 'crowned' : ''});
  return `<div class="daylist" data-d="${date}">
    <div class="crown-meter ${n >= 2 ? (nd >= 2 ? 'ok' : 'set') : ''}">${icon('crown')}<span>${n < 2 ? `Отметь короной ${n ? 'ещё одно главное дело' : 'два-три главных дела'}` : `Главных сделано ${nd} из ${n}`}</span>
      <i>${[0, 1, 2].map(i => `<b class="${i < nd ? 'done' : i < n ? 'on' : ''}"></b>`).join('')}</i></div>
    <div class="add-line quick">
      <button class="icon-btn qcrown ${qCrown ? 'on' : ''}" data-act="qCrown" title="Сразу главным">${icon('crown')}</button>
      <button class="icon-btn qflag p${qPri}" data-act="qPri" title="Важность: ${B.PRI[qPri]}">${icon('flag')}</button>
      <input class="day-new" placeholder="${opts.ph || 'Новое дело'}" data-enter="dayNew" data-d="${date}" autocomplete="off">
      <button class="btn sm" data-act="dayNew" data-d="${date}">${icon('plus')}</button></div>
    <div class="tasks">${crowned.map(row).join('')}${rest.map(row).join('')}</div>
    ${!crowned.length && !rest.length ? `<p class="empty sm">${opts.empty || 'Дел на этот день пока нет.'}</p>` : ''}
    ${doneDay.length ? `<details class="done-fold"><summary>Ещё сделано сегодня: ${doneDay.length}</summary><div class="tasks">${doneDay.map(x => B.taskRow(x)).join('')}</div></details>` : ''}
  </div>`;
};
B.planPicker = date => B.dayList(date, {ph: 'Дело на завтра', empty: 'На завтра пока ничего. Добавь дела и отметь главные короной.'});

function dayCard(c, d){
  const late = B.tasks().filter(x => !x.done && x.due && x.due < c.today).length;
  return `<section class="card plan">
    <div class="row between"><h2>${icon('list')}Дела на сегодня</h2>${late ? `<span class="tag late">${late} просрочено</span>` : ''}</div>
    ${B.dayList(c.today)}
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
  const act = h.auto === 'read' ? 'data-act="readQuick"' : h.auto === 'sport' ? 'data-act="sportQuick"' : h.auto === 'night' ? 'href="#/journal"' : '';
  if (h.auto === 'night' && !done) sub = (new Date().getHours() >= 1 && new Date().getHours() < 4) || date < B.today() ? 'разбор не до 01:00' : 'разбор до 01:00';
  if (val === 0.5) sub = 'минимум' + (h.mini ? ': ' + esc(h.mini) : '');
  else if (!done && h.mini && !h.auto) sub = 'хотя бы: ' + esc(h.mini);
  return `<${act.startsWith('href') ? 'a' : 'button'} class="hchip ${done ? 'on' : ''} ${val === 0.5 ? 'half' : ''}" ${act || `data-act="habitToggle" data-id="${h.id}" data-d="${date}"`}>
    <i>${done ? icon('check') : icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b>${sub ? `<small>${sub}</small>` : ''}</span></${act.startsWith('href') ? 'a' : 'button'}>`;
};
/* чтение одним нажатием: дописывает минуты до цели дня (по умолчанию 30) к книге, которую читаешь */
B.acts.readQuick = async () => {
  const t = B.today(), h = B.get('h_read') || {}, goal = h.min || B.cfg().readGoal || 30;
  if (B.readMin(t) >= goal){
    // второе нажатие отменяет: сначала убираем минуты, добавленные этой кнопкой, иначе последнюю запись
    let gone = 0;
    B.editDay(t, d => { const r = d.read || [], q = r.filter(x => x.quick); const drop = q.length ? q : r.slice(-1); gone = drop.reduce((a, x) => a + (x.min || 0), 0); d.read = r.filter(x => !drop.includes(x)); });
    B.toast(`Чтение отменено: −${gone} мин`);
    return;
  }
  const add = Math.max(1, goal - B.readMin(t)), reading = B.books().filter(b => b.status === 'reading');
  const log = book => {
    B.editDay(t, d => { d.read = (d.read || []).concat({book: book ? book.id : null, min: add, at: Date.now(), quick: true}); });
    B.toast(`<b class="pos">+${add} мин чтения</b>${book ? ' · ' + esc(book.title) : ''}`);
  };
  if (reading.length <= 1) return log(reading[0]);
  const pick = await B.dialog(`<h3>Что читал?</h3><div class="pick-list">${reading.map(b => `<button class="pick" data-act="readPick" data-id="${b.id}"><span class="grow">${esc(b.title)}</span><span class="muted">${esc(b.author || '')}</span></button>`).join('')}
    <button class="pick" data-act="readPick" data-id="">Другое</button></div>
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button></div>`);
  if (pick === false || pick == null) return;
  log(pick ? B.get('b_' + pick) : null);
};
B.acts.readPick = el => B.closeDialog(el.dataset.id);
/* тренировка одним нажатием, второе нажатие снимает */
B.acts.sportQuick = () => B.toggleSport(B.today());
/* нажатие: нет ↔ сделано; долгое нажатие ставит минимальную версию (если она задана) */
let lpT = 0, lpDone = false;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.hchip[data-act=habitToggle]'); if (!el) return;
  lpDone = false; clearTimeout(lpT);
  lpT = setTimeout(() => {
    const h = B.get('h_' + el.dataset.id) || {}; if (!h.mini) return;
    lpDone = true;
    B.editDay(el.dataset.d, d => { d.h = Object.assign({}, d.h, {[h.id]: 0.5}); });
    try { navigator.vibrate && navigator.vibrate(30); } catch (er) {}
    B.toast('Минимальная версия: серия держится, опыт вдвое меньше');
  }, 550);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => clearTimeout(lpT), true));
document.addEventListener('contextmenu', e => { if (e.target.closest('.hchip')) e.preventDefault(); });
B.acts.habitToggle = el => {
  if (lpDone){ lpDone = false; return; }
  const id = el.dataset.id, date = el.dataset.d;
  let on = false;
  B.editDay(date, d => { d.h = Object.assign({}, d.h); if (d.h[id]) delete d.h[id]; else { d.h[id] = 1; on = true; } });
  if (on) B.xpToast(B.XP.habit, 'привычка'); else B.toast('Отметка снята');
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
    <div class="grow"><h2>${icon('timer')}Фокус</h2><p class="muted">${min ? `Сегодня ${B.mins(min)} фокуса` : 'Сегодня фокуса ещё не было'}</p></div>
    ${tm && tm.running ? `<a class="btn primary" href="#/focus">${icon('timer')} Идёт таймер</a>` : `<button class="btn" data-act="five">5 минут</button><a class="btn primary" href="#/focus">${icon('play')} Начать</a>`}
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
          ${dayCard(c, d)}
          ${focusCard(c, d)}
          ${reviewCard(c, d)}
        </div>
        <div class="col">
          ${steps(c, d)}
          ${habitsCard(c)}
          ${deadlineCard(c)}
          ${shadCard(c)}
          ${bigCard()}
          ${insightsCard()}
        </div>
      </div>
    </div>`;
  }
};

/* план дня */
const pdate = el => el.dataset.d || B.today();
/* корона: сделать дело главным на день (не больше трёх) или снять */
B.acts.crown = async el => {
  const t = pdate(el), id = el.dataset.id, d = B.day(t);
  if ((d.top || []).includes(id)){ B.editDay(t, x => { x.top = (x.top || []).filter(i => i !== id); }); return; }
  const live = (d.top || []).filter(i => { const k = B.task(i); return k && !k.deleted; });
  if (live.length >= 3){ B.toast('Главных уже три. Сними корону с одного, чтобы поставить на другое'); return; }
  const tk = B.task(id); if (!tk) return;
  // просроченное дело главным на более поздний день — это перенос, нужна причина
  if (!tk.done && tk.due && tk.due < B.today() && t > tk.due){
    const why = await B.askReason(tk, t); if (!why) return;
    B.updTask(tk.id, {due: t, postpones: (tk.postpones || []).concat({from: tk.due, to: t, why, at: Date.now()})}, true);
    B.xpToast(B.XP.postpone, 'за перенос');
  }
  B.editDay(t, x => { x.top = (x.top || []).filter(i => { const k = B.task(i); return k && !k.deleted; }).concat(id); x.planAt = x.planAt || Date.now(); });
  const k = B.task(id); if (k && (!k.due || k.due > t)) B.updTask(id, {due: t});
  if (live.length === 0) B.toast(`${B.icon('crown')} Главное дело. Нажми «когда и где», чтобы назначить время`);
};
B.acts.topAdd = el => B.acts.crown(el);
B.acts.qCrown = () => { qCrown = !qCrown; B.render(true); };
B.acts.qPri = () => { qPri = qPri === 1 ? 4 : qPri - 1; B.render(true); };
B.acts.dayNew = el => {
  const box = el.closest('.daylist'), inp = box && box.querySelector('.day-new'), t = pdate(el);
  const v = inp ? inp.value.trim() : ''; if (!v) return;
  const tk = B.addQuick(v, {due: t, pri: qPri}); if (!tk) return;
  if (tk.pri === 4 && qPri !== 4) B.updTask(tk.id, {pri: qPri}, true);
  if (qCrown) B.acts.crown({dataset: {id: tk.id, d: t}});
  qCrown = false; qPri = 4;
  setTimeout(() => { const i = B.$(`.daylist[data-d="${t}"] .day-new`); if (i) i.focus(); }, 30);
};
B.acts.whenEdit = async el => {
  const t = pdate(el), id = el.dataset.id, cur = (B.day(t).when || {})[id] || '';
  const v = await B.dialog(`<h3>Когда и где</h3><p class="dlg-text">Конкретное время и место превращают «надо бы» в решение.</p>
    <input id="whenIn" value="${esc(cur)}" placeholder="Например: в 16:00 в библиотеке" autofocus data-enter="whenOk">
    <div class="chips">${['утром, сразу после завтрака', 'в 16:00 в библиотеке', 'после пар, дома за столом', 'вечером, до 21:00'].map(x => `<button class="chip" data-act="whenChip">${x}</button>`).join('')}</div>
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="whenOk">Сохранить</button></div>`);
  if (v === false || v == null) return;
  B.editDay(t, d => { d.when = Object.assign({}, d.when, {[id]: v}); });
};
B.acts.whenChip = el => { const i = B.$('#whenIn'); i.value = el.textContent; i.focus(); };
B.acts.whenOk = () => B.closeDialog(B.$('#whenIn').value.trim());

})();
