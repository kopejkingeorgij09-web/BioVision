const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function planner(width = 390) {
  const noop = () => {};
  const data = new Map();
  class Evening extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 10, 18, 21])); }
    static now() { return +new Evening(); }
  }
  const page = {
    Date: Evening, innerWidth: width, location: {hash: '#/tasks/alberts'},
    document: {addEventListener: noop}, localStorage: {getItem: k => data.get(k), setItem: (k,v) => data.set(k,v)},
    matchMedia: () => ({matches: width >= 960, addEventListener: noop}), addEventListener: noop,
    setTimeout: noop, clearTimeout: noop, setInterval: noop, requestAnimationFrame: () => 1
  };
  page.window = page;
  vm.createContext(page);
  function load(name) { vm.runInContext(fs.readFileSync('bamboo/js/' + name + '.js','utf8'),page); }
  load('core');
  const B = page.B;
  Object.assign(B,{acts:{},inputs:{},views:{},icon:()=>'',bar:()=>'',PRI:[],render:noop});
  load('today'); load('tasks');
  return {B,page};
}

test('evening home omits journal actions and preserves existing entries', () => {
  const {B} = planner();
  B.editDay(B.today(), d => { d.notebook = 'Сегодня'; });
  assert.doesNotMatch(B.views.today.render(), /#\/journal|Разбор дня написан|Вечерний разбор/);
  assert.equal(B.day(B.today()).notebook, 'Сегодня');
});

test('undo only removes an untouched recurrence, rechecking keeps edited instance', () => {
  const {B} = planner();
  const task = B.newTask({title:'Урок',due:B.today(),rep:{f:'week'}});
  B.saveTask(task);
  const complete = () => B.setDone(B.task(task.id),true).repNext;
  const undo = () => B.setDone(B.task(task.id),false);
  const first = complete();
  undo();
  assert.equal(B.task(first),undefined);
  const edited = complete();
  B.saveTask({...B.task(edited), notes:'Матрицы'});
  undo();
  assert.equal(complete(),edited);
  assert.equal(B.task(edited).notes,'Матрицы');
  assert.equal(B.tasks().length,2);
});

test('action undo keeps unrelated edits and refuses to overwrite a later edit of the same record', () => {
  const {B} = planner();
  B.put('event', {start:'09:00', end:'10:00'});
  let undo;
  B.historyStep(() => B.put('event', null), restore => {undo = restore;});
  B.put('task', {title:'Another edit'});
  assert.equal(undo(), true);
  assert.equal(B.get('event').start, '09:00');
  assert.equal(B.get('task').title, 'Another edit');
  assert.equal(B.redo(), true);
  assert.equal(B.get('event'), undefined);

  B.historyStep(() => B.put('event', {start:'10:00', end:'11:00'}), restore => {undo = restore;});
  B.put('event', {start:'11:00', end:'12:00'});
  assert.equal(undo(), false);
  assert.equal(B.get('event').start, '11:00');
});

test('SHAD stage and placement survive backup round trip and legacy import', () => {
  const {B} = planner();
  const mark = {s:2,o:{h:{date:'2026-11-21'}}};
  B.shadRestore(1,mark);
  const copy = JSON.parse(JSON.stringify(B.exportAll()));
  const dest = planner().B;
  dest.importAll(copy);
  dest.importAll({app:'bamboo',docs:{}});
  assert.deepEqual(dest.shad.marks[1],mark);
});

for (const width of [390,1440]) test('week and month with SHAD at width ' + width, () => {
  const {B,page} = planner(width);
  const date = B.today();
  B.shad.plan = [{n:1,w:{date},wk:B.weekStart(date),t:'Матан'}];
  B.acts.openWeekPool();
  assert.equal(page.location.hash,'#/tasks/week');
  const html = B.views.tasks.render('week');
  assert.equal(html.indexOf('class="pl-shbox"') < html.indexOf('class="pl-week"'),width===390);
  assert.match(html,/Матан/);
  B.acts.plView({dataset:{v:'month'}});
  assert.equal(page.location.hash,'#/tasks/month');
  assert.match(B.views.tasks.render('month'),/pl-month/);
});

test('cloud status includes pending SHAD writes until acknowledgement', async () => {
  const {B,page} = planner();
  let confirmWrite;
  const db = {
    doc: () => ({set: () => new Promise(resolve => { confirmWrite = resolve; })}),
    collection: () => ({onSnapshot() {}})
  };
  page.BVAUTH = {ready: Promise.resolve({role:'admin'})};
  page.claude = {use: async () => db};
  await B.connect();
  const saving = B.setShadStage(1,2);
  assert.equal(B.shadPending(1),true);
  assert.equal(B.sync.mode,'pending');
  confirmWrite();
  await saving;
  assert.equal(B.shadPending(1),false);
  assert.equal(B.sync.mode,'cloud');
});

test('pinning keeps two habits first, supports unpin and frees archived slots', () => {
  const {B, page} = planner();
  vm.runInContext(fs.readFileSync('bamboo/js/habits.js', 'utf8'), page);
  let toast;
  B.toast = message => { toast = message; };
  for (const id of ['a','b','c']) B.put('h_' + id, {id, name:id, order:id.charCodeAt(0)});
  const tap = id => B.acts.habitPin({dataset:{id}});
  const first = () => Array.from(B.trackerHabits(), h => h.id).slice(0, 2);
  tap('c'); tap('b'); tap('a');
  assert.deepEqual(first(), ['c','b']);
  assert.match(toast, /две привычки/);
  tap('c'); tap('a');
  assert.deepEqual(first(), ['b','a']);
  B.put('h_b', {...B.get('h_b'), arch:true});
  tap('c');
  assert.deepEqual(first(), ['a','c']);
});

test('a gym series records only the completed occurrence in the workout tracker', () => {
  const {B, page} = planner();
  page.TextEncoder = TextEncoder;
  page.URLSearchParams = URLSearchParams;
  vm.runInContext(fs.readFileSync('bamboo/js/calendar-data.js', 'utf8'), page);
  const C = B.calData, habit = {auto:'sport'};
  const event = {id:'gym-series', title:'Зал · силовая тренировка',
    start:'2026-11-18T14:20', end:'2026-11-18T16:05', repeat:{freq:'weekly',every:1}};
  const [first, next] = C.occurrences(event,'2026-11-18','2026-11-25');

  assert.equal(C.isTask(first),true);
  assert.equal(C.isTask({...first,type:'event'}),false);
  C.toggle(first);
  assert.equal(C.done(first),true);
  assert.equal(C.done(next),false);
  assert.equal(B.habitVal(habit,first.on),1);
  assert.equal(B.habitVal(habit,next.on),0);
  assert.equal(B.exportAll().docs['w_cal_gym-series_2026-11-18'].type,'gym');

  const moved = {...first,id:'gym-moved',start:'2026-11-19T18:00',end:'2026-11-19T19:45',repeat:null,on:'2026-11-19'};
  C.moveCompletions(event,moved,first.on,1,true);
  assert.equal(C.done(first),false);
  assert.equal(C.done(moved),true);
  assert.equal(B.habitVal(habit,moved.on),1);
  B.put('w_manual',{id:'manual',date:moved.on});
  C.toggle(moved);
  assert.equal(C.done(moved),false);
  assert.equal(B.habitVal(habit,moved.on),1);
});

test('completing a regular calendar task leaves the workout tracker alone', () => {
  const {B, page} = planner();
  page.TextEncoder = TextEncoder;
  page.URLSearchParams = URLSearchParams;
  vm.runInContext(fs.readFileSync('bamboo/js/calendar-data.js', 'utf8'), page);
  const task = {id:'study',title:'Семинар',type:'task',on:'2026-11-18'};
  B.calData.toggle(task);
  assert.equal(B.calData.done(task),true);
  assert.equal(B.habitVal({auto:'sport'},task.on),0);
  B.calData.toggle(task);
  assert.equal(B.calData.done(task),false);
});

test('a calendar entry linked to a daily habit shares the tracker mark for its date', () => {
  const {B, page} = planner();
  page.TextEncoder = TextEncoder;
  page.URLSearchParams = URLSearchParams;
  vm.runInContext(fs.readFileSync('bamboo/js/calendar-data.js', 'utf8'), page);
  const C = B.calData, habit = {id:'python',name:'Python · 30–40 мин',created:'2026-11-23'};
  const monday = {id:'python-mon', habitId:habit.id, title:'Python', type:'task', on:'2026-11-23'};
  const tuesday = {...monday,id:'python-tue',on:'2026-11-24'};
  B.put('h_python',habit);
  B.editDay(monday.on,day=>{day.h = {english:1};});
  C.toggle(monday);
  assert.equal(C.done(monday),true);
  assert.equal(C.done(tuesday),false);
  assert.equal(B.habitVal(habit,monday.on),1);
  assert.equal(B.list('ec_').length,0);

  B.toggleHabitMark(habit.id,tuesday.on);
  assert.equal(C.done(tuesday),true);
  C.toggle(monday);
  assert.equal(B.habitVal(habit,monday.on),0);
  assert.equal(B.day(monday.on).h.english,1);
  assert.equal(C.done(tuesday),true);
});

test('postponing a task shows a clean date toast without undefined XP and escapes unsafe attachment data', async () => {
  const {B, page} = planner();
  const stubEl = () => ({addEventListener: () => {}, hidden: true, style: {}, scrollHeight: 24, classList: {add() {}, remove() {}, toggle() {}}, querySelector: () => null, value: ''});
  page.document.querySelector = () => stubEl();
  page.document.querySelectorAll = () => [];
  page.navigator = {};
  vm.runInContext(fs.readFileSync('bamboo/js/ui.js', 'utf8'), page);
  vm.runInContext(fs.readFileSync('bamboo/js/tasks.js', 'utf8'), page);

  const task = B.newTask({id: 'pp1', title: 'ДЗ', due: B.today()});
  B.saveTask(task);
  const nextDay = B.add(B.today(), 1);
  const replies = [nextDay, 'Появилось срочное'];
  const toasts = [];
  let sheetHtml = '';
  B.dialog = async () => replies.shift();
  B.toast = msg => toasts.push(msg);
  B.sheet = html => { sheetHtml = html; };

  await B.acts.postpone({dataset: {id: 'pp1'}});
  assert.equal(toasts.some(m => m.includes('undefined')), false);
  assert.match(toasts[0], /Перенесено на/);

  B.put('f_bad', {id: 'bad', task: 'pp1', name: 'evil.html', type: 'text/plain', data: 'javascript:alert(1)'}, true);
  B.put('f_html', {id: 'html', task: 'pp1', name: 'bad.html', type: 'image/png', data: 'data:text/html,<script>1</script>'}, true);
  B.put('f_ok', {id: 'ok', task: 'pp1', name: 'pic.jpg', type: 'image/jpeg', data: 'data:image/jpeg;base64,AA=='}, true);
  B.openTask('pp1');
  assert.equal(sheetHtml.includes('javascript:alert'), false);
  assert.equal(sheetHtml.includes('data:text/html'), false);
  assert.match(sheetHtml, /data:image\/jpeg;base64,AA==/);
});

test('onReady waits for first cloud snapshot, importAll clears undo and guards prototype keys, invalid reminders do not emit NaN', async () => {
  const {B, page} = planner();
  let readyCalls = 0, snapshotHandler = null;
  B.onReady(() => { readyCalls++; });
  const db = {
    doc: () => ({set: async () => {}, delete: async () => {}}),
    collection: name => ({onSnapshot(fn) { if (name === 'bamboo') snapshotHandler = fn; }})
  };
  page.BVAUTH = {ready: Promise.resolve({role: 'admin'})};
  page.claude = {use: async () => db};
  await B.connect();
  assert.equal(readyCalls, 0);
  snapshotHandler({docs: [{id: 'cfg', data: () => ({start: B.today(), migManual: 1})}]});
  assert.equal(readyCalls, 1);

  const mal = JSON.parse('{"app":"bamboo","docs":{"__proto__":{"polluted":true},"t_ok":{"id":"ok","title":"Задача"}}}');
  B.importAll(mal);
  assert.equal(({}).polluted, undefined);
  assert.equal(B.task('ok').title, 'Задача');
  assert.equal(B.undo(), false);

  const rep = B.newTask({id: 'rep1', title: 'Повтор', due: B.today(), rep: {f: 'day'}, remind: {at: 'not-a-date'}});
  B.saveTask(rep);
  const done = B.setDone(B.task('rep1'), true);
  const next = B.task(done.repNext);
  assert.equal(next.remind, null);
});

test('calendar is an independent top-level section between tasks and board, and #/tasks/calendar redirects to it', () => {
  const {B, page} = planner();
  const stub = () => ({innerHTML: '', className: '', title: '', textContent: '', value: '', hidden: true, style: {}, scrollHeight: 24,
    classList: {add() {}, remove() {}, toggle() {}}, addEventListener: () => {}, querySelector: () => stub(), querySelectorAll: () => [], contains: () => false});
  const elements = new Map();
  const getEl = id => { if (!elements.has(id)) elements.set(id, stub()); return elements.get(id); };
  page.document.getElementById = getEl;
  page.document.querySelector = () => stub();
  page.document.querySelectorAll = () => [];
  page.document.body = stub();
  page.document.documentElement = {setAttribute() {}, removeAttribute() {}};
  page.navigator = {};
  page.scrollY = 0;
  page.scrollTo = () => {};
  B.$ = () => stub();
  B.$$ = () => [];
  B.sheetOpen = () => false;
  page.history = {replaceState(_s, _t, url) { page.location.hash = url.slice(url.indexOf('#')); }};
  page.location = {hash: '#/tasks/calendar', pathname: '/bamboo/', search: ''};
  page.TextEncoder = TextEncoder;
  page.URLSearchParams = URLSearchParams;
  vm.runInContext(fs.readFileSync('bamboo/js/calendar-data.js', 'utf8'), page);
  vm.runInContext(fs.readFileSync('bamboo/js/calendar.js', 'utf8'), page);
  vm.runInContext(fs.readFileSync('bamboo/js/board.js', 'utf8'), page);
  vm.runInContext(fs.readFileSync('bamboo/js/app.js', 'utf8'), page);

  assert.ok(B.views.calendar);
  const tasksHtml = B.views.tasks.render('week');
  assert.doesNotMatch(tasksHtml, /data-v="calendar"/);
  assert.equal((tasksHtml.match(/data-act="plView"/g) || []).length, 4);

  B.render(true);
  assert.equal(page.location.hash, '#/calendar');
  const sideHtml = getEl('side').innerHTML;
  const iTasks = sideHtml.indexOf('href="#/tasks"');
  const iCal = sideHtml.indexOf('href="#/calendar"');
  const iBoard = sideHtml.indexOf('href="#/board"');
  assert.ok(iTasks > -1 && iCal > iTasks && iBoard > iCal);
});
