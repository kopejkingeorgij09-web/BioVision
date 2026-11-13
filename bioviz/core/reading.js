/* Fundamental reading. Static content + device-local PDF library, no build step.
   PDF.js is loaded only when a PDF is opened. All user text is escaped. */
(function(){
'use strict';
const { $, $$, esc, store }=BV, APP=BV.app, ROOT=BVHOST.root;
const BASE='content/reading/alberts/', VER=typeof BV_VER==='undefined'?'':BV_VER;
const css=document.createElement('link');css.rel='stylesheet';css.href='bioviz/core/reading.css?v='+VER;ROOT.appendChild(css);
const href=t=>'#/reading/alberts/'+t;
let generation=0, active=null, manifestPromise=null, pdfPromise=null, dbPromise=null, searchPromise=null, questionsPromise=null, verbatimPromise=null;
const chapterCache=new Map();
const prefs=Object.assign({size:20,line:1.8,width:740,font:'serif'},store.get('reading:prefs',{}));
const btn=(label,action,extra='')=>`<button type="button" class="btn ghost" data-rd="${action}" ${extra}>${label}</button>`;
const crumbs=(name='')=>`<nav class="crumbs" aria-label="Путь"><a href="#/">БиоВиз</a><a href="#/reading">Фундаментальное чтиво</a>${name?'<span>'+esc(name)+'</span>':''}</nav>`;
const status=(box,text,error=false)=>{if(box){box.textContent=text;box.classList.toggle('error',error)}};
async function json(path){const r=await fetch(BASE+path+'?v='+encodeURIComponent(VER));if(!r.ok)throw new Error('Не удалось загрузить материал. Проверь интернет и попробуй ещё раз.');return r.json()}
function manifest(){return manifestPromise||(manifestPromise=json('manifest.json').catch(e=>{manifestPromise=null;throw e}))}
function questions(){return questionsPromise||(questionsPromise=json('questions.json').catch(e=>{questionsPromise=null;throw e}))}
function chapter(n){if(!chapterCache.has(n))chapterCache.set(n,json('chapter-'+n+'.json').catch(e=>{chapterCache.delete(n);throw e}));return chapterCache.get(n)}
function db(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{
 if(!window.indexedDB){reject(new Error('Браузер не поддерживает локальную библиотеку PDF.'));return}
 const req=indexedDB.open('bioviz-reading',1);
 req.onupgradeneeded=()=>req.result.createObjectStore('books',{keyPath:'id'});
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
}).catch(e=>{dbPromise=null;throw e}))}
async function local(method,value){const d=await db();return new Promise((resolve,reject)=>{
 const tx=d.transaction('books',method==='get'||method==='getAll'?'readonly':'readwrite');
 const req=tx.objectStore('books')[method](...(value===undefined?[]:[value]));let result;
 req.onsuccess=()=>{result=req.result};tx.oncomplete=()=>resolve(result);
 tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Не удалось сохранить PDF на устройстве.'));
})}
function progress(id){return store.get('reading:progress:'+id,{page:1})}
let warned=false;
function saveProgress(id,patch){const next={...progress(id),...patch,t:Date.now()};
 try{localStorage.setItem('bv2:reading:progress:'+id,JSON.stringify(next))}catch(e){if(!warned){warned=true;BV.toast('Браузер не сохранил место чтения. Проверь доступное место и настройки хранения.',6000)}}
 return next}
function bookmarks(id){return store.get('reading:marks:'+id,[])}
function allTopics(m){return m.chapters.flatMap(c=>c.topics)}
function current(){return APP.route&&APP.route.kind==='x'&&APP.route.x.key==='reading'}
function fresh(token){return token===generation&&current()}
function applyPrefs(){page.style.setProperty('--rd-font',Math.max(15,Math.min(32,Number(prefs.size)||20))+'px');page.style.setProperty('--rd-line',Math.max(1.4,Math.min(2.2,Number(prefs.line)||1.8)));page.style.setProperty('--rd-width',Math.max(520,Math.min(980,Number(prefs.width)||740))+'px');const text=$('.rd-text',page);if(text)text.classList.toggle('sans',prefs.font==='sans')}
function destroy(){generation++;closeDialog();if(active){if(active.save)active.save();if(active.cleanup)active.cleanup();active=null}BVHOST.host.classList.remove('rd-reading')}
function failure(e,token){if(!fresh(token))return;page.innerHTML=crumbs()+'<div class="rd-card"><h2>Не получилось открыть</h2><p class="rd-sub">'+esc(e.message||'Проверь интернет и повтори попытку.')+'</p><div class="rd-tools">'+btn('Попробовать снова','retry')+'<a class="btn ghost" href="#/reading">К библиотеке</a></div></div>'}
const page=APP.add({key:'reading',nav:'reading',
 parse(p){if(p[0]!=='reading')return null;
  if(p[1]==='practice')return{view:'bank',section:p[2]||'',key:p.join('/')};
  if(p[1]==='pdf'&&p[2])return{view:'pdf',id:p[2],key:p.join('/')};
  if(p[1]==='alberts')return p[2]==='pdf'?{view:'pdf',id:'alberts',page:Number(p[3])||null,key:p.join('/')}:{view:'native',topic:p[2]||null,key:p.join('/')};
  return{view:'library',key:'library'}},
 show(m){destroy();page.className='page rd';const token=generation;
  page.innerHTML=crumbs()+'<p class="rd-status" role="status">Открываю библиотеку…</p>';
  applyPrefs();(m.view==='library'?library(token):m.view==='native'?native(m,token):m.view==='bank'?bank(m,token):pdf(m,token)).catch(e=>failure(e,token));
  return m.view==='bank'?'Банк заданий':m.view==='native'?'Альбертс · Том 1':'Фундаментальное чтиво'}
});
addEventListener('bv-route',()=>{if(!current())destroy()});
addEventListener('bv-before-route',destroy);
addEventListener('pagehide',()=>{if(active&&active.save)active.save()});

/* ---------- Library, import and removal ---------- */
async function library(token){
 const m=await manifest();if(!fresh(token))return;
 const p=progress('alberts'),total=allTopics(m).filter(t=>t.level===3).length;
 page.innerHTML=crumbs()+`<header class="hero"><p class="eyebrow">Библиотека · Чтение в своём темпе</p><h1>Фундаментальное чтиво</h1><p class="lead">Большие книги, к которым хочется возвращаться. Читай, разбирайся и проверяй, как складывается понимание.</p></header>
 <section class="rd-card rd-book" aria-labelledby="rd-alberts"><div class="rd-cover" aria-hidden="true"><small>Альбертс и соавторы</small><b>Молекулярная<br>биология<br>клетки</b><span>Том 1 · 5-е издание</span></div><div class="rd-book-info"><p class="eyebrow">Нативная книга</p><h2 id="rd-alberts">Молекулярная биология клетки</h2><p class="rd-sub">Полный текст первого тома, иллюстрации и связь с оригиналом. После тем — короткая практика на понимание.</p><div class="rd-stats"><span>7 глав</span><span>${total} микротем</span><span>${m.pages} страниц оригинала</span></div><div class="rd-tools"><a class="btn" href="${href(p.topic||'1-intro')}">${p.topic?'Продолжить чтение':'Открыть книгу'}</a><a class="btn ghost" href="#/reading/practice">Банк заданий</a></div>${p.topic?'<p class="rd-sub">Место чтения сохранено · PDF-страница '+p.page+'</p>':''}</div></section>
 <section class="rd-upload" aria-labelledby="rd-upload-title"><h2 id="rd-upload-title">Твоя полка</h2><p class="rd-sub">Добавь учебник в PDF. Оглавление, поиск, закладки и место чтения будут под рукой.</p><label class="btn">Добавить PDF<input type="file" accept="application/pdf,.pdf" data-upload multiple hidden></label><p class="rd-sub">Можно перетащить файлы сюда. PDF хранятся в этом браузере на этом устройстве и доступны без интернета. Очистка данных сайта удалит их.</p><p class="rd-status" data-upload-status role="status" aria-live="polite"></p></section>
 <div class="rd-local" data-local><p class="rd-sub">Загружаю твою полку…</p></div>`;
 const input=$('[data-upload]',page),drop=$('.rd-upload',page);
 input.onchange=()=>{upload(input.files,token);input.value=''};
 drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};drop.ondragleave=()=>drop.classList.remove('over');
 drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');upload(e.dataTransfer.files,token)};
 await localRows(token)
}
async function localRows(token){let books;try{books=await local('getAll')}catch(e){if(fresh(token))status($('[data-local]',page),'Локальное хранение недоступно. Разреши сайту сохранять данные в настройках браузера.',true);return}
 if(!fresh(token)||!$('[data-local]',page))return;
 $('[data-local]',page).innerHTML=books.length?books.sort((a,b)=>b.added-a.added).map(b=>`<div class="rd-local-row"><a href="#/reading/pdf/${esc(b.id)}"><b>${esc(b.title)}</b><small>${(b.size/1048576).toFixed(1)} МБ · страница ${progress(b.id).page||1}${b.pages?' из '+b.pages:''}</small></a>${btn('Удалить','delete','data-id="'+esc(b.id)+'" aria-label="Удалить '+esc(b.title)+'"')}</div>`).join(''):'<p class="rd-sub">На твоей полке пока нет PDF. Начни с любимого учебника.</p>'
}
async function upload(files,token){const s=$('[data-upload-status]',page);let count=0;const errors=[];
 for(const file of [...files]){try{
  if(!file.size||!(await file.slice(0,1024).text()).includes('%PDF-'))throw new Error(file.name+': это не PDF-файл.');
  status(s,'Сохраняю «'+file.name+'»…');
  const id='b-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
  await local('put',{id,title:file.name.replace(/\.pdf$/i,''),blob:file,size:file.size,added:Date.now()});count++;
 }catch(e){errors.push(e.name==='QuotaExceededError'?'Недостаточно места на устройстве для «'+file.name+'».':e.message||'Не удалось сохранить файл.')}
 }
 if(count){status(s,'PDF сохранён. Готовлю читалку для работы без интернета…');
  try{if(!BV.offline)throw new Error();await BV.offline.preparePDF();if(!await BV.offline.save(true))throw new Error()}
  catch(e){errors.push('PDF сохранён, но читалку не удалось подготовить для работы без интернета. Подключись к сети и открой PDF перед чтением без сети.')}}
 if(!fresh(token))return;status(s,[count?'Добавлено PDF: '+count+'.':'',...errors].filter(Boolean).join(' '),errors.length>0);await localRows(token)
}

/* ---------- Dialogs share keyboard focus, Escape and mobile sheet behavior ---------- */
let dialog=null;
function closeDialog(){if(dialog){dialog.close();dialog.remove();dialog=null}}
function openDialog(title,body,extra=''){
 closeDialog();dialog=document.createElement('dialog');dialog.className='rd-dialog '+extra;
 dialog.innerHTML=`<div class="rd-dialog-head"><h2>${esc(title)}</h2><button type="button" class="btn ghost" data-close aria-label="Закрыть окно">Закрыть</button></div><div class="rd-dialog-body">${body}</div>`;
 (document.fullscreenElement===page?page:ROOT).appendChild(dialog);const d=dialog;
 $('[data-close]',d).onclick=closeDialog;d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog()}});
 d.addEventListener('close',()=>{if(dialog===d){dialog=null;d.remove()}});d.showModal();return d
}
function settings(){const d=openDialog('Как тебе удобно читать',`<div class="rd-settings"><label>Размер текста · <output data-size-label>${prefs.size}</output> px<input data-size type="range" min="16" max="30" value="${prefs.size}"></label><label>Межстрочный интервал<select data-line><option value="1.6">Компактный</option><option value="1.8">Обычный</option><option value="2">Свободный</option></select></label><label>Ширина колонки<select data-width><option value="600">Узкая</option><option value="740">Обычная</option><option value="900">Широкая</option></select></label><label>Шрифт<select data-font><option value="serif">Книжный, с засечками</option><option value="sans">Без засечек</option></select></label><p class="rd-sub">На телефоне колонка подстраивается под экран. Светлая и тёмная темы — в настройках БиоВиза.</p></div>`);
 for(const k of ['line','width','font'])$('[data-'+k+']',d).value=prefs[k];
 for(const k of ['size','line','width','font'])$('[data-'+k+']',d).addEventListener('input',e=>{prefs[k]=k==='font'?e.target.value:Number(e.target.value);store.set('reading:prefs',prefs);$('[data-size-label]',d).textContent=prefs.size;applyPrefs()})
}
function toggleMark(){if(!active)return;const id=active.id,position=active.position(),marks=bookmarks(id);const key=position.topic?'t:'+position.topic:'p:'+position.page;
 const i=marks.findIndex(m=>m.key===key);if(i>=0)marks.splice(i,1);else marks.push({...position,key,t:Date.now()});store.set('reading:marks:'+id,marks);paintMark();BV.toast(i>=0?'Закладка удалена':'Закладка сохранена')}
function paintMark(){const b=$('[data-rd="mark"]',page);if(!b||!active)return;const p=active.position(),key=p.topic?'t:'+p.topic:'p:'+p.page;const has=bookmarks(active.id).some(x=>x.key===key);b.textContent=has?'★ В закладках':'☆ Закладка';b.setAttribute('aria-pressed',String(has))}
function showMarks(){if(!active)return;const marks=bookmarks(active.id),id=active.id;
 const d=openDialog('Мои закладки',marks.length?marks.map(m=>`<div class="rd-bookmark-row"><a href="${m.topic?href(m.topic):id==='alberts'?'#/reading/alberts/pdf/'+m.page:'#/reading/pdf/'+esc(id)}" data-mark-page="${m.page}">${esc(m.title||'Страница '+m.page)}<small class="rd-sub"> · PDF ${m.page}</small></a><button type="button" class="btn ghost" data-remove-mark="${esc(m.key)}" aria-label="Удалить закладку">×</button></div>`).join(''):'<p class="rd-sub">Нажми «☆ Закладка» во время чтения, чтобы вернуться к этому месту.</p>');
 $$('[data-mark-page]',d).forEach(a=>a.onclick=e=>{if(active&&active.mode==='pdf'&&id===active.id&&!a.getAttribute('href').includes('/alberts/')&&!a.getAttribute('href').includes('/alberts/pdf/')){e.preventDefault();active.go(Number(a.dataset.markPage))}closeDialog()});
 $$('[data-remove-mark]',d).forEach(b=>b.onclick=()=>{store.set('reading:marks:'+id,bookmarks(id).filter(m=>m.key!==b.dataset.removeMark));paintMark();showMarks()})
}

/* ---------- Native book: one microtopic per view; every source page reachable ---------- */
async function native(m,token){const meta=await manifest();if(!fresh(token))return;
 const list=allTopics(meta),saved=progress('alberts'),id=m.topic||saved.topic||'1-intro',entry=list.find(t=>t.id===id);
 if(!entry)throw new Error('Такой микротемы нет. Вернись к содержанию книги.');
 const ch=await chapter(entry.chapter);if(!fresh(token))return;const t=ch.topics.find(t=>t.id===id),index=list.findIndex(t=>t.id===id);
 let sourcePage=t.page,scrollTimer=0;
 const section=t.number?t.number.split('.').slice(0,2).join('.'):null;
 const next=list[index+1],isSectionEnd=section&&(!next||!next.number||!next.number.startsWith(section+'.'))&&t.level===3;
 page.innerHTML=crumbs('Альбертс · Том 1')+`<div class="rd-location"><span>АЛЬБЕРТС · ТОМ 1</span><span>Глава ${entry.chapter||'·'}</span><a href="#/reading/practice">Банк заданий</a></div>
 <div class="rd-reader-bar">${btn('Содержание','toc')}${btn('Поиск','search')}${btn('☆ Закладка','mark','aria-pressed="false"')}${btn('Закладки','marks')}<span class="rd-spacer"></span>${btn('Aa','settings','aria-label="Настройки чтения"')}${btn('⛶','full','aria-label="На весь экран"')}${btn('Текст PDF','verbatim','aria-label="Текст PDF-страницы"')}${btn('Оригинал PDF','original')}</div>
 <div class="rd-progress" role="progressbar" aria-label="Положение в книге" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(t.page/meta.pages*100)}"><i style="width:${t.page/meta.pages*100}%"></i></div>
 <article class="rd-text${prefs.font==='sans'?' sans':''}" data-rd-topic="${esc(t.id)}" aria-labelledby="rd-topic-title"><p class="eyebrow">${esc(t.number||'Введение')}${t.level===3?' · Микротема':''}</p><h2 id="rd-topic-title"${sourceAttr(t.sourceTitle)}>${t.sourceTitle?t.sourceTitle.html:esc(t.title)}</h2>${nativeBlocks(t)}</article>
 <div class="rd-check" data-inline></div><nav class="rd-after" aria-label="Чтение по порядку">${index>0?`<a href="${href(list[index-1].id)}"><small>← Предыдущая микротема</small>${esc(list[index-1].title)}</a>`:'<a href="#/reading"><small>← К библиотеке</small>Моя полка</a>'}${next?`<a href="${href(next.id)}"><small>Дальше →</small>${esc(next.title)}</a>`:'<a href="#/reading/practice"><small>Том прочитан</small>Перейти к закреплению →</a>'}</nav><p class="rd-sub" style="align-self:center;max-width:740px">Текст и иллюстрации: Альбертс и соавторы, 5-е издание, том 1 (2012). Исходные символы текста сохранены. Для просмотра печатной вёрстки рядом доступен оригинал. Практика БиоВиза составлена отдельно.</p>`;
 applyPrefs();BVHOST.host.classList.add('rd-reading');
 const save=()=>{const markers=$$('[data-source-page]',page);let pos=null;for(const marker of markers){if(marker.getBoundingClientRect().top<innerHeight*.55)pos=marker;else break}if(pos)sourcePage=Number(pos.dataset.sourcePage);
  const article=$('.rd-text',page),bounds=article.getBoundingClientRect();const ratio=Math.max(0,Math.min(1,(160-bounds.top)/Math.max(1,bounds.height)));
  saveProgress('alberts',{topic:id,page:sourcePage,ratio,mode:'native'})};
 const onscroll=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(save,250)};addEventListener('scroll',onscroll,{passive:true});
 active={mode:'native',id:'alberts',meta,topic:t,position:()=>({topic:id,page:sourcePage,title:(t.number?t.number+' ':'')+t.title}),save,cleanup:()=>{removeEventListener('scroll',onscroll);clearTimeout(scrollTimer)}};
 paintMark();
 const ratio=saved.topic===id?saved.ratio||0:0;
 requestAnimationFrame(()=>{if(!fresh(token))return;const art=$('.rd-text',page);if(ratio>0){const y=art.getBoundingClientRect().top+scrollY+art.getBoundingClientRect().height*ratio-160;window.scrollTo({top:Math.max(0,y)})}else window.scrollTo({top:0});saveProgress('alberts',{topic:id,page:t.page,mode:'native'})});
 // Figure dimensions reserve layout space, so resume does not move after loading.
 $$('[data-figure]',page).forEach(b=>b.onclick=()=>{const img=$('img',b),d=openDialog('Иллюстрация · PDF '+b.dataset.figure,`<p class="rd-sub">Нажми на рисунок для увеличения. Прокручивай, чтобы рассмотреть детали.</p><img src="${esc(img.src)}" alt="${esc(img.alt)}">`,'rd-image-dialog');$('img',d).onclick=e=>e.target.classList.toggle('zoomed')});
 if(isSectionEnd){const qs=await questions();if(!fresh(token))return;const subset=qs.filter(q=>q.section===section);if(subset.length){$('[data-inline]',page).innerHTML=`<div class="rd-quiz-head"><h2>Проверь понимание</h2><a href="#/reading/practice/${section}">Все задания по теме: ${subset.length} →</a></div>`+practiceOrder(subset).slice(0,4).map(questionHTML).join('');bindQuestions($('[data-inline]',page))}}
}
function sourceAttr(block){if(!block||!block.source)return '';const s=block.source;return ' data-rd-source="'+esc(s.page+':'+s.block+':'+s.lines.join(','))+'"'}
function nativeBlocks(t){let last=0,out='';for(const b of t.blocks){if(b.page!==last){last=b.page;out+=`<div class="rd-source" data-source-page="${last}" id="rd-source-${last}"><a href="#/reading/alberts/pdf/${last}" aria-label="Открыть страницу ${last} оригинала">Оригинал · PDF ${last}</a></div>`}
 if(b.kind==='p')out+='<p'+sourceAttr(b)+'>'+b.html+'</p>';
 else if(b.kind==='caption')out+='<aside class="rd-caption"'+sourceAttr(b)+'>'+b.html+'</aside>';
 else if(b.kind==='heading')out+='<h3'+sourceAttr(b)+'>'+b.html+'</h3>';
 else if(b.kind==='running')out+='<div class="rd-running"'+sourceAttr(b)+'>'+b.html+'</div>';
 else if(b.kind==='figure')out+=`<figure class="rd-figure"><button type="button" data-figure="${b.page}" aria-label="Увеличить иллюстрацию со страницы ${b.page}"><img src="${BASE+esc(b.src)}?v=${encodeURIComponent(VER)}" width="${b.width}" height="${b.height}" alt="${esc(b.alt)}" loading="lazy" decoding="async"></button><figcaption>Иллюстрация из книги · нажми для увеличения</figcaption></figure>`
 }return out||'<p class="rd-sub">Это начало раздела. Переходи к следующей микротеме.</p>'}
async function nativeToc(){const meta=await manifest(),topic=active&&active.topic;
 const d=openDialog('Содержание · Том 1',`<ul class="rd-toc">${meta.chapters.map(c=>`<li><details${topic&&topic.chapter===c.n?' open':''}><summary>${c.n?'Глава '+c.n+'. ':''}${esc(c.title)}</summary>${c.topics.map(t=>`<a class="level-${t.level}" href="${href(t.id)}"${topic&&topic.id===t.id?' aria-current="page"':''}><span class="rd-toc-number">${esc(t.number||'Введение')}</span>${esc(t.title)}</a>`).join('')}</details></li>`).join('')}</ul>`);
 $$('a',d).forEach(a=>a.onclick=closeDialog)
}
async function nativeSearch(){const d=openDialog('Поиск по всему тому','<input type="search" aria-label="Текст для поиска" placeholder="Например, репликация" data-search><div class="rd-status" role="status" data-search-status>Введи хотя бы два символа.</div><div data-results></div>');const input=$('[data-search]',d),results=$('[data-results]',d),s=$('[data-search-status]',d);let run=0;
 input.focus();input.oninput=async()=>{const seq=++run,query=input.value.trim().toLocaleLowerCase('ru');results.innerHTML='';if(query.length<2){status(s,'Введи хотя бы два символа.');return}status(s,'Ищу по книге…');
 try{const data=await(searchPromise||(searchPromise=json('search.json').catch(e=>{searchPromise=null;throw e})));if(!d.isConnected||seq!==run)return;const hits=data.filter(t=>(t.title+' '+t.text).toLocaleLowerCase('ru').includes(query));
  status(s,hits.length?'Найдено микротем: '+hits.length+(hits.length>60?'. Показаны первые 60; уточни запрос.':''):'Совпадений нет.');
  results.innerHTML=hits.slice(0,60).map(t=>{const at=t.text.toLocaleLowerCase('ru').indexOf(query),excerpt=t.text.slice(Math.max(0,at-65),Math.max(0,at-65)+240);return`<div class="rd-search-hit"><a href="${href(t.id)}">${esc(t.title)}</a><p>${esc(excerpt)}…</p><small class="rd-sub">Глава ${t.chapter} · PDF ${t.page}</small></div>`}).join('');$$('a',results).forEach(a=>a.onclick=closeDialog)
 }catch(e){status(s,e.message,true)}}
}
async function verbatim(){if(!active||active.id!=='alberts')return;const owner=active;if(owner.save)owner.save();const start=owner.position().page;
 const data=await(verbatimPromise||(verbatimPromise=json('verbatim.json').catch(e=>{verbatimPromise=null;throw e})));if(active!==owner)return;
 const d=openDialog('Дословный текст страницы',`<p class="rd-sub">Текстовый слой исходного PDF, без сокращений и изменений. Формулы и расположение элементов можно сверить с оригиналом.</p><div class="rd-tools" style="margin-top:14px"><label>PDF <input type="number" min="1" max="${data.pages.length}" value="${start}" aria-label="Страница дословного текста" style="width:85px;padding:8px"></label><a class="btn ghost" data-original-page href="#/reading/alberts/pdf/${start}">Оригинал страницы</a></div><pre class="rd-verbatim" data-verbatim></pre>`);
 const paint=()=>{const n=Math.max(1,Math.min(data.pages.length,Math.floor(Number($('input',d).value)||1)));$('input',d).value=n;$('[data-verbatim]',d).textContent=data.pages[n-1].text||'На этой странице нет текстового слоя.';$('[data-original-page]',d).href='#/reading/alberts/pdf/'+n};$('input',d).onchange=paint;$('[data-original-page]',d).onclick=closeDialog;paint()
}

/* ---------- PDF reader: paged or virtualized continuous, selectable text ---------- */
async function pdfjs(){if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
 return pdfPromise||(pdfPromise=import(new URL('bioviz/vendor/pdfjs/pdf.mjs',document.baseURI).href).then(lib=>{lib.GlobalWorkerOptions.workerSrc=new URL('bioviz/vendor/pdfjs/pdf.worker.mjs',document.baseURI).href;return lib}).catch(e=>{pdfPromise=null;throw new Error('Не загрузилась читалка PDF. Проверь интернет и повтори попытку.')}))}
async function pdf(m,token){const lib=await pdfjs();if(!fresh(token))return;let source,title,record=null,meta=null;
 if(m.id==='alberts'){meta=await manifest();source={url:new URL(BASE+'source.pdf',document.baseURI).href};title='Альбертс · Молекулярная биология клетки · Том 1'}
 else{record=await local('get',m.id);if(!record)throw new Error('Этого PDF нет в библиотеке этого браузера. Возможно, его удалили или добавили на другом устройстве.');source={data:new Uint8Array(await record.blob.arrayBuffer())};title=record.title}
 if(!fresh(token))return;
 page.innerHTML=crumbs(title)+`<h1 style="font-size:clamp(23px,4vw,35px)">${esc(title)}</h1><p class="rd-status" role="status" data-load>Загружаю PDF…</p>`;
 const task=lib.getDocument({...source,cMapUrl:new URL('bioviz/vendor/pdfjs/cmaps/',document.baseURI).href,cMapPacked:true,standardFontDataUrl:new URL('bioviz/vendor/pdfjs/standard_fonts/',document.baseURI).href,isEvalSupported:false,enableScripting:false});
 let passwordReject=null;
 active={id:m.id,mode:'pdf',cleanup:()=>{if(passwordReject)passwordReject();task.destroy().catch(()=>{})}};
 task.onPassword=(update,reason)=>{if(!fresh(token))return;const d=openDialog('PDF защищён паролем',`<form data-password><p class="rd-sub">${reason===2?'Пароль не подошёл. Попробуй ещё раз.':'Введи пароль к учебнику.'}</p><input type="password" aria-label="Пароль к PDF" autocomplete="off" required style="padding:12px;width:100%;margin:14px 0"><button class="btn">Открыть</button></form>`);passwordReject=()=>{task.destroy().catch(()=>{})};d.addEventListener('close',()=>{if(passwordReject){passwordReject();if(fresh(token))failure(new Error('Открытие PDF отменено.'),token)}});$('form',d).onsubmit=e=>{e.preventDefault();const password=$('input',d).value;passwordReject=null;closeDialog();update(password)}};
 let documentPDF;try{documentPDF=await task.promise}catch(e){if(fresh(token))throw new Error(e.name==='InvalidPDFException'?'Файл повреждён или не является корректным PDF.':e.name==='PasswordException'?'Для открытия PDF нужен верный пароль.':'Не удалось открыть PDF. Проверь файл и доступ к интернету.');return}
 if(!fresh(token)){task.destroy().catch(()=>{});return}
 if(record){record.pages=documentPDF.numPages;await local('put',record).catch(()=>{})}
 if(!fresh(token)){task.destroy().catch(()=>{});return}
 const saved=progress(m.id),state={p:Math.max(1,Math.min(documentPDF.numPages,Math.floor(m.page||saved.page||1))),zoom:saved.zoom||'width',flow:saved.flow===true,seq:0,tasks:new Set(),textTasks:new Set(),observer:null,rendered:new Map(),rendering:new Set(),offset:m.page?0:saved.offset||0};
 let resizeTimer=0,scrollTimer=0,renderQueue=Promise.resolve();
 page.innerHTML=crumbs(title)+`<div class="rd-location"><strong class="rd-current">${esc(title)}</strong>${m.id==='alberts'?`<a href="${href(saved.topic||'1-intro')}">Адаптивный текст →</a>`:''}</div>
 <div class="rd-reader-bar">${btn('Содержание','toc')}${btn('Поиск','search')}${btn('←','prev','aria-label="Предыдущая страница"')}<label><input type="number" data-pdf-number aria-label="Номер страницы PDF" min="1" max="${documentPDF.numPages}" value="${state.p}"></label><span class="rd-sub">/ ${documentPDF.numPages}</span>${btn('→','next','aria-label="Следующая страница"')}
 <select data-pdf-zoom aria-label="Масштаб PDF"><option value="width">По ширине</option><option value="page">Страница целиком</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option></select>${btn('Лента','flow','aria-pressed="'+state.flow+'"')}${btn('☆ Закладка','mark')}${btn('Закладки','marks')}${btn('⛶','full','aria-label="На весь экран"')}</div>
 <div class="rd-pdf-stage" data-stage aria-label="Страницы PDF" tabindex="0"></div><p class="rd-status" role="status" aria-live="polite" data-pdf-status></p>`;
 const stage=$('[data-stage]',page),s=$('[data-pdf-status]',page);$('[data-pdf-zoom]',page).value=state.zoom;
 const cancel=()=>{state.seq++;if(state.observer)state.observer.disconnect();state.tasks.forEach(t=>t.cancel());state.tasks.clear();state.textTasks.forEach(t=>t.cancel());state.textTasks.clear();state.rendered.clear();state.rendering.clear()};
 const save=()=>saveProgress(m.id,{page:state.p,zoom:state.zoom,flow:state.flow,offset:stage.scrollTop,mode:'pdf'});
 const update=()=>{if(!fresh(token))return;$('[data-pdf-number]',page).value=state.p;$('[data-rd="prev"]',page).disabled=state.p<=1;$('[data-rd="next"]',page).disabled=state.p>=documentPDF.numPages;paintMark();save()};
 const scaleFor=viewport=>{const width=Math.max(180,stage.clientWidth-(innerWidth<=760?16:32)-4);if(state.zoom==='width')return width/viewport.width;if(state.zoom==='page')return Math.min(width/viewport.width,Math.max(180,stage.clientHeight-32)/viewport.height);return Number(state.zoom)||1};
 async function renderPage(n,holder,seq){if(state.rendering.has(n)||state.rendered.has(n)||!fresh(token)||seq!==state.seq)return;
  state.rendering.add(n);try{const p=await documentPDF.getPage(n);if(!fresh(token)||seq!==state.seq)return;const vp=p.getViewport({scale:scaleFor(p.getViewport({scale:1}))});const dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(10000000/(vp.width*vp.height)));
   holder.style.width=vp.width+'px';holder.style.height=vp.height+'px';holder.style.setProperty('--scale-factor',vp.scale);holder.innerHTML='';
   const canvas=document.createElement('canvas');canvas.width=Math.floor(vp.width*dpr);canvas.height=Math.floor(vp.height*dpr);canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Страница '+n+' PDF');holder.appendChild(canvas);
   const render=p.render({canvasContext:canvas.getContext('2d'),viewport:vp,transform:dpr===1?null:[dpr,0,0,dpr,0,0]});state.tasks.add(render);try{await render.promise}finally{state.tasks.delete(render)}
   if(!fresh(token)||seq!==state.seq)return;
   const text=document.createElement('div');text.className='textLayer';holder.appendChild(text);const layer=new lib.TextLayer({textContentSource:p.streamTextContent(),container:text,viewport:vp});state.textTasks.add(layer);try{await layer.render()}finally{state.textTasks.delete(layer)}
   state.rendered.set(n,holder);status(s,'');
  }catch(e){if(fresh(token)&&seq===state.seq&&e.name!=='RenderingCancelledException'&&e.name!=='AbortException')status(s,'Не удалось отобразить страницу '+n+'. Попробуй другой масштаб или открой файл заново.',true)}finally{if(seq===state.seq)state.rendering.delete(n)}
 }
 async function build(restoreOffset=false){cancel();const seq=state.seq;stage.setAttribute('aria-busy','true');stage.innerHTML='';
  try{const first=await documentPDF.getPage(state.p);if(!fresh(token)||seq!==state.seq)return;const vp=first.getViewport({scale:scaleFor(first.getViewport({scale:1}))});
   const holder=n=>{const el=document.createElement('div');el.className='rd-pdf-page';el.dataset.pdfPage=n;el.style.width=vp.width+'px';el.style.height=vp.height+'px';el.innerHTML='<span data-page-label>PDF '+n+'</span>';return el};
   if(!state.flow){const el=holder(state.p);stage.appendChild(el);await renderPage(state.p,el,seq);if(seq===state.seq)stage.scrollTop=restoreOffset?state.offset:0}
   else{const frag=document.createDocumentFragment();for(let n=1;n<=documentPDF.numPages;n++)frag.appendChild(holder(n));stage.appendChild(frag);
    const target=$('[data-pdf-page="'+state.p+'"]',stage);stage.scrollTop=restoreOffset&&state.offset?state.offset:Math.max(0,target.offsetTop-16);
    // Render serially; only the visible neighborhood holds canvases/text layers.
    state.observer=new IntersectionObserver(entries=>{if(seq!==state.seq)return;for(const e of entries)if(e.isIntersecting){const n=Number(e.target.dataset.pdfPage);renderQueue=renderQueue.catch(()=>{}).then(()=>renderPage(n,e.target,seq))}}, {root:stage,rootMargin:'350px 0px'});
    $$('[data-pdf-page]',stage).forEach(el=>state.observer.observe(el));await renderPage(state.p,target,seq)
   }
   update()
  }finally{if(fresh(token)&&seq===state.seq)stage.setAttribute('aria-busy','false')}
 }
 function go(n){n=Math.max(1,Math.min(documentPDF.numPages,Math.floor(Number(n)||1)));state.p=n;update();if(state.flow){const el=$('[data-pdf-page="'+n+'"]',stage);if(el)stage.scrollTop=Math.max(0,el.offsetTop-16);return}build().catch(e=>status(s,e.message,true))}
 stage.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(!fresh(token))return;if(state.flow){const viewport=stage.getBoundingClientRect();const holders=$$('[data-pdf-page]',stage);let best=state.p,visible=0;for(const el of holders){const r=el.getBoundingClientRect(),height=Math.max(0,Math.min(r.bottom,viewport.bottom)-Math.max(r.top,viewport.top));if(height>visible){visible=height;best=Number(el.dataset.pdfPage)}}state.p=best;
   for(const [n,el] of state.rendered)if(Math.abs(n-best)>3){el.innerHTML='<span data-page-label>PDF '+n+'</span>';state.rendered.delete(n)}update()}else save()},200)},{passive:true});
 let observedWidth=stage.clientWidth;const onresize=()=>{if(stage.clientWidth!==observedWidth){observedWidth=stage.clientWidth;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(fresh(token))build().catch(()=>{})},200)}};
 // Observe width only: scrolling a long page does not restart PDF rendering.
 const widthObserver=new ResizeObserver(onresize);widthObserver.observe(stage);
 const key=e=>{if(!fresh(token)||dialog||/^(INPUT|TEXTAREA|SELECT)$/.test(BV_ET(e).tagName)||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(state.p+1)}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(state.p-1)}};ROOT.addEventListener('keydown',key);
 active={id:m.id,mode:'pdf',meta,documentPDF,state,position:()=>({page:state.p,title:'Страница '+state.p+' · '+title}),go,save,
  toggleFlow(){state.flow=!state.flow;const b=$('[data-rd="flow"]',page);b.setAttribute('aria-pressed',String(state.flow));b.textContent=state.flow?'Лента ✓':'Лента';build().catch(e=>status(s,e.message,true))},
  cleanup(){cancel();clearTimeout(resizeTimer);clearTimeout(scrollTimer);widthObserver.disconnect();ROOT.removeEventListener('keydown',key);task.destroy().catch(()=>{})}};
 $('[data-pdf-number]',page).onchange=e=>go(e.target.value);$('[data-pdf-number]',page).onkeydown=e=>{if(e.key==='Enter')go(e.target.value)};
 $('[data-pdf-zoom]',page).onchange=e=>{state.zoom=e.target.value;build().catch(er=>status(s,er.message,true))};
 await build(true)
}
async function pdfToc(){if(!active||active.mode!=='pdf')return;const owner=active,outline=await owner.documentPDF.getOutline();if(active!==owner)return;
 if(!outline||!outline.length){if(owner.id==='alberts')return nativeToc();openDialog('Содержание','<p class="rd-sub">В этом PDF нет встроенного оглавления. Используй поиск по тексту, номер страницы или свои закладки.</p>');return}
 let targets=[];
 function links(nodes,level=0){return nodes.map(node=>{const i=targets.push(node.dest)-1;return`<li><a href="#" data-pdf-dest="${i}" style="padding-left:${10+level*14}px">${esc(node.title)}</a>${node.items&&node.items.length?'<ul class="rd-toc">'+links(node.items,level+1)+'</ul>':''}</li>`}).join('')}
 const d=openDialog('Содержание PDF','<ul class="rd-toc">'+links(outline)+'</ul>');
 $$('[data-pdf-dest]',d).forEach(a=>a.onclick=async e=>{e.preventDefault();try{let dest=targets[Number(a.dataset.pdfDest)];if(typeof dest==='string')dest=await owner.documentPDF.getDestination(dest);if(!dest){BV.toast('У этой записи нет ссылки на страницу.');return}const n=typeof dest[0]==='number'?dest[0]:await owner.documentPDF.getPageIndex(dest[0]);if(active===owner){owner.go(n+1);closeDialog()}}catch(e){BV.toast('Не удалось перейти к странице.')}})
}
async function pdfSearch(){if(!active||active.mode!=='pdf')return;const owner=active,d=openDialog('Поиск в PDF','<form data-find><input type="search" aria-label="Поиск в PDF" placeholder="Слово или фраза" required minlength="2"><button class="btn">Найти</button></form><p class="rd-status" data-search-status role="status">Поиск работает, если в PDF есть текстовый слой.</p><div data-results></div>');let run=0;
 $('input',d).focus();$('form',d).onsubmit=async e=>{e.preventDefault();const seq=++run,query=$('input',d).value.trim().toLocaleLowerCase('ru'),results=$('[data-results]',d),s=$('[data-search-status]',d);if(query.length<2)return;results.innerHTML='';let hits=0,characters=0;
  for(let n=1;n<=owner.documentPDF.numPages;n++){if(!d.isConnected||seq!==run||active!==owner)return;status(s,'Ищу · страница '+n+' / '+owner.documentPDF.numPages+' · найдено '+hits);
   try{const p=await owner.documentPDF.getPage(n),content=await p.getTextContent();const text=content.items.map(i=>i.str||'').join(' ');characters+=text.length;const at=text.toLocaleLowerCase('ru').indexOf(query);if(at>=0){hits++;const el=document.createElement('div');el.className='rd-search-hit';el.innerHTML=`<a href="#">Страница ${n}</a><p>${esc(text.slice(Math.max(0,at-55),at+180))}…</p>`;$('a',el).onclick=e=>{e.preventDefault();if(active===owner)owner.go(n);closeDialog()};results.appendChild(el)}
   }catch(e){if(!d.isConnected||active!==owner)return;status(s,'Поиск прерван. Попробуй ещё раз.',true);return}
   if(hits>=100){status(s,'Найдено 100 страниц. Уточни запрос.');return}if(n%8===0)await new Promise(r=>setTimeout(r,0))
  }status(s,!characters?'В этом PDF нет доступного текстового слоя. Для поиска по скану потребуется распознавание текста.':hits?'Найдено страниц: '+hits:'Совпадений нет.')
 }
}

/* ---------- Practice: persisted attempts, feedback, self-assessment ---------- */
const attempt=id=>store.get('reading:answer:'+id,null);
function practiceOrder(list){const tests=list.filter(q=>q.type==='mcq'),written=list.filter(q=>q.type==='think'),out=[];let i=0,j=0;
 while(i<tests.length||j<written.length){out.push(...tests.slice(i,i+3));i+=3;if(j<written.length)out.push(written[j++])}return out}
function adaptationHTML(q){const a=q.adaptation;if(!a||!/^https:\/\//.test(a.url))return'';
 const link=a.url.split('#')[0]+'#page='+a.page;
 return`<details class="rd-provenance"><summary>Источник: ${esc(a.label)} · адаптация</summary><p><a href="${esc(link)}" target="_blank" rel="noopener noreferrer" data-practice-source>${esc(a.title)} · PDF ${a.page} ↗</a></p><p>${esc(a.kind)}. ${esc(a.task)}.</p><p>${esc(a.changes)}</p>${a.credit?'<p>'+esc(a.credit)+'.</p>':''}${a.license&&/^https:\/\//.test(a.licenseUrl)?'<p><a href="'+esc(a.licenseUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(a.license)+'</a></p>':''}</details>`}
function questionHTML(q){const old=attempt(q.id);return`<section class="rd-question" tabindex="-1" data-question="${esc(q.id)}"><p class="eyebrow">${esc(q.section)} · ${q.type==='mcq'?'Тест на понимание':'На подумать'}${old&&typeof old.ok==='boolean'?' · '+(old.ok?'закреплено':'к повторению'):''}</p><h3>${esc(q.prompt)}</h3>${q.type==='mcq'?`<fieldset aria-label="Варианты ответа">${q.options.map((o,i)=>`<label><input type="radio" name="${esc(q.id)}" value="${i}"${old&&old.chosen===i?' checked':''}><span>${esc(o)}</span></label>`).join('')}</fieldset><div class="rd-tools">${btn('Проверить','answer')}</div>`:`<label class="rd-sub" for="answer-${esc(q.id)}">Сформулируй ответ своими словами</label><textarea id="answer-${esc(q.id)}" data-thought placeholder="Гипотеза, объяснение, ожидаемый результат…">${esc(old&&old.draft||'')}</textarea><div class="rd-tools">${btn('Свериться с разбором','reveal')}</div>`}<div data-feedback role="status" aria-live="polite"></div><p class="rd-sub" style="margin-top:14px"><a href="${href(q.sourceTopic)}">${q.sourceTopic.split('-').length>2?'К микротеме':'К теме'} ${esc(q.sourceTopic.replace(/-/g,'.'))} →</a> · <a href="#/reading/alberts/pdf/${q.sourcePage}">PDF ${q.sourcePage}</a></p>${adaptationHTML(q)}</section>`}
function bindQuestions(box){$$('[data-thought]',box).forEach(input=>{let timer;input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{const id=input.closest('[data-question]').dataset.question;store.set('reading:answer:'+id,{...(attempt(id)||{}),draft:input.value,t:Date.now()})},200)})})}
async function answerQuestion(button,reveal){const box=button.closest('[data-question]');if(!box)return;const list=await questions(),q=list.find(q=>q.id===box.dataset.question);if(!q)return;const feedback=$('[data-feedback]',box);
 if(q.type==='mcq'){const selected=$('input:checked',box);if(!selected){feedback.className='rd-feedback';feedback.textContent='Выбери вариант ответа.';return}const chosen=Number(selected.value),ok=chosen===q.correct;const previous=attempt(q.id);store.set('reading:answer:'+q.id,{ok,chosen,tries:(previous&&previous.tries||0)+1,t:Date.now()});feedback.className='rd-feedback'+(ok?'':' wrong');feedback.innerHTML='<b>'+(ok?'Верно.':'Пока нет. Верный ответ: '+esc(q.options[q.correct])+'.')+'</b> '+esc(q.explanation);button.textContent='Проверить ещё раз'
 }else{const draft=$('textarea',box).value,old=attempt(q.id);store.set('reading:answer:'+q.id,{...(old||{}),draft,t:Date.now()});feedback.className='rd-feedback';feedback.innerHTML='<b>Разбор.</b> '+esc(q.explanation)+'<div class="rd-tools">'+btn('Понимаю и могу объяснить','self-ok')+btn('Вернусь к этой теме','self-repeat')+'</div>';button.textContent='Показать разбор снова'}
 paintBankCount()
}
function paintBankCount(){const el=$('[data-bank-count]',page);if(!el)return;questions().then(qs=>{if(!el.isConnected)return;const done=qs.filter(q=>{const a=attempt(q.id);return a&&typeof a.ok==='boolean'}),ok=done.filter(q=>attempt(q.id).ok);el.textContent='Закреплено '+ok.length+' из '+qs.length+' · к повторению '+(done.length-ok.length)})}
async function bank(m,token){const [meta,qs]=await Promise.all([manifest(),questions()]);if(!fresh(token))return;const sections=allTopics(meta).filter(t=>t.level===2);
 const tests=qs.filter(q=>q.type==='mcq').length,adapted=qs.filter(q=>q.adaptation),sources=new Map(adapted.map(q=>[q.adaptation.group,q.adaptation.label]));
 page.innerHTML=crumbs('Банк заданий')+`<header class="hero"><p class="eyebrow">Альбертс · Том 1 · Закрепление</p><h1>Банк заданий</h1><p class="lead">${qs.length} заданий: ${tests} тестовых и ${qs.length-tests} письменных. По три теста на одно письменное в каждой теме.</p><p class="rd-sub">${adapted.length} адаптаций олимпиадных и университетских задач; источник — в карточке. Остальные задания составлены БиоВизом.</p></header><p class="rd-sub" data-bank-count></p><div class="rd-tools"><select data-bank-chapter aria-label="Глава заданий"><option value="">Все главы</option>${meta.chapters.filter(c=>c.n).map(c=>`<option value="${c.n}">${c.n}. ${esc(c.title)}</option>`).join('')}</select><select data-bank-section aria-label="Тема заданий"><option value="">Все темы</option>${sections.map(t=>`<option value="${esc(t.number)}">${esc(t.number+' '+t.title)}</option>`).join('')}</select><select data-bank-type aria-label="Тип заданий"><option value="">Все типы</option><option value="mcq">Тесты</option><option value="think">На подумать</option></select><select data-bank-source aria-label="Источник заданий"><option value="">Все источники</option><option value="original">Авторские БиоВиза</option><option value="adapted">Адаптации из сборников</option>${[...sources].sort((a,b)=>a[1].localeCompare(b[1],'ru')).map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select><select data-bank-status aria-label="Статус заданий"><option value="">Все задания</option><option value="new">Без ответа</option><option value="repeat">К повторению</option><option value="done">Закреплено</option></select>${btn('Перемешать','shuffle')}</div><p class="rd-status" data-visible-count role="status"></p><div class="rd-check" data-bank-list></div><nav class="rd-tools" aria-label="Страницы заданий" data-bank-pager>${btn('← Предыдущие','bank-prev')}<span class="rd-sub" data-bank-page></span>${btn('Следующие →','bank-next')}</nav>`;
 let order=qs.slice(),offset=0;const size=20,chapter=$('[data-bank-chapter]',page),section=$('[data-bank-section]',page),type=$('[data-bank-type]',page),source=$('[data-bank-source]',page),filter=$('[data-bank-status]',page);
 if(sections.some(s=>s.number===m.section)){section.value=m.section;chapter.value=m.section.split('.')[0]}
 function paint(){const list=practiceOrder(order.filter(q=>{const a=attempt(q.id),origin=q.adaptation;return(!chapter.value||String(q.chapter)===chapter.value)&&(!section.value||q.section===section.value)&&(!type.value||q.type===type.value)&&(!source.value||(source.value==='original'?!origin:source.value==='adapted'?!!origin:origin&&origin.group===source.value))&&(!filter.value||(filter.value==='new'?!(a&&typeof a.ok==='boolean'):filter.value==='repeat'?a&&a.ok===false:a&&a.ok===true))}));
  offset=Math.min(offset,Math.max(0,Math.ceil(list.length/size)-1));const start=offset*size,shown=list.slice(start,start+size);
  $('[data-visible-count]',page).textContent='Заданий в подборке: '+list.length+(list.length?' · показаны '+(start+1)+'–'+(start+shown.length):'');$('[data-bank-list]',page).innerHTML=shown.length?shown.map(questionHTML).join(''):'<p class="rd-sub">В этой подборке пока нет заданий. Измени фильтры.</p>';
  $('[data-bank-pager]',page).hidden=list.length<=size;$('[data-bank-page]',page).textContent=(offset+1)+' / '+Math.max(1,Math.ceil(list.length/size));
  $('[data-rd="bank-prev"]',page).disabled=offset===0;$('[data-rd="bank-next"]',page).disabled=start+size>=list.length;
  bindQuestions($('[data-bank-list]',page));paintBankCount()}
 const reset=()=>{offset=0;paint()};
 chapter.onchange=()=>{if(section.value&&chapter.value&&section.value.split('.')[0]!==chapter.value)section.value='';reset()};
 section.onchange=()=>{if(section.value)chapter.value=section.value.split('.')[0];reset()};type.onchange=source.onchange=filter.onchange=reset;
 active={id:'alberts',mode:'bank',step(d){offset=Math.max(0,offset+d);paint();const first=$('.rd-question',page);if(first){first.scrollIntoView({block:'start'});first.focus({preventScroll:true})}},shuffle(){for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}reset()}};paint()
}

/* ---------- Event delegation ---------- */
page.addEventListener('click',async e=>{const b=BV_ET(e).closest('[data-rd]');if(!b||!page.contains(b))return;const action=b.dataset.rd;
 try{
  if(action==='retry')return APP.refresh();
  if(action==='bank-prev'||action==='bank-next'){if(active&&active.mode==='bank')active.step(action==='bank-next'?1:-1);return}
  if(action==='delete'){const id=b.dataset.id,book=await local('get',id);if(!book)return;const d=openDialog('Удалить PDF с устройства?','<p class="rd-sub">'+esc(book.title)+'. Файл исчезнет с этой полки. Прогресс и закладки сохранятся.</p><div class="rd-tools" style="margin-top:16px">'+btn('Удалить PDF','confirm-delete')+'</div>');$('[data-rd="confirm-delete"]',d).onclick=async()=>{await local('delete',id);closeDialog();await localRows(generation)};return}
  if(action==='answer'||action==='reveal')return answerQuestion(b,action==='reveal');
  if(action==='self-ok'||action==='self-repeat'){const box=b.closest('[data-question]'),id=box.dataset.question;store.set('reading:answer:'+id,{...(attempt(id)||{}),ok:action==='self-ok',t:Date.now()});BV.toast(action==='self-ok'?'Отмечено как закреплённое':'Тема добавлена к повторению');paintBankCount();return}
  if(!active)return;
  if(action==='toc')return active.mode==='pdf'?pdfToc():nativeToc();
  if(action==='search')return active.mode==='pdf'?pdfSearch():nativeSearch();
  if(action==='verbatim')return verbatim();
  if(action==='mark')return toggleMark();if(action==='marks')return showMarks();if(action==='settings')return settings();
  if(action==='original'){active.save();return APP.go('#/reading/alberts/pdf/'+active.position().page)}
  if(action==='prev')return active.go(active.state.p-1);if(action==='next')return active.go(active.state.p+1);if(action==='flow')return active.toggleFlow();if(action==='shuffle')return active.shuffle();
  if(action==='full'){if(document.fullscreenElement)await document.exitFullscreen();else if(page.requestFullscreen)await page.requestFullscreen();else BV.toast('Этот браузер не поддерживает полноэкранный режим. Можно открыть сайт с домашнего экрана.');return}
 }catch(err){BV.toast(err.message||'Не удалось выполнить действие. Повтори попытку.',5000)}
});
})();
