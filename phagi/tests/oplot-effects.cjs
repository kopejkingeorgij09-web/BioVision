// Usage: node phagi/tests/oplot-effects.cjs [URL of phagi/oplot.html]
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium,webkit}=(()=>{try{return require('playwright');}catch{return require('playwright-core');}})();
const url=process.argv[2]||pathToFileURL(path.join(__dirname,'..','oplot.html')).href;

async function check(browser,width,reduced){
  const context=await browser.newContext({viewport:{width,height:800},reducedMotion:reduced?'reduce':'no-preference'});
  try{
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.waitForFunction(()=>!!window.Art?.combatEffect&&!!window.Battle?.profile);
    await page.waitForFunction(()=>{
      // Count the vector images actually composited by the production entry point.
      const c=document.createElement('canvas').getContext('2d'),draw=c.drawImage.bind(c);
      let svg=0;c.drawImage=(image,...args)=>{if(image instanceof HTMLImageElement&&image.src.startsWith('data:image/svg+xml'))svg++;draw(image,...args);};
      const types=['archer','cannon','spire','mortar','skybow','tempest','solar','icetrap','firetrap','wall'];
      for(const level of [1,3,5,8,9,12,16])for(const type of types)Art.building(c,80,90,64,type,level,0);
      return svg===14*7;
    });
    const results=await page.evaluate(reduced=>{
      const canvas=document.createElement('canvas');canvas.width=280;canvas.height=130;
      const c=canvas.getContext('2d',{willReadFrequently:true});
      const from={x:30,y:78},to={x:203,y:75},unit=46;
      function hash(draw){
        c.clearRect(0,0,canvas.width,canvas.height);draw();
        const data=c.getImageData(0,0,canvas.width,canvas.height).data;
        let value=2166136261;
        for(const byte of data)value=Math.imul(value^byte,16777619);
        return value>>>0;
      }
      function shot(kind,species,phase){
        return hash(()=>Art.combatEffect(c,from,to,unit,{kind,species},phase,reduced));
      }
      const blank=hash(()=>{}),signatures=new Set(),hardware=new Set();
      let distinct=true,visible=true;
      for(const {id} of GAME_SPECIES){
        const signature=shot('ultimate',id,.74);
        signatures.add(signature);visible&&=signature!==blank;
        distinct&&=shot('dragon',id,.42)!==shot('ultimate',id,.42);
      }
      for(const kind of ['archer','cannon','spire','mortar','skybow','tempest','solar','icetrap','firetrap']){
        const ink=shot(kind,0,kind.endsWith('trap')?.27:.43);
        hardware.add(ink);visible&&=ink!==blank;
      }
      const turning=['archer','cannon','mortar','skybow'].every(type=>{
        const head=angle=>hash(()=>Art.building(c,110,105,85,type,3,0,{angle,phase:.8}));
        return head(-.8)!==head(1.3);
      });
      const levels=['archer','cannon','spire','mortar','skybow','tempest','solar','icetrap','firetrap','wall'].every(type=>
        new Set([1,3,5,8,9,12,16].map(level=>hash(()=>Art.building(c,110,104,95,type,level,0)))).size===7);
      const walls=new Set(Array.from({length:16},(_,mask)=>OplotDefenseSVG('wall',3,'base',mask))).size;
      const recoil=type=>[.12,.21,.8].map(phase=>hash(()=>Art.building(c,110,104,95,type,3,0,{angle:.12,phase})));
      const moving=new Set(recoil('cannon')).size>=2&&new Set(recoil('archer')).size===3&&new Set(recoil('spire')).size===3;
      const pose=phase=>hash(()=>Art.dragon(c,120,95,100,0,12,1,false,{phase,ultimate:true,reduced}));
      const lunges=pose(.13)!==pose(.32);
      return {species:signatures.size,hardware:hardware.size,distinct,visible,turning,moving,levels,walls,lunges};
    },reduced);
    assert.deepEqual(results,{species:63,hardware:9,distinct:true,visible:true,turning:true,moving:true,levels:true,walls:16,lunges:!reduced});
    const placement=await page.evaluate(width=>{
      const canvas=document.createElement('canvas');
      const w=canvas.width=Math.min(width,810),h=canvas.height=width<500?430:614;
      const c=canvas.getContext('2d',{willReadFrequently:true});
      const keep={type:'keep',id:'keep',x:11,y:11,level:3};
      const vault={type:'goldstore',id:'gold',x:16,y:11,level:3,fill:.5};
      const base={layoutVersion:2,gridSize:35,grid:true,buildings:[keep,vault]};
      const delta=(a,b)=>a.reduce((sum,v,i)=>sum+(Math.abs(v-b[i])>10),0);
      const draw=state=>{
        Art.island(c,w,h,0,state);
        return c.getImageData(0,0,w,h).data;
      };
      const hit=(x,y,state)=>{
        const p=Art.point(x,y,w,h,35);return Art.hit(p.x,p.y,w,h,state)?.id??null;
      };
      const bounds=draw({...base,buildings:[]}),store=draw({...base,buildings:[vault]}),built=draw(base);
      const ghost={...keep,x:24,y:22,valid:true};
      const green=draw({...base,placementPreview:ghost});
      const red=draw({...base,placementPreview:{...ghost,valid:false}});
      const source=Art.point(12,12,w,h,35),oldPixel=(Math.round(source.y)*w+Math.round(source.x))*4;
      const restored=Array.from(green.slice(oldPixel,oldPixel+4)).join()===Array.from(store.slice(oldPixel,oldPixel+4)).join();
      const adjacent=[hit(15,11,base),hit(16,11,base),hit(15,15,base),hit(19,14,base)];
      const demo=Battle.start('defense',4,base,[{species:0,level:20}],{});
      for(let i=0;i<8*24;i++)demo.tick(1/24);
      demo.draw(c,w,h,8);
      const fighting=c.getImageData(0,0,w,h).data;
      return {drawn:delta(bounds,built)>1000,moved:delta(built,green)>1000,
        validity:delta(red,green)>200,restored,adjacent,battle:delta(fighting,built)>1000};
    },width);
    assert.deepEqual(placement,{drawn:true,moved:true,validity:true,restored:true,adjacent:['keep','gold','keep','gold'],battle:true});
    assert.deepEqual(errors,[]);
    console.log('PASS 63 signature impacts, regular shots, SVG defenses, seven sampled levels, 16 wall joints, moving weapons, dragon poses and multi-cell placement/defense',width,reduced?'reduced motion':'full motion');
  }finally{await context.close();}
}
(async()=>{
  const browser=process.env.PHAGI_WEBKIT?await webkit.launch():await chromium.launch(process.env.PHAGI_CHROME?{executablePath:process.env.PHAGI_CHROME}:{});
  try{await check(browser,1180,false);await check(browser,390,true);}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
