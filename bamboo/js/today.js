/* Зов леса: экран «Сегодня».
   Дела на сегодня, привычки, вебы ШАДа, дедлайны, шаг большого дела и вечерний разбор. */
(function(){
const {esc, icon} = B;
B.views = B.views || {};
B.acts.reloadTeaching = () => B.refreshTeaching();

B.levelCard = (c, compact) => {
  const {next} = B.mileFor(c.level);
  return `<a class="lvl ${compact ? 'compact' : ''}" href="#/forest">
    <div class="lvl-ring">${B.ring(c.frac, 58)}<b>${c.level}</b></div>
    <div class="lvl-body">
      <div class="lvl-top"><span>Уровень ${c.level}</span><span class="mono">${c.into}/${c.need} XP</span></div>
      ${B.bar(c.frac, 'xp')}
      <div class="lvl-sub">${icon('tree')} лес <b>${c.trees ? B.fmtTrees(c.trees) : 'поляна'}</b>${next ? ` · до «${esc(next[1])}» ${next[0] - c.level} ${B.plural(next[0] - c.level, 'уровень', 'уровня', 'уровней')}` : ''}</div>
    </div>
    <div class="streak ${c.live ? 'on' : ''}" title="Разборов в дневнике подряд">${icon('flame')}<b>${c.live}</b></div>
  </a>`;
};

/* редактор плана на любой день: главное дело и «если-то» к каждому (когда и где) */
/* список дел на день с коронами: коронованные (главные) наверху, остальные ниже, по важности.
   Используется на «Сегодня» и в вечернем разборе для завтрашнего дня. */
let qCrown = false, qPri = 4;
B.dayList = (date, opts = {}) => {
  const d = B.day(date), ids = d.top || [], t = B.today();
  const ord = d.order || [], oi = x => { const i = ord.indexOf(x.id); return i < 0 ? 1e6 : i; };
  const crowned = ids.map(B.task).filter(x => x && !x.deleted).sort((a, b) => oi(a) - oi(b));
  const cset = new Set(crowned.map(x => x.id));
  const rest = B.tasks().filter(x => !cset.has(x.id) && !x.done && x.due && x.due <= date)
    .sort((a, b) => oi(a) - oi(b) || (a.pri || 4) - (b.pri || 4) || a.due.localeCompare(b.due) || (a.time || '99').localeCompare(b.time || '99'));
  const doneDay = date === t ? B.tasks().filter(x => x.done && x.doneAt && B.dayOf(x.doneAt) === t && !cset.has(x.id)) : [];
  const all = crowned.concat(rest), nAll = all.length + doneDay.length, nDone = all.filter(x => x.done).length + doneDay.length;
  const row = x => B.taskRow(x, {crownDate: date, when: (d.when || {})[x.id], cls: cset.has(x.id) ? 'crowned' : '', grip: true});
  return `<div class="daylist" data-d="${date}">
    ${nAll ? `<div class="crown-meter ${nDone && nDone === nAll ? 'ok' : nDone ? 'set' : ''}">${icon('check')}<span>Сделано ${nDone} из ${nAll}</span>${B.bar(nDone / nAll)}</div>` : ''}
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
B.planPicker = date => B.dayList(date, {ph: 'Дело на завтра', empty: 'На завтра пока ничего.'});

function dayCard(c, d){
  const late = B.tasks().filter(x => !x.done && x.due && x.due < c.today).length;
  const today = c.today;
  const study = B.shadOn(today);
  return `<section class="card plan">
    <div class="row between"><h2>${icon('list')}Дела на сегодня</h2>${late ? `<span class="tag late">${late} просрочено</span>` : ''}</div>
    ${study.map(it=>B.shadRow(it,today)).join('')}
    ${B.dayList(c.today,{empty: study.length ? 'Других дел пока нет.' : ''})}
  </section>`;
}


B.shadRow = (it, date) => {
  const p = it.p, s = B.shadStage(p.n), course = B.shad.courses[p.c] || {};
  const ok = s >= it.need, late = !ok && date < B.today();
  return `<div class="shad-row ${ok ? 'ok' : ''} ${late ? 'late' : ''}">
    <div class="shad-top"><span class="cchip c-${p.c}">${esc(course.name || p.c)}</span><span class="mono">${it.kind === 'web' ? '' : 'ДЗ · '}${esc(p.code)}</span>${it.from ? `<span class="mono muted">${it.from}–${it.to}</span>` : `<span class="muted">${(it.kind === 'web' ? p.wp : p.hp) ? (it.kind === 'hw' ? 'до ' : '') + B.fmtS(it.kind === 'web' ? p.w.date : p.h.date) : 'неделя ' + B.fmtS(it.kind === 'web' ? p.wk : p.hk)}</span>`}${date===B.today()&&!ok?crownButton(date,'shad:'+it.kind+':'+p.n,p.t):''}</div>
    <button class="study-title" data-act="shadOpen" data-n="${p.n}">${esc(p.t)}</button>
    <div class="row between"><small>${B.SHAD_STAGES[s]}</small>
    ${s === 2 ? `<a class="btn sm" href="${esc(B.phagiLink({shadHw:p.n}))}">Открыть ДЗ на Фагах</a>` : s < 4 ? `<button class="btn sm" data-act="shadSet" data-n="${p.n}" data-s="${s+1}">${['Начать веб','Отметить просмотр','','Закрыть тему'][s]}</button>` : ''}</div>
  </div>`;
};
B.acts.shadSet = el => {
  const n = +el.dataset.n, stage = +el.dataset.s;
  if (stage === B.shadStage(n) + 1) B.setShadStage(n, stage);
};
function shadCard(c){
  const items = B.shadOn(c.today), late = B.shadLate().filter(x => !items.some(y => y.p.n === x.p.n));
  const free = B.shadWeek(B.weekStart(c.today)).filter(it => !it.old && B.shadStage(it.p.n) < it.need).length;
  const webs = B.shadWeekAll(B.weekStart(c.today)).filter(it => it.kind === 'web');
  if (!webs.length && !late.length && !free) return '';
  const done = webs.filter(it => B.shadStage(it.p.n) >= it.need).length;
  return `<section class="card shad-summary">
    <div class="row between"><h2>ШАД</h2><a href="#/tasks/shad">План ШАД →</a></div>
    ${webs.length ? `<div class="row between"><span>Вебинары недели</span><b>${done} из ${webs.length}</b></div>${B.bar(done/webs.length)}` : ''}

    ${free ? `<button class="shad-free btn" data-act="openWeekPool">На этой неделе без дня: ${free}. Расставь в планере →</button>` : ''}
    ${late.length ? `<details><summary>Хвосты ШАД · ${late.length}</summary>${late.map(it => B.shadRow(it, '0')).join('')}</details>` : ''}
  </section>`;
}

/* «Фаги»: ближайшие несданные ДЗ и карточки за день. Всё открывается на Фагах */
function phagiCard(c){
  if (!B.cloud) return '';
  const soon = Object.values(B.phx.dl).filter(x => !x.done && x.due && x.due <= B.add(c.today, 7) && (!x.shad || x.fix)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  const day = B.phxDay(c.today), cards = day ? day.cards || 0 : 0;
  const week = B.teaching;
  const lesson = l => `<a class="ph-dl" href="${esc(B.phagiLink({lesson:l.id,date:l.day,role:'teacher'}))}"><b>${esc(B.fmtW(l.day))} ${esc(l.start || '')}</b><span>${esc(l.title)}<br><small>${esc(l.names)} · ${l.files || l.tasks ? [l.files && 'есть материалы', l.tasks && ('ДЗ: '+l.tasks)].filter(Boolean).join(', ') : 'Подготовить урок'}</small></span></a>`;
  const upcoming = (week?.lessons || []).filter(l => l.day >= c.today);
  const recent = (week?.lessons || []).filter(l => l.day < c.today);
  const reviews = week?.reviews || [];
  return `<section class="card ph-card">
    <div class="row between"><h2>${icon('book')}Фаги</h2><a class="muted" href="${B.PHAGI}" target="_blank" rel="noopener">открыть →</a></div>
    ${week?.failed ? '<p class="muted">Не удалось загрузить занятия и ответы. <button class="btn sm" data-act="reloadTeaching">Повторить</button></p>' : ''}
    ${upcoming.length ? '<div class="sub-h">Мои уроки на неделе</div>' + upcoming.map(lesson).join('') : ''}
    ${recent.length ? '<details><summary>Вчерашние уроки</summary>' + recent.map(lesson).join('') + '</details>' : ''}
    ${reviews.length ? '<div class="sub-h">Проверить работы · '+reviews.length+'</div>' + reviews.map(r=>`<a class="ph-dl" href="${esc(B.phagiLink({task:r.id,review:r.uid,role:'teacher'}))}"><b>${esc(r.name)}</b><span>${esc(r.title)}</span></a>`).join('') : ''}
    ${soon.length ? `<div class="sub-h">Моя учёба · сдать</div>${soon.map(x => { const k = B.diff(c.today, x.due); return `<a class="ph-dl ${k < 0 ? 'late' : k <= 1 ? 'near' : ''}" href="${esc(B.phagiTask(x.id))}"><b>${k < 0 ? 'просрочено' : k === 0 ? 'сегодня' : k === 1 ? 'завтра' : B.fmtW(x.due)}</b><span>${esc(x.title)}</span></a>`; }).join('')}` : ''}
    ${cards ? `<p class="muted ph-cards">Карточек за сегодня: ${cards}</p>` : ''}
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
    <h2>${icon('steps')}Шаг большого дела</h2>
    ${big.slice(0, 3).map(t => {
      const st = B.nextStep(t), subs = t.subs || [], d = subs.filter(s => s.done).length;
      return `<div class="big-row">
        <button class="big-title" data-act="openTask" data-id="${t.id}">${esc(t.title)}<span class="muted mono">${d}/${subs.length}</span></button>
        ${B.bar(subs.length ? d / subs.length : 0)}
        ${st ? `<div class="step"><button class="chk sm" data-act="stepDone" data-id="${t.id}" data-sid="${st.id}">${icon('check')}</button><span class="grow">${esc(st.t)}</span></div>`
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
  if (h.auto === 'molbio'){ sub = `${B.alberts?.pagesOn(date) || 0} стр. сегодня`; }
  else if (h.auto === 'read'){ const m = B.readMin(date); sub = `${m}/${h.min || 30} мин`; }
  else if (h.kind === 'weekly'){ const ws = B.weekStart(date); let k = 0; for (let i = 0; i < 7; i++) if (B.habitDone(h, B.add(ws, i))) k++; sub = `${k}/${h.target || 3} за неделю`; }
  const act = h.auto === 'molbio' ? 'data-act="albertsLog"' : h.auto === 'read' ? 'data-act="readQuick"' : h.auto === 'sport' ? 'data-act="sportQuick"' : '';
  if (val === 0.5) sub = 'минимум' + (h.mini ? ': ' + esc(h.mini) : '');
  else if (!done && h.mini && !h.auto) sub = 'хотя бы: ' + esc(h.mini);
  return `<${act.startsWith('href') ? 'a' : 'button'} class="hchip ${done ? 'on' : ''} ${val === 0.5 ? 'half' : ''}" style="--hc:var(--c-${B.habitColor ? B.habitColor(h) : 'green'})" ${act || `data-act="habitToggle" data-id="${h.id}" data-d="${date}"`}>
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
/* старый адрес раздела «Спорт» ведёт в «Привычки» */
if (location.hash.startsWith('#/sport')) location.replace('#/habits');
/* нажатие: нет ↔ сделано; долгое нажатие ставит минимальную версию (если она задана) */
let lpT = 0, lpDone = false;
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('.hchip[data-act=habitToggle],.habit-mark[data-act=habitToggle]'); if (!el) return;
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
document.addEventListener('contextmenu', e => { if (e.target.closest('.hchip,.habit-mark')) e.preventDefault(); });
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

function reviewCard(c, d){
  const has = B.reviewDone(c.today), h = new Date().getHours(), hot = h >= 19 || h < 4;
  return `<a class="card review-line ${has ? 'done' : hot ? 'hot' : ''}" href="#/journal">
    ${icon(has ? 'check' : 'pen')}<span class="grow"><b>${has ? 'Разбор дня написан' : 'Вечерний разбор'}</b><small>${has ? (d.review?.mood ? 'настроение ' + '●'.repeat(d.review.mood) : 'открыть дневник') : 'пять минут: что сделал, что не вышло, что на завтра'}</small></span>${icon('right')}
  </a>`;
}

function weekCard(c){
  const ws = B.weekStart(c.today), prev = B.get('wk_' + B.add(ws, -7)), cur = B.get('wk_' + ws);
  let html = '';
  if (prev && (prev.change || '').trim()) html += `<section class="card week-note"><div class="eyebrow">На этой неделе меняю</div><p>${esc(prev.change)}</p></section>`;
  if (B.wd(c.today) >= 5 && !(cur && (cur.change || '').trim())) html += `<a class="card week-cta" href="#/stats">${icon('chart')}<span class="grow"><b>Подведи итоги недели</b><small>5 минут: что мешало и что меняешь</small></span>${icon('right')}</a>`;
  return html;
}

function agendaKey(e){
  return e.kind==='shad' ? 'shad:'+e.part+':'+e.id : e.kind+':'+e.id;
}
function crownButton(date,key,label){
  const day=B.day(date), task=key.startsWith('task:'), id=task?key.slice(5):key;
  const on=task?(day.top||[]).includes(id):day.focus===key;
  const title=(on?'Снять корону':'Сделать главным')+' · '+label;
  return `<button class="icon-btn sm crown ${on?'on':''}" data-act="${task?'crown':'crownItem'}" data-d="${date}" data-id="${esc(id)}" aria-pressed="${on}" aria-label="${esc(title)}" title="${esc(title)}">${icon('crown')}</button>`;
}
B.acts.crownItem=el=>B.editDay(el.dataset.d,d=>{
  d.focus=d.focus===el.dataset.id?'':el.dataset.id;
  d.top=[];
});
function agendaAttrs(e){
  return `data-act="acOpen" data-k="${e.kind}" data-id="${esc(e.id)}" data-on="${e.on}" data-start="${e.start}" data-end="${e.end}" data-part="${e.part || ''}"`;
}
function focusCard(today, day, rows){
  const crown = (day.top || []).map(B.task).find(t => t && !t.deleted && !t.done);
  const study = B.shadOn(today).filter(it => B.shadStage(it.p.n) < it.need);
  const chosen = study.find(it => day.focus==='shad:'+it.kind+':'+it.p.n);
  const event = rows.find(e => e.kind==='event' && day.focus===agendaKey(e));
  const item = chosen || study.find(it => it.kind==='hw') || study[0];
  const task = crown || B.tasks().filter(t => !t.done && t.due===today)
    .sort((a,b)=>(a.pri||4)-(b.pri||4))[0];
  let title, detail, button;
  if(event){
    title=event.title;
    detail=[event.start.slice(11),event.location].filter(Boolean).join(' · ');
    button=`<button ${agendaAttrs(event)}>Открыть событие →</button>`;
  } else if(crown || (task && !item)){
    title=task.title;
    detail=[B.proj(task.proj)?.name,task.time,task.est?B.mins(task.est):''].filter(Boolean).join(' · ');
    button=`<button data-act="openTask" data-id="${esc(task.id)}">Открыть дело →</button>`;
  } else if(item){
    title=item.p.t;
    detail=[item.kind==='hw'?'Домашняя работа':'Вебинар', B.shad.courses[item.p.c]?.name].filter(Boolean).join(' · ');
    button=item.kind==='hw'?`<a href="${esc(B.phagiLink({shadHw:item.p.n,backDay:today}))}">Открыть домашку →</a>`:
      `<button data-act="shadOpen" data-n="${item.p.n}">Открыть вебинар →</button>`;
  } else return '';
  return `<section class="card day-focus"><small>${icon('crown')} Главное дело${event||chosen||crown?'':' · по плану'}</small><h2>${esc(title)}</h2>
    ${detail?`<p>${esc(detail)}</p>`:''}<div>${button}</div></section>`;
}
function dayAgenda(today,rows){
  return `<section class="card day-agenda"><div class="row between"><h2>Расписание</h2>
    <button class="agenda-link" data-act="todayCalendar" data-d="${today}">В календарь ${icon('right')}</button></div>
    ${rows.map(e=>`<div class="agenda-entry"><button class="agenda-line" ${agendaAttrs(e)}>
      <time>${e.start < today?'00:00':e.start.slice(11,16)}</time>${icon(e.kind==='shad'?'book':'cal')}
      <span><b>${esc(e.title)}</b>${e.location||e.course?`<small>${esc(e.location||e.course)}</small>`:''}</span></button>
      ${e.done?'':crownButton(today,agendaKey(e),e.title)}</div>`).join('')
      || '<p class="empty sm">На сегодня событий со временем нет.</p>'}</section>`;
}
B.acts.todayCalendar = el => {
  location.hash = '#/tasks/calendar';
  B.acts.acDay(el);
};
function weekStrip(today){
  const start = B.weekStart(today);
  return `<nav class="day-week" aria-label="Дни недели">${B.WD.map((wd,i) => {
    const day = B.add(start,i);
    return `<button data-act="todayCalendar" data-d="${day}" aria-label="${B.fmtW(day)}" ${day===today?'aria-current="date"':''}>
      <small>${wd}</small><b>${B.parse(day).getDate()}</b></button>`;
  }).join('')}</nav>`;
}
B.views.today = {
  title: 'Сегодня',
  render(){
    const c = B.calc(), d = B.day(c.today);
    const rows=(B.calendarView?.itemsBetween(c.today,c.today)||[]).filter(e=>e.start.includes('T'));
    const date = B.parse(c.today), r = c.days[c.today] || {};
    return `<div class="page today">
      <header class="page-h today-h">
        <div><h1>Сегодня</h1><p class="day-date">${B.WDF[B.wd(c.today)]}, ${date.getDate()} ${B.MONG[date.getMonth()]}</p></div>
        <a class="today-stat" href="#/forest" title="Уровень, серия разборов и опыт за сегодня">
          <span>${icon('tree')}<b>${c.level}</b> ур.</span><span>${icon('flame')}<b>${c.live}</b></span><span><b>${r.xp > 0 ? '+' : ''}${r.xp || 0}</b> XP</span>
        </a>
      </header>
      ${weekStrip(c.today)}
      ${weekCard(c)}
      <div class="cols">
        <div class="col">
          ${focusCard(c.today, d, rows)}
          ${B.alberts?.card() || ''}
          ${dayAgenda(c.today, rows)}
          ${dayCard(c, d)}
          ${new Date().getHours() >= 19 || new Date().getHours() < 4 ? reviewCard(c,d) : ''}
        </div>
        <div class="col">
          ${habitsCard(c)}
          ${shadCard(c)}
          ${phagiCard(c)}
          ${deadlineCard(c)}
          ${bigCard()}
        </div>
      </div>
    </div>`;
  }
};

/* перетаскивание дел за ручку: порядок хранится в дне (d.order) */
let drag = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest('.grip'); if (!g) return;
  const row = g.closest('.task'), list = row && row.parentElement, box = row && row.closest('.daylist'); if (!box) return;
  e.preventDefault();
  const r = row.getBoundingClientRect();
  drag = {row, list, date: box.dataset.d, y0: e.clientY, h: r.height, id: g.closest('.task').dataset.tid};
  row.classList.add('dragging'); row.setPointerCapture && g.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = e.clientY - drag.y0; drag.row.style.transform = `translateY(${dy}px)`;
  const sibs = [...drag.list.children].filter(x => x !== drag.row && x.classList.contains('task'));
  const mid = drag.row.getBoundingClientRect().top + drag.h / 2;
  const before = sibs.find(x => { const b = x.getBoundingClientRect(); return mid < b.top + b.height / 2; });
  sibs.forEach(x => x.classList.toggle('drop-before', x === before));
  drag.before = before ? before.dataset.tid : null;
});
document.addEventListener('pointerup', () => {
  if (!drag) return;
  const {row, list, date, id, before} = drag; drag = null;
  row.classList.remove('dragging'); row.style.transform = '';
  const ids = [...list.children].filter(x => x.classList.contains('task')).map(x => x.dataset.tid).filter(x => x !== id);
  const i = before ? ids.indexOf(before) : ids.length; ids.splice(i < 0 ? ids.length : i, 0, id);
  B.editDay(date, d => { d.order = ids; });
  B.render(true);
});

/* план дня */
const pdate = el => el.dataset.d || B.today();
/* корона: сделать дело главным на день или снять */
B.acts.crown = async el => {
  const t = pdate(el), id = el.dataset.id, d = B.day(t);
  if ((d.top || []).includes(id)){ B.editDay(t, x => { x.top = (x.top || []).filter(i => i !== id); }); return; }
  const tk = B.task(id); if (!tk) return;
  // просроченное дело главным на более поздний день — это перенос, нужна причина
  if (!tk.done && tk.due && tk.due < B.today() && t > tk.due){
    const why = await B.askReason(tk, t); if (!why) return;
    B.updTask(tk.id, {due: t, postpones: (tk.postpones || []).concat({from: tk.due, to: t, why, at: Date.now()})}, true);
  }
  B.editDay(t, x => { x.top = [id]; x.focus = ''; x.planAt = x.planAt || Date.now(); });
  const k = B.task(id); if (k && (!k.due || k.due > t)) B.updTask(id, {due: t});
  B.toast('Главное дело выбрано');
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
