/* Профиль, перенос прогресса, облачное сохранение и журнал учителя */
(function(){
const {$,$$,esc,store,hooks}=BV,P=BV.prog;
const CSS=`
.me-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start}
.me .field{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted)}
.me input[type=text],.me textarea{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;width:100%}
.auth{display:flex;flex-direction:column;gap:8px;margin:10px 0 4px}
.auth .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.auth input{flex:1;min-width:160px;font-family:ui-monospace,Menlo,monospace!important;letter-spacing:.06em;text-transform:uppercase}
.codes{display:flex;flex-direction:column;gap:6px;margin:8px 0}
.codes .cr{display:grid;grid-template-columns:minmax(90px,1fr) auto auto auto;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:7px 10px;background:var(--surface-2);font-size:13.5px}
.codes code{font-family:ui-monospace,Menlo,monospace;font-size:13px;letter-spacing:.04em}
@media (max-width:560px){.codes .cr{grid-template-columns:1fr auto}.codes .cr code{grid-column:1/-1}}
.me textarea{min-height:84px;resize:vertical;font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all}
.cloud{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13.5px;background:var(--surface-2)}
.cloud i{width:10px;height:10px;border-radius:50%;background:var(--muted);flex:none;margin-top:6px}
.cloud.on i{background:var(--ok)}.cloud.warn i{background:#d9a21b}
.jr{display:flex;flex-direction:column;gap:6px}
.jr details{border:1px solid var(--line);border-radius:10px;background:var(--surface-2)}
.jr summary{display:grid;grid-template-columns:minmax(110px,1.4fr) 54px 54px 54px minmax(90px,1fr);gap:8px;align-items:center;padding:9px 12px;cursor:pointer;font-size:13.5px;list-style:none}
.jr summary::-webkit-details-marker{display:none}
.jr .jh{display:grid;grid-template-columns:minmax(110px,1.4fr) 54px 54px 54px minmax(90px,1fr);gap:8px;padding:0 12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.jr .num{text-align:right;font-variant-numeric:tabular-nums}
.jr .body{padding:6px 12px 12px;display:flex;flex-direction:column;gap:4px}
.jr .src{font-size:11px;color:var(--muted);margin-left:6px}
.jr .weak{color:var(--bad);font-size:12.5px}
.idg{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13.5px;margin-bottom:10px}
.idg dt{color:var(--muted)}.idg dd{margin:0;color:var(--ink);overflow-wrap:anywhere}
.idg code{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
.jr .vis{font-size:12.5px;color:var(--muted)}
@media (max-width:560px){.jr summary,.jr .jh{grid-template-columns:1.3fr 44px 44px 44px}.jr summary>:last-child,.jr .jh>:last-child{display:none}}
`;
const st=document.createElement('style');st.textContent=CSS;BVHOST.root.appendChild(st);
($('.nav-item[data-go="quiz"]')||$('.nav-item[data-go="dna"]')).insertAdjacentHTML('afterend',`<button class="nav-item" data-go="me">Профиль и прогресс <span class="new">новое</span></button>`);
$('main').insertAdjacentHTML('beforeend',`<section class="module me" id="m-me" hidden>
 <header class="mod-head"><p class="eyebrow">Практика</p><h1>Профиль и прогресс</h1><p class="lead">Ошибки и статистика хранятся в браузере. Войдите по коду от учителя, и прогресс будет сохраняться в облаке и откроется на любом устройстве. Без кода прогресс можно перенести вручную.</p></header>
 <div class="me-grid">
  <div class="panel"><h3>Профиль</h3>
   <label class="field">Как вас зовут (имя видит учитель в журнале)<input type="text" id="meName" maxlength="40" placeholder="Например, Маша К."></label>
   <div class="cloud" id="meCloud"><i></i><span>Проверяю облако…</span></div>
   <div class="auth" id="meAuth"></div>
   <p class="msg" id="meStats"></p></div>
  <div class="panel"><h3>Идентификация и cookie</h3>
   <div class="idg" id="meId"></div>
   <div class="row"><button class="btn ghost" id="meCk">Настройки cookie</button><button class="btn ghost" id="meForget">Удалить мои данные</button></div>
   <p class="msg" id="meIdMsg" aria-live="polite"></p></div>
  <div class="panel"><h3>Перенос прогресса</h3>
   <p class="msg">Код содержит имя, статистику и ошибки. Его можно отправить себе в мессенджер или учителю.</p>
   <div class="row"><button class="btn" id="meCopy">Скопировать код</button><button class="btn ghost" id="meFile" hidden>Скачать файл</button></div>
   <label class="field">Код прогресса<textarea id="meCode" placeholder="Здесь появится код. Чтобы загрузить прогресс, вставьте сюда код и нажмите «Загрузить»."></textarea></label>
   <div class="row"><button class="btn ghost" id="meLoad">Загрузить код</button><label class="btn ghost" style="cursor:pointer">Из файла<input type="file" id="meFileIn" accept=".json,.txt" hidden></label></div>
   <p class="msg" id="meMsg" aria-live="polite"></p></div>
 </div>
 <div class="panel" id="meJournal" hidden><h3>Журнал учеников</h3>
  <p class="msg">Видно только вам. Выдайте ученику личный код: он вводит его в «Профиле», и его прогресс появляется здесь сам.</p>
  <label class="field">Имя нового ученика<span class="row" style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="cdName" maxlength="40" placeholder="Например, Сехран" style="flex:1;min-width:160px"><button class="btn" id="cdNew">Выдать код</button></span></label>
  <div class="codes" id="cdList"></div>
  <p class="msg" id="cdMsg" aria-live="polite"></p>
  <h3 style="margin-top:14px">Прогресс учеников</h3>
  <div class="jr" id="jrList"></div>
  <label class="field" style="margin-top:6px">Добавить ученика по коду<textarea id="jrCode" placeholder="Вставьте код, который прислал ученик (BV1:…)"></textarea></label>
  <div class="row"><button class="btn" id="jrAdd">Добавить в журнал</button><button class="btn ghost" id="jrCsv" hidden>Скачать таблицу (CSV)</button></div>
  <p class="msg" id="jrMsg" aria-live="polite"></p></div>
</section>`);
let dl=null,db=null,uid=null,user=null,cloud='local',isAdmin=false,pushing=false,dirty=false,timer=0,lastSync=0;
const say=(el,t,bad)=>{const e=$(el);e.textContent=t;e.style.color=bad?'var(--bad)':''};
function stats(){const s=P.summary(P.state());$('#meStats').textContent=s.n?`Ответов: ${s.n}, верных: ${s.acc}%. Ошибок к разбору: ${P.errCount()}. Дней с практикой: ${s.active}.`:'Пока нет ответов — статистика появится после первых вопросов в тренажёре.'}
function cloudView(){const c=$('#meCloud');c.className='cloud';
  const M={on:['on','Облако подключено: прогресс сохраняется автоматически и откроется на любом устройстве, где вы войдёте по своему коду.'+(lastSync?` Последнее сохранение: ${new Date(lastSync).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}.`:'')],
   readonly:['warn','Облако только для чтения: у вашего доступа нет права записи. Чтобы синхронизироваться, попросите учителя выдать доступ «Участник». Пока используйте код или файл.'],
   local:['','Облако не подключено: введите код, который дал учитель. Пока прогресс хранится только в этом браузере, поэтому иногда делайте код или файл про запас.']};
  const [k,t]=M[cloud]||M.local;if(k)c.classList.add(k);c.lastElementChild.textContent=t}
$('#meName').value=store.get('pname','');
$('#meName').addEventListener('input',e=>{store.set('pname',BV_ET(e).value.trim().slice(0,40));P.emit('name')});
const refCode=()=>{$('#meCode').value=P.code()};
$('#meCopy').addEventListener('click',async()=>{refCode();const t=$('#meCode');t.select();let ok=false;try{await navigator.clipboard.writeText(t.value);ok=true}catch(e){}say('#meMsg',ok?'Код скопирован. Вставьте его на другом устройстве в поле «Код прогресса».':'Код выделен — нажмите Ctrl+C (на телефоне — «Копировать»).')});
$('#meFile').addEventListener('click',async()=>{try{await dl.save({filename:'biovis-progress-'+(store.get('pname','')||'ученик').replace(/[^\p{L}\p{N}_-]+/gu,'-')+'.json',data:JSON.stringify(P.state())});say('#meMsg','Файл сохранён.')}catch(e){if(e&&e.code!=='declined')say('#meMsg','Не удалось сохранить файл. Воспользуйтесь кодом.',true)}});
function applyLoad(p){const s=P.summary(p),ch=P.merge(p);$('#meName').value=store.get('pname','');stats();say('#meMsg',ch?`Загружено: ${s.n} ответов, ${s.errs} ошибок в коде. Данные объединены с текущими.`:'Ничего нового: в этом устройстве уже есть всё из кода.')}
$('#meLoad').addEventListener('click',()=>{try{applyLoad(P.parse($('#meCode').value))}catch(e){say('#meMsg',e.message,true)}});
$('#meFileIn').addEventListener('change',async e=>{const f=BV_ET(e).files[0];BV_ET(e).value='';if(!f)return;try{const t=await f.text();applyLoad(t.trim().startsWith('{')?P.parseJson(t):P.parse(t))}catch(er){say('#meMsg',er.message,true)}});
hooks.me={show(){stats();idView();$('#meName').value=store.get('pname','');cloudView();if(!$('#meCode').value)refCode()}};

/* --- идентификация: ID посетителя из cookie + аккаунт claude.ai --- */
const CK=window.BV_CONSENT||null;
const fmtD=t=>t?new Date(t).toLocaleString('ru',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
// что уходит в облачную запись: только при согласии на идентификацию
function visit(){if(!CK||!CK.allows('a'))return null;const v=CK.visitor();if(!v)return null;
  const ids=new Set([...(prevVis&&prevVis.ids||[]),v.id]);return{id:v.id,ids:[...ids].slice(-8),visits:Math.max(v.visits,prevVis&&prevVis.visits||0),first:Math.min(v.first,prevVis&&prevVis.first||v.first),last:v.last,device:v.device,consent:CK.get()}}
let prevVis=null;
function idView(){const box=$('#meId');if(!box)return;const c=CK&&CK.get(),v=CK&&CK.visitor();
  const acc=uid?(cloud==='on'?'вход по коду, запись сохраняется':'узнан, запись недоступна'):'не вошли по коду';
  const cons=!c?'ещё не выбрано':['необходимые',c.f?'функциональные':null,c.a?'идентификация':null].filter(Boolean).join(', ');
  box.innerHTML=`<dt>Cookie</dt><dd>${esc(cons)}</dd><dt>ID посетителя</dt><dd>${v?`<code>${esc(v.id)}</code>`:'не создан — включите «Идентификация и статистика»'}</dd>`+
   (v?`<dt>Визитов</dt><dd>${v.visits}</dd><dt>Первый вход</dt><dd>${fmtD(v.first)}</dd><dt>Прошлый вход</dt><dd>${fmtD(v.prev)}</dd><dt>Устройство</dt><dd>${esc(v.device)}</dd>`:'')+
   `<dt>Аккаунт</dt><dd>${acc}</dd>`;
  $('#meForget').hidden=!v&&!(uid&&cloud==='on')}
$('#meCk').addEventListener('click',()=>{if(CK)CK.open();else say('#meIdMsg','Настройки cookie недоступны в этом окне.',true)});
$('#meForget').addEventListener('click',async()=>{const b=$('#meForget');if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='Удалить ID и облачную запись? Нажмите ещё раз';return}
  b.dataset.arm='';b.textContent='Удалить мои данные';let ok=true;
  if(CK)CK.forget();prevVis=null;
  if(db&&uid&&cloud==='on'){try{await db.doc('students/'+uid).delete()}catch(e){ok=false}}
  idView();say('#meIdMsg',ok?'ID посетителя и облачная запись удалены. Прогресс в этом браузере остался — его можно стереть в настройках браузера.':'ID удалён, но облачную запись удалить не удалось.',!ok)});
if(CK)CK.on((c,v)=>{idView();if(cloud==='on'){dirty=true;push()}});

/* --- облако --- */
function schedule(){if(cloud!=='on')return;dirty=true;clearTimeout(timer);timer=setTimeout(push,2500)}
async function push(){if(cloud!=='on'||pushing||!dirty)return;pushing=true;dirty=false;
  try{const rec={name:store.get('pname',''),p:P.state(),updated:Date.now()},v=visit();if(v)rec.visitor=v;await db.doc('students/'+uid).set(rec);lastSync=Date.now();cloudView()}
  catch(e){if(e&&e.code==='invalid_argument'){cloud='readonly';cloudView()}else{dirty=true;clearTimeout(timer);timer=setTimeout(push,15000)}}
  pushing=false;if(dirty&&cloud==='on'){clearTimeout(timer);timer=setTimeout(push,2500)}}
P.on(schedule);
window.addEventListener('pagehide',()=>{if(dirty)push()});
async function initCloud(){
  try{if(!window.claude||!claude.use){cloudView();return}
    const [u,d,x]=await Promise.all([claude.use('user'),claude.use('db'),claude.use('downloads')]);
    if(x){dl=x;$('#meFile').hidden=false}
    if(!u||!d){cloudView();return}
    uid=await u.id();if(!uid){cloudView();return}
    db=d;user=u;
    let snap=null;try{snap=await db.doc('students/'+uid).get()}catch(e){}
    if(snap&&snap.exists){const r=snap.data();if(r&&r.p)P.merge(r.p);if(r&&r.visitor)prevVis=r.visitor}
    const w=await u.can('data.write');cloud=w===false?'readonly':'on';
    cloudView();stats();idView();if(cloud==='on'){dirty=true;push()}
    isAdmin=await u.canEdit();if(isAdmin)startJournal()
  }catch(e){cloud='local';cloudView()}idView()}

/* --- журнал учителя --- */
let rows=[];
const TN=()=>Object.fromEntries((BV.QTOPICS||[]).map(([k,l])=>[k,l]));
function jrRender(){const tn=TN(),box=$('#jrList');$('#jrCsv').hidden=!rows.length;
  if(!rows.length){box.innerHTML='<p class="msg">Пока никого нет. Ученики с доступом «Участник» появятся здесь сами, остальных можно добавить по коду.</p>';return}
  const R=rows.map(r=>({r,s:P.summary(r.p)})).sort((a,b)=>(b.s.last||'').localeCompare(a.s.last||''));
  box.innerHTML=`<div class="jh"><span>Ученик</span><span class="num">Отв.</span><span class="num">Верно</span><span class="num">Ошиб.</span><span>Активность</span></div>`+R.map(({r,s})=>{
    const T=Object.entries(r.p.stat).filter(([,v])=>v.n>0).map(([t,v])=>({t,n:v.n,a:Math.round(v.ok/v.n*100)})),weak=T.filter(x=>x.n>=5).sort((a,b)=>a.a-b.a)[0];
    return `<details><summary><span><b>${esc(r.name||'Без имени')}</b>${r.id===uid?'<span class="src">это вы</span>':r.imp?'<span class="src">по коду</span>':'<span class="src">облако</span>'}</span><span class="num">${s.n}</span><span class="num">${s.n?s.acc+'%':'—'}</span><span class="num">${s.errs}</span><span class="msg">${s.last?esc(s.last.split('-').reverse().join('.')):'—'}</span></summary>
    <div class="body">${weak&&weak.a<70?`<p class="weak">Слабая тема: ${esc(tn[weak.t]||weak.t)} — ${weak.a}% верных из ${weak.n}</p>`:''}
    ${T.sort((a,b)=>a.a-b.a).map(x=>`<div class="tbar" style="cursor:default"><span class="tbar-l">${esc(tn[x.t]||x.t)}</span><i><u style="width:${x.a}%"></u></i><em>${x.a}% · ${x.n}</em></div>`).join('')||'<p class="msg">Ответов пока нет.</p>'}
    <p class="msg">Дней с практикой: ${s.active}. ${r.updated?'Обновлено: '+new Date(r.updated).toLocaleString('ru'):''}</p>
    ${r.vis?`<p class="vis">Визитов: ${+r.vis.visits||0} · первый вход ${fmtD(r.vis.first)} · последний ${fmtD(r.vis.last)} · ${esc(r.vis.device||'')}${(r.vis.ids||[]).length>1?` · браузеров: ${r.vis.ids.length}`:''}</p>`:`<p class="vis">Ученик не дал согласия на идентификацию — визиты не учитываются.</p>`}
    <div class="row"><button class="btn ghost" data-del="${esc(r.id)}">Удалить из журнала</button></div></div></details>`}).join('');
  $$('[data-del]',box).forEach(b=>b.addEventListener('click',async()=>{if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='Точно удалить? Нажмите ещё раз';return}
    try{await db.doc('students/'+b.dataset.del).delete()}catch(e){say('#jrMsg','Не удалось удалить.',true)}}))}
function startJournal(){$('#meJournal').hidden=false;
  db.collection('students').onSnapshot(snap=>{rows=snap.docs.map(d=>{const v=d.data()||{};return{id:d.id,name:v.name,p:v.p,updated:v.updated,imp:!!v.imported,vis:v.visitor||null}}).filter(r=>P.valid(r.p));const open=$$('#jrList details').map(d=>d.open);jrRender();$$('#jrList details').forEach((d,i)=>d.open=!!open[i])},e=>say('#jrMsg','Журнал недоступен: '+(e&&e.code||'ошибка'),true))}
$('#jrAdd').addEventListener('click',async()=>{if(!db)return;try{const p=P.parse($('#jrCode').value);if(!p.name){say('#jrMsg','В коде нет имени ученика. Попросите ввести имя в профиле и прислать код заново.',true);return}
  await db.doc('students/imp-'+P.id(p.name.trim().toLowerCase())).set({name:p.name,p,updated:Date.now(),imported:true});$('#jrCode').value='';say('#jrMsg',`«${p.name}» добавлен(а). Повторная загрузка кода того же имени обновит строку.`)}catch(e){say('#jrMsg',e.message||'Не удалось добавить.',true)}});
$('#jrCsv').addEventListener('click',async()=>{if(!dl){say('#jrMsg','Скачивание недоступно в этом окне.',true);return}
  const tn=TN(),tk=Object.keys(tn).filter(k=>k!=='err'&&k!=='all'),q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  const head=['Ученик','Визитов','Первый вход','Последний вход','Устройство','Ответов','Верно, %','Ошибок','Последняя активность',...tk.map(k=>tn[k]+', %')];
  const lines=rows.map(r=>{const s=P.summary(r.p);const V=r.vis||{};return[q(r.name||''),V.visits||'',q(V.first?fmtD(V.first):''),q(V.last?fmtD(V.last):''),q(V.device||''),s.n,s.acc,s.errs,s.last||'',...tk.map(k=>{const v=r.p.stat[k];return v&&v.n?Math.round(v.ok/v.n*100):''})].join(';')});
  try{await dl.save({filename:'biovis-zhurnal.csv',data:'﻿'+[head.map(q).join(';'),...lines].join('\n')})}catch(e){if(e&&e.code!=='declined')say('#jrMsg','Не удалось сохранить таблицу.',true)}});
/* --- вход по коду --- */
const AU=window.BVAUTH;
function authView(){const box=$('#meAuth');if(!box||!AU)return;const m=AU.me;
  if(m){box.innerHTML=`<div class="row"><span>Вы вошли как <b>${esc(m.name||(m.role==='admin'?'учитель':'ученик'))}</b>${m.role==='admin'?' (учитель)':''}</span><button class="btn ghost" id="auOut">Выйти</button></div>`;
    $('#auOut').addEventListener('click',async()=>{const o=$('#auOut');o.disabled=true;o.textContent='Сохраняю…';
      dirty=true;try{await push()}catch(e){}
      /* прогресс уже в облаке: чистим этот браузер, чтобы следующий человек на устройстве начал с нуля */
      ['qstat','qdays','qerr','qerrm','pname'].forEach(k=>{try{localStorage.removeItem('biovis:'+k)}catch(e){}});
      AU.logout();location.reload()});return}
  box.innerHTML=`<label class="field">Код ученика<span class="row"><input type="text" id="auCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="BIO-XXXX-XXXX"><button class="btn" id="auIn">Войти</button></span></label><p class="msg" id="auMsg" aria-live="polite"></p>`;
  const go=async()=>{const b=$('#auIn');b.disabled=true;say('#auMsg','Проверяю код…');
    try{const r=await AU.login($('#auCode').value);if(r&&r.name)store.set('pname',r.name);location.reload()}
    catch(e){say('#auMsg',e.message,true);b.disabled=false}};
  $('#auIn').addEventListener('click',go);$('#auCode').addEventListener('keydown',e=>{if(e.key==='Enter')go()})}
let codes=[];
function codesView(){const box=$('#cdList');if(!box)return;
  if(!codes.length){box.innerHTML='<p class="msg">Кодов пока нет.</p>';return}
  box.innerHTML=codes.map(c=>`<div class="cr"><b>${esc(c.name||'Без имени')}</b><code>${esc(c.code)}</code><button class="btn ghost" data-cp="${esc(c.code)}">Копировать</button><button class="btn ghost" data-cd="${esc(c.id)}">Удалить</button></div>`).join('');
  $$('[data-cp]',box).forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.cp);say('#cdMsg','Код скопирован, отправьте его ученику.')}catch(e){say('#cdMsg','Скопируйте код вручную: '+b.dataset.cp)}}));
  $$('[data-cd]',box).forEach(b=>b.addEventListener('click',async()=>{if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='Точно? Прогресс ученика удалится';return}
    try{await AU.delCode(b.dataset.cd);dispatchEvent(new Event('bv-cloud-write'));await loadCodes();say('#cdMsg','Код удалён.')}catch(e){say('#cdMsg','Не удалось удалить код.',true)}}))}
async function loadCodes(){try{codes=await AU.codes()||[]}catch(e){codes=[];say('#cdMsg','Не удалось загрузить коды.',true)}codesView()}
$('#cdNew').addEventListener('click',async()=>{const n=$('#cdName').value.trim();if(!n){say('#cdMsg','Сначала введите имя ученика.',true);return}
  try{const r=await AU.newCode(n);$('#cdName').value='';await loadCodes();say('#cdMsg',`Код для «${r.name}»: ${r.code}. Скопируйте его и отправьте ученику.`)}catch(e){say('#cdMsg','Не удалось выдать код.',true)}});
const sj=startJournal;startJournal=function(){sj();loadCodes()};
if(AU)AU.ready.then(authView);
initCloud();cloudView();
})();
