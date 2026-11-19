// Exercise the resource art on the shipped map and measure each upgrade at map scale.
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,webkit}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();
const url=process.argv[2]||pathToFileURL(path.resolve(__dirname,'../oplot.html')).href;
const key='phagi.oplot.v1.local.standalone';

async function checkStages(page){
  const changes=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    async function pixels(artist,type,level,fill){
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'+artist(type,level,fill)+'</svg>';
      const image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(svg);
      await image.decode();ctx.clearRect(0,0,64,64);ctx.drawImage(image,0,0,64,64);
      return ctx.getImageData(0,0,64,64).data;
    }
    function difference(before,after){
      let changed=0;
      for(let i=0;i<before.length;i+=4){
        let delta=0;
        for(let channel=0;channel<4;channel++)delta+=Math.abs(before[i+channel]-after[i+channel]);
        if(delta>75)changed++;
      }
      return changed;
    }
    const results=[];
    for(const type of ['farm','mine','goldstore','foodstore']){
      const artist=type.endsWith('store')?OplotStoreSVG:OplotVillageSVG;
      let previous=null;
      for(let level=1;level<=9;level++){
        const empty=await pixels(artist,type,level,0),half=await pixels(artist,type,level,.5),full=await pixels(artist,type,level,1);
        results.push({type,level,upgrade:previous&&difference(previous,empty),first:difference(empty,half),last:difference(half,full)});
        previous=empty;
      }
    }
    return results;
  });
  for(const {type,level,upgrade,first,last} of changes){
    const tag=type+' L'+level;
    if(level>1)assert.ok(upgrade>=45,tag+' changes only '+upgrade+' pixels at 64px');
    assert.ok(first>=4&&last>=4,tag+' stock must grow on the same building: '+first+', '+last);
  }
}

async function checkIsland(page){
  const stamp=Date.now();
  await page.clock.setFixedTime(stamp);
  await page.evaluate(({key,stamp})=>{
    const state=initialState();
    state.gold=3825;state.berries=5910;
    state.buildings[0].level=8;
    const types=[['mine',3,5,5,56250],['farm',5,12,5,75000],['goldstore',4,5,12,0],['foodstore',6,5,18,0]];
    for(const [type,level,x,y,elapsed] of types)state.buildings.push({id:type,type,level,x,y,since:stamp-elapsed});
    if(!validIslandState(state))throw Error('Invalid map fixture');
    localStorage.setItem(key,JSON.stringify(state));
  },{key,stamp});
  await page.reload();

  // Observe the actual draw calls to the game canvas; a decoded offscreen preview is insufficient.
  async function waitForModels(models){
    await page.waitForFunction(models=>{
      const drawn=window.drawnIndustry;
      return models.every(([type,level,fill])=>{
        const artist=type.endsWith('store')?OplotStoreSVG:OplotVillageSVG;
        const mark=encodeURIComponent(artist(type,level,fill));
        return [...drawn].some(src=>src.includes(mark));
      });
    },models,{timeout:8000});
  }
  const models=[['mine',3,.5],['farm',5,.5],['goldstore',4,.5],['foodstore',6,.5]];
  await waitForModels(models);
  const dialog=page.locator('#dialog');
  for(const [type,,fill] of models){
    await page.locator('.tabs [data-do="tab"][data-id="build"]').click();
    await dialog.locator('[data-do="structure"][data-id="'+type+'"]').click();
    assert.equal(Number(await dialog.locator('.portrait [data-building="'+type+'"]').getAttribute('data-fill')),fill);
    await dialog.locator('[data-do="close"]').click();
  }
  await page.evaluate(()=>window.drawnIndustry.clear());
  await page.locator('[data-do="collectall"]').click();
  await waitForModels([['mine',3,0],['farm',5,0]]);
  const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  assert.equal(saved.gold,3825+135);assert.equal(saved.berries,5910+225);
}

(async()=>{
  const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try{
    const page=await browser.newPage({viewport:{width:1180,height:820}});
    await page.addInitScript(()=>{
      window.drawnIndustry=new Set();
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
        if(this.canvas.id==='world'&&image instanceof HTMLImageElement&&image.src.startsWith('data:image/svg+xml'))window.drawnIndustry.add(image.src);
        return draw.call(this,image,...args);
      };
    });
    await page.goto(url);await page.locator('#world').waitFor();
    await checkStages(page);await checkIsland(page);
    console.log('PASS 36 resource buildings at 64px, three stock states per level, live map and inspection, and both producer models after collection.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
