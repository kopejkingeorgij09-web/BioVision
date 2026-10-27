/* Облако «Фагов естественных наук» на Supabase.
   Платформа раньше жила артефактом claude.ai и брала базу документов из window.claude.use('db').
   Этот файл даёт тот же интерфейс (doc/collection, get/set/update/delete/add, onSnapshot,
   orderBy/limit/where, user.me/profiles, downloads.save), но хранит данные в Supabase (функции ph_*).
   Вход по коду: ученицам коды выдаёт учитель (кнопка «Коды»), учитель входит своим секретным кодом.
   Права проверяются на сервере (таблица ph_rules повторяет правила старого артефакта).
   Живого канала нет: изменения подтягиваются одним запросом ph_sync каждые несколько секунд. */
(function(){
const URL='https://zonrkvsibojyalhnqutd.supabase.co';
const KEY='sb_publishable_WyJ9PYWg8s4kizqn9E0OJQ_iuDgGdbs';
const LS='ph_code';
const getCode=()=>{try{return localStorage.getItem(LS)||''}catch(e){return ''}};
const setCode=c=>{try{c?localStorage.setItem(LS,c):localStorage.removeItem(LS)}catch(e){}};

async function rpc(fn,args){
  let r;
  try{r=await fetch(URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+KEY},body:JSON.stringify(args||{})})}
  catch(e){throw {code:'unavailable',message:'Нет связи с облаком'}}
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
  if(!r.ok){const den=r.status===403||(j&&j.code==='42501');throw {code:den||(j&&j.code==='22023')?'invalid_argument':'unavailable',message:(j&&j.message)||('HTTP '+r.status)}}
  return j}

/* ---------- вход ---------- */
let me=null;
const ready=(async()=>{const c=getCode();if(!c)return null;
  try{me=await rpc('ph_login',{p_code:c});if(!me)setCode('')}catch(e){me=null}
  return me})();

function css(){if(document.getElementById('ph-css'))return;const s=document.createElement('style');s.id='ph-css';s.textContent=`
#ph-login{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;background:var(--bg,#F1F6F2) var(--hex,none);background-size:42px 75px;font:16px/1.5 var(--f,system-ui,sans-serif);color:var(--text,#16231E)}
#ph-login form{width:min(100%,380px);background:var(--card,#fff);border:1px solid var(--line,#D2E1D7);border-radius:20px;padding:24px;box-shadow:0 18px 40px -24px rgba(0,0,0,.4)}
#ph-login h1{font:700 20px/1.2 var(--d,system-ui);color:var(--ink,#0E4A38);margin:0 0 6px}
#ph-login p{margin:0 0 16px;color:var(--muted,#58695F);font-size:14px}
#ph-login input{width:100%;box-sizing:border-box;font:600 18px ui-monospace,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;padding:12px 14px;border-radius:12px;border:1.5px solid var(--line,#D2E1D7);background:var(--bg,#F1F6F2);color:inherit}
#ph-login input:focus{outline:2px solid var(--focus,#2C7BE5);outline-offset:1px}
#ph-login button{margin-top:12px;width:100%;padding:12px;border:0;border-radius:12px;background:var(--ink,#0E4A38);color:var(--card,#fff);font:600 16px var(--f,system-ui);cursor:pointer}
#ph-login .err{color:var(--accent,#C2366B);font-size:14px;min-height:1.4em;margin-top:8px}
#ph-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
#ph-bar button{font:500 12.5px var(--f,system-ui);padding:5px 10px;border-radius:999px;border:1px solid var(--line,#D2E1D7);background:var(--card,#fff);color:var(--muted,#58695F);cursor:pointer;opacity:.85}
#ph-bar button:hover{opacity:1;color:var(--text,#16231E)}
#ph-codes{border:1px solid var(--line,#D2E1D7);border-radius:18px;padding:20px;width:min(94vw,440px);background:var(--card,#fff);color:var(--text,#16231E);font:15px/1.5 var(--f,system-ui)}
#ph-codes::backdrop{background:rgba(0,0,0,.35)}
#ph-codes h2{font:700 17px var(--d,system-ui);margin:0 0 10px;color:var(--ink,#0E4A38)}
#ph-codes ul{list-style:none;margin:0 0 14px;padding:0}
#ph-codes li{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line,#D2E1D7)}
#ph-codes li b{flex:1}#ph-codes code{font:600 14px ui-monospace,Menlo,monospace}
#ph-codes button{font:inherit;font-size:14px;padding:6px 12px;border-radius:10px;border:1px solid var(--line,#D2E1D7);background:var(--soft,#E7F0EA);color:inherit;cursor:pointer}
#ph-codes .row{display:flex;gap:8px}#ph-codes input{flex:1;min-width:0;font:inherit;padding:6px 10px;border-radius:10px;border:1px solid var(--line,#D2E1D7);background:var(--bg,#F1F6F2);color:inherit}
`;document.head.append(s)}

function loginScreen(){css();const d=document.createElement('div');d.id='ph-login';
  d.innerHTML=`<form><h1>Фаги естественных наук</h1><p>Введите код, который дал учитель. Он выглядит так: FAG-XXXX-XXXX.</p>
  <input id="ph-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="FAG-XXXX-XXXX" aria-label="Код входа">
  <button type="submit">Войти</button><div class="err" role="alert"></div></form>`;
  document.body.append(d);const f=d.querySelector('form'),inp=d.querySelector('input'),er=d.querySelector('.err');inp.focus();
  f.onsubmit=async e=>{e.preventDefault();const c=inp.value.trim().toUpperCase();if(!c){er.textContent='Введите код.';return}
    er.textContent='Проверяю…';let r;try{r=await rpc('ph_login',{p_code:c})}catch(x){er.textContent='Нет связи с облаком. Проверьте интернет.';return}
    if(!r){er.textContent='Такого кода нет. Проверьте буквы: они латинские.';return}
    setCode(c);location.reload()}}

function bar(){css();if(document.getElementById('ph-bar'))return;const b=document.createElement('div');b.id='ph-bar';
  b.innerHTML=(me.isOwner?'<button type="button" data-a="codes">Коды учениц</button>':'')+`<button type="button" data-a="out">Выйти</button>`;
  b.onclick=e=>{const a=e.target.closest('button');if(!a)return;
    if(a.dataset.a==='out'){if(!confirm('Выйти? На этом устройстве нужно будет снова ввести код.'))return;setCode('');
      try{Object.keys(localStorage).forEach(k=>{if(k!=='theme')localStorage.removeItem(k)})}catch(x){}location.reload()}
    else codes()};
  const place=()=>{const w=document.getElementById('who');if(!w||!w.parentNode)return false;if(b.parentNode!==w.parentNode||b.previousElementSibling!==w)w.after(b);return true};
  if(!place()){b.style.cssText='position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:40';document.body.append(b)}
  new MutationObserver(()=>{if(!b.isConnected||b.style.position)place()&&(b.style.cssText='')}).observe(document.body,{childList:true,subtree:true})}

async function codes(){let dl=document.getElementById('ph-codes');
  if(!dl){dl=document.createElement('dialog');dl.id='ph-codes';document.body.append(dl)}
  const draw=async()=>{let list=[];try{list=await rpc('ph_codes',{p_code:getCode()})}catch(e){dl.innerHTML='<p>Не получилось загрузить коды.</p><button value="x">Закрыть</button>';return}
    dl.innerHTML=`<h2>Коды учениц</h2><ul>${list.map(s=>`<li><b></b><code></code><button type="button" data-del="${s.id}">Удалить</button></li>`).join('')||'<li>Пока никого</li>'}</ul>
      <div class="row"><input placeholder="Имя новой ученицы" maxlength="40"><button type="button" data-new>Выдать код</button></div>
      <p style="font-size:13px;color:var(--muted,#58695F)">Удаление кода не стирает прогресс, но ученица больше не сможет войти этим кодом.</p>
      <div style="text-align:right"><button type="button" data-close>Закрыть</button></div>`;
    dl.querySelectorAll('li').forEach((li,i)=>{const s=list[i];if(!s)return;li.querySelector('b').textContent=s.name||'Без имени';li.querySelector('code').textContent=s.code})};
  dl.onclick=async e=>{const t=e.target;
    if(t.dataset.close!==undefined){dl.close();return}
    if(t.dataset.del){if(!confirm('Удалить этот код?'))return;await rpc('ph_code_delete',{p_code:getCode(),p_uid:t.dataset.del}).catch(()=>{});draw()}
    if(t.dataset.new!==undefined){const nm=dl.querySelector('input').value.trim();if(!nm)return;await rpc('ph_code_new',{p_code:getCode(),p_name:nm}).catch(()=>{});draw()}};
  await draw();if(!dl.open)dl.showModal()}

/* ---------- база ---------- */
const cache=new Map();          // path -> {data, t, col}
const colLoaded=new Set();
const docSubs=new Map(), colSubs=new Map();
let since=null, timer=null, syncing=false;
const split=p=>{const s=String(p).split('/');return{col:s.slice(0,-1).join('/'),id:s[s.length-1]}};
const meta={fromCache:false,hasPendingWrites:false};
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const bad=m=>({code:'invalid_argument',message:m});
function checkDoc(p){const n=String(p).split('/').length;if(!p||n%2)throw new TypeError('Путь документа должен иметь чётное число частей: '+p)}
function checkCol(p){const n=String(p).split('/').length;if(!p||n%2===0)throw new TypeError('Путь коллекции должен иметь нечётное число частей: '+p)}
const newId=()=>{const a='abcdefghijklmnopqrstuvwxyz0123456789';let s='';const r=crypto.getRandomValues(new Uint8Array(20));for(const x of r)s+=a[x%36];return s};

function dsnap(path){const e=cache.get(path),id=split(path).id,ex=!!(e&&e.data);const d=ex?Object.freeze(clone(e.data)):undefined;
  return{id,exists:ex,data:()=>d,metadata:meta}}
function cmp(a,b){if(a===b)return 0;if(a===undefined)return 1;if(b===undefined)return -1;return a<b?-1:1}
function testWhere(v,op,x){switch(op){case'==':return v===x;case'!=':return v!==x;case'<':return v<x;case'<=':return v<=x;case'>':return v>x;case'>=':return v>=x;
  case'in':return Array.isArray(x)&&x.includes(v);case'not-in':return Array.isArray(x)&&!x.includes(v);case'array-contains':return Array.isArray(v)&&v.includes(x);default:return false}}
function qsnap(col,q){let docs=[];for(const[p,e]of cache)if(e.col===col&&e.data)docs.push({p,e});
  docs.sort((a,b)=>cmp(split(a.p).id,split(b.p).id));
  for(const w of q.where)docs=docs.filter(x=>testWhere(x.e.data[w[0]],w[1],w[2]));
  if(q.order){const[f,dir]=q.order;docs.sort((a,b)=>{const r=cmp(a.e.data[f],b.e.data[f]);return dir==='desc'?(a.e.data[f]===undefined?1:b.e.data[f]===undefined?-1:-r):r})}
  if(q.lim)docs=docs.slice(0,q.lim);
  const out=docs.map(x=>dsnap(x.p));
  return{docs:out,size:out.length,empty:!out.length,docChanges:()=>out.map((d,i)=>({type:'added',doc:d,oldIndex:-1,newIndex:i})),metadata:meta}}

function notify(paths){const cols=new Set();
  for(const p of paths){const s=docSubs.get(p);if(s)s.forEach(l=>l.fire());cols.add(split(p).col)}
  for(const c of cols){const s=colSubs.get(c);if(s)s.forEach(l=>l.fire())}}
function put(path,data,t){const old=cache.get(path);if(t&&old&&old.t&&old.t>t)return false;
  cache.set(path,{data:data==null?null:data,t:t||(old&&old.t)||'',col:split(path).col});return true}

async function loadCol(col){if(colLoaded.has(col))return;const l=await rpc('ph_list',{p_code:getCode(),p_col:col});
  for(const x of l||[])put(col+'/'+x.id,x.data,x.t);colLoaded.add(col)}
async function loadDoc(path){if(cache.has(path))return;const d=await rpc('ph_get',{p_code:getCode(),p_path:path});if(!cache.has(path))put(path,d,'')}

async function sync(){if(syncing||!me)return;if(!docSubs.size&&!colSubs.size)return;syncing=true;
  try{const r=await rpc('ph_sync',{p_code:getCode(),p_cols:[...colSubs.keys()],p_docs:[...docSubs.keys()],p_since:since||new Date(Date.now()-60000).toISOString()});
    const ch=[];for(const x of r.ch||[]){if(put(x.p,x.d,x.t))ch.push(x.p)}
    since=new Date(new Date(r.now).getTime()-3000).toISOString();if(ch.length)notify(ch)}
  catch(e){}finally{syncing=false}}
function startSync(){if(timer)return;since=new Date(Date.now()-3000).toISOString();
  const tick=()=>{timer=setTimeout(async()=>{await sync();tick()},document.hidden?20000:4000)};tick();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()})}

function listener(map,key,fn,err,load){let alive=true,last=null;
  const l={fire(){if(!alive)return;try{fn()}catch(e){console.error(e)}}};
  if(!map.has(key))map.set(key,new Set());map.get(key).add(l);startSync();
  load().then(()=>l.fire()).catch(e=>{if(err&&alive)err(e)});
  return()=>{alive=false;const s=map.get(key);if(s){s.delete(l);if(!s.size)map.delete(key)}}}

function mergeLocal(a,b){const r=clone(a)||{};for(const k of Object.keys(b)){const v=b[k];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&v.__delete__)delete r[k];
  else if(v&&typeof v==='object'&&!Array.isArray(v)&&r[k]&&typeof r[k]==='object'&&!Array.isArray(r[k]))r[k]=mergeLocal(r[k],v);
  else r[k]=clone(v)}return r}

function docRef(path){checkDoc(path);const id=split(path).id;
  return{id,path,
    async get(){const d=await rpc('ph_get',{p_code:getCode(),p_path:path});const e=cache.get(path);
      if(!e||e.t!==''||!e.data)cache.set(path,{data:d,t:(e&&e.t)||'',col:split(path).col});return dsnap(path)},
    async set(data){if(!data||typeof data!=='object'||Array.isArray(data))throw bad('Документ должен быть объектом');
      const prev=cache.get(path);put(path,clone(data),'');notify([path]);
      try{const t=await rpc('ph_set',{p_code:getCode(),p_path:path,p_data:data});put(path,clone(data),t)}
      catch(e){prev?cache.set(path,prev):cache.delete(path);notify([path]);throw e}},
    async update(data){const prev=cache.get(path);
      if(prev&&prev.data){put(path,mergeLocal(prev.data,data),'');notify([path])}
      try{const t=await rpc('ph_update',{p_code:getCode(),p_path:path,p_data:data});const e=cache.get(path);if(e)e.t=t;
        if(!prev||!prev.data){const d=await rpc('ph_get',{p_code:getCode(),p_path:path});put(path,d,t);notify([path])}}
      catch(e){if(prev)cache.set(path,prev);notify([path]);throw e}},
    async delete(){const prev=cache.get(path);put(path,null,'');notify([path]);
      try{const t=await rpc('ph_delete',{p_code:getCode(),p_path:path});put(path,null,t)}catch(e){if(prev)cache.set(path,prev);notify([path]);throw e}},
    async acquire(o){return{acquired:true,holder:o&&o.holder,expiresAt:new Date(Date.now()+((o&&o.ttlMs)||30000)).toISOString()}},
    onSnapshot(next,err){return listener(docSubs,path,()=>next(dsnap(path)),err,()=>loadDoc(path))},
    collection(sub){return colRef(path+'/'+sub)}}}

function query(col,q){return{
  where(f,op,v){return query(col,{...q,where:[...q.where,[f,op,v]]})},
  orderBy(f,dir){return query(col,{...q,order:[f,dir||'asc']})},
  limit(n){return query(col,{...q,lim:n})},
  async get(){await loadCol(col);return qsnap(col,q)},
  onSnapshot(next,err){return listener(colSubs,col,()=>next(qsnap(col,q)),err,()=>loadCol(col))}}}
function colRef(col){checkCol(col);const base=query(col,{where:[],order:null,lim:0});
  return Object.assign(base,{path:col,doc:id=>docRef(col+'/'+(id||newId())),
    async add(data){const r=docRef(col+'/'+newId());await r.set(data);return r}})}
const db={doc:docRef,collection:colRef};

/* ---------- пользователь и скачивание ---------- */
const prof={};
const user={
  async id(){return me?me.id:null},
  async me(){return{id:me.id,isOwner:!!me.isOwner,name:me.name||''}},
  async isOwner(){return !!(me&&me.isOwner)},
  async canEdit(){return !!(me&&me.isOwner)},
  async can(){return !!me},
  async profiles(ids){const need=(ids||[]).filter(i=>!(i in prof));
    if(need.length){try{const r=await rpc('ph_profiles',{p_code:getCode(),p_ids:need});need.forEach(i=>{prof[i]={id:i,name:(r&&r[i]&&r[i].name)||''}})}catch(e){}}
    const out={};(ids||[]).forEach(i=>{out[i]=prof[i]||{id:i,name:''}});return out},
  async search(){return[]}};
const downloads={async save({filename,data,type}){
  const b=data instanceof Blob?data:new Blob([data],{type:type||'application/octet-stream'});
  const a=document.createElement('a');a.href=window.URL.createObjectURL(b);a.download=filename||'file';document.body.appendChild(a);a.click();
  setTimeout(()=>{window.URL.revokeObjectURL(a.href);a.remove()},1500)}};

/* ИИ-разбор (sample) и загрузка файлов (assets) работали только внутри claude.ai: здесь их нет, платформа это учитывает сама. */
const gate=ready.then(m=>{if(m)return m;
  const show=()=>loginScreen();document.readyState==='loading'?document.addEventListener('DOMContentLoaded',show):show();
  return new Promise(()=>{})});
gate.then(()=>{const go=()=>bar();document.readyState==='loading'?document.addEventListener('DOMContentLoaded',go):go()});

/* fresh — документ прямо с сервера, мимо кеша страницы (кеш может держать неподтверждённую запись): нужен сохранению острова */
window.PHCLOUD={rpc,get me(){return me},sync,codes:()=>me&&me.isOwner&&codes(),fresh:path=>rpc('ph_get',{p_code:getCode(),p_path:path})};
window.claude={use:async name=>{await gate;
  if(name==='db')return db;
  if(name==='user')return user;
  if(name==='downloads')return downloads;
  return null}};
})();
