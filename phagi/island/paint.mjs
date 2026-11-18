import {structureArt,structureName} from './ui.mjs';
import {islandLevel,xpFor} from './progression.mjs';
import {byId,colors} from './catalog.mjs';
import {replay} from './battle.mjs';
import {boardSize,position,shorePositions,legacyRaidSize} from './world.mjs';
import {actorMarkup,animateActor,dragonAsset} from './actors.mjs';
import {cameraControls} from './camera.mjs';
import {buildings,capacity} from './game.mjs';
import {project,screenStyle,boardSvg,rangeRadii} from './board.mjs';
import {defenses,defenseStats} from './defenses.mjs';
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escape;
export function art(s,cls='thumb'){return '<img loading="lazy" class="'+cls+'" alt="'+esc(s.name)+'" src="'+dragonAsset('thumbs/'+s.id+'.svg')+'">';}
function piece(b,chosen,battle,size=boardSize){
 const pos='x' in b?b:position(b),kind=b.kind;
 if(kind==='guard')return battleAnimal(b.species,b.id,pos.x,pos.y,size);
 const hp=battle?100:capacity(b)?Math.min(100,100*(b.stock||0)/capacity(b)):0;
 return '<button class="piece '+kind+(chosen===b.id?' chosen':'')+'" style="'+screenStyle(pos.x,pos.y,size)+';z-index:'+Math.round(2+(pos.x+pos.y)/22)+'" data-'+(battle?'mark':'building')+'="'+esc(b.id)+'" aria-label="'+structureName(b,buildings)+'"><img draggable="false" src="'+structureArt(b)+'" alt="">'+(battle||['gold','food'].includes(kind)?'<span class="meter"><i style="width:'+hp+'%"></i></span>':'')+(b.finish?'<span class="tag">⌛</span>':'')+'</button>';
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
 const dragons=residents(s);
 const eggs=s.eggs.map(e=>{const b=s.buildings.find(b=>b.id===e.building),p=position(b);return '<img class="nest-egg" data-egg="'+esc(e.id)+'" alt="Яйцо" style="'+screenStyle(p.x,p.y)+'" src="art/egg.webp">';}).join('');
 const ghost=preview?'<img class="plot-preview" alt="Предпросмотр постройки" src="'+structureArt(preview)+'" style="'+screenStyle(position(preview).x,position(preview).y)+'">':'';
 return '<section class="map settlement'+(edit?' editing':'')+'" aria-label="Карта острова"><div class="world-window" tabindex="0" aria-label="Карта. Стрелки перемещают обзор, плюс и минус меняют масштаб"><div class="map-world">'+boardSvg(s,edit,ring)+objects+dragons+eggs+ghost+'</div></div><div class="hero"><h1 class="hero-title">Янтарный берег</h1><small class="map-info">'+(edit?'Расстановка':'Уровень острова '+islandLevel(s.xp)+' · '+s.xp+'/'+xpFor(islandLevel(s.xp)+1)+' опыта · 10 × 10 клеток')+'</small></div>'+cameraControls+'</section>';
}
export function battleView(r){
 const n=r.boardSize??legacyRaidSize;
 const objects=r.targets.map(b=>piece(b,'',true,n)).join('')+r.team.map(d=>battleAnimal(d.species,d.id,0,0,n)).join('');
 const landings=shorePositions(n).map(([x,y],i)=>'<button class="landing" data-shore="'+i+'" aria-label="Высадка '+(i+1)+'" style="'+screenStyle(x,y,n)+'">⚑ '+(i+1)+'</button>').join('');
 return '<section class="map battle" aria-label="Поле боя"><div class="world-window" tabindex="0" aria-label="Карта боя"><div class="map-world">'+boardSvg(null,null,null,n)+objects+landings+'<svg class="fx" viewBox="0 0 1000 960" aria-hidden="true"></svg></div></div><div class="hero"><small class="map-info">Набег · <b id="clock"></b></small><h1 class="hero-title">'+esc(r.name)+'</h1></div>'+cameraControls+'</section>';
}
let previousBattle,currentBattle,battleKey,field,targetsById,lastEffectsTick;
function fieldNodes(world){
 if(field!==world){
  field=world;targetsById=new Map();
  for(const el of world.querySelectorAll('[data-unit],[data-mark]')){
   targetsById.set(el.dataset.unit||el.dataset.mark,{el,meter:el.querySelector('.meter i'),actor:el.querySelector('.actor')});
  }
  lastEffectsTick=null;
 }
 return targetsById;
}
export function paintBattle(r,now,selected){
 const n=r.boardSize??legacyRaidSize;
 const key=r.id+'-'+r.commands.length+'-'+Math.floor((now-r.start)/250);
 if(key!==battleKey){previousBattle=battleKey?.startsWith(r.id)?currentBattle:null;currentBattle=replay(r,now);battleKey=key;}
 const sim=currentBattle, fraction=Math.min(1,Math.max(0,((now-r.start)%250)/250)),nodes=new Map([...sim.targets,...sim.units].map(o=>[o.id,o]));
 const clock=document.querySelector('#clock');if(!clock)return;const displayTime=Math.max(0,90-Math.floor((now-r.start)/1000))+' с';if(clock.textContent!==displayTime)clock.textContent=displayTime;
 const elements=fieldNodes(clock.closest('.map').querySelector('.map-world'));
 const sel=sim.units.find(u=>u.id===selected);
 document.querySelectorAll('[data-shore]').forEach(el=>el.hidden=sel?.landed||!!sim.end);
 for(const o of nodes.values()){
  const part=elements.get(o.id);if(!part)continue;
  const {el,meter,actor}=part,unit=sim.units.includes(o),hidden=unit&&!o.landed;
  if(el.hidden!==hidden)el.hidden=hidden;if(hidden)continue;
  if(o.species){
   const prior=unit?previousBattle?.units.find(d=>d.id===o.id):previousBattle?.targets.find(d=>d.id===o.id);
   const interpolate=prior&&(!unit||prior.landed);
   const p=project(interpolate?prior.x+(o.x-prior.x)*fraction:o.x,interpolate?prior.y+(o.y-prior.y)*fraction:o.y,n);
   if(el.style.left!=='0px'){el.style.left='0px';el.style.top='0px';}
   el.style.translate='calc('+p.x.toFixed(2)+' * var(--map-unit)) calc('+p.y.toFixed(2)+' * var(--map-unit))';
  }
  el.classList.toggle('chosen',o.id===selected||o.id===sel?.target);
  el.classList.toggle('dead',o.hp<=0);el.classList.toggle('damaged',o.hp>0&&o.hp<o.max*.55);
  const hp=Math.max(0,100*o.hp/o.max)+'%';if(meter&&meter.style.width!==hp)meter.style.width=hp;
  if(actor){const hitting=sim.flashes.some(f=>f.from===o.id),hit=sim.flashes.some(f=>f.to===o.id);const prev=previousBattle?.units.find(u=>u.id===o.id)||previousBattle?.targets.find(t=>t.id===o.id);
    const moving=prev&&Math.hypot(o.x-prev.x,o.y-prev.y)>.01;
    animateActor(actor,sim.end?'finish':hit?'hit':hitting?'attack':moving?'walk':'idle',performance.now());}
 }
 if(lastEffectsTick!==key){lastEffectsTick=key;drawEffects(sim,n,nodes,field.querySelector('.fx'));}
 const targetInfo=document.querySelector('#target-info'),mark=nodes.get(sel?.target);
 if(targetInfo){const value=sel?.landed&&mark?'Цель · '+(structureName(mark,buildings)||byId[mark.species]?.name||'Защитник')+' · '+Math.ceil(mark.hp)+' / '+Math.ceil(mark.max):'Ожидает высадки';
 if(targetInfo.textContent!==value)targetInfo.textContent=value;}
 const cd=document.querySelector('#ability');if(cd){const seconds=Math.ceil(((sel?.skillAt||0)-sim.tick)/4);cd.disabled=!sel?.landed||sel.hp<=0||seconds>0||!!sim.end;const title=seconds>0?'Откат · '+seconds+' с':'Применить способность';if(cd.textContent!==title)cd.textContent=title;}
 return sim;
}
export function idle(time){for(const el of document.querySelectorAll('.resident .actor,.plate .actor'))animateActor(el,el.dataset.pose||'idle',time);}

function elementTrail(f,from,to,age){
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
 const point=(fraction,offset=0)=>[(from.x+fraction*dx-offset*dy/length).toFixed(2),(from.y+fraction*dy+offset*dx/length).toFixed(2)].join(' ');
 const start='M'+point(0),tip=point(1),color=colors[f.type];let path='',marks='';
 switch(f.type){
  case 0:path=start+'Q'+point(.55,-25)+' '+tip;break;
  case 1:case 2:{const bend=f.type===1?20:37;path=start+'C'+point(.32,-bend)+' '+point(.65,bend)+' '+tip;break;}
  case 3:marks=[.25,.5,.75,1].map(t=>'<path d="M'+point(t)+'m-4-3h9v7h-9z"/>').join('');break;
  case 4:path=start+'L'+tip+[.2,.48,.72].map(t=>'M'+point(t)+'Q'+point(t+.07,-15)+' '+point(t+.12,-9)).join('');break;
  case 5:path=start+[[.27,0],[.38,12],[.55,-10],[.64,8],[1,0]].map(([t,k])=>'L'+point(t,k)).join('');break;
  case 6:path='M'+point(.55)+'L'+tip+'L'+point(.88,5)+'M'+tip+'L'+point(.88,-5);break;
  case 7:case 8:path=[.3,.55,.8,1].map(t=>'M'+point(t)+'m7 0a7 7 0 1 1-14 0'+(f.type===7?'a7 7 0 1 1 14 0':'a7 7 0 0 1 5-6.7')).join('');break;
  default:path=start+'L'+tip;
 }
 return '<g fill="'+color+'">'+marks+(path?'<path d="'+path+'" stroke="'+color+'" fill="none" stroke-width="'+(f.skill?7:f.type===9?6:4)+'"/>':'')+'<circle cx="'+to.x+'" cy="'+to.y+'" r="'+(5+age*2)+'"/></g>';
}

function drawEffects(sim,n,nodes,layer){
 const ranges=sim.targets.filter(t=>t.hp>0&&Object.hasOwn(defenses,t.kind)).map(t=>{
  const p=project(t.x,t.y,n),[rx,ry]=rangeRadii(defenseStats(t.kind,t.level).range,n);
  return '<ellipse cx="'+p.x+'" cy="'+p.y+'" rx="'+rx+'" ry="'+ry+'" stroke="'+defenses[t.kind].color+'" stroke-opacity=".675" stroke-width="2" stroke-dasharray="7 10" fill="none"/>';
 });
 const hits=sim.flashes.map(f=>{
  const a=nodes.get(f.from),b=nodes.get(f.to);if(!a||!b)return '';
  const from=project(a.x,a.y,n),to=project(b.x,b.y,n);from.y-=14;to.y-=14;
  return elementTrail(f,from,to,sim.tick-f.tick);
 });
 const markup=ranges.concat(hits).join('');
 if(layer._markup!==markup){layer.innerHTML=markup;layer._markup=markup;}
}
