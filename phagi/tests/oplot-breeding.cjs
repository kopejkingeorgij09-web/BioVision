// Browser-only guest island. Uses a fresh browser context and a version-one save for every run.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium,webkit} = (() => {
  try {return require('playwright')} catch {return require('playwright-core')}
})();
const site = process.argv[2] || pathToFileURL(path.resolve(__dirname,'../oplot.html')).href;
const storageKey = 'phagi.oplot.v1.local.standalone';

function legacyIsland() {
  const now=Date.now();
  const layout=[['keep',1,6],['home',3,2],['den',2,3],['farm',8,5],['foodstore',8,6]];
  return {
    version:1,gold:321,berries:1100,
    buildings:layout.map(([type,x,y],i)=>({id:'b'+i,type,x,y,level:type==='home'||type==='foodstore'?2:1,since:now})),
    dragons:[0,1,2,6,12].map((species,i)=>({id:'d'+i,species,level:species===12?7:1})),
    book:[0,1,2,6,12],egg:null,quest:2,marks:{collect:1,feed:1},campaign:{1:2},waves:1,bosses:0,arenas:0,
    settings:{sound:false},pending:null,deliveries:[]
  };
}

async function check(browser,width,mobile) {
  const context=await browser.newContext({
    viewport:{width,height:mobile?844:900},deviceScaleFactor:mobile?2:1,
    isMobile:mobile,hasTouch:mobile,colorScheme:mobile?'dark':'light',serviceWorkers:'block'
  });
  try {
    await context.addInitScript(({key,island})=>{
      if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(island));
    },{key:storageKey,island:legacyIsland()});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const dialog=page.locator('dialog[open]');
    const press=async button=>button[mobile?'tap':'click']({timeout:8000});
    const act=(name,id=null,scope=dialog)=>press(scope.locator('[data-do="'+name+'"]'+(id===null?'':'[data-id="'+id+'"]')));
    const close=async()=>{if(await dialog.count())await press(dialog.locator('button.close'))};
    const tab=async id=>{await close();await act('tab',id,page.locator('.tabs'))};
    const openBreeding=async()=>{await tab('collection');await act('breed')};
    const raiseTo=async(id,level)=>{
      await tab('collection');await act('pet',id);
      for(let current=(await state()).dragons.find(d=>d.id===id).level;current<level;current++)await act('feed',id);
    };
    const selectParents=async(a,b)=>{
      await dialog.locator('#parentA').selectOption(a);
      await dialog.locator('#parentB').selectOption(b);
    };
    const state=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
    const odds=async rank=>{
      const text=await dialog.locator('#breed-forecast .odds-row[data-rank="'+rank+'"]').innerText();
      const match=text.match(/([\d]+(?:[.,]\d+)?)\s*%/);
      assert.ok(match,'Missing percentage in '+text);return Number(match[1].replace(',','.'));
    };
    const openOutcomes=async()=>{
      const details=dialog.locator('#breed-forecast details');
      if(await details.count() && !await details.evaluate(e=>e.open)){
        await press(details.locator('summary'));
      }
    };
    async function assertProfile(id) {
      const d=(await state()).dragons.find(d=>d.id===id);
      const expected=await page.evaluate(d=>{
        const p=window.Battle.profile(d.species,d.level);
        return {hp:p.hp,damage:p.damage,ability:p.ability.name,prey:p.advantageElements.map(i=>window.GAME_ELEMENTS[i])};
      },d);
      const numbers=(await dialog.locator('.pet-stats dd').allTextContents()).map(Number);
      assert.ok(numbers.includes(expected.hp) && numbers.includes(expected.damage),'Rendered pet stats '+numbers);
      const text=await dialog.innerText();
      assert.ok(text.includes(expected.ability),'Missing ability '+expected.ability);
      for(const prey of expected.prey)assert.ok(text.toLowerCase().includes(prey.toLowerCase()),'Missing advantage '+prey);
      return expected;
    }
    async function hatchAcrossReload() {
      const laid=(await state()).egg;
      assert.ok(laid && Number.isInteger(laid.species));
      const initial=(await state()).dragons.length;
      await page.reload();await openBreeding();
      const restored=(await state()).egg;
      assert.deepEqual(restored,laid);
      // A changed random source on the second visit catches accidental re-rolling at hatch.
      await page.evaluate(()=>{Math.random=()=>0});
      await page.waitForFunction(()=>document.querySelector('[data-do="hatch"]')?.disabled===false,null,{timeout:16500});
      await act('hatch');
      const after=await state();
      assert.equal(after.egg,null);assert.equal(after.dragons.length,initial+1);
      const newborn=after.dragons.at(-1);
      assert.equal(newborn.species,laid.species);assert.ok(after.book.includes(newborn.species));
      return newborn;
    }

    await page.goto(site);
    await page.locator('#world').waitFor();
    assert.equal(await page.locator('#gold').innerText(),'321');
    assert.deepEqual((await state()).campaign,{'1':2});
    await tab('collection');
    await act('pet','d4');
    assert.match(await dialog.innerText(),/Звездочёт/);
    assert.match(await dialog.innerText(),/Легендарный/);
    await assertProfile('d4');

    await openBreeding();await selectParents('d0','d1');
    const lay=dialog.locator('[data-do="lay"]');
    assert.ok(await lay.isDisabled(),'Two babies need four levels');
    assert.match(await dialog.innerText(),/(4.{0,15}уров|уров.{0,20}4)/i);
    await raiseTo('d0',4);await openBreeding();await selectParents('d0','d1');
    assert.ok(await lay.isDisabled(),'Both parents must meet the minimum level');
    await raiseTo('d1',4);await openBreeding();await selectParents('d0','d1');
    assert.ok(await lay.isEnabled());
    assert.equal(await odds(2),100);
    await openOutcomes();
    assert.match(await dialog.locator('#breed-forecast').innerText(),/Туманник/i);
    await act('lay');
    const mist=await hatchAcrossReload();
    assert.equal(mist.species,5);
    assert.match(await dialog.innerText(),/Туманник/);

    await tab('collection');await act('pet',mist.id);
    const mistProfile=await assertProfile(mist.id);
    assert.equal(mistProfile.ability,'Кипящий прилив');
    await raiseTo(mist.id,4);await raiseTo('d3',4);
    await openBreeding();await selectParents(mist.id,'d3');
    assert.equal(await odds(2),92);assert.equal(await odds(3),8);
    await openOutcomes();
    const potential=await dialog.locator('#breed-forecast').innerText();
    assert.match(potential,/Кувшинка/);assert.match(potential,/Тепличник/);
    await raiseTo(mist.id,5);
    assert.equal((await state()).dragons.find(d=>d.id===mist.id).level,5);
    await openBreeding();await selectParents(mist.id,'d3');
    const raised=await odds(3);assert.ok(raised>8 && raised<10,'Displayed epic chance after one feeding: '+raised);

    // Exercise the maximum on genuine old residents without requiring 58 manual feedings.
    await close();
    await page.evaluate(({key,ids})=>{
      const save=JSON.parse(localStorage.getItem(key));
      for(const d of save.dragons)if(ids.includes(d.id))d.level=30;
      localStorage.setItem(key,JSON.stringify(save));
    },{key:storageKey,ids:[mist.id,'d3']});
    await page.reload();await openBreeding();await selectParents(mist.id,'d3');
    assert.equal(await odds(2),60);assert.equal(await odds(3),40);
    await page.evaluate(()=>{Math.random=()=>.99999});
    await act('lay');
    const epic=await hatchAcrossReload();
    await act('pet',epic.id);
    const pet=await dialog.innerText();
    for(const word of [/Тепличник/,/огня/i,/воды/i,/природы/i,/эпический/i])assert.match(pet,word);
    const epicProfile=await assertProfile(epic.id);
    assert.ok(epicProfile.hp>mistProfile.hp && epicProfile.damage>mistProfile.damage);
    await tab('book');
    const learned=dialog.locator('.card').filter({has:page.getByRole('heading',{name:/Тепличник/})});
    assert.equal(await learned.count(),1);
    assert.equal(await learned.evaluate(e=>e.classList.contains('locked')),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1),'Horizontal overflow in the recipe book');
    assert.deepEqual(errors,[]);
    console.log('PASS legacy island, hatch across reload, rare and epic forecasts, trained parents, hatch and book',width,mobile?'touch/dark':'desktop/light');
  } finally {await context.close()}
}
(async()=>{
  const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try {await Promise.all([check(browser,1180,false),check(browser,390,true)])} finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
