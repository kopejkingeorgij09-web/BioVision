/* Зов леса: весь план ШАДа, подраздел «Задачи → ШАД» (кнопка рядом с «Неделя» и «Месяц»), как на трекере shad/.
   По месяцам и неделям, у каждого веба дата, код, ДЗ и стадия; нажатие открывает выбор стадии. */
(function(){
const {esc, icon} = B;
const LS_F = 'bamboo-shad-filter';
let filter = 'ahead';
try { filter = localStorage.getItem(LS_F) || 'ahead'; } catch (e) {}
const FILTERS = [['ahead', 'Не закрыто'], ['late', 'Отстаю'], ['all', 'Все'], ['done', 'Закрыто']];

/* отставание: веб не посмотрен после своего дня, ДЗ не решено после своего дня;
   пока день не выбран, отставанием считается только конец недели из плана */
const lateOf = p => {
  const s = B.shadStage(p.n), t = B.today(), ws = B.weekStart(t);
  if (s < 2 && p.w && (p.wp ? p.w.date < t : p.wk < ws)) return 'веб';
  if (s < 3 && p.h && p.h.date && (p.hp ? p.h.date < t : p.hk < ws)) return 'ДЗ';
  return '';
};
const weekOf = ws => `${B.fmtS(ws)} – ${B.fmtS(B.add(ws, 6))}`;
const pass = p => {
  const s = B.shadStage(p.n);
  if (filter === 'ahead') return s < 4;
  if (filter === 'late') return !!lateOf(p);
  if (filter === 'done') return s >= 4;
  return true;
};

function row(p){
  const s = B.shadStage(p.n), late = lateOf(p), course = B.shad.courses[p.c] || {}, t = B.today();
  const wd = p.w.date, d = B.parse(wd), k = B.diff(t, wd);
  const rel = k === 0 ? 'сегодня' : k === 1 ? 'завтра' : k === -1 ? 'вчера' : '';
  const meter = [1, 2, 3, 4].map(i => `<i class="${s >= i ? 'on' : ''}"></i>`).join('');
  return `<button class="sp-row ${s >= 4 ? 'ok' : ''} ${late ? 'late' : ''} ${k === 0 ? 'now' : ''}" data-act="shadOpen" data-n="${p.n}">
    <span class="sp-date ${k < 0 ? 'past' : ''}"><small>${B.WD[B.wd(wd)]}</small><b>${d.getDate()}</b><small>${B.MON[d.getMonth()]}</small></span>
    <span class="sp-body">
      <span class="sp-tag"><span class="mono">${String(p.n).padStart(2, '0')}</span><span class="cchip c-${p.c}">${esc(course.name || p.c)}</span><span class="mono">${esc(p.code || '')}</span>${rel ? `<span class="sp-rel">${rel}</span>` : ''}</span>
      <span class="sp-title">${esc(p.t)}</span>
      <span class="sp-when muted">${p.wp ? '' : 'день не выбран · '}ДЗ ${p.h ? (p.hp ? 'до ' + B.fmtW(p.h.date) : 'на неделе ' + weekOf(p.hk)) : '—'}</span>
    </span>
    <span class="sp-stat"><span class="sp-meter c-${p.c}">${meter}</span>${late ? `<span class="sp-late">отстаю: ${late}</span>` : `<span class="muted">${B.SHAD_STAGES[s]}</span>`}</span>
  </button>`;
}

B.shadPlanView = () => {
  const plan = B.shad.plan.filter(p => p.w && p.w.date).slice().sort((a, b) => a.wk.localeCompare(b.wk) || a.n - b.n);
  if (!plan.length) return `<section class="card sp"><h2>${icon('chart')}План ШАДа</h2><p class="muted">План ещё не загрузился. Он берётся из трекера ШАДа, нужен интернет при первом открытии.</p></section>`;
  const done = plan.filter(p => B.shadStage(p.n) >= 4).length, lateN = plan.filter(p => lateOf(p)).length;
  const t = B.today(), next = plan.find(p => B.shadStage(p.n) < 4);
  const counts = {ahead: plan.length - done, late: lateN, all: plan.length, done};
  const brk = B.shad.brk;
  // недели нумеруются по всему плану, чтобы номер не менялся от фильтра
  const weeks = [];
  plan.forEach(p => { const ws = p.wk; let w = weeks[weeks.length - 1]; if (!w || w.ws !== ws){ w = {ws, items: []}; weeks.push(w); } w.items.push(p); });
  let html = '', month = '', breakShown = false;
  weeks.forEach((w, i) => {
    const items = w.items.filter(pass);
    if (!items.length) return;
    if (brk && !breakShown && w.ws > brk.after){ html += `<div class="sp-break"><b>${esc(brk.label || 'Перерыв')}</b><span class="mono">${esc(brk.range || '')}</span></div>`; breakShown = true; }
    const m = B.parse(items[0].w.date), mk = m.getFullYear() + '-' + m.getMonth();
    if (mk !== month){ html += `<h3 class="sp-month">${B.MONF[m.getMonth()]} <span>${m.getFullYear()}</span></h3>`; month = mk; }
    const cur = w.ws === B.weekStart(t), wdone = w.items.filter(p => B.shadStage(p.n) >= 4).length;
    html += `<div class="group sp-week ${cur ? 'cur' : ''}"><div class="group-h">Неделя ${i + 1} <span>${B.fmtS(w.ws)} – ${B.fmtS(B.add(w.ws, 6))} · ${wdone}/${w.items.length} закрыто</span></div>
      <div class="sp-list">${items.map(row).join('')}</div></div>`;
  });
  if (!html) html = `<p class="empty">${filter === 'late' ? 'Хвостов нет, идёшь по плану.' : filter === 'done' ? 'Закрытых вебов пока нет.' : 'Всё закрыто.'}</p>`;
  const pct = Math.round(plan.reduce((a, p) => a + B.shadStage(p.n), 0) / (plan.length * 4) * 100);
  const tape = plan.map(p => { const s = B.shadStage(p.n);
    return `<button class="cell ${lateOf(p) ? 'late' : ''} ${next && p.n === next.n ? 'now' : ''}" style="--cc:var(--${p.c})" data-s="${s}" data-act="shadOpen" data-n="${p.n}" title="${p.n}. ${esc(p.t)} · ${B.SHAD_STAGES[s]}" aria-label="Веб ${p.n}: ${esc(p.t)}, ${B.SHAD_STAGES[s]}"></button>`; }).join('');
  const legend = Object.entries(B.shad.courses).map(([k, c]) => `<span style="--cc:var(--${k})"><i></i>${esc(c.name)}</span>`).join('') + '<span><i class="lt"></i>отстаю</span>';
  return `<div class="sp-wrap">
    <aside class="card sp-side">
      <div class="sp-big">${done}<small>/ ${plan.length}</small></div>
      <p class="sp-cap">вебов закрыто полностью: веб, ДЗ и разбор ошибок</p>
      <div class="sp-kpis"><div><b>${pct}%</b><span>пройдено</span></div><div class="${lateN ? 'bad' : ''}"><b>${lateN}</b><span>отстаю</span></div><div><b>${plan.length - done}</b><span>впереди</span></div></div>
      <div class="sp-tape" aria-label="Все ${plan.length} вебов по порядку">${tape}</div>
      <div class="sp-legend">${legend}</div>
      ${next ? `<button class="sp-next" data-act="shadOpen" data-n="${next.n}" style="--cc:var(--${next.c})"><small>${lateOf(next) ? 'Догнать' : 'Дальше'}</small><span>${next.n}. ${esc(next.t)}</span><small>${esc(next.code || '')} · ${B.fmtW(next.w.date)}</small></button>` : '<p class="muted">Все вебы закрыты.</p>'}
      <div class="chips sm">${FILTERS.map(([k, l]) => `<button class="chip ${filter === k ? 'on' : ''}" data-act="shadFilter" data-f="${k}">${l} <span class="muted">${counts[k]}</span></button>`).join('')}</div>
      <a class="muted sm-link" href="../shad/">Открыть трекер ШАДа →</a>
    </aside>
    <section class="sp">${html}</section>
  </div>`;
};
B.acts.shadFilter = el => { filter = el.dataset.f; try { localStorage.setItem(LS_F, filter); } catch (e) {} B.render(true); };

function sheetHTML(n){
  const p = B.shad.plan.find(x => x.n === n); if (!p) return '';
  const s = B.shadStage(n), course = B.shad.courses[p.c] || {}, late = lateOf(p), note = (B.shad.marks[n] || {}).note;
  const DESC = ['Веб ещё впереди', 'Начал веб, досмотрю позже', 'Есть конспект от руки', 'Решил сам и сверил с решениями', 'Ошибки разобраны, тема понятна'];
  return `<div class="row"><span class="cchip c-${p.c}">${esc(course.full || course.name || p.c)}</span><span class="mono muted">${esc(p.code || '')} · веб ${n}/${B.shad.plan.length}</span></div>
    <h2>${esc(p.t)}</h2>
    <p class="muted">Веб: ${p.wp ? B.fmtW(p.w.date) : 'неделя ' + weekOf(p.wk) + ', день не выбран'}${p.w.from ? ' · ' + p.w.from + '–' + p.w.to : ''}${late === 'веб' ? ' · <b class="neg">отстаю</b>' : ''}<br>ДЗ: ${p.h ? (p.hp ? 'до ' + B.fmtW(p.h.date) : 'неделя ' + weekOf(p.hk) + ', день не выбран') : '—'}${late === 'ДЗ' ? ' · <b class="neg">отстаю</b>' : ''}</p>
    ${dayPick(p, 'web')}${p.h && p.h.date ? dayPick(p, 'hw') : ''}
    <div class="sp-opts">${B.SHAD_STAGES.map((l, i) => `<button class="sp-opt ${s === i ? 'on' : ''}" data-act="shadPick" data-n="${n}" data-s="${i}"><i>${i === 4 ? '✓' : i}</i><span><b>${l}</b><small>${DESC[i]}</small></span></button>`).join('')}</div>
    ${note ? `<p class="hint">Заметка: ${esc(note)}</p>` : ''}
    <details class="sp-edit" ${editOpen ? 'open' : ''}><summary>${icon('pen')} Изменить название и даты${p.edited ? ' <span class="tag">изменено</span>' : ''}</summary>
      <label class="field">Название<input value="${esc(p.t)}" data-in="shEd" data-n="${n}" data-k="t"></label>
      <div class="ed-grid">
        <label>Веб<input type="date" value="${p.wp ? p.w.date || '' : ''}" data-in="shEd" data-n="${n}" data-k="wd"></label>
        <label>С<input type="time" value="${p.w.from || ''}" data-in="shEd" data-n="${n}" data-k="wf"></label>
        <label>До<input type="time" value="${p.w.to || ''}" data-in="shEd" data-n="${n}" data-k="wt"></label>
        <label>ДЗ до<input type="date" value="${p.h && p.hp ? p.h.date || '' : ''}" data-in="shEd" data-n="${n}" data-k="hd"></label>
      </div>
      <p class="hint">Проще перетаскивать: в «Неделе» карточки без дня лежат в блоке «ШАД на неделю», их можно поставить на любой день и вернуть обратно. Если у ДЗ уже есть день, он едет вместе с вебом. Изменения видны и в трекере ШАДа.</p>
      ${p.edited ? `<button class="btn sm ghost" data-act="shReset" data-n="${n}">Вернуть как в плане</button>` : ''}
    </details>
    <div class="row between">${B.shad.lms ? `<a class="btn ghost" href="${esc(p.lessonId ? `https://lms.profimatika.ru/school/lesson/${p.lessonId}` : B.shad.lms)}" target="_blank" rel="noopener">${p.lessonId ? 'Открыть урок' : 'Платформа'} ↗</a>` : '<span></span>'}<button class="btn primary" data-act="closeSheet">Готово</button></div>`;
}
/* быстрый выбор дня в пределах недели: удобно на телефоне, где тянуть карточку далеко */
function dayPick(p, kind){
  const placed = kind === 'web' ? p.wp : p.hp, date = kind === 'web' ? p.w.date : p.h.date, cur = B.weekStart(B.today());
  let ws = placed ? B.weekStart(date) : (kind === 'web' ? p.wk : p.hk);
  if (!placed && ws < cur) ws = cur;
  const days = Array.from({length: 7}, (_, i) => B.add(ws, i));
  return `<div class="sp-pick"><span class="muted">${kind === 'web' ? 'Веб' : 'ДЗ'}</span>
    ${days.map(d => `<button class="${placed && d === date ? 'on' : ''} ${d === B.today() ? 'now' : ''}" data-act="shPlace" data-n="${p.n}" data-k="${kind}" data-d="${d}" title="${B.fmtW(d)}">${B.WD[B.wd(d)]}<small>${B.parse(d).getDate()}</small></button>`).join('')}
    ${placed ? `<button class="sp-unpl" data-act="shPlace" data-n="${p.n}" data-k="${kind}" data-d="" title="Снять день, карточка вернётся в блок недели">без дня</button>` : ''}
  </div>`;
}
B.acts.shPlace = el => {
  const n = +el.dataset.n, k = el.dataset.k, d = el.dataset.d, p = B.shad.plan.find(x => x.n === n); if (!p) return;
  if (!d) B.shadUnplace(n, k);
  else if (k === 'web'){ const patch = {w: {date: d}}; if (p.wp && p.hp) patch.h = {date: B.add(p.h.date, B.diff(p.w.date, d))}; B.setShadOver(n, patch); }
  else B.setShadOver(n, {h: {date: d}});
  B.sheet(sheetHTML(n));
};
let editOpen = false;
B.acts.shadOpen = el => { editOpen = false; B.sheet(sheetHTML(+el.dataset.n)); };
B.inputs.shEd = (el, e) => {
  if (e.type !== 'change') return;
  const n = +el.dataset.n, k = el.dataset.k, v = el.value, p = B.shad.plan.find(x => x.n === n); if (!p) return;
  if (k === 't'){ if (!v.trim()) return; B.setShadOver(n, {t: v}); }
  else if (k === 'wd'){ if (!v){ B.shadUnplace(n, 'web'); } else { const patch = {w: {date: v}}; if (p.wp && p.hp) patch.h = {date: B.add(p.h.date, B.diff(p.w.date, v))}; B.setShadOver(n, patch); } }
  else if (k === 'wf') B.setShadOver(n, {w: {from: v}});
  else if (k === 'wt') B.setShadOver(n, {w: {to: v}});
  else if (k === 'hd'){ if (!v) B.shadUnplace(n, 'hw'); else B.setShadOver(n, {h: {date: v}}); }
  editOpen = true; B.sheet(sheetHTML(n));
};
B.acts.shReset = el => { const n = +el.dataset.n; B.setShadOver(n, null); editOpen = true; B.sheet(sheetHTML(n)); B.toast('Веб снова как в плане'); };
B.acts.shadPick = el => {
  const n = +el.dataset.n, s = +el.dataset.s, cur = B.shadStage(n);
  B.setShadStage(n, s); void cur;
  B.sheet(sheetHTML(n));
};
})();
