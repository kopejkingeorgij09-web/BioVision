// Compare screen pixels with the original vector painted directly at the actual camera size.
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const sharp=require('sharp');
const fs=require('node:fs');
const url=process.env.DRAGON_GAME_URL||'http://127.0.0.1:8795/phagi/island/';
const measureOnly=process.argv.includes('--measure-only'),output=process.env.DRAGON_MEDIA_DIR;
async function checkMasters(){
 const path=require('node:path');
 const source=path.resolve(__dirname,'dragon-art/sources');
 for(const [sheet,names] of [['habitats',['home','nest','incubator','food','gold','farm']],['forts',['tower','ice','storm','ward','garrison','mine']]]){
  const {data,info}=await sharp(path.join(source,sheet+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width/3,h=info.height/2;
  for(const [i,name] of names.entries()){
   const ox=i%3*w,oy=Math.floor(i/3)*h;
   let left=w,right=-1,top=h,bottom=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[((oy+y)*info.width+ox+x)*4+3]>40){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   const response=await fetch(new URL('art/settlement/'+name+'.webp?v=master-1',url));assert.ok(response.ok);
   const actual=await sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(actual.info.width,right-left+1,name+' width');assert.equal(actual.info.height,bottom-top+1,name+' height');
   for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const a=((oy+y)*info.width+ox+x)*4,b=((y-top)*actual.info.width+x-left)*4;
    if(actual.data[b+3]!==data[a+3]||(data[a+3]>0&&(actual.data[b]!==data[a]||actual.data[b+1]!==data[a+1]||actual.data[b+2]!==data[a+2])))throw Error('Building differs from painted master: '+name+' '+x+'/'+y);
   }
  }
 }
 console.log('All twelve building sprites preserve their painted source dimensions, alpha and visible pixels.');
}
async function checkDragon(page,selector){
 await page.waitForFunction(async selector=>{
  const svg=document.querySelector(selector+' svg.rigged'),texture=svg?.querySelector('defs image');if(!texture)return false;
  const pic=new Image();pic.src=texture.getAttribute('href');await pic.decode();
  const rect=svg.getBoundingClientRect(),box=svg.viewBox.baseVal;
  return pic.naturalWidth>=Math.min(rect.width/box.width,rect.height/box.height)*texture.width.baseVal.value*devicePixelRatio;
 },selector);
}
async function run(engine,phone,dpr){
 const b=await engine.launch(!phone&&process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 try{
  const page=await b.newPage({viewport:phone?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:dpr,isMobile:phone,hasTouch:phone,reducedMotion:'reduce'});
  await page.goto(url+'?tour=1');await page.locator('.resident svg').first().waitFor();
  for(let i=0;i<5;i++){const button=page.locator('[data-camera=in]');await button.evaluate(el=>el.click());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
  await page.waitForFunction(()=>document.querySelector('[data-camera=in]').disabled);
  if(!measureOnly)await checkDragon(page,'.resident');
  await page.addStyleTag({content:'.world-window .map-world>:not(.ground-art):not(picture),.map>.hero,.map>.camera-tools,.island-tools{visibility:hidden!important}.ground-art{visibility:visible!important}'});
  const surface=await page.locator('.world-window').boundingBox();
  const width=Math.min(450,Math.floor(surface.width*.75)),height=195;
  const clip={x:Math.round(surface.x+(surface.width-width)/2),y:Math.round(surface.y+surface.height*.56),width,height};
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
  await page.locator('.ground-art').evaluate(img=>img.decode());await settle();
  const current=await page.screenshot({clip});
  const size=await page.evaluate(async()=>{
   const world=document.querySelector('.map-world'),img=world.querySelector('.ground-art'),rect=world.getBoundingClientRect(),parent=world.parentElement.getBoundingClientRect();
   img.parentElement.querySelector('source')?.remove();img.src='art/settlement/plateau.svg';await img.decode();
   Object.assign(world.style,{width:rect.width+'px',height:rect.height+'px',left:'0px',top:'0px',willChange:'auto',transform:'translate3d('+(rect.left-parent.left)+'px,'+(rect.top-parent.top)+'px,0)'});
   return Math.round(rect.width*devicePixelRatio);
  });
  await settle();const reference=await page.screenshot({clip});
  const convert=img=>sharp(img).removeAlpha().greyscale().raw().toBuffer({resolveWithObject:true});
  const [a,r]=await Promise.all([convert(current),convert(reference)]);
  let total=0,edges=0,referenceEdges=0,max=0;
  for(let i=r.info.width;i<r.data.length;i++){const err=Math.abs(a.data[i]-r.data[i]);total+=err;max=Math.max(max,err);
   const first=i%r.info.width===0?i:i-1;edges+=Math.abs(a.data[i]-a.data[first])+Math.abs(a.data[i]-a.data[i-r.info.width]);referenceEdges+=Math.abs(r.data[i]-r.data[first])+Math.abs(r.data[i]-r.data[i-r.info.width]);}
  const mae=total/(r.data.length-r.info.width),detail=edges/referenceEdges;
  const tag=(phone?'webkit':'chrome')+'-'+dpr+'x';
  if(output){fs.mkdirSync(output,{recursive:true});fs.writeFileSync(output+'/'+tag+'-game.png',current);fs.writeFileSync(output+'/'+tag+'-reference.png',reference);}
  console.log(JSON.stringify({device:tag,physicalWorldWidth:size,meanPixelError:+mae.toFixed(3),edgeRatio:+detail.toFixed(3),maxError:max}));
  if(!measureOnly){assert.ok(referenceEdges>10000);assert.ok(mae<1.1&&detail>.95&&detail<1.05,'Terrain lost source detail at maximum zoom');}
  if(!measureOnly){
   await page.locator('.dock [data-do="go/book"]').click();await page.locator('.spec').first().click();await checkDragon(page,'.plate .actor');
  }
 }finally{await b.close();}
}
(async()=>{if(!measureOnly)await checkMasters();await run(chromium,false,1);await run(chromium,false,2);await run(webkit,true,3);})().catch(e=>{console.error(e);process.exitCode=1});
