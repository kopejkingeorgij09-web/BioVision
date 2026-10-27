/* Прототип B: тот же дракон на Canvas 2D. Контуры те же, что у SVG (SHAPE.build), через Path2D.
   Отличие в живописных эффектах, которых в SVG без фильтров не добиться: мягкое свечение лавы и глаз,
   внутренняя тень по краю тела, размытый блик на спине, полупрозрачная перепонка.
   Для острова картинку можно один раз нарисовать и дальше показывать как готовое изображение (toImage). */
(function(root){
'use strict';
const MORPH=root.MORPH,SHAPE=root.SHAPE,mix=MORPH.mix;

function frameOf(G,opt){
  const s=G.scale,cx=G.box.x+G.box.w/2;
  if(opt.frame)return {vb:opt.frame,tx:-cx*s};
  const pad=8;return {vb:[G.box.x*s-pad,G.box.y*s-pad,G.box.w*s+2*pad,(-G.box.y+10)*s+pad],tx:0}}

/* draw(canvas, M, {width, frame, sil, hl, dpr}) → время отрисовки в мс */
function draw(cv,M,opt){
  opt=opt||{};
  const t0=performance.now();
  const G=opt.geom||SHAPE.build(M),p=M.pal,P=MORPH.paints(M),s=G.scale,sil=!!opt.sil;
  const {vb,tx}=frameOf(G,opt);
  const W=opt.width||Math.round(vb[2]),H=Math.round(W*vb[3]/vb[2]),dpr=opt.dpr||root.devicePixelRatio||1;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
  cv.style.width=W+'px';cv.style.height=H+'px';
  const c=cv.getContext('2d'),k=W/vb[2]*dpr;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
  c.setTransform(k,0,0,k,-vb[0]*k,-vb[1]*k);c.translate(tx,0);c.scale(s,s);
  const lw=w=>(w==null?1.5:w)/Math.pow(s,0.6);
  const B=G.box;
  /* градиенты в координатах рисунка */
  const vgrad=(y0,y1,stops)=>{const g=c.createLinearGradient(0,y0,0,y1);stops.forEach(([o,col])=>g.addColorStop(o,col));return g};
  const two=M.elements.length>1;
  const bodyG=vgrad(B.y+20,0,[[0,mix(p.base,p.light,0.4)],[0.5,p.base],[1,mix(two?mix(p.deep,p.deep2,0.5):p.deep,p.base,0.3)]]);
  const wingG=vgrad(B.y,(B.y+G.anchors.root[1])/2+10,[[0,mix(p.wing,p.light2,0.6)],[0.55,p.wing],[1,mix(p.wingDeep,p.wing,0.35)]]);
  const hornG=vgrad(B.y,G.anchors.eye[1],[[0,mix(p.horn,'#fff',0.5)],[1,mix(p.horn,p.deep,0.3)]]);
  const clips={};
  const hlOn=opt.hl&&!sil;
  G.layers.forEach(l=>{
    if(sil&&(l.fx||l.clip||l.line||l.part==='shadow'||l.paint==='shade'||l.part==='eyes'||l.part==='breath'))return;
    const path=new Path2D(l.d);
    if(l.clipId)clips[l.clipId]=path;
    c.save();
    if(hlOn)c.globalAlpha=l.part===opt.hl||l.part==='shadow'?1:0.28;
    if(l.op!=null&&!sil)c.globalAlpha*=l.op;
    if(l.clip&&clips[l.clip]&&!sil)c.clip(clips[l.clip]);
    if(sil){c.fillStyle='#16121C';c.fill(path);c.restore();return}
    if(l.paint==='shadow'){
      const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(0,0,0,.26)');g.addColorStop(1,'rgba(0,0,0,0)');
      const cx=(G.anchors.hip[0]+G.anchors.sh[0])/2,rx=(M.body.len+M.body.hipR+M.body.chestR)*0.85+10;
      c.translate(cx,0);c.scale(rx,8);c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();return}
    if(l.paint==='aura'){
      const a=G.anchors,cx=(a.hip[0]+a.sh[0])/2,cy=(a.hip[1]+a.sh[1])/2,g=c.createRadialGradient(cx,cy,4,cx,cy,110);
      g.addColorStop(0,p.accent+'66');g.addColorStop(1,p.accent+'00');c.fillStyle=g;c.fillRect(cx-120,cy-120,240,240);c.restore();return}
    if(l.line){
      c.strokeStyle=P[l.paint];c.lineWidth=lw(l.line);c.lineCap='round';c.lineJoin='round';
      if(l.glow){c.shadowColor=P[l.paint];c.shadowBlur=6*k*s}
      if(l.paint==='rim'){c.filter='blur(0.8px)'}
      c.stroke(path);c.restore();return}
    let fill=P[l.paint];
    if(l.grad==='body')fill=bodyG;else if(l.grad==='wing')fill=wingG;else if(l.grad==='horn')fill=hornG;
    if(l.grad==='shade'){
      /* мягкий объём: светлый блик сверху, тень снизу, внутренняя тень по краю */
      c.clip(path);
      const a=G.anchors,cx=(a.hip[0]+a.sh[0])/2,cy=(a.hip[1]+a.sh[1])/2-10;
      const g=c.createRadialGradient(cx-10,cy-20,4,cx,cy+10,140);g.addColorStop(0,'rgba(255,255,255,.28)');g.addColorStop(.35,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.28)');
      c.fillStyle=g;c.fill(path);
      c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=lw(6);c.filter='blur(3px)';c.stroke(path);
      c.restore();return}
    if(l.grad==='glow'){const e=G.anchors.eye,r=G.anchors.eyeR*2.6;fill=c.createRadialGradient(e[0],e[1],0,e[0],e[1],r);fill.addColorStop(0,p.glow+'D9');fill.addColorStop(.45,p.glow+'59');fill.addColorStop(1,p.glow+'00')}
    if(l.grad==='ball'){const r=l.r,q=l.c;fill=c.createRadialGradient(q[0]-r*0.3,q[1]-r*0.4,r*0.1,q[0],q[1],r);fill.addColorStop(0,mix(P.mace,'#fff',0.45));fill.addColorStop(1,mix(P.mace,'#000',0.35))}
    if(l.paint==='wing'||l.paint==='wingFar')c.globalAlpha*=0.96;
    if(l.glow&&l.paint!=='glow'){c.shadowColor=P[l.paint];c.shadowBlur=14*k*s}
    if(l.paint==='fireOuter'||l.paint==='fireInner'||l.paint==='lava'){c.shadowColor='#FFB347';c.shadowBlur=10*k*s}
    c.fillStyle=fill;c.fill(path);
    c.shadowBlur=0;
    if(l.stroke){c.strokeStyle=p.edge;c.lineWidth=lw(l.sw==null?1.5:l.sw);c.lineJoin='round';c.stroke(path)}
    c.restore()});
  return performance.now()-t0}

/* Прототип C, составные спрайты: каждая подвижная часть один раз рисуется в свой холст из той же геометрии,
   дальше кадр анимации собирается из готовых картинок (крылья поворачиваются у плеча, тело покачивается).
   Внешность по-прежнему целиком из генотипа: спрайты не рисуются вручную, а режутся из рисунка B. */
function sprites(M,opt){
  opt=Object.assign({dpr:1},opt||{});
  const G=opt.geom||SHAPE.build(M);
  const mk=f=>{const cv=document.createElement('canvas');draw(cv,M,Object.assign({},opt,{geom:Object.assign({},G,{layers:G.layers.filter(f)})}));return cv};
  const far=mk(l=>l.part==='wings'&&l.far),near=mk(l=>l.part==='wings'&&!l.far),body=mk(l=>l.part!=='wings');
  const {vb,tx}=frameOf(G,opt),W=opt.width||Math.round(vb[2]),k=W/vb[2]*opt.dpr,r=G.anchors.root;
  return {far,body,near,w:body.width,h:body.height,pivot:[(r[0]*G.scale+tx-vb[0])*k,(r[1]*G.scale-vb[1])*k]}}
/* один кадр: t в секундах */
function compose(ctx,S,t){
  const ph=Math.sin(t*2*Math.PI/2.6),a=ph*0.09,bob=-ph*1.5*(S.h/300);
  ctx.clearRect(0,0,S.w,S.h);
  const wing=(img,ang)=>{ctx.save();ctx.translate(S.pivot[0],S.pivot[1]+bob);ctx.rotate(ang);ctx.drawImage(img,-S.pivot[0],-S.pivot[1]);ctx.restore()};
  wing(S.far,-a*0.8);ctx.drawImage(S.body,0,bob);wing(S.near,-a)}

/* готовая картинка для острова: рисуется один раз, дальше показывается как <img> */
function toImage(M,opt){const cv=document.createElement('canvas');draw(cv,M,Object.assign({dpr:2},opt||{}));return cv.toDataURL('image/png')}

const ARTC={draw,toImage,sprites,compose};
root.ARTC=ARTC;
})(typeof window!=='undefined'?window:globalThis);
