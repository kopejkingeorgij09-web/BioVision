/* Зов леса: весь план ШАДа, подраздел «Задачи → ШАД» (кнопка рядом с «Неделя» и «Месяц»), как на трекере shad/.
   По месяцам и неделям, у каждого веба дата, код, ДЗ и стадия; нажатие открывает выбор стадии. */
(function(){
const {esc, icon} = B;
const LS_F = 'bamboo-shad-filter';
let filter = 'ahead';
try { filter = localStorage.getItem(LS_F) || 'ahead'; } catch (e) {}
const FILTERS = [['ahead', 'Не закрыто'], ['late', 'Отстаю'], ['all', 'Все'], ['done', 'Закрыто']];

/* отставание: веб не посмотрен после дня веба, ДЗ не решено после дедлайна */
const lateOf = p => {
  const s = B.shadStage(p.n), t = B.today();
  if (s < 2 && p.w && p.w.date < t) return 'веб';
  if (s < 3 && p.h && p.h.date < t) return 'ДЗ';
  return '';
};
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
      <span class="sp-when muted">ДЗ до ${p.h ? B.fmtW(p.h.date) : '—'}</span>
    </span>
    <span class="sp-stat"><span class="sp-meter c-${p.c}">${meter}</span>${late ? `<span class="sp-late">отстаю: ${late}</span>` : `<span class="muted">${B.SHAD_STAGES[s]}</span>`}</span>
  </button>`;
}

B.shadPlanView = () => {
  const plan = B.shad.plan.filter(p => p.w && p.w.date);
  if (!plan.length) return `<section class="card sp"><h2>${icon('chart')}План ШАДа</h2><p class="muted">План ещё не загрузился. Он берётся из трекера ШАДа, нужен интернет при первом открытии.</p></section>`;
  const done = plan.filter(p => B.shadStage(p.n) >= 4).length, lateN = plan.filter(p => lateOf(p)).length;
  const t = B.today(), next = plan.find(p => B.shadStage(p.n) < 4);
  const counts = {ahead: plan.length - done, late: lateN, all: plan.length, done};
  const brk = B.shad.brk;
  // недели нумеруются по всему плану, чтобы номер не менялся от фильтра
  const weeks = [];
  plan.forEach(p => { const ws = B.weekStart(p.w.date); let w = weeks[weeks.length - 1]; if (!w || w.ws !== ws){ w = {ws, items: []}; weeks.push(w); } w.items.push(p); });
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
    <p class="muted">Веб: ${B.fmtW(p.w.date)}${p.w.from ? ' · ' + p.w.from + '–' + p.w.to : ''}${late === 'веб' ? ' · <b class="neg">отстаю</b>' : ''}<br>ДЗ: до ${p.h ? B.fmtW(p.h.date) : '—'}${late === 'ДЗ' ? ' · <b class="neg">отстаю</b>' : ''}</p>
    <div class="sp-opts">${B.SHAD_STAGES.map((l, i) => `<button class="sp-opt ${s === i ? 'on' : ''}" data-act="shadPick" data-n="${n}" data-s="${i}"><i>${i === 4 ? '✓' : i}</i><span><b>${l}</b><small>${DESC[i]}</small></span></button>`).join('')}</div>
    ${note ? `<p class="hint">Заметка: ${esc(note)}</p>` : ''}
    <div class="row between">${B.shad.lms ? `<a class="btn ghost" href="${esc(B.shad.lms)}" target="_blank" rel="noopener">Платформа ↗</a>` : '<span></span>'}<button class="btn primary" data-act="closeSheet">Готово</button></div>`;
}
B.acts.shadOpen = el => B.sheet(sheetHTML(+el.dataset.n));
B.acts.shadPick = el => {
  const n = +el.dataset.n, s = +el.dataset.s, cur = B.shadStage(n);
  B.setShadStage(n, s); void cur;
  B.sheet(sheetHTML(n));
};
})();
