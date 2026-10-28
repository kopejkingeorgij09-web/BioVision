/* Драконы 5.0: перенос постройки с клавиатуры (G, стрелки, Enter, Esc) на компьютере.
   Запуск: SCEN=scen_move.js DRAG="$(cat isle-many.json)" W=1440 H=900 node hx.js ../.. ./out */
module.exports=async(page,{need,store,UID,OUT})=>{const w=t=>page.waitForTimeout(t),W=process.env.W,shot=n=>page.screenshot({path:`${OUT}/move-${W}-${n}.png`}),P=`srs/${UID}/meta/dragons`;
  await page.click('[data-act="go"][data-v="cards"]');await w(600);await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(800);
  await page.click('[data-act="drgopen"][data-full]');await w(2000);
  /* без выбора G подсказывает, что выбрать */
  await page.keyboard.press('g');await w(300);need(await page.evaluate(()=>!document.querySelector('.drg-place')),'без выбранной постройки перенос не начинается');
  const b0=await page.evaluate(()=>{const e=document.querySelector('.drg-world .drg-b[data-id]');e.focus();return e.dataset.id});
  const pos=id=>{const b=store.get(P).d.bld.find(x=>x.id===id);return b?[b.x,b.y]:null};const p0=pos(b0);
  await page.keyboard.press('g');await w(500);
  const st1=await page.evaluate(()=>({bar:!!document.querySelector('.drg-place'),cur:document.querySelectorAll('.drg-slot.cur').length,full:!!document.querySelector('.drg-world')}));
  need(st1.bar&&st1.cur===1,'G начинает перенос, курсор на ячейке');await shot('1-g');
  await page.keyboard.press('Escape');await w(400);
  const st2=await page.evaluate(()=>({bar:!!document.querySelector('.drg-place'),full:!!document.querySelector('.drg-world')}));need(!st2.bar&&st2.full,'Esc отменяет перенос и не выходит с острова');
  /* выбор кликом, G, стрелки, Enter */
  await page.evaluate(id=>document.querySelector(`.drg-world .drg-b[data-id="${id}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true})),b0);await w(500);
  await page.keyboard.press('g');await w(400);
  const c0=await page.evaluate(()=>{const e=document.querySelector('.drg-slot.cur');return e?[+e.dataset.x,+e.dataset.y]:null});
  let moved=null;for(const k of ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp']){await page.keyboard.press(k);await w(250);const c=await page.evaluate(()=>{const e=document.querySelector('.drg-slot.cur');return e?[+e.dataset.x,+e.dataset.y]:null});if(c&&String(c)!==String(c0)){moved=c;break}}
  need(!!moved,'стрелки переводят курсор на другую свободную ячейку: '+JSON.stringify([c0,moved]));await shot('2-arrow');
  await page.keyboard.press('Enter');await w(1200);
  const p1=pos(b0);need(String(p1)===String(moved),'Enter ставит постройку в выбранную ячейку: '+JSON.stringify([p0,p1]));
  need(await page.evaluate(()=>!document.querySelector('.drg-place')&&!!document.querySelector('.drg-world')),'после переноса обычный вид острова');
  /* A — на свободное место */
  await page.evaluate(id=>document.querySelector(`.drg-world .drg-b[data-id="${id}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true})),b0);await w(500);
  await page.keyboard.press('g');await w(400);await page.keyboard.press('a');await w(300);console.log('тост',await page.evaluate(()=>(document.querySelector('#toast')||{}).textContent));await w(900);
  need(await page.evaluate(()=>!document.querySelector('.drg-place')),'A ставит на свободное место');await shot('3-done');
  const keys=await page.evaluate(()=>{const b=document.querySelector('[data-act=drgpanel][data-v=keys]');return !!b});
  if(keys){await page.click('[data-act=drgpanel][data-v=keys]');await w(400);need(await page.evaluate(()=>/Перенести/.test(document.querySelector('#main>.drg-pan').textContent)),'в подсказке клавиш есть G — перенести')}
};
