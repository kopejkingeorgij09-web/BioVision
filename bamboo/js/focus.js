// Commands form a chain in the synced bamboo collection. Two offline clients can append
// without overwriting each other's documents. Only one successor advances a given state.
(function(){
const {esc}=B, minute=60000;
const scenes={amber_evening:'Янтарный вечер',forest:'Лес',lake_dawn:'Рассвет у озера',alpine_snow:'Альпийский снег',
  lavender_dusk:'Лавандовые сумерки',pink_mist:'Розовый туман',polar_night:'Полярная ночь',sea_glass:'Морское стекло',
  tea_garden:'Чайный сад',terracotta:'Терракота'};
const channels={rain:'Дождь',fireplace:'Камин',forest:'Лес',brown:'Коричневый шум',white:'Белый шум',ocean:'Океан',wind:'Ветер',cafe:'Кофейня'};
const defaults={mode:'timer',work:25,short:5,long:15,every:4,scene:'amber_evening',dayScene:'lake_dawn',
  nightScene:'amber_evening',autoScene:false,card:'',sound:false,chime:true,notify:false,chimeVolume:70,rain:35,fireplace:20};
function pref(k){
  const base=defaults[k] ?? 0,raw=B.get('focuspref_'+k)?.value ?? B.cfg().pomo?.[k] ?? base;
  if(k==='mode')return raw==='pomo'?'pomo':'timer';
  if(k==='scene'||k==='dayScene'||k==='nightScene')return Object.hasOwn(scenes,raw)?raw:base;
  if(k.startsWith('mute_'))return raw===true;
  if(typeof base==='boolean')return raw===true;
  if(typeof base!=='number')return typeof raw==='string'?raw:base;
  const volume=k==='chimeVolume'||Object.hasOwn(channels,k);
  return Number.isFinite(Number(raw))?B.clamp(Math.round(Number(raw)),volume?0:1,volume?100:k==='every'?20:180):base;
}
function activeScene(){
  const hour=new Date().getHours();
  return pref(pref('autoScene')?(hour>=7 && hour<19?'dayScene':'nightScene'):'scene');
}
const set=(k,value)=>B.put('focuspref_'+k,{value});
const duration=k=>Math.max(1,Math.min(180,Number(pref(k))||defaults[k]))*minute;
let view='studio', detail='', cacheVersion=-1, path=[];
function chain(){
  if(cacheVersion===B.ver)return path;
  const children=new Map();
  for(const op of B.list('focusop_')){
    const sibling=children.get(op.parent);
    if(!sibling || op.at<sibling.at || op.at===sibling.at && op.id<sibling.id)children.set(op.parent,op);
  }
  path=[];
  for(let op=children.get('');op;op=children.get(op.id))path.push(op);
  cacheVersion=B.ver;
  return path;
}
const current=()=>chain().at(-1);
const remaining=(s,now)=>s?.running ? Math.max(0,s.until-now) : s?.left || 0;
const expired=(s,now)=>!!s?.running && s.until<=now;
function sessions(now=Date.now()){
  const ops=chain(), out=[];
  ops.forEach((op,i)=>{
    const s=op.timer;
    if(s?.phase==='work' && expired(s,Math.min(now,ops[i+1]?.at ?? now)))
      out.push({id:s.id,day:B.dayOf(s.until),at:s.until,minutes:s.total/minute,title:s.title});
  });
  return out;
}
function activity(day){
  return chain().flatMap((op,i,ops)=>{
    if(B.dayOf(op.at)!==day)return [];
    const previous=ops[i-1]?.timer, timer=op.timer;
    const action=!timer?'сброс':!timer.running?'пауза':timer.id===previous?.id?'продолжение':timer.phase==='break'?'перерыв':'старт';
    return [{время:B.hm(op.at),действие:action,дело:(timer || previous)?.title || undefined}];
  });
}
function append(action){
  const head=current(), now=Math.max(Date.now(),head?.at || 0), old=head?.timer, finished=expired(old,now);
  const id=B.uid(), mode=pref('mode');
  let timer;
  if(action==='toggle' && old && !finished){
    timer=old.running ? {...old,running:false,left:remaining(old,now)} : {...old,running:true,until:now+old.left};
  } else if(action==='reset')timer=null;
  else{
    const advance=finished && old.mode==='pomo' && old.phase==='work' && action==='toggle';
    const count=(old?.count || 0)+(finished && old.phase==='work'?1:0);
    const phase=action==='break'||advance ? 'break' : 'work';
    const total=duration(phase==='work'?'work':advance && count%pref('every')===0?'long':'short');
    const card=B.boardData.get(String(pref('card')||''));
    timer={id,phase,count:mode==='pomo'?count:0,mode,card:card?.id || '',title:card?.title || '',
      total,left:total,running:true,until:now+total};
    if(card && phase==='work' && card.lane==='plan')B.boardData.move(card,'active');
  }
  B.put('focusop_'+id,{id,parent:head?.id || '',at:now,timer},false,true);
  B.persistLocal();tick();
}
const format=ms=>{const sec=Math.ceil(ms/1000);return B.pad(Math.floor(sec/60))+':'+B.pad(sec%60);};
let widgetKey='',widgetDay='';
let context,master,unlocked=false,notice='',lastEnded='',lastNative='';
const buffers=new Map(),live=new Map();
async function unlock(){
  try{
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if(!master){master=context.createGain();master.gain.value=.64;master.connect(context.destination);}
    if(context.state!=='running')await context.resume();
    unlocked=true;notice='';mix();
  }catch{notice='Звук недоступен на этом устройстве';B.toast(notice);}
}
async function buffer(name){
  if(!buffers.has(name))buffers.set(name,fetch('focus/audio/'+name+'.m4a?v=1')
    .then(r=>{if(!r.ok)throw Error(r.status);return r.arrayBuffer();}).then(raw=>context.decodeAudioData(raw))
    .catch(err=>{buffers.delete(name);throw err;}));
  return buffers.get(name);
}
function mix(){
  if(!unlocked)return;
  for(const key in channels){
    const value=pref('sound')&&!pref('mute_'+key)?pref(key)/100:0, playing=live.get(key);
    if(playing && !value){playing.node?.stop();playing.gain?.disconnect();live.delete(key);}
    if(playing && value && playing.gain)playing.gain.gain.setTargetAtTime(value,context.currentTime,.06);
    if(playing || !value)continue;
    const slot={};live.set(key,slot);
    buffer(key).then(buf=>{
      if(live.get(key)!==slot)return;
      const node=context.createBufferSource(),gain=context.createGain();
      node.buffer=buf;node.loop=true;gain.gain.value=Number(pref(key))/100;
      node.connect(gain);gain.connect(master);Object.assign(slot,{node,gain});node.start();
    }).catch(()=>{if(live.get(key)===slot)live.delete(key);notice='Не удалось загрузить '+channels[key];B.toast(notice);});
  }
}
function updateNative(label){
  if(!window.ZovDesktop || label===lastNative)return;
  lastNative=label;window.ZovDesktop.postMessage(JSON.stringify({op:'focusClock',label}));
}
function widgetSnapshot(){
  const now=Date.now(),s=current()?.timer, day=B.today(), list=sessions(now);
  return {title:s?.title || (s?.phase==='break'?'Перерыв':'Фокус'),until:s?.running?s.until:0,notify:pref('notify'),
    clock:format(s?.running?0:s?.left ?? duration('work')),scene:activeScene(),
    plan:planGroups()['На сегодня'].slice(0,3).map(c=>c.title.slice(0,150)),
    week:Array.from({length:7},(_,i)=>list.filter(x=>x.day===B.add(day,i-6)).reduce((n,x)=>n+x.minutes,0))};
}
function syncWidget(){
  if(!window.ZovDesktop)return;
  const snapshot=widgetSnapshot(), key=JSON.stringify(snapshot);
  if(key!==widgetKey){widgetKey=key;window.ZovDesktop.postMessage(JSON.stringify({op:'focusWidget',snapshot}));}
  widgetDay=B.today();
}
async function playChime(){
  try{
    const buf=await buffer('chime'),node=context.createBufferSource(),gain=context.createGain();
    gain.gain.value=pref('chimeVolume')/100;node.buffer=buf;node.connect(gain);gain.connect(master);
    node.onended=()=>gain.disconnect();node.start();
  }catch{B.toast('Не удалось воспроизвести перезвон');}
}
let lastScene='';
function tick(){
  const s=current()?.timer, now=Date.now(), done=expired(s,now);
  const time=format(s?remaining(s,now):duration('work'));
  const clock=document.querySelector('[data-focus-clock]');if(clock)clock.textContent=time;
  const scene=activeScene();
  if(scene!==lastScene){
    lastScene=scene;
    document.querySelector('.fo-studio')?.style.setProperty('--scene-image',"url('focus/scenes/"+scene+".jpg')");
    if(window.ZovDesktop)syncWidget();
  }else if(window.ZovDesktop && widgetDay!==B.today())syncWidget();
  updateNative(s&&!done?(s.running?'':'Ⅱ ')+time:'');
  if(!done){lastEnded='';return;}
  if(lastEnded===s.id)return;
  lastEnded=s.id;syncWidget();
  if(unlocked && pref('chime') && now-s.until<15000)void playChime();
  if(location.hash.startsWith('#/board/focus'))B.render();
}
const button=(act,title,cls='')=>`<button type="button" class="btn ${cls}" data-act="${act}">${title}</button>`;
const activeCards=()=>B.boardData.all().filter(c=>c.lane!=='done');
function studio(){
  const s=current()?.timer, done=expired(s,Date.now()), scene=activeScene();
  const label=s?s.phase==='break'?'Перерыв':'Фокус':'Таймер';
  const cards=activeCards();
  return `<section class="fo-studio" style="--scene-image:url('focus/scenes/${scene}.jpg')">
  <div class="fo-mode">${label} · ${done?'Завершён':s?.running?'Идёт отсчёт':s?'Пауза':'Готов к старту'}</div>
  <strong data-focus-clock>${format(s?remaining(s,Date.now()):duration('work'))}</strong>
  <span>${esc(s?.title||'')}</span>
  <div class="row wrap">${button('focusToggle',s&&!done?(s.running?'Пауза':'Продолжить'):done&&s.phase==='work'&&s.mode==='pomo'?'Начать перерыв':'Начать фокус','primary')}
  ${s?button('focusReset','Сбросить'):''}${button('focusBreak','Перерыв · '+pref('short')+' мин')}</div></section>
  <section class="card fo-prefs"><label class="field">Режим<select data-in="focusPref" data-key="mode">${options({timer:'Обычный таймер',pomo:'Помодоро'},pref('mode'))}</select></label>
  <label class="field">Дело для следующего сеанса<select data-in="focusPref" data-key="card">${options(Object.fromEntries([['','Без привязки'],...cards.map(c=>[c.id,c.title])]),pref('card'))}</select></label>
  ${[['work','Фокус, мин'],['short','Перерыв, мин'],...(pref('mode')==='pomo'?[['long','Длинный перерыв, мин'],['every','Сеансов до длинного перерыва']]:[])].map(([k,t])=>
  `<label class="field">${t}<input type="number" min="1" max="${k==='every'?20:180}" value="${pref(k)}" data-in="focusPref" data-key="${k}"></label>`).join('')}</section>`;
}
function options(obj,value){return Object.entries(obj).map(([k,t])=>`<option value="${esc(k)}" ${k===value?'selected':''}>${esc(t)}</option>`).join('');}
function atmosphere(){
  const mixes=B.list('focusmix_').sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  return `<section class="card"><h2>Атмосфера</h2><div class="row wrap">${button('focusSound',pref('sound')?(unlocked?'Выключить фон':'Включить на устройстве'):'Включить фон','primary')}
    </div>${Object.entries(channels).map(([k,title])=>`<div class="fo-volume"><label><input type="checkbox" data-in="focusChannel" data-key="${k}" ${pref('mute_'+k)?'':'checked'}> ${title}</label><input type="range" min="0" max="100" aria-label="Громкость · ${title}" value="${pref(k)}" data-in="focusPref" data-key="${k}"></div>`).join('')}
    ${notice?`<p class="hint">${esc(notice)}</p>`:''}</section>
    <section class="card"><h2>Сохранённые миксы</h2>${mixes.map(m=>`<div class="row wrap"><button class="btn" data-act="focusMixUse" data-id="${esc(m.id)}">${esc(m.name)}</button><button class="btn sm" data-act="focusMixDelete" data-id="${esc(m.id)}" aria-label="Удалить микс ${esc(m.name)}">Удалить</button></div>`).join('')}
    <div class="row wrap"><label class="field">Название микса<input id="focus-mix-name" maxlength="80"></label>${button('focusMixSave','Сохранить микс')}</div></section>
    <section class="card"><h2>Финальный перезвон</h2><label><input type="checkbox" data-in="focusPref" data-key="chime" ${pref('chime')?'checked':''}> Сигнал завершения</label>
    ${window.ZovDesktop || window.ZovReminder?`<label><input type="checkbox" data-in="focusPref" data-key="notify" ${pref('notify')?'checked':''}> Системное уведомление о завершении</label>`:''}
    <label class="fo-gain">Громкость <input type="range" min="0" max="100" value="${pref('chimeVolume')}" data-in="focusPref" data-key="chimeVolume"></label>${button('focusChime','Прослушать')}</section>`;
}
function week(){
  const end=B.today(),days=Array.from({length:7},(_,i)=>B.add(end,i-6)), list=sessions().filter(x=>days.includes(x.day));
  const rows=days.map(day=>({day,list:list.filter(x=>x.day===day),done:B.boardData.history(day).done}));
  const peak=Math.max(1,...rows.map(r=>r.list.reduce((a,x)=>a+x.minutes,0)));
  const r=rows.find(r=>r.day===(detail||end)) || rows.at(-1);
  return `<section class="card"><h2>Моя неделя</h2><p>${list.reduce((a,x)=>a+x.minutes,0)} мин фокуса · сеансов ${list.length} · выполнено дел ${rows.reduce((a,r)=>a+r.done.length,0)}</p>
    <div class="fo-week">${rows.map(r=>{const n=r.list.reduce((a,x)=>a+x.minutes,0);return `<button class="btn" data-act="focusDay" data-day="${r.day}" aria-pressed="${r.day===(detail||end)}"><span>${B.fmtW(r.day)}</span>${B.bar(n/peak)}<b>${n} мин</b></button>`;}).join('')}</div>
    <h3>${B.fmtW(r.day)}</h3>${r.list.map(x=>`<p>${esc(x.title||'Фокус')} · ${x.minutes} мин</p>`).join('') || '<p>Завершённых сеансов пока нет.</p>'}
    ${r.done.map(x=>`<p>✓ ${esc(x.title)}</p>`).join('')}</section>`;
}
function planGroups(){
  const today=B.today(),tomorrow=B.add(today,1),groups={'На сегодня':[],'На завтра':[],'Готово сегодня':[]};
  const study=new Set(B.shadOn(today).map(x=>'shad:'+x.kind+':'+x.p.n));
  for(const c of B.boardData.all(today)){
    const t=c.source==='task'?B.task(c.ref):null;
    let due=t?.due || c.on;
    if(c.source==='board' || study.has(c.id))due=today;
    if(c.source==='phagi')due=B.phx.dl[c.ref]?.due;
    if(c.lane==='done'){
      if(t?.doneAt && B.dayOf(t.doneAt)===today || c.placed && B.dayOf(c.placed)===today || c.on===today)groups['Готово сегодня'].push(c);
    }else if(due===tomorrow)groups['На завтра'].push(c);
    else if(t && (!due || due<=today) || due===today || c.lane==='active')groups['На сегодня'].push(c);
  }
  return groups;
}
function plan(){
  const groups=planGroups();
  return `<section class="card"><h2>План дня</h2>${button('focusAdd','Добавить дело')}
    ${Object.entries(groups).map(([title,list])=>`<h3>${title}</h3>${list.length?list.map(c=>`<div class="fo-plan">
      <button class="link fo-task" data-act="boardEdit" data-id="${esc(c.id)}">${esc(c.title)}</button>
      ${c.lane!=='done'?`<button class="btn sm" data-act="focusPick" data-id="${esc(c.id)}">К таймеру</button>`:''}
      ${c.source==='task' && title==='На сегодня'?`<button class="btn sm" data-act="focusTomorrow" data-id="${esc(c.ref)}">На завтра</button>`:''}
      <button class="btn sm" data-act="focusDone" data-id="${esc(c.id)}">${c.lane==='done'?'Вернуть':'Готово'}</button></div>`).join(''):'<p class="muted">Нет дел.</p>'}`).join('')}</section>`;
}
function themes(){return `<section class="card"><h2>Темы студии</h2><div class="fo-scenes">${Object.entries(scenes).map(([k,t])=>
  `<button data-act="focusScene" data-scene="${k}" aria-pressed="${k===activeScene()}" style="background-image:linear-gradient(0deg,#0009,transparent),url('focus/scenes/${k}.jpg')">${t}</button>`).join('')}</div></section>
  <section class="card"><label><input type="checkbox" data-in="focusPref" data-key="autoScene" ${pref('autoScene')?'checked':''}> Менять тему утром и вечером</label>
  ${pref('autoScene')?`<div class="fo-prefs">${[['dayScene','День · с 07:00'],['nightScene','Вечер · с 19:00']].map(([k,t])=>`<label class="field">${t}<select data-in="focusPref" data-key="${k}">${options(scenes,pref(k))}</select></label>`).join('')}</div>`:''}</section>`;}
function render(){
  const tabs={studio:'Студия',plan:'План дня',atmosphere:'Атмосфера',week:'Моя неделя',themes:'Темы'};
  const section=location.hash.split('/')[3];
  if(Object.hasOwn(tabs,section))view=section;
  return `<div class="fo-wrap"><nav class="fo-tabs">${Object.entries(tabs).map(([id,t])=>
    `<button class="btn sm" data-act="focusView" data-view="${id}" aria-pressed="${id===view}">${t}</button>`).join('')}</nav>
    ${{studio,plan,atmosphere,week,themes}[view]()}</div>`;
}
B.acts.focusToggle=()=>{unlock();append('toggle');};
B.acts.focusReset=()=>append('reset');
B.acts.focusBreak=()=>{unlock();append('break');};
B.acts.focusSound=()=>{const enable=!pref('sound')||!unlocked;set('sound',enable);if(enable)unlock().then(()=>B.render());else mix();};
B.acts.focusView=el=>{view=el.dataset.view;location.hash='#/board/focus/'+view;B.render(true);};
B.acts.focusDay=el=>{detail=el.dataset.day;B.render(true);};
B.acts.focusScene=el=>{if(pref('autoScene'))set('autoScene',false);set('scene',el.dataset.scene);};
B.acts.focusChime=async()=>{await unlock();if(unlocked)await playChime();};
B.inputs.focusChannel=(el,ev)=>{if(ev.type==='change')set('mute_'+el.dataset.key,!el.checked);};
B.acts.focusMixSave=()=>{
  const name=B.$('#focus-mix-name').value.trim();if(!name){B.toast('Введи название микса');return;}
  const values={};
  for(const k in channels){values[k]=pref(k);values['mute_'+k]=pref('mute_'+k);}
  const id=B.uid();B.put('focusmix_'+id,{id,name,values});B.toast('Микс сохранён');
};
B.acts.focusMixUse=el=>{
  const preset=B.get('focusmix_'+el.dataset.id);if(!preset)return;
  for(const k in channels)for(const key of [k,'mute_'+k])B.put('focuspref_'+key,{value:preset.values[key]},true);
  set('sound',true);void unlock();
};
B.acts.focusMixDelete=el=>B.historyToast('Микс удалён',()=>B.put('focusmix_'+el.dataset.id,null));
B.acts.focusPick=el=>{set('card',el.dataset.id);B.acts.focusView({dataset:{view:'studio'}});};
B.acts.focusAdd=()=>B.acts.boardAdd({dataset:{lane:'plan',day:B.today()}});
B.acts.focusTomorrow=el=>B.historyToast('Дело перенесено на завтра',()=>B.rescheduleTask(el.dataset.id,B.add(B.today(),1)));
B.acts.focusDone=el=>{const c=B.boardData.get(el.dataset.id);if(c)B.boardData.move(c,c.lane==='done'?'plan':'done');};
B.inputs.focusPref=(el,ev)=>{
  if(ev.type!=='change')return;
  const k=el.dataset.key;
  let value=el.value;
  if(el.type==='range'||el.type==='number'){
    if(!el.validity.valid || value===''){el.value=pref(k);return;}
    value=Number(value);
  }else if(el.type==='checkbox')value=el.checked;
  if(k==='notify' && value){
    B.androidReminders?.enable();
    window.ZovDesktop?.postMessage(JSON.stringify({op:'focusNotifyEnable'}));
  }
  set(k,value);mix();B.render(true);
};
document.addEventListener('keydown',e=>{
  if(!location.hash.startsWith('#/board/focus')||view!=='studio'||B.sheetOpen()||e.repeat||e.target.closest?.('input,textarea,select,button,a,[contenteditable=true]'))return;
  const cmd=e.metaKey || e.ctrlKey;
  const action=!cmd&&e.code==='Space'?'focusToggle':cmd?{KeyR:'focusReset',KeyB:'focusBreak',KeyM:'focusSound'}[e.code]:null;
  if(action){e.preventDefault();B.acts[action]();}
});
B.focus={render,sessions,activity,current,remaining,append,widgetSnapshot,notifications:()=>pref('notify')};
B.on('change',()=>{mix();tick();syncWidget();});
addEventListener('zov-clock-resume',tick);
setInterval(tick,500);
})();
