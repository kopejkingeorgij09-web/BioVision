import assert from 'node:assert/strict';
import fs from 'node:fs';
import {species} from '../phagi/island/catalog.mjs';
import {faceMatrix,poseBones,prepareRig,skinVertices} from '../phagi/island/skeleton.mjs';
import {newIsland,refresh,apply,npcWorld} from '../phagi/island/game.mjs';
import {replay} from '../phagi/island/battle.mjs';

const root=new URL('../phagi/island/art/dragons/',import.meta.url);
const move=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
let poses=0,lowest=Infinity,longestFootDrift=0;
for(const id of [...species.map(s=>s.id),'baby']){
 const read=f=>fs.readFileSync(new URL(f,root),'utf8');
 const svg=read(id+'.svg'),types=id==='baby'?'3':id.slice(1);
 for(const picture of [svg,read('thumbs/'+id+'.svg')]){
  assert.ok(picture.includes('data-elements="'+types+'"'),id+' has wrong elemental art');
  if(types.length>1)assert.deepEqual(Array.from(picture.matchAll(/data-material="(\d)"/g),m=>m[1]),[...types],id+' lacks a material');
 }
 assert.match(svg,/<path /);assert.doesNotMatch(svg,/<image\b|data:image|<canvas|\.png|\.webp/);assert.match(read('thumbs/'+id+'.svg'),/<path /);
 const r=prepareRig(JSON.parse(read('rigs/'+id+'.json')));
 assert.equal(r.id,id);assert.ok(r.faces.length>35);
 for(const [i,b] of r.bones.entries()){assert.ok(b.parent<i&&b.length>0,id+' '+b.name);}
 for(const p of ['idle','walk','attack','hit','finish']){
  let changed=false;
  for(let j=0;j<36;j++){
   const mats=poseBones(r,p,j*.125);const points=skinVertices(r,mats);
   for(const [i,b] of r.bones.entries()){
    const start=move(mats[i],b.a),end=move(mats[i],b.b);
    assert.ok(Math.abs(dist(start,end)-b.length)<.0002,id+' lost bone length');
    if(b.parent>=0)assert.ok(dist(start,move(mats[b.parent],b.a))<.005,id+' disconnected '+b.name);
    if(b.name.endsWith('Foot')&&p==='idle')longestFootDrift=Math.max(longestFootDrift,dist(end,b.b)/r.width);
   }
   for(const f of r.faces){
    const [a,b,c,d]=faceMatrix(f,points),det=a*d-b*c;
    assert.ok(Number.isFinite(det)&&det>=.19,id+' '+p+' inverted joint');lowest=Math.min(lowest,det);
   }
   changed ||= points.some((point,i)=>dist(point,r.points[i])>.05);
  }
  assert.ok(changed,id+' '+p+' missing animation');poses++;
 }
}
assert.ok(longestFootDrift<.012,'idle foot drift');
const original=newIsland(0);
original.v=1;original.buildings=original.buildings.filter(b=>b.id!=='water-home');original.dragons[1].home='home';
const layout=structuredClone(original.buildings);
refresh(original,30);assert.equal(original.v,2);assert.equal(original.dragons[1].home,'water-home');assert.deepEqual(original.buildings.slice(0,layout.length),layout);
const once=structuredClone(original);refresh(original,31);assert.deepEqual(original,once);
const ctx={now:100,credit:0};
apply(original,{action:'move',building:'water-home',col:9,row:9},ctx);assert.equal(original.dragons[1].home,'water-home');
const ancient={id:'old',start:0,team:[original.dragons[0]],targets:[{id:'x',kind:'gold',level:1,x:50,y:97}],commands:[{tick:0,action:'land',unit:original.dragons[0].id,shore:1}]};
assert.equal(replay(ancient,0).units[0].y,98);
const peer=npcWorld('reef',0);apply(original,{action:'raid',team:[original.dragons[0].id]},{...ctx,target:'npc:reef',defender:peer});
assert.equal(original.raid.boardSize,10);
console.log(poses+' animated cycles; joint continuity, rigid lengths, planted feet, mesh orientation, v1 island and raid compatibility passed. Minimum area ratio '+lowest.toFixed(3)+', max resting foot drift '+(100*longestFootDrift).toFixed(3)+'% of body length.');
