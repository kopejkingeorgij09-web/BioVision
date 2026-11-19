// Run against a local or deployed Phagi page. All Supabase RPCs are intercepted in a fresh browser context.
const assert = require('node:assert/strict');
const {chromium, webkit} = (() => {
  try { return require('playwright'); } catch { return require('playwright-core'); }
})();
const site = new URL(process.argv[2] || 'http://127.0.0.1:18748/phagi/');
const profiles = [
  {id:'oplot-fixture-a', code:'TEST-ISLAND-ONE', label:'Профиль А'},
  {id:'oplot-fixture-b', code:'TEST-ISLAND-TWO', label:'Профиль Б'},
];
const deckId = 'fixture-deck';
const homeworkId = 'fixture-homework';
const cardId = 'test-card';
const day = '2026-11-19T08:00:00.000Z';

function fixtures() {
  const docs=new Map(profiles.map(p=>['people/'+p.id,{label:p.label,joinedAt:day}]));
  docs.set('decks/'+deckId,{title:'Тестовая колода',subject:'bio',to:[profiles[0].id],cards:[{i:cardId,f:'Вопрос',b:'Ответ'}],createdAt:day});
  docs.set('tasks/'+homeworkId,{title:'Тестовая домашняя работа',subject:'bio',kind:'task',max:10,to:[profiles[0].id],createdAt:day});
  docs.set('subs/'+profiles[0].id+'/items/'+homeworkId,{status:'submitted',text:'Готово',updatedAt:day});
  docs.set('grades/'+profiles[0].id+'/items/'+homeworkId,{score:6,returnedAt:day});
  const accounts=new Map(profiles.map((p,i)=>[p.id,{cards:new Set(),homework:i===0?8:0,receipts:new Map(),attempts:[]}]));
  return {docs,accounts,loseBuyReply:true};
}
async function studyBackend(context,server=fixtures()) {
  const {docs,accounts}=server;
  // No third-party stylesheet should delay a synthetic pupil's offline test.
  await context.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  function wallet(acct) {
    const spent=[...acct.receipts.values()].reduce((sum,r)=>sum+r.price,0);
    return {cards:acct.cards.size,homework:acct.homework,spent,balance:acct.cards.size+acct.homework-spent};
  }
  await context.route('**/rest/v1/rpc/*',async route=>{
    const fn=new URL(route.request().url()).pathname.split('/').pop();
    const args=route.request().postDataJSON();
    const profile=profiles.find(p=>p.code===args.p_code);
    const acct=accounts.get(profile?.id);
    let result=null;
    if(fn==='ph_login')result=profile?{id:profile.id,name:profile.label,isOwner:false}:null;
    else if(!profile)return route.fulfill({status:403,json:{code:'42501'}});
    else if(fn==='ph_list')result=[...docs].filter(([path])=>path.slice(0,path.lastIndexOf('/'))===args.p_col)
      .map(([path,data])=>({id:path.split('/').pop(),data,t:day}));
    else if(fn==='ph_sync')result={ch:[],now:new Date().toISOString()};
    else if(args.p_path?.startsWith('data/users/')&&args.p_path.split('/')[2]!==profile.id){
      if(fn==='ph_get')result=null;else return route.fulfill({status:403,json:{code:'42501'}});
    }else if(fn==='ph_oplot_load'){
      if(args.p_path!==`data/users/${profile.id}/oplot/saves/main`)return route.fulfill({status:403,json:{code:'42501'}});
      result=server.partialLoads?.length?server.partialLoads.shift():docs.get(args.p_path)||null;
    }else if(fn==='ph_get')result=docs.get(args.p_path)||null;
    else if(fn==='ph_set_if'||fn==='ph_oplot_store'){
      const isIsland=args.p_path===`data/users/${profile.id}/oplot/saves/main`;
      if((fn==='ph_oplot_store')!==isIsland)return route.fulfill({status:400,json:{code:'22023'}});
      if(isIsland&&server.beforeIslandStore){const hook=server.beforeIslandStore;server.beforeIslandStore=null;hook(args.p_path);}
      const cur=docs.get(args.p_path)||null;
      if((cur?.rev??null)!==args.p_rev||(cur?.op??null)!==args.p_op)result={ok:false,cur};
      else if(args.p_data.rev!==(args.p_rev??0)+1)return route.fulfill({status:400,json:{code:'22023'}});
      else{
        docs.set(args.p_path,args.p_data);result={ok:true,t:new Date().toISOString()};
        if(server.loseSaveReply){server.loseSaveReply=false;return route.abort();}
      }
    }
    else if(fn==='ph_profiles')result={};
    else if(fn==='ph_set'||fn==='ph_update'){
      const data=fn==='ph_set'?args.p_data:{...docs.get(args.p_path),...args.p_data};
      docs.set(args.p_path,data);
      if(args.p_path===`srs/${profile.id}/decks/${deckId}`&&data.s?.[cardId]?.[3]>0)acct.cards.add(cardId);
      result=new Date().toISOString();
    } else if(fn==='ph_oplot_scout')result={unlocked:false,at:'2040-04-01T00:00:00Z',day:'2040-04-01'};
    else if(fn==='ph_oplot_wallet')result=wallet(acct);
    else if(fn==='ph_oplot_buy'){
      const price={berries:3,gold:5,incubate:1}[args.p_item];
      const prior=acct.receipts.get(args.p_op);
      acct.attempts.push(args.p_op);
      if(!price||!args.p_op||prior&&prior.item!==args.p_item||!prior&&wallet(acct).balance<price)
        return route.fulfill({status:400,json:{code:'22023',message:'Покупка отклонена'}});
      if(!prior)acct.receipts.set(args.p_op,{op:args.p_op,item:args.p_item,price});
      if(server.loseBuyReply){server.loseBuyReply=false;return route.abort();}
      result={...wallet(acct),...acct.receipts.get(args.p_op)};
    }
    return route.fulfill({json:result,headers:{'access-control-allow-origin':'*'}});
  });
  return server;
}

async function check(browser,width,dark){
  const context=await browser.newContext({viewport:{width,height:850},colorScheme:dark?'dark':'light',serviceWorkers:'block'});
  const {accounts}=await studyBackend(context);
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const game=page.frameLocator('#oplot-game');
  const first=accounts.get(profiles[0].id);
  const openGame=()=>page.locator('#nav [data-v="oplot"]').click();
  const openVault=()=>game.locator('.wallets [data-do="wallet"]').click();
  const leave=async view=>{await openVault();await game.locator(`[data-do="learn"][data-id="${view}"]`).click();};
  async function login(p){
    await page.locator('#ph-code').fill(p.code);
    await page.locator('#ph-login button[type=submit]').click();
  }
  async function counter(id,n){
    await game.locator('#'+id).filter({hasText:new RegExp('^'+n+'$')}).waitFor();
  }
  async function study(){
    await page.locator(`[data-act="deck"][data-id="${deckId}"]`).click();
    await page.locator('[data-act="study"][data-all="1"]').click();
    await page.locator('[data-act="show"]').click();
    await page.locator('[data-act="rate"][data-g="3"]').click();
    await page.getByText('За первую успешную попытку',{exact:false}).waitFor();
    // Wait for the normal batched SRS save, as a teacher's real server would.
    await page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/rpc/ph_set')&&
      r.request().postDataJSON()?.p_path===`srs/${profiles[0].id}/decks/${deckId}`);
    await page.locator('.rv-done [data-act="endreview"]').click();
  }
  try{
    const entry=new URL(site);entry.searchParams.set('oplot','1');
    await page.goto(entry.href,{waitUntil:'domcontentloaded'});
    await login(profiles[0]);await counter('balance',8);
    await leave('tasks');
    await page.locator(`[data-act="open"][data-id="${homeworkId}"]`).first().click();
    await page.getByText(/Награда за этот результат — 8 алмазов/).waitFor();
    await openGame();await leave('cards');await study();
    assert.equal(first.cards.size,1);
    await openGame();await counter('balance',9);await leave('cards');await study();
    await openGame();await counter('balance',9);
    const initialBerries=Number(await game.locator('#berries').innerText());
    await openVault();await game.getByText(/Карточки: 1 · Домашние работы: 8 · Потрачено: 0/).waitFor();
    await game.locator('[data-do="purchase"][data-id="berries"]').click();
    await game.locator('[data-do="recover"]').waitFor();
    assert.equal(first.receipts.size,1);await counter('berries',initialBerries);
    await page.goto(entry.href,{waitUntil:'domcontentloaded'});
    await counter('berries',initialBerries+75);await counter('balance',6);
    assert.equal(first.attempts.length,2);assert.equal(new Set(first.attempts).size,1);
    await page.reload({waitUntil:'domcontentloaded'});await counter('berries',initialBerries+75);
    await openVault();await game.getByText(/Карточки: 1 · Домашние работы: 8 · Потрачено: 3/).waitFor();
    await game.locator('[data-do="learn"][data-id="cards"]').click();
    page.once('dialog',d=>d.accept());await page.locator('#ph-bar [data-a="out"]').click();
    await login(profiles[1]);await openGame();await counter('balance',0);await counter('berries',initialBerries);
    await openVault();await game.getByText(/Карточки: 0 · Домашние работы: 0 · Потрачено: 0/).waitFor();
    assert.equal(await game.locator('[data-do="purchase"][data-id="berries"]').isDisabled(),true);
    assert.equal(accounts.get(profiles[1].id).receipts.size,0);
    // A pending deployment leaves the island usable, and retry recovers after RPC installation.
    const walletURL='**/rest/v1/rpc/ph_oplot_wallet';
    const missing=route=>route.fulfill({status:404,json:{code:'PGRST202',message:'Test fixture'}});
    await context.route(walletURL,missing);
    await game.locator('[data-do="sync"]').click();
    await game.getByText(/Казна ждёт подключения/).waitFor();
    assert.equal(await game.locator('#balance').textContent(),'—');
    await context.unroute(walletURL,missing);
    await game.locator('[data-do="sync"]').click();await counter('balance',0);
    assert.deepEqual(errors,[]);
    console.log('PASS embedded Phagi, card and homework rewards, purchase replay and profile switch',width,dark?'dark':'light');
  }finally{await context.close();}
}
module.exports={fixtures,studyBackend,profiles};
if(require.main===module)(async()=>{
  const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try{await check(browser,1180,false);await check(browser,390,true);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
