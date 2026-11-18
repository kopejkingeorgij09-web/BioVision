// Use a dedicated qa-isle account. The browser plays a real first campaign battle.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const accounts=JSON.parse(fs.readFileSync(process.env.DRAGON_QA_ACCOUNTS,'utf8'));
const user=accounts[Number(process.env.DRAGON_QA_INDEX||0)];
assert.match(user.uid,/^qa-isle-/);
const url=process.env.DRAGON_GAME_URL||'http://127.0.0.1:8793/phagi/island/';
const phone=process.env.DRAGON_PHONE==='1',media=process.env.DRAGON_MEDIA_DIR;
(async()=>{
 const engine=phone?webkit:chromium;
 const browser=await engine.launch(!phone&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 const page=await browser.newPage({viewport:phone?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1,isMobile:phone,hasTouch:phone,timezoneId:'Europe/Moscow'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
 const shot=async name=>{if(media){fs.mkdirSync(media,{recursive:true});await page.screenshot({path:media+'/'+(phone?'mobile':'desktop')+'-'+name+'.png'});}};
 const click=async a=>page.locator('[data-do="'+a+'"]').click();
 try{
  await page.goto(url);await page.getByRole('link',{name:'Войти в «Фаги»'}).click();
  await page.locator('#ph-code').fill(user.code);await page.locator('#ph-login button[type=submit]').click();
  await page.waitForURL(url);await page.locator('.map-world .resident').first().waitFor();
  await click('go/build');await page.locator('.inventory li').first().waitFor();
  if(phone)await click('shop/buy');
  await page.locator('.offers .price').first().waitFor();assert.equal(await page.locator('.offers li').count(),12);
  assert.equal(await page.locator('.offers li').evaluateAll(els=>els.every(e=>e.querySelector('p')?.textContent&&/золота|кристаллов/.test(e.querySelector('.price')?.textContent))),true);
  await shot('shop');
  await click('go/book');assert.equal(await page.locator('#f2').inputValue(),'own');
  const ranks=await page.locator('.spec strong').allTextContents();const power=ranks.map(v=>Number(v.replace(/\D/g,'')));
  assert.ok(power.length>=2);assert.deepEqual(power,power.slice().sort((a,b)=>b-a));
  await click('go/raids');await page.locator('#chapter').waitFor();
  assert.equal(await page.locator('#chapter option').count(),15);await page.selectOption('#chapter','14');
  await click('stage/300');assert.ok(await page.locator('[data-do=raid]').isDisabled());
  await page.locator('.fort-plan image[href$="fortress.svg"]').waitFor({state:'attached'});
  await page.selectOption('#chapter','0');await click('stage/1');
  await shot('campaign');const teamButtons=await page.locator('[data-do^="team/"]').evaluateAll(els=>els.filter(e=>!e.disabled).slice(0,2).map(e=>e.dataset.do));
  assert.equal(teamButtons.length,2);for(const a of teamButtons)await click(a);
  await click('raid');await page.locator('[data-shore="1"]').waitFor();await page.locator('[data-camera=fit]').click();
  for(const a of teamButtons){await click('unit/'+a.slice(5));await page.locator('[data-shore="1"]').click();
   await page.waitForFunction(()=>!document.body.hasAttribute('aria-busy')&&document.querySelector('[data-shore="1"]').hidden);}
  await page.waitForURL('**/#log',{timeout:105000});
  const replay=page.locator('[data-do^="go/replay/"]').first();await replay.click();
  await page.locator('[data-seek]').waitFor();assert.ok((await page.locator('[data-seek]').getAttribute('max'))>4);
  assert.ok(await page.locator('.ledger tbody tr').count()>=2);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-seek]').valueAsNumber>=4);
  await page.locator('[data-play]').click();const stamp=await page.locator('[data-seek]').inputValue();
  await page.waitForTimeout(200);assert.equal(await page.locator('[data-seek]').inputValue(),stamp);await page.locator('[data-step]').click();
  await page.locator('.battle-events button').last().click();await shot('replay');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:browser.version(),phone,shop:12,ranked:power,chapters:15,campaign:'stage 1 completed',events:await page.locator('.battle-events button').count(),replay:'play/pause, seek to event and storage ledger'}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
