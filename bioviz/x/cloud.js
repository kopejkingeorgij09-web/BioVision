/* Облако БиоВиза на Supabase.
   Раньше сайт жил артефактом claude.ai и брал базу, пользователя и скачивание из window.claude.
   Этот файл даёт тот же интерфейс (claude.use('db'|'user'|'downloads')), но хранит данные в Supabase,
   а вход идёт по коду: ученику код выдаёт учитель в журнале, у учителя свой секретный код.
   Все проверки прав делаются на сервере (функции bv_* в Supabase), здесь только вызовы.

   ИИ-функции (sample, assets) вне claude.ai недоступны: модули сами показывают запасной вариант. */
(function(){
const URL='https://zonrkvsibojyalhnqutd.supabase.co';
const KEY='sb_publishable_WyJ9PYWg8s4kizqn9E0OJQ_iuDgGdbs';
const LS='bv_code';
const getCode=()=>{try{return localStorage.getItem(LS)||''}catch(e){return ''}};
const setCode=c=>{try{c?localStorage.setItem(LS,c):localStorage.removeItem(LS)}catch(e){}};

async function rpc(fn,args){
  const r=await fetch(URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+KEY},body:JSON.stringify(args||{})});
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
  if(!r.ok){const e=new Error((j&&j.message)||('HTTP '+r.status));e.code=r.status===403||(j&&j.code==='42501')?'denied':'network';throw e}
  return j}

/* --- кто вошёл --- */
let me=null;               // {role:'student'|'admin', id, name}
const ready=(async()=>{const c=getCode();if(!c)return null;
  try{me=await rpc('bv_login',{p_code:c});if(!me)setCode('')}catch(e){me=null}
  return me})();

const AUTH=window.BVAUTH={
  ready,
  get me(){return me},
  async login(code){
    const c=String(code||'').trim().toUpperCase();if(!c)throw new Error('Введите код.');
    let r;try{r=await rpc('bv_login',{p_code:c})}catch(e){throw new Error('Нет связи с облаком. Проверьте интернет и попробуйте ещё раз.')}
    if(!r)throw new Error('Такого кода нет. Проверьте, что он введён без ошибок (буквы латинские).');
    setCode(c);me=r;return r},
  logout(){setCode('');me=null},
  /* только для учителя */
  codes:()=>rpc('bv_codes',{p_code:getCode()}),
  newCode:name=>rpc('bv_code_new',{p_code:getCode(),p_name:String(name||'')}),
  delCode:id=>rpc('bv_code_delete',{p_code:getCode(),p_id:id})};

/* --- база: тот же вид, что у claude.use('db') --- */
/* после записи даём знать подписчикам на этой странице, чтобы журнал обновился сразу */
const written=()=>dispatchEvent(new Event('bv-cloud-write'));
const split=p=>{const i=String(p).indexOf('/');return [p.slice(0,i),p.slice(i+1)]};
const snapDocs=list=>({docs:(list||[]).map(x=>({id:x.id,exists:true,data:()=>x.data}))});
const db={
  doc(path){const [col,id]=split(path);return{
    async get(){const d=await rpc('bv_get',{p_code:getCode(),p_col:col,p_id:id});return{id,exists:d!=null,data:()=>d}},
    async set(data){await rpc('bv_set',{p_code:getCode(),p_col:col,p_id:id,p_data:data});written()},
    async delete(){await rpc('bv_delete',{p_code:getCode(),p_col:col,p_id:id});written()}}},
  collection(col){return{
    /* живого канала нет: опрашиваем раз в 20 секунд и сразу после изменений на этой странице */
    onSnapshot(cb,err){let stop=false,last='';
      const tick=async()=>{if(stop)return;try{const l=await rpc('bv_list',{p_code:getCode(),p_col:col});const sig=JSON.stringify(l);if(sig!==last){last=sig;cb(snapDocs(l))}}catch(e){err&&err(e)}};
      tick();const t=setInterval(()=>{if(!document.hidden)tick()},20000);
      const poke=()=>setTimeout(tick,400);addEventListener('bv-cloud-write',poke);
      return()=>{stop=true;clearInterval(t);removeEventListener('bv-cloud-write',poke)}}}}};

const user={
  async id(){await ready;return me?me.id:null},
  async can(){await ready;return !!me},
  async canEdit(){await ready;return !!me&&me.role==='admin'},
  async name(){await ready;return me?me.name:''}};

const downloads={async save({filename,data,type}){
  const b=data instanceof Blob?data:new Blob([data],{type:type||(/\.csv$/i.test(filename)?'text/csv;charset=utf-8':'application/json')});
  const a=document.createElement('a');a.href=URL_.createObjectURL(b);a.download=filename||'file';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL_.revokeObjectURL(a.href);a.remove()},1500)}};
const URL_=window.URL;

window.claude={use:async name=>{
  if(name==='db')return db;
  if(name==='user'){await ready;return user}
  if(name==='downloads')return downloads;
  return null}};
})();
