/* Автотесты анимации: node phagi/dragons/anim.test.js
   Проверяют, что движение не нарушает рисунок и законы мира: стопа в опоре не скользит и не уходит под землю,
   разовые действия заканчиваются, удар срабатывает один раз, полёт только там, где позволяют крылья,
   и анимация ничего не меняет в морфологии. Картинку и плавность глазами эти тесты не заменяют. */
'use strict';
const assert=require('assert');
const fs=require('fs');
const D=require('./genetics.js');
global.MORPH=require('./morph.js');
const MO=global.MORPH,SH=require('./shape.js'),AN=require('./anim.js');
const {app,mul}=AN.MAT;

let fails=0,n=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}

const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const EL=['F','W','T','A','P','L','D'];
const rigOf=(g,lvl)=>{const M=MO.morph(D.phenotype(g),lvl);return {M,R:SH.build(M).rig}};
const anim=(g,lvl,o)=>{const {M,R}=rigOf(g,lvl);return new AN.Animator(M,R,o)};
/* все проверочные драконы: семь стихий взрослыми, малыш, подросток, гибрид, короткие крылья, дымный, дремлющий */
const CASES=EL.map(e=>[e+' взрослый',mk({E:e+'/'+e}),12]).concat([
  ['F малыш',mk({E:'F/F'}),1],['A подросток',mk({E:'A/A'}),6],['гибрид F/W',mk({E:'F/W',K:'K/k'}),12],
  ['короткие крылья',mk({E:'A/A',Wg:'Wg/Wg'}),12],['дымный',mk({E:'e/e'}),12],['дремлющий',mk({E:'F/F',S:'s/s'}),12],
  ['самка со шпорами',mk({sex:'F',E:'T/T',Sp:'Sp',M:'m',N:'n'}),16]]);

function randomGenome(rnd){
  const pick=l=>{const a=D.LOCI[l].alleles;return a[Math.floor(rnd()*a.length)]};
  const sex=rnd()<0.5?'M':'F',s={sex};
  ['E','Q1','S','C','H','K','R','Wg','Q2','Q3'].forEach(l=>{s[l]=pick(l)+'/'+pick(l)});
  if(sex==='M'){s.M=pick('M')+'/'+pick('M');s.N=pick('N')+'/'+pick('N')}else{s.M=pick('M');s.N=pick('N');s.Sp=pick('Sp')}
  s.G=pick('G');return D.make(s)}

/* прогнать аниматор n кадров по 1/60 с и вызвать f(pose, A) на каждом */
function run(A,sec,f){const N=Math.round(sec*60),ev=[];for(let i=0;i<N;i++){ev.push(...A.update(1/60));if(f)f(A.pose,A,i)}return ev}
const finite=m=>m.every(Number.isFinite);

t('ходьба: стопа в опоре стоит на месте и на земле, у всех проверочных драконов',()=>{
  CASES.forEach(([name,g,lvl])=>{const A=anim(g,lvl,{seed:3});A.play('walk');run(A,1);   /* разгон */
    const P=A.P,plant={};
    run(A,6,(pose)=>{AN.LEGS.forEach(L=>{const f=pose.feet[L],g0=P.legs[L],q=((A.x/P.stride+AN.OFF[L])%1+1)%1;
      if(q<P.duty-1e-6&&q>1e-6){
        assert.ok(Math.abs(f[1]-g0.g)<1e-9,`${name} ${L}: стопа в опоре оторвалась от земли (${f[1]})`);
        const k=L+Math.floor(A.x/P.stride+AN.OFF[L]);
        if(plant[k]==null)plant[k]=f[0];
        else assert.ok(Math.abs(f[0]-plant[k])<1e-6,`${name} ${L}: стопа в опоре съехала на ${f[0]-plant[k]}`)}})})})});

t('стопа никогда не уходит под землю: носок на земле или выше, пятка только поднимается',()=>{
  CASES.forEach(([name,g,lvl])=>{const A=anim(g,lvl,{seed:5}),P=A.P;
    ['walk','happy','eat','attack','hit','victory','defeat','idle','sleep','fly','idle'].forEach(s=>{A.play(s);
      run(A,2.2,(pose)=>{AN.LEGS.forEach(L=>{const lg=P.legs[L],M=pose.mat[L+'f'];
        [lg.toe,lg.h,lg.f].forEach(p=>{const q=app(M,p);assert.ok(q[1]<=p[1]+1e-6,`${name} ${s} ${L}: точка стопы ниже своего положения на ${q[1]-p[1]}`)})})})})})});

t('лапа не растягивается и не сплющивается сверх меры; сильнее сжата только поджатая (сон, поражение, полёт, стойка на задних)',()=>{
  CASES.forEach(([name,g,lvl])=>{const A=anim(g,lvl,{seed:7});
    ['idle','walk','happy','eat','attack','hit','victory','fly','sleep','defeat'].forEach(s=>{A.play(s);
      run(A,2.5,(pose,A)=>{const lying=['sleep','defeat','defeated'].includes(A.state())||(A.prev&&['sleep','defeat','defeated'].includes(A.prev.name));
        AN.LEGS.forEach(L=>{const sy=pose.legs[L].sy;
          assert.ok(sy<=1.065,`${name} ${s} ${L}: лапа вытянута в ${sy.toFixed(3)} раза`);
          assert.ok(sy>=(lying||s==='fly'||s==='victory'?0.3:0.62),`${name} ${s} ${L}: лапа сжата до ${sy.toFixed(3)}`)})})})})});

t('хвост и голова не уходят под землю ни в одном действии',()=>{
  CASES.forEach(([name,g,lvl])=>{const {M,R}=rigOf(g,lvl),A=new AN.Animator(M,R,{seed:2}),P=A.P;
    ['sleep','defeat','victory','attack','hit','happy','eat','fly','idle'].forEach(s=>{A.play(s);
      run(A,2.4,(pose)=>{
        R.tailS.forEach(p=>{const u=Math.max(0,(p[0]-P.tailAx.c[0])*P.tailAx.a[0]+(p[1]-P.tailAx.c[1])*P.tailAx.a[1]);
          const q=app(pose.mat.tail,app(AN.colMat(P.tailAx,pose.bend.tail,u),p));assert.ok(q[1]<=0.5,`${name} ${s}: хвост под землёй на ${q[1]}`)});
        R.headLow.forEach(p=>{const q=app(pose.mat.head,p);assert.ok(q[1]<=0.5,`${name} ${s}: голова под землёй на ${q[1]}`)})})})})});

t('удар в атаке срабатывает ровно один раз, разовые действия возвращаются в покой, поражение остаётся',()=>{
  const A=anim(mk({E:'F/F'}),12,{seed:1});
  A.play('attack');let ev=run(A,1.5);
  assert.strictEqual(ev.filter(e=>e.type==='hit').length,1);
  assert.ok(ev.some(e=>e.type==='end'&&e.state==='attack'));assert.strictEqual(A.state(),'idle');
  ['happy','eat','hit','victory','flutter'].forEach(s=>{A.play(s);run(A,AN.STATES[s].d+0.1);assert.strictEqual(A.state(),'idle',s)});
  A.play('defeat');run(A,12);assert.strictEqual(A.state(),'defeated');
  A.play('walk');run(A,1);assert.strictEqual(A.state(),'walk');
  A.play('happy',{then:'walk'});run(A,2);assert.strictEqual(A.state(),'walk')});

t('летают только драконы с подходящими крыльями: малыши, короткие крылья Wg и Земля пробуют и остаются на земле',()=>{
  const fly=(g,lvl)=>anim(g,lvl).P.canFly;
  ['F','W','A','P','L','D'].forEach(e=>assert.ok(fly(mk({E:e+'/'+e}),12),e));
  assert.ok(!fly(mk({E:'T/T'}),12),'Земля');assert.ok(!fly(mk({E:'A/A'}),1),'малыш');assert.ok(!fly(mk({E:'A/A',Wg:'Wg/+'}),12),'Wg');
  const A=anim(mk({E:'A/A',Wg:'Wg/Wg'}),12);assert.strictEqual(A.play('fly'),'flutter');
  let low=1e9;run(A,1.5,p=>{low=Math.min(low,p.body[5])});assert.ok(low>-A.P.h*0.2,'бескрылый взлетел');
  const B=anim(mk({E:'A/A'}),12);assert.strictEqual(B.play('fly'),'fly');let top=0;run(B,2,p=>{top=Math.min(top,p.body[5])});assert.ok(top<-B.P.h*0.8,'летун не взлетел')});

t('анимация не меняет морфологию, риг и фенотип',()=>{
  CASES.forEach(([name,g,lvl])=>{const ph=D.phenotype(g),M=MO.morph(ph,lvl),G=SH.build(M),R=G.rig;
    const sM=JSON.stringify(M),sR=JSON.stringify(R),sP=JSON.stringify(ph);
    const A=new AN.Animator(M,R,{seed:9});Object.keys(AN.STATES).forEach(s=>{A.play(s);run(A,1)});
    assert.strictEqual(JSON.stringify(M),sM,name+': морфология');assert.strictEqual(JSON.stringify(R),sR,name+': риг');assert.strictEqual(JSON.stringify(ph),sP,name+': фенотип')})});

t('300 случайных генотипов: во всех действиях позы конечны, голова не меняет размер, туловище дышит не больше чем на 3 %',()=>{
  const rnd=D.rng('anim-test');let k=0;
  for(let i=0;i<300;i++){const g=randomGenome(rnd),ph=D.phenotype(g);if(ph.lethal)continue;k++;
    const lvl=[1,5,12,18][i%4],{M,R}=rigOf(g,lvl),A=new AN.Animator(M,R,{seed:i,reduce:i%5===0});
    const names=Object.keys(AN.STATES);A.play(names[i%names.length]);
    run(A,1.2,(pose)=>{for(const [key,m] of Object.entries(pose.mat))assert.ok(finite(m),`${i} ${key}`);
      const h=pose.mat.head,det=h[0]*h[3]-h[1]*h[2];assert.ok(Math.abs(det-1)<1e-9,'голова изменила размер');
      const S=mul(AN.MAT.inv(pose.body),pose.mat.trunk);assert.ok(Math.abs(S[0]-1)<0.03&&Math.abs(S[3]-1)<0.03&&Math.abs(S[1])<1e-9&&Math.abs(S[2])<1e-9,'туловище '+S)})}
  assert.ok(k>200)});

t('одинаковое зерно даёт одинаковое движение, разное зерно — разное моргание',()=>{
  const g=mk({E:'P/P'}),A=anim(g,12,{seed:4}),B=anim(g,12,{seed:4}),C=anim(g,12,{seed:5});
  const seq=X=>{const out=[];['idle','walk','eat','idle'].forEach(s=>{X.play(s);run(X,1.5,p=>out.push(p.lid.toFixed(4)+p.mat.head.map(v=>v.toFixed(4)).join()))});return out.join('|')};
  const a=seq(A);assert.strictEqual(a,seq(B));assert.notStrictEqual(a,seq(C))});

t('стихии двигаются по-разному: Земля тяжелее и медленнее шагает, Воздух легче, малыш семенит',()=>{
  const P=(e,l)=>anim(mk({E:e+'/'+e}),l||12).P,T=P('T'),Ai=P('A'),F=P('F'),Fb=P('F',1);
  assert.ok(T.hv>0.9&&Ai.hv<0.1);assert.ok(T.duty>Ai.duty+0.1,'доля опоры');assert.ok(T.v<Ai.v,'скорость');
  assert.ok(Ai.lift/Ai.h>T.lift/T.h,'подъём стопы');assert.ok(T.breathT>Ai.breathT,'дыхание');
  assert.ok(Fb.period<F.period,'малыш шагает чаще');assert.ok(Fb.breathT<F.breathT,'малыш дышит чаще');
  assert.ok(P('W').tail.k>F.tail.k,'у Воды хвост волной');assert.ok(Ai.wing.flapT>F.wing.flapT,'длинные крылья машут реже')});

t('уменьшенное движение: покой почти неподвижен, хвост и дыхание в несколько раз спокойнее',()=>{
  const g=mk({E:'W/W'}),A=anim(g,12,{seed:1}),B=anim(g,12,{seed:1,reduce:true});
  const span=X=>{let lo=1e9,hi=-1e9;run(X,6,p=>{const y=app(p.mat.tail,AN.MAT.app(AN.colMat(X.P.tailAx,p.bend.tail,X.P.tailAx.L),X.R.tailTip))[1];lo=Math.min(lo,y);hi=Math.max(hi,y)});return hi-lo};
  assert.ok(span(B)<span(A)*0.45)});

t('риг: каждый слой рисунка A попадает ровно в одну подвижную часть, ничего не теряется и не рисуется дважды',()=>{
  const RIG=require('./rig.js');
  CASES.forEach(([name,g,lvl])=>{const M=MO.morph(D.phenotype(g),lvl),G=SH.build(M),P=AN.profile(M,G.rig),parts=RIG.partsOf(G.rig,P);
    /* хвост, шея и туловище — одна группа слоёв, разделённая разрезами; верх лапы и стопа тоже */
    const group=p=>['tail','neck','trunk'].includes(p.name)?'spine':/^[FN][HF][uf]$/.test(p.name)?p.name.slice(0,2):p.name;
    G.layers.forEach((l,i)=>{const gs=new Set(parts.filter(p=>p.only(l)&&(!l.rig||p.rig)).map(group));
      assert.strictEqual(gs.size,1,`${name}: слой ${i} (${l.part}${l.leg?' '+l.leg:''}) попал в ${[...gs].join(', ')||'никуда'}`)})})});

t('шипы гребня на хвосте и шее: каждый шип — отдельный жёсткий кусок, оболочка с запасом накрывает весь шип',()=>{
  const RIG=require('./rig.js');let seen=0;
  const inside=(H,p)=>H.every((a,i)=>{const b=H[(i+1)%H.length];return (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])>=-1e-9});
  CASES.forEach(([name,g,lvl])=>{const M=MO.morph(D.phenotype(g),lvl),G=SH.build(M),P=AN.profile(M,G.rig);
    G.layers.filter(l=>l.part==='crest'&&(l.seg==='tail'||l.seg==='neck')&&l.stroke).forEach(l=>{
      assert.ok(l.pieces&&l.pieces.length===(l.d.match(/M/g)||[]).length,`${name}: шипов ${(l.d.match(/M/g)||[]).length}, кусков ${l.pieces&&l.pieces.length}`);
      const ax=l.seg==='tail'?P.tailAx:P.neckAx;
      l.pieces.forEach(pc=>{seen++;const H=RIG.hullOf(pc.d,1.6),nums=pc.d.match(/-?\d*\.?\d+/g).map(Number);
        for(let i=0;i+1<nums.length;i+=2)assert.ok(inside(H,[nums[i],nums[i+1]]),`${name}: точка шипа вне оболочки`);
        const u=(pc.q[0]-ax.c[0])*ax.a[0]+(pc.q[1]-ax.c[1])*ax.a[1];assert.ok(u>-ax.r&&u<ax.L+ax.r,`${name}: основание шипа не на своей оси (${u.toFixed(1)})`)})})});
  assert.ok(seen>20,'шипов на хвосте и шее почти нет: '+seen)});

t('дыхание у пасти помещается в рамку рисунка',()=>{
  [mk({E:'F/F'}),mk({E:'F/W'}),mk({E:'L/L'}),mk({E:'e/e'})].forEach(g=>{const M=MO.morph(D.phenotype(g),12),G=SH.build(M),b=G.box;
    G.layers.filter(l=>l.part==='breath').forEach(l=>{const n=l.d.replace(/A[^A-Za-z]*/g,'').match(/-?\d*\.?\d+/g).map(Number);
      for(let i=0;i+1<n.length;i+=2)assert.ok(n[i]>=b.x-0.5&&n[i]<=b.x+b.w+0.5&&n[i+1]>=b.y-0.5,`${M.breath}: точка ${n[i].toFixed(1)},${n[i+1].toFixed(1)} вне рамки`)})})});

t('машина состояний отдельно от генетики: anim.js не знает о генах',()=>{
  const src=fs.readFileSync(__dirname+'/anim.js','utf8');
  assert.ok(!/DRG|genetics|genotype|allele/.test(src))});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
