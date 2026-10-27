/* Автотесты похода: node phagi/dragons/campaign.test.js
   Данные боёв, открытие по порядку, запись звёзд без потерь и без накрутки, старые сохранения, проходимость. */
'use strict';
const assert=require('assert');
const C=require('./campaign.js'),D=require('./genetics.js'),B=require('./battle.js');
global.MORPH=require('./morph.js');const SH=require('./shape.js'),AN=require('./anim.js'),ST=require('./stats.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
function spec(id,g,lvl){const ph=D.phenotype(g),M=MORPH.morph(ph,lvl),G=SH.build(M),P=AN.profile(M,G.rig),s=ST.of(ph,lvl,P);return {id,lvl,els:ph.breath==='element'?ph.elements:[],hp:s.hp,atk:s.atk,def:s.def,spd:s.spd}}

t('шесть боёв, последний — босс, противники — настоящие генотипы модели, у всех разные id, уровень растёт',()=>{
  assert.strictEqual(C.BATTLES.length,6);assert.ok(C.BATTLES[5].boss&&!C.BATTLES.slice(0,5).some(b=>b.boss));
  const ids=new Set();let rec=0;
  C.BATTLES.forEach(b=>{const f=b.foes();assert.ok(f.length>=2&&f.length<=3);assert.ok(b.rec>=rec);rec=b.rec;
    f.forEach(x=>{assert.deepStrictEqual(D.validate(x.genome),[]);assert.ok(!ids.has(x.id));ids.add(x.id);assert.ok(D.viable(x.genome))})});
  assert.ok(C.BATTLES[5].foes()[0].lvl>C.BATTLES[0].foes()[0].lvl)});

t('бои открываются по порядку, первый открыт сразу',()=>{
  let p=C.progress(null);assert.ok(C.unlocked(p,'e1'));assert.ok(!C.unlocked(p,'e2'));
  p=C.record(p,'e1',2,'2026-10-27');assert.ok(C.unlocked(p,'e2'));assert.ok(!C.unlocked(p,'e3'));
  const q=C.record(p,'e4',3);assert.ok(!q.best.e4,'закрытый бой не записывается')});

t('лучшие звёзды не уменьшаются, поражение ничего не меняет, победы считаются',()=>{
  let p=C.record(C.progress({}),'e1',3,'2026-10-27');p=C.record(p,'e1',1,'2026-10-28');assert.strictEqual(p.best.e1,3);assert.strictEqual(p.wins.e1,2);
  const before=JSON.stringify(p);p=C.record(p,'e1',0,'2026-10-29');assert.strictEqual(JSON.stringify(p),before);
  p=C.record(p,'e1',7);assert.strictEqual(p.best.e1,3);assert.strictEqual(C.total(p),3)});

t('старые и битые сохранения: без pve пустой прогресс, мусор отбрасывается, исходный документ не меняется',()=>{
  assert.deepStrictEqual(C.progress({v:2}),{v:1,best:{},wins:{},at:{}});
  const doc={pve:{best:{e1:3,e2:'x',e9:3,e3:5},wins:{e1:-1,e2:2.5},at:{e1:20261027}}},snap=JSON.stringify(doc);
  const p=C.progress(doc);assert.deepStrictEqual(p.best,{e1:3});assert.deepStrictEqual(p.wins,{});assert.deepStrictEqual(p.at,{});
  C.record(p,'e2',3);assert.strictEqual(JSON.stringify(doc),snap)});

t('проходимость: тремя драконами на два уровня выше рекомендуемого бой выигрывается чаще чем в 70 % случаев',()=>{
  const BASE={S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',sex:'M',M:'m/m',N:'N/n'};
  const team=L=>['F/e','W/e','T/e'].map((E,i)=>spec('p'+i,D.make(Object.assign({},BASE,{E})),L));
  C.BATTLES.forEach(b=>{const foes=b.foes().map(f=>spec(f.id,f.genome,f.lvl));let w=0;
    for(let s=1;s<=60;s++)if(B.simulate(team(b.rec+2),foes,{seed:s,aiA:'normal',aiB:b.ai}).winner==='A')w++;
    assert.ok(w>=42,`${b.id}: ${w} из 60`)})});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
