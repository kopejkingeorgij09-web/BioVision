/* Стенд драконов: сравнение двух прототипов рисунка на настоящих генотипах.
   Ничего не сохраняет и в базу не ходит. Открывается как phagi/dragons/stand.html. */
(function(){
'use strict';
const D=window.DRG,MO=window.MORPH,SH=window.SHAPE,A=window.ART,C=window.ARTC,OLD=window.DRAW;
const st={r:'svg',sil:false,anim:false,dark:null};   /* dark: null = как в системе */
const sysDark=()=>matchMedia('(prefers-color-scheme: dark)').matches;
const app=document.getElementById('app'),tip=document.getElementById('tip');
try{const s=JSON.parse(localStorage.getItem('drgStand')||'{}');Object.assign(st,s)}catch(e){}
const save=()=>{try{localStorage.setItem('drgStand',JSON.stringify(st))}catch(e){}};

const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const ELN={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const PART={body:'Тело',skin:'Чешуя и узор',wings:'Крылья',horns:'Рога',crest:'Гребень',mace:'Булава',tailEnd:'Кончик хвоста',
  eyes:'Глаза',metal:'Блеск чешуи',spurs:'Шпоры',breath:'Дыхание',collar:'Воротник',legs:'Лапы',head:'Голова',aura:'Сияние'};
/* рамки: для взрослых 12-го уровня и общая для возрастов (крылья развитого дракона Воздуха выше всех) */
const FRAME=[-182,-268,364,280],FRAME_AGE=[-200,-292,400,304];
let uid=0;

function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const words=(ph,M)=>OLD.describe(ph).join(' · ')+' · '+M.stageName+', '+M.lvl+'-й ур.';

/* карточка дракона: рисунок A, B или оба */
function card(o){
  const ph=D.phenotype(o.g),M=MO.morph(ph,o.lvl||12),G=SH.build(M),key='k'+(uid++),frame=o.frame||FRAME;
  const c=el('div','card');c._M=M;
  const pics=el('div','pics');
  if(st.r!=='cv'){const d=el('div','pic',(st.r==='both'?'<span class="tag">A</span>':'')+A.svg(M,{key,geom:G,frame,width:380,sil:st.sil,label:o.title}));pics.append(d)}
  if(st.r!=='svg'){const d=el('div','pic',st.r==='both'?'<span class="tag">B</span>':'');const cv=document.createElement('canvas');cv.setAttribute('role','img');cv.setAttribute('aria-label',o.title);
    C.draw(cv,M,{geom:G,frame,width:380,sil:st.sil});cv.style.width='100%';cv.style.height='auto';d.append(cv);pics.append(d)}
  c.append(pics);
  c.append(el('h3',null,esc(o.title)));
  if(o.gene)c.append(el('p','gene',esc(o.gene)));
  c.append(el('p','ph',esc(o.words||words(ph,M))));
  return c}

function section(title,text,cls){const s=el('section');s.append(el('h2',null,title));if(text)s.append(el('p',null,text));const g=el('div','grid'+(cls?' '+cls:''));s.append(g);app.append(s);return g}

function render(){
  app.innerHTML='';uid=0;
  document.body.classList.toggle('sil',st.sil);document.body.classList.toggle('anim',st.anim);
  if(st.dark==null)document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',st.dark?'dark':'light');
  document.querySelectorAll('.seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.r===st.r)));
  document.querySelectorAll('.tg').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.t==='dark'?(st.dark==null?sysDark():st.dark):!!st[b.dataset.t])));

  /* 1. семь стихий */
  let g=section('Семь стихий','Одинаковые остальные гены, разная только Стихия. Включи «Чёрные силуэты»: драконы должны различаться без цвета.');
  ['F','W','T','A','P','L','D'].forEach(e=>g.append(card({title:ELN[e],gene:'E: '+e+'/'+e,g:mk({E:e+'/'+e})})));

  /* 2. гибриды */
  g=section('Гибриды','Две стихии кодоминантны, видны обе. Каждая часть тела берётся от стихии с бо́льшим весом по этой части, пропорции смешиваются. Отдельных рисунков на пары нет.');
  [['F','W'],['F','T'],['W','A'],['T','P'],['L','D'],['A','F']].forEach(([a,b])=>{
    const M=MO.morph(D.phenotype(mk({E:a+'/'+b})),12),src=Object.keys(M.arch).filter(k=>M.arch[k]).map(k=>({body:'тело',head:'голова',wing:'крылья',tail:'хвост',skin:'кожа',crest:'гребень',collar:'воротник'})[k]+' '+ELN[M.arch[k]].toLowerCase()).join(', ');
    g.append(card({title:ELN[a]+' + '+ELN[b],gene:'E: '+a+'/'+b,g:mk({E:a+'/'+b}),words:src}))});

  /* 3. одна стихия, разные гены */
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

  /* 4. возраст */
  g=section('Возраст','Стадии привязаны к уровню кормления: 1–3 малыш, 4–9 подросток, 10–15 взрослый, 16–20 развитый. Масштаб у всех кадров общий, генотип не меняется.','age');
  [['F','F/F'],['W','W/A'],['P','P/P']].forEach(([e,E])=>[2,6,12,18].forEach(lv=>{const gg=mk({E,H:'H/H',R:'R1/R1'});g.append(card({title:(E[0]===E[2]?ELN[e]:ELN[E[0]]+' + '+ELN[E[2]])+', '+lv+'-й уровень',gene:'E: '+E,g:gg,lvl:lv,frame:FRAME_AGE}))}));

  /* 5. семья */
  g=section('Родители и потомки','Восемь яиц от одной пары, настоящий мейоз DRG.breed с фиксированным зерном. Видно расщепление по стихии, рогам, гребню, размаху и полу.');
  const mother=D.make({sex:'F',E:'F/W',S:'S/s',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/+',Q3:'-/-',M:'m',N:'n',Sp:'Sp',G:'G'});
  const father=D.make({sex:'M',E:'F/P',S:'S/s',C:'Cb/c',H:'h/h',K:'K/k',R:'R1/R2',Wg:'Wg/+',Q1:'+/-',Q2:'-/-',Q3:'+/-',M:'M/m',N:'N/n'});
  g.append(card({title:'Мать',gene:D.genoText(mother),g:mother}));
  g.append(card({title:'Отец',gene:D.genoText(father),g:father}));
  const rnd=D.rng('stand-family-1');let kids=0,tries=0;
  while(kids<8&&tries<40){tries++;const egg=D.breed(mother,father,rnd);if(!egg.viable)continue;kids++;
    g.append(card({title:'Птенец '+kids+(egg.genome.sex==='F'?', самка':', самец'),gene:D.genoText(egg.genome),g:egg.genome,lvl:12}))}

  /* 6. было и стало */
  g=section('Было и стало','Слева прежний рисунок (draw.js), справа новый для того же фенотипа.');
  [['Огонь',mk({E:'F/F'})],['Вода + Воздух',mk({E:'W/A'})],['Земля',mk({E:'T/T',H:'h/h',K:'K/K'})]].forEach(([t,gg])=>{
    const ph=D.phenotype(gg),M=MO.morph(ph,12),c=el('div','card');
    const pics=el('div','pics');pics.append(el('div','pic','<span class="tag">было</span>'+OLD.svg(ph,{key:'old'+uid++,size:380,stage:2})));
    pics.append(el('div','pic','<span class="tag">стало</span>'+A.svg(M,{key:'new'+uid++,frame:FRAME,width:380,sil:st.sil})));
    c._M=M;c.append(pics);c.append(el('h3',null,t));c.append(el('p','ph',esc(words(ph,M))));g.append(c)});

  /* 7. проверка силуэтов и замер */
  const s=el('section');s.innerHTML='<h2>Проверка силуэтами и замер скорости</h2><p>Силуэты семи взрослых драконов рисуются чёрным в одной рамке, для каждой пары считается доля совпадающей площади (пересечение делить на объединение). 100% значит одинаковый силуэт. Скорость меряется прямо в этом браузере.</p>';
  const demo=el('div','card');demo.style.maxWidth='420px';demo.style.marginBottom='12px';
  const dp=el('div','pic'),dcv=document.createElement('canvas');dcv.setAttribute('role','img');dcv.setAttribute('aria-label','Огненный дракон, анимация спрайтами');dp.append(dcv);demo.append(dp);
  demo.append(el('h3',null,'C · составные спрайты'));
  demo.append(el('p','ph','Крылья и тело один раз нарезаны из рисунка B, дальше двигаются отдельно. Включи «Анимацию», чтобы увидеть движение.'));
  s.append(demo);liveSprites(dcv);
  const out=el('div');s.append(out);const btn=el('button','btn','Замерить ещё раз');btn.onclick=()=>measure(out);s.append(btn);app.append(s);
  measure(out)}

/* живая анимация спрайтами; при новом рендере старый цикл останавливается */
let liveTok=0;
function liveSprites(cv){
  const tok=++liveTok,M=MO.morph(D.phenotype(mk({E:'F/F',H:'H/H',R:'R1/R1'})),12),S=C.sprites(M,{frame:FRAME,width:380,dpr:2});
  cv.width=S.w;cv.height=S.h;cv.style.width='100%';cv.style.height='auto';
  const ctx=cv.getContext('2d'),still=!st.anim||matchMedia('(prefers-reduced-motion: reduce)').matches;
  C.compose(ctx,S,0);if(still)return;
  const t0=performance.now(),step=now=>{if(tok!==liveTok||!cv.isConnected)return;C.compose(ctx,S,(now-t0)/1000);requestAnimationFrame(step)};
  requestAnimationFrame(step)}

/* попарное перекрытие силуэтов и время отрисовки */
function measure(out){
  const E=['F','W','T','A','P','L','D'],W=320,frame=FRAME;
  const masks=E.map(e=>{const M=MO.morph(D.phenotype(mk({E:e+'/'+e})),12),cv=document.createElement('canvas');
    C.draw(cv,M,{frame,width:W,sil:true,dpr:1});const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data,m=new Uint8Array(d.length/4);
    for(let i=0;i<m.length;i++)m[i]=d[i*4+3]>128?1:0;return m});
  const iou=(a,b)=>{let i=0,u=0;for(let k=0;k<a.length;k++){const x=a[k],y=b[k];if(x&y)i++;if(x|y)u++}return u?i/u:0};
  let t='<div class="scroll"><table><tr><th></th>'+E.map(e=>'<th>'+ELN[e]+'</th>').join('')+'</tr>';
  let worst=0,wp='';
  E.forEach((a,i)=>{t+='<tr><th>'+ELN[a]+'</th>';E.forEach((b,j)=>{if(i===j){t+='<td>·</td>';return}const v=iou(masks[i],masks[j]);if(v>worst){worst=v;wp=ELN[a]+' и '+ELN[b]}
    t+=`<td class="${v<0.55?'ok':v<0.7?'mid':'badc'}">${Math.round(v*100)}%</td>`});t+='</tr>'});
  t+='</table></div>';
  t+=`<p class="note">Самая похожая пара: ${wp}, ${Math.round(worst*100)}% общей площади.</p>`;
  window.__silWorst=worst;
  /* скорость: 7 драконов × N повторов */
  const N=20,phs=E.map(e=>D.phenotype(mk({E:e+'/'+e})));
  let t0=performance.now();for(let k=0;k<N;k++)phs.forEach(ph=>SH.build(MO.morph(ph,12)));const tGeom=(performance.now()-t0)/(N*7);
  t0=performance.now();const strs=[];for(let k=0;k<N;k++)phs.forEach((ph,i)=>strs.push(A.svg(MO.morph(ph,12),{key:'m'+i})));const tSvg=(performance.now()-t0)/(N*7);
  const host=el('div');host.style.cssText='position:absolute;left:-9999px;top:0;width:380px';document.body.append(host);
  t0=performance.now();for(let k=0;k<N;k++){host.innerHTML=strs.slice(k*7,k*7+7).join('');host.getBoundingClientRect()}const tDom=(performance.now()-t0)/(N*7);host.remove();
  const cv=document.createElement('canvas');t0=performance.now();for(let k=0;k<N;k++)phs.forEach(ph=>C.draw(cv,MO.morph(ph,12),{width:380}));const tCv=(performance.now()-t0)/(N*7);
  /* C: спрайты. Подготовка один раз на дракона, потом каждый кадр собирается из готовых картинок */
  t0=performance.now();const SP=phs.map(ph=>C.sprites(MO.morph(ph,12),{frame,width:380}));const tPrep=(performance.now()-t0)/7;
  const cv2=document.createElement('canvas');cv2.width=SP[0].w;cv2.height=SP[0].h;const cx2=cv2.getContext('2d');
  const NF=60;t0=performance.now();for(let f=0;f<NF;f++)SP.forEach(S=>C.compose(cx2,S,f/60));cx2.getImageData(0,0,1,1);const tFrame=(performance.now()-t0)/(NF*7);
  const avgLen=Math.round(strs.slice(0,7).reduce((s,x)=>s+x.length,0)/7/1024);
  t+=`<div class="scroll"><table><tr><th>что меряем</th><th>мс на дракона</th></tr>
    <tr><th>морфология и геометрия</th><td>${tGeom.toFixed(2)}</td></tr>
    <tr><th>A · SVG: сборка строки</th><td>${tSvg.toFixed(2)}</td></tr>
    <tr><th>A · SVG: вставка в страницу и раскладка</th><td>${tDom.toFixed(2)}</td></tr>
    <tr><th>B · Canvas: отрисовка</th><td>${tCv.toFixed(2)}</td></tr>
    <tr><th>C · спрайты: подготовка, один раз</th><td>${tPrep.toFixed(2)}</td></tr>
    <tr><th>C · спрайты: один кадр анимации</th><td>${tFrame.toFixed(3)}</td></tr></table></div>
    <p class="note">Размер SVG одного дракона около ${avgLen} КБ. Замер: ${N} повторов по 7 драконов (спрайты: ${NF} кадров по 7), ${navigator.userAgent.includes('Mobile')?'телефон':'компьютер'}.
    На кадр при 60 к/с есть около 16 мс. По этому замеру спрайтами можно оживить примерно ${Math.floor(16/Math.max(tFrame,0.001))} драконов за кадр, полной перерисовкой B примерно ${Math.floor(16/Math.max(tCv,0.001))}. Это время работы скрипта, видеокарта может добавить своё, поэтому проверять надо и на телефоне.</p>`;
  window.__perf={tGeom,tSvg,tDom,tCv,tPrep,tFrame,avgLen};
  out.innerHTML=t}

/* подсказка: какая часть тела и какие гены */
app.addEventListener('mouseover',e=>{
  const g=e.target.closest&&e.target.closest('svg.dr3 g[data-part]');
  app.querySelectorAll('svg.dr3.hl').forEach(s=>{s.classList.remove('hl');s.querySelectorAll('.on').forEach(x=>x.classList.remove('on'))});
  if(!g||st.sil){tip.style.display='none';return}
  const svg=g.ownerSVGElement,part=g.dataset.part,card=g.closest('.card'),M=card&&card._M;
  if(part==='shadow'){tip.style.display='none';return}
  svg.classList.add('hl');svg.querySelectorAll(`g[data-part="${part}"]`).forEach(x=>x.classList.add('on'));
  const genes=M&&M.src[part==='head'?'body':part]||[];
  let h='<b>'+esc(PART[part]||part)+'</b>';
  if(M&&M.cosm[part])h+='<br>Не наследуется: '+esc(M.cosm[part]);
  else if(genes.length)h+='<br>Наследуется: '+genes.map(k=>esc(k+' · '+(D.LOCI[k]?D.LOCI[k].name:''))).join(', ');
  if(M&&M.age[part])h+='<br>Возраст: '+esc(M.age[part])+' (не наследуется)';
  tip.innerHTML=h;
  tip.style.display='block'});
app.addEventListener('mousemove',e=>{if(tip.style.display==='block'){tip.style.left=Math.min(innerWidth-270,e.clientX+14)+'px';tip.style.top=(e.clientY+14)+'px'}});
app.addEventListener('mouseleave',()=>{tip.style.display='none'});

document.querySelectorAll('.seg button').forEach(b=>b.onclick=()=>{st.r=b.dataset.r;save();render()});
document.querySelectorAll('.tg').forEach(b=>b.onclick=()=>{const t=b.dataset.t;st[t]=t==='dark'?!(st.dark==null?sysDark():st.dark):!st[t];save();render()});
render();
})();
