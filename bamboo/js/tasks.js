/* Режим бамбука: задачи. Проекты (Вуз по предметам, ШАД, Личное), списки с подзадачами и доска «Надо / В работе / Готово». */
(function(){
const {esc, icon} = B;
const LS_VIEW = 'bamboo-tasks-view';
let viewMode = {};
try { viewMode = JSON.parse(localStorage.getItem(LS_VIEW) || '{}') || {}; } catch (e) {}
const FILTERS = [
  ['today', 'Сегодня', 'today'],
  ['upcoming', 'Неделя', 'cal'],
  ['big', 'Большие дела', 'steps'],
  ['all', 'Все задачи', 'list']
];
B.COLORS = ['ink', 'blue', 'teal', 'green', 'amber', 'red', 'violet', 'pink'];
B.COLOR_NAMES = {ink: 'графит', blue: 'синий', teal: 'бирюза', green: 'зелёный', amber: 'янтарь', red: 'красный', violet: 'фиолет', pink: 'розовый'};

function projTree(){
  const ps = B.projects(), roots = ps.filter(p => !p.parent);
  const out = [];
  roots.forEach(r => { out.push({p: r, depth: 0}); ps.filter(c => c.parent === r.id).forEach(c => out.push({p: c, depth: 1})); });
  return out;
}
const childIds = id => [id].concat(B.projects().filter(p => p.parent === id).map(p => p.id));
function selTasks(key){
  const t = B.today(), all = B.tasks();
  if (key === 'today') return all.filter(x => x.due && x.due <= t && (!x.done || B.dayOf(x.doneAt || 0) === t));
  if (key === 'upcoming') return all.filter(x => x.due && x.due <= B.add(t, 7));
  if (key === 'big') return all.filter(x => x.big);
  if (key === 'all') return all;
  const ids = new Set(childIds(key));
  return all.filter(x => ids.has(x.proj));
}
const sortT = (a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999') || (a.pri || 4) - (b.pri || 4) || (a.time || '99').localeCompare(b.time || '99') || (a.created || 0) - (b.created || 0);

function listView(key, tasks){
  const t = B.today();
  const open = tasks.filter(x => !x.done).sort(sortT), done = tasks.filter(x => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const showProj = !B.proj(key) || B.projects().some(p => p.parent === key);
  let body = '';
  if (key === 'upcoming' || key === 'today'){
    const late = open.filter(x => x.due < t);
    if (late.length) body += `<div class="group late"><div class="group-h">Просрочено <span>${late.length}</span></div><div class="tasks">${late.map(x => B.taskRow(x)).join('')}</div></div>`;
    const days = key === 'today' ? [t] : Array.from({length: 8}, (_, i) => B.add(t, i));
    days.forEach(d => {
      const l = open.filter(x => x.due === d);
      const shad = B.shadOn(d);
      if (!l.length && !shad.length && key === 'upcoming' && d !== t) return;
      body += `<div class="group"><div class="group-h">${d === t ? 'Сегодня' : B.rel(d)} <span class="muted">${B.fmtW(d)}</span></div>
        <div class="tasks">${l.map(x => B.taskRow(x)).join('')}${shad.map(it => `<a class="shad-mini" href="#/cal/${d}"><span class="cchip c-${it.p.c}">${it.kind === 'web' ? '' : 'ДЗ · '}${esc(it.p.code)}</span>${esc(it.p.t)}<span class="mono muted">${it.from || (it.kind === 'hw' ? 'дедлайн' : '')}</span></a>`).join('')}
        ${!l.length && !shad.length ? '<p class="empty sm">Пусто</p>' : ''}</div></div>`;
    });
  } else {
    const withDue = open.filter(x => x.due), noDue = open.filter(x => !x.due);
    if (withDue.length) body += `<div class="group"><div class="group-h">Со сроком <span>${withDue.length}</span></div><div class="tasks">${withDue.map(x => B.taskRow(x, {proj: showProj})).join('')}</div></div>`;
    if (noDue.length) body += `<div class="group"><div class="group-h">Без срока <span>${noDue.length}</span></div><div class="tasks">${noDue.map(x => B.taskRow(x, {proj: showProj})).join('')}</div></div>`;
    if (!open.length) body += `<p class="empty">${key === 'big' ? 'Больших дел нет. Если что-то висит неделями, отметь его «большим делом» и разбей на шаги.' : 'Здесь пока пусто.'}</p>`;
  }
  if (done.length) body += `<details class="done-fold"><summary>Сделано: ${done.length}</summary><div class="tasks">${done.slice(0, 50).map(x => B.taskRow(x, {proj: showProj})).join('')}</div></details>`;
  return body;
}

function boardCard(t){
  const subs = t.subs || [], d = subs.filter(s => s.done).length;
  const st = t.status === 'done' || t.done ? 'done' : t.status || 'todo';
  return `<div class="bcard p${t.pri || 4}" draggable="true" data-tid="${t.id}">
    <button class="bcard-main" data-act="openTask" data-id="${t.id}">
      <span class="task-title">${esc(t.title)}</span>
      <span class="task-meta">${t.proj && t.proj !== 'inbox' ? `<span class="pchip c-${(B.proj(t.proj) || {}).color || 'ink'}">${esc(B.projName(t.proj))}</span>` : ''}${t.due ? B.dueLabel(t) : ''}${subs.length ? `<span class="subs">${icon('steps')}${d}/${subs.length}</span>` : ''}</span>
      ${subs.length ? B.bar(d / subs.length, 'thin') : ''}
    </button>
    <div class="bcard-act">
      ${st !== 'todo' ? `<button class="icon-btn sm" data-act="moveCol" data-id="${t.id}" data-to="${st === 'done' ? 'doing' : 'todo'}" title="Назад">${icon('left')}</button>` : '<span></span>'}
      ${st !== 'done' ? `<button class="icon-btn sm play" data-act="focusTask" data-id="${t.id}" title="Фокус">${icon('play')}</button>` : ''}
      ${st !== 'done' ? `<button class="icon-btn sm" data-act="moveCol" data-id="${t.id}" data-to="${st === 'todo' ? 'doing' : 'done'}" title="Дальше">${icon('right')}</button>` : '<span></span>'}
    </div>
  </div>`;
}
function boardView(tasks){
  const cols = [['todo', 'Надо'], ['doing', 'В работе'], ['done', 'Готово']];
  const t7 = Date.now() - 14 * 864e5;
  return `<div class="board">${cols.map(([k, l]) => {
    const list = tasks.filter(t => (t.done ? 'done' : t.status || 'todo') === k).filter(t => k !== 'done' || (t.doneAt || 0) > t7).sort(sortT);
    return `<div class="bcol" data-col="${k}"><div class="bcol-h"><b>${l}</b><span class="muted">${list.length}</span></div>
      <div class="bcol-body">${list.map(boardCard).join('') || '<p class="empty sm">Перетащи сюда</p>'}</div></div>`;
  }).join('')}</div>
  <p class="hint">Доска нужна для больших дел вроде «ДЗ по физике за семестр»: держи в работе не больше двух-трёх карточек, остальное ждёт в «Надо».</p>`;
}
B.acts.moveCol = el => setStatus(el.dataset.id, el.dataset.to);
function setStatus(id, to){
  const t = B.task(id); if (!t) return;
  if (to === 'done' && !t.done){ B.setDone(t, true); B.toast(`<b class="pos">Готово</b> ${esc(t.title)}`); return; }
  B.saveTask(Object.assign({}, t, {status: to, done: to === 'done', doneAt: to === 'done' ? t.doneAt : null}));
}

B.views.tasks = {
  title: 'Задачи',
  render(arg){
    let key = arg || (() => { try { return localStorage.getItem('bamboo-tasks-key') || 'today'; } catch (e) { return 'today'; } })();
    if (!FILTERS.some(f => f[0] === key) && !B.proj(key)) key = 'today';
    try { localStorage.setItem('bamboo-tasks-key', key); } catch (e) {}
    const p = B.proj(key), tasks = selTasks(key);
    const mode = p ? (viewMode[key] || 'list') : 'list';
    const count = k => selTasks(k).filter(x => !x.done).length;
    const side = `<nav class="pnav">
      ${FILTERS.map(([k, l, ic]) => `<a class="pnav-i ${k === key ? 'on' : ''}" href="#/tasks/${k}">${icon(ic)}<span>${l}</span><em>${count(k) || ''}</em></a>`).join('')}
      <div class="pnav-sep">Проекты</div>
      ${projTree().map(({p: q, depth}) => `<a class="pnav-i d${depth} ${q.id === key ? 'on' : ''}" href="#/tasks/${q.id}"><i class="dot c-${q.color || 'ink'}"></i><span>${esc(q.name)}</span><em>${count(q.id) || ''}</em></a>`).join('')}
      <button class="pnav-i add" data-act="projNew">${icon('plus')}<span>Проект или предмет</span></button>
    </nav>`;
    const title = p ? B.projName(key) : FILTERS.find(f => f[0] === key)[1];
    return `<div class="page tasks-page">
      <header class="page-h"><div><div class="eyebrow">Задачи</div><h1>${esc(title)}</h1></div>
        <div class="row">${p ? `<div class="toggle"><button class="${mode === 'list' ? 'on' : ''}" data-act="tmode" data-k="${key}" data-m="list">${icon('list')}Список</button><button class="${mode === 'board' ? 'on' : ''}" data-act="tmode" data-k="${key}" data-m="board">${icon('board')}Доска</button></div>
        <button class="icon-btn" data-act="projEdit" data-id="${key}" title="Настроить проект">${icon('gear')}</button>` : ''}</div>
      </header>
      <div class="tasks-layout">
        ${side}
        <div class="tasks-main">
          <div class="quick-add card">
            <div class="add-line"><input id="quickTask" placeholder="Новая задача${p ? ' в «' + esc(p.name) + '»' : ''}" data-enter="quickTask" data-k="${key}" autocomplete="off"><button class="btn primary" data-act="quickTask" data-k="${key}">${icon('plus')}</button></div>
            <p class="hint">${B.quickHint}</p>
          </div>
          ${mode === 'board' ? boardView(tasks) : listView(key, tasks)}
        </div>
      </div>
    </div>`;
  },
  mount(){
    B.$$('.bcard').forEach(c => c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.tid); c.classList.add('dragging'); }));
    B.$$('.bcard').forEach(c => c.addEventListener('dragend', () => c.classList.remove('dragging')));
    B.$$('.bcol').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) setStatus(id, col.dataset.col); });
    });
  }
};
B.acts.tmode = el => { viewMode[el.dataset.k] = el.dataset.m; try { localStorage.setItem(LS_VIEW, JSON.stringify(viewMode)); } catch (e) {} B.render(); };
B.acts.quickTask = el => {
  const inp = B.$('#quickTask'), v = inp.value.trim(); if (!v) return;
  const key = el.dataset.k, def = {};
  if (B.proj(key)) def.proj = key;
  if (key === 'today') def.due = B.today();
  if (key === 'big') def.big = true;
  const tk = B.addQuick(v, def);
  if (tk && key === 'big') B.updTask(tk.id, {big: true});
  if (tk) B.toast(`Добавлено: ${esc(tk.title)}${tk.proj !== 'inbox' ? ' · ' + esc(B.projName(tk.proj)) : ''}${tk.due ? ' · ' + B.rel(tk.due) : ''}`);
  setTimeout(() => { const i = B.$('#quickTask'); if (i) i.focus(); }, 30);
};

/* проекты */
function projForm(p){
  const roots = B.projects().filter(q => !q.parent && q.id !== (p && p.id) && q.id !== 'inbox');
  return `<h2>${p ? 'Проект' : 'Новый проект или предмет'}</h2>
    <label class="field">Название<input id="pName" value="${esc(p ? p.name : '')}" placeholder="Например, Органическая химия" autofocus></label>
    ${p && p.id === 'inbox' ? '' : `<label class="field">Внутри<select id="pParent"><option value="">Отдельный проект</option>${roots.map(r => `<option value="${r.id}" ${p && p.parent === r.id ? 'selected' : ''}>${esc(r.name)} (предмет)</option>`).join('')}</select></label>`}
    <div class="field">Цвет<div class="colors">${B.COLORS.map(c => `<label class="cpick c-${c}"><input type="radio" name="pColor" value="${c}" ${(p ? p.color : 'green') === c ? 'checked' : ''}><i></i><span>${B.COLOR_NAMES[c]}</span></label>`).join('')}</div></div>
    <div class="row between">${p && !['inbox'].includes(p.id) ? `<button class="btn ghost danger" data-act="projDel" data-id="${p.id}">${icon('trash')} В архив</button>` : '<span></span>'}
    <button class="btn primary" data-act="projSave" data-id="${p ? p.id : ''}">Сохранить</button></div>`;
}
B.acts.projNew = () => B.sheet(projForm(null));
B.acts.projEdit = el => B.sheet(projForm(B.proj(el.dataset.id)));
B.acts.projSave = el => {
  const name = B.$('#pName').value.trim(); if (!name) return;
  const parent = B.$('#pParent') ? B.$('#pParent').value : '';
  const color = (B.$('input[name=pColor]:checked') || {}).value || 'green';
  const id = el.dataset.id || B.uid();
  const old = B.proj(id) || {id, order: B.projects().length + 1};
  B.put('p_' + id, Object.assign({}, old, {name, parent: parent || undefined, color}));
  B.closeSheet(); location.hash = '#/tasks/' + id;
};
B.acts.projDel = async el => {
  const p = B.proj(el.dataset.id), n = B.tasks().filter(t => t.proj === p.id && !t.done).length;
  if (!(await B.confirm(`Убрать «${esc(p.name)}» в архив?${n ? ` Открытые задачи (${n}) переедут во «Входящие».` : ''}`, 'В архив', true))) return;
  B.tasks().filter(t => t.proj === p.id).forEach(t => B.saveTask(Object.assign({}, t, {proj: 'inbox'}), true));
  B.projects().filter(q => q.parent === p.id).forEach(q => B.put('p_' + q.id, Object.assign({}, q, {parent: undefined}), true));
  B.put('p_' + p.id, Object.assign({}, p, {arch: true}));
  B.closeSheet(); location.hash = '#/tasks/today';
};
})();
