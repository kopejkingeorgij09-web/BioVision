/* Доска хранит собственные карточки. Календарь передаёт только снимок выбранной записи. */
(function(){
const {esc, icon} = B;
const columns = [
  {id:'plan', title:'В планах', icon:'leaf'},
  {id:'active', title:'В работе', icon:'flame'},
  {id:'done', title:'Готово', icon:'check'}
];
const lane = id => columns.find(c => c.id === id);
const key = id => 'board_' + id;
const get = id => B.get(key(id));
const save = card => B.put(key(card.id), card);
const laneLabel = c => icon(c.icon) + '<span>' + c.title + '</span>';

function newCard(values){
  const at = Date.now();
  return {id:B.uid(), title:'', notes:'', steps:[], lane:'plan', placed:at, ...values};
}
function copy(source, destination){
  if (!lane(destination) || !source?.title?.trim()) return false;
  const steps = (source.steps || []).filter(s => s.t).map(s => ({
    id:B.uid(), title:s.t, done:!!s.done
  }));
  B.historyToast('Скопировано на доску · ' + lane(destination).title, () => save(newCard({
    title:source.title, notes:source.notes || '', context:source.context || '', steps, lane:destination
  })));
  return true;
}
function move(id, destination){
  const card = get(id);
  if (!card || !lane(destination) || card.lane === destination) return;
  B.historyToast('Карточка перемещена · ' + lane(destination).title, () =>
    save({...card, lane:destination, placed:Date.now()}));
}

function cardView(card){
  const id = esc(card.id), title = esc(card.title);
  const steps = card.steps || [];
  return `<article class="bd-card" data-board-card="${id}">
    <div class="bd-card-head">
      <button type="button" class="bd-card-title" data-act="boardEdit" data-id="${id}">${title}</button>
      <button type="button" class="icon-btn bd-handle" data-act="boardMoveMenu" data-id="${id}"
        aria-label="Переместить · ${title}" title="Переместить">${icon('grip')}</button>
    </div>
    ${card.context ? `<p class="bd-context">${icon('cal')}<span>${esc(card.context)}</span></p>` : ''}
    ${card.notes ? `<p class="bd-notes">${esc(card.notes)}</p>` : ''}
    ${steps.length ? `<ul class="bd-steps" aria-label="Шаги">${steps.map(s => `<li>
      <label><input type="checkbox" data-in="boardStep" data-card="${id}" data-id="${esc(s.id)}" ${s.done?'checked':''}>
      <span>${esc(s.title)}</span></label></li>`).join('')}</ul>` : ''}
  </article>`;
}
function render(){
  const all = B.list('board_').sort((a,b) => b.placed - a.placed || a.id.localeCompare(b.id));
  return `<div class="page bd-page">
    <header class="bd-header">
      <div><h1>Доска дел</h1><p>Перетаскивай карточки между колонками и отмечай шаги.</p></div>
      <div class="bd-actions">
        <a class="btn" href="#/calendar">${icon('cal')} К календарю</a>
        <button type="button" class="btn primary" data-act="boardAdd" data-lane="plan">${icon('plus')} Новое дело</button>
      </div>
    </header>
    <div class="bd-grid">${columns.map(c => {
      const cards = all.filter(card => card.lane === c.id);
      return `<section class="bd-lane bd-${c.id}" data-board-lane="${c.id}" aria-labelledby="board-${c.id}">
        <header class="bd-lane-head">
          <div class="bd-lane-icon">${icon(c.icon)}</div>
          <h2 id="board-${c.id}">${c.title}</h2><span class="bd-count" aria-label="Карточек: ${cards.length}">${cards.length}</span>
          <button type="button" class="icon-btn" data-act="boardAdd" data-lane="${c.id}" aria-label="Добавить дело · ${c.title}" title="Добавить дело">${icon('plus')}</button>
        </header>
        <div class="bd-stack">${cards.length ? cards.map(cardView).join('') : '<p class="bd-empty">Перетащи сюда карточку</p>'}</div>
      </section>`;
    }).join('')}</div>
  </div>`;
}

function editor(card, creating = false){
  B.sheet(`<h2>${creating?'Новое дело':'Редактировать дело'}</h2>
    <form id="board-editor" class="bd-form">
      <label class="field">Название<input name="title" required maxlength="240" autofocus value="${esc(card.title)}"></label>
      <label class="field">Колонка<select name="lane">${columns.map(c =>
        `<option value="${c.id}" ${c.id===card.lane?'selected':''}>${c.title}</option>`).join('')}</select></label>
      <label class="field">Заметка<textarea name="notes" rows="3" maxlength="10000">${esc(card.notes)}</textarea></label>
      <label class="field">Шаги<textarea name="steps" rows="3" maxlength="6000" placeholder="По одному шагу на строку">${esc((card.steps || []).map(s=>s.title).join('\n'))}</textarea></label>
      <p class="bd-form-error" role="alert" hidden></p>
      <div class="row ${creating?'end':'between'}">
        ${creating?'':`<button type="button" class="btn ghost danger" data-act="boardDelete" data-id="${esc(card.id)}">${icon('trash')} Удалить</button>`}
        <button type="submit" class="btn primary">Сохранить</button>
      </div>
    </form>`);
  B.$('#board-editor').addEventListener('submit', ev => {
    ev.preventDefault();
    const form = ev.currentTarget, f = form.elements, title = f.title.value.trim();
    if (!title){
      const error = form.querySelector('.bd-form-error');
      error.hidden = false; error.textContent = 'Введи название дела.'; f.title.focus();
      return;
    }
    const current = creating ? card : get(card.id);
    if (!current) { B.closeSheet(); B.toast('Карточка уже удалена'); return; }
    const previous = (current.steps || []).slice();
    const steps = f.steps.value.split('\n').map(line=>line.trim()).filter(Boolean).map(title => {
      const index = previous.findIndex(step => step.title === title);
      return index < 0 ? {id:B.uid(), title, done:false} : previous.splice(index,1)[0];
    });
    const next = lane(f.lane.value)?.id || current.lane;
    const placed = next === current.lane ? current.placed : Date.now();
    B.historyStep(() => save({...current, title, notes:f.notes.value.trim(), steps, lane:next, placed}));
    B.closeSheet();
  });
}
B.acts.boardAdd = el => editor(newCard({lane:lane(el.dataset.lane)?.id || 'plan'}), true);
B.acts.boardEdit = el => { const card = get(el.dataset.id); if (card) editor(card); };
B.acts.boardDelete = async el => {
  const card = get(el.dataset.id);
  if (!card || !await B.confirm('Удалить «'+esc(card.title)+'» с доски?', 'Удалить', true)) return;
  B.closeSheet();
  if (get(card.id)) B.historyToast('Карточка удалена с доски', () => B.put(key(card.id), null));
};
B.inputs.boardStep = (el, ev) => {
  if (ev.type !== 'change') return;
  const card = get(el.dataset.card);
  if (!card?.steps.some(s => s.id === el.dataset.id)) return;
  B.historyStep(() => B.put(key(card.id), {...card,
    steps:card.steps.map(s => s.id === el.dataset.id ? {...s,done:el.checked} : s)
  }, true));
};
function choose(title, action, current){
  B.sheet(`<h2>${esc(title)}</h2><div class="bd-choices">${columns.map(c =>
    `<button type="button" class="btn bd-choice bd-${c.id}" data-board-choice="${c.id}" ${c.id===current?'disabled':''}>
     ${laneLabel(c)}</button>`).join('')}</div>`);
  B.$('.bd-choices').addEventListener('click', ev => {
    const option = ev.target.closest('[data-board-choice]');
    if (!option || option.disabled) return;
    B.closeSheet();
    action(option.dataset.boardChoice);
  });
}
B.acts.boardMoveMenu = el => {
  const card = get(el.dataset.id);
  if (card) choose('Переместить карточку', column => move(card.id,column), card.lane);
};

function dropTray(title){
  const tray = document.createElement('div');
  tray.className = 'bd-drop-tray';
  tray.setAttribute('aria-hidden', 'true');
  tray.innerHTML = `<div>${icon('board')} ${esc(title)}</div><div class="bd-drop-choices">${columns.map(c =>
    `<span class="bd-drop-slot bd-${c.id}" data-board-target="${c.id}">${laneLabel(c)}</span>`).join('')}</div>`;
  document.body.append(tray);
  let hit;
  return {
    target(x,y){
      hit?.classList.remove('bd-over');
      hit = document.elementFromPoint(x,y)?.closest('[data-board-target]');
      if (!hit || !tray.contains(hit)) { hit = null; return ''; }
      hit.classList.add('bd-over');
      return hit.dataset.boardTarget;
    },
    remove(){ tray.remove(); }
  };
}

let cancelDrag;
function mount(){
  const page = B.$('.bd-page');
  let blockClick = false;
  page.addEventListener('click', ev => {
    if (blockClick && ev.detail) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);
  page.addEventListener('pointerdown', ev => {
    const card = ev.target.closest('[data-board-card]');
    if (!card || ev.button !== 0 || !ev.isPrimary || ev.target.closest('.bd-steps') ||
        ev.pointerType === 'touch' && !ev.target.closest('.bd-handle')) return;
    cancelDrag?.();
    const controller = new AbortController(), {signal} = controller;
    const {pointerId, clientX, clientY} = ev;
    let floating, tray, over, target;
    const clear = () => {
      controller.abort(); floating?.remove(); tray?.remove();
      over?.classList.remove('bd-over'); card.classList.remove('bd-dragging');
      cancelDrag = null;
    };
    cancelDrag = clear;
    const track = e => {
      if (e.pointerId !== pointerId) return;
      if (!floating){
        if (Math.hypot(e.clientX-clientX,e.clientY-clientY) < 6) return;
        floating = document.createElement('span');
        floating.className = 'bd-float';
        floating.textContent = card.querySelector('.bd-card-title').textContent;
        document.body.append(floating);
        card.classList.add('bd-dragging');
        if (e.pointerType === 'touch') tray = dropTray('Переместить на доске');
      }
      floating.style.transform = `translate(${e.clientX+12}px,${e.clientY-25}px)`;
      over?.classList.remove('bd-over');
      over = document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-board-lane]');
      target = tray?.target(e.clientX,e.clientY) || over?.dataset.boardLane;
      over?.classList.add('bd-over');
    };
    window.addEventListener('pointermove', track, {signal});
    window.addEventListener('pointerup', e => {
      if (e.pointerId !== pointerId) return;
      if (floating) { track(e); blockClick = true; setTimeout(() => blockClick=false,0); }
      clear();
      if (target) move(card.dataset.boardCard,target);
    }, {signal});
    window.addEventListener('pointercancel', e => { if(e.pointerId===pointerId) clear(); }, {signal});
    window.addEventListener('keydown', e => { if(e.key==='Escape') clear(); }, {signal});
    window.addEventListener('blur', clear, {signal});
  });
}
B.board = {copy, choose, dropTray};
B.views.board = {title:'Доска дел', render, mount, unmount(){ cancelDrag?.(); }};
})();
