/* Стенд драконов: рисунок A (SVG) и спрайты C (тот же рисунок, нарезанный для анимации) на настоящих генотипах.
   Ничего не сохраняет и в базу не ходит. Открывается как phagi/dragons/stand.html через локальный сервер. */
(function(){
'use strict';
const D=window.DRG,MO=window.MORPH,SH=window.SHAPE,A=window.ART,SPR=window.SPR,OLD=window.DRAW;
const st={r:'svg',sil:false,anim:false,dark:null};   /* dark: null = как в системе */
const sysDark=()=>matchMedia('(prefers-color-scheme: dark)').matches;
const still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const app=document.getElementById('app'),tip=document.getElementById('tip');
try{const s=JSON.parse(localStorage.getItem('drgStand')||'{}');Object.assign(st,s);if(!['svg','spr','both'].includes(st.r))st.r='svg'}catch(e){}
const save=()=>{try{localStorage.setItem('drgStand',JSON.stringify(st))}catch(e){}};
const DPR=Math.min(2,window.devicePixelRatio||1);

const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const ELS=['F','W','T','A','P','L','D'];
const ELN={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const PART={body:'Тело',skin:'Чешуя и узор',wings:'Крылья',horns:'Рога',crest:'Гребень',mace:'Булава',tailEnd:'Кончик хвоста',
  eyes:'Глаза',metal:'Блеск чешуи',spurs:'Шпоры',breath:'Дыхание',collar:'Воротник',legs:'Лапы',head:'Голова',aura:'Сияние'};
/* рамки в единицах экрана: для взрослых 12-го уровня и общая для возрастов (крылья развитого дракона Воздуха выше всех) */
const FRAME=[-182,-268,364,280],FRAME_AGE=[-200,-292,400,304];
let uid=0;

function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const words=(ph,M)=>OLD.describe(ph).join(' · ')+' · '+M.stageName+', '+M.lvl+'-й ур.';

/* ---------- спрайты C в карточках ----------
   Холст карточки получает пиксели только пока он на экране: ушёл с экрана — память холста отдаётся.
   Текстуры частей лежат в общем кеше SPR, одинаковые драконы делят одни и те же. */
const live=new Set();
/* текстуры готовятся, только когда карточка подходит к экрану: и память, и время на подготовку тратятся на видимых драконов */
/* карточка держит текстуры, пока видна: ушла с экрана — отпускает их, и кеш может их вытеснить при нехватке памяти */
const io=new IntersectionObserver(es=>es.forEach(e=>{const cv=e.target;cv._vis=e.isIntersecting;
  if(cv._vis){if(cv._S)paint(cv,0);else if(!cv._req){cv._req=1;SPR.get(cv._ph0,cv._lvl,cv._opt).then(S=>{cv._req=0;if(cv._vis&&cv.isConnected){cv._S=S;paint(cv,0)}else SPR.release(S)})}}else release(cv)}),{rootMargin:'300px'});
function paint(cv,t){const S=cv._S;if(!S)return;if(cv.width!==S.W){cv.width=S.W;cv.height=S.H}const c=cv.getContext('2d');c.clearRect(0,0,S.W,S.H);SPR.compose(c,S,t+(cv._ph||0))}
function release(cv){if(cv._S){SPR.release(cv._S);cv._S=null}if(cv.width){cv.width=0;cv.height=0}}
function sprPic(ph,lvl,frame,title,tag){
  const d=el('div','pic',tag?'<span class="tag">C</span>':''),cv=document.createElement('canvas');
  cv.setAttribute('role','img');cv.setAttribute('aria-label',title);cv.width=0;cv.height=0;
  cv.style.aspectRatio=frame[2]+' / '+frame[3];cv._ph=(live.size*0.37)%2.6;d.append(cv);
  cv._ph0=ph;cv._lvl=lvl;cv._opt={frame,width:380,dpr:DPR,sil:st.sil};live.add(cv);io.observe(cv);
  return d}
/* один общий цикл анимации на все видимые холсты */
let loopTok=0;
function loop(){
  const tok=++loopTok;if(!st.anim||still())return;
  const t0=performance.now(),step=now=>{if(tok!==loopTok)return;const t=(now-t0)/1000;
    live.forEach(cv=>{if(!cv.isConnected){live.delete(cv);io.unobserve(cv);return}if(cv._vis)paint(cv,t)});requestAnimationFrame(step)};
  requestAnimationFrame(step)}

/* карточка дракона: рисунок A, C или оба */
function card(o){
  const ph=D.phenotype(o.g),lvl=o.lvl||12,M=MO.morph(ph,lvl),G=SH.build(M),key='k'+(uid++),frame=o.frame||FRAME;
  const c=el('div','card');c._M=M;
  const pics=el('div','pics');
  if(st.r!=='spr')pics.append(el('div','pic',(st.r==='both'?'<span class="tag">A</span>':'')+A.svg(M,{key,geom:G,frame,width:380,sil:st.sil,label:o.title})));
  if(st.r!=='svg')pics.append(sprPic(ph,lvl,frame,o.title,st.r==='both'));
  c.append(pics);
  c.append(el('h3',null,esc(o.title)));
  if(o.gene)c.append(el('p','gene',esc(o.gene)));
  c.append(el('p','ph',esc(o.words||words(ph,M))));
  return c}

function section(title,text,cls){const s=el('section');s.append(el('h2',null,title));if(text)s.append(el('p',null,text));const g=el('div','grid'+(cls?' '+cls:''));s.append(g);app.append(s);return g}

/* рамка вокруг морды: по точкам головы, глаза и пасти из геометрии */
function headFrame(G){
  const s=G.scale,tx=-(G.box.x+G.box.w/2)*s,P=p=>[p[0]*s+tx,p[1]*s];
  const h=P(G.anchors.head),m=P(G.anchors.mouth),e=P(G.anchors.eye),w=Math.hypot(m[0]-h[0],m[1]-h[1])*1.6+G.anchors.eyeR*s*2;
  const cx=(h[0]+m[0]*1.3+e[0])/3.3,cy=(h[1]+m[1]+e[1])/3;
  return [cx-w*0.5,cy-w*0.44,w,w*0.75]}

/* «было и стало»: оба рисунка вписываются по своим габаритам в одинаковые рамки, земля на одной линии */
function fit(svg){
  const b=svg.getBBox(),p=Math.max(b.width,b.height)*0.04;
  svg.setAttribute('viewBox',[b.x-p,b.y-p,b.width+2*p,b.height+2*p].map(v=>Math.round(v*10)/10).join(' '));
  svg.setAttribute('preserveAspectRatio','xMidYMax meet');svg.removeAttribute('width');svg.removeAttribute('height');svg.classList.add('fit')}

function render(){
  loopTok++;live.forEach(cv=>{io.unobserve(cv);release(cv)});live.clear();
  app.innerHTML='';uid=0;
  document.body.classList.toggle('sil',st.sil);document.body.classList.toggle('anim',st.anim);
  if(st.dark==null)document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',st.dark?'dark':'light');
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.r===st.r)));
  document.querySelectorAll('.tg').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t==='dark'?(st.dark==null?sysDark():st.dark):!!st[b.dataset.t])));

  /* 1. семь стихий */
  let g=section('Семь стихий','Одинаковые остальные гены, разная только Стихия. Включи «Чёрные силуэты»: драконы должны различаться и без цвета.');
  ELS.forEach(e=>g.append(card({title:ELN[e],gene:'E: '+e+'/'+e,g:mk({E:e+'/'+e})})));

  /* 2. морды крупно: тот же рисунок A, только рамка вокруг головы */
  g=section('Морды крупно','У каждой стихии свой череп, челюсть, надбровье, разрез глаза и щёки. Это тот же рисунок, что выше, просто рамка у головы.','heads');
  ELS.forEach(e=>{const ph=D.phenotype(mk({E:e+'/'+e,H:'h/h'})),M=MO.morph(ph,12),G=SH.build(M),c=el('div','card');
    c._M=M;c.append(el('div','pics','<div class="pic">'+A.svg(M,{key:'h'+(uid++),geom:G,frame:headFrame(G),width:300,sil:st.sil,label:'Морда: '+ELN[e]})+'</div>'));
    const hd=MO.ARCH[e].head;c.append(el('h3',null,ELN[e]));c.append(el('p','ph',esc({almond:'миндалевидный глаз',round:'круглый глаз',hooded:'глаз под тяжёлым веком',narrow:'узкий глаз'}[hd.eye]+', '+{grin:'оскал',smile:'улыбка',flat:'сжатые губы'}[hd.mouth]+', '+{spikes:'шипы на скулах',fins:'плавники-жабры',plates:'костяные пластины',tufts:'перья на щеках',leaves:'листья',crystals:'кристаллы',jags:'зазубрины'}[hd.cheek]+(hd.whisk?', усы':'')+(hd.tusk?', клыки снизу':''))));
    g.append(c)});

  /* 3. гибриды */
  g=section('Гибриды','Две стихии кодоминантны, видны обе. Каждая часть тела берётся от стихии с бо́льшим весом по этой части, пропорции смешиваются. Отдельных рисунков на пары нет.');
  [['F','W'],['F','T'],['W','A'],['T','P'],['L','D'],['A','F'],['P','D'],['W','L']].forEach(([a,b])=>{
    const M=MO.morph(D.phenotype(mk({E:a+'/'+b})),12),src=Object.keys(M.arch).filter(k=>M.arch[k]).map(k=>({body:'тело',head:'голова',wing:'крылья',tail:'хвост',skin:'кожа',crest:'гребень',collar:'воротник'})[k]+' '+ELN[M.arch[k]].toLowerCase()).join(', ');
    g.append(card({title:ELN[a]+' + '+ELN[b],gene:'E: '+a+'/'+b,g:mk({E:a+'/'+b}),words:src}))});

  /* 4. возраст */
  g=section('Возраст','Стадии привязаны к уровню кормления: 1–3 малыш, 4–9 подросток, 10–15 взрослый, 16–20 развитый. Масштаб у всех кадров общий, генотип не меняется.','age');
  [['F','F/F'],['W','W/A'],['P','P/P'],['D','D/D']].forEach(([e,E])=>[2,6,12,18].forEach(lv=>{const gg=mk({E,H:'H/H',R:'R1/R1'});g.append(card({title:(E[0]===E[2]?ELN[e]:ELN[E[0]]+' + '+ELN[E[2]])+', '+lv+'-й уровень',gene:'E: '+E,g:gg,lvl:lv,frame:FRAME_AGE}))}));

  /* 5. было и стало */
  g=section('Было и стало в одном масштабе','Слева прежний рисунок (draw.js), справа новый для того же фенотипа. Оба вписаны по своим габаритам в одинаковые рамки, земля на одной линии.','ba');
  const BA=ELS.map(e=>[ELN[e],mk({E:e+'/'+e}),12]).concat([['Вода + Воздух',mk({E:'W/A'}),12],['Огонь + Земля, без рогов, булава',mk({E:'F/T',H:'h/h',K:'K/k'}),12],['Флора, малыш',mk({E:'P/P'}),2]]);
  const fits=[];
  BA.forEach(([t,gg,lv])=>{const ph=D.phenotype(gg),M=MO.morph(ph,lv),c=el('div','card');
    const pics=el('div','pics');pics.append(el('div','pic fix','<span class="tag">было</span>'+OLD.svg(ph,{key:'old'+uid++,size:380,stage:MO.stageOf(lv)>=2?2:MO.stageOf(lv)})));
    pics.append(el('div','pic fix','<span class="tag">стало</span>'+A.svg(M,{key:'new'+uid++,width:380,sil:st.sil})));
    c._M=M;c.append(pics);c.append(el('h3',null,esc(t)));c.append(el('p','ph',esc(words(ph,M))));g.append(c);fits.push(...pics.querySelectorAll('svg'))});

  /* 6. одна стихия, разные гены */
  g=section('Одна стихия, разная наследственность','Все драконы огненные (E: F/F). Меняется по одному гену от основы, подпись показывает, какой.');
  const V=[
    ['Основа','H/h, k/k, R1/R2, размах +/- ×3, C/c',{}],
    ['Без рогов','H: h/h',{H:'h/h'}],
    ['Булава','K: K/k',{K:'K/k'}],
    ['Без гребня','R: R2/R2',{R:'R2/R2'}],
    ['Большой гребень','R: R1/R1',{R:'R1/R1'}],
    ['Короткие крылья','Wg: Wg/+',{Wg:'Wg/+'}],
    ['Малый размах','Q1–Q3: все -/-',{Q1:'-/-',Q2:'-/-',Q3:'-/-'}],
    ['Большой размах','Q1–Q3: все +/+',{Q1:'+/+',Q2:'+/+',Q3:'+/+'}],
    ['Бронзовый окрас','C: Cb/c',{C:'Cb/c'}],
    ['Бледный окрас','C: c/c',{C:'c/c'}],
    ['Блеск чешуи','Z: M/m (самец)',{M:'M/m'}],
    ['Ночное зрение','Z: n/n',{N:'n/n'}],
    ['Свечение глаз','мт: G (от матери)',{G:'G'}],
    ['Самка со шпорами','ZW, W: Sp',{sex:'F',Sp:'Sp'}],
    ['Дремлющий','S: s/s (эпистаз гасит стихию)',{S:'s/s'}],
    ['Дымный','E: e/e (стихии нет)',{E:'e/e'}]];
  V.forEach(([t,gn,sp])=>{const spec=Object.assign({E:'F/F'},sp);if(spec.sex==='F'){delete spec.M;delete spec.N}g.append(card({title:t,gene:gn,g:mk(spec)}))});

  /* 7. семья */
  g=section('Родители и потомки','Восемь яиц от одной пары, настоящий мейоз DRG.breed с фиксированным зерном. Видно расщепление по стихии, рогам, гребню, размаху и полу.');
  const mother=D.make({sex:'F',E:'F/W',S:'S/s',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/+',Q3:'-/-',M:'m',N:'n',Sp:'Sp',G:'G'});
  const father=D.make({sex:'M',E:'F/P',S:'S/s',C:'Cb/c',H:'h/h',K:'K/k',R:'R1/R2',Wg:'Wg/+',Q1:'+/-',Q2:'-/-',Q3:'+/-',M:'M/m',N:'N/n'});
  g.append(card({title:'Мать',gene:D.genoText(mother),g:mother}));
  g.append(card({title:'Отец',gene:D.genoText(father),g:father}));
  const rnd=D.rng('stand-family-1');let kids=0,tries=0;
  while(kids<8&&tries<40){tries++;const egg=D.breed(mother,father,rnd);if(!egg.viable)continue;kids++;
    g.append(card({title:'Птенец '+kids+(egg.genome.sex==='F'?', самка':', самец'),gene:D.genoText(egg.genome),g:egg.genome,lvl:12}))}

  /* 8. силуэты, согласованность A и C, память и скорость */
  const s=el('section');s.innerHTML='<h2>Чёрные силуэты</h2><p>Семь взрослых драконов чёрным в одной рамке. Для каждой пары считается доля общей площади (пересечение делить на объединение): 100% значит одинаковый силуэт.</p>';
  const sg=el('div','grid sils');ELS.forEach(e=>{const M=MO.morph(D.phenotype(mk({E:e+'/'+e})),12),c=el('div','card');
    c.append(el('div','pics','<div class="pic white">'+A.svg(M,{key:'sl'+(uid++),frame:FRAME,width:300,sil:true,label:'Силуэт: '+ELN[e]})+'</div>'));c.append(el('h3',null,ELN[e]));sg.append(c)});
  s.append(sg);const iouOut=el('div');s.append(iouOut);app.append(s);

  const s2=el('section');s2.innerHTML='<h2>Спрайты C: тот же рисунок, память и скорость</h2><p>Спрайты нарезаются из рисунка A: тень на земле, дальнее крыло, тело и ближнее крыло растрируются по одному разу, пустые прозрачные поля обрезаются, готовые части лежат в общем кеше. Кадр анимации собирается из них поворотом крыльев у плеча.</p>';
  const demo=el('div','card');demo.style.maxWidth='420px';demo.style.marginBottom='12px';
  const dcv=document.createElement('canvas');dcv.setAttribute('role','img');dcv.setAttribute('aria-label','Огненный дракон, анимация спрайтами');dcv.style.aspectRatio=FRAME[2]+' / '+FRAME[3];
  const dp=el('div','pic');dp.append(dcv);demo.append(dp);demo.append(el('h3',null,'C · спрайты, живой пример'));
  demo.append(el('p','ph','Машет крыльями всегда, даже без кнопки «Анимация» (если в системе не выключено движение).'));s2.append(demo);
  SPR.get(D.phenotype(mk({E:'F/F',H:'H/H',R:'R1/R1'})),12,{frame:FRAME,width:380,dpr:DPR}).then(S=>{if(!dcv.isConnected){SPR.release(S);return}dcv._S=S;dcv._vis=true;live.add(dcv);paint(dcv,0);
    if(!still()){const tok=loopTok,t0=performance.now(),step=now=>{if(tok!==loopTok||!dcv.isConnected)return;if(!st.anim)paint(dcv,(now-t0)/1000);requestAnimationFrame(step)};requestAnimationFrame(step)}});
  const out=el('div');s2.append(out);const btn=el('button','btn','Замерить ещё раз');btn.onclick=()=>measure(out,iouOut);s2.append(btn);app.append(s2);

  fits.forEach(fit);
  loop();
  measure(out,iouOut)}

/* ---------- замеры ---------- */
const raster=async(str,W,H)=>{const img=await SPR.load(str),cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,W,H);const d=c.getImageData(0,0,W,H).data;cv.width=cv.height=0;return d};
let measuring=false;
async function measure(out,iouOut){
  if(measuring)return;measuring=true;out.innerHTML='<p class="note">Меряю…</p>';
  try{
  const W=320,H=Math.round(W*FRAME[3]/FRAME[2]),Ms=ELS.map(e=>MO.morph(D.phenotype(mk({E:e+'/'+e})),12));
  /* силуэты: растр SVG силуэта, маска по прозрачности */
  const masks=[];for(const M of Ms){const d=await raster(A.svg(M,{frame:FRAME,width:W,sil:true,key:'iou'}),W,H),m=new Uint8Array(W*H);for(let i=0;i<m.length;i++)m[i]=d[i*4+3]>128?1:0;masks.push(m)}
  const iou=(a,b)=>{let i=0,u=0;for(let k=0;k<a.length;k++){const x=a[k],y=b[k];if(x&y)i++;if(x|y)u++}return u?i/u:0};
  let t='<div class="scroll"><table><tr><th></th>'+ELS.map(e=>'<th>'+ELN[e]+'</th>').join('')+'</tr>';
  let worst=0,wp='';
  ELS.forEach((a,i)=>{t+='<tr><th>'+ELN[a]+'</th>';ELS.forEach((b,j)=>{if(i===j){t+='<td>·</td>';return}const v=iou(masks[i],masks[j]);if(v>worst){worst=v;wp=ELN[a]+' и '+ELN[b]}
    t+=`<td class="${v<0.55?'ok':v<0.7?'mid':'badc'}">${Math.round(v*100)}%</td>`});t+='</tr>'});
  t+='</table></div>'+`<p class="note">Самая похожая пара: ${wp}, ${Math.round(worst*100)}% общей площади.</p>`;
  iouOut.innerHTML=t;window.__silWorst=worst;

  /* A и C попиксельно: полный SVG против кадра из спрайтов в покое */
  const WA=380,HA=Math.round(WA*FRAME[3]/FRAME[2]);let diffMax=0,diffSum=0;
  for(const M of Ms){const a=await raster(A.svg(M,{frame:FRAME,width:WA,key:'cmp'}),WA,HA),S=await SPR.make(M,{frame:FRAME,width:WA,dpr:1});
    const cv=document.createElement('canvas');cv.width=WA;cv.height=HA;const c=cv.getContext('2d',{willReadFrequently:true});SPR.compose(c,S,0);const b=c.getImageData(0,0,WA,HA).data;
    let n=0,bad=0;for(let i=0;i<a.length;i+=4){if(a[i+3]<8&&b[i+3]<8)continue;n++;if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]),Math.abs(a[i+3]-b[i+3]))>40)bad++}
    const v=n?bad/n:0;diffSum+=v;diffMax=Math.max(diffMax,v);cv.width=cv.height=0;DRTEX.freeParts(S)}

  /* скорость: 7 драконов × N повторов */
  const N=20,phs=ELS.map(e=>D.phenotype(mk({E:e+'/'+e})));
  let t0=performance.now();for(let k=0;k<N;k++)phs.forEach(ph=>SH.build(MO.morph(ph,12)));const tGeom=(performance.now()-t0)/(N*7);
  t0=performance.now();const strs=[];for(let k=0;k<N;k++)phs.forEach((ph,i)=>strs.push(A.svg(MO.morph(ph,12),{key:'m'+i})));const tSvg=(performance.now()-t0)/(N*7);
  const host=el('div');host.style.cssText='position:absolute;left:-9999px;top:0;width:380px';document.body.append(host);
  t0=performance.now();for(let k=0;k<N;k++){host.innerHTML=strs.slice(k*7,k*7+7).join('');host.getBoundingClientRect()}const tDom=(performance.now()-t0)/(N*7);host.remove();
  /* C: подготовка один раз на дракона (растр и обрезка), потом каждый кадр собирается из готовых картинок */
  t0=performance.now();const SP=[];for(const ph of phs)SP.push(await SPR.make(MO.morph(ph,12),{frame:FRAME,width:380,dpr:DPR}));const tPrep=(performance.now()-t0)/7;
  const cv2=document.createElement('canvas');cv2.width=SP[0].W;cv2.height=SP[0].H;const cx2=cv2.getContext('2d');
  const NF=60;t0=performance.now();for(let f=0;f<NF;f++){cx2.clearRect(0,0,cv2.width,cv2.height);SP.forEach(S=>SPR.compose(cx2,S,f/60))}cx2.getImageData(0,0,1,1);const tFrame=(performance.now()-t0)/(NF*7);
  const trim=SP.reduce((a,S)=>a+S.bytes,0)/7,full=SP.reduce((a,S)=>a+S.fullBytes,0)/7;
  SP.forEach(S=>DRTEX.freeParts(S));cv2.width=cv2.height=0;
  const avgLen=Math.round(strs.slice(0,7).reduce((s,x)=>s+x.length,0)/7/1024);
  const cs=SPR.stats(),MB=b=>(b/1048576).toFixed(1)+' МБ';
  let shown=0,shownB=0;live.forEach(cv=>{if(cv.width){shown++;shownB+=cv.width*cv.height*4}});
  let h=`<h3>A и C совпадают</h3><p class="note">Кадр из спрайтов в покое сравнивается с полным SVG того же дракона попиксельно, семь стихий. ${diffMax===0?'Заметно отличающихся пикселей нет ни у одного дракона.':`Заметно отличается в среднем ${(diffSum/7*100).toFixed(2)}% пикселей дракона, в худшем случае ${(diffMax*100).toFixed(2)}%: это сглаживание на стыках частей.`}</p>`;
  h+=`<h3>Память спрайтов</h3><div class="scroll"><table><tr><th>что</th><th>на дракона</th></tr>
    <tr><th>три холста во весь кадр, как было</th><td>${MB(full)}</td></tr>
    <tr><th>четыре части с обрезкой пустых полей</th><td>${MB(trim)}</td></tr></table></div>
    <p class="note">Экономия ${Math.round((1-trim/full)*100)}% при плотности пикселей ${DPR}. Общий кеш текстур: драконов ${cs.count}, занято ${MB(cs.bytes)} из ${MB(cs.budget)}; запросов, взятых из кеша, ${cs.hits}, подготовлено заново ${cs.misses}, вытеснено ${cs.evicted}. Холсты карточек держат пиксели, только пока видны на экране: сейчас таких ${shown}, ${MB(shownB)}.</p>`;
  h+=`<h3>Скорость</h3><div class="scroll"><table><tr><th>что меряем</th><th>мс на дракона</th></tr>
    <tr><th>морфология и геометрия</th><td>${tGeom.toFixed(2)}</td></tr>
    <tr><th>A · SVG: сборка строки</th><td>${tSvg.toFixed(2)}</td></tr>
    <tr><th>A · SVG: вставка в страницу и раскладка</th><td>${tDom.toFixed(2)}</td></tr>
    <tr><th>C · спрайты: подготовка, один раз</th><td>${tPrep.toFixed(1)}</td></tr>
    <tr><th>C · спрайты: один кадр анимации</th><td>${tFrame.toFixed(3)}</td></tr></table></div>
    <p class="note">Размер SVG одного дракона около ${avgLen} КБ. Замер: ${N} повторов по 7 драконов (кадры: ${NF} по 7), ${navigator.userAgent.includes('Mobile')?'телефон':'компьютер'}.
    На кадр при 60 к/с есть около 16 мс, по этому замеру спрайтами можно оживить примерно ${Math.floor(16/Math.max(tFrame,0.001))} драконов за кадр. Это время работы скрипта, видеокарта добавляет своё, поэтому проверять надо и на телефоне.</p>`;
  window.__perf={tGeom,tSvg,tDom,tPrep,tFrame,avgLen,trim,full,diffMax,diffAvg:diffSum/7,cache:cs,shown,shownB};
  out.innerHTML=h}
  catch(e){out.innerHTML='<p class="note">Замер не удался: '+esc(e.message||e)+'</p>'}
  finally{measuring=false}}

/* подсказка: какая часть тела и какие гены за что отвечают */
function genesHTML(M,part){
  const s=M.src[part];if(!s)return '';
  const nm=(l,c)=>esc(l)+' ('+esc(s.why&&s.why[c]&&s.why[c][l]||(D.LOCI[l]?D.LOCI[l].name.toLowerCase():''))+')';
  const row=(t,c)=>s[c].length?'<br>'+t+': '+s[c].map(l=>nm(l,c)).join(', '):'';
  return row('Есть или нет','has')+row('Форма','shape')+row('Окраска','color')}
app.addEventListener('mouseover',e=>{
  const g=e.target.closest&&e.target.closest('svg.dr3 g[data-part]');
  app.querySelectorAll('svg.dr3.hl').forEach(s=>{s.classList.remove('hl');s.querySelectorAll('.on').forEach(x=>x.classList.remove('on'))});
  if(!g||st.sil||g.ownerSVGElement.classList.contains('sil')){tip.style.display='none';return}
  const svg=g.ownerSVGElement,part=g.dataset.part,card=g.closest('.card'),M=card&&card._M;
  if(!M||part==='shadow'){tip.style.display='none';return}
  svg.classList.add('hl');svg.querySelectorAll(`g[data-part="${part}"]`).forEach(x=>x.classList.add('on'));
  let h='<b>'+esc(PART[part]||part)+'</b>';
  if(M.cosm[part])h+='<br>Не наследуется: '+esc(M.cosm[part]);
  else h+=genesHTML(M,part);
  if(M.age[part])h+='<br>Возраст: '+esc(M.age[part])+' (не наследуется)';
  tip.innerHTML=h;tip.style.display='block'});
app.addEventListener('mousemove',e=>{if(tip.style.display==='block'){tip.style.left=Math.min(innerWidth-290,e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'}});
app.addEventListener('mouseleave',()=>{tip.style.display='none'});

document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{st.r=b.dataset.r;save();render()});
document.querySelectorAll('.tg').forEach(b=>b.onclick=()=>{const t=b.dataset.t;st[t]=t==='dark'?!(st.dark==null?sysDark():st.dark):!st[t];save();render()});
render();
})();
