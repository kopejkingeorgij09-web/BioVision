// Commands form a chain in the synced bamboo collection. Two offline clients can append
// without overwriting each other's documents. Only one successor advances a given state.
(function(){
const {esc,icon}=B, minute=60000;
const scenes={amber_evening:'Янтарный вечер',forest:'Лес',lake_dawn:'Рассвет у озера',alpine_snow:'Альпийский снег',
  lavender_dusk:'Лавандовые сумерки',pink_mist:'Розовый туман',polar_night:'Полярная ночь',sea_glass:'Морское стекло',
  tea_garden:'Чайный сад',terracotta:'Терракота'};
const channels={rain:'Дождь',fireplace:'Камин',forest:'Лес',brown:'Коричневый шум',white:'Белый шум',ocean:'Океан',wind:'Ветер',cafe:'Кофейня'};
const defaults={mode:'timer',work:25,short:5,long:15,every:4,scene:'amber_evening',dayScene:'lake_dawn',
  nightScene:'amber_evening',masterVolume:70,warmth:56,autoScene:false,card:'',sound:false,chime:true,notify:false,chimeVolume:70,rain:35,fireplace:20};
function pref(k){
  const base=defaults[k] ?? 0,raw=B.get('focuspref_'+k)?.value ?? B.cfg().pomo?.[k] ?? base;
  if(k==='mode')return raw==='pomo'?'pomo':'timer';
  if(k==='scene'||k==='dayScene'||k==='nightScene')return Object.hasOwn(scenes,raw)?raw:base;
  if(k.startsWith('mute_'))return raw===true;
  if(typeof base==='boolean')return raw===true;
  if(typeof base!=='number')return typeof raw==='string'?raw:base;
  const volume=['masterVolume','warmth','chimeVolume'].includes(k)||Object.hasOwn(channels,k);
  return Number.isFinite(Number(raw))?B.clamp(Math.round(Number(raw)),volume?0:1,volume?100:k==='every'?20:180):base;
}
function activeScene(){
  const hour=new Date().getHours();
  return pref(pref('autoScene')?(hour>=7 && hour<19?'dayScene':'nightScene'):'scene');
}
const set=(k,value)=>B.put('focuspref_'+k,{value});
const duration=k=>Math.max(1,Math.min(180,Number(pref(k))||defaults[k]))*minute;
let cacheVersion=-1, path=[];
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
    const advance=finished && mode==='pomo' && old.mode==='pomo' && old.phase==='work' && action==='toggle';
    const count=mode==='pomo' && old?.mode==='pomo' ? (old.count || 0)+(finished && old.phase==='work' ? 1 : 0) : 0;
    const phase=action==='break'||advance ? 'break' : 'work';
    const total=duration(phase==='work'?'work':advance && count%pref('every')===0?'long':'short');
    const card=activeCards().find(c=>c.id===pref('card'));
    timer={id,phase,count:mode==='pomo'?count:0,mode,card:card?.id || '',title:card?.title || '',
      total,left:total,running:true,until:now+total};
    if(card && phase==='work' && card.lane==='plan')B.boardData.move(card,'active');
  }
  B.put('focusop_'+id,{id,parent:head?.id || '',at:now,timer},false,true);
  B.persistLocal();tick();
}
const format=ms=>{const sec=Math.ceil(ms/1000);return B.pad(Math.floor(sec/60))+':'+B.pad(sec%60);};

const activeCards=()=>B.boardData.all(B.today()).filter(card=>card.lane!=='done');
const channelIcons={rain:'cloud',fireplace:'flame',forest:'tree',brown:'wave',white:'wave',ocean:'waves',wind:'wind',cafe:'cup'};
const glyphs={
  wave:'<path d="M3 13h2l2-7 3 13 3-15 3 14 2-8 2 3h1"/>',
  waves:'<path d="M2 8c3 0 3-3 6-3s3 3 6 3 3-3 6-3M2 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/>',
  wind:'<path d="M3 9h12a3 3 0 1 0-3-3M2 13h16a3 3 0 1 1-3 3M4 17h4"/>',
  cup:'<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2.5 2.5 0 0 1 0 5h-2M3 21h16M7 3v3m4-3v3"/>',
  sliders:'<path d="M3 6h3m5 0h10M3 12h10m5 0h3M3 18h2m5 0h11"/><circle cx="8.5" cy="6" r="2.5"/><circle cx="15.5" cy="12" r="2.5"/><circle cx="7.5" cy="18" r="2.5"/>',
  sound:'<path d="M4 9h4l5-4v14l-5-4H4zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  muted:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>'
};
const symbol=k=>glyphs[k]?`<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${glyphs[k]}</svg>`:icon(k);
const quickOrder=['rain','fireplace','forest','ocean','wind','cafe','brown','white'];
const presets={
  hearth:{name:'У камина',values:{fireplace:70,rain:36,brown:10,warmth:75}},
  woodland:{name:'После дождя',values:{forest:74,rain:18,wind:15,warmth:54}},
  shore:{name:'У моря',values:{ocean:72,wind:27,warmth:42}}
};
const options=(obj,value)=>Object.entries(obj).map(([k,title])=>`<option value="${esc(k)}" ${k===value?'selected':''}>${esc(title)}</option>`).join('');
const inFocus=()=>/^#\/board\/focus(?:\/|$)/.test(location.hash);
const subpage=()=>['customize','themes','atmosphere'].includes(location.hash.split('/')[3])?'customize':'studio';
const isStudio=()=>inFocus() && subpage()==='studio';
let audio, bus, warmthFilter, unlocked=false, audioError='',lastEnded='',lastNative='',widgetKey='',widgetDay='';
let engineTransport='',legacyStart=0;
const buffers=new Map(),live=new Map(),preview=new Map();
const mixValue=key=>preview.has(key)?preview.get(key):pref(key);
function transport(now=Date.now()){
  const data=B.get('focuspref_sound') || {};
  const playing=pref('sound'), elapsed=Number(data.elapsed) || 0;
  // Older clients only stored the on/off switch.
  if(playing && !data.at && !legacyStart)legacyStart=now;
  if(!playing)legacyStart=0;
  return {playing,at:data.at || legacyStart,elapsed,
    position:elapsed+(playing?Math.max(0,now-(data.at || legacyStart)):0)};
}
function setTransport(playing,reset=false){
  const now=Date.now(), elapsed=reset?0:transport(now).position;
  B.put('focuspref_sound',{value:playing,elapsed,at:now});
  mix();
}
async function unlock(){
  try{
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if(!bus){
      bus=audio.createGain();
      warmthFilter=audio.createBiquadFilter();warmthFilter.type='highshelf';warmthFilter.frequency.value=2400;
      const limiter=audio.createDynamicsCompressor();
      limiter.threshold.value=-12;limiter.knee.value=8;limiter.ratio.value=5;
      warmthFilter.connect(bus);bus.connect(limiter);limiter.connect(audio.destination);
    }
    if(audio.state!=='running')await audio.resume();
    unlocked=audio.state==='running';audioError='';mix();
  }catch{audioError='На этом устройстве не удалось включить звук';B.toast(audioError);}
}
async function buffer(name){
  if(!buffers.has(name))buffers.set(name,fetch('focus/audio/'+name+'.m4a?v=2')
    .then(r=>{if(!r.ok)throw Error(String(r.status));return r.arrayBuffer();}).then(raw=>audio.decodeAudioData(raw))
    .catch(error=>{buffers.delete(name);throw error;}));
  return buffers.get(name);
}
function stopChannel(key){
  const slot=live.get(key);live.delete(key);
  if(!slot?.node)return;
  const now=audio.currentTime;
  slot.gain.gain.cancelScheduledValues(now);
  slot.gain.gain.setTargetAtTime(0,now,.025);
  slot.node.stop(now+.14);
}
function mix(){
  if(!unlocked)return;
  const t=transport(), version=[t.playing,t.at,t.elapsed].join('/');
  if(version!==engineTransport){for(const key of live.keys())stopChannel(key);engineTransport=version;}
  bus.gain.setTargetAtTime(mixValue('masterVolume')/100,audio.currentTime,.05);
  warmthFilter.gain.setTargetAtTime((50-mixValue('warmth'))*.14,audio.currentTime,.07);
  for(const key in channels){
    const value=t.playing && !pref('mute_'+key)?mixValue(key)/100:0;
    const playing=live.get(key);
    if(!value){if(playing)stopChannel(key);continue;}
    if(playing){playing.gain?.gain.setTargetAtTime(value,audio.currentTime,.05);continue;}
    const slot={};live.set(key,slot);
    buffer(key).then(buf=>{
      if(live.get(key)!==slot)return;
      const node=audio.createBufferSource(),gain=audio.createGain();
      node.buffer=buf;node.loop=true;gain.gain.value=0;
      gain.gain.setTargetAtTime(mixValue(key)/100,audio.currentTime,.1);
      node.connect(gain);gain.connect(warmthFilter);Object.assign(slot,{node,gain});
      node.onended=()=>{node.disconnect();gain.disconnect();};
      node.start(0,(transport().position/1000)%buf.duration);
    }).catch(()=>{if(live.get(key)!==slot)return;live.delete(key);audioError='Не удалось загрузить запись «'+channels[key]+'»';B.toast(audioError);});
  }
}
async function playChime(){
  try{
    const buf=await buffer('chime'),node=audio.createBufferSource(),gain=audio.createGain();
    gain.gain.value=pref('chimeVolume')/100;node.buffer=buf;node.connect(gain);gain.connect(audio.destination);
    node.onended=()=>{node.disconnect();gain.disconnect();};node.start();
  }catch{B.toast('Не удалось воспроизвести сигнал');}
}
function updateNative(label){
  if(!window.ZovDesktop || label===lastNative)return;
  lastNative=label;window.ZovDesktop.postMessage(JSON.stringify({op:'focusClock',label}));
}
function widgetSnapshot(){
  const now=Date.now(),s=current()?.timer, day=B.today(), list=sessions(now);
  return {title:s?.title || (s?.phase==='break'?'Перерыв':'Фокус'),until:s?.running?s.until:0,notify:pref('notify'),
    chime:pref('chime') && pref('chimeVolume')>0,
    clock:format(s?.running?0:s?.left ?? duration('work')),scene:activeScene(),
    plan:activeCards().slice(0,3).map(c=>c.title.slice(0,150)),
    week:Array.from({length:7},(_,i)=>list.filter(x=>x.day===B.add(day,i-6)).reduce((n,x)=>n+x.minutes,0))};
}
function syncWidget(){
  if(!window.ZovDesktop)return;
  const snapshot=widgetSnapshot(),key=JSON.stringify(snapshot);
  if(key!==widgetKey){widgetKey=key;window.ZovDesktop.postMessage(JSON.stringify({op:'focusWidget',snapshot}));}
  widgetDay=B.today();
}
function alertEnd(s){
  const text=s.phase==='break'?'Перерыв завершён':s.mode==='pomo'?'Интервал помодоро завершён':'Таймер завершён';
  B.toast(text);
  if(unlocked && pref('chime'))void playChime();
  if(pref('notify') && !window.ZovDesktop && !window.ZovReminder && window.Notification?.permission==='granted'){
    const options={body:s.title || 'Зов леса',tag:'zov-focus-'+s.id,silent:true};
    const display=async()=>{
      const registration=await navigator.serviceWorker?.getRegistration();
      if(registration)await registration.showNotification(text,options);
      else new Notification(text,options);
    };
    display().catch(()=>{});
  }
}
let lastScene='';
function tick(){
  const s=current()?.timer,now=Date.now(),done=expired(s,now);
  const time=format(s?remaining(s,now):duration('work'));
  const clock=document.querySelector('[data-focus-clock]');if(clock && clock.textContent!==time)clock.textContent=time;
  const line=document.querySelector('[data-focus-progress]');
  if(line)line.value=s?B.clamp(1-remaining(s,now)/s.total,0,1):0;
  const scene=activeScene();
  if(scene!==lastScene){
    lastScene=scene;
    const room=document.querySelector('.focus-room');
    if(room && room.dataset.scene!==scene)B.render();
    syncWidget();
  }else if(window.ZovDesktop && widgetDay!==B.today())syncWidget();
  updateNative(s&&!done?(s.running?'':'Ⅱ ')+time:'');
  if(!done){lastEnded='';return;}
  if(lastEnded===s.id)return;
  lastEnded=s.id;syncWidget();
  if(now-s.until<60000)alertEnd(s);
  if(inFocus())B.render();
}


function act(action,label,iconName,cls='',extra=''){
  return `<button type="button" class="fr-button ${cls}" data-act="${action}" ${extra}>${iconName?symbol(iconName):''}<span>${esc(label)}</span></button>`;
}
function iconButton(action,label,iconName,extra=''){
  return `<button type="button" class="fr-icon" data-act="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${symbol(iconName)}</button>`;
}
const soundPlaying=()=>pref('sound') && unlocked && audio.state==='running';
const playLabel=()=>soundPlaying()?'Приостановить фон':'Воспроизвести фон';
const audible=()=>quickOrder.filter(k=>!pref('mute_'+k) && pref(k)>0);
function fader(key,label,compact=false){
  const value=pref(key), channel=Object.hasOwn(channels,key), muted=channel && pref('mute_'+key);
  return `<div class="fr-fader ${compact?'fr-compact':''}" data-muted="${muted}">
    ${channel?iconButton('focusMute',muted?'Включить канал «'+label+'»':'Выключить канал «'+label+'»',channelIcons[key],
        `data-key="${key}" aria-pressed="${!muted}"`):''}
    <label><span>${esc(label)}</span><output aria-hidden="true">${value}%</output>
    <input type="range" min="0" max="100" value="${value}" style="--volume:${value}%" data-in="focusPref" data-key="${key}" aria-label="${esc(label)}"></label></div>`;
}
function miniPlayer(){
  const selected=audible(), summary=selected.map(k=>channels[k]).join(' · ') || 'Тишина';
  const keys=[...new Set([...selected,...quickOrder])].slice(0,5);
  const folded=selected.length>2?selected.slice(0,2).map(k=>channels[k]).join(' · ')+' +'+(selected.length-2):summary;
  return `<div class="fr-player">
    ${iconButton('focusSound',playLabel(),soundPlaying()?'pause':'play')}
    <details class="fr-quick" data-fold="focus-quick"><summary aria-label="Быстрый микшер · ${esc(summary)}">
      <span class="fr-playing" data-playing="${soundPlaying()}">${soundPlaying()?'Играет':'На паузе'}</span>
      <strong>${esc(folded)}</strong>${symbol('sliders')}</summary>
      <section class="fr-pop"><div class="fr-card-heading"><h3>Быстрый микшер</h3>${iconButton('focusAudioReset','Сбросить воспроизведение фона','repeat')}</div>
        ${keys.map(k=>fader(k,channels[k],true)).join('')}
        <a class="fr-pop-link" href="#/board/focus/customize">Весь микшер и темы ${icon('arrow')}</a>
      </section></details>
    ${iconButton('focusAudioReset','Сбросить фон к началу','repeat')}</div>`;
}
function studio(){
  const s=current()?.timer,now=Date.now(),done=expired(s,now),pomo=pref('mode')==='pomo';
  const phase=s?.phase==='break'?'Перерыв':pomo?'Помодоро':'Таймер';
  const status=done?'Завершён':s?.running?'Идёт отсчёт':s?'На паузе':'Готов к старту';
  const start=s&&!done?s.running?'Пауза':'Продолжить':done&&pomo&&s?.phase==='work'?'Начать перерыв':pomo?'Начать помодоро':'Запустить таймер';
  const chosen=activeCards().find(c=>c.id===pref('card'));
  const cycle=pomo && s && s.mode==='pomo' ? (s.phase==='break'?Math.max(0,s.count-1):s.count)%pref('every')+1 : 1;
  return `<section class="fr-studio" aria-label="Таймер и атмосфера">
    <div class="fr-studio-tools"><div class="fr-modes" aria-label="Режим таймера">
      ${[['timer','Таймер','timer'],['pomo','Помодоро','repeat']].map(([k,name,ic])=>act('focusMode',name,ic,'',`data-mode="${k}" aria-pressed="${pref('mode')===k}"`)).join('')}</div>
      ${miniPlayer()}</div>
    <div class="fr-clock-panel"><p class="fr-state" data-running="${!!s?.running&&!done}"><i></i>${phase} · ${status}</p>
      <strong class="fr-clock" data-focus-clock>${format(s?remaining(s,now):duration('work'))}</strong>
      <p class="fr-task-title">${esc((s && !done?s.title:chosen?.title)|| (pomo?'Интервал '+cycle+' из '+pref('every'):'Сеанс фокуса'))}</p>
      <progress class="fr-progress" data-focus-progress aria-label="Выполнено времени" max="1" value="${s?B.clamp(1-remaining(s,now)/s.total,0,1):0}"></progress>
      <div class="fr-transports">${act('focusToggle',start,s?.running&&!done?'pause':'play','fr-primary')}
        ${iconButton('focusReset','Сбросить таймер','repeat',s?'':'disabled')}
        ${pomo && (!s || s.phase!=='break') && !(done && s.phase==='work')?act('focusBreak','Перерыв','cup','fr-secondary'):''}</div>
    </div>
    <footer class="fr-studio-foot"><button type="button" class="fr-task-select" data-act="focusSettings">${icon('timer')}<span>${pomo?pref('work')+' / '+pref('short')+' мин':pref('work')+' мин'}<em>Настроить сеанс</em></span>${symbol('sliders')}</button>
      ${act('focusWeek','Моя неделя','chart','fr-week-link')}</footer>
    </section>`;
}
function custom(){
  const mixes=B.list('focusmix_').filter(m=>m?.id && m.name).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  return `<div class="fr-custom">
    <section class="fr-panel fr-look"><header class="fr-card-heading"><h2>Темы</h2>
      <button class="fr-text" type="button" data-act="focusSchedule" title="Смена темы по времени">${icon(pref('autoScene')?'sun':'clock')} ${pref('autoScene')?'По времени':'Вручную'}</button></header>
      <div class="fr-gallery">${Object.entries(scenes).map(([k,name])=>`<button class="fr-scene" type="button" data-act="focusScene" data-scene="${k}" aria-pressed="${activeScene()===k}" style="--thumb:url('focus/scenes/${k}.jpg')"><span>${esc(name)}</span>${activeScene()===k?icon('check'):''}</button>`).join('')}</div>
      <button type="button" class="fr-credit" data-act="focusCredits">Авторы записей и фотографий</button>
    </section>
    <section class="fr-panel fr-mixer"><header class="fr-card-heading"><h2>Микшер</h2><div class="fr-small-controls">${act('focusSound',soundPlaying()?'Пауза':'Слушать',soundPlaying()?'pause':'play','fr-small-play')+iconButton('focusAudioReset','Сбросить воспроизведение фона','repeat')}</div></header>
      <div class="fr-presets"><label><span>Микс</span><select aria-label="Выбрать звуковой микс" data-in="focusPreset">
        <option value="">Текущий микс</option><optgroup label="Готовые миксы">${options(Object.fromEntries(Object.entries(presets).map(([k,p])=>['base:'+k,p.name])),'')}</optgroup>
        ${mixes.length?`<optgroup label="Мои миксы">${options(Object.fromEntries(mixes.map(m=>['saved:'+m.id,m.name])),'')}</optgroup>`:''}</select></label>
        ${iconButton('focusMixSheet','Сохранить микс или изменить коллекцию','plus')}</div>
      <div class="fr-channel-grid">${Object.entries(channels).map(([k,title])=>fader(k,title)).join('')}</div>
      <div class="fr-master">${fader('masterVolume','Общая громкость')+fader('warmth','Теплота звука')}</div>
      <div class="fr-mixer-foot">${act('focusSignal','Сигнал завершения','bell','fr-text')+act('focusChime','Прослушать','play','fr-text')}</div>
      ${audioError?`<p class="fr-audio-error" role="status">${esc(audioError)}</p>`:''}
    </section></div>`;
}
let legacyRoute='';
function render(){
  const section=location.hash.split('/')[3] || 'studio', scene=activeScene(), view=subpage(), route=location.hash;
  if(['week','plan'].includes(section) && legacyRoute!==route){
    legacyRoute=route;
    setTimeout(()=>{if(location.hash===route)(section==='week'?B.acts.focusWeek:B.acts.focusPlan)();},0);
  }else if(!['week','plan'].includes(section))legacyRoute='';
  return `<div class="focus-room" data-scene="${scene}" data-view="${view}" style="--scene-image:url('focus/scenes/${scene}.jpg')">
    <div class="fr-top"><nav class="fr-nav" aria-label="Разделы фокуса">
      <a href="#/board/focus/studio" ${view==='studio'?'aria-current="page"':''}>${icon('timer')} Фокус</a>
      <a href="#/board/focus/customize" ${view==='customize'?'aria-current="page"':''}>${symbol('sliders')} Кастомизация</a>
    </nav><span class="fr-location">${icon('img')}${esc(scenes[scene])}</span></div>
    ${view==='studio'?studio():custom()}</div>`;
}


B.acts.focusToggle=()=>{void unlock();append('toggle');};
B.acts.focusReset=()=>{if(current()?.timer)append('reset');};
B.acts.focusBreak=()=>{void unlock();append('break');};
B.acts.focusMode=async el=>{
  const mode=el.dataset.mode, head=current();
  if(!['timer','pomo'].includes(mode)||pref('mode')===mode)return;
  if(head?.timer && !expired(head.timer,Date.now())){
    if(!await B.confirm('Сменить режим и сбросить текущий отсчёт?', 'Сменить режим'))return;
    if(current()?.id!==head.id)return;
  }
  if(current()?.timer)append('reset');
  set('mode',mode);B.render(true);
};
B.acts.focusSound=async()=>{
  if(soundPlaying()){setTransport(false);return;}
  await unlock();
  if(!unlocked)return;
  if(!pref('sound'))setTransport(true);
  B.render();
};
B.acts.focusAudioReset=()=>{setTransport(false,true);B.toast('Воспроизведение сброшено');};
B.acts.focusMute=el=>{const k=el.dataset.key;if(Object.hasOwn(channels,k))set('mute_'+k,!pref('mute_'+k));};
B.acts.focusScene=el=>{
  const scene=el.dataset.scene;if(!Object.hasOwn(scenes,scene))return;
  if(pref('autoScene'))set('autoScene',false);
  set('scene',scene);
};
B.acts.focusChime=async()=>{await unlock();if(unlocked)await playChime();};
function input(key,title,max){
  return `<label class="field">${title}<input type="number" min="1" max="${max}" value="${pref(key)}" data-key="${key}" data-in="focusPref"></label>`;
}
B.acts.focusSettings=()=>{
  const pomo=pref('mode')==='pomo';
  B.sheet(`<h2>${pomo?'Настройки помодоро':'Настройки таймера'}</h2><div class="fr-sheet-fields">
    ${input('work',pomo?'Рабочий интервал, мин':'Длительность, мин',180)}
    ${pomo?input('short','Короткий перерыв, мин',180)+input('long','Длинный перерыв, мин',180)+input('every','Интервалов до длинного перерыва',20):''}
    <label class="field fr-sheet-wide">Дело на сеанс<select data-in="focusPref" data-key="card">${options(Object.fromEntries([['','Без привязки'],...activeCards().map(c=>[c.id,c.title])]),pref('card'))}</select></label>
    </div>${current()?.timer && !expired(current()?.timer,Date.now())?'<p class="hint">Настройки применятся к следующему сеансу.</p>':''}
    <div class="fr-sheet-foot"><button class="btn" data-act="focusSignal">${icon('bell')} Сигнал завершения</button><button class="btn primary" data-act="closeSheet">Готово</button></div>`);
};
function togglePref(k,label){
  return `<label class="fr-toggle"><input type="checkbox" data-in="focusPref" data-key="${k}" ${pref(k)?'checked':''}>${label}</label>`;
}
B.acts.focusSignal=()=>{
  const canNotify=window.ZovDesktop || window.ZovReminder || 'Notification' in window;
  B.sheet(`<h2>Сигнал завершения</h2><div class="fr-sheet-fields fr-sheet-single">
    ${togglePref('chime','Проигрывать перезвон')}${fader('chimeVolume','Громкость перезвона')}
    ${canNotify?togglePref('notify','Показывать системное уведомление'):''}
    </div><div class="fr-sheet-foot"><button class="btn" data-act="focusChime">${icon('play')} Прослушать</button><button class="btn primary" data-act="closeSheet">Готово</button></div>`);
};
B.acts.focusSchedule=()=>{
  B.sheet(`<h2>Смена темы</h2>${togglePref('autoScene','Менять тему утром и вечером')}
    <div class="fr-sheet-fields">${[['dayScene','С 07:00'],['nightScene','С 19:00']].map(([k,title])=>
      `<label class="field">${title}<select data-in="focusPref" data-key="${k}">${options(scenes,pref(k))}</select></label>`).join('')}</div>
    <div class="fr-sheet-foot"><button class="btn primary" data-act="closeSheet">Готово</button></div>`);
};
B.acts.focusWeek=el=>{
  const today=B.today(),days=Array.from({length:7},(_,i)=>B.add(today,i-6));
  const chosen=days.includes(el?.dataset.day)?el.dataset.day:today,week=sessions().filter(s=>days.includes(s.day)),forDay=week.filter(s=>s.day===chosen);
  const done=B.boardData.history(chosen).done;
  B.sheet(`<h2>Фокус за неделю</h2><p class="hint">${week.reduce((a,s)=>a+s.minutes,0)} мин · сеансов ${week.length}</p>
    <div class="fr-days">${days.map(day=>`<button type="button" class="btn" data-act="focusWeek" data-day="${day}" aria-pressed="${day===chosen}">${esc(B.fmtW(day))}<b>${week.filter(s=>s.day===day).reduce((a,s)=>a+s.minutes,0)} мин</b></button>`).join('')}</div>
    <h3>${esc(B.fmtW(chosen))}</h3>${forDay.map(s=>`<p>${esc(B.hm(s.at))} · ${esc(s.title||'Фокус')} · ${s.minutes} мин</p>`).join('')||'<p>Завершённых сеансов пока нет.</p>'}
    ${done.length?`<h3>Выполнено дел · ${done.length}</h3>${done.map(c=>`<p>✓ ${esc(c.title)}</p>`).join('')}`:''}`);
};
B.acts.focusPlan=()=>{
  const cards=activeCards();
  B.sheet(`<h2>План на сегодня</h2>${cards.map(c=>`<button class="fr-plan-choice btn" data-act="focusPick" data-id="${esc(c.id)}">${esc(c.title)}${icon('right')}</button>`).join('')||'<p>На сегодня нет задач.</p>'}`);
};
B.acts.focusPick=el=>{set('card',el.dataset.id);B.closeSheet();location.hash='#/board/focus/studio';};
B.acts.focusMixSheet=()=>{
  const mixes=B.list('focusmix_').filter(m=>m?.name);
  B.sheet(`<h2>Мои миксы</h2><div class="fr-sheet-fields fr-sheet-single"><label class="field">Название текущего микса<input id="focus-mix-name" maxlength="80" autocomplete="off"></label></div>
    <button class="btn primary" data-act="focusMixSave">Сохранить микс</button>
    ${mixes.map(m=>`<div class="fr-saved"><button class="btn ghost" data-act="focusMixUse" data-id="${esc(m.id)}">${esc(m.name)}</button>
    <button class="icon-btn" data-act="focusMixDelete" data-id="${esc(m.id)}" aria-label="Удалить микс ${esc(m.name)}">${icon('trash')}</button></div>`).join('')}`);
};
const mixKeys=[...Object.keys(channels),...Object.keys(channels).map(k=>'mute_'+k),'masterVolume','warmth'];
B.acts.focusMixSave=()=>{
  const name=B.$('#focus-mix-name').value.trim();if(!name){B.toast('Введи название микса');return;}
  const id=B.uid();B.put('focusmix_'+id,{id,name,values:Object.fromEntries(mixKeys.map(k=>[k,pref(k)]))});
  B.closeSheet();B.toast('Микс сохранён');
};
function applyMix(values){
  if(!values)return;
  for(const k of mixKeys){
    const fallback=k==='masterVolume'||k==='warmth'?pref(k):k.startsWith('mute_')?false:0;
    B.put('focuspref_'+k,{value:values[k]??fallback},true);
  }
  mix();B.emit('change');
}
B.inputs.focusPreset=(el,e)=>{
  if(e.type!=='change' || !el.value)return;
  const [type,id]=el.value.split(':');
  applyMix(type==='base'?presets[id]?.values:B.get('focusmix_'+id)?.values);
  B.toast('Микс применён');
};
B.acts.focusMixUse=el=>{applyMix(B.get('focusmix_'+el.dataset.id)?.values);B.closeSheet();};
B.acts.focusMixDelete=el=>{B.historyToast('Микс удалён',()=>B.put('focusmix_'+el.dataset.id,null));B.acts.focusMixSheet();};
let creditRows;
B.acts.focusCredits=async()=>{
  try{
    if(!creditRows){const response=await fetch('focus/credits.json?v=1');if(!response.ok)throw Error();creditRows=await response.json();}
    const ref=(name,url)=>/^https?:\/\//i.test(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`:esc(name);
    B.sheet(`<h2>Авторы записей и фотографий</h2><p class="hint">Звуковые записи адаптированы для непрерывного воспроизведения.</p><dl class="fr-credits">
      ${creditRows.map(c=>`<dt>${ref(c.title,c.url)}</dt><dd>${esc(c.work || c.title)} · ${esc(c.author)} · ${ref(c.license,c.licenseUrl)}</dd>`).join('')}</dl>`);
  }catch{B.toast('Не удалось открыть сведения об авторах');}
};
B.inputs.focusPref=async(el,ev)=>{
  const k=el.dataset.key;
  if(el.type==='range'){
    const value=Number(el.value),label=el.closest('label');
    label?.querySelector('output')?.replaceChildren(value+'%');el.style.setProperty('--volume',value+'%');
    if(ev.type==='input'){preview.set(k,value);mix();return;}
    preview.delete(k);
  }
  if(ev.type!=='change')return;
  let value=el.type==='checkbox'?el.checked:el.value;
  if(el.type==='range'||el.type==='number'){
    if(!el.validity.valid || value===''){el.value=pref(k);return;}
    value=Number(value);
  }
  if(k==='notify' && value){
    if(window.ZovDesktop)window.ZovDesktop.postMessage(JSON.stringify({op:'focusNotifyEnable'}));
    else if(window.ZovReminder)B.androidReminders?.enable();
    else {
      try{value=await window.Notification.requestPermission()==='granted';}catch{value=false;}
      if(!value){el.checked=false;B.toast('Уведомления выключены в разрешениях браузера');}
    }
  }
  set(k,value);mix();
};
document.addEventListener('click',e=>{
  const open=document.querySelector('.fr-quick[open]');
  if(open && !open.contains(e.target) && !e.target.closest('.fr-player'))open.open=false;
});
document.addEventListener('keydown',e=>{
  const open=document.querySelector('.fr-quick[open]');
  if(e.key==='Escape' && open && !B.sheetOpen()){
    e.preventDefault();e.stopImmediatePropagation();open.open=false;open.querySelector('summary')?.focus();
  }
},true);
B.focus={render,sessions,activity,current,remaining,append,widgetSnapshot,isStudio,notifications:()=>pref('notify')};
B.on('change',()=>{mix();tick();syncWidget();});
addEventListener('zov-clock-resume',tick);
setInterval(tick,500);
})();
