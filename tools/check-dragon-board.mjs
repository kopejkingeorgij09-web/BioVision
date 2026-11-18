import assert from 'node:assert/strict';
import {newIsland,apply,upgrade,total,buildings,refresh,npcWorld} from '../phagi/island/game.mjs';
import {battleMap,replay,position} from '../phagi/island/battle.mjs';
import {defenses,defenseStats} from '../phagi/island/defenses.mjs';
import {project,cellName,boardSize} from '../phagi/island/board.mjs';
const ctx={now:0,credit:500};
for(const kind of Object.keys(buildings)){
 const s=newIsland(0);
 s.buildings=[{id:'test',kind,col:1,row:0,level:1,stock:0}];
 for(let row=0;row<boardSize;row++)for(let col=0;col<boardSize;col++){
  apply(s,{action:'move',building:'test',col,row},ctx);
  const b=s.buildings[0],t=battleMap(s)[0],p=position(b);assert.deepEqual([t.x,t.y],[p.x,p.y]);
  const center=project(p.x,p.y);
  for(const dx of [-53,53])for(const dy of [-.61*103.68,.39*103.68]){
   assert.ok(Math.abs(center.x+dx-500)/490+Math.abs(center.y+dy-455)/308<1,kind+' '+cellName(col,row));
  }
 }
 for(const [c,r] of [[-1,1],[1,-1],[5,4],[2,5],[.5,1],[0,'1']])assert.throws(()=>apply(s,{action:'move',building:'test',col:c,row:r},ctx));
}
const island=newIsland(0);assert.throws(()=>apply(island,{action:'move',building:'tower',col:0,row:0},ctx));
for(const id of ['reef','pine','summit']){const s=npcWorld(id,0);assert.equal(new Set(s.buildings.map(b=>cellName(b.col,b.row))).size,s.buildings.length);}
const unit=(id)=>({id,species:'s3',stars:0,level:1});
function simulate(kind,level,ticks,team=1,extra=[]){
 const target={id:'fort',kind,level,x:49,y:88,stock:0};
 const raid={start:0,targets:[target,...extra],team:Array.from({length:team},(_,i)=>unit('u'+i)),commands:Array.from({length:team},(_,i)=>({tick:0,unit:'u'+i,action:'land',shore:1}))};
 return replay(raid,ticks*250);
}
for(const [kind,props] of Object.entries(defenses)){
 const s=newIsland(0);s.buildings.find(b=>b.kind==='gold').stock=1000;
 apply(s,{action:'build',kind,col:1,row:0},ctx);const b=s.buildings.at(-1),v=defenseStats(kind,1);assert.equal(total(s,'gold'),1000-props.gold);
 apply(s,{action:'upgrade',building:b.id},ctx);assert.equal(total(s,'gold'),1000-props.gold-upgrade(b).price);refresh(s,b.finish-1);assert.equal(b.level,1);refresh(s,b.finish);assert.equal(b.level,2);assert.ok(defenseStats(kind,2).range>v.range);
}
const tower=simulate('tower',1,0,3),storm=simulate('storm',1,0,3),storm3=simulate('storm',3,0,3);
assert.equal(tower.units.filter(u=>u.hp<u.max).length,1);assert.equal(storm.units.filter(u=>u.hp<u.max).length,2);assert.equal(storm3.units.filter(u=>u.hp<u.max).length,3);
const far={id:'gold',kind:'gold',level:2,x:50,y:70,stock:0};
function protectedHit(level){
 const raid={start:0,team:[unit('u')],targets:[{...far,y:93},...(level?[{kind:'ward',id:'w',x:65,y:89,level}]:[])],commands:[{action:'land',shore:1,tick:0,unit:'u'},{action:'target',target:'gold',tick:0,unit:'u'}]};
 const t=replay(raid,0).targets[0];return t.max-t.hp;
}
assert.ok(protectedHit(0)>protectedHit(1));assert.ok(protectedHit(1)>protectedHit(6));
const move=k=>{const r={start:0,targets:[far,...(k?[{kind:'ice',id:'i',x:70,y:90,level:k}]:[])],team:[unit('u')],commands:[{action:'land',unit:'u',tick:0,shore:1},{action:'target',unit:'u',tick:0,target:'gold'}]};return 98-replay(r,500).units[0].y;};
assert.ok(move(0)>move(1)&&move(1)>move(4));
console.log('12 building types × 25 cells. All sprite corners inside shore. Four defenses, costs, timers, stronger levels, swing, chain, slow and aura passed.');
