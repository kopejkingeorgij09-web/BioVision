/* Драконы 4.4: головоломки дня (решение кнопками и клавиатурой, золото), задания недели, рейтинг и визит в гости.
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
  /* головоломки */
  await page.click('[data-act=drgpanel][data-v=more]');await w(500);await page.click('#main>.drg-pan [data-v=pz]');await w(1200);
  const n=await page.evaluate(()=>document.querySelectorAll('.pzbox').length);need(n===3,'три головоломки дня');await shot('1-pz');
  const day=await page.evaluate(()=>typeof today==='function'?today():null);need(!!day,'дата страницы');
  const sol=await page.evaluate(([u,d])=>DRPZ.KINDS.map(k=>{const p=DRPZ.make(k.kind,DRPZ.seedOf(u,d));return {k:k.kind,sol:p.sol,given:p.given||null}}),[UID,day]);
  const g0=gold();
  /* бинарио: нажатиями (пусто → 0 → 1) */
  const bin=sol.find(x=>x.k==='bin');
  for(let i=0;i<8;i++)for(let j=0;j<8;j++){if(bin.given[i][j]!=null)continue;const times=bin.sol[i][j]===0?1:2;
    for(let t=0;t<times;t++){await page.click(`#pz-bin .pzc[data-i="${i}"][data-j="${j}"]`);await w(20)}}
  const ansNow=await page.evaluate(()=>[...document.querySelectorAll('#pz-bin .pzc')].map(b=>b.textContent).join(''));console.log('бинарио на экране',ansNow,'решение',bin.sol.flat().join(''));
  await page.click('[data-act=drgpzc][data-k=bin]');await w(400);console.log('сообщение',await page.evaluate(()=>(document.querySelector('#toast')||{}).textContent));await w(1100);
  need(gold()===g0+100,'Бинарио решено кнопками: +100 золота');
  /* небоскрёбы: клетка мышью, цифра с клавиатуры */
  const sky=sol.find(x=>x.k==='sky');
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){await page.click(`#pz-sky .pzc[data-i="${i}"][data-j="${j}"]`);await w(20);await page.keyboard.press(String(sky.sol[i][j]));await w(20)}
  await page.click('[data-act=drgpzc][data-k=sky]');await w(1500);
  need(gold()===g0+200,'Небоскрёбы решены с клавиатуры: +100 золота');
  /* кендоку: неверно → ничего, верно → +100 */
  const ken=sol.find(x=>x.k==='ken');
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){await page.click(`#pz-ken .pzc[data-i="${i}"][data-j="${j}"]`);await w(20);await page.click(`.pzn[data-k=ken][data-n="${i===0&&j===0?(ken.sol[0][0]%5)+1:ken.sol[i][j]}"]`);await w(20)}
  await page.click('[data-act=drgpzc][data-k=ken]');await w(1200);need(gold()===g0+200,'неверное решение золота не даёт');
  await page.click('#pz-ken .pzc[data-i="0"][data-j="0"]');await page.click(`.pzn[data-k=ken][data-n="${ken.sol[0][0]}"]`);await w(200);
  await page.click('[data-act=drgpzc][data-k=ken]');await w(1500);need(gold()===g0+300,'Кендоку решено: всего +300 за день');
  const okBoxes=await page.evaluate(()=>document.querySelectorAll('.pzbox.ok').length);need(okBoxes===3,'все три отмечены решёнными');await shot('2-pz-done');
  /* задания недели */
  await page.click('#main>.drg-pan [data-v=""]');await w(400);await page.click('[data-act=drgpanel][data-v=more]');await w(500);await page.click('#main>.drg-pan [data-v=week]');await w(800);
  const wq=await page.evaluate(()=>[...document.querySelectorAll('.wq b')].map(b=>b.textContent));console.log('задания недели',JSON.stringify(wq));need(wq.length===3,'три задания недели');await shot('3-week');
  /* рейтинг и визит */
  await page.click('#main>.drg-pan [data-v=""]');await w(400);await page.click('[data-act=drgpanel][data-v=more]');await w(500);await page.click('#main>.drg-pan [data-v=top]');await w(1500);
  const top=await page.evaluate(()=>[...document.querySelectorAll('.top li')].map(l=>l.textContent.replace(/\s+/g,' ').trim()));console.log('рейтинг',JSON.stringify(top));
  need(top.some(x=>/Вторая/.test(x)),'в рейтинге вторая ученица');await shot('4-top');
  await page.click('[data-act=drgvisit][data-v=u_test2]');await w(2500);
  const v=await page.evaluate(()=>({guest:(document.querySelector('.drg-guest')||{}).textContent||'',b:document.querySelectorAll('.drg-map.full .drg-b').length,pills:document.querySelectorAll('.drg-hud-r button.drg-pill').length}));
  console.log('в гостях',JSON.stringify(v));need(/В гостях у Вторая/.test(v.guest)&&v.b>0,'остров второй ученицы открыт в гостях');need(v.pills===0,'в гостях не видно чужого кошелька');await shot('5-visit');
  const before=JSON.stringify(store.get(P).d.bld);await page.click('[data-act=drgvisit][data-v=""]');await w(1800);
  const home=await page.evaluate(()=>!document.querySelector('.drg-guest')&&!!document.querySelector('.drg-map.full'));need(home,'вернулась на свой остров');
  need(JSON.stringify(store.get(P).d.bld)===before,'визит ничего не изменил в своём острове')};
