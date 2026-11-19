// Chromium CDP supplies genuine multi-touch input to the same iframe used in Phagi.
const assert=require('node:assert/strict');
const {chromium}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const {profiles,studyBackend}=require('./oplot-game.cjs');
const site=new URL(process.argv[2]||'http://127.0.0.1:18748/phagi/');
site.searchParams.set('oplot','1');

async function check(browser,mobile){
 const width=mobile?390:1180,height=mobile?844:820;
 const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
 try{
  await studyBackend(context);
  await context.addInitScript(({code,mobile})=>{
   if(window===top)localStorage.setItem('ph_code',code);
   else if(mobile)Object.defineProperty(document,'fullscreenEnabled',{value:false});
  },{code:profiles[0].code,mobile});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.goto(site.href,{waitUntil:'domcontentloaded'});
  const frameTag=page.locator('#oplot-game'),f=page.frameLocator('#oplot-game');
  const world=f.locator('#world'),toggle=f.locator('#island-full');
  const zoom=f.getByRole('group',{name:'Масштаб острова'});
  const plus=zoom.getByRole('button',{name:'Приблизить'}),minus=zoom.getByRole('button',{name:'Отдалить'});
  const fit=zoom.getByRole('button',{name:'Показать весь остров'});
  const overview=f.getByRole('button',{name:/Мини-карта острова/});
  await f.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
  assert.match(await frameTag.getAttribute('allow'),/fullscreen/);
  assert.ok(await frameTag.evaluate(el=>el.allowFullscreen));
  assert.equal(await toggle.getAttribute('aria-label'),'На весь экран');
  assert.equal(await minus.isDisabled(),true);
  if(mobile)for(const b of [plus,minus,fit,toggle]){
   const rect=await b.boundingBox();assert.ok(rect.width>=44&&rect.height>=44,'Touch controls are at least 44×44 CSS pixels');
  }
  const cdp=mobile?await context.newCDPSession(page):null;
  const touches=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id:id+1}))});
  async function checkMobileRow(){
   const rectangles=await f.locator('.mapfoot [data-do],.map-view button').evaluateAll(controls=>controls.map(button=>{
    const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {label:button.textContent,x:r.left,right:r.right,top:r.top,bottom:r.bottom,
      reachable:!!hit&&button.contains(hit)&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
   }));
   assert.equal(rectangles.length,5,'Build, collect, zoom out, fit, zoom in');
   for(const [i,b] of rectangles.entries()){
    assert.ok(b.reachable,'Mobile camera control is reachable: '+b.label);
    for(const a of rectangles.slice(0,i))assert.ok(a.right<=b.x+1||b.right<=a.x+1||a.bottom<=b.top+1||b.bottom<=a.top+1,'Overlapping controls: '+a.label+' / '+b.label);
   }
  }
  async function gesturePinch(){
   await world.scrollIntoViewIfNeeded();
   const box=await world.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
   await touches('touchStart',[[x-26,y],[x+26,y]]);
   for(const spread of [31,38,46,52])await touches('touchMove',[[x-spread,y],[x+spread,y]]);
   await touches('touchEnd',[]);
   await fit.filter({hasText:'200%'}).waitFor();
   assert.equal(await f.locator('#dialog').isVisible(),false,'Pinch must not select a building');
   await fit.click();
  }
  if(mobile)await gesturePinch();
  async function wide(on){
   await f.locator(on?'body.island-wide':'body:not(.island-wide)').waitFor();
   assert.equal(await toggle.getAttribute('aria-pressed'),String(on));
   assert.equal(await toggle.getAttribute('aria-label'),on?'Свернуть остров':'На весь экран');
   if(on){
    const gaps=await world.evaluate(el=>{const b=el.getBoundingClientRect();return [b.left,b.top,innerWidth-b.right,innerHeight-b.bottom]});
    assert.ok(gaps.every(n=>Math.abs(n)<2),'Expanded map covers the viewport '+gaps);
   }
  }
  await toggle.click();await wide(true);
  if(mobile){
   assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
   await gesturePinch();
   await checkMobileRow();
   await page.setViewportSize({width:320,height:740});await checkMobileRow();
   await page.setViewportSize({width,height});
  }else await page.waitForFunction(()=>document.fullscreenElement?.id==='oplot-game');
  const build=f.getByRole('button',{name:'Строить',exact:true});
  await build.click();
  await f.locator('#dialog[open] [data-do="construct"][data-id="mine"]').click();
  await wide(true);await f.locator('#mapnote').filter({hasText:/Строительство/}).waitFor();
  await f.locator('[data-do="cancelplace"]').click();
  await plus.click();assert.equal(await overview.isVisible(),false);
  await plus.click();await overview.waitFor();
  const miniature=overview.locator('canvas'),map=await overview.boundingBox();
  const snapshot=()=>miniature.evaluate(c=>c.toDataURL());
  const centered=await snapshot();
  await overview.click({position:{x:map.width*.78,y:map.height*.48}});
  assert.notEqual(await snapshot(),centered,'Tapping the mini-map moves its visible area');
  await overview.press('Enter');assert.equal(await snapshot(),centered,'Enter centers the mini-map');
  await fit.click();assert.equal(await overview.isVisible(),false);
  for(let i=0;i<5;i++)await (mobile?plus.tap():plus.click());
  assert.equal(await fit.textContent(),'400%');assert.ok(await plus.isDisabled());
  for(let i=0;i<5;i++)await (mobile?minus.tap():minus.click());
  assert.equal(await fit.textContent(),'100%');assert.ok(await minus.isDisabled());
  await world.press('+');assert.equal(await fit.textContent(),'135%');
  await world.press('0');assert.equal(await fit.textContent(),'100%');
  // Use the citadel's map cell, then pan and select it at its
  // transformed screen position. A mismatched hit-test opens a different panel.
  await plus.click();
  const box=await world.boundingBox();
  const spot=await world.evaluate(c=>Art.point(17,17,c.clientWidth,c.clientHeight,35));
  const x=box.x+box.width/2,y=box.y+box.height/2,dx=mobile?38:90,dy=mobile?23:40;
  if(mobile){
   await touches('touchStart',[[x,y]]);await touches('touchMove',[[x+dx,y+dy]]);await touches('touchEnd',[]);
  }else{
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy);await page.mouse.up();
  }
  assert.equal(await f.locator('#dialog').isVisible(),false,'Panning must not open a building');
  const targetX=x+(spot.x-box.width/2)*1.35+dx,targetY=y+(spot.y-box.height/2)*1.35+dy;
  if(mobile)await page.touchscreen.tap(targetX,targetY);else await page.mouse.click(targetX,targetY);
  await f.locator('#dialog[open]').getByRole('heading',{name:'Цитадель',exact:true}).waitFor();
  await f.locator('#dialog [data-do="close"]').click();
  await fit.click();
  if(mobile){
   await page.setViewportSize({width:844,height:390});await wide(true);
   await gesturePinch();
  }
  await toggle.click();await wide(false);
  assert.ok(await toggle.evaluate(b=>document.activeElement===b),'Focus returns to fullscreen control');
  await toggle.press('Enter');await wide(true);await page.keyboard.press('Escape');await wide(false);
  console.log('PASS embedded camera, zoom limits, pan and hit test, keyboard and fullscreen',mobile?'390px touch, pinch, CSS fallback and landscape':'1180px native fullscreen');
 }finally{await context.close()}
}
(async()=>{const browser=await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
 try{await check(browser,false);await check(browser,true)}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
