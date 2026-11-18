import {byId,stats} from './catalog.mjs';
import {defenseStats} from './defenses.mjs';
import {position,shorePositions,legacyRaidSize} from './world.mjs';
export {position};
export const battleSeconds=90, tickMs=250;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function battleMap(island) {
  return island.buildings.map(b=>({id:b.id,kind:b.kind,level:b.level,...position(b),stock:b.stock||0,...(b.landmark?{landmark:b.landmark}:{}),...(b.durability?{durability:b.durability,force:b.force}:{})})).concat(
    island.dragons.filter(d=>d.guard&&island.buildings.some(b=>b.kind==='garrison')).map((d,i)=>({id:d.id,kind:'guard',species:d.species,...stats(d),...position(island.buildings.find(b=>b.kind==='garrison')),x:position(island.buildings.find(b=>b.kind==='garrison')).x+i*3})));
}
export const targetHealth=t=>t.kind==='guard'?t.hp:Math.max(1,Math.round((t.durability||1)*(defenseStats(t.kind,t.level)?.hp??(({gold:88,food:88}[t.kind]||66)*(1+.25*(t.level-1))))));
function initial(raid) {
  return {shores:shorePositions(raid.boardSize??legacyRaidSize),tick:0,end:'',flashes:[],targets:raid.targets.map(t=>({...t,hp:targetHealth(t),max:targetHealth(t),freeze:0})),
    units:raid.team.map(d=>{const combat=d.combat||stats(d,!raid.rules);return {...d,...combat,max:combat.hp,landed:false,hp:combat.hp,target:null,next:0,skillAt:0,ward:0};})};
}
function choose(u,targets) {
  const live=targets.filter(t=>t.hp>0);
  const manual=live.find(t=>t.id===u.order);if(manual)return manual;
  const pref=byId[u.species].role===4?['food','gold']:['guard','tower'];
  return live.sort((a,b)=>(distance(u,a)-(pref.includes(a.kind)?9:0))-(distance(u,b)-(pref.includes(b.kind)?9:0)))[0];
}
function strike(s,u,t,power,skill=false) {
  const sp=byId[u.species], type=sp.types[0];
  const targetType=t.kind==='guard'?byId[t.species].types[0]:({tower:6,ice:1,food:4,gold:3}[t.kind]??0);
  const advantage=sp.types.some(e=>(e+1)%10===targetType)?1.25:1;
  let shield=0;
  if(t.kind!=='ward'&&t.kind!=='guard')for(const ward of s.targets.filter(o=>o.kind==='ward'&&o.hp>0&&o.freeze<=s.tick)){
    const v=defenseStats('ward',ward.level);if(distance(t,ward)<=v.range)shield=Math.max(shield,v.shield);
  }
  const damage=Math.min(t.hp,Math.max(1,Math.round(power*advantage*(sp.role===4&&t.kind!=='guard'?1.25:1)*(1-shield/100))));
  t.hp=Math.max(0,t.hp-damage);s.flashes.push({from:u.id,to:t.id,tick:s.tick,type,skill,damage});
}
function command(s,c) {
  const u=s.units.find(d=>d.id===c.unit);if(!u||u.hp<=0)return false;
  if(c.action==='land'&&!u.landed&&Number.isInteger(c.shore)&&s.shores[c.shore]){
    [u.x,u.y]=s.shores[c.shore];u.landed=true;return true;
  }
  if(!u.landed)return false;
  if(c.action==='target'&&s.targets.some(t=>t.id===c.target&&t.hp>0)){u.order=c.target;return true;}
  const t=choose(u,s.targets);
  if(c.action!=='skill'||s.tick<u.skillAt||!t)return false;
  const role=byId[u.species].role;
  if(role===1){for(const ally of s.units.filter(a=>a.landed&&a.hp>0)){ally.ward=s.tick+20;ally.hp=Math.min(ally.max,ally.hp+Math.ceil(u.power*.6));}}
  else {
    if(distance(u,t)>u.range+(role===2?42:18))return false;
    if(role===0){u.x+=(t.x-u.x)*.57;u.y+=(t.y-u.y)*.57;}
    if(role===3)t.freeze=s.tick+20;
    strike(s,u,t,u.power*(role===4?2.8:2),true);
  }
  u.skillAt=s.tick+32;return true;
}
function step(s) {
  for(const u of s.units.filter(u=>u.landed&&u.hp>0)){
    const t=choose(u,s.targets);if(!t)break;u.target=t.id;
    const d=distance(u,t);
    if(d>u.range+.001){let slow=0;
      for(const o of s.targets.filter(t=>t.kind==='ice'&&t.hp>0&&t.freeze<=s.tick)){const v=defenseStats('ice',o.level);if(distance(u,o)<=v.range)slow=Math.max(slow,v.slow);}
      const move=Math.min(d-u.range,u.speed*.25*(1-slow/100));u.x+=(t.x-u.x)*move/d;u.y+=(t.y-u.y)*move/d;
    }else if(s.tick>=u.next){strike(s,u,t,u.power);u.next=s.tick+5;}
  }
  if(s.tick%6===0)for(const t of s.targets.filter(t=>t.hp>0&&t.freeze<=s.tick&&['tower','storm','guard'].includes(t.kind))){
    const live=s.units.filter(u=>u.landed&&u.hp>0).sort((a,b)=>distance(a,t)-distance(b,t));
    const target=live[0];if(!target)continue;
    const v=defenseStats(t.kind,t.level),d=distance(target,t),range=v?.range??t.range;
    if(t.kind==='guard'&&d>range+.001){const stride=Math.min(t.speed*1.5,d-range);t.x+=(target.x-t.x)*stride/d;t.y+=(target.y-t.y)*stride/d;continue;}
    if(d>range+.001)continue;
    const hit=(from,to,damage)=>{const loss=Math.min(to.hp,Math.ceil(damage*(to.ward>s.tick?.5:1)));to.hp-=loss;s.flashes.push({from:from.id,to:to.id,tick:s.tick,damage:loss,type:t.kind==='storm'?5:6});};
    const power=(v?.damage??t.power)*(t.force||1);hit(t,target,power);
    if(t.kind==='storm'){const struck=new Set([target.id]);let last=target;
      while(struck.size<v.targets){const next=live.filter(u=>!struck.has(u.id)&&u.hp>0&&distance(u,last)<=20).sort((a,b)=>distance(a,last)-distance(b,last))[0];
        if(!next)break;hit(last,next,power*.7**struck.size);struck.add(next.id);last=next;}
    }
  }
  if(s.targets.every(t=>t.hp<=0))s.end='Все цели разрушены';
  if(s.units.every(u=>u.landed&&u.hp<=0))s.end='Отряд отступил';
}
export function replay(raid,now,additional=null,observe=null) {
  const s=initial(raid), max=Math.min(battleSeconds*4,Math.max(0,Math.floor((now-raid.start)/tickMs)+(additional?1:0)));
  const commands=raid.commands;let i=0;
  for(;s.tick<=max&&!s.end;s.tick++){
    while(i<commands.length&&commands[i].tick===s.tick)command(s,commands[i++]);
    if(additional&&s.tick===max){s.accepted=command(s,additional);}
    step(s);if(s.tick===battleSeconds*4&&!s.end)s.end='Время истекло';
    s.flashes=s.flashes.filter(f=>s.tick-f.tick<3);if(observe)observe(s,s.tick===max||!!s.end);
  }
  s.tick--;s.flashes=s.flashes.filter(f=>s.tick-f.tick<3);return s;
}
