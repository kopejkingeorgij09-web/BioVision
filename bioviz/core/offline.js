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

const abs=u=>new URL(u,location.href).href;
const ver=u=>abs(u+'?v='+VER);
function text(){
  if(!can)return 'Этот браузер не умеет сохранять сайт для работы без интернета.';
  const s=store.get('offline',null);
  if(busy)return 'Сохраняю лекции для работы без интернета…';
  if(s&&s.ver===VER)return `Лекции и рисунки сохранены на этом устройстве. Без интернета откроются конспекты, лабораторные работы покажут последнюю загруженную копию. Для видео и 3D-моделей нужен интернет.`;
  if(saveData)return 'Включена экономия трафика, поэтому заранее ничего не скачивается. Без интернета откроется то, что ты уже смотрел.';
  return 'Лекции сохранятся на этом устройстве через минуту после загрузки сайта.';}
function paint(){const p=BVHOST.root.querySelector('.thm [data-off]');if(p)p.textContent=text()}

async function save(){
  if(!can||busy||!navigator.onLine||saveData||!VER)return;
  const s=store.get('offline',null),C=window.BV_COURSE;
  const scripts=[].concat(typeof CORE!=='undefined'?CORE:[],typeof TAIL!=='undefined'?TAIL:[],C.lectures.map(L=>L.file));
  try{const c=await caches.open(CACHE);
    if(s&&s.ver===VER&&await c.match(ver(scripts[scripts.length-1])))return;
    busy=true;paint();
    /* рисунки лекций: пути вида bioviz/img/... прямо в файлах лекций (видео пропускаем, оно тяжёлое) */
    const media=new Set();
    for(const f of C.lectures.map(L=>L.file)){try{const t=await (await fetch(ver(f))).text();
      (t.match(/bioviz\/(?:img|vid)\/[\w.-]+\.(?:jpe?g|png|webp|svg|gif)/g)||[]).forEach(m=>media.add(m))}catch(e){}}
    const list=[abs('./'),abs('index.html'),abs('manifest.webmanifest'),abs('bioviz/x/cloud.js'),abs('icons/icon.svg'),abs('icons/icon-192.png')]
      .concat(scripts.map(ver),[...media].map(abs));
    let n=0;
    for(const u of list){try{const r=await fetch(u,{cache:'no-cache'});if(r.ok){await c.put(u,r);n++}}catch(e){}}
    /* старые версии скриптов больше не нужны */
    for(const req of await c.keys()){const q=new URL(req.url).searchParams.get('v');if(q&&q!==VER)await c.delete(req)}
    if(n>=scripts.length)store.set('offline',{ver:VER,t:Date.now(),n})}
  catch(e){console.warn('offline',e)}
  finally{busy=false;paint()}}

/* связь пропала и вернулась */
addEventListener('offline',()=>BV.toast('Нет интернета. Конспекты открываются из сохранённой копии, прочитанное отправится позже.',5200));
addEventListener('online',()=>{BV.toast('Интернет снова есть.',2400);BV.progress&&BV.progress.sync(true);setTimeout(save,3000)});
if(!navigator.onLine)setTimeout(()=>BV.toast('Нет интернета. Конспекты открываются из сохранённой копии.',5200),1200);

const idle=window.requestIdleCallback||(f=>setTimeout(f,1));
setTimeout(()=>idle(save,{timeout:8000}),6000);
BV.offline={text,save};
})();
