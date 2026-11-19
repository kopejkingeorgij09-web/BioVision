// Exercise the normal review UI and island handoff in two independent profiles.
const assert=require('node:assert/strict');
const {chromium}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const {fixtures,profiles,studyBackend}=require('./oplot-game.cjs');
const site=new URL(process.argv[2]||'http://127.0.0.1:18979/phagi/');
site.searchParams.set('oplot','1');
(async()=>{
 const browser=await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
 const server=fixtures(),stored=new Set(),markers=[];
 const deckId='fixture-deck',deck=server.docs.get('decks/'+deckId);
 deck.cards.push({i:'second',f:'Второй вопрос',b:'Второй ответ'});
 const pupil=profiles[1].id,splitId='qa-split',splitPath='srs/'+pupil+'/decks/'+splitId;
 const capId='qa-daily-cap',capPath='srs/'+pupil+'/decks/'+capId;
 const card=i=>({i,f:'Вопрос '+i,b:'Ответ '+i});
 const old=['2040-01-01',8,2.5,3,0],shards=[{},{},{}],splitWrites=[],capMarkers=[];
 function shard(id){let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h)%3}
 for(let i=0;i<5000;i++){const id='old-'+i;shards[shard(id)][id]=old}
 shards[2].b=['2001-01-01',1,2.5,1,0];shards[0].c=['2001-01-02',1,2.5,1,0];
 server.docs.set('decks/'+splitId,{...deck,to:[pupil],cards:[card('b'),card('c')]});
 for(let k=0;k<3;k++)server.docs.set(splitPath+(k?'~'+k:''),k?{s:shards[k]}:{s:shards[0],shards:3});
 const day=new Date().toLocaleDateString('sv-SE'),capCards=Array.from({length:21},(_,i)=>card(String(i)));
 server.docs.set('decks/'+capId,{...deck,to:[pupil],cards:capCards});
 server.docs.set(capPath,{s:Object.fromEntries(capCards.slice(0,19).map(c=>[c.i,old])),nd:{day,n:19}});
 let failSecondShard=true;
 async function device(which,width){
  const context=await browser.newContext({viewport:{width,height:840},serviceWorkers:'block',colorScheme:width===390?'dark':'light'});
  await studyBackend(context,server);
  await context.route('**/rpc/ph_set',route=>{
   const args=route.request().postDataJSON();
   if(args.p_path==='srs/'+which.id+'/decks/'+deckId && args.p_data.oplotFinish){
    const data=args.p_data,mark=data.oplotFinish;
    assert.ok(data.s[mark.card][3]>0);assert.ok(deck.cards.every(c=>data.s[c.i]?.[3]>0));
    markers.push(mark);stored.add(which.id);
   }
   if(args.p_path.startsWith(splitPath)){
    const suffix=args.p_path.slice(splitPath.length);
    splitWrites.push(suffix+(args.p_data.oplotFinish?'!':''));
    if(suffix==='~2'&&failSecondShard){failSecondShard=false;return route.fulfill({status:503,json:{message:'fixture disconnect'}})}
    if(args.p_data.oplotFinish)stored.add(which.id);
   }
   if(args.p_path===capPath&&args.p_data.oplotFinish)capMarkers.push(args.p_data);
   return route.fallback();
  });
  await context.route('**/rpc/ph_oplot_scout',route=>{
   const unlocked=stored.has(which.id);
   return route.fulfill({json:{at:'2040-04-01T00:00:00Z',day:'2040-04-01',unlocked,...(unlocked?{entrySide:2}:{})}});
  });
  const page=await context.newPage();
  await page.goto(site.href,{waitUntil:'domcontentloaded'});
  await page.locator('#ph-code').fill(which.code);
  await page.locator('#ph-login button[type=submit]').click();
  const frame=page.frameLocator('#oplot-game');
  return {context,page,post:frame.locator('#scout-post'),frame};
 }
 try{
  const {context,page,post}=await device(profiles[0],1180);
  await post.getByText(/Закончи повторение колоды/).waitFor();
  await post.locator('#scout-action').click();
  await page.locator('[data-act="deck"][data-id="'+deckId+'"]').click();
  const all=page.locator('[data-act="study"][data-all="1"]');
  async function rate(grade,at=page){
   await at.locator('[data-act="show"]').click();
   await at.locator('[data-act="rate"][data-g="'+grade+'"]').click();
  }
  const srsWrite=()=>page.waitForResponse(r=>r.url().endsWith('/rpc/ph_set')&&r.request().postDataJSON().p_path==='srs/'+profiles[0].id+'/decks/'+deckId);
  await all.click();await rate(3);
  let saved=srsWrite();await page.locator('.rv-top [data-act="endreview"]').click();await saved;
  assert.equal(markers.length,0,'Early exit cannot grant intelligence');
  await all.click();await rate(3);saved=srsWrite();await rate(1);await saved;
  assert.equal(markers.length,0,'Again on the last card must leave the queue open');
  saved=srsWrite();await rate(3);await saved;
  assert.equal(markers.length,1,'Completing the review should attach exactly one proof');
  await page.locator('.rv-done [data-act="endreview"]').click();
  await page.locator('#nav [data-v="oplot"]').click();
  await post.getByText(/с нижнего правого края/).waitFor();
  const same=await device(profiles[0],390);
  await same.post.getByText(/с нижнего правого края/).waitFor();
  const different=await device(profiles[1],390);
  await different.post.getByText(/Закончи повторение колоды/).waitFor();
  assert.equal(await different.post.locator('.scout-map').count(),0);
  const mobile=different.page;
  await different.post.locator('#scout-action').click();
  await mobile.locator('[data-act="deck"][data-id="'+splitId+'"]').click();
  await mobile.locator('[data-act="study"]:not([data-all])').click();
  const markedSplit=mobile.waitForResponse(r=>r.url().endsWith('/rpc/ph_set')&&r.request().postDataJSON().p_data?.oplotFinish?.card==='c');
  await rate(3,mobile);await rate(3,mobile);await markedSplit;
  assert.deepEqual(splitWrites,['~1','~2','~2','!'],'The successful first shard stays intact and the failed predecessor is retried before completion');
  assert.deepEqual(server.docs.get(splitPath+'~1').s,shards[1]);
  assert.equal(server.docs.get(splitPath+'~2').s.b[3],2);assert.equal(server.docs.get(splitPath).s.c[3],2);
  await mobile.locator('.rv-done [data-act="endreview"]').click();
  await mobile.locator('#nav [data-v="cards"]').click();
  await mobile.locator('[data-act="deck"][data-id="'+capId+'"]').click();
  await mobile.locator('[data-act="study"]:not([data-all])').click();
  const capWrite=()=>mobile.waitForResponse(r=>r.url().endsWith('/rpc/ph_set')&&r.request().postDataJSON().p_path===capPath&&!!r.request().postDataJSON().p_data.oplotFinish);
  let mark=capWrite();await rate(3,mobile);await mark;
  assert.equal(capMarkers.length,1);assert.equal(capMarkers[0].oplotFinish.full,false);
  assert.equal(Object.keys(capMarkers[0].s).length,20);assert.equal(capMarkers[0].nd.n,20);
  await mobile.locator('.rv-done [data-act="endreview"]').click();
  await mobile.locator('[data-act="study"][data-all="1"]').click();
  for(let i=0;i<20;i++)await rate(3,mobile);
  assert.equal(capMarkers.length,1,'Full review cannot complete at the daily limit');
  mark=capWrite();await rate(3,mobile);await mark;
  assert.equal(capMarkers.length,2);assert.equal(capMarkers[1].oplotFinish.full,true);
  assert.equal(Object.keys(capMarkers[1].s).length,21);
  console.log('PASS early exit, Again, completed review across devices, isolated profiles, interrupted three-shard save, daily cap and full-deck replay');
  await Promise.all([context.close(),same.context.close(),different.context.close()]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
