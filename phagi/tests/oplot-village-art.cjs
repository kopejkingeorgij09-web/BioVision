// Check all playable building levels, including how the silhouettes read on the map.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();

(async()=>{
 const browser=await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
 try{
  const page=await browser.newPage();
  await page.addScriptTag({path:path.join(__dirname,'../oplot-art/village.js')});
  const results=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),changes=[];
   let decoded=0,previous=null;
   for(const type of ['keep','home','den','farm','mine','academy']){
    for(let level=1;level<=(type==='keep'?12:9);level++){
     const art=OplotVillageSVG(type,level);
     const text='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'+art+'</svg>';
     const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));
     try{
      const image=new Image();image.src=url;await image.decode();
      ctx.clearRect(0,0,64,64);ctx.drawImage(image,0,0,64,64);
      const pixels=ctx.getImageData(0,0,64,64).data,shape=new Uint8Array(4096);
      let area=0,difference=0;
      for(let i=0;i<shape.length;i++){
       shape[i]=Number(pixels[i*4+3]>=100);area+=shape[i];
       if(type==='keep'&&previous&&shape[i]!==previous[i])difference++;
      }
      if(area<100)throw Error(type+' level '+level+' is missing its model');
      if(type==='keep'){if(previous)changes.push(difference);previous=shape}
      decoded++;
     }finally{URL.revokeObjectURL(url)}
    }
   }
   return {decoded,changes};
  });
  assert.equal(results.decoded,57);
  assert.equal(results.changes.length,11);
  assert.ok(results.changes.every(n=>n>=35),'Every upgrade changes the keep silhouette at 64px: '+results.changes);
  console.log('PASS 57 village sprites and twelve distinct keep silhouettes at map scale');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
