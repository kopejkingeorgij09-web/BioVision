/* Генетика драконов: модельный объект для скрещиваний на острове.
   Дракон диплоидный, 2n = 10: четыре пары аутосом (A1–A4) и половые хромосомы, самец ZZ, самка ZW.
   Хромосома = упорядоченные гены и частота рекомбинации r между соседними (без интерференции, r = 0.5 значит «как на разных хромосомах»).
   Потомство считается только через мейоз и слияние гамет: таблиц «родители → результат» здесь нет.
   Работает в браузере (window.DRG) и в node (module.exports) для автотестов. */
(function(root){
'use strict';

/* ---------- гены ---------- */
const LOCI={
  E:{name:'Стихия',alleles:['F','W','T','A','P','e','L','D']},
  Q1:{name:'Размах крыльев 1',alleles:['+','-']},
  /* E2 — вторая стихия, расширение модели с 28.10.2026 (версия генома 2). Нейтральный аллель 0 ничего не даёт,
     стихийные кодоминантны и добавляются к стихиям E. Так у дракона бывает три или четыре стихии, а в одном
     диплоидном гене по-прежнему две копии. Сами стихии выдуманы, механизм (несколько генов, кодоминирование, эпистаз) настоящий */
  E2:{name:'Вторая стихия',alleles:['0','F','W','T','A','P','L','D']},
  S:{name:'Искра',alleles:['S','s']},
  C:{name:'Окрас',alleles:['C','Cb','c']},
  H:{name:'Рога',alleles:['H','h']},
  K:{name:'Хвост-булава',alleles:['K','k']},
  R:{name:'Гребень',alleles:['R1','R2']},
  Wg:{name:'Короткие крылья',alleles:['Wg','+']},
  Q2:{name:'Размах крыльев 2',alleles:['+','-']},
  Q3:{name:'Размах крыльев 3',alleles:['+','-']},
  M:{name:'Блеск чешуи',alleles:['M','m']},
  N:{name:'Ночное зрение',alleles:['N','n']},
  Sp:{name:'Шпоры',alleles:['Sp','sp']},
  G:{name:'Свечение глаз',alleles:['G','g']}
};
/* r[i] — частота рекомбинации между loci[i] и loci[i+1] */
const CHROMS={
  A1:{loci:['E','Q1','E2'],r:[0.5,0.5]},
  A2:{loci:['S','C'],r:[0.5]},
  A3:{loci:['H','K','R'],r:[0.18,0.5]},
  A4:{loci:['Wg','Q2','Q3'],r:[0.5,0.5]}
};
const Z={loci:['M','N'],r:[0.10]};
const AUTO=Object.keys(CHROMS);
/* версия генома: 1 — до E2 (в A1 два гена), 2 — с E2 */
const GV=2;
/* старый геном (A1 из двух генов, дракон, яйцо или запись архива) получает E2 = 0/0: фенотип, остальные аллели и фаза те же.
   Детерминированно и повторно безопасно: уже новый геном возвращается как есть. Исходный объект не меняется */
function upgrade(g){
  if(!g||typeof g!=='object'||!Array.isArray(g.A1))return g;
  if(g.A1.every(h=>Array.isArray(h)&&h.length===3))return g;
  if(!g.A1.every(h=>Array.isArray(h)&&h.length===2))return g;
  const n=JSON.parse(JSON.stringify(g));n.A1=n.A1.map(h=>h.concat('0'));n.gv=GV;return n}
const isOld=g=>!!g&&Array.isArray(g.A1)&&g.A1.length===2&&g.A1.every(h=>Array.isArray(h)&&h.length===2);

const ELEM={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const ELEM_ORDER=['F','W','T','A','P','L','D'];
const LEGEND=['L','D'];

/* ---------- мутации ----------
   В каждой гамете каждый ген с вероятностью MU меняет аллель. У Стихии мутация в треть случаев
   даёт Свет или Тьму: только так эти аллели и появляются, выпадения легендарных нет. */
const MU=1/400;
function mutate(locus,a,rnd){
  if(rnd()>=MU)return a;
  const al=LOCI[locus].alleles;
  if(locus==='E'||locus==='E2'){
    if(rnd()<1/3)return LEGEND[rnd()<0.5?0:1];
    const pool=al.filter(x=>x!==a&&!LEGEND.includes(x)&&!(locus==='E2'&&x==='e'));return pool[Math.floor(rnd()*pool.length)];
  }
  const pool=al.filter(x=>x!==a);return pool[Math.floor(rnd()*pool.length)];
}

/* ---------- случайность с зерном: одно и то же скрещивание нельзя «перебросить» ---------- */
function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}return h>>>0}
function rng(seed){let a=typeof seed==='number'?seed>>>0:hashStr(String(seed));
  return function(){a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

/* ---------- геном ----------
   {sex:'F'|'M', A1:[[...],[...]], ..., Z:[[M,N],[M,N]|null], W:'Sp'|'sp'|null, mt:'G'|'g'}
   Для каждой пары: [0] от матери, [1] от отца. У самки Z[1] = null (вторая хромосома W). */
function clone(g){return JSON.parse(JSON.stringify(g))}

function validate(g){
  const err=[];
  if(!g||(g.sex!=='F'&&g.sex!=='M'))return ['пол'];
  AUTO.forEach(c=>{const p=g[c];if(!Array.isArray(p)||p.length!==2)return err.push(c);
    p.forEach(h=>{if(!Array.isArray(h)||h.length!==CHROMS[c].loci.length)err.push(c);else h.forEach((a,i)=>{if(!LOCI[CHROMS[c].loci[i]].alleles.includes(a))err.push(c+':'+a)})})});
  const z=g.Z;
  if(!Array.isArray(z)||z.length!==2)err.push('Z');
  else{
    const zs=g.sex==='M'?z:[z[0]];
    zs.forEach(h=>{if(!Array.isArray(h)||h.length!==2||!LOCI.M.alleles.includes(h[0])||!LOCI.N.alleles.includes(h[1]))err.push('Z')});
    if(g.sex==='F'&&z[1]!==null)err.push('Z');
  }
  if(g.sex==='F'&&!LOCI.Sp.alleles.includes(g.W))err.push('W');
  if(g.sex==='M'&&g.W!=null)err.push('W');
  if(!LOCI.G.alleles.includes(g.mt))err.push('mt');
  return err;
}

/* Удобная запись генотипа: make({sex:'F',E:'F/e',S:'S/s',H_K_R:'HK R1/hk R2',...}).
   Для сцепленных генов пишется по гаплотипу через «/», порядок генов как в CHROMS. */
function make(spec){
  const g={sex:spec.sex};
  const pairOf=(loci,def)=>{
    const h=[[],[]];
    loci.forEach((l,i)=>{const v=spec[l]!=null?String(spec[l]):def[i];const [a,b]=v.split('/');h[0].push(a);h[1].push(b==null?a:b)});
    return h};
  const DEF={E:'e/e',E2:'0/0',Q1:'-/-',S:'S/S',C:'C/C',H:'H/H',K:'K/K',R:'R1/R1',Wg:'+/+',Q2:'-/-',Q3:'-/-',M:'m/m',N:'N/N'};
  AUTO.forEach(c=>{g[c]=pairOf(CHROMS[c].loci,CHROMS[c].loci.map(l=>DEF[l]))});
  if(spec.sex==='M'){g.Z=pairOf(Z.loci,Z.loci.map(l=>DEF[l]));g.W=null}
  else{const z=pairOf(Z.loci,Z.loci.map(l=>DEF[l]));g.Z=[z[0],null];g.W=spec.Sp||'sp'}
  g.mt=spec.G||'g';g.gv=GV;
  const e=validate(g);if(e.length)throw new Error('bad genotype: '+e.join(','));
  return g;
}

/* ---------- мейоз ---------- */
function crossHap(pair,rs,rnd){
  let s=rnd()<0.5?0:1;const out=[pair[s][0]];
  for(let i=1;i<pair[0].length;i++){if(rnd()<rs[i-1])s^=1;out.push(pair[s][i])}
  return out}

/* гамета: {A1:[...],..., sexChr:'Z'|'W', Z:[...]|null, W:'Sp'|..., mt:'G'|null} */
function gamete(g,rnd,noMut){
  const m=noMut?(l,a)=>a:(l,a)=>mutate(l,a,rnd);
  const gm={};
  AUTO.forEach(c=>{gm[c]=crossHap(g[c],CHROMS[c].r,rnd).map((a,i)=>m(CHROMS[c].loci[i],a))});
  if(g.sex==='M'){gm.sexChr='Z';gm.Z=crossHap(g.Z,Z.r,rnd).map((a,i)=>m(Z.loci[i],a));gm.W=null;gm.mt=null}
  else{
    if(rnd()<0.5){gm.sexChr='Z';gm.Z=g.Z[0].map((a,i)=>m(Z.loci[i],a));gm.W=null}
    else{gm.sexChr='W';gm.Z=null;gm.W=m('Sp',g.W)}
    gm.mt=m('G',g.mt);
  }
  return gm}

function fuse(egg,sperm){
  const g={sex:egg.sexChr==='W'?'F':'M'};
  AUTO.forEach(c=>{g[c]=[egg[c],sperm[c]]});
  if(g.sex==='M'){g.Z=[egg.Z,sperm.Z];g.W=null}else{g.Z=[sperm.Z,null];g.W=egg.W}
  g.mt=egg.mt;
  return g}

/* Летальность: Wg/Wg гибнет в яйце. */
function viable(g){const a=g.A4[0][0],b=g.A4[1][0];return !(a==='Wg'&&b==='Wg')}

/* Одно яйцо: {genome, viable} */
function breed(mother,father,rnd){
  if(mother.sex!=='F'||father.sex!=='M')throw new Error('нужны самка и самец');
  const g=fuse(gamete(mother,rnd),gamete(father,rnd));
  return {genome:g,viable:viable(g)}}

/* ---------- фенотип ---------- */
const has=(p,a)=>p[0]===a||p[1]===a;
const pairAt=(g,c,l)=>{const i=CHROMS[c].loci.indexOf(l);return [g[c][0][i],g[c][1][i]]};

function phenotype(g){
  const E=pairAt(g,'A1','E').concat(CHROMS.A1.loci.includes('E2')&&g.A1[0].length===3?pairAt(g,'A1','E2'):[]),S_=pairAt(g,'A2','S'),C=pairAt(g,'A2','C'),H=pairAt(g,'A3','H'),K=pairAt(g,'A3','K'),R=pairAt(g,'A3','R'),Wg=pairAt(g,'A4','Wg');
  const ph={sex:g.sex};
  /* стихия: аллели F W T A P L D кодоминантны, e рецессивен; ss (нет искры) гасит любую стихию */
  if(!has(S_,'S')){ph.breath='dormant';ph.elements=[]}
  else{const el=[...new Set(E.filter(a=>a!=='e'&&a!=='0'))].sort((a,b)=>ELEM_ORDER.indexOf(a)-ELEM_ORDER.indexOf(b));
    ph.elements=el;ph.breath=el.length?'element':'smoke'}
  ph.color=has(C,'C')?'dark':has(C,'Cb')?'bronze':'pale';
  ph.horns=has(H,'H');
  ph.mace=has(K,'K');
  const r1=(R[0]==='R1')+(R[1]==='R1');ph.crest=r1===2?'big':r1===1?'mid':'none';
  ph.shortWings=has(Wg,'Wg');
  /* размах: аддитивный признак, каждый «+» добавляет 0,5 м к базовым 3 м */
  let plus=0;[['A1','Q1'],['A4','Q2'],['A4','Q3']].forEach(([c,l])=>{const p=pairAt(g,c,l);plus+=(p[0]==='+')+(p[1]==='+')});
  ph.span=plus;ph.spanM=3+plus*0.5;
  if(g.sex==='M'){ph.metal=has([g.Z[0][0],g.Z[1][0]],'M');ph.night=g.Z[0][1]==='n'&&g.Z[1][1]==='n'}
  else{ph.metal=g.Z[0][0]==='M';ph.night=g.Z[0][1]==='n'}
  ph.spurs=g.sex==='F'&&g.W==='Sp';
  ph.glow=g.mt==='G';
  return ph}

/* боевой ранг: сколько разных стихийных атак доступно (0 — дымный или дремлющий). Не редкость и не частота генотипа */
function combatRank(ph){return ph.breath==='element'?ph.elements.length:0}
/* вид: по стихиям (или дым/дремлющий). */
function speciesKey(ph){return ph.breath==='dormant'?'dormant':ph.breath==='smoke'?'smoke':ph.elements.join('')}

/* Редкость следует из того, насколько трудно вывести фенотип */
const RARITY=['обычный','редкий','сверхредкий','эпический','легендарный'];
function rarity(ph){
  if(ph.elements.some(a=>LEGEND.includes(a)))return 4;
  let p=0;
  if(ph.elements.length>=2)p+=2;      /* три-четыре стихии экономику не умножают: редкость как у двух */
  if(ph.color==='pale')p+=1;else if(ph.color==='bronze')p+=0.5;
  if(ph.night)p+=1;
  if(ph.glow)p+=1;
  if(!ph.horns&&ph.mace||ph.horns&&!ph.mace)p+=0.5;
  if(ph.crest==='none')p+=0.5;
  if(ph.span>=5)p+=1;
  return p>=5?3:p>=3?2:p>=2?1:0}

/* ---------- точные вероятности (без мутаций) ----------
   Для каждой хромосомы считаем распределение гаплотипов гамет, потом пары у потомка.
   Признаку нужны только свои хромосомы, поэтому перебор маленький. */
function hapDist(pair,rs){
  const out=new Map(),n=pair[0].length;
  const walk=(i,s,acc,p)=>{
    if(i===n){const k=acc.join(',');out.set(k,(out.get(k)||0)+p);return}
    if(i===0){walk(1,0,[pair[0][0]],p*0.5);walk(1,1,[pair[1][0]],p*0.5);return}
    const r=rs[i-1];
    if(r<1)walk(i+1,s,acc.concat(pair[s][i]),p*(1-r));
    if(r>0)walk(i+1,s^1,acc.concat(pair[s^1][i]),p*r);
  };
  walk(0,0,[],1);
  return [...out].map(([k,p])=>({h:k.split(','),p}))}

/* распределение потомков по частям генома: [{part:{A1:[[..],[..]],...,sex,Z,W,mt}, p}] */
function offspringParts(mother,father,chroms){
  let acc=[{g:{},p:1}];
  /* перед перемножением варианты одной хромосомы сливаются, если дают одинаковый фенотип (и одинаковую жизнеспособность)
     при остальных хромосомах по умолчанию: признаки модели складываются из хромосом независимо, поэтому так ничего не
     теряется, а перебор остаётся маленьким и с геном E2 (без слияния признак «редкость» перебирал бы десятки миллионов) */
  const squash=list=>{const m=new Map();list.forEach(b=>{const full=completeOf(b.g),k=JSON.stringify(phenotype(full))+viable(full);
    const x=m.get(k);if(x)x.p+=b.p;else m.set(k,{g:b.g,p:b.p})});return [...m.values()]};
  const mul=list=>{list=squash(list);const n=[];acc.forEach(a=>list.forEach(b=>n.push({g:Object.assign({},a.g,b.g),p:a.p*b.p})));acc=n};
  chroms.forEach(c=>{
    if(AUTO.includes(c)){const m=hapDist(mother[c],CHROMS[c].r),f=hapDist(father[c],CHROMS[c].r),l=[];
      m.forEach(x=>f.forEach(y=>l.push({g:{[c]:[x.h,y.h]},p:x.p*y.p})));mul(l)}
  });
  if(chroms.includes('sex')){
    const f=hapDist(father.Z,Z.r),l=[];
    f.forEach(y=>{
      l.push({g:{sex:'M',Z:[mother.Z[0],y.h],W:null},p:0.5*y.p});
      l.push({g:{sex:'F',Z:[y.h,null],W:mother.W},p:0.5*y.p});
    });mul(l)}
  if(chroms.includes('mt'))mul([{g:{mt:mother.mt},p:1}]);
  return acc}

/* Нужные хромосомы для признака */
const TRAIT_CHR={
  breath:['A1','A2'],elements:['A1','A2'],species:['A1','A2'],color:['A2'],horns:['A3'],mace:['A3'],hornsMace:['A3'],crest:['A3'],
  shortWings:['A4'],span:['A1','A4'],metal:['sex'],night:['sex'],metalNight:['sex'],sex:['sex'],spurs:['sex'],glow:['mt'],
  rarity:['A1','A2','A3','A4','sex','mt']
};
/* Заполняем недостающие части нейтральным геномом, чтобы звать phenotype() */
const FILL=make({sex:'M'});
/* без копирования: phenotype и viable геном не меняют, поэтому части можно брать по ссылке (так в разы быстрее) */
function completeOf(part){
  const g=Object.assign({},FILL,part);g.Z=part.Z||FILL.Z;
  if(!part.sex){g.sex='M'}
  if(g.sex==='F'&&!part.Z){g.Z=[g.Z[0],null];g.W='sp'}
  if(g.sex==='M'&&g.Z[1]==null){g.Z=[g.Z[0],g.Z[0]]}
  if(!part.mt)g.mt='g';
  return g}

function traitValue(trait,ph){
  switch(trait){
    case 'elements':return ph.breath==='element'?ph.elements.join('+'):ph.breath;
    case 'species':return speciesKey(ph);
    case 'hornsMace':return (ph.horns?'H':'h')+(ph.mace?'K':'k');
    case 'metalNight':return ph.sex+(ph.metal?'M':'m')+(ph.night?'n':'N');
    case 'sex':return ph.sex;
    case 'rarity':return rarity(ph);
    default:return ph[trait];
  }}

/* dist(mother, father, trait) → {значение: вероятность}, с учётом гибели Wg/Wg (условно на выживших) */
/* одно и то же скрещивание при каждом движении формы прогноза не пересчитывается: последние результаты в памяти */
const DIST=new Map();
function dist(mother,father,trait){
  const key=trait+'|'+JSON.stringify(mother)+'|'+JSON.stringify(father);if(DIST.has(key))return Object.assign({},DIST.get(key));
  const r=distRaw(mother,father,trait);DIST.set(key,r);if(DIST.size>60)DIST.delete(DIST.keys().next().value);return Object.assign({},r)}
function distRaw(mother,father,trait){
  const chr=(TRAIT_CHR[trait]||[]).slice();
  if(!chr.length)throw new Error('unknown trait '+trait);
  const parts=offspringParts(mother,father,chr),out={};let alive=0;
  parts.forEach(({g,p})=>{const full=completeOf(g);if(chr.includes('A4')&&!viable(full))return;alive+=p;
    const v=traitValue(trait,phenotype(full));out[v]=(out[v]||0)+p});
  Object.keys(out).forEach(k=>out[k]/=alive||1);
  return out}

/* доля яиц, которые не вылупятся */
function lethalShare(mother,father){
  let dead=0;offspringParts(mother,father,['A4']).forEach(({g,p})=>{if(!viable(completeOf(g)))dead+=p});return dead}

/* ---------- запись генотипа для лаборатории ---------- */
const AL_TXT={Cb:'cᵇ',R1:'R¹',R2:'R²',Wg:'Wgˢ'};
const at=a=>AL_TXT[a]||a;
function genoText(g){
  const parts=[];
  AUTO.forEach(c=>{const L=CHROMS[c].loci;
    if(c==='A3')parts.push(at(g.A3[0][0])+at(g.A3[0][1])+'/'+at(g.A3[1][0])+at(g.A3[1][1])+' '+at(g.A3[0][2])+'/'+at(g.A3[1][2]));
    else L.forEach((l,i)=>parts.push(l==='Q1'||l==='Q2'||l==='Q3'||l==='E2'&&g[c][0][i]==='0'&&g[c][1][i]==='0'?'':(l==='E2'?'E2 ':'')+at(g[c][0][i])+'/'+at(g[c][1][i])))});
  const q=[['A1',1],['A4',1],['A4',2]].map(([c,i])=>g[c][0][i]+g[c][1][i]).join(' ');
  const z=g.sex==='M'?'Z^'+g.Z[0].join('')+' Z^'+g.Z[1].join(''):'Z^'+g.Z[0].join('')+' W^'+g.W;
  return parts.filter(Boolean).join(' ')+' · размах '+q+' · '+z+' · мт '+g.mt}

const DRG={GV,upgrade,isOld,combatRank,LOCI,CHROMS,Z,ELEM,ELEM_ORDER,LEGEND,RARITY,MU,rng,hashStr,make,validate,clone,gamete,fuse,breed,viable,phenotype,speciesKey,rarity,hapDist,dist,lethalShare,genoText};
if(typeof module!=='undefined'&&module.exports)module.exports=DRG;else root.DRG=DRG;
})(typeof window!=='undefined'?window:globalThis);
