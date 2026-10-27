/* Геометрия дракона по морфологии (MORPH.morph): скелет из опорных точек, тело-трубка вокруг позвоночника,
   лапы, крылья, голова, рога, гребень, хвост. На выходе список слоёв с контурами в синтаксисе SVG path.
   Вид сбоку, морда вправо, земля y=0, вверх отрицательные y. Слой несёт часть тела (part) для подсветки в паспорте.
   Объём строится по одной модели света (сверху и чуть спереди): у каждой трубки (тело, шея, хвост, лапы) есть
   собственная тень снизу, блик сверху и отражённый свет у нижнего края; чешуя раскладывается по цилиндру,
   поэтому к краям она сжимается. Слои с fx:1 — только свет и тень, в силуэт они не входят. */
(function(root){
'use strict';

/* ---------- векторы ---------- */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k];
const len=a=>Math.hypot(a[0],a[1]),nrm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l]};
const lerp=(a,b,t)=>a+(b-a)*t,lerpP=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
/* направление по углу над горизонтом (градусы, 0 вперёд, 90 вверх) */
const dirA=d=>{const r=d*Math.PI/180;return [Math.cos(r),-Math.sin(r)]};
/* поворот на экране по часовой стрелке (y вниз) */
const rot=(a,d)=>{const r=d*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return [a[0]*c-a[1]*s,a[0]*s+a[1]*c]};
const perpUp=d=>[d[1],-d[0]];   /* нормаль к направлению d, смотрящая «вверх» (к спине) */
const smooth=t=>t*t*(3-2*t);
const F=x=>Math.round(x*10)/10;
const pt=p=>F(p[0])+' '+F(p[1]);
/* размытие округляется до половинок, чтобы в рисунке было мало разных фильтров */
const qb=x=>Math.max(0.5,Math.round(x*2)/2);
/* детерминированный «шум» для неровностей чешуи: одинаковый дракон всегда одинаков */
const hash=(a,b)=>{let h=(a*73856093)^(b*19349663)^0x5bd1e995;h=Math.imul(h^(h>>>15),0x2c1b3c6d);h^=h>>>12;return ((h>>>0)%1000)/1000};

/* сглаженный контур через точки (Катмулл-Ром → кубические Безье); sharp — индексы углов без сглаживания */
function curve(pts,closed,sharp){
  const n=pts.length;if(n<2)return '';
  const g=i=>closed?pts[(i+n)%n]:pts[Math.max(0,Math.min(n-1,i))];
  let d='M'+pt(pts[0]);
  const segs=closed?n:n-1;
  for(let i=0;i<segs;i++){
    const p0=g(i-1),p1=g(i),p2=g(i+1),p3=g(i+2);
    let t1=mul(sub(p2,p0),1/6),t2=mul(sub(p3,p1),1/6);
    if(sharp&&sharp.has(i%n))t1=[0,0];
    if(sharp&&sharp.has((i+1)%n))t2=[0,0];
    d+='C'+pt(add(p1,t1))+' '+pt(sub(p2,t2))+' '+pt(p2)}
  return d+(closed?'Z':'')}
const poly=(pts,closed)=>'M'+pts.map(pt).join('L')+(closed?'Z':'');
const circ=(c,r)=>`M${pt(add(c,[r,0]))}A${F(r)} ${F(r)} 0 1 0 ${pt(add(c,[-r,0]))}A${F(r)} ${F(r)} 0 1 0 ${pt(add(c,[r,0]))}Z`;
/* эллипс с поворотом a (градусы) */
const ell=(c,rx,ry,a)=>{const e=mul(rot([1,0],a||0),rx);return `M${pt(add(c,e))}A${F(rx)} ${F(ry)} ${F(a||0)} 1 0 ${pt(sub(c,e))}A${F(rx)} ${F(ry)} ${F(a||0)} 1 0 ${pt(add(c,e))}Z`};
const qd=(a,c,b)=>`M${pt(a)}Q${pt(c)} ${pt(b)}`;

/* точки сплайна через опорные точки с касательными */
function spline(ctrl,k){
  const n=ctrl.length,out=[];
  const g=i=>ctrl[Math.max(0,Math.min(n-1,i))];
  const seg=i=>{const p0=g(i-1),p1=g(i),p2=g(i+1),p3=g(i+2);return [p1,add(p1,mul(sub(p2,p0),1/6)),sub(p2,mul(sub(p3,p1),1/6)),p2]};
  const at=(s,t)=>{const u=1-t;return [0,1].map(j=>u*u*u*s[0][j]+3*u*u*t*s[1][j]+3*u*t*t*s[2][j]+t*t*t*s[3][j])};
  const der=(s,t)=>{const u=1-t;return nrm([0,1].map(j=>3*u*u*(s[1][j]-s[0][j])+6*u*t*(s[2][j]-s[1][j])+3*t*t*(s[3][j]-s[2][j])))};
  for(let i=0;i<n-1;i++){const s=seg(i);for(let j=0;j<k;j++){const t=j/k;out.push({p:at(s,t),d:der(s,t),seg:i,u:t})}}
  const s=seg(n-2);out.push({p:ctrl[n-1],d:der(s,1),seg:n-2,u:1});
  return out}

/* трубка вокруг сплайна: радиусы сверху и снизу заданы в опорных точках */
function tube(ctrl,rTop,rBot,k){
  const S=spline(ctrl,k);
  S.forEach(s=>{const a=s.seg,b=Math.min(a+1,ctrl.length-1),t=smooth(s.u);
    s.rt=lerp(rTop[a],rTop[b],t);s.rb=lerp(rBot[a],rBot[b],t);s.up=perpUp(s.d);
    s.top=add(s.p,mul(s.up,s.rt));s.bot=sub(s.p,mul(s.up,s.rb))});
  return S}
function tubeOutline(S,capStart,capEnd){
  const pts=[];
  if(capStart)pts.push(sub(S[0].p,mul(S[0].d,capStart)));
  S.forEach(s=>pts.push(s.top));
  if(capEnd)pts.push(add(S[S.length-1].p,mul(S[S.length-1].d,capEnd)));
  for(let i=S.length-1;i>=0;i--)pts.push(S[i].bot);
  return pts}
/* точка поперёк трубки: v=1 верхний край, 0 ось, -1 нижний */
const across=(s,v)=>v>=0?add(s.p,mul(s.up,s.rt*v)):add(s.p,mul(s.up,s.rb*v));
function band(S,i0,i1,v0,v1){const a=[],b=[];for(let i=i0;i<=i1;i++){a.push(across(S[i],v0));b.push(across(S[i],v1))}return curve(a.concat(b.reverse()),true)}
function strip(S,i0,i1,v){const a=[];for(let i=i0;i<=i1;i++)a.push(across(S[i],v));return curve(a,false)}
const avgR=(S,i0,i1)=>{let r=0;for(let i=i0;i<=i1;i++)r+=(S[i].rt+S[i].rb)/2;return r/(i1-i0+1)};

/* рамка рисунка */
function Box(){this.x0=1e9;this.y0=1e9;this.x1=-1e9;this.y1=-1e9}
Box.prototype.add=function(pts){pts.forEach(p=>{if(p[0]<this.x0)this.x0=p[0];if(p[0]>this.x1)this.x1=p[0];if(p[1]<this.y0)this.y0=p[1];if(p[1]>this.y1)this.y1=p[1]});return pts};

/* ---------- формы деталей ---------- */
/* «линза» от a до b шириной w: лист, перо, лопасть */
function lens(a,b,w,bend){
  const d=sub(b,a),n=perpUp(nrm(d)),m=lerpP(a,b,0.45),bb=bend||0;
  const c1=add(add(m,mul(n,w)),mul(n,bb)),c2=add(sub(m,mul(n,w)),mul(n,bb));
  return `M${pt(a)}Q${pt(c1)} ${pt(b)}Q${pt(c2)} ${pt(a)}Z`}
/* нижняя половина линзы: теневая сторона листа или пера */
function halfLens(a,b,w,bend){
  const d=sub(b,a),n=perpUp(nrm(d)),m=lerpP(a,b,0.45),c2=add(sub(m,mul(n,w)),mul(n,bend||0));
  return `M${pt(a)}Q${pt(c2)} ${pt(b)}Q${pt(add(m,mul(n,(bend||0)*0.5)))} ${pt(a)}Z`}
function tri(a,b,c){return `M${pt(a)}L${pt(b)}L${pt(c)}Z`}
/* конус шипа: светлая и тёмная половины */
function spike(base0,base1,tip){const m=lerpP(base0,base1,0.5);return {d:tri(base0,tip,base1),dark:tri(m,tip,base1)}}

/* свет и тень трубки (тело, лапа): возвращает слои, их кладёт вызывающий */
function shadeTube(S,i0,i1,clip,o){
  o=o||{};const r=avgR(S,i0,i1),bl=Math.max(1,r*0.34);
  const out=[{paint:'core',d:band(S,i0,i1,-1.3,o.coreTo==null?-0.22:o.coreTo),clip,blur:qb(bl),op:o.core||.55,fx:1},
    {paint:'hi',d:band(S,i0,i1,0.3,0.8),clip,blur:qb(bl*0.75),op:o.hi||.4,fx:1}];
  if(o.bounce!==false)out.push({paint:'bounce',line:Math.max(0.8,r*0.12),d:strip(S,i0,i1,-0.84),clip,blur:qb(bl*0.3),op:.3,fx:1});
  return out}

/* ---------- скелет и тело ---------- */
function skeleton(M){
  const b=M.body;
  const hip=[0,-b.hipH],sh=[b.len,-b.shH],mid=[b.len*0.5,-(b.hipH+b.shH)/2-b.arch];
  const nd=dirA(b.neckA),fwd=[-nd[1],nd[0]];   /* перпендикуляр к шее, вперёд-вниз */
  const N0=add(sh,mul(dirA(b.neckA*0.82),b.neckL*0.24));
  const N1=add(add(sh,mul(nd,b.neckL*0.62)),mul(fwd,b.neckS*b.neckL*0.32));
  const N2=add(sh,mul(nd,b.neckL));
  /* хвост: от бедра назад, наклон tailA вниз, закрутка tailCurl вверх, волна */
  const T=[];let p=add(hip,mul(dirA(180+b.tailA),b.hipR*0.9));T.push(p);
  for(let i=1;i<=4;i++){
    const a=180+b.tailA-b.tailCurl*(i/4)+b.tailWave*16*Math.sin(i*Math.PI/2);
    p=add(p,mul(dirA(a),b.tailL/4));
    const floor=-(b.tailTip+1.5+(4-i)*1.2);if(p[1]>floor)p=[p[0],floor];
    T.push(p)}
  const ctrl=[T[4],T[3],T[2],T[1],T[0],hip,mid,sh,N0,N1,N2];
  const r0=b.hipR*b.tailR0;
  const rad=[b.tailTip,r0*0.32,r0*0.55,r0*0.78,r0,b.hipR,b.bellyR,b.chestR,b.neckR0,(b.neckR0+b.neckR1)/2,b.neckR1];
  const kt=[1,1,1,1,1,.96,.92,.94,1,1,1.1],kb=[1,1,1,1,1,1.04,b.sag*1.04,1.08,1.04,1,1.1];
  const S=tube(ctrl,rad.map((r,i)=>r*kt[i]),rad.map((r,i)=>r*kb[i]),5);
  return {hip,sh,mid,N2,ctrl,S,idx:{tip:0,hip:25,mid:30,sh:35,n0:40,n1:45,n2:50}}}

/* ---------- лапы ---------- */
function legPts(kind,attach,g,b,M){
  const h=g-attach[1],T=b.legT,foot=b.footL,dg=b.digi;
  if(kind==='hind'){
    const knee=[attach[0]+h*0.22,attach[1]+h*0.44],hock=[attach[0]-h*0.12*dg,g-h*(0.1+0.2*dg)];
    const thigh=lerpP(attach,knee,0.42),ball=[hock[0]+foot*0.45,g-2],tip=[hock[0]+foot,g-0.8];
    return {ctrl:[attach,thigh,knee,hock,ball,tip],r:[Math.max(b.hipR*0.86,9*T),Math.max(b.hipR*0.62,7.4*T),5.8*T,4.2*T,3.9*T,2.5*T],hock,tip,knee}}
  const elbow=[attach[0]-h*0.1,attach[1]+h*0.46],wrist=[elbow[0]+h*0.1,g-h*(0.1+0.06*dg)];
  const upper=lerpP(attach,elbow,0.45),paw=[wrist[0]+foot*0.35,g-2],tip=[wrist[0]+foot*0.8,g-0.8];
  return {ctrl:[attach,upper,elbow,wrist,paw,tip],r:[Math.max(b.chestR*0.6,8.5*T),Math.max(b.chestR*0.44,6.8*T),5.4*T,4*T,3.7*T,2.3*T],hock:wrist,tip,knee:elbow}}
function legGeom(L,g,box){
  const S=tube(L.ctrl,L.r,L.r,4);
  S.forEach(s=>{s.top=[s.top[0],Math.min(s.top[1],g)];s.bot=[s.bot[0],Math.min(s.bot[1],g)]});
  const out=tubeOutline(S,0,1.2).map(p=>[p[0],Math.min(p[1],g)]);
  box.add(out);
  /* три пальца у земли и изогнутые когти */
  const t=L.tip,tr=Math.max(1.6,L.r[5]*0.95),toes=[],cl=[];
  [0,1,2].forEach(i=>{const c=[t[0]-i*tr*1.35+0.6,g-tr*0.75];toes.push(circ(c,tr));
    const a=add(c,[tr*0.55,-tr*0.55]),b=add(c,[tr*0.7,tr*0.6]),tip=add(c,[tr*2.1,tr*0.7]);
    cl.push(`M${pt(a)}Q${pt(add(c,[tr*2,-tr*0.2]))} ${pt(tip)}Q${pt(add(c,[tr*1.3,tr*0.5]))} ${pt(b)}Z`)});
  box.add([[t[0]+tr*2.2,g]]);
  return {d:curve(out,true),S,toes:toes.join(''),claws:cl.join('')}}

/* ---------- крылья ---------- */
const WS=78;   /* длина крыла при размахе 1 */
const WING_T={
  jag:    {a:128,b:208,L:[.6,.88,1.12,1.32],edge:.3,notch:1},
  fin:    {a:132,b:204,L:[.5,.62,.72,.78,.8],edge:-.2},
  stub:   {a:125,b:205,L:[.55,.7,.8],edge:.22},
  long:   {a:138,b:194,L:[.95,1.28,1.5,1.58],edge:.24},
  leaf:   {a:142,b:204,L:[.84,1.04,1.06],edge:-.3},
  feather:{a:120,b:212,L:[.62,.82,.98,1.1,1.18],edge:.12,feathers:1},
  hook:   {a:128,b:204,L:[.7,.98,1.2,1.36],edge:.34,hook:1},
  plain:  {a:128,b:208,L:[.6,.88,1.1,1.28],edge:.26}
};
function wingGeom(M,root,trail,box,far){
  const w=M.wing,ty=WING_T[w.type],S=WS*w.span,rz=w.raise;
  /* дальнее крыло повёрнуто назад и чуть меньше */
  const tf=p=>{let q=far?rot(mul(p,0.9),-14):p;q=add(q,root);if(far)q=add(q,[5,-3]);return q};
  const E=[-0.28*S,-0.4*S*rz],Wr=w.short?[-0.12*S,-0.72*S*rz]:[-0.04*S,-0.86*S*rz];
  const n=ty.L.length,tips=[];
  for(let i=0;i<n;i++){const f=i/(n-1),a=lerp(ty.a,ty.b,f),Lf=ty.L[i]*(i?lerp(1,w.chord,f):1);tips.push(add(Wr,mul(dirA(a),S*Lf)))}
  const tr=sub(trail,root),trL=far?rot(mul(tr,1/0.9),14):tr;
  const ends=ty.hook?tips.map(t=>lerpP(Wr,t,0.86)):tips;
  /* край перепонки между кончиками пальцев: вогнутый к запястью или выпуклый */
  const edge=(a,b)=>{const m=lerpP(a,b,0.5),c=add(m,mul(sub(Wr,m),ty.edge));
    if(ty.notch){const q=add(m,mul(sub(Wr,m),ty.edge*1.4)),c1=lerpP(a,q,0.5),c2=lerpP(q,b,0.5);
      return `Q${pt(tf(add(c1,mul(sub(Wr,c1),0.12))))} ${pt(tf(q))}Q${pt(tf(add(c2,mul(sub(Wr,c2),0.12))))} ${pt(tf(b))}`}
    return `Q${pt(tf(c))} ${pt(tf(b))}`};
  let d=`M${pt(tf([0,0]))}Q${pt(tf(lerpP([0,0],E,0.5).map((v,i)=>v+(i?-0.04*S:0))))} ${pt(tf(E))}L${pt(tf(Wr))}L${pt(tf(ends[0]))}`;
  let edgeD=`M${pt(tf(ends[0]))}`;
  for(let i=1;i<n;i++){const e=edge(ends[i-1],ends[i]);d+=e;edgeD+=e}
  {const e=edge(ends[n-1],trL);d+=e+'Z';edgeD+=e}
  box.add([[0,0],E,Wr,...tips,trL].map(tf));
  /* складки перепонки: каждая лопасть между пальцами своим тоном, тень вдоль пальца, жилки */
  const panels=[],folds=[],veins=[];
  for(let i=0;i<n;i++){
    const a=ends[i],b=i<n-1?ends[i+1]:trL;
    let pd=`M${pt(tf(Wr))}L${pt(tf(a))}`+edge(a,b);pd+=i<n-1?'Z':`L${pt(tf([0,0]))}L${pt(tf(E))}Z`;
    panels.push(pd);
    /* тень от пальца ложится на следующую лопасть */
    const dn=nrm(sub(a,Wr)),side=rot(dn,24);
    folds.push(`M${pt(tf(add(Wr,mul(side,1.5))))}L${pt(tf(add(lerpP(Wr,a,0.94),mul(side,2.2))))}`);
    /* две жилки от пальца к краю лопасти */
    const m=lerpP(a,b,0.5),mm=add(m,mul(sub(Wr,m),ty.edge*0.6));
    [0.38,0.68].forEach(f=>{const s0=lerpP(Wr,a,f),e0=lerpP(s0,mm,0.85),c0=add(lerpP(s0,e0,0.5),mul(sub(Wr,lerpP(s0,e0,0.5)),0.12));veins.push(qd(tf(s0),tf(c0),tf(e0)))})}
  /* кости: плечо, предплечье и пальцы сужаются к концам, суставы утолщены */
  const k=Math.sqrt(Math.max(0.3,S/WS)),bone=[],knuckles=[];
  const armS=tube([[0,0],E,Wr].map(tf),[3*k,2.4*k,2*k],[3*k,2.4*k,2*k],4);bone.push(curve(tubeOutline(armS,1,1),true));
  tips.forEach((t,i)=>{if(w.type==='fin'||w.type==='leaf')return;const S2=tube([Wr,lerpP(Wr,t,0.5),t].map(tf),[1.6*k,1.1*k,0.35],[1.6*k,1.1*k,0.35],3);bone.push(curve(tubeOutline(S2,0,0.6),true))});
  [E,Wr].forEach(p=>knuckles.push(circ(tf(p),(p===E?3.1:2.6)*k)));
  const arm=`M${pt(tf([0,0]))}L${pt(tf(E))}L${pt(tf(Wr))}`;
  const fingers=tips.map(t=>`M${pt(tf(Wr))}L${pt(tf(t))}`).join('');
  let extra='',feathers='',shafts='',fdark='';
  if(ty.hook)extra=tips.map((t,i)=>{const dd=nrm(sub(t,Wr)),q=add(t,mul(rot(dd,70),3.4));return tri(tf(sub(t,mul(dd,3))),tf(add(t,mul(dd,2.6))),tf(q))}).join('');
  if(!ty.feathers&&w.type!=='fin'&&w.type!=='leaf'){const dd=nrm(sub(Wr,E));extra+=`M${pt(tf(add(Wr,mul(rot(dd,-90),2.2*k))))}Q${pt(tf(add(Wr,mul(rot(dd,-30),6*k))))} ${pt(tf(add(Wr,mul(dd,7*k))))}Q${pt(tf(add(Wr,mul(dd,3*k))))} ${pt(tf(add(Wr,mul(rot(dd,90),2.2*k))))}Z`}
  if(ty.feathers){
    /* перья: длинные вдоль пальцев, короче между ними, второй ряд у руки; у каждого стержень и теневая половина */
    const fs=[],sh=[],dk=[];
    const fl=(a,b,wd)=>{wd*=far?0.9:1;fs.push(lens(tf(a),tf(b),wd));dk.push(halfLens(tf(a),tf(b),wd));sh.push(`M${pt(tf(a))}L${pt(tf(lerpP(a,b,0.9)))}`)};
    for(let i=0;i<5;i++){const a=lerpP(E,Wr,i/4),b=add(a,mul(dirA(lerp(150,215,i/4)),S*0.38));fl(a,b,2.2+S*0.018)}
    for(let i=0;i<n;i++){const t=tips[i];fl(lerpP(Wr,t,0.18),t,2.6+S*0.025);
      if(i<n-1){const m=lerpP(tips[i],tips[i+1],0.5);fl(lerpP(Wr,m,0.15),lerpP(Wr,m,0.92),2.4+S*0.022)}}
    feathers=fs.join('');shafts=sh.join('');fdark=dk.join('')}
  let leafVeins='',leafDark='';
  if(w.type==='leaf'){
    /* крыло-лист: несколько листовых лопастей от запястья, у каждой средняя жилка, боковые и теневая половина */
    const blades=[],vs=[],dk=[];
    tips.concat([trL]).forEach((t,i)=>{const a=lerpP(Wr,i===n?E:Wr,0.5),b=i===n?lerpP(t,Wr,0.1):t,wd=len(sub(b,a))*(i===n?0.26:0.4)*(far?0.9:1);
      blades.push(lens(tf(a),tf(b),wd));dk.push(halfLens(tf(a),tf(b),wd));vs.push(`M${pt(tf(a))}L${pt(tf(lerpP(a,b,0.92)))}`);
      for(let j=1;j<4;j++){const q=lerpP(a,b,j/4.4),nn=perpUp(nrm(sub(b,a))),r=wd*0.6;vs.push(`M${pt(tf(q))}L${pt(tf(add(lerpP(a,b,j/4.4+0.12),mul(nn,r))))}M${pt(tf(q))}L${pt(tf(add(lerpP(a,b,j/4.4+0.12),mul(nn,-r))))}`)}});
    d=blades.join('');leafVeins=vs.join('');leafDark=dk.join('')}
  return {d,edge:edgeD,panels,folds:folds.join(''),veins:veins.join(''),bone:bone.join(''),knuckles:knuckles.join(''),arm,fingers,extra,feathers,shafts,fdark,leafVeins,leafDark,
    wrist:tf(Wr),elbow:tf(E)}}

/* ---------- глаз ----------
   Форма глаза и выражение задаёт голова стихии: разрез (круглый, миндалевидный, узкий, под тяжёлым веком),
   наклон верхнего века (злой прищур или любопытный взгляд), надбровная дуга. Цвет радужки и зрачок — гены N и G. */
const EYE_T={round:[1,1,1,.95,0],almond:[1.28,1.12,.8,.58,.14],narrow:[1.45,1.24,.5,.38,.1],hooded:[1.18,1.1,.74,.6,.08]};
/* soft: у малыша надбровье мягче (возраст, не наследуется) */
function eyeGeom(h,c,r,night,tf,soft){
  const [fx,bx,up,lo,drop]=EYE_T[h.eye]||EYE_T.almond,sl=h.slant||0,hood=h.hood||0;
  const B=[c[0]-bx*r,c[1]-sl*r*0.12],Fc=[c[0]+fx*r,c[1]+drop*r+sl*r*0.42];
  const upC=[c[0]+0.1*r,c[1]-2*up*r+hood*r*1.5+sl*r*0.3],loC=[c[0],c[1]+2*lo*r];
  const T=p=>pt(tf(p));
  const sclera=`M${T(B)}Q${T(upC)} ${T(Fc)}Q${T(loC)} ${T(B)}Z`;
  const flick=add(B,[-0.42*r,-0.22*r-Math.max(0,sl)*0.12*r]);
  const lid=`M${T(flick)}L${T(B)}Q${T(upC)} ${T(Fc)}`,lower=`M${T(Fc)}Q${T(loC)} ${T(B)}`;
  const ic=[c[0]+0.16*r,c[1]+0.06*r+hood*0.25*r],ir=r*(night?0.8:0.74);
  const pupil=night?circ(tf(ic),ir*0.58):lens(tf([ic[0],ic[1]-ir*0.82]),tf([ic[0],ic[1]+ir*0.82]),ir*0.24);
  const shine=circ(tf([ic[0]-ir*0.36,ic[1]-ir*0.42]),Math.max(0.8,ir*0.28))+circ(tf([ic[0]+ir*0.38,ic[1]+ir*0.36]),Math.max(0.5,ir*0.12));
  let brow='',browSh='';
  if(h.browH*(soft||1)>0.16){
    const t=h.browH*r*0.5*(soft||1),Bb=[c[0]-1.4*r,c[1]-(up+0.55)*r+hood*r*0.6],Fb=[c[0]+1.6*r,c[1]-(up*0.6+0.25)*r+sl*r*0.62+hood*r*0.4];
    const m=lerpP(Bb,Fb,0.5);
    brow=`M${T(Bb)}Q${T([m[0],m[1]-t*1.8])} ${T(Fb)}Q${T([m[0]+0.2*r,m[1]+t*0.25])} ${T(Bb)}Z`;
    browSh=`M${T(add(Bb,[0.3*r,t*0.5]))}Q${T([m[0],m[1]+t*0.55])} ${T(add(Fb,[-0.2*r,t*0.4]))}`}
  return {sclera,lid,lower,iris:circ(tf(ic),ir),irisC:tf(ic),ir,pupil,shine,brow,browSh,
    sleep:`M${T(B)}Q${T(upC)} ${T(Fc)}Q${T([c[0],c[1]+0.15*r])} ${T(B)}Z`,
    shut:`M${T(B)}Q${T(upC)} ${T(Fc)}Q${T([loC[0],loC[1]+0.1*r])} ${T(B)}Z`}}

/* ---------- голова ---------- */
function headGeom(M,joint,box){
  const h=M.head,L=h.L,H=h.H,cl=L*(1-h.snout),A=h.angular;
  const tf=p=>add(rot(p,h.tilt),joint);
  const P={
    occ:[-0.14*L,-0.1*H],crown:[cl*0.35,-H*(0.42+0.2*h.crown)],brow:[cl*0.9,-H*(0.42+0.16*h.brow)],
    stop:[cl*1.04,-H*(0.33-0.05*h.brow)],noseTop:[L*0.93,-H*(0.12+0.22*h.taper)],noseTip:[L,-H*(0.02+0.07*h.taper)],
    lip:[L*0.97,H*0.09],chin:[L*0.82,H*(0.12+0.14*h.taper)],jaw:[cl*0.55,H*(0.28+0.32*h.jaw)],throat:[-0.1*L,H*0.38]};
  const order=['occ','crown','brow','stop','noseTop','noseTip','lip','chin','jaw','throat'];
  const sharp=new Set();
  if(A>0.5){sharp.add(2);sharp.add(8)}
  if(h.taper<0.4)sharp.add(5);
  if(A>0.75)sharp.add(7);
  const pts=order.map(k=>tf(P[k]));box.add(pts);
  const k=H/24;
  /* рот: улыбка поднимает уголок, оскал показывает зубы */
  const mA=[cl*0.5,H*0.1],mB=[L*0.95,H*0.08],sm=h.smile||0;
  const corner=add(mA,[-H*0.1,-sm*H*0.16]);
  let mouth=`M${pt(tf(corner))}Q${pt(tf([mA[0]+H*0.05,H*(0.12+0.04*Math.max(0,sm))]))} ${pt(tf([lerp(mA[0],mB[0],0.45),H*0.13]))}Q${pt(tf([lerp(mA[0],mB[0],0.8),H*0.12]))} ${pt(tf(mB))}`;
  let teeth='';
  if(h.mouth==='grin'||A>0.8){const n=5;for(let i=0;i<n;i++){const x=lerp(cl*0.66,L*0.9,i/(n-1)),th=H*(0.06+0.02*(i%2));teeth+=tri(tf([x-1.5*k,H*0.1]),tf([x,H*0.1+th]),tf([x+1.5*k,H*0.1]))}}
  /* клыки поверх нижней губы, у Земли бивни из нижней челюсти */
  let fangs='';
  if(h.fang>0.05){[[0.84,1],[0.66,0.7]].forEach(([fx,fk])=>{const x=L*fx,f=h.fang*H*0.22*fk;fangs+=`M${pt(tf([x-1.7*k*fk,H*0.08]))}Q${pt(tf([x+0.4*k,H*0.08+f*0.6]))} ${pt(tf([x+0.5*k,H*0.08+f]))}Q${pt(tf([x+1.2*k,H*0.08+f*0.4]))} ${pt(tf([x+1.5*k*fk,H*0.08]))}Z`})}
  let tusks='';
  if(h.tusk>0.05){const x=L*0.7,tk=h.tusk;tusks=`M${pt(tf([x-2.4*k,H*0.2]))}Q${pt(tf([x-2*k,-H*0.02*tk]))} ${pt(tf([x+1.6*k,-H*0.2*tk]))}Q${pt(tf([x+0.6*k,H*0.02]))} ${pt(tf([x+2.2*k,H*0.2]))}Z`;box.add([tf([x+1.6*k,-H*0.2*tk])])}
  /* усы-барбели у Воды */
  let whisk='';
  if(h.whisk>0.05){whisk=qd(tf([L*0.9,-H*0.02]),tf([L*0.72,H*0.55]),tf([L*0.4,H*(0.6+0.35*h.whisk)]))+qd(tf([L*0.84,H*0.06]),tf([L*0.72,H*0.42]),tf([L*0.56,H*(0.5+0.28*h.whisk)]));box.add([tf([L*0.4,H*0.95])])}
  const nos=tf([L*0.88,-H*(0.05+0.13*h.taper)]),nr=1.6+0.6*k;
  const nostril=`M${pt(add(nos,[-nr,0]))}Q${pt(add(nos,[0,-nr*0.8]))} ${pt(add(nos,[nr,0]))}Q${pt(add(nos,[0,nr*0.5]))} ${pt(add(nos,[-nr,0]))}Z`;
  const nosRidge=A>0.5?qd(tf([L*0.8,-H*(0.12+0.2*h.taper)]),tf([L*0.88,-H*(0.24+0.18*h.taper)]),tf([L*0.95,-H*(0.1+0.16*h.taper)])):'';
  /* глаз */
  const eyeC0=[cl*0.64,-H*0.17],eyeR=H*0.12*M.eyes.size*(h.eyeK||1)*(M.eyes.night?1.15:1);
  const eye=eyeGeom(h,eyeC0,eyeR,M.eyes.night,tf,[0.5,0.8,1,1][M.stage]);
  /* щёки: примета стихии головы */
  const cheek=cheekGeom(h,cl,L,H,tf,box);
  /* свет и тень головы */
  const shade={
    hi:lens(tf([cl*0.12,-H*0.3]),tf([L*0.9,-H*(0.1+0.2*h.taper)]),H*0.13),
    core:curve([[-0.15*L,H*0.55],[cl*0.55,H*(0.36+0.32*h.jaw)],[L*0.86,H*0.34],[L*0.86,H*0.16],[cl*0.55,H*0.16],[-0.12*L,H*0.18]].map(tf),true),
    socket:ell(tf(eyeC0),eyeR*1.7,eyeR*1.35,h.tilt),
    cheekHi:ell(tf([cl*0.28,H*0.16]),H*0.22,H*0.12,h.tilt-10)};
  const hornBase=tf([cl*0.26,-H*(0.38+0.16*h.crown)]);
  return {d:curve(pts,true,sharp),mouth,teeth,fangs,tusks,whisk,nostril,nosRidge,eye,eyeC:tf(eyeC0),eyeR,cheek,shade,hornBase,tf,cl,L,H,
    mouthTip:tf([L*1.02,H*0.02]),neckBack:tf([-0.05*L,0])}}

/* приметы щёк и затылка по стихии головы (не рога: их наличие решает только H) */
function cheekGeom(h,cl,L,H,tf,box){
  const K=h.cheekK||1,out={d:'',dark:'',lines:'',paint:'horn',darkPaint:'hornLine',op:1};
  if(!h.cheek)return out;
  const ds=[],dk=[],ln=[];
  const T=p=>{const q=tf(p);box.add([q]);return q};
  switch(h.cheek){
    case 'spikes':case 'jags':{
      const n=h.cheek==='jags'?4:3;
      for(let i=0;i<n;i++){const f=i/(n-1),b0=[cl*(0.16-0.1*f),H*(-0.02+0.36*f)],len0=H*(0.55-0.12*f)*K*(h.cheek==='jags'?1.15:1);
        const tip=[b0[0]-len0,b0[1]+H*(-0.18+0.3*f)],w=H*0.085*K;
        if(h.cheek==='jags'){const c=[b0[0]-len0*0.55,b0[1]-H*0.2];ds.push(`M${pt(T([b0[0],b0[1]-w]))}Q${pt(T(c))} ${pt(T(tip))}Q${pt(T(add(c,[0,w*2.2])))} ${pt(T([b0[0],b0[1]+w]))}Z`);
          dk.push(`M${pt(T(b0))}Q${pt(T(add(c,[0,w*1.6])))} ${pt(T(tip))}Q${pt(T(add(c,[0,w*2.2])))} ${pt(T([b0[0],b0[1]+w]))}Z`)}
        else{const s=spike(T([b0[0],b0[1]-w]),T([b0[0],b0[1]+w]),T(tip));ds.push(s.d);dk.push(s.dark)}}
      out.paint=h.cheek==='jags'?'crest':'horn';out.darkPaint=h.cheek==='jags'?'crestDark':'hornLine';break}
    case 'fins':{
      const J=[cl*0.08,H*0.12],rays=[150,172,194,216].map((a,i)=>add(J,mul(dirA(a),H*(0.58-0.06*Math.abs(i-1.2))*K)));
      let d=`M${pt(T([J[0]+H*0.04,J[1]-H*0.22]))}`;let prev=[J[0]+H*0.04,J[1]-H*0.22];
      rays.forEach(r=>{const m=lerpP(prev,r,0.5);d+=`Q${pt(tf(lerpP(m,J,0.3)))} ${pt(T(r))}`;prev=r});
      d+=`Q${pt(tf(lerpP(prev,J,0.5)))} ${pt(T([J[0]+H*0.06,J[1]+H*0.24]))}Z`;ds.push(d);
      rays.forEach(r=>ln.push(`M${pt(tf(J))}L${pt(tf(lerpP(J,r,0.92)))}`));
      out.paint='cheekFin';out.darkPaint='wingFold';out.op=.92;break}
    case 'plates':{
      [[cl*0.26,H*0.18,H*0.22],[cl*0.02,H*0.3,H*0.16]].forEach(([x,y,r],j)=>{const hx=[];for(let a=0;a<6;a++){const ang=a*Math.PI/3+0.3,rr=r*(0.86+0.14*hash(a,j));hx.push(T([x+Math.cos(ang)*rr,y+Math.sin(ang)*rr*0.78]))}
        ds.push(poly(hx,true));dk.push(poly([hx[0],hx[1],hx[2],[ (hx[0][0]+hx[3][0])/2,(hx[0][1]+hx[3][1])/2 ]],true));ln.push(`M${pt(tf([x-r*0.3,y-r*0.2]))}L${pt(tf([x+r*0.1,y+r*0.25]))}`)});
      out.paint='plate';out.darkPaint='core';break}
    case 'tufts':{
      [[-0.04,140],[0.12,172],[0.3,200]].forEach(([y,a],i)=>{const b0=[cl*0.1,H*y],tip=add(b0,mul(dirA(a),H*(0.62-0.08*i)*K));ds.push(lens(T(b0),T(tip),H*0.07,-H*0.06));dk.push(halfLens(tf(b0),tf(tip),H*0.07,-H*0.06));ln.push(`M${pt(tf(b0))}L${pt(tf(lerpP(b0,tip,0.85)))}`)});
      out.paint='feather';out.darkPaint='featherFar';break}
    case 'leaves':{
      [[-0.06,150],[0.14,178],[0.32,206]].forEach(([y,a],i)=>{const b0=[cl*0.12,H*y],tip=add(b0,mul(dirA(a),H*(0.66-0.1*Math.abs(i-1))*K));ds.push(lens(T(b0),T(tip),H*0.12));dk.push(halfLens(tf(b0),tf(tip),H*0.12));ln.push(`M${pt(tf(b0))}L${pt(tf(lerpP(b0,tip,0.88)))}`)});
      out.paint='leaf';out.darkPaint='leafDark';break}
    case 'crystals':{
      [[-0.02,-0.36,120],[0.16,-0.42,104],[-0.16,-0.22,140]].forEach(([x,y,a],i)=>{const b0=[cl*0.2+x*L,H*y],tip=add(b0,mul(dirA(a),H*(0.5-0.08*i)*K)),w=H*0.07,nn=perpUp(nrm(sub(tip,b0)));
        const m=lerpP(b0,tip,0.62),q=[add(b0,mul(nn,w)),add(m,mul(nn,w*0.9)),tip,sub(m,mul(nn,w*0.9)),sub(b0,mul(nn,w))];
        ds.push(poly(q.map(T),true));dk.push(poly([b0,m,tip,sub(m,mul(nn,w*0.9)),sub(b0,mul(nn,w))].map(tf),true))});
      out.paint='crystal';out.darkPaint='crystalDark';break}}
  out.d=ds.join('');out.dark=dk.join('');out.lines=ln.join('');
  return out}

/* ---------- рога ---------- */
const HORN_T={
  swept:{a0:118,a1:152,len:1.15,w:.2},straight:{a0:162,a1:160,len:1.05,w:.12},blunt:{a0:120,a1:136,len:.6,w:.26},
  antenna:{a0:150,a1:112,len:1.3,w:.085},antler:{a0:110,a1:126,len:.95,w:.13,tines:1},spire:{a0:104,a1:104,len:1.25,w:.12,rings:1},
  hook:{a0:140,a1:206,len:1.05,w:.2},plain:{a0:126,a1:150,len:.85,w:.16}};
function hornGeom(M,G,far,box){
  const st=HORN_T[M.horns.style],H=M.head.H,ln=H*st.len*M.horns.size,w=Math.max(1.6,H*st.w*Math.sqrt(M.horns.size));
  const tilt=M.head.tilt,B=add(G.hornBase,far?[-3,-2.2]:[0,0]);
  const c=add(B,rot(mul(dirA(st.a0),ln*0.55),tilt)),t=add(B,rot(mul(dirA(st.a1),ln),tilt));
  const S=tube([B,c,t],[w,w*0.62,0.5],[w,w*0.62,0.5],5);
  let d=curve(tubeOutline(S,0,0.8),true);box.add([B,c,t]);
  if(st.tines){[0.45,0.72].forEach(f=>{const s=S[Math.round(f*(S.length-1))],a=add(s.p,mul(s.up,s.rt*0.4)),b=add(a,mul(rot(s.d,-58),ln*0.32));
    const T2=tube([a,lerpP(a,b,0.5),b],[w*0.45,w*0.3,0.4],[w*0.45,w*0.3,0.4],3);d+=curve(tubeOutline(T2,0,0.6),true);box.add([b])})}
  /* кольца роста и блик вдоль верхней стороны */
  let rings='';
  const nr=st.rings?3:4;
  for(let j=0;j<nr;j++){const s=S[Math.round((0.18+j*0.16)*(S.length-1))];rings+=qd(s.top,add(s.p,mul(s.d,-s.rt*0.35)),s.bot)}
  const hiPts=[];for(let i=0;i<=Math.round(S.length*0.75);i++){const s=S[i];hiPts.push(add(s.p,mul(s.up,s.rt*0.45)))}
  return {d,rings,hi:curve(hiPts,false),w}}

function collarGeom(M,G,box){
  const H=M.head.H,base=G.neckBack,tilt=M.head.tilt,out=[];
  const at=(a,l)=>add(base,rot(mul(dirA(a),l),tilt));
  if(M.collar==='fins'){
    const sp=[[172,.78],[198,.9],[226,.68]].map(([a,l])=>at(a,H*l));
    let d=`M${pt(add(base,[0,-H*0.25]))}`;sp.forEach((p,i)=>{const prev=i?sp[i-1]:add(base,[0,-H*0.25]),m=lerpP(prev,p,0.5);d+=`Q${pt(lerpP(m,base,0.25))} ${pt(p)}`});
    d+=`Q${pt(lerpP(sp[2],base,0.4))} ${pt(add(base,[0,H*0.3]))}Z`;box.add(sp);
    return {d,ribs:sp.map(p=>`M${pt(base)}L${pt(p)}`).join(''),kind:'fins'}}
  if(M.collar==='leaves'){
    const ls=[120,148,176,204,232].map((a,i)=>lens(add(base,[0,(i-2)*H*0.08]),at(a,H*(i%2?0.72:0.9)),H*0.16));
    const dk=[120,148,176,204,232].map((a,i)=>halfLens(add(base,[0,(i-2)*H*0.08]),at(a,H*(i%2?0.72:0.9)),H*0.16));
    return {d:ls.join(''),dark:dk.join(''),ribs:[120,148,176,204,232].map((a,i)=>`M${pt(add(base,[0,(i-2)*H*0.08]))}L${pt(at(a,H*(i%2?0.6:0.76)))}`).join(''),kind:'leaves'}}
  if(M.collar==='tufts'){
    const ts=[[150,.95],[176,1.05],[200,.85]].map(([a,l],i)=>{const b0=add(base,[0,-H*0.18+i*H*0.12]),b=at(a,H*l),c=add(lerpP(b0,b,0.5),[0,-H*0.18]);
      const S=tube([b0,c,b],[H*0.09,H*0.06,0.3],[H*0.09,H*0.06,0.3],4);box.add([b]);return curve(tubeOutline(S,0,1),true)});
    return {d:ts.join(''),ribs:'',kind:'tufts'}}
  return null}

/* ---------- гребень вдоль спины ---------- */
function crestGeom(M,K,box){
  const c=M.crest,S=K.S,big=c.size===2;
  const from=K.idx.n2-1,to=big?8:K.idx.hip;          /* от шеи до бедра, большой гребень заходит на хвост */
  const hh0=(big?11:6.5)*c.k,gap={spikes:7,fin:4,plates:9,tufts:6,leaves:8,shards:6,hooks:8,ridge:6}[c.style];
  const items=[];let acc=gap*0.6;
  for(let i=from;i>to;i--){const a=S[i],b=S[i-1];acc+=len(sub(a.top,b.top));if(acc>=gap){acc=0;items.push(i)}}
  const parts=[],dark=[],pi=[],di=[],pq=[];
  const hAt=i=>{const r=(S[i].rt+S[i].rb)/2;return hh0*Math.max(0.55,Math.min(1.15,r/16))};
  items.forEach((i,j)=>{const np=parts.length,nd=dark.length;const s=S[i],q=sub(s.top,mul(s.up,0.8)),u=s.up,back=mul(s.d,-1),hh=hAt(i)*(c.style==='plates'?(j%2?0.8:1.1):1);
    const tip=add(add(q,mul(u,hh)),mul(back,hh*0.35));box.add([tip]);
    switch(c.style){
      case 'spikes':{const sp=spike(add(q,mul(back,3.6)),add(q,mul(s.d,3.6)),tip);parts.push(sp.d);dark.push(tri(q,tip,add(q,mul(back,3.6))));break}
      case 'plates':{const w=4.6*Math.min(1.3,hh/9),P=[add(q,mul(back,w)),add(add(q,mul(u,hh*0.62)),mul(back,w*0.95)),add(add(q,mul(u,hh)),mul(back,w*0.15)),add(add(q,mul(u,hh*0.62)),mul(s.d,w*0.8)),add(q,mul(s.d,w))];
        parts.push(poly(P,true));dark.push(poly([P[0],P[1],P[2],q],true));break}
      case 'tufts':{const a=add(q,mul(s.d,2)),b=add(add(q,mul(u,hh)),mul(back,hh*0.7));parts.push(lens(a,b,2.2,-1.5));dark.push(halfLens(a,b,2.2,-1.5));break}
      case 'leaves':{const b=add(add(q,mul(u,hh*1.05)),mul(back,hh*0.55));parts.push(lens(q,b,hh*0.28));dark.push(halfLens(q,b,hh*0.28));break}
      case 'shards':{const b=add(add(q,mul(u,hh*1.3)),mul(back,hh*0.15)),P=[add(q,mul(back,2.2)),add(lerpP(q,b,0.62),mul(back,1.6)),b,add(lerpP(q,b,0.62),mul(s.d,1.6)),add(q,mul(s.d,2.2))];
        parts.push(poly(P,true));dark.push(poly([P[0],P[1],P[2],q],true));break}
      case 'hooks':{const b=add(add(q,mul(u,hh*0.9)),mul(back,hh*0.75)),c1=add(q,mul(u,hh*0.95));parts.push(`M${pt(add(q,mul(back,3.2)))}Q${pt(add(c1,mul(back,1)))} ${pt(b)}Q${pt(add(c1,mul(s.d,2.6)))} ${pt(add(q,mul(s.d,3.2)))}Z`);
        dark.push(`M${pt(add(q,mul(back,3.2)))}Q${pt(add(c1,mul(back,1)))} ${pt(b)}Q${pt(add(q,mul(u,hh*0.4)))} ${pt(q)}Z`);break}
      case 'ridge':parts.push(`M${pt(add(q,mul(back,3.2)))}Q${pt(add(q,mul(u,hh*1.1)))} ${pt(add(q,mul(s.d,3.2)))}Z`);break}
    for(let k=np;k<parts.length;k++){pi.push(i);pq.push(q)}for(let k=nd;k<dark.length;k++)di.push(i)});
  if(c.style==='fin'){
    /* сплошной плавник с рёбрами и волнистым краем */
    const top=[],base=[];
    items.forEach((i,j)=>{const s=S[i],hh=hAt(i)*(0.85+0.25*Math.sin(j*1.3));base.push(sub(s.top,mul(s.up,0.8)));top.push(add(add(s.top,mul(s.up,hh)),mul(s.d,-hh*0.3)))});
    if(top.length>1){box.add(top);return {d:curve(top.concat(base.slice().reverse()),true),ribs:base.map((b,i)=>`M${pt(b)}L${pt(top[i])}`).join(''),fin:1,dark:''}}}
  /* по шипу с номером позвонка: риг анимации отдаёт каждый шип целиком хвосту, туловищу или шее */
  return {d:parts.join(''),dark:dark.join(''),ribs:'',items:{parts:parts.map((d,k)=>[pi[k],d,pq[k]]),dark:dark.map((d,k)=>[di[k],d])}}}

/* ---------- кончик хвоста ---------- */
function tailEndGeom(M,K,box){
  const s=K.S[0],out=mul(s.d,-1),tip=s.p,up=perpUp(out),k=Math.sqrt(M.body.tailL/90);
  if(M.mace){const r=6.2*M.mace.size*k*1.1,c=add(tip,mul(out,r*0.6)),sp=[];
    for(let i=0;i<7;i++){const a=rot(out,-90+i*30),b=add(c,mul(a,r*1.75));sp.push(tri(add(c,mul(rot(a,-90),r*0.32)),b,add(c,mul(rot(a,90),r*0.32))))}
    box.add([add(c,mul(out,r*1.8))]);
    return {part:'mace',ball:circ(c,r),spikes:sp.join(''),c,r}}
  const L=(x,y)=>add(add(tip,mul(out,x*k)),mul(up,y*k));
  let d='',fx='',dark='';
  switch(M.tailEnd){
    case 'flame':d=curve([L(-2,3),L(6,7),L(10,13),L(13,5),L(20,9),L(17,0),L(24,-4),L(14,-5),L(9,-12),L(4,-4),L(-2,-3)],true);
      fx=curve([L(1,1.5),L(7,4),L(11,6),L(13,1),L(17,-1),L(9,-3),L(5,-5),L(1,-1.5)],true);break;
    case 'fluke':d=`M${pt(L(-3,2.6))}Q${pt(L(6,14))} ${pt(L(10,19))}Q${pt(L(9,6))} ${pt(L(5,0))}Q${pt(L(9,-6))} ${pt(L(10,-19))}Q${pt(L(6,-14))} ${pt(L(-3,-2.6))}Z`;
      fx=`M${pt(L(-1,1))}L${pt(L(8,15))}M${pt(L(1,0.5))}L${pt(L(7,8))}M${pt(L(-1,-1))}L${pt(L(8,-15))}M${pt(L(1,-0.5))}L${pt(L(7,-8))}`;
      dark=`M${pt(L(-3,-2.6))}Q${pt(L(6,-14))} ${pt(L(10,-19))}Q${pt(L(9,-6))} ${pt(L(5,0))}Z`;break;
    case 'blunt':d=`M${pt(L(-2,4))}Q${pt(L(5,5))} ${pt(L(5,0))}Q${pt(L(5,-5))} ${pt(L(-2,-4))}Z`;fx=`M${pt(L(0,4))}L${pt(L(2,-4))}M${pt(L(3,3.6))}L${pt(L(4.2,-3))}`;break;
    case 'ribbons':d=[[10,1],[-8,.8],[2,1.2]].map(([y,w])=>{const S=tube([L(-1,0),L(10,y*0.6),L(20,y),L(30,y*0.5)],[w*1.4,w*1.6,w*1.2,0.3],[w*1.4,w*1.6,w*1.2,0.3],4);return curve(tubeOutline(S,0,1),true)}).join('');break;
    case 'leaf':d=lens(L(-2,0),L(26,4),7.5*k);dark=halfLens(L(-2,0),L(26,4),7.5*k);fx=`M${pt(L(-1,0))}Q${pt(L(12,3))} ${pt(L(24,3.8))}`;break;
    case 'fan':d=[-36,-18,0,18,36].map(a=>lens(L(0,0),add(tip,mul(rot(out,a),22*k)),3.2*k)).join('');dark=[-36,-18,0,18,36].map(a=>halfLens(L(0,0),add(tip,mul(rot(out,a),22*k)),3.2*k)).join('');fx=[-36,-18,0,18,36].map(a=>`M${pt(tip)}L${pt(add(tip,mul(rot(out,a),19*k)))}`).join('');break;
    case 'blade':d=poly([L(-2,3),L(4,9),L(18,0),L(4,-9),L(-2,-3)],true);dark=poly([L(-2,-3),L(4,-9),L(18,0),L(0,0)],true);fx=`M${pt(L(0,0))}L${pt(L(15,0))}`;break;
    default:return null}
  box.add([L(24,0),L(10,19),L(10,-19)].slice(0,M.tailEnd==='fluke'?3:1));
  return {part:'tailEnd',d,fx,dark}}

/* ---------- чешуя по цилиндру тела ----------
   Вдоль позвоночника идём по длине дуги, поперёк — по углу вокруг оси трубки: экранный сдвиг r·sin(угла),
   поэтому к краям ряды сжимаются, как на настоящем цилиндре. Размер чешуи растёт с толщиной тела. */
function cyl(S,i0,i1,o,cb){
  const cum=[0];for(let i=1;i<S.length;i++)cum.push(cum[i-1]+len(sub(S[i].p,S[i-1].p)));
  let j=i0,col=0;
  for(let x=cum[i0]+0.5;x<cum[i1];col++){
    while(j<i1-1&&cum[j+1]<x)j++;
    const a=S[j],b=S[j+1],t=Math.max(0,Math.min(1,(x-cum[j])/Math.max(1e-6,cum[j+1]-cum[j])));
    const s={p:lerpP(a.p,b.p,t),up:nrm(lerpP(a.up,b.up,t)),d:nrm(lerpP(a.d,b.d,t)),rt:lerp(a.rt,b.rt,t),rb:lerp(a.rb,b.rb,t)};
    const r=(s.rt+s.rb)/2,size=Math.max(o.min,Math.min(o.max,r*o.k)),dth=Math.min(0.9,size/r*(o.row||1));
    const off=col%2?dth/2:0;let row=0;
    for(let th=o.top-off;th>o.bot;th-=dth,row++){
      const v=Math.sin(th),c=v>=0?add(s.p,mul(s.up,s.rt*v)):add(s.p,mul(s.up,s.rb*v));
      cb(c,s,size,Math.max(0.3,Math.cos(th)),th,col,row,dth*r)}
    x+=size*(o.step||0.8)}}

function skinGeom(M,K){
  const S=K.S,det=M.detail,st=M.skin,o={lines:[],hi:[],fills:[],dark:[],under:'',glow:[]};
  const res=()=>({lines:o.lines.join(''),hi:o.hi.join(''),fills:o.fills.join(''),dark:o.dark.join(''),under:o.under,glow:o.glow.join(''),op:det<=0?0:0.35+0.5*Math.min(det,1)});
  if(det<=0)return res();
  const i0=1,i1=K.idx.n2-1;
  /* черепица: видимый край каждой чешуйки выгнут к хвосту */
  const shingle=(c,s,sz,f,th,wk)=>{const u=s.up,d=s.d,hh=sz*0.5*f,ww=sz*0.6*(wk||1);
    o.lines.push(qd(add(c,mul(u,hh)),sub(c,mul(d,ww*1.5)),sub(c,mul(u,hh))));
    if(th>0.1)o.hi.push(qd(add(add(c,mul(u,hh*0.7)),mul(d,sz*0.12)),add(add(c,mul(d,-ww*1.05+sz*0.12)),mul(u,hh*0.42)),add(c,mul(d,-ww*0.55+sz*0.12))))};
  /* пластина: скруглённый четырёхугольник по клетке сетки */
  const plate=(c,s,sz,f,cellH,gap,jit,col,row)=>{const u=s.up,d=s.d,ax=sz*(o.stepK||0.5)-gap,ay=Math.max(0.6,cellH*0.5-gap);
    const j=(m)=>1-jit*hash(col*7+m,row*13+m);
    const P=[add(add(c,mul(d,ax*j(1))),mul(u,ay*j(2))),add(add(c,mul(d,-ax*j(3))),mul(u,ay*j(4))),add(add(c,mul(d,-ax*j(5))),mul(u,-ay*j(6))),add(add(c,mul(d,ax*j(7))),mul(u,-ay*j(8)))];
    const mids=P.map((p,m)=>lerpP(p,P[(m+1)%4],0.5)),ring=[];P.forEach((p,m)=>{ring.push(lerpP(c,p,0.97));ring.push(mids[m])});
    return {d:curve(ring,true),top:qd(lerpP(c,P[1],0.8),lerpP(c,lerpP(P[0],P[1],0.5),1.02),lerpP(c,P[0],0.8)),P}};
  switch(st){
    case 'lava':{
      /* базальтовые плиты на спине, в швах между ними светится лава */
      o.under=band(S,3,K.idx.n1,-0.25,1.3);o.stepK=0.5;
      cyl(S,i0,i1,{k:.72,min:4.5,max:13,top:1.45,bot:-0.2,step:1},(c,s,sz,f,th,col,row,cellH)=>{
        const p=plate(c,s,sz,f,cellH*f,0.32,0.08,col,row);o.fills.push(p.d);if(th>0.2)o.hi.push(p.top)});break}
    case 'plates':{
      /* каменные пластины с трещинами и камешками */
      o.stepK=0.5;
      cyl(S,i0,i1,{k:.8,min:5,max:15,top:1.45,bot:-0.3,step:1},(c,s,sz,f,th,col,row,cellH)=>{
        const p=plate(c,s,sz,f,cellH*f,0.6,0.22,col,row);o.fills.push(p.d);o.lines.push(p.d);if(th>0.2)o.hi.push(p.top);
        if(hash(col+3,row)>0.6)o.dark.push(qd(lerpP(c,p.P[1],0.6),lerpP(c,p.P[0],0.2),lerpP(c,p.P[3],0.5)))});break}
    case 'ripple':
      cyl(S,i0,i1,{k:.36,min:2.4,max:6.5,top:1.4,bot:-0.35,step:.72},(c,s,sz,f,th)=>shingle(c,s,sz,f,th));break;
    case 'feather':
      cyl(S,i0,i1,{k:.5,min:3,max:9,top:1.4,bot:-0.3,step:.95,row:1.1},(c,s,sz,f,th)=>shingle(c,s,sz,f,th,1.5));break;
    case 'veins':
      /* листовые чешуйки с жилкой, кое-где мох */
      cyl(S,i0,i1,{k:.55,min:3.2,max:10,top:1.4,bot:-0.3,step:.9},(c,s,sz,f,th,col,row)=>{const a=add(c,mul(s.d,sz*0.3)),b=sub(c,mul(s.d,sz*0.8)),w=sz*0.3*f;
        o.fills.push(lens(a,b,w));o.lines.push(`M${pt(a)}L${pt(lerpP(a,b,0.85))}`);if(th>0.15)o.hi.push(qd(a,add(lerpP(a,b,0.45),mul(s.up,w*0.8)),b));
        if(hash(col,row)>0.88)o.glow.push(circ(c,Math.max(0.8,sz*0.14)))});break;
    case 'shimmer':
      /* ромбики, через один светлее, редкие искры */
      cyl(S,i0,i1,{k:.42,min:2.6,max:8,top:1.4,bot:-0.3,step:.8},(c,s,sz,f,th,col,row)=>{const u=s.up,d=s.d,hh=sz*0.5*f,ww=sz*0.42;
        const P=[add(c,mul(u,hh)),add(c,mul(d,ww)),sub(c,mul(u,hh)),sub(c,mul(d,ww))];
        if((col+row)%2===0)o.fills.push(poly(P,true));o.lines.push(poly(P,true));
        if(th>0.3&&hash(col,row)>0.9){const r=Math.max(1.2,sz*0.35);o.glow.push(`M${pt(add(c,[0,-r]))}L${pt(add(c,[0,r]))}M${pt(add(c,[-r,0]))}L${pt(add(c,[r,0]))}`)}});break;
    case 'bands':{
      /* острые чешуи и тёмные поперечные полосы по спине */
      cyl(S,i0,i1,{k:.45,min:2.6,max:8,top:1.4,bot:-0.3,step:.8},(c,s,sz,f,th)=>{const u=s.up,d=s.d,hh=sz*0.5*f,ww=sz*0.62;
        o.lines.push(`M${pt(add(c,mul(u,hh)))}L${pt(sub(c,mul(d,ww*1.4)))}L${pt(sub(c,mul(u,hh)))}`);if(th>0.15)o.hi.push(`M${pt(add(add(c,mul(u,hh*0.7)),mul(d,sz*0.1)))}L${pt(sub(c,mul(d,ww*1.1)))}`)});
      for(let i=4;i<K.idx.n1;i+=3){const s=S[i],a=across(s,0.98),b=across(s,0.08),w=Math.max(1.6,s.rt*0.14);o.fills.push(poly([add(a,mul(s.d,w)),add(a,mul(s.d,-w)),add(b,mul(s.d,-w*0.3)),add(b,mul(s.d,w*0.3))],true))}
      break}
    default:
      cyl(S,i0,i1,{k:.45,min:2.6,max:8,top:1.4,bot:-0.3,step:.8},(c,s,sz,f,th)=>shingle(c,s,sz,f,th))}
  return res()}

/* ---------- брюхо и блеск ---------- */
function bellyGeom(K){
  const S=K.S,a=3,b=K.idx.n1+1,outer=[],inner=[],sc=[];
  for(let i=a;i<=b;i++){const s=S[i],k=i<K.idx.hip?0.42:0.5;outer.push(s.bot);inner.push(sub(s.p,mul(s.up,-s.rb*(1-k)*0.1+s.rb*k)));if(i%2===0)sc.push(`M${pt(s.bot)}Q${pt(add(lerpP(s.bot,inner[inner.length-1],0.5),mul(s.d,-1.2)))} ${pt(inner[inner.length-1])}`)}
  return {d:curve(outer.concat(inner.slice().reverse()),true),scutes:sc.join('')}}
function metalGeom(K){
  const S=K.S,pts=[],pts2=[];
  for(let i=6;i<=K.idx.n1;i++){const s=S[i];pts.push(add(s.p,mul(s.up,s.rt*0.55)));pts2.push(add(s.p,mul(s.up,s.rt*0.25)))}
  return {d:curve(pts,false),d2:curve(pts2,false)}}

/* ---------- дыхание у пасти ---------- */
function breathGeom(M,G){
  const p=G.mouthTip,tilt=M.head.tilt,at=(x,y)=>add(p,rot([x,y],tilt)),out=[];
  if(M.breath==='smoke')return [{paint:'smoke',d:[[6,-4,4.2],[11,-11,3.2],[9,-18,2.2]].map(([x,y,r])=>circ(at(x,y),r)).join(''),op:.4}];
  if(M.breath!=='element')return [];
  M.elements.forEach((e,j)=>{const o=j?[3,7]:[0,0],A=(x,y)=>at(x+o[0],y+o[1]);
    switch(e){
      case 'F':out.push({paint:'fireOuter',d:curve([A(0,0),A(7,-6),A(13,-2),A(12,-10),A(20,-2),A(15,7),A(4,5)],true)},{paint:'fireInner',d:curve([A(2,1),A(7,-2),A(11,1),A(10,-4),A(14,1),A(11,5),A(3,4)],true)});break;
      case 'W':out.push({paint:'water',d:[[6,-5],[12,1],[5,6]].map(([x,y])=>lens(A(x,y-3),A(x,y+3),2.2)).join('')});break;
      case 'T':out.push({paint:'earth',d:[[6,-2,2.6],[12,3,2],[5,6,1.6]].map(([x,y,r])=>{const c=A(x,y);return `M${pt(add(c,[r,0]))}L${pt(add(c,[0,-r]))}L${pt(add(c,[-r,0]))}L${pt(add(c,[0,r]))}Z`}).join('')});break;
      case 'A':out.push({paint:'air',line:1.8,d:`M${pt(A(2,-2))}Q${pt(A(9,-7))} ${pt(A(12,-1))}Q${pt(A(10,3))} ${pt(A(6,0))}M${pt(A(4,5))}Q${pt(A(10,3))} ${pt(A(15,7))}`});break;
      case 'P':out.push({paint:'flora',d:lens(A(2,0),A(16,-6),3)+lens(A(4,3),A(15,7),2.6)});break;
      case 'L':out.push({paint:'light',d:poly([A(9,-9),A(11,-2),A(18,0),A(11,2),A(9,9),A(7,2),A(0,0),A(7,-2)],true)});break;
      case 'D':out.push({paint:'dark',d:curve([A(1,0),A(7,-6),A(12,-1),A(16,-5),A(14,3),A(6,5)],true),op:.85});break}});
  return out}
/* где лежит дыхание у пасти: рамка рисунка должна его вмещать, иначе пламя обрезается краем */
function breathBox(M,G){
  const p=G.mouthTip,at=(x,y)=>add(p,rot([x,y],M.head.tilt));
  if(M.breath==='smoke')return [at(-1,-21),at(16,-21),at(16,2),at(-1,2)];
  if(M.breath!=='element')return [];
  const lo=M.elements.length>1?18:11;return [at(-1,-12),at(22,-12),at(22,lo),at(-1,lo)]}

/* ---------- сборка ---------- */
function build(M){
  const box=new Box(),b=M.body,L=[];
  const K=skeleton(M),S=K.S;
  const bodyPts=box.add(tubeOutline(S,2.4,0));
  const bodyD=curve(bodyPts,true,new Set([0]));
  const push=(part,o)=>{if(o&&o.d)L.push(Object.assign({part},o))};
  const det=M.detail;

  /* опоры крыла на спине */
  const near=(x)=>{let best=0,bd=1e9;for(let i=K.idx.hip;i<=K.idx.sh;i++){const dd=Math.abs(S[i].p[0]-x);if(dd<bd){bd=dd;best=i}}return S[best]};
  const S72=WS*M.wing.span;
  const rootS=near(K.sh[0]-b.len*0.2),root=sub(rootS.top,mul(rootS.up,2));
  const trailS=near(K.sh[0]-b.len*0.2-Math.min(0.55*S72*M.wing.chord,b.len*0.7)),trail=sub(trailS.top,mul(trailS.up,3));
  const wingF=wingGeom(M,root,trail,box,true),wingN=wingGeom(M,root,trail,box,false);

  /* лапы */
  const hindA=add(K.hip,[b.hipR*0.12,b.hipR*0.22]),frontA=add(K.sh,[-b.chestR*0.18,b.chestR*0.34]);
  const LP={hindF:legPts('hind',add(hindA,[6,-2]),-2.4,b,M),frontF:legPts('front',add(frontA,[6,-2]),-2.4,b,M),hind:legPts('hind',hindA,0,b,M),front:legPts('front',frontA,0,b,M)};
  const legs={hindF:legGeom(LP.hindF,-2.4,box),frontF:legGeom(LP.frontF,-2.4,box),hind:legGeom(LP.hind,0,box),front:legGeom(LP.front,0,box)};
  /* шпоры у каждой задней лапы отдельно: дальняя рисуется со своей лапой за телом, ближняя со своей */
  const spurOf=k=>{if(!M.spurs)return null;const s=M.spurs.size,h=LP[k].hock;return spike(add(h,[1,-3.4]),add(h,[1.4,3.2]),add(h,[-13*s,0.6]))};

  const G=headGeom(M,K.N2,box);

  /* слои сзади вперёд */
  if(M.aura){const c=lerpP(K.hip,K.sh,0.5);L.push({part:'aura',paint:'aura',d:ell(c,90,70,0),fx:1})}
  {const c=(K.hip[0]+K.sh[0])/2,rx=(b.len+b.hipR+b.chestR)*0.78+8;L.push({part:'shadow',paint:'shadow',d:ell([c,0],rx,6,0)})}
  /* дальнее крыло в тени тела */
  push('wings',{paint:'wingFar',stroke:'edge',d:wingF.d,far:1});
  if(wingF.leafDark)push('wings',{paint:'leafDark',d:wingF.leafDark,op:.5,far:1,fx:1});
  push('wings',{paint:'boneFar',d:wingF.bone,far:1});
  if(wingF.feathers){push('wings',{paint:'featherFar',stroke:'edge',sw:.7,d:wingF.feathers,far:1});push('wings',{paint:'core',d:wingF.fdark,op:.3,far:1,fx:1})}
  /* дальние лапы */
  /* leg: какая это лапа для анимации (F дальняя, N ближняя; H задняя, F передняя) */
  ['hindF','frontF'].forEach(k=>{const leg=k==='hindF'?'FH':'FF';push('legs',{paint:'legFar',stroke:'edge',d:legs[k].d,leg});push('legs',{paint:'legFar',stroke:'edge',sw:.7,d:legs[k].toes,leg});push('legs',{paint:'claw',stroke:'edge',sw:.6,d:legs[k].claws,leg});
    const sp=k==='hindF'&&spurOf(k);if(sp){push('spurs',{paint:'claw',stroke:'edge',sw:.9,d:sp.d,leg});push('spurs',{paint:'hornLine',d:sp.dark,op:.45,fx:1,leg})}});
  if(M.horns){const hf=hornGeom(M,G,true,box);push('horns',{paint:'hornFar',stroke:'edge',d:hf.d})}
  const col=M.collar?collarGeom(M,G,box):null;
  if(col){push('collar',{paint:col.kind==='leaves'?'leaf':'crest',stroke:'edge',d:col.d,op:col.kind==='fins'?0.92:1});if(col.dark)push('collar',{paint:'leafDark',d:col.dark,op:.45,fx:1});push('collar',{paint:'rib',line:.9,d:col.ribs})}
  if(M.crest){const cr=crestGeom(M,K,box),pc=M.crest.style==='leaves'?'leaf':M.crest.style==='shards'?'crystal':'crest';
    const pd=pc==='leaf'?'leafDark':pc==='crystal'?'crystalDark':'crestDark';
    if(cr.items){
      /* шипы по участкам тела (seg), разрезы те же, что в rigOf: хвост позади бедра, шея от её основания */
      const seg=i=>i<=K.idx.hip-2?'tail':i>=K.idx.n0?'neck':'trunk',by=list=>{const o={};list.forEach(([i,d])=>{const k=seg(i);o[k]=(o[k]||'')+d});return o};
      const P=by(cr.items.parts),Dk=by(cr.items.dark);
      /* на гнущихся хвосте и шее риг ставит каждый шип целиком по месту его основания (pieces) */
      const pcs=k=>k==='trunk'?null:cr.items.parts.filter(([i])=>seg(i)===k).map(([i,d,q])=>({d,q:[q[0],q[1]]}));
      ['tail','trunk','neck'].forEach(k=>{if(P[k])push('crest',{paint:pc,stroke:'edge',d:P[k],op:1,seg:k,pieces:pcs(k)})});
      ['tail','trunk','neck'].forEach(k=>{if(Dk[k])push('crest',{paint:pd,d:Dk[k],op:.75,fx:1,seg:k})})}
    else{push('crest',{paint:pc,stroke:'edge',d:cr.d,op:cr.fin?0.9:1});
      if(cr.dark)push('crest',{paint:pd,d:cr.dark,op:.75,fx:1})}
    if(cr.ribs)push('crest',{paint:'rib',line:.9,d:cr.ribs})}
  const te=tailEndGeom(M,K,box);
  if(te&&te.part==='mace'){push('mace',{paint:'maceSpike',stroke:'edge',d:te.spikes});push('mace',{paint:'mace',stroke:'edge',d:te.ball,grad:'ball',c:te.c,r:te.r})}
  else if(te){const tp=({flame:'fireOuter',leaf:'leaf',fan:'feather'})[M.tailEnd]||'crest';push('tailEnd',{paint:tp,stroke:'edge',d:te.d});
    if(te.dark)push('tailEnd',{paint:tp==='leaf'?'leafDark':'crestDark',d:te.dark,op:.5,fx:1});
    if(te.fx)push('tailEnd',M.tailEnd==='flame'?{paint:'fireInner',d:te.fx}:{paint:'rib',line:.9,d:te.fx})}

  /* тело: заливка, лава под плитами, чешуя, брюхо, складки, затем свет и тень поверх */
  push('body',{paint:'body',stroke:'edge',d:bodyD,grad:'body',clipId:'body'});
  const sk=skinGeom(M,K);
  if(sk.under){push('skin',{paint:'lava',d:sk.under,clip:'body',glow:1});push('skin',{paint:'lavaHot',d:band(S,6,K.idx.n1-2,0.2,0.9),clip:'body',blur:qb(3),op:.7,fx:1})}
  if(sk.fills)push('skin',{paint:'texFill',d:sk.fills,clip:'body',op:M.skin==='lava'||M.skin==='plates'?1:sk.op*0.8});
  const bel=bellyGeom(K);push('body',{paint:'belly',d:bel.d,clip:'body'});push('body',{paint:'scute',line:1,d:bel.scutes,clip:'body',op:.8});
  if(sk.lines)push('skin',{paint:'scaleLine',line:M.skin==='plates'?0.8:0.7,d:sk.lines,clip:'body',op:sk.op*0.75});
  if(sk.dark)push('skin',{paint:'scaleLine',line:.7,d:sk.dark,clip:'body',op:sk.op});
  if(sk.hi)push('skin',{paint:'scaleHi',line:.7,d:sk.hi,clip:'body',op:sk.op*0.7,fx:1});
  if(sk.glow)push('skin',{paint:M.skin==='lava'?'lavaHot':M.skin==='veins'?'leaf':'sparkle',line:M.skin==='veins'?0:1,d:sk.glow,clip:'body',op:.9,glow:1});
  /* складки кожи: плечо, поперечные морщины на горле */
  {const fr=b.chestR*0.8,c=frontA,arc=[];for(let a=200;a<=330;a+=26)arc.push(add(c,mul(dirA(a),-fr)));push('body',{paint:'fold',line:1.1,d:curve(arc,false),clip:'body',op:.32*Math.min(1,det+0.4),fx:1})}
  {let nf='';for(let i=K.idx.n0;i<=K.idx.n2-2;i+=2){const s=S[i];nf+=qd(across(s,-0.97),add(across(s,-0.68),mul(s.d,1.2)),across(s,-0.4))}push('body',{paint:'fold',line:.9,d:nf,clip:'body',op:.35,fx:1})}
  /* тени: под корнем крыла и там, где лапы входят в тело */
  /* of: чья это тень для карты генов. Тень от крыла лежит на теле, но зависит от генов крыла */
  push('body',{paint:'core',d:ell(add(root,[-2,4]),Math.max(10,S72*0.18),7,-10),clip:'body',blur:qb(4),op:.4,fx:1,of:'wings'});
  push('body',{paint:'core',d:ell(add(hindA,[0,4]),b.hipR*0.9,b.hipR*0.75,0)+ell(add(frontA,[0,4]),b.chestR*0.6,b.chestR*0.6,0),clip:'body',blur:qb(b.hipR*0.35),op:.35,fx:1});
  shadeTube(S,1,K.idx.n2,'body',{core:.62,hi:.5}).forEach(o=>push('body',o));
  /* голова бросает тень на шею */
  push('body',{paint:'core',d:ell(add(K.N2,[-G.H*0.1,G.H*0.55]),G.H*0.75,G.H*0.45,M.head.tilt),clip:'body',blur:qb(G.H*0.18),op:.45,fx:1});
  {const rim=[];for(let i=3;i<=K.idx.n2;i++){const q=S[i];rim.push(sub(q.top,mul(q.up,Math.min(2.2,q.rt*0.18))))}push('body',{paint:'rim',line:1.6,d:curve(rim,false),clip:'body',op:.5,fx:1})}
  if(M.metal){const mg=metalGeom(K);push('metal',{paint:'metal',line:4.2,d:mg.d,clip:'body',op:.55,blur:qb(1)});push('metal',{paint:'metal',line:1.4,d:mg.d2,clip:'body',op:.55})}
  /* ближние лапы: заливка, объём, мышца бедра, пальцы и когти */
  [['hind','legH','NH'],['front','legF','NF']].forEach(([k,cid,leg])=>{const lg=legs[k],Lp=LP[k];
    push('legs',{paint:'body',stroke:'edge',d:lg.d,grad:'body',clipId:cid,leg});
    shadeTube(lg.S,0,lg.S.length-1,cid,{core:.5,hi:.35}).forEach(o=>push('legs',Object.assign(o,{leg})));
    const th=lerpP(Lp.ctrl[0],Lp.knee,0.38),ang=Math.atan2(Lp.knee[1]-Lp.ctrl[0][1],Lp.knee[0]-Lp.ctrl[0][0])*180/Math.PI;
    push('legs',{paint:'hi',d:ell(add(th,[Lp.r[0]*0.15,-Lp.r[0]*0.1]),Lp.r[0]*0.75,Lp.r[0]*0.4,ang),clip:cid,blur:qb(Lp.r[0]*0.25),op:.35,fx:1,leg});
    push('legs',{paint:'body',stroke:'edge',sw:.8,d:lg.toes,grad:'body',leg});
    push('legs',{paint:'claw',stroke:'edge',sw:.6,d:lg.claws,leg});
    const sp=k==='hind'&&spurOf(k);if(sp){push('spurs',{paint:'claw',stroke:'edge',sw:.9,d:sp.d,leg});push('spurs',{paint:'hornLine',d:sp.dark,op:.45,fx:1,leg})}});
  /* голова */
  push('head',{paint:'body',stroke:'edge',d:G.d,grad:'body',clipId:'head'});
  push('head',{paint:'core',d:G.shade.core,clip:'head',blur:qb(G.H*0.12),op:.5,fx:1});
  push('head',{paint:'hi',d:G.shade.hi,clip:'head',blur:qb(G.H*0.09),op:.5,fx:1});
  push('head',{paint:'hi',d:G.shade.cheekHi,clip:'head',blur:qb(G.H*0.08),op:.25,fx:1});
  push('head',{paint:'core',d:G.shade.socket,clip:'head',blur:qb(G.eyeR*0.5),op:.3,fx:1,of:'eyes'});
  if(M.metal)push('metal',{paint:'metal',line:2.4,d:`M${pt(G.tf([G.cl*0.1,-G.H*0.3]))}Q${pt(G.tf([G.cl*0.7,-G.H*0.46]))} ${pt(G.tf([G.L*0.9,-G.H*0.2]))}`,clip:'head',op:.5});
  push('head',{paint:'edgeLine',line:1.3,d:G.mouth});
  if(G.teeth)push('head',{paint:'tooth',stroke:'edge',sw:.5,d:G.teeth});
  if(G.fangs)push('head',{paint:'tooth',stroke:'edge',sw:.6,d:G.fangs});
  if(G.tusks)push('head',{paint:'horn',stroke:'edge',sw:.8,d:G.tusks,grad:'horn'});
  push('head',{paint:'edgeFill',d:G.nostril});
  if(G.nosRidge)push('head',{paint:'fold',line:1,d:G.nosRidge,op:.5,fx:1});
  if(G.whisk)push('head',{paint:'whisker',line:1.3,d:G.whisk});
  if(G.cheek.d){push('head',{paint:G.cheek.paint,stroke:'edge',sw:1,d:G.cheek.d,op:G.cheek.op});
    if(G.cheek.dark)push('head',{paint:G.cheek.darkPaint,d:G.cheek.dark,op:.5,fx:1});
    if(G.cheek.lines)push('head',{paint:'rib',line:.7,d:G.cheek.lines,op:.7})}
  /* глаз: белок, радужка с тёмным ободком, зрачок, блики, толстое верхнее веко, надбровная дуга */
  const E=G.eye;
  if(M.eyes.glow)push('eyes',{paint:'glow',grad:'glow',d:circ(G.eyeC,G.eyeR*2.6),fx:1});
  push('eyes',{paint:'eyeWhite',stroke:'edge',sw:1,d:E.sclera,clipId:'eye'});
  push('eyes',{paint:'iris',d:E.iris,clip:'eye',grad:'iris',c:E.irisC,r:E.ir});
  push('eyes',{paint:'pupil',d:E.pupil,clip:'eye'});
  if(M.eyes.night)push('eyes',{paint:'tapetum',d:circ(add(E.irisC,[E.ir*0.3,-E.ir*0.15]),E.ir*0.22),clip:'eye',op:.9});
  /* толщина век не растёт вслед за огромным глазом малыша, иначе веко выглядит как очки */
  push('eyes',{paint:'core',line:Math.max(1,Math.min(G.eyeR*0.55,6)),d:E.lid,clip:'eye',op:.35,blur:qb(Math.min(G.eyeR*0.22,2.5)),fx:1});
  push('eyes',{paint:'white',d:E.shine,clip:'eye'});
  if(M.breath==='dormant')push('eyes',{paint:'body',stroke:'edge',sw:1,d:E.sleep});
  /* веко для моргания: только для анимации (rig), на неподвижном рисунке глаз открыт */
  else{push('eyes',{paint:'body',stroke:'edge',sw:1,d:E.shut,rig:1});   /* закрывает глаз целиком, край века — по нижней линии */
    push('eyes',{paint:'lid',line:Math.max(1.2,Math.min(G.eyeR*0.25,3)),d:E.lower,rig:1})}
  push('eyes',{paint:'lid',line:Math.max(1.4,Math.min(G.eyeR*0.34,3.6)),d:E.lid});
  push('eyes',{paint:'lid',line:Math.max(0.7,Math.min(G.eyeR*0.12,1.3)),d:E.lower,op:.7});
  /* надбровье лежит на голове (обрезано по ней, чтобы у крупноглазых малышей не висело в воздухе), но повторяет глаз: по генам оно часть глаза */
  if(E.brow){push('head',{paint:'brow',stroke:'edge',sw:.9,d:E.brow,clip:'head',of:'eyes'});push('head',{paint:'core',line:1.2,d:E.browSh,clip:'head',op:.35,blur:qb(1),fx:1,of:'eyes'})}
  if(M.horns){const hn=hornGeom(M,G,false,box);push('horns',{paint:'horn',stroke:'edge',d:hn.d,grad:'horn'});
    push('horns',{paint:'hornLine',line:.8,d:hn.rings,op:.55});push('horns',{paint:'white',line:Math.max(0.8,hn.w*0.3),d:hn.hi,op:.45,blur:qb(0.5),fx:1})}
  /* ближнее крыло: перепонка, складки и жилки, кости поверх */
  push('wings',{paint:'wing',stroke:'edge',d:wingN.d,grad:'wing',clipId:'wingN'});
  if(M.wing.type!=='leaf'){
    wingN.panels.forEach((p,i)=>{if(i%2)push('wings',{paint:'wingFold',d:p,clip:'wingN',op:.16,fx:1})});
    push('wings',{paint:'core',line:2.4,d:wingN.folds,clip:'wingN',op:.35,blur:qb(1.5),fx:1});
    push('wings',{paint:'vein',line:.6,d:wingN.veins,clip:'wingN',op:.5*Math.min(1,det+0.3)});
    push('wings',{paint:'hi',line:2,d:wingN.edge,clip:'wingN',op:.35,blur:qb(1.2),fx:1})}
  else{push('wings',{paint:'leafDark',d:wingN.leafDark,op:.45,fx:1});push('wings',{paint:'rib',line:1,d:wingN.leafVeins,op:.8})}
  if(M.wing.type!=='leaf'){push('wings',{paint:'bone',stroke:'edge',sw:.55,d:wingN.bone});push('wings',{paint:'bone',stroke:'edge',sw:.55,d:wingN.knuckles})}
  if(wingN.feathers){push('wings',{paint:'feather',stroke:'edge',sw:.7,d:wingN.feathers});push('wings',{paint:'core',d:wingN.fdark,op:.22,fx:1});push('wings',{paint:'vein',line:.6,d:wingN.shafts,op:.6})}
  if(wingN.extra)push('wings',{paint:'claw',stroke:'edge',sw:.7,d:wingN.extra});
  breathGeom(M,G).forEach(o=>push('breath',Object.assign({fx:1},o)));box.add(breathBox(M,G));
  return {layers:L.filter(l=>l.op!==0),box:{x:box.x0,y:box.y0,w:box.x1-box.x0,h:-box.y0+8},scale:M.scale,
    anchors:{hip:K.hip,sh:K.sh,head:K.N2,mouth:G.mouthTip,eye:G.eyeC,eyeR:G.eyeR,root,tail:S[0].p},
    rig:rigOf(M,K,LP,G,root)}}

/* точки для анимации (rig.js, anim.js): суставы, разрезы туловища, опоры лап. Единицы рисунка, земля y=0 */
function rigOf(M,K,LP,G,root){
  const S=K.S,cut=i=>({p:S[i].p,d:S[i].d,r:(S[i].rt+S[i].rb)/2,i});
  /* лапа: a место крепления, k колено, h скакательный сустав (у передней запястье), f кончик стопы,
     toe самая передняя точка на земле (конец когтя): вокруг неё стопа поднимает пятку, g уровень земли этой лапы,
     hr толщина лапы у сустава */
  const leg=(k,g)=>{const L=LP[k],a=L.ctrl[0],f=L.tip,tr=Math.max(1.6,L.r[5]*0.95);
    return {a,k:L.knee,h:L.hock,hr:L.r[3],f,toe:[f[0]+0.6+tr*2.1,g],g,len:Math.hypot(f[0]-a[0],f[1]-a[1])}};
  /* разрезы: хвост чуть позади бедра, шея у её основания (дальше от плеча, где она уже тонкая) */
  const tailCut=cut(K.idx.hip-2),neckCut=cut(K.idx.n0);
  let tl=0;for(let i=tailCut.i;i>0;i--)tl+=Math.hypot(S[i].p[0]-S[i-1].p[0],S[i].p[1]-S[i-1].p[1]);
  let nl=0;for(let i=neckCut.i;i<K.idx.n2;i++)nl+=Math.hypot(S[i+1].p[0]-S[i].p[0],S[i+1].p[1]-S[i].p[1]);
  let belly=-1e9;for(let i=K.idx.hip;i<=K.idx.sh;i++)belly=Math.max(belly,S[i].bot[1]);   /* нижняя точка живота */
  /* нижний край хвоста и головы: по ним анимация не даёт частям уйти под землю */
  const tailS=[];for(let i=0;i<=tailCut.i;i+=2)tailS.push([S[i].bot[0],S[i].bot[1]]);
  const h=M.head,low=[G.tf([G.cl*0.55,G.H*(0.28+0.32*h.jaw)]),G.tf([G.L*0.82,G.H*(0.12+0.14*h.taper)])];
  /* трубка вдоль позвоночника с запасом на обводку: риг отдаёт шее и хвосту только то, что внутри неё,
     а холка, грудь и круп за линией разреза остаются туловищу. Заходит за разрез на радиус, чтобы накрыть стык */
  const back=(i,dir)=>{let d=0,j=i,r=cut(i).r*1.1;while(d<r&&j-dir>=0&&j-dir<S.length){d+=Math.hypot(S[j].p[0]-S[j-dir].p[0],S[j].p[1]-S[j-dir].p[1]);j-=dir}return j};
  const tube=(i0,i1)=>{const T=[],B=[],o=(s,v)=>{const w=[v[0]-s.p[0],v[1]-s.p[1]],l=Math.hypot(w[0],w[1])||1;return [s.p[0]+w[0]*1.2+w[0]/l*1.5,s.p[1]+w[1]*1.2+w[1]/l*1.5]};
    const cap=(i,sg)=>{const s=S[i],r=Math.max(s.rt,s.rb)*1.2+3;return [s.p[0]+s.d[0]*r*sg,s.p[1]+s.d[1]*r*sg]};
    for(let i=i0;i<=i1;i++){T.push(o(S[i],S[i].top));B.push(o(S[i],S[i].bot))}
    return [cap(i0,-1)].concat(T,[cap(i1,1)],B.reverse())};
  const neckTube=tube(back(neckCut.i,1),S.length-1),tailTube=tube(0,back(tailCut.i,-1));
  return {hip:K.hip,sh:K.sh,mid:K.mid,head:K.N2,mouth:G.mouthTip,eye:G.eyeC,eyeR:G.eyeR,root,tailTip:S[0].p,
    tailCut,neckCut,neckTube,tailTube,tailLen:tl,neckLen:nl,headH:G.H,belly,tailS,headLow:low,lidTop:[G.eyeC[0],G.eyeC[1]-G.eyeR],
    legs:{FH:leg('hindF',-2.4),FF:leg('frontF',-2.4),NH:leg('hind',0),NF:leg('front',0)}}}

const SHAPE={build,curve,spline,tube};
if(typeof module!=='undefined'&&module.exports)module.exports=SHAPE;else root.SHAPE=SHAPE;
})(typeof window!=='undefined'?window:globalThis);
