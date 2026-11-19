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
 async function cellPoint(x,y){
  const side=await page.evaluate(save=>islandSize(save),await read());
  return world.evaluate((c,p)=>Art.point(p.x,p.y,c.clientWidth,c.clientHeight,p.side),{x,y,side});
 }
 async function selectCell(x,y){
  const position=await cellPoint(x,y);
  if(width===390)await world.tap({position});else await world.click({position});
 }
 async function place(type,x,y){
  await tab('build');await act(dialog,'construct',type);
  const offset=await page.evaluate(type=>Math.floor((OplotLayout.size(type)-1)/2),type);
  await selectCell(x+offset,y+offset);
  if(type==='wall'){
   await act(page.locator('#wall-builder'),'confirmwalls');await act(page,'cancelplace');
  }
  const b=(await read()).buildings.find(b=>b.type===type&&b.x===x&&b.y===y);
  assert.ok(b,'Placed '+type);return b;
 }
 async function seed(save){
  await close();await page.evaluate(({key,save})=>localStorage.setItem(key,JSON.stringify(save)),{key,save});await page.reload();
 }
 async function openBuilding(id){await tab('build');await act(dialog,'structure',id)}
 async function checkWallBuilder(start){
  const panel=page.locator('#wall-builder'),confirm=panel.locator('[data-do="confirmwalls"]');
  const wall=(id,x,y)=>({id,type:'wall',level:1,x,y,since:start.buildings[0].since});
  async function begin(){await tab('build');await act(dialog,'construct','wall');assert.ok(await panel.isVisible())}
  async function quote(count){
   const numbers=(await panel.locator('#wall-summary').innerText()).match(/\d+/g);
   assert.deepEqual(numbers.map(Number),[count,count*20]);
  }
  const existing=wall('old-wall',2,2);
  const original={...start,gold:135,buildings:[...start.buildings,existing]};
  await seed(original);await begin();
  if(width===390){
   await selectCell(1,2);await selectCell(4,2);
  }else{
   await world.scrollIntoViewIfNeeded();
   const bounds=await world.boundingBox(),from=await cellPoint(1,2),to=await cellPoint(4,2);
   await page.mouse.move(bounds.x+from.x,bounds.y+from.y);await page.mouse.down();
   await page.mouse.move(bounds.x+to.x,bounds.y+to.y,{steps:8});await page.mouse.up();
  }
  await quote(3);await selectCell(4,3);await quote(4);
  await act(panel,'wallundo');await quote(3);
  await selectCell(4,3);await quote(4);
  assert.deepEqual(await read(),original,'Preview and undo do not change the saved island');
  await act(panel,'confirmwalls');
  const built=await read(),newWalls=built.buildings.filter(b=>!original.buildings.some(old=>old.id===b.id));
  assert.deepEqual(newWalls.map(b=>[b.x,b.y]).sort(),[[1,2],[3,2],[4,2],[4,3]]);
  assert.ok(newWalls.every(b=>b.type==='wall'&&b.level===1));
  assert.deepEqual(built.buildings.find(b=>b.id===existing.id),existing);
  assert.equal(built.gold,original.gold-80);assert.equal(built.xp,original.xp+72);
  await quote(0);assert.ok(await confirm.isDisabled(),'Confirmed line cannot be charged again');
  await selectCell(16,13);await selectCell(16,17);assert.ok(await confirm.isDisabled(),'Occupied citadel blocks the entire line');
  await act(page,'cancelplace');assert.deepEqual(await read(),built);
  await begin();await selectCell(1,5);await quote(1);await act(page,'cancelplace');
  await page.reload();assert.deepEqual(await read(),built,'Confirmed walls persist, cancelled preview does not');
  async function blocked(island,row,reason){
   await seed(island);await begin();await selectCell(1,row);await selectCell(2,row);
   await quote(2);assert.ok(await confirm.isDisabled());assert.match(await panel.locator('#wall-issue').innerText(),reason);
   await act(page,'cancelplace');assert.deepEqual(await read(),island);
  }
  await blocked({...start,gold:39},7,/золот/i);
  const nearlyFull=Array.from({length:135},(_,i)=>wall('section-'+i,i%35,Math.floor(i/35)));
  await blocked({...start,buildings:[...start.buildings,...nearlyFull]},7,/лимит/i);
 }
 async function checkSale(start){
  const dragon={...start.dragons[1],species:5,level:4,enchant:1};
  const island={...start,gold:100,dragons:[start.dragons[0],dragon,start.dragons[2]],book:[...start.book,dragon.species]};
  const sell=dialog.locator('[data-do="sell"]'),confirm=dialog.locator('[data-do="confirmsale"]');
  async function openPet(id){await tab('collection');await act(dialog,'pet',id)}
  async function blocked(save,id){
   await seed(save);await openPet(id);
   if(await sell.isVisible()&&await sell.isEnabled())await sell.click();
   assert.ok(!await confirm.isVisible()||!await confirm.isEnabled(),'Sale must be unavailable');
   assert.deepEqual(await read(),save);
  }
  await seed(island);await openPet(dragon.id);
  const prices=await page.evaluate(()=>[1,2,3,4].map(rank=>{
   const species=GAME_SPECIES.find(sp=>sp.rank===rank).id;
   return dragonSalePrice({species,level:3,enchant:1});
  }));
  assert.deepEqual(prices,[52,99,166,248]);
  const balance=await page.locator('#balance').innerText();
  await sell.click();assert.match(await dialog.innerText(),/\b111\b/);
  await act(dialog,'pet',dragon.id);assert.deepEqual(await read(),island,'Cancel must leave the entire save intact');
  await sell.click();
  await confirm.evaluate(button=>{button.click();button.click()});
  const expected={...island,gold:211,dragons:[start.dragons[0],start.dragons[2]]};
  assert.deepEqual(await read(),expected,'One dragon sold for 111 gold; book, XP and receipt history retained');
  assert.equal(await page.locator('#balance').innerText(),balance);
  await page.reload();assert.deepEqual(await read(),expected);await tab('collection');
  assert.equal(await dialog.locator('[data-do="pet"]').count(),2);
  assert.equal(await dialog.locator('[data-do="pet"][data-id="d1"]').count(),0);
  await act(dialog,'nursery');assert.ok(await dialog.locator('[data-do="adopt"]').first().isEnabled(),'One housing place became available');
  await blocked({...island,gold:340},dragon.id); // 110 free gold storage, sale requires 111.
  await blocked({...island,dragons:[dragon]},dragon.id);
 }
 try {
  await page.goto(url);
  const start=await read();assert.deepEqual(start.buildings.map(b=>b.type),['keep']);
  await expectExpansion(35,'38×35');
  const guide=progress.locator('details#xp-guide');
  await guide.locator('summary').click();
  assert.ok(await guide.evaluate(el=>el.open));
  const rewards=await guide.innerText();
  for(const action of [/строи|построй/i,/улучш/i,/корм/i,/вылуп|из яйца|инкубац|вывед/i,/глав|задани/i,/зачаро/i,/побед|выигр/i]){
   assert.match(rewards,action,'Profile XP source');
  }
  for(const amount of [18,35,12,8,20,15])assert.match(rewards,new RegExp('\\b'+amount+'\\b'),'XP reward or factor '+amount);
  await guide.locator('summary').click();
  await seed({...start,xp:35});await expectExpansion(105,'38×38');
  await seed(start);
  await tab('build');assert.equal(await dialog.locator('[data-do="construct"][data-id="academy"]').isDisabled(),true);
  const mine=await place('mine',13,7);
  assert.equal((await read()).xp,18);await expectExpansion(17,'38×35');
  const farm=await place('farm',4,13);assert.equal((await read()).gold,start.gold);
  await expectExpansion(104,'38×38');
  assert.match(await page.locator('#island-area').innerText(),/Уровень 2 · 38 × 35/);
  // The extra rows stay closed while the new columns accept a 4×4 store.
  await tab('build');await act(dialog,'construct','foodstore');
  const closedCell=await world.evaluate(c=>Art.point(2,35,c.clientWidth,c.clientHeight,38));
  await world.click({position:closedCell});assert.equal((await read()).buildings.length,3);
  await act(page,'cancelplace');
  const barn=await place('foodstore',34,12), treasury=await place('goldstore',7,14);
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
  await openBuilding(barn.id);
  const barnArt=dialog.locator('[data-building="foodstore"]'),barnMeter=dialog.locator('.store-meter');
  assert.equal(await barnArt.getAttribute('data-fill'),'1');
  assert.equal(await barnMeter.evaluate(el=>el.value===el.max),true);
  await act(dialog,'upgrade',barn.id);assert.match(await dialog.innerText(),/1\s?280/);
  const fill=Number(await barnArt.getAttribute('data-fill'));assert.ok(fill>0&&fill<.5);
  assert.equal(fill,await barnMeter.evaluate(el=>el.value/el.max));
  await openBuilding(treasury.id);
  assert.ok(Number(await dialog.locator('[data-building="goldstore"]').getAttribute('data-fill'))<1,'Spent gold leaves the treasury');
  await act(dialog,'upgrade',treasury.id);
  assert.ok((await read()).buildings.filter(b=>b.type.endsWith('store')).every(b=>b.level===2));
  await close();await act(page,'collectall');
  assert.ok((await read()).berries>620);
  const savedBarn=(await read()).buildings.find(b=>b.id===barn.id);assert.equal(savedBarn.x,34);
  await page.reload();assert.equal((await read()).buildings.find(b=>b.id===barn.id).x,34);
  const beforeKeep=await read();await selectCell(17,17);
  assert.deepEqual(await dialog.locator('.keep-evolution canvas').evaluateAll(nodes=>nodes.map(n=>n.dataset.level)),['1','2']);
  await act(dialog,'upgrade','b0');
  assert.deepEqual(await dialog.locator('.keep-evolution canvas').evaluateAll(nodes=>nodes.map(n=>n.dataset.level)),['2','3']);
  await seed(beforeKeep);
  const veteran=await read();veteran.xp=1250;veteran.gold=760;veteran.berries=940;await seed(veteran);
  await tab('build');assert.equal(await dialog.locator('[data-do="construct"][data-id="academy"]').isDisabled(),true);
  const wall=await place('wall',3,5);
  assert.match(await page.locator('#caption').innerText(),/ур. 7/);
  const academy=await place('academy',23,23);
  await openBuilding(academy.id);await act(dialog,'academy');await dialog.locator('#academy-dragon').selectOption('d1');
  const before=await read();await act(dialog,'enchant','d1');const after=await read();
  assert.equal(after.dragons[1].enchant,1);assert.equal(after.dragons[0].enchant||0,0);
  assert.equal(after.gold,before.gold-70);assert.equal(after.berries,before.berries-45);
  assert.ok(await dialog.locator('[data-do="enchant"]').isDisabled());
  const focus=dialog.locator('[data-do="specialize"][data-id="d1|focus"]');
  const focusBonus=await page.evaluate(d=>Battle.profile(d.species,d.level,d.enchant,'focus').ability.focusDamage,after.dragons[1]);
  assert.ok(Number.isFinite(focusBonus)&&focusBonus>0);assert.ok((await focus.innerText()).includes(String(focusBonus)));
  await focus.click();const specialized=await read();
  assert.equal(specialized.dragons[1].specialty,'focus');assert.equal(specialized.gold,after.gold);
  assert.equal(specialized.berries,after.berries);assert.equal(specialized.xp,after.xp);
  await dialog.locator('#academy-dragon').selectOption('d0');await act(dialog,'specialize','d0|area');
  assert.equal((await read()).dragons[0].specialty,'area');
  await dialog.locator('#academy-dragon').selectOption('d1');
  assert.equal(await focus.getAttribute('aria-pressed'),'true');
  await act(dialog,'specialize','d1|area');assert.equal((await read()).dragons[1].specialty,'area');
  await act(dialog,'specialize','d1|focus');
  await openBuilding(academy.id);await act(dialog,'upgrade',academy.id);await act(dialog,'academy');
  await dialog.locator('#academy-dragon').selectOption('d1');await act(dialog,'enchant','d1');
  assert.equal((await read()).dragons[1].enchant,2);
  await openBuilding(wall.id);await act(dialog,'upgrade',wall.id);assert.equal((await read()).buildings.find(b=>b.id===wall.id).level,2);
  await page.reload();await tab('collection');await act(dialog,'pet','d1');
  assert.match(await dialog.innerText(),/Зачарование 2 \/ 5/);
  assert.match(await dialog.innerText(),/Фокус/);assert.match(await dialog.locator('.ability .kicker').textContent(),/Ульта · Вода/);
  const maxIsland=await read();maxIsland.xp=35*12*12;maxIsland.gold=450;await seed(maxIsland);
  assert.match(await page.locator('#island-area').innerText(),/Уровень 13 · 55 × 55/);
  assert.match(await expansion.innerText(),/максим|полностью|все клетки|все 3\s?025/i);
  assert.doesNotMatch(await expansion.innerText(),/до (?:следующего )?расширения/i);
  await openBuilding(wall.id);await act(dialog,'move',wall.id);
  await world.focus();for(let i=0;i<55;i++)await world.press('ArrowRight');
  for(let i=0;i<55;i++)await world.press('ArrowDown');
  await world.press('Enter');
  const moved=(await read()).buildings.find(b=>b.id===wall.id);
  assert.deepEqual([moved.x,moved.y],[54,54]);await page.reload();
  assert.deepEqual((await read()).buildings.find(b=>b.id===wall.id),moved);
  await checkSale(start);
  await checkWallBuilder(start);
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px · placement, storage, profile XP, enchantments, walls, dragon sales and housing');
 }finally{await ctx.close()}
}
(async()=>{const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
try{await Promise.all([check(browser,1180),check(browser,390)])}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
