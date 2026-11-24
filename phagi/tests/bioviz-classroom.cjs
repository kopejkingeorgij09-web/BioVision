// Use a running Phagi site. The student and all server data are local fixtures.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const site = process.argv[2] || 'http://127.0.0.1:18772/phagi/';
const base = new URL(site);
const student = 'bio-reader-fixture';

async function exercise(browser,width){
  const context = await browser.newContext({viewport:{width,height:850},serviceWorkers:'block',colorScheme:width<700?'dark':'light'});
  try {
    await context.addInitScript(()=>{localStorage.setItem('ph_role','student');localStorage.setItem('ph_code','fixture-reader');});
    await context.route('**/*',route=>{
      if(new URL(route.request().url()).origin===base.origin) return route.continue();
      return route.abort();
    });
    await context.route('**/rest/v1/rpc/*',route=>{
      const req=route.request(), action=req.url().split('/').pop();
      const payload=req.postDataJSON()||{};
      const values={
        ph_login:{id:student,isOwner:false,name:'Ученица'},
        ph_list:payload.p_col==='people'?[{id:student,data:{label:'Ученица'},t:new Date().toISOString()}]:[],
        ph_sync:{ch:[],now:new Date().toISOString()},ph_profiles:{}
      };
      return route.fulfill({json:values[action]??null,headers:{'access-control-allow-origin':'*'}});
    });
    const p=await context.newPage(), errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    p.setDefaultTimeout(10000);
    await p.goto(site,{waitUntil:'domcontentloaded'});
    const nav=p.locator('#nav'), tabs=p.locator('.bv-shelf-nav');
    await nav.locator('[data-v=bio]').click().catch(async e=>{throw Error(e.message+' '+errors.join(' | ')+' '+(await p.locator('body').innerText()).slice(0,340))});
    const findBook=key=>p.locator('.bv-book[data-book="'+key+'"]');
    await p.locator('.bv-find input').fill('репарация');
    await p.locator('.bv-results li a').first().click();
    const frame=p.frameLocator('#bv-reader');
    const ready=()=>frame.locator('html[data-reading-ready=true]').waitFor();
    await ready();
    assert.equal(new URL(p.url()).pathname,base.pathname);
    assert.equal(new URL(p.url()).searchParams.get('bio'),'repair');
    assert.ok(await nav.locator('[data-v=bio]').isVisible());
    await tabs.locator('[data-bio=library]').click();
    await p.locator('.bv-find input').fill('');
    await findBook('replication').locator('.bv-read-link').click();
    await ready();
    const start=p.url();
    const outline=frame.locator('.desk-outline');
    if(!(await outline.isVisible()))await frame.getByRole('button',{name:'Оглавление',exact:true}).click();
    await outline.locator('.desk-topic[href="#chemistry"]').click();
    await p.waitForURL(u=>u.hash==='#chemistry');
    await frame.getByRole('button',{name:'Поставить закладку'}).click();
    await p.goBack();await p.waitForURL(start);await ready();
    await p.goForward();await ready();
    assert.equal(new URL(p.url()).hash,'#chemistry');
    await p.reload({waitUntil:'domcontentloaded'});await ready();
    assert.equal(await frame.locator('#chemistry').isVisible(),true);
    await frame.locator('.desk-home').click();
    await findBook('replication').locator('.bv-contents-toggle').click();
    assert.ok(await findBook('replication').getByText('Мои закладки',{exact:true}).isVisible());
    await findBook('microbiology').locator('.bv-read-link').click();
    await ready();assert.ok(await frame.locator('#microbook').isVisible());
    const hostSession=await p.evaluateHandle(()=>document);
    await tabs.locator('[data-bio=viz]').click();
    const models=p.locator('#bvhost .classroom-tools select');
    await models.selectOption('heart');
    assert.ok(await p.locator('#bvhost #m-heart').isVisible());
    await tabs.locator('[data-bio=quiz]').click();
    assert.ok(await p.locator('#bvhost #m-quiz').isVisible());
    await nav.locator('[data-v=cal]').click();
    await p.locator('#bv-room').waitFor({state:'hidden'});
    assert.equal(new URL(p.url()).searchParams.has('bio'),false);
    await p.goBack();await p.locator('#bvhost #m-quiz').waitFor();
    assert.equal(await p.evaluate(node=>node===document,hostSession),true);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    assert.deepEqual(errors,[]);
    await hostSession.dispose();
    console.log('PASS',width,'catalogue, all books, chapter history, resume, bookmarks, models, exercises and platform navigation');
  } finally {await context.close();}
}
(async()=>{
  const browser=await chromium.launch({...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),headless:true});
  try{await Promise.all([exercise(browser,390),exercise(browser,1180)]);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
