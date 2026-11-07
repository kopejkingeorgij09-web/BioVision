/* «Задачи → Календарь». События живут только здесь, задачи берутся из общего планера. */
(function(){
const {esc, icon, add, diff, fmt, parse, ymd} = B;
const C = B.calData;
const MODES = {day: 'День', week: 'Неделя', month: 'Месяц', year: 'Год'};
const FREQ = {daily: 'Дни', weekly: 'Недели', monthly: 'Месяцы', yearly: 'Годы'};
const today = () => ymd(new Date());
const days = (d,n) => Array.from({length:n}, (_,i) => add(d,i));
const hour = 60;
const dragStep = 5;
let dragging = false, redrawAfterDrag = false;
const snap = n => Math.round(n / dragStep) * dragStep;
const monthStart = d => d.slice(0,7) + '-01';
const moveMonth = (d,n) => ymd(new Date(parse(d).getFullYear(),parse(d).getMonth()+n,1,12));
const monthTitle = d => B.MONF[parse(d).getMonth()] + ' ' + d.slice(0,4);
const labels = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const prefsKey = 'bamboo-calendar';
let prefs = {};
try { prefs = JSON.parse(localStorage.getItem(prefsKey) || '{}') || {}; } catch (_) {}
let mode = Object.hasOwn(MODES,prefs.mode) ? prefs.mode : (innerWidth < 650 ? 'day' : 'week');
let date = today(), side = prefs.side ?? innerWidth >= 950;
let scroll = null, scrollLeft = 0, draggedAt = 0, editContext = null;
const hidden = new Set(Array.isArray(prefs.hidden) ? prefs.hidden : []);
const projects = () => B.projects();
const projectOf = e => {
  const p = B.proj(e.proj || 'inbox');
  return p && !p.arch ? p.id : 'inbox';
};
const savePrefs = () => {
  try { localStorage.setItem(prefsKey, JSON.stringify({mode,side,hidden:[...hidden]})); } catch (_) {}
};
const visible = key => !hidden.has(key);
const save = e => B.put('e_' + e.id, e);
const get = id => B.get('e_' + id);
const getFile = id => B.get('ef_' + id);
function pruneFiles(ids){
  if(!ids?.length)return;
  const referenced = new Set(C.events().flatMap(e=>e.attachments||[]));
  ids.filter(id=>!referenced.has(id)).forEach(id=>B.put('ef_'+id,null));
}
const ranges = () => {
  if (mode === 'day') return [date, date];
  if (mode === 'week'){ const d = B.weekStart(date); return [d, add(d,6)]; }
  if (mode === 'year') return [date.slice(0,4)+'-01-01',date.slice(0,4)+'-12-31'];
  const d = B.weekStart(monthStart(date)); return [d,add(d,41)];
};

function taskItem(t,d,ghost=false){
  const start = t.time ? d+'T'+t.time : d;
  return {kind:'task', id:t.id, proj:projectOf(t), title:t.title, start, on:d, done:t.done, ghost,
    end:t.time ? C.at(d,C.minuteOf(start) + Math.max(dragStep,t.est || 30)) : add(d,1)};
}
function itemsBetween(from,to){
  const items = C.events().filter(e => visible(projectOf(e))).flatMap(e =>
    C.occurrences(e,from,to).map(x => ({...x,kind:'event',proj:projectOf(x)})));
  const inView = e => e.start<add(to,1)&&e.end>(e.end.length===10?from:from+'T00:00');
  B.tasks().forEach(t => {
    if (!C.validDate(t.due) || t.due > to || !visible(projectOf(t)) || !visible('@tasks')) return;
    const item=taskItem(t,t.due);
    if (inView(item)) items.push(item);
    if (!t.rep || t.done) return;
    for (let d=B.nextRep(t.due,t.rep), i=0; d && d<=to && i<5000; d=B.nextRep(d,t.rep), i++){
      if (d>=from) items.push(taskItem(t,d,true));
    }
  });
  if (visible('@shad')) for (const p of B.shad.plan){
    for(const [part,slot,placed,stage] of [['web',p.w,p.wp,2],['hw',p.h,p.hp,3]]){
      if(!placed||!C.validDate(slot?.date))continue;
      const d=slot.date, start=slot.from?d+'T'+slot.from:d;
      const end=slot.from&&slot.to ? (slot.endDate||(slot.to>slot.from?d:add(d,1)))+'T'+slot.to :
        slot.from?C.at(d,C.minuteOf(start)+60):add(d,1);
      const item={kind:'shad',id:p.n,part,start,end,on:d,proj:'@shad',
        title:(part==='hw'?'ДЗ · ':'')+p.t,done:B.shadStage(p.n)>=stage};
      if(inView(item))items.push(item);
    }
  }
  if (visible('@phagi')) for (let d=from; d<=to; d=add(d,1)){
    for (const it of B.phxOn(d).filter(x=>!x.shad||x.fix)){
      items.push({kind:'phagi',id:it.id,title:it.t,start:d,end:add(d,1),on:d,proj:'@phagi',done:it.done});
    }
  }
  return items.sort((a,b)=>a.start.localeCompare(b.start)||String(a.title).localeCompare(String(b.title),'ru'));
}
function eachDay(items,from,to){
  const index = new Map();
  for (const item of items){
    const first = C.dateOf(item.start), end = C.dateOf(item.end);
    for (let d = first > from ? first : from; d <= end && d <= to; d = add(d,1)){
      if (d === end && C.minuteOf(item.end) === 0) break;
      if (!index.has(d)) index.set(d,[]);
      index.get(d).push(item);
    }
  }
  return index;
}
const color = proj => proj === '@shad' ? 'blue' : proj === '@phagi' ? 'violet' : B.proj(proj)?.color || 'ink';
const phagiHref = id => B.phagiTask ? B.phagiTask(id) : B.PHAGI;
function chip(e,style='',segment=null){
  const attrs = `data-k="${e.kind}" data-id="${esc(e.id)}" data-on="${esc(e.on)}" data-start="${e.start}" data-end="${e.end}" data-part="${esc(e.part || '')}"`;
  const timed = !!segment;
  const title = esc(e.title || 'Без названия');
  const interval = timed ? `${e.start.slice(11)}–${e.end.slice(11)}` : '';
  const task = e.kind==='task' && !e.ghost;
  const movable=task||e.kind==='event'||e.kind==='shad';
  const contents = `<span class="ac-title">${title}${e.repeat ? '<span aria-label="Повторяется"> ↻</span>' : ''}</span>${timed ? `<small>${interval}${e.location ? ' · '+esc(e.location) : ''}</small>` : ''}`;
  return `<div class="ac-item c-${esc(color(e.proj))}${timed?' timed':''}${e.done?' done':''}${e.ghost?' ghost':''}" ${attrs} ${style? `style="${style}"` : ''}>
    ${task ? `<button class="ac-check" data-act="toggleTask" data-id="${esc(e.id)}" aria-label="${e.done?'Вернуть задачу':'Выполнить задачу'}" aria-pressed="${!!e.done}">${e.done?'✓':'○'}</button>` : ''}
    ${e.kind==='phagi' ? `<a class="ac-open" href="${esc(phagiHref(e.id))}" title="${title}">${contents}</a>` :
      `<button class="ac-open" data-act="acOpen" ${attrs} title="${title}">${contents}</button>`}
    ${timed && movable && segment.last ? '<span class="ac-resize end" data-resize="end" aria-hidden="true"></span>' : ''}
    ${timed && movable && segment.first ? '<span class="ac-resize start" data-resize="start" aria-hidden="true"></span>' : ''}
    ${movable && (!timed || segment.first) ? '<span class="ac-grab" title="Перенести запись" aria-hidden="true">⠿</span>' : ''}
  </div>`;
}

function monthGrid(d,counts,mini=false){
  const start = B.weekStart(monthStart(d)), month = d.slice(0,7);
  const monthDays = days(start,42);
  return `<div class="ac-mini ${mini?'mini':''}"><div class="ac-mini-labels">${labels.map(s=>`<span>${s}</span>`).join('')}</div>
    <div class="ac-mini-days">${monthDays.map(x=>{
      const other=x.slice(0,7)!==month;
      if (!mini && other) return '<span></span>';
      return `<button class="${x===today()?'now ':''}${x===date?'selected ':''}${other?'other ':''}${counts?.get(x)?.length?'has':''}"
        data-act="${mini?'acPick':'acDay'}" data-d="${x}" title="${esc(fmt(x))}" ${x===date?'aria-current="date"':''}>${+x.slice(8)}</button>`;
    }).join('')}</div></div>`;
}
function sidebar(counts){
  const filters = [...projects(),{id:'@tasks',name:'Задачи'},{id:'@shad',name:'ШАД'},{id:'@phagi',name:'Фаги'}];
  return `<aside class="ac-side" aria-label="Список календарей">
    <div class="ac-mini-title"><b>${monthTitle(date)}</b>
      <button class="icon-btn" data-act="acMiniMove" data-n="-1" aria-label="Предыдущий месяц">${icon('left')}</button>
      <button class="icon-btn" data-act="acMiniMove" data-n="1" aria-label="Следующий месяц">${icon('right')}</button></div>
    ${monthGrid(date,counts,true)}
    <div class="ac-filter-title"><b>Календари</b><button class="icon-btn" data-act="projNew" aria-label="Добавить календарь">${icon('plus')}</button></div>
    ${filters.map(p=>`<div class="ac-filter"><label class="c-${esc(color(p.id))}"><input type="checkbox" data-in="acFilter" data-id="${esc(p.id)}" ${visible(p.id)?'checked':''}>${esc(p.name)}</label>
      ${p.id.startsWith('@')?'':`<button class="icon-btn" data-act="projEdit" data-id="${esc(p.id)}" aria-label="Настроить ${esc(p.name)}">${icon('gear')}</button>`}</div>`).join('')}
    <div class="ac-file-tools">
      <button class="btn ghost sm" data-act="acImport">Импорт .ics</button>
      <button class="btn ghost sm" data-act="acExport">Экспорт .ics</button></div>
  </aside>`;
}
function allDay(ds,byDay){
  return `<div class="ac-all"><span class="ac-axis-label">Весь день</span>${ds.map(d=>
    `<div class="ac-allday ${d===today()?'now':''}" data-all="${d}">${(byDay.get(d)||[]).filter(e=>e.start.length===10).map(e=>chip(e)).join('')}
      <button class="ac-all-new" data-act="acNewDay" data-d="${d}" title="Добавить на весь день" aria-label="Добавить на ${esc(fmt(d))}">${icon('plus')}</button></div>`
  ).join('')}</div>`;
}
function layoutTimed(items,d){
  const segments = items.filter(e=>e.start.length>10).map(e=>({e,
    start:C.dateOf(e.start)===d ? C.minuteOf(e.start) : 0,
    end:C.dateOf(e.end)===d ? C.minuteOf(e.end) : C.DAY,
    first:C.dateOf(e.start)===d,last:C.dateOf(e.end)===d || (e.end===add(d,1)+'T00:00')
  })).sort((a,b)=>a.start-b.start||b.end-a.end);
  const groups=[]; let group=null;
  for (const s of segments){
    if (!group || s.start >= group.until){ group={until:0,lanes:[],segments:[]}; groups.push(group); }
    let col=group.lanes.findIndex(t=>t<=s.start);
    if (col<0) col=group.lanes.length;
    group.lanes[col]=s.end; group.until=Math.max(group.until,s.end); group.segments.push({...s,col});
  }
  return groups.flatMap(g=>g.segments.map(s=>({...s,cols:g.lanes.length})));
}
function timeGrid(ds,byDay){
  const now = new Date(), current = now.getHours()*hour+now.getMinutes();
  return `<div class="ac-time" style="--ac-days:${ds.length}">
    <div class="ac-sticky">
      <div class="ac-head"><span></span>${ds.map(d=>`<button data-act="acDay" data-d="${d}" class="${d===today()?'now':''}">
        <span>${labels[B.wd(d)]}</span> <b>${+d.slice(8)}</b></button>`).join('')}</div>
      ${allDay(ds,byDay)}
    </div>
    <div class="ac-hours"><div class="ac-axis">${Array.from({length:24},(_,i)=>`<span style="top:${i*100/24}%">${B.pad(i)}:00</span>`).join('')}</div>
      ${ds.map(d=>`<div class="ac-col ${d===today()?'now':''}" data-col="${d}" aria-label="${esc(fmt(d))}">
        ${layoutTimed(byDay.get(d)||[],d).map(s=>{
          const pos=`--top:${s.start/C.DAY*100}%;--span:${(s.end-s.start)/C.DAY*100}%;--left:${s.col/s.cols*100}%;--width:${100/s.cols}%`;
          const travel=s.first ? Math.min(s.start,s.e.travel||0) : 0;
          return (travel ? `<span class="ac-travel" title="Время в пути" style="top:${(s.start-travel)/C.DAY*100}%;height:${travel/C.DAY*100}%"></span>`:'')+chip(s.e,pos,s);
        }).join('')}
        ${d===today()?`<span class="ac-now" style="top:${current/C.DAY*100}%" aria-hidden="true"></span>`:''}
      </div>`).join('')}
    </div></div>`;
}
function monthView(ds,byDay){
  return `<div class="ac-month"><div class="ac-month-labels">${labels.map(l=>`<span>${l}</span>`).join('')}</div><div class="ac-month-days">
    ${ds.map(d=>{ const list=byDay.get(d)||[];
      return `<section class="ac-month-day ${d.slice(0,7)!==date.slice(0,7)?'other':''}" data-all="${d}">
        <button data-act="acDay" data-d="${d}" class="${d===today()?'now':''}" aria-label="${esc(fmt(d))}">${+d.slice(8)}</button>
        ${list.slice(0,3).map(e=>chip(e)).join('')}
        ${list.length>3?`<button class="ac-more" data-act="acDay" data-d="${d}">Ещё ${list.length-3}</button>`:''}
      </section>`;
    }).join('')}</div></div>`;
}
function yearView(byDay){
  return `<div class="ac-year">${Array.from({length:12},(_,i)=>{
    const d=date.slice(0,4)+'-'+B.pad(i+1)+'-01';
    return `<section><button data-act="acMonth" data-d="${d}">${B.MONF[i]}</button>${monthGrid(d,byDay)}</section>`;
  }).join('')}</div>`;
}
function render(toggle){
  const [from,to]=ranges(), byDay=eachDay(itemsBetween(from,to),from,to), ds=days(from,diff(from,to)+1);
  const title = mode==='year' ? date.slice(0,4)+' г.' : mode==='day' ? fmt(date)+' '+date.slice(0,4)+' г.' : monthTitle(date)+' г.';
  return `<div class="page planner ac" data-cal-mode="${mode}">
    <header class="ac-top">${toggle}<div class="ac-top-tools">
      <button class="icon-btn" data-act="plFull" aria-label="Полноэкранный календарь" aria-pressed="${!!B.plWide}">${icon(B.plWide?'shrink':'expand')}</button>
      <button class="icon-btn" data-act="acSearch" aria-label="Поиск по календарю">${icon('search')}</button></div>
    </header>
    <div class="ac-shell ${side?'with-side':''}">${side?sidebar(byDay):''}
      <div class="ac-main">
        <div class="ac-toolbar">
          <div class="ac-controls"><button class="icon-btn" data-act="acSidebar" aria-label="Список календарей" aria-pressed="${side}">${icon('list')}</button>
            <button class="icon-btn ac-add" data-act="acAdd" aria-label="Добавить событие или задачу" title="Добавить (N)">${icon('plus')}</button>
            <button class="icon-btn" data-act="acGoto" aria-label="Перейти к дате">${icon('cal')}</button></div>
          <div class="ac-modes" role="group" aria-label="Вид календаря">${Object.entries(MODES).map(([k,v])=>`<button data-act="acMode" data-v="${k}" aria-pressed="${mode===k}">${v}</button>`).join('')}</div>
          <div class="ac-nav"><button class="icon-btn" data-act="acShift" data-n="-1" aria-label="Назад">${icon('left')}</button>
            <button class="btn ghost sm" data-act="acToday">Сегодня</button>
            <button class="icon-btn" data-act="acShift" data-n="1" aria-label="Вперёд">${icon('right')}</button></div>
        </div>
        <h1>${esc(title)}</h1>
        <div class="ac-scroll">${mode==='day'||mode==='week'?timeGrid(ds,byDay):mode==='month'?monthView(ds,byDay):yearView(byDay)}</div>
      </div>
    </div>
  </div>`;
}
function change(d,m=mode,reset=false){
  if (!C.validDate(d)) return;
  date=d; mode=m;
  if (reset){ scroll=null; scrollLeft=0; }
  savePrefs(); B.render(true);
}
B.acts.acSidebar=()=>{side=!side;savePrefs();B.render(true)};
B.acts.acMode=el=>change(date,el.dataset.v,true);
B.acts.acPick=el=>change(el.dataset.d,mode);
B.acts.acDay=el=>change(el.dataset.d,'day',true);
B.acts.acMonth=el=>change(el.dataset.d,'month',true);
B.acts.acToday=()=>change(today(),mode,true);
B.acts.acMiniMove=el=>change(moveMonth(date,+el.dataset.n));
B.acts.acShift=el=>{
  const n=+el.dataset.n;
  change(mode==='day'||mode==='week'?add(date,n*(mode==='week'?7:1)):moveMonth(date,n*(mode==='year'?12:1)));
};
B.inputs.acFilter=(el,e)=>{
  if(e.type!=='change')return;
  if(el.checked) hidden.delete(el.dataset.id); else hidden.add(el.dataset.id);
  savePrefs(); B.render(true);
};
B.acts.acGoto=()=>{
  B.sheet(`<h2>Перейти к дате</h2><form id="acJump"><label class="field">Дата<input type="date" name="date" value="${date}" required></label>
    <div class="row end"><button class="btn primary" type="submit">Перейти</button></div></form>`);
  B.$('#acJump').addEventListener('submit',e=>{e.preventDefault(); const d=e.target.elements.date.value; if(C.validDate(d)){B.closeSheet();change(d);} });
};
function newDraft(start, end){
  return {start,end,title:'',proj:projects().find(p=>visible(p.id))?.id||'inbox',alerts:[]};
}
function newTimed(d, minute=9*hour, endMinute=minute+hour){
  return newDraft(C.at(d,minute),C.at(d,endMinute));
}
function newAll(d,end=add(d,1)){ return newDraft(d,end); }
const allDayOf = e => e.start.length===10;
const option=(v,label,selected)=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(label)}</option>`;
const projectOptions = e => projects().map(p=>option(p.id,B.projName(p.id),projectOf(e))).join('');
const scopeOptions = () => option('one','Это событие','one')+option('future','Это и будущие','one')+option('all','Вся серия','one');
const near = el => {
  const box=el.getBoundingClientRect();
  return {x:box.right,y:box.top};
};
function intervalLabel(e,task){
  const first=C.dateOf(e.start), last=allDayOf(e)?add(e.end,-1):C.dateOf(e.end);
  if(allDayOf(e)) return (first===last||task?fmt(first):fmt(first)+' – '+fmt(last))+' · Весь день';
  return fmt(first)+', '+e.start.slice(11)+(task?'':' – '+(first===last?'':fmt(last)+', ')+e.end.slice(11));
}
function markDraft(e,task){
  document.querySelectorAll('.ac-draft').forEach(el=>el.remove());
  const d=C.dateOf(e.start), all=allDayOf(e);
  const cell=B.$(all?`[data-all="${d}"]`:`[data-col="${d}"]`);
  if(!cell)return;
  const mark=document.createElement('span');
  mark.className='ac-draft '+(all?'all':'timed');
  mark.textContent=e.title||(task?'Новая задача':'Новое событие');
  if(!all){
    const start=C.minuteOf(e.start), end=C.dateOf(e.end)===d?C.minuteOf(e.end):C.DAY;
    mark.style.top=start/C.DAY*100+'%';
    mark.style.height=Math.max(dragStep,end-start)/C.DAY*100+'%';
  }
  cell.append(mark);
}
function editor(e, original=null, task=false, anchor=null, selected=false){
  editContext={e,original,task,anchor,selected};
  const r=e.repeat||{}, active=!!r.freq, spanStart=C.dateOf(e.start);
  const monthly = r.freq==='monthly'||r.freq==='yearly', pattern = r.days?.length&&monthly?'weekdays':'dates';
  const floating=!!anchor&&matchMedia('(min-width: 700px) and (pointer: fine)').matches;
  B.sheet(`<h2 class="ac-card-title">Календарь</h2>
    <form id="acEditor" class="ac-editor ac-quick ${floating?'ac-floating':''}">
      ${original?'':`<div class="ac-modes ac-types" role="group" aria-label="Тип записи"><button type="button" data-act="acType" data-v="event" aria-pressed="${!task}">Событие</button><button type="button" data-act="acType" data-v="task" aria-pressed="${task}">Задача</button></div>`}
      <input aria-label="Название" class="ac-quick-name" name="title" value="${esc(e.title)}" placeholder="${task?'Новая задача':'Новое событие'}" maxlength="240" required autofocus>
      <p class="ac-interval">${esc(intervalLabel(e,task))}</p>
      <label class="ac-project c-${esc(color(projectOf(e)))}"><span class="ac-project-dot" aria-hidden="true"></span>
        <select name="project" aria-label="Календарь">${projectOptions(e)}</select></label>
      ${original?.repeat?`<label class="field">Изменить<select name="scope">${scopeOptions()}</select></label>`:''}
      <details class="ac-extra"><summary>Подробности</summary><div>
      ${task?'':`      <label class="field">Повтор<select name="frequency">${option('','Никогда',r.freq||'')}${Object.entries(FREQ).map(([k,v])=>option(k,v,r.freq)).join('')}</select></label>
      <div class="ac-repeat" ${active?'':'hidden'}>
        <div class="ac-edit-row">
          <label class="field">Интервал<input type="number" name="every" value="${r.every||1}" min="1" max="365"></label>
          <label class="field">Конец повтора<select name="repeatEnd">${option('','Никогда','')}${option('until','В дату',r.until?'until':'')}${option('count','После N событий',r.count?'count':'')}</select></label>
        </div>
        <div class="ac-month-pattern" ${monthly?'':'hidden'}>
          <label class="field">По какому правилу<select name="monthPattern">${option('dates','По числам месяца',pattern)}${option('weekdays','По дням недели',pattern)}</select></label>
          <label class="field ac-month-dates" ${pattern==='dates'?'':'hidden'}>Числа месяца<input name="monthDays" placeholder="Например, 1, 15, −1" value="${esc((r.monthDays||[]).join(', '))}"><small>−1 означает последний день. Пусто — число начала.</small></label>
          <label class="field ac-month-position" ${pattern==='weekdays'?'':'hidden'}>Порядок<select name="position">
            ${[[0,'Каждый'],[1,'Первый'],[2,'Второй'],[3,'Третий'],[4,'Четвёртый'],[5,'Пятый'],[-1,'Последний'],[-2,'Предпоследний']].map(([v,l])=>option(v,l,r.pos||0)).join('')}</select></label>
        </div>
        <fieldset class="ac-weekdays" ${r.freq==='weekly'||pattern==='weekdays'?'':'hidden'}><legend>Дни недели</legend>
          ${labels.map((l,i)=>`<label><input type="checkbox" name="weekdays" value="${i}" ${(r.days?.length?r.days:[B.wd(spanStart)]).includes(i)?'checked':''}>${l}</label>`).join('')}</fieldset>
        <label class="field ac-repeat-date" ${r.until?'':'hidden'}>Последняя дата<input type="date" name="until" value="${r.until||''}"></label>
        <label class="field ac-repeat-count" ${r.count?'':'hidden'}>Число событий<input type="number" name="count" value="${r.count||10}" min="1" max="10000"></label>
      </div>
      <div class="ac-edit-row">
        <label class="field">Место<input name="place" value="${esc(e.location||'')}" maxlength="240"></label>
        <label class="field">Время в пути, мин<input type="number" name="travel" min="0" max="1440" value="${e.travel||0}"></label>
      </div>
      <label class="field">Ссылка<input name="url" type="url" value="${esc(e.url||'')}" placeholder="https://"></label>
      ${/^https?:\/\//i.test(e.url||'')?`<a class="link" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Открыть ссылку</a>`:''}
      <label class="field">Вложения<input type="file" name="files" multiple><small>До 700 КБ на файл, фотографии сжимаются.</small></label>
      ${(e.attachments||[]).map(getFile).filter(f=>f?.data?.startsWith('data:')).map(f=>
        `<div class="ac-attachment"><a href="${esc(f.data)}" download="${esc(f.name)}">${esc(f.name)}</a>
          <label><input type="checkbox" name="detach" value="${esc(f.id)}"> Убрать</label></div>`).join('')}`}
      <label class="field">Заметки<textarea name="notes" rows="2" maxlength="10000">${esc(e.notes||'')}</textarea></label>
      </div></details>
      <p class="ac-error" role="alert" hidden></p>
      <div class="row between">${original?`<div class="row"><button type="button" class="btn danger ghost sm" data-act="acDelete">Удалить</button><button type="button" class="btn ghost sm" data-act="acDuplicate">Дублировать</button></div>`:'<span></span>'}
        <button type="submit" class="btn primary">Сохранить</button></div>
    </form>`,()=>{
      editContext=null;
      document.querySelectorAll('.ac-draft').forEach(el=>el.remove());
    });
  const form=B.$('#acEditor'), sheet=B.$('#sheet');
  if(floating){
    const width=sheet.offsetWidth, height=sheet.offsetHeight;
    const left=anchor.x+width+16<=innerWidth?anchor.x+10:anchor.x-width-10;
    sheet.style.setProperty('--ac-pop-left',B.clamp(left,8,innerWidth-width-8)+'px');
    sheet.style.setProperty('--ac-pop-top',B.clamp(anchor.y-20,8,Math.max(8,innerHeight-height-8))+'px');
  }
  if(selected)markDraft(e,task);
  form.addEventListener('change',ev=>{
    const f=form.elements;
    if(ev.target===f.project) form.querySelector('.ac-project').className='ac-project c-'+color(f.project.value);
    if (!task){
      form.querySelector('.ac-repeat').hidden=!f.frequency.value;
      const m=f.frequency.value==='monthly'||f.frequency.value==='yearly', w=f.monthPattern.value==='weekdays';
      form.querySelector('.ac-month-pattern').hidden=!m;
      form.querySelector('.ac-month-dates').hidden=w;
      form.querySelector('.ac-month-position').hidden=!w;
      form.querySelector('.ac-weekdays').hidden=f.frequency.value!=='weekly'&&!(m&&w);
      form.querySelector('.ac-repeat-date').hidden=f.repeatEnd.value!=='until';
      form.querySelector('.ac-repeat-count').hidden=f.repeatEnd.value!=='count';
    }
  });
  form.addEventListener('submit',ev=>{ev.preventDefault();submitEditor(form);});
}
function draftFrom(form,ctx){
  const f=form.elements, {start,end}=ctx.e;
  if (!C.valid(start)||!C.valid(end)||end<=start) throw Error('Конец должен быть позже начала.');
  const draft={title:f.title.value.trim(),proj:f.project.value||'inbox',start,end,notes:f.notes.value.trim()};
  if (!draft.title) throw Error('Введи название.');
  if (ctx.task) return draft;
  const freq=f.frequency.value, until=f.repeatEnd.value==='until'?f.until.value:'';
  if (freq && f.repeatEnd.value==='until' && (!C.validDate(until)||until<C.dateOf(start))) throw Error('Выбери дату окончания повтора после начала.');
  if (f.url.value && !/^https?:\/\//i.test(f.url.value)) throw Error('Ссылка должна начинаться с http:// или https://.');
  const m=freq==='monthly'||freq==='yearly', weekdays=m&&f.monthPattern.value==='weekdays';
  const monthDays=m&&!weekdays&&f.monthDays.value.trim()?f.monthDays.value.replace(/−/g,'-').split(',').map(Number):[];
  if(monthDays.some(n=>!Number.isInteger(n)||!n||Math.abs(n)>31)) throw Error('Числа месяца должны быть от 1 до 31, отрицательные считаются с конца.');
  const weekDays=freq==='weekly'||weekdays?Array.from(f.weekdays).filter(x=>x.checked).map(x=>Number(x.value)):[];
  if(weekdays&&!weekDays.length) throw Error('Выбери хотя бы один день недели.');
  const repeat=freq?{freq,every:Number(f.every.value)||1,until,count:f.repeatEnd.value==='count'?Number(f.count.value)||1:0,
    days:weekDays,monthDays,pos:weekdays?Number(f.position.value):0,
    month:freq==='yearly'&&monthDays.length+weekDays.length ? Number(start.slice(5,7)) : 0}:null;
  return {...draft,repeat,location:f.place.value.trim(),travel:Number(f.travel.value)||0,url:f.url.value.trim(),
    alerts:ctx.e.alerts||[]};
}
function writeOccurrence(original, on, draft, scope){
  const fresh=get(original.id);
  if (!fresh) return;
  const first=C.dateOf(fresh.start), delta=diff(on,C.dateOf(draft.start));
  if (!fresh.repeat) { save({...fresh,...draft}); return; }
  if(scope==='one'){
    save({...fresh,skip:[...new Set([...(fresh.skip||[]),on])]});
    save({...draft,id:B.uid(),repeat:null,skip:[],seriesId:fresh.id,seriesOn:on});
    return;
  }
  const repeat=draft.repeat?{...draft.repeat}:null;
  const except=(fresh.skip||[]).filter(d=>scope!=='future'||d>=on).map(d=>add(d,delta));
  if(scope==='future'&&on>first){
    if(repeat?.count && repeat.count===fresh.repeat.count) repeat.count=Math.max(1,repeat.count-C.countBefore(fresh,on));
    save(C.previousOccurrences(fresh,on));
    const id=B.uid();
    save({...draft,id,repeat,skip:except});
    C.events().filter(e=>e.seriesId===fresh.id&&e.seriesOn>=on).forEach(e=>save({...e,seriesId:id,seriesOn:add(e.seriesOn,delta)}));
    return;
  }
  const offset=diff(on,first);
  save({...fresh,...draft,start:C.shifted(draft.start,offset),end:C.shifted(draft.end,offset),repeat,skip:except});
  if (delta) C.events().filter(e=>e.seriesId===fresh.id).forEach(e=>save({...e,seriesOn:add(e.seriesOn,delta)}));
}
async function submitEditor(form){
  const ctx=editContext, submit=form.querySelector('button[type=submit]');
  if (!ctx||submit.disabled) return;
  submit.disabled=true;
  try {
    const draft=draftFrom(form,ctx), d=C.dateOf(draft.start);
    if(ctx.task) B.saveTask(B.newTask({title:draft.title,proj:draft.proj,due:d,time:draft.start.slice(11),est:allDayOf(draft)?0:C.span(draft.start,draft.end),notes:draft.notes}));
    else {
      const removed=new Set([...form.querySelectorAll('[name=detach]:checked')].map(el=>el.value));
      const files=[]; let size=0;
      for(const file of form.elements.files.files){
        const read=await B.readPlannerFile(file).catch(()=>{throw Error('Не удалось прикрепить «'+file.name+'». Для файлов больше 700 КБ используй ссылку.');});
        if(read.data.length>850000) throw Error('Вложение слишком большое. Прикрепи ссылку.');
        files.push({...read,id:B.uid(),name:file.name});
        size+=read.data.length;
      }
      if(editContext!==ctx)return;
      if(files.length&&B.lsSize()+size>4.3e6) throw Error('В браузере мало места для вложений. Прикрепи ссылку.');
      files.forEach(f=>B.put('ef_'+f.id,f));
      draft.attachments=(ctx.e.attachments||[]).filter(id=>!removed.has(id)).concat(files.map(f=>f.id));
      if(ctx.original) writeOccurrence(ctx.original,ctx.e.on,draft,form.elements.scope?.value||'all');
      else save({...draft,id:B.uid(),skip:[]});
      pruneFiles([...removed]);
    }
    B.closeSheet(); change(d); B.toast(ctx.task?'Задача сохранена':'Событие сохранено');
  }catch(e){ const err=form.querySelector('.ac-error');err.textContent=e.message;err.hidden=false; }
  finally { submit.disabled=false; }
}
B.acts.acType=el=>{
  const f=B.$('#acEditor').elements, {e,anchor,selected}=editContext;
  editor({...e,title:f.title.value,proj:f.project.value,notes:f.notes.value},null,el.dataset.v==='task',anchor,selected);
};
B.acts.acAdd=()=>editor(newTimed(date));
B.acts.acNewDay=el=>editor(newAll(el.dataset.d),null,false,near(el),true);
function fromNode(el){
  const {k,id,on,start,end,part}=el.dataset;
  return {kind:k,id,on,start,end,part};
}
B.acts.acOpen=el=>{
  const x=fromNode(el);
  if(x.kind==='task') return B.openTask(x.id);
  if(x.kind==='shad') return B.acts.shadOpen({dataset:{n:x.id}});
  const e=get(x.id); if(e) editor({...e,start:x.start,end:x.end,on:x.on},e,false,near(el));
};
B.acts.acDuplicate=()=>{
  const ctx=editContext; if(!ctx) return;
  const e=ctx.e;
  editor({...newDraft(e.start,e.end),title:e.title,proj:e.proj,notes:e.notes,location:e.location,url:e.url,travel:e.travel,alerts:e.alerts,attachments:e.attachments});
};
B.acts.acDelete=async()=>{
  const {e,original}=editContext||{};
  if(!original) return;
  const scope=B.$('#acEditor').elements.scope?.value||'all';
  if(!await B.confirm('Удалить «'+esc(e.title)+'»?', 'Удалить',true)) return;
  const master=get(original.id);
  if(!master) return B.closeSheet();
  const first=C.dateOf(master.start);
  if(master.repeat && scope==='one') save({...master,skip:[...new Set([...(master.skip||[]),e.on])]});
  else {
    const future=master.repeat&&scope==='future'&&e.on>first;
    const related=C.events().filter(x=>x.seriesId===master.id&&(!future||x.seriesOn>=e.on));
    if(future) save(C.previousOccurrences(master,e.on));
    else B.put('e_'+master.id,null);
    related.forEach(x=>B.put('e_'+x.id,null));
    pruneFiles((master.attachments||[]).concat(related.flatMap(x=>x.attachments||[])));
  }
  B.closeSheet();B.toast('Событие удалено');
};

function searchResults(query){
  const q=query.trim().toLocaleLowerCase('ru');
  if(!q) return '<p class="muted">Введи название, место или текст заметки.</p>';
  const match=e=>[e.title,e.location,e.notes].some(v=>String(v||'').toLocaleLowerCase('ru').includes(q));
  const events=C.events().filter(match).map(e=>({...e,kind:'event',on:C.dateOf(e.start)}));
  const tasks=B.tasks().filter(match).map(t=>({id:t.id,kind:'task',title:t.title,start:t.due||''}));
  const list=events.concat(tasks).sort((a,b)=>a.start.localeCompare(b.start));
  return list.length ? `<div class="ac-results">${list.slice(0,80).map(x=>`<button data-act="acSearchGo" data-k="${x.kind}" data-id="${esc(x.id)}">
    <b>${esc(x.title)}</b><small>${x.kind==='task'?'Задача':'Событие'} · ${x.start?fmt(C.dateOf(x.start))+' '+x.start.slice(0,4):'Без даты'}</small></button>`).join('')}</div>`:
    '<p class="muted">Ничего не найдено.</p>';
}
B.acts.acSearch=()=>{
  B.sheet('<h2>Поиск по календарю</h2><label class="field">Поиск<input type="search" id="acQuery" autocomplete="off" autofocus></label><div id="acResults" aria-live="polite"></div>');
  const query=B.$('#acQuery'), results=B.$('#acResults');
  results.innerHTML=searchResults('');
  query.addEventListener('input',()=>{results.innerHTML=searchResults(query.value)});
};
B.acts.acSearchGo=el=>{
  const {k,id}=el.dataset, e=k==='task'?B.task(id):get(id);
  if(!e) return;
  B.closeSheet();
  if(k==='task'){ if(C.validDate(e.due)) change(e.due); B.openTask(id); }
  else {
    const first=C.dateOf(e.start), next=C.occurrences(e,date,add(date,366))[0];
    const x=next||{...e,on:first};
    change(x.on); editor(x,e);
  }
};
B.acts.acImport=()=>{
  B.sheet(`<h2>Импорт .ics</h2><label class="field">Файл календаря<input id="acImportFile" type="file" accept=".ics,text/calendar"></label>
    <label class="field">Календарь<select id="acImportProject">${projectOptions({})}</select></label>
    <div id="acImportReport" aria-live="polite"></div>
    <div class="row end"><button id="acImportSave" class="btn primary" disabled>Импортировать</button></div>`);
  const input=B.$('#acImportFile'), report=B.$('#acImportReport'), button=B.$('#acImportSave');
  let result=null;
  input.addEventListener('change',async()=>{
    const file=input.files[0]; button.disabled=true; result=null;
    if(!file){report.textContent='';return;}
    try{
      if(file.size>2*1024*1024) throw Error('Файл больше 2 МБ. Импортируй календарь частями.');
      const parsed=C.importICS(await file.text());
      if(input.files[0]!==file) return;
      if(parsed.items.length>1500) throw Error('В файле больше 1500 событий. Импортируй календарь частями.');
      result=parsed;
      report.textContent=`Готово к импорту: ${result.items.length}. Пропущено: ${result.rejected.length}.`+
        (result.rejected.length?' Не удалось прочитать: '+result.rejected.slice(0,5).join(', ')+'.':'');
      button.disabled=!result.items.length;
    }catch(e){ if(input.files[0]===file) report.textContent=e.message; }
  });
  button.addEventListener('click',()=>{
    if(!result?.items.length) return;
    const proj=B.$('#acImportProject').value||'inbox';
    hidden.delete(proj);savePrefs();
    const ids=new Set(C.events().filter(e=>e.proj===proj).map(e=>e.icsUid||e.id+'@zov-lesa'));
    const items=result.items.filter(e=>{
      if(e.icsUid&&ids.has(e.icsUid)) return false;
      if(e.icsUid) ids.add(e.icsUid);
      return true;
    });
    items.forEach(e=>save({...e,id:B.uid(),proj}));
    B.closeSheet();
    if(items.length) change(C.dateOf(items[0].start),'month',true);
    B.toast(`Добавлено: ${items.length}. Уже в календаре: ${result.items.length-items.length}.`);
    if(items.some(e=>e.alerts?.length)) requestNotifications();
  });
};
B.acts.acExport=()=>{
  const items=C.events().filter(e=>visible(projectOf(e)));
  if(!items.length){B.toast('В видимых календарях нет событий для экспорта');return;}
  const blob=new Blob([C.exportICS(items)],{type:'text/calendar;charset=utf-8'});
  const href=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=href; a.download='zov-lesa-'+today()+'.ics'; a.click(); setTimeout(()=>URL.revokeObjectURL(href),1500);
};

function requestNotifications(){
  if('Notification' in window && Notification.permission==='default') Notification.requestPermission().catch(()=>{});
}
let notified={};
try { notified=JSON.parse(localStorage.getItem('bamboo-calendar-alerts')||'{}')||{}; }catch(_){}
function fireAlerts(){
  const now=Date.now(), t=today(), from=add(t,-1);
  let dirty=false;
  const events=C.events().filter(e=>e.alerts?.length);
  for(const event of events){
    const longest=Math.max(...event.alerts);
    const until=add(t,Math.min(365,Math.ceil(longest/C.DAY)+1));
    for(const e of C.occurrences(event,from,until)){
      const start=new Date(allDayOf(e)?e.start+'T09:00':e.start).getTime();
      for(const m of e.alerts){
        const due=start-m*C.MIN, key=e.id+'|'+e.start+'|'+m;
        if(due>now || due<now-C.DAY*C.MIN || notified[key]) continue;
        notified[key]=now;dirty=true;
        B.toast('Напоминание · '+esc(e.title),6500);
        if('Notification' in window&&Notification.permission==='granted'){
          try { new Notification(e.title,{body:allDayOf(e)?'Весь день':fmt(C.dateOf(e.start))+' '+e.start.slice(11),tag:key}); }catch(_){}
        }
      }
    }
  }
  if(dirty){
    for(const [key,when] of Object.entries(notified)) if(when<now-8*C.DAY*C.MIN) delete notified[key];
    try { localStorage.setItem('bamboo-calendar-alerts',JSON.stringify(notified)); }catch(_){}
  }
}
setInterval(fireAlerts,30000);
addEventListener('focus',fireAlerts);

const minuteAt=(col,y,end=false)=>B.clamp(snap((y-col.getBoundingClientRect().top)/col.offsetHeight*C.DAY),0,C.DAY-(end?0:dragStep));
function rangePointer(e,root){
  if((e.pointerType==='touch'&&!e.target.closest('.ac-resize,.ac-grab'))||e.button!==0||e.target.closest('.ac-check,a')) return;
  const col=e.target.closest('[data-col]'), all=e.target.closest('[data-all]');
  if(!col&&!all) return;
  const item=e.target.closest('.ac-item'), x=item&&fromNode(item);
  if(x&&(!['event','task','shad'].includes(x.kind)||item.classList.contains('ghost'))) return;
  if(!item&&e.target.closest('button')) return;
  const origin=col?.dataset.col||all.dataset.all, start=col?minuteAt(col,e.clientY):null;
  const edge=e.target.dataset.resize, id=e.pointerId, sx=e.clientX,sy=e.clientY;
  let active=false, validDrop=false, target=origin, minute=start, selectedCol=col;
  const preview=document.createElement('span'); preview.className='ac-preview';
  const offset=x ? diff(origin,C.dateOf(x.start)) : 0;
  const grab=x&&start!=null ? start-(offset===0?C.minuteOf(x.start):0) : 0;
  const edgeOffset=edge&&start!=null ? start-C.span(origin+'T00:00',x[edge]) : 0;
  dragging=true;
  function proposed(){
    if(!x){
      if(start==null||minute==null) return null;
      const a=C.at(origin,start), b=C.at(target,minute);
      const from=a<b?a:b, to=a<b?b:a;
      return {start:from,end:from===to?C.at(C.dateOf(to),C.minuteOf(to)+dragStep):to};
    }
    if(edge && minute!=null){
      const next={start:x.start,end:x.end,[edge]:C.at(target,minute-edgeOffset)};
      return next.end>next.start ? next : null;
    }
    const d=add(target,offset);
    const dest=minute==null?(root.dataset.calMode==='month'?d+x.start.slice(10):d):
      C.at(d,B.clamp(minute-grab,0,C.DAY-dragStep));
    if(x.kind==='task' && x.start.length===10 && dest.length>10){
      const length=Math.max(dragStep,B.task(x.id)?.est||30);
      return {start:dest,end:C.at(d,C.minuteOf(dest)+length)};
    }
    return C.move(x,dest);
  }
  function update(ev){
    if(ev.pointerId!==id)return;
    if(!active&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3)return;
    active=true;dragging=true;
    const hit=document.elementFromPoint(ev.clientX,ev.clientY);
    const c=hit?.closest('[data-col]'), a=hit?.closest('[data-all]');
    validDrop=root.contains(c||a)&&!(!x && col && !c)&&!(!x && all && !a)&&!(edge&&!c);
    if(!validDrop){preview.remove();root.querySelector('.ac-drag-target')?.classList.remove('ac-drag-target');return;}
    selectedCol=c; target=c?.dataset.col||a.dataset.all;minute=c?minuteAt(c,ev.clientY,edge==='end'):null;
    root.querySelector('.ac-drag-target')?.classList.remove('ac-drag-target');
    (c||a).classList.add('ac-drag-target');
    const next=proposed();
    if(c&&next?.start.length>10){
      const first=C.dateOf(next.start), last=C.dateOf(next.end);
      const from=first<target?0:first===target?C.minuteOf(next.start):minute;
      const end=last>target?C.DAY:last===target?C.minuteOf(next.end):minute+dragStep;
      preview.style.top=from/C.DAY*100+'%';
      preview.style.height=Math.max(dragStep,end-from)/C.DAY*100+'%';
      preview.textContent=next.start.slice(11)+'–'+next.end.slice(11);
      c.append(preview);
    }else preview.remove();
  }
  function cleanup(){
    window.removeEventListener('pointermove',update);
    window.removeEventListener('pointerup',finish);
    window.removeEventListener('pointercancel',cleanup);
    preview.remove();root.querySelector('.ac-drag-target')?.classList.remove('ac-drag-target');
    dragging=false;
    if(redrawAfterDrag){redrawAfterDrag=false;requestAnimationFrame(()=>B.render());}
  }
  function finish(ev){
    if(ev.pointerId!==id)return;
    if(active)update(ev);
    cleanup();
    if(!active)return;
    draggedAt=Date.now();
    if(!validDrop)return;
    const anchor={x:ev.clientX,y:ev.clientY};
    if(!x){
      if(col&&selectedCol){
        const next=proposed();
        if(next) editor(newDraft(next.start,next.end),null,false,anchor,true);
      }else if(all) editor(newAll(origin<target?origin:target,add(origin<target?target:origin,1)),null,false,anchor,true);
      return;
    }
    const next=proposed();
    if(!next || (next.start===x.start&&next.end===x.end))return;
    if(x.kind==='event'){
      const event=get(x.id); if(!event)return;
      const draft={...event,start:next.start,end:next.end};
      if(event.repeat) editor({...draft,on:x.on},event,false,anchor,true); else save(draft);
    }else if(x.kind==='task') B.calendarMoveTask(x.id,next.start,next.end);
    else if(x.kind==='shad') B.calendarMoveShad(Number(x.id),x.part,next.start,next.end);
  }
  window.addEventListener('pointermove',update);
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',cleanup,{once:true});
}
let wheel = {last:0, distance:0, done:false};
function canPan(sc,n){
  return n>0 ? sc.scrollLeft<sc.scrollWidth-sc.clientWidth-2 : sc.scrollLeft>2;
}
function swipePeriod(direction){
  scrollLeft=0;
  B.acts.acShift({dataset:{n:String(direction)}});
}
function mountGestures(sc){
  sc.addEventListener('wheel',e=>{
    if(e.ctrlKey||e.metaKey)return;
    const x=e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX;
    if(!x||(!e.shiftKey&&Math.abs(x)<Math.abs(e.deltaY)*1.2))return;
    const now=performance.now(), direction=Math.sign(x);
    if(now-wheel.last>180)wheel={last:now,distance:0,done:false};
    wheel.last=now;
    if(wheel.done){e.preventDefault();return;}
    if(canPan(sc,direction))return;
    e.preventDefault();
    wheel.distance+=x*(e.deltaMode===1?16:e.deltaMode===2?100:1);
    if(Math.abs(wheel.distance)>=38){wheel.done=true;swipePeriod(direction);}
  },{passive:false});
  let touch=null;
  sc.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||e.target.closest('.ac-resize,.ac-grab')){touch=null;return;}
    const p=e.touches[0];
    touch={id:p.identifier,x:p.clientX,y:p.clientY,start:performance.now(),target:e.target,
      left:canPan(sc,-1),right:canPan(sc,1)};
  },{passive:true});
  sc.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  sc.addEventListener('touchend',e=>{
    const p=[...e.changedTouches].find(p=>p.identifier===touch?.id), g=touch;
    if(!p)return;
    touch=null;
    const dx=p.clientX-g.x,dy=p.clientY-g.y;
    if(Math.abs(dx)>=48&&Math.abs(dx)>1.3*Math.abs(dy)){
      const direction=dx<0?1:-1;
      if(!(direction>0?g.right:g.left)){
        draggedAt=Date.now();swipePeriod(direction);
      }
      return;
    }
    if(Math.hypot(dx,dy)<8&&performance.now()-g.start<450&&!g.target.closest('button,a,.ac-item')){
      const col=g.target.closest('[data-col]');
      if(col)editor(newTimed(col.dataset.col,minuteAt(col,p.clientY)),null,false,null,true);
    }
  },{passive:true});
}
function mount(){
  const root=B.$('.ac'), sc=root?.querySelector('.ac-scroll');
  if(!sc)return;
  const axis=root.querySelector('.ac-axis');
  if(axis){
    const workday=8*60;
    sc.scrollTop=scroll??Math.max(0,axis.offsetHeight*workday/C.DAY-20);
    sc.scrollLeft=scrollLeft;
    sc.addEventListener('scroll',()=>{scroll=sc.scrollTop;scrollLeft=sc.scrollLeft},{passive:true});
  }
  mountGestures(sc);
  if(editContext?.selected)markDraft(editContext.e,editContext.task);
  root.addEventListener('pointerdown',e=>rangePointer(e,root));
  root.addEventListener('click',e=>{
    if(Date.now()-draggedAt<350&&e.target.closest('[data-col],[data-all]')){e.stopImmediatePropagation();e.preventDefault();}
  },true);
  root.addEventListener('dblclick',e=>{
    if(e.target.closest('.ac-item,button,a'))return;
    const col=e.target.closest('[data-col]'), all=e.target.closest('[data-all]');
    const anchor={x:e.clientX,y:e.clientY};
    if(col) editor(newTimed(col.dataset.col,minuteAt(col,e.clientY)),null,false,anchor,true);
    else if(all) editor(newAll(all.dataset.all),null,false,anchor,true);
  });
}
document.addEventListener('keydown',e=>{
  if(!B.$('.ac')||B.sheetOpen()||!B.$('#dlgScrim').hidden||e.target.closest('input,select,textarea,[contenteditable]'))return;
  if(e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
  const act={ArrowLeft:()=>B.acts.acShift({dataset:{n:'-1'}}),ArrowRight:()=>B.acts.acShift({dataset:{n:'1'}}),
    KeyT:B.acts.acToday,KeyN:B.acts.acAdd,Slash:B.acts.acSearch}[e.code];
  if(act){e.preventDefault();e.stopImmediatePropagation();act();}
},true);
B.calendarView={render,mount,deferRender(){if(!dragging)return false;redrawAfterDrag=true;return true;}};
})();
