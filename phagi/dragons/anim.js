/* Анимация дракона 3.0: машина состояний, походка и позы. Чистая логика без DOM и без генетики.
   Вход: морфология M (MORPH.morph) и точки рига R (SHAPE.build(M).rig). Выход: поза, то есть матрица каждой части
   в единицах рисунка (земля y=0, вверх отрицательные y, морда вправо) и параметры изгиба хвоста и шеи.
   Рисует позу rig.js, из тех же слоёв, что и рисунок A.
   Наследуемые признаки анимация не меняет: части только поворачиваются и сдвигаются, лапа сгибается или выпрямляется
   (сжатие вдоль её оси), туловище дышит (до 2 %). Набор частей, форма и цвет остаются как у A.
   Темп и походка считаются из морфологии (высота бедра, толщина туловища, размер, крылья), генотип сюда не попадает. */
(function(root){
'use strict';

const TAU=Math.PI*2;
const clamp=(x,a,b)=>x<a?a:x>b?b:x,lerp=(a,b,t)=>a+(b-a)*t,frac=x=>x-Math.floor(x);
const sm=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
/* огибающая разового действия: 0 до a, растёт к 1 до b, держится до c, гаснет к 0 до d */
const env=(t,a,b,c,d)=>t<=a||t>=d?0:t<b?sm((t-a)/(b-a)):t<=c?1:1-sm((t-c)/(d-c));
const bump=(t,a,d)=>t<=a||t>=d?0:Math.sin(Math.PI*(t-a)/(d-a));

/* ---------- векторы и 2D-матрицы ----------
   Матрица в порядке canvas: [a,b,c,d,e,f], x'=a·x+c·y+e, y'=b·x+d·y+f. Поворот на t по часовой стрелке на экране (y вниз). */
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mulv=(a,k)=>[a[0]*k,a[1]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],len=a=>Math.hypot(a[0],a[1]);
const unit=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l]},lerpP=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
const perpUp=d=>[d[1],-d[0]];
const I=()=>[1,0,0,1,0,0];
const mul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
const app=(A,p)=>[A[0]*p[0]+A[2]*p[1]+A[4],A[1]*p[0]+A[3]*p[1]+A[5]];
const inv=A=>{const d=A[0]*A[3]-A[1]*A[2];return [A[3]/d,-A[1]/d,-A[2]/d,A[0]/d,(A[2]*A[5]-A[3]*A[4])/d,(A[1]*A[4]-A[0]*A[5])/d]};
const T=(x,y)=>[1,0,0,1,x,y];
const around=(M,p)=>p?mul(T(p[0],p[1]),mul(M,T(-p[0],-p[1]))):M;
const Rot=(t,p)=>{const c=Math.cos(t),s=Math.sin(t);return around([c,s,-s,c,0,0],p)};
const Sc=(sx,sy,p)=>around([sx,0,0,sy,0,0],p);
/* растяжение в k раз вдоль единичного направления u через точку p */
const Str=(u,k,p)=>{const m=k-1;return around([1+m*u[0]*u[0],m*u[0]*u[1],m*u[0]*u[1],1+m*u[1]*u[1],0,0],p)};
const MAT={I,mul,app,inv,T,Rot,Sc,Str};

function rng(seed){let a=(seed>>>0)||1;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}

/* ---------- изгиб хвоста и шеи ----------
   Ось идёт от разреза туловища к кончику хвоста (к голове у шеи), s = u/L от 0 до 1.
   Изгиб задаётся поворотом касательной к оси: φ(s) = lift·s + amp·s·sin(ph − k·s) радиан в сторону нормали оси,
   а положение точки оси складывается из коротких отрезков, поэтому длина хвоста и шеи при изгибе не меняется.
   У разреза φ = 0: хвост и шея выходят из туловища без излома. Поворот rot (на экране, как Rot) тоже не шарнир у разреза:
   он набирается плавно на первых RAMP длины, поэтому основание шеи и хвоста гнётся, а не отламывается от туловища. */
const RAMP=0.45;
const phi=(p,s)=>{if(s<=0)return 0;if(s>1)s=1;return p.lift*s+p.amp*s*Math.sin(p.ph-p.k*s)};
const rotAt=(p,s)=>p.rot?p.rot*sm(s/RAMP):0;
const NSEG=32;
/* куда уезжает точка оси на расстоянии u от разреза и на какой угол поворачивается (на экране) */
function curl(ax,p,u){
  if(u<=0)return {d:[0,0],ang:0};
  const sg=cross(ax.a,ax.n)>0?1:-1,uu=Math.min(u,ax.L),n=Math.max(1,Math.ceil(NSEG*uu/ax.L)),h=uu/n,a=ax.a;
  let x=0,y=0,t=0;
  for(let i=0;i<n;i++){const q=(i+0.5)*h/ax.L;t=sg*phi(p,q)+rotAt(p,q);const c=Math.cos(t),s=Math.sin(t);x+=(a[0]*c-a[1]*s)*h;y+=(a[0]*s+a[1]*c)*h}
  t=sg*phi(p,uu/ax.L)+rotAt(p,uu/ax.L);
  if(u>ax.L){const c=Math.cos(t),s=Math.sin(t),r=u-ax.L;x+=(a[0]*c-a[1]*s)*r;y+=(a[0]*s+a[1]*c)*r}
  return {d:[x-a[0]*u,y-a[1]*u],ang:t}}
/* матрица столбца сетки на расстоянии u от разреза: поворот вокруг её точки на оси и сдвиг туда, куда ось изогнулась */
function colMat(ax,p,u){const c=curl(ax,p,u);return mul(T(c.d[0],c.d[1]),Rot(c.ang,add(ax.c,mulv(ax.a,u))))}

/* ---------- профиль движения из морфологии ----------
   Соотношения между драконами взяты из биомеханики, абсолютный темп выбран нами для игры:
   · ходьба по динамическому подобию: скорость из числа Фруда Fr = v²/(g·h), длина цикла λ ≈ 2.3·Fr^0.3·h
     (R. McN. Alexander, Nature 261:129, 1976); g = 133 ед./с² для взрослого задаёт общий неторопливый темп;
   · период дыхания растёт как масса^0.26 (W. R. Stahl, J. Appl. Physiol. 22:453, 1967);
   · период взмаха крыла ∝ m^(−3/8)·b^(23/24)·S^(1/3) (C. J. Pennycuick, J. Exp. Biol. 199:1613, 1996).
   «Масса» здесь относительная: размер³ × длина туловища × толщина², взрослый Огонь 12-го уровня = 1. */
const G0=133,M_REF=62*30.24*30.24,WREF=0.98;
const LEGS=['FH','FF','NH','NF'];
/* боковая последовательность шагов (как у большинства четвероногих при ходьбе): задняя, передняя той же стороны, потом другая сторона */
const OFF={NH:0,NF:0.25,FH:0.5,FF:0.75};
/* характер движения по стихиям: художественная условность игры, не генетика и не биомеханика (у настоящих животных
   такой связи нет, это манера, по которой стихию узнают в движении). tempo — темп покачиваний в покое, sway — их размах,
   look — как часто и резко дракон переводит взгляд, head — посадка головы (> 0 выше), low — присед (доля высоты бедра),
   bob и step — подскок туловища и высота шага при ходьбе, wave — добавка к волне по хвосту.
   У гибрида — среднее двух стихий, у дымного и дремлющего (стихия не проявлена) — нейтрально */
const MOVE={
  F:{tempo:1.25,sway:1.1,look:1.8,head:0.04,low:0,bob:1.1,step:1.1,wave:0},      /* Огонь: живой, резкий, голова высоко */
  W:{tempo:0.85,sway:1.35,look:0.7,head:0,low:0,bob:0.8,step:0.9,wave:0.6},     /* Вода: плавный, волной */
  T:{tempo:0.75,sway:0.6,look:0.6,head:-0.03,low:0.015,bob:1.2,step:0.8,wave:0}, /* Земля: тяжёлый, неторопливый, ниже */
  A:{tempo:1.2,sway:1.2,look:1.3,head:0.05,low:0,bob:1.4,step:1.3,wave:0.2},    /* Воздух: лёгкий, пружинит */
  P:{tempo:0.8,sway:1.4,look:0.6,head:0.02,low:0,bob:0.9,step:1,wave:0.3},      /* Флора: качается, как стебель */
  L:{tempo:0.9,sway:0.9,look:0.9,head:0.08,low:0,bob:0.9,step:1.05,wave:0},     /* Свет: держится прямо */
  D:{tempo:0.9,sway:0.8,look:1.4,head:-0.04,low:0.03,bob:0.7,step:0.85,wave:0.2}};/* Тьма: крадётся, ниже, зорко */
const NEUTRAL={tempo:1,sway:1,look:1,head:0,low:0,bob:1,step:1,wave:0};
/* возраст тоже манера: малыш суетится (чаще и шире), старший спокойнее */
const AGE_MOVE=[{tempo:1.3,sway:1.3,look:1.5},{tempo:1.1,sway:1.1,look:1.2},{tempo:1,sway:1,look:1},{tempo:0.85,sway:0.85,look:0.8}];
function styleOf(M){
  const els=(M.elements||[]).filter(e=>MOVE[e]),o={};
  Object.keys(NEUTRAL).forEach(k=>{o[k]=els.length?els.reduce((a,e)=>a+MOVE[e][k],0)/els.length:NEUTRAL[k]});
  const ag=AGE_MOVE[clamp(M.stage||0,0,3)];['tempo','sway','look'].forEach(k=>o[k]*=ag[k]);
  if(M.breath==='dormant')o.tempo*=0.8;
  return o}
function profile(M,R){
  const b=M.body,s=M.scale,h=-R.hip[1],stage=M.stage;
  const girth=(b.bellyR+b.chestR)/2;
  const hv=clamp((girth/h-0.235)/0.625,0,1);           /* тяжесть: 0 лёгкий (Воздух) … 1 тяжёлый (Земля) */
  const mass=Math.pow(s,3)*b.len*girth*girth/M_REF;
  const baby=stage===0,sleepy=M.breath==='dormant';
  const Fr=0.17-0.07*hv,v=Math.sqrt(Fr*G0*h*s)/s,stride=2.3*Math.pow(Fr,0.3)*h;
  const P={h,s,hv,mass,baby,stage,sleepy,Fr,v,stride,period:stride/v,
    duty:0.6+0.12*hv,                                      /* доля опоры: у тяжёлых лапа дольше стоит на земле */
    lift:h*(0.1-0.04*hv)*(baby?1.25:1),                    /* подъём стопы в переносе */
    bob:h*(0.012+0.012*hv)*(baby?1.6:1),
    heel:0.12+0.25*(1-hv),                                 /* подъём пятки в конце опоры, радианы */
    hop:h*(0.16-0.08*hv)*(baby?1.4:1),
    breathT:3.4*Math.pow(mass,0.26)*(sleepy?1.3:1)};
  const tailSl=b.tailL/(b.hipR*b.tailR0);
  const st=P.style=styleOf(M);
  P.tail={amp:clamp(0.075+0.03*tailSl,0.1,0.42),k:1.2+2.5*(b.tailWave||0)+st.wave,T:2.6*Math.sqrt(b.tailL*s/80)*(sleepy?1.3:1)};
  P.neck={T:P.breathT*1.15};
  P.lift*=st.step;P.bob*=st.bob;
  /* крылья: нагрузка на крыло = масса / площадь. Правило игры утверждено 27.10: не летают малыши, короткие крылья (Wg)
     и драконы с нагрузкой на крыло больше 1,6 (так выходит у тяжёлой Земли) */
  const w=M.wing,b2=Math.max(w.span*s,0.05),area=Math.max(w.span*w.chord*s*s,0.002),load=mass/area;
  P.wing={load,span:b2,area,flapT:clamp(0.95*Math.pow(mass,-3/8)*Math.pow(b2/WREF,23/24)*Math.pow(area/WREF,1/3),0.3,1.6)};
  P.canFly=!w.short&&stage>0&&load<=1.6;
  P.noFly=w.short?'короткие крылья (ген Wg)':stage===0?'малыши ещё не летают':load>1.6?'крылья малы для такого веса':'';
  /* лапы: верхнее звено от крепления до скакательного сустава (у передней до запястья), стопа отдельно */
  /* колено (у передней локоть) сгибается: два звена, бедро a→k и голень k→h, решаются двухзвенной обратной кинематикой.
     bend — в какую сторону от прямой a→h смотрит колено в покое (у задней вперёд, у передней локоть назад) */
  P.legs={};LEGS.forEach(L=>{const g=R.legs[L],v0=sub(g.h,g.a),k=g.k||lerpP(g.a,g.h,0.5),l1=len(sub(k,g.a)),l2=len(sub(g.h,k));
    P.legs[L]={a:g.a,h:g.h,k,toe:g.toe,f:g.f,g:g.g,v0,l:len(v0),u0:unit(v0),l1,l2,reach:(l1+l2)*0.985,bend:Math.sign(cross(v0,sub(k,g.a)))||1}});
  const ax=(c,end,up)=>{const a=unit(sub(end,c.p)),n=perpUp(a);return {c:c.p,a,L:len(sub(end,c.p)),r:c.r,n:up?n:mulv(n,-1)}};
  P.tailAx=ax(R.tailCut,R.tailTip,false);   /* нормаль хвоста смотрит вверх: lift > 0 поднимает хвост */
  P.neckAx=ax(R.neckCut,R.head,true);       /* нормаль шеи смотрит к спине: bend > 0 откидывает голову назад */
  return P}

/* ---------- состояния ---------- */
const STATES={
  idle:{loop:1,name:'Стоит'},walk:{loop:1,name:'Идёт'},sleep:{loop:1,blend:0.9,name:'Спит'},
  fly:{loop:1,blend:0.5,name:'Летит'},defeated:{loop:1,blend:0.4,name:'Отдыхает после боя'},
  happy:{d:1.6,name:'Радуется'},eat:{d:2.6,name:'Ест'},attack:{d:1.2,hit:0.55,name:'Атакует'},
  hit:{d:0.6,blend:0.08,name:'Получает удар'},victory:{d:2.0,name:'Победа'},defeat:{d:1.6,next:'defeated',name:'Поражение'},
  flutter:{d:1.5,name:'Пробует взлететь'}};

const neutralFeet=(A,x)=>{const o={};LEGS.forEach(L=>{const g=A.P.legs[L];o[L]=[x+g.toe[0],g.g,0]});return o};
const bodyMat=(A,r)=>mul(T(r.x+r.dx,r.dy),Rot(r.rot,lerpP(A.R.hip,A.R.sh,r.pv)));
/* поджатые лапы (полёт, стойка на задних): верхнее звено повёрнуто на ang вокруг места крепления (> 0 назад)
   и укорочено до k своей длины, стопа повёрнута на rot. Возвращает стопы в мире для тех лап, что есть в spec */
const tuckFeet=(A,r,spec)=>{const B=bodyMat(A,r),rho=Math.atan2(B[1],B[0]),o={};
  Object.keys(spec).forEach(L=>{const g=A.P.legs[L],[ang,k,rot]=spec[L],an=app(B,add(g.a,mulv(app(Rot(ang),g.v0),k))),rw=rot+rho;
    const d=app(Rot(rw),sub(g.h,g.toe));o[L]=[an[0]-d[0],an[1]-d[1],rw]});
  return o};
const mixFeet=(a,b,w)=>{const o={};LEGS.forEach(L=>{o[L]=[lerp(a[L][0],b[L][0],w),lerp(a[L][1],b[L][1],w),lerp(a[L][2],b[L][2],w)]});return o};

/* поза покоя: дыхание, лёгкое покачивание хвоста и шеи, взгляд по сторонам */
function base(A,tau){
  const P=A.P,k=A.reduce?0.3:1,br=Math.sin(TAU*tau/P.breathT),st=P.style,tt=tau*st.tempo,sw=k*st.sway;
  return {x:A.x,dx:0.8*sw*Math.sin(TAU*tt/(P.breathT*2.3)),dy:-0.35*br*k+st.low*P.h,rot:0,pv:0.5,sx:1+0.005*br*k,sy:1+0.016*br*k,
    tail:{rot:0,lift:0.04*sw*Math.sin(TAU*tt/(P.tail.T*1.7)),amp:P.tail.amp*0.35*sw,ph:TAU*tt/P.tail.T,k:P.tail.k},
    neck:{rot:0,lift:0.04*sw*Math.sin(TAU*tt/P.neck.T+1)+st.head,amp:0,ph:0,k:0},
    head:{rot:0.03*sw*Math.sin(TAU*tt/(P.neck.T*1.37)+2)+A.look.v-st.head*0.5,dx:0,dy:0},
    wings:{rot:0,sy:1-0.015*(1+br)*k,frot:0,fsy:1-0.015*(1+br)*k},
    lid:0,br:{s:1,a:1},gr:{s:1,a:1},adapt:1,food:{q:0,a:0},
    feet:neutralFeet(A,A.x)}}

/* лечь: туловище опускается к земле (depth — доля пути до касания животом), лапы складываются вперёд,
   голова опускается к земле: сначала поворот у основания шеи (не больше 0,4 рад), остальное изгибом шеи */
function lie(A,r,w,depth,headDown){
  if(w<=0)return r;
  const P=A.P,R=A.R,drop=Math.max(0,-R.belly-2.5)*(depth||0.85)*w;
  r.dy+=drop;
  const folded={};
  LEGS.forEach(L=>{const g=P.legs[L],Wa=[r.x+g.a[0],g.a[1]+r.dy],dy=g.h[1]-Wa[1],reach=g.l*0.8;
    const dx=dy<reach?Math.sqrt(reach*reach-dy*dy):g.v0[0];
    const ankX=Wa[0]+Math.max(dx,g.v0[0]);folded[L]=[ankX+(g.toe[0]-g.h[0]),g.g,0]});
  r.feet=mixFeet(r.feet,folded,w);
  const piv=add(R.neckCut.p,[0,r.dy]),chin=add(R.headLow[1],[0,r.dy]),rel=sub(chin,piv),rho=len(rel),al=Math.atan2(rel[1],rel[0]);
  const want=-1-(headDown||0),th=clamp(Math.asin(clamp((want-piv[1])/rho,-1,1))-al,-0.3,1.4);
  const rot=Math.min(th,0.4),cu=clamp(-2*(th-rot),-1.3,0);
  r.neck.rot+=rot*w;r.neck.lift+=cu*w;r.head.rot-=(rot-cu)*0.6*w;
  return r}

/* ход взмаха: +1 крыло вверху, −1 внизу; вниз быстрее (45 % периода), вверх медленнее */
const stroke=p=>p<0.45?Math.cos(Math.PI*p/0.45):-Math.cos(Math.PI*(p-0.45)/0.55);

const POSE={
  idle:(A,t,tau)=>base(A,tau),

  walk:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.35:1,ph=A.x/P.stride;
    r.dx=0;r.dy+=P.bob*k*Math.cos(2*TAU*ph);
    r.rot+=0.012*(0.5+P.hv)*k*Math.sin(TAU*ph);              /* перенос веса между передними и задними лапами */
    r.neck.lift+=0.06*k*Math.cos(2*TAU*ph+0.6);r.head.rot-=0.02*k*Math.cos(2*TAU*ph+0.6);   /* голова кивает в такт шагу */
    r.tail.amp=P.tail.amp*0.6*k;r.tail.ph=TAU*ph+tau*0.4;
    r.wings.sy*=0.97;r.wings.fsy*=0.97;
    const o={},sw=P.duty*P.stride;
    LEGS.forEach(L=>{const g=P.legs[L],q=frac(ph+OFF[L]);let X,Y=g.g,rr=0;
      if(q<P.duty){X=sw/2-q*P.stride;const u=q/P.duty;if(u>0.72)rr=P.heel*sm((u-0.72)/0.28)}
      else{const u=(q-P.duty)/(1-P.duty);X=-sw/2+sw*sm(u);Y=g.g-P.lift*Math.sin(Math.PI*u);rr=P.heel*Math.pow(1-u,1.5)+0.1*Math.sin(Math.PI*u)}
      o[L]=[A.x+g.toe[0]+X,Y,rr]});
    r.feet=o;return r},

  happy:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.2:1,e=env(t,0,0.2,1.3,1.6);
    const hop=bump(t,0.2,0.62)+bump(t,0.8,1.22),crouch=bump(t,0.05,0.24)+bump(t,0.62,0.82);
    r.dy+=(-P.hop*hop+P.h*0.04*crouch)*k;
    r.feet=neutralFeet(A,A.x);LEGS.forEach(L=>{r.feet[L][1]-=P.hop*hop*0.85*k});
    r.tail.amp=P.tail.amp*(0.35+1.3*e)*Math.max(k,0.5);r.tail.ph=TAU*t*2.2;r.tail.lift+=0.24*e*k;
    r.head.rot-=0.12*e*k;r.neck.lift+=0.1*e*k;r.lid=0.55*env(t,0.1,0.3,1.3,1.55);
    const f=0.25*e*(0.5+0.5*Math.sin(TAU*t*3.2))*Math.max(k,0.3);r.wings.sy-=f;r.wings.fsy-=f;
    return r},

  flutter:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.25:1,e=env(t,0,0.15,1.0,1.4),hop=bump(t,0.25,0.75);
    r.dy+=(-P.hop*0.6*hop+P.h*0.04*bump(t,0,0.25))*k;
    LEGS.forEach(L=>{r.feet[L][1]-=P.hop*0.6*hop*0.85*k});
    const w=stroke(frac(t/Math.max(0.22,P.wing.flapT*0.55)));
    r.wings.sy=lerp(1,lerp(-0.4,1.05,(w+1)/2),e*Math.max(k,0.4));r.wings.fsy=r.wings.sy;r.wings.rot=-0.06*w*e*k;r.wings.frot=r.wings.rot;
    r.head.rot+=0.12*Math.sin(TAU*t*5)*env(t,0.9,1.0,1.3,1.45)*k;r.lid=0.4*env(t,0.85,0.95,1.3,1.45);
    r.tail.lift+=0.12*e*k;return r},

  eat:(A,t,tau)=>{
    const r=base(A,tau),k=A.reduce?0.3:1;
    const look=env(t,0,0.45,0.62,0.85),chew=env(t,0.8,0.95,2.05,2.25),gulp=bump(t,2.1,2.5);
    r.head.rot+=(-0.25*look+0.08*chew)*k;r.neck.lift+=(0.12*look-0.06*chew-0.1*gulp)*k;
    r.head.dx+=3*bump(t,0.58,0.8)*k;r.head.dy+=1.1*Math.sin(TAU*t*3.4)*chew*k;r.head.rot+=0.03*Math.sin(TAU*t*3.4+1)*chew*k;
    r.lid=Math.max(0.35*chew,0);r.tail.amp*=1+0.8*chew;
    r.food={q:clamp(t/0.72,0,1),a:t<0.74?1:0};return r},

  attack:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.35:1;
    const wu=sm(t/0.42)*(1-sm((t-0.42)/0.1)),st=sm((t-0.42)/0.12)*(1-sm((t-0.72)/0.42));
    r.dx+=P.h*(-0.07*wu+0.12*st)*k;r.dy+=P.h*(0.035*wu+0.015*st)*k;r.rot+=(-0.03*wu+0.04*st)*k;
    r.neck.rot+=(-0.3*wu+0.32*st)*k;r.neck.lift+=(0.12*wu-0.08*st)*k;r.head.rot+=(-0.18*wu+0.12*st)*k;
    r.tail.lift+=(0.24*wu-0.08*st)*k;
    r.wings.sy+=0.06*wu-0.4*st*k;r.wings.fsy=r.wings.sy;r.wings.rot=-0.1*wu*k;r.wings.frot=r.wings.rot;
    r.br={s:1+1.6*st*Math.max(k,0.5),a:1};r.lid=0.25*wu;return r},

  hit:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.35:1,q=sm(t/0.08)*(1-sm((t-0.12)/0.45));
    r.dx-=0.06*P.h*q*k;r.rot-=0.05*q*k;r.neck.rot-=0.22*q*k;r.head.rot-=0.2*q*k;
    r.lid=env(t,0.02,0.06,0.22,0.32);r.tail.lift+=0.2*q*k;r.wings.sy-=0.15*q;r.wings.fsy-=0.15*q;r.sy*=1-0.012*q;return r},

  victory:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.3:1,up=env(t,0.05,0.45,1.4,1.9);
    r.pv=0;r.rot-=0.22*up*k;
    /* передние лапы отрываются от земли и поджимаются, задние стоят */
    const nf=neutralFeet(A,A.x),tuck=Object.assign({},nf,tuckFeet(A,r,{FF:[-0.55,0.72,0.5],NF:[-0.6,0.7,0.5]}));
    r.feet=mixFeet(nf,tuck,up);
    const fl=0.35*up*(0.5+0.5*Math.cos(TAU*t*1.6))*Math.max(k,0.4);
    r.wings.sy=1+0.08*up-fl;r.wings.fsy=r.wings.sy;r.wings.rot=-0.1*up*k;r.wings.frot=r.wings.rot;
    r.neck.lift+=0.12*up*k;r.head.rot-=0.2*up*k;r.br={s:1+1.2*bump(t,0.85,1.3)*Math.max(k,0.5),a:1};
    r.tail.lift+=0.2*up*k;r.tail.amp*=1+0.5*up;r.lid=0;return r},

  defeat:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.35:1,down=sm((t-0.35)/0.95);
    r.dx-=0.05*P.h*bump(t,0,0.45)*k;r.head.rot+=0.12*Math.sin(TAU*t*3)*env(t,0,0.1,0.3,0.45)*k;
    lie(A,r,down,0.9,P.h*0.02);r.lid=Math.max(r.lid,sm((t-0.6)/0.6));
    r.wings.sy-=0.4*down;r.wings.fsy-=0.4*down;r.wings.rot=-0.16*down;r.wings.frot=-0.16*down;
    r.tail.lift-=0.2*down;r.tail.amp*=1-0.7*down;r.adapt=1-down;return r},

  defeated:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,sigh=bump(frac(tau/5.3),0.55,0.85);
    r.sy=1+(r.sy-1)*0.6;r.dy*=0.5;lie(A,r,1,0.9,P.h*0.02);r.lid=1;r.neck.rot-=0.06*sigh;
    r.wings.sy=0.6;r.wings.fsy=0.6;r.wings.rot=-0.16;r.wings.frot=-0.16;
    r.tail.lift-=0.2;r.tail.amp*=0.3;r.adapt=0;return r},

  sleep:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.3:1,br=Math.sin(TAU*tau/(P.breathT*1.5));
    r.dx=0;r.dy=-0.5*br*k;r.sy=1+0.022*br*k;r.sx=1+0.007*br*k;
    lie(A,r,1,0.85,0);r.lid=1;r.head.rot+=0.03*br*k;
    r.wings.sy=0.62;r.wings.fsy=0.62;r.wings.rot=-0.1;r.wings.frot=-0.1;
    r.tail.lift=-0.16;r.tail.amp*=0.3;r.adapt=0;return r},

  fly:(A,t,tau)=>{
    const r=base(A,tau),P=A.P,k=A.reduce?0.35:1,up=sm((t-0.2)/1.1),alt=P.h*1.15*up*(A.reduce?0.6:1);
    const w=stroke(frac(tau/P.wing.flapT)),pre=bump(t,0,0.3);
    r.dx=0;r.dy=-alt+P.h*(0.03*w*up*k+0.05*pre);r.rot=-0.03*up;
    const sy=lerp(-0.55,1.05,(w+1)/2);r.wings.sy=lerp(1,sy,clamp(up+pre,0,1)*Math.max(k,0.5));r.wings.fsy=r.wings.sy;
    r.wings.rot=-0.1*w*up*k;r.wings.frot=r.wings.rot;
    r.neck.rot+=0.12*up;r.neck.lift-=0.06*up;r.head.rot-=0.1*up;
    r.tail.lift+=0.1*up;r.tail.amp=P.tail.amp*0.7;r.tail.ph=TAU*tau/(P.tail.T*0.8);
    const tuck=tuckFeet(A,r,{FH:[0.85,0.72,0.9],NH:[0.9,0.7,0.9],FF:[0.55,0.66,0.7],NF:[0.6,0.64,0.7]});
    r.feet=mixFeet(neutralFeet(A,A.x),tuck,up);
    r.gr={s:1-0.45*up,a:1-0.55*up};r.adapt=1-up;return r}
};

/* смешать две позы покадрово; стопа, которая переезжает далеко, по дороге поднимается (шаг, а не скольжение) */
function mixObj(a,b,w){
  const o={};
  for(const key of Object.keys(b)){const x=a[key],y=b[key];
    o[key]=typeof y==='number'?lerp(typeof x==='number'?x:y,y,w):(y&&typeof y==='object'&&x&&typeof x==='object')?mixObj(x,y,w):y}
  return o}
function blendRaw(a,b,w,A){
  const o=mixObj(a,b,w);
  /* стопа, которая стоит в обеих позах на одном месте, так и стоит; остальные идут по дуге вокруг места крепления лапы,
     а не по прямой: иначе на полпути лапа сжималась бы почти в точку */
  const Ba=bodyMat(A,a),Bb=bodyMat(A,b),Bw=bodyMat(A,o);
  o.feet={};LEGS.forEach(L=>{const g=A.P.legs[L],p=a.feet[L],q=b.feet[L],d=Math.hypot(q[0]-p[0],q[1]-p[1]);let x,y;
    if(d<0.5){x=lerp(p[0],q[0],w);y=lerp(p[1],q[1],w)}
    else{const va=sub(p,app(Ba,g.a)),vb=sub(q,app(Bb,g.a)),aa=Math.atan2(va[1],va[0]);let da=Math.atan2(vb[1],vb[0])-aa;
      da-=TAU*Math.round(da/TAU);const ang=aa+da*sm(w),l=lerp(len(va),len(vb),sm(w)),c=app(Bw,g.a);x=c[0]+Math.cos(ang)*l;y=c[1]+Math.sin(ang)*l}
    const lift=A.P.lift*Math.min(1,Math.abs(q[0]-p[0])/(0.25*A.P.h))*Math.sin(Math.PI*w);
    o.feet[L]=[x,Math.min(y,g.g)-lift,lerp(p[2],q[2],w)]});
  return o}

/* ---------- решение позы: матрицы частей ---------- */
const MAXS=1.04,MAXF=1.05;   /* лапа выпрямляется не больше чем на 4 %, дальше туловище само опускается; больше 5 % не бывает никогда */
function solve(A,r){
  const R=A.R,P=A.P;
  let B=bodyMat(A,r);
  const FM={},ank={};
  LEGS.forEach(L=>{const g=P.legs[L],f=r.feet[L];FM[L]=mul(T(f[0],f[1]),Rot(f[2],null));FM[L]=mul(FM[L],T(-g.toe[0],-g.toe[1]));ank[L]=app(FM[L],g.h)});
  if(r.adapt>0.01){
    const need=L=>{const g=P.legs[L],d=sub(ank[L],app(B,g.a)),mx=Math.min(g.l*MAXS,g.reach),avail=Math.sqrt(Math.max(0,mx*mx-d[0]*d[0]));return Math.max(0,d[1]-avail)};
    const dH=Math.max(need('NH'),need('FH')),dF=Math.max(need('NF'),need('FF'));
    if(dH>0||dF>0){const Lb=R.sh[0]-R.hip[0],m=app(B,R.mid);B=mul(T(0,r.adapt*(dH+dF)/2),mul(Rot(r.adapt*Math.atan2(dF-dH,Lb),m),B))}}
  const rho=Math.atan2(B[1],B[0]),c=Math.cos(-rho),s=Math.sin(-rho),legs={},mat={};
  LEGS.forEach(L=>{const g=P.legs[L],Wa=app(B,g.a);let t=sub(ank[L],Wa);
    /* туловище ушло выше, чем достаёт лапа (прыжок, взлёт): стопа отрывается от земли и идёт за ним */
    const lt=len(t),mx=Math.min(g.l*MAXF,g.reach);if(lt>mx){const k=mx/lt,d=sub(mulv(t,k),t);t=mulv(t,k);FM[L]=mul(T(d[0],d[1]),FM[L])}
    const tl=[t[0]*c-t[1]*s,t[0]*s+t[1]*c];
    /* бедро: угол у тазобедренного сустава по теореме косинусов, колено в ту же сторону, что в покое.
       Короче |l1 − l2| лапа не складывается (так глубоко она не садится ни в одной позе) */
    const d=clamp(len(tl),Math.abs(g.l1-g.l2)+0.5,g.l1+g.l2-1e-6),al=Math.acos(clamp((g.l1*g.l1+d*d-g.l2*g.l2)/(2*g.l1*d),-1,1));
    const v1=sub(g.k,g.a),dirT=Math.atan2(tl[1],tl[0])+g.bend*al,th1=dirT-Math.atan2(v1[1],v1[0]);
    const kn=add(g.a,app(Rot(th1),v1)),v2=sub(g.h,g.k),sh=sub(tl,sub(kn,g.a)),th2=Math.atan2(sh[1],sh[0])-Math.atan2(v2[1],v2[0])-th1;
    const th=Math.atan2(cross(g.v0,tl),dot(g.v0,tl)),sy=len(tl)/g.l;
    legs[L]={sy,th,knee:th2};mat[L+'u']=mul(B,Rot(th1,g.a));mat[L+'k']=mul(mat[L+'u'],Rot(th2,g.k));mat[L+'f']=FM[L]});
  const tail=Object.assign({},r.tail),neck=Object.assign({},r.neck),head=r.head;
  /* хвост и шея у разреза идут вместе с туловищем (и его дыханием), их поворот — изгиб (curl) */
  const BT=mul(B,Sc(r.sx,r.sy,R.mid)),TB=BT,NB=BT;
  const headOf=NB=>mul(NB,mul(colMat(P.neckAx,neck,P.neckAx.L),mul(Rot(head.rot,R.head),T(head.dx,head.dy))));
  /* голова от туловища без дыхания: дыхание не меняет её размер (сдвиг конца шеи от дыхания меньше 0,3 ед., голова его перекрывает) */
  let H=headOf(B);
  /* под землю не уходят ни хвост, ни голова: если ушли, хвост приподнимается, шея поворачивается вверх */
  const tailLow=TB=>{let y=-1e9,far=1;R.tailS.forEach(p=>{const u=dot(sub(p,P.tailAx.c),P.tailAx.a),q=app(TB,app(colMat(P.tailAx,tail,Math.max(0,u)),p));if(q[1]>y){y=q[1];far=Math.max(8,Math.abs(u))}});return {y,far}};
  for(let i=0;i<3;i++){const lo=tailLow(TB);if(lo.y<=-0.3)break;tail.rot+=(lo.y+0.3)/lo.far}
  for(let i=0;i<3;i++){let y=-1e9;R.headLow.forEach(p=>{y=Math.max(y,app(H,p)[1])});if(y<=-0.3)break;
    neck.rot-=(y+0.3)/Math.max(10,len(sub(R.headLow[1],R.neckCut.p)));H=headOf(B)}
  const wing=(rt,sy)=>mul(B,mul(T(R.root[0],R.root[1]),mul(Rot(rt),mul(Sc(1,sy),T(-R.root[0],-R.root[1])))));
  Object.assign(mat,{ground:mul(T(r.x+r.dx,0),Sc(r.gr.s,1,[(R.hip[0]+R.sh[0])/2,0])),aura:B,wingFar:wing(r.wings.frot,r.wings.fsy),
    headBack:H,tail:TB,neck:NB,trunk:BT,head:H,lid:mul(H,Sc(1,Math.max(r.lid,1e-4),R.lidTop)),
    wingNear:wing(r.wings.rot,r.wings.sy),breath:mul(H,Sc(r.br.s,r.br.s,R.mouth))});
  let food=null;
  if(r.food&&r.food.a>0.01){const m=app(H,R.mouth),st=[r.x+R.mouth[0]+0.5*P.h,R.mouth[1]-1.1*P.h],q=r.food.q;
    const p=lerpP(st,m,q);food={x:p[0],y:p[1]-0.35*P.h*Math.sin(Math.PI*q),a:r.food.a}}
  return {mat,bend:{tail,neck},alpha:{ground:r.gr.a,breath:r.br.a},lid:r.lid,legs,feet:r.feet,food,body:B,x:r.x}}

/* ---------- машина состояний ----------
   play(имя) переключает действие с плавным переходом; разовые действия сами возвращаются в покой
   (поражение переходит в «отдыхает после боя»). update(dt) двигает время и отдаёт события: hit в момент удара,
   end по окончании разового действия, land после посадки. Поза текущего кадра лежит в anim.pose. */
function Animator(M,R,opt){
  opt=opt||{};
  this.M=M;this.R=R;this.P=profile(M,R);this.reduce=!!opt.reduce;this.noPuff=!!opt.noPuff;   /* noPuff: атаку рисует attacks.js, свои клубы дыхания не нужны */
  this.rnd=rng(opt.seed==null?1:opt.seed);
  this.t=(opt.seed||0)%7;this.x=0;
  this.cur={name:'idle',t:0};this.prev=null;this.bt=0;this.bd=1;
  this.blinkAt=this.t+1+this.rnd()*2.5;this.blinkT=-1;
  this.look={v:0,to:0,at:this.t+2+this.rnd()*3};
  this.fx=[];this.events=[];this.pose=null;
  this.pose=this.compute()}
Animator.prototype.state=function(){return this.cur.name};
Animator.prototype.play=function(name,o){
  if(name==='fly'&&!this.P.canFly)name='flutter';
  if(!STATES[name])throw new Error('нет такого состояния: '+name);
  if(name===this.cur.name&&STATES[name].loop)return name;
  const from=this.cur.name;
  /* если прошлый переход ещё идёт, новый начинается от застывшей смешанной позы, без рывка */
  this.prev=this.prev?{name:'blend',t:0,snap:this.raw}:{name:this.cur.name,t:this.cur.t};this.cur={name,t:0,then:o&&o.then};this.bt=0;
  this.bd=Math.max(STATES[name].blend||0.25,from==='fly'?0.6:0,from==='sleep'||from==='defeated'?0.8:0);
  return name};
Animator.prototype.weight=function(){return this.prev?sm(this.bt/this.bd):1};
Animator.prototype.rawOf=function(s){return s.snap||POSE[s.name](this,s.t,this.t)};
Animator.prototype.compute=function(){
  let r=this.rawOf(this.cur);
  if(this.prev)r=blendRaw(this.rawOf(this.prev),r,this.weight(),this);
  if(this.blinkT>=0&&!this.P.sleepy){const b=bump(this.blinkT,0,0.18);r.lid=Math.max(r.lid,b)}
  this.raw=r;const pose=solve(this,r);pose.sprite={time:this.t,phase:this.x/this.P.stride,walk:(this.cur.name==='walk'?this.weight():0)+(this.prev&&this.prev.name==='walk'?1-this.weight():0),head:r.head.rot,wing:r.wings.sy,blink:r.lid,reduce:this.reduce};return pose};
Animator.prototype.update=function(dt){
  dt=clamp(dt||0,0,0.1);
  const ev=[],P=this.P,cur=this.cur,t0=cur.t;
  this.t+=dt;cur.t+=dt;
  if(this.prev){this.prev.t+=dt;this.bt+=dt;if(this.bt>=this.bd){if(this.prev.name==='fly')ev.push({type:'land'});this.prev=null}}
  const ww=(cur.name==='walk'?this.weight():0)+(this.prev&&this.prev.name==='walk'?1-this.weight():0);
  this.x+=P.v*ww*dt;
  const S=STATES[cur.name];
  if(S.hit!=null&&t0<S.hit&&cur.t>=S.hit)ev.push({type:'hit',state:cur.name});
  /* моргание раз в 2–6 с, иногда двойное; взгляд меняется раз в 2–6 с */
  if(this.blinkT>=0){this.blinkT+=dt;if(this.blinkT>0.18)this.blinkT=-1}
  else if(this.t>=this.blinkAt){this.blinkT=0;this.blinkAt=this.t+(this.rnd()<0.2?0.3:2+this.rnd()*4)}
  const lk=P.style.look;
  if(this.t>=this.look.at){this.look.to=(this.rnd()-0.55)*0.22*(this.reduce?0.3:1);this.look.at=this.t+(2+this.rnd()*4)/lk}
  this.look.v+=(this.look.to-this.look.v)*(1-Math.exp(-dt*3*lk));
  this.pose=this.compute();
  this.spawn(t0,cur.t,ww,dt);
  this.fx=this.fx.filter(p=>{p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g||0)*dt;return p.age<p.life});
  if(!S.loop&&cur.t>=S.d){ev.push({type:'end',state:cur.name});this.play(S.next||cur.then||'idle')}
  return ev};
/* частицы в мире: дыхание при ударе, искры от удара, пыль от тяжёлых шагов и посадки, буквы z во сне, крошки еды */
Animator.prototype.spawn=function(t0,t1,ww,dt){
  const P=this.P,R=this.R,pose=this.pose,n=this.cur.name,red=this.reduce,rnd=this.rnd;
  const at=a=>t0<a&&t1>=a,push=p=>{if(this.fx.length<80)this.fx.push(Object.assign({age:0,vx:0,vy:0},p))};
  const H=pose.mat.head,mouth=app(H,R.mouth),dir=unit(sub(app(H,add(R.mouth,[10,0])),mouth));
  if(n==='attack'&&!P.sleepy&&!this.noPuff&&t1>0.48&&t0<0.66&&Math.floor(t1/0.03)!==Math.floor(t0/0.03)){
    const sp=P.h*(2.2+rnd()),a=(rnd()-0.5)*0.5;
    push({k:'puff',x:mouth[0],y:mouth[1],vx:(dir[0]*Math.cos(a)-dir[1]*Math.sin(a))*sp,vy:(dir[0]*Math.sin(a)+dir[1]*Math.cos(a))*sp,r:P.h*0.05,grow:P.h*0.3,life:red?0.3:0.5})}
  if(n==='hit'&&at(0.02)&&!red){const c=app(pose.body,[R.sh[0]+R.neckCut.r*0.8,R.sh[1]]);for(let i=0;i<6;i++){const a=rnd()*TAU;push({k:'spark',x:c[0],y:c[1],vx:Math.cos(a)*P.h*1.4,vy:Math.sin(a)*P.h*1.4,r:P.h*0.06,life:0.35})}}
  if(n==='eat'&&at(0.75)){for(let i=0;i<5;i++){push({k:'crumb',x:mouth[0],y:mouth[1],vx:(rnd()-0.3)*P.h*0.8,vy:-rnd()*P.h*0.6,g:P.h*4,r:P.h*0.02,life:0.6})}}
  if(n==='sleep'&&this.cur.t>1&&Math.floor(this.t/1.8)!==Math.floor((this.t-dt)/1.8)){const c=app(H,add(R.eye,[-R.eyeR,-R.eyeR*2]));push({k:'z',x:c[0],y:c[1],vx:P.h*0.12,vy:-P.h*0.25,r:P.h*0.09,life:2.2})}
  /* пыль: у тяжёлых драконов при каждой постановке лапы, у всех при посадке */
  const dust=(x,y,m)=>{if(red)return;for(let i=0;i<m;i++)push({k:'dust',x:x+(rnd()-0.5)*P.h*0.2,y,vx:(rnd()-0.5)*P.h*0.5,vy:-rnd()*P.h*0.12,r:P.h*0.05,grow:P.h*0.15,life:0.7})};
  if(ww>0.5&&P.hv>0.55&&P.mass>0.6){const ph0=(this.x-P.v*ww*dt)/P.stride,ph1=this.x/P.stride;
    LEGS.forEach(L=>{if(Math.floor(ph0+OFF[L])!==Math.floor(ph1+OFF[L])){const f=pose.feet[L];dust(f[0],P.legs[L].g,2)}})}
  if(this.prev&&this.prev.name==='fly'&&this.bt>=this.bd*0.85&&this.bt-dt<this.bd*0.85)LEGS.forEach(L=>{const f=pose.feet[L];dust(f[0],P.legs[L].g,2)})};

const ANIM={profile,Animator,STATES,POSE,LEGS,OFF,MOVE,styleOf,phi,rotAt,RAMP,curl,colMat,solve,MAT,G0};
if(typeof module!=='undefined'&&module.exports)module.exports=ANIM;else root.ANIM=ANIM;
})(typeof window!=='undefined'?window:globalThis);
