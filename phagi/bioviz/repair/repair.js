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

const tracer=document.querySelector('#ner-tracer');
if(tracer){
  const position=tracer.querySelector('input');
  const strand=tracer.querySelector('select');
  function traceNucleotide(){
    const n=Number(position.value);
    let result;
    if(strand.value==='lower'){
      result='нижней цепи остаётся в непрерывной матрице. Удалённый 28-мер не мечен.';
    }else if(n>=6 && n<=33){
      result='верхней цепи входит в удаляемый 28-мер (6–33). Короткий продукт мечен.';
    }else{
      result='верхней цепи остаётся в '+(n<6?'левом':'правом')+' фрагменте. Удалённый 28-мер не мечен.';
    }
    tracer.querySelector('output').textContent='Позиция '+n+' '+result;
  }
  position.addEventListener('input',traceNucleotide);
  strand.addEventListener('change',traceNucleotide);
  traceNucleotide();
}

document.querySelectorAll('[data-repair-model]').forEach(model=>{
  const choices=[...model.querySelectorAll('[data-select]')];
  const frames=[...model.querySelectorAll('[data-path][data-stage]')];
  const next=model.querySelector('[data-next]');
  const reset=model.querySelector('[data-reset]');
  const status=model.querySelector('.repair-status');
  let path=null, stage=0;
  function render(){
    choices.forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.select===path));
    });
    let active;
    frames.forEach(frame=>{
      const selected=frame.dataset.path===path && Number(frame.dataset.stage)===stage;
      frame.hidden=!selected;
      if(selected)active=frame;
    });
    reset.disabled=path===null;
    if(next){
      next.hidden=path===null;
      next.disabled=!frames.some(frame=>frame.dataset.path===path && Number(frame.dataset.stage)===stage+1);
    }
    status.textContent=active?.dataset.status||'Исходное состояние.';
  }
  for(const button of choices)button.addEventListener('click',()=>{
    path=button.dataset.select;stage=0;render();
  });
  next?.addEventListener('click',()=>{
    stage++;render();
    if(next.disabled)reset.focus();
  });
  reset.addEventListener('click',()=>{
    path=null;stage=0;render();choices[0].focus();
  });
});
