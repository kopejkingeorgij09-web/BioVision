/* Работа без интернета.
   Когда сайт загрузился, в свободную минуту он сохраняет в кеш браузера всё, что нужно для конспектов:
   скрипты этой версии, файлы лекций и их рисунки. Отдаёт их потом service worker (sw.js).
   Видео, 3D-модели и облако (лабораторные работы, прогресс) без интернета недоступны: лабораторные
   показывают последнюю загруженную копию, прочитанные разделы уходят руководителю, когда связь вернётся.
   При экономии трафика заранее ничего не качается, сохраняется только открытое. */
(function(){
const {store}=BV,APP=BV.app;
const CACHE='bioviz-v3';
const VER=typeof BV_VER!=='undefined'?BV_VER:'';
const can='caches' in window&&'serviceWorker' in navigator;
const saveData=!!(navigator.connection&&navigator.connection.saveData);
let busy=false;
let failed=false,pdfSaving=null,saving=null;

const abs=u=>new URL(u,location.href).href;
const ver=u=>abs(u+'?v='+VER);
function text(){
  if(!can)return 'Этот браузер не умеет сохранять сайт для работы без интернета.';
  const s=store.get('offline',null);
  if(busy)return 'Сохраняю лекции для работы без интернета…';
  if(failed)return 'Не все файлы удалось сохранить. При восстановлении связи попробую ещё раз. Пока для открытия сайта может понадобиться интернет.';
  if(s&&s.ver===VER)return `Лекции и рисунки сохранены на этом устройстве. Без интернета откроются конспекты, лабораторные работы покажут последнюю загруженную копию. Для видео и 3D-моделей нужен интернет.`;
  if(saveData)return 'Включена экономия трафика, поэтому заранее ничего не скачивается. Без интернета откроется то, что ты уже смотрел.';
  return 'Лекции сохранятся на этом устройстве через минуту после загрузки сайта.';}
function paint(){const p=BVHOST.root.querySelector('.thm [data-off]');if(p)p.textContent=text()}

async function cachedFiles(c,list,refresh=false){
  const missing=[];let next=0;
  await Promise.all(Array.from({length:6},async()=>{while(next<list.length){const u=list[next++];
    try{if(!refresh&&await c.match(u))continue;const r=await fetch(u,{cache:'no-cache'});
      if(!r.ok)throw new Error('HTTP '+r.status);await c.put(u,r)}catch(e){missing.push(u)}}}));
  if(missing.length)throw new Error('Не сохранено файлов: '+missing.length);
  for(const u of list)if(!await c.match(u))throw new Error('В кеше нет '+u);
}
async function pdfFiles(c){
  const u=ver('bioviz/core/pdf-assets.json');await cachedFiles(c,[u]);
  const files=await (await c.match(u)).json();return [u,...files.map(abs)];
}
async function workerReady(){
  if(!can)throw new Error('Браузер не поддерживает чтение без интернета.');
  if(navigator.serviceWorker.controller)return;
  await new Promise((resolve,reject)=>{
    const done=()=>{if(navigator.serviceWorker.controller){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);resolve()}};
    const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);reject(new Error('Не включилось чтение без интернета. Обнови страницу с интернетом.'))},8000);
    navigator.serviceWorker.addEventListener('controllerchange',done);done();
  });
}
function preparePDF(){return pdfSaving||(pdfSaving=(async()=>{
  await workerReady();const c=await caches.open(CACHE);await cachedFiles(c,await pdfFiles(c));
})().finally(()=>{pdfSaving=null}))}

function save(force=false){
  if(saving)return saving;
  if(!can||!navigator.onLine||(saveData&&!force)||!VER)return Promise.resolve(false);
  return saving=saveAll().finally(()=>{saving=null});
}
async function saveAll(){
  const s=store.get('offline',null),C=window.BV_COURSE;
  const scripts=[].concat(typeof CORE!=='undefined'?CORE:[],typeof TAIL!=='undefined'?TAIL:[],C.lectures.map(L=>L.file));
  busy=true;failed=false;paint();
  try{await workerReady();const c=await caches.open(CACHE);
    const shell=[abs('./'),abs('index.html'),abs('manifest.webmanifest'),abs('icons/icon.svg'),abs('icons/icon-192.png')];
    const list=shell.concat(scripts.map(ver),[ver('bioviz/core/reading.css'),ver('content/reading/alberts/manifest.json')],await pdfFiles(c));
    /* Проверяем каждый обязательный адрес. Иконки не заменяют отсутствующий скрипт. */
    await cachedFiles(c,shell,!(s&&s.ver===VER));
    await cachedFiles(c,list);
    /* рисунки лекций: пути вида bioviz/img/... прямо в файлах лекций (видео пропускаем, оно тяжёлое) */
    const media=new Set();
    for(const f of C.lectures.map(L=>L.file)){const t=await (await c.match(ver(f))).text();
      (t.match(/bioviz\/(?:img|vid)\/[\w.-]+\.(?:jpe?g|png|webp|svg|gif)/g)||[]).forEach(m=>media.add(m))}
    await cachedFiles(c,[...media].map(abs));
    store.set('offline',{ver:VER,t:Date.now(),n:list.length+media.size});return true}
  catch(e){failed=true;store.del('offline');console.warn('offline',e);return false}
  finally{busy=false;paint()}}

/* A new shell is already cached by the worker; offer a deliberate reload. */
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type!=='bv-update')return;BV.toast('Доступна новая версия.',12000);const toast=BVHOST.root.querySelector('.bv-toast');if(toast&&!toast.querySelector('button')){const b=document.createElement('button');b.className='btn sm';b.textContent='Обновить';b.style.pointerEvents='auto';b.onclick=()=>location.reload();toast.append(' ',b)}});
/* связь пропала и вернулась */
addEventListener('offline',()=>BV.toast('Нет интернета. Конспекты открываются из сохранённой копии, прочитанное отправится позже.',5200));
addEventListener('online',()=>{BV.toast('Интернет снова есть.',2400);BV.progress&&BV.progress.sync(true);setTimeout(save,3000)});
if(!navigator.onLine)setTimeout(()=>BV.toast('Нет интернета. Конспекты открываются из сохранённой копии.',5200),1200);

const idle=window.requestIdleCallback||(f=>setTimeout(f,1));
setTimeout(()=>idle(()=>save(),{timeout:8000}),30000);
BV.offline={text,save,preparePDF};
})();
