/* Лабораторные работы группы: название, цель, оборудование, ход работы, результаты с фотографиями, выводы.
   Адреса: #/labs — список, #/labs/<id> — работа, #/labs/<id>/edit и #/labs/new — редактор (только руководитель).
   Данные в облаке: коллекция labworks (по документу на работу) и labfiles (по документу на фотографию).
   Читать могут все, писать только руководитель: права проверяет сервер (функции bv_* в Supabase). */
(function(){
const {$,$$,esc}=BV,R=BVHOST.root,ic=BV.icon,APP=BV.app;

const CSS=`
.lw-doc{display:flex;flex-direction:column;gap:0;max-width:860px;background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:30px 34px 34px;min-width:0}
@media (max-width:640px){.lw-doc{padding:20px 16px 24px}}
.lw-doc>header{display:flex;flex-direction:column;gap:10px;padding-bottom:22px;
  background:linear-gradient(var(--line),var(--line)) left bottom/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 10px) left bottom/100% 4px no-repeat}
.lw-doc h1{font:600 clamp(28px,4.2vw,42px)/1.08 var(--font-display);letter-spacing:-.018em;font-family:var(--font-display);font-weight:var(--dw);text-transform:var(--dcase);overflow-wrap:anywhere}
.lw-kick{font:500 12px/1.3 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--cut);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.lw-kick>span+span:before{content:"·";margin-right:10px;opacity:.7}
.lw-kick>.badge:before{content:none}
.lw-part{display:grid;grid-template-columns:150px minmax(0,1fr);gap:8px 26px;padding:22px 0;border-bottom:1px solid var(--line)}
.lw-part:last-of-type{border-bottom:0;padding-bottom:4px}
@media (max-width:640px){.lw-part{grid-template-columns:minmax(0,1fr)}}
.lw-part h2{font:600 11.5px/1.4 var(--font-mono)!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:var(--muted);padding-top:4px}
.lw-part .md{font-size:15.5px;line-height:1.65;min-width:0}
.lw-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:14px}
.lw-gal figure{margin:0;display:flex;flex-direction:column;gap:5px;min-width:0}
.lw-gal button{all:unset;cursor:zoom-in;display:block;aspect-ratio:4/3;border-radius:var(--rs);overflow:hidden;border:1px solid var(--line);background:var(--surface-2)}
.lw-gal button:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.lw-gal img{width:100%;height:100%;object-fit:cover;display:block}
.lw-gal figcaption{font-size:12.5px;line-height:1.4;color:var(--muted)}
.lw-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.lw-bar .r{display:flex;flex-wrap:wrap;gap:8px}
.lw-nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;max-width:860px}
.lw-nav a{display:flex;flex-direction:column;gap:3px;padding:14px 18px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);text-decoration:none;color:var(--ink)}
.lw-nav a:hover{border-color:var(--ink)}
.lw-nav small{font:500 11px/1.3 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.lw-nav b{font:600 17px/1.3 var(--font-display)}
.lw-box{position:fixed;inset:0;z-index:96;background:rgba(8,10,12,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;cursor:zoom-out}
.lw-box img{max-width:100%;max-height:calc(100dvh - 90px);object-fit:contain;border-radius:6px}
.lw-box p{color:#eee;font-size:14px;max-width:70ch;text-align:center}
/* редактор */
.lw-form{display:flex;flex-direction:column;gap:16px;max-width:860px}
.lw-form label{display:flex;flex-direction:column;gap:6px;font:600 12px/1.3 var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.lw-form label small{font:400 12.5px/1.4 var(--font-body);letter-spacing:0;text-transform:none}
.lw-form input[type=text],.lw-form input[type=number],.lw-form input[type=date],.lw-form textarea{font:15px/1.5 var(--font-body);color:var(--ink);text-transform:none;letter-spacing:0;border:1px solid var(--line);border-radius:var(--rs);padding:10px 12px;background:var(--card);min-width:0;width:100%}
.lw-form textarea{min-height:110px;resize:vertical}
.lw-form input:focus,.lw-form textarea:focus{outline:2px solid var(--cut);outline-offset:0;border-color:transparent}
.lw-row{display:grid;grid-template-columns:110px 170px minmax(0,1fr);gap:12px}
@media (max-width:640px){.lw-row{grid-template-columns:1fr 1fr}.lw-row>:last-child{grid-column:1/-1}}
.lw-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
.lw-ph>div{display:flex;flex-direction:column;gap:6px;border:1px solid var(--line);border-radius:var(--rs);padding:6px;background:var(--card)}
.lw-ph img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;display:block;background:var(--surface-2)}
.lw-ph input{font-size:13px!important;padding:6px 8px!important}
.lw-ph .x{display:flex;gap:6px}
.lw-ph .x button{all:unset;cursor:pointer;font-size:12.5px;color:var(--muted);padding:3px 6px;border-radius:var(--rx)}
.lw-ph .x button:hover{color:var(--ink);background:var(--surface-2)}
.lw-ph .x button.del:hover{color:var(--bad)}
.lw-drop{display:flex;align-items:center;justify-content:center;gap:8px;min-height:84px;border:1.5px dashed var(--line);border-radius:var(--rs);color:var(--muted);cursor:pointer;font-size:14px;text-align:center;padding:10px}
.lw-drop:hover,.lw-drop.on{border-color:var(--cut);color:var(--ink)}
.lw-chk{flex-direction:row!important;align-items:center;gap:10px!important;text-transform:none!important;letter-spacing:0!important;font:500 14.5px var(--font-body)!important;color:var(--ink)!important}
.lw-chk input{width:18px;height:18px;accent-color:var(--cut)}
.lw-act{display:flex;flex-wrap:wrap;gap:10px;align-items:center;position:sticky;bottom:0;padding:12px 0;background:linear-gradient(transparent,var(--bg) 30%)}
@media (max-width:760px){.lw-act{bottom:calc(64px + env(safe-area-inset-bottom,0px))}}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

/* части работы: ключ в данных, заголовок, подсказка в редакторе */
const PARTS=[
  ['goal','Цель','Чего добиваемся и какую гипотезу проверяем.'],
  ['materials','Оборудование и материалы','Штаммы, среды, реактивы, приборы. Можно списком: каждая строка с «- ».'],
  ['steps','Ход работы','Шаги по порядку: каждая строка с «1. », «2. » и так далее.'],
  ['results','Результаты','Что получилось: наблюдения, числа, таблица. Таблица пишется строками «| столбец | столбец |». Фотографии добавляются ниже.'],
  ['conclusion','Выводы','Подтвердилась ли гипотеза, что пошло не так, что делать дальше.']];

/* ---------- данные ---------- */
const st={list:null,err:null,loading:null,scope:null};
const sortL=l=>l.sort((a,b)=>(a.data.n||0)-(b.data.n||0)||String(a.data.date||'').localeCompare(String(b.data.date||'')));
async function load(force){const scope=APP.isAdmin()?'admin':'public';
  if(st.scope!==scope){st.list=null;st.loading=null;st.scope=scope;photoCache.clear()}
  if(st.list&&!force)return st.list;if(st.loading)return st.loading;
  /* последняя загруженная копия списка хранится в браузере: без интернета работы всё равно видны (без фотографий) */
  st.loading=(async()=>{try{const D=await APP.db(),list=sortL(await D.collection('labworks').list());if(st.scope!==scope)return null;
      st.list=list;st.err=null;BV.store.set('lw-copy',list.filter(w=>!w.data.draft))}
    catch(e){if(st.scope!==scope)return null;st.err=e;if(!st.list)st.list=BV.store.get('lw-copy',null)}finally{if(st.scope===scope)st.loading=null}return st.list})();
  return st.loading}
const visible=()=>(st.list||[]).filter(w=>APP.isAdmin()||!w.data.draft);
const byId=id=>visible().find(w=>w.id===id);
const photoCache=new Map();
async function photo(id){if(photoCache.has(id))return photoCache.get(id);
  const p=(async()=>{const D=await APP.db();const d=await D.doc('labfiles/'+id).get();return d.exists?d.data():null})();
  photoCache.set(id,p);p.catch(()=>photoCache.delete(id));return p}
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const errText=e=>e&&e.code==='denied'?'Облако пока не принимает лабораторные работы: нужно применить миграцию базы 20261102_labworks_admin.sql.':'Нет связи с облаком. Проверь интернет и обнови страницу.';

/* ---------- отрисовка ---------- */
const no=w=>w.data.n?String(w.data.n).padStart(2,'0'):'··';
const snippet=t=>{t=String(t||'').replace(/[*`|#>]/g,'').replace(/\s+/g,' ').trim();return t.length>180?t.slice(0,180).replace(/\s+\S*$/,'')+' …':t};
function rows(list){return `<ul class="rows">${list.map(w=>{const d=w.data,np=(d.photos||[]).length;
  return `<li><a class="row" href="#/labs/${esc(w.id)}"><span class="no">${no(w)}</span><span><b>${esc(d.title||'Без названия')}${d.draft?' <span class="badge cut">черновик</span>':''}</b><small>${[BV.fmtDate(d.date),np?np+' фото':''].filter(Boolean).join(' · ')||'&nbsp;'}</small>${d.goal?`<span class="ab">${esc(snippet(d.goal))}</span>`:''}</span><span class="pr">${ic('arrow')}</span></a></li>`}).join('')}</ul>`}

BV.labworks={async homeBlock(box,count){
  await load();if(!box.isConnected)return;
  if(st.err&&!st.list){box.innerHTML=`<p class="empty">${APP.isAdmin()?esc(errText(st.err)):'Не получилось загрузить лабораторные работы.'}</p>`;return}
  const l=visible();if(count)count.textContent=l.length||'';
  box.innerHTML=l.length?rows(l.slice(-3).reverse())+(l.length>3?`<p><a href="#/labs">Все работы (${l.length})</a></p>`:''):
    `<p class="empty">Работ пока нет.${APP.isAdmin()?' <a href="#/labs/new">Добавить первую</a>':''}</p>`},
  load,parts:PARTS};

const page=APP.add({key:'labs',nav:'labs',
  parse(p){if(p[0]!=='labs')return null;if(!p[1])return{view:'list',key:'list'};
    if(p[1]==='new')return{view:'edit',id:null,key:'new'};
    return{view:p[2]==='edit'?'edit':'work',id:p[1],key:p[1]+(p[2]==='edit'?'/edit':'')}},
  show(m){if(m.view==='list'){drawList();return 'Лабораторные работы'}
    if(m.view==='edit'){drawEdit(m.id);return m.id?'Редактор работы':'Новая работа'}
    drawWork(m.id);const w=byId(m.id);return w?w.data.title:'Лабораторная работа'}});

const crumbs=(...x)=>`<nav class="crumbs" aria-label="Путь"><a href="#/">${esc(BV_COURSE.title)}</a>${x.map(s=>s[1]?`<a href="${s[1]}">${esc(s[0])}</a>`:`<span>${esc(s[0])}</span>`).join('')}</nav>`;
const fresh=(m)=>{const r=APP.route;return r&&r.kind==='x'&&r.x.key==='labs'&&r.m===m};

async function drawList(){const m=APP.route.m;
  const head=`${crumbs(['Лабораторные работы'])}<header class="hero"><p class="eyebrow">Практика группы</p><h1>Лабораторные работы</h1>
    <p class="lead">Журнал работ группы: цель, ход работы, результаты и выводы. Выдели фрагмент текста, чтобы создать промпт для ИИ.</p></header>`;
  const tools=APP.isAdmin()?`<div><a class="btn" href="#/labs/new">${ic('plus')}Новая работа</a></div>`:'';
  page.innerHTML=head+tools+(st.list?`<div data-l>${listBody()}</div>`:'<div data-l><p class="empty">Загружаю…</p></div>');
  await load(true);if(!fresh(m))return;
  $('[data-l]',page).innerHTML=listBody()}
function listBody(){if(st.err&&!st.list)return `<p class="empty">${esc(APP.isAdmin()?errText(st.err):'Не получилось загрузить лабораторные работы. Проверь интернет и обнови страницу.')}</p>`;
  const l=visible();return l.length?rows(l):`<p class="empty">Работ пока нет.${APP.isAdmin()?' Нажми «Новая работа», чтобы добавить первую.':''}</p>`}

async function drawWork(id){const m=APP.route.m;
  if(!byId(id)){page.innerHTML=crumbs(['Лабораторные работы','#/labs'],['Работа'])+'<p class="empty">Загружаю…</p>';await load(true);if(!fresh(m))return}
  const w=byId(id);
  if(!w||(w.data.draft&&!APP.isAdmin())){page.innerHTML=crumbs(['Лабораторные работы','#/labs'],['Работа'])+`<p class="empty">${st.err?'Не получилось загрузить работу.':'Такой работы нет. Возможно, её удалили.'} <a href="#/labs">Ко всем работам</a></p>`;return}
  const d=w.data,l=visible(),i=l.indexOf(w),prev=l[i-1],next=l[i+1];
  const parts=PARTS.filter(([k])=>String(d[k]||'').trim()||(k==='results'&&(d.photos||[]).length));
  page.innerHTML=`<div class="lw-bar">${crumbs(['Лабораторные работы','#/labs'],['№ '+no(w)])}
    ${APP.isAdmin()?`<div class="r"><a class="btn ghost sm" href="#/labs/${esc(w.id)}/edit">${ic('edit')}Редактировать</a></div>`:''}</div>
    <article class="lw-doc"><header><p class="lw-kick"><span>Лабораторная работа № ${no(w)}</span>${d.date?`<span>${esc(BV.fmtDate(d.date))}</span>`:''}${d.draft?'<span class="badge cut">черновик</span>':''}</p><h1>${esc(d.title||'Без названия')}</h1></header>
    ${parts.length?parts.map(([k,t])=>`<section class="lw-part"><h2>${t}</h2><div><div class="md">${BV.md(d[k]||'')}</div>${k==='results'&&(d.photos||[]).length?`<div class="lw-gal">${d.photos.map((p,j)=>`<figure><button type="button" data-ph="${j}" aria-label="Открыть фото ${j+1}"><img alt="${esc(p.cap||'Фото '+(j+1))}" data-pid="${esc(p.id)}"></button>${p.cap?`<figcaption>${esc(p.cap)}</figcaption>`:''}</figure>`).join('')}</div>`:''}</div></section>`).join(''):'<p class="empty" style="margin-top:18px">Описание работы пока не заполнено.</p>'}
    </article>
    <p class="pr-tip">${ic('prompt')}Выдели фрагмент текста, чтобы создать промпт для ИИ</p>
    ${prev||next?`<nav class="lw-nav" aria-label="Другие работы">${prev?`<a href="#/labs/${esc(prev.id)}"><small>Предыдущая</small><b>${esc(prev.data.title)}</b></a>`:''}${next?`<a href="#/labs/${esc(next.id)}"><small>Следующая</small><b>${esc(next.data.title)}</b></a>`:''}</nav>`:''}`;
  $$('img[data-pid]',page).forEach(img=>photo(img.dataset.pid).then(p=>{if(p&&p.src)img.src=p.src}).catch(()=>{img.alt='Фото не загрузилось'}));
  $$('[data-ph]',page).forEach(b=>b.addEventListener('click',()=>{const p=d.photos[+b.dataset.ph],img=$('img',b);if(img&&img.src)lightbox(img.src,p.cap,b)}))}

function lightbox(src,cap,from){const o=document.createElement('div');o.className='lw-box';o.setAttribute('role','dialog');o.setAttribute('aria-label','Фото');o.tabIndex=-1;
  o.innerHTML=`<img src="${src}" alt="">${cap?`<p>${esc(cap)}</p>`:''}`;R.appendChild(o);o.focus();
  const close=()=>{o.remove();removeEventListener('keydown',k);if(from)from.focus()};const k=e=>{if(e.key==='Escape')close()};
  o.addEventListener('click',close);addEventListener('keydown',k)}

/* ---------- фото: сжимаем в браузере, чтобы документ влез в облако (до ~900 КБ) ---------- */
function readImg(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('Не получилось открыть '+file.name))};im.src=u})}
async function shrink(file){const im=await readImg(file);let side=1800,q=.85,out='';
  for(let k=0;k<7;k++){const s=Math.min(1,side/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.round(im.naturalWidth*s),h=Math.round(im.naturalHeight*s);
    const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(im,0,0,w,h);
    out=c.toDataURL('image/jpeg',q);if(out.length<820000)return out;side=Math.round(side*.8);q=Math.max(.6,q-.06)}
  return out}

/* ---------- редактор ---------- */
async function drawEdit(id){const m=APP.route.m;
  const back=id?`#/labs/${id}`:'#/labs';
  if(!APP.isAdmin()){page.innerHTML=crumbs(['Лабораторные работы','#/labs'],['Редактор'])+'<p class="empty">Редактировать работы может только руководитель. <a href="#/me">Войти</a></p>';return}
  if(id&&!byId(id)){page.innerHTML='<p class="empty">Загружаю…</p>';await load(true);if(!fresh(m))return}
  else if(!st.list){await load();if(!fresh(m))return}
  const w=id?byId(id):null;if(id&&!w){page.innerHTML='<p class="empty">Такой работы нет. <a href="#/labs">Ко всем работам</a></p>';return}
  const d=w?w.data:{n:(visible().reduce((a,x)=>Math.max(a,+x.data.n||0),0)+1),date:new Date().toISOString().slice(0,10),draft:true};
  /* фото в редакторе: старые {id, cap}, новые {src, cap, fresh:true} */
  let ph=(d.photos||[]).map(p=>({...p}));const removed=[];
  page.innerHTML=`${crumbs(['Лабораторные работы','#/labs'],[w?'Редактор':'Новая работа'])}
   <header class="hero"><p class="eyebrow">${w?'Редактирование':'Новая работа'}</p><h1>${w?esc(d.title||'Без названия'):'Новая лабораторная работа'}</h1>
   <p class="lead">Текст пишется как обычно. Пустая строка начинает новый абзац, строки с «- » и «1. » становятся списками, **так** выделяется жирным.</p></header>
   <form class="lw-form" novalidate>
    <div class="lw-row"><label>Номер<input type="number" name="n" min="0" step="1" value="${esc(d.n||'')}"></label>
      <label>Дата<input type="date" name="date" value="${esc(d.date||'')}"></label>
      <label>Название<input type="text" name="title" maxlength="160" required value="${esc(d.title||'')}" placeholder="Например: Окраска по Граму"></label></div>
    ${PARTS.map(([k,t,h])=>`<label>${t}<small>${h}</small><textarea name="${k}" rows="${k==='steps'||k==='results'?8:4}">${esc(d[k]||'')}</textarea></label>`).join('')}
    <div class="lw-form-ph"><label style="margin-bottom:6px">Фотографии результатов<small>JPG, PNG или HEIC с телефона. Сайт сам уменьшит снимок до 1800 пикселей по длинной стороне.</small></label>
      <div class="lw-ph"></div>
      <label class="lw-drop" tabindex="0">${ic('photo')}<span>Выбрать фото или перетащить сюда</span><input type="file" accept="image/*" multiple hidden></label></div>
    <label class="lw-chk"><input type="checkbox" name="draft" ${d.draft?'checked':''}>Черновик: участники не видят эту работу</label>
    <div class="lw-act"><button class="btn" type="submit">Сохранить</button><a class="btn ghost" href="${back}">Отмена</a>
      ${w?'<button type="button" class="btn ghost" data-del style="margin-left:auto;color:var(--bad)">Удалить работу</button>':''}<p class="msg" role="status" data-msg></p></div>
   </form>`;
  const f=$('form',page),msg=$('[data-msg]',page),box=$('.lw-ph',page),inp=$('input[type=file]',page),drop=$('.lw-drop',page);
  let dirty=false,busy=false,preparing=0;
  function drawPh(){box.innerHTML=ph.map((p,j)=>`<div><img alt="" data-j="${j}"><input type="text" value="${esc(p.cap||'')}" data-cap="${j}" placeholder="Подпись" maxlength="200" aria-label="Подпись к фото ${j+1}">
      <span class="x">${j?`<button type="button" data-up="${j}" aria-label="Сдвинуть раньше">←</button>`:''}${j<ph.length-1?`<button type="button" data-dn="${j}" aria-label="Сдвинуть позже">→</button>`:''}<button type="button" class="del" data-rm="${j}">Убрать</button></span></div>`).join('');
    $$('img[data-j]',box).forEach(img=>{const p=ph[+img.dataset.j];if(p.src)img.src=p.src;else photo(p.id).then(x=>{if(x&&x.src)img.src=x.src}).catch(()=>{})})}
  drawPh();
  box.addEventListener('input',e=>{const t=BV_ET(e);if(t.dataset.cap!=null)ph[+t.dataset.cap].cap=t.value});
  box.addEventListener('click',e=>{const t=BV_ET(e).closest('button');if(!t)return;
    dirty=true;
    if(t.dataset.rm!=null){const [p]=ph.splice(+t.dataset.rm,1);if(p.id)removed.push(p.id)}
    else if(t.dataset.up!=null){const j=+t.dataset.up;[ph[j-1],ph[j]]=[ph[j],ph[j-1]]}
    else if(t.dataset.dn!=null){const j=+t.dataset.dn;[ph[j+1],ph[j]]=[ph[j],ph[j+1]]}
    drawPh()});
  async function add(files){const L=[...files].filter(x=>/^image\//.test(x.type)||/\.(heic|heif|jpe?g|png|webp)$/i.test(x.name));if(!L.length)return;
    dirty=true;preparing++;msg.className='msg';msg.textContent='Готовлю фото…';
    for(const file of L){try{ph.push({src:await shrink(file),cap:'',fresh:true})}catch(e){msg.className='msg err';msg.textContent=e.message+'. Попробуй сохранить снимок как JPG.'}}
    preparing--;if(msg.textContent==='Готовлю фото…')msg.textContent='';drawPh()}
  inp.addEventListener('change',()=>{add(inp.files);inp.value=''});
  drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inp.click()}});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('on')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('on'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('on');add(e.dataTransfer.files)});
  f.addEventListener('input',()=>{dirty=true});f.addEventListener('change',()=>{dirty=true});
  const del=$('[data-del]',page);
  if(del)del.addEventListener('click',async()=>{if(!confirm(`Удалить работу «${d.title||'без названия'}» вместе с фотографиями? Вернуть её будет нельзя.`))return;
    msg.className='msg';msg.textContent='Удаляю…';
    try{const D=await APP.db();for(const p of (d.photos||[]))await D.doc('labfiles/'+p.id).delete().catch(()=>{});
      await D.doc('labworks/'+w.id).delete();st.list=st.list.filter(x=>x!==w);dirty=false;location.hash='#/labs'}
    catch(e){msg.className='msg err';msg.textContent='Не удалось удалить: '+errText(e)}});
  f.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;
    if(preparing){BV.toast('Дождись подготовки фотографий.');return}
    const v=Object.fromEntries(new FormData(f));const title=String(v.title||'').trim();
    if(!title){msg.className='msg err';msg.textContent='Нужно название работы.';f.elements.title.focus();return}
    busy=true;f.inert=true;msg.className='msg';msg.textContent='Сохраняю…';
    try{const D=await APP.db(),wid=w?w.id:newId('w_');
      const photos=[];let k=0;
      for(const p of ph){if(p.fresh){k++;msg.textContent=`Загружаю фото ${k}…`;const pid=newId(wid+'.p');await D.doc('labfiles/'+pid).set({src:p.src,cap:p.cap||''});photoCache.set(pid,Promise.resolve({src:p.src}));photos.push({id:pid,cap:p.cap||''})}
        else photos.push({id:p.id,cap:p.cap||''})}
      const data={n:Math.max(0,parseInt(v.n,10)||0),date:String(v.date||''),title,draft:!!f.elements.draft.checked,photos,
        created:d.created||Date.now(),updated:Date.now()};
      PARTS.forEach(([key])=>{data[key]=String(v[key]||'').replace(/\s+$/,'')});
      await D.doc('labworks/'+wid).set(data);
      for(const pid of removed)await D.doc('labfiles/'+pid).delete().catch(()=>{});
      if(w)w.data=data;else(st.list=st.list||[]).push({id:wid,data});sortL(st.list);
      dirty=false;busy=false;location.hash='#/labs/'+wid}
    catch(er){msg.className='msg err';msg.textContent='Не удалось сохранить. '+errText(er)}
    finally{busy=false;f.inert=false}});
  /* не потерять набранное при случайном уходе со страницы */
  const guard=e=>{if((dirty||busy||preparing)&&fresh(m)){e.preventDefault();e.returnValue=''}};addEventListener('beforeunload',guard);
  const routeGuard=e=>{if(!fresh(m))return;
    if(busy||preparing){e.preventDefault();BV.toast('Дождись сохранения или подготовки фотографий.');return}
    if(dirty&&!confirm('Есть несохранённые изменения. Уйти без сохранения?'))e.preventDefault()};
  addEventListener('bv-route-request',routeGuard);
  addEventListener('bv-route',function off(){if(!fresh(m)){removeEventListener('beforeunload',guard);removeEventListener('bv-route-request',routeGuard);removeEventListener('bv-route',off)}})}
})();
