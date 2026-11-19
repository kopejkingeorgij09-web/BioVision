// Real mouse/touch gestures in the embedded game, with an isolated in-memory cloud save.
// Set PHAGI_EDITOR_SCREENSHOT to save the desktop editor as a PNG.
const assert=require('node:assert/strict');
const {chromium,webkit}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const {fixtures,profiles,studyBackend}=require('./oplot-game.cjs');
const layout=require('../oplot-layout.js');
const site=new URL(process.argv[2]||'http://127.0.0.1:18748/phagi/');
site.searchParams.set('oplot','1');

function settlement(now){
  const buildings=[],shift=Math.floor((layout.gridAtLevel(3).width-20)/2);
  const add=(type,x,y,level=3,id=type)=>buildings.push({id,type,x:x+shift,y:y+shift,level,since:now-12000});
  add('keep',6,6,5);add('mine',2,2,2);add('farm',3,12);add('den',6,1);
  add('goldstore',13,6,4);add('foodstore',7,13,3);add('cannon',14,12);
  add('archer',2,7);add('academy',13,1,4);add('spire',11,15);
  for(let n=5;n<15;n++)add('wall',Math.min(10,n),18+Math.max(0,n-10),1+n%4,'wall-'+n);
  add('wall',1,20,2,'isolated');
  return {version:1,layoutVersion:2,xp:140,gold:326,berries:158,buildings,
    dragons:[{id:'fire',species:0,level:6},{id:'ice',species:1,level:8}],book:[0,1],
    egg:null,quest:0,marks:{},campaign:{},waves:0,bosses:0,arenas:0,
    settings:{sound:false},pending:null,deliveries:[]};
}
async function until(check,message){
  for(let n=0;n<110;n++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,65));}
  assert.fail(message);
}
const coords=(rows,id)=>rows?.find(row=>row[0]===id)?.slice(1);
async function check(browser,mobile){
  const width=mobile?390:1366,height=mobile?844:900;
  const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile,serviceWorkers:'block',reducedMotion:'reduce'});
  try{
    const p=profiles[0],server=fixtures(),path='data/users/'+p.id+'/oplot/saves/main';
    const stamp=Date.now(),original=settlement(stamp),grid=layout.gridAtLevel(3);
    const shift=Math.floor((grid.width-20)/2);
    assert.ok(layout.valid(original.buildings,grid));
    server.docs.set(path,{rev:1,op:'editor-test',state:structuredClone(original)});
    await studyBackend(context,server);
    await context.addInitScript(code=>{if(window===top)localStorage.setItem('ph_code',code)},p.code);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.setFixedTime(new Date(stamp));
    const game=page.frameLocator('#oplot-game'),world=game.locator('#world'),editor=game.locator('#layout-editor');
    const button=(action,id)=>game.locator('[data-do="'+action+'"]'+(id?'[data-id="'+id+'"]':'')).filter({visible:true});
    const press=async(action,id)=>{const control=button(action,id);await (mobile?control.tap():control.click());};
    const open=async()=>{
      await page.goto(site.href,{waitUntil:'domcontentloaded'});
      await game.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
    };
    const start=async()=>{if(!await editor.isVisible())await press('edit');await editor.waitFor();};
    const head=()=>server.docs.get(path);
    const draft=()=>world.evaluate((_,{id,shift})=>{
      const raw=localStorage.getItem('phagi.oplot.v1.user.'+id+'.layout-draft-v2');
      return raw?JSON.parse(raw).rows.map(([b,x,y])=>[b,x===null?null:x-shift,y===null?null:y-shift]):null;
    },{id:p.id,shift});
    async function point(x,y){
      await world.scrollIntoViewIfNeeded();
      const rect=await world.boundingBox();
      const pos=await world.evaluate((canvas,data)=>{
        const w=canvas.clientWidth,h=canvas.clientHeight,zoom=parseInt(document.querySelector('[data-camera=fit]').textContent)/100;
        const [,cols,rows]=document.querySelector('#island-area').textContent.match(/(\d+) × (\d+)/);
        const p=Art.point(data.x,data.y,w,h,Math.max(Number(cols),Number(rows)));return {x:w/2+(p.x-w/2)*zoom,y:h/2+(p.y-h/2)*zoom};
      },{x:x+shift,y:y+shift});
      return {x:rect.x+pos.x,y:rect.y+pos.y};
    }
    async function tile(x,y){
      const pos=await point(x,y);
      if(mobile)await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y);
    }
    async function drag(x,y,toX,toY){
      const a=await point(x,y),b=await point(toX,toY);
      await page.mouse.move(a.x,a.y);await page.mouse.down();
      await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();
    }
    async function apply(){
      const before=head().rev;await press('layoutapply');await editor.waitFor({state:'hidden'});
      await until(()=>head().rev>before,'Applied positions must reach the private cloud save');
      assert.ok(layout.valid(head().state.buildings,grid));
      for(const field of ['gold','berries','xp','dragons','book'])assert.deepEqual(head().state[field],original[field]);
      assert.deepEqual(head().state.buildings.map(b=>[b.id,b.type,b.level]),original.buildings.map(b=>[b.id,b.type,b.level]));
    }
    await open();await start();
    if(mobile){
      const controls=await editor.locator('.layout-actions:not([hidden]) button').evaluateAll(items=>items.map(b=>{
        const r=b.getBoundingClientRect();return {x:r.left,right:r.right,width:innerWidth,height:r.height};
      }));
      assert.ok(controls.length>=5&&controls.every(r=>r.x>=0&&r.right<=r.width+1&&r.height>=32),
        'Editing actions should remain inside the 390 px touchscreen');
    }
    if(!mobile&&process.env.PHAGI_EDITOR_SCREENSHOT){
      const full=game.locator('#island-full');
      if(await full.isVisible()&&await full.getAttribute('aria-label')==='На весь экран')await full.click();
      await editor.waitFor();await game.locator('[data-camera=in]').click();await game.locator('[data-camera=in]').click();
      await tile(15,13);await press('layoutstash');
      await press('layoutreserve','cannon');
      const preview=await point(16,15);await page.mouse.move(preview.x,preview.y);
      await world.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.screenshot({path:process.env.PHAGI_EDITOR_SCREENSHOT,animations:'disabled'});
      await game.locator('[data-camera=fit]').click();await press('layoutcancel');await start();
    }
    const originalWalls=original.buildings.filter(b=>b.id.startsWith('wall-'));
    const groupButton=button('layoutwallplace'),groupCount=game.locator('#layout-wall-count');
    const groupStatus=game.locator('#layout-selection');
    await press('layoutwalls');
    if(mobile){
      const controls=await game.locator('#layout-wall-tools button,#layout-wall-tools select').evaluateAll(items=>items.map(item=>{
        const box=item.getBoundingClientRect();return {label:item.textContent,x:box.left,right:box.right,height:box.height,width:innerWidth};
      }));
      for(const c of controls)assert.ok(c.height>=32&&c.x>=0&&c.right<=c.width+1,'Group action must fit on phone '+JSON.stringify(c));
    }
    await tile(1,20);assert.match(await groupStatus.innerText(),/1 из 5/);
    await tile(5,18);assert.match(await groupStatus.innerText(),/Выбрано 5 секций/);
    await groupCount.selectOption('7');assert.match(await groupStatus.innerText(),/Выбрано 7 секций/);
    await groupCount.selectOption('10');await tile(8,8);
    assert.ok(await groupButton.isDisabled());assert.match(await groupStatus.innerText(),/занято/);
    await tile(grid.width-1-shift,14-shift);assert.ok(await groupButton.isDisabled());assert.match(await groupStatus.innerText(),/край/);
    await press('layoutwallcancel');assert.equal(await draft(),null);assert.deepEqual(head().state,original);
    if(mobile&&browser.browserType().name()==='chromium'){
      await press('layoutwalls');await tile(5,18);
      const client=await context.newCDPSession(page),a=await point(7,18),b=await point(7,21);
      try{
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
        for(let i=1;i<=5;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/5,y:a.y+(b.y-a.y)*i/5}]});
        await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }finally{await client.detach()}
      await press('layoutwallplace');
      const screenMove=await draft();
      assert.deepEqual(coords(screenMove,'wall-5'),[5,21],'Dragging a middle section preserves the touch offset of the group');
      assert.deepEqual(coords(screenMove,'wall-9'),[9,21]);
      assert.deepEqual(coords(screenMove,'wall-10'),[10,18]);
      await press('layoutundo');assert.equal(await draft(),null);
    }
    async function moveSection(x,y,by){
      await press('layoutwalls');await groupCount.selectOption('10');await tile(x,y);
      if(!mobile)await drag(x+2,y,x+2+by,y);else await tile(x+by,y);
      assert.ok(await groupButton.isEnabled(),'A section can move across cells it currently occupies');
      await press('layoutwallplace');
    }
    await moveSection(5,18,1);
    const shifted=await draft();
    for(const b of originalWalls)assert.deepEqual(coords(shifted,b.id),[b.x+1-shift,b.y-shift]);
    assert.deepEqual(head().state,original,'A group preview and local edit must not change the active defense');
    await press('layoutundo');assert.equal(await draft(),null,'A single undo restores the entire section');
    await moveSection(5,18,1);await open();await start();
    assert.deepEqual(await draft(),shifted,'A grouped move survives reopening the local editor');
    await apply();
    const translated=originalWalls.map(b=>({...b,x:b.x+1}));
    assert.deepEqual(head().state.buildings.filter(b=>b.id.startsWith('wall-')),translated);
    const other=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    try{
      await studyBackend(other,server);
      await other.addInitScript(code=>{if(window===top)localStorage.setItem('ph_code',code)},p.code);
      const remote=await other.newPage();await remote.goto(site.href,{waitUntil:'domcontentloaded'});
      const island=remote.frameLocator('#oplot-game');await island.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
      const walls=await island.locator('#world').evaluate((_,id)=>JSON.parse(localStorage.getItem('phagi.oplot.v1.user.'+id+'.sync2')).state.buildings.filter(b=>b.id.startsWith('wall-')),p.id);
      assert.deepEqual(walls,translated,'All ten levels, corners and coordinates reach an independent device');
    }finally{await other.close()}
    await start();await moveSection(6,18,-1);await apply();assert.deepEqual(head().state,original);
    await start();
    await press('layoutclear');
    const cleared=await draft();
    assert.equal(cleared.length,original.buildings.length);assert.ok(cleared.every(row=>row[1]===null&&row[2]===null));
    assert.ok(await button('layoutreserve','keep').isVisible());assert.ok(await button('layoutreserve','mine').isVisible());
    assert.ok(await button('layoutapply').isDisabled(),'An arrangement with the keep still in reserve cannot be applied');
    assert.deepEqual(head().state,original,'A live editor draft must leave the cloud untouched');
    await press('layoutundo');assert.equal(await button('layoutreserve').count(),0);
    assert.ok(await button('layoutundo').isDisabled(),'One undo should restore the entire clear operation');

    // Pick the mine by its far corner. It occupies [2..4]×[2..4].
    if(mobile){await tile(4,4);await tile(1,1);}
    else await drag(4,4,5,5);
    await until(async()=>JSON.stringify(coords(await draft(),'mine'))!=='[2,2]'&&!!coords(await draft(),'mine'),'Drag or tap did not relocate the mine from its far corner');
    const changed=await draft(),moved=coords(changed,'mine');
    assert.ok(Number.isInteger(moved[0])&&Number.isInteger(moved[1]));
    await tile(moved[0],moved[1]);
    if(mobile){
      for(const viewport of [{width:844,height:390},{width,height}]){
        await page.setViewportSize(viewport);
        await world.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.deepEqual(await draft(),changed,'Rotation retains the local draft');
        assert.match(await game.locator('#layout-selection').innerText(),/Золотая шахта/,'Rotation retains the selected mine');
      }
    }
    await tile(9,9);
    assert.deepEqual(coords(await draft(),'mine'),moved,'Dropping the mine onto the keep must leave its prior position intact');
    await tile(18,4);
    await until(async()=>coords(await draft(),'mine')?.[0]>12,'An invalid drop must permit a second attempt');
    await press('layoutundo');assert.deepEqual(coords(await draft(),'mine'),moved,'Undo must move only one step back');
    assert.deepEqual(head().state,original);
    await open();await start();
    assert.deepEqual(coords(await draft(),'mine'),moved,'A local draft should survive reload');
    await press('layoutcancel');await editor.waitFor({state:'hidden'});
    assert.deepEqual(head().state,original);assert.equal(await draft(),null,'Cancelling must discard the complete draft');

    await start();await tile(4,4);await press('layoutstash');
    assert.ok(await button('layoutreserve','mine').isVisible());
    await apply();
    const findMine=()=>head().state.buildings.find(b=>b.id==='mine');
    const parked=findMine();assert.equal(parked.stowed,true);assert.equal(parked.x,null);assert.equal(parked.y,null);
    assert.equal(parked.pausedStock,Math.floor(12*4*2/5),'Stored production must retain the exact uncollected gold');
    await page.clock.setFixedTime(new Date(stamp+3600000));
    await open();await start();await press('layoutclear');
    await press('layoutreserve','keep');await tile(9,9);
    await until(async()=>Number.isInteger(coords(await draft(),'keep')?.[0]),'The keep did not return to the island');
    assert.ok(await button('layoutapply').isEnabled());
    await press('layoutreserve','mine');await tile(3,3);
    await until(async()=>Number.isInteger(coords(await draft(),'mine')?.[0]),'The editor did not accept a second building without leaving');
    await apply();
    const resumed=findMine(),now=stamp+3600000;
    assert.ok(!resumed.stowed&&!('pausedStock' in resumed));
    const stockAt=t=>Math.floor((t-resumed.since)*4*resumed.level/5000);
    assert.equal(stockAt(now),parked.pausedStock,'A reserved mine must not earn gold while away');
    assert.ok(stockAt(now+5000)>parked.pausedStock,'A replaced mine must resume production');
    assert.equal(head().state.buildings.filter(b=>!b.stowed).length,2);
    await open();await start();
    for(const id of ['farm','den','archer','cannon'])assert.ok(await button('layoutreserve',id).isVisible(),'Saved reserve must survive a fresh load');
    assert.equal(await button('layoutreserve','keep').count(),0);assert.equal(await button('layoutreserve','mine').count(),0);
    if(!mobile){
      const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
      try{
        await studyBackend(phone,server);
        await phone.addInitScript(code=>{if(window===top)localStorage.setItem('ph_code',code)},p.code);
        const remote=await phone.newPage();remote.on('pageerror',e=>errors.push(e.message));
        await remote.goto(site.href,{waitUntil:'domcontentloaded'});
        const island=remote.frameLocator('#oplot-game');
        await island.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
        await island.locator('[data-do="edit"]').tap();
        await island.locator('[data-do="layoutreserve"][data-id="farm"]').waitFor();
        assert.equal(await island.locator('[data-do="layoutreserve"][data-id="mine"]').count(),0);
      }finally{await phone.close();}
    }
    // The building is on the map when the first device starts the move.
    // Before it chooses a tile, another device puts that same mine in reserve.
    await press('layoutcancel');await press('tab','build');await press('structure','mine');await press('move','mine');
    const previous=head(),parkedRemotely={...previous,rev:previous.rev+1,op:'other-device-parked-mine',
      state:{...previous.state,buildings:previous.state.buildings.map(b=>b.id==='mine'?{...b,stowed:true,x:null,y:null,pausedStock:11}:b)}};
    server.docs.set(path,parkedRemotely);
    const journal=()=>world.evaluate((_,id)=>JSON.parse(localStorage.getItem('phagi.oplot.v1.user.'+id+'.sync2')),p.id);
    await world.evaluate(()=>window.dispatchEvent(new Event('online')));
    await until(async()=>(await journal()).base.op===parkedRemotely.op,'Remote reserve move should reach the first device');
    await tile(5,14);
    assert.deepEqual((await journal()).state.buildings,parkedRemotely.state.buildings,
      'An obsolete move must preserve the remote positions and paused production');
    assert.ok(layout.valid((await journal()).state.buildings,grid));
    assert.ok(await button('edit').isVisible(),'Remote relocation cancelled the pending map move');
    await start();await press('layoutreserve','farm');await tile(12,16);
    const earlierDraft=await draft();assert.ok(Number.isInteger(coords(earlierDraft,'farm')[0]));
    await press('layoutreserve','cannon');
    const expanded={...parkedRemotely,rev:parkedRemotely.rev+1,op:'other-device-profile-xp',
      state:{...parkedRemotely.state,xp:35*3**2}};
    const nextGrid=layout.gridAtLevel(4),towerX=nextGrid.width-layout.size('cannon');
    server.docs.set(path,expanded);await world.evaluate(()=>window.dispatchEvent(new Event('online')));
    await game.locator('#island-area').filter({hasText:nextGrid.width+' × '+nextGrid.height}).waitFor();
    await tile(towerX+1-shift,14-shift);
    assert.deepEqual(coords(await draft(),'cannon'),[towerX-shift,13-shift],'The tower fits in the strip unlocked by the other device');
    await press('layoutundo');assert.deepEqual(await draft(),earlierDraft,'Expansion must retain earlier edits and their undo history');
    await press('layoutreserve','cannon');await tile(towerX+1-shift,14-shift);
    await press('layoutapply');await until(()=>head().rev>expanded.rev,'The live expanded layout should reach the cloud');
    assert.equal(head().state.xp,expanded.state.xp);
    assert.ok(layout.valid(head().state.buildings,nextGrid));
    assert.equal(head().state.buildings.find(b=>b.id==='cannon').x,towerX);
    // A saved wall on the former southern boundary keeps two extra rows. The
    // renderer and pointer projection must use the taller axis at every zoom.
    const bottom=grid.height+1,wallX=13,edgeWalls=Array.from({length:5},(_,i)=>({
      type:'wall',x:wallX+i,y:bottom,id:'south-'+i,level:i+1,since:stamp
    }));
    const rectState={...original,buildings:[structuredClone(original.buildings[0]),...edgeWalls]};
    const tall=layout.gridAtLevel(3,2,rectState.buildings);
    assert.ok(tall.height>tall.width&&layout.valid(rectState.buildings,tall));
    server.docs.set(path,{rev:head().rev+1,op:'legacy-southern-edge',state:rectState});
    await open();await game.locator('#island-area').filter({hasText:tall.width+' × '+tall.height}).waitFor();
    const plus=game.locator('[data-camera="in"]'),fit=game.locator('[data-camera="fit"]'),modal=game.locator('#dialog');
    await plus.click();
    if(mobile)await page.setViewportSize({width:844,height:390});
    await tile(wallX+2-shift,bottom-shift);
    assert.equal(await modal.locator('#dt').innerText(),'Магическая стена','Zoomed far-edge wall hit opens its structure');
    assert.ok(!await editor.isVisible());await press('close');
    if(mobile)await page.setViewportSize({width,height});
    await fit.click();await start();await press('layoutwalls');
    if(mobile&&browser.browserType().name()==='chromium'){
      await tile(wallX-shift,bottom-shift);await groupStatus.filter({hasText:'Выбрано 5 секций'}).waitFor();
      await world.scrollIntoViewIfNeeded();const box=await world.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
      const cdp=await context.newCDPSession(page);
      const fingers=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],i)=>({id:i+1,x,y}))});
      try{
        await fingers('touchStart',[[x-18,y],[x+18,y]]);
        for(const spread of [23,28,33,36])await fingers('touchMove',[[x-spread,y],[x+spread,y]]);
        await fingers('touchEnd',[]);await fit.filter({hasText:'200%'}).waitFor();
        await fingers('touchStart',[[x,y]]);await fingers('touchMove',[[x+30,y+20]]);await fingers('touchEnd',[]);
        assert.ok(await groupButton.isDisabled());assert.equal(await draft(),null);
        assert.ok(!await modal.isVisible()&&await editor.isVisible(),'Camera gestures leave the selected section and editor intact');
      }finally{await cdp.detach()}
      await fit.click();await press('layoutwallcancel');await press('layoutwalls');
    }
    await world.focus();await world.press('Enter');
    await groupStatus.filter({hasText:'Выбрано 5 секций'}).waitFor({timeout:2400});
    await world.press('ArrowRight');await world.press('Enter');
    assert.ok(await groupButton.isEnabled(),'A keyboard step is relative to the selected wall anchor');
    assert.ok(!await modal.isVisible()&&await editor.isVisible());assert.equal(await draft(),null);
    const full=game.locator('#island-full');await full.click();await editor.waitFor();
    await world.focus();await world.press('Escape');
    await button('layoutwalls').waitFor();
    assert.ok(await editor.isVisible()&&await button('layoutwalls').isVisible(),'Escape cancels the group without closing the editor');
    assert.equal(await full.getAttribute('aria-pressed'),'true','Cancelling the group preserves the current fullscreen view');
    await full.click();await press('layoutcancel');
    const clockNow=stamp+3600000;
    const industries=[
      ['castle','keep',3],['mine-ready','mine',3,12500],['mine-dry','mine',3,5000],['mine-small','mine',2,500000],
      ['farm-b','farm',2,10000],['farm-a','farm',2,10000],
      ['treasury-z','goldstore',2],['treasury-small','goldstore',1],['treasury-a','goldstore',2],
      ['barn-small','foodstore',1],['barn-large','foodstore',2],['home','home',2]
    ];
    const legacyIndustry={...original,gold:4498,berries:1890,buildings:industries.map(([id,type,level,age],i)=>
      ({id,type,level,x:2+i%5,y:2+Math.floor(i/5),since:clockNow-(age||0)}))};
    delete legacyIndustry.layoutVersion;
    server.docs.set(path,{rev:head().rev+1,op:'legacy-economic-limits',state:legacyIndustry});
    await open();await start();
    const beforeIndustry=structuredClone(head().state);
    assert.equal(beforeIndustry.layoutVersion,2,'An old single-tile save is migrated before editing');
    const cleanup=button('layoutindustry'),storageCaps=state=>world.evaluate((_,s)=>[stockLimit(s,'gold'),stockLimit(s,'berries')],state);
    assert.deepEqual(await storageCaps(beforeIndustry),[4500,1900]);
    assert.match(await cleanup.innerText(),/6$/);
    assert.match(await game.locator('#layout-industry-note').innerText(),/вместимость складов сохранятся/);
    const small=beforeIndustry.buildings.find(b=>b.id==='mine-small');
    await tile(small.x+1-shift,small.y+1-shift);await press('layoutstash');
    const previousDraft=await draft();assert.match(await cleanup.innerText(),/5$/);
    await press('layoutindustry');assert.ok(!await cleanup.isVisible());
    assert.deepEqual(head().state,beforeIndustry);
    await press('layoutundo');assert.deepEqual(await draft(),previousDraft,'One undo restores the whole cleanup, keeping earlier moves');
    await press('layoutundo');assert.equal(await draft(),null);assert.match(await cleanup.innerText(),/6$/);
    await press('layoutindustry');await press('layoutapply');
    await until(()=>head().state.buildings.filter(b=>b.stowed).length===6,'Industrial reserves should persist to the profile');
    const savedIndustry=head().state,survivors=new Set(['castle','mine-ready','farm-a','treasury-a','barn-large','home']);
    for(const [i,b] of savedIndustry.buildings.entries()){
      const old=beforeIndustry.buildings[i];
      if(survivors.has(b.id))assert.deepEqual(b,old);
      else assert.deepEqual(b,{...old,stowed:true,x:null,y:null,
        ...({'mine-dry':{pausedStock:12},'mine-small':{pausedStock:180},'farm-b':{pausedStock:12}}[b.id]||{})});
    }
    assert.deepEqual(await storageCaps(savedIndustry),[4500,1900]);
    for(const field of ['gold','berries','xp','dragons'])assert.deepEqual(savedIndustry[field],beforeIndustry[field]);
    await open();await start();assert.ok(!await cleanup.isVisible());
    assert.deepEqual(await storageCaps(head().state),[4500,1900],'Reserve warehouses keep their capacity after reload');
    assert.deepEqual(await world.evaluate((_,{state,now})=>state.buildings.filter(b=>b.stowed&&['mine','farm'].includes(b.type)).map(b=>stored(b,now)),
      {state:head().state,now:clockNow+3600000}),[12,180,12],'Reserved producers retain their harvest without accumulating more');
    assert.deepEqual(errors,[]);
    console.log('PASS editor, group wall moves, collision previews, cloud sync, remote expansion, undo and production',mobile?'390px touch':'1366px drag');
  }finally{await context.close();}
}
(async()=>{
  const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try{await check(browser,true);await check(browser,false);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
