/* Карточки терминов: термин из словаря лекции подчёркнут пунктиром в тексте (первое упоминание в каждом разделе),
   при наведении, фокусе или касании показывается карточка с определением.
   Определения берутся из словаря самой лекции (список dt/dd в разделе «Словарь»), поэтому на сайте
   нет ничего, чего нет в словаре. Если у термина в словаре есть английский оригинал или источник,
   лекция может передать их через BV.termX[idЛекции] или BV.terms.extra(idЛекции, {'Термин': {en, src}}). */
(function(){
const {$,$$,esc}=BV,R=BVHOST.root;

const STYLE=`
.tm{text-decoration:underline dotted;text-decoration-color:color-mix(in oklab,var(--cut) 70%,transparent);text-decoration-thickness:1.5px;text-underline-offset:3px;cursor:help;border-radius:3px}
.tm:hover,.tm.on{background:color-mix(in oklab,var(--cut) 11%,transparent)}
.tm:focus-visible{outline:2px solid var(--cut);outline-offset:1px}
.tm-card{position:fixed;z-index:75;width:min(340px,calc(100vw - 24px));background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:12px;
  box-shadow:0 18px 44px -16px rgba(0,0,0,.35);padding:12px 14px 11px;font:400 14.4px/1.5 var(--font-body);opacity:0;transform:translateY(4px);transition:opacity .14s,transform .14s;pointer-events:none}
.tm-card.on{opacity:1;transform:none;pointer-events:auto}
.tm-card b{display:block;font:var(--dw,600) 16px/1.25 var(--font-display);margin-bottom:4px}
.tm-card .en{font:500 12px/1.3 var(--font-mono);color:var(--muted);margin:-1px 0 6px}
.tm-card p{margin:0}
.tm-card .src{margin-top:7px;font:500 11.5px/1.4 var(--font-mono);color:var(--muted)}
.tm-card button{all:unset;cursor:pointer;margin-top:9px;font:600 12.5px/1 var(--font-body);color:var(--cut);display:inline-flex;gap:6px;align-items:center}
.tm-card button:hover{text-decoration:underline}
.tm-card button:focus-visible{outline:2px solid var(--cut);outline-offset:2px;border-radius:4px}
`;
{const st=document.createElement('style');st.textContent=STYLE;R.appendChild(st)}

/* лекция может записать данные заранее в BV.termX[idЛекции], ещё до загрузки этого файла */
const EXTRA=BV.termX=BV.termX||{};
const norm=s=>String(s).toLowerCase().replace(/ё/g,'е');
const L='а-яёa-z0-9';
/* слово → основа: у длинных слов отрезаем окончание, чтобы находились падежные формы */
function stem(w){const n=norm(w);if(/[^а-я]/.test(n)||n.length<5)return n;return n.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ой|ей|ый|ий|ая|яя|ое|ее|ые|ие|ов|ев|ам|ям|ах|ях|ом|ем|ую|юю|ы|и|а|я|о|е|у|ю|ь|й)$/,'')}
function rxFor(t){
  /* аббревиатуры и латинские названия генов ищем точно */
  if(/^[A-ZА-ЯЁ0-9]{2,}$/.test(t)||/^[A-Z][a-z]{2,3}[A-Z]$/.test(t))return new RegExp(`(?<![${L}])${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![${L}])`,'u');
  const parts=t.split(/[\s-]+/).filter(Boolean).map(w=>{const s=stem(w);return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/е/g,'[её]')+`[${L}]*`});
  return new RegExp(`(?<![${L}])`+parts.join('[\\s\\u00a0-]+'),'iu')}

const SKIP='h1,h2,h3,h4,a,button,figure,.kf,dl,.k-q,.mb-ref,code,kbd,.tm,svg,input,label,.k-toc,figcaption,.kf-ph,.k-dock,.mb-glf,small,.k-box>b:first-child';
function glossary(sheet){
  const dl=$$('dl',sheet).find(d=>$$('dt',d).length>=5);if(!dl)return[];
  const out=[];$$('dt',dl).forEach(dt=>{const dd=dt.nextElementSibling;if(!dd||dd.tagName!=='DD')return;const t=dt.textContent.trim();if(t&&t!=='Ничего')out.push({t,d:dd.innerHTML,rx:rxFor(t)})});
  /* длинные термины раньше, чтобы «вторичный эндосимбиоз» не перехватил просто «эндосимбиоз» */
  return out.sort((a,b)=>b.t.length-a.t.length)}

function mark(sheet,lid){if(sheet.dataset.tm)return;const G=glossary(sheet);if(!G.length)return;sheet.dataset.tm='1';sheet._tm={G,lid,dl:$$('dl',sheet).find(d=>$$('dt',d).length>=5)};
  $$('.k-sec',sheet).forEach(sec=>{if(sec.contains(sheet._tm.dl))return;const used=new Set();
    const walk=document.createTreeWalker(sec,NodeFilter.SHOW_TEXT,{acceptNode:n=>!n.nodeValue.trim()||n.parentElement.closest(SKIP)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
    const nodes=[];while(walk.nextNode())nodes.push(walk.currentNode);
    for(const node of nodes){let n=node;
      for(let gi=0;gi<G.length;gi++){if(used.has(gi)||!n)continue;const m=G[gi].rx.exec(n.nodeValue);if(!m)continue;
        used.add(gi);const a=n.splitText(m.index),rest=a.splitText(m[0].length);
        const sp=document.createElement('span');sp.className='tm';sp.tabIndex=0;sp.dataset.g=gi;sp.setAttribute('role','button');sp.setAttribute('aria-label',`${m[0]}: определение`);
        a.replaceWith(sp);sp.appendChild(a);n=rest}}})}

/* ---------- карточка ---------- */
const card=document.createElement('div');card.className='tm-card';card.setAttribute('role','tooltip');card.id='tmCard';R.appendChild(card);
let curEl=null,hideT=0,showT=0,shownAt=0;
function show(el){clearTimeout(hideT);const sheet=el.closest('.k-sheet');const T=sheet&&sheet._tm;if(!T)return;const g=T.G[+el.dataset.g];if(!g)return;
  const x=(EXTRA[T.lid]||{})[g.t]||{};
  card.innerHTML=`<b>${esc(g.t)}</b>${x.en?`<div class="en">${esc(x.en)}</div>`:''}<p>${g.d}</p>${x.src?`<div class="src">Источник: ${esc(x.src)}</div>`:''}<button type="button">В словарь лекции →</button>`;
  $('button',card).onclick=()=>{hide(true);const dl=T.dl;if(!dl)return;const y=dl.getBoundingClientRect().top+scrollY-(parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60)-80;window.scrollTo({top:y,behavior:'smooth'})};
  if(curEl!==el)shownAt=Date.now();if(curEl&&curEl!==el)curEl.classList.remove('on');curEl=el;el.classList.add('on');el.setAttribute('aria-describedby','tmCard');
  const r=el.getBoundingClientRect(),w=card.offsetWidth||340;card.classList.add('on');
  const h=card.offsetHeight,bar=parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60;
  let left=Math.min(Math.max(12,r.left+r.width/2-w/2),innerWidth-w-12),top=r.bottom+8;
  if(top+h>innerHeight-12&&r.top-h-8>bar+4)top=r.top-h-8;
  card.style.left=left+'px';card.style.top=top+'px'}
function hide(now){clearTimeout(showT);clearTimeout(hideT);const f=()=>{card.classList.remove('on');if(curEl){curEl.classList.remove('on');curEl.removeAttribute('aria-describedby')}curEl=null};if(now)f();else hideT=setTimeout(f,160)}
const fine=()=>matchMedia('(hover:hover) and (pointer:fine)').matches;
R.addEventListener('mouseover',e=>{if(!fine())return;const t=BV_ET(e);const el=t.closest&&t.closest('.tm');
  if(el){clearTimeout(hideT);if(el!==curEl){clearTimeout(showT);showT=setTimeout(()=>show(el),220)}return}
  if(t.closest&&t.closest('.tm-card')){clearTimeout(hideT);return}
  if(curEl)hide()});
R.addEventListener('click',e=>{const t=BV_ET(e);const el=t.closest&&t.closest('.tm');
  if(el){if(curEl===el&&!fine()&&Date.now()-shownAt>400)hide(true);else show(el);return}
  if(!(t.closest&&t.closest('.tm-card'))&&curEl)hide(true)});
R.addEventListener('focusin',e=>{const el=BV_ET(e).closest&&BV_ET(e).closest('.tm');if(el)show(el)});
R.addEventListener('focusout',e=>{const n=e.relatedTarget;if(curEl&&!(n&&(n.closest('.tm-card')||n.closest('.tm'))))hide()});
R.addEventListener('keydown',e=>{if(e.key==='Escape'&&curEl){const el=curEl;hide(true);el.focus({preventScroll:true})}
  else if((e.key==='Enter'||e.key===' ')&&BV_ET(e).classList&&BV_ET(e).classList.contains('tm')){e.preventDefault();show(BV_ET(e))}});
addEventListener('scroll',()=>{if(curEl)hide(true)},{passive:true});

/* лекции рисуются по мере открытия: размечаем каждый новый лист конспекта */
function scan(){$$('.k-sheet').forEach(s=>{if(s.dataset.tm)return;const m=s.closest('[id^="m-"]');mark(s,m?m.id.slice(2):'')})}
new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,120)}).observe(R,{childList:true,subtree:true});
scan();
BV.terms={extra:(lid,map)=>{EXTRA[lid]=Object.assign(EXTRA[lid]||{},map)},scan};
})();
