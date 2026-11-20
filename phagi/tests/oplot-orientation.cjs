// Actual viewport turns inside the Phagi iframe with a private test profile.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,webkit}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const {studyBackend,profiles}=require('./oplot-game.cjs');
const entry=new URL(process.argv[2]||'http://127.0.0.1:18748/phagi/');
entry.searchParams.set('oplot','1');
const report={day:'2026-11-20',wave:1,stars:1,goldLost:12,berriesLost:4,replay:{v:1,duration:8,
 buildings:[{id:'castle',type:'keep',x:4,y:4,level:1,hp:100}],
 attackers:[{id:'a',species:0,level:2,x:0,y:3,hp:20}],defenders:[],
 events:[{t:1,kind:'move',id:'a',target:'a',from:[0,3],to:[1,3],text:'Налётчик наступает'},
 {t:4,kind:'move',id:'a',target:'a',from:[1,3],to:[2,3],text:'Налётчик у цитадели'}]}};
async function run(browser,tablet){
 const portrait=tablet?[768,1024]:[390,844],landscape=tablet?[1024,768]:[844,390];
 const context=await browser.newContext({viewport:{width:portrait[0],height:portrait[1]},isMobile:true,hasTouch:true,
  deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  const server=await studyBackend(context);
  await context.route('**/rpc/ph_oplot_raids',r=>r.fulfill({json:[report]}));
  await context.addInitScript(id=>{if(window===top)localStorage.setItem('ph_code',id)},profiles[0].code);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const f=page.frameLocator('#oplot-game'),body=f.locator('body'),world=f.locator('#world'),dlg=f.locator('#dialog');
  await page.goto(entry.href,{waitUntil:'domcontentloaded'});
  await f.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
  const originalDoc=()=>server.docs.get('data/users/'+profiles[0].id+'/oplot/saves/main');
  const original=structuredClone(originalDoc().state);
  const cdp=browser.browserType().name()==='chromium'&&!tablet?await context.newCDPSession(page):null;
  const photo=async name=>{
   if(process.env.PHAGI_ORIENTATION_SHOTS&&cdp)await page.screenshot({path:path.join(process.env.PHAGI_ORIENTATION_SHOTS,'oplot-'+name+'.png')});
  };
  async function rotate(pair){
   await page.setViewportSize({width:pair[0],height:pair[1]});
   if(cdp)await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:pair[0]>pair[1]?{top:0,left:36,right:18,bottom:9}:{top:20,left:0,right:0,bottom:13}});
   await body.evaluate(async(_,size)=>{
    for(let i=0;i<60;i++){if(Math.abs(innerWidth-size[0])<=1&&Math.abs(innerHeight-size[1])<=1)break;await new Promise(requestAnimationFrame);}
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(Math.abs(innerWidth-size[0])>1||Math.abs(innerHeight-size[1])>1)throw Error('Iframe viewport: '+innerWidth+'×'+innerHeight+', expected '+size.join('×'));
   },pair);
   assert.ok(await body.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Turn introduced horizontal page scrolling');
  }
  async function usable(locator,description){
   const view=await locator.evaluate(el=>{
    const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,over=document.elementFromPoint(x,y);
    return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight,hit:!!over&&el.contains(over)};
   });
   assert.ok(view.x>=-1&&view.y>=-1&&view.right<=view.w+1&&view.bottom<=view.h+1&&view.hit,description+' '+JSON.stringify(view));
  }
  async function tap(action,id){
   await f.locator('[data-do="'+action+'"]'+(id?'[data-id="'+id+'"]':'')).filter({visible:true}).first().tap();
  }
  async function mapTap(x,y){
   const p=await world.evaluate((el,{x,y})=>Art.point(x,y,el.clientWidth,el.clientHeight,OplotLayout.gridAtLevel(1).width),{x,y});
   await world.tap({position:p});
  }
  await tap('tab','build');
  await rotate(landscape);await usable(dlg.locator('.close'),'Close workshop after turning');
  const buy=dlg.locator('[data-do=construct][data-id=mine]');
  if(!tablet){await rotate([568,320]);await usable(buy,'Primary workshop purchase on the shortest phone');await photo('landscape-workshop');}
  await buy.tap();
  await rotate(portrait);assert.match(await f.locator('#mapnote').innerText(),/Строительство/);
  await mapTap(7,9);
  await f.locator('#maptools [data-do=edit]').waitFor();
  assert.ok(await world.evaluate(()=>document.querySelector('#island-area').textContent.includes('33 × 33')));
  // The draft and the active reserve selection must persist through both directions.
  await f.locator('#island-full').tap();await tap('edit');await tap('layoutclear');await tap('layoutreserve','b0');
  const stock=f.locator('#layout-stock [data-id=b0]');
  assert.equal(await stock.getAttribute('aria-pressed'),'true');
  for(const size of tablet?[landscape]:[[568,320],[640,360],[844,390],[932,430]]){
   await rotate(size);
   assert.equal(await stock.getAttribute('aria-pressed'),'true');
   await usable(f.locator('#island-full'),'Fullscreen exit after turning');
   await usable(f.locator('[data-camera=in]'),'Camera after turning');
   const mapBox=await world.boundingBox(),tools=await f.locator('#layout-editor').boundingBox();
   if(size[1]<=430){assert.ok(mapBox.height>=size[1]*.8,'Editor should share height with the field');
    assert.ok(mapBox.x+mapBox.width<=tools.x+2,'Editor and field overlap');
    if(cdp){assert.ok(mapBox.x>=35&&tools.x+tools.width<=size[0]-17,'Map and editor must clear both physical cutouts');}
    if(size[1]===320)await photo('landscape-editor');}
   await f.locator('[data-do=layoutapply]').scrollIntoViewIfNeeded();
   await usable(f.locator('[data-do=layoutapply]'),'Save action after turning');
  }
  await rotate(portrait);await mapTap(17,17);assert.equal(await f.locator('[data-do=layoutapply]').isDisabled(),false);
  await tap('layoutcancel');await f.locator('#island-full').tap();
  // Real play buttons, counters, selected targets and the active battle stay in the same game instance.
  await tap('tab','battle');await tap('start');
  const stats=f.locator('.combat .stats'),deploy=f.locator('[data-do=combat][data-id^="deploy|"]').first();
  const full=f.locator('#island-full');
  async function fillsViewport(container){
   const fills=await container.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2});
   assert.ok(fills,'Fullscreen uses the entire phone viewport');
  }
  await stats.filter({hasText:/Высажено 0/}).waitFor();await full.tap();await fillsViewport(f.locator('.play'));
  await usable(full,'Exit fullscreen attack');await rotate(landscape);
  await usable(deploy,'Deploy dragon in fullscreen landscape');await deploy.tap();
  await stats.filter({hasText:/Высажено 1/}).waitFor();
  if(!tablet)await photo('landscape-battle');await rotate(portrait);
  await full.tap();assert.equal(await full.getAttribute('aria-pressed'),'false');
  await stats.filter({hasText:/Высажено 1/}).waitFor();await tap('retreat');await tap('abandon');
  await tap('tab','battle');await tap('mode','defense');await tap('start');
  await stats.filter({hasText:/Стойкость цитадели/}).waitFor();await full.tap();await rotate(tablet?landscape:[568,320]);
  await fillsViewport(f.locator('.play'));await usable(full,'Exit fullscreen defense');
  await world.tap({position:{x:100,y:125}});await usable(f.locator('.combat .actions button').first(),'Defense command');
  await tap('retreat');await tap('abandon');assert.equal(await full.getAttribute('aria-pressed'),'false');
  await f.getByRole('button',{name:'Отчёты о ночных набегах'}).tap();
  const night=f.locator('#night-report'),play=night.locator('[data-night-play]'),step=night.locator('[data-night-step]'),seek=night.locator('[data-night-seek]'),expand=night.locator('[data-night-full]');
  await step.tap();assert.equal(await seek.inputValue(),'1');await expand.tap();await fillsViewport(night);
  await usable(night.locator('canvas'),'Entire fullscreen replay');await usable(play,'Fullscreen replay play button');
  if(!tablet)await photo('landscape-archive');
  await step.tap();assert.equal(await seek.inputValue(),'4');
  await play.tap();await rotate(portrait);await fillsViewport(night);
  assert.equal(await play.innerText(),'Пауза');await play.tap();const pausedAt=await seek.inputValue();
  await expand.tap();assert.equal(await seek.inputValue(),pausedAt);await expand.tap();
  await night.getByRole('button',{name:'Закрыть отчёты'}).tap();
  await f.getByRole('button',{name:'Отчёты о ночных набегах'}).tap();await expand.waitFor();
  assert.equal(await expand.getAttribute('aria-pressed'),'false');await night.getByRole('button',{name:'Закрыть отчёты'}).tap();
  await tap('wallet');await rotate(landscape);await dlg.locator('[data-do=learn][data-id=cards]').tap();
  await page.locator('[data-act=deck][data-id=fixture-deck]').first().waitFor();
  await page.setViewportSize({width:portrait[0],height:portrait[1]});await page.locator('#nav [data-v=oplot]').tap();
  await f.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
  assert.ok(originalDoc().state.buildings.some(b=>b.type==='mine'));assert.equal(originalDoc().state.dragons.length,original.dragons.length);
  assert.deepEqual(errors,[]);
  console.log('PASS embedded map, build, editor selection, fullscreen raid, defense, replay and study across rotations',tablet?'768/1024 tablet':'320/360/390/430 landscape phones');
 }finally{await context.close()}
}
async function manualTurns(browser){
 const portrait={width:390,height:844},landscape={width:844,height:390};
 const context=await browser.newContext({viewport:portrait,isMobile:true,hasTouch:true,deviceScaleFactor:1,colorScheme:'dark',reducedMotion:'reduce',serviceWorkers:'block'});
 try{
  const server=await studyBackend(context),isChromium=browser.browserType().name()==='chromium';
  const clock=Date.now(),profile=profiles[0];
  server.docs.set('data/users/'+profile.id+'/oplot/saves/main',{rev:1,op:'orientation-fixture',state:{
   version:1,layoutVersion:2,xp:0,gold:220,berries:120,quest:0,marks:{},campaign:{},waves:0,bosses:0,arenas:0,settings:{sound:false},pending:null,deliveries:[],
   buildings:[{type:'keep',id:'castle',x:15,y:15,level:1,since:clock},{type:'mine',id:'mine',x:5,y:10,level:1,since:clock}],
   dragons:[{id:'dragon',species:0,level:1}],book:[0],egg:null}});
  const edges={portrait:[23,7,15,5],landscape:[3,14,6,38]},sides=['top','right','bottom','left'];
  await context.addInitScript(({code,simulate,edges})=>{
   if(window!==top)return;
   localStorage.setItem('ph_code',code);
   if(simulate)document.addEventListener('DOMContentLoaded',()=>{
    // Desktop WebKit supplies zero native insets. Exercise its real host remapping with a viewport fixture.
    const rule=values=>'body.oplot-open [data-sig="oplot-game"]{scroll-padding:'+values.map(n=>n+'px').join(' ')+'}';
    const sheet=document.createElement('style');sheet.textContent=rule(edges.portrait)+'@media (orientation:landscape){'+rule(edges.landscape)+'}';document.head.append(sheet);
   });
  },{code:profile.code,simulate:!isChromium,edges});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cdp=isChromium?await context.newCDPSession(page):null;
  const f=page.frameLocator('#oplot-game'),world=f.locator('#world'),dialog=f.locator('#dialog'),frame=page.locator('#oplot-game');
  const command=(action,id)=>f.locator('[data-do="'+action+'"]'+(id?'[data-id="'+id+'"]':'')).filter({visible:true}).first();
  let physical='portrait',turn='';
  async function changeScreen(name){
   physical=name;
   if(cdp)await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:Object.fromEntries(sides.map((s,i)=>[s,edges[name][i]]))});
   await page.setViewportSize(name==='portrait'?portrait:landscape);
  }
  async function checkFrame(mode){
   turn=mode==='auto'||mode===physical?'':mode==='landscape'?'right':'left';
   const screen=physical==='portrait'?portrait:landscape,w=turn?screen.height:screen.width,h=turn?screen.width:screen.height;
   const expected=edges[physical].map((_,i)=>edges[physical][(i+(turn==='right'?1:turn==='left'?3:0))%4]);
   await page.waitForFunction(({mode,turn,w,h,edges})=>{
    const f=document.getElementById('oplot-game'),inner=f?.contentWindow,root=f?.contentDocument?.documentElement;
    if(!f||!root||inner.innerWidth!==w||inner.innerHeight!==h||(f.parentNode.dataset.turn||'')!==turn||window.OplotHost?.orientationMode()!==mode)return false;
    const css=inner.getComputedStyle(root);
    return ['top','right','bottom','left'].every((s,i)=>parseFloat(css.getPropertyValue('--safe-'+s))===edges[i]);
   },{mode,turn,w,h,edges:expected},{timeout:6000});
   const r=await frame.boundingBox();
   assert.ok(Math.abs(r.x)<1&&Math.abs(r.y)<1&&Math.abs(r.width-screen.width)<1&&Math.abs(r.height-screen.height)<1,'The transformed iframe must fill the physical viewport');
   await world.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  // Canvas coordinates and control rectangles are logical. Dispatch a single real
  // touch to an independently calculated point on the physical outer screen.
  async function physicalTap(locator,localPoint){
   await locator.scrollIntoViewIfNeeded();
   const logical=await locator.evaluate((el,p)=>{
    const b=el.getBoundingClientRect();return {x:b.left+(p?.x??b.width/2),y:b.top+(p?.y??b.height/2)};
   },localPoint||null);
   const screen=physical==='portrait'?portrait:landscape;
   const p=turn==='right'?{x:screen.width-logical.y,y:logical.x}:turn==='left'?{x:logical.y,y:screen.height-logical.x}:logical;
   assert.ok(p.x>0&&p.y>0&&p.x<screen.width&&p.y<screen.height,'Touch landed outside the device: '+JSON.stringify(p));
   await page.touchscreen.tap(p.x,p.y);
  }
  async function tapMine(zoom=1){
   const p=await world.evaluate((c,z)=>{
    const w=c.clientWidth,h=c.clientHeight,p=Art.point(6,11,w,h,OplotLayout.gridAtLevel(1).width);
    return {x:w/2+(p.x-w/2)*z,y:h/2+(p.y-h/2)*z};
   },zoom);
   await physicalTap(world,p);
  }
  async function select(mode){
   await physicalTap(command('orientation',mode));await checkFrame(mode);
   assert.equal(await command('orientation',mode).getAttribute('aria-pressed'),'true');
  }
  async function ready(){await f.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();}
  await changeScreen('portrait');await page.goto(entry.href,{waitUntil:'domcontentloaded'});await ready();await checkFrame('auto');
  await physicalTap(command('settings'));await select('landscape');await physicalTap(dialog.locator('.close'));
  await tapMine();await dialog.getByRole('heading',{name:'Золотая шахта',exact:true}).waitFor();
  await physicalTap(dialog.locator('.close'));
  await page.reload({waitUntil:'domcontentloaded'});await ready();await checkFrame('landscape');
  await physicalTap(command('settings'));assert.equal(await command('orientation','landscape').getAttribute('aria-pressed'),'true');
  await physicalTap(dialog.locator('.close'));await physicalTap(f.locator('#island-full'));
  await f.locator('body.island-wide').waitFor();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);
  await physicalTap(f.locator('[data-camera=in]'));assert.equal(await f.locator('[data-camera=fit]').innerText(),'135%');
  await tapMine(1.35);await dialog.getByRole('heading',{name:'Золотая шахта',exact:true}).waitFor();await physicalTap(dialog.locator('.close'));
  await physicalTap(command('edit'));await tapMine(1.35);
  await f.locator('#layout-selection').filter({hasText:'Золотая шахта'}).waitFor();assert.equal(await command('layoutstash').isDisabled(),false);
  await physicalTap(command('layoutcancel'));await physicalTap(f.locator('#island-full'));
  await physicalTap(command('tab','battle'));await physicalTap(command('start'));await physicalTap(f.locator('#island-full'));
  assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);
  await physicalTap(command('combat','deploy|1'));await f.locator('.combat .stats').filter({hasText:/Высажено 1/}).waitFor();
  await physicalTap(f.locator('#island-full'));await physicalTap(command('retreat'));await physicalTap(command('abandon'));
  await changeScreen('landscape');await checkFrame('landscape');
  await physicalTap(command('settings'));await select('portrait');await physicalTap(dialog.locator('.close'));
  await physicalTap(f.locator('[data-camera=fit]'));await tapMine();
  await dialog.getByRole('heading',{name:'Золотая шахта',exact:true}).waitFor();await physicalTap(dialog.locator('.close'));
  await physicalTap(command('settings'));await select('auto');await physicalTap(dialog.locator('.close'));
  await physicalTap(f.locator('button.logo'));await frame.waitFor({state:'hidden'});
  await page.locator('#nav [data-v=oplot]').tap();await ready();await checkFrame('auto');
  assert.deepEqual(errors,[]);
  console.log('PASS manual landscape and portrait, physical-screen taps, four safe edges, persisted preference, fullscreen zoom, editor and return to Phagi',browser.browserType().name());
 }finally{await context.close()}
}

(async()=>{
 const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
 try{await manualTurns(browser);await run(browser,false);await run(browser,true)}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
