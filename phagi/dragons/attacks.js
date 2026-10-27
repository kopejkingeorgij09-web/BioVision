/* Атаки стихий: семь разных атак по фазам — подготовка, заряд, выпуск, полёт снаряда, попадание, реакция, восстановление.
   Модуль только рисует и отдаёт события: урон считает бой (battle.js), а сюда приходит лишь «откуда, куда, какой стихией».
   Событие impact приходит ровно один раз за атаку, даже если кадр длинный и перескакивает через несколько фаз.
   Частицы в единицах сцены (те же, что у рисунка дракона, земля y = 0, ось y вниз), их не больше MAXP на атаку,
   при «меньше движения» вчетверо меньше, без тряски и вспышек. Внешний вид атак — художественная условность игры. */
(function(root){
'use strict';
const TAU=Math.PI*2;
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,sm=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const MAXP=140,MAXP_R=32;

/* фазы (секунды). prep+charge = 0,55 с: в этот момент в анимации attack пасть открыта шире всего (anim.js, hit 0,55).
   kind: shot — снаряд по дуге, jet — струя, beam — луч, ground — по земле, gust — порыв */
const ATTACKS={
  F:{name:'Огненный шар',kind:'shot',col:['#FFF4B0','#FFC23A','#FF7A1F','#C8341C'],prep:0.2,charge:0.35,speed:5.2,arc:0.12,hit:0.12,react:0.4,recover:0.45},
  W:{name:'Водяная струя',kind:'jet',col:['#FFFFFF','#BFE6FF','#5DB2F2','#1F6FC4'],prep:0.2,charge:0.35,speed:4.2,arc:0.22,hit:0.14,react:0.45,recover:0.45},
  T:{name:'Валун',kind:'ground',col:['#E9D6B0','#B08A5C','#7A5A38','#4E3A26'],prep:0.2,charge:0.35,speed:3.4,arc:0.45,hit:0.14,react:0.5,recover:0.5},
  A:{name:'Воздушные серпы',kind:'gust',col:['#FFFFFF','#E4F4FF','#A9D8F5','#6FA8CF'],prep:0.2,charge:0.35,speed:6,arc:0.05,hit:0.12,react:0.4,recover:0.4},
  P:{name:'Колючая лоза',kind:'vine',col:['#E8FFB8','#8ED65A','#4E9A3A','#2E6A2A'],prep:0.2,charge:0.35,speed:3.6,arc:0,hit:0.16,react:0.5,recover:0.5},
  L:{name:'Луч света',kind:'beam',col:['#FFFFFF','#FFF7C8','#FFE27A','#F2B23A'],prep:0.2,charge:0.35,speed:40,arc:0,hit:0.1,react:0.4,recover:0.45},
  D:{name:'Сгусток тени',kind:'orb',col:['#E6D4FF','#A77BEA','#5B3F8C','#1E1430'],prep:0.2,charge:0.35,speed:3.8,arc:0.08,hit:0.14,react:0.45,recover:0.45}};
const ORDER=['F','W','T','A','P','L','D'];

/* расписание фаз для дистанции dist (единицы сцены) и размера дракона h (высота бедра) */
function timeline(el,dist,h,reduce){
  const a=ATTACKS[el]||ATTACKS.F,k=reduce?0.6:1;
  const fly=clamp(dist/(a.speed*Math.max(10,h)),a.kind==='beam'?0.06:0.16,0.7)*(reduce?0.8:1);
  const ph=[['prep',a.prep*k],['charge',a.charge*k],['main',0.06],['travel',fly],['hit',a.hit],['react',a.react*k],['recover',a.recover*k]];
  let t=0;const out=ph.map(([name,d])=>{const o={name,t0:t,t1:t+d};t+=d;return o});
  const at=n=>out.find(p=>p.name===n);
  return {phases:out,launch:at('main').t0,impact:at('hit').t0,total:t}}

/* генератор случайных чисел с зерном: одинаковое зерно — одинаковая атака (для стенда и тестов) */
function rng(seed){let s=(seed>>>0)||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296}}

/* точка на дуге снаряда: от a к b, вершина выше прямой на arc·длину */
function arcAt(a,b,arc,t){const x=lerp(a[0],b[0],t),y=lerp(a[1],b[1],t)-4*arc*Math.hypot(b[0]-a[0],b[1]-a[1])*t*(1-t);return [x,y]}

/* одна атака. o: el, from() → пасть атакующего, to() → точка попадания (грудь цели), ground — высота земли (0),
   h — высота бедра атакующего, reduce, seed, maxP. Каждый кадр update(dt) → события, draw(ctx) в матрице сцены */
function Run(o){
  this.el=ATTACKS[o.el]?o.el:'F';this.a=ATTACKS[this.el];this.from=o.from;this.to=o.to;this.h=o.h||24;this.gy=o.ground||0;
  this.reduce=!!o.reduce;this.rnd=rng(o.seed||7);this.maxP=o.maxP||(this.reduce?MAXP_R:MAXP);
  const A=this.from(),B=this.to();this.tl=timeline(this.el,Math.hypot(B[0]-A[0],B[1]-A[1]),this.h,this.reduce);
  this.t=0;this.p=[];this.fired=false;this.done=false;this.phase=null;this.shake=0;this.flash=0;this.start=A;this.end=B;this.spawned=0}
Run.prototype.phaseAt=function(t){const ps=this.tl.phases;for(const p of ps)if(t<p.t1)return p.name;return 'end'};
Run.prototype.push=function(q){if(this.p.length>=this.maxP)return;this.spawned++;this.p.push(Object.assign({age:0,vx:0,vy:0,g:0,r:1,life:0.5,c:0,k:'dot'},q))};
Run.prototype.update=function(dt){
  dt=clamp(dt||0,0,0.25);const ev=[];if(this.done)return ev;
  const t0=this.t,t1=this.t+dt,tl=this.tl;this.t=t1;
  /* пасть и цель двигаются вместе с позами драконов: берём их каждый кадр до выпуска; после выпуска снаряд летит в точку цели */
  if(t1<tl.launch){this.start=this.from();if(this.a.kind==='ground')this.start=[this.start[0]+this.h*0.15,this.gy-this.h*0.25]}
  if(t1<tl.impact)this.end=this.to();
  tl.phases.forEach(p=>{if(t0<=p.t0&&t1>p.t0||(t0===0&&p.t0===0&&!this.phase))ev.push({type:'phase',name:p.name})});
  this.phase=this.phaseAt(t1);
  if(t0<tl.launch&&t1>=tl.launch)ev.push({type:'launch',el:this.el});
  if(!this.fired&&t1>=tl.impact){this.fired=true;ev.push({type:'impact',el:this.el,at:this.end.slice()});this.burst()}
  this.emit(t0,t1,dt);
  this.p=this.p.filter(q=>{q.age+=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=q.g*dt;if(q.drag){q.vx*=Math.exp(-q.drag*dt);q.vy*=Math.exp(-q.drag*dt)}
    if(q.floor&&q.y>this.gy){q.y=this.gy;q.vy*=-0.3;q.vx*=0.6}return q.age<q.life});
  this.shake=this.reduce?0:Math.max(0,this.shake-dt*3);this.flash=Math.max(0,this.flash-dt*4);
  if(t1>=tl.total&&!this.p.length){this.done=true;ev.push({type:'end',el:this.el})}
  return ev};

/* частицы по фазам: в заряде собираются к пасти, в полёте сыплются следом, при попадании разлетаются */
Run.prototype.emit=function(t0,t1,dt){
  const tl=this.tl,a=this.a,h=this.h,R=this.rnd,red=this.reduce,k=red?0.25:1,M=this.start;
  const ph=this.phase,every=(n)=>{const c=Math.floor(t1*n)-Math.floor(t0*n);return c*k>=1?Math.round(c*k):(R()<c*k?1:0)};
  if(ph==='charge'){
    const n=every(this.el==='L'?40:30);
    for(let i=0;i<n;i++){const ang=R()*TAU,d=h*(0.5+R()*0.5),life=0.3+R()*0.15;
      const x=M[0]+Math.cos(ang)*d,y=M[1]+Math.sin(ang)*d*0.7;
      if(this.el==='T'){const gx=M[0]-h*0.6+R()*h*1.2;this.push({k:'rock',x:gx,y:this.gy,vx:0,vy:-h*(1+R()),g:h*3,r:h*(0.04+R()*0.05),life:0.45,c:1+Math.floor(R()*3),spin:(R()-0.5)*8,a0:R()*TAU});continue}
      if(this.el==='P'){this.push({k:'leaf',x,y,vx:(M[0]-x)/life,vy:(M[1]-y)/life,r:h*0.07,life,c:1+Math.floor(R()*2),spin:(R()-0.5)*10,a0:R()*TAU});continue}
      this.push({k:this.el==='A'?'streak':this.el==='D'?'smoke':'dot',x,y,vx:(M[0]-x)/life,vy:(M[1]-y)/life,r:h*(this.el==='D'?0.1:0.04),life,c:1+Math.floor(R()*2)})}}
  if(ph==='travel'||ph==='main'){
    const q=this.prog(),P=this.head(q),n=every(this.el==='W'?60:45);
    for(let i=0;i<n;i++){
      if(this.el==='F')this.push({k:'flame',x:P[0]+(R()-0.5)*h*0.1,y:P[1]+(R()-0.5)*h*0.1,vx:(R()-0.5)*h*0.6,vy:-h*(0.3+R()*0.5),r:h*(0.09+R()*0.07),life:0.35+R()*0.2,c:Math.floor(R()*3)});
      else if(this.el==='W')this.push({k:'drop',x:P[0],y:P[1],vx:(R()-0.5)*h*1.2,vy:-h*R()*0.6,g:h*7,r:h*(0.025+R()*0.03),life:0.6,c:1+Math.floor(R()*2),floor:1});
      else if(this.el==='T')this.push({k:'dust',x:P[0],y:P[1],vx:(R()-0.5)*h*0.4,vy:(R()-0.5)*h*0.4,r:h*0.07,grow:h*0.25,life:0.5,c:1});
      else if(this.el==='A')this.push({k:'streak',x:P[0],y:P[1]+(R()-0.5)*h*0.5,vx:-(this.end[0]-this.start[0])*0.6,vy:0,r:h*0.05,life:0.25,c:1});
      else if(this.el==='P')this.push({k:'leaf',x:P[0],y:this.gy-h*0.05,vx:(R()-0.5)*h*1.2,vy:-h*(0.6+R()*0.8),g:h*3,r:h*0.06,life:0.6,c:1+Math.floor(R()*2),spin:(R()-0.5)*10,a0:R()*TAU});
      else if(this.el==='L')this.push({k:'spark',x:lerp(this.start[0],this.end[0],R()),y:lerp(this.start[1],this.end[1],R())+(R()-0.5)*h*0.2,vx:(R()-0.5)*h*0.4,vy:(R()-0.5)*h*0.4,r:h*0.04,life:0.3,c:1});
      else if(this.el==='D')this.push({k:'smoke',x:P[0],y:P[1],vx:(R()-0.5)*h*0.3,vy:(R()-0.5)*h*0.3,r:h*0.11,grow:h*0.12,life:0.45,c:2+Math.floor(R()*2)})}}};
/* при попадании */
Run.prototype.burst=function(){
  const R=this.rnd,h=this.h,B=this.end,red=this.reduce,n=Math.round((red?8:34)),el=this.el;
  this.shake=el==='T'?1:el==='F'?0.6:0.35;if(!red)this.flash=el==='L'?0.7:el==='F'?0.5:0.3;else this.flash=0;
  for(let i=0;i<n;i++){const ang=R()*TAU,s=h*(1.2+R()*2.2);
    const base={x:B[0],y:B[1],vx:Math.cos(ang)*s,vy:Math.sin(ang)*s*0.8-h*0.5};
    if(el==='F')this.push(Object.assign(base,{k:R()<0.6?'flame':'ember',r:h*(0.05+R()*0.08),g:h*1.5,life:0.45+R()*0.35,c:Math.floor(R()*3),drag:2}));
    else if(el==='W')this.push(Object.assign(base,{k:'drop',r:h*(0.03+R()*0.04),g:h*8,life:0.8,c:1+Math.floor(R()*2),floor:1}));
    else if(el==='T')this.push(Object.assign(base,{k:R()<0.5?'rock':'dust',r:h*(0.04+R()*0.06),grow:h*0.3,g:h*6,life:0.7,c:1+Math.floor(R()*3),spin:(R()-0.5)*10,a0:R()*TAU,floor:1}));
    else if(el==='A')this.push(Object.assign(base,{k:'swirl',r:h*(0.2+R()*0.3),life:0.5,c:1,a0:R()*TAU,spin:6+R()*4,vx:base.vx*0.2,vy:base.vy*0.2}));
    else if(el==='P')this.push(Object.assign(base,{k:'leaf',r:h*0.07,g:h*2,life:0.8,c:1+Math.floor(R()*2),spin:(R()-0.5)*12,a0:R()*TAU,drag:1.5}));
    else if(el==='L')this.push(Object.assign(base,{k:'spark',r:h*0.05,life:0.45,c:Math.floor(R()*2),drag:3}));
    else this.push(Object.assign(base,{k:'shard',r:h*(0.05+R()*0.05),life:0.5,c:1+Math.floor(R()*2),a0:ang,drag:2.5}))}
  if(el==='W'||el==='T')this.push({k:'ring',x:B[0],y:this.gy,r:h*0.2,grow:h*1.6,life:0.55,c:2});
  if(el==='D')this.push({k:'implode',x:B[0],y:B[1],r:h*1.1,life:0.3,c:1})};
/* доля пути снаряда 0…1 */
Run.prototype.prog=function(){const tl=this.tl,tr=tl.phases.find(p=>p.name==='travel');return clamp((this.t-tl.launch)/Math.max(1e-6,tr.t1-tl.launch),0,1)};
/* голова снаряда на доле q пути */
Run.prototype.head=function(q){
  const a=this.a,A=this.start,B=this.end;
  if(a.kind==='vine')return [lerp(A[0],B[0],q),this.gy];
  if(a.kind==='orb'){const p=arcAt(A,B,a.arc,q),w=Math.sin(q*TAU*1.5)*this.h*0.25*(1-q);return [p[0],p[1]+w]}
  return arcAt(A,B,a.arc,q)};

/* ---------- рисование (матрица сцены уже стоит) ---------- */
Run.prototype.draw=function(ctx){
  if(this.done)return;
  const a=this.a,C=a.col,h=this.h,t=this.t,tl=this.tl,ph=this.phase,M=this.start,red=this.reduce;
  ctx.save();
  /* заряд: свечение у пасти растёт */
  const ch=sm((t-tl.phases[1].t0)/(tl.launch-tl.phases[1].t0))*(t<tl.launch+0.08?1:0);
  if(ch>0&&a.kind!=='ground'&&a.kind!=='vine'){const r=h*(0.12+0.22*ch)*(1+0.08*Math.sin(t*40));glow(ctx,M,r,C,0.9*ch,this.el==='D')}
  if(this.el==='T'&&ch>0){ctx.globalAlpha=0.6*ch;ctx.strokeStyle=C[3];ctx.lineWidth=h*0.03;ctx.lineCap='round';
    for(let i=0;i<4;i++){const x0=M[0]-h*0.2+i*h*0.12;ctx.beginPath();ctx.moveTo(x0,this.gy);ctx.lineTo(x0+h*0.08*(i-1.5),this.gy-0.01);ctx.lineTo(x0+h*0.16*(i-1.5),this.gy);ctx.stroke()}}
  /* снаряд */
  if(t>=tl.launch&&t<tl.impact+0.02)this.shot(ctx);
  /* частицы */
  for(const q of this.p)part(ctx,q,C);
  ctx.restore()};
Run.prototype.shot=function(ctx){
  const a=this.a,C=a.col,h=this.h,q=this.prog(),P=this.head(q),A=this.start,B=this.end,red=this.reduce,t=this.t;
  if(a.kind==='shot'){                      /* огненный шар: ядро, корона, дрожащий хвост */
    for(let i=6;i>=1;i--){const p=this.head(Math.max(0,q-i*0.035));glow(ctx,p,h*(0.2-i*0.022),C,0.5*(1-i/7),false)}
    glow(ctx,P,h*0.26*(1+0.1*Math.sin(t*50)),C,1,false)}
  else if(a.kind==='jet'){                  /* струя: толстая дуга от пасти до головы струи, с бликом */
    ctx.lineCap='round';const N=18;
    const path=()=>{ctx.beginPath();for(let i=0;i<=N;i++){const p=arcAt(A,B,a.arc,q*i/N),w=Math.sin(i*1.3+t*30)*h*0.02;i?ctx.lineTo(p[0],p[1]+w):ctx.moveTo(p[0],p[1]+w)}};
    ctx.globalAlpha=0.9;ctx.strokeStyle=C[3];ctx.lineWidth=h*0.2;path();ctx.stroke();
    ctx.strokeStyle=C[2];ctx.lineWidth=h*0.13;path();ctx.stroke();
    ctx.strokeStyle=C[1];ctx.lineWidth=h*0.05;path();ctx.stroke();
    glow(ctx,P,h*0.16,C,0.9,false)}
  else if(a.kind==='ground'){               /* валун: многоугольник, крутится по дуге, под ним тень на земле */
    ctx.globalAlpha=0.25*(1-Math.abs(q-0.5));ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(P[0],this.gy,h*0.25,h*0.06,0,0,TAU);ctx.fill();ctx.globalAlpha=1;
    rock(ctx,P,h*0.24,t*9,C)}
  else if(a.kind==='gust'){                 /* три серпа воздуха один за другим, выгнуты по ходу полёта */
    const dir=B[0]>=A[0]?1:-1,a0=dir>0?0:Math.PI,ox=-dir*h*0.12;
    for(let i=0;i<3;i++){const qq=clamp(q*1.25-i*0.12,0,1);if(qq<=0)continue;const p=arcAt(A,B,a.arc,qq);
      const rr=h*(0.24-i*0.03);ctx.globalAlpha=0.9*(1-qq*0.3);ctx.lineCap='round';
      ctx.strokeStyle=C[3];ctx.lineWidth=h*0.075;ctx.beginPath();ctx.arc(p[0]+ox,p[1],rr,a0-1.1,a0+1.1);ctx.stroke();
      ctx.strokeStyle=C[i%2?2:1];ctx.lineWidth=h*0.05;ctx.beginPath();ctx.arc(p[0]+ox,p[1],rr,a0-1.1,a0+1.1);ctx.stroke();
      ctx.strokeStyle=C[0];ctx.lineWidth=h*0.02;ctx.beginPath();ctx.arc(p[0]+ox,p[1],rr,a0-0.8,a0+0.8);ctx.stroke()}}
  else if(a.kind==='vine'){                 /* лоза ползёт по земле, у цели поднимается шипами */
    const x0=A[0]+h*0.1*(B[0]>=A[0]?1:-1),x1=lerp(x0,B[0],q),N=Math.max(4,Math.round(Math.abs(x1-x0)/(h*0.25)));
    ctx.lineCap='round';ctx.strokeStyle=C[3];ctx.lineWidth=h*0.09;ctx.beginPath();
    for(let i=0;i<=N;i++){const x=lerp(x0,x1,i/N),y=this.gy-h*0.03-Math.abs(Math.sin(i*0.9))*h*0.06;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
    ctx.strokeStyle=C[2];ctx.lineWidth=h*0.04;ctx.stroke();
    ctx.fillStyle=C[1];for(let i=1;i<N;i+=2){const x=lerp(x0,x1,i/N);ctx.beginPath();ctx.ellipse(x,this.gy-h*0.12,h*0.07,h*0.03,-0.7,0,TAU);ctx.fill()}
    if(q>0.8){const g=sm((q-0.8)/0.2);ctx.fillStyle=C[3];for(let i=-2;i<=2;i++){const x=B[0]+i*h*0.12;ctx.beginPath();ctx.moveTo(x-h*0.05,this.gy);ctx.lineTo(x+i*h*0.03,this.gy-h*(0.35+0.1*(2-Math.abs(i)))*g);ctx.lineTo(x+h*0.05,this.gy);ctx.fill()}}}
  else if(a.kind==='beam'){                 /* луч: широкий мягкий и узкий яркий, толщина пульсирует */
    const w=h*(0.22+0.05*Math.sin(t*60))*(red?0.7:1),E=arcAt(A,B,0,Math.min(1,q*1.4));
    ctx.lineCap='round';ctx.globalCompositeOperation='lighter';
    [[w*1.6,C[3],0.35],[w,C[2],0.6],[w*0.45,C[0],0.95]].forEach(([lw,c,al])=>{ctx.globalAlpha=al;ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(E[0],E[1]);ctx.stroke()});
    ctx.globalCompositeOperation='source-over'}
  else if(a.kind==='orb'){                  /* сгусток тени: тёмное ядро, фиолетовый край, клочья вокруг */
    const r=h*0.24*(1+0.12*Math.sin(t*30));
    const g=ctx.createRadialGradient(P[0],P[1],0,P[0],P[1],r*1.6);g.addColorStop(0,C[3]);g.addColorStop(0.55,C[2]);g.addColorStop(0.8,C[1]+'88');g.addColorStop(1,C[1]+'00');
    ctx.globalAlpha=1;ctx.fillStyle=g;ctx.beginPath();ctx.arc(P[0],P[1],r*1.6,0,TAU);ctx.fill();
    ctx.strokeStyle=C[0];ctx.globalAlpha=0.7;ctx.lineWidth=h*0.02;ctx.beginPath();ctx.arc(P[0],P[1],r*0.8,t*8,t*8+2.2);ctx.stroke()}
  ctx.globalAlpha=1};

/* свечение: мягкий круг с градиентом от светлого к стихийному */
function glow(ctx,p,r,C,al,dark){
  if(r<=0)return;const g=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],r);
  if(dark){g.addColorStop(0,C[3]);g.addColorStop(0.6,C[2]);g.addColorStop(1,C[1]+'00')}
  else{g.addColorStop(0,C[0]);g.addColorStop(0.35,C[1]);g.addColorStop(0.7,C[2]+'CC');g.addColorStop(1,C[3]+'00')}
  ctx.globalAlpha=al;ctx.fillStyle=g;ctx.beginPath();ctx.arc(p[0],p[1],r,0,TAU);ctx.fill();ctx.globalAlpha=1}
function rock(ctx,p,r,ang,C){
  ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(ang);ctx.beginPath();
  for(let i=0;i<7;i++){const a=i/7*TAU,rr=r*(0.78+0.22*Math.sin(i*2.7));i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}
  ctx.closePath();ctx.fillStyle=C[2];ctx.fill();ctx.lineWidth=r*0.12;ctx.strokeStyle=C[3];ctx.stroke();
  ctx.fillStyle=C[1];ctx.beginPath();ctx.ellipse(-r*0.25,-r*0.3,r*0.3,r*0.16,-0.5,0,TAU);ctx.fill();ctx.restore()}
function part(ctx,q,C){
  const u=q.age/q.life,a=1-u,c=C[clamp(q.c,0,3)];
  ctx.globalAlpha=a;
  switch(q.k){
    case 'dot':ctx.fillStyle=c;ctx.beginPath();ctx.arc(q.x,q.y,q.r*(1-u*0.5),0,TAU);ctx.fill();break;
    case 'flame':{const r=q.r*(1-u*0.6);ctx.globalAlpha=a*(u<0.7?0.9:0.35);ctx.fillStyle=u<0.35?C[1]:u<0.7?C[2]:'#8C8F96';ctx.beginPath();ctx.arc(q.x,q.y,r,0,TAU);ctx.fill();break}
    case 'ember':ctx.fillStyle=C[1];ctx.beginPath();ctx.arc(q.x,q.y,q.r*0.5,0,TAU);ctx.fill();break;
    case 'drop':ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(q.x,q.y,q.r,q.r*1.4,Math.atan2(q.vy,q.vx)+Math.PI/2,0,TAU);ctx.fill();break;
    case 'dust':case 'smoke':ctx.globalAlpha=a*(q.k==='smoke'?0.55:0.35);ctx.fillStyle=c;ctx.beginPath();ctx.arc(q.x,q.y,q.r+(q.grow||0)*u,0,TAU);ctx.fill();break;
    case 'rock':rock(ctx,[q.x,q.y],q.r,(q.a0||0)+(q.spin||0)*q.age,C);break;
    case 'leaf':ctx.save();ctx.translate(q.x,q.y);ctx.rotate((q.a0||0)+(q.spin||0)*q.age);ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(0,0,q.r,q.r*0.42,0,0,TAU);ctx.fill();
      ctx.strokeStyle=C[3];ctx.lineWidth=q.r*0.12;ctx.beginPath();ctx.moveTo(-q.r,0);ctx.lineTo(q.r,0);ctx.stroke();ctx.restore();break;
    case 'streak':{ctx.strokeStyle=c;ctx.lineWidth=q.r*0.6;ctx.lineCap='round';const v=Math.hypot(q.vx,q.vy)||1;ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x-q.vx/v*q.r*5,q.y-q.vy/v*q.r*5);ctx.stroke();break}
    case 'spark':{ctx.strokeStyle=C[q.c?1:0];ctx.lineWidth=q.r*0.5;ctx.lineCap='round';const s=q.r*(1.2-u);ctx.beginPath();ctx.moveTo(q.x-s,q.y);ctx.lineTo(q.x+s,q.y);ctx.moveTo(q.x,q.y-s);ctx.lineTo(q.x,q.y+s);ctx.stroke();break}
    case 'swirl':ctx.strokeStyle=c;ctx.lineWidth=q.r*0.12;ctx.beginPath();ctx.arc(q.x,q.y,q.r*(0.5+u),(q.a0||0)+q.spin*q.age,(q.a0||0)+q.spin*q.age+2.4);ctx.stroke();break;
    case 'shard':ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a0||0);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(q.r*1.6,0);ctx.lineTo(-q.r*0.6,q.r*0.45);ctx.lineTo(-q.r*0.6,-q.r*0.45);ctx.fill();ctx.restore();break;
    case 'ring':ctx.strokeStyle=c;ctx.lineWidth=q.r*0.25*(1-u);ctx.beginPath();ctx.ellipse(q.x,q.y,q.r+q.grow*u,(q.r+q.grow*u)*0.25,0,0,TAU);ctx.stroke();break;
    case 'implode':{const r=q.r*(1-u);ctx.strokeStyle=C[1];ctx.lineWidth=q.r*0.08;ctx.beginPath();ctx.arc(q.x,q.y,Math.max(0.1,r),0,TAU);ctx.stroke();break}}
  ctx.globalAlpha=1}

/* стихии атаки дракона: у гибрида обе, каждая со своей атакой (новых локусов нет). У дымного и дремлющего стихия
   не проявлена, их атака — валун, как у Земли (бросок телом, без стихийного дыхания) */
function elementsOf(M){const e=(M&&M.elements||[]).filter(x=>ATTACKS[x]);return e.length?e:['T']}

const DRATK={ATTACKS,ORDER,MAXP,MAXP_R,timeline,Run,elementsOf,arcAt};
if(typeof module!=='undefined'&&module.exports)module.exports=DRATK;else root.DRATK=DRATK;
})(typeof window!=='undefined'?window:globalThis);
