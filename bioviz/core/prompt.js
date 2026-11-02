/* «Создать промпт»: выделяешь фрагмент конспекта или лабораторной работы, рядом появляется кнопка.
   Она собирает готовый промпт (фрагмент, где он стоит, текст вокруг и требования к ответу)
   и кладёт его в буфер обмена. Промпт вставляется в любой ИИ-чат: Claude, ChatGPT, Gemini и другие.
   Сайт сам никуда текст не отправляет. */
(function(){
const {$,esc}=BV,R=BVHOST.root,C=window.BV_COURSE;

const CSS=`
.pr-sel{position:fixed;z-index:85;display:inline-flex;align-items:center;gap:7px;padding:8px 13px 8px 11px;border-radius:var(--rb,8px);border:0;
  background:var(--ink);color:var(--card);font:600 13.5px var(--font-body);cursor:pointer;box-shadow:0 10px 26px -10px rgba(0,0,0,.45);white-space:nowrap}
.pr-sel .i{width:16px;height:16px}
.pr-sel:hover{background:color-mix(in oklab,var(--ink) 86%,var(--cut))}
.pr-sel:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.bv-toast{position:fixed;z-index:95;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translate(-50%,16px);opacity:0;pointer-events:none;
  max-width:min(460px,calc(100vw - 32px));padding:11px 16px;border-radius:var(--rs,8px);background:var(--ink);color:var(--card);font-size:14px;line-height:1.45;
  box-shadow:0 14px 34px -14px rgba(0,0,0,.5);transition:opacity .2s,transform .2s}
.bv-toast.on{opacity:1;transform:translate(-50%,0)}
@media (max-width:760px){.bv-toast{bottom:calc(86px + env(safe-area-inset-bottom,0px))}}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

const btn=document.createElement('button');btn.type='button';btn.className='pr-sel';btn.hidden=true;
btn.innerHTML=BV.icon('prompt')+'Создать промпт';
R.appendChild(btn);

/* где стоит выделение: лекция и раздел или лабораторная работа и её часть */
const clean=t=>String(t||'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
const cut=(t,n)=>t.length>n?t.slice(0,n).replace(/\s+\S*$/,'')+' …':t;
function where(node){
  const sec=node.closest('.k-sec'),mod=node.closest('.module');
  if(sec&&mod){const L=C.lectures.find(x=>'m-'+x.id===mod.id);
    const h=$('h2',sec),sub=[...sec.querySelectorAll('h3')].filter(h3=>h3.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_FOLLOWING).pop();
    return{place:`${L?`Лекция ${L.n}. ${L.title}`:'Лекция'}${h?`, раздел «${clean(h.innerText).replace(/^\d+\s*/,'')}»`:''}${sub?`, подраздел «${clean(sub.innerText)}»`:''}`,
      around:clean(sec.innerText)}}
  const lw=node.closest('.lw-doc');
  if(lw){const part=node.closest('.lw-part'),t=$('h1',lw);
    return{place:`Лабораторная работа «${t?clean(t.innerText):''}»${part&&$('h2',part)?`, часть «${clean($('h2',part).innerText)}»`:''}`,around:clean(lw.innerText)}}
  if(mod){const L=C.lectures.find(x=>'m-'+x.id===mod.id);return{place:L?`Лекция ${L.n}. ${L.title}`:'Лекция',around:''}}
  return{place:'',around:''}}

function build(frag,node){const w=where(node);
  const around=w.around&&w.around.length>frag.length+40?cut(w.around,5000):'';
  return [
`Объясни фрагмент из учебного материала научной группы по микробиологии («${C.group}», уровень: сильный школьник-олимпиадник или первый курс биофака).`,
w.place?`Откуда фрагмент: курс «${C.title}», ${w.place}.`:`Курс: «${C.title}».`,
`Фрагмент:\n"""\n${frag}\n"""`,
around?`Текст вокруг фрагмента, чтобы был понятен контекст:\n"""\n${around}\n"""`:'',
`Что мне нужно:
1. Полное объяснение фрагмента: что именно утверждается, какой механизм за этим стоит, как это связано с остальным текстом. Каждый термин расшифруй при первом упоминании.
2. Проверка точности. Если во фрагменте есть неточность, устаревшее утверждение или сильное упрощение, скажи об этом прямо и объясни, как правильно.
3. Ссылки на источники к каждому ключевому утверждению. Учебники с главой или разделом: Нетрусов и Котова «Микробиология», Madigan et al. «Brock Biology of Microorganisms», Alberts et al. «Molecular Biology of the Cell». Статьи и обзоры из рецензируемых журналов с DOI или PMID.
4. Числа (размеры, скорости, концентрации, время) приводи только вместе с источником.
5. Отдели установленные факты от гипотез и спорных мест.
6. Не придумывай источники. Если не уверен, что статья или глава существует и говорит именно это, так и напиши.
7. В конце дай два-три вопроса для самопроверки.

Отвечай по-русски.`].filter(Boolean).join('\n\n')}

/* ---------- выделение ---------- */
const getSel=()=>{try{return R.getSelection?R.getSelection():document.getSelection()}catch(e){return null}};
const coarse=(()=>{try{return matchMedia('(pointer: coarse)').matches}catch(e){return false}})();
let picked=null;
function check(){const s=getSel(),t=s&&clean(String(s));
  if(!t||t.length<3||!s.rangeCount){hide();return}
  const n=s.anchorNode&&(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement);
  if(!n||!n.closest||!n.closest('.k-sheet,.lw-doc')||n.closest('input,textarea,.lw-form')){hide();return}
  const rc=s.getRangeAt(0).getBoundingClientRect();if(!rc.width&&!rc.height){hide();return}
  picked={t:cut(t,4000),n};btn.hidden=false;
  const w=btn.offsetWidth||150,h=btn.offsetHeight||36,bar=parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60;
  /* на телефоне над выделением висит системное меню, поэтому кнопка встаёт под ним */
  const above=!coarse&&rc.top-h-10>bar+6;
  btn.style.left=Math.max(8,Math.min(innerWidth-w-8,rc.left+rc.width/2-w/2))+'px';
  btn.style.top=Math.min(innerHeight-h-8,above?rc.top-h-10:rc.bottom+12)+'px'}
function hide(){btn.hidden=true}
let tm=0;const later=()=>{clearTimeout(tm);tm=setTimeout(check,180)};
document.addEventListener('selectionchange',later);R.addEventListener('pointerup',later);R.addEventListener('keyup',later);
addEventListener('scroll',()=>{if(!btn.hidden)later()},{passive:true});
addEventListener('hashchange',hide);
btn.addEventListener('pointerdown',e=>e.preventDefault());
btn.addEventListener('click',async()=>{if(!picked)return;const text=build(picked.t,picked.n);
  const ok=await BV.copy(text);
  BV.toast(ok?'Промпт скопирован. Вставь его в любой ИИ-чат.':'Не получилось скопировать. Выдели текст ещё раз.');
  if(ok){hide();try{getSel().removeAllRanges()}catch(e){}}});

BV.prompt={build};
})();
