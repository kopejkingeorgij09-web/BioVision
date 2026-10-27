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
  assert.strictEqual(E.chestNow(s,b1,100000),300,'сундук не больше вместимости');
  const r=E.apply(s,ctx(120),{t:'collect',id:'b1'});s=ok(r);
  assert.strictEqual(s.bal.gold,300+60);assert.strictEqual(r.s.got.gold,60);
});

t('стройка идёт в карточках и ускоряется самоцветами',()=>{
  let s=E.normalize(E.startState(founders()),0,null);E.settle(s,0);
  s=ok(E.apply(s,ctx(0),{t:'build',type:'farm',x:2,y:5}));
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'farm',x:4,y:8}).err,'третья ферма на 1-м уровне нельзя');
  const b=s.bld.find(x=>x.id===s.last);assert.ok(b.build);
  assert.strictEqual(E.left(b.build,3),3);
  s=E.normalize(s,6,null);assert.ok(!s.bld.find(x=>x.id===b.id).build,'готово через 6 карточек');
  s=E.normalize(E.startState(founders()),0,null);
  s.bal.gold=5000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);
  s=ok(E.apply(s,ctx(0),{t:'build',type:'T',x:2,y:5}));
  const id=s.last,g0=s.bal.gems;
  s=ok(E.apply(s,ctx(3),{t:'speed',id}));
  assert.strictEqual(g0-s.bal.gems,2,'15 карточек ожидания = 2 самоцвета');
  assert.ok(!s.bld.find(x=>x.id===id).build);
});

t('нельзя ставить на занятое место и за границу открытой земли',()=>{
  const s=E.normalize(E.startState(founders()),0,null);
  assert.ok(!E.canPlace(s,4,5),'занято Кальдерой');
  assert.ok(!E.canPlace(s,0,0),'угол закрыт');
  assert.ok(E.canPlace(s,4,8));
  assert.ok(E.apply(s,ctx(0),{t:'move',id:'b1',x:5,y:5}).err,'наезжает на Лагуну');
  assert.ok(!E.apply(s,ctx(0),{t:'move',id:'b1',x:4,y:8}).err);
});

t('грядки: созревают за карточки, урожай больше с серией',()=>{
  let s=E.normalize(E.startState(founders()),0,null);
  s=ok(E.apply(s,ctx(0),{t:'plant',id:'b3',plot:0,crop:'ember'}));
  assert.strictEqual(s.bal.gold,280);
  assert.ok(E.apply(s,ctx(4),{t:'harvest',id:'b3',plot:0}).err);
  const r=E.apply(s,ctx(5,{streak:10}),{t:'harvest',id:'b3',plot:0});s=ok(r);
  assert.strictEqual(r.s.got.food,Math.round(24*1.25));
  assert.ok(E.apply(s,ctx(5),{t:'plant',id:'b3',plot:0,crop:'vine'}).err,'лоза с 4-го уровня');
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
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'N',x:2,y:5}).err);
  s.bal.xp=E.xpFor(2);s=E.normalize(s,0,null);
  assert.strictEqual(E.level(s),2);assert.strictEqual(s.bal.gems,g+2);
  s=ok(E.apply(s,ctx(0),{t:'build',type:'N',x:2,y:5}));
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:8,y:8}).err);
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
  s=ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:2,y:5}));const nest=s.last;
  assert.ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:4,y:8}).err,'второе Гнездовье нельзя');
  s=ok(E.apply(s,ctx(0),{t:'build',type:'hatch',x:4,y:8}));const hat=s.last;
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

t('скрещивание: генотип яйца с зерном, а без места птенец ждёт в Инкубаторе',()=>{
  const mk=()=>{let s=E.normalize(E.startState(founders()),0,null);s.bal.gold=10000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);s.dragons.forEach(d=>d.lvl=3);
    s=ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:2,y:5}));s=ok(E.apply(s,ctx(0),{t:'build',type:'hatch',x:4,y:8}));return E.normalize(s,30,null)};
  const a=ok(E.apply(mk(),ctx(30),{t:'breed',id:'b4',mother:'d1',father:'d2'})),b=ok(E.apply(mk(),ctx(30),{t:'breed',id:'b4',mother:'d1',father:'d2'}));
  assert.deepStrictEqual(a.bld.find(x=>x.id==='b4').pair.egg,b.bld.find(x=>x.id==='b4').pair.egg);
  /* птенец огня/воды F/W или F/e x W/W: занять обе среды, чтобы места не было */
  let s=ok(E.apply(a,ctx(40),{t:'egg',id:'b4'}));s=E.normalize(s,300,null);
  const eg=s.bld.find(x=>x.id==='b5').slots[0];
  if(eg.viable){s.dragons.push({id:'x1',name:'x',genome:G.make({sex:'M',E:'F/W'}),lvl:1,fed:0,home:'b1'},{id:'x2',name:'y',genome:G.make({sex:'M',E:'W/W'}),lvl:1,fed:0,home:'b2'});
    const r=E.apply(s,ctx(300),{t:'hatch',id:'b5',plot:0});assert.ok(r.err&&/Нет свободного места/.test(r.err),r.err)}
});

t('прогноз: верный ускоряет вдвое и даёт самоцвет, неверный ничего не отнимает',()=>{
  let s=E.normalize(E.startState([{id:'d1',name:'a',genome:G.make({sex:'F',C:'C/c'})},{id:'d2',name:'b',genome:G.make({sex:'M',C:'C/c'})}]),0,null);
  s.bal.gold=10000;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);s.dragons.forEach(d=>d.lvl=3);
  s=ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:2,y:5}));s=E.normalize(s,20,null);const gm=s.bal.gems;
  const r=E.apply(s,ctx(20),{t:'breed',id:'b4',mother:'d1',father:'d2',pred:{trait:'color',value:'pale',p:0.25}});const s2=ok(r);
  assert.ok(r.s.got.pred.ok);assert.strictEqual(s2.bal.gems,gm+1);assert.strictEqual(s2.bld.find(x=>x.id==='b4').pair.need,Math.ceil(E.BREED_NEED/2));
  const r2=E.apply(s,ctx(20),{t:'breed',id:'b4',mother:'d1',father:'d2',pred:{trait:'color',value:'pale',p:0.5}});const s3=ok(r2);
  assert.ok(!r2.s.got.pred.ok);assert.strictEqual(Math.round(r2.s.got.pred.truth*100),25);assert.strictEqual(s3.bal.gems,gm);
});

t('потомство двух гетерозигот по окраске: около четверти бледных',()=>{
  let s=E.normalize(E.startState([{id:'d1',name:'a',genome:G.make({sex:'F',C:'C/c'})},{id:'d2',name:'b',genome:G.make({sex:'M',C:'C/c'})}]),0,null);
  s.bal.gold=1e7;s.bal.xp=E.xpFor(3);s=E.normalize(s,0,null);s.dragons.forEach(d=>d.lvl=3);
  s=ok(E.apply(s,ctx(0),{t:'build',type:'nest',x:2,y:5}));s=ok(E.apply(s,ctx(0),{t:'build',type:'hatch',x:4,y:8}));
  let K=30,pale=0,all=0;s=E.normalize(s,K,null);
  for(let i=0;i<400;i++){s=ok(E.apply(s,ctx(K),{t:'breed',id:'b4',mother:'d1',father:'d2'}));K+=20;s=ok(E.apply(s,ctx(K),{t:'egg',id:'b4'}));
    const eg=s.bld.find(x=>x.id==='b5').slots[0];all++;if(G.phenotype(eg.genome).color==='pale')pale++;s.bld.find(x=>x.id==='b5').slots[0]=null}
  assert.ok(Math.abs(pale/all-0.25)<0.07,pale/all);
});

t('препятствия: места постоянные, мешают стройке, расчищаются за золото',()=>{
  let s=E.normalize(start0([]),0,null);s.bal.gold=1000;
  const obs=E.obstacles(s);assert.ok(obs.length>=9,obs.length);assert.ok(!obs.some(o=>E.chunkOf(o.x,o.y)==='1,1'));
  const o=obs.find(z=>z.kind==='rock')||obs[0],x=Math.min(o.x,E.GRID-2),y=Math.min(o.y,E.GRID-2);
  assert.ok(!E.canPlace(s,x,y));
  const gm=s.bal.gems,s2=ok(E.apply(s,ctx(0),{t:'clear',cell:o.id}));
  assert.strictEqual(s2.bal.gold,1000-E.OBST_KIND[o.kind].gold);assert.strictEqual(s2.bal.gems,gm+(E.OBST_KIND[o.kind].gems||0));
  assert.ok(!E.obstacles(s2).some(z=>z.id===o.id));
  assert.ok(E.apply(s2,ctx(0),{t:'clear',cell:o.id}).err);
  /* закрытый участок: препятствий не видно, пока его не откроют */
  assert.ok(!obs.some(z=>E.chunkOf(z.x,z.y)==='0,0'));
});

console.log(`\n${n-fails} из ${n} тестов прошли`);
process.exit(fails?1:0);
