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
const foeSpecs=bt=>bt.foes().map(f=>Object.assign(specOf('x:'+f.id,f.name,f.genome,f.lvl,'B'),{traits:(f.traits||[]).slice()}));
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

/* ---------- карта похода ----------
   Четыре региона вкладками. В регионе рисованная карта: путь, узлы-кнопки (пройден, открыт, текущая цель, закрыт, босс),
   лучшие звёзды под узлом. Под картой карточка выбранного узла, ниже тот же список текстом для чтения с экрана
   и для тех, кому список удобнее карты. Награда похода — только звёзды. */
const TRAIT_IC=t=>(root.DRBATTLE.TRAITS[t]||{}).ic||'';
const AI_RU={easy:'лёгкий',normal:'средний',hard:'трудный'};
function seeded(s){let a=0;for(const c of s)a=(a*31+c.charCodeAt(0))>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
/* сглаженный путь через узлы (Катмулл — Ром в кубические кривые) */
function curve(pts){let d=`M${pts[0][0]} ${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2,k=6;
    d+=` C${(p1[0]+(p2[0]-p0[0])/k).toFixed(1)} ${(p1[1]+(p2[1]-p0[1])/k).toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/k).toFixed(1)} ${(p2[1]-(p3[1]-p1[1])/k).toFixed(1)} ${p2[0]} ${p2[1]}`}
  return d}
/* места для украшений: не ближе d к узлам и к отрезкам пути */
function freeSpots(ns,n,d,seed){const r=seeded(seed),out=[];
  const near=(x,y)=>ns.some(p=>Math.hypot(p.x-x,p.y-y)<d)||ns.slice(1).some((q,i)=>{const p=ns[i],vx=q.x-p.x,vy=q.y-p.y,l=vx*vx+vy*vy,t=Math.max(0,Math.min(1,((x-p.x)*vx+(y-p.y)*vy)/l));return Math.hypot(p.x+t*vx-x,p.y+t*vy-y)<d*0.6});
  for(let k=0;k<n*8&&out.length<n;k++){const x=4+r()*92,y=4+r()*142;if(!near(x,y)&&!out.some(o=>Math.hypot(o[0]-x,o[1]-y)<d*0.7))out.push([+x.toFixed(1),+y.toFixed(1),r()])}
  return out}
function terrain(reg,ns){
  const P=reg.pal,id='drfg-'+reg.id;let s=`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky}"/><stop offset="1" stop-color="${P.land}" stop-opacity=".55"/></linearGradient></defs><rect width="100" height="150" fill="url(#${id})"/>`;
  if(reg.id==='ember'){
    s+=`<path d="M0 46 L14 22 L24 40 L36 18 L50 34 L64 14 L78 36 L88 20 L100 40 L100 0 L0 0Z" fill="${P.dark}" opacity=".22"/>`;
    s+=`<path d="M28 34 L44 8 L50 12 L56 8 L72 34Z" fill="${P.dark}" opacity=".45"/><path d="M44 8 Q50 3 56 8 Q50 11 44 8Z" fill="${P.acc}" opacity=".8"/>`;
    s+=`<path d="M0 150 L0 112 Q12 104 22 112 L30 150Z M100 150 L100 120 Q88 112 80 124 L74 150Z" fill="${P.dark}" opacity=".18"/>`;
    freeSpots(ns,16,11,reg.id).forEach(([x,y,r])=>{s+=r<.5?`<path d="M${x-4} ${y+2} L${x} ${y-4} L${x+4} ${y+2}Z" fill="${P.dark}" opacity=".35"/>`:`<ellipse cx="${x}" cy="${y}" rx="${2+r*2}" ry="${1.2+r}" fill="${P.path}" opacity=".25"/>`})}
  else if(reg.id==='tide'){
    s+=`<rect width="100" height="150" fill="${P.acc}" opacity=".18"/>`;
    ns.forEach((n,i)=>{s+=`<ellipse cx="${n.x}" cy="${n.y+2}" rx="${n.boss?15:12}" ry="${n.boss?9:7}" fill="#F4E3B5" opacity=".9"/><ellipse cx="${n.x}" cy="${n.y+2}" rx="${n.boss?17:14}" ry="${n.boss?11:9}" fill="none" stroke="#fff" stroke-width=".6" opacity=".6"/>`});
    freeSpots(ns,22,10,reg.id).forEach(([x,y,r])=>{s+=r<.75?`<path d="M${x-4} ${y} q2 -2 4 0 t4 0" fill="none" stroke="${P.dark}" stroke-width=".6" opacity=".45"/>`:`<path d="M${x} ${y} l0 -6 m0 1 q-3 -1 -4 1 m4 -1 q3 -1 4 1" stroke="#2F6B3A" stroke-width=".8" fill="none" opacity=".6"/>`})}
  else if(reg.id==='grove'){
    freeSpots(ns,30,9,reg.id).forEach(([x,y,r])=>{const R=2.6+r*2.4;s+=r<.82?`<circle cx="${x}" cy="${y}" r="${R}" fill="${P.dark}" opacity="${(.35+r*.3).toFixed(2)}"/><circle cx="${x-R*.3}" cy="${y-R*.3}" r="${R*.5}" fill="${P.land}" opacity=".5"/>`:
      `<path d="M${x-3} ${y} Q${x} ${y-5} ${x+3} ${y}Z" fill="${P.acc}" opacity=".7"/><rect x="${x-.6}" y="${y}" width="1.2" height="2.4" fill="#F1E7D0" opacity=".8"/>`})}
  else{
    s+=`<linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.path}" stop-opacity=".45"/><stop offset="1" stop-color="${P.path}" stop-opacity="0"/></linearGradient><rect width="100" height="80" fill="url(#${id}n)"/>`;
    freeSpots(ns,18,6,reg.id+'*').filter(p=>p[1]<70).forEach(([x,y,r])=>{s+=`<circle cx="${x}" cy="${y}" r="${(.4+r*.6).toFixed(2)}" fill="#FFF7D6" opacity=".9"/>`});
    s+=`<path d="M0 150 L0 96 L14 74 L26 96 L40 64 L56 98 L70 70 L84 92 L100 66 L100 150Z" fill="${P.dark}" opacity=".22"/>`;
    s+=`<path d="M10 80 L14 74 L18 80 L14 78Z M36 70 L40 64 L44 70 L40 68Z M66 76 L70 70 L74 76 L70 74Z M96 72 L100 66 L100 74Z" fill="#fff" opacity=".8"/>`;
    freeSpots(ns,8,14,reg.id).forEach(([x,y,r])=>{s+=`<ellipse cx="${x}" cy="${y}" rx="${6+r*5}" ry="${2+r*1.5}" fill="#fff" opacity=".45"/>`})}
  return s}
function mapState(p,n){const st=p.best[n.id]||0,op=root.DRCAMP.unlocked(p,n.id),g=root.DRCAMP.goal(p);return {st,op,goal:!!g&&g.id===n.id}}
function nodeLabel(p,n){const C=root.DRCAMP,m=mapState(p,n),reg=C.region(n.region);
  return `${n.boss?'Босс':'Бой '+n.n} из 8, ${n.name}. ${m.op?(m.st?`Пройден, лучший результат ${m.st} из 3 звёзд`:'Открыт, ещё не пройден'):C.lockText(p,n.id)}${m.goal?'. Текущая цель':''}. Рекомендуемый уровень ${n.rec}, в бою до ${n.team.max} ${n.team.max===1?'дракона':'драконов'}.`}
function showMap(){
  F.picOf={};const C=root.DRCAMP,p=F.api.progress(),tot=C.total(p),g=C.goal(p);
  if(!F.sel||!C.byId(F.sel))F.sel=(F.bid&&C.byId(F.bid)&&F.bid)||(g&&g.id)||C.NODES[C.NODES.length-1].id;
  if(!F.reg)F.reg=C.byId(F.sel).region;
  const reg=C.region(F.reg),ns=C.nodesOf(reg.id),open=C.regionOpen(p,reg.id),pts=ns.map(n=>[n.x,n.y]);
  if(C.byId(F.sel).region!==reg.id)F.sel=(ns.find(n=>mapState(p,n).goal)||ns.find(n=>C.unlocked(p,n.id)&&!p.best[n.id])||ns[0]).id;
  const tabs=C.REGIONS.map((r,i)=>{const o=C.regionOpen(p,r.id),cur=r.id===reg.id;
    return `<button role="tab" class="drf-rt${cur?' on':''}${o?'':' lock'}" data-fk="reg" data-v="${r.id}" aria-selected="${cur}" style="--ra:${r.pal.acc}"><b>${o?'':'🔒 '}${esc(r.name)}</b><small>${o?`★ ${C.total(p,r.id)} из ${C.max(r.id)}`:'закрыт'}</small></button>`}).join('');
  /* путь: пройденная часть сплошная, дальше пунктир */
  const lastDone=ns.reduce((a,n,i)=>p.best[n.id]?i:a,-1);
  const done=lastDone>0?`<path d="${curve(pts.slice(0,lastDone+1))}" fill="none" stroke="${reg.pal.path}" stroke-width="2.2" stroke-linecap="round"/>`:'';
  const svg=`<svg class="drf-msv" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">${terrain(reg,ns)}
    <path d="${curve(pts)}" fill="none" stroke="${reg.pal.path}" stroke-width="1.6" stroke-dasharray="2.4 2.2" stroke-linecap="round" opacity=".55"/>${done}</svg>`;
  const pins=ns.map(n=>{const m=mapState(p,n),sel=n.id===F.sel;
    return `<button class="drf-pin${m.st?' done':''}${m.op?'':' lock'}${m.goal?' goal':''}${n.boss?' boss':''}${sel?' sel':''}" data-fk="sel" data-id="${n.id}" style="left:${n.x}%;top:${(n.y/150*100).toFixed(2)}%"
      aria-pressed="${sel}" aria-label="${esc(nodeLabel(p,n))}"${sel?' data-first':''}><span class="drf-pc" aria-hidden="true">${m.op?(n.boss?'👑':n.n):'🔒'}</span>
      ${m.goal?'<span class="drf-pg" aria-hidden="true">цель</span>':''}<span class="drf-ps" aria-hidden="true">${m.op?'★'.repeat(m.st)+'☆'.repeat(3-m.st):''}</span></button>`}).join('');
  const list=ns.map(n=>{const m=mapState(p,n);
    return `<li><button class="drf-node${m.st?' done':''}${m.op?'':' lock'}${n.boss?' boss':''}" data-fk="${m.op?'prep':'sel'}" data-id="${n.id}">
      <span class="drf-n" aria-hidden="true">${n.boss?'👑':n.n}</span>
      <span class="drf-nt"><b>${esc(n.name)}${m.goal?' · цель':''}</b><small>${m.op?`Уровень ${n.rec} · до ${n.team.max} ${n.team.max===1?'дракона':'драконов'}`:esc(C.lockText(p,n.id))}</small></span>
      <span class="drf-st" aria-label="${m.st?'лучший результат: '+m.st+' из 3 звёзд':m.op?'ещё не пройден':'закрыт'}">${m.op?'★'.repeat(m.st)+'☆'.repeat(3-m.st):'🔒'}</span></button></li>`}).join('');
  setScreen('map',`<header class="drf-top"><button class="drf-x" data-fk="close">← К острову</button><h2>Поход драконов</h2><span class="drf-tot" title="Звёзды похода">★ ${tot} из ${C.max()}</span></header>
    <div class="drf-kinds" role="navigation" aria-label="Виды боёв"><span class="on" aria-current="page">🐉 Поход драконов <small>3 на 3, ходы, звёзды</small></span><button data-fk="arena">🦠 Турнир бактерий <small>коллекция из чашки, бои ночью</small></button></div>
    <div class="drf-rts" role="tablist" aria-label="Регионы">${tabs}</div>
    <div class="drf-scroll">${wantHTML()}<p class="drf-intro"><b>${esc(reg.name)}</b>: ${esc(reg.intro)}${open?'':' '+esc(C.lockText(p,ns[0].id))+'.'}</p>
      <div class="drf-mapw"><div class="drf-map" style="--pa:${reg.pal.acc};--pp:${reg.pal.path};--pi:${reg.pal.ink}">${svg}${pins}</div><div class="drf-ncw">${nodeCard(p,C.byId(F.sel))}</div></div>
      <details class="drf-rules drf-ls" data-k="list"${LS('drfList')==='1'?' open':''}><summary>Все бои региона списком</summary><ol class="drf-path">${list}</ol></details>
      <p class="drf-note">${C.done(p)?'Все четыре региона пройдены! Бои можно переигрывать ради трёх звёзд. ':''}Награда похода — звёзды за каждый бой, лучший результат не уменьшается, поражение ничего не отнимает. Золото, корм и самоцветы за бои не начисляются, остров живёт по карточкам, как раньше. Сражений между игроками в походе нет.</p></div>`);
  const sl=F.$('.drf-pin.sel'),sc=F.$('.drf-scroll');
  /* выбранный узел посередине видимой части карты: на телефоне снизу её закрывает прилипшая карточка */
  if(sl&&sc){const r=sl.getBoundingClientRect(),q=sc.getBoundingClientRect(),cw=F.$('.drf-ncw'),cr=cw&&getComputedStyle(cw).position==='sticky'?cw.getBoundingClientRect().height:0,
    vis=q.height-cr;if(r.top<q.top+30||r.bottom>q.top+vis-30)sc.scrollTop+=r.top+r.height/2-q.top-vis/2}
  const dl=F.$('.drf-ls');if(dl)dl.addEventListener('toggle',()=>LS('drfList',dl.open?'1':'0'))}
/* пришли из осмотра «В бой»: этот дракон встанет первым в любом выбранном бою */
function wantHTML(){const d=F.want&&myDragons().find(x=>x.id===F.want);
  return d?`<p class="drf-want">🐉 <b>${esc(d.name)}</b> (${d.lvl}-й ур., ${elsText(d.els)}) встанет первым в команду. Выберите бой на карте.</p>`:''}
function nodeCard(p,n){const C=root.DRCAMP,m=mapState(p,n),foes=foeSpecs(n),els=[...new Set(foes.flatMap(f=>f.els))],tr=[...new Set(foes.flatMap(f=>f.traits))];
  return `<section class="drf-nc${n.boss?' boss':''}" aria-live="polite"><div class="drf-nch"><span>${n.boss?'👑 Босс региона':`Бой ${n.n} из 8`}${m.goal?' · <b>текущая цель</b>':''}</span><span class="drf-st">${m.op?'★'.repeat(m.st)+'☆'.repeat(3-m.st):''}</span></div>
    <h3>${esc(n.name)}</h3><p>${esc(n.story)}</p>
    <p class="drf-small">Уровень ${n.rec} · до ${n.team.max} ${n.team.max===1?'дракона':'драконов'} · ${foes.length} ${foes.length===1?'противник':'противника'} · ${els.length?els.map(e=>EL_IC[e]).join(' '):'без стихий'}${tr.length?' · '+tr.map(t=>TRAIT_IC(t)+' '+root.DRBATTLE.TRAITS[t].name.toLowerCase()).join(', '):''} · компьютер ${AI_RU[n.ai]}</p>
    ${m.op?`<button class="btn" data-fk="prep" data-id="${n.id}">${m.st?'Переиграть':'Выбрать команду'}</button>`:`<p class="drf-lock">🔒 ${esc(C.lockText(p,n.id))}</p>`}</section>`}

/* подготовка */
function teamMax(bt){return bt.team&&bt.team.max||3}
const pickKey=max=>max===3?'drfPick':'drfPick'+max;
function showPrep(id){
  const C=root.DRCAMP,bt=C.byId(id);if(!bt||!C.unlocked(F.api.progress(),id))return showMap();
  const max=teamMax(bt);
  F.bid=id;F.sel=id;F.reg=bt.region;F.picOf={};const foes=foeSpecs(bt),mine=myDragons();
  const ok=x=>mine.some(d=>d.id===x);
  /* у боёв на одного и двоих свой выбор: общий состав на троих от этого не меняется */
  if(!F.pick||F.pickMax!==max){let saved=null;try{saved=JSON.parse(LS(pickKey(max))||'null')}catch(e){}
    if(!Array.isArray(saved)&&max<3)try{saved=JSON.parse(LS('drfPick')||'null')}catch(e){}
    let base=(Array.isArray(saved)?saved.filter(ok):[]).slice(0,max);
    if(!base.length)base=mine.slice().sort((a,b)=>b.lvl-a.lvl).slice(0,max).map(d=>d.id);
    F.pick=base;F.pickMax=max}
  /* пришли из осмотра «В бой»: этот дракон первым, остальные места как в прошлый раз */
  if(F.want&&ok(F.want))F.pick=[F.want].concat(F.pick.filter(x=>x!==F.want)).slice(0,max);
  F.want=null;
  F.pick=F.pick.filter(ok).slice(0,max);
  const trs=f=>f.traits.length?`<span class="drf-trs">${f.traits.map(t=>`<span title="${esc(root.DRBATTLE.TRAITS[t].text)}">${TRAIT_IC(t)} ${esc(root.DRBATTLE.TRAITS[t].name)}</span>`).join('')}</span>`:'';
  const foe=f=>`<div class="drf-foe">${picHTML(f,96,72)}<b>${esc(f.name)}</b><small>${f.lvl}-й ур. · ${elsText(f.els)}</small>${trs(f)}</div>`;
  const hint=d=>{const st=foes.filter(f=>edge(d,f).out>1).map(f=>f.name),wk=foes.filter(f=>edge(d,f).inn>1).map(f=>f.name);
    return (st.length?`<span class="hup">сильнее против: ${esc(st.join(', '))}</span>`:'')+(wk.length?`<span class="hdn">уязвим для: ${esc(wk.join(', '))}</span>`:'')+(!d.els.length?'<span>бьёт Ударом, стихии нет</span>':'')};
  const card=d=>{const i=F.pick.indexOf(d.id);
    return `<button class="drf-pk${i>=0?' on':''}" data-fk="pick" data-id="${esc(d.id)}" aria-pressed="${i>=0}">${i>=0?`<span class="drf-ix" aria-hidden="true">${i+1}</span>`:''}${picHTML(d,104,78)}
      <b>${esc(d.name)}</b><small>${d.lvl}-й ур. · ${elsText(d.els)}</small><span class="drf-sts"><span title="Здоровье">❤ ${d.hp}</span><span title="Атака">⚔ ${d.atk}</span><span title="Защита">🛡 ${d.def}</span><span title="Скорость">💨 ${d.spd}</span></span><span class="drf-hn">${hint(d)}</span></button>`};
  const n=F.pick.length,lv=F.pick.map(x=>mine.find(d=>d.id===x).lvl),tr=[...new Set(foes.flatMap(f=>f.traits))];
  const word=k=>k===1?'дракона':'драконов';
  setScreen('prep',`<header class="drf-top"><button class="drf-x" data-fk="map">← К карте</button><h2>${esc(bt.name)}</h2><span class="drf-tot">${AI_RU[bt.ai]}</span></header>
    <div class="drf-scroll"><p class="drf-intro">${esc(bt.story)}</p>
    <div class="drf-tac"><b>Тактика.</b> ${esc(bt.idea)}</div>
    ${bt.boss?`<div class="drf-tac boss"><b>👑 Особенности босса.</b> ${esc(bt.bossNote)}</div>`:''}
    <h3>Противники</h3><div class="drf-foes">${foes.map(foe).join('')}</div>
    ${tr.length?`<ul class="drf-trl">${tr.map(t=>`<li><b>${TRAIT_IC(t)} ${esc(root.DRBATTLE.TRAITS[t].name)}.</b> ${esc(root.DRBATTLE.TRAITS[t].text)}</li>`).join('')}</ul>`:''}
    <h3>Ваша команда <small>${max===3?'выберите до трёх драконов, первый встанет впереди':max===2?'в этот бой идут только двое':'в этот бой идёт один дракон'}</small></h3>
    ${mine.length?`<div class="drf-grid">${mine.map(card).join('')}</div>`:'<p class="drf-intro">На острове пока нет драконов.</p>'}
    <p class="drf-small">Звёзды: ${esc(bt.stars.text)} Награда: ${esc(bt.reward.text)}</p>
    <details class="drf-rules"><summary>Как идёт бой</summary><ul>
      <li>Ходят по очереди, первым самый быстрый. У каждого дракона есть Удар, атака своей стихии (у гибрида две) и Защита: до своего следующего хода он получает вдвое меньше урона.</li>
      <li>Стихии идут по кругу: Огонь сильнее Флоры, Флора сильнее Земли, Земля сильнее Воздуха, Воздух сильнее Воды, Вода сильнее Огня. Свет и Тьма сильны друг против друга. Сильная стихия бьёт в полтора раза больнее, слабая на четверть слабее. Это правило игры, у настоящих животных стихий нет.</li>
      <li>Пока стихия летит, по кругу у дракона бежит кольцо. Нажмите (или пробел), когда оно сойдётся с меткой: Точный удар даёт +25 % урона.</li>
      <li>Шкала ярости копится от ударов. Когда она полна, один раз за бой можно выпустить Ярость дракона.</li>
      <li>Особенности противников (толстая шкура, вожак, регенерация, закалка, гнев) — открытые правила: всё, что о них знает компьютер, написано здесь.</li></ul></details></div>
    <footer class="drf-go"><span class="drf-rec">Рекомендуемый уровень ${bt.rec}.${n?` У вас: ${lv.join(', ')}.`:''}</span><button class="btn" data-fk="start"${n?'':' disabled'}>В бой · ${n} из ${max}</button></footer>`)}

/* ---------- бой ---------- */
const RING=1.05,LEAD=0.5,WIN=0.12;   /* кольцо Точного удара: 1,05 с до выпуска, атака стартует через 0,5 с, окно ±0,12 с */
const FORM={wide:[[0.74,0.08],[1.52,-0.2],[1.7,0.34]],tall:[[0.56,0],[0.8,0.7],[0.58,1.4]]};

async function startFight(){
  const C=root.DRCAMP,B=root.DRBATTLE,bt=C.byId(F.bid),mine=myDragons();
  const max=teamMax(bt),A=F.pick.slice(0,max).map(x=>mine.find(d=>d.id===x)).filter(Boolean),Bs=foeSpecs(bt);if(!A.length)return;
  LS(pickKey(max),JSON.stringify(F.pick));
  const tok=++F.tok,seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
  F.b=new B.Battle({A,B:Bs,seed,star3:bt.stars&&bt.stars.r3});F.lvl=bt.ai;F.nums=[];F.ring=null;F.tgtMode=null;F.waits=[];F.result=null;
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
    else if(e.type==='regen'){num(e.id,'+'+e.amt+' 🌱','#6BE38A');renderTeams();say(`${F.b.get(e.id).name}: регенерация, +${e.amt}`);await wait(0.5,tok)}
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
    else if(e.type==='resist')num(e.target,'💎 закалка: без эффекта','#D8E6FF')
    else if(e.type==='enrage'){num(e.id,'💢 гнев: атака +30 %','#FF6A5A');say(`${F.b.get(e.id).name} в гневе: атака +30 % до конца боя`)}
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
  /* звёзды пишутся в облако; итог показывает честный статус записи, а не обещание */
  F.save=null;
  if(won){try{const r=F.api.record(F.bid,stars);if(r){p=r.p;F.save='saving';const my=F;
    Promise.resolve(r.saved).then(s=>{if(F===my){F.save=s==='ok'?'ok':s;saveLine()}},()=>{if(F===my){F.save='error';saveLine()}})}}catch(e){console.error(e);F.save='error'}}
  await wait(1.6,tok);
  F.result={won,stars,before,best:p.best[F.bid]||0};showResult()}
function showResult(){
  const R=F.result,C=root.DRCAMP,i=C.NODES.findIndex(x=>x.id===F.bid),bt=C.NODES[i],nx=C.NODES[i+1],p=F.api.progress(),why=F.b.log.length&&F.b.round>F.b.maxRounds;
  const newReg=nx&&nx.region!==bt.region&&C.unlocked(p,nx.id)&&!R.before?C.region(nx.region):null;
  const box=document.createElement('div');box.className='drf-res';box.setAttribute('role','alertdialog');box.setAttribute('aria-labelledby','drf-rt');
  const st=R.won?[1,2,3].map(n=>`<span class="${n<=R.stars?'on':''}" style="--i:${n}">★</span>`).join(''):'';
  box.innerHTML=`<div class="drf-rc"><h2 id="drf-rt">${R.won?'Победа!':'Поражение'}</h2>${R.won?`<div class="drf-stars" aria-label="${R.stars} из 3 звёзд">${st}</div>
    <p>${R.stars===3?'Никто из команды не выбыл.':R.stars===2?(bt.stars.r3&&!F.b.f.some(x=>x.side==='A'&&x.ko)?`Без потерь, но дольше ${bt.stars.r3} раундов: быстрее будет три звезды.`:'Один дракон выбыл. Без потерь будет три звезды.'):'Победа с потерями. Попробуйте другой состав или стихии посильнее.'}${R.stars>R.before&&R.before?` Новый рекорд: было ${R.before}.`:''}</p>
    <p class="drf-small">Звёзды похода: ${C.total(p)} из ${C.max()}.${newReg?` Открыт новый регион «${esc(newReg.name)}».`:nx&&C.unlocked(p,nx.id)&&!R.before?` Открыт бой «${esc(nx.name)}».`:''}</p>`
    :`<p>${why?'Тридцать раундов прошло, а противники ещё держатся: ничья засчитывается как поражение.':'Команда выбыла. Посмотрите, какие стихии сильнее против этих противников, и возьмите драконов посильнее.'}</p><p class="drf-small">Поражение ничего не отнимает: звёзды и драконы остаются.</p>`}
    ${R.won?'<p class="drf-svl" role="status" aria-live="polite"></p>':''}
    <div class="drf-ra">${R.won&&nx&&C.unlocked(p,nx.id)?`<button class="btn" data-fk="next" data-id="${nx.id}" data-first>${newReg?'В новый регион':'Следующий бой'}</button>`:''}<button class="btn${R.won&&nx?' ghost':''}" data-fk="again"${R.won&&nx?'':' data-first'}>Ещё раз</button><button class="btn ghost" data-fk="map">К карте</button></div></div>`;
  F.el.appendChild(box);saveLine();const f=box.querySelector('[data-first]');if(f)f.focus({preventScroll:true});F.screen='result'}
/* строка о записи звёзд на экране итога */
function saveLine(){const e=F&&F.$('.drf-svl');if(!e)return;const s=F.save;
  e.className='drf-svl '+(s||'');
  e.innerHTML=s==='ok'?'✓ Звёзды сохранены':s==='saving'?'Сохраняю звёзды…':s==='conflict'?'Звёзды не записаны: остров изменили в другой вкладке или на другом устройстве. Закройте поход и выберите версию на острове.':
    s==='error'?'Звёзды пока не сохранены: нет связи с облаком. <button class="btn sm" data-fk="svretry">Повторить</button>':''}

/* ---------- панели боя ---------- */
function renderTeams(){
  if(!F||!F.b)return;const b=F.b,m=F.tgtMode,cur=b.cur||F.acting;
  ['a','b'].forEach(s=>{const el=F.$('.drf-team.'+s);if(!el)return;const side=s.toUpperCase(),act=F.pend&&F.pend.f;
    el.innerHTML=b.f.filter(f=>f.side===side).map(f=>{const tg=m&&m.targets.includes(f.id),mul=tg&&m.skill.el?root.DRBATTLE.mult(m.skill.el,f.els):1;
      const fx=Object.entries(f.fx).map(([k,n])=>`<span title="${FX_TXT[k]}, ещё ${n}">${FX_IC[k]}${n}</span>`).join('')+(f.guard?'<span title="защита">🛡</span>':'')+
        f.traits.map(t=>{const T=root.DRBATTLE.TRAITS[t];return `<span class="drf-tr${t==='enrage'&&f.enraged?' hot':''}" title="${esc(T.name+': '+T.text)}">${T.ic}</span>`}).join('');
      const hp=Math.max(0,f.hp);
      return `<button class="drf-fc${f.id===cur?' cur':''}${f.ko?' ko':''}${tg?' tg':''}" data-fk="tgt" data-id="${esc(f.id)}"${tg?'':' tabindex="-1" aria-disabled="true"'}
        aria-label="${esc(f.name)}, ${f.lvl}-й уровень, здоровье ${hp} из ${f.maxHp}${f.traits.length?', '+f.traits.map(t=>root.DRBATTLE.TRAITS[t].name).join(', '):''}${f.enraged?', в гневе':''}${f.ko?', выбыл':''}${tg?(mul>1?', сильная стихия':mul<1?', слабая стихия':'')+'. Выбрать целью':''}">
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
  else if(k==='reg'){F.reg=b.dataset.v;F.sel=null;const C=root.DRCAMP,p=F.api.progress(),ns=C.nodesOf(F.reg);
    F.sel=(ns.find(n=>C.unlocked(p,n.id)&&!p.best[n.id])||ns.filter(n=>C.unlocked(p,n.id)).pop()||ns[0]).id;showMap();const t=F.$('.drf-rt.on');if(t)t.focus({preventScroll:true})}
  else if(k==='sel'){F.sel=b.dataset.id;const id=F.sel;showMap();const nb=F.$(`.drf-pin[data-id="${id}"]`);if(nb)nb.focus({preventScroll:true})}
  else if(k==='arena'){const go=F.api.openArena;finish();if(go)go()}
  else if(k==='map'){F.tok++;stopFight(F);
    /* после победы карта показывает следующую цель */
    if(F.screen==='result'&&F.result&&F.result.won){const g=root.DRCAMP.goal(F.api.progress());if(g){F.sel=g.id;F.reg=g.region}}
    showMap()}
  else if(k==='prep'){F.pick=F.pick||null;showPrep(b.dataset.id)}
  else if(k==='pick'){const id=b.dataset.id,i=F.pick.indexOf(id),max=F.pickMax||3;if(i>=0)F.pick.splice(i,1);else if(F.pick.length<max)F.pick.push(id);else{F.pick[max-1]=id}
    LS(pickKey(max),JSON.stringify(F.pick));const y=(F.$('.drf-scroll')||{}).scrollTop;showPrep(F.bid);const sc=F.$('.drf-scroll');if(sc)sc.scrollTop=y;
    const nb=[...F.el.querySelectorAll('[data-fk=pick]')].find(x=>x.dataset.id===id);if(nb)nb.focus({preventScroll:true})}
  else if(k==='start')startFight();
  else if(k==='again'){F.tok++;stopFight(F);startFight()}
  else if(k==='next'){F.tok++;stopFight(F);const nx=root.DRCAMP.byId(b.dataset.id),same=nx.region===F.reg;F.sel=nx.id;F.reg=nx.region;
    if(same)showPrep(nx.id);else showMap()}
  else if(k==='quit'){const ok=root.askConfirm?await root.askConfirm('Выйти из боя? Он не засчитается, но ничего и не отнимет.','Выйти'):confirm('Выйти из боя? Он не засчитается.');
    if(ok&&F){F.tok++;stopFight(F);showPrep(F.bid)}}
  else if(k==='speed'){F.speed=F.speed>1?1:2;b.setAttribute('aria-pressed',F.speed>1)}
  else if(k==='auto'){F.auto=!F.auto;b.setAttribute('aria-pressed',F.auto);if(F.auto&&F.pend){const c=F.b.ai('normal');done(c)}}
  else if(k==='snd'){F.snd=!F.snd;LS('drfSnd',F.snd?'1':'0');b.setAttribute('aria-pressed',F.snd);b.textContent=F.snd?'🔊':'🔇';sfx('tap')}
  else if(k==='skill')pickSkill(b.dataset.sk);
  else if(k==='untgt'){F.tgtMode=null;renderSkills();renderTeams();say(`Ход: ${F.pend.f.name}. Выберите приём`)}
  else if(k==='tgt')pickTarget(b.dataset.id);
  else if(k==='press')press()
  else if(k==='svretry'&&F.api.retry){F.save='saving';saveLine();const my=F;F.api.retry().then(s=>{if(F===my){F.save=s;saveLine()}})}}
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
  return {screen:F.screen,bid:F.bid,reg:F.reg,sel:F.sel,pick:F.pick&&F.pick.slice(),form:F.form,waiting:!!F.pend,targeting:!!F.tgtMode,ring:F.ring?{pressed:F.ring.pressed,ok:F.ring.ok,dt:F.scene.t-(F.ring.t0+RING)}:null,
    result:F.result,round:b&&b.round,over:b&&b.over,f:b?b.f.map(x=>({id:x.id,side:x.side,hp:x.hp,ko:x.ko,rage:x.rage})):[],
    draw:F.scene?F.scene.stats.draw.slice():[],frame:F.scene?F.scene.stats.frame.slice():[]}}
root.DRFIGHT={open,close:finish,state,press,loadAll};
addEventListener('pagehide',()=>{if(F)finish()});
})(typeof window!=='undefined'?window:globalThis);
