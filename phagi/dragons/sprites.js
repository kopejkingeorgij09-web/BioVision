/* Спрайты C: дракон из рисунка A (art.js), нарезанный на подвижные части для анимации.
   Каждая часть (дальнее крыло, тело, ближнее крыло) — отдельный SVG из тех же слоёв, он растрируется один раз,
   пустые прозрачные поля обрезаются, и дальше кадр собирается из готовых картинок. Стиль у анимации тот же, что у A.
   Готовые части лежат в кеше по фенотипу и стадии возраста: одинаковые драконы делят одни и те же текстуры,
   а самые давние вытесняются, когда кеш превышает лимит памяти. */
(function(root){
'use strict';
const MORPH=root.MORPH,SHAPE=root.SHAPE,ART=root.ART;
/* trim и load общие с ригом анимации (rig.js) */

/* тень на земле не качается вместе с драконом, поэтому она отдельно */
const PARTS={ground:l=>l.part==='shadow',far:l=>l.part==='wings'&&!!l.far,body:l=>l.part!=='wings'&&l.part!=='shadow',near:l=>l.part==='wings'&&!l.far};

/* SVG-строку в картинку: через Blob, ссылка освобождается сразу после загрузки */
function load(str){
  return new Promise((res,rej)=>{const url=URL.createObjectURL(new Blob([str],{type:'image/svg+xml'})),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);res(img)};img.onerror=e=>{URL.revokeObjectURL(url);rej(e)};img.src=url})}

/* растр части с обрезкой прозрачных полей: возвращает маленький холст и его сдвиг в кадре */
function trim(img,W,H){
  const tmp=document.createElement('canvas');tmp.width=W;tmp.height=H;
  const c=tmp.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,W,H);
  const a=c.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++){const row=y*W*4;for(let x=0;x<W;x++)if(a[row+x*4+3]>3){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
  let out;
  if(x1<0){out={cv:null,x:0,y:0,w:0,h:0}}
  else{const w=x1-x0+1,h=y1-y0+1,cv=root.DRTEX.newCanvas(w,h);cv.getContext('2d').drawImage(tmp,x0,y0,w,h,0,0,w,h);out={cv,x:x0,y:y0,w,h}}
  tmp.width=tmp.height=0;   /* временный полный холст сразу отдаём */
  return out}

/* подготовка спрайтов одного дракона: opt {frame, pad, width, dpr, sil} */
async function make(M,opt){
  opt=opt||{};const dpr=opt.dpr||1;
  const G=SHAPE.build(M),{vb,tx}=ART.frameOf(G,opt),Wc=opt.width||Math.round(vb[2]),Hc=Math.round(Wc*vb[3]/vb[2]);
  const W=Math.round(Wc*dpr),H=Math.round(Hc*dpr),k=W/vb[2],r=G.anchors.root;
  const parts={};
  for(const name of Object.keys(PARTS)){
    const str=ART.svg(M,{geom:G,frame:opt.frame,pad:opt.pad,width:W,key:'s'+name,only:PARTS[name],sil:!!opt.sil});
    parts[name]=trim(await load(str),W,H)}
  const bytes=Object.values(parts).reduce((s,p)=>s+p.w*p.h*4,0);
  return {parts,W,H,dpr,cssW:Wc,cssH:Hc,pivot:[(r[0]*G.scale+tx-vb[0])*k,(r[1]*G.scale-vb[1])*k],bytes,fullBytes:3*W*H*4}}   /* fullBytes: сколько заняли бы три холста во весь кадр без обрезки */

/* один кадр анимации в ctx, левый верхний угол кадра в (x, y), t в секундах */
function compose(ctx,S,t,x,y){
  x=x||0;y=y||0;
  const ph=Math.sin(t*2*Math.PI/2.6),a=ph*0.09,bob=-ph*1.5*S.dpr*(S.H/300/S.dpr);
  const pv=S.pivot;
  const wing=(p,ang)=>{if(!p.cv)return;ctx.save();ctx.translate(x+pv[0],y+pv[1]+bob);ctx.rotate(ang);ctx.drawImage(p.cv,p.x-pv[0],p.y-pv[1]);ctx.restore()};
  if(S.parts.ground.cv)ctx.drawImage(S.parts.ground.cv,x+S.parts.ground.x,y+S.parts.ground.y);
  wing(S.parts.far,-a*0.8);
  if(S.parts.body.cv)ctx.drawImage(S.parts.body.cv,x+S.parts.body.x,y+S.parts.body.y+bob);
  wing(S.parts.near,-a)}

/* ---------- кеш ----------
   Общий кеш текстур (texcache.js): кто показывает дракона, держит его спрайты через get и отпускает через release.
   Занятые текстуры не вытесняются, поэтому видимый дракон не пропадает. */
const TEX=()=>root.DRTEX.shared;
function keyOf(ph,lvl,opt){
  const p=Object.assign({},ph);delete p.spanM;
  return 'spr:'+JSON.stringify([p,MORPH.stageOf(lvl),opt.width||0,opt.dpr||1,opt.frame||null,opt.pad==null?8:opt.pad,!!opt.sil])}
/* спрайты по фенотипу и уровню: из кеша или новые; одинаковые запросы ждут одну подготовку */
function get(ph,lvl,opt){
  opt=opt||{};const k=keyOf(ph,lvl,opt);
  return TEX().acquire(k,()=>make(MORPH.morph(ph,lvl),opt).then(S=>{S.key=k;return S}))}
function release(S){if(S&&S.key)TEX().release(S.key)}
function stats(){return Object.assign(TEX().stats(),{canvases:root.DRTEX.liveCanvases()})}
function setBudget(b){TEX().setBudget(b)}
function clear(force){TEX().clear(force)}

const SPR={make,compose,get,release,stats,setBudget,clear,keyOf,load,trim};
root.SPR=SPR;
})(typeof window!=='undefined'?window:globalThis);
