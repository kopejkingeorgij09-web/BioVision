/* Редактор конспектов — только для владельца/редакторов артефакта.
   Правит текст, скрывает и добавляет блоки: текст, фото, векторные рисунки (SVG), видео.
   Всё пишется в базу (kedits) и в хранилище файлов артефакта; исходный код конспектов не трогается. */
(function(){
const KE=BV.KE;if(!KE||!KE.db||window.BV_KEDIT)return;window.BV_KEDIT=1;
const R=BVHOST.root,H=BVHOST.host,db=KE.db,{$$,esc}=BV;
let assets=null;claude.use('assets').then(a=>{assets=a;if(dlg.open)dlg.tabs()}).catch(()=>{});

const CSS=`
:host(.ed-on) .ai-btn{display:none!important}
:host(.ed-on) .k-sheet{outline:2px dashed color-mix(in srgb,var(--eosin,#C2366B) 40%,transparent);outline-offset:6px}
:host(.ed-on) .ed-hov{outline:2px solid color-mix(in srgb,var(--hema,#2F8A3B) 55%,transparent);outline-offset:3px;border-radius:4px;cursor:pointer}
:host(.ed-on) .ed-sel{outline:2.5px solid var(--hema,#2F8A3B)!important;outline-offset:3px;border-radius:4px;background:color-mix(in srgb,var(--hema,#2F8A3B) 7%,transparent)}
:host(.ed-on) .ed-hid{display:revert!important;opacity:.38;outline:2px dashed var(--bad,#c33);outline-offset:3px}
:host(.ed-on) [data-ed-t]{box-shadow:inset 3px 0 0 color-mix(in srgb,var(--eosin,#C2366B) 55%,transparent);padding-left:6px}
:host(.ed-on) .ed-blk{outline:1.5px dashed color-mix(in srgb,var(--hema,#2F8A3B) 70%,transparent);outline-offset:4px;border-radius:6px}
:host(.ed-on) .ed-blk[data-orphan]{outline-color:var(--bad,#c33)}
[contenteditable="true"].ed-live{outline:2.5px solid var(--eosin,#C2366B)!important;outline-offset:4px;border-radius:4px;background:var(--surface,#fff);cursor:text}
.ed-end{display:flex;justify-content:center;margin:14px 0 4px}
.ed-end button,.ed-b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:7px 12px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--surface,#fff);color:var(--ink,#123);font:600 13.5px/1.2 var(--font-body,system-ui,sans-serif);white-space:nowrap}
.ed-end button{border-style:dashed;color:var(--hema,#2F8A3B)}
.ed-end button:hover,.ed-b:hover{border-color:var(--hema,#2F8A3B)}
.ed-b:focus-visible,.ed-end button:focus-visible{outline:2px solid var(--focus,#2C7BE5);outline-offset:2px}
.ed-b[aria-pressed="true"]{background:color-mix(in srgb,var(--hema,#2F8A3B) 13%,var(--surface,#fff));border-color:var(--hema,#2F8A3B);color:var(--hema,#2F8A3B)}
.ed-b.pri{background:var(--hema,#2F8A3B);border-color:var(--hema,#2F8A3B);color:#fff}
.ed-b.bad{color:var(--bad,#c33)}
.ed-b.ic{min-width:36px;padding:7px 9px}
.ed-b[disabled]{opacity:.45;pointer-events:none}
/* кнопка включения */
.ed-fab{position:fixed;z-index:72;right:max(16px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:11px 16px;border-radius:999px;background:var(--ink,#0E4A38);color:var(--surface,#fff);font:700 14px var(--font-body,system-ui,sans-serif);box-shadow:0 10px 26px -10px rgba(0,0,0,.5)}
.ed-fab{position:fixed;z-index:72;right:max(16px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px))}
.ed-fab[hidden]{display:none}
.ed-fab svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
@media (max-width:820px){.ed-fab{bottom:calc(86px + env(safe-area-inset-bottom,0px))}}
:host(.reading) .ed-fab{bottom:max(20px,env(safe-area-inset-bottom,0px))}
/* верхняя панель режима правки */
.ed-bar{position:fixed;z-index:80;left:50%;transform:translateX(-50%);top:max(8px,env(safe-area-inset-top,0px));width:min(980px,calc(100vw - 16px));display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:16px;background:color-mix(in srgb,var(--surface,#fff) 96%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid var(--line,#ccc);box-shadow:0 16px 40px -18px rgba(0,0,0,.45);color:var(--ink,#123);font:14px/1.4 var(--font-body,system-ui,sans-serif)}
.ed-bar[hidden]{display:none}
.ed-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.ed-row .grow{flex:1 1 auto;min-width:0}
.ed-tag{font:700 11.5px/1 var(--font-body,system-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--eosin,#C2366B)}
.ed-hint{font-size:13px;color:var(--muted,#666);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ed-sep{width:1px;align-self:stretch;background:var(--line,#ccc);margin:0 2px}
.ed-link{display:flex;gap:6px;flex:1 1 260px}
.ed-link[hidden]{display:none}
.ed-in{box-sizing:border-box;width:100%;min-height:36px;padding:7px 10px;border-radius:10px;border:1px solid var(--line,#ccc);background:var(--surface-2,#f5f5f5);color:var(--ink,#123);font:14px var(--font-body,system-ui,sans-serif)}
.ed-in:focus{outline:2px solid var(--focus,#2C7BE5);outline-offset:1px}
/* окно вставки */
.ed-scrim{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.4);display:grid;place-items:center;padding:12px}
.ed-scrim[hidden]{display:none}
.ed-dlg{width:min(720px,100%);max-height:calc(100vh - 24px);overflow:auto;background:var(--surface,#fff);color:var(--ink,#123);border:1px solid var(--line,#ccc);border-radius:20px;box-shadow:0 30px 70px -20px rgba(0,0,0,.55);padding:18px;display:flex;flex-direction:column;gap:14px;font:15px/1.5 var(--font-body,system-ui,sans-serif)}
.ed-dlg h3{margin:0;font:700 18px/1.25 var(--font-display,var(--font-body,system-ui));color:var(--ink,#123)}
.ed-tabs{display:flex;flex-wrap:wrap;gap:6px}
.ed-pane[hidden]{display:none}
.ed-pane{display:flex;flex-direction:column;gap:12px}
.ed-rich{min-height:140px;max-height:46vh;overflow:auto;padding:12px 14px;border:1px solid var(--line,#ccc);border-radius:12px;background:var(--surface-2,#f7f7f7);color:var(--ink,#123);line-height:1.6}
.ed-rich:focus{outline:2px solid var(--focus,#2C7BE5);outline-offset:1px}
.ed-rich:empty:before{content:attr(data-ph);color:var(--muted,#888)}
.ed-cap{min-height:38px;padding:8px 12px}
.ed-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:150px;padding:16px;border:2px dashed var(--line,#ccc);border-radius:14px;text-align:center;color:var(--muted,#666);cursor:pointer;font-size:14px}
.ed-drop.over{border-color:var(--hema,#2F8A3B);background:color-mix(in srgb,var(--hema,#2F8A3B) 6%,transparent)}
.ed-drop b{color:var(--ink,#123);font-size:15px}
.ed-prev{display:flex;justify-content:center}
.ed-prev img,.ed-prev video{max-width:100%;max-height:300px;border-radius:12px;border:1px solid var(--line,#ccc);background:#fff}
.ed-lab{display:flex;flex-direction:column;gap:5px;font:600 12.5px var(--font-body,system-ui,sans-serif);letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#666)}
.ed-svgcode{min-height:120px;font:12.5px/1.45 ui-monospace,Menlo,monospace;resize:vertical}
.ed-msg{font-size:13.5px;color:var(--muted,#666);min-height:1em}
.ed-msg.bad{color:var(--bad,#c33)}
.ed-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;align-items:center}
.ed-foot .ed-msg{flex:1 1 200px}
.ed-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:edr .8s linear infinite}
@keyframes edr{to{transform:rotate(1turn)}}
.ed-toast{position:fixed;z-index:95;left:50%;transform:translateX(-50%);bottom:max(20px,env(safe-area-inset-bottom,0px));max-width:calc(100vw - 24px);padding:10px 16px;border-radius:12px;background:var(--ink,#123);color:var(--surface,#fff);font:600 14px var(--font-body,system-ui,sans-serif);box-shadow:0 12px 30px -12px rgba(0,0,0,.5)}
.ed-toast.bad{background:var(--bad,#b22)}
.ed-toast[hidden]{display:none}
@media (max-width:820px){.ed-toast{bottom:calc(150px + env(safe-area-inset-bottom,0px))}}
.ed-orph{display:flex;flex-direction:column;gap:8px}
.ed-orph div{display:flex;gap:8px;align-items:center;justify-content:space-between;border:1px solid var(--line,#ccc);border-radius:12px;padding:8px 10px;font-size:14px}
.ed-orph span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const IC={
 pen:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>'};
const ic=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

/* ---------- мелочи ---------- */
const toast=document.createElement('div');toast.className='ed-toast';toast.hidden=true;toast.setAttribute('role','status');R.appendChild(toast);
function say(t,bad){toast.textContent=t;toast.classList.toggle('bad',!!bad);toast.hidden=false;clearTimeout(say.t);say.t=setTimeout(()=>toast.hidden=true,bad?6000:2600)}
const errText=e=>{const c=e&&e.code;
  return c==='invalid_argument'?'База отклонила запись: проверьте, что вы вошли как владелец.':
    c==='quota_exceeded'?'Место в базе закончилось — удалите старые правки.':
    c==='resource_exhausted'||c==='rate_limited'?'Слишком часто — подождите пару секунд.':
    c==='too_large'?'Файл слишком большой: фото и видео до 20 МБ, SVG до 2 МБ.':
    c==='unsupported_type'?'Такой формат не поддерживается.':
    c==='quota_or_state'?'Хранилище файлов заполнено — удалите ненужные вставки.':
    'Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.'};
const sheetNow=()=>$$('.module:not([hidden]) .k-doc:not([hidden]) .k-sheet')[0]||null;
const modOf=el=>{const m=el&&el.closest('.module');return m?m.id.replace(/^m-/,''):null};
const opById=id=>KE.ops.find(o=>o._id===id)||null;
const sel=()=>{try{return R.getSelection?R.getSelection():document.getSelection()}catch(e){return document.getSelection()}};
const isText=el=>KE.isText(el);
function blockOf(el){const sec=el&&el.closest('.k-sec');if(!sec)return null;let b=el;while(b&&b.parentElement!==sec)b=b.parentElement;
  if(!b||b.tagName==='H2'||b.matches('.pe-mark,.sec-foot,.ed-ui'))return null;return b}

/* ---------- запись в базу ---------- */
async function put(data,id){
  const col=db.collection('kedits');const ref=id?col.doc(id):col.doc();
  const body=Object.assign({},data,{u:Date.now()});delete body._id;
  await ref.set(body);return ref.id}
async function del(id){await db.collection('kedits').doc(id).delete()}
async function safe(fn,okMsg){try{const r=await fn();if(okMsg)say(okMsg);return r}catch(e){console.warn(e);say(errText(e),true);return undefined}}

/* ---------- режим правки ---------- */
let on=false,cur=null,hov=null,live=null;
const fab=document.createElement('button');fab.className='ed-fab';fab.type='button';fab.hidden=true;
R.appendChild(fab);
const bar=document.createElement('div');bar.className='ed-bar ed-ui';bar.hidden=true;bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Правка конспекта');
R.appendChild(bar);
function fabSync(){const sh=sheetNow(),hid=!sh&&!on;if(fab.hidden!==hid)fab.hidden=hid;
  const st=on?'1':'0';if(fab.dataset.st!==st){fab.dataset.st=st;fab.innerHTML=ic('pen')+(on?'<span>Готово</span>':'<span>Править конспект</span>');fab.setAttribute('aria-pressed',String(on))}}
setInterval(()=>{fabSync();if(on){if(!sheetNow())setOn(false);else addEnds()}},900);fabSync();
fab.addEventListener('click',()=>setOn(!on));

function setOn(v){
  if(v===on)return;
  if(!v&&live)endLive(false);
  on=v;H.classList.toggle('ed-on',on);bar.hidden=!on;
  if(!on){pick(null);clearHov();$$('.ed-ui.ed-end').forEach(n=>n.remove())}
  else{say('Режим правки: нажмите на абзац, рисунок или «＋» в конце раздела');addEnds();pick(null)}
  fabSync()}
function addEnds(){const sh=sheetNow();if(!sh||!on)return;
  sh.querySelectorAll('.k-sec').forEach(sec=>{if(sec.querySelector(':scope>.ed-end'))return;
    const d=document.createElement('div');d.className='ed-ui ed-end';
    d.innerHTML=`<button type="button">${'＋'} Добавить в конец раздела</button>`;
    d.querySelector('button').addEventListener('click',e=>{e.stopPropagation();dlg.show({at:{s:sec.dataset.sec,end:1},sheet:sh})});
    const endEl=sec.querySelector(':scope>.pe-mark')||sec.querySelector(':scope>.sec-foot');sec.insertBefore(d,endEl)})}
KE.on(()=>{if(on){addEnds();if(cur&&!cur.isConnected)pick(null);else drawBar()}});

/* наведение и выбор */
function clearHov(){if(hov){hov.classList.remove('ed-hov');hov=null}}
function targetOf(t){
  if(!t||!t.closest)return null;
  const sheet=t.closest('.k-sheet');if(!sheet||t.closest('.ed-ui'))return null;
  const blk=t.closest('.ed-blk');if(blk)return blk;
  for(let n=t.nodeType===1?t:t.parentElement;n&&n!==sheet&&!n.matches('.k-sec');n=n.parentElement){if(isText(n))return n}
  return blockOf(t)}
R.addEventListener('pointerover',e=>{if(!on||live)return;const el=targetOf(BV_ET(e));if(el===hov)return;clearHov();if(el&&el!==cur){hov=el;el.classList.add('ed-hov')}});
R.addEventListener('click',e=>{if(!on||live)return;const t=BV_ET(e);
  if(t.closest&&(t.closest('.ed-ui,.ed-bar,.ed-fab,.ed-scrim')))return;
  if(!t.closest||!t.closest('.k-sheet'))return;
  // кнопки и поля внутри интерактивных рисунков продолжают работать
  if(t.closest('input,select,textarea,label,.k-opt,.k-chk,.k-rst,.k-show,.k-dots,.k-prev,.k-next,.k-play,.kf-ctl,video')&&!t.closest('.ed-blk'))return;
  const el=targetOf(t);if(!el)return;
  if(t.closest('a'))e.preventDefault();
  e.stopPropagation();pick(el===cur?null:el)},true);
R.addEventListener('dblclick',e=>{if(!on||live)return;const el=targetOf(BV_ET(e));if(el&&isText(el)){e.preventDefault();pick(el);startLive(el)}},true);
document.addEventListener('keydown',e=>{if(!on)return;
  if(e.key==='Escape'){if(dlg.open)return;if(live){e.preventDefault();endLive(false)}else if(cur){pick(null)}}},true);

function pick(el){if(cur)cur.classList.remove('ed-sel');cur=el;clearHov();if(cur)cur.classList.add('ed-sel');drawBar()}

/* ---------- верхняя панель ---------- */
function kindOf(el){if(!el)return '';if(el.classList.contains('ed-blk'))return 'ins';if(isText(el))return 'text';return 'block'}
function labelOf(el){const k=kindOf(el);
  if(k==='ins'){const o=opById(el.dataset.ed),b=o&&o.b||{};return {text:'Ваш текстовый блок',img:'Ваше фото',svg:'Ваш векторный рисунок',video:'Ваше видео'}[b.k]||'Ваш блок'}
  if(k==='text'){const t=(el.textContent||'').trim().replace(/\s+/g,' ');return '«'+(t.length>70?t.slice(0,70)+'…':t)+'»'}
  if(el.matches('.k-q'))return 'Вопрос с проверкой';if(el.matches('[data-fig],.kf'))return 'Интерактивный рисунок';
  return 'Блок конспекта'}
function drawBar(){if(!on){bar.hidden=true;return}bar.hidden=false;
  const sh=sheetNow(),mod=sh&&modOf(sh),res=mod&&KE.results[mod],orph=res?res.orphans.length:0,n=mod?(KE.byMod[mod]||[]).length:0;
  const top=`<div class="ed-row"><span class="ed-tag">Режим правки</span><span class="ed-hint grow">${n?'Правок в этом конспекте: '+n:'Пока без правок'}${!KE.ready?' · база ещё загружается':''}</span>
    ${orph?`<button class="ed-b bad" data-a="orph">Потерянные: ${orph}</button>`:''}
    ${n?`<button class="ed-b" data-a="resetall">Сбросить все правки</button>`:''}
    <button class="ed-b pri" data-a="done">Готово</button></div>`;
  let row='';
  if(live){row=`<div class="ed-row">
     <button class="ed-b ic" data-c="bold" title="Жирный"><b>Ж</b></button><button class="ed-b ic" data-c="italic" title="Курсив"><i>К</i></button><button class="ed-b ic" data-c="underline" title="Подчёркнутый"><u>Ч</u></button>
     <button class="ed-b ic" data-c="superscript" title="Верхний индекс">x²</button><button class="ed-b ic" data-c="subscript" title="Нижний индекс">x₂</button>
     <button class="ed-b ic" data-c="mark" title="Выделить маркером">▮</button><button class="ed-b ic" data-c="link" title="Ссылка">🔗</button><button class="ed-b ic" data-c="removeFormat" title="Убрать форматирование">⌫</button>
     <span class="ed-sep"></span><button class="ed-b" data-a="cancel">Отмена</button><button class="ed-b pri" data-a="save">Сохранить</button></div>
     <div class="ed-row ed-link" hidden><input class="ed-in" type="url" placeholder="https://…" aria-label="Адрес ссылки"><button class="ed-b" data-a="linkok">Вставить</button></div>`}
  else if(cur){const k=kindOf(cur),hid=cur.hasAttribute('data-ed-h'),edt=cur.hasAttribute('data-ed-t'),canIns=k==='ins'||!!blockOf(cur);
    row=`<div class="ed-row"><span class="ed-hint grow">${esc(labelOf(cur))}${hid?' · скрыт':''}${edt?' · изменён':''}</span>
     ${k==='text'&&!hid?`<button class="ed-b" data-a="edit">✎ Изменить текст</button>`:''}
     ${k==='ins'?`<button class="ed-b" data-a="editins">✎ Изменить</button>`:''}
     ${canIns&&!hid?`<button class="ed-b" data-a="add">＋ Вставить после</button>`:''}
     ${edt?`<button class="ed-b" data-a="restore">↺ Исходный текст</button>`:''}
     ${k!=='ins'?(hid?`<button class="ed-b" data-a="unhide">Показать снова</button>`:`<button class="ed-b" data-a="hide">Скрыть</button>`):''}
     ${k==='ins'?`<button class="ed-b bad" data-a="delins">Удалить</button>`:''}
     <button class="ed-b ic" data-a="unpick" aria-label="Снять выбор">×</button></div>`}
  else row=`<div class="ed-row"><span class="ed-hint">Нажмите на абзац, заголовок, рисунок или вопрос. Двойной клик — сразу править текст.</span></div>`;
  bar.innerHTML=top+row}

/* кнопки форматирования не должны забирать выделение */
bar.addEventListener('mousedown',e=>{const b=BV_ET(e).closest&&BV_ET(e).closest('[data-c]');if(b)e.preventDefault()});
let savedRange=null;
bar.addEventListener('click',async e=>{const t=BV_ET(e);const b=t.closest&&t.closest('button');if(!b)return;
  const c=b.dataset.c,a=b.dataset.a;
  if(c)return fmt(c,b);
  const sh=sheetNow();
  if(a==='done')return setOn(false);
  if(a==='unpick')return pick(null);
  if(a==='save')return endLive(true);
  if(a==='cancel')return endLive(false);
  if(a==='linkok')return linkApply();
  if(a==='orph')return orphDlg();
  if(a==='resetall')return resetAll(b);
  if(!cur)return;
  if(a==='edit')return startLive(cur);
  if(a==='editins'){const o=opById(cur.dataset.ed);if(o)dlg.show({op:o,sheet:sh});return}
  if(a==='add'){const at=anchorFor(cur);if(at)dlg.show({at,sheet:sh});return}
  if(a==='hide'){const direct=cur.parentElement&&cur.parentElement.classList.contains('k-sec'),bo=blockOf(cur);
    const tg=KE.keyOf(cur,direct?'b':(isText(cur)?'t':'b'))||(bo?KE.keyOf(bo,'b'):null);
    if(!tg)return say('Этот элемент нельзя скрыть',true);
    await safe(()=>put({mod:modOf(cur),t:'hide',tg,ord:Date.now()}),'Скрыто. Ученики его не увидят.');return}
  if(a==='unhide'){const id=cur.getAttribute('data-ed-h');if(id)await safe(()=>del(id),'Снова виден');return}
  if(a==='restore'){const id=cur.getAttribute('data-ed-t');if(id)await safe(()=>del(id),'Возвращён исходный текст');return}
  if(a==='delins')return delIns(cur,b)});

function anchorFor(el){
  if(el.classList.contains('ed-blk'))return {ed:el.dataset.ed};
  const b=blockOf(el);if(!b)return null;
  return KE.keyOf(b,'b')}

/* ---------- правка текста на месте ---------- */
function startLive(el){
  if(live)endLive(false);
  if(!isText(el))return;
  const tg=KE.keyOf(el,'t');if(!tg)return say('Этот текст нельзя изменить',true);
  KE.hold=true;
  live={el,tg,id:el.getAttribute('data-ed-t'),before:el.innerHTML,orig:el._edO!=null?el._edO:el.innerHTML};
  pick(el);
  el.classList.add('ed-live');el.contentEditable='true';el.spellcheck=true;
  el.addEventListener('keydown',liveKey);el.addEventListener('paste',livePaste);
  drawBar();
  requestAnimationFrame(()=>{el.focus({preventScroll:true});try{const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=sel();s.removeAllRanges();s.addRange(r)}catch(e){}})}
function liveKey(e){
  if(e.key==='Enter'&&!e.shiftKey&&(e.ctrlKey||e.metaKey)){e.preventDefault();endLive(true);return}
  if(e.key==='Enter'){e.preventDefault();try{document.execCommand('insertLineBreak')||document.execCommand('insertHTML',false,'<br>')}catch(er){}}}
function livePaste(e){e.preventDefault();const t=(e.clipboardData||window.clipboardData).getData('text/plain')||'';try{document.execCommand('insertText',false,t)}catch(er){}}
async function endLive(save){
  const L=live;if(!L)return;live=null;
  const el=L.el;el.removeEventListener('keydown',liveKey);el.removeEventListener('paste',livePaste);
  el.contentEditable='false';el.removeAttribute('contenteditable');el.classList.remove('ed-live');
  const html=KE.clean(el.innerHTML,false);
  if(!save||html===KE.clean(L.before,false)){el.innerHTML=L.before;release();drawBar();return}
  if(!el.textContent.trim()&&!/<br/i.test(html)){el.innerHTML=L.before;release();say('Пустой текст не сохраняю — чтобы убрать абзац, нажмите «Скрыть».',true);drawBar();return}
  el.innerHTML=html;
  if(html===KE.clean(L.orig,false)){release();if(L.id)await safe(()=>del(L.id),'Возвращён исходный текст');drawBar();return}
  const prev=L.id?opById(L.id):null;
  const ok=await safe(()=>put({mod:modOf(el),t:'text',tg:prev?prev.tg:L.tg,html,ord:prev?prev.ord:Date.now()},L.id||undefined),'Сохранено');
  if(ok===undefined)el.innerHTML=L.before;
  release();drawBar()}
function release(){KE.hold=false;if(KE.pending)KE.apply()}

function fmt(c,btn){
  const el=live?live.el:(dlg.open?dlg.rich():null);if(!el)return;
  el.focus({preventScroll:true});
  try{
    if(c==='link'){const s=sel();savedRange=s.rangeCount?s.getRangeAt(0).cloneRange():null;
      const box=(live?bar:dlg.box).querySelector('.ed-link');if(box){box.hidden=!box.hidden;if(!box.hidden){const i=box.querySelector('input');i.value='https://';i.focus()}}return}
    if(c==='mark'){const s=sel();if(!s.rangeCount||s.isCollapsed)return say('Сначала выделите слова');
      const t=s.toString();document.execCommand('insertHTML',false,'<mark>'+esc(t)+'</mark>');return}
    if(c==='h3'||c==='p'||c==='blockquote'){document.execCommand('formatBlock',false,c);return}
    document.execCommand(c,false,null)}catch(e){}}
function linkApply(){
  const box=(live?bar:dlg.box).querySelector('.ed-link');if(!box)return;const url=box.querySelector('input').value.trim();
  if(!/^https?:\/\/\S+\.\S+/i.test(url)){say('Ссылка должна начинаться с https://',true);return}
  const el=live?live.el:dlg.rich();el.focus({preventScroll:true});
  try{const s=sel();if(savedRange){s.removeAllRanges();s.addRange(savedRange)}
    if(s.isCollapsed)document.execCommand('insertHTML',false,`<a href="${esc(url)}">${esc(url)}</a>`);else document.execCommand('createLink',false,url)}catch(e){}
  box.hidden=true}

/* ---------- удаление вставок и сброс ---------- */
async function delIns(el,btn){
  if(btn.dataset.arm!=='1'){btn.dataset.arm='1';btn.textContent='Точно удалить?';setTimeout(()=>{if(btn.isConnected){btn.dataset.arm='';btn.textContent='Удалить'}},4000);return}
  const id=el.dataset.ed,o=opById(id);if(!o)return;
  // блоки, привязанные к удаляемому, переезжают на его место
  const kids=KE.ops.filter(x=>x.t==='ins'&&x.at&&x.at.ed===id);
  KE.hold=true;
  try{for(const k of kids)await put(Object.assign({},k,{at:o.at}),k._id);
    await del(id);pick(null);say('Блок удалён')}catch(e){say(errText(e),true)}
  release();
  if(o.b&&o.b.a&&assets)try{await assets.delete(o.b.a)}catch(e){}}
async function resetAll(btn){
  if(btn.dataset.arm!=='1'){btn.dataset.arm='1';btn.textContent='Удалить все правки конспекта? Ещё раз';setTimeout(()=>{if(btn.isConnected){btn.dataset.arm='';btn.textContent='Сбросить все правки'}},5000);return}
  const sh=sheetNow(),mod=sh&&modOf(sh);if(!mod)return;const L=(KE.byMod[mod]||[]).slice();
  KE.hold=true;let n=0;
  for(const o of L){try{await del(o._id);n++;if(o.b&&o.b.a&&assets)try{await assets.delete(o.b.a)}catch(e){}}catch(e){}}
  release();pick(null);say(n===L.length?'Конспект вернулся к исходному виду':'Часть правок удалить не удалось',n!==L.length)}

/* ---------- окно «потерянных» правок ---------- */
function orphDlg(){const sh=sheetNow(),mod=sh&&modOf(sh),res=mod&&KE.results[mod];if(!res)return;
  const nm=o=>o.t==='text'?'Изменённый текст: «'+KE.clean(o.html,false).replace(/<[^>]+>/g,'').slice(0,60)+'»':o.t==='hide'?'Скрытый элемент':'Вставка ('+({text:'текст',img:'фото',svg:'SVG',video:'видео'}[o.b&&o.b.k]||'блок')+') — показана в конце раздела';
  dlg.custom(`<h3>Потерянные правки</h3><p class="ed-msg">Исходный конспект изменился, и эти правки больше не находят своё место. Вставки показываются в конце своего раздела — их можно удалить и добавить заново в нужное место.</p>
   <div class="ed-orph">${res.orphans.map(o=>`<div><span>${esc(nm(o))}</span><button class="ed-b bad" data-del="${esc(o._id)}">Удалить</button></div>`).join('')}</div>
   <div class="ed-foot"><button class="ed-b" data-a="close">Закрыть</button></div>`,box=>{
    box.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{const o=opById(b.dataset.del);await safe(()=>del(b.dataset.del),'Удалено');
      if(o&&o.b&&o.b.a&&assets)try{await assets.delete(o.b.a)}catch(e){}b.closest('div').remove()}))})}

/* ---------- подготовка файлов ---------- */
const MB=1048576;
const IMG_T=['image/png','image/jpeg','image/webp','image/gif'],VID_T=['video/mp4','video/webm'];
function extType(f){const n=(f.name||'').toLowerCase();
  if(/\.svg$/.test(n))return 'image/svg+xml';if(/\.png$/.test(n))return 'image/png';if(/\.jpe?g$/.test(n))return 'image/jpeg';
  if(/\.webp$/.test(n))return 'image/webp';if(/\.gif$/.test(n))return 'image/gif';if(/\.mp4$|\.m4v$/.test(n))return 'video/mp4';if(/\.webm$/.test(n))return 'video/webm';
  if(/\.mov$/.test(n))return 'video/quicktime';if(/\.hei[cf]$/.test(n))return 'image/heic';return ''}
const typeOf=f=>{const t=(f.type||'').split(';')[0].trim().toLowerCase();return t==='image/jpg'?'image/jpeg':t||extType(f)};
/* большие фото уменьшаем до 2400 px по длинной стороне — страница грузится быстрее */
async function shrink(file,type){
  if(type==='image/gif'||type==='image/svg+xml')return file;
  let bmp=null;try{bmp=await createImageBitmap(file)}catch(e){return file}
  const W=bmp.width,Hh=bmp.height,max=2400,big=Math.max(W,Hh)>max;
  if(!big&&file.size<1.5*MB){bmp.close&&bmp.close();return file}
  const k=big?max/Math.max(W,Hh):1,c=document.createElement('canvas');c.width=Math.round(W*k);c.height=Math.round(Hh*k);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close&&bmp.close();
  const out=await new Promise(r=>{try{c.toBlob(b=>r(b),type==='image/png'?'image/webp':'image/jpeg',.86)}catch(e){r(null)}});
  return out&&out.size<file.size?out:file}
async function upload(blob,type){
  if(!assets)throw {code:'capability_disabled'};
  let last;for(let i=0;i<2;i++){try{return await assets.upload(blob,{type})}catch(e){last=e;if(e&&e.code==='store_unavailable'){await new Promise(r=>setTimeout(r,900));continue}throw e}}throw last}

/* ---------- окно вставки / изменения блока ---------- */
const dlg=(()=>{
  const scrim=document.createElement('div');scrim.className='ed-scrim ed-ui';scrim.hidden=true;R.appendChild(scrim);
  const box=document.createElement('div');box.className='ed-dlg';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');scrim.appendChild(box);
  let ctx=null,tab='text',file=null,ftype='',url='',busy=false,w='m';
  let lastRich=null;
  box.addEventListener('focusin',e=>{const t=BV_ET(e);if(t&&t.classList&&t.classList.contains('ed-rich'))lastRich=t});
  const api={get open(){return !scrim.hidden},box,rich:()=>(lastRich&&lastRich.isConnected?lastRich:null)||box.querySelector('.ed-rich:not(.ed-cap)')||box.querySelector('.ed-rich')};
  function close(){if(busy)return;scrim.hidden=true;box.innerHTML='';if(url)URL.revokeObjectURL(url);url='';file=null;ctx=null;KE.hold=false;if(KE.pending)KE.apply()}
  scrim.addEventListener('mousedown',e=>{if(BV_ET(e)===scrim)close()});
  box.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}});
  box.addEventListener('mousedown',e=>{const b=BV_ET(e).closest&&BV_ET(e).closest('[data-c]');if(b)e.preventDefault()});
  const TB=(full)=>`<div class="ed-row">
     <button class="ed-b ic" data-c="bold" title="Жирный"><b>Ж</b></button><button class="ed-b ic" data-c="italic" title="Курсив"><i>К</i></button><button class="ed-b ic" data-c="underline" title="Подчёркнутый"><u>Ч</u></button>
     <button class="ed-b ic" data-c="superscript" title="Верхний индекс">x²</button><button class="ed-b ic" data-c="subscript" title="Нижний индекс">x₂</button>
     <button class="ed-b ic" data-c="mark" title="Маркер">▮</button><button class="ed-b ic" data-c="link" title="Ссылка">🔗</button>
     ${full?`<span class="ed-sep"></span><button class="ed-b" data-c="h3">Заголовок</button><button class="ed-b" data-c="p">Абзац</button><button class="ed-b ic" data-c="insertUnorderedList" title="Список">•</button><button class="ed-b ic" data-c="insertOrderedList" title="Нумерованный список">1.</button><button class="ed-b" data-c="blockquote">Заметка</button>`:''}
     <button class="ed-b ic" data-c="removeFormat" title="Убрать форматирование">⌫</button></div>
     <div class="ed-row ed-link" hidden><input class="ed-in" type="url" placeholder="https://…" aria-label="Адрес ссылки"><button class="ed-b" data-a="linkok">Вставить</button></div>`;
  const WSEL=()=>`<div class="ed-lab">Ширина<div class="ed-row">${[['s','Узко'],['m','Средне'],['l','Во всю ширину']].map(([k,n])=>`<button class="ed-b" data-w="${k}" aria-pressed="${w===k}">${n}</button>`).join('')}</div></div>`;
  const CAP=v=>`<div class="ed-lab">Подпись (необязательно)<div class="ed-rich ed-cap" contenteditable="true" data-ph="Например: Рис. 1. Строение бактериальной клетки" data-cap>${v||''}</div></div>`;
  function render(){
    const op=ctx.op,b=op?op.b||{}:{},ed=!!op;
    const media=tab!=='text';
    const tabs=ed?'':`<div class="ed-tabs" role="tablist">${[['text','Текст'],['img','Фото'],['svg','Векторный рисунок'],['video','Видео']].map(([k,n])=>`<button class="ed-b" role="tab" data-tab="${k}" aria-pressed="${tab===k}">${n}</button>`).join('')}</div>`;
    let pane='';
    if(tab==='text')pane=`<div class="ed-pane">${TB(true)}<div class="ed-rich" contenteditable="true" data-ph="Напишите текст. Можно вставить из Word или Документов — лишнее оформление уберётся.">${ed?KE.clean(b.html,true):''}</div></div>`;
    else if(!assets)pane=`<div class="ed-pane"><p class="ed-msg bad">Загрузка файлов на сайте пока не подключена. Картинку можно положить в папку bioviz/img проекта и вставить через VS Code.</p></div>`;
    else{
      const acc=tab==='img'?'image/png,image/jpeg,image/webp,image/gif':tab==='svg'?'image/svg+xml,.svg':'video/mp4,video/webm,.mp4,.webm,.m4v';
      const hint=tab==='img'?'PNG, JPG, WebP или GIF, до 20 МБ. Большие фото уменьшатся сами. Можно вставить картинку из буфера (Ctrl+V).':tab==='svg'?'Файл .svg до 2 МБ — или вставьте код SVG ниже. Векторный рисунок остаётся чётким при любом масштабе.':'MP4 или WebM, до 20 МБ. Видео с iPhone (.mov) сначала сохраните как MP4.';
      const cur=file?`<div class="ed-prev">${tab==='video'?`<video src="${url}" controls playsinline preload="metadata"></video>`:`<img src="${url}" alt="">`}</div>`:
        (ed&&b.a?`<div class="ed-prev">${tab==='video'?`<video src="/_blob/${esc(b.a)}" controls playsinline preload="metadata"></video>`:`<img src="/_blob/${esc(b.a)}" alt="">`}</div>`:'');
      pane=`<div class="ed-pane">
        <label class="ed-drop" tabindex="0"><b>${file||ed?'Заменить файл':'Выберите файл'}</b><span>или перетащите сюда</span><span style="font-size:12.5px">${hint}</span><input type="file" accept="${acc}" hidden></label>
        ${cur}
        ${tab==='svg'?`<label class="ed-lab">Код SVG<textarea class="ed-in ed-svgcode" spellcheck="false" placeholder="<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 400 300&quot;>…</svg>"></textarea></label>`:''}
        ${WSEL()}
        ${tab!=='video'?`<label class="ed-lab">Описание для экранного чтеца (необязательно)<input class="ed-in" data-alt maxlength="300" value="${esc(b.alt||'')}"></label>`:''}
        ${CAP(ed?KE.clean(b.cap,false):'')}</div>`}
    box.innerHTML=`<h3>${ed?'Изменить блок':'Вставить в конспект'}</h3>${tabs}${pane}
      <div class="ed-foot"><span class="ed-msg" aria-live="polite"></span><button class="ed-b" data-a="close">Отмена</button><button class="ed-b pri" data-a="ok">${ed?'Сохранить':'Вставить'}</button></div>`;
    const fi=box.querySelector('input[type=file]');
    if(fi){const dz=box.querySelector('.ed-drop');
      fi.addEventListener('change',()=>{if(fi.files[0])take(fi.files[0])});
      dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fi.click()}});
      dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});
      dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
      dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');const f=e.dataTransfer&&e.dataTransfer.files[0];if(f)take(f)})}
    const r=box.querySelector('.ed-rich:not(.ed-cap)');if(r)r.addEventListener('paste',richPaste);
    const cp=box.querySelector('[data-cap]');if(cp){cp.addEventListener('paste',e=>{e.preventDefault();document.execCommand('insertText',false,(e.clipboardData.getData('text/plain')||'').replace(/\s+/g,' '))});
      cp.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault()})}
    setTimeout(()=>{const f=box.querySelector('.ed-rich:not(.ed-cap)')||box.querySelector('.ed-drop');f&&f.focus({preventScroll:true})},30)}
  function richPaste(e){const cd=e.clipboardData;if(!cd)return;e.preventDefault();
    const html=cd.getData('text/html');
    if(html)document.execCommand('insertHTML',false,KE.clean(html.replace(/<!--[\s\S]*?-->/g,''),true));
    else{const t=cd.getData('text/plain')||'';document.execCommand('insertHTML',false,t.split(/\n{2,}/).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join(''))}}
  function msg(t,bad){const m=box.querySelector('.ed-foot .ed-msg');if(m){m.textContent=t;m.classList.toggle('bad',!!bad)}}
  async function take(f){
    let t=typeOf(f);
    const want=tab==='img'?IMG_T:tab==='svg'?['image/svg+xml']:VID_T;
    if(t==='image/svg+xml'&&tab==='img'){tab='svg'}
    else if(IMG_T.includes(t)&&tab!=='img'&&!(tab==='svg')){tab='img'}
    if(t==='video/quicktime')return msg('Формат .mov не поддерживается. Сохраните видео как MP4 (на iPhone: «Настройки → Камера → Форматы → Наиболее совместимый»).',true);
    if(t==='image/heic')return msg('HEIC не поддерживается. Сохраните фото как JPG или PNG.',true);
    const allow=tab==='img'?IMG_T:tab==='svg'?['image/svg+xml']:VID_T;
    if(!allow.includes(t))return msg('Этот формат сюда не подходит.',true);
    const lim=t==='image/svg+xml'?2*MB:20*MB;
    if(t.startsWith('video/')&&f.size>lim)return msg(`Видео ${(f.size/MB).toFixed(1)} МБ — больше 20 МБ. Сожмите его или обрежьте.`,true);
    if(t==='image/svg+xml'){const s=await f.text();if(!/<svg[\s>]/i.test(s))return msg('Это не SVG-файл.',true);if(f.size>lim)return msg('SVG больше 2 МБ.',true)}
    let blob=f;
    if(t.startsWith('image/')&&t!=='image/svg+xml'){msg('Готовлю фото…');blob=await shrink(f,t);if(blob!==f)t=blob.type||t;if(blob.size>lim)return msg('Фото больше 20 МБ даже после сжатия.',true)}
    if(url)URL.revokeObjectURL(url);file=blob;ftype=t;url=URL.createObjectURL(blob);
    const keepCap=box.querySelector('[data-cap]')?box.querySelector('[data-cap]').innerHTML:'',keepAlt=box.querySelector('[data-alt]')?box.querySelector('[data-alt]').value:'';
    render();const cp=box.querySelector('[data-cap]');if(cp)cp.innerHTML=keepCap;const al=box.querySelector('[data-alt]');if(al)al.value=keepAlt;
    msg(blob!==f?`Фото уменьшено до ${(blob.size/MB).toFixed(1)} МБ`:'')}
  box.addEventListener('paste',e=>{if(tab==='text'||!assets)return;const it=[...(e.clipboardData&&e.clipboardData.items||[])].find(i=>i.kind==='file');
    if(it){e.preventDefault();const f=it.getAsFile();if(f)take(f)}});
  box.addEventListener('click',async e=>{const t=BV_ET(e),b=t.closest&&t.closest('button');if(!b)return;
    if(b.dataset.c)return fmt(b.dataset.c,b);
    if(b.dataset.tab){if(file&&b.dataset.tab!==tab){file=null}tab=b.dataset.tab;render();return}
    if(b.dataset.w){w=b.dataset.w;box.querySelectorAll('[data-w]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.w===w)));return}
    const a=b.dataset.a;if(a==='close')return close();if(a==='linkok')return linkApply();if(a==='ok')return submit(b)});
  async function submit(btn){if(busy)return;
    const op=ctx.op,old=op?op.b||{}:{};
    const capEl=box.querySelector('[data-cap]'),cap=capEl?KE.clean(capEl.innerHTML,false):'';
    const altEl=box.querySelector('[data-alt]'),alt=altEl?altEl.value.trim().slice(0,300):'';
    let blk;
    if(tab==='text'){const html=KE.clean(box.querySelector('.ed-rich').innerHTML,true);
      if(!html.replace(/<[^>]+>/g,'').trim())return msg('Напишите текст.',true);
      if(html.length>200000)return msg('Текст слишком длинный — разбейте на несколько блоков.',true);
      blk={k:'text',html}}
    else{
      if(!assets)return msg('Загрузка файлов недоступна.',true);
      if(tab==='svg'&&!file){const code=(box.querySelector('.ed-svgcode')||{}).value||'';
        if(code.trim()){const s=code.trim().replace(/^﻿/,'');if(!/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(s))return msg('Код должен начинаться с <svg …>.',true);
          let src=s;if(!/xmlns=/.test(src))src=src.replace(/<svg/i,'<svg xmlns="http://www.w3.org/2000/svg"');
          const bl=new Blob([src],{type:'image/svg+xml'});if(bl.size>2*MB)return msg('SVG больше 2 МБ.',true);file=bl;ftype='image/svg+xml'}}
      if(!file&&!old.a)return msg('Выберите файл.',true);
      blk={k:tab,a:old.a||'',w,cap,alt:tab==='video'?'':alt}}
    busy=true;btn.disabled=true;btn.innerHTML='<span class="ed-spin"></span> Сохраняю…';
    let newAsset=null;
    try{
      if(file&&tab!=='text'){msg('Загружаю файл…');const r=await upload(file,ftype);newAsset=r.id;blk.a=r.id}
      const mod=op?op.mod:modOf(ctx.sheet);
      if(!mod)throw {code:'no_mod'};
      if(op)await put(Object.assign({},op,{b:blk}),op._id);
      else await put({mod,t:'ins',at:ctx.at,b:blk,ord:Date.now()});
      if(op&&newAsset&&old.a&&old.a!==newAsset)try{await assets.delete(old.a)}catch(e){}
      busy=false;say(op?'Блок обновлён':'Добавлено в конспект');close()}
    catch(e){console.warn(e);busy=false;btn.disabled=false;btn.textContent=op?'Сохранить':'Вставить';
      if(newAsset)try{await assets.delete(newAsset)}catch(er){}
      msg(e&&e.code==='no_mod'?'Не нашёл, в какой конспект вставлять. Откройте конспект заново.':errText(e),true)}}
  api.show=c=>{ctx=c;file=null;if(url)URL.revokeObjectURL(url);url='';
    const b=c.op&&c.op.b||{};tab=c.op?(b.k||'text'):'text';w=/^[sml]$/.test(b.w)?b.w:'m';
    KE.hold=true;scrim.hidden=false;render()};
  api.custom=(html,init)=>{ctx={};KE.hold=false;scrim.hidden=false;box.innerHTML=html;
    box.querySelector('[data-a="close"]').addEventListener('click',()=>{scrim.hidden=true;box.innerHTML=''});init&&init(box)};
  api.tabs=()=>{if(ctx&&ctx.at!==undefined||ctx&&ctx.op)render()};
  return api})();
})();
