/* яйцо дракона света без Храма: причина до нажатия, ясли, «ясли заняты», яйцо не пропадает */
module.exports=async(page,{OUT,store,UID})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/nurs-${tag}-${n}.png`});const w=t=>page.waitForTimeout(t);
  const P=`srs/${UID}/meta/dragons`;
  await page.click('[data-act="go"][data-v="cards"]');await w(600);await page.click('[data-act="drgopen"][data-full]');await w(1200);
  await page.click('[data-act=drgpanel][data-v=breed]');await w(500);
  const rows=()=>page.evaluate(()=>[...document.querySelectorAll('.drg-bp .drg-sr')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(t=>/Яйцо|яслях|нужна/.test(t)));
  log('до:',JSON.stringify(await rows()));await shot('1');
  const b=await page.$('.drg-bp [data-t=hatch]:not([disabled])');if(b){await b.click();await w(800)}
  log('вылупился в ясли:',await page.evaluate(()=>(document.querySelector('.drg-baby .drg-why')||{}).textContent||'—'));await shot('2-baby');
  await page.click('[data-act=drgpanel][data-v=breed]');await w(500);
  log('после:',JSON.stringify(await rows()),'кнопка «Вылупить» закрыта',await page.evaluate(()=>{const b=document.querySelector('.drg-bp [data-t=hatch]');return b?b.disabled:null}));
  const s=store.get(P).d;log('в базе: в яслях',s.dragons.filter(d=>d.nurs&&!d.home).length,'яиц в Инкубаторе',s.bld.find(x=>x.type==='hatch').slots.filter(Boolean).length);await shot('3-full')}
