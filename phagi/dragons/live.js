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
const R_WANDER=2.6;              /* как далеко от дома гуляет, клеток (драконы без вольера) */
const HABK=0.62;                 /* дракон в вольере (4.1) мельче, чтобы помещался во двор своего дома */
const FLY_V=16;                  /* скорость полёта над двором, единиц острова в секунду */
const FPS_MIN=1000/31;           /* остров рисуется не чаще 30 раз в секунду: драконы мелкие, глазу хватает */
const BUDGET=0.25,FPS_LOW=1000/12; /* 5.0: на слабом устройстве кадр реже — не больше четверти времени на живой слой, но не реже 12 раз в секунду */
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
  const yards={};
  st.bld.forEach(b=>{for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++){const i=b.x+dx,j=b.y+dy;if(i<G&&j<G)cell[i*G+j]=0}
    const c=toIsle(I,b.x+1,b.y+1),h=(I.HEIGHT[b.type]||70);
    /* вольер (4.1): загораживает только знак среды в глубине, двор перед ним открыт */
    if(I.YARD&&I.PAD&&I.PAD[b.type]&&D.TYPES[b.type]&&D.TYPES[b.type].kind==='hab'){yards[b.id]={x:b.x,y:b.y};
      occ.push({x0:c[0]-40,x1:c[0]+40,y0:c[1]-h,y1:c[1]-4,base:c[1]-5,id:b.id});return}
    occ.push({x0:c[0]-60,x1:c[0]+60,y0:c[1]-h,y1:c[1]+12,base:c[1]+16,id:b.id})});
  obs.forEach(o=>{cell[o.x*G+o.y]=0;const c=toIsle(I,o.x+.5,o.y+.5),k=OBH[o.kind]||OBH.rock;occ.push({x0:c[0]-k[0],x1:c[0]+k[0],y0:c[1]-k[1],y1:c[1]+k[2],base:c[1]+k[2]})});
  const free=(i,j)=>i>=0&&j>=0&&i<G&&j<G&&cell[Math.floor(i)*G+Math.floor(j)]===1;
  return {G,free,occ,yards}}
/* двор вольера: клетки постройки u, v (0…2) в пределах YARD и перед знаком среды */
function inYard(Y,u,v){return u>=Y.lo&&u<=Y.hi&&v>=Y.lo&&v<=Y.hi&&u+v>=Y.front}
function yardOf(map,I,d){const y=d.hid&&map.yards&&map.yards[d.hid];return y&&I.YARD?y:null}
function yardHas(map,I,d,p){const y=yardOf(map,I,d);if(!y)return false;const g=toGrid(I,p[0],p[1]);if(!inYard(I.YARD,g[0]-y.x,g[1]-y.y))return false;
  const c=toIsle(I,y.x+1,y.y+1),w=(d.w||0)/2+2,h=(d.h||0)+2;
  return [-w,w].every(dx=>[2,-h].every(dy=>Math.pow((p[0]+dx-c[0])/61,2)+Math.pow((p[1]+dy-c[1]+8)/40,2)<=1))}
/* цель во дворе: видная, не на другом драконе; air — для полёта (направление любое) */
function yardTarget(map,I,d,others,rnd,air){const y=yardOf(map,I,d),Y=I.YARD;
  for(let tries=0;tries<40;tries++){const u=Y.lo+rnd()*(Y.hi-Y.lo),v=Y.lo+rnd()*(Y.hi-Y.lo);if(!inYard(Y,u,v))continue;
    const p=toIsle(I,y.x+u,y.y+v);if(!yardHas(map,I,d,p))continue;const dx=p[0]-d.p[0],dy=p[1]-d.p[1];
    if(!air&&(Math.abs(dx)<8||Math.abs(dy)>Math.abs(dx)*0.6))continue;
    if(hidden(map,p,d.w,air?d.h*2.2:d.h))continue;
    if(others.some(o=>o!==d&&o.hid===d.hid&&(Math.hypot(o.p[0]-p[0],(o.p[1]-p[1])*2)<d.w*0.55||o.to&&Math.hypot(o.to[0]-p[0],(o.to[1]-p[1])*2)<d.w*0.55)))continue;
    return p}
  return null}
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
  if(yardOf(map,I,d))return yardTarget(map,I,d,others,rnd,false);
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
  /* вольер: дракон стоит во дворе своего дома. Если весь двор закрыт постройкой впереди, остаётся рисунок на острове (cover) */
  const y=yardOf(map,I,d);
  if(y){d.cover=false;if(yardHas(map,I,d,d.p)&&!hidden(map,d.p,d.w,d.h))return false;const Y=I.YARD;
    for(const pass of [0,1]){let best=null,bd=1e9;
      for(let u=Y.lo;u<=Y.hi+1e-6;u+=0.12)for(let v=Y.lo;v<=Y.hi+1e-6;v+=0.12){if(!inYard(Y,u,v))continue;const p=toIsle(I,y.x+u,y.y+v);
        if(!yardHas(map,I,d,p))continue;
        if(hidden(map,p,d.w,d.h))continue;
        if(pass===0&&others.some(o=>o!==d&&o.hid===d.hid&&Math.hypot(o.p[0]-p[0],(o.p[1]-p[1])*2)<d.w*0.55))continue;
        const q=Math.hypot(p[0]-d.home[0],p[1]-d.home[1]);if(q<bd){bd=q;best=p}}
      if(best){d.p=best;d.how='yard'+pass;return true}}
    d.p=d.home.slice();d.cover=true;d.how='cover';return true}
  if(map.free(...toGrid(I,d.p[0],d.p[1]))&&!hidden(map,d.p,d.w,d.h))return false;
  const hg=toGrid(I,d.home[0],d.home[1]);
  /* сначала место, где видно и никого нет; если такого нет, можно рядом с другим драконом; в крайнем случае просто свободная земля */
  for(const pass of [0,1,2])for(let r=0.4;r<=R_WANDER+(pass===2?2:0.6);r+=0.3)for(let k=0;k<16;k++){const a=k/16*Math.PI*2+r,gi=hg[0]+Math.cos(a)*r,gj=hg[1]+Math.sin(a)*r;
    if(!map.free(gi,gj))continue;const p=toIsle(I,gi,gj);if(pass<2&&hidden(map,p,d.w,d.h))continue;
    if(pass===0&&others.some(o=>o!==d&&Math.hypot(o.p[0]-p[0],(o.p[1]-p[1])*2)<d.w*0.7))continue;
    d.p=p;d.how='settle'+pass;return true}
  return false}

/* ---------- эффекты острова (5.0) ----------
   Рисунок острова неподвижен; список того, что на нём движется, island.js кладёт в data-fx корневого <svg>:
   [вид, x, y, размер, цвет, сила] в единицах острова. g — свечение (лава, кристаллы, руны), e — искры, r — рябь,
   s — блёстки, m — дым, f — светлячки, o — пульс готового пузыря. Свечение берётся из готового спрайта по цвету,
   поэтому кадр с эффектами дешёвый. При «меньше движения» остаётся только ровное свечение без частиц. */
const FXG=new Map();
function rgba(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function glowSprite(col){let c=FXG.get(col);if(c)return c;c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,rgba(col,1));g.addColorStop(.3,rgba(col,.5));g.addColorStop(.65,rgba(col,.14));g.addColorStop(1,rgba(col,0));x.fillStyle=g;x.fillRect(0,0,64,64);FXG.set(col,c);return c}
function drawFx(ctx,list,V,dpr,W,H,t,still){
  const sc=V.s*dpr;if(!list||!list.length)return;
  ctx.setTransform(1,0,0,1,0,0);
  for(const f of list){const [k,x,y,a,col,s]=f,sx=(V.ox+x*V.s)*dpr,sy=(V.oy+y*V.s)*dpr,R=Math.max(8,a)*sc*2;
    if(sx<-R||sx>W+R||sy<-R*1.5||sy>H+R)continue;
    const ph=((x*0.137+y*0.071)%1+1)%1;
    if(k==='g'){const p=still?1:0.78+0.22*Math.sin(t*2.4+ph*6.3),r=a*sc;ctx.globalCompositeOperation='screen';ctx.globalAlpha=Math.min(1,(s||.5)*p);ctx.drawImage(glowSprite(col||'#FFE27A'),sx-r,sy-r,r*2,r*2);ctx.globalCompositeOperation='source-over';continue}
    if(still)continue;
    if(k==='e'){ctx.fillStyle=col||'#FFB347';for(let i=0;i<5;i++){const q=(t*0.42+i/5+ph)%1;ctx.globalAlpha=(1-q)*0.95;const px=sx+Math.sin(q*5.5+i*2.1)*a*sc*0.55,py=sy-q*44*sc,r=Math.max(0.6,(1.7-q)*1.1*sc);ctx.beginPath();ctx.arc(px,py,r,0,7);ctx.fill()}}
    else if(k==='r'){ctx.strokeStyle='#F2FEFF';ctx.lineWidth=Math.max(0.8,1.2*sc);for(let i=0;i<2;i++){const q=(t*0.3+i*0.5+ph)%1;ctx.globalAlpha=(1-q)*0.6;const rx=a*sc*(0.35+q*0.85);ctx.beginPath();ctx.ellipse(sx,sy,rx,rx*0.42,0,0,7);ctx.stroke()}}
    else if(k==='s'){ctx.strokeStyle=col||'#FFFFFF';ctx.fillStyle=col||'#FFFFFF';ctx.lineWidth=Math.max(0.7,1*sc);for(let i=0;i<4;i++){const tw=Math.sin(t*1.8+i*2.3+ph*9);if(tw<0.35)continue;
      const px=sx+Math.cos(i*2.4+ph*5)*a*sc,py=sy+Math.sin(i*1.9+ph*4)*a*sc*0.55,r=(2.2+i%2)*sc*(tw-0.2);ctx.globalAlpha=Math.min(1,(tw-0.35)/0.5);
      ctx.beginPath();ctx.moveTo(px-r,py);ctx.lineTo(px+r,py);ctx.moveTo(px,py-r*1.3);ctx.lineTo(px,py+r*1.3);ctx.stroke();ctx.beginPath();ctx.arc(px,py,Math.max(0.6,0.7*sc),0,7);ctx.fill()}}
    else if(k==='m'){ctx.fillStyle=col||'#8E868B';for(let i=0;i<3;i++){const q=(t*0.16+i/3+ph)%1;ctx.globalAlpha=(1-q)*(q<0.15?q/0.15:1)*0.3;const px=sx+Math.sin(q*3+i)*6*sc,py=sy-q*52*sc,r=(0.35+q*1.1)*a*sc;ctx.beginPath();ctx.arc(px,py,r,0,7);ctx.fill()}}
    else if(k==='f'){const gs=glowSprite(col||'#EFFF9A');for(let i=0;i<6;i++){const px=sx+Math.sin(t*0.45*(1+i*0.13)+i*7)*a*sc,py=sy+Math.cos(t*0.37*(1+i*0.17)+i*3)*a*0.5*sc,b=0.5+0.5*Math.sin(t*2.6+i*5);
      ctx.globalAlpha=0.35+0.55*b;ctx.globalCompositeOperation='screen';const r=5*sc;ctx.drawImage(gs,px-r,py-r,r*2,r*2);ctx.globalCompositeOperation='source-over';ctx.fillStyle='#FFFFE0';ctx.beginPath();ctx.arc(px,py,Math.max(0.6,0.9*sc),0,7);ctx.fill()}}
    else if(k==='o'){const q=(t*0.7+ph)%1,w=(a+q*16)*sc,h=(25+q*10)*sc;ctx.globalAlpha=(1-q)*0.7;ctx.strokeStyle=col||'#FFE27A';ctx.lineWidth=Math.max(1,2*sc);ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(sx-w/2,sy-h/2,w,h,h/2);else ctx.rect(sx-w/2,sy-h/2,w,h);ctx.stroke()}}
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over'}

/* ---------- слой ---------- */
const L={svg:null,cv:null,ctx:null,ds:new Map(),raf:0,last:0,acc:0,stats:{draw:[],frame:[],frames:0},get:null,map:null,mapKey:'',
  vis:true,io:null,ready:false,loading:null,dirty:true,camKey:'',fx:[],fxKey:'',camT:0,camDirty:false,t0:0};

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
  const full=svg.closest('.drg-world');
  if(full){full.querySelector('.drg-stage').after(cv);cv.classList.add('fs')}
  else svg.after(cv);
  L.cv=cv;L.ctx=cv.getContext('2d');L.dirty=true;
  if('IntersectionObserver' in root){L.io=new IntersectionObserver(es=>{L.vis=es.some(e=>e.isIntersecting);wake()});L.io.observe(svg)}
  sync();wake();
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
  if(!L.svg)return;
  const fs=L.svg.getAttribute('data-fx')||'';
  if(fs!==L.fxKey){L.fxKey=fs;try{L.fx=fs?JSON.parse(fs):[]}catch(e){L.fx=[]}L.dirty=true}
  if(!L.ready)return;
  const st=L.get&&L.get();if(!st)return;
  const I=root.ISL,D=root.DECO,key=JSON.stringify([st.bld.map(b=>[b.id,b.x,b.y,b.type]),st.land,st.clr||[]]);
  if(key!==L.mapKey){L.map=mapOf(st,D,I);L.mapKey=key;L.ds.forEach(d=>{d.settled=false;if(d.state==='walk'||d.state==='turn'){d.state='idle';d.wait=0.5;d.A.play('idle')}d.to=null})}
  const seen=new Set();
  L.svg.querySelectorAll('g.drg-dr[data-ix]').forEach(g=>{
    const id=g.dataset.dragon,dr=st.dragons.find(x=>x.id===id);if(!dr)return;seen.add(id);
    const home=[+g.dataset.ix,+g.dataset.iy],mode=g.dataset.mode;let d=L.ds.get(id);
    const ph=Object.assign(root.DRG.gamePhenotype(dr.genome),{academyRank:dr.academyRank||0}),pk=JSON.stringify([ph,root.MORPH.stageOf(dr.lvl)]);
    if(d&&d.pk!==pk){if(d.X)root.RIG.release(d.X);if(d.Xn)root.RIG.release(d.Xn);L.ds.delete(id);d=null}
    if(!d){d=make(id,dr,ph,pk,home,mode,+g.dataset.face||1);d.hid=g.dataset.home;L.ds.set(id,d)}
    else if(d.homeKey!==g.dataset.home+':'+home.join()||d.mode!==mode){d.home=home;d.p=home.slice();d.to=null;d.mode=mode;d.face=+g.dataset.face||1;d.state='idle';d.wait=1+d.rnd()*2;d.A.play('idle')}
    d.homeKey=g.dataset.home+':'+home.join();d.g=g;d.hid=g.dataset.home;
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
  const k0=ISLK*G.scale*(mode==='hab'?HABK:1),k=mode==='hab'?Math.min(k0,46/G.box.w,30/-G.box.y):k0,d={id,ph,pk,lvl:dr.lvl,M,G,A,rnd,k,home:home.slice(),p:home.slice(),to:null,mode,face,turn:0,
    w:G.box.w*k,h:-G.box.y*k,cx:G.box.x+G.box.w/2,state:'idle',wait:0.5+rnd()*3,X:null,Xn:null,px:0,ax:0};
  if(rnd()<0.3&&mode==='hab')A.t+=rnd()*3;
  return d}

/* ---------- поведение ---------- */
const night=()=>{const h=new Date().getHours();return h>=22||h<7};
function think(d,dt){
  const A=d.A,P=A.P;
  if(d.turn>0){d.turn=Math.max(0,d.turn-dt/0.32);if(d.turn===0)d.face=d.nface}
  if(d.cover)return;
  /* 4.2: страховка — дракон вольера никогда не стоит за бортиком: если оказался снаружи, возвращается во двор */
  if(d.mode==='hab'&&d.state!=='fly'&&yardOf(L.map,root.ISL,d)&&!yardHas(L.map,root.ISL,d,d.p)){d.to=null;d.state='idle';A.play('idle');settle(L.map,root.ISL,d,[...L.ds.values()]);return}
  if(d.state==='turn'){if(d.turn===0){d.state='walk';d.ax=A.x;A.play('walk')}return}
  /* полёт над своим двором: дракон поднимается, медленно перелетает к точке двора и садится */
  if(d.state==='fly'){
    if(d.to){const tx=d.to[0]-d.p[0],ty=d.to[1]-d.p[1],l=Math.hypot(tx,ty),st=Math.min(l,FLY_V*dt);
      if(l>0.5){d.p[0]+=tx/l*st;d.p[1]+=ty/l*st;const f=Math.sign(tx);if(f&&f!==d.face&&Math.abs(tx)>4)d.face=f}else d.to=null}
    d.wait-=dt;if(d.wait<=0&&!d.to){d.state='idle';A.play('idle');d.wait=2.5+d.rnd()*4}
    else if(d.wait<=0&&d.to){d.to=null}
    return}
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
  const dpr=Math.min(2,root.devicePixelRatio||1),px=pxStep(css*d.k/d.G.scale*1.3);   /* с запасом 30 %: при приближении камеры дракон не мылится до следующей ступени */
  if(d.px===px||d.loadPx===px)return;
  if(d.X&&performance.now()-L.camT<260)return;   /* камера движется: старая текстура, новая — когда жест закончится */
  d.loadPx=px;
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
  /* ночь тёмной темы (--isl-night из dragons.css): тот же лунный оттенок, что у острова; читается раз в 30 кадров */
  if(L.night==null||!(L.stats.frames%30)){try{L.night=(getComputedStyle(L.svg).getPropertyValue('--isl-night')||'').trim()}catch(e){L.night=''}}
  for(const d of list){
    if(d.art)d.art.classList.toggle('lv',!!d.X&&!d.cover);
    const x=(V.ox+d.p[0]*V.s)*dpr,y=(V.oy+d.p[1]*V.s)*dpr,z=V.s*dpr*d.k;
    if(x+d.w*V.s*dpr<0||x-d.w*V.s*dpr>W||y-d.h*V.s*dpr*1.2>H||y<-20)continue;   /* за краем экрана не рисуем */
    want(d,V.s);
    if(!d.X||d.cover||(d.g&&d.g.style.visibility==='hidden'))continue;
    ctx.save();
    const yard=yardOf(L.map,root.ISL,d);
    if(yard){const c=toIsle(root.ISL,yard.x+1,yard.y+1);ctx.setTransform(1,0,0,1,0,0);ctx.beginPath();ctx.ellipse((V.ox+c[0]*V.s)*dpr,(V.oy+(c[1]-8)*V.s)*dpr,61*V.s*dpr,40*V.s*dpr,0,0,Math.PI*2);ctx.clip()}
    /* контактная тень на траве, как у деревьев и камней острова: чуть сжимается, когда дракон приподнимается */
    const lift=Math.max(0,-(d.A.pose.body[5]||0))/d.A.P.h;
    ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=0.2;ctx.fillStyle='#000';ctx.beginPath();
    ctx.ellipse(x,y+z*2,d.w*V.s*dpr*0.42/(1+lift),d.w*V.s*dpr*0.07,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    const flip=d.turn>0?d.face*Math.cos((1-d.turn)*Math.PI):d.face;
    const view=[z*flip,0,0,z,x-z*flip*d.cx,y];
    root.RIG.draw(ctx,d.X,d.A.pose,view);
    root.RIG.drawFx(ctx,d.X,d.A.fx,view);ctx.restore()}
  ctx.setTransform(1,0,0,1,0,0);
  if(L.night&&L.night!=='transparent'){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=L.night;ctx.fillRect(0,0,W,H);ctx.globalCompositeOperation='source-over'}
  /* эффекты поверх драконов: свечение лавы и кристаллов подсвечивает и тех, кто стоит рядом */
  drawFx(ctx,L.fx,V,dpr,W,H,(performance.now()-L.t0)/1000,reduced());
  ctx.setTransform(1,0,0,1,0,0);
  L.camKey=[V.s.toFixed(4),V.ox.toFixed(1),V.oy.toFixed(1),W,H].join();
  const ms=performance.now()-t0;L.ema=L.ema==null?ms:L.ema*0.9+ms*0.1;L.stats.draw.push(ms);if(L.stats.draw.length>240)L.stats.draw.shift();L.stats.frames++;L.dirty=false}

function running(){return !L.broken&&L.svg&&L.svg.isConnected&&(L.ready||L.fx.length>0)&&L.vis&&!document.hidden&&!document.querySelector('.dri,.drf')}
function wake(){if(!L.raf&&running())L.raf=requestAnimationFrame(tick)}
function stop(){if(L.raf)cancelAnimationFrame(L.raf);L.raf=0;L.last=0}
function tick(ts){
  L.raf=0;if(!running()){L.last=0;return}
  /* при «меньше движения» цикл не крутится: кадр рисуется по запросу (камера сдвинулась, пришли текстуры), см. nudge */
  if(reduced()){const V=islandView(),key=[V.s.toFixed(4),V.ox.toFixed(1),V.oy.toFixed(1),Math.round(V.cw),Math.round(V.ch)].join();
    if(L.dirty||key!==L.lastKey){L.lastKey=key;draw()}L.last=0;return}
  L.raf=requestAnimationFrame(tick);
  const cm=L.camDirty;L.camDirty=false;
  const gap=Math.min(FPS_LOW,Math.max(FPS_MIN,(L.ema||0)/BUDGET));
  if(!cm&&L.last&&ts-L.last<gap-1)return;
  const dt=L.last?clamp((ts-L.last)/1000,0,0.1):1/30;if(L.last){L.stats.frame.push(ts-L.last);if(L.stats.frame.length>240)L.stats.frame.shift()}
  L.last=ts;
  /* ошибка кадра (4.1): живой слой выключается, остров остаётся с обычными рисунками драконов, страница работает дальше */
  try{if(L.ready)L.ds.forEach(d=>{think(d,dt);d.A.update(dt);place(d)});draw()}
  catch(e){console.warn('живой остров выключен из-за ошибки',e);L.broken=true;stop();if(L.svg)L.svg.querySelectorAll('g.drg-art.lv').forEach(g=>g.classList.remove('lv'));if(L.cv)L.cv.remove()}}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',wake);
  /* после осмотра и похода цикл продолжается: они живут вне острова, их закрытие удаляет .dri и .drf */
  new MutationObserver(()=>{if(!L.raf&&!document.querySelector('.dri,.drf'))wake()}).observe(document.documentElement,{childList:true,subtree:false});
  addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{if(!L.raf&&!document.querySelector('.dri,.drf'))wake()}).observe(document.body,{childList:true}))}

/* камера сдвинулась (ui.js, camApply): этот же кадр перерисовывает драконов и эффекты под новый вид */
function cam(){L.camT=performance.now();L.camDirty=true;L.dirty=true;wake();
  /* после жеста ещё один кадр: при «меньше движения» цикл стоит, а текстуры нужного размера берутся только после остановки */
  clearTimeout(L.camTO);L.camTO=setTimeout(()=>{L.dirty=true;L.lastKey='';wake()},300)}
const DRLIVE={scan,wake,cam,stats:()=>({dragons:L.ds.size,ema:L.ema,ready:L.ready,running:!!L.raf,attached:!!L.svg&&L.svg.isConnected,vis:L.vis,cv:!!L.cv&&L.cv.isConnected,frames:L.stats.frames,fx:L.fx.length,draw:L.stats.draw.slice(),frame:L.stats.frame.slice(),
  pos:[...L.ds.values()].map(d=>({id:d.id,p:d.p.slice(),state:d.state,face:d.face,tex:!!d.X,px:d.px,how:d.how||'',hid:hidden(L.map,d.p,d.w,d.h),home:d.hid,w:d.w,h:d.h,inside:d.mode!=='hab'||yardHas(L.map,root.ISL,d,d.p)}))}),
  PURE:{toGrid,toIsle,mapOf,hidden,pathFree,pickTarget,settle,inYard,yardTarget,yardHas,ISLK,HABK}};
if(typeof module!=='undefined'&&module.exports)module.exports=DRLIVE;else root.DRLIVE=DRLIVE;
})(typeof window!=='undefined'?window:globalThis);
