/* Режим бамбука: помодоро-таймер.
   Состояние таймера хранится в localStorage, поэтому перезагрузка страницы его не сбрасывает.
   Законченный помидор записывается в день (d.pomo) и даёт опыт; бамбук растёт от уровня. */
(function(){
const {esc, icon} = B;
const LS = 'bamboo-timer';
let T = null;
try { T = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { T = null; }
const save = () => { try { T ? localStorage.setItem(LS, JSON.stringify(T)) : localStorage.removeItem(LS); } catch (e) {} };
const MODES = {work: 'Фокус', short: 'Перерыв', long: 'Длинный перерыв'};

let actx = null;
function chime(){
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [0, .18, .36].forEach((d, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = [660, 880, 990][i];
      g.gain.setValueAtTime(0.0001, actx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + d + .02);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d + .5);
      o.connect(g).connect(actx.destination); o.start(actx.currentTime + d); o.stop(actx.currentTime + d + .55);
    });
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([120, 80, 120]); } catch (e) {}
}
/* Два режима, как в YPT:
   pomo — помодоро: отсчёт от 25 минут, в ноль звучит сигнал, но фокус идёт дальше в плюс, пока сам не остановишь;
          после остановки начинается перерыв (он заканчивается сам);
   sw   — секундомер: время просто идёт вверх, пока не остановишь, без перерывов.
   В день записываются реально отработанные минуты. Состояние переживает перезагрузку страницы. */
const LS_MODE = 'bamboo-focus-mode';
let fmode = 'pomo';
try { fmode = localStorage.getItem(LS_MODE) || 'pomo'; } catch (e) {}
if (T && T.pausedLeft != null && T.acc == null) T = null;      // старый формат таймера
const elapsed = () => !T ? 0 : (T.acc || 0) + (T.running ? Date.now() - T.startAt : 0);
const left = () => !T ? 0 : T.dur * 60000 - elapsed();
B.timerState = () => T ? {running: T.running, mode: T.mode, left: left(), task: T.task} : null;

B.startFocus = (task, sub, min) => {
  const cfg = B.cfg().pomo;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (e) {}
  const kind = min ? 'pomo' : fmode;
  T = {kind, mode: 'work', dur: min || cfg.work, startAt: Date.now(), acc: 0, running: true, task: task || null, sub: sub || null, cycle: (T && T.cycle) || 0, five: min === 5, rang: false};
  save();
  if (location.hash.indexOf('#/focus') !== 0) location.hash = '#/focus'; else B.render();
};
function idle(keep){ T = {kind: fmode, mode: 'work', dur: B.cfg().pomo.work, acc: 0, running: false, task: keep ? keep.task : null, sub: keep ? keep.sub : null, cycle: keep ? keep.cycle : 0, idle: true}; save(); }
function startBreak(){
  const cfg = B.cfg().pomo, cyc = T.cycle || 0, long = cyc > 0 && cyc % (cfg.every || 4) === 0;
  T = {kind: 'pomo', mode: long ? 'long' : 'short', dur: long ? cfg.long : cfg.short, startAt: Date.now(), acc: 0, running: true, task: T.task, sub: T.sub, cycle: cyc};
  save();
}
/* записать сессию фокуса; возвращает минуты */
function logWork(){
  const ms = elapsed(), min = Math.round(ms / 60000), end = Date.now();
  if (min < 1) return 0;
  B.editDay(B.dayOf(end), d => { d.pomo = (d.pomo || []).concat({task: T.task, sub: T.sub, min, at: end, kind: T.kind}); });
  return min;
}
const mmss = ms => { const neg = ms < 0; ms = Math.abs(ms); const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return (neg ? '+' : '') + (h ? h + ':' + B.pad(m) : B.pad(Math.floor(s / 60))) + ':' + B.pad(s % 60); };
/* что показывать на циферблате */
const shown = () => !T ? B.cfg().pomo.work * 60000 : T.kind === 'sw' && T.mode === 'work' ? elapsed() : T.idle ? T.dur * 60000 : left();
const over = () => T && T.mode === 'work' && T.kind === 'pomo' && !T.idle && left() <= 0;
function tick(){
  if (T && T.running){
    if (T.mode !== 'work' && left() <= 0){ chime(); const k = T; idle(k); B.toast('Перерыв закончился. Готов к следующему подходу?', 4000); B.render(); return; }
    if (T.mode === 'work' && T.kind === 'pomo' && left() <= 0 && !T.rang){
      T.rang = true; save(); chime();
      B.toast(T.five ? '<b class="pos">5 минут есть.</b> Самое трудное позади. Таймер идёт дальше, останови, когда закончишь.' : `<b class="pos">${T.dur} минут фокуса.</b> Можно остановиться и отдохнуть или продолжать: время идёт в плюс.`, 5000);
      B.render(); return;
    }
  }
  const el = document.getElementById('tmClock');
  if (el && T){
    el.textContent = mmss(T.kind === 'sw' && T.mode === 'work' ? elapsed() : T.idle ? T.dur * 60000 : left());
    el.classList.toggle('over', !!over()); el.classList.toggle('long', el.textContent.length > 6);
    const r = document.getElementById('tmRing');
    if (r){ const c = +r.dataset.c, v = T.kind === 'sw' && T.mode === 'work' ? (elapsed() % 3600000) / 3600000 : T.idle ? 1 : Math.max(0, left()) / (T.dur * 60000); r.style.strokeDashoffset = c * (T.kind === 'sw' && T.mode === 'work' ? 1 - v : v); }
  }
  const mini = document.getElementById('miniTimer');
  if (mini){
    if (T && !T.idle && (T.running || elapsed() > 0)){ mini.hidden = false; mini.querySelector('b').textContent = mmss(shown()); mini.className = 'mini-timer ' + T.mode + (T.running ? '' : ' paused'); }
    else mini.hidden = true;
  }
  document.title = T && T.running ? `${mmss(shown())} · ${MODES[T.mode]}` : 'Режим бамбука';
}
setInterval(tick, 500);
document.addEventListener('visibilitychange', tick);
B.timerTick = tick;

B.acts.fmode = el => { if (T && !T.idle) return; fmode = el.dataset.m; try { localStorage.setItem(LS_MODE, fmode); } catch (e) {} if (T) T.kind = fmode; save(); B.render(); };
B.acts.tmStart = () => {
  const sel = B.$('#tmTask'); const task = sel ? sel.value || null : (T && T.task);
  B.startFocus(task, T && T.task === task ? T.sub : null);
};
B.acts.tmPause = () => { if (!T || !T.running) return; T.acc = elapsed(); T.running = false; save(); B.render(); };
B.acts.tmResume = () => { if (!T) return; T.startAt = Date.now(); T.running = true; save(); B.render(); };
/* стоп в работе: записать минуты; в помодоро после полного отрезка начинается перерыв */
B.acts.tmStop = async () => {
  if (!T) return;
  if (T.mode !== 'work'){ idle(T); B.render(); return; }
  const ms = elapsed(), full = T.kind === 'pomo' && left() <= 0 && !T.five;
  if (T.kind === 'pomo' && !T.five && left() > 0 && ms >= 60000 &&
    !(await B.confirm(`До конца помидора ${Math.ceil(left() / 60000)} мин. Остановить сейчас? Засчитается ${Math.round(ms / 60000)} мин.`, 'Остановить'))) return;
  const min = logWork(), tk = T.task && B.task(T.task);
  if (min) B.toast(`<b class="pos">+${B.mins(min)} фокуса</b>${tk ? ' · ' + esc(tk.title) : ''}`, 4000);
  else B.toast('Меньше минуты, не засчитано');
  if (full){ T.cycle = (T.cycle || 0) + 1; startBreak(); } else idle(T);
  B.render();
};
B.acts.tmSkip = () => { if (!T) return; idle(T); B.render(); };
B.acts.tmTaskDone = () => {
  if (!T || !T.task) return;
  const t = B.task(T.task); if (!t) return;
  if (T.sub){
    const subs = (t.subs || []).map(s => s.id === T.sub ? Object.assign({}, s, {done: true, doneAt: Date.now()}) : s);
    B.saveTask(Object.assign({}, t, {subs}));
    const nx = B.nextStep(Object.assign({}, t, {subs}));
    T.sub = nx ? nx.id : null; save();
    B.toast(nx ? 'Шаг сделан. Следующий: ' + esc(nx.t) : 'Все шаги сделаны');
  } else { B.setDone(t, true); B.toast(`<b class="pos">Готово</b> ${esc(t.title)}`); T.task = null; save(); }
};
B.inputs.tmTask = el => { if (T){ T.task = el.value || null; T.sub = null; save(); } };
B.inputs.pomoCfg = (el, e) => {
  if (e.type !== 'change') return;
  const p = Object.assign({}, B.cfg().pomo, {[el.dataset.k]: B.clamp(+el.value || 1, 1, 180)});
  B.setCfg({pomo: p});
};

/* ---------- статистика фокуса, как в YPT ----------
   Сессия: d.pomo[] = {min, at (конец), task}. Начало = at − min. */
let fsMode = 'week', fsSel = null;
const hm = m => { m = Math.round(m); return `${Math.floor(m / 60)}:${B.pad(m % 60)}`; };
const dayMin = d => (B.day(d).pomo || []).reduce((a, p) => a + (p.min || 0), 0);
const sessions = d => (B.day(d).pomo || []).map(p => ({min: p.min || 0, end: p.at, start: p.at - (p.min || 0) * 60000, task: p.task}));
const clockMin = ts => { const x = new Date(ts); let m = x.getHours() * 60 + x.getMinutes(); if (m < 240) m += 1440; return m; };   // день до 4 утра
const fmtClock = m => `${B.pad(Math.floor(m / 60) % 24)}:${B.pad(m % 60)}`;
function heat(v, max){ if (!v) return 'h0'; const r = v / Math.max(60, max); return r > .75 ? 'h4' : r > .5 ? 'h3' : r > .25 ? 'h2' : 'h1'; }

function byTask(days){
  const by = {}; let tot = 0;
  days.forEach(d => sessions(d).forEach(s => { const t = s.task && B.task(s.task), k = t ? (B.projName(t.proj) || 'Входящие') : 'Без задачи'; by[k] = (by[k] || 0) + s.min; tot += s.min; }));
  const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  return `<div class="sub-h">По проектам</div><div class="hrates">${rows.map(([k, m]) => `<div class="hrate"><span>${esc(k)}</span>${B.bar(m / tot)}<b class="mono">${hm(m)}</b></div>`).join('')}</div>`;
}
/* накопленное время по дням недели: эта неделя ступеньками, прошлая серой заливкой */
function cumChart(ws){
  const t = B.today(), cur = [], prev = []; let a = 0, b = 0;
  for (let i = 0; i < 7; i++){ const d = B.add(ws, i); b += dayMin(B.add(d, -7)); prev.push(b); if (d <= t){ a += dayMin(d); cur.push(a); } }
  const max = Math.max(60, ...prev, ...cur), W = 320, H = 110, x = i => 6 + i * (W - 12) / 7, y = v => H - 18 - v / max * (H - 30);
  const step = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i)} ${y(v)} H${x(i + 1)}`).join(' ');
  const k = cur.length - 1, diff = k >= 0 ? cur[k] - prev[k] : 0;
  return `<div class="cum-head"><span class="muted">${k >= 0 ? `К ${['понедельнику', 'вторнику', 'среде', 'четвергу', 'пятнице', 'субботе', 'воскресенью'][k]} против прошлой недели` : 'Неделя ещё не началась'}</span><b class="${diff >= 0 ? 'pos' : 'neg'}">${diff >= 0 ? '+' : '−'}${hm(Math.abs(diff))}</b></div>
  <svg class="cum" viewBox="0 0 ${W} ${H}" role="img" aria-label="Накопленное время фокуса за неделю">
    <path d="${step(prev)} V${H - 18} H${x(0)} Z" class="prev"/>
    ${cur.length ? `<path d="${step(cur)}" class="cur"/><circle cx="${x(k + 1)}" cy="${y(cur[k])}" r="4" class="dot"/>` : ''}
    ${B.WD.map((w, i) => `<text x="${x(i) + (W - 12) / 14}" y="${H - 4}" class="ax" text-anchor="middle">${w}</text>`).join('')}
  </svg>
  <div class="legend"><span><i class="lgd cur"></i>эта неделя</span><span><i class="lgd prev"></i>прошлая</span></div>`;
}
/* начало и конец занятий по дням */
function startEnd(days){
  const rows = days.map(d => { const ss = sessions(d); return ss.length ? {d, s: Math.min(...ss.map(x => clockMin(x.start))), e: Math.max(...ss.map(x => clockMin(x.end)))} : {d}; });
  const has = rows.filter(r => r.s != null); if (!has.length) return '';
  const lo = Math.floor(Math.min(...has.map(r => r.s)) / 60) * 60, hi = Math.ceil(Math.max(...has.map(r => r.e)) / 60) * 60, span = Math.max(60, hi - lo);
  const W = 320, H = 22 * rows.length + 22, x = m => 34 + (m - lo) / span * (W - 44);
  const ticks = []; for (let m = lo; m <= hi; m += span > 600 ? 180 : span > 300 ? 120 : 60) ticks.push(m);
  return `<div class="sub-h">Начало и конец</div><svg class="se" viewBox="0 0 ${W} ${H}" role="img" aria-label="Время начала и конца занятий">
    ${ticks.map(m => `<line x1="${x(m)}" x2="${x(m)}" y1="4" y2="${H - 16}" class="grid"/><text x="${x(m)}" y="${H - 4}" class="ax" text-anchor="middle">${fmtClock(m)}</text>`).join('')}
    ${rows.map((r, i) => { const yy = 14 + i * 22; return `<text x="2" y="${yy + 4}" class="ax">${B.WD[B.wd(r.d)]}</text>` + (r.s != null ? `<line x1="${x(r.s)}" x2="${x(r.e)}" y1="${yy}" y2="${yy}" class="rng"/><circle cx="${x(r.s)}" cy="${yy}" r="4" class="st"><title>${fmtClock(r.s)}</title></circle><circle cx="${x(r.e)}" cy="${yy}" r="4" class="en"><title>${fmtClock(r.e)}</title></circle>` : ''); }).join('')}
  </svg><div class="legend"><span><i class="lgd st"></i>начало</span><span><i class="lgd en"></i>конец</span></div>`;
}
/* день: шкала суток с блоками сессий */
function dayView(d){
  const ss = sessions(d), tot = dayMin(d);
  const lo = 6 * 60, hi = 28 * 60, W = 320, x = m => 4 + (Math.min(hi, Math.max(lo, m)) - lo) / (hi - lo) * (W - 8);
  return `<div class="fs-tot"><div><span>Всего</span><b>${hm(tot)}</b></div><div><span>Сессий</span><b>${ss.length}</b></div><div><span>Самая длинная</span><b>${ss.length ? hm(Math.max(...ss.map(s => s.min))) : '0:00'}</b></div></div>
    <svg class="dayline" viewBox="0 0 ${W} 46" role="img" aria-label="Сессии за день">
      <rect x="4" y="6" width="${W - 8}" height="18" rx="5" class="bg"/>
      ${ss.map(s => `<rect x="${x(clockMin(s.start))}" y="6" width="${Math.max(2, x(clockMin(s.end)) - x(clockMin(s.start)))}" height="18" rx="3" class="blk"><title>${fmtClock(clockMin(s.start))}–${fmtClock(clockMin(s.end))}, ${hm(s.min)}</title></rect>`).join('')}
      ${[6, 9, 12, 15, 18, 21, 24, 27].map(h => `<text x="${x(h * 60)}" y="40" class="ax" text-anchor="middle">${B.pad(h % 24)}</text>`).join('')}
    </svg>
    ${ss.length ? `<ul class="plain sess">${ss.slice().reverse().map(s => `<li><span class="mono muted">${fmtClock(clockMin(s.start))}–${fmtClock(clockMin(s.end))}</span><span class="grow">${s.task && B.task(s.task) ? esc(B.task(s.task).title) : 'Без задачи'}</span><b class="mono">${hm(s.min)}</b></li>`).join('')}</ul>` : '<p class="muted">В этот день фокуса не было.</p>'}
    ${byTask([d])}`;
}
function weekView(ws){
  const t = B.today(), q0 = (() => { const p = B.parse(ws); return B.ymd(new Date(p.getFullYear(), Math.floor(p.getMonth() / 3) * 3, 1, 12)); })();
  const qp = B.parse(q0), q1 = B.ymd(new Date(qp.getFullYear(), qp.getMonth() + 3, 1, 12));
  const weeks = []; for (let w = B.weekStart(q0); w < q1; w = B.add(w, 7)) weeks.push(w);
  const tot = w => { let m = 0; for (let i = 0; i < 7; i++) m += dayMin(B.add(w, i)); return m; };
  const tots = weeks.map(tot), max = Math.max(...tots);
  const days = Array.from({length: 7}, (_, i) => B.add(ws, i)), wt = tot(ws), passed = days.filter(d => d <= t).length || 1;
  const p = B.parse(q0);
  return `<div class="qhead"><button class="icon-btn sm" data-act="fsQ" data-k="-1">${icon('left')}</button><b>${p.getFullYear()} · ${Math.floor(p.getMonth() / 3) + 1} квартал</b><button class="icon-btn sm" data-act="fsQ" data-k="1">${icon('right')}</button></div>
    <div class="fs-cols"><div class="fs-col">
    <div class="wgrid">${weeks.map((w, i) => `<button class="wcell ${heat(tots[i], max)} ${w === ws ? 'sel' : ''} ${w > t ? 'fut' : ''}" data-act="fsPick" data-d="${w}"><span>${B.parse(w).getDate()}.${B.pad(B.parse(w).getMonth() + 1)}</span><b>${tots[i] ? hm(tots[i]) : ''}</b></button>`).join('')}</div>
    <div class="fs-range">${B.fmtW(ws)} – ${B.fmtW(B.add(ws, 6))}</div>
    <div class="fs-tot"><div><span>Всего</span><b>${hm(wt)}</b></div><div><span>В среднем за день</span><b>${hm(wt / passed)}</b></div><div><span>Лучший день</span><b>${hm(Math.max(...days.map(dayMin)))}</b></div></div>
    ${byTask(days)}</div>
    <div class="fs-col">${cumChart(ws)}
    ${startEnd(days)}</div></div>`;
}
function monthView(m0){
  const p = B.parse(m0), first = B.ymd(new Date(p.getFullYear(), p.getMonth(), 1, 12)), n = new Date(p.getFullYear(), p.getMonth() + 1, 0).getDate();
  const days = Array.from({length: n}, (_, i) => B.add(first, i)), vals = days.map(dayMin), max = Math.max(...vals), tot = vals.reduce((a, v) => a + v, 0);
  const active = vals.filter(Boolean).length, t = B.today(), passed = days.filter(d => d <= t).length || 1;
  const pad0 = B.wd(first);
  return `<div class="qhead"><button class="icon-btn sm" data-act="fsM" data-k="-1">${icon('left')}</button><b>${B.MONF[p.getMonth()]} ${p.getFullYear()}</b><button class="icon-btn sm" data-act="fsM" data-k="1">${icon('right')}</button></div>
    <div class="fs-cols"><div class="fs-col">
    <div class="mgrid">${B.WD.map(w => `<span class="wd">${w}</span>`).join('')}${'<span></span>'.repeat(pad0)}${days.map((d, i) => `<button class="mcell ${heat(vals[i], max)} ${d === t ? 'now' : ''}" data-act="fsDay" data-d="${d}" title="${B.fmtW(d)}: ${hm(vals[i])}"><span>${B.parse(d).getDate()}</span><b>${vals[i] ? hm(vals[i]) : ''}</b></button>`).join('')}</div>
    </div><div class="fs-col"><div class="fs-tot"><div><span>Всего</span><b>${hm(tot)}</b></div><div><span>В среднем за день</span><b>${hm(tot / passed)}</b></div><div><span>Дней с фокусом</span><b>${active}</b></div></div>
    ${byTask(days)}</div></div>`;
}
B.focusStats = () => {
  const t = B.today();
  if (!fsSel) fsSel = fsMode === 'week' ? B.weekStart(t) : t;
  const body = fsMode === 'day' ? dayView(fsSel) : fsMode === 'week' ? weekView(B.weekStart(fsSel)) : monthView(fsSel);
  return `<section class="card fstats">
    <div class="row between wrap"><h2>${icon('chart')}Статистика фокуса</h2>
      <div class="toggle">${[['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']].map(([k, l]) => `<button class="${fsMode === k ? 'on' : ''}" data-act="fsMode" data-k="${k}">${l}</button>`).join('')}</div></div>
    ${fsMode === 'day' ? `<div class="qhead"><button class="icon-btn sm" data-act="fsD" data-k="-1">${icon('left')}</button><b>${B.fmtW(fsSel)}</b><button class="icon-btn sm" data-act="fsD" data-k="1" ${fsSel >= t ? 'disabled' : ''}>${icon('right')}</button></div>` : ''}
    ${body}
  </section>`;
};
B.acts.fsMode = el => { fsMode = el.dataset.k; fsSel = fsMode === 'week' ? B.weekStart(B.today()) : B.today(); B.render(); };
B.acts.fsPick = el => { fsSel = el.dataset.d; B.render(); };
B.acts.fsDay = el => { fsMode = 'day'; fsSel = el.dataset.d; B.render(); };
B.acts.fsD = el => { fsSel = B.add(fsSel, +el.dataset.k); B.render(); };
B.acts.fsQ = el => { const p = B.parse(B.weekStart(fsSel)); fsSel = B.weekStart(B.ymd(new Date(p.getFullYear(), Math.floor(p.getMonth() / 3) * 3 + 3 * +el.dataset.k, 1, 12))); B.render(); };
B.acts.fsM = el => { const p = B.parse(fsSel); fsSel = B.ymd(new Date(p.getFullYear(), p.getMonth() + +el.dataset.k, 1, 12)); B.render(); };

/* компактная неделя: часы фокуса за 7 дней */
function weekMini(){
  const t = B.today(), days = Array.from({length: 7}, (_, i) => B.add(t, i - 6)), vals = days.map(dayMin), max = Math.max(60, ...vals), sum = vals.reduce((a, v) => a + v, 0);
  return `<div class="wmini"><div class="row between"><span class="muted">7 дней</span><b class="mono">${hm(sum)}</b></div>
    <div class="bars sm">${days.map((d, i) => `<div class="bar-col ${d === t ? 'now' : ''}" title="${B.fmtW(d)}: ${hm(vals[i])}"><span class="bv">${vals[i] ? hm(vals[i]) : ''}</span><span class="bw"><i style="height:${(vals[i] / max * 100).toFixed(1)}%"></i></span><span class="bl">${B.WD[B.wd(d)]}</span></div>`).join('')}</div></div>`;
}
const clockCls = ms => mmss(ms).length > 6 ? 'long' : '';

B.views.focus = {
  title: 'Фокус',
  render(){
    const cfg = B.cfg().pomo, d = B.day(B.today()), pomo = d.pomo || [];
    const st = T || {kind: fmode, mode: 'work', dur: cfg.work, running: false, acc: 0, idle: true};
    const sw = st.kind === 'sw' && st.mode === 'work', isIdle = !T || st.idle;
    const R = 120, C = 2 * Math.PI * R, ms = shown();
    const ring = sw ? (isIdle ? 0 : (elapsed() % 3600000) / 3600000) : isIdle ? 1 : Math.max(0, left()) / (st.dur * 60000);
    const tk = st.task && B.task(st.task), sub = tk && st.sub && (tk.subs || []).find(s => s.id === st.sub);
    const cand = B.candidates().slice(0, 40);
    const tot = pomo.reduce((a, p) => a + (p.min || 0), 0);
    const status = !isIdle && st.running ? (st.mode !== 'work' ? 'встань, пройдись, попей воды' : over() ? 'сверх плана' : 'не отвлекайся') : isIdle ? (sw ? 'время пойдёт вверх' : `${st.dur} мин, потом сигнал`) : 'пауза';
    return `<div class="page focus-page">
      <header class="page-h"><div><div class="eyebrow">Фокус</div><h1>${st.mode === 'work' ? (sw ? 'Секундомер' : 'Помодоро') : MODES[st.mode]}</h1></div>
        <div class="toggle fm">${[['pomo', 'Помодоро'], ['sw', 'Секундомер']].map(([k, l]) => `<button class="${st.kind === k ? 'on' : ''}" data-act="fmode" data-m="${k}" ${isIdle ? '' : 'disabled'}>${l}</button>`).join('')}</div></header>
      <div class="focus-grid">
        <section class="card timer-card mode-${st.mode}">
          <div class="timer">
            <svg viewBox="0 0 280 280" class="tring"><circle cx="140" cy="140" r="${R}" class="ring-bg"/><circle id="tmRing" data-c="${C}" cx="140" cy="140" r="${R}" class="ring-fg" stroke-dasharray="${C}" style="stroke-dashoffset:${C * (sw ? 1 - ring : ring)}" transform="rotate(-90 140 140)"/></svg>
            <div class="tface"><b id="tmClock" class="${over() ? 'over' : ''} ${clockCls(ms)}">${mmss(ms)}</b><span>${status}</span></div>
          </div>
          <div class="tc-side">
            ${isIdle ? `<select id="tmTask" data-in="tmTask" aria-label="Над чем работаешь"><option value="">Без задачи</option>${cand.map(t => `<option value="${t.id}" ${st.task === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select>`
              : tk ? `<div class="tm-now"><span class="muted">Сейчас</span><b>${esc(tk.title)}</b>${sub ? `<span>шаг: ${esc(sub.t)}</span>` : ''}</div>` : ''}
            <div class="row tm-btns">
              ${isIdle ? `<button class="btn primary lg grow" data-act="tmStart">${icon('play')} ${sw ? 'Старт' : `Начать ${cfg.work} мин`}</button>${sw ? '' : `<button class="btn lg" data-act="five" title="Правило пяти минут: начни, а там посмотришь">5 мин</button>`}`
                : st.mode !== 'work' ? `<button class="btn lg ghost grow" data-act="tmSkip">Пропустить перерыв</button>`
                : st.running ? `<button class="btn lg grow" data-act="tmPause">${icon('pause')} Пауза</button><button class="btn lg primary grow" data-act="tmStop">${icon('stop')} Стоп</button>`
                : `<button class="btn primary lg grow" data-act="tmResume">${icon('play')} Продолжить</button><button class="btn lg ghost" data-act="tmStop">${icon('stop')} Стоп</button>`}
            </div>
            ${tk && !tk.done && !isIdle && st.mode === 'work' ? `<button class="btn ghost" data-act="tmTaskDone">${icon('check')} ${sub ? 'Шаг сделан' : 'Задача сделана'}</button>` : ''}
            <p class="hint">${sw ? 'Идёт, пока не нажмёшь «Стоп».' : `Через ${cfg.work} мин сигнал, дальше время идёт в плюс до «Стопа».`} Отвлекающие мысли пиши в <a href="#/journal">дневник</a>.</p>
          </div>
        </section>
        <div class="col">
          <section class="card today-focus">
            <div class="row between"><h2>${icon('timer')}Сегодня</h2><b class="big-num">${hm(tot)}</b></div>
            ${weekMini()}
          </section>
          <details class="card fold">
            <summary>${icon('gear')} Настройки помодоро <span class="muted">${cfg.work}/${cfg.short}/${cfg.long}</span></summary>
            <div class="ed-grid">
              <label>Фокус, мин<input type="number" min="1" max="180" value="${cfg.work}" data-in="pomoCfg" data-k="work"></label>
              <label>Перерыв, мин<input type="number" min="1" max="60" value="${cfg.short}" data-in="pomoCfg" data-k="short"></label>
              <label>Длинный, мин<input type="number" min="1" max="90" value="${cfg.long}" data-in="pomoCfg" data-k="long"></label>
              <label>Длинный каждые<input type="number" min="2" max="10" value="${cfg.every}" data-in="pomoCfg" data-k="every"></label>
            </div>
          </details>
        </div>
      </div>
      ${B.focusStats()}
    </div>`;
  },
  mount(){ tick(); }
};
})();
