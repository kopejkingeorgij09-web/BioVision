(function(){
'use strict';
const assets=new URL('.',document.currentScript.src);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const glossary={
'Ассимиляция':'Включение вещества или элемента в биомассу.',
'Анаплероз':'Пополнение промежуточных метаболитов, уходящих из циклического пути.',
'Амфиболический путь':'Путь, участвующий в катаболизме и снабжении биосинтеза.',
'Ауксотрофия':'Потребность в готовом соединении из-за неспособности синтезировать его в данных условиях.',
'Биоплёнка':'Пространственное сообщество у поверхности или интерфейса, связанное с матриксом.',
'Генотип':'Наследственная информация; её наличие не равно текущему проявлению.',
'Диссимиляция':'Превращения веществ в энергетическом обмене, в отличие от включения элемента в биомассу.',
'Дивисома':'Комплекс аппарата клеточного деления.',
'Донор электронов':'Вещество, отдающее электроны и окисляющееся.',
'Конечный акцептор':'Соединение, принимающее электроны на конце рассматриваемого процесса.',
'КОЕ':'Колониеобразующая единица: объект, давший колонию в условиях метода.',
'Культивируемость':'Способность размножаться в выбранных условиях выращивания.',
'Литотрофия':'Использование неорганического донора электронов.',
'Миксотрофия':'Сочетание источников углерода или других трофических режимов; определение уточняют по контексту.',
'Оперон':'Гены под совместной транскрипционной организацией.',
'Периплазма':'Пространство между внутренней и наружной мембранами типичной грамотрицательной клетки.',
'Персистенция':'Выживание субпопуляции при воздействии, не обязательно связанное с повышением наследственной MIC.',
'Промотор':'Участок ДНК, определяющий начало и регуляцию транскрипции.',
'Регулон':'Гены и опероны, объединённые регуляторным контролем.',
'Синтрофия':'Взаимодействие обменов, позволяющее энергетически затруднённые по отдельности процессы.',
'Субстратное фосфорилирование':'Непосредственный перенос фосфата с метаболита на ADP.',
'Толерантность':'Замедление гибели без обязательного повышения MIC.',
'Фенотип':'Наблюдаемые свойства генотипа в конкретных условиях.',
'Хемостат':'Система непрерывного подвода среды и выноса культуры.',
'Электрохимический градиент':'Совместное действие химической и электрической разности потенциалов.',
'Эндоспора':'Специализированная форма выживания, обычно одна из одной материнской клетки.'
};
function mount(root,opt={}){
if(root.dataset.mounted)return;
root.dataset.mounted='true';const B=window.MICROBOOK,refs=window.MICROSOURCES,photos=window.MICROPHOTOS;
const all=[...B.primer,...B.chapters.flatMap(c=>c.sections)],byId=new Map(all.map(s=>[s.id,s]));
const storage='phagi.microbiology.v1';let saved={done:[],last:null};
try{const s=JSON.parse(localStorage.getItem(storage));if(s&&typeof s==='object')saved={done:Array.isArray(s.done)?s.done.filter(x=>byId.has(x)):[],last:byId.has(s.last)?s.last:null};}catch{}
let route='home',lastFocus=null;
const write=()=>{try{localStorage.setItem(storage,JSON.stringify(saved));}catch{}};
const belongs=id=>B.chapters.find(c=>c.sections.some(s=>s.id===id));
const refHTML=(ids=Object.keys(refs))=>'<ol class="mb-source-list">'+ids.filter(id=>refs[id]).map(id=>{const r=refs[id];return'<li id="mb-ref-'+id+'">'+(r.url?'<a target="_blank" rel="noopener" href="'+esc(r.url)+'">'+esc(r.title)+'</a>':esc(r.title))+'<br><span class="mb-subtle">'+esc(r.detail)+'</span></li>';}).join('')+'</ol>';
const button=(id,text,cls='')=>'<button class="'+cls+'" data-open="'+esc(id)+'">'+text+'</button>';
root.innerHTML='<div class="mb-top"><span class="mb-brand">Фаги / Биовиз · учебник</span><button class="mb-mobile-contents" data-action="contents" aria-expanded="false">Содержание</button>'+button('home','Обзор')+'<button data-action="offline">Сохранить офлайн</button><button data-action="classroom" aria-pressed="false">На занятии</button><button data-action="theme" aria-label="Переключить тему учебника">◐ Тема</button></div><div class="mb-grid"><aside class="mb-side" aria-label="Содержание учебника"></aside><main class="mb-main" tabindex="-1"></main></div><dialog aria-label="Просмотр микрофотографии"><div class="mb-dialog-top"><strong class="mb-photo-title"></strong><button data-action="close-photo" aria-label="Закрыть микрофотографию">Закрыть</button></div><label class="mb-control">Масштаб просмотра (не калибровка) <input type="range" min="100" max="250" step="25" value="100" data-photo-zoom></label><div class="mb-dialog-image"></div><div class="mb-photo-description"></div></dialog>';
const main=root.querySelector('.mb-main'),side=root.querySelector('.mb-side'),dialog=root.querySelector('dialog');
function nav(){
side.innerHTML='<label class="mb-control"><span>Поиск по учебнику</span><input type="search" placeholder="Например: NADH" aria-label="Поиск по учебнику" autocomplete="off" value=""></label><div class="mb-search-results"></div><p class="mb-progress">Отмечено '+saved.done.length+' из '+all.length+' разделов.<br>Локальные отметки этого браузера.</p>'+button('primer','00 · Опорные знания')+B.chapters.map(c=>'<details'+(belongs(route)?.id===c.id?' open':'')+'><summary>'+c.number+'. '+esc(c.title)+'</summary>'+button('chapter:'+c.id,'Обзор главы')+c.sections.map((s,i)=>'<button data-open="'+s.id+'"'+(route===s.id?' aria-current="page"':'')+'>'+c.number+'.'+(i+1)+' '+esc(s.title)+(saved.done.includes(s.id)?' <span class="mb-done" aria-label="прочитано">✓</span>':'')+'</button>').join('')+'</details>').join('')+button('atlas','Атлас · 12 микрофотографий')+button('glossary','Словарь')+button('guide','Маршрут занятий и ASM')+button('sources','Источники и права');
}
const goals=c=>'<ul class="mb-steps">'+c.goals.map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul>';
function photoCard(p){return'<figure class="mb-photo"><button data-photo="'+p.id+'" aria-label="Открыть микрофотографию: '+esc(p.organism)+'"><img src="'+new URL('../img/prok/'+p.file,assets)+'" alt="'+esc(p.organism+'; '+p.method+'; '+p.title)+'" loading="lazy"></button><figcaption><strong>'+esc(p.organism)+'</strong>'+esc(p.title)+'<br>'+esc(p.method)+'<br><span class="mb-subtle">'+esc(p.author)+' · '+esc(p.license)+'</span></figcaption></figure>';}
function home(){return'<div class="mb-hero"><div class="mb-eyebrow">Микробиология · четыре занятия</div><h1>Жизнь в масштабе<br>одной клетки</h1><p class="mb-lead">От устройства оболочки до обмена электронов, роста и микробных сообществ. Подробная теория, управляемые модели и настоящие микрофотографии.</p><p>47 разделов в четырёх главах, 3 опорных раздела, 18 типов интерактивных схем. Читать можно последовательно или возвращаться к нужному механизму.</p>'+button(saved.last||'chemistry',saved.last?'Продолжить чтение':'Начать с опорных знаний','mb-primary')+' '+button('guide','Как работать с учебником')+'</div><div class="mb-cards">'+B.chapters.map(c=>'<section class="mb-card"><div class="mb-num">0'+c.number+'</div><div class="mb-eyebrow">'+esc(c.status)+'</div><h2>'+esc(c.title)+'</h2><p>'+esc(c.subtitle)+'</p>'+goals(c)+button('chapter:'+c.id,'Открыть главу')+'</section>').join('')+'</div><div class="mb-callout"><b>Маршрут чтения.</b> Сначала прочитай объяснение, предскажи результат модели и только затем измени параметр. После модели сформулируй механизм своими словами и открой разбор вопроса.</div><p class="mb-subtle">Охват: четырёхзанятийный блок о прокариотах; фаги рассмотрены в связи с генетикой бактерий. Учебные цели сопоставлены с ASM 2024. Все новые схемы обозначены как модели; реальные снимки собраны в отдельном атласе.</p>';}
function sectionHTML(s){const c=belongs(s.id),index=all.findIndex(x=>x.id===s.id);saved.last=s.id;write();return'<div class="mb-eyebrow">'+(c?'Занятие '+c.number+' · '+esc(c.title):'00 · Опорные знания')+'</div><h1>'+esc(s.title)+'</h1><article class="mb-body">'+s.body+'</article>'+(s.model==='atlas'?'<div class="mb-atlas">'+photos.slice(0,4).map(photoCard).join('')+'</div>'+button('atlas','Открыть весь атлас'):s.model?'<section class="mb-model" data-model="'+s.model+'"></section>':'')+'<section class="mb-check"><div class="mb-eyebrow">Проверь понимание</div><h2>'+esc(s.question)+'</h2><p class="mb-subtle">Сначала ответь своими словами. Черновик здесь не отправляется и не сохраняется.</p><label class="mb-control"><span>Твоё объяснение</span><textarea placeholder="Как связан механизм с результатом?"></textarea></label><details><summary>Открыть разбор</summary><p>'+esc(s.answer)+'</p></details></section><details><summary>Источники этого раздела</summary>'+refHTML(s.refs)+'</details><div class="mb-reading-nav">'+(index>0?button(all[index-1].id,'← Предыдущий'):'')+'<button data-action="done" aria-pressed="'+saved.done.includes(s.id)+'">'+(saved.done.includes(s.id)?'✓ Отмечено прочитанным':'Отметить прочитанным')+'</button>'+(index<all.length-1?button(all[index+1].id,'Следующий →'):'')+'</div><button data-action="copy-link">Скопировать ссылку на раздел</button><div class="mb-toast" role="status"></div>';}
function guide(){return'<div class="mb-eyebrow">Методический маршрут</div><h1>Как пройти четыре занятия</h1><p class="mb-lead">Теория рассчитана на самостоятельное чтение и совместный разбор. На занятии выбирайте механизмы и задачи; дополнительные разделы дают глубину для возвращения после урока.</p><ol class="mb-steps"><li><b>Занятие 1:</b> поверхность/объём → мембрана → стенка → Грам → осмос → подвижность и выживание. Заверши объяснением действия на мишень.</li><li><b>Занятие 2:</b> редокс-бюджет → три оси питания → центральные пути → брожение/дыхание → градиент → литотрофия/свет → биосинтез.</li><li><b>Занятие 3:</b> рост и g/μ → среды и ограничения → измерения → наследственный аппарат → мутации/перенос → регуляция и выживание.</li><li><b>Занятие 4:</b> ниша → круговороты → синтрофия → плёнка/QS → методы → дизайн → сквозная задача.</li></ol><h2>Основа будущей презентации к занятию 3</h2><p>Последовательность слайдов: рост против деления; логарифмическая шкала; g и μ; фазы; состав сред; селективность и дифференциация; кислородные ограничения; КОЕ; OD и калибровка; хемостат; мутация и отбор; три пути переноса; lac как два входа; фаги и персистенция; заключительная задача. Для демонстраций используй модели роста, КОЕ, Моно, переноса и lac.</p><h2>Сопоставление с ASM 2024</h2><div class="mb-table"><table><thead><tr><th>Направление</th><th>Где развивается</th><th>Наблюдаемый результат</th></tr></thead><tbody><tr><td>Структура и функция</td><td>Глава 1</td><td>Предсказать эффект на оболочку и объяснить предел вывода по фото.</td></tr><tr><td>Пути энергии и вещества</td><td>Главы 2 и 4</td><td>Проследить донор, акцептор и углерод; проверить бюджет.</td></tr><tr><td>Информация и эволюция</td><td>Глава 3</td><td>Разделить экспрессию, наследование, мутацию и отбор.</td></tr><tr><td>Экология и влияние микробов</td><td>Глава 4</td><td>Связать процессы сообщества с измеряемыми веществами.</td></tr><tr><td>Количественное мышление</td><td>Модели 1–4</td><td>Считать с единицами и назвать допущения.</td></tr><tr><td>Научные навыки</td><td>Атлас, методы и дизайн</td><td>Выбрать контроль, независимый повтор и допустимый вывод.</td></tr></tbody></table></div><p class="mb-subtle">ASM — ориентир целей и научного мышления; это сопоставление не является официальной аккредитацией. Для практических навыков нужны реальные занятия по правилам лаборатории.</p>'+refHTML(['asm'])}
function open(id,{hash=true,focus=true}={}){
if(!['home','primer','atlas','sources','guide','glossary'].includes(id)&&!id.startsWith('chapter:')&&!byId.has(id))id='home';
route=id;root.dataset.contents='false';root.querySelector('[data-action=contents]').setAttribute('aria-expanded','false');
if(byId.has(id))main.innerHTML=sectionHTML(byId.get(id));
else if(id==='home')main.innerHTML=home();
else if(id==='primer')main.innerHTML='<div class="mb-eyebrow">Перед углублением</div><h1>Три опорных блока</h1>'+B.primer.map(s=>'<section class="mb-card"><h2>'+esc(s.title)+'</h2>'+button(s.id,'Читать')+'</section>').join('');
else if(id.startsWith('chapter:')){const c=B.chapters.find(c=>c.id===id.split(':')[1]);if(!c){open('home');return;}main.innerHTML='<div class="mb-eyebrow">Занятие '+c.number+' · '+esc(c.status)+'</div><h1>'+esc(c.title)+'</h1><p class="mb-lead">'+esc(c.subtitle)+'</p><h2>Что ты сможешь объяснить</h2>'+goals(c)+'<h2>Разделы главы</h2><div class="mb-search-results">'+c.sections.map((s,i)=>button(s.id,c.number+'.'+(i+1)+' · '+esc(s.title))).join('')+'</div>';}
else if(id==='atlas')main.innerHTML='<div class="mb-eyebrow">Наблюдение и интерпретация</div><h1>Атлас микрофотографий</h1><p class="mb-lead">12 настоящих снимков из уже опубликованной коллекции платформы. Открой кадр, сравни метод, объект и то, что действительно различимо.</p><div class="mb-callout">Изображения не сгенерированы. Отдельная калиброванная линейка для этих учебных копий не задана; подписи об исходном увеличении не используются для измерений. Название организма взято у автора источника.</div><div class="mb-atlas">'+photos.map(photoCard).join('')+'</div>';
else if(id==='sources')main.innerHTML='<div class="mb-eyebrow">Проверяемость и права</div><h1>Источники</h1><p>Теория написана как самостоятельное объяснение. Основной текст проверялся по доступным учебным материалам; специальные уточнения связаны с публикациями ниже. В каждой теме есть собственный список. Источники снимков и лицензии указаны в просмотре каждого кадра.</p>'+refHTML()+'<h2>Что не использовано как прочитанный источник</h2><p>Найденный файл Шлегеля не дал извлекаемого текста и не указан как основание конкретных утверждений. Из предоставленных рабочих тетрадей взяты последовательность тем и контекст задач; спорные формулировки уточнены.</p><h2>Рисунки и модели</h2><p>Новые SVG — авторские учебные схемы. Численные модели имеют явные параметры и допущения; их результаты не выданы за экспериментальные данные. Переключатели не являются лабораторными протоколами.</p>'+button('atlas','Авторы и лицензии микрофотографий');
else if(id==='glossary')main.innerHTML='<div class="mb-eyebrow">Термины для возвращения</div><h1>Словарь</h1><dl>'+Object.entries(glossary).map(([k,v])=>'<dt><b>'+esc(k)+'</b></dt><dd>'+esc(v)+'</dd>').join('')+'</dl>';
else main.innerHTML=guide();
nav();main.querySelectorAll('[data-model]').forEach(el=>window.MicroModels.mount(el,el.dataset.model));
if(!opt.embedded&&hash)history.replaceState(null,'','#'+encodeURIComponent(id));
if(focus){main.focus({preventScroll:true});if(opt.embedded)root.scrollIntoView({block:'start',behavior:'instant'});else window.scrollTo(0,0);}
}
function showPhoto(id){const p=photos.find(x=>x.id===id);if(!p)return;lastFocus=root.getRootNode().activeElement||document.activeElement;dialog.querySelector('.mb-photo-title').textContent=p.organism+' · '+p.title;dialog.querySelector('.mb-dialog-image').innerHTML='<img src="'+new URL('../img/prok/'+p.file,assets)+'" alt="'+esc(p.organism+'; '+p.method)+'">';
dialog.querySelector('[data-photo-zoom]').value='100';dialog.querySelector('.mb-photo-description').innerHTML='<p>'+esc(p.observation)+'</p><p><b>Метод:</b> '+esc(p.method)+'<br><b>Масштаб:</b> '+esc(p.scale)+'<br><b>Автор:</b> '+esc(p.author)+'<br><b>Права:</b> '+(p.licenseURL?'<a href="'+p.licenseURL+'" target="_blank" rel="noopener">'+esc(p.license)+'</a>':esc(p.license))+'<br><a href="'+esc(p.source)+'" target="_blank" rel="noopener">Страница первоисточника и исходный файл</a></p>';dialog.showModal();}
root.addEventListener('click',async e=>{const target=e.target.closest('button');if(!target)return;if(target.dataset.open){open(target.dataset.open);return;}if(target.dataset.photo){showPhoto(target.dataset.photo);return;}const action=target.dataset.action;
if(action==='contents'){const on=root.dataset.contents!=='true';root.dataset.contents=String(on);target.setAttribute('aria-expanded',String(on));}
if(action==='theme')root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
if(action==='classroom'){const on=root.dataset.classroom!=='true';root.dataset.classroom=String(on);target.setAttribute('aria-pressed',String(on));}
if(action==='close-photo')dialog.close();
if(action==='offline'){
const old=target.textContent;target.disabled=true;target.textContent='Сохраняю…';
try{
if(!('caches' in window)||!('serviceWorker' in navigator))throw Error('offline unavailable');
await navigator.serviceWorker.register(new URL('../../sw.js',assets));
await navigator.serviceWorker.ready;
const cache=await caches.open('microbook-v1');
const urls=['','index.html','content.js?v=1','sources.js?v=1','models.js?v=1','reader.js?v=1','embed.js?v=1','style.css?v=1'].map(s=>new URL(s,assets).href).concat(photos.map(p=>new URL('../img/prok/'+p.file,assets).href));
await cache.addAll(urls);target.textContent='✓ Учебник сохранён';target.title='Прямая страница учебника и все 12 снимков доступны без сети';
}catch{target.textContent='Не удалось сохранить — повторить';target.title='Проверь подключение и доступное место';}
target.disabled=false;
}
if(action==='done'){saved.done=saved.done.includes(route)?saved.done.filter(x=>x!==route):[...saved.done,route];write();target.setAttribute('aria-pressed',String(saved.done.includes(route)));target.textContent=saved.done.includes(route)?'✓ Отмечено прочитанным':'Отметить прочитанным';nav();}
if(action==='copy-link'){const u=new URL('index.html',assets);u.hash=route;const toast=root.querySelector('.mb-toast');try{await navigator.clipboard.writeText(u.href);toast.textContent='Ссылка скопирована';}catch{toast.textContent='Ссылка: '+u.href;}}
});
dialog.addEventListener('close',()=>lastFocus?.focus?.());
root.addEventListener('input',e=>{if(e.target.matches('[data-photo-zoom]'))dialog.querySelector('.mb-dialog-image img').style.width=e.target.value+'%';
if(e.target.type==='search'){const q=e.target.value.trim().toLocaleLowerCase('ru'),dest=side.querySelector('.mb-search-results');if(q.length<2){dest.innerHTML='';return;}const found=all.filter(s=>(s.title+' '+s.body.replace(/<[^>]*>/g,' ')).toLocaleLowerCase('ru').includes(q));dest.innerHTML=found.length?found.slice(0,25).map(s=>button(s.id,esc(s.title))).join(''):'<p class="mb-subtle">Совпадений нет.</p>';}}
);
const media=matchMedia('(prefers-color-scheme: dark)');root.dataset.theme=opt.theme|| (media.matches?'dark':'light');
if(!opt.embedded)window.addEventListener('hashchange',()=>{let id='home';try{id=decodeURIComponent(location.hash.slice(1));}catch{}open(id,{hash:false});});
let initial='home';if(!opt.embedded&&location.hash){try{initial=decodeURIComponent(location.hash.slice(1));}catch{}}
open(initial,{focus:false});return{open,setTheme(t){root.dataset.theme=t==='dark'?'dark':'light';}};
}
window.MicroReader={mount,assets};
if(document.getElementById('microbook')&&!window.BVHOST)mount(document.getElementById('microbook'));
})();