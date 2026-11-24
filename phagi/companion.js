// Classroom reminders share the same task and correction status as the gradebook.
let phagePrevious = null, phageReward = null, phageBadgeKey = null;
let phageTimer = null, phageOpener = null, phagePanelKey = null;

function phageReady() {
  const id = meId();
  return S.mode === 'student' && S.joined && id && S.subs[id] && S.grades[id] && S.fix[id];
}
function phageAge(date) {
  return date ? Math.max(0, diffDays(String(date).slice(0,10), today())) : 0;
}
function phageAgenda() {
  const late = [], soon = [], limit = addDays(today(),1);
  for (const task of myTasks()) {
    if (task.kind === 'material') continue;
    const state = status(task, meId()).k;
    if (state === 'late') late.push(task);
    if (state === 'todo' && task.due && task.due <= limit) soon.push(task);
  }
  const byDue = (a,b) => a.due.localeCompare(b.due);
  late.sort(byDue); soon.sort(byDue);
  const tests = errPile(meId()), bio = bvPile(meId());
  const age = Math.max(0,...late.map(t => phageAge(t.due)),
    ...tests.map(x => phageAge(S.subs[meId()]?.[x.t.id]?.updatedAt)),
    ...bio.map(x => phageAge(typeof x.at === 'number' ? new Date(x.at).toISOString() : x.at)));
  const errors = tests.length + bio.length;
  return {late,soon,tests:tests.length,bio:bio.length,errors,age,
    count:late.length+soon.length+(errors ? 1 : 0)};
}
function phageTrackProgress(a) {
  const ids = new Set([...a.late,...a.soon].map(t=>t.id));
  if (phagePrevious) {
    const handedIn = [...phagePrevious.ids].some(id => {
      if (ids.has(id)) return false;
      const t = S.tasks.find(x=>x.id===id);
      return t && ['sub','graded'].includes(status(t,meId()).k);
    });
    if (handedIn || a.errors < phagePrevious.errors) {
      phageReward = handedIn ? (a.count ? 'Работа сдана' : 'Все работы сданы')
        : (a.errors ? 'Ошибка исправлена' : 'Все ошибки разобраны');
    }
  }
  phagePrevious = {ids,errors:a.errors};
}
function phageMood(a) {
  return a.age >= 7 ? 'urgent' : a.late.length || a.errors || a.soon.length ? 'notice' : 'idle';
}
function phageSync() {
  const fab = document.getElementById('phage-fab');
  if (!fab) return;
  if (!phageReady()) {
    fab.hidden = true;
    if (T() && !document.getElementById('phage-panel').hidden) phageRenderPanel(null);
    return;
  }
  const a = phageAgenda();
  phageTrackProgress(a);
  const mood = phageReward ? 'celebrate' : phageMood(a);
  const key = [mood,a.count,a.late.length,a.age >= 3,a.errors,phageReward].join('|');
  if (key !== phageBadgeKey) {
    phageBadgeKey = key;
    fab.hidden = !phageReward && a.count === 0;
    fab.dataset.mood = mood;
    fab.dataset.urgency = a.age >= 7 ? 'week' : a.age >= 3 ? 'several' : 'recent';
    fab.title = phageReward || ('Напоминания · '+a.count);
    fab.setAttribute('aria-label', 'Бактериофаг. '+fab.title);
    fab.innerHTML = PhagiMascot.svg({mode:mood,variant:'badge'})+
      '<span class="phage-count">'+(phageReward?'✦':a.count)+'</span>';
  }
  if (!document.getElementById('phage-panel').hidden) phageRenderPanel(a);
}
function phageRenderPanel(a) {
  const panel = document.getElementById('phage-panel');
  const teacher = T();
  const rows = teacher ? pending() : [];
  const tasks = teacher ? [] : [...a.late,...a.soon];
  const key = teacher ? 'teacher:'+rows.length : JSON.stringify([tasks.map(t=>[t.id,t.title,t.due]),a.tests,a.bio,a.age]);
  if (key === phagePanelKey) return;
  const active = panel.contains(document.activeElement) ? document.activeElement.dataset : null;
  phagePanelKey = key;
  const mood = teacher ? (rows.length ? 'notice' : 'idle') : phageMood(a);
  const title = teacher ? (rows.length ? 'Работы на проверку' : 'Все работы проверены') :
    !a.count ? 'На сегодня всё' : a.late.length ? 'Пора вернуться к заданиям' : a.errors && !a.soon.length ? 'Разбор ошибок' : 'Ближайшие сроки';
  const action = (kind,label,detail,id) =>
    '<button class="phage-action" type="button" data-phage="'+kind+'"'+(id?' data-id="'+esc(id)+'"':'')+'><span>'+esc(label)+'</span><small>'+esc(detail)+'</small></button>';
  const taskRow = t => {
    const days = phageAge(t.due);
    const when = days ? 'просрочено на '+days+' '+plural(days,'день','дня','дней') : t.due === today() ? 'сегодня' : 'завтра';
    return action('open',t.title,when,t.id);
  };
  let links = teacher ? action('journal','Открыть журнал',rows.length ? rows.length+' '+plural(rows.length,'работа','работы','работ') : '') :
    tasks.slice(0,4).map(taskRow).join('');
  if (!teacher && a.tests) links += action('fix','Ошибки в тестах',String(a.tests));
  if (!teacher && a.bio) links += action('bv','Ошибки в Биовизе',String(a.bio));
  if (!teacher && tasks.length > 4) links += action('tasks','Все задания',String(tasks.length));
  const note = teacher || tasks.length ? '' : !a.count ? 'Ближайших сроков и ошибок для разбора нет.' : '';
  panel.innerHTML = '<div class="phage-portrait">'+PhagiMascot.svg({mode:mood,variant:'portrait'})+'</div>'+
    '<div class="phage-note"><button type="button" class="phage-close" data-phage="later" aria-label="Закрыть напоминания">×</button>'+
    '<h2>'+title+'</h2>'+(note?'<p>'+note+'</p>':'')+'<div class="phage-actions">'+links+'</div>'+
    '<button class="phage-later" type="button" data-phage="later">Закрыть</button></div>';
  if (active?.phage) [...panel.querySelectorAll('[data-phage]')].find(el=>el.dataset.phage===active.phage && el.dataset.id===active.id)?.focus({preventScroll:true});
}
function phageAuto(delay) {
  clearTimeout(phageTimer);
  phageTimer = setTimeout(()=>{
    const panel = document.getElementById('phage-panel');
    if (panel.matches(':hover') || panel.contains(document.activeElement)) phageAuto(8000);
    else phageHide();
  },delay);
}
function phageHide(restore=false) {
  const panel = document.getElementById('phage-panel');
  if (panel.hidden) return;
  clearTimeout(phageTimer); panel.hidden=true; panel.replaceChildren(); phagePanelKey=null;
  document.body.classList.remove('phage-open');
  for (const id of ['phage-brand','phage-fab']) document.getElementById(id)?.setAttribute('aria-expanded','false');
  if (restore) (phageOpener?.hidden ? document.getElementById('phage-brand') : phageOpener)?.focus({preventScroll:true});
}
function phageCelebrate(title) {
  document.getElementById('phage-party')?.remove();
  const host=document.createElement('div');host.id='phage-party';host.setAttribute('role','status');
  host.innerHTML=PhagiMascot.svg({mode:'celebrate',variant:'badge'})+'<strong>'+esc(title)+'</strong><i></i><i></i><i></i><i></i>';
  document.body.append(host);setTimeout(()=>host.remove(),3600);
}
function mountPhage() {
  const brand=document.getElementById('phage-brand'),fab=document.getElementById('phage-fab'),panel=document.getElementById('phage-panel');
  brand.innerHTML=PhagiMascot.svg({mode:'idle',variant:'brand'});
  function open(e) {
    if (!T() && !phageReady()) return;
    if (!panel.hidden) {phageHide(true);return;}
    if (phageReward) {const title=phageReward;phageReward=null;phageSync();phageCelebrate(title);if(e.currentTarget===fab){if(fab.hidden)brand.focus({preventScroll:true});return;}}
    phageOpener=e.currentTarget;panel.hidden=false;phagePanelKey=null;
    phageRenderPanel(T()?null:phageAgenda());document.body.classList.add('phage-open');
    brand.setAttribute('aria-expanded','true');fab.setAttribute('aria-expanded','true');
    if(e.detail===0)panel.querySelector('.phage-close').focus({preventScroll:true});
    phageAuto(!T() && phageAgenda().age>=7?45000:25000);
  }
  brand.addEventListener('click',open);fab.addEventListener('click',open);
  panel.addEventListener('click',e=>{
    const b=e.target.closest('[data-phage]');if(!b)return;
    phageHide(b.dataset.phage==='later');
    switch(b.dataset.phage){
      case 'later': return;
      case 'open': S.view='task';S.taskId=b.dataset.id;break;
      case 'fix': S.view=errPile(meId()).length?'fix':'marks';S.fixState=null;S.fixPos=0;break;
      case 'bv': BVS.want='err';S.view='bio';break;
      case 'journal': S.view='journal';break;
      case 'tasks': S.view='tasks';break;
    }
    window.scrollTo(0,0);render();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden&&!document.querySelector('dialog[open]'))phageHide(true);});
  setInterval(()=>{if(!document.hidden)phageSync();},3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)phageSync();});
}
