/* Прогрессия острова: node phagi/dragons/dev/progression.js [--md файл]
   1) таблица «уровень острова → что открывает → предел драконов → бои похода по силам» из правил economy.js и campaign.js;
   2) прогон обычной игры: простой игрок-бот каждый день повторяет N карточек и делает очевидное (собирает сундуки, сажает
      и собирает урожай, кормит самого младшего, строит открытые среды и фермы, ставит пару в Гнездовье, вылупляет).
      Считаются часы острова K (карточки), когда остров доходит до уровня и драконы до уровней 5, 10, 15, 20.
   Это оценка поведения бота, а не обещание игроку: живой игрок делает другое, и день с меньше чем 15 карточками
   паёк и серию не даёт. Числа экономики здесь не меняются. */
'use strict';
const path=require('path'),fs=require('fs'),dir=path.join(__dirname,'..');
global.DRG=require(dir+'/genetics.js');const G=global.DRG,E=require(dir+'/economy.js'),C=require(dir+'/campaign.js');

function bot(perDay,days){
  const founders=[{id:'d1',name:'Ж',born:'2026-01-01',genome:G.make({sex:'F',E:'F/e'}),lvl:1,fed:0},{id:'d2',name:'П',born:'2026-01-01',genome:G.make({sex:'M',E:'W/e'}),lvl:1,fed:0}];
  let s=E.normalize(E.startState(founders),0,null),K=0;const dmap={},per=[{from:'2026-01-01',to:null}],reach={},dl={},log=[];
  const day=i=>{const t=new Date(Date.UTC(2026,0,1+i));return t.toISOString().slice(0,10)};
  const ctx=i=>({K,streak:perDay>=15?i+1:0,uid:'bot',today:day(i)});
  const doIt=(i,a)=>{const r=E.apply(s,ctx(i),a);if(r.err)return false;s=r.s;return true};
  const spot=()=>{for(let y=0;y<E.GRID-1;y++)for(let x=0;x<E.GRID-1;x++)if(E.canPlace(s,x,y))return [x,y];return null};
  for(let i=0;i<days;i++){
    K+=perDay;dmap[day(i)]=perDay;
    s=E.normalize(s,K,E.income(dmap,{},per,15));
    for(let guard=0;guard<300;guard++){let did=false;const L=E.level(s);
      s.bld.forEach(b=>{if(b.chest&&!b.build&&E.chestNow(s,b,K)>=1)did=doIt(i,{t:'collect',id:b.id})||did});
      s.bld.forEach(b=>(b.plots||[]).forEach((p,j)=>{if(p&&E.ready(p,K))did=doIt(i,{t:'harvest',id:b.id,plot:j})||did;
        else if(!p&&!b.build){const cr=Object.keys(E.CROPS).filter(k=>E.CROPS[k].unlock<=L&&E.CROPS[k].cost<=s.bal.gold*0.3).pop();if(cr)did=doIt(i,{t:'plant',id:b.id,plot:j,crop:cr})||did}}));
      const young=s.dragons.slice().sort((a,b)=>a.lvl-b.lvl)[0];
      if(young&&young.lvl<E.maxDragonLv(L)&&s.bal.food>=E.feedCost(young.lvl))did=doIt(i,{t:'feed',dragon:young.id})||did;
      /* стройка: Гнездовье и Инкубатор, новые среды, фермы, если хватает золота с запасом */
      /* копит на первую нужную постройку по порядку и не тратит золото на более дешёвые (иначе Гнездовье за 400 не строится никогда) */
      const want=['nest','hatch','farm',...E.HAB_ORDER].filter(k=>{const t=E.TYPES[k];return t.unlock<=L&&!t.gems&&(t.max?E.count(s,t.kind)<t.max:t.kind==='farm'?E.count(s,'farm')<E.maxFarms(L):E.count(s,'hab')<E.maxHabs(L)&&!s.bld.some(b=>b.type===k))});
      const saving=want.length&&s.bal.gold<E.TYPES[want[0]].cost*1.2;
      if(want.length&&!saving){const p=spot();if(p)did=doIt(i,{t:'build',type:want[0],x:p[0],y:p[1]})||did;
        else{const o=E.obstacles(s).sort((a,b)=>E.OBST_KIND[a.kind].gold-E.OBST_KIND[b.kind].gold)[0];if(o&&s.bal.gold>=E.OBST_KIND[o.kind].gold)did=doIt(i,{t:'clear',cell:o.id})||did}}
      /* пара в Гнездовье, яйцо в Инкубатор, вылупление */
      const nest=s.bld.find(b=>b.type==='nest'&&!b.build);
      if(nest){if(nest.pair&&E.ready(nest.pair,K))did=doIt(i,{t:'egg',id:nest.id})||did;
        else if(!nest.pair){const f=s.dragons.find(d=>d.genome.sex==='F'&&d.lvl>=E.BREED_LV),m=s.dragons.find(d=>d.genome.sex==='M'&&d.lvl>=E.BREED_LV);
          if(f&&m)did=doIt(i,{t:'breed',id:nest.id,mother:f.id,father:m.id})||did}}
      const hb=s.bld.find(b=>b.type==='hatch'&&!b.build);
      if(hb)(hb.slots||[]).forEach((eg,j)=>{if(eg&&E.ready(eg,K))did=doIt(i,{t:'hatch',id:hb.id,plot:j})||did});
      if(!did)break}
    const L=E.level(s);for(let k=2;k<=L;k++)if(!reach[k])reach[k]={K,day:i+1};
    const mx=Math.max(...s.dragons.map(d=>d.lvl));[5,10,15,20].forEach(v=>{if(mx>=v&&!dl[v])dl[v]={K,day:i+1}});
    if(i%30===29)log.push({day:i+1,K,L,dragons:s.dragons.length,mx})}
  return {reach,dl,log,s}}

const PROFILES=[15,30,60];
function md(){
  const runs=PROFILES.map(n=>({n,r:bot(n,365)}));
  const fmtK=r=>r?`${r.day}-й день (${r.K} к.)`:'не за год';
  let out=`# Прогрессия острова драконов\n\nСгенерировано \`node phagi/dragons/dev/progression.js --md\`. Числа экономики взяты из economy.js как есть, здесь ничего не меняется.\n\n`+
    `Три шкалы разные. Уровень острова растёт от опыта за стройку, кормление и урожай и открывает постройки и предел роста драконов. Уровень дракона растёт кормлением (${E.FEEDS} кормления на уровень) и не может обогнать предел острова. Поход требует уровней драконов: у каждого боя рекомендуемый уровень дракона, уровень острова на бой не влияет. Время на острове идёт в карточках (к. в таблице — повторённые карточки), часы не считаются.\n\n`+
    `## Уровень острова\n\nПоследние столбцы — день, когда бот, повторяющий 15, 30 или 60 карточек в день, дошёл до уровня, и сколько карточек к этому дню повторено. Дневной паёк корма идёт за день с 15+ карточками, поэтому при 60 карточках в день уровень приходит раньше по дням, но позже по счёту карточек. Это поведение простого бота, а не обещание: живой игрок может идти и быстрее, и медленнее.\n\n`+
    `| Уровень | Опыт | Что открывает | Драконы до | Бои похода по силам | 15 в день | 30 в день | 60 в день |\n|---|---|---|---|---|---|---|---|\n`;
  for(let L=1;L<=20;L++){const cap=E.maxDragonLv(L),ns=C.NODES.filter(n=>n.rec<=cap),last=ns[ns.length-1];
    out+=`| ${L} | ${E.xpFor(L)} | ${L===1?'старт: Кальдера, Лагуна, ферма, Огнеплодник':E.unlocksAt(L).join('; ')||'—'} | ${cap} | ${last?`до «${last.name}» (${ns.length} из 32)`:'—'} | ${L===1?'0':fmtK(runs[0].r.reach[L])} | ${L===1?'0':fmtK(runs[1].r.reach[L])} | ${L===1?'0':fmtK(runs[2].r.reach[L])} |\n`}
  out+=`\nПосле 12-го уровня новых построек нет: уровни дают только места под среды (раз в два уровня) и фермы (раз в три). Это пустые ступени, о которых говорится в ревью. Менять кривую опыта без решения владельца я не стал: на странице «Ещё» теперь честно сказано, что откроет следующий уровень и какие цели остаются (поход, светлые и тёмные драконы, редкие окрасы).\n\n`+
    `Что показал прогон. Больше всего опыта даёт кормление (четверть цены корма), потом урожай (десятая часть). Поэтому остров обгоняет драконов: при 15 карточках в день 9-й уровень острова, после которого драконы растут до 20-го, приходит на ${runs[0].r.reach[9]?runs[0].r.reach[9].day:'?'}-й день, а самый сильный дракон бота доходит до 20-го уровня только на ${runs[0].r.dl[20]?runs[0].r.dl[20].day:'?'}-й. Уровень острова ограничен 60-м, бот доходит до него на ${runs.map(({r})=>r.reach[60]?r.reach[60].day:'—').join('-й, ')}-й день при ${PROFILES.join(', ')} карточках в день соответственно; уровни с 21-го по 60-й ничего нового не дают.\n\n`+
    `## Уровень дракона\n\n| Уровень дракона | Стадия | Цена кормления | Корма на уровень | Нужен остров |\n|---|---|---|---|---|\n`;
  const stage=l=>l<3?'малыш':l<8?'подросток':l<15?'взрослый':'старший';
  for(const l of [1,2,3,5,8,10,12,15,18,19]){const isl=[...Array(20)].map((_,i)=>i+1).find(L=>E.maxDragonLv(L)>l);out+=`| ${l} → ${l+1} | ${stage(l)} | ${E.feedCost(l)} 🌾 | ${E.feedCost(l)*E.FEEDS} 🌾 | ${isl||'—'}-й |\n`}
  out+=`\nКогда самый сильный дракон бота дошёл до уровня (бот кормит самого младшего, поэтому драконы растут ровно):\n\n| Карточек в день | 5-й | 10-й | 15-й | 20-й |\n|---|---|---|---|---|\n${runs.map(({n,r})=>`| ${n} | ${[5,10,15,20].map(v=>fmtK(r.dl[v])).join(' | ')} |`).join('\n')}\n\n`+
    `## Поход\n\n| Регион | Бои | Рекомендуемый уровень драконов | Нужен остров |\n|---|---|---|---|\n`;
  C.REGIONS.forEach(r=>{const ns=C.nodesOf(r.id),a=ns[0].rec,b=ns[7].rec,isl=L=>[...Array(20)].map((_,i)=>i+1).find(x=>E.maxDragonLv(x)>=L);out+=`| ${r.name} | 8 | ${a}–${b} | ${isl(a)}–${isl(b)}-й |\n`});
  out+=`\nПредположения прогона: стартовый остров с двумя основателями, бот собирает всё в тот же день, кормит самого младшего дракона, сажает самую дорогую культуру, на которую хватает трети золота, строит по одной среде каждого вида, Гнездовье, Инкубатор и фермы, ставит в пару первых взрослых самку и самца, на рынке не покупает, участки не открывает, самоцветы не тратит. Режим драконов включён все дни.\n`;
  return {out,runs}}
if(require.main===module){const {out,runs}=md();runs.forEach(({n,r})=>console.log(n,'в день:',JSON.stringify(r.log.map(x=>[x.day,x.L,x.mx,x.dragons]))));
  const i=process.argv.indexOf('--md');if(i>0){const f=process.argv[i+1]||path.join(dir,'PROGRESSION-RU.md');fs.writeFileSync(f,out);console.log('таблица:',f)}}
module.exports={bot,md};
