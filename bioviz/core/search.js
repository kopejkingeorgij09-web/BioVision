/* Поиск по платформе: Ctrl+K (⌘K на Mac) или лупа в шапке.
   Ищет по названиям лекций и разделов, по полному тексту конспектов, словарю и лабораторным работам.
   Результат в тексте показывается карточкой с контекстом: путь «лекция · раздел · подраздел»,
   найденное предложение вместе с предложением до и после, пометка о рисунке рядом.
   По нажатию открывается нужное место, найденное слово на пару секунд подсвечивается.
   Индекс собирается из уже отрисованных конспектов при первом открытии окна, сайт никуда запрос не отправляет. */
(function(){
const {$,$$,esc}=BV,R=BVHOST.root,C=window.BV_COURSE,APP=BV.app;

const STYLE=`
.sr-btn{width:auto;gap:8px;padding:0 8px 0 10px;display:inline-flex;align-items:center;border-color:var(--line);background:var(--card)}
.sr-btn .i{width:17px;height:17px}
.sr-btn span{font:500 13.5px/1 var(--font-body);color:var(--muted)}
.sr-btn kbd{font:600 11px/1 var(--font-mono);color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:4px 5px;background:var(--surface-2)}
@media (max-width:900px){.sr-btn{width:38px;padding:0;justify-content:center;border-color:transparent;background:none}.sr-btn span,.sr-btn kbd{display:none}}
.sr-scrim{position:fixed;inset:0;z-index:90;background:rgba(8,14,11,.38);backdrop-filter:blur(2px);animation:srFade .16s}
.sr{position:fixed;z-index:91;left:50%;top:10vh;transform:translateX(-50%);width:min(760px,calc(100vw - 32px));max-height:76vh;display:flex;flex-direction:column;
  background:var(--card);border:1px solid var(--line);border-radius:calc(var(--r,12px) + 2px);box-shadow:0 30px 80px -30px rgba(0,0,0,.55);overflow:hidden;animation:srIn .2s cubic-bezier(.3,.7,.2,1)}
@keyframes srIn{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translateX(-50%)}}
@keyframes srFade{from{opacity:0}to{opacity:1}}
.sr-in{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.sr-in .i{width:20px;height:20px;color:var(--cut);flex:none}
.sr-in input{all:unset;flex:1;min-width:0;font:400 18px/1.3 var(--font-body);color:var(--ink)}
.sr-in input::placeholder{color:var(--muted)}
.sr-in input::-webkit-search-cancel-button,.sr-in input::-webkit-search-decoration{-webkit-appearance:none;display:none}
.sr-in kbd,.sr-ft kbd{font:600 11px/1 var(--font-mono);color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:4px 6px;background:var(--surface-2)}
.sr-x{all:unset;cursor:pointer;display:none;width:34px;height:34px;place-items:center;border-radius:var(--rx,6px);color:var(--muted)}
.sr-x .i{width:18px;height:18px;color:inherit}
.sr-res{overflow:auto;overscroll-behavior:contain;padding:6px 8px 10px;flex:1}
.sr-g{font:600 11px/1.3 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:12px 10px 6px}
.sr-it{all:unset;box-sizing:border-box;display:block;width:100%;cursor:pointer;padding:10px 12px;border-radius:var(--rs,8px);color:var(--ink);border:1px solid transparent}
.sr-it.on{background:var(--surface-2);border-color:color-mix(in oklab,var(--cut) 35%,var(--line))}
.sr-it .p{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font:500 11.5px/1.35 var(--font-mono);letter-spacing:.02em;color:var(--muted)}
.sr-it .p i{font-style:normal;opacity:.5}
.sr-it .p .last{color:var(--cut)}
.sr-it .t{display:block;font:600 15px/1.35 var(--font-body)}
.sr-it .t small{font-weight:400;color:var(--muted);margin-left:6px;font-size:13px}
.sr-it .s{display:block;margin-top:6px;font-size:14px;line-height:1.55;color:var(--muted)}
.sr-it .s b{font-weight:400;color:var(--ink)}
.sr-it .s+.s{margin-top:6px;padding-top:6px;border-top:1px dashed var(--line)}
.sr-it mark{background:color-mix(in oklab,var(--cut) 22%,transparent);color:var(--ink);border-radius:3px;padding:0 2px;font-weight:600}
.sr-it .more{display:inline-block;margin-top:6px;font:500 11.5px/1.3 var(--font-mono);color:var(--muted)}
.sr-tag{display:inline-flex;align-items:center;gap:5px;font:600 11px/1 var(--font-mono);letter-spacing:.03em;color:var(--cut);border:1px solid color-mix(in oklab,var(--cut) 40%,var(--line));border-radius:999px;padding:3px 8px;margin-left:auto}
.sr-term{border-left:3px solid var(--cut);border-radius:0 var(--rs,8px) var(--rs,8px) 0}
.sr-term .d{display:block;margin-top:4px;font-size:14.5px;line-height:1.55;color:var(--ink)}
.sr-empty{padding:26px 14px;color:var(--muted);font-size:14.5px;line-height:1.55}
.sr-ft{display:flex;gap:16px;align-items:center;padding:9px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
.sr-ft span{display:inline-flex;gap:6px;align-items:center}
@media (max-width:700px){
  .sr{top:0;left:0;transform:none;width:100%;max-height:none;height:100dvh;border-radius:0;border:0;animation:srFade .16s}
  .sr-in{padding:10px 10px 10px 16px;padding-top:max(10px,env(safe-area-inset-top,0px))}
  .sr-in kbd,.sr-ft{display:none}.sr-x{display:grid}
  .sr-res{padding-bottom:calc(16px + env(safe-area-inset-bottom,0px))}
  .sr-it .p .mid,.sr-it .p i{display:none}.sr-it .p .last{flex-basis:100%}}
.sr-flash{animation:srFlash 2.4s ease-out}
@keyframes srFlash{0%,35%{background:color-mix(in oklab,var(--cut) 16%,transparent);box-shadow:0 0 0 6px color-mix(in oklab,var(--cut) 16%,transparent)}100%{background:transparent;box-shadow:0 0 0 6px transparent}}
::highlight(bv-search){background-color:color-mix(in oklab,var(--cut) 30%,transparent);color:inherit}
@media (prefers-reduced-motion:reduce){.sr,.sr-scrim{animation:none}.sr-flash{animation:none;outline:2px solid var(--cut);outline-offset:4px}}
`;
{const st=document.createElement('style');st.textContent=STYLE;R.appendChild(st)}

const ICO={search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',fig:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 15l3.5-4 3 3 2-2 2.5 3"/>'};
const ic=k=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;
const MAC=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);

/* ---------- кнопка в шапке ---------- */
const btn=document.createElement('button');btn.type='button';btn.className='icb sr-btn';
btn.setAttribute('aria-label',`Поиск (${MAC?'⌘K':'Ctrl+K'})`);btn.title=`Поиск по платформе, ${MAC?'⌘K':'Ctrl+K'}`;
btn.innerHTML=`${ic('search')}<span>Поиск</span><kbd>${MAC?'⌘K':'Ctrl K'}</kbd>`;
{const r=$('.bar-r');if(r)r.insertBefore(btn,r.firstChild)}
btn.addEventListener('click',()=>open());
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.code==='KeyK'||e.key==='k'||e.key==='л')){e.preventDefault();$('.sr')?close():open()}});

/* ---------- текст: нормализация, основы слов ---------- */
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е');   /* длина строки не меняется: позиции совпадают с исходным текстом */
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function stems(q){return norm(q).split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>=2||/\d/.test(w)).map(w=>{
  /* грубая основа для русских слов: «рибосома» найдёт «рибосомы», «рибосомами» */
  if(/[а-я]/.test(w)){if(w.length>=6)w=w.replace(/[аеиоуыэюяйь]{1,2}$/,'');else if(w.length>=4)w=w.replace(/[аеиоуыэюяйь]$/,'')}return w})}
const rxEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const rxOf=st=>new RegExp('(?<![\\p{L}\\p{N}])'+rxEsc(st)+'[\\p{L}\\p{N}]*','gu');
function spans(n,rxs){const out=[];for(const rx of rxs){rx.lastIndex=0;let m;while(m=rx.exec(n)){out.push([m.index,m.index+m[0].length]);if(!m[0].length)rx.lastIndex++}}
  return out.sort((a,b)=>a[0]-b[0]).reduce((a,s)=>{const l=a[a.length-1];if(l&&s[0]<=l[1])l[1]=Math.max(l[1],s[1]);else a.push(s.slice());return a},[])}
function marked(t,from,to,sp){let h='',p=from;for(const [a,b] of sp){if(b<=from||a>=to)continue;const A=Math.max(a,from),B=Math.min(b,to);h+=esc(t.slice(p,A))+'<mark>'+esc(t.slice(A,B))+'</mark>';p=B}return h+esc(t.slice(p,to))}
/* границы предложений внутри блока */
function sentences(t){const out=[];const re=/[.!?…]+[»")\]]*\s+(?=[«"(]?[А-ЯЁA-Z0-9])/g;let m,s=0;
  while(m=re.exec(t)){const e=m.index+m[0].length;const head=t.slice(s,m.index+1);
    /* сокращения и инициалы не режут предложение: «рис. 4», «с. 266», «А. С. Фаминцын», «4.2.» */
    const nx=t.charAt(e);
    if(/(?:^|[\s(])[А-ЯЁA-Z]\.$/.test(head)||/^\d+(?:\.\d+)*\.$/.test(head.trim())||(/\d/.test(nx)&&/(?:^|[\s(])[а-яa-z]{1,4}\.$/.test(head)))continue;
    out.push([s,e]);s=e}
  if(s<t.length)out.push([s,t.length]);return out}
const cut=(t,a,b,max,keep)=>{/* обрезать отрезок [a,b) до max знаков, оставив позицию keep видимой */
  if(b-a<=max)return[a,b,false,false];let s=Math.max(a,Math.min(keep-Math.round(max*.35),b-max));let e=Math.min(b,s+max);
  if(s>a){const sp=t.indexOf(' ',s);if(sp>0&&sp<keep)s=sp+1}if(e<b){const sp=t.lastIndexOf(' ',e);if(sp>keep)e=sp}return[s,e,s>a,e<b]};

/* ---------- индекс ---------- */
let IX=null,labsIX=null,labsLoading=null;
function ensureRendered(){const cur=APP.route;let touched=false;
  for(const L of APP.visibleLectures()){const d=$('#m-'+L.id+' .k-doc');if(d&&!$('.k-wrap',d)){if(BV.K.show(L.id)){touched=true;if(!(cur&&cur.kind==='lecture'&&cur.L===L))BV.K.hide(L.id)}}}
  if(touched&&cur&&cur.kind==='lecture')BV.K.show(cur.L.id)}
function buildLectures(){ensureRendered();
  const items=[],blocks=[],terms=[];
  for(const L of APP.visibleLectures()){const page=$('#m-'+L.id);const sheet=page&&$('.k-sheet',page);if(!sheet)continue;
    const lp=`Лекция ${L.n}`;
    items.push({kind:'lec',t:L.title,sub:lp,path:[lp],go:()=>APP.go('#/l/'+L.n)});
    $$('.k-sec',sheet).forEach(sec=>{
      const sid=sec.id.replace(/^k-/,''),h2=$('h2',sec),no=$('.k-no',h2),st=clean(h2?h2.textContent:''),sno=no?no.textContent.trim():'';
      const stt=no?clean(st.slice(sno.length)):st,secP=sno?`${sno}. ${stt}`:stt;
      items.push({kind:'sec',t:stt,sub:lp+(sno?' · раздел '+sno:''),path:[lp,secP],el:sec,lec:L,id:sid});
      let sub=null;
      const els=$$('h3,h4,p,li,td,figcaption,.k-box>b:first-child,.k-fold-h,.k-q>b:first-child',sec);
      for(const el of els){
        if(el.closest('.k-ctoc,.kf,.kd-pop'))continue;
        if(el.tagName==='LI'&&el.querySelector('li'))continue;
        if(el.tagName==='P'&&el.closest('li'))continue;
        if(el.tagName==='H3'){sub={id:el.id||null,t:clean(el.textContent)};if(el.id)items.push({kind:'sub',t:sub.t,sub:lp+' · '+secP,path:[lp,secP],el,lec:L,id:el.id})}
        const t=clean(el.textContent);if(t.length<2)continue;
        blocks.push({t,n:norm(t),el,lec:L,sid,secP,sub,head:/^H[34]$/.test(el.tagName)||el.matches('.k-box>b,.k-fold-h'),path:[lp,secP].concat(sub?[sub.t]:[])})}
      /* словарь: пары dt/dd */
      $$('dt',sec).forEach(dt=>{const dd=dt.nextElementSibling;if(!dd||dd.tagName!=='DD')return;terms.push({t:clean(dt.textContent),d:clean(dd.textContent),el:dt,lec:L,path:[lp,secP]})})});
    /* рисунки: подпись, номер и раздел, к которому рисунок относится */
    $$('.kf',page).forEach(f=>{const id=f.dataset.fig,ph=$(`.kf-ph[data-ph="${id}"]`,sheet),home=(ph&&ph.isConnected?ph:f).closest('.k-sec');if(!home)return;
      const cap=$('figcaption',f);if(!cap)return;const t=clean(cap.textContent),m=t.match(/^Рис\.\s*([\d.]+\d)/);
      const sid=home.id.replace(/^k-/,''),h2=$('h2',home),no=$('.k-no',h2),sno=no?no.textContent.trim():'',stt=clean((h2?h2.textContent:'').slice(sno.length));
      const secP=sno?`${sno}. ${stt}`:stt;
      /* подраздел: последний h3 перед местом рисунка */
      let sub=null;const anchor=ph&&ph.isConnected?ph:f;for(const h of $$('h3',home)){if(h.compareDocumentPosition(anchor)&Node.DOCUMENT_POSITION_FOLLOWING)sub={id:h.id||null,t:clean(h.textContent)};else break}
      blocks.push({t,n:norm(t),el:anchor,fig:id,figN:m?m[1]:'',lec:L,sid,secP,sub,head:false,path:[lp,secP].concat(sub?[sub.t]:[])})})}
  /* где какие рисунки: для пометки «рядом Рис. N» */
  const near=new Map();blocks.filter(b=>b.fig).forEach(b=>{const k=key(b);if(!near.has(k))near.set(k,[]);near.get(k).push(b.figN)});
  return {items,blocks,terms,near}}
const key=b=>(b.lec?b.lec.id:'lab:'+b.lab.id)+'|'+b.sid+'|'+(b.sub&&b.sub.t||'');

function loadLabs(){if(labsLoading||!BV.labworks)return labsLoading;   /* каждый раз заново: работы могли добавить */
  labsLoading=BV.labworks.load().then(list=>{const items=[],blocks=[];
    (list||[]).filter(w=>APP.isAdmin()||!w.data.draft).forEach(w=>{const d=w.data,no=d.n?String(d.n).padStart(2,'0'):'··',lp=`Лабораторная № ${no}`;
      items.push({kind:'lab',t:d.title||'Без названия',sub:lp,path:[lp],go:()=>APP.go('#/labs/'+w.id)});
      (BV.labworks.parts||[]).forEach(([k,pt])=>{String(d[k]||'').split(/\n+/).map(s=>clean(s.replace(/^\s*(?:[-*]|\d+[.)])\s+/,'').replace(/[|*_`#>]/g,' '))).filter(s=>s.length>1).forEach(t=>
        blocks.push({t,n:norm(t),lab:w,part:pt,sid:k,secP:d.title||'Без названия',sub:{t:pt},head:false,path:[lp,d.title||'Без названия',pt]}))})});
    labsIX={items,blocks};labsLoading=null;if($('.sr'))draw()}).catch(()=>{labsLoading=null;labsIX={items:[],blocks:[]}});
  return labsLoading}

/* ---------- поиск ---------- */
function search(q){
  const S=stems(q);if(!S.length)return null;const rxs=S.map(rxOf);
  const items=IX.items.concat(labsIX?labsIX.items:[]),blocks=IX.blocks.concat(labsIX?labsIX.blocks:[]);
  const has=n=>rxs.every(rx=>{rx.lastIndex=0;return rx.test(n)});
  const nav=items.filter(it=>has(norm(it.t))).slice(0,8);
  const terms=IX.terms.filter(t=>has(norm(t.t))).sort((a,b)=>a.t.length-b.t.length).slice(0,3);
  /* карточки: совпадения одного подраздела вместе */
  const cards=new Map();
  blocks.forEach((b,i)=>{if(!has(b.n))return;const sp=spans(b.n,rxs);const k=key(b);
    let c=cards.get(k);if(!c){c={k,first:b,hits:[],score:0,path:b.path};cards.set(k,c)}
    const sc=sp.length+(b.head?4:0)+(b.fig?1:0);c.hits.push({b,i,sp,sc});c.score+=sc});
  const list=[...cards.values()].sort((a,b)=>b.score-a.score||a.hits[0].i-b.hits[0].i).slice(0,30);
  list.forEach(c=>c.hits.sort((a,b)=>b.sc-a.sc||a.i-b.i));
  return {nav,terms,cards:list,rxs,blocks}}

function snippet(h,blocks,used){const b=h.b,t=b.t,ss=sentences(t),p=h.sp[0][0];
  const k=ss.findIndex(([a,e])=>p>=a&&p<e);const [a,e]=ss[k<0?0:k];
  const [s1,e1,l1,r1]=cut(t,a,e,240,p);
  let pre='',post='';
  if(!l1){if(k>0){const [x,y]=ss[k-1];const [s,e2,l]=cut(t,x,y,140,y);pre=(l?'… ':'')+esc(t.slice(s,e2).trim())}
    else{const pb=blocks[h.i-1];if(pb&&key(pb)===key(b)&&!b.head&&!pb.head&&!pb.fig&&!(used&&used.has(h.i-1))){const ps=sentences(pb.t),[x,y]=ps[ps.length-1];const [s,e2,l]=cut(pb.t,x,y,140,y);pre=(l?'… ':'')+esc(pb.t.slice(s,e2).trim())}}}
  if(!r1&&k>=0&&k<ss.length-1){const [x,y]=ss[k+1];const [s,e2,,r]=cut(t,x,y,140,x);post=esc(t.slice(s,e2).trim())+(r?' …':'')}
  const mid=(l1?'… ':'')+marked(t,s1,e1,h.sp).trim()+(r1?' …':'');
  return `<span class="s">${pre?pre+' ':''}<b>${mid}</b>${post?' '+post:''}</span>`}

/* ---------- окно ---------- */
let W=null,sel=0,acts=[],lastQ='';
function open(q){if($('.sr'))return;
  try{IX=buildLectures()}catch(e){console.error('search index',e);IX={items:[],blocks:[],terms:[],near:new Map()}}
  loadLabs();
  W=document.createElement('div');
  W.innerHTML=`<div class="sr-scrim"></div><div class="sr" role="dialog" aria-modal="true" aria-label="Поиск по платформе">
    <div class="sr-in">${ic('search')}<input type="search" placeholder="Поиск по конспектам, словарю и лабораторным" aria-label="Что найти" autocomplete="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="true" aria-controls="srRes"><kbd>Esc</kbd><button type="button" class="sr-x" aria-label="Закрыть поиск">${ic('x')}</button></div>
    <div class="sr-res" id="srRes" role="listbox" aria-label="Результаты"></div>
    <div class="sr-ft"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Esc</kbd> закрыть</span></div></div>`;
  R.appendChild(W);
  const inp=$('input',W);inp.value=q!=null?q:lastQ;
  let t=0;inp.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(draw,70)});
  inp.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();move(e.key==='ArrowDown'?1:-1)}
    else if(e.key==='Enter'){e.preventDefault();if(acts[sel])pickRes(sel)}
    else if(e.key==='Escape'){e.preventDefault();close(true)}});
  $('.sr-scrim',W).addEventListener('click',()=>close(true));$('.sr-x',W).addEventListener('click',()=>close(true));
  const res=$('.sr-res',W);
  res.addEventListener('click',e=>{const it=BV_ET(e).closest('.sr-it');if(it)pickRes(+it.dataset.i)});
  res.addEventListener('mousemove',e=>{const it=BV_ET(e).closest('.sr-it');if(it&&+it.dataset.i!==sel){sel=+it.dataset.i;mark(false)}});
  document.documentElement.style.overflow='hidden';
  draw();inp.focus();inp.select()}
function close(focus){if(!W)return;lastQ=$('input',W).value;W.remove();W=null;document.documentElement.style.overflow='';if(focus)btn.focus({preventScroll:true})}
function move(d){if(!acts.length)return;sel=(sel+d+acts.length)%acts.length;mark(true)}
function mark(scroll){$$('.sr-it',W).forEach(x=>{const on=+x.dataset.i===sel;x.classList.toggle('on',on);x.setAttribute('aria-selected',String(on));if(on&&scroll)x.scrollIntoView({block:'nearest'})})}
const pathH=(p,tag)=>`<span class="p">${p.map((x,i)=>{const c=i===p.length-1?'last':i>0?'mid':'';return `${i?`<i${c==='mid'||(i===p.length-1&&p.length>2)?' class="mi"':''}>·</i>`:''}<span${c?` class="${c}"`:''}>${esc(x)}</span>`}).join('')}${tag?`<span class="sr-tag">${ic('fig')}${esc(tag)}</span>`:''}</span>`;

function draw(){if(!W)return;const q=$('input',W).value,res=$('.sr-res',W);acts=[];sel=0;let h='';
  const add=(fn,html)=>{acts.push(fn);return `<button type="button" class="sr-it${html.cls||''}" role="option" data-i="${acts.length-1}">${html.h}</button>`};
  const r=search(q);
  if(!r){/* пустой запрос: что есть на платформе */
    h+=`<div class="sr-g">Конспекты</div>`;
    IX.items.filter(it=>it.kind!=='sub').forEach(it=>{h+=add(()=>goItem(it),{h:it.kind==='lec'?`<span class="t">${esc(it.t)}<small>${esc(it.sub)}</small></span>`:`${pathH([it.sub])}<span class="t">${esc(it.t)}</span>`})});
    if(labsIX&&labsIX.items.length){h+=`<div class="sr-g">Лабораторные работы</div>`;labsIX.items.forEach(it=>{h+=add(()=>goItem(it),{h:`<span class="t">${esc(it.t)}<small>${esc(it.sub)}</small></span>`})})}
    else if(labsLoading)h+=`<div class="sr-g">Лабораторные работы</div><div class="sr-empty">Загружаю…</div>`;
  }else{
    if(r.terms.length){h+=`<div class="sr-g">Словарь</div>`;r.terms.forEach(tm=>{const sp=spans(norm(tm.t),r.rxs);
      h+=add(()=>goEl(tm.el,tm.lec,r.rxs),{cls:' sr-term',h:`${pathH(tm.path)}<span class="t">${marked(tm.t,0,tm.t.length,sp)}</span><span class="d">${esc(tm.d)}</span>`})})}
    if(r.nav.length){h+=`<div class="sr-g">Лекции, разделы, работы</div>`;r.nav.forEach(it=>{const sp=spans(norm(it.t),r.rxs);
      h+=add(()=>goItem(it),{h:`${pathH([it.sub])}<span class="t">${marked(it.t,0,it.t.length,sp)}</span>`})})}
    if(r.cards.length){const total=r.cards.reduce((s,c)=>s+c.hits.length,0);
      h+=`<div class="sr-g">В тексте · ${total} ${plural(total,'совпадение','совпадения','совпадений')}</div>`;
      r.cards.forEach(c=>{const b=c.first,figs=b.lec?(IX.near.get(c.k)||[]):[];const top=c.hits.slice(0,2);
        const figTag=top.some(x=>x.b.fig)?`Рис. ${top.find(x=>x.b.fig).b.figN}`:figs.length?`рядом Рис. ${figs[0]}`:'';
        h+=add(()=>goHit(top[0].b,r.rxs),{h:pathH(c.path,figTag)+(()=>{const used=new Set(top.map(x=>x.i));return top.map(x=>snippet(x,r.blocks,used)).join('')})()+(c.hits.length>2?`<span class="more">ещё ${c.hits.length-2} в этом разделе</span>`:'')})})}
    if(!h)h=`<div class="sr-empty">Ничего не нашлось по запросу «${esc(q)}». Попробуй часть слова или другое написание, например латинское название.</div>`}
  res.innerHTML=h;res.scrollTop=0;mark(false)}
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c};
function pickRes(i){const fn=acts[i];close(false);if(fn)fn()}

/* ---------- переход к месту ---------- */
const barh=()=>parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60;
function openLecture(L){const r=APP.route;if(!(r&&r.kind==='lecture'&&r.L===L)){history.pushState(null,'','#/l/'+L.n);APP.refresh()}}
function scrollToEl(el){/* свёрнутый «Мостик» раскрыть */
  const fb=el.closest('.k-fold-b');if(fb&&fb.hidden){const b=fb.parentNode&&$('.k-fold-h',fb.parentNode);if(b)b.click()}
  let n=0;const f=()=>{const y=el.getBoundingClientRect().top-barh()-Math.min(160,innerHeight*.22);if(Math.abs(y)>4)window.scrollBy(0,y);if(++n<3)setTimeout(()=>requestAnimationFrame(f),120)};f()}
function flash(el,rxs){el.classList.remove('sr-flash');void el.offsetWidth;el.classList.add('sr-flash');setTimeout(()=>el.classList.remove('sr-flash'),2600);
  if(!rxs||!window.CSS||!CSS.highlights||typeof Highlight==='undefined')return;
  try{const ranges=[];const tw=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let nd;
    while(nd=tw.nextNode()){const n=norm(nd.data);for(const [a,b] of spans(n,rxs)){const rg=new Range();rg.setStart(nd,a);rg.setEnd(nd,b);ranges.push(rg)}}
    if(!ranges.length)return;CSS.highlights.set('bv-search',new Highlight(...ranges));clearTimeout(flash.t);flash.t=setTimeout(()=>CSS.highlights.delete('bv-search'),2800)}catch(e){}}
function goEl(el,L,rxs,quiet){openLecture(L);requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!el.isConnected)return;scrollToEl(el);if(!quiet)setTimeout(()=>flash(el,rxs),260)}))}
function goHit(b,rxs){
  if(b.lab){APP.go('#/labs/'+b.lab.id);setTimeout(()=>{const h=$$('.lw-part h2').find(x=>x.textContent.trim()===b.part);const box=h&&h.parentNode;if(!box)return;
      const el=$$('p,li,td',box).find(x=>norm(x.textContent).includes(b.n.slice(0,40)))||box;scrollToEl(el);setTimeout(()=>flash(el,rxs),260)},450);return}
  if(b.fig){openLecture(b.lec);requestAnimationFrame(()=>requestAnimationFrame(()=>{const ph=$(`.kf-ph[data-ph="${b.fig}"]`);const t=ph&&ph.isConnected?ph:$('#f-'+b.fig);if(!t)return;scrollToEl(t);
      setTimeout(()=>{const f=$('#f-'+b.fig);if(f)flash(f,rxs)},380)}));return}
  goEl(b.el,b.lec,rxs)}
function goItem(it){if(it.go)return it.go();goEl(it.el,it.lec,null,true)}

BV.search={open,close};
})();
