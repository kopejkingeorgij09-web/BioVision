module.exports=async(page,{OUT,store,UID,need})=>{
 const wait=t=>page.waitForTimeout(t),key=`srs/${UID}/meta/dragons`,d=store.get(key).d;d.pve={v:1,best:{e8:3,t6:3},wins:{},at:{}};
 const farm=d.bld.find(b=>b.type==='farm');farm.plots=[{crop:'ember',at:0,need:50,skip:0,rt:true,startedAt:Date.now()},null];
 await page.reload();await wait(1500);await page.click('[data-act=go][data-v=cards]');await wait(300);await page.click('[data-act=drgopen][data-full]');await wait(1300);
 await page.click('.drg-zm [data-v=blds]');await page.click(`#main>.drg-pan [data-act=drgsel][data-id="${farm.id}"]`);await wait(200);
 need(await page.locator('[data-t=harvest]').count()===1,'старый урожай доступен без ожидания');await page.locator('[data-t=harvest]').click();await wait(400);await page.locator('[data-t=plant][data-crop=ember]').first().click();await wait(400);need(await page.locator('[data-t=harvest]').count()===1,'новый урожай доступен сразу');need(!(await page.locator('.drg-crops').innerText()).includes(' ч '),'у культур нет таймера');await page.screenshot({path:OUT+'/farm.png'});await page.keyboard.press('Escape');await wait(200);
 await page.click('.drg-dock [data-act=drgfight]');await wait(700);await page.click('[data-fk=reg][data-v=tide]');await page.click('.drf-pin[data-id=t7]');await page.click('.drf-nc [data-fk=prep]');await page.click('[data-fk=start]');await page.waitForFunction(()=>DRFIGHT.state().waiting,{timeout:20000});
 need(await page.locator('.drf-fc').count()===6,'бой три на три');
 const geometry=()=>page.evaluate(()=>({stage:document.querySelector('.drf-stage').getBoundingClientRect().height,overflow:document.querySelector('.drf').scrollWidth>innerWidth,buttons:[...document.querySelectorAll('.drf-skb')].every(e=>e.getBoundingClientRect().height>=44),stats:[...document.querySelectorAll('.drf-mini-stats')].every(e=>e.scrollWidth<=e.clientWidth)}));
 let g=await geometry();need(g.stage>=150&&!g.overflow&&g.buttons&&g.stats,'поле, кнопки и характеристики помещаются');await page.screenshot({path:OUT+'/battle.png'});
 await page.keyboard.press('2');await page.locator('.drf-target').first().waitFor();await page.screenshot({path:OUT+'/target.png'});need((await geometry()).stage>=150,'выбор цели сохраняет поле');
 await page.locator('.drf-details summary').click();need(await page.locator('.drf-details article').count()===6,'доступны полные характеристики');need(!/\d+[.,]\d{8}/.test(await page.locator('.drf-details-body').innerText()),'нет хвостов дробных чисел');await page.locator('.drf-details summary').click();
 await page.keyboard.press('q');await page.waitForFunction(()=>!DRFIGHT.state().targeting);need(true,'выбор цели работает');
};
