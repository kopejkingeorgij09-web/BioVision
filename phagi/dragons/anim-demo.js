/* Демо анимаций драконов (этап 1 Драконов 3.0): один большой дракон с кнопками действий, сетка всех действий
   на общей текстуре и проверка памяти. Ничего не сохраняет, кроме выбора на этой странице (localStorage). */
(function(){
'use strict';
const D=window.DRG,MO=window.MORPH,SH=window.SHAPE,AN=window.ANIM,RIG=window.RIG,TX=window.DRTEX;
const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const WHO=[['F','Огонь',{E:'F/F',H:'H/H',R:'R1/R1'}],['W','Вода',{E:'W/W'}],['T','Земля',{E:'T/T',K:'K/k'}],['A','Воздух',{E:'A/A'}],
  ['P','Флора',{E:'P/P'}],['L','Свет',{E:'L/L'}],['D','Тьма',{E:'D/D'}],['FW','Огонь + Вода',{E:'F/W'}],
  ['Wg','Короткие крылья',{E:'A/A',Wg:'Wg/Wg'}],['e','Дымный',{E:'e/e'}],['s','Дремлющий',{E:'F/F',S:'s/s'}]];
const AGES=[[2,'Малыш'],[6,'Подросток'],[12,'Взрослый'],[18,'Развитый']];
const ACTS=[['idle','Стоит'],['walk','Идёт'],['happy','Радуется'],['eat','Ест'],['sleep','Спит'],['fly','Летит'],
  ['attack','Атакует'],['hit','Удар по нему'],['victory','Победа'],['defeat','Поражение']];
const DPR=Math.min(2,window.devicePixelRatio||1);
const $=id=>document.getElementById(id);
const st={who:'F',lvl:12,reduce:null,slow:false,joints:false,dark:null};
try{Object.assign(st,JSON.parse(localStorage.getItem('drgAnim')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('drgAnim',JSON.stringify(st))}catch(e){}};
const sysDark=()=>matchMedia('(prefers-color-scheme: dark)').matches;
const sysStill=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduce=()=>st.reduce==null?sysStill():st.reduce;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const f1=v=>v.toFixed(1).replace('.',','),f2=v=>v.toFixed(2).replace('.',','),MB=b=>(b/1048576).toFixed(1).replace('.',',')+' МБ';

let col={};
function readColors(){const cs=getComputedStyle(document.documentElement);['ground','grass','ink','quiet','good','warn','acc'].forEach(k=>col[k]=cs.getPropertyValue('--'+k).trim())}
function applyTheme(){if(st.dark==null)document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',st.dark?'dark':'light');readColors()}

/* ---------- сцена: земля с травой, дракон, частицы, суставы ---------- */
function Scene(cv,o){this.cv=cv;this.o=o||{};this.X=null;this.A=null;this.cam=0;this.vis=true;this.stats=[]}
Scene.prototype.size=function(){
  const w=this.cv.clientWidth||300,maxH=this.o.maxH?this.o.maxH():w*0.75;
  const px=Math.max(0.3,Math.min(w/this.o.wu,maxH/this.o.hu));
  const h=Math.round(this.o.hu*px);this.cv.style.height=h+'px';
  const W=Math.round(w*DPR),H=Math.round(h*DPR);if(this.cv.width!==W||this.cv.height!==H){this.cv.width=W;this.cv.height=H}
  return px};
Scene.prototype.draw=function(){
  const X=this.X,A=this.A,c=this.cv.getContext('2d'),W=this.cv.width,H=this.cv.height;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);if(!X||!A)return;
  const gy=Math.round(H*0.86),px=this.px,view=RIG.VIEW(X,{px,dpr:DPR,x0:W/2,gy,camX:this.cam}),z=view[0];
  /* земля и трава привязаны к миру: при ходьбе уезжают назад */
  c.fillStyle=col.ground;c.fillRect(0,gy-z*1.2,W,H-gy+z*1.2);
  c.strokeStyle=col.grass;c.lineWidth=Math.max(1,z*1.1);c.lineCap='round';
  const step=34,first=Math.floor((this.cam-W/2/z)/step)-1,last=Math.ceil((this.cam+W/2/z)/step)+1;
  c.beginPath();for(let i=first;i<=last;i++){const x=view[4]+i*step*z+((i*37)%11)*z,y=gy-z*1.2,hgt=(3+(i*53)%4)*z;
    c.moveTo(x,y);c.lineTo(x-hgt*0.3,y-hgt);c.moveTo(x+z*1.5,y);c.lineTo(x+z*1.8,y-hgt*1.2);c.moveTo(x+z*3,y);c.lineTo(x+z*3.6,y-hgt*0.8)}c.stroke();
  const t0=performance.now();
  RIG.draw(c,X,A.pose,view);RIG.drawFx(c,X,A.fx,view,col.quiet);
  this.lastDraw=performance.now()-t0;
  if(this.o.joints&&this.o.joints())joints(c,A,view)};
/* суставы: крепление лап, скакательный сустав, носок (зелёный — стопа стоит на земле), разрезы туловища, голова */
function joints(c,A,view){
  const P=A.P,R=A.R,p=A.pose,dot=(q,r,fill)=>{const v=AN.MAT.app(view,q);c.beginPath();c.arc(v[0],v[1],r*DPR,0,Math.PI*2);c.fillStyle=fill;c.fill()};
  c.save();c.setTransform(1,0,0,1,0,0);c.lineWidth=1.5*DPR;
  AN.LEGS.forEach(L=>{const g=P.legs[L],a=AN.MAT.app(p.body,g.a),k=AN.MAT.app(p.mat[L+'u'],g.h),t=AN.MAT.app(p.mat[L+'f'],g.toe);
    const va=AN.MAT.app(view,a),vk=AN.MAT.app(view,k),vt=AN.MAT.app(view,t);c.strokeStyle=L[0]==='N'?'#E0457B':'#8F6BD8';
    c.beginPath();c.moveTo(va[0],va[1]);c.lineTo(vk[0],vk[1]);c.lineTo(vt[0],vt[1]);c.stroke();
    const planted=Math.abs(p.feet[L][1]-g.g)<1e-6;dot(a,3,c.strokeStyle);dot(k,3,c.strokeStyle);dot(t,4,planted?'#22A35A':'#E8A33A')});
  [[R.tailCut,p.mat.tail],[R.neckCut,p.mat.neck]].forEach(([cut,M])=>{const n=[-cut.d[1],cut.d[0]],a=AN.MAT.app(view,AN.MAT.app(M,[cut.p[0]+n[0]*cut.r,cut.p[1]+n[1]*cut.r])),b=AN.MAT.app(view,AN.MAT.app(M,[cut.p[0]-n[0]*cut.r,cut.p[1]-n[1]*cut.r]));
    c.strokeStyle='#2F9CD6';c.setLineDash([4*DPR,3*DPR]);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();c.setLineDash([])});
  dot(AN.MAT.app(p.mat.head,R.head),4,'#2F9CD6');c.restore()}

/* ---------- главный дракон ---------- */
const main=new Scene($('cv'),{wu:470,hu:340,maxH:()=>Math.min(560,Math.max(300,innerHeight*0.6)),joints:()=>st.joints});
let mainPh=null,mainInfo={},loadTok=0;
const spec=()=>WHO.find(w=>w[0]===st.who)||WHO[0];
async function loadMain(){
  const tok=++loadTok,[,name,sp]=spec(),g=mk(sp),ph=D.phenotype(g),M=MO.morph(ph,st.lvl),G=SH.build(M);
  const px=Math.round(main.size()*20)/20,t0=performance.now();
  const X=await RIG.get(ph,st.lvl,{px,dpr:DPR});
  if(tok!==loadTok){RIG.release(X);return}
  if(main.X)RIG.release(main.X);
  const ms=performance.now()-t0;
  main.X=X;main.px=px;mainPh=ph;
  const prevState=main.A?main.A.state():'idle',cx=G.box.x+G.box.w/2;
  main.A=new AN.Animator(M,G.rig,{seed:7,reduce:reduce()});main.cx=cx;main.cam=cx;
  if(prevState!=='idle'&&AN.STATES[prevState].loop)main.A.play(prevState);
  mainInfo={name,M,prep:ms,cached:ms<X.ms*0.5};
  $('cv').setAttribute('aria-label',name+', '+M.stageName.toLowerCase()+': анимация');
  buildGrid(ph);renderButtons();facts()}

function renderButtons(){
  $('who').innerHTML='<span class="lbl">Дракон</span>'+WHO.map(([k,n])=>`<button class="chip" data-who="${k}" aria-pressed="${k===st.who}">${esc(n)}</button>`).join('');
  $('age').innerHTML='<span class="lbl">Возраст</span>'+AGES.map(([l,n])=>`<button class="chip" data-lvl="${l}" aria-pressed="${l===st.lvl}">${esc(n)}, ${l}-й ур.</button>`).join('');
  const A=main.A,cur=A?A.state():'idle';
  $('acts').innerHTML=ACTS.map(([k,n])=>{const no=k==='fly'&&A&&!A.P.canFly;
    return `<button class="act${no?' no':''}" data-act="${k}" aria-pressed="${cur===k||(k==='fly'&&cur==='flutter')||(k==='defeat'&&cur==='defeated')}"${no?` title="Не летает: ${esc(A.P.noFly)}"`:''}>${esc(n)}</button>`}).join('');
  document.querySelectorAll('.tg').forEach(b=>{const t=b.dataset.t;b.setAttribute('aria-pressed',String(t==='dark'?(st.dark==null?sysDark():st.dark):t==='reduce'?reduce():!!st[t]))});
  nowLine()}
let flash='';
function nowLine(){const A=main.A;if(!A)return;const s=A.state(),nm=AN.STATES[s].name;
  $('now').innerHTML='Сейчас: <b>'+esc(nm)+'</b>'+(s==='flutter'?' · '+esc(A.P.noFly):'')+(flash?' · '+esc(flash):'')}

function facts(){
  const A=main.A,X=main.X;if(!A||!X)return;const P=A.P,cs=TX.shared.stats(),m=mainInfo.M;
  const avg=k=>main.stats.length?main.stats.reduce((a,s)=>a+s[k],0)/main.stats.length:0;
  const strips=X.order.filter(p=>p.bend).reduce((a,p)=>a+Math.ceil(Math.max(0,p.w-p.cutX)/6),0);
  const dev=(/Mobi|Android|iPhone|iPad/.test(navigator.userAgent)?'телефон или планшет':'компьютер')+', плотность экрана '+DPR;
  $('facts').innerHTML=[
    ['Походка',`скорость ${f1(P.v)} ед./с, цикл шага ${f2(P.period)} с, длина цикла ${Math.round(P.stride)} ед., опора ${Math.round(P.duty*100)} % цикла, тяжесть ${f2(P.hv)}`],
    ['Дыхание и крылья',`вдох-выдох ${f1(P.breathT)} с, взмах ${f2(P.wing.flapT)} с, нагрузка на крыло ${f2(P.wing.load)} (у взрослого Огня около 1)`],
    ['Полёт',P.canFly?'может летать':'не летает: '+esc(P.noFly)+'. Нажатие «Летит» покажет попытку'],
    ['Кадр',`поза ${f2(avg('u'))} мс, рисование ${f2(avg('d'))} мс, частей ${X.order.length}, полосок изгиба ${strips}. Замер: ${dev}`],
    ['Текстуры',`подготовка ${Math.round(mainInfo.cached?X.ms:mainInfo.prep)} мс${mainInfo.cached?' (сейчас взято из кеша)':''}, этот дракон ${MB(X.bytes)}, весь кеш ${MB(cs.bytes)} из ${MB(cs.budget)}, занято ${cs.pinned} из ${cs.count}, холстов ${TX.liveCanvases()}`]
  ].map(([h,v])=>`<div class="fact"><h3>${h}</h3><div class="v">${v}</div></div>`).join('')}

/* ---------- сетка: все действия на одной текстуре ---------- */
let cells=[];
const cio=new IntersectionObserver(es=>es.forEach(e=>{const s=cells.find(c=>c.cv===e.target);if(s)s.vis=e.isIntersecting}),{rootMargin:'100px'});
async function buildGrid(ph){
  cells.forEach(s=>{cio.unobserve(s.cv);if(s.X)RIG.release(s.X)});cells=[];
  const grid=$('grid');grid.innerHTML='';
  const M=MO.morph(ph,st.lvl),G=SH.build(M);
  for(let i=0;i<ACTS.length;i++){const [k,n]=ACTS[i],box=document.createElement('div');box.className='cell';
    const cv=document.createElement('canvas');cv.setAttribute('role','img');cv.setAttribute('aria-label',n);box.append(cv);
    const h3=document.createElement('h3');h3.textContent=n;box.append(h3);grid.append(box);
    const s=new Scene(cv,{wu:360,hu:340});s.cx=G.box.x+G.box.w/2;s.cam=s.cx;s.act=k;s.wait=0;
    s.A=new AN.Animator(M,G.rig,{seed:11+i,reduce:reduce()});if(k!=='idle')s.A.play(k);
    if(k==='fly'&&!s.A.P.canFly)h3.textContent=n+' (не летает: '+s.A.P.noFly+')';
    cells.push(s);cio.observe(cv)}
  /* одна текстура на все копии: тот же ключ, что у главного дракона */
  const X=await RIG.get(ph,st.lvl,{px:main.px,dpr:DPR});
  cells.forEach((s,i)=>{if(i)TX.shared.acquire(X.key,()=>X);s.X=X;s.px=s.size()})}

/* ---------- цикл кадров: один на всю страницу, останавливается в фоновой вкладке ---------- */
let raf=0,last=0;
function frame(now){
  raf=requestAnimationFrame(frame);
  const dt=Math.min(0.1,(now-last)/1000)*(st.slow?0.25:1);last=now;
  if(main.A&&main.vis){const t0=performance.now(),ev=main.A.update(dt),t1=performance.now();
    main.cam+=(main.A.x+main.cx-main.cam)*(1-Math.exp(-dt*2.5));
    main.draw();main.stats.push({u:t1-t0,d:main.lastDraw});if(main.stats.length>60)main.stats.shift();
    if(ev.length){ev.forEach(e=>{if(e.type==='hit')flash='попадание';if(e.type==='end')flash=''});renderButtons()}}
  cells.forEach(s=>{if(!s.vis||!s.X)return;const ev=s.A.update(dt);s.cam+=(s.A.x+s.cx-s.cam)*(1-Math.exp(-dt*2.5));
    /* разовые действия в сетке повторяются после короткой паузы */
    if(ev.some(e=>e.type==='end'))s.wait=0.8;if(s.wait>0){s.wait-=dt;if(s.wait<=0&&!AN.STATES[s.act].loop)s.A.play(s.act)}
    s.draw()})}
function start(){if(raf)return;last=performance.now();raf=requestAnimationFrame(frame)}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0}
document.addEventListener('visibilitychange',()=>{document.hidden?stop():start()});
new IntersectionObserver(es=>es.forEach(e=>{main.vis=e.isIntersecting}),{rootMargin:'50px'}).observe($('cv'));
setInterval(()=>{if(!document.hidden)facts()},1000);

/* ---------- управление ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.who){st.who=b.dataset.who;save();loadMain()}
  else if(b.dataset.lvl){st.lvl=+b.dataset.lvl;save();loadMain()}
  else if(b.dataset.act&&main.A){flash='';main.A.play(b.dataset.act);renderButtons()}
  else if(b.dataset.t){const t=b.dataset.t;
    if(t==='dark'){st.dark=!(st.dark==null?sysDark():st.dark);applyTheme()}
    else if(t==='reduce'){st.reduce=!reduce();const r=reduce();if(main.A)main.A.reduce=r;cells.forEach(s=>s.A.reduce=r)}
    else st[t]=!st[t];
    save();renderButtons()}
  else if(b.id==='memBtn')memCheck()});
/* погладить: нажатие или касание дракона радует его */
$('cv').addEventListener('click',()=>{if(!main.A)return;const s=main.A.state();if(['sleep','defeated','fly'].includes(s))return;main.A.play('happy',{then:s==='walk'?'walk':undefined});renderButtons()});
let rs=0;addEventListener('resize',()=>{clearTimeout(rs);rs=setTimeout(()=>{const px=Math.round(main.size()*20)/20;if(Math.abs(px-main.px)>0.12)loadMain();cells.forEach(s=>s.px=s.size())},200)});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{applyTheme();renderButtons()});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{const r=reduce();if(main.A)main.A.reduce=r;cells.forEach(s=>s.A.reduce=r);renderButtons()});
/* уход со страницы: отпустить всё и очистить кеш, холсты не копятся */
addEventListener('pagehide',()=>{stop();if(main.X)RIG.release(main.X);cells.forEach(s=>s.X&&RIG.release(s.X));TX.shared.clear(true)});

/* ---------- проверка памяти ---------- */
async function memCheck(){
  const out=$('memOut'),btn=$('memBtn'),L=[];btn.disabled=true;out.textContent='Готовлю 12 драконов…';
  const line=s=>{L.push(s);out.textContent=L.join('\n')};
  const c0=TX.liveCanvases(),s0=TX.shared.stats();
  line(`До проверки: холстов ${c0}, в кеше ${s0.count} текстур (${MB(s0.bytes)}), занято ${s0.pinned}.`);
  const list=[['F/F',12],['W/W',12],['T/T',12],['A/A',12],['P/P',12],['L/L',12],['D/D',12],['F/W',12],['T/A',12],['P/D',12],['F/F',2],['W/W',6]];
  const t0=performance.now(),held=[];
  for(const [E,lv] of list){const ph=D.phenotype(mk({E}));held.push(await RIG.get(ph,lv,{px:0.8,dpr:1}))}
  const tPrep=(performance.now()-t0)/list.length;
  const tmp=document.createElement('canvas');tmp.width=320;tmp.height=240;const c=tmp.getContext('2d');
  const tf=performance.now();held.forEach((X,i)=>{const A=new AN.Animator(MO.morph(D.phenotype(mk({E:list[i][0]})),list[i][1]),SH.build(MO.morph(D.phenotype(mk({E:list[i][0]})),list[i][1])).rig);
    for(let f=0;f<30;f++){A.update(1/60);c.clearRect(0,0,320,240);RIG.draw(c,X,A.pose,RIG.VIEW(X,{px:0.8,dpr:1,x0:160,gy:220,camX:A.x+X.R.mid[0]}))}});
  const tDraw=(performance.now()-tf)/(held.length*30);
  const s1=TX.shared.stats();
  line(`12 драконов готовы: в среднем ${Math.round(tPrep)} мс на дракона, кадр одного ${f2(tDraw)} мс. В кеше ${s1.count} текстур, ${MB(s1.bytes)}, холстов ${TX.liveCanvases()}.`);
  const b0=s1.budget;TX.shared.setBudget(1024*1024);const s2=TX.shared.stats();
  line(`Лимит сжат до 1 МБ, пока все 12 на экране: вытеснено ${s2.evicted-s1.evicted}, видимые не пропали (${s2.pinned} заняты).`);
  held.forEach(X=>RIG.release(X));const s3=TX.shared.stats(),mainOk=main.X&&TX.shared.peek(main.X.key);
  line(`12 драконов ушли с экрана: вытеснено ${s3.evicted-s2.evicted}, в кеше ${s3.count} текстур (${MB(s3.bytes)}), холстов ${TX.liveCanvases()}. Дракон наверху ${mainOk&&mainOk.ready?'на месте':'ПРОПАЛ'}.`);
  TX.shared.setBudget(b0);TX.shared.clear();const s4=TX.shared.stats();
  line(`Уход со страницы (очистка свободного): в кеше ${s4.count} текстур, все заняты рисующими (${s4.pinned}), холстов ${TX.liveCanvases()}.`);
  btn.disabled=false;facts()}

applyTheme();renderButtons();loadMain().then(start);
})();
