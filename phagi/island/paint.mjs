import {byId,colors} from './catalog.mjs';
import {position,shores,replay} from './battle.mjs';
import {buildings,capacity} from './game.mjs';
const cache=new Map(), sketches=new Map();
export const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escape;
function image(src){if(!cache.has(src)){const im=new Image();im.src='art/'+src+'.webp';cache.set(src,im);}return cache.get(src);}
function sketch(s){
  if(sketches.has(s.id))return sketches.get(s.id);
  const cv=document.createElement('canvas');cv.width=300;cv.height=165;const c=cv.getContext('2d');
  const n=s.index, morph=n%7, back=71+(n%6)*3, head=34+(morph%4)*12, ink='#34493e',fill=colors[s.types[0]];
  function line(points,color,width,closed=false){c.lineJoin='round';c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(closed){c.closePath();c.fillStyle=color;c.fill();c.lineWidth=2;c.strokeStyle=ink;}else{c.lineWidth=width;c.strokeStyle=color;}c.stroke();}
  line([[132,back+19],[102,back+16],[70,back+22],[39,back+13],[20,back-12+morph*3]],ink,11);
  line([[132,back+18],[100,back+15],[64,back+20],[36,back+10],[20,back-12+morph*3]],fill,7);
  for(const [x,y] of [[118,back+10],[157,back+12],[128,back+18],[178,back+12]]){const len=18+morph*2;line([[x,y],[x-7,y+len],[x+2,y+len+12],[x+13,y+len+12]],ink,7);}
  c.beginPath();c.ellipse(148,back+8,38+(n%4)*5,14+morph*1.5,-.08,0,Math.PI*2);c.fillStyle=fill;c.fill();c.lineWidth=2;c.strokeStyle=ink;c.stroke();
  const accent=colors[s.types[1]??(s.types[0]+2)%10];
  if(morph<4)line([[157,back],[140,back-40],[83+morph*7,14+morph*4],[95,back-9],[118,back-17],[138,back+2]],accent,1,true);
  else for(let i=0;i<3+morph;i++)line([[105+i*9,back-3],[102+i*9,back-14-(i%3)*6],[113+i*9,back-3]],accent,2,true);
  line([[170,back+17],[180,back-11],[193,head],[210,head-4],[225,head+4],[242,head+8],[237,head+16],[211,head+18],[197,head+18],[187,back+16]],fill,1,true);
  for(let i=0;i<1+n%4;i++) line([[202+i*4,head],[190+i*4,head-12-(n+i)%12],[209+i*4,head-2]],accent,1,true);
  c.fillStyle=ink;c.beginPath();c.arc(216,head+4,2.8,0,Math.PI*2);c.fill();sketches.set(s.id,cv);return cv;
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
export function dragon(cv,id,pose='idle',time=performance.now()){
  const s=byId[id];if(!cv||!s)return;
  const ctx=cv.getContext('2d'),w=cv.width,h=cv.height;ctx.clearRect(0,0,w,h);
  if(s.art==='study'){const p=sketch(s);ctx.drawImage(p,0,0,w,h);return;}
  const sheet=image(s.art+'-'+pose);if(!sheet.complete||!sheet.naturalWidth)return;
  const sw=sheet.naturalWidth/12,sh=sheet.naturalHeight,scale=Math.min(w/sw,h/sh);
  const frame=reduced.matches?0:Math.floor(time/(pose==='attack'?52:100))%12;
  ctx.drawImage(sheet,frame*sw,0,sw,sh,(w-sw*scale)/2,(h-sh*scale)/2,sw*scale,sh*scale);
}
export function art(s,cls='thumb'){return s.art==='study'?'<canvas class="'+cls+'" width="300" height="160" data-drawing="'+s.id+'"></canvas>':'<img loading="lazy" class="'+cls+'" style="object-fit:contain" alt="'+esc(s.name)+'" src="art/'+s.art+'-portrait.webp">';}
const mapX=x=>5+.9*x, mapY=y=>25+y*.56;
const point=(x,y)=>'left:'+mapX(x)+'%;top:'+mapY(y)+'%';
function piece(b,chosen,battle){
  const pos='x' in b?b:position(b), kind=b.kind;const hp=battle?100:capacity(b)?Math.min(100,100*(b.stock||0)/capacity(b)):0;
  if(kind==='guard')return animal(b.species,b.id,pos.x,pos.y,true);
  return '<button class="piece '+kind+(chosen===b.id?' chosen':'')+'" style="'+point(pos.x,pos.y)+';z-index:'+Math.round(2+pos.y/30)+'" data-'+(battle?'mark':'building')+'="'+esc(b.id)+'" aria-label="'+buildings[kind]+'"><img src="art/'+kind+'.webp" alt="">'+(battle||['gold','food'].includes(kind)?'<span class="meter"><i style="width:'+hp+'%"></i></span>':'')+(b.finish?'<span class="tag">⌛</span>':'')+'</button>';
}
function animal(sid,id,x,y,battle){return '<button class="animal" style="'+point(x,y)+'" data-'+(battle?'unit':'dragon')+'="'+esc(id)+'" aria-label="'+esc(byId[sid].name)+'"><canvas class="dragon-canvas" width="250" height="155" data-sprite="'+sid+'"></canvas>'+(battle?'<span class="meter"><i></i></span>':'')+'</button>';}
export function islandMap(s,chosen){
 return '<section class="map" aria-label="Карта острова"><div class="hero"><small class="eyebrow">Остров драконов</small><h1 class="hero-title">Янтарный берег</h1></div>'+s.buildings.map(b=>piece(b,chosen,false)).join('')+s.dragons.slice(0,3).map((d,i)=>animal(d.species,d.id,[21,52,76][i],[44,52,40][i],false)).join('')+s.eggs.map(e=>{const b=s.buildings.find(b=>b.id===e.building),p=position(b);return '<img alt="Яйцо" style="position:absolute;pointer-events:none;width:6%;z-index:8;transform:translate(-50%,-120%);'+point(p.x,p.y)+'" src="art/egg.webp">';}).join('')+'<span class="caption">'+s.dragons.length+' · '+(s.dragons.length===1?'дракон':'на острове')+'</span></section>';
}
export function battleView(r){return '<section class="map battle" aria-label="Поле боя"><div class="hero"><small class="eyebrow">Набег · <b id="clock"></b></small><h1 class="hero-title">'+esc(r.name)+'</h1></div>'+r.targets.map(b=>piece(b,'',true)).join('')+r.team.map(d=>animal(d.species,d.id,50,98,true)).join('')+shores.map(([x,y],i)=>'<button class="landing" data-shore="'+i+'" aria-label="Высадка '+(i+1)+'" style="'+point(x,y)+'">⚑ '+(i+1)+'</button>').join('')+'<canvas class="fx" width="600" height="660"></canvas></section>';}
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
  el.style.left=mapX(x)+'%';el.style.top=mapY(y)+'%';el.classList.toggle('chosen',o.id===selected||o.id===sel?.target);
  el.classList.toggle('dead',o.hp<=0);const meter=el.querySelector('.meter i');if(meter)meter.style.width=Math.max(0,100*o.hp/o.max)+'%';
  if(o.species){const hitting=sim.flashes.some(f=>f.from===o.id),hit=sim.flashes.some(f=>f.to===o.id);dragon(el.querySelector('canvas'),o.species,sim.end?'finish':hit?'hit':hitting?'attack':'walk',now);}
 }
 const cv=document.querySelector('.fx'),c=cv.getContext('2d');c.clearRect(0,0,cv.width,cv.height);
 const px=o=>mapX(o.x)*6,py=o=>mapY(o.y)*6.6-26;
 for(const t of sim.targets.filter(t=>t.hp>0&&['tower','ice'].includes(t.kind))){c.beginPath();c.ellipse(px(t),py(t)+15,t.kind==='tower'?185:153,t.kind==='tower'?114:96,0,0,7);c.strokeStyle='#ffe99878';c.lineWidth=2;c.setLineDash([6,9]);c.stroke();}c.setLineDash([]);
 for(const f of sim.flashes){const a=nodes.get(f.from),b=nodes.get(f.to);if(!a||!b)continue;
   const x=px(a),y=py(a),tx=px(b),ty=py(b);c.strokeStyle=colors[f.type];c.fillStyle=colors[f.type];c.lineWidth=f.skill?7:4;c.beginPath();c.moveTo(x,y);
   const k=f.type%5;if(k===0||k===4){c.quadraticCurveTo((x+tx)/2,(y+ty)/2-17-k*3,tx,ty);}else if(k===1){c.bezierCurveTo(x+25,y-24,tx-25,ty+24,tx,ty);}else{c.lineTo((x+tx)/2,(y+ty)/2+(k===2?12:-12));c.lineTo(tx,ty);}c.stroke();c.beginPath();c.arc(tx,ty,6+f.type%4,0,7);c.fill();
 }
 const cd=document.querySelector('#ability');if(cd){const seconds=Math.ceil(((sel?.skillAt||0)-sim.tick)/4);cd.disabled=!sel?.landed||sel.hp<=0||seconds>0||!!sim.end;cd.textContent=seconds>0?'Откат · '+seconds+' с':'Применить способность';}
 return sim;
}
export function drawings(){document.querySelectorAll('[data-drawing]').forEach(cv=>dragon(cv,cv.dataset.drawing));}
export function idle(time){document.querySelectorAll('.map:not(.battle) [data-sprite]').forEach((cv,i)=>{
 const el=cv.parentElement,t=time/1700+i*1.8;el.style.translate=reduced.matches?'none':Math.sin(t)*6+'px '+Math.cos(t)*1.5+'px';
 dragon(cv,cv.dataset.sprite,Math.sin(t*.45)>.75?'idle':'walk',time+230*i);});}
