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

test('evening home renders after notebook-only entry', () => {
  const {B} = planner();
  B.editDay(B.today(), d => { d.notebook = 'Сегодня'; });
  assert.match(B.views.today.render(), /Разбор дня написан/);
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
