/* Рисунок острова: летающий остров в облаках, изометрическая сетка 12×12, постройки 2×2, драконы у своих сред.
   Только SVG-строка, без состояния. Нажатия ловит общий обработчик страницы по data-act.
   Анимации (облака, лава, вода) идут от общего часового сдвига --clk, его ставит ui.js, поэтому перерисовка их не сбрасывает. */
(function(root){
'use strict';
const TW=64,TH=32,OX=400,OY=110;
const VIEW={norm:[10,70,780,520],full:[-260,-40,1320,760]};
const P=(i,j)=>[(i-j)*TW/2+OX,(i+j)*TH/2+OY];
const pt=a=>a[0].toFixed(1)+','+a[1].toFixed(1);
const dia=(i,j,w,h)=>[P(i,j),P(i+w,j),P(i+w,j+h),P(i,j+h)].map(pt).join(' ');
const f1=x=>Math.round(x*10)/10;
/* детерминированный шум по строке: остров у всех одинаковый и не дрожит между рендерами */
function hrand(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%100000)/100000}

/* ---------- мелкие детали ---------- */
function tree(x,y,s,k,v){v=v||0;const c=['#5DB03A','#4E9F33','#6BBE45'][v%3];
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})"><ellipse cx="2" cy="1" rx="13" ry="5" fill="#000" opacity=".18"/><path d="M-2 0 C -2 -10 -3 -18 -6 -24 L 2 -24 C 1 -16 2 -8 3 0 Z" fill="#7A4E2C"/>
  <circle cx="-9" cy="-28" r="10" fill="${c}"/><circle cx="8" cy="-30" r="11" fill="${c}"/><circle cx="-1" cy="-40" r="12" fill="url(#${k}-leaf)"/><circle cx="-10" cy="-30" r="9" fill="url(#${k}-leaf)"/><circle cx="9" cy="-31" r="10" fill="url(#${k}-leaf)"/>
  <circle cx="-5" cy="-45" r="4" fill="#fff" opacity=".22"/></g>`}
function bush(x,y,s,k){return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})"><ellipse cx="1" cy="1" rx="12" ry="4" fill="#000" opacity=".16"/><circle cx="-6" cy="-5" r="7" fill="#4E9F33"/><circle cx="6" cy="-5" r="7" fill="#4E9F33"/><circle cx="0" cy="-10" r="8" fill="url(#${k}-leaf)"/><circle cx="4" cy="-8" r="1.6" fill="#F28CB1"/><circle cx="-5" cy="-11" r="1.4" fill="#FFF3B0"/></g>`}
function rock(x,y,s,c){c=c||['#D9C59B','#B79E72','#8E7752'];
  return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})"><ellipse cx="0" cy="2" rx="14" ry="4.5" fill="#000" opacity=".18"/><path d="M-13 2 L-11 -9 L-3 -17 L8 -15 L14 -6 L12 2 Z" fill="${c[1]}"/><path d="M-11 -9 L-3 -17 L8 -15 L3 -7 Z" fill="${c[0]}"/><path d="M3 -7 L8 -15 L14 -6 L12 2 Z" fill="${c[2]}"/><path d="M-11 -9 L3 -7 L12 2" stroke="rgba(0,0,0,.12)" fill="none"/></g>`}
function greyRock(x,y,s){return rock(x,y,s,['#B7BAC2','#8F939D','#6A6E78'])}
function flowers(x,y,seed){const out=[];for(let i=0;i<5;i++){const a=hrand(seed+i),b=hrand(seed+'b'+i);out.push(`<circle cx="${f1(x+(a-.5)*22)}" cy="${f1(y+(b-.5)*10)}" r="1.5" fill="${['#FFFFFF','#FFE27A','#F7A8C8','#BFE3FF'][i%4]}"/>`)}return out.join('')}
function tuft(x,y){return `<path d="M${f1(x-4)} ${f1(y)} q 1 -6 2 -7 M${f1(x)} ${f1(y)} q 0 -8 1 -9 M${f1(x+4)} ${f1(y)} q -1 -6 -2 -7" stroke="#3F8A2C" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"/>`}
function cloud(x,y,s,op){return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})" opacity="${op||1}"><ellipse cx="0" cy="8" rx="70" ry="16" fill="var(--isl-cloud2)"/><circle cx="-38" cy="0" r="22" fill="var(--isl-cloud)"/><circle cx="-8" cy="-14" r="30" fill="var(--isl-cloud)"/><circle cx="26" cy="-6" r="24" fill="var(--isl-cloud)"/><circle cx="50" cy="4" r="16" fill="var(--isl-cloud)"/><ellipse cx="0" cy="10" rx="64" ry="12" fill="var(--isl-cloud)"/><circle cx="-14" cy="-22" r="12" fill="#fff" opacity=".5"/></g>`}

/* ---------- постройки в локальных координатах: центр площадки 2×2 = (0,0), ромб ±64 × ±32 ---------- */
const GROUND={F:'#4A4038',W:'#D9C79A',N:'#8D8A86',T:'#B8936A',A:'#E6EEF4',P:'#5EA83F',L:'#EDE2BE',D:'#3D3450',farm:'#8A6A44',nest:'#C9B48A',hatch:'#BDB3A0'};
function ground(type){return `<path d="M-60 0 Q -40 -22 0 -29 Q 40 -22 60 0 Q 40 22 0 29 Q -40 22 -60 0 Z" fill="${GROUND[type]||'#8A6A44'}" opacity=".85"/><path d="M-60 0 Q -40 22 0 29 Q 40 22 60 0" stroke="rgba(0,0,0,.18)" stroke-width="2" fill="none"/>`}
const HEIGHT={F:74,W:56,N:84,T:88,A:108,P:108,L:100,D:112,farm:34,nest:50,hatch:76};

const SPR={
  F:k=>`${[[-40,-4,1.25],[34,-2,1.1],[-18,10,.9],[22,14,.8],[46,-14,.7],[-46,-16,.8]].map(([x,y,s])=>rock(x,y,s,['#4A4E5E','#34374A','#22242F'])).join('')}
    <path d="M-48 2 C -44 -20 -30 -46 -14 -58 C -6 -64 6 -64 14 -58 C 30 -46 44 -20 48 2 C 26 14 -26 14 -48 2 Z" fill="url(#${k}-basalt)" stroke="#191A22" stroke-width="2"/>
    <path d="M-36 -10 L-26 -14 L-22 -28 L-12 -30 M18 -40 L26 -26 L36 -24 L38 -10 M-4 -50 L-8 -36 L2 -24 L-2 -8" stroke="#1E1F28" stroke-width="2" fill="none" opacity=".6"/>
    <path class="an glo" d="M-30 -6 C -24 -14 -20 -22 -12 -30 M20 -38 C 26 -30 30 -24 36 -14 M0 -50 C -6 -38 2 -26 -2 -8" stroke="url(#${k}-lava)" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="-58" rx="15" ry="6" fill="#FF8A2B"/><ellipse class="an glo" cx="0" cy="-58" rx="10" ry="3.6" fill="#FFE27A"/>
    <ellipse cx="-24" cy="6" rx="9" ry="3.6" fill="#FF7A2F"/><ellipse class="an glo" cx="-24" cy="6" rx="5" ry="2" fill="#FFD36A"/><ellipse cx="30" cy="4" rx="7" ry="3" fill="#FF7A2F"/>
    <g class="an flk"><path d="M-6 -60 C -10 -72 -2 -80 -4 -92 C 4 -84 10 -74 6 -60 Z" fill="#FF9F2F"/><path d="M-3 -60 C -5 -68 0 -72 -1 -80 C 4 -74 6 -68 4 -60 Z" fill="#FFE27A"/></g>
    <circle class="an emb" cx="-8" cy="-66" r="2" fill="#FFB347"/><circle class="an emb e2" cx="8" cy="-64" r="1.6" fill="#FFD36A"/><circle class="an emb e3" cx="2" cy="-70" r="1.4" fill="#FF8A2B"/>`,
  W:k=>`<ellipse cx="0" cy="2" rx="52" ry="24" fill="#9C8F80"/>${Array.from({length:18},(_,i)=>{const a=i/18*Math.PI*2;return `<ellipse cx="${f1(Math.cos(a)*48)}" cy="${f1(Math.sin(a)*21)}" rx="8" ry="5" fill="${i%2?'#B8AC9C':'#CFC4B4'}" stroke="#7E7364" stroke-width="1"/>`}).join('')}
    <ellipse cx="0" cy="0" rx="42" ry="17" fill="url(#${k}-water)"/>
    <ellipse class="an rip" cx="-10" cy="2" rx="12" ry="4.5" fill="none" stroke="#E4F4FF" stroke-width="1.4"/><ellipse class="an rip r2" cx="14" cy="-2" rx="9" ry="3.4" fill="none" stroke="#E4F4FF" stroke-width="1.2"/>
    <ellipse cx="-24" cy="4" rx="6" ry="2.6" fill="#5DB03A"/><path d="M-24 4 l5 -2" stroke="#3F8A2C"/><circle cx="-22" cy="2.6" r="1.6" fill="#F7A8C8"/><ellipse cx="22" cy="7" rx="5" ry="2.2" fill="#6BBE45"/>
    <path d="M24 -14 L30 -50 L46 -46 L50 -12 Z" fill="#9A8F84" stroke="#5E554C" stroke-width="1.6"/><path d="M30 -50 L46 -46 L40 -40 L32 -42 Z" fill="#BDB2A6"/>
    <path class="an fal" d="M36 -44 C 35 -32 34 -22 32 -10" stroke="#CFEAFF" stroke-width="6" fill="none" stroke-dasharray="6 5" stroke-linecap="round"/><ellipse cx="31" cy="-9" rx="7" ry="2.4" fill="#fff" opacity=".7"/>
    <g stroke="#4E8A3A" stroke-width="1.8" stroke-linecap="round"><path d="M-44 -6 q -2 -14 2 -22 M-40 -6 q 1 -12 5 -18 M-48 -4 q -4 -10 -2 -16"/></g><path d="M-42 -28 l0 -5 M-35 -24 l1 -5" stroke="#8A5A2C" stroke-width="3" stroke-linecap="round"/>`,
  N:k=>`${rock(-44,4,1,['#9A8E9E','#7A6E80','#5B5163'])}${rock(46,2,.9,['#9A8E9E','#7A6E80','#5B5163'])}
    <path d="M-52 6 C -54 -30 -34 -70 -2 -74 C 34 -74 54 -36 52 6 C 26 16 -26 16 -52 6 Z" fill="url(#${k}-cave)" stroke="#3E3546" stroke-width="2"/>
    <path d="M-36 -30 C -30 -50 -14 -62 4 -62 M18 -58 C 32 -50 40 -34 42 -16" stroke="#A99DB0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>
    <path d="M-20 10 C -22 -12 -12 -30 2 -30 C 16 -30 24 -12 22 10 Z" fill="#17131D"/><path d="M-14 10 C -14 -6 -6 -18 2 -18 C 10 -18 16 -6 16 10 Z" fill="url(#${k}-glow)" class="an glo"/>
    <path d="M-10 -28 l2 8 l2 -8 M4 -30 l1.6 7 l1.6 -7" fill="#CFC6D6"/>
    <g><path d="M-38 -2 l4 -14 l4 14 Z" fill="#9C6BFF" opacity=".9"/><path d="M34 -4 l3 -11 l3 11 Z" fill="#7FD1FF"/><path d="M40 -2 l2 -7 l2 7 Z" fill="#9C6BFF"/></g>
    <g><rect x="-30" y="2" width="2.4" height="7" fill="#EDE3D0"/><ellipse cx="-28.8" cy="2" rx="5" ry="3" fill="#F28CB1"/><rect x="26" y="4" width="2" height="6" fill="#EDE3D0"/><ellipse cx="27" cy="4" rx="4" ry="2.4" fill="#7FD1FF" class="an glo"/></g>`,
  T:k=>`<path d="M-48 6 L-46 -26 L-20 -34 L-16 8 Z" fill="#A47A4C" stroke="#5E4428" stroke-width="2"/><path d="M-46 -26 L-20 -34 L-8 -30 L-34 -22 Z" fill="#C79C68"/>
    <path d="M-16 10 L-14 -72 L16 -80 L20 10 Z" fill="url(#${k}-mesa)" stroke="#5E4428" stroke-width="2"/><path d="M-14 -72 L16 -80 L30 -74 L2 -66 Z" fill="#D7AE78" stroke="#5E4428" stroke-width="1.5"/>
    <path d="M16 -80 L30 -74 L30 8 L20 10 Z" fill="#8A6236" stroke="#5E4428" stroke-width="2"/>
    <path d="M-14 -50 L18 -56 M-15 -30 L19 -34 M-15 -10 L19 -12 M20 -54 L30 -50 M20 -32 L30 -30" stroke="#7A5530" stroke-width="2" opacity=".7"/>
    <path d="M28 6 L30 -30 L48 -34 L52 4 Z" fill="#9A7044" stroke="#5E4428" stroke-width="2"/><path d="M30 -30 L48 -34 L54 -30 L36 -26 Z" fill="#C79C68"/>
    <g><path d="M-2 -70 l4 -16 l4 16 Z" fill="#F2C94C" stroke="#B07A1C"/><path d="M6 -70 l3 -10 l3 10 Z" fill="#FFB347" stroke="#B07A1C"/><path d="M-36 -24 l3 -10 l3 10 Z" fill="#F2C94C" stroke="#B07A1C"/></g>
    ${greyRock(-30,14,.6)}${greyRock(42,12,.5)}`,
  A:k=>`<g class="an bob">${cloud(0,-6,.62)}
    <path d="M-12 -6 L-9 -76 L9 -76 L12 -6 Z" fill="url(#${k}-marble)" stroke="#8796A5" stroke-width="2"/><path d="M-9 -60 L9 -60 M-9 -40 L9 -40" stroke="#C6D3DE" stroke-width="2"/>
    <rect x="-4.5" y="-56" width="9" height="12" rx="4.5" fill="#5E9BD1"/><path d="M-16 -76 L16 -76 L12 -84 L-12 -84 Z" fill="#DCE6EE" stroke="#8796A5" stroke-width="1.6"/>
    <path d="M-14 -84 L0 -106 L14 -84 Z" fill="#6FA9DE" stroke="#3F6F9C" stroke-width="2"/><circle cx="0" cy="-108" r="3" fill="#FFE27A"/>
    <path class="an fal" d="M-30 -30 C -10 -40 10 -20 30 -34 M-26 -56 C -8 -64 12 -46 28 -60" stroke="#BFE3FF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-dasharray="10 8"/></g>
    ${cloud(-40,4,.28,.95)}${cloud(42,8,.24,.95)}`,
  P:k=>`${flowers(-30,14,'pf1')}${flowers(30,16,'pf2')}
    <path d="M-10 4 C -8 -20 -10 -40 -14 -56 L 10 -56 C 8 -40 8 -20 12 4 Z" fill="#7A4E2C" stroke="#4E3018" stroke-width="2"/>
    <path d="M-10 4 C -20 6 -30 10 -36 8 M12 4 C 22 6 30 10 38 6 M0 4 C 0 10 -4 14 -8 16" stroke="#6A4224" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M-2 -30 C -6 -24 -4 -16 0 -12" stroke="#4E3018" stroke-width="2" fill="none"/><ellipse cx="2" cy="-22" rx="5" ry="7" fill="#3A2412"/>
    ${[[-30,-70,22],[28,-72,22],[-14,-94,24],[16,-92,22],[0,-78,26],[-38,-56,14],[38,-56,14]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${i%2?'#4E9F33':'#5DB03A'}"/>`).join('')}
    ${[[-14,-90,18],[18,-86,16],[0,-74,20],[-28,-66,14],[30,-68,14]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${k}-leaf)"/>`).join('')}
    <circle cx="-18" cy="-100" r="6" fill="#fff" opacity=".18"/><circle cx="-24" cy="-70" r="2.6" fill="#F28CB1"/><circle cx="20" cy="-96" r="2.6" fill="#FFE27A"/><circle cx="8" cy="-64" r="2.4" fill="#F28CB1"/>`,
  L:k=>`<path d="M-54 6 L0 30 L54 6 L54 0 L0 24 L-54 0 Z" fill="#CDB778"/><path d="M-54 0 L0 -24 L54 0 L0 24 Z" fill="#F4ECD0" stroke="#B8962E" stroke-width="1.5"/>
    <path d="M-40 -2 L-40 -44 L40 -44 L40 -2 Z" fill="url(#${k}-marble)" stroke="#B8962E" stroke-width="2"/>
    <path d="M-30 -2 V -42 M-15 -2 V -42 M0 -2 V -42 M15 -2 V -42 M30 -2 V -42" stroke="#E2D2A0" stroke-width="6"/><path d="M-30 -2 V -42 M-15 -2 V -42 M0 -2 V -42 M15 -2 V -42 M30 -2 V -42" stroke="#fff" stroke-width="2" opacity=".6"/>
    <path d="M-46 -44 L46 -44 L40 -52 L-40 -52 Z" fill="#F2C94C" stroke="#B8962E" stroke-width="1.6"/>
    <path d="M-30 -52 C -30 -76 30 -76 30 -52 Z" fill="url(#${k}-gold)" stroke="#B8962E" stroke-width="2"/><path d="M-14 -66 C -8 -72 4 -72 10 -68" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/>
    <g class="an glo"><circle cx="0" cy="-84" r="12" fill="#FFF3B0" stroke="#F2C94C" stroke-width="2"/>${Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2;return `<path d="M${f1(Math.cos(a)*16)} ${f1(-84+Math.sin(a)*16)} L${f1(Math.cos(a)*24)} ${f1(-84+Math.sin(a)*24)}" stroke="#F2C94C" stroke-width="2.4" stroke-linecap="round"/>`}).join('')}</g>`,
  D:k=>`${greyRock(-44,8,.8)}${greyRock(46,6,.7)}
    <path d="M-34 8 L-38 -34 L-26 -58 L-18 -30 L-14 8 Z" fill="#2B2238" stroke="#120E19" stroke-width="2"/><path d="M14 8 L18 -40 L30 -62 L38 -36 L36 8 Z" fill="#2B2238" stroke="#120E19" stroke-width="2"/>
    <path d="M-16 12 L-22 -60 L0 -110 L22 -60 L16 12 Z" fill="url(#${k}-obs)" stroke="#120E19" stroke-width="2"/><path d="M0 -110 L6 -60 L0 12" stroke="#5B3F8C" stroke-width="3" fill="none"/>
    <g class="an glo"><path d="M-7 -64 L0 -76 L7 -64 L0 -52 Z" fill="#B48CFF"/><path d="M-4 -30 l4 -6 l4 6 l-4 6 Z M24 -40 l3 -5 l3 5 l-3 5 Z M-30 -30 l3 -5 l3 5 l-3 5 Z" fill="#9C6BFF"/></g>
    <path d="M-26 -58 l0 0 M30 -62" stroke="none"/>`,
  nest:k=>`${greyRock(-38,8,.9)}${greyRock(40,6,.8)}<ellipse cx="0" cy="-2" rx="48" ry="20" fill="#9E8A66"/>
    <ellipse cx="0" cy="-8" rx="46" ry="20" fill="url(#${k}-straw)" stroke="#6E522B" stroke-width="2"/>
    <path d="M-40 -10 C -20 -2 20 -2 40 -12 M-42 -4 C -18 6 18 6 42 -6 M-30 -20 L-10 -2 M-6 -24 L14 -2 M16 -22 L34 -6 M-20 -24 L-36 -6" stroke="#7A5A30" stroke-width="1.6" fill="none" opacity=".7"/>
    <ellipse cx="0" cy="-12" rx="32" ry="11" fill="#6E522B"/><ellipse cx="0" cy="-12" rx="28" ry="8" fill="#8A6A3C"/>
    <path d="M-46 -12 l-8 -6 M46 -14 l8 -7 M-30 -26 l-4 -8 M28 -26 l5 -7" stroke="#7A5A30" stroke-width="2" stroke-linecap="round"/>`,
  hatch:k=>`<path d="M-50 4 L0 28 L50 4 L50 -4 L0 20 L-50 -4 Z" fill="#8E8576"/><path d="M-50 -4 L0 -28 L50 -4 L0 20 Z" fill="#CFC6B4" stroke="#8E8576" stroke-width="1.5"/>
    <path d="M-38 -6 C -38 -60 38 -60 38 -6 Z" fill="url(#${k}-glass)" stroke="#7FA9BF" stroke-width="2"/>
    <path d="M-38 -6 C -38 -60 38 -60 38 -6 M0 -48 L0 -6 M-26 -38 C -14 -30 -14 -16 -14 -6 M26 -38 C 14 -30 14 -16 14 -6" stroke="#9FC3D6" stroke-width="2" fill="none"/>
    <ellipse class="an glo" cx="0" cy="-10" rx="30" ry="8" fill="#FFD36A" opacity=".45"/><path d="M-6 -58 L6 -58 L4 -50 L-4 -50 Z" fill="#B8962E"/><circle cx="0" cy="-60" r="3" fill="#FFE27A"/>
    <path d="M-26 -40 C -20 -48 -10 -52 0 -52" stroke="#fff" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>`
};

/* ферма: четыре грядки-квадранта с изгородью, у закрытых трава */
function farmSprite(b,st,K,D){
  const q=[[0,-15],[30,0],[0,15],[-30,0]],out=[];
  q.forEach(([cx,cy],i)=>{
    const has=i<(b.plots||[]).length,p=has?b.plots[i]:null;
    const d=`M${cx} ${cy-14} L${cx+28} ${cy} L${cx} ${cy+14} L${cx-28} ${cy} Z`;
    if(!has){out.push(`<path d="${d}" fill="#7FB86A" opacity=".9"/>${tuft(cx,cy+3)}`);return}
    out.push(`<path d="${d}" fill="#7A5534" stroke="#5A3C22" stroke-width="1"/><path d="M${cx-18} ${cy-5} L${cx+4} ${cy+6} M${cx-10} ${cy-9} L${cx+12} ${cy+2} M${cx-2} ${cy-13} L${cx+20} ${cy-2}" stroke="#5E4026" stroke-width="2"/>`);
    if(p){const done=D.ready(p,K),k=done?1:Math.min(1,(K-p.at+(p.skip||0)*D.SKIP_CARDS)/p.need),h=4+k*12;
      const col=p.crop==='ember'?'#E4572E':p.crop==='pump'?'#F2994A':'#9C6BFF';
      [[-10,-3],[4,3],[-2,-8],[12,-3]].forEach(([dx,dy])=>{const x=cx+dx,y=cy+dy;
        out.push(`<path d="M${x} ${y} C ${x-5} ${y-h*.6} ${x-3} ${y-h} ${x} ${y-h} C ${x+3} ${y-h} ${x+5} ${y-h*.6} ${x} ${y} Z" fill="#4E9A3E"/><path d="M${x} ${y} C ${x+4} ${y-h*.4} ${x+6} ${y-h*.5} ${x+7} ${y-h*.7}" stroke="#3F8A2C" stroke-width="1.4" fill="none"/>`);
        if(done)out.push(p.crop==='pump'?`<ellipse cx="${x}" cy="${y-h+1}" rx="5" ry="4" fill="${col}" stroke="#8A4A12" stroke-width=".8"/>`:`<circle cx="${x}" cy="${y-h}" r="3.8" fill="${col}" stroke="#5A3C22" stroke-width=".8"/><circle cx="${x-1}" cy="${y-h-1}" r="1.2" fill="#fff" opacity=".6"/>`)})}
  });
  /* изгородь по краю и пугало */
  const posts=[];for(let i=0;i<=8;i++){const t=i/8,x=-60+t*60,y=t*30;posts.push([x,y])}for(let i=1;i<=8;i++){const t=i/8,x=t*60,y=30-t*30;posts.push([x,y])}
  out.push(`<path d="M-60 -6 L0 24 L60 -6" stroke="#B5833F" stroke-width="2.4" fill="none"/>${posts.map(([x,y])=>`<path d="M${f1(x)} ${f1(y+2)} L${f1(x)} ${f1(y-10)}" stroke="#8A5A2C" stroke-width="3" stroke-linecap="round"/>`).join('')}`);
  out.push(`<g transform="translate(-40 -14)"><path d="M0 0 L0 -24 M-9 -16 L9 -16" stroke="#8A5A2C" stroke-width="2.4" stroke-linecap="round"/><circle cx="0" cy="-27" r="5" fill="#F2D59B" stroke="#8A5A2C"/><path d="M-7 -30 L7 -30 L3 -35 L-3 -35 Z" fill="#C0392B"/><path d="M-5 -16 L5 -16 L4 -6 L-4 -6 Z" fill="#5E9BD1"/></g>`);
  return out.join('')}

/* яйцо: крапинки цвета стихии будущего птенца, у неразвившегося серое */
function eggSVG(x,y,eg,r){const G=root.DRG,W=root.DRAW;r=r||1;
  let c1='#FFF6DE',c2='#C9A86A';
  if(eg.viable){const ph=G.phenotype(eg.genome),k=ph.breath==='element'?ph.elements:[];c2=k.length?W.EL_COL[k[0]]:'#8C8F96';if(k[1])c1=W.EL_COL[k[1]]+'55'}else{c1='#D8D4CC';c2='#9A958C'}
  return `<g transform="translate(${x} ${y}) scale(${r})"><ellipse cx="0" cy="0" rx="9" ry="12" fill="${c1}" stroke="#8A7650" stroke-width="1.4"/><circle cx="-3" cy="-4" r="2" fill="${c2}"/><circle cx="3" cy="2" r="2.4" fill="${c2}"/><circle cx="-2" cy="6" r="1.5" fill="${c2}"/><ellipse cx="-3" cy="-6" rx="2" ry="3" fill="#fff" opacity=".5"/></g>`}
/* дракон на острове: рисунок лежит в группе своей постройки (по глубине, как раньше), а зона нажатия — в отдельном
   слое поверх всех построек (HITS), иначе прозрачные ромбы соседних построек перехватывали бы нажатие.
   Живой слой (live.js) прячет этот рисунок, рисует дракона на холсте и двигает зону нажатия вместе с ним:
   data-ix/iy — где стоят лапы в единицах острова, data-home — дом, data-mode — гуляет у среды (hab) или сидит в гнезде (nest),
   data-face — куда смотрит. Прозрачный овал — сама зона нажатия, рисунок нажатия пропускает. */
const escA=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
let HITS=[];
const dragonAt=(d,x,y,size,key,c,b,mode,face)=>{const W=root.DRAW,G=root.DRG,ix=c[0]+x,iy=c[1]+y;
  HITS.push(`<g class="drg-dr" data-act="drginsp" data-dragon="${escA(d.id)}" data-ix="${f1(ix)}" data-iy="${f1(iy)}" data-sz="${size}" data-home="${escA(b.id)}" data-mode="${mode}" data-face="${face||1}"><title>${escA(d.name)}: осмотреть</title><ellipse cx="${f1(ix)}" cy="${f1(iy-size*0.38)}" rx="${f1(size*0.44)}" ry="${f1(size*0.4)}" fill="rgba(255,255,255,.001)"/></g>`);
  return `<g class="an idle drg-art" data-art="${escA(d.id)}">${W.svg(G.phenotype(d.genome),{key,size,label:'',stage:W.stageOf(d.lvl)}).replace('<svg class="dragon"',`<svg class="dragon drg-on" x="${f1(x-size/2)}" y="${f1(y-size*0.8)}"`)}</g>`};
function nestSprite(b,st,k,c){const out=[SPR.nest(k)];
  if(b.pair){[b.pair.m,b.pair.f].forEach((id,i)=>{const d=st.dragons.find(x=>x.id===id);if(!d)return;out.push(dragonAt(d,i?20:-20,-10,58,'n'+b.id+id,c,b,'nest',i?-1:1))})}
  else out.push(eggSVG(-6,-14,{viable:false},.8).replace('#D8D4CC','#F5EBD6'));
  return out.join('')}
function hatchSprite(b,k){const out=[SPR.hatch(k)];
  (b.slots||[]).forEach((eg,i)=>{const x=[-18,18,-6,8][i],y=[-14,-14,-24,-24][i];
    out.push(`<ellipse cx="${x}" cy="${y+10}" rx="10" ry="4" fill="#B8925A"/>`);if(eg)out.push(eggSVG(x,y,eg,.9))});
  return out.join('')}

/* строительные леса и полоска остатка */
function scaffold(job,K,D){const k=Math.max(0,Math.min(1,(K-job.at+(job.skip||0)*D.SKIP_CARDS)/job.need));
  return `<g class="drg-scaf"><path d="M-40 6 L-40 -50 M40 6 L40 -50 M-40 -50 L40 -50 M-40 -22 L40 -22 M-40 -50 L40 -22 M40 -50 L-40 -22" stroke="#B5833F" stroke-width="3" fill="none"/>
    <path d="M-30 4 L30 4 L24 -8 L-24 -8 Z" fill="#C9A86A" stroke="#8A6A3C"/><rect x="-14" y="-20" width="12" height="12" fill="#B8925A" stroke="#6E522B"/><rect x="4" y="-16" width="10" height="8" fill="#9C7A4E" stroke="#6E522B"/>
    <rect x="-34" y="-74" width="68" height="9" rx="4.5" fill="rgba(0,0,0,.45)"/><rect x="-32" y="-72" width="${(64*k).toFixed(1)}" height="5" rx="2.5" fill="#7CD67A"/></g>`}

function bubble(x,y,kind,txt,full){const bg=kind==='gold'?(full?'#F2C94C':'#FFF4C9'):kind==='food'?'#E6F7D9':kind==='egg'?'#FFF0E0':'#FFFFFF';
  const ic=kind==='gold'?'🪙':kind==='food'?'🌾':kind==='egg'?'🥚':kind==='baby'?'🐣':'🔨';
  return `<g class="drg-bub${full?' full':''}" transform="translate(${f1(x)} ${f1(y)})"><path d="M-6 9 L0 16 L6 9 Z" fill="${bg}" stroke="rgba(0,0,0,.25)"/><rect x="-30" y="-15" width="60" height="25" rx="12.5" fill="${bg}" stroke="rgba(0,0,0,.25)"/><text x="-17" y="3" font-size="13">${ic}</text><text x="6" y="3.5" font-size="12" font-weight="700" fill="#3A2A10" text-anchor="middle">${txt}</text></g>`}

/* ---------- край острова: неровная кромка, скалы снизу, валуны по краю ---------- */
const C0=P(6,6);
const RIM=(()=>{const D=root.DECO,G=D?D.GRID:12,cor=[P(0,0),P(G,0),P(G,G),P(0,G)],out=[];
  for(let e=0;e<4;e++){const a=cor[e],b=cor[(e+1)%4];for(let i=0;i<14;i++){const t=i/14,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
    const dx=x-C0[0],dy=(y-C0[1])*2,l=Math.hypot(dx,dy)||1,off=10+hrand('rim'+e+':'+i)*14;out.push([x+dx/l*off,y+dy/l*off*0.5,e])}}
  return out})();
function smooth(pts){const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let d=`M${pt(m(pts[pts.length-1],pts[0]))}`;
  for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];d+=` Q${pt(p)} ${pt(m(p,q))}`}return d+' Z'}
function cliffs(k){
  /* передние кромки: e=1 (справа вниз) и e=2 (низ влево), от правого угла через нижний к левому */
  const front=RIM.filter(p=>p[2]===1||p[2]===2),R=P(12,0),L=P(0,12);front.unshift([R[0]+18,R[1],1]);front.push([L[0]-18,L[1],2]);
  const depth=p=>60+120*(1-Math.abs(p[0]-C0[0])/400)+hrand('cd'+p[0].toFixed(0))*30;
  const bot=front.map(p=>[p[0]-(p[0]-C0[0])*0.06,p[1]+depth(p)]);
  const tip=front.map(p=>[C0[0]+(p[0]-C0[0])*0.55,p[1]+depth(p)*1.9+40]);
  const out=[];
  out.push(`<path d="M${front.map(pt).join(' L')} L${bot.slice().reverse().map(pt).join(' L')} Z" fill="url(#${k}-cliff)"/>`);
  out.push(`<path d="M${bot.map(pt).join(' L')} L${tip.slice().reverse().map(pt).join(' L')} Z" fill="url(#${k}-cliff2)"/>`);
  /* грани скал */
  for(let i=0;i<front.length-1;i+=2){const a=front[i],b=front[i+1],c=bot[i+1],d=bot[i],lt=a[0]<C0[0];
    out.push(`<path d="M${pt(a)} L${pt(b)} L${pt([c[0],c[1]*0.5+b[1]*0.5])} L${pt([d[0],d[1]*0.6+a[1]*0.4])} Z" fill="${lt?'#E8D6AA':'#C9AF80'}" opacity=".7"/>`)}
  for(let i=1;i<front.length-1;i+=3){const a=front[i],d=depth(a);out.push(`<path d="M${f1(a[0])} ${f1(a[1]+8)} l${f1((a[0]<C0[0]?-1:1)*6)} ${f1(d*0.45)} l${f1((a[0]<C0[0]?1:-1)*4)} ${f1(d*0.4)}" stroke="#9C8460" stroke-width="2" fill="none" opacity=".55"/>`)}
  out.push(`<path d="M${front.map((p,i)=>pt([p[0],p[1]+12+hrand('st'+i)*8])).join(' L')}" stroke="#A88E62" stroke-width="3" fill="none" opacity=".5"/>`);
  /* водопады: с правого и левого края */
  [front[Math.round(front.length*0.22)],front[Math.round(front.length*0.8)]].forEach((p,i)=>{const h=depth(p)*1.2;
    out.push(`<path d="M${f1(p[0]-7)} ${f1(p[1]-3)} L${f1(p[0]+7)} ${f1(p[1]-3)} L${f1(p[0]+10)} ${f1(p[1]+h)} L${f1(p[0]-10)} ${f1(p[1]+h)} Z" fill="#BFE6FF" opacity=".85"/>
      <path class="an wfl" d="M${f1(p[0]-3)} ${f1(p[1])} L${f1(p[0]-4)} ${f1(p[1]+h)} M${f1(p[0]+4)} ${f1(p[1])} L${f1(p[0]+5)} ${f1(p[1]+h)}" stroke="#fff" stroke-width="2.4" stroke-dasharray="10 12" fill="none" opacity=".9"/>
      <ellipse cx="${f1(p[0])}" cy="${f1(p[1]-2)}" rx="12" ry="4" fill="#7CC4FF"/>`)});
  return out.join('')}
function rimRocks(back){const out=[];
  RIM.forEach((p,i)=>{const isBack=p[2]===0||p[2]===3;if(isBack!==back)return;if(!back&&i%3)return;
    const s=(back?0.9:0.6)+hrand('rr'+i)*0.7,dx=p[0]-C0[0],dy=p[1]-C0[1],l=Math.hypot(dx,dy*2)||1;
    out.push(rock(p[0]+dx/l*4,p[1]+dy/l*2,s))});
  return out.join('')}

/* ---------- всё вместе ---------- */
function svg(st,opt){
  const D=root.DECO,K=opt.K,sel=opt.sel,place=opt.place,k=opt.key||'i',ro=!!opt.readonly,vb=VIEW[opt.full?'full':'norm'];
  HITS=[];
  const out=[`<svg class="drg-isl" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid ${opt.full?'meet':'meet'}" role="img" aria-label="Остров драконов">`];
  out.push(`<defs>
    <linearGradient id="${k}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--isl-sky1)"/><stop offset="1" stop-color="var(--isl-sky2)"/></linearGradient>
    <radialGradient id="${k}-grass" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="var(--isl-grass)"/><stop offset="1" stop-color="var(--isl-grass2)"/></radialGradient>
    <linearGradient id="${k}-cliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D9C49A"/><stop offset="1" stop-color="#A88E62"/></linearGradient>
    <linearGradient id="${k}-cliff2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A88E62"/><stop offset="1" stop-color="#6E5A3C"/></linearGradient>
    <radialGradient id="${k}-leaf" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9BE06A"/><stop offset=".6" stop-color="#5DB03A"/><stop offset="1" stop-color="#3F8A2C"/></radialGradient>
    <linearGradient id="${k}-lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE27A"/><stop offset="1" stop-color="#FF5A1F"/></linearGradient>
    <radialGradient id="${k}-basalt" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#5A5F73"/><stop offset="1" stop-color="#23252F"/></radialGradient>
    <radialGradient id="${k}-water" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#8FDBFF"/><stop offset="1" stop-color="#2F80D1"/></radialGradient>
    <radialGradient id="${k}-cave" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#A396AE"/><stop offset="1" stop-color="#5B5163"/></radialGradient>
    <radialGradient id="${k}-glow" cx=".5" cy=".8" r=".7"><stop offset="0" stop-color="#FFE27A" stop-opacity=".9"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></radialGradient>
    <linearGradient id="${k}-mesa" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C79C68"/><stop offset="1" stop-color="#A47A4C"/></linearGradient>
    <linearGradient id="${k}-marble" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D6E0EA"/></linearGradient>
    <linearGradient id="${k}-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset="1" stop-color="#D9A521"/></linearGradient>
    <linearGradient id="${k}-obs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4A3D63"/><stop offset=".5" stop-color="#2B2238"/><stop offset="1" stop-color="#17121F"/></linearGradient>
    <radialGradient id="${k}-straw" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#E0C48A"/><stop offset="1" stop-color="#A8864E"/></radialGradient>
    <radialGradient id="${k}-glass" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#F2FBFF" stop-opacity=".9"/><stop offset="1" stop-color="#A9D6EE" stop-opacity=".55"/></radialGradient>
  </defs>`);
  if(!opt.bare){
    out.push(`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#${k}-sky)"/>`);
    /* дальние облака под островом и по бокам, медленно плывут */
    const bank=[[-180,640,1.6],[60,610,1.3],[300,660,1.8],[560,620,1.4],[820,650,1.7],[1000,600,1.2],[-120,300,.9],[930,260,.8],[700,40,.7],[60,60,.6]];
    out.push(`<g class="an drift d1">${bank.map(([x,y,s],i)=>cloud(x,y,s,i>5?.85:1)).join('')}</g>`);
    out.push(cliffs(k));
    /* верх острова */
    out.push(`<path d="${smooth(RIM)}" fill="url(#${k}-grass)" stroke="#4E8A33" stroke-width="2"/>`);
    out.push(rimRocks(true));
    /* пятна травы, кустики, цветы на открытой земле */
    for(let i=0;i<D.GRID;i++)for(let j=0;j<D.GRID;j++){const r=hrand('g'+i+':'+j),c=P(i+.5,j+.5);
      if(r<0.22)out.push(`<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(18+r*40)}" ry="${f1(8+r*16)}" fill="${r<0.11?'#fff':'#2F6A1E'}" opacity=".07"/>`);
      else if(r>0.86)out.push(tuft(c[0]+(r-.9)*80,c[1]));else if(r>0.8)out.push(flowers(c[0],c[1],'f'+i+j))}
    /* закрытые участки: густой лес и табличка с ценой */
    for(let cx=0;cx<D.GRID/D.CHUNK;cx++)for(let cy=0;cy<D.GRID/D.CHUNK;cy++){
      const id=cx+','+cy;if(st.land.includes(id))continue;const x=cx*D.CHUNK,y=cy*D.CHUNK;
      out.push(`<polygon points="${dia(x,y,D.CHUNK,D.CHUNK)}" fill="#1F4A14" opacity=".16"/>`);
      const items=[];for(let a=0;a<D.CHUNK;a++)for(let b=0;b<D.CHUNK;b++){const r=hrand('lf'+id+a+b),p=P(x+a+.3+r*.4,y+b+.3+hrand('lg'+id+a+b)*.4);items.push([p,r])}
      items.sort((u,v)=>u[0][1]-v[0][1]).forEach(([p,r],n)=>{if(r>0.72)return;out.push(r<0.14?rock(p[0],p[1],1+r*2):r<0.3?bush(p[0],p[1],1.1,k):tree(p[0],p[1],0.95+r*0.4,k,n))});
      const cost=D.LAND_COST[id],m=P(x+2,y+2),o=P(cx===0?x:x+D.CHUNK,cy===0?y:y+D.CHUNK),c=[m[0]+(o[0]-m[0])*.4,m[1]+(o[1]-m[1])*.4];
      if(cost&&!ro)out.push(`<g class="drg-land" data-act="drgland" data-c="${id}" transform="translate(${f1(c[0])} ${f1(c[1]-10)})"><polygon points="${dia(x,y,D.CHUNK,D.CHUNK).split(' ').map(s=>{const [a,b]=s.split(',').map(Number);return f1(a-c[0])+','+f1(b-c[1]+10)}).join(' ')}" fill="rgba(255,255,255,.001)"/>
        <path d="M-2 22 L-2 2 M2 22 L2 2" stroke="#6E4A28" stroke-width="3"/><rect x="-38" y="-16" width="76" height="24" rx="6" fill="#B5833F" stroke="#6E4A28" stroke-width="2"/><text x="0" y="1" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">🔒 ${cost.gold?cost.gold+' 🪙':cost.gems+' 💎'}</text></g>`)}
  }
  /* клетки для установки */
  if(place){
    const cells=[];for(let i=0;i<D.GRID-1;i++)for(let j=0;j<D.GRID-1;j++){
      const okp=D.canPlace(st,i,j,place.move||null);
      cells.push(`<polygon class="drg-cell${okp?' ok':''}" points="${dia(i,j,1,1)}" ${okp?`data-act="drgtile" data-x="${i}" data-y="${j}"`:''}/>`)}
    out.push(`<g class="drg-cells">${cells.join('')}</g>`)}
  /* постройки и препятствия по глубине */
  const obs=opt.bare?[]:D.obstacles(st).map(o=>({o,d:o.x+o.y+1,x:o.x}));
  const list=st.bld.map(b=>({b,d:b.x+b.y+2,x:b.x})).concat(obs).sort((a,b)=>a.d-b.d||a.x-b.x),bubs=[];
  list.forEach(it=>{
    if(it.o){const o=it.o,c=P(o.x+.5,o.y+.5);
      out.push(`<g class="drg-ob" ${ro||place?'':`data-act="drgobs" data-c="${o.id}"`}><title>${D.OBST_KIND[o.kind].name}: расчистить за ${D.OBST_KIND[o.kind].gold} золота</title>${o.kind==='tree'?`<g class="an sway">${tree(c[0],c[1]+6,1.15,k,o.x)}</g>`:o.kind==='bush'?bush(c[0],c[1]+5,1.2,k):greyRock(c[0],c[1]+6,1.3)}</g>`);return}
    const b=it.b,c=P(b.x+1,b.y+1),T=D.TYPES[b.type],job=b.build||b.up,isSel=sel===b.id,moving=place&&place.move===b.id;
    out.push(`<g class="drg-b${isSel?' sel':''}${moving?' moving':''}" ${ro?'':`data-act="drgsel" data-id="${b.id}"`} transform="translate(${f1(c[0])} ${f1(c[1])})"><title>${T.name}</title>`);
    out.push(`<path d="M-64 0 L0 -32 L64 0 L0 32 Z" fill="rgba(255,255,255,.001)"/>`);
    out.push(ground(b.type));
    if(isSel)out.push(`<path d="M0 -34 L68 0 L0 34 L-68 0 Z" fill="none" stroke="#FFF3B0" stroke-width="3.4" stroke-dasharray="7 5"/>`);
    if(b.build){out.push(scaffold(b.build,K,D))}
    else{
      out.push(T.kind==='farm'?farmSprite(b,st,K,D):T.kind==='nest'?nestSprite(b,st,k,c):T.kind==='hatch'?hatchSprite(b,k):(SPR[b.type]||SPR.nest)(k));
      if(T.kind==='hab'){
        const ds=st.dragons.filter(d=>d.home===b.id),pos=[[-30,22],[28,22],[0,30],[46,8]];
        ds.forEach((d,n)=>{const [dx,dy]=pos[n%4];out.push(dragonAt(d,dx,dy,66,k+b.id+d.id,c,b,'hab',dx>0?-1:1))})}
      if(b.up)out.push(scaffold(b.up,K,D))}
    out.push(`</g>`);
    /* пузырь над зданием: в отдельном слое поверх всего */
    if(!ro){const x=c[0],y=c[1]-(b.build?84:HEIGHT[b.type]||70)-16;
      if(job&&!D.ready(job,K))bubs.push(bubble(x,y,'build',D.left(job,K)+' к.'));
      else if(T.kind==='hab'){const a=Math.floor(D.chestNow(st,b,K));if(a>=1)bubs.push(bubble(x,y,'gold',a>=1000?Math.floor(a/100)/10+'к':a,a>=D.chestCap(b)))}
      else if(T.kind==='farm'){const r=(b.plots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)bubs.push(bubble(x,y,'food','×'+r))}
      else if(T.kind==='nest'&&b.pair){bubs.push(D.ready(b.pair,K)?bubble(x,y,'egg','готово',true):bubble(x,y,'egg',D.left(b.pair,K)+' к.'))}
      else if(T.kind==='hatch'){const r=(b.slots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)bubs.push(bubble(x,y,'baby','×'+r,true))}}
  });
  if(!opt.bare)out.push(rimRocks(false));
  out.push(`<g class="drg-drs">${HITS.join('')}</g>`);HITS=[];
  out.push(`<g class="drg-bubs">${bubs.join('')}</g>`);
  /* ближние облака: проплывают у краёв, нажатиям не мешают */
  if(!opt.bare)out.push(`<g class="an drift d2" pointer-events="none">${cloud(-60,470,.9,.92)}${cloud(860,430,.8,.9)}${cloud(330,590,1.1,.95)}</g>`);
  out.push(`</svg>`);
  return out.join('')}

const ISL={svg,P,VIEW,eggSVG,HEIGHT,TW,TH,OX,OY};
if(typeof module!=='undefined'&&module.exports)module.exports=ISL;else root.ISL=ISL;
})(typeof window!=='undefined'?window:globalThis);
