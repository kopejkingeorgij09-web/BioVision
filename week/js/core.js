/* Зов леса: ядро.
   Даты, хранилище с синхронизацией (Supabase через ../bioviz/x/cloud.js, коллекция 'bamboo'),
   отметки ШАДа (коллекция 'shad', общая с трекером shad/), расчёт опыта, уровня и леса.
   Опыт не хранится: он каждый раз считается из записей, поэтому два устройства не могут разойтись. */
(function(){
const B = window.B = {views: {}};

/* ---------- мелочи ---------- */
const pad = n => String(n).padStart(2, '0');
B.pad = pad;
B.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
B.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
B.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
B.plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b > 1 && b < 5) return few;
  return many;
};
B.num = (x, d = 0) => Number(x).toLocaleString('ru-RU', {maximumFractionDigits: d, minimumFractionDigits: 0});

/* ---------- даты ----------
   День заканчивается в 4 утра: разбор, написанный в половине второго ночи, относится ко вчерашнему дню. */
const SHIFT = 4 * 3600e3;
B.ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
B.dayOf = ts => B.ymd(new Date(ts - SHIFT));
B.today = () => B.dayOf(Date.now());
B.parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
B.add = (s, k) => { const d = B.parse(s); d.setDate(d.getDate() + k); return B.ymd(d); };
B.diff = (a, b) => Math.round((B.parse(b) - B.parse(a)) / 864e5);   // b − a в днях
B.wd = s => (B.parse(s).getDay() + 6) % 7;                          // 0 = понедельник
B.weekStart = s => B.add(s, -B.wd(s));
B.MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
B.MONG = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
B.MONF = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
B.WD = ['пн','вт','ср','чт','пт','сб','вс'];
B.WDF = ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'];
B.fmt = s => { const d = B.parse(s); return `${d.getDate()} ${B.MONG[d.getMonth()]}`; };
B.fmtS = s => { const d = B.parse(s); return `${d.getDate()} ${B.MON[d.getMonth()]}`; };
B.fmtW = s => `${B.WD[B.wd(s)]}, ${B.fmtS(s)}`;
B.rel = s => {
  if (!s) return '';
  const k = B.diff(B.today(), s);
  if (k === 0) return 'сегодня';
  if (k === 1) return 'завтра';
  if (k === -1) return 'вчера';
  if (k > 1 && k < 7) return B.WDF[B.wd(s)];
  return B.fmtS(s);
};
B.hm = ts => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
B.mins = m => m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч${m % 60 ? ' ' + (m % 60) + ' мин' : ''}`;

/* ---------- хранилище ----------
   Все записи лежат документами в одной коллекции: cfg, p_<id> проекты, t_<id> задачи, h_<id> привычки,
   d_<дата> день (план, привычки, чтение, разбор, мысли), b_<id> книги, w_<id> тренировки.
   Копия всегда есть в localStorage. Изменения помечаются «грязными» и уходят в облако, пока не дойдут. */
const LS_DOCS = 'week-docs', LS_DIRTY = 'week-dirty';
let docs = {}, dirty = {}, db = null, firstSnap = false;
B.ver = 0;
try { docs = JSON.parse(localStorage.getItem(LS_DOCS) || '{}') || {}; } catch (e) { docs = {}; }
try { dirty = JSON.parse(localStorage.getItem(LS_DIRTY) || '{}') || {}; } catch (e) { dirty = {}; }
let lsT;
function lsSave(){
  clearTimeout(lsT);
  lsT = setTimeout(() => {
    try { localStorage.setItem(LS_DOCS, JSON.stringify(docs)); localStorage.setItem(LS_DIRTY, JSON.stringify(dirty)); B.lsFull = false; }
    catch (e) { if (!B.lsFull && B.toast) B.toast('Память браузера заполнена: последние изменения сохранены только до перезагрузки. Удали большие вложения или войди в облако.', 8000); B.lsFull = true; }
  }, 120);
}
B.lsSize = () => JSON.stringify(docs).length;
B.sync = {mode: 'local', text: 'Только на этом устройстве'};
function setSync(mode, text){ B.sync = {mode, text}; B.emit('sync'); }

const subs = {};
B.on = (ev, fn) => { (subs[ev] = subs[ev] || []).push(fn); };
B.emit = (ev, x) => (subs[ev] || []).forEach(f => { try { f(x); } catch (e) { console.error(e); } });
let raf = 0;
function changed(){ B.ver++; if (!raf) raf = requestAnimationFrame(() => { raf = 0; B.emit('change'); }); }
B.changed = changed;

B.get = id => docs[id];
B.list = prefix => { const out = []; for (const k in docs) if (k.startsWith(prefix)) out.push(docs[k]); return out; };
/* put(id, null) удаляет. quiet: не перерисовывать (для полей, куда сейчас печатают) */
/* ---------- отмена и повтор (Cmd+Z / Cmd+Shift+Z) ----------
   Каждая запись помнит, каким документ был до и после. Изменения, сделанные подряд за 0,8 с, отменяются одним шагом. */
const undoSt = [], redoSt = [];
let replaying = false, lastRec = 0;
function record(key, before, after){
  if (replaying) return;
  const now = Date.now(), cl = v => v == null ? null : JSON.parse(JSON.stringify(v));
  let e = undoSt[undoSt.length - 1];
  if (!e || now - lastRec > 800){ e = {items: {}}; undoSt.push(e); if (undoSt.length > 100) undoSt.shift(); }
  if (!(key in e.items)) e.items[key] = {before: cl(before)};
  e.items[key].after = cl(after);
  lastRec = now; redoSt.length = 0;
}
function replay(e, which){
  replaying = true;
  try {
    for (const k in e.items){
      const v = e.items[k][which];
      if (k.startsWith('shad:')) B.shadRestore(+k.slice(5), v);
      else B.put(k, v == null ? null : JSON.parse(JSON.stringify(v)));
    }
  } finally { replaying = false; }
}
B.undo = () => { const e = undoSt.pop(); if (!e) return false; replay(e, 'before'); redoSt.push(e); lastRec = 0; return true; };
B.redo = () => { const e = redoSt.pop(); if (!e) return false; replay(e, 'after'); undoSt.push(e); lastRec = 0; return true; };
B.recordShad = (n, before, after) => record('shad:' + n, before, after);
B.clearUndo = () => { undoSt.length = 0; redoSt.length = 0; };

B.put = (id, data, quiet) => {
  if (id !== 'cfg') record(id, docs[id], data);
  if (data == null) delete docs[id];
  else { if (data._seed) delete data._seed; docs[id] = data; }
  dirty[id] = (dirty[id] || 0) + 1;
  lsSave(); schedule(id);
  if (quiet) B.ver++; else changed();
};

const timers = {}, sending = {};
function schedule(id){ if (!db) return; clearTimeout(timers[id]); timers[id] = setTimeout(() => flush(id), 600); }
async function flush(id){
  if (!db || !dirty[id]) return;
  if (sending[id]) { schedule(id); return; }
  sending[id] = true;
  const v = dirty[id], data = docs[id];
  try {
    if (data == null) await db.doc('bamboo/' + id).delete();
    else await db.doc('bamboo/' + id).set(data);
    if (dirty[id] === v) delete dirty[id];
    lsSave();
    if (!Object.keys(dirty).length) setSync('cloud', 'Сохранено в облаке');
  } catch (e) {
    setSync('error', navigator.onLine ? 'Облако не ответило, копия на устройстве' : 'Нет интернета, копия на устройстве');
    clearTimeout(timers[id]); timers[id] = setTimeout(() => flush(id), 15000);
  } finally { sending[id] = false; }
}
function flushAll(){ Object.keys(dirty).forEach(flush); }
addEventListener('online', flushAll);

function onRemote(snap){
  const seen = new Set(); let ch = false;
  for (const d of snap.docs){
    seen.add(d.id);
    // нетронутая заготовка этого устройства уступает тому, что уже есть в облаке
    if (dirty[d.id] && !firstSnap && docs[d.id] && docs[d.id]._seed) delete dirty[d.id];
    if (dirty[d.id]) continue;
    const v = d.data();
    if (JSON.stringify(docs[d.id]) !== JSON.stringify(v)) { docs[d.id] = v; ch = true; }
  }
  for (const id of Object.keys(docs)) if (!seen.has(id) && !dirty[id]) { delete docs[id]; ch = true; }
  if (!firstSnap){
    firstSnap = true;
    if (!docs.cfg) seed();
    flushAll();
  }
  setSync('cloud', Object.keys(dirty).length ? 'Отправляю в облако…' : 'Синхронизировано, видно на всех устройствах');
  if (ch){ lsSave(); changed(); }
}

/* ---------- заготовка при первом запуске ---------- */
function seed(){
  const t = B.today();
  const mk = (id, data) => { if (!docs[id]) { docs[id] = Object.assign({_seed: true}, data); dirty[id] = 1; } };
  mk('cfg', {start: t});
  mk('p_inbox', {id: 'inbox', name: 'Входящие', color: 'ink', order: 0});
  mk('p_study', {id: 'study', name: 'Учёба', color: 'blue', order: 1});
  mk('p_work', {id: 'work', name: 'Работа', color: 'teal', order: 2});
  mk('p_life', {id: 'life', name: 'Личное', color: 'amber', order: 3});
  lsSave(); changed();
  if (db) flushAll();
}

/* ---------- ШАД: план из ../shad/plan.json и отметки из коллекции 'shad' ---------- */
B.SHAD_STAGES = ['Не начат', 'Смотрю', 'Веб посмотрен', 'ДЗ решено', 'Закрыт'];
B.shad = {plan: [], base: [], courses: {}, marks: {}, lms: ''};
const LS_SHADPLAN = 'week-shadplan', LS_SHADMARKS = 'week-shad';   // второй ключ общий с трекером shad/ на этом устройстве
function usePlan(d){
  B.shad.courses = d.courses || {}; B.shad.lms = d.lms || ''; B.shad.brk = d.break || null; B.shad.hours = d.hours || {web: 3.75, hw: 1.9};
  B.shad.base = (d.webs || []).map(x => ({n: x.n, c: x.course, code: x.code, t: x.title, w: x.web, h: x.hw,
    wk: x.web && x.web.date ? B.weekStart(x.web.date) : '', hk: x.hw && x.hw.date ? B.weekStart(x.hw.date) : ''}));
  applyOver(); changed();
}
/* правки вебов (название, дата и время веба, срок ДЗ) лежат в той же записи 'shad/wNN', поле o: {t, w, h}.
   Их видит и трекер shad/: перенёс веб в планере, он переехал и там.
   План раздаёт вебы и ДЗ по неделям (wk, hk — понедельник недели из плана). Пока у веба или ДЗ нет своего дня
   (o.w.date / o.h.date), он лежит в блоке «ШАД на неделю» планера; wp и hp — «поставлен на день». */
function applyOver(){
  B.shad.plan = B.shad.base.map(p => {
    const o = (B.shad.marks[p.n] || {}).o; if (!o) return p;
    return Object.assign({}, p, {t: o.t || p.t, w: o.w ? Object.assign({}, p.w, o.w) : p.w, h: o.h ? Object.assign({}, p.h, o.h) : p.h, edited: true,
      wp: !!(o.w && o.w.date), hp: !!(o.h && o.h.date)});
  });
}
B.shadBase = n => B.shad.base.find(p => p.n === n);
const shadKeep = v => v.s || v.note || v.o;
async function shadWrite(n, v){
  if (db){
    try {
      if (!shadKeep(v)) await db.doc('shad/w' + pad(n)).delete();
      else await db.doc('shad/w' + pad(n)).set(v);
    } catch (e) { B.toast('Изменение ШАДа не сохранилось в облаке'); }
  } else {
    try { localStorage.setItem(LS_SHADMARKS, JSON.stringify(B.shad.marks)); } catch (e) {}
  }
}
/* patch: {t, w: {date, from, to}, h: {date}}; null убирает все правки, веб снова как в плане */
B.shadRestore = (n, v) => {
  const m = Object.assign({}, B.shad.marks);
  if (v) m[n] = v; else delete m[n];
  B.shad.marks = m; applyOver(); changed(); shadWrite(n, v || {s: 0, note: ''});
};
B.setShadOver = (n, patch) => {
  const cur = B.shad.marks[n] || {}, base = B.shadBase(n); if (!base) return;
  let o = null;
  if (patch){
    o = JSON.parse(JSON.stringify(cur.o || {}));
    if ('t' in patch) o.t = (patch.t || '').trim() && patch.t.trim() !== base.t ? patch.t.trim() : undefined;
    ['w', 'h'].forEach(k => {
      if (!patch[k]) return;
      const m = Object.assign({}, o[k] || {}, patch[k]);
      // свой день хранится, даже если совпал с днём из плана (это значит «поставлен»); пустой день убирает его
      Object.keys(m).forEach(f => { if (f === 'date' ? !m.date : (m[f] || '') === (base[k][f] || '')) delete m[f]; });
      o[k] = Object.keys(m).length ? m : undefined;
    });
    o = JSON.parse(JSON.stringify(o));
    if (!Object.keys(o).length) o = null;
  }
  const v = {s: cur.s || 0, note: cur.note || '', at: Date.now()}; if (o) v.o = o;
  B.recordShad(n, B.shad.marks[n], v);
  B.shad.marks = Object.assign({}, B.shad.marks, {[n]: v});
  applyOver(); changed(); shadWrite(n, v);
};
async function loadShadPlan(){
  try { const c = JSON.parse(localStorage.getItem(LS_SHADPLAN) || 'null'); if (c) usePlan(c); } catch (e) {}
  try {
    const r = await fetch('../shad/plan.json', {cache: 'no-cache'});
    if (r.ok){ const d = await r.json(); usePlan(d); try { localStorage.setItem(LS_SHADPLAN, JSON.stringify(d)); } catch (e) {} }
  } catch (e) {}
}
function onShad(snap){
  const m = {};
  snap.docs.forEach(d => { const n = parseInt(d.id.slice(1), 10); const v = d.data() || {}; if (n){ m[n] = {s: v.s || 0, note: v.note || '', at: v.at || 0}; if (v.o) m[n].o = v.o; } });
  if (JSON.stringify(m) !== JSON.stringify(B.shad.marks)){ B.shad.marks = m; applyOver(); changed(); }
}
B.shadStage = n => (B.shad.marks[n] && B.shad.marks[n].s) || 0;
B.setShadStage = async (n, s) => {
  const cur = B.shad.marks[n] || {};
  const v = {s, note: cur.note || '', at: Date.now()}; if (cur.o) v.o = cur.o;
  B.recordShad(n, B.shad.marks[n], v);
  B.shad.marks = Object.assign({}, B.shad.marks, {[n]: v});
  changed();
  await shadWrite(n, v);
};
/* веб и ДЗ, поставленные на конкретный день */
B.shadOn = date => {
  const out = [];
  B.shad.plan.forEach(p => {
    if (p.wp && p.w.date === date) out.push({p, kind: 'web', from: p.w.from || '', to: p.w.to || '', need: 2});
    if (p.hp && p.h.date === date) out.push({p, kind: 'hw', from: p.h.from || '', to: p.h.to || '', need: 3});
  });
  return out.sort((a, b) => a.from.localeCompare(b.from));
};
/* блок «ШАД на неделю»: вебы и ДЗ недели ws без своего дня; на текущей неделе туда же попадают хвосты прошлых недель */
B.shadWeek = ws => {
  const cur = ws === B.weekStart(B.today()), out = [];
  B.shad.plan.forEach(p => {
    const s = B.shadStage(p.n);
    if (p.w && !p.wp && (p.wk === ws || (cur && p.wk < ws && s < 2))) out.push({p, kind: 'web', need: 2, old: p.wk < ws});
    if (p.h && p.h.date && !p.hp && (p.hk === ws || (cur && p.hk < ws && s < 3))) out.push({p, kind: 'hw', need: 3, old: p.hk < ws});
  });
  return out.sort((a, b) => b.old - a.old || a.p.n - b.p.n || (a.kind === 'web' ? -1 : 1));
};
/* всё, что относится к неделе ws: поставленное на её дни и лежащее в блоке */
B.shadWeekAll = ws => {
  const we = B.add(ws, 6), out = B.shadWeek(ws);
  B.shad.plan.forEach(p => {
    if (p.wp && p.w.date >= ws && p.w.date <= we) out.push({p, kind: 'web', need: 2});
    if (p.hp && p.h.date >= ws && p.h.date <= we) out.push({p, kind: 'hw', need: 3});
  });
  return out;
};
B.shadHoursLeft = list => list.reduce((m, it) => m + (B.shadStage(it.p.n) >= it.need ? 0 : (B.shad.hours || {})[it.kind] || 0), 0);
/* убрать день у веба или ДЗ: карточка вернётся в блок своей недели */
B.shadUnplace = (n, kind) => {
  const base = B.shadBase(n), k = kind === 'web' ? 'w' : 'h'; if (!base || !base[k]) return;
  B.setShadOver(n, {[k]: {date: '', from: '', to: ''}});
};
/* хвосты: поставленное на прошедший день или не поставленное, когда неделя уже кончилась */
B.shadLate = () => {
  const t = B.today(), ws = B.weekStart(t), out = [];
  B.shad.plan.forEach(p => {
    const s = B.shadStage(p.n);
    const wl = p.w && (p.wp ? p.w.date < t : p.wk < ws), hl = p.h && p.h.date && (p.hp ? p.h.date < t : p.hk < ws);
    if (s < 2 && wl) out.push({p, kind: 'web', need: 2});
    else if (s < 3 && hl) out.push({p, kind: 'hw', need: 3});
  });
  return out;
};

/* ---------- подключение ---------- */
/* публичная версия: задачи живут только в этом браузере, облака нет (вход по коду можно добавить позже) */
B.connect = async () => {
  B.cloud = false;
  if (!docs.cfg) seed();
  setSync('local', 'Хранится на этом устройстве');
  changed();
};
B.exportAll = () => ({app: 'week', at: new Date().toISOString(), docs});
B.importAll = obj => {
  if (!obj || obj.app !== 'week' || !obj.docs) throw new Error('Это не резервная копия «Недели»');
  for (const id in obj.docs) B.put(id, obj.docs[id], true);
  changed();
};

/* ---------- модель ---------- */
B.cfg = () => Object.assign({start: B.today(), pomo: {work: 25, short: 5, long: 15, every: 4}, readGoal: 30, sportGoal: 3}, docs.cfg || {});
B.setCfg = patch => B.put('cfg', Object.assign({}, docs.cfg || {}, patch));
B.projects = () => B.list('p_').filter(p => !p.arch).sort((a, b) => (a.order || 0) - (b.order || 0));
B.proj = id => docs['p_' + id];
B.projName = id => { const p = B.proj(id); if (!p) return ''; const par = p.parent && B.proj(p.parent); return par ? par.name + ' · ' + p.name : p.name; };
B.tasks = () => B.list('t_').filter(t => !t.deleted);   // удалённые из планов прошлых дней остаются скрытыми, чтобы итоги дней не менялись
B.task = id => docs['t_' + id];
B.saveTask = (t, quiet) => B.put('t_' + t.id, t, quiet);
B.day = date => docs['d_' + date] || {};
B.dayDates = () => Object.keys(docs).filter(k => k.startsWith('d_')).map(k => k.slice(2)).sort();
B.datesWith = id => Object.keys(docs).filter(k => k.startsWith('d_') && (docs[k].top || []).includes(id)).map(k => k.slice(2));
B.saveDay = (date, d, quiet) => B.put('d_' + date, d, quiet);
B.editDay = (date, fn, quiet) => { const d = JSON.parse(JSON.stringify(B.day(date))); fn(d); B.saveDay(date, d, quiet); };
B.habits = () => B.list('h_').filter(h => !h.arch).sort((a, b) => (a.order || 0) - (b.order || 0));
B.books = () => B.list('b_');
B.workouts = () => B.list('w_').sort((a, b) => (b.date + (b.at || 0)).localeCompare(a.date + (a.at || 0)));
B.readMin = date => (B.day(date).read || []).reduce((a, r) => a + (r.min || 0), 0);

B.newTask = o => Object.assign({id: B.uid(), title: '', proj: 'inbox', pri: 4, due: '', time: '', est: 0,
  done: false, status: 'todo', big: false, subs: [], notes: '', created: Date.now(), postpones: []}, o);
B.setDone = (t, v) => {
  t = Object.assign({}, t, {done: v, status: v ? 'done' : (t.status === 'done' ? 'todo' : t.status), doneAt: v ? Date.now() : null});
  B.saveTask(t);
  return t;
};
B.nextStep = t => (t.subs || []).find(s => !s.done);

/* ---------- опыт, уровни, серии ----------
   Опыт дают только дела и привычки: задача +5 (важная или с короной +8), подзадача +4,
   привычка +10 (минимальная версия +5; чтение и тренировка тоже привычки и считаются здесь же).
   Фокус, чтение минутами, разбор и ШАД опыта не дают: они видны в своих разделах и сериях.
   Каждый новый уровень сажает в лесу новое дерево, растущее дерево показывает прогресс внутри уровня. */
B.XP = {task: 0, taskP1: 0, sub: 0, habit: 0};   // в публичной версии опыта нет
B.need = L => 100 + 25 * L;           // опыта от уровня L до L+1

B.levelOf = total => {
  let L = 1, rem = total;
  while (rem >= B.need(L)) { rem -= B.need(L); L++; }
  const frac = rem / B.need(L);
  return {L, rem, frac, trees: L - 1};
};
/* сколько всего опыта нужно, чтобы дойти до уровня L */
B.xpForLevel = L => { let xp = 0; for (let k = 1; k < L; k++) xp += B.need(k); return xp; };
/* 1 — привычка выполнена, 0.5 — минимальная версия (держит серию, половина опыта), 0 — нет */
B.habitVal = (h, date) => {
  if (h.auto === 'read'){
    const m = B.readMin(date);
    if (m >= (h.min || 30)) return 1;
    return h.mini && m >= (h.miniMin || 10) ? 0.5 : 0;
  }
  if (h.auto === 'sport') return sportSet().has(date) ? 1 : 0;
  const d = B.day(date), v = d.h && d.h[h.id];
  return v ? (v === 0.5 ? 0.5 : 1) : 0;
};
B.habitDone = (h, date) => B.habitVal(h, date) > 0;
let sportMemo = null, sportVer = -1;
function sportSet(){ if (sportVer !== B.ver){ sportMemo = new Set(B.list('w_').map(w => w.date)); sportVer = B.ver; } return sportMemo; }
B.hasReview = d => !!(d.review && ((d.review.done || '').trim() || (d.review.why || '').trim()));
/* разбор засчитан, если начат до конца дня (до 4 утра); задним числом не считается */
B.reviewDone = date => {
  const d = B.day(date), r = d.review;
  if (!B.hasReview(d)) return false;
  const first = r.first || r.at;
  return !(first && B.dayOf(first) > date);
};
/* серия дней подряд, где test(date) верно; сегодняшний пропуск серию пока не рвёт */
B.streakOf = (test, from) => {
  const t = B.today(); from = from || B.cfg().start;
  let cur = 0, d = test(t) ? t : B.add(t, -1);
  while (d >= from && test(d)){ cur++; d = B.add(d, -1); }
  let best = 0, run = 0;
  for (let x = from; x <= t; x = B.add(x, 1)){ if (test(x)){ run++; best = Math.max(best, run); } else if (x < t) run = 0; }
  return {cur, best};
};
let memo = null, memoKey = '';
B.calc = () => {
  const today = B.today();
  const key = B.ver + '|' + today;
  if (memo && memoKey === key) return memo;
  const cfg = B.cfg(), start = cfg.start || today;
  const tasks = B.tasks(), habits = B.list('h_');   // и архивные: опыт до дня архивации остаётся
  const doneBy = {}, subBy = {}, postBy = {}, sportBy = {}, shadBy = {};
  const push = (o, k, v) => (o[k] = o[k] || []).push(v);
  tasks.forEach(t => {
    if (t.done && t.doneAt) push(doneBy, B.dayOf(t.doneAt), t);
    (t.subs || []).forEach(s => { if (s.done && s.doneAt) push(subBy, B.dayOf(s.doneAt), s); });
    (t.postpones || []).forEach(p => push(postBy, B.dayOf(p.at), p));
  });
  B.workouts().forEach(w => push(sportBy, w.date, w));
  for (const n in B.shad.marks){ const m = B.shad.marks[n]; if (m.at && m.s) push(shadBy, B.dayOf(m.at), m.s); }

  const days = {}, weekHab = {};
  let total = 0, xpAll = 0;
  const N = Math.max(0, B.diff(start, today));
  for (let i = 0; i <= N; i++){
    const date = B.add(start, i), d = B.day(date), ws = B.weekStart(date);
    const p = {};
    const top = (d.top || []).map(B.task).filter(t => t && (!t.deleted || date < today));
    const crownSet = new Set(top.map(t => t.id));
    const dn = doneBy[date] || [];
    if (dn.length) p.tasks = dn.reduce((a, t) => a + (t.pri === 1 || crownSet.has(t.id) ? B.XP.taskP1 : B.XP.task), 0);
    if (subBy[date]) p.subs = subBy[date].length * B.XP.sub;
    let hab = 0;
    habits.forEach(h => {
      if (h.created && date < h.created) return;
      if (h.arch && h.archAt && date >= h.archAt) return;
      const hv = B.habitVal(h, date);
      if (!hv) return;
      if (h.kind === 'weekly'){
        const k = h.id + ws; weekHab[k] = (weekHab[k] || 0) + 1;
        if (weekHab[k] > (h.target || 3)) return;
      }
      hab += hv;
    });
    if (hab) p.habits = Math.round(hab * B.XP.habit);
    const rm = (d.read || []).reduce((a, r) => a + (r.min || 0), 0);
    const rvOk = B.reviewDone(date);

    let xp = 0; for (const k in p) xp += p[k];
    // день: разбор есть — «good»; что-то сделано без разбора — «some»; пусто — «empty»
    const active = dn.length || hab || rm || sportBy[date] || subBy[date];
    const result = date >= today ? 'open' : rvOk ? 'good' : active ? 'some' : 'empty';
    xpAll += Math.max(0, xp);
    total = Math.max(0, total + xp);
    days[date] = {xp, p, result, total, done: dn.length, review: rvOk, reviewText: B.hasReview(d)};
  }
  // уровень и лес
  const {L, rem, frac, trees} = B.levelOf(total);
  const doneDay = date => !!(days[date] && days[date].done);
  const rv = B.streakOf(date => !!(days[date] && days[date].review), start);
  const tk = B.streakOf(doneDay, start);
  const reviews = Object.values(days).filter(x => x.review).length, empty = Object.values(days).filter(x => x.result === 'empty').length;
  memo = {days, total, level: L, into: rem, need: B.need(L), frac, trees, xpAll, start, today,
    live: rv.cur, best: rv.best, review: rv, tasks: tk, reviews, empty};
  memoKey = key;
  return memo;
};

/* ---------- вехи леса ----------
   Уровень L: в лесу L − 1 взрослых деревьев и одно растущее. Вехи по уровню. */
B.MILES = [
  [1, 'Семечко', 'всё начинается с одного семечка'],
  [2, 'Первое дерево', 'первое взрослое дерево на поляне'],
  [3, 'Пара деревьев', 'уже не одинокое дерево'],
  [5, 'Островок', 'маленький островок зелени'],
  [8, 'Опушка', 'появились первые грибы и тропинка'],
  [12, 'Рощица', 'деревья стоят кружком'],
  [17, 'Роща', 'в роще поселились птицы'],
  [23, 'Лесок', 'тень на всей поляне'],
  [30, 'Лес', 'настоящий лес, можно заблудиться'],
  [40, 'Бор', 'высокие сосны и мох под ногами'],
  [52, 'Дубрава', 'вековые дубы'],
  [66, 'Чаща', 'тропинки зарастают'],
  [82, 'Тайга', 'лес до горизонта'],
  [100, 'Заповедник', 'сюда приходят олени'],
  [130, 'Древний лес', 'лесу больше, чем любому дереву в нём'],
  [170, 'Лесной край', 'зелёный цвет на карте']
];
B.mileFor = L => {
  let prev = null, next = null;
  for (const m of B.MILES){ if (m[0] <= L) prev = m; else { next = m; break; } }
  return {prev, next};
};
B.fmtTrees = n => `${n} ${B.plural(n, 'дерево', 'дерева', 'деревьев')}`;
})();
