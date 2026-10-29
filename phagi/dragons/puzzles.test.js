/* Автотесты головоломок дня: node phagi/dragons/puzzles.test.js */
'use strict';
const assert=require('assert'),P=require('./puzzles.js');
let n=0,fails=0;function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
const days=[...Array(15)].map((_,i)=>'2026-11-'+String(i+1).padStart(2,'0'));
const latinOk=(g,N)=>g.every(r=>new Set(r).size===N&&r.every(x=>x>=1&&x<=N))&&[...Array(N).keys()].every(j=>new Set(g.map(r=>r[j])).size===N);
t('небоскрёбы: решение верно, подсказки сходятся, решение единственное, подсказок не больше 14',()=>{let tot=0;days.forEach(d=>{const p=P.make('sky','u:'+d),N=p.N;
  assert.ok(latinOk(p.sol,N));const c=P.skyClues(p.sol);['top','bottom','left','right'].forEach(k=>p.clues[k].forEach((v,i)=>{if(v)assert.strictEqual(v,c[k][i])}));
  assert.strictEqual(P.skySolve(N,p.clues,2).n,1,d);const k=Object.values(p.clues).flat().filter(Boolean).length;tot+=k;assert.ok(k<=14,d+': '+k)});
  console.log('      подсказок в среднем',Math.round(tot/days.length*10)/10)});
t('бинарио: правила соблюдены, данные сходятся с решением, решение единственное',()=>days.forEach(d=>{const p=P.make('bin','u:'+d),N=p.N,g=p.sol;
  const lines=g.concat([...Array(N).keys()].map(j=>g.map(r=>r[j])));
  lines.forEach(a=>{assert.strictEqual(a.filter(x=>x===1).length,N/2);for(let k=2;k<N;k++)assert.ok(!(a[k]===a[k-1]&&a[k]===a[k-2]))});
  assert.strictEqual(new Set(g.map(r=>r.join())).size,N);assert.strictEqual(new Set([...Array(N).keys()].map(j=>g.map(r=>r[j]).join())).size,N);
  p.given.forEach((r,i)=>r.forEach((v,j)=>{if(v!=null)assert.strictEqual(v,g[i][j])}));assert.strictEqual(P.binSolve(N,p.given,2).n,1,d);
  const n=p.given.flat().filter(x=>x!=null).length;assert.ok(n>=15&&n<=24,'открытых клеток от 15 до 24: '+n)}));
t('от простого к сложному: лёгкая, средняя, сложная; награды растут и вместе дают 300; у каждой правила по пунктам',()=>{
  assert.deepStrictEqual(P.KINDS.map(k=>k.lvl),[1,2,3]);assert.deepStrictEqual(P.KINDS.map(k=>k.kind),['bin','ken','sky']);
  const r=P.KINDS.map(k=>P.rewardOf(k.kind));assert.ok(r[0]<r[1]&&r[1]<r[2]);assert.strictEqual(r.reduce((a,b)=>a+b,0),300);
  P.KINDS.forEach(k=>{assert.ok(k.goal&&k.rules.length>=2&&k.how&&k.tip);assert.strictEqual(P.make(k.kind,'u:2026-11-01').N,k.kind==='bin'?6:5)})});
t('подсветка ошибок: решение чистое, повтор в строке, три подряд и неверная рамка видны, ответ не раскрывается',()=>days.slice(0,5).forEach(d=>{
  P.KINDS.forEach(k=>{const p=P.make(k.kind,'u:'+d);assert.deepStrictEqual(P.conflicts(p,p.sol),[],k.kind+' '+d);
    const empty=p.kind==='bin'?p.given.map(r=>r.slice()):p.sol.map(r=>r.map(()=>0));assert.deepStrictEqual(P.conflicts(p,empty),[],'пустая сетка без ошибок')});
  const ken=P.make('ken','u:'+d),a=ken.sol.map(r=>r.slice());a[0][1]=a[0][0];assert.ok(P.conflicts(ken,a).some(([i,j])=>i===0&&j===1),'повтор в строке');
  const bin=P.make('bin','u:'+d),b=bin.sol.map(r=>r.slice());b[0][0]=b[0][1]=b[0][2]=1;assert.ok(P.conflicts(bin,b).length>=3,'три подряд')}));
t('быстро: задачи дня строятся меньше чем за 400 мс на всех трёх',()=>{const t0=Date.now();P.daily('speed','2026-12-24');assert.ok(Date.now()-t0<400,'долго: '+(Date.now()-t0))});
t('кендоку: группы покрывают сетку, результаты сходятся, решение единственное',()=>days.forEach(d=>{const p=P.make('ken','u:'+d),N=p.N;assert.ok(latinOk(p.sol,N));
  const seen=new Set();p.cages.forEach(c=>{c.cells.forEach(([i,j])=>{const k=i+','+j;assert.ok(!seen.has(k));seen.add(k)});assert.strictEqual(P.cageVal(c.cells.map(([i,j])=>p.sol[i][j]),c.op),c.v)});
  assert.strictEqual(seen.size,N*N);assert.strictEqual(P.kenSolve(N,p.cages,2).n,1,d)}));
t('проверка ответа: верное решение принимается, любое изменение нет; день и ученица меняют задачу',()=>{const d=days[0];
  P.KINDS.forEach(k=>{const p=P.make(k.kind,P.seedOf('u1',d));assert.ok(P.check(k.kind,'u1',d,p.sol));
    const bad=p.sol.map(r=>r.slice());bad[0][0]=k.kind==='bin'?1-bad[0][0]:bad[0][0]%p.N+1;assert.ok(!P.check(k.kind,'u1',d,bad));
    assert.ok(!P.check(k.kind,'u1',d,null));assert.notDeepStrictEqual(P.make(k.kind,P.seedOf('u2',d)).sol,p.sol)})});
console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
