/* «Спросить ИИ» в конспектах: выделить текст → маленькая кнопка → объяснение от Claude.
   ИИ работает у любого, кто открыл ссылку в claude.ai под своим аккаунтом (тратятся его лимиты,
   при первом вопросе claude.ai спрашивает разрешение). Если ИИ в этом окне недоступен
   (нет аккаунта, файл открыт отдельно, отказ в разрешении, лимит) — кнопка всё равно работает:
   готовый вопрос копируется и открывается Claude в новой вкладке. */
(function(){
const R=BVHOST.root,esc=BV.esc||(s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
const CSS=`
.ai-btn{position:fixed;z-index:120;display:inline-flex;align-items:center;gap:6px;font:600 13px/1 var(--font-body);color:var(--surface);background:var(--ink);border:0;border-radius:999px;padding:7px 12px 7px 10px;cursor:pointer;box-shadow:0 6px 18px -6px rgba(0,0,0,.35);transition:opacity .12s,transform .12s;opacity:0;transform:translateY(3px);pointer-events:none}
.ai-btn.on{opacity:1;transform:none;pointer-events:auto}
.ai-btn:hover{background:var(--hema)}
.ai-btn:focus-visible{outline:2px solid var(--hema);outline-offset:2px}
.ai-btn svg{width:14px;height:14px;flex:none}
.ai-pn{position:fixed;z-index:121;right:18px;bottom:18px;width:min(420px,calc(100vw - 36px));max-height:min(640px,calc(100vh - 36px));display:flex;flex-direction:column;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 60px -20px rgba(0,0,0,.45);font-family:var(--font-body);overflow:hidden}
.ai-pn[hidden]{display:none}
@media (max-width:640px){.ai-pn{left:8px;right:8px;bottom:8px;width:auto;max-height:72vh;border-radius:16px}}
.ai-hd{display:flex;align-items:center;gap:8px;padding:12px 14px 10px;border-bottom:1px solid var(--line)}
.ai-hd b{font-size:14px;flex:1}
.ai-x{border:0;background:none;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:8px}
.ai-x:hover{background:var(--surface-2);color:var(--ink)}
.ai-bd{overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;font-size:14.5px;line-height:1.55}
.ai-q{border-left:3px solid var(--hema);background:var(--hema-soft);border-radius:0 10px 10px 0;padding:8px 10px;font-size:13.5px;color:var(--ink);max-height:120px;overflow:auto;white-space:pre-wrap}
.ai-chips{display:flex;flex-wrap:wrap;gap:6px}
.ai-chips button{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:999px;padding:6px 11px;font:500 13px var(--font-body);cursor:pointer}
.ai-chips button:hover{border-color:var(--hema);color:var(--hema)}
.ai-me{align-self:flex-end;max-width:88%;background:var(--surface-2);border-radius:12px 12px 4px 12px;padding:7px 11px;font-size:13.5px}
.ai-an{white-space:normal}
.ai-an p{margin:0 0 8px}.ai-an p:last-child{margin:0}
.ai-an ul,.ai-an ol{margin:0 0 8px;padding-left:20px}
.ai-an code{font-family:var(--font-mono);font-size:13px;background:var(--surface-2);padding:1px 5px;border-radius:5px}
.ai-wait{color:var(--muted);font-size:13.5px}
.ai-err{color:var(--bad);font-size:13.5px}
.ai-fb{display:flex;flex-direction:column;gap:8px;border:1px dashed var(--line);border-radius:12px;padding:10px 12px;font-size:13.5px;background:var(--surface-2)}
.ai-fb .row{display:flex;flex-wrap:wrap;gap:6px}
.ai-b{border:0;border-radius:10px;padding:8px 12px;font:600 13px var(--font-body);cursor:pointer;background:var(--ink);color:var(--surface);text-decoration:none;display:inline-block}
.ai-b.g{background:transparent;color:var(--ink);border:1px solid var(--line)}
.ai-ft{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.ai-in{display:flex;gap:6px}
.ai-in textarea{flex:1;min-height:38px;max-height:110px;resize:none;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:10px;padding:9px 11px;font:14px/1.4 var(--font-body)}
.ai-in textarea:focus{outline:none;border-color:var(--hema)}
.ai-note{font-size:11.5px;color:var(--muted)}
`;
const st=document.createElement('style');st.textContent=CSS;R.appendChild(st);

const ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
const btn=document.createElement('button');btn.className='ai-btn';btn.type='button';btn.innerHTML=ICON+'Спросить ИИ';btn.setAttribute('aria-label','Спросить ИИ о выделенном фрагменте');R.appendChild(btn);
const pn=document.createElement('div');pn.className='ai-pn';pn.hidden=true;pn.setAttribute('role','dialog');pn.setAttribute('aria-label','Вопрос к ИИ');
pn.innerHTML=`<div class="ai-hd">${ICON.replace('<svg','<svg style="width:16px;height:16px;color:var(--hema)"')}<b>Спросить ИИ</b><button class="ai-x" type="button" aria-label="Закрыть">×</button></div>
<div class="ai-bd"></div>
<div class="ai-ft"><div class="ai-in"><textarea rows="1" placeholder="Что непонятно? (можно пусто)"></textarea><button class="ai-b" type="button" data-send>Спросить</button></div>
<span class="ai-note">ИИ может ошибаться: сверяйся с конспектом и учебником.</span></div>`;
R.appendChild(pn);
const bd=pn.querySelector('.ai-bd'),ta=pn.querySelector('textarea'),sendB=pn.querySelector('[data-send]');

/* --- ИИ: claude.use('sample') либо null --- */
let sample=null,ready=false,blocked=false;
(async()=>{try{if(window.claude&&claude.use)sample=await claude.use('sample')}catch(e){sample=null}ready=true})();

/* --- выделение внутри конспекта (учитываем теневой DOM во всех браузерах) --- */
let downIn=false,lastPt=null,cur=null;
const inSheet=n=>{const e=n&&(n.nodeType===1?n:n.parentElement);return !!(e&&e.closest&&e.closest('.k-sheet')&&!e.closest('input,textarea,button,select,.kf-ctl'))};
function getSel(){
  let s=null;try{s=R.getSelection?R.getSelection():null}catch(e){}if(!s||!s.rangeCount)s=document.getSelection();
  const text=s?String(s).replace(/\s+/g,' ').trim():'';if(text.length<3)return null;
  let range=null;
  try{if(s.getComposedRanges){const rs=s.getComposedRanges({shadowRoots:[R]});if(rs&&rs[0]){const r=document.createRange();r.setStart(rs[0].startContainer,rs[0].startOffset);r.setEnd(rs[0].endContainer,rs[0].endOffset);range=r}}}catch(e){}
  if(!range&&s.rangeCount)range=s.getRangeAt(0);
  const node=range&&range.commonAncestorContainer;
  const ok=(node&&R.contains(node))?inSheet(node):downIn;
  if(!ok)return null;
  let rect=null;try{const rr=range&&R.contains(range.commonAncestorContainer)?range.getBoundingClientRect():null;if(rr&&(rr.width||rr.height))rect=rr}catch(e){}
  return {text,node:node&&R.contains(node)?node:null,rect}}
function place(sel){
  let x,y;const touch=matchMedia('(hover:none)').matches,bw=136,bh=32;
  if(sel.rect){x=sel.rect.left+sel.rect.width/2-bw/2;y=touch||sel.rect.top<54?sel.rect.bottom+10:sel.rect.top-bh-8}
  else if(lastPt){x=lastPt.x-bw/2;y=lastPt.y+(touch?24:14)}else return false;
  x=Math.max(8,Math.min(innerWidth-bw-8,x));y=Math.max(8,Math.min(innerHeight-bh-8,y));
  btn.style.left=x+'px';btn.style.top=y+'px';return true}
function show(){if(!pn.hidden&&busy)return;const sel=getSel();if(!sel){hide();return}cur=sel;if(place(sel))btn.classList.add('on')}
function hide(){btn.classList.remove('on')}
let t0=0;const later=()=>{clearTimeout(t0);t0=setTimeout(show,160)};
document.addEventListener('pointerdown',e=>{const p=BV_ET(e);if(p===btn||btn.contains(p)||pn.contains(p))return;downIn=inSheet(p);hide()},true);
document.addEventListener('pointerup',e=>{lastPt={x:e.clientX,y:e.clientY};later()},true);
document.addEventListener('selectionchange',later);
document.addEventListener('keyup',e=>{if(e.shiftKey||e.key==='Shift')later()},true);
addEventListener('scroll',()=>{if(btn.classList.contains('on')){const s=getSel();s&&s.rect?place(s):hide()}},{passive:true});
btn.addEventListener('pointerdown',e=>e.preventDefault());
btn.addEventListener('click',()=>{if(cur)openPanel(cur);hide()});

/* --- контекст: тема конспекта, раздел, абзац вокруг --- */
function context(node){
  const el=node&&(node.nodeType===1?node:node.parentElement),sheet=el&&el.closest('.k-sheet');
  const title=sheet?(sheet.querySelector('.k-title h2')||{}).textContent||'':'';
  let sec='';if(el){const s=el.closest('.k-sec');const h=s&&s.querySelector('h2');if(h)sec=h.textContent}
  let par='';if(el){const p=el.closest('p,li,td,.k-box,figcaption,.k-steptx,div');par=p?p.textContent.replace(/\s+/g,' ').trim():''}
  return {title:title.trim(),sec:sec.trim(),par:par.slice(0,1400)}}
function lastDocTitle(){const s=R.querySelector('.module:not([hidden]) .k-sheet .k-title h2');return s?s.textContent.trim():''}

/* --- диалог --- */
let frag='',ctx={},turns=[],busy=false,ac=null;
const SYS=c=>`Ты — внимательный преподаватель биологии и биохимии. Ученик (школьник, олимпиадник или студент 1 курса биотехнологии) читает интерактивный конспект и выделил фрагмент, который ему непонятен.
Тема конспекта: ${c.title||lastDocTitle()||'биология'}${c.sec?`\nРаздел: ${c.sec}`:''}
Выделенный фрагмент: «${frag}»${c.par&&c.par!==frag?`\nАбзац вокруг: «${c.par}»`:''}

Правила ответа:
- Пиши по-русски, просто и точно, без воды: 4–10 предложений, если ученик не просит подробнее.
- Сначала коротко объясни суть простыми словами, затем при необходимости — механизм или пример.
- Опирайся на общепринятые факты из стандартных учебников (Ленинджер «Основы биохимии», Альбертс, школьные учебники). Не выдумывай чисел, названий и ссылок; если не уверен или вопрос спорный — прямо скажи об этом.
- Если в выделенном фрагменте ошибка или упрощение — мягко укажи на это.
- Формат: короткие абзацы, при необходимости список через «- », формулы обычным текстом (АТФ, H⁺, ΔG). Без заголовков и таблиц.`;
function md(t){const L=esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').split(/\n/);let h='',ul=null;
  for(const raw of L){const l=raw.trim();const m=l.match(/^(?:[-•*]|\d+[.)])\s+(.*)/);
    if(m){const tag=/^\d/.test(l)?'ol':'ul';if(ul!==tag){if(ul)h+=`</${ul}>`;h+=`<${tag}>`;ul=tag}h+=`<li>${m[1]}</li>`;continue}
    if(ul){h+=`</${ul}>`;ul=null}if(l)h+=`<p>${l}</p>`}
  if(ul)h+=`</${ul}>`;return h}
const CHIPS=['Объясни проще','Приведи пример','Зачем это нужно клетке?','Разбери по шагам','Как это спрашивают на экзамене?'];
function openPanel(sel){
  frag=sel.text.slice(0,1500);ctx=context(sel.node);turns=[];if(ac)ac.abort();busy=false;
  bd.innerHTML=`<div class="ai-q">${esc(frag.length>600?frag.slice(0,600)+'…':frag)}</div><div class="ai-chips">${CHIPS.map(c=>`<button type="button">${c}</button>`).join('')}</div>`;
  bd.querySelectorAll('.ai-chips button').forEach(b=>b.addEventListener('click',()=>ask(b.textContent)));
  ta.value='';pn.hidden=false;setBusy(false);
  try{const s=R.getSelection?R.getSelection():document.getSelection();s&&s.removeAllRanges()}catch(e){}
  setTimeout(()=>ta.focus({preventScroll:true}),30)}
function closePanel(){if(ac)ac.abort();pn.hidden=true}
pn.querySelector('.ai-x').addEventListener('click',closePanel);
pn.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePanel()}});
sendB.addEventListener('click',()=>{if(busy){if(ac)ac.abort();return}ask(ta.value.trim()||'Объясни этот фрагмент')});
ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendB.click()}});
ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=Math.min(110,ta.scrollHeight)+'px'});
function setBusy(b){busy=b;sendB.textContent=b?'Стоп':'Спросить';ta.disabled=b}
const scroll=()=>{bd.scrollTop=bd.scrollHeight};
function plainPrompt(q){return `${SYS(ctx)}\n\nВопрос ученика: ${q}`}
function fallback(q,why){
  const text=plainPrompt(q),box=document.createElement('div');box.className='ai-fb';
  box.innerHTML=`<span>${why} Вопрос с фрагментом уже собран — его можно задать Claude или любому другому ИИ.</span>
   <div class="row"><button class="ai-b" type="button" data-c>Скопировать и открыть Claude</button><button class="ai-b g" type="button" data-o>Только скопировать</button></div><span class="ai-note" data-m></span>`;
  const msg=box.querySelector('[data-m]');
  const copy=async()=>{try{await navigator.clipboard.writeText(text);return true}catch(e){
    try{const t=document.createElement('textarea');t.value=text;t.style.cssText='position:fixed;opacity:0';R.appendChild(t);t.select();const ok=document.execCommand('copy');t.remove();return ok}catch(er){return false}}};
  box.querySelector('[data-c]').addEventListener('click',async()=>{const ok=await copy();
    try{window.open('https://claude.ai/new?q='+encodeURIComponent(text.slice(0,6000)),'_blank','noopener')}catch(e){}
    msg.textContent=ok?'Скопировано. Если вопрос не подставился сам — вставь его в чат (Ctrl+V или «Вставить»).':'Скопировать не удалось — выдели текст ниже и скопируй вручную.';
    if(!ok)showRaw()});
  box.querySelector('[data-o]').addEventListener('click',async()=>{const ok=await copy();msg.textContent=ok?'Скопировано — вставь в любой чат с ИИ.':'Скопировать не удалось — выдели текст ниже вручную.';if(!ok)showRaw()});
  function showRaw(){if(box.querySelector('textarea'))return;const t=document.createElement('textarea');t.value=text;t.readOnly=true;t.style.cssText='width:100%;min-height:90px;font:12px var(--font-mono);border:1px solid var(--line);border-radius:8px;padding:6px;background:var(--surface);color:var(--ink)';box.appendChild(t);t.select()}
  bd.appendChild(box);scroll()}
async function ask(q){
  if(busy)return;
  const ch=bd.querySelector('.ai-chips');if(ch)ch.remove();
  const me=document.createElement('div');me.className='ai-me';me.textContent=q;bd.appendChild(me);ta.value='';ta.style.height='';
  if(!ready){const w=document.createElement('div');w.className='ai-wait';w.textContent='Подключаюсь к ИИ…';bd.appendChild(w);scroll();
    for(let i=0;i<40&&!ready;i++)await new Promise(r=>setTimeout(r,250));w.remove()}
  if(!sample||blocked){fallback(q,blocked||'Встроенный ИИ на сайте пока не подключён.');return}
  const out=document.createElement('div');out.className='ai-an';out.innerHTML='<span class="ai-wait">Думаю…</span>';bd.appendChild(out);scroll();
  const msgs=turns.length?[...turns,{role:'user',content:q}]:[{role:'user',content:plainPrompt(q)}];
  setBusy(true);ac=new AbortController();let stick=true;
  const onS=()=>{stick=bd.scrollTop+bd.clientHeight>=bd.scrollHeight-30};bd.addEventListener('scroll',onS);
  try{
    const r=await sample(msgs,{signal:ac.signal,modelTier:'default',cache:false,onText:({text})=>{out.innerHTML=md(text);if(stick)scroll()}});
    out.innerHTML=md(r.text)+(r.truncated?'<p class="ai-note">Ответ обрезан по длине — спроси «продолжи».</p>':'');
    turns=[...msgs,{role:'assistant',content:r.text}];if(turns.length>12)turns=[turns[0],turns[1],...turns.slice(-8)];
  }catch(e){const c=e&&e.code;
    if(c==='aborted'||(e&&e.name==='AbortError')){out.innerHTML=(e&&e.text?md(e.text):'')+'<p class="ai-note">Остановлено.</p>'}
    else if(c==='not_granted'){out.remove();blocked='Доступ к ИИ для этой страницы не разрешён.';fallback(q,blocked)}
    else if(c==='rate_limited'){out.remove();fallback(q,'Сейчас достигнут лимит запросов к ИИ — попробуй через пару минут.')}
    else{out.remove();fallback(q,'ИИ не ответил'+(c?` (${esc(c)})`:'')+'.')}}
  finally{bd.removeEventListener('scroll',onS);setBusy(false);ac=null;scroll()}}
BV.askAI=t=>openPanel({text:String(t||''),node:null,rect:null});
})();
