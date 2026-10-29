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
  inc.wallTime=true;inc.dayCards=info.todayN;
  inc.streakBest=info.best;inc.cur=info.cur;
  /* бонус за ДЗ: список из страницы (hwBonus в index.html), здесь только сумма */
  const hw=typeof window.hwBonus==='function'?window.hwBonus(uid):[],sum=k=>hw.reduce((x,b)=>x+(b[k]||0),0);
  inc.hw={gems:sum('gems'),food:sum('food'),gold:sum('gold'),xp:sum('xp'),list:hw};info.hw=hw;
  /* 4.4: неделя для заданий недели — карточки по дням серии и ДЗ на 85 %+ с понедельника */
  const wk=E.weekOf(today());inc.week={cards:Object.entries(st.days||{}).reduce((x,[d,n])=>d>=wk&&d<=today()?x+(+n||0):x,0),hw85:hw.filter(b=>b.d>=wk&&b.pc>=85).length};
  return {K:inc.K,inc,streak:info.cur,info,uid,today:today(),wallTime:true}}
/* состояние на сейчас: старые документы этапа 1 (без v) превращаются в остров с теми же драконами */
function stateOf(uid){
  if(String(uid||'').startsWith('v:'))return visitState(uid.slice(2));
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
  if(uid===meId())showcaseSoon();
  const st=storeOf(uid);
  if(!st){S.drag=S.drag||{};S.drag[uid]=doc;return S.db.doc(`srs/${uid}/meta/dragons`).set(doc).catch(e=>{fail(e)})}
  return st.apply(()=>doc)?st.settled():Promise.resolve(st.status)}
/* ---------- витрина острова для рейтинга и визитов (4.4) ----------
   Ученица пишет краткую копию своего острова в arena/<uid>/isle/show: писать туда может только она сама, читать — все ученицы
   (правила arena/{self} и arena в ph_rules). Баланса и генома нет только там, где они не нужны для показа: кошелёк не публикуется.
   Пишется через минуту после последнего сохранения острова, не чаще раза в 5 минут, и при уходе со страницы */
let showT=0,showLast=0,showPend=false;
function showcaseSoon(){showPend=true;clearTimeout(showT);showT=setTimeout(showcase,Math.max(60000,300000-(Date.now()-showLast)))}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&showPend&&Date.now()-showLast>60000)showcase()});
function showcase(){const uid=meId(),x=stateOf(uid);if(!x||!S.db)return;const st=x.st,p=window.DRCAMP?DRCAMP.progress(docOf(uid)):null;showLast=Date.now();showPend=false;clearTimeout(showT);
  const bld=st.bld.map(b=>Object.assign({id:b.id,type:b.type,x:b.x,y:b.y,lvl:b.lvl},b.isl?{isl:1}:{}));
  const dr=st.dragons.map(d=>({id:d.id,name:d.name,genome:d.genome,lvl:d.lvl,home:d.home||null}));
  const rar=Math.max(0,...st.dragons.map(d=>G.gameRarity(phOf(d))));
  const doc={v:1,name:(S.people.find(q=>q.id===uid)||{}).label||S.myLabel||'',lvl:E.level(st),xp:Math.floor(st.bal.xp),stars:p?DRCAMP.total(p):0,dragons:st.dragons.length,rar,
    isl2:!!st.isl2,at:now(),snap:{land:st.land,isl2:st.isl2?{land:st.isl2.land}:null,bld,dragons:dr}};
  if(JSON.stringify(doc).length>350000)doc.snap.dragons=dr.slice(0,40);
  S.db.doc(`arena/${uid}/isle/show`).set(doc).catch(e=>console.warn('витрина острова не записалась',e))}
/* остров в гостях: из витрины собирается обычный документ v2 и проходит ту же проверку сохранения */
function visitState(u){const v=S.drgVisits&&S.drgVisits[u];if(!v||!v.snap)return null;const sn=v.snap;
  const def=b=>{const t=E.TYPES[b.type];if(!t)return null;const o=Object.assign({},b,{build:null,up:null});if(t.kind==='hab')o.chest={amt:0,k0:null};if(t.kind==='farm')o.plots=[null,null];if(t.kind==='nest')o.pair=null;if(t.kind==='hatch')o.slots=[null];return o};
  const d={v:2,ev:1,evK:0,lay:1,bal:{gold:0,food:0,gems:0,xp:v.xp||0},credited:{food:0,gems:0,lvl:v.lvl||1},land:sn.land||[],bld:(sn.bld||[]).map(def).filter(Boolean),dragons:sn.dragons||[]};
  if(sn.isl2)d.isl2={land:sn.isl2.land};
  const r=E.repair(d,null);if(r.bad.length)return null;
  return {st:E.normalize(r.s,0,null),c:{K:0,inc:{hw:{list:[]},week:{}},info:{hw:[],todayN:0,done:false,cur:0,best:0},streak:0,uid:'v:'+u,today:today()}}}
const visitName=uid=>String(uid).startsWith('v:')?((S.drgVisits||{})[uid.slice(2)]||{}).name||'ученица':name(uid);
/* рейтинг: витрины всех учениц класса, раз в минуту заново */
function topLoad(force){if(!S.db)return;if(!force&&S.drgTop&&Date.now()-S.drgTop.at<60000)return;const ids=[...new Set(S.people.map(p=>p.id).concat(meId()))];
  S.drgTop=Object.assign(S.drgTop||{rows:[]},{at:Date.now(),busy:true});
  Promise.all(ids.map(id=>S.db.doc(`arena/${id}/isle/show`).get().then(x=>x.exists?Object.assign({uid:id},x.data()):null).catch(()=>null)))
    .then(rs=>{S.drgTop={at:Date.now(),busy:false,rows:rs.filter(Boolean)};render()})}
function topHTML(st){topLoad(false);const T0=S.drgTop||{rows:[],busy:true},me=meId();
  const rows=T0.rows.slice().sort((a,b)=>b.lvl-a.lvl||b.xp-a.xp||b.stars-a.stars);
  const R=['обычный','необычный','редкий','очень редкий','легендарный'];
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>🏆 Рейтинг островов</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
    <p class="muted small">Сравнение без боёв: уровень острова, звёзды похода, драконы. Можно зайти в гости и посмотреть чужой остров, менять там ничего нельзя.</p>
    ${T0.busy&&!rows.length?'<p class="muted">Загружаю…</p>':''}${!T0.busy&&!rows.length?'<p class="muted">Пока никто не открыл остров. Рейтинг появится, когда ученицы зайдут на свои острова.</p>':''}
    <ol class="top">${rows.map((r,i)=>`<li class="${r.uid===me?'me':''}"><span class="top-n">${i<3?['🥇','🥈','🥉'][i]:i+1}</span><span class="top-t"><b>${esc(r.name||'Ученица')}${r.uid===me?' (вы)':''}</b>
      <small>⭐ ${r.lvl}-й уровень · ★ ${r.stars} звёзд · 🐉 ${r.dragons}${r.isl2?' · 🌋':''}${r.rar?' · лучший: '+R[Math.min(4,r.rar)]:''}</small></span>
      ${r.uid===me?'':`<button class="btn ghost sm" data-act="drgvisit" data-v="${esc(r.uid)}">В гости</button>`}</li>`).join('')}</ol></section>`}
function onSnap(uid,srv){
  S.drag=S.drag||{};const st=storeOf(uid);
  if(st){st.snap(srv||null);S.drag[uid]=st.tip;
    const matches=(S.people||[]).filter(p=>p.label==='Георгий');
    if(st.status==='ok'&&!st.pending()&&uid===meId()&&st.tip&&st.tip.v===2&&st.tip.clockV!==1){const x=stateOf(uid);if(x)save(uid,x.st);return}
    if(st.status==='ok'&&!st.pending()&&matches.length===1&&matches[0].id===uid&&uid===meId()){
      const grant=E.legacyPveGrant(st.tip);
      if(grant)save(uid,grant).then(status=>{if(status==='ok')toast('Начислены пропущенные призы за первые 3 боя: 420 золота, 56 корма и 2 самоцвета',7000)});
    }
    return}
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
const phOf=d=>Object.assign(G.gamePhenotype(d.genome),{academyRank:Math.max(0,Math.min(3,d.academyRank||0))});
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

/* что ждёт ученицу в «Ещё» (4.4): нерешённые головоломки дня, награды недели и подарки за ДЗ, которые можно забрать */
function todoInfo(st,c){if(!c||!c.today)return {pz:0,wq:0,gift:0};const pzd=st.pz&&st.pz.d===c.today?st.pz.done.length:0;
  const wq=E.wqList(st,c.today).filter(id=>{const p=E.wqProgress(st,c,id);return p.done&&!p.got}).length;
  const gift=((c.info&&c.info.hw)||[]).filter(b=>b.egg&&!(st.hwgift||[]).includes(b.id)).length;
  return {pz:window.DRPZ?Math.max(0,DRPZ.KINDS.length-pzd):0,wq,gift}}
const todoN=(st,c)=>{const t=todoInfo(st,c);return t.pz+t.wq+t.gift};
/* ---------- задания недели и подарок за ДЗ (4.4) ---------- */
const rwd=r=>[r.gold?`${fmt(r.gold)} 🪙`:'',r.gems?`${r.gems} 💎`:'',r.food?`${fmt(r.food)} 🌾`:''].filter(Boolean).join(' · ');
function dailyHTML(st,c){return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Ежедневные миссии</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div><p>Новые задания каждый день. Награда выдаётся один раз.</p>${Object.entries(E.DQ).map(([id,q])=>{const p=E.dailyProgress(st,c,id);return `<div class="drg-plot"><b>${esc(q.t)}</b><span>${p.v} / ${p.goal}</span><span>${q.r.gold||0} 🪙 · ${q.r.food||0} 🌾</span><button class="btn sm" data-act="drgdo" data-t="daily" data-id="${id}"${p.done&&!p.got?'':' disabled'}>${p.got?'Получено':'Забрать'}</button></div>`}).join('')}<button class="btn" data-act="drgcards">Повторять карточки</button></section>`}
function academyHTML(st,c){return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Академия драконов</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div><p>Каждый ранг обучения: +20 % к базовым здоровью, атаке и защите и +1 к скорости. Максимум 3 ранга (+60 % и +3). Внешность получает сияние обучения. Стихии и генотип не меняются.</p><p>Обучение занимает 2, 4 или 6 часов. Каждая повторённая карточка сокращает ожидание на час.</p>${st.dragons.map(d=>{const rank=d.academyRank||0,next=rank+1;return `<div class="drg-plot"><b>${esc(d.name)} · ранг ${rank}/${E.ACADEMY_MAX}</b>${powerHTML(d)}${d.training?`<span>Обучение: ${E.timeShort(d.training,c.K)} · или ${E.cardsLeft(d.training,c.K)} карточек</span><button class="btn sm" data-act="drgcards">Ускорить карточками</button>`:rank<E.ACADEMY_MAX?`<span>Следующий ранг: +20 % к трём параметрам и +1 скорость</span><button class="btn sm" data-act="drgdo" data-t="academy" data-dragon="${d.id}"${st.bal.gold<E.academyCost(next)?' disabled':''}>Обучать за ${fmt(E.academyCost(next))} 🪙 · ${2*next} ч</button>`:'<span>Обучение завершено</span>'}</div>`}).join('')}</section>`}
function weekHTML(st,c){const L=E.wqList(st,c.today),mon=E.weekOf(c.today);
  const rows=L.map(id=>{const q=E.WQ[id],p=E.wqProgress(st,c,id),pc=Math.round(p.v/p.goal*100);
    return `<div class="wq${p.got?' got':p.done?' done':''}"><div class="wq-h"><b>${esc(q.t)}</b><small>${rwd(q.r)}</small></div>
      <div class="drg-xp"><i style="width:${pc}%"></i></div><div class="wq-f"><span class="muted small">${p.v} из ${p.goal}</span>
      ${p.got?'<span class="wq-ok">✓ награда получена</span>':p.done?`<button class="btn sm" data-act="drgdo" data-t="wq" data-id="${id}">Забрать награду</button>`:''}</div></div>`}).join('');
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>📜 Задания недели</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
    <p class="muted small">Неделя с ${fmtDay(mon)}. Каждый понедельник новые задания, награду за выполненное нужно забрать до конца недели.</p>${rows}${hwGiftHTML(st,c)}</section>`}
/* подарок за ДЗ на 95 %+: список заданий с яйцом, ещё не забранных */
function hwGiftHTML(st,c){const got=st.hwgift||[],l=(c.info.hw||[]).filter(b=>b.egg&&!got.includes(b.id));if(!l.length)return '';
  return `<div class="hwg"><b>🎁 Подарок за ДЗ на 95 % и выше</b>${l.map(b=>`<div class="drg-sr"><span>${esc(b.title)} · ${b.pc}%</span><button class="btn sm" data-act="drgdo" data-t="hwgift" data-id="${esc(b.id)}">Забрать редкого дракона</button></div>`).join('')}</div>`}
const fmtDay=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}catch(e){return d}};

/* ---------- головоломки дня (puzzles.js) ----------
   5.0: вкладки от лёгкой к сложной, правила по пунктам с примером и подсказкой, крупные клетки, подсветка строки, столбца
   и нарушений правил, заметки карандашом, отмена хода, ввод с клавиатуры (цифры, стрелки, N — заметки, ⌘/Ctrl+Z — отмена).
   Ответы и заметки хранятся в S.pzA / S.pzM и в браузере (pz:<uid>:<день>:<вид>), чтобы перерисовка и перезагрузка их не стирали.
   Проверка — действие puzzle в экономике: тот же генератор, сверка с единственным решением */
const pzKey=(c,k)=>'pz:'+c.uid+':'+c.today+':'+k;
const pzOf=(c,k)=>DRPZ.make(k,DRPZ.seedOf(c.uid,c.today));
const pzShape=(p,a)=>Array.isArray(a)&&a.length===p.N&&a.every(r=>Array.isArray(r)&&r.length===p.N);
const pzHas=(p,v)=>p.kind==='bin'?v!=null:!!v;
function pzAns(c,p){S.pzA=S.pzA||{};const k=p.kind;if(S.pzA[k]&&S.pzA[k].d===c.today&&pzShape(p,S.pzA[k].a))return S.pzA[k].a;
  let a=null;try{a=JSON.parse(localStorage.getItem(pzKey(c,k))||'null')}catch(e){}
  if(!pzShape(p,a))a=p.kind==='bin'?p.given.map(r=>r.map(v=>v==null?null:v)):[...Array(p.N)].map(()=>Array(p.N).fill(0));
  if(p.kind==='bin')p.given.forEach((r,i)=>r.forEach((v,j)=>{if(v!=null)a[i][j]=v}));   /* открытые клетки всегда из задачи */
  S.pzA[k]={d:c.today,a};return a}
function pzNotes(c,p){S.pzM=S.pzM||{};const k=p.kind;if(S.pzM[k]&&S.pzM[k].d===c.today&&pzShape(p,S.pzM[k].m))return S.pzM[k].m;
  let m=null;try{m=JSON.parse(localStorage.getItem(pzKey(c,k)+':n')||'null')}catch(e){}
  if(!pzShape(p,m))m=[...Array(p.N)].map(()=>Array(p.N).fill(0));S.pzM[k]={d:c.today,m};return m}
function pzSave(c,k,a,m){try{localStorage.setItem(pzKey(c,k),JSON.stringify(a));if(m)localStorage.setItem(pzKey(c,k)+':n',JSON.stringify(m))}catch(e){}}
/* снимок до хода — для «Отменить» */
function pzPush(k,a,m){S.pzU=S.pzU||{};const u=S.pzU[k]=S.pzU[k]||[];u.push(JSON.stringify({a,m}));if(u.length>80)u.shift()}
function pzGrid(p,a,m,done){const N=p.N,sel=S.pzSel&&S.pzSel.k===p.kind?S.pzSel:null,bad=new Set(DRPZ.conflicts(p,a).map(([i,j])=>i*N+j));
  const cell=(i,j)=>{const g=p.kind==='bin'&&p.given[i][j]!=null,v=a[i][j],has=pzHas(p,v),on=sel&&sel.i===i&&sel.j===j,line=sel&&!on&&(sel.i===i||sel.j===j),err=bad.has(i*N+j);
    const notes=!has&&p.kind!=='bin'&&m[i][j]?`<span class="pzm" aria-hidden="true">${[1,2,3,4,5].map(n=>`<i>${m[i][j]&(1<<n)?n:''}</i>`).join('')}</span>`:'';
    const cls=['pzc',g?'given':'',p.kind==='bin'&&has?'v'+v:'',on?'sel':'',line?'line':'',err?'bad':''].filter(Boolean).join(' ');
    const lab=`Строка ${i+1}, столбец ${j+1}: ${has?(p.kind==='sky'?'высота '+v:String(v)):'пусто'}${g?', дано в задаче':''}${err?', нарушает правило':''}`;
    return `<button class="${cls}" data-act="drgpz" data-k="${p.kind}" data-i="${i}" data-j="${j}"${done||g?' disabled':''} aria-label="${lab}">${has?(p.kind==='bin'?`<b class="pzb">${v}</b>`:`<b>${v}</b>`):notes}</button>`};
  if(p.kind==='bin')return `<div class="pzg bin" style="--n:${N}">${a.map((r,i)=>r.map((_,j)=>cell(i,j)).join('')).join('')}</div>`;
  if(p.kind==='sky'){const C=p.clues,st=(clue,line)=>!clue||!line.every(Boolean)?'':DRPZ.seen(line)===clue?' ok':' no';
    const cl=(v,line,dir)=>`<span class="pzk${st(v,line)}" title="${v?`Отсюда видно ${v} ${v===1?'дом':v<5?'дома':'домов'}`:''}">${v||''}</span>`;
    const col=j=>a.map(r=>r[j]);
    return `<div class="pzg sky" style="--n:${N+2}"><span></span>${C.top.map((v,j)=>cl(v,col(j))).join('')}<span></span>${a.map((r,i)=>cl(C.left[i],r)+r.map((_,j)=>cell(i,j)).join('')+cl(C.right[i],r.slice().reverse())).join('')}<span></span>${C.bottom.map((v,j)=>cl(v,col(j).reverse())).join('')}<span></span></div>`}
  const at=[...Array(N)].map(()=>Array(N).fill(-1));p.cages.forEach((cg,k)=>cg.cells.forEach(([i,j])=>at[i][j]=k));
  const lab=k=>{const cg=p.cages[k],tl=cg.cells.slice().sort((x,y)=>x[0]-y[0]||x[1]-y[1])[0];return {tl,t:cg.op==='='?String(cg.v):cg.v+(cg.op)}};
  return `<div class="pzg ken" style="--n:${N}">${a.map((r,i)=>r.map((v,j)=>{const k=at[i][j],L=lab(k),b=[i===0||at[i-1][j]!==k?'bt':'',j===N-1||at[i][j+1]!==k?'br':'',i===N-1||at[i+1][j]!==k?'bb':'',j===0||at[i][j-1]!==k?'bl':''].join(' ');
    return `<div class="pzw ${b}">${L.tl[0]===i&&L.tl[1]===j?`<small class="pzt">${esc(L.t)}</small>`:''}${cell(i,j)}</div>`}).join('')).join('')}</div>`}
function pzHTML(st,c){if(!window.DRPZ)return `<section class="sheet drg-pan"><p>Головоломки не загрузились. Обновите страницу.</p></section>`;
  const done=st.pz&&st.pz.d===c.today?st.pz.done:[],ps=DRPZ.daily(c.uid,c.today).filter(Boolean),K=DRPZ.KINDS;
  if(!S.pzTab||!ps.some(p=>p.kind===S.pzTab))S.pzTab=(ps.find(p=>!done.includes(p.kind))||ps[0]||{}).kind;
  const tabs=`<div class="pztabs" role="tablist" aria-label="Головоломки от лёгкой к сложной">${ps.map(p=>{const k=K.find(x=>x.kind===p.kind),on=p.kind===S.pzTab,ok=done.includes(p.kind);
    return `<button role="tab" class="pztab${on?' on':''}${ok?' ok':''}" data-act="drgpztab" data-k="${p.kind}" aria-selected="${on}" aria-label="${k.lvl}. ${k.name}: ${esc(k.title)}, ${ok?'решено':'награда '+k.reward+' золота'}"><small>${k.lvl}. ${k.name}</small><b>${esc(k.title.split(' ')[0])}</b><span>${ok?'✓ решено':`<em aria-hidden="true">${'★'.repeat(k.lvl)}${'☆'.repeat(3-k.lvl)}</em> +${k.reward} 🪙`}</span></button>`}).join('')}</div>`;
  const p=ps.find(x=>x.kind===S.pzTab);if(!p)return `<section class="sheet drg-pan"><p>Головоломки на сегодня не построились. Обновите страницу.</p></section>`;
  const k=K.find(x=>x.kind===p.kind),a=pzAns(c,p),m=pzNotes(c,p),ok=done.includes(p.kind),N=p.N;
  const filled=a.flat().filter(v=>pzHas(p,v)).length,bad=DRPZ.conflicts(p,a).length,nx=ps.find(x=>!done.includes(x.kind)&&x.kind!==p.kind);
  /* правила открыты, пока ученица не начала эту задачу; потом свёрнуты, но открываются одним нажатием */
  const fresh=!ok&&filled===(p.kind==='bin'?p.given.flat().filter(v=>v!=null).length:0);
  const rules=`<details class="pzr" data-k="pzr-${p.kind}"${fresh?' open':''}><summary>Правила и с чего начать</summary><ol>${k.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ol><p><b>Как вводить.</b> ${esc(k.how)}</p><p class="pztip">💡 <b>С чего начать.</b> ${esc(k.tip)}</p></details>`;
  const note=!!S.pzNote&&p.kind!=='bin',digits=p.kind==='bin'?[0,1]:[1,2,3,4,5];
  const pad=ok?'':`<div class="pzpad${note?' note':''}" role="group" aria-label="${p.kind==='bin'?'Цифры':note?'Заметки':'Числа'}">${digits.map(n=>`<button class="pzn" data-act="drgpzn" data-k="${p.kind}" data-n="${n}" aria-label="${note?'Заметка ':''}${n}">${n}</button>`).join('')}<button class="pzn" data-act="drgpzn" data-k="${p.kind}" data-n="x" aria-label="Стереть клетку">⌫</button></div>`;
  const stat=ok?`<p class="pzdone">✓ Решено! Награда получена.${nx?` <button class="btn sm" data-act="drgpztab" data-k="${nx.kind}">Следующая: ${esc(K.find(x=>x.kind===nx.kind).name.toLowerCase())} →</button>`:' На сегодня всё, завтра новые.'}</p>`
    :`<p class="pzstat"><span>Заполнено ${filled} из ${N*N}</span>${bad?`<span class="pzerr">Нарушено правило: клетки подсвечены красным</span>`:''}</p>`;
  const tools=ok?'':`<div class="pztools"><button class="btn sm" data-act="drgpzc" data-k="${p.kind}">Проверить</button>${p.kind==='bin'?'':`<button class="btn ghost sm pznote${note?' on':''}" data-act="drgpznote" data-k="${p.kind}" aria-pressed="${note}" title="Клавиша N">✎ Заметки${note?': вкл.':''}</button>`}<button class="btn ghost sm" data-act="drgpzu" data-k="${p.kind}"${(S.pzU&&S.pzU[p.kind]||[]).length?'':' disabled'} title="⌘/Ctrl + Z">↶ Отменить ход</button><button class="btn ghost sm" data-act="drgpzr" data-k="${p.kind}">Очистить</button></div>`;
  return `<section class="sheet drg-pan drg-pzp"><div class="drg-pan-h"><h2>🧩 Головоломки дня</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
    <p class="muted small">Три задачи на логику, от лёгкой к сложной. У каждой ровно одно решение, угадывать не нужно: всё выводится рассуждением. Решено сегодня: ${done.length} из ${ps.length}, завтра новые.</p>
    ${tabs}<section class="pzbox${ok?' ok':''}" id="pz-${p.kind}"><div class="pzh"><h3>${esc(k.title)}</h3><span>${ok?'✓ решено':`+${k.reward} 🪙`}</span></div>
    <p class="pzgoal"><b>Цель.</b> ${esc(k.goal)}</p>${pzGrid(p,a,m,ok)}${stat}${pad}${tools}${rules}<p class="muted small pzkeys">Клавиатура: ${p.kind==='bin'?'0 и 1, пробел меняет цифру':'цифры 1–5, N — заметки'}, стрелки — выбор клетки, Delete — стереть, ⌘/Ctrl+Z — отменить.</p></section></section>`}
/* ввод в выбранную клетку: n — цифра, 'x' — стереть, '~' — следующая цифра Бинарио (нажатие на клетку, пробел) */
function pzInput(k,n){const sel=S.pzSel;if(!sel||sel.k!==k)return 'Сначала выберите клетку';const c=ctxOf(meId()),p=pzOf(c,k),a=pzAns(c,p),m=pzNotes(c,p),i=sel.i,j=sel.j;
  if(p.kind==='bin'&&p.given[i][j]!=null)return 'Эта клетка дана в задаче';
  const note=!!S.pzNote&&p.kind!=='bin'&&n!=='x'&&n!=='~';
  pzPush(k,a,m);
  if(p.kind==='bin')a[i][j]=n==='x'?null:n==='~'?(a[i][j]==null?0:a[i][j]===0?1:null):+n;
  else if(note){if(a[i][j])a[i][j]=0;m[i][j]^=1<<(+n)}
  else if(n==='x'){a[i][j]=0;m[i][j]=0}
  else{const v=+n;a[i][j]=v;m[i][j]=0;
    /* поставленное число убирается из заметок в той же строке и столбце */
    if(a[i][j])for(let t=0;t<p.N;t++){m[i][t]&=~(1<<v);m[t][j]&=~(1<<v)}}
  pzSave(c,k,a,m);return null}
/* клавиши острова (4.2) */
const KEYS=[['B','Строить'],['D','Драконы'],['E','Скрещивание и яйца'],['P','Поход'],['M','Ещё'],['L','Уровень и опыт'],['I','Другой остров'],['G','Перенести выбранную постройку'],['Стрелки, Enter','При переносе и стройке: выбрать ячейку и поставить (A — на свободное место)'],['⌘/Ctrl +  −','Приблизить, отдалить (и просто + −)'],['0','Весь остров'],['Стрелки','Сдвинуть остров'],['Esc','Закрыть окно, потом выйти с острова'],['?','Эта подсказка']];
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
const sigOf=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)+s.length.toString(36)};
const bgKey=st=>E.extent(st).n+(st.isl===1?'l':'g');
const BGC=new Map();
/* рисунок острова строится заново, только если изменились состояние острова или вид (на телефоне это десятки миллисекунд на каждое нажатие) */
const ISLC={k:'',v:''};
function islSvg(st,opt){const k=JSON.stringify([st,opt]);if(k!==ISLC.k){ISLC.v=I.svg(st,opt);ISLC.k=k}return ISLC.v}
/* далёкие драконы в небе: силуэты пролетают за островом, двигается целый слой (без перерисовки) */
const FLY_SIL='<path d="M2 22 C 14 18 24 18 34 20 C 40 10 50 2 62 0 C 56 8 52 14 50 20 C 58 20 66 22 72 26 C 64 26 58 27 52 28 C 46 34 36 36 26 32 C 18 30 10 28 2 22 Z M 50 21 C 60 12 72 8 84 10 C 76 14 70 18 66 23 Z"/>';
const FLYERS=`<div class="drg-fly f1" aria-hidden="true"><svg viewBox="0 0 86 38">${FLY_SIL}</svg></div><div class="drg-fly f2" aria-hidden="true"><svg viewBox="0 0 86 38">${FLY_SIL}</svg></div>`;
function bgHTML(st,kind){const key=kind+bgKey(st);if(!BGC.has(key))BGC.set(key,kind==='far'?I.bg(st):I.bgClouds(st));return BGC.get(key)}
function islandView(){
  const uid=S.drgUid||meId(),own=uid===meId(),x=stateOf(uid),visit=String(uid).startsWith('v:');
  if(own&&x&&!showLast&&!showPend)showcaseSoon();   /* зашла на остров — витрина для рейтинга появится и без действий */
  const back=visit?`<button class="back" data-act="drgvisit" data-v="">← Домой, на свой остров</button>`:`<button class="back" data-act="go" data-v="cards">← К карточкам</button>`;
  if(!x){const bad=brokenOf(uid);if(bad)return back+brokenHTML(bad);
    return back+`<div class="empty">Остров ещё не открыт.</div>`}
  const {st,c}=x,K=c.K,full=!!S.drgFull;
  if(S.drgSel&&!st.bld.some(b=>b.id===S.drgSel))S.drgSel=null;
  const pl=own?S.drgPlace:null;
  const placeBar=pl?`<div class="drg-place"><span>${pl.move?'Нажмите на свободную ячейку «+», куда перенести здание':'Нажмите на свободную ячейку «+», где поставить: '+E.TYPES[pl.type].name}<small class="drg-pkeys">Клавиши: стрелки — выбрать ячейку, Enter — поставить, A — на свободное место, Esc — отмена</small></span><button class="btn sm" data-act="drgauto">${pl.move?'Перенести':'Поставить'} на свободное место</button><button class="btn ghost sm" data-act="drgcancel">Отмена</button></div>`:'';
  const cur=curIsle(st),isl=islSvg(viewSt(st),{K,sel:S.drgSel,place:pl,key:'isl',readonly:!own,full});
  const gl=own&&!pl?goalLine(st,K):null;
  if(full){
    const L=E.level(st),b=E.xpFor(L+1),xp=xpPct(st),bal=st.bal;
    /* ресурсы с подписью; нажатие объясняет, откуда берётся именно этот ресурс */
    const pill=(k,ic,v,t)=>own?`<button class="drg-pill" data-act="drgpanel" data-v="res:${k}" aria-label="${t}: ${fmt(v)}. Как получить"><i aria-hidden="true">${ic}</i><span><b>${fmt(v)}</b><small>${t.toLowerCase()}</small></span><em aria-hidden="true">+</em></button>`
      :`<span class="drg-pill" title="${t}"><i aria-hidden="true">${ic}</i><span><b>${fmt(v)}</b><small>${t.toLowerCase()}</small></span></span>`;
    const P=S.drgPanel||'',rb=(act,v,ic,t,o)=>{o=o||{};const on=act==='drgpanel'&&P===v||o.on;
      return `<button class="drg-rb${o.big?' big':''}" data-act="${act}" data-v="${v}"${o.lab?` aria-label="${o.lab}${o.n?`, ждут: ${o.n}`:''}${o.k?' (клавиша '+o.k+')':''}"`:''}${o.k?` title="Клавиша ${o.k}" aria-keyshortcuts="${o.k}"`:''}${on?' aria-current="true"':''}><i aria-hidden="true">${ic}</i><span>${t}</span>${o.n?`<b class="drg-bdg" aria-hidden="true">${o.n}</b>`:''}${o.k?`<kbd class="drg-kb" aria-hidden="true">${o.k}</kbd>`:''}</button>`};
    const dock=own?rb('drgcards','','📚','<b class="lg">Повторять карточки</b><b class="sm">Карточки</b>',{lab:'Повторять карточки'})+rb('drgpanel','dragons','📖','Драконы',{lab:'Драконы',k:'D'})
        +rb('drgpanel','breed','🥚','<b class="lg">Скрещивание</b><b class="sm">Яйца</b>',{lab:'Скрещивание и яйца',k:'E'})
        +(st.dragons.length?rb('drgfight','','⚔️','Поход',{lab:'Поход: бои драконов',k:'P'}):'')+rb('drgpanel','shop','🔨','Строить',{big:1,lab:'Строить',k:'B'})+rb('drgpanel','market','🐉','Купить',{lab:'Купить дракона'})+rb('drgpanel','more','☰','Ещё',{lab:'Ещё: головоломки, задания недели, рейтинг, рынок, журнал',k:'M',n:todoN(st,c)})
      :visit?rb('drgvisit','','🏠','Домой',{lab:'Домой, на свой остров'})+rb('drgpanel','dragons','📖','Драконы')+rb('drgpanel','blds','🏘','Постройки')+rb('drgpanel','top','🏆','Рейтинг')
      :rb('drgfull','0','🏠','Назад')+rb('drgpanel','dragons','📖','Драконы')+rb('drgpanel','journal','📓','Журнал')+rb('drgpanel','blds','🏘','Постройки');
    /* 5.0: мир (фон и остров) — отдельный узел с подписью data-sig: если рисунок не изменился, страница оставляет старый узел,
       и браузер не растрирует остров заново при каждом открытии панели или нажатии кнопки. Кнопки и панели лежат слоем выше */
    const wcls=`drg-world${pl?' placing':''}${cur?' lava':''}`,wsig=sigOf(wcls+'|'+bgKey(st)+'|'+isl);
    return `<div class="${wcls}" data-sig="${wsig}"><div class="drg-bgs" aria-hidden="true"><div class="drg-bgl">${bgHTML(st,'far')}</div><div class="drg-bgl drift">${bgHTML(st,'clouds')}</div>${FLYERS}</div><div class="drg-stage">${isl}</div></div>
      <div class="drg-map full${pl?' placing':''}${cur?' lava':''}">
      <div class="drg-hud"><button class="drg-hud-l" data-act="drgpanel" data-v="lvl" aria-label="Уровень острова ${L}, опыт ${xp} %: подробнее (клавиша L)" title="${L>=E.ISLE_MAX?'Высший уровень острова':`Опыт ${fmt(bal.xp)} из ${fmt(b)}`}. Нажмите, чтобы узнать подробнее"><span class="drg-star" aria-hidden="true"><b>${L}</b></span><span class="drg-xpbar" aria-hidden="true"><i style="width:${xp}%"></i></span></button>
      <div class="drg-hud-r">${visit?`<span class="drg-pill drg-guest">🏠 В гостях у ${esc(visitName(uid))}</span>`:pill('gold','🪙',bal.gold,'Золото')+pill('gems','💎',bal.gems,'Самоцветы')+pill('food','🌾',bal.food,'Корм')}</div></div>
      ${own?`<div class="drg-svw">${saveHTML(uid)}${volHTML(st,c.info,true)}${slot7HTML(st,true)}${gl&&!S.drgPanel&&!S.drgSel?`<button class="drg-goal" data-act="drgpanel" data-v="breed"><small>Цель: первый потомок · шаг ${gl.step} из ${gl.of}</small><b>${gl.text}</b></button>`:''}</div>`:''}
      ${placeBar}
      <div class="drg-dock" role="group" aria-label="Действия на острове">${dock}</div>
      <div class="drg-zm"><button class="drg-kh" data-act="drgpanel" data-v="keys" aria-label="Клавиши (?)" title="Клавиши">⌨</button><button data-act="drgzoom" data-v="in" aria-label="Приблизить">+</button><button data-act="drgzoom" data-v="out" aria-label="Отдалить">−</button><button data-act="drgzoom" data-v="fit" aria-label="Весь остров" title="Весь остров">⤢</button><button data-act="drgpanel" data-v="blds" aria-label="Мои постройки" title="Мои постройки">▤</button></div>
      ${pl?'':isleBtn(st,own)}
      </div>`+panel(st,c,own)}
  const head=`${back}${own?saveHTML(uid,true)+slot7HTML(st):''}<div class="drg-ih"><div class="drg-ih-t"><h1>Остров драконов${own?'':': '+esc(visitName(uid))}</h1><span class="muted small">Время на острове идёт в карточках: повторено ${cards(K)}</span>${own?volHTML(st,c.info,true):''}</div>${lvlHTML(st)}${visit?'':walletHTML(st)}</div>`;
  const tools=own&&!pl?`<div class="drg-tools"><button class="btn sm" data-act="drgcards">📚 Повторять карточки</button><button class="btn sm" data-act="drgfull" data-v="1">🏝 Отправиться на остров</button><button class="btn ghost sm" data-act="drgpanel" data-v="shop">🔨 Построить</button><button class="btn ghost sm" data-act="drgpanel" data-v="market">🐉 Рынок</button><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">📖 Драконы</button><button class="btn ghost sm" data-act="drgpanel" data-v="breed">🥚 Скрещивание</button>${st.dragons.length?'<button class="btn ghost sm" data-act="drgfight">⚔️ Поход</button>':''}<button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button><button class="btn ghost sm" data-act="drgpanel" data-v="help">Как это работает</button></div>`:'';
  const map=`<div class="drg-map${pl?' placing':''}${cur?' lava':''}">${placeBar}${pl?'':isleBtn(st,own)}${isl}<button class="drg-fsb" data-act="drgfull" data-v="1" aria-label="Открыть остров на весь экран">⛶</button></div>`;
  const goal=gl?`<button class="drg-goal in" data-act="drgpanel" data-v="breed"><small>Цель: первый потомок · шаг ${gl.step} из ${gl.of}</small><b>${gl.text}</b></button>`:'';
  return head+goal+tools+map+panel(st,c,own);
}

/* панель только что открыта (другая панель или постройка): класс pin даёт анимацию появления на первые 300 мс */
let panKey='',panT=0;
function panel(st,c,own){const h=panel0(st,c,own),key=(S.drgPanel||'')+'|'+(S.drgSel||'');
  if(key!==panKey){panKey=key;panT=Date.now()}
  return Date.now()-panT<300?h.replace(/class="sheet drg-pan/,'class="sheet drg-pan pin'):h}
function panel0(st,c,own){
  const K=c.K,L=E.level(st),p=S.drgPanel;
  if(own&&p==='shop')return shopHTML(st,L);
  if(own&&p==='market')return marketHTML(st,L);
  if(p==='compare')return compareHTML(st);
  if(p==='dragons'||p==='ranking')return dragonsHTML(st,own,L,p==='ranking');
  if(p==='help')return helpHTML(st,c);
  if(p==='breed')return breedHTML(st,c,own);
  if(p==='more')return moreHTML(st,own,c);
  if(p==='blds')return bldsHTML(st,c,own);
  if(own&&p==='isle2')return isle2HTML(st);
  if(p==='lvl')return lvlInfoHTML(st,c);
  if(own&&p==='pz')return pzHTML(st,c);
  if(own&&p==='academy')return academyHTML(st,c);
  if(own&&p==='daily')return dailyHTML(st,c);
  if(own&&p==='week')return weekHTML(st,c);
  if(p==='top')return topHTML(st);
  if(p==='keys')return keysHTML();
  if(own&&p&&p.startsWith('res:'))return resHTML(st,c,p.slice(4));
  if(p==='journal')return journalHTML(st);
  if(p==='research')return researchHTML(st,own);
  if(p==='orig'){const d=st.dragons.find(x=>x.id===S.drgOrig);if(d)return `<section class="sheet drg-pan drg-baby"><div class="drg-pan-h"><h2>🧬 Как получился ${esc(d.name)}</h2><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">← Драконы</button></div>${originHTML(st,d,true)}</section>`}
  if(p==='baby'){const d=st.dragons.find(x=>x.id===S.drgBaby);if(d)return `<section class="sheet drg-pan drg-baby"><div class="drg-pan-h"><h2>🐣 Вылупился ${esc(d.name)}!</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>${own?saveHTML(meId()):''}${d.nurs&&!d.home?`<p class="drg-why">Подходящего свободного дома пока нет (нужен дом: ${E.habNames(phOf(d))}), поэтому ${esc(d.name)} пока в яслях Инкубатора. Как только появится дом со свободным местом, малыш переселится в него сам.</p>${own?homeHint(st,d):''}`:''}<div class="drg-list">${dragonCard(st,d,own,L)}</div>${originHTML(st,d,false)}<div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgpanel" data-v="journal">📓 Журнал скрещиваний</button><button class="btn ghost sm" data-act="drgpanel" data-v="breed">🥚 Скрещивание</button></div></section>`}
  const b=st.bld.find(x=>x.id===S.drgSel);
  if(!b)return S.drgFull?'':`<p class="muted small drg-tip">${own?'Нажмите на здание, чтобы собрать золото, покормить драконов или посадить корм.':'Это остров ученицы, здесь можно только смотреть.'}</p>`;
  const T=E.TYPES[b.type],job=b.build||b.up;
  let h=`<section class="sheet drg-pan drg-home"><div class="drg-pan-h"><h2>${T.name}${b.build?'':` · ${b.lvl}-й уровень`}</h2><button class="btn ghost sm" data-act="drgsel" data-id="">Закрыть</button></div>`;
  if(job){const lf=E.cardsLeft(job,K);
    h+=`<p><b>${E.timeShort(job,K)}</b> · ${b.build?'Строится':'Улучшается до '+job.to+'-го уровня'}: осталось ${cardsAcc(lf)}.${b.up&&T.kind==='hab'?' Драконы при этом продолжают приносить золото.':''}</p>${own?`<div class="actions" style="justify-content:flex-start"><button class="btn sm" data-act="drgdo" data-t="speed" data-id="${b.id}">Ускорить за ${Math.ceil(E.left(job,K)/E.SKIP_CARDS)} 💎</button></div>`:''}`}
  if(T.kind==='hab'&&!b.build){
    const a=E.chestNow(st,b,K),cap=E.chestCap(b),ds=st.dragons.filter(d=>d.home===b.id),r=ds.reduce((n,d)=>n+E.goldNow(st,d,todayN()),0);
    h+=`<div class="drg-chest"><span>🪙 В сундуке <b>${fmt(a)}</b> из ${fmt(cap)}</span><span class="drg-bar"><i style="width:${Math.min(100,a/cap*100)}%"></i></span><span class="muted small">${r?`+${goldFmt(r)} за следующую карточку · сумма от ${ds.length} ${plural(ds.length,'дракона','драконов','драконов')}`:'Пока здесь нет драконов'}${a>=cap?', сундук полон: соберите, иначе золото пропадает':''}</span>${own?`<button class="btn sm" data-act="drgdo" data-t="collect" data-id="${b.id}"${a>=1?'':' disabled'}>Собрать</button>`:''}</div>`;
    h+=`<p class="muted small drg-home-info">Среда: ${T.hosts.map(k=>HOSTS[k]).join(' и ')}. Мест ${ds.length} из ${E.habCap(b)}.</p>`;
    h+=`<h3>Жители · ${ds.length} из ${E.habCap(b)}</h3><div class="drg-list drg-residents">${ds.map(d=>residentCard(st,d,own,L)).join('')||'<p class="muted small">Здесь пока никто не живёт.</p>'}</div>`}
  if(T.kind==='farm'&&!b.build){
    h+=`<div class="drg-plots">${b.plots.map((pl,i)=>{
      if(!pl)return `<div class="drg-plot"><b>Грядка ${i+1}</b><span class="muted small">Пусто</span>${own?`<div class="drg-crops">${Object.entries(E.CROPS).map(([k,cr])=>`<button class="btn ghost sm" data-act="drgdo" data-t="plant" data-id="${b.id}" data-plot="${i}" data-crop="${k}"${L<cr.unlock?' disabled title="Откроется на '+cr.unlock+'-м уровне острова"':''}>${cr.name}<small>${cr.cost} 🪙 · ${cr.need/10} ч → ${Math.round(cr.food*E.streakMult(c.streak))} 🌾</small></button>`).join('')}</div>`:''}</div>`;
      const cr=E.CROPS[pl.crop],rd=E.ready(pl,K),lf=E.cardsLeft(pl,K);
      return `<div class="drg-plot${rd?' ready':''}"><b>Грядка ${i+1}: ${cr.name}</b><span>${E.timeShort(pl,K)}</span><span class="drg-bar"><i style="width:${pl.need?Math.min(100,(pl.need-E.left(pl,K))/pl.need*100):100}%"></i></span><span class="muted small">${rd?`Созрело: ${Math.round(cr.food*E.streakMult(c.streak))} корма${c.streak?` (серия +${Math.round((E.streakMult(c.streak)-1)*100)} %)`:''}`:`Осталось ${cardsAcc(lf)}`}</span>${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="harvest" data-id="${b.id}" data-plot="${i}">Собрать урожай</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(E.left(pl,K)/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}</div>`}
  if(T.kind==='nest'&&!b.build)h+=nestHTML(st,b,c,own);
  if(T.kind==='hatch'&&!b.build)h+=hatchHTML(st,b,c,own);
  if(own){const nx=(E.lvTable(b.type)||[])[b.lvl+1];
    const upWhy=!nx?'':nx.L&&L<nx.L?`${b.lvl+1}-й уровень с ${nx.L}-го уровня острова`:b.type==='hatch'&&b.lvl===1&&!st.slot7?`Сначала второе место за серию ${E.SLOT7} дней подряд`:'';
    h+=`<details class="drg-home-manage"><summary>Улучшение и перемещение</summary><div class="actions" style="justify-content:flex-start">${nx&&!job?`<button class="btn ghost sm" data-act="drgdo" data-t="upgrade" data-id="${b.id}"${upWhy?' disabled':''}>Улучшить до ${b.lvl+1}-го: ${fmt(nx.cost)} 🪙, ${nx.need/10} ч${T.kind==='hab'?` (мест ${nx.cap}, сундук ${fmt(nx.chest)})`:T.kind==='farm'?` (грядок ${nx.plots})`:` (мест для яиц ${nx.slots}${b.id===E.firstHatch(st)?' + место за серию':''})`}</button>${upWhy?`<span class="drg-why">${upWhy}</span>`:''}`:''}<button class="btn ghost sm" data-act="drgmove" data-id="${b.id}" title="Клавиша G" aria-keyshortcuts="G">Переместить</button></div></details>`}
  if(own&&T.kind==='farm'&&(st.farmReserve||[]).length)h+=`<div class="drg-plot"><b>Сохранённые посевы объединённых ферм: ${st.farmReserve.length}</b><button class="btn sm" data-act="drgdo" data-t="reserve">Собрать готовые</button></div>`;
  return h+`</section>`}

/* золото дракона за следующую карточку: удвоение и ступень лесенки сегодняшнего дня (одна десятая) */
const todayN=()=>{const st=S.streak[S.drgUid||meId()];return st?streakInfo(st).todayN:0};
const goldFmt=v=>String(Math.round(v*10)/10).replace('.',',');
const goldTxt=(st,d)=>goldFmt(E.goldNow(st,d,todayN()));
/* на каком уровне острова предел драконов станет больше cap */
const capAt=cap=>{for(let k=1;k<=E.ISLE_MAX;k++)if(E.maxDragonLv(k)>cap)return k;return null};
const combatCache=new Map();let powerLoading=null;
function combatStats(d){
  if(!window.DSTATS||!window.MORPH||!window.SHAPE||!window.ANIM){if(!powerLoading&&window.DRGINSP)powerLoading=window.DRGINSP.loadAll().then(()=>render()).catch(()=>{});return null}
  const key=JSON.stringify([d.genome,d.lvl,d.academyRank||0]);let val=combatCache.get(key);
  if(val==null){const ph=phOf(d),m=window.MORPH.morph(ph,d.lvl),g=window.SHAPE.build(m);val=window.DSTATS.of(ph,d.lvl,window.ANIM.profile(m,g.rig));if(combatCache.size>96)combatCache.clear();combatCache.set(key,val)}
  return val}
function powerValue(d){const s=combatStats(d);return s?window.DSTATS.power(s):null}
function powerHTML(d){const val=powerValue(d);if(val==null)return '';
  return `<span class="drg-power" title="${esc(window.DSTATS.POWER_NOTE)}">◆ Абсолютная сила: ${val}${d.academyRank?` · академия ${d.academyRank}`:''}</span>`}
function dragonsHTML(st,own,L,ranking){
  const level=(S.fv||{}).drgCompareLevel||'',pool=st.dragons.filter(d=>!level||String(d.lvl)===level);
  const rows=pool.map(d=>({d,power:powerValue(d)})),ready=rows.every(r=>r.power!=null);
  rows.sort((a,b)=>(b.power||0)-(a.power||0)||String(a.d.id).localeCompare(String(b.d.id)));
  const best=ready&&rows[0],tabs=`<nav class="drg-store-tabs" aria-label="Драконы"><button class="btn ${ranking?'ghost':''}" data-act="drgpanel" data-v="dragons" aria-pressed="${!ranking}">Все драконы</button><button class="btn ${ranking?'':'ghost'}" data-act="drgpanel" data-v="ranking" aria-pressed="${ranking}">🏆 По силе</button><button class="btn ghost" data-act="drgpanel" data-v="compare">Сравнить</button></nav>`;
  return `<section class="sheet drg-pan drg-ranking"><div class="drg-pan-h"><h2>${ranking?'Рейтинг драконов':'Драконы острова'}</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>${tabs}<label>Уровень ${sel('drgCompareLevel',[['','Все уровни'],...[...new Set(st.dragons.map(d=>d.lvl))].sort((a,b)=>a-b).map(l=>[String(l),String(l)])],level)}</label>
    ${best?`<div class="drg-favorite"><span>⭐ Любимчик · ${level?'сильнейший выбранного уровня':'самый сильный'}</span><b>${esc(best.d.name)} · ◆ ${best.power}</b><small>${best.d.lvl}-й уровень${rows[1]&&rows[1].power===best.power?' · несколько драконов делят первое место':''}</small><button class="btn sm" data-act="drginsp" data-dragon="${best.d.id}">Открыть паспорт</button></div>`:''}
    ${ranking?`<p class="muted small">По абсолютной силе на текущем уровне. Для сравнения наследуемых качеств выбирай драконов одного уровня. При равной силе порядок определяется постоянным идентификатором; любимчик — первый из лидеров.</p>${!ready?'<p role="status">Считаю силу…</p>':`<ol class="drg-power-list">${rows.map((r,i)=>`<li data-power="${r.power}" data-dragon="${r.d.id}"><span class="drg-power-place">${i+1}</span><button class="drg-power-open" data-act="drginsp" data-dragon="${r.d.id}"><b>${esc(r.d.name)}${i===0?' ⭐':''}</b><small>${r.d.lvl}-й уровень</small></button><strong>◆ ${r.power}</strong></li>`).join('')}</ol>`}`:`<div class="drg-list">${pool.map(d=>dragonCard(st,d,own,L)).join('')}</div>`}
    ${!rows.length?'<p class="muted">На острове пока нет драконов.</p>':''}</section>`}
function compareHTML(st){
 const fv=S.fv||{},level=fv.drgCompareLevel||'',pool=st.dragons.filter(d=>!level||String(d.lvl)===level),a=pool.find(d=>d.id===fv.drgCompareA)||pool[0],b=pool.find(d=>d.id===fv.drgCompareB&&d!==a)||pool.find(d=>d!==a);
 const opts=pool.map(d=>[d.id,`${d.name} · ${d.lvl}-й ур.`]),header=`<div class="drg-pan-h"><h2>Сравнение драконов</h2><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">← Драконы</button></div><label>Уровень ${sel('drgCompareLevel',[['','Все уровни'],...[...new Set(st.dragons.map(d=>d.lvl))].sort((a,b)=>a-b).map(l=>[String(l),String(l)])],level)}</label>`;
 if(!a||!b)return `<section class="sheet drg-pan">${header}<p>Для сравнения нужны два дракона выбранного уровня.</p></section>`;
 const stats=[a,b].map(combatStats);if(stats.some(x=>!x))return `<section class="sheet drg-pan">${header}<p role="status">Загружаю характеристики…</p></section>`;
 const desc=(d,s)=>{const ph=phOf(d),B=window.DRBATTLE,els=ph.breath==='element'?ph.elements:[],names=xs=>xs.map(e=>B.EL_NAME[e]).join(', ')||'нет';
 const plus=Object.keys(B.EL_NAME).filter(e=>els.some(x=>B.mult(x,[e])>1.001)),minus=Object.keys(B.EL_NAME).filter(e=>B.mult(e,els)>1.001);
 return `<div class="drg-compare-note"><b>${esc(d.name)}</b><p>${esc(s.role.keys.map(k=>window.DSTATS.ROLE[k].text).join('; '))}</p><ul>${['hp','atk','def','spd'].flatMap(k=>s.src[k].filter(([l])=>l.includes('ген')).map(([l,n])=>`<li>${esc(l)}: ${n>0?'+':''}${n} ${window.DSTATS.NAMES[k]} до множителя уровня</li>`)).join('')}</ul><p>Сильные атаки против: ${esc(names(plus))}. Уязвим для: ${esc(names(minus))}.</p></div>`};
 return `<section class="sheet drg-pan drg-compare">${header}<div class="drg-breed"><label>Первый ${sel('drgCompareA',opts,a.id)}</label><label>Второй ${sel('drgCompareB',opts.filter(x=>x[0]!==a.id),b.id)}</label></div>${a.lvl!==b.lvl?'<p class="drg-why">Уровни различаются: рост влияет на характеристики.</p>':''}<table><thead><tr><th>Параметр</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${['power','hp','atk','def','spd'].map(k=>{const v=stats.map(x=>k==='power'?window.DSTATS.power(x):x[k]);return `<tr><th>${k==='power'?'Абсолютная сила':window.DSTATS.NAMES[k]}</th>${v.map((n,i)=>`<td${n>v[1-i]?' class="drg-better"':''}>${n}</td>`).join('')}</tr>`}).join('')}</tbody></table><div class="drg-compare-notes">${desc(a,stats[0])+desc(b,stats[1])}</div><p class="muted small">Множители для гибридного противника зависят от всех его стихий; итог боя зависит от приёмов и команды.</p></section>`}
function predictionReview(m,f,p){
 if(!m||!f||!p||!window.DRLEARN)return '';
 const r=DRLEARN.explain(m.genome,f.genome,p.trait,p.value),pc=x=>String(Math.round(x*10000)/100)+' %',hap=x=>x.h.join(' · ');
 return `<section class="drg-review"><details><summary>${p.ok?'Проверить ход расчёта':'Подсказка после попытки'}</summary><p>Выпиши аллели E, E2 и S у обоих родителей. Стихии складываются, e и 0 ничего не добавляют, s/s подавляет их. Проверь, не пропущен ли скрытый аллель.</p><details><summary>Показать подробный разбор</summary>${predictionGuide(m,f,p.trait)}<p>В каждой клетке — сочетание материнской и отцовской гаметы; вероятность клетки равна произведению их вероятностей. Таблицы относятся к отдельным хромосомам и перемножаются между собой. Обозначения: Cb = cᵇ, R1 = R¹, R2 = R², Wg = Wgˢ. В клетках половых хромосом Z/W означает дочь, Z/Z — сына.</p>${r.groups.map(g=>`<h4>${esc(g.name)} · ${esc(g.loci.join(', '))}</h4><p>Мать: ${g.m.map(x=>esc(hap(x))+' ('+pc(x.p)+')').join('; ')}<br>Отец: ${g.f.map(x=>esc(hap(x))+' ('+pc(x.p)+')').join('; ')}</p>${g.mt?'<p>Потомок получает митохондрии матери.</p>':`<div class="drg-grid-scroll" tabindex="0"><table><thead><tr><th>Мать ↓ / отец →</th>${g.f.map(x=>`<th>${esc(hap(x))}</th>`).join('')}</tr></thead><tbody>${g.m.map(x=>`<tr><th>${esc(hap(x))}</th>${g.f.map(y=>`<td>${esc(hap(x))} / ${esc(hap(y))}<br>${pc(x.p*y.p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}`).join('')}<p>Нежизнеспособных яиц: ${pc(r.dead)}. Жизнеспособных: ${pc(r.alive)}.</p><p>Нужный признак и жизнеспособность вместе: ${pc(r.favorable)}. Искомая доля: ${pc(r.favorable)} ÷ ${pc(r.alive)} = <b>${pc(r.truth)}</b>.</p><p>Твой прогноз: ${pc(p.p)}. Допуск: ${Math.round(E.PRED_TOL*100)} процентных пунктов. Редкие мутации в расчёте не учитываются.</p></details></details></section>`}
function residentCard(st,d,own,L){
  const cost=E.feedPrice(st,d).cost,cap=E.maxDragonLv(L),ph=phOf(d);
  return `<article class="drg-card drg-resident"><button class="drg-pic" data-act="drginsp" data-dragon="${d.id}" aria-label="Осмотреть: ${esc(d.name)}">${W.svg(ph,{stage:W.stageOf(d.lvl),key:'home'+d.id,size:96})}</button><div class="drg-info"><b>${esc(d.name)} ${SEX[d.genome.sex]}</b>${powerHTML(d)}<p>${d.lvl}-й уровень · +${goldTxt(st,d)} 🪙 за карточку</p><p class="muted small">Кормлений: ${d.fed||0} из ${E.FEEDS}</p>
  <div class="drg-da">${own&&d.lvl<cap?`<button class="btn sm" data-act="drgdo" data-t="feed" data-dragon="${d.id}"${st.bal.food<cost?' disabled':''}>Покормить: ${cost} 🌾</button>${st.bal.food<cost?'<span class="drg-why">Не хватает корма</span>':''}`:own?'<span class="muted small">Достигнут предел уровня</span>':''}<button class="btn ghost sm" data-act="drginsp" data-dragon="${d.id}">Паспорт и действия</button></div></div></article>`}
function dragonCard(st,d,own,L){
  const ph=phOf(d),rr=G.gameRarity(ph),fp=E.feedPrice(st,d),cost=fp.cost,cap=E.maxDragonLv(L),home=st.bld.find(b=>b.id===d.home),ms=E.mastery(d.lvl);
  const homes=own?st.bld.filter(b=>b.id!==d.home&&!b.build&&E.hosts(b.type,ph)&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b)):[];
  return `<article class="drg-card ${RCLS[rr]}"><button class="drg-pic" data-act="drginsp" data-dragon="${d.id}" aria-label="Осмотреть: ${esc(d.name)}" title="Осмотреть крупно">${W.svg(ph,{stage:W.stageOf(d.lvl),key:'c'+d.id,size:170,label:esc(d.name)})}</button>
  <div class="drg-info"><div class="drg-nm"><b>${esc(d.name)}</b><span class="drg-sex" title="${d.genome.sex==='F'?'самка ZW':'самец ZZ'}">${SEX[d.genome.sex]}</span><span class="drg-rar" title="Редкость: как трудно вывести такой фенотип">${G.RARITY[rr]}</span>${rankHTML(ph)}</div>
  ${powerHTML(d)}<div class="drg-dl"><span>${d.lvl}-й уровень, ${W.STAGE_NAME[W.stageOf(d.lvl)]}${ms?`, ${E.MASTERY[ms]}`:''}</span><span class="drg-pips" title="Кормлений до следующего уровня">${Array.from({length:E.FEEDS},(_,i)=>`<i${i<(d.fed||0)?' class="on"':''}></i>`).join('')}</span><span class="muted">+${goldTxt(st,d)} 🪙 за карточку</span></div>
  <ul>${W.describe(ph).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <p class="muted small" style="margin:4px 0 0">${home?'Живёт: '+E.TYPES[home.type].name:d.nurs?`В яслях Инкубатора, ждёт дом: ${E.habNames(ph)}`:'Без дома'}${d.parents?` · ${d.gen}-е поколение, родители ${d.parents.map(id=>esc(dname(st,id))).join(' × ')}`:d.from==='market'?' · с рынка':''}</p>
  ${d.parents?`<button class="btn ghost sm drg-origb" data-act="drgorig" data-dragon="${d.id}">🧬 Как получился: гены от родителей</button>`:''}
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
const TRAITS={elements:'Стихии'};
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
function predictionGuide(m,f,tr){
  const loci={elements:['E','E2','S'],color:['C'],hornsMace:['H','K'],crest:['R'],span:['Q1','Q2','Q3'],sex:[],shortWings:['Wg'],metal:['M'],night:['N'],spurs:['Sp'],glow:['G']}[tr]||Object.keys(G.LOCI);
  const insp=window.DRGINSP;
  return `<section class="drg-gen-guide"><h4>Данные для расчёта</h4><p>В этой модели наследуются только гены стихий E, E2 и искры S. Каждый родитель передаёт по одному аллелю каждого из этих генов. Выпиши гаметы родителей, затем соедини их попарно. Вероятности независимых событий перемножаются, альтернативных — складываются.</p>
    <div class="drg-gen-parents">${[m,f].map(d=>`<div><b>${esc(d.name)} ${SEX[d.genome.sex]}</b><pre>${['E','E2','S'].map(l=>l+' = '+esc(window.DRGINSP?DRGINSP.allelesText(d.genome,l):'')).join(' · ')}</pre></div>`).join('')}</div>
    ${insp?`<ul>${loci.filter(l=>insp.RULE[l]).map(l=>`<li><b>${esc(G.LOCI[l].name)}:</b> ${esc(insp.RULE[l])}</li>`).join('')}</ul>`:''}
    <p>В модели E и E2 передаются независимо (частота рекомбинации между ними — 50 %); S находится на другой хромосоме. Стихийные аллели кодоминантны: проявляются вместе; e и 0 не добавляют стихию. s/s подавляет все стихии. Это упрощённая игровая модель наследования, сами стихии вымышлены.</p><ol><li>Выпиши аллели родителей.</li><li>Составь сочетания E, E2 и S.</li><li>Посчитай долю выбранного сочетания проявившихся стихий.</li></ol></section>`}
function quickGenetics(m,f,tr){const loci={color:['C'],elements:['E','E2','S'],hornsMace:['H','K'],crest:['R'],shortWings:['Wg'],span:['Q1','Q2','Q3'],metal:['M'],night:['N'],spurs:['Sp'],glow:['G'],sex:[]}[tr]||[];const insp=window.DRGINSP;
 return `<div class="drg-quick-genes"><p><b>Смотри только на выбранный признак.</b> Предскажи его долю среди вылупившихся детей.</p><div class="drg-gen-parents">${[m,f].map(d=>`<div><b>${esc(d.name)} ${SEX[d.genome.sex]}</b><p>${loci.map(l=>`${l}: ${esc(insp?insp.allelesText(d.genome,l):'открой паспорт')}`).join(' · ')||esc(d.genome.sex==='F'?'ZW':'ZZ')}${tr==='hornsMace'?' · Фаза H–K: '+esc(d.genome.A3.map(h=>h.slice(0,2).join('')).join('/')):''}</p></div>`).join('')}</div>${insp?`<p class="drg-quick-rule">${[...new Set(loci.map(l=>insp.RULE[l]).filter(Boolean))].map(esc).join(' ')||'Мать передаёт Z или W, отец — Z. ZW — самка, ZZ — самец.'}${tr==='hornsMace'?' H и K сцеплены: частота рекомбинации 18 %. Сочетания на двух копиях хромосомы указаны в строке «Фаза H–K».':''}</p>`:''}<p class="muted small">Генотип определяет внешность по правилам игровой модели. В новом режиме все яйца жизнеспособны. Внешность — косметика, она не даёт боевых прибавок. Мутации стихий в прогноз не входят.</p></div>`}
function nestHTML(st,b,c,own){
  const K=c.K;
  if(b.pair){const p=b.pair,m=st.dragons.find(x=>x.id===p.m),f=st.dragons.find(x=>x.id===p.f),rd=E.ready(p,K),lf=E.cardsLeft(p,K);
    const pr=p.pred?`<p class="drg-pred ${p.pred.ok?'ok':'no'}">${p.pred.ok?'✓':'✗'} Прогноз: ${(TRAITS[p.pred.trait]||'Архивный признак').toLowerCase()} «${esc((classesOf(p.pred.trait,m||st.dragons[0],f||st.dragons[0]).find(x=>x[0]===p.pred.value)||[0,p.pred.value])[1])}» у ${Math.round(p.pred.p*100)} % вылупившихся потомков. ${p.pred.ok?`Верно! Скрещивание идёт вдвое быстрее, и пришёл самоцвет.`:`Пока неверно. Открой подсказку и проверь ход расчёта.`}</p>`:'';
    return `${m&&f?famHTML(m,f,'np'):`<div class="drg-pair">${[m,f].map(d=>d?`<span class="drg-chip">${W.svg(phOf(d),{stage:W.stageOf(d.lvl),key:'np'+d.id,size:56})}<small>${esc(d.name)} ${SEX[d.genome.sex]}</small></span>`:'').join('<b>×</b>')}</div>`}${pr}${predictionReview(m,f,p.pred)}
      <p><span class="drg-time">${E.timeShort(p,K)}</span> ${rd?'Яйцо готово. Перенесите его в Инкубатор.':`Яйцо будет готово через ${cardsAcc(lf)}.`}</p>
      ${own?`<div class="actions" style="justify-content:flex-start">${rd?`<button class="btn sm" data-act="drgdo" data-t="egg" data-id="${b.id}">Забрать яйцо в Инкубатор</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}">Ускорить за ${Math.ceil(E.left(p,K)/E.SKIP_CARDS)} 💎</button>`}</div>`:''}`}
  if(!own)return '<p class="muted small">Гнездовье пустует.</p>';
  const ok=d=>d.lvl>=E.BREED_LV,fs=st.dragons.filter(d=>d.genome.sex==='F'),ms=st.dragons.filter(d=>d.genome.sex==='M');
  const fv=S.fv||{},mid=fv.drgM&&fs.some(d=>d.id===fv.drgM)?fv.drgM:(fs.find(ok)||fs[0]||{}).id,fid=fv.drgF&&ms.some(d=>d.id===fv.drgF)?fv.drgF:(ms.find(ok)||ms[0]||{}).id;
  if(!fs.length||!ms.length)return `<p class="muted small">Для скрещивания нужны самка и самец. Купить недостающего можно на рынке.</p>`;
  const m=st.dragons.find(d=>d.id===mid),f=st.dragons.find(d=>d.id===fid),cost=E.breedCost(G.gameRarity(phOf(m)),G.gameRarity(phOf(f)));
  const tr=fv.drgPt===undefined?'elements':TRAITS[fv.drgPt]?fv.drgPt:'',cls=tr?classesOf(tr,m,f):[],cv=cls.some(x=>x[0]===fv.drgPc)?fv.drgPc:(cls[0]||[])[0];
  const low=[m,f].filter(d=>!ok(d));
  return `<div class="drg-breed"><label>Самка ${sel('drgM',fs.map(d=>[d.id,`${d.name} ♀ · ${d.lvl}-й ур.`]),mid)}</label><label>Самец ${sel('drgF',ms.map(d=>[d.id,`${d.name} ♂ · ${d.lvl}-й ур.`]),fid)}</label></div>
  <details class="drg-family"><summary>Родители и варианты внешности потомков</summary>${famHTML(m,f,'bp')}</details>
  <details class="drg-predbox" data-k="drgpred"${tr?' open':''}><summary>Сделать прогноз (по желанию)</summary>
    <div class="drg-breed"><label>Признак ${sel('drgPt',[['','без прогноза'],...Object.entries(TRAITS)],tr)}</label>${tr?`<label>Вариант ${sel('drgPc',cls,cv)}</label><label>Доля, % <input id="drgPp" class="drg-in" type="number" min="0" max="100" step="0.1" inputmode="decimal" value="${esc(fv.drgPp||'')}" placeholder="например 25"></label>`:''}</div>${tr?quickGenetics(m,f,tr):''}<div class="drg-prob-buttons" role="group" aria-label="Быстрый ввод вероятности">${[0,25,33.3,50,66.7,75,100].map(n=>`<button class="btn ghost sm" data-act="drgprob" data-v="${n}" aria-pressed="${+fv.drgPp===n}">${n} %</button>`).join('')}</div><details><summary>Все генотипы и правила — если нужны</summary>${predictionGuide(m,f,tr)}</details><p class="muted small">Выбери долю, затем нажми «Скрестить». Верный прогноз ускоряет скрещивание вдвое и даёт самоцвет. Ошибка не отнимает ресурсы сверх обычной цены скрещивания.</p></details>
  ${low.length?`<p class="muted small">${low.map(d=>`${esc(d.name)} (${d.lvl}-й ур.)`).join(' и ')}: для скрещивания нужен ${E.BREED_LV}-й уровень. Кормят дракона кнопкой «Покормить» в его карточке, корм для этого растёт на ферме.</p><div class="actions" style="justify-content:flex-start"><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">Открыть драконов</button></div>`:''}
  <div class="actions" style="justify-content:flex-start"><button class="btn sm" data-act="drgbreed" data-id="${b.id}" data-m="${mid}" data-f="${fid}"${low.length||st.bal.gold<cost?' disabled':''}>Скрестить: ${fmt(cost)} 🪙, ${E.BREED_NEED/10} ч · карточки ускоряют</button>${!low.length&&st.bal.gold<cost?`<span class="drg-why">Не хватает ${fmt(cost-Math.floor(st.bal.gold))} 🪙. Золото копится в сундуках домов за каждую повторённую карточку.</span>`:''}</div>`}

/* ---------- схема «родители → возможное потомство» (4.3) ----------
   Примеры потомков считает настоящий мейоз (G.breed), но со своими зёрнами, а не с зерном яйца: настоящий результат
   яйца они не выдают. Показываются только разные фенотипы из жизнеспособных яиц, без долей: прогноз остаётся загадкой */
const ELI2={F:'🔥',W:'💧',T:'⛰️',A:'🌬️',P:'🌿',L:'☀️',D:'🌙'};
const cap=t=>t?t[0].toUpperCase()+t.slice(1):t;
const elName=ph=>ph.breath==='element'?ph.elements.map(e=>cap(W.ELN[e])).join(' + '):ph.breath==='smoke'?'Дымный':'Дремлющий';
function genoShort(d){const T=window.DRGINSP&&DRGINSP.allelesText;if(!T)return '';return ['E','E2','S'].map(l=>`${l} = ${esc(T(d.genome,l))}`).join(' · ')}
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
    const rd=E.ready(eg,K),lf=E.cardsLeft(eg,K);
    return `<div class="drg-plot${rd?' ready':''}"><span class="drg-egg"><svg viewBox="-14 -16 28 32" width="34" height="40" aria-hidden="true">${I.eggSVG(0,0,eg)}</svg><b>Яйцо №${eg.n}</b></span><span class="muted small">${esc(dname(st,eg.m))} ♀ × ${esc(dname(st,eg.f))} ♂</span><span class="drg-bar"><i style="width:${Math.min(100,(eg.need-E.left(eg,K))/eg.need*100)}%"></i></span><span class="muted small">${rd?'Готово!':`${E.timeShort(eg,K)} · ускорить: ${cardsAcc(lf)}`}</span>
      ${eg.viable?`<span class="muted small drg-eggg">🧬 Генотип птенца определился при слиянии гамет; цвет крапинок — его стихия.</span>`:`<span class="drg-why">🧬 Яйцо не развивается: птенец получил летальный аллель Wg и от матери, и от отца (Wg/Wg). У двух носителей Wg/+ так в среднем с каждым четвёртым яйцом.</span>`}
      ${rd?hatchWhy(st,eg):''}
      ${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="hatch" data-id="${b.id}" data-plot="${i}"${hatchBlocked(st,eg)?' disabled':''}>Вылупить</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(E.left(eg,K)/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}${lockedSlotHTML(st,b,c)}</div>`}

/* ---------- «Как получился этот дракон» (5.0): происхождение по генам из движка (DRG.origin) ----------
   Какой аллель пришёл от матери и какой от отца, что из этого видно, по какому правилу; был ли кроссинговер в мейозе
   родителя между сцепленными генами, где новая мутация, как определился пол. Частоты — числа модели, а не природы */
const ELN={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма',e:'нет стихии','0':'нет'};
const GENE_RULE={E:'кодоминирование: видны обе стихии, e рецессивен',E2:'вторая стихия добавляется к первой (кодоминирование), 0 ничего не даёт',
  S:'эпистаз: ss гасит любую стихию, дракон дремлет',C:'серия аллелей: C (тёмный) > Cb (бронзовый) > c (бледный)',H:'полное доминирование: с H рога есть',
  K:'полное доминирование: с K булава есть; ген сцеплен с H на хромосоме A3',R:'неполное доминирование: R1R1 большой гребень, R1R2 средний, R2R2 нет',
  Wg:'доминантный с летальным действием: Wg/+ короткие крылья, Wg/Wg погибает в яйце',Q1:'полигенный признак: каждый «+» даёт 0,5 м размаха',
  Q2:'полигенный признак: каждый «+» даёт 0,5 м размаха',Q3:'полигенный признак: каждый «+» даёт 0,5 м размаха',
  M:'сцеплен с полом (Z): M доминирует, чешуя блестит',N:'сцеплен с полом (Z), рецессивный: ночное зрение у nn и у самки с одной n',
  Sp:'на W: шпоры только у самок, от матери к дочери',G:'в митохондриях: только от матери'};
function geneSeen(l,ph){switch(l){
  case 'E':case 'E2':return ph.breath==='element'?ph.elements.map(e=>ELN[e]).join(', '):ph.breath==='smoke'?'дым без стихии':'стихия спит (нет искры)';
  case 'S':return ph.breath==='dormant'?'искры нет':'искра есть';case 'C':return {dark:'тёмный окрас',bronze:'бронзовый окрас',pale:'бледный окрас'}[ph.color];
  case 'H':return ph.horns?'рога есть':'рогов нет';case 'K':return ph.mace?'булава есть':'булавы нет';case 'R':return {big:'большой гребень',mid:'средний гребень',none:'гребня нет'}[ph.crest];
  case 'Wg':return ph.shortWings?'короткие крылья':'обычные крылья';case 'Q1':case 'Q2':case 'Q3':return `размах ${String(ph.spanM).replace('.',',')} м (всего «+»: ${ph.span})`;
  case 'M':return ph.metal?'блеск есть':'блеска нет';case 'N':return ph.night?'ночное зрение есть':'ночного зрения нет';case 'Sp':return ph.spurs?'шпоры есть':'шпор нет';case 'G':return ph.glow?'глаза светятся':'глаза не светятся'}return ''}
function originHTML(st,d,open){if(!d.parents||!G.origin)return '';
  const m=st.dragons.find(x=>x.id===d.parents?.[0])||(st.gone||[]).find(x=>x.id===d.parents?.[0]),f=st.dragons.find(x=>x.id===d.parents?.[1])||(st.gone||[]).find(x=>x.id===d.parents?.[1]);
  if(!m||!f)return '<p>Данные родителей недоступны. Наследуются только стихии E, E2 и искра S.</p>';
  return `<p>Стихии потомка: ${esc(elName(phOf(d)))}. Внешность декоративная и не даёт боевых прибавок.</p>${quickGenetics(m,f,'elements')}`;
}
function legacyOriginHTML(st,d,open){if(!d.parents||!G.origin)return '';
  const all=st.dragons.concat(st.gone||[]),mo=all.find(x=>x.id===d.parents[0]),fa=all.find(x=>x.id===d.parents[1]),g=d.genome,ph=phOf(d);
  const o=G.origin(g,mo&&mo.genome,fa&&fa.genome),al=(l,a)=>a==null?'—':(l==='E'||l==='E2')?`${esc(a)} <small>${ELN[a]||''}</small>`:esc(a);
  const nm=l=>G.LOCI[l].name,who={m:'матери',f:'отца'},hom={m:'гомозиготна',f:'гомозиготен'};
  const sex=g.sex==='F'?`<p><b>Пол.</b> Самка (ZW): W от матери, Z от отца. У драконов, как у птиц, пол определяет мать: в её яйцеклетку попадает Z или W, половина на половину.</p>`
    :`<p><b>Пол.</b> Самец (ZZ): одна Z от матери, другая от отца. Пол определила яйцеклетка матери: в неё попала Z, а не W.</p>`;
  const rows=o.genes.map(x=>`<tr><th scope="row">${esc(nm(x.locus))} <small>${esc(x.chr)}</small></th><td>${al(x.locus,x.m)}</td><td>${x.chr==='W'||x.chr==='mt'?'—':al(x.locus,x.f)}</td><td>${esc(geneSeen(x.locus,ph))}<small class="drg-gr">${esc(GENE_RULE[x.locus]||'')}</small></td></tr>`).join('');
  const cr=o.cross.map(c=>{const A=nm(c.a),B=nm(c.b),p=Math.round(c.r*100);
    return `<li class="${c.state}">${c.state==='rec'?`<b>Кроссинговер в мейозе ${who[c.who]}</b> между генами «${esc(A)}» и «${esc(B)}» (хромосома ${c.chr}): аллели этих генов пришли с разных хромосом ${who[c.who]}. В модели так в ${p} % гамет.`
      :c.state==='par'?`Мейоз ${who[c.who]}: «${esc(A)}» и «${esc(B)}» перешли вместе, как лежали на одной хромосоме, без перекреста (в модели так в ${100-p} % гамет).`
      :c.state==='hom'?`«${esc(A)}» и «${esc(B)}» у ${who[c.who]}: родитель ${hom[c.who]} хотя бы по одному гену, поэтому был ли перекрёст, по птенцу не видно.`
      :`«${esc(A)}» и «${esc(B)}» у ${who[c.who]}: здесь новая мутация, перекрёст не определить.`}</li>`}).join('');
  const mu=o.mut.map(m=>`<li class="mut"><b>Новая мутация</b> в гамете ${who[m.who]}: ген «${esc(nm(m.locus))}», аллель ${esc(m.a)} — его не было ни на одной хромосоме ${who[m.who]}. В модели мутация случается в 1 гене из 400 в каждой гамете.</li>`).join('');
  const lost=!mo||!fa?`<p class="muted small">Геном ${!mo&&!fa?'родителей':!mo?'матери':'отца'} не сохранился, поэтому перекрёсты и мутации показаны не полностью.</p>`:'';
  return `<details class="drg-orig" data-k="orig-${esc(d.id)}"${open?' open':''}><summary>🧬 Откуда у ${esc(d.name)} эти признаки</summary>
    <p class="muted small">Каждая хромосома пары пришла от одного родителя: ♀ — аллель от матери ${esc(mo?mo.name:'?')}, ♂ — от отца ${esc(fa?fa.name:'?')}. Яйцо получилось слиянием двух гамет, и каждая гамета — результат мейоза.</p>
    ${sex}<div class="drg-ot"><table><thead><tr><th>Ген</th><th>♀ от матери</th><th>♂ от отца</th><th>что видно</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${cr||mu?`<h4>Что произошло в мейозе</h4><ul class="drg-cr">${cr}${mu}</ul>`:''}${lost}
    <p class="muted small">Митохондрии и W-хромосома в паре не бывают: обе передаются только от матери. Числа модели (18 % перекрёстов между рогами и булавой, 10 % между блеском и ночным зрением, 1/400 мутаций) выбраны для игры; сами механизмы — как в природе.</p></details>`}

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
  const log=st.log||[],fv=S.fv||{},tr='elements';
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
function storeTabs(tab){return `<nav class="drg-store-tabs" aria-label="Покупки"><button class="btn ${tab==='shop'?'':'ghost'}" data-act="drgpanel" data-v="shop" aria-pressed="${tab==='shop'}">🔨 Здания</button><button class="btn ${tab==='market'?'':'ghost'}" data-act="drgpanel" data-v="market" aria-pressed="${tab==='market'}">🐉 Драконы</button></nav>`}
function shopHTML(st,L){
  const row=k=>{const t=E.TYPES[k],lock=L<t.unlock,full=t.kind==='hab'?E.count(st,'hab')>=E.maxHabs(L):t.kind==='farm'?E.count(st,'farm')>=E.maxFarms(L):false;
    /* единственное на острове здание (Гнездовье, Инкубатор): уже есть, значит, открыть его, а не строить второе */
    const one=t.kind==='farm'?st.bld.find(b=>b.type==='farm'):t.max&&E.count(st,t.kind)>=E.maxOf(t,L)&&st.bld.find(b=>b.type===k);
    if(one)return `<button class="drg-shop-i built" data-act="drgsel" data-id="${one.id}"><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${one.build?'строится':t.more?(L<t.more.L?`уже есть, второе с ${t.more.L}-го уровня`:'уже построено'):'уже построено'}</small><span class="drg-price">${one.build?'Строится':'Построено'} → открыть</span></button>`;
    const bc=E.buildCost(st,k),gold=Math.floor(st.bal.gold),gems=Math.floor(st.bal.gems),noG=gold<bc.gold,noM=(bc.gems||0)>gems;
    const why=t.soon?'В следующем обновлении':lock?`С ${t.unlock}-го уровня`:full?(t.kind==='hab'?`Сред обитания уже ${E.count(st,'hab')} из ${E.maxHabs(L)}: следующая с ростом острова`:`Ферм уже ${E.count(st,'farm')} из ${E.maxFarms(L)}: следующая с ростом острова`)
      :noG?`Не хватает ${fmt(bc.gold-gold)} 🪙`:noM?`Не хватает ${bc.gems-gems} 💎`:'';
    return `<button class="drg-shop-i" data-act="drgbuild" data-type="${k}"${why?' disabled':''}><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${t.kind==='hab'?'для: '+t.hosts.map(h=>HOSTS[h]).join(', '):t.kind==='farm'?'корм для драконов':'для скрещивания'}</small><span class="drg-price">${fmt(bc.gold)} 🪙${bc.gems?' + '+bc.gems+' 💎':''} · ${Math.round(bc.need/10*10)/10} ч</span>${why?`<em>${why}</em>`:''}</button>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Построить</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  ${storeTabs('shop')}<p class="muted small">Сред обитания ${E.count(st,'hab')} из ${E.maxHabs(L)}, ферм ${E.count(st,'farm')} из ${E.maxFarms(L)} на ${L}-м уровне. Стройка идёт по реальному времени, в том числе вне платформы. Каждая карточка сокращает ожидание на час; 10 единиц старых часов острова соответствуют 1 часу.</p>
  <div class="drg-shop">${[...E.HAB_ORDER,'farm','nest','hatch'].map(row).join('')}</div></section>`}

const MK_NAME={F:'Огненный дракон',W:'Водный дракон',N:'Дымный дракон',T:'Земляной дракон',A:'Воздушный дракон',P:'Лесной дракон'};
function marketHTML(st,L){
  const row=k=>{const t=E.TYPES[k],lock=L<t.unlock,home=st.bld.some(b=>b.type===k&&!b.build&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b));
    const ph=G.phenotype(E.marketGenome(k,'preview')),why=lock?`С ${t.unlock}-го уровня`:!home?`Нужен свободный дом: ${t.name}`:'';
    return `<div class="drg-shop-i"><span class="drg-shop-pic">${W.svg(ph,{key:'mk'+k,size:110})}</span><b>${MK_NAME[k]}</b><small>генотип неизвестен, редкость видна после покупки</small><span class="drg-price">${fmt(t.price)} 🪙</span>${why?`<em>${why}</em>`:`<button class="btn sm" data-act="drgdo" data-t="buy" data-type="${k}">Купить</button>`}</div>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Рынок драконов</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  ${storeTabs('market')}<p class="muted small">На рынке — драконы одной стихии. Генетика определяет только стихии E, E2 и искру S. Боевые параметры зависят от уровня и роли стихии; внешность декоративная. Гибриды появляются при скрещивании.</p>
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
  ${own?(()=>{const t=todoInfo(st,c);return it('drgpanel','pz','🧩','Головоломки дня',t.pz?`осталось ${t.pz} из 3 сегодня · от лёгкой к сложной, 60–140 🪙`:'на сегодня всё решено, завтра новые')
    +it('drgpanel','week','📜','Задания недели',t.wq||t.gift?`можно забрать: ${t.wq+t.gift}`:'три задания с наградой')})():''}
  ${own?it('drgpanel','academy','🏛','Академия драконов','заметное усиление за золото')+it('drgpanel','daily','📋','Ежедневные миссии','семь заданий каждый день'):''}
  ${it('drgpanel','top','🏆','Рейтинг островов','уровни, звёзды похода, в гости')}
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
  const stat0=b=>{const T=E.TYPES[b.type],job=b.build||b.up;if(b.build)return E.ready(b.build,K)?'стройка готова':`строится, ещё ${cards(E.cardsLeft(b.build,K))}`;
    const out=[];if(b.up&&!E.ready(b.up,K))out.push(`улучшается, ещё ${cards(E.cardsLeft(b.up,K))}`);
    if(T.kind==='hab'){const n=st.dragons.filter(d=>d.home===b.id).length,a=Math.floor(E.chestNow(st,b,K));out.push(n?`драконов ${n} из ${E.habCap(b)}`:'пустует');if(a>=1)out.push(`в сундуке ${fmt(a)} 🪙${a>=E.chestCap(b)?' (полон)':''}`)}
    if(T.kind==='farm'){const r=(b.plots||[]).filter(p=>p&&E.ready(p,K)).length,e=(b.plots||[]).filter(p=>!p).length;out.push(r?`созрело ${r}`:e?`свободных грядок ${e}`:'растёт')}
    if(T.kind==='nest')out.push(b.pair?(E.ready(b.pair,K)?'яйцо готово':`яйцо через ${cards(E.cardsLeft(b.pair,K))}`):'пара не выбрана');
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
    h=`<p>Самоцветы ускоряют ожидание: один заменяет ${E.SKIP_CARDS} карточек стройки, грядки или яйца. Их дают: засчитанный день (${GOAL} карточек), каждые ${GOAL} карточек сверх цели, рубежи серии ${E.MILESTONES.map(m=>m[0]).join(', ')} дней, новый уровень острова, верный прогноз потомства, первые победы над боссами в походе и проверенные ДЗ.</p><p>Бонус за ДЗ начисляется один раз за задание по проценту выполнения: от 60 % +1 💎, 30 🌾, 100 🪙 и опыт острова; от 80 % +2 💎, 60 🌾, 250 🪙; от 85 % +3 💎, 100 🌾, 400 🪙; от 90 % +4 💎, 150 🌾, 600 🪙; от 95 % +6 💎, 250 🌾, 900 🪙 и подарочный редкий дракон (забрать в «Ещё» → «Задания недели»). Пересдача с той же оценкой бонус не повторяет.</p>
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
document.addEventListener('change',e=>{const el=e.target;if(!el||!/^drg(M|F|Pt|Pc|Jt|CompareA|CompareB|CompareLevel)$/.test(el.id))return;S.fv=S.fv||{};S.fv[el.id]=el.value;render()});
/* на узком экране карта шире окна: сначала показываем середину острова, а после перерисовки возвращаем прокрутку */
document.addEventListener('scroll',e=>{const m=e.target;if(m&&m.classList&&m.classList.contains('drg-map'))S.drgScroll=m.scrollLeft},true);
new MutationObserver(()=>{const m=document.querySelector('.drg-map');if(!m||m.dataset.sc)return;m.dataset.sc='1';
  m.scrollLeft=S.drgScroll!=null?S.drgScroll:(m.scrollWidth-m.clientWidth)/2}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- остров на весь экран: панорама и масштаб ----------
   Камера живёт вне HTML (S.drgCam), чтобы перерисовка не сбрасывала положение; применяется после каждой перерисовки. */
const cam=()=>S.drgCam||(S.drgCam={z:0,x:0,y:0});
function camBox(){const m=document.querySelector('.drg-world');return m?m.getBoundingClientRect():null}
const inMap=t=>t&&t.closest&&t.closest('.drg-world,.drg-map.full');
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
  c.x=(F.x0+fw/2)-c.z*M.x(B[0]+B[2]/2);c.y=(F.y0+fh/2)-c.z*M.y(B[1]+B[3]/2);c.W=r.width;c.H=r.height;c.auto=!keepZ;
  if(!keepZ)c.f=[c.x,c.y,c.z]}   /* вид «по острову»: от него считается сдвиг фона (параллакс) */
/* камера не уводит остров за край: хотя бы четверть его ширины и высоты остаётся в свободной части */
function camClamp(c,r){c.z=Math.max(ZMIN,Math.min(ZMAX,c.z));const M=svgMap(r),B=islBounds('whole'),F=freeRect(r);
  const x0=c.x+c.z*M.x(B[0]),x1=c.x+c.z*M.x(B[0]+B[2]),y0=c.y+c.z*M.y(B[1]),y1=c.y+c.z*M.y(B[1]+B[3]),mx=(x1-x0)/4,my=(y1-y0)/4;
  if(x1<F.x0+mx)c.x+=F.x0+mx-x1;if(x0>F.x1-mx)c.x-=x0-(F.x1-mx);if(y1<F.y0+my)c.y+=F.y0+my-y1;if(y0>F.y1-my)c.y-=y0-(F.y1-my)}
function camApply(){const st=document.querySelector('.drg-world .drg-stage'),r=camBox();if(!st||!r)return;const c=cam();
  if(!c.z)camFit(r,false,fitKind(r));
  else if(c.W&&(Math.abs(c.W-r.width)>1||Math.abs(c.H-r.height)>1)){
    /* поворот телефона или новое окно: нетронутый вид подгоняется заново, сдвинутый сохраняет точку в центре */
    if(c.auto)camFit(r,false,fitKind(r));else{const o=svgMap({width:c.W,height:c.H}),n=svgMap(r),u=((c.W/2-c.x)/c.z-o.x(0))/o.s0,v=((c.H/2-c.y)/c.z-o.y(0))/o.s0;
      c.x=r.width/2-c.z*n.x(u);c.y=r.height/2-c.z*n.y(v);c.W=r.width;c.H=r.height}}
  camClamp(c,r);
  /* Масштабируем размер SVG, а не готовую текстуру слоя: вектор растрируется в реальном разрешении. */
  const sw=+(r.width*c.z).toFixed(2)+'px',sh=+(r.height*c.z).toFixed(2)+'px';
  const resized=st.style.width!==sw||st.style.height!==sh;
  if(resized){st.style.width=sw;st.style.height=sh}
  const tr=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`;
  const moved=resized||st.style.transform!==tr;if(moved)st.style.transform=tr;
  /* фон за островом движется медленнее камеры: далёкие острова и облака дают глубину */
  const bgs=st.parentElement.querySelector('.drg-bgs');
  if(bgs){if(!c.f)c.f=[c.x,c.y,c.z];const F0=c.f,k=0.32,zb=F0[2]*Math.pow(c.z/F0[2],k),Sx=r.width/2,Sy=r.height/2,
      ux=(Sx-c.x)/c.z,uy=(Sy-c.y)/c.z,u0x=(Sx-F0[0])/F0[2],u0y=(Sy-F0[1])/F0[2],bx=u0x+(ux-u0x)*k,by=u0y+(uy-u0y)*k;
    const tb=`translate(${(Sx-zb*bx).toFixed(1)}px,${(Sy-zb*by).toFixed(1)}px) scale(${zb.toFixed(3)})`;if(bgs.style.transform!==tb)bgs.style.transform=tb}
  /* мелко: подписи построек прячутся, чтобы не слипались */
  const m=st.parentElement,px=svgMap(r).s0*c.z,lo=px<0.42;if(m.classList.contains('zlo')!==lo)m.classList.toggle('zlo',lo);
  /* подписи построек держат экранный размер около 11 px при любом масштабе */
  st.style.setProperty('--lz',Math.max(0.45,Math.min(1.6,11/(12*px))).toFixed(3));
  if(window.DRLIVE){if(moved&&DRLIVE.cam)DRLIVE.cam();else DRLIVE.wake()}}   /* камера сдвинулась: драконы и эффекты в том же кадре, что и остров */
/* выбранная постройка не прячется под панелью: если её не видно, остров сдвигается, масштаб тот же */
function camShow(id){const r=camBox(),x=stateOf(S.drgUid||meId());if(!r||!x)return;const b=x.st.bld.find(z=>z.id===id);if(!b||E.isleOf(b)!==curIsle(x.st))return;
  const c=cam(),M=svgMap(r),F=freeRect(r),p=I.P(b.x+1,b.y+1),sx=c.x+c.z*M.x(p[0]),sy=c.y+c.z*M.y(p[1]-30);
  if(sx<F.x0+30||sx>F.x1-30||sy<F.y0+30||sy>F.y1-30){c.x+=(F.x0+F.x1)/2-sx;c.y+=(F.y0+F.y1)/2-sy;c.auto=false;camApply()}}
function camZoom(px,py,f){const r=camBox();if(!r)return;const c=cam(),nz=Math.max(ZMIN,Math.min(ZMAX,c.z*f)),k=nz/c.z;c.x=px-(px-c.x)*k;c.y=py-(py-c.y)*k;c.z=nz;c.auto=false;camApply()}
const ptrs=new Map();let moved=0,lastDrag=0,pinch=null;
const onHud=t=>t.closest&&t.closest('.drg-hud,.drg-dock,.drg-svw,.drg-zm,.drg-place,.drg-pan');
window.addEventListener('pointerdown',e=>{const m=inMap(e.target);if(!m||onHud(e.target))return;
  ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(ptrs.size===1)moved=0;if(ptrs.size===2){const [a,b]=[...ptrs.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1])}}});
window.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const r=camBox();if(!r){ptrs.clear();return}
  const dx=e.clientX-p[0],dy=e.clientY-p[1];ptrs.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptrs.size===1){moved+=Math.abs(dx)+Math.abs(dy);if(moved>6){const c=cam();c.x+=dx;c.y+=dy;c.auto=false;camApply()}}
  else if(ptrs.size===2&&pinch){const [a,b]=[...ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);moved=99;
    camZoom((a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top,d/pinch.d);pinch.d=d}});
const ptrUp=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(moved>6)lastDrag=Date.now()};
window.addEventListener('pointerup',ptrUp);window.addEventListener('pointercancel',ptrUp);
/* после перетаскивания отпускание кнопки не считается нажатием на здание */
window.addEventListener('click',e=>{if(Date.now()-lastDrag<350&&inMap(e.target)&&!onHud(e.target)){e.stopPropagation();e.preventDefault()}},true);
window.addEventListener('wheel',e=>{const m=inMap(e.target);if(!m||onHud(e.target))return;e.preventDefault();
  const r=camBox();
  /* 4.2: щипок на трекпаде и колесо с ⌘/Ctrl — масштаб; обычная прокрутка двумя пальцами или колесом двигает остров */
  if(e.ctrlKey||e.metaKey){camZoom(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*(e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaY)<50?0.012:0.0018)));return}
  const k=e.deltaMode===1?18:1,c=cam();c.x-=e.deltaX*k;c.y-=e.deltaY*k;c.auto=false;camApply()},{passive:false});
/* головоломки с клавиатуры (5.0): цифры в выбранную клетку, Backspace/Delete стирает, стрелки двигают выбор (с нуля — от левого верхнего угла),
   N — заметки, пробел меняет цифру Бинарио, ⌘/Ctrl+Z — отменить ход */
document.addEventListener('keydown',e=>{if(S.drgPanel!=='pz'||e.altKey||!window.DRPZ)return;const k=e.key,t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
  const kind=S.pzTab;if(!kind)return;const c=ctxOf(meId());if(!c)return;const p=pzOf(c,kind);if(!p)return;
  const st=stateOf(meId());if(st&&st.st.pz&&st.st.pz.d===c.today&&st.st.pz.done.includes(kind))return;
  const stop=()=>{e.preventDefault();e.stopPropagation()};
  if((e.metaKey||e.ctrlKey)&&(k==='z'||k==='Z'||k==='я'||k==='Я')){stop();window.DRG_ACTIONS.drgpzu({dataset:{k:kind}});render();return}
  if(e.metaKey||e.ctrlKey)return;
  const mv={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[k];
  if(mv){stop();const s0=S.pzSel&&S.pzSel.k===kind?S.pzSel:null;S.pzSel=s0?{k:kind,i:Math.max(0,Math.min(p.N-1,s0.i+mv[0])),j:Math.max(0,Math.min(p.N-1,s0.j+mv[1]))}:{k:kind,i:0,j:0};render();
    setTimeout(()=>{const b=document.querySelector(`.pzc[data-k="${kind}"][data-i="${S.pzSel.i}"][data-j="${S.pzSel.j}"]`);if(b&&!b.disabled)b.focus({preventScroll:true})},30);return}
  if(k==='n'||k==='N'||k==='т'||k==='Т'){if(p.kind!=='bin'){stop();S.pzNote=!S.pzNote;render()}return}
  if(!S.pzSel||S.pzSel.k!==kind)return;
  const dig=p.kind==='bin'?/^[01]$/:/^[1-5]$/;
  let n=null;if(dig.test(k))n=k;else if(k==='Backspace'||k==='Delete'||(p.kind!=='bin'&&k==='0'))n='x';else if(k===' '&&p.kind==='bin')n='~';
  if(n==null)return;stop();const err=pzInput(kind,n);if(err)toast(err);render()},true);
/* ячейки для переноса и курсор клавиатуры */
function placeSlots(){const x=stateOf(meId()),p=S.drgPlace;if(!x||!p)return [];return E.freeSlots(viewSt(x.st),p.move||null)}
function placeAt(p){const pl=S.drgPlace;if(!pl)return;pl.cur={x:p.x,y:p.y};
  /* курсор не уходит за край экрана: остров сдвигается, масштаб тот же */
  const r=camBox();if(!r)return;const c=cam(),M=svgMap(r),F=freeRect(r),q=I.P(p.x+1,p.y+1),sx=c.x+c.z*M.x(q[0]),sy=c.y+c.z*M.y(q[1]);
  if(sx<F.x0+60||sx>F.x1-60||sy<F.y0+60||sy>F.y1-60){c.x+=(F.x0+F.x1)/2-sx;c.y+=(F.y0+F.y1)/2-sy;c.auto=false}}
/* первая ячейка: сама переносимая постройка (её место свободно для неё же), иначе ближайшая к середине экрана */
function placeStart(){const sl=placeSlots();if(!sl.length)return;const pl=S.drgPlace,x=stateOf(meId());
  const b=pl.move&&x&&x.st.bld.find(z=>z.id===pl.move),own=b&&sl.find(q=>q.x===b.x&&q.y===b.y);if(own)return placeAt(own);
  const r=camBox(),c=cam();if(!r)return placeAt(sl[0]);const M=svgMap(r),cx=r.width/2,cy=r.height/2;
  placeAt(sl.slice().sort((a,b)=>{const d=q=>{const p=I.P(q.x+1,q.y+1);return Math.hypot(c.x+c.z*M.x(p[0])-cx,c.y+c.z*M.y(p[1])-cy)};return d(a)-d(b)})[0])}
function placeKeys(e,k){const x=stateOf(meId()),own=(S.drgUid||meId())===meId();if(!own||!x)return false;
  const t=e.target,inPan=t&&t.closest&&t.closest('#main>.drg-pan');
  if(!S.drgPlace){
    if(k!=='g'&&k!=='G'&&k!=='п'&&k!=='П')return false;
    const f=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.drg-b[data-id]'),id=S.drgSel||(f&&f.dataset.id);
    if(!id){e.preventDefault();toast('Выберите постройку (нажмите на неё или Tab), потом G — перенести');return true}
    e.preventDefault();onIsleOf(id);S.drgPlace={move:id};S.drgSel=null;S.drgPanel=null;placeStart();render();return true}
  if(inPan)return false;
  const pl=S.drgPlace,dir={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
  if(dir){e.preventDefault();const sl=placeSlots();if(!sl.length)return true;if(!pl.cur||!sl.some(q=>q.x===pl.cur.x&&q.y===pl.cur.y)){placeStart();render();return true}
    const p0=I.P(pl.cur.x+1,pl.cur.y+1);let best=null,bs=1e9;
    sl.forEach(q=>{if(q.x===pl.cur.x&&q.y===pl.cur.y)return;const p=I.P(q.x+1,q.y+1),dx=p[0]-p0[0],dy=(p[1]-p0[1])*2,al=dx*dir[0]+dy*dir[1],pe=Math.abs(dx*dir[1]-dy*dir[0]);
      if(al<=4)return;const sc=al+pe*2.2;if(sc<bs){bs=sc;best=q}});
    if(best){placeAt(best);render()}return true}
  if(k==='Enter'||k===' '){if(!pl.cur)return false;e.preventDefault();window.DRG_ACTIONS.drgtile({dataset:{x:pl.cur.x,y:pl.cur.y}});render();return true}
  if(k==='a'||k==='A'||k==='ф'||k==='Ф'){e.preventDefault();window.DRG_ACTIONS.drgauto();render();return true}
  return false}
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
  /* 5.0: перенос и установка постройки с клавиатуры. G (П) — перенести выбранную или ту, что в фокусе;
     стрелки — соседняя свободная ячейка в эту сторону экрана, Enter или пробел — поставить, A (Ф) — на свободное место, Esc — отмена */
  if(placeKeys(e,k))return;
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
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-act]');if(!b||!b.closest('.drg-world,.drg-map.full,#main>.drg-pan'))return;
  if(b.closest('.drg-pan'))return;const a=b.dataset.act;if(a==='drgpanel'||a==='drgsel')navRet={act:a,v:b.dataset.v||'',id:b.dataset.id||''}},true);
function navFocus(){const k=(S.view==='island'&&S.drgFull?(S.drgPanel||'')+'|'+(S.drgSel||''):'');if(k===navPan)return;const was=navPan;navPan=k;
  if(k&&k!=='|'){const h=document.querySelector('#main>.drg-pan h2');if(h){h.tabIndex=-1;if(!h.contains(document.activeElement))h.focus({preventScroll:true})}}
  else if(was&&was!=='|'&&navRet){const r=navRet;navRet=null;const q=r.id?`[data-act="${r.act}"][data-id="${r.id}"]`:`[data-act="${r.act}"][data-v="${r.v}"]`;const el=document.querySelector('.drg-world '+q+',.drg-map.full '+q);if(el)el.focus({preventScroll:true})}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.drgFull&&S.view==='island'&&!document.querySelector('dialog[open]')&&!document.querySelector('.dri,.drf')){if(S.drgPlace){S.drgPlace=null}else if(S.drgPanel||S.drgSel){S.drgPanel=null;S.drgSel=null}else S.drgFull=false;render()}});
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
  return {id:d.id,name:d.name,genome:d.genome,lvl:d.lvl,academyRank:d.academyRank||0,fed:d.fed||0,feeds:E.FEEDS,own,gen:d.gen||1,from:d.from||null,
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
  /* в гости: витрину берём из рейтинга (или грузим), остров открывается на весь экран только для просмотра */
  drgvisit:async el=>{const u=el.dataset.v;S.drgPanel=null;S.drgSel=null;S.drgPlace=null;S.drgCam=null;S.drgIsle=0;
    if(!u){S.drgUid=null;S.view='island';render();return}
    let r=((S.drgTop||{}).rows||[]).find(x=>x.uid===u);if(!r){const x=await S.db.doc(`arena/${u}/isle/show`).get();r=x.exists?Object.assign({uid:u},x.data()):null}
    if(!r){toast('Этот остров ещё не открыт');return}
    S.drgVisits=S.drgVisits||{};S.drgVisits[u]=r;S.drgUid='v:'+u;S.view='island';S.drgFull=true;render()},
  /* головоломки: вкладка, выбор клетки (в Бинарио нажатие меняет цифру), цифра, заметки, отмена, очистка, проверка */
  drgpztab:el=>{S.pzTab=el.dataset.k;S.pzSel=null},
  drgpz:el=>{const k=el.dataset.k,i=+el.dataset.i,j=+el.dataset.j;S.pzTab=k;S.pzSel={k,i,j};
    if(k==='bin'){const err=pzInput(k,'~');if(err)toast(err)}},
  drgpzn:el=>{const err=pzInput(el.dataset.k,el.dataset.n);if(err)toast(err)},
  drgpznote:()=>{S.pzNote=!S.pzNote},
  drgpzu:el=>{const k=el.dataset.k,u=S.pzU&&S.pzU[k];if(!u||!u.length){toast('Отменять нечего');return}const c=ctxOf(meId()),p=pzOf(c,k),x=JSON.parse(u.pop());
    S.pzA=S.pzA||{};S.pzM=S.pzM||{};S.pzA[k]={d:c.today,a:x.a};S.pzM[k]={d:c.today,m:x.m};pzSave(c,k,x.a,x.m);pzAns(c,p)},
  drgpzr:el=>{const k=el.dataset.k,c=ctxOf(meId()),p=pzOf(c,k),a=pzAns(c,p),m=pzNotes(c,p);pzPush(k,a,m);
    S.pzA=S.pzA||{};S.pzM=S.pzM||{};delete S.pzA[k];delete S.pzM[k];try{localStorage.removeItem(pzKey(c,k));localStorage.removeItem(pzKey(c,k)+':n')}catch(e){}pzAns(c,p);pzNotes(c,p);toast('Сетка очищена. «Отменить ход» вернёт её')},
  drgpzc:el=>{const k=el.dataset.k,c=ctxOf(meId()),p=pzOf(c,k),a=pzAns(c,p);
    /* пустая клетка: в Бинарио — null (0 там законный ответ), в остальных — 0 */
    const left=a.flat().filter(v=>!pzHas(p,v)).length;if(left){toast(`Заполните все клетки: осталось ${left}`);return}
    if(DRPZ.conflicts(p,a).length){toast('Есть нарушения правил: такие клетки подсвечены красным');return}
    const g=DRPZ.rewardOf?DRPZ.rewardOf(k):DRPZ.REWARD,r=act({t:'puzzle',kind:k,ans:a});if(r){S.pzSel=null;S.pzNote=false;toast(`Решено! +${g} 🪙`)}},
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
  drgmove:el=>{onIsleOf(el.dataset.id);S.drgPlace={move:el.dataset.id};S.drgSel=null;if(!S.drgFull)window.scrollTo(0,0);else placeStart()},
  drgcancel:()=>{S.drgPlace=null},
  drgorig:el=>{S.drgOrig=el.dataset.dragon;S.drgPanel='orig';S.drgSel=null},
  /* то же, что нажать на клетку, но клетку выбирает игра: ближайшая к середине открытой земли. Путь для клавиатуры */
  drgauto:()=>{const p=S.drgPlace,x=stateOf(meId());if(!p||!x)return;const st=viewSt(x.st),C=E.CHUNK,cells=[];
    (st.land||[]).forEach(id=>{const [cx,cy]=id.split(',').map(Number);for(let i=0;i<C;i++)for(let j=0;j<C;j++)cells.push([cx*C+i,cy*C+j])});
    const m=cells.reduce((a,c)=>[a[0]+c[0]/cells.length,a[1]+c[1]/cells.length],[0,0]);
    /* 5.0: только свободные ячейки сетки (стройка и перенос притягиваются к ячейкам; произвольная клетка могла оказаться в занятой ячейке) */
    const ok=E.freeSlots(st,p.move||null).map(q=>[q.x,q.y]).sort((a,b)=>Math.hypot(a[0]+1-m[0],a[1]+1-m[1])-Math.hypot(b[0]+1-m[0],b[1]+1-m[1]));
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
    else if(r.s.got&&r.s.got.wq)toast('Награда за задание недели: '+rwd(r.s.got.wq))
    else if(d.t==='hwgift'){const x=r.s.dragons.find(z=>z.id===r.s.last);toast(`🎁 ${x.name} — редкий дракон за отличное ДЗ${r.s.got.nursery?' (пока в яслях)':''}`)}
    else if(r.s.got&&r.s.got.gems&&d.t==='research')toast(`Цель выполнена: +${r.s.got.gems} 💎`)
    else if(r.s.got&&r.s.got.dead)toast('Яйцо не развилось. Посмотри в журнале, у каких родителей так бывает')
    else if(r.s.got&&r.s.got.baby){const x=r.s.dragons.find(z=>z.id===r.s.got.baby);S.drgPanel='baby';S.drgBaby=x.id;S.drgSel=null}},
  drgprob:el=>{S.fv=S.fv||{};S.fv.drgPp=el.dataset.v},
  drgbreed:el=>{const fv=S.fv||{},t=fv.drgPt===undefined?'elements':fv.drgPt,pp=parseFloat(String(fv.drgPp||'').replace(',','.'));
    const pred=t&&!isNaN(pp)?{trait:t,value:fv.drgPc||(document.getElementById('drgPc')||{}).value,p:pp/100}:null;
    const r=act({t:'breed',id:el.dataset.id,mother:el.dataset.m,father:el.dataset.f,pred});if(!r)return;
    S.fv.drgPp='';const g=r.s.got&&r.s.got.pred;toast(g?(g.ok?'Прогноз верный! Яйцо будет вдвое быстрее, +1 💎':'Прогноз пока неверный. В Гнездовье доступна подсказка и разбор.'):'Пара в Гнездовье. Яйцо будет через '+cardsAcc(E.BREED_NEED))},
  drgrelease:async el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    /* единственная самка или самец, особенно взрослые: без них скрещивание встанет */
    const sx=d.genome.sex,same=x.st.dragons.filter(z=>z.genome.sex===sx),adult=same.filter(z=>z.lvl>=E.BREED_LV);
    const warn=same.length===1?` Это ${sx==='F'?'единственная самка':'единственный самец'} на острове: без ${sx==='F'?'неё':'него'} скрещивать будет нельзя, пока не купите ${sx==='F'?'самку':'самца'} на рынке.`:
      d.lvl>=E.BREED_LV&&adult.length===1?` Это ${sx==='F'?'единственная взрослая самка':'единственный взрослый самец'} (${E.BREED_LV}-й уровень и выше): других придётся сначала вырастить.`:'';
    if(!await askConfirm(`Отпустить дракона ${d.name}? Он улетит с острова насовсем, вернуть его нельзя.${warn} В журнале и родословной он останется, а его генотип сохранится в архиве острова, чтобы теория в журнале считалась по настоящим родителям. На прощание ${fmt(50*(1+G.gameRarity(phOf(d))))} золота.`,'Отпустить'))return;
    const r=act({t:'release',dragon:d.id});if(r)toast(`${d.name} улетел. +${fmt(r.s.got.gold)} золота на прощание`)},
  drgrename:el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    const n=prompt('Имя дракона',d.name);if(n!=null&&n.trim())act({t:'rename',dragon:d.id,name:n})}
};
Object.keys(window.DRG_ACTIONS).forEach(k=>{window.DRG_ACTIONS[k]=actGuard(window.DRG_ACTIONS[k])});
})();

setInterval(()=>{if(!document.hidden&&S.mode==='student'&&(S.view==='island'||S.view==='cards')&&!document.querySelector('.drf,.dri'))render()},30000);
