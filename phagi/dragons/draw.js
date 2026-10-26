/* Рисунок дракона по фенотипу (SVG). Только внешность: генотип отсюда не виден.
   id градиентов строятся из key, чтобы HTML не менялся между рендерами (patchMain переиспользует узлы). */
(function(root){
'use strict';
const EL_COL={F:'#E4572E',W:'#2F80D1',T:'#9A6B3A',A:'#8FC3E0',P:'#46A659',L:'#F2C94C',D:'#5B3F8C'};
const SMOKE='#8C8F96',DORMANT='#A9A49A';

function hex2rgb(h){const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255]}
function rgb2hex(r){return '#'+r.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('')}
function mix(a,b,t){const x=hex2rgb(a),y=hex2rgb(b);return rgb2hex(x.map((v,i)=>v+(y[i]-v)*t))}

/* окрас C меняет оттенок стихии: тёмный глубже, бронзовый с медью, бледный светлее */
function tone(c,color){return color==='dark'?mix(c,'#1E1A24',0.22):color==='bronze'?mix(c,'#B07A3C',0.45):mix(c,'#FFFFFF',0.42)}

function baseColors(ph){
  const els=ph.breath==='element'?ph.elements:[];
  const raw=els.length?els.map(e=>EL_COL[e]||SMOKE):[ph.breath==='smoke'?SMOKE:DORMANT];
  return raw.map(c=>tone(c,ph.color))}

function svg(ph,opt){
  opt=opt||{};
  const key=String(opt.key||'d').replace(/[^A-Za-z0-9_-]/g,'');
  const size=opt.size||160;
  const cols=baseColors(ph),c1=cols[0],c2=cols[1]||cols[0];
  const belly=mix(c1,'#FFF6DE',0.55),edge=mix(c1,'#14101A',0.45),wingC=mix(c2,'#FFFFFF',0.18);
  const gid='dg'+key,mid='dm'+key,wid='dw'+key;
  /* размах 0..6 → масштаб крыла; короткие крылья маленькие и круглые */
  const ws=ph.shortWings?0.48:0.72+ph.span*0.09;
  const out=[];
  out.push(`<svg class="dragon" viewBox="0 -26 220 196" width="${size}" height="${Math.round(size*196/220)}" role="img" aria-label="${opt.label||'Дракон'}">`);
  out.push(`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`);
  out.push(`<linearGradient id="${wid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${wingC}" stop-opacity=".95"/><stop offset="1" stop-color="${mix(wingC,'#FFFFFF',0.35)}" stop-opacity=".8"/></linearGradient>`);
  if(ph.metal)out.push(`<linearGradient id="${mid}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(25)"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  out.push(`</defs>`);
  out.push(`<ellipse cx="108" cy="158" rx="70" ry="7" fill="#000" opacity=".12"/>`);
  /* крыло сзади: точка крепления на спине (96,84) */
  const wing=ph.shortWings
    ?`M0 0 C -6 -22 10 -40 30 -38 C 40 -28 38 -12 30 -2 C 22 -8 14 -6 8 2 Z`
    :`M0 0 C -14 -40 6 -78 44 -86 C 52 -70 66 -56 82 -50 C 70 -40 62 -26 58 -10 C 48 -20 36 -18 30 -8 C 22 -16 10 -12 0 0 Z`;
  const ribs=ph.shortWings?'':`<path d="M0 0 L44 -86 M0 0 L82 -50 M0 0 L58 -10" stroke="${edge}" stroke-width="2.2" fill="none" opacity=".55"/>`;
  out.push(`<g transform="translate(92 86) scale(${ws.toFixed(2)})"><path d="${wing}" fill="url(#${wid})" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>${ribs}</g>`);
  /* хвост */
  out.push(`<path d="M66 112 C 40 120 28 140 10 132 C 22 138 40 136 62 124 Z" fill="url(#${gid})" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>`);
  if(ph.mace)out.push(`<g transform="translate(12 132)"><circle r="9" fill="${mix(c1,'#5A5560',0.45)}" stroke="${edge}" stroke-width="2.2"/><path d="M0 -15 L3 -8 L-3 -8 Z M-15 0 L-8 3 L-8 -3 Z M0 15 L3 8 L-3 8 Z M11 -11 L5 -3 L3 -7 Z M-11 11 L-5 3 L-3 7 Z" fill="${edge}"/></g>`);
  else out.push(`<path d="M12 128 L2 134 L13 137 Z" fill="${edge}"/>`);
  /* задняя лапа, тело, передняя лапа */
  out.push(`<path d="M76 118 C 72 134 74 146 84 150 L96 150 C 92 140 94 128 96 120 Z" fill="${mix(c1,'#000',0.12)}" stroke="${edge}" stroke-width="2.2"/>`);
  out.push(`<ellipse cx="104" cy="108" rx="44" ry="30" fill="url(#${gid})" stroke="${edge}" stroke-width="2.6"/>`);
  out.push(`<path d="M80 122 C 96 136 122 136 140 120 C 126 126 100 128 80 122 Z" fill="${belly}" opacity=".9"/>`);
  out.push(`<path d="M126 120 C 124 134 126 144 134 150 L146 150 C 142 140 142 130 142 118 Z" fill="${mix(c1,'#000',0.06)}" stroke="${edge}" stroke-width="2.2"/>`);
  out.push(`<path d="M84 150 l-4 4 M90 150 l0 5 M96 150 l4 4 M134 150 l-4 4 M140 150 l0 5 M146 150 l4 4" stroke="${edge}" stroke-width="2" stroke-linecap="round"/>`);
  if(ph.spurs)out.push(`<path d="M76 136 l-8 -2 l7 6 Z M126 136 l-8 -2 l7 6 Z" fill="${mix(edge,'#fff',0.3)}" stroke="${edge}" stroke-width="1.2"/>`);
  /* шея и голова */
  out.push(`<path d="M128 92 C 136 72 146 60 156 52 L172 64 C 160 74 150 88 146 104 Z" fill="url(#${gid})" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>`);
  out.push(`<path d="M150 40 C 166 32 190 38 200 50 C 204 58 198 66 186 68 L166 70 C 154 70 146 60 150 40 Z" fill="url(#${gid})" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round"/>`);
  out.push(`<path d="M186 68 C 192 66 198 62 200 56" stroke="${edge}" stroke-width="2" fill="none"/><circle cx="194" cy="50" r="1.8" fill="${edge}"/>`);
  if(ph.horns)out.push(`<path d="M160 40 C 156 26 148 18 136 14 C 146 22 150 32 152 42 Z M170 37 C 170 24 166 14 158 8 C 164 18 165 28 164 38 Z" fill="${mix(belly,'#E8DCC0',0.4)}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>`);
  /* гребень вдоль спины: число и высота шипов от R */
  if(ph.crest!=='none'){
    const h=ph.crest==='big'?12:7,pts=ph.crest==='big'?[[150,46],[142,62],[134,78],[118,80],[102,79],[86,82],[72,90]]:[[142,62],[130,80],[110,79],[90,81]];
    out.push(`<path d="${pts.map(([x,y])=>`M${x-5} ${y+3} L${x} ${y-h} L${x+5} ${y+3} Z`).join(' ')}" fill="${mix(c2,'#000',0.25)}" stroke="${edge}" stroke-width="1.4" stroke-linejoin="round"/>`);
  }
  /* глаз: ночное зрение = большой глаз со щелевидным зрачком; свечение = ореол */
  const er=ph.night?6.5:4.6,ex=174,ey=50;
  if(ph.glow)out.push(`<circle cx="${ex}" cy="${ey}" r="${er+7}" fill="#BFF7FF" opacity=".55"/><circle cx="${ex}" cy="${ey}" r="${er+3.5}" fill="#E6FCFF" opacity=".7"/>`);
  out.push(`<circle cx="${ex}" cy="${ey}" r="${er}" fill="${ph.glow?'#7FF3FF':'#FFF7D6'}" stroke="${edge}" stroke-width="1.8"/>`);
  out.push(ph.night?`<ellipse cx="${ex+1}" cy="${ey}" rx="1.4" ry="${er-1}" fill="#14101A"/>`:`<circle cx="${ex+1}" cy="${ey}" r="2.3" fill="#14101A"/>`);
  if(ph.breath==='dormant')out.push(`<path d="M${ex-er-1} ${ey} A ${er+1} ${er+1} 0 0 1 ${ex+er+1} ${ey} Z" fill="${mix(c1,'#000',0.1)}" stroke="${edge}" stroke-width="1.6"/>`);
  if(ph.metal)out.push(`<ellipse cx="104" cy="108" rx="44" ry="30" fill="url(#${mid})"/><path d="M150 40 C 166 32 190 38 200 50 C 204 58 198 66 186 68 L166 70 C 154 70 146 60 150 40 Z" fill="url(#${mid})"/>`);
  /* дыхание: язычок стихии у пасти */
  if(ph.breath==='element'){const c=EL_COL[ph.elements[0]];out.push(`<path d="M201 56 C 208 50 214 54 216 48 C 216 58 210 62 202 60 Z" fill="${c}" opacity=".85"/>`)}
  else if(ph.breath==='smoke')out.push(`<circle cx="206" cy="50" r="4" fill="${SMOKE}" opacity=".45"/><circle cx="212" cy="44" r="3" fill="${SMOKE}" opacity=".3"/>`);
  out.push(`</svg>`);
  return out.join('')}

/* Описание внешности словами (без генотипа) */
const ELN={F:'огонь',W:'вода',T:'земля',A:'воздух',P:'флора',L:'свет',D:'тьма'};
function describe(ph){
  const l=[];
  l.push(ph.breath==='dormant'?'Дремлющий: железа не работает':ph.breath==='smoke'?'Дымный: без стихии':'Стихия: '+ph.elements.map(e=>ELN[e]).join(' и '));
  l.push('Окрас: '+({dark:'тёмный',bronze:'бронзовый',pale:'бледный'})[ph.color]);
  l.push(ph.horns?'С рогами':'Без рогов');
  l.push(ph.mace?'Хвост с булавой':'Хвост без булавы');
  l.push('Гребень: '+({big:'большой',mid:'средний',none:'нет'})[ph.crest]);
  l.push(ph.shortWings?'Короткие крылья':'Размах крыльев '+String(ph.spanM).replace('.',',')+' м');
  if(ph.metal)l.push('Чешуя с металлическим блеском');
  if(ph.night)l.push('Ночное зрение');
  if(ph.glow)l.push('Светящиеся глаза');
  if(ph.spurs)l.push('Шпоры на лапах');
  return l}

const DRAW={svg,describe,EL_COL,ELN};
if(typeof module!=='undefined'&&module.exports)module.exports=DRAW;else root.DRAW=DRAW;
})(typeof window!=='undefined'?window:globalThis);
