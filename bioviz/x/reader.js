/* Режим чтения конспекта: спокойная колонка текста, крупный шрифт, оглавление сбоку,
   прогресс чтения и быстрый выход. Включается кнопкой в шапке конспекта или клавишей R. */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root;

const CSS=`
.rd-b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font:600 13.5px var(--font-body);color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:8px 13px;background:var(--surface);white-space:nowrap}
.rd-b:hover{border-color:var(--hema);color:var(--hema)}
.rd-b svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.rd-b[hidden]{display:none}

/* ---- сам режим ---- */
:host(.reading) .side,:host(.reading) .mod-head,:host(.reading) .k-bar,:host(.reading) .qnav,:host(.reading) .ux-mh,:host(.reading) .k-toc,:host(.reading) .k-fab{display:none!important}
:host(.reading) .app{display:block;background:var(--surface);min-height:100vh}
:host(.reading) main{padding:0}
:host(.reading) .module{gap:0}
:host(.reading) .k-doc{margin:0}
:host(.reading) .k-wrap{display:block}
:host(.reading) .k-sheet{border:0;box-shadow:none;background:transparent;border-radius:0;
  max-width:var(--rd-w,720px);margin:0 auto;padding:78px 24px 70px;
  font-size:var(--rd-fs,18.2px);line-height:var(--rd-lh,1.78)}
:host(.reading) .k-sheet p{margin:0 0 16px}
:host(.reading) .k-sheet h3{margin-top:34px}
:host(.reading) .k-sec+.k-sec{margin-top:46px;padding-top:40px}
:host(.reading) .k-prog{display:none}
@media (max-width:700px){:host(.reading) .k-sheet{padding:72px 16px 60px}}

/* шапка режима */
.rd-top{position:fixed;left:0;right:0;top:0;z-index:60;display:flex;align-items:center;gap:10px;
  padding:10px max(14px,env(safe-area-inset-left,0px)) 10px max(14px,env(safe-area-inset-right,0px));
  background:color-mix(in oklab,var(--surface) 92%,transparent);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--line);transition:transform .25s,opacity .25s}
.rd-top.hide{transform:translateY(-100%);opacity:0}
.rd-top .ti{flex:1;min-width:0;font:600 14.5px var(--font-body);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-top .ti em{font-style:normal;color:var(--muted);font-weight:500}
.rd-ic{all:unset;box-sizing:border-box;cursor:pointer;width:38px;height:38px;flex:none;border-radius:11px;display:grid;place-items:center;color:var(--muted);border:1px solid transparent}
.rd-ic:hover{color:var(--ink);background:var(--surface-2)}
.rd-ic[aria-pressed="true"]{color:var(--hema);border-color:var(--line);background:var(--surface-2)}
.rd-ic svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.rd-x{font-size:22px;line-height:1}
.rd-line{position:fixed;left:0;top:0;height:3px;background:var(--eosin);z-index:61;width:0;transition:width .12s linear}

/* панель настроек */
.rd-set{position:fixed;z-index:62;top:60px;right:14px;width:min(300px,calc(100vw - 28px));background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 20px 50px -22px rgba(0,0,0,.45);padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.rd-set[hidden]{display:none}
.rd-set label{display:flex;flex-direction:column;gap:6px;font:600 12.5px var(--font-body);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.rd-set .seg{display:flex;gap:6px}
.rd-set .seg button{all:unset;box-sizing:border-box;cursor:pointer;flex:1;text-align:center;padding:8px 4px;border-radius:10px;border:1px solid var(--line);font:600 14px var(--font-body);color:var(--ink)}
.rd-set .seg button[aria-pressed="true"]{border-color:var(--hema);background:color-mix(in oklab,var(--hema) 10%,var(--surface));color:var(--hema)}

/* оглавление */
.rd-toc{position:fixed;z-index:62;inset:0 auto 0 0;width:min(320px,86vw);background:var(--surface);border-right:1px solid var(--line);padding:62px 10px 20px;overflow:auto;transform:translateX(-102%);transition:transform .22s ease}
.rd-toc.on{transform:none;box-shadow:0 0 60px rgba(0,0,0,.25)}
.rd-toc b{display:block;padding:0 12px 10px;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.rd-toc a{display:block;padding:9px 12px;border-radius:10px;font-size:14.5px;line-height:1.35;color:var(--ink);text-decoration:none;cursor:pointer}
.rd-toc a:hover{background:var(--surface-2)}
.rd-toc a.on{background:color-mix(in oklab,var(--hema) 10%,var(--surface));color:var(--hema);font-weight:600}
.rd-toc a i{font-style:normal;color:var(--muted);margin-right:8px;font-variant-numeric:tabular-nums}
.rd-toc a.sub{padding-left:34px;font-size:13.5px;color:var(--muted)}
.rd-scrim{position:fixed;inset:0;z-index:61;background:rgba(0,0,0,.35)}
.rd-scrim[hidden]{display:none}

/* дно: соседние разделы */
.rd-foot{max-width:var(--rd-w,720px);margin:0 auto;padding:4px 24px 96px;display:flex;gap:10px;flex-wrap:wrap}
.rd-foot button{all:unset;box-sizing:border-box;cursor:pointer;flex:1 1 220px;border:1px solid var(--line);border-radius:14px;padding:12px 15px;background:var(--surface)}
.rd-foot button:hover{border-color:var(--hema)}
.rd-foot small{display:block;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}
.rd-foot b{font-size:14.5px;font-weight:600}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const IC={read:'<path d="M12 6.5C10.3 5.2 7.9 4.5 4 4.5v13c3.9 0 6.3.7 8 2 1.7-1.3 4.1-2 8-2v-13c-3.9 0-6.3.7-8 2z"/><path d="M12 6.5v13"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 aa:'<path d="M4 18 9 6l5 12M5.6 14.5h6.8M16 18l3-7 3 7M17.2 15.8h3.6"/>',
 wide:'<path d="M3 5v14M21 5v14M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3"/>'};
const ic=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

const PREF={fs:['Мельче','Обычный','Крупнее','Максимум'],fsv:[16.4,18.2,20,22],w:['Узкая','Средняя','Широкая'],wv:[620,720,840]};
let on=false,mod=null,sec=null,autoHide=0,lastY=0;

/* разметка режима */
const top=document.createElement('div');top.className='rd-top';top.hidden=true;
top.innerHTML=`<button class="rd-ic" data-act="toc" aria-label="Содержание">${ic('menu')}</button>
 <span class="ti"></span>
 <button class="rd-ic" data-act="aa" aria-label="Размер текста" aria-pressed="false">${ic('aa')}</button>
 <button class="rd-ic rd-x" data-act="close" aria-label="Выйти из режима чтения">×</button>`;
const line=document.createElement('div');line.className='rd-line';line.hidden=true;
const setp=document.createElement('div');setp.className='rd-set';setp.hidden=true;
setp.innerHTML=`<label>Размер текста<span class="seg" data-fs>${PREF.fs.map((n,i)=>`<button data-i="${i}">${['A−','A','A+','A++'][i]}</button>`).join('')}</span></label>
 <label>Ширина колонки<span class="seg" data-w>${PREF.w.map((n,i)=>`<button data-i="${i}">${n}</button>`).join('')}</span></label>`;
const toc=document.createElement('nav');toc.className='rd-toc';toc.setAttribute('aria-label','Содержание конспекта');
const scrim=document.createElement('div');scrim.className='rd-scrim';scrim.hidden=true;
const foot=document.createElement('div');foot.className='rd-foot';foot.hidden=true;
R.querySelector('.app').append(top,line,setp,toc,scrim);

function applyPrefs(){const fs=store.get('rdFs',1),w=store.get('rdW',1);
  const host=BVHOST.host;host.style.setProperty('--rd-fs',PREF.fsv[fs]+'px');host.style.setProperty('--rd-w',PREF.wv[w]+'px');
  host.style.setProperty('--rd-lh',fs>=2?'1.72':'1.78');
  $$('[data-fs] button',setp).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.i===fs)));
  $$('[data-w] button',setp).forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.i===w)))}
setp.addEventListener('click',e=>{const b=BV_ET(e).closest('button');if(!b)return;
  const g=b.closest('[data-fs]')?'rdFs':'rdW';store.set(g,+b.dataset.i);applyPrefs()});

function docOf(m){return (BV.KR||{})[m]||null}
function buildToc(){const d=docOf(mod);if(!d)return;
  toc.innerHTML=`<b>${esc(d.title||'Конспект')}</b>`+(d.sections||[]).map(s=>
    `<a data-to="${esc(s.id)}"><i>${s.no||'·'}</i>${esc(s.t)}</a>`+
    (s.sub||[]).map(([sid,st])=>`<a class="sub" data-to="${esc(sid)}">${esc(st)}</a>`).join('')).join('');
  $$('a',toc).forEach(a=>a.addEventListener('click',()=>{go(a.dataset.to);closeToc()}))}
function go(id){const m=$('#m-'+mod);const el=m&&(m.querySelector('#k-'+id)||m.querySelector('#'+id));
  if(el)el.scrollIntoView({block:'start'})}
function openToc(){toc.classList.add('on');scrim.hidden=false}
function closeToc(){toc.classList.remove('on');scrim.hidden=true}
scrim.addEventListener('click',closeToc);

function buildFoot(){const d=docOf(mod);if(!d)return;
  const L=(BV.konspList?BV.konspList():[]).map(x=>x.m);
  const i=L.indexOf(mod),prev=i>0?L[i-1]:null,next=i>=0&&i<L.length-1?L[i+1]:null;
  const nm=m=>{const x=docOf(m);return x&&x.title||m};
  foot.innerHTML=(prev?`<button data-m="${prev}"><small>Предыдущий конспект</small><b>${esc(nm(prev))}</b></button>`:'')+
    (next?`<button data-m="${next}"><small>Следующий конспект</small><b>${esc(nm(next))}</b></button>`:'')+
    `<button data-exit><small>Закончить чтение</small><b>Вернуться к разделу</b></button>`;
  $$('button',foot).forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.exit)return stop();
    const m=b.dataset.m;stop();setTimeout(()=>{if(BV.UX&&BV.UX.openDoc)BV.UX.openDoc(m,null);setTimeout(()=>start(m),420)},60)}))}

function spy(){if(!on)return;
  const m=$('#m-'+mod),sheet=m&&m.querySelector('.k-sheet');if(!sheet)return;
  const r=sheet.getBoundingClientRect(),p=Math.max(0,Math.min(1,(-r.top+innerHeight*0.35)/Math.max(1,r.height)));
  line.style.width=(p*100).toFixed(1)+'%';
  let cur=null;$$('.k-sec',m).forEach(s=>{if(s.getBoundingClientRect().top<150)cur=s.dataset.sec});
  if(cur&&cur!==sec){sec=cur;$$('a',toc).forEach(a=>a.classList.toggle('on',a.dataset.to===cur));
    const d=docOf(mod),s=(d.sections||[]).find(x=>x.id===cur);
    top.querySelector('.ti').innerHTML=s?`${esc(d.title||'')} <em>· ${s.no?s.no+'. ':''}${esc(s.t)}</em>`:esc(d&&d.title||'');
    try{store.set('kpos:'+mod,{id:cur,ts:Date.now()});const St=new Set(store.get('kseen:'+mod,[]));if(!St.has(cur)){St.add(cur);store.set('kseen:'+mod,[...St])}}catch(e){}}
  const y=window.scrollY;if(y>240&&y>lastY+6)top.classList.add('hide');else if(y<lastY-6||y<240)top.classList.remove('hide');lastY=y}
addEventListener('scroll',()=>{clearTimeout(autoHide);autoHide=setTimeout(spy,40)},{passive:true});

function start(m){
  const el=$('#m-'+(m||''));if(!el)return;
  const sw=el.querySelector('.k-switch button[data-m="doc"]');
  if(sw&&sw.getAttribute('aria-pressed')!=='true'){sw.click();setTimeout(()=>start(m),260);return}
  mod=m;on=true;sec=null;BVHOST.host.classList.add('reading');
  top.hidden=false;line.hidden=false;applyPrefs();buildToc();buildFoot();
  const host=el.querySelector('.k-doc')||el;host.appendChild(foot);foot.hidden=false;
  {const d=docOf(mod);top.querySelector('.ti').textContent=d&&d.title||''}
  const pos=store.get('kpos:'+mod,null);
  requestAnimationFrame(()=>{if(pos&&pos.id)go(pos.id);else window.scrollTo({top:0});spy()});
  store.set('rdOn',mod)}
function stop(){if(!on)return;on=false;BVHOST.host.classList.remove('reading');
  top.hidden=true;line.hidden=true;setp.hidden=true;foot.hidden=true;closeToc();store.set('rdOn','');
  const m=$('#m-'+mod);const el=m&&sec&&(m.querySelector('#k-'+sec));
  requestAnimationFrame(()=>{if(el)el.scrollIntoView({block:'start'});else window.scrollTo({top:0})})}
BV.reader={start,stop,get on(){return on}};

top.addEventListener('click',e=>{const b=BV_ET(e).closest('button');if(!b)return;const a=b.dataset.act;
  if(a==='close')return stop();
  if(a==='toc')return toc.classList.contains('on')?closeToc():openToc();
  if(a==='aa'){const h=setp.hidden;setp.hidden=!h;b.setAttribute('aria-pressed',String(h))}});
R.addEventListener('keydown',e=>{if(e.key==='Escape'&&on){e.stopPropagation();if(!setp.hidden)setp.hidden=true;else if(toc.classList.contains('on'))closeToc();else stop()}});
document.addEventListener('keydown',e=>{
  if(BV_ET(e).matches&&BV_ET(e).matches('input,textarea,select'))return;
  if(e.key==='r'||e.key==='R'||e.key==='к'||e.key==='К'){
    const cur=$$('main>.module').find(x=>!x.hidden);if(!cur)return;
    if(on)stop();else if(docOf(cur.id.slice(2)))start(cur.id.slice(2))}});

/* кнопка «Читать» рядом с переключателем вида */
function addBtn(){$$('.k-bar').forEach(bar=>{if(bar.querySelector('.rd-b'))return;
  const m=bar.closest('.module');if(!m)return;const id=m.id.slice(2);if(!docOf(id))return;
  const b=document.createElement('button');b.className='rd-b';b.innerHTML=ic('read')+'<span>Читать</span>';
  b.title='Режим чтения (клавиша R)';b.addEventListener('click',()=>start(id));
  const sync=()=>{const sw=bar.querySelector('.k-switch button[data-m="doc"]');b.hidden=!(sw&&sw.getAttribute('aria-pressed')==='true')};
  sync();bar.addEventListener('click',()=>setTimeout(sync,30));
  new MutationObserver(sync).observe(bar,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
  bar.appendChild(b)})}
setTimeout(addBtn,400);
new MutationObserver(()=>{clearTimeout(addBtn.t);addBtn.t=setTimeout(addBtn,80)}).observe($('main'),{childList:true,subtree:true});
})();
