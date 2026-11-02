/* Головоломки дня: три задачи на логику, каждый день новые, у каждой ровно одно решение.
   5.0: от простого к сложному — лёгкая Бинарио 6×6 (много открытых клеток), средняя Кендоку 5×5, сложная Небоскрёбы 5×5.
   Награда растёт со сложностью (rewardOf), за день по-прежнему до 300 золота.
   Задача строится из зерна (ученица + дата), поэтому её можно построить заново
   и проверить ответ в экономике острова (economy.js, действие puzzle) без хранения задачи в документе.
   Единственность решения проверяет решатель: подсказки убираются, пока решение остаётся единственным.
   Чистый модуль без DOM: node phagi/dragons/puzzles.test.js */
(function(root){
'use strict';
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let a=hash(String(seed))>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const shuffle=(a,r)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
/* случайный латинский квадрат N×N: перестановки строк, столбцов и символов циклического */
function latin(N,r){const rows=shuffle([...Array(N).keys()],r),cols=shuffle([...Array(N).keys()],r),sym=shuffle([...Array(N).keys()].map(x=>x+1),r);
  return rows.map(i=>cols.map(j=>sym[(i+j)%N]))}

/* ---------- Небоскрёбы ----------
   Сетка N×N, в каждой строке и столбце высоты 1…N по одному разу. Число у края — сколько домов видно с этой стороны:
   высокий дом закрывает все низкие за ним. Подсказки: top[j], bottom[j], left[i], right[i], 0 — подсказки нет */
const seen=a=>{let m=0,n=0;for(const x of a)if(x>m){m=x;n++}return n};
function skyClues(g){const N=g.length,col=j=>g.map(r=>r[j]);
  return {top:[...Array(N).keys()].map(j=>seen(col(j))),bottom:[...Array(N).keys()].map(j=>seen(col(j).reverse())),
    left:g.map(r=>seen(r)),right:g.map(r=>seen(r.slice().reverse()))}}
function skyOk(line,a,b){if(line.some(x=>!x))return true;return (!a||seen(line)===a)&&(!b||seen(line.slice().reverse())===b)}
/* решатель: строки берутся целиком из перестановок 1…N, подходящих к подсказкам слева и справа, столбцы проверяются по ходу
   (повтор, видно уже больше, чем сказано сверху, или уже не успеть набрать нужное). Перебор по клеткам давал до секунды на задачу */
const PERMS={};
function permsOf(N){if(PERMS[N])return PERMS[N];const out=[],a=[...Array(N)].map((_,i)=>i+1);
  const rec=k=>{if(k===N){out.push(a.slice());return}for(let i=k;i<N;i++){[a[k],a[i]]=[a[i],a[k]];rec(k+1);[a[k],a[i]]=[a[i],a[k]]}};rec(0);return PERMS[N]=out}
function skySolve(N,cl,limit){const rows=[...Array(N)].map((_,i)=>permsOf(N).filter(p=>skyOk(p,cl.left[i],cl.right[i])));
  const g=[],mx=Array(N).fill(0),vis=Array(N).fill(0);let n=0,sol=null;
  const rec=i=>{if(n>=limit)return;if(i===N){n++;if(!sol)sol=g.map(r=>r.slice());return}
    for(const p of rows[i]){let ok=true;
      for(let j=0;j<N&&ok;j++){const v=p[j];for(let t=0;t<i;t++)if(g[t][j]===v){ok=false;break}
        if(!ok)break;const nv=vis[j]+(v>mx[j]?1:0),c=cl.top[j];if(c&&(nv>c||nv+(N-1-i)<c))ok=false}
      if(!ok)continue;
      const m0=mx.slice(),v0=vis.slice();for(let j=0;j<N;j++){if(p[j]>mx[j]){mx[j]=p[j];vis[j]++}}
      g[i]=p;
      if(i<N-1||[...Array(N).keys()].every(j=>!cl.bottom[j]||seen(g.map(r=>r[j]).reverse())===cl.bottom[j]))rec(i+1);
      for(let j=0;j<N;j++){mx[j]=m0[j];vis[j]=v0[j]}}
    g.length=i};
  rec(0);return {n,sol}}
/* подсказок оставляется около SKY_T: меньше — уже задача для экспертов, больше — слишком легко. Из четырёх вариантов дня
   берётся ближайший к этому числу */
const SKY_T=10;
function makeSky(seed,N){let best=null;for(let t=0;t<4;t++){const p=makeSky1(seed+':'+t,N),n=Object.values(p.clues).flat().filter(Boolean).length;
  if(!best||Math.abs(n-SKY_T)<Math.abs(best.n-SKY_T))best=Object.assign(p,{n})}delete best.n;return best}
function makeSky1(seed,N){N=N||5;const r=rng('sky:'+seed),g=latin(N,r),c=skyClues(g);
  const keys=shuffle([].concat(...['top','bottom','left','right'].map(s=>[...Array(N).keys()].map(i=>[s,i]))),r);
  for(const [s,i] of keys){if(Object.values(c).flat().filter(Boolean).length<=SKY_T)break;const v=c[s][i];c[s][i]=0;if(skySolve(N,c,2).n!==1)c[s][i]=v}
  return {kind:'sky',N,clues:c,sol:g}}

/* ---------- Бинарио ----------
   Сетка N×N из 0 и 1: не больше двух одинаковых подряд, в каждой строке и столбце поровну нулей и единиц,
   строки попарно разные и столбцы попарно разные. given[i][j] — число или null */
function binLineOk(a,N){for(let k=2;k<a.length;k++)if(a[k]!=null&&a[k]===a[k-1]&&a[k]===a[k-2])return false;
  const z=a.filter(x=>x===0).length,o=a.filter(x=>x===1).length;return z<=N/2&&o<=N/2}
function binSolve(N,given,limit,r){const g=given.map(x=>x.slice());let n=0,sol=null;const cells=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++)if(g[i][j]==null)cells.push([i,j]);
  const full=a=>a.every(x=>x!=null);
  const okAt=(i,j)=>{const row=g[i],col=g.map(x=>x[j]);if(!binLineOk(row,N)||!binLineOk(col,N))return false;
    if(full(row))for(let t=0;t<N;t++)if(t!==i&&full(g[t])&&g[t].join()===row.join())return false;
    if(full(col))for(let t=0;t<N;t++)if(t!==j){const c2=g.map(x=>x[t]);if(full(c2)&&c2.join()===col.join())return false}
    return true};
  const rec=k=>{if(n>=limit)return;if(k===cells.length){n++;if(!sol)sol=g.map(x=>x.slice());return}const [i,j]=cells[k];
    const vs=r&&r()<0.5?[1,0]:[0,1];for(const v of vs){g[i][j]=v;if(okAt(i,j))rec(k+1);g[i][j]=null}};
  rec(0);return {n,sol}}
/* keep — сколько открытых клеток оставить как минимум: лёгкая задача не урезается до предела */
function makeBin(seed,N,keep){N=N||8;keep=keep||0;const r=rng('bin:'+N+':'+seed);
  const full=binSolve(N,[...Array(N)].map(()=>Array(N).fill(null)),1,r).sol;
  const given=full.map(x=>x.slice()),cells=shuffle([].concat(...full.map((row,i)=>row.map((_,j)=>[i,j]))),r);
  let left=N*N;
  for(const [i,j] of cells){if(left<=keep)break;const v=given[i][j];given[i][j]=null;if(binSolve(N,given,2).n!==1)given[i][j]=v;else left--}
  return {kind:'bin',N,given,sol:full}}

/* ---------- Кендоку ----------
   Латинский квадрат N×N, разбитый на клетки-группы. У группы число и действие: сумма (+), произведение (×),
   разность (−) или частное (÷) для пары; группа из одной ячейки просто показывает число */
function cageVal(vals,op){if(op==='+')return vals.reduce((a,b)=>a+b,0);if(op==='×')return vals.reduce((a,b)=>a*b,1);
  if(op==='−')return Math.abs(vals[0]-vals[1]);if(op==='÷'){const [a,b]=vals[0]>vals[1]?vals:[vals[1],vals[0]];return a%b?null:a/b}return vals[0]}
function kenSolve(N,cages,limit){const g=[...Array(N)].map(()=>Array(N).fill(0)),at=[...Array(N)].map(()=>Array(N).fill(-1));
  cages.forEach((c,k)=>c.cells.forEach(([i,j])=>at[i][j]=k));let n=0,sol=null;
  const cageOk=k=>{const c=cages[k],vs=c.cells.map(([i,j])=>g[i][j]);if(vs.some(v=>!v)){
      if(c.op==='+')return vs.reduce((a,b)=>a+b,0)<c.v;if(c.op==='×')return c.v%vs.filter(Boolean).reduce((a,b)=>a*b,1)===0;return true}
    return cageVal(vs,c.op)===c.v};
  const rec=k=>{if(n>=limit)return;if(k===N*N){n++;if(!sol)sol=g.map(r=>r.slice());return}const i=Math.floor(k/N),j=k%N;
    for(let v=1;v<=N;v++){if(g[i].includes(v))continue;let bad=false;for(let t=0;t<i;t++)if(g[t][j]===v){bad=true;break}if(bad)continue;
      g[i][j]=v;if(cageOk(at[i][j]))rec(k+1);g[i][j]=0}};
  rec(0);return {n,sol}}
function kenCages(g,r){const N=g.length,used=[...Array(N)].map(()=>Array(N).fill(false)),cages=[];
  const cells=shuffle([].concat(...g.map((row,i)=>row.map((_,j)=>[i,j]))),r);
  for(const [i0,j0] of cells){if(used[i0][j0])continue;const want=r()<0.12?1:r()<0.55?2:3,cs=[[i0,j0]];used[i0][j0]=true;
    while(cs.length<want){const nb=[];cs.forEach(([i,j])=>[[1,0],[-1,0],[0,1],[0,-1]].forEach(([a,b])=>{const x=i+a,y=j+b;if(x>=0&&y>=0&&x<N&&y<N&&!used[x][y])nb.push([x,y])}));
      if(!nb.length)break;const p=nb[Math.floor(r()*nb.length)];used[p[0]][p[1]]=true;cs.push(p)}
    const vs=cs.map(([i,j])=>g[i][j]);let op;
    if(cs.length===1)op='=';else if(cs.length===2){const opts=['+','×','−'];if(cageVal(vs,'÷')!=null)opts.push('÷','÷');op=opts[Math.floor(r()*opts.length)]}else op=r()<0.5?'+':'×';
    cages.push({cells:cs,op,v:cageVal(vs,op)})}
  return cages}
function makeKen(seed,N){N=N||5;for(let t=0;t<200;t++){const r=rng('ken:'+seed+':'+t),g=latin(N,r),cages=kenCages(g,r);
    if(cages.filter(c=>c.op==='=').length>3)continue;if(kenSolve(N,cages,2).n===1)return {kind:'ken',N,cages,sol:g}}
  return null}

/* ---------- день ----------
   Правила написаны так, чтобы их можно было прочитать один раз и начать: цель, правила по пунктам, пример, с чего начать */
const KINDS=[
  {kind:'bin',lvl:1,name:'Лёгкая',title:'Бинарио 6×6',reward:60,make:s=>makeBin(s,6,15),
    goal:'Заполните все пустые клетки нулями и единицами.',
    rules:['Три одинаковые цифры подряд ставить нельзя — ни в строке, ни в столбце. «0 0 1» можно, «0 0 0» нельзя.','В каждой строке и в каждом столбце нулей и единиц поровну: по три.','Две строки не могут быть одинаковыми. Два столбца — тоже.'],
    how:'Нажмите на клетку: появится 0, ещё раз — 1, ещё раз — клетка снова пустая. На компьютере можно нажать клетку и ввести 0 или 1.',
    tip:'Ищите пары: если рядом стоят «1 1», то с обеих сторон от них обязательно 0. И если между двумя одинаковыми пустая клетка («0 _ 0»), в ней другая цифра.'},
  {kind:'ken',lvl:2,name:'Средняя',title:'Кендоку 5×5',reward:100,make:s=>makeKen(s),
    goal:'Впишите в каждую клетку число от 1 до 5.',
    rules:['Как в судоку: в каждой строке и в каждом столбце все числа от 1 до 5, каждое по одному разу.','Сетка поделена жирными рамками. В углу рамки — число и знак. Числа внутри рамки должны дать это число: «+» — сложить, «×» — перемножить, «−» — из большего вычесть меньшее, «÷» — большее разделить на меньшее.','Если в рамке одна клетка и знака нет, просто впишите это число.'],
    how:'Нажмите на клетку, потом на число внизу (или наберите цифру на клавиатуре). «Заметки» — чтобы записать карандашом, какие числа ещё возможны.',
    tip:'Начните с рамок из одной клетки, потом с тех, где вариант один: «5+» из двух клеток — это 1 и 4 или 2 и 3, а «20×» — только 4 и 5.'},
  {kind:'sky',lvl:3,name:'Сложная',title:'Небоскрёбы 5×5',reward:140,make:s=>makeSky(s),
    goal:'Каждая клетка — дом высотой от 1 до 5 этажей. Расставьте дома.',
    rules:['В каждой строке и в каждом столбце все высоты от 1 до 5, каждая по одному разу.','Число снаружи сетки — сколько домов видно, если встать с этой стороны и смотреть вдоль ряда. Высокий дом закрывает все дома ниже себя, которые стоят за ним.','Пример: в ряду 2 4 1 5 3 слева видно 3 дома (2, 4 и 5), а справа — 2 дома (3 и 5).'],
    how:'Нажмите на клетку, потом на высоту внизу (или наберите цифру). «Заметки» помогают держать в голове варианты.',
    tip:'Подсказка «5» значит, что дома стоят по порядку 1, 2, 3, 4, 5 от этого края. Подсказка «1» значит, что первый дом с этой стороны — пятиэтажный.'}];
KINDS.forEach(k=>{k.rulesText=[k.goal].concat(k.rules).join(' ')});
const REWARD=100;
const rewardOf=kind=>{const k=KINDS.find(x=>x.kind===kind);return k?k.reward:REWARD};
const cache=new Map();
function make(kind,seed){const key=kind+'|'+seed;if(cache.has(key))return cache.get(key);const k=KINDS.find(x=>x.kind===kind);if(!k)return null;
  const p=k.make(seed);if(p){p.title=k.title;p.rules=k.rulesText;p.lvl=k.lvl}if(cache.size>30)cache.clear();cache.set(key,p);return p}
const seedOf=(uid,day)=>String(uid||'')+':'+String(day||'');
function daily(uid,day){return KINDS.map(k=>make(k.kind,seedOf(uid,day)))}
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((row,i)=>Array.isArray(row)&&Array.isArray(b[i])&&row.length===b[i].length&&row.every((x,j)=>Number(x)===Number(b[i][j])));
function check(kind,uid,day,ans){const p=make(kind,seedOf(uid,day));return !!p&&same(p.sol,ans)}

/* клетки, которые уже нарушают правила (для подсветки при вводе): повтор в строке или столбце, три одинаковые подряд,
   лишняя цифра в ряду Бинарио, заполненная рамка Кендоку с другим результатом, полный ряд Небоскрёбов, где видно не столько домов.
   С решением не сверяется, поэтому ответа не выдаёт */
function conflicts(p,a){const N=p.N,bad=new Set(),add=(i,j)=>bad.add(i*N+j),line=k=>[...Array(N).keys()].map(t=>k<N?[k,t]:[t,k-N]);
  const val=(i,j)=>a[i][j];
  for(let k=0;k<2*N;k++){const cs=line(k),vs=cs.map(([i,j])=>val(i,j));
    if(p.kind==='bin'){for(let t=2;t<N;t++)if(vs[t]!=null&&vs[t]===vs[t-1]&&vs[t]===vs[t-2]){add(...cs[t]);add(...cs[t-1]);add(...cs[t-2])}
      [0,1].forEach(d=>{if(vs.filter(x=>x===d).length>N/2)cs.forEach(([i,j],t)=>{if(vs[t]===d)add(i,j)})})}
    else{const seenAt={};vs.forEach((v,t)=>{if(!v)return;if(seenAt[v]!=null){add(...cs[t]);add(...cs[seenAt[v]])}else seenAt[v]=t})}}
  if(p.kind==='bin'){const full=k=>line(k).every(([i,j])=>val(i,j)!=null),key=k=>line(k).map(([i,j])=>val(i,j)).join();
    for(let x=0;x<2*N;x++)for(let y=x+1;y<2*N;y++)if((x<N)===(y<N)&&full(x)&&full(y)&&key(x)===key(y))line(x).concat(line(y)).forEach(c=>add(...c))}
  if(p.kind==='ken')p.cages.forEach(c=>{const vs=c.cells.map(([i,j])=>val(i,j));if(vs.every(Boolean)&&cageVal(vs,c.op)!==c.v)c.cells.forEach(cc=>add(...cc))});
  if(p.kind==='sky'){const C=p.clues;for(let i=0;i<N;i++){const row=a[i],col=a.map(r=>r[i]);
    if(row.every(Boolean)&&!skyOk(row,C.left[i],C.right[i]))row.forEach((_,j)=>add(i,j));
    if(col.every(Boolean)&&!skyOk(col,C.top[i],C.bottom[i]))col.forEach((_,t)=>add(t,i))}}
  return [...bad].map(x=>[Math.floor(x/N),x%N])}
const DRPZ={KINDS,REWARD,rewardOf,make,daily,check,seedOf,skySolve,skyClues,binSolve,kenSolve,cageVal,seen,rng,conflicts};
if(typeof module!=='undefined'&&module.exports)module.exports=DRPZ;else root.DRPZ=DRPZ;
})(typeof window!=='undefined'?window:globalThis);
