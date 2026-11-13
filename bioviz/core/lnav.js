/* Навигация по лекции на телефоне и планшете, переход по разделам клавишами ← и →.
   Когда боковое содержание не помещается (узкий экран), внизу стоит полоска лекции:
     ‹ предыдущий раздел · текущий раздел (нажми, чтобы открыть содержание) · следующий раздел ›
   Содержание открывается шторкой снизу: разделы с номерами, прочитанные отмечены, подразделы раскрываются.
   Шторку закрывают нажатие мимо, крестик, Esc или жест вниз за ручку.
   На телефоне нижняя панель сайта (Курс, Лабораторные, Профиль) уезжает вниз, пока читаешь, и возвращается,
   когда листаешь вверх: полоска лекции остаётся на месте. */
(function(){
const {$,$$,store,clamp}=BV,R=BVHOST.root,APP=BV.app,host=BVHOST.host;

const ICO={prev:'<path d="M15 6l-6 6 6 6"/>',next:'<path d="M9 6l6 6-6 6"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',chev:'<path d="M6 9l6 6 6-6"/>',
  list:'<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.6" cy="6.5" r="1.1"/><circle cx="4.6" cy="12" r="1.1"/><circle cx="4.6" cy="17.5" r="1.1"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',up:'<path d="M12 19V5M6 11l6-6 6 6"/>',ok:'<path d="M6 12.5l4 4L18 8"/>'};
const svg=k=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;

const STY=`
/* старая кнопка «Содержание» и список в начале лекции заменены полоской и шторкой */
.k-fab,.k-sheetnav,.k-scrim{display:none!important}
.k-ctoc{display:none!important}
.ln{position:fixed;z-index:46;display:flex;align-items:stretch;gap:4px;background:var(--card);color:var(--ink);
  transition:transform .3s cubic-bezier(.3,.7,.2,1);animation:lnIn .32s cubic-bezier(.3,.7,.2,1)}
.ln[hidden]{display:none}
@keyframes lnIn{from{opacity:0;translate:0 14px}}
:where(.ln) button{all:unset;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ln button:focus-visible{outline:2px solid var(--cut);outline-offset:-2px}
.ln-a{flex:none;width:46px;display:grid;place-items:center;border-radius:12px;color:var(--ink);transition:background .15s,opacity .2s}
.ln-a .i{width:22px;height:22px}
.ln-a:active{background:var(--surface-2)}
.ln-a[disabled]{opacity:.28;pointer-events:none}
.ln-c{flex:1;min-width:0;position:relative;overflow:hidden;display:flex;align-items:center;gap:11px;padding:0 12px 0 8px;border-radius:12px;background:var(--surface-2);transition:background .15s}
.ln-c:active{background:color-mix(in oklab,var(--ink) 10%,var(--surface-2))}
.ln-no{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--cut);color:var(--on-accent);font:600 12.5px/1 var(--font-mono)}
.ln-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.ln-tx small{font:500 10.5px/1.25 var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ln-tx b{font:600 14px/1.25 var(--font-body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ln-c>.i{flex:none;width:20px;height:20px;color:var(--muted)}
.ln-pg{position:absolute;left:0;right:0;bottom:0;height:2.5px;background:color-mix(in oklab,var(--cut) 16%,transparent)}
.ln-pg b{display:block;height:100%;width:0;background:var(--cut);transition:width .25s}
@media (max-width:760px){
  .ln{left:0;right:0;bottom:var(--dockh,64px);height:58px;padding:6px 6px 6px;border-top:1px solid var(--line)}
  /* панель сайта уехала вниз: полоска опускается к краю экрана, под ней заливка до края */
  .ln.low{transform:translateY(calc(var(--dockh,64px) - env(safe-area-inset-bottom,0px)))}
  .ln:after{content:"";position:absolute;left:0;right:0;top:100%;height:90px;background:var(--card)}
  .dock{transition:transform .3s cubic-bezier(.3,.7,.2,1)}
  .app.dk-hide .dock{transform:translateY(100%)}
  main.ln-on{padding-bottom:calc(150px + env(safe-area-inset-bottom,0px))}
  :host([data-ln]) .bv-toast{bottom:calc(var(--dockh,64px) + 70px)}
  :host([data-ln]) .kd-chip{top:calc(var(--barh) + 10px)}
}
@media (min-width:761px){
  .ln{left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(560px,calc(100vw - 32px));height:60px;padding:6px;translate:-50% 0;
    border:1px solid var(--line);border-radius:18px;box-shadow:0 16px 40px -18px rgba(0,0,0,.4)}
  main.ln-on{padding-bottom:120px}
  :host([data-ln]) .bv-toast{bottom:calc(92px + env(safe-area-inset-bottom,0px))}
}

/* шторка с содержанием */
.ls-scrim{position:fixed;inset:0;z-index:72;background:rgba(8,14,11,.44);opacity:0;transition:opacity .3s}
.ls-scrim.on{opacity:1}
.ls{--tx:0px;--dy:0px;position:fixed;z-index:73;left:0;right:0;bottom:0;max-height:min(86dvh,820px);display:flex;flex-direction:column;
  background:var(--card);color:var(--ink);border-radius:20px 20px 0 0;box-shadow:0 -18px 50px -14px rgba(0,0,0,.4);
  transform:translate(var(--tx),calc(100% + 30px));transition:transform .38s cubic-bezier(.22,.8,.24,1)}
.ls.on{transform:translate(var(--tx),var(--dy))}
.ls.drag{transition:none}
@media (min-width:761px){.ls{--tx:-50%;left:50%;right:auto;bottom:16px;width:min(620px,calc(100vw - 32px));border-radius:20px;max-height:min(80dvh,820px)}}
:where(.ls) :is(button,a){all:unset;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ls button:focus-visible,.ls a:focus-visible{outline:2px solid var(--cut);outline-offset:-2px}
.ls-grab{flex:none;display:grid;place-items:center;height:22px;touch-action:none;cursor:grab}
.ls-grab i{width:40px;height:4.5px;border-radius:3px;background:var(--line)}
.ls-h{flex:none;display:flex;gap:12px;align-items:flex-start;padding:2px 14px 12px 20px;touch-action:none}
.ls-h>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ls-h small{font:500 11px/1.3 var(--font-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--cut)}
.ls-h b{font:600 19px/1.2 var(--font-display);letter-spacing:-.01em}
.ls-h span{display:flex;align-items:center;gap:9px;font:500 12px/1.3 var(--font-mono);color:var(--muted);margin-top:4px}
.ls-h .trk i{width:7px;height:10px}
.ls-x{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--muted);background:var(--surface-2)}
.ls-x:active{color:var(--ink)}
.ls-t{flex:none;display:flex;gap:8px;padding:0 14px 12px 14px;border-bottom:1px solid var(--line)}
.ls-t button{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border-radius:12px;border:1px solid var(--line);font:600 14px/1 var(--font-body);color:var(--ink)}
.ls-t button .i{width:18px;height:18px;color:var(--muted)}
.ls-t button:active{background:var(--surface-2)}
.ls-b{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:8px 8px calc(18px + env(safe-area-inset-bottom,0px))}
.ls-l{list-style:none;margin:0;padding:0}
.ls-r{display:flex;align-items:center;border-radius:14px}
.ls-s.cur>.ls-r{background:var(--ui-soft)}
.ls-a{flex:1;min-width:0;display:flex;align-items:center;gap:13px;min-height:52px;padding:8px 6px 8px 10px;font:500 15px/1.32 var(--font-body)}
.ls-no{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);background:var(--card);color:var(--muted);font:600 12.5px/1 var(--font-mono);position:relative}
.ls-s.seen .ls-no{border-color:color-mix(in oklab,var(--cut) 55%,var(--line));color:var(--ink)}
.ls-s.seen .ls-no:after{content:"";position:absolute;right:-3px;bottom:-3px;width:13px;height:13px;border-radius:50%;background:var(--cut) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6 12.5l4 4L18 8' fill='none' stroke='white' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/9px no-repeat;border:2px solid var(--card)}
.ls-s.cur .ls-no{background:var(--cut);border-color:var(--cut);color:var(--on-accent)}
.ls-s.cur .ls-no:after{display:none}
.ls-s.cur .ls-a{font-weight:600}
.ls-tg{flex:none;width:46px;height:46px;display:grid;place-items:center;border-radius:12px;color:var(--muted)}
.ls-tg .i{width:20px;height:20px;transition:transform .3s cubic-bezier(.3,.7,.2,1)}
.ls-s.open .ls-tg .i{transform:rotate(180deg)}
.ls-u{display:grid;grid-template-rows:0fr;transition:grid-template-rows .34s cubic-bezier(.22,.8,.24,1)}
.ls-s.open>.ls-u{grid-template-rows:1fr}
.ls-u>div{min-height:0;overflow:hidden;display:flex;flex-direction:column;padding-left:55px}
.ls-u a{display:block;padding:9px 12px 9px 12px;margin:1px 0;border-left:2px solid var(--line);font:400 14px/1.38 var(--font-body);color:var(--muted)}
.ls-u a:first-child{margin-top:2px}.ls-u a:last-child{margin-bottom:8px}
.ls-u a.on{border-left-color:var(--cut);color:var(--ink);font-weight:600}
.ls-k{margin:12px 12px 0;font:500 11.5px/1.45 var(--font-mono);color:var(--muted)}
@media (prefers-reduced-motion:reduce){.ln,.ls,.ls-scrim,.ls-u,.ls-tg .i,.dock{transition:none!important;animation:none!important}}
`;
{const st=document.createElement('style');st.textContent=STY;R.appendChild(st)}

const plain=h=>{const d=document.createElement('div');d.innerHTML=h;return d.textContent.trim()};
const app=$('.app'),main=$('#main'),dock=$('.dock');
const phone=()=>innerWidth<=760;

/* ---------- полоска ---------- */
const bar=document.createElement('nav');bar.className='ln';bar.hidden=true;bar.setAttribute('aria-label','Разделы лекции');
bar.innerHTML=`<button type="button" class="ln-a" data-d="-1" aria-label="Предыдущий раздел">${svg('prev')}</button>
  <button type="button" class="ln-c" aria-haspopup="dialog" aria-label="Открыть содержание лекции"><span class="ln-no"></span><span class="ln-tx"><small></small><b></b></span>${svg('list')}<i class="ln-pg"><b></b></i></button>
  <button type="button" class="ln-a" data-d="1" aria-label="Следующий раздел">${svg('next')}</button>`;
R.appendChild(bar);
const bNo=$('.ln-no',bar),bK=$('.ln-tx small',bar),bT=$('.ln-tx b',bar),bPg=$('.ln-pg b',bar),bPrev=$('[data-d="-1"]',bar),bNext=$('[data-d="1"]',bar);

let P=null;   /* открытая лекция: {L, page, secs} */
function secsOf(L){return BV.progress.secsOf(L.id).map(s=>({id:s.id,no:s.no,t:plain(s.t||''),h:s.t||'',sub:(s.sub||[]).map(([id,t])=>({id,t}))}))}
/* активный пункт содержания ставит движок конспекта; по нему находим раздел верхнего уровня */
function curId(){const a=P&&$('.k-toc a.on',P.page);return a?a.dataset.to:null}
function curIdx(){const id=curId();if(!id)return 0;const i=P.secs.findIndex(s=>s.id===id||s.sub.some(x=>x.id===id));return i<0?0:i}
const seen=()=>new Set(BV.progress.seenOf(P.L.id));
/* полоска нужна, когда боковое содержание не помещается: его прячет движок на узкой колонке */
function narrow(){const t=P&&$('.k-toc',P.page);return !!t&&getComputedStyle(t).display==='none'}

let shown=-1;
function update(){if(!P)return;
  const on=narrow()&&P.secs.length>0;
  if(bar.hidden===on){bar.hidden=!on;main.classList.toggle('ln-on',on);on?host.setAttribute('data-ln',''):host.removeAttribute('data-ln');if(!on)dockShow(true);measure()}
  if(!on)return;
  const i=curIdx(),s=P.secs[i];
  if(i!==shown){shown=i;bNo.textContent=s.no||'·';bK.textContent=`Лекция ${P.L.n} · раздел ${i+1} из ${P.secs.length}`;bT.textContent=s.t;
    bPrev.disabled=i<=0;bNext.disabled=i>=P.secs.length-1;
    bPrev.setAttribute('aria-label',i>0?'Предыдущий раздел: '+P.secs[i-1].t:'Предыдущего раздела нет');
    bNext.setAttribute('aria-label',i<P.secs.length-1?'Следующий раздел: '+P.secs[i+1].t:'Это последний раздел')}
  const sh=$('.k-sheet',P.page);if(sh){const r=sh.getBoundingClientRect();bPg.style.width=(clamp((-r.top+innerHeight*.5)/r.height,0,1)*100).toFixed(1)+'%'}}

/* переход к разделу: тем же путём, что и пункт содержания, чтобы заголовок встал точно под шапку */
function go(id){if(!P)return;const a=$(`.k-toc a[data-to="${CSS.escape(id)}"]`,P.page);if(a)a.click()}
function step(d,say){if(!P)return;const i=curIdx()+d,s=P.secs[i];if(!s)return;go(s.id);shown=-1;
  if(say)BV.toast(`${s.no?s.no+'. ':''}${s.t}`,1800);requestAnimationFrame(update)}
bar.addEventListener('click',e=>{const t=BV_ET(e);const a=t.closest('.ln-a');if(a){step(+a.dataset.d);return}if(t.closest('.ln-c'))openSheet()});

/* ---------- нижняя панель сайта на телефоне ---------- */
function measure(){if(!dock)return;const h=phone()?dock.offsetHeight:0;bar.style.setProperty('--dockh',h+'px');host.style.setProperty('--dockh',h+'px')}
let dkHidden=false,lastY=scrollY,acc=0;
function dockShow(v){if(!app)return;if(dkHidden===!v)return;dkHidden=!v;app.classList.toggle('dk-hide',dkHidden);bar.classList.toggle('low',dkHidden)}
function onScroll(){const y=scrollY,dy=y-lastY;lastY=y;if(!P||bar.hidden||!phone()){acc=0;return}
  acc=(acc>0)===(dy>0)?acc+dy:dy;
  const nearEnd=y+innerHeight>document.documentElement.scrollHeight-160;
  if(y<120||nearEnd)dockShow(true);else if(acc>36)dockShow(false);else if(acc<-28)dockShow(true)}
let raf=0;
addEventListener('scroll',()=>{onScroll();if(raf||!P)return;raf=requestAnimationFrame(()=>{raf=0;update()})},{passive:true});
let rt=0;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{measure();shown=-1;update();if(sheet&&!narrow())closeSheet(true)},120)});

/* ---------- шторка с содержанием ---------- */
let sheet=null;
function openSheet(){if(!P||sheet)return;
  const S=seen(),ci=curIdx(),cid=curId(),num=P.secs.filter(s=>s.no),done=num.filter(s=>S.has(s.id)).length;
  const w=document.createElement('div');
  w.innerHTML=`<div class="ls-scrim"></div><div class="ls" role="dialog" aria-modal="true" aria-label="Содержание лекции ${P.L.n}">
    <div class="ls-grab" aria-hidden="true"><i></i></div>
    <header class="ls-h"><div><small>Лекция ${P.L.n} · содержание</small><b>${BV.esc(P.L.title)}</b>
      <span>${num.length?`<span class="trk" aria-hidden="true">${num.map(s=>`<i${S.has(s.id)?' class="on"':''}></i>`).join('')}</span>прочитано ${done} из ${num.length}`:''}</span></div>
      <button type="button" class="ls-x" aria-label="Закрыть содержание">${svg('x')}</button></header>
    <div class="ls-t"><button type="button" data-act="search">${svg('search')}Поиск</button><button type="button" data-act="top">${svg('up')}К началу лекции</button></div>
    <div class="ls-b"><ol class="ls-l">${P.secs.map((s,i)=>`<li class="ls-s${i===ci?' cur open':''}${S.has(s.id)?' seen':''}" data-i="${i}">
      <div class="ls-r"><a class="ls-a" data-go="${BV.esc(s.id)}" tabindex="0"${i===ci?' aria-current="location"':''}><span class="ls-no">${s.no||'·'}</span><span>${s.h}</span></a>${s.sub.length?`<button type="button" class="ls-tg" aria-expanded="${i===ci}" aria-label="Подразделы: ${BV.esc(s.t)}">${svg('chev')}</button>`:''}</div>
      ${s.sub.length?`<div class="ls-u"><div>${s.sub.map(x=>`<a data-go="${BV.esc(x.id)}" tabindex="${i===ci?0:-1}"${x.id===cid?' class="on"':''}>${x.t}</a>`).join('')}</div></div>`:''}</li>`).join('')}</ol>
      ${matchMedia('(hover:hover)').matches?'<p class="ls-k">Клавиши ← и → листают разделы.</p>':''}</div></div>`;
  R.appendChild(w);sheet={w,ret:R.activeElement};
  const ls=$('.ls',w),sc=$('.ls-scrim',w);
  dockShow(true);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ls.classList.add('on');sc.classList.add('on')}));
  /* текущий раздел виден сразу */
  const cur=$('.ls-s.cur',w);if(cur){const b=$('.ls-b',w);b.scrollTop=Math.max(0,cur.offsetTop-b.clientHeight*.3)}
  setTimeout(()=>{const f=$('.ls-s.cur a',w)||$('.ls-x',w);f&&f.focus({preventScroll:true})},60);
  sc.addEventListener('click',()=>closeSheet());
  w.addEventListener('click',e=>{const t=BV_ET(e);
    if(t.closest('.ls-x')){closeSheet();return}
    const tg=t.closest('.ls-tg');if(tg){const li=tg.closest('.ls-s'),o=!li.classList.contains('open');li.classList.toggle('open',o);tg.setAttribute('aria-expanded',String(o));$$('.ls-u a',li).forEach(a=>a.tabIndex=o?0:-1);return}
    const a=t.closest('[data-go]');if(a){const id=a.dataset.go;closeSheet(true);requestAnimationFrame(()=>{go(id);shown=-1;update()});return}
    const b=t.closest('[data-act]');if(b){closeSheet(true);if(b.dataset.act==='search'&&BV.search)BV.search.open('');else window.scrollTo({top:0})}});
  w.addEventListener('keydown',e=>{if(e.key==='Enter'){const a=BV_ET(e).closest('[data-go]');if(a){e.preventDefault();a.click()}}});
  /* жест вниз за ручку или шапку шторки */
  let y0=0,t0=0,dy=0,id=null;
  const down=e=>{if(BV_ET(e).closest('button'))return;id=e.pointerId;y0=e.clientY;t0=performance.now();dy=0;ls.classList.add('drag');try{e.currentTarget.setPointerCapture(id)}catch(er){}};
  const move=e=>{if(e.pointerId!==id)return;dy=Math.max(0,e.clientY-y0);ls.style.setProperty('--dy',dy+'px');sc.style.opacity=String(1-Math.min(1,dy/400))};
  const up=e=>{if(e.pointerId!==id)return;id=null;ls.classList.remove('drag');const v=dy/Math.max(1,performance.now()-t0);
    if(dy>90||v>.6)closeSheet();else{ls.style.setProperty('--dy','0px');sc.style.opacity=''}};
  [$('.ls-grab',w),$('.ls-h',w)].forEach(h=>{h.addEventListener('pointerdown',down);h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up)})}
function closeSheet(quick){if(!sheet)return;const {w,ret}=sheet;sheet=null;const ls=$('.ls',w),sc=$('.ls-scrim',w);
  if(quick||BV.reduced){w.remove()}else{ls.style.removeProperty('--dy');ls.classList.remove('on');sc.classList.remove('on');sc.style.opacity='';setTimeout(()=>w.remove(),380)}
  if(!quick&&ret&&ret.isConnected)ret.focus({preventScroll:true})}
R.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet){e.stopPropagation();closeSheet()}});

/* ---------- клавиши ← и → ---------- */
document.addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
  if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!P)return;
  const t=BV_ET(e);
  if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable],[role="slider"],.kmol.act,.k-tw'))return;
  if($('.sr')||$('.kd-pop')||$('.kf.full')||$('.lw-box')||$('.in-ov,.intro'))return;
  e.preventDefault();step(e.key==='ArrowRight'?1:-1,!sheet&&bar.hidden);if(sheet){closeSheet(true)}});

/* ---------- смена страницы ---------- */
function onRoute(){const r=APP.route;closeSheet(true);
  if(r&&r.kind==='lecture'){if(!P||P.L!==r.L)P={L:r.L,page:$('#m-'+r.L.id),secs:secsOf(r.L)};shown=-1;bar.hidden=true;measure();requestAnimationFrame(update)}
  else{P=null;bar.hidden=true;main.classList.remove('ln-on');host.removeAttribute('data-ln');dockShow(true)}}
addEventListener('bv-route',onRoute);
onRoute();
BV.lnav={open:openSheet,close:closeSheet,step,update};
})();
