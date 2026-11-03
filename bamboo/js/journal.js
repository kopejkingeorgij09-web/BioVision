/* Зов леса: дневник. Итоги дня собираются сами, вечерний разбор (что сделал, что не вышло и почему),
   настроение и энергия, мысли с временем. Отсюда же «Разобрать неделю в Claude». */
(function(){
const {esc, icon} = B;
const MOOD = ['', 'плохо', 'так себе', 'ровно', 'хорошо', 'отлично'];
/* вопросы-подсказки для «Мыслей»: когда не знаешь, что писать, отвечаешь на один */
const HINTS = [
  'Что сегодня удивило или оказалось не таким, как ты думал?',
  'Какую мысль из лекции или книги хочется не забыть? Перескажи её своими словами.',
  'Что сегодня забрало больше всего сил и стоило ли оно того?',
  'О чём ты сегодня думал чаще всего?',
  'Что бы ты сказал себе утром, если бы мог?',
  'Где сегодня застрял в задаче и что в итоге помогло (или помогло бы)?',
  'Какой разговор запомнился и почему?',
  'Что тревожит прямо сейчас? Назови это одной фразой.',
  'За что сегодня можно себя похвалить, даже за мелочь?',
  'Какая идея пришла сегодня: для учёбы, для занятий с учениками, для приложения?',
  'Что ты понял про себя: когда работается лучше, что выбивает из колеи?',
  'Чему научил сегодняшний ученик или урок, который ты вёл?',
  'Что хочется изменить в этой неделе, пока она не кончилась?',
  'Какой вопрос ты сегодня так и не задал, а стоило?'
];
const hintShift = {};
const hintI = date => { let h = 0; for (const c of date) h = (h * 31 + c.charCodeAt(0)) % 997; return (h + (hintShift[date] || 0)) % HINTS.length; };
B.acts.thHint = el => { const d = el.dataset.d, ta = B.$('#thNew'), v = ta ? ta.value : ''; hintShift[d] = (hintShift[d] || 0) + 1; B.render(true); const n = B.$('#thNew'); if (n && v) n.value = v; };

function summary(date){
  const d = B.day(date);
  const done = B.tasks().filter(t => t.done && t.doneAt && B.dayOf(t.doneAt) === date);
  const subs = []; B.tasks().forEach(t => (t.subs || []).forEach(s => { if (s.done && s.doneAt && B.dayOf(s.doneAt) === date) subs.push({t, s}); }));
  const ws = B.workouts().filter(w => w.date === date);
  const shad = []; for (const n in B.shad.marks){ const m = B.shad.marks[n]; if (m.at && B.dayOf(m.at) === date){ const p = B.shad.plan.find(x => x.n === +n); if (p) shad.push(`${p.code} «${p.t}»: ${B.SHAD_STAGES[m.s]}`); } }
  const hs = B.habits().filter(h => B.habitDone(h, date)).map(h => h.name);
  return {done, subs, ws, rm: B.readMin(date), shad, hs};
}

function summaryHtml(date){
  const s = summary(date);
  const li = [];
  s.done.forEach(t => li.push(`${icon('check')}${esc(t.title)}`));
  s.subs.forEach(({t, s: x}) => li.push(`${icon('steps')}${esc(x.t)} <span class="muted">(${esc(t.title)})</span>`));
  s.shad.forEach(x => li.push(`${icon('chart')}ШАД ${esc(x)}`));
  if (s.rm) li.push(`${icon('book')}${B.mins(s.rm)} чтения`);
  s.ws.forEach(w => li.push(`${icon('dumbbell')}${esc(B.SPORT_TYPES[w.type] || w.type)}${w.min ? ', ' + B.mins(+w.min) : ''}`));
  if (s.hs.length) li.push(`${icon('habit')}Привычки: ${s.hs.map(esc).join(', ')}`);
  return li.length ? `<ul class="plain sum">${li.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="muted">Пока ничего не отмечено.</p>';
}

B.views.journal = {
  title: 'Дневник',
  render(arg){
    const t = B.today(), date = /^\d{4}-\d\d-\d\d$/.test(arg || '') && arg <= t ? arg : t;
    const d = B.day(date), rv = d.review || {}, c = B.calc(), r = c.days[date];
    const top = (d.top || []).map(B.task).filter(Boolean);
    const res = r ? {good: 'разбор', some: 'без разбора', empty: 'пустой', open: 'идёт'}[r.result] : '';
    return `<div class="page journal-page">
      <header class="page-h"><div><div class="eyebrow">Дневник</div><h1>${date === t ? 'Сегодня' : B.WDF[B.wd(date)] + ', ' + B.fmt(date)}</h1></div>
        <div class="row"><a class="icon-btn" href="#/journal/${B.add(date, -1)}" aria-label="Предыдущий день">${icon('left')}</a>${date < t ? `<a class="icon-btn" href="#/journal/${B.add(date, 1)}" aria-label="Следующий день">${icon('right')}</a>` : ''}</div></header>
      ${timeline(date, c)}
      <div class="cols">
        <div class="col">
          <section class="card">
            <div class="row between"><h2>${icon('list')}Итоги дня</h2>${res ? `<span class="tag r-${r.result}">${res}${r.xp ? ` · ${r.xp > 0 ? '+' : ''}${r.xp} XP` : ''}</span>` : ''}</div>
            ${top.length ? `<div class="sub-h">С короной: ${top.filter(x => x.done).length}/${top.length}</div><ul class="plain sum">${top.map(x => `<li class="${x.done ? '' : date < t ? 'miss' : 'wait'}">${icon(x.done ? 'check' : date < t ? 'x' : 'later')}${esc(x.title)}</li>`).join('')}</ul>` : '<p class="muted">Плана на этот день не было.</p>'}
            <div class="sub-h">Сделано</div>${summaryHtml(date)}
          </section>
          <section class="card review-form">
            <h2>${icon('pen')}Разбор</h2>
            <label class="field">Что сделал и чем доволен<textarea rows="2" data-in="rv" data-k="done" data-d="${date}" placeholder="Коротко, своими словами">${esc(rv.done || '')}</textarea></label>
            <label class="field">Что не вышло и почему<textarea rows="2" data-in="rv" data-k="why" data-d="${date}" placeholder="Честно: где отвлёкся, что отложил, что помешало">${esc(rv.why || '')}</textarea></label>
            <div class="rv-row"><div class="field">Настроение<div class="chips">${[1, 2, 3, 4, 5].map(i => `<button class="chip ${rv.mood === i ? 'on' : ''}" data-act="rvSet" data-k="mood" data-v="${i}" data-d="${date}">${MOOD[i]}</button>`).join('')}</div></div>
            <div class="field">Энергия<div class="chips">${[1, 2, 3, 4, 5].map(i => `<button class="chip ${rv.energy === i ? 'on' : ''}" data-act="rvSet" data-k="energy" data-v="${i}" data-d="${date}">${'●'.repeat(i)}</button>`).join('')}</div></div></div>
            <p class="hint" id="rvSaved">${date < t && !B.reviewDone(date) && B.hasReview(d) ? 'Разбор написан после окончания дня: он останется в дневнике, но в серию не попадёт.' : B.reviewDone(date) ? 'Разбор засчитан, серия дневника продолжается.' : 'Сохраняется само, пока пишешь.'}</p>
          </section>
        </div>
        <div class="col">
          <section class="card thoughts">
            <h2>${icon('quote')}Мысли</h2>
            <p class="th-hint"><span>${esc(HINTS[hintI(date)])}</span><button class="link" data-act="thHint" data-d="${date}">другой вопрос</button></p>
            <div class="add-line"><textarea id="thNew" rows="2" placeholder="Можно ответить на вопрос выше или записать что угодно своё"></textarea></div>
            <div class="row end"><button class="btn sm primary" data-act="thAdd" data-d="${date}">Записать</button></div>
            <div class="notes">${(d.notes || []).slice().reverse().map(n => `<div class="bnote t"><p>${esc(n.t)}</p><span class="muted mono">${B.hm(n.at)}</span><button class="icon-btn sm" data-act="thDel" data-d="${date}" data-at="${n.at}">${icon('x')}</button></div>`).join('') || '<p class="muted">Мыслей за этот день нет.</p>'}</div>
          </section>
          ${pastCard(date)}
        </div>
      </div>
    </div>`;
  },
  mount(){
    // выбранный день в ленте сразу виден, лента прокручена к нему
    const sel = B.$('.jt-day.on'), box = B.$('.jt-scroll');
    if (sel && box) box.scrollLeft = sel.offsetLeft - box.clientWidth + sel.offsetWidth * 3;
  }
};
/* лента дней: от первого дня с записями (не дальше 120 дней назад) до сегодня; цвет полоски = итог дня,
   точка = есть мысли; настроение видно во всплывающей подсказке */
const RES = {good: 'с разбором', some: 'без разбора', empty: 'пустой день', open: 'идёт'};
function timeline(date, c){
  const t = B.today(), keys = Object.keys(c.days).concat(B.dayDates()).filter(k => k <= t).sort();
  let from = keys[0] || t; const lim = B.add(t, -120), min = B.add(t, -13);
  if (from < lim) from = lim; if (from > min) from = min; if (date < from) from = date;
  let html = '', mon = -1;
  for (let k = from; k <= t; k = B.add(k, 1)){
    const p = B.parse(k), x = c.days[k], dd = B.day(k), rv = dd.review || {}, notes = (dd.notes || []).length;
    if (p.getMonth() !== mon){ mon = p.getMonth(); html += `<span class="jt-mon">${B.MONF[mon]}</span>`; }
    html += `<a class="jt-day ${k === date ? 'on' : ''} ${k === t ? 'now' : ''} ${B.wd(k) > 4 ? 'we' : ''}" href="#/journal/${k}" title="${B.fmtW(k)}${x && RES[x.result] ? ' · ' + RES[x.result] : ''}${rv.mood ? ' · ' + MOOD[rv.mood] : ''}${notes ? ' · мыслей: ' + notes : ''}">
      <small>${B.WD[B.wd(k)]}</small><b>${p.getDate()}</b><i class="jt-bar ${x ? 'r-' + x.result : ''}"></i><span class="jt-meta">${notes ? '<i class="jt-dot"></i>' : ''}</span></a>`;
  }
  return `<nav class="jt" aria-label="Дни дневника"><div class="jt-scroll">${html}</div>
</nav>`;
}
/* «Месяц назад» и «Год назад»: что было в этот же день */
function sameDay(date, months){
  const p = B.parse(date), d = new Date(p.getFullYear(), p.getMonth() - months, 1, 12);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(p.getDate(), last));
  return B.ymd(d);
}
function pastCard(date){
  const items = [['Неделю назад', B.add(date, -7)], ['Месяц назад', sameDay(date, 1)], ['Полгода назад', sameDay(date, 6)], ['Год назад', sameDay(date, 12)]].map(([l, k]) => {
    const d = B.day(k), rv = d.review || {}, notes = d.notes || [];
    const text = (rv.done || rv.why || (notes[0] && notes[0].t) || '').trim();
    if (!text) return '';
    return `<a class="past" href="#/journal/${k}"><span class="eyebrow">${l} · ${B.fmtW(k)}${rv.mood ? ' · ' + MOOD[rv.mood] : ''}</span><p>${esc(text.length > 220 ? text.slice(0, 220) + '…' : text)}</p>${notes.length ? `<span class="muted">${icon('quote')} мыслей: ${notes.length}</span>` : ''}</a>`;
  }).filter(Boolean);
  if (!items.length) return '';
  return `<section class="card"><h2>${icon('later')}В этот день раньше</h2>${items.join('')}</section>`;
}
B.inputs.rv = el => {
  const date = el.dataset.d;
  B.editDay(date, d => { const r = d.review || {}; d.review = Object.assign({}, r, {[el.dataset.k]: el.value, at: Date.now(), first: r.first || Date.now()}); }, true);
  const s = B.$('#rvSaved'); if (s) s.textContent = 'Сохранено';
};
B.acts.rvSet = el => B.editDay(el.dataset.d, d => { d.review = Object.assign({}, d.review, {[el.dataset.k]: +el.dataset.v}); });
B.acts.thAdd = el => {
  const v = B.$('#thNew').value.trim(); if (!v) return;
  const date = el.dataset.d, at = date === B.today() ? Date.now() : B.parse(date).getTime() + 8 * 3600e3;
  B.editDay(date, d => { d.notes = (d.notes || []).concat({t: v, at}); });
};
B.acts.thDel = async el => {
  if (!(await B.confirm('Удалить запись?', 'Удалить', true))) return;
  B.editDay(el.dataset.d, d => { d.notes = (d.notes || []).filter(n => String(n.at) !== el.dataset.at); });
};


/* ---------- запрос для Claude ---------- */
function weekPrompt(){
  const t = B.today(), c = B.calc(), lines = [];
  lines.push('Я веду дневник продуктивности «Зов леса»: учусь в вузе и готовлюсь к ШАД, борюсь с прокрастинацией. Ниже мои записи за последние 7 дней.');
  lines.push('Проанализируй их как строгий, но доброжелательный тренер: 1) где и почему я откладываю (по причинам переносов и разборам), 2) какие привычки проседают и в какие дни, 3) что получилось хорошо, 4) конкретный план на следующую неделю: три главных цели, что убрать, как построить дни. Без общих советов, только по моим данным. Отвечай по-русски.');
  lines.push('');
  lines.push(`Уровень ${c.level}, разборов подряд ${c.live} (рекорд ${c.best}), дней с делами подряд ${c.tasks.cur}.`);
  for (let i = 7; i >= 1; i--){
    const date = B.add(t, -i); if (date < c.start) continue;
    const d = B.day(date), r = c.days[date] || {}, s = summary(date), rv = d.review || {};
    const top = (d.top || []).map(B.task).filter(Boolean);
    lines.push(`## ${B.WDF[B.wd(date)]}, ${B.fmt(date)}: ${({good: 'разбор есть', some: 'без разбора', empty: 'пустой день'})[r.result] || ''}`);
    if (top.length) lines.push(`Важные (с короной): ${top.map(x => (x.done ? '[x] ' : '[ ] ') + x.title).join('; ')}`);
    if (s.done.length) lines.push(`Сделано: ${s.done.map(x => x.title).join('; ')}`);
    lines.push(`Чтение ${s.rm} мин, тренировка: ${s.ws.length ? s.ws.map(w => B.SPORT_TYPES[w.type]).join(', ') : 'нет'}, привычки: ${s.hs.join(', ') || 'нет'}`);
    if (rv.done) lines.push(`Что сделал: ${rv.done}`);
    if (rv.why) lines.push(`Что не вышло и почему: ${rv.why}`);
    if (rv.mood) lines.push(`Настроение ${rv.mood}/5, энергия ${rv.energy || '?'}/5`);
    (d.notes || []).slice(0, 3).forEach(n => lines.push(`Мысль: ${n.t}`));
  }
  const pp = [];
  B.tasks().forEach(tk => (tk.postpones || []).forEach(p => { if (Date.now() - p.at < 7 * 864e5) pp.push(`«${tk.title}» ${p.from} → ${p.to}: ${p.why}`); }));
  if (pp.length){ lines.push(''); lines.push('Переносы задач:'); pp.forEach(x => lines.push('- ' + x)); }
  const open = B.tasks().filter(x => !x.done && x.due && x.due < t);
  if (open.length){ lines.push(''); lines.push('Просрочено сейчас: ' + open.map(x => `«${x.title}» (срок ${x.due})`).join('; ')); }
  const big = B.tasks().filter(x => x.big && !x.done);
  if (big.length){ lines.push(''); lines.push('Большие дела: ' + big.map(x => `«${x.title}» ${(x.subs || []).filter(s => s.done).length}/${(x.subs || []).length} шагов`).join('; ')); }
  let s = lines.join('\n');
  if (s.length > 7000) s = s.slice(0, 7000) + '\n…';
  return s;
}
B.weekPrompt = weekPrompt;
B.acts.aiWeek = () => { window.open('https://claude.ai/new?q=' + encodeURIComponent(weekPrompt()), '_blank', 'noopener'); };
B.acts.aiCopy = async () => {
  try { await navigator.clipboard.writeText(weekPrompt()); B.toast('Запрос скопирован. Вставь его в чат с Claude'); }
  catch (e) { B.sheet(`<h2>Запрос для Claude</h2><textarea rows="14" readonly>${esc(weekPrompt())}</textarea>`); }
};
})();
