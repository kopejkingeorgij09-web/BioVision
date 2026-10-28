/* «Назад» из похода и из осмотра дракона возвращает на остров, ещё раз — на страницу острова и в «Карточки» */
module.exports=async(page,{need})=>{const w=t=>page.waitForTimeout(t),log=(...a)=>console.log('·',...a);
  const where=()=>page.evaluate(()=>({fight:!!document.querySelector('.drf'),insp:!!document.querySelector('.dri'),full:!!document.querySelector('.drg-map.full'),isl:!!document.querySelector('.drg-map'),pan:(document.querySelector('#main>.drg-pan h2')||{}).textContent||''}));
  await page.click('[data-act="go"][data-v="cards"]');await w(600);await page.click('[data-act="drgopen"][data-full]');await w(1500);
  await page.click('.drg-dock [data-act=drgfight]');await w(1800);let x=await where();log('поход открыт',JSON.stringify(x));need(x.fight,'поход открылся');
  await page.goBack();await w(900);x=await where();log('«Назад» из похода',JSON.stringify(x));need(!x.fight&&x.full,'«Назад» из похода ведёт на остров во весь экран');
  await page.click('.drg-dock [data-v=dragons]');await w(600);await page.click('#main>.drg-pan [data-act=drginsp]');await w(1500);x=await where();log('осмотр открыт',JSON.stringify(x));need(x.insp,'осмотр открылся');
  await page.goBack();await w(1200);x=await where();log('«Назад» из осмотра',JSON.stringify(x));need(!x.insp&&x.isl,'«Назад» из осмотра ведёт на остров');
  await page.goBack();await w(800);log('ещё «Назад»',JSON.stringify(await where()));
  await page.goBack();await w(800);x=await where();log('ещё «Назад»',JSON.stringify(x));need(!x.fight&&!x.insp,'дальше «Назад» не открывает бой и осмотр снова')}
