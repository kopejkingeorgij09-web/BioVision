module.exports=async(page,{need,UID})=>{const w=t=>page.waitForTimeout(t);let owner=true;
  await page.route('**/rest/v1/rpc/ph_login',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:UID,isOwner:owner,name:'Георгий'})}));
  await page.reload();await w(2500);
  const st=()=>page.evaluate(()=>({hidden:document.querySelector('#rolesw').hidden,btns:[...document.querySelectorAll('#rolesw button')].map(b=>b.dataset.role+':'+b.getAttribute('aria-pressed')),login:!!document.querySelector('#ph-login')}));
  console.log('учитель',JSON.stringify(await st()));
  owner=false;await page.reload();await w(2500);const a=await st();console.log('ученический код',JSON.stringify(a));
  need(!a.hidden&&a.btns.includes('student:true'),'переключатель виден при ученическом коде, режим ученика');
  /* на телефоне видна только кнопка текущего режима: нажатие на неё переключает */
  await page.locator('#rolesw button:visible').first().click();await w(800);const b=await st();console.log('нажал Учитель',JSON.stringify(b));
  need(b.login,'просит код учителя');
  const txt=await page.evaluate(()=>document.querySelector('#ph-login p').textContent);console.log(txt);
  await page.fill('#ph-code','FAG-TEST-TEST');await page.click('#ph-login button[type=submit]');await w(800);
  const err=await page.evaluate(()=>document.querySelector('#ph-login .err').textContent);console.log('ученический код в окне учителя:',err);need(/учител/.test(err),'ученический код не пускает в учителя');
  owner=true;await page.click('#ph-login button[type=submit]');await w(3000);const c=await st();console.log('код учителя',JSON.stringify(c));need(c.btns.includes('teacher:true')&&!c.login,'вошёл учителем')};
