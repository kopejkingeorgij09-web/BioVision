/* сохранение острова: обычная запись, отказ и «Повторить», отказ и «Отменить», двойной клик, потерянный ответ, конфликт с другим устройством */
module.exports=async(page,{OUT,store,UID,fail,writes,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/save-${tag}-${n}.png`});
  const P=`srs/${UID}/meta/dragons`,srv=()=>store.get(P).d,w=t=>page.waitForTimeout(t);
  const ui=()=>page.evaluate(id=>{const s=DRGUI.storeOf(id);return {st:s.status,food:Math.floor(s.tip.bal?s.tip.bal.food:s.tip.food),rev:s.tip.rev||0,
    line:(document.querySelector('.drg-svw .drg-sv')||{}).textContent||''}},UID);
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await w(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(900);
  await page.click('[data-act="drgopen"][data-full]');await w(1200);
  const feedBtn=async()=>{await page.evaluate(()=>{const b=document.querySelector('[data-act=drgpanel][data-v=dragons]');b&&b.click()});await w(400);
    return page.$('[data-act=drgdo][data-t=feed]:not([disabled])')};
  const fed=()=>JSON.stringify(srv().dragons.map(d=>d.fed||0));
  let b=await feedBtn();if(!b){log('НЕТ кнопки «Покормить»');return}
  const u0=await ui(),f0=fed(),w0=writes.length;
  await b.click();await w(900);let u=await ui();
  need(u.st==='ok'&&fed()!==f0&&srv().rev>=1,'обычное кормление записано');
  log('1 обычная: статус',u.st,'корм',u0.food,'→',u.food,'в базе rev',srv().rev,'записей',writes.length-w0,'строка «'+u.line+'»');
  fail.set=1;b=await feedBtn();const fA=u.food;await b.click();await w(900);u=await ui();
  log('2 отказ записи: статус',u.st,'корм на экране',u.food,'в базе rev',srv().rev,'баннер',await page.evaluate(()=>!!document.querySelector('.drg-sv.err [data-v=retry]')));
  need(u.st==='error','отказ записи виден как ошибка');need(await page.evaluate(()=>!!document.querySelector('.drg-sv.err [data-v=retry]')),'есть кнопка «Повторить»');
  await shot('error');
  b=await page.$('[data-act=drgdo][data-t=feed]:not([disabled])');if(b){await b.click();await w(500)}
  log('  ещё одно кормление при ошибке не принято:',(await ui()).food===u.food);
  await page.click('[data-act=drgsave][data-v=retry]');await w(1000);u=await ui();
  log('  «Повторить»: статус',u.st,'в базе rev',srv().rev,'корм в базе',Math.floor(srv().bal?srv().bal.food:srv().food),'= на экране',u.food);
  need(u.st==='ok'&&Math.floor(srv().bal?srv().bal.food:srv().food)===u.food,'«Повторить» записал один раз, на экране то же, что в базе');
  fail.set=1;b=await feedBtn();const fB=u.food;await b.click();await w(900);
  await page.click('[data-act=drgsave][data-v=discard]');await w(600);u=await ui();
  need(u.st==='ok'&&u.food===fB,'«Отменить» вернул подтверждённое');
  log('3 отказ и «Отменить»: статус',u.st,'корм вернулся',u.food===fB,u.food,'rev',srv().rev);
  b=await feedBtn();const fC=u.food,r0=srv().rev;await b.dblclick();await w(1200);u=await ui();
  log('4 двойной клик: корм',fC,'→',u.food,'rev',r0,'→',srv().rev);
  need(u.st==='ok'&&Math.floor(srv().bal?srv().bal.food:srv().food)===u.food,'двойной клик: на экране то же, что в базе');
  fail.lost=1;b=await feedBtn();const r1=srv().rev,fD=(await ui()).food;await b.click();await w(900);u=await ui();
  log('5 ответ потерялся: статус',u.st,'в базе rev',srv().rev);
  await page.click('[data-act=drgsave][data-v=retry]').catch(()=>{});await w(1000);u=await ui();
  log('  «Повторить»: статус',u.st,'rev',r1,'→',srv().rev,'корм',fD,'→',u.food,'в базе',Math.floor(srv().bal?srv().bal.food:srv().food));
  need(u.st==='ok'&&srv().rev===r1+1&&Math.floor(srv().bal?srv().bal.food:srv().food)===u.food,'потерянный ответ: повтор не записал трату второй раз');
  const other=JSON.parse(JSON.stringify(srv()));other.rev=(other.rev||0)+1;other.by='other-device';other.op='zz';if(other.bal)other.bal.food=999;else other.food=999;
  store.set(P,{d:other,t:new Date().toISOString()});
  b=await feedBtn();await b.click();await w(1000);u=await ui();
  log('6 другое устройство: статус',u.st,'в базе корм',Math.floor(other.bal?srv().bal.food:srv().food),'(чужое не перезаписано)',srv().by);
  need(u.st==='conflict'&&Math.floor(srv().bal?srv().bal.food:srv().food)===999,'конфликт: чужое не перезаписано');
  await shot('conflict');
  await page.click('[data-act=drgsave][data-v=remote]').catch(()=>{});await w(700);u=await ui();
  log('  «Взять с сервера»: статус',u.st,'корм',u.food);need(u.st==='ok'&&u.food===999,'«Взять с сервера» показывает чужую версию');
  await shot('after');
}
