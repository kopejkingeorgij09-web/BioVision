/* Стенд для проверки phagi/ без сети: статический сервер на localhost, Supabase RPC подменены памятью, всё, что уходит не на localhost, обрывается.
   Запуск из phagi/dragons/dev: SCEN=scen_save.js DRAG="$(cat isle-many.json)" W=390 H=844 TOUCH=1 node hx.js ../.. ./out
   Посмотреть руками: SHOW=1 DRAG="$(cat isle-many.json)" W=390 H=844 TOUCH=1 node hx.js ../.. (откроется окно браузера).
   Нужен playwright с chromium (require('playwright')). Код входа FAG-TEST-TEST выдуманный, настоящих кодов и ключей здесь нет. */
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=process.argv[2],OUT=process.argv[3]||'.';
const UID='u_test1';
const day=o=>{const d=new Date();d.setDate(d.getDate()+o);return d.toISOString().slice(0,10)};
const store=new Map();const fail={set:0,get:0,lost:0};const writes=[];const blocked=[];const T=()=>new Date().toISOString();
const put=(p,d)=>store.set(p,{d,t:T()});
put('people/'+UID,{label:process.env.TEST_LABEL||'Тестовая'});
put('decks/dk1',{title:'Белки',subject:'bio',to:[UID],createdAt:T(),cards:Array.from({length:30},(_,i)=>({i:'c'+i,f:'Вопрос '+i,b:'Ответ '+i}))});
put(`srs/${UID}/meta/streak`,{days:{[day(-2)]:22,[day(-1)]:40,[day(0)]:7},ack:null,muts:[]});
if(process.env.DRAG)put(`srs/${UID}/meta/dragons`,JSON.parse(process.env.DRAG));
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);
  fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream'});r.end(b)})}).listen(0);
const rpc=(fn,a)=>{switch(fn){
  case 'ph_login':return {id:UID,isOwner:false,name:'Тестовая'};
  case 'ph_list':return [...store].filter(([p])=>p.slice(0,p.lastIndexOf('/'))===a.p_col&&store.get(p).d).map(([p,v])=>({id:p.slice(p.lastIndexOf('/')+1),data:v.d,t:v.t}));
  case 'ph_get':return (store.get(a.p_path)||{}).d||null;
  case 'ph_set':put(a.p_path,a.p_data);return T();
  /* как ph_set_if в базе: пишет, только если там версия с теми же rev и op; документ без rev считается rev 0 */
  case 'ph_set_if':{const c=(store.get(a.p_path)||{}).d||null;if(!a.p_data||a.p_data.rev!==(a.p_rev==null?0:a.p_rev)+1)throw {status:400,message:'bad rev'};
    const cr=c?(typeof c.rev==='number'?c.rev:0):null;if((c===null)!==(a.p_rev==null)||(c&&(cr!==a.p_rev||(c.op==null?null:c.op)!==(a.p_op==null?null:a.p_op))))return {ok:false,cur:c};
    put(a.p_path,a.p_data);return {ok:true,t:T()}}
  case 'ph_update':put(a.p_path,Object.assign({},(store.get(a.p_path)||{}).d,a.p_data));return T();
  case 'ph_delete':put(a.p_path,null);return T();
  case 'ph_sync':return {ch:[],now:T()};
  case 'ph_profiles':return {};
  default:return null}};
(async()=>{const b=await chromium.launch({headless:!process.env.SHOW});
  const W=Number(process.env.W||1280),H=Number(process.env.H||900);const ctx=await b.newContext({viewport:{width:W,height:H},colorScheme:process.env.DARK?'dark':'light',reducedMotion:process.env.REDUCE?'reduce':'no-preference',hasTouch:!!process.env.TOUCH,isMobile:!!process.env.TOUCH,deviceScaleFactor:Number(process.env.DPR||1)});
  await ctx.addInitScript(()=>{try{localStorage.setItem('ph_code','FAG-TEST-TEST')}catch(e){}});
  /* BIG=1: крупный текст, как при увеличенном шрифте в системе (корневой размер 150 %) */
  if(process.env.BIG)await ctx.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='html{font-size:150%!important}body{font-size:150%}';document.head.appendChild(st)})});
  /* всё, что уходит не на localhost, обрывается: в production не уходит ни одного запроса, тем более записи */
  await ctx.route(u=>!/^http:\/\/localhost:/.test(String(u)),r=>{blocked.push(r.request().method()+' '+r.request().url().slice(0,80));r.abort()});
  await ctx.route('**/rest/v1/rpc/*',async route=>{const fn=route.request().url().split('/').pop();const a=JSON.parse(route.request().postData()||'{}');
    if(/^ph_(set|set_if|update|delete)$/.test(fn))writes.push(fn+' '+a.p_path);
    if(fn==='ph_get'&&fail.get){fail.get--;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"нет связи (стенд)"}'})}
    if(/^ph_(set|set_if|update)$/.test(fn)&&fail.set){fail.set--;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"нет связи (стенд)"}'})}
    let out;try{out=rpc(fn,a)}catch(e){if(e&&e.status)return route.fulfill({status:e.status,contentType:'application/json',body:JSON.stringify({message:e.message})});throw e}
    if(/^ph_(set|set_if|update)$/.test(fn)&&fail.lost){fail.lost--;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"ответ потерялся (стенд)"}'})}
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)})});
    const page=await ctx.newPage();
  /* ошибки делятся на ожидаемые (оборванные внешние запросы и 503, которые сценарий сам включил через fail) и все остальные:
     pageerror, 404 своих файлов, любые другие console.error. Остальные валят прогон так же, как проваленная проверка */
  const errs=[],expected=[],miss=[];
  page.on('pageerror',e=>errs.push('pageerror: '+e.message));
  page.on('response',r=>{if(/^http:\/\/localhost:/.test(r.url())&&r.status()===404)miss.push(r.url().replace(/^http:\/\/localhost:\d+/,''))});
  page.on('console',m=>{if(m.type()!=='error')return;const t=m.text();
    if(/net::ERR_FAILED|ERR_BLOCKED|status of 503/.test(t))expected.push(t.slice(0,90));else if(/status of 404/.test(t))return;else errs.push(t)});
  await page.goto(`http://localhost:${srv.address().port}/index.html`);await page.waitForTimeout(1500);
  /* SHOW=1: окно браузера для просмотра руками, без сценария; база та же подставная, закрыть окно — выход */
  if(process.env.SHOW){console.log('Открыто окно стенда. Записи идут только в память стенда. Закройте окно, чтобы выйти.');await page.waitForEvent('close',{timeout:0});console.log('записей:',writes.length);await b.close();srv.close();return}
  /* need(условие, что проверяли): проверка сценария. Провал печатается и делает код выхода ненулевым, сценарий идёт дальше */
  const bad=[];const need=(ok,what)=>{console.log(ok?'  ✓':'  ✗',what);if(!ok)bad.push(what);return !!ok};
  const sc=require(path.resolve(process.env.SCEN||'./scen.js'));let crash=null;
  try{await sc(page,{OUT,store,UID,ctx,fail,writes,blocked,need})}catch(e){crash=e;console.log('SCENARIO FAIL',e.stack)}
  console.log('errors:',JSON.stringify(errs));if(miss.length)console.log('404:',JSON.stringify(miss));
  console.log('expected (сеть стенда):',expected.length);console.log('blocked external:',blocked.length,JSON.stringify(blocked.slice(0,5)));
  const res=crash?'FAIL (сценарий упал)':bad.length?'FAIL ('+bad.length+' проверок: '+bad.join('; ')+')':errs.length||miss.length?'FAIL (ошибки страницы)':'PASS';
  console.log('RESULT',res);
  await b.close();srv.close();process.exitCode=res==='PASS'?0:1})().catch(e=>{console.log('HARNESS FAIL',e.stack);process.exitCode=2});
