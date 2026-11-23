/* A personal reading track. Reading is confirmed by the owner, never by opening a page. */
(function(){
const A=B.alberts={book:null}, {esc,icon}=B, KEY='study_alberts';
const manual=()=>Object.assign({start:'2026-11-16',deadline:'2026-12-31',current:17,records:[]},B.get(KEY)||{});
let cachedManual,cachedReader,cachedBook,cached;
A.state=()=>{
 const source=B.get(KEY),reader=B.get('study_alberts_reader');
 if(!A.book)return manual();
 if(cachedBook!==A.book||cachedManual!==source||cachedReader!==reader){
  cached=AlbertsPlan.withReader(A.book,manual(),reader);
  cachedManual=source;cachedReader=reader;cachedBook=A.book;
 }
 return cached;
};
A.status=(date=B.today())=>A.book?AlbertsPlan.status(A.book,A.state(),date):null;
A.pagesOn=date=>AlbertsPlan.pagesOn(A.state(),date);
A.url=page=>'https://kopejkingeorgij09-web.github.io/BioVision/#/reading/alberts/pdf/'+page;
A.chapter=page=>A.book?.chapters.find(c=>page>=c.from&&page<=c.to);
function migrate(){
 const h=B.get('h_read');
 if(h?.auto==='read'&&['Чтение','Молбио'].includes(h.name))B.put('h_read',Object.assign({},h,{name:'Молбио',auto:'molbio',molbioSince:'2026-11-16'}));
}
B.on('change',migrate);migrate();
function use(book){if(book?.chapters?.length&&book.pages===796&&book.firstPage===18){A.book=book;B.render?.();B.androidReminders?.queue();B.changed();}}
try{use(JSON.parse(localStorage.getItem('bamboo-alberts-book')||'null'));}catch(e){}
fetch('alberts-plan.json?v=1').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(book=>{try{localStorage.setItem('bamboo-alberts-book',JSON.stringify(book));}catch(e){}use(book);B.render?.();}).catch(()=>{});
function next(s){return s.resume??Math.min(A.book.pages,s.current+1);}
function parts(from,to){return A.book.chapters.filter(c=>c.from<=to&&c.to>=from).map(c=>`Глава ${c.n} · ${esc(c.title)} <span class="muted">(стр. PDF ${Math.max(from,c.from)}–${Math.min(to,c.to)})</span>`).join('<br>');}
A.card=()=>{
 const s=A.status();if(!s)return '<section class="card"><h2>Альбертс</h2><a href="#/tasks/alberts">Открыть план чтения →</a></section>';
 const c=A.chapter(Math.max(A.book.firstPage,next(s)));
 return `<section class="card alberts-card"><div class="row between"><h2>${icon('book')}Альбертс</h2><a class="muted" href="#/tasks/alberts">план →</a></div>
 <p class="study-next">${s.complete?'Том 1 прочитан':`Глава ${c.n} · ${esc(c.title)}`}</p>
 ${s.week?`<p class="muted">План ${B.fmtS(s.week.from)}–${B.fmtS(s.week.to)} · ${s.weekDone}/${s.week.pages} стр.</p>${B.bar(s.weekDone/s.week.pages)}`:''}
 ${s.complete?'':`<p class="hint">${s.week?`Цель — дочитать до стр. PDF ${s.week.pageTo}.`:s.expired?'Срок плана закончился. Прогресс сохранён.':'План начнётся '+B.fmt(s.plan[0].from)+'.'}</p>`}
 <div class="row wrap"><a class="btn sm" href="${A.url(next(s))}" target="_blank" rel="noopener">${s.complete?'Открыть книгу':'Продолжить чтение'}</a><button class="btn sm primary" data-act="albertsLog">Дочитал до…</button></div></section>`;
};
A.view=()=>{
 const s=A.status();if(!s)return '<section class="card"><p>Загружаю оглавление Альбертса…</p><button class="btn" data-act="albertsRetry">Повторить</button></section>';
 const c=A.chapter(Math.max(A.book.firstPage,next(s))),st=A.state();
 return `<section class="card alberts-hero"><div class="eyebrow">${esc(A.book.edition)}</div><h2>Молекулярная биология клетки</h2>
 <p>${s.complete?'Том прочитан':`Сейчас: глава ${c.n} · ${esc(c.title)}`}</p>
 <div class="alberts-progress"><b>${s.done}<small> / ${s.total} стр.</small></b><span>до 31 декабря</span></div>${B.bar(s.done/s.total)}
 <div class="row wrap"><a class="btn" href="${A.url(next(s))}" target="_blank" rel="noopener">Продолжить со стр. PDF ${next(s)}</a><button class="btn primary" data-act="albertsLog">Дочитал до…</button></div>
 <p class="hint">${B.get('study_alberts_reader')?'БиоВиз подключён. Учитываются прочитанные страницы и ручные отметки.':'Для переноса страниц и места чтения подключи свой профиль БиоВиза.'}</p>
 ${!B.get('study_alberts_reader')?'<button class="btn sm" data-act="albertsPair">Подключить БиоВиз</button>':''}</section>
 <section class="card"><h2>Текущий план</h2>${s.week?`<p><b>${s.weekDone} из ${s.week.pages} стр.</b> · ${B.fmtS(s.week.from)}–${B.fmtS(s.week.to)}</p><p>Стр. PDF ${s.week.pageFrom}–${s.week.pageTo}</p><p>${parts(s.week.pageFrom,s.week.pageTo)}</p>`:`<p>${s.complete?'План завершён.':s.expired?'Срок плана закончился; записи остаются доступны.':'План ещё не начался.'}</p>`}
 <p class="muted">Недельная цель, без обязательных дней чтения. Привычка «Молбио» отмечается в день записанного продвижения.</p>
 ${s.daysLeft&&!s.complete?`<details><summary>${s.lag?`Отставание от равномерного графика: ${s.lag} стр. · новый темп`:'Справочный темп до срока'}</summary><p>Осталось ${s.remaining} стр. и ${s.daysLeft} календарных дней. От текущего места: около ${s.weekly} стр. за ближайшие ${Math.min(7,s.daysLeft)} дней.</p><p class="muted">В среднем ${s.daily} стр. в календарный день; дневных дедлайнов нет. Недельный план ниже остаётся исходным ориентиром.</p></details>`:''}</section>
 <section class="card"><h2>План по неделям и главам</h2><div class="alberts-weeks">${s.plan.map((w,i)=>`<details class="alberts-week ${w===s.week?'on':''}" ${w===s.week?'open':''}><summary><span>${B.fmtS(w.from)}–${B.fmtS(w.to)}</span><b>${w.pages} стр. ${s.count(w.pageFrom,w.pageTo)===w.pages?'✓':''}</b></summary><p>Стр. PDF ${w.pageFrom}–${w.pageTo}</p><p>${parts(w.pageFrom,w.pageTo)}</p></details>`).join('')}</div></section>
 <section class="card"><h2>Главы</h2>${A.book.chapters.map(c=>{
 const days=AlbertsPlan.diff(st.start,st.deadline)+1,due=AlbertsPlan.add(st.start,Math.ceil((c.to-A.book.firstPage+1)*days/s.total)-1);
 return `<div class="alberts-chapter"><span>${s.count(c.from,c.to)===c.to-c.from+1?icon('check'):icon('book')}</span><div><b>${c.n}. ${esc(c.title)}</b><p class="muted">${c.to-c.from+1} стр. · PDF ${c.from}–${c.to} · ориентир до ${B.fmtS(due)}</p></div></div>`;}).join('')}</section>`;
};
B.acts.albertsPair=async()=>{
 if(!B.cloud){B.toast('Войди в Зов леса с кодом учителя');return;}
 const code=await B.dialog(`<h3>Подключить БиоВиз</h3><p>В библиотеке БиоВиза открой «Личный код» и скопируй код своего профиля чтения.</p>
 <label class="field">Личный код БиоВиза<input type="password" id="albertsCode" autocomplete="off" data-enter="albertsPairOk"></label>
 <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="albertsPairOk">Подключить</button></div>`);
 if(!code)return;
 try{B.toast(await BVAUTH.linkAlberts(code)?'БиоВиз подключён':'Личный код не найден');}
 catch(e){B.toast(e.code==='network'?'Не удалось подключить профиль. Проверь связь и выбранный код.':'Нужен вход с кодом учителя');}
};
B.acts.albertsPairOk=()=>B.closeDialog(B.$('#albertsCode').value.trim());
B.acts.albertsRetry=()=>location.reload();
B.acts.albertsLog=async el=>{
 const date=el?.dataset?.d || B.today();
 const s=A.status();if(!s){B.toast('Сначала загрузи оглавление');return;}
 const result=await B.dialog(`<h3>Альбертс · ${B.fmtW(date)}</h3><p class="muted">Последняя прочитанная страница PDF. Сейчас записано: ${s.current<18?'перед первой главой':s.current}. Меньшее число исправит ручную отметку. Страницы, прочитанные в БиоВизе, учитываются отдельно.</p><label class="field">Дочитал до страницы PDF<input id="albertsPage" type="number" inputmode="numeric" min="17" max="796" value="${s.current}" data-enter="albertsSave" autofocus></label><div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="albertsSave">Сохранить</button></div>`);
 if(result===false||result==null)return;
 B.put(KEY,{...AlbertsPlan.log(A.book,manual(),result,date),markedAt:Date.now()});
 B.toast('Прогресс Альбертса сохранён');
};
B.acts.albertsSave=()=>{const p=Number(B.$('#albertsPage').value);if(Number.isInteger(p)&&p>=17&&p<=796)B.closeDialog(p);else B.toast('Введи целую страницу от 17 до 796');};
A.widget=()=>{
 const s=A.status();if(!s)return null;const c=A.chapter(Math.max(A.book.firstPage,next(s)));
 return {plan:s.plan,current:s.current,next:next(s),chapter:c.n,title:c.title,done:s.done,total:s.total,weekDone:s.weekDone,weekTotal:s.week?.pages||0,weekEnd:s.week?.to||'',target:s.week?.pageTo||796,daily:s.daily,weekly:s.weekly,lag:s.lag,complete:s.complete,expired:s.expired};
};
})();
