/* Связи между разделами: под каждым разделом конспекта — карточки и задачи по теме,
   а у неверно решённой задачи — ссылка на нужный раздел конспекта.
   Подбор автоматический: по редким общим словам, поэтому новые конспекты и задачи подхватываются сами. */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root;

const CSS=`
.sec-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:18px 0 2px;padding-top:12px;border-top:1px dashed var(--line)}
.sec-foot b{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-right:2px}
.sec-foot button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:7px;font:600 13.5px var(--font-body);color:var(--ink);border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:var(--surface)}
.sec-foot button:hover{border-color:var(--hema);color:var(--hema)}
.sec-foot button i{font-style:normal;font-weight:700;font-size:11.5px;padding:1px 7px;border-radius:999px;background:var(--surface-2);color:var(--muted)}
.sec-foot button:hover i{background:var(--hema-soft);color:var(--hema)}
.tk-theory{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;padding:10px 12px;border-radius:12px;background:color-mix(in oklab,var(--hema) 7%,var(--surface));border:1px solid color-mix(in oklab,var(--hema) 25%,var(--line));font-size:13.8px}
.tk-theory span{color:var(--muted)}
.tk-theory button{all:unset;cursor:pointer;font-weight:700;color:var(--hema);border-bottom:1.5px solid color-mix(in oklab,var(--hema) 40%,transparent)}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

/* ---------- ключевые слова разделов ----------
   Подбор идёт по ним, а не по «похожести текста»: так задача попадает именно в свой раздел.
   Новый раздел может объявить свои: BV.VZ.sec(mod,{id,no,t,kw:['...'],html}). */
const KW={
 'tour/plan':['прокариот','эукариот','нуклеоид','органоид','гликокаликс'],
 'tour/mem':['фосфолипид','бислой','мембранный белок','жидкостно-мозаичн','текучесть мембран','холестерин в мембран'],
 'tour/tr':['диффуз','натрий-калиев','активный транспорт','симпорт','антипорт','эндоцитоз','экзоцитоз','фагоцитоз','пиноцитоз','аквапорин'],
 'tour/nuc':['ядрышк','ядерная пора','кариоплазм','хроматин','ламин'],
 'tour/rib':['рибосом','полисом','свердберг','малая субъединиц','большая субъединиц'],
 'cell/er':['эпс','эндоплазматическ','ретикулум','детоксикац'],
 'cell/golgi':['гольджи','везикул','секрец','гликозилирован','сортировк'],
 'cell/lys':['лизосом','пероксисом','вакуол','автолиз','каталаз','тонопласт'],
 'cell/mit':['митохондри','криста','окислительное фосфорилирован','атф-синтаз','хемиосмос'],
 'cell/pl':['пластид','хлоропласт','тилакоид','грана','лейкопласт','хромопласт','эндосимбио','целлюлоз','муреин','пептидоглик'],
 'cell/csk':['цитоскелет','микротрубочк','микрофиламент','актин','тубулин','центриол','ресничк','жгутик','веретено делен'],
 'cell/vuz':['сигнальный пептид','kdel','skl','сортировка белк','протонодвижущ'],
 'chem/el':['макроэлемент','микроэлемент','ультрамикроэлемент','биогенн','элементный состав'],
 'chem/water':['водородная связь','гидрофил','гидрофоб','теплоёмкост','растворител','диполь'],
 'chem/salt':['минеральн соли','буферн','гидрокарбонат','фосфатн буфер','ионный состав'],
 'chem/poly':['полимер','мономер','биополимер','конденсац'],
 'chem/carb':['углевод','глюкоз','фруктоз','сахароз','крахмал','гликоген','целлюлоз','хитин','моносахарид','полисахарид'],
 'chem/lip':['липид','жирная кислота','стероид','триглицерид','воск','холестерин'],
 'chem/prot':['аминокислот','пептидная связь','денатурац','первичная структура','вторичная структура','третичная структура','четвертичная структура','α-спирал','альфа-спирал','β-слой','полипептид'],
 'chem/enz':['фермент','активный центр','кофактор','кофермент','ингибитор','михаэлис','аллостер','катализ','kcat','vmax'],
 'chem/nuc':['нуклеотид','комплементарн','чаргафф','азотистое основание','макроэргическ','нуклеиновая кислота'],
 'energy/thermo':['окислительно-восстановительн','δg','свободная энергия','переносчик электрон','убихинон','цитохром','надн','над⁺','фадн'],
 'energy/glyc':['гликолиз','пируват','фосфофруктокиназ','гексокиназ','субстратное фосфорилирован','брожение','лактат','енолаз'],
 'energy/tca':['кребс','цитрат','пируватдегидрогеназ','изоцитрат','сукцинат','фумарат','оксалоацетат','ацетил-коа'],
 'energy/etc':['дыхательная цепь','комплекс i','ротенон','антимицин','цианид','олигомицин','разобщител','динитрофенол','протонный градиент','хемиосмос','атф-синтаз'],
 'energy/yield':['выход атф','38 атф','челночн','малат-аспартатн','глицерофосфатн','пальмитат','окислен жирн','бета-окислен','β-окислен'],
 'osmos/coll':['вант-гофф','осмотическое давление','осмолярност','коллигативн','физиологический раствор'],
 'osmos/ton':['тоничност','гипотоничн','гипертоничн','изотоничн','гемолиз','плазмолиз','мочевин'],
 'osmos/psi':['водный потенциал','осмотический потенциал','потенциал давлен','тургор'],
 'osmos/reg':['устьиц','замыкающие клетк','транспирац','корневое давлен','осморегуляц','сократительная вакуол'],
 'microlab/grow':['время генерац','кривая роста','лаг-фаз','экспоненциальная фаза','стационарная фаза','удельная скорость роста','время удвоен','периодическая культур','число поколений','фаза отмиран'],
 'microlab/cfu':['кое','колониеобразующ','серийн','разведени 10','титр культур','высев','подсчёт колони','некультивируем','тёмная матери','чашке петри','чашку петри'],
 'microlab/gram':['грамположительн','грамотрицательн','грам+','грам−','окраск по граму','пептидоглик','сафранин','кристаллический фиолетов','люгол','липополисахарид','тейхоев','цил'],
 'microlab/media':['питательная сред','олиготроф','копиотроф','агар','r2a','пептон','дрожжевой экстракт','ауксотроф','фактор роста','селективн','дифференциально-диагностич','гаузе'],
 'bioinf/aln':['выравниван','нидлман','уотерман','blosum','pam250','blast','e-value','матрица замен','динамическое программирован','гомологичн последовательн','гомологичн белк'],
 'bioinf/orf':['рамка считыван','рамки считыван','орф','open reading','старт-кодон','стоп-кодон','генетическ код','правило уоллес','вырожденност','вырожденн код','кодон'],
 'bioinf/tree':['филогенетическ','upgma','neighbor join','клада','монофилетич','парафилетич','полифилетич','молекулярные час','внешняя групп','эволюционное дерев']
};
const norm=x=>String(x||'').toLowerCase().replace(/ё/g,'е');
function kwOf(mod,id){
  const d=(BV.KR||{})[mod],s=d&&(d.sections||[]).find(x=>x.id===id);
  const own=(s&&s.kw)||[];return [...new Set(own.concat(KW[mod+'/'+id]||[]))].map(norm)}

/* ---------- разделы конспектов ---------- */
let SECS=null;
function buildSecs(){
  if(SECS)return SECS;
  SECS=[];const KR=BV.KR||{};
  Object.keys(KR).forEach(mod=>{const d=KR[mod];if(!d||!d.sections)return;
    d.sections.forEach(s=>SECS.push({mod,id:s.id,no:s.no,t:s.t,doc:d.title||mod,kw:kwOf(mod,s.id)}))});
  return SECS}

/* ---------- подбор задач и карточек ---------- */
const taskText=t=>norm([t.q,(t.o||[]).join(' '),(t.l||[]).join(' '),(t.r||[]).join(' '),(t.s||[]).join(' '),t.e||'',typeof t.a==='string'?t.a:''].join(' '));
const hits=(txt,kw)=>{let n=0;kw.forEach(w=>{if(txt.includes(w))n++});return n};
function tasksFor(sec){if(!sec.kw.length)return[];
  return (BV.TB||[]).map(t=>({t,n:hits(taskText(t),sec.kw)})).filter(x=>x.n>0)
    .sort((a,b)=>b.n-a.n).slice(0,8).map(x=>x.t.id)}
function cardsFor(sec){if(!sec.kw.length||!BV.srs||!BV.srs.bank)return[];
  const B=BV.srs.bank();
  return [...B.entries()].map(([k,c])=>({k,n:hits(norm(c.f+' '+c.b),sec.kw)})).filter(x=>x.n>0)
    .sort((a,b)=>b.n-a.n).slice(0,18).map(x=>x.k)}

/* ---------- подвал раздела ---------- */
function decorate(mod){
  const m=$('#m-'+mod);if(!m)return;
  const doc=$('.k-doc',m);if(!doc)return;
  buildSecs();
  $$('.k-sec',doc).forEach(el=>{
    if(el.querySelector(':scope>.sec-foot'))return;
    const id=el.dataset.sec,sec=SECS.find(s=>s.mod===mod&&s.id===id);if(!sec)return;
    const T=tasksFor(sec),Cd=cardsFor(sec);
    if(!T.length&&!Cd.length)return;
    const f=document.createElement('div');f.className='sec-foot';
    f.innerHTML='<b>К этому разделу</b>'+
      (Cd.length?`<button data-cards="1">Карточки <i>${Cd.length}</i></button>`:'')+
      (T.length?`<button data-tasks="1">Задачи <i>${T.length}</i></button>`:'');
    const h2=el.querySelector('h2'),title=(h2?h2.textContent.replace(/^\s*\d+\s*/,''):sec.t).trim();
    const q=f.querySelector('[data-tasks]');if(q)q.addEventListener('click',()=>{
      if(BV.tasksPick){BV.go('quiz');BV.tasksPick(T,title);try{history.replaceState(null,'','#quiz')}catch(e){}window.scrollTo({top:0})}});
    const c=f.querySelector('[data-cards]');if(c)c.addEventListener('click',()=>{
      if(BV.srs&&BV.srs.studyIds)BV.srs.studyIds(Cd,title)});
    el.appendChild(f)})}

/* конспект рисуется лениво — следим за появлением разделов */
function watch(){$$('main>.module').forEach(m=>{const mod=m.id.slice(2);
  if(m._lk)return;m._lk=1;
  new MutationObserver(()=>{clearTimeout(m._lkt);m._lkt=setTimeout(()=>decorate(mod),60)}).observe(m,{childList:true,subtree:true})})}
setTimeout(()=>{watch();const cur=$$('main>.module').find(x=>!x.hidden);if(cur)decorate(cur.id.slice(2))},300);

/* ---------- ошибка → теория ---------- */
function sectionFor(task){buildSecs();const txt=taskText(task);let best=null,bn=0;
  SECS.forEach(s=>{const n=hits(txt,s.kw);if(n>bn){bn=n;best=s}});
  return bn>=2?best:null}
BV.linkSection=sectionFor;

function onAnswer(a){
  if(!a||a.ok)return;
  setTimeout(()=>{
    const box=$('#tkBox');if(!box||box.querySelector('.tk-theory'))return;
    const t=(BV.TB||[]).find(x=>x.id===a.id)||a;
    const sec=sectionFor(t);if(!sec)return;
    const d=document.createElement('div');d.className='tk-theory';
    d.innerHTML=`<span>Разобрать теорию:</span><button>${esc(sec.doc)} · ${sec.no?'§ '+sec.no+'. ':''}${esc(sec.t)}</button>`;
    d.querySelector('button').addEventListener('click',()=>{
      if(BV.UX&&BV.UX.openDoc)BV.UX.openDoc(sec.mod,sec.id);else if(BV.konspOpen)BV.konspOpen(sec.mod,sec.id)});
    const place=box.querySelector('.exam,.k-ans,.tk-exp')||box;place.appendChild(d)},80)}
{const prev=BVHOST.afterAnswer;BVHOST.afterAnswer=a=>{try{prev&&prev(a)}catch(e){}onAnswer(a)}}

/* «Ко всем задачам» из подборки к разделу */
R.addEventListener('click',e=>{const b=BV_ET(e).closest&&BV_ET(e).closest('#tkSelBack');
  if(b&&BV.tasksOpen)BV.tasksOpen(store.get('tkcollPrev','vuz'))});
{const o=BV.tasksOpen;if(o)BV.tasksOpen=c=>{if(c!=='sel')store.set('tkcollPrev',c);return o(c)}}
})();
