const assert=require('node:assert/strict');
const limits=require('../oplot-limits.js');
const at=2000000000,level=n=>({xp:35*(n-1)**2,buildings:[]});
const building=(id,type,level=1,props={})=>({id,type,level,x:0,y:0,since:at,...props});
for(const n of [1,2,3,4,5,6,7,8,9,13,20]){
 const state=level(n);
 for(const t of ['mine','farm'])assert.equal(limits.cap(t,state),1+(n>=4)+(n>=7));
 for(const t of ['goldstore','foodstore'])assert.equal(limits.cap(t,state),1+(n>=6));
 assert.equal(limits.cap('keep',state),1);assert.equal(limits.cap('den',state),1);assert.equal(limits.cap('academy',state),Number(n>=7));
 for(const t of ['home','archer','cannon','spire'])assert.equal(limits.cap(t,state),t==='spire'&&n<2?0:1+Math.min(8,n));
 for(const t of ['firetrap','icetrap'])assert.equal(limits.cap(t,state),1+2*Math.min(8,n));
}
assert.deepEqual([1,2,13,25].map(n=>limits.cap('wall',level(n))),[128,138,236,236]);
assert.equal(limits.cap('wall',{xp:0,buildings:[building('legacy-edge','wall',1,{x:34,y:34})]}),128);
assert.deepEqual(['mine','goldstore','academy','spire','wall','den'].map(t=>limits.nextUnlock(t,level(1))),[4,6,7,2,2,null]);
assert.equal(limits.nextUnlock('archer',level(8)),null);assert.equal(limits.nextUnlock('wall',level(13)),null);
assert.deepEqual([0,1,2].map(n=>limits.buildGold('mine',n)),[0,195,325]);
assert.deepEqual([0,1,2].map(n=>limits.buildGold('goldstore',n)),[90,270,450]);
assert.equal(limits.buildGold('farm',0),0);assert.equal(limits.buildGold('home',5),80);
assert.deepEqual([limits.upgradeGold('mine',1),limits.upgradeGold('mine',2),limits.upgradeGold('academy',1),limits.upgradeGold('home',1)],[42,59,170,70]);
const raw={...level(1),gold:449,berries:299,dragons:Array.from({length:15},(_,i)=>({id:'d'+i,level:1})),deliveries:['receipt'],pending:null,buildings:[
 building('K','keep',8),building('M0','mine',2,{since:at-7500}),building('M1','mine',3,{stowed:true,x:null,y:null,pausedStock:47}),building('M2','mine',3),
 building('F0','farm',1,{since:at-10000}),building('F1','farm',2),building('A','academy',2),building('H0','home',2),building('H1','home',2),
 building('H2','home',2,{since:at-10000}),building('S','spire')
]};
const copied=structuredClone(raw);assert.ok(limits.needsSettlement(raw));
const fixed=limits.reconcile(raw,at);
assert.deepEqual(raw,copied);assert.deepEqual(fixed.buildings.map(b=>b.id),['K','M2','F1','H0','H1']);
assert.deepEqual(fixed.limitReceipt,{version:1,at,profileLevel:1,removed:{mine:2,farm:1,academy:1,home:1,spire:1},
 refundGold:1008,productionGold:62,productionBerries:6,retiredIds:['M0','M1','F0','A','H2','S']});
assert.deepEqual([fixed.gold,fixed.berries],[1519,305]);assert.deepEqual(fixed.dragons,raw.dragons);assert.deepEqual(fixed.deliveries,raw.deliveries);
assert.ok(limits.validReceipt(fixed.limitReceipt));assert.ok(!limits.validReceipt({...fixed.limitReceipt,retiredIds:['X','X']}));
assert.equal(limits.reconcile(fixed,at+100000),fixed);assert.equal(limits.needsSettlement(fixed),false);
const revived={...fixed,buildings:[...fixed.buildings,raw.buildings[1]]};const again=limits.reconcile(revived,at+100000);
assert.deepEqual(again,fixed,'Retired IDs cannot earn a second payment');
const old={gold:0,berries:0,dragons:[{level:2}],quest:0,campaign:{1:1},buildings:[building('keep','keep'),building('a','mine',2),building('b','mine',3)]};
assert.equal(limits.profileLevel(old),2);const migrated=limits.reconcile(old,at);
assert.equal(migrated.xp,71);assert.equal(limits.profileLevel(migrated),2);
assert.equal(limits.reconcile({xp:0,buildings:[]},at).xp,0);
console.log('PASS profile caps, unlocks, ordered building and upgrade refunds, on-map/stowed harvest, excess housing, old XP and idempotent settlements');

const treasuryPrices=[400,950,1900,3600,6200,9800,14500,20500,29000,41000,57000];
assert.equal(limits.keepMax,12);
treasuryPrices.forEach((price,i)=>{
  assert.equal(limits.upgradeGold('keep',i+1),price);
  const storeLevel=Math.min(i+2,9);
  assert.ok(price<=450+2*450*storeLevel**2,'Available stores can pay for citadel tier '+(i+2));
});
