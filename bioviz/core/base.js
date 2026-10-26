/* Основа БиоВиза: общие помощники BV.*, теневой корень BVHOST и тема оформления.
   Грузится первым после cloud.js. Всё остальное (движок конспектов, лаборатория, помощник, страницы)
   работает поверх этих функций. */
(function(){
const host=document.getElementById('bvhost');
const root=host.shadowRoot||host.attachShadow({mode:'open'});

/* ---------- помощники ---------- */
const $=(s,el=root)=>el.querySelector(s);
const $$=(s,el=root)=>[...el.querySelectorAll(s)];
const store={
  get(k,d){try{const v=localStorage.getItem('bv2:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem('bv2:'+k,JSON.stringify(v))}catch(e){}},
  del(k){try{localStorage.removeItem('bv2:'+k)}catch(e){}}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let reduced=false;try{reduced=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
const themeFns=[];

window.BV={$,$$,store,clamp,esc,reduced,themeFns,hooks:{},
  ease:t=>(t=clamp(t,0,1))*t*(3-2*t),
  lerp:(a,b,t)=>a+(b-a)*t,
  cssVar:n=>getComputedStyle(host).getPropertyValue(n).trim(),
  rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}};

/* настоящая цель события, даже если оно пришло из теневого DOM */
window.BV_ET=e=>(e&&e.composedPath&&e.composedPath()[0])||e.target;

window.BVHOST={host,root,
  top:()=>window.scrollTo({top:0}),
  /* «на всё окно» в новой оболочке не нужен: колонка конспекта и так без лишних панелей */
  full:()=>{}};

/* ---------- оформление: стиль (набор шрифтов, цветов и фактур) и режим (системный, светлый, тёмный) ----------
   Токены каждого стиля лежат в CSS оболочки (bioviz/core/app.js), здесь только список, шрифты и цвет фона.
   bg: фон страницы [светлый, тёмный], им же красится полоса браузера. */
const GF='https://fonts.googleapis.com/css2?display=swap&family=';
const STYLES=[
  {id:'journal',name:'Журнал',about:'Бумага в клетку, засечки, цвета нуклеотидов',bg:['#F3F1EA','#0F1215'],
   fonts:'Source+Serif+4:opsz,wght@8..60,600&family=JetBrains+Mono:wght@400;500;600;700'},
  {id:'gel',name:'Гель',about:'Агарозный гель: дорожки и светящиеся полосы',bg:['#E8ECEF','#070B14'],
   fonts:'IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600'},
  {id:'fluo',name:'Флуоресценция',about:'Конфокальный микроскоп: каналы GFP, DAPI, mCherry',bg:['#F7F7FB','#04050A'],
   fonts:'Unbounded:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600;700'},
  {id:'agar',name:'Агар',about:'Чашка Петри: тёплый агар, колонии, мягкие формы',bg:['#F4E7C9','#1A140C'],
   fonts:'Nunito:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700'},
  {id:'term',name:'Секвенатор',about:'Терминал и распечатка прочтений, всё моноширинное',bg:['#FBFBF4','#0A0F0A'],
   fonts:'JetBrains+Mono:wght@400;500;600;700;800'},
  {id:'blue',name:'Чертёж',about:'Карта плазмиды на синьке: сетка и узкий шрифт',bg:['#F7FAFF','#0D2B52'],
   fonts:'PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@400;700&family=PT+Mono'}];
const loaded=new Set();
function loadFonts(st){if(!st||loaded.has(st.id))return;loaded.add(st.id);
  const l=document.createElement('link');l.rel='stylesheet';l.href=GF+st.fonts;document.head.appendChild(l)}
const mq=matchMedia('(prefers-color-scheme: dark)');
const styleOf=()=>STYLES.find(x=>x.id===store.get('style','journal'))||STYLES[0];
function applyTheme(){
  const pref=store.get('theme','auto'),st=styleOf();
  const dark=pref==='dark'||(pref==='auto'&&mq.matches);
  loadFonts(st);
  host.dataset.theme=dark?'dark':'light';host.dataset.style=st.id;
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.background=st.bg[dark?1:0];
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=st.bg[dark?1:0];
  themeFns.forEach(f=>{try{f()}catch(e){}})}
try{mq.addEventListener('change',applyTheme)}catch(e){}
BV.theme={get:()=>store.get('theme','auto'),set:v=>{store.set('theme',v);applyTheme()},apply:applyTheme,
  styles:STYLES,style:()=>styleOf().id,setStyle:id=>{store.set('style',id);applyTheme()},
  /* для превью в меню выбора нужны шрифты всех стилей */
  loadAll:()=>STYLES.forEach(loadFonts)};
applyTheme();
})();
