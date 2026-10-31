/* Прогон экономики Драконов 6.0: бот играет N дней при 15, 30 и 60 карточках в день.
   node phagi/dragons/dev/balance6.js [дней] [--md]  (с --md пишет таблицы в ECONOMY6-RU.md)
   Бот простой и жадный: улучшает Казну и Амбар, когда они почти полны, строит Инкубатор, Гнездовье и Академию,
   как только они открываются, ставит жилища, кормит самого слабого дракона, отправляет учиться, тратит минуты
   ускорения на самую долгую работу. Налётов и ДЗ нет: это нижняя граница дохода от одних карточек. */
'use strict';
const D=require('../eco6.js'),fs=require('fs'),path=require('path');
const DAYS=+process.argv[2]||180,MD=process.argv.includes('--md');
const day0=Date.parse('2026-11-01T08:00:00Z'),dstr=i=>new Date(day0+i*D.DAY).toISOString().slice(0,10);
function run(per){let s=D.startState('bot','2026-11-01',day0,0);const days={},snap={},lost={gold:0};let firstAcad=null,firstEgg=null;
  const act=(c,a)=>{const r=D.apply(s,c,a);if(!r.err){s=r.s;if(r.cards)lost.gold+=r.cards.lost;return true}return false};
  for(let i=0;i<DAYS;i++){
    /* карточки идут тремя порциями за день, между ними бот заходит на остров */
    for(let p=1;p<=3;p++){const now=day0+i*D.DAY+p*4*D.HOUR;days[dstr(i)]=Math.round(per*p/3);const c={now,today:dstr(i),uid:'bot',days,hw:[]};
      const tk=D.tick(s,c);s=tk.s;lost.gold+=tk.cards.lost;
      const L=D.level(s);
      ['treasury','granary'].forEach(t=>{const b=s.bld.find(x=>x.type===t);const full=t==='treasury'?s.bal.gold>0.8*D.capGold(s):s.bal.food>0.8*D.capFood(s);if(full)act(c,{t:'upgrade',id:b.id})});
      ['hatchery','nest','academy'].forEach(t=>{if(!s.bld.some(b=>b.type===t)){const sp=freeSpot(s);if(sp)act(c,{t:'build',type:t,x:sp.x,y:sp.y})}});
      const homeless=s.dragons.find(d=>!d.home);if(homeless){const e=D.elementsOf(homeless.g)[0],sp=freeSpot(s);if(sp&&act(c,{t:'build',type:'h'+e,x:sp.x,y:sp.y})){}}
      s.eggs.slice().forEach(e=>act(c,{t:'incubate',egg:e.id}));
      const ac=s.bld.find(b=>b.type==='academy'&&!b.job);if(ac)s.dragons.slice().sort((a,b)=>b.lvl-a.lvl).forEach(d=>{if(act(c,{t:'study',dragon:d.id})&&!firstAcad)firstAcad=i+1;else if(d.acad.b>=4)act(c,{t:'study',dragon:d.id,el:D.elementsOf(d.g)[0]})});
      const nest=s.bld.find(b=>b.type==='nest'&&!b.job),fs_=s.dragons.filter(d=>d.g.sex==='F'&&!d.job&&d.lvl>=5),ms=s.dragons.filter(d=>d.g.sex==='M'&&!d.job&&d.lvl>=5);
      if(nest&&fs_.length&&ms.length&&s.dragons.length<12&&act(c,{t:'breed',m:fs_[0].id,f:ms[0].id})&&!firstEgg)firstEgg=i+1;
      const team=s.dragons.slice().sort((a,b)=>D.power(b)-D.power(a)).slice(0,5).map(d=>d.id);
      for(let k=0;k<30;k++){const d=s.dragons.filter(x=>team.includes(x.id)).sort((a,b)=>a.lvl-b.lvl)[0];if(!d||s.bal.food<D.feedCost(d.lvl)*2||!act(c,{t:'feed',dragon:d.id}))break}
      const jobs=D.jobsOf(s).sort((a,b)=>D.jobLeft(b.j,now)-D.jobLeft(a.j,now));if(jobs.length&&s.bal.spd>0){const x=jobs[0];const target=x.d?{d:x.d.id}:x.j.kind==='hatch'?{b:x.b.id,slot:x.b.slots.indexOf(x.j)}:{b:x.b.id};act(c,{t:'speed',target})}
    }
    if([7,30,90,180,365].includes(i+1))snap[i+1]={L:D.level(s),dr:s.dragons.length,top:Math.max(...s.dragons.map(d=>d.lvl)),pw:Math.max(...s.dragons.map(D.power)),
      tr:s.bld.find(b=>b.type==='treasury').lvl,gold:Math.round(s.bal.gold),lost:Math.round(lost.gold)}}
  return {per,snap,firstAcad,firstEgg}}
function freeSpot(s){for(let x=1;x+2<=D.GRID-1;x+=3)for(let y=1;y+2<=D.GRID-1;y+=3)if(!s.bld.some(b=>x<b.x+2&&b.x<x+2&&y<b.y+2&&b.y<y+2))return {x,y};return null}
const res=[15,30,60].map(run);
const cols=Object.keys(res[0].snap);
let out=`# Экономика Драконов 6.0: прогон бота\n\nСгенерировано \`node phagi/dragons/dev/balance6.js ${DAYS} --md\`. Бот повторяет 15, 30 или 60 карточек в день, ДЗ и налётов нет. Числа из \`eco6.js\` как есть.\n\n`;
const tbl=(title,f)=>{out+=`## ${title}\n\n| Карточек в день | ${cols.map(c=>c+' дн.').join(' | ')} |\n|---|${cols.map(()=>'---').join('|')}|\n`;res.forEach(r=>{out+=`| ${r.per} | ${cols.map(c=>f(r.snap[c])).join(' | ')} |\n`});out+='\n'};
tbl('Уровень острова',x=>x.L);tbl('Драконов',x=>x.dr);tbl('Самый высокий уровень дракона',x=>x.top);tbl('Самая большая сила',x=>x.pw);tbl('Уровень Казны',x=>x.tr);tbl('Золото, не поместившееся в Казну (всего)',x=>x.lost);
out+=`## Первые события\n\n| Карточек в день | Первый курс Академии | Первое яйцо из Гнездовья |\n|---|---|---|\n`;res.forEach(r=>{out+=`| ${r.per} | ${r.firstAcad?r.firstAcad+'-й день':'нет'} | ${r.firstEgg?r.firstEgg+'-й день':'нет'} |\n`});
console.log(out);if(MD)fs.writeFileSync(path.join(__dirname,'..','ECONOMY6-RU.md'),out);
