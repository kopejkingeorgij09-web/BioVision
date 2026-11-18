import {byId,stats} from './catalog.mjs';
export const battleSeconds=90, tickMs=250, shores=[[8,98],[50,98],[92,98]];
export const position=b=>({x:10+b.col*20,y:10+b.row*20});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function battleMap(island) {
  return island.buildings.map(b=>({id:b.id,kind:b.kind,level:b.level,...position(b),stock:b.stock||0})).concat(
    island.dragons.filter(d=>d.guard).map((d,i)=>({id:d.id,kind:'guard',species:d.species,...stats(d),...position(island.buildings.find(b=>b.kind==='garrison')),x:position(island.buildings.find(b=>b.kind==='garrison')).x+i*3})));
}
const health=t=>t.kind==='guard'?t.hp:({tower:125,ice:90,gold:88,food:88}[t.kind]||66)*(1+.25*(t.level-1));
function initial(raid) {
  return {tick:0,end:'',flashes:[],targets:raid.targets.map(t=>({...t,hp:health(t),max:health(t),freeze:0})),
    units:raid.team.map(d=>({...d,...stats(d),max:stats(d).hp,landed:false,hp:stats(d).hp,target:null,next:0,skillAt:0,ward:0}))};
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
  const damage=Math.round(power*advantage*(sp.role===4&&t.kind!=='guard'?1.25:1));
  t.hp=Math.max(0,t.hp-damage);s.flashes.push({from:u.id,to:t.id,tick:s.tick,type,skill});
}
function command(s,c) {
  const u=s.units.find(d=>d.id===c.unit);if(!u||u.hp<=0)return false;
  if(c.action==='land'&&!u.landed&&Number.isInteger(c.shore)&&shores[c.shore]){
    [u.x,u.y]=shores[c.shore];u.landed=true;return true;
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
    if(d>u.range+.001){const slow=s.targets.some(o=>o.kind==='ice'&&o.hp>0&&o.freeze<=s.tick&&distance(u,o)<31);
      const move=Math.min(d-u.range,u.speed*.25*(slow?.52:1));u.x+=(t.x-u.x)*move/d;u.y+=(t.y-u.y)*move/d;
    }else if(s.tick>=u.next){strike(s,u,t,u.power);u.next=s.tick+5;}
  }
  if(s.tick%6===0)for(const t of s.targets.filter(t=>t.hp>0&&t.freeze<=s.tick&&(t.kind==='tower'||t.kind==='guard'))){
    const target=s.units.filter(u=>u.landed&&u.hp>0).sort((a,b)=>distance(a,t)-distance(b,t))[0];
    if(!target)continue;
    const d=distance(target,t),range=t.kind==='guard'?t.range:37;
    if(t.kind==='guard'&&d>range+.001){const stride=Math.min(t.speed*1.5,d-range);t.x+=(target.x-t.x)*stride/d;t.y+=(target.y-t.y)*stride/d;}
    else if(d<=range+.001){target.hp=Math.max(0,target.hp-Math.ceil((t.kind==='guard'?t.power:9*t.level)*(target.ward>s.tick?.5:1)));s.flashes.push({from:t.id,to:target.id,tick:s.tick,type:6});}
  }
  if(s.targets.every(t=>t.hp<=0))s.end='Все цели разрушены';
  if(s.units.every(u=>u.landed&&u.hp<=0))s.end='Отряд отступил';
}
export function replay(raid,now,additional=null) {
  const s=initial(raid), max=Math.min(battleSeconds*4,Math.max(0,Math.floor((now-raid.start)/tickMs)+(additional?1:0)));
  const commands=raid.commands;let i=0;
  for(;s.tick<=max&&!s.end;s.tick++){
    while(i<commands.length&&commands[i].tick===s.tick)command(s,commands[i++]);
    if(additional&&s.tick===max){s.accepted=command(s,additional);}
    step(s);if(s.tick===battleSeconds*4&&!s.end)s.end='Время истекло';
  }
  s.tick--;s.flashes=s.flashes.filter(f=>s.tick-f.tick<3);return s;
}
