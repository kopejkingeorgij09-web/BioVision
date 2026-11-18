import {replay,battleMap,battleSeconds,tickMs} from './battle.mjs';
import {stats} from './catalog.mjs';
import {boardSize} from './world.mjs';

// Save actual positions, health, commands and hits instead of recomputing an old
// match using future balance rules. One immutable recording serves both sides.
export function recordBattle(raid,endTime){
 const frames=[],events=[],performanceById={},fallen=new Set();
 const commands=raid.commands;let commandIndex=0;
 const pos=o=>[Math.round(o.x||0),Math.round(o.y||0),o.hp];
 const sim=replay(raid,endTime,null,(s,final)=>{
  while(commandIndex<commands.length&&commands[commandIndex].tick<=s.tick){
   const c=commands[commandIndex++];events.push({tick:c.tick,kind:c.action,from:c.unit,to:c.target,shore:c.shore});
  }
  for(const f of s.flashes){if(f.tick!==s.tick)continue;
   const row=performanceById[f.from]||{hits:0,damage:0};row.hits++;row.damage+=f.damage;performanceById[f.from]=row;
   if(row.hits===1)events.push({tick:s.tick,kind:'fire',from:f.from,to:f.to});
  }
  for(const o of [...s.targets,...s.units])if(o.hp<=0&&!fallen.has(o.id)){fallen.add(o.id);events.push({tick:s.tick,kind:'down',to:o.id});}
  if(s.tick%4===0||final)frames.push([s.tick,s.units.map(u=>u.landed?pos(u):null),s.targets.map(pos),s.flashes.map(f=>[f.from,f.to,f.type])]);
 });
 return {sim,recording:{v:1,size:raid.boardSize||5,seconds:sim.tick*tickMs/1000,
  team:sim.units.map(({id,species,level,stars,max})=>({id,species,level,stars,max})),
  targets:sim.targets.map(({id,kind,landmark,species,level,max})=>({id,kind,landmark,species,level,max})),frames,events,performance:performanceById}};
}
export function markReport(s,report){
 s.reports=[report,...s.reports.filter(r=>r.id!==report.id)].slice(0,20);
}
export function settleInvasion(s,scheduled){
 const wave=s.invasionLevel||1,team=[],commands=[],targets=battleMap(s);
 const stores=targets.filter(t=>t.kind==='gold'||t.kind==='food');
 const ids=['s0','s2','s5'],count=Math.min(3,1+Math.floor((wave-1)/4));
 for(let i=0;i<count;i++){
  const d={id:'raider-'+i,species:ids[i],level:wave,stars:Math.min(5,Math.floor((wave-1)/7))};
  const a=stats(d);d.combat={...a,hp:Math.round(a.hp*(.46+.035*wave)),power:Math.max(3,Math.round(a.power*(.44+.018*wave)))};
  team.push(d);commands.push({action:'land',unit:d.id,shore:(i+Math.floor(scheduled/86400000))%3,tick:i*8});
  const store=stores[i%Math.max(1,stores.length)];
  if(store)commands.push({action:'target',unit:d.id,target:store.id,tick:i*8+2});
 }
 const enemy='Налётчики · волна '+wave;
 const r={id:'daily-'+new Date(scheduled).toISOString().slice(0,10),target:'daily',rules:2,boardSize,start:scheduled,team,targets,commands};
 const {sim,recording}=recordBattle(r,scheduled+battleSeconds*1000);
 const destroyed=sim.targets.filter(t=>t.hp<=0),broken=new Set(destroyed.map(t=>t.id)),loot={gold:0,food:0},ledger=[];
 for(const b of s.buildings.filter(b=>['food','gold'].includes(b.kind))){
  const before=b.stock,loss=broken.has(b.id)?Math.floor(before*.2):0;
  b.stock-=loss;loot[b.kind]+=loss;ledger.push({building:b.id,kind:b.kind,col:b.col,row:b.row,before,after:b.stock,delta:-loss});
 }
 const won=!destroyed.some(t=>['gold','food'].includes(t.kind));
 if(won)s.invasionLevel=wave+1;
 const report={id:r.id,time:scheduled,source:'daily',incoming:true,enemy,wave,won,reason:won?'Оборона удержала хранилища':'Враг прорвался к запасам',destroyed:destroyed.map(t=>t.kind),loot,ledger,replay:true};
 markReport(s,report);return {report,recording};
}
