/* Живой остров (этап 4 Драконов 3.0): драконы из рисунка A (rig.js + anim.js) гуляют у своих сред поверх острова.
   Остров по-прежнему рисует island.js одной SVG-строкой; у каждого дракона там прозрачная зона нажатия (g.drg-dr) и старый
   рисунок. Этот слой кладёт поверх острова холст, рисует на нём драконов и двигает их зоны нажатия, а старый рисунок
   прячет только у тех, чьи текстуры уже готовы: если модули рисунка не загрузятся, остров остаётся прежним.
   Где можно ходить: открытая земля без построек и препятствий, рядом со своим домом. Цель шага выбирается так, чтобы
   дракона не загораживала постройка или дерево (холст лежит поверх всего острова), чтобы по пути не было препятствий
   и чтобы не налезать на других драконов. Лапы не скользят: дракон сдвигается ровно на столько, на сколько аниматор
   продвинул шаг (A.x), по экрану почти горизонтально.
   Положение и аниматоры драконов живут здесь, поэтому перерисовка острова их не сбрасывает.
   Цикл кадров один; он стоит, когда острова не видно, вкладка скрыта или открыт осмотр. При «меньше движения» драконы
   стоят на месте, кадр перерисовывается только при изменении камеры. Сохранения игры этот слой не трогает. */
(function(root){
'use strict';
const ISLK=0.3;                  /* единиц острова на единицу рисунка: взрослый вместе с хвостом около 90, малыш около 50, высотой как прежний рисунок */
const R_WANDER=2.6;              /* как далеко от дома гуляет, клеток */
const FPS_MIN=1000/31;           /* остров рисуется не чаще 30 раз в секунду: драконы мелкие, глазу хватает */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const reduced=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const hrand=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
function rng(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

/* ---------- карта острова: где можно стоять (чистые функции, проверяются в live.test.js) ---------- */
/* единицы острова ↔ клетки сетки (обратное к ISL.P) */
function toGrid(I,x,y){const a=(x-I.OX)/(I.TW/2),b=(y-I.OY)/(I.TH/2);return [(a+b)/2,(b-a)/2]}
function toIsle(I,i,j){return [(i-j)*I.TW/2+I.OX,(i+j)*I.TH/2+I.OY]}
/* что загораживает: постройки и препятствия прямоугольниками на экране острова, base — линия, ниже которой дракон уже впереди */
const OBH={tree:[22,54,7],bush:[15,17,6],rock:[18,16,8]};   /* полуширина, высота над точкой, низ: по рисункам tree, bush, greyRock в island.js */
function mapOf(st,D,I){
  const G=D.GRID,C=D.CHUNK,land=new Set(st.land),cell=new Uint8Array(G*G),obs=D.obstacles(st),occ=[];
  for(let i=0;i<G;i++)for(let j=0;j<G;j++)cell[i*G+j]=land.has(Math.floor(i/C)+','+Math.floor(j/C))?1:0;
  st.bld.forEach(b=>{for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++){const i=b.x+dx,j=b.y+dy;if(i<G&&j<G)cell[i*G+j]=0}
    const c=toIsle(I,b.x+1,b.y+1),h=(I.HEIGHT[b.type]||70);
    occ.push({x0:c[0]-60,x1:c[0]+60,y0:c[1]-h,y1:c[1]+12,base:c[1]+16,id:b.id})});
  obs.forEach(o=>{cell[o.x*G+o.y]=0;const c=toIsle(I,o.x+.5,o.y+.5),k=OBH[o.kind]||OBH.rock;occ.push({x0:c[0]-k[0],x1:c[0]+k[0],y0:c[1]-k[1],y1:c[1]+k[2],base:c[1]+k[2]})});
  const free=(i,j)=>i>=0&&j>=0&&i<G&&j<G&&cell[Math.floor(i)*G+Math.floor(j)]===1;
  return {G,free,occ}}
/* дракон в точке p (единицы острова) шириной w и высотой h: не загорожен ли чем-то, что стоит впереди */
function hidden(map,p,w,h){
  for(const o of map.occ){if(p[1]>=o.base)continue;
    if(p[0]+w/2>o.x0&&p[0]-w/2<o.x1&&p[1]>o.y0&&p[1]-h<o.y1)return true}
  return false}
/* путь a → b свободен: каждые 0,2 клетки свободная земля; в начале можно стоять в занятой клетке (дракон выходит из дома) */
function pathFree(map,I,a,b){
  const ga=toGrid(I,a[0],a[1]),gb=toGrid(I,b[0],b[1]),n=Math.max(2,Math.ceil(Math.hypot(gb[0]-ga[0],gb[1]-ga[1])/0.2));
  let out=!map.free(ga[0],ga[1]);
  for(let k=1;k<=n;k++){const t=k/n,i=ga[0]+(gb[0]-ga[0])*t,j=ga[1]+(gb[1]-ga[1])*t,f=map.free(i,j);
    if(f)out=false;else if(!out)return false}
  return !out}
/* новая цель прогулки: случайная точка у дома, куда видно, можно дойти и где нет других драконов */
function pickTarget(map,I,d,others,rnd){
  const hg=toGrid(I,d.home[0],d.home[1]);
  for(let tries=0;tries<40;tries++){
    const a=rnd()*Math.PI*2,r=0.6+rnd()*R_WANDER,gi=hg[0]+Math.cos(a)*r,gj=hg[1]+Math.sin(a)*r;
    if(!map.free(gi,gj))continue;
    const p=toIsle(I,gi,gj),dx=p[0]-d.p[0],dy=p[1]-d.p[1];
    if(Math.abs(dx)<14||Math.abs(dy)>Math.abs(dx)*0.55)continue;           /* идёт боком к зрителю, как нарисован */
    if(hidden(map,p,d.w,d.h))continue;
    if(others.some(o=>o!==d&&(Math.hypot(o.p[0]-p[0],(o.p[1]-p[1])*2)<d.w*0.7||o.to&&Math.hypot(o.to[0]-p[0],(o.to[1]-p[1])*2)<d.w*0.7)))continue;
    if(!pathFree(map,I,d.p,p))continue;
    /* и по дороге его ничто не заслоняет */
    let seen=true;for(let k=1;k<6&&seen;k++){const t=k/6;if(hidden(map,[d.p[0]+dx*t,d.p[1]+dy*t],d.w,d.h))seen=false}
    if(!seen)continue;
    return p}
  return null}

/* дракон стоит там, где его загораживает постройка или дерево: переставить в ближайшую видную свободную точку */
function settle(map,I,d,others){
  if(map.free(...toGrid(I,d.p[0],d.p[1]))&&!hidden(map,d.p,d.w,d.h))return false;
  const hg=toGrid(I,d.home[0],d.home[1]);
  /* сначала место, где видно и никого нет; если такого нет, можно рядом с другим драконом; в крайнем случае просто свободная земля */
  for(const pass of [0,1,2])for(let r=0.4;r<=R_WANDER+(pass===2?2:0.6);r+=0.3)for(let k=0;k<16;k++){const a=k/16*Math.PI*2+r,gi=hg[0]+Math.cos(a)*r,gj=hg[1]+Math.sin(a)*r;
    if(!map.free(gi,gj))continue;const p=toIsle(I,gi,gj);if(pass<2&&hidden(map,p,d.w,d.h))continue;
    if(pass===0&&others.some(o=>o!==d&&Math.hypot(o.p[0]-p[0],(o.p[1]-p[1])*2)<d.w*0.7))continue;
    d.p=p;d.how='settle'+pass;return true}
  return false}

/* ---------- слой ---------- */
const L={svg:null,cv:null,ctx:null,ds:new Map(),raf:0,last:0,acc:0,stats:{draw:[],frame:[],frames:0},get:null,map:null,mapKey:'',
  vis:true,io:null,ready:false,loading:null,dirty:true,camKey:''};

function scan(get){
  if(get)L.get=get;
  const svg=document.querySelector('svg.drg-isl:not(.mini)');
  if(!svg){if(L.svg)detach();return}
  if(svg!==L.svg)attach(svg);
  else sync()}
function attach(svg){
  detach(true);
  L.svg=svg;svg.classList.add('live');
  const cv=document.createElement('canvas');cv.className='drg-live';cv.setAttribute('aria-hidden','true');
  const full=svg.closest('.drg-map.full');
  if(full){full.querySelector('.drg-stage').after(cv);cv.classList.add('fs')}
  else svg.after(cv);
  L.cv=cv;L.ctx=cv.getContext('2d');L.dirty=true;
  if('IntersectionObserver' in root){L.io=new IntersectionObserver(es=>{L.vis=es.some(e=>e.isIntersecting);wake()});L.io.observe(svg)}
  load().then(()=>{if(L.svg===svg){sync();wake()}}).catch(e=>{console.warn('живой остров: модули рисунка не загрузились',e)})}
function detach(keep){
  if(L.io){L.io.disconnect();L.io=null}
  if(L.cv&&L.cv.parentNode)L.cv.remove();
  L.cv=null;L.ctx=null;L.svg=null;
  if(!keep){L.ds.forEach(d=>{if(d.X)root.RIG.release(d.X);if(d.Xn)root.RIG.release(d.Xn)});L.ds.clear()}
  stop()}
function load(){
  if(L.loading)return L.loading;
  L.loading=(root.DRGINSP&&root.DRGINSP.loadAll?root.DRGINSP.loadAll():Promise.reject(new Error('нет inspect.js'))).then(()=>{L.ready=true});
  L.loading.catch(()=>{L.loading=null});
  return L.loading}

/* сверить драконов слоя с группами в SVG: новые завести, ушедших убрать, у оставшихся обновить дом и группу */
function sync(){
  if(!L.svg||!L.ready)return;
  const st=L.get&&L.get();if(!st)return;
  const I=root.ISL,D=root.DECO,key=JSON.stringify([st.bld.map(b=>[b.id,b.x,b.y,b.type]),st.land,st.clr||[]]);
  if(key!==L.mapKey){L.map=mapOf(st,D,I);L.mapKey=key;L.ds.forEach(d=>{d.settled=false;if(d.state==='walk'||d.state==='turn'){d.state='idle';d.wait=0.5;d.A.play('idle')}d.to=null})}
  const seen=new Set();
  L.svg.querySelectorAll('g.drg-dr[data-ix]').forEach(g=>{
    const id=g.dataset.dragon,dr=st.dragons.find(x=>x.id===id);if(!dr)return;seen.add(id);
    const home=[+g.dataset.ix,+g.dataset.iy],mode=g.dataset.mode;let d=L.ds.get(id);
    const ph=root.DRG.phenotype(dr.genome),pk=JSON.stringify([ph,root.MORPH.stageOf(dr.lvl)]);
    if(d&&d.pk!==pk){if(d.X)root.RIG.release(d.X);if(d.Xn)root.RIG.release(d.Xn);L.ds.delete(id);d=null}
    if(!d){d=make(id,dr,ph,pk,home,mode,+g.dataset.face||1);L.ds.set(id,d)}
    else if(d.homeKey!==g.dataset.home+':'+home.join()||d.mode!==mode){d.home=home;d.p=home.slice();d.to=null;d.mode=mode;d.face=+g.dataset.face||1;d.state='idle';d.wait=1+d.rnd()*2;d.A.play('idle')}
    d.homeKey=g.dataset.home+':'+home.join();d.g=g;
    /* зона нажатия по размеру нового рисунка */
    const el=g.querySelector('ellipse');if(el&&!g.dataset.fit){g.dataset.fit='1';el.setAttribute('cy',(home[1]-d.h*0.45).toFixed(1));el.setAttribute('rx',(d.w*0.5).toFixed(1));el.setAttribute('ry',(d.h*0.55).toFixed(1))}
    if(d.mode==='hab'&&d.state!=='walk'&&d.state!=='turn'&&!d.settled){d.settled=true;settle(L.map,I,d,[...L.ds.values()])}
    d.art=L.svg.querySelector(`g.drg-art[data-art="${CSS.escape(id)}"]`);if(d.X&&d.art)d.art.classList.add('lv');
    place(d)});
  L.ds.forEach((d,id)=>{if(!seen.has(id)){if(d.X)root.RIG.release(d.X);if(d.Xn)root.RIG.release(d.Xn);L.ds.delete(id)}});
  L.dirty=true}
function make(id,dr,ph,pk,home,mode,face){
  const M=root.MORPH.morph(ph,dr.lvl),G=root.SHAPE.build(M),seed=hrand(id),rnd=rng(seed);
  const A=new root.ANIM.Animator(M,G.rig,{seed:seed%9973,reduce:reduced()});
  const k=ISLK*G.scale,d={id,ph,pk,lvl:dr.lvl,M,G,A,rnd,k,home:home.slice(),p:home.slice(),to:null,mode,face,turn:0,
    w:G.box.w*k,h:-G.box.y*k,cx:G.box.x+G.box.w/2,state:'idle',wait:0.5+rnd()*3,X:null,Xn:null,px:0,ax:0};
  if(rnd()<0.3&&mode==='hab')A.t+=rnd()*3;
  return d}

/* ---------- поведение ---------- */
const night=()=>{const h=new Date().getHours();return h>=22||h<7};
function think(d,dt){
  const A=d.A,P=A.P;
  if(d.turn>0){d.turn=Math.max(0,d.turn-dt/0.32);if(d.turn===0)d.face=d.nface}
  if(d.state==='turn'){if(d.turn===0){d.state='walk';d.ax=A.x;A.play('walk')}return}
  if(d.state==='walk'){
    const dx=(A.x-d.ax)*d.k;d.ax=A.x;
    const tx=d.to[0]-d.p[0],ty=d.to[1]-d.p[1],sx=Math.sign(tx)||1,step=Math.min(Math.abs(tx),Math.abs(dx));
    d.p[0]+=sx*step;d.p[1]+=ty*(step/Math.max(1e-6,Math.abs(tx)));
    if(Math.abs(d.to[0]-d.p[0])<0.05){d.p=d.to.slice();d.to=null;d.state='idle';A.play('idle');d.wait=2+d.rnd()*5}
    return}
  if(d.state==='sleep'||d.state==='idle'||d.state==='happy'){
    d.wait-=dt;if(d.wait>0)return;
    if(d.state==='sleep'){d.state='idle';A.play('idle');d.wait=1.5+d.rnd()*2;return}
    if(d.mode==='nest'){/* в гнезде не гуляют: дремлют и радуются друг другу */
      if(d.rnd()<0.35){d.state='sleep';A.play('sleep');d.wait=12+d.rnd()*20}else{if(d.rnd()<0.3)A.play('happy');d.wait=3+d.rnd()*5}return}
    const sleepy=P.sleepy||night(),first=!d.moved;d.moved=true;
    if(!first&&d.rnd()<(sleepy?0.35:0.05)){d.state='sleep';A.play('sleep');d.wait=sleepy?25+d.rnd()*25:8+d.rnd()*12;return}
    if(d.rnd()<0.1){A.play('happy');d.wait=2+d.rnd()*2;return}
    const to=pickTarget(L.map,root.ISL,d,[...L.ds.values()],d.rnd);
    if(!to){d.wait=2+d.rnd()*3;return}
    d.to=to;d.how='walk';A.play('idle');
    /* сначала разворот на месте (лапы стоят), потом шаг */
    const f=Math.sign(to[0]-d.p[0])||d.face;if(f!==d.face){d.nface=f;d.turn=1;d.state='turn'}else{d.state='walk';d.ax=A.x;A.play('walk')}}}
/* зона нажатия едет за драконом: сдвиг от места, где группа нарисована */
function place(d){if(!d.g)return;const x=(d.p[0]-d.home[0]).toFixed(1),y=(d.p[1]-d.home[1]).toFixed(1);
  const v=`translate(${x}px,${y}px)`;if(d.g.style.transform!==v)d.g.style.transform=v}

/* ---------- кадр ---------- */
/* единицы острова → CSS-пиксели холста: из прямоугольников SVG и холста на экране (учитывает камеру и прокрутку) */
function islandView(){
  const sv=L.svg,cv=L.cv,vb=sv.viewBox.baseVal,r=sv.getBoundingClientRect(),c=cv.getBoundingClientRect();
  const s=Math.min(r.width/vb.width,r.height/vb.height),ox=r.left+(r.width-vb.width*s)/2-c.left,oy=r.top+(r.height-vb.height*s)/2-c.top;
  return {s,ox:ox-vb.x*s,oy:oy-vb.y*s,cw:c.width,ch:c.height}}
const pxStep=v=>clamp(Math.pow(2,Math.round(Math.log2(Math.max(0.05,v))*2)/2),0.25,3);
function want(d,css){
  const dpr=Math.min(2,root.devicePixelRatio||1),px=pxStep(css*d.k/d.G.scale*1.15);
  if(d.px===px||d.loadPx===px)return;d.loadPx=px;
  root.RIG.get(d.ph,d.lvl,{px,dpr}).then(X=>{
    if(!L.ds.has(d.id)||L.ds.get(d.id)!==d||d.loadPx!==px){root.RIG.release(X);return}
    if(d.X)root.RIG.release(d.X);d.X=X;d.px=px;d.loadPx=0;if(d.art)d.art.classList.add('lv');L.dirty=true;wake()}).catch(()=>{d.loadPx=0})}
function cover(){const cv=L.cv,sv=L.svg;if(cv.classList.contains('fs'))return;
  /* у SVG нет offsetLeft: место считаем от родителя (.drg-map прокручивается, холст едет вместе с островом) */
  const m=cv.parentNode,r=sv.getBoundingClientRect(),q=m.getBoundingClientRect();
  const v=[r.left-q.left-m.clientLeft+m.scrollLeft,r.top-q.top-m.clientTop+m.scrollTop,r.width,r.height].map(x=>x.toFixed(1)+'px');
  if(cv.style.left!==v[0])cv.style.left=v[0];if(cv.style.top!==v[1])cv.style.top=v[1];if(cv.style.width!==v[2])cv.style.width=v[2];if(cv.style.height!==v[3])cv.style.height=v[3]}
function draw(){
  const cv=L.cv,ctx=L.ctx;if(!cv)return;const t0=performance.now();cover();
  const dpr=Math.min(2,root.devicePixelRatio||1),V=islandView(),W=Math.round(V.cw*dpr),H=Math.round(V.ch*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
  const list=[...L.ds.values()].sort((a,b)=>a.p[1]-b.p[1]);
  for(const d of list){
    want(d,V.s);
    if(!d.X||(d.g&&d.g.style.visibility==='hidden'))continue;
    const x=(V.ox+d.p[0]*V.s)*dpr,y=(V.oy+d.p[1]*V.s)*dpr,z=V.s*dpr*d.k;
    if(x+d.w*V.s*dpr<0||x-d.w*V.s*dpr>W||y-d.h*V.s*dpr*1.2>H||y<-20)continue;   /* за краем экрана не рисуем */
    /* контактная тень на траве, как у деревьев и камней острова: чуть сжимается, когда дракон приподнимается */
    const lift=Math.max(0,-(d.A.pose.body[5]||0))/d.A.P.h;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=0.2;ctx.fillStyle='#000';ctx.beginPath();
    ctx.ellipse(x,y+z*2,d.w*V.s*dpr*0.42/(1+lift),d.w*V.s*dpr*0.07,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    const flip=d.turn>0?d.face*Math.cos((1-d.turn)*Math.PI):d.face;
    const view=[z*flip,0,0,z,x-z*flip*d.cx,y];
    root.RIG.draw(ctx,d.X,d.A.pose,view);
    root.RIG.drawFx(ctx,d.X,d.A.fx,view)}
  ctx.setTransform(1,0,0,1,0,0);
  L.camKey=[V.s.toFixed(4),V.ox.toFixed(1),V.oy.toFixed(1),W,H].join();
  const ms=performance.now()-t0;L.stats.draw.push(ms);if(L.stats.draw.length>240)L.stats.draw.shift();L.stats.frames++;L.dirty=false}

function running(){return L.svg&&L.svg.isConnected&&L.ready&&L.vis&&!document.hidden&&!document.querySelector('.dri')}
function wake(){if(!L.raf&&running())L.raf=requestAnimationFrame(tick)}
function stop(){if(L.raf)cancelAnimationFrame(L.raf);L.raf=0;L.last=0}
function tick(ts){
  L.raf=0;if(!running()){L.last=0;return}
  L.raf=requestAnimationFrame(tick);
  if(L.last&&ts-L.last<FPS_MIN-1)return;
  const dt=L.last?clamp((ts-L.last)/1000,0,0.1):1/30;if(L.last){L.stats.frame.push(ts-L.last);if(L.stats.frame.length>240)L.stats.frame.shift()}
  L.last=ts;
  if(reduced()){
    /* меньше движения: стоят, кадр только когда камера сдвинулась или пришли текстуры */
    const V=islandView(),key=[V.s.toFixed(4),V.ox.toFixed(1),V.oy.toFixed(1),Math.round(V.cw),Math.round(V.ch)].join();
    if(L.dirty||key!==L.lastKey){L.lastKey=key;draw()}return}
  L.ds.forEach(d=>{think(d,dt);d.A.update(dt);place(d)});
  draw()}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',wake);
  /* после осмотра цикл продолжается: осмотр живёт вне острова, его закрытие удаляет .dri */
  new MutationObserver(()=>{if(!L.raf&&!document.querySelector('.dri'))wake()}).observe(document.documentElement,{childList:true,subtree:false});
  addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(!L.raf&&!document.querySelector('.dri'))wake()}).observe(document.body,{childList:true}))}

const DRLIVE={scan,wake,stats:()=>({dragons:L.ds.size,ready:L.ready,running:!!L.raf,attached:!!L.svg&&L.svg.isConnected,vis:L.vis,cv:!!L.cv&&L.cv.isConnected,frames:L.stats.frames,draw:L.stats.draw.slice(),frame:L.stats.frame.slice(),
  pos:[...L.ds.values()].map(d=>({id:d.id,p:d.p.slice(),state:d.state,face:d.face,tex:!!d.X,px:d.px,how:d.how||'',hid:hidden(L.map,d.p,d.w,d.h)}))}),
  PURE:{toGrid,toIsle,mapOf,hidden,pathFree,pickTarget,settle,ISLK}};
if(typeof module!=='undefined'&&module.exports)module.exports=DRLIVE;else root.DRLIVE=DRLIVE;
})(typeof window!=='undefined'?window:globalThis);
