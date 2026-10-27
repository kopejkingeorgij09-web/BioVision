/* Базовые боевые характеристики дракона для сцены осмотра (этап 2 Драконов 3.0).
   Это игровые параметры, а не биология: условность модели, черновик правил боя. Бой 3 на 3 (этап 5) может их уточнить.
   Всё считается из того же фенотипа и морфологии, что и рисунок: тяжёлое телосложение даёт здоровье и защиту,
   рога, булава и шпоры дают атаку, лёгкое тело и крылья дают скорость. Уровень растит здоровье, атаку и защиту.
   У каждой характеристики список вкладов с генами, от которых зависит признак (по карте MORPH.SRC).
   Нужны: фенотип ph (DRG.phenotype), уровень, профиль движения P (ANIM.profile): hv тяжесть 0…1, v скорость шага,
   canFly, baby. Чистая функция без DOM. */
(function(root){
'use strict';

const NOTE='Игровые параметры, условность модели. Это черновик правил боя: бои 3 на 3 могут их уточнить.';
const NAMES={hp:'Здоровье',atk:'Атака',def:'Защита',spd:'Скорость'};
const lvlK=lvl=>1+0.08*(Math.max(1,lvl)-1);   /* 1-й уровень ×1, 20-й ×2,52 */
const CREST_DEF={big:2,mid:1};

function of(ph,lvl,P){
  const k=lvlK(lvl),hv=Math.max(0,Math.min(1,P.hv)),src={hp:[],atk:[],def:[],spd:[]};
  const add=(s,label,v)=>{if(v)src[s].push([label,v])};
  /* здоровье и защита: основа, телосложение (стихия E и искра S задают архетип тела), броня блеска M */
  add('hp','Основа',30);add('hp','Телосложение (гены E, S)',Math.round(24*hv));add('hp','Блеск чешуи (ген M)',ph.metal?4:0);
  add('atk','Основа',10);add('atk','Рога (ген H)',ph.horns?3:0);add('atk','Булава (ген K)',ph.mace?3:0);add('atk','Шпоры (ген Sp)',ph.spurs?2:0);
  add('atk','Дыхание (гены S, E)',ph.breath==='element'?2:ph.breath==='smoke'?1:0);
  add('def','Основа',8);add('def','Телосложение (гены E, S)',Math.round(8*hv));add('def','Гребень (ген R)',CREST_DEF[ph.crest]||0);add('def','Блеск чешуи (ген M)',ph.metal?3:0);
  /* скорость не растёт с уровнем: она из длины шага и лёгкости тела, плюс крылья, если дракон летает */
  add('spd','Основа',6);add('spd','Шаг и лёгкость тела (гены E, S)',Math.round(P.v/5));add('spd','Полёт (гены Wg, Q1–Q3)',P.canFly?2:0);
  const sum=s=>src[s].reduce((a,[,v])=>a+v,0);
  const out={hp:Math.round(sum('hp')*k),atk:Math.round(sum('atk')*k),def:Math.round(sum('def')*k),spd:sum('spd'),lvlK:k,src,note:NOTE};
  return out}

const DSTATS={of,NOTE,NAMES,lvlK};
if(typeof module!=='undefined'&&module.exports)module.exports=DSTATS;else root.DSTATS=DSTATS;
})(typeof window!=='undefined'?window:globalThis);
