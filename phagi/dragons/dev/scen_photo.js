/* фото к развёрнутой части ДЗ (29.10): загрузка с телефона, сжатие, куски в базе, показ ученице и учителю */
module.exports=async(page,{need,store,UID,OUT})=>{const w=t=>page.waitForTimeout(t),T=new Date().toISOString(),W=process.env.W,id='seh-ph-written';
  store.set('tasks/'+id,{d:{title:'Клетка, развёрнутые ответы',kind:'task',max:12,subject:'bio',to:[UID],due:'2026-12-01',createdAt:T,updatedAt:T,body:'',files:[],links:[]},t:T});
  await page.reload();await w(2500);
  const open=async()=>{await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(700);await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(1200)};
  await open();
  const inp=await page.$(`input[type=file][data-upload="${id}"]`);need(!!inp,'есть кнопка «Прикрепить фото»');
  /* «фото с телефона»: 3000×2000, тяжёлое */
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=3000;c.height=2000;const x=c.getContext('2d');for(let i=0;i<4000;i++){x.fillStyle=`hsl(${i%360},70%,${30+i%40}%)`;x.fillRect(Math.random()*3000,Math.random()*2000,60,60)}
    x.fillStyle='#000';x.font='160px sans-serif';x.fillText('Решение №3',300,1000);const b=await new Promise(r=>c.toBlob(r,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()))});
  console.log('исходное фото, байт',png.length);
  await inp.setInputFiles({name:'reshenie.png',mimeType:'image/png',buffer:Buffer.from(png)});await w(4000);
  const sub=(store.get(`subs/${UID}/items/${id}`)||{}).d;console.log('работа',JSON.stringify(sub&&sub.files));
  const f=sub&&sub.files&&sub.files[0];need(f&&/^dbs/.test(f.id),'фото записано в работу');
  const parts=[...store.keys()].filter(k=>k.startsWith(`subs/${UID}/blob/`));const meta=f&&store.get(`subs/${UID}/blob/${f.id.slice(3,15)}`);
  console.log('документов файла',parts.length,'опись',JSON.stringify(meta&&meta.d));need(meta&&meta.d.size<1000000&&meta.d.size<=png.length,'фото не больше исходного и меньше 1 МБ');
  const shown=async()=>page.evaluate(()=>{const im=document.querySelector('.files img');return im?{w:im.naturalWidth,src:(im.getAttribute('src')||'').slice(0,5)}:null});
  await w(1200);console.log('fetch',await page.evaluate(async id=>{try{const r=await fetch('_blob/'+id);const b=await r.blob();return r.status+' '+b.size+' '+b.type}catch(e){return 'ERR '+e.message}},f.id));console.log('img',await page.evaluate(()=>[...document.querySelectorAll('.files img,.files a')].map(e=>e.outerHTML.slice(0,200)).join(' | ')));let s=await shown();console.log('на странице',JSON.stringify(s));need(s&&s.w>0&&s.src==='blob:','фото видно ученице');
  await page.screenshot({path:`${OUT}/photo-${W}-1.png`});
  /* перезагрузка: фото на месте, собирается из базы */
  await page.reload();await w(2500);await open();await w(1500);s=await shown();need(s&&s.w>0,'после перезагрузки фото на месте');
  /* тяжёлый снимок с телефона: JPEG 4000×3000 больше 2 МБ — сжимается до 1800 px и меньше 1 МБ */
  const jpg=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=4000;c.height=3000;const x=c.getContext('2d'),d=x.createImageData(4000,3000);
    for(let i=0;i<d.data.length;i+=4){const v=(Math.random()*255)|0;d.data[i]=v;d.data[i+1]=(v*7)%255;d.data[i+2]=(v*13)%255;d.data[i+3]=255}x.putImageData(d,0,0);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.95));return Array.from(new Uint8Array(await b.arrayBuffer()))});
  console.log('снимок с телефона, байт',jpg.length);
  await (await page.$(`input[type=file][data-upload="${id}"]`)).setInputFiles({name:'IMG_0042.jpg',mimeType:'image/jpeg',buffer:Buffer.from(jpg)});await w(6000);
  const s2=(store.get(`subs/${UID}/items/${id}`)||{}).d,f2=s2&&s2.files&&s2.files[1],m2=f2&&store.get(`subs/${UID}/blob/${f2.id.slice(3,15)}`);
  console.log('второе фото',JSON.stringify(m2&&m2.d));need(m2&&m2.d.type==='image/jpeg'&&m2.d.size<1000000&&jpg.length>2000000,'тяжёлый снимок сжат до JPEG меньше 1 МБ');
  await page.click(`[data-act=submit][data-id="${id}"]`);await w(1500);const sb=(store.get(`subs/${UID}/items/${id}`)||{}).d;need(sb&&sb.status==='submitted'&&sb.files&&sb.files.length===2,'работа сдана с обоими фото');
  /* учитель: видит фото в работе */
  await page.route('**/rest/v1/rpc/ph_login',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'u_teacher',isOwner:true,name:'Учитель'})}));
  await page.reload();await w(2800);await page.click('[data-act="go"][data-v="tasks"]').catch(()=>{});await w(700);
  await page.evaluate(id=>{const el=[...document.querySelectorAll('[data-act][data-id]')].find(e=>e.dataset.id===id);if(el)el.click()},id);await w(2500);
  const t=await page.evaluate(()=>[...document.querySelectorAll('img')].filter(i=>(i.getAttribute('src')||'').startsWith('blob:')).map(i=>i.naturalWidth));console.log('у учителя картинок',JSON.stringify(t));
  need(t.some(x=>x>0),'учитель видит фото в работе');await page.screenshot({path:`${OUT}/photo-${W}-2-teacher.png`,fullPage:true})};
