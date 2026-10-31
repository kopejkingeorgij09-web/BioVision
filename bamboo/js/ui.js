/* Режим бамбука: общие кусочки интерфейса.
   Иконки, лист снизу (sheet), диалог, всплывашки, быстрый ввод задач, строка задачи, редактор задачи, перенос с причиной. */
(function(){
const {esc} = B;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
B.$ = $; B.$$ = $$;

/* ---------- иконки (контур 24×24) ---------- */
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  habit: '<path d="M4 12.5l4.5 4.5L20 6"/><path d="M4 6.5l3 3" opacity=".5"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V4.5M8 7h8"/>',
  run: '<circle cx="14" cy="4.5" r="2"/><path d="M5 21l4-6 3 2 1-5 3 3h3M9 11l3-3 3 1"/>',
  dumbbell: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  bamboo: '<path d="M12 22V2"/><path d="M10 7h4M10 13h4M10 18h4"/><path d="M12 9c2.5-.5 4.5-2 5.5-4.5M12 15c-2.5-.5-4.5-2-5.5-4.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="10" rx="1.5"/><rect x="16" y="4" width="5" height="13" rx="1.5"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3.5-2.3-5.8-4-8-.5 2-1.6 3.4-3 4 .4-3-1-6.5-4-9 0 4-5 7-5 13 0 4.3 3 7 9 7z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  later: '<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4M12 8v4l3 2"/>',
  leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19l8-8"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  steps: '<path d="M4 20h4v-4h4v-4h4V8h4V4"/>',
  frog: '<circle cx="8" cy="7" r="2.5"/><circle cx="16" cy="7" r="2.5"/><path d="M4 13c0 4 3.6 7 8 7s8-3 8-7c0-2-1-3.5-2.5-4.5M6.5 8.5C5 9.5 4 11 4 13M9 15c1.8 1 4.2 1 6 0"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8z"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};
B.icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.leaf}</svg>`;
const icon = B.icon;

/* ---------- прогресс-бар и кольцо ---------- */
B.bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${(B.clamp(v, 0, 1) * 100).toFixed(1)}%"></i></div>`;
B.ring = (v, size = 44, cls = '') => {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - B.clamp(v, 0, 1))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
};

/* ---------- всплывашка ---------- */
let toastT;
B.toast = (html, ms = 2600) => {
  const el = $('#toast'); el.innerHTML = html; el.hidden = false; el.classList.remove('out');
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.hidden = true, 250); }, ms);
};
B.xpToast = (n, why) => B.toast(`<b class="${n < 0 ? 'neg' : 'pos'}">${n > 0 ? '+' : ''}${n} XP</b> ${esc(why || '')}`);

/* ---------- лист снизу и диалог ---------- */
let sheetClose = null, sheetGen = 0;
B.sheet = (html, onClose) => {
  sheetGen++;
  const s = $('#sheet'); s.innerHTML = `<div class="sheet-grip"></div><button class="icon-btn sheet-x" data-act="closeSheet" aria-label="Закрыть">${icon('x')}</button>${html}`;
  $('#scrim').hidden = false; document.body.classList.add('locked');
  sheetClose = onClose || null;
  requestAnimationFrame(() => $('#scrim').classList.add('on'));
  const f = s.querySelector('[autofocus]'); if (f && matchMedia('(pointer:fine)').matches) setTimeout(() => f.focus(), 60);
};
B.closeSheet = () => {
  const sc = $('#scrim'); if (sc.hidden) return;
  sc.classList.remove('on'); document.body.classList.remove('locked');
  const g = ++sheetGen;
  setTimeout(() => { if (g !== sheetGen) return; sc.hidden = true; $('#sheet').innerHTML = ''; }, 180);
  const f = sheetClose; sheetClose = null; if (f) f();
  if (B.render) B.render();
};
B.sheetOpen = () => !$('#scrim').hidden;
let dlgResolve = null, dlgGen = 0;
B.dialog = html => new Promise(res => {
  dlgResolve = res; dlgGen++;
  $('#dlg').innerHTML = html; $('#dlgScrim').hidden = false;
  requestAnimationFrame(() => $('#dlgScrim').classList.add('on'));
  const f = $('#dlg [autofocus]'); if (f) setTimeout(() => f.focus(), 60);
});
B.closeDialog = v => {
  $('#dlgScrim').classList.remove('on');
  const g = dlgGen;
  setTimeout(() => { if (g !== dlgGen) return; $('#dlgScrim').hidden = true; $('#dlg').innerHTML = ''; }, 160);
  const r = dlgResolve; dlgResolve = null; if (r) r(v);
};
B.confirm = (text, yes = 'Да', danger) => B.dialog(`<p class="dlg-text">${text}</p>
  <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="dlgYes" autofocus>${yes}</button></div>`);

/* ---------- делегирование событий ---------- */
B.acts = {
  closeSheet: () => B.closeSheet(),
  dlgNo: () => B.closeDialog(false),
  dlgYes: () => B.closeDialog(true)
};
B.inputs = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const f = B.acts[el.dataset.act]; if (!f) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  f(el, e);
});
const onField = e => {
  const el = e.target.closest('[data-in]'); if (!el) return;
  const f = B.inputs[el.dataset.in]; if (f) f(el, e);
};
document.addEventListener('input', onField);
document.addEventListener('change', onField);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ if (!$('#dlgScrim').hidden) B.closeDialog(false); else if (B.sheetOpen()) B.closeSheet(); }
  if (e.key === 'Enter' && !e.shiftKey && e.target.matches('[data-enter]')){
    e.preventDefault(); const f = B.acts[e.target.dataset.enter];
    if (f){ const el = e.target; f(el, e); if (el.isConnected && !el.closest('.sheet,.dlg')){ el.blur(); B.render(); } }
  }
});
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') B.closeSheet(); });
$('#dlgScrim').addEventListener('click', e => { if (e.target.id === 'dlgScrim') B.closeDialog(false); });

/* ---------- быстрый ввод: «сдать лабу пт 18:00 #физика !1 ~3» ---------- */
const WDRE = {пн: 0, понедельник: 0, вт: 1, вторник: 1, ср: 2, среда: 2, среду: 2, чт: 3, четверг: 3, пт: 4, пятница: 4, пятницу: 4, сб: 5, суббота: 5, субботу: 5, вс: 6, воскресенье: 6};
const MONRE = {янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11};
B.findProj = name => {
  const n = name.toLowerCase().replace(/_/g, ' ');
  const ps = B.projects();
  return ps.find(p => p.name.toLowerCase() === n) || ps.find(p => p.name.toLowerCase().startsWith(n));
};
B.parseQuick = (text, defaults = {}) => {
  let s = ' ' + text.trim() + ' ';
  const r = Object.assign({proj: null, pri: 4, due: '', time: '', est: 0, dl: false}, defaults);
  const today = B.today();
  s = s.replace(/\s#([\p{L}\d_\-]+)/gu, (m, n) => { const p = B.findProj(n); if (p){ r.proj = p.id; return ' '; } return m; });
  s = s.replace(/\s!!(?=\s)/g, () => { r.dl = true; return ' '; });
  s = s.replace(/\s!([1-4])(?=\s)/g, (m, n) => { r.pri = +n; return ' '; });
  s = s.replace(/\s~(\d{1,2})(?=\s)/g, (m, n) => { r.est = +n; return ' '; });
  s = s.replace(/\s(?:в\s)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/g, (m, h, mi) => { r.time = B.pad(+h) + ':' + mi; return ' '; });
  s = s.replace(/\s(сегодня|завтра|послезавтра)(?=\s)/gi, (m, w) => { w = w.toLowerCase(); r.due = B.add(today, w === 'сегодня' ? 0 : w === 'завтра' ? 1 : 2); return ' '; });
  s = s.replace(/\sчерез\s(\d{1,3})\s(?:дн[яейь]+|день)(?=\s)/gi, (m, k) => { r.due = B.add(today, +k); return ' '; });
  s = s.replace(/\s(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?=\s)/g, (m, d, mo, y) => {
    const t = B.parse(today); let yy = y ? (+y < 100 ? 2000 + +y : +y) : t.getFullYear();
    let dt = new Date(yy, +mo - 1, +d, 12); if (!y && B.ymd(dt) < today) dt = new Date(yy + 1, +mo - 1, +d, 12);
    if (isNaN(dt)) return m; r.due = B.ymd(dt); return ' ';
  });
  s = s.replace(/\s(\d{1,2})\s(янв|фев|мар|апр|мая|май|июн|июл|авг|сен|окт|ноя|дек)[\p{L}]*(?=\s)/giu, (m, d, mo) => {
    const t = B.parse(today); let dt = new Date(t.getFullYear(), MONRE[mo.toLowerCase()], +d, 12);
    if (B.ymd(dt) < today) dt.setFullYear(dt.getFullYear() + 1);
    r.due = B.ymd(dt); return ' ';
  });
  s = s.replace(/\s(?:в\s|во\s)?(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среда|среду|четверг|пятница|пятницу|суббота|субботу|воскресенье)(?=\s)/gi, (m, w) => {
    const k = WDRE[w.toLowerCase()]; const cur = B.wd(today); r.due = B.add(today, (k - cur + 7) % 7); return ' ';
  });
  r.title = s.replace(/\s+/g, ' ').trim();
  if (r.time && !r.due) r.due = today;
  return r;
};
B.quickHint = 'Пример: <code>решить 3 задачи пт 18:00 #физика !1 ~2</code> · <code>!1</code> важность, <code>~2</code> помидора, <code>#проект</code>, <code>!!</code> дедлайн';
B.addQuick = (text, defaults) => {
  const r = B.parseQuick(text, defaults);
  if (!r.title) return null;
  const t = B.newTask({title: r.title, proj: r.proj || defaults.proj || 'inbox', pri: r.pri, due: r.due, time: r.time, est: r.est, dl: r.dl || undefined});
  B.saveTask(t);
  return t;
};

/* ---------- строка задачи ---------- */
const PRI = {1: 'Срочно и важно', 2: 'Важно', 3: 'Обычно', 4: 'Когда-нибудь'};
B.PRI = PRI;
B.dueLabel = t => {
  if (!t.due) return '';
  const k = B.diff(B.today(), t.due);
  const cls = t.done ? '' : k < 0 ? 'late' : k === 0 ? 'now' : '';
  return `<span class="due ${cls}">${icon('cal')}${B.rel(t.due)}${t.time ? ' ' + t.time : ''}</span>`;
};
B.taskRow = (t, o = {}) => {
  const subs = t.subs || [], sd = subs.filter(s => s.done).length;
  const meta = [];
  if (o.proj !== false && t.proj && t.proj !== 'inbox') meta.push(`<span class="pchip c-${(B.proj(t.proj) || {}).color || 'ink'}">${esc(B.projName(t.proj))}</span>`);
  if (o.when) meta.push(`<span class="when">${icon('timer')}${esc(o.when)}</span>`);
  if (t.due && !o.when) meta.push(B.dueLabel(t));
  if (t.dl && !t.done && t.due) meta.push(`<span class="tag dl">дедлайн</span>`);
  if (t.big) meta.push(`<span class="tag big">большое</span>`);
  if (subs.length) meta.push(`<span class="subs">${icon('steps')}${sd}/${subs.length}</span>`);
  if (t.est) meta.push(`<span class="est" title="Оценка в помидорах">${'●'.repeat(Math.min(t.est, 6))}${t.est > 6 ? '+' : ''}</span>`);
  const pp = (t.postpones || []).length;
  if (pp) meta.push(`<span class="pp ${pp >= 3 ? 'hot' : ''}" title="Сколько раз переносилась">${icon('later')}${pp}</span>`);
  const late = !t.done && t.due && t.due < B.today();
  return `<div class="task p${t.pri || 4} ${t.done ? 'is-done' : ''} ${o.cls || ''}" data-tid="${t.id}" ${o.drag ? 'draggable="true"' : ''}>
    <button class="chk" data-act="toggleTask" data-id="${t.id}" aria-label="${t.done ? 'Вернуть' : 'Готово'}">${icon('check')}</button>
    <button class="task-main" data-act="openTask" data-id="${t.id}">
      <span class="task-title">${o.frog ? `<span class="frog" title="Самое неприятное делай первым">${icon('frog')}</span>` : ''}${esc(t.title)}</span>
      ${meta.length ? `<span class="task-meta">${meta.join('')}</span>` : ''}
      ${subs.length && o.bar !== false ? B.bar(sd / subs.length, 'thin') : ''}
    </button>
    ${late && o.postpone !== false ? `<button class="icon-btn" data-act="postpone" data-id="${t.id}" title="Перенести с причиной">${icon('later')}</button>` : ''}
    ${!t.done && o.play !== false ? `<button class="icon-btn play" data-act="focusTask" data-id="${t.id}" title="Фокус на задаче">${icon('play')}</button>` : ''}
  </div>`;
};
B.acts.toggleTask = el => {
  const t = B.task(el.dataset.id); if (!t) return;
  const before = B.calc().total;
  const nt = B.setDone(t, !t.done);
  if (nt.done){
    const gain = B.calc().total - before;
    B.toast(`<b class="pos">Готово</b> ${esc(t.title)}${gain > 0 ? ` · <b class="pos">+${gain} XP</b>` : ''}`);
  }
};

/* ---------- редактор задачи ---------- */
B.acts.openTask = el => B.openTask(el.dataset.id);
B.openTask = id => {
  const t = B.task(id); if (!t) return;
  const pp = (t.postpones || []);
  const projOpts = B.projects().map(p => `<option value="${p.id}" ${p.id === t.proj ? 'selected' : ''}>${esc(B.projName(p.id))}</option>`).join('');
  B.sheet(`<div class="ed" data-tid="${t.id}">
    <div class="ed-head">
      <button class="chk big ${t.done ? 'on' : ''}" data-act="edDone" data-id="${t.id}">${icon('check')}</button>
      <textarea class="ed-title" rows="1" data-in="edTitle" data-id="${t.id}" placeholder="Что сделать">${esc(t.title)}</textarea>
    </div>
    ${pp.length >= 3 && !t.done ? `<div class="warn-box">${icon('later')}<div><b>Переносилась ${pp.length} ${B.plural(pp.length, 'раз', 'раза', 'раз')}.</b> Так бывает, когда задача слишком большая или непонятно, с чего начать. Разбей её на шаги по 25 минут и сделай первый прямо сейчас.</div></div>` : ''}
    <div class="ed-grid">
      <label>Проект<select data-in="edField" data-k="proj" data-id="${t.id}">${projOpts}</select></label>
      <label>Важность<select data-in="edField" data-k="pri" data-id="${t.id}">${[1, 2, 3, 4].map(p => `<option value="${p}" ${+t.pri === p ? 'selected' : ''}>${p} · ${PRI[p]}</option>`).join('')}</select></label>
      <label>Срок<input type="date" value="${t.due || ''}" data-in="edDue" data-id="${t.id}"></label>
      <label>Время<input type="time" value="${t.time || ''}" data-in="edField" data-k="time" data-id="${t.id}"></label>
      <label>Помидоров<input type="number" min="0" max="99" inputmode="numeric" value="${t.est || ''}" placeholder="0" data-in="edField" data-k="est" data-id="${t.id}"></label>
      <label>Статус<select data-in="edField" data-k="status" data-id="${t.id}">${[['todo', 'Надо'], ['doing', 'В работе'], ['done', 'Готово']].map(([v, l]) => `<option value="${v}" ${t.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <label class="switch"><input type="checkbox" ${t.big ? 'checked' : ''} data-in="edBig" data-id="${t.id}"><span></span>Большое дело: разбить на шаги и делать по одному каждый день</label>
    <label class="switch"><input type="checkbox" ${t.dl ? 'checked' : ''} data-in="edDl" data-id="${t.id}"><span></span>Дедлайн: показывать обратный отсчёт на главном экране</label>
    <div class="ed-sec">
      <div class="sec-h">${icon('steps')} Шаги <span class="muted">${(t.subs || []).filter(s => s.done).length}/${(t.subs || []).length}</span></div>
      <div class="subs-list">${(t.subs || []).map(s => `<div class="sub ${s.done ? 'is-done' : ''}">
        <button class="chk sm" data-act="subToggle" data-id="${t.id}" data-sid="${s.id}">${icon('check')}</button>
        <input value="${esc(s.t)}" data-in="subText" data-id="${t.id}" data-sid="${s.id}">
        <button class="icon-btn sm" data-act="subFocus" data-id="${t.id}" data-sid="${s.id}" title="Фокус на шаге">${icon('play')}</button>
        <button class="icon-btn sm" data-act="subDel" data-id="${t.id}" data-sid="${s.id}" title="Удалить">${icon('x')}</button></div>`).join('')}</div>
      <div class="add-line"><input id="subNew" placeholder="Новый шаг: «прочитать § 4.1», «решить задачи 1–5»" data-enter="subAdd" data-id="${t.id}"><button class="btn sm" data-act="subAdd" data-id="${t.id}">${icon('plus')}</button></div>
    </div>
    <label class="ed-notes">Заметки<textarea rows="3" data-in="edField" data-k="notes" data-id="${t.id}" placeholder="Ссылки, условия, что уже пробовал">${esc(t.notes || '')}</textarea></label>
    ${pp.length ? `<div class="ed-sec"><div class="sec-h">${icon('later')} Переносы</div><ul class="pp-list">${pp.map(p => `<li><span class="mono">${B.fmtS(p.from || '')} → ${B.fmtS(p.to || '')}</span> ${esc(p.why)}</li>`).join('')}</ul></div>` : ''}
    <div class="row between ed-foot">
      <button class="btn ghost danger" data-act="taskDel" data-id="${t.id}">${icon('trash')} Удалить</button>
      <button class="btn primary" data-act="focusTask" data-id="${t.id}">${icon('play')} Начать 25 минут</button>
    </div>
  </div>`);
  const ta = $('.ed-title'); if (ta) autoGrow(ta);
};
function autoGrow(ta){ ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }
const upd = (id, patch, quiet) => { const t = B.task(id); if (!t) return null; const n = Object.assign({}, t, patch); B.saveTask(n, quiet); return n; };
B.updTask = upd;
B.inputs.edTitle = el => { autoGrow(el); upd(el.dataset.id, {title: el.value}, true); };
B.inputs.edField = (el, e) => {
  const k = el.dataset.k; let v = el.value;
  if (k === 'pri' || k === 'est') v = +v || (k === 'pri' ? 4 : 0);
  if (k === 'notes'){ upd(el.dataset.id, {notes: v}, true); return; }
  if (e.type !== 'change') return;
  const patch = {[k]: v};
  if (k === 'status'){ patch.done = v === 'done'; patch.doneAt = v === 'done' ? (B.task(el.dataset.id).doneAt || Date.now()) : null; }
  upd(el.dataset.id, patch, true);
};
B.inputs.edBig = el => upd(el.dataset.id, {big: el.checked}, true);
B.inputs.edDl = el => upd(el.dataset.id, {dl: el.checked}, true);
B.inputs.edDue = async (el, e) => {
  if (e.type !== 'change') return;
  const t = B.task(el.dataset.id); const v = el.value;
  if (t.due && v && v > t.due && !t.done){
    const why = await B.askReason(t, v);
    if (!why){ el.value = t.due; return; }
    upd(t.id, {due: v, postpones: (t.postpones || []).concat({from: t.due, to: v, why, at: Date.now()})}, true);
    B.xpToast(B.XP.postpone, 'за перенос');
    B.openTask(t.id);
  } else upd(t.id, {due: v}, true);
};
B.acts.edDone = el => { const t = B.task(el.dataset.id); B.setDone(t, !t.done); B.openTask(t.id); };
B.acts.taskDel = async el => {
  const t = B.task(el.dataset.id);
  if (!(await B.confirm(`Удалить задачу «${esc(t.title)}»?`, 'Удалить', true))) return;
  // в планах прошлых дней задача остаётся скрытой, иначе удаление невыполненного дела задним числом закрыло бы день
  const today = B.today(); let past = false;
  B.datesWith(t.id).forEach(date => { if (date < today) past = true; else B.editDay(date, d => { d.top = (d.top || []).filter(id => id !== t.id); }, true); });
  B.put('t_' + t.id, past ? Object.assign({}, t, {deleted: true}) : null); B.closeSheet();
};
const subUpd = (id, fn) => { const t = B.task(id); const subs = JSON.parse(JSON.stringify(t.subs || [])); fn(subs); return upd(id, {subs}, true); };
B.acts.subAdd = el => {
  const inp = $('#subNew'); const v = inp.value.trim(); if (!v) return;
  subUpd(el.dataset.id, s => s.push({id: B.uid(), t: v, done: false}));
  B.openTask(el.dataset.id); setTimeout(() => { const i = $('#subNew'); if (i) i.focus(); }, 30);
};
B.acts.subToggle = el => {
  subUpd(el.dataset.id, s => { const x = s.find(q => q.id === el.dataset.sid); x.done = !x.done; x.doneAt = x.done ? Date.now() : null; });
  const t = B.task(el.dataset.id);
  if ((t.subs || []).length && t.subs.every(s => s.done) && !t.done) B.toast('Все шаги сделаны. Отметь и саму задачу');
  B.openTask(el.dataset.id);
};
B.acts.subDel = el => { subUpd(el.dataset.id, s => { const i = s.findIndex(q => q.id === el.dataset.sid); if (i >= 0) s.splice(i, 1); }); B.openTask(el.dataset.id); };
B.inputs.subText = el => subUpd(el.dataset.id, s => { const x = s.find(q => q.id === el.dataset.sid); if (x) x.t = el.value; });
B.acts.subFocus = el => { B.closeSheet(); B.startFocus(el.dataset.id, el.dataset.sid); };
B.acts.focusTask = el => { if (B.sheetOpen()) B.closeSheet(); B.startFocus(el.dataset.id); };

/* ---------- перенос с причиной ---------- */
const REASONS = ['Не рассчитал время', 'Страшно или лень начинать', 'Непонятно, с чего начать', 'Появилось срочное', 'Плохо себя чувствовал', 'Задача оказалась больше'];
B.askReason = (t, to) => B.dialog(`<h3>Перенос на ${B.fmt(to)}</h3>
  <p class="dlg-text">«${esc(t.title)}». Напиши честно, почему не сделал. Через неделю это поможет найти, что мешает.</p>
  <div class="chips">${REASONS.map(r => `<button class="chip" data-act="reasonChip">${r}</button>`).join('')}</div>
  <textarea id="reason" rows="2" placeholder="Причина" autofocus></textarea>
  <div class="row end"><button class="btn ghost" data-act="dlgNo">Не переносить</button><button class="btn primary" data-act="reasonOk">Перенести</button></div>`);
B.acts.reasonChip = el => { const r = $('#reason'); r.value = el.textContent; r.focus(); };
B.acts.reasonOk = () => {
  const v = ($('#reason').value || '').trim();
  if (v.length < 3){ $('#reason').classList.add('shake'); setTimeout(() => $('#reason').classList.remove('shake'), 400); return; }
  B.closeDialog(v);
};
B.acts.postpone = async el => {
  const t = B.task(el.dataset.id); if (!t) return;
  const today = B.today();
  const opts = [[B.add(today, 0), 'Сегодня'], [B.add(today, 1), 'Завтра'], [B.add(today, 2), 'Послезавтра'], [B.add(B.weekStart(today), 7), 'В понедельник']];
  const to = await B.dialog(`<h3>Перенести «${esc(t.title)}»</h3>
    <div class="chips">${opts.map(([d, l]) => `<button class="chip" data-act="ppPick" data-d="${d}">${l} <span class="muted">${B.fmtS(d)}</span></button>`).join('')}</div>
    <label class="field">Или дата<input type="date" id="ppDate" min="${today}"></label>
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="ppDate">Дальше</button></div>`);
  if (!to) return;
  const why = await B.askReason(t, to);
  if (!why) return;
  const nt = upd(t.id, {due: to, postpones: (t.postpones || []).concat({from: t.due || today, to, why, at: Date.now()})});
  B.xpToast(B.XP.postpone, 'за перенос');
  if (nt.postpones.length >= 3 && !(nt.subs || []).length) setTimeout(() => B.openTask(t.id), 300);
};
B.acts.ppPick = el => B.closeDialog(el.dataset.d);
B.acts.ppDate = () => { const v = $('#ppDate').value; if (v) B.closeDialog(v); };

/* ---------- выбор задачи из списка (для плана дня и фокуса) ---------- */
B.candidates = (date) => {
  const t = date || B.today();
  return B.tasks().filter(x => !x.done).sort((a, b) => {
    const da = a.due || '9999', db = b.due || '9999';
    const ua = da <= t ? 0 : 1, ub = db <= t ? 0 : 1;
    return ua - ub || (a.pri || 4) - (b.pri || 4) || da.localeCompare(db) || (a.created || 0) - (b.created || 0);
  });
};
})();
