/* Драконы 4.1: два острова, вольеры, пустое Гнездовье, остров целиком в кадре, стройка на Огненном острове.
   Запуск: SCEN=scen_isle2.js DRAG="$(cat isle-lava.json)" W=390 H=844 TOUCH=1 node hx.js ../.. ./out */
module.exports=async(page,{OUT,need,store,UID,writes})=>{
  const W=+(process.env.W||1280),tag=(process.env.TAG||'')+W;const log=(...a)=>console.log('·',...a);const shot=n=>page.screenshot({path:`${OUT}/i2-${tag}-${n}.png`});const w=t=>page.waitForTimeout(t);
  await page.click('[data-act="go"][data-v="cards"]');await w(600);
  await page.click('[data-act="drgmode"][data-v="dragons"]').catch(()=>{});await w(800);
  await page.click('[data-act="drgopen"][data-full]');await w(2500);
  /* кнопки не перекрываются, переход между островами виден */
  const geo=()=>page.evaluate(()=>{const R=e=>e.getBoundingClientRect(),bs=[...document.querySelectorAll('.drg-dock>*,.drg-zm>*,.drg-hud-r>*,.drg-hud-l,.drg-svw>*,.drg-isw')].filter(e=>e.offsetParent).map(e=>[e.dataset.v||e.className.split(' ')[0],R(e)]);
    let ov=[];for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){const a=bs[i][1],b=bs[j][1],x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(x>1&&y>1)ov.push(bs[i][0]+'×'+bs[j][0])}
    const off=bs.filter(([k,r])=>r.left<0||r.right>innerWidth+0.5).map(([k])=>k);return {ov,off,isw:!!document.querySelector('.drg-isw')}});
  let g=await geo();log('перекрытия',JSON.stringify(g.ov),'за краем',JSON.stringify(g.off));
  need(!g.ov.length,'кнопки не перекрываются (с переходом между островами)');need(!g.off.length,'кнопки не за краем');need(g.isw,'есть кнопка перехода на Огненный остров');
  /* пустое Гнездовье без яйца */
  const egg=await page.evaluate(()=>[...document.querySelectorAll('.drg-b')].filter(e=>/^Гнездовье/.test(e.getAttribute('aria-label')||'')).map(e=>({lab:e.getAttribute('aria-label'),egg:!!e.querySelector('ellipse[rx="9"][ry="12"]')})));
  log('гнездовья',JSON.stringify(egg));need(egg.length&&egg.filter(e=>!/пара|яйцо/.test(e.lab)).every(e=>!e.egg),'в пустом Гнездовье нет яйца');
  /* «Весь остров»: кончик скалы в кадре на широком экране */
  if(W>=700){await page.click('.drg-zm [data-v=fit]');await w(700);
    const tip=await page.evaluate(()=>{const sv=document.querySelector('.drg-map.full svg.drg-isl'),r=sv.getBoundingClientRect(),vb=sv.viewBox.baseVal,s=Math.min(r.width/vb.width,r.height/vb.height);
      const cl=[...sv.querySelectorAll('path')].filter(p=>/cliff2/.test(p.getAttribute('fill')||'')),y=Math.max(...cl.map(p=>{const b=p.getBBox();return b.y+b.height})),
      py=r.top+(r.height-vb.height*s)/2+(y-vb.y)*s;const d=document.querySelector('.drg-dock').getBoundingClientRect();/* на компьютере колонка слева: тогда предел — низ окна */
      return {py:Math.round(py),dock:Math.round(d.height>d.width?innerHeight-10:d.top),inVb:y<vb.y+vb.height}});
    log('кончик скалы',JSON.stringify(tip));need(tip.inVb,'кончик скалы внутри рисунка');need(tip.py<tip.dock+40,'кончик скалы над нижним рядом кнопок')}
  await shot('0-green');
  /* живые драконы: каждый в своём дворе или стоит рисунком (cover) */
  await w(5000);
  const yard=await page.evaluate(()=>{const st=DRGUI.stateOf('u_test1').st,P=DRLIVE.PURE,out=[];
    DRLIVE.stats().pos.forEach(x=>{const d=st.dragons.find(z=>z.id===x.id),b=d&&st.bld.find(z=>z.id===d.home);if(!b||DECO.TYPES[b.type].kind!=='hab')return;
      const gr=P.toGrid(ISL,x.p[0],x.p[1]);out.push({id:x.id,how:x.how,ok:x.how==='cover'||P.inYard(ISL.YARD,gr[0]-b.x,gr[1]-b.y),tex:x.tex})});return out});
  log('драконы во дворах',JSON.stringify(yard.map(y=>y.id+':'+(y.ok?'ok':'OUT')+':'+y.how)));
  need(yard.length>0&&yard.every(y=>y.ok),'все драконы внутри своих вольеров');need(yard.some(y=>y.tex),'живые драконы нарисованы');
  /* переход на Огненный остров */
  const n0g=await page.evaluate(()=>document.querySelectorAll('.drg-map.full .drg-b').length);
  await page.click('.drg-isw');await w(2200);
  const lv=await page.evaluate(()=>({lava:!!document.querySelector('.drg-map.full.lava svg.drg-isl.lava'),blds:[...document.querySelectorAll('.drg-map.full .drg-b')].map(e=>e.getAttribute('aria-label').split(':')[0])}));
  log('Огненный остров',JSON.stringify(lv));need(lv.lava,'Огненный остров нарисован в лавовой теме');need(lv.blds.length===3,'на Огненном острове только его постройки');
  g=await geo();need(!g.ov.length,'на Огненном острове кнопки не перекрываются');
  await shot('1-lava');
  /* стройка на Огненном острове: ферма на свободное место */
  const n0=await page.evaluate(()=>DRGUI.stateOf('u_test1').st.bld.length);
  await page.click('[data-act=drgpanel][data-v=shop]');await w(600);
  const can=await page.$('[data-act=drgbuild][data-type=farm]:not([disabled])');
  if(can){await can.click();await w(500);await shot('2-place');await page.click('[data-act=drgauto]');await w(1500);
    const nb=await page.evaluate(()=>{const st=DRGUI.stateOf('u_test1').st,b=st.bld[st.bld.length-1];return {n:st.bld.length,isl:b.isl||0,type:b.type}});
    log('после стройки',JSON.stringify(nb));need(nb.n===n0+1&&nb.isl===1&&nb.type==='farm','ферма построена на Огненном острове');
    const saved=store.get(`srs/${UID}/meta/dragons`).d;need(saved.bld.some(b=>b.isl===1&&b.type==='farm'&&b.build),'запись в базе: ферма с isl:1');
    need(writes.some(x=>/^ph_set_if /.test(x)),'остров пишется через ph_set_if (CAS)')}
  else need(false,'кнопка стройки фермы доступна');
  await shot('3-built');
  /* обратно на Зелёный: его постройки на месте */
  await page.click('.drg-isw');await w(1500);
  const back=await page.evaluate(()=>({lava:!!document.querySelector('svg.drg-isl.lava'),n:document.querySelectorAll('.drg-map.full .drg-b').length}));
  log('обратно',JSON.stringify(back));need(!back.lava&&back.n===n0g,'Зелёный остров с прежними постройками');
};
