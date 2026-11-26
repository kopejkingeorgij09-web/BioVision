/* Команды и подсказки используют одну таблицу. Буквы привязаны к физическим
   клавишам: смена русской и английской раскладки не меняет сочетание. */
(function(){
const apple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || '');
const editable = el => !!el && (el.isContentEditable || !!el.closest?.('input,textarea,select,[role="textbox"]'));
const control = el => !!el?.closest?.('button,a,input,textarea,select,summary,[role="button"],[role="slider"]');
const dialogOpen = () => !B.$('#dlgScrim').hidden;
const go = path => { location.hash = '#/' + path; };
const act = (name, dataset = {}) => () => B.acts[name]({dataset});
const groupInfo = {
  nav: ['Разделы', 'grid'],
  common: ['Общие команды', 'key'],
  planner: ['Задачи', 'list'],
  calendar: ['Календарь', 'cal'],
  board: ['Доска и фокус', 'board'],
  card: ['Редактор записи', 'note']
};
let guideGroup = 'nav', pointerMode = null;
document.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') pointerMode = true; }, {passive:true});
document.addEventListener('pointerdown', e => { pointerMode = e.pointerType !== 'touch'; }, true);
document.addEventListener('focusin', () => { pointerMode = false; });
B.keyTarget = (root, selector) => {
  if (!root) return null;
  if (pointerMode) return root.querySelector(selector + ':hover');
  const row = document.activeElement?.closest(selector);
  if (row && root.contains(row)) return row;
  return pointerMode === null ? root.querySelector(selector + ':hover') : null;
};

const commands = [];
function command(group, scope, combos, title, run, note = ''){
  commands.push({group, scope, combos:combos.split(' '), title, run, note});
}
const sections = [
  ['1','Сегодня','today'], ['2','Задачи','tasks'], ['3','Календарь','calendar'],
  ['4','Доска дел','board'], ['5','Привычки','habits'], ['6','Итоги','stats'],
  ['7','Чтение','read'], ['8','Лес','forest'], ['9','Фокус','board/focus'], ['0','Настройки','settings']
];
sections.forEach(([n,label,path]) => command('nav', 'global', 'Digit' + n, label, () => go(path)));
command('common','global','Slash','Поиск по приложению',() => go('search'));
command('common','global','Shift+Slash','Справочник клавиш',() => B.acts.keysHelp());
command('common','global','Mod+KeyZ','Отменить изменение',() => B.handleHistory(false));
command('common','global',apple ? 'Mod+Shift+KeyZ' : 'Mod+Shift+KeyZ Mod+KeyY','Повторить изменение',() => B.handleHistory(true));
command('common','escape','Escape','Закрыть открытое окно',() => {
  if (dialogOpen()) B.closeDialog(false);
  else if (B.sheetOpen()) B.closeSheet();
  else if (B.pl?.clearSel()) return;
  else if (B.plWide && B.$('.planner-frame,.page.ac')) B.acts.plFull();
  else return false;
},'В планере также снимает выбор строки или возвращает боковое меню.');

const plannerRow = () => B.pl.targetRow();
function rowAction(selector){
  const button = plannerRow()?.querySelector(selector);
  if (!button) return false;
  button.click();
}
function taskAction(fn){
  const id = plannerRow()?.dataset.tid;
  const task = id && B.task(id);
  return task && !task.deleted ? fn(task) : false;
}
function moveDay(k){
  return taskAction(task => B.historyStep(() => B.pl.move(task,B.add(task.due || B.today(),k))));
}
function reorder(k){
  return taskAction(task => {
    if (!B.pl.reorder(task,k)) B.toast(k < 0 ? 'Выше нет задачи с тем же временем' : 'Ниже нет задачи с тем же временем',900);
  });
}
function deleteItem(){
  const row = B.$('.page.ac') ? B.keyTarget(B.$('.page.ac'),'.ac-item') : plannerRow();
  B.calendarView.deleteKeyItem(row);
}
const deleteNote = 'На серии удаляет одно вхождение. У запланированного ШАДа, привычки или тренировки снимает время. Отмена возвращает запись.';
const onWeek = () => ['week','month'].includes(B.pl?.view());
for (const [group,scope] of [['planner','plannerGrid'],['calendar','calendar']]){
  command(group,scope,'Delete Backspace','Удалить дело под курсором или в фокусе',deleteItem,deleteNote);
  command(group,scope,'ArrowLeft','Предыдущий период',act(group==='planner'?'plShift':'acShift',group==='planner'?{k:'-1'}:{n:'-1'}));
  command(group,scope,'ArrowRight','Следующий период',act(group==='planner'?'plShift':'acShift',group==='planner'?{k:'1'}:{n:'1'}));
  command(group,scope,'KeyT','Перейти к сегодняшнему дню',act(group==='planner'?'plToday':'acToday'));
  command(group,group==='planner'?'planner':scope,'KeyF','Скрыть или показать боковое меню',act('plFull'));
}
command('calendar','calendar','KeyK','Поиск в календаре',act('acSearch'));
command('calendar','calendar','KeyN','Новая запись',act('acAdd'));
command('planner','planner','KeyN','Новая задача на сегодня',() => B.acts.plAddDay({dataset:{d:B.today()}}));
for(const [code,name,view] of [['KeyW','Неделя','week'],['KeyM','Месяц','month'],['KeyS','ШАД','shad'],['KeyA','Альбертс','alberts']]){
  command('planner','planner',code,name,act('plView',{v:view}));
}
command('planner','plannerGrid','ArrowUp','Выбрать дело выше',() => B.pl.step(-1));
command('planner','plannerGrid','ArrowDown','Выбрать дело ниже',() => B.pl.step(1));
command('planner','plannerGrid','Enter','Открыть выбранное дело',() => rowAction('.pl-open'));
command('planner','plannerGrid','Space','Поставить или снять галочку',() => rowAction('button.pl-chk,button.ac-check'));
command('planner','plannerGrid','Shift+ArrowLeft','Сдвинуть задачу на день раньше',() => moveDay(-1));
command('planner','plannerGrid','Shift+ArrowRight','Сдвинуть задачу на день позже',() => moveDay(1));
command('planner','plannerGrid','Alt+ArrowUp','Поднять задачу внутри дня',() => reorder(-1),'Для задач без времени или с одинаковым временем.');
command('planner','plannerGrid','Alt+ArrowDown','Опустить задачу внутри дня',() => reorder(1),'Для задач без времени или с одинаковым временем.');

command('board','board','KeyL','Дела на сегодня',() => go('board'));
command('board','board','KeyH','История готовых дел',() => go('board/history'));
command('board','board','KeyF','Открыть фокус',() => go('board/focus'));
command('board','boardLive','KeyN','Новое дело на доске',act('boardAdd',{lane:'plan'}));
command('board','focus','Space','Запустить или приостановить таймер',act('focusToggle'));
command('board','focus','Shift+KeyR','Сбросить таймер',act('focusReset'));
command('board','focus','KeyB','Начать перерыв помодоро',() => {
  const button = B.$('[data-act=focusBreak]:not(:disabled)');
  if (!button) return false;
  button.click();
});
command('board','focus','KeyM','Включить или приостановить фон',act('focusSound'));
command('board','focus','Shift+KeyM','Вернуть фон к началу',act('focusAudioReset'));

command('card','entryEditor','Mod+Enter','Сохранить запись',() => {
  const form = B.$('.sheet form.entry-editor');
  if (!form) return false;
  form.querySelector('button[type=submit]').click();
});
command('card','taskEditor','KeyD','Выбрать срок',() => {
  const field = B.$('.sheet input[data-in=twDue]');
  if (!field) return false;
  try { field.showPicker(); } catch { field.focus(); field.click(); }
});
command('card','taskEditor','KeyC','Палитра задачи',() => B.twToggle('color'));
command('card','taskEditor','KeyK','Выбрать календарь',() => B.twToggle('cal'));
command('card','taskPicker','Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9','Выбрать по номеру',(event,code) => {
  const pop = B.twPopNow();
  const buttons = B.$$('.sheet ' + (pop === 'cal' ? '[data-act=twProj]' : '.tw-colors [data-act=twColor]'));
  const btn = buttons[Number(code.slice(5)) - 1];
  if (!btn) return false;
  btn.click();
},'Работает в открытой палитре или списке календарей.');

function keyName(key){
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Digit')) return key.slice(5);
  return {Mod:apple?'⌘':'Ctrl', Alt:apple?'⌥':'Alt', Shift:'Shift', Escape:'Esc', Backspace:apple?'⌫':'Backspace',
    Space:'Пробел', Slash:'/', ArrowLeft:'←', ArrowRight:'→', ArrowUp:'↑', ArrowDown:'↓'}[key] || key;
}
function keyCaps(combo){
  return '<span class="kg-combo">' + combo.split('+').map(key => '<kbd>' + keyName(key) + '</kbd>').join('') + '</span>';
}
function commandTile(cmd){
  const caps = cmd.scope === 'taskPicker' ? '<kbd>1–9</kbd>' : cmd.combos.map(keyCaps).join('<span class="kg-or">/</span>');
  const label = '<span class="kg-label"><strong>' + cmd.title + '</strong>' +
    (cmd.note ? '<small>' + cmd.note + '</small>' : '') + '</span>';
  return '<div class="kg-command">' + label + '<div class="kg-caps">' + caps + '</div></div>';
}
function drawCommands(group){
  const items = commands.filter(cmd => cmd.group === group);
  const sections = group === 'board' ? [['На доске',['board','boardLive']],['Во время фокуса',['focus']]] :
    group === 'card' ? [['В любом редакторе',['entryEditor']],['В карточке задачи',['taskEditor','taskPicker']]] :
    group === 'planner' ? [['Виды планера',['planner']],['В неделе и месяце',['plannerGrid']]] : [];
  if (!sections.length) return items.map(commandTile).join('');
  return sections.map(([title,scopes]) => '<h3 class="kg-subtitle">' + title + '</h3>' +
    items.filter(cmd => scopes.includes(cmd.scope)).map(commandTile).join('')).join('');
}
function guideContent(){
  return '<div class="kg-groups" role="group" aria-label="Область применения">' +
    Object.entries(groupInfo).map(([k,[name,icon]]) =>
      '<button type="button" data-act="keyGroup" data-group="' + k + '" aria-pressed="' + (k===guideGroup) + '">' + B.icon(icon) + name + '</button>'
    ).join('') + '</div><div class="kg-commands" data-group="' + guideGroup + '">' + drawCommands(guideGroup) + '</div>';
}
B.keyboardGuide = () => '<section class="card key-guide" aria-label="Горячие клавиши"><header class="kg-head"><div class="kg-icon">' +
  B.icon('key') + '</div><div><h2>Горячие клавиши</h2><p>Буквенные команды работают и в русской раскладке.</p></div></header>' + guideContent() + '</section>';
B.acts.keyGroup = el => {
  guideGroup = el.dataset.group;
  const root = el.closest('.key-guide');
  root.querySelectorAll('[data-act=keyGroup]').forEach(button => button.setAttribute('aria-pressed',button === el));
  const tiles = root.querySelector('.kg-commands');
  tiles.dataset.group = guideGroup;
  tiles.innerHTML = drawCommands(guideGroup);
};
B.acts.keysHelp = () => B.sheet(B.keyboardGuide());
B.acts.settingsKeys = () => {
  const guide = B.$('.settings-page .key-guide');
  guide?.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});
  guide?.scrollIntoView({block:'start'});
};

function scopes(){
  if (dialogOpen()) return ['escape'];
  if (B.sheetOpen()){
    if (!B.$('.sheet .tw')) return B.$('.sheet form.entry-editor') ? ['escape','entryEditor'] : ['escape'];
    return ['escape','entryEditor','taskEditor', ...(['cal','color'].includes(B.twPopNow()) ? ['taskPicker'] : [])];
  }
  const [,page,tab] = location.hash.split('/');
  const result = ['escape','global'];
  if (page === 'tasks') result.push('planner', ...(onWeek() ? ['plannerGrid'] : []));
  if (page === 'calendar') result.push('calendar');
  if (page === 'board'){
    result.push('board');
    if (!tab || tab === 'live') result.push('boardLive');
    if (B.focus?.isStudio()) result.push('focus');
  }
  return result;
}

document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.getModifierState?.('AltGraph')) return;
  const code = event.code || event.key;
  if (code === 'Tab'){ pointerMode = false; return; }
  const primary = apple ? event.metaKey : event.ctrlKey;
  if (apple ? event.ctrlKey : event.metaKey) return;
  const combo = [primary && 'Mod',event.altKey && 'Alt',event.shiftKey && 'Shift',code].filter(Boolean).join('+');
  const typing = editable(event.target) || editable(document.activeElement);
  const active = scopes();
  const deleteKey = combo === 'Backspace' || combo === 'Delete';
  // WKWebView may navigate back on an unhandled Backspace, including a repeated
  // key after the first press rerenders and removes the hovered row.
  if (deleteKey && !typing && (active.includes('planner') || active.includes('calendar') || B.sheetOpen() || dialogOpen())) event.preventDefault();
  if (event.repeat || document.body.classList.contains('pl-dragging')) return;
  const cmd = commands.find(c => active.includes(c.scope) && c.combos.includes(combo));
  if (!cmd) return;
  const editingEscape = combo === 'Escape' && (B.sheetOpen() || dialogOpen());
  if (typing && !editingEscape && !(cmd.scope === 'entryEditor' && combo === 'Mod+Enter')) return;
  // Pressing Space/Enter on an actual control activates that control, even if
  // the pointer is still over a task or a focus timer is running.
  if ((combo === 'Space' || combo === 'Enter') && control(event.target)) return;
  if (cmd.run(event,code) !== false) event.preventDefault();
});
})();
