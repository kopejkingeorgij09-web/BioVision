// Drives the shipped island UI. Fixtures live only in an isolated guest browser context.
const assert=require('node:assert/strict');
const {chromium,webkit}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const url=process.argv[2]||'http://127.0.0.1:18946/phagi/oplot.html';
const key='phagi.oplot.v1.local.standalone';

async function check(browser,width) {
 const ctx=await browser.newContext({viewport:{width,height:860},colorScheme:width===390?'dark':'light',isMobile:width===390,hasTouch:width===390});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const dialog=page.locator('#dialog'),world=page.locator('#world');
 const progress=page.locator('#island-progress'),expansion=progress.locator('#xp-expansion');
 async function expectExpansion(remaining,size){
  assert.ok(await progress.isVisible(),'Profile progress is visible on the island');
  assert.match(await expansion.innerText(),new RegExp('\\b'+remaining+'\\b'),'Remaining XP before expansion');
  assert.ok((await progress.innerText()).replace(/\s/g,'').includes(size),'Next plot size '+size);
 }
 const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 const act=(scope,action,id)=>scope.locator('[data-do="'+action+'"]'+(id===undefined?'':'[data-id="'+id+'"]')).click();
 async function close(){if(await dialog.isVisible())await act(dialog,'close')}
 async function tab(id){await close();await act(page.locator('.tabs'),'tab',id)}
 async function place(type,x,y){
  await tab('build');await act(dialog,'construct',type);
  const side=await page.evaluate(save=>islandSize(save),await read());
  const pt=await world.evaluate((c,p)=>Art.point(p.x,p.y,c.clientWidth,c.clientHeight,p.side),{x,y,side});
  await world.click({position:pt});
  const b=(await read()).buildings.find(b=>b.type===type&&b.x===x&&b.y===y);
  assert.ok(b,'Placed '+type);return b;
 }
 async function seed(save){
  await close();await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save});await page.reload();
 }
 async function openBuilding(id){await tab('build');await act(dialog,'structure',id)}
 try {
  await page.goto(url);
  const start=await read();assert.deepEqual(start.buildings.map(b=>b.type),['keep']);
  await expectExpansion(35,'11×10');
  const guide=progress.locator('details#xp-guide');
  await guide.locator('summary').click();
  assert.ok(await guide.evaluate(el=>el.open));
  const rewards=await guide.innerText();
  for(const action of [/строи|построй/i,/улучш/i,/корм/i,/вылуп|из яйца|инкубац|вывед/i,/глав|задани/i,/зачаро/i,/побед|выигр/i]){
   assert.match(rewards,action,'Profile XP source');
  }
  for(const amount of [18,35,12,8,20,15])assert.match(rewards,new RegExp('\\b'+amount+'\\b'),'XP reward or factor '+amount);
  await guide.locator('summary').click();
  await seed({...start,xp:35});await expectExpansion(105,'11×11');
  await seed(start);
  await tab('build');assert.equal(await dialog.locator('[data-do="construct"][data-id="academy"]').isDisabled(),true);
  const mine=await place('mine',5,4);
  assert.equal((await read()).xp,18);await expectExpansion(17,'11×10');
  const farm=await place('farm',3,4);assert.equal((await read()).gold,start.gold);
  await expectExpansion(104,'11×11');
  assert.match(await page.locator('#island-area').innerText(),/Уровень 2 · 11 × 10/);
  // Row eleven stays closed while column eleven immediately accepts construction.
  await tab('build');await act(dialog,'construct','foodstore');
  const closedCell=await world.evaluate(c=>Art.point(2,10,c.clientWidth,c.clientHeight,11));
  await world.click({position:closedCell});assert.equal((await read()).buildings.length,3);
  await act(page,'cancelplace');
  const barn=await place('foodstore',10,5), treasury=await place('goldstore',4,5);
  const built=await read();
  assert.equal(built.gold,start.gold-75-90);
  assert.match(await page.locator('#berries + small').innerText(),/620/);
  assert.match(await page.locator('#gold + small').innerText(),/900/);
  const nearFull={...built,gold:895,berries:615};
  for(const b of nearFull.buildings)b.since=Date.now()-200000;
  await seed(nearFull);await act(page,'collectall');
  const collected=await read();assert.equal(collected.gold,900);assert.equal(collected.berries,620);
  for(const id of [farm.id,mine.id]){
   const remaining=await page.evaluate(b=>stored(b),collected.buildings.find(b=>b.id===id));
   assert.ok(remaining>=85&&remaining<90,'Remainder retained at producer');
  }
  await openBuilding(barn.id);await act(dialog,'upgrade',barn.id);assert.match(await dialog.innerText(),/1\s?280/);
  await openBuilding(treasury.id);await act(dialog,'upgrade',treasury.id);
  assert.ok((await read()).buildings.filter(b=>b.type.endsWith('store')).every(b=>b.level===2));
  await close();await act(page,'collectall');
  assert.ok((await read()).berries>620);
  const savedBarn=(await read()).buildings.find(b=>b.id===barn.id);assert.equal(savedBarn.x,10);
  await page.reload();assert.equal((await read()).buildings.find(b=>b.id===barn.id).x,10);
  const veteran=await read();veteran.xp=1250;veteran.gold=760;veteran.berries=940;await seed(veteran);
  await tab('build');assert.equal(await dialog.locator('[data-do="construct"][data-id="academy"]').isDisabled(),true);
  const wall=await place('wall',3,5);
  assert.match(await page.locator('#caption').innerText(),/ур. 7/);
  const academy=await place('academy',12,12);
  await openBuilding(academy.id);await act(dialog,'academy');await dialog.locator('#academy-dragon').selectOption('d1');
  const before=await read();await act(dialog,'enchant','d1');const after=await read();
  assert.equal(after.dragons[1].enchant,1);assert.equal(after.dragons[0].enchant||0,0);
  assert.equal(after.gold,before.gold-70);assert.equal(after.berries,before.berries-45);
  assert.ok(await dialog.locator('[data-do="enchant"]').isDisabled());
  await openBuilding(academy.id);await act(dialog,'upgrade',academy.id);await act(dialog,'academy');
  await dialog.locator('#academy-dragon').selectOption('d1');await act(dialog,'enchant','d1');
  assert.equal((await read()).dragons[1].enchant,2);
  await openBuilding(wall.id);await act(dialog,'upgrade',wall.id);assert.equal((await read()).buildings.find(b=>b.id===wall.id).level,2);
  await page.reload();await tab('collection');await act(dialog,'pet','d1');
  assert.match(await dialog.innerText(),/Зачарование 2 \/ 5/);
  const maxIsland=await read();maxIsland.xp=35*12*12;maxIsland.gold=450;await seed(maxIsland);
  assert.match(await page.locator('#island-area').innerText(),/Уровень 13 · 16 × 16/);
  assert.match(await expansion.innerText(),/максим|полностью|все клетки|все 256/i);
  assert.doesNotMatch(await expansion.innerText(),/до (?:следующего )?расширения/i);
  await openBuilding(wall.id);await act(dialog,'move',wall.id);
  await world.focus();for(let i=0;i<17;i++)await world.press('ArrowRight');
  for(let i=0;i<17;i++)await world.press('ArrowDown');
  await world.press('Enter');
  const moved=(await read()).buildings.find(b=>b.id===wall.id);
  assert.deepEqual([moved.x,moved.y],[15,15]);await page.reload();
  assert.deepEqual((await read()).buildings.find(b=>b.id===wall.id),moved);
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px · placement, free starter production, capped collection, saved leftovers, storage upgrades, profile level 7, individual enchantments and walls');
 }finally{await ctx.close()}
}
(async()=>{const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
try{await Promise.all([check(browser,1180),check(browser,390)])}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
