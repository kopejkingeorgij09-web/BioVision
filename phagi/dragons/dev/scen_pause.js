/* Пауза острова: переключателя и острова нет, карточки за паузу копятся в очки, документ острова не пишется.
   Запуск: SCEN=scen_pause.js DRAG="$(cat isle-many.json)" W=390 H=844 TOUCH=1 node hx.js ../.. ./out */
module.exports=async(page,{OUT,need,writes})=>{
  await page.click('[data-act=go][data-v=cards]');await page.waitForTimeout(500);
  const r=await page.evaluate(()=>{const q=s=>document.querySelector(s);
    return {pause:!!q('.drg-pause'),txt:(q('.drg-pause')||{}).textContent||'',sw:!!q('[data-act=drgmode]'),open:!!q('[data-act=drgopen]'),on:DRGUI.on(meId()),pts:DRGUI.pausePoints(meId())}});
  console.log('PAUSE',JSON.stringify(r));
  need(r.pause&&/очк/.test(r.txt),'в «Карточках» плашка паузы с очками');
  need(!r.sw&&!r.open&&!r.on,'переключателя и входа на остров нет');
  need(r.pts>0,'очки считаются из карточек за паузу');
  await page.screenshot({path:OUT+'/pause-cards.png'});
  await page.evaluate(()=>{S.view='island';render()});await page.waitForTimeout(400);
  const v=await page.evaluate(()=>!!document.querySelector('.drg-world')||!!(document.querySelector('.drg-pause')));
  need(v&&!(await page.evaluate(()=>!!document.querySelector('.drg-world'))),'страница острова показывает паузу, а не остров');
  await page.screenshot({path:OUT+'/pause-island.png'});
  need(!writes.some(w=>/meta\/dragons/.test(w)),'документ острова не записывался');
};
