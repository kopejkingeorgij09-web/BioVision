module.exports=async(page,{OUT,need})=>{
 await page.click('[data-act=go][data-v=cards]');await page.waitForTimeout(400);await page.click('[data-act=drgopen][data-full]');await page.waitForTimeout(1800);
 const result=await page.evaluate(async()=>{
  const ph=DRG.gamePhenotype(DRG.make({sex:'M',E:'F/F',S:'S/S'})),M=window.MORPH.morph(ph,12),G=window.SHAPE.build(M),X=await window.RIG.get(ph,12,{px:8,dpr:2}),A=new window.ANIM.Animator(M,G.rig,{seed:44});
  const cv=document.createElement('canvas');cv.width=1000;cv.height=800;cv.id='art-proof';cv.style='position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#dce8eb;object-fit:contain';document.body.appendChild(cv);const c=cv.getContext('2d'),view=[3,0,0,3,480,720];
  const frame=(read=true)=>{c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,1000,800);view[4]=500-3*(G.box.x+G.box.w/2+A.x);window.RIG.draw(c,X,A.pose,view);return read?c.getImageData(0,0,1000,800).data:null};
  const before=frame();for(let i=0;i<12;i++)A.update(.1);const after=frame();let changed=0;for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>25)changed++;
  A.play('walk');for(let i=0;i<4;i++)A.update(.1);const walk=frame();let moving=0;for(let i=0;i<after.length;i+=4)if(Math.abs(walk[i+3]-after[i+3])>30)moving++;
  const times=[];for(let i=0;i<60;i++){A.update(1/30);const start=performance.now();frame(false);times.push(performance.now()-start)}times.sort((a,b)=>a-b);
  const allHD=[];for(const key of Object.keys(DRART_MANIFEST)){const im=await DRELEMENT.prepare({elements:key.split(''),breath:'element'},12,{pixels:1400});allHD.push(im.width>=1000)}window.RIG.release(X);return {width:X.fullArt.width,height:X.fullArt.height,changed,moving,p95:times[57],allHD:allHD.every(Boolean),sprite:!!A.pose.sprite};
 });console.log('ART-MOTION',JSON.stringify(result));need(result.width>=1000,'детальный исходник крупнее 1000 px');need(result.changed>1000,'движение в покое меняет рисунок');need(result.moving>1000,'ходьба меняет силуэт');need(result.allHD,'все 12 HD-семейств доступны');need(result.sprite,'ригу переданы состояния движения');await page.screenshot({path:OUT+'/motion-hd.png'});await page.evaluate(()=>document.getElementById('art-proof').remove());
 need(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'нет горизонтальной прокрутки');
};
