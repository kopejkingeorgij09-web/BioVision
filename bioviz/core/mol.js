/* 3D-модели молекул из RCSB PDB: K.mol({...}) в конспекте, BV.mol.viewer(...) для заставки.
   Структура грузится по ID прямо с сервера RCSB, подпись (организм, метод, разрешение, статья)
   берётся из базы RCSB, поэтому не расходится с первоисточником. Просмотр через 3Dmol.js
   (BSD-лицензия, грузится с jsDelivr только когда модель появляется на экране).

   В конспекте:
     K.mol({id:'molCas9', n:'5.1', pdb:'4UN3', t:'Cas9 на ДНК-мишени', cap:'…',
            parts:[{chain:'B', name:'Cas9', color:'protein'}, {chain:'A', name:'направляющая РНК', color:'rna'},
                   {chain:'C', name:'цепь-мишень ДНК', color:'dna'}, {chain:'D', name:'вторая цепь ДНК', color:'dna2'}]})
   Цвета: protein, protein2, rna, dna, dna2, lig или любой #hex. Без parts всё раскрашивается по типу цепи.
   В data-hl: molCas9#B подсвечивает цепь B, molCas9 снимает подсветку. */
(function(){
const {$,$$,esc}=BV,R=BVHOST.root,K=BV.K;
const LIB=['https://cdn.jsdelivr.net/npm/3dmol@2.5.4/build/3Dmol-min.js','https://unpkg.com/3dmol@2.5.4/build/3Dmol-min.js'];
const BIG=45000;   /* больше атомов: упрощённый рисунок (трасса), чтобы не тормозить */
/* слабое устройство: мало памяти или ядер, экономия трафика. Там модель рисуется без сглаживания и проще */
const LOW=(()=>{try{const n=navigator,c=n.connection||{};return !!(c.saveData||(n.deviceMemory&&n.deviceMemory<=4)||(n.hardwareConcurrency&&n.hardwareConcurrency<=4))}catch(e){return false}})();

const STYLE=`
.kmol .km-st{position:relative;margin:12px 12px 0;border-radius:var(--rs,8px);overflow:hidden;background:radial-gradient(120% 90% at 50% 40%,var(--card),var(--surface-2));border:1px solid var(--line);aspect-ratio:4/3;min-height:220px}
.kmol .km-v{position:absolute;inset:0}
.kmol .km-v canvas{outline:none}
/* пока модель не активирована нажатием, колесо и пальцы прокручивают страницу, а не модель */
.kmol .km-v{pointer-events:none}
.kmol.act .km-v,.kmol.full .km-v{pointer-events:auto}
.kmol .km-st{cursor:pointer}.kmol.act .km-st,.kmol.full .km-st{cursor:grab}
.kmol .km-tap{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:2;padding:7px 12px;border-radius:999px;background:color-mix(in oklab,var(--card) 90%,transparent);border:1px solid var(--line);
  font:600 12.5px/1 var(--font-body);color:var(--ink);pointer-events:none;white-space:nowrap;box-shadow:0 6px 18px -10px rgba(0,0,0,.4);transition:opacity .25s,transform .25s}
.kmol.act .km-tap,.kmol.full .km-tap,.kmol .km-tap[hidden]{opacity:0;transform:translate(-50%,6px)}
.kmol .km-pv{display:grid;gap:10px;justify-items:center;max-width:340px}
.kmol .km-pv svg{width:64px;height:64px;color:var(--cut);opacity:.85}
.kmol .km-pv small{display:block;font:500 12px/1.4 var(--font-mono);color:var(--muted)}
.kmol .km-ov{position:absolute;inset:0;display:grid;place-items:center;padding:20px;text-align:center;color:var(--muted);font-size:14px;line-height:1.5;pointer-events:none}
.kmol .km-ov[hidden]{display:none}
.kmol .km-ov .btn{pointer-events:auto}
.kmol .km-ov b{display:block;color:var(--ink);font-weight:600;margin-bottom:4px}
.km-spin{width:28px;height:28px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--cut);animation:kmR 1s linear infinite;margin:0 auto 10px}
@keyframes kmR{to{transform:rotate(360deg)}}
.kmol .km-tools{position:absolute;right:8px;top:8px;display:flex;gap:6px;z-index:3}
.kmol .km-tools[hidden],.kmol .km-hint[hidden]{display:none}
.kmol .km-tools button{all:unset;cursor:pointer;width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:color-mix(in oklab,var(--card) 88%,transparent);display:grid;place-items:center;color:var(--ink)}
.kmol .km-tools button[aria-pressed="true"]{color:var(--cut);border-color:var(--cut)}
.kmol .km-tools button:focus-visible{outline:2px solid var(--cut);outline-offset:2px}
.kmol .km-tools svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.kmol .km-hint{position:absolute;left:10px;right:10px;bottom:8px;font:500 11px/1.2 var(--font-mono);color:var(--muted);pointer-events:none;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kmol .km-hint i{font-style:normal}.kmol .km-hint .ht{display:none}
@media (pointer:coarse){.kmol .km-hint .hw{display:none}.kmol .km-hint .ht{display:inline}}
.kmol .km-leg{list-style:none;margin:10px 14px 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.kmol .km-leg li{display:inline-flex;align-items:center;gap:7px;padding:5px 10px 5px 8px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-size:13.5px;cursor:pointer;user-select:none}
.kmol .km-leg li i{width:11px;height:11px;border-radius:50%;flex:none}
.kmol .km-leg li.on{border-color:var(--ink);font-weight:600}
.kmol .km-src{display:block;margin-top:6px;font:500 12px/1.5 var(--font-mono);color:var(--muted)}
.kmol .km-src a{color:var(--cut)}
.kmol.full{position:fixed;inset:0;z-index:60;margin:0;border-radius:0;overflow:auto;background:var(--bg);padding:12px 0 24px}
.kmol.full .km-st{aspect-ratio:auto;height:min(78dvh,900px)}
@media (prefers-reduced-motion:reduce){.km-spin{animation:none}}
`;
{const st=document.createElement('style');st.textContent=STYLE;R.appendChild(st)}

const ICO={
 rot:'<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>',
 home:'<path d="M4 12a8 8 0 1 0 8-8"/><circle cx="12" cy="12" r="2.2"/>',
 full:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>'};
const svg=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;
const MOLSVG='<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 40c6-14 14-22 24-20s12 12 6 18-16 4-14-4 12-10 18-4"/><circle cx="14" cy="40" r="4" fill="currentColor" stroke="none"/><circle cx="50" cy="38" r="4" fill="currentColor" stroke="none"/><path d="M10 52c8 4 20 5 32 1" opacity=".45"/></svg>';

/* ---------- цвета в двух темах ---------- */
const PAL={light:{protein:'#2F7A50',protein2:'#7FA88E',protein3:'#B5CDBD',rna:'#C4532E',rna2:'#E2A58D',dna:'#2F6FA8',dna2:'#8AB0D6',lig:'#B08A1E',violet:'#7357A6'},
           dark:{protein:'#6FBF8F',protein2:'#3F7D5A',protein3:'#2C5A41',rna:'#FF8A65',rna2:'#A9583D',dna:'#7FB2E5',dna2:'#41688F',lig:'#E5C15A',violet:'#B39DDB'}};
const DIM={light:'#D3D9D2',dark:'#3A4A41'};
const theme=()=>BVHOST.host.getAttribute('data-theme')==='dark'?'dark':'light';
const col=c=>/^#/.test(c||'')?c:(PAL[theme()][c]||PAL[theme()].protein);

/* ---------- загрузка ---------- */
let libP=null;
function lib(){if(window.$3Dmol)return Promise.resolve(window.$3Dmol);if(libP)return libP;
  libP=(async()=>{for(const u of LIB){try{await new Promise((ok,no)=>{const s=document.createElement('script');s.src=u;s.async=true;s.onload=ok;s.onerror=()=>{s.remove();no()};document.head.appendChild(s)});if(window.$3Dmol)return window.$3Dmol}catch(e){}}
    libP=null;throw new Error('lib')})();return libP}
const metaC=new Map();
function meta(id){id=id.toUpperCase();if(metaC.has(id))return metaC.get(id);
  const q=`{entry(entry_id:"${id}"){struct{title} exptl{method} rcsb_entry_info{resolution_combined deposited_atom_count} rcsb_accession_info{initial_release_date}
    rcsb_primary_citation{rcsb_authors journal_abbrev year pdbx_database_id_DOI}
    polymer_entities{rcsb_entity_source_organism{scientific_name} entity_poly{rcsb_entity_polymer_type} rcsb_polymer_entity{pdbx_description} rcsb_polymer_entity_container_identifiers{auth_asym_ids}}}}`;
  const p=fetch('https://data.rcsb.org/graphql?query='+encodeURIComponent(q.replace(/\s+/g,' '))).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(j=>{const e=j&&j.data&&j.data.entry;if(!e)throw new Error('нет записи');return e});
  p.catch(()=>metaC.delete(id));metaC.set(id,p);return p}
async function data(id){id=id.toUpperCase();
  try{const r=await fetch(`https://models.rcsb.org/${id}.bcif.gz`);if(r.ok)return{d:new Uint8Array(await r.arrayBuffer()),f:'bcif.gz'}}catch(e){}
  const r=await fetch(`https://files.rcsb.org/download/${id}.cif`);if(!r.ok)throw new Error('нет файла');return{d:await r.text(),f:'cif'}}

const METHOD={'X-RAY DIFFRACTION':'рентгеноструктурный анализ','ELECTRON MICROSCOPY':'криоэлектронная микроскопия','SOLUTION NMR':'ЯМР в растворе','SOLID-STATE NMR':'твердотельный ЯМР','NEUTRON DIFFRACTION':'нейтронная дифракция','ELECTRON CRYSTALLOGRAPHY':'электронная кристаллография'};
const num=v=>String(v).replace('.',',');
/* «Salmonella enterica subsp. enterica serovar Typhimurium str. LT2» → «Salmonella enterica serovar Typhimurium» */
const shortOrg=n=>n&&String(n).replace(/\s+subsp\.\s+\S+/,'').replace(/\s+(str\.|strain)\s.*$/i,'').replace(/\s*\(.*\)\s*$/,'').trim();
function srcLine(id,e){const orgs=[...new Set((e.polymer_entities||[]).flatMap(p=>(p.rcsb_entity_source_organism||[]).map(o=>shortOrg(o.scientific_name))).filter(Boolean))];
  const m=(e.exptl||[]).map(x=>METHOD[x.method]||x.method.toLowerCase()).join(', ');
  const res=e.rcsb_entry_info&&e.rcsb_entry_info.resolution_combined&&e.rcsb_entry_info.resolution_combined[0];
  const c=e.rcsb_primary_citation||{},a=c.rcsb_authors||[];
  const who=a.length?(a[0].split(',')[0]+(a.length>2?' и др.':a.length===2?' и '+a[1].split(',')[0]:'')):'';
  const ref=[who,c.journal_abbrev,c.year].filter(Boolean).join(', ');
  return `PDB <a href="https://www.rcsb.org/structure/${id}" target="_blank" rel="noopener">${id}</a>`+(orgs.length?` · <i>${orgs.map(esc).join(', ')}</i>`:'')+(m?` · ${esc(m)}`:'')+(res?`, ${num(res.toFixed(2))} Å`:'')+
    (ref?` · ${c.pdbx_database_id_DOI?`<a href="https://doi.org/${esc(c.pdbx_database_id_DOI)}" target="_blank" rel="noopener">${esc(ref)}</a>`:esc(ref)}`:'')}

/* ---------- просмотрщик ---------- */
/* el — контейнер, opts: {pdb, parts, spin, onReady}. Возвращает объект с методами show(chain|null), spin(on), reset(), resize(), restyle() */
async function viewer(el,opts){const $3D=await lib();
  const v=$3D.createViewer(el,{backgroundAlpha:0,antialias:!LOW&&(window.devicePixelRatio||1)<2,cartoonQuality:LOW?4:6,id:'km'+Math.random().toString(36).slice(2)});
  v.setBackgroundColor(0x000000,0);
  const {d,f}=await data(opts.pdb);
  const m=v.addModel(d,f,{assembly:false,keepH:false,doAssembly:false});
  /* части: из opts.parts или автоматически по типу цепи */
  const atoms=m.selectedAtoms({});const chains=[...new Set(atoms.map(a=>a.chain))];
  const NA=new Set(['A','C','G','U','I']),DNA=new Set(['DA','DC','DG','DT','DI']);
  let parts=opts.parts&&opts.parts.length?opts.parts.map(p=>({...p,chains:String(p.chain).split(/[\s,]+/)})):null;
  if(!parts){let pi=0;const kinds={};atoms.forEach(a=>{if(kinds[a.chain])return;kinds[a.chain]=DNA.has(a.resn)?'dna':NA.has(a.resn)?'rna':a.hetflag?'lig':'protein'});
    parts=chains.filter(c=>kinds[c]!=='lig').map(c=>{const k=kinds[c];return{chains:[c],name:c,color:k==='protein'?['protein','protein2','protein3'][pi++%3]:k}})}
  let focus=null;
  function restyle(){v.setStyle({},{});
    const big=atoms.length>BIG||(LOW&&atoms.length>BIG/3);
    parts.forEach((p,i)=>{const sel={chain:p.chains},c=col(p.color),dim=focus!=null&&focus!==i;
      /* у 3Dmol одна прозрачность на модель, поэтому остальные части не прячутся, а приглушаются цветом */
      const cs={color:dim?DIM[theme()]:c,thickness:big?.5:.42,arrows:!big};if(big)cs.style='trace';
      v.setStyle(sel,{cartoon:cs})});
    v.render()}
  restyle();v.zoomTo({chain:[].concat(...parts.map(p=>p.chains))});v.zoom(1.08);v.render();
  const home=v.getView();
  let spinning=false;
  const api={v,parts,atoms:atoms.length,
    show(k){let i=null;
      /* число: номер части; строка: цепь, название части или номер */
      if(typeof k==='number')i=k;else if(k!=null){k=String(k);i=parts.findIndex(p=>p.chains.includes(k));if(i<0)i=parts.findIndex(p=>p.name===k);if(i<0&&/^\d+$/.test(k))i=+k}
      focus=i==null||i<0||i>=parts.length?null:i;restyle();return focus},
    spin(on){spinning=on;v.spin(on?'y':false,on?.35:0)},get spinning(){return spinning},
    reset(){v.setView(home);v.render()},resize(){v.resize();v.render()},restyle};
  return api}

/* ---------- K.mol в конспекте ---------- */
K.mol=o=>{const parts=o.parts||[];
  return `<figure class="kf kmol" id="f-${o.id}" data-mol="${o.id}" data-pdb="${esc(o.pdb)}"${parts.length?` data-parts="${esc(JSON.stringify(parts))}"`:''}>
  <div class="km-st"><div class="km-v" aria-label="3D-модель ${esc(o.t||o.pdb)}" role="img"></div><div class="km-ov"><div class="km-pv">${MOLSVG}<div>3D-модель ${esc(o.pdb)}</div></div></div>
    <div class="km-tools" hidden><button type="button" class="km-rot" aria-pressed="false" title="Вращение" aria-label="Вращение">${svg('rot')}</button><button type="button" class="km-home" title="Исходный вид" aria-label="Исходный вид">${svg('home')}</button><button type="button" class="km-full" title="Крупнее" aria-label="Открыть модель крупнее">${svg('full')}</button></div>
    <span class="km-tap" hidden>Нажми на модель, чтобы вращать</span><span class="km-hint" hidden>тяни, чтобы повернуть · <i class="hw">колесо</i><i class="ht">два пальца</i> для масштаба<i class="hw"> · Esc, чтобы отпустить</i></span></div>
  ${parts.length?`<ol class="km-leg">${parts.map((p,i)=>`<li data-i="${i}"><i data-c="${esc(p.color||'protein')}"></i>${esc(p.name)}</li>`).join('')}</ol>`:''}
  <figcaption>${o.n?`<b>Рис. ${o.n}.</b> `:''}${o.t?`<b>${o.t}.</b> `:''}${o.cap||''}<span class="km-src">PDB <a href="https://www.rcsb.org/structure/${esc(o.pdb)}" target="_blank" rel="noopener">${esc(o.pdb)}</a></span></figcaption></figure>`};

const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function paintLeg(f){$$('.km-leg i',f).forEach(i=>i.style.background=col(i.dataset.c))}
/* модель грузится только по нажатию: структура весит мегабайты, а её разбор на слабом телефоне подвешивает страницу.
   Когда карточка подходит к экрану, подтягивается только подпись из базы RCSB (несколько килобайт) */
async function preview(f){if(f._kmPv)return;f._kmPv=1;const ov=$('.km-ov',f),id=f.dataset.pdb;
  const draw=n=>{if(f._km)return;ov.hidden=false;ov.innerHTML=`<div class="km-pv">${MOLSVG}<div><b>3D-модель ${esc(id)}</b>${n?`<small>${n.toLocaleString('ru-RU')} атомов${n>BIG?' · загрузка займёт время':''}</small>`:''}</div>${BV.lite?'<small>В лёгком режиме 3D-модели выключены</small>':''}<button type="button" class="btn${BV.lite?' ghost':''} km-go">${BV.lite?'Всё равно показать':'Показать 3D-модель'}</button></div>`;
    $('.km-go',ov).addEventListener('click',ev=>{ev.stopPropagation();start(f)},{once:true})};
  draw(0);
  try{const e=await meta(id);$('.km-src',f).innerHTML=srcLine(id,e);draw(e.rcsb_entry_info&&e.rcsb_entry_info.deposited_atom_count)}catch(err){}}
async function start(f){if(f._km)return;f._km='load';const ov=$('.km-ov',f),id=f.dataset.pdb;
  ov.hidden=false;ov.innerHTML=`<div><div class="km-spin"></div>Загружаю структуру ${esc(id)} из RCSB PDB…</div>`;
  if(!f._kmPv){f._kmPv=1;meta(id).then(e=>{$('.km-src',f).innerHTML=srcLine(id,e)}).catch(()=>{})}
  try{const parts=f.dataset.parts?JSON.parse(f.dataset.parts):null;
    /* дать браузеру дорисовать индикатор, прежде чем тяжёлый разбор займёт поток */
    await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,30)));
    const M=await viewer($('.km-v',f),{pdb:id,parts});f._km=M;ov.hidden=true;
    $('.km-tools',f).hidden=false;$('.km-hint',f).hidden=false;$('.km-tap',f).hidden=false;paintLeg(f);
    const rot=$('.km-rot',f);const setRot=on=>{M.spin(on);rot.setAttribute('aria-pressed',String(on))};
    rot.addEventListener('click',()=>{f._spinOn=!M.spinning;setRot(f._spinOn)});$('.km-home',f).addEventListener('click',()=>M.reset());
    $('.km-full',f).addEventListener('click',()=>{const on=!f.classList.contains('full');f.classList.toggle('full',on);$('.km-full',f).innerHTML=svg(on?'x':'full');requestAnimationFrame(()=>M.resize())});
    f._pick=k=>{f._want=k;const i=M.show(k==null?null:k);$$('.km-leg li',f).forEach(li=>li.classList.toggle('on',i!=null&&+li.dataset.i===i))};
    if(f._want!=null)f._pick(f._want);
    const leg=$('.km-leg',f);if(leg)leg.addEventListener('click',ev=>{const li=BV_ET(ev).closest('li');if(!li)return;f._pick(li.classList.contains('on')?null:+li.dataset.i)});
    /* вращение по умолчанию выключено: непрерывная перерисовка нагружает видеокарту и тормозит прокрутку */
    f._spinOn=false;f._rot=setRot;
    /* нажатие на модель включает управление ею, уход модели с экрана или нажатие мимо выключают */
    $('.km-st',f).addEventListener('click',ev=>{if(BV_ET(ev).closest('.km-tools'))return;act(f,true)});
    let rs=0;if(window.ResizeObserver)new ResizeObserver(()=>{cancelAnimationFrame(rs);rs=requestAnimationFrame(()=>M.resize())}).observe($('.km-st',f))}
  catch(err){console.warn('mol',id,err);f._km=null;ov.innerHTML=`<div><b>Модель не загрузилась</b>Нет связи с RCSB PDB. Её можно открыть <a href="https://www.rcsb.org/3d-view/${esc(id)}" target="_blank" rel="noopener" style="pointer-events:auto">на сайте RCSB</a>.<br><button type="button" class="btn ghost km-go" style="margin-top:10px">Попробовать ещё раз</button></div>`;
    $('.km-go',ov).addEventListener('click',ev=>{ev.stopPropagation();start(f)},{once:true})}}
function act(f,on){if(!f._km||typeof f._km!=='object')return;f.classList.toggle('act',on)}
R.addEventListener('pointerdown',e=>{const t=BV_ET(e);$$('.kmol.act').forEach(f=>{if(!f.contains(t))act(f,false)})},true);

/* запуск, когда модель подходит к экрану; вращение только пока она видна */
const vis=new Set();
const io=window.IntersectionObserver?new IntersectionObserver(es=>es.forEach(en=>{const f=en.target;
  if(en.isIntersecting){vis.add(f);if(!f._km)preview(f);else if(f._rot&&f._spinOn)f._rot(true)}
  else{vis.delete(f);act(f,false);if(f._rot&&f._km&&f._km.spinning)f._rot(false)}}),{rootMargin:'300px 0px'}):null;
/* выбор части до загрузки запоминается и применяется, когда модель готова */
function scan(){$$('.kmol').forEach(f=>{if(f._kmSeen)return;f._kmSeen=1;paintLeg(f);if(!f._pick)f._pick=k=>{f._want=k};if(io)io.observe(f);else preview(f)})}
/* панель рисунков справа будит модель сама: внутри липкой панели наблюдатель срабатывает не всегда */
function wake(f){if(!f||!f.classList.contains('kmol'))return;vis.add(f);if(!f._km)preview(f);else if(f._rot&&f._spinOn)f._rot(true);if(f._km&&f._km.resize)requestAnimationFrame(()=>f._km.resize())}
function sleep(f){if(!f||!f.classList.contains('kmol'))return;vis.delete(f);act(f,false);if(f._rot&&f._km&&f._km.spinning)f._rot(false)}
new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,60)}).observe(R,{childList:true,subtree:true});
/* смена темы: перекрасить */
new MutationObserver(()=>{$$('.kmol').forEach(f=>{paintLeg(f);if(f._km&&f._km.restyle)f._km.restyle()})}).observe(BVHOST.host,{attributes:true,attributeFilter:['data-theme']});
R.addEventListener('keydown',e=>{if(e.key==='Escape'){const f=$('.kmol.full');if(f)$('.km-full',f).click();$$('.kmol.act').forEach(x=>act(x,false))}});

BV.mol={viewer,meta,srcLine,lib,wake,sleep,low:LOW,palette:()=>PAL[theme()]};
})();
