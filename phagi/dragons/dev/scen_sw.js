/* PWA: service worker ставится, после загрузки страница открывается без сети, в кеше нет двух версий одного файла.
   SCEN=scen_sw.js W=390 H=844 node hx.js ../.. ./out */
module.exports=async(page,{OUT,ctx,need})=>{const w=t=>page.waitForTimeout(t),log=(...a)=>console.log('·',...a);
  const ok=await page.evaluate(async()=>{if(!navigator.serviceWorker)return 'нет API';const r=await Promise.race([navigator.serviceWorker.ready.then(()=>'ready'),new Promise(r=>setTimeout(()=>r('timeout'),8000))]);return r});
  log('service worker',ok);need(ok==='ready','service worker установлен');await page.reload();await w(2500);
  const keys=()=>page.evaluate(async()=>{const out=[];for(const n of await caches.keys()){const c=await caches.open(n);for(const q of await c.keys())out.push(n+' '+new URL(q.url).pathname+new URL(q.url).search)}return out});
  let k=await keys();const dup=p=>{const m={};p.forEach(x=>{const s=x.split(' ')[1],b=s.split('?')[0];if(/\?v=/.test(s))(m[b]=m[b]||new Set()).add(s)});return Object.entries(m).filter(([,v])=>v.size>1).map(([b])=>b)};
  log('в кеше',k.length,'файлов, дублей версий',JSON.stringify(dup(k)));
  /* старая версия того же файла в кеше: после загрузки новой она должна уйти */
  await page.evaluate(async()=>{const n=(await caches.keys())[0],c=await caches.open(n);const u=[...document.scripts].map(s=>s.src).find(s=>/dragons\/ui\.js\?v=/.test(s));await c.put(u.replace(/v=\d+/,'v=1'),new Response('// old'))});
  k=await keys();log('подложена старая ui.js?v=1, дублей',JSON.stringify(dup(k)));
  await page.reload();await w(2500);k=await keys();log('после перезагрузки дублей',JSON.stringify(dup(k)));need(!dup(k).length,'старая версия файла убрана из кеша');
  await ctx.setOffline(true);await page.reload().catch(e=>log('reload без сети',e.message.slice(0,80)));await w(2500);
  log('без сети: страница',await page.evaluate(()=>document.title),'вход виден',await page.evaluate(()=>document.body.innerText.length>200),'карточки',await page.evaluate(()=>!!document.querySelector('[data-act="go"][data-v="cards"]')));
  need(await page.evaluate(()=>!!document.querySelector('[data-act="go"][data-v="cards"]')),'без сети страница открывается из кеша');
  await page.screenshot({path:`${OUT}/sw-offline.png`});await ctx.setOffline(false)}
