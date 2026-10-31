/* Режим бамбука: дневник. Итоги дня собираются сами, вечерний разбор (что сделал, что не вышло и почему, главное на завтра),
   настроение и энергия, мысли с временем. Отсюда же «Разобрать неделю в Claude». */
(function(){
const {esc, icon} = B;
const MOOD = ['', 'плохо', 'так себе', 'ровно', 'хорошо', 'отлично'];

function summary(date){
  const d = B.day(date);
  const done = B.tasks().filter(t => t.done && t.doneAt && B.dayOf(t.doneAt) === date);
  const subs = []; B.tasks().forEach(t => (t.subs || []).forEach(s => { if (s.done && s.doneAt && B.dayOf(s.doneAt) === date) subs.push({t, s}); }));
  const pomo = d.pomo || [], pm = pomo.reduce((a, p) => a + (p.min || 0), 0);
  const ws = B.workouts().filter(w => w.date === date);
  const shad = []; for (const n in B.shad.marks){ const m = B.shad.marks[n]; if (m.at && B.dayOf(m.at) === date){ const p = B.shad.plan.find(x => x.n === +n); if (p) shad.push(`${p.code} «${p.t}»: ${B.SHAD_STAGES[m.s]}`); } }
  const hs = B.habits().filter(h => B.habitDone(h, date)).map(h => h.name);
  return {done, subs, pomo, pm, ws, rm: B.readMin(date), shad, hs};
}

function summaryHtml(date){
  const s = summary(date);
  const li = [];
  s.done.forEach(t => li.push(`${icon('check')}${esc(t.title)}`));
  s.subs.forEach(({t, s: x}) => li.push(`${icon('steps')}${esc(x.t)} <span class="muted">(${esc(t.title)})</span>`));
  s.shad.forEach(x => li.push(`${icon('chart')}ШАД ${esc(x)}`));
  if (s.pomo.length) li.push(`${icon('timer')}${s.pomo.length} ${B.plural(s.pomo.length, 'помидор', 'помидора', 'помидоров')}, ${B.mins(s.pm)} фокуса`);
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
    const dates = Object.keys(c.days).filter(k => k <= t).sort().reverse().slice(0, 60);
    const res = r ? {good: 'закрыт', fail: 'не закрыт', frozen: 'заморозка', open: 'идёт', ready: 'можно закрывать'}[r.result] : '';
    return `<div class="page journal-page">
      <header class="page-h"><div><div class="eyebrow">Дневник</div><h1>${date === t ? 'Сегодня' : B.WDF[B.wd(date)] + ', ' + B.fmt(date)}</h1></div>
        <div class="row"><a class="icon-btn" href="#/journal/${B.add(date, -1)}" aria-label="Предыдущий день">${icon('left')}</a>${date < t ? `<a class="icon-btn" href="#/journal/${B.add(date, 1)}" aria-label="Следующий день">${icon('right')}</a>` : ''}</div></header>
      <div class="cols">
        <div class="col">
          <section class="card">
            <div class="row between"><h2>${icon('list')}Итоги дня</h2>${res ? `<span class="tag r-${r.result}">${res}${r.xp ? ` · ${r.xp > 0 ? '+' : ''}${r.xp} XP` : ''}</span>` : ''}</div>
            ${top.length ? `<div class="sub-h">Главные дела: ${top.filter(x => x.done).length}/${top.length}</div><ul class="plain sum">${top.map(x => `<li class="${x.done ? '' : date < t ? 'miss' : 'wait'}">${icon(x.done ? 'check' : date < t ? 'x' : 'later')}${esc(x.title)}</li>`).join('')}</ul>` : '<p class="muted">Плана на этот день не было.</p>'}
            <div class="sub-h">Сделано</div>${summaryHtml(date)}
          </section>
          <section class="card review-form">
            <h2>${icon('pen')}Разбор</h2>
            <label class="field">Что сделал и чем доволен<textarea rows="3" data-in="rv" data-k="done" data-d="${date}" placeholder="Коротко, своими словами">${esc(rv.done || '')}</textarea></label>
            <label class="field">Что не вышло и почему<textarea rows="3" data-in="rv" data-k="why" data-d="${date}" placeholder="Честно: где отвлёкся, что отложил, что помешало">${esc(rv.why || '')}</textarea></label>
            <label class="field">Главное на завтра<textarea rows="2" data-in="rv" data-k="tomorrow" data-d="${date}" placeholder="Одно дело, которое сделаешь первым">${esc(rv.tomorrow || '')}</textarea></label>
            <div class="field">Настроение<div class="chips">${[1, 2, 3, 4, 5].map(i => `<button class="chip ${rv.mood === i ? 'on' : ''}" data-act="rvSet" data-k="mood" data-v="${i}" data-d="${date}">${MOOD[i]}</button>`).join('')}</div></div>
            <div class="field">Энергия<div class="chips">${[1, 2, 3, 4, 5].map(i => `<button class="chip ${rv.energy === i ? 'on' : ''}" data-act="rvSet" data-k="energy" data-v="${i}" data-d="${date}">${'●'.repeat(i)}</button>`).join('')}</div></div>
            <p class="hint" id="rvSaved">${B.hasReview(d) ? 'Разбор сохранён. ' + (date < t ? '' : 'День засчитается, если сделано два главных дела.') : 'Сохраняется само, пока пишешь.'}</p>
            ${date === t && (rv.tomorrow || '').trim() ? `<button class="btn sm" data-act="tomorrowTask" data-d="${date}">${icon('plus')} Сделать задачей на завтра</button>` : ''}
          </section>
        </div>
        <div class="col">
          <section class="card thoughts">
            <h2>${icon('quote')}Мысли</h2>
            <div class="add-line"><textarea id="thNew" rows="2" placeholder="Что крутится в голове. Идея, тревога, вывод, что угодно"></textarea></div>
            <div class="row end"><button class="btn sm primary" data-act="thAdd" data-d="${date}">Записать</button></div>
            <div class="notes">${(d.notes || []).slice().reverse().map(n => `<div class="bnote t"><p>${esc(n.t)}</p><span class="muted mono">${B.hm(n.at)}</span><button class="icon-btn sm" data-act="thDel" data-d="${date}" data-at="${n.at}">${icon('x')}</button></div>`).join('') || '<p class="muted">Мыслей за этот день нет.</p>'}</div>
          </section>
          <section class="card">
            <h2>${icon('sparkle')}Неделя</h2>
            <p class="hint">Claude прочитает итоги семи дней, причины переносов и твои разборы, найдёт, где и почему ты откладываешь, и предложит план на следующую неделю. Откроется claude.ai в твоём аккаунте.</p>
            <div class="row"><button class="btn primary" data-act="aiWeek">${icon('sparkle')} Разобрать неделю в Claude</button><button class="btn ghost" data-act="aiCopy">${icon('copy')} Скопировать запрос</button></div>
          </section>
          <section class="card">
            <h2>${icon('cal')}Архив</h2>
            <div class="jlist">${dates.map(k => { const x = c.days[k], dd = B.day(k); return `<a class="jrow ${k === date ? 'on' : ''}" href="#/journal/${k}"><i class="lgd ${x.result}"></i><span class="grow">${B.fmtW(k)}</span><span class="muted">${dd.review && dd.review.mood ? MOOD[dd.review.mood] : ''}</span>${(dd.notes || []).length ? `<span class="muted">${icon('quote')}${dd.notes.length}</span>` : ''}</a>`; }).join('')}</div>
          </section>
        </div>
      </div>
    </div>`;
  }
};
B.inputs.rv = el => {
  const date = el.dataset.d;
  B.editDay(date, d => { d.review = Object.assign({}, d.review, {[el.dataset.k]: el.value, at: Date.now()}); }, true);
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
B.acts.tomorrowTask = el => {
  const v = (B.day(el.dataset.d).review || {}).tomorrow; if (!v) return;
  const tk = B.addQuick(v.split('\n')[0], {due: B.add(el.dataset.d, 1), pri: 1});
  if (tk) B.toast('Задача на завтра: ' + esc(tk.title));
};

/* ---------- запрос для Claude ---------- */
function weekPrompt(){
  const t = B.today(), c = B.calc(), lines = [];
  lines.push('Я веду дневник продуктивности «Режим бамбука»: учусь в вузе и готовлюсь к ШАД, борюсь с прокрастинацией. Ниже мои записи за последние 7 дней.');
  lines.push('Проанализируй их как строгий, но доброжелательный тренер: 1) где и почему я откладываю (по причинам переносов и разборам), 2) какие привычки проседают и в какие дни, 3) что получилось хорошо, 4) конкретный план на следующую неделю: три главных цели, что убрать, как построить дни. Без общих советов, только по моим данным. Отвечай по-русски.');
  lines.push('');
  lines.push(`Уровень ${c.level}, серия закрытых дней ${c.live}, рекорд ${c.best}.`);
  for (let i = 7; i >= 1; i--){
    const date = B.add(t, -i); if (date < c.start) continue;
    const d = B.day(date), r = c.days[date] || {}, s = summary(date), rv = d.review || {};
    const top = (d.top || []).map(B.task).filter(Boolean);
    lines.push(`## ${B.WDF[B.wd(date)]}, ${B.fmt(date)}: ${({good: 'день закрыт', fail: 'день не закрыт', frozen: 'не закрыт (заморозка)'})[r.result] || ''}`);
    lines.push(`Главные дела: ${top.length ? top.map(x => (x.done ? '[x] ' : '[ ] ') + x.title).join('; ') : 'плана не было'}`);
    if (s.done.length) lines.push(`Сделано: ${s.done.map(x => x.title).join('; ')}`);
    lines.push(`Помидоров ${s.pomo.length} (${s.pm} мин), чтение ${s.rm} мин, тренировка: ${s.ws.length ? s.ws.map(w => B.SPORT_TYPES[w.type]).join(', ') : 'нет'}, привычки: ${s.hs.join(', ') || 'нет'}`);
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
