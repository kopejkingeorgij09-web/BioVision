/* Рисунок острова: летающий остров в облаках, изометрическая сетка, постройки 2×2, драконы у своих сред.
   Только SVG-строка, без состояния. Нажатия ловит общий обработчик страницы по data-act.
   5.0: рисунок неподвижен. Всё, что движется (свечение лавы и кристаллов, искры, дым, рябь, блёстки, светлячки), записано
   списком в data-fx корневого <svg> и рисуется на холсте живого слоя (live.js) в том же кадре, что и драконы. Поэтому
   браузеру не нужно перекрашивать большой SVG каждый кадр, а при движении камеры остров только сдвигается.
   Свет падает слева сверху: верхние грани светлые, правые и передние темнее, под предметами мягкая тень. */
(function(root){
'use strict';
const TW=64,TH=32,OX=400,OY=110;
/* полный вид выше прежнего (4.1): кончик скалы на 418 единиц ниже переднего угла P(n,n), весь остров помещается */
const VIEW={norm:[10,70,780,520],full:[-260,-40,1320,972]};
/* остров растёт кольцами участков: сторона рисунка n = 12, 16, 20 или 24 клетки */
const viewFor=n=>n===12?VIEW:{norm:[400-32*n-6,70,64*n+12,32*n+136],full:[400-(32*n+276),-40,2*(32*n+276),32*n+588]};
const viewOf=st=>{const D=root.DECO;return viewFor(D&&st&&st.land?D.extent(st).n:12)};
const P=(i,j)=>[(i-j)*TW/2+OX,(i+j)*TH/2+OY];
const pt=a=>a[0].toFixed(1)+','+a[1].toFixed(1);
const dia=(i,j,w,h)=>[P(i,j),P(i+w,j),P(i+w,j+h),P(i,j+h)].map(pt).join(' ');
const f1=x=>Math.round(x*10)/10;
const pp=a=>f1(a[0])+' '+f1(a[1]);
const path=(ps,fill,ex)=>`<path d="M${ps.map(pp).join(' L')} Z" fill="${fill}"${ex?' '+ex:''}/>`;
/* детерминированный шум по строке: остров у всех одинаковый и не дрожит между рендерами */
function hrand(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%100000)/100000}
const G=(x,y,s,inner)=>`<g transform="translate(${f1(x)} ${f1(y)})${s&&s!==1?` scale(${f1(s*100)/100})`:''}">${inner}</g>`;
const shadow=(rx,ry,dy,op)=>`<ellipse cx="0" cy="${dy||0}" rx="${rx}" ry="${ry}" fill="#0B1A10" opacity="${op||.2}"/>`;

/* ---------- эффекты для живого слоя ----------
   fx(вид, x, y, размер, цвет, сила) в координатах текущей детали; ORG переводит их в координаты острова.
   Виды: g — свечение, e — искры, r — рябь, s — блёстки, m — дым, f — светлячки, o — пульс готового пузыря */
let FX=[],ORG={x:0,y:0,s:1};
function fx(t,x,y,a,c,k){FX.push([t,f1(ORG.x+x*ORG.s),f1(ORG.y+y*ORG.s),f1((a||0)*ORG.s),c||'',k==null?0:k])}
function withOrg(x,y,s,fn){const o=ORG;ORG={x:o.x+x*o.s,y:o.y+y*o.s,s:o.s*(s||1)};try{return fn()}finally{ORG=o}}

/* ---------- палитры: светлая грань, средняя, тень ---------- */
const STONE=['#E6EAF0','#B4BCC8','#7F889A'],SAND=['#F4E3BF','#D8BC8A','#A98B5C'],MOSS=['#CAD8A8','#9FB07F','#708259'];
const BAS=['#72687A','#4F4757','#302A36'],OBS=['#6A5A8C','#40345A','#221B33'];
const AMETH=['#EAD6FF','#B98CFF','#7347D1'],CYAN=['#DDFDFF','#7FE6F7','#2A9EC2'],ROSE=['#FFE0F0','#FF92C8','#CF4A8E'],GOLDC=['#FFF5C2','#F7CF52','#BF881C'],EMBC=['#FFE6B0','#FF9A3D','#C2410C'],OBSC=['#8E7BB8','#4E4170','#261D3A'];

/* ---------- мелкие детали ---------- */
/* камень с гранями: три формы (валун, обломок, плита), свет слева сверху, светлая кромка */
const ROCKS=[
  {sh:[15,4.5],b:'M-14 2 L-13 -8 L-6 -16 L5 -17 L13 -9 L15 1 Q 1 6 -14 2 Z',t:'M-13 -8 L-6 -16 L5 -17 L13 -9 L4 -6 L-6 -5 Z',d:'M4 -6 L13 -9 L15 1 Q 9 4 3 4 Z',h:'M-13 -8 L-6 -16 L5 -17'},
  {sh:[11,3.5],b:'M-10 2 L-9 -14 L-3 -27 L4 -24 L10 -10 L11 2 Q 0 5 -10 2 Z',t:'M-9 -14 L-3 -27 L4 -24 L1 -12 Z',d:'M1 -12 L4 -24 L10 -10 L11 2 Q 6 4 2 4 Z',h:'M-9 -14 L-3 -27 L4 -24'},
  {sh:[17,4],b:'M-16 2 L-15 -5 L-5 -10 L9 -10 L16 -4 L16 2 Q 0 6 -16 2 Z',t:'M-15 -5 L-5 -10 L9 -10 L16 -4 L5 -2 L-7 -2 Z',d:'M5 -2 L16 -4 L16 2 Q 10 4 5 4 Z',h:'M-15 -5 L-5 -10 L9 -10'}];
function stone(x,y,s,pal,v){const R=ROCKS[(v||0)%3];pal=pal||STONE;
  return G(x,y,s,`<ellipse cx="0" cy="2" rx="${R.sh[0]}" ry="${R.sh[1]}" fill="#0B1A10" opacity=".2"/><path d="${R.b}" fill="${pal[1]}"/><path d="${R.t}" fill="${pal[0]}"/><path d="${R.d}" fill="${pal[2]}"/><path d="${R.h}" stroke="#fff" stroke-width="1.1" fill="none" opacity=".5" stroke-linecap="round"/>`)}
/* кристалл: шестигранная призма с острым концом, светлая левая грань, тёмная правая, блик по ребру */
function crystal(x,y,h,w,pal,lean){lean=lean||0;const T=[lean,-h],l0=[-w,0],l1=[-w+lean*.3,-h*.68],r1=[w+lean*.3,-h*.7],r0=[w,0],b=[0,w*.42],m=[lean*.5,-h*.7];
  return G(x,y,1,`${path([l0,l1,T,m,b],pal[0])}${path([b,m,T,r1,r0],pal[2])}${path([l1,T,m],pal[1],'opacity=".9"')}<path d="M${pp([l1[0]*.35+T[0]*.65,l1[1]*.35+T[1]*.65])} L${pp([b[0]*.55+m[0]*.45,b[1]*.55+m[1]*.45])}" stroke="#fff" stroke-width="${f1(Math.max(.8,w*.2))}" opacity=".6" stroke-linecap="round"/>`)}
/* друза кристаллов на камне; glow — подсветка в живом слое */
function cluster(x,y,s,pal,seed,glow){const r=k=>hrand(seed+k);
  const out=[shadow(16,4.5,2,.22),stone(-6,2,.55,STONE,2),crystal(-7,0,18+r('a')*8,4.2,pal,-4),crystal(5,1,24+r('b')*10,5.2,pal,3),crystal(-1,3,13+r('c')*6,3.6,pal,1),crystal(11,3,10+r('d')*5,3,pal,5),stone(8,5,.4,STONE,0)];
  if(glow)withOrg(x,y,s,()=>{fx('g',1,-14,22,glow,.55);fx('s',1,-16,12,pal[0])});
  return G(x,y,s,out.join(''))}
/* ель: ярусы хвои с освещённой левой половиной */
const PINE=[['#1E6A4A','#2E8E5E','#86D9A0'],['#236E3E','#379A4E','#94E08C'],['#1D5F52','#2C8570','#7FD1B8']];
function pine(x,y,s,v){const c=PINE[(v||0)%3],T=[[17,-6,-26],[14,-17,-38],[11,-28,-48],[7,-39,-58]];
  let o=`${shadow(15,4.5,1,.22)}<path d="M-2.4 1 L-2 -9 L2 -9 L2.4 1 Z" fill="#6B4426"/>`;
  T.forEach(([w,yb,yt])=>{o+=`<path d="M0 ${yt} L${w} ${yb} Q0 ${yb+5} ${-w} ${yb} Z" fill="${c[0]}"/><path d="M0 ${yt} L${-w} ${yb} Q${f1(-w*.4)} ${yb+3.4} 0 ${yb+1.6} Z" fill="${c[1]}"/><path d="M-1 ${yt+3} L${f1(-w*.72)} ${yb-1}" stroke="${c[2]}" stroke-width="1.3" opacity=".55" stroke-linecap="round"/>`});
  return G(x,y,s,o)}
/* лиственное дерево: крона из шаров с объёмом */
function oak(x,y,s,k,v){const dk=['#3E8E2E','#3A8A3F','#4B952F'][(v||0)%3];
  return G(x,y,s,`${shadow(16,5,1,.22)}<path d="M-3 0 C -3 -10 -4 -18 -6 -24 L 3 -24 C 2 -16 3 -8 4 0 Z" fill="#7A4E2C"/><path d="M-3 0 C -3 -10 -4 -18 -6 -24 L -2 -24 C -1 -16 -1 -8 0 0 Z" fill="#9A6A40"/>
    <circle cx="-10" cy="-28" r="11" fill="${dk}"/><circle cx="9" cy="-29" r="12" fill="${dk}"/><circle cx="0" cy="-41" r="13" fill="url(#${k}-leaf)"/><circle cx="-11" cy="-31" r="9.5" fill="url(#${k}-leaf)"/><circle cx="9" cy="-32" r="10" fill="url(#${k}-leaf)"/>
    <circle cx="-5" cy="-47" r="5" fill="#D6F59A" opacity=".45"/><circle cx="-14" cy="-35" r="3" fill="#D6F59A" opacity=".35"/>`)}
function bush(x,y,s,k,fl){return G(x,y,s,`${shadow(12,4,1,.18)}<circle cx="-6" cy="-5" r="7" fill="#3F8F2E"/><circle cx="6" cy="-5" r="7" fill="#3F8F2E"/><circle cx="0" cy="-10" r="8" fill="url(#${k}-leaf)"/><circle cx="-3" cy="-13" r="2.6" fill="#D6F59A" opacity=".45"/>${fl?`<circle cx="4" cy="-8" r="1.7" fill="#F28CB1"/><circle cx="-5" cy="-11" r="1.5" fill="#FFF3B0"/><circle cx="7" cy="-3" r="1.4" fill="#fff"/>`:''}`)}
function flowers(x,y,seed){const out=[];for(let i=0;i<5;i++){const a=hrand(seed+i),b=hrand(seed+'b'+i),cx=f1(x+(a-.5)*22),cy=f1(y+(b-.5)*10);
  out.push(`<circle cx="${cx}" cy="${cy}" r="1.7" fill="${['#FFFFFF','#FFE27A','#F7A8C8','#BFE3FF','#FFB38A'][i%5]}"/><circle cx="${cx}" cy="${cy}" r=".6" fill="#C98A1E"/>`)}return out.join('')}
function tuft(x,y,c){return `<path d="M${f1(x-4)} ${f1(y)} q 1 -6 2 -7 M${f1(x)} ${f1(y)} q 0 -8 1 -9 M${f1(x+4)} ${f1(y)} q -1 -6 -2 -7" stroke="${c||'#3A8A2A'}" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".75"/>`}
function pebbles(x,y,seed){const a=hrand(seed),b=hrand(seed+'q');return `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="3.4" ry="1.9" fill="#A9B1BD"/><ellipse cx="${f1(x-.8)}" cy="${f1(y-.6)}" rx="1.8" ry=".8" fill="#E6EAF0"/><ellipse cx="${f1(x+5+a*3)}" cy="${f1(y+1.5+b)}" rx="2.2" ry="1.3" fill="#98A0AD"/>`}
function shroom(x,y,glow,seed){const c=glow?'#7FE6F7':'#E8553F';if(glow)withOrg(x,y,1,()=>fx('g',0,-4,7,'#7FE6F7',.45));
  return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-1 0 L-1 -4 L1 -4 L1 0 Z" fill="#F4ECD8"/><path d="M-4.5 -3.6 Q 0 -9 4.5 -3.6 Z" fill="${c}"/><circle cx="-1.6" cy="-5.4" r=".8" fill="#fff" opacity=".9"/><circle cx="1.8" cy="-4.6" r=".6" fill="#fff" opacity=".9"/>${hrand(seed)>.5?`<g transform="translate(5 1) scale(.7)"><path d="M-1 0 L-1 -4 L1 -4 L1 0 Z" fill="#F4ECD8"/><path d="M-4.5 -3.6 Q 0 -9 4.5 -3.6 Z" fill="${c}"/></g>`:''}</g>`}
/* рунный камень: плита с вырезанным знаком, знак светится */
function menhir(x,y,s,col,v){col=col||'#7FE6F7';withOrg(x,y,s,()=>fx('g',0,-24,16,col,.5));
  const rune=['M-2 -32 L2 -28 L-2 -24 L2 -20 M-3 -16 L3 -16','M0 -33 L0 -17 M-3 -29 L3 -25 M-3 -22 L3 -18','M-3 -31 L3 -31 L0 -26 L3 -21 L-3 -21'][(v||0)%3];
  return G(x,y,s,`${shadow(10,3.4,2,.24)}<path d="M-8 2 L-9 -30 L-4 -41 L5 -39 L9 -27 L8 2 Q0 5 -8 2 Z" fill="${STONE[1]}"/><path d="M-9 -30 L-4 -41 L-1 -38 L-2 3 L-8 2 Z" fill="${STONE[0]}"/><path d="M5 -39 L9 -27 L8 2 Q6 3 4 3 L4 -30 Z" fill="${STONE[2]}"/>
    <path d="${rune}" stroke="${col}" stroke-width="3.2" opacity=".35" fill="none" stroke-linecap="round"/><path d="${rune}" stroke="#F2FEFF" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M-8 -2 q 3 -4 6 -1 q 3 -3 6 0" stroke="#4E9F33" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>`)}
/* ---------- Огненный остров: базальт, остывшая лава, обсидиан, обугленные деревья ---------- */
function charTree(x,y,s,v){const lean=(v%3-1)*2;
  return G(x,y,s,`${shadow(11,4,1,.25)}<path d="M-2 0 C -2 -10 ${-3+lean} -20 ${-5+lean} -30 L ${1+lean} -30 C ${lean} -18 2 -8 3 0 Z" fill="#2B2022"/>
  <path d="M${-3+lean} -18 L -11 -26 M${lean} -23 L 9 -31 M${-4+lean} -27 L -9 -36" stroke="#2B2022" stroke-width="2.6" stroke-linecap="round"/><path d="M${f1(-1+lean)} -12 l1 -6" stroke="#FF8A2A" stroke-width="1.2" opacity=".8"/>`)}
function crack(x,y,seed){const a=hrand(seed),b=hrand(seed+'b'),w=14+a*16;withOrg(x,y,1,()=>fx('g',0,0,w*.9,'#FF7A1F',.35));
  return `<path d="M${f1(x-w)} ${f1(y+(b-.5)*4)} l${f1(w*.45)} ${f1(-3+a*3)} l${f1(w*.3)} ${f1(4-b*5)} l${f1(w*.5)} ${f1(-2+a*2)} l${f1(w*.5)} ${f1(2-b*3)}" stroke="#FF7A1F" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>
  <path d="M${f1(x-w*.5)} ${f1(y+(b-.5)*4-1)} l${f1(w*.3)} ${f1(-2+a*2)} l${f1(w*.4)} ${f1(3-b*4)}" stroke="#FFE27A" stroke-width="1" fill="none" stroke-linecap="round"/>`}
function vent(x,y,i){withOrg(x,y,1,()=>{fx('m',0,-8,9,'#8E868B');fx('g',0,-6,10,'#FF7A1F',.5)});
  return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-9 2 L-5 -6 L5 -6 L9 2 Z" fill="#3A2E32"/><path d="M-9 2 L-5 -6 L-1 -6 L-2 2 Z" fill="#4E4045"/><ellipse cx="0" cy="-6" rx="5" ry="2" fill="#FF7A1F"/><ellipse cx="0" cy="-6" rx="2.6" ry="1" fill="#FFE27A"/></g>`}
function cloud(x,y,s,op){return `<g transform="translate(${f1(x)} ${f1(y)}) scale(${s})" opacity="${op||1}"><ellipse cx="0" cy="8" rx="70" ry="16" style="fill:var(--isl-cloud2)"/><circle cx="-38" cy="0" r="22" style="fill:var(--isl-cloud)"/><circle cx="-8" cy="-14" r="30" style="fill:var(--isl-cloud)"/><circle cx="26" cy="-6" r="24" style="fill:var(--isl-cloud)"/><circle cx="50" cy="4" r="16" style="fill:var(--isl-cloud)"/><ellipse cx="0" cy="10" rx="64" ry="12" style="fill:var(--isl-cloud)"/><circle cx="-14" cy="-22" r="12" fill="#fff" opacity=".5"/></g>`}

/* ---------- постройки в локальных координатах: центр площадки 2×2 = (0,0), ромб ±64 × ±32 ---------- */
/* HEIGHT — высота рисунка над центром: по ней ставится пузырь и считается, кого постройка загораживает (live.js) */
const HEIGHT={F:66,W:44,N:60,T:80,A:108,P:104,L:98,D:108,farm:40,nest:82,hatch:66};
/* ---------- жилище-вольер ----------
   Среда обитания — круглая каменная площадка из плит на всю клетку 2×2. Знак среды (вулкан, водопад, пещера…) стоит
   в глубине площадки, перед ним двор: там драконы живут, ходят и взлетают, за бортик не выходят.
   Двор в клетках постройки: u, v от YARD.lo до YARD.hi и u+v ≥ YARD.front (перед знаком среды), см. live.js.
   Пол площадки на уровне земли, поэтому лапы драконов стоят на полу; бортик и цоколь выступают над и под ним. */
const HAB_SC=1,HAB_DY=0,YARD={lo:0.32,hi:1.68,front:1.75};
const PAD={
  F:{L:'#6E6576',M:'#504858',D:'#352E3C',base:'#3E3644',baseD:'#221D27',fl:'#463A40',fl2:'#2A2226'},
  W:{L:'#F0F4F8',M:'#C9D2DD',D:'#98A4B4',base:'#B6C0CD',baseD:'#7E8A9B',fl:'#5FDCEB',fl2:'#1C7FB4'},
  N:{L:'#BBB0C8',M:'#968AA3',D:'#6B5F7B',base:'#7E728C',baseD:'#4E4560',fl:'#5F5571',fl2:'#3A3249'},
  T:{L:'#F6E2B6',M:'#DFC08A',D:'#B28F5A',base:'#CCA56E',baseD:'#8F6D3F',fl:'#EBCF97',fl2:'#C9A26B'},
  A:{L:'#FFFFFF',M:'#E3EBF3',D:'#B6C6D8',base:'#CFDAE6',baseD:'#93A6BD',fl:'#F7FAFD',fl2:'#D6E2EF'},
  P:{L:'#CCDAA9',M:'#A5B782',D:'#778959',base:'#8E9F6C',baseD:'#5F6D45',fl:'#86D257',fl2:'#4E9F33'},
  L:{L:'#FFF8E4',M:'#F0DFB2',D:'#CBB072',base:'#DEC68E',baseD:'#A98B4F',fl:'#F8EAC4',fl2:'#E6CB84'},
  D:{L:'#5E5079',M:'#423758',D:'#2A2239',base:'#312944',baseD:'#19141F',fl:'#2C2439',fl2:'#17121F'}};
const PR=62,PRI=51;            /* внешний и внутренний радиус кольца плит (по горизонтали; по вертикали вдвое меньше) */
const ell=(a,r,dy)=>[Math.cos(a)*r,Math.sin(a)*r/2+(dy||0)];
/* кольцо плит: плита — кусок кольца, приподнятый на h; у дальних видна внутренняя стенка, у ближних — наружная */
function slabs(p,front,h,seed){const out=[],N=7,gap=.035;
  for(let i=0;i<N;i++){const a0=(front?0:Math.PI)+i*Math.PI/N+gap,a1=a0+Math.PI/N-gap*2,am=(a0+a1)/2,v=hrand(seed+i);
    const top=[ell(a0,PR,-h),ell(am,PR+1,-h),ell(a1,PR,-h),ell(a1,PRI,-h),ell(am,PRI-.5,-h),ell(a0,PRI,-h)];
    if(front)out.push(path([ell(a0,PR,-h),ell(am,PR+1,-h),ell(a1,PR,-h),ell(a1,PR,1),ell(am,PR+1,1),ell(a0,PR,1)],p.D));
    else out.push(path([ell(a0,PRI,-h),ell(am,PRI-.5,-h),ell(a1,PRI,-h),ell(a1,PRI,0),ell(am,PRI-.5,0),ell(a0,PRI,0)],p.M));
    out.push(path(top,v<.33?p.L:v<.66?p.M:p.L,v>=.33&&v<.66?'opacity=".96"':''));
    out.push(`<path d="M${pp(ell(a0+.03,PR-1.2,-h-.2))} Q${pp(ell(am,PR,-h-.4))} ${pp(ell(a1-.03,PR-1.2,-h-.2))}" stroke="#fff" stroke-width="1" fill="none" opacity="${front?.55:.4}"/>`);
    if(v>.8)out.push(`<ellipse cx="${f1(Math.cos(am)*(PR+PRI)/2)}" cy="${f1(Math.sin(am)*(PR+PRI)/4-h-.5)}" rx="3.4" ry="1.4" fill="#5DA83A" opacity=".75"/>`)}
  return out.join('')}
/* шов под кольцом плит: в щелях между плитами виден тёмный раствор, а не небо (рисуется до пола) */
const mortar=(p,h)=>`<ellipse cx="0" cy="${f1(-h/2)}" rx="${PR+.5}" ry="${f1(PR/2+h/2+.5)}" fill="${p.D}"/>`;
/* пол площадки по среде */
function habFloor(t,p,k){const o=[`<ellipse cx="0" cy="0" rx="${PRI+.5}" ry="${(PRI+.5)/2}" fill="url(#${k}-fl${t})"/>`];
  switch(t){
    case 'F':o.push(`<path d="M-40 7 Q -26 13 -10 9 Q 4 5 20 13 M 8 -3 Q 24 1 40 -3 M-30 -6 Q -18 -2 -6 -8" stroke="url(#${k}-lava)" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".85"/><path d="M-30 9 Q -20 12 -10 9 M 14 0 Q 26 2 36 -2" stroke="#FFE9A0" stroke-width="1" fill="none" stroke-linecap="round"/>`);
      fx('g',-14,9,16,'#FF7A1F',.35);fx('g',26,0,14,'#FF7A1F',.3);break;
    case 'W':o.push(`<ellipse cx="0" cy="0" rx="${PRI-1}" ry="${(PRI-1)/2}" fill="none" stroke="#F4E3BF" stroke-width="3.2" opacity=".55"/><ellipse cx="-14" cy="-6" rx="20" ry="5" fill="#fff" opacity=".18"/>
      <path d="M-34 4 q 6 -3 12 0 t 12 0 M-6 12 q 6 -3 12 0 t 12 0 M 4 -4 q 5 -2.5 10 0 t 10 0" stroke="#E8FDFF" stroke-width="1.2" fill="none" opacity=".55" stroke-linecap="round"/>
      <g transform="translate(-22 9)"><ellipse rx="7.5" ry="3.2" fill="#4FA53A"/><path d="M0 0 L7 -1.5 L6.5 1.5 Z" fill="${p.fl}"/><ellipse cx="-1.5" cy="-.6" rx="4" ry="1.4" fill="#7FCB5A"/><circle cx="-2" cy="-1.6" r="1.9" fill="#FF92C8"/><circle cx="-2" cy="-1.9" r=".8" fill="#FFF3B0"/></g>
      <g transform="translate(14 15)"><ellipse rx="5.5" ry="2.4" fill="#4FA53A"/><path d="M0 0 L5 -1 L4.6 1.2 Z" fill="${p.fl}"/><ellipse cx="-1" cy="-.4" rx="3" ry="1" fill="#7FCB5A"/></g>`);
      fx('r',-10,6,12);fx('r',12,10,9);fx('s',0,4,30,'#F2FEFF');break;
    case 'N':o.push(`${[[-38,4],[34,6],[-20,14],[24,-4]].map(([x,y],i)=>crystal(x,y,6+i%2*3,2,i%2?CYAN:AMETH,i%2?2:-2)).join('')}<path d="M-28 -2 l8 3 l6 -4 M 10 10 l8 -2 l5 4" stroke="#2A2335" stroke-width="1.2" fill="none" opacity=".6"/>`);break;
    case 'T':o.push(`<path d="M-38 2 q 10 -4 20 0 t 20 0 M-24 12 q 10 -4 20 0 t 20 0 M 4 -8 q 8 -3 16 0 t 16 0" stroke="#C9A26B" stroke-width="1.4" fill="none" opacity=".8" stroke-linecap="round"/>${pebbles(-30,10,'tp1')}${pebbles(26,6,'tp2')}`);break;
    case 'A':o.push(`<ellipse cx="0" cy="0" rx="40" ry="20" fill="none" stroke="#E8C25A" stroke-width="1.6" opacity=".85"/><ellipse cx="0" cy="0" rx="28" ry="14" fill="none" stroke="#E8C25A" stroke-width="1" opacity=".6"/>
      ${[[-44,4,8],[42,6,7],[-30,16,6],[30,16,6],[0,22,6]].map(([x,y,r])=>`<circle cx="${x}" cy="${y-r*.4}" r="${r}" fill="#fff"/><circle cx="${x+r*.8}" cy="${y-r*.2}" r="${r*.7}" fill="#fff"/><ellipse cx="${x+r*.3}" cy="${y+1}" rx="${r*1.6}" ry="${r*.5}" fill="#D6E2EF"/>`).join('')}`);break;
    case 'P':o.push(`${flowers(-28,8,'pf1')}${flowers(26,12,'pf2')}${flowers(0,18,'pf3')}${tuft(-36,2,'#2F7A22')}${tuft(36,4,'#2F7A22')}${tuft(10,6,'#2F7A22')}<ellipse cx="-12" cy="-4" rx="18" ry="5" fill="#C8F59A" opacity=".25"/>`);break;
    case 'L':o.push(`<ellipse cx="0" cy="0" rx="42" ry="21" fill="none" stroke="#D9B450" stroke-width="2"/><ellipse cx="0" cy="0" rx="30" ry="15" fill="none" stroke="#D9B450" stroke-width="1.2" opacity=".8"/>
      ${Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return `<path d="M${pp(ell(a,31))} L${pp(ell(a,41))}" stroke="#D9B450" stroke-width="1.2" opacity=".8"/>`}).join('')}`);break;
    case 'D':o.push(`<ellipse cx="0" cy="0" rx="40" ry="20" fill="none" stroke="#B07CFF" stroke-width="1.6" opacity=".85"/><path d="${Array.from({length:6},(_,i)=>{const a=i/6*Math.PI*2+.3,b=a+Math.PI*2/6*2;return `M${pp(ell(a,40))} L${pp(ell(b,40))}`}).join(' ')}" stroke="#B07CFF" stroke-width="1.1" fill="none" opacity=".55"/>`);
      fx('g',0,0,34,'#9C6BFF',.28);break}
  return o.join('')}
/* площадка: тень, цоколь, пол, дальнее кольцо плит (под знаком среды) */
function habPad(t,k,lvl){const p=PAD[t],o=[];
  o.push(`<ellipse cx="0" cy="9" rx="70" ry="32" fill="#0B1A10" opacity=".22"/>`);
  o.push(`<path d="M${-PR} 0 A${PR} ${PR/2} 0 0 0 ${PR} 0 L${PR} 11 A${PR} ${PR/2} 0 0 1 ${-PR} 11 Z" fill="url(#${k}-base${t})"/>`);
  o.push(`<path d="${Array.from({length:8},(_,i)=>{const a=(i+.5)/8*Math.PI,[x,y]=ell(a,PR);return `M${f1(x)} ${f1(y+1)} l0 ${i%2?9:10}`}).join(' ')}" stroke="${p.baseD}" stroke-width="1.2" opacity=".7"/>`);
  o.push(`<path d="M${-PR} 11 A${PR} ${PR/2} 0 0 0 ${PR} 11" stroke="#3E8A2A" stroke-width="3" fill="none" opacity=".55" stroke-dasharray="3 5"/>`);
  o.push(mortar(p,9));
  o.push(habFloor(t,p,k));
  o.push(slabs(p,false,9,'sb'+t));
  if(lvl>=5)o.push(inlay(-9,Math.PI+.05,Math.PI*2-.05));
  if(lvl>=2)o.push(banners(t));
  return o.join('')}
/* ближний низкий бортик: рисуется поверх двора */
function habFront(t,lvl){return slabs(PAD[t],true,4,'sf'+t)+(lvl>=3?lanterns(t):'')+(lvl>=5?inlay(-4,.1,Math.PI-.1):'')}
const inlay=(h,a0,a1)=>{const r=(PR+PRI)/2;return `<path d="M${pp(ell(a0,r,h))} A${r} ${r/2} 0 0 1 ${pp(ell(a1,r,h))}" stroke="#F2D27A" stroke-width="1.6" fill="none" opacity=".95"/>`};
/* постройка растёт с уровнем: флажки цвета стихии (2-й), фонари со светом (3-й), золотая инкрустация по кольцу (5-й) */
const ACC={F:'#FF7A1F',W:'#3FC6E0',N:'#A77BFF',T:'#E8B33C',A:'#7FC2FF',P:'#F06AA8',L:'#FFC93C',D:'#9C6BFF'};
function banners(t){const c=ACC[t]||'#F2C94C';return [Math.PI*1.12,Math.PI*1.88].map((a,i)=>{const [x,y]=ell(a,PR-4,-9);const s=i?-1:1;
  return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M0 0 L0 -30" stroke="#7A5A3A" stroke-width="2.2" stroke-linecap="round"/><path d="M0 -30 L0 -31" stroke="#F2D27A" stroke-width="3" stroke-linecap="round"/><path d="M0 -29 L${12*s} -25 L0 -20 Z" fill="${c}"/><path d="M0 -29 L${6*s} -27 L0 -24.5 Z" fill="#fff" opacity=".35"/></g>`}).join('')}
function lanterns(t){const c=ACC[t]||'#FFD36A';return [Math.PI*.18,Math.PI*.82].map(a=>{const [x,y]=ell(a,PR-5,-4);fx('g',x,y-12,10,'#FFD36A',.55);
  return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-1.4 0 L-1.4 -9 L1.4 -9 L1.4 0 Z" fill="#5E4428"/><path d="M-3.6 -9 L3.6 -9 L3 -16 L-3 -16 Z" fill="#FFE9A0"/><path d="M-3.6 -9 L3.6 -9 L3 -16 L-3 -16 Z" fill="none" stroke="#5E4428" stroke-width="1"/><path d="M-4.4 -16 L4.4 -16 L0 -20 Z" fill="${c}"/></g>`}).join('')}

/* знаки сред: в глубине площадки (основание около y = −8), шириной до ±42 */
const MARK={
  /* Кальдера: гранёный базальтовый конус, кратер с лавой, потоки по склону */
  F:k=>{fx('g',0,-57,26,'#FF8A2B',.7);fx('e',0,-60,8,'#FFB347');fx('m',0,-66,10,'#8E868B');fx('g',-16,-5,13,'#FF7A1F',.5);
    return `${stone(-34,-6,.75,BAS,0)}${stone(34,-8,.62,BAS,2)}
    <path d="M-34 -8 C -28 -24 -18 -44 -11 -56 L 11 -56 C 18 -44 28 -24 34 -8 C 16 -2 -16 -2 -34 -8 Z" fill="url(#${k}-basalt)"/>
    <path d="M-34 -8 C -28 -24 -18 -44 -11 -56 L -4 -56 C -8 -40 -12 -22 -13 -4 C -22 -4 -30 -6 -34 -8 Z" fill="${BAS[0]}" opacity=".6"/>
    <path d="M 11 -56 C 18 -44 28 -24 34 -8 C 28 -6 22 -5 16 -4 C 14 -22 12 -40 5 -56 Z" fill="#120E14" opacity=".35"/>
    <path d="M-24 -20 L-16 -24 L-14 -34 M 18 -40 L 22 -28 L 30 -24 M -6 -44 L -9 -32" stroke="#1C171F" stroke-width="1.4" fill="none" opacity=".6"/>
    <ellipse cx="0" cy="-56" rx="11.5" ry="4.2" fill="${BAS[2]}"/><ellipse cx="0" cy="-56.6" rx="9" ry="3" fill="url(#${k}-lava)"/><ellipse cx="0" cy="-57" rx="4.6" ry="1.4" fill="#FFF3B0"/>
    <path d="M-3 -54 C -6 -44 -2 -34 -6 -22 C -8 -14 -4 -9 -7 -5 M 4 -54 C 8 -42 6 -32 10 -20 C 12 -14 10 -10 12 -6" stroke="url(#${k}-lavaV)" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M-3 -52 C -5 -44 -2 -36 -5 -26 M 4 -52 C 7 -44 6 -36 9 -26" stroke="#FFE9A0" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <ellipse cx="-16" cy="-4" rx="8.5" ry="2.8" fill="${BAS[2]}"/><ellipse cx="-16" cy="-4.3" rx="6.4" ry="1.9" fill="url(#${k}-lava)"/>
    ${crystal(28,-6,12,3,EMBC,3)}${crystal(-27,-4,9,2.4,EMBC,-2)}`},
  /* Лагуна: скала с водопадом в пруд, камыш */
  W:k=>{fx('r',22,-6,10);fx('s',23,-24,8,'#FFFFFF');fx('g',22,-8,12,'#BFF6FF',.35);
    return `${stone(10,-7,.75,STONE,0)}${stone(26,-11,1.25,STONE,1)}${stone(38,-5,.6,STONE,2)}
    <path d="M21 -38 Q 19.5 -22 18.5 -9 L 27 -9 Q 27.5 -22 27.5 -38 Z" fill="url(#${k}-fall)"/><path d="M22.5 -36 L21 -12 M25.5 -36 L25 -12" stroke="#fff" stroke-width="1.1" opacity=".75" stroke-linecap="round"/>
    <ellipse cx="22.5" cy="-8" rx="10" ry="3.2" fill="#fff" opacity=".8"/><circle cx="17" cy="-9.5" r="2" fill="#fff" opacity=".85"/><circle cx="28" cy="-9.8" r="2.4" fill="#fff" opacity=".85"/>
    <g stroke-linecap="round"><path d="M-36 -4 q -2 -14 1 -22 M-32 -4 q 1 -12 4 -18 M-39 -3 q -4 -10 -2 -16 M-28 -4 q 2 -9 5 -12" stroke="#3E8A2A" stroke-width="1.8" fill="none"/><path d="M-35 -26 l0 -5 M-28 -22 l1 -5" stroke="#8A5A2C" stroke-width="3"/></g>
    ${crystal(-18,-8,10,2.6,CYAN,-2)}`},
  /* Пещера: гранёный холм, тёмный вход со светом, друзы аметиста и голубого кварца */
  N:k=>{fx('g',2,-14,18,'#C59BFF',.5);fx('g',-31,-18,13,'#B98CFF',.45);fx('g',31,-16,12,'#7FE6F7',.45);fx('s',-30,-22,10,'#EAD6FF');
    return `${stone(-40,-2,.7,['#B7ACC4','#8E82A0','#5E536E'],0)}${stone(40,-4,.6,['#B7ACC4','#8E82A0','#5E536E'],2)}
    <path d="M-40 -6 C -42 -30 -26 -56 -2 -58 C 24 -58 40 -34 40 -6 C 20 0 -20 0 -40 -6 Z" fill="url(#${k}-cave)"/>
    <path d="M-40 -6 C -42 -30 -26 -56 -2 -58 L -6 -50 C -22 -46 -32 -28 -30 -4 Z" fill="#C9BFD6" opacity=".45"/><path d="M 24 -50 C 36 -40 40 -24 40 -6 C 34 -4 30 -3 26 -3 C 30 -20 30 -36 24 -50 Z" fill="#1E1828" opacity=".35"/>
    <path d="M-26 -40 L -16 -46 L -6 -42 M 6 -50 L 16 -44 L 24 -48" stroke="#5E536E" stroke-width="1.3" fill="none" opacity=".7"/>
    <path d="M-30 -48 q 8 -8 18 -6 q 8 -6 16 0" stroke="#5DA83A" stroke-width="3.4" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M-15 -3 C -16 -20 -8 -32 2 -32 C 12 -32 18 -20 17 -3 Z" fill="#17111F"/><path d="M-10 -3 C -10 -16 -4 -24 2 -24 C 8 -24 12 -16 12 -3 Z" fill="url(#${k}-glow)"/>
    <path d="M-9 -29 l2 7 l2 -7 M 4 -31 l1.6 6 l1.6 -6" fill="#CFC6D6"/>
    ${crystal(-32,-7,24,5.4,AMETH,-4)}${crystal(-24,-5,15,4,AMETH,2)}${crystal(-38,-3,11,3,CYAN,-2)}${crystal(30,-6,20,4.6,CYAN,3)}${crystal(37,-3,12,3.2,AMETH,2)}`},
  /* Утёс: песчаниковые столбы со слоями, золотая руда наверху */
  T:k=>{fx('s',-2,-76,10,'#FFF5C2');fx('g',-2,-74,12,'#F7CF52',.35);
    /* столб: левая грань на свету, правая в тени, неровная шапка, слои песчаника */
    const col=(x,y,w,h,v)=>{const tl=[x-w*.72,y-h],tt=[x+w*.05,y-h-w*.32],tr=[x+w*.78,y-h+2],tf=[x+w*.02,y-h+w*.3];
      let o=path([[x-w,y],[x-w*.94,y-h*.55],tl,tf,[x,y+w*.42]],SAND[1])+path([[x,y+w*.42],tf,tr,[x+w*.96,y-h*.5],[x+w,y]],SAND[2])+path([tl,tt,tr,tf],SAND[0]);
      for(let z=10+v*6;z<h-6;z+=10+v*5){const a=[x-w*.97,y-z],m=[x,y+w*.42-z],b=[x+w*.98,y-z];o+=`<path d="M${pp(a)} Q${pp([x-w*.5,m[1]+2])} ${pp(m)} Q${pp([x+w*.5,m[1]+1])} ${pp(b)}" stroke="#9C7A48" stroke-width="1.3" fill="none" opacity=".5"/>`}
      return o+`<path d="M${pp(tl)} L${pp(tt)} L${pp(tr)}" stroke="#fff" stroke-width="1.2" fill="none" opacity=".55"/><path d="M${pp([x-w*.94,y-h*.55])} L${pp(tl)}" stroke="#FFF6DC" stroke-width="1.4" opacity=".6"/>`};
    return `${stone(-40,-2,.75,SAND,2)}${col(-26,-6,14,30,.2)}${col(24,-6,16,44,.6)}${col(-2,-12,21,62,.4)}
    ${crystal(-6,-76,12,3.2,GOLDC,-2)}${crystal(2,-75,8,2.4,GOLDC,2)}${crystal(26,-52,8,2.4,GOLDC,1)}
    <path d="M-34 -38 q 2 -5 5 -2 q 2 -4 5 0 M18 -52 q 2 -4 4 -1 q 2 -3 4 0" stroke="#7A9A3A" stroke-width="2" fill="none" stroke-linecap="round"/>${stone(40,-2,.6,SAND,0)}${stone(12,-4,.45,SAND,1)}`},
  /* Облачный шпиль: мраморная башня с золотом на облаке, кольцо облаков */
  A:k=>{fx('g',0,-104,14,'#BFE3FF',.55);fx('s',0,-62,26,'#FFFFFF');
    return `<ellipse cx="0" cy="-44" rx="30" ry="8" fill="none" stroke="#fff" stroke-width="6" opacity=".55" stroke-dasharray="40 200" stroke-dashoffset="-70"/>
    <path d="M-10 -8 L-7.5 -74 L7.5 -74 L10 -8 Z" fill="url(#${k}-marble)"/><path d="M-10 -8 L-7.5 -74 L-3 -74 L-4 -8 Z" fill="#fff" opacity=".6"/>
    <path d="M-9.6 -30 L9.6 -30 M-9 -52 L9 -52" stroke="#E2B94C" stroke-width="2.4"/><rect x="-3.4" y="-66" width="6.8" height="9" rx="3.4" fill="#5E9BD1"/><rect x="-3.4" y="-44" width="6.8" height="8" rx="3.4" fill="#5E9BD1"/>
    <ellipse cx="0" cy="-75" rx="12.5" ry="4" fill="#F2D27A"/><ellipse cx="0" cy="-76" rx="11" ry="3.2" fill="#FFF0BE"/>
    <path d="M-10 -77 L0 -100 L10 -77 Z" fill="url(#${k}-spire)"/><path d="M-10 -77 L0 -100 L-2 -77 Z" fill="#fff" opacity=".35"/><circle cx="0" cy="-103" r="3.6" fill="#FFF3B0"/>
    <path d="M-30 -44 A30 8 0 0 0 30 -44" stroke="#fff" stroke-width="6" fill="none" opacity=".85" stroke-linecap="round"/>
    ${[[-30,-6,13],[-12,-2,15],[10,-3,15],[30,-6,12],[0,-12,13]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('')}<ellipse cx="0" cy="-2" rx="40" ry="8" fill="#D6E2EF"/>${[[-20,-6,9],[18,-6,9]].map(([x,y,r])=>`<circle cx="${x}" cy="${y-4}" r="${r}" fill="#fff"/>`).join('')}
    <path d="M-36 -26 C -18 -34 6 -18 24 -30 M-28 -62 C -12 -68 10 -54 26 -64" stroke="#BFE3FF" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/>`},
  /* Роща: волшебное дерево с корнями, пышная крона, светящиеся плоды */
  P:k=>{fx('f',0,-62,36,'#EFFF9A');[[-20,-54],[18,-66],[4,-46]].forEach(([x,y])=>fx('g',x,y,8,'#FFD36A',.5));
    return `<path d="M-9 -4 C -8 -24 -10 -40 -13 -54 L 11 -54 C 8 -40 8 -24 11 -4 C 4 0 -3 0 -9 -4 Z" fill="url(#${k}-trunk)"/>
    <path d="M-9 -4 C -16 -2 -26 2 -32 0 M 11 -4 C 18 -2 28 2 34 -2 M 0 -2 C 0 4 -4 8 -8 10" stroke="#6A4224" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="2" cy="-24" rx="4.5" ry="6.5" fill="#3A2412"/>
    ${[[-30,-66,22],[28,-68,22],[-14,-90,24],[16,-88,22],[0,-74,26],[-38,-52,14],[38,-52,14]].map(([x,y,r],i)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${i%2?'#3C8A2E':'#47992F'}"/>`).join('')}
    ${[[-14,-88,18],[18,-82,16],[0,-72,20],[-28,-62,14],[30,-64,14]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${k}-leaf)"/>`).join('')}
    <circle cx="-18" cy="-98" r="7" fill="#E4FFB0" opacity=".35"/><circle cx="-32" cy="-70" r="4" fill="#E4FFB0" opacity=".3"/>
    ${[[-20,-54],[18,-66],[4,-46],[-30,-74],[28,-50]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i<3?3.2:2.6}" fill="${i%2?'#FF92C8':'#FFD36A'}"/><circle cx="${x-1}" cy="${y-1}" r="1" fill="#fff" opacity=".8"/>`).join('')}
    ${shroom(-26,-2,false,'pm1')}${shroom(28,0,true,'pm2')}`},
  /* Храм рассвета: колоннада, золотой купол, солнечный диск */
  L:k=>{fx('g',0,-90,30,'#FFE27A',.6);fx('s',0,-60,30,'#FFF5C2');
    const col=x=>`<rect x="${x-3.2}" y="-46" width="6.4" height="38" fill="#FFF6DC"/><rect x="${x-3.2}" y="-46" width="2.4" height="38" fill="#fff"/><rect x="${x+1}" y="-46" width="2.2" height="38" fill="#E5D3A2"/><rect x="${x-4.4}" y="-49" width="8.8" height="3.4" fill="#F2D27A"/><rect x="${x-4.4}" y="-10" width="8.8" height="3" fill="#E9D7A8"/>`;
    return `<ellipse cx="0" cy="-8" rx="38" ry="10" fill="#E4CF98"/><ellipse cx="0" cy="-10" rx="36" ry="9" fill="#F8EBC6"/>
    ${[-26,-13,0,13,26].map(col).join('')}
    <path d="M-34 -50 L34 -50 L30 -56 L-30 -56 Z" fill="#F2D27A"/><path d="M-34 -50 L34 -50" stroke="#B8962E" stroke-width="1.2"/>
    <path d="M-28 -56 C -28 -82 28 -82 28 -56 Z" fill="url(#${k}-gold)"/><path d="M-20 -62 C -16 -74 -4 -78 6 -76" stroke="#fff" stroke-width="2.2" fill="none" opacity=".6" stroke-linecap="round"/><path d="M0 -77 L0 -56 M-14 -74 Q -16 -64 -16 -56 M14 -74 Q 16 -64 16 -56" stroke="#C99A2E" stroke-width="1" fill="none" opacity=".6"/>
    <circle cx="0" cy="-90" r="9" fill="#FFF3B0" stroke="#F2C94C" stroke-width="2"/>${Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2;return `<path d="M${f1(Math.cos(a)*12)} ${f1(-90+Math.sin(a)*12)} L${f1(Math.cos(a)*18)} ${f1(-90+Math.sin(a)*18)}" stroke="#F2C94C" stroke-width="2.4" stroke-linecap="round"/>`}).join('')}`},
  /* Обсидиановая башня: зубчатый шпиль чёрного стекла, руны, парящие осколки */
  D:k=>{fx('g',0,-64,20,'#B07CFF',.55);fx('g',0,-104,12,'#D9C2FF',.5);fx('s',0,-70,30,'#E6D6FF');
    return `${stone(-38,-2,.7,OBS,0)}${stone(38,-4,.6,OBS,2)}
    ${crystal(-26,-6,40,7,OBSC,-7)}${crystal(26,-6,46,8,OBSC,7)}
    <path d="M-15 -8 L-19 -50 L-7 -72 L0 -106 L7 -72 L19 -50 L15 -8 Z" fill="url(#${k}-obs)"/><path d="M-15 -8 L-19 -50 L-7 -72 L0 -106 L-2 -70 L-6 -48 L-4 -8 Z" fill="#8E7BB8" opacity=".4"/><path d="M0 -106 L7 -72 L19 -50 L15 -8 L8 -8 L9 -50 Z" fill="#0E0A16" opacity=".4"/>
    <path d="M-6 -30 L0 -40 L6 -30 L0 -20 Z M0 -60 L0 -84 M-4 -68 L4 -76" stroke="#D2B6FF" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M-34 -70 l4 -8 l4 8 l-4 6 Z M30 -62 l3 -6 l3 6 l-3 5 Z" fill="#6A5A8C"/><path d="M-34 -70 l4 -8 l1 8 Z M30 -62 l3 -6 l1 6 Z" fill="#B9A6E8"/>`}};
const habMark=(t,k)=>MARK[t](k);

/* ---------- Гнездовье: площадка в цветах, каменная арка с розовым светом и руной, рунный круг, плетёное гнездо ---------- */
const NPAD={L:'#F2E6EA',M:'#D9C6CE',D:'#A8939E',base:'#C2AEB8',baseD:'#86707C'};
function nestBase(k){fx('g',0,-30,30,'#FF8CC6',.5);fx('s',0,-40,26,'#FFE0F0');fx('g',0,-77,9,'#FF5AB0',.6);
  const C=[0,-30],RO=46,RI=33,N=9,ar=(a,r,dx,dy)=>[C[0]+Math.cos(a)*r+(dx||0),C[1]+Math.sin(a)*r+(dy||0)];
  const back=[],face=[];
  for(let i=0;i<N;i++){const a0=Math.PI+i/N*Math.PI+.012,a1=Math.PI+(i+1)/N*Math.PI-.012,v=hrand('na'+i);
    back.push(path([ar(a0,RO,4,3),ar(a1,RO,4,3),ar(a1,RI,4,3),ar(a0,RI,4,3)],STONE[2]));
    face.push(path([ar(a0,RO),ar(a1,RO),ar(a1,RI),ar(a0,RI)],v<.5?STONE[0]:'#D3D9E2')+`<path d="M${pp(ar(a0+.02,RO-1))} L${pp(ar(a1-.02,RO-1))}" stroke="#fff" stroke-width="1.2" opacity=".6"/>`)}
  const pil=x=>{const s=x<0?-1:1,x0=x<0?-RO:RI,x1=x<0?-RI:RO;return path([[x0+4,-30+3],[x1+4,-30+3],[x1+4,-4],[x0+4,-4]],STONE[2])+path([[x0,-30],[x1,-30],[x1,-6],[x0,-6]],x<0?STONE[0]:'#D3D9E2')+`<path d="M${x0+1} -20 L${x1-1} -20 M${x0+1} -12 L${x1-1} -12" stroke="${STONE[2]}" stroke-width="1" opacity=".6"/>${stone(x+s*4,-4,.55,STONE,2)}`};
  const bloom=([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${4.4+i%2}" fill="#4E9F33"/><circle cx="${x+2.4}" cy="${y-2}" r="2.6" fill="${i%2?'#FFB6D9':'#FFE0F0'}"/><circle cx="${x-2.2}" cy="${y+1}" r="2" fill="#FF92C8"/><circle cx="${x+.4}" cy="${y-.4}" r=".9" fill="#FFF3B0"/>`;
  return `<ellipse cx="0" cy="9" rx="70" ry="32" fill="#0B1A10" opacity=".2"/>
    <path d="M${-PR} 0 A${PR} ${PR/2} 0 0 0 ${PR} 0 L${PR} 10 A${PR} ${PR/2} 0 0 1 ${-PR} 10 Z" fill="${NPAD.base}"/><path d="M${-PR} 10 A${PR} ${PR/2} 0 0 0 ${PR} 10" stroke="${NPAD.baseD}" stroke-width="2" fill="none"/>
    ${mortar(NPAD,7)}<ellipse cx="0" cy="0" rx="${PRI+.5}" ry="${(PRI+.5)/2}" fill="url(#${k}-flP)"/>${flowers(-30,8,'nf1')}${flowers(30,10,'nf2')}${flowers(-8,19,'nf3')}
    ${slabs(NPAD,false,7,'nsb')}
    <path d="M${-RI} -6 L${-RI} -30 A${RI} ${RI} 0 0 1 ${RI} -30 L${RI} -6 Z" fill="url(#${k}-portal)"/>
    ${back.join('')}${pil(-1)}${pil(1)}${face.join('')}
    <path d="M-6 -73 L6 -73 L5 -80 L-5 -80 Z" fill="#EEF1F5" stroke="${STONE[2]}" stroke-width="1"/><path d="M-2.6 -78.4 L0 -74.4 L2.6 -78.4 M0 -74.4 L0 -73.6" stroke="#FF5AB0" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${[[-44,-26],[-41,-46],[-28,-64],[26,-66],[42,-48],[46,-30],[-12,-76],[14,-75]].map(bloom).join('')}
    <ellipse cx="0" cy="-12" rx="34" ry="11" fill="none" stroke="#FF8CC6" stroke-width="1.6" opacity=".85"/><path d="${Array.from({length:10},(_,i)=>{const a=i/10*Math.PI*2,x=Math.cos(a)*34,y=-12+Math.sin(a)*11;return `M${f1(x)} ${f1(y-1.6)} l0 3.2`}).join(' ')}" stroke="#FFD6EC" stroke-width="1.4"/>
    <ellipse cx="0" cy="-5" rx="28" ry="10" fill="#5E4428"/><ellipse cx="0" cy="-8" rx="27" ry="10" fill="none" stroke="url(#${k}-straw)" stroke-width="7"/>
    <path d="M-24 -10 C -12 -4 8 -4 24 -12 M-26 -6 C -10 2 10 2 26 -6 M-18 -16 L-8 -2 M-2 -18 L8 -2 M12 -17 L20 -4 M-12 -17 L-22 -4" stroke="#8A6534" stroke-width="1.3" fill="none" opacity=".75"/>
    <ellipse cx="0" cy="-9" rx="19" ry="6" fill="#6E5030"/><ellipse cx="-2" cy="-10" rx="10" ry="3" fill="#F6EEE2" opacity=".7"/>`}
function nestFront(){return slabs(NPAD,true,3,'nsf')}

/* ---------- Инкубатор: резной каменный цоколь с латунью, тёплый песок, стеклянный купол ---------- */
const HPAD={L:'#EEF1F5',M:'#C9D0DA',D:'#99A3B2',base:'#B4BDC9',baseD:'#7C8698'};
function hatchBase(k){fx('g',0,-22,32,'#FFB24A',.5);fx('g',0,-60,9,'#7FE6F7',.6);
  return `<ellipse cx="0" cy="9" rx="70" ry="32" fill="#0B1A10" opacity=".2"/>
    <path d="M${-PR} 0 A${PR} ${PR/2} 0 0 0 ${PR} 0 L${PR} 11 A${PR} ${PR/2} 0 0 1 ${-PR} 11 Z" fill="url(#${k}-baseW)"/>
    <path d="${Array.from({length:8},(_,i)=>{const a=(i+.5)/8*Math.PI,[x,y]=ell(a,PR);return `M${f1(x)} ${f1(y+1)} l0 10`}).join(' ')}" stroke="${HPAD.baseD}" stroke-width="1.2" opacity=".7"/>
    ${[0.2,0.4,0.6,0.8].map(t=>{const [x,y]=ell(t*Math.PI,PR);return `<path d="M${f1(x-2.4)} ${f1(y+4)} l2.4 3.4 l2.4 -3.4" stroke="#FF9A3D" stroke-width="1.6" fill="none"/>`}).join('')}
    ${mortar(HPAD,6)}<ellipse cx="0" cy="0" rx="${PRI+.5}" ry="${(PRI+.5)/2}" fill="#DCE2EA"/>${slabs(HPAD,false,6,'hsb')}
    <path d="M-44 -4 A44 22 0 0 0 44 -4 L44 1 A44 22 0 0 1 -44 1 Z" fill="#A8782E"/><ellipse cx="0" cy="-4" rx="44" ry="22" fill="url(#${k}-bronze)"/><ellipse cx="0" cy="-5" rx="40" ry="19.5" fill="#E7ECF2"/>
    <ellipse cx="0" cy="-12" rx="36" ry="14" fill="url(#${k}-sandH)"/><ellipse cx="0" cy="-14" rx="26" ry="8" fill="#FFF1C4" opacity=".55"/>`}
function hatchDome(k){return `<path d="M-40 -10 C -40 -66 40 -66 40 -10 A40 9 0 0 1 -40 -10 Z" fill="url(#${k}-glass)"/>
    <path d="M-40 -10 C -40 -66 40 -66 40 -10" stroke="#B88A34" stroke-width="2.8" fill="none"/><ellipse cx="0" cy="-10" rx="40" ry="9" fill="none" stroke="#C99A3E" stroke-width="3.4"/><ellipse cx="0" cy="-10.6" rx="40" ry="9" fill="none" stroke="#F2D27A" stroke-width="1" opacity=".8"/>
    <path d="M0 -1 L0 -52 M-28 -3.5 C -35 -28 -18 -50 0 -52 M28 -3.5 C 35 -28 18 -50 0 -52 M-39 -24 C -20 -18 20 -18 39 -24" stroke="#C99A3E" stroke-width="1.8" fill="none" opacity=".95"/>
    <path d="M-32 -18 C -32 -40 -20 -50 -7 -51" stroke="#fff" stroke-width="3.6" fill="none" opacity=".75" stroke-linecap="round"/><path d="M-24 -14 C -25 -26 -20 -34 -14 -38" stroke="#fff" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/><path d="M22 -42 C 27 -37 30 -30 31 -24" stroke="#fff" stroke-width="1.8" fill="none" opacity=".5" stroke-linecap="round"/>
    <path d="M-7 -52 L7 -52 L5 -58 L-5 -58 Z" fill="url(#${k}-bronze)"/><path d="M0 -67 L4.4 -61 L0 -56 L-4.4 -61 Z" fill="${CYAN[1]}"/><path d="M0 -67 L-4.4 -61 L0 -56 Z" fill="${CYAN[0]}"/>`}
/* ---------- Ферма: грядки-короба, изгородь, пугало, стог ---------- */
const CROP_DRAW={
  ember:(x,y,h,done)=>`<path d="M${x} ${y} C ${x-5} ${y-h*.6} ${x-4} ${y-h} ${x} ${y-h} C ${x+4} ${y-h} ${x+5} ${y-h*.6} ${x} ${y} Z" fill="#3F8A2E"/><path d="M${x} ${y} C ${x-3} ${y-h*.5} ${x-2} ${y-h*.85} ${x} ${y-h*.9}" stroke="#7FCB5A" stroke-width="1" fill="none"/>${done?[[-2.6,-.8],[2.4,-.5],[0,-.2]].map(([dx,dy])=>`<circle cx="${f1(x+dx)}" cy="${f1(y-h+dy*h*.3)}" r="2.4" fill="#F0552E"/><circle cx="${f1(x+dx-.7)}" cy="${f1(y-h+dy*h*.3-.8)}" r=".8" fill="#FFE0B0"/>`).join(''):''}`,
  pump:(x,y,h,done)=>`<path d="M${x-6} ${y} q 6 -${f1(h*.5)} 12 0" stroke="#3F8A2E" stroke-width="1.6" fill="none"/><ellipse cx="${x-4}" cy="${f1(y-h*.4)}" rx="3.4" ry="2" fill="#4FA53A"/><ellipse cx="${x+4}" cy="${f1(y-h*.5)}" rx="3" ry="1.8" fill="#5DB03A"/>${done?`<ellipse cx="${x}" cy="${y-3}" rx="6" ry="4.4" fill="#F2994A"/><path d="M${x-2.6} ${y-6.6} Q ${x-3.6} ${y-3} ${x-2.6} ${y+.8} M${x+2.6} ${y-6.6} Q ${x+3.6} ${y-3} ${x+2.6} ${y+.8}" stroke="#C86A1E" stroke-width="1" fill="none"/><ellipse cx="${x-2}" cy="${y-5}" rx="1.8" ry="1" fill="#FFD3A0" opacity=".8"/><path d="M${x} ${y-7.2} l1 -2.4" stroke="#5E4026" stroke-width="1.4" stroke-linecap="round"/>`:''}`,
  vine:(x,y,h,done)=>`<path d="M${x} ${y} L${x} ${y-h-4}" stroke="#A47A4C" stroke-width="1.4"/><path d="M${x} ${y-2} q 4 -${f1(h*.3)} 0 -${f1(h*.55)} q -4 -${f1(h*.25)} 0 -${f1(h*.5)}" stroke="#6E4FC9" stroke-width="1.8" fill="none"/>${done?[[0,-h],[2.8,-h*.6],[-2.6,-h*.35]].map(([dx,dy])=>`<path d="M${f1(x+dx)} ${f1(y+dy-3)} l1 2.2 l2.4 .3 l-1.8 1.6 l.5 2.4 l-2.1 -1.2 l-2.1 1.2 l.5 -2.4 l-1.8 -1.6 l2.4 -.3 Z" fill="#FFD84A" stroke="#C99A1E" stroke-width=".5"/>`).join(''):''}`,
  melon:(x,y,h,done)=>`<path d="M${x-6} ${y} q 6 -${f1(h*.45)} 12 0" stroke="#3F8A2E" stroke-width="1.6" fill="none"/><ellipse cx="${x+3}" cy="${f1(y-h*.45)}" rx="3.2" ry="1.9" fill="#4FA53A"/>${done?`<ellipse cx="${x}" cy="${y-3.4}" rx="6.6" ry="4.8" fill="#E9D23C"/><path d="M${x-4} ${y-6} Q ${x} ${y-3} ${x-3} ${y+.6} M${x+1} ${y-8} Q ${x+4} ${y-4} ${x+2} ${y+1}" stroke="#9AA82A" stroke-width="1.1" fill="none"/><ellipse cx="${x-2.4}" cy="${y-5.6}" rx="2" ry="1" fill="#FFF8C0" opacity=".8"/>`:''}`,
  moon:(x,y,h,done)=>`<path d="M${x} ${y} C ${x-5} ${y-h*.6} ${x-4} ${y-h} ${x} ${y-h} C ${x+4} ${y-h} ${x+5} ${y-h*.6} ${x} ${y} Z" fill="#6FA7B8"/><path d="M${x} ${y} L${x} ${y-h*.9}" stroke="#D8F4FF" stroke-width=".9" opacity=".7"/>${done?`<ellipse cx="${x}" cy="${y-1.6}" rx="4.4" ry="2.6" fill="#E6F2FF" stroke="#9FB8D6" stroke-width=".7"/><ellipse cx="${x-1}" cy="${y-2.4}" rx="1.6" ry=".8" fill="#fff"/>`:''}`};
function farmSprite(b,st,K,D,k){
  const q=[[0,-15],[30,0],[0,15],[-30,0]],out=[];
  out.push(`<ellipse cx="0" cy="6" rx="66" ry="30" fill="#0B1A10" opacity=".16"/><path d="M-62 0 Q -42 -24 0 -31 Q 42 -24 62 0 Q 42 24 0 31 Q -42 24 -62 0 Z" fill="#79C555"/><path d="M-62 0 Q -42 24 0 31 Q 42 24 62 0" stroke="#4E9A35" stroke-width="2.4" fill="none"/>`);
  /* дальняя изгородь до грядок, ближняя после */
  const post=(x,y)=>`<path d="M${f1(x-1.6)} ${f1(y+2)} L${f1(x-1.6)} ${f1(y-9)} L${f1(x)} ${f1(y-10.6)} L${f1(x+1.6)} ${f1(y-9)} L${f1(x+1.6)} ${f1(y+2)} Z" fill="#9C6A3A"/><path d="M${f1(x-1.6)} ${f1(y+2)} L${f1(x-1.6)} ${f1(y-9)} L${f1(x)} ${f1(y-10.6)} L${f1(x)} ${f1(y+2)} Z" fill="#C9935A"/>`;
  const fence=(a,b,n)=>{let s=`<path d="M${pp([a[0],a[1]-6])} L${pp([b[0],b[1]-6])} M${pp([a[0],a[1]-2.6])} L${pp([b[0],b[1]-2.6])}" stroke="#B5833F" stroke-width="2" fill="none"/><path d="M${pp([a[0],a[1]-6.8])} L${pp([b[0],b[1]-6.8])}" stroke="#E1B479" stroke-width=".8" fill="none"/>`;
    for(let i=0;i<=n;i++){const t=i/n;s+=post(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)}return s};
  out.push(fence([-58,-2],[0,-29],5)+fence([0,-29],[58,-2],5));
  q.forEach(([cx,cy],i)=>{
    const has=i<(b.plots||[]).length,p=has?b.plots[i]:null,w=26,hh=13,lift=4;
    if(!has){out.push(`<path d="M${cx} ${cy-hh} L${cx+w} ${cy} L${cx} ${cy+hh} L${cx-w} ${cy} Z" fill="#8FD16A" opacity=".75"/>${tuft(cx-6,cy+2,'#3A8A2A')}${tuft(cx+8,cy-1,'#3A8A2A')}<circle cx="${cx+2}" cy="${cy+4}" r="1.6" fill="#fff"/>`);return}
    const T=[cx,cy-hh-lift],R=[cx+w,cy-lift],B=[cx,cy+hh-lift],L=[cx-w,cy-lift],dn=q=>[q[0],q[1]+lift];
    out.push(path([L,B,dn(B),dn(L)],'#B07A45')+path([B,R,dn(R),dn(B)],'#7E5428')+path([T,R,B,L],`url(#${k}-soil)`)+`<path d="M${pp(L)} L${pp(T)} L${pp(R)}" stroke="#E1B479" stroke-width="1.4" fill="none"/>`);
    out.push(`<path d="${[.25,.5,.75].map(t=>`M${pp([L[0]+(T[0]-L[0])*t,L[1]+(T[1]-L[1])*t])} L${pp([B[0]+(R[0]-B[0])*t,B[1]+(R[1]-B[1])*t])}`).join(' ')}" stroke="#4A3018" stroke-width="2.4" fill="none" opacity=".55"/><path d="${[.25,.5,.75].map(t=>`M${pp([L[0]+(T[0]-L[0])*t,L[1]+(T[1]-L[1])*t-1.2])} L${pp([B[0]+(R[0]-B[0])*t,B[1]+(R[1]-B[1])*t-1.2])}`).join(' ')}" stroke="#A97B4E" stroke-width="1" fill="none" opacity=".7"/>`);
    if(p){const done=D.ready(p,K),kk=done?1:Math.min(1,(K-p.at+(p.skip||0)*D.SKIP_CARDS)/Math.max(1,p.need)),h=4+kk*10,dr=CROP_DRAW[p.crop]||CROP_DRAW.ember;
      [[-10,-2],[4,4],[-3,-8],[12,-2]].forEach(([dx,dy])=>out.push(dr(cx+dx,cy+dy-lift+2,h,done)))}
  });
  out.push(fence([-58,-2],[0,25],5)+fence([0,25],[58,-2],5));
  /* пугало слева, стог справа */
  out.push(`<g transform="translate(-44 -12)"><path d="M0 0 L0 -26 M-10 -17 L10 -17" stroke="#8A5A2C" stroke-width="2.4" stroke-linecap="round"/><circle cx="0" cy="-29" r="5" fill="#F2D59B" stroke="#8A5A2C" stroke-width=".8"/><path d="M-8 -32 L8 -32 L4 -37 L-4 -37 Z" fill="#C0392B"/><path d="M-6 -17 L6 -17 L5 -6 L-5 -6 Z" fill="#5E9BD1"/><path d="M-6 -17 L-1 -17 L-1 -6 L-5 -6 Z" fill="#7FB4E4"/><circle cx="-1.8" cy="-29.5" r=".8" fill="#5E4026"/><circle cx="1.8" cy="-29.5" r=".8" fill="#5E4026"/></g>`);
  out.push(`<g transform="translate(46 -8)">${shadow(11,3.6,2,.2)}<path d="M-11 2 Q -12 -10 0 -14 Q 12 -10 11 2 Q 0 5 -11 2 Z" fill="#E9C46A"/><path d="M-11 2 Q -12 -10 0 -14 Q -2 -6 -3 3 Z" fill="#F6DA8C"/><path d="M-8 -4 q 4 -2 8 0 M-6 -9 q 3 -1.6 6 0" stroke="#C9A04A" stroke-width="1" fill="none"/></g>`);
  return out.join('')}

/* яйцо: крапинки цвета стихии будущего птенца, у неразвившегося серое */
function eggSVG(x,y,eg,r){const G=root.DRG,W=root.DRAW;r=r||1;
  let c1='#FFF6DE',c2='#C9A86A';
  if(eg.viable){const ph=G.phenotype(eg.genome),k=ph.breath==='element'?ph.elements:[];c2=k.length?W.EL_COL[k[0]]:'#8C8F96';if(k[1])c1=W.EL_COL[k[1]]+'55'}else{c1='#D8D4CC';c2='#9A958C'}
  return `<g transform="translate(${x} ${y}) scale(${r})"><ellipse cx="0" cy="11" rx="8" ry="2.4" fill="#000" opacity=".18"/><ellipse cx="0" cy="0" rx="9" ry="12" fill="${c1}" stroke="#8A7650" stroke-width="1.4"/><circle cx="-3" cy="-4" r="2" fill="${c2}"/><circle cx="3" cy="2" r="2.4" fill="${c2}"/><circle cx="-2" cy="6" r="1.5" fill="${c2}"/><ellipse cx="-3" cy="-6" rx="2" ry="3" fill="#fff" opacity=".55"/></g>`}
/* дракон на острове: рисунок лежит в группе своей постройки (по глубине), а зона нажатия — в отдельном
   слое поверх всех построек (HITS), иначе прозрачные ромбы соседних построек перехватывали бы нажатие.
   Живой слой (live.js) прячет этот рисунок, рисует дракона на холсте и двигает зону нажатия вместе с ним:
   data-ix/iy — где стоят лапы в единицах острова, data-home — дом, data-mode — гуляет у среды (hab) или сидит в гнезде (nest),
   data-face — куда смотрит. Прозрачный овал — сама зона нажатия, рисунок нажатия пропускает. */
const escA=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
let HITS=[];
const dragonAt=(d,x,y,size,key,c,b,mode,face)=>{const W=root.DRAW,G=root.DRG,ix=c[0]+x,iy=c[1]+y;
  HITS.push(`<g class="drg-dr" data-act="drginsp" data-dragon="${escA(d.id)}" data-ix="${f1(ix)}" data-iy="${f1(iy)}" data-sz="${size}" data-home="${escA(b.id)}" data-mode="${mode}" data-face="${face||1}"><title>${escA(d.name)}: осмотреть</title><ellipse cx="${f1(ix)}" cy="${f1(iy-size*0.38)}" rx="${f1(size*0.44)}" ry="${f1(size*0.4)}" fill="rgba(255,255,255,.001)"/></g>`);
  return `<g class="drg-art" data-art="${escA(d.id)}">${W.svg(G.phenotype(d.genome),{key,size,label:'',stage:W.stageOf(d.lvl)}).replace('<svg class="dragon"',`<svg class="dragon drg-on" x="${f1(x-size/2)}" y="${f1(y-size*0.8)}"`)}</g>`};
function nestSprite(b,st,k,c,K,D){const out=[nestBase(k)];
  /* яйцо в гнезде видно только когда оно отложено (пара досидела), пустое гнездо пустое */
  if(b.pair&&D&&D.ready(b.pair,K)){fx('g',0,-16,18,'#FFE27A',.6);fx('s',0,-18,12,'#FFF5C2');out.push(eggSVG(0,-16,{viable:false},.95).replace('#D8D4CC','#F5EBD6').replace(/#9A958C/g,'#C9A86A'))}
  if(b.pair){[b.pair.m,b.pair.f].forEach((id,i)=>{const d=st.dragons.find(x=>x.id===id);if(!d)return;out.push(dragonAt(d,i?20:-20,-10,58,'n'+b.id+id,c,b,'nest',i?-1:1))})}
  out.push(nestFront());
  return out.join('')}
function hatchSprite(b,K,D,k){const out=[hatchBase(k)];let ready=0;
  (b.slots||[]).forEach((eg,i)=>{const x=[-18,18,-6,8][i],y=[-14,-14,-24,-24][i];
    out.push(`<ellipse cx="${x}" cy="${y+10}" rx="10" ry="4" fill="#B8925A"/><ellipse cx="${x}" cy="${y+9}" rx="10" ry="3.6" fill="none" stroke="#E3C07A" stroke-width="2"/>`);if(eg){out.push(eggSVG(x,y,eg,.9));if(D&&D.ready(eg,K))ready++}});
  if(ready)fx('s',0,-22,24,'#FFF5C2');
  out.push(hatchDome(k));
  return out.join('')}

/* строительные леса и полоска остатка */
function scaffold(job,K,D){const k=Math.max(0,Math.min(1,(K-job.at+(job.skip||0)*D.SKIP_CARDS)/job.need));
  const pole=(x,y0,y1)=>`<path d="M${x} ${y0} L${x} ${y1}" stroke="#8A5A2C" stroke-width="3.4" stroke-linecap="round"/><path d="M${x-1} ${y0} L${x-1} ${y1}" stroke="#C9935A" stroke-width="1.2"/>`;
  return `<g class="drg-scaf"><ellipse cx="0" cy="6" rx="54" ry="18" fill="#0B1A10" opacity=".14"/>${pole(-40,6,-52)}${pole(40,6,-52)}${pole(-14,12,-40)}${pole(14,12,-40)}
    <path d="M-42 -50 L42 -50 M-42 -22 L42 -22" stroke="#B5833F" stroke-width="4" stroke-linecap="round"/><path d="M-42 -51.4 L42 -51.4 M-42 -23.4 L42 -23.4" stroke="#E1B479" stroke-width="1.2"/>
    <path d="M-40 -50 L40 -22 M40 -50 L-40 -22" stroke="#9C6A3A" stroke-width="2" opacity=".85"/>
    ${stone(-20,4,.7,STONE,2)}${stone(-6,8,.5,STONE,0)}
    <g transform="translate(16 2)"><path d="M-8 2 L-8 -9 L0 -13 L8 -9 L8 2 L0 6 Z" fill="#B8925A"/><path d="M-8 -9 L0 -13 L8 -9 L0 -5 Z" fill="#D6B27A"/><path d="M0 -5 L8 -9 L8 2 L0 6 Z" fill="#94703F"/><path d="M-8 -3 L0 1 L8 -3" stroke="#7A5A30" stroke-width="1" fill="none"/></g>
    <path d="M30 -50 Q 32 -36 30 -24" stroke="#D9C49A" stroke-width="1.2" fill="none"/>
    <rect x="-34" y="-74" width="68" height="9" rx="4.5" fill="rgba(0,0,0,.45)"/><rect x="-32" y="-72" width="${(64*k).toFixed(1)}" height="5" rx="2.5" fill="#7CD67A"/></g>`}

function bubble(x,y,kind,txt,full){const bg=kind==='gold'?(full?'#F2C94C':'#FFF4C9'):kind==='food'?'#E6F7D9':kind==='egg'?'#FFF0E0':'#FFFFFF';
  /* ширина по тексту: значок слева, текст после него не наезжает (4.1) */
  const w=Math.max(54,32+String(txt).length*7.4);
  const ic=kind==='gold'?'🪙':kind==='food'?'🌾':kind==='egg'?'🥚':kind==='baby'?'🐣':kind==='empty'?'🏚':'🔨';
  if(full){const o=ORG;ORG={x:0,y:0,s:1};fx('o',x,y-2.5,w,'#FFE27A');ORG=o}
  return `<g class="drg-bub${full?' full':''}" transform="translate(${f1(x)} ${f1(y)})"><ellipse cx="0" cy="18" rx="${f1(w*.32)}" ry="3" fill="#000" opacity=".12"/><path d="M-6 9 L0 16 L6 9 Z" fill="${bg}" stroke="rgba(0,0,0,.25)"/><rect x="${f1(-w/2)}" y="-15" width="${f1(w)}" height="25" rx="12.5" fill="${bg}" stroke="rgba(0,0,0,.25)"/><rect x="${f1(-w/2+4)}" y="-13" width="${f1(w-8)}" height="8" rx="4" fill="#fff" opacity=".45"/><text x="${f1(-w/2+7)}" y="3" font-size="13">${ic}</text><text x="${f1(-w/2+25)}" y="3.5" font-size="12" font-weight="700" fill="#3A2A10">${txt}</text></g>`}

/* ---------- край острова: неровная кромка, дёрн, слоистые скалы снизу ----------
   Геометрия зависит от стороны n (12, 16, 20, 24) */
const GEO={};
function geo(n){if(GEO[n])return GEO[n];const C0=P(n/2,n/2),cor=[P(0,0),P(n,0),P(n,n),P(0,n)],RIM=[],k=Math.round(14*n/12);
  for(let e=0;e<4;e++){const a=cor[e],b=cor[(e+1)%4];for(let i=0;i<k;i++){const t=i/k,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
    const dx=x-C0[0],dy=(y-C0[1])*2,l=Math.hypot(dx,dy)||1,off=10+hrand('rim'+e+':'+i)*14;RIM.push([x+dx/l*off,y+dy/l*off*0.5,e])}}
  return GEO[n]={n,C0,RIM,half:32*n+16,cor}}
function smooth(pts){const m=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];let d=`M${pt(m(pts[pts.length-1],pts[0]))}`;
  for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];d+=` Q${pt(p)} ${pt(m(p,q))}`}return d+' Z'}
/* скалы: дёрн и земля под кромкой, крупные каменные блоки (левая сторона на свету, правая в тени) с трещинами и уступами,
   остриё из больших граней, дымка к низу, кристаллы в толще скалы, свисающие корни и лианы, парящие обломки под островом */
const CL_L=['#E4CFA6','#D9C297','#E9D7B3','#DDC69C'],CL_D=['#A88F68','#9C845E','#B09670','#957C57'],CL_LL=['#6E565C','#624C52','#77606A'],CL_LD=['#3E2E33','#36282C','#46353A'];
function cliffs(k,g,lava){const RIM=g.RIM,C0=g.C0;
  const front=RIM.filter(p=>p[2]===1||p[2]===2),R=P(g.n,0),L=P(0,g.n);front.unshift([R[0]+18,R[1],1]);front.push([L[0]-18,L[1],2]);
  const depth=p=>70+130*(1-Math.abs(p[0]-C0[0])/g.half)+hrand('cd'+p[0].toFixed(0))*34;
  const SOIL=16,lip=p=>[p[0],p[1]+SOIL];
  const bot=front.map(p=>[p[0]-(p[0]-C0[0])*0.05,p[1]+depth(p)]);
  const tip=front.map(p=>[C0[0]+(p[0]-C0[0])*0.5,p[1]+depth(p)*1.7+36]);   /* не ниже 434 единиц под передним углом: кончик в рамке «весь остров» */
  const out=[],pal=(lt,v)=>{const a=lava?(lt?CL_LL:CL_LD):(lt?CL_L:CL_D);return a[Math.floor(v*a.length)%a.length]};
  /* парящие обломки под островом (за скалой): плоская шапка с травой, рваный каменный низ */
  const dl=g.half;[[-.58,1.22,1],[.62,1.1,.8],[-.28,1.52,.6],[.34,1.58,.5]].forEach(([fx0,fy,s],i)=>{const x=C0[0]+fx0*dl,y=C0[1]+fy*dl*.62,lt=fx0<0,r=q=>hrand('db'+i+q);
    const body=`<path d="M-34 0 L-26 10 L-30 18 L-16 24 L-12 38 L-2 30 L4 46 L12 28 L22 22 L20 12 L32 4 L34 0 Q 0 8 -34 0 Z" fill="${pal(false,r('a'))}"/><path d="M-34 0 L-26 10 L-30 18 L-16 24 L-12 38 L-6 20 L-10 6 Q -24 4 -34 0 Z" fill="${pal(true,r('b'))}"/><path d="M-16 24 L-12 38 L-2 30 L4 46" stroke="${lava?'#140E10':'#6E5E48'}" stroke-width="1.2" fill="none" opacity=".5"/>`;
    const cap=lava?`<path d="M-34 0 Q -18 -8 0 -9 Q 18 -8 34 0 Q 0 7 -34 0 Z" fill="#4A3D42"/><path d="M-20 -2 Q -2 -6 16 -1" stroke="#FF7A1F" stroke-width="2" fill="none" opacity=".8"/>`
      :`<path d="M-34 0 Q -18 -8 0 -9 Q 18 -8 34 0 Q 0 7 -34 0 Z" fill="#62BD43"/><path d="M-34 0 Q 0 7 34 0 L33 3 Q 0 10 -33 3 Z" fill="#3F9A2E"/><path d="M-26 -3 Q -10 -8 6 -7" stroke="#B4EC7A" stroke-width="1.6" fill="none" opacity=".7" stroke-linecap="round"/>${i%2?crystal(10,-3,16,3.6,AMETH,2)+crystal(4,-1,9,2.6,AMETH,-2):`<path d="M-14 -4 L-8 -22 L-2 -4 Z" fill="${PINE[0][0]}"/><path d="M-14 -4 L-8 -22 L-8 -3 Z" fill="${PINE[0][1]}"/><circle cx="8" cy="-8" r="5" fill="#47992F"/>`}`;
    out.push(G(x,y,s*g.n/12,body+cap));if(i%2&&!lava)withOrg(x,y,s*g.n/12,()=>fx('g',8,-12,12,'#B98CFF',.4))});
  /* остриё: крупные грани */
  out.push(`<path d="M${bot.map(pp).join(' L')} L${tip.slice().reverse().map(pp).join(' L')} Z" fill="url(#${k}-cliff2)"/>`);
  for(let i=0;i<front.length-1;){const w=2+Math.floor(hrand('tw'+i)*2),j=Math.min(front.length-1,i+w),lt=bot[i][0]<C0[0],v=hrand('tv'+i),m=Math.floor((i+j)/2);
    const t=[tip[m][0]*.65+bot[m][0]*.35,tip[m][1]*.65+bot[m][1]*.35];
    out.push(path([bot[i],bot[j],t],pal(lt,v),`opacity="${lt?.55:.5}"`));
    out.push(`<path d="M${pp(bot[i])} L${pp(t)}" stroke="${lava?'#1A1215':'#7E6E54'}" stroke-width="1.2" opacity=".4"/>`);i=j}
  /* каменные блоки */
  for(let i=0;i<front.length-1;){const w=2+Math.floor(hrand('bw'+i)*2),j=Math.min(front.length-1,i+w),v=hrand('bv'+i),lt=(front[i][0]+front[j][0])/2<C0[0];
    const top=front.slice(i,j+1).map(lip),bl=[bot[j][0],bot[j][1]-8-v*18],br=[(bot[i][0]+bot[j][0])/2,Math.max(bot[i][1],bot[j][1])+6+v*14],b0=[bot[i][0],bot[i][1]-4-hrand('bx'+i)*14];
    out.push(path(top.concat([bl,br,b0]),pal(lt,v)));
    /* верхняя кромка блока светлая, нижняя часть темнее, уступы и трещины */
    out.push(`<path d="M${top.map(q=>pp([q[0],q[1]+1.5])).join(' L')}" stroke="${lava?'#8A6A70':'#FFFBF2'}" stroke-width="2" fill="none" opacity="${lt?.7:.35}"/>`);
    out.push(path([b0,[bot[i][0],bot[i][1]-30],[bl[0],bl[1]-26],bl,br],lava?'#140E10':'#5E5040',`opacity="${lt?.1:.16}"`));
    const y1=.25+v*.3,y2=.55+hrand('by'+i)*.2,at=(q,f)=>[q[0],q[1]+(bot[i][1]-q[1])*f];
    [y1,y2].forEach((f,n)=>{if(n&&v<.4)return;const a=at(top[0],f),c=at(top[top.length-1],f*.96),mid=[(a[0]+c[0])/2,(a[1]+c[1])/2+3+v*4];
      out.push(`<path d="M${pp([a[0]+2,a[1]])} L${pp(mid)} L${pp([c[0]-2,c[1]])}" stroke="${lava?'#140E10':'#7A6A50'}" stroke-width="1.4" fill="none" opacity=".5"/><path d="M${pp([a[0]+2,a[1]+1.6])} L${pp([mid[0],mid[1]+1.6])} L${pp([c[0]-2,c[1]+1.6])}" stroke="${lava?'#8A6A70':'#FFF8EA'}" stroke-width="1" fill="none" opacity="${lt?.45:.2}"/>`)});
    if(v>.55){const q=top[Math.floor(top.length/2)];out.push(`<path d="M${pp([q[0],q[1]+6])} l${f1(v*6-3)} ${f1(18+v*20)} l${f1(2-v*4)} ${f1(10+v*10)}" stroke="${lava?'#140E10':'#7A6A50'}" stroke-width="1.2" fill="none" opacity=".45"/>`)}
    if(lava&&v>.6){const q=top[0];out.push(`<path d="M${pp([q[0]+4,q[1]+10])} l${f1((v-.8)*20)} ${f1(20+v*20)} l3 ${f1(14+v*8)}" stroke="#FF7A1F" stroke-width="2.4" fill="none" opacity=".8"/>`);withOrg(q[0]+4,q[1]+30,1,()=>fx('g',0,0,12,'#FF7A1F',.35))}
    i=j}
  /* дымка к низу скал */
  out.push(`<path d="M${front.map(p=>pp(lip(p))).join(' L')} L${tip.slice().reverse().map(pp).join(' L')} Z" fill="url(#${k}-hazeV)"/>`);
  /* слой земли под дёрном и дёрн */
  out.push(`<path d="M${front.map(pp).join(' L')} L${front.slice().reverse().map(p=>pp([p[0],p[1]+SOIL+4+hrand('so'+p[0].toFixed(0))*5])).join(' L')} Z" fill="url(#${k}-soilB)"/>`);
  out.push(`<path d="M${front.map(pp).join(' L')} L${front.slice().reverse().map((p,i)=>pp([p[0],p[1]+7+((i%2)?3.5:0)])).join(' L')} Z" fill="${lava?'#2B2124':'#3F9A2E'}"/>`);
  out.push(`<path d="M${front.map(p=>pp([p[0],p[1]+2])).join(' L')}" stroke="${lava?'#4A3A3E':'#6CC447'}" stroke-width="2.4" fill="none" opacity=".8"/>`);
  /* корни, лианы и кристаллы в скале */
  front.forEach((p,i)=>{if(i===0||i===front.length-1)return;const r=hrand('vn'+i),q=lip(p),d=depth(p),lt=p[0]<C0[0];
    if(!lava&&r<.22){const len=24+r*90;out.push(`<path d="M${pp([q[0],q[1]-6])} q ${f1(4-r*8)} ${f1(len*.4)} ${f1(-2+r*4)} ${f1(len*.7)} t ${f1(3-r*6)} ${f1(len*.3)}" stroke="#3E8A2A" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>${[.3,.55,.8].map(t=>`<ellipse cx="${f1(q[0]+(2-r*4)*t)}" cy="${f1(q[1]-6+len*t)}" rx="2.6" ry="1.4" fill="#5DB03A" transform="rotate(${lt?-30:30} ${f1(q[0]+(2-r*4)*t)} ${f1(q[1]-6+len*t)})"/>`).join('')}`)}
    else if(r>.86){const y=q[1]+16+(r-.86)*4*d,pl=lava?EMBC:(i%2?AMETH:CYAN);out.push(crystal(q[0]-4,y,14,3.4,pl,lt?-6:6)+crystal(q[0]+4,y+3,9,2.6,pl,lt?-4:4));
      withOrg(q[0],y,1,()=>fx('g',0,-6,14,lava?'#FF8A2B':pl[1],.4))}
    else if(!lava&&r>.78)out.push(`<path d="M${pp([q[0]-3,q[1]-2])} q -2 9 1 16 M${pp([q[0]+3,q[1]-2])} q 2 7 -1 12" stroke="#7A5A3A" stroke-width="1.4" fill="none" opacity=".8"/>`)});
  return out.join('')}
/* украшения по краю: дальний край (лес, скалы, кристаллы, рунные камни), ближний (низкие камни, цветы) */
function rimDecor(back,g,lava,k){const out=[],RIM=g.RIM,C0=g.C0;
  RIM.forEach((p,i)=>{const isBack=p[2]===0||p[2]===3;if(isBack!==back)return;
    const r=hrand('rd'+i),dx=p[0]-C0[0],dy=p[1]-C0[1],l=Math.hypot(dx,dy*2)||1,x=p[0]+dx/l*3,y=p[1]+dy/l*1.5;
    if(lava){if(back){if(r<.3)out.push(charTree(x,y,.9+r,i));else if(r<.5)out.push(stone(x,y,.8+r*.6,BAS,i));else if(r<.6)out.push(cluster(x,y,.7,EMBC,'lc'+i,'#FF8A2B'));
        else if(r<.72)out.push(vent(x-dx/l*10,y-dy/l*5,i));else out.push(stone(x,y,.6+r*.4,BAS,i+1))}
      else if(i%2===0)out.push(stone(x,y,.45+r*.35,BAS,i));
      return}
    if(back){
      if(r<.34)out.push(pine(x,y,.85+r*.7,i)+(r<.14?pine(x+14,y+4,.7,i+1):''));
      else if(r<.46)out.push(stone(x,y,.8+r*.5,STONE,i)+stone(x+12,y+3,.45,STONE,i+1));
      else if(r<.54)out.push(cluster(x,y,.62,i%2?AMETH:CYAN,'rc'+i,i%2?'#B98CFF':'#7FE6F7'));
      else if(r<.7)out.push(oak(x,y,.75+r*.4,k,i));
      else if(r<.82)out.push(bush(x,y,.8,k,true)+tuft(x+12,y+2));
      else out.push(stone(x,y,.5+r*.4,MOSS,i)+tuft(x-10,y+1))}
    else{if(i%2)return;
      if(r<.4)out.push(stone(x,y,.4+r*.4,STONE,i));else if(r<.6)out.push(`<g>${flowers(x,y-2,'fr'+i)}</g>`);else if(r<.75)out.push(bush(x,y,.55,k,true));else out.push(tuft(x,y))}});
  return out.join('')}
/* ориентиры по углам: древний кристалл в глубине, рунные камни слева и справа */
function landmarks(g,lava,k){const c=g.cor,o=[],n=g.n;
  const top=[c[0][0],c[0][1]-8],lft=[c[3][0]-6,c[3][1]-2],rgt=[c[1][0]+6,c[1][1]-2];
  if(lava){o.push(cluster(top[0],top[1],1.5,EMBC,'lkt','#FF8A2B'));o.push(G(lft[0],lft[1],1.2,crystal(0,0,44,8,OBSC,-6)+crystal(10,2,26,5,OBSC,4)));o.push(G(rgt[0],rgt[1],1.2,crystal(0,0,40,7,OBSC,6)+crystal(-10,2,22,5,OBSC,-4)));return o.join('')}
  o.push(stone(top[0]-22,top[1]+4,1.1,STONE,2)+stone(top[0]+24,top[1]+6,.9,STONE,0));
  o.push(cluster(top[0],top[1],1.7+n/48,AMETH,'lkt','#C59BFF'));
  o.push(pine(lft[0]-18,lft[1]+4,1.1,1)+menhir(lft[0],lft[1],1.15,'#7FE6F7',0)+menhir(lft[0]+16,lft[1]+6,.8,'#7FE6F7',1));
  o.push(pine(rgt[0]+18,rgt[1]+4,1.15,2)+menhir(rgt[0],rgt[1],1.15,'#C59BFF',2)+cluster(rgt[0]-16,rgt[1]+6,.6,CYAN,'lkr','#7FE6F7'));
  return o.join('')}

/* тропинки: плоские камни-ступени через промежуток между соседними постройками (соседи по ячейкам, шаг 4 клетки) */
function trails(st,lava){const at=new Set(st.bld.map(b=>b.x+':'+b.y)),out=[];
  const step=(i,j,seed)=>{const c=P(i,j),r=hrand(seed),x=c[0]+(r-.5)*6,y=c[1]+(hrand(seed+'y')-.5)*3,w=5.5+r*2;
    return `<ellipse cx="${f1(x)}" cy="${f1(y+1.2)}" rx="${f1(w+1.4)}" ry="${f1(w*.5+.8)}" fill="${lava?'#1C1416':'#4E8A30'}" opacity=".35"/><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(w)}" ry="${f1(w*.5)}" fill="${lava?BAS[1]:'#C2C9D3'}"/><ellipse cx="${f1(x-1)}" cy="${f1(y-.8)}" rx="${f1(w*.7)}" ry="${f1(w*.3)}" fill="${lava?BAS[0]:'#E8ECF1'}"/>`};
  st.bld.forEach(b=>{
    if(at.has((b.x+4)+':'+b.y))for(let t=0;t<4;t++)out.push(step(b.x+2.2+t*.53,b.y+1,'tx'+b.id+t));
    if(at.has(b.x+':'+(b.y+4)))for(let t=0;t<4;t++)out.push(step(b.x+1,b.y+2.2+t*.53,'ty'+b.id+t))});
  return out.join('')}
/* короткое состояние постройки: для aria-label и всплывающей подсказки */
function bldState(b,st,K,D){const T=D.TYPES[b.type];
  if(b.build)return D.ready(b.build,K)?'стройка готова':'строится, ещё '+D.left(b.build,K)+' к.';
  const o=[];if(b.up&&!D.ready(b.up,K))o.push('улучшается');
  if(T.kind==='hab'){const n=st.dragons.filter(d=>d.home===b.id).length,a=Math.floor(D.chestNow(st,b,K));o.push(n?'драконов '+n:'пустует');if(a>=1)o.push('в сундуке '+a+' золота')}
  if(T.kind==='farm'){const r=(b.plots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)o.push('созрело '+r)}
  if(T.kind==='nest'&&b.pair)o.push(D.ready(b.pair,K)?'яйцо готово':'пара сидит');
  if(T.kind==='hatch'){const r=(b.slots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)o.push('готово к вылуплению '+r)}
  return o.join(', ')}

/* ---------- градиенты ---------- */
function defs(k,lava){const ss=(o,v)=>`<stop offset="${o}" style="stop-color:var(${v})"/>`,s=(o,c,a)=>`<stop offset="${o}" stop-color="${c}"${a!=null?` stop-opacity="${a}"`:''}/>`;
  const lin=(id,st,x2,y2)=>`<linearGradient id="${k}-${id}" x1="0" y1="0" x2="${x2==null?0:x2}" y2="${y2==null?1:y2}">${st}</linearGradient>`,rad=(id,st,cx,cy,r)=>`<radialGradient id="${k}-${id}" cx="${cx||.5}" cy="${cy||.5}" r="${r||.6}">${st}</radialGradient>`;
  const pads=Object.keys(PAD).map(t=>{const p=PAD[t];return rad('fl'+t,t==='W'?s(0,p.fl2)+s(.75,'#2FB2D6')+s(1,p.fl):s(0,p.fl)+s(1,p.fl2),.45,.42,.65)+lin('base'+t,s(0,p.base)+s(1,p.baseD))}).join('');
  return `<defs>
    ${lin('sky',ss(0,'--isl-sky1')+ss(1,'--isl-sky2'))}
    ${lava?rad('grass',s(0,'#7A6763')+s(.6,'#5A4A4C')+s(1,'#3A2E31'),.42,.36,.72):rad('grass',ss(0,'--isl-g1')+ss(.55,'--isl-g2')+ss(1,'--isl-g3'),.42,.36,.72)}
    ${lin('sun',s(0,'#FFFFFF',lava?.05:.2)+s(.5,'#FFFFFF',0),1,1)}
    ${lin('cliff',lava?s(0,'#6B5056')+s(.55,'#4A363B')+ss(1,'--isl-haze'):s(0,'#E9DDC4')+s(.5,'#C9B793')+ss(1,'--isl-haze'))}
    ${lin('cliff2',lava?s(0,'#3B2A2E')+s(.6,'#24191C')+ss(1,'--isl-haze'):s(0,'#A88E66')+s(.55,'#7E6A4C')+ss(1,'--isl-haze'))}
    <linearGradient id="${k}-hazeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--isl-haze)" stop-opacity="0"/><stop offset=".5" style="stop-color:var(--isl-haze)" stop-opacity="0"/><stop offset="1" style="stop-color:var(--isl-haze)" stop-opacity=".75"/></linearGradient>
    ${lin('soilB',lava?s(0,'#2E2225')+s(1,'#1E1517'):s(0,'#8C6440')+s(1,'#5E4229'))}
    ${rad('soil',s(0,'#8A5E38')+s(1,'#5E3F22'),.4,.4,.7)}
    ${rad('leaf',s(0,'#B4EC7A')+s(.6,'#5DB03A')+s(1,'#3F8A2C'),.35,.3,.8)}
    ${lin('lava',s(0,'#FFE27A')+s(1,'#FF5A1F'))}${lin('lavaV',s(0,'#FFE27A')+s(.5,'#FF8A2B')+s(1,'#E8401C'))}
    ${lin('basalt',s(0,'#6A6474')+s(.5,'#4B4553')+s(1,'#26222C'),1,0)}
    ${rad('cave',s(0,'#B3A6C0')+s(1,'#5E5370'),.35,.3,.8)}
    ${rad('glow',s(0,'#FFE7A0',.95)+s(.5,'#E5A3FF',.6)+s(1,'#9C6BFF',0),.5,.85,.75)}
    ${lin('marble',s(0,'#FFFFFF')+s(.6,'#E8EEF4')+s(1,'#BFCCDA'),1,0)}${lin('spire',s(0,'#9AD0FF')+s(1,'#3F7FD1'),1,0)}
    ${lin('gold',s(0,'#FFEFAA')+s(.55,'#F2C94C')+s(1,'#C99A2E'),1,1)}
    ${lin('obs',s(0,'#6A5A8C')+s(.45,'#3A2E52')+s(1,'#17121F'),1,0)}
    ${lin('trunk',s(0,'#A06A3E')+s(1,'#5A3820'),1,0)}
    ${lin('fall',s(0,'#FFFFFF',.95)+s(.6,'#BFF4FF',.9)+s(1,'#7FE6F7',.85))}
    ${rad('straw',s(0,'#EED598')+s(1,'#B08A4E'),.5,.3,.8)}
    ${rad('portal',s(0,'#FFFFFF',.9)+s(.35,'#FFC2E2',.75)+s(1,'#FF8CC6',0),.5,.75,.6)}
    ${rad('glass',s(0,'#F4FCFF',.6)+s(.55,'#BFE8F8',.34)+s(.85,'#7CC6E6',.45)+s(1,'#5FB2DA',.65),.36,.3,.78)}
    ${rad('sandH',s(0,'#FFE9B0')+s(.7,'#F0C27A')+s(1,'#D9A35A'),.5,.45,.6)}
    ${lin('baseW',s(0,STONE[1])+s(1,STONE[2]))}${lin('bronze',s(0,'#F6DC8E')+s(.5,'#D6A64A')+s(1,'#9C6E24'),1,1)}
    ${pads}
    <pattern id="${k}-gtex" width="44" height="22" patternUnits="userSpaceOnUse">${lava?'<circle cx="8" cy="6" r="1.2" fill="#1C1416" opacity=".35"/><circle cx="30" cy="15" r="1" fill="#FF8A2B" opacity=".25"/><circle cx="20" cy="19" r=".9" fill="#1C1416" opacity=".3"/>':'<path d="M6 14 q1 -4 2 -5 M9 14 q0 -5 1 -6 M30 6 q1 -3 2 -4 M33 6 q0 -4 1 -5 M20 21 q1 -3 2 -4" stroke="#2F7A20" stroke-width="1.1" fill="none" opacity=".32" stroke-linecap="round"/><circle cx="16" cy="9" r=".9" fill="#F0FFC8" opacity=".55"/><circle cx="38" cy="17" r=".8" fill="#F0FFC8" opacity=".5"/><circle cx="26" cy="3" r=".7" fill="#2F7A20" opacity=".3"/>'}</pattern>
  </defs>`}

/* ---------- фон для острова на весь экран: солнце, звёзды, далёкие летающие острова, море облаков ----------
   Рисуется один раз в отдельном слое за островом (ui.js двигает его медленнее камеры), в самом острове не участвует */
function farIsle(x,y,s,c1,c2,seed,cr){const r=k=>hrand(seed+k);
  const trees=[-40,-26,-12,8,22,38].map((tx,i)=>r('t'+i)>.4?(i%2?`<circle cx="${tx}" cy="-14" r="${f1(5+r('r'+i)*3)}" style="fill:var(${c2})"/>`:`<path d="M${tx-6} -8 L${tx} ${f1(-26-r('h'+i)*8)} L${tx+6} -8 Z" style="fill:var(${c2})"/>`):'').join('');
  return G(x,y,s,`<path d="M-62 0 L-50 14 L-40 18 L-30 34 L-18 40 L-10 62 L-2 74 L6 58 L16 44 L28 34 L40 20 L52 12 L62 0 Q 30 10 0 11 Q -30 10 -62 0 Z" style="fill:var(${c2})"/><path d="M-62 0 L-50 14 L-40 18 L-30 34 L-18 40 L-10 62 L-2 74 L-4 30 L-12 16 Q -40 8 -62 0 Z" style="fill:var(--isl-far3)" opacity=".7"/>
  ${trees}<path d="M-62 0 Q -40 -11 0 -13 Q 40 -11 62 0 Q 30 10 0 11 Q -30 10 -62 0 Z" style="fill:var(${c1})"/>${cr?`<path d="M18 -10 l5 -22 l5 22 Z" style="fill:var(--isl-farc)"/><path d="M26 -9 l3 -12 l3 12 Z" style="fill:var(--isl-farc)" opacity=".8"/>`:''}`)}
function bg(st,opt){opt=opt||{};const D=root.DECO,n=st&&st.land&&D?D.extent(st).n:12,vb=viewFor(n).full,lava=st&&st.isl===1||opt.theme==='lava';
  const W=vb[2],H=vb[3],x0=vb[0],y0=vb[1],o=[`<svg class="drg-bgsvg" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="overflow:visible">`];
  o.push(`<defs><radialGradient id="bg-sun" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--isl-sun)" stop-opacity=".95"/><stop offset=".35" style="stop-color:var(--isl-sun)" stop-opacity=".35"/><stop offset="1" style="stop-color:var(--isl-sun)" stop-opacity="0"/></radialGradient></defs>`);
  const sx=x0+W*.16,sy=y0+H*.1;
  o.push(`<circle cx="${f1(sx)}" cy="${f1(sy)}" r="${f1(W*.3)}" fill="url(#bg-sun)"/><circle cx="${f1(sx)}" cy="${f1(sy)}" r="${f1(W*.028)}" style="fill:var(--isl-sun)" opacity=".85"/>`);
  o.push(`<g style="fill:var(--isl-star)">${Array.from({length:70},(_,i)=>{const a=hrand('st'+i),b=hrand('su'+i);return `<circle cx="${f1(x0-W*.5+a*W*2)}" cy="${f1(y0-H*.3+b*H*.9)}" r="${f1(.8+hrand('sr'+i)*1.8)}"/>`}).join('')}</g>`);
  /* далёкие острова: чем дальше, тем бледнее и меньше */
  [[-.1,.3,.75,1],[1.08,.24,.62,1],[.02,.66,.5,0],[.98,.68,.55,1],[-.42,.52,.95,0],[1.42,.46,.9,1],[.78,.04,.34,0]].forEach(([fx0,fy,s,cr],i)=>o.push(farIsle(x0+W*fx0,y0+H*fy,s*W/1320,i%2?'--isl-far1':'--isl-far2','--isl-far3','fi'+i,cr)));
  if(lava)o.push([[-.15,.3,.9],[1.1,.24,.7],[.98,.62,.55]].map(([a,b,s])=>G(x0+W*a,y0+H*b,s*W/1320,`<path d="M-46 0 Q -40 -12 0 -15 Q 40 -12 46 0 Q 30 14 0 16 Q -30 14 -46 0 Z" fill="#4A3D42"/><path d="M-44 2 Q -20 60 0 78 Q 20 60 44 2 Q 22 16 0 18 Q -22 16 -44 2 Z" fill="#2E2529"/><path d="M-30 -4 Q 0 -12 26 -3" stroke="#FF7A1F" stroke-width="3" fill="none" opacity=".8"/>`)).join(''));
  /* море облаков внизу и облака по бокам */
  /* три ряда облаков, ниже — сплошная пелена: на высоком экране (планшет стоя) под островом нет плоской полосы */
  const sea=[];[[.86,1.5],[1.02,1.9],[1.18,2.3]].forEach(([row,sz],k)=>{for(let i=0;i<16;i++){const a=hrand('cs'+k+':'+i);sea.push(cloud(x0-W*.6+i*W*.15+(k%2)*W*.07,y0+H*(row+a*.1),sz+a*1.4,1))}});
  o.push(`<g>${sea.join('')}</g><rect x="${f1(x0-W)}" y="${f1(y0+H*1.24)}" width="${f1(W*3)}" height="${f1(H*1.5)}" style="fill:var(--isl-cloud)"/>`);
  o.push(`</svg>`);
  return o.join('')}
/* облака, которые медленно плывут (отдельный слой, двигается целиком) */
function bgClouds(st){const D=root.DECO,n=st&&st.land&&D?D.extent(st).n:12,vb=viewFor(n).full,W=vb[2],H=vb[3],x0=vb[0],y0=vb[1];
  const bank=[[-.3,.72,1.6],[-.08,.6,1.2],[.24,.78,1.5],[.66,.62,1.3],[.92,.75,1.6],[1.18,.58,1.2],[-.2,.24,.9],[1.12,.2,.8],[.78,.03,.7],[.12,.05,.6],[1.35,.36,1.1],[-.45,.4,1]];
  return `<svg class="drg-bgsvg" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="overflow:visible">${bank.map(([a,b,s],i)=>cloud(x0+W*a,y0+H*b,s*W/1320,i>5?.85:1)).join('')}</svg>`}

/* ---------- всё вместе ---------- */
function svg(st,opt){
  const D=root.DECO,K=opt.K,sel=opt.sel,place=opt.place,k=opt.key||'i',ro=!!opt.readonly;
  const n=opt.bare?12:D.extent(st).n,g=geo(n),vb=viewFor(n)[opt.full?"full":"norm"],lava=st.isl===1||opt.theme==='lava';
  HITS=[];FX=[];ORG={x:0,y:0,s:1};
  const out=[null];
  out.push(defs(k,lava));
  if(!opt.bare){
    if(!opt.full){out.push(`<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="url(#${k}-sky)"/>`);
      /* в рамке на странице облака неподвижны и лежат в самом рисунке; на весь экран — в отдельном слое (bg) */
      const bank=[[-180,640,1.6],[60,610,1.3],[300,660,1.8],[560,620,1.4],[820,650,1.7],[1000,600,1.2],[-120,300,.9],[930,260,.8],[700,40,.7],[60,60,.6]];
      out.push(bank.map(([x,y,s],i)=>cloud(x,y,s,i>5?.85:1)).join(''))}
    out.push(cliffs(k,g,lava));
    /* верх острова: трава с мягким светом слева сверху */
    out.push(`<path d="${smooth(g.RIM)}" fill="url(#${k}-grass)"/><path d="${smooth(g.RIM)}" fill="url(#${k}-gtex)"/><path d="${smooth(g.RIM)}" fill="url(#${k}-sun)"/>`);
    out.push(`<path d="${smooth(g.RIM)}" fill="none" stroke="${lava?'#1E1416':'#3F8F2A'}" stroke-width="2" opacity=".6"/>`);
    if(lava)out.push(`<path d="${smooth(g.RIM)}" fill="none" stroke="#FF7A1F" stroke-width="1.4" opacity=".35"/>`);
    out.push(landmarks(g,lava,k));
    out.push(rimDecor(true,g,lava,k));
    /* пятна света и тени, кустики, цветы, камешки на открытой земле (под постройками не рисуются) */
    const occ=new Set();st.bld.forEach(b=>{for(let i=0;i<2;i++)for(let j=0;j<2;j++)occ.add((b.x+i)+':'+(b.y+j))});
    const det=[];
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){const r=hrand('g'+i+':'+j),c=P(i+.5,j+.5);
      if(r<(lava?0.1:0.2)){det.push(`<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${f1(20+r*44)}" ry="${f1(9+r*18)}" fill="${lava?(r<0.05?'#000':'#9A8A86'):(r<0.1?'#2A7019':'#E2FFA6')}" opacity="${lava?.09:r<0.1?.14:.2}"/>`);continue}
      if(occ.has(i+':'+j))continue;
      if(lava){if(r>0.9)det.push(crack(c[0],c[1],'ck'+i+':'+j));else if(r>0.86){det.push(stone(c[0],c[1],.35,BAS,i+j));if(r>0.88)withOrg(c[0],c[1],1,()=>fx('e',0,-2,9,'#FFB347'))}continue}
      if(r>0.9)det.push(tuft(c[0]+(r-.9)*80,c[1]));else if(r>0.85)det.push(flowers(c[0],c[1],'f'+i+j));else if(r>0.83)det.push(pebbles(c[0],c[1],'pb'+i+j));else if(r>0.825)det.push(shroom(c[0],c[1],hrand('gm'+i+j)>.5,'sm'+i+j))}
    out.push(det.join(''));
    out.push(trails(st,lava));
  }
  /* ячейки для установки: размером со здание 2×2, только свободные; нажатие ставит здание в эту ячейку */
  if(place){
    const cells=D.freeSlots(st,place.move||null).map(p=>{const c=P(p.x+1,p.y+1),cur=place.cur&&place.cur.x===p.x&&place.cur.y===p.y;
      return `<g class="drg-slot${cur?' cur':''}" data-act="drgtile" data-x="${p.x}" data-y="${p.y}" tabindex="0" role="button" aria-label="Свободная ячейка"><polygon class="drg-cell ok" points="${dia(p.x,p.y,2,2)}"/><path d="M${f1(c[0]-9)} ${f1(c[1])} h18 M${f1(c[0])} ${f1(c[1]-9)} v18" stroke="#fff" stroke-width="3.4" stroke-linecap="round" pointer-events="none"/></g>`});
    out.push(`<g class="drg-cells">${cells.join('')}</g>`)}
  /* постройки и препятствия по глубине */
  const obs=opt.bare?[]:D.obstacles(st).map(o=>({o,d:o.x+o.y+1,x:o.x}));
  const list=st.bld.map(b=>({b,d:b.x+b.y+2,x:b.x})).concat(obs).sort((a,b)=>a.d-b.d||a.x-b.x),bubs=[],labs=[];
  list.forEach(it=>{
    if(it.o){const o=it.o,c=P(o.x+.5,o.y+.5);
      out.push(`<g class="drg-ob" ${ro||place?'':`data-act="drgobs" data-c="${o.id}" tabindex="0" role="button" aria-label="${D.OBST_KIND[o.kind].name}: расчистить за ${D.OBST_KIND[o.kind].gold} золота"`}><title>${D.OBST_KIND[o.kind].name}: расчистить за ${D.OBST_KIND[o.kind].gold} золота</title>${o.kind==='tree'?oak(c[0],c[1]+6,1.15,k,o.x):o.kind==='bush'?bush(c[0],c[1]+5,1.2,k,true):stone(c[0],c[1]+6,1.3,STONE,o.x)}</g>`);return}
    const b=it.b,c=P(b.x+1,b.y+1),T=D.TYPES[b.type],job=b.build||b.up,isSel=sel===b.id,moving=place&&place.move===b.id;
    const lab=bldState(b,st,K,D);
    out.push(`<g class="drg-b${isSel?' sel':''}${moving?' moving':''}" ${ro||place?'':`data-act="drgsel" data-id="${b.id}" tabindex="0" role="button" aria-label="${T.name}${lab?': '+lab:''}"${isSel?' aria-pressed="true"':''}`} transform="translate(${f1(c[0])} ${f1(c[1])})"><title>${T.name}${lab?': '+lab:''}</title>`);
    if(opt.full&&!opt.bare)labs.push(`<g class="drg-lab" transform="translate(${f1(c[0])} ${f1(c[1]+40)})" ${ro||place?'pointer-events="none"':`data-act="drgsel" data-id="${b.id}" role="button" tabindex="0" aria-label="Открыть: ${T.name}"`}><g class="drg-labi"><rect x="${-T.name.length*3.6-8}" y="-10" width="${T.name.length*7.2+16}" height="19" rx="9.5" fill="rgba(20,40,60,.72)"/><text y="4" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">${T.name}</text></g></g>`);
    out.push(`<path d="M-64 0 L0 -32 L64 0 L0 32 Z" fill="rgba(255,255,255,.001)"/>`);
    const hab=T.kind==='hab'&&!!PAD[b.type];
    /* эффекты считаются только у стоящих построек и не у той, что переносится */
    const fxOn=!b.build&&!moving&&!opt.bare,fx0=FX.length;
    ORG={x:c[0],y:c[1],s:1};
    if(isSel)out.push(`<ellipse cx="0" cy="2" rx="74" ry="37" fill="#FFF3B0" opacity=".22"/><path d="M0 -36 L72 0 L0 36 L-72 0 Z" fill="none" stroke="#FFF3B0" stroke-width="3.4" stroke-dasharray="7 5"/>`);
    if(b.build){out.push(scaffold(b.build,K,D))}
    else{
      out.push(T.kind==='farm'?farmSprite(b,st,K,D,k):T.kind==='nest'?nestSprite(b,st,k,c,K,D):T.kind==='hatch'?hatchSprite(b,K,D,k):hab?habPad(b.type,k,b.lvl||1)+habMark(b.type,k):habPad('P',k));
      if(T.kind==='hab'){
        /* драконы во дворе, перед знаком среды; живой слой потом водит их по двору */
        const ds=st.dragons.filter(d=>d.home===b.id),pos=[[-22,12],[22,14],[0,21],[-24,6],[24,6]];
        out.push(`<clipPath id="${k+b.id}-yard"><ellipse cx="0" cy="-8" rx="61" ry="40"/></clipPath><g clip-path="url(#${k+b.id}-yard)">`);
        ds.forEach((d,n)=>{const [dx,dy]=pos[n%5];out.push(dragonAt(d,dx,dy,hab?34:66,k+b.id+d.id,c,b,'hab',dx>0?-1:1))})
        out.push('</g>');
        if(hab)out.push(habFront(b.type,b.lvl||1))}
      if(b.up)out.push(scaffold(b.up,K,D))}
    if(!fxOn)FX.length=fx0;
    ORG={x:0,y:0,s:1};
    out.push(`</g>`);
    /* пузырь над зданием: в отдельном слое поверх всего */
    if(!ro&&!place){const start=bubs.length,x=c[0],y=c[1]-(b.build?84:HEIGHT[b.type]||70)-16;
      if(job&&!D.ready(job,K))bubs.push(bubble(x,y,'build',D.timeShort(job,K)));
      else if(T.kind==='hab'){const a=Math.floor(D.chestNow(st,b,K));if(a>=1)bubs.push(bubble(x,y,'gold',a>=1000?Math.floor(a/100)/10+'к':a,a>=D.chestCap(b)));
        else if(!st.dragons.some(d=>d.home===b.id))bubs.push(bubble(x,y,'empty','пусто'))}
      else if(T.kind==='farm'){const r=(b.plots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)bubs.push(bubble(x,y,'food','×'+r))}
      else if(T.kind==='nest'&&b.pair){bubs.push(D.ready(b.pair,K)?bubble(x,y,'egg','готово',true):bubble(x,y,'egg',D.timeShort(b.pair,K)))}
      else if(T.kind==='hatch'){const r=(b.slots||[]).filter(p=>p&&D.ready(p,K)).length;if(r)bubs.push(bubble(x,y,'baby','×'+r,true))}
      if(bubs.length>start){const collect=T.kind==='hab'&&!b.build&&D.chestNow(st,b,K)>=1,action=collect?'drgdo':'drgsel';
        bubs[bubs.length-1]=bubs[bubs.length-1].replace('<g class=',`<g data-act="${action}" data-id="${b.id}" ${collect?'data-t="collect"':''} role="button" tabindex="0" aria-label="${escA(collect?'Собрать золото: '+T.name:'Открыть: '+T.name)}" class=`)}
    }
  });
  if(!opt.bare)out.push(rimDecor(false,g,lava,k));
  out.push(`<g class="drg-drs">${HITS.join('')}</g>`);HITS=[];
  out.push(`<g class="drg-labs">${labs.join('')}</g>`);
  out.push(`<g class="drg-bubs">${bubs.join('')}</g>`);
  out.push(`</svg>`);
  const fxs=opt.bare?'':escA(JSON.stringify(FX));FX=[];
  out[0]=`<svg class="drg-isl${lava?' lava':''}" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${lava?'Огненный остров':'Остров драконов'}"${fxs?` data-fx="${fxs}"`:''}>`;
  return out.join('')}

const ISL={svg,bg,bgClouds,P,VIEW,viewFor,viewOf,eggSVG,HEIGHT,TW,TH,OX,OY,YARD,HAB_SC,HAB_DY,PAD};
if(typeof module!=='undefined'&&module.exports)module.exports=ISL;else root.ISL=ISL;
})(typeof window!=='undefined'?window:globalThis);
