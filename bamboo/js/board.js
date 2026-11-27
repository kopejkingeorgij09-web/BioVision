(function(){
const {esc, icon} = B;
const columns = [
  {id:'plan', title:'В планах', icon:'leaf'},
  {id:'active', title:'В работе', icon:'flame'},
  {id:'done', title:'Готово', icon:'check'}
];
const lane = id => columns.find(c => c.id === id);
const get = id => B.boardData.get(id);
const laneLabel = c => icon(c.icon) + '<span>' + c.title + '</span>';
let historyDate='', historyMonth='';

async function move(id,destination){
  const card=get(id);
  if(!card || !lane(destination) || card.lane===destination || !B.boardData.all().some(c=>c.id===id))return;
  if(card.source==='event' && card.lane==='done'){
    const workout=B.calData.workout({id:card.ref,on:card.on});
    if(workout && B.workoutText(workout)){
      if(!await B.confirm('Снять отметку тренировки и удалить её заметку?', 'Снять отметку',true))return;
      if(B.calData.workout({id:card.ref,on:card.on})!==workout || get(id)?.lane!==card.lane)return;
    }
  }
  B.historyToast('Колонка · '+lane(destination).title,()=>B.boardData.move(card,destination));
}
B.acts.boardCheck=el=>{
  const card=get(el.dataset.id);
  if(card)move(card.id,card.lane==='done'?'plan':'done');
};

function cardView(card,focused){
  const id = esc(card.id), title = esc(card.title);
  const steps = card.steps || [];
  return `<article class="bd-card${focused?' bd-in-focus':''}" data-board-card="${id}">
    <div class="bd-card-head">
      ${card.source==='phagi'?'':`<button type="button" class="bd-check" role="checkbox" aria-checked="${card.lane==='done'}"
        aria-label="${card.lane==='done'?'Снять отметку':'Завершить'} · ${title}" data-act="boardCheck" data-id="${id}">${icon('check')}</button>`}
      <button type="button" class="bd-card-title" data-act="boardEdit" data-id="${id}">${title}</button>
      <button type="button" class="icon-btn bd-handle" data-act="boardMoveMenu" data-id="${id}"
        aria-label="Переместить · ${title}" title="Переместить">${icon('grip')}</button>
    </div>
    ${card.context ? `<p class="bd-context">${icon('cal')}<span>${esc(card.context)}</span></p>` : ''}
    ${card.notes ? `<p class="bd-notes">${esc(card.notes)}</p>` : ''}
    ${steps.length ? `<ul class="bd-steps" aria-label="Шаги">${steps.map(s => `<li>
      <label><input type="checkbox" data-in="boardStep" data-card="${id}" data-id="${esc(s.id)}" ${s.done?'checked':''}>
      <span>${esc(s.title)}</span></label></li>`).join('')}</ul>` : ''}
    ${card.lane==='done'?'':`<button type="button" class="bd-start-focus" data-act="focusStartCard" data-id="${id}" aria-label="${focused?'Открыть фокус':'Запустить фокус'} · ${title}">
      ${icon(focused?'timer':'play')}${focused?'К таймеру':'Начать фокус'}</button>`}
  </article>`;
}
function historyRows(rows){
  return `<ul>${rows.map(c=>`<li>${icon('check')}<span><b>${esc(c.title)}</b>${c.context?`<small>${esc(c.context)}</small>`:''}</span>
    ${c.completedAt?`<time>${B.hm(c.completedAt)}</time>`:''}</li>`).join('')}</ul>`;
}
const completedCount=n=>n+' '+B.plural(n,'дело','дела','дел');
function historyView(){
  const today=B.today(), month=historyMonth || today.slice(0,7);
  const first=month+'-01', next=B.addMonth(first,1), gridStart=B.weekStart(first);
  const days=new Map();
  for(const row of B.boardData.completed()){
    if(!days.has(row.day))days.set(row.day,[]);
    days.get(row.day).push(row);
  }
  const dated=[...days.keys()].filter(d=>d && d.startsWith(month));
  const selected=historyDate || dated[0] || (month===today.slice(0,7)?today:first);
  const count=dated.reduce((n,d)=>n+days.get(d).length,0);
  const unknown=days.get('') || [];
  const monthTitle=B.parse(first).toLocaleDateString('ru-RU',{month:'long',year:'numeric'});
  const cellCount=Math.ceil(B.diff(gridStart,next)/7)*7;
  return `<section class="bd-history">
    <header class="bd-history-head"><div><h2>${esc(monthTitle)}</h2><p>${completedCount(count)} за месяц</p></div>
      <div class="bd-history-nav">
        <button class="icon-btn" data-act="boardHistoryMove" data-n="-1" aria-label="Предыдущий месяц">${icon('left')}</button>
        <button class="btn ghost sm" data-act="boardHistoryToday">Сегодня</button>
        <button class="icon-btn" data-act="boardHistoryMove" data-n="1" aria-label="Следующий месяц" ${month>=today.slice(0,7)?'disabled':''}>${icon('right')}</button>
        <input type="date" aria-label="Перейти к дате выполнения" data-in="boardDate" value="${selected}" max="${today}"></div></header>
    <div class="bd-month-layout"><div class="bd-month" role="group" aria-label="${esc(monthTitle)}">
      ${B.WD.map(label=>`<span class="bd-weekday">${label}</span>`).join('')}
      ${Array.from({length:cellCount},(_,i)=>{
        const d=B.add(gridStart,i);
        if(!d.startsWith(month))return '<span class="bd-pad" aria-hidden="true"></span>';
        const n=days.get(d)?.length || 0;
        return `<button class="bd-date" data-act="boardHistoryDay" data-day="${d}" aria-pressed="${d===selected}"
          aria-label="${B.fmtW(d)}, ${completedCount(n)}" ${d===today?'aria-current="date"':''} ${d>today?'disabled':''}>
          <strong>${Number(d.slice(8))}</strong>${n?`<span>${n}</span>`:''}</button>`;
      }).join('')}</div>
      <section class="bd-history-day" aria-live="polite"><h3>${B.fmtW(selected)}</h3>
        ${days.has(selected)?historyRows(days.get(selected)):'<p class="bd-empty">В этот день нет завершённых дел</p>'}</section>
    </div>
    ${unknown.length?`<details class="bd-history-day"><summary>Дата выполнения не сохранена <span class="bd-count">${unknown.length}</span></summary>${historyRows(unknown)}</details>`:''}
  </section>`;
}
function render(){
  const tab=location.hash.split('/')[2] || 'live', today=B.today();
  const cards=tab==='live'?B.boardData.all(today):[];
  const session=tab==='live'?B.focus.current()?.timer:null;
  const focused=session?.phase==='work' && B.focus.remaining(session,Date.now())>0?session.card:'';
  return `<div class="page bd-page ${tab==='focus'?'bd-focus-page':''}">
    ${tab==='focus'?'':`<header class="bd-header"><div><h1>${tab==='history'?'Завершённые дела':'Доска дел'}</h1>
      ${tab==='live'?`<p>Сегодня · ${B.fmtW(today)}</p>`:''}</div>
      ${tab==='live'?`<div class="bd-actions"><a class="btn" href="#/calendar">${icon('cal')} К календарю</a>
      <button class="btn primary" data-act="boardAdd" data-lane="plan">${icon('plus')} Новое дело</button></div>`:''}</header>`}
    <nav class="toggle bd-tabs" aria-label="Доска">${[['live','Дела'],['history','История'],['focus','Фокус']].map(([id,title])=>
      `<a href="#/board${id==='live'?'':'/'+id}" class="${tab===id?'on':''}" ${tab===id?'aria-current="page"':''}>${title}</a>`).join('')}</nav>
    ${tab==='focus' ? B.focus.render() : tab==='history' ? historyView() : `${B.focus.boardSession()}<div class="bd-grid">${columns.map(c=>{
      const items=cards.filter(item=>item.lane===c.id);
      return `<section class="bd-lane bd-${c.id}" data-board-lane="${c.id}" aria-labelledby="board-${c.id}">
        <header class="bd-lane-head"><div class="bd-lane-icon">${icon(c.icon)}</div>
          <h2 id="board-${c.id}">${c.title}</h2><span class="bd-count">${items.length}</span>
          <button class="icon-btn" data-act="boardAdd" data-lane="${c.id}" aria-label="Добавить дело · ${c.title}">${icon('plus')}</button></header>
        <div class="bd-stack">${items.length?items.map(item=>cardView(item,item.id===focused)).join(''):
          `<p class="bd-empty">${({plan:'Нет запланированных дел',active:'Нет дел в работе',done:'Пока нет завершённых дел'})[c.id]}</p>`}</div></section>`;
    }).join('')}</div>`}</div>`;
}
B.acts.boardAdd = el=>{
  const initial=lane(el.dataset.lane)?.id || 'plan', due=el.dataset.day || B.today();
  B.sheet(`<h2>Новое дело</h2><form id="board-editor" class="bd-form">
    <label class="field">Название<input name="title" required maxlength="240" autofocus></label>
    <label class="field">Колонка<select name="lane">${columns.map(c =>
      `<option value="${c.id}" ${c.id===initial?'selected':''}>${c.title}</option>`).join('')}</select></label>
    <label class="field">Заметка<textarea name="notes" rows="3" maxlength="10000"></textarea></label>
    <label class="field">Шаги<textarea name="steps" rows="3" maxlength="6000" placeholder="По одному шагу на строку"></textarea></label>
    <p class="bd-form-error" role="alert" hidden></p>
    <div class="row end"><button type="submit" class="btn primary">Сохранить</button></div></form>`);
  B.$('#board-editor').addEventListener('submit',ev=>{
    ev.preventDefault();
    const form=ev.currentTarget, f=form.elements, title=f.title.value.trim();
    if(!title){const msg=form.querySelector('.bd-form-error');msg.hidden=false;msg.textContent='Введи название дела.';f.title.focus();return;}
    const boardLane=f.lane.value, subs=f.steps.value.split('\n').map(t=>t.trim()).filter(Boolean).map(t=>({id:B.uid(),t,done:false}));
    const task=B.newTask({title,notes:f.notes.value.trim(),subs,due,boardLane});
    B.historyStep(()=>boardLane==='done'?B.setDone(task,true):B.saveTask(task));
    B.closeSheet();
  });
};
B.acts.boardEdit = el => {
  const c=get(el.dataset.id); if (!c) return;
  if(c.source==='shad')return B.acts.acShadPick({dataset:{id:c.ref,part:c.part}});
  if(c.source==='phagi')return window.open(B.phagiTask(c.ref),'_blank','noopener');
  if(c.source==='task') return B.openTask(c.ref);
  if(c.source==='event') return B.acts.acOpen({dataset:{k:'event',id:c.ref,on:c.on,start:c.start,end:c.end}});

};
function selectHistoryDate(date){
  historyDate=date;historyMonth=date.slice(0,7);B.render(true);
}
B.inputs.boardDate=(el,ev)=>{
  if(ev.type==='change' && B.calData.validDate(el.value) && el.value<=B.today())selectHistoryDate(el.value);
};
B.acts.boardHistoryDay=el=>{
  selectHistoryDate(el.dataset.day);
  B.$('.bd-date[aria-pressed=true]')?.focus({preventScroll:true});
};
B.acts.boardHistoryToday=()=>selectHistoryDate(B.today());
B.acts.boardHistoryMove=el=>{
  historyMonth=B.addMonth((historyMonth||B.today().slice(0,7))+'-01',Number(el.dataset.n)).slice(0,7);
  historyDate='';B.render(true);
  B.$('.bd-history-nav [data-n="'+el.dataset.n+'"]:not(:disabled)')?.focus({preventScroll:true});
};
B.inputs.boardStep = (el,ev)=>{
  if(ev.type!=='change')return;
  const c=get(el.dataset.card), t=c?.source==='task' && B.task(c.ref);
  if(t)B.historyStep(()=>B.saveTask({...t,subs:(t.subs || []).map(s=>s.id===el.dataset.id?{...s,done:el.checked,doneAt:el.checked?Date.now():null}:s)}));
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
    if (!card || ev.button !== 0 || !ev.isPrimary || ev.target.closest('.bd-steps,.bd-check,.bd-start-focus') ||
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
B.board = {move,choose,dropTray};
B.views.board = {title:'Доска дел', render, mount, unmount(){ cancelDrag?.(); }};
})();
