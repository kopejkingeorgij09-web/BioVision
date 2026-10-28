/* Автотесты экономики острова: node phagi/dragons/economy.test.js */
'use strict';
const assert=require('assert');
global.DRG=require('./genetics.js');
const E=require('./economy.js'),G=global.DRG;
/* в старых тестах координаты построек заданы руками: препятствия в них заранее расчищены */
const start0=E.startState;E.startState=f=>Object.assign(start0(f),{clr:E.OBST.map(o=>o.id)});

let fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
const founders=()=>[{id:'d1',name:'Ж',born:'2026-10-26',genome:G.make({sex:'F',E:'F/e'})},{id:'d2',name:'П',born:'2026-10-26',genome:G.make({sex:'M',E:'W/W'})}];
const ctx=(K,extra)=>Object.assign({K,streak:0,uid:'u1',today:'2026-10-26'},extra||{});
const ok=r=>{assert.ok(!r.err,r.err);return r.s};
/* свободная ячейка под постройку на острове i (4.2) */
const fr=(s,i)=>E.freeSlots(E.isle(s,i||0))[0];

t('доход за дни: K, паёк растёт с серией, самоцветы и рекорд',()=>{
  const days={'2026-10-20':20,'2026-10-21':31,'2026-10-22':5,'2026-10-23':15,'2026-10-24':16};
  const all=[{from:'2026-10-01',to:null}];
  const r=E.income(days,{},all,15);
  assert.strictEqual(r.K,87);
  /* 20-е: серия 1 → 25, 21-е: серия 2 → 30, 23-е: 1 → 25, 24-е: 2 → 30 */
  assert.strictEqual(r.food,25+30+25+30);
  assert.strictEqual(r.gems,1+2+1+1);
  const part=E.income(days,{},[{from:'2026-10-23',to:null}],15);
  assert.strictEqual(part.K,31);assert.strictEqual(part.food,25+30);
});

t('доход за дни: замороженный день не рвёт серию, рубежи серии дают самоцветы',()=>{
  const days={},start='2026-09-01';let d=start;
  for(let i=0;i<8;i++){days[d]=15;const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+1);d=x.toISOString().slice(0,10)}
  const r=E.income(days,{},[{from:start,to:null}],15);
  assert.strictEqual(r.best,8);assert.strictEqual(r.gems,8+3);
  const fz=E.income({'2026-09-01':15,'2026-09-03':15},{'2026-09-02':'m'},[{from:start,to:null}],15);
  assert.strictEqual(fz.food,25+30);
});

t('стартовый остров: драконы в своих средах, сундук копит золото за карточки',()=>{
  let s=E.normalize(E.startState(founders()),100,null);
  assert.strictEqual(s.dragons[0].home,'b1');assert.strictEqual(s.dragons[1].home,'b2');
  E.settle(s,100);
  const b1=s.bld[0];assert.strictEqual(E.chestNow(s,b1,110),30,'обычный дракон даёт 3 золота за карточку');
  assert.strictEqual(E.chestNow(s,b1,100000),E.HAB_LV[1].chest,'сундук не больше вместимости');
  const r=E.apply(s,ctx(120),{t:'collect',id:'b1'});s=ok(r);
  assert.strictEqual(s.bal.gold,300+60);assert.strictEqual(r.s.got.gold,60);
});

t('стройка идёт в карточках и ускоряется самоцветами',()=>{
  let s=E.normalize(E.startState(founders()),0,null);E.settle(s,0);
  s=ok(E.apply(s,ctx(0),Object.assign({t:'build',type:'farm'},fr(s))));
  assert.ok(E.apply(s,ctx(0),Object.assign({t:'build',type:'farm'},fr(s))).err,'третья ферма на 1-м уровне нельзя');
  const b=s.bld.find(x=>x.id===s.last);assert.ok(b.build);
  assert.strictEqual(E.left(b.build,3),3);
  s=E.normalize(s,6,null);assert.ok(!s.bld.find(x=>x.id===b.id).build,'готово через 6 карточек');
  s=E.normalize(E.startState(founders()),0,null);
  s.bal.gold=5000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);
  s=ok(E.apply(s,ctx(0),Object.assign({t:'build',type:'T'},fr(s))));
  const id=s.last,g0=s.bal.gems;
  s=ok(E.apply(s,ctx(3),{t:'speed',id}));
  assert.strictEqual(g0-s.bal.gems,2,'15 карточек ожидания = 2 самоцвета');
  assert.ok(!s.bld.find(x=>x.id===id).build);
});

t('разметка (4.2): постройки в ячейках с промежутком, координата притягивается к ячейке, на занятое нельзя',()=>{
  const s=E.normalize(E.startState(founders()),0,null);
  assert.strictEqual(E.extent(s).n,16);assert.strictEqual(E.slots(s).length,16);
  const onSlot=b=>(b.x-E.SLOT0)%E.SLOT===0&&(b.y-E.SLOT0)%E.SLOT===0;
  assert.ok(s.bld.every(onSlot),'стартовые постройки в ячейках');
  /* никакие две постройки не касаются: между ними хотя бы клетка */
  s.bld.forEach(a=>s.bld.forEach(b=>{if(a!==b)assert.ok(Math.abs(a.x-b.x)>=4||Math.abs(a.y-b.y)>=4,a.id+' касается '+b.id)}));
  const b1=s.bld[0],b2=s.bld[1];assert.ok(!E.canPlace(s,b1.x,b1.y),'занято');
  assert.ok(E.apply(s,ctx(0),{t:'move',id:b1.id,x:b2.x,y:b2.y}).err,'на чужую ячейку нельзя');
  const f=fr(s);const m=ok(E.apply(s,ctx(0),{t:'move',id:b1.id,x:f.x+1,y:f.y-1}));
  const nb=m.bld.find(x=>x.id===b1.id);assert.deepStrictEqual([nb.x,nb.y],[f.x,f.y],'притянулось к ячейке');
  assert.ok(E.apply(s,ctx(0),{t:'expand',chunk:'3,1'}).err,'участки не покупаются');
});

t('земля растёт сама (4.2): 16 клеток, с 12-го уровня 20, с 30-го 24, на обоих островах',()=>{
  let s=E.normalize(E.startState(founders()),0,null);assert.strictEqual(E.extent(s).n,16);
  s.bal.xp=E.xpFor(12);s=E.normalize(s,0,null);assert.strictEqual(E.extent(s).n,20);assert.strictEqual(E.slots(s).length,25);
  s.bal.gold=1e5;s=ok(E.apply(s,ctx(0),{t:'isle2'}));assert.strictEqual(E.extent(E.isle(s,1)).n,20);
  s.bal.xp=E.xpFor(30);s=E.normalize(s,0,null);assert.strictEqual(E.extent(s).n,24);assert.strictEqual(E.extent(E.isle(s,1)).n,24);assert.strictEqual(E.slots(s).length,36);
  assert.ok(E.unlocksAt(12).some(x=>/остров растёт/.test(x)));
});

t('расстановка (4.2): старый остров с постройками вплотную один раз раскладывается по ячейкам, ничего не теряется',()=>{
  const s0=E.normalize(E.startState(founders()),0,null);const d=JSON.parse(JSON.stringify(s0));delete d.lay;
  /* как было до 4.2: постройки вплотную друг к другу */
  d.bld.forEach((b,i)=>{b.x=2+2*(i%4);b.y=4+2*Math.floor(i/4)});d.dragons.forEach(x=>{x.home=d.bld[0].id});
  const r=E.repair(d);assert.deepStrictEqual(r.bad,[]);assert.strictEqual(r.s.lay,1);assert.ok(r.fix.some(x=>/расставлены/.test(x)));
  assert.strictEqual(r.s.bld.length,d.bld.length);assert.deepStrictEqual(r.s.bld.map(b=>b.id).sort(),d.bld.map(b=>b.id).sort());
  r.s.bld.forEach(a=>{assert.ok(E.slots(r.s).some(p=>p.x===a.x&&p.y===a.y),'в ячейке '+a.id);
    r.s.bld.forEach(b=>{if(a!==b)assert.ok(Math.abs(a.x-b.x)>=4||Math.abs(a.y-b.y)>=4)})});
  assert.ok(r.s.dragons.every(x=>x.home===d.bld[0].id),'драконы в своих домах');
  const r2=E.repair(JSON.parse(JSON.stringify(r.s)));assert.ok(!r2.fix.some(x=>/расставлены/.test(x)),'второй раз ничего не двигает');
});

t('малыш из яслей сам заселяется в появившийся дом (4.2)',()=>{
  let s=E.normalize(E.startState(founders()),0,null);
  s.dragons.push({id:'dx',name:'Б',born:'2026-10-26',genome:G.make({sex:'F',E:'W/W'}),lvl:1,fed:0,home:null,nurs:true});
  s=E.normalize(s,0,null);const d=s.dragons.find(x=>x.id==='dx');
  const lag=s.bld.find(b=>b.type==='W');assert.strictEqual(d.home,lag.id);assert.ok(!d.nurs);
});

t('грядки (4.2): урожай готов сразу после посадки, больше с серией',()=>{
  let s=E.normalize(E.startState(founders()),0,null);const fm=s.bld.find(b=>b.type==='farm').id;
  s=ok(E.apply(s,ctx(0),{t:'plant',id:fm,plot:0,crop:'ember'}));
  assert.strictEqual(s.bal.gold,280);
  const r=E.apply(s,ctx(0,{streak:10}),{t:'harvest',id:fm,plot:0});s=ok(r);
  assert.strictEqual(r.s.got.food,Math.round(24*1.25));
  assert.ok(E.apply(s,ctx(0),{t:'plant',id:fm,plot:0,crop:'vine'}).err,'лоза с 4-го уровня');
});

t('кормление: 4 кормления на уровень, золото за карточку растёт',()=>{
  let s=E.normalize(E.startState(founders()),0,null);s.bal.food=1000;E.settle(s,0);
  const g1=E.goldPerCard(s.dragons[0]);
  for(let i=0;i<4;i++)s=ok(E.apply(s,ctx(10*i),{t:'feed',dragon:'d1'}));
  assert.strictEqual(s.dragons[0].lvl,2);assert.strictEqual(s.bal.food,1000-4*E.feedCost(1));
  assert.ok(E.goldPerCard(s.dragons[0])>g1);
  /* сундук до кормления досчитан по старой ставке */
  assert.strictEqual(Math.round(s.bld[0].chest.amt),3*30);
  s.bal.food=1e6;for(let i=0;i<400;i++){const r=E.apply(s,ctx(40),{t:'feed',dragon:'d1'});if(r.err)break;s=r.s}
  assert.strictEqual(s.dragons[0].lvl,E.maxDragonLv(E.level(s)),'упирается в предел уровня острова');
});

t('рынок: дракон попадает в свободную среду, генотип случайный, но с зерном',()=>{
  let s=E.normalize(E.startState(founders()),0,null);s.bal.gold=2000;
  s=ok(E.apply(s,ctx(0),{t:'buy',type:'F'}));
  const d=s.dragons.find(x=>x.id===s.last);assert.strictEqual(d.home,'b1');
  assert.deepStrictEqual(G.validate(d.genome),[]);
  assert.ok(G.phenotype(d.genome).elements.includes('F'));
  assert.ok(E.apply(s,ctx(0),{t:'buy',type:'F'}).err,'Кальдера на 2 места занята');
  assert.deepStrictEqual(E.marketGenome('W','x'),E.marketGenome('W','x'));
  for(let i=0;i<200;i++){const ph=G.phenotype(E.marketGenome('N','s'+i));assert.ok(ph.breath!=='element','в Пещеру только дымные и дремлющие')}
});

t('переселение: только в подходящую среду и при свободном месте',()=>{
  let s=E.normalize(E.startState(founders()),0,null);
  assert.ok(E.apply(s,ctx(0),{t:'place',dragon:'d2',home:'b1'}).err,'водному не в Кальдеру');
  const dual={id:'d9',name:'Д',genome:G.make({sex:'F',E:'F/W'}),lvl:1,fed:0,home:null};s.dragons.push(dual);
  s=ok(E.apply(s,ctx(0),{t:'place',dragon:'d9',home:'b2'}));
  assert.strictEqual(s.dragons.find(x=>x.id==='d9').home,'b2');
});

t('уровень острова: опыт открывает постройки и даёт самоцветы',()=>{
  let s=E.normalize(E.startState(founders()),0,null);const g=s.bal.gems;
  assert.ok(E.apply(s,ctx(0),Object.assign({t:'build',type:'N'},fr(s))).err);
  s.bal.xp=E.xpFor(2);s=E.normalize(s,0,null);
  assert.strictEqual(E.level(s),2);assert.strictEqual(s.bal.gems,g+2);
  s=ok(E.apply(s,ctx(0),Object.assign({t:'build',type:'N'},fr(s))));
  assert.ok(E.apply(s,ctx(0),Object.assign({t:'build',type:'nest'},fr(s))).err);
});

t('доход за дни зачисляется один раз',()=>{
  let s=E.startState(founders());const inc={food:55,gems:3};
  s=E.normalize(s,0,inc);s=E.normalize(s,0,inc);
  assert.strictEqual(s.bal.food,40+55);assert.strictEqual(s.bal.gems,5+3);
  s=E.normalize(s,0,{food:80,gems:3});assert.strictEqual(s.bal.food,40+80);
});

t('улучшение среды: больше мест и вместимость сундука после стройки',()=>{
  let s=E.normalize(E.startState(founders()),0,null);s.bal.gold=1000;E.settle(s,0);
  s=ok(E.apply(s,ctx(0),{t:'upgrade',id:'b1'}));
  assert.strictEqual(s.bld[0].lvl,1);
  s=E.normalize(s,20,null);assert.strictEqual(s.bld[0].lvl,2);assert.strictEqual(E.habCap(s.bld[0]),3);
  assert.strictEqual(Math.round(s.bld[0].chest.amt),60,'во время улучшения сундук копил');
});

t('скрещивание: Гнездовье → яйцо → Инкубатор → птенец с родителями, журнал',()=>{
  let s=E.normalize(E.startState(founders()),0,null);s.bal.gold=10000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);
  s.dragons.forEach(d=>d.lvl=3);
  const nest='b4',hat='b5';
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:4,y:8}).err,'второе Гнездовье нельзя');
  assert.ok(!s.bld.find(b=>b.id===nest).build&&!s.bld.find(b=>b.id===hat).build,'Гнездовье и Инкубатор готовы с начала');
  assert.strictEqual(s.bld.find(b=>b.id===hat).slots.length,1,'в Инкубаторе одно место');
  s=E.normalize(s,20,null);
  assert.ok(E.apply(s,ctx(20),{t:'breed',id:nest,mother:'d2',father:'d1'}).err,'перепутан пол');
  const g0=s.bal.gold;
  s=ok(E.apply(s,ctx(20),{t:'breed',id:nest,mother:'d1',father:'d2'}));
  assert.strictEqual(g0-s.bal.gold,E.breedCost(0,0));
  assert.ok(E.apply(s,ctx(25),{t:'egg',id:nest}).err,'рано');
  s=ok(E.apply(s,ctx(30),{t:'egg',id:nest}));
  const slot=s.bld.find(b=>b.id===hat).slots[0];assert.ok(slot&&slot.genome);
  s=E.normalize(s,200,null);
  const r=E.apply(s,ctx(200),{t:'hatch',id:hat,plot:0});
  if(slot.viable){s=ok(r);const baby=s.dragons.find(d=>d.id===s.last);
    assert.deepStrictEqual(baby.parents,['d1','d2']);assert.strictEqual(baby.gen,1);
    assert.strictEqual(s.log.length,1);assert.strictEqual(s.log[0].child,baby.id);assert.ok(s.log[0].ph.el)}
  else{s=ok(r);assert.ok(s.log[0].dead)}
});

t('скрещивание: генотип яйца с зерном, а без дома птенец живёт в яслях, а не пропадает',()=>{
  const mk=()=>{let s=E.normalize(E.startState(founders()),0,null);s.bal.gold=10000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);s.dragons.forEach(d=>d.lvl=3);
    return E.normalize(s,30,null)};
  const a=ok(E.apply(mk(),ctx(30),{t:'breed',id:'b4',mother:'d1',father:'d2'})),b=ok(E.apply(mk(),ctx(30),{t:'breed',id:'b4',mother:'d1',father:'d2'}));
  assert.deepStrictEqual(a.bld.find(x=>x.id==='b4').pair.egg,b.bld.find(x=>x.id==='b4').pair.egg);
  /* птенец огня/воды F/W или F/e x W/W: занять обе среды, чтобы места не было */
  let s=ok(E.apply(a,ctx(40),{t:'egg',id:'b4'}));s=E.normalize(s,300,null);
  const eg=s.bld.find(x=>x.id==='b5').slots[0];
  if(eg.viable){s.dragons.push({id:'x1',name:'x',genome:G.make({sex:'M',E:'F/W'}),lvl:1,fed:0,home:'b1'},{id:'x2',name:'y',genome:G.make({sex:'M',E:'W/W'}),lvl:1,fed:0,home:'b2'});
    const rate0=s.bld.reduce((x,b)=>x+E.rate(s,b),0),g0=JSON.stringify(eg.genome);
    s=ok(E.apply(s,ctx(300),{t:'hatch',id:'b5',plot:0}));const baby=s.dragons.find(d=>d.id===s.last);
    assert.strictEqual(baby.home,null);assert.strictEqual(baby.nurs,true);assert.strictEqual(JSON.stringify(baby.genome),g0,'геном тот же');
    assert.ok(s.got.nursery);assert.strictEqual(E.nursery(s),1);
    assert.strictEqual(s.bld.reduce((x,b)=>x+E.rate(s,b),0),rate0,'малыш в яслях золота не приносит');
    /* ясли полны: яйцо остаётся в Инкубаторе, ошибка говорит, что делать */
    s.dragons.push({id:'x3',name:'z',genome:G.make({sex:'F',E:'F/F'}),lvl:1,fed:0,home:null,nurs:true});
    s.bld.find(x=>x.id==='b5').slots[1]=Object.assign({},s.bld.find(x=>x.id==='b5').slots[1]||{n:9,m:'d1',f:'d2',genome:eg.genome,viable:true,at:0,need:1,skip:0});
    const r=E.apply(s,ctx(300),{t:'hatch',id:'b5',plot:1});assert.ok(r.err&&/ясли заняты/.test(r.err),r.err);
    assert.ok(s.bld.find(x=>x.id==='b5').slots[1],'яйцо на месте');
    /* освободилось место: «Переселить» из яслей снимает отметку */
    s.dragons=s.dragons.filter(d=>d.id!=='x1'&&d.id!=='x2');const t=['b1','b2'].find(id=>E.hosts(s.bld.find(b=>b.id===id).type,G.phenotype(baby.genome)));
    const s2=ok(E.apply(s,ctx(300),{t:'place',dragon:baby.id,home:t}));const b2=s2.dragons.find(d=>d.id===baby.id);
    assert.strictEqual(b2.home,t);assert.ok(!b2.nurs);assert.strictEqual(E.nursery(s2),1)}
});

t('«Первый потомок»: шаги идут по порядку и опираются на настоящие числа',()=>{
  let s=E.normalize(E.startState(founders()),0,null);
  let p=E.breedPath(s,0);assert.strictEqual(p.next,'parents','Гнездовье и Инкубатор есть с начала: первый шаг — родители');assert.ok(!p.done);
  assert.ok(!p.steps.some(x=>x.k==='level'||x.k==='build'),'нет шага «остров 3-го уровня» и «построить»');
  const par=p.steps[0].par;assert.strictEqual(par.length,2);
  par.forEach(x=>{const d=s.dragons.find(z=>z.id===x.id);let n=0,f=0;for(let l=d.lvl;l<3;l++){const k=E.FEEDS-(l===d.lvl?(d.fed||0):0);n+=k;f+=k*E.feedCost(l)}
    assert.strictEqual(x.n,n);assert.strictEqual(x.food,f);assert.strictEqual(x.cost,E.feedCost(d.lvl))});
  s.bal.gold=10000;s.bal.food=1000;
  s.dragons.forEach(d=>d.lvl=3);s=E.normalize(s,30,null);p=E.breedPath(s,30);
  assert.strictEqual(p.next,'pair');assert.ok(p.steps[1].can);
  s=ok(E.apply(s,ctx(30),{t:'breed',id:'b4',mother:'d1',father:'d2'}));p=E.breedPath(s,30);assert.strictEqual(p.next,'egg');assert.strictEqual(p.steps[2].pair.left,E.BREED_NEED);
  s=E.normalize(s,45,null);s=ok(E.apply(s,ctx(45),{t:'egg',id:'b4'}));p=E.breedPath(s,45);assert.strictEqual(p.next,'hatch');assert.strictEqual(p.steps[3].eggs.length,1);
  s=E.normalize(s,200,null);const r=E.apply(s,ctx(200),{t:'hatch',id:'b5',plot:0});s=ok(r);
  p=E.breedPath(s,200);if(s.log[0].child){assert.ok(p.done);assert.strictEqual(p.next,null)}
});

t('прогноз: верный ускоряет вдвое и даёт самоцвет, неверный ничего не отнимает',()=>{
  let s=E.normalize(E.startState([{id:'d1',name:'a',genome:G.make({sex:'F',C:'C/c'})},{id:'d2',name:'b',genome:G.make({sex:'M',C:'C/c'})}]),0,null);
  s.bal.gold=10000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);s.dragons.forEach(d=>d.lvl=3);
  s=E.normalize(s,20,null);const gm=s.bal.gems;
  const r=E.apply(s,ctx(20),{t:'breed',id:'b4',mother:'d1',father:'d2',pred:{trait:'color',value:'pale',p:0.25}});const s2=ok(r);
  assert.ok(r.s.got.pred.ok);assert.strictEqual(s2.bal.gems,gm+1);assert.strictEqual(s2.bld.find(x=>x.id==='b4').pair.need,Math.ceil(E.BREED_NEED/2));
  const r2=E.apply(s,ctx(20),{t:'breed',id:'b4',mother:'d1',father:'d2',pred:{trait:'color',value:'pale',p:0.5}});const s3=ok(r2);
  assert.ok(!r2.s.got.pred.ok);assert.strictEqual(Math.round(r2.s.got.pred.truth*100),25);assert.strictEqual(s3.bal.gems,gm);
});

t('потомство двух гетерозигот по окраске: около четверти бледных',()=>{
  let s=E.normalize(E.startState([{id:'d1',name:'a',genome:G.make({sex:'F',C:'C/c'})},{id:'d2',name:'b',genome:G.make({sex:'M',C:'C/c'})}]),0,null);
  s.bal.gold=1e7;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);s.dragons.forEach(d=>d.lvl=3);
  let K=30,pale=0,all=0;s=E.normalize(s,K,null);
  for(let i=0;i<400;i++){s=ok(E.apply(s,ctx(K),{t:'breed',id:'b4',mother:'d1',father:'d2'}));K+=20;s=ok(E.apply(s,ctx(K),{t:'egg',id:'b4'}));
    const eg=s.bld.find(x=>x.id==='b5').slots[0];all++;if(G.phenotype(eg.genome).color==='pale')pale++;s.bld.find(x=>x.id==='b5').slots[0]=null}
  assert.ok(Math.abs(pale/all-0.25)<0.07,pale/all);
});

t('препятствий нет (4.1): вся открытая земля свободна, старые расчищенные клетки не мешают',()=>{
  let s=E.normalize(start0([]),0,null);s.bal.gold=1000;
  assert.deepStrictEqual(E.obstacles(s),[]);
  /* любая свободная клетка открытой земли годится: на стартовой земле нет ни дерева, ни валуна */
  E.OBST.filter(o=>s.land.includes(E.chunkOf(o.x,o.y))).forEach(o=>{const x=Math.min(o.x,E.GRID-2),y=Math.min(o.y,E.GRID-2);
    if(!s.bld.some(b=>x<b.x+2&&b.x<x+2&&y<b.y+2&&b.y<y+2)&&[0,1].every(dx=>[0,1].every(dy=>s.land.includes(E.chunkOf(x+dx,y+dy)))))assert.ok(E.canPlace(s,x,y),o.id)});
  assert.ok(E.apply(s,ctx(0),{t:'clear',cell:'0,4'}).err);
  const old=Object.assign(E.normalize(start0([]),0,null),{clr:['0,4','5,9']});assert.deepStrictEqual(E.obstacles(old),[]);
});

t('Огненный остров: открывается с 10-го уровня за золото, своя земля, постройки не пересекаются с первым островом',()=>{
  let s=E.normalize(start0(founders()),0,null);s.bal.gold=100000;s.bal.gems=500;
  assert.ok(E.apply(s,ctx(0),{t:'isle2'}).err,'на 1-м уровне закрыт');
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'farm',x:4,y:4,isl:1}).err,'строить на закрытом нельзя');
  s.bal.xp=E.xpFor(E.ISLE2.L);s=E.normalize(s,0,null);
  const g0=s.bal.gold;s=ok(E.apply(s,ctx(0),{t:'isle2'}));assert.strictEqual(s.bal.gold,g0-E.ISLE2.gold);assert.strictEqual(E.extent(E.isle(s,1)).n,16);
  assert.ok(E.apply(s,ctx(0),{t:'isle2'}).err,'второй раз не открыть');
  /* ячейка занята на первом острове, а на втором свободна */
  const b0=s.bld[0];assert.ok(!E.canPlace(E.isle(s,0),b0.x,b0.y));assert.ok(E.canPlace(E.isle(s,1),b0.x,b0.y));
  s=ok(E.apply(s,ctx(0),{t:'build',type:'farm',x:b0.x,y:b0.y,isl:1}));const b=s.bld.find(x=>x.id===s.last);assert.strictEqual(b.isl,1);
  assert.ok(E.isle(s,1).bld.some(x=>x.id===b.id));assert.ok(!E.isle(s,0).bld.some(x=>x.id===b.id));
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'farm',x:b0.x,y:b0.y,isl:1}).err,'занято на втором');
  /* перенос внутри своего острова */
  const f=fr(s,1);s=ok(E.apply(s,ctx(0),{t:'move',id:b.id,x:f.x,y:f.y}));assert.strictEqual(s.bld.find(x=>x.id===b.id).x,f.x);
  /* сохранение с Огненным островом проходит проверку, а постройка с isl:1 без острова — нет */
  const r=E.repair(JSON.parse(JSON.stringify(s)));assert.deepStrictEqual(r.bad,[]);
  const bad=JSON.parse(JSON.stringify(s));delete bad.isl2;assert.ok(E.repair(bad).bad.length);
  assert.ok(E.unlocksAt(E.ISLE2.L).some(x=>x.startsWith(E.ISLE2.name)));
});

t('награда похода: первая победа полная, повтор пятая часть и не больше 5 в день, звёзды до боя из документа',()=>{
  let s=E.normalize(start0(founders()),0,null);const c=ctx(0,{today:'2026-10-28'}),n={id:'e3',rec:4};
  const g0=s.bal.gold,f0=s.bal.food,m0=s.bal.gems;
  s=ok(E.apply(s,c,{t:'pvewin',node:n,stars:2}));const g=s.got.pve;assert.ok(g.first);assert.ok(g.gold>=100&&g.food>0);
  assert.strictEqual(s.bal.gold,g0+g.gold);assert.strictEqual(s.bal.food,f0+g.food);assert.strictEqual(s.bal.gems,m0);
  /* звёзды в документе: следующая победа уже повтор */
  s.pve={v:1,best:{e3:2},wins:{e3:1},at:{}};
  const r1=ok(E.apply(s,c,{t:'pvewin',node:n,stars:3})).got.pve;assert.ok(!r1.first);assert.strictEqual(r1.gems,1,'первые три звезды');
  assert.ok(r1.gold>0&&r1.gold<g.gold);
  let x=s;for(let i=0;i<E.PVE_DAY;i++)x=ok(E.apply(x,c,{t:'pvewin',node:n,stars:2}));
  const capd=ok(E.apply(x,c,{t:'pvewin',node:n,stars:2})).got.pve;assert.ok(capd.cap);assert.strictEqual(capd.gold,0);
  /* на следующий день повторы снова награждаются */
  assert.ok(ok(E.apply(x,ctx(0,{today:'2026-10-29'}),{t:'pvewin',node:n,stars:2})).got.pve.gold>0);
  /* босс больше обычного боя и даёт самоцветы */
  const bs=E.pveGain({rec:4,boss:true},1,0);assert.ok(bs.gold>g.gold&&bs.gems>=3);
  assert.ok(E.apply(s,c,{t:'pvewin',node:n,stars:0}).err);
});

t('рынок: текст «большинство обычные, около десятой редкие, около сотой сверхредкие» совпадает с генератором',()=>{
  /* выборка генератора на 2000 seed для каждой стихии, а не настоящие покупки */
  for(const k of ['F','W','N','T','A','P']){const c=[0,0,0,0,0];let two=0;
    for(let i=0;i<2000;i++){const ph=G.phenotype(E.marketGenome(k,'audit:'+i));c[G.rarity(ph)]++;if(ph.elements.length>1||ph.elements.some(a=>a==='L'||a==='D'))two++}
    assert.strictEqual(two,0,k+': две стихии или свет/тьма с рынка');assert.strictEqual(c[4],0,k+': легендарный с рынка');
    assert.ok(c[0]/2000>0.8&&c[0]/2000<0.95,k+' обычных '+c[0]);assert.ok(c[1]/2000>0.05&&c[1]/2000<0.15,k+' редких '+c[1]);assert.ok(c[2]/2000<0.03,k+' сверхредких '+c[2])}
});

t('эпистаз из ревью: самка F/F s/s × самец W/W S/S дают 100 % F+W, хотя самка без стихии',()=>{
  const m=G.make({sex:'F',E:'F/F',S:'s/s'}),f=G.make({sex:'M',E:'W/W',S:'S/S'});
  assert.strictEqual(G.phenotype(m).breath,'dormant');assert.deepStrictEqual(G.dist(m,f,'elements'),{'F+W':1});
});

console.log(`\n${n-fails} из ${n} тестов прошли`);
process.exit(fails?1:0);
