/* Прогон экономики Драконов 6.0: бот играет при разной активности и считает, за сколько дней лучший дракон
   доходит до 10, 20, 30 и 40-го уровня. Уровень зависит только от корма, поэтому меряется активностью.
   node phagi/dragons/dev/balance6.js [дней] [--md]  (с --md пишет таблицы в ECONOMY6-RU.md)
   Бот: заходит на остров несколько раз в день, улучшает Казну и Амбар, когда они почти полны, строит Инкубатор,
   Гнездовье, Академию и фермы, сажает самую выгодную культуру на всё золото сверх запаса на улучшение,
   кормит сначала лучшего дракона, тратит минуты ускорения на самую долгую работу. Налётов и ДЗ нет:
   это доход от одних карточек и ферм. */
'use strict';
const D=require('../eco6.js'),fs=require('fs'),path=require('path');
const DAYS=+process.argv[2]||180,MD=process.argv.includes('--md');
const day0=Date.parse('2026-11-01T06:00:00Z'),dstr=i=>new Date(day0+i*D.DAY).toISOString().slice(0,10);
const PROFILES=[
  {name:'15 карточек в день',cards:15,visits:2},
  {name:'30 карточек в день',cards:30,visits:3},
  {name:'60 карточек в день',cards:60,visits:4},
  {name:'очень активно: 150 карточек, заходит каждый час',cards:150,visits:14}];
function freeSpot(s){for(let x=1;x+2<=D.GRID-1;x+=3)for(let y=1;y+2<=D.GRID-1;y+=3)if(!s.bld.some(b=>x<b.x+2&&b.x<x+2&&y<b.y+2&&b.y<y+2))return {x,y};return null}
function run(P){let s=D.startState('bot','2026-11-01',day0,0);const days={},reach={},snap={};let lost=0;
  const act=(c,a)=>{const r=D.apply(s,c,a);if(r.err)return false;s=r.s;if(r.cards)lost+=r.cards.lost;return true};
  for(let i=0;i<DAYS;i++){
    for(let v=1;v<=P.visits;v++){const now=day0+i*D.DAY+v*(16/P.visits)*D.HOUR;days[dstr(i)]=Math.round(P.cards*v/P.visits);
      const c={now,today:dstr(i),uid:'bot',days,hw:[]};const tk=D.tick(s,c);s=tk.s;lost+=tk.cards.lost;const L=D.level(s);
      let reserve=0;
      ['treasury','granary'].forEach(t=>{const b=s.bld.find(x=>x.type===t),u=D.TYPES[t].lv[b.lvl];if(!u)return;
        const full=t==='treasury'?s.bal.gold>0.7*D.capGold(s):s.bal.food>0.8*D.capFood(s);if(full&&!act(c,{t:'upgrade',id:b.id})&&t==='treasury')reserve=Math.max(reserve,u.cost)});
      ['hatchery','nest','academy'].forEach(t=>{if(!s.bld.some(b=>b.type===t)){const sp=freeSpot(s);if(sp)act(c,{t:'build',type:t,x:sp.x,y:sp.y})}});
      if(s.bld.filter(b=>b.type==='farm').length<D.farmsMax(L)){const sp=freeSpot(s);if(sp)act(c,{t:'build',type:'farm',x:sp.x,y:sp.y})}
      s.bld.filter(b=>b.type==='farm'&&!b.job&&(b.lvl||1)<4&&s.bal.gold>3*D.TYPES.farm.lv[b.lvl].cost).forEach(b=>act(c,{t:'upgrade',id:b.id}));
      const homeless=s.dragons.find(d=>!d.home);if(homeless){const sp=freeSpot(s);if(sp)act(c,{t:'build',type:'h'+D.elementsOf(homeless.g)[0],x:sp.x,y:sp.y})}
      s.eggs.slice().forEach(e=>act(c,{t:'incubate',egg:e.id}));
      const best=Object.entries(D.CROPS).filter(([k,x])=>L>=x.L).sort((a,b)=>b[1].food/b[1].gold-a[1].food/a[1].gold);
      s.bld.filter(b=>b.type==='farm').forEach(b=>{for(let k=0;k<6;k++){const cr=best.find(([id,x])=>s.bal.gold-x.gold>=reserve&&x.h*D.HOUR<=24*D.HOUR);if(!cr||!act(c,{t:'plant',farm:b.id,crop:cr[0]}))break}});
      const byPow=s.dragons.slice().sort((a,b)=>b.lvl-a.lvl||D.power(b)-D.power(a));
      if(s.bld.some(b=>b.type==='academy'&&!b.job))byPow.forEach(d=>{if(!act(c,{t:'study',dragon:d.id})&&d.acad.b>=4){act(c,{t:'study',dragon:d.id,el:D.elementsOf(d.g)[0]})||act(c,{t:'study',dragon:d.id,el:'asp'})}});
      const nest=s.bld.find(b=>b.type==='nest'&&!b.job),fm=s.dragons.filter(d=>d.g.sex==='F'&&!d.job&&d.lvl>=5),ml=s.dragons.filter(d=>d.g.sex==='M'&&!d.job&&d.lvl>=5);
      if(nest&&fm.length&&ml.length&&s.dragons.length<10)act(c,{t:'breed',m:fm[0].id,f:ml[0].id});
      for(let k=0;k<200;k++){const d=s.dragons.slice().sort((a,b)=>b.lvl-a.lvl).find(x=>x.lvl<D.LVL_MAX);if(!d||!act(c,{t:'feed',dragon:d.id}))break}
      const jobs=D.jobsOf(s).sort((a,b)=>D.jobLeft(b.j,now)-D.jobLeft(a.j,now));
      if(jobs.length&&s.bal.spd>0){const x=jobs[0];act(c,{t:'speed',target:x.d?{d:x.d.id}:x.b.slots&&x.b.slots.includes(x.j)?{b:x.b.id,slot:x.b.slots.indexOf(x.j)}:{b:x.b.id}})}
      const top=Math.max(...s.dragons.map(d=>d.lvl));[10,20,30,40].forEach(l=>{if(top>=l&&reach[l]==null)reach[l]=+(i+v/P.visits).toFixed(1)});
    }
    if([7,30,90,180].includes(i+1))snap[i+1]={L:D.level(s),tr:s.bld.find(b=>b.type==='treasury').lvl,lost:Math.round(lost)}}
  return {P,reach,snap}}
const res=PROFILES.map(run);
const dd=x=>x==null?`больше ${DAYS}`:x<1?'меньше дня':String(x).replace('.',',');
let out=`# Экономика Драконов 6.0: прогон бота\n\nСгенерировано \`node phagi/dragons/dev/balance6.js ${DAYS} --md\`. Числа из \`eco6.js\` как есть. Уровень дракона зависит только от корма: корм дают карточки, фермы (за золото) и бои. Бот без налётов и ДЗ, поэтому это нижняя граница.\n\n`;
out+=`## За сколько дней лучший дракон доходит до уровня\n\n| Активность | 10-й | 20-й | 30-й | 40-й |\n|---|---|---|---|---|\n`;
res.forEach(r=>{out+=`| ${r.P.name} | ${[10,20,30,40].map(l=>dd(r.reach[l])).join(' | ')} |\n`});
out+=`\nКорма до уровня: до 10-го ${D.foodTo(1,10)}, до 20-го ${D.foodTo(1,20)}, до 30-го ${D.foodTo(1,30)}, до 40-го ${D.foodTo(1,40)}.\n\n`;
const cols=Object.keys(res[0].snap);
const tbl=(t,f)=>{out+=`## ${t}\n\n| Активность | ${cols.map(c=>c+' дн.').join(' | ')} |\n|---|${cols.map(()=>'---').join('|')}|\n`;res.forEach(r=>{out+=`| ${r.P.name} | ${cols.map(c=>f(r.snap[c])).join(' | ')} |\n`});out+='\n'};
tbl('Уровень острова',x=>x.L);tbl('Уровень Казны',x=>x.tr);tbl('Золото, не поместившееся в Казну (всего)',x=>x.lost);
console.log(out);if(MD)fs.writeFileSync(path.join(__dirname,'..','ECONOMY6-RU.md'),out);
