/* регресс платформы: вход, «Карточки» без документа драконов, повтор 5 карточек, запись srs и серии, бактерии по умолчанию, перезагрузка */
module.exports=async(page,{OUT,store,UID,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);
  log('вход: шапка',await page.evaluate(()=>!!document.querySelector('header,#top,.top')),'имя',await page.evaluate(()=>document.body.innerText.includes('Тестовая')));
  await page.click('[data-act="go"][data-v="cards"]');await page.waitForTimeout(800);
  await page.screenshot({path:`${OUT}/reg-${tag}-1-cards.png`,fullPage:false});
  log('переключатель мотивации',await page.evaluate(()=>[...document.querySelectorAll('[data-act=drgmode]')].map(b=>b.dataset.v+':'+b.getAttribute('aria-pressed')).join(' ')));
  const before=[...store.keys()].filter(k=>k.startsWith('srs/')).length;
  await page.click('[data-act="deck"]');await page.waitForTimeout(700);await page.click('[data-act="study"]');await page.waitForTimeout(700);
  for(let i=0;i<5;i++){const sh=await page.$('[data-act="show"]');if(sh){await sh.click();await page.waitForTimeout(250)}
    const r=await page.$('[data-act="rate"][data-g="3"]')||await page.$('[data-act="rate"]');if(!r){log('нет кнопки оценки на шаге',i);break}await r.click();await page.waitForTimeout(350)}
  await page.screenshot({path:`${OUT}/reg-${tag}-2-study.png`});
  await page.click('[data-act="endreview"]').catch(()=>{});await page.waitForTimeout(1200);
  const keys=[...store.keys()].filter(k=>k.startsWith('srs/'));
  const streak=(store.get(`srs/${UID}/meta/streak`)||{}).d;
  log('srs документов было',before,'стало',keys.length,'серия сегодня',streak&&streak.days&&streak.days[new Date().toISOString().slice(0,10)],'документ драконов',!!store.get(`srs/${UID}/meta/dragons`));
  await page.reload();await page.waitForTimeout(2000);await page.click('[data-act="go"][data-v="cards"]');await page.waitForTimeout(800);
  log('после перезагрузки серия',JSON.stringify((store.get(`srs/${UID}/meta/streak`)||{}).d.days));
  await page.screenshot({path:`${OUT}/reg-${tag}-3-reload.png`});
  const sd=(store.get(`srs/${UID}/meta/streak`)||{}).d;need(sd&&sd.days&&sd.days[new Date().toISOString().slice(0,10)]>=8,'повторённые карточки засчитаны в серию дня');
  need(keys.length>before,'прогресс карточек записан');
  const hs=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);log('гориз. прокрутка',hs);need(!hs,'нет горизонтальной прокрутки')};
