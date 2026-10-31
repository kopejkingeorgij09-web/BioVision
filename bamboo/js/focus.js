/* Режим бамбука: помодоро-таймер.
   Состояние таймера хранится в localStorage, поэтому перезагрузка страницы его не сбрасывает.
   Законченный помидор записывается в день (d.pomo) и даёт опыт; бамбук растёт от уровня. */
(function(){
const {esc, icon} = B;
const LS = 'bamboo-timer';
let T = null;
try { T = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { T = null; }
const save = () => { try { T ? localStorage.setItem(LS, JSON.stringify(T)) : localStorage.removeItem(LS); } catch (e) {} };
const MODES = {work: 'Фокус', short: 'Короткий перерыв', long: 'Длинный перерыв'};

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
const left = () => !T ? 0 : T.running ? T.dur * 60000 - (Date.now() - T.startAt) : T.pausedLeft;
B.timerState = () => T ? {running: T.running, mode: T.mode, left: left(), task: T.task} : null;

B.startFocus = (task, sub, min) => {
  const cfg = B.cfg().pomo;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume && actx.resume(); } catch (e) {}
  T = {mode: 'work', dur: min || cfg.work, startAt: Date.now(), running: true, pausedLeft: 0, task: task || null, sub: sub || null, cycle: (T && T.cycle) || 0, five: min === 5};
  save();
  if (location.hash.indexOf('#/focus') !== 0) location.hash = '#/focus'; else B.render();
};
function startBreak(){
  const cfg = B.cfg().pomo;
  const cyc = (T.cycle || 0);
  const long = cyc > 0 && cyc % (cfg.every || 4) === 0;
  T = {mode: long ? 'long' : 'short', dur: long ? cfg.long : cfg.short, startAt: Date.now(), running: true, pausedLeft: 0, task: T.task, sub: T.sub, cycle: cyc};
  save();
}
function complete(endAt){
  if (!T) return;
  if (T.mode === 'work'){
    const day = B.dayOf(endAt), dur = T.dur;
    B.editDay(day, d => { d.pomo = (d.pomo || []).concat({task: T.task, sub: T.sub, min: dur, at: endAt}); });
    chime();
    const tk = T.task && B.task(T.task);
    if (T.five){
      T = Object.assign({}, T, {done5: true, running: false, pausedLeft: 0, mode: 'work'});
      save(); B.toast('<b class="pos">5 минут есть.</b> Самое трудное позади: начал. Продолжишь полным помидором?', 5000);
      B.render(); return;
    }
    T.cycle = (T.cycle || 0) + 1;
    B.toast(`<b class="pos">Помидор готов</b>${tk ? ' · ' + esc(tk.title) : ''} · <b class="pos">+${B.XP.pomo} XP</b>`, 4000);
    startBreak();
  } else {
    chime();
    T = {mode: 'work', dur: B.cfg().pomo.work, startAt: 0, running: false, pausedLeft: B.cfg().pomo.work * 60000, task: T.task, sub: T.sub, cycle: T.cycle, idle: true};
    save(); B.toast('Перерыв закончился. Готов к следующему помидору?', 4000);
  }
  B.render();
}
const mmss = ms => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${B.pad(Math.floor(s / 60))}:${B.pad(s % 60)}`; };
function tick(){
  if (T && T.running){
    const l = left();
    if (l <= 0){ complete(T.startAt + T.dur * 60000); return; }
  }
  const el = document.getElementById('tmClock');
  if (el && T){ el.textContent = mmss(left()); const r = document.getElementById('tmRing'); if (r){ const c = +r.dataset.c; r.style.strokeDashoffset = c * (left() / (T.dur * 60000)); } }
  const mini = document.getElementById('miniTimer');
  if (mini){
    if (T && (T.running || (!T.idle && !T.done5 && T.pausedLeft))){ mini.hidden = false; mini.querySelector('b').textContent = mmss(left()); mini.className = 'mini-timer ' + T.mode + (T.running ? '' : ' paused'); }
    else mini.hidden = true;
  }
  document.title = T && T.running ? `${mmss(left())} · ${MODES[T.mode]}` : 'Режим бамбука';
}
setInterval(tick, 500);
document.addEventListener('visibilitychange', tick);
B.timerTick = tick;

B.acts.tmStart = () => {
  const sel = B.$('#tmTask'); const task = sel ? sel.value || null : (T && T.task);
  B.startFocus(task, T && T.task === task ? T.sub : null);
};
B.acts.tmFull = () => B.startFocus(T && T.task, T && T.sub);
B.acts.tmPause = () => { if (!T || !T.running) return; T.pausedLeft = left(); T.running = false; save(); B.render(); };
B.acts.tmResume = () => { if (!T) return; T.startAt = Date.now() - (T.dur * 60000 - T.pausedLeft); T.running = true; save(); B.render(); };
B.acts.tmStop = async () => {
  if (!T) return;
  if (T.mode === 'work' && !T.idle && !T.done5 && !(await B.confirm('Остановить помидор? Он не засчитается.', 'Остановить', true))) return;
  T = null; save(); B.render();
};
B.acts.tmSkip = () => { if (!T) return; T = {mode: 'work', dur: B.cfg().pomo.work, running: false, pausedLeft: B.cfg().pomo.work * 60000, task: T.task, sub: T.sub, cycle: T.cycle, idle: true}; save(); B.render(); };
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
    const st = T || {mode: 'work', dur: cfg.work, running: false, pausedLeft: cfg.work * 60000, idle: true};
    const R = 120, C = 2 * Math.PI * R, l = T ? left() : cfg.work * 60000;
    const tk = st.task && B.task(st.task), sub = tk && st.sub && (tk.subs || []).find(s => s.id === st.sub);
    const cand = B.candidates().slice(0, 40);
    const byTask = {};
    pomo.forEach(p => { const k = p.task || ''; byTask[k] = (byTask[k] || 0) + (p.min || 0); });
    const isIdle = !T || st.idle || st.done5;
    return `<div class="page focus-page">
      <header class="page-h"><div><div class="eyebrow">Фокус</div><h1>${MODES[st.mode]}</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card timer-card mode-${st.mode}">
            <div class="timer">
              <svg viewBox="0 0 280 280" class="tring"><circle cx="140" cy="140" r="${R}" class="ring-bg"/><circle id="tmRing" data-c="${C}" cx="140" cy="140" r="${R}" class="ring-fg" stroke-dasharray="${C}" style="stroke-dashoffset:${C * (l / (st.dur * 60000))}" transform="rotate(-90 140 140)"/></svg>
              <div class="tface"><b id="tmClock">${mmss(l)}</b><span>${st.running ? (st.mode === 'work' ? 'не отвлекайся' : 'встань, пройдись, попей воды') : st.done5 ? '5 минут сделано' : isIdle ? 'готов' : 'пауза'}</span></div>
            </div>
            <div class="tm-task">
              ${isIdle ? `<label class="field">Над чем работаешь<select id="tmTask" data-in="tmTask"><option value="">Без задачи</option>${cand.map(t => `<option value="${t.id}" ${st.task === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></label>`
                : tk ? `<div class="tm-now"><span class="muted">Сейчас</span><b>${esc(tk.title)}</b>${sub ? `<span>шаг: ${esc(sub.t)}</span>` : ''}</div>` : ''}
            </div>
            <div class="row center tm-btns">
              ${st.done5 ? `<button class="btn primary lg" data-act="tmFull">${icon('play')} Ещё ${cfg.work} минут</button><button class="btn lg" data-act="tmStop">Хватит</button>`
                : isIdle ? `<button class="btn primary lg" data-act="tmStart">${icon('play')} Начать ${cfg.work} минут</button><button class="btn lg" data-act="five" title="Правило пяти минут: начни, а там посмотришь">5 минут</button>`
                : st.running ? `<button class="btn lg" data-act="tmPause">${icon('pause')} Пауза</button><button class="btn lg ghost" data-act="${st.mode === 'work' ? 'tmStop' : 'tmSkip'}">${st.mode === 'work' ? icon('stop') + ' Стоп' : 'Пропустить перерыв'}</button>`
                : `<button class="btn primary lg" data-act="tmResume">${icon('play')} Продолжить</button><button class="btn lg ghost" data-act="tmStop">${icon('stop')} Стоп</button>`}
              ${tk && !tk.done && !isIdle ? `<button class="btn lg ghost" data-act="tmTaskDone">${icon('check')} ${sub ? 'Шаг сделан' : 'Задача сделана'}</button>` : ''}
            </div>
            <p class="hint center">Телефон экраном вниз, уведомления в сторону. Пока идёт помидор, отвлекающие мысли записывай в <a href="#/journal">дневник</a> и возвращайся.</p>
          </section>
        </div>
        <div class="col">
          <section class="card">
            <h2>${icon('timer')}Сегодня</h2>
            <div class="kpis"><div class="kpi"><b>${pomo.length}</b><span>помидоров</span></div><div class="kpi"><b>${B.mins(pomo.reduce((a, p) => a + (p.min || 0), 0))}</b><span>фокуса</span></div><div class="kpi"><b>${(T && T.cycle) || 0}</b><span>подряд</span></div></div>
            ${Object.keys(byTask).length ? `<ul class="plain">${Object.entries(byTask).sort((a, b) => b[1] - a[1]).map(([k, m]) => `<li><span class="grow">${k ? esc((B.task(k) || {title: 'удалённая задача'}).title) : 'Без задачи'}</span><span class="mono">${B.mins(m)}</span></li>`).join('')}</ul>` : ''}
          </section>
          <section class="card">${weekChart()}</section>
          <section class="card">
            <h2>${icon('gear')}Настройки</h2>
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
