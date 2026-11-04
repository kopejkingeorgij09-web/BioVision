/* Зов леса: клавиши для компьютера. Буквы ловятся по физической клавише (e.code), поэтому работают и в русской раскладке.
   Полный список открывается по «?» и лежит в KEYS ниже, подсказка строится из него же. */
(function(){
const KEYS = [
  ['Везде', [
    ['⌥ ⇧', 'Задачи во весь экран: спрятать или показать меню'],
    ['1 … 6', 'Сегодня, Задачи, Привычки, Дневник, Чтение, Лес'],
    ['/', 'Поиск'],
    ['?', 'Эта подсказка'],
    ['⌘ Z  ·  ⌘ ⇧ Z', 'Отменить и повторить'],
    ['Esc', 'Закрыть окно или выйти из полноэкранного режима']
  ]],
  ['В планере', [
    ['←  ·  →', 'Прошлая и следующая неделя (в месяце месяц)'],
    ['T', 'Вернуться к сегодня'],
    ['W  ·  M  ·  S', 'Неделя, Месяц, ШАД'],
    ['N', 'Новая задача на сегодня']
  ]],
  ['Курсор на задаче', [
    ['Пробел', 'Отметить сделанной или снять отметку'],
    ['Enter', 'Открыть карточку'],
    ['⇧ ←  ·  ⇧ →', 'Перенести на день раньше или позже'],
    ['Delete', 'Удалить (в подсказке можно вернуть)']
  ]]
];
const SECTIONS = ['today', 'tasks', 'habits', 'journal', 'read', 'forest'];
const route = () => (location.hash || '#/today').replace(/^#\/?/, '').split('/')[0] || 'today';
const typing = () => { const a = document.activeElement; return a && (a.matches('input:not([type=checkbox]):not([type=radio]),textarea,select') || a.isContentEditable); };
const modal = () => B.sheetOpen() || !B.$('#dlgScrim').hidden;

function toggleWide(){
  if (route() !== 'tasks'){ if (!B.plWide) B.acts.plFull(); location.hash = '#/tasks'; return; }
  B.acts.plFull();
  B.toast(B.plWide ? 'Во весь экран · ⌥⇧ или Esc, чтобы вернуть меню' : 'Меню на месте', 1300);
}
B.acts.keysHelp = () => B.sheet(`<h2>Клавиши</h2>
  ${KEYS.map(([h, rows]) => `<h3 class="kh-h">${h}</h3><div class="kh">${rows.map(([k, d]) => `<div class="kh-r"><span class="kh-k">${k.split('  ·  ').map(x => `<kbd>${x}</kbd>`).join(' ')}</span><span>${d}</span></div>`).join('')}</div>`).join('')}
  <div class="row end"><button class="btn primary" data-act="closeSheet">Понятно</button></div>`);

/* ⌥⇧ без других клавиш: срабатывает, когда отпускаешь, если между нажатием и отпусканием не было другой клавиши */
let combo = false;
document.addEventListener('keydown', e => {
  if ((e.key === 'Alt' || e.key === 'Shift') && e.altKey && e.shiftKey && !e.metaKey && !e.ctrlKey) combo = true;
  else if (e.key !== 'Alt' && e.key !== 'Shift') combo = false;
}, true);
document.addEventListener('keyup', e => {
  if (!combo || (e.key !== 'Alt' && e.key !== 'Shift')) return;
  combo = false;
  if (typing() || modal()) return;
  e.preventDefault(); toggleWide();
}, true);
addEventListener('blur', () => { combo = false; });

document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat && !e.code.startsWith('Arrow')) return;
  if (e.defaultPrevented || typing()) return;
  const c = e.code, v = route();
  if (e.key === 'Escape'){
    if (!modal() && v === 'tasks' && B.plWide){ e.preventDefault(); B.acts.plFull(); }
    return;
  }
  if (modal()) return;
  if (c === 'Slash'){ e.preventDefault(); if (e.shiftKey) B.acts.keysHelp(); else location.hash = '#/search'; return; }
  if (/^Digit[1-6]$/.test(c) && !e.shiftKey){ e.preventDefault(); location.hash = '#/' + SECTIONS[+c.slice(5) - 1]; return; }
  if (v !== 'tasks' || !B.pl) return;
  const t = B.pl.hover() && B.task(B.pl.hover());
  if (t && !t.deleted){
    if (c === 'Space'){ e.preventDefault(); const before = B.calc().total; B.setDone(t, !t.done); const gain = B.calc().total - before; B.toast(!t.done && gain > 0 ? `<b class="pos">Готово</b> · <b class="pos">+${gain} XP</b>` : t.done ? 'Отметка снята' : 'Готово', 1200); return; }
    if (c === 'Enter'){ e.preventDefault(); B.openTask(t.id); return; }
    if (e.shiftKey && (c === 'ArrowLeft' || c === 'ArrowRight')){
      e.preventDefault();
      const to = B.add(t.due || B.today(), c === 'ArrowLeft' ? -1 : 1);
      B.pl.move(t, to); B.toast(`${B.esc(t.title || 'Задача')} → ${B.fmtW(to)}`, 1200); return;
    }
  }
  if (e.shiftKey) return;
  if (c === 'ArrowLeft' || c === 'ArrowRight'){ if (B.pl.view() === 'shad') return; e.preventDefault(); B.acts.plShift({dataset: {k: c === 'ArrowLeft' ? '-1' : '1'}}); return; }
  if (c === 'KeyT'){ e.preventDefault(); B.acts.plToday(); return; }
  const views = {KeyW: 'week', KeyM: 'month', KeyS: 'shad'};
  if (views[c]){ e.preventDefault(); if (B.pl.view() !== views[c]) B.acts.plView({dataset: {v: views[c]}}); return; }
  if (c === 'KeyN'){
    e.preventDefault();
    if (B.pl.view() === 'shad') B.acts.plView({dataset: {v: 'week'}});
    B.acts.plToday(); B.acts.plAdd({dataset: {d: B.today()}});
  }
});
})();
