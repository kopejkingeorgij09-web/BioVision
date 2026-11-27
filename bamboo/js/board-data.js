// Linked cards read planner records directly. Each recurrence has its own lane.
(function(){
const C = B.calData;
const taskId = id => 'task:' + id;
const eventId = (e, day) => 'event:' + e.id + ':' + (e.repeat ? day : 'single');
const task = t => t && !t.deleted ? {
  id:taskId(t.id), source:'task', ref:t.id, completedAt:t.doneAt, ord:t.ord, created:t.created, title:t.title, notes:t.notes, on:t.due, time:t.time || '',
  lane:t.done?'done':t.boardLane==='active'?'active':'plan',
  context:t.time || 'Весь день',
  steps:(t.subs || []).map(s=>({id:s.id,title:s.t,done:!!s.done}))
} : null;
// A calendar slot in the SHAD project can represent coursework even without a task type.
const isShadEvent = e => (e.kind==='event'?B.get('e_'+e.id)?.proj:e.proj)==='shad';
const boardEvent = e => C.isTask(e) || isShadEvent(e);
function liveEvent(e){
  if(!boardEvent(e))return false;
  if(!e.habitId || isShadEvent(e))return true;
  const habit=B.get('h_'+e.habitId);
  return !!habit && !habit.arch && !habit.auto && e.on >= (habit.created || '');
}
function event(e,meta=B.get('boardlane_'+eventId(e,e.on)),day=e.on){
  const id = eventId(e,e.on), time=e.start.startsWith(day+'T')?e.start.slice(11):'';
  const label=!time && e.start<day && e.end.startsWith(day+'T')?'До '+e.end.slice(11):time || 'Весь день';
  return {id,source:'event',ref:e.id,on:e.on,habitId:e.habitId,start:e.start,end:e.end,time,title:e.title,
    notes:e.notes,context:[label,isShadEvent(e)?'ШАД':''].filter(Boolean).join(' · '),
    lane:C.done(e)?'done':meta?.lane==='active'?'active':'plan',steps:[]};
}
const sourceOrder={event:0,task:1,shad:2,phagi:3};
function bySchedule(a,b){
  const time=a.time.localeCompare(b.time);
  if(time)return time;
  if(a.time)return a.title.localeCompare(b.title,'ru');
  const source=sourceOrder[a.source]-sourceOrder[b.source];
  if(source)return source;
  if(a.source==='task')return B.compareTasks(a,b);
  if(a.source==='event')return (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title,'ru');
  return 0;
}
function all(date=B.today()){
  const slots=B.calendarView.plannerEventDays(date,date,()=>true).get(date) || [];
  const cards=slots.filter(liveEvent).map(e=>event(e,undefined,date));
  cards.push(...B.tasksOnDay(date).map(task));
  const homework=new Set();
  for(const {p,kind} of B.shadOn(date)){
    cards.push(study(p,kind));
    if(kind==='hw')homework.add(p.n);
  }
  for(const x of B.phxOn(date)){
    if(x.shad && (x.fix || !homework.has(Number(x.shad))))cards.push(phagi(x));
  }
  return cards.sort(bySchedule);
}
function study(p,part,stage=B.shadStage(p.n),meta=B.get('boardlane_shad:'+part+':'+p.n)){
  const id='shad:'+part+':'+p.n, need=part==='web'?2:3;
  const lane=stage>=need?'done':part==='web'?(stage===1?'active':'plan'):meta?.lane==='active'?'active':'plan';
  const slot=part==='web'?p.w:p.h, time=slot?.from || '';
  return {id,ref:p.n,source:'shad',part,need,lane,title:p.t,on:(part==='web'?p.wp:p.hp)?slot?.date:'',time,
    context:[time || 'Весь день','ШАД',part==='web'?'Вебинар':'ДЗ'].join(' · ')};
}
function phagi(x,meta=B.get('boardlane_phagi:'+x.id)){
  const id='phagi:'+x.id;
  return {id,ref:x.id,source:'phagi',lane:x.done?'done':meta?.lane==='active'?'active':'plan',title:x.t||x.title,
    on:B.phx.dl[x.id]?.due, time:'', context:x.fix?'ШАД · Работа над ошибками':'ШАД · Срок ДЗ в Фагах'};
}
function get(id,meta=B.get('boardlane_'+id)){
  if(id.startsWith('shad:')){
    const [,part,n]=id.split(':'), p=B.shad.plan.find(row=>row.n===Number(n));
    return p?study(p,part,B.shadStage(n),meta):null;
  }
  if(id.startsWith('phagi:')){
    const x=B.phx.dl[id.slice(6)];return x?.shad ? phagi(x,meta) : null;
  }
  if (id.startsWith('task:')) return task(B.task(id.slice(5)));
  if (!id.startsWith('event:')) return null;
  const split=id.lastIndexOf(':'), day=id.slice(split+1), e=B.get('e_'+id.slice(6,split));
  if(!e || !boardEvent(e) || !C.valid(e.start) || !C.valid(e.end) || B.calendarView.plannerOrigin(e)!=='personal')return null;
  if(day==='single')return e.repeat?null:event({...e,on:C.dateOf(e.start)},meta);
  if(!e.repeat || !C.validDate(day))return null;
  const occ = C.occurrences(e,day,day).find(x=>x.on===day);
  return occ ? event(occ,meta) : null;
}
let lastStamp=0;
function log(before,after){
  if (!before && !after || before?.lane===after?.lane && before?.title===after?.title) return;
  const card = after || before, id = B.uid();
  lastStamp=Math.max(Date.now(),lastStamp+0.01);
  B.put('boardlog_'+id,{id,card:card.id,source:card.source,on:card.on,start:card.start,end:card.end,habitId:card.habitId,time:card.time,context:card.context,completedAt:card.completedAt,at:lastStamp,title:card.title,beforeTitle:before?.title || '',before:before?.lane || '',lane:after?.lane || ''},true,true);
}
function shadMark(n,before,after){
  if(before===after)return;
  const id=B.uid();
  B.put('shadlog_'+id,{id,n,at:Date.now(),before,after},true,true);
  const p=B.shad.plan.find(p=>p.n===Number(n));
  if(p)for(const part of ['web','hw'])log(study(p,part,before),study(p,part,after));
}
function calendarMark(e,before,after,completedAt){
  const card=event(e), open=B.get('boardlane_'+card.id)?.lane==='active'?'active':'plan';
  log({...card,lane:before?'done':open},{...card,completedAt,lane:after?'done':open});
}
function track(key,before,after){
  if (key.startsWith('t_')) log(task(before),task(after));
  else if (key.startsWith('boardlane_')){
    const id=key.slice('boardlane_'.length);
    log(get(id,before || null),get(id,after || null));
  } else if(key.startsWith('d_') && (before?.h || after?.h)){
    const day=key.slice(2), oldMarks=before?.h || {}, newMarks=after?.h || {};
    const changedIds=new Set([...Object.keys(oldMarks),...Object.keys(newMarks)].filter(k=>!!oldMarks[k]!==!!newMarks[k]));
    if(changedIds.size)for(const e of C.events()){
      if(!boardEvent(e) || !changedIds.has(e.habitId) || B.calendarView.plannerOrigin(e)!=='personal')continue;
      for(const occ of C.occurrences(e,day,day))if(occ.on===day)calendarMark(occ,!!oldMarks[e.habitId],!!newMarks[e.habitId]);
    }
  } else if(key.startsWith('ec_cal_') || key.startsWith('w_cal_')){
    const mark=after || before, e=mark && B.get('e_'+mark.calendarId);
    const other=B.get((key.startsWith('ec_')?'w_':'ec_')+mark?.id);
    if(e && boardEvent(e) && !e.habitId && !other && B.calendarView.plannerOrigin(e)==='personal'){
      const occ=C.occurrences(e,mark.date,mark.date).find(x=>x.on===mark.date);
      if(occ)calendarMark(occ,!!before,!!after,after?.at);
    }
  }
  else if (key.startsWith('e_')){
    const project = e => e && boardEvent(e) && !e.repeat && C?.valid(e.start) && C.valid(e.end) && B.calendarView?.plannerOrigin(e)==='personal'
      ? event({...e,on:C.dateOf(e.start)}) : null;
    const old=project(before), next=project(after);
    if (old && next && old.id!==next.id){log(old,null);log(null,next);}
    else log(old,next);
  }
}
function move(card,lane){
  if(!card || card.lane===lane)return;
  const saveLane=()=>B.put('boardlane_'+card.id,{card:card.id,lane,at:Date.now()});
  if (card.source==='shad'){
    if(card.part==='web') B.setShadStage(card.ref,{plan:0,active:1,done:2}[lane]);
    else if((card.lane==='done')!==(lane==='done')) B.setShadStage(card.ref,lane==='done'?card.need:card.need-1);
    saveLane();
  } else if(card.source==='phagi'){
    if((card.lane==='done') !== (lane==='done')){B.toast('Отметка выполнения берётся из задания в Фагах');return;}
    saveLane();
  } else if (card.source==='task'){
    const t=B.task(card.ref);
    if (!!t.done!==(lane==='done')) B.setDone({...t,boardLane:lane==='done'?t.boardLane:lane},lane==='done');
    else B.saveTask({...t,boardLane:lane});
  } else if (card.source==='event'){
    const e={...B.get('e_'+card.ref),on:card.on};
    if (!!C.done(e)!==(lane==='done')) C.toggle(e);
    if (!!C.done(e)!==(lane==='done')){
      B.toast('Эту привычку отмечают в её разделе'); return;
    }
    saveLane();
  }
}
function scheduledOn(card,day){
  if(!C.validDate(day))return false;
  if(card.start && card.end){
    return card.start<B.add(day,1) && card.end>(card.end.length===10?day:day+'T00:00');
  }
  return card.on===day;
}
function completed(){
  const checked=new Map(), onTime=new Map(), result=new Map();
  const logs=B.list('boardlog_').slice().sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id));
  for(const x of logs){
    const stamp=x.completedAt || x.at;
    if((x.before==='plan' || x.before==='active') && x.lane==='done' && scheduledOn(x,B.dayOf(stamp))){
      onTime.set(x.card,stamp);
    }
    if(x.lane==='done' && (x.before!=='done' || !checked.has(x.card)))checked.set(x.card,x);
    else if(!x.lane && x.before==='done' && x.completedAt && !checked.has(x.card))checked.set(x.card,{...x,at:x.completedAt});
    else if(x.lane && x.lane!=='done')checked.delete(x.card);
  }
  const add=(card,at,recordedDay='')=>{
    if(!card || !card.title)return;
    let stamp=Number(at) || 0, day=stamp?B.dayOf(stamp):recordedDay;
    if(day && !scheduledOn(card,day)){
      // A late re-check may have replaced the mark's timestamp. Keep an earlier verified completion.
      stamp=onTime.get(card.id);
      if(!stamp || !scheduledOn(card,B.dayOf(stamp)))return;
      day=B.dayOf(stamp);
    }
    result.set(card.id,{...card,completedAt:stamp,day});
  };
  function archived(x){
    return {id:x.card,source:x.source || 'task',on:x.on,start:x.start,end:x.end,title:x.title,time:x.time || '',context:x.context || ''};
  }
  for(const [id,x] of checked){
    if(id.startsWith('task:') && !B.task(id.slice(5)))add(archived(x),x.at);
    // A removed calendar occurrence no longer resolves through its series; its explicit habit mark still can.
    if(x.habitId && x.on && B.day(x.on).h?.[x.habitId])add(archived(x),x.at);
  }
  for(const t of B.list('t_')){
    if(!t.done)continue;
    const c=task({...t,deleted:false});
    add(c,t.doneAt || checked.get(c.id)?.at);
  }
  const events=C.events(), byId=new Map(events.map(e=>[e.id,e]));
  for(const mark of [...B.list('ec_cal_'),...B.list('w_cal_')]){
    if(!mark.calendarId || !C.validDate(mark.date))continue;
    const e=byId.get(mark.calendarId);
    if(e?.habitId)continue; // Linked habits own their marks in the day record.
    const old=checked.get('event:'+mark.calendarId+':'+mark.date) || checked.get('event:'+mark.calendarId+':single');
    const occ=e && C.occurrences(e,mark.date,mark.date).find(x=>x.on===mark.date);
    const card=occ ? event(occ) : old ? {...archived(old),source:'event'} : {
      on:mark.date,id:e?eventId(e,mark.date):'event:'+mark.calendarId+':'+mark.date,
      title:e?.title || 'Архивная задача календаря',source:'event',time:e?.start.slice(11) || '',context:''
    };
    add({...card,on:card.on || mark.date},mark.at || old?.at);
  }
  const byHabit=new Map();
  for(const e of events.filter(e=>e.habitId && boardEvent(e))){
    if(!byHabit.has(e.habitId))byHabit.set(e.habitId,[]);
    byHabit.get(e.habitId).push(e);
  }
  for(const day of B.dayDates()){
    for(const [id,value] of Object.entries(B.day(day).h || {})){
      if(!value)continue;
      for(const e of byHabit.get(id) || []){
        const occ=C.occurrences(e,day,day).find(x=>x.on===day);
        if(occ){const c=event(occ);add(c,checked.get(c.id)?.at);}
        else {
          const old=checked.get(eventId(e,day));
          if(old && (e.repeat || old.on===day || !old.on && C.dateOf(e.start)===day))
            add({...archived(old),source:'event'},old.at);
        }
      }
    }
  }
  for(const p of B.shad.plan){
    for(const part of ['web','hw']){
      const slot=part==='web'?p.w:p.h;
      if(!slot)continue;
      const c=study(p,part);
      // Legacy tracker marks also change timestamp when editing notes, so only the transition dates the work.
      if(c.lane==='done'){
        const mark=B.shad.marks[p.n], stamps=ShadStages.completionTimes(mark);
        const at=stamps[part] || (!mark?.completed || stamps.revision ? checked.get(c.id)?.at : 0);
        add(c,at);
      }
    }
  }
  for(const x of Object.values(B.phx.dl)){
    if(!x.shad || !x.done)continue;
    const date=C.validDate(x.doneAt)?x.doneAt:'';
    const hw=!x.fix && result.get('shad:hw:'+x.shad);
    if(hw){if(!hw.day && scheduledOn(hw,date))hw.day=date;}
    else add(phagi(x),0,date);
  }
  return [...result.values()].sort((a,b)=>b.day.localeCompare(a.day) || bySchedule(a,b));
}
function history(day){
  const byLane={plan:new Map(),active:new Map(),done:new Map()};
  const latest=new Map(), changed=new Set(), completed=new Set();
  const logs=B.list('boardlog_').filter(x=>B.dayOf(x.at)<=day).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  const show=(lane,id,title)=>{if(byLane[lane])byLane[lane].set(id,title);};
  for(const x of logs){
    if(B.dayOf(x.at)===day){
      if(x.before!=='done')show(x.before,x.card,x.beforeTitle || latest.get(x.card)?.title || x.title);
      if(x.lane!=='done')show(x.lane,x.card,x.title);
      if(x.before!=='done' && x.lane==='done' && B.dayOf(x.completedAt || x.at)===day && scheduledOn(x,day))completed.add(x.card);
      changed.add(x.card);
    }
    latest.set(x.card,x);
  }
  for(const t of B.tasks()){
    const id=taskId(t.id);
    if(latest.has(id))continue;
    if(t.due===day)show('plan',id,t.title);
    if(t.due===day && t.done && t.doneAt && B.dayOf(t.doneAt)===day)show('done',id,t.title);
  }
  for(const e of C.events().filter(e=>boardEvent(e) && B.calendarView.plannerOrigin(e)==='personal')){
    for(const x of C.occurrences(e,day,day)){
      const c=event(x);
      if(!latest.has(c.id)){
        show('plan',c.id,c.title);
        const mark=B.get('ec_cal_'+x.id+'_'+x.on) || C.workout(x);
        if(!x.habitId && C.isTask(x) && mark?.at && B.dayOf(mark.at)===day)show('done',c.id,c.title);
      }
    }
  }
  for(const {p,kind} of B.shadOn(day)){
    const c=study(p,kind);
    if(!latest.has(c.id))show('plan',c.id,c.title);
  }
  for(const x of B.phxOn(day).filter(x=>x.shad && x.fix)){
    const c=phagi(x);
    if(!latest.has(c.id))show('plan',c.id,c.title);
  }
  for(const x of Object.values(B.phx.dl)){
    if(x.done && x.due===day && x.doneAt===day && x.shad && x.fix)show('done','phagi:'+x.id,x.title);
  }
  for(const [id,x] of latest){
    if(changed.has(id)){
      if(x.lane==='done' && completed.has(id))show('done',id,x.title);
      continue;
    }
    if(x.lane==='done' || !x.lane)continue;
    if(id.startsWith('event:') && !id.endsWith(':single') && id.slice(-10)!==day && x.lane==='plan')continue;
    show(x.lane,id,x.title);
  }
  return Object.fromEntries(Object.entries(byLane).map(([k,v])=>[k,[...v].map(([id,title])=>({id,title}))]));
}
B.boardData={get,all,move,history,completed,liveEvent,track,calendarMark,eventId,shadMark};
})();
