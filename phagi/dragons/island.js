/* Рисунок острова: изометрическая сетка 12×12, постройки 2×2, драконы в своих средах.
   Только SVG-строка, без состояния. Нажатия ловит общий обработчик страницы по data-act. */
(function(root){
'use strict';
const TW=64,TH=32,OX=400,OY=110,VW=800,VH=520,VY=30;
const P=(i,j)=>[(i-j)*TW/2+OX,(i+j)*TH/2+OY];
const pt=a=>a[0].toFixed(1)+','+a[1].toFixed(1);
const dia=(i,j,w,h)=>[P(i,j),P(i+w,j),P(i+w,j+h),P(i,j+h)].map(pt).join(' ');

/* ---------- постройки в локальных координатах: центр площадки 2×2 = (0,0), ромб ±64 × ±32 ---------- */
const PLATE={F:['#5A3A33','#3E2622'],W:['#E6D3A3','#BFA978'],N:['#8D8A86','#6A6763'],T:['#B08A5C','#8A6840'],A:['#DCE6EE','#B4C2CE'],P:['#6FAE5A','#4F8A3F'],
  L:['#F1E2B0','#CDB778'],D:['#3D3450','#272035'],farm:['#9C7A4E','#7A5C36'],nest:['#C9B48A','#A38F66'],hatch:['#C9B48A','#A38F66']};
function plate(type){const [a,b]=PLATE[type]||PLATE.farm;
  return `<path d="M-64 0 L0 32 L64 0 L64 7 L0 39 L-64 7 Z" fill="${b}"/><path d="M0 -32 L64 0 L0 32 L-64 0 Z" fill="${a}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`}

const SPR={
  F:()=>`<path d="M-44 6 C -34 -10 -22 -44 -14 -58 L14 -58 C 22 -44 34 -10 44 6 C 20 16 -20 16 -44 6 Z" fill="#6B3A2E" stroke="#3B1F18" stroke-width="2"/>
    <path d="M-30 0 C -24 -16 -18 -36 -12 -50 L-4 -50 C -10 -30 -14 -12 -14 4 Z" fill="#84483A" opacity=".8"/>
    <ellipse cx="0" cy="-58" rx="15" ry="5" fill="#FFB347"/><ellipse cx="0" cy="-58" rx="9" ry="3" fill="#FFE08A"/>
    <path d="M-6 -56 C -8 -40 -16 -26 -20 -10 C -12 -24 -4 -36 2 -54 Z M8 -56 C 12 -42 18 -30 24 -18 C 14 -28 8 -40 4 -54 Z" fill="#FF7A2F" opacity=".9"/>
    <path class="drg-smoke" d="M-4 -66 C -10 -76 0 -82 -4 -92 M6 -68 C 12 -78 2 -84 8 -96" stroke="#C9C2BC" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>`,
  W:()=>`<ellipse cx="0" cy="2" rx="44" ry="20" fill="#2F80D1" stroke="#1D5A99" stroke-width="2"/><ellipse cx="0" cy="0" rx="36" ry="15" fill="#5AA6E8"/>
    <path d="M-20 -2 q 6 -4 12 0 q 6 4 12 0 M2 6 q 6 -4 12 0" stroke="#D8EEFF" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M26 -6 L34 -34 L46 -30 L44 -4 Z" fill="#9A8F84" stroke="#5E554C" stroke-width="1.6"/><path d="M36 -30 C 34 -18 32 -10 30 -2" stroke="#BFE3FF" stroke-width="4" fill="none"/>
    <circle cx="-40" cy="-4" r="7" fill="#A39A90" stroke="#5E554C" stroke-width="1.4"/><circle cx="-30" cy="14" r="5" fill="#A39A90" stroke="#5E554C" stroke-width="1.4"/>`,
  N:()=>`<path d="M-46 8 C -46 -20 -26 -46 0 -48 C 28 -46 48 -18 46 8 C 20 18 -20 18 -46 8 Z" fill="#7B7772" stroke="#4A4743" stroke-width="2"/>
    <path d="M-16 10 C -16 -8 -8 -20 2 -20 C 12 -20 18 -8 18 10 Z" fill="#1E1C22"/><path d="M-30 -20 L-20 -30 M20 -32 L32 -22" stroke="#5E5A55" stroke-width="3" stroke-linecap="round"/>`,
  T:()=>`<path d="M-40 8 L-36 -40 L-18 -46 L-14 6 Z" fill="#A47A4C" stroke="#5E4428" stroke-width="2"/><path d="M-10 10 L-6 -64 L14 -70 L18 10 Z" fill="#B88B58" stroke="#5E4428" stroke-width="2"/>
    <path d="M22 8 L24 -30 L40 -34 L44 6 Z" fill="#9A7044" stroke="#5E4428" stroke-width="2"/><path d="M-6 -40 L14 -44 M-34 -20 L-18 -24 M26 -12 L42 -16" stroke="#7A5530" stroke-width="2"/>`,
  A:()=>`<path d="M-14 10 L-10 -56 L10 -56 L14 10 Z" fill="#F4F7FA" stroke="#8796A5" stroke-width="2"/><path d="M-16 -56 L0 -88 L16 -56 Z" fill="#7FB3E0" stroke="#4E7EA8" stroke-width="2"/>
    <rect x="-5" y="-40" width="10" height="14" rx="5" fill="#8FC3E0"/><g fill="#FFFFFF" stroke="#C6D3DE" stroke-width="1.4"><ellipse cx="-34" cy="-30" rx="16" ry="8"/><ellipse cx="30" cy="-48" rx="14" ry="7"/><ellipse cx="34" cy="0" rx="12" ry="6"/></g>`,
  P:()=>`<g stroke="#2F5D22" stroke-width="2"><rect x="-32" y="-22" width="6" height="26" fill="#7A5230"/><circle cx="-29" cy="-36" r="18" fill="#4E9A3E"/>
    <rect x="6" y="-40" width="7" height="40" fill="#7A5230"/><circle cx="10" cy="-58" r="22" fill="#5CB04A"/><rect x="28" y="-8" width="5" height="18" fill="#7A5230"/><circle cx="31" cy="-18" r="13" fill="#3F8A31"/></g>
    <circle cx="16" cy="-64" r="3" fill="#F2C94C"/><circle cx="-24" cy="-40" r="2.5" fill="#F28CB1"/>`,
  L:()=>`<path d="M-40 8 L-40 -30 L40 -30 L40 8 Z" fill="#FBF1D0" stroke="#B8962E" stroke-width="2"/><path d="M-48 -30 L0 -62 L48 -30 Z" fill="#F2C94C" stroke="#B8962E" stroke-width="2"/>
    <path d="M-28 8 V -24 M-10 8 V -24 M10 8 V -24 M28 8 V -24" stroke="#D9C07A" stroke-width="5"/><circle cx="0" cy="-74" r="9" fill="#FFF3B0" stroke="#F2C94C" stroke-width="2"/>`,
  D:()=>`<path d="M-20 10 L-26 -54 L0 -96 L26 -54 L20 10 Z" fill="#2B2238" stroke="#120E19" stroke-width="2"/><path d="M0 -96 L6 -50 L0 10" stroke="#5B3F8C" stroke-width="3" fill="none"/>
    <path d="M-8 -60 L0 -72 L8 -60 L0 -48 Z" fill="#9C6BFF"/><path d="M-40 8 L-34 -10 L-28 8 M30 8 L36 -16 L42 8" fill="#3D3450" stroke="#120E19" stroke-width="1.5"/>`,
  nest:()=>`<ellipse cx="0" cy="-6" rx="40" ry="16" fill="#B8925A" stroke="#6E522B" stroke-width="2"/><ellipse cx="0" cy="-10" rx="28" ry="9" fill="#6E522B"/><ellipse cx="-6" cy="-16" rx="8" ry="10" fill="#F5EBD6"/><ellipse cx="8" cy="-14" rx="7" ry="9" fill="#E8D7B3"/>`,
  hatch:()=>`<path d="M-34 8 L-34 -24 C -34 -48 34 -48 34 -24 L34 8 Z" fill="#E8D7B3" stroke="#8A7650" stroke-width="2"/><ellipse cx="0" cy="-12" rx="12" ry="15" fill="#FFF6DE" stroke="#C9A86A" stroke-width="1.6"/>`
};

/* ферма: четыре грядки-квадранта, у закрытых трава */
function farmSprite(b,st,K,D){
  const q=[[0,-16],[32,0],[0,16],[-32,0]],out=[];
  q.forEach(([cx,cy],i)=>{
    const has=i<(b.plots||[]).length,p=has?b.plots[i]:null;
    const d=`M${cx} ${cy-15} L${cx+30} ${cy} L${cx} ${cy+15} L${cx-30} ${cy} Z`;
    if(!has){out.push(`<path d="${d}" fill="#7FB86A" opacity=".85"/>`);return}
    out.push(`<path d="${d}" fill="#7A5534" stroke="#5A3C22" stroke-width="1"/><path d="M${cx-18} ${cy-6} L${cx+6} ${cy+6} M${cx-6} ${cy-12} L${cx+18} ${cy}" stroke="#5E4026" stroke-width="2"/>`);
    if(p){const done=D.ready(p,K),k=done?1:Math.min(1,(K-p.at+(p.skip||0)*D.SKIP_CARDS)/p.need),h=4+k*12;
      const col=p.crop==='ember'?'#E4572E':p.crop==='pump'?'#F2994A':'#9C6BFF';
      [[-10,-3],[4,2],[-2,-9],[12,-4]].forEach(([dx,dy])=>{const x=cx+dx,y=cy+dy;
        out.push(`<path d="M${x} ${y} C ${x-4} ${y-h*.6} ${x-2} ${y-h} ${x} ${y-h} C ${x+2} ${y-h} ${x+4} ${y-h*.6} ${x} ${y} Z" fill="#4E9A3E"/>`);
        if(done)out.push(`<circle cx="${x}" cy="${y-h}" r="3.6" fill="${col}" stroke="#5A3C22" stroke-width=".8"/>`)})}
  });
  out.push(`<path d="M-62 2 L0 33 L62 2" stroke="#C9A86A" stroke-width="3" fill="none"/>`);
  return out.join('')}

/* строительные леса и полоска остатка */
function scaffold(job,K,D){const k=Math.max(0,Math.min(1,(K-job.at+(job.skip||0)*D.SKIP_CARDS)/job.need));
  return `<g class="drg-scaf"><path d="M-40 6 L-40 -50 M40 6 L40 -50 M-40 -50 L40 -50 M-40 -22 L40 -22 M-40 -50 L40 -22 M40 -50 L-40 -22" stroke="#B5833F" stroke-width="3" fill="none"/>
    <rect x="-34" y="-74" width="68" height="9" rx="4.5" fill="rgba(0,0,0,.45)"/><rect x="-32" y="-72" width="${(64*k).toFixed(1)}" height="5" rx="2.5" fill="#7CD67A"/></g>`}

function bubble(kind,txt,full){const bg=kind==='gold'?(full?'#F2C94C':'#FFF4C9'):kind==='food'?'#E6F7D9':'#FFFFFF';
  const ic=kind==='gold'?'🪙':kind==='food'?'🌾':kind==='lock'?'🔒':'🔨';
  return `<g class="drg-bub${full?' full':''}" transform="translate(0 -112)"><rect x="-30" y="-15" width="60" height="26" rx="13" fill="${bg}" stroke="rgba(0,0,0,.25)"/><text x="-17" y="4" font-size="13">${ic}</text><text x="6" y="4" font-size="12" font-weight="700" fill="#3A2A10" text-anchor="middle">${txt}</text></g>`}

/* ---------- всё вместе ---------- */
function svg(st,opt){
  const D=root.DECO,W=root.DRAW,G=root.DRG,K=opt.K,sel=opt.sel,place=opt.place,key=opt.key||'i',ro=!!opt.readonly;
  const out=[`<svg class="drg-isl" viewBox="0 ${VY} ${VW} ${VH}" role="img" aria-label="Остров драконов">`];
  out.push(`<defs><radialGradient id="sea${key}" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="var(--isl-sea1)"/><stop offset="1" stop-color="var(--isl-sea2)"/></radialGradient></defs>`);
  if(!opt.bare){
  out.push(`<rect y="${VY}" width="${VW}" height="${VH}" fill="url(#sea${key})"/>`);
  /* берег под всем островом */
  const all=dia(0,0,D.GRID,D.GRID),[t0,r0,b0,l0]=[P(0,0),P(D.GRID,0),P(D.GRID,D.GRID),P(0,D.GRID)];
  out.push(`<polygon points="${[[t0[0],t0[1]-10],[r0[0]+14,r0[1]],[b0[0],b0[1]+16],[l0[0]-14,l0[1]]].map(pt).join(' ')}" fill="var(--isl-sand)" opacity=".9"/>`);
  out.push(`<polygon points="${all}" fill="var(--isl-wild)"/>`);
  /* участки земли */
  for(let cx=0;cx<D.GRID/D.CHUNK;cx++)for(let cy=0;cy<D.GRID/D.CHUNK;cy++){
    const id=cx+','+cy,open=st.land.includes(id),x=cx*D.CHUNK,y=cy*D.CHUNK;
    if(open){out.push(`<polygon points="${dia(x,y,D.CHUNK,D.CHUNK)}" fill="var(--isl-grass)"/>`);
      const ln=[];for(let k=1;k<D.CHUNK;k++){ln.push(`M${pt(P(x+k,y))} L${pt(P(x+k,y+D.CHUNK))}`,`M${pt(P(x,y+k))} L${pt(P(x+D.CHUNK,y+k))}`)}
      out.push(`<path d="${ln.join(' ')}" stroke="var(--isl-line)" stroke-width="1" fill="none"/>`)}
    else{const c=P(x+2,y+2),o=P(cx===0?x:cx===2?x+D.CHUNK:x+2,cy===0?y:cy===2?y+D.CHUNK:y+2),bc=[c[0]+(o[0]-c[0])*.45,c[1]+(o[1]-c[1])*.45];
      [[-34,-6],[22,-14],[-6,10],[38,8],[-44,14]].forEach(([dx,dy],k)=>{const tx=c[0]+dx,ty=c[1]+dy;out.push(`<path d="M${tx} ${ty} l-9 0 l9 -22 l9 22 Z" fill="${k%2?'#3F7A3A':'#4C8C45'}" opacity=".9"/>`)});
      const cost=D.LAND_COST[id];
      if(cost&&!ro)out.push(`<g class="drg-land" data-act="drgland" data-c="${id}" transform="translate(${bc[0].toFixed(1)} ${bc[1].toFixed(1)})"><polygon points="${dia(x,y,D.CHUNK,D.CHUNK).split(' ').map(s=>{const [a,b]=s.split(',').map(Number);return (a-bc[0]).toFixed(1)+','+(b-bc[1]).toFixed(1)}).join(' ')}" fill="rgba(255,255,255,.001)"/><rect x="-34" y="-14" width="68" height="24" rx="12" fill="rgba(20,30,25,.7)"/><text x="0" y="3" font-size="11.5" font-weight="700" fill="#fff" text-anchor="middle">🔒 ${cost.gold?cost.gold+' 🪙':cost.gems+' 💎'}</text></g>`)}
  }
  }
  /* клетки для установки */
  if(place){
    const cells=[];for(let i=0;i<D.GRID-1;i++)for(let j=0;j<D.GRID-1;j++){
      const okp=D.canPlace(st,i,j,place.move||null);
      cells.push(`<polygon class="drg-cell${okp?' ok':''}" points="${dia(i,j,1,1)}" ${okp?`data-act="drgtile" data-x="${i}" data-y="${j}"`:''}/>`)}
    out.push(`<g class="drg-cells">${cells.join('')}</g>`)}
  /* постройки по глубине */
  const list=st.bld.slice().sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x);
  list.forEach(b=>{
    const c=P(b.x+1,b.y+1),T=D.TYPES[b.type],job=b.build||b.up,isSel=sel===b.id,moving=place&&place.move===b.id;
    out.push(`<g class="drg-b${isSel?' sel':''}${moving?' moving':''}" ${ro?'':`data-act="drgsel" data-id="${b.id}"`} transform="translate(${c[0].toFixed(1)} ${c[1].toFixed(1)})"><title>${T.name}</title>`);
    out.push(plate(b.type));
    if(isSel)out.push(`<path d="M0 -34 L68 0 L0 34 L-68 0 Z" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="6 4"/>`);
    if(b.build){out.push(scaffold(b.build,K,D))}
    else{
      out.push(T.kind==='farm'?farmSprite(b,st,K,D):`<g transform="scale(1.22)">${(SPR[b.type]||SPR.nest)()}</g>`);
      if(T.kind==='hab'){
        const ds=st.dragons.filter(d=>d.home===b.id),pos=[[-40,6],[34,10],[-6,22],[48,-10]];
        ds.forEach((d,k)=>{const [dx,dy]=pos[k%4],s=W.svg(G.phenotype(d.genome),{key:key+b.id+d.id,size:62,label:''});
          out.push(s.replace('<svg class="dragon"',`<svg class="dragon drg-on" x="${dx-31}" y="${dy-48}"`))})}
      if(b.up)out.push(scaffold(b.up,K,D))}
    /* пузырь над зданием */
    if(!ro){
      if(job&&!D.ready(job,K))out.push(bubble('build',D.left(job,K)+' к.'));
      else if(T.kind==='hab'){const a=Math.floor(D.chestNow(st,b,K));if(a>=1)out.push(bubble('gold',a>=1000?Math.floor(a/100)/10+'к':a,a>=D.chestCap(b)))}
      else if(T.kind==='farm'){const r=(b.plots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)out.push(bubble('food','×'+r))}}
    out.push(`</g>`)});
  out.push(`</svg>`);
  return out.join('')}

const ISL={svg,P,VW,VH};
if(typeof module!=='undefined'&&module.exports)module.exports=ISL;else root.ISL=ISL;
})(typeof window!=='undefined'?window:globalThis);
