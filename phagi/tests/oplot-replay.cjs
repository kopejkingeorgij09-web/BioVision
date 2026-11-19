// Replay an isolated server recording against archived terrain, independent of the current island.
const assert=require('node:assert/strict');const {fixtures,studyBackend,profiles}=require('./oplot-game.cjs');
const {chromium,webkit}=(()=>{try{return require('playwright');}catch{return require('playwright-core');}})();
const url=new URL(process.argv[2]||'http://127.0.0.1:18748/phagi/');url.searchParams.set('oplot','1');
const report={day:'2026-11-20',wave:3,stars:2,percent:50,goldLost:45,berriesLost:9,
 replay:{v:1,duration:5,buildings:[{id:'fort',type:'keep',x:4,y:4,level:1,hp:100},{id:'arch',type:'archer',x:4,y:2,level:1,hp:30}],
 attackers:[{id:'a1',species:3,level:6,x:0,y:4,hp:30,flying:false}],defenders:[{id:'d1',species:0,level:6,x:3,y:4,hp:30}],
 events:[{t:1,kind:'move',id:'a1',target:'a1',from:[0,4],to:[1,4],text:'Налётчик наступает'},
 {t:2,kind:'tower',id:'arch',target:'a1',from:[4,2],to:[1,4],amount:20,hp:10,text:'Лучники попадают в цель'},
 {t:4,kind:'fall',id:'d1',target:'a1',from:[3,4],to:[1,4],hp:0,text:'Дракон выбыл'},
 {t:5,kind:'end',amount:2,text:'Оборона завершена'}]}};
const largeReport={...report,day:'2026-11-19',wave:2,replay:{v:1,duration:2,gridSize:16,gridWidth:16,gridHeight:15,
 buildings:[{id:'edge-keep',type:'keep',level:3,hp:200,x:15,y:14}],
 attackers:[{id:'edge-raider',species:0,level:4,hp:50,x:15,y:9}],defenders:[],
 events:[{t:1,kind:'move',id:'edge-raider',target:'edge-raider',from:[15,9],to:[15,10],text:'Дракон у дальнего края'}]}};
async function checkRecordedTerrain(map,record,y,time){
 const pixels=await map.evaluate((canvas,{record,y,time})=>{
  const {width:w,height:h}=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  const ref=document.createElement('canvas');ref.width=canvas.width;ref.height=canvas.height;
  const c=ref.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
  Art.island(c,w,h,time,{buildings:record.buildings,dragons:[],grid:false,gridSize:16,gridWidth:16,gridHeight:15,theme:'defense'});
  const a=c.getImageData(0,0,ref.width,ref.height).data,b=canvas.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
  const point=Art.point(15,y,w,h,16),radius=Math.max(8,Math.min(w/18,h/11)*10/16)*3;
  let actor=0,elsewhere=0;
  for(let j=0;j<b.length;j+=4){
   if(a[j]===b[j]&&a[j+1]===b[j+1]&&a[j+2]===b[j+2]&&a[j+3]===b[j+3])continue;
   const x=(j/4%ref.width)/dpr,py=Math.floor(j/4/ref.width)/dpr;
   // A fractional CSS canvas height can leave one antialiased edge row in the backing store.
   if(x<2||x>w-2||py<2||py>h-2)continue;
   if(Math.hypot(x-point.x,py-point.y)<radius)actor++;else elsewhere++;
  }
  return {actor,elsewhere,cell:Art.cell(point.x,point.y,w,h,16)};
 },{record,y,time});
 assert.deepEqual(pixels.cell,{x:15,y});assert.ok(pixels.actor>15,'the attacker is visible at its recorded far-edge tile');
 assert.equal(pixels.elsewhere,0,'all terrain and the far-edge keep must match the archived 16×15 layout');
}
async function check(browser,width){const ctx=await browser.newContext({viewport:{width,height:800},reducedMotion:width<500?'reduce':'no-preference',serviceWorkers:'block'});
 try{await studyBackend(ctx,fixtures());const errors=[];let reports=[report,largeReport];
 await ctx.route('**/rpc/ph_oplot_raids',r=>r.fulfill({json:reports}));
 await ctx.addInitScript(code=>localStorage.setItem('ph_code',code),profiles[0].code);
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url.href,{waitUntil:'domcontentloaded'});
 const f=page.frameLocator('#oplot-game'),d=f.locator('#night-report');await f.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
 await f.getByRole('button',{name:'Отчёты о ночных набегах'}).click();await d.getByText('Золото −45 · ягоды −9').waitFor();
 const map=d.locator('canvas');await d.locator('canvas[aria-label*="10×10"]').waitFor();
 const timeline=d.locator('[data-night-seek]');assert.equal(await timeline.inputValue(),'0');
 await d.getByRole('button',{name:'Следующее событие'}).click();assert.equal(await timeline.inputValue(),'1');await d.getByText('Налётчик наступает').waitFor();
 await timeline.focus();await timeline.press('End');await d.getByText('Оборона завершена').waitFor();
 await d.getByRole('button',{name:'Сначала'}).click();await d.getByRole('button',{name:'Пауза'}).click();
 await d.locator('select').selectOption('1');assert.equal(await timeline.inputValue(),'0');
 await d.locator('canvas[aria-label*="16×15"]').waitFor();
 await checkRecordedTerrain(map,largeReport.replay,9,0);
 await d.getByRole('button',{name:'Следующее событие'}).click();await d.getByText('Дракон у дальнего края').waitFor();
 await checkRecordedTerrain(map,largeReport.replay,10,1);
 assert.ok((await map.boundingBox()).width>250);
 await map.evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const samples=new Set();for(let i=0;i<a.length;i+=1024)samples.add((a[i]<<16)|(a[i+1]<<8)|a[i+2]);if(samples.size<12)throw Error('Map has no rendered terrain');});
 if(process.env.OPLOT_REPLAY_SCREEN)await d.screenshot({path:process.env.OPLOT_REPLAY_SCREEN+'-'+width+'.png'});
 await d.getByRole('button',{name:'Закрыть отчёты'}).click();reports=[];
 await f.getByRole('button',{name:'Отчёты о ночных набегах'}).click();await d.getByRole('heading',{name:'Ночных набегов пока не было'}).waitFor();await d.getByText('Правила ночного дозора').click();await d.getByText(/25%, 50% и 80%/).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS archived 10×10 and 16×15 terrain, far-edge movement, play/pause, seek, recorded events, previous day and empty raid history',width);
 }finally{await ctx.close();}}
(async()=>{const b=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});try{await check(b,1180);await check(b,390);}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
