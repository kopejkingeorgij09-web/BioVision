/* Карточки с интервальным повторением (SM-2), свои карточки и генерация с Claude */
(function(){
const {$,$$,esc,store,hooks}=BV,P=BV.prog;
const DAY=864e5,MIN=6e4;
const TN=()=>Object.fromEntries((BV.QTOPICS||[]).map(([k,l])=>[k,l]));
const TOP=['cell','mic','met','div','gen','tis','hum','pl','eco','ol'];
const CSS=`
.decks{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.deck{border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px}
.deck b{font-size:15px}.deck .cnt{display:flex;gap:12px;font-size:12.5px;color:var(--muted)}.deck .cnt i{font-style:normal;font-weight:700}
.deck .due{color:var(--eosin)}.deck .new{color:var(--hema)}
.smart{background:linear-gradient(135deg,color-mix(in oklab,var(--hema) 12%,var(--surface)),var(--surface));border-color:var(--hema)}
.study{max-width:760px;display:flex;flex-direction:column;gap:14px}
.fc{border:1px solid var(--line);background:var(--surface);border-radius:18px;min-height:260px;padding:28px 24px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:16px;text-align:center;box-shadow:0 10px 30px rgba(20,20,60,.06)}
.fc .f{font-size:clamp(18px,2.4vw,22px);font-weight:600;line-height:1.4}
.fc .b{font-size:16px;line-height:1.6;border-top:1px dashed var(--line);padding-top:14px;width:100%}
.fc .src{font-size:12px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
.grades{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.grades button{display:flex;flex-direction:column;gap:2px;align-items:center;padding:10px 6px;border-radius:12px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-weight:700;font-size:14px;color:var(--ink)}
.grades button span{font-size:11.5px;font-weight:500;color:var(--muted)}
.grades .g1{border-color:var(--bad)}.grades .g4{border-color:var(--ok)}
.mylist{display:flex;flex-direction:column;gap:6px;max-height:440px;overflow:auto}
.mylist div{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:start;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--surface);font-size:13.5px}
@media (max-width:640px){.mylist div{grid-template-columns:1fr}}
.cform{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media (max-width:640px){.cform{grid-template-columns:1fr}}
.cform textarea,.cform input,.gen input,.bulk{border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px;width:100%}
.cform textarea{min-height:70px;resize:vertical}.bulk{min-height:110px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
.trk{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px}
.trk button{all:unset;box-sizing:border-box;cursor:pointer;border:1.5px solid var(--line);background:var(--surface);border-radius:16px;padding:12px 16px;display:flex;flex-direction:column;gap:3px;min-width:0}
.trk button:hover{border-color:var(--hema)}
.trk button[aria-pressed="true"]{border-color:var(--hema);background:color-mix(in oklab,var(--hema) 9%,var(--surface))}
.trk b{font-size:16px;color:var(--ink)}.trk span{font-size:12.5px;color:var(--muted);line-height:1.35}
.trk em{font-style:normal;font-weight:700;color:var(--eosin)}
.deck.vz{border-color:color-mix(in oklab,#0e8a8f 40%,var(--line))}
.deck.vzall{background:linear-gradient(135deg,color-mix(in oklab,#0e8a8f 12%,var(--surface)),var(--surface));border-color:#0e8a8f}
.cl-gap{display:inline-block;min-width:92px;border-bottom:2.5px solid var(--eosin);margin:0 3px;vertical-align:baseline}
.cl-fill{color:var(--eosin)}
.crev{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--muted);cursor:pointer;user-select:none}
.crev input{width:18px;height:18px;accent-color:var(--hema)}
.cwrap{display:flex;flex-direction:column;gap:14px}.cwrap h3{margin:8px 0 0}
.vz-soon{border:1.5px dashed var(--line);border-radius:14px;padding:14px;color:var(--muted);font-size:13.5px}
.gprev{display:flex;flex-direction:column;gap:6px}.gprev label{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--surface);font-size:14px}
`;
const st=document.createElement('style');st.textContent=CSS;BVHOST.root.appendChild(st);
$('main').insertAdjacentHTML('beforeend',`<section class="module" id="m-cards" hidden>
 <header class="mod-head"><p class="eyebrow">Теория · интервальное повторение</p><h1>Карточки</h1><p class="lead">Умное повторение по методу SM-2: карточка возвращается тогда, когда вы начинаете её забывать. Два трека: <b>ЕГЭ и олимпиады</b> — термины и вопросы школьного курса, <b>Вуз</b> — карточки по темам элитной группы.</p></header>
 <div class="seg" role="group" id="cTab"><button data-v="decks" aria-pressed="true">Колоды</button><button data-v="mine" aria-pressed="false">Мои карточки</button><button data-v="gen" aria-pressed="false">Создать с Claude</button></div>
 <div id="cBody"></div></section>`);
/* ---- данные ---- */
const S=()=>store.get('srs',{});
const my=()=>store.get('mycards',[]).filter(c=>!c.del);
const QS=()=>BV.QS||[];
let bank=null;function build(){bank=new Map();(BV.TERMS||[]).forEach(t=>bank.set('g:'+P.id(t.k),{f:t.k,b:t.d,src:'термин',t:t.t,deck:'g:'+t.t,tr:'ege'}));
  QS().forEach(q=>bank.set('q:'+P.id(q.q),{f:q.q,b:q.a+(q.e?'\n\n'+q.e:''),src:'вопрос тренажёра',t:q.t,deck:'q:'+q.t,tr:'ege'}));
  (BV.VCARDS||[]).forEach(c=>bank.set('v:'+P.id(c.f),{f:c.f,b:c.b,src:c.topic,t:'vuz',deck:'v:'+c.d,topic:c.topic,tr:'vuz'}));
  my().forEach(c=>{const tr=c.tr==='vuz'?'vuz':'ege';bank.set('m:'+c.id,{f:c.f,b:c.b,src:c.d,t:'my',deck:'m:'+tr+':'+c.d,tr})});return bank}
const B=()=>bank||build();
const trIds=tr=>[...B().entries()].filter(([,c])=>c.tr===tr).map(([k])=>k);
const deckIds=d=>[...B().entries()].filter(([,c])=>c.deck===d).map(([k])=>k);
function counts(ids){const s=S(),now=Date.now();let nw=0,due=0,lrn=0;ids.forEach(k=>{const e=s[k];if(!e)nw++;else if(e[3]<=now)due++;else lrn++});return{nw,due,lrn}}
/* ---- SM-2 ---- */
function next(e,g){let [r,ef,iv]=e||[0,2.5,0];const now=Date.now();
  if(g===1)return[0,Math.max(1.3,ef-0.2),0,now+10*MIN,now];
  if(g===2){iv=r?Math.max(1,iv*1.2):1;ef=Math.max(1.3,ef-0.15)}else if(g===3){iv=r===0?1:r===1?3:iv*ef}else{iv=r===0?3:Math.max(iv*ef*1.3,iv+1);ef+=0.15}
  return[r+1,+ef.toFixed(2),+iv.toFixed(2),now+iv*DAY,now]}
const fmt=e=>{const d=(e[3]-Date.now())/DAY;return d<1/24?'10 мин':d<1.5?'1 д':d<30?Math.round(d)+' д':d<365?Math.round(d/30)+' мес':Math.round(d/365)+' г'};
function grade(k,g){const s=S();s[k]=next(s[k],g);store.set('srs',s);const H=store.get('srsdays',{}),d=new Date().toISOString().slice(0,10);H[d]=(H[d]||0)+1;store.set('srsdays',H);P.emit('srs')}
/* ---- сессия ---- */
let rev=store.get('cardRev',false);
let ses=null,view='decks',track=store.get('cardTrack','ege')==='vuz'?'vuz':'ege';
function setTrack(t){track=t==='vuz'?'vuz':'ege';store.set('cardTrack',track)}
function start(ids,title,o){const s=S(),now=Date.now(),lim=store.get('newLim',20);
  const due=ids.filter(k=>s[k]&&s[k][3]<=now).sort((a,b)=>s[a][3]-s[b][3]);const nw=ids.filter(k=>!s[k]).slice(0,Math.max(0,lim));
  const q=[...due,...shuffle(nw)];ses={q,title,i:0,done:0,again:0,rev:o&&o.rev===false?false:undefined};view='study';BV.go('cards');try{history.replaceState(null,'','#cards')}catch(e){}render();window.scrollTo({top:0})}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function smartIds(){const st=store.get('qstat',{}),s=S(),now=Date.now();
  const w=TOP.map(t=>{const r=st[t];return{t,acc:r&&r.n?r.ok/r.n:0.5}}).sort((a,b)=>a.acc-b.acc).slice(0,3).map(x=>x.t);
  const all=trIds('ege');const due=all.filter(k=>s[k]&&s[k][3]<=now);const nw=all.filter(k=>!s[k]&&k.startsWith('g:')&&w.includes(B().get(k).t));
  return{ids:[...due,...shuffle(nw)],weak:w}}
function vuzIds(){const s=S(),now=Date.now(),all=trIds('vuz');return[...all.filter(k=>s[k]&&s[k][3]<=now),...shuffle(all.filter(k=>!s[k]))]}
function clozeParts(c){const m=String(c.f).match(/\{\{(.+?)\}\}/);if(!m)return null;
  return {q:String(c.f).replace(/\{\{(.+?)\}\}/g,'<span class="cl-gap">\u00a0\u00a0\u00a0\u00a0\u00a0</span>'),a:m[1],full:String(c.f).replace(/\{\{(.+?)\}\}/g,'<b class="cl-fill">$1</b>')}}
function study(box){if(!ses||ses.i>=ses.q.length){const tot=ses?ses.done:0;box.innerHTML=`<div class="study"><p class="eyebrow">${esc(ses?ses.title:'')}</p><div class="score-big">${tot?'Готово!':'Нечего повторять'}</div><p class="msg">${tot?`Повторено карточек: ${tot}. Следующие появятся, когда подойдёт срок.`:'Все карточки этой колоды уже выучены на сегодня. Возьмите новые или загляните завтра.'}</p><div class="row"><button class="btn" id="cBack">К колодам</button></div></div>`;$('#cBack').addEventListener('click',()=>{view='decks';ses=null;render()});return}
  const k=ses.q[ses.i],c0=B().get(k);if(!c0){ses.i++;return study(box)}const e=S()[k];
  const cl=clozeParts(c0);
  const c=cl?{f:cl.q,b:cl.full+(c0.b?'<br>'+esc(c0.b):''),src:c0.src+' · пропуск',html:true}
    :(rev&&ses.rev!==false&&!c0.noRev)?{f:c0.b,b:c0.f,src:c0.src+' · обратная',html:false}:c0;
  box.innerHTML=`<div class="study"><div class="q-top"><span class="eyebrow">${esc(ses.title)} · ${ses.i+1} из ${ses.q.length}</span><button class="btn ghost mini" id="cStop">Закончить</button></div><div class="progress"><i style="width:${ses.i/ses.q.length*100}%"></i></div>
   <div class="fc" id="fc"><span class="src">${esc(c.src)}${e?'':' · новая'}</span><div class="f">${c.html?c.f:esc(c.f)}</div><div class="b" id="fcB" hidden>${c.html?c.b:esc(c.b).replace(/\n/g,'<br>')}</div><button class="btn" id="fcShow">Показать ответ · пробел</button></div>
   <div class="grades" id="gr" hidden>${[[1,'Снова'],[2,'Трудно'],[3,'Хорошо'],[4,'Легко']].map(([g,l])=>`<button class="g${g}" data-g="${g}">${l}<span>${fmt(next(e,g))} · ${g}</span></button>`).join('')}</div></div>`;
  $('#cStop').addEventListener('click',()=>{ses.q=ses.q.slice(0,ses.i);render()});
  $('#fcShow').addEventListener('click',reveal);$$('#gr button').forEach(b=>b.addEventListener('click',()=>rate(+b.dataset.g)))}
function reveal(){if(!$('#fcB')||!$('#fcB').hidden)return;$('#fcB').hidden=false;$('#fcShow').hidden=true;$('#gr').hidden=false}
function rate(g){const k=ses.q[ses.i];grade(k,g);ses.done++;if(g===1){ses.q.splice(Math.min(ses.q.length,ses.i+4),0,k)}ses.i++;render()}
BVHOST.root.addEventListener('keydown',e=>{if($('#m-cards').hidden||view!=='study'||BV_ET(e).matches('input,textarea,select'))return;if(e.key===' '){e.preventDefault();reveal()}else if(/^[1-4]$/.test(e.key)&&$('#gr')&&!$('#gr').hidden)rate(+e.key)});
/* ---- колоды ---- */
function decks(box){build();const tn=TN();
  const ce=counts(trIds('ege')),cv=counts(trIds('vuz')),nV=trIds('vuz').length;
  const card=(id,title,sub,ids,cls='')=>{const c=counts(ids);return `<div class="deck ${cls}"><b>${esc(title)}</b>${sub?`<span class="msg">${esc(sub)}</span>`:''}<div class="cnt"><span>к повторению <i class="due">${c.due}</i></span><span>новых <i class="new">${c.nw}</i></span><span>изучается <i>${c.lrn}</i></span></div><div class="row"><button class="btn mini" data-d="${esc(id)}" data-t="${esc(title)}">Учить</button></div></div>`};
  const myDecks=[...new Set(my().filter(c=>(c.tr==='vuz'?'vuz':'ege')===track).map(c=>c.d))];
  const myHtml=myDecks.length?`<h3>Ваши колоды</h3><div class="decks">${myDecks.map(d=>card('m:'+track+':'+d,d,'ваша колода',deckIds('m:'+track+':'+d))).join('')}</div>`:'';
  let body;
  if(track==='vuz'){const topics=[...new Set((BV.VDECKS||[]).map(d=>d.topic))],lim=store.get('newLim',20);
    body=`<div class="decks"><div class="deck smart"><b>Повторение · вузовский трек</b><span class="msg">Всё вузовское, что пора повторить, плюс новые карточки.</span><div class="cnt"><span>к повторению <i class="due">${cv.due}</i></span><span>новых <i class="new">${Math.min(cv.nw,lim)}</i></span></div><div class="row"><button class="btn mini" data-d="vsmart">Начать</button></div></div></div>
    ${topics.map(t=>{const D=(BV.VDECKS||[]).filter(d=>d.topic===t),all=D.flatMap(d=>deckIds('v:'+d.id));
      return `<h3>${esc(t)}</h3><div class="decks">${card('vt:'+t,t+' · вся тема',`${all.length} карточек`,all,'vzall')}${D.map(d=>card('v:'+d.id,d.title,d.sub,deckIds('v:'+d.id),'vz')).join('')}</div>`}).join('')}
    ${myHtml}<p class="vz-soon">Пока в треке одна тема — кворум-сенсинг. Новые темы элитной группы появятся здесь отдельными колодами. Свои вузовские карточки можно добавить на вкладке «Мои карточки» (трек «Вуз») или сгенерировать с Claude.</p>`}
  else{const sm=smartIds(),c0=counts(sm.ids);
    body=`<div class="decks"><div class="deck smart"><b>Умное повторение</b><span class="msg">Всё, что пора повторить, плюс новые термины из ваших слабых тем: ${sm.weak.map(t=>esc(tn[t]||t)).join(', ')}.</span><div class="cnt"><span>к повторению <i class="due">${c0.due}</i></span><span>новых <i class="new">${Math.min(c0.nw,store.get('newLim',20))}</i></span></div><div class="row"><button class="btn mini" data-d="smart">Начать</button></div></div></div>
    ${myHtml}
    <h3>Термины по темам</h3><div class="decks">${TOP.map(t=>{const ids=deckIds('g:'+t);return ids.length?card('g:'+t,'Термины: '+(tn[t]||t),'',ids):''}).join('')}</div>
    <h3>Вопросы тренажёра как карточки</h3><div class="decks">${TOP.map(t=>{const ids=deckIds('q:'+t);return ids.length?card('q:'+t,'Вопросы: '+(tn[t]||t),'',ids):''}).join('')}</div>`}
  box.innerHTML=`<div class="cwrap"><div class="trk" role="group" aria-label="Трек карточек"><button data-tr="ege" aria-pressed="${track==='ege'}"><b>ЕГЭ и олимпиады</b><span>Термины и вопросы школьного курса · к повторению <em>${ce.due}</em></span></button><button data-tr="vuz" aria-pressed="${track==='vuz'}"><b>Вуз</b><span>Темы элитной группы · ${nV} карточек · к повторению <em>${cv.due}</em></span></button></div>
  <div class="row" style="flex-wrap:wrap"><span class="msg">Новых карточек за сессию: </span><select id="newLim">${[5,10,20,30,50].map(n=>`<option ${n===store.get('newLim',20)?'selected':''}>${n}</option>`).join('')}</select><label class="crev"><input type="checkbox" id="cRev" ${rev?'checked':''}> Обратные карточки: от определения к термину</label></div>${body}</div>`;
  $$('.trk button',box).forEach(b=>b.addEventListener('click',()=>{setTrack(b.dataset.tr);render()}));
  $('#newLim').addEventListener('change',e=>{store.set('newLim',+BV_ET(e).value);render()});
  {const r=$('#cRev',box);if(r)r.addEventListener('change',()=>{rev=r.checked;store.set('cardRev',rev)})}
  $$('[data-d]',box).forEach(b=>b.addEventListener('click',()=>{const d=b.dataset.d;if(d==='smart'){start(smartIds().ids,'Умное повторение');return}if(d==='vsmart'){start(vuzIds(),'Повторение · вуз');return}
    if(d.startsWith('vt:')){const t=d.slice(3);start((BV.VDECKS||[]).filter(x=>x.topic===t).flatMap(x=>deckIds('v:'+x.id)),t);return}
    start(deckIds(d),b.dataset.t||'')}))}
/* ---- мои карточки ---- */
let edit=null;
function save(f,b,d,id,tr){tr=tr==='vuz'?'vuz':'ege';const M=store.get('mycards',[]);const now=Date.now();if(id){const c=M.find(x=>x.id===id);if(c){c.f=f;c.b=b;c.d=d;c.tr=tr;c.ts=now}}else M.push({id:now.toString(36)+Math.random().toString(36).slice(2,6),f,b,d,tr,ts:now});store.set('mycards',M);bank=null;P.emit('my')}
function mine(box){const M=my(),decksL=[...new Set(M.map(c=>c.d).concat(['Мои карточки']))];
  box.innerHTML=`<div class="panel"><h3>${edit?'Редактировать карточку':'Новая карточка'}</h3><div class="cform"><label class="msg">Вопрос / лицевая сторона<textarea id="mF">${edit?esc(edit.f):''}</textarea></label><label class="msg">Ответ / обратная сторона<textarea id="mB">${edit?esc(edit.b):''}</textarea></label></div>
   <div class="row"><label class="msg">Колода <input id="mD" list="mDl" value="${esc(edit?edit.d:store.get('lastDeck','Мои карточки'))}" style="width:220px"></label><label class="msg">Трек <select id="mTr"><option value="ege" ${(edit?edit.tr!=='vuz':track!=='vuz')?'selected':''}>ЕГЭ и олимпиады</option><option value="vuz" ${(edit?edit.tr==='vuz':track==='vuz')?'selected':''}>Вуз</option></select></label><datalist id="mDl">${decksL.map(d=>`<option value="${esc(d)}">`).join('')}</datalist><button class="btn" id="mSave">${edit?'Сохранить':'Добавить'}</button>${edit?'<button class="btn ghost" id="mCancel">Отмена</button>':''}<span class="msg" id="mMsg"></span></div></div>
  <div class="panel"><h3>Добавить списком</h3><p class="msg">Каждая строка — карточка: «вопрос ; ответ» (можно через табуляцию или « — »).</p><textarea class="bulk" id="mBulk" placeholder="Митохондрия ; органоид, где синтезируется основная часть АТФ\nКто открыл вирусы ; Д. И. Ивановский"></textarea><div class="row"><button class="btn ghost" id="mBulkGo">Добавить строки в колоду</button><span class="msg" id="mBulkMsg"></span></div></div>
  <div class="panel"><h3>Ваши карточки · ${M.length}</h3><div class="mylist">${M.slice().sort((a,b)=>b.ts-a.ts).map(c=>`<div><span><b>${esc(c.f)}</b><br><span class="msg">${esc(c.d)} · ${c.tr==='vuz'?'вуз':'ЕГЭ'}</span></span><span>${esc(c.b)}</span><span class="row" style="gap:6px"><button class="btn ghost mini" data-e="${c.id}">Изменить</button><button class="btn ghost mini" data-x="${c.id}">Удалить</button></span></div>`).join('')||'<p class="msg">Пока пусто. Добавьте карточку выше или сгенерируйте с Claude.</p>'}</div></div>`;
  $('#mSave').addEventListener('click',()=>{const f=$('#mF').value.trim(),b=$('#mB').value.trim(),d=($('#mD').value.trim()||'Мои карточки').slice(0,60);if(!f||!b){$('#mMsg').textContent='Заполните обе стороны.';return}store.set('lastDeck',d);save(f.slice(0,600),b.slice(0,1500),d,edit&&edit.id,$('#mTr').value);edit=null;render()});
  const mc=$('#mCancel');if(mc)mc.addEventListener('click',()=>{edit=null;render()});
  $('#mBulkGo').addEventListener('click',()=>{const d=($('#mD').value.trim()||'Мои карточки').slice(0,60);let n=0;$('#mBulk').value.split('\n').forEach(l=>{const m=l.split(/\s*;\s*|\t|\s+—\s+/);if(m.length>=2&&m[0].trim()&&m.slice(1).join(' ; ').trim()){save(m[0].trim().slice(0,600),m.slice(1).join(' ; ').trim().slice(0,1500),d,null,$('#mTr').value);n++}});$('#mBulkMsg').textContent=n?`Добавлено: ${n}`:'Не нашёл строк вида «вопрос ; ответ».';if(n){$('#mBulk').value='';setTimeout(render,600)}});
  $$('[data-e]',box).forEach(b=>b.addEventListener('click',()=>{edit=M.find(c=>c.id===b.dataset.e);render();window.scrollTo({top:0})}));
  $$('[data-x]',box).forEach(b=>b.addEventListener('click',()=>{if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='Точно?';return}const A=store.get('mycards',[]);const c=A.find(x=>x.id===b.dataset.x);if(c){c.del=true;c.ts=Date.now()}store.set('mycards',A);bank=null;P.emit('my');render()}))}
/* ---- генерация с Claude ---- */
let sample=null,gen=[];
function genView(box){if(!sample){box.innerHTML=`<div class="panel"><h3>Создать с Claude</h3><p class="msg">Генерация карточек ИИ на сайте пока не подключена. Добавляйте карточки вручную или берите готовые колоды терминов.</p></div>`;return}
  box.innerHTML=`<div class="panel gen"><h3>Создать карточки по теме</h3><p class="msg">Опишите тему — Claude составит карточки в формате вопрос → ответ по школьному курсу. Перед добавлением их можно просмотреть и снять лишние.</p>
   <div class="row" style="flex-wrap:wrap"><input id="gT" placeholder="Например: гормоны гипофиза, строение почки, жизненный цикл сосны" style="flex:1;min-width:240px"><select id="gN">${[8,12,16,20].map(n=>`<option ${n===12?'selected':''}>${n}</option>`).join('')}</select><select id="gL"><option value="ОГЭ">ОГЭ</option><option value="ЕГЭ" ${track!=='vuz'?'selected':''}>ЕГЭ</option><option value="олимпиада">олимпиада</option><option value="вуз" ${track==='vuz'?'selected':''}>вуз (1 курс)</option></select><button class="btn" id="gGo">Сгенерировать</button></div>
   <p class="msg" id="gMsg" aria-live="polite"></p><div class="gprev" id="gPrev"></div><div class="row" id="gAddRow" hidden><button class="btn" id="gAdd">Добавить выбранные</button></div></div>`;
  $('#gGo').addEventListener('click',async()=>{const topic=$('#gT').value.trim();if(!topic){$('#gMsg').textContent='Напишите тему.';return}const n=+$('#gN').value,lvl=$('#gL').value;$('#gGo').disabled=true;$('#gMsg').textContent='Составляю карточки…';$('#gPrev').innerHTML='';$('#gAddRow').hidden=true;
    const prompt=`Составь ${n} карточек для интервального повторения по биологии на тему «${topic}», уровень — ${lvl}. Каждая карточка проверяет один факт: короткий вопрос на лицевой стороне и точный ответ в 1–2 предложения на обороте. ${lvl==='вуз'?'Используй терминологию вузовских учебников (Ленинджер «Основы биохимии», Тейлор — Грин — Стаут «Биология», Альбертс), без ошибок и выдумок; если факт спорный, не включай его.':'Используй терминологию российского школьного курса, без ошибок и выдумок.'} Ответь только JSON-массивом объектов вида {"f":"вопрос","b":"ответ"} на русском языке.`;
    try{const r=await sample.json(prompt,{modelTier:'default'});gen=(Array.isArray(r)?r:(r&&r.cards)||[]).filter(c=>c&&c.f&&c.b).slice(0,30).map(c=>({f:String(c.f).slice(0,600),b:String(c.b).slice(0,1500)}));
      if(!gen.length){$('#gMsg').textContent='Не удалось разобрать ответ. Попробуйте переформулировать тему.'}else{$('#gMsg').textContent=`Готово: ${gen.length}. Снимите галочки с лишних и добавьте в колоду «${topic.slice(0,60)}».`;
        $('#gPrev').innerHTML=gen.map((c,i)=>`<label><input type="checkbox" checked data-i="${i}"><span><b>${esc(c.f)}</b><br>${esc(c.b)}</span></label>`).join('');$('#gAddRow').hidden=false;
        $('#gAdd').onclick=()=>{let k=0;$$('#gPrev input:checked').forEach(x=>{const c=gen[+x.dataset.i];save(c.f,c.b,topic.slice(0,60),null,lvl==='вуз'?'vuz':'ege');k++});$('#gMsg').textContent=`Добавлено карточек: ${k}. Колода появилась на вкладке «Колоды» в треке «${lvl==='вуз'?'Вуз':'ЕГЭ и олимпиады'}».`;$('#gPrev').innerHTML='';$('#gAddRow').hidden=true}}}
    catch(e){$('#gMsg').textContent=e&&e.code==='not_granted'?'Доступ к Claude не разрешён для этой страницы.':e&&e.code==='rate_limited'?'Слишком много запросов — попробуйте через минуту.':'Не получилось сгенерировать. Попробуйте ещё раз позже.'}
    $('#gGo').disabled=false})}
/* ---- общий рендер ---- */
function render(){const box=$('#cBody');$$('#cTab button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===(view==='study'?'decks':view)));
  if(view==='study')return study(box);if(view==='mine')return mine(box);if(view==='gen')return genView(box);decks(box)}
$('#cTab').addEventListener('click',e=>{const b=BV_ET(e).closest('[data-v]');if(!b)return;view=b.dataset.v;ses=null;render()});
hooks.cards={show:()=>{bank=null;render()}};
P.on(k=>{if(k==='merge')bank=null});
BV.srs={has:k=>!!S()[k]||(k.startsWith('g:')&&false),
  addTerm(t){const k='g:'+P.id(t.k),s=S();if(!s[k]){s[k]=[0,2.5,0,Date.now(),Date.now()];store.set('srs',s);P.emit('srs')}},
  studyTerms(list,title){start(list.map(t=>'g:'+P.id(t.k)),title||'Термины')},
  dueCount(){const s=S(),now=Date.now();let n=0;for(const k in s)if(s[k][3]<=now)n++;return n},
  summary(){build();const c=counts([...B().keys()]);c.my=my().length;c.vuz=counts(trIds('vuz'));c.vuz.tot=trIds('vuz').length;return c},
  studyVuz(){build();start(vuzIds(),'Повторение · вуз')},
  bank(){return B()},
  studyIds(ids,title){build();const L=(ids||[]).filter(k=>B().has(k));if(!L.length)return;start(L,title||'Карточки по разделу',{rev:false})},
  studySmart(){start(smartIds().ids,'Умное повторение')},
  view(v,tr){if(tr)setTrack(tr);view=v;ses=null;BV.go('cards');try{history.replaceState(null,'','#cards')}catch(e){}render();window.scrollTo({top:0})}};
(async()=>{try{if(window.claude&&claude.use){sample=await claude.use('sample');if(sample&&view==='gen'&&!$('#m-cards').hidden)render()}}catch(e){}})();
})();
