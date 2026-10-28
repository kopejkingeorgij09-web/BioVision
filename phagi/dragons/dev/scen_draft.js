/* тест с дефисом в id (как seh-bio-w3-test): ответы сохраняются в облако и переживают перезагрузку */
module.exports=async(page,{need,store,UID,writes,fail})=>{const w=t=>page.waitForTimeout(t),T=new Date().toISOString(),id='seh-x-test';
  const q=n=>({t:'single',ans:[1],pts:1,opts:['а'+n,'б'+n,'в'+n],text:'Вопрос '+n});
  store.set('tasks/'+id,{d:{title:'Тест с дефисом',kind:'test',subject:'bio',to:[UID],q:[q(1),q(2),q(3)],due:'2026-11-30',createdAt:T,updatedAt:T,body:'',files:[],links:[]},t:T});
  await page.reload();await w(2500);
  await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(800);
  const opened=await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el){el.click();return el.dataset.act}return null},id);
  await w(1000);console.log('открыто',opened);
  const ins=await page.evaluate(id=>[...document.querySelectorAll('input,textarea,button')].filter(e=>((e.dataset&&e.dataset.q)||e.id||'').startsWith('ta-'+id+'-')).map(e=>e.tagName+'#'+(e.id||e.dataset.q)+':'+(e.type||'')+':'+(e.value||'')).slice(0,8),id);
  console.log('поля',JSON.stringify(ins));need(ins.length>0,'поля теста на странице');
  /* ответить на первые два вопроса */
  const did=await page.evaluate(id=>{let n=0;for(const k of [0,1]){const el=[...document.querySelectorAll('input')].find(e=>((e.dataset&&e.dataset.q)||e.id||'').startsWith('ta-'+id+'-'+k)&&e.value==='1');if(el){el.click();n++}}return n},id);
  console.log('нажато',did);await w(2500);
  const sub=(store.get(`subs/${UID}/items/${id}`)||{}).d;console.log('в облаке',JSON.stringify(sub));
  need(sub&&sub.draft&&Object.keys(sub.draft).length>=2,'черновик теста записан в облако');
  const ls=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hwd:')));need(ls.length>0,'черновик сохранён и в браузере');
  const sv=()=>page.evaluate(()=>{const e=document.querySelector('.svst');return e?e.className+' | '+e.textContent:''});
  let t1=await sv();console.log('статус',t1);need(/ok/.test(t1)&&/Сохранено в облаке/.test(t1),'видно «Сохранено в облаке»');
  /* обрыв связи: запись падает, статус предупреждает, повтор сам дописывает ответ */
  fail.set=1;console.log('третий ответ',await page.evaluate(id=>{const all=[...document.querySelectorAll('input')].filter(e=>(e.id||e.dataset.q||'').startsWith('ta-'+id+'-2'));const el=all.find(e=>e.value==='0');if(!el)return 'нет поля из '+all.length;el.click();return 'нажато, checked='+el.checked},id));await w(2500);
  t1=await sv();console.log('при сбое',t1);need(/err/.test(t1)&&/не закрывай/.test(t1),'при сбое предупреждение «не закрывай страницу»');
  await w(7000);t1=await sv();const sub2=(store.get(`subs/${UID}/items/${id}`)||{}).d;console.log('после повтора',t1,JSON.stringify(sub2&&sub2.draft));
  need(/ok/.test(t1)&&sub2&&sub2.draft&&Object.keys(sub2.draft).length>=3,'повтор дописал ответ в облако');
  /* перезагрузка: ответы на месте */
  await page.reload();await w(2500);await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(600);
  await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(1200);
  const kept=await page.evaluate(id=>[...document.querySelectorAll('input:checked')].filter(e=>((e.dataset&&e.dataset.q)||e.id||'').startsWith('ta-'+id+'-')).length,id);
  console.log('отмечено после перезагрузки',kept);need(kept>=3,'ответы на месте после перезагрузки');
  /* без браузерной копии (другое устройство): ответы из облака */
  await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hwd:')).forEach(k=>localStorage.removeItem(k)));
  await page.reload();await w(2500);await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(600);
  await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(1200);
  const kept2=await page.evaluate(id=>[...document.querySelectorAll('input:checked')].filter(e=>((e.dataset&&e.dataset.q)||e.id||'').startsWith('ta-'+id+'-')).length,id);
  console.log('с другого устройства',kept2);need(kept2>=3,'ответы восстановились из облака')};
