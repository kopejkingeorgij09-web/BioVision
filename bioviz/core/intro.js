/* Вступление на главной: Cas9 находит мишень на ДНК и режет её, из разреза раскрывается главная.
   Схема держится фактов из учебников и статей о Cas9 S. pyogenes:
   - Cas9 перебирает участки с PAM 5′-NGG-3′ на нецелевой цепи; без совпадения с РНК рядом с PAM отпускает ДНК;
   - направляющая РНК (20 нт) спаривается с целевой цепью, R-петля растёт от PAM к дальнему краю;
   - HNH режет целевую цепь, RuvC нецелевую, обе в одном месте за 3 п.н. до PAM, концы тупые.
   На ноутбуке над схемой крутится настоящая структура PDB 4UN3 (Anders и др., Nature, 2014),
   на ней по очереди выделяются домен PI (узнаёт PAM), РНК с целевой цепью и домены HNH и RuvC.
   Полная версия идёт при первом заходе за день, потом короткая (около секунды). Всегда есть «Пропустить».
   При «уменьшить движение» вступления нет. */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root;

/* та же мишень, что в карточке на главной: 3 нт фланга, протоспейсер 20 нт, PAM AGG, 3 нт фланга */
const FL1='TCA',GUIDE='GCTGACGTCAATGGCATCGA',PAM='AGG',FL2='CTT',TOP=FL1+GUIDE+PAM+FL2,N=TOP.length;
const G0=FL1.length,P0=G0+GUIDE.length,CUT=P0-3;
/* ложный PAM внутри протоспейсера: TGG, к нему Cas9 приходит первым и уходит, потому что РНК не совпадает */
const DECOY=TOP.indexOf('TGG');
const CMP={A:'T',T:'A',G:'C',C:'G'};

const STYLE=`
.intro{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--ink);overflow:hidden;
  transition:background-color .6s ease,opacity .5s ease}
.intro:before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:28px 28px;pointer-events:none;transition:opacity .5s}
.intro.out{background:transparent;pointer-events:none}.intro.out:before{opacity:0}
.intro.gone{opacity:0}
.in-st{position:relative;width:min(1100px,calc(100vw - 32px));display:flex;flex-direction:column;align-items:center;gap:clamp(14px,2.6vh,28px)}
.in-3d{position:relative;width:min(720px,100%);height:min(38vh,360px);opacity:0;transform:translateY(10px) scale(.97);transition:opacity .9s ease,transform 1.2s cubic-bezier(.2,.7,.2,1)}
.in-3d.on{opacity:1;transform:none}
.in-3d .v{position:absolute;inset:0}
.in-3d .src{position:absolute;left:0;right:0;bottom:-6px;text-align:center;font:500 11px/1.4 var(--font-mono);color:var(--muted);letter-spacing:.02em}
.in-leg{display:flex;justify-content:center;flex-wrap:wrap;gap:4px 14px;min-height:1.4em;font:500 11.5px/1.4 var(--font-mono);color:var(--muted);transition:opacity .3s}
.in-leg i{font-style:normal;display:inline-flex;align-items:center;gap:6px}
.in-leg i:before{content:"";width:9px;height:9px;border-radius:2px;background:var(--c)}
.in-dna{position:relative;font-family:var(--font-mono);font-size:clamp(10px,calc(min(100vw - 32px,1100px) / 38),25px);line-height:1;
  display:grid;grid-template-columns:2.2em repeat(${N},1.12em) 2.2em;grid-template-rows:1.5em 1.7em 0em 1.7em 1.5em;margin-bottom:1.9em;transition:grid-template-rows .7s cubic-bezier(.3,.7,.2,1),margin-bottom .7s cubic-bezier(.3,.7,.2,1)}
.in-dna.rl{grid-template-rows:1.5em 1.7em 1.9em 1.7em 1.5em;margin-bottom:0}
@media (max-width:600px){.in-dna{grid-template-columns:1.6em repeat(${N},1em) 1.6em;font-size:clamp(10px,calc((100vw - 28px) / 32.4),16px)}}
.in-dna>*{grid-row:var(--r);display:flex;align-items:center;justify-content:center;position:relative;z-index:1}
.in-dna .e{font-size:.62em;color:var(--muted)}
.in-dna .n{font-weight:600;opacity:0;transform:translate(var(--tx,0),var(--ty,0));transition:transform .9s cubic-bezier(.3,.7,.2,1),opacity .4s ease,color .3s,background-color .3s;border-radius:3px}
.in-dna.go .n{opacity:1;transition-delay:calc(var(--k) * 14ms),calc(var(--k) * 14ms),0s,0s,0s}
.in-dna.go .n.fl{opacity:.4}
.n[data-n=A]{color:var(--nA)}.n[data-n=C]{color:var(--nC)}.n[data-n=G]{color:var(--nG)}.n[data-n=T]{color:var(--nT)}.n[data-n=U]{color:var(--nT)}
.in-dna.go .n.b{opacity:.72}
.in-dna .n.try{outline:1.5px dashed var(--muted);outline-offset:1px}
.in-dna .n.pam{background:var(--mark);color:var(--card)}
.in-dna .n.up{--ty:-.85em}
.in-dna .n.up.dim{opacity:.38}
.in-dna .n.g{opacity:0;background:color-mix(in oklab,var(--mark) 13%,transparent);border-radius:0}
.in-dna .n.g.on{opacity:1;transition-delay:calc((${P0-1} - var(--k)) * 34ms)}
.in-dna .n.g.first{border-radius:4px 0 0 4px}.in-dna .n.g.last{border-radius:0 4px 4px 0}
.in-dna.split .n.L{--tx:calc(-1 * var(--sx,38vw));opacity:0;transition-duration:1s,.8s}
.in-dna.split .n.R{--tx:var(--sx,38vw);opacity:0;transition-duration:1s,.8s}
.in-cas{position:absolute;z-index:0;border-radius:.9em;background:color-mix(in oklab,var(--cut) 14%,transparent);border:1.5px solid color-mix(in oklab,var(--cut) 55%,transparent);
  opacity:0;transition:left .9s cubic-bezier(.4,0,.2,1),width .9s cubic-bezier(.4,0,.2,1),top .7s,height .7s,opacity .4s}
.in-cas.on{opacity:1}
.in-cas b{position:absolute;left:.7em;top:-1.55em;font:600 .62em/1 var(--font-mono);letter-spacing:.06em;color:var(--cut)}
.in-tag{position:absolute;z-index:2;transform:translateX(-50%);white-space:nowrap;font:600 .56em/1 var(--font-mono);letter-spacing:.05em;padding:.35em .55em;border-radius:5px;opacity:0;transition:opacity .3s,transform .3s}
.in-tag.on{opacity:1}
.in-tag.pt{background:var(--mark);color:var(--card)}
.in-tag.no{background:var(--card);color:var(--muted);border:1px solid var(--line)}
.in-tag.hnh{background:#7357A6;color:#fff}.in-tag.ruvc{background:#B08A1E;color:#fff}
.in-cut{position:absolute;z-index:3;width:0;border-left:2px solid var(--mark);transform:scaleY(0);transform-origin:50% 50%;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .5s}
.in-cut.on{transform:none}
.in-dna.split .n.g{--tx:0px;opacity:0;transition-delay:0s}
.in-glow{position:absolute;z-index:0;width:22em;height:22em;margin:-11em 0 0 -11em;border-radius:50%;pointer-events:none;
  background:radial-gradient(closest-side,color-mix(in oklab,var(--cut) 34%,transparent),transparent);opacity:0;transform:scale(.2);transition:opacity .6s,transform 1s cubic-bezier(.2,.7,.2,1)}
.in-glow.on{opacity:1;transform:scale(1)}
.in-glow.off{opacity:0;transform:scale(1.6)}
.in-cap{min-height:5.2em;max-width:66ch;text-wrap:balance;text-align:center;display:flex;flex-direction:column;gap:8px;align-items:center;transition:opacity .3s}
.in-cap b{font:var(--dw,600) clamp(18px,2.3vw,28px)/1.22 var(--font-display);letter-spacing:-.01em}
.in-cap small{font-size:clamp(13px,1.3vw,15px);line-height:1.5;color:var(--muted)}
.in-cap.fade{opacity:0}
.in-skip{position:fixed;z-index:1001;right:max(16px,env(safe-area-inset-right,0px));bottom:max(16px,env(safe-area-inset-bottom,0px));height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:600 14px/1 var(--font-body);cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 8px 24px -12px rgba(0,0,0,.3);transition:opacity .3s}
.in-skip:hover{border-color:var(--cut)}
.in-skip:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.in-skip kbd{font:500 11px/1 var(--font-mono);color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:3px 5px}
@media (pointer:coarse){.in-skip kbd{display:none}}
.in-bar{position:fixed;left:0;top:0;height:2px;background:var(--cut);width:0;z-index:1001;transition:width linear}
.from-cut{animation:inCard .75s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i) * 45ms)}
@keyframes inCard{from{transform:translate(var(--dx),var(--dy)) scale(.3);opacity:0}60%{opacity:1}to{transform:none;opacity:1}}
`;
{const st=document.createElement('style');st.textContent=STYLE;R.appendChild(st)}

const today=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const isHome=()=>/^#?\/?$/.test(location.hash||'');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function webgl(){try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}}

function build(){
  const nt=(c,k,r,cls)=>`<span class="n ${cls}${k<G0||k>=P0+PAM.length?' fl':''} ${k<CUT?'L':'R'}" data-n="${c}" data-k="${k}" style="--r:${r};--k:${k};grid-column:${k+2}">${c}</span>`;
  let h=`<span class="e" style="--r:2;grid-column:1">5′</span><span class="e" style="--r:2;grid-column:${N+2}">3′</span>`;
  h+=`<span class="e" style="--r:4;grid-column:1">3′</span><span class="e" style="--r:4;grid-column:${N+2}">5′</span>`;
  for(let k=0;k<N;k++)h+=nt(TOP[k],k,2,'t');
  for(let k=0;k<N;k++)h+=nt(CMP[TOP[k]],k,4,'b');
  /* направляющая РНК: та же последовательность, что у нецелевой цепи, только U вместо T */
  for(let k=G0;k<P0;k++)h+=`<span class="n g ${k===G0?'first':k===P0-1?'last':''} ${k<CUT?'L':'R'}" data-n="${TOP[k]==='T'?'U':TOP[k]}" style="--r:3;--k:${k};grid-column:${k+2}">${TOP[k]==='T'?'U':TOP[k]}</span>`;
  h+=`<span class="in-cas"><b>Cas9</b></span><span class="in-glow"></span><span class="in-cut t"></span><span class="in-cut b"></span>
    <span class="in-tag no"></span><span class="in-tag pt">PAM</span><span class="in-tag ruvc">RuvC</span><span class="in-tag hnh">HNH</span>`;
  return h}

async function run(full){
  const big=full&&innerWidth>=900&&webgl()&&!(navigator.connection&&navigator.connection.saveData);
  const el=document.createElement('div');el.className='intro';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<div class="in-st">${big?`<div class="in-3d"><div class="v"></div></div><div class="in-leg"></div>`:''}
    <div class="in-dna">${build()}</div><div class="in-cap"><b></b><small></small></div></div>`;
  const skip=document.createElement('button');skip.type='button';skip.className='in-skip';skip.innerHTML='Пропустить <kbd>Esc</kbd>';
  const bar=document.createElement('div');bar.className='in-bar';
  R.appendChild(el);R.appendChild(skip);R.appendChild(bar);
  const html=document.documentElement,ov=html.style.overflow;html.style.overflow='hidden';
  const D=$('.in-dna',el),cap=$('.in-cap',el),cas=$('.in-cas',D),glow=$('.in-glow',D),cuts=$$('.in-cut',D),cutOn=()=>cuts.forEach(c=>c.classList.add('on'));
  const tag=c=>$('.in-tag.'+c,D);
  let stop=false,ended=false,mol=null;
  const T=full?8200:1300;
  requestAnimationFrame(()=>{bar.style.transitionDuration=T+'ms';bar.style.width='100%'});
  const end=()=>{if(ended)return;ended=true;stop=true;finish()};
  const onKey=e=>{if(e.key==='Escape')end()};
  skip.addEventListener('click',end);addEventListener('keydown',onKey);

  /* геометрия: колонки нуклеотидов в координатах схемы */
  const ntAt=(k,row)=>$(`.n.${row||'t'}[data-k="${k}"]`,D);
  function box(a,b){const A=ntAt(a),B=ntAt(b),top=ntAt(a,'t'),bot=ntAt(a,'b');
    return{l:A.offsetLeft,r:B.offsetLeft+B.offsetWidth,t:top.offsetTop,b:bot.offsetTop+bot.offsetHeight}}
  function casTo(a,b,pad){const x=box(Math.max(0,a),Math.min(N-1,b)),p=pad||0.38*parseFloat(getComputedStyle(D).fontSize);
    Object.assign(cas.style,{left:x.l-p+'px',width:x.r-x.l+2*p+'px',top:x.t-p+'px',height:x.b-x.t+2*p+'px'})}
  function tagAt(t,k,above,text){const n=ntAt(k,above?'t':'b');if(text!=null)t.textContent=text;
    const dr=D.getBoundingClientRect(),r=n.getBoundingClientRect();
    t.style.left=r.left-dr.left+r.width/2+'px';t.style.top=above?r.top-dr.top-r.height*1.05+'px':r.top-dr.top+r.height*1.25+'px';t.classList.add('on')}
  async function say(b,s,keep){if(!keep){cap.classList.add('fade');await wait(180)}$('b',cap).textContent=b;$('small',cap).textContent=s||'';cap.classList.remove('fade')}
  const sleep=async ms=>{const t0=Date.now();while(!stop&&Date.now()-t0<ms)await wait(Math.min(60,ms))};

  /* 3D: грузится параллельно, появляется, когда готово */
  const dark=()=>BVHOST.host.getAttribute('data-theme')==='dark';
  const DIM=()=>dark()?'#33423A':'#D7DDD5';
  function paint(mode){if(!mol)return;const v=mol.v,dim=DIM(),pal=BV.mol.palette();
    const st=(sel,c)=>v.setStyle(sel,{cartoon:{color:c,thickness:.45,arrows:true}});
    v.setStyle({},{});
    const on=mode==='all';
    st({chain:'B'},on?pal.protein:dim);
    st({chain:'A'},on||mode==='rl'?pal.rna:dim);
    st({chain:'C'},on||mode==='rl'||mode==='pam'||mode==='cut'?pal.dna:dim);
    st({chain:'D'},on||mode==='pam'||mode==='cut'?pal.dna2:dim);
    if(mode==='pam')st({chain:'B',resi:['1099-1368']},pal.protein);
    if(mode==='cut'){st({chain:'B',resi:['775-908']},pal.violet||'#7357A6');st({chain:'B',resi:['1-59','718-769','909-1098']},pal.lig)}
    v.render();
    const leg=$('.in-leg',el);if(!leg)return;
    const L={all:[[pal.protein,'Cas9'],[pal.rna,'направляющая РНК'],[pal.dna,'целевая цепь'],[pal.dna2,'нецелевая цепь']],
      pam:[[pal.protein,'домен PI, узнаёт PAM'],[pal.dna2,'цепь с PAM'],[pal.dna,'целевая цепь']],
      rl:[[pal.rna,'направляющая РНК'],[pal.dna,'целевая цепь']],
      cut:[[pal.violet||'#7357A6','HNH'],[pal.lig,'RuvC'],[pal.dna,'целевая'],[pal.dna2,'нецелевая цепь']]}[mode]||[];
    leg.innerHTML=L.map(([c,t])=>`<i style="--c:${c}">${esc(t)}</i>`).join('')}
  let mode3='all';
  if(big&&BV.mol){const box3=$('.in-3d',el);
    const src=`PDB 4UN3 · Streptococcus pyogenes · рентгеноструктурный анализ, 2,59 Å · Anders и др., Nature, 2014`;
    BV.mol.viewer($('.v',box3),{pdb:'4UN3',parts:[{chain:'B',name:'Cas9',color:'protein'},{chain:'A',name:'РНК',color:'rna'},{chain:'C',name:'ДНК',color:'dna'},{chain:'D',name:'ДНК',color:'dna2'}]})
      .then(M=>{if(ended){try{M.v.clear()}catch(e){}return}mol=M;paint(mode3);M.v.zoomTo();M.v.zoom(1.15);M.v.render();
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches)M.v.spin('y',.45);
        box3.insertAdjacentHTML('beforeend',`<div class="src">${esc(src)}</div>`);box3.classList.add('on')})
      .catch(()=>{const l=$('.in-leg',el);if(l)l.remove();box3.remove()})}
  const m3=m=>{mode3=m;paint(m)};

  try{
    await wait(30);D.classList.add('go');
    if(full){
      casTo(-1,7);await wait(60);cas.classList.add('on');
      await say('Cas9 скользит по ДНК и ищет PAM','Это короткая метка 5′-NGG-3′ на нецелевой цепи. Без неё Cas9 мишень не узнаёт.',true);await sleep(450);
      if(stop)throw 0;
      /* ложный PAM */
      casTo(DECOY-12,DECOY+3);await sleep(950);
      for(let k=DECOY;k<DECOY+3;k++)ntAt(k).classList.add('try');m3('pam');
      tagAt(tag('no'),DECOY+1,true,'TGG');
      await say('Здесь PAM есть, но мишени нет','РНК не совпадает с ДНК рядом с этим TGG, и Cas9 отпускает ДНК.');await sleep(1150);
      if(stop)throw 0;
      for(let k=DECOY;k<DECOY+3;k++)ntAt(k).classList.remove('try');tag('no').classList.remove('on');
      /* настоящий PAM */
      casTo(P0-12,P0+3);await sleep(750);
      for(let k=P0;k<P0+3;k++)ntAt(k).classList.add('pam');tagAt(tag('pt'),P0+1,true);
      await say('PAM 5′-AGG-3′, и рядом совпадение','Домен PI держит PAM, Cas9 начинает расплетать ДНК прямо за ним.');await sleep(1050);
      if(stop)throw 0;
      /* R-петля */
      tag('pt').classList.remove('on');D.classList.add('rl');m3('rl');setTimeout(()=>casTo(G0-1,P0+3),720);
      for(let k=G0;k<P0;k++){const n=ntAt(k);n.classList.add('up','dim')}
      $$('.g',D).forEach(g=>g.classList.add('on'));
      await say('Направляющая РНК спаривается с целевой цепью','20 нуклеотидов, начиная от PAM. Вторая цепь вытесняется, получается R-петля.');await sleep(1450);
      if(stop)throw 0;
      /* разрез */
      m3('cut');placeCut();cutOn();
      tagAt(tag('ruvc'),CUT,true);await wait(160);tagAt(tag('hnh'),CUT,false);
      await say('HNH режет целевую цепь, RuvC вторую','Обе в одном месте, за 3 пары оснований до PAM. Концы получаются тупые.');await sleep(1350);
      if(stop)throw 0}
    else{
      D.style.transition='none';D.classList.add('rl');void D.offsetHeight;for(let k=G0;k<P0;k++)ntAt(k).classList.add('up','dim');for(let k=P0;k<P0+3;k++)ntAt(k).classList.add('pam');
      $$('.g',D).forEach(g=>{g.style.transitionDelay='0s';g.classList.add('on')});casTo(G0-1,P0+3);cas.classList.add('on');
      await say('Cas9 · разрез за 3 п.н. до PAM','',true);await sleep(380);placeCut();cutOn();await sleep(260)}
    /* ДНК расходится, из разреза открывается главная */
    splitAndOpen()}
  catch(e){if(!ended)splitAndOpen()}

  /* разрез только по двум цепям ДНК; РНК не режется. Координаты с учётом сдвига вытесненной цепи */
  function placeCut(){const dr=D.getBoundingClientRect(),a=ntAt(CUT-1).getBoundingClientRect(),b=ntAt(CUT).getBoundingClientRect();
    const x=(a.right+b.left)/2-dr.left;
    [['t',ntAt(CUT,'t')],['b',ntAt(CUT,'b')]].forEach(([c,n])=>{const r=n.getBoundingClientRect();
      Object.assign($('.in-cut.'+c,D).style,{left:x-1+'px',top:r.top-dr.top-4+'px',height:r.height+8+'px'})});
    const t=ntAt(CUT,'t'),bt=ntAt(CUT,'b');
    Object.assign(glow.style,{left:x+'px',top:(t.offsetTop+bt.offsetTop+bt.offsetHeight)/2+'px'});return x}
  function splitAndOpen(){if(splitAndOpen.done)return;splitAndOpen.done=1;
    const x=placeCut();glow.classList.add('on');
    $$('.in-tag',D).forEach(t=>t.classList.remove('on'));cas.classList.remove('on');cuts.forEach(c=>c.style.opacity='0');
    D.classList.add('split');cap.classList.add('fade');const b3=$('.in-3d',el);if(b3){b3.style.transition='opacity .5s';b3.style.opacity='0'}
    const l=$('.in-leg',el);if(l)l.style.opacity='0';
    const r=glow.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    setTimeout(()=>{el.classList.add('out');glow.classList.add('off');open(cx,cy)},full&&!ended?380:120);
    setTimeout(cleanup,full&&!ended?1300:700)}
  function cleanup(){if(cleanup.done)return;cleanup.done=1;ended=true;removeEventListener('keydown',onKey);
    el.classList.add('gone');skip.style.opacity='0';bar.remove();html.style.overflow=ov;
    setTimeout(()=>{if(mol){try{mol.spin(false);mol.v.clear()}catch(e){}}el.remove();skip.remove()},520)}
  /* пропуск в любой момент: сразу к главной */
  function finish(){splitAndOpen()}
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
