/* сводка учителя (4.4): кто что сдал, ждёт проверки, просрочки, слабые темы, трудные вопросы */
module.exports=async(page,{need,store,UID,OUT})=>{const w=t=>page.waitForTimeout(t),T=new Date().toISOString(),W=process.env.W;
  await page.route('**/rest/v1/rpc/ph_login',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'u_teacher',isOwner:true,name:'Учитель'})}));
  const put=(id,d)=>store.set('tasks/'+id,{d:Object.assign({subject:'bio',to:[UID],createdAt:T,updatedAt:T,body:'',files:[],links:[]},d),t:T});
  const q=(tag,i)=>({t:'single',ans:[0],pts:1,opts:['a','b'],text:'Вопрос '+i,tag});
  put('s-late',{title:'Просроченное ДЗ',kind:'task',max:10,due:'2026-10-01'});
  put('s-wait',{title:'Письменное на проверке',kind:'task',max:10,due:'2026-12-01'});
  put('s-test',{title:'Тест по клетке',kind:'test',due:'2026-12-01',q:[q('Митохондрии',1),q('Митохондрии',2),q('Митохондрии',3),q('Мембрана',4),q('Мембрана',5),q('Мембрана',6)]});
  store.set(`subs/${UID}/items/s-wait`,{d:{status:'submitted',text:'ответ',link:'',files:[],updatedAt:T},t:T});
  store.set(`subs/${UID}/items/s-test`,{d:{status:'submitted',answers:[1,1,0,0,0,0],auto:4,updatedAt:T},t:T});
  await page.reload();await w(2500);
  const nav=await page.evaluate(()=>!!document.querySelector('[data-act=go][data-v=sum]'));need(nav,'в меню учителя есть «Сводка»');
  await page.click('[data-act=go][data-v=sum]');await w(1200);
  const r=await page.evaluate(()=>({h:(document.querySelector('.page-h h1')||{}).textContent,k:[...document.querySelectorAll('.sum-k span')].map(e=>e.textContent.replace(/\s+/g,' ')),
    ls:[...document.querySelectorAll('.sum-c h3')].map(e=>e.textContent),weak:[...document.querySelectorAll('.sum-w')].map(e=>e.textContent),hard:(document.querySelector('.sum-t')||{}).textContent||''}));
  console.log(JSON.stringify(r));
  need(r.h==='Сводка','страница «Сводка»');need(r.k.some(x=>/1\s*ждут проверки/.test(x))&&r.k.some(x=>/1\s*просрочено/.test(x)),'счётчики: 1 ждёт проверки, 1 просрочено');
  need(r.ls.includes('Ждут проверки')&&r.ls.includes('Просрочено'),'списки «Ждут проверки» и «Просрочено»');
  need(r.weak.some(x=>/Митохондрии/.test(x)),'слабая тема «Митохондрии» (1 из 3)');need(/Трудные: №1/.test(r.hard),'трудные вопросы теста');
  await page.screenshot({path:`${OUT}/sum-${W}.png`,fullPage:true});
  await page.click('.sum-l[data-id="s-wait"]');await w(900);need(await page.evaluate(()=>/Письменное на проверке/.test(document.body.textContent)),'по ссылке открывается задание')};
