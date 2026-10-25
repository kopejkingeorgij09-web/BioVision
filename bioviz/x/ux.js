/* Навигация и удобство: панель быстрого доступа (Главная · Конспекты · Задания · Карточки · Поиск),
   нижняя панель и меню разделов на телефоне, прогресс в «Конспектах», пункт «Вузовские задачи», запоминание места в конспектах.
   Грузится последним из дополнений, до BV.start(). */
(function(){
const {$,$$,esc,store,hooks}=BV;
const R=BVHOST.root;
const ICON={
 home:'<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"/>',
 notes:'<path d="M12 6.5C10.3 5.2 7.9 4.5 4 4.5v13c3.9 0 6.3.7 8 2 1.7-1.3 4.1-2 8-2v-13c-3.9 0-6.3.7-8 2z"/><path d="M12 6.5v13"/>',
 quiz:'<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 9l1.6 1.6L13 7.7M8.5 15l1.6 1.6L13 13.7M15 9.5h1.5M15 15.5h1.5"/>',
 cards:'<rect x="3.5" y="7" width="13" height="13" rx="2.5"/><path d="M7.5 7V5.5A2 2 0 0 1 9.5 3.5H19a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-2.5"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
 menu:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
 cap:'<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c1.6 1.4 3.4 2 5.5 2s3.9-.6 5.5-2v-4.2M21.5 9.5V15"/>',
 book:'<path d="M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11.5M9 8.5h6"/>'};
const ic=(k,c='')=>`<svg class="ux-i ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
BV.UXI=ic;

const CSS=`
.ux-i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
/* ---- быстрый доступ ---- */
.side>.bvtabs{display:none}
.nav>.nav-item[data-go="home"],.nav>#sideSearch,.nav>.nav-item[data-go="cards"]{display:none}
.qnav{display:flex;flex-direction:column;gap:3px;padding:6px;border-radius:16px;background:var(--surface);border:1px solid var(--line);box-shadow:0 1px 2px rgba(10,40,30,.05)}
.qn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;font-weight:600;font-size:14.5px;color:var(--ink);position:relative;transition:background .15s,color .15s}
.qn:hover{background:var(--surface-2)}
.qn:focus-visible{outline:2px solid var(--focus,#2C7BE5);outline-offset:1px}
.qn[aria-current="page"]{background:color-mix(in srgb,var(--ui) 13%,var(--surface));color:var(--ui)}
.qn .qk{margin-left:auto;font:500 11.5px/1 var(--font-body);color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:3px 6px}
.qn .qb{margin-left:auto;font-style:normal;min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:inline-grid;place-items:center;font:700 12px/1 var(--font-body);background:var(--eosin);color:#fff}
.qn .qb.soft{background:var(--surface-2);color:var(--muted)}
.qn[data-q="menu"]{display:none}
.nav-item[data-act]{cursor:pointer}
@media (max-width:1180px){
 .qnav{flex-direction:row;flex-wrap:wrap;flex:1 1 auto;padding:4px;gap:4px;border-radius:14px}
 .qn{padding:7px 12px;gap:8px;font-size:14px}
 .qn .qk{display:none}
 .qn .qb{margin-left:2px}
}
/* ---- телефон: нижняя панель и меню разделов ---- */
@media (max-width:820px){
 .side>:not(.qnav){display:none}
 .side{padding:0!important;border:0!important;margin:0!important;background:transparent!important}
 .qnav{position:fixed;z-index:60;left:0;right:0;bottom:0;flex-wrap:nowrap;justify-content:space-around;gap:0;padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px));border-radius:18px 18px 0 0;border-width:1px 0 0;background:color-mix(in srgb,var(--surface) 94%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 -6px 20px -12px rgba(0,0,0,.3)}
 .qn{flex:1 1 0;flex-direction:column;gap:3px;padding:6px 2px;font-size:11px;font-weight:600;border-radius:12px;min-width:0;text-align:center}
 .qn span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
 .qn .ux-i{width:22px;height:22px}
 .qn .qb{position:absolute;top:2px;left:calc(50% + 6px);margin:0;min-width:18px;height:18px;font-size:10.5px;padding:0 5px}
 .qn[data-q="search"]{display:none}.qn[data-q="menu"]{display:flex}
 main{padding-bottom:96px!important}
 .side.mopen{position:fixed!important;z-index:59;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 10px);bottom:calc(74px + env(safe-area-inset-bottom,0px));display:block;overflow:auto;padding:16px 16px 20px!important;border-radius:20px!important;background:var(--surface)!important;border:1px solid var(--line)!important;box-shadow:0 20px 50px rgba(0,0,0,.3)}
 .side.mopen>.nav{display:flex!important;flex-direction:column;overflow:visible;gap:1px}
 .side.mopen>.ux-mh{display:flex!important}
 .side.mopen .nav-group{display:block!important;padding:14px 10px 4px}
 .side.mopen .nav-item{display:flex!important;width:100%;background:transparent;border:0;color:var(--ink);border-radius:10px;padding:10px 12px;font-size:15px}
 .side.mopen .nav-item[aria-current="page"]{background:color-mix(in srgb,var(--ui) 13%,var(--surface));color:var(--ui)}
 .side.mopen .nav>#sideSearch{display:flex!important;margin:0 0 6px}
 .side.mopen .nav>.nav-item[data-go="home"],.side.mopen .nav>.nav-item[data-go="cards"]{display:none!important}
 .side.mopen~.scrim{display:block;position:fixed;inset:0;z-index:58;background:rgba(0,0,0,.28)}
}
.ux-mh{display:none;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.ux-mh b{font-family:var(--font-display);font-size:18px}
.ux-x{all:unset;cursor:pointer;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-size:20px;line-height:1}
/* ---- хаб «Конспекты» ---- */
.vchip{display:inline-flex;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,#0e8a8f 14%,var(--surface));color:#0b7479;margin-left:6px;white-space:nowrap}
:host([data-theme="dark"]) .vchip{color:#43cfc8}
.kx-prog{display:flex;flex-direction:column;gap:5px}
.kx-prog i{display:block;height:6px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.kx-prog i u{display:block;height:100%;border-radius:99px;background:var(--eosin);transition:width .4s}
.kx-prog span{font-size:12.5px;color:var(--muted)}
.kh-secs button.kx-seen:after{content:"✓";margin-left:auto;color:var(--ok);font-weight:700}
.kx-more{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.kx-link{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:16px;background:var(--surface);border:1px solid var(--line)}
.kx-link:hover{border-color:var(--hema)}
.kx-link b{display:block;font-size:15px}.kx-link span{font-size:12.5px;color:var(--muted)}
.kx-link .ux-i{color:var(--hema);width:24px;height:24px;flex:none}
`;
const st=document.createElement('style');st.textContent=CSS;R.appendChild(st);

/* ---------- данные ---------- */
const DOCS=[['tour','var(--sky)','Мембрана, цитоплазма, ядро'],['cell','var(--eosin)','Органоиды клетки'],['chem','var(--hema)','Химический состав клетки'],['energy','var(--amber)','Биоэнергетика'],['osmos','var(--chl)','Осмос и водный потенциал'],['bact','var(--eosin)','Введение в микробиологию']];
const modName=id=>{const b=$(`.nav-item[data-go="${id}"]`);return b?b.childNodes[0].textContent.trim():id};
function docInfo(mod){const d=(BV.KR||{})[mod];if(!d)return null;
  const secs=d.sections||[],parent={};secs.forEach(s=>{parent[s.id]=s.id;(s.sub||[]).forEach(([sid])=>parent[sid]=s.id)});
  const seen=new Set(store.get('kseen:'+mod,[]).filter(id=>parent[id]));
  const pos=store.get('kpos:'+mod,null);
  return{mod,d,secs,parent,seen,pos,done:secs.filter(s=>seen.has(s.id)).length}}
/* список конспектов берём из раздела «Конспекты» (туда сами попадают новые), цвета — свои */
const COL={tour:'var(--sky)',cell:'var(--eosin)',chem:'var(--hema)',energy:'var(--amber)',osmos:'var(--chl)',bact:'var(--eosin)'};
function docs(){const L=BV.konspList?BV.konspList().map(d=>d.m):DOCS.map(d=>d[0]);
  return L.map(m=>{const b=DOCS.find(d=>d[0]===m);const k=(BV.KR||{})[m];return [m,COL[m]||'var(--hema)',b?b[2]:(k&&k.title||modName(m)).replace(/\s*[:·(].*$/,'')]})}
BV.UX={docInfo,DOCS,docs,modName};

/* ---------- переходы ---------- */
function scrollToEl(el){if(!el)return;let n=0;const f=()=>{const t=el.getBoundingClientRect().top;if(Math.abs(t-14)>4)window.scrollBy(0,t-14);if(++n<4)setTimeout(()=>requestAnimationFrame(f),120*n)};f()}
function openDoc(mod,sec){closeMenu();BV.go(mod);try{history.replaceState(null,'','#'+mod)}catch(e){}
  const m=$('#m-'+mod);if(!m)return;const b=$('.k-switch button[data-m="doc"]',m);if(b&&b.getAttribute('aria-pressed')!=='true')b.click();
  requestAnimationFrame(()=>{const el=sec?($('#k-'+sec,m)||$('#'+sec,m)):null;if(el)scrollToEl(el);else window.scrollTo({top:0})})}
function openViz(mod){closeMenu();BV.go(mod);const m=$('#m-'+mod);const b=m&&$('.k-switch button[data-m="viz"]',m);if(b&&b.getAttribute('aria-pressed')!=='true')b.click();window.scrollTo({top:0})}
function openTasks(coll){closeMenu();BV.go('quiz');if(coll&&BV.tasksOpen)BV.tasksOpen(coll);try{history.replaceState(null,'','#quiz')}catch(e){}window.scrollTo({top:0});sync()}
function go(id){closeMenu();BV.go(id);try{history.replaceState(null,'','#'+id)}catch(e){}window.scrollTo({top:0})}
Object.assign(BV.UX,{openDoc,openViz,openTasks,go});

/* ---------- панель быстрого доступ ---------- */
const kbd=/Mac|iP/.test(navigator.platform)?'⌘K':'Ctrl K';
const side=$('.side');
side.insertAdjacentHTML('afterbegin',`<nav class="qnav" aria-label="Быстрый доступ">
 <button class="qn" data-q="home">${ic('home')}<span>Главная</span></button>
 <button class="qn" data-q="ref">${ic('notes')}<span>Конспекты</span></button>
 <button class="qn" data-q="quiz">${ic('quiz')}<span>Задания</span><i class="qb" id="qbErr" hidden title="Ошибки к разбору"></i></button>
 <button class="qn" data-q="cards">${ic('cards')}<span>Карточки</span><i class="qb" id="qbDue" hidden title="Карточки к повторению"></i></button>
 <button class="qn" data-q="search">${ic('search')}<span>Поиск</span><em class="qk">${kbd}</em></button>
 <button class="qn" data-q="menu" aria-expanded="false">${ic('menu')}<span>Разделы</span></button>
</nav><div class="ux-mh"><b>Все разделы</b><button class="ux-x" data-x aria-label="Закрыть">×</button></div>`);
const qnav=$('.qnav',side);
qnav.addEventListener('click',e=>{const b=BV_ET(e).closest('.qn');if(!b)return;const q=b.dataset.q;
  if(q==='search'){BV.openSearch&&BV.openSearch();return}
  if(q==='menu'){side.classList.contains('mopen')?closeMenu():openMenu();return}
  go(q)});
function openMenu(){side.classList.add('mopen');$('.qn[data-q="menu"]',qnav).setAttribute('aria-expanded','true');side.scrollTop=0}
function closeMenu(){if(!side.classList.contains('mopen'))return;side.classList.remove('mopen');$('.qn[data-q="menu"]',qnav).setAttribute('aria-expanded','false')}
$('.ux-x',side).addEventListener('click',closeMenu);
$('.scrim').addEventListener('click',closeMenu);
$('.nav',side).addEventListener('click',e=>{if(BV_ET(e).closest('.nav-item,#sideSearch'))setTimeout(closeMenu,0)});
R.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});

/* пункт «Вузовские задачи» в группе «Теория» */
{const ref=$('.nav-item[data-go="ref"]');if(ref)ref.insertAdjacentHTML('afterend',`<button class="nav-item" data-act="vuz">Вузовские задачи</button>`);
 const v=$('.nav-item[data-act="vuz"]');if(v)v.addEventListener('click',()=>openTasks('vuz'))}

/* ---------- раздел «Конспекты»: прогресс чтения и ссылки ---------- */
function decorate(){const body=$('#khBody');if(!body||$('.kx-more',body))return;
  $$('.kh-card',body).forEach(c=>{const o=$('[data-o]',c);const x=o&&docInfo(o.dataset.o);if(!x||!x.secs.length)return;
    const B=$$('.kh-secs button[data-s]',c),tot=x.secs.length,done=x.done;
    B.forEach(b=>{if(x.seen.has(b.dataset.s))b.classList.add('kx-seen')});
    const pct=tot?Math.round(done/tot*100):0,acts=$('.kh-acts',c);
    if(acts)acts.insertAdjacentHTML('beforebegin',`<div class="kx-prog"><i><u style="width:${pct}%"></u></i><span class="pe-row"><span>${done?`Прочитано ${done} из ${tot}`:'Ещё не открывали'}</span><button type="button" class="pe-edit" data-pe="${o.dataset.o}">Изменить</button></span></div>`)});
  $$('[data-pe]',body).forEach(b=>b.addEventListener('click',()=>BV.UX.editProgress&&BV.UX.editProgress(b.dataset.pe)));
  const nVuz=(BV.TB||[]).filter(t=>t.c==='vuz').length;
  body.insertAdjacentHTML('beforeend',`<div class="kx-more" style="margin-top:16px">
   <button class="kx-link" data-kx="vuz">${ic('cap')}<span><b>Вузовские задачи · ${nVuz}</b><span>Биохимия, молекулярная биология, микробиология, биоинформатика</span></span></button>
   <button class="kx-link" data-kx="cards">${ic('cards')}<span><b>Карточки</b><span>Интервальное повторение терминов и своих карточек</span></span></button>
   <button class="kx-link" data-kx="quiz">${ic('quiz')}<span><b>Задания</b><span>Тренажёр, ЕГЭ, олимпиады и «Мои ошибки»</span></span></button></div>`);
  $$('[data-kx]',body).forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.kx;k==='vuz'?openTasks('vuz'):k==='quiz'?openTasks(null):go(k)}))}
{const body=$('#khBody');if(body)new MutationObserver(()=>{if(!$('.kx-more',body))decorate()}).observe(body,{childList:true})}

/* ---------- где остановились в конспекте ---------- */
let tmr=0;
function track(){tmr=0;const doc=$$('.module:not([hidden]) .k-doc:not([hidden])')[0];if(!doc)return;const mod=doc.closest('.module').id.slice(2);
  const a=$('.k-toc a.on',doc);if(!a)return;const id=a.dataset.to;const info=docInfo(mod);if(!info||!info.parent[id])return;
  store.set('kpos:'+mod,{id,ts:Date.now()});const S=new Set(store.get('kseen:'+mod,[])),NO=store.get('kunseen:'+mod,[]);if(!S.has(info.parent[id])&&!NO.includes(info.parent[id])){S.add(info.parent[id]);store.set('kseen:'+mod,[...S])}
  store.set('klast',{mod,ts:Date.now()});store.set('khLast',{m:mod,s:info.parent[id]})}
addEventListener('scroll',()=>{if(!tmr)tmr=setTimeout(track,350)},{passive:true});

/* ---------- состояние: активный пункт и счётчики ---------- */
function sync(){const cur=$$('.module').find(m=>!m.hidden);const id=cur?cur.id.slice(2):'';
  $$('.qn',qnav).forEach(b=>{const on=b.dataset.q===id;on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});
  const v=$('.nav-item[data-act="vuz"]');if(v){const on=id==='quiz'&&store.get('tkcoll','quiz')==='vuz';on?v.setAttribute('aria-current','page'):v.removeAttribute('aria-current')}
  let due=0,err=0;try{due=BV.srs?BV.srs.dueCount():0}catch(e){}try{err=BV.tasksPending?BV.tasksPending().length:0}catch(e){}
  const qd=$('#qbDue'),qe=$('#qbErr');qd.hidden=!due;qd.textContent=due>99?'99+':due;qe.hidden=!err;qe.textContent=err>99?'99+':err}
BV.UX.sync=sync;
new MutationObserver(()=>{clearTimeout(sync.t);sync.t=setTimeout(sync,30)}).observe($('main'),{attributes:true,subtree:false,childList:false,attributeFilter:['hidden']});
$$('main>.module').forEach(m=>new MutationObserver(()=>{clearTimeout(sync.t);sync.t=setTimeout(sync,30)}).observe(m,{attributes:true,attributeFilter:['hidden']}));
{const o=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('module'))new MutationObserver(()=>{clearTimeout(sync.t);sync.t=setTimeout(sync,30)}).observe(n,{attributes:true,attributeFilter:['hidden']})})));o.observe($('main'),{childList:true})}
if(BV.prog&&BV.prog.on)BV.prog.on(()=>{clearTimeout(sync.t);sync.t=setTimeout(sync,60)});
BVHOST.afterAnswer=()=>{clearTimeout(sync.t);sync.t=setTimeout(()=>{sync();if(BV.tasksSync)BV.tasksSync()},60)};
setTimeout(sync,0);
})();
