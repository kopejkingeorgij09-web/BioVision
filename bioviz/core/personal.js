/* Personal reading profile. Per-record revisions, durable outbox and conflict copies. */
(function(){
'use strict';
const legacy=BV.store,KEY='bv-personal-session',STATE='bv-personal-state:',URL='https://zonrkvsibojyalhnqutd.supabase.co/rest/v1/rpc/bv_personal_sync',API='sb_publishable_WyJ9PYWg8s4kizqn9E0OJQ_iuDgGdbs';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}};
let session=read(KEY,null),busy=false,timer,message='На устройстве';
const empty=()=>({records:{},conflicts:[]});
const scope=()=>session?session.owner:'guest';
let cachedKey='',cachedRaw=null,cachedState=null;
function load(){const key=STATE+scope();let raw=null;try{raw=localStorage.getItem(key)}catch(e){}if(key===cachedKey&&raw===cachedRaw&&cachedState)return cachedState;cachedKey=key;cachedRaw=raw;cachedState=read(key,empty());return cachedState}
function write(s){try{localStorage.setItem(STATE+scope(),JSON.stringify(s))}catch(e){cachedState=null;throw e}}
const eligible=k=>k.startsWith('reading:')||k.startsWith('personal:homework:');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function emit(){dispatchEvent(new Event('bv-personal-status'))}
const store={get(k,d){if(!eligible(k))return legacy.get(k,d);const r=load().records[k];return r?(r.value==null?d:structuredClone(r.value)):session?d:legacy.get(k,d)},set(k,v){if(!eligible(k))return legacy.set(k,v);try{const s=load(),r=s.records[k];s.records[k]={value:structuredClone(v),rev:r&&r.rev||0,dirty:true};write(s);schedule()}catch(e){BV.toast('Не удалось сохранить данные: проверь свободное место.',5000);throw e}},del(k){this.set(k,null)}};
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
async function connect(code,create,importGuest){if(busy)throw Error('Дождись завершения синхронизации');code=code.trim();if(code.length<12||code.length>128)throw Error('Код должен содержать 12–128 символов');const result=await rpc(code,create?'create':'login');const previous=session;session={code,owner:result.owner};
 try{const s=load();if(importGuest&&!previous){const guest=read(STATE+'guest',empty());for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('bv2:reading:')){const id=k.slice(4);if(!guest.records[id])guest.records[id]={value:legacy.get(id,null),rev:0,dirty:true}}}for(const [k,r] of Object.entries(guest.records))if(!s.records[k])s.records[k]={value:r.value,rev:0,dirty:true};write(s)}localStorage.setItem(KEY,JSON.stringify(session))}catch(e){session=previous;throw e}await sync();dispatchEvent(new Event('bv-personal-data'))}
function logout(){if(busy)throw Error('Дождись завершения синхронизации');session=null;localStorage.removeItem(KEY);message='На устройстве';emit();dispatchEvent(new Event('bv-personal-data'))}
BV.personal={store,sync,connect,logout,copyCode(){return session?BV.copy(session.code):Promise.resolve(false)},keys(prefix){const records=load().records;return Object.keys(records).filter(k=>k.startsWith(prefix)&&records[k].value!=null)},get connected(){return !!session},get message(){return message},get pending(){return Object.values(load().records).filter(r=>r.dirty).length},get conflicts(){return Object.entries(load().records).filter(([k,r])=>k.startsWith('reading:conflict:')&&r.value!=null).map(([,r])=>structuredClone(r.value))},resolve(id,useLocal){const s=load(),entry=s.records['reading:conflict:'+id],c=entry&&entry.value;if(!c)return;if(useLocal){const r=s.records[c.key];s.records[c.key]={value:c.local,rev:r&&r.rev||0,dirty:true}}s.records['reading:conflict:'+id]={value:null,rev:entry.rev,dirty:true};write(s);schedule();emit();dispatchEvent(new Event('bv-personal-data'))}};
addEventListener('online',sync);addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});addEventListener('storage',e=>{if(e.key===KEY){session=read(KEY,null);dispatchEvent(new Event('bv-personal-data'))}if(e.key===STATE+scope())emit()});setInterval(()=>{if(!document.hidden)sync()},20000);if(session)sync();
})();
