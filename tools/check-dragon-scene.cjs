// Run against the isolated workshop scene: no account or production writes.
const {chromium,webkit}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.DRAGON_GAME_URL||'http://127.0.0.1:8793/phagi/island/';
const output=process.env.DRAGON_MEDIA_DIR;
if(output)fs.mkdirSync(output,{recursive:true});
const until=async(p,fn,arg)=>p.waitForFunction(fn,arg,{timeout:30000});
async function run(engine,phone){
 const b=await engine.launch(engine===chromium&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 const tag=phone?'mobile':'desktop',record=output&&phone;
 const c=await b.newContext({viewport:phone?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1,isMobile:phone,hasTouch:phone,
  ...(record?{recordVideo:{dir:output,size:{width:390,height:844}}}:{})});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ms=()=>Date.now();const zero=ms();
 const screenshot=async name=>{if(output)await p.screenshot({path:path.join(output,name+'.png')});};
 try{
  await p.goto(new URL('?tour=1',base).href);await p.waitForSelector('.resident svg');
  assert.equal(await p.locator('.plot').count(),100);
  await until(p,()=>[...document.querySelectorAll('.ground-art,.piece img')].every(i=>i.complete&&i.naturalWidth>20));
  const box=async loc=>loc.boundingBox(), residents=p.locator('.resident');
  const first=residents.first(),home=await first.getAttribute('data-home'),prior=await box(first),owner=p.locator('[data-building="'+home+'"]');
  await p.waitForTimeout(580);assert.deepEqual(await box(first),prior);assert.ok(prior.width<(await box(owner)).width);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),phone?390:1440);
  await screenshot(tag+'-svg');
  const scene=p.locator('.map-world');const initial=(await box(scene)).width;
  const priorView=await box(scene);
  const windowBox=await box(p.locator('.world-window')),px=windowBox.x+windowBox.width*.52,py=windowBox.y+windowBox.height*.55;
  await p.mouse.move(px,py);await p.mouse.down();await p.mouse.move(px-64,py+16,{steps:8});await p.mouse.up();
  assert.ok(Math.abs((await box(scene)).x-priorView.x)>15,'drag pans the world');assert.equal(await p.locator('.side').count(),0);
  await p.locator('[data-camera=fit]').click();const fitted=(await box(scene)).width;assert.ok(initial>=1.9*fitted);
  await p.locator('[data-camera=in]').click();assert.ok((await box(scene)).width>fitted);
  await p.locator('[data-do="go/build"]').click();await p.locator('[data-do="selectB/'+home+'"]').click();
  await p.locator('[data-do="move/'+home+'"]').click();await p.locator('[data-camera=fit]').click();
  const corner=p.locator('[data-cell="99"] polygon');if(phone)await corner.tap();else await corner.click();
  await p.locator('[data-do=confirmPlot]').click();await p.locator('.map:not(.editing)').waitFor();
  const now=await box(first),house=await box(owner);assert.ok(Math.abs(now.x-house.x)<house.width*1.7);
  const saved=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('ph_dragon_art_tour_v1')));
  const moved=saved.buildings.find(b=>b.id===home);assert.deepEqual([moved.col,moved.row],[9,9]);assert.equal(saved.dragons[0].home,home);
  await p.locator('[data-do="go/book"]').click();await p.locator('[data-do="go/species/s26"]').click();await p.waitForSelector('.plate svg.rigged');
  await p.locator('[data-do="pose/attack"]').click();await p.waitForTimeout(250);await screenshot(tag+'-book');
  await p.locator('[data-do=skeleton]').click();await p.waitForSelector('.armature:visible');
  const bones=p.locator('.armature path'),before=await bones.nth(2).getAttribute('d');
  await p.waitForTimeout(300);assert.notEqual(await bones.nth(2).getAttribute('d'),before);
  await screenshot(tag+'-skeleton');
  await p.locator('[data-do="go/raids"]').click();await p.locator('#enemy').waitFor();
  for(const el of await p.locator('[data-do^="team/"]').all())await el.click();
  await p.locator('[data-do=raid]').click();await p.locator('[data-shore="1"]').waitFor();
  const start=(ms()-zero)/1000;
  await p.locator('[data-camera=fit]').click();
  const buttons=await p.locator('.unitlist [data-do^="unit/"]').evaluateAll(els=>els.map(e=>e.dataset.do));
  assert.equal(buttons.length,3);
  for(let i=0;i<3;i++){
   await p.locator('[data-do="'+buttons[i]+'"]').click();
   await p.locator('[data-shore="'+i+'"]').click();
  }
  await until(p,()=>document.querySelectorAll('.fighter:not([hidden]) svg').length===3);
  await p.locator('[data-mark=gold]').click();await p.waitForTimeout(400);
  const fps=await p.evaluate(()=>new Promise(resolve=>{
    const frames=[];const until=performance.now()+5000;
    function frame(t){frames.push(t);if(t<until)return requestAnimationFrame(frame);
      const steps=frames.slice(1).map((n,i)=>n-frames[i]).sort((a,b)=>a-b);
      resolve({fps:+(1000*(frames.length-1)/(frames.at(-1)-frames[0])).toFixed(1),p95:+steps[Math.floor(steps.length*.95)].toFixed(1),worst:+steps.at(-1).toFixed(1)});}
    requestAnimationFrame(frame);
  }));
  await screenshot(tag+'-battle');const end=(ms()-zero)/1000;
  assert.deepEqual(errors,[]);console.log(JSON.stringify({tag,engine:b.version(),initialWorld:initial,overview:fitted,residentWidth:prior.width,start,end,fps}));
  if(record){const vid=p.video();await p.close();await c.close();console.log('Video '+await vid.path());}
 }finally{await b.close();}
}
(async()=>{await run(chromium,false);await run(webkit,true);})().catch(e=>{console.error(e);process.exitCode=1;});
