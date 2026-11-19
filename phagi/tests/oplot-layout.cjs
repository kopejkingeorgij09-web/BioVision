const assert=require('node:assert/strict');
const layout=require('../oplot-layout.js');
const shapes={keep:5,goldstore:4,foodstore:4,den:4,academy:4,archer:3,cannon:3,home:3,farm:3,mine:3,spire:2,wall:1,icetrap:1,firetrap:1};
const building=(id,type,x,y)=>({id,type,x,y,level:2,since:1750000000000});
const grid={width:35,height:35};
for(const [type,side] of Object.entries(shapes)){
 const b=building('one',type,35-side,35-side);
 assert.equal(layout.size(type),side);assert.equal(layout.cells(b).length,side*side);
 assert.deepEqual(layout.center(b),{x:35-side+(side-1)/2,y:35-side+(side-1)/2});
 for(const {x,y} of layout.cells(b)){
  assert.equal(layout.at([b],x,y),b);
  assert.equal(layout.fits([b],'wall',x,y,grid),false);
 }
 assert.ok(layout.fits([b],type,b.x,b.y,grid,b.id));
 assert.ok(!layout.fits([],type,b.x+1,b.y,grid));
 assert.ok(!layout.fits([],type,b.x,b.y+1,grid));
}
assert.deepEqual(layout.gridAtLevel(1),{width:33,height:33});
const oldEdge=[building('keep','keep',14,14),building('edge','farm',1,32)];
assert.deepEqual(layout.gridAtLevel(1,2,oldEdge),{width:33,height:35});
assert.ok(layout.valid(oldEdge,layout.gridAtLevel(1,2,oldEdge)));
const moved=oldEdge.map(b=>b.type==='farm'?{...b,y:30}:b);
assert.deepEqual(layout.gridAtLevel(1,2,moved),{width:33,height:33});
const outside=[oldEdge[0],{...oldEdge[1],y:33}];
assert.equal(layout.valid(outside,layout.gridAtLevel(1,2,outside)),false);
assert.deepEqual(layout.gridAtLevel(2),{width:36,height:33});
assert.deepEqual(layout.gridAtLevel(13),{width:53,height:53});
assert.deepEqual([1,3,5,7,9,11,13].map(level=>layout.gridAtLevel(level).width),[33,36,40,43,46,50,53]);
assert.deepEqual(layout.gridAtLevel(21),layout.gridAtLevel(13));
assert.deepEqual(layout.gridAtLevel(2,1),{width:11,height:10});
const old={
 version:1,gold:449,berries:298,buildings:[building('homebase','keep',4,4),
  building('w1','wall',1,0),building('w2','wall',1,1),building('w3','wall',2,1),building('berries','farm',8,8)],
 dragons:[{id:'a',level:4,species:5,enchant:2}],book:[1,5],egg:{id:'egg',end:1750000001500},
 deliveries:['receipt-a'],pending:{item:'berries',op:'buy-a'},lastRaid:{day:'2026-11-17'},quest:1,campaign:{1:2}
};
const original=structuredClone(old),newState=layout.migrate(old);
assert.deepEqual(old,original);assert.equal(newState.layoutVersion,2);
assert.equal(newState.xp,30+5*12+35+50);
const b=newState.buildings;
assert.deepEqual(b[0],{...old.buildings[0],x:15,y:15});
assert.deepEqual(b[4],{...old.buildings[4],x:31,y:31});
assert.equal(b[2].x,b[1].x);assert.equal(b[2].y,b[1].y+1);
assert.equal(b[3].x,b[2].x+1);assert.equal(b[3].y,b[2].y);
for(const key of ['gold','berries','dragons','book','egg','deliveries','pending','lastRaid','quest','campaign'])assert.deepEqual(newState[key],old[key]);
assert.equal(layout.migrate(newState),newState);
const reorder=layout.migrate({...old,buildings:[...old.buildings].reverse()});
assert.deepEqual([...reorder.buildings].reverse(),newState.buildings);
const makeIsland=(farms,stores)=>({...old,xp:0,buildings:['keep',...Array(stores).fill('goldstore'),...Array(farms).fill('farm')]
 .map((type,i)=>building('building-'+i,type,i%10,Math.floor(i/10)))});
const compact=layout.migrate(makeIsland(23,8));
assert.ok(layout.valid(compact.buildings,grid));assert.ok(compact.buildings.every(x=>!x.stowed));
const crowded=makeIsland(31,68),saturated=layout.migrate(crowded);
assert.ok(saturated.buildings.some(x=>x.stowed));assert.ok(layout.valid(saturated.buildings,grid));
assert.deepEqual(layout.migrate(crowded),saturated);
for(const [i,b] of saturated.buildings.entries()){
 const old=crowded.buildings[i];assert.equal(b.id,old.id);assert.equal(b.since,old.since);assert.equal(b.level,old.level);
 if(b.stowed){assert.equal(b.x,null);assert.equal(b.y,null);if(b.type==='farm')assert.equal(b.pausedStock,180)}
}
const inventory=building('spare','farm',null,null);inventory.stowed=true;inventory.pausedStock=15;
assert.equal(layout.at([inventory],0,0),null);assert.equal(layout.center(inventory),null);assert.deepEqual(layout.cells(inventory),[]);
assert.ok(layout.valid([b[0],inventory],grid));
assert.ok(!layout.valid([{...b[0],stowed:true,x:null,y:null}],grid));
assert.ok(!layout.valid([b[0],{...inventory,pausedStock:181}],grid));
assert.ok(!layout.valid([b[0],building('overlap','spire',19,19)],grid));
assert.ok(!layout.valid([b[0],building('edge','spire',34,34)],grid));
assert.ok(!layout.valid([b[0],{...inventory,x:0}],grid));
assert.ok(!layout.valid([b[0],building('malformed',['mine'],1,1)],grid));
assert.ok(!layout.valid([b[0]],null));
const split=layout.migrate({...old,xp:35*12**2,buildings:[
 building('keep','keep',9,9),building('left','home',0,9),building('right','mine',10,9),building('corner','wall',15,15)
]});
assert.deepEqual(split.buildings.map(b=>[b.x,b.y]),[[30,30],[0,31],[35,31],[53,53]]);
assert.ok(layout.valid(split.buildings,layout.gridAtLevel(13,2,split.buildings)));
// Fully occupy all 256 legacy tiles using the economic and tower limits of a
// level-eight keep, rotate the ordering through the grid, and fill with walls.
const developed=['keep','den','academy',
 ...['farm','mine','home','archer','cannon','spire','goldstore','foodstore'].flatMap(type=>Array(9).fill(type)),
 ...['icetrap','firetrap'].flatMap(type=>Array(17).fill(type))];
while(developed.length<256)developed.push('wall');
const fullProduction=developed.map((type,i)=>{
 const tile=i*17%256;return building('veteran-'+i,type,tile%16,Math.floor(tile/16));
});
const migratedTown=layout.migrate({...old,xp:35*12**2,buildings:fullProduction});
assert.ok(layout.valid(migratedTown.buildings,layout.gridAtLevel(13,2,migratedTown.buildings)));
assert.ok(migratedTown.buildings.every(b=>!b.stowed),'A fully developed legacy town fits on the expanded field');
assert.deepEqual(migratedTown.buildings.map(b=>b.id),fullProduction.map(b=>b.id));
console.log('PASS footprints, grid progression, wall connectivity, deterministic packed legacy islands, inventory, paused production, retained histories and clocks');
