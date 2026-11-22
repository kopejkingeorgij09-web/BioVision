'use strict';
document.querySelectorAll('.lab button').forEach(button=>{
  button.addEventListener('click',()=>{
    const box=button.closest('fieldset');
    box.querySelectorAll('button').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    box.querySelector('output').textContent=button.dataset.result;
  });
});
const rate=document.querySelector('#rate');
rate.addEventListener('input',()=>{
  document.querySelector('#count').textContent=rate.value+' % · ожидаемое число оставшихся несоответствий на 10⁸ включений: '+(100-Number(rate.value))+'.';
});
document.querySelectorAll('.mol').forEach(details=>{
  let points,loading=false;
  const slider=details.querySelector('input'), canvas=details.querySelector('canvas');
  const ctx=canvas.getContext('2d');
  function draw(){
    if(!points)return;
    const theta=Number(slider.value)*Math.PI/180,cs=Math.cos(theta),sn=Math.sin(theta);
    const view=points.map(([x,y,z,k])=>[x*cs-z*sn,y,z*cs+x*sn,k]).sort((a,b)=>a[2]-b[2]);
    ctx.fillStyle='#edf3ee';ctx.fillRect(0,0,650,390);
    for(const [x,y,z,k] of view){
      ctx.fillStyle=['#368278','#73988a','#a64d1a','#ffc130'][k];
      ctx.beginPath();ctx.arc(325+x,195+y,k<2?5:6,0,2*Math.PI);ctx.fill();
    }
  }
  slider.addEventListener('input',draw);
  details.addEventListener('toggle',async()=>{
    if(!details.open||points||loading)return;
    loading=true;
    try{
      const response=await fetch('fig/'+canvas.dataset.model+'.json');
      if(!response.ok)throw Error('load');
      points=await response.json();draw();
    }catch{details.querySelector('p').textContent='Не удалось загрузить координаты. Закройте и снова откройте модель.';}
    finally{loading=false;}
  });
});
