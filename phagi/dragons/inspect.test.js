/* Автотесты осмотра дракона: node phagi/dragons/inspect.test.js
   Чистая часть inspect.js (генотип по хромосомам, гены части тела, какие части есть, попадание по части)
   и характеристики stats.js. Сцену, камеру и касания проверяет браузерный сценарий, эти тесты его не заменяют. */
'use strict';
const assert=require('assert');
const D=require('./genetics.js');
global.MORPH=require('./morph.js');
const MO=global.MORPH,SH=require('./shape.js'),AN=require('./anim.js'),I=require('./inspect.js'),ST=require('./stats.js');

let fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}

const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n',E:'F/W'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const fem=spec=>mk(Object.assign({sex:'F',M:'M',N:'n',Sp:'Sp',G:'G'},spec));
const geo=(g,lvl)=>{const M=MO.morph(D.phenotype(g),lvl||12);return {M,G:SH.build(M)}};
const block=(m,id)=>m.blocks.find(b=>b.id===id);

t('генотип по хромосомам: строки — гомологи как в сохранении, сцепление H–K видно',()=>{
  const g=mk({H:'H/h',K:'k/K',R:'R1/R2'}),m=I.genoModel(g),a3=block(m,'A3');
  assert.deepStrictEqual(a3.loci,['H','K','R']);
  assert.deepStrictEqual(a3.rows.map(r=>r[1]),[g.A3[0],g.A3[1]]);
  assert.deepStrictEqual(a3.links,[{a:'H',b:'K',r:0.18}]);
  assert.strictEqual(m.blocks.filter(b=>/^A\d$/.test(b.id)).length,4)});

t('самец: две Z, M и N сцеплены, гена шпор нет; самка: одна Z и W с геном Sp',()=>{
  const z=block(I.genoModel(mk({M:'M/m',N:'N/n'})),'Z');
  assert.strictEqual(z.rows.length,2);assert.deepStrictEqual(z.links,[{a:'M',b:'N',r:0.1}]);assert.ok(!z.w);assert.ok(/Sp/.test(z.note));
  const f=block(I.genoModel(fem({})),'Z');
  assert.strictEqual(f.rows.length,1);assert.deepStrictEqual(f.links,[]);
  assert.deepStrictEqual(f.w.rows,[['W',['Sp']]]);assert.ok(/гемизиготна/.test(f.note))});

t('митохондрии одной копией, не парой аллелей',()=>{
  const b=block(I.genoModel(fem({G:'G'})),'mt');
  assert.strictEqual(b.mt,'G');assert.ok(!b.rows);assert.ok(/от матери/.test(b.note));
  assert.strictEqual(I.allelesText(fem({G:'g'}),'G'),'g (митохондрии)')});

t('аллели по месту гена: аутосома парой, Z у самки одна, Sp у самца отсутствует',()=>{
  const f=fem({N:'n'}),m=mk({});
  assert.strictEqual(I.allelesText(m,'H'),'H/h');
  assert.strictEqual(I.allelesText(m,'R'),'R¹/R²');
  assert.strictEqual(I.allelesText(f,'N'),'n (одна Z)');
  assert.strictEqual(I.allelesText(f,'Sp'),'Sp (на W)');
  assert.ok(/нет W/.test(I.allelesText(m,'Sp')));
  assert.strictEqual(I.allelesOf(m,'E').chr,'A1')});

t('«видно» берётся из фенотипа движка: ss гасит стихию, W в локусе E — вода',()=>{
  const sl=I.genoModel(mk({S:'s/s',E:'F/F'})),a1=block(sl,'A1');
  assert.ok(/не проявляется/.test(a1.show[0]));
  assert.strictEqual(block(I.genoModel(mk({E:'W/W'})),'A1').show[0],'Вода');
  assert.strictEqual(block(I.genoModel(mk({E:'e/e'})),'A1').show[0],'стихии нет, дымный');
  const q=block(I.genoModel(mk({Q1:'+/+',Q2:'+/+',Q3:'+/-'})),'A4').show;
  assert.ok(/«\+» 5 из 6/.test(q[1])&&q[1]===q[2])});

t('гены части тела из MORPH.SRC с аллелями этого дракона; возраст и оформление отдельно',()=>{
  const g=mk({H:'H/h'}),{M}=geo(g),h=I.partInfo(M,g,'horns');
  const has=h.rows.find(r=>r.c==='has');assert.deepStrictEqual(has.loci.map(x=>[x.l,x.al]),[['H','H/h']]);
  assert.ok(h.age&&!h.cosm);
  const w=I.partInfo(M,g,'wings').rows.find(r=>r.c==='shape').loci.map(x=>x.l);
  ['Wg','Q1','Q2','Q3','E','S'].forEach(l=>assert.ok(w.includes(l),l));
  const au=I.partInfo(M,g,'aura');assert.ok(au.cosm);assert.strictEqual(au.rows.length,0)});

t('части тела у дракона: только те, что нарисованы',()=>{
  const p1=I.partsHere(geo(fem({H:'H/H',K:'K/k'}),12).G);
  ['horns','mace','spurs','wings','legs','head','body','eyes','breath'].forEach(k=>assert.ok(p1.includes(k),k));
  assert.ok(!p1.includes('tailEnd'));
  const p2=I.partsHere(geo(mk({H:'h/h',K:'k/k',R:'R2/R2'}),12).G);
  ['horns','mace','spurs','crest'].forEach(k=>assert.ok(!p2.includes(k),k));
  assert.ok(!I.partsHere(geo(mk({S:'s/s'}),12).G).includes('breath'));
  assert.ok(!I.partsHere(geo(fem({}),2).G).includes('spurs'));   /* шпоры с 4-го уровня */
  p1.forEach(k=>assert.ok(I.PART[k],k))});

t('нажатие по части рига даёт часть тела; слой в точке уточняет голову и туловище',()=>{
  const {M}=geo(mk({K:'K/k'})),{M:M2}=geo(mk({K:'k/k'}));
  assert.strictEqual(I.bodyPartOf('tailTip',M),'mace');assert.strictEqual(I.bodyPartOf('tailTip',M2),'tailEnd');
  assert.strictEqual(I.bodyPartOf('NFs',M),'spurs');assert.strictEqual(I.bodyPartOf('FHu',M),'legs');assert.strictEqual(I.bodyPartOf('NHf',M),'legs');
  assert.strictEqual(I.bodyPartOf('wingFar',M),'wings');assert.strictEqual(I.bodyPartOf('neckCr',M),'crest');assert.strictEqual(I.bodyPartOf('lid',M),'eyes');
  assert.strictEqual(I.bodyPartOf('ground',M),null);
  assert.strictEqual(I.bodyPartOf('head',M,()=>'horns'),'horns');assert.strictEqual(I.bodyPartOf('head',M,()=>null),'head');
  assert.strictEqual(I.bodyPartOf('trunk',M,()=>'skin'),'skin');
  assert.strictEqual(I.bodyPartOf('trunk',M,()=>'wings'),'body');   /* тень крыла на теле — это тело */
  assert.strictEqual(I.bodyPartOf('tail',M,()=>null),'body')});

/* ---------- характеристики ---------- */
const prof=(g,lvl)=>{const {M,G}=geo(g,lvl);return {ph:D.phenotype(g),P:AN.profile(M,G.rig)}};
t('характеристики: сумма вкладов, уровень растит здоровье, атаку и защиту, но не скорость',()=>{
  const g=mk({}),a=prof(g,1),b=prof(g,20),s1=ST.of(a.ph,1,a.P),s20=ST.of(b.ph,20,b.P);
  const sum=(s,k)=>s.src[k].reduce((x,[,v])=>x+v,0);
  ['hp','atk','def'].forEach(k=>assert.strictEqual(s1[k],Math.round(sum(s1,k))));
  assert.strictEqual(s20.lvlK,1+0.08*19);
  ['hp','atk','def'].forEach(k=>assert.strictEqual(s20[k],Math.round(sum(s20,k)*s20.lvlK)));
  assert.strictEqual(s20.spd,sum(s20,'spd'));
  assert.ok(s20.hp>s1.hp&&s20.atk>s1.atk);assert.ok(/условность/.test(s1.note))});

t('характеристики следуют признакам: рога и булава дают атаку, тяжёлая Земля крепче Воздуха',()=>{
  const ad=12,with_=prof(mk({H:'H/H',K:'K/K'}),ad),none=prof(mk({H:'h/h',K:'k/k'}),ad);
  assert.strictEqual(ST.of(with_.ph,1,with_.P).atk-ST.of(none.ph,1,none.P).atk,6);
  const T=prof(mk({E:'T/T'}),ad),A=prof(mk({E:'A/A'}),ad),sT=ST.of(T.ph,ad,T.P),sA=ST.of(A.ph,ad,A.P);
  assert.ok(sT.hp>sA.hp&&sT.def>sA.def,'Земля крепче');
  assert.ok(sA.spd>sT.spd,'Воздух быстрее');
  assert.ok(sA.src.spd.some(([l])=>/Полёт/.test(l))===A.P.canFly)});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
