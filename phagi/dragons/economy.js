/* Экономика острова драконов. Чистая логика без DOM: работает в браузере (window.DECO) и в node для тестов.
   Главное правило: время на острове идёт в карточках. Часы острова K = сколько карточек ученица повторила за дни,
   когда был включён режим драконов. Стройка, грядки и сундуки считают не минуты, а K.
   Состояние лежит в одном документе srs/<uid>/meta/dragons; доход за дни (паёк корма, самоцветы) не хранится,
   а выводится из счётчика карточек по дням и зачисляется разницей (credited), поэтому накрутить его нельзя. */
(function(root){
'use strict';
const G=root.DRG||(typeof require!=='undefined'?require('./genetics.js'):null);

/* ---------- настройка дохода (этап D) ----------
   Одно место для золота, бонуса за объём повторения и корма: его читают игра, подсказки на странице и прогоны dev/econ.js.
   Сырые часы острова K остаются счётчиком карточек (по ним идут стройки, грядки, яйца). Бонус меняет только доход:
   карточка дня № j приносит золото драконов с множителем ladder(j), а сверх дневной цели ещё и корм.
   Всё это действует только на карточки после точки перехода s.evK: прошлые сундуки и прошлый корм не пересчитываются. */
const ECON={
  goldX:2,                                                     /* золото драконов за карточку вдвое больше прежнего */
  ladder:[[15,1],[30,1.15],[60,1.3],[120,1.5],[Infinity,1.6]], /* [до какой карточки дня, множитель этой карточки] */
  foodX:2,                                                     /* корм за каждую карточку сверх цели, тоже по лесенке */
  catchUp:{gap:10,k:0.5},                                     /* дракон на 10+ уровней ниже самого сильного: корм вдвое дешевле */
  xpFall:2.6,                                                  /* опыт острова после 20-го уровня: множитель (20/L)^xpFall */
  cardXp:6                                                     /* опыт острова за единицу часов золота (карточка до 15-й в дне = 2 единицы = 12 опыта) */
};
const ladderK=j=>{for(const [to,k] of ECON.ladder)if(j<=to)return k;return 1};
/* следующий порог лесенки после n карточек за день: {at, k} или null */
const ladderNext=n=>{for(const [to,k] of ECON.ladder)if(n<to&&isFinite(to))return {at:to+1,k:ladderK(to+1)};return null};

/* ---------- каталог ----------
   L у ступени улучшения: с какого уровня острова она доступна. Вместимость Инкубатора: места ступени плюс одно место
   за серию 7 дней (s.slot7). У старых островов с Инкубатором это место считается уже заработанным (slot7='legacy'),
   поэтому число ячеек у них не меняется: прежний 1-й уровень давал 2 места, теперь 1 + 1. */
const HAB_LV=[null,{cap:2,chest:600},{cap:3,chest:1800,cost:500,need:20},{cap:4,chest:5000,cost:1800,need:40},
  {cap:5,chest:9000,cost:6000,need:70,L:25},{cap:6,chest:16000,cost:15000,need:110,L:50}];
const FARM_LV=[null,{plots:2},{plots:3,cost:300,need:10},{plots:4,cost:1000,need:25},{plots:5,cost:4000,need:50,L:20},{plots:6,cost:12000,need:90,L:45}];
const HATCH_LV=[null,{slots:1},{slots:2,cost:600,need:15,L:6},{slots:3,cost:1800,need:30,L:14},{slots:4,cost:6000,need:60,L:30},{slots:5,cost:15000,need:100,L:60}];
/* скрещивание */
const DRAGON_MAX=60;                    /* предельный уровень дракона */
const BREED_LV=3;                       /* родители не ниже 3-го уровня */
const breedCost=(rm,rf)=>50*(1+rm+rf);
const BREED_NEED=10;                    /* пара в Гнездовье: карточек до яйца */
const HATCH_NEED=[8,14,22,32,45];       /* яйцо в Инкубаторе: карточек до вылупления по редкости */
const DEAD_NEED=4;
/* ясли при Инкубаторе: если подходящего дома нет (свет и тьма до 12-го уровня, все дома заняты), малыш живёт здесь.
   В яслях дракон не приносит золота, но его можно кормить, а когда появится дом, переселить. Геном не теряется.
   Мест в яслях 2, с ростом острова больше: +1 на 20, 40, 60, 80 и 100-м уровнях */
const NURSERY=2;
const nurseryCap=L=>NURSERY+Math.floor((L||1)/20);
const PRED_TOL=0.03;                    /* прогноз верен, если ошибка не больше 3 процентных пунктов */
/* Гнездовье и Инкубатор стоят на острове с начала (этап D): строить и ждать 3-го уровня не нужно. Вторые такие
   постройки открываются поздно (more: уровень острова и цена) */
const TYPES={
  F:{name:'Кальдера',kind:'hab',hosts:['F'],cost:150,need:10,unlock:1,price:250},
  W:{name:'Лагуна',kind:'hab',hosts:['W'],cost:150,need:10,unlock:1,price:250},
  N:{name:'Пещера',kind:'hab',hosts:['smoke','dormant'],cost:200,need:12,unlock:2,price:200},
  T:{name:'Утёс',kind:'hab',hosts:['T'],cost:350,need:18,unlock:3,price:500},
  A:{name:'Облачный шпиль',kind:'hab',hosts:['A'],cost:600,need:25,unlock:5,price:900},
  P:{name:'Роща',kind:'hab',hosts:['P'],cost:900,need:30,unlock:7,price:1400},
  L:{name:'Храм рассвета',kind:'hab',hosts:['L'],cost:6000,gems:25,need:60,unlock:12},
  D:{name:'Обсидиановая башня',kind:'hab',hosts:['D'],cost:6000,gems:25,need:60,unlock:12},
  farm:{name:'Ферма',kind:'farm',cost:100,need:6,unlock:1},
  nest:{name:'Гнездовье',kind:'nest',cost:400,need:15,unlock:1,max:1,more:{L:35,cost:20000,need:120}},
  hatch:{name:'Инкубатор',kind:'hatch',cost:300,need:12,unlock:1,max:1,more:{L:55,cost:40000,need:160}}
};
const HAB_ORDER=['F','W','N','T','A','P','L','D'];
const CROPS={
  ember:{name:'Огнеплодник',cost:20,need:5,food:24,unlock:1},
  pump:{name:'Драконья тыква',cost:90,need:15,food:120,unlock:2},
  vine:{name:'Звёздная лоза',cost:350,need:40,food:520,unlock:4},
  melon:{name:'Солнечная дыня',cost:1200,need:70,food:1900,unlock:15},
  moon:{name:'Лунный корень',cost:4000,need:120,food:6800,unlock:38}
};
const RAR_GOLD=[3,5,8,12,20];          /* золото за карточку у дракона 1-го уровня по редкости (до ECON.goldX) */
const SKIP_CARDS=10;                    /* один самоцвет заменяет 10 карточек ожидания */
/* остров до 20×20 клеток, земля открывается участками 4×4. Прежние участки 3×3 и их координаты не меняются,
   новые кольца (столбец и строка 3, потом 4) открываются с ростом острова (L) и только рядом с открытой землёй */
const GRID=24,CHUNK=4;   /* 4.2: остров до 24×24 клеток (6×6 участков) */
const START_LAND=['1,1','0,1','1,0','2,1','1,2'];
const LAND_COST={'0,0':{gold:1500},'2,0':{gold:3000},'0,2':{gems:20},'2,2':{gems:40},
  '3,1':{gold:8000,L:20},'1,3':{gold:12000,L:24},'3,0':{gold:18000,L:28},'0,3':{gems:60,L:32},'3,2':{gold:30000,L:36},'2,3':{gold:45000,L:40},'3,3':{gems:100,L:45},
  '4,1':{gold:70000,L:50},'1,4':{gold:90000,L:55},'4,2':{gold:120000,L:60},'2,4':{gems:150,L:65},'4,0':{gold:160000,L:70},'0,4':{gold:200000,L:75},
  '4,3':{gold:260000,L:80},'3,4':{gems:200,L:88},'4,4':{gold:350000,L:95}};
const RATION=(streak)=>Math.min(150,20+5*streak);
const MILESTONES=[[7,3],[14,5],[30,10],[60,15],[100,25]];
const SLOT7=7;                          /* серия дней подряд, за которую бесплатно открывается второе место в Инкубаторе */

/* ---------- уровни ----------
   Остров до 100-го уровня, кривая опыта прежняя (до 60-го ничего не сдвинулось). Предел драконов прежний до 9-го
   уровня острова (20-й), дальше растёт до 60-го к 80-му уровню острова. Мест под среды и фермы до 20-го уровня
   столько же, сколько было, дальше реже: место на карте конечно, новые участки открываются кольцами. */
const ISLE_MAX=100;
const xpFor=L=>L<=1?0:Math.round(30*Math.pow(L-1,1.9));
function levelOf(xp){let L=1;while(L<ISLE_MAX&&xp>=xpFor(L+1))L++;return L}
const maxHabs=L=>L<=20?3+Math.floor(L/2):13+Math.floor((L-20)/8);
const maxFarms=L=>L<=20?1+Math.floor((L+2)/3):8+Math.floor((L-20)/20);
const maxDragonLv=L=>L<=8?3+2*L:Math.min(DRAGON_MAX,20+Math.floor((L-9)*40/71));
/* кормление: до 20-го уровня прежняя цена, дальше от цены 20-го уровня +2,5 % за уровень (прежняя формула дала бы
   253 тысячи корма на 20→60, эта около 115 тысяч) */
const feedCost=lv=>lv<20?Math.round(4*Math.pow(lv,1.6))+1:Math.round((Math.round(4*Math.pow(20,1.6))+1)*(1+0.025*(lv-20)));
const FEEDS=4;
/* догоняющий рост: дракон на ECON.catchUp.gap уровней ниже самого сильного на острове ест вдвое дешевле.
   Опыт острова считается от заплаченного корма, поэтому бесконечного цикла опыта нет */
function feedPrice(s,d){const top=Math.max(0,...s.dragons.map(x=>x.lvl||1)),c=feedCost(d.lvl||1);
  return (d.lvl||1)+ECON.catchUp.gap<=top?{cost:Math.ceil(c*ECON.catchUp.k),full:c,catchUp:true}:{cost:c,full:c,catchUp:false}}
/* золото дракона за карточку растёт на 20 % за уровень до 20-го, дальше на 5 %: развитый дракон полезен, но доход не уходит в бесконечность */
const lvlGold=l=>l<=20?1+0.2*(l-1):4.8+0.05*(l-20);

/* ---------- доход за дни ----------
   days: {дата: карточек}, fz: замороженные дни (мутация), periods: [{from,to}], goal: 15, ev: {K} — точка перехода на новый доход.
   Возвращает K (часы острова), паёк корма и самоцветы за дни, рекорды серии и часы золота gk.
   gk(K) — сколько «карточек золота» набежало к моменту K: до точки перехода каждая карточка весит 1, после — ECON.goldX
   на ступень лесенки этой карточки в её дне. Сундук копит rate·(gk(K)−gk(k0)). Вес карточки не зависит от того,
   сколько карточек будет потом, поэтому переход на следующую ступень не пересчитывает прежние. */
const inP=(d,ps)=>(ps||[]).some(p=>d>=p.from&&(!p.to||d<=p.to));
function addDay(d,n){const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)}
const ID=K=>K;
/* вес карточек дня с номерами a+1…b (номер в дне), все после точки перехода */
function dayW(a,b){let w=0;for(let j=a+1;j<=b;j++)w+=ladderK(j);return w*ECON.goldX}
function clock(seg,evK){
  if(!isFinite(evK))return ID;
  /* seg: [K0, n] по дням в порядке времени; acc — часы золота к началу дня */
  const acc=[];let g=0;seg.forEach(([K0,n])=>{acc.push(g);g+=wIn(K0,n,n)});
  function wIn(K0,n,m){/* вес первых m карточек дня, который начался в K0 */
    const pre=Math.max(0,Math.min(m,evK-K0));return pre+(m>pre?dayW(pre,m):0)}
  return function gk(K){if(!seg.length||K<=seg[0][0])return K;
    let lo=0,hi=seg.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(seg[mid][0]<=K)lo=mid;else hi=mid-1}
    const [K0,n]=seg[lo],m=Math.min(n,K-K0),tail=K-K0-m;return seg[0][0]+acc[lo]+wIn(K0,n,m)+tail}}
function income(days,fz,periods,goal,ev){
  fz=fz||{};const ok=k=>(days[k]||0)>=goal,okx=k=>ok(k)||!!fz[k];
  const evK=ev&&typeof ev.K==='number'&&isFinite(ev.K)?ev.K:Infinity;
  const ks=[...new Set([...Object.keys(days),...Object.keys(fz)])].sort();
  let K=0,food=0,gems=0,run=0,prev=null,best=0,extra=0;const seg=[];
  ks.forEach(k=>{
    if(!okx(k)){run=0;prev=k;if(inP(k,periods)){const n=days[k]||0;if(n)seg.push([K,n]);K+=n}return}
    run=(prev&&addDay(prev,1)===k?run:0)+(ok(k)?1:0);prev=k;
    if(!inP(k,periods))return;
    const n=days[k]||0,K0=K;if(n)seg.push([K0,n]);K+=n;
    if(ok(k)){food+=RATION(run);gems+=1+Math.floor((n-goal)/goal);if(run>best)best=run;
      /* корм за карточки сверх цели: только после точки перехода, у каждой карточки свой множитель */
      let x=0;for(let j=goal+1;j<=n;j++)if(K0+j>evK)x+=ECON.foodX*ladderK(j);x=Math.floor(x);food+=x;extra+=x}
  });
  MILESTONES.forEach(([d,g])=>{if(best>=d)gems+=g});
  return {K,food,gems,best,extra,evK,gk:clock(seg,evK)}}
/* что даёт сегодняшний объём: для строки «Сегодня повторено N» */
function todayBonus(n,goal){goal=goal||15;const k=ladderK(n+1),nx=ladderNext(n);
  let food=0;for(let j=goal+1;j<=n;j++)food+=ECON.foodX*ladderK(j);
  let gold=0;for(let j=1;j<=n;j++)gold+=ladderK(j);
  return {n,k,next:nx,food:Math.floor(food),goldW:gold*ECON.goldX}}

/* ---------- начальное состояние ----------
   Гнездовье и Инкубатор (одно место для яйца) уже построены на стартовой земле. K — часы острова в момент создания:
   с него считается новый доход (evK) */
function startState(founders,K){
  const s={v:2,gv:G.GV,ev:1,evK:K||0,seq:3,bseq:6,bal:{gold:300,food:40,gems:5,xp:0},credited:{food:0,gems:0,lvl:1},land:growLand(START_LAND,1),
    bld:[
      {id:'b1',type:'F',x:4,y:5,lvl:1,chest:{amt:0,k0:null},build:null,up:null},
      {id:'b2',type:'W',x:6,y:5,lvl:1,chest:{amt:0,k0:null},build:null,up:null},
      {id:'b3',type:'farm',x:5,y:3,lvl:1,plots:[null,null],build:null,up:null},
      {id:'b4',type:'nest',x:2,y:4,lvl:1,pair:null,build:null,up:null},
      {id:'b5',type:'hatch',x:1,y:6,lvl:1,slots:[null],build:null,up:null}
    ],
    dragons:[],lay:1};
  arrange(s);
  (founders||[]).forEach(d=>{d=Object.assign({},d,{genome:G.upgrade(d.genome)});const ph=G.phenotype(d.genome),home=s.bld.find(b=>TYPES[b.type].kind==='hab'&&hosts(b.type,ph));
    s.dragons.push(Object.assign({lvl:1,fed:0,home:home?home.id:null},d))});
  return s}
/* место для базовой зоны на старом острове: ближайшая к середине свободная клетка открытой земли. Если места нет,
   бесплатно открывается соседний участок (у него свои препятствия, поэтому выбирается клетка без них) */
function zoneSpot(s0){
  const s=s0.bld?isle(s0,0):s0,cells=[];s.land.forEach(id=>{const [cx,cy]=id.split(',').map(Number);for(let i=0;i<CHUNK;i++)for(let j=0;j<CHUNK;j++)cells.push([cx*CHUNK+i,cy*CHUNK+j])});
  const mid=[6,6],d=c=>Math.hypot(c[0]-mid[0],c[1]-mid[1]);
  let ok=cells.filter(([x,y])=>canPlace(s,x,y)).sort((a,b)=>d(a)-d(b)||a[0]-b[0]||a[1]-b[1]);
  if(ok.length)return {x:ok[0][0],y:ok[0][1]};
  const near=Object.keys(LAND_COST).concat(allChunks()).filter((id,i,a)=>a.indexOf(id)===i&&!s.land.includes(id)&&adjacent(s,id)).sort();
  for(const id of near){s.land.push(id);const [cx,cy]=id.split(',').map(Number);
    for(let i=0;i<CHUNK-1;i++)for(let j=0;j<CHUNK-1;j++)if(canPlace(s,cx*CHUNK+i,cy*CHUNK+j))return {x:cx*CHUNK+i,y:cy*CHUNK+j,land:id};
    s.land.pop()}
  return null}

/* ---------- кто где может жить ---------- */
function dragonKeys(ph){return ph.breath==='element'?ph.elements:[ph.breath]}
function hosts(type,ph){const t=TYPES[type];return t.kind==='hab'&&dragonKeys(ph).some(k=>t.hosts.includes(k))}
const phOf=d=>G.phenotype(d.genome);
const rarOf=d=>G.rarity(phOf(d));
const goldPerCard=d=>goldRate(d);   /* прежнее имя: золото за карточку без удвоения и лесенки */

/* ---------- вспомогательное ---------- */
const clone=x=>JSON.parse(JSON.stringify(x));
const B=(s,id)=>s.bld.find(b=>b.id===id);
const ready=(job,K)=>!!job&&K-job.at+(job.skip||0)*SKIP_CARDS>=job.need;
const left=(job,K)=>job?Math.max(0,job.need-(K-job.at)-(job.skip||0)*SKIP_CARDS):0;
const built=b=>!b.build;
/* свободный подходящий дом для фенотипа и сколько малышей в яслях */
const homeFor=(s,ph)=>s.bld.find(b=>built(b)&&hosts(b.type,ph)&&s.dragons.filter(x=>x.home===b.id).length<habCap(b))||null;
const nursery=s=>s.dragons.filter(d=>d.nurs&&!d.home).length;
const habCap=b=>HAB_LV[b.lvl].cap,chestCap=b=>HAB_LV[b.lvl].chest;
/* мест для яиц: ступень Инкубатора плюс место за серию 7 дней (только у первого Инкубатора) */
const hatchCap=(s,b)=>HATCH_LV[b.lvl].slots+(s.slot7&&b.id===firstHatch(s)?1:0);
const firstHatch=s=>{const h=s.bld.find(b=>b.type==='hatch');return h?h.id:null};
const goldRate=d=>RAR_GOLD[rarOf(d)]*lvlGold(d.lvl||1);
function rate(s,b){if(TYPES[b.type].kind!=='hab'||!built(b))return 0;return s.dragons.filter(d=>d.home===b.id).reduce((x,d)=>x+goldRate(d),0)}
function level(s){return levelOf(s.bal.xp)}
function count(s,kind){return s.bld.filter(b=>TYPES[b.type].kind===kind).length}
/* сколько построек вида можно иметь: у Гнездовья и Инкубатора одна, вторая с more.L */
const maxOf=(t,L)=>t.max?t.max+(t.more&&L>=t.more.L?1:0):Infinity;
/* цена новой постройки растёт с числом уже стоящих: дома после 6-го на 22 % каждый, фермы после 3-й на 50 %, вторые Гнездовье и Инкубатор по more.cost */
function buildCost(s,type){const t=TYPES[type],n=count(s,t.kind);
  if(t.more&&n>=1)return {gold:t.more.cost,gems:t.gems||0,need:t.more.need};
  const k=t.kind==='hab'?Math.pow(1.22,Math.max(0,n-6)):t.kind==='farm'?Math.pow(1.5,Math.max(0,n-3)):1;
  return {gold:Math.round(t.cost*k/10)*10,gems:t.gems||0,need:Math.round(t.need*(1+Math.max(0,Math.log2(k))*0.3))}}

/* сундук: доначислить золото за карточки с прошлого раза (до вместимости). gk — часы золота из income */
/* часы золота, с которыми состояние приведено (normalize): неперечисляемое поле, в документ не пишется и при clone пропадает */
const gkOf=(s,gk)=>gk||(s&&s._gk)||ID;
function settleOne(s,b,K,gk){if(!b.chest)return;const c=b.chest;gk=gkOf(s,gk);
  if(c.k0==null||K<c.k0){c.k0=K;return}
  c.amt=Math.min(chestCap(b),c.amt+rate(s,b)*(gk(K)-gk(c.k0)));c.k0=K}
function settle(s,K,gk){s.bld.forEach(b=>settleOne(s,b,K,gk))}
const doneAt=job=>job.at+Math.max(0,job.need-(job.skip||0)*SKIP_CARDS);
function chestNow(s,b,K,gk){if(!b.chest)return 0;const c=b.chest;gk=gkOf(s,gk);if(c.k0==null||K<c.k0)return c.amt;return Math.min(chestCap(b),c.amt+rate(s,b)*(gk(K)-gk(c.k0)))}
/* золото дракона за следующую карточку сейчас: с удвоением и ступенью лесенки (n — карточек сегодня) */
const goldNow=(s,d,n)=>goldRate(d)*(s&&typeof s.evK==='number'?ECON.goldX*ladderK((n||0)+1):1);

/* приводим состояние к моменту K: дозачисляем доход за дни, заканчиваем стройки.
   inc.streakBest — лучшая серия на платформе (та же, что в «Карточках»): с 7 дней открывает второе место Инкубатора навсегда */
function normalize(s,K,inc,gk){
  s=clone(s);gk=gk||(inc&&inc.gk)||ID;
  if(inc){const df=inc.food-(s.credited.food||0),dg=inc.gems-(s.credited.gems||0);
    if(df>0){s.bal.food+=df;s.credited.food=inc.food}if(dg>0){s.bal.gems+=dg;s.credited.gems=inc.gems}
    /* бонус за ДЗ (inc.hw: сумма за все засчитанные задания): начисляется только прирост, своё поле учёта, не смешивается с серией */
    if(inc.hw){const hg=(inc.hw.gems|0)-(s.credited.hwg||0),hf=(inc.hw.food|0)-(s.credited.hwf||0);
      if(hg>0){s.bal.gems+=hg;s.credited.hwg=inc.hw.gems|0}if(hf>0){s.bal.food+=hf;s.credited.hwf=inc.hw.food|0}
      /* 4.4: ДЗ приносит и золото с опытом острова */
      const hgo=(inc.hw.gold|0)-(s.credited.hwgo||0),hx=(inc.hw.xp|0)-(s.credited.hwx||0);
      if(hgo>0){s.bal.gold+=hgo;s.credited.hwgo=inc.hw.gold|0}if(hx>0){s.bal.xp+=hx;s.credited.hwx=inc.hw.xp|0}}
    if(!s.slot7&&Math.max(inc.streakBest||0,inc.best||0)>=SLOT7){s.slot7=true;s.slot7new=true}}
  s.bld.forEach(b=>{
    /* момент готовности в часах острова: от него и считается сундук, даже если состояние сохранят позже */
    if(b.build&&ready(b.build,K)){const kc=doneAt(b.build);b.build=null;if(b.chest)b.chest={amt:0,k0:kc}}
    if(b.up&&ready(b.up,K)){const kc=doneAt(b.up);if(b.chest)settleOne(s,b,kc,gk);b.lvl=b.up.to;b.up=null;if(b.plots)while(b.plots.length<FARM_LV[b.lvl].plots)b.plots.push(null)}
    /* ячейки Инкубатора только добавляются, занятые не трогаются */
    if(b.slots&&!b.build)while(b.slots.length<hatchCap(s,b))b.slots.push(null);
    /* 4.2: урожай на грядках готов сразу, в том числе посаженный до обновления */
    if(b.plots)b.plots.forEach(p=>{if(p&&p.need)p.need=0});
  });
  /* опыт за повторение: после точки перехода каждая карточка даёт опыт по лесенке дня (часы золота gk). Первый раз только
     запоминается отметка, поэтому прошлые карточки опыта задним числом не дают, а повтор normalize ничего не добавляет */
  if(inc&&typeof s.evK==='number'){const g=gk(K);if(typeof s.credited.cx!=='number')s.credited.cx=g;else if(g>s.credited.cx){xp(s,(g-s.credited.cx)*ECON.cardXp);s.credited.cx=g}}
  const L=level(s);if(L>(s.credited.lvl||1)){const L0=s.credited.lvl||1;s.bal.gems+=2*(L-L0);
    Object.entries(LVL_CHEST).forEach(([l,g])=>{if(+l>L0&&+l<=L)s.bal.gems+=g});s.credited.lvl=L}
  /* 4.2: земля растёт сама с уровнем, на обоих островах */
  s.land=growLand(s.land,L);if(s.isl2)s.isl2.land=growLand(s.isl2.land,L);
  /* 4.2: малыш из яслей сам заселяется, как только появился подходящий дом со свободным местом */
  s.dragons.forEach(d=>{if(!d.nurs||d.home)return;const h=homeFor(s,phOf(d));if(!h)return;settleOne(s,h,K,gk);d.home=h.id;delete d.nurs});
  if(gk!==ID)Object.defineProperty(s,'_gk',{value:gk,enumerable:false,configurable:true});
  return s}

/* ---------- проверка сохранения (этап 5) ----------
   Документ v2 из базы может быть неполным (его писала старая версия страницы) или испорченным. repair ничего не обнуляет молча:
   недостающие служебные поля дополняет (fix), а если испорчено то, что принадлежит игроку (драконы, постройки, числа баланса),
   возвращает список bad: тогда остров показывается только для чтения и ничего не записывается, пока учитель не посмотрит.
   Учтённый доход (credited) без значения берётся равным текущему, чтобы старый доход не начислился второй раз. */
function repair(d,inc){const fix=[],bad=[];
  if(!d||typeof d!=='object'||d.v!==2)return {s:null,fix,bad:['документ не версии 2']};
  const s=clone(d),num=v=>typeof v==='number'&&isFinite(v)&&v>=0,int=v=>Number.isInteger(v)&&v>=0;
  if(!s.bal||typeof s.bal!=='object'||Array.isArray(s.bal)){bad.push('нет баланса');s.bal={}}
  ['gold','food','gems','xp'].forEach(k=>{if(s.bal[k]===undefined){s.bal[k]=0;fix.push('баланс: '+k+' = 0')}else if(!num(s.bal[k]))bad.push('баланс: '+k)});
  if(!s.credited||typeof s.credited!=='object'){s.credited={};fix.push('учтённый доход')}
  ['food','gems'].forEach(k=>{if(!num(s.credited[k])){s.credited[k]=inc?inc[k]:0;fix.push('учтённый доход: '+k)}});
  if(!int(s.credited.lvl)||s.credited.lvl<1){s.credited.lvl=num(s.bal.xp)?levelOf(s.bal.xp):1;fix.push('учтённый уровень')}
  if(!Array.isArray(s.land)||!s.land.length){s.land=START_LAND.slice();fix.push('земля')}else{const n=s.land.length;s.land=s.land.filter(x=>typeof x==='string');if(s.land.length<n)fix.push('земля')}
  if(s.clr!==undefined&&!Array.isArray(s.clr)){s.clr=[];fix.push('расчищенные клетки')}
  if(s.isl2!==undefined&&(!s.isl2||typeof s.isl2!=='object'||!Array.isArray(s.isl2.land)||!s.isl2.land.length||s.isl2.land.some(x=>typeof x!=='string')))bad.push('Огненный остров');
  if(s.pvr!==undefined&&(!s.pvr||typeof s.pvr!=='object'||!int(s.pvr.n))){delete s.pvr;fix.push('счётчик наград похода')}
  /* 4.4: задания недели и подарки за ДЗ — служебные поля, испорченные сбрасываются (награды недели можно будет забрать снова только за новую неделю) */
  if(s.wq!==undefined&&(!s.wq||typeof s.wq!=='object'||typeof s.wq.w!=='string'||!s.wq.c||typeof s.wq.c!=='object'||!Array.isArray(s.wq.got))){delete s.wq;fix.push('задания недели')}
  if(s.hwgift!==undefined&&!(Array.isArray(s.hwgift)&&s.hwgift.every(x=>typeof x==='string'))){bad.push('подарки за ДЗ')}
  if(s.pz!==undefined&&(!s.pz||typeof s.pz!=='object'||typeof s.pz.d!=='string'||!Array.isArray(s.pz.done))){delete s.pz;fix.push('головоломки дня')}
  /* геномы версии 1 (до гена E2): у драконов, яиц, пар в Гнездовье и в архиве отпущенных добавляется E2 = 0/0.
     Фенотип, остальные аллели и исход уже сформированных яиц не меняются, повторный проход ничего не делает */
  let up=0;const upg=o=>{if(o&&G.isOld(o.genome)){o.genome=G.upgrade(o.genome);up++}};
  (Array.isArray(s.dragons)?s.dragons:[]).forEach(upg);(Array.isArray(s.gone)?s.gone:[]).forEach(upg);
  (Array.isArray(s.bld)?s.bld:[]).forEach(b=>{if(!b)return;(Array.isArray(b.slots)?b.slots:[]).forEach(upg);if(b.pair&&b.pair.egg)upg(b.pair.egg)});
  if(up){fix.push('геномы: добавлен ген E2 = 0/0 ('+up+')')}
  if(s.gv!==G.GV&&(up||s.gv===undefined)){s.gv=G.GV}
  if(!Array.isArray(s.bld)){bad.push('постройки');s.bld=[]}
  /* задание (стройка, улучшение, грядка, пара, яйцо): момент начала и длина в карточках */
  const jobOk=j=>j&&typeof j==='object'&&num(j.at)&&num(j.need)&&(j.skip===undefined||int(j.skip));
  const geneOk=g=>!!g&&typeof g==='object'&&!G.validate(g).length;
  const bids=new Set(),dids=new Set();
  s.bld.forEach((b,i)=>{const t=b&&TYPES[b.type],nm='постройка '+(b&&b.id||i+1);
    if(!t||typeof b.id!=='string'||!int(b.x)||!int(b.y)){bad.push(nm);return}
    if(bids.has(b.id)){bad.push(nm+': повтор номера');return}bids.add(b.id);
    if(b.x+2>GRID||b.y+2>GRID){bad.push(nm+': вне карты');return}
    if(b.isl!==undefined&&!(b.isl===1&&s.isl2)){bad.push(nm+': остров');return}
    if(b.lvl===undefined){b.lvl=1;fix.push(nm+': уровень')}
    const T=lvTable(b.type),top=T?T.length-1:1;
    if(!int(b.lvl)||b.lvl<1||b.lvl>top){bad.push(nm+': уровень '+b.lvl+' (бывает 1–'+top+')');return}
    if(b.build!=null&&!jobOk(b.build))bad.push(nm+': стройка');
    if(b.up!=null&&(!jobOk(b.up)||b.up.to!==b.lvl+1||b.up.to>top))bad.push(nm+': улучшение');
    if(t.kind==='hab'){if(!b.chest||typeof b.chest!=='object'){b.chest={amt:0,k0:null};fix.push(nm+': сундук')}
      else if(!num(b.chest.amt)||!(b.chest.k0===null||num(b.chest.k0)))bad.push(nm+': сундук')}
    if(t.kind==='farm'){if(!Array.isArray(b.plots)){b.plots=Array(FARM_LV[b.lvl].plots).fill(null);fix.push(nm+': грядки')}
      else if(b.plots.length>FARM_LV[top].plots||b.plots.some(p=>p!==null&&(!jobOk(p)||!CROPS[p.crop])))bad.push(nm+': грядки')}
    if(t.kind==='hatch'){if(!Array.isArray(b.slots)){b.slots=Array(HATCH_LV[b.lvl].slots+1).fill(null);fix.push(nm+': ячейки')}
      else if(b.slots.length>HATCH_LV[top].slots+1)bad.push(nm+': ячейки');
      else b.slots.forEach((e,k)=>{if(e!==null&&(!jobOk(e)||!geneOk(e.genome)||typeof e.viable!=='boolean'))bad.push(nm+': яйцо в ячейке '+(k+1))})}
    if(t.kind==='nest'){if(b.pair===undefined)b.pair=null;
      else if(b.pair!==null&&(!jobOk(b.pair)||typeof b.pair.m!=='string'||typeof b.pair.f!=='string'||!b.pair.egg||!geneOk(b.pair.egg.genome)))bad.push(nm+': пара и яйцо')}});
  if(!Array.isArray(s.dragons)){bad.push('драконы');s.dragons=[]}
  s.dragons.forEach((x,i)=>{const nm='дракон '+(x&&x.name||i+1);
    if(!x||typeof x.id!=='string'||!geneOk(x.genome)){bad.push(nm);return}
    if(dids.has(x.id)){bad.push(nm+': повтор номера');return}dids.add(x.id);
    if(x.lvl===undefined){x.lvl=1;fix.push(nm+': уровень')}else if(!int(x.lvl)||x.lvl<1||x.lvl>DRAGON_MAX)bad.push(nm+': уровень');
    if(!int(x.fed)){x.fed=0;fix.push(nm+': кормления')}
    if(x.home===undefined)x.home=null;
    /* дом, которого нет или который не дом: дракон не теряется, он переходит в ясли и ждёт переселения */
    else if(x.home!==null){const h=s.bld.find(b=>b&&b.id===x.home);if(!h||!TYPES[h.type]||TYPES[h.type].kind!=='hab'){x.home=null;x.nurs=true;fix.push(nm+': дом не найден, в яслях')}}});
  const ids=a=>Math.max(0,...a.map(z=>+String(z&&z.id||'').replace(/\D/g,'')||0))+1;
  if(!int(s.seq)){s.seq=ids(s.dragons);fix.push('счётчик драконов')}else s.seq=Math.max(s.seq,ids(s.dragons));
  if(!int(s.bseq)){s.bseq=ids(s.bld);fix.push('счётчик построек')}else s.bseq=Math.max(s.bseq,ids(s.bld));
  /* переход на экономику этапа D (один раз, повтор ничего не делает):
     - точка перехода evK = нынешние часы острова: удвоенное золото и лесенка только для карточек после неё;
     - Инкубатор, который уже стоял, сохраняет все места: второе место считается заработанным (slot7='legacy');
     - Гнездовье и Инкубатор, которые строились, достраиваются; которых не было, ставятся бесплатно на свободное место
       (при нехватке места открывается соседний участок). Купленные постройки не дублируются */
  if(!bad.length&&s.ev===undefined){s.ev=1;s.evK=inc&&typeof inc.K==='number'?inc.K:0;fix.push('экономика: новый доход с этой точки');
    const had=s.bld.find(b=>b.type==='hatch');if(had&&!s.slot7){s.slot7='legacy';fix.push('Инкубатор: прежние места сохранены')}
    ['nest','hatch'].forEach(type=>{const b=s.bld.find(x=>x.type===type);
      if(b){if(b.build){b.build=null;fix.push(TYPES[type].name+': достроено')}return}
      const p=zoneSpot(s);if(!p){fix.push(TYPES[type].name+': нет места');return}
      const id='b'+(s.bseq++);s.bld.push(type==='nest'?{id,type,x:p.x,y:p.y,lvl:1,pair:null,build:null,up:null}:{id,type,x:p.x,y:p.y,lvl:1,slots:[null],build:null,up:null});
      fix.push(TYPES[type].name+': поставлено'+(p.land?' на новом участке '+p.land:''))})}
  /* 4.2: один раз — земля по уровню и постройки по ячейкам с промежутками */
  if(!bad.length&&!s.lay){const L=levelOf(num(s.bal.xp)?s.bal.xp:0);s.land=growLand(s.land,L);if(s.isl2)s.isl2.land=growLand(s.isl2.land,L);
    const n=arrange(s);s.lay=1;if(n)fix.push('постройки расставлены по ячейкам: '+n)}
  return {s,fix,bad}}

/* ---------- место на карте ---------- */
const chunkOf=(x,y)=>Math.floor(x/CHUNK)+','+Math.floor(y/CHUNK);
const under=(s,x,y,skipId)=>s.bld.some(b=>b.id!==skipId&&x>=b.x&&x<b.x+2&&y>=b.y&&y<b.y+2);
/* препятствия: деревья и камни на свободной земле, как в оригинальной игре их расчищают за золото.
   Места постоянные (зерно от участка), в документе хранится только список расчищенных клеток s.clr.
   Середина острова чистая, на боковых участках по 3, на закрытых по 4: они видны и после расчистки участка. */
const OBST_KIND={tree:{name:'Дерево',gold:60,xp:8},bush:{name:'Куст',gold:30,xp:4},rock:{name:'Валун',gold:180,xp:20,gems:1}};
const OBST=(()=>{const out=[];
  for(let cx=0;cx<GRID/CHUNK;cx++)for(let cy=0;cy<GRID/CHUNK;cy++){const id=cx+','+cy;if(id==='1,1')continue;
    const r=G.rng('obst:'+id),n=START_LAND.includes(id)?3:4,used=new Set();
    for(let k=0;k<n;k++){let x,y,t=0;do{x=cx*CHUNK+Math.floor(r()*CHUNK);y=cy*CHUNK+Math.floor(r()*CHUNK);t++}while(used.has(x+','+y)&&t<20);
      used.add(x+','+y);const v=r();out.push({id:x+','+y,x,y,kind:v<0.5?'tree':v<0.75?'bush':'rock'})}}
  return out})();
const allChunks=()=>{const a=[];for(let cx=0;cx<GRID/CHUNK;cx++)for(let cy=0;cy<GRID/CHUNK;cy++)a.push(cx+','+cy);return a};
/* участок рядом с открытой землёй (по стороне, не по углу) */
function adjacent(s,id){const [cx,cy]=id.split(',').map(Number);return [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>s.land.includes((cx+a)+','+(cy+b)))}
/* можно ли сейчас открыть участок: есть цена, дорос остров, рядом открытая земля */
function landState(s,id){if(s.land.includes(id))return {ok:false,why:'Уже открыто'};return {ok:false,why:'Земля открывается сама с ростом острова'};
  const c=LAND_COST[id];if(!c)return {ok:false,why:'Этот участок не открыть'};
  if(c.L&&level(s)<c.L)return {ok:false,why:`Откроется на ${c.L}-м уровне острова`,L:c.L};
  if(!adjacent(s,id))return {ok:false,why:'Сначала откройте соседний участок'};return {ok:true,cost:c}}
/* какие участки рисовать: открытые, прежние 3×3 и новые, до которых дорос остров (с запасом в 10 уровней, чтобы было видно, что впереди).
   n — сторона рисунка в клетках (12, 16 или 20) */
/* сторона острова (4.2): только открытая земля, закрытых участков на рисунке нет. n — сторона в клетках (12, 16 или 20) */
function extent(s){let m=3;s.land.forEach(id=>{const [x,y]=id.split(',').map(Number);m=Math.max(m,x+1,y+1)});m=Math.min(m,GRID/CHUNK);return {chunks:m,n:m*CHUNK}}
/* Драконы 4.1: препятствий на островах больше нет, вся открытая земля свободна. OBST и s.clr остаются для старых сохранений */
const obstacles=s=>[];
function canPlace(s,x,y,skipId){
  if(x<0||y<0||x+2>GRID||y+2>GRID)return false;
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)if(!s.land.includes(chunkOf(x+dx,y+dy)))return false;
  const obs=obstacles(s);if(obs.some(o=>o.x>=x&&o.x<x+2&&o.y>=y&&o.y<y+2))return false;
  return !s.bld.some(b=>b.id!==skipId&&x<b.x+2&&b.x<x+2&&y<b.y+2&&b.y<y+2)}

/* ---------- разметка острова (Драконы 4.2) ----------
   Земля открывается сама кольцами: 4×4 участка (16 клеток) с начала, 5×5 с 12-го уровня, 6×6 с 30-го. Покупать участки не нужно.
   Постройки стоят в ячейках SLOT×SLOT: здание 2×2 и две клетки промежутка, левый верхний угол на SLOT0+4k. Поэтому здания
   не касаются и не наезжают друг на друга. Старые острова один раз расставляются по ячейкам (arrange, флаг s.lay) */
const RINGS=[{L:1,m:4},{L:12,m:5},{L:30,m:6}],SLOT=4,SLOT0=1;
/* сундук уровня (4.2): разовые самоцветы на уровнях, где раньше открывались платные участки и больше ничего нет */
const LVL_CHEST={65:15,73:15,95:25};
const ringM=L=>RINGS.filter(r=>L>=r.L).pop().m;
function growLand(land,L){const m=ringM(L),out=land.slice();for(let x=0;x<m;x++)for(let y=0;y<m;y++){const id=x+','+y;if(!out.includes(id))out.push(id)}return out}
const snap=v=>SLOT0+SLOT*Math.max(0,Math.round((v-SLOT0)/SLOT));
/* все ячейки острова-вида и свободные из них (skip — постройка, которую переносят) */
const onLand=(s,x,y)=>[0,1].every(dx=>[0,1].every(dy=>s.land.includes(chunkOf(x+dx,y+dy))));
function slots(s){const n=extent(s).n,out=[];for(let x=SLOT0;x+2<=n;x+=SLOT)for(let y=SLOT0;y+2<=n;y+=SLOT)if(onLand(s,x,y))out.push({x,y});return out}
const freeSlots=(s,skip)=>slots(s).filter(p=>canPlace(s,p.x,p.y,skip));
/* порядок расстановки: Гнездовье и Инкубатор в середине, вокруг дома по стихиям, фермы по краям */
const ORD=b=>{const k=TYPES[b.type].kind;return k==='nest'?0:k==='hatch'?1:k==='hab'?2+HAB_ORDER.indexOf(b.type)/10:k==='farm'?4:5};
function arrange(s){let moved=0;const over=[];
  (s.isl2?[0,1]:[0]).forEach(i=>{const v=isle(s,i),n=extent(v).n,c=n/2-1;
    const sl=slots(v).sort((a,b)=>Math.hypot(a.x-c,a.y-c)-Math.hypot(b.x-c,b.y-c)||a.y-b.y||a.x-b.x);
    v.bld.slice().sort((a,b)=>ORD(a)-ORD(b)||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}))
      .forEach((b,k)=>{const p=sl[k];if(!p){over.push(b);b.x=-9;b.y=-9;return}if(b.x!==p.x||b.y!==p.y)moved++;b.x=p.x;b.y=p.y})});
  /* не влезли (бывает, если построек больше ячеек): на второй остров, если он открыт, иначе в ближайшее свободное место */
  over.forEach(b=>{const tryI=s.isl2&&!isleOf(b)?[1,0]:[isleOf(b)];
    for(const i of tryI){const v=isle(s,i),f=freeSlots(v,b.id)[0];if(f){b.x=f.x;b.y=f.y;if(i)b.isl=1;else delete b.isl;moved++;return}}
    const v=isle(s,isleOf(b)),n=extent(v).n;for(let x=0;x+2<=n;x++)for(let y=0;y+2<=n;y++)if(canPlace(v,x,y,b.id)){b.x=x;b.y=y;moved++;return}
    b.x=0;b.y=0});
  return moved}

/* ---------- второй остров (Драконы 4.1) ----------
   «Огненный остров» открывается с ISLE2.L-го уровня за золото. Сетка и участки как у первого острова, стартовая земля та же.
   Постройки на нём помечены isl:1, его земля в s.isl2.land. isle(s,i) — то же состояние, но с землёй и постройками одного острова:
   на нём работают canPlace, extent, landState и рисунок. Драконы, баланс и уровень общие */
const ISLE2={L:10,gold:3000,name:'Огненный остров'};
const isleOf=b=>b&&b.isl===1?1:0;
function isle(s,i){i=i===1&&s.isl2?1:0;const v=Object.assign({},s,{bld:s.bld.filter(b=>isleOf(b)===i),isl:i});if(i)v.land=s.isl2.land;return v}
const isleState=s=>s.isl2?{open:true}:level(s)<ISLE2.L?{open:false,ok:false,why:`Откроется на ${ISLE2.L}-м уровне острова`,L:ISLE2.L}:{open:false,ok:true,cost:{gold:ISLE2.gold}};

/* ---------- награда похода (Драконы 4.1) ----------
   Первая победа в бою даёт золото, корм и самоцветы по силе боя (rec): босс ×2,5, мини-босс ×1,8, элита ×1,5, у них же самоцветы.
   Первые три звезды в бою — ещё самоцвет. Повтор выигранного боя даёт пятую часть золота и корма, не больше PVE_DAY повторов в день,
   поэтому награду нельзя «нафармить». Чем сильнее бой, тем больше награда */
const PVE_DAY=5;
function pveGain(n,stars,before){const r=Math.max(1,Math.min(60,+n.rec||1)),k=n.boss?2.5:n.mini?1.8:n.elite?1.5:1,
    gold=Math.round(60*r*k/10)*10,food=Math.round(8*r*k);
  if(!before)return {gold,food,gems:(n.boss?3:n.mini||n.elite?1:0)+(stars>=3?1:0),first:true};
  return {gold:Math.round(gold/50)*10,food:Math.round(food/5),gems:stars>=3&&before<3?1:0,first:false}}

/* ---------- подарок за ДЗ на 95 %+ (4.4) ----------
   Редкий дракон из ДЗ или теста на 95 % и выше: из 40 генотипов с двумя стихиями берётся самый редкий, зерно — ученица и задание,
   поэтому подарок за одно задание всегда один и тот же. Забирается один раз (s.hwgift — список заданий) */
function hwGiftGenome(task,uid){let best=null,br=-1;
  for(let i=0;i<40;i++){const r=G.rng(String(uid||'')+':hwgift:'+task+':'+i),pick=a=>a[Math.floor(r()*a.length)],coin=(a,b)=>r()<0.5?a:b,pair=f=>f()+'/'+f();
    const els=['F','W','T','A','P','L','D'],e1=pick(els),e2=pick(els.filter(x=>x!==e1)),col=()=>{const x=r();return x<0.4?'C':x<0.75?'Cb':'c'},sex=coin('F','M');
    const spec={sex,S:'S/S',E:e1+'/'+e1,E2:e2+'/'+pick([e2,'0']),C:col()+'/'+col(),H:pair(()=>coin('H','h')),K:pair(()=>coin('K','k')),R:pair(()=>coin('R1','R2')),
      Wg:'+/+',Q1:pair(()=>coin('+','-')),Q2:pair(()=>coin('+','-')),Q3:pair(()=>coin('+','-'))};
    if(sex==='F'){spec.M=coin('M','m');spec.N=coin('n','N');spec.Sp=coin('Sp','sp');spec.G=coin('G','g')}else{spec.M=pair(()=>coin('M','m'));spec.N=pair(()=>coin('n','N'))}
    const g=G.make(spec),rr=G.rarity(G.phenotype(g));if(rr>br){br=rr;best=g}}
  return best}

/* ---------- задания недели (4.4) ----------
   Три задания на неделю (понедельник–воскресенье по дате острова): карточки, ДЗ на 85 %+ и одно из остальных по номеру недели.
   Карточки и ДЗ считаются по данным страницы (ctx.inc.week), действия на острове — счётчиками s.wq.c. Награда забирается кнопкой, один раз */
const WQ={
  cards1:{t:'Повтори 150 карточек за неделю',goal:150,src:'cards',r:{gold:600,gems:3}},
  cards2:{t:'Повтори 300 карточек за неделю',goal:300,src:'cards',r:{gold:1200,gems:5}},
  hw:{t:'Сдай ДЗ или тест на 85 % и выше',goal:1,src:'hw',r:{gems:5,food:200}},
  feed:{t:'Покорми драконов 12 раз',goal:12,src:'feed',r:{gold:400,gems:2}},
  harvest:{t:'Собери урожай 8 раз',goal:8,src:'harvest',r:{gold:350,gems:2}},
  win:{t:'Победи в 5 боях похода',goal:5,src:'win',r:{gold:500,gems:2}},
  hatch:{t:'Вылупи малыша в Инкубаторе',goal:1,src:'hatch',r:{gems:4,food:150}},
  breed:{t:'Скрести пару в Гнездовье',goal:1,src:'breed',r:{gold:400,food:100}},
  pz:{t:'Реши 5 головоломок',goal:5,src:'pz',r:{gold:500,gems:3}}};
const WQ_EXTRA=['feed','harvest','win','hatch','breed','pz'];
/* понедельник недели (ГГГГ-ММ-ДД) для даты */
function weekOf(day){const d=new Date((day||'1970-01-01')+'T12:00:00Z'),k=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-k);return d.toISOString().slice(0,10)}
function wqList(s,day){const w=weekOf(day),n=Math.round(Date.parse(w+'T12:00:00Z')/604800000);return [level(s)<10?'cards1':'cards2','hw',WQ_EXTRA[((n%WQ_EXTRA.length)+WQ_EXTRA.length)%WQ_EXTRA.length]]}
function wqState(s,day){const w=weekOf(day);return s.wq&&s.wq.w===w?s.wq:{w,c:{},got:[]}}
function wqProgress(s,c,id){const q=WQ[id],st=wqState(s,c.today),wk=c.inc&&c.inc.week||{};
  const v=q.src==='cards'?wk.cards||0:q.src==='hw'?wk.hw85||0:st.c[q.src]||0;return {v:Math.min(v,q.goal),goal:q.goal,done:v>=q.goal,got:st.got.includes(id)}}
const WQ_ACT={feed:'feed',harvest:'harvest',pvewin:'win',hatch:'hatch',breed:'breed',puzzle:'pz'};
function wqCount(s,c,t){const k=WQ_ACT[t];if(!k||!c.today)return;const st=wqState(s,c.today);st.c[k]=(st.c[k]||0)+1;s.wq=st}

/* ---------- действия ----------
   apply(s, ctx, act) → {s} или {err}. ctx = {K, streak, uid, today}. s не меняется. */
function pay(s,cost){
  const c={gold:cost.gold||0,food:cost.food||0,gems:cost.gems||0};
  if(s.bal.gold<c.gold)return 'Не хватает золота';if(s.bal.food<c.food)return 'Не хватает корма';if(s.bal.gems<c.gems)return 'Не хватает самоцветов';
  s.bal.gold-=c.gold;s.bal.food-=c.food;s.bal.gems-=c.gems;return null}
/* опыт острова: до 20-го уровня как раньше, дальше каждое действие даёт меньше (кривая xpFor не меняется, уже набранные уровни не падают) */
const xpK=L=>L<=20?1:Math.pow(20/L,ECON.xpFall);
const xp=(s,n)=>{s.bal.xp+=Math.max(0,Math.round(n*xpK(levelOf(s.bal.xp))))};
const GK=c=>c&&(c.gk||(c.inc&&c.inc.gk))||ID;

const ACTS={
  build(s,c,{type,x,y,isl}){const i=isl===1?1:0;if(i&&!s.isl2)return ISLE2.name+' ещё не открыт';
    const t=TYPES[type];if(!t)return 'Нет такой постройки';if(t.soon)return 'Откроется в следующем обновлении';
    const L=level(s);if(L<t.unlock)return `Откроется на ${t.unlock}-м уровне острова`;
    if(t.kind==='hab'&&count(s,'hab')>=maxHabs(L))return 'На этом уровне больше сред обитания не построить';
    if(t.kind==='farm'&&count(s,'farm')>=maxFarms(L))return 'На этом уровне больше ферм не построить';
    if(t.max&&count(s,t.kind)>=maxOf(t,L))return t.more&&L<t.more.L?`${t.name} на острове уже есть, второе откроется на ${t.more.L}-м уровне острова`:`${t.name} на острове уже есть`;
    x=snap(x);y=snap(y);if(!canPlace(isle(s,i),x,y))return 'Сюда не поставить';
    const bc=buildCost(s,type),e=pay(s,{gold:bc.gold,gems:bc.gems});if(e)return e;
    const id='b'+(s.bseq++);
    const b={id,type,x,y,lvl:1,build:{at:c.K,need:bc.need,skip:0},up:null};if(i)b.isl=1;
    if(t.kind==='hab')b.chest={amt:0,k0:null};if(t.kind==='farm')b.plots=[null,null];if(t.kind==='hatch')b.slots=Array(HATCH_LV[1].slots).fill(null);if(t.kind==='nest')b.pair=null;
    s.bld.push(b);xp(s,bc.gold/10);s.last=id},
  move(s,c,{id,x,y}){const b=B(s,id);if(!b)return 'Нет постройки';x=snap(x);y=snap(y);if(!canPlace(isle(s,isleOf(b)),x,y,id))return 'Сюда не поставить';b.x=x;b.y=y},
  /* расставить постройки по ячейкам заново (кнопка в «Мои постройки») */
  arrange(s,c){if(!arrange(s))return 'Постройки уже стоят по ячейкам'},
  upgrade(s,c,{id}){const b=B(s,id);if(!b)return 'Нет постройки';if(b.build||b.up)return 'Уже строится';
    const T=lvTable(b.type);if(!T)return 'Не улучшается';
    const nx=T[b.lvl+1];if(!nx)return 'Уже максимальный уровень';
    if(nx.L&&level(s)<nx.L)return `${b.lvl+1}-й уровень откроется на ${nx.L}-м уровне острова`;
    if(b.type==='hatch'&&b.lvl===1&&!s.slot7)return `Сначала откройте второе место серией ${SLOT7} дней подряд`;
    const e=pay(s,{gold:nx.cost});if(e)return e;settle(s,c.K,GK(c));b.up={at:c.K,need:nx.need,skip:0,to:b.lvl+1};xp(s,nx.cost/10)},
  speed(s,c,{id,plot}){const b=B(s,id);if(!b)return 'Нет постройки';
    const job=plot!=null?(b.plots||b.slots||[])[plot]:b.build||b.up||(b.pair&&!b.build?b.pair:null);if(!job)return 'Нечего ускорять';
    const n=Math.ceil(left(job,c.K)/SKIP_CARDS);if(!n)return 'Уже готово';const e=pay(s,{gems:n});if(e)return e;job.skip=(job.skip||0)+n},
  collect(s,c,{id}){const b=B(s,id);if(!b||!b.chest)return 'Нет сундука';settle(s,c.K,GK(c));const a=Math.floor(b.chest.amt);if(!a)return 'Сундук пуст';
    s.bal.gold+=a;b.chest.amt-=a;s.got={gold:a}},
  plant(s,c,{id,plot,crop}){const b=B(s,id),cr=CROPS[crop];if(!b||!b.plots||b.build)return 'Ферма не готова';if(!cr)return 'Нет такой культуры';
    if(level(s)<cr.unlock)return `Откроется на ${cr.unlock}-м уровне острова`;
    if(b.plots[plot]===undefined)return 'Нет грядки';if(b.plots[plot])return 'Грядка занята';
    const e=pay(s,{gold:cr.cost});if(e)return e;b.plots[plot]={crop,at:c.K,need:0,skip:0}},   /* 4.2: урожай готов сразу после посадки */
  harvest(s,c,{id,plot}){const b=B(s,id),p=b&&b.plots&&b.plots[plot];if(!p)return 'Пусто';if(!ready(p,c.K))return 'Ещё не созрело';
    const f=Math.round(CROPS[p.crop].food*streakMult(c.streak));s.bal.food+=f;b.plots[plot]=null;xp(s,f/10);s.got={food:f}},
  feed(s,c,{dragon}){const d=s.dragons.find(x=>x.id===dragon);if(!d)return 'Нет дракона';
    if(d.lvl>=maxDragonLv(level(s)))return `Дальше ${d.lvl}-го уровня откроется с ростом острова`;
    const {cost}=feedPrice(s,d),e=pay(s,{food:cost});if(e)return e;settle(s,c.K,GK(c));
    d.fed=(d.fed||0)+1;xp(s,cost/4);if(d.fed>=FEEDS){d.lvl++;d.fed=0;s.lvup=d.id}},
  place(s,c,{dragon,home}){const d=s.dragons.find(x=>x.id===dragon),b=B(s,home);if(!d||!b)return 'Нет дракона или здания';
    if(!hosts(b.type,phOf(d)))return 'Этому дракону здесь не жить';if(b.build)return 'Здание ещё строится';
    if(d.home===b.id)return null;if(s.dragons.filter(x=>x.home===b.id).length>=habCap(b))return 'Здесь нет места';
    settle(s,c.K,GK(c));d.home=b.id;delete d.nurs},
  buy(s,c,{type}){const t=TYPES[type];if(!t||!t.price)return 'Такого дракона на рынке нет';if(level(s)<t.unlock)return `Откроется на ${t.unlock}-м уровне острова`;
    const home=s.bld.find(b=>b.type===type&&built(b)&&s.dragons.filter(x=>x.home===b.id).length<habCap(b));
    if(!home)return `Сначала нужен дом со свободным местом: ${t.name}`;
    const e=pay(s,{gold:t.price});if(e)return e;settle(s,c.K,GK(c));
    const id='d'+(s.seq++),genome=marketGenome(type,c.uid+':'+id);
    s.dragons.push({id,name:NAMES[type][Math.floor(G.rng(c.uid+':n:'+id)()*NAMES[type].length)],born:c.today,genome,lvl:1,fed:0,home:home.id,from:'market'});xp(s,20);s.last=id},
  clear(s,c,{cell}){const o=obstacles(s).find(z=>z.id===cell);if(!o)return 'Препятствий на острове больше нет';if(!o)return 'Здесь нечего расчищать';const k=OBST_KIND[o.kind];
    const e=pay(s,{gold:k.gold});if(e)return e;s.clr=(s.clr||[]).concat(o.id);xp(s,k.xp);if(k.gems)s.bal.gems+=k.gems;s.got={clear:o.kind,gems:k.gems||0}},
  expand(s,c,{chunk,isl}){return 'Земля открывается сама с ростом острова';const i=isl===1?1:0;if(i&&!s.isl2)return ISLE2.name+' ещё не открыт';const q=landState(isle(s,i),chunk);if(!q.ok)return q.why;
    const e=pay(s,{gold:q.cost.gold,gems:q.cost.gems});if(e)return e;(i?s.isl2.land:s.land).push(chunk);xp(s,50+(q.cost.gold||0)/40+(q.cost.gems||0)*10)},
  /* скрещивание: яйцо считается сразу от генотипов родителей (мейоз, кроссинговер, мутации) с зерном,
     поэтому одно и то же скрещивание нельзя «перебросить»; результат скрыт до вылупления */
  breed(s,c,{id,mother,father,pred}){
    const b=B(s,id);if(!b||b.type!=='nest')return 'Нужно Гнездовье';if(b.build)return 'Гнездовье ещё строится';if(b.pair)return 'Гнездовье занято';
    const m=s.dragons.find(x=>x.id===mother),f=s.dragons.find(x=>x.id===father);
    if(!m||!f)return 'Выберите обоих родителей';if(m.genome.sex!=='F'||f.genome.sex!=='M')return 'Нужны самка и самец';
    if(m.lvl<BREED_LV||f.lvl<BREED_LV)return `Родители должны быть не ниже ${BREED_LV}-го уровня`;
    const e=pay(s,{gold:breedCost(rarOf(m),rarOf(f))});if(e)return e;
    const n=(s.eggs||0)+1;s.eggs=n;
    const egg=G.breed(m.genome,f.genome,G.rng(c.uid+':egg:'+n));
    const pr=judge(m,f,pred);
    b.pair={m:m.id,f:f.id,at:c.K,need:pr&&pr.ok?Math.ceil(BREED_NEED/2):BREED_NEED,skip:0,n,egg,pred:pr};
    if(pr&&pr.ok){s.bal.gems+=1;s.got={pred:pr}}else if(pr)s.got={pred:pr};
    xp(s,15)},
  egg(s,c,{id}){
    const b=B(s,id);if(!b||!b.pair)return 'Яйца нет';if(!ready(b.pair,c.K))return 'Яйцо ещё не готово';
    const h=s.bld.find(x=>x.type==='hatch'&&!x.build&&x.slots.some(z=>!z));if(!h)return 'Нужен Инкубатор со свободным местом';
    const p=b.pair,ph=p.egg.viable?G.phenotype(p.egg.genome):null,i=h.slots.findIndex(z=>!z);
    h.slots[i]={n:p.n,m:p.m,f:p.f,genome:p.egg.genome,viable:p.egg.viable,at:c.K,need:p.egg.viable?HATCH_NEED[G.rarity(ph)]:DEAD_NEED,skip:0,pred:p.pred||null};
    b.pair=null;s.last=h.id},
  hatch(s,c,{id,plot}){
    const h=B(s,id),eg=h&&h.slots&&h.slots[plot];if(!eg)return 'Яйца нет';if(!ready(eg,c.K))return 'Ещё не вылупился';
    s.log=s.log||[];
    const rec={n:eg.n,m:eg.m,f:eg.f,d:c.today,pred:eg.pred||null};
    if(!eg.viable){h.slots[plot]=null;rec.dead=true;s.log.push(rec);trimLog(s);s.got={dead:true};return}
    const ph=G.phenotype(eg.genome),home=homeFor(s,ph);
    const nc=nurseryCap(level(s));
    if(!home&&nursery(s)>=nc)return `Нет свободного дома (нужен дом: ${habNames(ph)}), и ясли заняты: ${nc} из ${nc}. Переселите малыша из яслей или освободите место`;
    settle(s,c.K,GK(c));
    const id2='d'+(s.seq++),mm=s.dragons.find(x=>x.id===eg.m),ff=s.dragons.find(x=>x.id===eg.f);
    const gen=1+Math.max((mm&&mm.gen)||0,(ff&&ff.gen)||0);
    s.dragons.push(Object.assign({id:id2,name:babyName(s,ph),born:c.today,genome:eg.genome,lvl:1,fed:0,home:home?home.id:null,parents:[eg.m,eg.f],gen,egg:eg.n},home?{}:{nurs:true}));
    h.slots[plot]=null;rec.child=id2;rec.ph=summary(ph);s.log.push(rec);trimLog(s);
    xp(s,25+15*G.rarity(ph));s.last=id2;s.got=home?{baby:id2}:{baby:id2,nursery:habNames(ph)}},
  release(s,c,{dragon}){const i=s.dragons.findIndex(x=>x.id===dragon);if(i<0)return 'Нет дракона';
    if(s.dragons.length<=2)return 'На острове должно остаться хотя бы два дракона';
    if(s.bld.some(b=>b.pair&&(b.pair.m===dragon||b.pair.f===dragon)))return 'Дракон сейчас в Гнездовье';
    settle(s,c.K,GK(c));const d=s.dragons[i];s.dragons.splice(i,1);s.bal.gold+=50*(1+rarOf(d));s.got={gold:50*(1+rarOf(d))};
    s.gone=(s.gone||[]).concat({id:d.id,name:d.name,genome:d.genome,parents:d.parents||null,gen:d.gen||0}).slice(-300)},
  /* увидела сообщение об открытом месте: событие больше не показывается, место остаётся */
  ack(s,c,{what}){if(what==='slot7'){if(!s.slot7new)return 'Нечего подтверждать';delete s.slot7new}else return 'Нечего подтверждать'},
  /* подарок похода: носитель гена E2 за первую победу в узле с gift (один раз на узел) */
  claim(s,c,{node}){const g=GIFTS[node];if(!g)return 'У этого боя нет подарка';s.gifts=s.gifts||{};if(s.gifts[node])return 'Подарок уже получен';
    const best=s.pve&&s.pve.best&&s.pve.best[node];if(!best)return 'Сначала победите в этом бою';
    const genome=giftGenome(node,c.uid),ph=G.phenotype(genome),home=homeFor(s,ph),nc=nurseryCap(level(s));
    if(!home&&nursery(s)>=nc)return `Нет дома (нужен: ${habNames(ph)}), и ясли заняты. Освободите место и заберите подарок`;
    settle(s,c.K,GK(c));const id='d'+(s.seq++);
    s.dragons.push(Object.assign({id,name:g.name,born:c.today,genome,lvl:1,fed:0,home:home?home.id:null,from:'gift:'+node},home?{}:{nurs:true}));
    s.gifts[node]=id;s.last=id;s.got=home?{baby:id}:{baby:id,nursery:habNames(ph)};xp(s,40)},
  /* цель исследования: разовая награда самоцветами, если условие выполнено */
  research(s,c,{goal}){const g=RESEARCH.find(x=>x.id===goal);if(!g)return 'Нет такой цели';s.goals=s.goals||{};if(s.goals[goal])return 'Награда уже получена';
    if(level(s)<g.L)return `Цель откроется на ${g.L}-м уровне острова`;if(!g.ok(s))return 'Цель ещё не выполнена';
    s.goals[goal]=c.today||'1';s.bal.gems+=g.gems;xp(s,g.xp||0);s.got={gems:g.gems}},
  /* открыть Огненный остров */
  isle2(s,c){const q=isleState(s);if(q.open)return ISLE2.name+' уже открыт';if(!q.ok)return q.why;
    const e=pay(s,q.cost);if(e)return e;s.isl2={land:growLand(START_LAND,level(s))};xp(s,100);s.got={isle2:true}},
  /* победа в походе: награда по pveGain. Звёзды до боя берутся из самого документа (s.pve), поэтому первая победа
     награждается один раз, даже если запись повторили */
  pvewin(s,c,{node,stars}){if(!node||typeof node.id!=='string'||!(stars>=1&&stars<=3))return 'Нет такого боя';
    const before=s.pve&&s.pve.best&&s.pve.best[node.id]||0,g=pveGain(node,stars,before),d=c.today||'';
    if(!g.first){if(!s.pvr||s.pvr.d!==d)s.pvr={d,n:0};if(s.pvr.n>=PVE_DAY){g.gold=0;g.food=0;g.cap=true}else s.pvr.n++}
    s.bal.gold+=g.gold;s.bal.food+=g.food;s.bal.gems+=g.gems;if(g.gold||g.gems)xp(s,g.gold/20+g.gems*5);s.got={pve:g}},
  /* подарок за ДЗ на 95 %+: задание должно быть в списке ДЗ этой ученицы (ctx.inc.hw.list) с яйцом */
  hwgift(s,c,{id}){const task=id;const h=c.inc&&c.inc.hw&&(c.inc.hw.list||[]).find(x=>x.id===task&&x.egg);if(!h)return 'За это задание подарка нет';
    s.hwgift=s.hwgift||[];if(s.hwgift.includes(task))return 'Подарок уже получен';
    const genome=hwGiftGenome(task,c.uid),ph=G.phenotype(genome),home=homeFor(s,ph),nc=nurseryCap(level(s));
    if(!home&&nursery(s)>=nc)return `Нет дома (нужен: ${habNames(ph)}), и ясли заняты. Освободите место и заберите подарок`;
    settle(s,c.K,GK(c));const nid='d'+(s.seq++);
    s.dragons.push(Object.assign({id:nid,name:'Отличник',born:c.today,genome,lvl:1,fed:0,home:home?home.id:null,from:'hw:'+task},home?{}:{nurs:true}));
    s.hwgift.push(task);s.last=nid;s.got=home?{baby:nid}:{baby:nid,nursery:habNames(ph)};xp(s,40)},
  /* головоломка дня (puzzles.js): задача строится заново из зерна (ученица + дата) и ответ сверяется с её единственным решением.
     За каждую из трёх — DRPZ.REWARD золота, не больше одного раза в день, то есть до 300 в день */
  puzzle(s,c,{kind,ans}){const PZ=root.DRPZ||(typeof require!=='undefined'?require('./puzzles.js'):null);if(!PZ)return 'Головоломки не загрузились';
    if(!PZ.KINDS.some(k=>k.kind===kind))return 'Нет такой головоломки';const d=c.today||'';s.pz=s.pz&&s.pz.d===d?s.pz:{d,done:[]};
    if(s.pz.done.includes(kind))return 'Эта головоломка сегодня уже решена';
    if(!PZ.check(kind,c.uid,d,ans))return 'Пока не сходится. Проверьте правила ещё раз';
    s.pz.done=s.pz.done.concat(kind);s.bal.gold+=PZ.REWARD;xp(s,20);s.got={pz:PZ.REWARD}},
  /* награда задания недели */
  wq(s,c,{id}){if(!WQ[id]||!wqList(s,c.today).includes(id))return 'Такого задания на этой неделе нет';const p=wqProgress(s,c,id);
    if(p.got)return 'Награда уже получена';if(!p.done)return `Ещё не выполнено: ${p.v} из ${p.goal}`;
    const st=wqState(s,c.today),r=WQ[id].r;st.got=st.got.concat(id);s.wq=st;s.bal.gold+=r.gold||0;s.bal.gems+=r.gems||0;s.bal.food+=r.food||0;xp(s,30);s.got={wq:r}},
  rename(s,c,{dragon,name}){const d=s.dragons.find(x=>x.id===dragon);if(!d)return 'Нет дракона';const n=String(name||'').trim().slice(0,24);if(!n)return 'Пустое имя';d.name=n}
};
function streakMult(st){return 1+Math.min(20,st||0)*0.025}
function lvTable(type){const k=TYPES[type].kind;return k==='hab'?HAB_LV:k==='farm'?FARM_LV:k==='hatch'?HATCH_LV:null}
const trimLog=s=>{if(s.log.length>600)s.log=s.log.slice(-600)};
const HAB_FOR={F:'Кальдера',W:'Лагуна',T:'Утёс',A:'Облачный шпиль',P:'Роща',L:'Храм рассвета',D:'Обсидиановая башня',smoke:'Пещера',dormant:'Пещера'};
const habNames=ph=>[...new Set(dragonKeys(ph).map(k=>HAB_FOR[k]))].join(' или ');
/* короткая запись фенотипа для журнала: по ней считаются расщепления */
function summary(ph){return {sex:ph.sex,el:ph.breath==='element'?ph.elements.join('+'):ph.breath,c:ph.color,h:ph.horns?1:0,k:ph.mace?1:0,r:ph.crest,sw:ph.shortWings?1:0,span:ph.span,m:ph.metal?1:0,n:ph.night?1:0,g:ph.glow?1:0,sp:ph.spurs?1:0}}
const BABY={F:['Искра','Жар','Пламя','Огонёк'],W:['Струя','Брызга','Прилив','Ручей'],T:['Камушек','Валун','Щебень'],A:['Ветерок','Пух','Смерч'],P:['Росток','Клевер','Папоротник'],L:['Заря','Луч'],D:['Мрак','Тень'],smoke:['Дымок','Пепел'],dormant:['Соня','Дрёма']};
function babyName(s,ph){const k=dragonKeys(ph)[0],pool=BABY[k]||BABY.smoke,n=s.dragons.filter(d=>d.egg).length+(s.gone||[]).length;
  const base=pool[n%pool.length],same=s.dragons.filter(d=>d.name===base||d.name.startsWith(base+' ')).length;return same?base+' '+(same+1):base}
/* прогноз: доля потомков с выбранным признаком; проверяется по настоящим генотипам родителей */
function judge(m,f,pred){
  if(!pred||!pred.trait||pred.value==null||pred.p==null||isNaN(pred.p))return null;
  const dist=G.dist(m.genome,f.genome,pred.trait),truth=dist[pred.value]||0,p=Math.max(0,Math.min(1,Number(pred.p)));
  return {trait:pred.trait,value:String(pred.value),p,truth,ok:Math.abs(p-truth)<=PRED_TOL}}
function apply(s,ctx,act){
  const fn=ACTS[act&&act.t];if(!fn)return {err:'Неизвестное действие'};
  const n=clone(s);delete n.got;delete n.lvup;delete n.last;
  const err=fn(n,ctx,act);if(err)return {err};
  wqCount(n,ctx,act.t);
  const L0=level(s),r=normalize(n,ctx.K,null,GK(ctx));
  return {s:r,levelUp:level(r)>L0?level(r):0}}

/* ---------- «Первый потомок»: шаги с настоящими числами ----------
   Каждый шаг: ok (выполнен), и данные, по которым интерфейс пишет, что сделать. next — первый невыполненный шаг.
   Ничего не меняет в состоянии. */
function feedsTo(d,lv){let n=0,food=0;for(let l=d.lvl;l<lv;l++){const k=FEEDS-(l===d.lvl?(d.fed||0):0);n+=k;food+=k*feedCost(l)}return {n,food}}
function breedPath(s,K){
  const L=level(s),rar=d=>G.rarity(G.phenotype(d.genome));
  const best=sex=>s.dragons.filter(d=>d.genome.sex===sex).sort((a,b)=>b.lvl-a.lvl||(b.fed||0)-(a.fed||0))[0]||null;
  const par=['F','M'].map(sex=>{const d=best(sex);return d?Object.assign({sex,id:d.id,name:d.name,lvl:d.lvl,ok:d.lvl>=BREED_LV,cost:feedPrice(s,d).cost},feedsTo(d,BREED_LV)):{sex,id:null,ok:false}});
  const bst=type=>{const b=s.bld.find(x=>x.type===type),t=TYPES[type];
    if(!b)return {type,state:L<t.unlock?'locked':'none',unlock:t.unlock,cost:t.cost,need:t.need,ok:false};
    if(b.build)return {type,id:b.id,state:ready(b.build,K)?'done':'build',left:left(b.build,K),ok:false};
    return {type,id:b.id,state:'ok',ok:true}};
  const nest=bst('nest'),hatch=bst('hatch');
  const nb=s.bld.find(x=>x.type==='nest'&&built(x)),hb=s.bld.find(x=>x.type==='hatch'&&built(x));
  const pair=nb&&nb.pair?{id:nb.id,ready:ready(nb.pair,K),left:left(nb.pair,K)}:null;
  const eggs=hb?hb.slots.map((e,i)=>e?{id:hb.id,plot:i,ready:ready(e,K),left:left(e,K),viable:e.viable,
    home:e.viable?!!homeFor(s,G.phenotype(e.genome)):true,habs:e.viable?habNames(G.phenotype(e.genome)):''}:null).filter(Boolean):[];
  const pm=par[0].id&&s.dragons.find(d=>d.id===par[0].id),pf=par[1].id&&s.dragons.find(d=>d.id===par[1].id);
  const cost=pm&&pf?breedCost(rar(pm),rar(pf)):breedCost(0,0);
  const child=(s.log||[]).find(r=>r.child)||null;
  /* Гнездовье и Инкубатор стоят с начала: шаг «построить» показывается, только если зоны почему-то не готовы */
  const steps=[
    {k:'parents',ok:par.every(p=>p.ok),par,lv:BREED_LV},
    ...(nest.ok&&hatch.ok?[]:[{k:'build',ok:false,nest,hatch}]),
    {k:'pair',ok:!!pair||eggs.length>0||!!child,cost,gold:Math.floor(s.bal.gold),need:BREED_NEED,can:!!nb&&par.every(p=>p.ok)&&s.bal.gold>=cost},
    {k:'egg',ok:eggs.length>0||!!child,pair},
    {k:'hatch',ok:!!child,eggs,free:nurseryCap(L)-nursery(s)}];
  const done=!!child,next=done?null:(steps.find(x=>!x.ok)||{}).k;
  return {done,next,steps,child}}

/* ---------- рынок: обычные драконы одной стихии со скрытой гетерозиготностью ---------- */
const NAMES={F:['Уголёк','Пыл','Зной','Искорка'],W:['Капель','Волна','Бриз','Омут'],N:['Дымок','Сумрак','Пепел'],T:['Гранит','Глыба','Кремень'],A:['Вихрь','Перо','Облачко'],P:['Лист','Мох','Побег']};
function marketGenome(type,seed){
  const r=G.rng(seed),coin=(a,b)=>r()<0.5?a:b,pair=f=>f()+'/'+f(),col=()=>{const x=r();return x<0.5?'C':x<0.8?'Cb':'c'};
  const sex=coin('F','M'),spec={sex,C:col()+'/'+col(),H:pair(()=>coin('H','h')),K:pair(()=>coin('K','k')),R:pair(()=>coin('R1','R2')),
    Wg:r()<0.1?'Wg/+':'+/+',Q1:pair(()=>coin('+','-')),Q2:pair(()=>coin('+','-')),Q3:pair(()=>coin('+','-'))};
  if(type==='N'){spec.E=coin('e/e','F/e');spec.S=spec.E==='e/e'?'S/'+coin('S','s'):'s/s'}
  else{spec.E=type+'/'+coin(type,'e');spec.S='S/'+coin('S','s')}
  if(sex==='F'){spec.M=r()<0.25?'M':'m';spec.N=r()<0.25?'n':'N';spec.Sp=coin('Sp','sp');spec.G=r()<0.2?'G':'g'}
  else{spec.M=pair(()=>r()<0.25?'M':'m');spec.N=pair(()=>r()<0.25?'n':'N')}
  return G.make(spec)}

/* ---------- подарки похода и цели исследования (этап D) ----------
   Подарок: молодой дракон-носитель гена E2 за первую победу в мини-боссе региона. Генотип задан узлом (стихии, пол),
   остальные гены от зерна uid+узел: у каждой ученицы свой, но одинаковый при повторе. Получить можно один раз на узел.
   Дальше E2 передаётся обычными гаметами при скрещивании. Старые драконы не меняются. */
const GIFTS={
  e7:{E:'F/e',E2:'T/0',sex:'F',name:'Каменка'},   t5:{E:'W/e',E2:'A/0',sex:'M',name:'Шквалик'},
  g5:{E:'P/e',E2:'T/0',sex:'F',name:'Корешок'},   s6:{E:'A/e',E2:'L/0',sex:'M',name:'Зарница'},
  m9:{E:'W/e',E2:'P/0',sex:'F',name:'Кувшинка'},  u9:{E:'T/e',E2:'A/0',sex:'M',name:'Бархан'},
  k9:{E:'F/e',E2:'T/0',sex:'M',name:'Окалина'},   r9:{E:'W/e',E2:'D/0',sex:'F',name:'Глубина'},
  a9:{E:'A/e',E2:'L/0',sex:'F',name:'Сполох'},    v9:{E:'D/e',E2:'L/0',sex:'M',name:'Рубеж'}};
function giftGenome(node,uid){const g=GIFTS[node],r=G.rng(String(uid||'')+':gift:'+node),coin=(a,b)=>r()<0.5?a:b,pair=f=>f()+'/'+f(),col=()=>{const x=r();return x<0.5?'C':x<0.8?'Cb':'c'};
  const spec={sex:g.sex,S:'S/S',E:g.E,E2:g.E2,C:col()+'/'+col(),H:pair(()=>coin('H','h')),K:pair(()=>coin('K','k')),R:pair(()=>coin('R1','R2')),
    Wg:'+/+',Q1:pair(()=>coin('+','-')),Q2:pair(()=>coin('+','-')),Q3:pair(()=>coin('+','-'))};
  if(g.sex==='F'){spec.M=r()<0.25?'M':'m';spec.N=r()<0.25?'n':'N';spec.Sp=coin('Sp','sp');spec.G=r()<0.2?'G':'g'}
  else{spec.M=pair(()=>r()<0.25?'M':'m');spec.N=pair(()=>r()<0.25?'n':'N')}
  return G.make(spec)}
const elsOf=d=>{const ph=phOf(d);return ph.breath==='element'?ph.elements:[]};
const E2I=G.CHROMS.A1.loci.indexOf('E2');
const hasE2=d=>{const a=d.genome&&d.genome.A1;return !!a&&a.some(h=>Array.isArray(h)&&h[E2I]!==undefined&&h[E2I]!=='0')};
const born=s=>(s.log||[]).filter(r=>r.child).length;
/* цели исследования: условие по острову и разовая награда самоцветами (поле s.goals, повторно не выдаётся) */
const RESEARCH=[
  {id:'hyb',L:5,gems:5,name:'Первый гибрид',text:'Вырастить или получить дракона с двумя стихиями',ok:s=>s.dragons.some(d=>elsOf(d).length>=2)},
  {id:'e2',L:10,gems:10,name:'Носитель E2',text:'Иметь на острове дракона, у которого ген E2 не 0/0',ok:s=>s.dragons.some(hasE2)},
  {id:'eggs10',L:16,gems:8,name:'Десять малышей',text:'Вывести 10 драконов из яиц',ok:s=>born(s)>=10},
  {id:'pred5',L:22,gems:10,name:'Точные прогнозы',text:'Пять прогнозов потомства с ошибкой не больше 3 пунктов',ok:s=>(s.log||[]).filter(r=>r.pred&&r.pred.ok).length>=5},
  {id:'tri',L:26,gems:15,name:'Три стихии',text:'Дракон с тремя стихиями (ген E и ген E2 вместе)',ok:s=>s.dragons.some(d=>elsOf(d).length>=3)},
  {id:'col8',L:33,gems:12,name:'Коллекция наборов',text:'Восемь разных наборов стихий на острове',ok:s=>new Set(s.dragons.map(d=>elsOf(d).slice().sort().join('+')||'—')).size>=8},
  {id:'lv30',L:42,gems:12,name:'Мастерство I',text:'Дракон 30-го уровня',ok:s=>s.dragons.some(d=>d.lvl>=30)},
  {id:'quad',L:48,gems:25,name:'Четыре стихии',text:'Дракон с четырьмя стихиями',ok:s=>s.dragons.some(d=>elsOf(d).length>=4)},
  {id:'gen5',L:58,gems:15,name:'Пятое поколение',text:'Дракон пятого поколения от основателей',ok:s=>s.dragons.some(d=>(d.gen||0)>=5)},
  {id:'lv45',L:68,gems:20,name:'Мастерство III',text:'Дракон 45-го уровня',ok:s=>s.dragons.some(d=>d.lvl>=45)},
  {id:'eggs60',L:78,gems:20,name:'Большой выводок',text:'Вывести 60 драконов из яиц',ok:s=>born(s)>=60},
  {id:'lv60',L:85,gems:30,name:'Предел роста',text:'Дракон 60-го уровня',ok:s=>s.dragons.some(d=>d.lvl>=60)},
  {id:'all7',L:90,gems:30,name:'Семь стихий',text:'На острове есть драконы каждой из семи стихий',ok:s=>{const a=new Set();s.dragons.forEach(d=>elsOf(d).forEach(e=>a.add(e)));return a.size>=7}},
  {id:'crown',L:100,gems:50,name:'Хранитель архипелага',text:'Остров 100-го уровня',ok:s=>level(s)>=100}];
/* мастерство дракона после 20-го уровня: подпись ступени, рисунок взрослого дракона дальше не растёт */
const MASTERY=['','Мастерство I','Мастерство II','Мастерство III','Мастерство IV'];
const mastery=l=>l<=20?0:Math.min(4,1+Math.floor((l-21)/10));

/* ---------- прогрессия: что открывает уровень острова ----------
   Список собирается из тех же правил, по которым работает игра: постройки, ступени улучшений, культуры, участки земли,
   ясли, вторые Гнездовье и Инкубатор, цели исследования, места и предел драконов. Таблица 1–100 в PROGRESSION-RU.md
   (dev/progression.js) и подсказка «что даст следующий уровень» берут его отсюда. Второстепенное начинается с «ещё» и «драконы растут». */
const plRu=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c};
function unlocksAt(L){const out=[];if(L<=1)return out;
  Object.entries(TYPES).forEach(([k,t])=>{if(t.unlock===L)out.push((t.kind==='hab'?'среда «':'постройка «')+t.name+'»')});
  Object.entries(TYPES).forEach(([k,t])=>{if(t.more&&t.more.L===L)out.push('второе здание «'+t.name+'»')});
  Object.values(CROPS).forEach(c=>{if(c.unlock===L)out.push('культура «'+c.name+'»')});
  Object.entries(TYPES).forEach(([k,t])=>{if(t.price&&t.unlock===L)out.push('на рынке драконы для среды «'+t.name+'»')});
  HAB_LV.forEach((x,i)=>{if(x&&x.L===L)out.push(`дома ${i}-го уровня: ${x.cap} ${plRu(x.cap,'дракон','дракона','драконов')}, сундук ${x.chest}`)});
  FARM_LV.forEach((x,i)=>{if(x&&x.L===L)out.push(`фермы ${i}-го уровня: ${x.plots} ${plRu(x.plots,'грядка','грядки','грядок')}`)});
  HATCH_LV.forEach((x,i)=>{if(x&&x.L===L)out.push(`Инкубатор ${i}-го уровня: ${x.slots} ${plRu(x.slots,'место','места','мест')} и место за серию`)});
  if(LVL_CHEST[L])out.push(`сундук уровня: +${LVL_CHEST[L]} 💎`);
  RINGS.forEach(r=>{if(r.L===L&&L>1)out.push(`остров растёт: земля ${r.m*CHUNK}×${r.m*CHUNK} клеток, новые ячейки под постройки`)});
  if(L===ISLE2.L)out.push(`${ISLE2.name}: второй остров за ${ISLE2.gold} золота`);
  if(nurseryCap(L)>nurseryCap(L-1))out.push('ясли на '+nurseryCap(L)+' '+plRu(nurseryCap(L),'место','места','мест'));
  RESEARCH.forEach(g=>{if(g.L===L)out.push('цель исследования «'+g.name+'» (+'+g.gems+' 💎)')});
  if(L===ISLE_MAX)out.push('звание «Хранитель архипелага»');
  if(maxHabs(L)>maxHabs(L-1))out.push('ещё одно место под среду обитания (всего '+maxHabs(L)+')');
  if(maxFarms(L)>maxFarms(L-1))out.push('ещё одна ферма (всего '+maxFarms(L)+')');
  if(maxDragonLv(L)>maxDragonLv(L-1))out.push('драконы растут до '+maxDragonLv(L)+'-го уровня');
  return out}
const MINOR=/^(ещё|драконы растут)/;
/* ближайший уровень после L, на котором открывается что-то кроме мест, ферм и предела драконов */
function nextMajor(L){for(let k=L+1;k<=ISLE_MAX;k++){const u=unlocksAt(k).filter(x=>!MINOR.test(x));if(u.length)return {L:k,list:u}}return null}

const DECO={DRAGON_MAX,ISLE_MAX,repair,unlocksAt,nextMajor,MINOR,NURSERY,nurseryCap,homeFor,nursery,breedPath,HATCH_LV,BREED_LV,breedCost,BREED_NEED,HATCH_NEED,PRED_TOL,lvTable,summary,habNames,TYPES,HAB_ORDER,HAB_LV,FARM_LV,CROPS,RAR_GOLD,SKIP_CARDS,GRID,CHUNK,START_LAND,LAND_COST,MILESTONES,FEEDS,RATION,
  ECON,ladderK,ladderNext,todayBonus,SLOT7,hatchCap,firstHatch,maxOf,buildCost,feedPrice,lvlGold,goldRate,goldNow,landState,adjacent,extent,allChunks,zoneSpot,GIFTS,giftGenome,RESEARCH,MASTERY,mastery,hasE2,
  xpFor,levelOf,maxHabs,maxFarms,maxDragonLv,feedCost,income,startState,hosts,dragonKeys,goldPerCard,rate,settle,chestNow,normalize,
  canPlace,chunkOf,apply,hwGiftGenome,WQ,wqList,wqProgress,wqState,weekOf,LVL_CHEST,RINGS,SLOT,SLOT0,snap,slots,freeSlots,arrange,growLand,ISLE2,isle,isleOf,isleState,PVE_DAY,pveGain,OBST,OBST_KIND,obstacles,ready,left,level,count,streakMult,marketGenome,habCap,chestCap};
if(typeof module!=='undefined'&&module.exports)module.exports=DECO;else root.DECO=DECO;
})(typeof window!=='undefined'?window:globalThis);
