/* Сцена боя: драконы на общей земле лицом друг к другу, их анимации (anim.js + rig.js) и атаки (attacks.js).
   Сцена ничего не решает в бою: battle.js говорит «A атакует B стихией e», сцена показывает и в момент попадания
   зовёт onImpact (ровно один раз), а урон и очередь хода остаются в логике боя.
   Единицы сцены — единицы экрана рисунка (единица рисунка × масштаб возраста), земля y = 0, ось y вниз. */
(function(root){
'use strict';
const AN=()=>root.ANIM,RIG=()=>root.RIG,ATK=()=>root.DRATK;
const clamp=(x,a,b)=>x<a?a:x>b?b:x;

function Scene(cv,o){
  o=o||{};this.cv=cv;this.o=o;this.ds=[];this.runs=[];this.t=0;this.reduce=!!o.reduce;this.dpr=o.dpr||Math.min(2,root.devicePixelRatio||1);
  this.w=o.width||200;this.top=o.top||90;this.px=1;this.stats={draw:[],frame:[],parts:0};this.raf=0;this.alive=true;this.seed=o.seed||11;this.paused=false}
/* слот: ph — фенотип, lvl, x — место по оси сцены, face 1 вправо / −1 влево */
Scene.prototype.add=async function(ph,lvl,x,face,extra){
  const M=root.MORPH.morph(ph,lvl),G=root.SHAPE.build(M),R=G.rig,px=this.px;
  const X=await RIG().get(ph,lvl,{px:this.texPx(),dpr:this.dpr});
  const A=new (AN().Animator)(M,R,{seed:this.seed++,reduce:this.reduce,noPuff:true});
  const d=Object.assign({ph,lvl,M,G,R,X,A,x,face:face||1,s:G.scale,cx:G.box.x+G.box.w/2,alpha:1,tint:0},extra||{});
  this.ds.push(d);return d};
/* размер текстур: столько пикселей холста на единицу экрана рисунка, сколько даст текущая ширина (с запасом на 25 %) */
Scene.prototype.texPx=function(){const w=this.cv.clientWidth||600,z=this.fb?this.zoomFb(w,this.cv.clientHeight||300):w/this.w;return Math.max(0.5,Math.min(3,Math.round(z*1.25*4)/4))};
/* расставить драконов: команды слева и справа, между фигурами gap, по краям поле. Ширина и высота сцены по ним.
   Единица экрана рисунка: ширина фигуры = box.w × масштаб возраста */
Scene.prototype.layout=function(gap,mid){
  gap=gap==null?10:gap;mid=mid==null?36:mid;const L=this.ds.filter(d=>d.face>0),R=this.ds.filter(d=>d.face<0),wd=d=>d.G.box.w*d.s;
  let x=gap;L.forEach(d=>{d.x=x+wd(d)/2;x+=wd(d)+gap});x+=mid-gap;R.forEach(d=>{d.x=x+wd(d)/2;x+=wd(d)+gap});
  this.w=x;this.top=Math.max(40,...this.ds.map(d=>-d.G.box.y*d.s))*1.12+8;this.fit()};
Scene.prototype.remove=function(d){const i=this.ds.indexOf(d);if(i>=0){this.ds.splice(i,1);RIG().release(d.X)}};
Scene.prototype.clear=function(){this.ds.forEach(d=>RIG().release(d.X));this.ds=[];this.runs=[]};
/* матрица дракона: его мир (единицы рисунка, как в позе) → сцена */
Scene.prototype.place=function(d){const k=d.s*d.face;return [k,0,0,d.s,d.x-k*d.cx,d.y||0]};
/* рамка для боя 3 на 3: прямоугольник сцены {x0,x1,y0,y1} целиком в холсте по центру, pad и padTop в CSS-пикселях.
   Драконы тогда могут стоять в глубину (d.y > 0 ближе к зрителю), а холст любой формы */
Scene.prototype.frame=function(b){this.fb=b};
Scene.prototype.zoomFb=function(W,H){const b=this.fb,p=b.pad||0,pt=b.padTop||0;return Math.max(0.01,Math.min((W-2*p)/(b.x1-b.x0),(H-p-pt)/(b.y1-b.y0)))};
Scene.prototype.view=function(){
  const W=this.cv.width,H=this.cv.height;let z=W/this.w,ox=0,gy=H-Math.max(8,H*0.12);
  if(this.fb){const b=this.fb,k=this.dpr,p=(b.pad||0)*k,pt=(b.padTop||0)*k;z=this.zoomFb(W/k,H/k)*k;ox=W/2-z*(b.x0+b.x1)/2;gy=(pt+H-p)/2-z*(b.y0+b.y1)/2}
  let sx=0,sy=0;const sh=this.runs.reduce((a,r)=>Math.max(a,r.shake),0);
  if(sh>0&&!this.reduce){sx=(Math.random()-0.5)*sh*z*2;sy=(Math.random()-0.5)*sh*z*1.2}
  return [z,0,0,z,ox+sx,gy+sy]};
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const app=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
Scene.prototype.mouth=function(d){return app(this.place(d),app(d.A.pose.mat.head,d.R.mouth))};
Scene.prototype.chest=function(d){const R=d.R,p=[R.mid[0]*0.35+R.sh[0]*0.65,(R.mid[1]*0.35+R.sh[1]*0.65)-R.neckCut.r*0.2];return app(this.place(d),app(d.A.pose.body,p))};
/* атака: a бьёт b стихией el; onImpact зовётся один раз в момент попадания, onEnd — когда атака отыграла */
Scene.prototype.attack=function(a,b,el,cb){
  cb=cb||{};const run=new (ATK().Run)({el,from:()=>this.mouth(a),to:()=>this.chest(b),h:a.A.P.h*a.s*1.6*(cb.size||1),ground:a.y||0,reduce:this.reduce,seed:this.seed++});
  run.src=a;run.dst=b;run.cb=cb;run.hits=0;a.A.play('attack');this.runs.push(run);return run};
Scene.prototype.update=function(dt){
  if(this.paused)dt=0;this.t+=dt;
  this.ds.forEach(d=>{d.A.update(dt);d.tint=Math.max(0,d.tint-dt*4)});
  this.runs.forEach(r=>{r.update(dt).forEach(e=>{
    if(e.type==='impact'){r.hits++;r.dst.A.play('hit');r.dst.tint=1;if(r.cb.onImpact)r.cb.onImpact(e,r)}
    else if(e.type==='end'&&r.cb.onEnd)r.cb.onEnd(e,r);
    if(r.cb.onEvent)r.cb.onEvent(e,r)})});
  this.runs=this.runs.filter(r=>!r.done)};
Scene.prototype.draw=function(){
  const c=this.cv.getContext('2d'),W=this.cv.width,H=this.cv.height,t0=(root.performance||Date).now();
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  const V=this.view();
  /* сначала тени и драконы, потом атаки поверх; under и over — слои того, кто ведёт сцену (тени, кольца, полоски здоровья) */
  if(this.under){c.setTransform(V[0],V[1],V[2],V[3],V[4],V[5]);this.under(c,V);c.setTransform(1,0,0,1,0,0)}
  this.ds.forEach(d=>{const v=mul(V,this.place(d));RIG().draw(c,d.X,d.A.pose,v,{alpha:d.alpha});
    if(d.tint>0.02&&!this.reduce){/* вспышка попадания: тот же дракон светлым поверх, быстро гаснет */
      c.save();c.globalCompositeOperation='lighter';RIG().draw(c,d.X,d.A.pose,v,{alpha:0.28*d.tint*d.alpha});c.restore()}
    c.globalAlpha=1;RIG().drawFx(c,d.X,d.A.fx,v)});
  c.setTransform(V[0],V[1],V[2],V[3],V[4],V[5]);
  this.runs.forEach(r=>r.draw(c));
  const fl=this.runs.reduce((a,r)=>Math.max(a,r.flash),0);
  if(fl>0.01&&!this.reduce){const r=this.runs.find(q=>q.flash===fl),p=r.end;c.setTransform(V[0],V[1],V[2],V[3],V[4],V[5]);
    const g=c.createRadialGradient(p[0],p[1],0,p[0],p[1],r.h*2.2);g.addColorStop(0,'rgba(255,255,255,'+(0.4*fl).toFixed(3)+')');g.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=g;c.beginPath();c.arc(p[0],p[1],r.h*2.2,0,Math.PI*2);c.fill()}
  c.setTransform(1,0,0,1,0,0);
  if(this.over){this.over(c,V);c.setTransform(1,0,0,1,0,0);c.globalAlpha=1}
  const ms=(root.performance||Date).now()-t0;this.stats.draw.push(ms);if(this.stats.draw.length>120)this.stats.draw.shift();
  this.stats.parts=this.runs.reduce((a,r)=>a+r.p.length,0)};
/* подогнать холст под ширину блока: высота по самой высокой фигуре (top — сколько единиц над землёй) */
Scene.prototype.fit=function(){
  const w=this.cv.clientWidth||600,h=Math.round(w*this.top/this.w);this.cv.style.height=h+'px';
  const W=Math.round(w*this.dpr),H=Math.round(h*this.dpr);if(this.cv.width!==W||this.cv.height!==H){this.cv.width=W;this.cv.height=H}};
/* цикл кадров: один на сцену, останавливается stop(), на скрытой вкладке не рисует */
Scene.prototype.start=function(){
  if(this.raf)return;let last=0;
  const tick=ts=>{if(!this.alive){this.raf=0;return}this.raf=root.requestAnimationFrame(tick);
    if(root.document&&root.document.hidden){last=ts;return}
    const dt=last?clamp((ts-last)/1000,0,0.1):1/60;if(last){this.stats.frame.push(ts-last);if(this.stats.frame.length>240)this.stats.frame.shift()}
    last=ts;this.update(dt*(this.speed||1));this.draw()};
  this.raf=root.requestAnimationFrame(tick)};
Scene.prototype.stop=function(){this.alive=false;if(this.raf)root.cancelAnimationFrame(this.raf);this.raf=0};
Scene.prototype.destroy=function(){this.stop();this.clear()};

const DRSCENE={Scene};
if(typeof module!=='undefined'&&module.exports)module.exports=DRSCENE;else root.DRSCENE=DRSCENE;
})(typeof window!=='undefined'?window:globalThis);
