// node tools/check-dragon-island.mjs [--paths] — no build and no external dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {species,byId,distribution,draw,percentages,stats,starPrices,foodPrice} from '../phagi/island/catalog.mjs';
import {newIsland,npcWorld,apply,total,available,earned,objectives,capacity,refresh} from '../phagi/island/game.mjs';
import {replay} from '../phagi/island/battle.mjs';
const adult=(s,level=1)=>({species:s.id,level,stars:0});
assert.deepEqual([1,2,3,4].map(n=>species.filter(s=>s.rarity===n).length),[10,40,35,15]);
assert.equal(new Set(species.map(s=>s.id)).size,100);
for(const s of species){assert.equal(new Set(s.types).size,s.rarity);for(const type of s.types)assert.ok(type>=0&&type<10);}
for(const rarity of [1,2,3,4])assert.equal(new Set(species.filter(s=>s.rarity===rarity).flatMap(s=>s.types)).size,10);
const paths=new Map([['s1','старт'],['s3','старт']]);
for(const s of species.filter(s=>s.rarity===1&&!paths.has(s.id)))paths.set(s.id,'экспедиция за золото с фермы и шахты');
for(let n=0;n!==paths.size;){n=paths.size;const known=[...paths.keys()].map(id=>adult(byId[id]));
 for(const a of known)for(const b of known)for(const r of distribution(a,b))if(r.p>0&&!paths.has(r.id))paths.set(r.id,[a.species,b.species].join(' × '));}
assert.equal(paths.size,100);if(process.argv.includes('--paths'))for(const [id,path] of paths)console.log(id,byId[id].name,path);
let pairs=0;
for(let i=0;i<100;i++)for(const s of species.slice(i)){
 for(const [la,lb] of [[1,1],[1,30],[15,17],[30,30]]){
  const a=adult(species[i],la),b=adult(s,lb),rows=distribution(a,b);assert.deepEqual(rows,distribution(b,a));
  assert.ok(Math.abs(rows.reduce((sum,r)=>sum+r.p,0)-1)<1e-10);
  const shown=percentages(rows);assert.equal(shown.reduce((sum,v)=>sum+Math.round(v*1000),0),100000);
  let lower=0;rows.forEach((r,j)=>{assert.ok(r.p>0&&shown[j]>0);assert.ok(Math.abs(shown[j]-100*r.p)<.00101);assert.equal(draw(rows,()=>lower+r.p/2),r.id);lower+=r.p;});
 }pairs++;
}
for(const [level,expected] of [[1,.01],[30,.03]])assert.equal(distribution(adult(byId.s01,level),adult(byId.s3,level)).find(r=>r.id==='s013').p,expected);
assert.equal(distribution(adult(byId.s0),adult(byId.s0))[0].p,1);
assert.deepEqual([0,19,20,21,22,23,24,40].map(earned),[0,0,10,10,11,11,12,20]);
assert.deepEqual(stats({species:'s3',level:10,stars:1}),stats({species:'s3',level:12,stars:0}));
const state=newIsland(0);let t=0,credit=500;
const act=(action,values={})=>apply(state,{action,...values},{now:t,credit,random:()=>.25});
const [left,right]=state.dragons;
act('feed',{dragon:left.id});assert.equal(total(state,'food'),280-foodPrice(1));assert.equal(left.level,2);
act('symbol',{objective:'feed',type:3});assert.throws(()=>act('symbol',{objective:'feed',type:3}));
act('star',{dragon:left.id,pay:[0,0,0,10,0,0,0,0,0,0]});assert.equal(state.symbols[3],0);
assert.deepEqual(starPrices,[10,20,35,55,80]);left.species='s13';state.symbols[1]=8;state.symbols[3]=12;
act('star',{dragon:left.id,pay:[0,8,0,12,0,0,0,0,0,0]});assert.equal(left.stars,2);
act('guard',{dragon:left.id});assert.throws(()=>act('breed',{dragon:left.id,other:right.id,building:'nest'}));act('guard',{dragon:left.id});
act('breed',{dragon:left.id,other:right.id,building:'nest'});const egg=state.eggs[0],fixed=egg.species;assert.ok(!available(state,left,t));assert.throws(()=>act('incubate',{egg:egg.id,building:'incubator'}));
t=egg.end-1;act('speed',{egg:egg.id,max:1});assert.equal(state.spent,1);act('speed',{egg:egg.id,max:0});assert.equal(state.spent,1);assert.equal(fixed,egg.species);
act('incubate',{egg:egg.id,building:'incubator'});act('breed',{dragon:left.id,other:right.id,building:'nest'});const egg2=state.eggs[1];t=egg2.end;assert.throws(()=>act('incubate',{egg:egg2.id,building:'incubator'}));
act('slot',{building:'incubator'});act('incubate',{egg:egg2.id,building:'incubator'});act('build',{kind:'nest',col:2,row:2});act('build',{kind:'incubator',col:2,row:3});assert.equal(state.spent,211);
t=egg2.end;act('hatch',{egg:egg.id,building:'home'});assert.throws(()=>act('hatch',{egg:egg.id,building:'home'}));act('hatch',{egg:egg2.id,building:'home'});
act('breed',{dragon:left.id,other:right.id,building:'nest'});const egg3=state.eggs[0];t=egg3.end;act('incubate',{egg:egg3.id,building:'incubator'});t=egg3.end;assert.throws(()=>act('hatch',{egg:egg3.id,building:'home'}));act('upgrade',{building:'home'});t+=60000;refresh(state,t);act('hatch',{egg:egg3.id,building:'home'});assert.equal(state.dragons.length,5);
const peer=npcWorld('reef',t);assert.throws(()=>apply(state,{action:'raid',team:state.dragons.slice(0,4).map(d=>d.id)},{now:t,defender:peer,target:'npc:reef'}));
for(const s of species){
 const suffixes=s.art===s.id?['portrait','motion']:['portrait','idle','walk','attack','hit','finish'];
 for(const suffix of suffixes){
  const name=s.art+'-'+suffix+'.webp';
  const asset=fs.readFileSync(new URL('../phagi/island/art/'+name,import.meta.url));
  assert.ok(asset.length>1000&&asset.toString('ascii',8,12)==='WEBP',name);
 }
}
assert.equal(new Set(species.map(s=>s.art)).size,100);
for(const targets of [[],['gold'],['food'],['food','gold']]){
 const attack=newIsland(0,'А'),defend=newIsland(0,'Б');defend.shield=0;
 for(const s of [attack,defend])for(const b of s.buildings.filter(b=>['gold','food'].includes(b.kind))){b.level=b.kind==='gold'?10:5;b.stock=s===attack?0:capacity(b);}
 attack.dragons[0].level=30;attack.dragons[0].stars=5;const u=attack.dragons[0].id;
 const ctx={now:0,defender:defend,target:'Б',uid:'А'};const issue=(a,v={})=>apply(attack,{action:a,...v},ctx);
 issue('raid',{team:[u]});const raid=attack.raid.id;issue('order',{order:'land',raid,unit:u,shore:1});
 for(const b of targets){
  issue('order',{order:'target',raid,unit:u,mark:b});
  while(replay(attack.raid,ctx.now).targets.find(t=>t.id===b).hp>0&&ctx.now<85000)ctx.now+=250;
 }
 const inputs=['gold','food'].map(k=>total(defend,k));const report=issue('finish',{raid});
 for(const [i,k] of ['gold','food'].entries()){assert.equal(report.loot[k],targets.includes(k)?inputs[i]*.8:0,JSON.stringify({targets,report,t:ctx.now}));assert.equal(inputs[i]-total(defend,k),total(attack,k));}
 assert.equal(defend.reports[0].id,report.id);
}
console.log('100 reachable · '+pairs+' pairs × 4 level combinations · exact draw/preview, eggs, housing, symbols, assets and four raid outcomes passed');
