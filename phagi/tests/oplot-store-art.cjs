// Render isolated SVG storage sprites as images, just like the island renderer.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=(()=>{try{return require('playwright')}catch{return require('playwright-core')}})();

async function main(){
  const browser=await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try{
    const page=await browser.newPage();
    await page.addScriptTag({path:path.join(__dirname,'../oplot-art/stores.js')});
    const results=await page.evaluate(async()=>{
      const c=document.createElement('canvas');c.width=c.height=160;
      const ctx=c.getContext('2d',{willReadFrequently:true});
      async function pixels(type,level,fill){
        const art=OplotStoreSVG(type,level,fill);
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'+art+'</svg>';
        const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
        try{
          const img=new Image();img.src=url;await img.decode();ctx.clearRect(0,0,160,160);ctx.drawImage(img,0,0);
          return ctx.getImageData(0,0,160,160).data;
        }finally{URL.revokeObjectURL(url)}
      }
      const results=[];
      for(const type of ['goldstore','foodstore']){
        for(const level of [1,4,8,10]){
          const empty=await pixels(type,level,0),stages=[];
          for(const amount of [0,.001,.05,.125,.25,.375,.50,.625,.75,.875,1]){
            const rgba=await pixels(type,level,amount);
            let area=0,top=160,outside=0;
            for(let i=0;i<rgba.length;i+=4){
              const delta=Math.abs(rgba[i]-empty[i])+Math.abs(rgba[i+1]-empty[i+1])+Math.abs(rgba[i+2]-empty[i+2]);
              if(delta<60)continue;
              const x=i/4%160,y=Math.floor(i/4/160);
              area++;top=Math.min(top,y);
              if(x<25||x>137||y<38||y>108)outside++;
            }
            stages.push({amount,area,top,outside});
          }
          const almostFull=await pixels(type,level,.99),full=await pixels(type,level,1);
          if(!full.some((byte,i)=>Math.abs(byte-almostFull[i])>30))throw Error('The final portion is invisible');
          results.push({type,level,stages});
        }
        // New construction is visible on an empty store without relying on the pile of stock.
        let prev=await pixels(type,1,0);
        for(let level=2;level<=10;level++){
          const next=await pixels(type,level,0);
          if(!next.some((channel,i)=>Math.abs(channel-prev[i])>28))throw Error('No change at level '+level+' for '+type);
          prev=next;
        }
      }
      return results;
    });
    for(const {type,level,stages} of results){
      assert.equal(stages[0].area,0);
      for(let i=1;i<stages.length;i++){
        const now=stages[i],before=stages[i-1];
        assert.ok(now.area>before.area,type+' L'+level+' visible quantity at '+now.amount+' ('+before.area+' → '+now.area+')');
        assert.equal(now.outside,0,'Stock changes only inside the container');
      }
      assert.ok(stages.at(-1).top<stages[1].top-15,'The full pile rises above the first item');
      assert.ok(stages.at(-1).area>1400,'The full container reads at board scale');
    }
    console.log('PASS 88 decoded storage renders: strictly increasing occupied area, rising pile, empty floor, and ten architectural levels.');
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
