/* этап 5: шкалы на странице «Ещё», журнал с теорией и архивом, кормление, паспорт с источниками, испорченное сохранение.
   SCEN=scen_st5.js ./matrix.sh <выход> isle-st5.json */
module.exports=async(page,{OUT,store,UID,writes,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/st5-${tag}-${n}.png`});
  const w=t=>page.waitForTimeout(t),P=`srs/${UID}/meta/dragons`;
  const click=sel=>page.evaluate(s=>{const b=document.querySelector(s);if(b)b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return !!b},sel);
  const over=()=>page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  const txt=sel=>page.evaluate(s=>{const e=document.querySelector(s);return e?e.textContent.replace(/\s+/g,' ').trim():'—'},sel);
  await page.click('[data-act="go"][data-v="cards"]');await w(600);
  await click('[data-act="drgopen"][data-full]');await w(1500);
  await click('[data-act=drgpanel][data-v=more]');await w(600);
  need(await page.evaluate(()=>document.querySelectorAll('.drg-sc').length)>=3,'в «Ещё» три шкалы');need(await over()<=0,'нет горизонтальной прокрутки в «Ещё»');log('«Ещё»: шкал',await page.evaluate(()=>document.querySelectorAll('.drg-sc').length),'гориз. прокрутка',await over());
  log('остров:',(await txt('.drg-sc')).slice(0,220));
  await page.evaluate(()=>{const p=document.querySelector('.drg-scl');if(p)p.scrollIntoView({block:'start'})});await w(300);await shot('1-more');
  await click('[data-act=drgpanel][data-v=journal]');await w(600);
  await page.evaluate(()=>{const d=document.querySelector('details.drg-th');if(d){d.open=true;d.scrollIntoView({block:'start'})}});await w(400);
  log('журнал: архив',await page.evaluate(()=>/из архива/.test(document.body.textContent)),'теория',await page.evaluate(()=>!!document.querySelector('details.drg-th')),'прокрутка',await over());
  need(await page.evaluate(()=>!!document.querySelector('details.drg-th')),'в журнале есть теория');need(await over()<=0,'журнал без горизонтальной прокрутки');
  await shot('2-journal');
  await click('[data-act=drgpanel][data-v=dragons]');await w(600);
  log('кормление:',await txt('.drg-feedi'));await page.evaluate(()=>{const e=document.querySelector('.drg-feedi');if(e)e.scrollIntoView({block:'center'})});await w(300);await shot('3-feed');
  await click('button[data-act=drginsp]');await w(2500);
  await click('.dri-geno');await w(900);await page.evaluate(()=>{const b=document.querySelector('.dri-body');if(b)b.scrollTop=0});
  log('паспорт открыт',await page.evaluate(()=>!!document.querySelector('#dri-law')),'источников',await page.evaluate(()=>document.querySelectorAll('ol.dri-src li').length));
  need(await page.evaluate(()=>document.querySelectorAll('ol.dri-src li').length)>=2,'у паспорта есть источники');
  await shot('4-passport');
  await page.click('.dri-jump');await w(900);log('адрес после ссылки',await page.evaluate(()=>location.hash));
  log('после «Закон»: фокус',await page.evaluate(()=>{const a=document.activeElement;return a?(a.closest('#dri-law')?'в разделе':a.tagName):'—'}),'прокрутка',await over());
  await shot('5-law');
  await page.keyboard.press('Escape');await w(600);
  /* испорченное сохранение: генотип первого дракона испорчен в базе */
  const d=store.get(P).d;d.dragons[0].genome={sex:'F'};d.rev=(d.rev||0)+1;d.op='broken';const snap=JSON.stringify(d),n0=writes.length;
  await page.reload();await w(1800);await page.click('[data-act="go"][data-v="cards"]');await w(600);
  log('в «Карточках» блок о повреждении',await page.evaluate(()=>!!document.querySelector('.drg-broken')));await shot('6-broken-cards');
  await page.evaluate(()=>{history.pushState(null,'','#');});
  log('испорчено: блок',await page.evaluate(()=>!!document.querySelector('.drg-broken')),'текст',(await txt('.drg-broken')).slice(0,120));
  await shot('7-broken');
  need(await page.evaluate(()=>!!document.querySelector('.drg-broken')),'испорченное сохранение показано блоком');need(!writes.slice(n0).some(x=>x.endsWith(P))&&JSON.stringify(store.get(P).d)===snap,'испорченный документ не перезаписан');
  log('записей в остров после открытия',writes.slice(n0).filter(x=>x.endsWith(P)).length,'документ не тронут',JSON.stringify(store.get(P).d)===snap)}
