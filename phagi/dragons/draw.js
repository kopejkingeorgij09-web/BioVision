/* Рисунок дракона по фенотипу (SVG). Только внешность: генотип отсюда не виден.
   id градиентов строятся из key, чтобы HTML не менялся между рендерами (patchMain переиспользует узлы).
   Возраст (stage): 0 малыш (1–3 ур.), 1 подросток (4–9 ур.), 2 взрослый (10+): у малыша крупная голова, короткая шея и крылышки. */
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

const stageOf=lvl=>(lvl||1)>=16?3:(lvl||1)>=10?2:(lvl||1)>=6?1:0;
const STAGE_NAME=['детёныш','подросток','взрослый','развитый взрослый'];

/* силуэты (вид сбоку, морда вправо) */
const BODY='M62 110 C 60 90 80 76 106 76 C 132 76 150 90 151 108 C 152 126 134 139 106 139 C 80 139 63 128 62 110 Z';
const NECK='M122 90 C 126 72 138 58 151 47 C 160 49 168 55 174 63 C 162 74 155 90 151 110 C 140 104 130 98 122 90 Z';
const HEAD='M147 45 C 150 32 165 27 180 31 C 191 34 199 40 207 46 C 211 50 210 55 205 58 C 198 62 190 64 182 66 C 172 70 159 70 153 64 C 147 58 145 51 147 45 Z';
const TAIL='M66 98 C 46 103 34 115 26 127 C 20 135 16 139 11 139 C 18 146 29 143 35 136 C 45 124 55 119 70 121 Z';
const WING='M0 0 Q -6 -32 -20 -62 L -6 -100 Q -24 -78 -58 -92 Q -58 -72 -96 -62 Q -76 -46 -104 -20 Q -74 -14 -50 2 Q -24 6 0 0 Z';
const WING_S='M0 0 C -1 -10 -3 -20 -4 -26 Q -10 -32 -20 -36 Q -22 -26 -34 -24 Q -28 -14 -30 -4 Q -14 3 0 0 Z';
const BONES='M0 0 Q -6 -32 -20 -62 L -6 -100 M -20 -62 L -58 -92 M -20 -62 L -96 -62 M -20 -62 L -104 -20';
const BONES_S='M0 0 L -4 -26 L -20 -36 M -4 -26 L -34 -24 M -4 -26 L -30 -4';
const SPINE=[[150,44],[141,57],[133,69],[124,80],[111,76],[97,76],[84,79],[73,86],[61,99],[48,107],[37,116],[28,126]];

/* дыхание стихии у пасти */
function breathFX(el,x,y){
  switch(el){
    case 'F':return `<path d="M${x} ${y} C ${x+8} ${y-8} ${x+14} ${y-2} ${x+12} ${y-10} C ${x+20} ${y-2} ${x+16} ${y+8} ${x+4} ${y+5} Z" fill="#FF9F2F"/><path d="M${x+2} ${y+1} C ${x+7} ${y-3} ${x+11} ${y} ${x+10} ${y-4} C ${x+14} ${y+1} ${x+11} ${y+5} ${x+3} ${y+4} Z" fill="#FFE27A"/>`;
    case 'W':return `<path d="M${x+6} ${y-6} q 3 5 0 7 q -3 -2 0 -7 Z M${x+12} ${y} q 3 5 0 7 q -3 -2 0 -7 Z M${x+5} ${y+5} q 2 4 0 5 q -2 -1 0 -5 Z" fill="#7CC4FF" stroke="#2F80D1" stroke-width=".8"/>`;
    case 'T':return `<g fill="#B08A5C" stroke="#5E4428" stroke-width=".8"><circle cx="${x+6}" cy="${y-2}" r="2.6"/><circle cx="${x+12}" cy="${y+3}" r="2"/><circle cx="${x+5}" cy="${y+6}" r="1.6"/></g>`;
    case 'A':return `<path d="M${x+2} ${y-2} c 6 -4 12 0 8 4 c -3 3 -7 0 -4 -2 M${x+4} ${y+5} c 6 -2 10 2 6 4" stroke="#BFE3FF" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'P':return `<path d="M${x+2} ${y} C ${x+6} ${y-8} ${x+14} ${y-8} ${x+16} ${y-4} C ${x+12} ${y} ${x+6} ${y+2} ${x+2} ${y} Z M${x+4} ${y+4} C ${x+8} ${y+2} ${x+14} ${y+4} ${x+14} ${y+8} C ${x+10} ${y+9} ${x+6} ${y+8} ${x+4} ${y+4} Z" fill="#6CC24A" stroke="#2F5D22" stroke-width=".8"/>`;
    case 'L':return `<path d="M${x+9} ${y-9} L${x+11} ${y-2} L${x+18} ${y} L${x+11} ${y+2} L${x+9} ${y+9} L${x+7} ${y+2} L${x} ${y} L${x+7} ${y-2} Z" fill="#FFF3B0" stroke="#E2B33C" stroke-width=".8"/>`;
    case 'D':return `<path d="M${x+1} ${y} c 6 -6 10 2 14 -4 c -1 7 -8 6 -10 10 c 2 -4 -2 -6 -4 -6 Z" fill="#7A52C7" opacity=".85"/><circle cx="${x+14}" cy="${y+5}" r="1.6" fill="#C9A8FF"/>`;
  }return ''}

function svg(ph,opt){
  if(root.DRELEMENT&&root.DRART_MANIFEST)return root.DRELEMENT.svg(ph,opt);
  opt=opt||{};
  const key=String(opt.key||'d').replace(/[^A-Za-z0-9_-]/g,'');
  const size=opt.size||160,stage=opt.stage==null?2:opt.stage;
  const cols=baseColors(ph),c1=cols[0],c2=cols[1]||cols[0],two=cols.length>1;
  const belly=mix(c1,'#FFF6DE',0.6),edge=mix(c1,'#14101A',0.55),wingC=mix(c2,'#FFFFFF',0.15),dark=mix(c1,'#000',0.22),mark=two?mix(c2,'#000',0.1):mix(c1,'#000',0.28);
  const horn=mix(belly,'#E8DCC0',0.5),claw='#F4ECD8';
  const g='dg'+key,sh='ds'+key,wg='dw'+key,mt='dm'+key,sc='dc'+key,cl='dk'+key;
  const ws=ph.shortWings?1:(0.8+ph.span*0.05)*(stage===0?0.62:stage===1?0.85:1);
  const SW=2.2,o=[];
  o.push(`<svg class="dragon" viewBox="0 -26 220 196" width="${size}" height="${Math.round(size*196/220)}" role="img" aria-label="${opt.label||'Дракон'}">`);
  o.push(`<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(c1,'#fff',0.08)}"/><stop offset=".6" stop-color="${c1}"/><stop offset="1" stop-color="${two?c2:dark}"/></linearGradient>`);
  o.push(`<radialGradient id="${sh}" cx=".38" cy=".22" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>`);
  o.push(`<linearGradient id="${wg}" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${mix(wingC,'#000',0.15)}"/><stop offset=".55" stop-color="${wingC}"/><stop offset="1" stop-color="${mix(wingC,'#FFFFFF',0.4)}"/></linearGradient>`);
  o.push(`<pattern id="${sc}" width="9" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 Q4.5 1 9 7 M-4.5 3.5 Q0 -2.5 4.5 3.5 M4.5 3.5 Q9 -2.5 13.5 3.5" stroke="${edge}" stroke-width=".9" fill="none" opacity=".35"/></pattern>`);
  o.push(`<clipPath id="${cl}"><path d="${BODY}"/></clipPath>`);
  if(ph.metal)o.push(`<linearGradient id="${mt}" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity=".06"/><stop offset=".62" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
  o.push(`</defs>`);
  o.push(`<ellipse cx="104" cy="159" rx="${stage===0?52:70}" ry="7" fill="#000" opacity=".16"/>`);
  /* малыш: всё тело чуть меньше и ниже, голова крупнее */
  const bodyT=stage===0?'translate(26 34) scale(.76)':stage===1?'translate(11 15) scale(.9)':'';
  o.push(`<g transform="${bodyT}">`);
  /* дальнее крыло */
  const wing=ph.shortWings?WING_S:WING,bones=ph.shortWings?BONES_S:BONES;
  o.push(`<g transform="translate(126 82) rotate(30) scale(${(ws*0.8).toFixed(2)})"><path d="${wing}" fill="${mix(wingC,'#000',0.28)}" stroke="${edge}" stroke-width="${SW+0.4}" stroke-linejoin="round"/><path d="${bones}" stroke="${mix(edge,'#000',0.1)}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/></g>`);
  /* дальние лапы */
  o.push(`<path d="M80 124 C 76 136 76 146 80 153 L 91 153 C 88 146 88 136 92 127 Z" fill="${mix(c1,'#000',0.32)}" stroke="${edge}" stroke-width="${SW}"/>`);
  o.push(`<path d="M136 124 C 138 136 138 146 141 153 L 152 153 C 148 146 148 134 148 121 Z" fill="${mix(c1,'#000',0.32)}" stroke="${edge}" stroke-width="${SW}"/>`);
  /* хвост */
  o.push(`<path d="${TAIL}" fill="url(#${g})" stroke="${edge}" stroke-width="${SW}" stroke-linejoin="round"/><path d="${TAIL}" fill="url(#${sh})"/>`);
  o.push(`<path d="M68 118 C 54 117 44 124 35 134" stroke="${belly}" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".9"/>`);
  if(ph.mace)o.push(`<g transform="translate(11 139)"><path d="M0 -16 L4 -8 L-4 -8 Z M-16 0 L-8 4 L-8 -4 Z M0 16 L4 8 L-4 8 Z M12 -12 L6 -3 L3 -8 Z M-12 12 L-6 3 L-3 8 Z M-12 -12 L-3 -6 L-8 -3 Z" fill="${horn}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/><circle r="9.5" fill="${mix(c1,'#5A5560',0.5)}" stroke="${edge}" stroke-width="${SW}"/><circle cx="-3" cy="-3" r="3" fill="#fff" opacity=".35"/></g>`);
  else o.push(`<path d="M15 135 L2 128 L4 146 L17 142 Z" fill="${mark}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>`);
  /* тело с чешуёй и светотенью */
  o.push(`<path d="${BODY}" fill="url(#${g})" stroke="${edge}" stroke-width="${SW+0.4}"/>`);
  o.push(`<g clip-path="url(#${cl})"><rect x="60" y="74" width="94" height="68" fill="url(#${sc})"/>`);
  o.push(`<path d="M92 78 C 96 86 96 94 90 100 M106 77 C 110 86 110 95 104 102 M120 79 C 124 88 123 96 117 102" stroke="${mark}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/></g>`);
  o.push(`<path d="${BODY}" fill="url(#${sh})"/>`);
  /* брюшные пластины */
  o.push(`<path d="M70 124 C 84 134 100 137 114 136 C 132 134 146 124 150 108 L 154 110 C 150 128 134 140 106 140 C 88 140 76 134 70 124 Z" fill="${belly}" stroke="${edge}" stroke-width="1.2"/>`);
  o.push(`<path d="M82 130 l-1 6 M93 133 l0 6 M104 134 l0 6 M115 133 l1 6 M126 130 l2 6 M137 125 l3 5 M145 118 l4 4" stroke="${mix(belly,edge,0.45)}" stroke-width="1.4" stroke-linecap="round"/>`);
  /* шея */
  o.push(`<path d="${NECK}" fill="url(#${g})" stroke="${edge}" stroke-width="${SW}" stroke-linejoin="round"/><path d="${NECK}" fill="url(#${sh})"/>`);
  o.push(`<path d="M151 110 C 155 90 162 75 174 63 L 170 60 C 160 70 152 86 148 106 Z" fill="${belly}" stroke="${edge}" stroke-width="1.1"/><path d="M151 99 l5 1 M154 88 l5 2 M159 78 l5 2 M165 69 l4 3" stroke="${mix(belly,edge,0.45)}" stroke-width="1.3" stroke-linecap="round"/>`);
  /* гребень вдоль спины и хвоста */
  if(ph.crest!=='none'){
    const big=ph.crest==='big',pts=big?SPINE:SPINE.filter((_,i)=>i%2===1),hh=big?11:6.5;
    o.push(`<path d="${pts.map(([x,y],i)=>{const h=hh*(i>pts.length-4?0.65:1);return `M${x-5} ${y+3} Q${x-3} ${y-h*0.6} ${x-1} ${y-h} Q${x+1} ${y-h*0.4} ${x+5} ${y+3} Z`}).join(' ')}" fill="${two?mix(c2,'#000',0.12):mix(c1,'#000',0.3)}" stroke="${edge}" stroke-width="1.3" stroke-linejoin="round"/>`)}
  /* ближние лапы с бедром и когтями */
  o.push(`<path d="M68 106 C 56 116 58 134 74 138 C 78 142 80 146 80 150 C 78 152 76 154 76 157 L 98 157 C 96 154 92 152 90 150 C 90 146 90 142 92 138 C 100 130 100 118 94 108 Z" fill="url(#${g})" stroke="${edge}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M68 106 C 56 116 58 134 74 138 C 78 142 80 146 80 150 C 78 152 76 154 76 157 L 98 157 C 96 154 92 152 90 150 C 90 146 90 142 92 138 C 100 130 100 118 94 108 Z" fill="url(#${sh})"/>`);
  o.push(`<path d="M130 112 C 124 122 126 132 134 137 C 134 142 133 147 132 151 C 130 153 129 155 129 157 L 150 157 C 148 154 145 152 144 150 C 144 145 145 141 147 137 C 151 128 150 119 146 112 Z" fill="url(#${g})" stroke="${edge}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M130 112 C 124 122 126 132 134 137 C 134 142 133 147 132 151 C 130 153 129 155 129 157 L 150 157 C 148 154 145 152 144 150 C 144 145 145 141 147 137 C 151 128 150 119 146 112 Z" fill="url(#${sh})"/>`);
  o.push(`<path d="M78 156 l-5 4 l6 -1 Z M87 157 l-2 5 l4 -4 Z M96 156 l3 5 l1 -5 Z M131 156 l-5 4 l6 -1 Z M140 157 l-2 5 l4 -4 Z M149 156 l3 5 l1 -5 Z" fill="${claw}" stroke="${edge}" stroke-width="1" stroke-linejoin="round"/>`);
  if(ph.spurs)o.push(`<path d="M73 138 l-10 -1 l8 6 Z M126 140 l-10 -1 l8 6 Z" fill="${claw}" stroke="${edge}" stroke-width="1.2" stroke-linejoin="round"/>`);
  o.push(`</g>`);
  /* голова: у малыша крупнее и ниже */
  const headT=stage===0?'translate(-22 7) scale(1.12)':stage===1?'translate(9 4) scale(.96)':'';
  o.push(`<g transform="${headT}">`);
  if(ph.horns){const k=stage===0?0.55:stage===1?0.8:1;
    o.push(`<g transform="translate(162 38) scale(${k}) translate(-162 -38)"><path d="M159 39 C 152 24 142 16 128 14 C 139 20 145 30 149 43 Z" fill="${mix(horn,'#000',0.12)}" stroke="${edge}" stroke-width="1.8" stroke-linejoin="round"/><path d="M169 35 C 168 20 162 9 149 3 C 157 13 160 23 161 37 Z" fill="${horn}" stroke="${edge}" stroke-width="1.8" stroke-linejoin="round"/><path d="M152 13 l3 5 M156 21 l3 4 M160 28 l2 4 M137 17 l1 5 M143 23 l0 5" stroke="${mix(horn,edge,0.5)}" stroke-width="1.1" stroke-linecap="round"/></g>`)}
  /* щёчный воротник */
  o.push(`<path d="M151 46 L136 38 L148 52 Z M152 57 L137 61 L152 64 Z M156 66 L146 74 L160 69 Z" fill="${mark}" stroke="${edge}" stroke-width="1.3" stroke-linejoin="round"/>`);
  o.push(`<path d="${HEAD}" fill="url(#${g})" stroke="${edge}" stroke-width="${SW+0.4}" stroke-linejoin="round"/><path d="${HEAD}" fill="url(#${sh})"/>`);
  /* нижняя челюсть, зубы, ноздря, надбровье */
  o.push(`<path d="M160 64 C 172 66 186 63 205 57" stroke="${edge}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M184 63 l2 4.5 l2 -5 Z M191 61.5 l2 4.5 l2 -5 Z M197 59.5 l1.6 4 l1.8 -4.6 Z" fill="#FFFBEF" stroke="${edge}" stroke-width=".7"/>`);
  o.push(`<path d="M163 39 C 170 34 179 34 186 39" stroke="${mix(c1,'#000',0.4)}" stroke-width="3.4" fill="none" stroke-linecap="round"/><ellipse cx="201" cy="47.5" rx="2.2" ry="1.5" fill="${edge}"/>`);
  if(ph.metal)o.push(`<path d="${HEAD}" fill="url(#${mt})"/>`);
  /* глаз: ночное зрение = крупный со щелевидным зрачком; свечение = ореол; дремлющий = веко опущено */
  const er=(ph.night?6.4:4.8)*(stage===0?1.3:1),ex=176,ey=46;
  if(ph.glow)o.push(`<circle cx="${ex}" cy="${ey}" r="${er+8}" fill="#BFF7FF" opacity=".5"/><circle cx="${ex}" cy="${ey}" r="${er+4}" fill="#E6FCFF" opacity=".7"/>`);
  o.push(`<ellipse cx="${ex}" cy="${ey}" rx="${er}" ry="${er*0.92}" fill="${ph.glow?'#7FF3FF':'#FFF4C2'}" stroke="${edge}" stroke-width="1.6"/>`);
  o.push(`<circle cx="${ex+1}" cy="${ey}" r="${er*0.66}" fill="${ph.glow?'#22C7E0':ph.night?'#7AD14A':'#F2A33A'}"/>`);
  o.push(ph.night?`<ellipse cx="${ex+1}" cy="${ey}" rx="1.3" ry="${er*0.6}" fill="#14101A"/>`:`<circle cx="${ex+1}" cy="${ey}" r="${er*0.32}" fill="#14101A"/>`);
  o.push(`<circle cx="${ex-1}" cy="${ey-2}" r="${Math.max(1.2,er*0.24)}" fill="#fff"/>`);
  if(ph.breath==='dormant')o.push(`<path d="M${ex-er-1.5} ${ey+0.5} A ${er+1.5} ${er+1.5} 0 0 1 ${ex+er+1.5} ${ey+0.5} Z" fill="${mix(c1,'#000',0.1)}" stroke="${edge}" stroke-width="1.6"/><path d="M${ex-er} ${ey+1} q ${er} 3 ${er*2} 0" stroke="${edge}" stroke-width="1.2" fill="none"/>`);
  if(ph.breath==='element')o.push(breathFX(ph.elements[0],207,54));
  else if(ph.breath==='smoke')o.push(`<circle cx="210" cy="45" r="4.5" fill="${SMOKE}" opacity=".45"/><circle cx="215" cy="37" r="3.2" fill="${SMOKE}" opacity=".32"/><circle cx="212" cy="30" r="2.2" fill="${SMOKE}" opacity=".2"/>`);
  o.push(`</g>`);
  /* ближнее крыло поверх тела */
  o.push(`<g transform="${bodyT}"><g transform="translate(114 88) rotate(-4) scale(${ws.toFixed(2)})"><path d="${wing}" fill="url(#${wg})" stroke="${edge}" stroke-width="${(SW+0.6)/ws}" stroke-linejoin="round"/>`);
  o.push(`<path d="${bones}" stroke="${mix(c2,'#000',0.35)}" stroke-width="${3.2/ws}" fill="none" stroke-linecap="round"/>`);
  if(!ph.shortWings)o.push(`<path d="M-20 -62 l5 -10 l1 11 Z" fill="${claw}" stroke="${edge}" stroke-width="${1/ws}"/><path d="M-24 -56 Q -40 -70 -50 -82 M-26 -50 Q -56 -56 -84 -60 M-26 -44 Q -60 -36 -90 -28" stroke="#fff" stroke-width="${1.2/ws}" fill="none" opacity=".35"/>`);
  o.push(`</g>`);
  if(ph.metal)o.push(`<path d="${BODY}" fill="url(#${mt})"/><path d="M96 84 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z M134 100 l1.4 -3.5 l1.4 3.5 l3.5 1.4 l-3.5 1.4 l-1.4 3.5 l-1.4 -3.5 l-3.5 -1.4 Z" fill="#fff" opacity=".9"/>`);
  o.push(`</g></svg>`);
  return o.join('')}

/* Описание внешности словами (без генотипа) */
const ELN={F:'огонь',W:'вода',T:'земля',A:'воздух',P:'флора',L:'свет',D:'тьма'};
function describe(ph){return [ph.breath==='dormant'?'Дремлющий: стихия подавлена геном S':ph.breath==='smoke'?'Дымный: без стихии':'Стихии: '+ph.elements.map(e=>ELN[e]).join(' и '),'Внешность декоративная; боевые параметры зависят от уровня и роли стихии']}

const DRAW={svg,describe,EL_COL,ELN,stageOf,STAGE_NAME};
if(typeof module!=='undefined'&&module.exports)module.exports=DRAW;else root.DRAW=DRAW;
})(typeof window!=='undefined'?window:globalThis);
