/* файлы из базы в просмотрщике (29.10): нажатие на фото решения открывает его и у ученицы, и у учителя */
module.exports=async(page,{need,store,UID,OUT})=>{const w=t=>page.waitForTimeout(t),T=new Date().toISOString(),W=process.env.W,id='seh-vw-written';
  store.set('tasks/'+id,{d:{title:'Развёрнутые ответы с фото',kind:'task',max:12,subject:'bio',to:[UID],due:'2026-12-01',createdAt:T,updatedAt:T,body:'',files:[],links:[]},t:T});
  await page.reload();await w(2500);
  const open=async()=>{await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(700);await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(1500)};
  await open();
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');x.fillStyle='#2F80D1';x.fillRect(0,0,900,600);x.fillStyle='#fff';x.font='80px sans-serif';x.fillText('Решение',200,320);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()))});
  await (await page.$(`input[type=file][data-upload="${id}"]`)).setInputFiles({name:'reshenie.png',mimeType:'image/png',buffer:Buffer.from(png)});await w(3500);
  const f=((store.get(`subs/${UID}/items/${id}`)||{}).d||{}).files;need(f&&f.length===1,'фото прикреплено');
  const view=async who=>{await page.evaluate(()=>{const a=document.querySelector('.files a[data-fid]');if(a)a.click()});await w(2500);
    const r=await page.evaluate(()=>{const im=document.querySelector('#vwbody img');return {img:im?im.naturalWidth:0,msg:(document.querySelector('#vwbody .msg')||{}).textContent||''}});
    console.log(who,JSON.stringify(r));await page.screenshot({path:`${OUT}/viewer-${W}-${who}.png`});await page.keyboard.press('Escape');await w(400);return r};
  let r=await view('ученица');need(r.img>0,'ученица открывает фото в просмотрщике');
  await page.click(`[data-act=submit][data-id="${id}"]`);await w(1500);
  await page.route('**/rest/v1/rpc/ph_login',x=>x.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'u_teacher',isOwner:true,name:'Учитель'})}));
  await page.reload();await w(2800);await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(700);
  await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(2500);
  r=await view('учитель');need(r.img>0,'учитель открывает фото решения в просмотрщике')};
