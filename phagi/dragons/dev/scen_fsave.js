/* бой с отказом записи итога: строка на экране итога говорит правду, «Повторить» записывает звёзды один раз */
module.exports=async(page,{OUT,store,UID,fail,writes})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/fsave-${tag}-${n}.png`});
  const st=()=>page.evaluate(()=>DRFIGHT.state()),w=t=>page.waitForTimeout(t),P=`srs/${UID}/meta/dragons`;
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await w(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(900);
  await page.click('[data-act="drgopen"][data-full]');await w(1500);
  await page.click('[data-act="drgfight"]');await w(2000);
  /* с этапа 4 бой выбирают на карте: метка узла, потом кнопка в карточке узла (список узлов спрятан в «Списком») */
  await page.click('.drf-pin[data-id="e1"]');await w(300);await page.click('.drf-nc [data-fk="prep"]');await w(1500);
  await page.click('[data-fk="start"]');await w(1500);
  await page.click('[data-fk="auto"]');await page.click('[data-fk="speed"]');
  fail.set=50;const t0=Date.now();
  while(Date.now()-t0<180000){const s=await st();if(!s||s.screen==='result')break;await w(300)}
  await w(1500);const line=await page.evaluate(()=>(document.querySelector('.drf-svl')||{}).textContent||'');
  log('итог',JSON.stringify((await st()).result),'строка «'+line+'»','pve в базе',JSON.stringify(store.get(P).d.pve||null));
  await shot('err');fail.set=0;
  await page.click('[data-fk="svretry"]').catch(e=>log('нет кнопки повтора',e.message));await w(1200);
  log('после «Повторить»: строка «'+await page.evaluate(()=>(document.querySelector('.drf-svl')||{}).textContent||'')+'»','pve',JSON.stringify(store.get(P).d.pve||null));
  await shot('ok')}
