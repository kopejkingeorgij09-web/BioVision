/* гнездовье: варианты прогноза F+W (эпистаз), подсказка про уровень, магазин: построено → открыть, нехватка золота */
module.exports=async(page,{OUT,need})=>{
  const W=process.env.W||1280,tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/lab-${tag}-${n}.png`});const w=t=>page.waitForTimeout(t);
  await page.click('[data-act="go"][data-v="cards"]').catch(()=>{});await w(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(900);
  await page.click('[data-act="drgopen"][data-full]');await w(1200);
  await page.evaluate(()=>{const b=document.createElement('button');b.dataset.act='drgsel';b.dataset.id='b9';document.querySelector('#main').appendChild(b);b.click()});await w(600);
  const setSel=async(id,v)=>{await page.selectOption('#'+id,v);await w(500)};
  await setSel('drgM','d6');await setSel('drgF','d2');
  await page.evaluate(()=>{const d=document.querySelector('[data-k=drgpred]');if(d)d.open=true});await setSel('drgPt','elements');
  const vars=await page.evaluate(()=>[...document.querySelectorAll('#drgPc option')].map(o=>o.value));log('варианты стихии:',vars.join(', '));need(vars.length>=2,'в прогнозе есть варианты стихии');
  log('подсказка:',await page.evaluate(()=>{const p=[...document.querySelectorAll('.drg-pan p')].find(x=>/уровень/.test(x.textContent)&&/Покормить|ферм/.test(x.textContent));return p?p.textContent:'—'}));
  log('знаменатель:',await page.evaluate(()=>/среди вылупившихся/.test(document.querySelector('.drg-predbox').textContent)));
  await shot('nest');
  await page.click('[data-act=drgpanel][data-v=shop]').catch(async()=>{await page.evaluate(()=>{const b=document.createElement('button');b.dataset.act='drgpanel';b.dataset.v='shop';document.querySelector('#main').appendChild(b);b.click()})});await w(700);
  log('магазин:',await page.evaluate(()=>[...document.querySelectorAll('.drg-shop-i')].map(b=>b.querySelector('b').textContent+' ['+(b.dataset.act)+(b.disabled?' off':'')+'] '+((b.querySelector('em')||b.querySelector('.drg-price')||{}).textContent||'')).join(' | ')));
  need(await page.$('.drg-shop-i'),'магазин показывает постройки');
  await shot('shop');
  await page.click('.drg-shop-i.built');await w(600);log('после «открыть»: заголовок',await page.evaluate(()=>(document.querySelector('.drg-pan h2')||{}).textContent));
  await page.evaluate(()=>{const b=document.createElement('button');b.dataset.act='drgpanel';b.dataset.v='market';document.querySelector('#main').appendChild(b);b.click()});await w(700);
  log('рынок:',await page.evaluate(()=>document.querySelector('.drg-pan p').textContent.slice(0,120)));await shot('market')}
