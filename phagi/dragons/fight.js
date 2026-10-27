/* Поход и бой 3 на 3 (этапы 5 и 7 Драконов 3.0): экран на всё окно поверх острова, как осмотр.
   Три экрана: карта похода → подготовка (выбор до трёх драконов, противники) → бой → итог.
   Урон, эффекты, очередь и конец боя считает battle.js, один раз на действие; данные похода в campaign.js;
   сцена и атаки в scene.js и attacks.js. Здесь только показ, выбор игрока и запись звёзд через api.record.
   Награда похода — только звёзды: золото, корм и самоцветы за бои не начисляются, экономику острова этот файл не трогает.
   api: {dragons() → [{id,name,genome,lvl}], progress() → прогресс похода, record(id,звёзды) → новый прогресс, onClose()} */
(function(root){
'use strict';
if(typeof document==='undefined')return;

/* ---------- подгрузка ---------- */
const SRC_URL=(()=>{try{const u=new URL(document.currentScript.src);return {dir:u.origin+u.pathname.replace(/[^/]*$/,''),q:u.search}}catch(e){return {dir:'dragons/',q:''}}})();
const NEED=[['DRATK','attacks'],['DRSCENE','scene'],['DRBATTLE','battle'],['DRCAMP','campaign']];
let loading=null;
function loadAll(){
  if(loading)return loading;
  loading=root.DRGINSP.loadAll().then(()=>NEED.reduce((p,[g,f])=>p.then(()=>root[g]?null:new Promise((res,rej)=>{const s=document.createElement('script');
    s.src=SRC_URL.dir+f+'.js'+SRC_URL.q;s.onload=res;s.onerror=()=>rej(new Error('не загрузился '+f+'.js'));document.head.appendChild(s)})),Promise.resolve()));
  loading.catch(()=>{loading=null});
  return loading}

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const f1=v=>String(Math.round(v*100)/100).replace('.',',');
const EL_IC={F:'🔥',W:'💧',T:'🪨',A:'🌪',P:'🌿',L:'✨',D:'🌑'};
const FX_IC={burn:'🔥',slow:'💧',brk:'🪨',weak:'🌀',root:'🌿'};
const FX_TXT={burn:'ожог',slow:'промок',brk:'трещина в броне',weak:'сбит с толку',root:'опутан'};
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}};

/* ---------- бойцы из драконов модели ---------- */
const specCache=new Map();
function specOf(id,name,genome,lvl,side){
  const key=JSON.stringify([genome,lvl]);let c=specCache.get(key);
  if(!c){const ph=root.DRG.phenotype(genome),M=root.MORPH.morph(ph,lvl),G=root.SHAPE.build(M),P=root.ANIM.profile(M,G.rig),s=root.DSTATS.of(ph,lvl,P);
    c={ph,M,els:ph.breath==='element'?ph.elements.slice():[],s,baby:!!P.baby};if(specCache.size>80)specCache.clear();specCache.set(key,c)}
  return {id,name,lvl,els:c.els,hp:c.s.hp,atk:c.s.atk,def:c.s.def,spd:c.s.spd,ref:{ph:c.ph,M:c.M,genome,side}}}
const foeSpecs=bt=>bt.foes().map(f=>specOf('x:'+f.id,f.name,f.genome,f.lvl,'B'));
const myDragons=()=>(F&&F.api.dragons()||[]).map(d=>specOf(d.id,d.name,d.genome,d.lvl,'A'));
const elsText=els=>els.length?els.map(e=>EL_IC[e]+' '+root.DRBATTLE.EL_NAME[e]).join(' и '):'без стихии';
/* лучший множитель стихий a против b и обратно: подсказка в подготовке и при выборе цели */
function edge(a,b){const B=root.DRBATTLE;
  return {out:a.els.length?Math.max(...a.els.map(e=>B.mult(e,b.els))):1,inn:b.els.length?Math.max(...b.els.map(e=>B.mult(e,a.els))):1}}

/* портрет из нового рисунка: тот же риг, поза покоя, картинка кешируется по генотипу и уровню */
const pics=new Map();let picQ=Promise.resolve();
function portrait(sp,W,H){
  const key=JSON.stringify([sp.ref.genome,sp.lvl,W,H]);if(pics.has(key))return pics.get(key);
  const p=picQ=picQ.then(async()=>{
    const ph=sp.ref.ph,M=root.MORPH.morph(ph,sp.lvl),G=root.SHAPE.build(M),dpr=Math.min(2,root.devicePixelRatio||1);
    const bw=G.box.w*G.scale,bh=G.box.h*G.scale,z=Math.min(W*dpr*0.92/bw,H*dpr*0.9/bh);
    const X=await root.RIG.get(ph,sp.lvl,{px:Math.max(0.5,z/dpr/G.scale),dpr});
    try{const A=new root.ANIM.Animator(M,X.R,{seed:7,reduce:true,noPuff:true});A.update(0.02);
      const cv=document.createElement('canvas');cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);const c=cv.getContext('2d');
      const cx=G.box.x+G.box.w/2,cy=G.box.y+G.box.h/2,k=z,face=sp.ref.side==='B'?-1:1;
      const V=[k*face,0,0,k,cv.width/2-k*face*cx,cv.height/2-k*cy];
      root.RIG.draw(c,X,A.pose,V,{});const url=cv.toDataURL('image/png');cv.width=cv.height=0;return url}
    finally{root.RIG.release(X)}});
  picQ=p.catch(()=>null);pics.set(key,p);if(pics.size>60)pics.delete(pics.keys().next().value);
  return p}
function fillPics(el){el.querySelectorAll('img[data-pic]').forEach(img=>{const sp=F&&F.picOf[img.dataset.pic];if(!sp)return;
  portrait(sp,+img.dataset.w,+img.dataset.h).then(u=>{if(u&&img.isConnected){img.src=u;img.classList.add('on')}}).catch(()=>{})})}
function picHTML(sp,w,h){F.picOf[sp.id]=sp;return `<img class="drf-pic" data-pic="${esc(sp.id)}" data-w="${w}" data-h="${h}" width="${w}" height="${h}" alt="">`}

/* ---------- звуки: короткие синтезированные, по умолчанию выключены ---------- */
let AC=null;
function sfx(k){
  if(!F||!F.snd)return;try{AC=AC||new (root.AudioContext||root.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){return}
  const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.connect(g);g.connect(AC.destination);
  const S={hit:['triangle',220,110,0.12,0.18],big:['sawtooth',180,60,0.22,0.2],perfect:['sine',880,1320,0.18,0.14],ko:['sine',300,70,0.45,0.2],
    win:['triangle',523,1046,0.5,0.16],lose:['sine',330,165,0.6,0.14],guard:['sine',440,520,0.14,0.1],tap:['sine',660,660,0.05,0.08]}[k]||['sine',440,440,0.05,0.05];
  o.type=S[0];o.frequency.setValueAtTime(S[1],t);o.frequency.exponentialRampToValueAtTime(Math.max(20,S[2]),t+S[3]);
  g.gain.setValueAtTime(S[4],t);g.gain.exponentialRampToValueAtTime(0.001,t+S[3]);o.start(t);o.stop(t+S[3]+0.02)}

/* ---------- экран ---------- */
let F=null;
function open(api,opt){
  if(F)finish();opt=opt||{};
  const el=document.createElement('div');el.className='drf';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Поход');
  el.innerHTML='<p class="drf-load">Собираю поход…</p>';document.body.appendChild(el);document.body.classList.add('drf-open');
  F={api,el,$:s=>el.querySelector(s),screen:'load',tok:0,picOf:{},pick:null,want:opt.dragon||null,speed:1,auto:false,snd:LS('drfSnd')==='1',
    focusBack:document.activeElement&&document.activeElement.focus?document.activeElement:null};
  F.onKey=e=>onKey(e);addEventListener('keydown',F.onKey,true);
  el.addEventListener('click',onClick);
  requestAnimationFrame(()=>el.classList.add('in'));
  const my=F;
  loadAll().then(()=>{if(F!==my)return;showMap()}).catch(e=>{console.error(e);if(F!==my)return;
    el.innerHTML='<p class="drf-load">Не получилось открыть поход. <button class="btn sm" data-fk="close">Вернуться</button></p>'});
  return F}
function finish(){
  const f=F;if(!f)return;F=null;f.tok++;stopFight(f);
  removeEventListener('keydown',f.onKey,true);f.el.remove();document.body.classList.remove('drf-open');
  if(f.focusBack&&f.focusBack.isConnected)try{f.focusBack.focus({preventScroll:true})}catch(e){}
  if(f.api.onClose)f.api.onClose()}
function setScreen(name,html){
  F.screen=name;F.el.dataset.s=name;F.el.innerHTML=html;fillPics(F.el);
  const b=F.el.querySelector('[data-first]')||F.el.querySelector('button:not([disabled])');if(b)b.focus({preventScroll:true})}

/* карта похода */
function showMap(){
  F.picOf={};const C=root.DRCAMP,p=F.api.progress(),tot=C.total(p),max=C.BATTLES.length*3;
  const rows=C.BATTLES.map((bt,i)=>{const op=C.unlocked(p,bt.id),st=p.best[bt.id]||0,foes=foeSpecs(bt),els=[...new Set(foes.flatMap(f=>f.els))];
    const stars='★'.repeat(st)+'☆'.repeat(3-st);
    return `<li><button class="drf-node${st?' done':''}${op?'':' lock'}${bt.boss?' boss':''}" data-fk="prep" data-id="${bt.id}"${op?'':' disabled'}${op&&!st?' data-first':''}>
      <span class="drf-n" aria-hidden="true">${bt.boss?'👑':i+1}</span>
      <span class="drf-nt"><b>${esc(bt.name)}</b><small>${op?`Рекомендуемый уровень ${bt.rec} · ${foes.length} противника · ${els.length?els.map(e=>EL_IC[e]).join(' '):'без стихий'}`:`Откроется после победы в бою «${esc(C.BATTLES[i-1].name)}»`}</small></span>
      <span class="drf-st" aria-label="${st?'лучший результат: '+st+' из 3 звёзд':'ещё не пройден'}">${op?stars:'🔒'}</span></button></li>`}).join('');
  setScreen('map',`<header class="drf-top"><button class="drf-x" data-fk="close">← К острову</button><h2><span class="drf-wide">Поход: </span>${esc(C.AREA.name)}</h2><span class="drf-tot" title="Звёзды похода">★ ${tot} из ${max}</span></header>
    <div class="drf-scroll"><p class="drf-intro">${esc(C.AREA.intro)}</p><ol class="drf-path">${rows}</ol>
    <p class="drf-note">${C.done(p)?'Гряда пройдена! Бои можно переигрывать ради трёх звёзд. ':''}Награда похода — звёзды за каждый бой. Золото, корм и самоцветы за бои пока не начисляются, остров живёт по карточкам, как раньше.</p></div>`)}

/* подготовка */
function showPrep(id){
  const C=root.DRCAMP,bt=C.byId(id);if(!bt||!C.unlocked(F.api.progress(),id))return showMap();
  F.bid=id;F.picOf={};const foes=foeSpecs(bt),mine=myDragons();
  if(!F.pick){let saved=null;try{saved=JSON.parse(LS('drfPick')||'null')}catch(e){}
    const ok=x=>mine.some(d=>d.id===x);
    let base=(Array.isArray(saved)?saved.filter(ok):[]).slice(0,3);
    if(!base.length)base=mine.slice().sort((a,b)=>b.lvl-a.lvl).slice(0,3).map(d=>d.id);
    /* пришли из осмотра «В бой»: этот дракон первым, остальные места как в прошлый раз */
    if(F.want&&ok(F.want))base=[F.want].concat(base.filter(x=>x!==F.want)).slice(0,3);
    F.want=null;F.pick=base}
  F.pick=F.pick.filter(x=>mine.some(d=>d.id===x));
  const foe=f=>`<div class="drf-foe">${picHTML(f,96,72)}<b>${esc(f.name)}</b><small>${f.lvl}-й ур. · ${elsText(f.els)}</small></div>`;
  const hint=d=>{const st=foes.filter(f=>edge(d,f).out>1).map(f=>f.name),wk=foes.filter(f=>edge(d,f).inn>1).map(f=>f.name);
    return (st.length?`<span class="hup">сильнее против: ${esc(st.join(', '))}</span>`:'')+(wk.length?`<span class="hdn">уязвим для: ${esc(wk.join(', '))}</span>`:'')+(!d.els.length?'<span>бьёт Ударом, стихии нет</span>':'')};
  const card=d=>{const i=F.pick.indexOf(d.id);
    return `<button class="drf-pk${i>=0?' on':''}" data-fk="pick" data-id="${esc(d.id)}" aria-pressed="${i>=0}">${i>=0?`<span class="drf-ix" aria-hidden="true">${i+1}</span>`:''}${picHTML(d,104,78)}
      <b>${esc(d.name)}</b><small>${d.lvl}-й ур. · ${elsText(d.els)}</small><span class="drf-sts"><span title="Здоровье">❤ ${d.hp}</span><span title="Атака">⚔ ${d.atk}</span><span title="Защита">🛡 ${d.def}</span><span title="Скорость">💨 ${d.spd}</span></span><span class="drf-hn">${hint(d)}</span></button>`};
  const n=F.pick.length,lv=F.pick.map(x=>mine.find(d=>d.id===x).lvl);
  setScreen('prep',`<header class="drf-top"><button class="drf-x" data-fk="map">← К походу</button><h2>${esc(bt.name)}</h2><span class="drf-tot">${bt.ai==='easy'?'лёгкий':bt.ai==='hard'?'трудный':'средний'}</span></header>
    <div class="drf-scroll"><p class="drf-intro">${esc(bt.story)}</p>
    <h3>Противники</h3><div class="drf-foes">${foes.map(foe).join('')}</div>
    <h3>Ваша команда <small>выберите до трёх драконов, первый встанет впереди</small></h3>
    ${mine.length?`<div class="drf-grid">${mine.map(card).join('')}</div>`:'<p class="drf-intro">На острове пока нет драконов.</p>'}
    <details class="drf-rules"><summary>Как идёт бой</summary><ul>
      <li>Ходят по очереди, первым самый быстрый. У каждого дракона есть Удар, атака своей стихии (у гибрида две) и Защита: до своего следующего хода он получает вдвое меньше урона.</li>
      <li>Стихии идут по кругу: Огонь сильнее Флоры, Флора сильнее Земли, Земля сильнее Воздуха, Воздух сильнее Воды, Вода сильнее Огня. Свет и Тьма сильны друг против друга. Сильная стихия бьёт в полтора раза больнее, слабая на четверть слабее. Это правило игры, у настоящих животных стихий нет.</li>
      <li>Пока стихия летит, по кругу у дракона бежит кольцо. Нажмите (или пробел), когда оно сойдётся с меткой: Точный удар даёт +25 % урона.</li>
      <li>Шкала ярости копится от ударов. Когда она полна, один раз за бой можно выпустить Ярость дракона.</li>
      <li>Звёзды: три, если никто из команды не выбыл, две, если выбыл один, одна за остальные победы.</li></ul></details></div>
    <footer class="drf-go"><span class="drf-rec">Рекомендуемый уровень ${bt.rec}.${n?` У вас: ${lv.join(', ')}.`:''}</span><button class="btn" data-fk="start"${n?'':' disabled'}>В бой · ${n} из 3</button></footer>`)}

/* ---------- бой ---------- */
const RING=1.05,LEAD=0.5,WIN=0.12;   /* кольцо Точного удара: 1,05 с до выпуска, атака стартует через 0,5 с, окно ±0,12 с */
const FORM={wide:[[0.74,0.08],[1.52,-0.2],[1.7,0.34]],tall:[[0.56,0],[0.8,0.7],[0.58,1.4]]};

async function startFight(){
  const C=root.DRCAMP,B=root.DRBATTLE,bt=C.byId(F.bid),mine=myDragons();
  const A=F.pick.map(x=>mine.find(d=>d.id===x)).filter(Boolean),Bs=foeSpecs(bt);if(!A.length)return;
  LS('drfPick',JSON.stringify(F.pick));
  const tok=++F.tok,seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
  F.b=new B.Battle({A,B:Bs,seed});F.lvl=bt.ai;F.nums=[];F.ring=null;F.tgtMode=null;F.waits=[];F.result=null;
  setScreen('fight',`<div class="drf-bar"><button class="drf-x sm" data-fk="quit">✕ Выйти</button><span class="drf-rd" aria-live="off">Раунд 1</span><span class="drf-bt">${esc(bt.name)}</span>
      <span class="drf-ctl"><button data-fk="speed" aria-pressed="${F.speed>1}" title="Скорость">×2</button><button data-fk="auto" aria-pressed="${F.auto}" title="Компьютер ходит за вас">Авто</button><button data-fk="snd" aria-pressed="${F.snd}" aria-label="Звук">${F.snd?'🔊':'🔇'}</button></span></div>
    <div class="drf-team b" role="group" aria-label="Противники"></div>
    <div class="drf-stage"><canvas class="drf-cv" aria-hidden="true"></canvas><p class="drf-load">Драконы выходят на поле…</p></div>
    <div class="drf-team a" role="group" aria-label="Ваша команда"></div>
    <div class="drf-cmd"><p class="drf-say" aria-live="polite"></p><div class="drf-sk"></div></div>`);
  const cv=F.$('.drf-cv'),sc=new root.DRSCENE.Scene(cv,{reduce:reduced()});F.scene=sc;F.cv=cv;
  const st=F.$('.drf-stage');
  st.addEventListener('pointerdown',e=>stageTap(e));
  F.ro=new ResizeObserver(()=>resize());F.ro.observe(st);
  try{for(const f of F.b.f){const r=f.ref,d=await sc.add(r.ph,f.lvl,0,f.side==='A'?1:-1,{id:f.id,side:f.side,slot:f.slot,s0:0,hpS:1,rgS:0});if(tok!==F.tok)return;d.s0=d.s}}
  catch(e){console.error(e);if(tok===F.tok)say('Не получилось вывести драконов на поле. Выйдите и попробуйте ещё раз.');return}
  if(tok!==F.tok)return;
  sc.under=(c,V)=>under(c,V);sc.over=(c,V)=>over(c,V);
  resize();F.$('.drf-stage .drf-load').remove();
  F.raf=requestAnimationFrame(frame);
  renderTeams();
  loop(tok).catch(e=>{if(e!==CANCEL){console.error(e);say('В бою что-то сломалось. Выйдите и начните заново.')}})}
const CANCEL={};
function stopFight(f){if(f.raf)cancelAnimationFrame(f.raf);f.raf=0;if(f.ro)f.ro.disconnect();f.ro=null;
  if(f.scene){f.scene.destroy();f.scene=null}if(f.cv){f.cv.width=f.cv.height=0;f.cv=null}f.waits=[]}

/* расстановка: команды лицом друг к другу, второй и третий дракон в глубину. Из двух построений берём то, где драконы крупнее */
function resize(){
  const sc=F&&F.scene;if(!sc||!F.cv)return;const st=F.$('.drf-stage');if(!st)return;
  const w=st.clientWidth,h=st.clientHeight,dpr=sc.dpr;if(w<10||h<10)return;
  F.cv.width=Math.round(w*dpr);F.cv.height=Math.round(h*dpr);F.cv.style.width=w+'px';F.cv.style.height=h+'px';
  const U=Math.max(...sc.ds.map(d=>d.G.box.w*d.s0));let best=null;
  for(const k of Object.keys(FORM)){
    const P=sc.ds.map(d=>{const [dx,dy]=FORM[k][d.slot]||FORM[k][0],s=d.s0*(1+0.1*dy),x=(d.side==='A'?-1:1)*dx*U,y=dy*U,b=d.G.box;
      return {d,s,x,y,x0:x-b.w*s/2,x1:x+b.w*s/2,y0:y+b.y*s,y1:y+(b.y+b.h)*s}});
    const fb={x0:Math.min(...P.map(p=>p.x0)),x1:Math.max(...P.map(p=>p.x1)),y0:Math.min(...P.map(p=>p.y0)),y1:Math.max(...P.map(p=>p.y1))+U*0.06,pad:10,padTop:30};
    sc.frame(fb);const z=sc.zoomFb(w,h);if(!best||z>best.z)best={z,P,fb,k}}
  best.P.forEach(p=>{p.d.s=p.s;p.d.x=p.d.hx=p.x;p.d.y=p.y});sc.frame(best.fb);F.form=best.k;
  F.U=U;F.gy0=Math.min(...best.P.map(p=>p.y))-U*0.24;F.gy1=Math.max(...best.P.map(p=>p.y));
  sc.ds.sort((a,b)=>a.y-b.y);
  const px=sc.texPx();if(!F.texPx)F.texPx=px;
  else if(Math.abs(px-F.texPx)/F.texPx>0.3){F.texPx=px;sc.ds.forEach(d=>{root.RIG.get(d.ph,d.lvl,{px,dpr}).then(X=>{if(!F||!F.scene||F.scene!==sc){root.RIG.release(X);return}root.RIG.release(d.X);d.X=X})})}
  if(F.raf===0)return;sc.draw()}

function frame(ts){
  if(!F||!F.scene){return}F.raf=requestAnimationFrame(frame);
  if(document.hidden){F.last=ts;return}
  const dt=F.last?clamp((ts-F.last)/1000,0,0.1):1/60;if(F.last){const q=F.scene.stats.frame;q.push(ts-F.last);if(q.length>240)q.shift()}F.last=ts;
  const sc=F.scene,s=dt*F.speed;sc.update(s);
  sc.ds.forEach(d=>{const f=F.b.get(d.id);if(!f)return;d.hpS+=(f.hp/f.maxHp-d.hpS)*Math.min(1,s*6);d.rgS+=(f.rage/100-d.rgS)*Math.min(1,s*6);
    if(f.ko&&!d.koT)d.koT=sc.t;if(d.koT)d.alpha=Math.max(0.35,1-(sc.t-d.koT)*1.2)});
  F.nums=F.nums.filter(n=>sc.t-n.t0<n.life);
  const now=sc.t;F.waits=F.waits.filter(w=>{if(now>=w.at){w.res();return false}return true});
  sc.draw()}
/* ожидание во времени сцены: на скорости ×2 вдвое короче, на скрытой вкладке стоит */
function wait(sec,tok){return new Promise((res,rej)=>{if(!F||tok!==F.tok)return rej(CANCEL);F.waits.push({at:F.scene.t+sec,res:()=>{if(!F||tok!==F.tok)rej(CANCEL);else res()}})})}
const dOf=id=>F.scene.ds.find(d=>d.id===id);

/* слой под драконами: тени, кольцо того, чей ход, отметки целей */
function under(c,V){
  const b=F.b,W=F.cv.width,H=F.cv.height,x0=-V[4]/V[0],x1=(W-V[4])/V[0],yb=(H-V[5])/V[3];
  /* земля поля: от линии чуть дальше заднего ряда до низа холста, светлое пятно арены посередине */
  isDark();const g=c.createLinearGradient(0,F.gy0,0,yb);g.addColorStop(0,F.col.g1);g.addColorStop(1,F.col.g2);
  c.fillStyle=g;c.fillRect(x0,F.gy0,x1-x0,yb-F.gy0+1);
  c.globalAlpha=0.18;c.fillStyle='#FFFFFF';c.beginPath();c.ellipse(0,(F.gy0+F.gy1)/2+F.U*0.12,F.U*2.1,(F.gy1-F.gy0)*0.62+F.U*0.1,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  F.scene.ds.forEach(d=>{const w=d.G.box.w*d.s,f=b.get(d.id);
    c.globalAlpha=0.2*d.alpha;c.fillStyle='#14261A';c.beginPath();c.ellipse(d.x,d.y+w*0.02,w*0.36,w*0.07,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
    const cur=b.cur===d.id||(F.acting===d.id),tg=F.tgtMode&&F.tgtMode.targets.includes(d.id);
    if((cur||tg)&&!f.ko){c.lineWidth=Math.max(1.2,w*0.018);c.strokeStyle=cur?'#F2C94C':'#FF6B57';if(tg&&!cur)c.setLineDash([w*0.05,w*0.035]);
      c.beginPath();c.ellipse(d.x,d.y+w*0.02,w*0.42,w*0.09,0,0,Math.PI*2);c.stroke();c.setLineDash([])}})}
const app=(V,p)=>[V[0]*p[0]+V[2]*p[1]+V[4],V[1]*p[0]+V[3]*p[1]+V[5]];
/* слой поверх: полоски здоровья и ярости, эффекты, щит, числа урона, кольцо Точного удара (в пикселях холста) */
function over(c,V){
  const b=F.b,k=F.scene.dpr,dark=isDark();
  F.scene.ds.forEach(d=>{const f=b.get(d.id),bx=d.G.box,top=app(V,[d.x,d.y+bx.y*d.s]),base=app(V,[d.x,d.y]);
    if(f.guard&&!f.ko){const r=(base[1]-top[1])*0.62,cx=base[0],cy=(top[1]+base[1])/2+r*0.1;c.globalAlpha=0.5;c.lineWidth=2.5*k;c.strokeStyle='#8FD3FF';
      c.beginPath();c.arc(cx,cy,r,Math.PI*1.05,Math.PI*1.95);c.stroke();c.globalAlpha=0.12;c.fillStyle='#8FD3FF';c.beginPath();c.ellipse(cx,cy,r,r*0.95,0,0,Math.PI*2);c.fill();c.globalAlpha=1}
    const W=Math.min(64*k,Math.max(36*k,(bx.w*d.s*V[0])*0.55)),H=6*k,x=top[0]-W/2,y=Math.max(4*k,top[1]-16*k);
    c.globalAlpha=f.ko?0.45:1;
    c.fillStyle='rgba(10,20,14,.55)';rr(c,x-1.5*k,y-1.5*k,W+3*k,H+6.5*k,3*k);c.fill();
    c.fillStyle=f.side==='A'?'#55C26A':'#E8604C';rr(c,x,y,W*clamp(d.hpS,0,1),H,2*k);c.fill();
    c.fillStyle=f.rage>=100&&!f.rageUsed?'#FFD34D':'#F2A93B';rr(c,x,y+H+1.5*k,W*clamp(d.rgS,0,1),2*k,1*k);c.fill();
    const fx=Object.keys(f.fx).map(q=>FX_IC[q]||'').join('');
    if(fx){c.font=`${12*k}px system-ui,sans-serif`;c.textAlign='left';c.textBaseline='middle';c.fillText(fx,x+W+4*k,y+H/2)}
    c.globalAlpha=1});
  const t=F.scene.t,red=F.scene.reduce;
  F.nums.forEach(n=>{const d=dOf(n.id);if(!d)return;const p=app(V,[d.x,d.y+d.G.box.y*d.s*0.72]),a=(t-n.t0)/n.life,
    y=p[1]-(red?0:a*28*k)-n.dy*k;c.globalAlpha=a<0.7?1:Math.max(0,1-(a-0.7)/0.3);
    c.font=`${n.lab?700:800} ${(n.lab?13:n.big?22:16)*k}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='alphabetic';c.lineWidth=4*k;c.strokeStyle=dark?'rgba(0,0,0,.75)':'rgba(255,255,255,.9)';
    c.strokeText(n.txt,p[0],y);c.fillStyle=n.col;c.fillText(n.txt,p[0],y);c.globalAlpha=1});
  const R=F.ring;if(R){const d=dOf(R.id);if(d){const p=app(V,[d.x,d.y+d.G.box.y*d.s*0.5]),r0=24*k,q=clamp((t-R.t0)/RING,0,1.2),r=r0*(1+2.2*(1-q));
    c.lineWidth=3*k;c.strokeStyle='rgba(255,255,255,.95)';c.beginPath();c.arc(p[0],p[1],r0,0,Math.PI*2);c.stroke();
    if(!R.pressed){c.strokeStyle='#FFD34D';c.globalAlpha=q>1?Math.max(0,1-(q-1)*6):1;c.lineWidth=4*k;c.beginPath();c.arc(p[0],p[1],Math.max(2,r),0,Math.PI*2);c.stroke();c.globalAlpha=1}
    else{c.font=`800 ${15*k}px system-ui,sans-serif`;c.textAlign='center';c.fillStyle=R.ok?'#FFD34D':'#FFFFFF';c.lineWidth=4*k;c.strokeStyle='rgba(0,0,0,.6)';
      c.strokeText(R.ok?'Точно!':R.late?'Поздно':'Рано',p[0],p[1]-r0-8*k);c.fillText(R.ok?'Точно!':R.late?'Поздно':'Рано',p[0],p[1]-r0-8*k)}}}}
function rr(c,x,y,w,h,r){c.beginPath();if(w<=0){return}r=Math.min(r,w/2,h/2);c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
/* тёмная ли тема: по яркости фона страницы (темы платформы бывают не только светлая и тёмная), раз в секунду */
function isDark(){const t=performance.now();if(F.darkAt&&t-F.darkAt<1000)return F.dark;F.darkAt=t;
  const cs=getComputedStyle(F.el);F.col={g1:cs.getPropertyValue('--isl-grass').trim()||'#93D45E',g2:cs.getPropertyValue('--isl-grass2').trim()||'#5EA83A'};
  const c=(getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)||[255,255,255]).map(Number);F.dark=0.299*c[0]+0.587*c[1]+0.114*c[2]<128;return F.dark}
/* всплывающие числа и подписи над драконом; одновременные встают столбиком, подписи мельче чисел */
function num(id,txt,col,big){const q=F.nums.filter(x=>x.id===id&&F.scene.t-x.t0<0.5),dy=q.reduce((a,x)=>a+x.h,0),lab=!/^[−+]\d/.test(txt),h=lab?17:big?26:20;
  F.nums.push({id,txt,col,big:!!big,lab,h,t0:F.scene.t,life:1.3,dy})}

/* удар без стихии: рывок к цели, когти, обратно. Тот же порядок событий, что у атак стихий: impact один раз, потом end */
function Melee(a,b,o){this.src=a;this.dst=b;this.cb=o||{};this.t=0;this.p=[];this.shake=0;this.flash=0;this.done=false;this.fired=false;this.hits=0;
  this.big=(o&&o.size||1)>1;this.end=[b.x,b.y];this.dir=Math.sign(b.x-a.x)||1;this.reach=Math.max(0,Math.abs(b.x-a.x)-(a.G.box.w*a.s+b.G.box.w*b.s)*0.42);a.A.play('attack')}
Melee.prototype.update=function(dt){
  const ev=[];if(this.done)return ev;this.t+=dt;const t=this.t,a=this.src,sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const k=t<0.55?sm((t-0.15)/0.4):t<0.95?1-sm((t-0.6)/0.35):0;a.x=a.hx+this.dir*k*this.reach*0.55;
  if(!this.fired&&t>=0.55){this.fired=true;ev.push({type:'impact',at:this.end});this.shake=(this.big?0.12:0.05)*this.dst.G.box.w*this.dst.s}
  this.shake*=Math.exp(-dt*10);
  if(t>=1.0){this.done=true;a.x=a.hx;ev.push({type:'end'})}
  return ev};
Melee.prototype.draw=function(c){
  if(!this.fired||this.t>0.85)return;const b=this.dst,w=b.G.box.w*b.s,q=(this.t-0.55)/0.3,cx=b.x-this.dir*w*0.12,cy=b.y+b.G.box.y*b.s*0.55;
  c.save();c.globalAlpha=Math.max(0,1-q);c.strokeStyle=this.big?'#FFD34D':'#FFFFFF';c.lineCap='round';c.lineWidth=w*0.03;
  for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(cx-w*0.16,cy-w*0.16+i*w*0.07);c.quadraticCurveTo(cx,cy+i*w*0.07-w*0.02,cx+w*0.16,cy+w*0.12+i*w*0.07);c.stroke()}
  c.restore()};

/* главный цикл боя: события логики → показ → выбор игрока или компьютера → действие */
async function loop(tok){
  const b=F.b;await wait(reduced()?0.2:0.6,tok);
  while(!b.over){
    await showEvents(b.next(),tok);if(b.over)break;
    const f=b.get(b.cur);renderTeams();
    let c;
    if(f.side==='A'&&!F.auto)c=await choose(f,tok);
    else{say(f.side==='A'?`Авто: ходит ${f.name}`:`Ходит ${f.name}…`);await wait(F.auto&&f.side==='A'?0.35:0.7,tok);c=b.ai(f.side==='A'?'normal':F.lvl)}
    await perform(f,c,tok)}
  await ending(tok)}

function say(t){const e=F&&F.$('.drf-say');if(e)e.textContent=t}
async function showEvents(ev,tok){
  for(const e of ev){
    if(e.type==='round'){const r=F.$('.drf-rd');if(r)r.textContent='Раунд '+e.n;
      say('Раунд '+e.n+'. Очередь: '+e.order.map(id=>F.b.get(id).name).join(' → '));await wait(0.5,tok)}
    else if(e.type==='dot'){num(e.id,'−'+e.dmg+' 🔥','#FF8A3D');renderTeams();say(`${F.b.get(e.id).name} горит: −${e.dmg}`);await wait(0.6,tok)}
    else if(e.type==='skip'){num(e.id,'опутан','#7BCB5A');say(`${F.b.get(e.id).name} опутан лозой и пропускает ход`);renderTeams();await wait(0.7,tok)}
    else if(e.type==='ko'){koShow(e.id);await wait(0.5,tok)}
    else if(e.type==='end'){}}}
function koShow(id){const d=dOf(id);if(d)d.A.play('defeat');sfx('ko');num(id,'выбыл','#BBBBBB');renderTeams();say(`${F.b.get(id).name} выбывает из боя`)}

/* выбор игрока: приём, потом цель (если целей больше одной) */
function choose(f,tok){
  return new Promise((res,rej)=>{
    F.pend={f,res,rej,tok};
    const ops=F.b.options();F.ops=ops;F.tgtMode=null;renderSkills();say(`Ход: ${f.name}. Выберите приём`)})}
function pickSkill(sid){
  const P=F.pend;if(!P)return;const op=F.ops.find(o=>o.skill.id===sid);if(!op)return;sfx('tap');
  if(op.skill.self||op.targets.length===1){done({skill:sid,target:op.targets[0]});return}
  F.tgtMode={skill:op.skill,targets:op.targets};renderSkills();renderTeams();say(`${op.skill.name}: нажмите на противника`)}
function pickTarget(id){const m=F.tgtMode;if(!m||!m.targets.includes(id))return;sfx('tap');done({skill:m.skill.id,target:id})}
function done(c){const P=F.pend;F.pend=null;F.tgtMode=null;F.ops=null;renderSkills();renderTeams();if(P)P.res(c)}

async function perform(f,c,tok){
  const b=F.b,sk=c.skill,a=dOf(f.id);
  if(sk==='guard'){const ev=b.act(c);a.A.play('happy');sfx('guard');num(f.id,'🛡 защита','#8FD3FF');say(`${f.name} встаёт в защиту`);renderTeams();await wait(0.8,tok);return ev}
  const t=dOf(c.target),s=root.DRBATTLE.skillsOf(f).find(x=>x.id===sk),el=s.el,size=sk==='rage'?1.7:1;
  F.acting=f.id;say(`${f.name}: ${sk==='rage'?'Ярость дракона':s.name} → ${b.get(c.target).name}`);
  const ring=f.side==='A'&&!F.auto?{id:f.id,t0:F.scene.t,pressed:false,ok:false}:null;F.ring=ring;
  if(ring){renderSkills();await wait(LEAD,tok)}
  let ev=null;
  await new Promise((res,rej)=>{
    const cb={size,onImpact:()=>{if(!F||tok!==F.tok)return;
        const perfect=!!(ring&&ring.ok);F.ring=null;renderSkills();ev=b.act({skill:sk,target:c.target,perfect});hitShow(ev,f)},
      onEnd:()=>res()};
    if(sk==='strike'||!el){const m=new Melee(a,t,cb);F.scene.runs.push(m)}
    else F.scene.attack(a,t,el,cb);
});
  if(!F||tok!==F.tok)throw CANCEL;
  F.acting=null;F.ring=null;
  await showEvents(ev.filter(e=>e.type==='ko'||e.type==='end'),tok);
  await wait(0.25,tok);return ev}
function hitShow(ev,f){
  ev.forEach(e=>{
    if(e.type==='hit'){const m=e.mult,big=m>1||e.perfect||e.skill==='rage';
      num(e.target,'−'+e.dmg,m>1?'#FF8A3D':m<1?'#B8C2CC':'#FFFFFF',big);
      if(e.perfect)num(e.target,'Точный удар!','#FFD34D');
      if(m>1)num(e.target,'сильная стихия ×'+f1(m),'#FF8A3D');else if(m<1)num(e.target,'слабая стихия ×'+f1(m),'#B8C2CC');
      if(e.guarded)num(e.target,'🛡 ×0,5','#8FD3FF');
      sfx(e.perfect?'perfect':big?'big':'hit')}
    else if(e.type==='heal')num(e.id,'+'+e.amt,'#6BE38A')
    else if(e.type==='effect')num(e.target,(FX_IC[e.fx]||'')+' '+e.name.toLowerCase(),'#E6E6FF')
    else if(e.type==='ko'){}});
  renderTeams()}

/* нажатие в момент выпуска: тап по полю, пробел или кнопка «Удар!» */
function press(){
  const R=F&&F.ring;if(!R||R.pressed)return false;const dt=F.scene.t-(R.t0+RING);
  R.pressed=true;R.ok=Math.abs(dt)<=WIN;R.late=dt>WIN;sfx(R.ok?'perfect':'tap');renderSkills();return true}
function stageTap(e){
  if(!F||F.screen!=='fight'||!F.scene)return;
  if(F.ring){e.preventDefault();press();return}
  if(!F.tgtMode)return;
  const r=F.cv.getBoundingClientRect(),V=F.scene.view(),k=F.scene.dpr,wx=((e.clientX-r.left)*k-V[4])/V[0],wy=((e.clientY-r.top)*k-V[5])/V[3];
  let best=null,bd=1e9;
  F.tgtMode.targets.forEach(id=>{const d=dOf(id),bx=d.G.box,w=bx.w*d.s;
    if(wx>d.x-w*0.55&&wx<d.x+w*0.55&&wy>d.y+bx.y*d.s-w*0.1&&wy<d.y+w*0.12){const q=Math.abs(wx-d.x)+Math.abs(wy-(d.y+bx.y*d.s*0.5));if(q<bd){bd=q;best=id}}});
  if(best)pickTarget(best)}

async function ending(tok){
  const b=F.b,won=b.winner==='A',stars=b.stars();
  F.scene.ds.forEach(d=>{const f=b.get(d.id);if(!f.ko)d.A.play(f.side===b.winner?'victory':'defeat')});
  sfx(won?'win':'lose');say(won?'Победа!':'Поражение');renderTeams();
  let p=F.api.progress(),before=p.best[F.bid]||0;
  if(won){try{p=F.api.record(F.bid,stars)||p}catch(e){console.error(e)}}
  await wait(1.6,tok);
  F.result={won,stars,before,best:p.best[F.bid]||0};showResult()}
function showResult(){
  const R=F.result,C=root.DRCAMP,i=C.BATTLES.findIndex(x=>x.id===F.bid),nx=C.BATTLES[i+1],p=F.api.progress(),why=F.b.log.length&&F.b.round>F.b.maxRounds;
  const box=document.createElement('div');box.className='drf-res';box.setAttribute('role','alertdialog');box.setAttribute('aria-labelledby','drf-rt');
  const st=R.won?[1,2,3].map(n=>`<span class="${n<=R.stars?'on':''}" style="--i:${n}">★</span>`).join(''):'';
  box.innerHTML=`<div class="drf-rc"><h2 id="drf-rt">${R.won?'Победа!':'Поражение'}</h2>${R.won?`<div class="drf-stars" aria-label="${R.stars} из 3 звёзд">${st}</div>
    <p>${R.stars===3?'Никто из команды не выбыл.':R.stars===2?'Один дракон выбыл. Без потерь будет три звезды.':'Победа с потерями. Попробуйте другой состав или стихии посильнее.'}${R.stars>R.before&&R.before?` Новый рекорд: было ${R.before}.`:''}</p>
    <p class="drf-small">Звёзды похода: ${C.total(p)} из ${C.BATTLES.length*3}.${nx&&C.unlocked(p,nx.id)&&!R.before?` Открыт бой «${esc(nx.name)}».`:''}</p>`
    :`<p>${why?'Тридцать раундов прошло, а противники ещё держатся: ничья засчитывается как поражение.':'Команда выбыла. Посмотрите, какие стихии сильнее против этих противников, и возьмите драконов посильнее.'}</p><p class="drf-small">Поражение ничего не отнимает: звёзды и драконы остаются.</p>`}
    <div class="drf-ra">${R.won&&nx&&C.unlocked(p,nx.id)?`<button class="btn" data-fk="next" data-id="${nx.id}" data-first>Следующий бой</button>`:''}<button class="btn${R.won&&nx?' ghost':''}" data-fk="again"${R.won&&nx?'':' data-first'}>Ещё раз</button><button class="btn ghost" data-fk="map">К походу</button></div></div>`;
  F.el.appendChild(box);const f=box.querySelector('[data-first]');if(f)f.focus({preventScroll:true});F.screen='result'}

/* ---------- панели боя ---------- */
function renderTeams(){
  if(!F||!F.b)return;const b=F.b,m=F.tgtMode,cur=b.cur||F.acting;
  ['a','b'].forEach(s=>{const el=F.$('.drf-team.'+s);if(!el)return;const side=s.toUpperCase(),act=F.pend&&F.pend.f;
    el.innerHTML=b.f.filter(f=>f.side===side).map(f=>{const tg=m&&m.targets.includes(f.id),mul=tg&&m.skill.el?root.DRBATTLE.mult(m.skill.el,f.els):1;
      const fx=Object.entries(f.fx).map(([k,n])=>`<span title="${FX_TXT[k]}, ещё ${n}">${FX_IC[k]}${n}</span>`).join('')+(f.guard?'<span title="защита">🛡</span>':'');
      const hp=Math.max(0,f.hp);
      return `<button class="drf-fc${f.id===cur?' cur':''}${f.ko?' ko':''}${tg?' tg':''}" data-fk="tgt" data-id="${esc(f.id)}"${tg?'':' tabindex="-1" aria-disabled="true"'}
        aria-label="${esc(f.name)}, ${f.lvl}-й уровень, здоровье ${hp} из ${f.maxHp}${f.ko?', выбыл':''}${tg?(mul>1?', сильная стихия':mul<1?', слабая стихия':'')+'. Выбрать целью':''}">
        <span class="drf-fn"><b>${esc(f.name)}</b><i>${f.lvl}</i>${f.els.map(e=>EL_IC[e]).join('')}</span>
        <span class="drf-hp"><i style="width:${(hp/f.maxHp*100).toFixed(1)}%"></i></span><span class="drf-hpn">${hp}/${f.maxHp}</span>
        <span class="drf-rg${f.rage>=100&&!f.rageUsed?' full':''}"><i style="width:${f.rageUsed?0:f.rage}%"></i></span><span class="drf-fxs">${fx}</span>
        ${tg&&mul!==1?`<span class="drf-mul ${mul>1?'mup':'mdn'}">×${f1(mul)}</span>`:''}</button>`}).join('')})}
function renderSkills(){
  const el=F&&F.$('.drf-sk');if(!el)return;
  if(F.ring&&!F.ring.pressed){el.innerHTML=`<button class="btn drf-hit" data-fk="press" data-first>Удар! <small>нажмите, когда кольцо сойдётся · пробел</small></button>`;el.querySelector('button').focus({preventScroll:true});return}
  if(F.ring){el.innerHTML=`<p class="drf-small">${F.ring.ok?'Точный удар: урон +25 %':'Мимо окна: обычный удар'}</p>`;return}
  if(!F.pend){el.innerHTML='';return}
  if(F.tgtMode){el.innerHTML=`<p class="drf-small">Цель для приёма «${esc(F.tgtMode.skill.name)}»: нажмите на противника на поле или на его карточку.</p><button class="btn ghost sm" data-fk="untgt">Другой приём</button>`;
    const t=F.$('.drf-team.b .drf-fc.tg');if(t)t.focus({preventScroll:true});return}
  const B=root.DRBATTLE,f=F.pend.f;
  el.innerHTML=F.ops.map((o,i)=>{const s=o.skill,E=s.el&&B.EFFECT[s.el],atk=s.el?root.DRATK.ATTACKS[s.el].name:'';
    const sub=s.id==='strike'?'обычный урон':s.id==='guard'?'урон по нему ×0,5 до своего хода':s.id==='rage'?`урон ×${f1(B.POWER.rage)}, один раз за бой`:
      `${atk} · урон ×${f1(B.POWER.element)}${E?', '+(E.k==='heal'?'лечит себя':E.k==='drain'?'вытягивает силы':`${Math.round(E.chance*100)} %: ${E.name.toLowerCase()}`):''}`;
    const ic=s.id==='strike'?'🐾':s.id==='guard'?'🛡':s.id==='rage'?'💥':EL_IC[s.el];
    return `<button class="drf-skb${s.id==='rage'?' rage':''}" data-fk="skill" data-sk="${s.id}"${i===0?' data-first':''}><span aria-hidden="true">${ic}</span><b>${esc(s.id==='rage'?'Ярость дракона':s.name)}</b><small>${esc(sub)}</small><kbd>${i+1}</kbd></button>`}).join('');
  const b=el.querySelector('[data-first]');if(b&&!F.el.querySelector('.drf-res'))b.focus({preventScroll:true})}

/* ---------- события ---------- */
async function onClick(e){
  const b=e.target.closest('[data-fk]');if(!b||!F||b.disabled)return;const k=b.dataset.fk;
  if(k==='close')finish();
  else if(k==='map'){F.tok++;stopFight(F);showMap()}
  else if(k==='prep'){F.pick=F.pick||null;showPrep(b.dataset.id)}
  else if(k==='pick'){const id=b.dataset.id,i=F.pick.indexOf(id);if(i>=0)F.pick.splice(i,1);else if(F.pick.length<3)F.pick.push(id);else{F.pick[2]=id}
    LS('drfPick',JSON.stringify(F.pick));const y=(F.$('.drf-scroll')||{}).scrollTop;showPrep(F.bid);const sc=F.$('.drf-scroll');if(sc)sc.scrollTop=y;
    const nb=[...F.el.querySelectorAll('[data-fk=pick]')].find(x=>x.dataset.id===id);if(nb)nb.focus({preventScroll:true})}
  else if(k==='start')startFight();
  else if(k==='again'){F.tok++;stopFight(F);startFight()}
  else if(k==='next'){F.tok++;stopFight(F);showPrep(b.dataset.id)}
  else if(k==='quit'){const ok=root.askConfirm?await root.askConfirm('Выйти из боя? Он не засчитается, но ничего и не отнимет.','Выйти'):confirm('Выйти из боя? Он не засчитается.');
    if(ok&&F){F.tok++;stopFight(F);showPrep(F.bid)}}
  else if(k==='speed'){F.speed=F.speed>1?1:2;b.setAttribute('aria-pressed',F.speed>1)}
  else if(k==='auto'){F.auto=!F.auto;b.setAttribute('aria-pressed',F.auto);if(F.auto&&F.pend){const c=F.b.ai('normal');done(c)}}
  else if(k==='snd'){F.snd=!F.snd;LS('drfSnd',F.snd?'1':'0');b.setAttribute('aria-pressed',F.snd);b.textContent=F.snd?'🔊':'🔇';sfx('tap')}
  else if(k==='skill')pickSkill(b.dataset.sk);
  else if(k==='untgt'){F.tgtMode=null;renderSkills();renderTeams();say(`Ход: ${F.pend.f.name}. Выберите приём`)}
  else if(k==='tgt')pickTarget(b.dataset.id);
  else if(k==='press')press()}
function onKey(e){
  if(!F||document.querySelector('dialog[open]'))return;
  e.stopPropagation();const k=e.key;
  if(k==='Escape'){e.preventDefault();
    if(F.screen==='fight'){if(F.tgtMode){F.tgtMode=null;renderSkills();renderTeams()}else{const q=F.$('[data-fk=quit]');if(q)q.click()}}
    else if(F.screen==='result'||F.screen==='prep'){F.tok++;stopFight(F);showMap()}else finish();return}
  if(k==='Tab'){trap(e);return}
  if(F.screen!=='fight'||e.ctrlKey||e.metaKey||e.altKey)return;
  if(k===' '&&F.ring){e.preventDefault();press();return}
  if(/^[1-5]$/.test(k)&&F.ops&&!F.tgtMode){const o=F.ops[+k-1];if(o){e.preventDefault();pickSkill(o.skill.id)}}}
function trap(e){
  const f=[...F.el.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),summary')].filter(x=>x.getClientRects().length);if(!f.length)return;
  const res=F.el.querySelector('.drf-res'),list=res?f.filter(x=>res.contains(x)):f,i=list.indexOf(document.activeElement);
  if(e.shiftKey&&i<=0){e.preventDefault();list[list.length-1].focus()}else if(!e.shiftKey&&(i===-1||i===list.length-1)){e.preventDefault();list[0].focus()}}

/* для проверок: состояние боя и ход за игрока */
function state(){if(!F)return null;const b=F.b;
  return {screen:F.screen,bid:F.bid,pick:F.pick&&F.pick.slice(),form:F.form,waiting:!!F.pend,targeting:!!F.tgtMode,ring:F.ring?{pressed:F.ring.pressed,ok:F.ring.ok,dt:F.scene.t-(F.ring.t0+RING)}:null,
    result:F.result,round:b&&b.round,over:b&&b.over,f:b?b.f.map(x=>({id:x.id,side:x.side,hp:x.hp,ko:x.ko,rage:x.rage})):[],
    draw:F.scene?F.scene.stats.draw.slice():[],frame:F.scene?F.scene.stats.frame.slice():[]}}
root.DRFIGHT={open,close:finish,state,press,loadAll};
addEventListener('pagehide',()=>{if(F)finish()});
})(typeof window!=='undefined'?window:globalThis);
