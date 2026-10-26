/* Оболочка БиоВиза: шапка, нижняя панель на телефоне, страницы и адреса.
   Адреса (хеш, работают кнопки «Назад» и «Вперёд», ссылкой можно поделиться):
     #/                 главная курса
     #/l/1              лекция 1;  #/l/1/mb4 — сразу §4
     #/lab/microlab     лаборатория; #/lab/microlab/mlCfu — сразу модель
     #/me               вход по коду, для учителя — коды группы
   Старые ссылки вида #bact и #microlab перенаправляются сюда же. */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root,C=window.BV_COURSE;

const I={
 home:'<path d="M4 10.5 12 4l8 6.5V20H14.5v-5.5h-5V20H4z"/>',
 lab:'<path d="M9.5 3.5h5M10.5 3.5v6L5 18.6A1.6 1.6 0 0 0 6.4 21h11.2a1.6 1.6 0 0 0 1.4-2.4L13.5 9.5v-6"/><path d="M7.4 15h9.2"/>',
 ai:'<path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
 me:'<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
 auto:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 toc:'<path d="M4 6h16M4 12h10M4 18h13"/>'};
const ic=(k,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
BV.icon=ic;

/* ---------- стили оболочки и токены оформления ---------- */
const CSS=`
:host{
  --bg:#F5F6F2;--card:#FFFFFF;--surface:var(--card);--surface-2:#EEF1EC;--soft:var(--surface-2);
  --ink:#16201C;--text:var(--ink);--muted:#5E6B65;--line:#DFE4DE;
  --ui:#0F5D4A;--ui-soft:color-mix(in oklab,var(--ui) 10%,var(--card));
  --eosin:#B4366A;--accent:var(--eosin);--hema:#3B3DA0;--chl:#2F8A4C;--bio:#2F8A4C;
  --ok:#2F8A4C;--bad:#C2384A;--amber:#B97A10;--sky:#2F72B8;--on-accent:#fff;
  --hema-soft:color-mix(in oklab,var(--hema) 11%,var(--card));--eosin-soft:color-mix(in oklab,var(--eosin) 11%,var(--card));
  --font-body:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-display:var(--font-body);
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --r:16px;--sh:0 1px 2px rgba(20,32,28,.05),0 10px 30px -22px rgba(20,32,28,.35);
  --barh:60px;
  display:block;color:var(--ink);font-family:var(--font-body);font-size:15.5px;line-height:1.55;-webkit-font-smoothing:antialiased}
:host([data-theme="dark"]){
  --bg:#101614;--card:#161E1B;--surface-2:#1D2723;--ink:#E4ECE8;--muted:#97A69F;--line:#28332F;
  --ui:#62CDA6;--eosin:#F07AA6;--hema:#9A9DFF;--chl:#64C47E;--bio:#64C47E;--ok:#64C47E;--bad:#FF7D8C;--amber:#EDB34A;--sky:#6FB3EE;--on-accent:#0D1311;
  --sh:0 1px 2px rgba(0,0,0,.4),0 12px 30px -20px rgba(0,0,0,.8);color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--ui);outline-offset:2px;border-radius:6px}
h1,h2,h3{margin:0;text-wrap:balance}
p{margin:0}
a{color:var(--ui)}
.i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

/* базовые элементы, которыми пользуются конспект и лаборатория */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--ui);background:var(--ui);color:var(--on-accent);padding:9px 16px;border-radius:11px;cursor:pointer;font-weight:600;font-size:14.5px;text-decoration:none}
.btn.ghost{background:transparent;color:var(--ui);border-color:color-mix(in srgb,var(--ui) 40%,var(--line))}
.btn.sm{padding:5px 12px;font-size:13px}
.btn:disabled{opacity:.45;cursor:default}
.seg{display:inline-flex;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:3px;gap:2px}
.seg button{border:0;background:transparent;padding:6px 14px;border-radius:999px;cursor:pointer;font-size:14px;font-weight:500;color:var(--muted)}
.seg button[aria-pressed="true"]{background:var(--ui);color:var(--on-accent)}
.hint,.msg{color:var(--muted);font-size:13.5px}
.msg.err{color:var(--bad)}
.formula{font-family:var(--font-mono);font-weight:600;color:var(--hema);background:var(--hema-soft);padding:6px 10px;border-radius:8px}

/* ---------- каркас ---------- */
.app{min-height:100vh;display:flex;flex-direction:column}
.bar{position:sticky;top:0;z-index:50;height:var(--barh);display:flex;align-items:center;gap:20px;padding:0 max(20px,env(safe-area-inset-right,0px)) 0 max(20px,env(safe-area-inset-left,0px));
  background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(14px);backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);min-width:0}
.brand svg{width:30px;height:30px;flex:none}
.brand b{font-weight:700;font-size:17px;letter-spacing:-.01em}
.brand small{display:block;font-size:12px;color:var(--muted);font-weight:500;line-height:1.1}
.tabs{display:flex;gap:2px;margin-left:12px}
.tabs a,.tabs button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:10px;font-weight:600;font-size:14.5px;color:var(--muted)}
.tabs a:hover,.tabs button:hover{color:var(--ink);background:var(--surface-2)}
.tabs [aria-current="page"],.tabs [aria-expanded="true"]{color:var(--ui);background:var(--ui-soft)}
.tabs a:focus-visible,.tabs button:focus-visible{outline:2px solid var(--ui)}
.bar-r{margin-left:auto;display:flex;align-items:center;gap:6px}
.icb{all:unset;box-sizing:border-box;cursor:pointer;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;color:var(--muted);border:1px solid transparent}
.icb:hover{color:var(--ink);background:var(--surface-2)}
.icb:focus-visible{outline:2px solid var(--ui)}
.who{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;border:1px solid var(--line);font-size:14px;font-weight:600;color:var(--ink);text-decoration:none;max-width:200px}
.who span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.who:hover{border-color:var(--ui)}
.who[aria-current="page"]{border-color:var(--ui);color:var(--ui)}
main{flex:1;width:100%;max-width:1240px;margin:0 auto;padding:28px max(20px,env(safe-area-inset-right,0px)) 80px max(20px,env(safe-area-inset-left,0px));container:bvm / inline-size;min-width:0}
.page{display:flex;flex-direction:column;gap:28px;min-width:0}
.page:focus{outline:none}

/* нижняя панель на телефоне */
.dock{display:none}
.note{font-size:13px;line-height:1.5;color:var(--muted);max-width:62ch;margin:18px 0 0}
@media (max-width:760px){
  :host{--barh:54px}
  .tabs{display:none}
  .brand small{display:none}
  .who{display:none}
  main{padding-top:18px;padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))}
  .dock{display:flex;position:fixed;z-index:50;left:0;right:0;bottom:0;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px));
    background:var(--card);border-top:1px solid var(--line)}
  .dock a,.dock button{all:unset;box-sizing:border-box;cursor:pointer;flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;border-radius:12px;font-size:11.5px;font-weight:600;color:var(--muted);text-align:center}
  .dock .i{width:23px;height:23px}
  .dock [aria-current="page"],.dock [aria-expanded="true"]{color:var(--ui)}
  .dock a:focus-visible,.dock button:focus-visible{outline:2px solid var(--ui)}
  .k-fab{bottom:calc(env(safe-area-inset-bottom,0px) + 80px)!important}
}

/* ---------- общие блоки страниц ---------- */
.eyebrow{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--ui);font-weight:700}
.hero{display:flex;flex-direction:column;gap:10px;max-width:760px;padding:12px 0 4px}
.hero h1{font-size:clamp(32px,5.4vw,52px);line-height:1.04;letter-spacing:-.025em;font-weight:700}
.hero .lead{color:var(--muted);font-size:17px;max-width:60ch}
.blk{display:flex;flex-direction:column;gap:12px}
.blk>h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700;display:flex;align-items:center;gap:10px}
.blk>h2:after{content:"";flex:1;height:1px;background:var(--line)}
.cont{display:flex;align-items:center;gap:16px;padding:16px 18px;border-radius:var(--r);background:var(--ui);color:var(--on-accent);text-decoration:none;max-width:760px;box-shadow:var(--sh)}
.cont small{display:block;font-size:12px;letter-spacing:.07em;text-transform:uppercase;opacity:.8;font-weight:700}
.cont b{display:block;font-size:17px;line-height:1.3}
.cont em{display:block;font-style:normal;opacity:.85;font-size:14px}
.cont .i{margin-left:auto;width:22px;height:22px}
.rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--r);background:var(--card);overflow:hidden;box-shadow:var(--sh)}
.rows>li+li{border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 18px;align-items:center;padding:18px 20px;text-decoration:none;color:var(--ink)}
.row:hover{background:color-mix(in oklab,var(--ui) 4%,var(--card))}
.row .no{font:700 15px/1 var(--font-mono);color:var(--ui);background:var(--ui-soft);border-radius:10px;width:44px;height:44px;display:grid;place-items:center;align-self:start}
.row .no .i{width:22px;height:22px}
.row b{display:block;font-size:17px;line-height:1.3}
.row small{display:block;color:var(--muted);font-size:13px;margin:2px 0 4px}
.row .ab{color:var(--muted);font-size:14.5px;line-height:1.5}
.row .pr{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12.5px;color:var(--muted);white-space:nowrap}
.bar-p{width:88px;height:5px;border-radius:3px;background:var(--surface-2);overflow:hidden}
.bar-p i{display:block;height:100%;background:var(--ui);border-radius:3px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tags span{font-size:12.5px;padding:2px 9px;border-radius:999px;background:var(--surface-2);color:var(--muted)}
@media (max-width:560px){.row{grid-template-columns:auto minmax(0,1fr);padding:16px}.row .pr{grid-column:2;align-items:flex-start;flex-direction:row;align-items:center}}
.askcard{display:flex;gap:16px;align-items:center;padding:18px 20px;border:1px solid var(--line);border-radius:var(--r);background:var(--card);max-width:760px}
.askcard .i{width:28px;height:28px;color:var(--ui)}
.askcard b{display:block;font-size:16px}
.askcard p{color:var(--muted);font-size:14px}
.askcard .btn{margin-left:auto;flex:none}
@media (max-width:560px){.askcard{flex-wrap:wrap}.askcard .btn{margin-left:0}}

/* хлебные крошки и шапка внутренних страниц */
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13.5px;color:var(--muted)}
.crumbs a{color:var(--muted);text-decoration:none;font-weight:600}
.crumbs a:hover{color:var(--ui)}
.crumbs span:before{content:"/";margin-right:6px;opacity:.6}
.lhead{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.module{display:flex;flex-direction:column;gap:18px;min-width:0}
.after{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;max-width:1000px}
.after a{display:flex;flex-direction:column;gap:2px;padding:16px 18px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);text-decoration:none;color:var(--ink)}
.after a:hover{border-color:var(--ui)}
.after small{font-size:12px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700}
.after b{font-size:16px}

/* конспект в новой оболочке */
.k-sheet{border-radius:20px}
.k-toc{top:calc(var(--barh) + 14px);max-height:calc(100dvh - var(--barh) - 28px)}
.k-sec,.k-sheet h3{scroll-margin-top:calc(var(--barh) + 14px)}

/* профиль */
.card{border:1px solid var(--line);border-radius:var(--r);background:var(--card);padding:20px;display:flex;flex-direction:column;gap:12px;max-width:640px;box-shadow:var(--sh)}
.card h2{font-size:19px}
.card p{color:var(--muted);font-size:14.5px}
.field{display:flex;gap:8px;flex-wrap:wrap}
.field input{flex:1 1 220px;min-width:0;border:1px solid var(--line);border-radius:11px;padding:10px 12px;background:var(--bg);font-family:var(--font-mono);letter-spacing:.05em;text-transform:uppercase}
.field input.plain{text-transform:none;letter-spacing:0;font-family:var(--font-body)}
.codes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.codes li{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:11px;font-size:14.5px}
.codes code{font-family:var(--font-mono);font-size:13.5px;background:var(--surface-2);padding:2px 7px;border-radius:6px}
.codes li span{flex:1;min-width:0}
.codes button{all:unset;cursor:pointer;color:var(--muted);font-size:13px;padding:4px 8px;border-radius:8px}
.codes button:hover{color:var(--bad);background:var(--surface-2)}

/* меню темы */
.thm{position:fixed;z-index:70;min-width:200px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh);padding:6px;display:flex;flex-direction:column}
.thm button{all:unset;cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:9px;font-size:14.5px}
.thm button:hover{background:var(--surface-2)}
.thm button[aria-checked="true"]{color:var(--ui);font-weight:600}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

/* ---------- разметка ---------- */
const LOGO=`<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="var(--ui)"/><ellipse cx="16" cy="16" rx="9.5" ry="5.6" transform="rotate(-28 16 16)" fill="none" stroke="var(--card)" stroke-width="2"/><circle cx="13.3" cy="17.4" r="1.6" fill="var(--card)"/><circle cx="18.4" cy="14.4" r="1.6" fill="var(--card)"/><path d="M24.3 11.2c2.2-1.1 3.3-.4 4.6-1.6" fill="none" stroke="var(--card)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const app=document.createElement('div');app.className='app';
app.innerHTML=`<header class="bar">
  <a class="brand" href="#/" aria-label="БиоВиз, главная курса">${LOGO}<span><b>БиоВиз</b><small>${esc(C.title)} · ${esc(C.group)}</small></span></a>
  <nav class="tabs" aria-label="Разделы">
    <a href="#/" data-nav="home">Курс</a>
    <a href="#/lab/${esc(C.labs[0].id)}" data-nav="lab">Лаборатория</a>
    <button type="button" data-nav="ai" aria-expanded="false">${ic('ai')}Помощник</button>
  </nav>
  <div class="bar-r">
    <button type="button" class="icb" data-theme-btn aria-label="Оформление" aria-haspopup="true" aria-expanded="false"></button>
    <a class="who" href="#/me" data-nav="me">${ic('me')}<span>Войти</span></a>
  </div>
</header>
<main id="main"></main>
<nav class="dock" aria-label="Разделы">
  <a href="#/" data-nav="home">${ic('home')}<span>Курс</span></a>
  <a href="#/lab/${esc(C.labs[0].id)}" data-nav="lab">${ic('lab')}<span>Лаборатория</span></a>
  <button type="button" data-nav="ai" aria-expanded="false">${ic('ai')}<span>Помощник</span></button>
  <a href="#/me" data-nav="me">${ic('me')}<span>Профиль</span></a>
</nav>`;
R.appendChild(app);
const main=$('#main');

/* ---------- страницы ---------- */
const pages={};
function page(id,cls='page'){const s=document.createElement('section');s.className=cls;s.id=id;s.hidden=true;s.tabIndex=-1;main.appendChild(s);return s}

/* лекции: контейнер для движка конспектов. id модуля = id лекции (l01) */
C.lectures.forEach(L=>{const s=page('m-'+L.id,'module page');
  s.innerHTML=`<div class="lhead"><nav class="crumbs" aria-label="Путь"><a href="#/">${esc(C.title)}</a><span>Лекция ${L.n}</span></nav>
    <button type="button" class="btn ghost sm" data-ask>${ic('ai')}Спросить о лекции</button></div>
    <div class="k-doc"></div><div class="after"></div>`;
  pages['l'+L.n]=s});
/* лаборатории */
C.labs.forEach(B=>{const s=page('pg-lab-'+B.id);
  s.innerHTML=`<nav class="crumbs" aria-label="Путь"><a href="#/">${esc(C.title)}</a><span>Лаборатория</span></nav>
    <header class="hero"><p class="eyebrow">Лаборатория</p><h1>${esc(B.title)}</h1><p class="lead">${esc(B.about)}</p></header>
    <div class="el-lab" id="${BV.LABS&&BV.LABS[B.id]?BV.LABS[B.id].box:'lab-'+B.id}"></div>`;
  pages['lab:'+B.id]=s});
const home=pages.home=page('pg-home');
const me=pages.me=page('pg-me');

/* ---------- прогресс чтения ---------- */
const secsOf=id=>((BV.KR||{})[id]||{}).sections||[];
function parentOf(id,sid){for(const s of secsOf(id)){if(s.id===sid)return s;if((s.sub||[]).some(x=>x[0]===sid))return s}return null}
const seenOf=id=>new Set(store.get('seen:'+id,[]));
function progress(L){const S=secsOf(L.id).filter(s=>s.no),seen=seenOf(L.id);return{done:S.filter(s=>seen.has(s.id)).length,total:S.length}}

/* ---------- главная ---------- */
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const fmtDate=d=>{const [y,m,dd]=d.split('-').map(Number);return `${dd} ${MONTHS[m-1]}`};
function renderHome(){
  const last=store.get('last',null),L=last&&C.lectures.find(x=>x.id===last.id);
  const sec=L&&parentOf(L.id,last.s);
  const cont=L?`<a class="cont" href="#/l/${L.n}${last.s?'/'+esc(last.s):''}"><span><small>Продолжить</small><b>Лекция ${L.n} · ${esc(L.title)}</b>${sec?`<em>§${sec.no} ${esc(sec.t)}</em>`:''}</span>${ic('arrow')}</a>`:'';
  home.innerHTML=`<header class="hero"><p class="eyebrow">${esc(C.group)}</p><h1>${esc(C.title)}</h1>
     <p class="lead">Конспекты лекций с интерактивными рисунками, модели лаборатории и помощник, который отвечает по материалу курса.</p></header>
   ${cont}
   <section class="blk" aria-labelledby="hLect"><h2 id="hLect">Лекции</h2><ol class="rows">${C.lectures.map(L=>{const p=progress(L);
     return `<li><a class="row" href="#/l/${L.n}"><span class="no">${String(L.n).padStart(2,'0')}</span><span><b>${esc(L.title)}</b><small>${fmtDate(L.date)} · ${p.total} разделов</small><span class="ab">${esc(L.about)}</span></span>
       <span class="pr">${p.done?`${p.done} из ${p.total}`:'не начата'}<span class="bar-p"><i style="width:${p.total?Math.round(p.done/p.total*100):0}%"></i></span></span></a></li>`}).join('')}</ol></section>
   <section class="blk" aria-labelledby="hLab"><h2 id="hLab">Лаборатория</h2><ul class="rows">${C.labs.map(B=>`<li><a class="row" href="#/lab/${esc(B.id)}"><span class="no">${ic('lab')}</span><span><b>${esc(B.title)}</b><span class="ab">${esc(B.about)}</span><span class="tags">${(B.models||[]).map(m=>`<span>${esc(m)}</span>`).join('')}</span></span><span class="pr">${ic('arrow')}</span></a></li>`).join('')}</ul></section>
   <section class="blk" aria-labelledby="hAsk"><h2 id="hAsk">Помощник</h2><div class="askcard">${ic('ai')}<span><b>Вопрос по материалу</b><p>Объяснит непонятное место, разберёт задачу из лекции, подскажет, что почитать. Нужен код группы.</p></span><button type="button" class="btn" data-ask>Открыть помощника</button></div></section>`}

/* ---------- профиль и вход ---------- */
const A=window.BVAUTH;
async function renderMe(){
  if(!A){me.innerHTML='<p class="msg">Облако не загрузилось. Обнови страницу.</p>';return}
  await A.ready;const u=A.me;
  if(!u){me.innerHTML=`<header class="hero"><p class="eyebrow">Профиль</p><h1>Вход</h1><p class="lead">Код выдаёт руководитель группы. С кодом работает помощник, без кода конспекты и лаборатория открыты всем.</p></header>
    <form class="card" id="meForm"><h2>Код группы</h2><div class="field"><input id="meCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="BIO-XXXX-XXXX" aria-label="Код"><button class="btn">Войти</button></div><p class="msg" id="meMsg" role="status"></p></form><p class="note">На этом устройстве хранятся код входа, тема оформления и место, где ты остановился в лекции. Разговор с помощником живёт до закрытия вкладки, вопросы уходят на сервер группы и дальше в Claude вместе с текстом открытого раздела.</p>`;
    $('#meForm').addEventListener('submit',async e=>{e.preventDefault();const m=$('#meMsg');m.className='msg';m.textContent='Проверяю…';
      try{await A.login($('#meCode').value);syncWho();renderMe()}catch(er){m.className='msg err';m.textContent=er.message}});
    return}
  const admin=u.role==='admin';
  me.innerHTML=`<header class="hero"><p class="eyebrow">Профиль</p><h1>${esc(u.name||'Участник')}</h1><p class="lead">${admin?'Руководитель группы: здесь коды участников.':'Участник группы. Помощник доступен.'}</p></header>
   ${admin?`<section class="card"><h2>Коды группы</h2><p>Каждому участнику свой код. Удалённый код перестаёт работать сразу.</p>
     <form class="field" id="cNew"><input class="plain" id="cName" placeholder="Имя участника" aria-label="Имя участника"><button class="btn">Выдать код</button></form>
     <p class="msg" id="cMsg" role="status"></p><ul class="codes" id="cList"><li class="msg">Загружаю…</li></ul></section>`:''}
   <div><button type="button" class="btn ghost" id="meOut">Выйти</button></div><p class="note">На этом устройстве хранятся код входа, тема оформления и место, где ты остановился в лекции. Разговор с помощником живёт до закрытия вкладки, вопросы уходят на сервер группы и дальше в Claude вместе с текстом открытого раздела.</p>`;
  $('#meOut').addEventListener('click',()=>{A.logout();syncWho();renderMe()});
  if(admin){
    const draw=async()=>{const ul=$('#cList');try{const L=await A.codes()||[];
        ul.innerHTML=L.length?L.map(c=>`<li><span>${esc(c.name||'Без имени')}</span><code>${esc(c.code)}</code><button type="button" data-del="${esc(c.id)}">Удалить</button></li>`).join(''):'<li class="msg">Кодов пока нет.</li>';
        $$('[data-del]',ul).forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Удалить код? Участник больше не сможет войти.'))return;try{await A.delCode(b.dataset.del);draw()}catch(e){$('#cMsg').textContent='Не удалось удалить: '+e.message}}))}
      catch(e){ul.innerHTML='<li class="msg err">Не удалось загрузить коды.</li>'}};
    $('#cNew').addEventListener('submit',async e=>{e.preventDefault();const n=$('#cName').value.trim();if(!n)return;
      try{const r=await A.newCode(n);$('#cName').value='';$('#cMsg').textContent=r&&r.code?`Код для «${n}»: ${r.code}`:'Код создан.';draw()}catch(er){$('#cMsg').textContent='Не удалось создать код: '+er.message}});
    draw()}}
function syncWho(){const u=A&&A.me,w=$('.who span');if(w)w.textContent=u?(u.name||'Профиль'):'Войти';
  const d=$('.dock [data-nav="me"] span');if(d)d.textContent=u?'Профиль':'Войти'}
if(A&&A.ready)A.ready.then(syncWho);

/* ---------- маршрутизация ---------- */
let cur=null,curLecture=null;
function parse(h){const p=String(h||'').replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  if(!p.length)return{kind:'home'};
  if(p[0]==='l'){const L=C.lectures.find(x=>String(x.n)===p[1]);return L?{kind:'lecture',L,sec:p[2]||null}:{kind:'home'}}
  if(p[0]==='lab'){const B=C.labs.find(x=>x.id===p[1]);return B?{kind:'lab',B,model:p[2]||null}:{kind:'home'}}
  if(p[0]==='me')return{kind:'me'};
  /* старые адреса прежнего сайта */
  if(p[0]==='bact')return{kind:'redirect',to:'#/l/1'};
  if(C.labs.some(b=>b.id===p[0]))return{kind:'redirect',to:'#/lab/'+p[0]};
  return{kind:'home'}}
const href=r=>r.kind==='lecture'?`#/l/${r.L.n}`:r.kind==='lab'?`#/lab/${r.B.id}`:r.kind==='me'?'#/me':'#/';

function scrollToId(scope,id){const el=$('#k-'+id,scope)||$('#'+id,scope);if(!el)return false;
  let n=0;const f=()=>{const t=el.getBoundingClientRect().top-(parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60)-12;if(Math.abs(t)>4)window.scrollBy(0,t);if(++n<4)setTimeout(()=>requestAnimationFrame(f),140*n)};f();return true}

function show(r){
  if(r.kind==='redirect'){history.replaceState(null,'',r.to);return show(parse(r.to))}
  const target=r.kind==='lecture'?pages['l'+r.L.n]:r.kind==='lab'?pages['lab:'+r.B.id]:r.kind==='me'?me:home;
  if(curLecture&&(r.kind!=='lecture'||r.L!==curLecture)){BV.K.hide(curLecture.id);curLecture=null}
  Object.values(pages).forEach(p=>{p.hidden=p!==target});
  const same=cur&&cur.kind===r.kind&&(cur.L===r.L)&&(cur.B===r.B);
  cur=r;
  if(r.kind==='home')renderHome();
  if(r.kind==='me')renderMe();
  if(r.kind==='lecture'){curLecture=r.L;BV.K.show(r.L.id);fillAfter(r.L);
    if(r.sec)requestAnimationFrame(()=>{if(!scrollToId(target,r.sec))window.scrollTo({top:0})});else if(!same)window.scrollTo({top:0});
    document.title=`Лекция ${r.L.n}. ${r.L.title} · БиоВиз`}
  else if(r.kind==='lab'){const L=BV.LABS&&BV.LABS[r.B.id];if(L&&!L.done){try{L.build();L.done=1}catch(e){console.error('Лаборатория',e)}}
    if(r.model)requestAnimationFrame(()=>{if(!scrollToId(target,'lab-'+r.model))window.scrollTo({top:0})});else if(!same)window.scrollTo({top:0});
    document.title=`${r.B.title} · БиоВиз`}
  else{if(!same)window.scrollTo({top:0});document.title=r.kind==='me'?'Профиль · БиоВиз':`${C.title} · БиоВиз`}
  const nav=r.kind==='lecture'?'home':r.kind;
  $$('[data-nav]').forEach(a=>{if(a.tagName==='A')a.dataset.nav===nav?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
  if(!same)target.focus({preventScroll:true});
  lastSec=null}
function route(){show(parse(location.hash))}
addEventListener('hashchange',route);
BV.app={go:h=>{if(location.hash===h)route();else location.hash=h},get route(){return cur}};

/* «дальше» под лекцией: следующая лекция или лаборатория */
function fillAfter(L){const box=$('.after',pages['l'+L.n]);if(box.childElementCount)return;
  const next=C.lectures.find(x=>x.n===L.n+1);
  box.innerHTML=(next?`<a href="#/l/${next.n}"><small>Следующая лекция</small><b>${esc(next.title)}</b></a>`:'')+
    C.labs.map(B=>`<a href="#/lab/${esc(B.id)}"><small>Закрепить руками</small><b>${esc(B.title)}</b></a>`).join('')+
    `<a href="#/"><small>Курс</small><b>Все лекции</b></a>`}

/* где остановился: текущий раздел пишется в адрес (без новой записи в истории) и в память браузера */
let lastSec=null,tm=0;
addEventListener('scroll',()=>{if(tm)return;tm=setTimeout(()=>{tm=0;if(!cur||cur.kind!=='lecture')return;
  const a=$('.k-toc a.on',pages['l'+cur.L.n]);const id=a&&a.dataset.to;if(!id||id===lastSec)return;
  if(window.scrollY<120&&!cur.sec&&!lastSec)return;
  lastSec=id;const L=cur.L;
  try{history.replaceState(history.state,'',`#/l/${L.n}/${id}`)}catch(e){}
  cur={...cur,sec:id};
  store.set('last',{id:L.id,s:id,t:Date.now()});
  const p=parentOf(L.id,id);if(p){const S=seenOf(L.id);if(!S.has(p.id)){S.add(p.id);store.set('seen:'+L.id,[...S])}}},250)},{passive:true});

/* ---------- тема ---------- */
const tb=$('[data-theme-btn]');
const drawTb=()=>{const v=BV.theme.get();tb.innerHTML=ic(v==='dark'?'moon':v==='light'?'sun':'auto');tb.title='Оформление: '+({auto:'как в системе',light:'светлое',dark:'тёмное'})[v]};
drawTb();
tb.addEventListener('click',()=>{let m=$('.thm');if(m){m.remove();tb.setAttribute('aria-expanded','false');return}
  m=document.createElement('div');m.className='thm';m.setAttribute('role','menu');
  const v=BV.theme.get();m.innerHTML=[['auto','Как в системе'],['light','Светлое'],['dark','Тёмное']].map(([k,t])=>`<button role="menuitemradio" aria-checked="${k===v}" data-v="${k}">${ic(k==='dark'?'moon':k==='light'?'sun':'auto')}${t}</button>`).join('');
  R.appendChild(m);const r=tb.getBoundingClientRect();m.style.top=(r.bottom+6)+'px';m.style.right=Math.max(8,innerWidth-r.right)+'px';
  tb.setAttribute('aria-expanded','true');m.querySelector('[aria-checked="true"]').focus();
  m.addEventListener('click',e=>{const b=BV_ET(e).closest('[data-v]');if(!b)return;BV.theme.set(b.dataset.v);drawTb();m.remove();tb.setAttribute('aria-expanded','false');tb.focus()})});
document.addEventListener('click',e=>{const m=$('.thm');if(m&&!BV_ET(e).closest('.thm,[data-theme-btn]')){m.remove();tb.setAttribute('aria-expanded','false')}});
R.addEventListener('keydown',e=>{if(e.key==='Escape'){const m=$('.thm');if(m){m.remove();tb.setAttribute('aria-expanded','false');tb.focus()}}});

/* кнопки «Помощник» и «Спросить» */
R.addEventListener('click',e=>{const b=BV_ET(e).closest('[data-nav="ai"],[data-ask]');if(!b||!BV.ai)return;
  if(b.dataset.nav==='ai')BV.ai.toggle();else BV.ai.open()});

/* запуск */
BV.start=()=>{route()};
})();
