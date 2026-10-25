/* Правки конспектов: показ для всех.
   Правки владельца лежат в базе артефакта (коллекция kedits, читать могут все, писать — только владелец).
   Этот модуль только накладывает их поверх готового конспекта: исходный текст в коде не меняется,
   а любая ошибка в одной правке пропускается и не ломает страницу.
   Редактор (bioviz/x/kedit.js) грузится отдельно и только у владельца. */
(function(){
if(!window.BV||!window.BVHOST)return;
const R=BVHOST.root,{$$}=BV;

const CSS=`
.ed-hid{display:none!important}
.ed-blk{margin:14px 0;min-width:0}
.ed-text>:first-child{margin-top:0}.ed-text>:last-child{margin-bottom:0}
.ed-text blockquote,.ed-note{margin:12px 0;padding:10px 14px;border-left:3px solid var(--hema,#2F8A3B);background:var(--surface-2,rgba(0,0,0,.04));border-radius:0 10px 10px 0}
.ed-fig{display:flex;flex-direction:column;align-items:center;gap:8px;margin:18px auto}
.ed-fig img,.ed-fig video{display:block;max-width:100%;height:auto;border-radius:12px;border:1px solid var(--line,#ddd);background:var(--surface,#fff)}
.ed-fig.w-s img,.ed-fig.w-s video{width:min(340px,100%)}
.ed-fig.w-m img,.ed-fig.w-m video{width:min(560px,100%)}
.ed-fig.w-l img,.ed-fig.w-l video{width:100%}
.ed-fig.k-svg img{background:#fff;padding:6px}
.ed-fig figcaption{font-size:.9em;line-height:1.45;color:var(--muted,#666);text-align:center;max-width:640px}
.ed-miss{width:100%;padding:16px;border:1px dashed var(--line,#ccc);border-radius:12px;color:var(--muted,#777);font-size:14px;text-align:center}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

/* ---------- очистка HTML: только безопасное форматирование ---------- */
const INL=new Set(['B','STRONG','I','EM','U','S','SUB','SUP','MARK','BR','A','CODE','SPAN','SMALL','ABBR','VAR','CITE','Q','KBD','DFN']);
const BLK=new Set(['P','H3','H4','UL','OL','LI','BLOCKQUOTE','DIV']);
function clean(html,rich){
  const t=document.createElement('template');t.innerHTML=String(html||'');
  const walk=node=>{[...node.childNodes].forEach(n=>{
    if(n.nodeType===3)return;
    if(n.nodeType!==1){n.remove();return}
    const tg=n.tagName;
    if(/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|svg|SVG|MATH|TEMPLATE|FORM|INPUT|BUTTON|TEXTAREA|SELECT|IMG|VIDEO|AUDIO|CANVAS)$/.test(tg)){n.remove();return}
    walk(n);
    const ok=INL.has(tg)||(rich&&BLK.has(tg));
    if(!ok){n.replaceWith(...n.childNodes);return}
    let el=n;
    if(tg==='DIV'){const p=document.createElement('p');p.append(...n.childNodes);n.replaceWith(p);el=p}
    const keep={};
    if(tg==='A'){const h=(n.getAttribute('href')||'').trim();if(/^(https?:|mailto:)/i.test(h))keep.href=h}
    if(tg==='BLOCKQUOTE'&&n.classList.contains('ed-note'))keep.class='ed-note';
    else if(INL.has(tg)&&tg!=='A'){const c=(n.getAttribute('class')||'').trim();if(c&&/^[\w -]{1,80}$/.test(c)&&!/\bed-/.test(c))keep.class=c}
    [...el.attributes].forEach(a=>el.removeAttribute(a.name));
    Object.entries(keep).forEach(([k,v])=>el.setAttribute(k,v));
    if(tg==='A'&&keep.href){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer')}
    if(tg==='SPAN'&&!el.attributes.length)el.replaceWith(...el.childNodes)})};
  walk(t.content);
  return t.innerHTML.trim()}

/* ---------- адресация элементов конспекта ---------- */
const TXT='p,li,h3,h4,h5,td,th,dt,dd,figcaption,blockquote';
const BAD='.k-q,[data-fig],.kf,svg,button,.ed-blk,.ed-ui,.k-ctoc,.k-toc,.pe-mark,.sec-foot,summary,.k-end,.k-ans,.k-qa';
const INNER='button,input,select,textarea,svg,canvas,video,img,iframe,.k-q,[data-fig],.kf';
function hash(s){s=String(s||'').replace(/\s+/g,' ').trim().slice(0,600);let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
/* исходный текст элемента: правленые куски подменяются оригиналом, вставки не считаются */
function orig(el){
  if(el._edT!=null)return el._edT;
  if(!el.querySelector('[data-ed-t],.ed-blk'))return el.textContent;
  const c=el.cloneNode(true),src=el.querySelectorAll('[data-ed-t]'),dst=c.querySelectorAll('[data-ed-t]');
  dst.forEach((d,i)=>{const s=src[i];d.textContent=s&&s._edT!=null?s._edT:d.textContent});
  c.querySelectorAll('.ed-blk').forEach(n=>n.remove());return c.textContent}
function scopeOf(sheet,s){
  if(s==='_title')return sheet.querySelector('.k-title');
  const esc=window.CSS&&CSS.escape?CSS.escape(s):String(s).replace(/["\\]/g,'\\$&');
  return sheet.querySelector('.k-sec[data-sec="'+esc+'"]')}
/* текстовый элемент: абзац, пункт, ячейка… или «листовой» блок (например рамка «Ловушка»), внутри которого только строчный текст */
const LEAF=new Set(['B','STRONG','I','EM','U','S','SUB','SUP','MARK','BR','A','CODE','SPAN','SMALL','ABBR','VAR','CITE','Q','KBD','DFN','WBR']);
function isText(el){
  if(!el||el.nodeType!==1)return false;
  const inTitle=!!(el.closest('.k-title'));
  if(!inTitle&&!el.closest('.k-sec'))return false;
  if(el.closest(BAD)||el.querySelector(INNER))return false;
  if(inTitle)return el.matches('.k-title>h2,.k-title>p');
  if(el.matches(TXT))return !el.querySelector(TXT+',div');
  if(el.tagName==='DIV'&&!el.matches('.k-sec')&&el.parentElement&&!el.matches('.k-tw,.k-wrap')){
    if(![...el.children].every(c=>LEAF.has(c.tagName)))return false;
    return el.textContent.trim().length>0&&!el.parentElement.closest('[contenteditable]')}
  return false}
function texts(scope,isTitle){
  return [...scope.querySelectorAll(isTitle?'h2,p':TXT+',div')].filter(isText)}
function blocks(sec){return [...sec.children].filter(c=>c.tagName!=='H2'&&!c.matches('.ed-blk,.ed-ui,.pe-mark,.sec-foot'))}
function sidOf(el){const s=el.closest('.k-sec');if(s)return s.dataset.sec;if(el.closest('.k-title'))return '_title';return null}
/* ключ: раздел, вид (t — текстовый элемент, b — блок раздела), тег, номер среди таких же и отпечаток текста */
function keyOf(el,kind){
  const s=sidOf(el);if(s==null)return null;
  const sheet=el.closest('.k-sheet'),scope=scopeOf(sheet,s);if(!scope)return null;
  const list=kind==='b'?blocks(scope):texts(scope,s==='_title').filter(x=>x.tagName===el.tagName);
  const i=list.indexOf(el);if(i<0)return null;
  return{s,k:kind,g:el.tagName.toLowerCase(),i,h:hash(orig(el))}}
function resolve(sheet,key){
  if(!key||key.s==null)return null;
  const scope=scopeOf(sheet,key.s);if(!scope)return null;
  const G=String(key.g||'').toUpperCase();
  const list=key.k==='b'?blocks(scope).filter(x=>x.tagName===G):texts(scope,key.s==='_title').filter(x=>x.tagName===G);
  if(key.k==='b'){const all=blocks(scope),c=all[key.i];if(c&&c.tagName===G&&hash(orig(c))===key.h)return c}
  else{const c=list[key.i];if(c&&hash(orig(c))===key.h)return c}
  return list.find(x=>hash(orig(x))===key.h)||null}

/* ---------- отрисовка вставленных блоков ---------- */
const AID=/^[A-Za-z0-9_-]{8,80}$/;
function blockNode(op){
  const b=op.b||{},n=document.createElement(b.k==='text'?'div':'figure');
  n.dataset.ed=op._id;
  if(b.k==='text'){n.className='ed-blk ed-text';n.innerHTML=clean(b.html,true);return n}
  n.className='ed-blk ed-fig w-'+(/^[sml]$/.test(b.w)?b.w:'m')+(b.k==='svg'?' k-svg':'');
  const ok=AID.test(b.a||'');
  if(!ok){n.innerHTML='<div class="ed-miss">Файл не найден</div>';return n}
  const src='/_blob/'+b.a;
  let m;
  if(b.k==='video'){m=document.createElement('video');m.controls=true;m.preload='metadata';m.playsInline=true;m.setAttribute('playsinline','');m.src=src}
  else{m=document.createElement('img');m.loading='lazy';m.decoding='async';m.alt=String(b.alt||'').slice(0,300);m.src=src}
  m.addEventListener('error',()=>{const d=document.createElement('div');d.className='ed-miss';d.textContent=b.k==='video'?'Видео не загрузилось. Обновите страницу.':'Изображение не загрузилось. Обновите страницу.';m.replaceWith(d)},{once:true});
  n.appendChild(m);
  if(b.cap){const c=document.createElement('figcaption');c.innerHTML=clean(b.cap,false);n.appendChild(c)}
  return n}

/* ---------- наложение правок на один конспект ---------- */
function revert(sheet){
  sheet.querySelectorAll('.ed-blk').forEach(n=>n.remove());
  sheet.querySelectorAll('[data-ed-t]').forEach(el=>{if(el._edO!=null)el.innerHTML=el._edO;el._edO=el._edT=null;el.removeAttribute('data-ed-t')});
  sheet.querySelectorAll('[data-ed-h]').forEach(el=>{el.classList.remove('ed-hid');el.removeAttribute('data-ed-h')})}
function secEnd(sec){return sec.querySelector(':scope>.pe-mark')||sec.querySelector(':scope>.sec-foot')||null}
function applySheet(sheet,ops){
  const res={orphans:[],placed:{}};
  revert(sheet);
  if(!ops.length)return res;
  const L=ops.slice().sort((a,b)=>(a.ord||0)-(b.ord||0));
  // 1) находим цели на исходном конспекте
  const tgt=new Map();
  L.forEach(op=>{try{
    if(op.t==='text'||op.t==='hide')tgt.set(op._id,resolve(sheet,op.tg));
    else if(op.t==='ins'&&op.at&&!op.at.ed&&!op.at.end)tgt.set(op._id,resolve(sheet,op.at))}catch(e){}});
  // 2) скрытые элементы
  L.forEach(op=>{if(op.t!=='hide')return;const el=tgt.get(op._id);if(!el){res.orphans.push(op);return}
    el.classList.add('ed-hid');el.setAttribute('data-ed-h',op._id)});
  // 3) вставки: после якоря, по порядку создания
  const last=new Map();
  L.forEach(op=>{if(op.t!=='ins')return;try{
    const at=op.at||{};let anchor=null,sec=null,akey;
    if(at.ed){anchor=res.placed[at.ed]||null;akey='ed:'+at.ed;if(anchor)sec=anchor.parentElement}
    else if(at.end){sec=scopeOf(sheet,at.s);akey='end:'+at.s}
    else{let el=tgt.get(op._id);if(el){sec=el.closest('.k-sec');while(el&&el.parentElement!==sec)el=el.parentElement;anchor=el}akey='el:'+JSON.stringify(at)}
    let orphan=false;
    if(!sec){const s=at.s!=null?at.s:null;sec=s!=null&&s!=='_title'?scopeOf(sheet,s):null;orphan=true;akey='end:'+(s||'')}
    if(!sec||sec.classList.contains('k-title')){res.orphans.push(op);return}
    if(!anchor&&!at.end)orphan=true;
    const node=blockNode(op);if(orphan)node.dataset.orphan='1';
    const prev=last.get(akey);
    if(prev&&prev.parentElement===sec)prev.after(node);
    else if(anchor&&anchor.parentElement===sec)anchor.after(node);
    else sec.insertBefore(node,secEnd(sec));
    last.set(akey,node);res.placed[op._id]=node;if(orphan)res.orphans.push(op)}catch(e){console.warn('kedit ins',e)}});
  // 4) правки текста
  L.forEach(op=>{if(op.t!=='text')return;const el=tgt.get(op._id);if(!el){res.orphans.push(op);return}
    try{const t=el.textContent;const h=clean(op.html,false);el._edO=el.innerHTML;el._edT=t;el.innerHTML=h;el.setAttribute('data-ed-t',op._id)}catch(e){}});
  return res}

/* ---------- состояние и наблюдение ---------- */
const KE={ops:[],byMod:{},ready:false,db:null,subs:[],clean,hash,keyOf,resolve,orig,texts,blocks,sidOf,blockNode,revert,isText,results:{}};
BV.KE=KE;
function group(){const m={};KE.ops.forEach(o=>{if(!o||!o.mod)return;(m[o.mod]=m[o.mod]||[]).push(o)});KE.byMod=m}
function modOf(sheet){const m=sheet.closest('.module');return m&&m.id?m.id.replace(/^m-/,''):null}
let busy=false;
function applyAll(){
  if(KE.hold){KE.pending=true;return}
  if(busy)return;busy=true;KE.pending=false;
  try{$$('.k-sheet').forEach(sh=>{const mod=modOf(sh);if(!mod)return;
    const ops=KE.byMod[mod]||[];const sig=ops.map(o=>o._id+':'+(o.u||0)).join('|');
    if(sh._edSig===sig)return;
    try{KE.results[mod]=applySheet(sh,ops)}catch(e){console.warn('kedit apply',mod,e)}
    sh._edSig=sig});
  }finally{busy=false}
  KE.subs.forEach(f=>{try{f()}catch(e){}})}
KE.apply=applyAll;
KE.reapply=mod=>{$$('.k-sheet').forEach(sh=>{if(!mod||modOf(sh)===mod)sh._edSig=null});applyAll()};
KE.on=f=>KE.subs.push(f);

/* конспекты рисуются лениво и заново — следим за .k-doc каждого раздела */
function watchDocs(){$$('.k-doc').forEach(d=>{if(d._edW)return;d._edW=1;
  new MutationObserver(()=>{clearTimeout(watchDocs.t);watchDocs.t=setTimeout(applyAll,30)}).observe(d,{childList:true})})}
const main=$$('main')[0];
if(main)new MutationObserver(()=>{clearTimeout(watchDocs.m);watchDocs.m=setTimeout(()=>{watchDocs();applyAll()},120)}).observe(main,{childList:true});
watchDocs();

/* кеш: правки видны сразу, ещё до ответа базы */
const CK='kedits:v1';
function setOps(list,save){KE.ops=list;group();if(save){try{localStorage.setItem(CK,JSON.stringify(list))}catch(e){}}applyAll()}
try{const c=JSON.parse(localStorage.getItem(CK)||'null');if(Array.isArray(c))setOps(c,false)}catch(e){}

async function connect(){
  try{
    if(!window.claude||!claude.use)return;
    const db=await claude.use('db');if(!db)return;KE.db=db;
    db.collection('kedits').onSnapshot(snap=>{
      const list=snap.docs.map(d=>{const v=d.data()||{};v._id=d.id;return v}).filter(o=>o&&typeof o.mod==='string');
      KE.ready=true;setOps(list,true)},
      e=>{console.warn('kedits недоступны',e&&e.code)});
    // редактор — только для владельца и редакторов артефакта
    const u=await claude.use('user');
    if(u&&await u.canEdit()){KE.user=u;const s=document.createElement('script');s.src='bioviz/x/kedit.js?v='+(typeof BV_VER!=='undefined'?BV_VER:'');s.async=true;
      s.onerror=()=>console.warn('Редактор конспектов не загрузился');document.head.appendChild(s)}
  }catch(e){console.warn('kedit connect',e)}}
connect();
})();
