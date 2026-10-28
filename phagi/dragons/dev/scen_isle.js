/* остров на весь экран: камера по границам, нижний ряд без перекрытий, «Мои постройки», клавиатура, «Назад» и перезагрузка */
module.exports=async(page,{OUT})=>{
  const W=+(process.env.W||1280),tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/isle-${tag}-${n}.png`});const w=t=>page.waitForTimeout(t);
  await page.click('[data-act="go"][data-v="cards"]');await w(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(800);
  await page.click('[data-act="drgopen"][data-full]');await w(1600);
  const geo=()=>page.evaluate(()=>{const R=e=>e.getBoundingClientRect(),bs=[...document.querySelectorAll('.drg-dock>*,.drg-zm>*,.drg-hud-r>*,.drg-hud-l,.drg-svw>*')].filter(e=>e.offsetParent).map(e=>[e.dataset.v||e.className.split(' ')[0],R(e)]);
    let ov=[];for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i][1],b=bs[j][1],x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(x>1&&y>1)ov.push(bs[i][0]+'×'+bs[j][0]+' '+Math.round(x)+'×'+Math.round(y))}
    const off=bs.filter(([k,r])=>r.left<0||r.right>innerWidth+0.5).map(([k])=>k);
    const g=[...document.querySelectorAll('.drg-map.full .drg-b')].map(R),isl=g.reduce((a,r)=>[Math.min(a[0],r.left),Math.min(a[1],r.top),Math.max(a[2],r.right),Math.max(a[3],r.bottom)],[1e9,1e9,-1e9,-1e9]);
    const dk=R(document.querySelector('.drg-dock')),hd=R(document.querySelector('.drg-hud'));
    return {ov,off,dock:Math.round(dk.width),build:isl.map(Math.round),freeY:[Math.round(hd.bottom),Math.round(dk.top)],scroll:document.documentElement.scrollWidth>innerWidth,tabs:document.querySelectorAll('.drg-isl [tabindex="0"]').length}});
  const g=await geo();log('перекрытия',JSON.stringify(g.ov),'за краем',JSON.stringify(g.off),'гориз. прокрутка',g.scroll);
  log('постройки на экране',JSON.stringify(g.build),'свободно по высоте',JSON.stringify(g.freeY),'ширина окна',W,'объектов с Tab',g.tabs);
  await shot('0');
  // клавиатура: фокус на первую постройку, Enter открывает, Escape закрывает и возвращает фокус
  await page.evaluate(()=>document.querySelector('.drg-isl .drg-b[tabindex]').focus());await page.keyboard.press('Enter');await w(600);
  const t1=await page.evaluate(()=>({h:(document.querySelector('#main>.drg-pan h2')||{}).textContent,f:document.activeElement&&document.activeElement.tagName}));
  log('Enter на постройке: панель',t1.h,'фокус в',t1.f);await shot('1-kbd');
  await page.keyboard.press('Escape');await w(500);log('Escape: фокус вернулся на постройку',await page.evaluate(()=>!!(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('.drg-b'))));
  // «Мои постройки»
  await page.click('.drg-zm [data-v=blds]');await w(500);log('Мои постройки:',await page.evaluate(()=>document.querySelectorAll('.drg-bls li').length),'строк');await shot('2-blds');
  // история: «Назад» закрывает панель, потом весь экран, потом остров
  const where=()=>page.evaluate(()=>({view:document.querySelector('.drg-map.full')?'full':document.querySelector('.drg-map')?'island':'other',pan:(document.querySelector('#main>.drg-pan h2')||{}).textContent||'',hash:location.hash}));
  log('перед «Назад»',JSON.stringify(await where()));
  await page.goBack();await w(600);log('«Назад» 1',JSON.stringify(await where()));
  await page.click('[data-act=drgpanel][data-v=shop]');await w(500);log('открыл «Строить»',JSON.stringify(await where()));
  await page.reload();await w(2500);log('после перезагрузки',JSON.stringify(await where()));await shot('3-reload');
  await page.click('#main>.drg-pan [data-act=drgpanel][data-v=""]');await w(500);log('закрыл кнопкой',JSON.stringify(await where()));
  await page.goBack();await w(700);log('«Назад» 2',JSON.stringify(await where()));
  await page.goBack();await w(700);log('«Назад» 3',JSON.stringify(await where()));
  // ресурс
  await page.goForward();await w(700);await page.goForward();await w(700);log('«Вперёд» ×2',JSON.stringify(await where()));
  const pill=await page.$('.drg-pill[data-v="res:gold"]');if(pill){await pill.click();await w(500);log('золото:',await page.evaluate(()=>document.querySelector('#main>.drg-pan h2').textContent));await shot('4-gold')}
}
