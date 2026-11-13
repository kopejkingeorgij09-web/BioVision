/* Панель руководителя: открывается на #/me, когда вошли кодом учителя.
   Объявление на главной, скрытые лекции, лабы, статистика посетителей
   и резервная копия всех данных. Права проверяет сервер: без кода учителя запись в облако не пройдёт. */
(function(){
const {$,$$,esc}=BV,R=BVHOST.root,ic=BV.icon,APP=BV.app,A=window.BVAUTH,C=window.BV_COURSE;

const CSS=`
.adm{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px;align-items:start}
.adm .card{max-width:none}
.adm .wide{grid-column:1/-1}
.adm textarea{font:15px/1.5 var(--font-body);color:var(--ink);border:1px solid var(--line);border-radius:var(--rs);padding:10px 12px;background:var(--bg);min-height:96px;resize:vertical;width:100%}
.adm textarea:focus{outline:2px solid var(--cut);outline-offset:0;border-color:transparent}
.adm .chk{display:flex;align-items:center;gap:10px;font-size:14.5px;cursor:pointer}
.adm .chk input{width:18px;height:18px;accent-color:var(--cut);flex:none}
.adm .acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.adm .stat{display:flex;gap:22px;flex-wrap:wrap}
.adm .stat div{display:flex;flex-direction:column}
.adm .stat b{font:600 30px/1 var(--font-mono);color:var(--ink)}
.adm .stat span{font:500 11.5px/1.4 var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.adm .lec{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.adm .lec li{padding:8px 10px;border:1px solid var(--line);border-radius:var(--rs)}
.usage-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px;margin:20px 0}
.usage-list{list-style:none;padding:0;margin:10px 0 20px}
.usage-list li{display:grid;grid-template-columns:minmax(0,1fr) 50px 68px;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;align-items:baseline}
.usage-list span{overflow-wrap:anywhere}.usage-list b,.usage-list small{text-align:right;font-family:var(--font-mono)}.usage-list small{color:var(--muted)}
.adm h3{font:600 19px/1.3 var(--font-display);margin:16px 0 10px}.adm h4{margin:16px 0 4px}
.adm summary{cursor:pointer;min-height:44px;padding:10px 0}.adm select{padding:8px;border:1px solid var(--line);border-radius:var(--rs);background:var(--bg);color:var(--ink);font:inherit}
.usage-visitors{display:grid;gap:10px;margin:16px 0}.usage-visitor{border:1px solid var(--line);border-radius:var(--rs);padding:0 12px}.usage-visitor summary{display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:space-between}.usage-visitor summary span{font-size:13px;color:var(--muted)}

`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const today=()=>new Date().toISOString().slice(0,10);
const denied=e=>e&&e.code==='denied';
const MIG='Облако пока не знает эту настройку: нужно применить миграцию базы 20261102_labworks_admin.sql.';

function render(box,{site,NOTE,logout}){
  const D=site.data,N=D.news||{},hid=new Set(D.hidden||[]);
  box.innerHTML=`<header class="hero"><p class="eyebrow">Руководитель группы</p><h1>Управление</h1>
    <p class="lead">Объявление, лекции, лабы и статистика использования платформы.</p></header>
  <div class="adm">
   <section class="card" aria-labelledby="aNews"><h2 id="aNews">Объявление на главной</h2>
     <p>Короткий текст над списком лекций: дата занятия, задание, ссылка. Работают абзацы, списки и ссылки.</p>
     <form id="aNewsF"><textarea name="text" aria-label="Текст объявления" placeholder="Например: в четверг в 16:00 сеем E. coli на LB, приходите в халатах.">${esc(N.text||'')}</textarea>
       <label class="chk" style="margin:10px 0"><input type="checkbox" name="on" ${N.on?'checked':''}>Показывать на главной</label>
       <div class="acts"><button class="btn">Сохранить</button><p class="msg" role="status" data-m></p></div></form></section>

   <section class="card" aria-labelledby="aLab"><h2 id="aLab">Лабы</h2>
     <div class="stat" data-lstat><div><b>…</b><span>опубликовано</span></div><div><b>…</b><span>черновиков</span></div></div>
     <div class="acts"><a class="btn" href="#/labs/new">${ic('plus')}Новая работа</a><a class="btn ghost" href="#/labs">Все работы</a></div></section>

   <section class="card" aria-labelledby="aLec"><h2 id="aLec">Лекции</h2>
     <p>Скрытая лекция пропадает с главной у участников, ты её видишь с пометкой. Удобно, чтобы подготовить лекцию заранее. По прямой ссылке она всё равно откроется.</p>
     <ul class="lec">${C.lectures.map(L=>`<li><label class="chk"><input type="checkbox" data-hide="${esc(L.id)}" ${hid.has(L.id)?'checked':''}>Скрыть «${esc(L.n+'. '+L.title)}»</label></li>`).join('')}</ul>
     <p class="msg" role="status" data-lm></p></section>

   <section class="card" aria-labelledby="aBak"><h2 id="aBak">Резервная копия</h2>
     <p>Один файл JSON: лабы с фотографиями, объявление и прежние профили с прогрессом. Храни копию у себя: в ней есть ранее выданные коды.</p>
     <div class="acts"><button type="button" class="btn ghost" data-bak>Скачать копию</button><p class="msg" role="status" data-bm></p></div></section>

   <section class="card wide" aria-labelledby="aUsage"><h2 id="aUsage">Статистика платформы</h2><p>Какие разделы посещают, что читают и какими функциями пользуются. Личные коды посетители создают сами.</p><div data-activity></div></section>
  </div>
  <div><button type="button" class="btn ghost" id="meOut">Выйти</button></div>${NOTE()}`;
  $('#meOut',box).addEventListener('click',logout);

  /* объявление */
  const nf=$('#aNewsF',box);
  nf.addEventListener('submit',async e=>{e.preventDefault();const m=$('[data-m]',nf);m.className='msg';m.textContent='Сохраняю…';
    try{await site.save({news:{text:nf.elements.text.value.trim(),on:nf.elements.on.checked,date:today()}});m.textContent='Сохранено.'}
    catch(er){m.className='msg err';m.textContent=denied(er)?MIG:'Не удалось сохранить: '+er.message}});

  /* скрытые лекции */
  $$('[data-hide]',box).forEach(c=>c.addEventListener('change',async()=>{const m=$('[data-lm]',box);m.className='msg';m.textContent='Сохраняю…';
    const h=$$('[data-hide]',box).filter(x=>x.checked).map(x=>x.dataset.hide);
    try{await site.save({hidden:h});m.textContent='Сохранено.'}catch(er){c.checked=!c.checked;m.className='msg err';m.textContent=denied(er)?MIG:'Не удалось сохранить: '+er.message}}));

  /* лабораторные: счётчики */
  if(BV.labworks)BV.labworks.load(true).then(l=>{const s=$('[data-lstat]',box);if(!s)return;
    if(!l){s.innerHTML=`<p class="msg err">${MIG}</p>`;return}
    const dr=l.filter(w=>w.data.draft).length;s.innerHTML=`<div><b>${l.length-dr}</b><span>опубликовано</span></div><div><b>${dr}</b><span>черновиков</span></div>`});

  BV.activity.dashboard($('[data-activity]',box));

  /* резервная копия */
  $('[data-bak]',box).addEventListener('click',async e=>{const b=e.currentTarget,m=$('[data-bm]',box);b.disabled=true;m.className='msg';m.textContent='Собираю…';
    try{const D=await APP.db(),out={made:new Date().toISOString(),course:C.title,site:site.data};
      const currentSite=await D.doc('site/main').get();out.site=currentSite.exists?currentSite.data():{};
      out.codes=await A.codes();
      out.students=await D.collection('students').list();
      out.labworks=await D.collection('labworks').list();
      out.labfiles={};let k=0;const all=[...new Set(out.labworks.flatMap(w=>(w.data.photos||[]).map(p=>p.id)))];
      for(const id of all){m.textContent=`Фото ${++k} из ${all.length}…`;const d=await D.doc('labfiles/'+id).get();
        if(!d.exists)throw new Error('Не найдено фото '+id+'. Копия не сохранена.');out.labfiles[id]=d.data()}
      const dl=await window.claude.use('downloads');await dl.save({filename:`biovision-${today()}.json`,data:JSON.stringify(out,null,1),type:'application/json'});
      m.textContent='Готово.'}
    catch(er){m.className='msg err';m.textContent='Не получилось собрать копию: '+er.message}
    finally{b.disabled=false}});
}
BV.admin={render};
})();
