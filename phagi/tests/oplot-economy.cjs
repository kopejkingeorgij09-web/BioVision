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
  await close();await page.evaluate(({key,save})=>{localStorage.removeItem(key+'.settled-v1');localStorage.setItem(key,JSON.stringify(save))},{key,save});await page.reload();
 }
 async function openBuilding(id){await tab('build');await act(dialog,'structure',id)}
 async function checkResidents(start){
  const dragons=Array.from({length:48},(_,i)=>({id:'roster-'+i,species:i,level:1+i%27}));
  await seed({...start,dragons,book:dragons.map(d=>d.species)});
  const painted=await page.evaluate(()=>new Promise(resolve=>{
   const art=window.Art;
   window.Art={...art,island(c,w,h,time,state){
    if(!state.homeView)return art.island(c,w,h,time,state);
    let count=0;const draw=c.drawImage;
    c.drawImage=function(...args){if(args.length===9)count++;return draw.apply(this,args)};
    try{art.island(c,w,h,time,state);resolve({ids:state.dragons.map(d=>d.id),count})}
    finally{delete c.drawImage;window.Art=art}
   }};
  }));
  assert.deepEqual(painted.ids,dragons.map(d=>d.id));assert.equal(painted.count,dragons.length);
  await tab('battle');await act(dialog,'mode','defense');
  assert.match(await dialog.innerText(),/Защита острова · 5\/5/);
  assert.equal(await dialog.locator('[data-do="team"]').count(),0);
  const labels=await page.evaluate(dragons=>Battle.defenders(dragons).map(d=>GAME_SPECIES[d.species].name+' · ур. '+d.level+' · №'+(dragons.indexOf(d)+1)),dragons);
  assert.deepEqual(await dialog.locator('.actions span.cost').allTextContents(),labels);
  await act(dialog,'mode','raid');assert.equal(await dialog.locator('[data-do="team"]').count(),dragons.length);
 }
 async function checkCampaign(start){
  const base=structuredClone(start),keep=base.buildings[0];
  const record=Object.fromEntries(Array.from({length:24},(_,i)=>[i+1,3]));
  base.campaign={...record};base.gold=57000;base.berries=15000;keep.level=11;base.dragons[0].level=30;
  await seed(base);await tab('battle');
  assert.equal(await dialog.locator('#stage').inputValue(),'25');
  assert.equal(await dialog.locator('#stage option').count(),30);
  assert.match(await dialog.innerText(),/цитадель ур. 12/);
  assert.ok(await dialog.locator('[data-do="start"]').isDisabled());
  await dialog.locator('#stage').selectOption('6');
  assert.ok(await dialog.locator('[data-do="start"]').isEnabled());
  await close();await selectCell(keep.x+2,keep.y+2);
  const upgrade=dialog.locator('[data-do="upgrade"]');
  assert.match(await upgrade.innerText(),/57000/);await upgrade.click();await page.reload();
  const after=await read();assert.equal(after.buildings[0].level,12);assert.equal(after.gold,0);assert.deepEqual(after.campaign,record);
  await tab('battle');assert.ok(await dialog.locator('[data-do="start"]').isEnabled());
  const clock=await page.evaluate(()=>Date.now());
  after.campaignScouts={after:24,readyAt:clock+60000};await seed(after);await tab('battle');
  assert.match(await dialog.innerText(),/возвращение разведки/);assert.ok(await dialog.locator('[data-do="start"]').isDisabled());
  await page.clock.setFixedTime(clock+65000);await page.waitForFunction(()=>!document.querySelector('[data-do="start"]').disabled);
  await dialog.locator('#stage').selectOption('30');
  assert.ok(await dialog.locator('[data-do="start"]').isDisabled());await close();
  await act(page.locator('.tabs'),'tab','collection');await act(dialog,'pet',base.dragons[0].id);await act(dialog,'feed');
  await page.reload();assert.equal((await read()).dragons[0].level,31);
 }
 async function checkAdvancedTowers(start){
  for(const [type,required] of [['mortar',10],['skybow',12],['tempest',14],['solar',16]]){
   const base={...start,buildings:[{...start.buildings[0],level:required-1}],gold:500000,xp:35000};
   await seed(base);await tab('build');const buy=dialog.locator('[data-do="construct"][data-id="'+type+'"]');
   assert.ok(await buy.isDisabled());assert.match(await buy.innerText(),new RegExp('ур. '+required));
   await close();await selectCell(base.buildings[0].x+2,base.buildings[0].y+2);await act(dialog,'upgrade',base.buildings[0].id);
   const added=await place(type,6,11);await openBuilding(added.id);await act(dialog,'range',added.id);
   assert.match(await page.locator('#mapnote').innerText(),/Радиус огня/);
   const save=await read();save.buildings.find(b=>b.id===added.id).level=9;await seed(save);
   await openBuilding(added.id);await act(dialog,'upgrade',added.id);await page.reload();
   assert.equal((await read()).buildings.find(b=>b.id===added.id).level,10);
  }
 }
 async function checkIndustry(start){
  const when=Math.floor(Date.now()/1000)*1000;
  await page.clock.setFixedTime(when);
  const keep=start.buildings[0],mine={id:'first-mine',type:'mine',level:1,x:2,y:2,since:when-50625};
  const extraMine={...mine,id:'active-mine',level:2,x:8,since:when-50000};
  const reserve={...extraMine,id:'reserve-mine',x:null,y:null,stowed:true,pausedStock:61};
  const treasury={id:'treasury',type:'goldstore',level:1,x:2,y:8,since:when};
  const spareStore={...treasury,id:'spare-treasury',x:null,y:null,stowed:true};
  const farm={...mine,id:'first-farm',type:'farm',x:13,y:5,since:when-5000};
  const spareFarm={...farm,id:'spare-farm',x:null,y:null,stowed:true,pausedStock:79};
  const homes=[2,8,20].map((x,i)=>({...mine,id:'home-'+i,type:'home',x,y:12,since:when-20000}));
  const residents=Array.from({length:10},(_,i)=>({...start.dragons[i%3],id:'dragon-'+i}));
  const card=type=>dialog.locator('article').filter({has:page.locator('[data-do="construct"][data-id="'+type+'"]')});
  const purchase=type=>card(type).locator('[data-do="construct"]');
  const legacy={...start,gold:812,berries:300,marks:{collect:1},dragons:residents,
   buildings:[{...keep,level:8},mine,extraMine,reserve,treasury,spareStore,farm,spareFarm,...homes]};
  await seed(legacy);await tab('build');
  const normalized=await read();
  assert.deepEqual(normalized.buildings.map(b=>b.id),[keep.id,extraMine.id,treasury.id,farm.id,homes[0].id,homes[1].id],
   'Higher levels win, deployed wins ties, then the earlier source slot wins');
  // First mine cost nothing; reserve mine cost 325 + 42 in upgrades. Lost harvest includes paused stock.
  assert.equal(normalized.gold,812+40+325+42+61+270+180+80+3);
  assert.equal(normalized.berries,379);
  assert.ok(await page.locator('#profile-settlement').isVisible());
  assert.match(await page.locator('#settled-amounts').textContent(),/79/);
  assert.deepEqual(normalized.dragons,residents,'Building limits never evict resident dragons');
  const quotas={mine:[1,4],farm:[1,4],goldstore:[1,6],foodstore:[1,6],home:[2,2],den:[1,null],
   archer:[2,2],cannon:[2,2],spire:[0,2],academy:[0,7],firetrap:[3,2],icetrap:[3,2],wall:[128,2]};
  for(const [type,[limit,next]] of Object.entries(quotas)){
   const text=await card(type).innerText();
   assert.match(text,new RegExp('Построено [0-9]+ из '+limit+'(?![0-9])'),type+' shows its current profile quota');
   if(next)assert.match(text,new RegExp('на '+next+'-м уровне профиля'),type+' shows the next unlock');
   else assert.doesNotMatch(text,/Следующее место/);
  }
  for(const type of ['mine','farm','goldstore','home','academy','spire'])assert.ok(await purchase(type).isDisabled(),type);
  assert.match(await purchase('spire').innerText(),/ур. 2/);assert.match(await purchase('academy').innerText(),/ур. 7/);
  assert.match(await card('mine').innerText(),/96 → 144 золота\/мин/);
  assert.match(await card('goldstore').innerText(),/450 → 1\s?800 золота/);
  await close();await act(page,'collectall');await act(page,'quest');
  const blocked=await read();
  assert.deepEqual([blocked.gold,blocked.berries,blocked.quest],[normalized.gold,379,0],'No room for ordinary harvest or quest reward: existing compensation is kept');
  await tab('collection');await act(dialog,'nursery');
  assert.match(await dialog.innerText(),/Свободных мест — 0/);
  assert.ok(await dialog.locator('[data-do="adopt"]').first().isDisabled());
  await tab('collection');await act(dialog,'pet','dragon-0');await act(dialog,'feed','dragon-0');
  assert.equal((await read()).berries,353,'Feeding one dragon costs exactly 26 while the barn is overfull');
  await close();await place('archer',24,12);
  assert.equal((await read()).gold,normalized.gold-70,'Building spends exactly its price while gold is over capacity');
  await page.reload();const afterReload=await read();
  assert.equal(afterReload.gold,normalized.gold-70);assert.equal(afterReload.berries,353);
  assert.equal(afterReload.dragons.length,10,'Reloading an overcrowded home keeps every dragon');

  const basic={...start,gold:812,buildings:[keep,mine,treasury]};
  await seed(basic);await openBuilding(mine.id);assert.match(await dialog.innerText(),/48 золота в минуту/);
  assert.match(await dialog.innerText(),/96 в минуту и до 720/);
  await act(dialog,'upgrade',mine.id);const improved=await read(),newMine=improved.buildings.find(b=>b.id===mine.id);
  assert.equal(improved.gold,812-42);assert.deepEqual(improved.buildings.filter(b=>b.id!==mine.id),[keep,treasury]);
  const stock=await page.evaluate(({b,t})=>productionStock(b,t),{b:newMine,t:when});
  assert.ok(stock>=40.5&&stock<40.502,'Upgrading retains both ready stock and partial production');
  assert.equal(await page.evaluate(({b,t})=>stored(b,t+60000),{b:newMine,t:when}),136);
  for(const level of [1,4,9]){
   for(const type of ['mine','farm','home']){
    const producer={...mine,type,level,since:when-3600000};
    const full=await page.evaluate(({producer,when})=>stored(producer,when),{producer,when});
    assert.equal(full,(type==='home'?90:360)*level,type+' level '+level+' saturation');
   }
  }
  const vintage={...start,layoutVersion:1,gold:200,buildings:[{...keep,x:4,y:4},mine,{...extraMine,x:8,y:0}]};
  await seed(vintage);await tab('build');assert.ok(await purchase('mine').isDisabled());
  await close();await act(page,'collectall');await page.reload();
  const converted=await read();assert.equal(converted.layoutVersion,2);assert.equal(converted.gold,320);
  assert.deepEqual(converted.buildings.map(b=>b.id),[keep.id,extraMine.id],'One-cell saves convert and refund the first mine exactly once');

  const grown={...start,xp:35*3**2,gold:800,buildings:[keep,mine,treasury]};
  await seed(grown);await tab('build');assert.match(await card('mine').innerText(),/из 2/);
  assert.match(await purchase('mine').innerText(),/195 зол/);assert.ok(await purchase('goldstore').isDisabled());
  assert.ok(await purchase('spire').isEnabled(),'A level-one keep on a level-four profile can purchase a spire');
  await place('mine',13,6);const second=await read();assert.equal(second.gold,605);
  await tab('build');assert.ok(await purchase('mine').isDisabled());
  await seed({...second,xp:35*5**2});await tab('build');
  assert.match(await purchase('goldstore').innerText(),/270 зол/);assert.ok(await purchase('mine').isDisabled());
  await place('goldstore',9,15);await tab('build');assert.ok(await purchase('goldstore').isDisabled());
  await seed({...await read(),xp:35*6**2});await tab('build');
  assert.match(await purchase('mine').innerText(),/325 зол/);assert.ok(await purchase('academy').isEnabled());
 }
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
  // A drift of one grid cell does not turn a straight run. Only the second
  // stroke actually changes direction, and lifting the finger leaves a gap.
  await seed({...start,gold:950});await begin();
  const client=width===390&&browser.browserType().name()==='chromium'?await ctx.newCDPSession(page):null;
  async function stroke(cells){
   await world.scrollIntoViewIfNeeded();const box=await world.boundingBox();
   const points=await Promise.all(cells.map(async ([x,y])=>{
    const p=await cellPoint(x,y);return {x:box.x+p.x,y:box.y+p.y};
   }));
   if(client){
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
    for(const p of points.slice(1))await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   }else{
    await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();
    for(const p of points.slice(1))await page.mouse.move(p.x,p.y);
    await page.mouse.up();
   }
  }
  await stroke([[5,8],[7,8],[10,8],[11,9]]);await quote(7);
  await stroke([[5,13],[8,13],[9,13],[9,14],[9,16]]);await quote(15);
  await act(panel,'confirmwalls');
  const ordered=(await read()).buildings.filter(b=>b.type==='wall').map(b=>b.x+','+b.y).sort();
  const expected=[...Array.from({length:7},(_,i)=>(5+i)+',8'),...Array.from({length:5},(_,i)=>(5+i)+',13'),'9,14','9,15','9,16'];
  assert.deepEqual(ordered,expected.sort());assert.equal((await read()).gold,650);
  await act(page,'cancelplace');
  async function blocked(island,row,reason){
   await seed(island);await begin();await selectCell(1,row);await selectCell(2,row);
   await quote(2);assert.ok(await confirm.isDisabled());assert.match(await panel.locator('#wall-issue').innerText(),reason);
   await act(page,'cancelplace');assert.deepEqual(await read(),island);
  }
  await blocked({...start,gold:39},7,/золот/i);
  const field=await page.evaluate(base=>islandGrid(base),start);
  const perimeter=2*(field.width+field.height)-4;
  const nearlyFull=Array.from({length:perimeter-1},(_,i)=>wall('section-'+i,i%field.width,Math.floor(i/field.width)));
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
  await expectExpansion(35,'36×33');
  const guide=progress.locator('details#xp-guide');
  await guide.locator('summary').click();
  assert.ok(await guide.evaluate(el=>el.open));
  const rewards=await guide.innerText();
  for(const action of [/строи|построй/i,/улучш/i,/корм/i,/вылуп|из яйца|инкубац|вывед/i,/глав|задани/i,/зачаро/i,/побед|выигр/i]){
   assert.match(rewards,action,'Profile XP source');
  }
  for(const amount of [18,35,12,8,20,15])assert.match(rewards,new RegExp('\\b'+amount+'\\b'),'XP reward or factor '+amount);
  await guide.locator('summary').click();
  await seed({...start,xp:35});await expectExpansion(105,'36×36');
  await seed(start);
  await tab('build');assert.equal(await dialog.locator('[data-do="construct"][data-id="academy"]').isDisabled(),true);
  const mine=await place('mine',13,7);
  assert.equal((await read()).xp,18);await expectExpansion(17,'36×33');
  const farm=await place('farm',4,13);assert.equal((await read()).gold,start.gold);
  await expectExpansion(104,'36×36');
  assert.match(await page.locator('#island-area').innerText(),/Уровень 2 · 36 × 33/);
  // The extra rows stay closed while the new columns accept a 4×4 store.
  await tab('build');await act(dialog,'construct','foodstore');
  const closedCell=await world.evaluate(c=>Art.point(2,33,c.clientWidth,c.clientHeight,36));
  await world.click({position:closedCell});assert.equal((await read()).buildings.length,3);
  await act(page,'cancelplace');
  const barn=await place('foodstore',32,12), treasury=await place('goldstore',7,14);
  const built=await read();
  assert.equal(built.gold,start.gold-75-90);
  assert.match(await page.locator('#berries + small').innerText(),/620/);
  assert.match(await page.locator('#gold + small').innerText(),/900/);
  const nearFull={...built,gold:895,berries:615};
  for(const b of nearFull.buildings)b.since=Date.now()-1200000;
  await seed(nearFull);await act(page,'collectall');
  const collected=await read();assert.equal(collected.gold,900);assert.equal(collected.berries,620);
  for(const id of [farm.id,mine.id]){
   const remaining=await page.evaluate(b=>stored(b),collected.buildings.find(b=>b.id===id));
   assert.ok(remaining>=355&&remaining<360,'Remainder retained at producer');
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
  const savedBarn=(await read()).buildings.find(b=>b.id===barn.id);assert.equal(savedBarn.x,32);
  await page.reload();assert.equal((await read()).buildings.find(b=>b.id===barn.id).x,32);
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
  assert.match(await page.locator('#island-area').innerText(),/Уровень 13 · 53 × 53/);
  assert.match(await expansion.innerText(),/максим|полностью|все клетки|все 2\s?809/i);
  assert.doesNotMatch(await expansion.innerText(),/до (?:следующего )?расширения/i);
  await openBuilding(wall.id);await act(dialog,'move',wall.id);
  await world.focus();for(let i=0;i<55;i++)await world.press('ArrowRight');
  for(let i=0;i<55;i++)await world.press('ArrowDown');
  await world.press('Enter');
  const moved=(await read()).buildings.find(b=>b.id===wall.id);
  assert.deepEqual([moved.x,moved.y],[52,52]);await page.reload();
  assert.deepEqual((await read()).buildings.find(b=>b.id===wall.id),moved);
  await checkResidents(start);
  await checkSale(start);
  await checkWallBuilder(start);
  await checkAdvancedTowers(start);await checkIndustry(start);
  await checkCampaign(start);
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px · placement, industry quotas/prices/legacy stock, storage, profile XP, enchantments, walls, dragon sales and housing');
 }finally{await ctx.close()}
}
(async()=>{const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
try{await Promise.all([check(browser,1180),check(browser,390)])}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
