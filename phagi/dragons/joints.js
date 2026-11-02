/* Стенд соединений рига: ищет кадры, где через стык шеи с туловищем или лапы с туловищем виден фон.
   Для каждого дракона, возраста и действия анимация идёт с шагом 1/15 с (и резкие смены действий посреди движения),
   кадр рисуется на прозрачный холст, и вокруг стыка считаются «щели»: прозрачные пиксели, которые закрываются
   морфологическим замыканием маски (расширить и сузить на радиус около четверти толщины шеи), и дырки, со всех сторон
   окружённые драконом. Худшие кадры показываются крупно на ярком фоне, итог лежит в window.__joints.
   Геометрический счёт не заменяет взгляд: крупные планы для того и выводятся. */
(function(){
'use strict';
const D=window.DRG,MO=window.MORPH,SH=window.SHAPE,AN=window.ANIM,RIG=window.RIG;
const BASE={sex:'F',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m',N:'N',Sp:'Sp',G:'g'};
const WHO=[['F','Огонь',{E:'F/F',H:'H/H',R:'R1/R1'}],['W','Вода',{E:'W/W'}],['T','Земля',{E:'T/T',K:'K/k'}],['A','Воздух',{E:'A/A'}],
  ['P','Флора',{E:'P/P'}],['L','Свет',{E:'L/L'}],['D','Тьма',{E:'D/D'}],['FW','Огонь + Вода',{E:'F/W'}],['TA','Земля + Воздух',{E:'T/A'}],
  ['e','Дымный',{E:'e/e'}],['s','Дремлющий',{E:'F/F',S:'s/s'}]];
const AGES=[2,6,12,18];
const ACTS=['idle','walk','happy','eat','sleep','fly','attack','hit','victory','defeat'];
const DT=1/15,PX=1.6;
const $=id=>document.getElementById(id);
const q=new URLSearchParams(location.search);

/* замыкание маски: расширить на r, потом сузить на r (квадратное окно, раздельно по осям) */
function close(m,w,h,r){
  const dil=(src,on)=>{const a=new Uint8Array(w*h),b=new Uint8Array(w*h);
    for(let y=0;y<h;y++){let run=-1e9;for(let x=0;x<w;x++){if(src[y*w+x]===on)run=x;a[y*w+x]=x-run<=r?on:1-on}
      run=1e9;for(let x=w-1;x>=0;x--){if(src[y*w+x]===on)run=x;if(run-x<=r)a[y*w+x]=on}}
    for(let x=0;x<w;x++){let run=-1e9;for(let y=0;y<h;y++){if(a[y*w+x]===on)run=y;b[y*w+x]=y-run<=r?on:1-on}
      run=1e9;for(let y=h-1;y>=0;y--){if(a[y*w+x]===on)run=y;if(run-y<=r)b[y*w+x]=on}}
    return b};
  return dil(dil(m,1),0)}
/* щели и дырки в круге радиуса R около точки c (пиксели холста) */
function gaps(ctx,c,R,r){
  const x0=Math.max(0,Math.floor(c[0]-R)),y0=Math.max(0,Math.floor(c[1]-R)),w=Math.min(ctx.canvas.width-x0,Math.ceil(2*R)),h=Math.min(ctx.canvas.height-y0,Math.ceil(2*R));
  if(w<4||h<4)return {crack:0,hole:0};
  const d=ctx.getImageData(x0,y0,w,h).data,m=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)m[i]=d[i*4+3]>200?1:0;
  const cl=close(m,w,h,r);let crack=0,hole=0;
  const inR=(x,y)=>{const dx=x0+x-c[0],dy=y0+y-c[1];return dx*dx+dy*dy<=R*R*0.8};
  /* дырки: прозрачное, до которого не дойти от края окна */
  const seen=new Uint8Array(w*h),st=[];
  for(let x=0;x<w;x++){st.push(x,(h-1)*w+x)}for(let y=0;y<h;y++){st.push(y*w,y*w+w-1)}
  while(st.length){const i=st.pop();if(seen[i]||m[i])continue;seen[i]=1;const x=i%w,y=(i/w)|0;
    if(x>0)st.push(i-1);if(x<w-1)st.push(i+1);if(y>0)st.push(i-w);if(y<h-1)st.push(i+w)}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(m[i]||!inR(x,y))continue;if(cl[i])crack++;if(!seen[i])hole++}
  return {crack,hole,box:[x0,y0,w,h]}}

/* просвет в самом стыке: прозрачные пиксели в полосе вдоль разреза (±0,35 толщины шеи вдоль оси) и внутри тела
   (±0,85 толщины поперёк). Складка на внешнем контуре (подбородок к груди, холка) сюда почти не попадает,
   а трещина через шею попадает целиком */
function band(ctx,c,d,nr){
  const R=Math.ceil(nr*1.2),x0=Math.max(0,Math.floor(c[0]-R)),y0=Math.max(0,Math.floor(c[1]-R)),w=Math.min(ctx.canvas.width-x0,2*R),h=Math.min(ctx.canvas.height-y0,2*R);
  if(w<4||h<4)return {n:0,box:null};
  const D=ctx.getImageData(x0,y0,w,h).data,l=Math.hypot(d[0],d[1])||1,a=[d[0]/l,d[1]/l];let n=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const px=x0+x-c[0],py=y0+y-c[1],u=px*a[0]+py*a[1],v=-px*a[1]+py*a[0];
    if(Math.abs(u)<nr*0.35&&Math.abs(v)<nr*0.85&&D[(y*w+x)*4+3]<200)n++}
  return {n,box:[x0,y0,w,h]}}

/* прозрачные пиксели в круге радиуса r около точки c */
function disk(ctx,c,r){
  const R=Math.ceil(r),x0=Math.max(0,Math.floor(c[0]-R)),y0=Math.max(0,Math.floor(c[1]-R)),w=Math.min(ctx.canvas.width-x0,2*R+1),h=Math.min(ctx.canvas.height-y0,2*R+1);
  if(w<2||h<2)return {n:0,box:null};
  const D=ctx.getImageData(x0,y0,w,h).data;let n=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x0+x-c[0],dy=y0+y-c[1];if(dx*dx+dy*dy<=r*r&&D[(y*w+x)*4+3]<200)n++}
  const B=Math.ceil(r*3);return {n,box:[Math.max(0,Math.floor(c[0]-B)),Math.max(0,Math.floor(c[1]-B)),2*B,2*B]}}

const mk=sp=>D.make(Object.assign({},BASE,sp));
async function runOne(who,lvl,out,keep){
  const [k,name,sp]=who,ph=D.phenotype(mk(sp)),M=MO.morph(ph,lvl),G=SH.build(M);
  const X=await RIG.get(ph,lvl,{px:PX,dpr:1});
  const W=Math.ceil(G.box.w*G.scale*PX+160),H=Math.ceil((-G.box.y*G.scale+40)*PX+200);
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d',{willReadFrequently:true});
  const R=G.rig,z=X.s*PX,nr=R.neckCut.r*z;
  const seq=[];ACTS.forEach(a=>seq.push([a,a==='walk'||a==='idle'||a==='sleep'||a==='fly'?2.5:(AN.STATES[a].d||2)+0.3]));
  /* резкие смены посреди движения */
  seq.push(['attack',0.3],['sleep',0.4],['eat',0.5],['hit',0.2],['walk',0.6],['victory',0.4],['defeat',0.9],['happy',0.5],['fly',0.7],['eat',1.2]);
  /* щели ищем на силуэте без шипов и крыльев: туловище, шея с головой, хвост (и отдельно с лапами). Голова нужна:
     без неё конец шеи — обрубок, и его края считаются щелью, хотя в рисунке их всегда закрывает голова.
     Счёт в покое — нулевой уровень */
  const only=names=>Object.assign({},X,{order:X.order.filter(p=>names.includes(p.name))});
  const XS=only(['trunk','neck','tail','head','headBack','lid']),XL=only(['trunk','tail','neck','FHu','FFu','NHu','NFu','FHk','FFk','NHk','NFk','FHf','FFf','NHf','NFf']);
  const measure=(A,view)=>{const B=A.pose.body,pt=p=>AN.MAT.app(view,AN.MAT.app(B,p));
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);RIG.draw(c,XS,A.pose,view);
    const nc=pt(R.neckCut.p),nd=AN.MAT.app(view,AN.MAT.app(B,[R.neckCut.p[0]+R.neckCut.d[0],R.neckCut.p[1]+R.neckCut.d[1]])),bd=band(c,nc,[nd[0]-nc[0],nd[1]-nc[1]],nr);
    const nk=Object.assign(gaps(c,nc,nr*1.7,Math.max(2,Math.round(nr*0.2))),{band:bd.n});
    c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);RIG.draw(c,XL,A.pose,view);
    /* у лап просвет ищем в самих суставах: круг 0,6 толщины у колена (по бедру) и у скакательного сустава (по голени) */
    const lg={};AN.LEGS.forEach(L=>{const g=A.P.legs[L],mt=A.pose.mat,kn=AN.MAT.app(view,AN.MAT.app(mt[L+'u'],R.legs[L].k)),hk=AN.MAT.app(view,AN.MAT.app(mt[L+'k']||mt[L+'u'],g.h));
      const a=disk(c,kn,(R.legs[L].kr||R.legs[L].hr*1.3)*z*0.6),b=disk(c,hk,R.legs[L].hr*z*0.6);lg[L]={crack:a.n+b.n,hole:0,box:a.n>=b.n?a.box:b.box}});
    return {nk,lg}};
  const A0=new AN.Animator(M,R,{seed:3,reduce:true});
  const v0=RIG.VIEW(X,{px:PX,dpr:1,x0:W/2,gy:H-60,camX:G.box.x+G.box.w/2}),b0=measure(A0,v0);
  const base={neck:b0.nk.band,crease:b0.nk.crack+b0.nk.hole*2},bl={};AN.LEGS.forEach(L=>bl[L]=b0.lg[L].crack+b0.lg[L].hole*2);
  const A=new AN.Animator(M,R,{seed:3});let worst={neck:0,legs:0,crease:0},frames=0;
  for(const [act,dur] of seq){A.play(act);
    for(let t=0;t<dur;t+=DT){A.update(DT);frames++;
      const camX=A.x+G.box.x+G.box.w/2,view=RIG.VIEW(X,{px:PX,dpr:1,x0:W/2,gy:H-60,camX});
      const m=measure(A,view),neck=m.nk;let legs=null,legAt=null,sL=0;
      AN.LEGS.forEach(L=>{const r=m.lg[L],v=Math.max(0,r.crack+r.hole*2-bl[L]);if(!legs||v>sL){legs=r;legAt=L;sL=v}});
      const sN=Math.max(0,neck.band-base.neck),sC=Math.max(0,neck.crack+neck.hole*2-base.crease);worst.crease=Math.max(worst.crease,sC);
      if(keep&&(sN>keep||sL>keep)){c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);RIG.draw(c,X,A.pose,view)}
      worst.neck=Math.max(worst.neck,sN);worst.legs=Math.max(worst.legs,sL);
      if(keep&&(sN>keep||sL>keep))out.push({who:name,lvl,act,t:+t.toFixed(2),neck:sN,legs:sL,legAt:sL>keep?legAt:'',url:snap(cv,sN>=sL?neck.box:legs.box)})}}
  RIG.release(X);
  return {who:name,k,lvl,frames,worst}}
function snap(cv,box){if(!box)return '';const [x,y,w,h]=box,s=document.createElement('canvas'),k=Math.max(1,Math.round(160/Math.max(w,h)));
  s.width=w*k;s.height=h*k;const c=s.getContext('2d');c.fillStyle='#FF00C8';c.fillRect(0,0,s.width,s.height);c.imageSmoothingEnabled=false;c.drawImage(cv,x,y,w,h,0,0,w*k,h*k);return s.toDataURL()}

async function run(){
  const who=q.get('who')?WHO.filter(w=>q.get('who').split(',').includes(w[0])):WHO,ages=q.get('lvl')?q.get('lvl').split(',').map(Number):AGES;
  const keep=Number(q.get('keep')||6),out=[],sum=[];const t0=performance.now();
  for(const w of who)for(const l of ages){sum.push(await runOne(w,l,out,keep));$('st').textContent=`проверено ${sum.length} из ${who.length*ages.length}`}
  out.sort((a,b)=>Math.max(b.neck,b.legs)-Math.max(a.neck,a.legs));
  window.__joints={ms:Math.round(performance.now()-t0),frames:sum.reduce((a,s)=>a+s.frames,0),sum,bad:out.length,top:out.slice(0,40).map(o=>Object.assign({},o,{url:undefined}))};
  $('st').textContent=`Кадров ${window.__joints.frames}, с щелью больше ${keep} пикселей: ${out.length}. ${window.__joints.ms} мс`;
  $('sum').innerHTML='<tr><th>Дракон</th><th>Уровень</th><th>Шея: просвет в стыке</th><th>Шея: складка контура</th><th>Лапы: просвет в суставах</th></tr>'+sum.map(s=>`<tr><td>${s.who}</td><td>${s.lvl}</td><td class="${s.worst.neck>keep?'bad':''}">${s.worst.neck}</td><td>${s.worst.crease}</td><td class="${s.worst.legs>keep?'bad':''}">${s.worst.legs}</td></tr>`).join('');
  $('bad').innerHTML=out.slice(0,40).map(o=>`<figure><img src="${o.url}" alt=""><figcaption>${o.who}, ${o.lvl}-й, ${o.act} ${o.t} с: шея ${o.neck}, лапы ${o.legs}${o.legAt?' ('+o.legAt+')':''}</figcaption></figure>`).join('')||'<p>Щелей не найдено.</p>'}
/* один кадр крупно: ?one=T,12,hit,0.2[,4] — слева весь дракон, справа только туловище, шея, хвост и лапы */
async function one(){
  const [k,lv,act,tt,px]=q.get('one').split(','),who=WHO.find(w=>w[0]===k),lvl=+lv,PXo=+(px||4);
  const ph=D.phenotype(mk(who[2])),M=MO.morph(ph,lvl),G=SH.build(M),X=await RIG.get(ph,lvl,{px:PXo,dpr:1}),R=G.rig;
  const A=new AN.Animator(M,R,{seed:3});
  const seq=[];ACTS.forEach(a=>seq.push([a,a==='walk'||a==='idle'||a==='sleep'||a==='fly'?2.5:(AN.STATES[a].d||2)+0.3]));
  outer:for(const [a,d] of seq){A.play(a);for(let t=0;t<d;t+=DT){A.update(DT);if(a===act&&Math.abs(t-tt)<DT/2)break outer}}
  const z=X.s*PXo,nc=AN.MAT.app(A.pose.body,R.neckCut.p),S=Math.round(R.neckCut.r*z*5);
  const cv=document.createElement('canvas');cv.width=S*2+10;cv.height=S;const c=cv.getContext('2d');
  [[X.order,0],[X.order.filter(p=>(q.get('parts')?q.get('parts').split('.'):['trunk','neck','tail','FHu','FFu','NHu','NFu','FHk','FFk','NHk','NFk','FHf','FFf','NHf','NFf']).includes(p.name)),S+10]].forEach(([ord,ox])=>{
    c.setTransform(1,0,0,1,0,0);c.fillStyle='#FF00C8';c.fillRect(ox,0,S,S);c.save();c.beginPath();c.rect(ox,0,S,S);c.clip();
    const view=[z,0,0,z,ox+S/2-z*nc[0],S/2-z*nc[1]];RIG.draw(c,Object.assign({},X,{order:ord}),A.pose,view);c.restore()});
  if(q.get('art')){
    /* третья картинка: сам рисунок A без рига (те же слои туловища и шеи), чтобы отличить дефект рига от рисунка */
    const fr=window.ART.frameOf(G,{pad:10}),s=G.scale,u=z/s,ncr=R.neckCut.p;
    const str=window.ART.svg(M,{geom:G,frame:fr.vb,width:Math.ceil(fr.vb[2]*u),key:'plain',only:l=>['body','skin','crest','metal'].includes(l.part)&&l.clip!=='head'&&!l.seg});
    const img=await window.SPR.load(str),c3=document.createElement('canvas');c3.width=S;c3.height=S;const g=c3.getContext('2d');
    g.fillStyle='#FF00C8';g.fillRect(0,0,S,S);
    g.drawImage(img,S/2+u*(fr.vb[0]-fr.tx)-z*ncr[0],S/2+u*fr.vb[1]-z*ncr[1],fr.vb[2]*u,fr.vb[3]*u);
    const all=document.createElement('canvas');all.width=cv.width+S+10;all.height=S;const ga=all.getContext('2d');ga.drawImage(cv,0,0);ga.drawImage(c3,cv.width+10,0);
    document.body.innerHTML='';document.body.appendChild(all);window.__joints={one:true};return}
  document.body.innerHTML='';document.body.appendChild(cv);window.__joints={one:true}}
(q.get('one')?one():run()).catch(e=>{$('st').textContent='Ошибка: '+e.message;window.__joints={error:e.message}});
})();
