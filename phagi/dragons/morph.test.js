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

t('у каждой части тела записаны гены наличия, формы и окраски, возраст и оформление отдельно',()=>{
  const M=MO.morph(ph({E:'F/F'}),18);
  Object.keys(MO.SRC).forEach(k=>{const s=M.src[k];assert.ok(s&&Array.isArray(s.has)&&Array.isArray(s.shape)&&Array.isArray(s.color),k);
    s.has.concat(s.shape,s.color).forEach(l=>assert.ok(D.LOCI[l],k+' '+l));
    Object.keys(s.why||{}).forEach(c=>{assert.ok(['has','shape','color'].includes(c),k+' why '+c);Object.keys(s.why[c]).forEach(l=>assert.ok(s[c].includes(l),k+' why '+c+' '+l))})});
  assert.ok(M.cosm.aura&&M.cosm.shadow);assert.ok(!M.src.aura&&!M.src.shadow);
  assert.ok(M.age.wings&&M.age.horns)});

/* Подпись части тела на рисунке: есть ли она, её контуры (форма) и краски (окраска).
   Слой относится к той части, которую изображает: тень от крыла на теле считается крылом (поле of).
   Свечение (градиент glow) считается окраской, а не формой. */
function partSigs(p,lvl){
  const M=MO.morph(p,lvl),G=SH.build(M),pl=M.pal,P=MO.paints(M),two=M.elements.length>1,out={};
  const GR={body:[pl.base,pl.light,pl.deep].concat(two?[pl.deep2]:[]),wing:[pl.wingDeep,pl.wing,pl.light2],horn:[pl.horn,pl.deep],ball:[P.mace],glow:[pl.glow],iris:[P.iris,P.irisDeep]};
  G.layers.forEach(l=>{const k=l.of||l.part,o=out[k]||(out[k]={shape:[],color:[]}),light=l.grad==='glow';
    if(!light)o.shape.push([l.d,l.blur||0,l.clip||'',l.stroke?1:0,l.sw||0,l.line||0].join('|'));
    const op='@'+(l.op==null?1:Math.round(l.op*100)/100);
    (l.line?[P[l.paint]]:l.grad?GR[l.grad]:l.paint==='aura'?[pl.accent]:[P[l.paint]]).forEach(c=>o.color.push(c+op+(light?l.d:'')));
    if(l.stroke)o.color.push('edge'+pl.edge)});
  Object.values(out).forEach(o=>{o.shape=o.shape.join('#');o.color=[...new Set(o.color)].sort().join(',')});
  return out}

t('карта генов src совпадает с рисунком: меняем по одному гену, меняется только записанное',()=>{
  const memo=new Map(),sig=(p,lv)=>{const k=JSON.stringify(p)+lv;if(!memo.has(k))memo.set(k,partSigs(p,lv));return memo.get(k)};
  const pairs=A=>{const o=[];A.forEach((x,i)=>A.slice(i).forEach(y=>o.push(x+'/'+y)));return o};
  const bases=['F/F','W/W','T/T','A/A','P/P','L/L','D/D','F/W','T/P','L/D','e/e','A/F'].map((e,i)=>{const f=i%2===1;
    const s={sex:f?'F':'M',E:e,S:i===3?'S/s':'S/S',C:['C/c','Cb/c','c/c','C/C'][i%4],H:i%3?'H/h':'h/h',K:i%4===2?'K/k':'k/k',R:['R1/R2','R1/R1','R2/R2'][i%3],
      Wg:i%5===4?'Wg/+':'+/+',Q1:'+/-',Q2:['+/+','-/-','+/-'][i%3],Q3:'+/-',G:i%4===3?'G':'g'};
    if(f){s.M=i%3?'M':'m';s.N=i%4===1?'n':'N';s.Sp=i%3===1?'Sp':'sp'}else{s.M=i%3?'M/m':'m/m';s.N=i%4===0?'n/n':'N/n'}
    return s});
  /* дымный без булавы: на нём видно, что E2 даёт стихию и кончик хвоста */
  bases.push({sex:'M',E:'e/e',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n',G:'g'});
  const bad=[],seen={},note=(k,l)=>{(seen[k]||(seen[k]=new Set())).add(l)};
  bases.forEach(b=>{const p0=D.phenotype(D.make(b));
    Object.keys(D.LOCI).forEach(L=>{
      if(L==='Sp'&&b.sex==='M')return;
      const one=L==='G'||(b.sex==='F'&&(L==='M'||L==='N'||L==='Sp'));
      (one?D.LOCI[L].alleles.slice():pairs(D.LOCI[L].alleles)).forEach(v=>{
        const g=D.make(Object.assign({},b,{[L]:v})),p1=D.phenotype(g);if(p1.lethal)return;
        [2,12,18].forEach(lv=>{const a=sig(p0,lv),c=sig(p1,lv);
          new Set(Object.keys(a).concat(Object.keys(c))).forEach(part=>{
            if(MO.morph(p0,lv).cosm[part])return;
            const src=MO.SRC[part];if(!src){bad.push(part+': нет в карте');return}
            const x=a[part],y=c[part],why=part+' '+L+' ('+b.E+', '+v+', ур. '+lv+')';
            if(!!x!==!!y){note(part+'.has',L);if(!src.has.includes(L))bad.push('наличие '+why);return}
            if(!x)return;
            if(x.shape!==y.shape){note(part+'.shape',L);if(!src.has.includes(L)&&!src.shape.includes(L))bad.push('форма '+why)}
            if(x.color!==y.color){note(part+'.color',L);if(!src.color.includes(L))bad.push('окраска '+why)}})})})})});
  assert.deepStrictEqual(bad.slice(0,8),[],'не записано в карте');
  /* и обратно: каждый записанный ген хоть где-то меняет то, что про него сказано */
  const idle=[];Object.keys(MO.SRC).forEach(part=>['has','shape','color'].forEach(k=>MO.SRC[part][k].forEach(L=>{
    if(!(seen[part+'.'+k]||new Set()).has(L))idle.push(part+'.'+k+' '+L)})));
  assert.deepStrictEqual(idle,[],'записано, но не влияет: '+idle.join('; '))});

t('силуэт: SVG силуэта не выдаёт цвет, части подписаны для подсветки',()=>{
  const p=ph({E:'F/F',G:'G'}),s=A.dragon(p,12,{sil:true,key:'s'}),c=A.dragon(p,12,{key:'c'});
  const fills=new Set([...s.matchAll(/fill="([^"]+)"/g)].map(m=>m[1]));
  assert.deepStrictEqual([...fills],['#16121C']);
  ['body','head','wings','horns','legs','eyes'].forEach(k=>assert.ok(c.includes(`data-part="${k}"`),k))});

console.log(`\n${n-fails}/${n} тестов прошли`);
if(fails)process.exit(1);
