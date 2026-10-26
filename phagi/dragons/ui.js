/* Драконы в «Карточках»: второй режим мотивации вместо чашки Петри, и страница «Остров драконов».
   Грузится до основного скрипта страницы; S, esc, plural, today, streakInfo, frozenDays, GOAL и др. берутся из него в момент вызова.
   Данные ученицы: srs/<uid>/meta/dragons (тот же поток снимков, что и серия), правила базы уже дают туда запись самой ученице.
   Вся игровая логика в economy.js; здесь только вид, часы острова и запись. */
(function(){
'use strict';
const G=window.DRG,W=window.DRAW,E=window.DECO,I=window.ISL;

const docOf=uid=>(S.drag||{})[uid]||null;
const on=uid=>{const d=docOf(uid);return !!d&&d.mode==='dragons'};

/* часы острова и доход за дни из счётчика карточек */
function ctxOf(uid){
  const st=S.streak[uid]||{},d=docOf(uid)||{},info=streakInfo(st);
  const inc=E.income(st.days||{},frozenDays(st).fz,d.periods,GOAL);
  return {K:inc.K,inc,streak:info.cur,info,uid,today:today()}}
/* состояние на сейчас: старые документы этапа 1 (без v) превращаются в остров с теми же драконами */
function stateOf(uid){
  const d=docOf(uid);if(!d)return null;const c=ctxOf(uid);
  let base=d;if(d.v!==2){base=Object.assign(E.startState(d.dragons||founders(uid)),{mode:d.mode,periods:d.periods});E.settle(base,c.K)}
  return {st:E.normalize(base,c.K,c.inc),c}}

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

/* ---------- запись: по одной за раз, свой документ не заменяем более старым снимком ---------- */
let saving=Promise.resolve();
function save(uid,doc){
  doc=Object.assign({},doc,{updatedAt:now()});delete doc.got;delete doc.lvup;delete doc.last;
  S.drag=S.drag||{};S.drag[uid]=doc;
  saving=saving.then(()=>S.db.doc(`srs/${uid}/meta/dragons`).set(doc)).catch(e=>{fail(e)});
  return saving}
function onSnap(uid,srv){
  S.drag=S.drag||{};
  if(uid===meId()&&S.drag[uid]&&srv&&String(srv.updatedAt||'')<String(S.drag[uid].updatedAt||''))return;
  S.drag[uid]=srv||null}

function setMode(mode){
  const uid=meId(),t=today(),cur=docOf(uid);
  if(mode==='dragons'){
    if(cur&&cur.mode==='dragons')return;
    const periods=((cur&&cur.periods)||[]).map(p=>Object.assign({},p)),last=periods[periods.length-1];
    if(last&&last.to&&last.to>=addDays(t,-1))last.to=null;else periods.push({from:t,to:null});
    let base=cur&&cur.v===2?cur:null;
    if(!base){base=E.startState((cur&&cur.dragons)||founders(uid));const st=S.streak[uid]||{};E.settle(base,E.income(st.days||{},frozenDays(st).fz,periods,GOAL).K)}
    return save(uid,Object.assign({},base,{mode:'dragons',periods}))}
  if(!cur||cur.mode!=='dragons')return;
  return save(uid,Object.assign({},cur,{mode:'petri',periods:(cur.periods||[]).map(p=>p.to?p:{from:p.from,to:t})}))}

/* действие на острове: считаем от текущего момента, пишем результат */
function act(a){
  const uid=meId(),x=stateOf(uid);if(!x)return null;
  const r=E.apply(x.st,x.c,a);
  if(r.err){toast(r.err);return null}
  const d=docOf(uid);save(uid,Object.assign({},r.s,{mode:d.mode,periods:d.periods}));
  if(r.levelUp)setTimeout(()=>toast(`Остров вырос до ${r.levelUp}-го уровня! +2 💎 и новые постройки`),400);
  return r}

/* ---------- вид: общие кусочки ---------- */
const SEX={F:'♀',M:'♂'},RCLS=['r0','r1','r2','r3','r4'];
const fmt=n=>String(Math.max(0,Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
const cards=n=>`${n} ${plural(n,'карточка','карточки','карточек')}`;
const cardsAcc=n=>`${n} ${plural(n,'карточку','карточки','карточек')}`;
const phOf=d=>G.phenotype(d.genome);
const HOSTS={F:'огненные',W:'водные',T:'земляные',A:'воздушные',P:'лесные',L:'драконы света',D:'драконы тьмы',smoke:'дымные',dormant:'дремлющие'};

function walletHTML(st){const b=st.bal;
  return `<div class="drg-wal"><span title="Золото"><i aria-hidden="true">🪙</i><b>${fmt(b.gold)}</b><small>золото</small></span><span title="Корм"><i aria-hidden="true">🌾</i><b>${fmt(b.food)}</b><small>корм</small></span><span title="Самоцветы"><i aria-hidden="true">💎</i><b>${fmt(b.gems)}</b><small>самоцветы</small></span></div>`}
function lvlHTML(st){const L=E.level(st),a=E.xpFor(L),b=E.xpFor(L+1),p=Math.round((st.bal.xp-a)/Math.max(1,b-a)*100);
  return `<div class="drg-lv" title="Опыт ${fmt(st.bal.xp)} из ${fmt(b)}"><b>${L}</b><span><small>уровень острова</small><span class="drg-xp"><i style="width:${p}%"></i></span></span></div>`}

/* что ждёт на острове: сундуки, урожай, стройки */
function todo(st,K){
  let gold=0,full=0,crops=0,builds=0;
  st.bld.forEach(b=>{const T=E.TYPES[b.type];
    if(T.kind==='hab'){const a=E.chestNow(st,b,K);gold+=a;if(a>=E.chestCap(b))full++}
    (b.plots||[]).forEach(p=>{if(p&&E.ready(p,K))crops++});
    if((b.build&&E.ready(b.build,K))||(b.up&&E.ready(b.up,K)))builds++});
  return {gold:Math.floor(gold),full,crops,builds}}
const rateAll=st=>st.bld.reduce((x,b)=>x+E.rate(st,b),0);

/* ---------- «Карточки»: сводка вместо чашки ---------- */
function hero(uid,compact){
  const x=stateOf(uid);if(!x)return '';const {st,c}=x,info=c.info,n=info.cur,first=st.dragons[0];
  if(compact)return `<div class="streak-mini drg-mini${info.done?' done':''}">${first?W.svg(phOf(first),{key:'m'+uid.slice(-6),size:64}):''}<div><b>${n}</b> <span>${plural(n,'день','дня','дней')} подряд</span><br><small class="muted">${info.done?'сегодня засчитано':`сегодня ${info.todayN} из ${GOAL}`}</small></div></div>`;
  const left=Math.max(0,GOAL-info.todayN),td=todo(st,c.K),rt=rateAll(st),ration=E.RATION(info.done?n:n+1);
  const notes=[];
  if(td.gold)notes.push(`🪙 в сундуках ${fmt(td.gold)}${td.full?`, ${td.full} ${plural(td.full,'полон','полны','полны')}`:''}`);
  if(td.crops)notes.push(`🌾 созрело ${td.crops} ${plural(td.crops,'грядка','грядки','грядок')}`);
  if(td.builds)notes.push(`🔨 стройка готова`);
  const own=uid===meId();
  return `<section class="drg-hero${info.done?' done':''}">
  <div class="drg-top"><div><div class="st-k">Остров драконов</div><div class="st-n"><b>${n}</b><span>${plural(n,'день','дня','дней')} подряд</span></div>
  <p class="st-msg">${info.done?`День засчитан. Паёк ${ration} корма уже на острове, а каждая следующая карточка приносит драконам ещё ${fmt(rt)} золота.`:`Сегодня ${info.todayN} из ${GOAL}. Ещё ${cardsAcc(left)}, и придёт дневной паёк ${ration} корма и самоцвет. Каждая карточка уже сейчас приносит ${fmt(rt)} золота.`}</p></div>
  <div class="drg-side">${lvlHTML(st)}${walletHTML(st)}</div></div>
  <div class="drg-strip">${st.dragons.slice(0,8).map(d=>`<span class="drg-chip" title="${esc(d.name)}, ${d.lvl}-й уровень">${W.svg(phOf(d),{key:'h'+uid.slice(-6)+d.id,size:56})}<small>${esc(d.name)} · ${d.lvl}</small></span>`).join('')}</div>
  <div class="drg-go">${notes.length?`<span class="drg-notes">${notes.join(' · ')}</span>`:'<span class="muted small">Остров ждёт новых карточек.</span>'}<button class="btn" data-act="drgopen" data-uid="${uid}">${own?'На остров':'Открыть остров'}</button></div>
  </section>`}

function switchHTML(){
  if(T())return '';const dr=on(meId());
  return `<div class="drg-sw"><span class="muted small">Мотивация</span><div class="cvs" role="group" aria-label="Мотивация"><button data-act="drgmode" data-v="petri" aria-pressed="${!dr}">🧫 Бактерии</button><button data-act="drgmode" data-v="dragons" aria-pressed="${dr}">🐉 Драконы</button></div></div>`}

function reviewBadge(uid){const x=stateOf(uid);if(!x)return '';const info=x.c.info,rt=rateAll(x.st);
  return `<span class="rv-dish drg-rv" title="Каждая карточка приносит драконам ${fmt(rt)} золота"><i aria-hidden="true">🪙</i><small>${info.done?'+'+fmt(rt*info.todayN):info.todayN+'/'+GOAL}</small></span>`}
function dayDoneHTML(uid){const x=stateOf(uid);if(!x)return '';const inf=x.c.info,first=x.st.dragons[0];
  return `<div class="party-dish">${first?W.svg(phOf(first),{key:'p'+uid.slice(-6),size:150}):''}<span class="plus">💎</span></div><div class="big">${inf.cur} ${plural(inf.cur,'день','дня','дней')}</div><p><b>Серия продлена!</b> На остров пришёл паёк ${E.RATION(inf.cur)} корма и самоцвет. Чем длиннее серия, тем больше паёк и урожай с грядок.</p>`}

/* ---------- страница «Остров драконов» ---------- */
function islandView(){
  const uid=S.drgUid||meId(),own=uid===meId(),x=stateOf(uid);
  const back=`<button class="back" data-act="go" data-v="cards">← К карточкам</button>`;
  if(!x)return back+`<div class="empty">Остров ещё не открыт.</div>`;
  const {st,c}=x,K=c.K;
  if(S.drgSel&&!st.bld.some(b=>b.id===S.drgSel))S.drgSel=null;
  const pl=own?S.drgPlace:null;
  const head=`${back}<div class="drg-ih"><div class="drg-ih-t"><h1>Остров драконов${own?'':': '+esc(name(uid))}</h1><span class="muted small">Время на острове идёт в карточках: повторено ${cards(K)}</span></div>${lvlHTML(st)}${walletHTML(st)}</div>`;
  const tools=own?`<div class="drg-tools">${pl?`<span class="drg-hint">${pl.move?'Нажмите, куда перенести здание':'Нажмите на зелёную клетку, где поставить: '+E.TYPES[pl.type].name}</span><button class="btn ghost sm" data-act="drgcancel">Отмена</button>`
    :`<button class="btn sm" data-act="drgpanel" data-v="shop">🏗 Построить</button><button class="btn ghost sm" data-act="drgpanel" data-v="market">🐉 Рынок</button><button class="btn ghost sm" data-act="drgpanel" data-v="dragons">📖 Драконы</button><button class="btn ghost sm" data-act="drgpanel" data-v="help">Как это работает</button>`}</div>`:'';
  const map=`<div class="drg-map${pl?' placing':''}">${I.svg(st,{K,sel:S.drgSel,place:pl,key:'isl',readonly:!own})}</div>`;
  return head+tools+map+panel(st,c,own);
}

function panel(st,c,own){
  const K=c.K,L=E.level(st),p=S.drgPanel;
  if(own&&p==='shop')return shopHTML(st,L);
  if(own&&p==='market')return marketHTML(st,L);
  if(p==='dragons')return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Драконы острова</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div><div class="drg-list">${st.dragons.map(d=>dragonCard(st,d,own,L)).join('')}</div></section>`;
  if(p==='help')return helpHTML(st,c);
  const b=st.bld.find(x=>x.id===S.drgSel);
  if(!b)return `<p class="muted small drg-tip">${own?'Нажмите на здание, чтобы собрать золото, покормить драконов или посадить корм.':'Это остров ученицы, здесь можно только смотреть.'}</p>`;
  const T=E.TYPES[b.type],job=b.build||b.up;
  let h=`<section class="sheet drg-pan"><div class="drg-pan-h"><h2>${T.name}${b.build?'':` · ${b.lvl}-й уровень`}</h2><button class="btn ghost sm" data-act="drgsel" data-id="">Закрыть</button></div>`;
  if(job){const lf=E.left(job,K);
    h+=`<p>${b.build?'Строится':'Улучшается до '+job.to+'-го уровня'}: осталось ${cardsAcc(lf)}.${b.up&&T.kind==='hab'?' Драконы при этом продолжают приносить золото.':''}</p>${own?`<div class="actions" style="justify-content:flex-start"><button class="btn sm" data-act="drgdo" data-t="speed" data-id="${b.id}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button></div>`:''}`}
  if(T.kind==='hab'&&!b.build){
    const a=E.chestNow(st,b,K),cap=E.chestCap(b),ds=st.dragons.filter(d=>d.home===b.id),r=E.rate(st,b);
    h+=`<div class="drg-chest"><span>🪙 В сундуке <b>${fmt(a)}</b> из ${fmt(cap)}</span><span class="drg-bar"><i style="width:${Math.min(100,a/cap*100)}%"></i></span><span class="muted small">${r?`+${fmt(r)} за каждую карточку`:'Пока здесь нет драконов'}${a>=cap?', сундук полон: соберите, иначе золото пропадает':''}</span>${own?`<button class="btn sm" data-act="drgdo" data-t="collect" data-id="${b.id}"${a>=1?'':' disabled'}>Собрать</button>`:''}</div>`;
    h+=`<p class="muted small">Живут: ${T.hosts.map(k=>HOSTS[k]).join(' и ')}. Мест ${ds.length} из ${E.habCap(b)}.</p>`;
    h+=`<div class="drg-list">${ds.map(d=>dragonCard(st,d,own,L)).join('')||'<p class="muted small">Здесь пока никто не живёт.</p>'}</div>`}
  if(T.kind==='farm'&&!b.build){
    h+=`<div class="drg-plots">${b.plots.map((pl,i)=>{
      if(!pl)return `<div class="drg-plot"><b>Грядка ${i+1}</b><span class="muted small">Пусто</span>${own?`<div class="drg-crops">${Object.entries(E.CROPS).map(([k,cr])=>`<button class="btn ghost sm" data-act="drgdo" data-t="plant" data-id="${b.id}" data-plot="${i}" data-crop="${k}"${L<cr.unlock?' disabled title="Откроется на '+cr.unlock+'-м уровне острова"':''}>${cr.name}<small>${cr.cost} 🪙 · ${cr.need} к. → ${Math.round(cr.food*E.streakMult(c.streak))} 🌾</small></button>`).join('')}</div>`:''}</div>`;
      const cr=E.CROPS[pl.crop],rd=E.ready(pl,K),lf=E.left(pl,K);
      return `<div class="drg-plot${rd?' ready':''}"><b>Грядка ${i+1}: ${cr.name}</b><span class="drg-bar"><i style="width:${Math.min(100,(pl.need-lf)/pl.need*100)}%"></i></span><span class="muted small">${rd?`Созрело: ${Math.round(cr.food*E.streakMult(c.streak))} корма${c.streak?` (серия +${Math.round((E.streakMult(c.streak)-1)*100)} %)`:''}`:`Осталось ${cardsAcc(lf)}`}</span>${own?(rd?`<button class="btn sm" data-act="drgdo" data-t="harvest" data-id="${b.id}" data-plot="${i}">Собрать урожай</button>`:`<button class="btn ghost sm" data-act="drgdo" data-t="speed" data-id="${b.id}" data-plot="${i}">Ускорить за ${Math.ceil(lf/E.SKIP_CARDS)} 💎</button>`):''}</div>`}).join('')}</div>`}
  if(own){const nx=(T.kind==='hab'?E.HAB_LV:T.kind==='farm'?E.FARM_LV:[])[b.lvl+1];
    h+=`<div class="actions" style="justify-content:flex-start">${nx&&!job?`<button class="btn ghost sm" data-act="drgdo" data-t="upgrade" data-id="${b.id}">Улучшить до ${b.lvl+1}-го: ${fmt(nx.cost)} 🪙, ${nx.need} к.${T.kind==='hab'?` (мест ${E.HAB_LV[b.lvl+1].cap}, сундук ${fmt(E.HAB_LV[b.lvl+1].chest)})`:` (грядок ${E.FARM_LV[b.lvl+1].plots})`}</button>`:''}<button class="btn ghost sm" data-act="drgmove" data-id="${b.id}">Переместить</button></div>`}
  return h+`</section>`}

function dragonCard(st,d,own,L){
  const ph=phOf(d),rr=G.rarity(ph),cost=E.feedCost(d.lvl),cap=E.maxDragonLv(L),home=st.bld.find(b=>b.id===d.home);
  const homes=own?st.bld.filter(b=>b.id!==d.home&&!b.build&&E.hosts(b.type,ph)&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b)):[];
  return `<article class="drg-card ${RCLS[rr]}"><div class="drg-pic">${W.svg(ph,{key:'c'+d.id,size:170,label:esc(d.name)})}</div>
  <div class="drg-info"><div class="drg-nm"><b>${esc(d.name)}</b><span class="drg-sex" title="${d.genome.sex==='F'?'самка ZW':'самец ZZ'}">${SEX[d.genome.sex]}</span><span class="drg-rar">${G.RARITY[rr]}</span></div>
  <div class="drg-dl"><span>${d.lvl}-й уровень</span><span class="drg-pips" title="Кормлений до следующего уровня">${Array.from({length:E.FEEDS},(_,i)=>`<i${i<(d.fed||0)?' class="on"':''}></i>`).join('')}</span><span class="muted">+${fmt(E.goldPerCard(d))} 🪙 за карточку</span></div>
  <ul>${W.describe(ph).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  <p class="muted small" style="margin:4px 0 0">${home?'Живёт: '+E.TYPES[home.type].name:'Без дома'}</p>
  ${own?`<div class="drg-da">${d.lvl<cap?`<button class="btn sm" data-act="drgdo" data-t="feed" data-dragon="${d.id}"${st.bal.food<cost?' disabled':''}>Покормить: ${cost} 🌾</button>`:`<span class="muted small">Следующий уровень откроется с ростом острова</span>`}
  ${homes.map(b=>`<button class="btn ghost sm" data-act="drgdo" data-t="place" data-dragon="${d.id}" data-home="${b.id}">Переселить: ${E.TYPES[b.type].name}</button>`).join('')}
  <button class="btn ghost sm" data-act="drgrename" data-dragon="${d.id}">Имя</button></div>`:''}</div></article>`}

/* миниатюра постройки для магазина: тот же рисунок острова, обрезанный до одной площадки */
function bldThumb(k){
  const s=I.svg({land:[],bld:[{id:'s'+k,type:k,x:5,y:5,lvl:1,plots:[null,null]}],dragons:[]},{K:0,key:'s'+k,readonly:true,bare:true});
  return s.replace(/viewBox="[^"]+"/,'viewBox="326 186 148 150"')}
function shopHTML(st,L){
  const row=k=>{const t=E.TYPES[k],lock=L<t.unlock,full=t.kind==='hab'?E.count(st,'hab')>=E.maxHabs(L):t.kind==='farm'?E.count(st,'farm')>=E.maxFarms(L):false;
    const why=t.soon?'В следующем обновлении':lock?`С ${t.unlock}-го уровня`:full?'Лимит на этом уровне':'';
    return `<button class="drg-shop-i" data-act="drgbuild" data-type="${k}"${why?' disabled':''}><span class="drg-shop-pic">${bldThumb(k)}</span>
      <b>${t.name}</b><small>${t.kind==='hab'?'для: '+t.hosts.map(h=>HOSTS[h]).join(', '):t.kind==='farm'?'корм для драконов':'для скрещивания'}</small><span class="drg-price">${fmt(t.cost)} 🪙${t.gems?' + '+t.gems+' 💎':''} · ${t.need} к.</span>${why?`<em>${why}</em>`:''}</button>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Построить</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <p class="muted small">Сред обитания ${E.count(st,'hab')} из ${E.maxHabs(L)}, ферм ${E.count(st,'farm')} из ${E.maxFarms(L)} на ${L}-м уровне. Стройка идёт в карточках: «10 к.» значит, что здание будет готово через 10 повторённых карточек.</p>
  <div class="drg-shop">${[...E.HAB_ORDER,'farm','nest','hatch'].map(row).join('')}</div></section>`}

const MK_NAME={F:'Огненный дракон',W:'Водный дракон',N:'Дымный дракон',T:'Земляной дракон',A:'Воздушный дракон',P:'Лесной дракон'};
function marketHTML(st,L){
  const row=k=>{const t=E.TYPES[k],lock=L<t.unlock,home=st.bld.some(b=>b.type===k&&!b.build&&st.dragons.filter(x=>x.home===b.id).length<E.habCap(b));
    const ph=G.phenotype(E.marketGenome(k,'preview')),why=lock?`С ${t.unlock}-го уровня`:!home?`Нужна свободная ${t.name.toLowerCase()}`:'';
    return `<div class="drg-shop-i"><span class="drg-shop-pic">${W.svg(ph,{key:'mk'+k,size:110})}</span><b>${MK_NAME[k]}</b><small>обычный, генотип неизвестен</small><span class="drg-price">${fmt(t.price)} 🪙</span>${why?`<em>${why}</em>`:`<button class="btn sm" data-act="drgdo" data-t="buy" data-type="${k}">Купить</button>`}</div>`};
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Рынок драконов</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <p class="muted small">На рынке продают только обычных драконов одной стихии, и каждый выглядит по-своему. Что они несут в генотипе, покажет только потомство: с этого и начинается генетика. Редкие и легендарные драконы появляются лишь при скрещивании.</p>
  <div class="drg-shop">${['F','W','N','T','A','P'].map(row).join('')}</div></section>`}

function helpHTML(st,c){
  return `<section class="sheet drg-pan"><div class="drg-pan-h"><h2>Как это работает</h2><button class="btn ghost sm" data-act="drgpanel" data-v="">Закрыть</button></div>
  <ul class="drg-help">
  <li>Время на острове идёт в карточках. Пока карточки не повторяются, остров стоит: сундуки не наполняются, корм не растёт, стройка не идёт.</li>
  <li>Золото. Каждый дракон в своей среде приносит золото за каждую карточку: чем выше уровень и редкость, тем больше. Золото копится в сундуке здания до его вместимости, собирайте его нажатием.</li>
  <li>Корм. Дневной паёк приходит, когда за день набрано ${GOAL} карточек: ${E.RATION(1)} корма и ещё 5 за каждый день серии, до ${E.RATION(99)}. Грядки на ферме созревают за карточки, а урожай больше на 2,5 % за каждый день серии, до +50 %.</li>
  <li>Самоцветы. Один за засчитанный день и ещё по одному за каждые ${GOAL} карточек сверх цели, награды за серию ${E.MILESTONES.map(m=>m[0]).join(', ')} дней и по 2 за каждый уровень острова. Самоцвет заменяет ${E.SKIP_CARDS} карточек ожидания стройки или грядки.</li>
  <li>Кормление. Дракон растёт в уровнях: ${E.FEEDS} кормления на уровень, корма нужно всё больше. Предел уровня драконов растёт вместе с уровнем острова.</li>
  <li>Опыт и уровень острова. Опыт дают стройка, кормление, урожай и покупки. Уровень открывает новые среды обитания, фермы и культуры, а с 4-го уровня будет Гнездовье для скрещивания.</li>
  </ul><p class="muted small">Сейчас: серия ${c.streak} ${plural(c.streak,'день','дня','дней')}, рекорд в режиме драконов ${c.inc.best}.</p></section>`}

/* на узком экране карта шире окна: сначала показываем середину острова, а после перерисовки возвращаем прокрутку */
document.addEventListener('scroll',e=>{const m=e.target;if(m&&m.classList&&m.classList.contains('drg-map'))S.drgScroll=m.scrollLeft},true);
new MutationObserver(()=>{const m=document.querySelector('.drg-map');if(!m||m.dataset.sc)return;m.dataset.sc='1';
  m.scrollLeft=S.drgScroll!=null?S.drgScroll:(m.scrollWidth-m.clientWidth)/2}).observe(document.documentElement,{childList:true,subtree:true});

/* ---------- действия ---------- */
const num=v=>v==null||v===''?undefined:Number(v);
window.DRGUI={on,hero,switchHTML,reviewBadge,dayDoneHTML,onSnap,islandView,stateOf,founders,setMode};
window.DRG_ACTIONS={
  drgmode:async el=>{const v=el.dataset.v;await setMode(v);toast(v==='dragons'?'Включены драконы. Чашка Петри никуда не делась, вернуться можно в любой момент.':'Включены бактерии. Драконы ждут на острове.')},
  drgopen:el=>{S.drgUid=el.dataset.uid||meId();S.view='island';S.drgSel=null;S.drgPanel=null;S.drgPlace=null;window.scrollTo(0,0);
    S.drgScroll=null},
  drgsel:el=>{if(S.drgPlace)return;S.drgSel=el.dataset.id||null;S.drgPanel=null},
  drgpanel:el=>{S.drgPanel=el.dataset.v||null;S.drgSel=null;S.drgPlace=null},
  drgbuild:el=>{S.drgPlace={type:el.dataset.type};S.drgPanel=null;S.drgSel=null;window.scrollTo(0,0);toast('Выберите место на острове')},
  drgmove:el=>{S.drgPlace={move:el.dataset.id};window.scrollTo(0,0)},
  drgcancel:()=>{S.drgPlace=null},
  drgtile:el=>{const p=S.drgPlace;if(!p)return;const x=+el.dataset.x,y=+el.dataset.y;
    const r=p.move?act({t:'move',id:p.move,x,y}):act({t:'build',type:p.type,x,y});
    if(r){S.drgPlace=null;if(!p.move){S.drgSel=r.s.last;toast(`Стройка началась: ${E.TYPES[p.type].name}`)}}},
  drgland:async el=>{const c=el.dataset.c,cost=E.LAND_COST[c];if(!cost)return;
    if(!await askConfirm(`Расчистить участок за ${cost.gold?fmt(cost.gold)+' золота':cost.gems+' самоцветов'}?`,'Расчистить'))return;if(act({t:'expand',chunk:c}))toast('Участок расчищен')},
  drgdo:el=>{const d=el.dataset,a={t:d.t,id:d.id,dragon:d.dragon,home:d.home,crop:d.crop,type:d.type,plot:num(d.plot)};
    const r=act(a);if(!r)return;
    if(r.s.got&&r.s.got.gold)toast(`+${fmt(r.s.got.gold)} золота`);
    else if(r.s.got&&r.s.got.food)toast(`+${fmt(r.s.got.food)} корма`);
    else if(r.s.lvup){const x=r.s.dragons.find(z=>z.id===r.s.lvup);toast(`${x.name} вырос до ${x.lvl}-го уровня!`)}
    else if(d.t==='buy'){const x=r.s.dragons.find(z=>z.id===r.s.last);toast(`На острове новый дракон: ${x.name}`)}},
  drgrename:el=>{const x=stateOf(meId()),d=x&&x.st.dragons.find(z=>z.id===el.dataset.dragon);if(!d)return;
    const n=prompt('Имя дракона',d.name);if(n!=null&&n.trim())act({t:'rename',dragon:d.id,name:n})}
};
})();
