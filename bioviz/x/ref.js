/* Раздел «Конспекты»: все конспекты с визуализациями в одном месте.
   Заменил старый «Справочник» (id модуля оставлен ref, чтобы старые ссылки #ref вели сюда).
   Новые конспекты, добавленные через BV.VZ.doc / BV.VZ.sec (или BV.K.doc / BV.K.sec) в файлах,
   которые грузятся после этого, появятся здесь сами. */
(function(){
const {$,$$,esc,store,hooks}=BV;
const K=BV.K;
/* конспекты, встроенные в bv.js (их реестр закрыт, поэтому описаны здесь) */
const D={
 tour:{kick:'Занятие 1',title:'Клетка: мембрана, цитоплазма, ядро',lead:'Общий план строения клетки, плазматическая мембрана, мембранный транспорт, ядро и рибосомы. Схемы с номерами можно проходить в режиме «Проверь себя».',
  secs:[['plan',1,'Общий план строения эукариотической клетки'],['mem',2,'Плазматическая мембрана'],['tr',3,'Мембранный транспорт'],['nuc',4,'Ядро'],['rib',5,'Рибосомы']]},
 cell:{kick:'Занятия 1–2',title:'Органоиды клетки',lead:'ЭПС и аппарат Гольджи, лизосомы, пероксисомы и вакуоли, митохондрии и пластиды, клеточные стенки, органеллы на электронограммах и цитоскелет.',
  secs:[['er',6,'Эндоплазматическая сеть (ЭПС)'],['golgi',7,'Аппарат Гольджи и путь белка на экспорт'],['lys',8,'Лизосомы, пероксисомы, вакуоли'],['mit',9,'Митохондрии'],['pl',10,'Пластиды, эндосимбиоз, клеточные стенки'],['sum',11,'Сводка: органеллы на схеме и на электронограмме'],['csk',12,'Цитоскелет, клеточный центр, реснички и жгутики']]},
 chem:{kick:'Биохимия клетки',title:'Химический состав клетки',lead:'Элементы, вода и соли, углеводы, липиды, белки, ферменты, нуклеиновые кислоты и АТФ. Молекулы можно крутить, нагревать, растворять и ломать.',
  secs:[['el',1,'Элементный состав клетки'],['water',2,'Вода'],['salt',3,'Минеральные соли, pH и осмос'],['poly',4,'Органические вещества: полимеры'],['carb',5,'Углеводы'],['lip',6,'Липиды'],['prot',7,'Белки'],['enz',8,'Ферменты'],['nuc',9,'Нуклеотиды, ДНК, РНК и АТФ'],['sum',10,'Сводные таблицы'],['trap',11,'Ловушки ЕГЭ'],['test',12,'Самопроверка']]}};
const ORDER=['tour','cell','chem','energy','osmos'];
const short=s=>String(s||'').replace(/^Конспект\s*·\s*/,'').replace(/\s*·\s*(школа \+ )?вузовский уровень$/,'');
/* перехват регистрации из дополнений */
const oDoc=K.doc,oSec=K.sec;
K.doc=(m,d)=>{const x=D[m]=D[m]||{secs:[]};if(d.kick)x.kick=short(d.kick);if(d.title)x.title=d.title;if(d.lead)x.lead=d.lead;(d.sections||[]).forEach(s=>x.secs.push([s.id,s.no,s.t]));if(!ORDER.includes(m))ORDER.push(m);return oDoc(m,d)};
K.sec=(m,s)=>{const x=D[m]=D[m]||{secs:[]};x.secs.push([s.id,s.no,s.t]);if(!ORDER.includes(m))ORDER.push(m);return oSec(m,s)};

const CSS=`
.kh-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.kh-top input{flex:1 1 260px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:12px;padding:10px 14px;font:inherit;font-size:15px}
.kh-cont{display:flex;align-items:center;gap:14px;border:1px solid color-mix(in oklab,var(--eosin) 35%,var(--line));background:color-mix(in oklab,var(--eosin) 7%,var(--surface));border-radius:16px;padding:14px 18px;text-align:left;cursor:pointer;color:var(--ink);width:100%}
.kh-cont:hover{border-color:var(--eosin)}
.kh-cont small{display:block;font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--eosin);font-weight:700}
.kh-cont b{font-size:16px}.kh-cont span{color:var(--muted);font-size:13.5px}
.kh-cont .ar{margin-left:auto;font-size:22px;color:var(--eosin)}
.kh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:16px;align-items:start}
.kh-card{background:var(--surface);border:1px solid var(--line);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;min-width:0;transition:border-color .15s,transform .15s}
.kh-card:hover{border-color:var(--hema)}
.kh-band{height:92px;position:relative;overflow:hidden;cursor:pointer;border:0;padding:0;width:100%;display:block}
.kh-band svg{position:absolute;inset:0;width:100%;height:100%}
.kh-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:8px}
.kh-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.kh-tag{font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:2px 9px}
.kh-tag.v{color:#0b7479;border-color:color-mix(in oklab,#0e8a8f 35%,var(--line));background:color-mix(in oklab,#0e8a8f 9%,var(--surface))}
:host([data-theme="dark"]) .kh-tag.v{color:#43cfc8}
.kh-card h3{font-family:var(--font-display);font-size:20px;line-height:1.18;letter-spacing:-.01em;margin:2px 0 0}
.kh-card p{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;margin:0;font-size:14.2px;line-height:1.55;color:var(--muted)}
.kh-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.kh-secs{border-top:1px solid var(--line);margin-top:6px;padding-top:6px}
.kh-secs summary{cursor:pointer;font-size:13.5px;font-weight:600;color:var(--hema);padding:6px 0;list-style:none}
.kh-secs summary::-webkit-details-marker{display:none}
.kh-secs summary:before{content:"▸ ";display:inline-block;transition:transform .15s}
.kh-secs[open] summary:before{transform:rotate(90deg)}
.kh-secs ol{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:1px}
.kh-secs button{all:unset;box-sizing:border-box;display:flex;gap:10px;width:100%;padding:6px 8px;border-radius:8px;cursor:pointer;font-size:14px;line-height:1.35;color:var(--ink)}
.kh-secs button:hover,.kh-secs button:focus-visible{background:var(--surface-2)}
.kh-secs button i{font-style:normal;flex:none;min-width:22px;color:var(--muted);font-variant-numeric:tabular-nums;font-weight:600}
.kh-secs button.v i{color:#0e8a8f}
.kh-empty{color:var(--muted);padding:12px 2px}
.kh-soon{border:1.5px dashed var(--line);border-radius:20px;padding:22px;color:var(--muted);font-size:14px;display:flex;flex-direction:column;gap:6px;justify-content:center;min-height:180px}
.kh-soon b{color:var(--ink);font-size:15px}
mark.kh,mark.kh-hit{background:var(--eosin-soft);color:inherit;border-radius:3px;padding:0 1px}
mark.kh-hit{outline:2px solid var(--eosin);transition:outline-color 1s,background-color 1s}
mark.kh-hit.off{outline-color:transparent;background:transparent}
.kh-secs .kh-snip{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
`;
const st=document.createElement('style');st.textContent=CSS;BVHOST.root.appendChild(st);

/* меню: группа «Теория» с «Конспектами» и «Карточками» */
$('.nav-item[data-go="tour"]').insertAdjacentHTML('beforebegin',`<p class="nav-group">Теория</p><button class="nav-item" data-go="ref">Конспекты <span class="new">новое</span></button><button class="nav-item" data-go="cards">Карточки <span class="new">новое</span></button>`);
const grp=[...$$('.nav-group')].find(g=>g.textContent.trim()==='Клетка');if(grp)$('.nav-item[data-go="tour"]').before(grp);
$('main').insertAdjacentHTML('beforeend',`<section class="module" id="m-ref" hidden>
 <header class="mod-head"><p class="eyebrow">Теория · школа, олимпиады, вуз</p><h1>Конспекты с визуализациями</h1><p class="lead" id="khLead"></p></header>
 <div id="khBody"></div></section>`);

const modName=id=>{const b=$(`.nav-item[data-go="${id}"]`);return b?b.childNodes[0].textContent.trim():id};
const modGroup=id=>{let g=$(`.nav-item[data-go="${id}"]`);g=g&&g.previousElementSibling;while(g&&!g.classList.contains('nav-group'))g=g.previousElementSibling;return g?g.textContent.trim():''};
/* разделы берём из реестра конспектов BV.KR: туда попадают и разделы, вставленные через BV.DEEP.insert,
   которых нет в перехвате K.doc/K.sec; порядок в реестре совпадает с порядком в конспекте */
const krSecs=m=>{const k=(BV.KR||{})[m];return k&&k.sections&&k.sections.length?k.sections.map(s=>[s.id,s.no??'',s.t]):null};
const docs=()=>ORDER.filter(m=>D[m]&&D[m].title&&$('#m-'+m)).map(m=>{const d=D[m];const secs=krSecs(m)||d.secs.slice().sort((a,b)=>a[1]-b[1]);return{m,...d,secs,name:modName(m),group:modGroup(m),vuz:secs.some(s=>/вуз/i.test(s[2]))||/вуз/i.test(d.kick||'')||m==='energy'||m==='osmos'}});

/* обложки: простые узнаваемые мотивы в тонах темы */
const ART={
 tour:`<circle cx="70%" cy="60" r="62" fill="var(--eosin)" opacity=".13"/><circle cx="70%" cy="60" r="62" fill="none" stroke="var(--eosin)" stroke-width="2.5" opacity=".55"/><circle cx="74%" cy="56" r="20" fill="var(--hema)" opacity=".35"/><circle cx="74%" cy="56" r="7" fill="var(--hema)" opacity=".7"/>`,
 cell:`<ellipse cx="62%" cy="48" rx="44" ry="20" fill="none" stroke="var(--eosin)" stroke-width="2.5" opacity=".6"/><ellipse cx="82%" cy="58" rx="28" ry="14" fill="var(--ok)" opacity=".25" stroke="var(--ok)" stroke-width="2"/><circle cx="45%" cy="64" r="9" fill="var(--hema)" opacity=".4"/>`,
 chem:`<g stroke="var(--hema)" stroke-width="2.5" fill="none" opacity=".6"><polygon points="300,22 326,37 326,67 300,82 274,67 274,37"/></g><circle cx="300" cy="22" r="6" fill="var(--eosin)" opacity=".7"/><circle cx="360" cy="40" r="8" fill="var(--ok)" opacity=".5"/>`,
 energy:`<path d="M240 70 Q290 10 340 50 T430 40" fill="none" stroke="var(--eosin)" stroke-width="3" opacity=".6"/><circle cx="430" cy="40" r="12" fill="var(--eosin)" opacity=".35"/><text x="415" y="45" font-size="12" font-weight="700" fill="var(--eosin)">АТФ</text>`,
 osmos:`<line x1="320" y1="0" x2="320" y2="100" stroke="var(--hema)" stroke-width="3" stroke-dasharray="6 6" opacity=".5"/><g fill="var(--hema)" opacity=".45"><circle cx="280" cy="30" r="5"/><circle cx="260" cy="62" r="5"/><circle cx="350" cy="48" r="5"/></g><g fill="var(--eosin)" opacity=".5"><circle cx="372" cy="22" r="7"/><circle cx="395" cy="66" r="7"/><circle cx="358" cy="78" r="7"/></g>`};
const band=m=>`<svg viewBox="0 0 480 92" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><rect width="480" height="92" fill="var(--surface-2)"/>${ART[m]||`<circle cx="380" cy="46" r="40" fill="var(--hema)" opacity=".15"/>`}</svg>`;

let q='';
const norm=s=>String(s).toLowerCase().replace(/ё/g,'е');

/* полнотекстовый поиск: текст каждого раздела берём из его html() один раз и кешируем */
let TX=null;
const unhtml=h=>{const t=document.createElement('template');t.innerHTML=String(h).replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi,' ');return (t.content.textContent||'').replace(/\s+/g,' ').trim()};
function textIndex(){if(TX)return TX;TX={};
 Object.entries(BV.KR||{}).forEach(([m,k])=>{TX[m]={};(k.sections||[]).forEach(s=>{let h='';try{h=typeof s.html==='function'?s.html():s.html||''}catch(e){}TX[m][s.id]=unhtml(h)})});
 return TX}
/* q уже нормализован; возвращает отрывок вокруг первого совпадения или null */
function snip(m,id,q){const t=(textIndex()[m]||{})[id];if(!t)return null;const i=norm(t).indexOf(q);if(i<0)return null;
 const a=Math.max(0,i-50),b=Math.min(t.length,i+q.length+70);return (a?'…':'')+t.slice(a,b)+(b<t.length?'…':'')}
/* все разделы, где встречается q: в названии или в тексте */
function find(raw){const qq=norm(String(raw).trim());if(qq.length<2)return [];const out=[];
 docs().forEach(d=>d.secs.forEach(s=>{const inT=norm(s[2]).includes(qq),sn=inT?null:snip(d.m,s[0],qq);
  if(inT||sn)out.push({m:d.m,s:s[0],no:s[1],title:s[2],doc:d.title,snip:sn})}));
 return out}
/* после открытия раздела находим совпадение в тексте, подсвечиваем и прокручиваем к нему */
function hitText(m,s,raw){const qq=norm(String(raw||'').trim());if(qq.length<2)return;let n=0;
 const go=()=>{const mod=$('#m-'+m),root=mod&&(s&&$('#k-'+s,mod)||$('.k-doc:not([hidden])',mod));
  if(root&&root.offsetParent){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while((node=w.nextNode())){const i=norm(node.data).indexOf(qq);if(i<0||!node.parentElement||!node.parentElement.offsetParent)continue;
    const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+qq.length);const mk=document.createElement('mark');mk.className='kh-hit';
    try{r.surroundContents(mk)}catch(e){return}
    /* openDoc сам докручивает к началу раздела ещё ~1 с, поэтому повторяем прокрутку к находке */
    [0,600,1300].forEach(t=>setTimeout(()=>{if(mk.isConnected)mk.scrollIntoView({block:'center'})},t));
    setTimeout(()=>mk.classList.add('off'),3500);setTimeout(()=>{if(mk.parentNode)mk.replaceWith(...mk.childNodes)},4600);return}}
  if(++n<40)setTimeout(go,80)};
 setTimeout(go,120)}
const hl=t=>{if(!q)return esc(t);const i=norm(t).indexOf(q);return i<0?esc(t):esc(t.slice(0,i))+'<mark class="kh">'+esc(t.slice(i,i+q.length))+'</mark>'+esc(t.slice(i+q.length))};

function render(){
 const all=docs(),secTot=all.reduce((a,d)=>a+d.secs.length,0);
 $('#khLead').textContent=`${all.length} ${pl(all.length,'конспект','конспекта','конспектов')}, ${secTot} ${pl(secTot,'раздел','раздела','разделов')}. Теория с интерактивными рисунками, задания с разбором и вузовские вставки. Откройте конспект целиком или сразу нужный раздел.`;
 const L=all.map(d=>{if(!q)return{...d,open:false};const hitDoc=norm(d.title+' '+d.lead+' '+d.name).includes(q);
  const secs=d.secs.filter(s=>norm(s[2]).includes(q)||(q.length>1&&(s[3]=snip(d.m,s[0],q)))).map(s=>s.slice());d.secs.forEach(s=>{s.length=3});
  return hitDoc||secs.length?{...d,secs:secs.length?secs:d.secs,open:!!secs.length}:null}).filter(Boolean);
 const last=store.get('khLast',null),ld=last&&all.find(d=>d.m===last.m),ls=ld&&last.s&&ld.secs.find(s=>s[0]===last.s);
 $('#khBody').innerHTML=`<div style="display:flex;flex-direction:column;gap:16px">
  ${ld&&!q?`<button class="kh-cont" data-o="${ld.m}" data-s="${ls?ls[0]:''}"><span><small>Продолжить</small><b>${esc(ld.title)}</b><br><span>${ls?'§ '+ls[1]+'. '+esc(ls[2]):'с начала конспекта'}</span></span><span class="ar" aria-hidden="true">→</span></button>`:''}
  <div class="kh-top"><input id="khQ" type="search" placeholder="Найти тему: митохондрии, ферменты, тоничность…" value="${esc(q)}" aria-label="Поиск по конспектам"></div>
  <div class="kh-grid">${L.map(card).join('')}${!q?`<div class="kh-soon"><b>Скоро здесь будет больше</b>Новые конспекты появятся в этом разделе автоматически, как только их добавят к любой теме.</div>`:''}</div>
  ${!L.length?`<p class="kh-empty">По запросу «${esc(q)}» ничего не нашлось.</p>`:''}</div>`;
 const inp=$('#khQ');inp.addEventListener('input',()=>{q=norm(inp.value.trim());clearTimeout(render.t);render.t=setTimeout(()=>{render();const i=$('#khQ');i.focus();i.setSelectionRange(i.value.length,i.value.length)},200)});
 $$('#khBody [data-o]').forEach(b=>b.addEventListener('click',()=>{openDoc(b.dataset.o,b.dataset.s||null);if(q&&b.dataset.s)hitText(b.dataset.o,b.dataset.s,q)}));
}
function card(d){return `<article class="kh-card"><button class="kh-band" data-o="${d.m}" aria-label="Открыть конспект «${esc(d.title)}»">${band(d.m)}</button>
 <div class="kh-body"><div class="kh-meta"><span class="kh-tag" title="${esc(d.group)}">${esc(d.name)}</span>${d.vuz?'<span class="kh-tag v">вуз</span>':''}<span class="kh-tag">${d.secs.length} ${pl(d.secs.length,'раздел','раздела','разделов')}</span></div>
 <h3>${hl(d.title)}</h3><p>${hl(d.lead||'')}</p>
 <div class="kh-acts"><button class="btn" data-o="${d.m}">Открыть конспект</button><button class="btn ghost" data-viz="${d.m}" title="Интерактивные модели этого раздела без текста">Визуализации</button></div>
 <details class="kh-secs"${d.open?' open':''}><summary>${d.open?'Найдено в разделах':'Содержание'}</summary><ol>${d.secs.map(s=>`<li><button class="${/вуз/i.test(s[2])?'v':''}" data-o="${d.m}" data-s="${s[0]}"><i>${s[1]}</i><span>${hl(s[2])}${s[3]?`<span class="kh-snip">${hl(s[3])}</span>`:''}</span></button></li>`).join('')}</ol></details></div></article>`}
function pl(n,a,b,c){const m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c}

/* открыть раздел в режиме «Конспект с визуализациями» и при необходимости прокрутить к параграфу */
function openDoc(m,s){store.set('khLast',{m,s});BV.go(m);try{history.replaceState(null,'','#'+m)}catch(e){}
 const mod=$('#m-'+m);const sw=mod&&$('.k-switch button[data-m="doc"]',mod);if(sw&&sw.getAttribute('aria-pressed')!=='true')sw.click();
 window.scrollTo({top:0});
 if(s){let n=0;const go=()=>{const el=mod&&$('#k-'+s,mod);if(el&&el.offsetParent){el.scrollIntoView({block:'start'});return}if(++n<40)setTimeout(go,60)};setTimeout(go,30)}}
function openViz(m){BV.go(m);try{history.replaceState(null,'','#'+m)}catch(e){}const mod=$('#m-'+m);const sw=mod&&$('.k-switch button[data-m="viz"]',mod);if(sw&&sw.getAttribute('aria-pressed')!=='true')sw.click();window.scrollTo({top:0})}
BVHOST.root.addEventListener('click',e=>{const b=BV_ET(e).closest&&BV_ET(e).closest('#m-ref [data-viz]');if(b)openViz(b.dataset.viz)});

BV.konspOpen=openDoc;BV.konspList=docs;BV.konspFind=find;BV.konspHit=hitText;
/* старые вызовы справочника ведут в конспекты */
BV.refOpen=()=>{BV.go('ref');try{history.replaceState(null,'','#ref')}catch(e){}window.scrollTo({top:0})};
hooks.ref={show:render};
})();
