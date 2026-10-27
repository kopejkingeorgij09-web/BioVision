/* Геометрия дракона по морфологии (MORPH.morph): скелет из опорных точек, тело-трубка вокруг позвоночника,
   лапы, крылья, голова, рога, гребень, хвост. На выходе список слоёв с контурами в синтаксисе SVG path,
   который понимают оба рендерера: art.js (SVG) и art-canvas.js (Canvas 2D через Path2D).
   Вид сбоку, морда вправо, земля y=0, вверх отрицательные y. Слой несёт часть тела (part) для подсветки в паспорте. */
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

/* рамка рисунка */
function Box(){this.x0=1e9;this.y0=1e9;this.x1=-1e9;this.y1=-1e9}
Box.prototype.add=function(pts){pts.forEach(p=>{if(p[0]<this.x0)this.x0=p[0];if(p[0]>this.x1)this.x1=p[0];if(p[1]<this.y0)this.y0=p[1];if(p[1]>this.y1)this.y1=p[1]});return pts};

/* ---------- формы деталей ---------- */
/* «линза» от a до b шириной w: лист, перо, лопасть */
function lens(a,b,w,bend){
  const d=sub(b,a),n=perpUp(nrm(d)),m=lerpP(a,b,0.45),bb=bend||0;
  const c1=add(add(m,mul(n,w)),mul(n,bb)),c2=add(sub(m,mul(n,w)),mul(n,bb));
  return `M${pt(a)}Q${pt(c1)} ${pt(b)}Q${pt(c2)} ${pt(a)}Z`}
function tri(a,b,c){return `M${pt(a)}L${pt(b)}L${pt(c)}Z`}

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
    return {ctrl:[attach,thigh,knee,hock,ball,tip],r:[Math.max(b.hipR*0.86,9*T),Math.max(b.hipR*0.62,7.4*T),5.8*T,4.2*T,3.9*T,2.5*T],hock,tip}}
  const elbow=[attach[0]-h*0.1,attach[1]+h*0.46],wrist=[elbow[0]+h*0.1,g-h*(0.1+0.06*dg)];
  const upper=lerpP(attach,elbow,0.45),paw=[wrist[0]+foot*0.35,g-2],tip=[wrist[0]+foot*0.8,g-0.8];
  return {ctrl:[attach,upper,elbow,wrist,paw,tip],r:[Math.max(b.chestR*0.5,8*T),Math.max(b.chestR*0.36,6.4*T),5.2*T,3.9*T,3.6*T,2.3*T],hock:wrist,tip}}
function legGeom(L,g,box){
  const S=tube(L.ctrl,L.r,L.r,4);
  const out=tubeOutline(S,0,1.2).map(p=>[p[0],Math.min(p[1],g)]);
  box.add(out);
  const t=L.tip,cl=[];
  [0,0.32,0.62].forEach((f,i)=>{const x=t[0]-f*L.r[3]*3.2+1.6,y=g;cl.push(`M${F(x-2.2)} ${F(y-2.6)}Q${F(x+2.6)} ${F(y-2.4)} ${F(x+3.6)} ${F(y+0.6)}L${F(x-1.6)} ${F(y)}Z`)});
  return {d:curve(out,true),claws:cl.join('')}}

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
  for(let i=1;i<n;i++)d+=edge(ends[i-1],ends[i]);
  d+=edge(ends[n-1],trL)+'Z';
  box.add([[0,0],E,Wr,...tips,trL].map(tf));
  const arm=`M${pt(tf([0,0]))}L${pt(tf(E))}L${pt(tf(Wr))}`;
  const fingers=tips.map(t=>`M${pt(tf(Wr))}L${pt(tf(t))}`).join('');
  let extra='',feathers='';
  if(ty.hook)extra=tips.map((t,i)=>{const dd=nrm(sub(t,Wr)),q=add(t,mul(rot(dd,70),3.4));return tri(tf(sub(t,mul(dd,3))),tf(add(t,mul(dd,2.6))),tf(q))}).join('');
  if(!ty.feathers&&w.type!=='fin'&&w.type!=='leaf'){const dd=nrm(sub(Wr,E));extra+=tri(tf(add(Wr,mul(rot(dd,-90),2))),tf(add(Wr,mul(dd,5.5))),tf(add(Wr,mul(rot(dd,90),2))))}
  if(ty.feathers){
    /* перья: длинные вдоль пальцев, короче между ними, второй ряд у руки */
    const fs=[];
    const fl=(a,b,w)=>fs.push(lens(tf(a),tf(b),w*(far?0.9:1)));
    for(let i=0;i<5;i++){const a=lerpP(E,Wr,i/4),b=add(a,mul(dirA(lerp(150,215,i/4)),S*0.38));fl(a,b,2.2+S*0.018)}
    for(let i=0;i<n;i++){const t=tips[i];fl(lerpP(Wr,t,0.18),t,2.6+S*0.025);
      if(i<n-1){const m=lerpP(tips[i],tips[i+1],0.5);fl(lerpP(Wr,m,0.15),lerpP(Wr,m,0.92),2.4+S*0.022)}}
    feathers=fs.join('')}
  let veins='';
  if(w.type==='leaf'){
    /* крыло-лист: несколько листовых лопастей от запястья, у каждой средняя жилка и боковые */
    const blades=[],vs=[];
    tips.concat([trL]).forEach((t,i)=>{const a=lerpP(Wr,i===n?E:Wr,0.5),b=i===n?lerpP(t,Wr,0.1):t,wd=len(sub(b,a))*(i===n?0.26:0.4);
      blades.push(lens(tf(a),tf(b),wd*(far?0.9:1)));vs.push(`M${pt(tf(a))}L${pt(tf(lerpP(a,b,0.92)))}`);
      for(let j=1;j<3;j++){const q=lerpP(a,b,j/3.4),nn=perpUp(nrm(sub(b,a))),r=wd*0.62;vs.push(`M${pt(tf(q))}L${pt(tf(add(lerpP(a,b,j/3.4+0.14),mul(nn,r))))}M${pt(tf(q))}L${pt(tf(add(lerpP(a,b,j/3.4+0.14),mul(nn,-r))))}`)}});
    d=blades.join('');veins=vs.join('')}
  return {d,arm,fingers,extra,feathers,veins}}

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
  const mouthA=[cl*0.58,H*0.07],mouthB=[L*0.95,H*0.08];
  const mouth=`M${pt(tf(mouthA))}Q${pt(tf([lerp(mouthA[0],mouthB[0],0.5),H*0.12]))} ${pt(tf(mouthB))}`;
  const nos=tf([L*0.88,-H*(0.05+0.13*h.taper)]);
  const nostril=`M${pt(add(nos,[-2.2,0]))}Q${pt(add(nos,[0,-1.6]))} ${pt(add(nos,[2.2,0]))}Q${pt(add(nos,[0,1]))} ${pt(add(nos,[-2.2,0]))}Z`;
  const eyeC=tf([cl*0.64,-H*0.17]),eyeR=H*0.12*M.eyes.size*(M.eyes.night?1.28:1);
  const brow=A>0.3||h.brow>0.5?`M${pt(tf([cl*0.36,-H*0.3]))}Q${pt(tf([cl*0.7,-H*(0.44+0.1*h.brow)]))} ${pt(tf([cl*0.98,-H*(0.36+0.1*h.brow)]))}`:'';
  let teeth='';
  if(A>0.8){[0.72,0.8,0.88].forEach(f=>{const x=lerp(cl*0.6,L*0.95,f);teeth+=tri(tf([x-1.6,H*0.09]),tf([x,H*0.09+3.2]),tf([x+1.6,H*0.09]))})}
  /* основание рогов и воротника в координатах головы */
  const hornBase=tf([cl*0.26,-H*(0.38+0.16*h.crown)]);
  return {d:curve(pts,true,sharp),mouth,nostril,eyeC,eyeR,brow,teeth,hornBase,tf,cl,L,H,
    mouthTip:tf([L*1.02,H*0.02]),neckBack:tf([-0.05*L,0])}}

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
  let rings='';
  if(st.rings)[0.25,0.45,0.65].forEach(f=>{const s=S[Math.round(f*(S.length-1))];rings+=`M${pt(s.top)}L${pt(s.bot)}`});
  return {d,rings}}

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
    return {d:ls.join(''),ribs:[120,148,176,204,232].map((a,i)=>`M${pt(add(base,[0,(i-2)*H*0.08]))}L${pt(at(a,H*(i%2?0.6:0.76)))}`).join(''),kind:'leaves'}}
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
  const parts=[];
  const hAt=i=>{const r=(S[i].rt+S[i].rb)/2;return hh0*Math.max(0.55,Math.min(1.15,r/16))};
  items.forEach((i,j)=>{const s=S[i],q=sub(s.top,mul(s.up,0.8)),u=s.up,back=mul(s.d,-1),hh=hAt(i)*(c.style==='plates'?(j%2?0.8:1.1):1);
    const tip=add(add(q,mul(u,hh)),mul(back,hh*0.35));box.add([tip]);
    switch(c.style){
      case 'spikes':parts.push(tri(add(q,mul(back,3.6)),tip,add(q,mul(s.d,3.6))));break;
      case 'plates':{const w=4.6*Math.min(1.3,hh/9);parts.push(poly([add(q,mul(back,w)),add(add(q,mul(u,hh*0.62)),mul(back,w*0.95)),add(add(q,mul(u,hh)),mul(back,w*0.15)),add(add(q,mul(u,hh*0.62)),mul(s.d,w*0.8)),add(q,mul(s.d,w))],true));break}
      case 'tufts':{const a=add(q,mul(s.d,2)),b=add(add(q,mul(u,hh)),mul(back,hh*0.7));parts.push(lens(a,b,2.2,-1.5));break}
      case 'leaves':{const b=add(add(q,mul(u,hh*1.05)),mul(back,hh*0.55));parts.push(lens(q,b,hh*0.28));break}
      case 'shards':{const b=add(add(q,mul(u,hh*1.3)),mul(back,hh*0.15));parts.push(poly([add(q,mul(back,2.2)),add(lerpP(q,b,0.62),mul(back,1.6)),b,add(lerpP(q,b,0.62),mul(s.d,1.6)),add(q,mul(s.d,2.2))],true));break}
      case 'hooks':{const b=add(add(q,mul(u,hh*0.9)),mul(back,hh*0.75)),c1=add(q,mul(u,hh*0.95));parts.push(`M${pt(add(q,mul(back,3.2)))}Q${pt(add(c1,mul(back,1)))} ${pt(b)}Q${pt(add(c1,mul(s.d,2.6)))} ${pt(add(q,mul(s.d,3.2)))}Z`);break}
      case 'ridge':parts.push(`M${pt(add(q,mul(back,3.2)))}Q${pt(add(q,mul(u,hh*1.1)))} ${pt(add(q,mul(s.d,3.2)))}Z`);break}});
  if(c.style==='fin'){
    /* сплошной плавник с рёбрами и волнистым краем */
    const top=[],base=[];
    items.forEach((i,j)=>{const s=S[i],hh=hAt(i)*(0.85+0.25*Math.sin(j*1.3));base.push(sub(s.top,mul(s.up,0.8)));top.push(add(add(s.top,mul(s.up,hh)),mul(s.d,-hh*0.3)))});
    if(top.length>1){box.add(top);return {d:curve(top.concat(base.slice().reverse()),true),ribs:base.map((b,i)=>`M${pt(b)}L${pt(top[i])}`).join(''),fin:1}}}
  return {d:parts.join(''),ribs:''}}

/* ---------- кончик хвоста ---------- */
function tailEndGeom(M,K,box){
  const s=K.S[0],out=mul(s.d,-1),tip=s.p,up=perpUp(out),k=Math.sqrt(M.body.tailL/90);
  if(M.mace){const r=6.2*M.mace.size*k*1.1,c=add(tip,mul(out,r*0.6)),sp=[];
    for(let i=0;i<7;i++){const a=rot(out,-90+i*30),b=add(c,mul(a,r*1.75));sp.push(tri(add(c,mul(rot(a,-90),r*0.32)),b,add(c,mul(rot(a,90),r*0.32))))}
    box.add([add(c,mul(out,r*1.8))]);
    return {part:'mace',ball:`M${pt(add(c,[r,0]))}A${F(r)} ${F(r)} 0 1 0 ${pt(add(c,[-r,0]))}A${F(r)} ${F(r)} 0 1 0 ${pt(add(c,[r,0]))}Z`,spikes:sp.join(''),c,r}}
  const L=(x,y)=>add(add(tip,mul(out,x*k)),mul(up,y*k));
  let d='',fx='';
  switch(M.tailEnd){
    case 'flame':d=curve([L(-2,3),L(6,7),L(10,13),L(13,5),L(20,9),L(17,0),L(24,-4),L(14,-5),L(9,-12),L(4,-4),L(-2,-3)],true);
      fx=curve([L(1,1.5),L(7,4),L(11,6),L(13,1),L(17,-1),L(9,-3),L(5,-5),L(1,-1.5)],true);break;
    case 'fluke':d=`M${pt(L(-3,2.6))}Q${pt(L(6,14))} ${pt(L(10,19))}Q${pt(L(9,6))} ${pt(L(5,0))}Q${pt(L(9,-6))} ${pt(L(10,-19))}Q${pt(L(6,-14))} ${pt(L(-3,-2.6))}Z`;break;
    case 'blunt':d=`M${pt(L(-2,4))}Q${pt(L(5,5))} ${pt(L(5,0))}Q${pt(L(5,-5))} ${pt(L(-2,-4))}Z`;fx=`M${pt(L(0,4))}L${pt(L(2,-4))}M${pt(L(3,3.6))}L${pt(L(4.2,-3))}`;break;
    case 'ribbons':d=[[10,1],[-8,.8],[2,1.2]].map(([y,w])=>{const S=tube([L(-1,0),L(10,y*0.6),L(20,y),L(30,y*0.5)],[w*1.4,w*1.6,w*1.2,0.3],[w*1.4,w*1.6,w*1.2,0.3],4);return curve(tubeOutline(S,0,1),true)}).join('');break;
    case 'leaf':d=lens(L(-2,0),L(26,4),7.5*k);fx=`M${pt(L(-1,0))}Q${pt(L(12,3))} ${pt(L(24,3.8))}`;break;
    case 'fan':d=[-36,-18,0,18,36].map(a=>lens(L(0,0),add(tip,mul(rot(out,a),22*k)),3.2*k)).join('');fx=[-36,-18,0,18,36].map(a=>`M${pt(tip)}L${pt(add(tip,mul(rot(out,a),19*k)))}`).join('');break;
    case 'blade':d=poly([L(-2,3),L(4,9),L(18,0),L(4,-9),L(-2,-3)],true);fx=`M${pt(L(0,0))}L${pt(L(15,0))}`;break;
    default:return null}
  box.add([L(24,0),L(10,19),L(10,-19)].slice(0,M.tailEnd==='fluke'?3:1));
  return {part:'tailEnd',d,fx}}

/* ---------- узор кожи (обрезается по телу) ---------- */
function skinGeom(M,K){
  const S=K.S,det=M.detail,st=M.skin,lines=[],fills=[],glow=[];
  if(det<=0)return {lines:'',fills:'',glow:'',op:0};
  const from=4,to=K.idx.n1,step=det>1.2?1:det>0.8?1:2;
  const q=(s,k)=>k>=0?add(s.p,mul(s.up,s.rt*k)):add(s.p,mul(s.up,s.rb*k));
  for(let i=from;i<to;i+=step){const s=S[i],t=s.d,u=s.up;
    switch(st){
      case 'lava':if(i%3===0&&i+3<to){const s2=S[i+3];[[0.9,0.38],[0.38,-0.12]].forEach(([k0,k1],j)=>{
          const c=[q(s,k0),q(s2,k0),q(s2,k1),q(s,k1)],cen=mul(c.reduce((a,b)=>add(a,b),[0,0]),0.25);
          /* базальтовая плита: углы скруглены, края чуть неровные */
          const pl=[c[0],lerpP(c[0],c[1],0.5),c[1],lerpP(c[1],c[2],0.5),c[2],lerpP(c[2],c[3],0.5),c[3],lerpP(c[3],c[0],0.5)].map((p,m)=>lerpP(cen,p,m%2?0.84+0.08*(((i/3|0)+j+m)%3===0):0.74));
          fills.push(curve(pl,true))});
          if((i/3|0)%2===0)glow.push(`M${pt(q(s,0.75))}L${pt(add(q(s,0.38),mul(t,1.2)))}L${pt(q(s,0.02))}`)}break;
      case 'ripple':case 'scales':[0.6,0.25,-0.1,-0.42].forEach((k,j)=>{if(st==='scales'&&j%2)return;const c=add(q(s,k),mul(t,(i+j)%2?1.6:-1.6));lines.push(`M${pt(add(c,mul(u,2.4)))}Q${pt(add(c,mul(t,-4)))} ${pt(sub(c,mul(u,2.4)))}`)});break;
      case 'plates':if(i%2===0){const c=q(s,0.5),r=Math.max(4,s.rt*0.36),hx=[];for(let a=0;a<6;a++)hx.push(add(c,add(mul(t,Math.cos(a*Math.PI/3)*r),mul(u,Math.sin(a*Math.PI/3)*r*0.8))));fills.push(poly(hx,true))}
        if(i%2===1){const c=q(s,-0.05),r=Math.max(3,s.rt*0.26),hx=[];for(let a=0;a<6;a++)hx.push(add(c,add(mul(t,Math.cos(a*Math.PI/3)*r),mul(u,Math.sin(a*Math.PI/3)*r*0.8))));fills.push(poly(hx,true))}break;
      case 'feather':[0.66,0.34,0.02].forEach(k=>{const c=q(s,k);lines.push(`M${pt(c)}Q${pt(add(add(c,mul(t,-3)),mul(u,1.8)))} ${pt(add(add(c,mul(t,-6)),mul(u,0.6)))}`)});break;
      case 'veins':if(i%3===0){const a=q(s,0.92),m=add(q(s,0.35),mul(t,-3)),b=add(q(s,-0.25),mul(t,-5));lines.push(`M${pt(a)}Q${pt(add(m,mul(t,2)))} ${pt(b)}M${pt(m)}L${pt(add(add(m,mul(t,-5)),mul(u,3)))}M${pt(lerpP(a,m,0.5))}L${pt(add(lerpP(a,m,0.5),mul(t,4)))}`)}
        if(i%4===2){const c=q(s,0.1);fills.push(`M${pt(add(c,[1.6,0]))}A1.6 1.6 0 1 0 ${pt(add(c,[-1.6,0]))}A1.6 1.6 0 1 0 ${pt(add(c,[1.6,0]))}Z`)}break;
      case 'shimmer':[0.55,0.15,-0.25].forEach((k,j)=>{if((i+j)%2)return;const c=q(s,k),w=1.8,h=2.6;fills.push(poly([add(c,mul(u,h)),add(c,mul(t,w)),sub(c,mul(u,h)),sub(c,mul(t,w))],true))});
        if(i%5===0){const c=q(s,0.4),r=2.8;glow.push(`M${pt(add(c,[0,-r]))}L${pt(add(c,[0,r]))}M${pt(add(c,[-r,0]))}L${pt(add(c,[r,0]))}`)}break;
      case 'bands':if(i%3===0){const a=q(s,0.98),b=q(s,0.08),w=Math.max(1.6,s.rt*0.14);fills.push(poly([add(a,mul(t,w)),add(a,mul(t,-w)),add(b,mul(t,-w*0.3)),add(b,mul(t,w*0.3))],true))}break}}
  return {lines:lines.join(''),fills:fills.join(''),glow:glow.join(''),op:0.3+0.45*Math.min(det,1)}}

/* ---------- брюхо и блеск ---------- */
function bellyGeom(K){
  const S=K.S,a=3,b=K.idx.n1+1,outer=[],inner=[],sc=[];
  for(let i=a;i<=b;i++){const s=S[i],k=i<K.idx.hip?0.42:0.5;outer.push(s.bot);inner.push(sub(s.p,mul(s.up,-s.rb*(1-k)*0.1+s.rb*k)));if(i%2===0)sc.push(`M${pt(s.bot)}L${pt(inner[inner.length-1])}`)}
  return {d:curve(outer.concat(inner.slice().reverse()),true),scutes:sc.join('')}}
function metalGeom(K){
  const S=K.S,pts=[],pts2=[];
  for(let i=6;i<=K.idx.n1;i++){const s=S[i];pts.push(add(s.p,mul(s.up,s.rt*0.55)));pts2.push(add(s.p,mul(s.up,s.rt*0.25)))}
  return {d:curve(pts,false),d2:curve(pts2,false)}}

/* ---------- дыхание у пасти ---------- */
function breathGeom(M,G){
  const p=G.mouthTip,tilt=M.head.tilt,at=(x,y)=>add(p,rot([x,y],tilt)),out=[];
  if(M.breath==='smoke')return [{paint:'smoke',d:[[6,-4,4.2],[11,-11,3.2],[9,-18,2.2]].map(([x,y,r])=>{const c=at(x,y);return `M${pt(add(c,[r,0]))}A${r} ${r} 0 1 0 ${pt(add(c,[-r,0]))}A${r} ${r} 0 1 0 ${pt(add(c,[r,0]))}Z`}).join(''),op:.4}];
  if(M.breath!=='element')return [];
  M.elements.forEach((e,j)=>{const o=j?[3,7]:[0,0],A=(x,y)=>at(x+o[0],y+o[1]);
    switch(e){
      case 'F':out.push({paint:'fireOuter',d:curve([A(0,0),A(7,-6),A(13,-2),A(12,-10),A(20,-2),A(15,7),A(4,5)],true)},{paint:'fireInner',d:curve([A(2,1),A(7,-2),A(11,1),A(10,-4),A(14,1),A(11,5),A(3,4)],true)});break;
      case 'W':out.push({paint:'water',d:[[6,-5],[12,1],[5,6]].map(([x,y])=>lens(A(x,y-3),A(x,y+3),2.2)).join('')});break;
      case 'T':out.push({paint:'earth',d:[[6,-2,2.6],[12,3,2],[5,6,1.6]].map(([x,y,r])=>{const c=A(x,y);return `M${pt(add(c,[r,0]))}L${pt(add(c,[0,-r]))}L${pt(add(c,[-r,0]))}L${pt(add(c,[0,r]))}Z`}).join('')});break;
      case 'A':out.push({paint:'air',stroke:1,d:`M${pt(A(2,-2))}Q${pt(A(9,-7))} ${pt(A(12,-1))}Q${pt(A(10,3))} ${pt(A(6,0))}M${pt(A(4,5))}Q${pt(A(10,3))} ${pt(A(15,7))}`});break;
      case 'P':out.push({paint:'flora',d:lens(A(2,0),A(16,-6),3)+lens(A(4,3),A(15,7),2.6)});break;
      case 'L':out.push({paint:'light',d:poly([A(9,-9),A(11,-2),A(18,0),A(11,2),A(9,9),A(7,2),A(0,0),A(7,-2)],true)});break;
      case 'D':out.push({paint:'dark',d:curve([A(1,0),A(7,-6),A(12,-1),A(16,-5),A(14,3),A(6,5)],true),op:.85});break}});
  return out}

/* ---------- сборка ---------- */
function build(M){
  const box=new Box(),b=M.body,L=[];
  const K=skeleton(M),S=K.S;
  const bodyPts=box.add(tubeOutline(S,2.4,0));
  const bodyD=curve(bodyPts,true,new Set([0]));
  const push=(part,o)=>{if(o&&o.d)L.push(Object.assign({part},o))};

  /* опоры крыла на спине */
  const near=(x)=>{let best=0,bd=1e9;for(let i=K.idx.hip;i<=K.idx.sh;i++){const dd=Math.abs(S[i].p[0]-x);if(dd<bd){bd=dd;best=i}}return S[best]};
  const S72=WS*M.wing.span;
  const rootS=near(K.sh[0]-b.len*0.2),root=sub(rootS.top,mul(rootS.up,2));
  const trailS=near(K.sh[0]-b.len*0.2-Math.min(0.55*S72*M.wing.chord,b.len*0.7)),trail=sub(trailS.top,mul(trailS.up,3));
  const wingF=wingGeom(M,root,trail,box,true),wingN=wingGeom(M,root,trail,box,false);

  /* лапы */
  const hindA=add(K.hip,[b.hipR*0.12,b.hipR*0.22]),frontA=add(K.sh,[-b.chestR*0.18,b.chestR*0.34]);
  const legs={hindF:legGeom(legPts('hind',add(hindA,[6,-2]),-2.4,b,M),-2.4,box),frontF:legGeom(legPts('front',add(frontA,[6,-2]),-2.4,b,M),-2.4,box),
    hind:legGeom(legPts('hind',hindA,0,b,M),0,box),front:legGeom(legPts('front',frontA,0,b,M),0,box)};
  let spurs='';
  if(M.spurs){const s=M.spurs.size;[legPts('hind',hindA,0,b,M),legPts('hind',add(hindA,[6,-2]),-2.4,b,M)].forEach(Lg=>{const h=Lg.hock;spurs+=tri(add(h,[1,-3.4]),add(h,[-13*s,0.6]),add(h,[1.4,3.2]))})}

  const G=headGeom(M,K.N2,box);

  /* слои сзади вперёд */
  if(M.aura){const c=lerpP(K.hip,K.sh,0.5);L.push({part:'aura',paint:'aura',d:`M${pt(add(c,[90,0]))}A90 70 0 1 0 ${pt(add(c,[-90,0]))}A90 70 0 1 0 ${pt(add(c,[90,0]))}Z`,fx:1})}
  {const c=(K.hip[0]+K.sh[0])/2,rx=(b.len+b.hipR+b.chestR)*0.78+8;L.push({part:'shadow',paint:'shadow',d:`M${F(c+rx)} 0A${F(rx)} 6 0 1 0 ${F(c-rx)} 0A${F(rx)} 6 0 1 0 ${F(c+rx)} 0Z`})}
  push('wings',{paint:'wingFar',stroke:'edge',d:wingF.d,far:1});
  push('wings',{paint:'boneFar',line:2.6,d:wingF.arm,far:1});
  push('wings',{paint:'boneFar',line:1.2,d:wingF.fingers,far:1});
  if(wingF.feathers)push('wings',{paint:'featherFar',stroke:'edge',sw:.7,d:wingF.feathers,far:1});
  push('legs',{paint:'legFar',stroke:'edge',d:legs.hindF.d});push('legs',{paint:'legFar',stroke:'edge',d:legs.frontF.d});
  push('legs',{paint:'claw',stroke:'edge',sw:.7,d:legs.hindF.claws+legs.frontF.claws});
  if(M.horns){const hf=hornGeom(M,G,true,box);push('horns',{paint:'hornFar',stroke:'edge',d:hf.d})}
  const col=M.collar?collarGeom(M,G,box):null;
  if(col){push('collar',{paint:col.kind==='leaves'?'leaf':'crest',stroke:'edge',d:col.d,op:col.kind==='fins'?0.92:1});push('collar',{paint:'rib',line:.9,d:col.ribs})}
  if(M.crest){const cr=crestGeom(M,K,box);push('crest',{paint:M.crest.style==='leaves'?'leaf':M.crest.style==='shards'?'crystal':'crest',stroke:'edge',d:cr.d,op:cr.fin?0.9:1});if(cr.ribs)push('crest',{paint:'rib',line:.9,d:cr.ribs})}
  const te=tailEndGeom(M,K,box);
  if(te&&te.part==='mace'){push('mace',{paint:'maceSpike',stroke:'edge',d:te.spikes});push('mace',{paint:'mace',stroke:'edge',d:te.ball,grad:'ball',c:te.c,r:te.r})}
  else if(te){push('tailEnd',{paint:({flame:'fireOuter',leaf:'leaf',fan:'feather'})[M.tailEnd]||'crest',stroke:'edge',d:te.d});
    if(te.fx)push('tailEnd',M.tailEnd==='flame'?{paint:'fireInner',d:te.fx}:{paint:'rib',line:.9,d:te.fx})}
  /* тело */
  push('body',{paint:'body',stroke:'edge',d:bodyD,grad:'body',clipId:'body'});
  const bel=bellyGeom(K);push('body',{paint:'belly',d:bel.d,clip:'body'});push('body',{paint:'scute',line:1,d:bel.scutes,clip:'body'});
  const sk=skinGeom(M,K);
  if(sk.fills)push('skin',{paint:'texFill',d:sk.fills,clip:'body',op:sk.op});
  if(sk.lines)push('skin',{paint:'texLine',line:1,d:sk.lines,clip:'body',op:sk.op});
  if(sk.glow)push('skin',{paint:M.skin==='lava'?'lava':'sparkle',line:M.skin==='lava'?1.5:1,d:sk.glow,clip:'body',op:Math.min(1,sk.op+0.3),glow:1});
  push('body',{paint:'shade',d:bodyD,grad:'shade'});
  {const rim=[];for(let i=3;i<=K.idx.n2;i++){const q=S[i];rim.push(sub(q.top,mul(q.up,Math.min(2.2,q.rt*0.18))))}push('body',{paint:'rim',line:1.8,d:curve(rim,false),clip:'body',op:.55})}
  if(M.metal){const mg=metalGeom(K);push('metal',{paint:'metal',line:4.2,d:mg.d,clip:'body',op:.55});push('metal',{paint:'metal',line:1.6,d:mg.d2,clip:'body',op:.4})}
  /* ближние лапы */
  push('legs',{paint:'body',stroke:'edge',d:legs.hind.d,grad:'body'});push('legs',{paint:'shade',d:legs.hind.d,grad:'shade'});
  push('legs',{paint:'body',stroke:'edge',d:legs.front.d,grad:'body'});push('legs',{paint:'shade',d:legs.front.d,grad:'shade'});
  push('legs',{paint:'claw',stroke:'edge',sw:.7,d:legs.hind.claws+legs.front.claws});
  if(spurs)push('spurs',{paint:'claw',stroke:'edge',sw:.9,d:spurs});
  /* голова */
  push('head',{paint:'body',stroke:'edge',d:G.d,grad:'body',clipId:'head'});
  push('head',{paint:'shade',d:G.d,grad:'shade'});
  if(M.metal)push('metal',{paint:'metal',line:2.4,d:`M${pt(G.tf([G.cl*0.1,-G.H*0.3]))}Q${pt(G.tf([G.cl*0.7,-G.H*0.46]))} ${pt(G.tf([G.L*0.9,-G.H*0.2]))}`,clip:'head',op:.5});
  push('head',{paint:'edgeLine',line:1.3,d:G.mouth});
  push('head',{paint:'edgeFill',d:G.nostril});
  if(G.teeth)push('head',{paint:'tooth',stroke:'edge',sw:.5,d:G.teeth});
  if(G.brow)push('head',{paint:'browLine',line:2.6,d:G.brow,op:.55});
  const e=G.eyeC,r=G.eyeR;
  const circ=(c,rr)=>`M${pt(add(c,[rr,0]))}A${F(rr)} ${F(rr)} 0 1 0 ${pt(add(c,[-rr,0]))}A${F(rr)} ${F(rr)} 0 1 0 ${pt(add(c,[rr,0]))}Z`;
  if(M.eyes.glow)push('eyes',{paint:'glow',grad:'glow',d:circ(e,r*2.6),fx:1});
  push('eyes',{paint:'eyeWhite',stroke:'edge',sw:1.1,d:circ(e,r)});
  push('eyes',{paint:'iris',d:circ(add(e,[0.6,0]),r*0.72)});
  push('eyes',{paint:'pupil',d:M.eyes.night?circ(add(e,[0.6,0]),r*0.46):`M${pt(add(e,[0.6,-r*0.6]))}Q${pt(add(e,[1.9,0]))} ${pt(add(e,[0.6,r*0.6]))}Q${pt(add(e,[-0.7,0]))} ${pt(add(e,[0.6,-r*0.6]))}Z`});
  if(M.eyes.night)push('eyes',{paint:'tapetum',d:circ(add(e,[1.6,-0.8]),r*0.2),op:.9});
  push('eyes',{paint:'white',d:circ(add(e,[-r*0.3,-r*0.35]),Math.max(0.9,r*0.22))});
  if(M.breath==='dormant')push('eyes',{paint:'body',stroke:'edge',sw:1.1,d:`M${pt(add(e,[-r-0.6,0.4]))}A${F(r+0.6)} ${F(r+0.6)} 0 0 1 ${pt(add(e,[r+0.6,0.4]))}Z`});
  if(M.horns){const hn=hornGeom(M,G,false,box);push('horns',{paint:'horn',stroke:'edge',d:hn.d,grad:'horn'});if(hn.rings)push('horns',{paint:'rib',line:.9,d:hn.rings})}
  /* ближнее крыло */
  push('wings',{paint:'wing',stroke:'edge',d:wingN.d,grad:'wing'});
  if(wingN.veins)push('wings',{paint:'rib',line:1.1,d:wingN.veins});
  push('wings',{paint:'bone',line:3,d:wingN.arm});
  push('wings',{paint:'bone',line:M.wing.type==='fin'?0.9:1.5,d:wingN.fingers});
  if(wingN.feathers)push('wings',{paint:'feather',stroke:'edge',sw:.7,d:wingN.feathers});
  if(wingN.extra)push('wings',{paint:'claw',stroke:'edge',sw:.7,d:wingN.extra});
  breathGeom(M,G).forEach(o=>push('breath',Object.assign({fx:1},o)));
  return {layers:L,box:{x:box.x0,y:box.y0,w:box.x1-box.x0,h:-box.y0+8},scale:M.scale,
    anchors:{hip:K.hip,sh:K.sh,head:K.N2,mouth:G.mouthTip,eye:G.eyeC,eyeR:G.eyeR,root,tail:S[0].p}}}

const SHAPE={build,curve,spline,tube};
if(typeof module!=='undefined'&&module.exports)module.exports=SHAPE;else root.SHAPE=SHAPE;
})(typeof window!=='undefined'?window:globalThis);
