import {byId,colors} from './catalog.mjs';
import {replay} from './battle.mjs';
import {boardSize,position,shorePositions,legacyRaidSize} from './world.mjs';
import {actorMarkup,animateActor} from './actors.mjs';
import {cameraControls} from './camera.mjs';
import {buildings,capacity} from './game.mjs';
import {project,screenStyle,boardSvg,rangeRadii} from './board.mjs';
import {defenses,defenseStats} from './defenses.mjs';
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escape;
export function art(s,cls='thumb'){return '<img loading="lazy" class="'+cls+'" alt="'+esc(s.name)+'" src="art/dragons/thumbs/'+s.id+'.svg">';}
function piece(b,chosen,battle,size=boardSize){
 const pos='x' in b?b:position(b),kind=b.kind;
 if(kind==='guard')return battleAnimal(b.species,b.id,pos.x,pos.y,size);
 const hp=battle?100:capacity(b)?Math.min(100,100*(b.stock||0)/capacity(b)):0;
 return '<button class="piece '+kind+(chosen===b.id?' chosen':'')+'" style="'+screenStyle(pos.x,pos.y,size)+';z-index:'+Math.round(2+(pos.x+pos.y)/22)+'" data-'+(battle?'mark':'building')+'="'+esc(b.id)+'" aria-label="'+buildings[kind]+'"><img draggable="false" src="art/settlement/'+kind+'.webp" alt="">'+(battle||['gold','food'].includes(kind)?'<span class="meter"><i style="width:'+hp+'%"></i></span>':'')+(b.finish?'<span class="tag">⌛</span>':'')+'</button>';
}
function battleAnimal(sid,id,x,y,size){return '<button class="animal fighter" style="'+screenStyle(x,y,size)+'" data-unit="'+esc(id)+'" aria-label="'+esc(byId[sid].name)+'">'+actorMarkup(sid,esc(byId[sid].name))+'<span class="meter"><i></i></span></button>';}
const perches=[[8,-6],[-6,8],[8,7],[-7,-5]];
const residencePages=new Map();
function residentGroups(s){
 const abroad=new Set(s.raid?.team.map(d=>d.id)),groups=new Map();
 for(const d of s.dragons){
  if(abroad.has(d.id))continue;
  const id=d.guard?s.buildings.find(b=>b.kind==='garrison')?.id:d.home;
  if(!groups.has(id))groups.set(id,[]);groups.get(id).push(d);
 }
 return groups;
}
export function rotateResidents(s,home){
 const n=residentGroups(s).get(home)?.length||0;
 residencePages.set(home,((residencePages.get(home)||0)+1)%Math.max(1,Math.ceil(n/perches.length)));
}
export function showResident(s,id){
 for(const [home,list] of residentGroups(s)){
  const at=list.findIndex(d=>d.id===id);
  if(at>=0){residencePages.set(home,Math.floor(at/perches.length));return home;}
 }
}
function residents(s){
 const groups=residentGroups(s);let html='';
 for(const home of s.buildings){
  const all=groups.get(home.id)||[],origin=position(home);
  const page=Math.min(residencePages.get(home.id)||0,Math.max(0,Math.ceil(all.length/perches.length)-1)),start=page*perches.length;
  all.slice(start,start+perches.length).forEach((d,i)=>{
   const [x,y]=perches[i],id=d.species==='s3'&&d.born&&d.level===1?'baby':d.species;
   html+='<button class="animal resident" style="'+screenStyle(origin.x+x,origin.y+y)+';z-index:'+Math.round(4+(origin.x+origin.y)/22)+'" data-home="'+esc(home.id)+'" data-dragon="'+esc(d.id)+'" aria-label="'+esc(byId[d.species].name)+'">'+actorMarkup(id,esc(byId[d.species].name))+'</button>';
  });
  if(all.length>perches.length)html+='<button class="more-residents" data-do="residentsPage/'+esc(home.id)+'" aria-label="Следующие жители жилища" style="'+screenStyle(origin.x+9,origin.y+8)+'">'+(page+1)+'/'+Math.ceil(all.length/perches.length)+' ›</button>';
 }
 return html;
}
function rangeFor(kind,level,p){const v=defenseStats(kind,level);return v&&{...p,radius:v.range,color:defenses[kind].color};}
export function islandMap(s,chosen,edit=null){
 const selected=s.buildings.find(b=>b.id===(edit?.building||chosen));
 const preview=edit?.cell!=null?{kind:edit.kind||selected?.kind,level:selected?.level||1,col:edit.cell%boardSize,row:Math.floor(edit.cell/boardSize)}:null;
 const here=preview||selected;
 const ring=here?rangeFor(here.kind,here.level,position(here)):null;
 const objects=s.buildings.map(b=>piece(b,chosen,false)).join('');
 const dragons=edit?'':residents(s);
 const eggs=s.eggs.map(e=>{const b=s.buildings.find(b=>b.id===e.building),p=position(b);return '<img class="nest-egg" alt="Яйцо" style="'+screenStyle(p.x,p.y)+'" src="art/egg.webp">';}).join('');
 const ghost=preview?'<img class="plot-preview" alt="Предпросмотр постройки" src="art/settlement/'+preview.kind+'.webp" style="'+screenStyle(position(preview).x,position(preview).y)+'">':'';
 return '<section class="map settlement'+(edit?' editing':'')+'" aria-label="Карта острова"><div class="world-window" tabindex="0" aria-label="Карта. Стрелки перемещают обзор, плюс и минус меняют масштаб"><div class="map-world">'+boardSvg(s,edit,ring)+objects+dragons+eggs+ghost+'</div></div><div class="hero"><h1 class="hero-title">Янтарный берег</h1><small class="map-info">'+(edit?'Расстановка':'10 × 10 клеток · '+s.dragons.length+' '+(s.dragons.length===1?'дракон':'в коллекции'))+'</small></div>'+cameraControls+'</section>';
}
export function battleView(r){
 const n=r.boardSize??legacyRaidSize;
 const objects=r.targets.map(b=>piece(b,'',true,n)).join('')+r.team.map(d=>battleAnimal(d.species,d.id,0,0,n)).join('');
 const landings=shorePositions(n).map(([x,y],i)=>'<button class="landing" data-shore="'+i+'" aria-label="Высадка '+(i+1)+'" style="'+screenStyle(x,y,n)+'">⚑ '+(i+1)+'</button>').join('');
 return '<section class="map battle" aria-label="Поле боя"><div class="world-window" tabindex="0" aria-label="Карта боя"><div class="map-world">'+boardSvg(null,null,null,n)+objects+landings+'<canvas class="fx" width="1000" height="960"></canvas></div></div><div class="hero"><small class="map-info">Набег · <b id="clock"></b></small><h1 class="hero-title">'+esc(r.name)+'</h1></div>'+cameraControls+'</section>';
}
let previousBattle, currentBattle, battleKey;
export function paintBattle(r,now,selected){
 const n=r.boardSize??legacyRaidSize;
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
  const p=project(x,y,n);el.style.left=p.x/10+'%';el.style.top=p.y/9.6+'%';el.classList.toggle('chosen',o.id===selected||o.id===sel?.target);
  el.classList.toggle('dead',o.hp<=0);el.classList.toggle('damaged',o.hp>0&&o.hp<o.max*.55);const meter=el.querySelector('.meter i');if(meter)meter.style.width=Math.max(0,100*o.hp/o.max)+'%';
  if(o.species){const hitting=sim.flashes.some(f=>f.from===o.id),hit=sim.flashes.some(f=>f.to===o.id);const prev=previousBattle?.units.find(u=>u.id===o.id)||previousBattle?.targets.find(t=>t.id===o.id);
    const moving=prev&&Math.hypot(o.x-prev.x,o.y-prev.y)>.01;
    animateActor(el.querySelector('.actor'),sim.end?'finish':hit?'hit':hitting?'attack':moving?'walk':'idle',performance.now());}
 }
 const cv=document.querySelector('.fx'),c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
 const px=o=>project(o.x,o.y,n).x,py=o=>project(o.x,o.y,n).y-14;
 for(const t of sim.targets.filter(t=>t.hp>0&&Object.hasOwn(defenses,t.kind))){const v=defenseStats(t.kind,t.level),[rx,ry]=rangeRadii(v.range,n);c.beginPath();c.ellipse(px(t),py(t)+14,rx,ry,0,0,7);c.strokeStyle=defenses[t.kind].color+'ac';c.lineWidth=2;c.setLineDash([7,10]);c.stroke();}c.setLineDash([]);
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
export function idle(time){for(const el of document.querySelectorAll('.resident .actor,.plate .actor'))animateActor(el,el.dataset.pose||'idle',time);}

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
