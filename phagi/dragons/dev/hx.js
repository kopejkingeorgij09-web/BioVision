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
put('people/'+UID,{label:'Тестовая'});
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
  case 'ph_update':put(a.p_path,Object.assign({},(store.get(a.p_path)||{}).d,a.p_data));return T();
  case 'ph_delete':put(a.p_path,null);return T();
  case 'ph_sync':return {ch:[],now:T()};
  case 'ph_profiles':return {};
  default:return null}};
(async()=>{const b=await chromium.launch({headless:!process.env.SHOW});
  const W=Number(process.env.W||1280),H=Number(process.env.H||900);const ctx=await b.newContext({viewport:{width:W,height:H},colorScheme:process.env.DARK?'dark':'light',reducedMotion:process.env.REDUCE?'reduce':'no-preference',hasTouch:!!process.env.TOUCH,isMobile:!!process.env.TOUCH,deviceScaleFactor:Number(process.env.DPR||1)});
  await ctx.addInitScript(()=>{try{localStorage.setItem('ph_code','FAG-TEST-TEST')}catch(e){}});
  /* всё, что уходит не на localhost, обрывается: в production не уходит ни одного запроса, тем более записи */
  await ctx.route(u=>!/^http:\/\/localhost:/.test(String(u)),r=>{blocked.push(r.request().method()+' '+r.request().url().slice(0,80));r.abort()});
  await ctx.route('**/rest/v1/rpc/*',async route=>{const fn=route.request().url().split('/').pop();const a=JSON.parse(route.request().postData()||'{}');
    if(/^ph_(set|update|delete)$/.test(fn))writes.push(fn+' '+a.p_path);
    if(fn==='ph_get'&&fail.get){fail.get--;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"нет связи (стенд)"}'})}
    if(/^ph_(set|update)$/.test(fn)&&fail.set){fail.set--;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"нет связи (стенд)"}'})}
    const out=rpc(fn,a);
    if(/^ph_(set|update)$/.test(fn)&&fail.lost){fail.lost--;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"ответ потерялся (стенд)"}'})}
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(out)})});
    const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await page.goto(`http://localhost:${srv.address().port}/index.html`);await page.waitForTimeout(1500);
  /* SHOW=1: окно браузера для просмотра руками, без сценария; база та же подставная, закрыть окно — выход */
  if(process.env.SHOW){console.log('Открыто окно стенда. Записи идут только в память стенда. Закройте окно, чтобы выйти.');await page.waitForEvent('close',{timeout:0});console.log('записей:',writes.length);await b.close();srv.close();return}
  const sc=require(path.resolve(process.env.SCEN||'./scen.js'));try{await sc(page,{OUT,store,UID,ctx,fail,writes,blocked})}catch(e){console.log('SCENARIO FAIL',e.stack)}
  console.log('errors:',JSON.stringify(errs));console.log('blocked external:',blocked.length,JSON.stringify(blocked.slice(0,5)));
  await b.close();srv.close()})();
