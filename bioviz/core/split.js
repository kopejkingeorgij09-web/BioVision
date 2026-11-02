/* Двухоконный режим конспекта: интерактивные рисунки (.kf) закреплены справа, текст слева.
   На широком экране рисунок, к которому относится читаемый абзац, стоит в колонке справа;
   в тексте на его месте остаётся строка-ссылка. На узком экране рисунки остаются в тексте,
   а когда рисунок уходит за верхний край, появляется чип «Рис. N», он открывает рисунок поверх текста.

   Подсветка при прокрутке: у абзаца (p, li, h4…) можно поставить data-hl, и когда абзац
   доходит до линии чтения, рисунок переключается в нужное состояние. Значение — действия через «;»:
     mbMotorS=pos            переключатель или ползунок с этим id получает значение
     mbMotor@[data-p="mot"]  нажать на деталь рисунка (CSS-селектор внутри рисунка)
     mbChain#g2              подсветить элементы с data-k="g2"
     mbChain                 просто показать рисунок, подсветку снять
   Подробнее в content/README.md. */
(function(){
const {$,$$,esc}=BV,R=BVHOST.root;

const STYLE=`
main.kd-wide{max-width:1680px}
.k-wrap.split{gap:22px}
.k-wrap.split{grid-template-columns:56px minmax(580px,1fr) minmax(340px,46%);grid-template-areas:"toc sheet dock"}
.k-wrap.split .k-sheet{grid-area:sheet;padding:36px 38px 52px}
/* содержание сворачивается в узкую полосу с номерами разделов; при наведении раскрывается поверх текста */
.k-wrap.split .k-toc{grid-area:toc;position:sticky;z-index:6;width:56px;padding:12px 0;overflow:hidden;transition:width .22s cubic-bezier(.3,.7,.2,1),box-shadow .22s}
.k-wrap.split .k-toc:not(.open)>b,.k-wrap.split .k-toc:not(.open) a.sub{display:none}
.k-wrap.split .k-toc:not(.open) a{font-size:0;line-height:0;padding:4px 0;display:flex;justify-content:center;background:none;z-index:1}
.k-wrap.split .k-toc:not(.open) a:before{content:attr(data-no);display:grid;place-items:center;width:28px;height:28px;border-radius:50%;box-sizing:border-box;
  border:1px solid var(--line);background:var(--card);color:var(--muted);font:600 12px/1 var(--font-mono);transition:background .2s,color .2s,border-color .2s}
.k-wrap.split .k-toc:not(.open) a.past:before{color:var(--ink);border-color:color-mix(in oklab,var(--cut) 45%,var(--line))}
.k-wrap.split .k-toc:not(.open) a.cur:before{background:var(--cut);border-color:var(--cut);color:var(--on-accent)}
.k-wrap.split .k-toc:not(.open) a:hover:before{border-color:var(--ink);color:var(--ink)}
.k-wrap.split .k-toc:not(.open) .toc-line{left:27px}
.k-wrap.split .k-toc:not(.open) .toc-line b:after{display:none}
.k-wrap.split .k-toc.open{width:268px;padding:14px 10px 12px;overflow:auto;box-shadow:0 18px 44px -18px rgba(10,30,20,.38)}
.k-wrap.split .k-toc.open a{white-space:normal}
:host(.full) .k-wrap.split{max-width:none}
.k-dock{grid-area:dock;position:sticky;top:calc(var(--barh) + 16px);max-height:calc(100dvh - var(--barh) - 32px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;min-width:0;display:flex;flex-direction:column;gap:10px}
.k-dock[hidden]{display:none}
/* рисунок «Крупнее» должен перекрыть шапку и содержание */
.k-dock:has(.kf.full){z-index:80;overflow:visible}
.kd-h{display:flex;align-items:center;gap:10px;min-height:32px;padding:0 2px}
.kd-n{font:600 11.5px/1.2 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--cut)}
.kd-st{font:500 11.5px/1.2 var(--font-mono);letter-spacing:.04em;color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kd-nav{margin-left:auto;display:flex;gap:4px;flex:none}
.kd-nav button,.kd-x{all:unset;box-sizing:border-box;cursor:pointer;width:32px;height:32px;border-radius:var(--rx,6px);display:grid;place-items:center;color:var(--muted);border:1px solid var(--line);background:var(--card)}
.kd-nav button:hover,.kd-x:hover{color:var(--ink);border-color:var(--ink)}
.kd-nav button:focus-visible,.kd-x:focus-visible,.kf-ph:focus-visible,.kd-chip:focus-visible,.kd-all button:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.kd-nav button[disabled]{opacity:.35;pointer-events:none}
.kd-nav svg,.kd-x svg,.kf-ph svg,.kd-chip svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.k-dock .kf{margin:0;box-shadow:var(--csh,none)}
.k-dock .kf.kd-off{display:none}
.k-dock .kf.kd-in{animation:kdIn .38s cubic-bezier(.3,.7,.2,1)}
@keyframes kdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.k-dock.pre .kf:not(.full){opacity:.72;transition:opacity .3s}
.k-dock.pre .kf:hover{opacity:1}
.kd-all{border:1px solid var(--line);border-radius:var(--r);background:var(--card);padding:16px 14px 12px}
.kd-all[hidden]{display:none}
.kd-all>b{display:block;font:600 11px/1.3 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);padding:0 8px 6px}
.kd-all>p{margin:0 8px 10px;font-size:13.5px;line-height:1.45;color:var(--muted)}
.kd-all button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;align-items:baseline;width:100%;padding:8px;border-radius:var(--rx,6px);font-size:14px;line-height:1.35;color:var(--ink)}
.kd-all button:hover{background:var(--surface-2)}
.kd-all button i{font:600 12px/1.35 var(--font-mono);font-style:normal;color:var(--cut)}
/* строка-ссылка на месте рисунка в тексте */
.kf-ph{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;width:100%;margin:16px 0 18px;padding:10px 14px;border-radius:var(--rs,8px);
  border:1px dashed color-mix(in oklab,var(--cut) 40%,var(--line));color:var(--muted);font:500 12.5px/1.35 var(--font-mono);letter-spacing:.02em;transition:border-color .2s,background .2s,color .2s}
.kf-ph b{color:var(--ink);font-weight:600;font-family:var(--font-body);font-size:14px;letter-spacing:0;min-width:0}
.kf-ph em{font-style:normal;margin-left:auto;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.kf-ph:hover{border-color:var(--cut);color:var(--ink)}
.kf-ph.on{border-style:solid;border-color:var(--cut);background:var(--ui-soft);color:var(--cut)}
/* абзац, к которому сейчас привязан рисунок */
.k-sheet [data-hl]{position:relative}
.k-sheet [data-hl]:before{content:"";position:absolute;left:-20px;top:.3em;bottom:.3em;width:3px;border-radius:2px;background:var(--cut);opacity:0;transform:scaleY(.4);transition:opacity .3s,transform .35s cubic-bezier(.3,.7,.2,1);pointer-events:none}
.k-sheet li[data-hl]:before{left:-38px}
.k-sheet [data-hl].hl-on:before{opacity:1;transform:none}
@container bvm (max-width:700px){.k-sheet [data-hl]:before{left:-10px}.k-sheet li[data-hl]:before{left:-32px}}
/* подсветка частей рисунка в лесной гамме */
.kf [data-k].on{filter:drop-shadow(0 0 1.5px var(--card)) drop-shadow(0 0 6px color-mix(in oklab,var(--cut) 70%,transparent))}
/* телефон: чип и рисунок поверх текста */
.kd-chip{all:unset;box-sizing:border-box;position:fixed;z-index:45;top:calc(var(--barh) + 10px);right:12px;transform:translateY(-8px);opacity:0;pointer-events:none;
  display:inline-flex;align-items:center;gap:8px;max-width:min(72vw,340px);padding:8px 14px 8px 11px;border-radius:999px;cursor:pointer;white-space:nowrap;
  background:var(--deep);color:var(--on-deep);font:600 12.5px/1.2 var(--font-mono);letter-spacing:.03em;box-shadow:0 10px 26px -12px rgba(0,0,0,.5);transition:opacity .22s,transform .22s}
.kd-chip span{font:500 13px/1.2 var(--font-body);letter-spacing:0;opacity:.85;overflow:hidden;text-overflow:ellipsis;min-width:0}
.kd-chip svg{flex:none}
.kd-chip.vis{opacity:1;transform:none;pointer-events:auto}
.kd-scrim{position:fixed;inset:0;z-index:68;background:rgba(8,14,11,.42);animation:kdFade .2s}
.kd-pop{position:fixed;z-index:69;left:0;right:0;bottom:0;max-height:88dvh;display:flex;flex-direction:column;background:var(--bg);border-radius:18px 18px 0 0;
  box-shadow:0 -12px 40px rgba(0,0,0,.28);animation:kdUp .28s cubic-bezier(.3,.7,.2,1)}
.kd-pop .kd-h{padding:12px 14px 10px 16px;border-bottom:1px solid var(--line)}
.kd-pop .kd-h b{font:600 14px/1.3 var(--font-body);color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kd-pop .kd-x{margin-left:auto;flex:none}
.kd-pb{overflow:auto;overscroll-behavior:contain;padding:12px 12px calc(16px + env(safe-area-inset-bottom,0px))}
.kd-pb .kf{margin:0}
@keyframes kdUp{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
@keyframes kdFade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.k-dock .kf.kd-in,.kd-pop,.kd-scrim{animation:none}.kd-chip,.k-sheet [data-hl]:before{transition:none}}
`;
{const st=document.createElement('style');st.textContent=STYLE;R.appendChild(st)}

const ICO={
 prev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
 next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
 side:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
 fig:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 15l3.5-4 3 3 2-2 2.5 3"/></svg>',
 x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'};

const SPLIT=1060;   /* ширина колонки страницы, с которой рисунки уходят вправо */
const main=$('#main');
let S=null;                    /* состояние открытой лекции */

const barh=()=>parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60;
const lineY=()=>{const b=barh();return b+(innerHeight-b)*.42};
function cw(){const cs=getComputedStyle(main);return main.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)}

/* подпись рисунка: номер и название из figcaption */
function meta(f){const bs=$$('figcaption>b',f),t0=bs[0]?bs[0].textContent:'';const m=t0.match(/Рис\.\s*([\d.]+\d)/);
  const n=m?m[1]:'',t=(m?bs[1]:bs[0]);return{n,t:t?t.textContent.replace(/\.\s*$/,'').trim():''}}

/* ---------- действия data-hl ---------- */
function parseHl(v){return String(v||'').split(';').map(s=>s.trim()).filter(Boolean).map(a=>{
  let i=a.indexOf('@');if(i>0)return{t:'click',fig:a.slice(0,i).trim(),sel:a.slice(i+1).trim()};
  i=a.indexOf('#');if(i>0)return{t:'pick',fig:a.slice(0,i).trim(),key:a.slice(i+1).trim()};
  i=a.indexOf('=');if(i>0)return{t:'set',id:a.slice(0,i).trim(),val:a.slice(i+1).trim()};
  return{t:'show',fig:a}})}
function figOfAct(a){if(a.fig)return S.figs.get(a.fig)||null;const c=S.root.querySelector('#'+CSS.escape(a.id));const f=c&&c.closest('.kf');return f?S.figs.get(f.dataset.fig)||null:null}
function run(F,acts){const f=F.el;
  try{
    if(!acts.some(a=>a.t==='pick')&&f._pick)f._pick(null);
    for(const a of acts){
      if(a.t==='set'){const c=f.querySelector('#'+CSS.escape(a.id));if(!c)continue;
        if(c.matches('input[type=range]')){if(c.value!==a.val){c.value=a.val;c.dispatchEvent(new Event('input',{bubbles:true}))}}
        else{const b=c.querySelector(`[data-v="${CSS.escape(a.val)}"]`);if(b)b.click()}}
      else if(a.t==='click'){const el=f.querySelector('.kf-st '+a.sel)||f.querySelector(a.sel);if(el){f._pick&&f._pick(null);el.dispatchEvent(new MouseEvent('click',{bubbles:true}))}}
      else if(a.t==='pick'){f._pick&&(f._pick(null),f._pick(a.key))}}
  }catch(e){console.warn('data-hl',acts,e)}}

/* ---------- сборка ---------- */
function build(page){
  const wrap=$('.k-wrap',page),sheet=wrap&&$('.k-sheet',wrap);if(!sheet)return null;
  const st={page,wrap,sheet,root:page,figs:new Map(),order:[],mode:'',active:null,actEl:null,pre:false,pop:null};
  $$('.kf',sheet).forEach(f=>{const id=f.dataset.fig;if(!id||st.figs.has(id))return;
    const m=meta(f),ph=document.createElement('button');ph.type='button';ph.className='kf-ph';ph.dataset.ph=id;
    ph.innerHTML=`${ICO.fig}<span>Рис. ${esc(m.n)}</span><b>${esc(m.t)}</b><em>справа ${ICO.side}</em>`;
    ph.setAttribute('aria-label',`Рисунок ${m.n}, ${m.t}: показан справа от текста`);
    const F={id,el:f,ph,n:m.n,t:m.t,sec:f.closest('.k-sec')};st.figs.set(id,F);st.order.push(F)});
  if(!st.order.length)return st;
  const dock=document.createElement('aside');dock.className='k-dock';dock.hidden=true;dock.setAttribute('aria-label','Рисунок к тексту');
  dock.innerHTML=`<div class="kd-h"><span class="kd-n"></span><span class="kd-st"></span><div class="kd-nav"><button type="button" data-go="-1" aria-label="Предыдущий рисунок">${ICO.prev}</button><button type="button" data-go="1" aria-label="Следующий рисунок">${ICO.next}</button></div></div><div class="kd-figs"></div>
    <div class="kd-all" hidden><b>Рисунки лекции</b><p>В этом разделе своих рисунков нет. Нажми на любой, чтобы перейти к нему.</p>${st.order.map(F=>`<button type="button" data-fig-go="${F.id}"><i>${esc(F.n)}</i><span>${esc(F.t)}</span></button>`).join('')}</div>`;
  wrap.appendChild(dock);st.dock=dock;st.box=$('.kd-figs',dock);
  dock.addEventListener('click',e=>{const t=BV_ET(e);
    const g=t.closest('[data-go]');if(g){const i=st.order.indexOf(st.active)+(+g.dataset.go);const F=st.order[i];if(F)goTo(F);return}
    const a=t.closest('[data-fig-go]');if(a){const F=st.figs.get(a.dataset.figGo);if(F)goTo(F)}});
  sheet.addEventListener('click',e=>{const p=BV_ET(e).closest('.kf-ph');if(!p)return;const F=st.figs.get(p.dataset.ph);if(!F)return;
    if(st.active!==F)goTo(F);else pulse(F)});
  const chip=document.createElement('button');chip.type='button';chip.className='kd-chip';chip.setAttribute('aria-hidden','true');chip.tabIndex=-1;
  page.appendChild(chip);st.chip=chip;
  chip.addEventListener('click',()=>{if(st.chipFig)openPop(st.chipFig)});
  return st}

/* узкое содержание: номер раздела у каждой верхней ссылки, раскрытие по наведению и с клавиатуры */
function railToc(){const toc=$('.k-toc',S.wrap);if(!toc)return;
  if(!toc.dataset.rail){toc.dataset.rail='1';
    $$('a:not(.sub)',toc).forEach(a=>{const m=a.textContent.trim().match(/^(\d+)\./);a.dataset.no=m?m[1]:'·';if(!a.title)a.title=a.textContent.trim()});
    let t=0;const set=o=>{clearTimeout(t);t=setTimeout(()=>{if(!S||S.mode!=='split'){toc.classList.remove('open');return}
      if(toc.classList.contains('open')===o)return;toc.classList.toggle('open',o);BV.app.tocLine&&BV.app.tocLine()},o?60:160)};
    toc.addEventListener('mouseenter',()=>set(true));toc.addEventListener('mouseleave',()=>set(false));
    toc.addEventListener('focusin',()=>set(true));toc.addEventListener('focusout',e=>{if(!toc.contains(e.relatedTarget))set(false)});
    toc.addEventListener('click',e=>{if(BV_ET(e).closest('a'))set(false)})}
  toc.classList.remove('open');BV.app.tocLine&&requestAnimationFrame(()=>BV.app.tocLine())}

/* точки привязки в порядке текста: строки-ссылки (или сами рисунки) и абзацы с data-hl */
function anchors(){const out=[];
  $$('[data-hl], .kf-ph, .kf',S.sheet).forEach(el=>{
    if(el.classList.contains('kf-ph')){const F=S.figs.get(el.dataset.ph);if(F)out.push({el,F,acts:null});return}
    if(el.classList.contains('kf')){if(el.closest('.kd-pop'))return;const F=S.figs.get(el.dataset.fig);if(F)out.push({el,F,acts:null});return}
    if(el.closest('.kf'))return;
    const acts=parseHl(el.getAttribute('data-hl'));if(!acts.length)return;
    const F=figOfAct(acts[0]);if(F)out.push({el,F,acts})});
  out.forEach(a=>a.sec=a.el.closest('.k-sec'));return out}

function setMode(){if(!S||!S.order.length)return;
  const m=cw()>SPLIT?'split':'flow';if(m===S.mode)return;
  closePop();
  const was=S.mode;S.mode=m;
  S.wrap.classList.toggle('split',m==='split');railToc();
  if(m==='flow'){if(was&&was!=='flow')S.order.forEach(F=>{F.el.classList.remove('kd-off','kd-in');if(F.ph.isConnected)F.ph.replaceWith(F.el)});S.dock.hidden=true}
  else if(!was||was==='flow'){S.order.forEach(F=>{if(F.el.parentNode!==S.box){F.el.replaceWith(F.ph);S.box.appendChild(F.el)}F.el.classList.add('kd-off')});S.dock.hidden=false;S.active=null}
  S.anc=anchors();clearAct();tick()}

function clearAct(){$$('.hl-on',S.sheet).forEach(e=>e.classList.remove('hl-on'));S.actEl=null}

/* ---------- прокрутка ---------- */
function pick(){const y=lineY(),A=S.anc;let last=-1;
  for(let i=0;i<A.length;i++){if(A[i].el.getBoundingClientRect().top<y)last=i;else break}
  /* раздел, который сейчас читают */
  let sec=null;const secs=$$('.k-sec',S.sheet);for(const s of secs){if(s.getBoundingClientRect().top<y)sec=s;else break}
  if(last>=0&&A[last].sec===sec)return{a:A[last],pre:false,sec};
  const nx=A[last+1];if(sec&&nx&&nx.sec===sec)return{a:nx,pre:true,sec};
  return{a:null,pre:false,sec}}

function tick(){if(!S||!S.order.length||!S.anc)return;
  const {a,pre,sec}=pick();
  const F=a?a.F:null;
  if(S.mode!=='flow')showDock(F,pre,sec);
  /* подсветка абзаца и состояние рисунка */
  const el=a&&!pre&&a.acts?a.el:null;
  if(el!==S.actEl){if(S.actEl)S.actEl.classList.remove('hl-on');S.actEl=el;if(el){el.classList.add('hl-on');run(a.F,a.acts)}}
  S.order.forEach(G=>G.ph.classList.toggle('on',G===F&&!pre));
  if(S.mode==='flow')chip(F&&!pre&&F.el.getBoundingClientRect().bottom<barh()+8?F:null);else chip(null)}

function showDock(F,pre,sec){const d=S.dock;
  d.classList.toggle('pre',!!(F&&pre));
  const all=$('.kd-all',d);all.hidden=!!F;$('.kd-nav',d).hidden=!F;
  if(!F)$('p',all).textContent=sec?'В этом разделе своих рисунков нет. Нажми на любой, чтобы перейти к нему.':'Рисунок появится здесь, когда дойдёшь до него в тексте. Можно перейти и сразу.';
  if(F!==S.active){
    if(S.active)S.active.el.classList.add('kd-off');
    if(F){F.el.classList.remove('kd-off');F.el.classList.remove('kd-in');void F.el.offsetWidth;F.el.classList.add('kd-in');d.scrollTop=0}
    S.active=F;
    const i=S.order.indexOf(F);$('[data-go="-1"]',d).disabled=i<=0;$('[data-go="1"]',d).disabled=i<0||i>=S.order.length-1}
  $('.kd-n',d).textContent=F?'Рис. '+F.n:'';
  $('.kd-st',d).textContent=F?(pre?'ниже в тексте':'к тексту слева'):''}

function goTo(F){const t=F.ph.isConnected?F.ph:F.el;const y=t.getBoundingClientRect().top-barh()-90;
  window.scrollBy({top:y,behavior:Math.abs(y)>innerHeight*2.5||matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}
function pulse(F){F.el.classList.remove('kd-in');void F.el.offsetWidth;F.el.classList.add('kd-in')}

/* ---------- телефон ---------- */
function chip(F){const c=S.chip;if(!c)return;if(S.pop)F=null;
  if(F!==S.chipFig){S.chipFig=F;if(F)c.innerHTML=`${ICO.fig}Рис. ${esc(F.n)}<span>${esc(F.t)}</span>`}
  c.classList.toggle('vis',!!F);c.setAttribute('aria-hidden',String(!F));c.tabIndex=F?0:-1}
function openPop(F){closePop();const f=F.el,hold=document.createElement('div');hold.style.height=f.offsetHeight+'px';hold.className='kd-hold';f.replaceWith(hold);
  const w=document.createElement('div');
  w.innerHTML=`<div class="kd-scrim"></div><div class="kd-pop" role="dialog" aria-modal="true" aria-label="Рисунок ${esc(F.n)}"><div class="kd-h"><span class="kd-n">Рис. ${esc(F.n)}</span><b>${esc(F.t)}</b><button type="button" class="kd-x" aria-label="Закрыть рисунок">${ICO.x}</button></div><div class="kd-pb"></div></div>`;
  $('.kd-pb',w).appendChild(f);S.page.appendChild(w);S.pop={w,F,hold};chip(null);
  $('.kd-scrim',w).addEventListener('click',closePop);$('.kd-x',w).addEventListener('click',closePop);$('.kd-x',w).focus({preventScroll:true,focusVisible:false})}
function closePop(){if(!S||!S.pop)return;const {w,F,hold}=S.pop;S.pop=null;if(F.el.classList.contains('full'))$('.kf-zoom',F.el).click();hold.replaceWith(F.el);w.remove();S.chipFig=undefined;tick()}
R.addEventListener('keydown',e=>{if(e.key==='Escape'&&S&&S.pop&&!S.pop.F.el.classList.contains('full'))closePop()});

let raf=0;const sched=()=>{if(raf||!S)return;raf=requestAnimationFrame(()=>{raf=0;if(S)tick()})};
addEventListener('scroll',sched,{passive:true});
let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(S){setMode();tick()}},120)});

/* состояние хранится для каждой лекции: при возврате на страницу рисунки уже стоят на местах */
const STATES=new WeakMap();
function off(){main.classList.remove('kd-wide');if(!S)return;closePop();chip(null);S=null}
BV.split={
  /* вызывается роутером, когда открыта лекция: page — её страница */
  on(page){const wrap=$('.k-wrap',page);if(!wrap){off();return}
    if(S&&S.wrap!==wrap)off();
    main.classList.add('kd-wide');
    S=STATES.get(wrap)||build(page);if(!S)return;STATES.set(wrap,S);
    if(!S.order.length){main.classList.remove('kd-wide');S=null;return}
    S.mode=S.mode||'';setMode();S.anc=anchors();clearAct();requestAnimationFrame(tick)},
  off,
  refresh(){if(S){S.anc=anchors();tick()}}};
})();
