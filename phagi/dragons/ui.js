/* Драконы в «Карточках»: второй режим мотивации вместо чашки Петри.
   Грузится до основного скрипта страницы; S, esc, plural, today, streakInfo, GOAL и др. берутся из него в момент вызова.
   Данные ученицы: srs/<uid>/meta/dragons (тот же поток снимков, что и серия), правила базы уже дают туда запись самой ученице.
   Ресурсы не хранятся, они считаются из счётчика карточек по дням (streak.days) за дни, когда был включён режим драконов,
   минус потраченное (spent). Поэтому накрутить их можно только повторением карточек. */
(function(){
'use strict';
const G=window.DRG,W=window.DRAW;
const PAY={gold:10,food:4};          /* за каждую повторённую карточку */
const GEM_EVERY=15;                    /* самоцвет за засчитанный день и ещё по одному за каждые 15 карточек сверх цели */

const docOf=uid=>(S.drag||{})[uid]||null;
const on=uid=>{const d=docOf(uid);return !!d&&d.mode==='dragons'};

/* дни, когда режим драконов был включён: периоды [{from,to}] (to=null значит «до сих пор») */
function inPeriods(d,periods){return (periods||[]).some(p=>d>=p.from&&(!p.to||d<=p.to))}
function earned(uid){
  const d=docOf(uid),days=((S.streak[uid]||{}).days)||{},out={gold:0,food:0,gems:0};
  if(!d)return out;
  Object.entries(days).forEach(([k,n])=>{if(!n||!inPeriods(k,d.periods))return;
    out.gold+=n*PAY.gold;out.food+=n*PAY.food;if(n>=GOAL)out.gems+=1+Math.floor((n-GOAL)/GEM_EVERY)});
  return out}
function wallet(uid){const e=earned(uid),s=(docOf(uid)||{}).spent||{};return {gold:e.gold-(s.gold||0),food:e.food-(s.food||0),gems:e.gems-(s.gems||0)}}
function todayGain(uid){const n=((S.streak[uid]||{}).days||{})[today()]||0;return {gold:n*PAY.gold,food:n*PAY.food,gems:n>=GOAL?1+Math.floor((n-GOAL)/GEM_EVERY):0}}

/* ---------- первые драконы: пара с зерном от uid, у каждой ученицы своя ---------- */
function founders(uid){
  const r=G.rng(uid+':founders'),pick=(a,w)=>{let x=r()*w.reduce((s,v)=>s+v,0);for(let i=0;i<a.length;i++){x-=w[i];if(x<0)return a[i]}return a[a.length-1]};
  const coin=(a,b)=>r()<0.5?a:b,pair=f=>f()+'/'+f();
  const col=()=>pick(['C','Cb','c'],[5,3,2]);
  const base=sex=>({sex,S:'S/'+coin('S','s'),C:col()+'/'+col(),H:pair(()=>coin('H','h')),K:pair(()=>coin('K','k')),R:pair(()=>coin('R1','R2')),
    Wg:r()<0.15?'Wg/+':'+/+',Q1:pair(()=>coin('+','-')),Q2:pair(()=>coin('+','-')),Q3:pair(()=>coin('+','-'))});
  const f=Object.assign(base('F'),{E:'F/'+coin('F','e'),M:r()<0.3?'M':'m',N:r()<0.3?'n':'N',Sp:coin('Sp','sp'),G:r()<0.25?'G':'g'});
  const m=Object.assign(base('M'),{E:'W/'+coin('W','e'),M:pair(()=>r()<0.3?'M':'m'),N:pair(()=>r()<0.3?'n':'N')});
  return [{id:'d1',name:'Жара',born:today(),genome:G.make(f)},{id:'d2',name:'Прибой',born:today(),genome:G.make(m)}]}

/* ---------- запись ---------- */
let saving=Promise.resolve();
function save(uid,doc){
  doc=Object.assign({},doc,{updatedAt:now()});
  S.drag=S.drag||{};S.drag[uid]=doc;S.dragLocal=doc.updatedAt;
  saving=saving.then(()=>S.db.doc(`srs/${uid}/meta/dragons`).set(doc)).catch(e=>{fail(e)});
  return saving}
/* снимок с сервера: свой документ не заменяем более старым (запись могла ещё не дойти) */
function onSnap(uid,srv){
  S.drag=S.drag||{};
  if(uid===meId()&&S.drag[uid]&&srv&&String(srv.updatedAt||'')<String(S.drag[uid].updatedAt||''))return;
  S.drag[uid]=srv||null}

function setMode(mode){
  const uid=meId(),t=today(),cur=docOf(uid);
  if(mode==='dragons'){
    if(cur&&cur.mode==='dragons')return;
    const periods=((cur&&cur.periods)||[]).slice();
    const last=periods[periods.length-1];
    if(last&&last.to&&last.to>=addDays(t,-1))last.to=null;else periods.push({from:t,to:null});
    return save(uid,Object.assign({spent:{gold:0,food:0,gems:0},seq:2},cur||{dragons:founders(uid)},{mode:'dragons',periods}))}
  if(!cur||cur.mode!=='dragons')return;
  const periods=(cur.periods||[]).map(p=>p.to?p:{from:p.from,to:t});
  return save(uid,Object.assign({},cur,{mode:'petri',periods}))}

/* ---------- вид ---------- */
const SEX={F:'♀',M:'♂'},RCLS=['r0','r1','r2','r3','r4'];
const fmt=n=>String(Math.max(0,n)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
function phOf(d){return G.phenotype(d.genome)}
function dragonCard(uid,d){
  const ph=phOf(d),rr=G.rarity(ph);
  return `<article class="drg-card ${RCLS[rr]}"><div class="drg-pic">${W.svg(ph,{key:uid.slice(-6)+d.id,size:170,label:esc(d.name)})}</div>
  <div class="drg-info"><div class="drg-nm"><b>${esc(d.name)}</b><span class="drg-sex" title="${d.genome.sex==='F'?'самка ZW':'самец ZZ'}">${SEX[d.genome.sex]}</span><span class="drg-rar">${G.RARITY[rr]}</span></div>
  <ul>${W.describe(ph).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></article>`}

function walletHTML(uid){const w=wallet(uid),tg=todayGain(uid);
  return `<div class="drg-walw"><div class="drg-wal"><span title="Золото"><i aria-hidden="true">🪙</i><b>${fmt(w.gold)}</b><small>золото</small></span><span title="Корм"><i aria-hidden="true">🌾</i><b>${fmt(w.food)}</b><small>корм</small></span><span title="Самоцветы"><i aria-hidden="true">💎</i><b>${fmt(w.gems)}</b><small>самоцветы</small></span></div>
  <p class="muted small drg-today">Сегодня: +${fmt(tg.gold)} золота, +${fmt(tg.food)} корма${tg.gems?`, +${tg.gems} ${plural(tg.gems,'самоцвет','самоцвета','самоцветов')}`:''}</p></div>`}

function hero(uid,compact){
  const d=docOf(uid),info=streakInfo(S.streak[uid]),n=info.cur,first=(d.dragons||[])[0];
  if(compact)return `<div class="streak-mini drg-mini${info.done?' done':''}">${first?W.svg(phOf(first),{key:'m'+uid.slice(-6),size:64}):''}<div><b>${n}</b> <span>${plural(n,'день','дня','дней')} подряд</span><br><small class="muted">${info.done?'сегодня засчитано':`сегодня ${info.todayN} из ${GOAL}`}</small></div></div>`;
  const left=Math.max(0,GOAL-info.todayN),ds=d.dragons||[];
  return `<section class="drg-hero${info.done?' done':''}">
  <div class="drg-top"><div><div class="st-k">Остров драконов</div><div class="st-n"><b>${n}</b><span>${plural(n,'день','дня','дней')} подряд</span></div>
  <p class="st-msg">${info.done?`День засчитан: ${info.todayN} ${plural(info.todayN,'карточка','карточки','карточек')}. Каждая следующая тоже приносит золото и корм.`:`Сегодня ${info.todayN} из ${GOAL}. Ещё ${left} ${plural(left,'карточка','карточки','карточек')}, и день засчитан, а на острове появится самоцвет.`}</p></div>
  ${walletHTML(uid)}</div>
  <div class="drg-list">${ds.map(x=>dragonCard(uid,x)).join('')}</div>
  <p class="muted small drg-note">За каждую карточку 10 золота и 4 корма, за засчитанный день самоцвет и ещё по одному за каждые ${GEM_EVERY} карточек сверх цели. Генотип драконов скрыт: виден только фенотип. Остров со зданиями, скрещивание и лаборатория откроются в следующих обновлениях.</p>
  </section>`}

function switchHTML(){
  if(T())return '';const dr=on(meId());
  return `<div class="drg-sw"><span class="muted small">Мотивация</span><div class="cvs" role="group" aria-label="Мотивация"><button data-act="drgmode" data-v="petri" aria-pressed="${!dr}">🧫 Бактерии</button><button data-act="drgmode" data-v="dragons" aria-pressed="${dr}">🐉 Драконы</button></div></div>`}

/* значок в шапке повторения вместо мини-чашки */
function reviewBadge(uid){const tg=todayGain(uid),info=streakInfo(S.streak[uid]);
  return `<span class="rv-dish drg-rv" title="Остров драконов"><i aria-hidden="true">🪙</i><small>${info.done?'+'+fmt(tg.gold):info.todayN+'/'+GOAL}</small></span>`}
function dayDoneHTML(uid){const inf=streakInfo(S.streak[uid]),first=((docOf(uid)||{}).dragons||[])[0];
  return `<div class="party-dish">${first?W.svg(phOf(first),{key:'p'+uid.slice(-6),size:150}):''}<span class="plus">💎</span></div><div class="big">${inf.cur} ${plural(inf.cur,'день','дня','дней')}</div><p><b>Серия продлена!</b> На остров прилетел самоцвет, а драконы получили золото и корм за каждую карточку. Каждые ${GEM_EVERY} карточек сверх ${GOAL} дают ещё один самоцвет.</p>`}

window.DRGUI={on,hero,switchHTML,reviewBadge,dayDoneHTML,onSnap,wallet,earned,founders,setMode};
window.DRG_ACTIONS={
  drgmode:async el=>{const v=el.dataset.v;await setMode(v);toast(v==='dragons'?'Включены драконы. Чашка Петри никуда не делась, вернуться можно в любой момент.':'Включены бактерии. Драконы ждут на острове.')}
};
})();
