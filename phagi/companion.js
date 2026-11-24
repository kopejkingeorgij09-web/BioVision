// Classroom reminders share the same task and correction status as the gradebook.
let phagePrevious = null, phageReward = null, phageBadgeKey = null;
let phageTimer = null, phageOpener = null, phagePanelKey = null;
let phageAnimations = [];
const phageReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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
    if (T() && document.getElementById('phage-panel').dataset.state === 'open') phageRenderPanel(null);
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
  if (document.getElementById('phage-panel').dataset.state === 'open') phageRenderPanel(a);
}
function phageRenderPanel(a) {
  const figure = document.querySelector('#phage-panel .phage-figure');
  const note = document.getElementById('phage-note');
  const teacher = T();
  const rows = teacher ? pending() : [];
  const tasks = teacher ? [] : [...a.late,...a.soon];
  const key = teacher ? 'teacher:'+rows.length : JSON.stringify([tasks.map(t=>[t.id,t.title,t.due]),a.tests,a.bio,a.age]);
  if (key === phagePanelKey) return;
  const active = note.contains(document.activeElement) ? document.activeElement.dataset : null;
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
  const message = !teacher && !tasks.length && !a.count ? 'Ближайших сроков и ошибок для разбора нет.' : '';
  if (figure.dataset.mood !== mood) {
    figure.dataset.mood = mood;
    figure.innerHTML = PhagiMascot.svg({mode:mood,variant:'portrait'});
  }
  note.innerHTML = '<button type="button" class="phage-close" data-phage="later" aria-label="Закрыть напоминания">×</button>'+
    '<h2>'+title+'</h2>'+(message?'<p>'+message+'</p>':'')+'<div class="phage-actions">'+links+'</div>'+
    '<button class="phage-later" type="button" data-phage="later">Закрыть</button>';
  if (active?.phage) [...note.querySelectorAll('[data-phage]')].find(el=>el.dataset.phage===active.phage && el.dataset.id===active.id)?.focus({preventScroll:true});
}

function phageAnimate(opening, fresh, done) {
  const panel = document.getElementById('phage-panel');
  const elements = [panel.querySelector('.phage-figure'), document.getElementById('phage-note')];
  const tucked = [
    {opacity:0, transform:'translate(-11px, 8px) rotate(-11deg) scale(.54, .58)'},
    {opacity:0, transform:'perspective(460px) translate(-28px, 4px) rotateY(-76deg) rotateZ(9deg) scale(.24, .12)'}
  ];
  const settled = {opacity:1, transform:'none'};
  const canAnimate = !phageReducedMotion.matches && typeof elements[0].animate === 'function';
  const interrupted = phageAnimations.length > 0;
  const current = canAnimate && !fresh ? elements.map(el => {
    const style = getComputedStyle(el);
    return {opacity:style.opacity, transform:style.transform};
  }) : tucked;

  phageAnimations.forEach(animation => animation.cancel());
  phageAnimations = [];
  delete panel.dataset.motion;
  if (!canAnimate) { done?.(); return; }

  let frames;
  let duration;
  if (fresh) {
    panel.dataset.motion = 'launch';
    duration = 720;
    frames = [
      [tucked[0],
        {offset:.16, opacity:1, transform:'translateY(3px) rotate(-13deg) scale(1.14, .72)', easing:'cubic-bezier(.18,.6,.35,1)'},
        {offset:.42, transform:'translate(14px, -46px) rotate(21deg) scale(.94, 1.12)', easing:'cubic-bezier(.42,0,.86,.7)'},
        {offset:.68, transform:'translate(1px, 3px) rotate(-9deg) scale(1.14, .82)', easing:'ease-out'},
        {offset:.86, transform:'translateY(-8px) rotate(4deg) scale(.99, 1.035)', easing:'ease-in-out'}, settled],
      [{...tucked[1], offset:0}, {...tucked[1], offset:.29},
        {offset:.45, opacity:1, transform:'perspective(460px) translate(-12px, 9px) rotateY(-60deg) rotateZ(5deg) scale(.72, .29)', easing:'cubic-bezier(.16,.68,.27,1)'},
        {offset:.77, transform:'perspective(460px) translate(1px, -4px) rotateY(3deg) rotateZ(-1deg) scale(1.01, 1.035)', easing:'ease-in-out'},
        settled]
    ];
  } else if (!opening && !interrupted) {
    panel.dataset.motion = 'catch';
    duration = 480;
    frames = [
      [{...current[0], easing:'ease-out'},
        {offset:.26, transform:'translate(12px, -9px) rotate(19deg) scale(.98, 1.06)', easing:'ease-in-out'},
        {offset:.56, transform:'translate(-3px, 3px) rotate(-14deg) scale(1.16, .76)', easing:'ease-out'},
        {offset:.72, opacity:1, transform:'translate(1px, -10px) rotate(7deg) scale(.92, 1.06)', easing:'ease-in'},
        tucked[0]],
      [{...current[1], easing:'ease-out'},
        {offset:.18, transform:'perspective(460px) translate(1px, -5px) rotateY(4deg) rotateZ(-1deg) scale(1.005, 1.025)', easing:'cubic-bezier(.46,0,.72,1)'},
        {offset:.46, opacity:1, transform:'perspective(460px) translate(-11px, 6px) rotateY(-43deg) rotateZ(8deg) scale(.72, .40)', easing:'ease-in'},
        {...tucked[1], offset:.72}, tucked[1]]
    ];
  } else {
    duration = 230;
    frames = current.map((from, index) => [
      {...from, easing:'cubic-bezier(.24,.65,.36,1)'}, opening ? settled : tucked[index]
    ]);
  }
  const animations = elements.map((el, index) => el.animate(frames[index], {duration, fill:'both'}));
  phageAnimations = animations;
  Promise.all(animations.map(animation => animation.finished)).then(() => {
    if (phageAnimations !== animations) return;
    delete panel.dataset.motion;
    done?.();
    animations.forEach(animation => animation.cancel());
    phageAnimations = [];
  }, () => {});
}

function phageSetExpanded(expanded) {
  for (const id of ['phage-brand','phage-fab','phage-portrait']) {
    document.getElementById(id).setAttribute('aria-expanded', String(expanded));
  }
  document.getElementById('phage-portrait').setAttribute('aria-label',
    expanded ? 'Свернуть напоминания' : 'Открыть напоминания');
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
  if (panel.dataset.state !== 'open') return;
  const note = document.getElementById('phage-note');
  const portrait = document.getElementById('phage-portrait');
  clearTimeout(phageTimer);
  panel.dataset.state = 'closing';
  phageSetExpanded(false);
  if (restore && (panel.contains(document.activeElement) || document.activeElement === document.body)) {
    const target = phageOpener?.id === 'phage-brand' ? phageOpener : portrait;
    target.focus({preventScroll:true});
  }
  note.inert = true;

  phageAnimate(false, false, () => {
    const returnFocus = document.activeElement === portrait;
    panel.hidden = true;
    delete panel.dataset.state;
    document.body.classList.remove('phage-open');
    note.replaceChildren();
    phagePanelKey = null;
    if (returnFocus) {
      const target = phageOpener && !phageOpener.hidden ? phageOpener : document.getElementById('phage-brand');
      target.focus({preventScroll:true});
    }
  });
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
  const portrait = document.getElementById('phage-portrait');
  const note = document.getElementById('phage-note');
  function toggle(e) {
    if (panel.dataset.state === 'open') { phageHide(true); return; }
    if (!T() && !phageReady()) return;
    const fresh = panel.hidden;
    if (fresh && phageReward) {
      const title=phageReward;phageReward=null;phageSync();phageCelebrate(title);
      if(e.currentTarget===fab){if(fab.hidden)brand.focus({preventScroll:true});return;}
    }
    if (e.currentTarget !== portrait) phageOpener = e.currentTarget;
    const agenda = T() ? null : phageAgenda();
    phageRenderPanel(agenda);
    panel.hidden = false;
    panel.dataset.state = 'open';
    note.inert = false;
    document.body.classList.add('phage-open');
    phageSetExpanded(true);
    phageAnimate(true, fresh);
    if (e.detail === 0) note.querySelector('.phage-close').focus({preventScroll:true});
    phageAuto(agenda?.age >= 7 ? 45000 : 25000);
  }
  for (const button of [brand, fab, portrait]) button.addEventListener('click',toggle);
  note.addEventListener('click',e=>{
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
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.dataset.state==='open'&&!document.querySelector('dialog[open]'))phageHide(true);});
  setInterval(()=>{if(!document.hidden)phageSync();},3000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)phageSync();});
}
