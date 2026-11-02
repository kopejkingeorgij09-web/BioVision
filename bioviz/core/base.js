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

/* ---------- короткий и безопасный разбор текста ----------
   Абзацы через пустую строку, списки «- » и «1. », таблицы из строк «| a | b |», **жирный**, *курсив*, `код`,
   ссылки [подпись](https://…) и голые https://… . Весь ввод сначала экранируется. */
BV.md=function(s){
  const lines=esc(s).replace(/\r/g,'').split('\n');let out='',list=null,para=[],tbl=null;
  const inl=t=>t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g,'$1<i>$2</i>').replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,'$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  const flush=()=>{if(para.length){out+=`<p>${inl(para.join('<br>'))}</p>`;para=[]}};
  const close=()=>{if(list){out+=`</${list}>`;list=null}};
  const endT=()=>{if(!tbl)return;const [h,...b]=tbl;tbl=null;
    out+=`<div class="md-tw"><table class="md-t"><thead><tr>${h.map(c=>`<th>${inl(c)}</th>`).join('')}</tr></thead><tbody>${b.map(r=>`<tr>${h.map((_,i)=>`<td>${inl(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`};
  for(const l of lines){let m;
    if(/^\s*\|.*\|\s*$/.test(l)){flush();close();if(/^\s*\|[\s:|-]+\|\s*$/.test(l)&&tbl)continue;
      (tbl=tbl||[]).push(l.trim().slice(1,-1).split('|').map(c=>c.trim()));continue}
    endT();
    if(/^\s*$/.test(l)){flush();close();continue}
    if((m=l.match(/^#{1,4}\s+(.*)/))){flush();close();out+=`<h4>${inl(m[1])}</h4>`;continue}
    if((m=l.match(/^\s*[-*•]\s+(.*)/))){flush();if(list!=='ul'){close();out+='<ul>';list='ul'}out+=`<li>${inl(m[1])}</li>`;continue}
    if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){flush();if(list!=='ol'){close();out+='<ol>';list='ol'}out+=`<li>${inl(m[1])}</li>`;continue}
    close();para.push(l)}
  endT();flush();close();return out};

/* ---------- буфер обмена и всплывающая подсказка ---------- */
BV.copy=async function(text){
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true}}catch(e){}
  /* запасной путь для старых браузеров и http: скрытое поле и команда copy */
  try{const t=document.createElement('textarea');t.value=text;t.setAttribute('readonly','');t.style.cssText='position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(t);t.select();t.setSelectionRange(0,text.length);const ok=document.execCommand('copy');t.remove();return ok}catch(e){return false}};
BV.toast=function(msg,ms){let t=root.querySelector('.bv-toast');
  if(!t){t=document.createElement('div');t.className='bv-toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');root.appendChild(t)}
  t.textContent=msg;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),ms||3200)};

/* настоящая цель события, даже если оно пришло из теневого DOM */
window.BV_ET=e=>(e&&e.composedPath&&e.composedPath()[0])||e.target;

window.BVHOST={host,root,
  top:()=>window.scrollTo({top:0}),
  /* «на всё окно» в новой оболочке не нужен: колонка конспекта и так без лишних панелей */
  full:()=>{}};

/* ---------- тема: системная, светлая или тёмная ----------
   BG — фон страницы [светлый, тёмный], им же красится полоса браузера; должен совпадать с --bg в app.js и с index.html. */
const BG=['#F2F3EE','#0D1410'];
const mq=matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const pref=store.get('theme','auto');
  const dark=pref==='dark'||(pref==='auto'&&mq.matches);
  host.dataset.theme=dark?'dark':'light';
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.documentElement.style.background=BG[dark?1:0];
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=BG[dark?1:0];
  themeFns.forEach(f=>{try{f()}catch(e){}})}
try{mq.addEventListener('change',applyTheme)}catch(e){}
BV.theme={get:()=>store.get('theme','auto'),set:v=>{store.set('theme',v);applyTheme()},apply:applyTheme};
applyTheme();
})();
