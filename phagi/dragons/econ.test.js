/* Автотесты экономики этапа D: node phagi/dragons/econ.test.js
   Готовые Гнездовье и Инкубатор, второе место за серию 7 дней, совместимость старых Инкубаторов, лесенка бонуса за объём,
   удвоенное золото с точки перехода, корм сверх цели, догоняющий рост, 100 уровней острова, 60 уровней драконов,
   новые участки земли, подарки-носители E2 и цели исследования. */
'use strict';
const assert=require('assert');
global.DRG=require('./genetics.js');
const E=require('./economy.js'),G=global.DRG;
let fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
const founders=()=>[{id:'d1',name:'Ж',born:'2026-10-26',genome:G.make({sex:'F',E:'F/e'})},{id:'d2',name:'П',born:'2026-10-26',genome:G.make({sex:'M',E:'W/W'})}];
const ctx=(K,extra)=>Object.assign({K,streak:0,uid:'u1',today:'2026-10-26'},extra||{});
const ok=r=>{assert.ok(!r.err,r.err);return r.s};
const ALL=[{from:'2026-01-01',to:null}];
const day=i=>{const d=new Date(Date.UTC(2026,9,1+i));return d.toISOString().slice(0,10)};
const days=(arr)=>{const o={};arr.forEach((v,i)=>{o[day(i)]=v});return o};
const near=(a,b,m)=>assert.ok(Math.abs(a-b)<1e-9,(m||'')+': '+a+' ≠ '+b);

/* ---------- стартовые зоны и второе место ---------- */
t('новый остров: Гнездовье и Инкубатор построены на открытой земле, в Инкубаторе одно место, ничего не надо покупать',()=>{
  const s=E.normalize(E.startState(founders(),0),0,null),nest=s.bld.find(b=>b.type==='nest'),h=s.bld.find(b=>b.type==='hatch');
  assert.ok(nest&&h);assert.ok(!nest.build&&!h.build,'готовы');assert.strictEqual(h.slots.length,1);assert.strictEqual(E.hatchCap(s,h),1);
  [nest,h].forEach(b=>{for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)assert.ok(s.land.includes(E.chunkOf(b.x+dx,b.y+dy)),'на открытой земле')});
  const ids=s.bld.map(b=>b.id);assert.strictEqual(new Set(ids).size,ids.length);
  /* постройки не пересекаются */
  s.bld.forEach(a=>s.bld.forEach(b=>{if(a!==b)assert.ok(!(a.x<b.x+2&&b.x<a.x+2&&a.y<b.y+2&&b.y<a.y+2),a.id+' и '+b.id)}));
  /* на 1-м уровне острова пара сразу доступна, если родители выросли */
  const s2=JSON.parse(JSON.stringify(s));s2.dragons.forEach(d=>d.lvl=3);s2.bal.gold=1000;
  assert.strictEqual(E.level(s2),1);ok(E.apply(s2,ctx(0),{t:'breed',id:nest.id,mother:'d1',father:'d2'}));
  assert.ok(/Гнездовье на острове уже есть/.test(E.apply(s,ctx(0),{t:'build',type:'nest',x:4,y:8}).err));
});

t('серия 6 → 7 дней бесплатно открывает второе место ровно один раз, пропуск его не закрывает, яйцо в нём цело',()=>{
  let s=E.normalize(E.startState(founders(),0),0,null);const h=()=>s.bld.find(b=>b.type==='hatch');
  s=E.normalize(s,0,{food:0,gems:0,streakBest:6});assert.ok(!s.slot7);assert.strictEqual(h().slots.length,1);
  const gold=s.bal.gold,gems=s.bal.gems;
  s=E.normalize(s,0,{food:0,gems:0,streakBest:7});assert.strictEqual(s.slot7,true);assert.ok(s.slot7new,'событие для сообщения');
  assert.strictEqual(h().slots.length,2);assert.strictEqual(s.bal.gold,gold);assert.strictEqual(s.bal.gems,gems,'открытие бесплатное');
  h().slots[1]={n:1,m:'d1',f:'d2',genome:G.make({sex:'F'}),viable:true,at:0,need:8,skip:0};const egg=JSON.stringify(h().slots[1]);
  s=ok(E.apply(s,ctx(0),{t:'ack',what:'slot7'}));assert.ok(!s.slot7new);assert.ok(E.apply(s,ctx(0),{t:'ack',what:'slot7'}).err,'второй раз нечего');
  /* серия прервалась: место и яйцо остаются, сообщения нет */
  s=E.normalize(s,5,{food:0,gems:0,streakBest:7,cur:0});s=E.normalize(s,6,{food:0,gems:0,streakBest:0});
  assert.strictEqual(h().slots.length,2);assert.strictEqual(JSON.stringify(h().slots[1]),egg);assert.ok(!s.slot7new);
});

t('историческая серия 7+ засчитывается сразу, даже если сейчас серия прервана',()=>{
  const s=E.normalize(E.startState(founders(),0),0,{food:0,gems:0,streakBest:12,cur:0});
  assert.strictEqual(s.slot7,true);assert.strictEqual(s.bld.find(b=>b.type==='hatch').slots.length,2);
});

t('улучшение Инкубатора не обходит место за серию: до 7 дней подряд 2-й уровень закрыт',()=>{
  let s=E.normalize(E.startState(founders(),0),0,null);s.bal.gold=1e5;s.bal.xp=E.xpFor(10);s=E.normalize(s,0,null);
  const r=E.apply(s,ctx(0),{t:'upgrade',id:'b5'});assert.ok(/серией 7 дней/.test(r.err),r.err);
  s=E.normalize(s,0,{food:0,gems:0,streakBest:7});s=ok(E.apply(s,ctx(0),{t:'upgrade',id:'b5'}));s=E.normalize(s,100,null);
  assert.strictEqual(E.hatchCap(s,s.bld.find(b=>b.id==='b5')),3,'2-й уровень: 2 места + место за серию');
});

/* ---------- совместимость старых островов ---------- */
const oldIsle=(hlvl,slots)=>{const s=E.startState(founders(),0);delete s.ev;delete s.evK;s.bld=s.bld.filter(b=>b.type!=='nest'&&b.type!=='hatch');
  if(hlvl){s.bld.push({id:'b7',type:'hatch',x:2,y:4,lvl:hlvl,slots,build:null,up:null});s.bld.push({id:'b8',type:'nest',x:4,y:8,lvl:1,pair:null,build:{at:0,need:15,skip:0},up:null})}
  s.clr=E.OBST.map(o=>o.id);return s};
t('старый Инкубатор с 2, 3 и 4 местами: мест не меньше, яйца и их сроки не меняются, купленное не дублируется',()=>{
  [[1,2],[2,3],[3,4]].forEach(([lv,k])=>{
    const slots=Array(k).fill(null);slots[k-1]={n:3,m:'d1',f:'d2',genome:G.make({sex:'M',E:'T/e'}),viable:true,at:17,need:22,skip:1};
    const d=oldIsle(lv,slots),r=E.repair(d,{K:500,food:0,gems:0});assert.deepStrictEqual(r.bad,[]);
    const s=E.normalize(r.s,500,{food:0,gems:0,streakBest:0}),h=s.bld.find(b=>b.id==='b7');
    assert.strictEqual(s.slot7,'legacy');assert.strictEqual(h.slots.length,k,lv+': ячеек столько же');assert.strictEqual(E.hatchCap(s,h),k);
    assert.deepStrictEqual(h.slots[k-1],r.s.bld.find(b=>b.id==='b7').slots[k-1]);assert.strictEqual(h.slots[k-1].at,17);assert.strictEqual(h.slots[k-1].need,22);
    assert.strictEqual(s.bld.filter(b=>b.type==='hatch').length,1);assert.strictEqual(s.bld.filter(b=>b.type==='nest').length,1);
    assert.ok(!s.bld.find(b=>b.id==='b8').build,'строившееся Гнездовье стало готовой зоной');
    const again=E.repair(r.s,{K:600,food:0,gems:0});assert.deepStrictEqual(again.fix,[],'повтор миграции ничего не делает');assert.strictEqual(again.s.evK,500)});
});

t('старый остров без зон: добавляются только недостающие, на свободное место; нет места — открывается соседний участок',()=>{
  const d=oldIsle(0),r=E.repair(d,{K:40,food:0,gems:0});assert.deepStrictEqual(r.bad,[]);
  assert.strictEqual(r.s.bld.filter(b=>b.type==='nest').length,1);assert.strictEqual(r.s.bld.filter(b=>b.type==='hatch').length,1);
  const h=r.s.bld.find(b=>b.type==='hatch');assert.strictEqual(h.slots.length,1);assert.ok(!r.s.slot7,'нового Инкубатора у старого острова нет: второе место за серию');
  d.bld.forEach(b=>assert.deepStrictEqual(r.s.bld.find(x=>x.id===b.id),b,'прежние постройки не тронуты'));
  /* остров забит: все клетки открытой земли под постройками */
  const full=oldIsle(0);full.bld=[];let id=1;for(const c of full.land){const [cx,cy]=c.split(',').map(Number);for(let i=0;i<4;i+=2)for(let j=0;j<4;j+=2)full.bld.push({id:'b'+(id++),type:'farm',x:cx*4+i,y:cy*4+j,lvl:1,plots:[null,null],build:null,up:null})}
  full.bseq=id;const r2=E.repair(full,{K:40,food:0,gems:0});assert.deepStrictEqual(r2.bad,[]);
  const added=r2.s.bld.filter(b=>b.type==='nest'||b.type==='hatch');assert.strictEqual(added.length,2,r2.fix.join('; '));
  assert.ok(r2.s.land.length>full.land.length,'открыт новый участок');
  added.forEach(b=>{for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)assert.ok(r2.s.land.includes(E.chunkOf(b.x+dx,b.y+dy)))});
  assert.ok(added.every(b=>!full.bld.some(o=>o.x<b.x+2&&b.x<o.x+2&&o.y<b.y+2&&b.y<o.y+2)),'не поверх построек');
});

/* ---------- лесенка, золото и корм ---------- */
t('лесенка: границы 0/1/14/15/16/30/31/60/61/120/121 и отдача после 120 не исчезает',()=>{
  const k=[[1,1],[14,1],[15,1],[16,1.15],[30,1.15],[31,1.3],[60,1.3],[61,1.5],[120,1.5],[121,1.6],[500,1.6]];
  k.forEach(([j,x])=>assert.strictEqual(E.ladderK(j),x,'карточка '+j));
  /* после n карточек: следующая карточка n+1 идёт по ladderK(n+1), следующая ступень — первая, которая ещё впереди */
  assert.deepStrictEqual(E.ladderNext(0),{at:16,k:1.15});assert.deepStrictEqual(E.ladderNext(14),{at:16,k:1.15});assert.deepStrictEqual(E.ladderNext(15),{at:31,k:1.3});
  assert.deepStrictEqual(E.ladderNext(119),{at:121,k:1.6});assert.strictEqual(E.ladderNext(120),null);assert.strictEqual(E.ladderNext(500),null);
  /* часы золота: вес карточки после перехода = 2 · ступень, прошлые карточки не пересчитываются */
  [0,1,14,15,16,30,31,60,61,120,121,300].forEach(N=>{const inc=E.income({[day(0)]:N},{},ALL,15,{K:0});
    let w=0;for(let j=1;j<=N;j++)w+=2*E.ladderK(j);near(inc.gk(N),w,'карточек '+N);
    let f=0;for(let j=16;j<=N;j++)f+=2*E.ladderK(j);assert.strictEqual(inc.extra,Math.floor(f),'корм сверх цели при '+N);
    if(N>0)assert.ok(inc.gk(N)>inc.gk(N-1)||N===0,'каждая карточка что-то даёт')});
  const a=E.income({[day(0)]:200},{},ALL,15,{K:0});near(a.gk(200)-a.gk(199),2*1.6,'после 120 карточек');
});

t('переход на ступень не меняет прежние карточки дня, повторный расчёт и другое устройство дают то же',()=>{
  const a=E.income({[day(0)]:20},{},ALL,15,{K:0}),b=E.income({[day(0)]:60},{},ALL,15,{K:0});
  near(a.gk(20),b.gk(20),'первые 20 карточек весят одинаково');near(a.gk(15),30);
  const c=E.income({[day(0)]:60},{},ALL,15,{K:0});near(b.gk(45),c.gk(45));assert.strictEqual(b.food,c.food);
});

t('до точки перехода прежние правила: история не удваивается, сундук копит по-старому до evK и вдвое после',()=>{
  const d=days([30,30,30]),inc=E.income(d,{},ALL,15,{K:60});
  near(inc.gk(60),60,'первые два дня как раньше');let w=60;for(let j=1;j<=30;j++)w+=2*E.ladderK(j);near(inc.gk(90),w);
  const old=E.income(d,{},ALL,15,null);assert.strictEqual(old.gk(90),90);assert.strictEqual(old.extra,0,'без перехода корма сверх цели нет');
  assert.strictEqual(inc.extra,Math.floor((15*1.15)*2));
  /* сундук: дракон 3 золота за карточку */
  let s=E.startState(founders(),60);s=E.normalize(s,60,inc);E.settle(s,30,inc.gk);
  const b1=s.bld.find(b=>b.id==='b1');assert.strictEqual(Math.round(E.chestNow(s,b1,60,inc.gk)),3*30,'до перехода 3 за карточку');
  near(E.chestNow(s,b1,90,inc.gk),Math.min(E.chestCap(b1),3*(inc.gk(90)-30)));
});

t('30 и 60 карточек дают строго больше золота и корма, чем 15, при одинаковом сборе; сундук это вмещает',()=>{
  const run=N=>{const inc=E.income({[day(0)]:N},{},ALL,15,{K:0});let s=E.normalize(E.startState(founders(),0),0,null);E.settle(s,0,inc.gk);
    s=E.normalize(s,N,inc);const r=E.apply(s,ctx(N,{inc}),{t:'collect',id:'b1'});return {gold:r.err?0:r.s.got.gold,food:s.bal.food}};
  const a=run(15),b=run(30),c=run(60);assert.ok(b.gold>a.gold&&c.gold>b.gold,[a.gold,b.gold,c.gold].join(' '));
  assert.ok(b.food>a.food&&c.food>b.food,[a.food,b.food,c.food].join(' '));
  assert.ok(c.gold<E.HAB_LV[1].chest,'60 карточек одного дракона влезают в сундук 1-го уровня');
});

t('доход зачисляется один раз: повтор normalize, перезагрузка и смена режима не удваивают корм и золото',()=>{
  const inc=E.income(days([40,40]),{},ALL,15,{K:0});let s=E.startState(founders(),0);
  s=E.normalize(s,80,inc);const f=s.bal.food;s=E.normalize(s,80,inc);s=E.normalize(JSON.parse(JSON.stringify(s)),80,inc);assert.strictEqual(s.bal.food,f);
  E.settle(s,40,inc.gk);const a=E.chestNow(s,s.bld[0],80,inc.gk);E.settle(s,80,inc.gk);E.settle(s,80,inc.gk);near(s.bld[0].chest.amt,a);
  /* смена режима: дни вне периода драконов ничего не дают */
  const part=E.income(days([40,40]),{},[{from:day(1),to:null}],15,{K:0});assert.ok(part.food<inc.food);
});

t('золото драконов: вдвое против прежнего за карточку, развитие с уровнем сохраняется и не уходит в бесконечность',()=>{
  const d={genome:G.make({sex:'F',E:'F/e'}),lvl:1};assert.strictEqual(E.goldRate(d),3);
  assert.strictEqual(E.goldNow({evK:0},d,0),6);assert.strictEqual(E.goldNow({},d,0),3,'до перехода по-старому');
  assert.strictEqual(E.goldNow({evK:0},d,20),6*1.15);
  const g=l=>E.goldRate(Object.assign({},d,{lvl:l}));assert.ok(g(20)>g(10));assert.ok(g(60)>g(20));assert.ok(g(60)<g(20)*1.5);
  assert.strictEqual(Math.round(g(20)*100)/100,14.4);
  assert.ok(E.HAB_LV.slice(1).every((x,i)=>!i||x.chest>E.HAB_LV[i].chest),'сундуки растут');
  assert.strictEqual(E.HAB_LV[1].chest,600,'сундук 1-го уровня вдвое больше прежнего');
});

/* ---------- драконы до 60, кормление и догоняющий рост ---------- */
t('кормление 1 → 20 как раньше, 20 → 60 растёт медленно (меньше половины продолжения старой формулы)',()=>{
  let a=0,b=0,old=0;for(let l=1;l<20;l++)a+=E.FEEDS*E.feedCost(l);for(let l=20;l<60;l++){b+=E.FEEDS*E.feedCost(l);old+=E.FEEDS*(Math.round(4*Math.pow(l,1.6))+1)}
  assert.strictEqual(a,13976);assert.ok(b<old/2,b+' против '+old);
  for(let l=21;l<60;l++)assert.ok(E.feedCost(l)>=E.feedCost(l-1));
  assert.strictEqual(E.DRAGON_MAX,60);assert.strictEqual(E.maxDragonLv(80),60);assert.strictEqual(E.maxDragonLv(9),20);
  for(let L=1;L<=9;L++)assert.strictEqual(E.maxDragonLv(L),Math.min(20,3+2*L),'прежний предел до 9-го уровня');
});

t('догоняющий рост: молодой дракон ест вдвое дешевле, опыт острова от заплаченного, геном не меняется',()=>{
  let s=E.normalize(E.startState(founders(),0),0,null);s.bal.food=1e6;s.bal.xp=E.xpFor(60);s=E.normalize(s,0,null);
  s.dragons[0].lvl=30;const g=JSON.stringify(s.dragons[1].genome);s.dragons[1].lvl=5;
  const p=E.feedPrice(s,s.dragons[1]);assert.ok(p.catchUp);assert.strictEqual(p.cost,Math.ceil(E.feedCost(5)/2));
  const xp0=s.bal.xp,f0=s.bal.food;s=ok(E.apply(s,ctx(0),{t:'feed',dragon:'d2'}));
  assert.strictEqual(f0-s.bal.food,p.cost);assert.strictEqual(s.bal.xp-xp0,Math.round(p.cost/4));assert.strictEqual(JSON.stringify(s.dragons[1].genome),g);
  assert.ok(!E.feedPrice(s,s.dragons[0]).catchUp,'самому сильному скидки нет');
  s.dragons[1].lvl=25;assert.ok(!E.feedPrice(s,s.dragons[1]).catchUp,'разрыв меньше 10 уровней');
});

/* ---------- остров 100 уровней ---------- */
t('остров: 100 уровней, на максимуме нет следующего, заметное открытие не реже раза в 5 уровней',()=>{
  assert.strictEqual(E.levelOf(1e12),100);assert.strictEqual(E.levelOf(E.xpFor(100)-1),99);
  for(let L=2;L<=60;L++)assert.strictEqual(E.xpFor(L),Math.round(30*Math.pow(L-1,1.9)),'кривая до 60 прежняя');
  let last=1;for(let L=2;L<=100;L++){const u=E.unlocksAt(L).filter(x=>!E.MINOR.test(x));if(u.length){assert.ok(L-last<=5,'пусто между '+last+' и '+L);last=L}}
  assert.strictEqual(last,100);assert.strictEqual(E.nextMajor(100),null);
  for(let L=1;L<=20;L++){assert.strictEqual(E.maxHabs(L),3+Math.floor(L/2));assert.strictEqual(E.maxFarms(L),1+Math.floor((L+2)/3))}
  for(let L=2;L<=100;L++){assert.ok(E.maxHabs(L)>=E.maxHabs(L-1));assert.ok(E.maxFarms(L)>=E.maxFarms(L-1))}
});

t('вместимость физически помещается: все постройки 100-го уровня встают на открытую землю 20×20',()=>{
  const total=E.maxHabs(100)+E.maxFarms(100)+2+2,cells=Object.keys(E.LAND_COST).length+E.START_LAND.length;
  assert.strictEqual(cells,25);assert.ok(total*4<=cells*16-E.OBST.length,total+' построек');
  /* жадная расстановка на всей земле с расчищенными препятствиями */
  const s={land:Object.keys(E.LAND_COST).concat(E.START_LAND),bld:[],clr:E.OBST.map(o=>o.id)};let k=0;
  for(let y=0;y<E.GRID-1&&k<total;y++)for(let x=0;x<E.GRID-1&&k<total;x++)if(E.canPlace(s,x,y)){s.bld.push({id:'z'+k,x,y});k++}
  assert.strictEqual(k,total);
});

t('новые участки: открываются по уровню острова и только рядом с открытой землёй, старые координаты на месте',()=>{
  let s=E.normalize(E.startState(founders(),0),0,null);s.bal.gold=1e7;s.bal.gems=1e4;
  assert.ok(/20-м уровне/.test(E.apply(s,ctx(0),{t:'expand',chunk:'3,1'}).err));
  s.bal.xp=E.xpFor(100);s=E.normalize(s,0,null);
  assert.ok(/соседний/.test(E.apply(s,ctx(0),{t:'expand',chunk:'4,4'}).err));
  s=ok(E.apply(s,ctx(0),{t:'expand',chunk:'3,1'}));assert.ok(s.land.includes('3,1'));
  assert.deepStrictEqual(E.extent(E.normalize(E.startState(founders(),0),0,null)),{chunks:3,n:12},'новый остров рисуется как раньше');
  assert.strictEqual(E.extent(s).n,20);
});

/* ---------- подарки E2 и цели исследования ---------- */
t('подарок похода: носитель E2 за победу, один раз, одинаковый геном при повторе, у старых драконов ничего не меняется',()=>{
  let s=E.normalize(E.startState(founders(),0),0,null);const old=JSON.stringify(s.dragons);
  assert.ok(/Сначала победите/.test(E.apply(s,ctx(0),{t:'claim',node:'e7'}).err));
  s.pve={v:1,best:{e7:2},wins:{e7:1},at:{}};
  const r1=ok(E.apply(s,ctx(0),{t:'claim',node:'e7'})),r2=ok(E.apply(s,ctx(0),{t:'claim',node:'e7'}));
  const d=r1.dragons.find(x=>x.id===r1.gifts.e7);assert.ok(E.hasE2(d));assert.deepStrictEqual(G.validate(d.genome),[]);
  assert.deepStrictEqual(d.genome,r2.dragons.find(x=>x.id===r2.gifts.e7).genome,'зерно от узла и uid');
  assert.deepStrictEqual(G.phenotype(d.genome).elements.slice().sort(),['F','T']);
  assert.ok(/уже получен/.test(E.apply(r1,ctx(0),{t:'claim',node:'e7'}).err));
  assert.strictEqual(JSON.stringify(r1.dragons.slice(0,2)),old);
  Object.keys(E.GIFTS).forEach(k=>{const g=E.giftGenome(k,'u1');assert.deepStrictEqual(G.validate(g),[],k);assert.ok(E.hasE2({genome:g}),k);assert.strictEqual(G.phenotype(g).elements.length,2,k)});
});

t('бонус за ДЗ: начисляется только прирост суммы, повтор и снижение ничего не меняют, учёт отдельно от серии',()=>{
  const f=[{id:'d1',name:'Ж',born:'2026-10-01',genome:G.make({sex:'F',E:'F/e'}),lvl:1,fed:0}];
  let s=E.normalize(E.startState(f,0),0,{K:0,food:0,gems:0,best:0,hw:{gems:5,food:180}});const g0=s.bal.gems,f0=s.bal.food;
  assert.strictEqual(s.credited.hwg,5);assert.strictEqual(s.credited.hwf,180);
  s=E.normalize(s,0,{K:0,food:0,gems:0,best:0,hw:{gems:5,food:180}});assert.strictEqual(s.bal.gems,g0);assert.strictEqual(s.bal.food,f0);
  s=E.normalize(s,0,{K:0,food:0,gems:0,best:0,hw:{gems:2,food:60}});assert.strictEqual(s.bal.gems,g0,'снижение суммы не отнимает');
  s=E.normalize(s,0,{K:0,food:0,gems:0,best:0,hw:{gems:9,food:330}});assert.strictEqual(s.bal.gems,g0+4);assert.strictEqual(s.bal.food,f0+150);
  assert.strictEqual(s.credited.gems,0,'учёт серии не тронут')});

t('цели исследования: награда один раз и только за выполненное',()=>{
  let s=E.normalize(E.startState(founders(),0),0,null);
  assert.ok(/5-м уровне/.test(E.apply(s,ctx(0),{t:'research',goal:'hyb'}).err));s.bal.xp=E.xpFor(5);s=E.normalize(s,0,null);
  assert.ok(/не выполнена/.test(E.apply(s,ctx(0),{t:'research',goal:'hyb'}).err));
  s.dragons.push({id:'d9',name:'x',genome:G.make({sex:'F',E:'F/W'}),lvl:1,fed:0,home:null});
  const g=s.bal.gems;s=ok(E.apply(s,ctx(0),{t:'research',goal:'hyb'}));assert.strictEqual(s.bal.gems,g+5);
  assert.ok(/уже получена/.test(E.apply(s,ctx(0),{t:'research',goal:'hyb'}).err));
  assert.strictEqual(new Set(E.RESEARCH.map(x=>x.id)).size,E.RESEARCH.length);
});

console.log(`\n${n-fails} из ${n} тестов прошли`);
process.exit(fails?1:0);
