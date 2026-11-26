// Linked cards read planner records directly. Each recurrence has its own lane.
(function(){
const C = B.calData;
const taskId = id => 'task:' + id;
const eventId = (id, day) => 'event:' + id + ':' + day;
const manual = c => c && !c.deleted ? {...c, source:'board'} : null;
const task = t => t && !t.deleted ? {
  id:taskId(t.id), source:'task', ref:t.id, title:t.title, notes:t.notes,
  lane:t.done?'done':t.boardLane==='active'?'active':'plan', placed:t.doneAt || t.created || 0,
  context:[t.due,t.time].filter(Boolean).join(' · '),
  steps:(t.subs || []).map(s=>({id:s.id,title:s.t,done:!!s.done}))
} : null;
function event(e){
  const id = eventId(e.id,e.on), meta = B.get('boardlane_'+id);
  const checked = C.isTask(e);
  const lane = checked && C.done(e) ? 'done' : meta?.lane==='done' && checked ? 'plan' : meta?.lane || 'plan';
  return {id,source:'event',ref:e.id,on:e.on,start:e.start,end:e.end,title:e.title,
    notes:e.notes,context:e.start.replace('T',' · '),lane,placed:meta?.at || 0,steps:[]};
}
function all(date=B.today()){
  const cards = B.list('board_').map(manual).concat(B.tasks().map(task)).filter(Boolean);
  for (const e of C.events()){
    if (B.calendarView.plannerOrigin(e)!=='personal') continue;
    if (!e.repeat) cards.push(event({...e,on:C.dateOf(e.start)}));
    else for (const occ of C.occurrences(e,date,date)) cards.push(event(occ));
  }
  const shad=[...B.shadOn(date),...B.shadWeek(B.weekStart(date)),...B.shadSomeday()];
  for(const {p,kind} of shad)cards.push(study(p,kind));
  for(const x of B.phxOn(date).filter(x=>!x.shad||x.fix))cards.push(phagi(x));
  return [...new Map(cards.map(c=>[c.id,c])).values()];
}
function study(p,part){
  const id='shad:'+part+':'+p.n, need=part==='web'?2:3, stage=B.shadStage(p.n);
  const lane=stage>=need?'done':B.get('boardlane_'+id)?.lane==='active' || part==='web' && stage===1?'active':'plan';
  return {id,ref:p.n,source:'shad',part,need,lane,title:p.t,context:'ШАД · '+(part==='web'?'Вебинар':'ДЗ'),placed:0};
}
function phagi(x){
  const id='phagi:'+x.id;
  return {id,ref:x.id,source:'phagi',lane:x.done?'done':B.get('boardlane_'+id)?.lane||'plan',title:x.t||x.title,context:'Фаги · ДЗ',placed:0};
}
function get(id){
  if(id.startsWith('shad:')){
    const [,part,n]=id.split(':'), p=B.shad.plan.find(row=>row.n===Number(n));
    return p?study(p,part):null;
  }
  if(id.startsWith('phagi:')){
    const x=B.phx.dl[id.slice(6)];return x?phagi(x):null;
  }
  if (id.startsWith('task:')) return task(B.task(id.slice(5)));
  if (!id.startsWith('event:')) return manual(B.get('board_'+id));
  const day = id.slice(-10), e = B.get('e_'+id.slice(6,-11));
  if (!e || !C.validDate(day)) return null;
  const occ = C.occurrences(e,day,day).find(x=>x.on===day);
  return occ ? event(occ) : null;
}
function log(before,after){
  if (!before && !after || before?.lane===after?.lane && before?.title===after?.title) return;
  const card = after || before, id = B.uid();
  B.put('boardlog_'+id,{id,card:card.id,at:Date.now(),title:card.title,before:before?.lane || '',lane:after?.lane || ''},true,true);
}
function calendarMark(e,before,after){
  const card=event(e), open=B.get('boardlane_'+card.id)?.lane==='active'?'active':'plan';
  log({...card,lane:before?'done':open},{...card,lane:after?'done':open});
}
function track(key,before,after){
  if (key.startsWith('t_')) log(task(before),task(after));
  else if (key.startsWith('board_')) log(manual(before),manual(after));
  else if (key.startsWith('e_')){
    const project = e => e && !e.repeat && C?.valid(e.start) && C.valid(e.end) && B.calendarView?.plannerOrigin(e)==='personal'
      ? event({...e,on:C.dateOf(e.start)}) : null;
    const old=project(before), next=project(after);
    if (old && next && old.id!==next.id){log(old,null);log(null,next);}
    else log(old,next);
  }
}
function move(card,lane){
  if (card.source==='shad'){
    if((card.lane==='done')!==(lane==='done')) B.setShadStage(card.ref,lane==='done'?card.need:card.need-1);
    B.put('boardlane_'+card.id,{lane,at:Date.now()});log(card,get(card.id));
  } else if(card.source==='phagi'){
    B.put('boardlane_'+card.id,{lane,at:Date.now()});log(card,get(card.id));
  } else if (card.source==='task'){
    const t=B.task(card.ref);
    if (!!t.done!==(lane==='done')) B.setDone({...t,boardLane:lane==='done'?t.boardLane:lane},lane==='done');
    else B.saveTask({...t,boardLane:lane});
  } else if (card.source==='event'){
    const e={...B.get('e_'+card.ref),on:card.on};
    const checked=C.isTask(e);
    if (checked && !!C.done(e)!==(lane==='done')) C.toggle(e);
    if (checked && !!C.done(e)!==(lane==='done')){
      B.toast('Эту привычку отмечают в её разделе'); return;
    }
    const before=get(card.id);
    B.put('boardlane_'+card.id,{lane,at:Date.now()});
    log(before,get(card.id));
  } else B.put('board_'+card.id,{...B.get('board_'+card.id),lane,placed:Date.now()});
}
function history(day){
  const byLane={plan:new Map(),active:new Map(),done:new Map()};
  const latest=new Map(), changed=new Set();
  const logs=B.list('boardlog_').filter(x=>B.dayOf(x.at)<=day).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  const show=(lane,id,title)=>{if(byLane[lane])byLane[lane].set(id,title);};
  for(const x of logs){
    if(B.dayOf(x.at)===day){
      show(x.before,x.card,latest.get(x.card)?.title || x.title);show(x.lane,x.card,x.title);changed.add(x.card);
    }
    latest.set(x.card,x);
  }
  for(const t of B.tasks()){
    const id=taskId(t.id);
    if(latest.has(id))continue;
    if(t.created && B.dayOf(t.created)<=day && (!t.doneAt || day<=B.dayOf(t.doneAt)))show('plan',id,t.title);
    if(t.doneAt && B.dayOf(t.doneAt)===day)show('done',id,t.title);
  }
  for(const c of B.list('board_')){
    if(!latest.has(c.id) && c.placed && B.dayOf(c.placed)===day)show(c.lane,c.id,c.title);
  }
  for(const e of C.events().filter(e=>B.calendarView.plannerOrigin(e)==='personal')){
    for(const x of C.occurrences(e,day,day)){
      const c=event(x);
      if(!latest.has(c.id)){show('plan',c.id,c.title);if(C.isTask(x)&&C.done(x))show('done',c.id,c.title);}
    }
  }
  for(const [id,x] of latest){
    if(changed.has(id) || x.lane==='done' || !x.lane) continue;
    if(id.startsWith('event:') && id.slice(-10)!==day && x.lane==='plan')continue;
    show(x.lane,id,x.title);
  }
  return Object.fromEntries(Object.entries(byLane).map(([k,v])=>[k,[...v].map(([id,title])=>({id,title}))]));
}
B.boardData={get,all,move,history,track,calendarMark};
})();
