/* файлы к работе (28.10): фото и PDF прикрепляются к письменному ДЗ, лежат в базе в личной папке ученицы,
   показываются после перезагрузки, большое фото сжимается */
module.exports=async(page,{need,store,UID,OUT})=>{const w=t=>page.waitForTimeout(t),T=new Date().toISOString();
  store.set('tasks/seh-f-task',{d:{title:'ДЗ с файлами',kind:'task',max:10,subject:'bio',to:[UID],due:'2026-12-01',createdAt:T,updatedAt:T,body:'',files:[],links:[]},t:T});
  page.on('console',m=>{if(m.type()==='warning'||m.type()==='warn')console.log('warn:',m.text().slice(0,300))});
  await page.reload();await w(2500);
  const open=async()=>{await page.click('[data-act="go"][data-v="tasks"]');await w(600);await page.evaluate(()=>{const e=[...document.querySelectorAll('[data-act][data-id]')].find(x=>x.dataset.id==='seh-f-task');if(e)e.click()});await w(1000)};
  await open();
  need(await page.$('input[data-upload="seh-f-task"]')!==null,'есть кнопка «Прикрепить»');
  /* маленькая картинка PNG, большая картинка (сожмётся) и PDF */
  /* шум по пикселям: PNG больше 1,5 МБ, такой файл должен сжаться */
  const big=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1400;c.height=1100;const x=c.getContext('2d'),im=x.createImageData(1400,1100);for(let i=0;i<im.data.length;i++)im.data[i]=(i%4===3)?255:Math.random()*255;x.putImageData(im,0,0);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));return [...new Uint8Array(await b.arrayBuffer())]});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQI12P8z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==','base64');
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'+'x'.repeat(700000));
  await page.setInputFiles('input[data-upload="seh-f-task"]',[{name:'решение.png',mimeType:'image/png',buffer:png},{name:'большое.png',mimeType:'image/png',buffer:Buffer.from(big)},{name:'работа.pdf',mimeType:'application/pdf',buffer:pdf}]);
  for(let i=0;i<20;i++){await w(1000);const t=await page.evaluate(()=>(document.querySelector('#toast')||{}).textContent);if(i%4===0)console.log('сообщение',t);if(/прикреплён|Не получилось|не поддерж/.test(t||''))break}
  const sub=(store.get(`subs/${UID}/items/seh-f-task`)||{}).d;console.log('в работе',JSON.stringify(sub&&sub.files));
  need(sub&&sub.files&&sub.files.length===3,'три файла записаны в работу');
  const f=(sub&&sub.files)||[];const hdr=f.map(x=>store.get(`subs/${UID}/files/${x.id}`));
  need(hdr.every(h=>h&&h.d&&h.d.parts>=1),'файлы лежат в личной папке ученицы');
  const bigH=hdr[1]&&hdr[1].d;console.log('большое фото',bigH&&{type:bigH.type,size:bigH.size,parts:bigH.parts},'исходно',big.length);need(bigH&&bigH.type==='image/jpeg'&&bigH.size<big.length,'большое фото сжато в JPEG');
  need(hdr[2]&&hdr[2].d.parts>=3,'PDF разбит на части');
  /* после перезагрузки: картинки показываются, ссылки на blob: */
  await page.reload();await w(2500);await open();await w(2500);
  const v=await page.evaluate(()=>({imgs:[...document.querySelectorAll('.files img')].map(i=>i.naturalWidth),links:[...document.querySelectorAll('.files a')].map(a=>a.getAttribute('href').slice(0,5))}));
  console.log('после перезагрузки',JSON.stringify(v));need(v.links.length===3&&v.links.every(h=>h==='blob:'),'три файла открываются из базы');
  need(v.imgs.length>=1&&v.imgs.every(x=>x>0),'фото показываются');
  await page.screenshot({path:`${OUT}/files-${process.env.W}.png`})};
