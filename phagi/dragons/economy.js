/* Экономика острова драконов. Чистая логика без DOM: работает в браузере (window.DECO) и в node для тестов.
   Главное правило: время на острове идёт в карточках. Часы острова K = сколько карточек ученица повторила за дни,
   когда был включён режим драконов. Стройка, грядки и сундуки считают не минуты, а K.
   Состояние лежит в одном документе srs/<uid>/meta/dragons; доход за дни (паёк корма, самоцветы) не хранится,
   а выводится из счётчика карточек по дням и зачисляется разницей (credited), поэтому накрутить его нельзя. */
(function(root){
'use strict';
const G=root.DRG||(typeof require!=='undefined'?require('./genetics.js'):null);

/* ---------- каталог ---------- */
const HAB_LV=[null,{cap:2,chest:300},{cap:3,chest:900,cost:500,need:20},{cap:4,chest:2500,cost:1800,need:40}];
const FARM_LV=[null,{plots:2},{plots:3,cost:300,need:10},{plots:4,cost:1000,need:25}];
const HATCH_LV=[null,{slots:2},{slots:3,cost:600,need:15},{slots:4,cost:1800,need:30}];
/* скрещивание */
const DRAGON_MAX=20;                    /* предельный уровень дракона */
const BREED_LV=3;                       /* родители не ниже 3-го уровня */
const breedCost=(rm,rf)=>50*(1+rm+rf);
const BREED_NEED=10;                    /* пара в Гнездовье: карточек до яйца */
const HATCH_NEED=[8,14,22,32,45];       /* яйцо в Инкубаторе: карточек до вылупления по редкости */
const DEAD_NEED=4;
/* ясли при Инкубаторе: если подходящего дома нет (свет и тьма до 12-го уровня, все дома заняты), малыш живёт здесь.
   В яслях дракон не приносит золота, но его можно кормить, а когда появится дом, переселить. Геном не теряется. */
const NURSERY=2;
const PRED_TOL=0.03;                    /* прогноз верен, если ошибка не больше 3 процентных пунктов */
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
  nest:{name:'Гнездовье',kind:'nest',cost:400,need:15,unlock:3,max:1},
  hatch:{name:'Инкубатор',kind:'hatch',cost:300,need:12,unlock:3,max:1}
};
const HAB_ORDER=['F','W','N','T','A','P','L','D'];
const CROPS={
  ember:{name:'Огнеплодник',cost:20,need:5,food:24,unlock:1},
  pump:{name:'Драконья тыква',cost:90,need:15,food:120,unlock:2},
  vine:{name:'Звёздная лоза',cost:350,need:40,food:520,unlock:4}
};
const RAR_GOLD=[3,5,8,12,20];          /* золото за карточку у дракона 1-го уровня по редкости */
const SKIP_CARDS=10;                    /* один самоцвет заменяет 10 карточек ожидания */
const GRID=12,CHUNK=4;                  /* остров 12×12 клеток, земля открывается участками 4×4 */
const START_LAND=['1,1','0,1','1,0','2,1','1,2'];
const LAND_COST={'0,0':{gold:1500},'2,0':{gold:3000},'0,2':{gems:20},'2,2':{gems:40}};
const RATION=(streak)=>Math.min(150,20+5*streak);
const MILESTONES=[[7,3],[14,5],[30,10],[60,15],[100,25]];

/* ---------- уровни ---------- */
const xpFor=L=>L<=1?0:Math.round(30*Math.pow(L-1,1.9));
function levelOf(xp){let L=1;while(L<60&&xp>=xpFor(L+1))L++;return L}
const maxHabs=L=>3+Math.floor(L/2);
const maxFarms=L=>1+Math.floor((L+2)/3);
const maxDragonLv=L=>Math.min(20,3+2*L);
const feedCost=lv=>Math.round(4*Math.pow(lv,1.6))+1;
const FEEDS=4;

/* ---------- доход за дни ----------
   days: {дата: карточек}, fz: замороженные дни (мутация), periods: [{from,to}], goal: 15.
   Возвращает K (часы острова), паёк корма и самоцветы за дни и рекорды серии. */
const inP=(d,ps)=>(ps||[]).some(p=>d>=p.from&&(!p.to||d<=p.to));
function addDay(d,n){const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)}
function income(days,fz,periods,goal){
  fz=fz||{};const ok=k=>(days[k]||0)>=goal,okx=k=>ok(k)||!!fz[k];
  const ks=[...new Set([...Object.keys(days),...Object.keys(fz)])].sort();
  let K=0,food=0,gems=0,run=0,prev=null,best=0;
  ks.forEach(k=>{
    if(!okx(k)){run=0;prev=k;if(inP(k,periods))K+=days[k]||0;return}
    run=(prev&&addDay(prev,1)===k?run:0)+(ok(k)?1:0);prev=k;
    if(!inP(k,periods))return;
    const n=days[k]||0;K+=n;
    if(ok(k)){food+=RATION(run);gems+=1+Math.floor((n-goal)/goal);if(run>best)best=run}
  });
  MILESTONES.forEach(([d,g])=>{if(best>=d)gems+=g});
  return {K,food,gems,best}}

/* ---------- начальное состояние ---------- */
function startState(founders){
  const s={v:2,gv:G.GV,seq:3,bseq:4,bal:{gold:300,food:40,gems:5,xp:0},credited:{food:0,gems:0,lvl:1},land:START_LAND.slice(),
    bld:[
      {id:'b1',type:'F',x:4,y:5,lvl:1,chest:{amt:0,k0:null},build:null,up:null},
      {id:'b2',type:'W',x:6,y:5,lvl:1,chest:{amt:0,k0:null},build:null,up:null},
      {id:'b3',type:'farm',x:5,y:3,lvl:1,plots:[null,null],build:null,up:null}
    ],
    dragons:[]};
  (founders||[]).forEach(d=>{d=Object.assign({},d,{genome:G.upgrade(d.genome)});const ph=G.phenotype(d.genome),home=s.bld.find(b=>TYPES[b.type].kind==='hab'&&hosts(b.type,ph));
    s.dragons.push(Object.assign({lvl:1,fed:0,home:home?home.id:null},d))});
  return s}

/* ---------- кто где может жить ---------- */
function dragonKeys(ph){return ph.breath==='element'?ph.elements:[ph.breath]}
function hosts(type,ph){const t=TYPES[type];return t.kind==='hab'&&dragonKeys(ph).some(k=>t.hosts.includes(k))}
const phOf=d=>G.phenotype(d.genome);
const rarOf=d=>G.rarity(phOf(d));
const goldPerCard=d=>RAR_GOLD[rarOf(d)]*(1+0.2*((d.lvl||1)-1));

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
function rate(s,b){if(TYPES[b.type].kind!=='hab'||!built(b))return 0;return s.dragons.filter(d=>d.home===b.id).reduce((x,d)=>x+goldPerCard(d),0)}
function level(s){return levelOf(s.bal.xp)}
function count(s,kind){return s.bld.filter(b=>TYPES[b.type].kind===kind).length}

/* сундук: доначислить золото за карточки с прошлого раза (до вместимости) */
function settleOne(s,b,K){if(!b.chest)return;const c=b.chest;
  if(c.k0==null||K<c.k0){c.k0=K;return}
  c.amt=Math.min(chestCap(b),c.amt+rate(s,b)*(K-c.k0));c.k0=K}
function settle(s,K){s.bld.forEach(b=>settleOne(s,b,K))}
const doneAt=job=>job.at+Math.max(0,job.need-(job.skip||0)*SKIP_CARDS);
function chestNow(s,b,K){if(!b.chest)return 0;const c=b.chest;if(c.k0==null||K<c.k0)return c.amt;return Math.min(chestCap(b),c.amt+rate(s,b)*(K-c.k0))}

/* приводим состояние к моменту K: дозачисляем доход за дни, заканчиваем стройки */
function normalize(s,K,inc){
  s=clone(s);
  if(inc){const df=inc.food-(s.credited.food||0),dg=inc.gems-(s.credited.gems||0);
    if(df>0){s.bal.food+=df;s.credited.food=inc.food}if(dg>0){s.bal.gems+=dg;s.credited.gems=inc.gems}}
  s.bld.forEach(b=>{
    /* момент готовности в часах острова: от него и считается сундук, даже если состояние сохранят позже */
    if(b.build&&ready(b.build,K)){const kc=doneAt(b.build);b.build=null;if(b.chest)b.chest={amt:0,k0:kc}}
    if(b.up&&ready(b.up,K)){const kc=doneAt(b.up);if(b.chest)settleOne(s,b,kc);b.lvl=b.up.to;b.up=null;if(b.plots)while(b.plots.length<FARM_LV[b.lvl].plots)b.plots.push(null);if(b.slots)while(b.slots.length<HATCH_LV[b.lvl].slots)b.slots.push(null)}
  });
  const L=level(s);if(L>(s.credited.lvl||1)){s.bal.gems+=2*(L-(s.credited.lvl||1));s.credited.lvl=L}
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
    if(b.lvl===undefined){b.lvl=1;fix.push(nm+': уровень')}
    const T=lvTable(b.type),top=T?T.length-1:1;
    if(!int(b.lvl)||b.lvl<1||b.lvl>top){bad.push(nm+': уровень '+b.lvl+' (бывает 1–'+top+')');return}
    if(b.build!=null&&!jobOk(b.build))bad.push(nm+': стройка');
    if(b.up!=null&&(!jobOk(b.up)||b.up.to!==b.lvl+1||b.up.to>top))bad.push(nm+': улучшение');
    if(t.kind==='hab'){if(!b.chest||typeof b.chest!=='object'){b.chest={amt:0,k0:null};fix.push(nm+': сундук')}
      else if(!num(b.chest.amt)||!(b.chest.k0===null||num(b.chest.k0)))bad.push(nm+': сундук')}
    if(t.kind==='farm'){if(!Array.isArray(b.plots)){b.plots=Array(FARM_LV[b.lvl].plots).fill(null);fix.push(nm+': грядки')}
      else if(b.plots.length>FARM_LV[top].plots||b.plots.some(p=>p!==null&&(!jobOk(p)||!CROPS[p.crop])))bad.push(nm+': грядки')}
    if(t.kind==='hatch'){if(!Array.isArray(b.slots)){b.slots=Array(HATCH_LV[b.lvl].slots).fill(null);fix.push(nm+': ячейки')}
      else if(b.slots.length>HATCH_LV[top].slots)bad.push(nm+': ячейки');
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
const obstacles=s=>OBST.filter(o=>s.land.includes(chunkOf(o.x,o.y))&&!(s.clr||[]).includes(o.id)&&!under(s,o.x,o.y));
function canPlace(s,x,y,skipId){
  if(x<0||y<0||x+2>GRID||y+2>GRID)return false;
  for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)if(!s.land.includes(chunkOf(x+dx,y+dy)))return false;
  const obs=obstacles(s);if(obs.some(o=>o.x>=x&&o.x<x+2&&o.y>=y&&o.y<y+2))return false;
  return !s.bld.some(b=>b.id!==skipId&&x<b.x+2&&b.x<x+2&&y<b.y+2&&b.y<y+2)}

/* ---------- действия ----------
   apply(s, ctx, act) → {s} или {err}. ctx = {K, streak, uid, today}. s не меняется. */
function pay(s,cost){
  const c={gold:cost.gold||0,food:cost.food||0,gems:cost.gems||0};
  if(s.bal.gold<c.gold)return 'Не хватает золота';if(s.bal.food<c.food)return 'Не хватает корма';if(s.bal.gems<c.gems)return 'Не хватает самоцветов';
  s.bal.gold-=c.gold;s.bal.food-=c.food;s.bal.gems-=c.gems;return null}
const xp=(s,n)=>{s.bal.xp+=Math.max(0,Math.round(n))};

const ACTS={
  build(s,c,{type,x,y}){
    const t=TYPES[type];if(!t)return 'Нет такой постройки';if(t.soon)return 'Откроется в следующем обновлении';
    const L=level(s);if(L<t.unlock)return `Откроется на ${t.unlock}-м уровне острова`;
    if(t.kind==='hab'&&count(s,'hab')>=maxHabs(L))return 'На этом уровне больше сред обитания не построить';
    if(t.kind==='farm'&&count(s,'farm')>=maxFarms(L))return 'На этом уровне больше ферм не построить';
    if(t.max&&count(s,t.kind)>=t.max)return `${t.name} на острове уже есть`;
    if(!canPlace(s,x,y))return 'Сюда не поставить';
    const e=pay(s,{gold:t.cost,gems:t.gems});if(e)return e;
    const id='b'+(s.bseq++);
    const b={id,type,x,y,lvl:1,build:{at:c.K,need:t.need,skip:0},up:null};
    if(t.kind==='hab')b.chest={amt:0,k0:null};if(t.kind==='farm')b.plots=[null,null];if(t.kind==='hatch')b.slots=[null,null];if(t.kind==='nest')b.pair=null;
    s.bld.push(b);xp(s,t.cost/10);s.last=id},
  move(s,c,{id,x,y}){const b=B(s,id);if(!b)return 'Нет постройки';if(!canPlace(s,x,y,id))return 'Сюда не поставить';b.x=x;b.y=y},
  upgrade(s,c,{id}){const b=B(s,id);if(!b)return 'Нет постройки';if(b.build||b.up)return 'Уже строится';
    const T=lvTable(b.type);if(!T)return 'Не улучшается';
    const nx=T[b.lvl+1];if(!nx)return 'Уже максимальный уровень';
    const e=pay(s,{gold:nx.cost});if(e)return e;settle(s,c.K);b.up={at:c.K,need:nx.need,skip:0,to:b.lvl+1};xp(s,nx.cost/10)},
  speed(s,c,{id,plot}){const b=B(s,id);if(!b)return 'Нет постройки';
    const job=plot!=null?(b.plots||b.slots||[])[plot]:b.build||b.up||(b.pair&&!b.build?b.pair:null);if(!job)return 'Нечего ускорять';
    const n=Math.ceil(left(job,c.K)/SKIP_CARDS);if(!n)return 'Уже готово';const e=pay(s,{gems:n});if(e)return e;job.skip=(job.skip||0)+n},
  collect(s,c,{id}){const b=B(s,id);if(!b||!b.chest)return 'Нет сундука';settle(s,c.K);const a=Math.floor(b.chest.amt);if(!a)return 'Сундук пуст';
    s.bal.gold+=a;b.chest.amt-=a;s.got={gold:a}},
  plant(s,c,{id,plot,crop}){const b=B(s,id),cr=CROPS[crop];if(!b||!b.plots||b.build)return 'Ферма не готова';if(!cr)return 'Нет такой культуры';
    if(level(s)<cr.unlock)return `Откроется на ${cr.unlock}-м уровне острова`;
    if(b.plots[plot]===undefined)return 'Нет грядки';if(b.plots[plot])return 'Грядка занята';
    const e=pay(s,{gold:cr.cost});if(e)return e;b.plots[plot]={crop,at:c.K,need:cr.need,skip:0}},
  harvest(s,c,{id,plot}){const b=B(s,id),p=b&&b.plots&&b.plots[plot];if(!p)return 'Пусто';if(!ready(p,c.K))return 'Ещё не созрело';
    const f=Math.round(CROPS[p.crop].food*streakMult(c.streak));s.bal.food+=f;b.plots[plot]=null;xp(s,f/10);s.got={food:f}},
  feed(s,c,{dragon}){const d=s.dragons.find(x=>x.id===dragon);if(!d)return 'Нет дракона';
    if(d.lvl>=maxDragonLv(level(s)))return `Дальше ${d.lvl}-го уровня откроется с ростом острова`;
    const cost=feedCost(d.lvl),e=pay(s,{food:cost});if(e)return e;settle(s,c.K);
    d.fed=(d.fed||0)+1;xp(s,cost/4);if(d.fed>=FEEDS){d.lvl++;d.fed=0;s.lvup=d.id}},
  place(s,c,{dragon,home}){const d=s.dragons.find(x=>x.id===dragon),b=B(s,home);if(!d||!b)return 'Нет дракона или здания';
    if(!hosts(b.type,phOf(d)))return 'Этому дракону здесь не жить';if(b.build)return 'Здание ещё строится';
    if(d.home===b.id)return null;if(s.dragons.filter(x=>x.home===b.id).length>=habCap(b))return 'Здесь нет места';
    settle(s,c.K);d.home=b.id;delete d.nurs},
  buy(s,c,{type}){const t=TYPES[type];if(!t||!t.price)return 'Такого дракона на рынке нет';if(level(s)<t.unlock)return `Откроется на ${t.unlock}-м уровне острова`;
    const home=s.bld.find(b=>b.type===type&&built(b)&&s.dragons.filter(x=>x.home===b.id).length<habCap(b));
    if(!home)return `Сначала нужен дом со свободным местом: ${t.name}`;
    const e=pay(s,{gold:t.price});if(e)return e;settle(s,c.K);
    const id='d'+(s.seq++),genome=marketGenome(type,c.uid+':'+id);
    s.dragons.push({id,name:NAMES[type][Math.floor(G.rng(c.uid+':n:'+id)()*NAMES[type].length)],born:c.today,genome,lvl:1,fed:0,home:home.id,from:'market'});xp(s,20);s.last=id},
  clear(s,c,{cell}){const o=obstacles(s).find(z=>z.id===cell);if(!o)return 'Здесь нечего расчищать';const k=OBST_KIND[o.kind];
    const e=pay(s,{gold:k.gold});if(e)return e;s.clr=(s.clr||[]).concat(o.id);xp(s,k.xp);if(k.gems)s.bal.gems+=k.gems;s.got={clear:o.kind,gems:k.gems||0}},
  expand(s,c,{chunk}){if(s.land.includes(chunk))return 'Уже открыто';const cost=LAND_COST[chunk];if(!cost)return 'Этот участок не открыть';
    const e=pay(s,cost);if(e)return e;s.land.push(chunk);xp(s,50)},
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
    if(!home&&nursery(s)>=NURSERY)return `Нет свободного дома (нужен дом: ${habNames(ph)}), и ясли заняты: ${NURSERY} из ${NURSERY}. Переселите малыша из яслей или освободите место`;
    settle(s,c.K);
    const id2='d'+(s.seq++),mm=s.dragons.find(x=>x.id===eg.m),ff=s.dragons.find(x=>x.id===eg.f);
    const gen=1+Math.max((mm&&mm.gen)||0,(ff&&ff.gen)||0);
    s.dragons.push(Object.assign({id:id2,name:babyName(s,ph),born:c.today,genome:eg.genome,lvl:1,fed:0,home:home?home.id:null,parents:[eg.m,eg.f],gen,egg:eg.n},home?{}:{nurs:true}));
    h.slots[plot]=null;rec.child=id2;rec.ph=summary(ph);s.log.push(rec);trimLog(s);
    xp(s,25+15*G.rarity(ph));s.last=id2;s.got=home?{baby:id2}:{baby:id2,nursery:habNames(ph)}},
  release(s,c,{dragon}){const i=s.dragons.findIndex(x=>x.id===dragon);if(i<0)return 'Нет дракона';
    if(s.dragons.length<=2)return 'На острове должно остаться хотя бы два дракона';
    if(s.bld.some(b=>b.pair&&(b.pair.m===dragon||b.pair.f===dragon)))return 'Дракон сейчас в Гнездовье';
    settle(s,c.K);const d=s.dragons[i];s.dragons.splice(i,1);s.bal.gold+=50*(1+rarOf(d));s.got={gold:50*(1+rarOf(d))};
    s.gone=(s.gone||[]).concat({id:d.id,name:d.name,genome:d.genome,parents:d.parents||null,gen:d.gen||0}).slice(-300)},
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
  const L0=level(s),r=normalize(n,ctx.K,null);
  return {s:r,levelUp:level(r)>L0?level(r):0}}

/* ---------- «Первый потомок»: шаги с настоящими числами ----------
   Каждый шаг: ok (выполнен), и данные, по которым интерфейс пишет, что сделать. next — первый невыполненный шаг.
   Ничего не меняет в состоянии. */
function feedsTo(d,lv){let n=0,food=0;for(let l=d.lvl;l<lv;l++){const k=FEEDS-(l===d.lvl?(d.fed||0):0);n+=k;food+=k*feedCost(l)}return {n,food}}
function breedPath(s,K){
  const L=level(s),unlock=TYPES.nest.unlock,rar=d=>G.rarity(G.phenotype(d.genome));
  const best=sex=>s.dragons.filter(d=>d.genome.sex===sex).sort((a,b)=>b.lvl-a.lvl||(b.fed||0)-(a.fed||0))[0]||null;
  const par=['F','M'].map(sex=>{const d=best(sex);return d?Object.assign({sex,id:d.id,name:d.name,lvl:d.lvl,ok:d.lvl>=BREED_LV},feedsTo(d,BREED_LV)):{sex,id:null,ok:false}});
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
  const steps=[
    {k:'level',ok:L>=unlock,L,need:unlock,xp:s.bal.xp,xpNeed:xpFor(unlock)},
    {k:'parents',ok:par.every(p=>p.ok),par,lv:BREED_LV},
    {k:'build',ok:nest.ok&&hatch.ok,nest,hatch},
    {k:'pair',ok:!!pair||eggs.length>0||!!child,cost,gold:Math.floor(s.bal.gold),need:BREED_NEED,can:!!nb&&par.every(p=>p.ok)&&s.bal.gold>=cost},
    {k:'egg',ok:eggs.length>0||!!child,pair},
    {k:'hatch',ok:!!child,eggs,free:NURSERY-nursery(s)}];
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

/* ---------- прогрессия: что открывает уровень острова (этап 5 доработки) ----------
   Только описание существующих правил: числа здесь не меняются. Списки для подсказки «что даст следующий уровень»
   и для таблицы PROGRESSION-RU.md (dev/progression.js). */
function unlocksAt(L){const out=[];if(L<=1)return out;
  Object.entries(TYPES).forEach(([k,t])=>{if(t.unlock===L)out.push((t.kind==='hab'?'среда «':'постройка «')+t.name+'»')});
  Object.values(CROPS).forEach(c=>{if(c.unlock===L)out.push('культура «'+c.name+'»')});
  Object.entries(TYPES).forEach(([k,t])=>{if(t.price&&t.unlock===L)out.push('на рынке драконы для среды «'+t.name+'»')});
  if(maxHabs(L)>maxHabs(L-1))out.push('ещё одно место под среду обитания (всего '+maxHabs(L)+')');
  if(maxFarms(L)>maxFarms(L-1))out.push('ещё одна ферма (всего '+maxFarms(L)+')');
  if(maxDragonLv(L)>maxDragonLv(L-1))out.push('драконы растут до '+maxDragonLv(L)+'-го уровня');
  return out}
/* ближайший уровень после L, на котором открывается что-то кроме мест и ферм (до 60) */
function nextMajor(L){for(let k=L+1;k<=60;k++){const u=unlocksAt(k).filter(x=>!/^ещё/.test(x));if(u.length)return {L:k,list:u}}return null}

const DECO={DRAGON_MAX,repair,unlocksAt,nextMajor,NURSERY,homeFor,nursery,breedPath,HATCH_LV,BREED_LV,breedCost,BREED_NEED,HATCH_NEED,PRED_TOL,lvTable,summary,habNames,TYPES,HAB_ORDER,HAB_LV,FARM_LV,CROPS,RAR_GOLD,SKIP_CARDS,GRID,CHUNK,START_LAND,LAND_COST,MILESTONES,FEEDS,RATION,
  xpFor,levelOf,maxHabs,maxFarms,maxDragonLv,feedCost,income,startState,hosts,dragonKeys,goldPerCard,rate,settle,chestNow,normalize,
  canPlace,chunkOf,apply,OBST,OBST_KIND,obstacles,ready,left,level,count,streakMult,marketGenome,habCap,chestCap};
if(typeof module!=='undefined'&&module.exports)module.exports=DECO;else root.DECO=DECO;
})(typeof window!=='undefined'?window:globalThis);
