/* Автотесты атак: node phagi/dragons/attacks.test.js
   Попадание ровно одно при любом шаге кадра, фазы по порядку, предел частиц, «меньше движения» без тряски и вспышек,
   у гибрида две атаки, модуль атак не считает урон. Картинку эти тесты не заменяют: смотреть attacks.html. */
'use strict';
const assert=require('assert'),fs=require('fs');
const A=require('./attacks.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
/* подменный холст: всё принимает и ничего не рисует */
const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:(o,k,v)=>{o[k]=v;return true}});
const mk=(el,o)=>new A.Run(Object.assign({el,from:()=>[0,-22],to:()=>[120,-20],h:26,seed:3},o||{}));
function play(r,steps){const ev=[];let i=0;while(!r.done&&i<5000){const dt=steps(i++);ev.push(...r.update(dt));r.draw(ctx)}return ev}

t('попадание ровно одно у всех семи атак при любом шаге кадра (1/60, 1/15, случайный, 0,25 с)',()=>{
  const S=[()=>1/60,()=>1/15,(i)=>[0.001,0.05,0.2,0.016][i%4],()=>0.25];
  A.ORDER.forEach(el=>S.forEach((s,k)=>{const r=mk(el),ev=play(r,s);
    assert.strictEqual(ev.filter(e=>e.type==='impact').length,1,`${el}, шаг ${k}: попаданий не одно`);
    assert.ok(r.done,`${el}: атака не закончилась`);assert.strictEqual(ev.filter(e=>e.type==='end').length,1)}))});

t('фазы идут по порядку, выпуск раньше попадания, попадание в начале фазы «попадание»',()=>{
  A.ORDER.forEach(el=>{const r=mk(el),ev=play(r,()=>1/60),ph=ev.filter(e=>e.type==='phase').map(e=>e.name);
    assert.deepStrictEqual(ph,['prep','charge','main','travel','hit','react','recover'],el+': '+ph);
    const li=ev.findIndex(e=>e.type==='launch'),ii=ev.findIndex(e=>e.type==='impact');assert.ok(li>=0&&ii>li,el);
    assert.ok(Math.abs(r.tl.impact-r.tl.phases.find(p=>p.name==='hit').t0)<1e-9);
    assert.ok(Math.abs(r.tl.launch-0.55)<1e-9,el+': выпуск не в 0,55 с')})});

t('частиц одновременно не больше предела, при «меньше движения» предел ниже, а тряски и вспышек нет',()=>{
  A.ORDER.forEach(el=>{let mx=0;const r=mk(el);play(r,()=>{mx=Math.max(mx,r.p.length);return 1/60});assert.ok(mx<=A.MAXP,`${el}: ${mx}`);
    let mr=0,sh=0,fl=0;const q=mk(el,{reduce:true});play(q,()=>{mr=Math.max(mr,q.p.length);sh=Math.max(sh,q.shake);fl=Math.max(fl,q.flash);return 1/60});
    assert.ok(mr<=A.MAXP_R,`${el} (меньше движения): ${mr}`);assert.strictEqual(sh,0);assert.strictEqual(fl,0);
    assert.ok(q.tl.total<r.tl.total,el+': при меньше движения атака не короче')})});

t('одинаковое зерно — одинаковая атака',()=>{
  const trace=()=>{const r=mk('F'),out=[];play(r,()=>{out.push(r.p.length);return 1/60});return out.join()};
  assert.strictEqual(trace(),trace())});

t('точка попадания — где была цель перед попаданием; дальше цель может двигаться, событие с той же точкой',()=>{
  let x=120;const r=new A.Run({el:'D',from:()=>[0,-20],to:()=>[x,-20],h:26}),ev=[];
  while(!r.done){ev.push(...r.update(1/60));if(r.fired)x=500}
  const imp=ev.find(e=>e.type==='impact');assert.ok(Math.abs(imp.at[0]-120)<1e-9,'точка попадания '+imp.at[0])});

t('у гибрида две атаки, у дракона без проявленной стихии — валун',()=>{
  assert.deepStrictEqual(A.elementsOf({elements:['F','W']}),['F','W']);assert.deepStrictEqual(A.elementsOf({elements:[]}),['T']);
  assert.strictEqual(A.ORDER.length,7);A.ORDER.forEach(e=>assert.ok(A.ATTACKS[e].name))});

t('атаки отдельно от логики боя: attacks.js не знает об уроне, здоровье и генах',()=>{
  const src=fs.readFileSync(__dirname+'/attacks.js','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/damage|\bhp\b|health|DRG|genotype|allele/i.test(src))});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
