import assert from 'node:assert/strict';
import {newIsland,refresh,apply,total} from '../phagi/island/game.mjs';
import {campaignWorld,stageInfo,stageTarget,stageNumber,stageCount,unlockedStage,battleStars,campaignEntitlement} from '../phagi/island/campaign.mjs';
import {islandLevel,xpFor,canBuild,nextInvasion} from '../phagi/island/progression.mjs';
import {stats,strength} from '../phagi/island/catalog.mjs';
import {battleMap,replay} from '../phagi/island/battle.mjs';
import {recordBattle,settleInvasion} from '../phagi/island/records.mjs';

const t=Date.UTC(2026,10,18,16),a=newIsland(t);
assert.equal(a.shield,0);assert.equal(nextInvasion(t-1),t);assert.equal(nextInvasion(t),t+86400000);
assert.equal(islandLevel(0),1);assert.equal(canBuild(a,'storm'),false);
assert.throws(()=>apply(a,{action:'build',kind:'storm',col:0,row:0},{now:t}),/уровне/);
const protectedOwner=newIsland(t),rival=newIsland(t);protectedOwner.shield=t+43200000;
apply(protectedOwner,{action:'raid',team:[protectedOwner.dragons[0].id]},{now:t,uid:'owner',target:'peer',defender:rival});
assert.equal(protectedOwner.shield,t+43200000);
const xp=a.xp;apply(a,{action:'build',kind:'home',col:0,row:0},{now:t});assert.ok(a.xp>xp&&islandLevel(a.xp)===2);
apply(a,{action:'feed',dragon:a.dragons[0].id},{now:t});assert.equal(a.xp,31);
for(let n=1;n<=40;n++){assert.equal(islandLevel(xpFor(n)),n);assert.equal(islandLevel(xpFor(n+1)-1),n);}
const legacy=newIsland(t);legacy.v=2;legacy.shield=t+86400000;delete legacy.xp;refresh(legacy,t);
assert.equal(legacy.shield,0);assert.ok(!refresh(legacy,t));assert.equal(legacy.v,3);
const injured=newIsland(t);injured.v=2;injured.shield=t+3600000;injured.reports=[{incoming:true,time:t-100,loot:{gold:5,food:0}}];refresh(injured,t);assert.equal(injured.shield,t+3600000);
assert.ok(stats({species:'s3',level:2,stars:0}).hp>stats({species:'s3',level:1,stars:0}).hp);
const pure={species:'s3',level:10,stars:0},rare={species:'s013',level:10,stars:0};
assert.ok(strength({...pure,stars:1})>strength(pure));assert.ok(stats({...rare,stars:1}).power>stats(rare).power);
let last=0;
for(let i=1;i<=stageCount;i++){
 const info=stageInfo(i),world=campaignWorld(i);
 assert.equal(stageNumber(stageTarget(i)),i);assert.equal(info.boss,i%20===0);
 const coords=world.buildings.map(b=>b.col+10*b.row);
 assert.ok(world.buildings.every(b=>b.col>=0&&b.col<10&&b.row>=0&&b.row<10));assert.equal(new Set(coords).size,coords.length);
 assert.deepEqual(world,campaignWorld(i));assert.deepEqual(world.buildings.filter(b=>b.id==='keep').map(b=>b.kind),['nest']);
 const dummy={id:'u',species:'s3',level:1,stars:0};
 const start=replay({boardSize:10,rules:2,start:0,team:[dummy],targets:battleMap(world),commands:[]},0);
 const defense=start.targets.reduce((n,b)=>n+b.max+(b.force||0),0);assert.ok(defense>last,'strength stage '+i);last=defense;
}
assert.equal(stageNumber('npc:campaign-301'),0);
const s=newIsland(0),team=s.dragons.map(d=>d.id),receipts=[];
const play=(n,repeat=false)=>{
 const defender=campaignWorld(n),ctx={now:0,uid:'test',defender,target:stageTarget(n),archive:(owner,report,recording)=>receipts.push({report,recording})};
 apply(s,{action:'raid',team},ctx);
 const r=s.raid;r.commands=team.map(unit=>({unit,action:'land',shore:1,tick:0}));
 const expected=replay(r,90000),{sim,recording}=recordBattle(r,90000);
 assert.deepEqual(sim.units,expected.units);assert.equal(recording.frames.at(-1)[0],sim.tick);
 assert.ok(recording.events.some(e=>e.kind==='fire')&&recording.frames.some(f=>f[1].some(u=>u!==null)));
 const report=apply(s,{action:'finish',raid:r.id},{...ctx,now:90000});
 assert.equal(report.stars,battleStars(sim));assert.equal(report.stars,3);
 if(repeat){assert.equal(report.experience,0);assert.deepEqual(report.loot,{gold:0,food:0});}
 return report;
};
assert.throws(()=>apply(s,{action:'raid',team},{now:0,uid:'test',target:stageTarget(2),defender:campaignWorld(2)}),/предыдущий/);
const win=play(1);assert.deepEqual(win.loot,campaignEntitlement(1,3));assert.equal(unlockedStage(s),2);assert.ok(win.experience>0&&receipts.length===1);
const paid=s.xp;play(1,true);assert.equal(s.xp,paid);
for(const b of s.buildings.filter(b=>['gold','food'].includes(b.kind)))b.stock=1000;
const blocked=play(2);assert.deepEqual(blocked.loot,{gold:0,food:0});
const vault=s.buildings.find(b=>b.kind==='gold');vault.stock-=35;
assert.deepEqual(apply(s,{action:'campaignClaim',stage:2},{now:t}),{gold:35,food:0});
assert.deepEqual(apply(s,{action:'campaignClaim',stage:2},{now:t}),{gold:0,food:0});
const exposed=newIsland(0);exposed.buildings=exposed.buildings.filter(b=>b.kind!=='tower');exposed.shield=t+3600000;const gold=total(exposed,'gold');
const raid=settleInvasion(exposed,t);assert.equal(raid.report.won,false);assert.equal(exposed.invasionLevel,1);assert.equal(raid.report.time,t);assert.equal(raid.report.loot.gold,Math.floor(.2*gold));
assert.equal(raid.report.loot.gold,gold-total(exposed,'gold'));assert.ok(raid.report.ledger.every(v=>v.before+v.delta===v.after));
const fort=newIsland(t);fort.buildings.push({id:'guardhouse',kind:'garrison',level:20,col:6,row:8},{id:'t2',kind:'storm',level:20,col:6,row:9});
fort.dragons.forEach(d=>{d.guard=true;d.level=30;d.stars=5;});
const held=settleInvasion(fort,t);assert.equal(held.report.won,true);assert.equal(fort.invasionLevel,2);assert.deepEqual(held.report.loot,{gold:0,food:0});
assert.ok(Object.values(held.recording.performance).some(row=>row.damage>0));
console.log('300 progressively stronger layouts, 15 fortresses, XP and locks, reward ceilings, saved frames, resource ledgers and both scheduled defense outcomes passed.');
