/* Режим бамбука: ядро.
   Даты, хранилище с синхронизацией (Supabase через ../bioviz/x/cloud.js, коллекция 'bamboo'),
   отметки ШАДа (коллекция 'shad', общая с трекером shad/), расчёт опыта, уровня и высоты бамбука.
   Опыт не хранится: он каждый раз считается из записей, поэтому два устройства не могут разойтись. */
(function(){
const B = window.B = {};

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
   d_<дата> день (план, привычки, помидоры, чтение, разбор, мысли), b_<id> книги, w_<id> тренировки.
   Копия всегда есть в localStorage. Изменения помечаются «грязными» и уходят в облако, пока не дойдут. */
const LS_DOCS = 'bamboo-docs', LS_DIRTY = 'bamboo-dirty';
let docs = {}, dirty = {}, db = null, firstSnap = false;
B.ver = 0;
try { docs = JSON.parse(localStorage.getItem(LS_DOCS) || '{}') || {}; } catch (e) { docs = {}; }
try { dirty = JSON.parse(localStorage.getItem(LS_DIRTY) || '{}') || {}; } catch (e) { dirty = {}; }
let lsT;
function lsSave(){
  clearTimeout(lsT);
  lsT = setTimeout(() => {
    try { localStorage.setItem(LS_DOCS, JSON.stringify(docs)); localStorage.setItem(LS_DIRTY, JSON.stringify(dirty)); } catch (e) {}
  }, 120);
}
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
B.put = (id, data, quiet) => {
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
  mk('cfg', {start: t, pomo: {work: 25, short: 5, long: 15, every: 4}, readGoal: 30, sportGoal: 3});
  mk('p_inbox', {id: 'inbox', name: 'Входящие', color: 'ink', order: 0});
  mk('p_uni', {id: 'uni', name: 'Вуз', color: 'blue', order: 1});
  mk('p_phys', {id: 'phys', name: 'Физика', parent: 'uni', color: 'blue', order: 2});
  mk('p_chem', {id: 'chem', name: 'Химия', parent: 'uni', color: 'teal', order: 3});
  mk('p_shad', {id: 'shad', name: 'ШАД', color: 'violet', order: 4});
  mk('p_life', {id: 'life', name: 'Личное', color: 'amber', order: 5});
  mk('h_read', {id: 'read', name: 'Чтение', icon: 'book', kind: 'daily', auto: 'read', min: 30, order: 0, created: t});
  mk('h_sport', {id: 'sport', name: 'Тренировка', icon: 'run', kind: 'weekly', target: 3, auto: 'sport', order: 1, created: t});
  mk('h_sleep', {id: 'sleep', name: 'Сон до 00:00', icon: 'moon', kind: 'daily', auto: 'night', order: 2, created: t});
  lsSave(); changed();
  if (db) flushAll();
}

/* ---------- ШАД: план из ../shad/plan.json и отметки из коллекции 'shad' ---------- */
B.SHAD_STAGES = ['Не начат', 'Смотрю', 'Веб посмотрен', 'ДЗ решено', 'Закрыт'];
B.shad = {plan: [], courses: {}, marks: {}, lms: ''};
const LS_SHADPLAN = 'bamboo-shadplan', LS_SHADMARKS = 'shad-track-progress';   // второй ключ общий с трекером shad/ на этом устройстве
function usePlan(d){
  B.shad.courses = d.courses || {}; B.shad.lms = d.lms || '';
  B.shad.plan = (d.webs || []).map(x => ({n: x.n, c: x.course, code: x.code, t: x.title, w: x.web, h: x.hw}));
  changed();
}
async function loadShadPlan(){
  try { const c = JSON.parse(localStorage.getItem(LS_SHADPLAN) || 'null'); if (c) usePlan(c); } catch (e) {}
  try {
    const r = await fetch('../shad/plan.json', {cache: 'no-cache'});
    if (r.ok){ const d = await r.json(); usePlan(d); try { localStorage.setItem(LS_SHADPLAN, JSON.stringify(d)); } catch (e) {} }
  } catch (e) {}
}
function onShad(snap){
  const m = {};
  snap.docs.forEach(d => { const n = parseInt(d.id.slice(1), 10); const v = d.data() || {}; if (n) m[n] = {s: v.s || 0, note: v.note || '', at: v.at || 0}; });
  if (JSON.stringify(m) !== JSON.stringify(B.shad.marks)){ B.shad.marks = m; changed(); }
}
B.shadStage = n => (B.shad.marks[n] && B.shad.marks[n].s) || 0;
B.setShadStage = async (n, s) => {
  const cur = B.shad.marks[n] || {};
  const v = {s, note: cur.note || '', at: Date.now()};
  B.shad.marks = Object.assign({}, B.shad.marks, {[n]: v});
  changed();
  if (db){
    try {
      if (!s && !v.note) await db.doc('shad/w' + pad(n)).delete();
      else await db.doc('shad/w' + pad(n)).set(v);
    } catch (e) { B.toast('Отметка ШАДа не сохранилась в облаке'); }
  } else {
    try { localStorage.setItem(LS_SHADMARKS, JSON.stringify(B.shad.marks)); } catch (e) {}
  }
};
/* веб и ДЗ на конкретную дату */
B.shadOn = date => {
  const out = [];
  B.shad.plan.forEach(p => {
    if (p.w && p.w.date === date) out.push({p, kind: 'web', from: p.w.from || '', to: p.w.to || '', need: 2});
    if (p.h && p.h.date === date) out.push({p, kind: 'hw', from: p.h.from || '', to: p.h.to || '', need: 3});
  });
  return out.sort((a, b) => a.from.localeCompare(b.from));
};
B.shadLate = () => {
  const t = B.today(), out = [];
  B.shad.plan.forEach(p => {
    const s = B.shadStage(p.n);
    if (s < 2 && p.w && p.w.date < t) out.push({p, kind: 'web', need: 2});
    else if (s < 3 && p.h && p.h.date < t) out.push({p, kind: 'hw', need: 3});
  });
  return out;
};

/* ---------- подключение ---------- */
B.connect = async () => {
  loadShadPlan();
  const me = window.BVAUTH ? await BVAUTH.ready : null;
  if (me && me.role === 'admin' && window.claude){
    try { db = await window.claude.use('db'); } catch (e) { db = null; }
  }
  B.cloud = !!db;
  if (db){
    setSync('cloud', 'Синхронизирую…');
    db.collection('bamboo').onSnapshot(onRemote, () => setSync('error', navigator.onLine ? 'Облако не ответило, копия на устройстве' : 'Нет интернета, копия на устройстве'));
    db.collection('shad').onSnapshot(onShad, () => {});
  } else {
    if (!docs.cfg) seed();
    try { B.shad.marks = JSON.parse(localStorage.getItem(LS_SHADMARKS) || '{}') || {}; } catch (e) {}
    let had = ''; try { had = localStorage.getItem('bv_code') || ''; } catch (e) {}
    setSync(had ? 'error' : 'local', had ? 'Нет связи с облаком, записи пока только здесь' : 'Только на этом устройстве · войди кодом для синхронизации');
    changed();
  }
};
B.exportAll = () => ({app: 'bamboo', at: new Date().toISOString(), docs});
B.importAll = obj => {
  if (!obj || obj.app !== 'bamboo' || !obj.docs) throw new Error('Это не резервная копия Режима бамбука');
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
   Опыт за день:
   план утром +10, каждое из главных дел +15, любая задача +5 (важная +8), шаг большого дела +4,
   фокус +10 за каждые полные 25 минут (от 20 минут засчитывается первый, 5–19 минут +3), привычка +10, чтение +1 за 3 минуты (до 40), тренировка +25, вечерний разбор +20,
   мысль в дневнике +5 (до трёх), стадия веба ШАДа +15, перенос задачи −3.
   Прошедший день «закрыт», если в плане было хотя бы два главных дела, два из них сделаны и написан разбор
   с выбранными главными делами на завтра. Минимальная версия привычки даёт половину опыта.
   Закрытый день добавляет к серии и даёт бонус 5 × серия (до 50). Незакрытый день: −50 и серия с нуля.
   Раз в неделю провал прощается автоматически («заморозка»): серия стоит, штрафа нет. */
B.XP = {plan: 10, top: 15, task: 5, taskP1: 8, sub: 4, pomo: 10, habit: 10, readPer: 3, readMax: 40, sport: 25, review: 20, note: 5, shad: 15, postpone: -3, fail: -50};
B.need = L => 100 + 25 * L;           // опыта от уровня L до L+1
B.GROW = 1.42;                         // каждый уровень бамбук выше в 1,42 раза
B.BASE = 0.3;                          // росток, метры
B.heightAt = lv => B.BASE * Math.pow(B.GROW, lv - 1);

B.levelOf = total => {
  let L = 1, rem = total;
  while (rem >= B.need(L)) { rem -= B.need(L); L++; }
  const frac = rem / B.need(L);
  return {L, rem, frac, height: B.heightAt(L + frac)};
};
/* сколько всего опыта нужно, чтобы бамбук дорос до высоты h */
B.xpForHeight = h => {
  const lv = 1 + Math.log(h / B.BASE) / Math.log(B.GROW);
  const L = Math.floor(lv); let xp = 0;
  for (let k = 1; k < L; k++) xp += B.need(k);
  return xp + (lv - L) * B.need(L);
};
/* 1 — привычка выполнена, 0.5 — минимальная версия (держит серию, половина опыта), 0 — нет */
B.habitVal = (h, date) => {
  if (h.auto === 'read'){
    const m = B.readMin(date);
    if (m >= (h.min || 30)) return 1;
    return h.mini && m >= (h.miniMin || 10) ? 0.5 : 0;
  }
  if (h.auto === 'sport') return sportSet().has(date) ? 1 : 0;
  if (h.auto === 'night'){
    // разбор начат до полуночи того же календарного дня
    const r = B.day(date).review, f = r && (r.first || r.at);
    return f && B.hasReview(B.day(date)) && B.ymd(new Date(f)) === date ? 1 : 0;
  }
  const d = B.day(date), v = d.h && d.h[h.id];
  return v ? (v === 0.5 ? 0.5 : 1) : 0;
};
B.habitDone = (h, date) => B.habitVal(h, date) > 0;
let sportMemo = null, sportVer = -1;
function sportSet(){ if (sportVer !== B.ver){ sportMemo = new Set(B.list('w_').map(w => w.date)); sportVer = B.ver; } return sportMemo; }
B.hasReview = d => !!(d.review && ((d.review.done || '').trim() || (d.review.why || '').trim()));
/* разбор засчитан, когда написан текст и выбраны главные дела на завтра */
B.planned = date => (B.day(date).top || []).some(id => { const t = B.task(id); return t && !t.deleted; });
/* задним числом день не закрыть: разбор начат и план на завтра выбран до конца этого дня (до 4 утра) */
B.reviewDone = date => {
  const d = B.day(date), r = d.review;
  if (!B.hasReview(d)) return false;
  const first = r.first || r.at;
  if (first && B.dayOf(first) > date) return false;
  const next = B.add(date, 1), nd = B.day(next);
  if (!B.planned(next)) return false;
  return !(nd.planAt && B.dayOf(nd.planAt) > date);
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

  const days = {}, weekUsed = {}, weekHab = {};
  let total = 0, streak = 0, best = 0, fails = 0, goods = 0, frozen = 0, xpAll = 0;
  const N = Math.max(0, B.diff(start, today));
  for (let i = 0; i <= N; i++){
    const date = B.add(start, i), d = B.day(date), ws = B.weekStart(date);
    const p = {};
    const top = (d.top || []).map(B.task).filter(t => t && (!t.deleted || date < today));
    if (top.length) p.plan = B.XP.plan;
    const topDoneSameDay = top.filter(t => t.done && t.doneAt && B.dayOf(t.doneAt) === date).length;
    if (topDoneSameDay) p.top = topDoneSameDay * B.XP.top;
    const dn = doneBy[date] || [];
    if (dn.length) p.tasks = dn.reduce((a, t) => a + (t.pri === 1 ? B.XP.taskP1 : B.XP.task), 0);
    if (subBy[date]) p.subs = subBy[date].length * B.XP.sub;
    const pomo = (d.pomo || []).reduce((a, q) => { const m = q.min || 0; return a + (m >= 20 ? Math.max(1, Math.floor(m / 25)) * B.XP.pomo : m >= 5 ? 3 : 0); }, 0);
    if (pomo) p.pomo = pomo;
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
    if (rm) p.read = Math.min(B.XP.readMax, Math.floor(rm / B.XP.readPer));
    if (sportBy[date]) p.sport = Math.min(2, sportBy[date].length) * B.XP.sport;
    const rvOk = B.reviewDone(date);
    if (rvOk) p.review = B.XP.review;
    if (d.notes && d.notes.length) p.notes = Math.min(3, d.notes.length) * B.XP.note;
    if (shadBy[date]) p.shad = shadBy[date].reduce((a, s) => a + s, 0) * B.XP.shad;
    if (postBy[date]) p.postpone = postBy[date].length * B.XP.postpone;

    let xp = 0; for (const k in p) xp += p[k];
    let result = 'open', bonus = 0;
    const topDone = top.filter(t => t.done && t.doneAt && B.dayOf(t.doneAt) <= date).length;
    const needTop = 2;                                  // в плане минимум два дела, сделать нужно два
    const ok = top.length >= 2 && topDone >= needTop && rvOk;
    if (date < today){
      if (ok){ result = 'good'; streak++; goods++; bonus = Math.min(50, 5 * streak); }
      else if (!weekUsed[ws]){ result = 'frozen'; weekUsed[ws] = true; frozen++; }
      else { result = 'fail'; fails++; streak = 0; bonus = B.XP.fail; }
    } else if (ok) { result = 'ready'; }
    best = Math.max(best, streak);
    if (bonus) p.bonus = bonus;
    xp += bonus;
    xpAll += Math.max(0, xp);
    total = Math.max(0, total + xp);
    days[date] = {xp, p, result, total, top: top.length, topDone, needTop, review: rvOk, reviewText: B.hasReview(d)};
  }
  // уровень и высота
  const {L, rem, frac, height} = B.levelOf(total);
  // серия «с учётом сегодня», если сегодня уже закрыт
  const live = streak + (days[today] && days[today].result === 'ready' ? 1 : 0);
  memo = {days, total, level: L, into: rem, need: B.need(L), frac, height, streak, live, best, fails, goods, frozen, xpAll, start, today,
    freezeLeft: !weekUsed[B.weekStart(today)]};
  memoKey = key;
  return memo;
};

/* ---------- вехи высоты ----------
   Расстояния до планет даны при наибольшем сближении с Землёй, световой год 9,46·10¹⁵ м. */
const LY = 9.461e15, AU = 1.496e11;
B.MILES = [
  [0.3, 'Росток', 'с этого начинается каждый бамбук'],
  [1.8, 'Человек', 'бамбук выше тебя'],
  [5.5, 'Жираф', 'самое высокое животное'],
  [15, 'Пятиэтажка', 'пять этажей по 3 метра'],
  [30, 'Гигантский бамбук', 'Dendrocalamus giganteus, до 30 м в высоту'],
  [93, 'Статуя Свободы', 'вместе с пьедесталом'],
  [116, 'Гиперион', 'секвойя, самое высокое дерево на Земле'],
  [330, 'Эйфелева башня', 'с антеннами'],
  [540, 'Останкино', 'Останкинская телебашня'],
  [828, 'Бурдж-Халифа', 'самый высокий небоскрёб'],
  [5642, 'Эльбрус', 'высшая точка России и Европы'],
  [8849, 'Эверест', 'высшая точка Земли'],
  [10000, 'Авиалайнер', 'крейсерская высота около 10 км'],
  [11000, 'Стратосфера', 'над тропосферой, облака остались внизу'],
  [38969, 'Баумгартнер', 'прыжок со стратостата, рекорд 2012 года'],
  [50000, 'Конец стратосферы', 'дальше мезосфера'],
  [100000, 'Линия Кармана', 'граница космоса'],
  [410000, 'МКС', 'орбита около 410 км'],
  [20200000, 'Спутники GPS', 'орбита 20 200 км'],
  [35786000, 'Геостационар', 'геостационарная орбита: спутник висит над одной точкой'],
  [384400000, 'Луна', 'среднее расстояние 384 400 км'],
  [1.5e9, '«Джеймс Уэбб»', 'телескоп в точке Лагранжа L2, 1,5 млн км'],
  [3.8e10, 'Венера', '≈38 млн км'],
  [5.5e10, 'Марс', '≈55 млн км'],
  [7.7e10, 'Меркурий', '≈77 млн км'],
  [AU, 'Солнце', '1 астрономическая единица, 150 млн км'],
  [5.9e11, 'Юпитер', '≈590 млн км'],
  [1.2e12, 'Сатурн', '≈1,2 млрд км'],
  [2.6e12, 'Уран', '≈2,6 млрд км'],
  [4.3e12, 'Нептун', '≈4,3 млрд км'],
  [5.9e12, 'Плутон', '≈40 а. е.'],
  [2.5e13, 'Вояджер-1', 'самый далёкий аппарат людей, ≈25 млрд км'],
  [4.24 * LY, 'Проксима Центавра', 'ближайшая звезда, 4,24 св. года'],
  [8.6 * LY, 'Сириус', 'самая яркая звезда ночного неба, 8,6 св. года'],
  [2.6e4 * LY, 'Центр Галактики', '≈26 тыс. св. лет'],
  [1e5 * LY, 'Млечный Путь', 'диаметр ≈100 тыс. св. лет'],
  [2.5e6 * LY, 'Андромеда', 'соседняя галактика, ≈2,5 млн св. лет'],
  [5.4e7 * LY, 'Скопление Девы', '≈54 млн св. лет'],
  [4.65e10 * LY, 'Край Вселенной', 'граница наблюдаемой Вселенной, ≈46,5 млрд св. лет, дальше карты нет']
];
B.mileFor = h => {
  let prev = null, next = null;
  for (const m of B.MILES){ if (m[0] <= h) prev = m; else { next = m; break; } }
  return {prev, next};
};
B.fmtH = m => {
  if (m < 10) return B.num(m, 2).replace(/(,\d)0$/, '$1') + ' м';
  if (m < 1000) return B.num(m, m < 100 ? 1 : 0) + ' м';
  if (m < 1e6) return B.num(m / 1000, m < 1e4 ? 2 : 1) + ' км';
  if (m < 1e9) return B.num(m / 1000, 0) + ' км';
  if (m < 1e12) return B.num(m / 1e9, 1) + ' млн км';
  if (m < 1e14) return B.num(m / 1e12, 1) + ' млрд км';
  if (m < 1e3 * LY) return B.num(m / LY, 2) + ' св. года';
  if (m < 1e6 * LY) return B.num(m / LY / 1e3, 1) + ' тыс. св. лет';
  if (m < 1e9 * LY) return B.num(m / LY / 1e6, 1) + ' млн св. лет';
  return B.num(m / LY / 1e9, 1) + ' млрд св. лет';
};
})();
