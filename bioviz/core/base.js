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

/* ---------- тема: системная, светлая или тёмная ---------- */
const mq=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const pref=store.get('theme','auto');
  const dark=pref==='dark'||(pref==='auto'&&mq.matches);
  host.dataset.theme=dark?'dark':'light';
  document.documentElement.dataset.theme=dark?'dark':'light';
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=dark?'#101614':'#F5F6F2';
  themeFns.forEach(f=>{try{f()}catch(e){}})}
try{mq.addEventListener('change',applyTheme)}catch(e){}
BV.theme={get:()=>store.get('theme','auto'),set:v=>{store.set('theme',v);applyTheme()},apply:applyTheme};
applyTheme();
})();
