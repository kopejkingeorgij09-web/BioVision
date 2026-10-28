/* Головоломки дня (Драконы 4.4): три задачи на логику, каждый день новые, у каждой ровно одно решение.
   Небоскрёбы 5×5, Бинарио 8×8, Кендоку 5×5. Задача строится из зерна (ученица + дата), поэтому её можно построить заново
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
function skySolve(N,cl,limit){const g=[...Array(N)].map(()=>Array(N).fill(0));let n=0,sol=null;
  const rec=k=>{if(n>=limit)return;if(k===N*N){n++;if(!sol)sol=g.map(r=>r.slice());return}const i=Math.floor(k/N),j=k%N;
    for(let v=1;v<=N;v++){if(g[i].includes(v))continue;let bad=false;for(let t=0;t<i;t++)if(g[t][j]===v){bad=true;break}if(bad)continue;
      g[i][j]=v;
      /* подсказка слева: видно уже больше, чем сказано — дальше не идём */
      if(cl.left[i]&&seen(g[i].slice(0,j+1))>cl.left[i]){g[i][j]=0;continue}
      if(j===N-1&&!skyOk(g[i],cl.left[i],cl.right[i])){g[i][j]=0;continue}
      if(i===N-1&&!skyOk(g.map(r=>r[j]),cl.top[j],cl.bottom[j])){g[i][j]=0;continue}
      if(cl.top[j]&&seen(g.slice(0,i+1).map(r=>r[j]))>cl.top[j]){g[i][j]=0;continue}
      rec(k+1);g[i][j]=0}};
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
function makeBin(seed,N){N=N||8;const r=rng('bin:'+seed);
  const full=binSolve(N,[...Array(N)].map(()=>Array(N).fill(null)),1,r).sol;
  const given=full.map(x=>x.slice()),cells=shuffle([].concat(...full.map((row,i)=>row.map((_,j)=>[i,j]))),r);
  for(const [i,j] of cells){const v=given[i][j];given[i][j]=null;if(binSolve(N,given,2).n!==1)given[i][j]=v}
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

/* ---------- день ---------- */
const KINDS=[
  {kind:'sky',title:'Небоскрёбы 5×5',make:makeSky,rules:'В каждой строке и в каждом столбце дома высотой от 1 до 5, каждая высота по одному разу. Число у края — сколько домов видно, если смотреть с этой стороны: высокий дом закрывает все низкие за ним.'},
  {kind:'bin',title:'Бинарио 8×8',make:makeBin,rules:'Заполните сетку нулями и единицами. Больше двух одинаковых цифр подряд нельзя ни по строке, ни по столбцу. В каждой строке и в каждом столбце нулей и единиц поровну. Все строки разные, все столбцы тоже.'},
  {kind:'ken',title:'Кендоку 5×5',make:makeKen,rules:'В каждой строке и в каждом столбце числа от 1 до 5 по одному разу. Числа в выделенной группе дают указанный результат действия: сумму (+), произведение (×), разность (−) или частное (÷). Группа из одной клетки показывает своё число.'}];
const REWARD=100;
const cache=new Map();
function make(kind,seed){const key=kind+'|'+seed;if(cache.has(key))return cache.get(key);const k=KINDS.find(x=>x.kind===kind);if(!k)return null;
  const p=k.make(seed);if(p){p.title=k.title;p.rules=k.rules}if(cache.size>30)cache.clear();cache.set(key,p);return p}
const seedOf=(uid,day)=>String(uid||'')+':'+String(day||'');
function daily(uid,day){return KINDS.map(k=>make(k.kind,seedOf(uid,day)))}
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((row,i)=>Array.isArray(row)&&Array.isArray(b[i])&&row.length===b[i].length&&row.every((x,j)=>Number(x)===Number(b[i][j])));
function check(kind,uid,day,ans){const p=make(kind,seedOf(uid,day));return !!p&&same(p.sol,ans)}

const DRPZ={KINDS,REWARD,make,daily,check,seedOf,skySolve,skyClues,binSolve,kenSolve,cageVal,seen,rng};
if(typeof module!=='undefined'&&module.exports)module.exports=DRPZ;else root.DRPZ=DRPZ;
})(typeof window!=='undefined'?window:globalThis);
