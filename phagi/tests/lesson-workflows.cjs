// Run against a local Phagi server, or pass the published page URL.
// A fresh browser context intercepts RPCs so fault injection never writes classroom data.
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const site = process.argv[2] || 'http://127.0.0.1:18748/phagi/';
const day = '2026-11-17';
const eventId = 'regression-lesson';
const path = 'events/' + eventId;
const topic = {date:day,title:'Проверка вложений',subject:'bio',repeat:'none',to:[],skip:[],
  ofiles:{[day]:[{id:'legacy001',name:'Старый.pdf',type:'application/pdf'}]}};

async function check(browser, width, dark) {
  const ctx = await browser.newContext({viewport:{width,height:850},
    colorScheme:dark?'dark':'light',serviceWorkers:'block'});
  const docs = new Map([[path, structuredClone(topic)]]);
  const stamp = () => new Date().toISOString();
  let pause = 'chunk', interrupted = false, lostReply = true;
  await ctx.route('**/rest/v1/rpc/*', async route => {
    const fn = route.request().url().split('/').pop(), a = route.request().postDataJSON() || {};
    let result = null;
    if (fn === 'ph_login') result = {id:'test-owner',isOwner:true,name:'QA'};
    if (fn === 'ph_list') result = a.p_col==='events' ? [{id:eventId,data:docs.get(path),t:stamp()}] : [];
    if (fn === 'ph_sync') result = {ch:[],now:stamp()};
    if (fn === 'ph_get') result = docs.get(a.p_path) || null;
    if (fn === 'ph_set') {
      if (pause === 'chunk' && a.p_path.endsWith('~1')) {interrupted=true;return route.abort();}
      docs.set(a.p_path,a.p_data); result=stamp();
    }
    if (fn === 'ph_update' && a.p_path === path) {
      const edit = a.p_data.occFileEdit, files = docs.get(path).ofiles[day];
      if (pause === 'link') {interrupted=true;return route.abort();}
      if (edit.action === 'remove') docs.get(path).ofiles[day] = files.filter(f=>f.id!==edit.id);
      else if (!files.some(f=>f.id===edit.id)) files.push(edit.file);
      if (lostReply && edit.action==='add') {lostReply=false;return route.abort();}
      result = stamp();
    }
    return route.fulfill({json:result,headers:{'access-control-allow-origin':'*'}});
  });
  const page=await ctx.newPage();
  async function ready(){
    await page.waitForFunction(id=>typeof S!=='undefined' && S.assets && T() && S.events.some(e=>e.id===id),eventId);
  }
  async function open(){
    await page.evaluate(([id,d])=>openOcc('ev',id,d),[eventId,day]);
    await page.locator('[data-dact="addocc"]').waitFor({state:'attached'});
  }
  async function waitUntil(test) {
    for (let i=0;i<150;i++) { if (test()) return; await new Promise(resolve=>setTimeout(resolve,100)); }
    assert.ok(test(),'expected workflow state');
  }
  try {
    await page.goto(site,{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      localStorage.setItem('ph_code','QA-FIXTURE');localStorage.setItem('ph_role','teacher');
      for(const k of ['bamboo-dirty','bamboo-docs','hwd:test','another-app','srRecent'])localStorage.setItem(k,'keep');
    });
    await page.reload({waitUntil:'domcontentloaded'});await ready();await open();
    const file={name:'Одинаковое имя.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(320000,65)};
    await page.locator('[data-dact="addocc"]').setInputFiles(file);
    await waitUntil(()=>interrupted);
    interrupted=false;pause='link';
    await page.reload({waitUntil:'domcontentloaded'});await ready();await waitUntil(()=>interrupted);
    pause=null;
    await page.reload({waitUntil:'domcontentloaded'});await ready();
    await waitUntil(()=>docs.get(path).ofiles[day].length===2);
    // The row was committed, but the browser lost the acknowledgement.
    await page.reload({waitUntil:'domcontentloaded'});await ready();await open();
    await page.waitForFunction(id=>S.events.find(e=>e.id===id)?.ofiles['2026-11-17'].length===2,eventId);
    assert.equal(docs.get(path).ofiles[day].length,2);
    const id=docs.get(path).ofiles[day][1].id;
    const header=docs.get('files/'+id);
    const b64=Array.from({length:header.parts},(_,i)=>docs.get('files/'+id+'~'+i).d).join('');
    assert.deepEqual(Buffer.from(b64,'base64'),file.buffer);
    await page.locator('[data-dact="addocc"]').setInputFiles({...file,buffer:Buffer.alloc(320000,66)});
    await waitUntil(()=>docs.get(path).ofiles[day].length===3);
    await page.locator('[data-dact="rmocc"][data-file-id="'+id+'"]').click();
    await waitUntil(()=>docs.get(path).ofiles[day].length===2);
    assert.equal(docs.get(path).ofiles[day][0].id,'legacy001');
    assert.notEqual(docs.get(path).ofiles[day][1].id,id);
    const marks=await page.evaluate(()=>{
      const q={t:'single',opts:['А','Б'],ans:[0],text:'Проверка',pts:1};
      const selected=[null,'',0,'0',1].map(a=>{
        const div=document.createElement('div');div.innerHTML=testBody({q:[q]},[a],true,'r');
        return [div.querySelector('input:checked')?.value ?? null,checkQ(q,a)];
      });closeDlg();return selected;
    });
    assert.deepEqual(marks,[[null,false],[null,false],['0',true],['0',true],['1',false]]);
    page.once('dialog',d=>d.accept());await page.locator('#ph-bar [data-a=out]').click();
    await page.waitForFunction(()=>!localStorage.getItem('ph_code'));
    const storage=await page.evaluate(()=>['bamboo-dirty','bamboo-docs','hwd:test','another-app','srRecent','ph_role'].map(k=>localStorage.getItem(k)));
    assert.deepEqual(storage,['keep','keep','keep','keep',null,null]);
    console.log('PASS',site,width,dark?'dark':'light');
  } finally { await ctx.close(); }
}
(async()=>{
  const browser=await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try { await check(browser,390,true);await check(browser,1180,false); }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
