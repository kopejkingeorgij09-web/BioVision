/* Exercise the actual worker: cached response remains readable while an update is fetched. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('sw.js','utf8');
async function check({cached,next,offline=false}){
 let resolveFetch,rejectFetch,saved=cached,messages=[],result,background=[];const listeners={};
 const pending=new Promise((ok,no)=>{resolveFetch=ok;rejectFetch=no});
 const context={URL,Request,Response,Promise,setTimeout,clearTimeout,
  location:{origin:'https://example.test'},
  self:{registration:{scope:'https://example.test/BioVision/'},addEventListener:(n,f)=>listeners[n]=f,clients:{matchAll:async()=>[{postMessage:m=>messages.push(m)}]}},
  fetch:()=>pending,
  caches:{match:async()=>saved?new Response(saved):undefined,open:async()=>({put:async(k,res)=>{saved=await res.text()}})}
 };
 vm.runInNewContext(source,context);
 listeners.fetch({request:{url:'https://example.test/BioVision/',method:'GET',mode:'navigate',headers:new Headers()},respondWith:p=>result=p,waitUntil:p=>background.push(p)});
 if(cached){const response=await Promise.race([result,new Promise((_,no)=>setTimeout(()=>no(Error('Cached shell waited for network')),100))]);assert.equal(await response.text(),cached)}
 if(offline)rejectFetch(Error('offline'));else resolveFetch(new Response(next));
 if(!cached&&!offline)assert.equal(await (await result).text(),next);
 await Promise.all(background);
 return{saved,messages}
}
(async()=>{
 const old="const BV_VER='old';",fresh="const BV_VER='new';";
 let r=await check({cached:old,next:fresh});assert.equal(r.saved,fresh);assert.equal(r.messages[0].type,'bv-update');
 r=await check({cached:fresh,next:fresh});assert.equal(r.messages.length,0);
 r=await check({cached:old,offline:true});assert.equal(r.saved,old);
 r=await check({next:fresh});assert.equal(r.saved,fresh);assert.equal(r.messages.length,0);
 console.log('PASS shell cache: immediate readable cache, background update/notification, unchanged version, offline and first visit');
})().catch(e=>{console.error(e);process.exitCode=1});
