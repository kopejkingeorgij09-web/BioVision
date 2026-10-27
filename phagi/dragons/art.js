/* Прототип A: дракон в SVG. Берёт морфологию (MORPH.morph) и геометрию (SHAPE.build), сам ничего не решает:
   какие части есть и какой они формы, определено фенотипом. Здесь только цвет, градиенты и порядок слоёв.
   Каждая часть тела лежит в <g data-part="…">, чтобы паспорт мог подсветить рога, крылья, гребень и т. д. */
(function(root){
'use strict';
const MORPH=root.MORPH||(typeof require!=='undefined'?require('./morph.js'):null);
const SHAPE=root.SHAPE||(typeof require!=='undefined'?require('./shape.js'):null);
const mix=MORPH.mix;

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

function svg(M,opt){
  opt=opt||{};
  const key=String(opt.key||'d').replace(/[^A-Za-z0-9_-]/g,'');
  const G=opt.geom||SHAPE.build(M),p=M.pal,P=MORPH.paints(M),s=G.scale,sil=!!opt.sil;
  const sw=w=>(w==null?1.5:w)/Math.pow(s,0.6);
  /* рамка: по умолчанию по дракону; frame=[x,y,w,h] в единицах экрана, центр дракона по x в нуле */
  const cx=(G.box.x+G.box.w/2);
  let vb,tx;
  if(opt.frame){vb=opt.frame;tx=-cx*s}
  else{const pad=8;vb=[G.box.x*s-pad,G.box.y*s-pad,G.box.w*s+2*pad,(-G.box.y+10)*s+pad];tx=0}
  const W=opt.width||Math.round(vb[2]*(opt.px||1)),H=Math.round(W*vb[3]/vb[2]);
  const id=n=>n+key;
  const o=[];
  o.push(`<svg class="dr3${sil?' sil':''}" viewBox="${vb.map(v=>Math.round(v*10)/10).join(' ')}" width="${W}" height="${H}" role="img" aria-label="${esc(opt.label||'Дракон')}">`);
  if(!sil){
    const two=M.elements.length>1;
    o.push('<defs>');
    o.push(`<linearGradient id="${id('gb')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(p.base,p.light,0.38)}"/><stop offset=".55" stop-color="${p.base}"/><stop offset="1" stop-color="${mix(two?mix(p.deep,p.deep2,0.5):p.deep,p.base,0.35)}"/></linearGradient>`);
    o.push(`<radialGradient id="${id('gs')}" cx=".34" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>`);
    o.push(`<linearGradient id="${id('gw')}" x1=".2" y1="1" x2=".6" y2="0"><stop offset="0" stop-color="${mix(p.wingDeep,p.wing,0.3)}"/><stop offset=".5" stop-color="${p.wing}"/><stop offset="1" stop-color="${mix(p.wing,p.light2,0.6)}"/></linearGradient>`);
    o.push(`<linearGradient id="${id('gh')}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${mix(p.horn,p.deep,0.25)}"/><stop offset=".35" stop-color="${p.horn}"/><stop offset="1" stop-color="${mix(p.horn,'#fff',0.55)}"/></linearGradient>`);
    o.push(`<radialGradient id="${id('gm')}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${mix(P.mace,'#fff',0.45)}"/><stop offset="1" stop-color="${mix(P.mace,'#000',0.35)}"/></radialGradient>`);
    if(p.glow)o.push(`<radialGradient id="${id('gg')}"><stop offset="0" stop-color="${p.glow}" stop-opacity=".85"/><stop offset=".45" stop-color="${p.glow}" stop-opacity=".35"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>`);
    o.push(`<radialGradient id="${id('ga')}"><stop offset="0" stop-color="${p.accent}" stop-opacity=".42"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient>`);
    G.layers.forEach(l=>{if(l.clipId)o.push(`<clipPath id="${id('c'+l.clipId)}"><path d="${l.d}"/></clipPath>`)});
    o.push('</defs>')}
  o.push(`<g transform="translate(${Math.round(tx*10)/10} 0) scale(${s})">`);
  /* крылья обёрнуты так, что начало координат группы .flap лежит в корне крыла: CSS-анимация машет ими у плеча */
  const R=G.anchors.root.map(v=>Math.round(v*10)/10);
  const open=part=>part==='wings'?`<g transform="translate(${R[0]} ${R[1]})"><g class="flap"><g transform="translate(${-R[0]} ${-R[1]})"><g data-part="wings">`:`<g data-part="${part}">`;
  const close=part=>part==='wings'?'</g></g></g></g>':'</g>';
  let cur=null;
  G.layers.forEach(l=>{
    if(sil&&(l.fx||l.clip||l.line||l.part==='shadow'||l.paint==='shade'||l.part==='eyes'||l.part==='breath'))return;
    if(l.part!==cur){if(cur)o.push(close(cur));o.push(open(l.part));cur=l.part}
    let fill,stroke='none',w=0,extra='';
    if(sil){fill='#16121C'}
    else if(l.line){fill='none';stroke=P[l.paint];w=sw(l.line);extra=' stroke-linecap="round" stroke-linejoin="round"'}
    else{
      fill=l.grad==='body'?`url(#${id('gb')})`:l.grad==='shade'?`url(#${id('gs')})`:l.grad==='wing'?`url(#${id('gw')})`:l.grad==='horn'?`url(#${id('gh')})`:l.grad==='ball'?`url(#${id('gm')})`:l.grad==='glow'?`url(#${id('gg')})`:l.paint==='aura'?`url(#${id('ga')})`:P[l.paint];
      if(l.paint==='shadow')extra=' opacity=".16"';
      if(l.stroke){stroke=p.edge;w=sw(l.sw==null?1.5:l.sw);extra+=' stroke-linejoin="round"'}}
    const op=!sil&&l.op!=null?` opacity="${l.op}"`:'';
    const clip=!sil&&l.clip?` clip-path="url(#${id('c'+l.clip)})"`:'';
    o.push(`<path d="${l.d}" fill="${fill}"${stroke!=='none'?` stroke="${stroke}" stroke-width="${Math.round(w*100)/100}"`:''}${extra}${op}${clip}/>`)});
  if(cur)o.push(close(cur));
  o.push('</g></svg>');
  return o.join('')}

/* удобный вход: фенотип и уровень */
function dragon(ph,lvl,opt){return svg(MORPH.morph(ph,lvl),opt)}

const ART={svg,dragon};
if(typeof module!=='undefined'&&module.exports)module.exports=ART;else root.ART=ART;
})(typeof window!=='undefined'?window:globalThis);
