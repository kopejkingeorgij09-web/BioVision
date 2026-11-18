const lessonRoute = new URLSearchParams(location.search);
let routePending = lessonRoute.has('lesson') || lessonRoute.has('task');
const routeReady = {};
let review = null;
function forestBack(){
  if (lessonRoute.get('from') !== 'forest') return '';
  const hash = lessonRoute.get('back') || '';
  const target = /^#\/(?:today|tasks\/calendar)(?:\/[\d-]+)?$/.test(hash) ? hash : '#/today';
  const day=lessonRoute.get('backDay') || '';
  const search=/^\d{4}-\d{2}-\d{2}$/.test(day)?'?day='+day:'';
  return `<a class="back forest-back" href="../bamboo/${search}${esc(target)}">← В «Зов леса»</a>`;
}
function checkLessonRoute(){
  if (!routePending || !routeReady.tasks || !routeReady.events || !routeReady.people) return;
  routePending = false;
  const day = lessonRoute.get('date'), eid = lessonRoute.get('lesson'), uid = lessonRoute.get('review');
  if (eid){
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && occs(day,day).some(o=>o.type==='ev' && o.ev.id===eid)){
      S.calDay=day; S.calMonth=null; S.view='cal'; openOcc('ev',eid,day); return;
    }
  } else {
    const t=allMyTasks().find(t=>t.id===lessonRoute.get('task'));
    if (t && (!uid || (T() && (t.to||[]).includes(uid)))){
      if(uid) openAnswer(t.id,uid); else {S.taskId=t.id; S.view='task';}
      return;
    }
  }
  toast('Этот урок или ответ недоступен в текущем аккаунте.',6500);
}
function openAnswer(id,uid){
  const t=S.tasks.find(x=>x.id===id);
  if(!T() || !(t?.to||[]).includes(uid)) return;
  watch(uid); review={id,uid}; S.taskId=id; S.view='task'; window.scrollTo(0,0);
}
function reviewContext(t){return T() && review?.id===t.id ? review : null;}
function nextAnswer(){
  const next=pending().find(x=>x.t.id!==review?.id || x.uid!==review?.uid);
  if(next) openAnswer(next.t.id,next.uid);
  else {review=null;S.view='home';window.scrollTo(0,0);}
}
function quizProgress(t){
  hwLocal(t.id);
  const draft=S.subs[meId()]?.[t.id]?.draft || {};
  return (t.q||[]).map((q,i)=>{
    const key=`ta-${t.id}-${i}`;
    return String(val(key,draft[key]??'')).trim()!=='';
  });
}
function quizMemo(id,change){
  const key=`ph-quiz-nav:${meId()}:${id}`;
  let state={};
  try{state=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}
  if(change){Object.assign(state,change);try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
  return state;
}
function quizNav(t){
  const done=quizProgress(t), first=done.indexOf(false), flags=quizMemo(t.id).flags||[];
  return `<div class="quiz-nav" data-quiz-nav="${esc(t.id)}"><div class="quiz-tools">
    <button class="btn sm ghost" data-act="quizmap" aria-expanded="false">Вопросы <b>${done.filter(Boolean).length}/${done.length}</b></button>
    ${first>=0?`<button class="back" data-act="quizjump" data-i="${first}">К пропуску №${first+1}</button>`:''}</div>
    <div class="quiz-map" hidden aria-label="Номера вопросов">${done.map((ok,i)=>`<button type="button" class="${ok?'answered':''}" data-act="quizjump" data-i="${i}" aria-label="Вопрос ${i+1}, ${ok?'есть ответ':'без ответа'}${flags.includes(i)?', отмечен':''}">${i+1}${flags.includes(i)?' ⚑':''}</button>`).join('')}</div></div>`;
}
function jumpQuiz(i){
  const q=document.getElementById('quiz-question-'+i);
  if(!q)return;
  const grid=document.querySelector('.quiz-map');
  if(grid){grid.hidden=true;grid.previousElementSibling.querySelector('button').setAttribute('aria-expanded','false');}
  q.focus({preventScroll:true});q.scrollIntoView({block:'start'});quizMemo(S.taskId,{position:i});
}
function refreshQuizNav(t){
  const nav=document.querySelector('[data-quiz-nav]');
  if(!nav || nav.dataset.quizNav!==t.id)return;
  const wasOpen=!nav.querySelector('.quiz-map').hidden;
  nav.outerHTML=quizNav(t);
  if(wasOpen){const grid=document.querySelector('.quiz-map');grid.hidden=false;grid.previousElementSibling.querySelector('button').setAttribute('aria-expanded','true');}
}
let quizRestore=null,quizScrollTimer;
function mountQuizNav(){
  const nav=document.querySelector('[data-quiz-nav]');
  if(!nav){quizRestore=null;return;}
  const id=nav.dataset.quizNav;
  if(quizRestore===id)return;
  quizRestore=id;
  const pos=S.quizStart ?? quizMemo(id).position;S.quizStart=null;
  if(Number.isInteger(pos))requestAnimationFrame(()=>{if(S.taskId===id && quizRestore===id)jumpQuiz(pos);});
}
window.addEventListener('scroll',()=>{
  if(!quizRestore)return;
  clearTimeout(quizScrollTimer);
  const id=quizRestore;
  quizScrollTimer=setTimeout(()=>{
    if(quizRestore!==id || S.taskId!==id)return;
    const cutoff=(document.querySelector('.quiz-tools')?.getBoundingClientRect().bottom||0)+8;
    const current=[...document.querySelectorAll('[data-quiz-index]')].find(q=>q.getBoundingClientRect().bottom>cutoff);
    if(current)quizMemo(id,{position:Number(current.dataset.quizIndex)});
  },150);
},{passive:true});
function confirmQuiz(missing){
  return new Promise(resolve=>{
    const d=$('#dlg');
    openDlg(`<h2>Отправить тест?</h2><p>Без ответа осталось ${missing.length}. Нажми номер, чтобы вернуться к вопросу.</p>
      <div class="quiz-map">${missing.map(i=>`<button data-dact="jump" data-i="${i}">${i+1}</button>`).join('')}</div>
      <div class="actions"><button class="btn ghost" data-dact="cancel">Продолжить тест</button><button class="btn" data-dact="send">Отправить с пропусками</button></div>`,
      {jump:el=>{closeDlg();jumpQuiz(Number(el.dataset.i));},cancel:closeDlg,send:()=>{resolve(true);closeDlg();}});
    d.addEventListener('close',()=>resolve(false),{once:true});
  });
}
function lessonHome(todo){
  const events=new Map(visEvents().map(e=>[e.id,e])), groups=new Map(), grouped=new Set(),uid=meId();
  function group(ev,day){
    const key=ev.id+'@'+day;
    if(!groups.has(key))groups.set(key,{ev,day,tasks:[]});return groups.get(key);
  }
  for(const t of myTasks()){
    const ev=events.get(t.lesson?.eventId);
    const day=ev?.repeat==='weekly'?t.lesson?.date:ev?.date;
    if(!ev || !day)continue;
    group(ev,day).tasks.push(t);grouped.add(t.id);
  }
  for(const o of occs(addDays(today(),-7),today())){
    if(o.type==='ev' && !o.cancel && evFiles(o.ev,o.date).length)group(o.ev,o.date);
  }
  const due=g=>g.tasks.filter(t=>['todo','late'].includes(status(t,uid).k)).map(t=>t.due||'9999').sort()[0];
  const all=[...groups.values()].sort((a,b)=>(due(a)||'zz').localeCompare(due(b)||'zz') || b.day.localeCompare(a.day));
  const errors=errPile(uid);
  function row(t){
    const st=status(t,uid), draft=t.kind==='test' && ['todo','late'].includes(st.k) ? quizProgress(t) : null;
    const left=errors.filter(x=>x.t.id===t.id).length;
    const n=draft?.filter(Boolean).length || 0;
    const title=draft?(n?'Продолжить':'Начать тест'):left?'Разобрать ошибки':'Открыть';
    return `<div class="lesson-task"><span><b>${esc(t.title)}</b><small>${t.kind==='test'?'Тест с самопроверкой':t.kind==='material'?'Материал':'Письменная работа'}${draft?` · ${n} из ${draft.length}`:''}${t.due?' · до '+fmtDay(t.due):''} · ${esc(st.k==='todo'?'К сдаче':st.l)}</small></span>
      <button class="btn ghost sm" data-act="${left?'quizerrors':draft?'quizresume':'open'}" data-id="${esc(t.id)}">${title}</button></div>`;
  }
  function card({ev,day,tasks}){
    return `<article class="lesson-card"><button class="back" data-act="occ" data-k="ev" data-id="${esc(ev.id)}" data-d="${esc(day)}"><strong>${esc(ev.title)}</strong> · ${fmtDay(day)}</button>${pillsHTML(evFiles(ev,day))}${tasks.sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')).map(row).join('')}</article>`;
  }
  const others=todo.filter(t=>!grouped.has(t.id));
  return `<h2>Мои уроки</h2>${all.slice(0,3).map(card).join('')}${all.length>3?`<details><summary>Другие уроки · ${all.length-3}</summary>${all.slice(3).map(card).join('')}</details>`:''}
    ${others.length?`<h3>Другие задания</h3>${others.map(t=>taskRow(t)).join('')}`:''}${!all.length&&!others.length?'<p class="muted">Здесь появятся материалы и задания к урокам.</p>':''}`;
}
