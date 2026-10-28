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
  const st=S.streak[uid]||{},d=docOf(uid)||{},info=streakInfo(st),fz=frozenDays(st).fz;
  /* точка перехода на доход этапа D: из документа, а у острова, который ещё не перешёл, — нынешние часы (их же запишет repair) */
  let ev=typeof d.evK==='number'?{K:d.evK}:null;
  if(!ev&&d.v===2)ev={K:E.income(st.days||{},fz,d.periods,GOAL).K};
  const inc=E.income(st.days||{},fz,d.periods,GOAL,ev);
  inc.streakBest=info.best;inc.cur=info.cur;
  /* бонус за ДЗ: список из страницы (hwBonus в index.html), здесь только сумма */
  const hw=typeof window.hwBonus==='function'?window.hwBonus(uid):[];inc.hw={gems:hw.reduce((x,b)=>x+b.gems,0),food:hw.reduce((x,b)=>x+b.food,0),list:hw};info.hw=hw;
  return {K:inc.K,inc,streak:info.cur,info,uid,today:today()}}
/* состояние на сейчас: старые документы этапа 1 (без v) превращаются в остров с теми же драконами */
function stateOf(uid){
  const d=docOf(uid);if(!d)return null;const c=ctxOf(uid);
  let base=d;if(d.v!==2){base=Object.assign(E.startState(d.dragons||founders(uid),c.K),{mode:d.mode,periods:d.periods});E.settle(base,c.K)}
  else{const r=E.repair(d,c.inc);if(r.bad.length)return null;base=r.s}
  return {st:E.normalize(base,c.K,c.inc),c}}
/* испорченное сохранение: что именно не так (остров тогда не открывается и ничего не пишет) */
function brokenOf(uid){const d=docOf(uid);if(!d||d.v!==2)return null;const r=E.repair(d,ctxOf(uid).inc);return r.bad.length?r.bad:null}
function brokenHTML(bad){return `<section class="sheet drg-broken" role="alert"><h2>Сохранение острова повреждено</h2><p>В документе острова испорчены данные: ${esc(bad.slice(0,6).join(', '))}${bad.length>6?` и ещё ${bad.length-6}`:''}. Чтобы ничего не потерять, остров не открывается и ничего не записывает. Данные в базе остались как были.</p><p class="muted small">Напишите учителю: он посмотрит документ и восстановит его. Карточки и серия работают как обычно.</p></section>`}

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
      write:d=>window.PHCLOUD&&PHCLOUD.session&&!PHCLOUD.session()?Promise.reject({code:'session'}):S.db.doc(path).set(d),
      cas:window.PHCLOUD&&PHCLOUD.CAS?(d,rev,op)=>PHCLOUD.session()?PHCLOUD.casSet(path,d,rev,op):Promise.reject({code:'session'}):null},{onChange:st=>{S.drag=S.drag||{};S.drag[uid]=st.tip;
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
  if(st.status==='conflict'&&!st.remote)return `<div class="drg-sv err" role="status"><span>Остров на сервере не найден: его удалили или сбросили в другом месте. Ваша версия на этой странице цела.</span><button class="btn sm" data-act="drgsave" data-v="restore">Записать мою версию</button></div>`;
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
    if(!base){const st=S.streak[uid]||{},K=E.income(st.days||{},frozenDays(st).fz,periods,GOAL).K;base=E.startState((cur&&cur.dragons)||founders(uid),K);E.settle(base,K)}
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
/* доля опыта до следующего уровня; на 100-м уровне полоса полная и следующего нет */
function xpPct(st){const L=E.level(st);if(L>=E.ISLE_MAX)return 100;const a=E.xpFor(L),b=E.xpFor(L+1);return Math.max(0,Math.min(100,Math.round((st.bal.xp-a)/Math.max(1,b-a)*100)))}
function lvlHTML(st){const L=E.level(st),b=E.xpFor(L+1),p=xpPct(st);
  return `<div class="drg-lv" role="button" tabindex="0" data-act="drgpanel" data-v="lvl" aria-label="Уровень острова ${L}: подробнее" title="${L>=E.ISLE_MAX?`Опыт ${fmt(st.bal.xp)}, высший уровень`:`Опыт ${fmt(st.bal.xp)} из ${fmt(b)}`}"><b>${L}</b><span><small>уровень острова</small><span class="drg-xp"><i style="width:${p}%"></i></span></span></div>`}

/* что ждёт на острове: сундуки, урожай, стройки */
function todo(st,K){
  let gold=0,full=0,crops=0,builds=0;
  st.bld.forEach(b=>{const T=E.TYPES[b.type];
    if(T.kind==='hab'){const a=E.chestNow(st,b,K);gold+=a;if(a>=E.chestCap(b))full++}
    (b.plots||[]).forEach(p=>{if(p&&E.ready(p,K))crops++});
    if((b.build&&E.ready(b.build,K))||(b.up&&E.ready(b.up,K)))builds++});
  return {gold:Math.floor(gold),full,crops,builds}}
const rateAll=st=>st.bld.reduce((x,b)=>x+E.rate(st,b),0);
/* золото всех драконов за следующую карточку: удвоение и ступень лесенки сегодняшнего дня */
const rateNow=(st,n)=>rateAll(st)*(typeof st.evK==='number'?E.ECON.goldX*E.ladderK((n||0)+1):1);
const kTxt=k=>'×'+String(k).replace('.',',');
/* «Сегодня повторено N»: объём дня, ступень бонуса и следующий порог. Серия дней — отдельный показатель */
/* последние ДЗ с бонусом острову */
function hwIsleHTML(info){const l=(info&&info.hw||[]).slice(-3);if(!l.length)return '';
  return `<span>За ДЗ: ${l.map(b=>`«${esc(b.title)}» ${b.pc} % → +${b.gems} 💎 +${b.food} 🌾`).join(', ')}</span>`}
function volHTML(st,info,mini){const n=info.todayN||0,b=E.todayBonus(n,GOAL),on=typeof st.evK==='number';if(!on)return '';
  const nx=b.next?`ещё ${cardsAcc(b.next.at-n)} до ${kTxt(b.next.k)}`:'наибольшая ступень, каждая карточка по-прежнему приносит доход';
  if(mini)return `<span class="drg-vol" title="Бонус за объём повторения сегодня">📈 ${n} · ${kTxt(b.k)}</span>`;
  return `<div class="drg-vol" role="status"><b>Сегодня повторено ${n}</b><span>Бонус к золоту ${kTxt(b.k)} · ${nx}</span>${b.food?`<span>Корм сверх ${GOAL} карточек: +${fmt(b.food)} 🌾 сегодня</span>`:''}
    ${hwIsleHTML(info)}
    <small class="muted">Каждая карточка двигает стройки, грядки и яйца на одну карточку и даёт опыт острова (с бонусом дня). Карточки с 16-й приносят золото с бонусом ${kTxt(E.ladderK(16))}, с 31-й ${kTxt(E.ladderK(31))}, с 61-й ${kTxt(E.ladderK(61))}, после 120-й ${kTxt(E.ladderK(121))}, и ещё ${E.ECON.foodX} корма с тем же бонусом. 30 карточек дают примерно вдвое больше золота, чем 15, и около ${fmt(E.todayBonus(30,GOAL).food)} корма сверх пайка.</small></div>`}

/* ---------- «Карточки»: сводка вместо чашки ---------- */
function hero(uid,compact){
  const x=stateOf(uid);if(!x){const bad=!compact&&brokenOf(uid);return bad?brokenHTML(bad):''}const {st,c}=x,info=c.info,n=info.cur,first=st.dragons[0];
  if(compact)return `<div class="streak-mini drg-mini${info.done?' done':''}">${first?W.svg(phOf(first),{stage:W.stageOf(first.lvl),key:'m'+uid.slice(-6),size:64}):''}<div><b>${n}</b> <span>${plural(n,'день','дня','дней')} подряд</span><br><small class="muted">${info.done?'сегодня засчитано':`сегодня ${info.todayN} из ${GOAL}`}</small></div></div>`;
  const left=Math.max(0,GOAL-info.todayN),td=todo(st,c.K),rt=rateNow(st,info.todayN),ration=E.RATION(info.done?n:n+1);
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
  ${volHTML(st,info)}${own?slot7HTML(st):''}
  <div class="drg-strip">${st.dragons.slice(0,8).map(d=>`<span class="drg-chip" title="${esc(d.name)}, ${d.lvl}-й уровень">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:'h'+uid.slice(-6)+d.id,size:56})}<small>${esc(d.name)} · ${d.lvl}</small></span>`).join('')}</div>
  <div class="drg-go">${notes.length?`<span class="drg-notes">${notes.join(' · ')}</span>`:'<span class="muted small">Остров ждёт новых карточек.</span>'}<span class="drg-gob"><button class="btn ghost" data-act="drgopen" data-uid="${uid}">${own?'На остров':'Открыть остров'}</button><button class="btn" data-act="drgopen" data-uid="${uid}" data-full="1">🏝 Отправиться на остров</button></span></div>
  </section>`}

/* ---------- «Бои»: общий вход в два вида боёв (этап 4 доработки) ----------
   Поход драконов и Турнир бактерий — разные системы, и страница так и говорит. Сражений драконов между игроками нет.
   bact: {n — видов в коллекции, total — всего видов} из страницы, где живёт турнир */
function battleHub(uid,bact){
  const x=stateOf(uid);if(!x||!window.DRCAMP)return '';const d=docOf(uid),p=DRCAMP.progress(d),g=DRCAMP.goal(p),gr=g&&DRCAMP.region(g.region);
  const n=x.st.dragons.length,b=bact||{n:0,total:0};
  return `<section class="drg-hub" aria-label="Два вида боёв">
  <div class="drg-hubc drg-hubd"><div class="st-k">🐉 Поход драконов</div><p>Ваши драконы против диких: бой 3 на 3, ходы по очереди, стихии, Защита и Ярость. ${DRCAMP.REGIONS.length} регионов, ${DRCAMP.NODES.length} боёв, в каждом испытания, элитные бои и боссы. Награда — звёзды, ресурсы острова за бои не начисляются.</p>
    <p class="small"><b>★ ${DRCAMP.total(p)} из ${DRCAMP.max()}</b> · ${g?`следующий бой: «${esc(g.name)}», ${esc(gr.name)}, ${g.rec}-й уровень`:'все бои пройдены, можно переигрывать ради трёх звёзд'}</p>
    <button class="btn" data-act="drgfight"${n?'':' disabled'}>${n?'Открыть карту похода':'Сначала нужен дракон на острове'}</button></div>
  <div class="drg-hubc drg-hubb"><div class="st-k">🦠 Турнир бактерий</div><p>Коллекция бактерий из чашки Петри. Она растёт от тех же дней с ${GOAL} карточками, что и остров, и в режиме драконов тоже. Армия до четырёх видов сражается сама, бои турнира проходят ночью.</p>
    <p class="small"><b>${b.n} из ${b.total}</b> видов в коллекции${b.n?'':'. Пока пусто: первая колония вырастет в день, когда повторено '+GOAL+' карточек'}</p>
    <a class="btn ghost" href="#ar-tour" data-act="arjump">К турниру ниже ↓</a></div>
  <p class="muted small drg-hubn">Боёв драконов между ученицами нет: в походе соперник — компьютер, а с соперницами сражаются бактерии в турнире.</p></section>`}

function switchHTML(){
  if(T())return '';const dr=on(meId());
  return `<div class="drg-sw"><span class="muted small">Мотивация</span><div class="cvs" role="group" aria-label="Мотивация"><button data-act="drgmode" data-v="petri" aria-pressed="${!dr}">🧫 Бактерии</button><button data-act="drgmode" data-v="dragons" aria-pressed="${dr}">🐉 Драконы</button></div></div>`}

function reviewBadge(uid){const x=stateOf(uid);if(!x)return '';const info=x.c.info,rt=rateNow(x.st,info.todayN),day=rateAll(x.st)*(typeof x.st.evK==='number'?E.todayBonus(info.todayN,GOAL).goldW:info.todayN);
  return `<span class="rv-dish drg-rv" title="Следующая карточка приносит драконам ${fmt(rt)} золота"><i aria-hidden="true">🪙</i><small>${info.done?'+'+fmt(day):info.todayN+'/'+GOAL}</small></span>`}
function dayDoneHTML(uid){const x=stateOf(uid);if(!x)return '';const inf=x.c.info,first=x.st.dragons[0];
  return `<div class="party-dish">${first?W.svg(phOf(first),{stage:W.stageOf(first.lvl),key:'p'+uid.slice(-6),size:150}):''}<span class="plus">💎</span></div><div class="big">${inf.cur} ${plural(inf.cur,'день','дня','дней')}</div><p><b>Серия продлена!</b> На остров пришёл паёк ${E.RATION(inf.cur)} корма и самоцвет. Чем длиннее серия, тем больше паёк и урожай с грядок.</p>`}

/* малышу некуда заселиться (4.2): подсказка, что построить или улучшить; переселение потом идёт само */
function homeHint(st,d){const L=E.level(st),keys=E.dragonKeys(phOf(d)).map(k=>k==='smoke'||k==='dormant'?'N':k).filter((k,i,a)=>E.TYPES[k]&&a.indexOf(k)===i);
  const can=keys.find(k=>L>=E.TYPES[k].unlock&&E.count(st,'hab')<E.maxHabs(L)),full=st.bld.find(b=>keys.includes(b.type)&&!b.build&&!b.up&&E.lvTable(b.type)&&E.lvTable(b.type)[b.lvl+1]);
  return `<div class="actions" style="justify-content:flex-start">${can?`<button class="btn sm" data-act="drgbuild" data-type="${can}">🔨 Построить: ${esc(E.TYPES[can].name)}</button>`:''}${full?`<button class="btn ghost sm" data-act="drgsel" data-id="${full.id}">⬆️ Улучшить: ${esc(E.TYPES[full.type].name)}</button>`:''}</div>`}

/* клавиши острова (4.2) */
const KEYS=[['B','Строить'],['D','Драконы'],['E','Скрещивание и яйца'],['P','Поход'],['M','Ещё'],['L','Уровень и опыт'],['I','Другой остров'],['⌘/Ctrl +  −','Приблизить, отдалить (и просто + −)'],['0','Весь остров'],['Стрелки','Сдвинуть остров'],['Esc','Закрыть окно, потом выйти с острова'],['?','Эта подсказка']];
function keysHTML(){return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>⌨️ Клавиши</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <table class="drg-keys">${KEYS.map(([k,t])=>`<tr><td><kbd>${esc(k)}</kbd></td><td>${esc(t)}</td></tr>`).join('')}</table>
  <p class="muted small">Колесо мыши и жест двумя пальцами двигают остров, с ⌘ или Ctrl (и щипком на трекпаде) — меняют масштаб. Постройки выбираются Tab и Enter.</p></section>`}

/* ---------- справка по уровню и опыту (4.2): нажатие на звезду с полоской опыта ---------- */
function lvlInfoHTML(st,c){const L=E.level(st),max=L>=E.ISLE_MAX,b=E.xpFor(L+1),a=E.xpFor(L),p=xpPct(st),nx=E.unlocksAt(L+1),mj=E.nextMajor(L),fall=L>20;
  const li=a=>a.map(x=>`<li>${esc(x)}</li>`).join('');
  return `<section class="sheet drg-pan drg-lvi"><div class="drg-pan-h"><h2>⭐ Уровень острова ${L}</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
    ${max?`<p><b>Высший уровень.</b> Опыт копится дальше: ${fmt(st.bal.xp)}.</p>`:`<p>Опыт <b>${fmt(st.bal.xp)}</b> из <b>${fmt(b)}</b>, до ${L+1}-го уровня ещё <b>${fmt(b-st.bal.xp)}</b>.</p>
    <div class="drg-xp big" role="img" aria-label="Пройдено ${p} % уровня"><i style="width:${p}%"></i></div>`}
    <h3>Откуда берётся опыт</h3>
    <ul class="drg-lvl-ul"><li><b>Повторение карточек</b> — главный источник: каждая карточка в режиме драконов даёт опыт острову, сверх обычной нормы дня больше.</li>
      <li><b>Стройка и улучшение</b> зданий: десятая часть цены.</li><li><b>Кормление</b> драконов и <b>урожай</b> с ферм.</li>
      <li><b>Малыши</b> из Инкубатора: чем реже дракон, тем больше.</li><li><b>Победы в Походе</b> и первые победы над боссами.</li></ul>
    ${fall?`<p class="muted small">После 20-го уровня опыт за действия на острове растёт медленнее, а за карточки по-прежнему полностью.</p>`:''}
    <h3>Что даёт уровень</h3>
    <ul class="drg-lvl-ul"><li>+2 💎 за каждый новый уровень.</li><li>Драконы растут до <b>${E.maxDragonLv(L)}-го</b> уровня, мест под жилища ${E.maxHabs(L)}, ферм ${E.maxFarms(L)}.</li>
      <li>Остров растёт сам: сейчас ${E.extent(st).n}×${E.extent(st).n} клеток, ${E.slots(st).length} ячеек под постройки.</li></ul>
    ${max?'':`<h3>На ${L+1}-м уровне</h3>${nx.length?`<ul class="drg-lvl-ul">${li(nx)}</ul>`:'<p class="muted">Только +2 💎.</p>'}`}
    ${mj&&mj.L>L+1?`<h3>Ближайшее большое открытие — ${mj.L}-й уровень</h3><ul class="drg-lvl-ul">${li(mj.list)}</ul>`:''}
  </section>`}

/* ---------- два острова (4.1): какой сейчас на экране ----------
   S.drgIsle — 0 (Зелёный) или 1 (Огненный, если открыт). Рисунок, клетки стройки, камера и живые драконы берут вид
   одного острова E.isle(st, i); панели, баланс и драконы общие */
const curIsle=st=>st&&st.isl2&&S.drgIsle===1?1:0;
const viewSt=st=>E.isle(st,curIsle(st));
function isleBtn(st,own){const c=curIsle(st);
  if(st.isl2)return `<button class="drg-isw${c?'':' to-lava'}" data-act="drgisle" data-v="${c?0:1}" aria-label="Перейти: ${c?'Зелёный остров':E.ISLE2.name}"><i aria-hidden="true">${c?'🏝':'🌋'}</i><span>${c?'Зелёный остров':E.ISLE2.name}</span></button>`;
  if(!own)return '';
  return `<button class="drg-isw to-lava lock" data-act="drgpanel" data-v="isle2" aria-label="${E.ISLE2.name}: как открыть"><i aria-hidden="true">🌋</i><span>${E.ISLE2.name}</span><b aria-hidden="true">🔒</b></button>`}
function isle2HTML(st){const q=E.isleState(st),L=E.level(st);
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>🌋 ${E.ISLE2.name}</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
    <p>Второй остров, когда на первом станет тесно: своя земля под постройки, вулканы, обсидиан и лавопады. Драконы, золото, корм и уровень общие, строить можно на любом острове.</p>
    <p class="drg-why">${q.open?'Остров уже открыт.':q.ok?`Можно открыть сейчас за ${fmt(E.ISLE2.gold)} 🪙.`:`${q.why}. Сейчас ${L}-й.`}</p>
    ${!q.open&&q.ok?`<button class="btn" data-act="drgisle2"${st.bal.gold<E.ISLE2.gold?' disabled':''}>Открыть за ${fmt(E.ISLE2.gold)} 🪙</button>${st.bal.gold<E.ISLE2.gold?`<p class="muted small">Не хватает ${fmt(E.ISLE2.gold-st.bal.gold)} золота.</p>`:''}`:''}</section>`}

/* ---------- страница «Остров драконов» ---------- */
function islandView(){
  const uid=S.drgUid||meId(),own=uid===meId(),x=stateOf(uid);
  const back=`<button class="back" data-act="go" data-v="cards">← К карточкам</button>`;
  if(!x){const bad=brokenOf(uid);if(bad)return back+brokenHTML(bad);
    return back+`<div class="empty">Остров ещё не открыт.</div>`}
  const {st,c}=x,K=c.K,full=!!S.drgFull;
  if(S.drgSel&&!st.bld.some(b=>b.id===S.drgSel))S.drgSel=null;
  const pl=own?S.drgPlace:null;
  const placeBar=pl?`<div class="drg-place"><span>${pl.move?'Нажмите на свободную ячейку «+», куда перенести здание':'Нажмите на свободную ячейку «+», где поставить: '+E.TYPES[pl.type].name}</span><button class="btn sm" data-act="drgauto">${pl.move?'Перенести':'Поставить'} на свободное место</button><button class="btn ghost sm" data-act="drgcancel">Отмена</button></div>`:'';
  const cur=curIsle(st),isl=I.svg(viewSt(st),{K,sel:S.drgSel,place:pl,key:'isl',readonly:!own,full});
  const gl=own&&!pl?goalLine(st,K):null;
  if(full){
    const L=E.level(st),b=E.xpFor(L+1),xp=xpPct(st),bal=st.bal;
    /* ресурсы с подписью; нажатие объясняет, откуда берётся именно этот ресурс */
    const pill=(k,ic,v,t)=>own?`<button class="drg-pill" data-act="drgpanel" data-v="res:${k}" aria-label="${t}: ${fmt(v)}. Как получить"><i aria-hidden="true">${ic}</i><span><b>${fmt(v)}</b><small>${t.toLowerCase()}</small></span><em aria-hidden="true">+</em></button>`
      :`<span class="drg-pill" title="${t}"><i aria-hidden="true">${ic}</i><span><b>${fmt(v)}</b><small>${t.toLowerCase()}</small></span></span>`;
    const P=S.drgPanel||'',rb=(act,v,ic,t,o)=>{o=o||{};const on=act==='drgpanel'&&P===v||o.on;
      return `<button class="drg-rb${o.big?' big':''}" data-act="${act}" data-v="${v}"${o.lab?` aria-label="${o.lab}${o.k?' (клавиша '+o.k+')':''}"`:''}${o.k?` title="Клавиша ${o.k}" aria-keyshortcuts="${o.k}"`:''}${on?' aria-current="true"':''}><i aria-hidden="true">${ic}</i><span>${t}</span>${o.k?`<kbd class="drg-kb" aria-hidden="true">${o.k}</kbd>`:''}</button>`};
    const dock=own?rb('drgfull','0','🏠','Домой',{lab:'Домой: из острова на страницу',k:'Esc'})+rb('drgpanel','dragons','📖','Драконы',{lab:'Драконы',k:'D'})
        +rb('drgpanel','breed','🥚','<b class="lg">Скрещивание</b><b class="sm">Яйца</b>',{lab:'Скрещивание и яйца',k:'E'})
        +(st.dragons.length?rb('drgfight','','⚔️','Поход',{lab:'Поход: бои драконов',k:'P'}):'')+rb('drgpanel','shop','🔨','Строить',{big:1,lab:'Строить',k:'B'})+rb('drgpanel','more','☰','Ещё',{lab:'Ещё: рынок, журнал, мои постройки, справка',k:'M'})
      :rb('drgfull','0','🏠','Назад')+rb('drgpanel','dragons','📖','Драконы')+rb('drgpanel','journal','📓','Журнал')+rb('drgpanel','blds','🏘','Постройки');
    return `<div class="drg-map full${pl?' placing':''}${cur?' lava':''}">
      <div class="drg-hud"><button class="drg-hud-l" data-act="drgpanel" data-v="lvl" aria-label="Уровень острова ${L}, опыт ${xp} %: подробнее (клавиша L)" title="${L>=E.ISLE_MAX?'Высший уровень острова':`Опыт ${fmt(bal.xp)} из ${fmt(b)}`}. Нажмите, чтобы узнать подробнее"><span class="drg-star" aria-hidden="true"><b>${L}</b></span><span class="drg-xpbar" aria-hidden="true"><i style="width:${xp}%"></i></span></button>
      <div class="drg-hud-r">${pill('gold','🪙',bal.gold,'Золото')}${pill('gems','💎',bal.gems,'Самоцветы')}${pill('food','🌾',bal.food,'Корм')}</div></div>
      ${own?`<div class="drg-svw">${saveHTML(uid)}${volHTML(st,c.info,true)}${slot7HTML(st,true)}${gl&&!S.drgPanel&&!S.drgSel?`<button class="drg-goal" data-act="drgpanel" data-v="breed"><small>Цель: первый потомок · шаг ${gl.step} из ${gl.of}</small><b>${gl.text}</b></button>`:''}</div>`:''}
      ${placeBar}
      <div class="drg-dock" role="group" aria-label="Действия на острове">${dock}</div>
      <div class="drg-zm"><button class="drg-kh" data-act="drgpanel" data-v="keys" aria-label="Клавиши (?)" title="Клавиши">⌨</button><button data-act="drgzoom" data-v="in" aria-label="Приблизить">+</button><button data-act="drgzoom" data-v="out" aria-label="Отдалить">−</button><button data-act="drgzoom" data-v="fit" aria-label="Весь остров" title="Весь остров">⤢</button><button data-act="drgpanel" data-v="blds" aria-label="Мои постройки" title="Мои постройки">▤</button></div>
      ${pl?'':isleBtn(st,own)}
      <div class="drg-stage">${isl}</div>
      </div>`+panel(st,c,own)}
  const head=`${back}${own?saveHTML(uid,true)+slot7HTML(st):''}<div class="drg-ih"><div class="drg-ih-t"><h1>Остров драконов${own?'':': '+esc(name(uid))}</h1><span class="muted small">Время на острове идёт в карточках: повторено ${cards(K)}</span>${own?volHTML(st,c.info,true):''}</div>${lvlHTML(st)}${walletHTML(st)}</div>`;
  const tools=own&&!pl?`<div class="drg-tools"><button class="btn sm" data-act="drgfull" data-v="1">🏝 Отправиться на остров</button><button class="btn ghost sm" data-act="drgpanel" data-v="shop">🔨 Построить</button><button class="btn ghost sm" data-act="drgpanel" data-v="market">🐉 Рынок</button><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">📖 Драконы</button><button class="btn ghost sm" data-act="drgpanel" data-v="breed">🥚 Скрещивание</button>${st.dragons.length?'<button class="btn ghost sm" data-act="drgfight">⚔️ Поход</button>':''}<button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button><button class="btn ghost sm" data-act="drgpanel" data-v="help">Как это работает</button></div>`:'';
  const map=`<div class="drg-map${pl?' placing':''}${cur?' lava':''}">${placeBar}${pl?'':isleBtn(st,own)}${isl}<button class="drg-fsb" data-act="drgfull" data-v="1" aria-label="Открыть остров на весь экран">⛶</button></div>`;
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
  if(p==='more')return moreHTML(st,own,c);
  if(p==='blds')return bldsHTML(st,c,own);
  if(own&&p==='isle2')return isle2HTML(st);
  if(p==='lvl')return lvlInfoHTML(st,c);
  if(p==='keys')return keysHTML();
  if(own&&p&&p.startsWith('res:'))return resHTML(st,c,p.slice(4));
  if(p==='journal')return journalHTML(st);
  if(p==='research')return researchHTML(st,own);
  if(p==='baby'){const d=st.dragons.find(x=>x.id===S.drgBaby);if(d)return `<section class="sheet drg-pan drg-baby"><div class="drg-pan-h"><h2>🐣 Вылупился ${esc(d.name)}!</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>${own?saveHTML(meId()):''}${d.nurs&&!d.home?`<p class="drg-why">Подходящего свободного дома пока нет (нужен дом: ${E.habNames(phOf(d))}), поэтому ${esc(d.name)} пока в яслях Инкубатора. Как только появится дом со свободным местом, малыш переселится в него сам.</p>${own?homeHint(st,d):''}`:''}<div class="drg-list">${dragonCard(st,d,own,L)}</div><div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button><button class="btn ghost sm" data-act="drgpanel" data-v="breed">🥚 Скрещивание</button></div></section>`}
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
      if(!pl)return `<div class="drg-plot"><b>Грядка ${i+1}</b><span class="muted small">Пусто</span>${own?`<div class="drg-crops">${Object.entries(E.CROPS).map(([k,cr])=>`<button class="btn ghost sm" data-act="drgdo" data-t="plant" data-id="${b.id}" data-plot="${i}" data-crop="${k}"${L<cr.unlock?' disabled title="Откроется на '+cr.unlock+'-м уровне острова"':''}>${cr.name}<small>${cr.cost} 🪙 · сразу → ${Math.round(cr.food*E.streakMult(c.streak))} 🌾</small></button>`).join('')}</div>`:''}</div>`;
      const cr=E.CROPS[pl.crop],rd=E.ready(pl,K),lf=E.left(pl,K);
      return `<div class="drg-plot${rd?' ready':''}"><b>Грядка ${i+1}: ${cr.name}</b><span class="drg-bar"><i style="width:${pl.need?Math.min(100,(pl.need-lf)/pl.need*100):100}%"></i></span><span class="muted small">${rd?`Созрело: ${Math.round(cr.food*E.streakMult(c.streak))} корма${c.streak?` (серия +${Math.round((E.streakMult(c.streak)-1)*100)} %)`:''}`:`Осталось ${cardsAcc(lf)}`}</span>${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="harvest" data-id="${b.id}" data-plot="${i}">Собрать урожай</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}</div>`}
  if(T.kind==='nest'&&!b.build)h+=nestHTML(st,b,c,own);
  if(T.kind==='hatch'&&!b.build)h+=hatchHTML(st,b,c,own);
  if(own){const nx=(E.lvTable(b.type)||[])[b.lvl+1];
    const upWhy=!nx?'':nx.L&&L<nx.L?`${b.lvl+1}-й уровень с ${nx.L}-го уровня острова`:b.type==='hatch'&&b.lvl===1&&!st.slot7?`Сначала второе место за серию ${E.SLOT7} дней подряд`:'';
    h+=`<div class="actions" style="justify-content:flex-start">${nx&&!job?`<button class="btn ghost sm" data-act="drgdo" data-t="upgrade" data-id="${b.id}"${upWhy?' disabled':''}>Улучшить до ${b.lvl+1}-го: ${fmt(nx.cost)} 🪙, ${nx.need} к.${T.kind==='hab'?` (мест ${nx.cap}, сундук ${fmt(nx.chest)})`:T.kind==='farm'?` (грядок ${nx.plots})`:` (мест для яиц ${nx.slots}${b.id===E.firstHatch(st)?' + место за серию':''})`}</button>${upWhy?`<span class="drg-why">${upWhy}</span>`:''}`:''}<button class="btn ghost sm" data-act="drgmove" data-id="${b.id}">Переместить</button></div>`}
  return h+`</section>`}

/* золото дракона за следующую карточку: удвоение и ступень лесенки сегодняшнего дня (одна десятая) */
const todayN=()=>{const st=S.streak[S.drgUid||meId()];return st?streakInfo(st).todayN:0};
const goldTxt=(st,d)=>{const v=E.goldNow(st,d,todayN());return v>=100?fmt(v):String(Math.round(v*10)/10).replace('.',',')};
/* на каком уровне острова предел драконов станет больше cap */
const capAt=cap=>{for(let k=1;k<=E.ISLE_MAX;k++)if(E.maxDragonLv(k)>cap)return k;return null};
function dragonCard(st,d,own,L){
  const ph=phOf(d),rr=G.rarity(ph),fp=E.feedPrice(st,d),cost=fp.cost,cap=E.maxDragonLv(L),home=st.bld.find(b=>b.id===d.home),ms=E.mastery(d.lvl);
  const homes=own?st.bld.filter(b=>b.id!==d.home&&!b.build&&E.hosts(b.type,ph)&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b)):[];
  return `<article class="drg-card ${RCLS[rr]}"><button class="drg-pic" data-act="drginsp" data-dragon="${d.id}" aria-label="Осмотреть: ${esc(d.name)}" title="Осмотреть крупно">${W.svg(ph,{stage:W.stageOf(d.lvl),key:'c'+d.id,size:170,label:esc(d.name)})}</button>
  <div class="drg-info"><div class="drg-nm"><b>${esc(d.name)}</b><span class="drg-sex" title="${d.genome.sex==='F'?'самка ZW':'самец ZZ'}">${SEX[d.genome.sex]}</span><span class="drg-rar" title="Редкость: как трудно вывести такой фенотип">${G.RARITY[rr]}</span>${rankHTML(ph)}</div>
  <div class="drg-dl"><span>${d.lvl}-й уровень, ${W.STAGE_NAME[W.stageOf(d.lvl)]}${ms?`, ${E.MASTERY[ms]}`:''}</span><span class="drg-pips" title="Кормлений до следующего уровня">${Array.from({length:E.FEEDS},(_,i)=>`<i${i<(d.fed||0)?' class="on"':''}></i>`).join('')}</span><span class="muted">+${goldTxt(st,d)} 🪙 за карточку</span></div>
  <ul>${W.describe(ph).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <p class="muted small" style="margin:4px 0 0">${home?'Живёт: '+E.TYPES[home.type].name:d.nurs?`В яслях Инкубатора, ждёт дом: ${E.habNames(ph)}`:'Без дома'}${d.parents?` · ${d.gen}-е поколение, родители ${d.parents.map(id=>esc(dname(st,id))).join(' × ')}`:d.from==='market'?' · с рынка':''}</p>
  ${own?`<p class="muted small drg-feedi">${d.lvl<cap?`Кормлений до ${d.lvl+1}-го уровня: ${d.fed||0} из ${E.FEEDS}, ещё ${E.FEEDS-(d.fed||0)} по ${cost} 🌾 корма.`:d.lvl>cap?`Уровень ${d.lvl} выше нынешнего предела острова (${cap}-й): уровень сохраняется, кормить дальше можно, когда предел его догонит.`:`Достигнут предел: ${cap}-й уровень.`} ${cap<E.DRAGON_MAX?`На острове ${L}-го уровня драконы растут до ${cap}-го${capAt(cap)?`, предел поднимется на ${capAt(cap)}-м уровне острова`:''}.`:'Это наибольший уровень драконов в игре.'}${fp.catchUp&&d.lvl<cap?` Догоняющий рост: этот дракон отстаёт от самого сильного на ${E.ECON.catchUp.gap}+ уровней, корм вдвое дешевле (${cost} вместо ${fp.full}).`:''}</p>`:''}
  ${own?`<div class="drg-da">${d.lvl<cap?`<button class="btn sm" data-act="drgdo" data-t="feed" data-dragon="${d.id}"${st.bal.food<cost?' disabled':''}>Покормить: ${cost} 🌾</button>${st.bal.food<cost?`<span class="drg-why">Корма ${fmt(st.bal.food)} из ${cost}. Корм растёт на ферме и приходит паёк за день с карточками.</span>`:''}`:`<span class="muted small">${cap<20?`Следующий уровень откроется, когда остров дорастёт до ${L+1}-го уровня`:'Дракон вырос до наибольшего уровня'}</span>`}
  ${homes.map(b=>`<button class="btn ghost sm" data-act="drgdo" data-t="place" data-dragon="${d.id}" data-home="${b.id}">Переселить: ${E.TYPES[b.type].name}</button>`).join('')}
  <button class="btn ghost sm" data-act="drgrename" data-dragon="${d.id}">Имя</button><button class="btn ghost sm" data-act="drgrelease" data-dragon="${d.id}">Отпустить</button></div>`:''}</div></article>`}
/* боевой ранг ✦ и сочетание стихий: ранг считает разные стихийные атаки, это не редкость и не звёзды боя ★ */
function rankHTML(ph){const B=window.DSTATS&&DSTATS.badge(ph);if(!B)return '';
  return `<span class="drg-rank${B.rank?'':' none'}" title="${esc(B.title)}">${B.rank?`<b aria-hidden="true">${B.stars}</b>`:''}<span>${esc(B.name)}</span><span class="sr"> ${esc(B.title)}</span></span>`}
function dname(st,id){const d=st.dragons.find(x=>x.id===id)||(st.gone||[]).find(x=>x.id===id);return d?d.name:'?'}

/* ---------- скрещивание ---------- */
const ELW={F:'огонь',W:'вода',T:'земля',A:'воздух',P:'флора',L:'свет',D:'тьма'};
const TRAITS={
  elements:'Стихия',color:'Окрас',hornsMace:'Рога и булава',crest:'Гребень',shortWings:'Короткие крылья',span:'Размах крыльев',sex:'Пол',metal:'Блеск чешуи',night:'Ночное зрение',glow:'Свечение глаз',spurs:'Шпоры'};
/* аллели стихий родителя: E и E2 (у старого генома E2 ещё нет) */
const eAlleles=d=>{const L=G.CHROMS.A1.loci,g=d&&d.genome;if(!g||!g.A1)return phOf(d).elements;
  return ['E','E2'].flatMap(l=>{const i=L.indexOf(l);return i>=0&&g.A1[0].length>i?[g.A1[0][i],g.A1[1][i]]:[]}).filter(a=>a!=='e'&&a!=='0')};
const subsets=(a,k)=>k===0?[[]]:a.flatMap((x,i)=>subsets(a.slice(i+1),k-1).map(r=>[x,...r]));
function classesOf(trait,m,f){
  const yes=[['true','есть'],['false','нет']];
  switch(trait){
    /* варианты стихии берутся из аллелей обоих родителей (паспорт их и так показывает), а не из проявленных стихий:
       самка F/F с s/s дремлет, но передаёт F, и пара с W/W даёт F+W. Невозможные сочетания тоже в списке, ответ он не выдаёт */
    case 'elements':{const el=[...new Set([m,f].flatMap(d=>eAlleles(d)).filter(a=>a!=='e'))].sort((a,b)=>G.ELEM_ORDER.indexOf(a)-G.ELEM_ORDER.indexOf(b)),out=[];
      for(let k=1;k<=Math.min(4,el.length);k++)subsets(el,k).forEach(c=>out.push([c.join('+'),c.map(a=>ELW[a]).join(k>2?', ':' и ')]));
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
    return `${m&&f?famHTML(m,f,'np'):`<div class="drg-pair">${[m,f].map(d=>d?`<span class="drg-chip">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:'np'+d.id,size:56})}<small>${esc(d.name)} ${SEX[d.genome.sex]}</small></span>`:'').join('<b>×</b>')}</div>`}${pr}
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
  ${famHTML(m,f,'bp')}
  <details class="drg-predbox" data-k="drgpred"${tr?' open':''}><summary>Сделать прогноз (по желанию)</summary>
    <p class="muted small">Если догадалась о генотипах родителей, предскажи долю потомков с признаком. Доля считается среди вылупившихся потомков этой пары (яйца, которые не развились, в неё не входят) и без учёта редких мутаций. Пример: у двух короткокрылых родителей Wgˢ/+ четверть всех яиц (Wgˢ/Wgˢ) не развивается, а среди вылупившихся короткокрылых 2/3. Среди всех яиц короткокрылых 1/2, но в прогноз идёт 2/3. Ошибка до ${Math.round(E.PRED_TOL*100)} процентных пунктов засчитывается: скрещивание вдвое быстрее и самоцвет. Неверный прогноз ничего не стоит.</p>
    <div class="drg-breed"><label>Признак ${sel('drgPt',[['','без прогноза'],...Object.entries(TRAITS)],tr)}</label>${tr?`<label>Вариант ${sel('drgPc',cls,cv)}</label><label>Доля, % <input id="drgPp" class="drg-in" type="number" min="0" max="100" step="0.1" inputmode="decimal" value="${esc(fv.drgPp||'')}" placeholder="например 25"></label>`:''}</div></details>
  ${low.length?`<p class="muted small">${low.map(d=>`${esc(d.name)} (${d.lvl}-й ур.)`).join(' и ')}: для скрещивания нужен ${E.BREED_LV}-й уровень. Кормят дракона кнопкой «Покормить» в его карточке, корм для этого растёт на ферме.</p><div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">Открыть драконов</button></div>`:''}
  <div class="actions" style="justify-content:flex-start"><button class="btn sm" data-act="drgbreed" data-id="${b.id}" data-m="${mid}" data-f="${fid}"${low.length||st.bal.gold<cost?' disabled':''}>Скрестить: ${fmt(cost)} 🪙, ${cards(E.BREED_NEED)}</button>${!low.length&&st.bal.gold<cost?`<span class="drg-why">Не хватает ${fmt(cost-Math.floor(st.bal.gold))} 🪙. Золото копится в сундуках домов за каждую повторённую карточку.</span>`:''}</div>`}

/* ---------- схема «родители → возможное потомство» (4.3) ----------
   Примеры потомков считает настоящий мейоз (G.breed), но со своими зёрнами, а не с зерном яйца: настоящий результат
   яйца они не выдают. Показываются только разные фенотипы из жизнеспособных яиц, без долей: прогноз остаётся загадкой */
const ELI2={F:'🔥',W:'💧',T:'⛰️',A:'🌬️',P:'🌿',L:'☀️',D:'🌙'};
const cap=t=>t?t[0].toUpperCase()+t.slice(1):t;
const elName=ph=>ph.breath==='element'?ph.elements.map(e=>cap(W.ELN[e])).join(' + '):ph.breath==='smoke'?'Дымный':'Дремлющий';
function genoShort(d){const T=window.DRGINSP&&DRGINSP.allelesText;if(!T)return '';return ['E','C','H'].map(l=>`${l} = ${esc(T(d.genome,l))}`).join(' · ')}
function offspring(m,f,n){const out=[],seen=new Set();
  for(let i=0;i<80&&out.length<n;i++){const e=G.breed(m.genome,f.genome,G.rng('ex:'+m.id+':'+f.id+':'+i));if(!e||!e.viable)continue;
    const ph=G.phenotype(e.genome),k=JSON.stringify(E.summary(ph));if(seen.has(k))continue;seen.add(k);out.push(ph)}
  return out}
function famHTML(m,f,key){const kids=offspring(m,f,4),par=[m,f].map(phOf);
  const note=ph=>{const B=window.DSTATS&&DSTATS.badge(ph);if(B&&B.hyb)return B.hyb;if(par.every(p=>p.color!==ph.color))return 'новый окрас';if(par.every(p=>p.horns!==ph.horns))return ph.horns?'с рогами':'без рогов';return ''};
  const pc=(d,i)=>`<div class="fam-p"><span class="fam-pic">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:key+'p'+i+d.id,size:84})}</span><small>Родитель ${i+1} ${SEX[d.genome.sex]}</small><b>${esc(d.name)} · ${esc(elName(phOf(d)))}</b><code>${genoShort(d)}</code></div>`;
  return `<div class="fam"><div class="fam-top">${pc(m,0)}<div class="fam-mid" aria-hidden="true"><span class="fam-heart">❤</span><span class="fam-x">×</span></div>${pc(f,1)}</div>
    <div class="fam-arr" aria-hidden="true">${kids.map(()=>'<span>↓</span>').join('')}</div>
    <div class="fam-kids">${kids.map((ph,i)=>`<div class="fam-k"><span class="fam-pic">${W.svg(ph,{stage:0,key:key+'k'+i,size:70})}</span><small>Потомок ${i+1}</small><b>${ph.breath==='element'?ph.elements.map(e=>ELI2[e]).join(''):''} ${esc(elName(ph))}</b>${note(ph)?`<em>${esc(note(ph))}</em>`:''}</div>`).join('')}</div>
    <p class="muted small">Так могут выглядеть малыши этой пары: каждый раз мейоз даёт новое сочетание. Какой вылупится, станет ясно в Инкубаторе.</p></div>`}

/* куда пойдёт малыш из готового яйца: проверка до нажатия «Вылупить» */
const nursCap=st=>E.nurseryCap(E.level(st));
function hatchBlocked(st,eg){return eg.viable&&!E.homeFor(st,G.phenotype(eg.genome))&&E.nursery(st)>=nursCap(st)}
function hatchWhy(st,eg){if(!eg.viable)return '';const ph=G.phenotype(eg.genome),h=E.homeFor(st,ph);
  if(h)return `<span class="muted small">Поселится: ${E.TYPES[h.type].name}</span>`;
  const n=E.nursery(st);
  return n<nursCap(st)?`<span class="drg-why">Свободного дома нет (нужен дом: ${E.habNames(ph)}). Малыш поживёт в яслях: занято ${n} из ${nursCap(st)}.</span>`
    :`<span class="drg-why">Свободного дома нет (нужен дом: ${E.habNames(ph)}), и ясли заняты. Переселите малыша из яслей или освободите место в доме. Яйцо подождёт здесь.</span>`}
/* второе место Инкубатора: сообщение один раз после открытия и закрытое место с прогрессом серии до открытия */
function slot7HTML(st,mini){if(!st.slot7new)return '';
  return mini?`<button class="drg-goal" data-act="drgdo" data-t="ack" data-what="slot7"><small>Серия ${E.SLOT7} дней подряд</small><b>Второе место в Инкубаторе открыто ✓</b></button>`
    :`<div class="drg-why ok drg-s7" role="status"><span>🥚 Серия ${E.SLOT7} дней подряд: в Инкубаторе открыто второе место. Оно остаётся навсегда, даже если серия прервётся.</span><button class="btn sm" data-act="drgdo" data-t="ack" data-what="slot7">Понятно</button></div>`}
function lockedSlotHTML(st,b,c){if(st.slot7||b.id!==E.firstHatch(st))return '';const cur=(c.info&&c.info.cur)||0;
  return `<div class="drg-plot locked" aria-disabled="true"><b>🔒 Второе место</b><span class="muted small">Откроется бесплатно за серию ${E.SLOT7} дней подряд (дней с ${GOAL}+ карточками). Сейчас ${cur} из ${E.SLOT7}.</span><span class="drg-bar"><i style="width:${Math.min(100,cur/E.SLOT7*100)}%"></i></span></div>`}
function hatchHTML(st,b,c,own){
  const K=c.K;
  return `<div class="drg-plots">${b.slots.map((eg,i)=>{
    if(!eg)return `<div class="drg-plot"><b>Место ${i+1}</b><span class="muted small">Пусто. Яйца приходят из Гнездовья.</span></div>`;
    const rd=E.ready(eg,K),lf=E.left(eg,K);
    return `<div class="drg-plot${rd?' ready':''}"><span class="drg-egg"><svg viewBox="-14 -16 28 32" width="34" height="40" aria-hidden="true">${I.eggSVG(0,0,eg)}</svg><b>Яйцо №${eg.n}</b></span><span class="muted small">${esc(dname(st,eg.m))} ♀ × ${esc(dname(st,eg.f))} ♂</span><span class="drg-bar"><i style="width:${Math.min(100,(eg.need-lf)/eg.need*100)}%"></i></span><span class="muted small">${rd?'Готово!':`До вылупления ${cardsAcc(lf)}`}</span>
      ${rd?hatchWhy(st,eg):''}
      ${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="hatch" data-id="${b.id}" data-plot="${i}"${hatchBlocked(st,eg)?' disabled':''}>Вылупить</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}${lockedSlotHTML(st,b,c)}</div>`}

/* ---------- «Скрещивание»: путь к первому потомку и всё о парах и яйцах ----------
   Шаги считает E.breedPath по настоящему состоянию; у каждого шага ближайшее действие и причина, если оно закрыто. */
const STEP_T={parents:'Самка и самец 3-го уровня',build:'Гнездовье и Инкубатор',pair:'Пара в Гнездовье',egg:'Яйцо в Инкубаторе',hatch:'Вылупление'};
const toCards='<button class="btn ghost sm" data-act="drgcards">Повторять карточки</button>';
function breedHTML(st,c,own){
  const P=E.breedPath(st,c.K),L=E.level(st),bal=st.bal,b=k=>P.steps.find(x=>x.k===k);
  const btn=(attrs,label,why)=>`<button class="btn sm" ${attrs}${why?' disabled':''}>${label}</button>${why?`<span class="drg-why">${why}</span>`:''}`;
  const body={
    parents:x=>x.par.map(p=>{const sx=p.sex==='F'?'Самка':'Самец';
      if(!p.id)return `<div class="drg-sr">${sx}: на острове нет. ${own?'<button class="btn ghost sm" data-act="drgpanel" data-v="market">🐉 Рынок</button>':''}</div>`;
      const d=st.dragons.find(z=>z.id===p.id),cost=E.feedPrice(st,d).cost;
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
  const nursH=nurs.length?`<h3>Ясли Инкубатора: ${nurs.length} из ${nursCap(st)}</h3>${nurs.map(d=>`<div class="drg-sr"><span>${esc(d.name)} ${SEX[d.genome.sex]}: нужен дом: ${E.habNames(phOf(d))}</span><button class="btn ghost sm" data-act="drginsp" data-dragon="${d.id}">Открыть</button></div>`).join('')}<p class="muted small">В яслях малыши не приносят золота. «Переселить» в карточке дракона появится, когда будет свободный подходящий дом.</p>`:'';
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
  const x=P.steps.find(z=>z.k===P.next),T={parents:'вырастить самку и самца до 3-го уровня',build:'построить Гнездовье и Инкубатор',
    pair:'выбрать пару в Гнездовье',egg:x.pair&&x.pair.ready?'перенести яйцо в Инкубатор':`яйцо будет через ${x.pair?cards(x.pair.left):'…'}`,hatch:x.eggs&&x.eggs.some(e=>e.ready)?'вылупить малыша':`малыш вылупится через ${x.eggs&&x.eggs.length?cards(Math.min(...x.eggs.map(e=>e.left))):'…'}`};
  return {step:P.steps.indexOf(x)+1,of:P.steps.length,text:T[P.next]}}

/* журнал: потомство по парам и расщепление по выбранному признаку */
const PH_KEY={elements:x=>x.el,color:x=>x.c,hornsMace:x=>(x.h?'H':'h')+(x.k?'K':'k'),crest:x=>x.r,shortWings:x=>String(!!x.sw),span:x=>String(x.span),sex:x=>x.sex,metal:x=>String(!!x.m),night:x=>String(!!x.n),glow:x=>String(!!x.g),spurs:x=>String(!!x.sp)};
function journalHTML(st){
  const log=st.log||[],fv=S.fv||{},tr=PH_KEY[fv.drgJt]?fv.drgJt:'elements';
  const close=`<button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button>`;
  if(!log.length)return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Журнал скрещиваний</h2>${close}</div><p class="muted">Пока ни одного яйца. Гнездовье и Инкубатор уже стоят на острове: вырастите самку и самца до 3-го уровня, скрестите их, и сюда попадёт каждый потомок.</p></section>`;
  const pairs=new Map();log.forEach(r=>{const k=r.m+'|'+r.f;if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(r)});
  /* родитель из нынешних драконов или из архива отпущенных: подставлять генотип случайного дракона нельзя, теория была бы чужой */
  const par=id=>st.dragons.find(x=>x.id===id)||(st.gone||[]).find(x=>x.id===id)||null;
  const pc=v=>String(Math.round(v*1000)/10).replace('.',',')+' %';
  const block=([k,rs])=>{const [mi,fi]=k.split('|'),m=par(mi),f=par(fi),gone=[m,f].filter(d=>d&&!st.dragons.includes(d));
    const alive=rs.filter(r=>!r.dead),cnt={};alive.forEach(r=>{const v=PH_KEY[tr](r.ph);cnt[v]=(cnt[v]||0)+1});
    const names=Object.fromEntries(m&&f?classesOf(tr,m,f):tr!=='elements'?classesOf(tr,null,null):[]);
    const nm=v=>names[v]||(tr==='elements'?(v==='smoke'?'дымный, без стихии':v==='dormant'?'дремлющий':v.split('+').map(x=>ELW[x]||x).join(' и ')):v);
    const rows=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<tr><td>${esc(nm(v))}</td><td>${n}</td><td>${Math.round(n/alive.length*100)} %</td></tr>`).join('');
    const dead=rs.length-alive.length;
    /* теория по известным генотипам родителей: доли среди вылупившихся (как в прогнозе) и отдельно доля неразвившихся яиц */
    let theory='';
    if(m&&f&&m.genome&&f.genome){const th=G.dist(m.genome,f.genome,tr),leth=G.lethalShare(m.genome,f.genome),keys=[...new Set([...Object.keys(th),...Object.keys(cnt)])];
      keys.sort((a,b)=>(th[b]||0)-(th[a]||0)||(cnt[b]||0)-(cnt[a]||0));
      theory=`<details class="drg-th" data-k="drgth-${esc(k)}"><summary>Сравнить с теорией по генотипам родителей</summary>
        <p class="muted small">Генотипы родителей известны из паспорта, поэтому теорию можно посчитать точно (без мутаций). Если хотите сначала угадать генотипы сами, не открывайте этот блок.</p>
        <div class="tbl-wrap"><table class="drg-tt"><thead><tr><th>${TRAITS[tr]}</th><th>Наблюдали</th><th>Теория${leth?' среди вылупившихся':''}</th>${leth?'<th>Теория среди всех яиц</th>':''}</tr></thead><tbody>
        ${keys.map(v=>`<tr><td>${esc(nm(v))}${!th[v]?' <span class="drg-off">вне расчёта: мутация</span>':''}</td><td>${cnt[v]||0} из ${alive.length}<small> ${alive.length?Math.round((cnt[v]||0)/alive.length*100):0} %</small></td><td>${pc(th[v]||0)}</td>${leth?`<td>${pc((th[v]||0)*(1-leth))}</td>`:''}</tr>`).join('')}
        ${leth?`<tr><td>не развилось (Wgˢ/Wgˢ)</td><td>${dead} из ${rs.length} яиц</td><td>—</td><td>${pc(leth)}</td></tr>`:''}</tbody></table></div>
        <p class="muted small">${leth?`У этой пары теоретически ${pc(leth)} яиц не развиваются, поэтому доли среди вылупившихся и среди всех яиц разные. Прогноз на острове считается среди вылупившихся. `:'По теории все яйца этой пары развиваются. '}Выборка: ${rs.length} ${plural(rs.length,'яйцо','яйца','яиц')}, ${alive.length} ${plural(alive.length,'потомок','потомка','потомков')}. На маленькой выборке доли заметно гуляют: при восьми потомках и теории 50 % часто выпадает 3 или 5 из 8, и это не опровергает теорию. Мутации (игровой параметр, 1/400 на ген в гамете) изредка дают потомка вне расчёта.</p></details>`}
    else theory=`<p class="muted small">Генотип родителя не сохранился в архиве, поэтому теорию для этой пары посчитать нельзя. Наблюдения остаются.</p>`;
    return `<div class="drg-jb"><h3>${esc(dname(st,mi))} ♀ × ${esc(dname(st,fi))} ♂ <span class="muted small">${rs.length} ${plural(rs.length,'яйцо','яйца','яиц')}</span></h3>
      ${gone.length?`<p class="muted small">${gone.map(d=>esc(d.name)).join(' и ')}: ${gone.length>1?'отпущены':'отпущен'}, генотип взят из архива острова.</p>`:''}
      <p class="muted small">Наблюдения: всего ${rs.length} ${plural(rs.length,'яйцо','яйца','яиц')}, вылупилось ${alive.length}, не развилось ${dead}.</p>
      ${alive.length?`<div class="tbl-wrap"><table class="drg-tt"><thead><tr><th>${TRAITS[tr]}</th><th>Потомков</th><th>Доля среди вылупившихся</th></tr></thead><tbody>${rows}</tbody></table></div>`:''}
      ${theory}</div>`};
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
    const one=t.max&&E.count(st,t.kind)>=E.maxOf(t,L)&&st.bld.find(b=>b.type===k);
    if(one)return `<button class="drg-shop-i built" data-act="drgsel" data-id="${one.id}"><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${one.build?'строится':t.more?(L<t.more.L?`уже есть, второе с ${t.more.L}-го уровня`:'уже построено'):'уже построено'}</small><span class="drg-price">${one.build?'Строится':'Построено'} → открыть</span></button>`;
    const bc=E.buildCost(st,k),gold=Math.floor(st.bal.gold),gems=Math.floor(st.bal.gems),noG=gold<bc.gold,noM=(bc.gems||0)>gems;
    const why=t.soon?'В следующем обновлении':lock?`С ${t.unlock}-го уровня`:full?(t.kind==='hab'?`Сред обитания уже ${E.count(st,'hab')} из ${E.maxHabs(L)}: следующая с ростом острова`:`Ферм уже ${E.count(st,'farm')} из ${E.maxFarms(L)}: следующая с ростом острова`)
      :noG?`Не хватает ${fmt(bc.gold-gold)} 🪙`:noM?`Не хватает ${bc.gems-gems} 💎`:'';
    return `<button class="drg-shop-i" data-act="drgbuild" data-type="${k}"${why?' disabled':''}><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${t.kind==='hab'?'для: '+t.hosts.map(h=>HOSTS[h]).join(', '):t.kind==='farm'?'корм для драконов':'для скрещивания'}</small><span class="drg-price">${fmt(bc.gold)} 🪙${bc.gems?' + '+bc.gems+' 💎':''} · ${bc.need} к.</span>${why?`<em>${why}</em>`:''}</button>`};
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

/* «Ещё»: то, что не поместилось в нижние кнопки */
/* три шкалы: уровень острова, уровень драконов, поход. Что даст следующий уровень и где новых построек больше не будет (этап 5) */
function scalesHTML(st,c){const L=E.level(st),b=E.xpFor(L+1),pc=xpPct(st);
  const nx=E.unlocksAt(L+1),mj=E.nextMajor(L),cap=E.maxDragonLv(L),top=Math.max(0,...st.dragons.map(d=>d.lvl));
  const capL=capAt(cap);
  const isle=L>=E.ISLE_MAX?'Это высший уровень острова: опыт дальше копится, но новых уровней нет.':`До ${L+1}-го: ${fmt(st.bal.xp)} из ${fmt(b)} опыта. ${nx.length?'Он даст: '+esc(nx.join('; '))+'.':'Он даст только опыт.'}`
    +(mj&&mj.L>L+1?` Ближайшее открытие на ${mj.L}-м уровне: ${esc(mj.list.join('; '))}.`:'');
  let camp='';if(window.DRCAMP){const p=DRCAMP.progress(docOf(c.uid));
    camp=`<div class="drg-sc"><div class="st-k">⚔ Поход</div><ul class="drg-scr">${DRCAMP.REGIONS.map(r=>{const ns=DRCAMP.nodesOf(r.id),op=DRCAMP.regionOpen(p,r.id);
      return `<li><b>${esc(r.name)}</b><span>${ns[0].rec}–${ns[ns.length-1].rec}-й ур. · ${op?`★ ${DRCAMP.total(p,r.id)} из ${DRCAMP.max(r.id)}`:'закрыт'}</span></li>`}).join('')}</ul>
      <small>Уровень острова на бои не влияет, важны уровни драконов.</small></div>`}
  return `<div class="drg-scl"><div class="drg-sc"><div class="st-k">🏝 Остров · ${L}-й уровень</div><span class="drg-xp" role="img" aria-label="Опыт до следующего уровня: ${pc} %"><i style="width:${pc}%"></i></span><small>${isle}</small></div>
  <div class="drg-sc"><div class="st-k">🐉 Драконы · до ${cap}-го уровня</div><small>Самый сильный сейчас ${top}-го уровня. Уровень дракона растёт кормлением, ${E.FEEDS} кормления на уровень. ${capL?`На ${capL}-м уровне острова предел станет ${E.maxDragonLv(capL)}.`:'Это предел роста драконов.'}</small></div>${camp}</div>`}
function moreHTML(st,own,c){const it=(act,v,ic,t,d)=>`<button class="drg-mi" data-act="${act}" data-v="${v}"><i aria-hidden="true">${ic}</i><span><b>${t}</b><small>${d}</small></span></button>`;
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Ещё</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>${c?scalesHTML(st,c):''}<div class="drg-menu">
  ${own?it('drgpanel','market','🐉','Рынок драконов','купить дракона одной стихии'):''}${it('drgpanel','journal','📓','Журнал скрещиваний','потомство пар и доли признаков')}
  ${it('drgpanel','blds','▤','Мои постройки','список зданий: открыть любое')}${it('drgzoom','fit','⤢','Весь остров','вернуть вид целиком')}
  ${it('drgpanel','research','🔬','Цели исследования','разовые награды за открытия в разведении')}
  ${it('drgcards','','📚','Повторять карточки','время острова идёт в карточках')}${it('drgpanel','help','?','Как это работает','золото, корм, самоцветы, уровни')}</div></section>`}
/* цели исследования: что сделать в разведении и росте, разовая награда (economy.js RESEARCH) */
function researchHTML(st,own){const L=E.level(st),got=st.goals||{};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Цели исследования</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <p class="muted small">Каждая цель даёт самоцветы один раз. Новые цели открываются с ростом острова.</p><div class="drg-goals">${E.RESEARCH.map(g=>{const open=L>=g.L,done=!!got[g.id],ok=open&&!done&&g.ok(st);
    return `<div class="drg-sr${done?' ok':''}"><span><b>${esc(g.name)}</b> · ${esc(g.text)}<br><small class="muted">${done?'награда получена':open?(ok?'выполнено, можно забрать':'ещё не выполнено'):`откроется на ${g.L}-м уровне острова`} · +${g.gems} 💎</small></span>${own&&ok?`<button class="btn sm" data-act="drgdo" data-t="research" data-goal="${g.id}">Забрать</button>`:''}</div>`}).join('')}</div></section>`}
/* «Мои постройки»: те же здания, что на карте, списком; нажатие открывает то же, что нажатие на карте */
function bldsHTML(st,c,own){const K=c.K,L=E.level(st);
  const stat=b=>(st.isl2?(E.isleOf(b)?'🌋 Огненный, ':'🏝 Зелёный, '):'')+stat0(b);
  const stat0=b=>{const T=E.TYPES[b.type],job=b.build||b.up;if(b.build)return E.ready(b.build,K)?'стройка готова':`строится, ещё ${cards(E.left(b.build,K))}`;
    const out=[];if(b.up&&!E.ready(b.up,K))out.push(`улучшается, ещё ${cards(E.left(b.up,K))}`);
    if(T.kind==='hab'){const n=st.dragons.filter(d=>d.home===b.id).length,a=Math.floor(E.chestNow(st,b,K));out.push(n?`драконов ${n} из ${E.habCap(b)}`:'пустует');if(a>=1)out.push(`в сундуке ${fmt(a)} 🪙${a>=E.chestCap(b)?' (полон)':''}`)}
    if(T.kind==='farm'){const r=(b.plots||[]).filter(p=>p&&E.ready(p,K)).length,e=(b.plots||[]).filter(p=>!p).length;out.push(r?`созрело ${r}`:e?`свободных грядок ${e}`:'растёт')}
    if(T.kind==='nest')out.push(b.pair?(E.ready(b.pair,K)?'яйцо готово':`яйцо через ${cards(E.left(b.pair,K))}`):'пара не выбрана');
    if(T.kind==='hatch'){const r=(b.slots||[]).filter(p=>p&&E.ready(p,K)).length,n=(b.slots||[]).filter(Boolean).length;out.push(r?`готово к вылуплению: ${r}`:n?`яиц ${n}`:'пусто')}
    return out.join(', ')};
  const order=[...st.bld].sort((a,b)=>E.HAB_ORDER.indexOf(a.type)-E.HAB_ORDER.indexOf(b.type));
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Мои постройки</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <p class="muted small">${st.bld.length} ${plural(st.bld.length,'постройка','постройки','построек')} на ${L}-м уровне острова. Нажатие открывает здание, как на карте.</p>${own?`<div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgdo" data-t="arrange">▦ Расставить по ячейкам заново</button></div>`:''}
  <ul class="drg-bls">${order.map(b=>`<li><button class="drg-mi" data-act="drgsel" data-id="${b.id}"><i aria-hidden="true">${BICON[E.TYPES[b.type].kind==='hab'?b.type:E.TYPES[b.type].kind]||'🏠'}</i><span><b>${E.TYPES[b.type].name}${b.build?'':` · ${b.lvl}-й ур.`}</b><small>${stat(b)}</small></span></button></li>`).join('')}</ul>
  ${own?'<div class="drg-sa"><button class="btn ghost sm" data-act="drgpanel" data-v="shop">🔨 Построить ещё</button></div>':''}</section>`}
const BICON={F:'🌋',W:'🌊',N:'🌑',T:'🏔',A:'☁️',P:'🌳',L:'🌅',D:'🗼',farm:'🌾',nest:'🪺',hatch:'🥚'};
/* откуда берётся ресурс: у каждого своё объяснение и прямые действия */
function resHTML(st,c,k){const K=c.K,info=c.info,bal=st.bal,close='<button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button>';
  const habs=st.bld.filter(b=>E.TYPES[b.type].kind==='hab'&&!b.build),farms=st.bld.filter(b=>b.type==='farm'&&!b.build);
  let t='',h='';
  if(k==='gold'){t='🪙 Золото';const rt=rateNow(st,info.todayN);
    h=`<p>Золото приносят драконы в своих домах: следующая повторённая карточка даст +${fmt(rt)} 🪙. Оно копится в сундуке дома, пока сундук не заполнится, поэтому сундуки надо собирать.</p>${volHTML(st,info)}
    ${habs.map(b=>{const a=Math.floor(E.chestNow(st,b,K));return `<div class="drg-sr"><span>${E.TYPES[b.type].name}: ${fmt(a)} из ${fmt(E.chestCap(b))}</span><button class="btn sm" data-act="drgdo" data-t="collect" data-id="${b.id}"${a>=1?'':' disabled'}>Собрать</button></div>`}).join('')}
    <p class="muted small">Ещё золото дают проводы дракона с острова. Бои и поход золота не дают.</p>`}
  else if(k==='food'){t='🌾 Корм';
    h=`<p>Корм нужен, чтобы драконы росли. Он приходит тремя путями: дневной паёк ${E.RATION(info.cur||1)} корма за день, когда набрано ${GOAL} карточек (сегодня ${info.todayN} из ${GOAL}), ${E.ECON.foodX} корма за каждую карточку сверх ${GOAL} (с бонусом за объём) и урожай с грядок на ферме.</p>
    ${farms.map(b=>`<div class="drg-sr"><span>${E.TYPES[b.type].name}: ${(b.plots||[]).filter(p=>p&&E.ready(p,K)).length} созрело, ${(b.plots||[]).filter(p=>!p).length} свободно</span><button class="btn ghost sm" data-act="drgsel" data-id="${b.id}">Открыть ферму</button></div>`).join('')||'<p class="muted small">Фермы пока нет: её можно построить за 100 🪙.</p>'}
    <div class="drg-sa"><button class="btn ghost sm" data-act="drgcards">Повторять карточки</button></div>`}
  else{t='💎 Самоцветы';
    h=`<p>Самоцветы ускоряют ожидание: один заменяет ${E.SKIP_CARDS} карточек стройки, грядки или яйца. Их дают: засчитанный день (${GOAL} карточек), каждые ${GOAL} карточек сверх цели, рубежи серии ${E.MILESTONES.map(m=>m[0]).join(', ')} дней, новый уровень острова, верный прогноз потомства, первые победы над боссами в походе и проверенные ДЗ.</p><p>Бонус за ДЗ начисляется один раз за задание по проценту выполнения: от 60 % +1 💎 и 30 🌾, от 80 % +2 💎 и 60 🌾, от 85 % +3 💎 и 100 🌾, от 90 % +4 💎 и 150 🌾. Пересдача с той же оценкой бонус не повторяет.</p>
    <p class="muted small">Сегодня ${info.todayN} из ${GOAL}${info.done?', день засчитан':''}.</p><div class="drg-sa"><button class="btn ghost sm" data-act="drgcards">Повторять карточки</button></div>`}
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>${t}: ${fmt(bal[k])}</h2>${close}</div>${h}</section>`}
function helpHTML(st,c){
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Как это работает</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <ul class="drg-help">
  <li>Время на острове идёт в карточках. Пока карточки не повторяются, остров стоит: сундуки не наполняются, корм не растёт, стройка не идёт.</li>
  <li>Золото. Каждый дракон в своей среде приносит золото за каждую карточку: чем выше уровень и редкость, тем больше. Золото копится в сундуке здания до его вместимости, собирайте его нажатием.</li>
  <li>Объём повторения. Первые ${GOAL} карточек дня приносят обычное золото, карточки 16–30 на 15 % больше, 31–60 на 30 %, 61–120 на 50 %, дальше на 60 %. Бонус считается для каждой карточки отдельно, прошлые карточки не пересчитываются. Серия дней и объём дня — разные показатели.</li>
  <li>Корм. Дневной паёк приходит, когда за день набрано ${GOAL} карточек: ${E.RATION(1)} корма и ещё 5 за каждый день серии, до ${E.RATION(99)}. Каждая карточка сверх ${GOAL} даёт ещё ${E.ECON.foodX} корма с тем же бонусом. Грядки на ферме созревают за карточки, а урожай больше на 2,5 % за каждый день серии, до +50 %.</li>
  <li>Самоцветы. Один за засчитанный день и ещё по одному за каждые ${GOAL} карточек сверх цели, награды за серию ${E.MILESTONES.map(m=>m[0]).join(', ')} дней и по 2 за каждый уровень острова. За проверенную ДЗ от 60 % ещё 1–4 самоцвета и немного корма, один раз за задание. Самоцвет заменяет ${E.SKIP_CARDS} карточек ожидания стройки или грядки.</li>
  <li>Кормление. Дракон растёт до ${E.DRAGON_MAX}-го уровня: ${E.FEEDS} кормления на уровень, корма нужно всё больше, после 20-го уровня цена растёт медленно. Предел уровня драконов растёт вместе с уровнем острова. Дракон, который отстал от самого сильного на ${E.ECON.catchUp.gap} и больше уровней, ест вдвое дешевле.</li>
  <li>Опыт и уровень острова. Опыт дают стройка, кормление, урожай и покупки. Остров растёт до ${E.ISLE_MAX}-го уровня и открывает среды обитания, фермы, культуры, улучшения, новые участки земли, места в яслях и цели исследования. Гнездовье и Инкубатор стоят на острове с начала.</li>
  <li>Инкубатор. Сначала в нём одно место для яйца. Второе открывается бесплатно и навсегда за серию ${E.SLOT7} дней подряд, дальше места добавляют улучшения.</li>
  <li>Скрещивание. В Гнездовье сажают самку и самца не ниже ${E.BREED_LV}-го уровня. Яйцо получается настоящим мейозом из генотипов родителей, которые скрыты: видно только, как выглядят драконы. Яйцо дозревает в Инкубаторе, а в журнале копится потомство каждой пары. Перед скрещиванием можно сделать прогноз доли потомков с признаком: верный ускоряет вдвое и даёт самоцвет.</li>
  <li>Поход. Кнопка ⚔️ Поход ведёт по десяти регионам, в каждом 16 боёв, команда до трёх драконов против диких. Каждая из пяти простых стихий сильна против двух и слаба против двух, Свет и Тьма сильны друг против друга, это правило игры. За победу даются звёзды, а мини-боссы регионов один раз дарят дракона-носителя гена E2. Золото и корм за бои не начисляются.</li>
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
/* рисунок острова в координатах SVG → пиксели сцены до камеры (viewBox с meet) */
/* полный вид острова: растёт вместе с открытыми кольцами земли (I.viewOf), берётся для того же документа, что и границы */
const VB={d:null,v:null};
function fullView(){const uid=S.drgUid||meId(),d=docOf(uid),x=stateOf(uid),i=x?curIsle(x.st):0;if(!(d&&VB.d===d&&VB.i===i)){VB.d=d;VB.i=i;VB.v=x?I.viewOf(viewSt(x.st)).full:I.VIEW.full}return VB.v}
function svgMap(r){const V=fullView(),s0=Math.min(r.width/V[2],r.height/V[3]);return {s0,x:u=>(r.width-V[2]*s0)/2+(u-V[0])*s0,y:v=>(r.height-V[3]*s0)/2+(v-V[1])*s0}}
/* границы того, что важно видеть: открытая земля и постройки с их высотой (в координатах SVG) */
/* all — вся открытая земля (для «Весь остров» и ограничения камеры), key — постройки и драконы (первый вид: крупно, но всё важное видно) */
const IB={d:null,b:null};
function islBounds(kind){const uid=S.drgUid||meId(),d=docOf(uid),x=stateOf(uid),i=x?curIsle(x.st):0;if(!(d&&IB.d===d&&IB.i===i)){IB.d=d;IB.i=i;IB.b=islBounds0(uid)}return IB.b[kind||'all']}
function islBounds0(uid){const def={all:[0,60,800,520],key:[100,120,600,400],whole:[0,60,800,900]},x=stateOf(uid);if(!x)return def;const st=viewSt(x.st),C=E.CHUNK;
  const box=()=>{let a=[1e9,1e9,-1e9,-1e9];return {add:p=>{a=[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[2],p[0]),Math.max(a[3],p[1])]},get:()=>a}};
  const L=box(),B=box();
  (st.land||[]).forEach(id=>{const [cx,cy]=id.split(',').map(Number);[[0,0],[C,0],[C,C],[0,C]].forEach(([i,j])=>L.add(I.P(cx*C+i,cy*C+j)))});
  st.bld.forEach(b=>{const c=I.P(b.x+1,b.y+1);B.add([c[0]-70,c[1]-(I.HEIGHT[b.type]||70)-26]);B.add([c[0]+70,c[1]+46])});
  let a=L.get();if(a[0]>a[2])return def;const all=[a[0]-36,a[1]-20,a[2]-a[0]+72,a[3]-a[1]+56];
  /* whole — остров целиком с кончиком скалы внизу (кончик скал в island.js на 418 единиц ниже переднего угла) */
  const n=E.extent(st).n,tip=I.P(n,n)[1]+430,whole=[all[0],all[1],all[2],Math.max(all[3],tip-all[1])];
  let k=B.get();if(k[0]>k[2])return {all,key:all,whole};
  /* не меньше 420×300 единиц рисунка вокруг середины построек, чтобы пара зданий не заняла весь экран */
  const cx=(k[0]+k[2])/2,cy=(k[1]+k[3])/2,w=Math.max(420,k[2]-k[0]),h=Math.max(300,k[3]-k[1]);
  return {all,whole,key:[cx-w/2,cy-h/2,w,h]}}
/* свободная часть экрана: между шапкой с ресурсами, кнопками внизу и открытой панелью */
function freeRect(r){const q=s=>{const e=document.querySelector(s);return e&&e.getClientRects().length?e.getBoundingClientRect():null};
  let top=r.top+8,bot=r.bottom-8,left=r.left+8,right=r.right-8;
  ['.drg-hud-l','.drg-hud-r','.drg-svw'].forEach(s=>{const b=q(s);if(b&&b.height)top=Math.max(top,b.bottom+6)});
  const dk=q('.drg-dock');if(dk){if(dk.height>dk.width)left=Math.max(left,dk.right+8);else bot=Math.min(bot,dk.top-6)}
  /* панель берётся по её итоговому размеру, а не по кадру анимации появления */
  const pe=document.querySelector('body.drg-fs #main>.drg-pan'),pn=pe&&pe.offsetWidth?pe:null;
  if(pn){if(pn.offsetWidth<r.width*0.6){const pr=pn.getBoundingClientRect();right=Math.min(right,(pr.width?pr.left:r.right-12-pn.offsetWidth)-8)}else bot=Math.min(bot,r.bottom-8-pn.offsetHeight-6)}
  if(bot-top<120)top=Math.max(r.top+8,bot-120);
  return {x0:left-r.left,y0:top-r.top,x1:right-r.left,y1:bot-r.top}}
const ZMIN=0.5,ZMAX=5;
/* вид «весь остров»: границы острова целиком в свободной части экрана, по центру */
/* первый вид: на узком экране крупно постройки, на широком весь остров */
const fitKind=r=>r.width<700?'key':'whole';
function camFit(r,keepZ,kind){const c=cam(),M=svgMap(r),B=islBounds(kind||'whole'),F=freeRect(r),fw=F.x1-F.x0,fh=F.y1-F.y0;
  if(!keepZ)c.z=Math.max(ZMIN,Math.min(ZMAX,fw/(B[2]*M.s0),fh/(B[3]*M.s0)));
  c.x=(F.x0+fw/2)-c.z*M.x(B[0]+B[2]/2);c.y=(F.y0+fh/2)-c.z*M.y(B[1]+B[3]/2);c.W=r.width;c.H=r.height;c.auto=!keepZ}
/* камера не уводит остров за край: хотя бы четверть его ширины и высоты остаётся в свободной части */
function camClamp(c,r){c.z=Math.max(ZMIN,Math.min(ZMAX,c.z));const M=svgMap(r),B=islBounds('whole'),F=freeRect(r);
  const x0=c.x+c.z*M.x(B[0]),x1=c.x+c.z*M.x(B[0]+B[2]),y0=c.y+c.z*M.y(B[1]),y1=c.y+c.z*M.y(B[1]+B[3]),mx=(x1-x0)/4,my=(y1-y0)/4;
  if(x1<F.x0+mx)c.x+=F.x0+mx-x1;if(x0>F.x1-mx)c.x-=x0-(F.x1-mx);if(y1<F.y0+my)c.y+=F.y0+my-y1;if(y0>F.y1-my)c.y-=y0-(F.y1-my)}
function camApply(){const st=document.querySelector('.drg-map.full .drg-stage'),r=camBox();if(!st||!r)return;const c=cam();
  if(!c.z)camFit(r,false,fitKind(r));
  else if(c.W&&(Math.abs(c.W-r.width)>1||Math.abs(c.H-r.height)>1)){
    /* поворот телефона или новое окно: нетронутый вид подгоняется заново, сдвинутый сохраняет точку в центре */
    if(c.auto)camFit(r,false,fitKind(r));else{const o=svgMap({width:c.W,height:c.H}),n=svgMap(r),u=((c.W/2-c.x)/c.z-o.x(0))/o.s0,v=((c.H/2-c.y)/c.z-o.y(0))/o.s0;
      c.x=r.width/2-c.z*n.x(u);c.y=r.height/2-c.z*n.y(v);c.W=r.width;c.H=r.height}}
  camClamp(c,r);
  st.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) scale(${c.z.toFixed(3)})`;
  /* мелко: подписи построек прячутся, чтобы не слипались */
  const m=st.parentElement,px=svgMap(r).s0*c.z,lo=px<0.42;if(m.classList.contains('zlo')!==lo)m.classList.toggle('zlo',lo);
  /* подписи построек держат экранный размер около 11 px при любом масштабе */
  st.style.setProperty('--lz',Math.max(0.45,Math.min(1.6,11/(12*px))).toFixed(3));
  if(window.DRLIVE)DRLIVE.wake()}   /* при «меньше движения» живые драконы перерисовываются только так */
/* выбранная постройка не прячется под панелью: если её не видно, остров сдвигается, масштаб тот же */
function camShow(id){const r=camBox(),x=stateOf(S.drgUid||meId());if(!r||!x)return;const b=x.st.bld.find(z=>z.id===id);if(!b||E.isleOf(b)!==curIsle(x.st))return;
  const c=cam(),M=svgMap(r),F=freeRect(r),p=I.P(b.x+1,b.y+1),sx=c.x+c.z*M.x(p[0]),sy=c.y+c.z*M.y(p[1]-30);
  if(sx<F.x0+30||sx>F.x1-30||sy<F.y0+30||sy>F.y1-30){c.x+=(F.x0+F.x1)/2-sx;c.y+=(F.y0+F.y1)/2-sy;c.auto=false;camApply()}}
function camZoom(px,py,f){const r=camBox();if(!r)return;const c=cam(),nz=Math.max(ZMIN,Math.min(ZMAX,c.z*f)),k=nz/c.z;c.x=px-(px-c.x)*k;c.y=py-(py-c.y)*k;c.z=nz;c.auto=false;camApply()}
const ptrs=new Map();let moved=0,lastDrag=0,pinch=null;
const onHud=t=>t.closest&&t.closest('.drg-hud,.drg-dock,.drg-svw,.drg-zm,.drg-place,.drg-pan');
window.addEventListener('pointerdown',e=>{const m=e.target.closest&&e.target.closest('.drg-map.full');if(!m||onHud(e.target))return;
  ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(ptrs.size===1)moved=0;if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])}}});
window.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const r=camBox();if(!r){ptrs.clear();return}
  const dx=e.clientX-p[0],dy=e.clientY-p[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===1){moved+=Math.abs(dx)+Math.abs(dy);if(moved>6){const c=cam();c.x+=dx;c.y+=dy;c.auto=false;camApply()}}
  else if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=99;
    camZoom((a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top,d/pinch.d);pinch.d=d}});
const ptrUp=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(moved>6)lastDrag=Date.now()};
window.addEventListener('pointerup',ptrUp);window.addEventListener('pointercancel',ptrUp);
/* после перетаскивания отпускание кнопки не считается нажатием на здание */
window.addEventListener('click',e=>{if(Date.now()-lastDrag<350&&e.target.closest&&e.target.closest('.drg-map.full')&&!onHud(e.target)){e.stopPropagation();e.preventDefault()}},true);
window.addEventListener('wheel',e=>{const m=e.target.closest&&e.target.closest('.drg-map.full');if(!m||onHud(e.target))return;e.preventDefault();
  const r=camBox();
  /* 4.2: щипок на трекпаде и колесо с ⌘/Ctrl — масштаб; обычная прокрутка двумя пальцами или колесом двигает остров */
  if(e.ctrlKey||e.metaKey){camZoom(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*(e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaY)<50?0.012:0.0018)));return}
  const k=e.deltaMode===1?18:1,c=cam();c.x-=e.deltaX*k;c.y-=e.deltaY*k;c.auto=false;camApply()},{passive:false});
/* клавиатура на острове (4.2): масштаб (и ⌘/Ctrl +/−, чтобы не увеличивалась вся страница), стрелки, буквы разделов */
document.addEventListener('keydown',e=>{
  if(!(S.drgFull&&S.view==='island')||document.querySelector('dialog[open],.dri,.drf'))return;
  const t=e.target,typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);if(typing)return;
  const r=camBox();if(!r)return;const k=e.key,mod=e.metaKey||e.ctrlKey;
  const zoom=f=>{e.preventDefault();camZoom(r.width/2,r.height/2,f)};
  if(k==='+'||k==='='||e.code==='NumpadAdd')return zoom(1.25);
  if(k==='-'||k==='_'||e.code==='NumpadSubtract')return zoom(1/1.25);
  if(k==='0'&&!e.altKey){e.preventDefault();camFit(r);camApply();return}
  if(mod||e.altKey)return;
  const pan={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[k];
  if(pan&&!(t&&t.closest&&t.closest('#main>.drg-pan'))){e.preventDefault();const c=cam();c.x+=pan[0]*80;c.y+=pan[1]*80;c.auto=false;camApply();return}
  if(t&&t.closest&&t.closest('#main>.drg-pan')&&k!=='?')return;
  const own=(S.drgUid||meId())===meId(),x=stateOf(S.drgUid||meId());
  const go=v=>{e.preventDefault();S.drgPanel=S.drgPanel===v?null:v;S.drgSel=null;S.drgPlace=null;render()};
  const m={b:own&&'shop',d:'dragons',e:'breed',m:own?'more':null,l:'lvl','?':'keys'}[k.toLowerCase()]||({и:own&&'shop',в:'dragons',у:'breed',ь:own?'more':null,д:'lvl'})[k.toLowerCase()];
  if(m)return go(m);
  if((k==='p'||k==='P'||k==='з'||k==='З')&&own&&x&&x.st.dragons.length){e.preventDefault();fight(null);return}
  if((k==='i'||k==='I'||k==='ш'||k==='Ш')&&x&&x.st.isl2){e.preventDefault();S.drgIsle=curIsle(x.st)?0:1;S.drgSel=null;S.drgPanel=null;S.drgPlace=null;S.drgCam=null;render()}
});
window.addEventListener('resize',()=>camApply());
/* ---------- «Назад» браузера и перезагрузка ----------
   Каждый шаг вглубь игры (страница острова → весь экран → панель или здание → бой или осмотр) — своя запись истории.
   «Назад» закрывает верхний шаг. Закрытие кнопкой откатывает свои записи, чтобы «Назад» не открывал закрытое снова.
   После перезагрузки страница возвращается на остров с той же панелью; бой и осмотр не восстанавливаются. */
function navNow(){const fo=!!document.querySelector('.drf');
  if(S.view!=='island')return fo?{drg:1,v:S.view,ov:'fight'}:null;const io=!!document.querySelector('.dri:not(.out)');
  return {drg:1,uid:S.drgUid||null,full:!!S.drgFull,panel:S.drgPanel||null,sel:S.drgSel||null,ov:fo?'fight':io?'insp':null}}
const navDepth=n=>!n?0:n.v?1:1+(n.full?1:0)+(n.panel||n.sel?1:0)+(n.ov?1:0);
const navKey=n=>n?[n.v,n.uid,n.full,n.panel,n.sel,n.ov].join('|'):'';
const navURL=n=>location.pathname+location.search+(n?'#drg':'');
/* ds — глубины всех записей истории, которые положила игра, по порядку. Шаг вглубь может быть сразу на два уровня
   (с «Карточек» прямо на весь экран), поэтому назад откатываем по числу своих записей, а не по разнице глубин:
   иначе history.go ушёл бы за начало страницы, на предыдущий сайт */
const navDs=()=>{const h=history.state;return h&&h.drg&&Array.isArray(h.ds)?h.ds.slice(0,20):h&&h.drg?[h.d||navDepth(h)]:[]};
const navPut=(n,push)=>{const cur=navDs(),ds=n?(push?cur:cur.slice(0,-1)).concat(navDepth(n)):[],st=n?Object.assign({d:navDepth(n),ds},n):null;
  try{push?history.pushState(st,'',navURL(n)):history.replaceState(st,'',navURL(n))}catch(e){}};
let navSkip=false,navBoot=history.state&&history.state.drg?history.state:null,navT0=Date.now();
function navSync(){try{navSync0()}catch(e){}}   /* до объявления S в странице наблюдатель уже работает */
function navSync0(){
  if(navBoot){const b=navBoot,ok=S.mode&&S.mode!=='loading'&&stateOf(b.uid||meId());
    /* после перезагрузки бой не восстанавливается: страница, с которой его открыли, без записи истории */
    if(ok&&b.v){navBoot=null;S.view=b.v;navPut(null,false);render();return}
    if(ok){navBoot=null;S.view='island';S.drgUid=b.uid;S.drgFull=b.full;S.drgPanel=b.panel;S.drgSel=b.sel;S.drgCam=null;navPut(navNow()||Object.assign({},b,{ov:null}),false);render()}
    else if(Date.now()-navT0>8000){navBoot=null;navPut(null,false)}
    return}
  if(navSkip)return;
  const n=navNow(),h=history.state&&history.state.drg?history.state:null;if(navKey(n)===navKey(h))return;
  const dn=navDepth(n),dh=navDepth(h);
  if(dn>dh)navPut(n,true);
  else if(dn<dh&&h){const ds=navDs();let k=0;while(k<ds.length&&ds[ds.length-1-k]>dn)k++;
    if(k>0){navSkip=true;history.go(-k)}else navPut(n,false)}
  else navPut(n,false)}
window.addEventListener('popstate',e=>{const h=e.state&&e.state.drg?e.state:null;
  if(navSkip){navSkip=false;const n=navNow();if(navKey(n)!==navKey(h))navPut(n,false);return}
  if(navBoot)return;
  if((!h||h.ov!=='fight')&&window.DRFIGHT&&document.querySelector('.drf'))DRFIGHT.close();
  if((!h||h.ov!=='insp')&&window.DRGINSP&&document.querySelector('.dri'))DRGINSP.close();
  if(!h){if(S.view==='island'){S.view='cards';S.drgFull=false;S.drgPanel=null;S.drgSel=null;S.drgPlace=null}}
  else if(h.v){S.view=h.v}
  else{S.view='island';S.drgUid=h.uid;if(S.drgFull!==h.full)S.drgCam=null;S.drgFull=h.full;S.drgPanel=h.panel;S.drgSel=h.sel;S.drgPlace=null}
  render()});
/* Enter и пробел на постройке, участке или препятствии карты нажимают её, как мышь */
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target;
  if(t&&t.closest&&t.closest('svg.drg-isl')&&t.matches('[data-act][tabindex]')){e.preventDefault();t.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
/* кто открыл панель: после закрытия фокус возвращается туда, при открытии уходит в заголовок панели */
let navRet=null,navPan='';
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-act]');if(!b||!b.closest('.drg-map.full,#main>.drg-pan'))return;
  if(b.closest('.drg-pan'))return;const a=b.dataset.act;if(a==='drgpanel'||a==='drgsel')navRet={act:a,v:b.dataset.v||'',id:b.dataset.id||''}},true);
function navFocus(){const k=(S.view==='island'&&S.drgFull?(S.drgPanel||'')+'|'+(S.drgSel||''):'');if(k===navPan)return;const was=navPan;navPan=k;
  if(k&&k!=='|'){const h=document.querySelector('#main>.drg-pan h2');if(h){h.tabIndex=-1;if(!h.contains(document.activeElement))h.focus({preventScroll:true})}}
  else if(was&&was!=='|'&&navRet){const r=navRet;navRet=null;const q=r.id?`[data-act="${r.act}"][data-id="${r.id}"]`:`[data-act="${r.act}"][data-v="${r.v}"]`;const el=document.querySelector('.drg-map.full '+q);if(el)el.focus({preventScroll:true})}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.drgFull&&S.view==='island'&&!document.querySelector('dialog[open]')&&!document.querySelector('.dri,.drf')){if(S.drgPanel||S.drgSel){S.drgPanel=null;S.drgSel=null}else S.drgFull=false;render()}});
/* общие часы анимаций и классы body: на весь экран прокрутка страницы выключена, уведомления наверху */
new MutationObserver(()=>{
  document.querySelectorAll('svg.drg-isl:not([data-clk])').forEach(el=>{el.dataset.clk='1';el.style.setProperty('--clk',(-performance.now()/1000).toFixed(2)+'s')});
  const fs=!!document.querySelector('.drg-map.full'),b=document.body;if(!b)return;
  if(b.classList.contains('drg-fs')!==fs)b.classList.toggle('drg-fs',fs);
  const iv=!!document.querySelector('.drg-map');if(b.classList.contains('drg-islv')!==iv)b.classList.toggle('drg-islv',iv);
  if(fs){camApply();navFocus();if(S.drgSel&&S.drgSel!==camShow.last){camShow.last=S.drgSel;camShow(S.drgSel)}else if(!S.drgSel)camShow.last=null}
  navSync();
  /* живой остров: драконы из рисунка A поверх острова (live.js), состояние берётся то же, что у рисунка острова */
  if(window.DRLIVE)DRLIVE.scan(()=>{const x=stateOf(S.drgUid||meId());return x&&viewSt(x.st)})}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- осмотр дракона (inspect.js): данные для сцены и кормление оттуда ---------- */
function inspInfo(uid,id){
  const x=stateOf(uid);if(!x)return null;const st=x.st,own=uid===meId(),L=E.level(st);
  const d=st.dragons.find(z=>z.id===id);if(!d)return null;
  const all=st.dragons.concat(st.gone||[]);
  const node=i=>{const z=all.find(q=>q.id===i);return z?{id:z.id,name:z.name,genome:z.genome,lvl:z.lvl||null,alive:st.dragons.includes(z),parents:z.parents||null}:{id:i,unknown:true}};
  const cost=E.feedPrice(st,d).cost,cap=E.maxDragonLv(L),food=Math.floor(st.bal.food),home=st.bld.find(b=>b.id===d.home);
  const why=d.lvl>=cap?'Следующий уровень откроется с ростом острова':food<cost?`Не хватает корма: есть ${fmt(food)} 🌾, нужно ${cost}`:'';
  return {id:d.id,name:d.name,genome:d.genome,lvl:d.lvl,fed:d.fed||0,feeds:E.FEEDS,own,gen:d.gen||1,from:d.from||null,
    home:home?E.TYPES[home.type].name:null,gold:goldTxt(st,d),
    feed:own?{cost,can:!why,why,max:d.lvl>=cap}:null,
    parents:d.parents?d.parents.map(i=>{const n=node(i);n.parents=n.parents?n.parents.map(node):null;return n}):null}}
function inspect(el){
  if(S.drgPlace||!window.DRGINSP)return;
  const uid=S.drgUid||meId(),info=inspInfo(uid,el.dataset.dragon);if(!info)return;
  DRGINSP.open(info,{info:id=>inspInfo(uid,id),
    /* 4.3: стрелки осмотра листают драконов острова по порядку */
    list:()=>{const x=stateOf(uid);return x?x.st.dragons.map(d=>d.id):[]},
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
      const p=DRCAMP.record(DRCAMP.progress(d),id,stars,today()),n=DRCAMP.byId(id);
      /* награда (4.1): золото, корм и самоцветы считает экономика по звёздам до боя из документа; запись одна вместе со звёздами */
      let st2=x.st,gain=null;if(n){const r=E.apply(x.st,x.c,{t:'pvewin',node:{id,rec:n.rec,boss:!!n.boss,mini:!!n.mini,elite:!!n.elite},stars});if(!r.err){st2=r.s;gain=r.s.got&&r.s.got.pve||null}}
      return {p,gain,saved:save(uid,Object.assign({},st2,{mode:d.mode,periods:d.periods,pve:p}))}},
    /* подарок похода (носитель E2): есть ли у узла, получен ли, можно ли забрать сейчас */
    gift:node=>{const g=E.GIFTS[node],x=stateOf(uid);if(!g||!x)return null;const got=!!(x.st.gifts||{})[node];
      return {name:g.name,got,can:!got&&!!DRCAMP.progress(docOf(uid)).best[node]&&canAct(uid)}},
    claim:node=>{const r=act({t:'claim',node});if(!r)return null;const g=E.GIFTS[node];
      toast(r.s.got&&r.s.got.nursery?`🎁 ${g.name} в яслях: для него нужен дом (${r.s.got.nursery})`:`🎁 ${g.name} поселился на острове`);return r},
    saveState:()=>{const st=storeOf(uid);return st?st.status:'ok'},
    retry:()=>{const st=storeOf(uid);return st?st.retry():Promise.resolve('ok')},
    /* «Турнир бактерий» из шапки похода: страница «Бои» платформы */
    openArena:()=>{S.drgFull=false;S.drgPanel=null;S.drgSel=null;S.drgPlace=null;S.view='arena';window.scrollTo(0,0);render()},
    onClose:()=>render()}}
function fight(dragon){if(S.drgPlace||!window.DRFIGHT||!stateOf(meId()))return;DRFIGHT.open(fightApi(),{dragon})}

/* постройка на другом острове: перейти туда, чтобы её было видно */
function onIsleOf(id){const x=stateOf(S.drgUid||meId());const b=x&&id&&x.st.bld.find(z=>z.id===id);if(!b)return;const i=E.isleOf(b);if(i!==curIsle(x.st)){S.drgIsle=i;S.drgCam=null}}
/* ---------- действия ---------- */
const num=v=>v==null||v===''?undefined:Number(v);
/* стабильность (4.1): ошибка в коде драконов не роняет платформу. Рисунок острова показывает понятное сообщение,
   остальные кусочки (шапка карточек, бои) просто пропадают, нажатие на кнопку острова пишет в тост; прогресс не трогается */
let errShown=0;
const guard=(fn,fb)=>function(){try{return fn.apply(this,arguments)}catch(e){console.error('драконы:',e);return typeof fb==='function'?fb(e):fb}};
const islandFail=()=>`<button class="back" data-act="go" data-v="cards">← К карточкам</button><div class="empty">Остров не нарисовался из-за ошибки на странице. Прогресс не потерян: он хранится в облаке. <a class="btn sm" href="">Обновить страницу</a></div>`;
const actGuard=fn=>function(){const err=e=>{console.error('драконы:',e);if(Date.now()-errShown>3000){errShown=Date.now();toast('Не получилось из-за ошибки на странице. Попробуйте ещё раз или обновите страницу')}};
  try{const r=fn.apply(this,arguments);if(r&&typeof r.catch==='function')return r.catch(err);return r}catch(e){err(e)}};
window.DRGUI={on:guard(on,false),hero:guard(hero,''),switchHTML:guard(switchHTML,''),reviewBadge:guard(reviewBadge,''),dayDoneHTML:guard(dayDoneHTML,''),onSnap:guard(onSnap,undefined),
  islandView:guard(islandView,islandFail),stateOf,founders,setMode,saveHTML,storeOf,classesOf,battleHub:guard(battleHub,'')};
window.DRG_ACTIONS={
  drgmode:async el=>{const v=el.dataset.v;await setMode(v);toast(v==='dragons'?'Включены драконы. Чашка Петри никуда не делась, вернуться можно в любой момент.':'Включены бактерии. Драконы ждут на острове.')},
  drgopen:el=>{S.drgUid=el.dataset.uid||meId();S.view='island';S.drgSel=null;S.drgPanel=null;S.drgPlace=null;window.scrollTo(0,0);
    S.drgScroll=null;S.drgFull=!!el.dataset.full;S.drgCam=null},
  drgfull:el=>{S.drgFull=el.dataset.v==='1';S.drgCam=null;S.drgPanel=null;S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0)},
  drgzoom:el=>{const r=camBox();if(!r)return;const v=el.dataset.v;
    if(v==='fit'&&el.closest('.drg-pan')){S.drgPanel=null;setTimeout(()=>{const q=camBox();if(q){camFit(q);camApply()}},0);return}
    if(v==='fit'){camFit(r);camApply()}else camZoom(r.width/2,r.height/2,v==='in'?1.35:1/1.35)},
  drgobs:async el=>{const x=stateOf(meId());if(!x)return;const o=E.obstacles(x.st).find(z=>z.id===el.dataset.c);if(!o)return;const k=E.OBST_KIND[o.kind];
    if(!await askConfirm(`${k.name}: расчистить за ${k.gold} золота? Освободится место для построек${k.gems?', а под валуном найдётся самоцвет':''}.`,'Расчистить'))return;
    const r=act({t:'clear',cell:o.id});if(r)toast(k.gems?`Расчищено! +${k.gems} 💎`:'Расчищено')},
  drgsel:el=>{if(S.drgPlace)return;S.drgSel=el.dataset.id||null;S.drgPanel=null;onIsleOf(S.drgSel)},
  /* переход между островами: камера подгоняется заново */
  drgisle:el=>{S.drgIsle=el.dataset.v==='1'?1:0;S.drgSel=null;S.drgPanel=null;S.drgPlace=null;S.drgCam=null},
  drgisle2:()=>{const r=act({t:'isle2'});if(!r)return;S.drgIsle=1;S.drgPanel=null;S.drgCam=null;S.drgSel=null;toast(`🌋 ${E.ISLE2.name} открыт! Стройте на нём, когда на первом станет тесно`)},
  drginsp:inspect,
  drgfight:el=>fight(el.dataset.dragon||null),
  arjump:()=>{const t=document.getElementById('ar-tour');if(t)t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})},
  drgsave:el=>{const st=storeOf(meId());if(!st)return;const v=el.dataset.v;
    if(v==='retry')st.retry().then(s=>{if(s==='ok')toast('Сохранено')});
    else if(v==='discard'){st.discard();toast('Вернулась последняя сохранённая версия острова')}
    else if(v==='remote'){st.takeRemote();toast('Взята версия с сервера')}
    else if(v==='restore')st.restore()},
  drgpanel:el=>{S.drgPanel=el.dataset.v||null;S.drgSel=null;S.drgPlace=null},
  /* из ожидания на острове прямо к повторению: время острова идёт только в карточках */
  drgcards:()=>{S.drgFull=false;S.drgPanel=null;S.drgSel=null;S.drgPlace=null;S.view='cards';window.scrollTo(0,0)},
  drgbuild:el=>{S.drgPlace={type:el.dataset.type};S.drgPanel=null;S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0)},
  drgmove:el=>{onIsleOf(el.dataset.id);S.drgPlace={move:el.dataset.id};S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0)},
  drgcancel:()=>{S.drgPlace=null},
  /* то же, что нажать на клетку, но клетку выбирает игра: ближайшая к середине открытой земли. Путь для клавиатуры */
  drgauto:()=>{const p=S.drgPlace,x=stateOf(meId());if(!p||!x)return;const st=viewSt(x.st),C=E.CHUNK,cells=[];
    (st.land||[]).forEach(id=>{const [cx,cy]=id.split(',').map(Number);for(let i=0;i<C;i++)for(let j=0;j<C;j++)cells.push([cx*C+i,cy*C+j])});
    const m=cells.reduce((a,c)=>[a[0]+c[0]/cells.length,a[1]+c[1]/cells.length],[0,0]);
    const ok=cells.filter(([i,j])=>E.canPlace(st,i,j,p.move||null)).sort((a,b)=>Math.hypot(a[0]-m[0],a[1]-m[1])-Math.hypot(b[0]-m[0],b[1]-m[1]));
    if(!ok.length){toast(x.st.isl2||E.level(x.st)<E.ISLE2.L?'Свободного места нет: откройте участок или стройте на другом острове':`Свободного места нет: откройте участок или ${E.ISLE2.name} (кнопка 🌋)`);return}
    window.DRG_ACTIONS.drgtile({dataset:{x:ok[0][0],y:ok[0][1]}})},
  drgtile:el=>{const p=S.drgPlace;if(!p)return;const x=+el.dataset.x,y=+el.dataset.y;
    const xs=stateOf(meId()),r=p.move?act({t:'move',id:p.move,x,y}):act({t:'build',type:p.type,x,y,isl:xs?curIsle(xs.st):0});
    if(r){S.drgPlace=null;if(!p.move){S.drgSel=r.s.last;toast(`Стройка началась: ${E.TYPES[p.type].name}`)}}},
  drgland:async el=>{const c=el.dataset.c,cost=E.LAND_COST[c];if(!cost)return;
    if(!await askConfirm(`Расчистить участок за ${cost.gold?fmt(cost.gold)+' золота':cost.gems+' самоцветов'}?`,'Расчистить'))return;const xs=stateOf(meId());if(act({t:'expand',chunk:c,isl:xs?curIsle(xs.st):0}))toast('Участок расчищен')},
  drgdo:el=>{const d=el.dataset,a={t:d.t,id:d.id,dragon:d.dragon,home:d.home,crop:d.crop,type:d.type,plot:num(d.plot),what:d.what,goal:d.goal,node:d.node};
    const r=act(a);if(!r)return;
    if(r.s.got&&r.s.got.gold)toast(`+${fmt(r.s.got.gold)} золота`);
    else if(r.s.got&&r.s.got.food)toast(`+${fmt(r.s.got.food)} корма`);
    else if(r.s.lvup){const x=r.s.dragons.find(z=>z.id===r.s.lvup);toast(`${x.name} вырос до ${x.lvl}-го уровня!`)}
    else if(d.t==='buy'){const x=r.s.dragons.find(z=>z.id===r.s.last);toast(`На острове новый дракон: ${x.name}`)}
    else if(d.t==='egg')toast('Яйцо в Инкубаторе')
    else if(r.s.got&&r.s.got.gems&&d.t==='research')toast(`Цель выполнена: +${r.s.got.gems} 💎`)
    else if(r.s.got&&r.s.got.dead)toast('Яйцо не развилось. Посмотри в журнале, у каких родителей так бывает')
    else if(r.s.got&&r.s.got.baby){const x=r.s.dragons.find(z=>z.id===r.s.got.baby);S.drgPanel='baby';S.drgBaby=x.id;S.drgSel=null}},
  drgbreed:el=>{const fv=S.fv||{},t=fv.drgPt,pp=parseFloat(String(fv.drgPp||'').replace(',','.'));
    const pred=t&&!isNaN(pp)?{trait:t,value:fv.drgPc||(document.getElementById('drgPc')||{}).value,p:pp/100}:null;
    const r=act({t:'breed',id:el.dataset.id,mother:el.dataset.m,father:el.dataset.f,pred});if(!r)return;
    S.fv.drgPp='';const g=r.s.got&&r.s.got.pred;toast(g?(g.ok?'Прогноз верный! Яйцо будет вдвое быстрее, +1 💎':`Прогноз мимо: на самом деле ${Math.round(g.truth*1000)/10} %`):'Пара в Гнездовье. Яйцо будет через '+cardsAcc(E.BREED_NEED))},
  drgrelease:async el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    /* единственная самка или самец, особенно взрослые: без них скрещивание встанет */
    const sx=d.genome.sex,same=x.st.dragons.filter(z=>z.genome.sex===sx),adult=same.filter(z=>z.lvl>=E.BREED_LV);
    const warn=same.length===1?` Это ${sx==='F'?'единственная самка':'единственный самец'} на острове: без ${sx==='F'?'неё':'него'} скрещивать будет нельзя, пока не купите ${sx==='F'?'самку':'самца'} на рынке.`:
      d.lvl>=E.BREED_LV&&adult.length===1?` Это ${sx==='F'?'единственная взрослая самка':'единственный взрослый самец'} (${E.BREED_LV}-й уровень и выше): других придётся сначала вырастить.`:'';
    if(!await askConfirm(`Отпустить дракона ${d.name}? Он улетит с острова насовсем, вернуть его нельзя.${warn} В журнале и родословной он останется, а его генотип сохранится в архиве острова, чтобы теория в журнале считалась по настоящим родителям. На прощание ${fmt(50*(1+G.rarity(phOf(d))))} золота.`,'Отпустить'))return;
    const r=act({t:'release',dragon:d.id});if(r)toast(`${d.name} улетел. +${fmt(r.s.got.gold)} золота на прощание`)},
  drgrename:el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    const n=prompt('Имя дракона',d.name);if(n!=null&&n.trim())act({t:'rename',dragon:d.id,name:n})}
};
Object.keys(window.DRG_ACTIONS).forEach(k=>{window.DRG_ACTIONS[k]=actGuard(window.DRG_ACTIONS[k])});
})();
