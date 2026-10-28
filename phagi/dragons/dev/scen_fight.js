/* поход: карта → подготовка → бой (игрок жмёт приёмы, точный удар) → итог → запись звёзд → перезагрузка */
module.exports=async(page,{OUT,store,UID})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/fight-${tag}-${n}.png`});
  const st=()=>page.evaluate(()=>DRFIGHT.state());
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await page.waitForTimeout(900);
  await page.click('[data-act="drgopen"][data-full]');await page.waitForTimeout(2000);
  await shot('0-island');
  await page.click('[data-act="drgfight"]');await page.waitForTimeout(2500);
  log('экран',(await st()).screen);await shot('1-map');
  const ow=()=>page.evaluate(()=>{const e=document.querySelector('.drf');return {page:document.documentElement.scrollWidth>innerWidth,drf:e?e.scrollWidth>e.clientWidth:null}});
  log('гориз. прокрутка',JSON.stringify(await ow()));
  await page.click('[data-fk="prep"][data-id="e1"]');await page.waitForTimeout(2500);
  log('подготовка',JSON.stringify((await st()).pick));await shot('2-prep');log('гориз. прокрутка',JSON.stringify(await ow()));
  await page.click('[data-fk="start"]');await page.waitForTimeout(3500);
  let s=await st();log('бой: построение',s.form,'бойцы',JSON.stringify(s.f));await shot('3-fight');
  const usedSk=new Set();let perfects=0,presses=0,shots=0,t0=Date.now();
  while(Date.now()-t0<150000){
    s=await st();if(!s||s.result||s.screen==='result')break;
    if(s.ring&&!s.ring.pressed){
      // нажать точно: ждём, пока до выпуска останется ~0,03 с
      const ok=await page.evaluate(()=>new Promise(res=>{const f=()=>{const q=DRFIGHT.state().ring;if(!q||q.pressed)return res(null);if(q.dt>=-0.04){DRFIGHT.press();res(DRFIGHT.state().ring)}else requestAnimationFrame(f)};f()}));
      presses++;if(ok&&ok.ok)perfects++;
      if(shots<6){await page.waitForTimeout(280);await shot('4-atk'+(shots++))}
      continue}
    if(s.waiting&&!s.targeting){
      const sk=await page.evaluate(()=>{const b=[...document.querySelectorAll('.drf-skb')];const pick=b.find(x=>x.dataset.sk==='rage')||b.find(x=>x.dataset.sk.startsWith('el:'))||b[0];pick.click();return pick.dataset.sk});
      usedSk.add(sk);await page.waitForTimeout(120);continue}
    if(s.targeting){if(shots===0)await shot('3b-target');await page.click('.drf-team.b .drf-fc.tg');await page.waitForTimeout(100);continue}
    await page.waitForTimeout(100)}
  s=await st();log('итог',JSON.stringify(s.result),'раундов',s.round,'приёмы',[...usedSk].join(','),'точных',perfects,'из',presses);
  const m=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?+a[a.length>>1].toFixed(2):null},p95=a=>{a=a.slice().sort((x,y)=>x-y);return a.length?+a[Math.floor(a.length*.95)].toFixed(2):null};
  log('кадр: отрисовка мед',m(s.draw),'p95',p95(s.draw),'интервал мед',m(s.frame));
  await page.waitForTimeout(1200);await shot('5-result');
  const saved=(store.get(`srs/${UID}/meta/dragons`)||{}).d;log('в базе pve',JSON.stringify(saved&&saved.pve),'драконов',saved&&saved.dragons.length,'золото',saved&&Math.floor(saved.bal.gold),'корм',saved&&Math.floor(saved.bal.food));
  const mem=await page.evaluate(()=>performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null);log('JS-память, МБ',mem);
  await page.click('[data-fk="map"]');await page.waitForTimeout(1000);await shot('6-map2');
  await page.keyboard.press('Escape');await page.waitForTimeout(800);log('поход закрыт',await page.evaluate(()=>!document.querySelector('.drf')),'остров живой',await page.evaluate(()=>DRLIVE.stats().running));
  await page.reload();await page.waitForTimeout(2000);
  /* после перезагрузки страница сама возвращается на остров (история), иначе заходим через «Карточки» */
  log('после перезагрузки остров на месте',!!await page.$('.drg-map.full'));
  if(!await page.$('.drg-map.full')){await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);await page.click('[data-act="drgopen"][data-full]');await page.waitForTimeout(1500)}
  await page.click('.drg-dock [data-act="drgfight"]');await page.waitForTimeout(2000);
  log('после перезагрузки звёзды',await page.evaluate(()=>document.querySelector('.drf-tot').textContent),'e2 открыт',await page.evaluate(()=>!document.querySelector('[data-id=e2]').disabled));
  await shot('7-reload')};
