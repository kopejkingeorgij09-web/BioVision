/* Драконы 6.0: живой рисунок дракона.
   Тело (рисунок стихии или гибрида) натянуто на сетку и гнётся по скелету: дыхание, хвост, голова, лапы.
   Крылья второй стихии крепятся к плечу и машут. Состояния: idle, walk, fly, attack, hit, win, sleep.
   Опорные точки готовит dev/build_art6.py (art6/manifest.js). Урон и правила здесь не считаются. */
(function(root){'use strict';
const ELS=['F','W','T','A','P','L','D'];
const COL={F:'#ff6a1e',W:'#28aaf0',T:'#f0a028',A:'#c8e6ff',P:'#78d246',L:'#ffe178',D:'#a050ff'};
const NAME={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const STATES=['idle','walk','fly','attack','hit','win','sleep'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),sm=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
let BASE='';
function man(){return root.DR6ART_MANIFEST}
// ключ рисунка тела: стихии по порядку ELS, не больше трёх (мифических рисуем позже)
function bodyKey(els){const u=[...new Set(els)].filter(e=>ELS.includes(e)).sort((a,b)=>ELS.indexOf(a)-ELS.indexOf(b));return u.slice(0,3).join('')||'F'}
function wingKey(els){return els[1]||els[0]||'F'}

const cache=new Map();
function img(path){let r=cache.get(path);if(r)return r;
 r={ok:false,im:null,cv:null};cache.set(path,r);
 if(typeof Image==='undefined')return r;
 const im=new Image();im.decoding='async';im.onload=()=>{r.im=im;r.ok=true;r.cb&&r.cb.forEach(f=>f())};im.src=BASE+path;return r}
function preload(els,cb){const k=bodyKey(els),w=wingKey(els),list=[img('art6/b/'+k+'.webp'),img('art6/w/'+w+'.webp')];
 let left=list.filter(r=>!r.ok).length;if(!left){cb&&cb();return}
 list.forEach(r=>{if(!r.ok)(r.cb||(r.cb=[])).push(()=>{if(!--left&&cb)cb()})})}

// сетка: плотнее у головы и хвоста, где изгиб сильнее
function grid(n){if(n<=6)return {xs:[0,.2,.4,.6,.75,.88,1],ys:[0,.3,.6,.8,1]};
 return {xs:[0,.06,.12,.18,.25,.32,.4,.48,.56,.62,.68,.73,.78,.83,.87,.91,.95,1],ys:[0,.08,.16,.24,.32,.4,.5,.6,.7,.78,.86,.93,1]}}
const meshes=new Map();
function mesh(key,im,n){const id=key+'|'+n;let m=meshes.get(id);if(m)return m;
 const {xs,ys}=grid(n),verts=[],tri=[],cols=xs.length;for(const v of ys)for(const u of xs)verts.push([u,v]);
 let data=null,w=0,h=0;
 try{const c=document.createElement('canvas');w=c.width=Math.min(256,im.width);h=c.height=Math.round(im.height*w/im.width);
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);data=x.getImageData(0,0,w,h).data}catch(e){data=null}
 for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){let vis=!data;
  if(data)for(let y=Math.floor(ys[j]*h);y<Math.ceil(ys[j+1]*h)&&!vis;y+=2)for(let x=Math.floor(xs[i]*w);x<Math.ceil(xs[i+1]*w);x+=2)if(data[(y*w+x)*4+3]>8){vis=true;break}
  if(vis){const a=j*cols+i,b=a+1,c=a+cols,d=c+1;tri.push([a,b,d],[a,d,c])}}
 m={verts,tri};meshes.set(id,m);return m}

function tri(ctx,im,W,H,p,q,r,a,b,c){
 const det=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(Math.abs(det)<1e-12)return;
 const A=((b[0]-a[0])*(r[1]-p[1])-(c[0]-a[0])*(q[1]-p[1]))/det,B=((b[1]-a[1])*(r[1]-p[1])-(c[1]-a[1])*(q[1]-p[1]))/det;
 const C=((c[0]-a[0])*(q[0]-p[0])-(b[0]-a[0])*(r[0]-p[0]))/det,D=((c[1]-a[1])*(q[0]-p[0])-(b[1]-a[1])*(r[0]-p[0]))/det;
 const mx=(a[0]+b[0]+c[0])/3,my=(a[1]+b[1]+c[1])/3;
 ctx.save();ctx.beginPath();
 // треугольник чуть раздут, чтобы между соседями не было щелей
 for(let i=0;i<3;i++){const v=i?i===1?b:c:a,dx=v[0]-mx,dy=v[1]-my,l=Math.hypot(dx,dy)||1;const x=v[0]+dx/l*.0035,y=v[1]+dy/l*.0035;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
 ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,a[0]-A*p[0]-C*p[1],a[1]-B*p[0]-D*p[1]);ctx.drawImage(im,0,0,1,1);ctx.restore()}

/* Поза: из состояния и времени получаются параметры скелета.
   s — секунды с начала состояния (для атаки, удара, победы), t — общее время (для дыхания). */
function pose(state,t,s,seed){seed=seed||0;const P={breath:Math.sin(t*2.1+seed),tail:0,tailAmp:.025,head:0,neckX:0,
  gait:0,walk:0,tuck:0,wing:0,flap:0,spread:0,dx:0,dy:0,rot:0,flash:0,lid:0,jaw:0,fx:null};
 P.tail=t*1.6+seed;P.head=.03*Math.sin(t*.7+seed*2);
 // моргание раз в несколько секунд
 const bl=(t*.31+seed*.17)%1;P.lid=bl<.04?Math.sin(bl/.04*Math.PI):0;
 if(state==='walk'){P.walk=1;P.gait=t*7;P.dy=-Math.abs(Math.sin(t*7))*.012;P.tailAmp=.04;P.head=.03*Math.sin(t*7)}
 else if(state==='fly'){P.spread=1;P.flap=t*5.2;P.tuck=1;P.dy=-.1+.035*Math.sin(t*5.2+1.2);P.rot=-.06+.02*Math.sin(t*5.2);P.tailAmp=.05;P.tail=t*2.4}
 else if(state==='attack'){P.spread=.6;P.flap=t*3;
  const k1=sm(0,.35,s),k2=sm(.35,.5,s),k3=1-sm(.9,1.3,s);
  P.rot=(-.08*k1+.12*k2)*k3;P.dx=(-.03*k1+.07*k2)*k3;P.head=(-.22*k1+.3*k2)*k3;P.jaw=k2*k3;
  P.fx=s>.4&&s<1.2?{kind:'breath',k:sm(.4,.55,s)*(1-sm(.95,1.2,s))}:null}
 else if(state==='hit'){const k=Math.exp(-s*5)*Math.sin(s*30);P.dx=-.05*Math.exp(-s*4);P.rot=.06*k;P.flash=Math.max(0,1-s*4);P.head=.12*Math.exp(-s*4)}
 else if(state==='win'){P.spread=1;P.flap=t*3;const k=sm(0,.4,s);P.rot=-.11*k+.025*Math.sin(t*3)*k;P.head=-.2*k;P.jaw=k*.6*(.5+.5*Math.sin(t*6));P.dy=-.02*k}
 else if(state==='sleep'){P.breath=Math.sin(t*1.1+seed);P.head=.22;P.lid=1;P.tailAmp=.01;P.tail=t*.5;P.dy=.012}
 return P}

// смещение точки сетки (u,v в долях кадра тела) по позе и опорным точкам
function warp(u,v,P,A){
 let x=u,y=v;
 // дыхание: спина и грудь чуть поднимаются
 const chest=Math.exp(-((u-A.shoulder[0])**2/.04+(v-A.shoulder[1]-.15)**2/.06));
 y-=chest*.008*P.breath;x+=chest*.004*P.breath;
 // хвост: волна от таза к кончику
 const tw=1-sm(A.tail[0],A.hip[0],u);
 if(tw>0){y+=tw*tw*P.tailAmp*Math.sin(P.tail-u*7);x+=tw*.01*Math.cos(P.tail*.7)}
 // голова и шея: поворот вокруг основания шеи
 const hw=sm(A.neck[0]-.14,A.neck[0]+.03,u)*(1-sm(A.neck[1]+.08,A.neck[1]+.3,v));
 if(hw>0&&P.head){const a=P.head*hw,dx=x-A.neck[0],dy=y-A.neck[1];x=A.neck[0]+dx*Math.cos(a)-dy*Math.sin(a);y=A.neck[1]+dx*Math.sin(a)+dy*Math.cos(a)}
 // пасть: нижняя часть морды опускается
 if(P.jaw){const jw=sm(A.snout[0]-.1,A.snout[0],u)*sm(A.snout[1]-.01,A.snout[1]+.06,v)*hw;y+=jw*P.jaw*.05}
 // веки: точки у глаза стягиваются к его средней линии
 if(P.lid){const e=A.eye,k=Math.exp(-((u-e[0])**2/.0009+(v-e[1])**2/.0005))*P.lid;y+=(e[1]-v)*k*.85}
 // лапы: шаг и поджатие в полёте
 const lw=sm(A.belly-.04,A.belly+.12,v)*sm(A.tail[0]+.15,A.tail[0]+.3,u);
 if(lw>0){const front=u>(A.hip[0]+A.shoulder[0])/2,ph=P.gait+(front?0:Math.PI)+(u*20%2>1?Math.PI/2:0);
  const d=v-A.belly;
  if(P.walk){x+=lw*.03*Math.sin(ph)*P.walk;y-=lw*.03*Math.max(0,Math.cos(ph))*P.walk}
  if(P.tuck){x-=lw*d*.55*P.tuck;y-=lw*d*.35*P.tuck}}
 return [x,y]}

/* Рисует дракона. o: {els, x, y (точка под лапами на земле), size (ширина тела в px), face (1 вправо, -1 влево),
   state, t (сек), s (сек в состоянии), seed, detail (0 грубо, 1 подробно), shadow, baby} */
function draw(ctx,o){const M=man();if(!M)return false;
 const els=o.els&&o.els.length?o.els:['F'],key=bodyKey(els),A=M.body[key];if(!A)return false;
 const br=img('art6/b/'+key+'.webp');if(!br.ok)return false;
 const wk=wingKey(els),WA=M.wing[wk],wr=img('art6/w/'+wk+'.webp');
 const P=pose(o.state||'idle',o.t||0,o.s||0,o.seed||0);
 const S=o.size||200,Hh=S*A.h/A.w,face=o.face<0?-1:1;
 const n=o.detail===0||S<140?6:14;
 ctx.save();ctx.translate(o.x,o.y);
 // тень на земле: в полёте меньше и бледнее
 if(o.shadow!==false){const lift=-P.dy;ctx.save();ctx.globalAlpha=.28*(1-clamp(lift*3,0,.6));ctx.fillStyle='#000';ctx.beginPath();
  ctx.ellipse(S*.04*face,0,S*.42*(1-lift),S*.05*(1-lift),0,0,Math.PI*2);ctx.fill();ctx.restore()}
 ctx.scale(face,1);
 ctx.translate(P.dx*S,P.dy*S);
 // поворот всего тела вокруг таза
 const gx=(A.hip[0]-.5)*S,gy=-Hh*(1-A.ground);ctx.translate(gx,gy);ctx.rotate(P.rot);ctx.translate(-gx,-gy);
 // начало координат тела: левый верхний угол кадра; лапы стоят на линии ground
 ctx.translate(-S/2,-Hh*A.ground);
 const wingOn=wr.ok&&WA&&!o.wingless;
 const wingW=S*.62,wingH=wingW*(WA?WA.h/WA.w:1);
 const layer=(fn)=>{if(!P.flash){fn(ctx);return}
  // вспышка попадания: рисуем во внеэкранный холст и заливаем белым поверх силуэта
  const c=layerCanvas(Math.ceil(S*1.6),Math.ceil(Hh*2.2)),x=c.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);
  x.translate(S*.3,Hh*.9);fn(x);x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='source-atop';x.fillStyle='rgba(255,255,255,'+(.75*P.flash)+')';x.fillRect(0,0,c.width,c.height);x.globalCompositeOperation='source-over';
  ctx.drawImage(c,-S*.3,-Hh*.9)};
 layer(cx=>{
  // дальнее крыло темнее (где холст умеет фильтры)
  if(wingOn){cx.save();if('filter' in cx)cx.filter='brightness(.62)';wingTo(cx,true);cx.restore()}
  const m=mesh(key,br.im,n);const W=S,H=Hh;
  cx.save();cx.scale(W,H);
  const dst=m.verts.map(v=>warp(v[0],v[1],P,A));
  for(const t3 of m.tri){const a=t3[0],b=t3[1],c=t3[2];tri(cx,br.im,1,1,m.verts[a],m.verts[b],m.verts[c],dst[a],dst[b],dst[c])}
  cx.restore();
  if(wingOn)wingTo(cx,false)});
 function wingTo(cx,far){const sx=A.shoulder[0]*S+(far?-.025*S:0),sy=A.shoulder[1]*Hh+(far?-.035*S:0);
  let ang,sc,sy2;
  if(P.spread){const f=Math.sin(P.flap+(far?.4:0));ang=-.2-.6*f*P.spread+(far?-.14:0);sc=.78+.22*P.spread;sy2=.5+.5*Math.abs(Math.cos(P.flap*.5+.6))}
  else{ang=.3+.015*P.breath+(far?-.08:0);sc=.5;sy2=.78}
  // крыло тянется вместе со спиной при дыхании
  cx.save();cx.translate(sx,sy);cx.rotate(ang);cx.scale(sc,sc*sy2);
  if(far)cx.globalAlpha=.9;
  cx.drawImage(wr.im,-WA.root[0]*wingW,-WA.root[1]*wingH,wingW,wingH);cx.restore()}
 // дыхание стихией при атаке: временный эффект до этапа анимации стихий
 if(P.fx&&P.fx.kind==='breath'){const sn=warp(A.snout[0],A.snout[1]+.02,P,A),k=P.fx.k,c=COL[els[0]]||'#fff',c2=COL[els[1]||els[0]];
  ctx.save();
  for(let i=0;i<34;i++){const f=((o.t||0)*2.2+i/34)%1,spread=(i*37%11-5)/5;
   const x=sn[0]*S+f*S*.85,y=sn[1]*Hh+spread*f*S*.13+Math.sin(i+f*6)*S*.012,r=S*(.02+.07*f)*k;
   const g=ctx.createRadialGradient(x,y,0,x,y,r),cc=i%3?c:c2;g.addColorStop(0,'#fff');g.addColorStop(.35,cc);g.addColorStop(1,cc+'00');
   ctx.globalAlpha=(1-f*f)*.85*k;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
  ctx.restore()}
 if((o.state==='sleep')&&o.zzz!==false){ctx.save();ctx.fillStyle='rgba(255,255,255,.85)';const f=((o.t||0)*.5)%1;
  ctx.font='bold '+Math.round(S*.07)+'px system-ui,sans-serif';ctx.globalAlpha=1-f;ctx.fillText('z',A.snout[0]*S+f*S*.05,A.eye[1]*Hh-f*S*.15);
  ctx.globalAlpha=Math.max(0,1-((f+.5)%1));ctx.fillText('z',A.snout[0]*S+((f+.5)%1)*S*.07,A.eye[1]*Hh-((f+.5)%1)*S*.2);ctx.restore()}
 ctx.restore();return true}

let LC=null;function layerCanvas(w,h){if(!LC)LC=document.createElement('canvas');if(LC.width<w)LC.width=w;if(LC.height<h)LC.height=h;return LC}

const api={ELS,COL,NAME,STATES,bodyKey,wingKey,pose,warp,draw,preload,setBase(b){BASE=b||''},
 all(){const M=man();return M?Object.keys(M.body):[]}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DR6ART=api;
})(typeof window!=='undefined'?window:globalThis);
