/* Стенд атак стихий: атакующий слева, цель справа, кнопки семи атак, шкала фаз, журнал событий.
   Итог прогона «все семь подряд» лежит в window.__atk (для автопроверки). Сохраняется только выбор на странице. */
(function(){
'use strict';
const D=window.DRG,ATK=window.DRATK,SC=window.DRSCENE,TX=window.DRTEX;
const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
const mk=spec=>D.make(Object.assign({},BASE,spec));
const WHO=[['F','Огонь','F/F'],['W','Вода','W/W'],['T','Земля','T/T'],['A','Воздух','A/A'],['P','Флора','P/P'],['L','Свет','L/L'],['D','Тьма','D/D'],
  ['FW','Огонь + Вода','F/W'],['TA','Земля + Воздух','T/A'],['baby','Малыш Огня','F/F',2]];
const NAME={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const $=id=>document.getElementById(id);
const st={who:'F',reduce:null,slow:false,dark:null};
try{Object.assign(st,JSON.parse(localStorage.getItem('drgAtk')||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem('drgAtk',JSON.stringify(st))}catch(e){}};
const sysStill=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const reduce=()=>st.reduce==null?sysStill():st.reduce;
const f1=v=>v.toFixed(1).replace('.',','),f2=v=>v.toFixed(2).replace('.',',');
function applyTheme(){if(st.dark==null)document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',st.dark?'dark':'light')}

let scene=null,att=null,tgt=null,cur=null,busy=false,loading=0;
const log=[];const out={runs:[],errors:[]};window.__atk=null;
function say(s){log.push(s);if(log.length>200)log.shift();$('log').textContent=log.join('\n');$('log').scrollTop=1e9}

async function build(){
  const my=++loading;if(scene)scene.destroy();
  const cv=$('cv');scene=new SC.Scene(cv,{width:210,top:92,reduce:reduce()});scene.fit();
  const w=WHO.find(x=>x[0]===st.who)||WHO[0];
  const a=await scene.add(D.phenotype(mk({E:w[2]})),w[3]||12,52,1);
  const b=await scene.add(D.phenotype(mk({E:'T/T',K:'K/k'})),12,158,-1);
  if(my!==loading){return}
  scene.layout(12,40);
  att=a;tgt=b;scene.speed=st.slow?0.25:1;scene.start();drawEls();drawTl(null);window.__scene={scene,att,tgt}}

function drawEls(){
  const els=ATK.elementsOf(att.M);
  $('els').innerHTML=ATK.ORDER.map(e=>{const A=ATK.ATTACKS[e],own=els.includes(e);
    return `<button class="act${own?'':' no'}" data-el="${e}" aria-pressed="false" title="${A.name}${own?'':' (у этого дракона нет такой стихии, но показать можно)'}">${NAME[e]}: ${A.name}</button>`}).join('');
  $('now').textContent=`Атакует: ${(WHO.find(x=>x[0]===st.who)||WHO[0])[1]}. ${els.length>1?'У гибрида две атаки, по одной от каждой стихии.':''}`}
function drawTl(run){
  if(!run){$('tl').innerHTML='';return}
  const T=run.tl.total;$('tl').innerHTML=run.tl.phases.map(p=>`<span data-p="${p.name}" style="left:${(p.t0/T*100).toFixed(2)}%;width:${((p.t1-p.t0)/T*100).toFixed(2)}%">${PH[p.name]}</span>`).join('')+'<i id="tlm"></i>'}
const PH={prep:'подготовка',charge:'заряд',main:'выпуск',travel:'полёт',hit:'попадание',react:'реакция',recover:'восстановление'};

function fire(el){
  return new Promise(res=>{
    if(!scene||!att)return res(null);
    const t0=performance.now(),rec={el,impacts:0,phases:[],maxP:0,launchAt:null,impactAt:null,ms:0};
    const run=scene.attack(att,tgt,el,{
      onEvent:(e,r)=>{const tt=f2(r.t);if(e.type==='phase'){rec.phases.push(e.name);say(`${tt} с  ${NAME[el]}: ${PH[e.name]}`)}
        else if(e.type==='launch'){rec.launchAt=r.t;say(`${tt} с  ${NAME[el]}: выпуск`)}
        else if(e.type==='impact'){rec.impacts++;rec.impactAt=r.t;say(`${tt} с  ${NAME[el]}: ПОПАДАНИЕ (${rec.impacts})`)}},
      onEnd:(e,r)=>{rec.ms=performance.now()-t0;rec.spawned=r.spawned;say(`${f2(r.t)} с  ${NAME[el]}: конец, частиц всего ${r.spawned}, одновременно не больше ${rec.maxP}`);out.runs.push(rec);res(rec)}});
    cur=run;drawTl(run);
    const watch=()=>{if(run.done)return;rec.maxP=Math.max(rec.maxP,run.p.length);const m=$('tlm');if(m)m.style.left=(run.t/run.tl.total*100).toFixed(2)+'%';
      document.querySelectorAll('#tl span').forEach(s=>s.classList.toggle('on',s.dataset.p===run.phase));requestAnimationFrame(watch)};watch()})}

async function all(){
  if(busy)return;busy=true;out.runs=[];
  for(const e of ATK.ORDER){await fire(e);await new Promise(r=>setTimeout(r,350/(scene.speed||1)))}
  busy=false;const ms=scene.stats.draw.slice().sort((a,b)=>a-b),fr=scene.stats.frame.slice().sort((a,b)=>a-b);
  window.__atk={runs:out.runs,errors:out.errors,drawMed:ms[ms.length>>1],drawP95:ms[Math.floor(ms.length*0.95)],frameMed:fr[fr.length>>1],frameP95:fr[Math.floor(fr.length*0.95)],reduce:reduce(),cache:TX.shared.stats()};
  say(`Готово: ${out.runs.length} атак, попаданий ${out.runs.map(r=>r.impacts).join(' ')}; JS кадра ${f1(window.__atk.drawMed)} мс, интервал кадров ${f1(window.__atk.frameMed)} мс (95 % не дольше ${f1(window.__atk.frameP95)} мс)`);
  facts()}

function facts(){
  const s=scene&&scene.stats,ms=s?s.draw.slice().sort((a,b)=>a-b):[],med=ms[ms.length>>1]||0;
  $('facts').innerHTML=[
    ['Фазы и урон','Удар засчитывается один раз, в начале фазы «попадание». Урон считает бой, сцена только сообщает о попадании. Подготовка и заряд вместе 0,55 с: в этот миг в анимации атаки пасть открыта шире всего.'],
    ['Меньше движения','Фазы короче, частиц вчетверо меньше (не больше '+ATK.MAXP_R+'), нет тряски и вспышек. По умолчанию как в системе.'],
    ['Предел частиц',`Не больше ${ATK.MAXP} на атаку одновременно. Сейчас в сцене ${s?s.parts:0}.`],
    ['Кадр',(()=>{const fr=s?s.frame.slice().sort((a,b)=>a-b):[];return `JS рисования ${f1(med)} мс, интервал кадров ${f1(fr[fr.length>>1]||0)} мс (замер на этом устройстве, медиана последних кадров)`})()],
    ['Гибриды','У гибрида две атаки, по одной от каждой стихии. Новых генов для этого нет.']
  ].map(([h,v])=>`<div class="fact"><h3>${h}</h3><div class="v">${v}</div></div>`).join('')}

function init(){
  applyTheme();
  $('who').innerHTML='<span class="lbl">Атакует:</span>'+WHO.map(w=>`<button class="chip" data-who="${w[0]}" aria-pressed="${w[0]===st.who}">${w[1]}</button>`).join('');
  document.querySelectorAll('[data-t]').forEach(b=>{const k=b.dataset.t;b.setAttribute('aria-pressed',String(k==='reduce'?reduce():k==='dark'?!!st.dark:!!st[k]))});
  document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.who){st.who=b.dataset.who;save();document.querySelectorAll('[data-who]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));build();return}
    if(b.dataset.el){if(!busy)fire(b.dataset.el);return}
    if(b.id==='all'){all();return}
    const k=b.dataset.t;if(!k)return;
    if(k==='reduce'){st.reduce=!reduce();b.setAttribute('aria-pressed',String(st.reduce));save();build()}
    else if(k==='slow'){st.slow=!st.slow;b.setAttribute('aria-pressed',String(st.slow));save();if(scene)scene.speed=st.slow?0.25:1}
    else if(k==='dark'){st.dark=!st.dark;b.setAttribute('aria-pressed',String(st.dark));save();applyTheme()}});
  addEventListener('resize',()=>{if(scene)scene.fit()});
  build().then(()=>{facts();if(/[?&]auto=1/.test(location.search))setTimeout(all,300)}).catch(e=>{out.errors.push(e.message);$('now').textContent='Ошибка: '+e.message});
  setInterval(facts,1500)}
window.addEventListener('error',e=>out.errors.push(String(e.message)));
init();
})();
