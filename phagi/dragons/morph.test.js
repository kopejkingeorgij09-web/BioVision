/* Автотесты рисунка драконов (морфология и геометрия): node phagi/dragons/morph.test.js
   Проверяют главное правило: внешность целиком вычисляется из фенотипа и уровня, сама ничего не придумывает. */
'use strict';
const assert=require('assert');
const D=require('./genetics.js');
global.MORPH=require('./morph.js');
global.SHAPE=require('./shape.js');
const MO=global.MORPH,SH=global.SHAPE,A=require('./art.js');

let fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}

const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const ph=spec=>D.phenotype(mk(spec));
const EL=['F','W','T','A','P','L','D'];

/* случайные генотипы: любой аллель любого локуса, оба пола */
function randomGenome(rnd){
  const pick=l=>{const a=D.LOCI[l].alleles;return a[Math.floor(rnd()*a.length)]};
  const sex=rnd()<0.5?'M':'F',s={sex};
  ['E','Q1','S','C','H','K','R','Wg','Q2','Q3'].forEach(l=>{s[l]=pick(l)+'/'+pick(l)});
  if(sex==='M'){s.M=pick('M')+'/'+pick('M');s.N=pick('N')+'/'+pick('N')}else{s.M=pick('M');s.N=pick('N');s.Sp=pick('Sp')}
  s.G=pick('G');
  return D.make(s)}
const rnd=D.rng('morph-test-1');
const RANDOM=Array.from({length:300},()=>randomGenome(rnd));

t('один и тот же фенотип и уровень дают одинаковую морфологию и одинаковый SVG',()=>{
  RANDOM.slice(0,60).forEach((g,i)=>{const p=D.phenotype(g),lv=1+i%20;
    assert.deepStrictEqual(MO.morph(p,lv),MO.morph(p,lv));
    assert.strictEqual(A.dragon(p,lv,{key:'a'}),A.dragon(p,lv,{key:'a'}))})});

t('морфология не меняет фенотип и не портит таблицы архетипов',()=>{
  const p=ph({E:'F/W'}),copy=JSON.parse(JSON.stringify(p)),arch=JSON.stringify(MO.ARCH);
  for(let lv=1;lv<=20;lv++){const M=MO.morph(p,lv);M.body.len=999;M.head.L=999;M.wing.span=999}
  assert.deepStrictEqual(p,copy);
  assert.strictEqual(JSON.stringify(MO.ARCH),arch)});

t('части тела есть ровно тогда, когда их даёт фенотип',()=>{
  RANDOM.forEach(g=>{const p=D.phenotype(g),M=MO.morph(p,12),parts=new Set(SH.build(M).layers.map(l=>l.part));
    assert.strictEqual(!!M.horns,p.horns,'рога');assert.strictEqual(parts.has('horns'),p.horns,'слой рогов');
    assert.strictEqual(!!M.mace,p.mace,'булава');assert.strictEqual(parts.has('mace'),p.mace,'слой булавы');
    assert.strictEqual(M.crest==null,p.crest==='none','гребень');
    if(M.crest)assert.strictEqual(M.crest.size,p.crest==='big'?2:1);
    assert.strictEqual(!!M.spurs,p.spurs,'шпоры у взрослого');assert.strictEqual(parts.has('spurs'),p.spurs,'слой шпор');
    assert.strictEqual(M.eyes.glow,p.glow,'свечение глаз');assert.strictEqual(M.eyes.night,p.night,'ночное зрение');
    assert.strictEqual(M.metal,p.metal,'блеск');assert.strictEqual(parts.has('metal'),p.metal,'слой блеска');
    assert.strictEqual(M.wing.short,p.shortWings,'короткие крылья');
    assert.strictEqual(M.breath,p.breath);assert.deepStrictEqual(M.elements,p.breath==='element'?p.elements:[])})});

t('шпоры появляются только с 4-го уровня, сияние только с 16-го',()=>{
  const p=D.phenotype(D.make(Object.assign({},BASE,{sex:'F',M:'m',N:'N',Sp:'Sp',E:'F/F'})));
  assert.ok(p.spurs);
  [1,2,3].forEach(lv=>assert.strictEqual(MO.morph(p,lv).spurs,null));
  [4,9,15,20].forEach(lv=>assert.ok(MO.morph(p,lv).spurs));
  for(let lv=1;lv<=20;lv++)assert.strictEqual(MO.morph(p,lv).aura,lv>=16?1:0)});

t('размах крыльев растёт с числом «+» в Q1–Q3, короткие крылья Wg перекрывают его',()=>{
  const q=k=>{const a=['-/-','+/-','+/+'];return {Q1:a[Math.min(2,k)],Q2:a[Math.max(0,Math.min(2,k-2))],Q3:a[Math.max(0,k-4)]}};
  let prev=0;for(let k=0;k<=6;k++){const s=MO.morph(ph(Object.assign({E:'F/F'},q(k))),12).wing.span;assert.ok(s>prev,'размах '+k);prev=s}
  const big=MO.morph(ph({E:'F/F',Q1:'+/+',Q2:'+/+',Q3:'+/+'}),12).wing.span,short=MO.morph(ph({E:'F/F',Q1:'+/+',Q2:'+/+',Q3:'+/+',Wg:'Wg/+'}),12).wing.span;
  assert.ok(short<big*0.5)});

t('чистая стихия берёт все части своего архетипа, у каждой стихии свой набор частей',()=>{
  const sets=EL.map(e=>{const M=MO.morph(ph({E:e+'/'+e}),12);
    Object.keys(M.arch).forEach(k=>{if(k!=='collar')assert.strictEqual(M.arch[k],e,e+' '+k)});
    return [M.wing.type,M.tailEnd,M.skin,M.horns.style].join(',')});
  assert.strictEqual(new Set(sets).size,EL.length)});

t('гибрид не зависит от порядка аллелей, у пары видны части обеих стихий',()=>{
  EL.forEach((a,i)=>EL.slice(i+1).forEach(b=>{
    const x=MO.morph(ph({E:a+'/'+b}),12),y=MO.morph(ph({E:b+'/'+a}),12);
    assert.deepStrictEqual(x,y,a+'/'+b);
    const used=new Set(Object.values(x.arch).filter(Boolean));
    assert.ok(used.has(a)&&used.has(b),a+'/'+b+': '+[...used])}))});

t('дремлющий ss и дымный ee рисуются нейтральным телом без примет стихии',()=>{
  [ph({E:'F/W',S:'s/s'}),ph({E:'e/e'})].forEach(p=>{const M=MO.morph(p,12);
    ['body','head','wing','tail','skin','crest'].forEach(k=>assert.strictEqual(M.arch[k],'N'));
    assert.strictEqual(M.collar,null);assert.strictEqual(M.aura,0)});
  /* признаки, не зависящие от стихии, у дремлющего остаются */
  const M=MO.morph(ph({E:'F/F',S:'s/s',H:'H/H',K:'K/k'}),12);assert.ok(M.horns&&M.mace)});

t('возраст меняет пропорции, а не только масштаб: у малыша голова и глаза крупнее',()=>{
  const p=ph({E:'W/A'}),a=MO.morph(p,2),b=MO.morph(p,12);
  assert.ok(a.scale<b.scale);
  assert.ok(a.head.L/a.body.len>b.head.L/b.body.len*1.3);
  assert.ok(a.eyes.size>b.eyes.size);assert.ok(a.wing.span<b.wing.span);
  assert.deepStrictEqual([0,1,2,3].map(s=>MO.STAGES[s].name),['малыш','подросток','взрослый','развитый взрослый']);
  [[1,0],[3,0],[4,1],[9,1],[10,2],[15,2],[16,3],[20,3]].forEach(([lv,s])=>assert.strictEqual(MO.stageOf(lv),s))});

t('геометрия без NaN и бесконечностей для 300 случайных генотипов на всех уровнях',()=>{
  RANDOM.forEach((g,i)=>{const lv=1+i%20,G=SH.build(MO.morph(D.phenotype(g),lv));
    G.layers.forEach(l=>assert.ok(!/NaN|Infinity/.test(l.d),l.part));
    ['x','y','w','h'].forEach(k=>assert.ok(Number.isFinite(G.box[k])))})});

t('каждая часть тела знает свои гены, а возрастное и оформление помечено отдельно',()=>{
  const M=MO.morph(ph({E:'F/F'}),18);
  ['horns','crest','mace','wings','eyes','metal','spurs'].forEach(k=>{assert.ok(M.src[k].length);M.src[k].forEach(l=>assert.ok(D.LOCI[l],l))});
  assert.ok(M.cosm.aura);assert.ok(!M.src.aura);
  assert.ok(M.age.wings&&M.age.horns)});

t('силуэт: SVG силуэта не выдаёт цвет, части подписаны для подсветки',()=>{
  const p=ph({E:'F/F',G:'G'}),s=A.dragon(p,12,{sil:true,key:'s'}),c=A.dragon(p,12,{key:'c'});
  const fills=new Set([...s.matchAll(/fill="([^"]+)"/g)].map(m=>m[1]));
  assert.deepStrictEqual([...fills],['#16121C']);
  ['body','head','wings','horns','legs','eyes'].forEach(k=>assert.ok(c.includes(`data-part="${k}"`),k))});

console.log(`\n${n-fails}/${n} тестов прошли`);
if(fails)process.exit(1);
