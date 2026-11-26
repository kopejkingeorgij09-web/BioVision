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
  load('shad-stage'); load('core');
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
  const stubEl = () => ({addEventListener: () => {}, hidden: true, style: {}, scrollHeight: 24, classList: {add() {}, remove() {}, toggle() {}}, querySelector: () => ({addEventListener() {}}), querySelectorAll: () => [], value: ''});
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

test('ICS import opens the shared calendar choices with the inbox selected', () => {
  const {B,page}=planner();
  Object.assign(page,{TextEncoder,URLSearchParams});
  page.document.querySelector=()=>({addEventListener() {}});
  for (const name of ['ui','calendar-data','calendar'])
    vm.runInContext(fs.readFileSync('bamboo/js/'+name+'.js','utf8'),page);
  B.put('p_inbox',{id:'inbox',name:'Входящие'});
  B.put('p_study',{id:'study',name:'Учёба'});
  B.put('p_hidden',{id:'hidden',name:'Архив',arch:true});
  let sheet;
  B.sheet=html=>{sheet=html;};
  B.acts.acImport();
  const options=sheet.match(/<select id="acImportProject">([^]*?)<\/select>/)?.[1];
  assert.ok(options);
  assert.match(options,/<option value="inbox" selected>Входящие<\/option>/);
  assert.match(options,/<option value="study"[^>]*>Учёба<\/option>/);
  assert.doesNotMatch(options,/Архив/);
});

function linkedPlanner() {
  const {B,page}=planner();
  Object.assign(page,{TextEncoder,URLSearchParams});
  page.document.querySelector=()=>null;
  for (const name of ['calendar-data','calendar','board-data','board','focus'])
    vm.runInContext(fs.readFileSync('bamboo/js/'+name+'.js','utf8'),page);
  return {B,page};
}

test('daily history retains earlier lanes and only counts work that ended complete', () => {
  const {B,page}=linkedPlanner(),day=B.today();
  const t=B.newTask({id:'proof',title:'Доказательство',due:day});
  B.saveTask(t);
  const card=()=>B.boardData.get('task:proof');
  const lanes=()=>Object.keys(B.boardData.history(B.today())).filter(k=>B.boardData.history(B.today())[k].some(x=>x.id===card().id));
  B.boardData.move(card(),'active');
  B.boardData.move(card(),'done');
  assert.deepEqual(lanes(),['plan','active','done']);
  B.boardData.move(card(),'active');
  assert.deepEqual(lanes(),['plan','active']);
  B.boardData.move(card(),'done');
  const next=page.Date.now()+86400000;
  page.Date.now=()=>next;
  B.boardData.move(card(),'active');
  assert.equal(B.boardData.history(day).done[0].id,'task:proof');
  assert.deepEqual(lanes(),['active']);
  B.put('t_proof',null);
  assert.equal(B.boardData.history(day).done[0].title,'Доказательство');
});

test('moving a calendar task preserves its lane but only the current occurrence is visible', () => {
  const {B}=linkedPlanner();
  const event={id:'lab:01',type:'task',title:'Занятие',start:'2026-11-18T10:00',end:'2026-11-18T10:30'};
  B.put('e_'+event.id,event);
  const id=B.boardData.eventId(event,'2026-11-18');
  B.historyStep(()=>B.boardData.move(B.boardData.get(id),'active'));
  assert.equal(B.boardData.get(id).lane,'active');
  assert.equal(B.undo(),true);
  assert.equal(B.boardData.get(id).lane,'plan');
  assert.equal(B.list('boardlog_').at(-1).lane,'plan');
  B.redo();
  B.put('e_'+event.id,{...event,start:'2026-11-23T12:00',end:'2026-11-23T13:00'});
  assert.equal(B.boardData.get(id).on,'2026-11-23');
  assert.equal(B.boardData.get(id).lane,'active');
  const repeat={...event,id:'r',repeat:{freq:'daily'},type:'task'};
  B.put('e_r',repeat);
  const first=B.boardData.eventId(repeat,'2026-11-18');
  B.boardData.move(B.boardData.get(first),'active');
  assert(!B.boardData.all('2026-11-19').some(c=>c.id===first));
  B.boardData.move(B.boardData.get(first),'done');
  assert.equal(B.boardData.get('event:r:2026-11-19').lane,'plan');
  assert.equal(B.boardData.history('2026-11-18').done.filter(c=>c.id===first).length,1);
});

test('today board includes checkable slots, SHAD and live tasks in planner order', () => {
  const {B,page}=linkedPlanner(), day=B.today(), tomorrow=B.add(day,1), yesterday=B.add(day,-1);
  function putTask(id,due,extra={}){B.saveTask(B.newTask({id,title:id,due,...extra}));}
  putTask('Вторая',day,{ord:20});
  putTask('Первая',day,{ord:10});
  putTask('Обед',day,{time:'12:00'});
  putTask('Без даты','',{boardLane:'active'});
  putTask('Завтра',tomorrow);
  putTask('Вчера',yesterday,{boardLane:'active',rep:{f:'day'}});
  B.put('e_trip',{id:'trip',title:'Поезд',start:day+'T08:00',end:day+'T09:00'});
  B.put('e_old',{id:'old',title:'Вчера',type:'task',start:yesterday,end:day});
  B.put('board_legacy',{id:'legacy',title:'Старая карточка',lane:'active'});
  B.put('h_py',{id:'py',name:'Питон',created:yesterday});
  B.put('e_py',{id:'py',habitId:'py',title:'Python',type:'task',repeat:{freq:'daily'},start:yesterday+'T16:00',end:yesterday+'T17:00'});
  B.put('e_slot',{id:'slot',title:'Слот',type:'task',start:day,end:tomorrow});
  B.shad.plan=[
    {n:1,t:'Линал',wp:true,hp:true,w:{date:day},h:{date:day,from:'09:30'}},
    {n:2,t:'Без дня',w:{date:day},wk:B.weekStart(day)}, {n:3,t:'Позже',w:{date:tomorrow},wp:true}];
  B.phx.dl={normal:{id:'normal',due:day,title:'Только просмотр'},mirror:{id:'mirror',due:day,shad:1,title:'Основное ДЗ'},elsewhere:{id:'elsewhere',due:day,shad:3,title:'Срок сдачи'},fix:{id:'fix',due:day,shad:1,fix:true,title:'Пересдача'}};
  const ids=()=>Array.from(B.boardData.all(),c=>c.id);
  assert.deepEqual(ids(),['event:slot:single','task:Первая','task:Вторая','shad:web:1','phagi:elsewhere','phagi:fix','shad:hw:1','task:Обед','event:py:'+day]);
  B.boardData.move(B.boardData.get('event:py:'+day),'done');
  assert.equal(B.day(day).h.py,1);
  const py=Array.from(B.boardData.completed()).filter(c=>c.title==='Python');
  assert.equal(py.length,1);
  B.toggleHabitMark('py',day);
  assert(!B.boardData.completed().some(c=>c.title==='Python'));
  page.location.hash='#/board';
  const html=B.views.board.render();
  assert.match(html,/Завершить · Python/);
  assert.doesNotMatch(html,/Поезд|Дата повторяющихся событий|Без даты|Только просмотр/);
});

test('completion archive uses actual marks, deduplicates and removes re-opened items', () => {
  const {B,page}=linkedPlanner();
  const day=B.today(), prev=B.add(day,-3), stamp=+B.parse(prev);
  B.put('t_arch',{id:'arch',title:'Решено раньше',done:true,doneAt:stamp,due:day},true,true);
  B.put('t_skip',{id:'skip',title:'В планах',due:day},true,true);
  B.put('e_g',{id:'g',type:'task',activity:'gym',title:'Зал',start:prev,end:B.add(prev,1)},true,true);
  B.put('ec_cal_g_'+prev,{id:'cal_g_'+prev,calendarId:'g',date:prev,at:stamp},true,true);
  B.put('w_cal_g_'+prev,{id:'cal_g_'+prev,calendarId:'g',date:prev,at:stamp},true,true);
  B.put('boardlog_legacy',{id:'legacy',card:'event:just-meeting:single',title:'Обычное событие',before:'active',lane:'done',at:stamp},true,true);
  B.put('boardlane_event:just-meeting:single',{card:'event:just-meeting:single',lane:'done'},true,true);
  B.put('e_just-meeting',{id:'just-meeting',title:'Обычное событие',start:prev,end:B.add(prev,1)});
  B.put('e_just-meeting',null);
  assert(!B.list('boardlog_').some(x=>x.source==='event' && x.card==='event:just-meeting:single'));
  B.shad.plan=[{n:4,t:'Непрерывность',w:{date:day},h:{date:day}}];
  B.shad.marks[4]={s:3,at:stamp};
  const archive=()=>Array.from(B.boardData.completed(),x=>[x.title,x.day]);
  assert.deepEqual(archive(),[['Зал',prev],['Решено раньше',prev],['Непрерывность',''],['Непрерывность','']]);
  B.boardData.move(B.boardData.get('shad:hw:4'),'active');
  assert.equal(B.boardData.completed().filter(x=>x.title==='Непрерывность').length,1);
  B.setDone(B.task('arch'),false);
  B.boardData.move(B.boardData.get('event:g:single'),'plan');
  assert(!archive().some(([title])=>title==='Зал'||title==='Решено раньше'));
  B.setDone(B.task('arch'),true);
  B.put('t_arch',null);
  assert(archive().some(([title,when])=>title==='Решено раньше'&&when===day));
  page.location.hash='#/board/history';
  const html=B.views.board.render();
  assert.match(html,/Завершённые дела/);
  assert.doesNotMatch(html,/Обычное событие|В планах|В работе|data-board-lane/);
});

test('overnight tasks use today’s visible time and completed exceptions survive series edits', () => {
  const {B}=linkedPlanner(), day=B.today(), prev=B.add(day,-1);
  const night={id:'night',type:'task',title:'Ночная задача',start:prev+'T23:55',end:day+'T00:20'};
  B.put('e_night',night);B.saveTask(B.newTask({id:'lunch',title:'Обед',due:day,time:'12:00'}));
  const [first,second]=B.boardData.all();
  assert.equal(first.id,'event:night:single');assert.equal(first.time,'');assert.equal(first.context,'До 00:20');
  assert.equal(second.id,'task:lunch');
  const recurring={id:'series',title:'Решить задачи',type:'task',repeat:{freq:'daily'},start:prev,end:day};
  B.put('e_series',recurring);B.calData.toggle({...recurring,on:day});
  B.put('e_series',{...recurring,skip:[day]});
  assert(!B.boardData.all().some(c=>c.ref==='series'));
  assert.equal(B.boardData.completed().filter(c=>c.id==='event:series:'+day).length,1);
  const habit={...recurring,id:'daily',title:'Английский',habitId:'lang'};
  B.put('h_lang',{id:'lang',name:'Английский',kind:'daily',created:prev});B.put('e_daily',habit);
  B.toggleHabitMark('lang',day);B.put('e_daily',{...habit,skip:[day]});
  assert(B.boardData.completed().some(c=>c.id==='event:daily:'+day && c.title==='Английский'));
  B.put('e_daily',null);
  assert(B.boardData.completed().some(c=>c.id==='event:daily:'+day));
  B.toggleHabitMark('lang',day);
  assert(!B.boardData.completed().some(c=>c.id==='event:daily:'+day));
});

test('SHAD webinar and homework keep independent completion dates in both clients', async () => {
  const {B,page}=linkedPlanner(), day=B.today(), next=B.add(day,1);
  B.shad.plan=[{n:35,t:'Матанализ',wp:true,w:{date:day},hp:true,h:{date:next}}];
  await B.setShadStage(35,2);
  const w=B.shad.marks[35].at, h=+B.parse(next);
  const ext=page.ShadStages.change(B.shad.marks[35],3,h);
  assert.equal(page.ShadStages.completionTimes(ext).web,w);
  assert.equal(page.ShadStages.completionTimes(ext).hw,h);
  B.shad.marks[35]={...ext,note:'Решил заново'};
  const dates=()=>Object.fromEntries(Array.from(B.boardData.completed(),c=>[c.part,c.day]));
  assert.deepEqual(dates(),{hw:next,web:day});
  const externalReset=page.ShadStages.change(ext,1,h+100);
  assert(!externalReset.completed.web && !externalReset.completed.hw);
  B.shad.marks[35]=externalReset;assert.deepEqual(dates(),{});
  B.shad.marks[35]={...externalReset,s:3,at:h+200};
  assert.deepEqual(dates(),{web:'',hw:''}); // Older app wrote a new stage without completion timestamps.
});

test('two devices completing the same Pomodoro phase contribute one session', () => {
  const {B,page}=linkedPlanner();
  const start=page.Date.now(),total=60000;
  const t={id:'work',phase:'work',mode:'pomo',running:true,left:total,total,until:start+total};
  const put=(id,parent,at,timer)=>B.put('focusop_'+id,{id,parent,at,timer},false,true);
  put('work','',start,t);
  put('pause2','work',start+10000,{...t,running:false,left:50000});
  put('pause1','work',start+10000,{...t,running:false,left:50000});
  put('resume','pause1',start+30000,{...t,until:start+80000});
  assert.equal(B.focus.sessions(start+60000).length,0);
  assert.equal(B.focus.sessions(start+80000).length,1);
  put('break2','resume',start+82000,{...t,id:'b2',phase:'break',until:start+900000});
  put('break1','resume',start+81500,{...t,id:'b1',phase:'break',until:start+900000});
  assert.equal(B.focus.current().id,'break1');
  assert.equal(B.focus.sessions(start+1000000).length,1);
  assert.equal(B.focus.activity(B.today()).length,4);
});

test('weekly export compares the same weekdays and preserves long notes and book activity', () => {
  const {B,page}=linkedPlanner();
  B.calendarView.itemsBetween=()=>[];
  B.setCfg({start:'2026-11-01'});
  B.put('h_lang',{id:'lang',kind:'daily',name:'Язык',created:'2026-11-01'});
  const from=B.weekStart(B.today()),prior=B.add(from,-7);
  const note='Дневник '.repeat(1100);
  B.saveDay(prior,{notebook:note,read:[{min:25}],h:{lang:.5}});
  const date=new page.Date(prior+'T13:00:00').getTime();
  B.put('b_one',{id:'one',title:'Книга',notes:[{at:date,k:'q',t:'Цитата недели'}]});
  B.saveTask(B.newTask({id:'late',title:'Позднее завершение',due:prior,done:true,doneAt:page.Date.now()}));
  vm.runInContext(fs.readFileSync('bamboo/js/stats.js','utf8'),page);
  const report=week=>{const text=B.weekPrompt(week,null);return JSON.parse(text.slice(text.indexOf('{')));};
  const now=report(from),past=report(prior);
  assert.equal(now.индекс.дней,3);
  assert.equal(now.предыдущая_неделя.дней,3);
  assert.equal(now.предыдущая_неделя.балл,12);
  assert.equal(past.дни[0].записи.блокнот,note);
  assert.equal(past.дни[0].книжная_полка[0].заметки[0].текст,'Цитата недели');
  assert.equal(past.дни[0].задачи[0].завершена,undefined);
  assert.equal(now.дни[6].будущий_день,true);
});
