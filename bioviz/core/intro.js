/* Вступление на главной: Cas9 находит мишень на двойной спирали ДНК и режет её, из разреза раскрывается главная.
   Всё рисуется на одном холсте (canvas 2D), без WebGL и без загрузки из сети, поэтому идёт плавно и на слабых телефонах.
   Схема держится фактов из учебников и статей о Cas9 S. pyogenes:
   - B-ДНК правозакрученная, около 10,5 пары оснований на виток, у спирали большая и малая бороздки;
   - Cas9 перебирает участки с PAM 5′-NGG-3′ на нецелевой цепи; без совпадения с РНК рядом с PAM отпускает ДНК;
   - направляющая РНК (20 нт) спаривается с целевой цепью, R-петля растёт от PAM к дальнему краю, вторая цепь вытесняется;
   - HNH режет целевую цепь, RuvC нецелевую, обе в одном месте за 3 п.н. до PAM, концы тупые.
   Полная версия (около 9 с) идёт при первом заходе за день, потом короткая (около 1,4 с). Всегда есть «Пропустить».
   При «уменьшить движение» вступления нет. */
(function(){
const {$,$$,store}=BV,R=BVHOST.root;

/* та же мишень, что в карточке на главной: 3 нт фланга, протоспейсер 20 нт, PAM AGG, 3 нт фланга */
const FL1='TCA',GUIDE='GCTGACGTCAATGGCATCGA',PAM='AGG',FL2='CTT',TOP=FL1+GUIDE+PAM+FL2;
const CMP={A:'T',T:'A',G:'C',C:'G'};
/* цвета сцены: сцена всегда тёмная, как в кино, поэтому цвета яркие и одинаковые в обеих темах */
const NC={A:'#4ADE80',T:'#FF6B6B',G:'#FFD166',C:'#5AB0FF',U:'#FF6B6B'};
const K={nt:'#A7F3D0',ts:'#93C5FD',rna:'#FF9E5E',cas:'#34D399',pam:'#FFD166',hnh:'#B79CFF',ruvc:'#F5B942',no:'#FF8F8F',ink:'#E8F5EE',mut:'#8FB8A3'};
const TW=2*Math.PI/10.5;   /* поворот на одну пару оснований */
const GROOVE=2.3;          /* сдвиг второй цепи по фазе: так видны большая и малая бороздки */

const STYLE=`
.intro{position:fixed;inset:0;z-index:1000;overflow:hidden;background:radial-gradient(120% 90% at 50% 38%,#0E2A1D 0%,#071710 55%,#030A06 100%);transition:opacity .6s ease}
.intro canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
/* туманность за спиралью: три мягких пятна плывут сами, их двигает видеокарта, а не скрипт */
.in-neb{position:absolute;inset:0;opacity:0;animation:inNeb 1.4s ease .1s forwards}
.in-neb i{position:absolute;width:90vmax;height:90vmax;border-radius:50%;will-change:transform;animation:inDrift 9s ease-in-out infinite alternate}
.in-neb i:nth-child(1){left:-25vmax;top:-30vmax;background:radial-gradient(closest-side,rgba(15,163,107,.30),transparent)}
.in-neb i:nth-child(2){right:-30vmax;top:-22vmax;background:radial-gradient(closest-side,rgba(109,75,216,.20),transparent);animation-duration:11s;animation-direction:alternate-reverse}
.in-neb i:nth-child(3){left:5vmax;bottom:-55vmax;background:radial-gradient(closest-side,rgba(217,139,43,.14),transparent);animation-duration:13s}
@keyframes inNeb{to{opacity:1}}
@keyframes inDrift{from{transform:translate(0,0) scale(1)}to{transform:translate(6vmax,3vmax) scale(1.08)}}
.intro.out{opacity:0;pointer-events:none}
.in-cap{position:absolute;left:50%;bottom:max(13vh,96px);transform:translateX(-50%);width:min(66ch,calc(100vw - 40px));text-align:center;text-wrap:balance;
  display:flex;flex-direction:column;gap:8px;align-items:center;color:${K.ink};transition:opacity .28s ease,transform .5s cubic-bezier(.2,.8,.2,1)}
.in-cap b{font:var(--dw,600) clamp(19px,2.4vw,30px)/1.2 var(--font-display);letter-spacing:-.01em;text-shadow:0 2px 24px rgba(0,0,0,.6)}
.in-cap small{font-size:clamp(13px,1.3vw,15.5px);line-height:1.5;color:${K.mut};max-width:56ch}
.in-cap.fade{opacity:0;transform:translate(-50%,6px)}
.in-skip{position:fixed;z-index:1001;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));height:40px;padding:0 16px;border-radius:999px;
  border:1px solid rgba(167,243,208,.28);background:rgba(8,24,16,.72);color:${K.ink};font:600 14px/1 var(--font-body);cursor:pointer;display:inline-flex;align-items:center;gap:8px;
  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);transition:opacity .3s,border-color .2s}
.in-skip:hover{border-color:${K.cas}}
.in-skip:focus-visible{outline:2px solid ${K.cas};outline-offset:2px}
.in-skip kbd{font:500 11px/1 var(--font-mono);color:${K.mut};border:1px solid rgba(167,243,208,.25);border-radius:4px;padding:3px 5px}
@media (pointer:coarse){.in-skip kbd{display:none}}
.in-bar{position:fixed;left:0;top:0;height:2px;background:linear-gradient(90deg,${K.cas},${K.pam},${K.rna});width:0;z-index:1001;transition:width linear;box-shadow:0 0 12px ${K.cas}}
.from-cut{animation:inCard .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * 45ms)}
@keyframes inCard{from{transform:translate(var(--dx),var(--dy)) scale(.3);opacity:0;filter:blur(6px)}60%{opacity:1;filter:none}to{transform:none;opacity:1}}
`;
{const st=document.createElement('style');st.textContent=STYLE;R.appendChild(st)}

const today=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const isHome=()=>/^#?\/?$/.test(location.hash||'');
const cl=(v,a=0,b=1)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const eOut=t=>1-Math.pow(1-t,3),eIn=t=>t*t*t;
/* доля пройденного участка [a,b] времени T */
const seg=(T,a,b)=>cl((T-a)/(b-a));

/* светящееся пятно: заранее нарисованный радиальный градиент, рисовать его дёшево */
const GL=new Map();
function glow(c){if(GL.has(c))return GL.get(c);const s=64,cv=document.createElement('canvas');cv.width=cv.height=s;const g=cv.getContext('2d');
  const gr=g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);gr.addColorStop(0,c);gr.addColorStop(.25,c+'AA');gr.addColorStop(1,c+'00');g.fillStyle=gr;g.fillRect(0,0,s,s);GL.set(c,cv);return cv}

function run(full){
  const el=document.createElement('div');el.className='intro';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<div class="in-neb"><i></i><i></i><i></i></div><canvas></canvas>${full?'<div class="in-cap fade"><b></b><small></small></div>':''}`;
  const skip=document.createElement('button');skip.type='button';skip.className='in-skip';skip.innerHTML='Пропустить <kbd>Esc</kbd>';
  const bar=document.createElement('div');bar.className='in-bar';
  R.appendChild(el);R.appendChild(skip);R.appendChild(bar);
  const html=document.documentElement,ov=html.style.overflow;html.style.overflow='hidden';
  const cv=$('canvas',el),g=cv.getContext('2d'),cap=$('.in-cap',el);

  /* ---------- размеры ---------- */
  let W=0,H=0,dpr=1,mob=false,NB=0,PAD=0,S0=0,G0=0,P0=0,CUT=0,DEC=0,dx=0,X0=0,cy=0,A=0,seq=[],fs=12;
  function layout(){W=innerWidth;H=innerHeight;mob=W<700;dpr=Math.min(window.devicePixelRatio||1,mob||(BV.mol&&BV.mol.low)?1.25:2);
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);g.setTransform(dpr,0,0,dpr,0,0);
    PAD=full?(mob?3:9):(mob?4:10);NB=TOP.length+2*PAD;S0=PAD;G0=S0+FL1.length;P0=G0+GUIDE.length;CUT=P0-3;DEC=S0+TOP.indexOf('TGG');
    dx=Math.min((W-(mob?28:120))/(NB-1),30);X0=(W-dx*(NB-1))/2;
    cy=full?H*(mob?.36:.38):H*.46;A=Math.min(full?H*.1:H*.12,mob?46:96,dx*3.4);fs=Math.max(9,Math.min(dx*.9,17));
    /* фланги вне мишени: фиксированная псевдослучайная последовательность */
    if(seq.length!==NB){let r=7;const rnd=()=>(r=(r*16807)%2147483647)/2147483647;const B='ACGT';
      const L=[...Array(PAD)].map(()=>B[Math.floor(rnd()*4)]),Rr=[...Array(PAD)].map(()=>B[Math.floor(rnd()*4)]);seq=[...L,...TOP,...Rr]}}
  layout();
  const onRs=()=>layout();addEventListener('resize',onRs);

  /* ---------- частицы ---------- */
  const pal=[NC.A,NC.T,NC.G,NC.C,K.cas,K.rna];
  const dust=[...Array(mob?34:80)].map(()=>({x:Math.random(),y:Math.random(),r:.6+Math.random()*1.8,v:.004+Math.random()*.012,a:.15+Math.random()*.35,c:pal[Math.floor(Math.random()*pal.length)],ph:Math.random()*6.3}));
  let burst=[];
  function boom(x,y,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(.25+Math.random())*sp;burst.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v*.7,life:1,d:.008+Math.random()*.018,r:1+Math.random()*2.6,c:pal[Math.floor(Math.random()*pal.length)]})}}
  const rings=[];/* ударные волны: {x,y,t0,c,max} */

  /* ---------- сценарий ---------- */
  const F={reveal:[0,900],casIn:[900,1250],toDec:[1050,2050],dec:[2050,3150],toPam:[3150,4000],lock:4000,rl:[4350,5950],cut:6150,split:[7250,8450],fade:[7650,8450],end:8800};
  const Sh={reveal:[0,520],casIn:[300,420],cut:560,split:[680,1180],fade:[760,1260],end:1400};
  const P=full?F:Sh,TOTAL=P.end;
  const CAPS=full?[[250,'Cas9 ищет на ДНК метку PAM','Это короткий участок 5′-NGG-3′ на нецелевой цепи. Без него Cas9 мишень не узнаёт.'],
    [2150,'Здесь PAM есть, но мишени нет','РНК не совпадает с ДНК рядом с этим TGG, и Cas9 отпускает ДНК.'],
    [3950,'PAM 5′-AGG-3′, и рядом совпадение','Домен PI держит PAM, и Cas9 начинает расплетать ДНК прямо за ним.'],
    [4500,'Направляющая РНК спаривается с целевой цепью','20 нуклеотидов, начиная от PAM. Вторая цепь вытесняется, получается R-петля.'],
    [6100,'HNH режет целевую цепь, RuvC вторую','Обе в одном месте, за 3 пары оснований до PAM. Концы получаются тупые.'],
    [7250,'','']]:[];
  let capI=-1;
  function caption(T){if(!cap)return;let i=-1;CAPS.forEach((c,j)=>{if(T>=c[0])i=j});if(i===capI)return;capI=i;
    cap.classList.add('fade');const c=CAPS[i];setTimeout(()=>{if(!c||!c[1])return;$('b',cap).textContent=c[1];$('small',cap).textContent=c[2];cap.classList.remove('fade')},i===0?0:220)}

  /* положение Cas9 (номер пары оснований в центре) */
  function casPos(T){if(!full)return CUT;
    const a=S0-6,d=DEC-5,p=P0-4;
    if(T<P.toDec[0])return a;
    if(T<P.toDec[1])return lerp(a,d,ease(seg(T,...P.toDec)));
    if(T<P.toPam[0])return d+Math.sin((T-P.dec[0])/90)*.12*seg(T,P.dec[0]+600,P.dec[1]);
    return lerp(d,p,ease(seg(T,...P.toPam)))}
  /* раскрытие R-петли для пары i: от PAM к дальнему краю протоспейсера */
  function openU(i,T){if(!full)return 0;if(i===G0-1)return .3*openU(G0,T);if(i<G0||i>=P0)return 0;const k=P0-1-i;return eOut(seg(T,P.rl[0]+k*55,P.rl[0]+k*55+520))}
  function rnaU(i,T){if(!full)return 0;if(i<G0||i>=P0)return 0;const k=P0-1-i;return eOut(seg(T,P.rl[0]+260+k*55,P.rl[0]+260+k*55+460))}

  /* точка цепи s (0 нецелевая, 1 целевая, 2 РНК) в дробной позиции f */
  let rot=0,splitS=0;
  function pt(s,f,T){const i0=Math.floor(f),u=full?lerp(openU(i0,T),openU(i0+1,T),f-i0):0;
    const th=f*TW+rot+(s===1?GROOVE:0);
    let x=X0+f*dx,y=cy+A*Math.sin(th),z=Math.cos(th);
    const bub=Math.sin(Math.PI*cl((f-G0+.8)/(P0-G0+.8)));
    if(u>0){const yf=s===0?cy-A*(.95+.6*bub):cy+A*(.5+.18*bub);y=lerp(y,yf,u);z=lerp(z,.75,u)}
    if(s===2){y=cy+A*(.5+.18*bub)-A*.62;z=.85}
    if(splitS){const sd=f<CUT-.5?-1:1;x+=sd*splitS;y+=sd*splitS*.08*(s===0?-1:1)}
    return{x,y,z}}

  /* ---------- кадр ---------- */
  const t0=performance.now();let skipAt=0,raf=0,last=t0,opened=false,ended=false,cutFx=false;
  const clock=now=>skipAt?Math.max(P.split[0],(skipAt.T))+(now-skipAt.n):now-t0;
  requestAnimationFrame(()=>{bar.style.transitionDuration=TOTAL+'ms';bar.style.width='100%'});

  const MONO=(getComputedStyle(BVHOST.host).getPropertyValue('--font-mono')||'').trim()||'monospace';
  function tag(text,x,y,bg,fg,alpha){if(alpha<=0)return;g.save();g.globalAlpha=alpha;g.font=`600 ${Math.round(fs*.78)}px ${MONO}`;
    const w=g.measureText(text).width+fs*1.1,h=fs*1.55;g.fillStyle=bg;rr(x-w/2,y-h/2,w,h,h/2.4);g.fill();g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.fillText(text,x,y+.5);g.restore()}
  function rr(x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
  function dot(x,y,r,c,a){if(a<=0)return;g.globalAlpha=a;const s=r*4;g.drawImage(glow(c),x-s/2,y-s/2,s,s)}

  /* линии одного вида собираются в один путь: на телефоне это в разы меньше вызовов отрисовки */
  const BT=new Map();
  const q=v=>Math.round(v*8)/8;
  function seg2(key,col,a,w,op,cap,x1,y1,x2,y2){if(a<=.01)return;const k=key+col+q(a)+'|'+q(w)+op;let b=BT.get(k);if(!b){b={col,a:q(a),w:q(w),op,cap,p:[]};BT.set(k,b)}b.p.push(x1,y1,x2,y2)}
  function flush(){BT.forEach(b=>{g.globalCompositeOperation=b.op;g.globalAlpha=b.a;g.strokeStyle=b.col;g.lineWidth=b.w;g.lineCap=b.cap;g.beginPath();
    for(let i=0;i<b.p.length;i+=4){g.moveTo(b.p[i],b.p[i+1]);g.lineTo(b.p[i+2],b.p[i+3])}g.stroke()});BT.clear();g.globalCompositeOperation='source-over'}
  function frame(now){raf=0;if(ended)return;const T=clock(now),dt=Math.min(50,now-last);last=now;
    caption(T);
    const rev=ease(seg(T,...P.reveal)),fadeAll=1-seg(T,...P.fade);
    /* вращение спирали: быстрое на входе, замедляется при узнавании PAM и почти стоит в R-петле */
    const sp=full?(T<P.lock?.0011:T<P.rl[0]?lerp(.0011,.0003,seg(T,P.lock,P.rl[0])):lerp(.0003,.00012,seg(T,P.rl[0],P.rl[1]))):.0042*(1-seg(T,Sh.casIn[0],Sh.cut)*.85);
    rot-=sp*dt;
    const sx=full?eIn(seg(T,...P.split)):eIn(seg(T,...P.split));splitS=sx*W*.62;
    g.clearRect(0,0,W,H);
    /* наезд камеры: спираль подлетает из глубины */
    const zm=full?lerp(1.35,1,ease(seg(T,0,1500))):lerp(1.5,1,eOut(seg(T,0,520)));
    g.save();g.translate(W/2,cy);g.scale(zm,zm);g.translate(-W/2,-cy);

    /* пыль */
    g.globalCompositeOperation='lighter';
    dust.forEach(d=>{d.y-=d.v*dt/1000*3;if(d.y<-.05)d.y=1.05;const tw=.6+.4*Math.sin(now/700+d.ph);dot(d.x*W,d.y*H,d.r,d.c,d.a*tw*(.4+.6*rev))});

    /* видимая часть спирали: при первом заходе вырастает слева направо, в короткой версии из центра */
    const vis=i=>full?cl(rev*(NB+6)-i,0,1):cl(rev*(NB/2+4)-Math.abs(i-(NB-1)/2),0,1);

    /* Cas9: мягкое изумрудное облако */
    const casA=full?(seg(T,...P.casIn)*(1-seg(T,P.split[0],P.split[0]+500))):eOut(seg(T,...Sh.casIn))*(1-seg(T,Sh.split[0],Sh.split[0]+300));
    const cp=casPos(T),cx=X0+cp*dx;
    if(casA>0){const rx=dx*(full&&T>P.rl[0]?lerp(7,13,seg(T,P.rl[0],P.rl[1]-600)):7),ry=A*1.95;
      const lockP=full?seg(T,P.lock,P.lock+600):0,pulse=1+.05*Math.sin(now/260);
      const ox=full&&T>P.rl[0]?lerp(cx,X0+((G0+P0)/2+1.5)*dx,seg(T,P.rl[0],P.rl[1]-600)):cx;
      /* у Cas9 две доли: REC (узнавание) и NUC (с доменами HNH, RuvC и PI); облако двухдольное и чуть дышит */
      const lobe=(oy,sc,a1)=>{g.save();g.translate(ox+Math.sin(now/530+oy)*dx*.15,cy+oy*ry+Math.cos(now/610+oy)*A*.03);g.scale(rx/ry*pulse*sc,pulse*sc*.72);
        const gr=g.createRadialGradient(0,0,0,0,0,ry);gr.addColorStop(0,`rgba(60,230,165,${a1*casA})`);gr.addColorStop(.4,`rgba(40,190,135,${a1*.75*casA})`);gr.addColorStop(1,'rgba(52,211,153,0)');
        g.fillStyle=gr;g.beginPath();g.arc(0,0,ry,0,6.283);g.fill();g.restore()};
      g.globalCompositeOperation='lighter';lobe(-.4,.82,.62+.16*lockP);lobe(.4,.9,.56+.16*lockP);g.globalCompositeOperation='source-over';
      g.save();g.translate(ox,cy);g.scale(rx/ry*pulse,pulse);
      g.globalAlpha=casA*(.45+.3*lockP);g.strokeStyle=K.cas;g.lineWidth=1.4/(rx/ry);g.setLineDash([3,7]);g.lineDashOffset=-now/40;g.beginPath();g.arc(0,0,ry*.92,0,6.283);g.stroke();g.restore()}

    /* сначала задние участки цепей, потом пары оснований, потом передние участки */
    g.globalCompositeOperation='source-over';
    const STEP=mob?.34:.25;
    const strand=(s,col,front)=>{
      for(let f=0;f<NB-1;f+=STEP){const a=pt(s,f,T),b=pt(s,f+STEP,T);const z=(a.z+b.z)/2;if(front?z<0:z>=0)continue;
        const v=Math.min(vis(f),vis(f+STEP));if(v<=0)continue;
        /* место разреза: после него цепь разорвана */
        if(cutFx&&f<CUT-.5&&f+STEP>CUT-.5&&(s===0||s===1))continue;
        seg2('s',col,v*fadeAll*(front?.95:.32),front?(mob?2.6:3.6)*(.75+.25*z):(mob?1.6:2.2),'source-over','round',a.x,a.y,b.x,b.y);
        if(front)seg2('g',col,v*fadeAll*.12*(.5+.5*z),mob?8:12,'lighter','butt',a.x,a.y,b.x,b.y)}
      flush()};
    strand(0,K.nt,false);strand(1,K.ts,false);

    /* пары оснований: две половинки своих цветов; в R-петле пара ДНК разошлась, а РНК спарилась с целевой цепью */
    for(let i=0;i<NB;i++){const v=vis(i)*fadeAll;if(v<=0)continue;
      const a=pt(0,i,T),b=pt(1,i,T),u=openU(i,T),ru=rnaU(i,T),z=(a.z+b.z)/2;
      const bt=seq[i],bb=CMP[bt];
      const pam=full&&i>=P0&&i<P0+3&&T>P.lock,dec=full&&i>=DEC&&i<DEC+3&&T>P.dec[0]&&T<P.dec[1];
      const wide=mob?2.4:3.4;
      if(u<.98){const al=v*(1-u)*(.35+.5*(z*.5+.5)),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
        seg2('r',pam?K.pam:NC[bt],al,wide,'source-over','butt',a.x,a.y,mx,my);seg2('r',NC[bb],al,wide,'source-over','butt',mx,my,b.x,b.y)}
      if(ru>0){const r=pt(2,i,T);const rb=bt==='T'?'U':bt,mm=(r.y+b.y)/2;
        seg2('r',NC[rb],v*ru*.9,wide,'source-over','butt',r.x,r.y,r.x,mm);seg2('r',NC[bb],v*ru*.9,wide,'source-over','butt',r.x,mm,b.x,b.y)}
      /* основания вытесненной цепи висят одиночными */
      if(u>.05){g.globalAlpha=v*u*.85;g.fillStyle=NC[bt];g.beginPath();g.arc(a.x,a.y+A*.16,mob?1.8:2.4,0,6.283);g.fill()}
      if(pam||dec){g.globalCompositeOperation='lighter';dot((a.x+b.x)/2,(a.y+b.y)/2,mob?7:11,pam?K.pam:K.no,v*(pam?.55+.25*Math.sin(now/180):.45));g.globalCompositeOperation='source-over'}}

    flush();
    /* РНК: оранжевая нить растёт от PAM */
    if(full&&T>P.rl[0]){g.strokeStyle=K.rna;g.lineCap='round';g.lineWidth=mob?2.6:3.6;
      for(let f=G0;f<P0-1;f+=STEP){const u=Math.min(rnaU(Math.floor(f),T),rnaU(Math.ceil(f),T));if(u<=0)continue;const a=pt(2,f,T),b=pt(2,f+STEP,T);
        g.globalAlpha=u*fadeAll;g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke()}
      /* 3′-конец спейсера переходит в каркас направляющей РНК, его держит Cas9: каркас отходит со стороны PAM */
      const u0=rnaU(P0-1,T);if(u0>0){const a=pt(2,P0-1,T);g.globalAlpha=u0*fadeAll*.9;g.beginPath();g.moveTo(a.x,a.y);
        g.bezierCurveTo(a.x+dx*1.6,a.y-A*.1,a.x+dx*2.4,a.y-A*.9,a.x+dx*1.2,a.y-A*1.05);g.stroke()}}

    strand(0,K.nt,true);strand(1,K.ts,true);
    if(full&&T>P.rl[0])strand(0,K.nt,true);

    /* свечение передних точек цепей */
    g.globalCompositeOperation='lighter';
    for(let i=0;i<NB;i+=1){const v=vis(i)*fadeAll;if(v<=0)continue;for(const s of [0,1]){const p=pt(s,i,T);if(p.z>.2)dot(p.x,p.y,mob?2.2:3,s?K.ts:K.nt,v*.35*p.z)}}
    g.globalCompositeOperation='source-over';

    /* строка последовательности под спиралью (только в полной версии) */
    if(full){const ly=cy+A*(mob?2.25:2.15),la=seg(T,300,1100)*fadeAll*(1-seg(T,P.split[0],P.split[0]+300));
      if(la>0){g.font=`600 ${Math.round(fs)}px ${MONO}`;g.textAlign='center';g.textBaseline='middle';
        for(let i=S0;i<S0+TOP.length;i++){const x=X0+i*dx;const inT=i>=G0&&i<P0,isP=i>=P0&&i<P0+3;
          if(isP&&T>P.lock){g.globalAlpha=la*seg(T,P.lock,P.lock+300);g.fillStyle=K.pam;rr(x-dx*.48,ly-fs*.78,dx*.96,fs*1.56,4);g.fill()}
          g.globalAlpha=la*(inT||isP?1:.45);g.fillStyle=isP&&T>P.lock?'#1A1400':NC[seq[i]];g.fillText(seq[i],x,ly)}
        g.globalAlpha=la*.6;g.fillStyle=K.mut;g.font=`500 ${Math.round(fs*.68)}px ${MONO}`;g.fillText('5′',X0+(S0-1.2)*dx,ly);g.fillText('3′',X0+(S0+TOP.length+.2)*dx,ly);
        /* под протоспейсером полоска направляющей РНК */
        const ru=seg(T,P.rl[0]+200,P.rl[0]+1300);if(ru>0){g.globalAlpha=la*.9;g.fillStyle=K.rna;const xa=X0+(P0-.5)*dx,xb=lerp(xa,X0+(G0-.5)*dx,eOut(ru));rr(xb,ly+fs*.95,xa-xb,Math.max(2,fs*.2),2);g.fill();
          if(ru>.6){g.globalAlpha=la*seg(ru,.6,1);g.font=`600 ${Math.round(fs*.66)}px ${MONO}`;g.fillText('направляющая РНК, 20 нт',(X0+(G0+P0-1)/2*dx),ly+fs*1.75)}}
        /* место разреза */
        if(T>P.cut){g.globalAlpha=la;g.strokeStyle='#FFFFFF';g.lineWidth=2;const xc=X0+(CUT-.5)*dx;g.beginPath();g.moveTo(xc,ly-fs*.9);g.lineTo(xc,ly+fs*.9);g.stroke()}}}

    /* метки */
    if(full){const fz=1-seg(T,P.split[0],P.split[0]+250);
      const dA=seg(T,P.dec[0]+150,P.dec[0]+450)*(1-seg(T,P.dec[1]-250,P.dec[1]));
      tag('TGG · нет совпадения',X0+(DEC+1)*dx,cy-A*1.75,'rgba(255,143,143,.16)',K.no,dA*fz);
      const pA=seg(T,P.lock,P.lock+300)*(1-seg(T,P.rl[0]+300,P.rl[0]+700));
      tag('PAM 5′-AGG-3′',X0+(P0+1)*dx,cy-A*1.75,K.pam,'#1A1400',pA*fz);
      tag('Cas9',cx-dx*5.2,cy-A*1.95,'rgba(52,211,153,.16)',K.cas,casA*fz*(full&&T>P.rl[0]?1-seg(T,P.rl[0],P.rl[0]+400):1));
      const cA=seg(T,P.cut,P.cut+250)*fz,xc=X0+(CUT-.5)*dx;
      tag('RuvC',xc,cy-A*2.05,K.ruvc,'#1F1500',cA);tag('HNH',xc,cy+A*1.25,K.hnh,'#160C2E',cA)}

    /* разрез: вспышка на обеих цепях ДНК в одном месте, ударная волна, искры */
    const cutT=P.cut;
    if(T>=cutT&&!cutFx){cutFx=true;const xc=X0+(CUT-.5)*dx;rings.push({x:xc,y:cy,t0:now,c:'#FFFFFF',max:Math.max(W,H)*.35});boom(xc,cy-A*.6,mob?20:40,2.2);boom(xc,cy+A*.6,mob?20:40,2.2)}
    if(full&&T>=P.lock&&!frame.lk){frame.lk=1;rings.push({x:X0+(P0+1)*dx,y:cy,t0:now,c:K.pam,max:A*3.2})}
    if(T>=P.split[0]&&!frame.sp){frame.sp=1;const xc=X0+(CUT-.5)*dx;boom(xc,cy,mob?90:190,full?4.2:3.6);rings.push({x:xc,y:cy,t0:now,c:K.cas,max:Math.hypot(W,H)*.6})}
    g.globalCompositeOperation='lighter';
    if(cutFx){const xc=X0+(CUT-.5)*dx,ft=seg(T,cutT,cutT+(full?900:300));const fl=(1-ft)*fadeAll;
      dot(xc-splitS,pt(0,CUT-.5,T).y,mob?18:28,'#FFFFFF',fl);dot(xc-splitS,pt(1,CUT-.5,T).y,mob?18:28,'#FFFFFF',fl);
      dot(xc+splitS,pt(0,CUT-.5,T).y,mob?18:28,'#FFFFFF',fl);dot(xc+splitS,pt(1,CUT-.5,T).y,mob?18:28,'#FFFFFF',fl)}
    for(let i=rings.length-1;i>=0;i--){const r=rings[i],k=(now-r.t0)/900;if(k>=1){rings.splice(i,1);continue}
      g.globalAlpha=(1-k)*.7;g.strokeStyle=r.c;g.lineWidth=2*(1-k)+.5;g.beginPath();g.arc(r.x,r.y,eOut(k)*r.max,0,6.283);g.stroke()}
    for(let i=burst.length-1;i>=0;i--){const b=burst[i];b.x+=b.vx*dt/16;b.y+=b.vy*dt/16;b.vx*=.985;b.vy*=.985;b.life-=b.d*dt/16;if(b.life<=0){burst.splice(i,1);continue}dot(b.x,b.y,b.r,b.c,b.life)}
    g.globalCompositeOperation='source-over';g.globalAlpha=1;g.restore();
    /* вспышка на весь экран в момент разлёта */
    const fl=T>=P.split[0]?1-seg(T,P.split[0],P.split[0]+(full?420:260)):0;if(fl>0){g.globalAlpha=fl*(full?.32:.22);g.fillStyle='#E9FFF4';g.fillRect(0,0,W,H);g.globalAlpha=1}

    /* карточки главной вылетают из точки разреза */
    if(!opened&&T>=P.split[0]+(full?150:40)){opened=true;el.classList.add('out');skip.style.opacity='0';html.style.overflow=ov;open(X0+(CUT-.5)*dx,cy)}
    if(T>=TOTAL){cleanup();return}
    raf=requestAnimationFrame(frame)}
  raf=requestAnimationFrame(frame);

  /* пропуск в любой момент: сразу к разрезу и раскрытию главной */
  function end(){if(skipAt||ended)return;const now=performance.now();const T=now-t0;if(T>=P.split[0])return;skipAt={n:now,T:P.split[0]};cutFx=true}
  const onKey=e=>{if(e.key==='Escape')end()};
  skip.addEventListener('click',end);addEventListener('keydown',onKey);
  function cleanup(){if(ended)return;ended=true;cancelAnimationFrame(raf);removeEventListener('keydown',onKey);removeEventListener('resize',onRs);
    html.style.overflow=ov;el.classList.add('out');skip.style.opacity='0';bar.remove();
    setTimeout(()=>{el.remove();skip.remove()},650)}
}

/* карточки главной вылетают из точки разреза на свои места */
function open(cx,cy){const home=$('#pg-home');if(!home||home.hidden)return;
  const els=$$('.hero>*, .locus, .news, .cont, .blk>h2, .rows>li, [data-lw-home]>*',home).filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0});
  els.forEach((e,i)=>{const r=e.getBoundingClientRect();
    e.style.setProperty('--dx',cx-(r.left+r.width/2)+'px');e.style.setProperty('--dy',cy-(r.top+r.height/2)+'px');e.style.setProperty('--i',i);
    e.classList.remove('from-cut');void e.offsetWidth;e.classList.add('from-cut');
    e.addEventListener('animationend',()=>{e.classList.remove('from-cut');['--dx','--dy','--i'].forEach(p=>e.style.removeProperty(p))},{once:true})})}

function maybe(){
  if(BV.reduced||!isHome())return;
  const last=store.get('intro',''),day=today();store.set('intro',day);
  run(last!==day)}
/* главная рисуется сразу после загрузки app.js; ждём один кадр, чтобы были видны её блоки */
requestAnimationFrame(()=>requestAnimationFrame(maybe));
BV.intro={play:(full=true)=>run(full)};
})();
