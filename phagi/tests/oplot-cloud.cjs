// Two independent browser stores share only the mock Phagi server and its CAS/receipt contracts.
const assert = require('node:assert/strict');
const {fixtures,studyBackend,profiles}=require('./oplot-game.cjs');
const {chromium,webkit}=(()=>{try{return require('playwright');}catch{return require('playwright-core');}})();
const url=new URL(process.argv[2]||'http://127.0.0.1:18748/phagi/');url.searchParams.set('oplot','1');
const island=p=>'data/users/'+p.id+'/oplot/saves/main';
async function until(test,message){for(let i=0;i<140;i++){if(await test())return;await new Promise(r=>setTimeout(r,70));}assert.fail(message);}
async function run(browser){
 const server=fixtures(),errors=[],contexts=[];
 async function device(profile,legacy){
  const ctx=await browser.newContext({viewport:{width:980,height:770},serviceWorkers:'block'});contexts.push(ctx);await studyBackend(ctx,server);
  await ctx.addInitScript(({p,legacy})=>{if(window===window.top){localStorage.setItem('ph_code',p.code);if(legacy&&!localStorage.getItem('phagi.oplot.v1.user.'+p.id))localStorage.setItem('phagi.oplot.v1.user.'+p.id,JSON.stringify(legacy));}},{p:profile,legacy});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const f=page.frameLocator('#oplot-game'),status=f.locator('#island-cloud-status');
  const open=()=>page.goto(url.href,{waitUntil:'domcontentloaded'});
  const ready=()=>status.filter({hasText:'Остров в облаке'}).waitFor();
  async function feed(id){await f.locator(`[data-do="pet"][data-id="${id}"]`).first().click();await f.locator('[data-do="feed"]').click();await f.locator('#dialog [data-do="close"]').click();}
  async function sync(){await status.click();await f.getByRole('button',{name:'Проверить связь'}).click();}
  return {ctx,page,f,status,open,ready,feed,sync};
 }
 try{
  const primary=profiles[0],path=island(primary),head=()=>server.docs.get(path),a=await device(primary);
  // No fresh game may save or accept input before the authoritative first read returns.
  let release,entered=false;const gate=new Promise(r=>{release=r;});
  await a.ctx.route('**/rpc/ph_oplot_load',async r=>{if(r.request().postDataJSON().p_path===path){entered=true;await gate;}return r.fallback();});
  await a.open();await until(()=>entered,'first cloud read');
  assert.equal(head(),undefined);await a.f.locator('[data-do="pet"]').first().click();
  assert.equal(await a.f.locator('#dialog').evaluate(e=>e.open),false);assert.equal(head(),undefined);
  release();await a.ready();await a.ctx.unroute('**/rpc/ph_oplot_load');
  const initial=structuredClone(head().state);
  await a.feed('d0');await until(()=>head().state.dragons[0].level===2,'first device feeds dragon');
  server.partialLoads=[{...head(),_raidPending:true}];
  const b=await device(primary);await b.open();await b.ready();assert.equal(server.partialLoads.length,0);
  assert.match(await b.f.locator('[data-do="pet"][data-id="d0"]').first().innerText(),/ур\. 2/);
  server.loseSaveReply=true;await a.feed('d0');await until(()=>head().state.dragons[0].level===3,'lost CAS reply still committed');
  const rev=head().rev;await a.sync();await a.ready();assert.equal(head().rev,rev,'a lost CAS acknowledgement must not repeat a move');
  await b.sync();await b.ready();
  let offline=true;await a.ctx.route('**/rest/v1/rpc/*',r=>offline&&r.request().postDataJSON()?.p_path===path?r.abort():r.fallback());
  await a.feed('d0');await a.status.filter({hasText:'нет связи'}).waitFor();
  await b.feed('d1');await until(()=>head().state.dragons[1].level===2,'second device advances independently');
  offline=false;await a.sync();const dialog=a.f.locator('#island-cloud-dialog');
  await dialog.getByRole('button',{name:'Открыть облачный остров'}).click();await a.ready();
  assert.equal(head().state.dragons[0].level,3);assert.equal(head().state.dragons[1].level,2);
  await a.status.click();assert.equal(await dialog.locator('a[download]').count(),1);await dialog.getByRole('button',{name:'Закрыть'}).click();
  // A server receipt exists even though its first acknowledgement was lost on device A.
  const before=head().state.berries;await a.f.locator('.wallets [data-do="wallet"]').click();await a.f.locator('[data-do="purchase"][data-id="berries"]').click();
  await until(()=>server.accounts.get(primary.id).receipts.size===1,'purchase debit');assert.ok(head().state.pending);
  await b.sync();await until(()=>head().state.pending===null,'another device delivers the purchase');assert.equal(head().state.berries,before+75);
  await a.open();await a.ready();assert.equal(await a.f.locator('#berries').textContent(),String(before+75));
  assert.equal(new Set(server.accounts.get(primary.id).attempts).size,1);
  // An old browser must not silently replace a newer profile. The abandoned copy stays downloadable.
  const old={...initial,berries:444},legacy=await device(primary,old);await legacy.open();
  await legacy.f.getByRole('button',{name:'Открыть облачный остров'}).click();await legacy.ready();assert.equal(head().state.berries,before+75);
  // An overnight server revision must retain the confiscated resources when an offline island comes back.
  let isolate=true;await legacy.ctx.route('**/rest/v1/rpc/*',r=>isolate&&r.request().postDataJSON()?.p_path===path?r.abort():r.fallback());
  await legacy.feed('d1');await legacy.status.filter({hasText:'нет связи'}).waitFor();
  const invaded=structuredClone(head());invaded.rev++;invaded.op='night:test-fixture';invaded.state.gold-=15;invaded.state.berries-=5;invaded.state.lastRaid={day:'2026-11-20'};
  // The night-aware RPC runs the scheduled raid between this browser's read and its CAS.
  server.beforeIslandStore=target=>{assert.equal(target,path);server.docs.set(path,invaded);};
  isolate=false;await legacy.sync();
  const raidConflict=legacy.f.locator('#island-cloud-dialog');await raidConflict.getByText(/уже учтён ночной набег/).waitFor();
  assert.equal(await raidConflict.getByRole('button',{name:'Продолжить на этом острове'}).count(),0);
  await raidConflict.getByRole('button',{name:'Открыть облачный остров'}).click();await legacy.ready();assert.equal(head().state.berries,before+70);
  const legacyIsland=structuredClone(initial);delete legacyIsland.xp;legacyIsland.berries=322;
  const secondary=profiles[1],otherPath=island(secondary),other=await device(secondary,legacyIsland);
  await other.open();await other.ready();assert.equal(server.docs.get(otherPath).state.berries,322,'first import of a pre-XP island');
  // A second browser has no local storage and must read buildings on the expanded edge.
  const wide=structuredClone(server.docs.get(otherPath));wide.rev++;wide.op='synthetic-expansion';wide.state.xp=35*11**2;
  const wall=(id,x,y)=>({id,type:'wall',level:1,since:2,x,y});
  wide.state.buildings=[wide.state.buildings.find(b=>b.type==='keep'),wall('edge',15,14),wall('far',15,0),wall('near',5,1)];
  server.docs.set(otherPath,wide);
  const visitor=await device(secondary);await visitor.open();await visitor.ready();await visitor.feed('d0');
  await until(()=>server.docs.get(otherPath).state.dragons[0].level===2,'cloud write from a new device with an expanded island');
  await other.sync();await other.ready();
  const secondFrame=await other.page.locator('#oplot-game').elementHandle().then(el=>el.contentFrame());
  assert.deepEqual(server.docs.get(otherPath).state.buildings,wide.state.buildings,'the new device saved all far-edge walls');
  const journal=()=>secondFrame.evaluate(id=>JSON.parse(localStorage.getItem('phagi.oplot.v1.user.'+id+'.sync2')),secondary.id);
  await until(async()=>(await journal()).base?.rev===server.docs.get(otherPath).rev,'other device acknowledged the expanded island revision');
  assert.deepEqual((await journal()).state.buildings,wide.state.buildings);
  assert.equal(head().state.berries,before+70,'the expanded island belongs only to its profile');
  const frame=await a.page.locator('#oplot-game').elementHandle().then(el=>el.contentFrame());
  const sameJSON=await frame.evaluate(()=>equalIslandData({rev:4,state:{berries:1,gold:2}},{state:{gold:2,berries:1},rev:4}));assert.equal(sameJSON,true);
  const valid=await frame.evaluate(x=>[validIslandState(x),validIslandState({...x,dragons:[{id:'invalid',species:-1,level:1}]}),validIslandState({...x,buildings:[{id:'x',type:'invalid'}]}),validIslandState({...x,book:['unknown']})],initial);
  assert.deepEqual(valid,[true,false,false,false]);
  const gridChecks=await frame.evaluate(base=>{
   const results=[];
   function tiles(width,height){return Array.from({length:width*height},(_,i)=>({id:'b'+i,type:i===0?'keep':'wall',x:i%width,y:Math.floor(i/width),level:1,since:2}));}
   for(let level=1;level<=14;level++){
    const width=Math.min(16,10+Math.floor(level/2)),height=Math.min(16,10+Math.floor((level-1)/2));
    const state={...base,xp:35*(level-1)**2,buildings:tiles(width,height)};
    const invalidCell=(x,y)=>({...state,buildings:[state.buildings[0],{...state.buildings[1],x,y}]});
    results.push(validIslandState(state)&&!validIslandState(invalidCell(width,0))&&!validIslandState(invalidCell(0,height))
      &&!validIslandState(invalidCell(0,0))&&!validIslandState({...state,buildings:[...state.buildings,{...state.buildings[1],id:'extra'}]}));
   }
   const old={...base,buildings:tiles(10,10)};delete old.xp;
   results.push(validIslandState(old)&&!validIslandState({...old,buildings:[old.buildings[0],{...old.buildings[1],x:10}]}));
   return results;
  },initial);
  assert.ok(gridChecks.every(Boolean),'each profile level admits precisely its unlocked rectangle, including all 256 maximum tiles');
  assert.deepEqual(errors,[]);
  console.log('PASS independent devices: first-load gate, migration, cross-device progression, offline conflicting edits and backup, rectangular island edges on a fresh device, lost CAS ack, single delivery after lost debit response, isolated profiles.');
 }finally{await Promise.all(contexts.map(c=>c.close()));}
}
(async()=>{const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});try{await run(browser);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
