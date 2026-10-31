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
    el.classList.toggle('over', !!over());
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

function weekChart(){
  const t = B.today(), days = Array.from({length: 7}, (_, i) => B.add(t, i - 6));
  const vals = days.map(d => (B.day(d).pomo || []).reduce((a, p) => a + (p.min || 0), 0));
  const max = Math.max(60, ...vals);
  return `<div class="bars">${days.map((d, i) => `<div class="bar-col ${d === t ? 'now' : ''}" title="${B.fmtW(d)}: ${B.mins(vals[i])}">
    <span class="bv">${vals[i] ? Math.round(vals[i] / 6) / 10 : ''}</span><span class="bw"><i style="height:${(vals[i] / max * 100).toFixed(1)}%"></i></span><span class="bl">${B.WD[B.wd(d)]}</span></div>`).join('')}</div>
    <p class="hint">Часы фокуса за 7 дней</p>`;
}

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
    const byTask = {};
    pomo.forEach(p => { const k = p.task || ''; byTask[k] = (byTask[k] || 0) + (p.min || 0); });
    const status = !isIdle && st.running ? (st.mode !== 'work' ? 'встань, пройдись, попей воды' : over() ? 'сверх плана, останови, когда закончишь' : 'не отвлекайся') : isIdle ? (sw ? 'время пойдёт вверх' : `${st.dur} минут, потом сигнал`) : 'пауза';
    return `<div class="page focus-page">
      <header class="page-h"><div><div class="eyebrow">Фокус</div><h1>${st.mode === 'work' ? (sw ? 'Секундомер' : 'Помодоро') : MODES[st.mode]}</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card timer-card mode-${st.mode}">
            <div class="toggle wide fm">${[['pomo', 'Помодоро'], ['sw', 'Секундомер']].map(([k, l]) => `<button class="${st.kind === k ? 'on' : ''}" data-act="fmode" data-m="${k}" ${isIdle ? '' : 'disabled'}>${l}</button>`).join('')}</div>
            <div class="timer">
              <svg viewBox="0 0 280 280" class="tring"><circle cx="140" cy="140" r="${R}" class="ring-bg"/><circle id="tmRing" data-c="${C}" cx="140" cy="140" r="${R}" class="ring-fg" stroke-dasharray="${C}" style="stroke-dashoffset:${C * (sw ? 1 - ring : ring)}" transform="rotate(-90 140 140)"/></svg>
              <div class="tface"><b id="tmClock" class="${over() ? 'over' : ''}">${mmss(ms)}</b><span>${status}</span></div>
            </div>
            <div class="tm-task">
              ${isIdle ? `<label class="field">Над чем работаешь<select id="tmTask" data-in="tmTask"><option value="">Без задачи</option>${cand.map(t => `<option value="${t.id}" ${st.task === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>`
                : tk ? `<div class="tm-now"><span class="muted">Сейчас</span><b>${esc(tk.title)}</b>${sub ? `<span>шаг: ${esc(sub.t)}</span>` : ''}</div>` : ''}
            </div>
            <div class="row center tm-btns">
              ${isIdle ? `<button class="btn primary lg" data-act="tmStart">${icon('play')} ${sw ? 'Старт' : `Начать ${cfg.work} минут`}</button>${sw ? '' : `<button class="btn lg" data-act="five" title="Правило пяти минут: начни, а там посмотришь">5 минут</button>`}`
                : st.mode !== 'work' ? `<button class="btn lg ghost" data-act="tmSkip">Пропустить перерыв</button>`
                : st.running ? `<button class="btn lg" data-act="tmPause">${icon('pause')} Пауза</button><button class="btn lg primary" data-act="tmStop">${icon('stop')} Стоп</button>`
                : `<button class="btn primary lg" data-act="tmResume">${icon('play')} Продолжить</button><button class="btn lg ghost" data-act="tmStop">${icon('stop')} Стоп</button>`}
              ${tk && !tk.done && !isIdle && st.mode === 'work' ? `<button class="btn lg ghost" data-act="tmTaskDone">${icon('check')} ${sub ? 'Шаг сделан' : 'Задача сделана'}</button>` : ''}
            </div>
            <p class="hint center">${sw ? 'Секундомер идёт, пока не нажмёшь «Стоп». Засчитывается всё отработанное время.' : `Через ${cfg.work} минут прозвучит сигнал, но таймер не остановится: время пойдёт в плюс, пока не нажмёшь «Стоп». После остановки начнётся перерыв.`} Отвлекающие мысли записывай в <a href="#/journal">дневник</a>.</p>
          </section>
        </div>
        <div class="col">
          <section class="card">
            <h2>${icon('timer')}Сегодня</h2>
            <div class="kpis"><div class="kpi"><b>${B.mins(pomo.reduce((a, p) => a + (p.min || 0), 0))}</b><span>фокуса</span></div><div class="kpi"><b>${pomo.length}</b><span>${B.plural(pomo.length, 'подход', 'подхода', 'подходов')}</span></div></div>
            ${Object.keys(byTask).length ? `<ul class="plain">${Object.entries(byTask).sort((a, b) => b[1] - a[1]).map(([k, m]) => `<li><span class="grow">${k ? esc((B.task(k) || {title: 'удалённая задача'}).title) : 'Без задачи'}</span><span class="mono">${B.mins(m)}</span></li>`).join('')}</ul>` : ''}
          </section>
          <section class="card">${weekChart()}</section>
          <section class="card">
            <h2>${icon('gear')}Помодоро</h2>
            <div class="ed-grid">
              <label>Фокус, мин<input type="number" min="1" max="180" value="${cfg.work}" data-in="pomoCfg" data-k="work"></label>
              <label>Перерыв, мин<input type="number" min="1" max="60" value="${cfg.short}" data-in="pomoCfg" data-k="short"></label>
              <label>Длинный, мин<input type="number" min="1" max="90" value="${cfg.long}" data-in="pomoCfg" data-k="long"></label>
              <label>Длинный каждые<input type="number" min="2" max="10" value="${cfg.every}" data-in="pomoCfg" data-k="every"></label>
            </div>
          </section>
        </div>
      </div>
    </div>`;
  },
  mount(){ tick(); }
};
})();
