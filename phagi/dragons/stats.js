/* Игровые параметры: только уровень и роль стихии. Декоративная внешность не даёт прибавок. */
(function(root){
'use strict';

const NOTE='Игровые параметры, условность модели: роль стихии в бою задаёт игра, а не биология.';
const NAMES={hp:'Здоровье',atk:'Атака',def:'Защита',spd:'Скорость'};
/* рост с уровнем: до 20-го по 8 % за уровень (20-й ×2,52), дальше мастерство по 3 % (60-й ×3,72) */
const lvlK=lvl=>{const L=Math.max(1,lvl);return 1+0.08*(Math.min(L,20)-1)+0.03*Math.max(0,L-20)};
const CREST_DEF={big:2,mid:1};
/* роли стихий: общий бюджет силы. Тяжёлый живучее, но бьёт слабее и ходит позже; лёгкий быстрее, бьёт сильнее,
   а Натиск Воздуха (+12 % по тому, кто в раунде ещё не ходил) делает скорость настоящим преимуществом.
   Множители подобраны прогоном dev/types.js, это не биология. Внешность и походка от ролей не зависят */
const ROLE={
  T:{name:'Страж',hp:1.259,def:1.28,atk:0.828,spd:-2,text:'много здоровья и защиты, слабее бьёт и ходит позже'},
  P:{name:'Опутчик',hp:1.156,def:1.06,atk:0.965,spd:-1,text:'крепкий, держит противника лозой'},
  W:{name:'Волна',hp:1.076,def:1.00,atk:0.992,spd:0,text:'ровный, промок замедляет и сбивает ярость'},
  F:{name:'Боец',hp:0.934,def:0.92,atk:1.102,spd:1,text:'сильный удар и ожог'},
  A:{name:'Налётчик',hp:0.774,def:0.86,atk:0.993,spd:3,text:'ходит первым, Натиск по тем, кто ещё не ходил'},
  L:{name:'Светоносец',hp:1.034,def:1.00,atk:1.034,spd:0,text:'лечится с каждого удара'},
  D:{name:'Теневик',hp:0.956,def:0.96,atk:0.996,spd:1,text:'вытягивает силы, иногда ослабляет'},
  smoke:{name:'Дымный',hp:1.06,def:1.06,atk:1.00,spd:0,text:'без стихии, бьёт Ударом'},
  dormant:{name:'Дремлющий',hp:1.10,def:1.10,atk:0.96,spd:0,text:'без стихии, крепкий'}
};
/* слаженность двух стихий: у каждого сочетания своя небольшая поправка здоровья и атаки (k) и название.
   Нужна, чтобы у сочетаний с общей слабостью (Огонь и Земля оба уязвимы для Воды) была своя польза, а у сочетаний
   с широким покрытием не было бесплатного перевеса. Поправки подобраны прогоном dev/types.js */
const HYB={FW:{name:'Пар',k:0.922},FT:{name:'Магма',k:1.029},FA:{name:'Зарево',k:0.900},FP:{name:'Пожар',k:0.906},FL:{name:'Солнце',k:0.942},FD:{name:'Уголь',k:0.974},
  WT:{name:'Болото',k:0.958},WA:{name:'Шторм',k:0.889},WP:{name:'Мангры',k:0.944},WL:{name:'Радуга',k:0.964},WD:{name:'Бездна',k:0.938},
  TA:{name:'Самум',k:0.988},TP:{name:'Дебри',k:0.947},TL:{name:'Кристалл',k:0.984},TD:{name:'Обсидиан',k:1.017},
  AP:{name:'Пыльца',k:0.962},AL:{name:'Сияние',k:0.915},AD:{name:'Мгла',k:0.930},PL:{name:'Цветение',k:0.946},PD:{name:'Гниль',k:0.978},LD:{name:'Сумерки',k:0.925}};
const ORD='FWTAPLD';
const hybKey=els=>els.length===2?els.slice().sort((a,b)=>ORD.indexOf(a)-ORD.indexOf(b)).join(''):null;
/* роль дракона: у гибрида среднее геометрическое множителей его стихий, скорость — среднее */
function roleOf(ph){
  const ks=ph.breath==='element'&&ph.elements.length?ph.elements:[ph.breath==='smoke'?'smoke':'dormant'];
  const g=k=>Math.exp(ks.reduce((x,e)=>x+Math.log(ROLE[e][k]),0)/ks.length);
  const h=HYB[hybKey(ks)],k=h?h.k:1;
  return {keys:ks,name:ks.map(e=>ROLE[e].name).join(' + '),hyb:h?h.name:null,hp:g('hp')*k,def:g('def'),atk:g('atk')*k,k,spd:Math.round(ks.reduce((x,e)=>x+ROLE[e].spd,0)/ks.length)}}

function of(ph,lvl,P){
  const k=lvlK(lvl),R=roleOf(ph),src={hp:[],atk:[],def:[],spd:[]};P=P||{};
  const add=(s,label,v)=>{if(v)src[s].push([label,v])};
  /* основа и наследуемые части: рога, булава, шпоры, гребень, блеск, крылья. Роль стихии умножает основу */
  const hp0=44,def0=12,atk0=10+(ph.breath==='element'?2:ph.breath==='smoke'?1:0);
  add('hp','Основа',hp0);add('hp','Роль: '+R.name+' (стихия)',Math.round(hp0*(R.hp-1)));
  add('atk','Основа',10);add('atk','Дыхание (стихия)',atk0-10);add('atk','Роль: '+R.name+' (стихия)',Math.round(atk0*(R.atk-1)));
  add('def','Основа',def0);add('def','Роль: '+R.name+' (стихия)',Math.round(def0*(R.def-1)));
  add('spd','Основа',10);add('spd','Роль: '+R.name+' (стихия)',R.spd);
  const sum=s=>src[s].reduce((a,[,v])=>a+v,0);
  const training=Math.max(0,Math.min(3,Math.floor(ph.academyRank||0)));if(training){for(const stat of ['hp','atk','def'])add(stat,'Академия, ранг '+training,Math.round(sum(stat)*.2*training));add('spd','Академия',training)}
  return {hp:Math.round(sum('hp')*k),atk:Math.round(sum('atk')*k),def:Math.round(sum('def')*k),spd:sum('spd'),lvlK:k,src,note:NOTE,role:R}}

/* подпись для карточек: боевой ранг ✦ по числу разных стихийных атак (не редкость и не звёзды боя ★), сочетание и роль */
const ELN={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
function badge(ph){
  const n=ph.breath==='element'?ph.elements.length:0,R=roleOf(ph);
  return {rank:n,stars:n?'✦'.repeat(n):'',title:n?`Боевой ранг ${'✦'.repeat(n)}: ${n} ${n===1?'тип':'типа'} стихийной атаки`:ph.breath==='smoke'?'Дымный: без стихийных атак, бьёт Ударом':'Дремлющий: стихия не проявляется',
    name:n>2?n+' стихии: '+ph.elements.map(e=>ELN[e]).join(', '):R.hyb?R.hyb+' ('+ph.elements.map(e=>ELN[e]).join(' + ')+')':n?ELN[ph.elements[0]]:ph.breath==='smoke'?'Дымный':'Дремлющий',
    role:R.name,hyb:R.hyb,k:R.k}}
/* Сводный индекс: здоровье + четыре веса для остальных шкал. Матчап считается отдельно. */
const power=s=>Math.round(s.hp+4*(s.atk+s.def+s.spd));
const POWER_NOTE='Абсолютная сила = здоровье + 4 × (атака + защита + скорость). Сравнивай драконов одного уровня; исход боя также зависит от стихий, приёмов и команды.';
const DSTATS={power,POWER_NOTE,of,NOTE,NAMES,lvlK,ROLE,HYB,hybKey,roleOf,badge};
if(typeof module!=='undefined'&&module.exports)module.exports=DSTATS;else root.DSTATS=DSTATS;
})(typeof window!=='undefined'?window:globalThis);
