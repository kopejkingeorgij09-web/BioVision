/* Зов леса: привычки (ежедневные и «N раз в неделю»), серии, карта за 12 недель и подсказки по правилам. */
(function(){
const {esc, icon} = B;
const ICONS = ['habit', 'book', 'run', 'dumbbell', 'moon', 'leaf', 'pen', 'timer', 'sun', 'star', 'flame', 'frog'];
/* цвет привычки: свой или по порядку из палитры, чтобы в календаре у каждой был свой */
const HPAL = ['green', 'blue', 'violet', 'amber', 'pink', 'teal', 'red', 'ink'];
B.habitColor = h => h.color || HPAL[Math.max(0, B.habits().findIndex(x => x.id === h.id)) % HPAL.length];

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
/* что делает нажатие на день: обычная привычка ставит отметку, чтение спрашивает минуты, тренировка отмечается */
const dayAct = (h, d) => h.auto === 'read' ? `data-act="readDay" data-d="${d}"` : h.auto === 'sport' ? `data-act="sportDay" data-d="${d}"` : `data-act="habitToggle" data-id="${h.id}" data-d="${d}"`;
/* чтение за день: сколько минут всего. Больше — дописывается запись к книге, которую читаешь; меньше — лишнее срезается с конца */
B.acts.readDay = async el => {
  const d = el.dataset.d || B.today(), cur = B.readMin(d), goal = (B.get('h_read') || {}).min || B.cfg().readGoal || 30;
  const reading = B.books().filter(b => b.status === 'reading');
  const v = await B.dialog(`<h3>${icon('book')} Чтение · ${B.fmtW(d)}</h3>
    <p class="dlg-text">${cur ? `Сейчас записано ${B.mins(cur)}.` : 'Пока ничего не записано.'} Цель ${goal} мин.</p>
    <label class="field">Сколько минут читал за день<input id="rdMin" type="number" min="0" max="900" inputmode="numeric" value="${cur || ''}" placeholder="${goal}" autofocus data-enter="rdOk"></label>
    <div class="chips">${[10, 15, 20, 30, 45, 60, 90].map(m => `<button class="chip" data-act="rdChip" data-m="${m}">${m} мин</button>`).join('')}</div>
    ${reading.length > 1 ? `<label class="field">Книга<select id="rdBook">${reading.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('')}<option value="">Другое</option></select></label>` : ''}
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="rdOk">Сохранить</button></div>`);
  if (v === false || v == null) return;
  const total = B.clamp(Math.round(+v.m || 0), 0, 900), book = v.b != null ? v.b : (reading[0] ? reading[0].id : null);
  if (total === cur) return;
  B.editDay(d, x => {
    let r = (x.read || []).slice();
    if (total > cur) r.push({book: book || null, min: total - cur, at: Date.now()});
    else { let cut = cur - total; while (cut > 0 && r.length){ const last = r[r.length - 1]; if ((last.min || 0) <= cut){ cut -= last.min || 0; r.pop(); } else { r[r.length - 1] = Object.assign({}, last, {min: last.min - cut}); cut = 0; } } }
    x.read = r;
  });
  B.toast(total ? `<b class="pos">Чтение: ${B.mins(total)}</b>${total >= goal ? ' · цель дня есть' : ` · до цели ${goal - total} мин`}` : 'Чтение за день стёрто');
};
B.acts.rdChip = el => { const i = B.$('#rdMin'); i.value = el.dataset.m; i.focus(); };
B.acts.rdOk = () => { const b = B.$('#rdBook'); B.closeDialog({m: B.$('#rdMin').value, b: b ? b.value : null}); };
function last7(h){
  const t = B.today();
  return `<div class="week7">${Array.from({length: 7}, (_, i) => B.add(t, i - 6)).map(d => {
    const hv = B.habitVal(h, d), on = hv > 0, can = B.diff(d, t) <= 2 && d >= (h.created || '');
    const rm = h.auto === 'read' ? B.readMin(d) : 0;
    return `<button class="d7 ${on ? 'on' : ''} ${hv === 0.5 ? 'half' : ''} ${d === t ? 'now' : ''}" ${can ? dayAct(h, d) : 'disabled'} title="${B.fmtW(d)}${rm ? ': ' + B.mins(rm) : ''}"><span>${B.WD[B.wd(d)]}</span><i>${on ? icon('check') : rm ? `<small>${rm}</small>` : ''}</i></button>`;
  }).join('')}</div>`;
}

/* общий календарь привычек за месяц: в каждом дне цветные отметки выполненных привычек.
   Нажатие на привычку в легенде оставляет в календаре только её, нажатие на день открывает отметки этого дня. */
let calM = null, only = null;
function habitCal(hs){
  const t = B.today(), m = calM || t.slice(0, 8) + '01', a = B.parse(m);
  const first = m, last = B.ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0, 12));
  const from = B.weekStart(first), to = B.add(B.weekStart(last), 6);
  const show = only ? hs.filter(h => h.id === only) : hs;
  let cells = '', doneN = 0, possible = 0;
  for (let d = from; d <= to; d = B.add(d, 1)){
    const out = d.slice(0, 7) !== m.slice(0, 7), fut = d > t;
    const marks = fut ? [] : show.map(h => ({h, v: d >= (h.created || '') ? B.habitVal(h, d) : 0})).filter(x => x.v > 0);
    if (!out && !fut){ possible += show.filter(h => h.kind !== 'weekly' && d >= (h.created || '')).length; doneN += marks.filter(x => x.h.kind !== 'weekly').length; }
    const solo = only && marks.length ? B.habitColor(marks[0].h) : '';
    cells += `<button class="hc-d ${out ? 'out' : ''} ${fut ? 'fut' : ''} ${d === t ? 'now' : ''} ${solo ? 'solo' : ''}" ${solo ? `style="--hc:var(--c-${solo})"` : ''} ${fut ? 'disabled' : `data-act="hcDay" data-d="${d}"`} title="${B.fmtW(d)}${marks.length ? ': ' + marks.map(x => esc(x.h.name)).join(', ') : ''}">
      <span class="hc-n">${B.parse(d).getDate()}</span>
      ${only ? '' : `<span class="hc-dots">${marks.map(x => `<i class="c-${B.habitColor(x.h)} ${x.v < 1 ? 'half' : ''}"></i>`).join('')}</span>`}
    </button>`;
  }
  const isNow = m === t.slice(0, 8) + '01';
  return `<section class="card hcal">
    <div class="row between wrap"><h2>${icon('cal')}Календарь привычек</h2>
      <div class="row"><span class="muted mono">${possible ? Math.round(doneN / possible * 100) + '% ежедневных' : ''}</span>
        ${isNow ? '' : '<button class="btn sm ghost" data-act="hcNow">Сегодня</button>'}
        <button class="icon-btn" data-act="hcShift" data-k="-1" aria-label="Прошлый месяц">${icon('left')}</button>
        <b class="hc-m">${B.MONF[a.getMonth()]} ${a.getFullYear()}</b>
        <button class="icon-btn" data-act="hcShift" data-k="1" aria-label="Следующий месяц">${icon('right')}</button></div></div>
    <div class="hc-legend">${hs.map(h => `<button class="hc-l c-${B.habitColor(h)} ${only === h.id ? 'on' : ''} ${only && only !== h.id ? 'dim' : ''}" data-act="hcOnly" data-id="${h.id}"><i></i>${esc(h.name)}</button>`).join('')}</div>
    <div class="hc-grid"><div class="hc-wd">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(w => `<span>${w}</span>`).join('')}</div>${cells}</div>
  </section>`;
}
B.acts.hcShift = el => { const a = B.parse(calM || B.today().slice(0, 8) + '01'); calM = B.ymd(new Date(a.getFullYear(), a.getMonth() + +el.dataset.k, 1, 12)); B.render(true); };
B.acts.hcNow = () => { calM = null; B.render(true); };
B.acts.hcOnly = el => { only = only === el.dataset.id ? null : el.dataset.id; B.render(true); };
function dayChip(h, d){
  if (!h.auto) return B.habitChip(h, d);
  const on = B.habitDone(h, d), rm = h.auto === 'read' ? B.readMin(d) : 0;
  return `<button class="hchip ${on ? 'on' : ''}" style="--hc:var(--c-${B.habitColor(h)})" ${dayAct(h, d)}><i>${on ? icon('check') : icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b>${h.auto === 'read' ? `<small>${rm}/${h.min || 30} мин · указать время</small>` : `<small>${on ? 'есть · заметка' : 'отметить'}</small>`}</span></button>`;
}
function daySheet(d){
  const t = B.today(), can = B.diff(d, t) <= 2;
  return `<h2>${B.WDF[B.wd(d)]}, ${B.fmt(d)}</h2>
    <div class="hchips">${B.habits().filter(h => d >= (h.created || '')).map(h => can ? dayChip(h, d) : `<span class="hchip ${B.habitDone(h, d) ? 'on' : ''}"><i>${B.habitDone(h, d) ? icon('check') : icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b></span></span>`).join('')}</div>
    <p class="hint">${can ? 'Нажми на привычку, чтобы поставить или снять отметку. У чтения указываешь минуты.' : 'Отмечать можно сегодня и два прошлых дня, раньше история не правится.'}</p>
    <div class="row end"><button class="btn primary" data-act="closeSheet">Готово</button></div>`;
}
let sheetDay = null;
B.acts.hcDay = el => { sheetDay = el.dataset.d; B.sheet(daySheet(sheetDay), () => { sheetDay = null; }); };
B.on('change', () => { if (sheetDay && B.sheetOpen()) B.sheet(daySheet(sheetDay), () => { sheetDay = null; }); });

B.views.habits = {
  title: 'Привычки',
  render(){
    const hs = B.habits();
    return `<div class="page habits-page">
      <header class="page-h"><div><div class="eyebrow">Привычки</div><h1>Режим складывается из мелочей</h1></div>
        <button class="btn primary" data-act="habitNew">${icon('plus')} Привычка</button></header>
      ${hs.length ? habitCal(hs) : ''}
      <div class="cols">
        <div class="col">
          ${hs.map(h => {
            const s = B.habitStreak(h), rate = B.habitRate(h);
            return `<section class="card habit" style="--hc:var(--c-${B.habitColor(h)})">
              <div class="row between">
                <button class="habit-name" data-act="habitEdit" data-id="${h.id}"><i class="hic">${icon(h.icon || 'habit')}</i><span><b>${esc(h.name)}</b><small>${h.kind === 'weekly' ? `${h.target || 3} раза в неделю` : 'каждый день'}${h.auto === 'read' ? ` · от ${h.min || 30} мин чтения, отмечается само` : h.auto === 'sport' ? ' · по записи тренировки' : h.auto === 'cards' ? ` · от ${h.min || 10} карточек на Фагах, отмечается само` : ''}</small></span></button>
                <div class="streak ${s.cur ? 'on' : ''}">${icon('flame')}<b>${s.cur}</b><small>${s.unit}</small></div>
              </div>
              ${last7(h)}
              ${h.auto === 'read' ? `<div class="row wrap h-quick"><span class="muted">Сегодня ${B.mins(B.readMin(B.today()))} из ${h.min || 30} мин</span><button class="btn sm" data-act="readDay" data-d="${B.today()}">${icon('book')} Указать время</button><a class="btn sm ghost" href="#/read">Книги и таймер</a></div>`
                : h.auto === 'sport' ? `<div class="row wrap h-quick"><button class="btn sm ${B.habitDone(h, B.today()) ? '' : 'primary'}" data-act="sportDay" data-d="${B.today()}">${icon('run')} ${B.habitDone(h, B.today()) ? 'Тренировка есть · заметка' : 'Отметить тренировку'}</button></div>` : ''}
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
              <li>Чтение засчитывается, когда за день набралось нужное число минут: нажми на день и укажи, сколько читал, или запиши время в «Чтении». Тренировку отмечаешь нажатием на день, повторное нажатие открывает заметку. Остальные, в том числе сон, отмечаешь сам.</li>
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
    <div class="field">Цвет<div class="colors">${B.COLORS.map(c => `<label class="cpick c-${c}"><input type="radio" name="hColor" value="${c}" ${(h.color || (h.id ? B.habitColor(h) : HPAL[B.habits().length % HPAL.length])) === c ? 'checked' : ''}><i></i><span>${B.COLOR_NAMES[c]}</span></label>`).join('')}</div></div>
    <div class="field">Иконка<div class="icons">${ICONS.map(i => `<label class="ipick"><input type="radio" name="hIcon" value="${i}" ${h.icon === i ? 'checked' : ''}><i>${icon(i)}</i></label>`).join('')}</div></div>
    <div class="ed-grid">
      <label>Отмечать<select id="hAuto" data-in="hfRedraw"><option value="">Вручную</option><option value="read" ${read ? 'selected' : ''}>По минутам чтения</option><option value="sport" ${sport ? 'selected' : ''}>По отметке тренировки</option><option value="cards" ${h.auto === 'cards' ? 'selected' : ''}>По карточкам на Фагах</option></select></label>
      <label>Как часто<select id="hKind" data-in="hfRedraw"><option value="daily" ${h.kind !== 'weekly' ? 'selected' : ''}>Каждый день</option><option value="weekly" ${h.kind === 'weekly' ? 'selected' : ''}>Несколько раз в неделю</option></select></label>
      ${h.kind === 'weekly' ? `<label>Сколько раз в неделю<input id="hTarget" type="number" min="1" max="7" value="${h.target || 3}"></label>` : ''}
      ${read ? `<label>Цель, минут в день<input id="hMin" type="number" min="1" max="600" value="${h.min || 30}"></label>
        <label>Минимум, минут<input id="hMiniMin" type="number" min="1" max="120" value="${h.miniMin || 10}"></label>` : ''}
      ${h.auto === 'cards' ? `<label>Карточек за день<input id="hMin" type="number" min="1" max="500" value="${h.min || 10}"></label>` : ''}
    </div>
    ${!h.auto ? `<label class="field">Минимальная версия на плохой день<input id="hMini" value="${esc(h.mini || '')}" placeholder="Например: 5 отжиманий или лечь до 00:30"></label>` : ''}
    <p class="hint">${read ? 'Отмечается сама, когда за день набралась цель. Если прочитал меньше цели, но не меньше минимума, засчитывается минимум: серия держится, опыт вдвое меньше.'
      : sport ? 'Отмечается нажатием на день здесь, в «Привычках», или на главной. К тренировке можно написать заметку.'
      : h.auto === 'cards' ? 'Отмечается сама, когда на «Фагах» за день повторено столько карточек. Можно отметить и вручную, нажатием на день.'
      : 'Нажатие на привычку ставит и снимает отметку. Если задан минимум, его ставит долгое нажатие: серия держится, опыт вдвое меньше.'}</p>
    <div class="row between">${h.id ? `<button class="btn ghost danger" data-act="habitDel" data-id="${h.id}">${icon('trash')} В архив</button>` : '<span></span>'}
      <button class="btn primary" data-act="habitSave" data-id="${h.id || ''}">Сохранить</button></div>`;
}
/* прочитать то, что уже введено, в черновик */
function hfRead(){
  const v = id => { const el = B.$('#' + id); return el ? el.value : null; };
  if (v('hName') != null) HF.name = v('hName');
  HF.icon = (B.$('input[name=hIcon]:checked') || {}).value || HF.icon;
  HF.color = (B.$('input[name=hColor]:checked') || {}).value || HF.color;
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
  const h = Object.assign({}, old, {name, icon: HF.icon, color: HF.color || undefined, kind: HF.kind, target: HF.target, auto: HF.auto || undefined, min: HF.min, miniMin: HF.miniMin,
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
  'Страшно или лень начинать': 'Начни с самого маленького шага, который можно закрыть сразу: после первой галочки продолжать легче.',
  'Непонятно, с чего начать': 'Перед тем как переносить, запиши первый шаг на 10–25 минут. Задача с понятным шагом откладывается реже.',
  'Не рассчитал время': 'Бери в день меньше дел и отмечай главными не больше трёх.',
  'Задача оказалась больше': 'Отметь её «большим делом» и разбей на шаги, по одному в день.',
  'Появилось срочное': 'Оставляй в дне свободный час под внезапное.'
};
B.insights = () => {
  const c = B.calc(), t = c.today, out = [];
  // серия
  if (c.live >= 3) out.push(`Разборов подряд: <b>${c.live}</b>${c.best > c.live ? `, до рекорда ${c.best - c.live}` : ', это твой рекорд'}. Не рвать цепочку проще, чем начинать заново.`);
  // вчерашний разбор
  const y = B.add(t, -1);
  if (y >= c.start && !B.hasReview(B.day(y))) out.push(`Вчера не было разбора. Допиши его в <a href="#/journal/${y}">дневнике</a>: в серию он уже не попадёт, но причины станут видны.`);
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
  for (let i = 1; i <= 56; i++){ const d = B.add(t, -i), r = c.days[d]; if (!r || r.result === 'open') continue; by[B.wd(d)].n++; if (r.result !== 'empty') by[B.wd(d)].g++; }
  const all = by.reduce((a, x) => ({n: a.n + x.n, g: a.g + x.g}), {n: 0, g: 0});
  if (all.n >= 14){
    const avg = all.g / all.n; let worst = -1, wr = 1;
    by.forEach((x, i) => { if (x.n >= 3 && x.g / x.n < wr){ wr = x.g / x.n; worst = i; } });
    if (worst >= 0 && avg - wr >= 0.25) out.push(`Чаще всего пустые дни у тебя — ${['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'][worst]}: активных ${by[worst].g} из ${by[worst].n}. Планируй этот день с вечера накануне и бери в него меньше дел.`);
  }
  // причины переносов за 14 дней
  const reasons = {}; let pc = 0;
  B.tasks().forEach(tk => (tk.postpones || []).forEach(p => { if (Date.now() - p.at < 14 * 864e5){ if (p.why) reasons[p.why] = (reasons[p.why] || 0) + 1; pc++; } }));
  const topR = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  if (topR && topR[1] >= 3) out.push(`За две недели ${pc} ${B.plural(pc, 'перенос', 'переноса', 'переносов')}, чаще всего: «${esc(topR[0])}». ${ADVICE[topR[0]] || ''}`);
  // хронически переносимые
  B.tasks().filter(tk => !tk.done && (tk.postpones || []).length >= 3 && !(tk.subs || []).length).slice(0, 2)
    .forEach(tk => out.push(`«${esc(tk.title)}» переносилась ${(tk.postpones || []).length} раза. <a href="#" data-act="openTask" data-id="${tk.id}">Разбей на шаги</a> и сделай первый сегодня.`));
  // чтение за неделю
  const goal = B.cfg().readGoal || 30; let rm = 0; for (let i = 1; i <= 7; i++) rm += B.readMin(B.add(t, -i));
  if (B.diff(c.start, t) >= 7 && rm / 7 < goal * 0.6) out.push(`За неделю в среднем ${Math.round(rm / 7)} мин чтения в день при цели ${goal}. Привяжи чтение к одному месту в дне: например, сразу после ужина.`);
  return out;
};
})();
