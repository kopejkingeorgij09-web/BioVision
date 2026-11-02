/* Драконы 5.0: головоломки дня от лёгкой к сложной (решение нажатиями, кнопками и клавиатурой, ошибки, отмена, заметки, золото), задания недели, рейтинг и визит в гости.
   Запуск: SCEN=scen_play.js DRAG="$(cat isle-many.json)" W=390 H=844 TOUCH=1 node hx.js ../.. ./out */
module.exports=async(page,{need,store,UID,OUT})=>{const w=t=>page.waitForTimeout(t),W=process.env.W,shot=n=>page.screenshot({path:`${OUT}/play-${W}-${n}.png`});
  const T=new Date().toISOString(),P=`srs/${UID}/meta/dragons`;
  /* вторая ученица с витриной острова: её можно позвать в рейтинг и сходить в гости */
  store.set('people/u_test2',{d:{label:'Вторая'},t:T});
  const other=JSON.parse(JSON.stringify(store.get(P).d));
  store.set('arena/u_test2/isle/show',{d:{v:1,name:'Вторая',lvl:12,xp:3000,stars:9,dragons:other.dragons.length,rar:2,isl2:false,at:T,
    snap:{land:other.land,isl2:null,bld:other.bld.map(b=>({id:b.id,type:b.type,x:b.x,y:b.y,lvl:b.lvl||1})),dragons:other.dragons.map(d=>({id:d.id,name:d.name,genome:d.genome,lvl:d.lvl,home:d.home}))}},t:T});
  await page.reload();await w(2500);
  await page.click('[data-act="go"][data-v="cards"]');await w(600);await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(800);
  await page.click('[data-act="drgopen"][data-full]');await w(2500);
  const gold=()=>Math.floor(store.get(P).d.bal.gold);
  /* головоломки (5.0): вкладки от лёгкой к сложной, правила по пунктам, подсветка ошибок, отмена, заметки */
  await page.click('[data-act=drgpanel][data-v=more]');await w(500);await page.click('#main>.drg-pan [data-v=pz]');await w(1200);
  const tabs=await page.evaluate(()=>[...document.querySelectorAll('.pztab')].map(b=>b.textContent.replace(/\s+/g,' ').trim()));console.log('вкладки',JSON.stringify(tabs));
  need(tabs.length===3&&/Лёгкая/.test(tabs[0])&&/Средняя/.test(tabs[1])&&/Сложная/.test(tabs[2]),'три головоломки: лёгкая, средняя, сложная');
  need(await page.evaluate(()=>document.querySelectorAll('.pzr[open] ol li').length>=2),'правила по пунктам открыты');await shot('1-pz');
  const day=await page.evaluate(()=>typeof today==='function'?today():null);need(!!day,'дата страницы');
  const sol=await page.evaluate(([u,d])=>DRPZ.KINDS.map(k=>{const p=DRPZ.make(k.kind,DRPZ.seedOf(u,d));return {k:k.kind,sol:p.sol,given:p.given||null,N:p.N}}),[UID,day]);
  const g0=gold(),bad=()=>page.evaluate(()=>document.querySelectorAll('.pzc.bad').length);
  /* лёгкая — бинарио 6×6: нажатиями (пусто → 0 → 1) */
  const bin=sol.find(x=>x.k==='bin');need(bin.N===6,'лёгкая — 6×6');
  for(let i=0;i<6;i++)for(let j=0;j<6;j++){if(bin.given[i][j]!=null)continue;const times=bin.sol[i][j]===0?1:2;
    for(let t=0;t<times;t++){await page.click(`#pz-bin .pzc[data-i="${i}"][data-j="${j}"]`);await w(20)}}
  need(await bad()===0,'верное бинарио без красных клеток');
  await page.click('[data-act=drgpzc][data-k=bin]');await w(400);console.log('сообщение',await page.evaluate(()=>(document.querySelector('#toast')||{}).textContent));await w(1100);
  need(gold()===g0+60,'Бинарио решено нажатиями: +60 золота');
  /* средняя — кендоку: повтор в строке подсвечивается, ⌘/Ctrl+Z отменяет, заметки карандашом */
  await page.click('[data-act=drgpztab][data-k=ken]');await w(400);
  const ken=sol.find(x=>x.k==='ken'),v0=ken.sol[0][0];
  await page.click('#pz-ken .pzc[data-i="0"][data-j="0"]');await page.keyboard.press(String(v0));await w(60);
  await page.click('#pz-ken .pzc[data-i="0"][data-j="1"]');await page.keyboard.press(String(v0));await w(150);
  const b1=await bad();need(b1>=2,'повтор в строке подсвечен красным: '+b1);await shot('1b-pz-bad');
  await page.keyboard.press('Control+z');await w(150);need(await bad()===0,'отмена хода убрала повтор');
  await page.keyboard.press('n');await w(80);await page.keyboard.press(String(ken.sol[0][1]));await page.keyboard.press(String(ken.sol[0][1]%5+1));await w(120);
  const notes=await page.evaluate(()=>(document.querySelector('#pz-ken .pzc[data-i="0"][data-j="1"] .pzm')||{}).textContent||'');need(notes.length===2,'две заметки в клетке: '+notes);
  await page.keyboard.press('n');await w(80);
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){await page.click(`#pz-ken .pzc[data-i="${i}"][data-j="${j}"]`);await w(15);await page.click(`.pzn[data-k=ken][data-n="${i===4&&j===4?(ken.sol[4][4]%5)+1:ken.sol[i][j]}"]`);await w(15)}
  await page.click('[data-act=drgpzc][data-k=ken]');await w(1000);need(gold()===g0+60,'с ошибкой золота нет');
  await page.click('#pz-ken .pzc[data-i="4"][data-j="4"]');await page.click(`.pzn[data-k=ken][data-n="${ken.sol[4][4]}"]`);await w(200);
  await page.click('[data-act=drgpzc][data-k=ken]');await w(1500);need(gold()===g0+160,'Кендоку решено: +100 золота');
  /* сложная — небоскрёбы: стрелками и цифрами с клавиатуры */
  await page.click('[data-act=drgpztab][data-k=sky]');await w(400);
  const sky=sol.find(x=>x.k==='sky');
  await page.click('#pz-sky .pzc[data-i="0"][data-j="0"]');await w(40);
  for(let i=0;i<5;i++){for(let j=0;j<5;j++){await page.keyboard.press(String(sky.sol[i][j]));await w(15);if(j<4){await page.keyboard.press('ArrowRight');await w(15)}}
    if(i<4){await page.keyboard.press('ArrowDown');for(let j=0;j<4;j++)await page.keyboard.press('ArrowLeft');await w(20)}}
  const okClues=await page.evaluate(()=>document.querySelectorAll('.pzk.ok').length);need(okClues>=8,'подсказки небоскрёбов загорелись зелёным: '+okClues);
  await page.click('[data-act=drgpzc][data-k=sky]');await w(1500);
  need(gold()===g0+300,'Небоскрёбы решены с клавиатуры: всего +300 за день');
  const okTabs=await page.evaluate(()=>document.querySelectorAll('.pztab.ok').length);need(okTabs===3,'все три вкладки отмечены решёнными');await shot('2-pz-done');
  /* задания недели */
  await page.click('#main>.drg-pan [data-v=""]');await w(400);await page.click('[data-act=drgpanel][data-v=more]');await w(500);await page.click('#main>.drg-pan [data-v=week]');await w(800);
  const wq=await page.evaluate(()=>[...document.querySelectorAll('.wq b')].map(b=>b.textContent));console.log('задания недели',JSON.stringify(wq));need(wq.length===3,'три задания недели');await shot('3-week');
  /* рейтинг и визит */
  await page.click('#main>.drg-pan [data-v=""]');await w(400);await page.click('[data-act=drgpanel][data-v=more]');await w(500);await page.click('#main>.drg-pan [data-v=top]');await w(1500);
  const top=await page.evaluate(()=>[...document.querySelectorAll('.top li')].map(l=>l.textContent.replace(/\s+/g,' ').trim()));console.log('рейтинг',JSON.stringify(top));
  need(top.some(x=>/Вторая/.test(x)),'в рейтинге вторая ученица');await shot('4-top');
  await page.click('[data-act=drgvisit][data-v=u_test2]');await w(2500);
  const v=await page.evaluate(()=>({guest:(document.querySelector('.drg-guest')||{}).textContent||'',b:document.querySelectorAll('.drg-world .drg-b').length,pills:document.querySelectorAll('.drg-hud-r button.drg-pill').length}));
  console.log('в гостях',JSON.stringify(v));need(/В гостях у Вторая/.test(v.guest)&&v.b>0,'остров второй ученицы открыт в гостях');need(v.pills===0,'в гостях не видно чужого кошелька');await shot('5-visit');
  const before=JSON.stringify(store.get(P).d.bld);await page.click('[data-act=drgvisit][data-v=""]');await w(1800);
  const home=await page.evaluate(()=>!document.querySelector('.drg-guest')&&!!document.querySelector('.drg-map.full'));need(home,'вернулась на свой остров');
  need(JSON.stringify(store.get(P).d.bld)===before,'визит ничего не изменил в своём острове')};
