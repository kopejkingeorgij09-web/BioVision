/* Драконы 6.0: ядро игры без DOM (план в REWORK-RU.md).
   Работает в браузере (window.DR6) и в node для тестов (node phagi/dragons/eco6.test.js).
   Что здесь: стихии и их круг, генетика стихий по Менделю, сила дракона, Казна и Амбар, реальное время
   с ускорением карточками и самоцветами, доход от карточек и ДЗ, яйца за ДЗ, Академия, скрещивание с прогнозом,
   новый старт с подарком, помощники для налётов (добыча, щит).
   Главное правило дохода: карточки и ДЗ не хранятся в документе острова, они приходят из данных страницы
   (счётчик карточек по дням, оценки ДЗ) и зачисляются разницей с полем cred. Повторный вызов ничего не добавляет.
   Все случайности идут от зерна (ученица + событие), поэтому перезагрузка не перебрасывает кубик. */
(function(root){
'use strict';

/* ---------- случайность с зерном ---------- */
function hash(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19}
  return ()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0}}
function rng(seed){let a=hash(String(seed))();return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const MIN=60000,HOUR=60*MIN,DAY=24*HOUR;

/* ---------- стихии ----------
   Семь стихий. Ни одна не сильнее в целом: высокий доход стихии уравновешен её боевой силой
   (ценность = бой/40 + доход/40 одинакова у всех, проверяет тест). spd — скорость полёта в налёте. */
const ELS=['F','W','T','A','P','L','D'];
const BASIC=['F','W','T','A','P'],LEGEND=['L','D'];
const EL={
  F:{name:'Огонь',  hp:100,atk:16,spd:1.0,gph:40,ab:{id:'blaze', name:'Огненный вал',text:'урон по всем постройкам в круге'}},
  W:{name:'Вода',   hp:130,atk:12,spd:0.9,gph:40,ab:{id:'tide',  name:'Прилив',      text:'лечит драконов отряда рядом'}},
  T:{name:'Земля',  hp:170,atk:10,spd:0.7,gph:39,ab:{id:'stone', name:'Каменная кожа',text:'на время почти не получает урона'}},
  A:{name:'Воздух', hp:90, atk:15,spd:1.4,gph:43,ab:{id:'gust',  name:'Вихрь',       text:'ускоряет отряд рядом'}},
  P:{name:'Флора',  hp:120,atk:10,spd:0.8,gph:45,ab:{id:'vines', name:'Лозы',        text:'опутывают башню, она молчит'}},
  L:{name:'Свет',   hp:110,atk:14,spd:1.1,gph:41,ab:{id:'flash', name:'Ослепление',  text:'башни рядом промахиваются'}},
  D:{name:'Тьма',   hp:80, atk:22,spd:1.2,gph:38,ab:{id:'shade', name:'Тень',        text:'дракон на время невидим для башен'}}
};
const elValue=e=>Math.sqrt(EL[e].hp*EL[e].atk)/40+EL[e].gph/40;
/* круг стихий: каждая сильна против двух следующих, слаба против двух предыдущих, к двум напротив нейтральна */
const RING=['W','F','P','A','T','L','D'];
const beats=(a,b)=>{const d=(RING.indexOf(b)-RING.indexOf(a)+7)%7;return d===1||d===2};
const STRONG=1.5,WEAK=2/3;
const mult=(a,b)=>beats(a,b)?STRONG:beats(b,a)?WEAK:1;
/* удар стихией a по дракону или постройке со стихиями defs: среднее по стихиям цели */
const vs=(a,defs)=>defs&&defs.length?defs.reduce((x,d)=>x+mult(a,d),0)/defs.length:1;
const strongVs=a=>ELS.filter(b=>beats(a,b)),weakVs=a=>ELS.filter(b=>beats(b,a));

/* ---------- генетика стихий ----------
   Геном: {sex:'F'|'M', E:[a,b], E2:[a,b]}. Ген E: аллели семи стихий, все кодоминантны (у гетерозиготы видны обе).
   Ген E2: нейтральный аллель 0 и те же семь стихий, тоже кодоминантны и добавляются к стихиям E.
   Гены не сцеплены: в гамету идёт по одному аллелю каждого гена, независимо (второй закон Менделя).
   Мутация: редко аллель 0 в гамете превращается в стихию (так из обычных родителей иногда выходит редкий потомок). */
const E2_ALL=['0',...ELS];
const MUT=0.01;
function elementsOf(g){const e=[...new Set(g.E)].sort((a,b)=>ELS.indexOf(a)-ELS.indexOf(b));
  const e2=[...new Set(g.E2.filter(x=>x!=='0'&&!e.includes(x)))].sort((a,b)=>ELS.indexOf(a)-ELS.indexOf(b));return e.concat(e2)}
const rarityOf=g=>elementsOf(g).length-1;   /* 0 обычный … 3 мифический */
const RARITY=['обычный','редкий','эпический','мифический'];
const RMULT=[1,1.35,1.8,2.4];
function validGenome(g){return !!g&&(g.sex==='F'||g.sex==='M')&&Array.isArray(g.E)&&g.E.length===2&&g.E.every(x=>ELS.includes(x))&&
  Array.isArray(g.E2)&&g.E2.length===2&&g.E2.every(x=>E2_ALL.includes(x))}
function gamete(g,r){let e2=g.E2[r()<0.5?0:1];if(e2==='0'&&r()<MUT)e2=pick(r,BASIC);return {E:g.E[r()<0.5?0:1],E2:e2}}
function breed(m,f,seed){const r=rng(seed),a=gamete(m,r),b=gamete(f,r);return {sex:r()<0.5?'F':'M',E:[a.E,b.E],E2:[a.E2,b.E2]}}
/* точное распределение стихий потомства (без мутаций): ключ — стихии через «+» */
function dist(m,f){const out={};
  for(const a of m.E)for(const b of f.E)for(const c of m.E2)for(const d of f.E2){
    const k=elementsOf({E:[a,b],E2:[c,d]}).join('+');out[k]=(out[k]||0)+1/16}
  return out}
/* доля потомков с признаком: {t:'has',el} — есть стихия el; {t:'set',key} — ровно этот набор; {t:'rar',n} — эта редкость */
function share(m,f,q){const d=dist(m,f);let p=0;
  for(const [k,v] of Object.entries(d)){const els=k.split('+');
    if(q.t==='has'&&els.includes(q.el))p+=v;else if(q.t==='set'&&k===q.key)p+=v;else if(q.t==='rar'&&els.length-1===q.n)p+=v}
  return p}
const PRED_TOL=0.03;
/* геном с заданными стихиями: первые две в E, остальные в E2 */
function genomeOf(els,sex){const E=els.length===1?[els[0],els[0]]:[els[0],els[1]];const E2=[els[2]||'0',els[3]||'0'];return {sex,E,E2}}
/* случайный геном нужной редкости (яйцо за ДЗ, подарок): Свет и Тьма только у эпических и мифических */
function eggGenome(rar,seed){const r=rng(seed),pool=BASIC.slice();if(rar>=2&&r()<0.5)pool.push(pick(r,LEGEND));
  const els=[];while(els.length<rar+1){const x=pick(r,pool);if(!els.includes(x))els.push(x)}
  return genomeOf(els,r()<0.5?'F':'M')}

/* ---------- имена ---------- */
const NAMES={F:['Уголёк','Пыл','Зной','Искра','Жар'],W:['Капель','Волна','Бриз','Омут','Прибой'],T:['Гранит','Глыба','Кремень','Валун','Сланец'],
  A:['Вихрь','Перо','Облачко','Порыв','Сокол'],P:['Лист','Мох','Побег','Терн','Ясень'],L:['Заря','Луч','Сияние'],D:['Сумрак','Мгла','Полночь']};
const nameFor=(g,seed)=>pick(rng(seed),NAMES[elementsOf(g)[0]]);

/* ---------- уровень и Академия ---------- */
const LVL_MAX=50,FEEDS=4;
const lk=l=>1+0.06*((l||1)-1);                         /* рост характеристик с уровнем: ×3,94 на 50-м */
const feedCost=l=>Math.round(5+3*(l-1)+0.15*(l-1)*(l-1)); /* корм за одно кормление на уровне l */
/* бакалавриат: четыре общих курса по порядку; магистратура: три ступени по каждой стихии дракона */
const BACH=[
  {id:'fly',  name:'Полёт',       text:'+10 % к скорости полёта', lvl:5, gold:400,  h:2},
  {id:'fury', name:'Натиск',      text:'+10 % к атаке',           lvl:10,gold:1200, h:4},
  {id:'armor',name:'Броня',       text:'−10 % получаемого урона', lvl:15,gold:3000, h:8},
  {id:'stam', name:'Выносливость',text:'+10 % к здоровью',        lvl:20,gold:6000, h:12}];
const MAG=[{lvl:25,gold:12000,h:16},{lvl:32,gold:25000,h:24},{lvl:40,gold:50000,h:36}];
const MAG_ATK=0.08;                                    /* ступень магистратуры: +8 % к урону этой стихией и способность на ступень сильнее */
const bachDone=d=>(d.acad&&d.acad.b)||0;
const magRank=(d,e)=>(d.acad&&d.acad.m&&d.acad.m[e])||0;

/* ---------- характеристики и сила ----------
   Сила = база стихий × множитель редкости × рост по уровню × бонус Академии.
   База гибрида — среднее по его стихиям, поэтому стихии не складываются в «самую сильную»: силу даёт редкость. */
function stats(d){const els=elementsOf(d.g),n=els.length,avg=k=>els.reduce((x,e)=>x+EL[e][k],0)/n,b=bachDone(d),k=RMULT[n-1]*lk(d.lvl);
  return {els,rar:n-1,hp:avg('hp')*k*(b>=4?1.1:1),atk:avg('atk')*k*(b>=2?1.1:1),def:b>=3?0.1:0,spd:avg('spd')*(b>=1?1.1:1),
    mag:Object.fromEntries(els.map(e=>[e,magRank(d,e)])),ab:els.map(e=>Object.assign({el:e,rank:1+magRank(d,e)},EL[e].ab))}}
/* урон стихией e с учётом магистратуры */
const atkWith=(d,st,e)=>st.atk*(1+MAG_ATK*magRank(d,e));
function power(d){const s=stats(d),mag=s.els.reduce((x,e)=>Math.max(x,magRank(d,e)),0);
  return Math.round(2*Math.sqrt(s.hp/(1-s.def)*s.atk*(1+MAG_ATK*mag))*(0.9+0.1*s.spd))}
/* золото в час работы: среднее стихий × (1 + 0,25 за каждую стихию сверх первой) × рост по уровню */
function gph(d){const els=elementsOf(d.g);return els.reduce((x,e)=>x+EL[e].gph,0)/els.length*(1+0.25*(els.length-1))*lk(d.lvl)}

/* ---------- постройки ----------
   lv[i] — уровень i+1: cost (золото), h (часы стройки), L (уровень острова). Первый уровень ставится при постройке. */
const CAP_GOLD=[3000,8000,20000,45000,90000,180000,350000,600000];
const CAP_FOOD=[800,2000,5000,12000,25000,50000,90000,150000];
const STORE_UP=[null,{cost:1500,h:1,L:2},{cost:5000,h:3,L:4},{cost:12000,h:6,L:7},{cost:30000,h:12,L:10},{cost:70000,h:24,L:14},{cost:150000,h:36,L:18},{cost:280000,h:48,L:23}];
const TYPES={
  treasury:{name:'Казна',  kind:'store',max:1,center:true,lv:STORE_UP},
  granary: {name:'Амбар',  kind:'store',max:1,center:true,lv:STORE_UP.map(x=>x&&Object.assign({},x,{cost:Math.round(x.cost*0.8)}))},
  nest:    {name:'Гнездовье',kind:'nest',max:1,lv:[null,{cost:4000,h:6,L:6},{cost:20000,h:24,L:15}]},
  hatchery:{name:'Инкубатор',kind:'hatch',max:1,lv:[null,{cost:2500,h:4,L:4},{cost:9000,h:12,L:9},{cost:30000,h:24,L:16}]},
  academy: {name:'Академия',kind:'academy',max:1,lv:[null,{cost:8000,h:12,L:8},{cost:40000,h:36,L:18}]},
  /* жилища стихий: дракон живёт в жилище любой своей стихии и только оттуда приносит золото */
  hF:{name:'Кальдера',kind:'hab',el:'F',build:{cost:300,h:0.5,L:1}},
  hW:{name:'Лагуна',kind:'hab',el:'W',build:{cost:300,h:0.5,L:1}},
  hT:{name:'Утёс',kind:'hab',el:'T',build:{cost:600,h:1,L:2}},
  hA:{name:'Облачный шпиль',kind:'hab',el:'A',build:{cost:900,h:2,L:3}},
  hP:{name:'Роща',kind:'hab',el:'P',build:{cost:900,h:2,L:3}},
  hL:{name:'Храм рассвета',kind:'hab',el:'L',build:{cost:8000,h:12,L:10}},
  hD:{name:'Обсидиановая башня',kind:'hab',el:'D',build:{cost:8000,h:12,L:10}}
};
['hF','hW','hT','hA','hP','hL','hD'].forEach(k=>{const b=TYPES[k].build;TYPES[k].lv=[null,{cost:b.cost*3,h:b.h*4,L:b.L+4},{cost:b.cost*10,h:b.h*12,L:b.L+10},{cost:b.cost*30,h:b.h*24,L:b.L+16}]});
const HAB_CAP=[2,3,4,5];
const HATCH_SLOTS=[1,2,3,4];
const ACAD_SEATS=[1,2,3];
const habsMax=L=>Math.min(12,2+Math.floor(L/3));      /* сколько жилищ можно поставить на уровне острова */
const GRID=24,SIZE=2;
/* центр острова: Казна и Амбар стоят здесь с начала */
const CENTER={treasury:{x:10,y:11},granary:{x:12,y:11}};

/* ---------- уровень острова ---------- */
const ISLE_MAX=30;
const xpFor=L=>L<=1?0:Math.round(60*Math.pow(L-1,1.75));
function levelOf(xp){let L=1;while(L<ISLE_MAX&&xp>=xpFor(L+1))L++;return L}
const dragonCap=L=>Math.min(LVL_MAX,3+2*L);           /* дракон растёт до этого уровня */

/* ---------- доход ----------
   Карточка = 15 минут работы драконов: каждый дракон в своём жилище, который не учится, приносит gph/4 золота.
   Лесенка дня: чем больше карточек за день, тем дороже каждая следующая. 60 карточек дают в 5 с лишним раз больше, чем 15. */
const CARD_MIN=15,GEM_MIN=30;
const LADDER=[[15,1],[30,1.25],[60,1.5],[120,1.75],[Infinity,2]];
const ladder=j=>{for(const [to,k] of LADDER)if(j<=to)return k;return 1};
/* корм за карточку растёт с уровнем острова: драконы взрослеют, им нужно больше */
const cardFood=L=>3+0.5*((L||1)-1);
const CARD_GOLD=5,CARD_XP=2,CHARGE_CARDS=10,CHARGE_MAX=5;
/* ДЗ: самоцветы по баллу, яйцо только от 85 % */
const HW_GEMS=[[95,6],[90,4],[85,3],[80,2],[60,1]];
const hwGems=pc=>{for(const [m,g] of HW_GEMS)if(pc>=m)return g;return 0};
/* шанс яйца «не хуже чем»: при лучшем ДЗ хотя бы редкое 60 %, хотя бы эпическое 40 %, мифическое 20 %.
   От 85 % до 100 % шансы растут линейно от четверти до полных */
const EGG_TOP=[0.6,0.4,0.2];
function eggOdds(pc){if(!(pc>=85))return [0,0,0];const f=0.25+0.75*clamp((pc-85)/15,0,1);return EGG_TOP.map(x=>x*f)}
/* какое яйцо выпало за это ДЗ: 0 — нет, 1 редкое, 2 эпическое, 3 мифическое */
function hwEgg(pc,seed){const o=eggOdds(pc),u=rng(seed)();return u<o[2]?3:u<o[1]?2:u<o[0]?1:0}
const HATCH_H=[1,4,10,24];                            /* часы в Инкубаторе по редкости */
const BREED_H=2,breedCost=(a,b)=>100*(1+a+b);

/* ---------- налёты: добыча и щит (сам бой — этап 4) ---------- */
const LOOT_MAX=0.10,SHIELD_H=24;
function lootOf(def,pct){const k=LOOT_MAX*clamp(pct,0,100)/100;return {gold:Math.floor(def.bal.gold*k),food:Math.floor(def.bal.food*k)}}

/* ---------- состояние ---------- */
const B=(s,id)=>s.bld.find(b=>b.id===id);
const ofType=(s,t)=>s.bld.filter(b=>b.type===t);
const level=s=>levelOf(s.bal.xp);
const built=b=>!b.job||b.job.kind!=='build';
const lvlOf=b=>b.lvl||1;
const capGold=s=>{const b=ofType(s,'treasury')[0];return b?CAP_GOLD[lvlOf(b)-1]:CAP_GOLD[0]};
const capFood=s=>{const b=ofType(s,'granary')[0];return b?CAP_FOOD[lvlOf(b)-1]:CAP_FOOD[0]};
const habCap=b=>HAB_CAP[lvlOf(b)-1];
const residents=(s,b)=>s.dragons.filter(d=>d.home===b.id);
const busy=d=>!!d.job;                                 /* учится: не летает и не приносит золото */
const working=s=>s.dragons.filter(d=>d.home&&!busy(d)&&B(s,d.home)&&built(B(s,d.home)));
const goldPerCard=s=>CARD_GOLD+working(s).reduce((x,d)=>x+gph(d)*CARD_MIN/60,0);
const jobEnd=j=>j.at+j.dur-(j.cut||0);
const jobLeft=(j,now)=>Math.max(0,jobEnd(j)-now);
function jobsOf(s){return s.bld.flatMap(b=>[b.job,...(b.slots||[])].filter(Boolean).map(j=>({j,b}))).concat(s.dragons.filter(d=>d.job).map(d=>({j:d.job,d})))}
function news(s,t){s.news=(s.news||[]).concat({t,at:s.now||0}).slice(-40)}
function addGold(s,n){const room=Math.max(0,capGold(s)-s.bal.gold),got=Math.min(room,n);s.bal.gold+=got;return n-got}
function addFood(s,n){const room=Math.max(0,capFood(s)-s.bal.food),got=Math.min(room,n);s.bal.food+=got;return n-got}
const xp=(s,n)=>{const L=level(s);s.bal.xp+=Math.max(0,Math.round(n));const L2=level(s);if(L2>L)news(s,`Остров вырос до ${L2}-го уровня`)};
function overlap(s,x,y,skip){return s.bld.some(b=>b.id!==skip&&x<b.x+SIZE&&b.x<x+SIZE&&y<b.y+SIZE&&b.y<y+SIZE)}
function freeSpot(s){const c=[];for(let x=1;x+SIZE<=GRID-1;x+=3)for(let y=1;y+SIZE<=GRID-1;y+=3)if(!overlap(s,x,y))c.push({x,y,d:Math.hypot(x-11,y-11)});
  c.sort((a,b)=>a.d-b.d);return c[0]||null}

/* новый старт: пара основателей разных базовых стихий, Казна и Амбар в центре, два жилища под основателей.
   oldL — уровень старого острова (до 6.0), из него подарок */
function giftFor(oldL){const L=clamp(Math.floor(oldL||0),0,100);
  return {gold:Math.min(CAP_GOLD[0],500+60*L),food:Math.min(CAP_FOOD[0],200+12*L),gems:5+Math.floor(L/2),
    eggs:[L>=10?1:null,L>=25?2:null,L>=50?3:null].filter(x=>x!=null),oldL:L}}
function startState(uid,today,now,oldL){const r=rng(uid+':founders6'),a=pick(r,BASIC);let b=pick(r,BASIC);while(b===a)b=pick(r,BASIC);
  const s={v:3,rev:0,since:today,now,seq:1,bseq:1,bal:{gold:0,food:0,gems:0,xp:0,spd:0,ch:0,chp:0},
    cred:{day:null,n:0,cards:0,hw:[]},bld:[],dragons:[],eggs:[],news:[],welcome:null,shield:0};
  const put=(type,x,y,lvl)=>{const id='b'+s.bseq++;s.bld.push({id,type,x,y,lvl:lvl||1,job:null});return id};
  put('treasury',CENTER.treasury.x,CENTER.treasury.y);put('granary',CENTER.granary.x,CENTER.granary.y);
  const homeOf=e=>{const t='h'+e,p=freeSpot(s);return put(t,p.x,p.y)};
  const ha=homeOf(a),hb=homeOf(b);
  const mk=(e,sex,home)=>{const g=genomeOf([e],sex),id='d'+s.seq++;s.dragons.push({id,name:nameFor(g,uid+':n:'+id),g,lvl:1,fed:0,home,born:today,acad:{b:0,m:{}},job:null});return id};
  mk(a,'F',ha);mk(b,'M',hb);
  const gift=giftFor(oldL);s.bal.gold=gift.gold;s.bal.food=gift.food;s.bal.gems=gift.gems;
  gift.eggs.forEach((rar,i)=>s.eggs.push({id:'e'+s.seq++,g:eggGenome(rar,uid+':gift6:'+i),rar,from:'gift'}));
  s.welcome={gift,seen:false};
  return s}

/* ---------- ход времени: зачисление карточек и ДЗ, конец работ ----------
   ctx: {now, today, uid, days:{'YYYY-MM-DD':карточек}, hw:[{id,pc,d}]}. Дни до s.since не считаются. */
function creditCards(s,days){const out={cards:0,gold:0,food:0,lost:0};const ks=Object.keys(days||{}).filter(k=>k>=s.since).sort();
  for(const k of ks){if(s.cred.day&&k<s.cred.day)continue;const n=Math.max(0,Math.floor(+days[k]||0)),from=k===s.cred.day?s.cred.n:0;
    for(let j=from+1;j<=n;j++){const m=ladder(j);out.cards++;
      const g=goldPerCard(s)*m,f=cardFood(level(s))*m;out.gold+=g;out.food+=f;
      out.lost+=addGold(s,g)+addFood(s,f);
      s.bal.spd+=CARD_MIN;s.bal.chp+=1;if(s.bal.chp>=CHARGE_CARDS){s.bal.chp-=CHARGE_CARDS;s.bal.ch=Math.min(CHARGE_MAX,s.bal.ch+1)}
      xp(s,CARD_XP)}
    if(n>=from){s.cred.day=k;s.cred.n=Math.max(from,n)}}
  s.cred.cards+=out.cards;return out}
function creditHW(s,hw,uid){const out=[];(hw||[]).forEach(h=>{if(!h||!h.id||s.cred.hw.includes(h.id)||!(h.d>=s.since))return;
  s.cred.hw.push(h.id);const gems=hwGems(h.pc),rar=hwEgg(h.pc,uid+':hw6:'+h.id);s.bal.gems+=gems;xp(s,gems*10);
  if(rar){s.eggs.push({id:'e'+s.seq++,g:eggGenome(rar,uid+':hwg6:'+h.id),rar,from:'hw:'+h.id});news(s,`За ДЗ «${h.title||'задание'}»: ${RARITY[rar]} яйцо`)}
  out.push({id:h.id,gems,rar})});return out}
function finishJobs(s,now,uid){
  s.bld.forEach(b=>{
    if(b.job&&jobLeft(b.job,now)===0){const j=b.job;b.job=null;
      if(j.kind==='build'){news(s,`${TYPES[b.type].name}: построено`);xp(s,20)}
      else if(j.kind==='up'){b.lvl=j.to;news(s,`${TYPES[b.type].name}: ${j.to}-й уровень`);xp(s,20*j.to)}
      else if(j.kind==='breed'){const g=breed(j.m.g,j.f.g,uid+':breed6:'+j.n);s.eggs.push({id:'e'+s.seq++,g,rar:rarityOf(g),from:'nest',par:[j.m.id,j.f.id],n:j.n});
        if(j.pred){const p=share(j.m.g,j.f.g,j.pred.q),ok=Math.abs(p-j.pred.p)<=PRED_TOL;s.preds=(s.preds||[]).concat({q:j.pred.q,p:j.pred.p,truth:p,ok}).slice(-30);
          if(ok){s.bal.gems+=PRED_GEMS;xp(s,30);news(s,`Прогноз верен: +${PRED_GEMS} самоцвета`)}}
        news(s,'В Гнездовье появилось яйцо');xp(s,15)}}
    (b.slots||[]).forEach((j,i)=>{if(j&&jobLeft(j,now)===0){b.slots[i]=null;hatch(s,j.egg,uid)}});
    if(b.slots)b.slots=b.slots.filter(Boolean)});
  s.dragons.forEach(d=>{if(d.job&&jobLeft(d.job,now)===0){const j=d.job;d.job=null;
    if(j.kind==='bach'){d.acad.b=j.to;news(s,`${d.name} окончил курс «${BACH[j.to-1].name}»`)}
    else if(j.kind==='mag'){d.acad.m=Object.assign({},d.acad.m,{[j.el]:j.to});news(s,`${d.name}: магистратура «${EL[j.el].name}», ${j.to}-я ступень`)}
    xp(s,25)}})}
const PRED_GEMS=2;
function hatch(s,egg,uid){const id='d'+s.seq++,g=egg.g,els=elementsOf(g);
  const home=s.bld.find(b=>TYPES[b.type].kind==='hab'&&built(b)&&els.includes(TYPES[b.type].el)&&residents(s,b).length<habCap(b));
  s.dragons.push({id,name:nameFor(g,uid+':n:'+id),g,lvl:1,fed:0,home:home?home.id:null,born:s.today||null,acad:{b:0,m:{}},job:null,from:egg.from,par:egg.par||null});
  news(s,`Вылупился ${RARITY[rarityOf(g)]} дракон: ${els.map(e=>EL[e].name).join(', ')}${home?'':'. Ему нужно жилище'}`);xp(s,10+20*rarityOf(g))}
function tick(s0,ctx){const s=JSON.parse(JSON.stringify(s0));s.now=ctx.now;s.today=ctx.today;
  finishJobs(s,ctx.now,ctx.uid);const cards=creditCards(s,ctx.days);const hw=creditHW(s,ctx.hw,ctx.uid);finishJobs(s,ctx.now,ctx.uid);
  return {s,cards,hw}}

/* ---------- действия ----------
   apply(s, ctx, act) → {s} или {err}. Сначала tick: доход и законченные работы, затем само действие. */
function pay(s,gold,food,gems){if((gold||0)>s.bal.gold)return 'Не хватает золота';if((food||0)>s.bal.food)return 'Не хватает корма';if((gems||0)>s.bal.gems)return 'Не хватает самоцветов';
  s.bal.gold-=gold||0;s.bal.food-=food||0;s.bal.gems-=gems||0}
const job=(kind,now,h,extra)=>Object.assign({kind,at:now,dur:Math.round(h*HOUR),cut:0},extra||{});
const A={
  build(s,c,{type,x,y}){const t=TYPES[type];if(!t)return 'Нет такой постройки';if(t.center)return 'Эта постройка одна и уже стоит';
    if(t.max&&ofType(s,type).length>=t.max)return `${t.name} уже есть`;
    const first=t.build||t.lv[1];if(level(s)<first.L)return `Откроется на ${first.L}-м уровне острова`;
    if(t.kind==='hab'&&s.bld.filter(b=>TYPES[b.type].kind==='hab').length>=habsMax(level(s)))return 'Мест под жилища пока нет, они прибавятся с ростом острова';
    if(!(x>=0&&y>=0&&x+SIZE<=GRID&&y+SIZE<=GRID)||overlap(s,x,y))return 'Здесь нельзя строить';
    const e=pay(s,first.cost);if(e)return e;s.bld.push({id:'b'+s.bseq++,type,x,y,lvl:1,job:job('build',c.now,first.h)});s.last='b'+(s.bseq-1)},
  upgrade(s,c,{id}){const b=B(s,id);if(!b)return 'Нет такой постройки';if(b.job)return 'Постройка занята';const t=TYPES[b.type],u=t.lv[lvlOf(b)];
    if(!u)return 'Это последний уровень';if(level(s)<u.L)return `Нужен ${u.L}-й уровень острова`;const e=pay(s,u.cost);if(e)return e;b.job=job('up',c.now,u.h,{to:lvlOf(b)+1})},
  move(s,c,{id,x,y}){const b=B(s,id);if(!b)return 'Нет такой постройки';if(!(x>=0&&y>=0&&x+SIZE<=GRID&&y+SIZE<=GRID)||overlap(s,x,y,id))return 'Здесь нельзя поставить';b.x=x;b.y=y},
  feed(s,c,{dragon}){const d=s.dragons.find(x=>x.id===dragon);if(!d)return 'Нет дракона';if(d.lvl>=dragonCap(level(s)))return d.lvl>=LVL_MAX?'Дракон вырос до предела':'Следующий уровень откроется с ростом острова';
    const e=pay(s,0,feedCost(d.lvl));if(e)return e;d.fed=(d.fed||0)+1;if(d.fed>=FEEDS){d.fed=0;d.lvl++;xp(s,5+d.lvl)}},
  home(s,c,{dragon,id}){const d=s.dragons.find(x=>x.id===dragon),b=B(s,id);if(!d||!b||TYPES[b.type].kind!=='hab')return 'Нет такого жилища';
    if(!elementsOf(d.g).includes(TYPES[b.type].el))return `${TYPES[b.type].name} не подходит этой стихии`;if(residents(s,b).length>=habCap(b))return 'Жилище заполнено';d.home=b.id},
  /* Гнездовье: самка и самец, прогноз по желанию ({q, p} — доля потомков с признаком q) */
  breed(s,c,{m,f,pred}){const n=ofType(s,'nest')[0];if(!n||!built(n))return 'Сначала постройте Гнездовье';if(n.job)return 'Гнездовье занято';
    const M=s.dragons.find(x=>x.id===m),F=s.dragons.find(x=>x.id===f);if(!M||!F||M.g.sex!=='F'||F.g.sex!=='M')return 'Нужны самка и самец';
    if(busy(M)||busy(F))return 'Дракон сейчас учится';if(M.lvl<5||F.lvl<5)return 'Родители не ниже 5-го уровня';
    if(pred&&!(pred.q&&typeof pred.p==='number'&&pred.p>=0&&pred.p<=1))return 'Прогноз не понят';
    const e=pay(s,breedCost(rarityOf(M.g),rarityOf(F.g)));if(e)return e;s.bseq2=(s.bseq2||0)+1;
    n.job=job('breed',c.now,BREED_H,{m:{id:M.id,g:M.g},f:{id:F.id,g:F.g},n:s.bseq2,pred:pred||null})},
  incubate(s,c,{egg}){const h=ofType(s,'hatchery')[0];if(!h||!built(h))return 'Сначала постройте Инкубатор';const i=s.eggs.findIndex(x=>x.id===egg);if(i<0)return 'Нет такого яйца';
    h.slots=h.slots||[];if(h.slots.length>=HATCH_SLOTS[lvlOf(h)-1])return 'В Инкубаторе нет места';const eg=s.eggs.splice(i,1)[0];h.slots.push(job('hatch',c.now,HATCH_H[eg.rar],{egg:eg}))},
  /* Академия: бакалавриат по порядку, потом магистратура по стихиям дракона */
  study(s,c,{dragon,el}){const a=ofType(s,'academy')[0];if(!a||!built(a))return 'Сначала постройте Академию';const d=s.dragons.find(x=>x.id===dragon);if(!d)return 'Нет дракона';
    if(d.job)return 'Дракон уже учится';if(s.dragons.filter(x=>x.job).length>=ACAD_SEATS[lvlOf(a)-1])return 'Все места в Академии заняты';
    const b=bachDone(d);
    if(!el){if(b>=BACH.length)return 'Бакалавриат окончен, дальше магистратура';const k=BACH[b];if(d.lvl<k.lvl)return `Курс «${k.name}» с ${k.lvl}-го уровня дракона`;
      const e=pay(s,k.gold);if(e)return e;d.job=job('bach',c.now,k.h,{to:b+1});return}
    if(b<BACH.length)return 'Сначала окончите бакалавриат';if(!elementsOf(d.g).includes(el))return 'Магистратура только по стихиям этого дракона';
    const r=magRank(d,el);if(r>=MAG.length)return 'По этой стихии магистратура окончена';const k=MAG[r];if(d.lvl<k.lvl)return `Ступень с ${k.lvl}-го уровня дракона`;
    const e=pay(s,k.gold);if(e)return e;d.job=job('mag',c.now,k.h,{el,to:r+1})},
  /* ускорение: минуты из карточек (bal.spd) или самоцветы, 1 самоцвет = 30 минут. target: {b} постройка, {b,slot} яйцо, {d} дракон */
  speed(s,c,{target,gems,mins}){const j=target&&(target.d?(s.dragons.find(x=>x.id===target.d)||{}).job:target.b?(target.slot!=null?(B(s,target.b)||{slots:[]}).slots[target.slot]:(B(s,target.b)||{}).job):null);
    if(!j)return 'Нечего ускорять';const left=jobLeft(j,c.now)/MIN;if(left<=0)return 'Уже готово';
    if(gems){const g=Math.min(gems,Math.ceil(left/GEM_MIN));const e=pay(s,0,0,g);if(e)return e;j.cut=(j.cut||0)+g*GEM_MIN*MIN;return}
    const m=Math.min(mins==null?s.bal.spd:mins,s.bal.spd,Math.ceil(left));if(!(m>0))return 'Минут ускорения нет: повторите карточки';s.bal.spd-=m;j.cut=(j.cut||0)+m*MIN},
  welcome(s){if(s.welcome)s.welcome.seen=true},
  rename(s,c,{dragon,name}){const d=s.dragons.find(x=>x.id===dragon);const n=String(name||'').trim().slice(0,24);if(!d||!n)return 'Имя не подходит';d.name=n}
};
function apply(s0,ctx,act){const t=tick(s0,ctx),s=t.s;const f=A[act&&act.t];if(!f)return {err:'Неизвестное действие'};
  const err=f(s,ctx,act||{});if(err)return {err};s.finishedBy=act.t;finishJobs(s,ctx.now,ctx.uid);return {s,cards:t.cards,hw:t.hw}}
/* налёт на этот остров удался: забрать добычу и поставить щит. Сам бой и проверка его честности — этапы 4 и 5 */
function raided(s0,now,pct){const s=JSON.parse(JSON.stringify(s0)),l=lootOf(s,pct);s.bal.gold-=l.gold;s.bal.food-=l.food;s.shield=now+SHIELD_H*HOUR;news(s,`На остров был налёт: забрали ${l.gold} золота и ${l.food} корма. Щит на сутки`);return {s,loot:l}}
const shielded=(s,now)=>(s.shield||0)>now;

/* ---------- правила для окна при первом входе (короткие, но полные) ---------- */
const RULES=[
  ['Карточки','Каждая повторённая карточка — 15 минут работы драконов: золото в Казну, корм в Амбар, 15 минут ускорения и шаг к заряду налёта. Чем больше карточек за день, тем дороже каждая следующая: с 16-й ×1,25, с 31-й ×1,5, с 61-й ×1,75, после 120-й ×2.'],
  ['Домашние задания','ДЗ приносят самоцветы. За ДЗ от 85 % может прийти яйцо редкого, эпического или мифического дракона, и чем выше балл, тем больше шанс.'],
  ['Казна и Амбар','Золото и корм хранятся в Казне и Амбаре в центре острова. Сверх вместимости ничего не помещается, поэтому их стоит улучшать.'],
  ['Время','Стройки, яйца и учёба идут по часам. Минуты из карточек и самоцветы (1 самоцвет = 30 минут) ускоряют любую работу.'],
  ['Драконы','Стихия решает всё: облик, способность и доход. Чем больше стихий, тем дракон реже и сильнее. Уровень растёт от кормления, Академия даёт бакалавриат из четырёх курсов и магистратуру по стихиям.'],
  ['Стихии','Каждая стихия сильна против двух и слаба против двух. Самой сильной нет, побеждает тот, кто подобрал отряд.'],
  ['Скрещивание','Стихии наследуются по Менделю. Предскажите долю потомков с нужной стихией: точный прогноз приносит самоцветы.'],
  ['Налёты','Заряды налётов дают карточки. Выпускайте драконов над чужим островом и вовремя включайте способности. Удачный налёт на остров ученицы забирает до 10 % её Казны и Амбара, после этого у неё щит на сутки.']
];

const DR6={rng,ELS,BASIC,LEGEND,EL,elValue,RING,beats,mult,vs,strongVs,weakVs,STRONG,WEAK,
  elementsOf,rarityOf,RARITY,RMULT,validGenome,breed,dist,share,PRED_TOL,PRED_GEMS,genomeOf,eggGenome,nameFor,
  LVL_MAX,FEEDS,lk,feedCost,BACH,MAG,MAG_ATK,stats,atkWith,power,gph,
  TYPES,CAP_GOLD,CAP_FOOD,HAB_CAP,HATCH_SLOTS,ACAD_SEATS,habsMax,GRID,CENTER,capGold,capFood,
  ISLE_MAX,xpFor,levelOf,level,dragonCap,CARD_MIN,GEM_MIN,LADDER,ladder,CARD_GOLD,cardFood,CHARGE_CARDS,CHARGE_MAX,goldPerCard,
  HW_GEMS,hwGems,eggOdds,hwEgg,HATCH_H,BREED_H,breedCost,LOOT_MAX,SHIELD_H,lootOf,raided,shielded,
  giftFor,startState,tick,apply,jobLeft,jobsOf,RULES,HOUR,MIN,DAY};
if(typeof module!=='undefined'&&module.exports)module.exports=DR6;else root.DR6=DR6;
})(typeof window!=='undefined'?window:globalThis);
