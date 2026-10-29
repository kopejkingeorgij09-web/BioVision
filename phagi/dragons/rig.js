/* Риг анимации: рисунок A, разрезанный на части, которые двигает поза из anim.js.
   Каждая часть — отдельный SVG из тех же слоёв (ART.svg с фильтром слоёв и обрезкой по разрезам), он растрируется
   один раз и обрезается по прозрачным полям; кадр собирается из готовых картинок матрицами позы.
   Туловище разрезано у бедра и у плеча: хвост и шея растрированы повёрнутыми вдоль своей оси и гнутся сеткой
   из треугольников (столбцы через MESH пикселей, каждый столбец стоит по изгибу, между ними картинка тянется
   без разрывов). Лапа разрезана в колене (у передней в локте) и над скакательным суставом (над запястьем):
   бедро и голень поворачиваются, стопа стоит на земле. Новых форм риг не рисует.
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
  /* лапа из трёх кусков: бедро (u), голень (k) от колена до скакательного сустава, стопа (f). Колено режется
     по биссектрисе между бедром и голенью; голень заходит под бедро кругом, стопа под голень */
  const leg=L=>{const g=R.legs[L],n=unit([g.k[0]-g.h[0],g.k[1]-g.h[1]]),c=g.h;
    const nk=unit([unit([g.k[0]-g.a[0],g.k[1]-g.a[1]])[0]+unit([g.h[0]-g.k[0],g.h[1]-g.k[1]])[0],unit([g.k[0]-g.a[0],g.k[1]-g.a[1]])[1]+unit([g.h[0]-g.k[0],g.h[1]-g.k[1]])[1]]);
    add(L+'f',ofLeg(L),{region:[[half(c,neg(n),0),disc(c,g.hr*1.15)]]});
    add(L+'s',spurOf(L),{m:L+'f'});
    add(L+'k',ofLeg(L),{region:[half(c,n,0),[half(g.k,nk,0),disc(g.k,(g.kr||g.hr*1.3)*1.15)]]});
    add(L+'u',ofLeg(L),{region:[half(c,n,0),half(g.k,neg(nk),0)]})};
  leg('FH');leg('FF');
  add('headBack',l=>l.part==='collar'||(l.part==='horns'&&l.paint==='hornFar'));
  /* шипы гребня целиком: каждый со своим участком тела, без разреза; на хвосте и шее шип не гнётся полосками,
     а целиком встаёт по месту своего основания (pieces). Кончик хвоста (пламя, булава) так же целиком на конце */
  add('tailCr',ofSeg('tail'),{m:'tail',ax:P.tailAx,bend:'tail',pieces:'tail'});
  add('trunkCr',ofSeg('trunk'),{m:'trunk'});
  add('neckCr',ofSeg('neck'),{m:'neck',ax:P.neckAx,bend:'neck',pieces:'neck'});
  add('tailTip',l=>l.part==='tailEnd'||l.part==='mace',{m:'tail',ax:P.tailAx,bend:'tail',pieces:'tip'});
  /* хвост и шея: за разрезом (с кругом у стыка), но только внутри трубки вдоль позвоночника; туловище — остальное */
  /* за трубкой туловищу остаются только холка, грудь и круп у самого разреза (круг RB); то, что дальше вылезло за трубку
     (гребень шеи на изгибе), уходит с шеей, иначе при сгибе на старом месте висят обрывки контура */
  const RB=1.9,far=(c,r)=>'!M-4000 -4000H4000V4000H-4000Z'+disc(c,r);
  const W=(a,b)=>R[a]||R[b];
  add('tail',isSpine,{region:[[half(tc.p,neg(tc.d),-2.5),disc(tc.p,tc.r*1.05),poly(W('tailFromW','tailTube'))],[poly(W('tailTubeW','tailTube')),far(tc.p,tc.r*RB)]],ax:P.tailAx,bend:'tail'});
  add('neck',isSpine,{region:[[half(nc.p,nc.d,-2.5),disc(nc.p,nc.r*1.05),poly(W('neckFromW','neckTube'))],[poly(W('neckTubeW','neckTube')),far(nc.p,nc.r*RB)]],ax:P.neckAx,bend:'neck'});
  const tr=[[half(tc.p,tc.d,0),outside(R.tailTube)],[half(nc.p,neg(nc.d),0),outside(R.neckTube)],
    [half(tc.p,tc.d,0),disc(tc.p,tc.r*RB)],[half(nc.p,neg(nc.d),0),disc(nc.p,nc.r*RB)]];
  if(R.neckFrom)tr.push(outside(R.neckFrom),outside(R.tailFrom));
  add('trunk',isSpine,{region:tr});
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
   opt: px — CSS-пикселей на единицу экрана рисунка A, dpr — плотность экрана.
   opt.part — только слои одной части тела (поле of или part слоя): маска для подсветки при осмотре,
   она двигается той же позой, что и весь дракон. Части рига без подходящих слоёв не растрируются. */
async function make(M,opt){
  opt=opt||{};
  const ART=root.ART,SHAPE=root.SHAPE,SPR=root.SPR,t0=(root.performance||Date).now();
  const G=SHAPE.build(M),R=G.rig,P=ANIM.profile(M,R),s=G.scale,k=(opt.px||1)*(opt.dpr||1),sig=s*k;
  const fr=ART.frameOf(G,{pad:opt.pad==null?10:opt.pad}),tx=fr.tx;
  const frame=(vb)=>{const W=Math.ceil(vb[2]*k),H=Math.ceil(vb[3]*k);return {vb:[vb[0],vb[1],W/k,H/k],W,H}};
  const main=frame(fr.vb);
  const defs=partsOf(R,P);
  if(opt.part){const k=opt.part;defs.forEach(d=>{const o=d.only;d.only=l=>o(l)&&(l.of||l.part)===k})}
  const jobs=defs.map(d=>{
    if(!G.layers.some(l=>(!l.rig||d.rig)&&d.only(l)))return Promise.resolve({d,f:main,F:null,img:null});
    let f=main,F=[sig,0,0,sig,(tx-main.vb[0])*k,-main.vb[1]*k],turn=null;
    if(d.ax){
      /* повернуть так, чтобы ось хвоста (шеи) смотрела вправо: столбцы сетки изгиба идут по столбцам картинки */
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
    if(!img){parts[d.name]={cv:null,x:0,y:0,w:0,h:0,name:d.name};return}
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
function draw(ctx,X,pose,view,o){
  if(X.fullArt){const im=X.fullArt,b=X.artBox,k=Math.min(b.w/im.width,b.h/im.height),w=im.width*k,h=im.height*k,m=mul(view,pose.body||[1,0,0,1,0,0]);ctx.save();ctx.globalAlpha=(o&&o.alpha!=null?o.alpha:1)*.22;ctx.setTransform(...view);ctx.fillStyle='#10202D';ctx.beginPath();ctx.ellipse(b.x+b.w/2,b.y+b.h,w*.35,Math.max(1,h*.035),0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=o&&o.alpha!=null?o.alpha:1;ctx.setTransform(...m);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";ctx.drawImage(im,b.x+(b.w-w)/2,b.y+b.h-h,w,h);ctx.restore();return}

  const K=o&&o.alpha!=null?o.alpha:1;
  ctx.save();
  for(const p of X.order){
    const M=pose.mat[p.m||p.name];if(!M)continue;
    let a=1;
    if(p.name==='ground')a=pose.alpha.ground;else if(p.name==='breath')a=pose.alpha.breath;else if(p.name==='lid'){if(pose.lid<0.02)continue}
    a*=K;if(a<0.01)continue;ctx.globalAlpha=a;
    const base=mul(view,M);
    if(!p.bend){const m=mul(base,p.Fi);ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,0,0);continue}
    if(p.pieces){const bp=pose.bend[p.bend],ax=p.ax;
      for(const q of p.pieces){const c=ANIM.curl(ax,bp,Math.max(0,q.u)),m0=mul(base,mul(T(c.d[0],c.d[1]),Rot(c.ang,[ax.c[0]+ax.a[0]*q.u,ax.c[1]+ax.a[1]*q.u])));
        ctx.save();ctx.setTransform(m0[0],m0[1],m0[2],m0[3],m0[4],m0[5]);if(q.path)ctx.clip(q.path);
        const m=mul(m0,p.Fi);ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,q.sx,q.sy,q.sw,q.sh,q.sx,q.sy,q.sw,q.sh);ctx.restore()}
      continue}
    /* хвост и шея: всё до разреза одним куском, дальше сетка из треугольников по изгибу (bent) */
    bent(ctx,p,base,pose.bend[p.bend],X.sig)}
  ctx.globalAlpha=K;ctx.setTransform(view[0],view[1],view[2],view[3],view[4],view[5]);
  if(pose.food)drawFood(ctx,X,pose.food);
  ctx.restore()}

/* изогнутая часть сеткой: в каждом столбце строки до оси и после;
   вершина (x, y) текстуры уезжает туда же, куда точка оси на расстоянии u = (x − разрез)/sig (colMat), поэтому соседние
   ячейки делят рёбра и между ними нет щелей: выпуклая сторона растягивается, вогнутая сжимается, как кожа.
   Начало части до разреза рисуется неизогнутым (FILL — запас за разрез, сейчас ноль: сетка от разреза сплошная).
   Столбцы ставятся не чаще MESH пикселей и только там, где изгиб успел повернуть ось больше чем на TOL радиана с прошлого
   столбца: почти прямая шея в покое рисуется двумя-тремя ячейками, а не десятками (каждый треугольник — своя обрезка). */
const MESH=8,FILL=0,GROW=0.75,TOL=0.03;
function bent(ctx,p,base,bp,sig){
  const ax=p.ax,x0=Math.max(0,Math.min(p.w,Math.floor(p.cutX)));
  const xf=Math.min(p.w,Math.ceil(p.cutX+FILL*ax.L*sig));
  const m=mul(base,p.Fi);ctx.setTransform(m[0],m[1],m[2],m[3],m[4],m[5]);ctx.drawImage(p.cv,0,0,xf,p.h,0,0,xf,p.h);
  if(x0>=p.w)return;
  const cy=Math.max(1,Math.min(p.h-1,p.cutY)),rows=[0,cy,p.h],cand=[];
  for(let x=x0;x<p.w;x+=MESH)cand.push(x);cand.push(p.w);
  const CM=cand.map(x=>{const u=(x-p.cutX)/sig,C=ANIM.colMat(ax,bp,Math.max(0,u));return {x,C,a:Math.atan2(C[1],C[0])}});
  const cols=[CM[0]];for(let i=1;i<CM.length;i++){const c=CM[i];if(i===CM.length-1||Math.abs(c.a-cols[cols.length-1].a)>TOL)cols.push(c)}
  /* изгиба нет совсем: вся часть одной картинкой */
  if(cols.length===2&&Math.abs(cols[1].a-cols[0].a)<0.002&&Math.abs(cols[0].a)<0.002){
    const M=mul(base,mul(cols[1].C,p.Fi));ctx.setTransform(M[0],M[1],M[2],M[3],M[4],M[5]);ctx.drawImage(p.cv,x0,0,p.w-x0,p.h,x0,0,p.w-x0,p.h);return}
  const V=cols.map(({x,C})=>{const M=mul(base,mul(C,p.Fi));return rows.map(y=>app(M,[x,y]))});
  cols.forEach((c,i)=>cols[i]=c.x);
  for(let i=0;i+1<cols.length;i++)for(let j=0;j+1<rows.length;j++){
    const a=[cols[i],rows[j]],b=[cols[i+1],rows[j]],c=[cols[i+1],rows[j+1]],d=[cols[i],rows[j+1]];
    tri(ctx,p.cv,a,b,c,V[i][j],V[i+1][j],V[i+1][j+1]);tri(ctx,p.cv,a,c,d,V[i][j],V[i+1][j+1],V[i][j+1])}}
/* треугольник текстуры s0 s1 s2 в треугольник холста d0 d1 d2: обрезка по чуть расширенному треугольнику (GROW пикселя,
   чтобы сглаживание краёв обрезки не оставляло просветов на общих рёбрах) и аффинная матрица */
function tri(ctx,img,s0,s1,s2,d0,d1,d2){
  const ux=s1[0]-s0[0],uy=s1[1]-s0[1],vx=s2[0]-s0[0],vy=s2[1]-s0[1],den=ux*vy-vx*uy;if(Math.abs(den)<1e-9)return;
  const px=d1[0]-d0[0],py=d1[1]-d0[1],qx=d2[0]-d0[0],qy=d2[1]-d0[1];
  const a=(px*vy-qx*uy)/den,b=(py*vy-qy*uy)/den,c=(qx*ux-px*vx)/den,d=(qy*ux-py*vx)/den,e=d0[0]-a*s0[0]-c*s0[1],f=d0[1]-b*s0[0]-d*s0[1];
  const [A,B,C]=grow([d0,d1,d2]);
  const sx=Math.max(0,Math.floor(Math.min(s0[0],s1[0],s2[0]))-1),sy=Math.max(0,Math.floor(Math.min(s0[1],s1[1],s2[1]))-1);
  const sw=Math.min(img.width,Math.ceil(Math.max(s0[0],s1[0],s2[0]))+1)-sx,sh=Math.min(img.height,Math.ceil(Math.max(s0[1],s1[1],s2[1]))+1)-sy;
  if(sw<=0||sh<=0)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(B[0],B[1]);ctx.lineTo(C[0],C[1]);ctx.closePath();ctx.clip();
  ctx.setTransform(a,b,c,d,e,f);ctx.drawImage(img,sx,sy,sw,sh,sx,sy,sw,sh);ctx.restore()}

/* треугольник, у которого каждое ребро сдвинуто наружу на GROW (острые углы не дальше 3·GROW) */
function grow(P){
  const o=(P[1][0]-P[0][0])*(P[2][1]-P[0][1])-(P[1][1]-P[0][1])*(P[2][0]-P[0][0])>0?1:-1;
  const nrm=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [o*dy/l,-o*dx/l]};
  const N=[nrm(P[0],P[1]),nrm(P[1],P[2]),nrm(P[2],P[0])];
  return P.map((p,i)=>{const n1=N[(i+2)%3],n2=N[i],k=1+n1[0]*n2[0]+n1[1]*n2[1],s=Math.min(3,1/Math.max(k,1e-3))*GROW;
    return [p[0]+(n1[0]+n2[0])*s,p[1]+(n1[1]+n2[1])*s]})}

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
function keyOf(ph,lvl,opt){const p=Object.assign({},ph);delete p.spanM;return 'rig:'+JSON.stringify([p,root.MORPH.stageOf(lvl),opt.px||1,opt.dpr||1])+(opt.part?':'+opt.part:'')}
function get(ph,lvl,opt){opt=opt||{};const k=keyOf(ph,lvl,opt);
  if(root.DRELEMENT)return TEX().acquire(k,async()=>{const M=root.MORPH.morph(ph,lvl),G=root.SHAPE.build(M),art=await root.DRELEMENT.prepare(ph,lvl);return {key:k,fullArt:art,artBox:G.box,R:G.rig,P:root.ANIM.profile(M,G.rig),s:G.scale,px:opt.px||1,dpr:opt.dpr||1,parts:{},order:[],bytes:0,ms:0,fx:{puff:root.DRAW.EL_COL[ph.elements[0]]||'#A3A3A3',spark:'#FFE07A',dust:'#B8A68C',food:'#E2553A',z:'#24333C'}}});
  return TEX().acquire(k,()=>make(root.MORPH.morph(ph,lvl),opt).then(async X=>{X.key=k;if(root.DRELEMENT){X.fullArt=await root.DRELEMENT.prepare(ph,lvl);X.artBox=root.SHAPE.build(root.MORPH.morph(ph,lvl)).box}return X}))}
function release(X){if(X&&X.key)TEX().release(X.key)}

const RIG={partsOf,make,draw,drawFx,VIEW,get,release,keyOf,isSpine,isHead,hullOf};
if(typeof module!=='undefined'&&module.exports)module.exports=RIG;else root.RIG=RIG;
})(typeof window!=='undefined'?window:globalThis);
