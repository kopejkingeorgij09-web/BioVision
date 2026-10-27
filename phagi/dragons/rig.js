/* Риг анимации: рисунок A, разрезанный на части, которые двигает поза из anim.js.
   Каждая часть — отдельный SVG из тех же слоёв (ART.svg с фильтром слоёв и обрезкой по разрезам), он растрируется
   один раз и обрезается по прозрачным полям; кадр собирается из готовых картинок матрицами позы.
   Туловище разрезано у бедра и у плеча: хвост и шея растрированы повёрнутыми вдоль своей оси и гнутся полосками,
   каждая полоска сдвигается и поворачивается по изгибу. Лапа разрезана над скакательным суставом (у передней над
   запястьем): верхнее звено поворачивается и сгибается, стопа стоит на земле. Новых форм риг не рисует.
   Текстуры лежат в общем кеше (texcache.js): кто рисует дракона, держит их через get/release, видимые не вытесняются. */
(function(root){
'use strict';
const ANIM=root.ANIM||(typeof require!=='undefined'?require('./anim.js'):null);
const {mul,app,inv,T,Rot}=ANIM.MAT;

const SPINE_PARTS=['body','skin','crest','metal'];
const isSpine=l=>SPINE_PARTS.includes(l.part)&&l.clip!=='head'&&!l.seg;
const ofSeg=k=>l=>l.seg===k;
const isHead=l=>(l.part==='head'||l.part==='eyes'||(l.part==='horns'&&l.paint!=='hornFar')||(l.part==='metal'&&l.clip==='head'))&&!l.rig;
const ofLeg=L=>l=>!!l.leg&&l.leg===L&&l.part!=='spurs';
const spurOf=L=>l=>l.part==='spurs'&&l.leg===L;

/* полуплоскость {p : (p − c)·n > off} как большой многоугольник для clipPath (в единицах рисунка) */
function half(c,n,off){
  const B=4000,t=[-n[1],n[0]],o=[c[0]+n[0]*off,c[1]+n[1]*off];
  const P=[[o[0]+t[0]*B,o[1]+t[1]*B],[o[0]-t[0]*B,o[1]-t[1]*B],[o[0]-t[0]*B+n[0]*B,o[1]-t[1]*B+n[1]*B],[o[0]+t[0]*B+n[0]*B,o[1]+t[1]*B+n[1]*B]];
  return 'M'+P.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join('L')+'Z'}
const neg=v=>[-v[0],-v[1]],unit=v=>{const l=Math.hypot(v[0],v[1])||1;return [v[0]/l,v[1]/l]};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const poly=P=>'M'+P.map(p=>p[0].toFixed(2)+' '+p[1].toFixed(2)).join('L')+'Z';
/* всё, кроме многоугольника (правило чётности: большой квадрат с дыркой) */
const outside=P=>'!M-4000 -4000H4000V4000H-4000Z'+poly(P);
const disc=(c,r)=>{const f=v=>v.toFixed(2);return `M${f(c[0]+r)} ${f(c[1])}A${f(r)} ${f(r)} 0 1 0 ${f(c[0]-r)} ${f(c[1])}A${f(r)} ${f(r)} 0 1 0 ${f(c[0]+r)} ${f(c[1])}Z`};

/* части в порядке рисования: имя, какие слои, обрезка, поворот вдоль оси для изгиба.
   У сустава нижняя часть заходит под верхнюю кругом (как шаровой сустав): при сгибе стык не открывается
   и прямой край разреза нигде не торчит. Шпора рисуется целиком поверх лапы и двигается со стопой. */
function partsOf(R,P){
  const tc=R.tailCut,nc=R.neckCut,out=[];
  const add=(name,only,o)=>out.push(Object.assign({name,only},o||{}));
  add('ground',l=>l.part==='shadow');
  add('aura',l=>l.part==='aura');
  add('wingFar',l=>l.part==='wings'&&!!l.far);
  const leg=L=>{const g=R.legs[L],n=unit([g.k[0]-g.h[0],g.k[1]-g.h[1]]),c=g.h;
    add(L+'f',ofLeg(L),{region:[[half(c,neg(n),0),disc(c,g.hr*1.15)]]});add(L+'u',ofLeg(L),{region:[half(c,n,0)]});
    add(L+'s',spurOf(L),{m:L+'f'})};
  leg('FH');leg('FF');
  add('headBack',l=>l.part==='collar'||(l.part==='horns'&&l.paint==='hornFar'));
  /* шипы гребня целиком: каждый со своим участком тела, без разреза; на хвосте и шее шип не гнётся полосками,
     а целиком встаёт по месту своего основания (pieces). Кончик хвоста (пламя, булава) так же целиком на конце */
  add('tailCr',ofSeg('tail'),{m:'tail',ax:P.tailAx,bend:'tail',pieces:'tail'});
  add('trunkCr',ofSeg('trunk'),{m:'trunk'});
  add('neckCr',ofSeg('neck'),{m:'neck',ax:P.neckAx,bend:'neck',pieces:'neck'});
  add('tailTip',l=>l.part==='tailEnd'||l.part==='mace',{m:'tail',ax:P.tailAx,bend:'tail',pieces:'tip'});
  /* хвост и шея: за разрезом (с кругом у стыка), но только внутри трубки вдоль позвоночника; туловище — остальное */
  add('tail',isSpine,{region:[[half(tc.p,neg(tc.d),0),disc(tc.p,tc.r*1.05)],poly(R.tailTube)],ax:P.tailAx,bend:'tail'});
  add('neck',isSpine,{region:[[half(nc.p,nc.d,0),disc(nc.p,nc.r*1.05)],poly(R.neckTube)],ax:P.neckAx,bend:'neck'});
  add('trunk',isSpine,{region:[[half(tc.p,tc.d,0),outside(R.tailTube)],[half(nc.p,neg(nc.d),0),outside(R.neckTube)]]});
  leg('NH');leg('NF');
  add('head',isHead);
  add('lid',l=>!!l.rig,{rig:true});
  add('wingNear',l=>l.part==='wings'&&!l.far);
  add('breath',l=>l.part==='breath');
  return out}

/* выпуклая оболочка точек пути (все числа d попарно, опорные точек кривых тоже) с запасом m на обводку */
function hullOf(d,m){
  const n=(d.match(/-?\d*\.?\d+(?:e-?\d+)?/g)||[]).map(Number),P=[];
  for(let i=0;i+1<n.length;i+=2)P.push([n[i],n[i+1]]);
  P.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);if(P.length<3)return null;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const p of P){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
  for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  const H=lo.slice(0,-1).concat(up.slice(0,-1)),k=H.length;
  /* обход против часовой (в осях рисунка y вниз — по часовой на экране): наружная нормаль ребра a→b = (dy, −dx) */
  return H.map((p,i)=>{const a=H[(i+k-1)%k],b=H[(i+1)%k],e1=unit([p[0]-a[0],p[1]-a[1]]),e2=unit([b[0]-p[0],b[1]-p[1]]);
    const n1=[e1[1],-e1[0]],n2=[e2[1],-e2[0]],bi=unit([n1[0]+n2[0],n1[1]+n2[1]]),c=Math.max(0.35,dot(bi,n1));
    return [p[0]+bi[0]*m/c,p[1]+bi[1]*m/c]})}

/* ---------- подготовка текстур (нужен браузер) ----------
   opt: px — CSS-пикселей на единицу экрана рисунка A, dpr — плотность экрана. */
async function make(M,opt){
  opt=opt||{};
  const ART=root.ART,SHAPE=root.SHAPE,SPR=root.SPR,t0=(root.performance||Date).now();
  const G=SHAPE.build(M),R=G.rig,P=ANIM.profile(M,R),s=G.scale,k=(opt.px||1)*(opt.dpr||1),sig=s*k;
  const fr=ART.frameOf(G,{pad:opt.pad==null?10:opt.pad}),tx=fr.tx;
  const frame=(vb)=>{const W=Math.ceil(vb[2]*k),H=Math.ceil(vb[3]*k);return {vb:[vb[0],vb[1],W/k,H/k],W,H}};
  const main=frame(fr.vb);
  const defs=partsOf(R,P);
  const jobs=defs.map(d=>{
    let f=main,F=[sig,0,0,sig,(tx-main.vb[0])*k,-main.vb[1]*k],turn=null;
    if(d.ax){
      /* повернуть так, чтобы ось хвоста (шеи) смотрела вправо: полоски режутся по столбцам картинки */
      const th=-Math.atan2(d.ax.a[1],d.ax.a[0]),c=d.ax.c,Rc=Rot(th,c),b=G.box;
      const pts=[[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].map(p=>app(Rc,p)).map(p=>[p[0]*s+tx,p[1]*s]);
      const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),pad=12;
      f=frame([Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)-Math.min(...xs)+2*pad,Math.max(...ys)-Math.min(...ys)+2*pad]);
      F=mul([sig,0,0,sig,(tx-f.vb[0])*k,-f.vb[1]*k],Rc);turn={deg:th*180/Math.PI,c}}
    const str=ART.svg(M,{geom:G,frame:f.vb,width:f.W,key:'r'+d.name,only:d.only,rig:!!d.rig,region:d.region,turn,label:d.name});
    return SPR.load(str).then(img=>({d,f,F,img}))});
  const loaded=await Promise.all(jobs);
  const parts={},order=[];
  loaded.forEach(({d,f,F,img})=>{
    const tr=SPR.trim(img,f.W,f.H),p=Object.assign(tr,{name:d.name,F,bend:d.bend||null,ax:d.ax||null});
    p.Fi=mul(inv(F),T(tr.x,tr.y));   /* пиксель обрезанного холста → точка рисунка в покое */
    if(d.ax){const q=app(F,d.ax.c);p.cutX=q[0]-tr.x;p.cutY=q[1]-tr.y}
    if(d.m)p.m=d.m;
    if(d.pieces&&p.cv)p.pieces=piecesOf(G,R,d,p);
    parts[d.name]=p;if(p.cv)order.push(p)});
  const PA=root.MORPH.paints(M),pal=M.pal;
  const puff=M.breath==='smoke'?'#9C9AA8':M.breath==='element'?PA[{F:'fireOuter',W:'water',T:'earth',A:'air',P:'flora',L:'light',D:'dark'}[M.elements[0]]]:null;
  const bytes=order.reduce((a,p)=>a+p.w*p.h*4,0);
  return {parts,order,R,P,sig,k,s,px:opt.px||1,dpr:opt.dpr||1,bytes,ms:(root.performance||Date).now()-t0,
    fx:{puff,spark:pal.glow||'#FFE07A',dust:'#B8A68C',food:'#E2553A',leaf:'#4E9A4A',z:pal.deep}}}

/* куски, которые не гнутся: u — где по оси хвоста (шеи) стоит основание, обрезка — оболочка шипа в единицах рисунка
   и прямоугольник текстуры под ней */
function piecesOf(G,R,d,p){
  const ax=d.ax,box=pts=>{const q=pts.map(v=>app(p.F,v)),xs=q.map(v=>v[0]-p.x),ys=q.map(v=>v[1]-p.y);
    const x0=Math.max(0,Math.floor(Math.min(...xs))-2),y0=Math.max(0,Math.floor(Math.min(...ys))-2);
    return {sx:x0,sy:y0,sw:Math.min(p.w,Math.ceil(Math.max(...xs))+2)-x0,sh:Math.min(p.h,Math.ceil(Math.max(...ys))+2)-y0}};
  if(d.pieces==='tip')return [{u:dot([R.tailTip[0]-ax.c[0],R.tailTip[1]-ax.c[1]],ax.a),path:null,sx:0,sy:0,sw:p.w,sh:p.h}];
  const L=G.layers.find(l=>l.seg===d.pieces&&l.pieces);if(!L)return null;
  const out=[];
  L.pieces.forEach(pc=>{const H=hullOf(pc.d,1.6);if(!H)return;const r=box(H);if(r.sw<=0||r.sh<=0)return;
    const path=typeof Path2D!=='undefined'?new Path2D('M'+H.map(v=>v[0].toFixed(2)+' '+v[1].toFixed(2)).join('L')+'Z'):null;
    out.push(Object.assign({u:dot([pc.q[0]-ax.c[0],pc.q[1]-ax.c[1]],ax.a),path},r))});
  return out}

/* ---------- кадр ----------
   view: матрица «единицы рисунка в мире → пиксели холста» (VIEW помогает её собрать). */
const STRIP=6;   /* ширина полоски изгиба в пикселях текстуры */
function draw(ctx,X,pose,view){
  ctx.save();
  for(const p of X.order){
    const M=pose.mat[p.m||p.name];if(!M)continue;
    let a=1;
    if(p.name==='ground')a=pose.alpha.ground;else if(p.name==='breath')a=pose.alpha.breath;else if(p.name==='lid'){if(pose.lid<0.02)continue}
    if(a<0.01)continue;ctx.globalAlpha=a;
    const base=mul(view,M);
    if(!p.bend){const m=mul(base,p.Fi);ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,0,0);continue}
    if(p.pieces){const bp=pose.bend[p.bend],ax=p.ax;
      for(const q of p.pieces){const c=ANIM.curl(ax,bp,Math.max(0,q.u)),m0=mul(base,mul(T(c.d[0],c.d[1]),Rot(c.ang,[ax.c[0]+ax.a[0]*q.u,ax.c[1]+ax.a[1]*q.u])));
        ctx.save();ctx.setTransform(m0[0],m0[1],m0[2],m0[3],m0[4],m0[5]);if(q.path)ctx.clip(q.path);
        const m=mul(m0,p.Fi);ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,q.sx,q.sy,q.sw,q.sh,q.sx,q.sy,q.sw,q.sh);ctx.restore()}
      continue}
    /* хвост и шея: всё до разреза и у самого разреза без изгиба одним куском, дальше полосками */
    const bp=pose.bend[p.bend],ax=p.ax,sig=X.sig,x0=Math.max(0,Math.min(p.w,Math.floor(p.cutX)));
    if(x0>0){const m=mul(base,p.Fi);ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,0,0,x0+1,p.h,0,0,x0+1,p.h)}
    /* полоска чуть шире шага: стык закрыт соседней; на сильном изгибе внешний край расходится, нахлёст больше */
    const hmax=Math.max(p.cutY,p.h-p.cutY);
    for(let x=x0;x<p.w;x+=STRIP){
      const w=Math.min(STRIP,p.w-x),u=(x+w/2-p.cutX)/sig,c=ANIM.curl(ax,bp,Math.max(0,u)),cm=mul(T(c.d[0],c.d[1]),Rot(c.ang,[ax.c[0]+ax.a[0]*u,ax.c[1]+ax.a[1]*u]));
      const nx=ANIM.curl(ax,bp,Math.max(0,u+STRIP/sig)).ang,ov=1.5+Math.min(8,Math.abs(nx-c.ang)*hmax);
      const m=mul(base,mul(cm,p.Fi)),ww=Math.min(w+ov,p.w-x);
      ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,x,0,ww,p.h,x,0,ww,p.h)}}
  ctx.globalAlpha=1;ctx.setTransform(view[0],view[1],view[2],view[3],view[4],view[5]);
  if(pose.food)drawFood(ctx,X,pose.food);
  ctx.restore()}

function drawFood(ctx,X,f){
  const r=X.P.h*0.075;ctx.globalAlpha=f.a;
  ctx.fillStyle=X.fx.food;ctx.beginPath();ctx.arc(f.x,f.y,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(f.x-r*0.35,f.y-r*0.35,r*0.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=X.fx.leaf;ctx.beginPath();ctx.ellipse(f.x+r*0.4,f.y-r*1.05,r*0.5,r*0.22,-0.6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}

/* частицы аниматора (anim.fx): в той же матрице мира */
function drawFx(ctx,X,fx,view,ink){
  if(!fx.length)return;
  ctx.save();ctx.setTransform(view[0],view[1],view[2],view[3],view[4],view[5]);
  for(const p of fx){const q=p.age/p.life,a=1-q;
    if(p.k==='puff'){if(!X.fx.puff)continue;ctx.globalAlpha=0.7*a;ctx.fillStyle=X.fx.puff;ctx.beginPath();ctx.arc(p.x,p.y,p.r+p.grow*q,0,Math.PI*2);ctx.fill()}
    else if(p.k==='dust'){ctx.globalAlpha=0.35*a;ctx.fillStyle=X.fx.dust;ctx.beginPath();ctx.arc(p.x,p.y,p.r+p.grow*q,0,Math.PI*2);ctx.fill()}
    else if(p.k==='spark'){ctx.globalAlpha=a;ctx.strokeStyle=X.fx.spark;ctx.lineWidth=p.r*0.5;ctx.lineCap='round';const v=Math.hypot(p.vx,p.vy)||1;
      ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx/v*p.r*3,p.y-p.vy/v*p.r*3);ctx.stroke()}
    else if(p.k==='crumb'){ctx.globalAlpha=a;ctx.fillStyle=X.fx.food;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill()}
    else if(p.k==='z'){ctx.globalAlpha=Math.min(1,q*4)*a;ctx.fillStyle=ink||X.fx.z;ctx.font=`600 ${(p.r*(1+q)).toFixed(1)}px system-ui,sans-serif`;ctx.fillText('z',p.x,p.y)}}
  ctx.restore()}

/* матрица вида: мир (единицы рисунка этого дракона) → пиксели холста; земля на высоте gy, точка мира camX в x0 */
function VIEW(X,o){const z=X.s*(o.px||X.px)*(o.dpr||X.dpr);return [z,0,0,z,o.x0-z*(o.camX||0),o.gy]}

/* ---------- кеш ---------- */
const TEX=()=>root.DRTEX.shared;
function keyOf(ph,lvl,opt){const p=Object.assign({},ph);delete p.spanM;return 'rig:'+JSON.stringify([p,root.MORPH.stageOf(lvl),opt.px||1,opt.dpr||1])}
function get(ph,lvl,opt){opt=opt||{};const k=keyOf(ph,lvl,opt);
  return TEX().acquire(k,()=>make(root.MORPH.morph(ph,lvl),opt).then(X=>{X.key=k;return X}))}
function release(X){if(X&&X.key)TEX().release(X.key)}

const RIG={partsOf,make,draw,drawFx,VIEW,get,release,keyOf,isSpine,isHead,hullOf};
if(typeof module!=='undefined'&&module.exports)module.exports=RIG;else root.RIG=RIG;
})(typeof window!=='undefined'?window:globalThis);
