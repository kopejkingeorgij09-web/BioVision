/* «Назад» из похода и из осмотра дракона возвращает на остров, ещё раз — на страницу острова и в «Карточки» */
module.exports=async(page)=>{const w=t=>page.waitForTimeout(t),log=(...a)=>console.log('·',...a);
  const where=()=>page.evaluate(()=>({fight:!!document.querySelector('.drf'),insp:!!document.querySelector('.dri'),full:!!document.querySelector('.drg-map.full'),isl:!!document.querySelector('.drg-map'),pan:(document.querySelector('#main>.drg-pan h2')||{}).textContent||''}));
  await page.click('[data-act="go"][data-v="cards"]');await w(600);await page.click('[data-act="drgopen"][data-full]');await w(1500);
  await page.click('.drg-dock [data-act=drgfight]');await w(1800);log('поход открыт',JSON.stringify(await where()));
  await page.goBack();await w(900);log('«Назад» из похода',JSON.stringify(await where()));
  await page.click('.drg-dock [data-v=dragons]');await w(600);await page.click('#main>.drg-pan [data-act=drginsp]');await w(1500);log('осмотр открыт',JSON.stringify(await where()));
  await page.goBack();await w(1200);log('«Назад» из осмотра',JSON.stringify(await where()));
  await page.goBack();await w(800);log('ещё «Назад»',JSON.stringify(await where()));
  await page.goBack();await w(800);log('ещё «Назад»',JSON.stringify(await where()))}
