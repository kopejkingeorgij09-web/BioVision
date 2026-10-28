/* Бой 3 на 3 против компьютера (этап 5 Драконов 3.0): правила и расчёты без рисунка и без DOM.
   Сцена (scene.js, attacks.js) только показывает события, которые возвращает этот модуль; урон, эффекты и конец боя
   считаются здесь, один раз на действие. Случайность с зерном: один и тот же бой с теми же решениями даёт тот же итог.
   Все числа здесь — игровые условности, не биология. Подобраны так, чтобы бой равных команд длился 3–5 раундов
   (проверяет battle.test.js). Компьютер ходит по тем же правилам, что и игрок: сложность только в качестве его выбора.
   Работает в браузере (window.DRBATTLE) и в node для автотестов. */
(function(root){
'use strict';

/* ---------- стихии ----------
   Одна таблица на всё: движок, компьютер, подготовка, подсказки, паспорт боя и прогоны баланса берут её отсюда.
   Каждая из пяти простых стихий сильна против двух и слаба против двух; обязательный треугольник: Вода сильнее Огня,
   Огонь сильнее Флоры, Флора сильнее Воды. Свет и Тьма к пяти простым нейтральны, друг против друга сильны оба.
   Это договор игры, не биологический закон: в природе стихий нет. */
const STRONG_VS={W:['F','T'],F:['P','A'],P:['W','T'],T:['F','A'],A:['W','P'],L:['D'],D:['L']};
const EL_NAME={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const STRONG=1.4,WEAK=1/1.4;
/* против одной стихии цели */
function pair(a,d){if(!a||!d)return 1;if((STRONG_VS[a]||[]).includes(d))return STRONG;if((STRONG_VS[d]||[]).includes(a))return WEAK;return 1}
/* против всех стихий цели: среднее геометрическое, а не произведение. Сильное и слабое отношение гасят друг друга до ×1,
   четыре стихии цели не дают ни ×1,4⁴, ни неуязвимости */
function mult(el,defEls){
  if(!el||!defEls||!defEls.length)return 1;
  const m=Math.exp(defEls.reduce((x,d)=>x+Math.log(pair(el,d)),0)/defEls.length);
  return Math.round(m*1e6)/1e6}
/* для старого кода и справки: кого стихия бьёт сильнее, кому уступает */
const BEATS=STRONG_VS;
const strongVs=e=>(STRONG_VS[e]||[]).slice(),weakVs=e=>Object.keys(STRONG_VS).filter(x=>STRONG_VS[x].includes(e)&&!(STRONG_VS[e]||[]).includes(x));

/* ---------- приёмы ----------
   power — множитель урона; эффект стихии срабатывает с вероятностью chance (у «Ярости» всегда).
   Бюджет эффектов выровнен прогоном dev/types.js: у каждого попадания один основной результат, дополнительный — с вероятностью. */
const POWER={strike:1,element:1.25,rage:2.2};
const EFFECT={
  F:{k:'burn',chance:0.32,turns:2,name:'Ожог'},              /* в начале своего хода теряет 6 % здоровья */
  W:{k:'slow',chance:0.32,turns:2,name:'Промок',rage:15},           /* скорость −30 % и сразу −15 ярости: полезно и тогда, когда порядок не изменился */
  T:{k:'brk',chance:0.38,turns:2,name:'Трещина в броне'},     /* защита −30 % */
  A:{k:'weak',chance:0.25,turns:2,name:'Сбит с толку',rush:1.12},      /* атака −20 %; у Воздуха ещё Натиск: +12 % по тому, кто в этом раунде не ходил */
  P:{k:'root',chance:0.2,turns:1,name:'Опутан'},             /* пропускает ход; после этого 2 своих хода лоза его не держит */
  L:{k:'heal',chance:1,name:'Свет лечит'},                  /* атакующий лечится на 20 % нанесённого урона */
  D:{k:'drain',chance:1,name:'Тень вытягивает силы',weak:0.25} /* атакующий лечится на 15 % урона, с вероятностью 25 % цель сбита с толку на 1 ход */
};
const BURN=0.06,SLOW=0.7,BRK=0.7,WEAKK=0.8,HEAL_L=0.2,HEAL_D=0.15,GUARD=0.5,PERFECT=1.25,DEFK=25,DMG=1.6,SPREAD=0.1,FIRM=2;
const RAGE={hit:25,perfect:10,taken:15,guard:10,max:100};
/* особенности противников похода (этап 4 доработки): открытые правила, игрок видит их до боя и в бою.
   Компьютер не получает ничего, чего нет в этом списке, а его оценка ходов учитывает их так же, как подсказки игроку. */
const THICK=0.5,SHIELD=0.6,REGEN=0.06,ENRAGE=1.3;
const TRAITS={
  thick:{name:'Толстая шкура',ic:'🦏',text:'Атаки без стихии (Удар и Ярость дракона без стихии) наносят ему вдвое меньше урона. Бейте стихиями.'},
  shield:{name:'Вожак стаи',ic:'🛡',text:'Пока в его команде есть кто-то ещё, он получает на 40 % меньше урона. Сначала уберите свиту.'},
  regen:{name:'Регенерация',ic:'🌱',text:'В начале каждого своего хода восстанавливает 6 % здоровья. Сосредоточьте удары на нём, а не по очереди.'},
  ward:{name:'Закалка',ic:'💎',text:'Эффекты стихий на него не действуют: ни ожог, ни промок, ни трещина, ни «сбит с толку», ни лоза. Урон стихий проходит как обычно.'},
  enrage:{name:'Гнев',ic:'💢',text:'Когда здоровье падает до половины, его атака до конца боя растёт на 30 %. Добивайте быстро или закрывайтесь Защитой.'}
};
const MAX_ROUNDS=30;

function rng(seed){let a=(typeof seed==='number'?seed:hashStr(String(seed)))>>>0;
  return function(){a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}return h>>>0}

/* боец: id, имя, сторона (A — игрок, B — компьютер), стихии, характеристики из stats.js */
function fighter(s,side,i){
  if(!s||!s.id)throw new Error('боец без id');
  const els=(s.els||[]).slice(),load=(s.load&&s.load.length?s.load.filter(e=>els.includes(e)):els).slice(0,2);
  return {id:s.id,name:s.name||s.id,side,slot:i,els,load,lvl:s.lvl||1,maxHp:s.hp,hp:s.hp,atk:s.atk,def:s.def,spd:s.spd,
    rage:0,rageUsed:false,guard:false,fx:{},ko:false,ref:s.ref||null,traits:(s.traits||[]).filter(k=>TRAITS[k]),enraged:false}}
const has=(f,k)=>f.traits.includes(k);

/* приёмы бойца: удар есть у всех, у каждой стихии настройки своя атака (в настройке не больше двух стихий),
   защита, «Ярость дракона» один раз за бой. У дракона с тремя-четырьмя стихиями есть смена настройки: она занимает ход.
   За ход одно действие, сколько бы стихий ни было */
function skillsOf(f){
  const load=f.load||f.els.slice(0,2),out=[{id:'strike',name:'Удар',el:null,power:POWER.strike}];
  load.forEach(e=>out.push({id:'el:'+e,name:EL_NAME[e],el:e,power:POWER.element}));
  out.push({id:'guard',name:'Защита',self:true});
  out.push({id:'rage',name:'Ярость дракона',el:load[0]||null,power:POWER.rage,ready:f.rage>=RAGE.max&&!f.rageUsed});
  f.els.filter(e=>!load.includes(e)).forEach(n=>load.forEach(o=>out.push({id:'swap:'+o+n,name:'Сменить '+EL_NAME[o]+' на '+EL_NAME[n],self:true,swap:[o,n]})));
  return out}

/* ---------- бой ---------- */
function Battle(o){
  if(!o||!Array.isArray(o.A)||!Array.isArray(o.B))throw new Error('нужны команды A и B');
  if(!o.A.length||!o.B.length||o.A.length>3||o.B.length>3)throw new Error('в команде от 1 до 3 драконов');
  const ids=new Set();[...o.A,...o.B].forEach(s=>{if(ids.has(s.id))throw new Error('дракон дважды в бою: '+s.id);ids.add(s.id)});
  this.f=[...o.A.map((s,i)=>fighter(s,'A',i)),...o.B.map((s,i)=>fighter(s,'B',i))];
  this.rnd=rng(o.seed==null?1:o.seed);this.round=0;this.queue=[];this.qi=0;this.over=false;this.winner=null;this.cur=null;this.log=[];this.acts=0;
  this.maxRounds=o.maxRounds||MAX_ROUNDS;
  /* слои правил для прогонов баланса: matrix:false — урон стихий нейтральный, fx:false — без эффектов. В игре всегда всё */
  this.rules=Object.assign({matrix:true,fx:true},o.rules||{});
  /* правило третьей звезды узла: победа без потерь не позже такого-то раунда (0 — без ограничения) */
  this.star3=o.star3>0?o.star3:0}
Battle.prototype.get=function(id){return this.f.find(x=>x.id===id)||null};
Battle.prototype.alive=function(side){return this.f.filter(x=>!x.ko&&(!side||x.side===side))};
Battle.prototype.mult=function(el,t){return this.rules.matrix?mult(el,t.els):1};
/* ходил ли боец уже в этом раунде */
Battle.prototype.acted=function(t){const i=this.queue.indexOf(t.id);return i>=0&&i<this.qi&&this.cur!==t.id};
Battle.prototype.spd=function(f){return f.spd*(f.fx.slow?SLOW:1)};
Battle.prototype.atkOf=function(f){return f.atk*(f.fx.weak?WEAKK:1)*(f.enraged?ENRAGE:1)};
/* множитель особенностей цели: толстая шкура против атак без стихии, вожак при живой свите */
Battle.prototype.traitK=function(skill,t){
  return (has(t,'thick')&&!skill.el?THICK:1)*(has(t,'shield')&&this.alive(t.side).length>1?SHIELD:1)};
Battle.prototype.defOf=function(f){return f.def*(f.fx.brk?BRK:1)};
/* очередь раунда: по скорости, при равенстве выше уровень, дальше жребий раунда (с зерном боя), чтобы при равных
   драконах ни одна сторона не ходила первой всегда */
Battle.prototype.order=function(){
  const lot=new Map(this.alive().map(x=>[x.id,this.rnd()]));
  return this.alive().slice().sort((a,b)=>this.spd(b)-this.spd(a)||b.lvl-a.lvl||lot.get(a.id)-lot.get(b.id)).map(x=>x.id)};
Battle.prototype.checkEnd=function(ev){
  if(this.over)return true;
  const a=this.alive('A').length,b=this.alive('B').length;
  if(a&&b&&this.round<=this.maxRounds)return false;
  this.over=true;this.winner=a&&!b?'A':'B';this.cur=null;
  ev.push({type:'end',winner:this.winner,why:a&&b?'time':b?'A_out':'B_out',stars:this.stars()});return true};
/* следующий ход: начало раунда, ожог, пропуск хода. Возвращает события до хода того, кто может действовать */
Battle.prototype.next=function(){
  const ev=[];if(this.over)return ev;
  for(let guard=0;guard<100;guard++){
    if(this.qi>=this.queue.length){this.round++;if(this.checkEnd(ev))return ev;this.queue=this.order();this.qi=0;ev.push({type:'round',n:this.round,order:this.queue.slice()})}
    const f=this.get(this.queue[this.qi++]);if(!f||f.ko)continue;
    f.guard=false;
    if(f.fx.burn){const d=Math.max(1,Math.round(f.maxHp*BURN));f.hp=Math.max(0,f.hp-d);ev.push({type:'dot',id:f.id,dmg:d,hp:f.hp,fx:'burn'});
      if(f.hp<=0){f.ko=true;f.fx={};ev.push({type:'ko',id:f.id});if(this.checkEnd(ev))return ev;continue}}
    if(has(f,'regen')&&f.hp<f.maxHp){const h=Math.min(f.maxHp-f.hp,Math.max(1,Math.round(f.maxHp*REGEN)));f.hp+=h;ev.push({type:'regen',id:f.id,amt:h,hp:f.hp})}
    if(f.fx.root){tick(f);ev.push({type:'skip',id:f.id,why:'root'});continue}
    this.cur=f.id;ev.push({type:'turn',id:f.id,side:f.side});return ev}
  throw new Error('очередь не сходится')};
/* эффекты считаются ходами того, на ком они висят, и снимаются в конце его хода: «Промок на 2 хода» — два его хода */
function tick(f){Object.keys(f.fx).forEach(k=>{f.fx[k]--;if(f.fx[k]<=0){delete f.fx[k];if(k==='root')f.fx.firm=FIRM}})}
/* что может сделать текущий боец: приём и допустимые цели */
Battle.prototype.options=function(){
  const f=this.cur&&this.get(this.cur);if(!f||this.over)return [];
  const foes=this.alive(f.side==='A'?'B':'A').map(x=>x.id);
  return skillsOf(f).filter(s=>s.id!=='rage'||s.ready).map(s=>({skill:s,targets:s.self?[f.id]:foes}))};
/* ожидаемый урон без разброса и без точного удара: им пользуются подсказка игроку и компьютер */
Battle.prototype.expect=function(a,skill,t){
  if(!skill.power)return 0;
  const rush=skill.el==='A'&&this.rules.fx&&!this.acted(t)?EFFECT.A.rush:1;
  return DMG*skill.power*this.atkOf(a)*DEFK/(DEFK+this.defOf(t))*this.mult(skill.el,t)*(t.guard?GUARD:1)*this.traitK(skill,t)*rush};
/* действие текущего бойца: {skill:'strike'|'el:F'|'guard'|'rage', target, perfect}. Возвращает события; урон один раз */
Battle.prototype.act=function(a){
  if(this.over)throw new Error('бой окончен');
  const f=this.cur&&this.get(this.cur);if(!f)throw new Error('сейчас ничей ход');
  const op=this.options().find(o=>o.skill.id===(a&&a.skill));if(!op)throw new Error('нельзя: '+(a&&a.skill));
  const s=op.skill,ev=[],tid=s.self?f.id:a.target;
  if(!op.targets.includes(tid))throw new Error('нельзя в эту цель: '+tid);
  this.cur=null;this.acts++;
  ev.push({type:'use',id:f.id,skill:s.id,name:s.name,el:s.el||null,target:tid});
  if(s.swap){const i=f.load.indexOf(s.swap[0]);f.load[i]=s.swap[1];ev.push({type:'swap',id:f.id,load:f.load.slice()});tick(f);this.log.push(ev);return ev}
  if(s.swap){const best=load=>Math.max(0,...foes.map(t=>Math.max(...load.map(e=>this.expect(f,{power:POWER.element,el:e},t)))));
    const nl=f.load.map(e=>e===s.swap[0]?s.swap[1]:e),gain=best(nl)-best(f.load);return gain>0?gain/Math.max(1,...foes.map(t=>t.maxHp))*60:-5}
  if(s.id==='guard'){f.guard=true;f.rage=Math.min(RAGE.max,f.rage+RAGE.guard);ev.push({type:'guard',id:f.id,rage:f.rage});tick(f);this.log.push(ev);return ev}
  const t=this.get(tid),perfect=!!(a.perfect&&f.side==='A'),m=this.mult(s.el,t),rush=s.el==='A'&&this.rules.fx&&!this.acted(t);
  if(s.id==='rage'){f.rageUsed=true;f.rage=0}
  const raw=this.expect(f,s,t)*(perfect?PERFECT:1)*(1-SPREAD+2*SPREAD*this.rnd());
  const dmg=Math.max(1,Math.round(raw)),dealt=Math.min(dmg,t.hp);
  t.hp-=dealt;
  if(s.id!=='rage')f.rage=Math.min(RAGE.max,f.rage+RAGE.hit+(perfect?RAGE.perfect:0));
  if(t.hp>0)t.rage=Math.min(RAGE.max,t.rage+RAGE.taken);
  ev.push({type:'hit',id:f.id,target:t.id,dmg,dealt,hp:t.hp,mult:m,perfect,guarded:t.guard,skill:s.id,rush});
  const E=this.rules.fx&&s.el&&EFFECT[s.el];
  if(E&&(s.id==='rage'||this.rnd()<E.chance)){
    if(E.k==='heal'||E.k==='drain'){const h=Math.min(f.maxHp-f.hp,Math.round(dealt*(E.k==='heal'?HEAL_L:HEAL_D)));if(h>0){f.hp+=h;ev.push({type:'heal',id:f.id,amt:h,hp:f.hp})}
      /* Тьма: лечение всегда, ослабление цели только иногда (у «Ярости» всегда) */
      if(E.k==='drain'&&t.hp>0&&(s.id==='rage'||this.rnd()<E.weak)){if(has(t,'ward'))ev.push({type:'resist',target:t.id,name:E.name});else{t.fx.weak=Math.max(t.fx.weak||0,1);ev.push({type:'effect',target:t.id,fx:'weak',turns:t.fx.weak,name:E.name})}}}
    else if(t.hp>0){if(has(t,'ward'))ev.push({type:'resist',target:t.id,name:E.name});
      else if(E.k==='root'&&(t.fx.firm||t.fx.root))ev.push({type:'resist',target:t.id,name:E.name,why:'firm'});
      else{t.fx[E.k]=Math.max(t.fx[E.k]||0,E.turns);if(E.k==='slow')t.rage=Math.max(0,t.rage-E.rage);ev.push({type:'effect',target:t.id,fx:E.k,turns:E.turns,name:E.name})}}}
  if(t.hp>0&&has(t,'enrage')&&!t.enraged&&t.hp<=t.maxHp/2){t.enraged=true;ev.push({type:'enrage',id:t.id})}
  if(t.hp<=0){t.ko=true;t.fx={};t.guard=false;ev.push({type:'ko',id:t.id})}
  tick(f);this.checkEnd(ev);this.log.push(ev);return ev};
/* звёзды за победу: 3 — никто из команды не выбыл, 2 — выбыл один, 1 — остальные победы.
   Если у узла есть правило star3, третья звезда ещё и требует закончить бой не позже этого раунда */
Battle.prototype.stars=function(){
  if(this.winner!=='A')return 0;const lost=this.f.filter(x=>x.side==='A'&&x.ko).length,s=lost===0?3:lost===1?2:1;
  return s===3&&this.star3&&this.round>this.star3?2:s};

/* ---------- компьютер ----------
   Смотрит на стихии, оставшееся здоровье, возможность добить и защиту цели. Уровень: easy часто ошибается
   (выбирает случайно из трёх лучших), normal иногда берёт второй вариант, hard всегда лучший. Подглядывать в
   случайность нельзя: оценка идёт по ожидаемому урону. */
const AI={easy:{top:3,mist:0.5},normal:{top:2,mist:0.2},hard:{top:1,mist:0}};
Battle.prototype.score=function(f,op,tid){
  const s=op.skill,foes=this.alive(f.side==='A'?'B':'A');
  if(s.swap){const best=load=>Math.max(0,...foes.map(t=>Math.max(...load.map(e=>this.expect(f,{power:POWER.element,el:e},t)))));
    const nl=f.load.map(e=>e===s.swap[0]?s.swap[1]:e),gain=best(nl)-best(f.load);return gain>0?gain/Math.max(1,...foes.map(t=>t.maxHp))*60:-5}
  if(s.id==='guard'){
    const threat=Math.max(0,...foes.map(e=>Math.max(...skillsOf(e).filter(x=>x.power&&(x.id!=='rage'||x.ready)).map(x=>this.expect(e,x,f)))));
    return threat>=f.hp?45+(f.rage+RAGE.guard>=RAGE.max&&!f.rageUsed?10:0):f.hp<f.maxHp*0.3?12:2}
  const t=this.get(tid),e=this.expect(f,s,t),kill=e*(1-SPREAD)>=t.hp;
  let v=Math.min(e,t.hp)/t.maxHp*100;
  if(kill)v+=60+this.atkOf(t);                                   /* добить: минус один противник */
  else if(e>=t.hp)v+=25;                                         /* может добить, если повезёт */
  v+=(1-t.hp/t.maxHp)*10;                                         /* раненых сначала */
  v+=this.fxValue(f,s,t,e);
  if(s.id==='rage'&&!kill&&e<t.hp*0.6)v-=20;                      /* «Ярость» не тратить на крепкую цель */
  return v};
/* ожидаемая польза эффекта в тех же единицах, что урон (проценты здоровья цели): компьютер видит не только мгновенный урон */
Battle.prototype.fxValue=function(f,s,t,e){
  const E=this.rules.fx&&s.el&&EFFECT[s.el];if(!E)return 0;const p=s.id==='rage'?1:E.chance,alive=t.hp>e,ward=has(t,'ward');
  switch(E.k){
    case 'burn':return alive&&!ward?p*E.turns*BURN*100*0.8:0;
    case 'slow':return alive&&!ward?p*(4+E.rage*Math.min(1,t.rage/RAGE.max+0.3)/3):0;
    case 'brk':return alive&&!ward?p*(1-BRK)*25:0;
    case 'weak':return alive&&!ward?p*(1-WEAKK)*30:0;
    case 'root':return alive&&!ward&&!t.fx.firm&&!t.fx.root?p*35:0;
    case 'heal':return Math.min(f.maxHp-f.hp,e*HEAL_L)/f.maxHp*100;
    case 'drain':return Math.min(f.maxHp-f.hp,e*HEAL_D)/f.maxHp*100+(alive&&!ward?(s.id==='rage'?1:E.weak)*(1-WEAKK)*15:0)}
  return 0};
Battle.prototype.ai=function(level){
  const f=this.cur&&this.get(this.cur);if(!f)return null;const L=AI[level]||AI.normal;
  const all=[];this.options().forEach(op=>op.targets.forEach(t=>all.push({skill:op.skill.id,target:t,v:this.score(f,op,t)})));
  all.sort((a,b)=>b.v-a.v||(a.skill<b.skill?-1:1)||(a.target<b.target?-1:1));
  if(L.top>1&&this.rnd()<L.mist){const k=Math.min(all.length,L.top);return all[Math.floor(this.rnd()*k)]}
  return all[0]};
/* сыграть бой целиком компьютером за обе стороны (для проверок баланса) */
function simulate(A,B,o){o=o||{};const b=new Battle({A,B,seed:o.seed,maxRounds:o.maxRounds,star3:o.star3,rules:o.rules});let n=0;
  b.next();while(!b.over&&n++<500){const c=b.ai(b.get(b.cur).side==='A'?o.aiA||'normal':o.aiB||'normal');b.act(c);b.next()}
  return b}

const DRBATTLE={Battle,BEATS,STRONG_VS,strongVs,weakVs,pair,EL_NAME,EFFECT,POWER,RAGE,TRAITS,mult,skillsOf,simulate,rng,
  K:{STRONG,WEAK,BURN,SLOW,BRK,WEAKK,HEAL_L,HEAL_D,GUARD,PERFECT,DEFK,DMG,SPREAD,FIRM,MAX_ROUNDS,THICK,SHIELD,REGEN,ENRAGE}};
if(typeof module!=='undefined'&&module.exports)module.exports=DRBATTLE;else root.DRBATTLE=DRBATTLE;
})(typeof window!=='undefined'?window:globalThis);
