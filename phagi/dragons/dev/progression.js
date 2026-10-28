/* Прогрессия острова (этап D): node phagi/dragons/dev/progression.js [--md файл] [дней]
   1) таблицы из правил economy.js и campaign.js: уровни острова 1–100 (что открывают, предел драконов, постройки),
      уровни драконов 1–60 (цена кормления, нужен остров), регионы похода (рекомендуемые уровни, нужен остров);
   2) прогон ботов: каждый день N карточек (15, 30, 60), два стиля игры.
      «Собиратель» строит все среды и фермы, открывает землю, улучшает дома и фермы, кормит самого младшего (догоняющий рост).
      «Заводчик» держит Гнездовье и Инкубатор занятыми, улучшает их, кормит самого сильного, остальное строит по остатку.
      Оба собирают сундуки и урожай в тот же день, на рынке не покупают, поход не проходят, самоцветы не тратят.
   Это оценка поведения ботов, а не обещание: живой игрок делает другое. Числа экономики здесь не меняются. */
'use strict';
const path=require('path'),fs=require('fs'),dir=path.join(__dirname,'..');
global.DRG=require(dir+'/genetics.js');const G=global.DRG,E=require(dir+'/economy.js'),C=require(dir+'/campaign.js');
const GOAL=15;
function bot(perDay,days,style){
  /* perDay — число или функция дня: профиль с пропусками */
  const nOf=typeof perDay==='function'?perDay:()=>perDay;
  const founders=[{id:'d1',name:'Ж',born:'2026-01-01',genome:G.make({sex:'F',E:'F/e'}),lvl:1,fed:0},{id:'d2',name:'П',born:'2026-01-01',genome:G.make({sex:'M',E:'W/e'}),lvl:1,fed:0}];
  let s=E.startState(founders,0),K=0;const dmap={},per=[{from:'2026-01-01',to:null}],reach={},dl={},log=[];let gold=0;const goldAt={};let hyb=null;
  const day=i=>{const t=new Date(Date.UTC(2026,0,1+i));return t.toISOString().slice(0,10)};
  let inc=null;
  const ctx=i=>({K,inc,streak:i+1,uid:'bot',today:day(i)});
  const doIt=(i,a)=>{const r=E.apply(s,ctx(i),a);if(r.err)return false;s=r.s;return true};
  const spot=()=>{for(let y=0;y<E.GRID-1;y++)for(let x=0;x<E.GRID-1;x++)if(E.canPlace(s,x,y))return [x,y];return null};
  const breeder=style==='breed';
  for(let i=0;i<days;i++){
    const nd=nOf(i);K+=nd;if(nd)dmap[day(i)]=nd;
    inc=E.income(dmap,{},per,GOAL,{K:0});inc.streakBest=i+1;s=E.normalize(s,K,inc);
    for(let guard=0;guard<400;guard++){let did=false;const L=E.level(s);
      s.bld.forEach(b=>{if(b.chest&&!b.build&&E.chestNow(s,b,K,inc.gk)>=1){const g0=s.bal.gold;if(doIt(i,{t:'collect',id:b.id})){gold+=s.bal.gold-g0;did=true}}});
      s.bld.forEach(b=>(b.plots||[]).forEach((p,j)=>{if(p&&E.ready(p,K))did=doIt(i,{t:'harvest',id:b.id,plot:j})||did;
        else if(!p&&!b.build){const cr=Object.keys(E.CROPS).filter(k=>E.CROPS[k].unlock<=L&&E.CROPS[k].cost<=s.bal.gold*0.3).pop();if(cr)did=doIt(i,{t:'plant',id:b.id,plot:j,crop:cr})||did}}));
      /* кормление: собиратель — самого младшего (догоняющая цена), заводчик — самого сильного */
      const cap=E.maxDragonLv(L),order=s.dragons.filter(d=>d.lvl<cap).sort((a,b)=>breeder?b.lvl-a.lvl:a.lvl-b.lvl);
      const fd=order[0];if(fd&&s.bal.food>=E.feedPrice(s,fd).cost)did=doIt(i,{t:'feed',dragon:fd.id})||did;
      /* пара в Гнездовье, яйцо, вылупление: дракон без дома идёт в ясли, ясли полны — пара не ставится */
      const nest=s.bld.find(b=>b.type==='nest'&&!b.build);
      if(nest){if(nest.pair&&E.ready(nest.pair,K))did=doIt(i,{t:'egg',id:nest.id})||did;
        else if(!nest.pair&&(breeder||s.dragons.length<4+L/4)){const f=s.dragons.filter(d=>d.genome.sex==='F'&&d.lvl>=E.BREED_LV).sort((a,b)=>b.lvl-a.lvl)[0],m=s.dragons.filter(d=>d.genome.sex==='M'&&d.lvl>=E.BREED_LV).sort((a,b)=>b.lvl-a.lvl)[0];
          if(f&&m)did=doIt(i,{t:'breed',id:nest.id,mother:f.id,father:m.id})||did}}
      s.bld.filter(b=>b.type==='hatch'&&!b.build).forEach(hb=>(hb.slots||[]).forEach((eg,j)=>{if(eg&&E.ready(eg,K))did=doIt(i,{t:'hatch',id:hb.id,plot:j})||did}));
      /* стройка: копит на первую нужную постройку по порядку */
      const want=(breeder?['farm',...E.HAB_ORDER]:[...E.HAB_ORDER,'farm']).filter(k=>{const t=E.TYPES[k];if(t.unlock>L||t.gems)return false;
        return t.kind==='farm'?E.count(s,'farm')<E.maxFarms(L):E.count(s,'hab')<E.maxHabs(L)&&(!s.bld.some(b=>b.type===k)||!breeder&&E.count(s,'hab')>=7)});
      const cost=k=>E.buildCost(s,k).gold;
      if(want.length&&s.bal.gold>=cost(want[0])*1.1){const p=spot();if(p)did=doIt(i,{t:'build',type:want[0],x:p[0],y:p[1]})||did;
        else{const o=E.obstacles(s).sort((a,b)=>E.OBST_KIND[a.kind].gold-E.OBST_KIND[b.kind].gold)[0];
          if(o&&s.bal.gold>=E.OBST_KIND[o.kind].gold)did=doIt(i,{t:'clear',cell:o.id})||did;
          else{const ch=E.allChunks().filter(c=>E.landState(s,c).ok).sort((a,b)=>(E.LAND_COST[a].gold||0)-(E.LAND_COST[b].gold||0))[0];if(ch&&s.bal.gold>=(E.LAND_COST[ch].gold||0)*1.1)did=doIt(i,{t:'expand',chunk:ch})||did}}}
      /* улучшения: заводчик — Инкубатор и Гнездовье первыми, собиратель — дома и фермы */
      const ups=s.bld.filter(b=>!b.build&&!b.up).filter(b=>{const T=b.type==='hatch'?E.HATCH_LV:b.type==='farm'?E.FARM_LV:E.TYPES[b.type]&&E.TYPES[b.type].kind==='hab'?E.HAB_LV:null;const nx=T&&T[b.lvl+1];return nx&&(!nx.L||nx.L<=L)&&s.bal.gold>=nx.cost*1.5})
        .sort((a,b)=>(breeder?(b.type==='hatch')-(a.type==='hatch'):(a.type==='hatch')-(b.type==='hatch'))||a.lvl-b.lvl);
      if(ups[0]&&!want.length)did=doIt(i,{t:'upgrade',id:ups[0].id})||did;
      E.RESEARCH.forEach(g=>{if(!(s.goals||{})[g.id]&&g.L<=L&&g.ok(s))did=doIt(i,{t:'research',goal:g.id})||did});
      if(!did)break}
    const L=E.level(s);for(let k=2;k<=L;k++)if(!reach[k])reach[k]={K,day:i+1};
    const mx=Math.max(...s.dragons.map(d=>d.lvl));[5,10,20,30,40,50,60].forEach(v=>{if(mx>=v&&!dl[v])dl[v]={K,day:i+1}});
    if(!hyb&&s.dragons.some(d=>G.phenotype(d.genome).elements.length>=2))hyb={K,day:i+1};
    if([30,90,180,365,730].includes(i+1))goldAt[i+1]=gold;
    if(i%30===29)log.push({day:i+1,K,L,dragons:s.dragons.length,mx})}
  return {reach,dl,log,s,goldAt,hyb}}

const PROFILES=[15,30,60],STYLES=[['coll','собиратель'],['breed','заводчик']];
function md(days){
  days=days||730;
  const runs=[];PROFILES.forEach(n=>STYLES.forEach(([st,nm])=>runs.push({n,st,nm,r:bot(n,days,st)})));
  /* пропуски: 30 карточек пять дней в неделю, два дня ничего */
  runs.push({n:'30 с пропусками',st:'coll',nm:'собиратель',r:bot(i=>i%7<5?30:0,days,'coll')});
  const R=(n,st)=>runs.find(x=>x.n===n&&x.st===st).r;
  const fmtD=r=>r?`${r.day}-й д.`:'—';
  let out=`# Прогрессия острова драконов (этап D)\n\nСгенерировано \`node phagi/dragons/dev/progression.js --md\` (прогон ${days} дней). Числа экономики взяты из economy.js как есть.\n\n`+
    `Время на острове идёт в карточках. Боты каждый день повторяют 15, 30 или 60 карточек. «Собиратель» строит все среды и фермы, открывает землю и кормит самого младшего дракона (догоняющая цена вдвое ниже). «Заводчик» держит Гнездовье и Инкубатор занятыми и кормит самого сильного. Оба собирают всё в тот же день, на рынке не покупают, поход не проходят, самоцветы не тратят. Это поведение ботов, а не обещание игроку.\n\n`+
    `## Золото по объёму\n\nЗолото, собранное из сундуков к дню (собиратель). Золото за карточку вдвое выше прежнего, а лесенка дня даёт ×1,15 с 16-й карточки, ×1,3 с 31-й, ×1,5 с 61-й и ×1,6 после 120-й.\n\n| Карточек в день | 30 дней | 90 дней | 180 дней | 365 дней |\n|---|---|---|---|---|\n`+
    PROFILES.map(n=>{const g=R(n,'coll').goldAt;return `| ${n} | ${[30,90,180,365].map(d=>g[d]!=null?Math.round(g[d]).toLocaleString('ru-RU'):'—').join(' | ')} |`}).join('\n')+'\n\n'+
    `## Уровень острова 1–100\n\n| Уровень | Опыт | Что открывает | Драконы до | Сред / ферм | ${PROFILES.map(n=>n+' в день').join(' | ')} |\n|---|---|---|---|---|${PROFILES.map(()=>'---').join('|')}|\n`;
  for(let L=1;L<=E.ISLE_MAX;L++){const u=L===1?['старт: Гнездовье и Инкубатор готовы, Кальдера, Лагуна, ферма']:E.unlocksAt(L);
    out+=`| ${L} | ${E.xpFor(L)} | ${u.join('; ')||'—'} | ${E.maxDragonLv(L)} | ${E.maxHabs(L)} / ${E.maxFarms(L)} | ${PROFILES.map(n=>L===1?'0':fmtD(R(n,'coll').reach[L])).join(' | ')} |\n`}
  out+=`\nДни в последних столбцах для собирателя. Профиль «30 с пропусками» (пять дней по 30 карточек и два дня без повторения в неделю): ${[20,40,60,80,100].map(L=>L+'-й '+fmtD(runs[runs.length-1].r.reach[L])).join(', ')}. «—» значит, что бот за ${days} дней до уровня не дошёл.\n\n`+
    `## Уровень дракона 1–60\n\n| Уровень | Цена кормления | Догоняющая цена | Корма на уровень | Нужен остров | Мастерство |\n|---|---|---|---|---|---|\n`;
  const isl=l=>{for(let L=1;L<=E.ISLE_MAX;L++)if(E.maxDragonLv(L)>l)return L;return null};
  for(let l=1;l<E.DRAGON_MAX;l++){if(l>5&&l%5&&l!==19&&l!==21)continue;const c=E.feedCost(l);
    out+=`| ${l} → ${l+1} | ${c} 🌾 | ${Math.ceil(c*E.ECON.catchUp.k)} 🌾 | ${c*E.FEEDS} 🌾 | ${isl(l)||'—'}-й | ${l+1>20?E.mastery(l+1)||'—':'—'} |\n`}
  out+=`\nДогоняющая цена действует, когда дракон отстаёт от самого сильного на ${E.ECON.catchUp.gap}+ уровней.\n\nКогда самый сильный дракон дошёл до уровня:\n\n| Профиль | 5-й | 10-й | 20-й | 30-й | 40-й | 50-й | 60-й | первый гибрид |\n|---|---|---|---|---|---|---|---|---|\n`+
    runs.map(({n,nm,r})=>`| ${n} в день, ${nm} | ${[5,10,20,30,40,50,60].map(v=>fmtD(r.dl[v])).join(' | ')} | ${fmtD(r.hyb)} |`).join('\n')+'\n\n'+
    `Остров к концу прогона:\n\n| Профиль | Уровень острова | Драконов | Сильнейший | Построек |\n|---|---|---|---|---|\n`+
    runs.map(({n,nm,r})=>`| ${n} в день, ${nm} | ${E.level(r.s)} | ${r.s.dragons.length} | ${Math.max(...r.s.dragons.map(d=>d.lvl))} | ${r.s.bld.length} |`).join('\n')+'\n\n'+
    `## Поход: 160 боёв\n\n| Регион | Бои | Рекомендуемый уровень | Нужен остров | Мини-босс | Босс |\n|---|---|---|---|---|---|\n`;
  const islFor=l=>{for(let L=1;L<=E.ISLE_MAX;L++)if(E.maxDragonLv(L)>=l)return L;return null};
  C.REGIONS.forEach(r=>{const ns=C.nodesOf(r.id),a=Math.min(...ns.map(n=>n.rec)),b=Math.max(...ns.map(n=>n.rec)),mi=ns.find(n=>n.mini),bo=ns.find(n=>n.boss);
    out+=`| ${r.name} | ${ns.length} | ${a}–${b} | ${islFor(a)}–${islFor(b)}-й | ${mi.name} (${mi.rec}) | ${bo.name} (${bo.rec}) |\n`});
  out+=`\nВ каждом регионе 8 обычных боёв, 4 испытания (вдвоём, один на один, разные стихии, без стихии), 2 элитных боя, мини-босс и босс. За первую победу над мини-боссом дарят дракона, носителя гена E2. Первый подарок (мини-босс «Осыпь у вулкана», рекомендуемый уровень 9) доступен, когда драконы доходят до 9–10-го уровня: у ботов это ${runs.filter(x=>x.st==='coll'&&typeof x.n==='number').map(x=>x.n+' в день — '+fmtD(x.r.dl[10])).join(', ')}. Боты поход не проходят, поэтому линию E2 у них не считаем.\n`;
  return {out,runs}}
if(require.main===module){const dn=+process.argv.find(x=>/^\d+$/.test(x))||730,{out,runs}=md(dn);
  runs.forEach(({n,nm,r})=>console.log(n,nm,JSON.stringify(r.log.filter((x,i)=>i%3===2).map(x=>[x.day,x.L,x.mx,x.dragons]))));
  const i=process.argv.indexOf('--md');if(i>0){const f=process.argv[i+1]&&!/^\d+$/.test(process.argv[i+1])?process.argv[i+1]:path.join(dir,'PROGRESSION-RU.md');fs.writeFileSync(f,out);console.log('таблица:',f)}}
module.exports={bot,md};
