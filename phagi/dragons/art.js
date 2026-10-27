/* Рисунок A: дракон в SVG. Берёт морфологию (MORPH.morph) и геометрию (SHAPE.build), сам ничего не решает:
   какие части есть и какой они формы, определено фенотипом. Здесь только цвет, градиенты, мягкие тени и порядок слоёв.
   Каждая часть тела лежит в <g data-part="…">, чтобы паспорт мог подсветить рога, крылья, гребень и т. д.
   Тот же SVG нарезается на спрайты для анимации (sprites.js), поэтому стиль у анимации тот же. */
(function(root){
'use strict';
const MORPH=root.MORPH||(typeof require!=='undefined'?require('./morph.js'):null);
const SHAPE=root.SHAPE||(typeof require!=='undefined'?require('./shape.js'):null);
const mix=MORPH.mix;

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const R1=v=>Math.round(v*10)/10;

/* рамка: по умолчанию по дракону; frame=[x,y,w,h] в единицах экрана, центр дракона по x в нуле */
function frameOf(G,opt){
  const s=G.scale,cx=G.box.x+G.box.w/2;
  if(opt.frame)return {vb:opt.frame,tx:-cx*s};
  const pad=opt.pad==null?8:opt.pad;
  return {vb:[(G.box.x-cx)*s-pad,G.box.y*s-pad,G.box.w*s+2*pad,(-G.box.y+10)*s+pad],tx:-cx*s}}

/* opt.only — фильтр слоёв (для спрайтов: только дальнее крыло, только тело и т. д.).
   Для рига (rig.js): opt.rig включает слои только для анимации (веко), opt.region — список обрезок, видимо их пересечение
   (элемент списка — контур или массив контуров, тогда видно их объединение), opt.turn = {deg, c} поворачивает рисунок вокруг точки c. */
function svg(M,opt){
  opt=opt||{};
  const key=String(opt.key||'d').replace(/[^A-Za-z0-9_-]/g,'');
  const G=opt.geom||SHAPE.build(M),p=M.pal,P=MORPH.paints(M),s=G.scale,sil=!!opt.sil;
  const sw=w=>(w==null?1.5:w)/Math.pow(s,0.6);
  const {vb,tx}=frameOf(G,opt);
  const W=opt.width||Math.round(vb[2]*(opt.px||1)),H=Math.round(W*vb[3]/vb[2]);
  const id=n=>n+key;
  const skip=l=>(l.rig&&!opt.rig)||(opt.only&&!opt.only(l))||(sil&&(l.fx||l.clip||l.line||l.blur||l.part==='shadow'||l.part==='eyes'||l.part==='breath'));
  const layers=G.layers.filter(l=>!skip(l));
  const o=[];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" class="dr3${sil?' sil':''}" viewBox="${vb.map(R1).join(' ')}" width="${W}" height="${H}" role="img" aria-label="${esc(opt.label||'Дракон')}">`);
  if(!sil){
    const two=M.elements.length>1;
    o.push('<defs>');
    o.push(`<linearGradient id="${id('gb')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(p.base,p.light,0.3)}"/><stop offset=".5" stop-color="${p.base}"/><stop offset="1" stop-color="${mix(two?mix(p.deep,p.deep2,0.5):p.deep,p.base,0.45)}"/></linearGradient>`);
    o.push(`<linearGradient id="${id('gw')}" x1=".2" y1="1" x2=".6" y2="0"><stop offset="0" stop-color="${mix(p.wingDeep,p.wing,0.35)}"/><stop offset=".55" stop-color="${p.wing}"/><stop offset="1" stop-color="${mix(p.wing,p.light2,0.55)}"/></linearGradient>`);
    o.push(`<linearGradient id="${id('gh')}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${mix(p.horn,p.deep,0.3)}"/><stop offset=".4" stop-color="${p.horn}"/><stop offset="1" stop-color="${mix(p.horn,'#fff',0.55)}"/></linearGradient>`);
    o.push(`<radialGradient id="${id('gm')}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${mix(P.mace,'#fff',0.45)}"/><stop offset="1" stop-color="${mix(P.mace,'#000',0.35)}"/></radialGradient>`);
    o.push(`<radialGradient id="${id('gi')}" cx=".45" cy=".55" r=".6"><stop offset="0" stop-color="${mix(P.iris,'#fff',0.45)}"/><stop offset=".6" stop-color="${P.iris}"/><stop offset="1" stop-color="${P.irisDeep}"/></radialGradient>`);
    if(p.glow)o.push(`<radialGradient id="${id('gg')}"><stop offset="0" stop-color="${p.glow}" stop-opacity=".85"/><stop offset=".45" stop-color="${p.glow}" stop-opacity=".35"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>`);
    o.push(`<radialGradient id="${id('ga')}"><stop offset="0" stop-color="${p.accent}" stop-opacity=".42"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>`);
    o.push(`<radialGradient id="${id('gs')}"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`);
    /* мягкие тени и блики: размытие в единицах рисунка, область фильтра по рамке дракона */
    const bx=G.box,fr=`filterUnits="userSpaceOnUse" x="${R1(bx.x-40)}" y="${R1(bx.y-40)}" width="${R1(bx.w+80)}" height="${R1(bx.h+80)}"`;
    [...new Set(layers.filter(l=>l.blur).map(l=>l.blur))].forEach(b=>o.push(`<filter id="${id('f'+String(b).replace('.','_'))}" ${fr}><feGaussianBlur stdDeviation="${b}"/></filter>`));
    G.layers.forEach(l=>{if(l.clipId)o.push(`<clipPath id="${id('c'+l.clipId)}"><path d="${l.d}"/></clipPath>`)});
    o.push('</defs>')}
  /* разрезы для рига нужны и в силуэте */
  if(opt.region&&opt.region.length)o.push('<defs>'+opt.region.map((d,i)=>`<clipPath id="${id('rg'+i)}">${[].concat(d).map(x=>x[0]==='!'?`<path d="${x.slice(1)}" clip-rule="evenodd"/>`:`<path d="${x}"/>`).join('')}</clipPath>`).join('')+'</defs>');
  const turn=opt.turn?` rotate(${R1(opt.turn.deg*100)/100} ${R1(opt.turn.c[0])} ${R1(opt.turn.c[1])})`:'';
  o.push(`<g transform="translate(${R1(tx)} 0) scale(${s})${turn}">`);
  const rg=opt.region||[];rg.forEach((d,i)=>o.push(`<g clip-path="url(#${id('rg'+i)})">`));
  /* крылья обёрнуты так, что начало координат группы .flap лежит в корне крыла: CSS-анимация машет ими у плеча.
     data-part — часть тела по карте генов (поле of: тень от крыла на теле подсвечивается вместе с крылом) */
  const R=G.anchors.root.map(R1);
  const open=(part,dp)=>part==='wings'?`<g transform="translate(${R[0]} ${R[1]})"><g class="flap"><g transform="translate(${-R[0]} ${-R[1]})"><g data-part="${dp}">`:`<g data-part="${dp}">`;
  const close=part=>part==='wings'?'</g></g></g></g>':'</g>';
  let cur=null,curK=null;
  layers.forEach(l=>{
    const dp=l.of||l.part,k=l.part+'>'+dp;
    if(k!==curK){if(cur)o.push(close(cur));o.push(open(l.part,dp));cur=l.part;curK=k}
    let fill,stroke='none',w=0,extra='';
    if(sil){fill='#16121C'}
    else if(l.line){fill='none';stroke=P[l.paint];w=sw(l.line);extra=' stroke-linecap="round" stroke-linejoin="round"'}
    else{
      const g={body:'gb',wing:'gw',horn:'gh',ball:'gm',glow:'gg',iris:'gi'}[l.grad];
      fill=g?`url(#${id(g)})`:l.paint==='aura'?`url(#${id('ga')})`:l.paint==='shadow'?`url(#${id('gs')})`:P[l.paint];
      if(l.stroke){stroke=p.edge;w=sw(l.sw==null?1.5:l.sw);extra+=' stroke-linejoin="round"'}}
    const op=!sil&&l.op!=null&&l.op<1?` opacity="${Math.round(l.op*100)/100}"`:'';
    const clip=!sil&&l.clip?` clip-path="url(#${id('c'+l.clip)})"`:'';
    const flt=!sil&&l.blur?` filter="url(#${id('f'+String(l.blur).replace('.','_'))})"`:'';
    /* размытый слой с обрезкой: сначала размыть, потом обрезать — для этого обрезка на внешней группе */
    const body=`<path d="${l.d}" fill="${fill}"${stroke!=='none'?` stroke="${stroke}" stroke-width="${Math.round(w*100)/100}"`:''}${extra}${op}${flt&&!clip?flt:''}${clip&&!flt?clip:''}/>`;
    o.push(flt&&clip?`<g${clip}><path d="${l.d}" fill="${fill}"${stroke!=='none'?` stroke="${stroke}" stroke-width="${Math.round(w*100)/100}"`:''}${extra}${op}${flt}/></g>`:body)});
  if(cur)o.push(close(cur));
  rg.forEach(()=>o.push('</g>'));
  o.push('</g></svg>');
  return o.join('')}

/* удобный вход: фенотип и уровень */
function dragon(ph,lvl,opt){return svg(MORPH.morph(ph,lvl),opt)}

const ART={svg,dragon,frameOf};
if(typeof module!=='undefined'&&module.exports)module.exports=ART;else root.ART=ART;
})(typeof window!=='undefined'?window:globalThis);
