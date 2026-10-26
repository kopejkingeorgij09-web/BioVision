/* ИИ-помощник. Панель справа (на телефоне во весь экран). Режим задаётся в content/course.js (поле ai):
   'claude.ai' — вопрос вместе с текстом открытого раздела открывается в claude.ai в новой вкладке, в аккаунте участника;
   'server' — вопрос уходит в функцию Supabase bv-ai, она проверяет код участника и спрашивает Claude.
   Ключ Anthropic лежит только на сервере, в секретах Supabase.
   Помощник видит, какая лекция и какой раздел открыты, и получает текст этого раздела как контекст.
   Выделенный в конспекте текст можно отправить кнопкой «Спросить». */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root,A=window.BVAUTH,C=window.BV_COURSE;
const ENDPOINT=(window.BV_AI_URL||'https://zonrkvsibojyalhnqutd.supabase.co/functions/v1/bv-ai');
const SERVER=C.ai==='server';

const CSS=`
.ai{position:fixed;z-index:80;top:var(--barh);right:0;bottom:0;width:min(440px,100vw);display:flex;flex-direction:column;background:var(--card);border-left:1px solid var(--line);box-shadow:-20px 0 50px -30px rgba(0,0,0,.35);transform:translateX(102%);transition:transform .22s ease;visibility:hidden}
.ai.on{transform:none;visibility:visible}
@media (prefers-reduced-motion:reduce){.ai{transition:none}}
@media (max-width:760px){.ai{top:0;width:100vw;border-left:0;z-index:90}}
.ai-h{display:flex;align-items:center;gap:10px;padding:12px 14px 12px 18px;border-bottom:1px solid var(--line)}
.ai-h b{font-size:16px}
.ai-h .icb{margin-left:auto;font-size:22px;line-height:1}
.ai-ctx{display:flex;align-items:center;gap:8px;padding:8px 18px;font-size:13px;color:var(--muted);border-bottom:1px solid var(--line);background:var(--bg)}
.ai-ctx span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ai-ctx button{all:unset;cursor:pointer;margin-left:auto;font-weight:600;color:var(--ui);white-space:nowrap}
.ai-log{flex:1;overflow:auto;padding:16px 18px;display:flex;flex-direction:column;gap:14px;overscroll-behavior:contain}
.ai-m{max-width:100%;font-size:15px;line-height:1.6}
.ai-m.u{align-self:flex-end;max-width:88%;background:var(--ui-soft);border-radius:14px 14px 4px 14px;padding:9px 13px;white-space:pre-wrap}
.ai-m.a p{margin:0 0 9px}.ai-m.a p:last-child{margin:0}
.ai-m.a ul,.ai-m.a ol{margin:0 0 9px;padding-left:20px}
.ai-m.a code{font-family:var(--font-mono);font-size:.92em;background:var(--surface-2);padding:1px 5px;border-radius:5px}
.ai-m.a h4{font-size:15px;margin:10px 0 4px}
.ai-m.err{color:var(--bad);font-size:14px}
.ai-m.a a{color:var(--ui);text-underline-offset:2px}
.ai-st{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:13.5px;margin:0 0 6px}
.ai-src{margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-size:13.5px;line-height:1.45}
.ai-src b{display:block;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.ai-src ol{margin:0;padding-left:18px}.ai-src li{margin:3px 0}
.ai-src small{color:var(--muted)}
.ai-m.wait:after{content:"";display:inline-block;width:8px;height:8px;margin-left:4px;border-radius:50%;background:var(--ui);animation:aip 1s infinite}
@keyframes aip{50%{opacity:.2}}
.ai-empty{color:var(--muted);font-size:14.5px;display:flex;flex-direction:column;gap:10px}
.ai-empty b{color:var(--ink);font-size:16px}
.ai-sug{display:flex;flex-direction:column;gap:6px}
.ai-sug button{all:unset;cursor:pointer;padding:9px 12px;border:1px solid var(--line);border-radius:11px;font-size:14px;color:var(--ink)}
.ai-sug button:hover{border-color:var(--ui)}
.ai-f{display:flex;gap:8px;align-items:flex-end;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line)}
.ai-f textarea{flex:1;min-width:0;resize:none;max-height:160px;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:var(--bg);line-height:1.4}
.ai-f textarea:focus{outline:2px solid var(--ui);outline-offset:0;border-color:transparent}
.ai-f .btn{height:44px}
.ai-login{display:flex;flex-direction:column;gap:10px;padding:18px;font-size:14.5px;color:var(--muted)}
.ai-login b{color:var(--ink);font-size:16px}
.ai-login .field{display:flex;gap:8px}
.ai-login input{flex:1;min-width:0;border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--bg);font-family:var(--font-mono);text-transform:uppercase}
.ai-note{font-size:12px;color:var(--muted);padding:0 18px 10px}
.ai-sel{position:fixed;z-index:85;display:inline-flex;align-items:center;gap:6px;padding:7px 12px 7px 10px;border-radius:999px;border:0;background:var(--ink);color:var(--card);font:600 13px var(--font-body);cursor:pointer;box-shadow:0 8px 20px -8px rgba(0,0,0,.45)}
.ai-sel .i{width:15px;height:15px}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const box=document.createElement('aside');box.className='ai';box.setAttribute('aria-label','Помощник');box.setAttribute('aria-hidden','true');
box.innerHTML=`<div class="ai-h">${BV.icon('ai')}<b>Помощник</b><button type="button" class="icb" data-x aria-label="Закрыть помощника">×</button></div>
 <div class="ai-ctx" hidden><span></span><button type="button" data-new>Новый разговор</button></div>
 <div class="ai-body"></div>`;
R.appendChild(box);
const selBtn=document.createElement('button');selBtn.type='button';selBtn.className='ai-sel';selBtn.hidden=true;selBtn.innerHTML=BV.icon('ai')+'Спросить';
R.appendChild(selBtn);

let log=[];       // [{role:'user'|'assistant', content}]
let busy=false,opener=null,pushed=false;
try{log=JSON.parse(sessionStorage.getItem('bv2:ai')||'[]')}catch(e){}
const save=()=>{try{sessionStorage.setItem('bv2:ai',JSON.stringify(log.slice(-30)))}catch(e){}};

/* ---------- контекст: открытая лекция и раздел ---------- */
function context(){const r=BV.app&&BV.app.route;if(!r)return null;
  if(r.kind==='lecture'){const L=r.L,d=(BV.KR||{})[L.id]||{},m=$('#m-'+L.id);
    let sec=null;if(r.sec){sec=(d.sections||[]).find(s=>s.id===r.sec||(s.sub||[]).some(x=>x[0]===r.sec))||null}
    const el=sec&&m&&$('#k-'+sec.id,m);
    const text=el?el.innerText.replace(/\n{3,}/g,'\n\n').slice(0,12000):'';
    return{label:`Лекция ${L.n} · ${sec?'§'+sec.no+' '+sec.t:L.title}`,lecture:`Лекция ${L.n}. ${L.title}`,section:sec?`§${sec.no}. ${sec.t}`:'',text,
      toc:(d.sections||[]).map(s=>`${s.no?s.no+'. ':''}${s.t}`).join('\n')}}
  if(r.kind==='lab')return{label:r.B.title,lecture:'',section:r.B.title,text:r.B.about+' Модели: '+(r.B.models||[]).join(', ')};
  return null}

/* ---------- отрисовка ---------- */
function md(s){/* короткий и безопасный разбор ответа: абзацы, списки, **жирный**, *курсив*, `код`, [ссылка](https://…) */
  const lines=esc(s).split('\n');let out='',list=null;
  const inl=t=>t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g,'$1<i>$2</i>').replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const close=()=>{if(list){out+=`</${list}>`;list=null}};
  let para=[];const flush=()=>{if(para.length){out+=`<p>${inl(para.join('<br>'))}</p>`;para=[]}};
  for(const l of lines){let m;
    if(/^\s*$/.test(l)){flush();close();continue}
    if((m=l.match(/^#{1,4}\s+(.*)/))){flush();close();out+=`<h4>${inl(m[1])}</h4>`;continue}
    if((m=l.match(/^\s*[-*•]\s+(.*)/))){flush();if(list!=='ul'){close();out+='<ul>';list='ul'}out+=`<li>${inl(m[1])}</li>`;continue}
    if((m=l.match(/^\s*\d+[.)]\s+(.*)/))){flush();if(list!=='ol'){close();out+='<ol>';list='ol'}out+=`<li>${inl(m[1])}</li>`;continue}
    close();para.push(l)}
  flush();close();return out}
/* источники, найденные поиском: только http(s), подпись — заголовок страницы и сайт */
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(e){return ''}};
const srcList=src=>(src&&src.length)?`<div class="ai-src"><b>Источники</b><ol>${src.filter(x=>/^https?:\/\//.test(x.url)).map(x=>`<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title||host(x.url))}</a>${x.title?` <small>${esc(host(x.url))}</small>`:''}</li>`).join('')}</ol></div>`:'';

function draw(){const body=$('.ai-body',box);const ctx=context();
  const cx=$('.ai-ctx',box);cx.hidden=false;$('span',cx).textContent=ctx?'Контекст: '+ctx.label:'Контекст: весь курс';
  if(SERVER&&(!A||!A.me)){body.innerHTML=`<form class="ai-login"><b>Нужен код группы</b><span>Помощник работает для участников группы. Код выдаёт руководитель.</span>
      <div class="field"><input name="c" autocomplete="off" spellcheck="false" placeholder="BIO-XXXX-XXXX" aria-label="Код группы"><button class="btn">Войти</button></div><span class="msg" role="status"></span></form>`;
    const f=$('form',body);f.addEventListener('submit',async e=>{e.preventDefault();const m=$('.msg',f);m.className='msg';m.textContent='Проверяю…';
      try{await A.login(f.c.value);draw();const w=$('.who span');if(w)w.textContent=A.me.name||'Профиль'}catch(er){m.className='msg err';m.textContent=er.message}});
    return}
  body.style.cssText='flex:1;display:flex;flex-direction:column;min-height:0';
  body.innerHTML=`<div class="ai-log" aria-live="polite"></div>
    <form class="ai-f"><textarea rows="1" placeholder="Спроси о материале…" aria-label="Вопрос помощнику"></textarea><button class="btn" aria-label="Отправить">↑</button></form>
    <p class="ai-note">${SERVER?'Отвечает Claude по материалам курса и научным сайтам. Проверяй цифры по ссылкам.':'Ответ откроется на claude.ai в новой вкладке, в твоём аккаунте. Подойдёт и бесплатный.'}</p>`;
  drawLog();
  const f=$('.ai-f',body),ta=$('textarea',f);
  ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=Math.min(160,ta.scrollHeight)+'px'});
  ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();f.requestSubmit()}});
  f.addEventListener('submit',e=>{e.preventDefault();const q=ta.value.trim();if(!q||busy)return;ta.value='';ta.style.height='auto';(SERVER?ask:handoff)(q)})}
function drawLog(){const lg=$('.ai-log',box);if(!lg)return;
  if(!log.length){const ctx=context();const sug=ctx&&ctx.section?[`Объясни простыми словами, о чём ${ctx.section}`,'Какие здесь ключевые термины и как они связаны?','Задай мне три вопроса на понимание этого раздела']:['О чём лекция 1 в трёх предложениях?','Чем олиготрофы отличаются от копиотрофов?','Как устроен мотор бактериального жгутика?'];
    lg.innerHTML=`<div class="ai-empty"><b>О чём спросить?</b><span>${SERVER?'Помощник видит, какой раздел у тебя открыт.':'Вопрос уйдёт в Claude вместе с текстом раздела, который у тебя открыт.'} Можно выделить фразу в конспекте и нажать «Спросить».</span><div class="ai-sug">${sug.map(s=>`<button type="button">${esc(s)}</button>`).join('')}</div></div>`;
    $$('.ai-sug button',lg).forEach(b=>b.addEventListener('click',()=>(SERVER?ask:handoff)(b.textContent)));return}
  lg.innerHTML=log.map(m=>m.role==='user'?`<div class="ai-m u">${esc(m.content)}</div>`:`<div class="ai-m a">${md(m.content)}${srcList(m.src)}${m.link&&m.link.startsWith(CLAUDE)?`<p><a href="${esc(m.link)}" target="_blank" rel="noopener">Открыть ещё раз</a></p>`:''}</div>`).join('');
  lg.scrollTop=lg.scrollHeight}

/* ---------- запрос ---------- */
async function ask(q){if(busy)return;busy=true;
  log.push({role:'user',content:q});const msgs=log.slice(-16);drawLog();
  const lg=$('.ai-log',box);const out=document.createElement('div');out.className='ai-m a wait';lg.appendChild(out);lg.scrollTop=lg.scrollHeight;
  let text='',status='',src=[];
  const paint=()=>{out.classList.toggle('wait',!text);out.innerHTML=(status?`<p class="ai-st">${esc(status)}</p>`:'')+md(text)+srcList(src);lg.scrollTop=lg.scrollHeight};
  try{const ctx=context();
    const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:(()=>{try{return localStorage.getItem('bv_code')||''}catch(e){return ''}})(),messages:msgs.map(m=>({role:m.role,content:m.content})),
        context:ctx?{lecture:ctx.lecture,section:ctx.section,text:ctx.text,toc:ctx.toc||''}:null,course:C.title})});
    if(!r.ok||!r.body){let m='Помощник сейчас недоступен.';try{const j=await r.json();if(j&&j.error)m=j.error}catch(e){}throw new Error(m)}
    const rd=r.body.getReader(),dec=new TextDecoder();let buf='';
    for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});
      let i;while((i=buf.indexOf('\n\n'))>=0){const chunk=buf.slice(0,i);buf=buf.slice(i+2);
        const line=chunk.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;let ev;try{ev=JSON.parse(line.slice(6))}catch(e){continue}
        if(ev.s){status=ev.s;paint()}
        if(ev.t){text+=ev.t;status='';paint()}
        if(ev.src){src=ev.src;paint()}
        if(ev.error)throw new Error(ev.error)}}
    if(!text)throw new Error('Пустой ответ. Попробуй переформулировать вопрос.');
    log.push(src.length?{role:'assistant',content:text,src}:{role:'assistant',content:text});save()}
  catch(e){out.className='ai-m err';out.textContent=e.message||'Не получилось получить ответ.';
    if(!text)log.pop()}
  finally{busy=false;if(text)drawLog()}}

/* ---------- режим claude.ai: вопрос с контекстом в новой вкладке ---------- */
const CLAUDE='https://claude.ai/new?q=';
const QMAX=1200; // столько текста раздела влезает в адрес; полный текст уходит в буфер обмена
function prompt(q,full){const ctx=context();
  const head=`Я изучаю курс «${C.title}» (${C.group}).`+(ctx&&ctx.lecture?` Открыта ${ctx.lecture}${ctx.section?', раздел '+ctx.section:''}.`:'');
  let text=ctx&&ctx.text||'';if(!full&&text.length>QMAX)text=text.slice(0,QMAX)+'…';
  return head+(text?`\n\nТекст раздела:\n"""\n${text}\n"""`:'')+`\n\nМой вопрос: ${q}\n\nОтвечай по-русски, опирайся на текст раздела. Если в нём ответа нет, скажи об этом и назови надёжный источник (учебник или статью).`}
function handoff(q){const url=CLAUDE+encodeURIComponent(prompt(q,false));
  window.open(url,'_blank','noopener');
  const ctx=context(),long=!!(ctx&&ctx.text&&ctx.text.length>QMAX);
  const a={role:'assistant',link:url,content:'Вопрос открыт в Claude в новой вкладке.'+(long?' Раздел длинный, поэтому в вопрос вошло только его начало.':'')};
  log.push({role:'user',content:q},a);save();drawLog();
  /* полный текст раздела кладём в буфер, чтобы его можно было вставить в чат; сообщаем, только если получилось */
  if(long)try{navigator.clipboard.writeText(prompt(q,true)).then(()=>{a.content+=' Полный текст с вопросом скопирован: если Claude не хватит контекста, вставь его в чат.';save();drawLog()},()=>{})}catch(e){}}

/* ---------- открыть / закрыть ---------- */
function setNav(on){$$('[data-nav="ai"]').forEach(b=>b.setAttribute('aria-expanded',String(on)))}
function open(prefill){if(!box.classList.contains('on')){opener=R.activeElement||null;box.classList.add('on');box.setAttribute('aria-hidden','false');setNav(true);
    /* на телефоне «Назад» закрывает панель, а не уводит со страницы */
    try{history.pushState({ai:1},'',location.hash);pushed=true}catch(e){}}
  draw();
  const ta=$('textarea',box);if(ta){if(prefill){ta.value=prefill;ta.dispatchEvent(new Event('input'))}setTimeout(()=>ta.focus(),60)}
  else{const inp=$('input',box);if(inp)setTimeout(()=>inp.focus(),60)}}
function close(fromPop){if(!box.classList.contains('on'))return;box.classList.remove('on');box.setAttribute('aria-hidden','true');setNav(false);
  if(pushed&&!fromPop){pushed=false;history.back()}pushed=false;
  if(opener&&opener.focus)opener.focus()}
addEventListener('popstate',()=>{if(box.classList.contains('on'))close(true)});
addEventListener('hashchange',()=>{if(box.classList.contains('on')){pushed=false;draw()}});
$('[data-x]',box).addEventListener('click',()=>close());
$('[data-new]',box).addEventListener('click',()=>{log=[];save();drawLog()});
R.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('on')&&!R.querySelector('.thm'))close()});
BV.ai={open,close,toggle:()=>box.classList.contains('on')?close():open()};

/* ---------- выделение в конспекте → «Спросить» ---------- */
const sel=()=>{try{return (R.getSelection?R.getSelection():document.getSelection())}catch(e){return null}};
function checkSel(){const s=sel();const t=s&&String(s).trim();
  if(!t||t.length<3||t.length>1200||!s.rangeCount){selBtn.hidden=true;return}
  const n=s.anchorNode&&(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement);
  if(!n||!n.closest||!n.closest('.k-sheet')){selBtn.hidden=true;return}
  const rc=s.getRangeAt(0).getBoundingClientRect();if(!rc.width&&!rc.height){selBtn.hidden=true;return}
  selBtn.hidden=false;const w=selBtn.offsetWidth||100;
  selBtn.style.left=Math.max(8,Math.min(innerWidth-w-8,rc.left+rc.width/2-w/2))+'px';
  selBtn.style.top=(rc.top>110?rc.top-44:rc.bottom+10)+'px';selBtn._t=t}
let st=0;const later=()=>{clearTimeout(st);st=setTimeout(checkSel,180)};
document.addEventListener('selectionchange',later);R.addEventListener('pointerup',later);R.addEventListener('keyup',later);
addEventListener('scroll',()=>{selBtn.hidden=true},{passive:true});
selBtn.addEventListener('pointerdown',e=>e.preventDefault());
selBtn.addEventListener('click',()=>{const t=selBtn._t;selBtn.hidden=true;open(`Объясни подробнее: «${t.length>400?t.slice(0,400)+'…':t}»`)});
})();
