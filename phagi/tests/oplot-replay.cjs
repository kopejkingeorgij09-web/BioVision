// Replay an isolated server recording against archived terrain, independent of the current island.
const assert=require('node:assert/strict');const {fixtures,studyBackend,profiles}=require('./oplot-game.cjs');
const {chromium,webkit}=(()=>{try{return require('playwright');}catch{return require('playwright-core');}})();
const url=new URL(process.argv[2]||'http://127.0.0.1:18748/phagi/');url.searchParams.set('oplot','1');
const report={day:'2026-11-20',wave:3,stars:2,percent:50,goldLost:45,berriesLost:9,
 replay:{v:1,duration:5,buildings:[{id:'fort',type:'keep',x:4,y:4,level:1,hp:100},{id:'arch',type:'archer',x:4,y:2,level:1,hp:30}],
 attackers:[{id:'a1',species:3,level:6,x:0,y:4,hp:30,flying:false}],defenders:[{id:'d1',species:0,level:6,x:3,y:4,hp:30}],
 events:[{t:1,kind:'move',id:'a1',target:'a1',from:[0,4],to:[1,4],text:'Налётчик наступает'},
 {t:2,kind:'tower',id:'arch',target:'a1',from:[4,2],to:[1,4],amount:20,hp:10,text:'Лучники попадают в цель'},
 {t:5,kind:'guard',id:'d1',target:'a1',from:[3,4],to:[1,4],amount:10,hp:0,text:'Последний удар защитника'},
 {t:5,kind:'fall',id:'d1',target:'a1',from:[3,4],to:[1,4],hp:0,text:'Дракон выбыл'},
 {t:5,kind:'end',amount:2,text:'Оборона завершена'}]}};
const largeReport={...report,day:'2026-11-19',wave:2,replay:{v:1,duration:2,gridSize:16,gridWidth:16,gridHeight:15,
 buildings:[{id:'edge-keep',type:'keep',level:3,hp:200,x:15,y:14}],
 attackers:[{id:'edge-raider',species:0,level:4,hp:50,x:15,y:9}],defenders:[],
 events:[{t:1,kind:'move',id:'edge-raider',target:'edge-raider',from:[15,9],to:[15,10],text:'Дракон у дальнего края'}]}};
const multiReport={...report,day:'2026-11-18',wave:1,replay:{v:3,layoutVersion:2,duration:2,gridSize:32,gridWidth:32,gridHeight:30,
 buildings:[{id:'edge-keep',type:'keep',span:7,level:3,hp:200,x:25,y:23}],
 attackers:[{id:'a',species:0,level:4,hp:50,x:31,y:12}],defenders:[],
 events:[{t:1,kind:'move',id:'a',target:'a',from:[31,12],to:[31,14],text:'Два шага вдоль берега'}]}};
const wideReport={...report,day:'2026-11-17',wave:4,replay:{v:3,layoutVersion:2,duration:2,gridSize:55,gridWidth:55,gridHeight:52,
 buildings:[{id:'edge-keep',type:'keep',span:5,level:3,hp:200,x:50,y:47}],
 attackers:[{id:'a',species:0,level:4,hp:50,x:54,y:28}],defenders:[],
 events:[{t:1,kind:'move',id:'a',target:'a',from:[54,28],to:[54,30],text:'Налётчик у дальнего края большой карты'}]}};
async function checkRecordedTerrain(map,record,y,time){
 const pixels=await map.evaluate(async(canvas,{record,y,time})=>{
  // A paused scene repaints when its SVG finishes decoding on the next animation frame.
  function compare(){
   const {width:w,height:h}=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
   const ref=document.createElement('canvas');ref.width=canvas.width;ref.height=canvas.height;
   const c=ref.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
   const side=record.gridSize,scale=record.layoutVersion===2?2:1;
   Art.island(c,w,h,time,{buildings:record.buildings,layoutVersion:record.layoutVersion||1,dragons:[],grid:false,gridSize:side,gridWidth:record.gridWidth,gridHeight:record.gridHeight,theme:'defense'});
   const a=c.getImageData(0,0,ref.width,ref.height).data,b=canvas.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
   const point=Art.point(side-1,y,w,h,side),radius=Art.unit(w,h,side)*scale*2.2;
   let actor=0,elsewhere=0;
   for(let j=0;j<b.length;j+=4){
    // Chromium may migrate a frequently sampled canvas to software, changing gradient rounding and edge antialiasing.
    if(Math.abs(a[j]-b[j])<=4&&Math.abs(a[j+1]-b[j+1])<=4&&Math.abs(a[j+2]-b[j+2])<=4&&a[j+3]===b[j+3])continue;
    const x=(j/4%ref.width)/dpr,py=Math.floor(j/4/ref.width)/dpr;
    // A fractional CSS canvas height can leave one antialiased edge row in the backing store.
    if(x<2||x>w-2||py<2||py>h-2)continue;
    if(Math.hypot(x-point.x,py-point.y)<radius)actor++;else elsewhere++;
   }
   return {actor,elsewhere,cell:Art.cell(point.x,point.y,w,h,side)};
  }
  let result=compare();
  for(let frame=0;result.elsewhere&&frame<30;frame++){
    await new Promise(resolve=>requestAnimationFrame(resolve));
    result=compare();
  }
  return result;
 },{record,y,time});
 assert.deepEqual(pixels.cell,{x:record.gridSize-1,y});assert.ok(pixels.actor>15,'the attacker is visible at its recorded far-edge tile');
 assert.equal(pixels.elsewhere,0,'all terrain and the far-edge keep must match the archived footprints and dimensions');
}
async function check(browser,width){const ctx=await browser.newContext({viewport:{width,height:800},reducedMotion:width<500?'reduce':'no-preference',serviceWorkers:'block'});
 try{await studyBackend(ctx,fixtures());const errors=[];let reports=[report,largeReport,multiReport,wideReport],calls=0,failNext=true,delay=false,release,reached;
 const training={day:report.day,wave:3,stars:0,originalStars:2,replay:{...largeReport.replay,
  duration:5,events:report.replay.events,attackers:report.replay.attackers,gridWidth:11,gridHeight:10,gridSize:11}};
 await ctx.route('**/rpc/ph_oplot_practice',async route=>{
  const payload=route.request().postDataJSON();calls++;
  assert.equal(payload.p_day,report.day);assert.equal(payload.p_code,profiles[0].code);
  assert.deepEqual(Object.keys(payload.p_island).sort(),['buildings','dragons','layoutVersion','xp']);
  assert.equal(payload.p_island.layoutVersion,2);assert.ok(payload.p_island.buildings.some(b=>b.type==='keep'));
  if(failNext){failNext=false;return route.fulfill({status:503,json:{message:'fixture unavailable'}})}
  if(delay)await new Promise(resolve=>{release=resolve;reached()});
  return route.fulfill({json:training});
 });
 await ctx.route('**/rpc/ph_oplot_raids',r=>r.fulfill({json:reports}));
 await ctx.addInitScript(code=>localStorage.setItem('ph_code',code),profiles[0].code);
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url.href,{waitUntil:'domcontentloaded'});
 const f=page.frameLocator('#oplot-game'),d=f.locator('#night-report');await f.locator('#island-cloud-status').filter({hasText:'Остров в облаке'}).waitFor();
 await f.getByRole('button',{name:'Отчёты о ночных набегах'}).click();await d.getByText('Золото −45 · ягоды −9').waitFor();
 const map=d.locator('canvas');await d.locator('canvas[aria-label*="10×10"]').waitFor();
 const timeline=d.locator('[data-night-seek]');assert.equal(await timeline.inputValue(),'0');
 await d.getByRole('button',{name:'Следующее событие'}).click();assert.equal(await timeline.inputValue(),'1');await d.getByText('Налётчик наступает').waitFor();
 await timeline.focus();await timeline.press('End');assert.equal(await d.locator('[data-night-event]').textContent(),'Оборона завершена','End must reach the last event of a grouped server tick');
 await d.getByRole('button',{name:'Сначала'}).click();await d.getByRole('button',{name:'Пауза'}).click();
 await d.locator('select').selectOption('1');assert.equal(await timeline.inputValue(),'0');
 await d.locator('canvas[aria-label*="16×15"]').waitFor();
 await checkRecordedTerrain(map,largeReport.replay,9,0);
 await d.getByRole('button',{name:'Следующее событие'}).click();await d.getByText('Дракон у дальнего края').waitFor();
 await checkRecordedTerrain(map,largeReport.replay,10,1);
 await d.locator('select').selectOption('2');await d.locator('canvas[aria-label*="32×30"]').waitFor();
 await checkRecordedTerrain(map,multiReport.replay,12,0);
 await d.getByRole('button',{name:'Следующее событие'}).click();await d.getByText('Два шага вдоль берега').waitFor();
 await checkRecordedTerrain(map,multiReport.replay,14,1);
 await d.locator('select').selectOption('3');await d.locator('canvas[aria-label*="55×52"]').waitFor();
 await checkRecordedTerrain(map,wideReport.replay,28,0);
 await d.getByRole('button',{name:'Следующее событие'}).click();await d.getByText('Налётчик у дальнего края большой карты').waitFor();
 await checkRecordedTerrain(map,wideReport.replay,30,1);
 assert.ok((await map.boundingBox()).width>250);
 await map.evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const samples=new Set();for(let i=0;i<a.length;i+=1024)samples.add((a[i]<<16)|(a[i+1]<<8)|a[i+2]);if(samples.size<12)throw Error('Map has no rendered terrain');});
 await d.locator('select').selectOption('0');
 const practice=d.getByRole('button',{name:'Испытать оборону'});
 await practice.click();await d.getByText('Не удалось рассчитать тренировку.',{exact:false}).waitFor();assert.ok(await practice.isEnabled());
 await practice.click();await d.getByRole('heading',{name:'Тренировка обороны'}).waitFor();
 await d.getByText(/ночью — 2 из 3, сейчас — 0 из 3/).waitFor();await d.locator('canvas[aria-label*="11×10"]').waitFor();
 await timeline.focus();await timeline.press('End');assert.equal(await d.locator('[data-night-event]').textContent(),'Оборона завершена','End must reach the last event of a grouped server tick');
 await d.getByRole('button',{name:'К ночной записи'}).click();await d.getByText('Золото −45 · ягоды −9').waitFor();
 delay=true;const pending=new Promise(resolve=>reached=resolve);await Promise.all([pending,practice.click()]);
 await d.locator('select').selectOption('1');assert.equal(typeof release,'function');release();delay=false;
 await d.locator('canvas[aria-label*="16×15"]').waitFor();assert.equal(await d.locator('[data-night-original]').count(),0);
 assert.equal(calls,3);
 if(process.env.OPLOT_REPLAY_SCREEN)await d.screenshot({path:process.env.OPLOT_REPLAY_SCREEN+'-'+width+'.png'});
 await d.getByRole('button',{name:'Закрыть отчёты'}).click();reports=[];
 await f.getByRole('button',{name:'Отчёты о ночных набегах'}).click();await d.getByRole('heading',{name:'Ночных набегов пока не было'}).waitFor();await d.getByText('Правила ночного дозора').click();await d.getByText(/25%, 50% и 80%/).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS archived 10×10, 16×15, 32×30 and multi-cell 55×52 terrain, far-edge movement, play/pause, seek, training, comparison with original stars, retry, stale training response and empty history',width);
 }finally{await ctx.close();}}
(async()=>{const b=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});try{await check(b,1180);await check(b,390);}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
