/* Snapshot for native home-screen widgets. No profile codes leave the WebView. */
(() => {
  const bridge = window.ZovReminder;
  if (!bridge || !window.B) return;
  const C = B.calData;
  let timer, last = '';
  let habitAcks = [];
  const text = (value, max = 220) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  function details(e){
    let teacher = text(e.teacher || e.instructor), location = text(e.location);
    const notes = text(e.notes, 1600).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!teacher){
      const labelled = notes.filter(x=>/^(?:преподаватель|преподаватели|ведущий)\s*:/i.test(x));
      if(labelled.length) teacher = labelled.map(x=>x.replace(/^[^:]+:\s*/, '')).join('\n');
      // The imported MIREA calendar stores teachers after its group and lesson headers.
      // Do not infer a teacher from arbitrary private notes or from a subject's name.
      else if(/^РТУ МИРЭА · ХББО-04-26$/.test(notes[0] || '') && /^\d+-я пара · (?:нечётная|чётная) неделя$/.test(notes[1] || ''))
        teacher = notes.slice(2).join('\n').replace(/(\d)-я подгруппа\s*[—–-]\s*/g, '$1-я п/г · ');
    }
    const building = text(e.building, 70), room = text(e.room, 70);
    if(building || room) location = [building && 'Корпус '+building, room && 'Ауд. '+room, !room && location].filter(Boolean).join(' · ');
    else {
      const match = location.match(/^(.+?)\s*\((В-86|МП-1)\)$/);
      if(match) location = 'Корпус '+match[2]+' · '+(/^ФОК$/i.test(match[1])?'ФОК':'ауд. '+match[1]);
      else if(/^[А-ЯA-Z]-\d[\dа-яa-z]*(?:\s*\/\s*[А-ЯA-Z]-\d[\dа-яa-z]*)*$/i.test(location)) location = 'Ауд. '+location;
    }
    return {location:text(location), teacher:text(teacher)};
  }
  function sync(){
    const today = B.ymd(new Date()), until = B.add(today, 14), items = [];
    const push = (kind, id, date, time, title, extra = {}) => {
      if (C.validDate(date) && date <= until)
        items.push({kind, id: String(id), date, time: time || '', title: String(title || '').slice(0,160), ...extra});
    };
    for (const t of B.tasks()) {
      if (t.done || !C.validDate(t.due)) continue;
      push('task', t.id, t.due, t.time, t.title);
      if (t.rep) for (let d = B.nextRep(t.due,t.rep), i=0; d && d<=until && i<100; d=B.nextRep(d,t.rep),i++)
        if(d>=today) push('task',t.id,d,t.time,t.title);
    }
    for (const e of C.events()) for (const x of C.occurrences(e,today,until))
      push('event',e.id,C.dateOf(x.start),x.start.length>10?x.start.slice(11):'',x.title,{end:x.end,...details(x)});
    for (const p of B.shad.plan) for (const [slot,placed,stage,label] of [[p.w,p.wp,2,''],[p.h,p.hp,3,'ДЗ · ']])
      if (placed && B.shadStage(p.n)<stage) push('shad',p.n,slot?.date,slot?.from,label+p.t);
    items.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title,'ru'));
    // Bound binder size. Keep overdue work plus the nearest two weeks.
    const monday = d => {const day=new Date(d+'T12:00:00Z');return B.add(d,-((day.getUTCDay()+6)%7));};
    const ws=monday(today), we=B.add(ws,6), stages=[0,0,0,0,0], todayShad=[], weekShad=[],schedule=[];
    for(const p of B.shad.plan){
      const stage=B.shadStage(p.n);stages[stage]++;
      for(const [slot,placed,need,type] of [[p.w,p.wp,2,'Веб'],[p.h,p.hp,3,'ДЗ']]){
        if(!slot?.date)continue;
        const item={id:String(p.n),date:slot.date,time:placed?(slot.from||''):'',title:type+' · '+p.t,
          detail:(B.SHAD_STAGES||[])[stage]||String(stage),placed:!!placed,done:stage>=need};
        schedule.push(item);
        if(placed&&slot.date===today)todayShad.push(item);
        if(slot.date>=ws&&slot.date<=we)weekShad.push(item);
      }
    }
    todayShad.sort((a,b)=>(a.time||'99').localeCompare(b.time||'99'));
    const study={date:today,shad:{total:B.shad.plan.length,closed:stages[4],watched:stages[2]+stages[3]+stages[4],homework:stages[3]+stages[4],
      schedule:schedule.slice(0,300),today:todayShad.slice(0,30),week:weekShad.slice(0,100),weekDone:weekShad.filter(x=>x.done).length,unplaced:weekShad.filter(x=>!x.placed&&!x.done).length},alberts:B.alberts?.widget()||null};
    const day = B.today();
    const habits = {date:day, pins:B.habitPins(), rows:B.trackerHabits().filter(h => !h.created || h.created <= day).map(h =>
      ({id:h.id, name:text(h.name,160), auto:h.auto || '', value:B.habitVal(h,day)}))};
    const packet = JSON.stringify({op:'widgets',items:items.slice(0,300),study,habits,habitAcks,focus:B.focus?.widgetSnapshot()});
    if(habitAcks.length || packet!==last){bridge.postMessage(packet);last=packet;}
    habitAcks=[];
  }
  // Commands carry the requested final state. A replay after a process restart is idempotent.
  B.applyWidgetHabits = changes => {
    const ack=[];
    for (const change of changes){
      const {id,date,checked,token}=change;
      if (!C.validDate(date) || date>B.today() || typeof checked!=='boolean' || !token) continue;
      const h=B.get('h_'+id);
      if (!h) continue;
      if (!h.arch && !h.auto && (!h.created || date>=h.created) && !!B.habitVal(h,date)!==checked){
        B.editDay(date,d => {
          d.h={...d.h};
          if (checked) d.h[id]=1; else delete d.h[id];
        });
      }
      ack.push({id,date,token});
    }
    if (ack.length && B.persistLocal()){habitAcks=ack;sync();}
  };
  function queue(){clearTimeout(timer);timer=setTimeout(sync,180);}
  B.on('change',queue);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  window.addEventListener('pageshow',sync);
  sync();
  B.androidReminders?.refresh();
})();
