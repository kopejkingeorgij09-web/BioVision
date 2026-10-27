/* Первый поход (этап 7 Драконов 3.0): пять боёв и босс на «Огненной гряде». Только данные и чистые функции.
   Противники — обычные драконы модели: генотип через DRG.make, характеристики через stats.js, как у драконов игрока.
   Прогресс хранится в документе острова в поле pve: {v:1, best:{id:звёзды}, wins:{id:число}, at:{id:дата}}.
   Звёзды и победы — единственная награда похода. Золото, корм и самоцветы за бои не начисляются, пока владелец
   не согласует правила (экономику острова этот модуль не трогает). */
(function(root){
'use strict';
const DRG=root.DRG||(typeof require!=='undefined'?require('./genetics.js'):null);
const BASE={S:'S/S',C:'C/c',H:'h/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-'};
const male={sex:'M',M:'m/m',N:'N/N'},female={sex:'F',M:'m',N:'N',Sp:'sp',G:'g'};
const foe=(id,name,lvl,spec)=>({id,name,lvl,genome:DRG.make(Object.assign({},BASE,spec.sex==='F'?female:male,spec))});

const AREA={id:'ember',name:'Огненная гряда',intro:'Цепочка островов к востоку от вашего. На каждом живут дикие драконы, а на вершине последнего — Хранитель гряды.'};
const BATTLES=[
  {id:'e1',name:'Луговая опушка',story:'Двое молодых дракончиков Флоры не пускают на тропу.',ai:'easy',rec:1,
    foes:()=>[foe('e1a','Побег',1,{E:'P/P',sex:'F'}),foe('e1b','Росток',1,{E:'P/e'})]},
  {id:'e2',name:'Дымная лощина',story:'В лощине дремлют дымные драконы без стихии. Их бьёт любая стихия.',ai:'easy',rec:2,
    foes:()=>[foe('e2a','Пепел',2,{E:'e/e'}),foe('e2b','Сажа',3,{E:'e/e',sex:'F'}),foe('e2c','Уголь',2,{E:'F/e'})]},
  {id:'e3',name:'Каменный брод',story:'Земля и Воздух охраняют переправу: против Земли хороша Флора, против Воздуха Земля.',ai:'normal',rec:4,
    foes:()=>[foe('e3a','Гранит',4,{E:'T/T',H:'H/h'}),foe('e3b','Вихрь',3,{E:'A/A',sex:'F'}),foe('e3c','Кремень',3,{E:'T/e',K:'K/k'})]},
  {id:'e4',name:'Горячие ключи',story:'Огонь и Вода живут рядом и прикрывают друг друга.',ai:'normal',rec:6,
    foes:()=>[foe('e4a','Зной',7,{E:'F/F',H:'H/H'}),foe('e4b','Омут',6,{E:'W/W',sex:'F'}),foe('e4c','Пар',6,{E:'F/W'})]},
  {id:'e5',name:'Перевал гибридов',story:'Гибриды бьют двумя стихиями. Смотрите, какая из их стихий слабее против ваших.',ai:'normal',rec:9,
    foes:()=>[foe('e5a','Буря',8,{E:'A/W',sex:'F'}),foe('e5b','Корень',7,{E:'P/T',K:'K/K'}),foe('e5c','Лава',7,{E:'F/T',H:'H/h'})]},
  {id:'e6',name:'Вершина: Хранитель гряды',boss:true,story:'Взрослый дракон Тьмы с двумя стражами. Свет силён против Тьмы, а Тьма против Света.',ai:'hard',rec:11,
    foes:()=>[foe('e6a','Хранитель',13,{E:'D/D',H:'H/H',K:'K/k',R:'R1/R1',M:'M/m'}),foe('e6b','Страж Огня',8,{E:'F/F',sex:'F'}),foe('e6c','Страж Воды',8,{E:'W/e'})]}
];
const byId=id=>BATTLES.find(b=>b.id===id)||null;

/* прогресс из документа: старые сохранения без поля pve дают пустой прогресс; чужие и битые поля отбрасываются */
function progress(doc){
  const p=doc&&doc.pve,out={v:1,best:{},wins:{},at:{}};if(!p||typeof p!=='object')return out;
  BATTLES.forEach(b=>{const s=p.best&&p.best[b.id],w=p.wins&&p.wins[b.id],a=p.at&&p.at[b.id];
    if(Number.isInteger(s)&&s>=1&&s<=3)out.best[b.id]=s;if(Number.isInteger(w)&&w>0)out.wins[b.id]=Math.min(w,9999);if(typeof a==='string')out.at[b.id]=a.slice(0,10)});
  return out}
/* открыт ли бой: первый открыт всегда, дальше нужна победа в предыдущем */
function unlocked(p,id){const i=BATTLES.findIndex(b=>b.id===id);return i===0||(i>0&&!!p.best[BATTLES[i-1].id])}
/* записать итог: лучшие звёзды не уменьшаются, поражение ничего не меняет. Возвращает новый прогресс */
function record(p,id,stars,today){
  const q=progress({pve:p});if(!byId(id)||!unlocked(q,id))return q;
  if(stars>=1){q.best[id]=Math.max(q.best[id]||0,Math.min(3,stars));q.wins[id]=(q.wins[id]||0)+1;q.at[id]=today||q.at[id]||null;if(!q.at[id])delete q.at[id]}
  return q}
const total=p=>Object.values(p.best).reduce((a,b)=>a+b,0);
const done=p=>BATTLES.every(b=>p.best[b.id]);

const DRCAMP={AREA,BATTLES,byId,progress,unlocked,record,total,done};
if(typeof module!=='undefined'&&module.exports)module.exports=DRCAMP;else root.DRCAMP=DRCAMP;
})(typeof window!=='undefined'?window:globalThis);
