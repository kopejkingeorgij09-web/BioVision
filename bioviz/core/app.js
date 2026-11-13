/* Оболочка БиоВиза: шапка, нижняя панель на телефоне, страницы и адреса.
   Адреса (хеш, работают кнопки «Назад» и «Вперёд», ссылкой можно поделиться):
     #/                 главная курса
     #/l/1              лекция 1;  #/l/1/mb4 — сразу §4
     #/labs             лабораторные работы; #/labs/<id> — одна работа (bioviz/core/labworks.js)
     #/me               вход по коду; у руководителя здесь панель управления (bioviz/core/admin.js)
   Старые ссылки вида #bact, #microlab и #/lab/... перенаправляются сюда же.
   Другие файлы добавляют свои страницы через BV.app.add(). */
(function(){
const {$,$$,esc,store}=BV,R=BVHOST.root,C=window.BV_COURSE;

const I={
 folder:'<path d="M3.5 6a1.5 1.5 0 0 1 1.5-1.5h4l2 2H19A1.5 1.5 0 0 1 20.5 8v10A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
 home:'<path d="M4 10.5 12 4l8 6.5V20H14.5v-5.5h-5V20H4z"/>',
 lab:'<path d="M9.5 3.5h5M10.5 3.5v6L5 18.6A1.6 1.6 0 0 0 6.4 21h11.2a1.6 1.6 0 0 0 1.4-2.4L13.5 9.5v-6"/><path d="M7.4 15h9.2"/>',
 prompt:'<rect x="8" y="3.5" width="12.5" height="14" rx="2"/><path d="M5.5 7v11.5a2 2 0 0 0 2 2H16"/><path d="M11 8.5h6.5M11 12h6.5M11 15.5h4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
 copy:'<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
 photo:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
 me:'<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
 auto:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 back:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
 toc:'<path d="M4 6h16M4 12h10M4 18h13"/>',
 set:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'};
const ic=(k,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
BV.icon=ic;

/* ---------- стили оболочки и токены оформления ---------- */
const CSS=`
/* Оформление: лабораторный журнал в лесной зелёной гамме. Бумага с лёгкой сеткой, засечки в заголовках,
   моноширинные подписи, как у последовательностей. Главный акцент --ui, тёмно-зелёный лесной;
   --cut отмечает текущее место (раздел, прогресс), --mark только место разреза на схеме Cas9.
   Цвета нуклеотидов A, C, G, T живут в полоске под шапкой и на схеме мишени. */
:host{
  --bg:#F2F3EE;--card:#FBFCF8;--surface:var(--card);--surface-2:#E8EBE3;--soft:var(--surface-2);
  --ink:#17211C;--text:var(--ink);--muted:#56625B;--line:#D6DCD3;--grid:rgba(23,33,28,.04);
  --ui:#1F5A3D;--ui-soft:color-mix(in oklab,var(--ui) 9%,var(--card));
  --cut:#2F7A50;--mark:#C4532E;--deep:#1F5A3D;--on-deep:#F3F8F2;--nA:#2C8650;--nC:#2B66BF;--nG:#C98A0C;--nT:#C93A4C;
  --eosin:#B4366A;--accent:var(--eosin);--hema:#3B3DA0;--chl:#2F8A4C;--bio:#2F8A4C;
  --ok:#2F8A4C;--bad:#C2384A;--amber:#B97A10;--sky:#2F72B8;--on-accent:#F6FAF5;
  --hema-soft:color-mix(in oklab,var(--hema) 11%,var(--card));--eosin-soft:color-mix(in oklab,var(--eosin) 11%,var(--card));
  --font-body:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-display:"Source Serif 4","PT Serif",Georgia,serif;
  --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --r:12px;--rs:8px;--rx:6px;--rb:var(--rs);--sh:none;--csh:none;
  --dw:600;--dls:-.015em;--dcase:none;
  --pattern:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);--pattern-size:24px 24px;
  --barh:60px;
  display:block;color:var(--ink);font-family:var(--font-body);font-size:15.5px;line-height:1.55;-webkit-font-smoothing:antialiased}
:host([data-theme="dark"]) .bar:after{opacity:.5}
:host([data-theme="dark"]){
  --bg:#0D1410;--card:#131C17;--surface-2:#1A251F;--ink:#E3EBE5;--muted:#97A69D;--line:#24332B;--grid:rgba(227,235,229,.028);
  --ui:#7CC79B;--cut:#6FBF8F;--mark:#FF8A65;--deep:#1D4431;--on-deep:#E6F0E8;--nA:#5BC98A;--nC:#74A9FF;--nG:#F0C04E;--nT:#FF7487;
  --eosin:#F07AA6;--hema:#9A9DFF;--chl:#64C47E;--bio:#64C47E;--ok:#64C47E;--bad:#FF7D8C;--amber:#EDB34A;--sky:#6FB3EE;--on-accent:#0C1710;
  color-scheme:dark}
*{box-sizing:border-box}
[hidden]{display:none!important}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--cut);outline-offset:2px;border-radius:var(--rx)}
h1,h2,h3{margin:0;text-wrap:balance}
p{margin:0}
a{color:var(--ui);text-decoration-color:color-mix(in srgb,var(--cut) 70%,transparent);text-underline-offset:3px}
.i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mono{font-family:var(--font-mono)}

/* базовые элементы, которыми пользуются конспект и лаборатория */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--ui);background:var(--ui);color:var(--on-accent);padding:9px 16px;border-radius:var(--rs);cursor:pointer;font-weight:600;font-size:14.5px;text-decoration:none;transition:background .15s,border-color .15s,color .15s}
.btn:hover{background:color-mix(in oklab,var(--ui) 86%,var(--cut))}
.btn.ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.ghost:hover{border-color:var(--ink);background:transparent}
.btn.sm{padding:5px 12px;font-size:13px}
.btn:disabled{opacity:.45;cursor:default}
.seg{display:inline-flex;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:var(--rs);padding:3px;gap:2px}
.seg button{border:0;background:transparent;padding:6px 13px;border-radius:var(--rx);cursor:pointer;font-size:14px;font-weight:500;color:var(--muted)}
.seg button:hover{color:var(--ink)}
.seg button[aria-pressed="true"]{background:var(--ui);color:var(--on-accent)}
.hint,.msg{color:var(--muted);font-size:13.5px}
.msg.err{color:var(--bad)}
.formula{font-family:var(--font-mono);font-weight:600;color:var(--hema);background:var(--hema-soft);padding:6px 10px;border-radius:var(--rx)}

/* ---------- каркас ---------- */
.app{min-height:100vh;display:flex;flex-direction:column;background-color:var(--bg);
  background-image:var(--pattern);background-size:var(--pattern-size);background-position:-1px -1px;background-attachment:fixed}
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
.icb{all:unset;box-sizing:border-box;cursor:pointer;width:38px;height:38px;border-radius:var(--rs);display:grid;place-items:center;color:var(--muted);border:1px solid transparent}
.icb:hover{color:var(--ink);border-color:var(--line)}
.icb:focus-visible{outline:2px solid var(--cut)}
.who{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 12px 6px 9px;border-radius:var(--rs);border:1px solid var(--line);font-size:14px;font-weight:600;color:var(--ink);text-decoration:none;max-width:200px;background:var(--card)}
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
.lc-pam{grid-column:var(--a) / var(--b);height:1.55em;margin:0 1px;border-radius:0 3px 3px 0;background:var(--mark);color:var(--card);font-size:.72em;font-weight:700;letter-spacing:.08em}
.lc-cut{grid-column:var(--c);grid-row:2 / 5!important;justify-self:start;justify-content:flex-start!important;align-items:stretch!important;width:0;border-left:2px dashed var(--mark);margin-left:-1px;position:relative}
.lc-cut:before{content:"";position:absolute;top:-6px;left:-6px;border:5px solid transparent;border-top:7px solid var(--mark)}
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
.cont{position:relative;display:flex;align-items:center;gap:16px;padding:16px 18px 16px 26px;border-radius:var(--r);background:var(--deep);color:var(--on-deep);text-decoration:none;max-width:760px;overflow:hidden}
.cont:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--read-v)}
.cont small{display:block;font:500 11.5px/1.3 var(--font-mono);letter-spacing:.07em;text-transform:uppercase;opacity:.7;margin-bottom:2px}
.cont b{display:block;font:600 19px/1.25 var(--font-display)}
.cont em{display:block;font-style:normal;opacity:.78;font-size:14px;margin-top:2px}
.cont .i{margin-left:auto;width:22px;height:22px;transition:transform .2s}
.cont:hover .i{transform:translateX(3px)}
.topic-list{display:grid;gap:12px}
.topic{min-width:0;border:1px solid var(--line);border-radius:var(--r);background:var(--card);overflow:hidden}
.topic>summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 14px;align-items:center;padding:15px 18px;cursor:pointer;list-style:none;background:var(--surface-2)}
.topic>summary::-webkit-details-marker{display:none}
.topic>summary:focus-visible{outline:2px solid var(--ui);outline-offset:-3px}
.topic-icon{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--line);border-radius:var(--rx);color:var(--ui);background:var(--card)}
.topic-icon .i{width:22px;height:22px}
.topic>summary strong{display:block;color:var(--ink);font:600 19px/1.25 var(--font-display)}
.topic>summary small{display:block;margin-top:4px;color:var(--muted);font-size:13px;line-height:1.4}
.topic-toggle{font:600 12px/1.3 var(--font-mono);color:var(--muted);white-space:nowrap}
.topic-toggle::after{content:'▸';display:inline-block;margin-left:8px;color:var(--ui)}
.topic[open] .topic-toggle::after{transform:rotate(90deg)}
.topic>.rows{border:0;border-top:1px solid var(--line);border-radius:0}
@media (max-width:560px){.topic>summary{padding:13px 12px;gap:6px 10px}.topic-icon{width:32px;height:32px}.topic>summary strong{font-size:17px}}
.rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:var(--r);background:var(--card);overflow:hidden}
.rows>li+li{border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 18px;align-items:center;padding:18px 20px;text-decoration:none;color:var(--ink);transition:background .15s}
.row:hover{background:color-mix(in oklab,var(--ink) 3%,var(--card))}
.row .no{font:600 15px/1 var(--font-mono);color:var(--ui);border:1.5px solid var(--ui);border-radius:var(--rx);width:46px;height:46px;display:grid;place-items:center;align-self:start;position:relative}
.row .no .i{width:22px;height:22px}
.row b{display:block;font:600 20px/1.25 var(--font-display);letter-spacing:-.005em}
.row small{display:block;color:var(--muted);font:500 12px/1.4 var(--font-mono);letter-spacing:.02em;margin:3px 0 5px}
.row .ab{color:var(--muted);font-size:14.5px;line-height:1.5}
.row .pr{display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-size:12.5px;color:var(--muted);white-space:nowrap}
.bar-p{width:88px;height:5px;border-radius:3px;background:var(--surface-2);overflow:hidden}
.bar-p i{display:block;height:100%;background:var(--ui);border-radius:3px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.tags span{font-size:12.5px;padding:2px 9px;border-radius:999px;background:var(--surface-2);color:var(--muted)}
@media (max-width:560px){.row{grid-template-columns:auto minmax(0,1fr);padding:16px}.row .pr{grid-column:2;align-items:flex-start;flex-direction:row;align-items:center}}
.pr-tip{display:inline-flex;align-items:center;gap:7px;font:500 12.5px/1.4 var(--font-mono);color:var(--muted)}
.pr-tip .i{width:16px;height:16px;color:var(--cut)}
/* объявление руководителя на главной */
.news{position:relative;display:flex;flex-direction:column;gap:6px;max-width:760px;padding:16px 18px 16px 22px;border:1px solid var(--line);border-radius:var(--r);background:var(--card)}
.news:before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:4px;border-radius:var(--r) 0 0 var(--r);background:var(--cut)}
.news small{font:500 11.5px/1.3 var(--font-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.news .md{font-size:15px;line-height:1.6}
.md p{margin:0 0 9px}.md p:last-child{margin-bottom:0}
.md ul,.md ol{margin:0 0 9px;padding-left:22px}.md li{margin:3px 0}
.md h4{font:600 16px/1.3 var(--font-display);margin:12px 0 4px}
.md code{font-family:var(--font-mono);font-size:.9em;background:var(--surface-2);padding:1px 5px;border-radius:var(--rx)}
.md-tw{overflow-x:auto;margin:4px 0 10px;border:1px solid var(--line);border-radius:var(--rs)}
.md-t{border-collapse:collapse;width:100%;font-size:14px}
.md-t th,.md-t td{padding:7px 10px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.md-t tr:last-child td{border-bottom:0}
.md-t th{font:600 11.5px/1.3 var(--font-mono);letter-spacing:.04em;text-transform:uppercase;color:var(--muted);background:var(--surface-2)}
.badge{display:inline-flex;align-items:center;font:600 11px/1 var(--font-mono);letter-spacing:.05em;text-transform:uppercase;padding:4px 7px;border-radius:var(--rx);border:1px solid var(--line);color:var(--muted);vertical-align:middle}
.badge.cut{border-color:var(--cut);color:var(--cut)}
.empty{padding:22px 20px;border:1px dashed var(--line);border-radius:var(--r);color:var(--muted);font-size:14.5px;max-width:760px;background:var(--card)}

.trk{display:flex;align-items:center;gap:3px;width:max-content}
.trk i{display:block;width:8px;height:12px;border-radius:2px;border:1px solid var(--line);background:var(--card)}
.trk i.on{background:var(--cut);border-color:var(--cut)}
.lw-doc h2,.lw-doc h1{font-weight:700}

/* хлебные крошки и шапка внутренних страниц */
.crumbs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:500 12.5px/1.4 var(--font-mono);letter-spacing:.03em;color:var(--muted)}
.crumbs a{color:var(--muted);text-decoration:none;font-weight:600}
.crumbs a:hover{color:var(--ui)}
.crumbs>*+*:before{content:"/";margin-right:6px;opacity:.6}
.lhead{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
.module{display:flex;flex-direction:column;gap:18px;min-width:0}
.after{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;max-width:1000px}
.after a{display:flex;flex-direction:column;gap:3px;padding:16px 18px;border-radius:var(--r);border:1px solid var(--line);background:var(--card);text-decoration:none;color:var(--ink)}
.after a:hover{border-color:var(--ink)}
.after small{font:500 11px/1.3 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.after b{font:600 18px/1.3 var(--font-display)}

/* конспект в новой оболочке: те же правила, что в движке, но в стиле журнала */
.k-sheet{border-radius:var(--r);box-shadow:none;background:var(--card)}
.k-toc{top:calc(var(--barh) + 16px);max-height:calc(100dvh - var(--barh) - 32px);border-radius:var(--r);background:var(--card)}
.k-sec,.k-sheet h3{scroll-margin-top:calc(var(--barh) + 16px)}
.k-title .k-kick{font:500 12px/1.3 var(--font-mono);letter-spacing:.06em;color:var(--cut)}
.k-title h2{font-weight:600;font-size:clamp(28px,3.6vw,40px);line-height:1.08;letter-spacing:-.018em}
.k-title{border-bottom:0;padding-bottom:26px;background:linear-gradient(var(--line),var(--line)) left bottom/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 10px) left bottom/100% 4px no-repeat}
.k-goal{background:var(--surface-2);border:0;border-left:3px solid var(--cut);border-radius:0 10px 10px 0}
.k-goal>b{font:500 11.5px/1.3 var(--font-mono);letter-spacing:.06em;color:var(--ink)}
.k-sec+.k-sec{border-top:0;padding-top:34px;background:linear-gradient(var(--line),var(--line)) left top/100% 1px no-repeat,repeating-linear-gradient(90deg,var(--line) 0 1px,transparent 1px 10px) left top/100% 4px no-repeat}
.k-sec>h2{font-weight:600;letter-spacing:-.012em}
.k-sec>h2 .k-no{font:600 15px/1 var(--font-mono);border-radius:var(--rx);min-width:36px;height:34px;transform:translateY(-4px);background:var(--ui);color:var(--on-accent)}
.k-sheet h3{font-weight:600}
.k-pg{font-family:var(--font-mono);letter-spacing:.08em}
.k-box{border-radius:var(--r)}
.k-box>b:first-child,.k-card b,.k-q .k-fmt,.k-t th,.k-toc>b{font-family:var(--font-mono);font-weight:600}
.k-box>b:first-child{font-size:11.5px}
.k-tw,.k-card,.k-q,.k-steptx,.k-ctoc,.k-end{border-radius:var(--r)}
.k-t th{font-size:11px;letter-spacing:.06em}
.kf{border-radius:var(--r)}
.kf-st{border-radius:var(--rs)}
.k-toc>b{font-size:11px;letter-spacing:.1em}
.k-toc a{border-radius:var(--rx)}
.k-toc a.on{background:var(--surface-2);color:var(--ink);box-shadow:inset 2px 0 var(--cut);border-radius:0 5px 5px 0}
.k-sheetnav a.on{background:var(--surface-2);color:var(--ink);box-shadow:inset 3px 0 var(--cut)}
.k-prog{display:none}
/* линия прогресса вдоль содержания: заполняется до текущего раздела */
.k-toc{position:sticky}
.k-toc a{padding-left:20px;position:relative}
.k-toc a.sub{padding-left:32px}
.k-toc a.past{color:var(--ink)}
.toc-line{position:absolute;left:12px;width:2px;border-radius:2px;background:var(--line);pointer-events:none}
.toc-line b{position:absolute;left:0;top:0;width:100%;border-radius:2px;background:var(--cut);transition:height .45s cubic-bezier(.3,.7,.2,1)}
.toc-line b:after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:var(--cut);box-shadow:0 0 0 3px color-mix(in oklab,var(--cut) 22%,transparent)}
.k-toc a.on{background:var(--surface-2);color:var(--ink);box-shadow:none;border-radius:var(--rx)}
@media (prefers-reduced-motion:reduce){.toc-line b{transition:none}}
/* «Мостик от школьного курса»: свёрнут в таблетку, раскрывается по клику */
.k-box.k-fold{display:block;padding:0;border:0;background:none;margin:12px 0 16px}
.k-fold-h{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:9px;padding:7px 14px 7px 12px;border-radius:999px;border:1px solid color-mix(in oklab,var(--ui) 35%,var(--line));background:var(--ui-soft);color:var(--ui);font:500 12.5px/1.3 var(--font-mono);letter-spacing:.03em;transition:border-color .15s,background .15s}
.k-fold-h:hover{border-color:var(--ui)}
.k-fold-h:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.k-fold-h svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .25s}
.k-fold-h[aria-expanded="true"] svg{transform:rotate(180deg)}
.k-fold-b{margin-top:10px;padding:14px 18px;border-left:2px solid color-mix(in oklab,var(--ui) 45%,var(--line));background:color-mix(in oklab,var(--ui) 5%,var(--card));border-radius:0 var(--rs) var(--rs) 0}
.k-fold-b p:last-child,.k-fold-b ul:last-child{margin-bottom:0}
.k-opt,.k-mrow{border-radius:var(--rs)}
.k-opt>i{border-radius:var(--rx);font-family:var(--font-mono)}
.k-opt:hover{border-color:var(--ink)}
.k-dots button,.k-mb button{border-radius:var(--rx);font-family:var(--font-mono)}
.k-fab{border-radius:var(--rs);box-shadow:0 6px 20px -6px rgba(0,0,0,.25)}
.k-win{border-radius:var(--rs)}
.k-win:hover{border-color:var(--ink);color:var(--ink)}
.k-f{font-family:var(--font-mono)}

/* лаборатория */
.el-card{border-radius:var(--r);box-shadow:none;background:var(--card)}
.el-card>header i{border-radius:var(--rx);font-family:var(--font-mono)}
.el-card h2{font-weight:600}
.el-intro div{border-radius:var(--r);background:var(--card)}
.el-more a{border-radius:var(--rx);color:var(--ink)}
.el-more a:hover{border-color:var(--ink)}

/* помощник */
.ai .ai-h b{font:600 18px/1.2 var(--font-display)}
.ai .ai-ctx{font:500 12px/1.4 var(--font-mono)}
.ai .ai-empty b{font:600 18px/1.3 var(--font-display)}
.ai .ai-sug button{border-radius:var(--rs)}
.ai .ai-sug button:hover{border-color:var(--ink)}
.ai .ai-f textarea{border-radius:var(--rs)}
.ai .ai-f textarea:focus{outline-color:var(--cut)}
.ai .ai-m.u{border-radius:10px 10px 3px 10px}

/* профиль */
.card{border:1px solid var(--line);border-radius:var(--r);background:var(--card);padding:20px;display:flex;flex-direction:column;gap:12px;max-width:640px}
.card h2{font:600 21px/1.25 var(--font-display)}
.card p{color:var(--muted);font-size:14.5px}
.field{display:flex;gap:8px;flex-wrap:wrap}
.field input{flex:1 1 220px;min-width:0;border:1px solid var(--line);border-radius:var(--rs);padding:10px 12px;background:var(--bg);font-family:var(--font-mono);letter-spacing:.05em;text-transform:uppercase}
.field input:focus{outline:2px solid var(--cut);outline-offset:0;border-color:transparent}
.field input.plain{text-transform:none;letter-spacing:0;font-family:var(--font-body)}
.codes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.codes li{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:var(--rs);font-size:14.5px}
.codes code{font-family:var(--font-mono);font-size:13.5px;background:var(--surface-2);padding:2px 7px;border-radius:var(--rx)}
.codes li span{flex:1;min-width:0}
.codes button{all:unset;cursor:pointer;color:var(--muted);font-size:13px;padding:4px 8px;border-radius:var(--rx)}
.codes button:hover{color:var(--bad);background:var(--surface-2)}

/* общие правила для заголовков и карточек */
.hero h1,.row b,.cont b,.askcard b,.after b,.card h2,.k-title h2,.k-sec>h2,.k-sheet h3,.k-steptx b,.k-q>b:first-child,.el-card h2,.brand b,.ai .ai-h b,.ai .ai-empty b{font-family:var(--font-display);font-weight:var(--dw);letter-spacing:var(--dls);text-transform:var(--dcase)}
.btn,.seg{border-radius:var(--rb)}
.seg button{border-radius:calc(var(--rb) - 3px)}
.rows,.locus,.askcard,.after a,.k-sheet,.k-toc,.el-card,.card,.cont{box-shadow:var(--csh)}

/* ---------- меню «Настройки»: оформление, лёгкий режим, работа без интернета ---------- */
.thm{position:fixed;z-index:70;width:min(340px,calc(100vw - 16px));max-height:calc(100dvh - var(--barh) - 24px);overflow:auto;overscroll-behavior:contain;background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 18px 44px -14px rgba(0,0,0,.35);padding:14px;display:flex;flex-direction:column;gap:12px}
.thm>b{font:500 11.5px/1.3 var(--font-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.thm .seg{display:flex;width:100%}
.thm .seg button{flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 6px}
.thm .seg .i{width:16px;height:16px}
.thm .sw{display:flex;gap:12px;align-items:flex-start;cursor:pointer;padding:2px 0}
.thm .sw input{appearance:none;-webkit-appearance:none;flex:none;margin:2px 0 0;width:40px;height:24px;border-radius:12px;background:var(--line);position:relative;cursor:pointer;transition:background .2s}
.thm .sw input:after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:var(--card);box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.thm .sw input:checked{background:var(--ui)}
.thm .sw input:checked:after{transform:translateX(16px)}
.thm .sw input:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.thm .sw span{display:flex;flex-direction:column;gap:3px;font-size:14.5px;font-weight:600}
.thm .sw small,.thm p{font-size:13px;line-height:1.45;font-weight:400;color:var(--muted)}
.thm p{margin:0}
.thm .tip{padding:8px 10px;border-radius:var(--rs);background:var(--ui-soft);color:var(--ink)}
.thm hr{border:0;border-top:1px solid var(--line);margin:2px 0}
/* лёгкий режим: без переходов, анимаций, размытия под шапкой и неподвижного фона */
:host(.lite) *,:host(.lite) *:before,:host(.lite) *:after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}
:host(.lite) .bar{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--bg)}
:host(.lite) .app{background-attachment:scroll}
`;
{const st=document.createElement('style');st.textContent=CSS;R.appendChild(st)}

/* ---------- разметка ---------- */
/* знак: двойная нить ДНК, разрезанная поперёк обеих нитей (так режет Cas9), над разрезом метка */
const LOGO=`<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="7" fill="var(--deep)"/><path d="M13.6 5.2h4.8L16 8.6z" fill="var(--mark)"/><g stroke-width="2.2" stroke-linecap="round"><path d="M6 12h8M18 12h8M6 22h8M18 22h8" stroke="var(--on-deep)"/><path d="M8.5 13.6v6.8" stroke="var(--nA)"/><path d="M11.8 13.6v6.8" stroke="var(--nC)"/><path d="M20.2 13.6v6.8" stroke="var(--nG)"/><path d="M23.5 13.6v6.8" stroke="var(--nT)"/></g></svg>`;

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
    <div class="lc-f"><i style="--c:var(--nA)">A</i><i style="--c:var(--nC)">C</i><i style="--c:var(--nG)">G</i><i style="--c:var(--nT)">T</i><i style="--c:var(--mark);margin-left:auto">разрез</i></div></figure>`}
const app=document.createElement('div');app.className='app';
app.style.setProperty('--read',readGrad('90deg'));app.style.setProperty('--read-v',readGrad('180deg'));
app.innerHTML=`<header class="bar">
  <a class="brand" href="#/" aria-label="БиоВиз, главная курса">${LOGO}<span><b>БиоВиз</b><small>${esc(C.group)}</small></span></a>
  <nav class="tabs" aria-label="Разделы">
    <a href="#/" data-nav="home">Курс</a>
    <a href="#/labs" data-nav="labs">Лабы</a>
    <a href="#/reading" data-nav="reading">Фундаментальное чтиво</a>
  </nav>
  <div class="bar-r">
    <button type="button" class="icb" data-theme-btn aria-label="Настройки" aria-haspopup="true" aria-expanded="false"></button>
    <a class="who" href="#/me" data-nav="me">${ic('me')}<span>Войти</span></a>
  </div>
</header>
<main id="main"></main>
<nav class="dock" aria-label="Разделы">
  <a href="#/" data-nav="home">${ic('home')}<span>Курс</span></a>
  <a href="#/labs" data-nav="labs">${ic('lab')}<span>Лабы</span></a>
  <a href="#/reading" data-nav="reading">${ic('toc')}<span>Чтиво</span></a>
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
    <span class="pr-tip">${ic('prompt')}Выдели фрагмент текста, чтобы создать промпт для ИИ</span></div>
    <div class="k-doc"></div><div class="after"></div>`;
  pages['l'+L.n]=s});
const home=pages.home=page('pg-home');
const me=pages.me=page('pg-me');
const NOTE=()=>`<p class="note">Личный код синхронизирует место чтения, закладки, ответы, самооценку и прогресс лекций между твоими устройствами. PDF остаются на устройстве. Руководителю доступна статистика посещений, использования функций и темпа чтения, без личных кодов и текстов ответов. «Создать промпт» копирует текст в буфер обмена; сайт сам не отправляет его в ИИ.</p>`;

/* ---------- облако: настройки сайта ----------
   Документ site/main: объявление на главной и список скрытых лекций. Пишет только руководитель.
   Последняя версия хранится в браузере, чтобы главная не ждала облако. */
const A=window.BVAUTH;
const db=()=>window.claude.use('db');
const isAdmin=()=>!!(A&&A.me&&A.me.role==='admin');
const site={data:store.get('site',{}),
  async load(){try{const d=await (await db()).doc('site/main').get();site.data=d.exists&&d.data()||{};store.set('site',site.data)}catch(e){}return site.data},
  async save(patch){const next={...site.data,...patch,t:Date.now()};await (await db()).doc('site/main').set(next);site.data=next;store.set('site',next);return next}};
const hiddenL=()=>new Set(site.data.hidden||[]);
const visibleLectures=()=>{const h=hiddenL();return isAdmin()?C.lectures:C.lectures.filter(L=>!h.has(L.id))};

/* ---------- прогресс чтения ---------- */
const secsOf=id=>((BV.KR||{})[id]||{}).sections||C.lectures.find(L=>L.id===id)?.sections||[];
function parentOf(id,sid){for(const s of secsOf(id)){if(s.id===sid)return s;if((s.sub||[]).some(x=>x[0]===sid))return s}return null}
const PS=BV.lectureStore;
const seenOf=id=>new Set(PS.get('seen:'+id,[]));
function progress(L){const S=secsOf(L.id).filter(s=>s.no),seen=seenOf(L.id);return{done:S.filter(s=>seen.has(s.id)).length,total:S.length}}
/* Сначала объединяем облачные отметки с локальными; сервер повторяет объединение атомарно.
   Проверяем профиль после каждого ожидания: выход или смена участника отменяет старый запрос. */
let syncT=0;
function syncProgress(now){const u=A&&A.me;if(!u||u.role!=='student'||BV.personal?.connected)return;clearTimeout(syncT);
  syncT=setTimeout(async()=>{try{if(A.me!==u||BV.personal?.connected)return;const D=await db();if(A.me!==u||BV.personal?.connected)return;
    const ref=D.doc('students/'+u.id),old=await ref.get();if(A.me!==u||BV.personal?.connected)return;
    const data=old.exists&&old.data()||{},remote=data.prog||{},seen={...remote.seen};
    C.lectures.forEach(L=>{const s=[...new Set([...(remote.seen&&remote.seen[L.id]||[]),...seenOf(L.id)])];
      if(s.length)seen[L.id]=s;PS.set('seen:'+L.id,s)});
    const here=PS.get('last',null),there=remote.last?{...remote.last,t:Number(remote.last.t||remote.t)||0}:null;
    const last=!here?there:!there?here:(Number(there.t||remote.t)||0)>(Number(here.t)||0)?there:here;
    if(last)PS.set('last',last);
    await ref.set({...data,prog:{...remote,seen,last:last||null,t:Date.now()}});if(A.me!==u||BV.personal?.connected)return;
    if(cur&&cur.kind==='home')renderHome();
    if(cur&&cur.kind==='me')renderMe();
    dispatchEvent(new Event('bv-progress'));
  }catch(e){console.warn('progress sync',e.message)}},now?300:4000)}
if(A&&A.ready)A.ready.then(()=>syncProgress(true));
addEventListener('bv-auth-change',()=>{clearTimeout(syncT);syncProgress(true)});
BV.progress={secsOf,seenOf,progress,sync:syncProgress};

/* ---------- главная ---------- */
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const fmtDate=d=>{if(!d)return '';const [y,m,dd]=String(d).split('-').map(Number);return m?`${dd} ${MONTHS[m-1]}${y&&y!==new Date().getFullYear()?' '+y:''}`:''};
BV.fmtDate=fmtDate;
function lectureRows(list){const h=hiddenL();return list.map(L=>{const p=progress(L);
  return `<li><a class="row" href="#/l/${L.n}"><span class="no">${String(L.n).padStart(2,'0')}</span><span><b>${esc(L.title)}${h.has(L.id)?' <span class="badge cut">скрыта</span>':''}</b><small>${fmtDate(L.date)} · ${p.total} разделов</small><span class="ab">${esc(L.about)}</span></span>
    <span class="pr">${p.done?`${p.done} из ${p.total}`:'не начата'}<span class="trk" aria-hidden="true">${Array.from({length:p.total},(_,k)=>`<i${k<p.done?' class="on"':''}></i>`).join('')}</span></span></a></li>`}).join('')}
function lectureTopics(list){
  if(!list.length)return '<p class="empty">Лекций пока нет.</p>';
  const folders=C.topics.map(topic=>({...topic,lectures:list.filter(L=>L.topic===topic.id)}));
  const other=list.filter(L=>!C.topics.some(topic=>topic.id===L.topic));
  if(other.length)folders.push({id:'other',title:'Другие лекции',about:'',lectures:other});
  const open=new Map($$('.topic[data-topic]',home).map(folder=>[folder.dataset.topic,folder.open]));
  return `<div class="topic-list">${folders.filter(topic=>topic.lectures.length).map(topic=>
    `<details class="topic" id="topic-${esc(topic.id)}" data-topic="${esc(topic.id)}"${open.get(topic.id)!==false?' open':''}>
      <summary><span class="topic-icon">${ic('folder')}</span><span><strong>${esc(topic.title)}</strong><small>${esc(topic.about)}</small></span><span class="topic-toggle" aria-label="Лекций ${topic.lectures.length}">${topic.lectures.length}</span></summary>
      <ol class="rows">${lectureRows(topic.lectures)}</ol>
    </details>`).join('')}</div>`;
}
function renderHome(){
  const last=PS.get('last',null),L=last&&visibleLectures().find(x=>x.id===last.id);
  const sec=L&&parentOf(L.id,last.s);
  const cont=L?`<a class="cont" href="#/l/${L.n}${last.s?'/'+esc(last.s):''}"><span><small>Продолжить</small><b>Лекция ${L.n} · ${esc(L.title)}</b>${sec?`<em>§${sec.no} ${esc(sec.t)}</em>`:''}</span>${ic('arrow')}</a>`:'';
  const N=site.data.news,news=N&&N.on&&N.text?`<aside class="news" aria-label="Объявление"><small>Объявление${N.date?' · '+fmtDate(N.date):''}</small><div class="md">${BV.md(N.text)}</div></aside>`:'';
  const LL=visibleLectures();
  home.innerHTML=`<div class="top"><header class="hero"><p class="eyebrow">Научная группа · ${esc(C.group)}</p><h1>${esc(C.title)}</h1>
     <p class="lead">Конспекты лекций с интерактивными рисунками и журнал лабораторных работ группы.</p></header>${locus()}</div>
   ${news}${cont}
   <section class="blk" aria-labelledby="hLect"><h2 id="hLect">Лекции <em>${LL.length}</em></h2>${lectureTopics(LL)}</section>
   <section class="blk" aria-labelledby="hLab"><h2 id="hLab">Лабы <em data-lw-count></em></h2><div data-lw-home><p class="empty">Загружаю…</p></div></section>`;
  const labs=()=>{if(cur?.kind==='home')BV.labworks.homeBlock($('[data-lw-home]',home),$('[data-lw-count]',home))};if(BV.labworks)labs();else BV_LOAD.ensure('labs').then(labs).catch(()=>{const b=$('[data-lw-home]',home);if(b)b.innerHTML='<a href="#/labs">Открыть лабы →</a>'})}
/* настройки сайта пришли из облака: перерисовать главную, если она открыта */
site.load().then(()=>{if(cur&&cur.kind==='home')renderHome()});

/* ---------- профиль и вход ---------- */
async function renderMe(){
  if(!A){me.innerHTML='<p class="msg">Облако не загрузилось. Обнови страницу.</p>';return}
  await A.ready;const u=A.me;
  if(u?.role==='admin'){try{await BV_LOAD.ensure('admin')}catch(e){me.innerHTML='<p class="msg err">Не удалось открыть управление.</p><button class="btn" data-admin-retry>Повторить</button>';$('[data-admin-retry]',me).onclick=renderMe;return}if(A.me!==u||cur?.kind!=='me')return;BV.admin.render(me,{site,NOTE,logout:()=>{A.logout();syncWho();renderMe()}});return}
  const P=BV.personal,LL=visibleLectures(),unassigned=u&&!P?.connected&&C.lectures.some(L=>store.get('guest:seen:'+L.id,store.get('seen:'+L.id,[])).some(id=>!seenOf(L.id).has(id)));
  me.innerHTML=`<header class="hero"><p class="eyebrow">Твой профиль</p><h1>Личный код</h1><p class="lead">Создай себе код и используй его на всех своих устройствах — прогресс будет синхронизироваться.</p></header>
   <section class="card"><h2>${P?.connected?'Код подключён':'Синхронизация между устройствами'}</h2><p data-profile-status>${P?.connected?esc(P.message):'Придумай свой код или создай случайный. Для входа с другого устройства понадобится тот же код.'}</p><div class="field"><button type="button" class="btn" data-personal-profile>${P?.connected?'Мой код и синхронизация':'Создать код или войти'}</button></div></section>
   ${LL.length?`<section class="blk"><h2>Мои лекции</h2><ol class="rows">${lectureRows(LL)}</ol></section>`:''}
   ${unassigned?'<section class="card"><p>На устройстве есть отметки чтения без привязки к профилю. Добавь их, если это твои отметки.</p><button type="button" class="btn ghost" id="meImport">Добавить мои отметки</button></section>':''}
   ${u?`<section class="card"><p>Подключён ранее выданный код: ${esc(u.name||'профиль')}.</p><button type="button" class="btn ghost" id="meOut">Выйти из прежнего профиля</button></section>`:`<details class="card"><summary>Вход руководителя</summary><form id="meForm"><div class="field"><input id="meCode" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Код руководителя" placeholder="Секретный код"><button class="btn">Войти</button></div><p class="msg" id="meMsg" role="status"></p></form></details>`}${NOTE()}`;
  $('[data-personal-profile]',me).onclick=()=>BV.learning.profile();
  const imp=$('#meImport',me);if(imp)imp.onclick=()=>{if(A.me!==u)return;C.lectures.forEach(L=>{const guest=store.get('guest:seen:'+L.id,store.get('seen:'+L.id,[]));PS.set('seen:'+L.id,[...new Set([...seenOf(L.id),...guest])])});syncProgress(true);renderMe();BV.toast('Отметки добавлены в твой профиль.')};
  const out=$('#meOut',me);if(out)out.onclick=()=>{A.logout();syncWho();renderMe()};
  const form=$('#meForm',me);if(form)form.onsubmit=async e=>{e.preventDefault();const m=$('#meMsg',me),button=$('button',form);button.disabled=true;m.className='msg';m.textContent='Проверяю…';
    try{await A.login($('#meCode',me).value);syncWho();syncProgress(true);renderMe()}catch(er){m.className='msg err';m.textContent=er.message}finally{button.disabled=false}}
}
addEventListener('bv-personal-status',()=>{const s=$('[data-profile-status]',me);if(s&&BV.personal?.connected)s.textContent=BV.personal.message});
addEventListener('bv-personal-data',()=>{if(cur?.kind==='home')renderHome();if(cur?.kind==='me'&&!isAdmin())renderMe()});

function syncWho(){const u=A&&A.me,w=$('.who span');if(w)w.textContent=u?(u.role==='admin'?'Управление':(u.name||'Профиль')):'Профиль';
  const d=$('.dock [data-nav="me"] span');if(d)d.textContent=u?(u.role==='admin'?'Управление':'Профиль'):'Профиль';
  if(cur&&cur.kind==='home')renderHome()}
if(A&&A.ready)A.ready.then(syncWho);

/* ---------- маршрутизация ---------- */
/* страницы из других файлов: {key, nav, parse(части адреса) → параметры или null, show(параметры) → заголовок вкладки} */
const EXT=[];
let cur=null,curLecture=null,acceptedHash=location.hash||'#/';
function parse(h){const p=String(h||'').replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
  if(!p.length)return{kind:'home'};
  if(p[0]==='l'){const L=C.lectures.find(x=>String(x.n)===p[1]);return L?{kind:'lecture',L,sec:p[2]||null}:{kind:'home'}}
  if(p[0]==='me')return{kind:'me'};
  for(const x of EXT){const m=x.parse(p);if(m)return{kind:'x',x,m,key:x.key+':'+(m.key||'')}}
  /* старые адреса прежнего сайта и удалённой лаборатории моделей */
  if(p[0]==='bact')return{kind:'redirect',to:'#/l/1'};
  if(p[0]==='lab'||p[0]==='microlab')return{kind:'redirect',to:'#/labs'};
  return{kind:'home'}}

function scrollToId(scope,id){const el=$('#k-'+id,scope)||$('#'+id,scope);if(!el)return false;
  let n=0;const f=()=>{const t=el.getBoundingClientRect().top-(parseFloat(getComputedStyle(BVHOST.host).getPropertyValue('--barh'))||60)-12;if(Math.abs(t)>4)window.scrollBy(0,t);if(++n<4)setTimeout(()=>requestAnimationFrame(f),140*n)};f();return true}

function show(r){
  if(!dispatchEvent(new CustomEvent('bv-route-request',{cancelable:true,detail:{from:cur,to:r}}))){
    history.replaceState(history.state,'',acceptedHash);return}
  if(r.kind==='redirect'){history.replaceState(null,'',r.to);return show(parse(r.to))}
  acceptedHash=location.hash||'#/';
  /* Readers save their scroll position while their page is still visible. */
  dispatchEvent(new Event('bv-before-route'));
  const target=r.kind==='lecture'?pages['l'+r.L.n]:r.kind==='x'?r.x.page:r.kind==='me'?me:home;
  if(curLecture&&(r.kind!=='lecture'||r.L!==curLecture)){BV.K.hide(curLecture.id);curLecture=null;BV.split&&BV.split.off()}
  Object.values(pages).concat(EXT.map(x=>x.page)).forEach(p=>{p.hidden=p!==target});
  const same=cur&&cur.kind===r.kind&&(cur.L===r.L)&&(cur.key===r.key);
  cur=r;
  if(r.kind==='home')renderHome();
  if(r.kind==='me')renderMe();
  if(r.kind==='lecture'){curLecture=r.L;BV.K.show(r.L.id);fillAfter(r.L);folds(target);BV.split&&BV.split.on(target);requestAnimationFrame(()=>tocLine(target));
    if(r.sec)requestAnimationFrame(()=>{if(!scrollToId(target,r.sec))window.scrollTo({top:0})});else if(!same)window.scrollTo({top:0});
    document.title=`Лекция ${r.L.n}. ${r.L.title} · БиоВиз`}
  else if(r.kind==='x'){if(!same)window.scrollTo({top:0});let t='';try{t=r.x.show(r.m)}catch(e){console.error(r.x.key,e)}document.title=(t?t+' · ':'')+'БиоВиз'}
  else{if(!same)window.scrollTo({top:0});document.title=r.kind==='me'?'Профиль · БиоВиз':`${C.title} · БиоВиз`}
  const nav=r.kind==='lecture'?'home':r.kind==='x'?r.x.nav:r.kind;
  $$('[data-nav]').forEach(a=>{if(a.tagName==='A')a.dataset.nav===nav?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
  if(!same)target.focus({preventScroll:true});
  lastSec=null;
  /* другие файлы (нижняя навигация по лекции) узнают о смене страницы */
  dispatchEvent(new Event('bv-route'))}
let routeVersion=0,routeNotice=null;
async function route(){routeNotice?.remove();const version=++routeVersion,hash=location.hash;let notice;
 try{
  // Keep the current page intact until its successor is ready (including unsaved lab edits).
  const ready=BV_LOAD.route(hash);notice=routeNotice=document.createElement('p');notice.className='msg';notice.setAttribute('role','status');notice.textContent='Открываю раздел…';main.prepend(notice);
  await ready;if(version!==routeVersion)return;show(parse(hash));
 }catch(e){if(version!==routeVersion)return;notice.textContent='Не удалось загрузить раздел. ';const retry=document.createElement('button');retry.className='btn ghost';retry.textContent='Повторить';retry.onclick=route;notice.append(retry);notice=null;console.warn('route',e.message)}finally{notice?.remove()}
}
addEventListener('hashchange',route);
BV.app={go:h=>{if(location.hash===h)route();else location.hash=h},get route(){return cur},refresh:route,
  tocLine:()=>{if(cur&&cur.kind==='lecture')tocLine(pages['l'+cur.L.n])},
  add(x){x.page=page('pg-'+x.key);EXT.push(x);return x.page},
  site,isAdmin,db,lectureRows,visibleLectures};

/* «дальше» под лекцией: следующая лекция и лабораторные работы */
function fillAfter(L){const box=$('.after',pages['l'+L.n]);
  const LL=visibleLectures(),next=LL.find(x=>x.n>L.n);
  box.innerHTML=(next?`<a href="#/l/${next.n}"><small>Следующая лекция</small><b>${esc(next.title)}</b></a>`:'')+
    `<a href="#/labs"><small>Практика</small><b>Лабы</b></a><a href="#/"><small>Курс</small><b>Все лекции</b></a>`}

/* линия прогресса вдоль содержания: заполняется до текущего раздела, пройденные пункты темнее */
function tocLine(page){const toc=$('.k-toc',page);if(!toc||!toc.offsetParent)return;
  const all=$$('a',toc),links=all.filter(a=>a.offsetParent);if(!links.length)return;
  let line=$('.toc-line',toc);if(!line){line=document.createElement('i');line.className='toc-line';line.setAttribute('aria-hidden','true');line.innerHTML='<b></b>';toc.appendChild(line)}
  /* активный пункт может быть скрыт (в узком содержании видны только разделы): берём ближайший видимый выше */
  const on0=$('a.on',toc)||links[0];let on=on0;for(let i=all.indexOf(on0);i>=0;i--){if(all[i].offsetParent){on=all[i];break}}
  const a0=links[0],aN=links[links.length-1],top=a0.offsetTop+6,bot=aN.offsetTop+aN.offsetHeight-6;
  line.style.top=top+'px';line.style.height=Math.max(0,bot-top)+'px';
  line.firstChild.style.height=Math.max(0,on.offsetTop+on.offsetHeight/2-top)+'px';
  let past=true;all.forEach(a=>{if(a===on0)past=false;a.classList.toggle('past',past);a.classList.toggle('cur',a===on)});
  /* подразделы текущего раздела: их показывает раскрытая узкая полоса содержания */
  let par=null,cp=null;all.forEach(a=>{if(!a.classList.contains('sub'))par=a;if(a===on0)cp=par});
  par=null;all.forEach(a=>{if(!a.classList.contains('sub'))par=a;else a.classList.toggle('here',par===cp)})}
let tlRaf=0;
addEventListener('scroll',()=>{if(tlRaf||!cur||cur.kind!=='lecture')return;tlRaf=requestAnimationFrame(()=>{tlRaf=0;tocLine(pages['l'+cur.L.n])})},{passive:true});
addEventListener('resize',()=>{if(cur&&cur.kind==='lecture')tocLine(pages['l'+cur.L.n])});

/* «Мостик от школьного курса» сворачивается в таблетку. Свернуть можно и любую другую врезку: класс k-fold в K.box */
const CHEV='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function folds(scope){$$('.k-box',scope).forEach(bx=>{if(bx.dataset.fold)return;const h=bx.firstElementChild;
  if(!h||h.tagName!=='B'||!(/^Мостик/.test(h.textContent.trim())||bx.classList.contains('k-fold')))return;
  bx.dataset.fold='1';bx.classList.add('k-fold');
  const body=document.createElement('div');body.className='k-fold-b';body.hidden=true;while(h.nextSibling)body.appendChild(h.nextSibling);
  const btn=document.createElement('button');btn.type='button';btn.className='k-fold-h';btn.setAttribute('aria-expanded','false');btn.innerHTML=h.innerHTML+CHEV;
  h.replaceWith(btn);bx.appendChild(body);
  btn.addEventListener('click',()=>{const o=btn.getAttribute('aria-expanded')!=='true';btn.setAttribute('aria-expanded',String(o));body.hidden=!o;if(cur&&cur.kind==='lecture')requestAnimationFrame(()=>tocLine(pages['l'+cur.L.n]))})})}

/* где остановился: текущий раздел пишется в адрес (без новой записи в истории) и в память браузера */
let lastSec=null,tm=0;
addEventListener('scroll',()=>{if(tm)return;tm=setTimeout(()=>{tm=0;if(!cur||cur.kind!=='lecture'||location.hash!==acceptedHash)return;
  const a=$('.k-toc a.on',pages['l'+cur.L.n]);const id=a&&a.dataset.to;if(!id||id===lastSec)return;
  if(window.scrollY<120&&!cur.sec&&!lastSec)return;
  lastSec=id;const L=cur.L;
  try{history.replaceState(history.state,'',`#/l/${L.n}/${id}`)}catch(e){}
  cur={...cur,sec:id};
  PS.set('last',{id:L.id,s:id,t:Date.now()});
  const p=parentOf(L.id,id);if(p){const S=seenOf(L.id);if(!S.has(p.id)){S.add(p.id);PS.set('seen:'+L.id,[...S])}}syncProgress()},250)},{passive:true});

/* ---------- тема ---------- */
const tb=$('[data-theme-btn]');
const drawTb=()=>{tb.innerHTML=ic('set');tb.title='Настройки: оформление, лёгкий режим, работа без интернета'};
drawTb();
const MODES=[['auto','Система'],['light','Светлое'],['dark','Тёмное']];
BV.settings={open:()=>{if(!$('.thm'))tb.click()}};
function drawThm(m){const v=BV.theme.get(),low=BV.mol&&BV.mol.low;
  m.innerHTML=`<b>Оформление</b><div class="seg" role="radiogroup" aria-label="Оформление">${MODES.map(([k,t])=>`<button type="button" role="radio" aria-pressed="${k===v}" aria-checked="${k===v}" data-v="${k}">${ic(k==='dark'?'moon':k==='light'?'sun':'auto')}${t}</button>`).join('')}</div>
    <hr><label class="sw"><input type="checkbox" data-lite${BV.lite?' checked':''}><span>Лёгкий режим<small>Без анимаций и заставки, 3D-модели выключены. Сайт работает быстрее на слабом телефоне или планшете и меньше тратит батарею. Страница перезагрузится.</small></span></label>
    ${low&&!BV.lite?'<p class="tip">Похоже, это устройство не из быстрых. С лёгким режимом сайт будет листаться плавнее.</p>':''}
    <hr><b>Без интернета</b><p data-off>${BV.offline?BV.offline.text():'Лекции, которые ты открывал, сохраняются на этом устройстве.'}</p>`;
  $('[data-lite]',m).addEventListener('change',e=>{store.set('lite',e.target.checked);location.reload()})}
function closeThm(focus){const m=$('.thm');if(!m)return;m.remove();tb.setAttribute('aria-expanded','false');if(focus)tb.focus()}
tb.addEventListener('click',()=>{if($('.thm')){closeThm();return}
  const m=document.createElement('div');m.className='thm';m.setAttribute('role','dialog');m.setAttribute('aria-label','Настройки');drawThm(m);
  R.appendChild(m);const r=tb.getBoundingClientRect();m.style.top=(r.bottom+8)+'px';m.style.right=Math.max(8,innerWidth-r.right)+'px';
  tb.setAttribute('aria-expanded','true');(m.querySelector('[aria-checked="true"]')||m.querySelector('button')).focus();
  m.addEventListener('click',e=>{const b=BV_ET(e).closest('[data-v]');if(!b)return;BV.theme.set(b.dataset.v);drawTb();closeThm(true)})});
document.addEventListener('click',e=>{if($('.thm')&&!BV_ET(e).closest('.thm,[data-theme-btn]'))closeThm()});
R.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('.thm'))closeThm(true)});

/* запуск */
BV.start=()=>route();
})();
