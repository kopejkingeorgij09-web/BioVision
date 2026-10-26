/* Лаборатория: интерактивные модели без длинного текста, каждая в своей карточке.
   Один и тот же рисунок можно показать и в лаборатории, и в конспекте: BV.EL.fig(build) вызывает build(суффикс) дважды.
   Страницу лаборатории собирает BV.EL.lab(boxId, {intro, list}); подключение — в content/course.js. */
(function(){
const {$,$$}=BV,K=BV.K,R=BVHOST.root;
/* перехват K.init: обработчики рисунков нужны и во вкладке «Лаборатория» */
const H=BV.KH=BV.KH||{};
if(!K._el){const o=K.init;K.init=(id,fn)=>{H[id]=fn;return o(id,fn)};K._el=1}

const CSS=`
.el-lab{display:flex;flex-direction:column;gap:22px;min-width:0}
.el-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:20px 22px 10px;display:flex;flex-direction:column;gap:8px;min-width:0;box-shadow:0 1px 2px rgba(10,40,30,.04),0 12px 34px -26px rgba(10,40,30,.3)}
@media (max-width:640px){.el-card{padding:16px 12px 6px;border-radius:18px}}
.el-card>header{display:flex;gap:12px;align-items:flex-start}
.el-card>header i{flex:none;font-style:normal;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-weight:700;font-size:15px;color:#fff;background:var(--c,var(--hema))}
.el-card h2{font-family:var(--font-display);font-size:clamp(18px,2.2vw,21px);line-height:1.2;margin:2px 0 3px}
.el-card header p{margin:0;color:var(--muted);font-size:14.5px;line-height:1.5}
.el-card .kf{margin:4px 0 6px}
.el-lab .kf-zoom{display:none}
.el-more{display:flex;flex-wrap:wrap;gap:8px;padding:2px 0 12px}
.el-more a{font-size:13.5px;font-weight:600;color:var(--ui);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:6px 13px}
.el-more a:hover{border-color:var(--ui)}
.el-intro{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.el-intro div{border:1px solid var(--line);background:var(--surface);border-radius:16px;padding:12px 14px;font-size:13.5px;color:var(--muted);line-height:1.45}
.el-intro b{display:block;color:var(--ink);font-size:14.5px;margin-bottom:2px}
.el-seq{font-family:var(--font-mono);font-size:13px;width:100%;min-height:62px;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--surface-2);color:var(--ink);resize:vertical;letter-spacing:.04em}
.el-list{display:flex;flex-wrap:wrap;gap:6px;margin:6px 14px 0}
.el-list button{all:unset;box-sizing:border-box;cursor:pointer;font:600 12.5px var(--font-mono);border:1px solid var(--line);border-radius:10px;padding:5px 9px;background:var(--surface);color:var(--ink);display:flex;gap:6px;align-items:center}
.el-list button[aria-pressed="true"]{border-color:var(--hema);background:color-mix(in oklab,var(--hema) 10%,var(--surface))}
.el-list button em{font-style:normal;font-family:var(--font-body);font-weight:700;font-size:11px;padding:1px 6px;border-radius:6px;background:var(--surface-2);color:var(--muted)}
.el-list button em.ok{background:color-mix(in oklab,var(--ok) 16%,var(--surface));color:var(--ok)}
.el-list button em.bad{background:color-mix(in oklab,var(--bad) 14%,var(--surface));color:var(--bad)}
.el-tx{margin:8px 14px 0;font-size:14.2px;line-height:1.55}
.el-tx p{margin:0 0 6px}
.el-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 14px 0}
.el-row input[type=text],.el-row input[type=number]{border:1px solid var(--line);border-radius:10px;padding:7px 10px;background:var(--surface-2);color:var(--ink);font:14px var(--font-mono);min-width:0}
.el-badge{display:inline-flex;font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--surface-2);color:var(--muted)}
.k-steptx p b,.k-steptx li b,.k-steptx p strong{display:inline;font-family:var(--font-body);font-size:inherit;font-weight:700;margin:0}
.el-badge.ok{background:color-mix(in oklab,var(--ok) 16%,var(--surface));color:var(--ok)}
.el-badge.bad{background:color-mix(in oklab,var(--bad) 14%,var(--surface));color:var(--bad)}
.el-badge.warn{background:color-mix(in oklab,var(--amber,#c98a12) 18%,var(--surface));color:#9a6a0a}
:host([data-theme="dark"]) .el-badge.warn{color:#f2c46a}
`;
const st=document.createElement('style');st.textContent=CSS;R.appendChild(st);

/* рисунок, который живёт и в конспекте, и в лаборатории */
const FIG={};
function fig(name,build){FIG[name]={doc:build(''),lab:build('L'),id:name};return FIG[name].doc}
function lab(boxId,items){const box=$('#'+boxId);if(!box)return;
  box.innerHTML=(items.intro||'')+items.list.map((it,i)=>`<section class="el-card" id="lab-${it.f}" style="--c:${it.c||'var(--hema)'}"><header><i>${i+1}</i><div><h2>${it.t}</h2><p>${it.p}</p></div></header>${FIG[it.f].lab}${it.doc?`<div class="el-more"><a href="#/${it.doc[0]}${it.doc[1]?'/'+it.doc[1]:''}">${it.doc[2]||'Теория к этой модели'} →</a></div>`:''}</section>`).join('');
  items.list.forEach(it=>{const id=it.f+'L',f=$('#f-'+id,box),fn=H[id];if(f&&fn){try{fn(f,f.querySelector('.kf-st>svg'))}catch(e){console.error('Лаборатория',id,e)}}});
}
/* генетический код и работа с последовательностями — общие для CRISPR и биоинформатики */
const NT='TCAG',AA='FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',CODE={};
for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)CODE[NT[i]+NT[j]+NT[k]]=AA[16*i+4*j+k];
const CMP={A:'T',T:'A',G:'C',C:'G',N:'N'};
const seqUtil={CODE,
  clean:s=>String(s||'').toUpperCase().replace(/U/g,'T').replace(/[^ACGT]/g,''),
  rc:s=>s.split('').reverse().map(c=>CMP[c]||'N').join(''),
  comp:s=>s.split('').map(c=>CMP[c]||'N').join(''),
  tr:(s,stop=true)=>{let p='';for(let i=0;i+2<s.length;i+=3){const a=CODE[s.slice(i,i+3)]||'X';p+=a;if(stop&&a==='*')break}return p},
  gc:s=>s.length?s.split('').filter(c=>c==='G'||c==='C').length/s.length*100:0};
const AA3={A:'Ala',R:'Arg',N:'Asn',D:'Asp',C:'Cys',Q:'Gln',E:'Glu',G:'Gly',H:'His',I:'Ile',L:'Leu',K:'Lys',M:'Met',F:'Phe',P:'Pro',S:'Ser',T:'Thr',W:'Trp',Y:'Tyr',V:'Val','*':'стоп'};
BV.EL={fig,lab,FIG,H,seq:seqUtil,AA3};
})();
