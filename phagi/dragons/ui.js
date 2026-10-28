/* Драконы в «Карточках»: второй режим мотивации вместо чашки Петри, и страница «Остров драконов».
   Грузится до основного скрипта страницы; S, esc, plural, today, streakInfo, frozenDays, GOAL и др. берутся из него в момент вызова.
   Данные ученицы: srs/<uid>/meta/dragons (тот же поток снимков, что и серия), правила базы уже дают туда запись самой ученице.
   Вся игровая логика в economy.js; здесь только вид, часы острова и запись. */
(function(){
'use strict';
const G=window.DRG,W=window.DRAW,E=window.DECO,I=window.ISL;

const docOf=uid=>(S.drag||{})[uid]||null;
const on=uid=>{const d=docOf(uid);return !!d&&d.mode==='dragons'};

/* часы острова и доход за дни из счётчика карточек */
function ctxOf(uid){
  const st=S.streak[uid]||{},d=docOf(uid)||{},info=streakInfo(st);
  const inc=E.income(st.days||{},frozenDays(st).fz,d.periods,GOAL);
  return {K:inc.K,inc,streak:info.cur,info,uid,today:today()}}
/* состояние на сейчас: старые документы этапа 1 (без v) превращаются в остров с теми же драконами */
function stateOf(uid){
  const d=docOf(uid);if(!d)return null;const c=ctxOf(uid);
  let base=d;if(d.v!==2){base=Object.assign(E.startState(d.dragons||founders(uid)),{mode:d.mode,periods:d.periods});E.settle(base,c.K)}
  return {st:E.normalize(base,c.K,c.inc),c}}

/* ---------- первые драконы: пара с зерном от uid, у каждой ученицы своя ---------- */
function founders(uid){
  const r=G.rng(uid+':founders'),pick=(a,w)=>{let x=r()*w.reduce((s,v)=>s+v,0);for(let i=0;i<a.length;i++){x-=w[i];if(x<0)return a[i]}return a[a.length-1]};
  const coin=(a,b)=>r()<0.5?a:b,pair=f=>f()+'/'+f();
  const col=()=>pick(['C','Cb','c'],[5,3,2]);
  const base=sex=>({sex,S:'S/'+coin('S','s'),C:col()+'/'+col(),H:pair(()=>coin('H','h')),K:pair(()=>coin('K','k')),R:pair(()=>coin('R1','R2')),
    Wg:r()<0.15?'Wg/+':'+/+',Q1:pair(()=>coin('+','-')),Q2:pair(()=>coin('+','-')),Q3:pair(()=>coin('+','-'))});
  const f=Object.assign(base('F'),{E:'F/'+coin('F','e'),M:r()<0.3?'M':'m',N:r()<0.3?'n':'N',Sp:coin('Sp','sp'),G:r()<0.25?'G':'g'});
  const m=Object.assign(base('M'),{E:'W/'+coin('W','e'),M:pair(()=>r()<0.3?'M':'m'),N:pair(()=>r()<0.3?'n':'N')});
  return [{id:'d1',name:'Жара',born:today(),genome:G.make(f)},{id:'d2',name:'Прибой',born:today(),genome:G.make(m)}]}

/* ---------- запись: подтверждённое состояние и ожидающие записи (store.js) ----------
   Свой остров пишется только через хранилище: игрок видит tip, сервер подтверждает conf. При ошибке или конфликте
   новые действия не принимаются, пока не нажаты «Повторить», «Отменить» или «Взять с сервера». Чужие острова только читаются. */
const STORES={};
function storeOf(uid){
  if(uid!==meId()||!window.DRSTORE)return null;
  if(!STORES[uid]){const path=`srs/${uid}/meta/dragons`;
    STORES[uid]=new DRSTORE.Store({read:()=>window.PHCLOUD&&PHCLOUD.fresh?PHCLOUD.fresh(path):S.db.doc(path).get().then(x=>x.exists?x.data():null),
      /* запись уходит только под тем кодом, с которым открыта страница: после выхода или чужого входа в другой вкладке не пишем */
      write:d=>window.PHCLOUD&&PHCLOUD.session&&!PHCLOUD.session()?Promise.reject({code:'session'}):S.db.doc(path).set(d)},{onChange:st=>{S.drag=S.drag||{};S.drag[uid]=st.tip;
        /* об ошибке говорит строка сохранения с кнопками; всплывающее сообщение закрывало бы её на телефоне */
        clearTimeout(storeOf.h);storeOf.h=setTimeout(()=>render(),0)}})}
  return STORES[uid]}
function save(uid,doc){
  doc=Object.assign({},doc,{updatedAt:now()});delete doc.got;delete doc.lvup;delete doc.last;
  const st=storeOf(uid);
  if(!st){S.drag=S.drag||{};S.drag[uid]=doc;return S.db.doc(`srs/${uid}/meta/dragons`).set(doc).catch(e=>{fail(e)})}
  return st.apply(()=>doc)?st.settled():Promise.resolve(st.status)}
function onSnap(uid,srv){
  S.drag=S.drag||{};const st=storeOf(uid);
  if(st){st.snap(srv||null);S.drag[uid]=st.tip;return}
  S.drag[uid]=srv||null}
/* можно ли сейчас менять свой остров; если нет, объясняем почему */
function canAct(uid){const st=storeOf(uid);if(!st||st.canAct())return true;
  toast(st.status==='conflict'?'Остров изменили в другой вкладке или на другом устройстве. Выберите вверху, какую версию оставить.':'Прошлое действие не сохранилось. Нажмите «Повторить» или «Отменить» вверху.',5000);return false}
/* строка состояния сохранения: в шапке острова и в «Карточках», если что-то не так */
function saveHTML(uid,quiet){const st=storeOf(uid);if(!st||!st.loaded)return '';
  if(st.status==='error')return `<div class="drg-sv err" role="status"><span>Последнее действие не сохранилось${st.err&&st.err.code==='unavailable'?': нет связи с облаком':st.err&&st.err.code==='session'?': в другой вкладке вышли или вошли под другим кодом. Обновите страницу':''}.</span><button class="btn sm" data-act="drgsave" data-v="retry">Повторить</button><button class="btn ghost sm" data-act="drgsave" data-v="discard">Отменить</button></div>`;
  if(st.status==='conflict')return `<div class="drg-sv err" role="status"><span>Остров изменили в другой вкладке или на другом устройстве. Чтобы ничего не перезаписать, возьмите ту версию.</span><button class="btn sm" data-act="drgsave" data-v="remote">Взять с сервера</button></div>`;
  if(quiet)return '';
  return `<span class="drg-sv ${st.status}" role="status" aria-live="polite">${st.status==='saving'?'Сохраняю…':'✓ Сохранено'}</span>`}
addEventListener('beforeunload',e=>{if(Object.values(STORES).some(st=>st.pending()||st.status==='error')){e.preventDefault();e.returnValue=''}});

function setMode(mode){
  const uid=meId(),t=today(),cur=docOf(uid);if(!canAct(uid))return;
  if(mode==='dragons'){
    if(cur&&cur.mode==='dragons')return;
    const periods=((cur&&cur.periods)||[]).map(p=>Object.assign({},p)),last=periods[periods.length-1];
    if(last&&last.to&&last.to>=addDays(t,-1))last.to=null;else periods.push({from:t,to:null});
    let base=cur&&cur.v===2?cur:null;
    if(!base){base=E.startState((cur&&cur.dragons)||founders(uid));const st=S.streak[uid]||{};E.settle(base,E.income(st.days||{},frozenDays(st).fz,periods,GOAL).K)}
    return save(uid,Object.assign({},base,{mode:'dragons',periods}))}
  if(!cur||cur.mode!=='dragons')return;
  return save(uid,Object.assign({},cur,{mode:'petri',periods:(cur.periods||[]).map(p=>p.to?p:{from:p.from,to:t})}))}

/* действие на острове: считаем от текущего момента, пишем результат */
let lastAct={k:'',t:0};
function act(a){
  const uid=meId(),x=stateOf(uid);if(!x||!canAct(uid))return null;
  /* то же действие второй раз за 0,3 с — двойное нажатие, а не новое кормление или покупка */
  const k=JSON.stringify(a),t=Date.now();if(k===lastAct.k&&t-lastAct.t<300)return null;lastAct={k,t};
  const r=E.apply(x.st,x.c,a);
  if(r.err){toast(r.err);return null}
  const d=docOf(uid);save(uid,Object.assign({},r.s,{mode:d.mode,periods:d.periods}));
  if(r.levelUp)setTimeout(()=>toast(`Остров вырос до ${r.levelUp}-го уровня! +2 💎 и новые постройки`),400);
  return r}

/* ---------- вид: общие кусочки ---------- */
const SEX={F:'♀',M:'♂'},RCLS=['r0','r1','r2','r3','r4'];
const fmt=n=>String(Math.max(0,Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const cards=n=>`${n} ${plural(n,'карточка','карточки','карточек')}`;
const cardsAcc=n=>`${n} ${plural(n,'карточку','карточки','карточек')}`;
const phOf=d=>G.phenotype(d.genome);
const HOSTS={F:'огненные',W:'водные',T:'земляные',A:'воздушные',P:'лесные',L:'драконы света',D:'драконы тьмы',smoke:'дымные',dormant:'дремлющие'};

function walletHTML(st){const b=st.bal;
  return `<div class="drg-wal"><span title="Золото"><i aria-hidden="true">🪙</i><b>${fmt(b.gold)}</b><small>золото</small></span><span title="Корм"><i aria-hidden="true">🌾</i><b>${fmt(b.food)}</b><small>корм</small></span><span title="Самоцветы"><i aria-hidden="true">💎</i><b>${fmt(b.gems)}</b><small>самоцветы</small></span></div>`}
function lvlHTML(st){const L=E.level(st),a=E.xpFor(L),b=E.xpFor(L+1),p=Math.round((st.bal.xp-a)/Math.max(1,b-a)*100);
  return `<div class="drg-lv" title="Опыт ${fmt(st.bal.xp)} из ${fmt(b)}"><b>${L}</b><span><small>уровень острова</small><span class="drg-xp"><i style="width:${p}%"></i></span></span></div>`}

/* что ждёт на острове: сундуки, урожай, стройки */
function todo(st,K){
  let gold=0,full=0,crops=0,builds=0;
  st.bld.forEach(b=>{const T=E.TYPES[b.type];
    if(T.kind==='hab'){const a=E.chestNow(st,b,K);gold+=a;if(a>=E.chestCap(b))full++}
    (b.plots||[]).forEach(p=>{if(p&&E.ready(p,K))crops++});
    if((b.build&&E.ready(b.build,K))||(b.up&&E.ready(b.up,K)))builds++});
  return {gold:Math.floor(gold),full,crops,builds}}
const rateAll=st=>st.bld.reduce((x,b)=>x+E.rate(st,b),0);

/* ---------- «Карточки»: сводка вместо чашки ---------- */
function hero(uid,compact){
  const x=stateOf(uid);if(!x)return '';const {st,c}=x,info=c.info,n=info.cur,first=st.dragons[0];
  if(compact)return `<div class="streak-mini drg-mini${info.done?' done':''}">${first?W.svg(phOf(first),{stage:W.stageOf(first.lvl),key:'m'+uid.slice(-6),size:64}):''}<div><b>${n}</b> <span>${plural(n,'день','дня','дней')} подряд</span><br><small class="muted">${info.done?'сегодня засчитано':`сегодня ${info.todayN} из ${GOAL}`}</small></div></div>`;
  const left=Math.max(0,GOAL-info.todayN),td=todo(st,c.K),rt=rateAll(st),ration=E.RATION(info.done?n:n+1);
  const notes=[];
  if(td.gold)notes.push(`🪙 в сундуках ${fmt(td.gold)}${td.full?`, ${td.full} ${plural(td.full,'полон','полны','полны')}`:''}`);
  if(td.crops)notes.push(`🌾 созрело ${td.crops} ${plural(td.crops,'грядка','грядки','грядок')}`);
  if(td.builds)notes.push(`🔨 стройка готова`);
  const own=uid===meId(),gl=own?goalLine(st,c.K):null;
  if(gl)notes.unshift(`🥚 Цель: ${gl.text}`);
  return `<section class="drg-hero${info.done?' done':''}">${own?saveHTML(uid,true):''}
  <div class="drg-top"><div><div class="st-k">Остров драконов</div><div class="st-n"><b>${n}</b><span>${plural(n,'день','дня','дней')} подряд</span></div>
  <p class="st-msg">${info.done?`День засчитан. Паёк ${ration} корма уже на острове, а каждая следующая карточка приносит драконам ещё ${fmt(rt)} золота.`:`Сегодня ${info.todayN} из ${GOAL}. Ещё ${cardsAcc(left)}, и придёт дневной паёк ${ration} корма и самоцвет. Каждая карточка уже сейчас приносит ${fmt(rt)} золота.`}</p></div>
  <div class="drg-side">${lvlHTML(st)}${walletHTML(st)}</div></div>
  <div class="drg-strip">${st.dragons.slice(0,8).map(d=>`<span class="drg-chip" title="${esc(d.name)}, ${d.lvl}-й уровень">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:'h'+uid.slice(-6)+d.id,size:56})}<small>${esc(d.name)} · ${d.lvl}</small></span>`).join('')}</div>
  <div class="drg-go">${notes.length?`<span class="drg-notes">${notes.join(' · ')}</span>`:'<span class="muted small">Остров ждёт новых карточек.</span>'}<span class="drg-gob"><button class="btn ghost" data-act="drgopen" data-uid="${uid}">${own?'На остров':'Открыть остров'}</button><button class="btn" data-act="drgopen" data-uid="${uid}" data-full="1">🏝 Отправиться на остров</button></span></div>
  </section>`}

function switchHTML(){
  if(T())return '';const dr=on(meId());
  return `<div class="drg-sw"><span class="muted small">Мотивация</span><div class="cvs" role="group" aria-label="Мотивация"><button data-act="drgmode" data-v="petri" aria-pressed="${!dr}">🧫 Бактерии</button><button data-act="drgmode" data-v="dragons" aria-pressed="${dr}">🐉 Драконы</button></div></div>`}

function reviewBadge(uid){const x=stateOf(uid);if(!x)return '';const info=x.c.info,rt=rateAll(x.st);
  return `<span class="rv-dish drg-rv" title="Каждая карточка приносит драконам ${fmt(rt)} золота"><i aria-hidden="true">🪙</i><small>${info.done?'+'+fmt(rt*info.todayN):info.todayN+'/'+GOAL}</small></span>`}
function dayDoneHTML(uid){const x=stateOf(uid);if(!x)return '';const inf=x.c.info,first=x.st.dragons[0];
  return `<div class="party-dish">${first?W.svg(phOf(first),{stage:W.stageOf(first.lvl),key:'p'+uid.slice(-6),size:150}):''}<span class="plus">💎</span></div><div class="big">${inf.cur} ${plural(inf.cur,'день','дня','дней')}</div><p><b>Серия продлена!</b> На остров пришёл паёк ${E.RATION(inf.cur)} корма и самоцвет. Чем длиннее серия, тем больше паёк и урожай с грядок.</p>`}

/* ---------- страница «Остров драконов» ---------- */
function islandView(){
  const uid=S.drgUid||meId(),own=uid===meId(),x=stateOf(uid);
  const back=`<button class="back" data-act="go" data-v="cards">← К карточкам</button>`;
  if(!x)return back+`<div class="empty">Остров ещё не открыт.</div>`;
  const {st,c}=x,K=c.K,full=!!S.drgFull;
  if(S.drgSel&&!st.bld.some(b=>b.id===S.drgSel))S.drgSel=null;
  const pl=own?S.drgPlace:null;
  const placeBar=pl?`<div class="drg-place"><span>${pl.move?'Нажмите, куда перенести здание':'Нажмите на зелёную клетку, где поставить: '+E.TYPES[pl.type].name}</span><button class="btn ghost sm" data-act="drgcancel">Отмена</button></div>`:'';
  const isl=I.svg(st,{K,sel:S.drgSel,place:pl,key:'isl',readonly:!own,full});
  const gl=own&&!pl?goalLine(st,K):null;
  if(full){
    const L=E.level(st),a=E.xpFor(L),b=E.xpFor(L+1),xp=Math.round((st.bal.xp-a)/Math.max(1,b-a)*100),bal=st.bal;
    const pill=(ic,v,t)=>`<span class="drg-pill" title="${t}"><i aria-hidden="true">${ic}</i><b>${fmt(v)}</b>${own?`<button data-act="drgpanel" data-v="help" aria-label="${t}: как получить">+</button>`:''}</span>`;
    const rb=(act,v,ic,t,big)=>`<button class="drg-rb${big?' big':''}" data-act="${act}" data-v="${v}"><i aria-hidden="true">${ic}</i><span>${t}</span></button>`;
    return `<div class="drg-map full${pl?' placing':''}"><div class="drg-stage">${isl}</div>
      <div class="drg-hud"><div class="drg-hud-l" title="Опыт ${fmt(bal.xp)} из ${fmt(b)}"><span class="drg-star"><b>${L}</b></span><span class="drg-xpbar"><i style="width:${xp}%"></i></span></div>
      <div class="drg-hud-r">${pill('🪙',bal.gold,'Золото')}${pill('💎',bal.gems,'Самоцветы')}${pill('🌾',bal.food,'Корм')}</div></div>
      ${own?`<div class="drg-svw">${saveHTML(uid)}${gl&&!S.drgPanel&&!S.drgSel?`<button class="drg-goal" data-act="drgpanel" data-v="breed"><small>Цель: первый потомок · шаг ${gl.step} из ${gl.of}</small><b>${gl.text}</b></button>`:''}</div>`:''}
      ${placeBar}
      <div class="drg-bl">${rb('drgfull','0','🏠','Домой')}${rb('drgpanel','dragons','📖','Драконы')}${own?rb('drgpanel','breed','🥚','Скрещивание'):''}${rb('drgpanel','journal','📓','Журнал')}${own&&st.dragons.length?rb('drgfight','','⚔️','Поход'):''}</div>
      ${own?`<div class="drg-br">${rb('drgpanel','market','🐉','Рынок')}${rb('drgpanel','shop','🔨','Строить',1)}</div>`:''}
      <div class="drg-zm"><button data-act="drgzoom" data-v="in" aria-label="Приблизить">+</button><button data-act="drgzoom" data-v="out" aria-label="Отдалить">−</button><button data-act="drgzoom" data-v="fit" aria-label="Весь остров">⤢</button></div>
      </div>`+panel(st,c,own)}
  const head=`${back}${own?saveHTML(uid,true):''}<div class="drg-ih"><div class="drg-ih-t"><h1>Остров драконов${own?'':': '+esc(name(uid))}</h1><span class="muted small">Время на острове идёт в карточках: повторено ${cards(K)}</span></div>${lvlHTML(st)}${walletHTML(st)}</div>`;
  const tools=own&&!pl?`<div class="drg-tools"><button class="btn sm" data-act="drgfull" data-v="1">🏝 Отправиться на остров</button><button class="btn ghost sm" data-act="drgpanel" data-v="shop">🔨 Построить</button><button class="btn ghost sm" data-act="drgpanel" data-v="market">🐉 Рынок</button><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">📖 Драконы</button><button class="btn ghost sm" data-act="drgpanel" data-v="breed">🥚 Скрещивание</button>${st.dragons.length?'<button class="btn ghost sm" data-act="drgfight">⚔️ Поход</button>':''}<button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button><button class="btn ghost sm" data-act="drgpanel" data-v="help">Как это работает</button></div>`:'';
  const map=`<div class="drg-map${pl?' placing':''}">${placeBar}${isl}<button class="drg-fsb" data-act="drgfull" data-v="1" aria-label="Открыть остров на весь экран">⛶</button></div>`;
  const goal=gl?`<button class="drg-goal in" data-act="drgpanel" data-v="breed"><small>Цель: первый потомок · шаг ${gl.step} из ${gl.of}</small><b>${gl.text}</b></button>`:'';
  return head+goal+tools+map+panel(st,c,own);
}

function panel(st,c,own){
  const K=c.K,L=E.level(st),p=S.drgPanel;
  if(own&&p==='shop')return shopHTML(st,L);
  if(own&&p==='market')return marketHTML(st,L);
  if(p==='dragons')return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Драконы острова</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div><div class="drg-list">${st.dragons.map(d=>dragonCard(st,d,own,L)).join('')}</div></section>`;
  if(p==='help')return helpHTML(st,c);
  if(p==='breed')return breedHTML(st,c,own);
  if(p==='journal')return journalHTML(st);
  if(p==='baby'){const d=st.dragons.find(x=>x.id===S.drgBaby);if(d)return `<section class="sheet drg-pan drg-baby"><div class="drg-pan-h"><h2>🐣 Вылупился ${esc(d.name)}!</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>${own?saveHTML(meId()):''}${d.nurs&&!d.home?`<p class="drg-why">Подходящего свободного дома пока нет (нужен дом: ${E.habNames(phOf(d))}), поэтому ${esc(d.name)} живёт в яслях Инкубатора. В яслях дракон не приносит золота, но его можно кормить. Когда появится дом, нажмите «Переселить».</p>`:''}<div class="drg-list">${dragonCard(st,d,own,L)}</div><div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button><button class="btn ghost sm" data-act="drgpanel" data-v="breed">🥚 Скрещивание</button></div></section>`}
  const b=st.bld.find(x=>x.id===S.drgSel);
  if(!b)return S.drgFull?'':`<p class="muted small drg-tip">${own?'Нажмите на здание, чтобы собрать золото, покормить драконов или посадить корм.':'Это остров ученицы, здесь можно только смотреть.'}</p>`;
  const T=E.TYPES[b.type],job=b.build||b.up;
  let h=`<section class="sheet drg-pan"><div class="drg-pan-h"><h2>${T.name}${b.build?'':` · ${b.lvl}-й уровень`}</h2><button class="btn ghost sm" data-act="drgsel" data-id="">Закрыть</button></div>`;
  if(job){const lf=E.left(job,K);
    h+=`<p>${b.build?'Строится':'Улучшается до '+job.to+'-го уровня'}: осталось ${cardsAcc(lf)}.${b.up&&T.kind==='hab'?' Драконы при этом продолжают приносить золото.':''}</p>${own?`<div class="actions" style="justify-content:flex-start"><button class="btn sm" data-act="drgdo" data-t="speed" data-id="${b.id}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button></div>`:''}`}
  if(T.kind==='hab'&&!b.build){
    const a=E.chestNow(st,b,K),cap=E.chestCap(b),ds=st.dragons.filter(d=>d.home===b.id),r=E.rate(st,b);
    h+=`<div class="drg-chest"><span>🪙 В сундуке <b>${fmt(a)}</b> из ${fmt(cap)}</span><span class="drg-bar"><i style="width:${Math.min(100,a/cap*100)}%"></i></span><span class="muted small">${r?`+${fmt(r)} за каждую карточку`:'Пока здесь нет драконов'}${a>=cap?', сундук полон: соберите, иначе золото пропадает':''}</span>${own?`<button class="btn sm" data-act="drgdo" data-t="collect" data-id="${b.id}"${a>=1?'':' disabled'}>Собрать</button>`:''}</div>`;
    h+=`<p class="muted small">Живут: ${T.hosts.map(k=>HOSTS[k]).join(' и ')}. Мест ${ds.length} из ${E.habCap(b)}.</p>`;
    h+=`<div class="drg-list">${ds.map(d=>dragonCard(st,d,own,L)).join('')||'<p class="muted small">Здесь пока никто не живёт.</p>'}</div>`}
  if(T.kind==='farm'&&!b.build){
    h+=`<div class="drg-plots">${b.plots.map((pl,i)=>{
      if(!pl)return `<div class="drg-plot"><b>Грядка ${i+1}</b><span class="muted small">Пусто</span>${own?`<div class="drg-crops">${Object.entries(E.CROPS).map(([k,cr])=>`<button class="btn ghost sm" data-act="drgdo" data-t="plant" data-id="${b.id}" data-plot="${i}" data-crop="${k}"${L<cr.unlock?' disabled title="Откроется на '+cr.unlock+'-м уровне острова"':''}>${cr.name}<small>${cr.cost} 🪙 · ${cr.need} к. → ${Math.round(cr.food*E.streakMult(c.streak))} 🌾</small></button>`).join('')}</div>`:''}</div>`;
      const cr=E.CROPS[pl.crop],rd=E.ready(pl,K),lf=E.left(pl,K);
      return `<div class="drg-plot${rd?' ready':''}"><b>Грядка ${i+1}: ${cr.name}</b><span class="drg-bar"><i style="width:${Math.min(100,(pl.need-lf)/pl.need*100)}%"></i></span><span class="muted small">${rd?`Созрело: ${Math.round(cr.food*E.streakMult(c.streak))} корма${c.streak?` (серия +${Math.round((E.streakMult(c.streak)-1)*100)} %)`:''}`:`Осталось ${cardsAcc(lf)}`}</span>${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="harvest" data-id="${b.id}" data-plot="${i}">Собрать урожай</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}</div>`}
  if(T.kind==='nest'&&!b.build)h+=nestHTML(st,b,c,own);
  if(T.kind==='hatch'&&!b.build)h+=hatchHTML(st,b,c,own);
  if(own){const nx=(E.lvTable(b.type)||[])[b.lvl+1];
    h+=`<div class="actions" style="justify-content:flex-start">${nx&&!job?`<button class="btn ghost sm" data-act="drgdo" data-t="upgrade" data-id="${b.id}">Улучшить до ${b.lvl+1}-го: ${fmt(nx.cost)} 🪙, ${nx.need} к.${T.kind==='hab'?` (мест ${nx.cap}, сундук ${fmt(nx.chest)})`:T.kind==='farm'?` (грядок ${nx.plots})`:` (мест для яиц ${nx.slots})`}</button>`:''}<button class="btn ghost sm" data-act="drgmove" data-id="${b.id}">Переместить</button></div>`}
  return h+`</section>`}

function dragonCard(st,d,own,L){
  const ph=phOf(d),rr=G.rarity(ph),cost=E.feedCost(d.lvl),cap=E.maxDragonLv(L),home=st.bld.find(b=>b.id===d.home);
  const homes=own?st.bld.filter(b=>b.id!==d.home&&!b.build&&E.hosts(b.type,ph)&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b)):[];
  return `<article class="drg-card ${RCLS[rr]}"><button class="drg-pic" data-act="drginsp" data-dragon="${d.id}" aria-label="Осмотреть: ${esc(d.name)}" title="Осмотреть крупно">${W.svg(ph,{stage:W.stageOf(d.lvl),key:'c'+d.id,size:170,label:esc(d.name)})}</button>
  <div class="drg-info"><div class="drg-nm"><b>${esc(d.name)}</b><span class="drg-sex" title="${d.genome.sex==='F'?'самка ZW':'самец ZZ'}">${SEX[d.genome.sex]}</span><span class="drg-rar">${G.RARITY[rr]}</span></div>
  <div class="drg-dl"><span>${d.lvl}-й уровень, ${W.STAGE_NAME[W.stageOf(d.lvl)]}</span><span class="drg-pips" title="Кормлений до следующего уровня">${Array.from({length:E.FEEDS},(_,i)=>`<i${i<(d.fed||0)?' class="on"':''}></i>`).join('')}</span><span class="muted">+${fmt(E.goldPerCard(d))} 🪙 за карточку</span></div>
  <ul>${W.describe(ph).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <p class="muted small" style="margin:4px 0 0">${home?'Живёт: '+E.TYPES[home.type].name:d.nurs?`В яслях Инкубатора, ждёт дом: ${E.habNames(ph)}`:'Без дома'}${d.parents?` · ${d.gen}-е поколение, родители ${d.parents.map(id=>esc(dname(st,id))).join(' × ')}`:d.from==='market'?' · с рынка':''}</p>
  ${own?`<div class="drg-da">${d.lvl<cap?`<button class="btn sm" data-act="drgdo" data-t="feed" data-dragon="${d.id}"${st.bal.food<cost?' disabled':''}>Покормить: ${cost} 🌾</button>${st.bal.food<cost?`<span class="drg-why">Корма ${fmt(st.bal.food)} из ${cost}. Корм растёт на ферме и приходит паёк за день с карточками.</span>`:''}`:`<span class="muted small">Следующий уровень откроется с ростом острова</span>`}
  ${homes.map(b=>`<button class="btn ghost sm" data-act="drgdo" data-t="place" data-dragon="${d.id}" data-home="${b.id}">Переселить: ${E.TYPES[b.type].name}</button>`).join('')}
  <button class="btn ghost sm" data-act="drgrename" data-dragon="${d.id}">Имя</button><button class="btn ghost sm" data-act="drgrelease" data-dragon="${d.id}">Отпустить</button></div>`:''}</div></article>`}
function dname(st,id){const d=st.dragons.find(x=>x.id===id)||(st.gone||[]).find(x=>x.id===id);return d?d.name:'?'}

/* ---------- скрещивание ---------- */
const ELW={F:'огонь',W:'вода',T:'земля',A:'воздух',P:'флора',L:'свет',D:'тьма'};
const TRAITS={
  elements:'Стихия',color:'Окрас',hornsMace:'Рога и булава',crest:'Гребень',shortWings:'Короткие крылья',span:'Размах крыльев',sex:'Пол',metal:'Блеск чешуи',night:'Ночное зрение',glow:'Свечение глаз',spurs:'Шпоры'};
const eAlleles=d=>{const i=G.CHROMS.A1.loci.indexOf('E'),g=d&&d.genome;return g&&g.A1?[g.A1[0][i],g.A1[1][i]]:phOf(d).elements};
function classesOf(trait,m,f){
  const yes=[['true','есть'],['false','нет']];
  switch(trait){
    /* варианты стихии берутся из аллелей обоих родителей (паспорт их и так показывает), а не из проявленных стихий:
       самка F/F с s/s дремлет, но передаёт F, и пара с W/W даёт F+W. Невозможные сочетания тоже в списке, ответ он не выдаёт */
    case 'elements':{const el=[...new Set([m,f].flatMap(d=>eAlleles(d)).filter(a=>a!=='e'))].sort((a,b)=>G.ELEM_ORDER.indexOf(a)-G.ELEM_ORDER.indexOf(b)),out=[];
      el.forEach(a=>out.push([a,ELW[a]]));for(let i=0;i<el.length;i++)for(let j=i+1;j<el.length;j++)out.push([el[i]+'+'+el[j],ELW[el[i]]+' и '+ELW[el[j]]]);
      return out.concat([['smoke','дымный, без стихии'],['dormant','дремлющий']])}
    case 'color':return [['dark','тёмный'],['bronze','бронзовый'],['pale','бледный']];
    case 'hornsMace':return [['HK','рога и булава'],['Hk','рога без булавы'],['hK','булава без рогов'],['hk','ни рогов, ни булавы']];
    case 'crest':return [['big','большой'],['mid','средний'],['none','нет']];
    case 'span':return Array.from({length:7},(_,k)=>[String(k),String(3+k*0.5).replace('.',',')+' м']);
    case 'sex':return [['F','самка'],['M','самец']];
    default:return yes}}
const sel=(id,opts,cur)=>`<select id="${id}" class="drg-in">${opts.map(([v,l])=>`<option value="${esc(v)}"${String(cur)===String(v)?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
function nestHTML(st,b,c,own){
  const K=c.K;
  if(b.pair){const p=b.pair,m=st.dragons.find(x=>x.id===p.m),f=st.dragons.find(x=>x.id===p.f),rd=E.ready(p,K),lf=E.left(p,K);
    const pr=p.pred?`<p class="drg-pred ${p.pred.ok?'ok':'no'}">${p.pred.ok?'✓':'✗'} Прогноз: ${TRAITS[p.pred.trait].toLowerCase()} «${esc((classesOf(p.pred.trait,m||st.dragons[0],f||st.dragons[0]).find(x=>x[0]===p.pred.value)||[0,p.pred.value])[1])}» у ${Math.round(p.pred.p*100)} % вылупившихся потомков. ${p.pred.ok?`Верно! Скрещивание идёт вдвое быстрее, и пришёл самоцвет.`:`На самом деле ${Math.round(p.pred.truth*1000)/10} %. Подумай, какие генотипы у родителей могли бы дать такое число.`}</p>`:'';
    return `<div class="drg-pair">${[m,f].map(d=>d?`<span class="drg-chip">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:'np'+d.id,size:56})}<small>${esc(d.name)} ${SEX[d.genome.sex]}</small></span>`:'').join('<b>×</b>')}</div>${pr}
      <p>${rd?'Яйцо готово. Перенесите его в Инкубатор.':`Яйцо будет готово через ${cardsAcc(lf)}.`}</p>
      ${own?`<div class="actions" style="justify-content:flex-start">${rd?`<button class="btn sm" data-act="drgdo" data-t="egg" data-id="${b.id}">Забрать яйцо в Инкубатор</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button>`}</div>`:''}`}
  if(!own)return '<p class="muted small">Гнездовье пустует.</p>';
  const ok=d=>d.lvl>=E.BREED_LV,fs=st.dragons.filter(d=>d.genome.sex==='F'),ms=st.dragons.filter(d=>d.genome.sex==='M');
  const fv=S.fv||{},mid=fv.drgM&&fs.some(d=>d.id===fv.drgM)?fv.drgM:(fs.find(ok)||fs[0]||{}).id,fid=fv.drgF&&ms.some(d=>d.id===fv.drgF)?fv.drgF:(ms.find(ok)||ms[0]||{}).id;
  if(!fs.length||!ms.length)return `<p class="muted small">Для скрещивания нужны самка и самец. Купить недостающего можно на рынке.</p>`;
  const m=st.dragons.find(d=>d.id===mid),f=st.dragons.find(d=>d.id===fid),cost=E.breedCost(G.rarity(phOf(m)),G.rarity(phOf(f)));
  const tr=TRAITS[fv.drgPt]?fv.drgPt:'',cls=tr?classesOf(tr,m,f):[],cv=cls.some(x=>x[0]===fv.drgPc)?fv.drgPc:(cls[0]||[])[0];
  const low=[m,f].filter(d=>!ok(d));
  return `<div class="drg-breed"><label>Самка ${sel('drgM',fs.map(d=>[d.id,`${d.name} ♀ · ${d.lvl}-й ур.`]),mid)}</label><label>Самец ${sel('drgF',ms.map(d=>[d.id,`${d.name} ♂ · ${d.lvl}-й ур.`]),fid)}</label></div>
  <div class="drg-pair">${[m,f].map(d=>`<span class="drg-chip">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:'bp'+d.id,size:56})}<small>${esc(d.name)}</small></span>`).join('<b>×</b>')}</div>
  <details class="drg-predbox" data-k="drgpred"${tr?' open':''}><summary>Сделать прогноз (по желанию)</summary>
    <p class="muted small">Если догадалась о генотипах родителей, предскажи долю потомков с признаком. Доля считается среди вылупившихся потомков этой пары (яйца, которые не развились, в неё не входят) и без учёта редких мутаций. Ошибка до ${Math.round(E.PRED_TOL*100)} процентных пунктов засчитывается: скрещивание вдвое быстрее и самоцвет. Неверный прогноз ничего не стоит.</p>
    <div class="drg-breed"><label>Признак ${sel('drgPt',[['','без прогноза'],...Object.entries(TRAITS)],tr)}</label>${tr?`<label>Вариант ${sel('drgPc',cls,cv)}</label><label>Доля, % <input id="drgPp" class="drg-in" type="number" min="0" max="100" step="0.1" inputmode="decimal" value="${esc(fv.drgPp||'')}" placeholder="например 25"></label>`:''}</div></details>
  ${low.length?`<p class="muted small">${low.map(d=>`${esc(d.name)} (${d.lvl}-й ур.)`).join(' и ')}: для скрещивания нужен ${E.BREED_LV}-й уровень. Кормят дракона кнопкой «Покормить» в его карточке, корм для этого растёт на ферме.</p><div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">Открыть драконов</button></div>`:''}
  <div class="actions" style="justify-content:flex-start"><button class="btn sm" data-act="drgbreed" data-id="${b.id}" data-m="${mid}" data-f="${fid}"${low.length||st.bal.gold<cost?' disabled':''}>Скрестить: ${fmt(cost)} 🪙, ${cards(E.BREED_NEED)}</button>${!low.length&&st.bal.gold<cost?`<span class="drg-why">Не хватает ${fmt(cost-Math.floor(st.bal.gold))} 🪙. Золото копится в сундуках домов за каждую повторённую карточку.</span>`:''}</div>`}

/* куда пойдёт малыш из готового яйца: проверка до нажатия «Вылупить» */
function hatchBlocked(st,eg){return eg.viable&&!E.homeFor(st,G.phenotype(eg.genome))&&E.nursery(st)>=E.NURSERY}
function hatchWhy(st,eg){if(!eg.viable)return '';const ph=G.phenotype(eg.genome),h=E.homeFor(st,ph);
  if(h)return `<span class="muted small">Поселится: ${E.TYPES[h.type].name}</span>`;
  const n=E.nursery(st);
  return n<E.NURSERY?`<span class="drg-why">Свободного дома нет (нужен дом: ${E.habNames(ph)}). Малыш поживёт в яслях: занято ${n} из ${E.NURSERY}.</span>`
    :`<span class="drg-why">Свободного дома нет (нужен дом: ${E.habNames(ph)}), и ясли заняты. Переселите малыша из яслей или освободите место в доме. Яйцо подождёт здесь.</span>`}
function hatchHTML(st,b,c,own){
  const K=c.K;
  return `<div class="drg-plots">${b.slots.map((eg,i)=>{
    if(!eg)return `<div class="drg-plot"><b>Место ${i+1}</b><span class="muted small">Пусто. Яйца приходят из Гнездовья.</span></div>`;
    const rd=E.ready(eg,K),lf=E.left(eg,K);
    return `<div class="drg-plot${rd?' ready':''}"><span class="drg-egg"><svg viewBox="-14 -16 28 32" width="34" height="40" aria-hidden="true">${I.eggSVG(0,0,eg)}</svg><b>Яйцо №${eg.n}</b></span><span class="muted small">${esc(dname(st,eg.m))} ♀ × ${esc(dname(st,eg.f))} ♂</span><span class="drg-bar"><i style="width:${Math.min(100,(eg.need-lf)/eg.need*100)}%"></i></span><span class="muted small">${rd?'Готово!':`До вылупления ${cardsAcc(lf)}`}</span>
      ${rd?hatchWhy(st,eg):''}
      ${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="hatch" data-id="${b.id}" data-plot="${i}"${hatchBlocked(st,eg)?' disabled':''}>Вылупить</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}</div>`}

/* ---------- «Скрещивание»: путь к первому потомку и всё о парах и яйцах ----------
   Шаги считает E.breedPath по настоящему состоянию; у каждого шага ближайшее действие и причина, если оно закрыто. */
const STEP_T={level:'Остров 3-го уровня',parents:'Самка и самец 3-го уровня',build:'Гнездовье и Инкубатор',pair:'Пара в Гнездовье',egg:'Яйцо в Инкубаторе',hatch:'Вылупление'};
const toCards='<button class="btn ghost sm" data-act="drgcards">Повторять карточки</button>';
function breedHTML(st,c,own){
  const P=E.breedPath(st,c.K),L=E.level(st),bal=st.bal,b=k=>P.steps.find(x=>x.k===k);
  const btn=(attrs,label,why)=>`<button class="btn sm" ${attrs}${why?' disabled':''}>${label}</button>${why?`<span class="drg-why">${why}</span>`:''}`;
  const body={
    level:x=>x.ok?`Острову ${L}-й уровень.`:`Острову сейчас ${L}-й уровень, до ${x.need}-го нужно ещё ${fmt(x.xpNeed-x.xp)} опыта. Опыт дают стройка, кормление драконов, сбор урожая и покупка на рынке.`
      +(own&&!x.ok?`<div class="drg-sa"><button class="btn ghost sm" data-act="drgpanel" data-v="shop">🔨 Построить</button><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">📖 Покормить драконов</button></div>`:''),
    parents:x=>x.par.map(p=>{const sx=p.sex==='F'?'Самка':'Самец';
      if(!p.id)return `<div class="drg-sr">${sx}: на острове нет. ${own?'<button class="btn ghost sm" data-act="drgpanel" data-v="market">🐉 Рынок</button>':''}</div>`;
      const d=st.dragons.find(z=>z.id===p.id),cost=E.feedCost(d.lvl);
      return `<div class="drg-sr"><span>${esc(p.name)} ${SEX[p.sex]}, ${p.lvl}-й уровень${p.ok?' ✓':`: ещё ${p.n} ${plural(p.n,'кормление','кормления','кормлений')}, всего ${fmt(p.food)} 🌾`}</span>
        ${own&&!p.ok?btn(`data-act="drgdo" data-t="feed" data-dragon="${p.id}"`,`Покормить: ${cost} 🌾`,bal.food<cost?`Корма ${fmt(bal.food)}, нужно ${cost}. Корм растёт на ферме и приходит паёк за день с карточками`:''):''}
        <button class="btn ghost sm" data-act="drginsp" data-dragon="${p.id}">Открыть</button></div>`}).join(''),
    build:x=>[x.nest,x.hatch].map(q=>{const t=E.TYPES[q.type];
      if(q.state==='ok')return `<div class="drg-sr"><span>${t.name} ✓</span><button class="btn ghost sm" data-act="drgsel" data-id="${q.id}">Открыть</button></div>`;
      if(q.state==='build'||q.state==='done')return `<div class="drg-sr"><span>${t.name}: ${q.state==='done'?'стройка готова, откройте здание':`строится, осталось ${cards(q.left)}`}</span><button class="btn ghost sm" data-act="drgsel" data-id="${q.id}">Открыть</button>${q.state==='build'?toCards:''}</div>`;
      const why=q.state==='locked'?`Откроется на ${q.unlock}-м уровне острова`:bal.gold<q.cost?`Не хватает ${fmt(q.cost-Math.floor(bal.gold))} 🪙`:'';
      return `<div class="drg-sr"><span>${t.name}: ${fmt(q.cost)} 🪙, строится ${cards(q.need)}</span>${own?btn(`data-act="drgbuild" data-type="${q.type}"`,'Построить',why):''}</div>`}).join(''),
    pair:x=>{const nb=st.bld.find(z=>z.type==='nest'&&!z.build);
      return `Выберите самку и самца в Гнездовье. Скрещивание стоит ${fmt(x.cost)} 🪙 (есть ${fmt(x.gold)}), яйцо будет готово через ${cards(x.need)}. Прогноз потомства по желанию.`
      +(own&&nb&&!x.ok?`<div class="drg-sa">${btn(`data-act="drgsel" data-id="${nb.id}"`,'Открыть Гнездовье',x.gold<x.cost?`Не хватает ${fmt(x.cost-x.gold)} 🪙`:'')}</div>`:'')},
    egg:x=>{const p=x.pair;if(!p)return x.ok?'Яйцо уже в Инкубаторе.':'Яйцо появится в Гнездовье после скрещивания.';
      const hb=st.bld.find(z=>z.type==='hatch'&&!z.build),free=hb&&hb.slots.some(z=>!z);
      return p.ready?`Яйцо готово.${own?`<div class="drg-sa">${btn(`data-act="drgdo" data-t="egg" data-id="${p.id}"`,'Перенести в Инкубатор',!hb?'Сначала нужен Инкубатор':!free?'В Инкубаторе нет свободного места: сначала вылупите готовое яйцо':'')}</div>`:''}`
        :`Яйцо будет готово через ${cards(p.left)}.${own?`<div class="drg-sa">${toCards}<button class="btn ghost sm" data-act="drgsel" data-id="${p.id}">Открыть Гнездовье</button></div>`:''}`},
    hatch:x=>x.eggs.length?x.eggs.map(e=>{const eg=st.bld.find(z=>z.id===e.id).slots[e.plot];
      return `<div class="drg-sr"><span>Яйцо №${eg.n}: ${e.ready?'готово':`до вылупления ${cards(e.left)}`}</span>${e.ready?hatchWhy(st,eg):''}
        ${own&&e.ready?btn(`data-act="drgdo" data-t="hatch" data-id="${e.id}" data-plot="${e.plot}"`,'Вылупить',hatchBlocked(st,eg)?'Нет дома и мест в яслях':''):own?toCards+`<button class="btn ghost sm" data-act="drgsel" data-id="${e.id}">Открыть Инкубатор</button>`:''}</div>`}).join('')
      :'Когда яйцо будет в Инкубаторе, здесь появится его срок.'};
  const now=P.next,idx=P.steps.findIndex(x=>x.k===now);
  const steps=P.steps.map((x,i)=>{const cls=x.ok?'ok':i===idx?'now':'later';
    return `<li class="drg-st ${cls}"${i===idx?' aria-current="step"':''}><b>${STEP_T[x.k]}</b>${x.ok&&(idx<0||i<idx)?'':`<div class="drg-sd">${body[x.k](x)}</div>`}</li>`}).join('');
  const nurs=st.dragons.filter(d=>d.nurs&&!d.home);
  const nursH=nurs.length?`<h3>Ясли Инкубатора: ${nurs.length} из ${E.NURSERY}</h3>${nurs.map(d=>`<div class="drg-sr"><span>${esc(d.name)} ${SEX[d.genome.sex]}: нужен дом: ${E.habNames(phOf(d))}</span><button class="btn ghost sm" data-act="drginsp" data-dragon="${d.id}">Открыть</button></div>`).join('')}<p class="muted small">В яслях малыши не приносят золота. «Переселить» в карточке дракона появится, когда будет свободный подходящий дом.</p>`:'';
  const ch=P.child&&(st.dragons.find(d=>d.id===P.child.child)||(st.gone||[]).find(d=>d.id===P.child.child));
  const head=P.done?`<p class="drg-why ok">Первый потомок уже есть${ch?`: ${esc(ch.name)}`:''}. Дальше копите потомство пар в журнале: по долям признаков можно понять генотипы родителей.</p>
      <div class="drg-sa"><button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button>${ch&&st.dragons.includes(ch)?`<button class="btn ghost sm" data-act="drginsp" data-dragon="${ch.id}">Осмотреть: ${esc(ch.name)}</button>`:''}</div>`
    :`<p class="muted small">Скрестите самку и самца, перенесите яйцо в Инкубатор и дождитесь вылупления. Время на острове идёт в повторённых карточках: пока страница просто открыта, яйца и стройки не растут.</p>`;
  return `<section class="sheet drg-pan drg-bp"><div class="drg-pan-h"><h2>${P.done?'🥚 Скрещивание':'🥚 Цель: первый потомок'}</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  ${head}${P.done?hub():`<ol class="drg-steps">${steps}</ol>`}${nursH}</section>`;
  /* после первого потомка вместо пройденных шагов — что сейчас в Гнездовье и Инкубаторе */
  function hub(){const x=k=>P.steps.find(z=>z.k===k),pr=x('egg').pair;
    return `<h3>Гнездовье</h3><div class="drg-sd">${pr?body.egg(x('egg')):body.pair(Object.assign({},x('pair'),{ok:false}))}</div>
      <h3>Инкубатор</h3><div class="drg-sd">${body.hatch(x('hatch'))}</div>`}}
/* цель для шапки острова и «Карточек»: короткая строка ближайшего шага */
function goalLine(st,K){const P=E.breedPath(st,K);if(P.done)return null;
  const x=P.steps.find(z=>z.k===P.next),T={level:'поднять остров до 3-го уровня',parents:'вырастить самку и самца до 3-го уровня',build:'построить Гнездовье и Инкубатор',
    pair:'выбрать пару в Гнездовье',egg:x.pair&&x.pair.ready?'перенести яйцо в Инкубатор':`яйцо будет через ${x.pair?cards(x.pair.left):'…'}`,hatch:x.eggs&&x.eggs.some(e=>e.ready)?'вылупить малыша':`малыш вылупится через ${x.eggs&&x.eggs.length?cards(Math.min(...x.eggs.map(e=>e.left))):'…'}`};
  return {step:P.steps.indexOf(x)+1,of:P.steps.length,text:T[P.next]}}

/* журнал: потомство по парам и расщепление по выбранному признаку */
const PH_KEY={elements:x=>x.el,color:x=>x.c,hornsMace:x=>(x.h?'H':'h')+(x.k?'K':'k'),crest:x=>x.r,shortWings:x=>String(!!x.sw),span:x=>String(x.span),sex:x=>x.sex,metal:x=>String(!!x.m),night:x=>String(!!x.n),glow:x=>String(!!x.g),spurs:x=>String(!!x.sp)};
function journalHTML(st){
  const log=st.log||[],fv=S.fv||{},tr=PH_KEY[fv.drgJt]?fv.drgJt:'elements';
  const close=`<button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button>`;
  if(!log.length)return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Журнал скрещиваний</h2>${close}</div><p class="muted">Пока ни одного яйца. Постройте Гнездовье и Инкубатор (с 3-го уровня острова), и сюда попадёт каждый потомок.</p></section>`;
  const pairs=new Map();log.forEach(r=>{const k=r.m+'|'+r.f;if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(r)});
  const any=st.dragons[0];
  const block=([k,rs])=>{const [mi,fi]=k.split('|'),m=st.dragons.find(x=>x.id===mi)||any,f=st.dragons.find(x=>x.id===fi)||any;
    const alive=rs.filter(r=>!r.dead),cnt={};alive.forEach(r=>{const v=PH_KEY[tr](r.ph);cnt[v]=(cnt[v]||0)+1});
    const names=Object.fromEntries(classesOf(tr,m,f));
    const rows=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<tr><td>${esc(names[v]||(tr==='elements'?v.split('+').map(x=>ELW[x]||x).join(' и '):v))}</td><td>${n}</td><td>${Math.round(n/alive.length*100)} %</td></tr>`).join('');
    const dead=rs.length-alive.length;
    return `<div class="drg-jb"><h3>${esc(dname(st,mi))} ♀ × ${esc(dname(st,fi))} ♂ <span class="muted small">${rs.length} ${plural(rs.length,'яйцо','яйца','яиц')}</span></h3>
      ${alive.length?`<div class="tbl-wrap"><table><thead><tr><th>${TRAITS[tr]}</th><th>Потомков</th><th>Доля</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}
      ${dead?`<p class="muted small">Не развилось ${dead} ${plural(dead,'яйцо','яйца','яиц')} из ${rs.length}.</p>`:''}</div>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Журнал скрещиваний</h2>${close}</div>
  <p class="muted small">Здесь копится потомство каждой пары. Чем больше яиц, тем ближе доли к теоретическим: по ним можно понять генотипы родителей.</p>
  <label class="drg-jt">Признак ${sel('drgJt',Object.entries(TRAITS),tr)}</label>
  ${[...pairs].reverse().map(block).join('')}
  <h3>Последние яйца</h3><ul class="drg-jl">${log.slice(-25).reverse().map(r=>`<li>№${r.n}, ${r.d.slice(8,10)}.${r.d.slice(5,7)}: ${esc(dname(st,r.m))} × ${esc(dname(st,r.f))} → ${r.dead?'<i>яйцо не развилось</i>':`<b>${esc(dname(st,r.child))}</b>${r.pred?` · прогноз ${r.pred.ok?'✓':'✗'}`:''}`}</li>`).join('')}</ul></section>`}

/* миниатюра постройки для магазина: тот же рисунок острова, обрезанный до одной площадки */
function bldThumb(k){
  const s=I.svg({land:[],bld:[{id:'s'+k,type:k,x:5,y:5,lvl:1,plots:[null,null]}],dragons:[]},{K:0,key:'s'+k,readonly:true,bare:true});
  return s.replace(/viewBox="[^"]+"/,'viewBox="326 186 148 150"')}
function shopHTML(st,L){
  const row=k=>{const t=E.TYPES[k],lock=L<t.unlock,full=t.kind==='hab'?E.count(st,'hab')>=E.maxHabs(L):t.kind==='farm'?E.count(st,'farm')>=E.maxFarms(L):false;
    /* единственное на острове здание (Гнездовье, Инкубатор): уже есть, значит, открыть его, а не строить второе */
    const one=t.max&&st.bld.find(b=>b.type===k);
    if(one)return `<button class="drg-shop-i built" data-act="drgsel" data-id="${one.id}"><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${one.build?'строится':'уже построено'}</small><span class="drg-price">${one.build?'Строится':'Построено'} → открыть</span></button>`;
    const gold=Math.floor(st.bal.gold),gems=Math.floor(st.bal.gems),noG=gold<t.cost,noM=(t.gems||0)>gems;
    const why=t.soon?'В следующем обновлении':lock?`С ${t.unlock}-го уровня`:full?(t.kind==='hab'?`Сред обитания уже ${E.count(st,'hab')} из ${E.maxHabs(L)}: следующая с ростом острова`:`Ферм уже ${E.count(st,'farm')} из ${E.maxFarms(L)}: следующая с ростом острова`)
      :noG?`Не хватает ${fmt(t.cost-gold)} 🪙`:noM?`Не хватает ${t.gems-gems} 💎`:'';
    return `<button class="drg-shop-i" data-act="drgbuild" data-type="${k}"${why?' disabled':''}><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${t.kind==='hab'?'для: '+t.hosts.map(h=>HOSTS[h]).join(', '):t.kind==='farm'?'корм для драконов':'для скрещивания'}</small><span class="drg-price">${fmt(t.cost)} 🪙${t.gems?' + '+t.gems+' 💎':''} · ${t.need} к.</span>${why?`<em>${why}</em>`:''}</button>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Построить</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <p class="muted small">Сред обитания ${E.count(st,'hab')} из ${E.maxHabs(L)}, ферм ${E.count(st,'farm')} из ${E.maxFarms(L)} на ${L}-м уровне. Стройка идёт в карточках: «10 к.» значит, что здание будет готово через 10 повторённых карточек.</p>
  <div class="drg-shop">${[...E.HAB_ORDER,'farm','nest','hatch'].map(row).join('')}</div></section>`}

const MK_NAME={F:'Огненный дракон',W:'Водный дракон',N:'Дымный дракон',T:'Земляной дракон',A:'Воздушный дракон',P:'Лесной дракон'};
function marketHTML(st,L){
  const row=k=>{const t=E.TYPES[k],lock=L<t.unlock,home=st.bld.some(b=>b.type===k&&!b.build&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b));
    const ph=G.phenotype(E.marketGenome(k,'preview')),why=lock?`С ${t.unlock}-го уровня`:!home?`Нужен свободный дом: ${t.name}`:'';
    return `<div class="drg-shop-i"><span class="drg-shop-pic">${W.svg(ph,{key:'mk'+k,size:110})}</span><b>${MK_NAME[k]}</b><small>генотип неизвестен, редкость видна после покупки</small><span class="drg-price">${fmt(t.price)} 🪙</span>${why?`<em>${why}</em>`:`<button class="btn sm" data-act="drgdo" data-t="buy" data-type="${k}">Купить</button>`}</div>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Рынок драконов</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <p class="muted small">На рынке продают драконов одной стихии, и у каждого свой генотип. Большинство обычные, примерно каждый десятый оказывается редким по окрасу, гребню или рогам, около одного из ста сверхредким. Двух стихий и света или тьмы у рыночных драконов не бывает, такие рождаются только при скрещивании. Какие скрытые аллели несёт дракон, покажет паспорт и потомство.</p>
  <div class="drg-shop">${['F','W','N','T','A','P'].map(row).join('')}</div></section>`}

function helpHTML(st,c){
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Как это работает</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <ul class="drg-help">
  <li>Время на острове идёт в карточках. Пока карточки не повторяются, остров стоит: сундуки не наполняются, корм не растёт, стройка не идёт.</li>
  <li>Золото. Каждый дракон в своей среде приносит золото за каждую карточку: чем выше уровень и редкость, тем больше. Золото копится в сундуке здания до его вместимости, собирайте его нажатием.</li>
  <li>Корм. Дневной паёк приходит, когда за день набрано ${GOAL} карточек: ${E.RATION(1)} корма и ещё 5 за каждый день серии, до ${E.RATION(99)}. Грядки на ферме созревают за карточки, а урожай больше на 2,5 % за каждый день серии, до +50 %.</li>
  <li>Самоцветы. Один за засчитанный день и ещё по одному за каждые ${GOAL} карточек сверх цели, награды за серию ${E.MILESTONES.map(m=>m[0]).join(', ')} дней и по 2 за каждый уровень острова. Самоцвет заменяет ${E.SKIP_CARDS} карточек ожидания стройки или грядки.</li>
  <li>Кормление. Дракон растёт в уровнях: ${E.FEEDS} кормления на уровень, корма нужно всё больше. Предел уровня драконов растёт вместе с уровнем острова.</li>
  <li>Опыт и уровень острова. Опыт дают стройка, кормление, урожай и покупки. Уровень открывает новые среды обитания, фермы и культуры, а с 3-го уровня Гнездовье и Инкубатор.</li>
  <li>Скрещивание. В Гнездовье сажают самку и самца не ниже ${E.BREED_LV}-го уровня. Яйцо получается настоящим мейозом из генотипов родителей, которые скрыты: видно только, как выглядят драконы. Яйцо дозревает в Инкубаторе, а в журнале копится потомство каждой пары. Перед скрещиванием можно сделать прогноз доли потомков с признаком: верный ускоряет вдвое и даёт самоцвет.</li>
  <li>Поход. Кнопка ⚔️ Поход ведёт на Огненную гряду: пять боёв и Хранитель на вершине, команда до трёх драконов против диких. Стихии сильны и слабы по кругу, это правило игры. За победу даются звёзды, золото и корм за бои не начисляются.</li>
  </ul><p class="muted small">Сейчас: серия ${c.streak} ${plural(c.streak,'день','дня','дней')}, рекорд в режиме драконов ${c.inc.best}.</p></section>`}

/* выбор в формах острова сразу перерисовывает панель (варианты прогноза зависят от признака) */
document.addEventListener('change',e=>{const el=e.target;if(!el||!/^drg(M|F|Pt|Pc|Jt)$/.test(el.id))return;S.fv=S.fv||{};S.fv[el.id]=el.value;render()});
/* на узком экране карта шире окна: сначала показываем середину острова, а после перерисовки возвращаем прокрутку */
document.addEventListener('scroll',e=>{const m=e.target;if(m&&m.classList&&m.classList.contains('drg-map'))S.drgScroll=m.scrollLeft},true);
new MutationObserver(()=>{const m=document.querySelector('.drg-map');if(!m||m.dataset.sc)return;m.dataset.sc='1';
  m.scrollLeft=S.drgScroll!=null?S.drgScroll:(m.scrollWidth-m.clientWidth)/2}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- остров на весь экран: панорама и масштаб ----------
   Камера живёт вне HTML (S.drgCam), чтобы перерисовка не сбрасывала положение; применяется после каждой перерисовки. */
const cam=()=>S.drgCam||(S.drgCam={z:0,x:0,y:0});
function camBox(){const m=document.querySelector('.drg-map.full');return m?m.getBoundingClientRect():null}
function camClamp(c,r){c.z=Math.max(1,Math.min(4,c.z));c.x=Math.min(0,Math.max(r.width-r.width*c.z,c.x));c.y=Math.min(0,Math.max(r.height-r.height*c.z,c.y))}
/* начальный вид: остров (800×560 в единицах рисунка) почти во всю ширину или высоту окна, по центру */
function camFit(r){const c=cam(),V=I.VIEW.full,s0=Math.min(r.width/V[2],r.height/V[3]),ox=(r.width-V[2]*s0)/2,oy=(r.height-V[3]*s0)/2;
  c.z=Math.max(1,Math.min(4,(r.width<700?1.5:0.96)*r.width/(800*s0),(r.width<700?9:0.9)*r.height/(560*s0)));
  const cx=ox+(400-V[0])*s0,cy=oy+(320-V[1])*s0;c.x=r.width/2-c.z*cx;c.y=r.height/2-c.z*cy;camClamp(c,r)}
function camApply(){const st=document.querySelector('.drg-map.full .drg-stage'),r=camBox();if(!st||!r)return;const c=cam();if(!c.z)camFit(r);camClamp(c,r);
  st.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) scale(${c.z.toFixed(3)})`}
function camZoom(px,py,f){const r=camBox();if(!r)return;const c=cam(),nz=Math.max(1,Math.min(4,c.z*f)),k=nz/c.z;c.x=px-(px-c.x)*k;c.y=py-(py-c.y)*k;c.z=nz;camApply()}
const ptrs=new Map();let moved=0,lastDrag=0,pinch=null;
const onHud=t=>t.closest&&t.closest('.drg-hud,.drg-bl,.drg-br,.drg-zm,.drg-place,.drg-pan');
window.addEventListener('pointerdown',e=>{const m=e.target.closest&&e.target.closest('.drg-map.full');if(!m||onHud(e.target))return;
  ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(ptrs.size===1)moved=0;if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])}}});
window.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const r=camBox();if(!r){ptrs.clear();return}
  const dx=e.clientX-p[0],dy=e.clientY-p[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===1){moved+=Math.abs(dx)+Math.abs(dy);if(moved>6){const c=cam();c.x+=dx;c.y+=dy;camApply()}}
  else if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=99;
    camZoom((a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top,d/pinch.d);pinch.d=d}});
const ptrUp=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(moved>6)lastDrag=Date.now()};
window.addEventListener('pointerup',ptrUp);window.addEventListener('pointercancel',ptrUp);
/* после перетаскивания отпускание кнопки не считается нажатием на здание */
window.addEventListener('click',e=>{if(Date.now()-lastDrag<350&&e.target.closest&&e.target.closest('.drg-map.full')&&!onHud(e.target)){e.stopPropagation();e.preventDefault()}},true);
window.addEventListener('wheel',e=>{const m=e.target.closest&&e.target.closest('.drg-map.full');if(!m||onHud(e.target))return;e.preventDefault();
  const r=camBox();camZoom(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*0.0018))},{passive:false});
window.addEventListener('resize',()=>camApply());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.drgFull&&S.view==='island'&&!document.querySelector('dialog[open]')&&!document.querySelector('.dri,.drf')){if(S.drgPanel||S.drgSel){S.drgPanel=null;S.drgSel=null}else S.drgFull=false;render()}});
/* общие часы анимаций и классы body: на весь экран прокрутка страницы выключена, уведомления наверху */
new MutationObserver(()=>{
  document.querySelectorAll('svg.drg-isl:not([data-clk])').forEach(el=>{el.dataset.clk='1';el.style.setProperty('--clk',(-performance.now()/1000).toFixed(2)+'s')});
  const fs=!!document.querySelector('.drg-map.full'),b=document.body;if(!b)return;
  if(b.classList.contains('drg-fs')!==fs)b.classList.toggle('drg-fs',fs);
  const iv=!!document.querySelector('.drg-map');if(b.classList.contains('drg-islv')!==iv)b.classList.toggle('drg-islv',iv);
  if(fs)camApply();
  /* живой остров: драконы из рисунка A поверх острова (live.js), состояние берётся то же, что у рисунка острова */
  if(window.DRLIVE)DRLIVE.scan(()=>{const x=stateOf(S.drgUid||meId());return x&&x.st})}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- осмотр дракона (inspect.js): данные для сцены и кормление оттуда ---------- */
function inspInfo(uid,id){
  const x=stateOf(uid);if(!x)return null;const st=x.st,own=uid===meId(),L=E.level(st);
  const d=st.dragons.find(z=>z.id===id);if(!d)return null;
  const all=st.dragons.concat(st.gone||[]);
  const node=i=>{const z=all.find(q=>q.id===i);return z?{id:z.id,name:z.name,genome:z.genome,lvl:z.lvl||null,alive:st.dragons.includes(z),parents:z.parents||null}:{id:i,unknown:true}};
  const cost=E.feedCost(d.lvl),cap=E.maxDragonLv(L),food=Math.floor(st.bal.food),home=st.bld.find(b=>b.id===d.home);
  const why=d.lvl>=cap?'Следующий уровень откроется с ростом острова':food<cost?`Не хватает корма: есть ${fmt(food)} 🌾, нужно ${cost}`:'';
  return {id:d.id,name:d.name,genome:d.genome,lvl:d.lvl,fed:d.fed||0,feeds:E.FEEDS,own,gen:d.gen||1,from:d.from||null,
    home:home?E.TYPES[home.type].name:null,gold:fmt(E.goldPerCard(d)),
    feed:own?{cost,can:!why,why,max:d.lvl>=cap}:null,
    parents:d.parents?d.parents.map(i=>{const n=node(i);n.parents=n.parents?n.parents.map(node):null;return n}):null}}
function inspect(el){
  if(S.drgPlace||!window.DRGINSP)return;
  const uid=S.drgUid||meId(),info=inspInfo(uid,el.dataset.dragon);if(!info)return;
  DRGINSP.open(info,{info:id=>inspInfo(uid,id),
    feed:id=>{const r=act({t:'feed',dragon:id});if(!r)return null;render();return {lvup:r.s.lvup===id}},
    fight:uid===meId()&&window.DRFIGHT?id=>fight(id):null},el)}

/* ---------- поход и бой 3 на 3 (fight.js): драконы для команды и запись звёзд в поле pve документа острова ---------- */
function fightApi(){
  const uid=meId();
  return {dragons:()=>{const x=stateOf(uid);return x?x.st.dragons.map(d=>({id:d.id,name:d.name,genome:d.genome,lvl:d.lvl})):[]},
    progress:()=>DRCAMP.progress(docOf(uid)),
    /* звёзды и победы, больше ничего: остальной документ острова пишется как есть, как после любого действия */
    /* итог: {p — прогресс, который видит игрок, saved — обещание статуса записи: ok, error или conflict} */
    record:(id,stars)=>{const x=stateOf(uid),d=docOf(uid);if(!x||!d)return null;const st=storeOf(uid);
      if(st&&!st.canAct())return {p:DRCAMP.progress(d),saved:Promise.resolve(st.status)};
      const p=DRCAMP.record(DRCAMP.progress(d),id,stars,today());
      return {p,saved:save(uid,Object.assign({},x.st,{mode:d.mode,periods:d.periods,pve:p}))}},
    saveState:()=>{const st=storeOf(uid);return st?st.status:'ok'},
    retry:()=>{const st=storeOf(uid);return st?st.retry():Promise.resolve('ok')},
    onClose:()=>render()}}
function fight(dragon){if(S.drgPlace||!window.DRFIGHT||!stateOf(meId()))return;DRFIGHT.open(fightApi(),{dragon})}

/* ---------- действия ---------- */
const num=v=>v==null||v===''?undefined:Number(v);
window.DRGUI={on,hero,switchHTML,reviewBadge,dayDoneHTML,onSnap,islandView,stateOf,founders,setMode,saveHTML,storeOf,classesOf};
window.DRG_ACTIONS={
  drgmode:async el=>{const v=el.dataset.v;await setMode(v);toast(v==='dragons'?'Включены драконы. Чашка Петри никуда не делась, вернуться можно в любой момент.':'Включены бактерии. Драконы ждут на острове.')},
  drgopen:el=>{S.drgUid=el.dataset.uid||meId();S.view='island';S.drgSel=null;S.drgPanel=null;S.drgPlace=null;window.scrollTo(0,0);
    S.drgScroll=null;S.drgFull=!!el.dataset.full;S.drgCam=null},
  drgfull:el=>{S.drgFull=el.dataset.v==='1';S.drgCam=null;S.drgPanel=null;S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0)},
  drgzoom:el=>{const r=camBox();if(!r)return;const v=el.dataset.v;if(v==='fit'){camFit(r);camApply()}else camZoom(r.width/2,r.height/2,v==='in'?1.35:1/1.35)},
  drgobs:async el=>{const x=stateOf(meId());if(!x)return;const o=E.obstacles(x.st).find(z=>z.id===el.dataset.c);if(!o)return;const k=E.OBST_KIND[o.kind];
    if(!await askConfirm(`${k.name}: расчистить за ${k.gold} золота? Освободится место для построек${k.gems?', а под валуном найдётся самоцвет':''}.`,'Расчистить'))return;
    const r=act({t:'clear',cell:o.id});if(r)toast(k.gems?`Расчищено! +${k.gems} 💎`:'Расчищено')},
  drgsel:el=>{if(S.drgPlace)return;S.drgSel=el.dataset.id||null;S.drgPanel=null},
  drginsp:inspect,
  drgfight:el=>fight(el.dataset.dragon||null),
  drgsave:el=>{const st=storeOf(meId());if(!st)return;const v=el.dataset.v;
    if(v==='retry')st.retry().then(s=>{if(s==='ok')toast('Сохранено')});
    else if(v==='discard'){st.discard();toast('Вернулась последняя сохранённая версия острова')}
    else if(v==='remote'){st.takeRemote();toast('Взята версия с сервера')}},
  drgpanel:el=>{S.drgPanel=el.dataset.v||null;S.drgSel=null;S.drgPlace=null},
  /* из ожидания на острове прямо к повторению: время острова идёт только в карточках */
  drgcards:()=>{S.drgFull=false;S.drgPanel=null;S.drgSel=null;S.drgPlace=null;S.view='cards';window.scrollTo(0,0)},
  drgbuild:el=>{S.drgPlace={type:el.dataset.type};S.drgPanel=null;S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0)},
  drgmove:el=>{S.drgPlace={move:el.dataset.id};S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0)},
  drgcancel:()=>{S.drgPlace=null},
  drgtile:el=>{const p=S.drgPlace;if(!p)return;const x=+el.dataset.x,y=+el.dataset.y;
    const r=p.move?act({t:'move',id:p.move,x,y}):act({t:'build',type:p.type,x,y});
    if(r){S.drgPlace=null;if(!p.move){S.drgSel=r.s.last;toast(`Стройка началась: ${E.TYPES[p.type].name}`)}}},
  drgland:async el=>{const c=el.dataset.c,cost=E.LAND_COST[c];if(!cost)return;
    if(!await askConfirm(`Расчистить участок за ${cost.gold?fmt(cost.gold)+' золота':cost.gems+' самоцветов'}?`,'Расчистить'))return;if(act({t:'expand',chunk:c}))toast('Участок расчищен')},
  drgdo:el=>{const d=el.dataset,a={t:d.t,id:d.id,dragon:d.dragon,home:d.home,crop:d.crop,type:d.type,plot:num(d.plot)};
    const r=act(a);if(!r)return;
    if(r.s.got&&r.s.got.gold)toast(`+${fmt(r.s.got.gold)} золота`);
    else if(r.s.got&&r.s.got.food)toast(`+${fmt(r.s.got.food)} корма`);
    else if(r.s.lvup){const x=r.s.dragons.find(z=>z.id===r.s.lvup);toast(`${x.name} вырос до ${x.lvl}-го уровня!`)}
    else if(d.t==='buy'){const x=r.s.dragons.find(z=>z.id===r.s.last);toast(`На острове новый дракон: ${x.name}`)}
    else if(d.t==='egg')toast('Яйцо в Инкубаторе')
    else if(r.s.got&&r.s.got.dead)toast('Яйцо не развилось. Посмотри в журнале, у каких родителей так бывает')
    else if(r.s.got&&r.s.got.baby){const x=r.s.dragons.find(z=>z.id===r.s.got.baby);S.drgPanel='baby';S.drgBaby=x.id;S.drgSel=null}},
  drgbreed:el=>{const fv=S.fv||{},t=fv.drgPt,pp=parseFloat(String(fv.drgPp||'').replace(',','.'));
    const pred=t&&!isNaN(pp)?{trait:t,value:fv.drgPc||(document.getElementById('drgPc')||{}).value,p:pp/100}:null;
    const r=act({t:'breed',id:el.dataset.id,mother:el.dataset.m,father:el.dataset.f,pred});if(!r)return;
    S.fv.drgPp='';const g=r.s.got&&r.s.got.pred;toast(g?(g.ok?'Прогноз верный! Яйцо будет вдвое быстрее, +1 💎':`Прогноз мимо: на самом деле ${Math.round(g.truth*1000)/10} %`):'Пара в Гнездовье. Яйцо будет через '+cardsAcc(E.BREED_NEED))},
  drgrelease:async el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    if(!await askConfirm(`Отпустить дракона ${d.name}? Он улетит с острова, а в журнале и родословной останется.`,'Отпустить'))return;
    const r=act({t:'release',dragon:d.id});if(r)toast(`${d.name} улетел. +${fmt(r.s.got.gold)} золота на прощание`)},
  drgrename:el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    const n=prompt('Имя дракона',d.name);if(n!=null&&n.trim())act({t:'rename',dragon:d.id,name:n})}
};
})();
