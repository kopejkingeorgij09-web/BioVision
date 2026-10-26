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
/* Оформление «лабораторный журнал + геномный браузер»: бумага в клетку, чернила,
   моноширинные подписи, как у последовательностей, и четыре цвета нуклеотидов (A, C, G, T).
   Красно-оранжевый --cut отмечает разрез и текущее место: активная вкладка, раздел, прогресс. */
:host{
  --bg:#F3F1EA;--card:#FFFEFA;--surface:var(--card);--surface-2:#ECE9E0;--soft:var(--surface-2);
  --ink:#15171B;--text:var(--ink);--muted:#5B5F66;--line:#DCD8CC;--grid:rgba(21,23,27,.045);
  --ui:#15171B;--ui-soft:color-mix(in oklab,var(--ui) 7%,var(--card));
  --cut:#C63C25;--nA:#2C8650;--nC:#2B66BF;--nG:#C98A0C;--nT:#C93A4C;
  --eosin:#B4366A;--accent:var(--eosin);--hema:#3B3DA0;--chl:#2F8A4C;--bio:#2F8A4C;
  --ok:#2F8A4C;--bad:#C2384A;--amber:#B97A10;--sky:#2F72B8;--on-accent:#FFFEFA;
  --hema-soft:color-mix(in oklab,var(--hema) 11%,var(--card));--eosin-soft:color-mix(in oklab,var(--eosin) 11%,var(--card));
  --font-body:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-display:"Source Serif 4","PT Serif",Georgia,serif;
  --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --r:12px;--sh:none;
  --barh:60px;
  display:block;color:var(--ink);font-family:var(--font-body);font-size:15.5px;line-height:1.55;-webkit-font-smoothing:antialiased}
:host([data-theme="dark"]) .bar:after{opacity:.6}
:host([data-theme="dark"]){
  --bg:#0F1215;--card:#161A1E;--surface-2:#1E2328;--ink:#ECE9E1;--muted:#9EA3A9;--line:#2B3137;--grid:rgba(236,233,225,.03);
  --ui:#ECE9E1;--cut:#FF7A5C;--nA:#5BC98A;--nC:#74A9FF;--nG:#F0C04E;--nT:#FF7487;
  --eosin:#F07AA6;--hema:#9A9DFF;--chl:#64C47E;--bio:#64C47E;--ok:#64C47E;--bad:#FF7D8C;--amber:#EDB34A;--sky:#6FB3EE;--on-accent:#111316;
  color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--cut);outline-offset:2px;border-radius:4px}
h1,h2,h3{margin:0;text-wrap:balance}
p{margin:0}
a{color:var(--ui);text-decoration-color:color-mix(in srgb,var(--cut) 70%,transparent);text-underline-offset:3px}
.i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mono{font-family:var(--font-mono)}

/* базовые элементы, которыми пользуются конспект и лаборатория */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--ui);background:var(--ui);color:var(--on-accent);padding:9px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:14.5px;text-decoration:none;transition:background .15s,border-color .15s,color .15s}
.btn:hover{background:color-mix(in oklab,var(--ui) 86%,var(--cut))}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{border-color:var(--ink);background:transparent}
.btn.sm{padding:5px 12px;font-size:13px}
.btn:disabled{opacity:.45;cursor:default}
.seg{display:inline-flex;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:3px;gap:2px}
.seg button{border:0;background:transparent;padding:6px 13px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;color:var(--muted)}
.seg button:hover{color:var(--ink)}
.seg button[aria-pressed="true"]{background:var(--ui);color:var(--on-accent)}
.hint,.msg{color:var(--muted);font-size:13.5px}
.msg.err{color:var(--bad)}
.formula{font-family:var(--font-mono);font-weight:600;color:var(--hema);background:var(--hema-soft);padding:6px 10px;border-radius:6px}

/* ---------- каркас ---------- */
.app{min-height:100vh;display:flex;flex-direction:column;background-color:var(--bg);
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:24px 24px;background-position:-1px -1px}
.bar{position:sticky;top:0;z-index:50;height:var(--barh);display:flex;align-items:stretch;gap:20px;padding:0 max(20px,env(safe-area-inset-right,0px)) 0 max(20px,env(safe-area-inset-left,0px));
  background:color-mix(in srgb,var(--bg) 90%,transparent);-webkit-backdrop-filter:saturate(1.2) blur(12px);backdrop-filter:saturate(1.2) blur(12px)}
/* полоска-«прочтение» под шапкой: последовательность, раскрашенная по нуклеотидам */
.bar:after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;background:var(--read);opacity:.72;pointer-events:none}
.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:var(--ink);min-width:0}
.brand svg{width:32px;height:32px;flex:none}
.brand b{display:block;font:600 19px/1.05 var(--font-display);letter-spacing:-.01em}
.brand small{display:block;font:500 10.5px/1.3 var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tabs{display:flex;gap:4px;margin-left:16px}
.tabs a,.tabs button{all:unset;box-sizing:border-box;cursor:pointer;position:relative;display:flex;align-items:center;gap:8px;padding:0 12px;font-weight:600;font-size:14.5px;color:var(--muted)}
.tabs a:hover,.tabs button:hover{color:var(--ink)}
.tabs [aria-current="page"],.tabs [aria-expanded="true"]{color:var(--ink)}
.tabs [aria-current="page"]:after,.tabs [aria-expanded="true"]:after{content:"";position:absolute;left:12px;right:12px;bottom:9px;height:2px;background:var(--cut)}
.tabs a:focus-visible,.tabs button:focus-visible{outline:2px solid var(--cut);outline-offset:-8px}
.bar-r{margin-left:auto;display:flex;align-items:center;gap:6px}
.icb{all:unset;box-sizing:border-box;cursor:pointer;width:38px;height:38px;border-radius:8px;display:grid;place-items:center;color:var(--muted);border:1px solid transparent}
.icb:hover{color:var(--ink);border-color:var(--line)}
.icb:focus-visible{outline:2px solid var(--cut)}
.who{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 9px;border-radius:8px;border:1px solid var(--line);font-size:14px;font-weight:600;color:var(--ink);text-decoration:none;max-width:200px;background:var(--card)}
.who span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.who:hover{border-color:var(--ink)}
.who[aria-current="page"]{border-color:var(--ink)}
main{flex:1;width:100%;max-width:1240px;margin:0 auto;padding:34px max(20px,env(safe-area-inset-right,0px)) 80px max(20px,env(safe-area-inset-left,0px));container:bvm / inline-size;min-width:0}
.page{display:flex;flex-direction:column;gap:30px;min-width:0}
.page:focus{outline:none}

/* нижняя панель на телефоне */
.dock{display:none}
.note{font-size:13px;line-height:1.5;color:var(--muted);max-width:62ch;margin:18px 0 0}
@media (max-width:760px){
  :host{--barh:56px}
  .tabs{display:none}
  .who{display:none}
  .bar{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}
  main{padding:22px max(16px,env(safe-area-inset-right,0px)) calc(92px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
  .dock{display:flex;position:fixed;z-index:50;left:0;right:0;bottom:0;padding:0 6px calc(6px + env(safe-area-inset-bottom,0px));
    background:var(--card);border-top:1px solid var(--line)}
  .dock a,.dock button{all:unset;box-sizing:border-box;cursor:pointer;position:relative;flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 2px 4px;font-size:11.5px;font-weight:600;color:var(--muted);text-align:center}
  .dock .i{width:23px;height:23px}
  .dock [aria-current="page"],.dock [aria-expanded="true"]{color:var(--ink)}
  .dock [aria-current="page"]:before,.dock [aria-expanded="true"]:before{content:"";position:absolute;top:-1px;left:28%;right:28%;height:2px;background:var(--cut)}
  .dock a:focus-visible,.dock button:focus-visible{outline:2px solid var(--cut);outline-offset:-2px}
  .k-fab{bottom:calc(env(safe-area-inset-bottom,0px) + 80px)!important}
}

/* ---------- общие блоки страниц ---------- */
.eyebrow{display:flex;align-items:center;gap:9px;font:500 12px/1.3 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.eyebrow:before{content:"";flex:none;width:9px;height:9px;background:var(--cut)}
.hero{display:flex;flex-direction:column;gap:12px;max-width:760px;padding:6px 0 4px}
.hero h1{font:600 clamp(34px,6vw,64px)/1.02 var(--font-display);letter-spacing:-.022em;overflow-wrap:anywhere}
.hero .lead{color:var(--muted);font-size:17px;line-height:1.6;max-width:58ch}
.top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,460px);gap:28px 44px;align-items:end}
.top .hero{padding-bottom:0}
@container bvm (max-width:900px){.top{grid-template-columns:minmax(0,1fr)}}

/* участок генома на главной: направляющая РНК, PAM и место разреза Cas9 */
.locus{container-type:inline-size;border:1px solid var(--line);border-radius:var(--r);background:var(--card);padding:16px 16px 12px;font-family:var(--font-mono);min-width:0}
.lc-h{display:flex;justify-content:space-between;gap:10px;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}
.lc-h b{font-weight:600;color:var(--ink)}
.lc-h span+span{text-transform:none}
.lc-g{display:grid;grid-template-columns:2.2em repeat(var(--n),minmax(0,1fr)) 2.2em;row-gap:3px;font-size:min(15px,3.25cqi);line-height:1}
.lc-g>*{grid-row:var(--row);display:flex;align-items:center;justify-content:center}
.lc-end{font-size:.78em;color:var(--muted)}
.lc-tick{height:.7em;align-items:flex-end!important}
.lc-tick:after{content:"";width:1px;height:35%;background:var(--line)}
.lc-tick.big:after{height:100%;background:var(--muted)}
.lc-nt{height:1.7em;font-weight:600}
.lc-nt[data-n="A"]{color:var(--nA)}.lc-nt[data-n="C"]{color:var(--nC)}.lc-nt[data-n="G"]{color:var(--nG)}.lc-nt[data-n="T"]{color:var(--nT)}
.lc-nt.fl{opacity:.45}
.lc-nt.b{opacity:.68}.lc-nt.b.fl{opacity:.3}
.lc-guide{grid-column:var(--a) / var(--b);height:1.55em;margin:0 1px;border-radius:3px 0 0 3px;background:color-mix(in oklab,var(--ink) 9%,var(--card));border:1px solid color-mix(in oklab,var(--ink) 30%,var(--line));font-size:.72em;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);justify-content:flex-start!important;padding-left:.6em;white-space:nowrap;overflow:hidden}
.lc-pam{grid-column:var(--a) / var(--b);height:1.55em;margin:0 1px;border-radius:0 3px 3px 0;background:var(--cut);color:var(--card);font-size:.72em;font-weight:700;letter-spacing:.08em}
.lc-cut{grid-column:var(--c);grid-row:2 / 5!important;justify-self:start;justify-content:flex-start!important;align-items:stretch!important;width:0;border-left:2px dashed var(--cut);margin-left:-1px;position:relative}
.lc-cut:before{content:"";position:absolute;top:-6px;left:-6px;border:5px solid transparent;border-top:7px solid var(--cut)}
.lc-f{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:11px;letter-spacing:.04em;color:var(--muted)}
.lc-f i{font-style:normal;display:inline-flex;align-items:center;gap:6px}
.lc-f i:before{content:"";width:8px;height:8px;border-radius:2px;background:var(--c)}
@media (prefers-reduced-motion:no-preference){
  .locus.go .lc-guide{animation:lcIn .9s cubic-bezier(.2,.7,.2,1) both}
  .locus.go .lc-pam{animation:lcFade .4s .7s both}
  .locus.go .lc-cut{animation:lcFade .4s 1.05s both}
  @keyframes lcIn{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
  @keyframes lcFade{from{opacity:0}}}

.blk{display:flex;flex-direction:column;gap:12px}
.blk>h2{font:500 12px/1.3 var(--font-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);display:flex;align-items:flex-end;gap:12px}
.blk>h2 em{font-style:normal;color:var(--cut)}
/* линейка с делениями, как ось координат в геномном браузере */
.blk>h2:after,.ruler{content:"";flex:1;height:7px;margin-bottom:3px;
  background:linear-gradient(var(--line),var(--line)) left bottom/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 10px) left bottom/100% 4px no-repeat,repeating-linear-gradient(90deg,var(--muted) 0 1px,transparent 1px 50px) left bottom/100% 7px no-repeat;opacity:.9}
.cont{position:relative;display:flex;align-items:center;gap:16px;padding:16px 18px 16px 26px;border-radius:var(--r);background:var(--ink);color:var(--bg);text-decoration:none;max-width:760px;overflow:hidden}
.cont:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--read-v)}
.cont small{display:block;font:500 11.5px/1.3 var(--font-mono);letter-spacing:.07em;text-transform:uppercase;opacity:.7;margin-bottom:2px}
.cont b{display:block;font:600 19px/1.25 var(--font-display)}
.cont em{display:block;font-style:normal;opacity:.78;font-size:14px;margin-top:2px}
.cont .i{margin-left:auto;width:22px;height:22px;transition:transform .2s}
.cont:hover .i{transform:translateX(3px)}
.rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--r);background:var(--card);overflow:hidden}
.rows>li+li{border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 18px;align-items:center;padding:18px 20px;text-decoration:none;color:var(--ink);transition:background .15s}
.row:hover{background:color-mix(in oklab,var(--ink) 3%,var(--card))}
.row .no{font:600 15px/1 var(--font-mono);color:var(--ink);border:1.5px solid var(--ink);border-radius:6px;width:46px;height:46px;display:grid;place-items:center;align-self:start;position:relative}
.row .no .i{width:22px;height:22px}
.row b{display:block;font:600 20px/1.25 var(--font-display);letter-spacing:-.005em}
.row small{display:block;color:var(--muted);font:500 12px/1.4 var(--font-mono);letter-spacing:.02em;margin:3px 0 5px}
.row .ab{color:var(--muted);font-size:14.5px;line-height:1.5}
.row .pr{display:flex;flex-direction:column;align-items:flex-end;gap:7px;font:500 12px/1 var(--font-mono);color:var(--muted);white-space:nowrap}
.row .pr>.i{transition:transform .2s}
.row:hover .pr>.i{transform:translateX(3px);color:var(--ink)}
/* прогресс лекции: дорожка из разделов, прочитанные закрашены, как экзоны на карте гена */
.trk{display:flex;align-items:center;gap:3px;width:max-content}
.trk i{display:block;width:8px;height:12px;border-radius:1.5px;border:1px solid var(--line);background:var(--card)}
.trk i.on{background:var(--ink);border-color:var(--ink)}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.tags span{font:500 11.5px/1.4 var(--font-mono);padding:3px 8px;border-radius:4px;border:1px solid var(--line);color:var(--muted)}
@media (max-width:560px){.row{grid-template-columns:auto minmax(0,1fr);gap:6px 14px;padding:16px}.row .no{width:40px;height:40px;font-size:14px}.row b{font-size:18.5px}.row .pr{grid-column:2;align-items:center;flex-direction:row-reverse;justify-content:flex-end;gap:10px;margin-top:4px}}
.askcard{display:flex;gap:16px;align-items:center;padding:18px 20px;border:1px solid var(--line);border-radius:var(--r);background:var(--card);max-width:760px}
.askcard>.i{width:26px;height:26px;color:var(--ink)}
.askcard b{display:block;font:600 18px/1.3 var(--font-display)}
.askcard p{color:var(--muted);font-size:14px}
.askcard .btn{margin-left:auto;flex:none}
@media (max-width:560px){.askcard{flex-wrap:wrap}.askcard .btn{margin-left:0}}

/* хлебные крошки и шапка внутренних страниц */
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:500 12.5px/1.4 var(--font-mono);letter-spacing:.03em;color:var(--muted)}
.crumbs a{color:var(--muted);text-decoration:none}
.crumbs a:hover{color:var(--ink)}
.crumbs span:before{content:"/";margin-right:6px;opacity:.6}
.lhead{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.module{display:flex;flex-direction:column;gap:18px;min-width:0}
.after{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;max-width:1000px}
.after a{display:flex;flex-direction:column;gap:3px;padding:16px 18px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);text-decoration:none;color:var(--ink)}
.after a:hover{border-color:var(--ink)}
.after small{font:500 11px/1.3 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.after b{font:600 18px/1.3 var(--font-display)}

/* конспект в новой оболочке: те же правила, что в движке, но в стиле журнала */
.k-sheet{border-radius:14px;box-shadow:none;background:var(--card)}
.k-toc{top:calc(var(--barh) + 16px);max-height:calc(100dvh - var(--barh) - 32px);border-radius:12px;background:var(--card)}
.k-sec,.k-sheet h3{scroll-margin-top:calc(var(--barh) + 16px)}
.k-title .k-kick{font:500 12px/1.3 var(--font-mono);letter-spacing:.06em;color:var(--cut)}
.k-title h2{font-weight:600;font-size:clamp(28px,3.6vw,40px);line-height:1.08;letter-spacing:-.018em}
.k-title{border-bottom:0;padding-bottom:26px;background:linear-gradient(var(--line),var(--line)) left bottom/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 10px) left bottom/100% 4px no-repeat}
.k-goal{background:var(--surface-2);border:0;border-left:3px solid var(--cut);border-radius:0 10px 10px 0}
.k-goal>b{font:500 11.5px/1.3 var(--font-mono);letter-spacing:.06em;color:var(--ink)}
.k-sec+.k-sec{border-top:0;padding-top:34px;background:linear-gradient(var(--line),var(--line)) left top/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 10px) left top/100% 4px no-repeat}
.k-sec>h2{font-weight:600;letter-spacing:-.012em}
.k-sec>h2 .k-no{font:600 15px/1 var(--font-mono);border-radius:6px;min-width:36px;height:34px;transform:translateY(-4px);background:var(--ui);color:var(--on-accent)}
.k-sheet h3{font-weight:600}
.k-pg{font-family:var(--font-mono);letter-spacing:.08em}
.k-box{border-radius:10px}
.k-box>b:first-child,.k-card b,.k-q .k-fmt,.k-t th,.k-toc>b{font-family:var(--font-mono);font-weight:600}
.k-box>b:first-child{font-size:11.5px}
.k-tw,.k-card,.k-q,.k-steptx,.k-ctoc,.k-end{border-radius:10px}
.k-t th{font-size:11px;letter-spacing:.06em}
.kf{border-radius:12px}
.kf-st{border-radius:8px}
.k-toc>b{font-size:11px;letter-spacing:.1em}
.k-toc a{border-radius:5px}
.k-toc a.on{background:var(--surface-2);color:var(--ink);box-shadow:inset 2px 0 var(--cut);border-radius:0 5px 5px 0}
.k-sheetnav a.on{background:var(--surface-2);color:var(--ink);box-shadow:inset 3px 0 var(--cut)}
.k-prog{height:3px;border-radius:0}
.k-prog i{background:var(--cut);border-radius:0}
.k-opt,.k-mrow{border-radius:8px}
.k-opt>i{border-radius:4px;font-family:var(--font-mono)}
.k-opt:hover{border-color:var(--ink)}
.k-dots button,.k-mb button{border-radius:6px;font-family:var(--font-mono)}
.k-fab{border-radius:8px;box-shadow:0 6px 20px -6px rgba(0,0,0,.25)}
.k-win{border-radius:8px}
.k-win:hover{border-color:var(--ink);color:var(--ink)}
.k-f{font-family:var(--font-mono)}

/* лаборатория */
.el-card{border-radius:14px;box-shadow:none;background:var(--card)}
.el-card>header i{border-radius:6px;font-family:var(--font-mono)}
.el-card h2{font-weight:600}
.el-intro div{border-radius:10px;background:var(--card)}
.el-more a{border-radius:6px;color:var(--ink)}
.el-more a:hover{border-color:var(--ink)}

/* помощник */
.ai .ai-h b{font:600 18px/1.2 var(--font-display)}
.ai .ai-ctx{font:500 12px/1.4 var(--font-mono)}
.ai .ai-empty b{font:600 18px/1.3 var(--font-display)}
.ai .ai-sug button{border-radius:8px}
.ai .ai-sug button:hover{border-color:var(--ink)}
.ai .ai-f textarea{border-radius:8px}
.ai .ai-f textarea:focus{outline-color:var(--cut)}
.ai .ai-m.u{border-radius:10px 10px 3px 10px}

/* профиль */
.card{border:1px solid var(--line);border-radius:var(--r);background:var(--card);padding:20px;display:flex;flex-direction:column;gap:12px;max-width:640px}
.card h2{font:600 21px/1.25 var(--font-display)}
.card p{color:var(--muted);font-size:14.5px}
.field{display:flex;gap:8px;flex-wrap:wrap}
.field input{flex:1 1 220px;min-width:0;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:var(--bg);font-family:var(--font-mono);letter-spacing:.05em;text-transform:uppercase}
.field input:focus{outline:2px solid var(--cut);outline-offset:0;border-color:transparent}
.field input.plain{text-transform:none;letter-spacing:0;font-family:var(--font-body)}
.codes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.codes li{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:14.5px}
.codes code{font-family:var(--font-mono);font-size:13.5px;background:var(--surface-2);padding:2px 7px;border-radius:4px}
.codes li span{flex:1;min-width:0}
.codes button{all:unset;cursor:pointer;color:var(--muted);font-size:13px;padding:4px 8px;border-radius:6px}
.codes button:hover{color:var(--bad);background:var(--surface-2)}

/* меню темы */
.thm{position:fixed;z-index:70;min-width:200px;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px -12px rgba(0,0,0,.3);padding:5px;display:flex;flex-direction:column}
.thm button{all:unset;cursor:pointer;display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:6px;font-size:14.5px}
.thm button:hover{background:var(--surface-2)}
.thm button[aria-checked="true"]{font-weight:600;box-shadow:inset 2px 0 var(--cut)}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

/* ---------- разметка ---------- */
/* знак: двойная нить ДНК, разрезанная поперёк обеих нитей (так режет Cas9), над разрезом метка */
const LOGO=`<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="7" fill="var(--ui)"/><path d="M13.6 5.2h4.8L16 8.6z" fill="var(--cut)"/><g stroke-width="2.2" stroke-linecap="round"><path d="M6 12h8M18 12h8M6 22h8M18 22h8" stroke="var(--card)"/><path d="M8.5 13.6v6.8" stroke="var(--nA)"/><path d="M11.8 13.6v6.8" stroke="var(--nC)"/><path d="M20.2 13.6v6.8" stroke="var(--nG)"/><path d="M23.5 13.6v6.8" stroke="var(--nT)"/></g></svg>`;

/* «прочтение»: короткая последовательность, раскрашенная по нуклеотидам; полоска под шапкой и у карточки «Продолжить» */
const READ='GATTCAGCTGACGTCAATGGCATCGAAGGCTTACCGTAGTCAGGATCCTTGACAGTCGATGCA';
const NTC={A:'var(--nA)',C:'var(--nC)',G:'var(--nG)',T:'var(--nT)'};
const readGrad=dir=>`linear-gradient(${dir},${[...READ].map((c,k)=>`${NTC[c]} ${(k/READ.length*100).toFixed(2)}% ${((k+1)/READ.length*100).toFixed(2)}%`).join(',')})`;

/* участок ДНК на главной: 20 нуклеотидов под направляющую РНК, PAM NGG и разрез за 3 нуклеотида до PAM */
function locus(){const fl1='TCA',guide='GCTGACGTCAATGGCATCGA',pam='AGG',fl2='CTT',top=fl1+guide+pam+fl2,n=top.length;
  const CMP={A:'T',T:'A',G:'C',C:'G'},g0=fl1.length,p0=g0+guide.length,cut=p0-3;
  const nt=(c,k,row)=>`<span class="lc-nt${row===4?' b':''}${k<g0||k>=p0+pam.length?' fl':''}" data-n="${c}" style="--row:${row};grid-column:${k+2}">${c}</span>`;
  let h='';for(let k=0;k<n;k++)h+=`<span class="lc-tick${(k-g0)%5===0&&k>=g0&&k<p0?' big':''}" style="--row:1;grid-column:${k+2}"></span>`;
  h+=`<span class="lc-guide" style="--row:2;--a:${g0+2};--b:${p0+2}">направляющая РНК</span><span class="lc-pam" style="--row:2;--a:${p0+2};--b:${p0+pam.length+2}">PAM</span>`;
  h+=`<span class="lc-end" style="--row:3;grid-column:1">5′</span>${[...top].map((c,k)=>nt(c,k,3)).join('')}<span class="lc-end" style="--row:3;grid-column:${n+2}">3′</span>`;
  h+=`<span class="lc-end" style="--row:4;grid-column:1">3′</span>${[...top].map((c,k)=>nt(CMP[c],k,4)).join('')}<span class="lc-end" style="--row:4;grid-column:${n+2}">5′</span>`;
  h+=`<span class="lc-cut" style="--c:${cut+2}" title="Место разреза"></span>`;
  return `<figure class="locus go" aria-hidden="true" style="margin:0"><div class="lc-h"><span>Cas9 · <b>мишень</b></span><span>${n} п.н.</span></div>
    <div class="lc-g" style="--n:${n}">${h}</div>
    <div class="lc-f"><i style="--c:var(--nA)">A</i><i style="--c:var(--nC)">C</i><i style="--c:var(--nG)">G</i><i style="--c:var(--nT)">T</i><i style="--c:var(--cut);margin-left:auto">разрез</i></div></figure>`}
const app=document.createElement('div');app.className='app';
app.style.setProperty('--read',readGrad('90deg'));app.style.setProperty('--read-v',readGrad('180deg'));
app.innerHTML=`<header class="bar">
  <a class="brand" href="#/" aria-label="БиоВиз, главная курса">${LOGO}<span><b>БиоВиз</b><small>${esc(C.group)}</small></span></a>
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
const NOTE=()=>`<p class="note">На этом устройстве хранятся код входа, тема оформления и место, где ты остановился в лекции. ${C.ai==='server'?'Разговор с помощником живёт до закрытия вкладки, вопросы уходят на сервер группы и дальше в Claude вместе с текстом открытого раздела.':'Вопросы помощнику уходят прямо в claude.ai, в твой аккаунт, вместе с текстом открытого раздела. Сайт их не хранит.'}</p>`;

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
  home.innerHTML=`<div class="top"><header class="hero"><p class="eyebrow">Научная группа · ${esc(C.group)}</p><h1>${esc(C.title)}</h1>
     <p class="lead">Конспекты лекций с интерактивными рисунками, модели лаборатории и помощник, который отвечает по материалу курса.</p></header>${locus()}</div>
   ${cont}
   <section class="blk" aria-labelledby="hLect"><h2 id="hLect">Лекции <em>${C.lectures.length}</em></h2><ol class="rows">${C.lectures.map(L=>{const p=progress(L);
     return `<li><a class="row" href="#/l/${L.n}"><span class="no">${String(L.n).padStart(2,'0')}</span><span><b>${esc(L.title)}</b><small>${fmtDate(L.date)} · ${p.total} разделов</small><span class="ab">${esc(L.about)}</span></span>
       <span class="pr">${p.done?`${p.done} из ${p.total}`:'не начата'}<span class="trk" aria-hidden="true">${Array.from({length:p.total},(_,k)=>`<i${k<p.done?' class="on"':''}></i>`).join('')}</span></span></a></li>`}).join('')}</ol></section>
   <section class="blk" aria-labelledby="hLab"><h2 id="hLab">Лаборатория</h2><ul class="rows">${C.labs.map(B=>`<li><a class="row" href="#/lab/${esc(B.id)}"><span class="no">${ic('lab')}</span><span><b>${esc(B.title)}</b><span class="ab">${esc(B.about)}</span><span class="tags">${(B.models||[]).map(m=>`<span>${esc(m)}</span>`).join('')}</span></span><span class="pr">${ic('arrow')}</span></a></li>`).join('')}</ul></section>
   <section class="blk" aria-labelledby="hAsk"><h2 id="hAsk">Помощник</h2><div class="askcard">${ic('ai')}<span><b>Вопрос по материалу</b><p>Объяснит непонятное место, разберёт задачу из лекции, подскажет, что почитать. ${C.ai==='server'?'Нужен код группы.':'Ответ откроется в claude.ai, в твоём аккаунте.'}</p></span><button type="button" class="btn" data-ask>Открыть помощника</button></div></section>`}

/* ---------- профиль и вход ---------- */
const A=window.BVAUTH;
async function renderMe(){
  if(!A){me.innerHTML='<p class="msg">Облако не загрузилось. Обнови страницу.</p>';return}
  await A.ready;const u=A.me;
  if(!u){me.innerHTML=`<header class="hero"><p class="eyebrow">Профиль</p><h1>Вход</h1><p class="lead">${C.ai==='server'?'Код выдаёт руководитель группы. С кодом работает помощник, без кода конспекты и лаборатория открыты всем.':'Вход нужен руководителю группы. Конспекты, лаборатория и помощник открыты без кода.'}</p></header>
    <form class="card" id="meForm"><h2>Код группы</h2><div class="field"><input id="meCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="BIO-XXXX-XXXX" aria-label="Код"><button class="btn">Войти</button></div><p class="msg" id="meMsg" role="status"></p></form>${NOTE()}`;
    $('#meForm').addEventListener('submit',async e=>{e.preventDefault();const m=$('#meMsg');m.className='msg';m.textContent='Проверяю…';
      try{await A.login($('#meCode').value);syncWho();renderMe()}catch(er){m.className='msg err';m.textContent=er.message}});
    return}
  const admin=u.role==='admin';
  me.innerHTML=`<header class="hero"><p class="eyebrow">Профиль</p><h1>${esc(u.name||'Участник')}</h1><p class="lead">${admin?'Руководитель группы: здесь коды участников.':'Участник группы. Помощник доступен.'}</p></header>
   ${admin?`<section class="card"><h2>Коды группы</h2><p>Каждому участнику свой код. Удалённый код перестаёт работать сразу.</p>
     <form class="field" id="cNew"><input class="plain" id="cName" placeholder="Имя участника" aria-label="Имя участника"><button class="btn">Выдать код</button></form>
     <p class="msg" id="cMsg" role="status"></p><ul class="codes" id="cList"><li class="msg">Загружаю…</li></ul></section>`:''}
   <div><button type="button" class="btn ghost" id="meOut">Выйти</button></div>${NOTE()}`;
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
