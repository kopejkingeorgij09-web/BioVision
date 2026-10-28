/* «Первый потомок» с нового профиля: режим драконов → цель → кормление → стройка → пара → яйцо → вылупление.
   Ресурсы новому профилю дописываются в подставную базу (учебный fixture), ожидание закрывается самоцветами */
module.exports=async(page,{OUT,store,UID,writes,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/path-${tag}-${n}.png`});
  const w=t=>page.waitForTimeout(t),P=`srs/${UID}/meta/dragons`;
  const inPanel=sel=>page.$(`.drg-bp ${sel}`);
  const nowStep=()=>page.evaluate(()=>{const li=document.querySelector('.drg-st.now b');return li?li.textContent:'(все шаги пройдены)'});
  /* на телефоне открытая панель закрывает нижний ряд: сначала закрыть её, как сделала бы ученица */
  const open=async()=>{const g=await page.$('.drg-goal');if(g){await g.click()}else{const x=await page.$('#main>.drg-pan [data-act=drgpanel][data-v=""],#main>.drg-pan [data-act=drgsel][data-id=""]');if(x){await x.click();await w(400)}
    await page.click('[data-act=drgpanel][data-v=breed]')}await w(500)};
  await page.click('[data-act="go"][data-v="cards"]');await w(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]');await w(1200);
  need(!!store.get(P),'новому профилю создан документ острова');log('новый профиль: документ создан',!!store.get(P),'цель в «Карточках»:',await page.evaluate(()=>{const n=document.querySelector('.drg-notes');return n?n.textContent.slice(0,90):'—'}));
  await shot('0-cards');
  const d=store.get(P).d;d.bal.xp=Math.max(d.bal.xp,112);d.bal.gold=5000;d.bal.food=600;d.bal.gems=200;d.rev=(d.rev||0)+1;d.op='fixture';
  await page.reload();await w(1800);await page.click('[data-act="go"][data-v="cards"]');await w(600);
  await page.click('[data-act="drgopen"][data-full]');await w(1500);
  log('цель на острове:',await page.evaluate(()=>(document.querySelector('.drg-goal')||{}).textContent||'—'));
  await shot('1-island');await open();log('шаг сейчас:',await nowStep());await shot('2-path');
  for(let i=0;i<20;i++){const b=await inPanel('[data-t=feed]:not([disabled])');if(!b)break;await b.click();await w(400)}
  log('после кормления шаг:',await nowStep());
  for(const type of ['nest','hatch']){const b=await inPanel(`[data-act=drgbuild][data-type=${type}]:not([disabled])`);if(!b){log('нет кнопки постройки',type);continue}
    await b.click();await w(500);const t=await page.$('[data-act=drgtile]');if(!t){log('нет клетки');continue}
    await page.evaluate(()=>document.querySelector('[data-act=drgtile]').dispatchEvent(new MouseEvent('click',{bubbles:true})));await w(600);
    const sp=await page.$('.drg-pan [data-t=speed]');if(sp){await sp.click();await w(500)}await open()}
  log('после стройки шаг:',await nowStep());await shot('3-built');
  const nb=await inPanel('[data-act=drgsel]');const nest=await page.evaluate(()=>{const b=[...document.querySelectorAll('.drg-bp [data-act=drgsel]')].find(x=>/Гнездовье/.test(x.textContent));return b?b.dataset.id:null});
  if(nest){await page.evaluate(id=>[...document.querySelectorAll('.drg-bp [data-act=drgsel]')].find(x=>x.dataset.id===id).click(),nest);await w(600);
    await page.click('[data-act=drgbreed]');await w(700);const sp=await page.$('.drg-pan [data-t=speed]');if(sp){await sp.click();await w(500)}}
  await open();log('после пары шаг:',await nowStep());
  const eg=await inPanel('[data-t=egg]:not([disabled])');if(eg){await eg.click();await w(600)}
  await open();log('яйцо в Инкубаторе, шаг:',await nowStep());await shot('4-egg');
  const hid=await page.evaluate(()=>{const b=[...document.querySelectorAll('.drg-bp [data-act=drgsel]')].find(x=>/Инкубатор/.test(x.textContent));return b&&b.dataset.id});
  if(hid){await page.evaluate(id=>document.querySelector(`.drg-bp [data-act=drgsel][data-id="${id}"]`).click(),hid);await w(500);const sp=await page.$('.drg-pan [data-t=speed]');if(sp){await sp.click();await w(500)}}
  await open();const hb=await inPanel('[data-t=hatch]:not([disabled])');log('перед вылуплением:',await page.evaluate(()=>[...document.querySelectorAll('.drg-bp .drg-st.now .drg-sr')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join(' | ')));
  if(hb){await hb.click();await w(900)}
  log('панель:',await page.evaluate(()=>(document.querySelector('.drg-pan h2')||{}).textContent),'строка сохранения:',await page.evaluate(()=>(document.querySelector('.drg-baby .drg-sv')||{}).textContent||'—'));
  /* 5.0: у птенца разбор происхождения: гены от матери и отца, пол, что было в мейозе */
  const og=await page.evaluate(()=>{const o=document.querySelector('.drg-baby .drg-orig');return o?{rows:o.querySelectorAll('tbody tr').length,sex:/Пол\./.test(o.textContent),mei:o.querySelectorAll('.drg-cr li').length}:null});
  log('происхождение',JSON.stringify(og));need(og&&og.rows>=14&&og.sex,'у птенца есть разбор: гены от матери и отца и пол');
  if(og){await page.evaluate(()=>{const o=document.querySelector('.drg-baby .drg-orig');o.open=true;o.scrollIntoView()});await w(300);await shot('6-origin')}
  await shot('5-baby');
  const s=store.get(P).d;need((s.log||[]).filter(r=>r.child).length===1,'в базе ровно один потомок в журнале');log('в базе: потомков в журнале',(s.log||[]).filter(r=>r.child).length,'драконов',s.dragons.length,'rev',s.rev);
  await page.click('[data-act=drgpanel][data-v=breed]').catch(()=>{});await w(500);log('после потомка:',await page.evaluate(()=>(document.querySelector('.drg-bp h2')||{}).textContent),'цель в шапке',!!await page.$('.drg-goal'));
  await shot('6-done')}
