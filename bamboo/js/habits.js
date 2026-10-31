/* Режим бамбука: привычки (ежедневные и «N раз в неделю»), серии, карта за 12 недель и подсказки по правилам. */
(function(){
const {esc, icon} = B;
const ICONS = ['habit', 'book', 'run', 'dumbbell', 'moon', 'leaf', 'pen', 'timer', 'sun', 'star', 'flame', 'frog'];

/* серия: для ежедневной в днях, для недельной в неделях; сегодняшний пропуск серию пока не рвёт */
B.habitStreak = h => {
  const t = B.today(), from = h.created || B.cfg().start;
  if (h.kind === 'weekly'){
    const target = h.target || 3;
    const cnt = ws => { let k = 0; for (let i = 0; i < 7; i++){ const d = B.add(ws, i); if (d <= t && d >= from && B.habitDone(h, d)) k++; } return k; };
    let ws = B.weekStart(t), cur = 0, best = 0, run = 0;
    if (cnt(ws) >= target) cur++;
    for (let w = B.add(ws, -7); w >= B.weekStart(from); w = B.add(w, -7)){ if (cnt(w) >= target) cur++; else break; }
    for (let w = B.weekStart(from); w <= ws; w = B.add(w, 7)){ if (cnt(w) >= target){ run++; best = Math.max(best, run); } else if (w < ws) run = 0; }
    return {cur, best, unit: 'нед', thisWeek: cnt(ws), target};
  }
  let cur = 0, d = t;
  if (!B.habitDone(h, d)) d = B.add(d, -1);
  while (d >= from && B.habitDone(h, d)){ cur++; d = B.add(d, -1); }
  let best = 0, run = 0;
  for (let x = from; x <= t; x = B.add(x, 1)){ if (B.habitDone(h, x)){ run++; best = Math.max(best, run); } else if (x < t) run = 0; }
  return {cur, best, unit: 'дн'};
};
B.habitRate = (h, days = 30) => {
  const t = B.today(), from = h.created || B.cfg().start;
  let n = 0, k = 0;
  for (let i = 0; i < days; i++){ const d = B.add(t, -i); if (d < from) break; n++; if (B.habitDone(h, d)) k++; }
  if (h.kind === 'weekly') return n ? Math.min(1, k / (n / 7 * (h.target || 3))) : 0;
  return n ? k / n : 0;
};

function heat(h){
  const t = B.today(), start = B.add(B.weekStart(t), -77), from = h.created || B.cfg().start;
  let cells = '';
  for (let i = 0; i < 84; i++){
    const d = B.add(start, i);
    const v = d <= t && d >= from ? B.habitVal(h, d) : 0;
    const cls = d > t ? 'fut' : d < from ? 'pre' : v === 1 ? 'on' : v ? 'half' : 'off';
    cells += `<i class="${cls}" title="${B.fmtW(d)}"></i>`;
  }
  return `<div class="heat">${cells}</div>`;
}
function last7(h){
  const t = B.today();
  return `<div class="week7">${Array.from({length: 7}, (_, i) => B.add(t, i - 6)).map(d => {
    const hv = B.habitVal(h, d), on = hv > 0, can = !h.auto && B.diff(d, t) <= 2 && d >= (h.created || '');
    return `<button class="d7 ${on ? 'on' : ''} ${hv === 0.5 ? 'half' : ''} ${d === t ? 'now' : ''}" ${can ? `data-act="habitToggle" data-id="${h.id}" data-d="${d}"` : 'disabled'} title="${B.fmtW(d)}"><span>${B.WD[B.wd(d)]}</span><i>${on ? icon('check') : ''}</i></button>`;
  }).join('')}</div>`;
}

B.views.habits = {
  title: 'Привычки',
  render(){
    const hs = B.habits();
    return `<div class="page habits-page">
      <header class="page-h"><div><div class="eyebrow">Привычки</div><h1>Режим складывается из мелочей</h1></div>
        <button class="btn primary" data-act="habitNew">${icon('plus')} Привычка</button></header>
      <div class="cols">
        <div class="col">
          ${hs.map(h => {
            const s = B.habitStreak(h), rate = B.habitRate(h);
            return `<section class="card habit">
              <div class="row between">
                <button class="habit-name" data-act="habitEdit" data-id="${h.id}"><i class="hic">${icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b><small>${h.kind === 'weekly' ? `${h.target || 3} раза в неделю` : 'каждый день'}${h.auto === 'read' ? ` · от ${h.min || 30} мин чтения, отмечается само` : h.auto === 'sport' ? ' · по записи тренировки' : ''}</small></span></button>
                <div class="streak ${s.cur ? 'on' : ''}">${icon('flame')}<b>${s.cur}</b><small>${s.unit}</small></div>
              </div>
              ${last7(h)}
              <div class="habit-stats"><span>за 30 дней <b>${Math.round(rate * 100)}%</b></span><span>рекорд <b>${s.best} ${s.unit}</b></span>${h.kind === 'weekly' ? `<span>на этой неделе <b>${s.thisWeek}/${s.target}</b></span>` : ''}</div>
              ${B.bar(rate)}
              ${heat(h)}
            </section>`;
          }).join('') || '<p class="empty">Привычек пока нет.</p>'}
        </div>
        <div class="col">
          <section class="card insights"><h2>${icon('sparkle')}Что видно по записям</h2>
            ${(() => { const tips = B.insights(); return tips.length ? `<ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : '<p class="muted">Записей пока мало. Через неделю здесь появятся закономерности.</p>'; })()}
            <button class="btn" data-act="aiWeek">${icon('sparkle')} Разобрать неделю в Claude</button>
            <p class="hint">Откроется claude.ai в твоём аккаунте с готовым запросом: итоги семи дней, причины переносов и разборы.</p>
          </section>
          <section class="card"><h2>${icon('leaf')}Как это работает</h2>
            <ul class="plain dots">
              <li>Отметить можно сегодня и два прошлых дня. Дальше история не правится, чтобы статистика была честной.</li>
              <li>Чтение отмечается само, когда за день набралось нужное число минут. Тренировка, когда она отмечена. Сон до 00:00, когда разбор в дневнике начат до полуночи.</li>
              <li>Каждая выполненная привычка даёт ${B.XP.habit} XP, минимальная версия вдвое меньше. Для недельной считаются только первые N раз.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>`;
  }
};

/* форма показывает только поля, которые относятся к выбранному типу привычки */
let HF = null;
function habitForm(h){
  HF = Object.assign({name: '', icon: 'habit', kind: 'daily', target: 3, auto: '', min: B.cfg().readGoal || 30, mini: '', miniMin: 10}, h || {});
  return formHtml();
}
function formHtml(){
  const h = HF, read = h.auto === 'read', sport = h.auto === 'sport';
  return `<h2>${h.id ? 'Привычка' : 'Новая привычка'}</h2>
    <label class="field">Название<input id="hName" value="${esc(h.name)}" placeholder="Например, Зарядка 10 минут" ${h.id ? '' : 'autofocus'}></label>
    <div class="field">Иконка<div class="icons">${ICONS.map(i => `<label class="ipick"><input type="radio" name="hIcon" value="${i}" ${h.icon === i ? 'checked' : ''}><i>${icon(i)}</i></label>`).join('')}</div></div>
    <div class="ed-grid">
      <label>Отмечать<select id="hAuto" data-in="hfRedraw"><option value="">Вручную</option><option value="read" ${read ? 'selected' : ''}>По минутам чтения</option><option value="sport" ${sport ? 'selected' : ''}>По отметке тренировки</option><option value="night" ${h.auto === 'night' ? 'selected' : ''}>По разбору до 00:00</option></select></label>
      <label>Как часто<select id="hKind" data-in="hfRedraw"><option value="daily" ${h.kind !== 'weekly' ? 'selected' : ''}>Каждый день</option><option value="weekly" ${h.kind === 'weekly' ? 'selected' : ''}>Несколько раз в неделю</option></select></label>
      ${h.kind === 'weekly' ? `<label>Сколько раз в неделю<input id="hTarget" type="number" min="1" max="7" value="${h.target || 3}"></label>` : ''}
      ${read ? `<label>Цель, минут в день<input id="hMin" type="number" min="1" max="600" value="${h.min || 30}"></label>
        <label>Минимум, минут<input id="hMiniMin" type="number" min="1" max="120" value="${h.miniMin || 10}"></label>` : ''}
    </div>
    ${!h.auto ? `<label class="field">Минимальная версия на плохой день<input id="hMini" value="${esc(h.mini || '')}" placeholder="Например: 5 отжиманий или лечь до 00:30"></label>` : ''}
    <p class="hint">${read ? 'Отмечается сама, когда за день набралась цель. Если прочитал меньше цели, но не меньше минимума, засчитывается минимум: серия держится, опыт вдвое меньше.'
      : sport ? 'Отмечается сама в день, когда отмечена тренировка: на главной или в разделе «Спорт».'
      : h.auto === 'night' ? 'Засчитывается сама, если вечерний разбор в дневнике начат до полуночи.'
      : 'Нажатие на привычку ставит и снимает отметку. Если задан минимум, его ставит долгое нажатие: серия держится, опыт вдвое меньше.'}</p>
    <div class="row between">${h.id ? `<button class="btn ghost danger" data-act="habitDel" data-id="${h.id}">${icon('trash')} В архив</button>` : '<span></span>'}
      <button class="btn primary" data-act="habitSave" data-id="${h.id || ''}">Сохранить</button></div>`;
}
/* прочитать то, что уже введено, в черновик */
function hfRead(){
  const v = id => { const el = B.$('#' + id); return el ? el.value : null; };
  if (v('hName') != null) HF.name = v('hName');
  HF.icon = (B.$('input[name=hIcon]:checked') || {}).value || HF.icon;
  HF.auto = v('hAuto') || ''; HF.kind = v('hKind') || 'daily';
  if (v('hTarget') != null) HF.target = B.clamp(+v('hTarget') || 3, 1, 7);
  if (v('hMin') != null) HF.min = B.clamp(+v('hMin') || 30, 1, 600);
  if (v('hMiniMin') != null) HF.miniMin = B.clamp(+v('hMiniMin') || 10, 1, 120);
  if (v('hMini') != null) HF.mini = v('hMini').trim();
}
B.inputs.hfRedraw = (el, e) => {
  if (e.type !== 'change') return;
  hfRead();
  if (el.id === 'hAuto' && HF.auto === 'sport' && HF.kind === 'daily'){ HF.kind = 'weekly'; HF.target = B.cfg().sportGoal || 3; }
  B.sheet(formHtml());
};
B.acts.habitNew = () => B.sheet(habitForm());
B.acts.habitEdit = el => B.sheet(habitForm(B.get('h_' + el.dataset.id)));
B.acts.habitSave = el => {
  hfRead();
  const name = (HF.name || '').trim(); if (!name){ B.$('#hName').focus(); return; }
  const id = el.dataset.id || B.uid(), old = B.get('h_' + id) || {id, created: B.today(), order: B.habits().length};
  const h = Object.assign({}, old, {name, icon: HF.icon, kind: HF.kind, target: HF.target, auto: HF.auto || undefined, min: HF.min, miniMin: HF.miniMin,
    mini: !HF.auto && HF.mini ? HF.mini : undefined});
  B.put('h_' + id, h);
  // одна цель на всё приложение: чтение и тренировки в настройках совпадают с привычкой
  if (h.auto === 'read') B.setCfg({readGoal: h.min});
  if (h.auto === 'sport' && h.kind === 'weekly') B.setCfg({sportGoal: h.target});
  B.closeSheet();
};
B.acts.habitDel = async el => {
  const h = B.get('h_' + el.dataset.id);
  if (!(await B.confirm(`Убрать «${esc(h.name)}» в архив? История отметок останется.`, 'В архив', true))) return;
  B.put('h_' + h.id, Object.assign({}, h, {arch: true, archAt: B.today()})); B.closeSheet();
};

/* ---------- подсказки по правилам ---------- */
const ADVICE = {
  'Страшно или лень начинать': 'Начинай с кнопки «5 минут»: после старта продолжать намного легче.',
  'Непонятно, с чего начать': 'Перед тем как переносить, запиши первый шаг на 10–25 минут. Задача с понятным шагом откладывается реже.',
  'Не рассчитал время': 'Ставь оценку в помидорах (~2, ~4) и не бери в день больше 8–10.',
  'Задача оказалась больше': 'Отметь её «большим делом» и разбей на шаги, по одному в день.',
  'Появилось срочное': 'Оставляй в дне свободный час под внезапное.'
};
B.insights = () => {
  const c = B.calc(), t = c.today, out = [];
  // серия
  if (c.live >= 3) out.push(`Серия <b>${c.live} ${B.plural(c.live, 'день', 'дня', 'дней')}</b>${c.best > c.live ? `, до рекорда ${c.best - c.live}` : ', это твой рекорд'}. Не рвать цепочку проще, чем начинать заново.`);
  // вчерашний разбор
  const y = B.add(t, -1);
  if (y >= c.start && !B.hasReview(B.day(y))) out.push(`Вчера не было разбора. Допиши его в <a href="#/journal/${y}">дневнике</a>: опыт за него уже не вернуть, но причины провала станут видны.`);
  // заброшенные привычки
  B.habits().forEach(h => {
    if (h.kind === 'weekly'){
      const s = B.habitStreak(h), leftDays = 6 - B.wd(t), need = (h.target || 3) - s.thisWeek;
      if (need > 0 && need >= leftDays) out.push(`«${esc(h.name)}»: на этой неделе ${s.thisWeek} из ${h.target || 3}, осталось ${leftDays + 1} ${B.plural(leftDays + 1, 'день', 'дня', 'дней')}. ${need > leftDays ? 'План недели уже под угрозой, начни сегодня.' : 'Без пропусков до воскресенья.'}`);
      return;
    }
    let k = 0, d = B.add(t, -1);
    while (k < 30 && d >= (h.created || c.start) && !B.habitDone(h, d)){ k++; d = B.add(d, -1); }
    if (k >= 2 && !B.habitDone(h, t)) out.push(`«${esc(h.name)}» не было ${k} ${B.plural(k, 'день', 'дня', 'дней')}. Сделай сегодня хотя бы маленькую версию${h.auto === 'read' ? ': 10 минут чтения' : ''}.`);
  });
  // слабый день недели за 8 недель
  const by = Array.from({length: 7}, () => ({n: 0, g: 0}));
  for (let i = 1; i <= 56; i++){ const d = B.add(t, -i), r = c.days[d]; if (!r || r.result === 'open') continue; by[B.wd(d)].n++; if (r.result === 'good') by[B.wd(d)].g++; }
  const all = by.reduce((a, x) => ({n: a.n + x.n, g: a.g + x.g}), {n: 0, g: 0});
  if (all.n >= 14){
    const avg = all.g / all.n; let worst = -1, wr = 1;
    by.forEach((x, i) => { if (x.n >= 3 && x.g / x.n < wr){ wr = x.g / x.n; worst = i; } });
    if (worst >= 0 && avg - wr >= 0.25) out.push(`Слабее всего у тебя ${['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'][worst]}: закрыто ${by[worst].g} из ${by[worst].n}. Планируй этот день с вечера накануне и бери в него меньше дел.`);
  }
  // причины переносов за 14 дней
  const reasons = {}; let pc = 0;
  B.tasks().forEach(tk => (tk.postpones || []).forEach(p => { if (Date.now() - p.at < 14 * 864e5){ reasons[p.why] = (reasons[p.why] || 0) + 1; pc++; } }));
  const topR = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  if (topR && topR[1] >= 3) out.push(`За две недели ${pc} ${B.plural(pc, 'перенос', 'переноса', 'переносов')}, чаще всего: «${esc(topR[0])}». ${ADVICE[topR[0]] || ''}`);
  // хронически переносимые
  B.tasks().filter(tk => !tk.done && (tk.postpones || []).length >= 3 && !(tk.subs || []).length).slice(0, 2)
    .forEach(tk => out.push(`«${esc(tk.title)}» переносилась ${(tk.postpones || []).length} раза. <a href="#" data-act="openTask" data-id="${tk.id}">Разбей на шаги</a> и сделай первый сегодня.`));
  // помидоры
  let np = 0; for (let i = 0; i < 3; i++) if (!(B.day(B.add(t, -i)).pomo || []).length) np++;
  if (np === 3 && B.diff(c.start, t) >= 3) out.push('Три дня без помидоров. Один таймер на 25 минут по самому неприятному делу, и день уже не пустой.');
  // чтение за неделю
  const goal = B.cfg().readGoal || 30; let rm = 0; for (let i = 1; i <= 7; i++) rm += B.readMin(B.add(t, -i));
  if (B.diff(c.start, t) >= 7 && rm / 7 < goal * 0.6) out.push(`За неделю в среднем ${Math.round(rm / 7)} мин чтения в день при цели ${goal}. Привяжи чтение к одному месту в дне: например, сразу после ужина.`);
  return out;
};
})();
