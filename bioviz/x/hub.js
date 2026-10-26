/* Главная страница, прогресс и поиск по платформе */
(function(){
const {$,$$,esc,store,hooks}=BV;
const DESC={tour:'Путешествие внутрь клетки: органоид за органоидом',cell:'Кликабельная животная и растительная клетка',micro:'Виртуальный микроскоп: 16 препаратов, ×40–×400',bact:'Строение бактерии, бактериофаг, ВИЧ',mitosis:'Фазы митоза и набор хромосом',meiosis:'Кроссинговер, мейоз I и II, гаметогенез',protsyn:'Транскрипция и трансляция в анимации',photo:'Световая и темновая фазы, цикл Кальвина',energy:'Гликолиз, цикл Кребса, дыхательная цепь',heart:'Строение сердца, цикл, круги кровообращения',digest:'Путь глюкозы от тарелки до митохондрии',breath:'Вдох и выдох, газообмен в альвеолах',kidney:'Нефрон: фильтрация, реабсорбция, секреция',nerve:'Рефлекторная дуга, импульс, синапс',cycles:'Мхи, папоротники, голосеменные, цветковые',food:'Пищевые цепи и правило 10%',evo:'Симулятор отбора, дрейфа и Харди — Вайнберга',prot3d:'Настоящие структуры белков из PDB',lac:'Регуляция генов у бактерий',c4:'C3, C4 и CAM: как растения экономят воду',protein:'Задачи на биосинтез с проверкой',dna:'Двойная спираль ДНК в 3D',quiz:'≈1000 вопросов, экзамен, карточки, печать',me:'Имя, перенос прогресса, облачное сохранение, журнал учителя',ref:'Все конспекты с интерактивными рисунками в одном месте',cards:'Интервальное повторение, свои карточки, генерация с Claude',impulse:'Ионные каналы, потенциал действия, миелин',muscle:'Саркомер, скольжение нитей, цикл мостика',cardiac:'Фазы цикла, клапаны, давление, ЭКГ'};
const CSS=`
.home-hero{display:flex;flex-direction:column;gap:14px;max-width:760px}
.home-hero h1{font-family:var(--font-display);font-size:clamp(28px,4.4vw,46px);line-height:1.05;letter-spacing:-.02em}
.home-hero h1 span{color:var(--eosin)}
.search-trigger{display:flex;align-items:center;gap:10px;box-sizing:border-box;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);color:var(--muted);padding:13px 16px;border-radius:14px;font-size:15.5px;cursor:pointer}
.search-trigger:hover{border-color:var(--hema)}
.search-trigger kbd,.sr-k{margin-left:auto;font-family:inherit;font-size:12px;border:1px solid var(--line);border-radius:6px;padding:1px 7px;color:var(--muted)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.tile b{font-family:var(--font-display);font-size:28px;line-height:1.1}
.tile span{font-size:12.5px;color:var(--muted)}
.home-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px}
@media (max-width:980px){.home-grid{grid-template-columns:1fr}}
.tbar{display:grid;grid-template-columns:150px 1fr 64px;gap:10px;align-items:center;font-size:13.5px;cursor:pointer;border:0;background:none;color:var(--ink);text-align:left;padding:3px 0}
.tbar:hover .tbar-l{color:var(--hema)}
.tbar i{display:block;height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.tbar i u{display:block;height:100%;background:var(--eosin);border-radius:99px}
.tbar em{font-style:normal;color:var(--muted);font-size:12px;text-align:right}
@media (max-width:520px){.tbar{grid-template-columns:110px 1fr 54px}}
.days{display:flex;align-items:flex-end;gap:4px;height:56px}
.days i{flex:1;background:var(--eosin);border-radius:3px 3px 0 0;min-height:2px;opacity:.85}
.days i.z{background:var(--line)}
.cat-group{display:flex;flex-direction:column;gap:10px}
.cat-group h3{margin-top:6px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.mcard{border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:12px 14px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:3px;color:var(--ink)}
.mcard:hover{border-color:var(--hema);transform:translateY(-1px)}
.mcard b{font-size:14.5px}.mcard span{font-size:12.5px;color:var(--muted);line-height:1.4}
.qday .opt{font-size:14px;padding:10px 12px}
.srch{position:fixed;inset:0;z-index:100;background:color-mix(in oklab,#000 45%,transparent);display:flex;justify-content:center;align-items:flex-start;padding:10vh 16px 16px}
.srch[hidden]{display:none}
.srch-box{width:min(680px,100%);background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;max-height:76vh;overflow:hidden}
.srch-box input{border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);font-size:17px;padding:16px 18px;outline:none}
.srch-res{overflow:auto;padding:8px}
.srch-res h4{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:8px 10px 4px}
.sr{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:0;background:none;color:var(--ink);padding:9px 10px;border-radius:9px;cursor:pointer;font-size:14px}
.sr span{font-size:12.5px;color:var(--muted)}
.sr[aria-selected="true"],.sr:hover{background:var(--surface-2)}
.sr mark{background:var(--eosin-soft);color:inherit;border-radius:3px}
.side-search{margin:4px 0 2px;font-size:13.5px;padding:9px 12px}
kbd{font-family:inherit}
@media (max-width:860px){.side-search kbd,.search-trigger kbd{display:none}.side-search{width:auto;white-space:nowrap}}
.opt kbd{display:inline-block;min-width:20px;margin-right:10px;font-size:11.5px;color:var(--muted);border:1px solid var(--line);border-radius:5px;text-align:center}
@media (hover:none){.opt kbd{display:none}}
.flash{border:1px solid var(--line);background:var(--surface-2);border-radius:14px;padding:28px 22px;min-height:190px;display:flex;flex-direction:column;justify-content:center;gap:12px;cursor:pointer;text-align:center;color:var(--ink)}
.flash.open{cursor:default;background:var(--surface);border-color:var(--hema)}
.flash-q{font-size:19px;font-weight:600;line-height:1.4}.flash-q.small{font-size:14px;color:var(--muted);font-weight:500}
.flash-a{font-family:var(--font-display);font-size:22px;color:var(--hema);font-weight:700}
.q-review{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}
.q-rev{border:1px solid var(--line);border-left:4px solid var(--ok);border-radius:8px;padding:8px 12px;font-size:14px}
.q-rev.bad{border-left-color:var(--bad)}.q-rev summary{cursor:pointer}.q-rev p{margin-top:6px}
.sheet{background:#fff;color:#111;border-radius:10px;padding:24px;border:1px solid var(--line);font-size:13.5px}
.sheet h2{font-size:18px;margin-bottom:4px}.sheet-meta{color:#444;margin:6px 0 14px;line-height:1.7}
.sheet ol{padding-left:22px;display:flex;flex-direction:column;gap:10px}.sheet ol.abc{list-style:none;padding-left:4px;gap:2px;margin-top:4px}
.sheet .key{margin-top:28px;padding-top:18px;border-top:2px dashed #bbb}
@media print{body.printing .side,body.printing .mod-head,body.printing .seg,body.printing #quiz>*:not(#pOut),body.printing #pOut>.row,body.printing .module:not(#m-quiz),body.printing #voiceGlobal{display:none!important}
 body.printing{background:#fff}body.printing main{padding:0}body.printing .app{display:block}body.printing .panel{border:0;padding:0}body.printing .sheet{border:0;padding:0}body.printing .sheet .key{break-before:page;border:0;margin:0}}
`;
const st=document.createElement('style');st.textContent=CSS;BVHOST.root.appendChild(st);

/* --- навигация: главная и поиск --- */
const nav=$('.nav');
nav.insertAdjacentHTML('afterbegin',`<button class="nav-item" data-go="home">Главная</button><button class="search-trigger side-search" id="sideSearch">Поиск <kbd>${/Mac|iP/.test(navigator.platform)?'⌘':'Ctrl'} K</kbd></button>`);
nav.addEventListener('click',e=>{const b=BV_ET(e).closest('.nav-item[data-go]');if(!b)return;BV.go(b.dataset.go);try{history.replaceState(null,'','#'+b.dataset.go)}catch(er){};window.scrollTo({top:0})});
$('main').insertAdjacentHTML('afterbegin',`<section class="module" id="m-home" hidden></section>`);

const mods=()=>$$('.nav-item[data-go]').filter(b=>b.dataset.go!=='home').map(b=>{let g=b.previousElementSibling;while(g&&!g.classList.contains('nav-group'))g=g.previousElementSibling;return{id:b.dataset.go,name:b.childNodes[0].textContent.trim(),group:g?g.textContent:'',desc:DESC[b.dataset.go]||''}});
const TN=()=>Object.fromEntries((BV.QTOPICS||[]).map(([k,l])=>[k,l]));
function streak(){const H=store.get('qdays',{});let n=0;const d=new Date();for(;;){const k=d.toISOString().slice(0,10);if(H[k]){n++;d.setDate(d.getDate()-1)}else{if(n===0&&k===new Date().toISOString().slice(0,10)){d.setDate(d.getDate()-1);continue}break}if(n>365)break}return n}
function plural(n,a,b,c){const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c}
const HCSS=`
.hm{display:flex;flex-direction:column;gap:18px;text-align:left}
.hm button{text-align:left}
.hm-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px;align-items:stretch}
@media (max-width:980px){.hm-hero{grid-template-columns:1fr}}
.hm-hl{display:flex;flex-direction:column;gap:12px;justify-content:center;padding:6px 0}
.hm-hl h1{font-family:var(--font-display);font-size:clamp(28px,4.2vw,44px);line-height:1.05;letter-spacing:-.02em;margin:0}
.hm-hl h1 span{color:var(--eosin)}
.hm-cont{display:flex;flex-direction:column;gap:10px}
.hm-c{all:unset;box-sizing:border-box;cursor:pointer;text-align:left;display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:var(--surface);border:1px solid var(--line);box-shadow:0 1px 2px rgba(10,40,30,.05);transition:border-color .15s,transform .15s}
.hm-c:hover{border-color:var(--ui);transform:translateY(-1px)}
.hm-c .ic{flex:none;width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--c,var(--ui)) 14%,var(--surface));color:var(--c,var(--ui))}
.hm-c .ic .ux-i{width:22px;height:22px}
.hm-c small{display:block;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700}
.hm-c b{display:block;font-size:15.5px;line-height:1.3;margin-top:1px}
.hm-c em{display:block;font-style:normal;font-size:13px;color:var(--muted);margin-top:1px}
.hm-c .go{margin-left:auto;font-size:20px;color:var(--muted)}
.hm-big{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
@media (max-width:1100px){.hm-big{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:700px){.hm-big{grid-template-columns:1fr}}
.hf{--c:var(--ui);display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:22px;background:linear-gradient(165deg,color-mix(in srgb,var(--c) 10%,var(--surface)) 0%,var(--surface) 50%);border:1px solid color-mix(in srgb,var(--c) 24%,var(--line));box-shadow:0 1px 2px rgba(10,40,30,.05);min-width:0}
.hf-h{display:flex;align-items:center;gap:12px}
.hf-h .ic{flex:none;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:var(--c);color:#fff}
.hf-h .ic .ux-i{width:22px;height:22px}
.hf-h h2{font-family:var(--font-display);font-weight:600;font-size:20px;margin:0;line-height:1.1}
.hf-h p{margin:2px 0 0;font-size:13px;color:var(--muted)}
.hf-l{display:flex;flex-direction:column;gap:2px}
.hf-r{all:unset;box-sizing:border-box;cursor:pointer;text-align:left;display:grid;grid-template-columns:minmax(0,1fr) clamp(48px,18%,80px) auto;gap:10px;align-items:center;padding:8px 8px;border-radius:10px;font-size:14px}
.hf-r:hover{background:color-mix(in srgb,var(--c) 7%,var(--surface))}
.hf-r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hf-r i{display:block;height:6px;border-radius:99px;background:var(--surface-2);overflow:hidden}
.hf-r i u{display:block;height:100%;background:var(--c);border-radius:99px}
.hf-r em{font-style:normal;font-size:12px;color:var(--muted);min-width:46px;text-align:right;font-variant-numeric:tabular-nums}
.hf-r.err em{color:var(--bad);font-weight:700}
.hf-r .nb{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0b7479;background:color-mix(in srgb,#0e8a8f 14%,var(--surface));border-radius:99px;padding:1px 6px;margin-left:6px}
.hf .row{margin-top:auto;gap:8px}
:host([data-theme="dark"]) .hf-r .nb{color:#43cfc8}
.hf-big{display:flex;align-items:baseline;gap:10px}
.hf-big b{font-family:var(--font-display);font-size:52px;line-height:1;color:var(--c)}
.hf-big span{font-size:14px;color:var(--muted)}
.hf-st{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.hf-st div{background:var(--surface-2);border-radius:12px;padding:10px 12px}
.hf-st b{display:block;font-size:20px;font-family:var(--font-display)}
.hf-st span{font-size:12px;color:var(--muted)}
.hm-vuz{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:center;padding:18px 20px;border-radius:22px;background:linear-gradient(120deg,color-mix(in srgb,#0e8a8f 16%,var(--surface)),var(--surface) 70%);border:1px solid color-mix(in srgb,#0e8a8f 30%,var(--line))}
.hm-vuz .ic{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:#0e8a8f;color:#fff}
.hm-vuz .ic .ux-i{width:30px;height:30px}
.hm-vuz h2{font-family:var(--font-display);font-weight:600;font-size:20px;margin:0}
.hm-vuz p{margin:4px 0 10px;font-size:14px;color:var(--muted)}
.hm-vuz .chips{gap:8px}
.hm-vuz .chip{background:var(--surface);font-weight:600}
.hm-vuz .chip:hover{border-color:#0e8a8f}
.hm-vuz .chip.pri{background:#0e8a8f;border-color:#0e8a8f;color:#fff}
@media (max-width:600px){.hm-vuz{grid-template-columns:1fr}.hm-vuz .ic{display:none}}
.hm-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr)) minmax(0,1.6fr);gap:12px}
@media (max-width:1100px){.hm-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.hm-stats .act{grid-column:1/-1}}
.hm-stats .tile{border-radius:16px}
.hm-stats .act{display:flex;flex-direction:column;justify-content:space-between;gap:6px}
.hm-stats .act span{font-size:12.5px;color:var(--muted)}
.hm-stats .days{height:44px}
details.hm-all>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;font-family:var(--font-display);font-size:20px;font-weight:600;padding:4px 0}
details.hm-all>summary::-webkit-details-marker{display:none}
details.hm-all>summary:before{content:"›";font-size:24px;color:var(--muted);transition:transform .15s}
details.hm-all[open]>summary:before{transform:rotate(90deg)}
details.hm-all>summary em{font-style:normal;font-family:var(--font-body);font-size:13px;color:var(--muted);font-weight:500}
details.hm-all>div{display:flex;flex-direction:column;gap:14px;margin-top:10px}
`;
{const s2=document.createElement('style');s2.textContent=HCSS;BVHOST.root.appendChild(s2)}
const COLL=[['quiz','Тренажёр'],['ege','ЕГЭ'],['ol','Олимпиады'],['vuz','Вуз']];
function collStat(c){const TB=BV.TB||[],R=store.get('tk',{});
  if(c==='quiz'){const S=store.get('qstat',{});let n=0,ok=0;Object.values(S).forEach(r=>{n+=r.n;ok+=r.ok});const tot=(BV.QS||[]).length;return{tot,done:Math.min(n,tot),ok,n,pct:n?Math.round(ok/n*100):0,lab:n?`${Math.round(ok/n*100)}% верно`:`${tot}`}}
  const L=TB.filter(t=>t.c===c);let done=0,ok=0;L.forEach(t=>{const r=R[t.id];if(r){done++;if(r[0]>=r[1])ok++}});return{tot:L.length,done,ok,pct:L.length?Math.round(done/L.length*100):0,lab:`${done}/${L.length}`}}
function renderHome(){const box=$('#m-home'),S=store.get('qstat',{}),QS=BV.QS||[],tn=TN(),U=BV.UX,I=BV.UXI;
  let n=0,ok=0;Object.values(S).forEach(r=>{n+=r.n;ok+=r.ok});const sk=streak(),last=store.get('lastMod',null);
  const M=mods(),lastM=M.find(m=>m.id===last&&m.id!=='ref'&&m.id!=='cards'&&m.id!=='me');
  const day=new Date().toISOString().slice(0,10);let h=0;for(const c of day)h=(h*31+c.charCodeAt(0))>>>0;const QD=QS[h%QS.length];
  const H=store.get('qdays',{}),days=[...Array(14)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-13+i);return H[d.toISOString().slice(0,10)]||0}),mx=Math.max(1,...days);
  const groups=[];M.forEach(m=>{let g=groups.find(x=>x.g===m.group);if(!g)groups.push(g={g:m.group,m:[]});g.m.push(m)});
  const hr=new Date().getHours(),hi=hr<5?'Доброй ночи':hr<12?'Доброе утро':hr<18?'Добрый день':'Добрый вечер',nm=store.get('pname','');
  const docs=(U.docs?U.docs():U.DOCS).map(([m,c,sh])=>{const x=U.docInfo(m);return x&&Object.assign(x,{c,sh})}).filter(Boolean);
  const kl=store.get('klast',null),kd=kl&&docs.find(x=>x.mod===kl.mod),ksec=kd&&kd.pos&&kd.secs.find(s=>s.id===kd.parent[kd.pos.id]);
  const secTot=docs.reduce((a,x)=>a+x.secs.length,0),secDone=docs.reduce((a,x)=>a+x.done,0);
  const err=BV.tasksPending?BV.tasksPending().length:0,cs=BV.srs?BV.srs.summary():{due:0,nw:0,lrn:0,my:0};
  const tcoll=store.get('tkcoll','quiz'),tcollName=(COLL.find(c=>c[0]===tcoll)||['','Тренажёр'])[1];
  const nVuz=(BV.TB||[]).filter(t=>t.c==='vuz').length,nTasks=QS.length+(BV.TB||[]).length;
  const cont=[];
  if(kd&&ksec)cont.push(`<button class="hm-c" style="--c:${kd.c}" data-doc="${kd.mod}" data-sec="${esc(kd.pos.id)}"><span class="ic">${I('notes')}</span><span><small>Продолжить конспект</small><b>${esc(kd.d.title)}</b><em>${esc(String(ksec.no||''))} ${esc(ksec.t)}</em></span><span class="go">→</span></button>`);
  if(lastM&&(!kd||lastM.id!==kd.mod))cont.push(`<button class="hm-c" data-open="${lastM.id}"><span class="ic">${I('home')}</span><span><small>Последний раздел</small><b>${esc(lastM.name)}</b><em>${esc(lastM.desc||lastM.group)}</em></span><span class="go">→</span></button>`);
  if(!cont.length)cont.push(`<button class="hm-c" style="--c:var(--sky)" data-doc="tour" data-sec=""><span class="ic">${I('notes')}</span><span><small>С чего начать</small><b>Клетка: мембрана, цитоплазма, ядро</b><em>Первый конспект с интерактивными рисунками</em></span><span class="go">→</span></button>`);
  cont.push(`<button class="hm-c" style="--c:var(--eosin)" data-tasks="${err?'err':tcoll}"><span class="ic">${I('quiz')}</span><span><small>${err?'Разобрать ошибки':'Решать дальше'}</small><b>${err?`${err} ${plural(err,'задание','задания','заданий')} с ошибкой`:'Банк задач · '+tcollName}</b><em>${err?'Верный ответ убирает задание из стопки':'Подборка запоминается'}</em></span><span class="go">→</span></button>`);
  box.innerHTML=`<div class="hm">
  <section class="hm-hero"><div class="hm-hl"><p class="eyebrow">${hi}${nm?', '+esc(nm):''}</p><h1>Что учим <span>сегодня</span>?</h1>
   <p class="lead">${docs.length} конспектов с живыми рисунками, ${M.length} интерактивных разделов, ${nTasks} заданий от ОГЭ до вуза.</p>
   <button class="search-trigger" data-search>${I('search')}Найти раздел, термин или задачу… <kbd>${/Mac|iP/.test(navigator.platform)?'⌘':'Ctrl'} K</kbd></button></div>
   <div class="hm-cont">${cont.join('')}</div></section>
  <section class="hm-big">
   <article class="hf" style="--c:var(--hema)"><div class="hf-h"><span class="ic">${I('notes')}</span><div><h2>Конспекты</h2><p>Прочитано ${secDone} из ${secTot} разделов · <button type="button" class="pe-edit" data-pe="" style="margin:0;padding:0">изменить</button></p></div></div>
    <div class="hf-l">${docs.map(x=>{const p=x.secs.length?Math.round(x.done/x.secs.length*100):0;return `<button class="hf-r" style="--c:${x.c}" data-doc="${x.mod}" data-sec="${x.pos?esc(x.pos.id):''}"><span>${esc(x.sh)}</span><i><u style="width:${p}%"></u></i><em>${x.done}/${x.secs.length}</em></button>`}).join('')}</div>
    <div class="row"><button class="btn" data-open="ref">Все конспекты</button><button class="btn ghost" data-search>Найти тему</button></div></article>
   <article class="hf" style="--c:var(--eosin)"><div class="hf-h"><span class="ic">${I('quiz')}</span><div><h2>Задания</h2><p>${nTasks} заданий в четырёх сборниках</p></div></div>
    <div class="hf-l">${COLL.map(([c,l])=>{const s=collStat(c);return `<button class="hf-r" data-tasks="${c}"><span>${l}${c==='vuz'?'<span class="nb">новое</span>':''}</span><i><u style="width:${c==='quiz'?s.pct:s.pct}%"></u></i><em>${s.lab}</em></button>`}).join('')}${err?`<button class="hf-r err" data-tasks="err"><span>Мои ошибки</span><i><u style="width:100%;background:var(--bad)"></u></i><em>${err}</em></button>`:''}</div>
    <div class="row"><button class="btn" data-tasks="${tcoll}">Решать</button><button class="btn ghost" data-quiz="exam">Тест на время</button></div></article>
   <article class="hf" style="--c:var(--chl)"><div class="hf-h"><span class="ic">${I('cards')}</span><div><h2>Карточки</h2><p>Два трека: ЕГЭ и вуз · интервальное повторение</p></div></div>
    <div class="hf-big"><b>${cs.due}</b><span>${plural(cs.due,'карточка','карточки','карточек')} к повторению сегодня${cs.vuz&&cs.vuz.due?` · из них вуз: ${cs.vuz.due}`:''}</span></div>
    <div class="hf-st"><div><b>${cs.lrn}</b><span>изучается</span></div><div><b>${cs.nw}</b><span>новых</span></div><div><b>${cs.vuz?cs.vuz.due+cs.vuz.nw:0}</b><span>вуз: к изучению</span></div></div>
    <div class="row"><button class="btn" data-cards="smart">${cs.due-(cs.vuz?cs.vuz.due:0)?'Повторить ЕГЭ':'Учить ЕГЭ'}</button><button class="btn ghost" data-cards="mine">Свои карточки</button><button class="btn ghost" data-cards="vuz">Вуз · карточки</button></div></article>
  </section>
  <section class="hm-vuz"><span class="ic">${I('cap')}</span><div><h2>Вузовский трек</h2><p>Для элитной группы: конспекты лекций, вузовские разделы конспектов и ${nVuz} сложных задач по Ленинджеру и Тейлору.</p>
   <div class="chips"><button class="chip pri" data-tasks="vuz">Вузовские задачи · ${nVuz}</button><button class="chip pri" data-cards="vuz">Вузовские карточки</button><button class="chip pri" data-doc="bact" data-sec="">Микробиология · лекция 1</button><button class="chip" data-doc="chem" data-sec="vuz">Физхимия клетки</button><button class="chip" data-doc="tour" data-sec="vuz">Биофизика мембран</button><button class="chip" data-doc="cell" data-sec="vuz">Сортировка белков, хемиосмос</button><button class="chip" data-doc="energy" data-sec="">Биоэнергетика</button><button class="chip" data-doc="osmos" data-sec="">Осмос и водный потенциал</button></div></div></section>
  <section class="hm-stats"><div class="tile"><b>${n}</b><span>${plural(n,'ответ','ответа','ответов')} в тренажёре</span></div><div class="tile"><b>${n?Math.round(ok/n*100)+'%':'—'}</b><span>верных ответов</span></div><div class="tile"><b>${sk}</b><span>${plural(sk,'день','дня','дней')} подряд</span></div><div class="tile"><b>${err}</b><span>ошибок к разбору</span></div>
   <div class="tile act"><span>Активность за 2 недели</span><div class="days">${days.map(v=>`<i class="${v?'':'z'}" style="height:${v?Math.max(8,v/mx*100):4}%" title="${v}"></i>`).join('')}</div></div></section>
  <div class="home-grid">
   <div class="panel"><h3>Прогресс по темам тренажёра</h3>${(BV.QTOPICS||[]).filter(t=>t[0]!=='err'&&t[0]!=='all').map(([k,l])=>{const r=S[k]||{n:0,ok:0},p=r.n?Math.round(r.ok/r.n*100):0,tot=QS.filter(q=>q.t===k).length;return `<button class="tbar" data-quiz="train" data-topic="${k}"><span class="tbar-l">${l}</span><i><u style="width:${p}%"></u></i><em>${r.n?p+'% · '+r.n:'0 / '+tot}</em></button>`}).join('')}
    <p class="msg">Полоса — доля верных ответов. Нажмите на тему, чтобы потренироваться.</p></div>
   ${QD?`<div class="panel qday"><h3>Вопрос дня · ${tn[QD.t]||''}</h3><p class="q-text" style="font-size:16px">${esc(QD.q)}</p><div class="opts" id="qdOpts">${[QD.a,...QD.w].sort((a,b)=>((a.length*7+h)%11)-((b.length*7+h)%11)).map(o=>`<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="qdFb"></div></div>`:''}
  </div>
  <details class="hm-all" ${store.get('homeAll',false)?'open':''}><summary>Все разделы <em>${M.length}</em></summary><div>
  ${groups.map(g=>`<div class="cat-group"><h3>${esc(g.g)}</h3><div class="cards">${g.m.map(m=>`<button class="mcard" data-open="${m.id}"><b>${esc(m.name)}</b><span>${esc(m.desc)}</span></button>`).join('')}</div></div>`).join('')}</div></details></div>`;
  $$('[data-open]',box).forEach(b=>b.addEventListener('click',()=>open(b.dataset.open)));
  $$('[data-doc]',box).forEach(b=>b.addEventListener('click',()=>U.openDoc(b.dataset.doc,b.dataset.sec||null)));
  $$('[data-pe]',box).forEach(b=>b.addEventListener('click',()=>BV.UX.editProgress&&BV.UX.editProgress(b.dataset.pe||null)));
  $$('[data-tasks]',box).forEach(b=>b.addEventListener('click',()=>U.openTasks(b.dataset.tasks)));
  $$('[data-cards]',box).forEach(b=>b.addEventListener('click',()=>{const v=b.dataset.cards;if(!BV.srs)return open('cards');if(v==='smart')BV.srs.studySmart();else if(v==='vuz')BV.srs.view('decks','vuz');else BV.srs.view(v,v==='decks'?'ege':null)}));
  $$('[data-quiz]',box).forEach(b=>b.addEventListener('click',()=>BV.quizOpen({mode:b.dataset.quiz,topic:b.dataset.topic||'all'})));
  $$('[data-search]',box).forEach(b=>b.addEventListener('click',openSearch));
  const ha=$('details.hm-all',box);ha.addEventListener('toggle',()=>store.set('homeAll',ha.open));
  if(QD)$$('#qdOpts .opt').forEach(b=>b.addEventListener('click',()=>{if($('#qdOpts').dataset.done)return;$('#qdOpts').dataset.done=1;const okk=b.dataset.o===QD.a;BV.prog.record(QD,okk);
    $$('#qdOpts .opt').forEach(x=>{x.disabled=true;if(x.dataset.o===QD.a)x.classList.add('right');else if(x===b)x.classList.add('wrong')});$('#qdFb').innerHTML=`<div class="exam"><span>${okk?'Верно':'Неверно'}</span><p>${esc(QD.e)}</p></div>`}));
}
function open(id){BV.go(id);try{history.replaceState(null,'','#'+id)}catch(e){};window.scrollTo({top:0})}
hooks.home={show:renderHome};

/* --- поиск --- */
BVHOST.root.querySelector('.app').insertAdjacentHTML('beforeend',`<div class="srch" id="srch" hidden role="dialog" aria-modal="true" aria-label="Поиск"><div class="srch-box"><input id="srchIn" placeholder="Например: митохондрия, нефрон, Харди, кодон…" autocomplete="off"><div class="srch-res" id="srchRes"></div></div></div>`);
const norm=s=>s.toLowerCase().replace(/ё/g,'е');
let sel=0,items=[];
function hl(t,q){if(!q)return esc(t);const i=norm(t).indexOf(q);return i<0?esc(t):esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+q.length))+'</mark>'+esc(t.slice(i+q.length))}
function search(){const raw=$('#srchIn').value.trim(),q=norm(raw),M=mods(),QS=BV.QS||[],tn=TN();
  const words=q.split(/\s+/).filter(Boolean);const has=s=>words.every(w=>norm(s).includes(w));
  const mm=q?M.filter(m=>has(m.name+' '+m.desc+' '+m.group+' '+(($('#m-'+m.id)||{}).textContent||'').slice(0,4000))):M.slice(0,8);
  const qq=q.length>1?QS.filter(x=>has(x.q+' '+x.a)).slice(0,10):[];
  /* конспекты: по названию раздела и по полному тексту (BV.konspFind из ref.js); если её нет, только по названиям */
  const aa=q.length>1&&BV.konspList?(BV.konspFind?BV.konspFind(raw).map(a=>({...a,raw})):BV.konspList().flatMap(d=>d.secs.map(s=>({m:d.m,s:s[0],no:s[1],title:s[2],doc:d.title}))).filter(a=>has(a.title+' '+a.doc))).slice(0,8):[];
  const tt=[];
  const M8=mm.slice(0,8);items=[...M8.map(m=>({k:'m',m})),...tt.map(t=>({k:'t',t})),...aa.map(a=>({k:'a',a})),...qq.map(x=>({k:'q',x}))];sel=0;let base=M8.length;
  $('#srchRes').innerHTML=(mm.length?`<h4>Разделы</h4>`+mm.slice(0,8).map((m,i)=>`<button class="sr" data-i="${i}"><b>${hl(m.name,q)}</b><span>${esc(m.group)} · ${esc(m.desc)}</span></button>`).join(''):'')+
   (tt.length?`<h4>Термины</h4>`+tt.map((t,i)=>`<button class="sr" data-i="${base+i}"><b>${hl(t.k,words[0]||'')}</b><span>${esc(t.d)}</span></button>`).join(''):'')+
   (aa.length?`<h4>Конспекты</h4>`+aa.map((a,i)=>`<button class="sr" data-i="${base+tt.length+i}"><b>${hl(a.title,words[0]||'')}</b><span>${a.no!==''&&a.no!=null?'§ '+a.no+' · ':''}${esc(a.doc)}${a.snip?'<br>'+hl(a.snip,words[0]||''):''}</span></button>`).join(''):'')+
   (qq.length?`<h4>Вопросы тренажёра</h4>`+qq.map((x,i)=>`<button class="sr" data-i="${base+tt.length+aa.length+i}"><b>${hl(x.q,words[0]||'')}</b><span>${esc(tn[x.t]||'')} · ответ откроется после попытки</span></button>`).join(''):'')+
   (!mm.length&&!qq.length&&!aa.length&&!tt.length?`<p class="msg" style="padding:12px">Ничего не нашлось. Попробуйте другое слово.</p>`:'');
  mark();$$('#srchRes .sr').forEach(b=>b.addEventListener('click',()=>choose(+b.dataset.i)))}
function mark(){$$('#srchRes .sr').forEach(b=>b.setAttribute('aria-selected',+b.dataset.i===sel));const b=$(`#srchRes .sr[data-i="${sel}"]`);if(b)b.scrollIntoView({block:'nearest'})}
function choose(i){const it=items[i];if(!it)return;closeSearch();if(it.k==='m')open(it.m.id);else if(it.k==='a'){(BV.UX?BV.UX.openDoc(it.a.m,it.a.s):BV.konspOpen(it.a.m,it.a.s));if(it.a.snip&&BV.konspHit)BV.konspHit(it.a.m,it.a.s,it.a.raw)}else BV.quizOpen({mode:'train',q:it.x})}
function openSearch(){$('#srch').hidden=false;$('#srchIn').value='';search();setTimeout(()=>$('#srchIn').focus(),0)}
function closeSearch(){$('#srch').hidden=true}
BV.openSearch=openSearch;
$('#sideSearch').addEventListener('click',openSearch);
$('#srchIn').addEventListener('input',search);
$('#srch').addEventListener('click',e=>{if(BV_ET(e).id==='srch')closeSearch()});
document.addEventListener('keydown',e=>{const o=!$('#srch').hidden;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'||(e.key==='/'&&!o&&!BV_ET(e).matches('input,textarea,select'))){e.preventDefault();o?closeSearch():openSearch();return}
  if(!o)return;if(e.key==='Escape')closeSearch();else if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(items.length-1,sel+1);mark()}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);mark()}else if(e.key==='Enter'){e.preventDefault();choose(sel)}});
})();
