/* задания всех типов (4.4): письменное ДЗ (автосохранение, перезагрузка, сдача), тест со сдачей и автопроверкой,
   id заданий с дефисами, как у перенесённых 26.10. Запуск: SCEN=scen_tasks.js W=390 H=844 TOUCH=1 node hx.js ../.. ./out */
module.exports=async(page,{need,store,UID,confirmAll})=>{const w=t=>page.waitForTimeout(t),T=new Date().toISOString();
  page.on('dialog',d=>d.accept().catch(()=>{}));
  const put=(id,d)=>store.set('tasks/'+id,{d:Object.assign({subject:'bio',to:[UID],due:'2026-11-30',createdAt:T,updatedAt:T,body:'',files:[],links:[]},d),t:T});
  put('seh-x-written',{title:'Письменное ДЗ с дефисом',kind:'task',max:10});
  put('seh-y-test',{title:'Тест на сдачу',kind:'test',q:[{t:'single',ans:[1],pts:1,opts:['a','b','c'],text:'Один'},{t:'multi',ans:[0,2],pts:2,opts:['x','y','z'],text:'Два'}]});
  const open=async id=>{await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(700);
    await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(1100)};
  await page.reload();await w(2500);
  /* письменное: текст сохраняется сам, переживает перезагрузку, сдаётся */
  await open('seh-x-written');
  const ta=await page.$('textarea[id="ans-seh-x-written"]');need(!!ta,'поле ответа письменного ДЗ');
  if(ta){await ta.click();await page.keyboard.type('Митохондрии — энергетические станции клетки.');await w(2500)}
  let sub=(store.get(`subs/${UID}/items/seh-x-written`)||{}).d;console.log('черновик письменного',JSON.stringify(sub));
  need(sub&&/Митохондрии/.test(sub.text||'')&&sub.status==='draft','черновик письменного ДЗ в облаке');
  const st=await page.evaluate(()=>(document.querySelector('.svst')||{}).textContent||'');need(/Сохранено в облаке/.test(st),'у письменного ДЗ виден статус «Сохранено»');
  await page.reload();await w(2500);await open('seh-x-written');
  const back=await page.evaluate(()=>(document.querySelector('textarea[id="ans-seh-x-written"]')||{}).value||'');need(/Митохондрии/.test(back),'текст на месте после перезагрузки');
  await page.click('[data-act=submit][data-id="seh-x-written"]');await w(1800);
  sub=(store.get(`subs/${UID}/items/seh-x-written`)||{}).d;console.log('сдано',sub&&sub.status);need(sub&&sub.status==='submitted'&&/Митохондрии/.test(sub.text),'письменное ДЗ сдано с текстом');
  /* тест: ответы, сдача, автопроверка */
  await open('seh-y-test');
  await page.evaluate(()=>{const q=n=>[...document.querySelectorAll('input')].filter(e=>(e.dataset.q||e.id||'').startsWith('ta-seh-y-test-'+n));
    const a=q(0).find(e=>e.value==='1');if(a)a.click();q(1).filter(e=>e.value==='0'||e.value==='2').forEach(e=>e.click())});await w(2200);
  sub=(store.get(`subs/${UID}/items/seh-y-test`)||{}).d;need(sub&&sub.draft&&Object.keys(sub.draft).length===2,'черновик теста в облаке');
  await page.click('[data-act=submittest][data-id="seh-y-test"]');await w(2000);
  sub=(store.get(`subs/${UID}/items/seh-y-test`)||{}).d;console.log('тест после сдачи',JSON.stringify(sub&&{status:sub.status,auto:sub.auto,answers:sub.answers}));
  need(sub&&sub.status==='submitted'&&Array.isArray(sub.answers)&&sub.answers.length===2,'тест сдан с ответами');
  need(sub&&sub.auto===3,'автопроверка: 3 балла из 3');
  const ls=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hwd:')&&/seh-y-test/.test(k)).length);need(ls===0,'после сдачи черновик в браузере убран');
};
