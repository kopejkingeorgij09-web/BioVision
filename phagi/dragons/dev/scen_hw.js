/* бонус за ДЗ: проверенная письменная ДЗ (70 %) и тест (92 %) с сегодняшней датой дают острову +5 💎 +180 🌾 ровно один раз
   (перезагрузка и новое действие не добавляют), чашке подкормку 1+3 колонии. Старые задания (до 28 окт) бонуса не дают.
   Всё в памяти стенда. */
module.exports=async(page,{store,UID,need})=>{
  const log=(...a)=>console.log('·',...a),T=new Date().toISOString();
  const put=(p,d)=>store.set(p,{d,t:T});
  put('tasks/hw1',{title:'Белки: строение',kind:'hw',max:10,to:[UID],createdAt:T,subject:'bio'});
  put('tasks/ts1',{title:'Тест по ферментам',kind:'test',to:[UID],createdAt:T,subject:'bio',q:Array.from({length:25},(_,i)=>({t:'one',q:'В'+i,o:['а','б'],ans:0}))});
  put('tasks/old',{title:'Старое ДЗ',kind:'hw',max:10,to:[UID],createdAt:'2026-10-01T10:00:00Z',subject:'bio'});
  put(`subs/${UID}/items/hw1`,{status:'submitted',text:'ответ',updatedAt:T});
  put(`grades/${UID}/items/hw1`,{score:7,feedback:'',returnedAt:T});
  put(`subs/${UID}/items/ts1`,{status:'submitted',answers:[],auto:23,updatedAt:T});
  put(`subs/${UID}/items/old`,{status:'submitted',text:'x',updatedAt:'2026-10-02T10:00:00Z'});
  put(`grades/${UID}/items/old`,{score:10,returnedAt:'2026-10-03T10:00:00Z'});
  await page.reload();await page.waitForTimeout(2500);
  const hb=await page.evaluate(u=>window.hwBonus(u).map(b=>[b.id,b.pc,b.gems,b.food,b.col]),UID);log('бонусы',JSON.stringify(hb));
  need(hb.length===2&&hb.some(b=>b[0]==='ts1'&&b[1]===92&&b[2]===4)&&hb.some(b=>b[0]==='hw1'&&b[1]===70&&b[2]===1),'тест 92 % и ДЗ 70 % дают бонус, старое ДЗ нет');
  const before=JSON.parse(process.env.DRAG).bal;
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await page.waitForTimeout(900);
  const st=()=>page.evaluate(u=>{const x=DRGUI.stateOf(u).st;return {gems:x.bal.gems,food:x.bal.food,cr:x.credited}},UID);
  let s=await st();log('до записи',JSON.stringify(s),'в документе было',JSON.stringify(before));
  need(s.cr.hwg===5&&s.cr.hwf===180,'учтено 5 💎 и 180 🌾 за ДЗ');
  const body=await page.evaluate(()=>document.body.textContent.replace(/\s+/g,' '));need(/За ДЗ: .*Тест по ферментам/.test(body),'строка «За ДЗ» на странице');
  /* действие сохраняет остров: бонус ложится в документ */
  await page.click('[data-act="drgopen"][data-full]');await page.waitForTimeout(1800);
  const ok=await page.evaluate(u=>{const x=DRGUI.stateOf(u).st,d=x.dragons.slice().sort((a,b)=>a.lvl-b.lvl)[0];const e=document.createElement('button');e.dataset.act='drgdo';e.dataset.t='feed';e.dataset.dragon=d.id;document.querySelector('#main').appendChild(e);e.click();e.remove();return d.id},UID);
  await page.waitForTimeout(1500);log('покормлен',ok);
  const saved=store.get(`srs/${UID}/meta/dragons`).d;log('в базе credited',JSON.stringify(saved.credited),'самоцветы',saved.bal.gems);
  need(saved.credited.hwg===5&&saved.credited.hwf===180,'учёт бонуса записан в документ');
  const g1=saved.bal.gems,f1=saved.bal.food;
  await page.reload();await page.waitForTimeout(2500);
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(800);
  s=await st();log('после перезагрузки',JSON.stringify(s));need(s.gems===g1&&s.cr.hwg===5,'перезагрузка не начисляет бонус второй раз');
  /* пересдача (оценка удалена, затем снова 7 из 10): прибавки нет */
  store.set(`grades/${UID}/items/hw1`,{d:null,t:T});await page.reload();await page.waitForTimeout(2000);
  store.set(`grades/${UID}/items/hw1`,{d:{score:7,returnedAt:new Date().toISOString()},t:T});await page.reload();await page.waitForTimeout(2500);
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await page.waitForTimeout(800);
  s=await st();log('после пересдачи',JSON.stringify(s));need(s.gems===g1&&s.food===f1,'пересдача с той же оценкой ничего не добавляет');
  /* чашка: подкормка в нынешней культуре */
  const col=await page.evaluate(u=>{const c=culture(u);const a=colonies(u,c.list,c.days).cols;return {hw:a.filter(x=>x.hw).length,all:a.length}},UID);
  log('чашка',JSON.stringify(col));need(col.hw===4,'подкормка: 1 + 3 колонии');
};
