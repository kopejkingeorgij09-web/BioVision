/* Зов леса: задачи в виде недельного планера.
   Неделя по дням (суббота и воскресенье делят последнюю колонку), под ней «Когда-нибудь» — задачи без даты,
   а справа от него «ШАД на неделю»: вебы и ДЗ этой недели, которым ещё не выбран день.
   Вид на месяц, свои календари (это проекты), цвета, подзадачи, повтор, напоминания, заметки, вложения,
   перенос на завтра, на следующую неделю или в «Когда-нибудь», дублирование, «Поделиться».
   Задачи перетаскиваются между днями и внутри дня (мышью или долгим нажатием пальцем). */
(function(){
const {esc, icon} = B;
const LS = 'bamboo-planner';
let S = {view: 'week', cal: 'all'};
try { S = Object.assign(S, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
const saveS = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };
let anchor = null;          // понедельник показанной недели или первое число месяца
let adding = null;          // в какой день открыто поле ввода ('' — «Когда-нибудь»)

/* ---------- цвета ---------- */
B.TCOLORS = [['yellow', '#FFE15A', 'жёлтый'], ['orange', '#FFB45C', 'оранжевый'], ['red', '#E5484D', 'красный'], ['pink', '#FFB3D1', 'розовый'],
  ['violet', '#CDB9FF', 'фиолетовый'], ['blue', '#9CCBFF', 'голубой'], ['teal', '#8EDCCB', 'бирюзовый'], ['green', '#A8DD8F', 'зелёный'], ['gray', '#D6D6D0', 'серый']];
const hexOf = c => { if (!c) return ''; const k = B.TCOLORS.find(x => x[0] === c); return k ? k[1] : /^#[0-9a-f]{6}$/i.test(c) ? c : ''; };
const inkOn = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 < 150 ? '#fff' : '#1E1E1A'; };
B.taskColorStyle = t => { const h = hexOf(t.color); return h ? `style="--tc:${h};--tci:${inkOn(h)}"` : ''; };

/* ---------- повтор ---------- */
const REPS = [['day', 'Каждый день'], ['wd', 'По будням'], ['week', 'Каждую неделю'], ['2week', 'Раз в две недели'], ['month', 'Каждый месяц'], ['year', 'Каждый год']];
B.repLabel = r => !r ? '' : r.f === 'n' ? `Каждые ${r.n} ${B.plural(r.n, 'день', 'дня', 'дней')}` : (REPS.find(x => x[0] === r.f) || [0, ''])[1];
B.nextRep = (d, r) => {
  if (!r || !d) return '';
  if (r.f === 'day') return B.add(d, 1);
  if (r.f === 'n') return B.add(d, Math.max(1, r.n || 1));
  if (r.f === 'wd'){ let x = B.add(d, 1); while (B.wd(x) > 4) x = B.add(x, 1); return x; }
  if (r.f === 'week') return B.add(d, 7);
  if (r.f === '2week') return B.add(d, 14);
  const p = B.parse(d), day = p.getDate();
  if (r.f === 'month'){ const m = new Date(p.getFullYear(), p.getMonth() + 1, 1, 12); const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(); m.setDate(Math.min(day, last)); return B.ymd(m); }
  if (r.f === 'year'){ const y = new Date(p.getFullYear() + 1, p.getMonth(), 1, 12); const last = new Date(y.getFullYear(), y.getMonth() + 1, 0).getDate(); y.setDate(Math.min(day, last)); return B.ymd(y); }
  return '';
};
/* сделанная повторяющаяся задача порождает следующую; снятие отметки убирает нетронутую следующую */
const baseSetDone = B.setDone;
B.setDone = (t, v) => {
  const nt = baseSetDone(t, v);
  if (v && t.rep && t.due && !t.repNext){
    const due = B.nextRep(t.due, t.rep), id = B.uid();
    const shift = B.diff(t.due, due);
    let remind = null;
    if (t.remind && t.remind.at){ const d = new Date(t.remind.at); d.setDate(d.getDate() + shift); remind = {at: localISO(d)}; }
    B.saveTask(B.newTask({id, title: t.title, proj: t.proj, pri: t.pri, due, time: t.time, color: t.color, rep: t.rep, notes: t.notes,
      subs: (t.subs || []).map(s => ({id: B.uid(), t: s.t, done: false})), remind, ord: t.ord, repFrom: t.id}), true);
    B.saveTask(Object.assign({}, nt, {repNext: id}));
    return B.task(t.id);
  }
  if (!v && t.repNext){
    const n = B.task(t.repNext);
    if (n && !n.done && !(n.subs || []).some(s => s.done)) B.put('t_' + n.id, null, true);
    const x = Object.assign({}, B.task(t.id)); delete x.repNext; B.saveTask(x);
    return x;
  }
  return nt;
};
const localISO = d => `${B.ymd(d)}T${B.pad(d.getHours())}:${B.pad(d.getMinutes())}`;

/* ---------- выборки ---------- */
const childIds = id => [id].concat(B.projects().filter(p => p.parent === id).map(p => p.id));
const inCal = t => S.cal === 'all' || childIds(S.cal).includes(t.proj || 'inbox');
const sortT = (a, b) => (a.ord ?? 1e9) - (b.ord ?? 1e9) || (a.created || 0) - (b.created || 0);
const onDate = date => B.tasks().filter(t => t.due === date && inCal(t)).sort(sortT);
const someday = () => { const cut = Date.now() - 14 * 864e5; return B.tasks().filter(t => !t.due && inCal(t) && (!t.done || (t.doneAt || 0) > cut)).sort(sortT); };
/* будущие повторы открытых задач в пределах [from, to] */
function ghosts(from, to){
  const out = {};
  B.tasks().forEach(t => {
    if (!t.rep || !t.due || t.done || !inCal(t)) return;
    let d = B.nextRep(t.due, t.rep), k = 0;
    while (d && d <= to && k < 400){ if (d >= from) (out[d] = out[d] || []).push(t); d = B.nextRep(d, t.rep); k++; }
  });
  return out;
}
const isoWeek = s => { const d = B.parse(s); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - n + 3); const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7); };
const MS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const dLabel = s => { const d = B.parse(s); return `${d.getDate()} ${MS[d.getMonth()]}`; };
const WDS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/* ---------- строки ---------- */
function row(t, o = {}){
  const subs = t.subs || [], sd = subs.filter(s => s.done).length;
  const files = B.list('f_').filter(f => f.task === t.id).length;
  const ic = [];
  if (t.rep) ic.push(icon('repeat'));
  if (t.remind && t.remind.at && !t.done) ic.push(icon('bell'));
  if ((t.notes || '').trim()) ic.push(icon('note'));
  if (files) ic.push(icon('clip'));
  if (subs.length) ic.push(`<span>${sd}/${subs.length}</span>`);
  const c = hexOf(t.color);
  const proj = S.cal === 'all' && t.proj && t.proj !== 'inbox' && o.dot !== false ? B.proj(t.proj) : null;
  return `<div class="pl-t ${t.done ? 'done' : ''} ${c ? 'tcol' : ''} ${o.ghost ? 'ghost' : ''} ${t.pri === 1 ? 'p1' : ''}" ${o.ghost ? '' : `data-tid="${t.id}"`} ${B.taskColorStyle(t)}>
    <button class="pl-open" data-act="openTask" data-id="${t.id}" title="${esc(t.title)}">
      ${proj ? `<i class="pdot c-${proj.color || 'ink'}" title="${esc(proj.name)}"></i>` : ''}${t.time ? `<span class="pl-time">${t.time}</span>` : ''}<span class="pl-tt">${esc(t.title) || '<span class="muted">без названия</span>'}</span>
    </button>
    ${ic.length ? `<span class="pl-ic">${ic.join('')}</span>` : ''}
    ${o.ghost ? '' : `<button class="pl-chk" data-act="toggleTask" data-id="${t.id}" aria-label="${t.done ? 'Вернуть' : 'Готово'}" title="${t.done ? 'Вернуть' : 'Готово'}">${icon('check')}</button>`}
  </div>`;
}
/* веб или ДЗ ШАДа в планере: открывается, отмечается галочкой и перетаскивается на другой день, как задача */
const shadRow = it => { const ok = B.shadStage(it.p.n) >= it.need;
  return `<div class="pl-shad c-${it.p.c} ${ok ? 'ok' : ''} ${it.old ? 'old' : ''}" data-shn="${it.p.n}" data-kind="${it.kind}">
    <button class="pl-open" data-act="shadOpen" data-n="${it.p.n}" title="${esc(it.p.t)}">${it.old ? '<span class="pl-old">хвост</span>' : ''}${it.from ? `<span class="pl-time">${it.from}</span>` : ''}<b>${it.kind === 'web' ? '' : 'ДЗ · '}${esc(it.p.code || '')}</b> ${esc(it.p.t)}</button>
    <button class="pl-chk" data-act="shadChk" data-n="${it.p.n}" data-need="${it.need}" aria-label="${ok ? 'Вернуть' : 'Готово'}" title="${it.kind === 'web' ? 'Веб посмотрен' : 'ДЗ решено'}">${icon('check')}</button>
  </div>`; };
B.acts.shadChk = el => { const n = +el.dataset.n, need = +el.dataset.need, s = B.shadStage(n); B.setShadStage(n, s >= need ? need - 1 : need); };

function dayList(date, list, min, gh){
  const shad = S.cal === 'all' || S.cal === 'shad' ? B.shadOn(date) : [];
  const n = list.length + (gh || []).length + shad.length;
  const empties = Math.max(1, min - n);
  return `<div class="pl-list" data-d="${date}">
    ${list.map(t => row(t)).join('')}${(gh || []).map(t => row(t, {ghost: true})).join('')}${shad.map(shadRow).join('')}
    ${adding === date ? `<div class="pl-add"><input class="pl-in" data-d="${date}" placeholder="Новая задача" autocomplete="off" enterkeyhint="done"></div>` : ''}
    ${Array.from({length: adding === date ? Math.max(0, empties - 1) : empties}, (_, i) => `<button class="pl-empty" data-act="plAdd" data-d="${date}" ${i ? 'tabindex="-1"' : ''} aria-label="Добавить задачу${date ? ' на ' + B.fmt(date) : ''}"></button>`).join('')}
  </div>`;
}
function dayCol(date, min, gh){
  if (innerWidth < 760) min = 2;
  const t = B.today(), cls = date === t ? 'now' : date < t ? 'was' : '';
  return `<section class="pl-day ${cls}" data-day="${date}">
    <header class="pl-dh"><b>${dLabel(date)}</b><span>${date === t ? 'Сегодня' : WDS[B.wd(date)]}</span></header>
    ${dayList(date, onDate(date), min, gh[date])}
  </section>`;
}

function weekView(){
  const ws = anchor || B.weekStart(B.today()), days = Array.from({length: 7}, (_, i) => B.add(ws, i));
  const gh = ghosts(days[0], days[6]);
  const withShad = (S.cal === 'all' || S.cal === 'shad') && B.shad.plan.length, cols = withShad ? 2 : 3;
  const sd = someday(), rows = innerWidth < 760 ? sd.length + 2 : Math.max(4, Math.ceil((sd.length + 1) / cols) + 1);
  return `<div class="pl-week">
      ${days.slice(0, 5).map(d => dayCol(d, 9, gh)).join('')}
      <div class="pl-wkend">${dayCol(days[5], 4, gh)}${dayCol(days[6], 4, gh)}</div>
    </div>
    <div class="pl-bottom ${withShad ? 'two' : ''}">
      <section class="pl-some">
        <h2>Когда-нибудь</h2>
        <div class="pl-somebox" style="--rows:${rows};--cols:${cols}">${dayList('', sd, innerWidth < 760 ? rows : rows * cols, null)}</div>
      </section>
      ${withShad ? shadBox(days[0]) : ''}
    </div>`;
}
/* «ШАД на неделю»: карточки без дня; перетащи на день, чтобы поставить, или обратно сюда, чтобы снять день */
function shadBox(ws){
  const list = B.shadWeek(ws), all = B.shadWeekAll(ws);
  const left = B.shadHoursLeft(all), open = list.filter(it => B.shadStage(it.p.n) < it.need).length;
  const h = x => (Math.round(x * 2) / 2).toString().replace('.', ',');
  const sub = !all.length ? 'на этой неделе вебов нет' : left ? `осталось ≈${h(left)} ч${open ? ` · без дня ${open}` : ' · всё расставлено'}` : 'неделя закрыта';
  return `<section class="pl-shbox">
    <h2>ШАД на неделю <span>${sub}</span></h2>
    <div class="pl-list" data-d="" data-shbox="1">
      ${list.map(shadRow).join('')}
      ${list.length ? '' : `<div class="pl-shempty">${all.length ? 'Всё стоит по дням. Перетащи карточку сюда, чтобы снять день.' : 'Свободная неделя.'}</div>`}
    </div>
  </section>`;
}

function monthView(){
  const a = B.parse(anchor || B.today().slice(0, 8) + '01'), first = B.ymd(new Date(a.getFullYear(), a.getMonth(), 1, 12));
  const last = B.ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0, 12));
  const from = B.weekStart(first), to = B.add(B.weekStart(last), 6), t = B.today();
  const gh = ghosts(from, to);
  let cells = '';
  for (let d = from; d <= to; d = B.add(d, 1)){
    const list = onDate(d), g = gh[d] || [], shad = S.cal === 'all' || S.cal === 'shad' ? B.shadOn(d) : [];
    const all = list.length + g.length + shad.length, show = 4;
    const out = d.slice(0, 7) !== first.slice(0, 7);
    cells += `<div class="pl-mc ${d === t ? 'now' : ''} ${out ? 'out' : ''} ${B.wd(d) > 4 ? 'we' : ''}">
      <button class="pl-md" data-act="plGoWeek" data-d="${d}" title="Открыть неделю">${B.parse(d).getDate()}</button>
      <div class="pl-list" data-d="${d}">${list.slice(0, show).map(x => row(x, {dot: false})).join('')}${g.slice(0, Math.max(0, show - list.length)).map(x => row(x, {ghost: true, dot: false})).join('')}${all <= show ? shad.slice(0, show - list.length - g.length).map(shadRow).join('') : ''}
        ${all > show ? `<button class="pl-more" data-act="plGoWeek" data-d="${d}">ещё ${all - show}</button>` : ''}
        ${adding === d ? `<div class="pl-add"><input class="pl-in" data-d="${d}" placeholder="Новая задача" autocomplete="off" enterkeyhint="done"></div>`
          : `<button class="pl-empty sm" data-act="plAdd" data-d="${d}" aria-label="Добавить задачу на ${B.fmt(d)}" title="Добавить задачу"><span>${icon('plus')}</span></button>`}</div>
    </div>`;
  }
  return `<div class="pl-month"><div class="pl-mh">${WDS.map(w => `<span>${w}</span>`).join('')}</div><div class="pl-mg">${cells}</div></div>`;
}

const viewToggle = () => `<div class="toggle pl-views">${[['week', 'week', 'Неделя'], ['month', 'grid', 'Месяц'], ['shad', 'chart', 'ШАД']].map(([v, ic, l]) => `<button class="${S.view === v ? 'on' : ''}" data-act="plView" data-v="${v}" title="${v === 'shad' ? 'Темы и расписание ШАДа' : l}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`;
function calName(){ if (S.cal === 'all') return 'Все календари'; const p = B.proj(S.cal); return p ? p.name : 'Все календари'; }

B.views.tasks = {
  title: 'Задачи',
  render(arg){
    if (arg === 'plan' || arg === 'week' || arg === 'month'){ S.view = arg === 'plan' ? 'shad' : arg; saveS(); }
    else if (arg && B.proj(arg)){ S.cal = arg; saveS(); }
    if (S.cal !== 'all' && !B.proj(S.cal)){ S.cal = 'all'; saveS(); }
    const month = S.view === 'month', t = B.today();
    if (S.view === 'shad') return `<div class="page planner is-shad">
      <header class="pl-h"><h1>План ШАДа</h1><div class="pl-tools">${viewToggle()}</div></header>
      ${B.shadPlanView ? B.shadPlanView() : ''}
    </div>`;
    if (month && anchor && anchor.slice(8) !== '01') anchor = anchor.slice(0, 8) + '01';
    if (!month && anchor && B.wd(anchor) !== 0) anchor = B.weekStart(anchor);
    const ref = B.parse(month ? (anchor || t.slice(0, 8) + '01') : B.add(anchor || B.weekStart(t), 3));
    const p = S.cal !== 'all' ? B.proj(S.cal) : null;
    const isNow = month ? !anchor || anchor.slice(0, 7) === t.slice(0, 7) : !anchor || anchor === B.weekStart(t);
    return `<div class="page planner ${month ? 'is-month' : 'is-week'}" style="--plfs:${FS[fsI]}">
      <header class="pl-h">
        <h1>${B.MONF[ref.getMonth()]} ${ref.getFullYear()}${month ? '' : ` <span class="pl-wn">№${isoWeek(B.add(anchor || B.weekStart(t), 3))}</span>`}</h1>
        <div class="pl-tools">
          <button class="pl-cal" data-act="plCals">${p ? `<i class="pdot c-${p.color || 'ink'}"></i>` : icon('cal')}<span>${esc(calName())}</span>${icon('down')}</button>
          ${viewToggle()}
          <div class="pl-fs" role="group" aria-label="Размер текста"><button data-act="plFs" data-k="-1" title="Текст мельче" ${fsI === 0 ? 'disabled' : ''}>A</button><button data-act="plFs" data-k="1" title="Текст крупнее" ${fsI === FS.length - 1 ? 'disabled' : ''}>A</button></div>
          <a class="icon-btn" href="#/search" title="Поиск" aria-label="Поиск">${icon('search')}</a>
          ${isNow ? '' : `<button class="btn sm ghost" data-act="plToday">Сегодня</button>`}
          <button class="icon-btn dark" data-act="plShift" data-k="-1" aria-label="Назад">${icon('left')}</button>
          <button class="icon-btn dark" data-act="plShift" data-k="1" aria-label="Вперёд">${icon('right')}</button>
        </div>
      </header>
      ${month ? monthView() : weekView()}
    </div>`;
  },
  mount(){
    const inp = B.$('.pl-in');
    if (inp){
      inp.focus({preventScroll: true});
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter'){ e.preventDefault(); addFrom(inp, true); }
        else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); adding = null; B.render(true); }
      });
      inp.addEventListener('blur', () => setTimeout(() => { if (!inp.isConnected) return; addFrom(inp, false); }, 120));
    }
    B.$$('.pl-t[data-tid],.pl-shad[data-shn]').forEach(el => el.addEventListener('pointerdown', dragStart));
  }
};
function addFrom(inp, again){
  const v = inp.value.trim(), d = inp.dataset.d;
  if (v){
    const def = {due: d};
    if (S.cal !== 'all') def.proj = S.cal;
    const r = B.parseQuick(v, def);
    if (r.title){
      const ord = (d ? onDate(d) : someday()).reduce((m, x) => Math.max(m, x.ord ?? 0), 0) + 10;
      B.saveTask(B.newTask({title: r.title, proj: r.proj || def.proj || 'inbox', pri: r.pri, due: r.due || d, time: r.time, ord}), true);
    }
  }
  adding = again && v ? d : null;
  B.render(true);
  if (adding != null){ const i = B.$('.pl-in'); if (i) i.focus({preventScroll: true}); }
}
B.acts.plAdd = el => { adding = el.dataset.d; B.render(true); };
/* размер текста только в планере (неделя и месяц), страница не масштабируется */
const FS = [0.85, 0.92, 1, 1.1, 1.22, 1.36, 1.5], LS_FS = 'bamboo-planner-fs';
let fsI = 2; try { const v = +localStorage.getItem(LS_FS); if (FS.includes(v)) fsI = FS.indexOf(v); } catch (e) {}
B.acts.plFs = el => { fsI = B.clamp(fsI + +el.dataset.k, 0, FS.length - 1); try { localStorage.setItem(LS_FS, FS[fsI]); } catch (e) {} B.render(true); B.toast(`Текст ${Math.round(FS[fsI] * 100)}%`, 900); };
B.acts.plAddDay = el => { anchor = B.weekStart(el.dataset.d); S.view = 'week'; saveS(); adding = el.dataset.d; B.render(true); };
B.acts.plGoWeek = el => { anchor = B.weekStart(el.dataset.d); S.view = 'week'; saveS(); B.render(true); };
B.acts.plView = el => { S.view = el.dataset.v; saveS(); const t = B.today(); if (S.view === 'shad'){ B.render(true); return; } anchor = S.view === 'month' ? (anchor || t).slice(0, 8) + '01' : (anchor && anchor.slice(0, 7) !== t.slice(0, 7) ? B.weekStart(anchor) : null); B.render(true); };
B.acts.plToday = () => { anchor = null; B.render(true); };
B.acts.plShift = el => {
  const k = +el.dataset.k, t = B.today();
  if (S.view === 'month'){ const a = B.parse(anchor || t.slice(0, 8) + '01'); anchor = B.ymd(new Date(a.getFullYear(), a.getMonth() + k, 1, 12)); }
  else anchor = B.add(anchor || B.weekStart(t), 7 * k);
  B.render(true);
};

/* ---------- календари (это проекты) ---------- */
B.acts.plCals = () => {
  const roots = B.projects().filter(p => !p.parent);
  const item = (id, name, color, depth) => `<div class="pl-ci ${S.cal === id ? 'on' : ''} d${depth}">
    <button data-act="plCal" data-c="${id}">${id === 'all' ? icon('cal') : `<i class="pdot c-${color || 'ink'}"></i>`}<span>${esc(name)}</span>${S.cal === id ? icon('check') : ''}</button>
    ${id !== 'all' ? `<button class="icon-btn sm" data-act="projEdit" data-id="${id}" title="Настроить">${icon('gear')}</button>` : ''}</div>`;
  B.sheet(`<h2>Календари</h2>
    <div class="pl-cals">${item('all', 'Все календари', '', 0)}${roots.map(r => item(r.id, r.name, r.color, 0) + B.projects().filter(c => c.parent === r.id).map(c => item(c.id, c.name, c.color, 1)).join('')).join('')}</div>
    <button class="btn" data-act="projNew">${icon('plus')} Добавить календарь</button>
    <p class="hint">Календарь — отдельный список дел: Вуз, ШАД, Личное. В «Все календари» видно всё сразу, у задачи цветная точка её календаря. Новая задача попадает в календарь, который сейчас открыт.</p>`);
};
B.acts.plCal = el => { S.cal = el.dataset.c; saveS(); B.closeSheet(); B.render(true); };

/* ---------- перетаскивание ---------- */
let drag = null, justDragged = 0;
function dragStart(e){
  if (e.button !== 0 || e.target.closest('.pl-chk')) return;
  const el = e.currentTarget, touch = e.pointerType !== 'mouse';
  const st = {el, id: el.dataset.tid, shn: +el.dataset.shn || 0, kind: el.dataset.kind, x0: e.clientX, y0: e.clientY, on: false, touch, timer: null};
  if (touch) st.timer = setTimeout(() => begin(st, e.clientX, e.clientY), 380);
  const move = ev => {
    if (!st.on){
      if (Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0) > (touch ? 10 : 5)){ if (touch){ cleanup(); return; } begin(st, ev.clientX, ev.clientY); }
      else return;
    }
    ev.preventDefault(); over(st, ev.clientX, ev.clientY);
  };
  const up = ev => { if (st.on){ ev.preventDefault(); drop(st); } cleanup(); };
  const noScroll = ev => { if (st.on) ev.preventDefault(); };
  function cleanup(){ clearTimeout(st.timer); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); removeEventListener('touchmove', noScroll); if (st.ghost) st.ghost.remove(); B.$$('.pl-list.over').forEach(x => x.classList.remove('over')); B.$$('.pl-mark').forEach(x => x.remove()); if (st.el) st.el.classList.remove('dragging'); drag = null; }
  addEventListener('pointermove', move, {passive: false}); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('touchmove', noScroll, {passive: false});
}
function begin(st, x, y){
  st.on = true; drag = st;
  const r = st.el.getBoundingClientRect();
  st.dx = x - r.left; st.dy = y - r.top;
  st.ghost = st.el.cloneNode(true); st.ghost.classList.add('pl-ghost'); st.ghost.style.width = r.width + 'px';
  document.body.appendChild(st.ghost); st.el.classList.add('dragging');
  if (navigator.vibrate && st.touch) navigator.vibrate(12);
  over(st, x, y);
}
function over(st, x, y){
  st.ghost.style.transform = `translate(${x - st.dx}px, ${y - st.dy}px)`;
  st.ghost.style.visibility = 'hidden';
  const hit = document.elementFromPoint(x, y);
  st.ghost.style.visibility = '';
  const list = hit && hit.closest('.pl-list');
  B.$$('.pl-list.over').forEach(l => { if (l !== list) l.classList.remove('over'); });
  B.$$('.pl-mark').forEach(m => m.remove());
  st.target = null;
  if (!list) return;
  list.classList.add('over');
  const rows = [...list.querySelectorAll(':scope > .pl-t[data-tid]')].filter(r => r !== st.el);
  let before = null;
  for (const r of rows){ const b = r.getBoundingClientRect(); if (y < b.top + b.height / 2 && (Math.abs(x - (b.left + b.width / 2)) < b.width / 2 + 20 || list.closest('.pl-day,.pl-mc'))){ before = r; break; } }
  const box = !!list.dataset.shbox;
  if (box !== !!st.shn && !(st.shn && list.dataset.d)){ list.classList.remove('over'); return; }   // задачи не кладутся в блок ШАДа, вебы не кладутся в «Когда-нибудь»
  st.target = {date: list.dataset.d, before: before ? before.dataset.tid : null, box};
  const mk = document.createElement('div'); mk.className = 'pl-mark';
  if (before) list.insertBefore(mk, before);
  else { const lastRow = rows[rows.length - 1]; if (lastRow) lastRow.after(mk); else list.prepend(mk); }
}
function drop(st){
  justDragged = Date.now();
  if (!st.target) return;
  if (st.shn){
    const p = B.shad.plan.find(x => x.n === st.shn);
    if (st.target.box){ if (p && (st.kind === 'web' ? p.wp : p.hp)){ B.shadUnplace(st.shn, st.kind); B.toast(`${st.kind === 'web' ? '' : 'ДЗ '}${esc(p.code || '')}: день снят, карточка в блоке недели`); } }
    else if (st.target.date) moveShad(st.shn, st.kind, st.target.date);
    return;
  }
  const t = B.task(st.id); if (!t) return;
  const to = st.target.date || '';
  const ids = (to ? onDate(to) : someday()).map(x => x.id).filter(i => i !== t.id);
  const at = st.target.before ? ids.indexOf(st.target.before) : -1;
  ids.splice(at < 0 ? ids.length : at, 0, t.id);
  moveTask(t, to, ids);
}
/* перенос веба (вместе с ним сдвигается срок ДЗ) или только срока ДЗ */
function moveShad(n, kind, to){
  const p = B.shad.plan.find(x => x.n === n); if (!p) return;
  if (kind === 'web'){
    if (p.wp && p.w.date === to) return;
    const k = B.diff(p.w.date, to), patch = {w: {date: to}};
    if (p.wp && p.hp) patch.h = {date: B.add(p.h.date, k)};   // ДЗ едет за вебом, только если ему уже выбран день
    B.setShadOver(n, patch);
    B.toast(`${esc(p.code || 'Веб')} перенесён на ${B.fmtW(to)}${patch.h ? `, ДЗ до ${B.fmtW(patch.h.date)}` : ''}`);
  } else {
    if (p.hp && p.h.date === to) return;
    B.setShadOver(n, {h: {date: to}});
    B.toast(`ДЗ ${esc(p.code || '')}: до ${B.fmtW(to)}`);
  }
}
/* перенос с записью в историю: дело, переехавшее на более поздний день, считается переносом (без штрафа) */
function moveTask(t, to, order){
  const patch = {due: to};
  if (!t.done && (t.due || '') !== to && t.due && (!to || to > t.due)) patch.postpones = (t.postpones || []).concat({from: t.due, to, why: '', at: Date.now()});
  if (t.remind && t.remind.at && t.due && to && t.due !== to){ const d = new Date(t.remind.at); d.setDate(d.getDate() + B.diff(t.due, to)); patch.remind = {at: localISO(d)}; }
  if (!to) patch.time = '';
  B.updTask(t.id, patch, true);
  if (order) order.forEach((id, i) => { const x = B.task(id); if (x && x.ord !== i * 10) B.saveTask(Object.assign({}, x, {ord: i * 10}), true); });
  else B.updTask(t.id, {ord: (to ? onDate(to) : someday()).reduce((m, x) => Math.max(m, x.ord ?? 0), 0) + 10}, true);
  B.changed();
}
document.addEventListener('click', e => { if (Date.now() - justDragged < 350 && e.target.closest('.pl-t,.pl-shad')){ e.stopPropagation(); e.preventDefault(); } }, true);

/* ---------- карточка задачи ---------- */
let pop = '', wide = false;
B.openTask = (id, keep) => {
  const t = B.task(id); if (!t) return;
  if (!keep){ pop = ''; }
  const files = B.list('f_').filter(f => f.task === t.id).sort((a, b) => (a.at || 0) - (b.at || 0));
  const subs = t.subs || [], showSubs = subs.length || pop === 'subs';
  const proj = B.proj(t.proj || 'inbox');
  const chips = [];
  if (t.rep) chips.push(`<button class="tw-chip" data-act="twPop" data-p="rep" data-id="${t.id}">${icon('repeat')}${B.repLabel(t.rep)}</button>`);
  if (t.remind && t.remind.at) chips.push(`<button class="tw-chip" data-act="twPop" data-p="bell" data-id="${t.id}">${icon('bell')}${fmtRemind(t.remind.at)}</button>`);
  if (proj) chips.push(`<button class="tw-chip" data-act="twPop" data-p="cal" data-id="${t.id}"><i class="pdot c-${proj.color || 'ink'}"></i>${esc(B.projName(proj.id))}</button>`);
  if (t.pri && t.pri < 4) chips.push(`<span class="tw-chip">${icon('flag')}${B.PRI[t.pri]}</span>`);
  const pp = t.postpones || [];
  B.sheet(`<div class="tw ${t.done ? 'is-done' : ''}" data-tid="${t.id}" ${B.taskColorStyle(t)}>
    <div class="tw-top">
      <label class="tw-date">${icon('cal')}<span>${t.due ? `${WDS[B.wd(t.due)]}, ${dLabel(t.due)} ${B.parse(t.due).getFullYear()}` : 'Когда-нибудь'}</span><input type="date" value="${t.due || ''}" data-in="twDue" data-id="${t.id}" aria-label="Дата"></label>
      ${t.due ? `<label class="tw-time ${t.time ? 'on' : ''}">${icon('clock')}${t.time ? `<span>${t.time}</span>` : ''}<input type="time" value="${t.time || ''}" data-in="twTime" data-id="${t.id}" aria-label="Время"></label>` : ''}
      <button class="tw-wide" data-act="twWide" data-id="${t.id}">${icon(wide ? 'shrink' : 'expand')}<span>${wide ? 'Свернуть' : 'Развернуть'}</span></button>
    </div>
    <div class="tw-head">
      <textarea class="tw-title" rows="1" data-in="edTitle" data-id="${t.id}" placeholder="Что сделать">${esc(t.title)}</textarea>
      <button class="tw-done ${t.done ? 'on' : ''}" data-act="edDone" data-id="${t.id}" title="${t.done ? 'Вернуть' : 'Готово'}" aria-label="Готово">${icon('check')}</button>
    </div>
    ${chips.length ? `<div class="tw-chips">${chips.join('')}</div>` : ''}
    <textarea class="tw-note" rows="3" data-in="edField" data-k="notes" data-id="${t.id}" placeholder="Добавьте заметку…">${esc(t.notes || '')}</textarea>
    ${showSubs ? `<div class="tw-subs">
      ${subs.map(s => `<div class="sub ${s.done ? 'is-done' : ''}"><button class="chk sm" data-act="subToggle" data-id="${t.id}" data-sid="${s.id}">${icon('check')}</button>
        <input value="${esc(s.t)}" data-in="subText" data-id="${t.id}" data-sid="${s.id}"><button class="icon-btn sm" data-act="subDel" data-id="${t.id}" data-sid="${s.id}" title="Удалить">${icon('x')}</button></div>`).join('')}
      <div class="sub add">${icon('plus')}<input id="subNew" placeholder="Подзадача" data-enter="subAdd" data-id="${t.id}" ${pop === 'subs' ? 'autofocus' : ''}></div>
    </div>` : ''}
    ${files.length ? `<div class="tw-files">${files.map(fileChip).join('')}</div>` : ''}
    ${pop ? `<div class="tw-pop">${popHTML(t)}</div>` : ''}
    <div class="tw-bar">
      <button class="${pop === 'subs' ? 'on' : ''}" data-act="twPop" data-p="subs" data-id="${t.id}" title="Добавить подзадачу">${icon('list')}</button>
      <button class="${pop === 'rep' || t.rep ? 'on' : ''}" data-act="twPop" data-p="rep" data-id="${t.id}" title="Повтор">${icon('repeat')}</button>
      <button class="${pop === 'color' ? 'on' : ''} ${t.color ? 'has' : ''}" data-act="twPop" data-p="color" data-id="${t.id}" title="Цвет">${icon('drop')}</button>
      <button class="${pop === 'bell' || (t.remind && t.remind.at) ? 'on' : ''}" data-act="twPop" data-p="bell" data-id="${t.id}" title="Напоминание">${icon('bell')}</button>
      <button class="${pop === 'more' ? 'on' : ''}" data-act="twPop" data-p="more" data-id="${t.id}" title="Ещё">${icon('dots')}</button>
    </div>
    ${wide ? `<div class="tw-ext">
      <label>Календарь<select data-in="edField" data-k="proj" data-id="${t.id}">${B.projects().map(p => `<option value="${p.id}" ${p.id === (t.proj || 'inbox') ? 'selected' : ''}>${esc(B.projName(p.id))}</option>`).join('')}</select></label>
      <div class="ed-pri">Важность<div class="pri-seg">${[1, 2, 3, 4].map(p => `<button class="p${p} ${+(t.pri || 4) === p ? 'on' : ''}" data-act="twPri" data-id="${t.id}" data-p="${p}">${icon('flag')}<span>${B.PRI[p]}</span></button>`).join('')}</div></div>
      <label class="switch"><input type="checkbox" ${t.big ? 'checked' : ''} data-in="edBig" data-id="${t.id}"><span></span>Большое дело: разбить на шаги и делать по одному</label>
      <label class="switch"><input type="checkbox" ${t.dl ? 'checked' : ''} data-in="edDl" data-id="${t.id}"><span></span>Дедлайн: обратный отсчёт на главном экране</label>
      ${pp.length ? `<div class="sub-h">Переносы: ${pp.length}</div><ul class="pp-list">${pp.slice(-6).map(p => `<li><span class="mono">${p.from ? B.fmtS(p.from) : '—'} → ${p.to ? B.fmtS(p.to) : 'когда-нибудь'}</span> ${esc(p.why || '')}</li>`).join('')}</ul>` : ''}
    </div>` : ''}
  </div>`);
  const ta = B.$('.tw-title'); if (ta){ ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
  if (pop === 'subs'){ const i = B.$('#subNew'); if (i) setTimeout(() => i.focus(), 40); }
};
const fmtRemind = at => { const d = new Date(at), day = B.ymd(d); return `${day === B.today() ? 'сегодня' : day === B.add(B.today(), 1) ? 'завтра' : dLabel(day)} в ${B.pad(d.getHours())}:${B.pad(d.getMinutes())}`; };
function popHTML(t){
  if (pop === 'rep') return `<div class="tw-opts">${[['', 'Не повторять']].concat(REPS).map(([f, l]) => `<button class="${(t.rep ? t.rep.f : '') === f ? 'on' : ''}" data-act="twRep" data-id="${t.id}" data-f="${f}">${l}</button>`).join('')}
    <label class="tw-n">Каждые <input type="number" min="1" max="365" value="${t.rep && t.rep.f === 'n' ? t.rep.n : 3}" id="twN"> дн. <button class="btn sm" data-act="twRepN" data-id="${t.id}">ОК</button></label></div>
    ${!t.due ? '<p class="hint">Повтор начнётся, когда у задачи появится дата.</p>' : '<p class="hint">Когда отметишь задачу, следующая появится сама. Будущие повторы видны бледными.</p>'}`;
  if (pop === 'color') return `<div class="tw-colors"><button class="sw none ${!t.color ? 'on' : ''}" data-act="twColor" data-id="${t.id}" data-c="" title="Без цвета">${icon('x')}</button>${B.TCOLORS.map(([k, h, n]) => `<button class="sw ${t.color === k ? 'on' : ''}" style="background:${h}" data-act="twColor" data-id="${t.id}" data-c="${k}" title="${n}"></button>`).join('')}
    <label class="sw custom ${t.color && t.color[0] === '#' ? 'on' : ''}" title="Свой цвет" style="${t.color && t.color[0] === '#' ? 'background:' + t.color : ''}">${icon('plus')}<input type="color" value="${t.color && t.color[0] === '#' ? t.color : '#7FB3FF'}" data-in="twColorC" data-id="${t.id}"></label></div>`;
  if (pop === 'bell'){
    const def = t.remind && t.remind.at ? t.remind.at : `${t.due || B.today()}T${t.time || '09:00'}`;
    const perm = 'Notification' in window ? Notification.permission : 'none';
    return `<div class="tw-bell"><input type="datetime-local" id="twAt" value="${def}">
      <button class="btn sm primary" data-act="twBell" data-id="${t.id}">Напомнить</button>${t.remind && t.remind.at ? `<button class="btn sm ghost" data-act="twBellOff" data-id="${t.id}">Убрать</button>` : ''}</div>
      <div class="chips sm">${t.time && t.due ? `<button class="chip" data-act="twBellQ" data-id="${t.id}" data-v="0">в ${t.time}</button><button class="chip" data-act="twBellQ" data-id="${t.id}" data-v="15">за 15 минут</button><button class="chip" data-act="twBellQ" data-id="${t.id}" data-v="60">за час</button>` : ''}<button class="chip" data-act="twBellQ" data-id="${t.id}" data-v="h1">через час</button><button class="chip" data-act="twBellQ" data-id="${t.id}" data-v="m9">завтра в 9:00</button></div>
      <p class="hint">${perm === 'denied' ? 'Уведомления запрещены в браузере, напоминание придёт только всплывашкой внутри приложения.' : 'Придёт уведомлением, пока приложение открыто или висит во вкладке, и всплывашкой при следующем открытии, если в тот момент оно было закрыто.'}</p>`;
  }
  if (pop === 'cal') return `<div class="tw-opts">${B.projects().map(p => `<button class="${p.id === (t.proj || 'inbox') ? 'on' : ''}" data-act="twProj" data-id="${t.id}" data-p="${p.id}"><i class="pdot c-${p.color || 'ink'}"></i>${esc(B.projName(p.id))}</button>`).join('')}</div>`;
  if (pop === 'more') return `<div class="tw-menu">
      <button data-act="twMove" data-id="${t.id}" data-to="tomorrow">${icon('arrow')}На завтра</button>
      <button data-act="twMove" data-id="${t.id}" data-to="week">${icon('arrow2')}На следующую неделю</button>
      <button data-act="twMove" data-id="${t.id}" data-to="some">${icon('down')}На когда-нибудь</button>
      <hr>
      <label>${icon('clip')}Прикрепить файл или фото<input type="file" multiple data-in="twFile" data-id="${t.id}"></label>
      <button data-act="twLink" data-id="${t.id}">${icon('link')}Прикрепить ссылку</button>
      <hr>
      <button data-act="twShare" data-id="${t.id}">${icon('share')}Поделиться задачей</button>
      <button data-act="twDup" data-id="${t.id}">${icon('copy')}Дублировать</button>
      <button class="danger" data-act="taskDel" data-id="${t.id}">${icon('trash')}Удалить</button>
    </div>`;
  return '';
}
function fileChip(f){
  const x = `<button class="icon-btn sm" data-act="twFileDel" data-f="${f.id}" title="Убрать">${icon('x')}</button>`;
  if (f.url) return `<div class="tw-file">${icon('link')}<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.name || f.url)}</a>${x}</div>`;
  if ((f.type || '').startsWith('image/')) return `<div class="tw-file img"><a href="${f.data}" download="${esc(f.name)}" title="${esc(f.name)}"><img src="${f.data}" alt="${esc(f.name)}"></a>${x}</div>`;
  return `<div class="tw-file">${icon('clip')}<a href="${f.data}" download="${esc(f.name)}">${esc(f.name)}</a><span class="muted">${Math.round((f.size || 0) / 1024)} КБ</span>${x}</div>`;
}
B.acts.twPop = el => { pop = pop === el.dataset.p ? '' : el.dataset.p; B.openTask(el.dataset.id, true); };
B.acts.twWide = el => { wide = !wide; B.openTask(el.dataset.id, true); };
B.acts.twPri = el => { B.updTask(el.dataset.id, {pri: +el.dataset.p}, true); B.openTask(el.dataset.id, true); };
B.acts.twProj = el => { B.updTask(el.dataset.id, {proj: el.dataset.p}, true); pop = ''; B.openTask(el.dataset.id, true); };
B.inputs.twDue = (el, e) => {
  if (e.type !== 'change') return;
  const t = B.task(el.dataset.id); moveTask(t, el.value || ''); B.openTask(t.id, true);
};
B.inputs.twTime = (el, e) => { if (e.type !== 'change') return; B.updTask(el.dataset.id, {time: el.value}, true); B.openTask(el.dataset.id, true); };
B.acts.twRep = el => {
  const t = B.task(el.dataset.id), f = el.dataset.f;
  B.updTask(t.id, {rep: f ? {f} : null, due: f && !t.due ? B.today() : t.due}, true);
  pop = ''; B.openTask(t.id, true);
};
B.acts.twRepN = el => { const n = Math.max(1, Math.min(365, +B.$('#twN').value || 1)); const t = B.task(el.dataset.id); B.updTask(t.id, {rep: {f: 'n', n}, due: t.due || B.today()}, true); pop = ''; B.openTask(t.id, true); };
B.acts.twColor = el => { B.updTask(el.dataset.id, {color: el.dataset.c || ''}, true); B.openTask(el.dataset.id, true); };
B.inputs.twColorC = (el, e) => { if (e.type !== 'change') return; B.updTask(el.dataset.id, {color: el.value}, true); B.openTask(el.dataset.id, true); };
function setRemind(id, at){
  B.updTask(id, {remind: at ? {at} : null}, true);
  if (at && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  pop = ''; B.openTask(id, true);
  if (at) B.toast(`${icon('bell')} Напомню ${fmtRemind(at)}`);
}
B.acts.twBell = el => { const v = B.$('#twAt').value; if (v) setRemind(el.dataset.id, v); };
B.acts.twBellOff = el => setRemind(el.dataset.id, null);
B.acts.twBellQ = el => {
  const t = B.task(el.dataset.id), v = el.dataset.v; let d;
  if (v === 'h1'){ d = new Date(Date.now() + 3600e3); }
  else if (v === 'm9'){ d = B.parse(B.add(B.today(), 1)); d.setHours(9, 0, 0, 0); }
  else { const [h, m] = t.time.split(':').map(Number); d = B.parse(t.due); d.setHours(h, m - +v, 0, 0); }
  setRemind(t.id, localISO(d));
};
B.acts.twMove = el => {
  const t = B.task(el.dataset.id), to = el.dataset.to, base = t.due && t.due > B.today() ? t.due : B.today();
  const d = to === 'tomorrow' ? B.add(base, 1) : to === 'week' ? B.add(B.weekStart(base), 7) : '';
  moveTask(t, d); B.closeSheet();
  B.toast(d ? `Перенесено на ${B.fmtW(d)}` : 'Перенесено в «Когда-нибудь»');
};
B.acts.twDup = el => {
  const t = B.task(el.dataset.id);
  const n = Object.assign({}, t, {id: B.uid(), done: false, doneAt: null, status: 'todo', created: Date.now(), postpones: [], repNext: undefined, ord: (t.ord ?? 0) + 5,
    subs: (t.subs || []).map(s => ({id: B.uid(), t: s.t, done: false}))});
  delete n.repNext;
  B.saveTask(n); B.closeSheet(); B.toast('Копия создана');
};
B.acts.twShare = async el => {
  const t = B.task(el.dataset.id);
  const text = [t.title, t.due ? `Когда: ${B.fmtW(t.due)}${t.time ? ' ' + t.time : ''}` : '', (t.notes || '').trim(), ...(t.subs || []).map(s => `${s.done ? '☑' : '☐'} ${s.t}`)].filter(Boolean).join('\n');
  try { if (navigator.share){ await navigator.share({title: t.title, text}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); B.toast('Текст задачи скопирован'); } catch (e) { B.toast('Не получилось поделиться'); }
};
/* вложения: фото сжимаются до 1280 px, остальные файлы до 700 КБ. Лежат отдельными записями f_<id>. */
const LIMIT = 4.3e6;
async function readFile(file){
  if (file.type.startsWith('image/') && file.type !== 'image/gif'){
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.75);
      return {type: 'image/jpeg', data, size: Math.round(data.length * 0.75)};
    } finally { URL.revokeObjectURL(url); }
  }
  if (file.size > 700 * 1024) throw new Error('big');
  const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  return {type: file.type || 'application/octet-stream', data, size: file.size};
}
B.inputs.twFile = async (el, e) => {
  if (e.type !== 'change') return;
  const id = el.dataset.id;
  for (const f of [...el.files]){
    try {
      const r = await readFile(f);
      if (!B.cloud && B.lsSize() + r.data.length > LIMIT){ B.toast('Места в браузере почти не осталось. Без входа в облако вложения хранятся только здесь, прикрепи лучше ссылку.', 6000); break; }
      const fid = B.uid();
      B.put('f_' + fid, {id: fid, task: id, name: f.name, type: r.type, size: r.size, data: r.data, at: Date.now()}, true);
    } catch (err) { B.toast(err.message === 'big' ? `«${esc(f.name)}» больше 700 КБ. Такие файлы лучше прикрепить ссылкой на Диск.` : 'Файл не прочитался'); }
  }
  pop = ''; B.openTask(id, true);
};
B.acts.twLink = async el => {
  const id = el.dataset.id;
  const url = await B.dialog(`<h3>Ссылка</h3><input id="twUrl" type="url" placeholder="https://" autofocus><input id="twUrlN" placeholder="Название, если нужно">
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="twUrlOk">Прикрепить</button></div>`);
  if (!url) { B.openTask(id, true); return; }
  const fid = B.uid(); B.put('f_' + fid, {id: fid, task: id, name: url.n, url: url.u, at: Date.now()}, true);
  pop = ''; B.openTask(id, true);
};
B.acts.twUrlOk = () => { let u = (B.$('#twUrl').value || '').trim(); if (!u) return; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; B.closeDialog({u, n: (B.$('#twUrlN').value || '').trim()}); };
B.acts.twFileDel = el => { const f = B.get('f_' + el.dataset.f); if (!f) return; B.put('f_' + f.id, null, true); B.openTask(f.task, true); };
/* удаление задачи убирает и её вложения */
const baseDel = B.acts.taskDel;
B.acts.taskDel = async el => {
  const id = el.dataset.id; await baseDel(el);
  const t = B.task(id); if (!t || t.deleted) B.list('f_').filter(f => f.task === id).forEach(f => B.put('f_' + f.id, null, true));
  B.changed();
};
/* наведи курсор на задачу и нажми Delete (на Mac клавиша delete = Backspace): удаляется сразу, в подсказке можно вернуть.
   Вложения стираются, только когда подсказка ушла и задачу не вернули. */
let hoverId = null, undoFn = null, undoT = 0;
document.addEventListener('mouseover', e => { const r = e.target.closest('[data-tid]'); hoverId = r && !r.closest('.sheet,.dlg') ? r.dataset.tid : null; });
document.addEventListener('mouseleave', () => { hoverId = null; });
document.addEventListener('keydown', e => {
  if ((e.key !== 'Delete' && e.key !== 'Backspace') || !hoverId || e.metaKey || e.ctrlKey || e.altKey) return;
  const a = document.activeElement;
  if (a && (a.matches('input,textarea,select') || a.isContentEditable)) return;
  if (B.sheetOpen() || !B.$('#dlgScrim').hidden) return;
  const id = hoverId, t = B.task(id); if (!t || t.deleted) return;
  e.preventDefault();
  const undo = B.delTask(id); if (!undo) return;
  hoverId = null;
  if (undoFn) undoFn.commit();
  const commit = () => { B.list('f_').filter(f => f.task === id).forEach(f => B.put('f_' + f.id, null, true)); };
  undoFn = {undo, commit}; clearTimeout(undoT);
  undoT = setTimeout(() => { if (undoFn && undoFn.commit === commit){ commit(); undoFn = null; } }, 6000);
  B.toast(`Удалено: ${B.esc(t.title || 'без названия')} <button class="toast-btn" data-act="undoDel">Вернуть</button>`, 6000);
});
B.acts.undoDel = () => { if (!undoFn) return; clearTimeout(undoT); undoFn.undo(); undoFn = null; B.toast('Задача вернулась', 1400); };
/* закрытие карточки: пустую задачу без названия не держим */
B.acts.edDone = el => { const t = B.task(el.dataset.id); if (!t) return; const before = B.calc().total; B.setDone(t, !t.done); const gain = B.calc().total - before; if (!t.done && gain > 0) B.toast(`<b class="pos">Готово</b> · <b class="pos">+${gain} XP</b>`); B.openTask(t.id, true); };

/* ---------- напоминания ---------- */
function checkReminders(){
  const now = localISO(new Date());
  B.tasks().forEach(t => {
    if (!t.remind || !t.remind.at || t.remind.fired || t.done || t.remind.at > now) return;
    B.updTask(t.id, {remind: Object.assign({}, t.remind, {fired: Date.now()})}, true);
    const late = (Date.now() - new Date(t.remind.at).getTime()) > 10 * 60e3;
    B.toast(`${icon('bell')} <b>${esc(t.title)}</b>${late ? ' · пропущенное напоминание' : ''}`, 8000);
    if (!late && 'Notification' in window && Notification.permission === 'granted'){
      try {
        const opts = {body: t.time ? `${t.time} · ${t.notes ? t.notes.slice(0, 80) : 'пора'}` : (t.notes || '').slice(0, 80) || 'Напоминание', icon: 'icons/icon-192.png', tag: 't' + t.id};
        if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(t.title, opts)).catch(() => new Notification(t.title, opts));
        else new Notification(t.title, opts);
      } catch (e) {}
    }
  });
}
setTimeout(checkReminders, 3000);
setInterval(checkReminders, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

/* ---------- проекты-календари: форма ---------- */
function projForm(p){
  const roots = B.projects().filter(q => !q.parent && q.id !== (p && p.id) && q.id !== 'inbox');
  return `<h2>${p ? 'Календарь' : 'Новый календарь'}</h2>
    <label class="field">Название<input id="pName" value="${esc(p ? p.name : '')}" placeholder="Например, Органическая химия" autofocus></label>
    ${p && p.id === 'inbox' ? '' : `<label class="field">Внутри<select id="pParent"><option value="">Отдельный календарь</option>${roots.map(r => `<option value="${r.id}" ${p && p.parent === r.id ? 'selected' : ''}>${esc(r.name)} (как предмет)</option>`).join('')}</select></label>`}
    <div class="field">Цвет<div class="colors">${B.COLORS.map(c => `<label class="cpick c-${c}"><input type="radio" name="pColor" value="${c}" ${(p ? p.color : 'green') === c ? 'checked' : ''}><i></i><span>${B.COLOR_NAMES[c]}</span></label>`).join('')}</div></div>
    <div class="row between">${p && p.id !== 'inbox' ? `<button class="btn ghost danger" data-act="projDel" data-id="${p.id}">${icon('trash')} В архив</button>` : '<span></span>'}
    <button class="btn primary" data-act="projSave" data-id="${p ? p.id : ''}">Сохранить</button></div>`;
}
B.COLORS = ['ink', 'blue', 'teal', 'green', 'amber', 'red', 'violet', 'pink'];
B.COLOR_NAMES = {ink: 'графит', blue: 'синий', teal: 'бирюза', green: 'зелёный', amber: 'янтарь', red: 'красный', violet: 'фиолет', pink: 'розовый'};
B.acts.projNew = () => B.sheet(projForm(null));
B.acts.projEdit = el => B.sheet(projForm(B.proj(el.dataset.id)));
B.acts.projSave = el => {
  const name = B.$('#pName').value.trim(); if (!name) return;
  const parent = B.$('#pParent') ? B.$('#pParent').value : '';
  const color = (B.$('input[name=pColor]:checked') || {}).value || 'green';
  const id = el.dataset.id || B.uid();
  const old = B.proj(id) || {id, order: B.projects().length + 1};
  B.put('p_' + id, Object.assign({}, old, {name, parent: parent || undefined, color}));
  B.closeSheet(); S.cal = id; saveS(); location.hash = '#/tasks';
  B.render(true);
};
B.acts.projDel = async el => {
  const p = B.proj(el.dataset.id), n = B.tasks().filter(t => t.proj === p.id && !t.done).length;
  if (!(await B.confirm(`Убрать «${esc(p.name)}» в архив?${n ? ` Открытые задачи (${n}) переедут во «Входящие».` : ''}`, 'В архив', true))) return;
  B.tasks().filter(t => t.proj === p.id).forEach(t => B.saveTask(Object.assign({}, t, {proj: 'inbox'}), true));
  B.projects().filter(q => q.parent === p.id).forEach(q => B.put('p_' + q.id, Object.assign({}, q, {parent: undefined}), true));
  B.put('p_' + p.id, Object.assign({}, p, {arch: true}));
  B.closeSheet(); S.cal = 'all'; saveS(); B.render(true);
};
})();
/* перестроить неделю, если окно пересекло ширину телефона */
(function(){ let narrow = innerWidth < 760; addEventListener('resize', () => { const n = innerWidth < 760; if (n !== narrow){ narrow = n; if (location.hash.startsWith('#/tasks')) B.render(); } }); })();
