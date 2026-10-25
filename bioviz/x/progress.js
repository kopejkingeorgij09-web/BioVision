/* Прогресс чтения конспектов: просмотр и ручная правка.
   Отметить раздел прочитанным или снять отметку, отметить всё, сбросить конспект или весь прогресс.
   Открывается: кнопка «Прогресс» в шапке конспекта, «Изменить» на карточке в «Конспектах», ссылка на главной.
   Данные те же, что пишет автоотслеживание: kseen:<mod> (прочитанные разделы), kpos:<mod> (где остановились). */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root,U=BV.UX;
const CSS=`
.pe-b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font:600 13.5px var(--font-body);color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:7px 12px;background:var(--surface);white-space:nowrap}
.pe-b:hover{border-color:var(--hema);color:var(--hema)}
.pe-b[hidden]{display:none}
.pe-b .pe-mini{width:42px;height:6px;border-radius:99px;background:var(--surface-2);overflow:hidden;display:inline-block}
.pe-b .pe-mini u{display:block;height:100%;background:var(--ok);border-radius:99px}
.pe-b em{font-style:normal;color:var(--muted);font-weight:600;font-variant-numeric:tabular-nums}
.pe-edit{all:unset;cursor:pointer;font:600 12.5px var(--font-body);color:var(--hema);margin-left:auto;padding:2px 4px;border-radius:6px}
.pe-edit:hover{text-decoration:underline}
.kx-prog .pe-row{display:flex;align-items:center;gap:8px}
.pe-ov{position:fixed;inset:0;z-index:130;background:rgba(8,20,16,.42);display:flex;align-items:center;justify-content:center;padding:16px;animation:peF .16s ease}
.pe-ov[hidden]{display:none}
@keyframes peF{from{opacity:0}}
@keyframes peU{from{transform:translateY(14px);opacity:.4}}
.pe{width:min(620px,100%);max-height:min(760px,calc(100vh - 32px));display:flex;flex-direction:column;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:22px;box-shadow:0 30px 80px -30px rgba(0,0,0,.55);overflow:hidden;animation:peU .2s ease;font-family:var(--font-body)}
.pe-hd{padding:18px 20px 12px;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--line)}
.pe-t{display:flex;align-items:flex-start;gap:12px}
.pe-t h2{margin:0;font-family:var(--font-display);font-size:20px;line-height:1.2;flex:1}
.pe-t small{display:block;font:700 11px var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.pe-x{all:unset;cursor:pointer;flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);font-size:20px;line-height:1;color:var(--muted)}
.pe-x:hover{color:var(--ink);border-color:var(--ink)}
.pe-docs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -2px;padding:0 2px 2px}
.pe-docs::-webkit-scrollbar{display:none}
.pe-docs button{all:unset;box-sizing:border-box;cursor:pointer;flex:none;display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;border:1px solid var(--line);font:600 13px var(--font-body);color:var(--muted);background:var(--surface)}
.pe-docs button i{font-style:normal;font-variant-numeric:tabular-nums;font-size:12px;opacity:.85}
.pe-docs button[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.pe-sum{display:flex;align-items:center;gap:14px}
.pe-ring{flex:none;width:58px;height:58px}
.pe-ring circle{fill:none;stroke-width:6}
.pe-ring .bg{stroke:var(--surface-2)}
.pe-ring .fg{stroke:var(--ok);stroke-linecap:round;transition:stroke-dashoffset .35s ease}
.pe-ring text{font:700 15px var(--font-body);fill:var(--ink);text-anchor:middle;dominant-baseline:central}
.pe-sum p{margin:0;font-size:14px;color:var(--muted);line-height:1.45}
.pe-sum p b{color:var(--ink);font-size:15px}
.pe-ls{overflow:auto;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
.pe-it{display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:12px;cursor:pointer;user-select:none}
.pe-it:hover{background:var(--surface-2)}
.pe-it .no{flex:none;min-width:26px;font-variant-numeric:tabular-nums;font-weight:700;color:var(--muted);font-size:13.5px}
.pe-it .tt{flex:1;min-width:0;font-size:14.5px;line-height:1.35}
.pe-it .tt small{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.pe-it.on .no{color:var(--ok)}
.pe-it.here .tt small{color:var(--hema)}
.pe-go{all:unset;cursor:pointer;flex:none;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:var(--muted)}
.pe-go:hover{background:var(--surface);color:var(--hema)}
.pe-go svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.pe-sw{flex:none;position:relative;width:44px;height:26px}
.pe-sw input{position:absolute;inset:0;margin:0;opacity:0;cursor:pointer}
.pe-sw i{position:absolute;inset:0;border-radius:99px;background:var(--line);transition:background .18s}
.pe-sw i:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s}
.pe-sw input:checked+i{background:var(--ok)}
.pe-sw input:checked+i:after{transform:translateX(18px)}
.pe-sw input:focus-visible+i{outline:2px solid var(--focus,#2C7BE5);outline-offset:2px}
.pe-ft{border-top:1px solid var(--line);padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pe-ft .sp{flex:1}
.pe-ft button{all:unset;box-sizing:border-box;cursor:pointer;padding:9px 14px;border-radius:11px;font:600 13.5px var(--font-body);border:1px solid var(--line);color:var(--ink);background:var(--surface)}
.pe-ft button:hover{border-color:var(--ink)}
.pe-ft button.pri{background:var(--ink);border-color:var(--ink);color:var(--surface)}
.pe-ft button.dng{color:var(--bad)}
.pe-ft button.dng:hover{border-color:var(--bad)}
.pe-ft button.arm{background:var(--bad);border-color:var(--bad);color:#fff}
.pe-mark{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:10px;margin:22px 0 4px;padding:11px 14px;border-radius:14px;border:1.5px dashed var(--line);font:600 14px var(--font-body);color:var(--muted);width:100%;transition:border-color .15s,background .15s,color .15s}
.pe-mark:hover{border-color:var(--ok);color:var(--ink)}
.pe-mark .bx{flex:none;width:22px;height:22px;border-radius:7px;border:2px solid currentColor;display:grid;place-items:center;transition:background .15s}
.pe-mark .bx svg{width:14px;height:14px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:0}
.pe-mark[aria-pressed="true"]{border-style:solid;border-color:color-mix(in oklab,var(--ok) 55%,var(--line));background:color-mix(in oklab,var(--ok) 9%,var(--surface));color:var(--ink)}
.pe-mark[aria-pressed="true"] .bx{background:var(--ok);border-color:var(--ok)}
.pe-mark[aria-pressed="true"] .bx svg{opacity:1}
.pe-mark small{margin-left:auto;font-weight:500;font-size:12.5px;color:var(--muted)}
:host(.reading) .pe-mark{max-width:100%}
.pe-note{font-size:12.5px;color:var(--muted)}
.pe-toast{position:fixed;z-index:131;left:50%;bottom:calc(92px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink);color:var(--surface);padding:10px 14px;border-radius:12px;font:600 13.5px var(--font-body);display:flex;gap:12px;align-items:center;box-shadow:0 12px 30px -12px rgba(0,0,0,.5)}
.pe-toast[hidden]{display:none}
.pe-toast button{all:unset;cursor:pointer;color:var(--surface);text-decoration:underline;font-weight:700}
@media (max-width:640px){
 .pe-ov{align-items:flex-end;padding:0}
 .pe{border-radius:22px 22px 0 0;max-height:88vh;border-bottom:0}
 .pe-ft{padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))}
 .pe-ft .sp{display:none}
 .pe-ft button{flex:1 1 auto;text-align:center}
}
`;
const st=document.createElement('style');st.textContent=CSS;R.appendChild(st);

/* ---------- данные ---------- */
const docsAll=()=>(U.docs?U.docs():U.DOCS).map(d=>d[0]).filter(m=>U.docInfo(m)&&U.docInfo(m).secs.length);
const title=m=>{const x=U.docInfo(m);return x?x.d.title||U.modName(m):m};
const info=m=>U.docInfo(m);
function setSeen(m,ids){store.set('kseen:'+m,[...ids])}
/* один раздел вручную: снятая отметка больше не ставится сама при прокрутке, пока её не вернут */
function setOne(m,id,on){const S=new Set(store.get('kseen:'+m,[])),N=new Set(store.get('kunseen:'+m,[]));
  if(on){S.add(id);N.delete(id)}else{S.delete(id);N.add(id)}setSeen(m,S);store.set('kunseen:'+m,[...N])}
function changed(){try{BV.prog&&BV.prog.emit&&BV.prog.emit('kread')}catch(e){}refreshAll()}
/* перерисовать всё, что показывает прогресс */
function refreshAll(){
  const cur=$$('main>.module').find(x=>!x.hidden);const id=cur?cur.id.slice(2):'';
  try{if(id==='home'&&BV.hooks.home&&BV.hooks.home.show)BV.hooks.home.show()}catch(e){}
  try{if(id==='ref'&&BV.hooks.ref&&BV.hooks.ref.show)BV.hooks.ref.show()}catch(e){}
  addBtns(true);addMarks()}

/* ---------- окно ---------- */
const ov=document.createElement('div');ov.className='pe-ov';ov.hidden=true;
ov.innerHTML=`<div class="pe" role="dialog" aria-modal="true" aria-labelledby="peT"><div class="pe-hd"><div class="pe-t"><div style="flex:1"><small>Прогресс чтения</small><h2 id="peT"></h2></div><button class="pe-x" type="button" aria-label="Закрыть">×</button></div>
 <div class="pe-docs" role="group" aria-label="Конспект"></div><div class="pe-sum"></div></div>
 <div class="pe-ls"></div>
 <div class="pe-ft"><button type="button" data-a="all">Отметить всё</button><button type="button" data-a="none">Снять все отметки</button><span class="sp"></span><button type="button" class="dng" data-a="reset">Сбросить конспект</button><button type="button" class="pri" data-a="ok">Готово</button></div></div>`;
R.appendChild(ov);
const toast=document.createElement('div');toast.className='pe-toast';toast.hidden=true;R.appendChild(toast);
let cur=null,undo=null,prevFocus=null;
const ARROW='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
function ring(p){const r=24,c=2*Math.PI*r;return `<svg class="pe-ring" viewBox="0 0 58 58" aria-hidden="true"><circle class="bg" cx="29" cy="29" r="${r}"/><circle class="fg" cx="29" cy="29" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-p)).toFixed(1)}" transform="rotate(-90 29 29)"/><text x="29" y="29">${Math.round(p*100)}%</text></svg>`}
function render(){const x=info(cur);if(!x)return close();
  $('#peT',ov).textContent=title(cur);
  $('.pe-docs',ov).innerHTML=docsAll().map(m=>{const y=info(m);return `<button type="button" data-m="${m}" aria-pressed="${m===cur}">${esc((U.docs?U.docs():U.DOCS).find(d=>d[0]===m)?.[2]||U.modName(m))}<i>${y.done}/${y.secs.length}</i></button>`}).join('');
  const here=x.pos&&x.parent[x.pos.id],p=x.secs.length?x.done/x.secs.length:0;
  $('.pe-sum',ov).innerHTML=ring(p)+`<p><b>Прочитано ${x.done} из ${x.secs.length}</b><br>${x.done===x.secs.length?'Конспект пройден целиком.':here?'Отметки ставятся сами, когда вы пролистываете раздел. Здесь их можно поправить вручную.':'Отметки ставятся сами, когда вы пролистываете раздел. Можно отметить уже знакомые разделы вручную.'}</p>`;
  $('.pe-ls',ov).innerHTML=x.secs.map(s=>{const on=x.seen.has(s.id),isH=here===s.id;
    return `<div class="pe-it${on?' on':''}${isH?' here':''}" data-s="${esc(s.id)}"><span class="no">${esc(String(s.no||'·'))}</span><span class="tt">${esc(s.t)}${isH?'<small>здесь вы остановились</small>':''}</span>
     <button class="pe-go" type="button" data-go="${esc(s.id)}" aria-label="Открыть раздел «${esc(s.t)}»" title="Открыть раздел">${ARROW}</button>
     <label class="pe-sw"><input type="checkbox" ${on?'checked':''} aria-label="Прочитано: ${esc(s.t)}"><i></i></label></div>`}).join('');
  const rs=$('[data-a="reset"]',ov);rs.classList.remove('arm');rs.textContent='Сбросить конспект'}
function open(m){const L=docsAll();if(!L.length)return;cur=L.includes(m)?m:(store.get('klast',{}).mod&&L.includes(store.get('klast',{}).mod)?store.get('klast',{}).mod:L[0]);
  prevFocus=R.activeElement||document.activeElement;ov.hidden=false;render();setTimeout(()=>{const b=$('.pe-x',ov);b&&b.focus({preventScroll:true})},20)}
function close(){if(ov.hidden)return;ov.hidden=true;refreshAll();try{prevFocus&&prevFocus.focus&&prevFocus.focus({preventScroll:true})}catch(e){}}
function snapshot(m){return{m,seen:store.get('kseen:'+m,[]),no:store.get('kunseen:'+m,[]),pos:store.get('kpos:'+m,null)}}
function showToast(txt,snap){toast.innerHTML=`<span>${esc(txt)}</span>${snap?'<button type="button">Вернуть</button>':''}`;toast.hidden=false;undo=snap;
  clearTimeout(showToast.t);showToast.t=setTimeout(()=>{toast.hidden=true;undo=null},6000);
  const b=$('button',toast);if(b)b.onclick=()=>{if(!undo)return;store.set('kseen:'+undo.m,undo.seen);store.set('kunseen:'+undo.m,undo.no||[]);undo.pos?store.set('kpos:'+undo.m,undo.pos):store.del?store.del('kpos:'+undo.m):store.set('kpos:'+undo.m,null);toast.hidden=true;undo=null;if(!ov.hidden)render();changed()}}

ov.addEventListener('click',e=>{const t=BV_ET(e);
  if(t===ov||t.closest('.pe-x')||t.closest('[data-a="ok"]'))return close();
  const d=t.closest('.pe-docs button');if(d){cur=d.dataset.m;render();return}
  const g=t.closest('.pe-go');if(g){const m=cur,s=g.dataset.go;close();U.openDoc(m,s);return}
  const a=t.closest('[data-a]');if(a){const x=info(cur);
    if(a.dataset.a==='all'){setSeen(cur,x.secs.map(s=>s.id));store.set('kunseen:'+cur,[]);render();changed();return}
    if(a.dataset.a==='none'){const sn=snapshot(cur);setSeen(cur,[]);store.set('kunseen:'+cur,[]);render();changed();showToast('Отметки сняты',sn);return}
    if(a.dataset.a==='reset'){if(!a.classList.contains('arm')){a.classList.add('arm');a.textContent='Точно сбросить?';clearTimeout(a._t);a._t=setTimeout(()=>{a.classList.remove('arm');a.textContent='Сбросить конспект'},3500);return}
      const sn=snapshot(cur);setSeen(cur,[]);store.set('kunseen:'+cur,[]);store.set('kpos:'+cur,null);const kl=store.get('klast',null);if(kl&&kl.mod===cur)store.set('klast',null);const kh=store.get('khLast',null);if(kh&&kh.m===cur)store.set('khLast',null);
      render();changed();showToast('Прогресс конспекта сброшен',sn);return}}
  const it=t.closest('.pe-it');if(it&&!t.closest('.pe-sw')){const cb=$('input',it);cb.checked=!cb.checked;cb.dispatchEvent(new Event('change',{bubbles:true}))}});
ov.addEventListener('change',e=>{const cb=BV_ET(e);if(!cb.matches('.pe-sw input'))return;const it=cb.closest('.pe-it'),id=it.dataset.s;
  setOne(cur,id,cb.checked);
  /* перерисовать только шапку и строку, чтобы не сбивать прокрутку списка */
  it.classList.toggle('on',cb.checked);const x=info(cur),p=x.secs.length?x.done/x.secs.length:0;
  $('.pe-ring',ov).outerHTML=ring(p);$('.pe-sum b',ov).textContent=`Прочитано ${x.done} из ${x.secs.length}`;
  const db=$(`.pe-docs button[data-m="${cur}"] i`,ov);if(db)db.textContent=`${x.done}/${x.secs.length}`;changed()});
ov.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();return}
  if(e.key==='Tab'){const f=$$('button,input',ov).filter(x=>x.offsetParent);if(!f.length)return;const a=R.activeElement;
    if(e.shiftKey&&a===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&a===f[f.length-1]){e.preventDefault();f[0].focus()}}});

/* ---------- кнопка «Прогресс» в шапке конспекта ---------- */
function btnHtml(m){const x=info(m);if(!x||!x.secs.length)return '';const p=x.done/x.secs.length;return `<span class="pe-mini"><u style="width:${Math.round(p*100)}%"></u></span><span>Прогресс</span><em>${x.done}/${x.secs.length}</em>`}
function addBtns(upd){$$('.k-bar').forEach(bar=>{const m=bar.closest('.module');if(!m)return;const id=m.id.slice(2);if(!info(id)||!info(id).secs.length)return;
  let b=bar.querySelector('.pe-b');
  if(!b){b=document.createElement('button');b.type='button';b.className='pe-b';b.title='Посмотреть и изменить прогресс чтения';b.addEventListener('click',()=>open(id));
    const sync=()=>{const sw=bar.querySelector('.k-switch button[data-m="doc"]');b.hidden=!(sw&&sw.getAttribute('aria-pressed')==='true');if(!b.hidden)b.innerHTML=btnHtml(id)};
    b._sync=sync;new MutationObserver(sync).observe(bar,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});bar.appendChild(b);sync();return}
  if(upd&&b._sync)b._sync()})}
const TICK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function markHtml(on){return `<span class="bx">${TICK}</span><span>${on?'Раздел прочитан':'Отметить раздел прочитанным'}</span><small>${on?'нажмите, чтобы снять':''}</small>`}
function addMarks(){$$('main>.module').forEach(m=>{const doc=$('.k-doc',m);if(!doc)return;const id=m.id.slice(2),x=info(id);if(!x||!x.secs.length)return;
  const top=new Set(x.secs.map(s=>s.id));
  $$('.k-sec',doc).forEach(el=>{const sid=el.dataset.sec;if(!top.has(sid))return;let b=el.querySelector(':scope>.pe-mark');const on=x.seen.has(sid);
    if(!b){b=document.createElement('button');b.type='button';b.className='pe-mark';b.dataset.m=id;b.dataset.s=sid;
      const foot=el.querySelector(':scope>.sec-foot');foot?el.insertBefore(b,foot):el.appendChild(b)}
    if(b.getAttribute('aria-pressed')!==String(on)){b.setAttribute('aria-pressed',String(on));b.innerHTML=markHtml(on)}})})}
R.addEventListener('click',e=>{const b=BV_ET(e).closest&&BV_ET(e).closest('.pe-mark');if(!b)return;
  const on=b.getAttribute('aria-pressed')!=='true';setOne(b.dataset.m,b.dataset.s,on);b.setAttribute('aria-pressed',String(on));b.innerHTML=markHtml(on);changed()});
setTimeout(addBtns,450);setTimeout(addMarks,500);
new MutationObserver(()=>{clearTimeout(addBtns.t);addBtns.t=setTimeout(()=>{addBtns(false);addMarks()},90)}).observe($('main'),{childList:true,subtree:true});
/* автоотметка при прокрутке меняет счётчик — обновляем кнопку не чаще раза в секунду */
addEventListener('scroll',()=>{clearTimeout(addBtns.s);addBtns.s=setTimeout(()=>{addBtns(true);addMarks()},900)},{passive:true});

BV.UX.editProgress=open;
})();
