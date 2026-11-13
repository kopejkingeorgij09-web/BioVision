/* Platform usage: durable cumulative counters, no answer text, search text or codes.
   Separate streams keep concurrent tabs from overwriting one another. */
(function(){
'use strict';
const {$,$$,esc}=BV,P=BV.personal,A=window.BVAUTH;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch(e){return fallback}};
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
let device=read('bv-usage-device',null);const stream=random();
try{if(!device){device=random();localStorage.setItem('bv-usage-device',JSON.stringify(device))}}catch(e){device=device||random()}
const stateKey='bv-usage-outbox:'+stream;
let state=read(stateKey,{}),owner=P.owner,last=Date.now(),active=last,visible=!document.hidden,target=null,reader=null,busy=false,error='';
const day=()=>new Date().toISOString().slice(0,10);
const save=()=>{try{localStorage.setItem(stateKey,JSON.stringify(state))}catch(e){/* Usage must never block studying. */}};
const enabled=()=>!BV.app.isAdmin();
function metric(item,change){if(!enabled())return;const date=day(),scope=owner||'guest',key=scope+'|'+date+'|'+item.key;
 const row=state[key]||(state[key]={...item,label:item.label.replace(/\s+/g,' ').slice(0,180),owner,day:date,stream,views:0,seconds:0,pages:[],rev:0});row.label=item.label.replace(/\s+/g,' ').slice(0,180);change(row);row.rev++;row.dirty=true;save()}
function routeInfo(){const r=BV.app.route;if(!r)return null;
 if(r.kind==='home')return{key:'page:course',kind:'page',section:'course',label:'Курс'};
 if(r.kind==='me')return{key:'page:profile',kind:'page',section:'profile',label:'Профиль'};
 if(r.kind==='lecture'){const sec=BV.$('.page:not([hidden]) .k-toc a.on'),id=sec?.dataset.to||r.sec||'intro';return{key:'lecture:'+r.L.id+':'+id,kind:'lecture',section:'course',label:'Лекция '+r.L.n+' · '+(sec?.textContent.trim()||r.L.title)}}
 if(r.x?.key==='labs'){return{key:'lab:'+(r.m?.id||'list'),kind:'page',section:'labs',label:r.m?.id?'Лаба · '+r.m.id:'Лабы'}}
 if(r.x?.key==='reading'){const m=r.m;
  if(m.view==='library')return{key:'page:reading',kind:'page',section:'reading',label:'Чтиво · библиотека'};
  if(m.view==='bank')return{key:'page:'+(m.mistakes?'mistakes':'practice'),kind:'page',section:'practice',label:m.mistakes?'Стопка ошибок':'Банк заданий'};
  if(m.view==='native')return{key:'topic:'+(m.topic||'resume'),kind:'topic',section:'reading',label:'Альбертс · '+(BV.$('#rd-topic-title')?.textContent.trim()||m.topic||'чтение')};
  return{key:'page:pdf:'+(m.id==='alberts'?'alberts':'local'),kind:'page',section:'reading',label:m.id==='alberts'?'Альбертс · оригинал PDF':'Личный PDF'}
 }
 return null
}
const bookInfo=id=>({key:'book:'+id,kind:'book',section:'reading',label:id==='alberts'?'Альбертс · Том 1':'Личный PDF'});
function complete(){if(reader&&reader.dwell>=20)metric(bookInfo(reader.id),r=>{if(r.pages.length<1000&&!r.pages.includes(reader.page))r.pages.push(reader.page)});reader=null}
function tick(){const now=Date.now(),elapsed=Math.max(0,Math.min(15,(now-last)/1000));last=now;
 const info=routeInfo(),pos=BV.learning.position();if(info&&target?.key===info.key)target=info;
 const usable=visible&&now-active<=90000&&enabled();
 if(usable&&target){metric(target,r=>r.seconds+=elapsed);if(reader){reader.dwell+=elapsed;metric(bookInfo(reader.id),r=>r.seconds+=elapsed)}}
 if(!pos||!usable||reader&&(reader.id!==pos.id||reader.page!==pos.page)){complete()}
 if(pos&&usable&&!reader)reader={...pos,dwell:0};
 if(info&&target&&info.key!==target.key)metric(info,r=>r.views++);
 target=info;visible=!document.hidden
}
function route(){target=routeInfo();last=Date.now();active=last;reader=null;if(target)metric(target,r=>r.views++)}
function action(id,label){if(!target)return;metric({key:'action:'+id,kind:'action',section:target.section,label},r=>r.views++)}
const actions={toc:'Оглавление',search:'Поиск в книге',mark:'Закладка',marks:'Список закладок',settings:'Настройки чтения',original:'Оригинал PDF',verbatim:'Текст PDF',full:'Полный экран',answer:'Проверка теста',reveal:'Разбор задания','save-grade':'Самооценка','self-ok':'Закреплено','self-repeat':'К повторению',shuffle:'Перемешивание заданий',personal:'Личный код',tempo:'Темп чтения'};
BVHOST.root.addEventListener('click',e=>{const el=BV_ET(e),b=el.closest('[data-rd]');if(b&&actions[b.dataset.rd])action(b.dataset.rd,actions[b.dataset.rd]);if(el.closest('[data-personal-profile]'))action('personal','Личный код');if(el.closest('.kf-b,.kf-leg li,.kf-ctl button'))action('figure','Интерактивный рисунок');if(el.closest('.k-opt'))action('lecture-question','Вопрос в лекции');});
BVHOST.root.addEventListener('change',e=>{const el=BV_ET(e);if(el.matches('[data-upload]')&&el.files?.length)action('upload','Добавление PDF');if(el.matches('[data-bank-section],[data-bank-type],[data-bank-status]'))action('filter','Фильтры банка заданий')});
for(const name of ['pointerdown','keydown','scroll','touchstart'])addEventListener(name,()=>{active=Date.now()},{passive:true,capture:true});
addEventListener('bv-before-route',()=>{tick();complete();target=null});addEventListener('bv-route',route);
addEventListener('visibilitychange',()=>{tick();if(!document.hidden)active=Date.now();else flush()});
addEventListener('pagehide',()=>{tick();complete();flush()});
addEventListener('bv-personal-data',()=>{if(owner===P.owner)return;tick();complete();owner=P.owner;route();flush()});
async function flush(){if(busy||!navigator.onLine||!enabled())return;busy=true;
 try{
  // Recover outboxes left by closed tabs and browser restarts as well as this tab.
  const queues=new Set([stateKey]);try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('bv-usage-outbox:'))queues.add(k)}}catch(e){}
  for(const queue of queues){let records=queue===stateKey?state:read(queue,{});
   for(const scope of [null,P.owner].filter((x,i,a)=>a.indexOf(x)===i)){
    const all=Object.entries(records).filter(([,r])=>r.dirty&&r.owner===scope);
    for(let i=0;i<all.length;i+=100){const batch=all.slice(i,i+100).map(([key,r])=>({key,rev:r.rev,item:{...r}}));
     await P.sendActivity(device,batch.map(x=>x.item),scope);
     records=queue===stateKey?state:read(queue,{});
     for(const x of batch)if(records[x.key]?.rev===x.rev)records[x.key].dirty=false;
     try{localStorage.setItem(queue,JSON.stringify(records))}catch(e){}
    }
   }
   const cutoff=new Date(Date.now()-89*864e5).toISOString().slice(0,10);for(const [key,r] of Object.entries(records))if(r.day<cutoff&&!r.dirty)delete records[key];
   try{localStorage.setItem(queue,JSON.stringify(records))}catch(e){}
  }error='';
 }catch(e){error='Неотправленная статистика сохранена на устройстве'}finally{busy=false}}

setInterval(tick,10000);setInterval(flush,30000);addEventListener('online',flush);

const sections={course:'Курс',labs:'Лабы',reading:'Чтиво',practice:'Банк заданий',profile:'Профиль'};
const duration=n=>n<60?Math.round(n)+' с':n<3600?Math.round(n/60)+' мин':(n/3600).toFixed(1)+' ч';
function dashboard(box){box.innerHTML=`<div class="acts"><label>Период <select data-period aria-label="Период статистики"><option value="7">7 дней</option><option value="30" selected>30 дней</option><option value="90">90 дней</option></select></label><button class="btn ghost" data-update>Обновить</button></div><p class="msg" data-usage-status role="status"></p><div data-usage></div>`;
 let version=0;
 async function draw(){const v=++version,s=$('[data-usage-status]',box),out=$('[data-usage]',box);s.textContent='Загружаю…';try{const data=await A.activityReport(Number($('[data-period]',box).value));if(v!==version||!box.isConnected)return;const rows=data.rows||[];
  s.textContent='Обновлено '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'. Данные поступают с открытых устройств примерно раз в 30 секунд.';
  if(!rows.length){out.innerHTML='<p class="msg">За этот период данных пока нет. Статистика появится после первых посещений обновлённой платформы.</p>';return}
  const visits=rows.filter(r=>['page','topic','lecture'].includes(r.kind)),features=rows.filter(r=>r.kind==='action');
  const total=(list,k)=>list.reduce((s,r)=>s+Number(r[k]||0),0);
  function group(list,key){const map=new Map();for(const r of list){const k=key(r),a=map.get(k)||{label:r.label,views:0,seconds:0,pages:0};for(const n of ['views','seconds','pages'])a[n]+=Number(r[n]||0);map.set(k,a)}return [...map.entries()].sort((a,b)=>b[1].views-a[1].views||b[1].seconds-a[1].seconds)}
  function ranking(list,key){const entries=group(list,key);return entries.length?'<ol class="usage-list">'+entries.map(([k,r])=>'<li><span>'+esc(r.label)+'</span><b>'+r.views+'</b><small>'+(r.seconds?duration(r.seconds):'')+'</small></li>').join('')+'</ol>':'<p class="msg">Пока нет данных.</p>'}
  const visitors=[...new Set(rows.map(r=>r.visitor))];
  out.innerHTML=`<div class="stat"><div><b>${visitors.length}</b><span>посетителей</span></div><div><b>${total(visits,'views')}</b><span>открытий</span></div><div><b>${duration(total(visits,'seconds'))}</b><span>активное время</span></div></div>
  <div class="usage-grid"><section><h3>Разделы платформы</h3><p class="msg">Открытия · активное время</p>${ranking(visits.map(r=>({...r,label:sections[r.section]||r.section})),r=>r.section)}</section><section><h3>Чем пользуются</h3><p class="msg">Число использований</p>${ranking(features,r=>r.key)}</section></div>
  <details><summary>Что читают · лекции и микротемы</summary>${ranking(visits.filter(r=>['lecture','topic'].includes(r.kind)),r=>r.key)}</details>
  <h3>Активность посетителей</h3><p class="msg">Номер профиля объединяет устройства с одним личным кодом. Гость определяется в пределах браузера. Имя и сам код не собираются.</p>
  <div class="usage-visitors">${visitors.map(id=>{const own=rows.filter(r=>r.visitor===id),v=own.filter(r=>['page','topic','lecture'].includes(r.kind)),b=own.filter(r=>r.kind==='book'),secs=total(b,'seconds'),pages=total(b,'pages'),latest=Math.max(...own.map(r=>Date.parse(r.last_at))),label=(id.startsWith('p:')?'Профиль ':'Гость ')+id.slice(2,10).toUpperCase();
   return `<details class="usage-visitor"><summary><strong>${esc(label)}</strong><span>${total(v,'views')} открытий · ${duration(total(v,'seconds'))}</span></summary><p class="msg">Последняя активность: ${new Date(latest).toLocaleString('ru-RU')}<br>Чтение: ${duration(secs)} · ${pages} стр. с чтением · ${pages>=3&&secs>=60?(pages/(secs/3600)).toFixed(1)+' стр./ч':'темп: собираем данные'}</p><h4>Разделы</h4>${ranking(v.map(r=>({...r,label:sections[r.section]||r.section})),r=>r.section)}<h4>Чтение</h4>${ranking(v.filter(r=>['lecture','topic'].includes(r.kind)),r=>r.key)}<h4>Действия</h4>${ranking(own.filter(r=>r.kind==='action'),r=>r.key)}</details>`
  }).join('')}</div><p class="msg">Страница с чтением засчитывается после 20 секунд и ухода с неё. Темп — страницы на активный час; повторные посещения в разные дни учитываются. Фоновая вкладка и простой дольше 90 секунд исключены. Открытие раздела само по себе не означает, что он прочитан.</p>`;
 }catch(e){if(v===version)s.textContent='Не удалось загрузить статистику. Проверь связь и повтори обновление.'}}
 $('[data-period]',box).onchange=draw;$('[data-update]',box).onclick=draw;draw()
}
BV.activity={dashboard,action,flush,tick,get pending(){return Object.values(state).filter(r=>r.dirty).length},get message(){return error}};
})();
