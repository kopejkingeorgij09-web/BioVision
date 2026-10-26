/* Автотесты экономики острова: node phagi/dragons/economy.test.js */
'use strict';
const assert=require('assert');
global.DRG=require('./genetics.js');
const E=require('./economy.js'),G=global.DRG;

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

console.log(`\n${n-fails} из ${n} тестов прошли`);
process.exit(fails?1:0);
