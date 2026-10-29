module.exports=async(page,{OUT,store,UID,need})=>{
 const path=`srs/${UID}/meta/dragons`,w=t=>page.waitForTimeout(t);let d=store.get(path).d;
 d.dragons.forEach(x=>x.lvl=1);d.dragons[0].lvl=60;
 await page.reload();await w(1800);await page.click('[data-act=go][data-v=cards]');await w(400);await page.click('[data-act=drgopen][data-full]');await w(1200);await page.click('.drg-dock [data-v=dragons]');await page.locator('.drg-favorite').waitFor();await page.click('.drg-ranking [data-v=ranking]');await w(500);
 const rows=await page.locator('.drg-power-list li').evaluateAll(es=>es.map(e=>({id:e.dataset.dragon,p:+e.dataset.power})));
 need(rows.length===d.dragons.length,'в рейтинге все драконы');need(rows.every((r,i)=>!i||rows[i-1].p>=r.p),'сортировка по убыванию силы');need(rows[0].id===d.dragons[0].id,'сильнейший первый');
 need(await page.locator('.drg-favorite [data-dragon]').getAttribute('data-dragon')===rows[0].id,'любимчик совпадает с лидером');
 await page.screenshot({path:OUT+'/ranking.png'});
 d=store.get(path).d;d.dragons[0].lvl=1;d.dragons[1].lvl=60;store.set(path,{d,t:new Date().toISOString()});await page.reload();await w(2200);
 if(!await page.locator('.drg-dock').count()){await page.click('[data-act=go][data-v=cards]');await w(300);await page.click('[data-act=drgopen][data-full]');await w(1000)}
 await page.click('.drg-dock [data-v=dragons]');await page.locator('.drg-favorite').waitFor();need(await page.locator('.drg-favorite [data-dragon]').getAttribute('data-dragon')===d.dragons[1].id,'любимчик пересчитан после роста другого дракона');
 need(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'нет горизонтальной прокрутки');
};
