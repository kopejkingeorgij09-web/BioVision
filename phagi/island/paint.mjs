import {byId,colors} from './catalog.mjs';
import {position,shores,replay} from './battle.mjs';
import {buildings,capacity} from './game.mjs';
import {project,screenStyle,boardSvg,rangeRadii} from './board.mjs';
import {defenses,defenseStats} from './defenses.mjs';
const cache=new Map();
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escape;
function image(src){if(!cache.has(src)){const im=new Image();im.src='art/'+src+'.webp';cache.set(src,im);}return cache.get(src);}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
export function dragon(cv,id,pose='idle',time=performance.now()){
  const s=byId[id];if(!cv||!s)return;
  const ctx=cv.getContext('2d'),w=cv.width,h=cv.height;ctx.clearRect(0,0,w,h);
  const compact=s.art===s.id, frames=compact?8:12;
  const sheet=image(s.art+(compact?'-motion':'-'+pose));
  if(!sheet.complete||!sheet.naturalWidth){
    const still=image(s.art+'-portrait');
    if(still.complete&&still.naturalWidth){const k=Math.min(w/still.width,h/still.height);ctx.drawImage(still,(w-still.width*k)/2,(h-still.height*k)/2,still.width*k,still.height*k);}return;
  }
  const sw=sheet.naturalWidth/frames,sh=sheet.naturalHeight/(compact?5:1),scale=Math.min(w/sw,h/sh);
  const frame=reduced.matches?0:Math.floor(time/(pose==='attack'?52:100))%frames;
  const row=compact?['idle','walk','attack','hit','finish'].indexOf(pose):0;
  ctx.drawImage(sheet,frame*sw,row*sh,sw,sh,(w-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
}
export function art(s,cls='thumb'){return '<img loading="lazy" class="'+cls+'" style="object-fit:contain" alt="'+esc(s.name)+'" src="art/'+s.art+'-portrait.webp">';}
const point=screenStyle;
function piece(b,chosen,battle){
  const pos='x' in b?b:position(b), kind=b.kind;const hp=battle?100:capacity(b)?Math.min(100,100*(b.stock||0)/capacity(b)):0;
  if(kind==='guard')return animal(b.species,b.id,pos.x,pos.y,true);
  return '<button class="piece '+kind+(chosen===b.id?' chosen':'')+'" style="'+point(pos.x,pos.y)+';z-index:'+Math.round(2+pos.y/30)+'" data-'+(battle?'mark':'building')+'="'+esc(b.id)+'" aria-label="'+buildings[kind]+'"><img src="art/'+kind+'.webp" alt="">'+(battle||['gold','food'].includes(kind)?'<span class="meter"><i style="width:'+hp+'%"></i></span>':'')+(b.finish?'<span class="tag">⌛</span>':'')+'</button>';
}
function animal(sid,id,x,y,battle){return '<button class="animal" style="'+point(x,y)+'" data-'+(battle?'unit':'dragon')+'="'+esc(id)+'" aria-label="'+esc(byId[sid].name)+'"><canvas class="dragon-canvas" width="250" height="155" data-sprite="'+sid+'"></canvas>'+(battle?'<span class="meter"><i></i></span>':'')+'</button>';}
function rangeFor(kind,level,p){const v=defenseStats(kind,level);return v&&{...p,radius:v.range,color:defenses[kind].color};}
export function islandMap(s,chosen,edit=null){
 const selected=s.buildings.find(b=>b.id===(edit?.building||chosen));
 const preview=edit?.cell!=null?{kind:edit.kind||selected?.kind,level:selected?.level||1,col:edit.cell%5,row:Math.floor(edit.cell/5)}:null;
 const here=preview||selected;
 const ring=here?rangeFor(here.kind,here.level,position(here)):null;
 const objects=s.buildings.map(b=>piece(b,chosen,false)).join('');
 const dragons=edit?'':s.dragons.slice(0,3).map((d,i)=>{
  if(d.species==='s3'&&d.born&&d.level===1)return '<button class="animal" style="'+point(32,42)+'" data-dragon="'+esc(d.id)+'" aria-label="Детёныш"><img src="art/baby.webp" alt=""></button>';
  return animal(d.species,d.id,[28,65,57][i],[39,61,25][i],false);
 }).join('');
 const eggs=s.eggs.map(e=>{const b=s.buildings.find(b=>b.id===e.building),p=position(b);return '<img class="nest-egg" alt="Яйцо" style="'+point(p.x,p.y)+'" src="art/egg.webp">';}).join('');
 const ghost=preview?'<img class="plot-preview" alt="Предпросмотр постройки" src="art/'+preview.kind+'.webp" style="'+point(position(preview).x,position(preview).y)+'">':'';
 return '<section class="map'+(edit?' editing':'')+'" aria-label="Карта острова"><div class="hero"><small class="eyebrow">Остров драконов</small><h1 class="hero-title">Янтарный берег</h1></div><div class="map-world">'+boardSvg(s,edit,ring)+objects+dragons+eggs+ghost+'</div><span class="caption">'+(edit?'Расстановка · 5 × 5':s.dragons.length+' · на острове')+'</span></section>';
}
export function battleView(r){return '<section class="map battle" aria-label="Поле боя"><div class="hero"><small class="eyebrow">Набег · <b id="clock"></b></small><h1 class="hero-title">'+esc(r.name)+'</h1></div><div class="map-world">'+boardSvg(null)+r.targets.map(b=>piece(b,'',true)).join('')+r.team.map(d=>animal(d.species,d.id,50,98,true)).join('')+shores.map(([x,y],i)=>'<button class="landing" data-shore="'+i+'" aria-label="Высадка '+(i+1)+'" style="'+point(x,y)+'">⚑ '+(i+1)+'</button>').join('')+'<canvas class="fx" width="1000" height="960"></canvas></div></section>';}
let previousBattle, currentBattle, battleKey;
export function paintBattle(r,now,selected){
 const key=r.id+'-'+r.commands.length+'-'+Math.floor((now-r.start)/250);
 if(key!==battleKey){previousBattle=battleKey?.startsWith(r.id)?currentBattle:null;currentBattle=replay(r,now);battleKey=key;}
 const sim=currentBattle, fraction=Math.min(1,Math.max(0,((now-r.start)%250)/250)),nodes=new Map([...sim.targets,...sim.units].map(o=>[o.id,o]));
 const clock=document.querySelector('#clock');if(!clock)return;clock.textContent=Math.max(0,90-Math.floor((now-r.start)/1000))+' с';
 const sel=sim.units.find(u=>u.id===selected);
 document.querySelectorAll('[data-shore]').forEach(el=>el.hidden=sel?.landed||!!sim.end);
 for(const o of nodes.values()){
  const unit=sim.units.includes(o), el=document.querySelector('.map [data-'+(unit||o.kind==='guard'?'unit':'mark')+'="'+CSS.escape(o.id)+'"]');if(!el)continue;
  el.hidden=unit&&!o.landed;if(el.hidden)continue;
  const prior=unit?previousBattle?.units.find(d=>d.id===o.id):null;
  const x=prior?.landed?prior.x+(o.x-prior.x)*fraction:o.x,y=prior?.landed?prior.y+(o.y-prior.y)*fraction:o.y;
  const p=project(x,y);el.style.left=p.x/10+'%';el.style.top=p.y/9.6+'%';el.classList.toggle('chosen',o.id===selected||o.id===sel?.target);
  el.classList.toggle('dead',o.hp<=0);el.classList.toggle('damaged',o.hp>0&&o.hp<o.max*.55);const meter=el.querySelector('.meter i');if(meter)meter.style.width=Math.max(0,100*o.hp/o.max)+'%';
  if(o.species){const hitting=sim.flashes.some(f=>f.from===o.id),hit=sim.flashes.some(f=>f.to===o.id);dragon(el.querySelector('canvas'),o.species,sim.end?'finish':hit?'hit':hitting?'attack':'walk',now);}
 }
 const cv=document.querySelector('.fx'),c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
 const px=o=>project(o.x,o.y).x,py=o=>project(o.x,o.y).y-14;
 for(const t of sim.targets.filter(t=>t.hp>0&&Object.hasOwn(defenses,t.kind))){const v=defenseStats(t.kind,t.level),[rx,ry]=rangeRadii(v.range);c.beginPath();c.ellipse(px(t),py(t)+14,rx,ry,0,0,7);c.strokeStyle=defenses[t.kind].color+'ac';c.lineWidth=2;c.setLineDash([7,10]);c.stroke();}c.setLineDash([]);
 for(const f of sim.flashes){const a=nodes.get(f.from),b=nodes.get(f.to);if(!a||!b)continue;
   const x=px(a),y=py(a),tx=px(b),ty=py(b);c.strokeStyle=colors[f.type];c.fillStyle=colors[f.type];c.lineWidth=f.skill?7:4;c.beginPath();c.moveTo(x,y);
   elementTrail(c,f.type,x,y,tx,ty,sim.tick-f.tick);
 }
 const targetInfo=document.querySelector('#target-info'),mark=nodes.get(sel?.target);
 if(targetInfo){const value=sel?.landed&&mark?'Цель · '+(buildings[mark.kind]||byId[mark.species]?.name||'Защитник')+' · '+Math.ceil(mark.hp)+' / '+Math.ceil(mark.max):'Ожидает высадки';
 if(targetInfo.textContent!==value)targetInfo.textContent=value;}
 const cd=document.querySelector('#ability');if(cd){const seconds=Math.ceil(((sel?.skillAt||0)-sim.tick)/4);cd.disabled=!sel?.landed||sel.hp<=0||seconds>0||!!sim.end;cd.textContent=seconds>0?'Откат · '+seconds+' с':'Применить способность';}
 return sim;
}
export function idle(time){document.querySelectorAll('.map:not(.battle) [data-sprite]').forEach((cv,i)=>{
 const el=cv.parentElement,t=time/1700+i*1.8;el.style.translate=reduced.matches?'none':Math.sin(t)*6+'px '+Math.cos(t)*1.5+'px';
 dragon(cv,cv.dataset.sprite,Math.sin(t*.45)>.75?'idle':'walk',time+230*i);});}

function elementTrail(c,type,x,y,tx,ty,age){
 const dx=tx-x,dy=ty-y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
 const p=(t,k=0)=>[x+t*dx+k*nx,y+t*dy+k*ny];
 if(type===0)c.quadraticCurveTo(...p(.55,-25),tx,ty);
 if(type===1||type===2){const bend=type===1?20:37;c.bezierCurveTo(...p(.32,-bend),...p(.65,bend),tx,ty);}
 if(type===3){for(const t of [.25,.5,.75,1]){const [a,b]=p(t);c.fillRect(a-4,b-3,9,7);}}
 if(type===4){c.lineTo(tx,ty);for(const t of [.2,.48,.72]){c.moveTo(...p(t));c.quadraticCurveTo(...p(t+.07,-15),...p(t+.12,-9));}}
 if(type===5){for(const [t,k] of [[.27,0],[.38,12],[.55,-10],[.64,8],[1,0]])c.lineTo(...p(t,k));}
 if(type===6){c.moveTo(...p(.55));c.lineTo(tx,ty);c.lineTo(...p(.88,5));c.moveTo(tx,ty);c.lineTo(...p(.88,-5));}
 if(type===7||type===8){for(const t of [.3,.55,.8,1]){const [a,b]=p(t);c.moveTo(a+7,b);c.arc(a,b,7,0,type===7?Math.PI*2:Math.PI*1.4);}}
 if(type===9){c.lineWidth=6;c.moveTo(x,y);c.lineTo(tx,ty);}
 c.stroke();c.beginPath();c.arc(tx,ty,5+age*2,0,Math.PI*2);c.fill();
}
