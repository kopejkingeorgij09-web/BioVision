module.exports=async(page,{OUT,store,UID,need})=>{
 const wait=t=>page.waitForTimeout(t),path=`srs/${UID}/meta/dragons`;
 const d=store.get(path).d;d.bal.xp=3000;d.bal.gold=10000;d.dragons.forEach(x=>x.lvl=4);d.bld.forEach(b=>{if(b.chest)b.chest.amt=20;if(b.type==='nest')b.pair=null});
 await page.reload();await wait(1800);await page.click('[data-act=go][data-v=cards]');await wait(400);await page.click('[data-act=drgopen][data-full]');await wait(2200);
 need(await page.locator('.drg-dock [data-v=market]').count()===1,'покупка драконов рядом со строительством');
 await page.click('.drg-dock [data-v=market]');await wait(300);need(await page.locator('.drg-store-tabs [data-v=shop]').count()===1,'из рынка можно открыть здания');
 await page.click('.drg-store-tabs [data-v=shop]');await wait(300);need(await page.locator('.drg-store-tabs [aria-pressed=true]').getAttribute('data-v')==='shop','вкладка зданий работает');
 await page.keyboard.press('Escape');await wait(300);
 const bubble=page.locator('.drg-bub[data-t=collect]').first();
 if(await bubble.count()){const id=await bubble.getAttribute('data-id');await bubble.focus();const gold=store.get(path).d.bal.gold;await page.keyboard.press('Enter');await wait(700);need(store.get(path).d.bal.gold>gold,'кнопка над домом собирает золото с клавиатуры')}
 await page.click('.drg-zm [data-v=blds]');await wait(250);
 await page.click('#main>.drg-pan [data-act=drgsel][data-id="'+d.dragons[0].home+'"]');await wait(500);
 need(await page.locator('.drg-residents').count()===1,'жители в отдельном компактном списке');need(await page.locator('.drg-home-manage:not([open])').count()===1,'улучшение не мешает кормлению');need(await page.locator('.drg-resident').count()>0,'компактные карточки жителей');need(await page.locator('.drg-resident .drg-power').count()>0,'абсолютная сила в карточке');await page.screenshot({path:OUT+'/home.png'});
 await page.locator('.drg-residents [data-act=drginsp]').last().click();await wait(1200);need(await page.locator('.dri-combat').count()===1,'паспорт объясняет силу, генотип и уязвимости');await page.screenshot({path:OUT+'/combat.png'});await page.locator('.dri-x').click();await page.locator('.dri').waitFor({state:'detached'});
 await page.click('.drg-home .drg-pan-h [data-act=drgsel]');await wait(200);await page.click('.drg-zm [data-v=blds]');await wait(200);
 const nest=d.bld.find(b=>b.type==='nest');await page.click(`#main>.drg-pan [data-act=drgsel][data-id="${nest.id}"]`);await wait(400);
 await page.locator('.drg-predbox summary').click();await page.locator('.drg-gen-guide').scrollIntoViewIfNeeded();need(await page.locator('.drg-gen-parents pre').count()===2,'генотипы обоих родителей показаны');need(await page.locator('.drg-gen-guide li').count()>3,'есть правила и шаги расчёта');await page.screenshot({path:OUT+'/prediction.png'});
 await page.keyboard.press('Escape');await wait(400);
 for(let i=0;i<20;i++){await wait(350);const stats=await page.evaluate(()=>DRLIVE.stats());need(stats.pos.every(d=>d.inside),'драконы целиком внутри дома, кадр '+i)}
 const stats=await page.evaluate(()=>DRLIVE.stats());console.log('render ms',stats.ema,'frames',stats.frames);need(stats.running&&stats.ema<40,'живой слой работает в пределах бюджета');await page.screenshot({path:OUT+'/island.png'});
};
