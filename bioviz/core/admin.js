/* Панель руководителя: открывается на #/me, когда вошли кодом учителя.
   Объявление на главной, скрытые лекции, лабораторные работы, участники (коды, имена, прогресс чтения)
   и резервная копия всех данных. Права проверяет сервер: без кода учителя запись в облако не пройдёт. */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root,ic=BV.icon,APP=BV.app,A=window.BVAUTH,C=window.BV_COURSE;

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
.ppl{width:100%;border-collapse:collapse;font-size:14.5px}
.ppl th{font:600 11px/1.3 var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
.ppl td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.ppl tr:last-child td{border-bottom:0}
.ppl code{font-family:var(--font-mono);font-size:13px;background:var(--surface-2);padding:2px 7px;border-radius:var(--rx);white-space:nowrap}
.ppl .lb{all:unset;cursor:pointer;color:var(--muted);font-size:13px;padding:4px 7px;border-radius:var(--rx);white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
.ppl .lb .i{width:15px;height:15px}
.ppl .lb:hover{color:var(--ink);background:var(--surface-2)}
.ppl .lb.del:hover{color:var(--bad)}
.ppl .pg{display:flex;flex-direction:column;gap:4px;font:500 12px/1.3 var(--font-mono);color:var(--muted)}
.ppl .nm{font-weight:600}
.ppl .tw{display:flex;gap:2px;align-items:center}
.sst{display:flex;flex-direction:column;gap:18px}
.sst h3{font:600 16px/1.3 var(--font-display);margin:0 0 6px}
.sst h3 small{font:500 12px/1.4 var(--font-mono);color:var(--muted);margin-left:8px}
.sst ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.sst li{display:grid;grid-template-columns:34px minmax(0,1fr) minmax(90px,30%) 64px;gap:10px;align-items:center;padding:7px 4px;border-bottom:1px solid var(--line);font-size:14.5px}
.sst li:last-child{border-bottom:0}
.sst li>i{font:600 12px/1 var(--font-mono);font-style:normal;color:var(--muted);text-align:right}
.sst li>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sst .sb{height:8px;border-radius:4px;background:var(--surface-2);overflow:hidden}
.sst .sb b{display:block;height:100%;border-radius:4px;background:var(--ui)}
.sst li>em{font:500 12.5px/1 var(--font-mono);font-style:normal;color:var(--muted);text-align:right;white-space:nowrap}
.sst li.low .sb b{background:var(--amber)}
.sst li.low>span:after{content:"реже всего";display:inline-block;white-space:nowrap;margin-left:8px;font:600 10.5px/1 var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--amber)}
@media (max-width:640px){.sst li{grid-template-columns:28px minmax(0,1fr) 56px}.sst li .sb{grid-column:2/4;grid-row:2}.sst li>span{white-space:normal}}
@media (max-width:640px){
  .ppl thead{display:none}
  .ppl,.ppl tbody,.ppl tr,.ppl td{display:block;width:100%}
  .ppl tr{border:1px solid var(--line);border-radius:var(--rs);padding:6px 4px;margin-bottom:8px}
  .ppl td{border:0;padding:4px 8px}
}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const today=()=>new Date().toISOString().slice(0,10);
const ago=t=>{if(!t)return 'не заходил';const d=(Date.now()-t)/864e5;if(d<1/24)return 'только что';if(d<1)return 'сегодня';if(d<2)return 'вчера';
  if(d<30)return Math.floor(d)+' дн. назад';return new Date(t).toLocaleDateString('ru-RU')};
const denied=e=>e&&e.code==='denied';
const MIG='Облако пока не знает эту настройку: нужно применить миграцию базы 20261102_labworks_admin.sql.';

function render(box,{site,NOTE,logout}){
  const D=site.data,N=D.news||{},hid=new Set(D.hidden||[]);
  box.innerHTML=`<header class="hero"><p class="eyebrow">Руководитель группы</p><h1>Управление</h1>
    <p class="lead">Объявление, лекции, лабораторные работы и участники группы. Всё, что меняется здесь, сразу видят участники.</p></header>
  <div class="adm">
   <section class="card" aria-labelledby="aNews"><h2 id="aNews">Объявление на главной</h2>
     <p>Короткий текст над списком лекций: дата занятия, задание, ссылка. Работают абзацы, списки и ссылки.</p>
     <form id="aNewsF"><textarea name="text" aria-label="Текст объявления" placeholder="Например: в четверг в 16:00 сеем E. coli на LB, приходите в халатах.">${esc(N.text||'')}</textarea>
       <label class="chk" style="margin:10px 0"><input type="checkbox" name="on" ${N.on?'checked':''}>Показывать на главной</label>
       <div class="acts"><button class="btn">Сохранить</button><p class="msg" role="status" data-m></p></div></form></section>

   <section class="card" aria-labelledby="aLab"><h2 id="aLab">Лабораторные работы</h2>
     <div class="stat" data-lstat><div><b>…</b><span>опубликовано</span></div><div><b>…</b><span>черновиков</span></div></div>
     <div class="acts"><a class="btn" href="#/labs/new">${ic('plus')}Новая работа</a><a class="btn ghost" href="#/labs">Все работы</a></div></section>

   <section class="card" aria-labelledby="aLec"><h2 id="aLec">Лекции</h2>
     <p>Скрытая лекция пропадает с главной у участников, ты её видишь с пометкой. Удобно, чтобы подготовить лекцию заранее. По прямой ссылке она всё равно откроется.</p>
     <ul class="lec">${C.lectures.map(L=>`<li><label class="chk"><input type="checkbox" data-hide="${esc(L.id)}" ${hid.has(L.id)?'checked':''}>Скрыть «${esc(L.n+'. '+L.title)}»</label></li>`).join('')}</ul>
     <p class="msg" role="status" data-lm></p></section>

   <section class="card" aria-labelledby="aBak"><h2 id="aBak">Резервная копия</h2>
     <p>Один файл JSON: лабораторные работы с фотографиями, объявление, участники и их прогресс. Храни его у себя, коды участников в нём есть.</p>
     <div class="acts"><button type="button" class="btn ghost" data-bak>Скачать копию</button><p class="msg" role="status" data-bm></p></div></section>

   <section class="card wide" aria-labelledby="aSst"><h2 id="aSst">Какие разделы читают</h2>
     <p>Сколько участников дошли до каждого раздела, среди тех, кто открывал лекцию. Раздел засчитывается, когда участник долистал до него, войдя по коду. Жёлтым отмечены разделы, до которых доходят реже всего.</p>
     <div class="sst" data-sst><p class="msg">Загружаю…</p></div></section>

   <section class="card wide" aria-labelledby="aPpl"><h2 id="aPpl">Участники</h2>
     <p>Каждому участнику свой код. Удалённый код перестаёт работать сразу. Прогресс приходит, когда участник читает лекции, войдя по коду.</p>
     <form class="field" id="cNew"><input class="plain" id="cName" placeholder="Имя участника" aria-label="Имя участника" maxlength="40"><button class="btn">Выдать код</button></form>
     <p class="msg" id="cMsg" role="status"></p>
     <div data-ppl><p class="msg">Загружаю…</p></div></section>
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

  /* участники */
  const lecs=C.lectures.map(L=>({L,secs:BV.progress.secsOf(L.id).filter(s=>s.no).map(s=>s.id)}));
  async function draw(){const out=$('[data-ppl]',box);if(!out)return;
    let codes,prog={};
    try{codes=await A.codes()||[]}catch(e){out.innerHTML='<p class="msg err">Не удалось загрузить коды.</p>';const ss=$('[data-sst]',box);if(ss)ss.innerHTML='<p class="msg err">Не удалось загрузить данные.</p>';return}
    try{const D=await APP.db();(await D.collection('students').list()).forEach(x=>{prog[x.id]=x.data&&x.data.prog||null})}catch(e){}
    stats(codes,prog);
    if(!codes.length){out.innerHTML='<p class="msg">Кодов пока нет.</p>';return}
    out.innerHTML=`<table class="ppl"><thead><tr><th>Участник</th><th>Код</th><th>Прочитано</th><th>Заходил</th><th></th></tr></thead><tbody>${codes.map(c=>{const p=prog[c.id];
      const pg=lecs.map(({L,secs})=>{const s=new Set(p&&p.seen&&p.seen[L.id]||[]),n=secs.filter(x=>s.has(x)).length;
        return `<span title="Лекция ${L.n}: ${n} из ${secs.length}">Л${L.n}: ${n}/${secs.length} <span class="tw trk" aria-hidden="true">${secs.map(x=>`<i${s.has(x)?' class="on"':''}></i>`).join('')}</span></span>`}).join('');
      return `<tr><td><span class="nm">${esc(c.name||'Без имени')}</span></td><td><code>${esc(c.code)}</code> <button type="button" class="lb" data-copy="${esc(c.code)}" aria-label="Скопировать код">${ic('copy')}</button></td>
        <td><div class="pg">${pg}</div></td><td><span class="msg">${p?ago(p.t):'не заходил'}</span></td>
        <td style="white-space:nowrap"><button type="button" class="lb" data-ren="${esc(c.id)}" data-name="${esc(c.name||'')}">${ic('edit')}Имя</button><button type="button" class="lb del" data-del="${esc(c.id)}" data-name="${esc(c.name||'')}">Удалить</button></td></tr>`}).join('')}</tbody></table>`}
  /* статистика по разделам: у скольких участников, открывавших лекцию, раздел отмечен прочитанным */
  function stats(codes,prog){const out=$('[data-sst]',box);if(!out)return;
    const ids=codes.map(c=>c.id);
    const html=C.lectures.map(L=>{const secs=BV.progress.secsOf(L.id).filter(x=>x.no);if(!secs.length)return '';
      const seenBy=ids.map(id=>new Set((prog[id]&&prog[id].seen&&prog[id].seen[L.id])||[])).filter(x=>x.size);
      const M=seenBy.length;
      if(!M)return `<div><h3>Лекция ${L.n}. ${esc(L.title)}</h3><p class="msg">Эту лекцию пока никто не открывал.</p></div>`;
      const cnt=secs.map(x=>seenBy.filter(S=>S.has(x.id)).length);
      /* «реже всего»: разделы с наименьшим числом читателей, если они отстают от остальных */
      const top=Math.max(...cnt),min=Math.min(...cnt),low=new Set(min<top?cnt.map((n,i)=>n===min?i:-1).filter(i=>i>=0):[]);
      const plain=h=>{const d=document.createElement('div');d.innerHTML=h;return d.textContent};
      return `<div><h3>Лекция ${L.n}. ${esc(L.title)}<small>открывали ${M} из ${ids.length}</small></h3><ol>${secs.map((x,i)=>`<li${low.has(i)?' class="low"':''}><i>${x.no}</i><span>${esc(plain(x.t))}</span><span class="sb" aria-hidden="true"><b style="width:${(cnt[i]/M*100).toFixed(0)}%"></b></span><em>${cnt[i]} из ${M}</em></li>`).join('')}</ol></div>`}).join('');
    out.innerHTML=ids.length?html:'<p class="msg">Участников пока нет: выдай коды ниже.</p>'}
  $('[data-ppl]',box).addEventListener('click',async e=>{const b=BV_ET(e).closest('button');if(!b)return;const cm=$('#cMsg',box);cm.className='msg';
    if(b.dataset.copy){const ok=await BV.copy(b.dataset.copy);BV.toast(ok?'Код скопирован.':'Не получилось скопировать.');return}
    if(b.dataset.ren){const n=prompt('Новое имя участника',b.dataset.name);if(n==null||!n.trim()||n.trim()===b.dataset.name)return;
      try{await A.renameCode(b.dataset.ren,n.trim());draw()}catch(er){cm.className='msg err';cm.textContent=denied(er)?MIG:'Не удалось переименовать: '+er.message}return}
    if(b.dataset.del){if(!confirm(`Удалить код участника «${b.dataset.name||'без имени'}»? Он больше не сможет войти, его прогресс сотрётся.`))return;
      try{await A.delCode(b.dataset.del);draw()}catch(er){cm.className='msg err';cm.textContent='Не удалось удалить: '+er.message}}});
  $('#cNew',box).addEventListener('submit',async e=>{e.preventDefault();const n=$('#cName',box).value.trim();if(!n)return;const cm=$('#cMsg',box);cm.className='msg';
    try{const r=await A.newCode(n);$('#cName',box).value='';cm.textContent=r&&r.code?`Код для «${n}»: ${r.code}`:'Код создан.';draw()}catch(er){cm.className='msg err';cm.textContent='Не удалось создать код: '+er.message}});
  draw();

  /* резервная копия */
  $('[data-bak]',box).addEventListener('click',async e=>{const b=e.currentTarget,m=$('[data-bm]',box);b.disabled=true;m.className='msg';m.textContent='Собираю…';
    try{const D=await APP.db(),out={made:new Date().toISOString(),course:C.title,site:site.data};
      out.codes=await A.codes().catch(()=>[]);
      out.students=await D.collection('students').list().catch(()=>[]);
      out.labworks=await D.collection('labworks').list().catch(()=>[]);
      out.labfiles={};let k=0;const all=out.labworks.flatMap(w=>(w.data.photos||[]).map(p=>p.id));
      for(const id of all){m.textContent=`Фото ${++k} из ${all.length}…`;try{const d=await D.doc('labfiles/'+id).get();if(d.exists)out.labfiles[id]=d.data()}catch(er){}}
      const dl=await window.claude.use('downloads');await dl.save({filename:`biovision-${today()}.json`,data:JSON.stringify(out,null,1),type:'application/json'});
      m.textContent='Готово.'}
    catch(er){m.className='msg err';m.textContent='Не получилось собрать копию: '+er.message}
    finally{b.disabled=false}});
}
BV.admin={render};
})();
