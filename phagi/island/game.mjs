import {boardSize} from './world.mjs';
import {species,byId,starPrices,foodPrice,distribution,draw} from './catalog.mjs';
import {defenses} from './defenses.mjs';
import {battleMap,battleSeconds,tickMs,replay} from './battle.mjs';
export const buildings={nest:'Гнездо',tower:'Дозорная башня',food:'Склад еды',gold:'Золотой резервуар',farm:'Фруктовый сад',mine:'Золотая жила',incubator:'Инкубатор',home:'Жилище',garrison:'Гарнизон',ice:'Ледяной маяк',storm:'Грозовой обелиск',ward:'Оберег скалы'};
export const limits={day:86400000,shield:43200000,recovery:300000,level:30,stars:5};
export const prices={nest:70,incubator:100,slot:40};
export const upgrade=b=>({price:120*b.level,ms:60000*b.level});
export const capacity=b=>1000*b.level, homeSize=b=>4*b.level;
export const gemSpeed=(end,now)=>Math.ceil(Math.max(0,end-now)/1800000);
export const earned=n=>n<20?0:10+Math.floor((n-20)/2);
export function need(condition,msg){if(!condition)throw new Error(msg);}
const id=()=>crypto.randomUUID();
const makeDragon=(sid,home)=>({id:id(),species:sid,level:1,stars:0,home,guard:false,recover:0});
export function newIsland(now,name='Остров'){
  const plots=[['home',3,4],['home',6,4,'water-home'],['tower',4,1],['farm',7,2],['nest',2,5],['incubator',3,7],['food',6,7],['gold',7,5],['mine',8,3],['garrison',2,8]];
  const bs=plots.map(([kind,col,row,key=kind])=>({id:key,kind,col,row,level:1,slots:1,stock:kind==='food'?280:kind==='gold'?350:0,since:now-120000}));
  return {v:2,name,buildings:bs,dragons:[makeDragon('s3','home'),makeDragon('s1','water-home')],seen:['s3','s1'],eggs:[],symbols:Array(10).fill(0),spent:0,
    feeds:0,hatches:0,sorties:0,claimed:{},shield:now+limits.day,raid:null,reports:[]};
}
export function npcWorld(key,now){
  const tier=['reef','pine','summit'].indexOf(key);need(tier>=0,'Неизвестный остров');
  const s=newIsland(now,['Меловая отмель','Сосновый мыс','Грозовой утёс'][tier]);
  s.buildings=s.buildings.filter(b=>['tower','food','gold','nest'].includes(b.kind));
  const layouts=[[[4,4],[4,6],[6,6],[3,5]],[[4,3],[3,6],[6,6],[6,4]],[[5,4],[3,4],[7,6],[5,7]]];
  s.buildings.forEach((b,i)=>{[b.col,b.row]=layouts[tier][i];b.level=1+tier;if(['food','gold'].includes(b.kind))b.stock=250*(tier+1);});
  const defensePlots=tier===2?[['ice',5,6],['storm',4,5],['ward',6,5]]:tier===1?[['ice',4,6]]:[];
  for(const [kind,col,row] of defensePlots)s.buildings.push({id:kind,kind,col,row,level:tier,stock:0});
  s.dragons=[];s.shield=0;return s;
}
export function refresh(s,now){
  if(s.v===1){
    const home=s.buildings.find(b=>b.id==='home'&&b.kind==='home');
    const water=s.dragons.find(d=>d.species==='s1'&&d.home==='home'&&!d.born);
    if(home&&water&&s.dragons.some(d=>d.species==='s3'&&d.home==='home'&&!d.born)&&!s.buildings.some(b=>b.id==='water-home')){
      const free=Array.from({length:boardSize**2},(_,i)=>({col:i%boardSize,row:Math.floor(i/boardSize)}))
        .filter(p=>!s.buildings.some(b=>b.col===p.col&&b.row===p.row));
      const dist=p=>Math.abs(p.col-home.col-2)+Math.abs(p.row-home.row-1);
      free.sort((a,b)=>dist(a)-dist(b));
      if(free.length){s.buildings.push({id:'water-home',kind:'home',level:1,slots:1,stock:0,since:now,...free[0]});water.home='water-home';}
    }
    s.v=2;
  }
  for(const b of s.buildings)if(b.finish&&b.finish<=now){b.level++;delete b.finish;}
}
export const available=(s,d,now)=>d&&!d.guard&&d.recover<=now&&!s.eggs.some(e=>e.stage==='nest'&&e.end>now&&e.parents.includes(d.id))&&!s.raid?.team.some(r=>r.id===d.id);
export const total=(s,kind)=>s.buildings.filter(b=>b.kind===kind).reduce((sum,b)=>sum+b.stock,0);
export const room=(s,kind)=>s.buildings.filter(b=>b.kind===kind).reduce((sum,b)=>sum+capacity(b)-b.stock,0);
function change(s,kind,amount){
  need(amount>=0||total(s,kind)>=-amount,'Недостаточно ресурсов');
  let left=Math.abs(amount);
  for(const b of s.buildings.filter(b=>b.kind===kind)){const part=Math.min(left,amount<0?b.stock:capacity(b)-b.stock);b.stock+=amount<0?-part:part;left-=part;}
  return Math.abs(amount)-left;
}
export const production=(b,now)=>Math.min(160*b.level,Math.floor(Math.max(0,now-b.since)/10000)*b.level);
export const nestTime=s=>s.hatches?300000:45000;
export const hatchTime=(s,sid)=>s.hatches?byId[sid].rarity**2*900000:60000;
export const unlockPrice=s=>80+40*s.seen.filter(k=>byId[k].rarity===1).length;
export function objectives(s){
  return [{id:'feed',name:'Первое кормление',value:s.feeds,goal:1,reward:10},{id:'hatch',name:'Первый детёныш',value:s.hatches,goal:1,reward:15},
    {id:'patrol',name:'Патруль архипелага',value:s.sorties,goal:2,reward:10,repeat:true}].map(o=>({...o,claims:s.claimed[o.id]||0}));
}
const balance=(s,credit)=>credit-s.spent;
function spend(s,credit,amount){need(amount>=0&&balance(s,credit)>=amount,'Недостаточно алмазов');s.spent+=amount;}
function plot(s,c,r,except){need(Number.isInteger(c)&&c>=0&&c<boardSize&&Number.isInteger(r)&&r>=0&&r<boardSize,'За пределами острова');
  need(!s.buildings.some(b=>b.id!==except&&b.col===c&&b.row===r),'Клетка занята');}
function house(s,h){need(h?.kind==='home'&&s.dragons.filter(d=>d.home===h.id).length<homeSize(h),'В жилище нет места');}
export const buildCost=k=>Object.hasOwn(prices,k)?{gems:prices[k]}:{gold:defenses[k]?.gold??(k==='home'?150:200)};
export function apply(s,cmd,{now,credit=0,defender=null,uid='',target='',random=Math.random}){
  refresh(s,now);
  const d=s.dragons.find(x=>x.id===cmd.dragon), b=s.buildings.find(x=>x.id===cmd.building), egg=s.eggs.find(e=>e.id===cmd.egg);
  const kind=cmd.kind;
  switch(cmd.action){
  case 'collect':{
    need(b&&['mine','farm'].includes(b.kind),'Выберите производство');const resource=b.kind==='mine'?'gold':'food';
    const amount=change(s,resource,production(b,now));need(amount>0,'Склад полон или сбор ещё не готов');
    b.since=Math.max(b.since,now-160*10000)+Math.ceil(amount/b.level)*10000;return;
  }
  case 'move':need(b,'Нет постройки');plot(s,cmd.col,cmd.row,b.id);b.col=cmd.col;b.row=cmd.row;return;
  case 'build':{
    need(Object.hasOwn(buildings,kind),'Нет постройки');plot(s,cmd.col,cmd.row);const cost=buildCost(kind);
    if(cost.gems)spend(s,credit,cost.gems);else change(s,'gold',-cost.gold);
    s.buildings.push({id:id(),kind,col:cmd.col,row:cmd.row,level:1,slots:1,stock:0,since:now});return;
  }
  case 'upgrade':need(b&&!b.finish&&b.level<30,'Улучшение недоступно');change(s,'gold',-upgrade(b).price);b.finish=now+upgrade(b).ms;return;
  case 'slot':need(b?.kind==='incubator'&&b.slots===1,'Место уже открыто');spend(s,credit,prices.slot);b.slots=2;return;
  case 'speed':{
    const obj=egg||b;need(obj,'Операция отсутствует');const key=egg?'end':'finish',price=gemSpeed(obj[key]||0,now);
    need(Number.isInteger(cmd.max)&&price<=cmd.max,'Подтвердите новую цену');if(price){spend(s,credit,price);obj[key]=now;refresh(s,now);}return;
  }
  case 'unlock':{
    need(byId[cmd.species]?.rarity===1&&!s.seen.includes(cmd.species),'Вид уже открыт');house(s,b);change(s,'gold',-unlockPrice(s));s.dragons.push(makeDragon(cmd.species,b.id));s.seen.push(cmd.species);return;
  }
  case 'feed':need(d&&d.level<limits.level&&available(s,d,now),'Кормление недоступно');change(s,'food',-foodPrice(d.level));d.level++;s.feeds++;return;
  case 'rehome':need(d&&available(s,d,now)&&d.home!==b?.id,'Дракон занят или уже живёт здесь');house(s,b);d.home=b.id;return;
  case 'guard':need(d&&(d.guard||available(s,d,now)),'Дракон занят');need(d.guard||s.dragons.filter(x=>x.guard).length<3,'Гарнизон полон');d.guard=!d.guard;return;
  case 'sell':need(d&&available(s,d,now)&&s.dragons.some(x=>x.id!==d.id&&x.species===d.species),'Можно отпустить свободного дубликата');s.dragons=s.dragons.filter(x=>x.id!==d.id);change(s,'gold',25);return;
  case 'symbol':{
    const o=objectives(s).find(o=>o.id===cmd.objective);
    need(o&&o.value>=(o.claims+1)*o.goal&&(o.repeat||!o.claims),'Испытание ещё не выполнено');need(Number.isInteger(cmd.type)&&cmd.type>=0&&cmd.type<10,'Выберите стихию');
    s.symbols[cmd.type]+=o.reward;s.claimed[o.id]=o.claims+1;return;
  }
  case 'star':{
    need(d&&d.stars<5&&available(s,d,now),'Улучшение недоступно');const pay=cmd.pay;
    need(Array.isArray(pay)&&pay.length===10&&pay.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=s.symbols[i]&&(!v||byId[d.species].types.includes(i)))&&pay.reduce((a,b)=>a+b,0)===starPrices[d.stars],'Проверьте набор символов');
    s.symbols=s.symbols.map((n,i)=>n-pay[i]);d.stars++;return;
  }
  case 'breed':{
    const other=s.dragons.find(x=>x.id===cmd.other);
    need(d&&other&&d!==other&&available(s,d,now)&&available(s,other,now),'Родители должны быть разными и свободными');
    need(b?.kind==='nest'&&!s.eggs.some(e=>e.building===b.id),'Гнездо занято');
    s.eggs.push({id:id(),species:draw(distribution(d,other),random),stage:'nest',building:b.id,parents:[d.id,other.id],end:now+nestTime(s)});return;
  }
  case 'incubate':need(egg?.stage==='nest'&&egg.end<=now,'Яйцо ещё в гнезде');need(b?.kind==='incubator'&&s.eggs.filter(e=>e.building===b.id).length<b.slots,'Инкубатор заполнен');egg.stage='incubator';egg.building=b.id;egg.end=now+hatchTime(s,egg.species);return;
  case 'hatch':need(egg?.stage==='incubator'&&egg.end<=now,'Детёныш ещё не готов');house(s,b);s.dragons.push({...makeDragon(egg.species,b.id),born:now});if(!s.seen.includes(egg.species))s.seen.push(egg.species);s.eggs=s.eggs.filter(e=>e.id!==egg.id);s.hatches++;return;
  case 'raid':{
    need(!s.raid&&defender&&target!==uid,'Набег недоступен');
    need(defender.shield<=now,'Остров под щитом');
    need(Array.isArray(cmd.team)&&cmd.team.length>=1&&cmd.team.length<=3&&new Set(cmd.team).size===cmd.team.length,'Выберите от одного до трёх драконов');
    const team=cmd.team.map(k=>s.dragons.find(x=>x.id===k));need(team.every(x=>available(s,x,now)),'Дракон занят');
    if(!target.startsWith('npc:'))s.shield=0;
    s.raid={id:id(),boardSize,target,name:defender.name,start:now,team:structuredClone(team),targets:battleMap(defender),commands:[]};return;
  }
  case 'order':{
    const r=s.raid;need(r&&cmd.raid===r.id&&now<r.start+battleSeconds*1000,'Набег закончился');
    need(r.commands.length<400,'Достигнут предел команд');
    const c={action:cmd.order,unit:cmd.unit,target:cmd.mark,shore:cmd.shore,tick:Math.max(0,Math.floor((now-r.start)/tickMs)+1)};
    need(replay(r,now,c).accepted,'Приказ пока недоступен');r.commands.push(c);return;
  }
  case 'finish':{
    const r=s.raid;need(r&&r.id===cmd.raid&&defender&&target===r.target,'Набег уже завершён');
    const sim=replay(r,now), destroyed=sim.targets.filter(t=>t.hp===0),loot={gold:0,food:0};
    const npc=target.startsWith('npc:');
    if(npc||defender.shield<=now)for(const t of destroyed.filter(t=>['gold','food'].includes(t.kind))){
      const store=defender.buildings.find(b=>b.id===t.id&&b.kind===t.kind);if(!store)continue;
      const amount=Math.min(Math.floor(.8*Math.min(t.stock,store.stock)),room(s,t.kind));
      change(s,t.kind,amount);store.stock-=amount;loot[t.kind]+=amount;
    }
    const report={id:r.id,time:now,enemy:r.name,reason:sim.end||'Добровольный отход',destroyed:destroyed.map(t=>t.kind),loot};
    s.reports=[report,...s.reports].slice(0,40);
    if(!npc){if(loot.gold+loot.food)defender.shield=now+limits.shield;defender.reports=[{...report,enemy:s.name,incoming:true},...defender.reports].slice(0,40);}
    sim.units.filter(u=>u.hp<=0).forEach(u=>{s.dragons.find(d=>d.id===u.id).recover=now+limits.recovery;});
    if(destroyed.length)s.sorties++;s.raid=null;return report;
  }
  default:throw new Error('Неизвестное действие');
  }
}
