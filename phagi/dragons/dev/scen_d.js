/* этап D Драконов 4.0: «Сегодня повторено N», готовые Гнездовье и Инкубатор, закрытое второе место до серии 7 дней,
   открытие места за серию (подставная серия в памяти стенда), десять регионов похода, боковые тропы, правило испытания
   закрывает «В бой», подарок E2 за победу. Все записи идут только в память стенда. */
module.exports=async(page,{OUT,store,UID,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/d-${tag}-${n}.png`});
  const ow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const txt=sel=>page.evaluate(s=>{const e=document.querySelector(s);return e?e.textContent.replace(/\s+/g,' ').trim():null},sel);
  const click=async(sel,ms)=>{await page.evaluate(s=>{const e=document.querySelector(s);if(e)e.click()},sel);await page.waitForTimeout(ms||600)};
  /* кнопка действия, которой сейчас нет на экране (открыть здание по id): та же обработка data-act, что у настоящих кнопок */
  const actBtn=async(attrs,ms)=>{await page.evaluate(a=>{const b=document.createElement('button');Object.entries(a).forEach(([k,v])=>b.setAttribute(k,v));document.querySelector('#main').appendChild(b);b.click();b.remove()},attrs);await page.waitForTimeout(ms||800)};
  const st=()=>page.evaluate(u=>{const x=DRGUI.stateOf(u);return x&&{bld:x.st.bld.map(b=>({id:b.id,t:b.type||b.t,lvl:b.lvl,build:!!b.build,slots:b.slots?b.slots.length:null})),ev:x.st.ev,evK:x.st.evK,slot7:x.st.slot7,slot7new:x.st.slot7new}},UID);

  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await page.waitForTimeout(900);
  const body=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' '));
  need(/Сегодня повторено 7/.test(body),'на странице видно «Сегодня повторено 7»');
  let s=await st();log('состояние',JSON.stringify(s));
  const nest=s.bld.find(b=>b.t==='nest'),hatch=s.bld.find(b=>b.t==='hatch');
  need(!!nest&&!nest.build,'Гнездовье есть и готово');need(!!hatch&&!hatch.build,'Инкубатор есть и готов');
  need(s.ev===1&&typeof s.evK==='number','точка перехода экономики записана (ev 1)');
  await page.click('[data-act="drgopen"][data-full]');await page.waitForTimeout(1800);
  log('шапка острова',await txt('.drg-svw'));need(/📈 7/.test(await txt('.drg-svw')||''),'в шапке острова бонус объёма 📈 7');
  await actBtn({'data-act':'drgsel','data-id':hatch.id});
  const hp=await txt('.drg-pan');log('Инкубатор',hp&&hp.slice(0,260));
  if(hatch.slots===1){need(/Второе место/.test(hp||'')&&/2 из 7/.test(hp||''),'закрытое второе место с прогрессом серии 2 из 7 (сегодня 7 карточек, до 15 не дотянуло)')}
  else log('у острова уже',hatch.slots,'мест: закрытого места нет');
  need(!await ow(),'нет горизонтальной прокрутки');await shot('1-hatch');
  /* серия 7 дней подряд: место открывается само и показывается сообщение */
  const day=o=>{const d=new Date();d.setDate(d.getDate()+o);return d.toISOString().slice(0,10)};
  const days={};for(let i=-6;i<=0;i++)days[day(i)]=i===0?16:20;
  store.set(`srs/${UID}/meta/streak`,{d:{days,ack:null,muts:[]},t:new Date().toISOString()});
  await page.reload();await page.waitForTimeout(2000);
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);
  await page.click('[data-act="drgopen"][data-full]').catch(()=>{});await page.waitForTimeout(1800);
  s=await st();log('после серии 7',JSON.stringify(s.bld.find(b=>b.t==='hatch')),'slot7',s.slot7,'new',s.slot7new);
  need(s.slot7===true&&s.bld.find(b=>b.t==='hatch').slots>=2,'серия 7 дней открыла второе место');
  const note=await txt('.drg-svw [data-t="ack"]');log('сообщение',note);need(!!note,'сообщение об открытом месте');await shot('2-slot7');
  await click('.drg-svw [data-t="ack"]',900);s=await st();need(!s.slot7new&&s.slot7===true,'«Понятно» убирает сообщение, место остаётся');
  /* подарок: победа в e7 (мини-босс) записана в pve, на карточке узла кнопка «Забрать подарок» */
  const doc=store.get(`srs/${UID}/meta/dragons`).d;doc.pve=doc.pve||{v:1,best:{},wins:{},at:{}};doc.pve.best.e7=1;doc.pve.wins.e7=1;
  store.set(`srs/${UID}/meta/dragons`,{d:doc,t:new Date().toISOString()});
await page.reload();await page.waitForTimeout(2000);
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);
  await page.click('[data-act="drgopen"][data-full]').catch(()=>{});await page.waitForTimeout(1800);
  /* поход: десять регионов, боковые тропы и подписи узлов */
  await click('.drg-dock [data-act="drgfight"]',2200);
  const mi=await page.evaluate(()=>({tabs:document.querySelectorAll('.drf-rt').length,pins:document.querySelectorAll('.drf-pin').length,side:document.querySelectorAll('.drf-pin.side').length,
    overlap:(()=>{const r=[...document.querySelectorAll('.drf-pin .drf-pc')].map(p=>p.getBoundingClientRect());let o=0;r.forEach((a,i)=>r.slice(i+1).forEach(b=>{if(a.left<b.right-2&&b.left<a.right-2&&a.top<b.bottom-2&&b.top<a.bottom-2)o++}));return o})()}));
  log('карта',JSON.stringify(mi));need(mi.tabs===10,'десять вкладок регионов');need(mi.pins===16&&mi.side===8,'16 узлов, из них 8 на боковых тропах');need(!mi.overlap,'метки узлов не перекрываются');
  need(!await ow(),'нет горизонтальной прокрутки на карте');await shot('3-map');
  /* испытание «разные стихии» (e13 после e5): одинаковые наборы стихий закрывают «В бой» */
  await click('.drf-pin[data-id="e13"]',400);const nc=await txt('.drf-nc');log('e13',nc&&nc.slice(0,200));need(/Испытание/.test(nc||'')&&/разные наборы стихий/.test(nc||''),'карточка испытания с правилом');
  await click('.drf-nc [data-fk="prep"]',1500);
  const pr=await page.evaluate(()=>{const ds=DRFIGHT.state();return {pick:ds&&ds.pick,rule:(document.querySelector('.drf-rule')||{}).textContent,dis:(document.querySelector('[data-fk=start]')||{}).disabled}});
  log('подготовка e13',JSON.stringify(pr));need(!!pr.rule,'правило показано в подготовке');
  const els=await page.evaluate(u=>{const x=DRGUI.stateOf(u),G=window.DRG;return x.st.dragons.map(d=>({id:d.id,k:G.phenotype(d.genome).elements.slice().sort().join('+')}))},UID);
  const byK={};els.forEach(d=>{(byK[d.k]=byK[d.k]||[]).push(d.id)});const twin=Object.values(byK).find(a=>a.length>=2);log('одинаковые стихии',JSON.stringify(twin));
  if(twin){/* собрать состав из двух драконов с одним набором стихий */
    for(const id of (await page.evaluate(()=>DRFIGHT.state().pick)))await click(`.drf-pk[data-id="${id}"]`,250);
    for(const id of twin.slice(0,2))await click(`.drf-pk[data-id="${id}"]`,250);
    const r2=await page.evaluate(()=>({pick:DRFIGHT.state().pick,rule:(document.querySelector('.drf-rule')||{}).textContent,dis:document.querySelector('[data-fk=start]').disabled}));
    log('состав-близнецы',JSON.stringify(r2));need(r2.dis&&/не подходит/.test(r2.rule),'правило нарушено: «В бой» закрыта');await shot('4-rule')}
  else log('в фикстуре нет двух драконов с одинаковыми стихиями, проверка нарушения пропущена');
  await click('[data-fk="map"]',500);await click('.drf-pin[data-id="e7"]',400);
  const g1=await txt('.drf-nc');log('e7',g1&&g1.slice(0,240));need(/Мини-босс/.test(g1||'')&&!!await page.$('.drf-nc [data-fk="claim"]'),'у мини-босса кнопка «Забрать подарок»');await shot('5-gift');
  const n0=(await page.evaluate(u=>DRGUI.stateOf(u).st.dragons.length,UID));
  await click('.drf-nc [data-fk="claim"]',1200);
  const g2=await page.evaluate(u=>{const x=DRGUI.stateOf(u).st;return {n:x.dragons.length,gift:x.gifts&&x.gifts.e7,card:(document.querySelector('.drf-nc')||{}).textContent}},UID);
  log('после подарка',JSON.stringify({n:g2.n,gift:g2.gift}));need(g2.n===n0+1&&!!g2.gift,'подарок добавил дракона');need(/Подарок получен/.test(g2.card||''),'карточка: подарок получен');
  const saved=store.get(`srs/${UID}/meta/dragons`).d;need(saved.gifts&&saved.gifts.e7&&saved.dragons.length===n0+1,'подарок записан в базу стенда');
  const gd=saved.dragons.find(d=>d.id===saved.gifts.e7);log('геном подарка E2',JSON.stringify(gd.genome.A1||gd.genome.chroms||'').slice(0,120));
  await shot('6-gift-done');
};
