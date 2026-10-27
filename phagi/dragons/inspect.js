/* Осмотр дракона (этап 2 Драконов 3.0): нажатие на дракона на острове или в списке открывает отдельную сцену.
   Камера плавно приближается от того места, где дракон был на острове, дракон крупно и живой (риг из рисунка A,
   anim.js), части тела можно рассмотреть мышью, касанием и с клавиатуры, рядом имя, возраст, пол, стихии,
   характеристики, «Покормить», «Родословная», «В бой» и отдельная кнопка «Посмотреть генотип».
   Закрытие возвращает камеру туда же, остров при этом не перестраивается: его камера (S.drgCam) и выбор не меняются.
   Сцена живёт вне дерева страницы (последний ребёнок body), поэтому перерисовка острова ей не мешает.
   Модули рисунка и анимации (morph, shape, art, texcache, sprites, anim, rig, stats) подгружаются при первом осмотре.
   Верхняя часть файла — чистые помощники без DOM, их проверяет inspect.test.js. */
(function(root){
'use strict';
const DRG=root.DRG||(typeof require!=='undefined'?require('./genetics.js'):null);

/* ---------- части тела, гены, генотип: без DOM ---------- */
const PART={head:'Голова',eyes:'Глаза',horns:'Рога',collar:'Воротник',crest:'Гребень',body:'Тело',skin:'Чешуя и узор',
  metal:'Блеск чешуи',wings:'Крылья',legs:'Лапы',spurs:'Шпоры',tailEnd:'Кончик хвоста',mace:'Булава',breath:'Дыхание',aura:'Сияние'};
const PART_ORDER=Object.keys(PART);
const ELN={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const ELW={F:'огонь',W:'вода',T:'земля',A:'воздух',P:'флора',L:'свет',D:'тьма',e:'без стихии'};
const AL={Cb:'cᵇ',R1:'R¹',R2:'R²',Wg:'Wgˢ','-':'−'};
const al=a=>AL[a]||a;
const num=v=>String(Math.round(v*10)/10).replace('.',',');

/* какие части тела есть у этого дракона: по слоям рисунка (поле of или part), тень не часть тела */
function partsHere(G){const s=new Set();G.layers.forEach(l=>{const k=l.of||l.part;if(PART[k])s.add(k)});return PART_ORDER.filter(k=>s.has(k))}

/* аллели локуса у этого генотипа: где лежит ген и сколько у него копий */
function allelesOf(g,l){
  for(const c of Object.keys(DRG.CHROMS)){const i=DRG.CHROMS[c].loci.indexOf(l);if(i>=0)return {kind:'auto',chr:c,al:[g[c][0][i],g[c][1][i]]}}
  const zi=DRG.Z.loci.indexOf(l);
  if(zi>=0)return g.sex==='M'?{kind:'zz',chr:'Z',al:[g.Z[0][zi],g.Z[1][zi]]}:{kind:'zw',chr:'Z',al:[g.Z[0][zi]]};
  if(l==='Sp')return g.sex==='F'?{kind:'w',chr:'W',al:[g.W]}:{kind:'none',chr:'W',al:[]};
  if(l==='G')return {kind:'mt',chr:'mt',al:[g.mt]};
  return {kind:'none',chr:null,al:[]}}
function allelesText(g,l){
  const a=allelesOf(g,l);
  if(a.kind==='auto'||a.kind==='zz')return a.al.map(al).join('/');
  if(a.kind==='zw')return al(a.al[0])+' (одна Z)';
  if(a.kind==='w')return al(a.al[0])+' (на W)';
  if(a.kind==='mt')return al(a.al[0])+' (митохондрии)';
  return 'нет: у самца нет W'}

/* как ген проявился: читаем готовый фенотип (DRG.phenotype), правила доминирования здесь не повторяются */
const SPAN=ph=>`размах ${num(ph.spanM)} м, «+» ${ph.span} из 6`;
const SHOW={
  E:ph=>ph.breath==='dormant'?'не проявляется: ss гасит стихию':ph.elements.length?ph.elements.map(e=>ELN[e]).join(' и '):'стихии нет, дымный',
  S:ph=>ph.breath==='dormant'?'искры нет, дремлющий':'искра есть',
  C:ph=>({dark:'тёмный',bronze:'бронзовый',pale:'бледный'})[ph.color],
  H:ph=>ph.horns?'рога есть':'рогов нет',K:ph=>ph.mace?'булава есть':'булавы нет',
  R:ph=>({big:'большой гребень',mid:'средний гребень',none:'гребня нет'})[ph.crest],
  Wg:ph=>ph.shortWings?'короткие крылья':'обычные крылья',Q1:SPAN,Q2:SPAN,Q3:SPAN,
  M:ph=>ph.metal?'блеск есть':'блеска нет',N:ph=>ph.night?'ночное зрение':'обычное зрение',
  Sp:ph=>ph.spurs?'шпоры есть':ph.sex==='M'?'у самцов шпор не бывает':'шпор нет',
  G:ph=>ph.glow?'глаза светятся':'глаза не светятся'};

/* генотип по хромосомам: гомологи как есть (какой из них от матери, в сохранении не записано), сцепление из CHROMS */
function genoModel(g){
  const ph=DRG.phenotype(g),blocks=[];
  const links=(loci,r)=>r.map((x,i)=>x<0.5?{a:loci[i],b:loci[i+1],r:x}:null).filter(Boolean);
  Object.keys(DRG.CHROMS).forEach((c,ci)=>{const C=DRG.CHROMS[c];
    blocks.push({id:c,title:'Аутосома '+(ci+1),loci:C.loci,rows:[['1-я',g[c][0]],['2-я',g[c][1]]],links:links(C.loci,C.r),show:C.loci.map(l=>SHOW[l](ph))})});
  const Zl=DRG.Z.loci;
  if(g.sex==='M')blocks.push({id:'Z',title:'Половые хромосомы: самец ZZ',loci:Zl,rows:[['Z',g.Z[0]],['Z',g.Z[1]]],links:links(Zl,DRG.Z.r),show:Zl.map(l=>SHOW[l](ph)),
    note:'Гена шпор Sp у самца нет: он лежит на W.'});
  else blocks.push({id:'Z',title:'Половые хромосомы: самка ZW',loci:Zl,rows:[['Z',g.Z[0]]],links:[],show:Zl.map(l=>SHOW[l](ph)),
    note:'Z одна, поэтому по M и N самка гемизиготна: проявляется единственный аллель.',
    w:{loci:['Sp'],rows:[['W',[g.W]]],show:[SHOW.Sp(ph)]}});
  blocks.push({id:'mt',title:'Митохондрии',mt:g.mt,show:[SHOW.G(ph)],note:'Одна копия, не пара: митохондрии достаются только от матери.'});
  return {ph,blocks}}

/* что в части тела от генов (есть ли, форма, окраска), что от возраста и что только оформление; карта MORPH.SRC */
function partInfo(M,g,part){
  const s=M.src[part],out={part,name:PART[part]||part,rows:[],age:M.age[part]||null,cosm:M.cosm[part]||null};
  if(s)[['has','Есть или нет'],['shape','Форма и размер'],['color','Окраска']].forEach(([c,t])=>out.rows.push({c,title:t,
    loci:s[c].map(l=>({l,al:allelesText(g,l),why:(s.why&&s.why[c]&&s.why[c][l])||DRG.LOCI[l].name.toLowerCase()}))}));
  return out}

/* часть рига под точкой → часть тела. Голова, туловище, хвост и шея уточняются по слоям рисунка в точке (layerAt) */
const RIGMAP={wingFar:'wings',wingNear:'wings',tailCr:'crest',trunkCr:'crest',neckCr:'crest',lid:'eyes',breath:'breath',aura:'aura',ground:null};
function bodyPartOf(rp,M,layerAt){
  if(rp in RIGMAP)return RIGMAP[rp];
  if(rp==='tailTip')return M.mace?'mace':'tailEnd';
  if(/^[FN][HF]s$/.test(rp))return 'spurs';
  if(/^[FN][HF][uf]$/.test(rp))return 'legs';
  const k=layerAt?layerAt():null;
  if(k&&PART[k]&&k!=='wings')return k;
  return rp==='head'||rp==='headBack'?'head':'body'}

const seedOf=id=>{let h=7;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return h%9973};
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

const PURE={PART,PART_ORDER,partsHere,allelesOf,allelesText,genoModel,partInfo,bodyPartOf,SHOW};
if(typeof document==='undefined'){if(typeof module!=='undefined'&&module.exports)module.exports=PURE;return}

/* ---------- подгрузка модулей рисунка ---------- */
const SRC_URL=(()=>{try{const u=new URL(document.currentScript.src);return {dir:u.origin+u.pathname.replace(/[^/]*$/,''),q:u.search}}catch(e){return {dir:'dragons/',q:''}}})();
const NEED=[['MORPH','morph'],['SHAPE','shape'],['ART','art'],['DRTEX','texcache'],['SPR','sprites'],['ANIM','anim'],['RIG','rig'],['DSTATS','stats']];
let loading=null;
function loadAll(){
  if(loading)return loading;
  loading=NEED.reduce((p,[g,f])=>p.then(()=>root[g]?null:new Promise((res,rej)=>{const s=document.createElement('script');
    s.src=SRC_URL.dir+f+'.js'+SRC_URL.q;s.onload=res;s.onerror=()=>rej(new Error('не загрузился '+f+'.js'));document.head.appendChild(s)})),Promise.resolve());
  loading.catch(()=>{loading=null});
  return loading}

/* ---------- сцена ---------- */
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PADY=14;            /* под ногами: островок-подставка, в единицах рисунка */
const ZMAX=4,HI_AT=1.5,HI_OFF=1.25,CAP=4.4;   /* крупная текстура с 1,5×, обратно ниже 1,25×; px·dpr не больше 4,4 */
let V=null;

function open(info,api,fromEl){
  if(V&&!V.closing){show(V,info,'switch');return}
  if(V)finish(V);
  const r=fromEl&&fromEl.getBoundingClientRect?fromEl.getBoundingClientRect():null;
  const v=V={info,api,tok:0,mtok:0,dead:false,closing:false,sel:null,sub:null,mask:null,X:null,Xhi:null,hiLoad:false,A:null,
    from:r&&r.width>4&&r.height>4?{x:r.left,y:r.top,w:r.width,h:r.height}:null,fromTag:fromEl?fromEl.tagName.toLowerCase():null,
    focusBack:fromEl&&fromEl.focus&&fromEl.tagName==='BUTTON'?fromEl:null,hidden:null,
    cam:null,camT:{cx:0,cy:0,z:1},fly:null,perf:{draw:[],hit:0,mask:0,prep:0},ptrs:new Map(),last:performance.now(),hint:true,pend:null};
  build(v);
  document.body.classList.add('dri-open');
  v.root.classList.add('dim');
  v.raf=requestAnimationFrame(frame);
  loadAll().then(()=>show(v,info,'first')).catch(e=>failed(v,e));
  return v}

function failed(v,e){if(v.dead)return;console.error(e);v.root.classList.add('on','in');
  v.$('.dri-load').innerHTML='Не получилось показать дракона. <button class="btn sm" data-dk="close">Вернуться</button>'}

/* показать дракона: first — открытие сцены, switch — другой дракон из родословной,
   keep — тот же дракон заново (вырос до новой стадии или сильно изменилось окно): выбор части и вкладка остаются */
async function show(v,info,mode){
  const tok=++v.tok;v.info=info;
  const ph=DRG.phenotype(info.genome),M=root.MORPH.morph(ph,info.lvl),G=root.SHAPE.build(M),P=root.ANIM.profile(M,G.rig);
  const t0=performance.now();
  v.next={ph,M,G,P};
  layout(v,G);
  const px=pxFor(v,G,1);
  let X;try{X=await root.RIG.get(ph,info.lvl,{px,dpr:v.dpr})}catch(e){if(tok===v.tok)failed(v,e);return}
  if(tok!==v.tok||v.dead){root.RIG.release(X);return}
  v.perf.prep=performance.now()-t0;
  dropTextures(v);
  Object.assign(v,{ph,M,G,P,X,Xpx:px,defs:root.RIG.partsOf(G.rig,P),parts:partsHere(G),stats:root.DSTATS.of(ph,info.lvl,P)});
  v.A=new root.ANIM.Animator(M,X.R,{seed:seedOf(info.id),reduce:reduced()});
  const home={cx:G.box.x+G.box.w/2,cy:(G.box.y+PADY)/2,z:1};
  v.home=home;v.camT=Object.assign({},home);
  const to={ax:v.sx,ay:v.sy,cx:home.cx,cy:home.cy,Z:v.baseZ};
  if(mode==='first'){
    hideOrigin(v);
    if(v.from&&!reduced())v.fly={t0:performance.now(),dur:520,from:camOfRect(v,v.from),to};
    v.cam=Object.assign({},v.fly?v.fly.from:to);
    v.root.classList.remove('dim');v.root.classList.add('on');
    requestAnimationFrame(()=>{if(!v.dead)v.root.classList.add('in')});
    v.$('.dri-load').hidden=true}
  else{v.cam=Object.assign({},to);
    if(mode==='switch'){v.sel=null;v.sub=null;v.pend=null;if(v.hidden){v.hidden.style.visibility='';v.hidden=null}}}
  v.root.setAttribute('aria-label','Осмотр: '+info.name);
  v.stage.setAttribute('aria-label',`${info.name} крупно. Стрелки двигают вид, плюс и минус приближают, Enter гладит дракона`);
  renderPanel(v);
  if(mode==='keep'&&v.sel){const s=v.sel;if(v.parts.includes(s))select(v,s,false);else select(v,null,false)}}

/* ---------- раскладка: сцена слева и панель справа или сцена сверху и лист снизу ---------- */
function layout(v,G){
  G=G||v.G;const W=v.root.clientWidth||innerWidth,H=v.root.clientHeight||innerHeight,dpr=Math.min(2,devicePixelRatio||1);
  const side=W>=640&&W/H>1.25,pw=side?Math.round(clamp(W*0.36,300,400)):0;
  const sheet=side?0:Math.round(clamp(H*0.48,230,Math.max(230,H-240)));
  const sw=W-pw,sh=H-sheet,top=56,bot=side?36:20;
  v.dpr=dpr;v.W=W;v.H=H;v.side=side;
  v.root.classList.toggle('side',side);v.root.classList.toggle('sheet',!side);
  const st=v.root.style;st.setProperty('--stw',sw+'px');st.setProperty('--sth',sh+'px');st.setProperty('--pw',pw+'px');st.setProperty('--sh',sheet+'px');
  st.setProperty('--sx',(sw/2)+'px');st.setProperty('--sy',(top+(sh-top-bot)*0.55)+'px');
  if(v.cv.width!==Math.round(W*dpr)||v.cv.height!==Math.round(H*dpr)){v.cv.width=Math.round(W*dpr);v.cv.height=Math.round(H*dpr);v.hl.width=v.cv.width;v.hl.height=v.cv.height}
  v.sx=sw/2*dpr;v.sy=(top+(sh-top-bot)/2)*dpr;
  if(G){const bh=PADY-G.box.y;v.baseZ=Math.min((sw-24)*dpr*0.9/G.box.w,(sh-top-bot)*dpr*0.92/bh)}}
const pxFor=(v,G,k)=>Math.max(0.3,Math.round(Math.min(v.baseZ*k/(G.scale*v.dpr),CAP/v.dpr)*20)/20);
function camOfRect(v,r){const G=v.next?v.next.G:v.G,d=v.dpr;
  return {ax:(r.x+r.w/2)*d,ay:(r.y+r.h/2)*d,cx:G.box.x+G.box.w/2,cy:(G.box.y+PADY)/2,Z:Math.max(0.05,Math.min(r.w*d/G.box.w,r.h*d/(PADY-G.box.y)))}}
function clampCam(v,c){const b=v.G.box;c.z=clamp(c.z,1,ZMAX);c.cx=clamp(c.cx,b.x,b.x+b.w);c.cy=clamp(c.cy,b.y,PADY);return c}
const viewOf=c=>[c.Z,0,0,c.Z,c.ax-c.Z*c.cx,c.ay-c.Z*c.cy];

/* ---------- кадр ---------- */
function frame(now){
  const v=V;if(!v||v.dead)return;
  v.raf=document.hidden?0:requestAnimationFrame(frame);
  const dt=Math.min(0.1,(now-v.last)/1000);v.last=now;
  if(v.A){const ev=v.A.update(dt);if(ev.length)onEvents(v,ev)}
  stepCam(v,dt,now);
  if(v.A&&v.X&&v.cam)draw(v,now);
  if(v.closing&&now>=v.closeAt)finish(v)}
function stepCam(v,dt,now){
  if(!v.cam)return;
  if(v.fly){const f=v.fly,p=ease(clamp((now-f.t0)/f.dur,0,1)),a=f.from,b=f.to;
    v.cam={ax:a.ax+(b.ax-a.ax)*p,ay:a.ay+(b.ay-a.ay)*p,cx:a.cx+(b.cx-a.cx)*p,cy:a.cy+(b.cy-a.cy)*p,Z:Math.exp(Math.log(a.Z)+(Math.log(b.Z)-Math.log(a.Z))*p)};
    if(p>=1)v.fly=null;return}
  if(v.closing)return;
  const t=v.camT,k=v.snap||reduced()?1:1-Math.exp(-dt*11),c=v.cam;v.snap=false;
  c.ax+=(v.sx-c.ax)*k;c.ay+=(v.sy-c.ay)*k;c.cx+=(t.cx-c.cx)*k;c.cy+=(t.cy-c.cy)*k;
  c.Z=Math.exp(Math.log(c.Z)+(Math.log(v.baseZ*t.z)-Math.log(c.Z))*k);
  /* крупная текстура, когда приблизили, и обратно, когда отдалили */
  const z=c.Z/v.baseZ;
  if(z>=HI_AT&&!v.Xhi&&!v.hiLoad)loadHi(v);
  else if(z<HI_OFF&&v.Xhi){const X=v.Xhi;v.Xhi=null;root.RIG.release(X);root.DRTEX.shared.drop(X.key)}}
async function loadHi(v){
  const px=pxFor(v,v.G,2);if(px<=v.Xpx*1.2)return;
  v.hiLoad=true;const tok=v.tok;
  try{const X=await root.RIG.get(v.ph,v.info.lvl,{px,dpr:v.dpr});
    if(tok!==v.tok||v.dead||v.cam.Z/v.baseZ<HI_OFF){root.RIG.release(X);root.DRTEX.shared.drop(X.key)}else v.Xhi=X}
  catch(e){}finally{v.hiLoad=false}}

function draw(v,now){
  const c=v.ctx,W=v.cv.width,H=v.cv.height,view=viewOf(v.cam),t0=performance.now();v.view=view;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
  pedestal(v,c,view);
  const pose=v.A.pose;
  root.RIG.draw(c,v.Xhi||v.X,pose,view);
  if(v.sel&&v.mask){const h=v.hctx;h.setTransform(1,0,0,1,0,0);h.clearRect(0,0,W,H);
    root.RIG.draw(h,v.mask,Object.assign({},pose,{food:null}),view);
    h.setTransform(1,0,0,1,0,0);h.globalCompositeOperation='source-in';h.fillStyle=v.col.hl;h.fillRect(0,0,W,H);h.globalCompositeOperation='source-over';
    c.globalAlpha=reduced()?0.42:0.3+0.16*(0.5+0.5*Math.sin((now-v.selT)/1000*4));c.drawImage(v.hl,0,0);c.globalAlpha=1}
  root.RIG.drawFx(c,v.X,v.A.fx,view,v.col.ink);
  const d=performance.now()-t0,P=v.perf.draw;P.push(d);if(P.length>120)P.shift()}
/* островок под ногами: трава сверху, скала снизу, в цветах острова */
function pedestal(v,c,view){
  const b=v.G.box,cx=b.x+b.w/2,rx=b.w*0.47,ry=Math.max(7,rx*0.12);
  c.setTransform(view[0],0,0,view[3],view[4],view[5]);
  c.fillStyle=v.col.rock2;c.beginPath();c.ellipse(cx,ry*0.9,rx*0.9,ry*1.7,0,0,Math.PI);c.fill();
  c.fillStyle=v.col.rock;c.beginPath();c.ellipse(cx,ry*0.5,rx*0.97,ry*1.15,0,0,Math.PI);c.fill();
  const g=c.createLinearGradient(0,-ry,0,ry);g.addColorStop(0,v.col.grass);g.addColorStop(1,v.col.grass2);
  c.fillStyle=g;c.beginPath();c.ellipse(cx,2,rx,ry,0,0,Math.PI*2);c.fill();
  c.setTransform(1,0,0,1,0,0)}

function readColors(v){
  const cs=getComputedStyle(v.root),g=k=>cs.getPropertyValue(k).trim();
  v.col={grass:g('--isl-grass')||'#93D45E',grass2:g('--isl-grass2')||'#5EA83A',rock:'#B79E72',rock2:'#8E7752',ink:g('--muted')||'#58695F',hl:'#FFF6C2'}}

/* ---------- события анимации ---------- */
function onEvents(v,ev){
  ev.forEach(e=>{if(e.type!=='end')return;
    if(e.state==='eat'&&v.pend){const p=v.pend;v.pend=null;
      if(p.rebuild)show(v,v.info,'keep').then(()=>{if(v.A&&!v.dead)v.A.play('happy')})
      else if(p.happy)v.A.play('happy')}})}

/* ---------- попадание по части тела ----------
   Каждая часть рига рисуется в свой пиксель строки N×1 (перенос так, чтобы точка нажатия попала в пиксель i),
   побеждает верхняя непрозрачная. Внутри головы и туловища точку уточняют слои рисунка в покое. */
function hitTest(v,px,py){
  const t0=performance.now(),X=v.Xhi||v.X,N=X.order.length;
  if(!v.hit||v.hit.width<N){v.hit=document.createElement('canvas');v.hit.width=N;v.hit.height=1;v.hitc=v.hit.getContext('2d',{willReadFrequently:true})}
  const c=v.hitc,view=v.view,pose=Object.assign({},v.A.pose,{food:null}),ix=Math.floor(px),iy=Math.floor(py);
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,v.hit.width,1);
  X.order.forEach((p,i)=>{c.save();c.beginPath();c.rect(i,0,1,1);c.clip();
    root.RIG.draw(c,Object.assign({},X,{order:[p]}),pose,[view[0],view[1],view[2],view[3],view[4]+i-ix,view[5]-iy]);c.restore()});
  const d=c.getImageData(0,0,N,1).data;let out=null;
  for(let i=N-1;i>=0;i--)if(d[i*4+3]>90){const rp=X.order[i].name;out=bodyPartOf(rp,v.M,()=>layerAt(v,rp,px,py));break}
  v.perf.hit=performance.now()-t0;
  return out}
const paths=new Map();
function inPath(d,w){let p=paths.get(d);if(!p){if(paths.size>400)paths.clear();p=new Path2D(d);paths.set(d,p)}
  const c=inPath.c||(inPath.c=document.createElement('canvas').getContext('2d'));return c.isPointInPath(p,w[0],w[1])}
function layerAt(v,rp,px,py){
  const MAT=root.ANIM.MAT,m=v.A.pose.mat[rp];if(!m)return null;
  const w=MAT.app(MAT.inv(MAT.mul(v.view,m)),[px,py]),R=v.G.rig;
  if(rp==='head'&&Math.hypot(w[0]-R.eye[0],w[1]-R.eye[1])<R.eyeR*1.35)return 'eyes';
  const def=v.defs.find(d=>d.name===rp);if(!def)return null;
  const L=v.G.layers.filter(l=>!l.rig&&!l.line&&!l.blur&&!l.fx&&!(l.op!=null&&l.op<0.6)&&def.only(l));
  for(let i=L.length-1;i>=0;i--)if(inPath(L[i].d,w))return L[i].of||L[i].part;
  return null}

/* ---------- выбор части: маска той же позы для подсветки, камера к части ---------- */
async function select(v,part,zoom){
  v.sel=part;v.selT=performance.now();
  if(part&&v.hint){v.hint=false;v.root.classList.add('nohint')}
  renderPart(v);renderChips(v);
  const tok=++v.mtok;
  if(!part){dropMask(v);if(zoom)camHome(v);return}
  const t0=performance.now();
  let X;try{X=await root.RIG.get(v.ph,v.info.lvl,{px:v.Xpx,dpr:v.dpr,part})}catch(e){return}
  if(tok!==v.mtok||v.dead||v.sel!==part){root.RIG.release(X);return}
  dropMask(v);v.mask=X;v.perf.mask=performance.now()-t0;
  if(zoom)camTo(v,X)}
function dropMask(v){if(v.mask){root.RIG.release(v.mask);v.mask=null}}
/* рамка части в мире по текущей позе (изгиб хвоста не учитывается, для камеры этого хватает) */
function boxOf(v,X){
  const MAT=root.ANIM.MAT,pose=v.A.pose;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  X.order.forEach(p=>{const m0=pose.mat[p.m||p.name];if(!m0)return;const m=MAT.mul(m0,p.Fi);
    [[0,0],[p.w,0],[0,p.h],[p.w,p.h]].forEach(q=>{const w=MAT.app(m,q);x0=Math.min(x0,w[0]);y0=Math.min(y0,w[1]);x1=Math.max(x1,w[0]);y1=Math.max(y1,w[1])})});
  return x1>x0?{x:x0,y:y0,w:x1-x0,h:y1-y0}:null}
function camTo(v,X){
  const b=boxOf(v,X);if(!b)return;
  const sw=v.sx*2,sh=(v.sy/v.dpr-56)*2*v.dpr;
  const z=clamp(Math.min(sw*0.5/(Math.max(b.w,8)*v.baseZ),sh*0.5/(Math.max(b.h,8)*v.baseZ)),1.15,3.2);
  v.camT=clampCam(v,{cx:b.x+b.w/2,cy:b.y+b.h/2,z})}
function camHome(v){v.camT=Object.assign({},v.home)}
function zoomAt(v,px,py,f,snap){
  const c=v.camT,Z=v.baseZ*c.z,wx=c.cx+(px-v.sx)/Z,wy=c.cy+(py-v.sy)/Z,nz=clamp(c.z*f,1,ZMAX),Z2=v.baseZ*nz;
  v.camT=clampCam(v,{cx:wx-(px-v.sx)/Z2,cy:wy-(py-v.sy)/Z2,z:nz});if(snap)v.snap=true}
function pan(v,dx,dy,snap){const c=v.camT,Z=v.baseZ*c.z;v.camT=clampCam(v,{cx:c.cx-dx*v.dpr/Z,cy:c.cy-dy*v.dpr/Z,z:c.z});if(snap)v.snap=true}

/* ---------- реакции ---------- */
function say(v,t){const e=v.$('.dri-say');if(e)e.textContent=t}
function react(v,part){
  const A=v.A;if(!A)return;const s=A.state();
  if(part==='eyes'){if(!A.P.sleepy){A.blinkT=0;say(v,v.info.name+' моргает')}return}
  if(part==='breath'){if(s==='idle'){A.play('attack');say(v,'Так выглядит дыхание: '+breathWord(v))}return}
  if(s==='idle'){A.play('happy');say(v,v.info.name+' радуется')}}
const breathWord=v=>v.M.breath==='smoke'?'дым':v.M.breath==='dormant'?'дремлющий не дышит стихией':v.M.elements.map(e=>ELW[e]).join(' и ');
function tap(v,x,y){
  if(!v.A||v.fly)return;
  const part=hitTest(v,x*v.dpr,y*v.dpr);
  if(!part){if(v.sel)select(v,null,true);return}
  react(v,part);
  if(part!==v.sel)select(v,part,true)}
function feed(v){
  const inf=v.info;if(!inf.own||!inf.feed||!inf.feed.can)return;
  const r=v.api.feed(inf.id);if(!r)return;
  const now=v.api.info(inf.id);if(!now){say(v,'Этого дракона больше нет на острове');return}
  v.info=now;v.A.play('eat');v.stats=root.DSTATS.of(v.ph,now.lvl,v.P);
  if(r.lvup){v.pend={happy:true,rebuild:root.MORPH.stageOf(now.lvl)!==root.MORPH.stageOf(inf.lvl)};say(v,`${now.name} вырос до ${now.lvl}-го уровня!`)}
  else{v.pend=null;const n=now.feeds-now.fed;say(v,`Съел корм: −${inf.feed.cost} 🌾. До ${now.lvl+1}-го уровня ещё ${n} ${plural(n,'кормление','кормления','кормлений')}`)}
  renderHead(v);renderMain(v)}

/* ---------- закрытие ---------- */
function back(v){if(v.sub){setSub(v,null);return}if(v.sel){select(v,null,true);return}close(v)}
function originEl(v){
  if(!v.info)return null;const q=`[data-act="drginsp"][data-dragon="${CSS.escape(v.info.id)}"]`;
  const els=[...document.querySelectorAll((v.fromTag||'')+q)].concat([...document.querySelectorAll(q)]);
  return els.find(e=>{const r=e.getBoundingClientRect();return r.width>4&&r.height>4&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth})||null}
function hideOrigin(v){const e=originEl(v);if(e){e.style.visibility='hidden';v.hidden=e}}
function close(v){
  if(v.closing||v.dead)return;v.closing=true;
  const e=originEl(v),r=e&&e.getBoundingClientRect(),fly=!!(r&&v.cam&&v.G&&!reduced());
  if(v.hidden&&v.hidden!==e)v.hidden.style.visibility='';
  if(e){e.style.visibility='hidden';v.hidden=e}
  v.root.classList.remove('in','on','dim');v.root.classList.add('out');
  const dur=fly?400:160;
  if(fly){v.next=null;v.fly={t0:performance.now(),dur,from:Object.assign({},v.cam),to:camOfRect(v,{x:r.left,y:r.top,w:r.width,h:r.height})}}
  v.closeAt=performance.now()+dur;
  setTimeout(()=>finish(v),dur+250)}   /* если вкладка в фоне и кадры стоят */
function finish(v){
  if(v.dead)return;v.dead=true;if(V===v)V=null;
  if(v.raf)cancelAnimationFrame(v.raf);
  removeEventListener('keydown',v.onKey,true);removeEventListener('resize',v.onResize);document.removeEventListener('visibilitychange',v.onVis);
  if(v.mo)v.mo.disconnect();
  dropTextures(v);
  if(v.hl){v.hl.width=v.hl.height=0}if(v.cv){v.cv.width=v.cv.height=0}if(v.hit){v.hit.width=v.hit.height=0}
  v.root.remove();document.body.classList.remove('dri-open');
  if(v.hidden)v.hidden.style.visibility='';
  const e=originEl(v);if(e)e.style.visibility='';
  if(v.focusBack&&v.focusBack.isConnected)v.focusBack.focus({preventScroll:true});
  else{const b=e&&e.tagName==='BUTTON'?e:null;if(b)b.focus({preventScroll:true})}}
function dropTextures(v){
  dropMask(v);
  if(v.Xhi){const X=v.Xhi;v.Xhi=null;root.RIG.release(X);root.DRTEX.shared.drop(X.key)}
  if(v.X){root.RIG.release(v.X);v.X=null}}

/* ---------- DOM ---------- */
function build(v){
  const el=document.createElement('div');el.className='dri';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Осмотр дракона');
  el.innerHTML=`<div class="dri-bg"></div><canvas class="dri-cv" aria-hidden="true"></canvas>
  <div class="dri-stage" tabindex="0" role="img" aria-label="Дракон крупно"></div>
  <div class="dri-top"><button class="dri-x" data-dk="close">← К острову</button>
    <div class="dri-zm" role="group" aria-label="Масштаб"><button data-dk="zin" aria-label="Приблизить">+</button><button data-dk="zout" aria-label="Отдалить">−</button><button data-dk="zfit" aria-label="Весь дракон">⤢</button></div></div>
  <p class="dri-hint" aria-hidden="true">Нажмите на часть тела, чтобы рассмотреть её</p>
  <p class="dri-load">Готовлю дракона…</p>
  <section class="dri-pan" aria-labelledby="dri-t"><div class="dri-head"></div><div class="dri-body"></div></section>`;
  document.body.appendChild(el);
  v.root=el;v.$=s=>el.querySelector(s);v.cv=v.$('.dri-cv');v.ctx=v.cv.getContext('2d');v.stage=v.$('.dri-stage');
  v.hl=document.createElement('canvas');v.hctx=v.hl.getContext('2d');
  readColors(v);layout(v,null);
  el.addEventListener('click',e=>onClick(v,e));
  const st=v.stage;
  st.addEventListener('pointerdown',e=>{if(v.closing)return;try{st.setPointerCapture(e.pointerId)}catch(x){}
    v.ptrs.set(e.pointerId,[e.clientX,e.clientY]);if(v.ptrs.size===1){v.moved=0;v.pinched=false}
    if(v.ptrs.size===2){const [a,b]=[...v.ptrs.values()];v.pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);v.pinched=true}});
  st.addEventListener('pointermove',e=>{const p=v.ptrs.get(e.pointerId);if(!p||!v.G)return;
    const dx=e.clientX-p[0],dy=e.clientY-p[1];v.ptrs.set(e.pointerId,[e.clientX,e.clientY]);
    if(v.ptrs.size===1){v.moved+=Math.abs(dx)+Math.abs(dy);if(v.moved>6&&!v.pinched){pan(v,dx,dy,true);st.classList.add('drag')}}
    else if(v.ptrs.size===2&&v.pinch){const [a,b]=[...v.ptrs.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),r=v.root.getBoundingClientRect();
      zoomAt(v,((a[0]+b[0])/2-r.left)*v.dpr,((a[1]+b[1])/2-r.top)*v.dpr,d/v.pinch,true);v.pinch=d}});
  const up=e=>{if(!v.ptrs.has(e.pointerId))return;v.ptrs.delete(e.pointerId);st.classList.remove('drag');
    if(e.type==='pointerup'&&!v.ptrs.size&&v.moved<=6&&!v.pinched){const r=v.root.getBoundingClientRect();tap(v,e.clientX-r.left,e.clientY-r.top)}
    if(v.ptrs.size<2)v.pinch=null};
  st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
  st.addEventListener('wheel',e=>{e.preventDefault();if(!v.G)return;const r=v.root.getBoundingClientRect();zoomAt(v,(e.clientX-r.left)*v.dpr,(e.clientY-r.top)*v.dpr,Math.exp(-e.deltaY*0.0018),true)},{passive:false});
  v.onKey=e=>onKey(v,e);addEventListener('keydown',v.onKey,true);
  let rs=0;v.onResize=()=>{clearTimeout(rs);rs=setTimeout(()=>resized(v),120)};addEventListener('resize',v.onResize);
  v.onVis=()=>{if(!document.hidden&&!v.raf&&!v.dead){v.last=performance.now();v.raf=requestAnimationFrame(frame)}};document.addEventListener('visibilitychange',v.onVis);
  v.mo=new MutationObserver(()=>readColors(v));v.mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class']});
  v.$('.dri-x').focus({preventScroll:true})}
function resized(v){
  if(v.dead)return;const z0=v.baseZ;layout(v);if(!v.G||!v.cam)return;
  v.cam.Z*=v.baseZ/z0;v.cam.ax=v.sx;v.cam.ay=v.sy;
  if(Math.abs(pxFor(v,v.G,1)-v.Xpx)/v.Xpx>0.2)show(v,v.info,'keep');   /* сильно изменился размер: новая текстура */
}

function onClick(v,e){
  const b=e.target.closest('[data-dk]');if(!b||b.disabled||v.closing)return;
  const k=b.dataset.dk;
  if(k==='close')close(v);
  else if(k==='zin'||k==='zout'){if(v.G)zoomAt(v,v.sx,v.sy,k==='zin'?1.35:1/1.35)}
  else if(k==='zfit'){if(v.G){if(v.sel)select(v,null,false);camHome(v)}}
  else if(!v.A)return;
  else if(k==='geno')setSub(v,'geno');
  else if(k==='ped')setSub(v,'ped');
  else if(k==='main')setSub(v,null);
  else if(k==='feed')feed(v);
  else if(k==='fight'){v.A.play('attack');say(v,'Пробный удар. Бои 3 на 3 появятся позже, пока это только движение')}
  else if(k==='part'){const p=b.dataset.p;if(p===v.sel)select(v,null,true);else{select(v,p,true);if(p==='breath'||p==='eyes')react(v,p)}}
  else if(k==='unsel')select(v,null,true);
  else if(k==='goto'){const inf=v.api.info(b.dataset.id);if(inf)show(v,inf,'switch').then(()=>{if(!v.dead)v.$('.dri-x').focus({preventScroll:true})})}}

function onKey(v,e){
  if(v.dead||document.querySelector('dialog[open]'))return;
  e.stopPropagation();   /* сочетания страницы (поиск, Esc острова) не срабатывают под сценой */
  const k=e.key,onStage=document.activeElement===v.stage;
  if(k==='Escape'){e.preventDefault();if(!v.closing)back(v);return}
  if(k==='Tab'){trap(v,e);return}
  if(e.ctrlKey||e.metaKey||e.altKey||!v.G||v.closing)return;
  if(k==='+'||k==='='){e.preventDefault();zoomAt(v,v.sx,v.sy,1.3)}
  else if(k==='-'||k==='_'){e.preventDefault();zoomAt(v,v.sx,v.sy,1/1.3)}
  else if(k==='0'){e.preventDefault();if(v.sel)select(v,null,false);camHome(v)}
  else if(onStage&&k.startsWith('Arrow')){e.preventDefault();const s=48;pan(v,k==='ArrowLeft'?s:k==='ArrowRight'?-s:0,k==='ArrowUp'?s:k==='ArrowDown'?-s:0)}
  else if(onStage&&(k==='Enter'||k===' ')){e.preventDefault();react(v,'body')}}
function trap(v,e){
  const f=[...v.root.querySelectorAll('button:not([disabled]),[tabindex="0"],summary')].filter(x=>x.getClientRects().length&&!x.closest('[hidden]'));
  if(!f.length)return;const i=f.indexOf(document.activeElement);
  if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus()}
  else if(!e.shiftKey&&(i===-1||i===f.length-1)){e.preventDefault();f[0].focus()}}

/* ---------- панель ---------- */
/* сохранить фокус при перерисовке куска панели: кнопка с тем же data-dk (и data-p) снова получает фокус */
function setHTML(el,html){
  const a=document.activeElement,k=a&&el.contains(a)&&a.dataset?[a.dataset.dk,a.dataset.p||'',a.dataset.id||'']:null;
  el.innerHTML=html;
  if(k){const b=[...el.querySelectorAll('[data-dk]')].find(x=>x.dataset.dk===k[0]&&(x.dataset.p||'')===k[1]&&(x.dataset.id||'')===k[2]);if(b)b.focus({preventScroll:true})}}
function renderPanel(v){renderHead(v);if(v.sub)renderSub(v);else renderMain(v)}
function elText(v){return v.M.breath==='dormant'?'дремлющий, стихия не проявляется':v.M.breath==='smoke'?'дымный, без стихии':v.M.elements.map(e=>ELN[e]).join(' и ')}
function renderHead(v){
  const i=v.info,M=v.M,rr=DRG.rarity(v.ph),f=i.feed;
  const fd=i.own&&f?`<button class="btn sm" data-dk="feed"${f.can?'':' disabled'}>Покормить · ${f.cost} 🌾</button>`:'';
  setHTML(v.$('.dri-head'),`<div class="dri-hd"><h2 id="dri-t">${esc(i.name)}</h2><span class="dri-sex" title="${i.genome.sex==='F'?'самка, ZW':'самец, ZZ'}">${i.genome.sex==='F'?'♀':'♂'}<span class="sr"> ${i.genome.sex==='F'?'самка':'самец'}</span></span><span class="dri-rar r${rr}">${esc(DRG.RARITY[rr])}</span></div>
  <p class="dri-sub">${i.lvl}-й уровень · ${esc(M.stageName)} · ${esc(elText(v))}</p>
  <button class="dri-geno" data-dk="geno" aria-pressed="${v.sub==='geno'}"><span aria-hidden="true">🧬</span> Посмотреть генотип</button>
  <div class="dri-acts${fd?'':' two'}">${fd}<button class="btn ghost sm" data-dk="ped" aria-pressed="${v.sub==='ped'}">Родословная</button><button class="btn ghost sm" data-dk="fight">В бой</button></div>
  ${i.own&&f&&!f.can&&f.why?`<p class="dri-why">${esc(f.why)}</p>`:''}<p class="dri-say" aria-live="polite"></p>`)}
function renderMain(v){
  if(v.sub)return;
  setHTML(v.$('.dri-body'),`<div class="dri-part"></div><div class="dri-chips"></div><div class="dri-stats"></div><div class="dri-facts"></div>`);
  renderPart(v);renderChips(v);renderStats(v);renderFacts(v)}
function renderChips(v){const e=v.$('.dri-chips');if(!e||!v.parts)return;
  setHTML(e,`<h3>Части тела</h3><div class="dri-cl" role="group" aria-label="Части тела">${v.parts.map(p=>`<button class="dri-chip" data-dk="part" data-p="${p}" aria-pressed="${v.sel===p}">${PART[p]}</button>`).join('')}</div>`)}
function renderPart(v){const e=v.$('.dri-part');if(!e)return;
  if(!v.sel){e.innerHTML='';return}
  const P=partInfo(v.M,v.info.genome,v.sel);
  const rows=P.cosm?'':P.rows.map(r=>`<dt>${r.title}</dt><dd>${r.loci.length?r.loci.map(x=>`<span class="dri-l"><b>${x.l}</b> ${esc(x.al)}<small>${esc(x.why)}</small></span>`).join(''):r.c==='has'?'есть у всех драконов':'не зависит от генов'}</dd>`).join('');
  setHTML(e,`<div class="dri-pc"><div class="dri-pch"><h3>${esc(P.name)}</h3><button class="dri-ux" data-dk="unsel" aria-label="Снять выделение">✕</button></div>
    ${rows?`<dl>${rows}</dl>`:''}
    ${P.age?`<p class="dri-age">Возраст меняет: ${esc(P.age)}. Это развитие, оно не наследуется.</p>`:''}
    ${P.cosm?`<p class="dri-age">Оформление: ${esc(P.cosm)}. Не наследуется.</p>`:''}</div>`)}
function renderStats(v){const e=v.$('.dri-stats');if(!e)return;const s=v.stats,N=root.DSTATS.NAMES;
  const ic={hp:'❤️',atk:'⚔️',def:'🛡️',spd:'💨'};
  setHTML(e,`<h3>Боевые характеристики</h3><div class="dri-st">${['hp','atk','def','spd'].map(k=>`<div><span aria-hidden="true">${ic[k]}</span><b>${s[k]}</b><small>${N[k]}</small></div>`).join('')}</div>
    <details class="dri-src" data-k="drisrc"><summary>Из чего складываются числа</summary>
    ${['hp','atk','def','spd'].map(k=>`<p><b>${N[k]} ${s[k]}</b> = ${s.src[k].map(([l,x])=>esc(l)+' '+x).join(' + ')}${k!=='spd'&&s.lvlK!==1?` × уровень ${num(s.lvlK)}`:''}</p>`).join('')}
    <p class="dri-note">${esc(s.note)}</p></details>`)}
function renderFacts(v){const e=v.$('.dri-facts');if(!e)return;const i=v.info,L=[];
  L.push(i.home?'Живёт: '+esc(i.home):'Без дома');
  L.push(i.parents&&i.parents.length?`${i.gen}-е поколение`:i.from==='market'?'С рынка':'Один из первых драконов острова');
  if(i.gold!=null)L.push(`+${i.gold} 🪙 за карточку`);
  if(i.own&&i.feed&&!i.feed.max)L.push(`Кормлений до ${i.lvl+1}-го уровня: ${i.fed} из ${i.feeds}`);
  setHTML(e,`<ul>${L.map(x=>`<li>${x}</li>`).join('')}</ul>`)}

function setSub(v,s){v.sub=s;renderHead(v);if(s)renderSub(v);else renderMain(v);
  const p=v.$('.dri-pan');if(p)p.scrollTop=0;const h=v.$('.dri-body h3[tabindex]');if(h)h.focus({preventScroll:true});else{const b=v.$('[data-dk="geno"]');if(b)b.focus({preventScroll:true})}}
function renderSub(v){
  const head=t=>`<button class="dri-b2" data-dk="main">← К осмотру</button><h3 tabindex="-1">${t}</h3>`;
  if(v.sub==='geno')setHTML(v.$('.dri-body'),head('Генотип '+esc(v.info.name))+genoHTML(v.info.genome));
  else setHTML(v.$('.dri-body'),head('Родословная')+pedHTML(v))}
function genoHTML(g){
  const m=genoModel(g),th=l=>`<th scope="col">${l}<small>${esc(DRG.LOCI[l].name.toLowerCase())}</small></th>`;
  const tbl=(loci,rows,show)=>`<table><thead><tr><th></th>${loci.map(th).join('')}</tr></thead><tbody>${rows.map(([n,h])=>`<tr><th scope="row">${n}</th>${h.map(a=>`<td>${esc(al(a))}</td>`).join('')}</tr>`).join('')}
    <tr class="ph"><th scope="row">видно</th>${show.map(s=>`<td>${esc(s)}</td>`).join('')}</tr></tbody></table>`;
  return `<p class="dri-gn">Каждая аутосома в паре. Столбец — ген, строка — одна хромосома пары: аллели в строке лежат на одной хромосоме и вместе уходят в гамету, если не случится кроссинговер.</p>`+
  m.blocks.map(b=>{
    if(b.id==='mt')return `<section class="dri-chr"><h4>${b.title}</h4><p class="dri-mt"><b>G</b> ${esc(DRG.LOCI.G.name.toLowerCase())}: <span class="dri-al">${esc(al(b.mt))}</span> · ${esc(b.show[0])}</p><p class="dri-gn">${esc(b.note)}</p></section>`;
    const ln=b.links.map(x=>`${x.a} и ${x.b} сцеплены: кроссинговер между ними ${Math.round(x.r*100)} %`).join('; ');
    return `<section class="dri-chr"><h4>${b.title}${ln?`<small>${esc(ln)}</small>`:''}</h4>${tbl(b.loci,b.rows,b.show)}${b.w?tbl(b.w.loci,b.w.rows,b.w.show):''}
      ${b.id==='A1'?`<p class="dri-gn">Аллели E: ${Object.entries(ELW).map(([k,w])=>k+' '+w).join(', ')}. Здесь W означает воду, это не половая хромосома W.</p>`:''}${b.note?`<p class="dri-gn">${esc(b.note)}</p>`:''}</section>`}).join('')}
function pedHTML(v){
  const i=v.info,pic=(n,w)=>{try{return root.ART.svg(root.MORPH.morph(DRG.phenotype(n.genome),n.lvl||12),{width:w,key:'pd'+n.id,label:n.name})}catch(e){return ''}};
  const card=(n,role,w)=>{if(!n||n.unknown)return `<div class="dri-pp none"><span>${role}</span><b>не записано</b></div>`;
    const tag=n.alive&&n.id!==i.id?'button':'div';
    return `<${tag} class="dri-pp"${tag==='button'?` data-dk="goto" data-id="${esc(n.id)}" aria-label="Осмотреть: ${esc(n.name)}"`:''}>${pic(n,w)}<span>${role}</span><b>${esc(n.name)}</b><small>${n.alive?(n.lvl?n.lvl+'-й уровень':''):'улетел с острова'}</small></${tag}>`};
  if(!i.parents||!i.parents.length)return `<p class="dri-gn">${esc(i.name)}: ${i.from==='market'?'с рынка, родители':'один из первых драконов острова, родители'} не записаны.</p>`;
  const [m,f]=i.parents,gp=n=>n&&n.parents&&n.parents.length?n.parents:[null,null];
  return `<div class="dri-ped"><h4>Родители</h4><div class="dri-pg two">${card(m,'мать ♀',96)}${card(f,'отец ♂',96)}</div>
    <h4>Бабушки и дедушки</h4><div class="dri-pg four">${card(gp(m)[0],'мать матери',72)}${card(gp(m)[1],'отец матери',72)}${card(gp(f)[0],'мать отца',72)}${card(gp(f)[1],'отец отца',72)}</div>
    <p class="dri-gn">Генотипы родителей можно открыть, если родитель ещё живёт на острове: нажмите на него.</p></div>`}

/* для проверок и замеров */
function state(){const v=V;if(!v)return null;
  return {open:!v.dead,closing:v.closing,id:v.info&&v.info.id,ready:!!v.X,sel:v.sel,sub:v.sub,anim:v.A&&v.A.state(),z:v.cam&&v.baseZ?v.cam.Z/v.baseZ:null,fly:!!v.fly,hi:!!v.Xhi,mask:!!v.mask,
    perf:{prep:v.perf.prep,hit:v.perf.hit,mask:v.perf.mask,draw:v.perf.draw.slice()},bytes:(v.X?v.X.bytes:0)+(v.Xhi?v.Xhi.bytes:0)+(v.mask?v.mask.bytes:0),layout:v.side?'side':'sheet'}}
function tapAt(x,y){if(V)tap(V,x,y)}
function partAt(x,y){return V&&V.A&&V.view?hitTest(V,x*V.dpr,y*V.dpr):null}
/* где на экране часть тела (CSS-пиксели): для проверок нажатием в нужную точку */
function whereIs(part){const v=V;if(!v||!v.A)return null;
  return root.RIG.get(v.ph,v.info.lvl,{px:v.Xpx,dpr:v.dpr,part}).then(X=>{const b=boxOf(v,X),vw=v.view;root.RIG.release(X);if(!b)return null;
    return {x:(vw[0]*(b.x+b.w/2)+vw[4])/v.dpr,y:(vw[3]*(b.y+b.h/2)+vw[5])/v.dpr}})}

root.DRGINSP=Object.assign({open,close:()=>{if(V)close(V)},state,tapAt,partAt,whereIs,loadAll},PURE);
addEventListener('pagehide',()=>{if(V)finish(V)});
})(typeof window!=='undefined'?window:globalThis);
