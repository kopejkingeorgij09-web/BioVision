module.exports=async(page,{OUT,need})=>{
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{window.perfLong=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.perfLong.push(e.duration)}).observe({type:'longtask',buffered:true})});
 await page.click('[data-act=go][data-v=cards]');await page.waitForTimeout(500);await page.click('[data-act=drgopen][data-full]');await page.waitForTimeout(4000);
 await page.evaluate(()=>{window.perfLong=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.perfLong.push(e.duration)}).observe({type:'longtask'})});
 for(let n=0;n<4;n++){await page.locator('.drg-zm [data-v=in]').click();await page.waitForTimeout(150)}
 const area=await page.locator('.drg-map.full').boundingBox();await page.mouse.move(area.x+area.width*.6,area.y+area.height*.5);await page.mouse.down();for(let i=0;i<30;i++)await page.mouse.move(area.x+area.width*.6-i*7,area.y+area.height*.5+Math.sin(i/5)*60);await page.mouse.up();await page.waitForTimeout(5000);
 const stats=await page.evaluate(()=>{const s=DRLIVE.stats(),a=s.frame.slice().sort((a,b)=>a-b),d=s.draw.slice().sort((a,b)=>a-b);return {dragons:s.dragons,frames:a.length,p50:a[a.length>>1],p95:a[Math.floor(a.length*.95)],draw95:d[Math.floor(d.length*.95)],long:window.perfLong,heap:performance.memory&&performance.memory.usedJSHeapSize,canvas:[...document.querySelectorAll('canvas')].map(c=>[c.width,c.height])}});console.log('PERF',JSON.stringify(stats));need(stats.frames>20,'анимация продолжает работать');await page.screenshot({path:OUT+'/island.png'});
};
