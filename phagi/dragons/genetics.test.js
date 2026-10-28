/* Автотесты генетики драконов: node phagi/dragons/genetics.test.js
   Проверяют классические расщепления точно (dist) и на тысячах яиц (breed). */
'use strict';
const assert=require('assert');
const D=require('./genetics.js');

let fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.message)}}
const near=(a,b,eps,msg)=>assert.ok(Math.abs(a-b)<=eps,`${msg||''} ${a.toFixed(4)} ≠ ${b.toFixed(4)} ± ${eps}`);
const freq=(mother,father,trait,N,seed)=>{
  const rnd=D.rng(seed||'t'),out={};let alive=0;
  for(let i=0;i<N;i++){const egg=D.breed(mother,father,rnd);if(!egg.viable)continue;alive++;
    const ph=D.phenotype(egg.genome);let v;
    if(trait==='elements')v=ph.breath==='element'?ph.elements.join('+'):ph.breath;
    else if(trait==='hornsMace')v=(ph.horns?'H':'h')+(ph.mace?'K':'k');
    else v=ph[trait];
    out[v]=(out[v]||0)+1}
  Object.keys(out).forEach(k=>out[k]/=alive);return out};

t('генотипы собираются и проходят проверку',()=>{
  const f=D.make({sex:'F',E:'F/W',Sp:'Sp',G:'G'}),m=D.make({sex:'M',E:'e/e',M:'M/m'});
  assert.deepStrictEqual(D.validate(f),[]);assert.deepStrictEqual(D.validate(m),[]);
  assert.strictEqual(f.Z[1],null);assert.strictEqual(m.W,null);
  assert.throws(()=>D.make({sex:'M',E:'X/e'}));
});

t('моногибридное скрещивание Cc × Cc: 3 : 1',()=>{
  const f=D.make({sex:'F',C:'C/c'}),m=D.make({sex:'M',C:'C/c'});
  const d=D.dist(f,m,'color');near(d.dark,0.75,1e-9);near(d.pale,0.25,1e-9);
  const s=freq(f,m,'color',20000);near(s.dark,0.75,0.015,'выборка');
});

t('серия аллелей C > cᵇ > c: Ccᵇ × cᵇc даёт 2 : 1 : 1',()=>{
  const d=D.dist(D.make({sex:'F',C:'C/Cb'}),D.make({sex:'M',C:'Cb/c'}),'color');
  near(d.dark,0.5,1e-9);near(d.bronze,0.5,1e-9);assert.ok(!d.pale);
  const d2=D.dist(D.make({sex:'F',C:'Cb/c'}),D.make({sex:'M',C:'Cb/c'}),'color');
  near(d2.bronze,0.75,1e-9);near(d2.pale,0.25,1e-9);
});

t('кодоминирование стихий: F/e × W/e даёт F+W, F, W, дым по 1/4',()=>{
  const d=D.dist(D.make({sex:'F',E:'F/e'}),D.make({sex:'M',E:'W/e'}),'elements');
  ['F+W','F','W','smoke'].forEach(k=>near(d[k],0.25,1e-9,k));
});

t('рецессивный эпистаз: FeSs × FeSs даёт 9 : 3 : 4',()=>{
  const f=D.make({sex:'F',E:'F/e',S:'S/s'}),m=D.make({sex:'M',E:'F/e',S:'S/s'});
  const d=D.dist(f,m,'elements');near(d.F,9/16,1e-9);near(d.smoke,3/16,1e-9);near(d.dormant,4/16,1e-9);
  const s=freq(f,m,'elements',30000,'epi');near(s.F,9/16,0.015);near(s.dormant,0.25,0.015);
});

t('неполное доминирование гребня: 1 : 2 : 1',()=>{
  const d=D.dist(D.make({sex:'F',R:'R1/R2'}),D.make({sex:'M',R:'R1/R2'}),'crest');
  near(d.big,0.25,1e-9);near(d.mid,0.5,1e-9);near(d.none,0.25,1e-9);
});

t('летальный аллель: Wgˢ/+ × Wgˢ/+ даёт 2 : 1 среди вылупившихся и 1/4 погибших яиц',()=>{
  const f=D.make({sex:'F',Wg:'Wg/+'}),m=D.make({sex:'M',Wg:'Wg/+'});
  const d=D.dist(f,m,'shortWings');near(d.true,2/3,1e-9);near(d.false,1/3,1e-9);
  near(D.lethalShare(f,m),0.25,1e-9);
  const rnd=D.rng('leth');let dead=0;for(let i=0;i<20000;i++)if(!D.breed(f,m,rnd).viable)dead++;
  near(dead/20000,0.25,0.012,'доля мёртвых яиц');
});

t('сцепление: анализирующее скрещивание HK/hk × hk/hk даёт 18 % рекомбинантов',()=>{
  const f=D.make({sex:'F',H:'H/h',K:'K/k'}),m=D.make({sex:'M',H:'h/h',K:'k/k'});
  const d=D.dist(f,m,'hornsMace');
  near(d.HK,0.41,1e-9);near(d.hk,0.41,1e-9);near(d.Hk,0.09,1e-9);near(d.hK,0.09,1e-9);
  const s=freq(f,m,'hornsMace',30000,'link');near((s.Hk||0)+(s.hK||0),0.18,0.012,'рекомбинанты');
});

t('сцепление в транс-положении Hk/hK: рекомбинанты HK и hk',()=>{
  const f=D.make({sex:'F',H:'H/h',K:'k/K'}),m=D.make({sex:'M',H:'h/h',K:'k/k'});
  const d=D.dist(f,m,'hornsMace');near(d.Hk,0.41,1e-9);near(d.HK,0.09,1e-9);
});

t('гребень на той же хромосоме далеко (r = 0.5) наследуется независимо от рогов',()=>{
  const f=D.make({sex:'F',H:'H/h',R:'R1/R2'}),m=D.make({sex:'M',H:'h/h',R:'R2/R2'});
  const s=freq(f,m,'crest',20000,'far');near(s.mid,0.5,0.015);
});

t('сцепление с полом: рецессивное ночное зрение, крест-накрест',()=>{
  /* самка ночного зрения (Zⁿ W) × обычный самец (Zᴺ Zᴺ): у всех потомков нормальное зрение;
     обратное: самка Zᴺ W × самец Zⁿ Zⁿ — все сыновья норма, все дочери с ночным зрением */
  const a=D.dist(D.make({sex:'F',N:'n'}),D.make({sex:'M',N:'N/N'}),'night');near(a.false,1,1e-9);
  const b=D.dist(D.make({sex:'F',N:'N'}),D.make({sex:'M',N:'n/n'}),'metalNight');
  near(b.FmN==null?0:b.FmN,0,1e-9);near(b.Fmn,0.5,1e-9);near(b.MmN,0.5,1e-9);
});

t('сцепление на Z: Блеск и Ночное зрение 10 сМ у самца-дигетерозиготы',()=>{
  const m=D.make({sex:'M',M:'M/m',N:'N/n'}),f=D.make({sex:'F',M:'m',N:'n'});
  const d=D.dist(f,m,'metalNight');
  /* дочери получают Z отца: родительские MN и mn по 0.45, рекомбинанты по 0.05 (на всё потомство вдвое меньше) */
  near(d.FMN,0.225,1e-9);near(d.Fmn,0.225,1e-9);near(d.FMn,0.025,1e-9);near(d.FmN,0.025,1e-9);
});

t('пол 1 : 1, шпоры только у дочерей с W от матери',()=>{
  const f=D.make({sex:'F',Sp:'Sp'}),m=D.make({sex:'M'});
  const d=D.dist(f,m,'sex');near(d.F,0.5,1e-9);
  const s=D.dist(f,m,'spurs');near(s.true,0.5,1e-9);
  const rnd=D.rng('sp');for(let i=0;i<2000;i++){const g=D.breed(f,m,rnd).genome,ph=D.phenotype(g);if(ph.sex==='M')assert.ok(!ph.spurs);}
});

t('митохондрии только от матери',()=>{
  const a=D.dist(D.make({sex:'F',G:'G'}),D.make({sex:'M'}),'glow');near(a.true,1,1e-9);
  const b=D.dist(D.make({sex:'F',G:'g'}),D.make({sex:'M'}),'glow');near(b.false,1,1e-9);
});

t('полигенный размах: тригетерозиготы дают 1 : 6 : 15 : 20 : 15 : 6 : 1',()=>{
  const f=D.make({sex:'F',Q1:'+/-',Q2:'+/-',Q3:'+/-'}),m=D.make({sex:'M',Q1:'+/-',Q2:'+/-',Q3:'+/-'});
  const d=D.dist(f,m,'span'),exp=[1,6,15,20,15,6,1].map(x=>x/64);
  exp.forEach((p,k)=>near(d[k]||0,p,1e-9,'span '+k));
});

t('мутации: редкие, и только они дают Свет и Тьму',()=>{
  const f=D.make({sex:'F',E:'F/F'}),m=D.make({sex:'M',E:'W/W'});
  const rnd=D.rng('mut');let leg=0,mutE=0;const N=200000;
  for(let i=0;i<N;i++){const g=D.breed(f,m,rnd).genome,e=[g.A1[0][0],g.A1[1][0]];
    if(e[0]!=='F'||e[1]!=='W')mutE++;if(e.some(a=>a==='L'||a==='D'))leg++}
  near(mutE/N,2*D.MU,0.0015,'мутации гена Стихии');
  near(leg/N,2*D.MU/3,0.0008,'легендарные аллели');
  assert.ok(Object.values(D.dist(f,m,'elements')).length===1,'в точном расчёте мутаций нет');
});

t('одно и то же зерно даёт одно и то же яйцо',()=>{
  const f=D.make({sex:'F',E:'F/e',S:'S/s',C:'C/c'}),m=D.make({sex:'M',E:'W/e',S:'S/s'});
  const a=D.breed(f,m,D.rng('u1:42')),b=D.breed(f,m,D.rng('u1:42'));
  assert.deepStrictEqual(a,b);
  assert.deepStrictEqual(D.validate(a.genome),[]);
});

t('у потомка геном полный и правильный, точные распределения суммируются в 1',()=>{
  const f=D.make({sex:'F',E:'F/P',S:'S/s',C:'Cb/c',H:'H/h',K:'k/K',R:'R1/R2',Wg:'Wg/+',Q1:'+/-',M:'M',N:'n',Sp:'Sp',G:'G'});
  const m=D.make({sex:'M',E:'A/e',S:'S/s',C:'C/c',H:'h/h',K:'K/k',R:'R2/R2',Wg:'Wg/+',Q2:'+/+',M:'m/M',N:'N/n'});
  const rnd=D.rng('full');for(let i=0;i<500;i++){const g=D.breed(f,m,rnd).genome;assert.deepStrictEqual(D.validate(g),[])}
  ['elements','color','hornsMace','crest','shortWings','span','metalNight','glow','rarity'].forEach(tr=>{
    const s=Object.values(D.dist(f,m,tr)).reduce((a,b)=>a+b,0);near(s,1,1e-9,tr)});
});

t('редкость: одна стихия обычная, две редкие, Свет легендарный',()=>{
  const ph=x=>D.phenotype(D.make(x));
  assert.strictEqual(D.rarity(ph({sex:'M',E:'F/F'})),0);
  assert.strictEqual(D.rarity(ph({sex:'M',E:'F/W'})),1);
  assert.strictEqual(D.rarity(ph({sex:'M',E:'L/e'})),4);
  assert.ok(D.rarity(ph({sex:'F',E:'F/W',C:'c/c',N:'n',G:'G'}))>=3);
});

/* ---------- ген E2 (версия генома 2) ---------- */
t('E2: нейтральный 0 ничего не добавляет, стихийные кодоминантны, s/s гасит и их, ранг = число стихийных атак',()=>{
  const ph=spec=>D.phenotype(D.make(Object.assign({sex:'M',S:'S/S'},spec)));
  assert.deepStrictEqual(ph({E:'F/W',E2:'0/0'}).elements,['F','W']);
  assert.deepStrictEqual(ph({E:'F/W',E2:'T/0'}).elements,['F','W','T']);
  assert.deepStrictEqual(ph({E:'F/W',E2:'T/A'}).elements,['F','W','T','A']);
  assert.deepStrictEqual(ph({E:'F/W',E2:'F/0'}).elements,['F','W'],'та же стихия второй раз не считается');
  assert.deepStrictEqual(ph({E:'e/e',E2:'P/0'}).elements,['P'],'стихия только из E2');
  assert.strictEqual(ph({E:'F/W',E2:'T/A',S:'s/s'}).breath,'dormant');
  assert.strictEqual(D.combatRank(ph({E:'F/W',E2:'T/A'})),4);assert.strictEqual(D.combatRank(ph({E:'F/e'})),1);
  assert.strictEqual(D.combatRank(ph({E:'e/e'})),0);assert.strictEqual(D.combatRank(ph({E:'F/W',S:'s/s'})),0);
  assert.strictEqual(D.rarity(ph({E:'F/W',E2:'T/A'})),D.rarity(ph({E:'F/W'})),'три-четыре стихии не меняют редкость и доход')});

t('E2: старый геном получает 0/0 детерминированно, фенотип тот же, повтор ничего не меняет',()=>{
  const g=D.make({sex:'F',E:'F/W',C:'Cb/c'}),old=JSON.parse(JSON.stringify(g));old.A1=old.A1.map(h=>h.slice(0,2));delete old.gv;
  assert.ok(D.isOld(old));assert.ok(D.validate(old).length,'старый формат без миграции не проходит проверку');
  const u=D.upgrade(old);assert.deepStrictEqual(u.A1,g.A1);assert.deepStrictEqual(D.phenotype(u),D.phenotype(g));
  assert.strictEqual(D.upgrade(u),u,'повторная миграция возвращает тот же объект');assert.strictEqual(old.A1[0].length,2,'исходный не тронут')});

t('E2: точные вероятности (сумма 1) и 4000 яиц с зерном совпадают; сцепление с Q1 r = 0,5',()=>{
  const m=D.make({sex:'F',E:'F/e',E2:'T/0',Q1:'+/-'}),f=D.make({sex:'M',E:'W/e',E2:'A/0',Q1:'-/-'});
  const d=D.dist(m,f,'elements');near(Object.values(d).reduce((a,b)=>a+b,0),1,1e-9,'сумма');
  /* E и E2 независимы (r 0,5 через Q1): у каждого родителя 4 гаметы поровну */
  near(d['F+W+T+A']||0,1/16,1e-9,'все четыре');near(d['smoke']||0,1/16,1e-9,'ни одной');
  const fr=freq(m,f,'elements',4000,'e2');Object.keys(d).forEach(k=>near(fr[k]||0,d[k],0.025,k));
  const h=D.hapDist(m.A1,D.CHROMS.A1.r);near(h.reduce((a,x)=>a+x.p,0),1,1e-9);assert.strictEqual(h.length,8)});

t('E2: расчёт распределения быстрый (нет огромного перебора)',()=>{
  const m=D.make({sex:'F',E:'F/W',E2:'T/A',C:'C/c',H:'H/h',K:'K/k',R:'R1/R2',Q1:'+/-',Q2:'+/-',Q3:'+/-',Wg:'Wg/+'}),
    f=D.make({sex:'M',E:'P/L',E2:'D/0',C:'Cb/c',H:'H/h',K:'K/k',R:'R1/R2',Q1:'+/-',Q2:'+/-',Q3:'+/-',Wg:'Wg/+',M:'M/m',N:'N/n'});
  const t0=Date.now();['elements','rarity','span','species'].forEach(tr=>{const d=D.dist(m,f,tr);near(Object.values(d).reduce((a,b)=>a+b,0),1,1e-9,tr)});
  assert.ok(Date.now()-t0<1500,'долго: '+(Date.now()-t0)+' мс')});

t('происхождение потомка: аллели от матери и отца, перекрёст H–K виден у дигетерозиготы, частота около 18 %, мутации находятся',()=>{
  const mo=D.make({sex:'F',E:'F/W',S:'S/s',H:'H/h',K:'K/k',R:'R1/R2',G:'G'}),fa=D.make({sex:'M',E:'e/e',H:'h/h',K:'k/k',M:'M/m',N:'N/n'});
  const rnd=D.rng('orig');let rec=0,par=0,n=0;
  for(let i=0;i<4000;i++){const em=D.gamete(mo,rnd,true),sp=D.gamete(fa,rnd,true),ch=D.fuse(em,sp),o=D.origin(ch,mo,fa);
    o.genes.filter(x=>x.chr!=='Z'&&x.chr!=='W'&&x.chr!=='mt').forEach(x=>{const i0=D.CHROMS[x.chr].loci.indexOf(x.locus);assert.ok(mo[x.chr][0][i0]===x.m||mo[x.chr][1][i0]===x.m);assert.ok(fa[x.chr][0][i0]===x.f||fa[x.chr][1][i0]===x.f)});
    assert.strictEqual(o.mut.length,0,'без мутаций новых аллелей нет');
    const hk=o.cross.find(c=>c.who==='m'&&c.a==='H'&&c.b==='K');assert.ok(hk);if(hk.state==='rec')rec++;else if(hk.state==='par')par++;n++;
    assert.ok(o.cross.filter(c=>c.who==='f'&&c.a==='H').every(c=>c.state==='hom'),'отец hh kk: перекрёст не виден');
    if(ch.sex==='M'){const mn=o.cross.find(c=>c.who==='f'&&c.chr==='Z');assert.ok(mn&&mn.state!=='mut')}}
  assert.strictEqual(rec+par,n);const f=rec/n;console.log('      доля перекрёстов H–K',f.toFixed(3));assert.ok(Math.abs(f-0.18)<0.025,'около 18 %: '+f);
  const ch=D.fuse(D.gamete(mo,D.rng('x'),true),D.gamete(fa,D.rng('y'),true));ch.A2[0][1]='Cb';const o=D.origin(ch,mo,fa);
  assert.ok(o.mut.some(m=>m.who==='m'&&m.locus==='C'&&m.a==='Cb'),'аллель, которого не было у матери, — мутация');
  assert.strictEqual(o.genes.find(x=>x.locus==='G').m,mo.mt,'митохондрии от матери')});
console.log(`\n${n-fails} из ${n} тестов прошли`);
process.exit(fails?1:0);
