/* этап 4: карта похода по регионам, бои на двоих, особенности противников, общий вход «Бои», «Назад», осмотр → «В бой» */
module.exports=async(page,{OUT,store,UID,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/camp-${tag}-${n}.png`});
  const st=()=>page.evaluate(()=>DRFIGHT.state());
  const ow=()=>page.evaluate(()=>{const e=document.querySelector('.drf');return {page:document.documentElement.scrollWidth>innerWidth,drf:e?e.scrollWidth>e.clientWidth:null}});
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await page.waitForTimeout(900);
  await page.click('[data-act="drgopen"][data-full]');await page.waitForTimeout(1800);
  await page.click('.drg-dock [data-act="drgfight"]');await page.waitForTimeout(2200);
  let s=await st();log('карта: регион',s.reg,'выбран',s.sel,'гориз. прокрутка',JSON.stringify(await ow()));
  const mapInfo=()=>page.evaluate(()=>({tabs:[...document.querySelectorAll('.drf-rt')].map(t=>t.textContent.replace(/\s+/g,' ').trim()),
    pins:[...document.querySelectorAll('.drf-pin')].map(p=>p.dataset.id+(p.classList.contains('done')?'✓':'')+(p.classList.contains('goal')?'◎':'')+(p.classList.contains('lock')?'🔒':'')).join(' '),
    tot:document.querySelector('.drf-tot').textContent,card:(document.querySelector('.drf-nc h3')||{}).textContent,
    pinMin:Math.min(...[...document.querySelectorAll('.drf-pin')].map(p=>p.getBoundingClientRect().width)),
    overlap:(()=>{const r=[...document.querySelectorAll('.drf-pin .drf-pc')].map(p=>p.getBoundingClientRect());let o=0;r.forEach((a,i)=>r.slice(i+1).forEach(b=>{if(a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom)o++}));return o})()}));
  const mi=await mapInfo();log('карта',JSON.stringify(mi));need(mi.tabs.length>=4,'на карте вкладки всех регионов');need(!mi.overlap,'метки узлов не перекрываются');need(!(await ow()).page,'нет горизонтальной прокрутки');await shot('1-map');
  /* отмели: цель t3 */
  await page.click('[data-fk="reg"][data-v="tide"]');await page.waitForTimeout(500);s=await st();log('отмели: выбран',s.sel,JSON.stringify(await mapInfo()));await shot('2-tide');
  /* закрытый узел: карточка объясняет, почему */
  await page.click('.drf-pin[data-id="t5"]');await page.waitForTimeout(300);log('закрытый t5:',await page.evaluate(()=>document.querySelector('.drf-nc').textContent.replace(/\s+/g,' ').trim()));
  /* закрытый регион тоже можно посмотреть */
  await page.click('[data-fk="reg"][data-v="peaks"]');await page.waitForTimeout(400);log('пики',JSON.stringify(await mapInfo()));await shot('3-peaks');
  /* бой на двоих: t2 */
  await page.click('[data-fk="reg"][data-v="tide"]');await page.waitForTimeout(300);await page.click('.drf-pin[data-id="t2"]');await page.waitForTimeout(300);
  await page.click('.drf-nc [data-fk="prep"]');await page.waitForTimeout(1500);s=await st();
  log('t2: состав',JSON.stringify(s.pick),'кнопка',await page.evaluate(()=>document.querySelector('[data-fk=start]').textContent));
  const pks=await page.$$('.drf-pk:not(.on)');await pks[0].click();await page.waitForTimeout(300);s=await st();log('t2: выбор третьего заменяет второго, состав',JSON.stringify(s.pick));await shot('4-t2');
  await page.click('[data-fk="map"]');await page.waitForTimeout(500);
  /* узел с особенностью: t3, регенерация; бой на авто, смотрим, что события показаны */
  await page.click('.drf-pin[data-id="t3"]');await page.waitForTimeout(200);await page.click('.drf-nc [data-fk="prep"]');await page.waitForTimeout(1500);s=await st();
  log('t3: состав',JSON.stringify(s.pick),'особенности',await page.evaluate(()=>[...document.querySelectorAll('.drf-trl li')].map(x=>x.textContent.slice(0,40)).join(' | ')),'тактика',await page.evaluate(()=>document.querySelector('.drf-tac').textContent.slice(0,60)));
  log('гориз. прокрутка',JSON.stringify(await ow()));await shot('5-t3prep');
  await page.click('[data-fk="start"]');await page.waitForTimeout(3000);await page.click('[data-fk="auto"]');await page.click('[data-fk="speed"]');
  let seen=false;const t0=Date.now();while(Date.now()-t0<120000){s=await st();if(!s||s.screen==='result')break;
    if(!seen&&await page.evaluate(()=>!!document.querySelector('.drf-tr'))){seen=true;await shot('6-t3fight')}await page.waitForTimeout(300)}
  s=await st();log('t3: итог',JSON.stringify(s.result),'раундов',s.round,'значок особенности в бою',seen);need(s.screen==='result','бой t3 дошёл до итога');
  await page.waitForTimeout(1500);await shot('7-t3res');
  const saved=(store.get(`srs/${UID}/meta/dragons`)||{}).d;log('в базе pve.best',JSON.stringify(saved&&saved.pve.best));
  await page.click('[data-fk="map"]');await page.waitForTimeout(600);s=await st();log('после боя карта: регион',s.reg,'выбран',s.sel,JSON.stringify(await mapInfo()));
  /* «Турнир бактерий» из шапки похода → страница «Бои» */
  await page.click('[data-fk="arena"]');await page.waitForTimeout(1200);
  log('страница',await page.evaluate(()=>(document.querySelector('#main .page-h h1')||{}).textContent),'заголовок',await page.evaluate(()=>(document.querySelector('#main h1')||{}).textContent),'вкладка',await page.evaluate(()=>[...document.querySelectorAll('[data-act=go][data-v=arena]')].map(x=>x.textContent.trim()||x.getAttribute('aria-label')).join(',')));
  log('карточки боёв',await page.evaluate(()=>[...document.querySelectorAll('.drg-hubc')].map(x=>x.textContent.replace(/\s+/g,' ').trim().slice(0,90)).join(' || ')),'гориз. прокрутка',JSON.stringify(await ow()));
  await shot('8-hub');
  /* поход со страницы «Бои», «Назад» закрывает его и остаётся на «Боях» */
  await page.click('.drg-hub [data-act="drgfight"]');await page.waitForTimeout(1500);log('поход открыт со страницы «Бои»',!!await page.$('.drf'),'история',await page.evaluate(()=>JSON.stringify(history.state)));
  await page.goBack();await page.waitForTimeout(900);need(!await page.$('.drf'),'«Назад» закрывает поход со страницы «Бои»');log('«Назад»: поход закрыт',!await page.$('.drf'),'страница',await page.evaluate(()=>(document.querySelector('#main .page-h h1')||{}).textContent));
  await page.click('.drg-hub [data-act="drgfight"]');await page.waitForTimeout(1200);await page.keyboard.press('Escape');await page.waitForTimeout(600);
  log('Esc: поход закрыт',!await page.$('.drf'),'страница',await page.evaluate(()=>(document.querySelector('#main .page-h h1')||{}).textContent),'история',await page.evaluate(()=>JSON.stringify(history.state)));
  /* осмотр → «В бой»: выбранный дракон первым в составе */
  await page.evaluate(()=>document.querySelector('[data-act="go"][data-v="cards"]').click());await page.waitForTimeout(500);await page.click('[data-act="drgopen"][data-full]');await page.waitForTimeout(1500);
  await page.click('.drg-dock [data-v="dragons"]').catch(()=>{});await page.waitForTimeout(600);
  const ins=await page.$('#main>.drg-pan [data-act="drginsp"]');if(ins){await ins.click();await page.waitForTimeout(2500)}
  const nm=await page.evaluate(()=>(document.querySelector('.dri h2')||{}).textContent);
  await page.click('.dri [data-dk="fight"]');await page.waitForTimeout(2000);
  log('из осмотра «'+nm+'»: поход',!!await page.$('.drf'),'подсказка',await page.evaluate(()=>(document.querySelector('.drf-want')||{}).textContent));await shot('9-want');
  await page.click('.drf-nc [data-fk="prep"]');await page.waitForTimeout(1500);s=await st();
  need(!!s.pick[0],'из осмотра выбранный дракон в составе');log('подготовка: первым',s.pick[0],await page.evaluate(()=>(document.querySelector('.drf-pk.on b')||{}).textContent));
  await page.click('[data-fk="map"]');await page.waitForTimeout(400);await page.click('[data-fk="close"]');await page.waitForTimeout(600);
  await page.click('.drg-dock [data-act="drgfull"][data-v="0"]').catch(()=>{});await page.waitForTimeout(800);
  log('остров закрыт кнопкой: адрес',page.url().replace(/^.*\//,''),'история',await page.evaluate(()=>JSON.stringify(history.state)));
};
