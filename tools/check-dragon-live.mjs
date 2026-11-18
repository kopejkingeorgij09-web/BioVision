// Supply three explicitly isolated QA accounts and seeded island layouts as in phagi/island/README.md.
import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {replay} from '../phagi/island/battle.mjs';import {newIsland,total} from '../phagi/island/game.mjs';
const accounts=JSON.parse(readFileSync(process.env.DRAGON_QA_ACCOUNTS,'utf8'));
assert.equal(accounts.length,3);assert.ok(accounts.every(a=>a.uid.startsWith('qa-isle-')));
const mode=process.argv[2]||'gold',endpoint=process.env.DRAGON_ENDPOINT||'https://zonrkvsibojyalhnqutd.supabase.co/functions/v1/dragon-island';
// Emit a reset transaction only for the supplied QA identities, for an operator to run
// before each independent scenario. No school access codes are copied into the SQL.
if(process.argv.includes('--fixture')){
 assert.ok(['none','food','gold','both','cap','race'].includes(mode));
 const rows=(mode==='race'?[0,1,2]:[1,2]).map(i=>{
  const uid=accounts[i].uid;
  assert.match(uid,/^qa-isle-[a-z0-9-]+$/i);
  const s=newIsland(Date.now(),'Тестовый остров');s.shield=0;
  for(const b of s.buildings.filter(b=>b.kind==='gold'||b.kind==='food')){
   b.level=b.kind==='gold'?10:5;b.stock=i===1?b.level*1000:mode==='cap'?b.level*1000-7:0;
  }
  if(i!==1)for(const d of s.dragons){d.level=30;d.stars=5;}
  return "('"+uid+"',1,'"+JSON.stringify(s).replaceAll("'","''")+"'::jsonb)";
 });
 console.log('insert into dragon_island.players(uid,rev,state) values '+rows.join(',')+' on conflict(uid) do update set state=excluded.state,rev=dragon_island.players.rev+1;');
 process.exit(0);
}
const call=async(i,cmd,op=crypto.randomUUID(),drop=false)=>{
 let response;
 for(let attempt=1;attempt<=4;attempt++){
  try{
   response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:accounts[i].code,cmd,op})});
   if(response.status<500||attempt===4)break;
  }catch(error){if(attempt===4)throw error;}
 }
 if(drop){assert.ok(response.ok,await (response.ok?Promise.resolve(''):response.text()));await response.body.cancel();return;}
 const r=await response.json();assert.ok(response.ok,r.error||response.statusText);return r;
};
const read=i=>call(i,{action:'read'}), stocks=s=>[total(s,'gold'),total(s,'food')], delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const before=await read(1),aBefore=await read(2),otherBefore=mode==='race'?await read(0):null;
async function battle(i,targets){
 const prep=await read(i),team=[prep.state.dragons[0].id];
 let data=await call(i,{action:'raid',target:accounts[1].uid,team});const raid=data.state.raid.id;
 async function order(order,extra){data=await call(i,{action:'order',order,raid,unit:team[0],...extra});}
 await order('land',{shore:1});
 for(const id of targets){
  await order('target',{mark:id});const offset=data.now-Date.now();
  for(;;){const sim=replay(data.state.raid,Date.now()+offset),t=sim.targets.find(t=>t.id===id);
   if(mode==='none'?t.hp<t.max&&t.hp>0:t.hp===0)break;
   assert.ok(!sim.end,'Цель уцелела после окончания боя');await delay(100);
  }
  await delay(270);
 }
 return {action:'finish',raid};
}
const targets=mode==='both'||mode==='cap'?['food','gold']:[mode==='food'?'food':'gold'];
let r,other;
if(mode==='race'){
 const cmds=await Promise.all([battle(2,targets),battle(0,targets)]);
 [r,other]=await Promise.all([call(2,cmds[0]),call(0,cmds[1])]);
}else{
 const cmd=await battle(2,targets),op=crypto.randomUUID();
 await call(2,cmd,op,true);r=await call(2,cmd,op);assert.deepEqual((await call(2,cmd,op)).result,r.result);
}
const after=await read(1),ab=stocks(aBefore.state),aa=stocks(r.state),db=stocks(before.state),da=stocks(after.state);
const allies=other?stocks(other.state).map((n,i)=>n-stocks(otherBefore.state)[i]):[0,0];
const loot=aa.map((n,i)=>n-ab[i]+allies[i]);assert.deepEqual(loot,db.map((n,i)=>n-da[i]));
assert.deepEqual(loot,({none:[0,0],gold:[8000,0],food:[0,4000],both:[8000,4000],cap:[7,7],race:[8000,0]})[mode]);
if(mode!=='none')assert.ok(after.state.shield>after.now);
assert.ok(after.state.reports.some(entry=>entry.id===r.result.id&&entry.incoming));
console.log(JSON.stringify({mode,attackerBefore:ab,attackerAfter:aa,defenderBefore:db,defenderAfter:da,loot,otherAttackerGain:allies,destroyed:r.result.destroyed,reason:r.result.reason}));
