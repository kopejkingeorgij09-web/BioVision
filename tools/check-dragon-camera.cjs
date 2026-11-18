// DRAGON_GAME_URL may point to the published game. The workshop uses session storage.
const {chromium,webkit}=require('playwright-core');
const assert=require('node:assert/strict');
const base=process.env.DRAGON_GAME_URL||'http://127.0.0.1:8793/phagi/island/';
const baseline=process.argv.includes('--measure-only');
async function run(engine,phone){
 const browser=await engine.launch(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 try{
  const page=await browser.newPage({viewport:phone?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone,colorScheme:'dark'});
  await page.goto(new URL('?tour=1',base).href);await page.waitForSelector('.resident .rigged');
  await page.waitForTimeout(350);
  const viewport=page.locator('.world-window'),bounds=await viewport.boundingBox();
  const x=bounds.x+bounds.width*.51,y=bounds.y+bounds.height*.47;
  let metrics;
  if(!phone){
   const client=await page.context().newCDPSession(page);await client.send('Performance.enable');
   metrics=async()=>(await client.send('Performance.getMetrics')).metrics.find(m=>m.name==='LayoutCount').value;
  }
  const layouts=metrics?await metrics():0;
  const frames=page.evaluate(()=>new Promise(resolve=>{
   const times=[];const until=performance.now()+3400;
   function frame(t){times.push(t);if(t<until){requestAnimationFrame(frame);return;}
    const steps=times.slice(1).map((n,i)=>n-times[i]).sort((a,b)=>a-b);
    resolve({fps:+(1000*(times.length-1)/(t-times[0])).toFixed(1),p95:+steps[Math.floor(steps.length*.95)].toFixed(1),worst:+steps.at(-1).toFixed(1)});}
   requestAnimationFrame(frame);
  }));
  await page.mouse.move(x,y);await page.mouse.down();
  const started=Date.now();let steps=0;
  while(Date.now()-started<3200){const a=(Date.now()-started)/260;await page.mouse.move(x+Math.sin(a)*90,y+Math.sin(a*.45)*48);steps++;await new Promise(ok=>setTimeout(ok,6));}
  await page.mouse.up();const perf=await frames;
  const layoutCount=metrics?(await metrics())-layouts:null;
  await page.waitForTimeout(360);
  await page.evaluate(()=>{window.savedWorld=document.querySelector('.map-world');window.savedTexture=document.querySelector('.ground-art');window.savedResident=document.querySelector('.resident .actor');});
  const before=await page.locator('.map-world').boundingBox(),house=page.locator('[data-building="home"]');
  await house.evaluate(el=>el.click());await page.locator('[data-do="move/home"]').click();
  await page.locator('[data-cell="99"]').evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await page.locator('[data-do="confirmPlot"]').click();await page.locator('.map:not(.editing)').waitFor();
  const after=await page.locator('.map-world').boundingBox();
  const identity=await page.evaluate(()=>({world:savedWorld===document.querySelector('.map-world'),ground:savedTexture===document.querySelector('.ground-art'),resident:savedResident===document.querySelector('.resident .actor')}));
  console.log(JSON.stringify({engine:phone?'mobile WebKit':'desktop Chrome',pan:perf,layoutCount,pointerSamples:steps,identity,positionDrift:Math.hypot(before.x-after.x,before.y-after.y)}));
  if(!baseline){assert.ok(identity.world&&identity.ground&&identity.resident);assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<1);if(metrics)assert.ok(layoutCount<20);
   await page.locator('.dock [data-do="go/book"]').click();await page.selectOption('#f1','2');
   await page.locator('.dock [data-do="go/island"]').click();await page.locator('.map-world .resident').first().waitFor();
   assert.ok(await page.evaluate(()=>window.savedWorld===document.querySelector('.map-world')));
   await page.reload();await page.locator('.map-world .resident').first().waitFor();
   const restored=await page.locator('.map-world').boundingBox();
   assert.ok(Math.hypot(restored.x-before.x,restored.y-before.y)<1,'camera position after a menu change and reload');
   const cell=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ph_dragon_art_tour_v1')).buildings.find(b=>b.id==='home'));
   assert.deepEqual([cell.col,cell.row],[9,9]);
  }
 }finally{await browser.close();}
}
(async()=>{await run(chromium,false);await run(webkit,true);})().catch(e=>{console.error(e);process.exitCode=1;});
