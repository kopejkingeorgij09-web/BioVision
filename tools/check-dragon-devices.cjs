// DRAGON_QA_ACCOUNTS points to a private JSON array of isolated school test accounts.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const account=JSON.parse(fs.readFileSync(process.env.DRAGON_QA_ACCOUNTS,'utf8'))[Number(process.env.DRAGON_QA_INDEX||0)];
assert.ok(account.uid.startsWith('qa-isle-'));
const base=new URL(process.env.DRAGON_PHAGI_URL||'http://127.0.0.1:8793/phagi/');
const game=new URL('island/',base).href;
async function login(p){
 await p.goto(game,{waitUntil:'domcontentloaded'});await p.getByRole('link',{name:'Войти в «Фаги»'}).click();
 await p.locator('#ph-code').fill(account.code);await p.locator('#ph-login button[type=submit]').click();
 await p.waitForURL(game);await p.locator('.map-world .piece').first().waitFor();
}
async function checkedBounds(p){
 return await p.evaluate(()=>{
 const world=document.querySelector('.map-world').getBoundingClientRect();
 for(const el of document.querySelectorAll('.piece')){
 const r=el.getBoundingClientRect();
 for(const x of [r.left,r.right])for(const y of [r.top,r.bottom]){
 const u=(x-world.left)/world.width*1000,v=(y-world.top)/world.height*960;
 if(Math.abs(u-500)/490+Math.abs(v-455)/308>1.001)throw Error(el.className+' outside island');
 }}
 return {viewport:[innerWidth,innerHeight],cells:document.querySelectorAll('.terrain polygon[stroke-linejoin=round]').length,overflow:document.documentElement.scrollWidth>innerWidth};
 });
}
async function pick(p,id){
 await p.locator('[data-do="go/build"]').click();
 await p.locator('[data-do="selectB/'+id+'"]').click();
 await p.locator('[data-do="move/'+id+'"]').waitFor();
}
async function run(){
 const desktop=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const mobile=await webkit.launch({headless:true});
 try{
 const pc=await desktop.newPage({viewport:{width:1440,height:900},timezoneId:'Europe/Moscow'});
 const phone=await mobile.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,colorScheme:'dark',timezoneId:'Europe/Moscow'});
 const errors=[];for(const p of [pc,phone]){p.setDefaultTimeout(25000);p.on('pageerror',e=>errors.push(e.message));}
 await Promise.all([login(pc),login(phone)]);const before=await checkedBounds(pc),narrow=await checkedBounds(phone);
 assert.ok(!before.overflow&&!narrow.overflow);assert.equal(before.cells,25);assert.equal(narrow.cells,25);
 const tower=pc.locator('[data-building="tower"]');const prior=await tower.getAttribute('style');
 await pick(phone,'tower');await phone.locator('[data-do="move/tower"]').click();await phone.locator('.terrain [data-cell]').first().waitFor();
 const cells=phone.locator('[data-cell][aria-disabled=false]');const dest=await cells.nth(1).getAttribute('data-cell');
 const select=phone.locator('[data-cell="'+dest+'"] polygon');await select.tap();await phone.locator('[data-do="confirmPlot"]').click();
 await phone.locator('.map:not(.editing)').waitFor();await pc.reload({waitUntil:'domcontentloaded'});await tower.waitFor();
 assert.notEqual(await tower.getAttribute('style'),prior);assert.equal(await tower.getAttribute('style'),await phone.locator('[data-building="tower"]').getAttribute('style'));await checkedBounds(phone);
 await pc.locator('[data-do="go/build"]').click();await pc.locator('[data-do="place/storm"]').click();
 await pc.locator('[data-cell][aria-disabled=false] polygon').first().click();await pc.locator('[data-do="confirmPlot"]').click();await pc.locator('.piece.storm').waitFor();
 await phone.reload({waitUntil:'domcontentloaded'});await phone.locator('.piece.storm').waitFor();await checkedBounds(phone);
 const name=await phone.locator('.piece.storm').getAttribute('data-building');
 await pick(phone,name);assert.match(await phone.locator('.side').innerText(),/Разряд перепрыгивает/);
 await phone.locator('[data-do="clear"]').click();await phone.locator('[data-do="go/book"]').click();assert.equal(await phone.locator('.spec').count(),100);
 await phone.selectOption('#f1','4');assert.equal(await phone.locator('.spec').count(),15);await phone.locator('.spec').first().click();await phone.locator('.plate img').waitFor();
 await phone.waitForFunction(()=>document.querySelector('.plate img')?.naturalWidth>100);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({platform:base.href,desktop:desktop.version(),webkit:mobile.version(),desktopView:before,phoneView:narrow,roster:'100 / 15 legendary',crossDevice:'phone moved tower; desktop built storm; phone found it after reload'}));
 }finally{await Promise.all([desktop.close(),mobile.close()]);}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
