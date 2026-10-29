const assert=require('assert');global.DRG=require('./genetics.js');const G=global.DRG,E=require('./economy.js'),S=require('./stats.js');
const real=Date.now;let now=1800000000000;Date.now=()=>now;
try{
 const g=G.make({sex:'F',E:'F/F'});let s=E.startState([{id:'d1',genome:g,lvl:6}]);s.bal.gold=10000;s.updatedAt=new Date(now).toISOString();const c={K:0,today:'2026-10-29',uid:'u',wallTime:true,inc:{dayCards:15}};
 let r=E.apply(s,c,{t:'academy',dragon:'d1'});assert(!r.err,r.err);s=r.s;assert.equal(s.bal.gold,9500);assert(s.dragons[0].training.rt);assert(E.apply(s,c,{t:'academy',dragon:'d1'}).err);
 now+=E.HOUR/2;assert(Math.abs(E.left(s.dragons[0].training,0)-15)<.001);assert(Math.abs(E.left(s.dragons[0].training,1)-5)<.001);let done=E.normalize(s,2,null);assert.equal(done.dragons[0].academyRank,1);
 const base=S.of(G.gamePhenotype(g),6),trained=S.of({...G.gamePhenotype(g),academyRank:1},6);assert(trained.atk>base.atk&&trained.hp>base.hp&&trained.def>base.def&&trained.spd>base.spd);
 r=E.apply(done,c,{t:'daily',id:'cards'});assert(!r.err);assert(E.apply(r.s,c,{t:'daily',id:'cards'}).err);assert(!E.dailyProgress(r.s,{...c,today:'2026-10-30',inc:{dayCards:0}},'cards').done);
 let farms=E.startState([]);const farm=farms.bld.find(x=>x.type==='farm');farms.bld.push({...JSON.parse(JSON.stringify(farm)),id:'extra',lvl:2,plots:[{crop:'ember',at:0,need:0},null,null]});const bal=farms.bal.gold;farms.updatedAt=new Date(now).toISOString();farms=E.normalize(farms,0,{wallTime:true,food:0,gems:0});assert.equal(farms.bld.filter(x=>x.type==='farm').length,1);assert.equal(farms.farmReserve.length,1);assert.equal(farms.bal.gold-bal,400);assert.equal(E.normalize(farms,0,{wallTime:true,food:0,gems:0}).bal.gold,farms.bal.gold);
 assert.equal(G.gameRarity({elements:['F','W']}),1);assert.equal(G.RARITY[2],'эпический');assert.equal(G.RARITY[3],'мифический');assert.equal(G.gameRarity({elements:['F','W','T','A']}),3);
 console.log('PASS: реальные часы, ускорение карточками, академия, суточные награды, объединение ферм и редкости');
}finally{Date.now=real}
