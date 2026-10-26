/* Помощники для рисунков в конспектах и лаборатории: общие стили, палитра VZ.C и функции рисования
   (t, ln, dot, rect, path, arrow, axes, curve, num).
   VZ.doc(id,{kick,title,lead,intro,end}) и VZ.sec(id,{id,no,t,sub,html}) — короткие имена для BV.K.doc и BV.K.sec.
   Как собрать лекцию из этих блоков, написано в content/README.md, рабочий образец в content/lectures/_shablon.js. */
(function(){
const K=BV.K,VZ=BV.VZ={};
const CSS=`
.k-vuz{background:color-mix(in oklab,#0e8a8f 8%,var(--surface));border-color:color-mix(in oklab,#0e8a8f 34%,var(--line))}
.k-vuz>b:first-child{color:#0b7479}
:host([data-theme="dark"]) .k-vuz>b:first-child{color:#43cfc8}
.vz-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--font-body);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0b7479;background:color-mix(in oklab,#0e8a8f 12%,var(--surface));border:1px solid color-mix(in oklab,#0e8a8f 30%,var(--line));border-radius:999px;padding:2px 9px;vertical-align:middle;margin-left:8px;white-space:nowrap}
:host([data-theme="dark"]) .vz-chip{color:#43cfc8}
.vz-src{display:block;font-size:12.5px;color:var(--muted);margin-top:6px}
.vz-src:before{content:"Источник · ";font-weight:700;letter-spacing:.04em}
.vz-f{font-family:var(--font-mono);font-weight:600;font-size:15px;color:var(--hema);background:var(--hema-soft);padding:7px 12px;border-radius:8px;display:inline-block;max-width:100%;overflow-wrap:anywhere;margin:4px 0 8px}
.vz-out{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:14px;margin:8px 14px 0}
.vz-out span{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
.vz-out b{font-family:var(--font-body)}
.module>.seg,.module>.k-bar{align-self:flex-start;max-width:100%}
`;
const st=document.createElement('style');st.textContent=CSS;BVHOST.root.appendChild(st);

VZ.box=(html,title='Вузовский уровень')=>K.box('vuz',title,html);
VZ.src=t=>`<span class="vz-src">${t}</span>`;
VZ.chip=(t='вуз')=>`<span class="vz-chip">${t}</span>`;
VZ.f=t=>`<div class="vz-f">${t}</div>`;
VZ.sec=(mod,s)=>K.sec(mod,s);
VZ.doc=(mod,d)=>K.doc(mod,d);

/* ---- рисование в SVG (светлое поле рисунка) ---- */
const C=VZ.C={ink:'#1b1c33',muted:'#5b5e7a',line:'#d9dce8',grid:'#eceef5',hema:'#3b3da0',eosin:'#c2386e',ok:'#2f8a4c',bad:'#c2384a',amber:'#c98a12',sky:'#2f7fc1',teal:'#0e8a8f',violet:'#8a4fbf'};
const f1=v=>(+v).toFixed(1);
VZ.t=(x,y,s,o={})=>`<text x="${f1(x)}" y="${f1(y)}" font-size="${o.s||20}" font-weight="${o.w||600}" fill="${o.c||C.ink}" text-anchor="${o.a||'start'}"${o.op!=null?` opacity="${o.op}"`:''}${o.mono?' font-family="ui-monospace,Menlo,monospace"':''}>${s}</text>`;
VZ.ln=(x1,y1,x2,y2,o={})=>`<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${o.c||C.ink}" stroke-width="${o.w||2}"${o.d?` stroke-dasharray="${o.d}"`:''} stroke-linecap="round"${o.op!=null?` opacity="${o.op}"`:''}/>`;
VZ.dot=(x,y,r,fill,o={})=>`<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" fill="${fill}"${o.st?` stroke="${o.st}" stroke-width="${o.sw||2}"`:''}${o.op!=null?` opacity="${o.op}"`:''}/>`;
VZ.rect=(x,y,w,h,fill,o={})=>`<rect x="${f1(x)}" y="${f1(y)}" width="${f1(Math.max(0,w))}" height="${f1(Math.max(0,h))}" rx="${o.r??6}" fill="${fill}"${o.st?` stroke="${o.st}" stroke-width="${o.sw||1.5}"`:''}${o.op!=null?` opacity="${o.op}"`:''}/>`;
VZ.path=(pts,o={})=>`<path d="${pts.map((p,i)=>(i?'L':'M')+f1(p[0])+' '+f1(p[1])).join('')}${o.z?'Z':''}" fill="${o.fill||'none'}" stroke="${o.c||C.ink}" stroke-width="${o.w||3}" stroke-linejoin="round" stroke-linecap="round"${o.d?` stroke-dasharray="${o.d}"`:''}${o.op!=null?` opacity="${o.op}"`:''}/>`;
VZ.arrow=(x1,y1,x2,y2,o={})=>{const a=Math.atan2(y2-y1,x2-x1),s=o.h||12,c=o.c||C.ink;return VZ.ln(x1,y1,x2-Math.cos(a)*s*.6,y2-Math.sin(a)*s*.6,o)+`<path d="M${f1(x2)} ${f1(y2)}L${f1(x2-s*Math.cos(a-.45))} ${f1(y2-s*Math.sin(a-.45))}L${f1(x2-s*Math.cos(a+.45))} ${f1(y2-s*Math.sin(a+.45))}Z" fill="${c}"/>`};
/* оси графика: box=[x0,y0,x1,y1] в координатах SVG, X=[min,max], Y=[min,max] */
VZ.axes=(box,X,Y,o={})=>{const [x0,y0,x1,y1]=box,sx=v=>x0+(v-X[0])/(X[1]-X[0])*(x1-x0),sy=v=>y1-(v-Y[0])/(Y[1]-Y[0])*(y1-y0);let h='';
  (o.xt||[]).forEach(v=>{h+=VZ.ln(sx(v),y0,sx(v),y1,{c:C.grid,w:1.5})+VZ.t(sx(v),y1+26,o.xf?o.xf(v):v,{s:17,w:500,c:C.muted,a:'middle'})});
  (o.yt||[]).forEach(v=>{h+=VZ.ln(x0,sy(v),x1,sy(v),{c:C.grid,w:1.5})+VZ.t(x0-10,sy(v)+6,o.yf?o.yf(v):v,{s:17,w:500,c:C.muted,a:'end'})});
  h+=VZ.ln(x0,y1,x1,y1,{c:C.muted,w:2})+VZ.ln(x0,y0,x0,y1,{c:C.muted,w:2});
  if(o.xl)h+=VZ.t(x1,y1+52,o.xl,{s:18,w:600,c:C.muted,a:'end'});if(o.yl)h+=VZ.t(x0,y0-14,o.yl,{s:18,w:600,c:C.muted});
  return {h,sx,sy}};
VZ.curve=(fn,a,b,sx,sy,o={})=>{const n=o.n||120,pts=[];for(let i=0;i<=n;i++){const x=a+(b-a)*i/n,y=fn(x);if(isFinite(y))pts.push([sx(x),sy(y)])}return VZ.path(pts,o)};
VZ.num=(v,d=1)=>(Math.abs(v)<1e-9?0:v).toFixed(d).replace('.',',').replace('-','−');
/* общий обработчик: рисунок + ползунки/переключатели → перерисовка */
VZ.live=(id,ctl,draw)=>K.init(id,(fig,svg)=>{const g=svg.querySelector('g'),tx=fig.querySelector('.k-steptx'),st={};
  const go=()=>{const r=draw(st)||{};g.innerHTML=r.svg||'';if(tx&&r.tx!=null)tx.innerHTML=r.tx};
  (ctl.rng||[]).forEach(([rid,key,fmt])=>{const b=fig.querySelector('#'+rid+'-v'),inp=fig.querySelector('#'+rid);
    const v0=inp?inp.value:'',i0=b?b.textContent:'',suf=i0.startsWith(v0)?i0.slice(v0.length):'';
    K.rngOn(fig,rid,v=>{st[key]=v;go()},v=>(fmt?fmt(v):String(v).replace('.',','))+suf)});
  (ctl.seg||[]).forEach(([sid,key,def])=>{st[key]=def;K.segOn(fig,sid,v=>{st[key]=v;go()})});
  go()});
})();
