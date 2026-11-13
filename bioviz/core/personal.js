/* Personal reading profile. Per-record revisions, durable outbox and conflict copies. */
(function(){
'use strict';
const legacy=BV.store,KEY='bv-personal-session',STATE='bv-personal-state:',URL='https://zonrkvsibojyalhnqutd.supabase.co/rest/v1/rpc/bv_personal_sync',API='sb_publishable_WyJ9PYWg8s4kizqn9E0OJQ_iuDgGdbs';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
let session=read(KEY,null),busy=false,timer,message='На устройстве';
const empty=()=>({records:{},conflicts:[]});
const scope=()=>session?session.owner:'guest';
const RECORD='bv-personal-record:',META='bv-personal-meta:';
let cachedKey='',cachedState=null,signatures=new Map(),baselineIds=[],covered=new Set();
const prefix=id=>RECORD+id+':';
function readScope(id){
 const s=read(STATE+id,empty()),meta=read(META+id,null),start=prefix(id);if(meta)s.cursor=meta.cursor||0;
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(start)){const record=read(key,null);if(record)s.records[decodeURIComponent(key.slice(start.length))]=record}}
 return s
}
function load(){const id=scope();if(cachedKey===id&&cachedState)return cachedState;
 cachedKey=id;baselineIds=Object.keys(read(STATE+id,empty()).records);covered=new Set();const start=prefix(id);
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(start))covered.add(decodeURIComponent(key.slice(start.length)))}
 cachedState=readScope(id);signatures=new Map(Object.entries(cachedState.records).map(([k,r])=>[k,JSON.stringify(r)]));return cachedState
}
function compact(){if(baselineIds.length&&baselineIds.every(k=>covered.has(k))){localStorage.removeItem(STATE+scope());baselineIds=[]}}
function write(s){try{const id=scope(),start=prefix(id);
 for(const [k,r] of Object.entries(s.records)){const raw=JSON.stringify(r);if(signatures.get(k)!==raw||!baselineIds.includes(k)&&!covered.has(k)){localStorage.setItem(start+encodeURIComponent(k),raw);signatures.set(k,raw);covered.add(k)}}
 const meta=JSON.stringify({format:2,cursor:s.cursor||0});if(localStorage.getItem(META+id)!==meta)localStorage.setItem(META+id,meta);
 // An immutable legacy base is overlaid record by record; never duplicate it just to migrate.
 compact();cachedKey=id;cachedState=s
 }catch(e){cachedState=null;throw e}}
const eligible=k=>k.startsWith('reading:')||k.startsWith('personal:homework:');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function emit(){dispatchEvent(new Event('bv-personal-status'))}
const store={get(k,d){if(!eligible(k))return legacy.get(k,d);const r=load().records[k];return r?(r.value==null?d:structuredClone(r.value)):session?d:legacy.get(k,d)},
 set(k,v){if(!eligible(k))return legacy.set(k,v);try{const s=load();if(read(META+scope(),null)?.format!==2)write(s);
 const old=s.records[k],record={value:structuredClone(v),rev:old?.rev||0,dirty:true},raw=JSON.stringify(record);
 localStorage.setItem(prefix(scope())+encodeURIComponent(k),raw);s.records[k]=record;signatures.set(k,raw);covered.add(k);compact();schedule()
 }catch(e){cachedState=null;BV.toast('Не удалось сохранить данные: проверь свободное место.',5000);throw e}},del(k){this.set(k,null)}};
async function rpc(code,action,items=[]){const abort=new AbortController(),t=setTimeout(()=>abort.abort(),20000);try{const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json',apikey:API,Authorization:'Bearer '+API},body:JSON.stringify({p_code:code,p_action:action,p_items:items}),signal:abort.signal});const d=await r.json();if(!r.ok||d.error)throw Error(d.error||'Облако временно недоступно');return d}finally{clearTimeout(t)}}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
function conflict(s,key,local,remote){if(same(local,remote))return;const c={id:crypto.randomUUID(),key,local,remote,t:Date.now()};s.records['reading:conflict:'+c.id]={value:c,rev:0,dirty:true}}
async function sync(){if(!session||busy)return;busy=true;const owner=session.owner,code=session.code;message='Синхронизация…';emit();let changed=false;
 try{for(let batch=0;batch<100;batch++){
  if(!session||session.owner!==owner)return;const s=load(),pending=Object.entries(s.records).filter(([,r])=>r.dirty).slice(0,100).map(([id,r])=>({id,data:structuredClone(r.value),rev:r.rev}));if(!pending.length)break;
  const reply=await rpc(code,'push',pending);if(!session||session.owner!==owner)return;const now=load();
  for(const r of reply.items){const sent=pending.find(p=>p.id===r.id),current=now.records[r.id];if(!current)continue;
   if(r.ok||same(r.data,sent.data)){current.rev=r.rev;if(same(current.value,sent.data))current.dirty=false}
   else{conflict(now,r.id,sent.data,r.data);if(same(current.value,sent.data)){now.records[r.id]={value:r.data,rev:r.rev,dirty:false};changed=true}else current.rev=r.rev}
  }write(now);
 }
 const reply=await rpc(code,'pull',[{cursor:load().cursor||0}]);if(!session||session.owner!==owner)return;const s=load();for(const r of reply.items){const current=s.records[r.id];if(current&&current.dirty){if(current.rev!==r.rev){conflict(s,r.id,current.value,r.data);s.records[r.id]={value:r.data,rev:r.rev,dirty:false};changed=true}}else{if(!current||!same(current.value,r.data))changed=true;s.records[r.id]={value:r.data,rev:r.rev,dirty:false}}}s.cursor=reply.cursor||0;write(s);const conflicts=Object.entries(s.records).filter(([k,r])=>k.startsWith('reading:conflict:')&&r.value!=null).length;message=conflicts?'Есть разные версии · '+conflicts:'Синхронизировано';
 }catch(e){message='Нет связи · изменения сохранены на устройстве'}finally{busy=false;emit();if(changed)dispatchEvent(new Event('bv-personal-data'))}
}
async function connect(code,create,importGuest){if(busy)throw Error('Дождись завершения синхронизации');code=code.trim();if(code.length<12||code.length>128)throw Error('Код должен содержать 12–128 символов');const result=await rpc(code,create?'create':'login');const previous=session,course={};if(importGuest&&!previous){for(const L of BV_COURSE.lectures)course['seen:'+L.id]=BV.lectureStore.get('seen:'+L.id,[]);course.last=BV.lectureStore.get('last',null)}session={code,owner:result.owner};
 try{const s=load();if(importGuest&&!previous){const guest=readScope('guest');for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('bv2:reading:')){const id=k.slice(4);if(!guest.records[id])guest.records[id]={value:legacy.get(id,null),rev:0,dirty:true}}}for(const [k,v] of Object.entries(course)){if(v==null||Array.isArray(v)&&!v.length)continue;const id='reading:course:'+k;if(!guest.records[id])guest.records[id]={value:v,rev:0,dirty:true}}for(const [k,r] of Object.entries(guest.records))if(!s.records[k])s.records[k]={value:r.value,rev:0,dirty:true};write(s)}localStorage.setItem(KEY,JSON.stringify(session))}catch(e){session=previous;throw e}await sync();dispatchEvent(new Event('bv-personal-data'))}
function logout(){if(busy)throw Error('Дождись завершения синхронизации');session=null;localStorage.removeItem(KEY);message='На устройстве';emit();dispatchEvent(new Event('bv-personal-data'))}
BV.personal={store,sync,connect,logout,get owner(){return session?.owner||null},async sendActivity(device,items,owner){
 if(owner!==null&&owner!==(session?.owner||null))throw Error('Профиль изменился');
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
 try{const r=await fetch('https://zonrkvsibojyalhnqutd.supabase.co/rest/v1/rpc/bv_activity_push',{method:'POST',headers:{'Content-Type':'application/json',apikey:API,Authorization:'Bearer '+API},body:JSON.stringify({p_code:owner===null?'':session?.code||'',p_device:device,p_items:items}),signal:abort.signal});
 if(!r.ok)throw Error('Статистика временно недоступна');return await r.json()}finally{clearTimeout(timeout)}
},copyCode(){return session?BV.copy(session.code):Promise.resolve(false)},keys(prefix){const records=load().records;return Object.keys(records).filter(k=>k.startsWith(prefix)&&records[k].value!=null)},get connected(){return !!session},get message(){return message},get pending(){return Object.values(load().records).filter(r=>r.dirty).length},get conflicts(){return Object.entries(load().records).filter(([k,r])=>k.startsWith('reading:conflict:')&&r.value!=null).map(([,r])=>structuredClone(r.value))},resolve(id,useLocal){const s=load(),entry=s.records['reading:conflict:'+id],c=entry&&entry.value;if(!c)return;if(useLocal){const r=s.records[c.key];s.records[c.key]={value:c.local,rev:r&&r.rev||0,dirty:true}}s.records['reading:conflict:'+id]={value:null,rev:entry.rev,dirty:true};write(s);schedule();emit();dispatchEvent(new Event('bv-personal-data'))}};
addEventListener('online',sync);addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});addEventListener('storage',e=>{if(e.key===KEY){session=read(KEY,null);dispatchEvent(new Event('bv-personal-data'))}if(!e.key||e.key===STATE+scope()||e.key===META+scope()||e.key.startsWith(prefix(scope()))){cachedState=null;emit();dispatchEvent(new Event('bv-personal-data'))}});setInterval(()=>{if(!document.hidden)sync()},20000);if(session)sync();
})();
