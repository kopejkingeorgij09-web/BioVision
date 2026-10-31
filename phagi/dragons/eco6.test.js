/* Автотесты ядра Драконов 6.0: node phagi/dragons/eco6.test.js */
'use strict';
const assert=require('assert');
const D=require('./eco6.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('  ✓',name)}catch(e){fails++;console.log('  ✗',name,'\n    ',e.message)}}
const H=D.HOUR,T0=Date.parse('2026-11-01T10:00:00Z');
const ctx=(o)=>Object.assign({now:T0,today:'2026-11-01',uid:'u1',days:{},hw:[]},o);
const fresh=(oldL)=>D.startState('u1','2026-11-01',T0,oldL||0);
const ok=r=>{assert.ok(!r.err,r.err);return r.s};

console.log('стихии');
t('круг: каждая сильна против двух и слаба против двух',()=>D.ELS.forEach(e=>{assert.strictEqual(D.strongVs(e).length,2,e);assert.strictEqual(D.weakVs(e).length,2,e);
  D.ELS.forEach(b=>{if(b!==e)assert.ok(!(D.beats(e,b)&&D.beats(b,e)))})}));
t('множители симметричны: сильный удар × слабый ответ = 1',()=>D.ELS.forEach(a=>D.ELS.forEach(b=>assert.ok(Math.abs(D.mult(a,b)*D.mult(b,a)-1)<1e-9))));
t('ни одна стихия не сильнее в целом: ценность (бой + доход) равна с точностью 2 %',()=>{const v=D.ELS.map(D.elValue),m=v.reduce((a,b)=>a+b)/v.length;
  v.forEach((x,i)=>assert.ok(Math.abs(x/m-1)<0.02,D.ELS[i]+' '+x.toFixed(3)))});
t('средний множитель против всех стихий одинаков у каждой',()=>{const avg=a=>D.ELS.reduce((x,b)=>x+D.mult(a,b),0);D.ELS.forEach(a=>assert.ok(Math.abs(avg(a)-avg('F'))<1e-9))});

console.log('генетика');
t('E кодоминантен, E2 добавляет стихии, порядок постоянный',()=>{
  assert.deepStrictEqual(D.elementsOf({E:['W','F'],E2:['0','0']}),['F','W']);
  assert.deepStrictEqual(D.elementsOf({E:['F','F'],E2:['T','0']}),['F','T']);
  assert.deepStrictEqual(D.elementsOf({E:['F','W'],E2:['F','P']}),['F','W','P'])});
t('редкость = число стихий − 1',()=>{assert.strictEqual(D.rarityOf(D.genomeOf(['F'],'F')),0);assert.strictEqual(D.rarityOf(D.genomeOf(['F','W','T','A'],'M')),3)});
t('в геноме нет S и лишних генов',()=>{const g=D.breed(D.genomeOf(['F','W'],'F'),D.genomeOf(['T'],'M'),'x');assert.deepStrictEqual(Object.keys(g).sort(),['E','E2','sex']);assert.ok(D.validGenome(g))});
t('распределение: F/W × T/T даёт по половине F+T и W+T',()=>{const d=D.dist(D.genomeOf(['F','W'],'F'),D.genomeOf(['T'],'M'));
  assert.ok(Math.abs(d['F+T']-0.5)<1e-9&&Math.abs(d['W+T']-0.5)<1e-9,JSON.stringify(d))});
t('второй закон: E2 0/F × 0/F даёт F в E2 у трёх четвертей',()=>{const m={sex:'F',E:['W','W'],E2:['0','F']},f={sex:'M',E:['W','W'],E2:['0','F']};
  assert.ok(Math.abs(D.share(m,f,{t:'has',el:'F'})-0.75)<1e-9)});
t('распределение сходится с настоящим скрещиванием',()=>{const m=D.genomeOf(['F','W','T'],'F'),f=D.genomeOf(['A','P'],'M'),d=D.dist(m,f),c={};const N=20000;
  for(let i=0;i<N;i++){const k=D.elementsOf(D.breed(m,f,'s'+i)).join('+');c[k]=(c[k]||0)+1}
  Object.entries(d).forEach(([k,p])=>assert.ok(Math.abs((c[k]||0)/N-p)<0.02,k))});
t('мутация редкая: у обычных родителей лишняя стихия около 2 %',()=>{const m=D.genomeOf(['F'],'F'),f=D.genomeOf(['F'],'M');let x=0;const N=20000;
  for(let i=0;i<N;i++)if(D.rarityOf(D.breed(m,f,'m'+i))>0)x++;assert.ok(x/N>0.01&&x/N<0.03,String(x/N))});

console.log('сила');
t('сила растёт с редкостью при том же уровне (в среднем по всем наборам)',()=>{const avgP=k=>{const sets=[];const go=(st,a)=>{if(a.length===k){sets.push(a);return}for(let i=st;i<7;i++)go(i+1,a.concat(D.ELS[i]))};go(0,[]);
    return sets.reduce((x,els)=>x+D.power({g:D.genomeOf(els,'F'),lvl:20,acad:{b:0,m:{}}}),0)/sets.length};
  const p=[1,2,3,4].map(avgP);for(let i=1;i<4;i++)assert.ok(p[i]>p[i-1]*1.2,p.join(' '))});
t('сила растёт с уровнем и с Академией',()=>{const d=l=>({g:D.genomeOf(['F'],'F'),lvl:l,acad:{b:0,m:{}}});assert.ok(D.power(d(30))>D.power(d(10)));
  const a=d(30),b=Object.assign(d(30),{acad:{b:4,m:{}}}),c=Object.assign(d(30),{acad:{b:4,m:{F:3}}});assert.ok(D.power(b)>D.power(a)&&D.power(c)>D.power(b))});
t('доход дракона зависит от стихии и уровня',()=>{const g=e=>D.gph({g:D.genomeOf([e],'F'),lvl:1});assert.ok(g('P')>g('D'));assert.ok(D.gph({g:D.genomeOf(['P'],'F'),lvl:10})>g('P'))});

console.log('новый старт');
t('старт: Казна и Амбар в центре, два жилища, пара основателей разных стихий',()=>{const s=fresh();
  assert.deepStrictEqual(s.bld.filter(b=>b.type==='treasury').map(b=>[b.x,b.y]),[[D.CENTER.treasury.x,D.CENTER.treasury.y]]);
  assert.strictEqual(s.bld.filter(b=>b.type==='granary').length,1);assert.strictEqual(s.dragons.length,2);
  const [a,b]=s.dragons;assert.strictEqual(a.g.sex,'F');assert.strictEqual(b.g.sex,'M');assert.notStrictEqual(D.elementsOf(a.g)[0],D.elementsOf(b.g)[0]);
  s.dragons.forEach(d=>assert.ok(d.home))});
t('подарок растёт со старым уровнем, яйца с 10, 25 и 50-го',()=>{const a=D.giftFor(1),b=D.giftFor(30),c=D.giftFor(60);
  assert.ok(b.gems>a.gems&&c.gems>b.gems);assert.deepStrictEqual(a.eggs,[]);assert.deepStrictEqual(b.eggs,[1,2]);assert.deepStrictEqual(c.eggs,[1,2,3]);
  const s=fresh(30);assert.strictEqual(s.eggs.length,2);assert.ok(s.welcome&&!s.welcome.seen)});
t('окно правил: правила есть и закрываются действием welcome',()=>{assert.ok(D.RULES.length>=6);const s=ok(D.apply(fresh(),ctx(),{t:'welcome'}));assert.ok(s.welcome.seen)});

console.log('карточки');
t('карточки дают золото, корм, минуты, заряды и опыт',()=>{const s=D.tick(fresh(),ctx({days:{'2026-11-01':20}})).s,s0=fresh();
  assert.ok(s.bal.gold>s0.bal.gold&&s.bal.food>s0.bal.food);assert.strictEqual(s.bal.spd,20*15);assert.strictEqual(s.bal.ch,2);assert.ok(s.bal.xp>0)});
t('повторный вызов не зачисляет второй раз',()=>{const c=ctx({days:{'2026-11-01':20}}),a=D.tick(fresh(),c).s,b=D.tick(a,c).s;assert.deepStrictEqual(a.bal,b.bal)});
t('дозачисление: 20 карточек, потом 35 за тот же день = 35 сразу',()=>{const one=D.tick(fresh(),ctx({days:{'2026-11-01':35}})).s;
  const two=D.tick(D.tick(fresh(),ctx({days:{'2026-11-01':20}})).s,ctx({days:{'2026-11-01':35}})).s;assert.ok(Math.abs(one.bal.gold-two.bal.gold)<1e-6)});
t('дни до нового старта не считаются',()=>{const s=D.tick(fresh(),ctx({days:{'2026-10-30':50}})).s;assert.strictEqual(s.cred.cards,0)});
t('объём ощутим: 60 карточек в день дают больше 4,5 раз золота, чем 15',()=>{const g=n=>{const s=fresh();s.bal.gold=0;return D.tick(s,ctx({days:{'2026-11-01':n}})).cards.gold};
  assert.ok(g(60)/g(15)>4.5,(g(60)/g(15)).toFixed(2))});
t('сверх вместимости Казны золото не помещается и учитывается как потерянное',()=>{const s=fresh();s.bal.gold=D.CAP_GOLD[0]-10;const r=D.tick(s,ctx({days:{'2026-11-01':100}}));
  assert.strictEqual(r.s.bal.gold,D.CAP_GOLD[0]);assert.ok(r.cards.lost>0)});
t('зарядов не больше пяти',()=>{const s=D.tick(fresh(),ctx({days:{'2026-11-01':200}})).s;assert.strictEqual(s.bal.ch,D.CHARGE_MAX)});
t('дракон, который учится, не приносит золото',()=>{const s=fresh();s.bal.gold=0;const all=D.goldPerCard(s);s.dragons[0].job={kind:'bach',at:T0,dur:H,cut:0,to:1};assert.ok(D.goldPerCard(s)<all)});

console.log('ДЗ');
t('ДЗ даёт самоцветы один раз',()=>{const c=ctx({hw:[{id:'h1',pc:92,d:'2026-11-01'}]}),a=D.tick(fresh(),c).s,b=D.tick(a,c).s;
  assert.strictEqual(a.bal.gems-fresh().bal.gems,4);assert.strictEqual(b.bal.gems,a.bal.gems)});
t('ниже 85 % яиц не бывает',()=>{for(let i=0;i<500;i++)assert.strictEqual(D.hwEgg(84,'x'+i),0)});
t('шансы при 100 %: мифическое ~20 %, эпическое ~20 %, редкое ~20 %, без яйца ~40 %',()=>{const c=[0,0,0,0],N=40000;for(let i=0;i<N;i++)c[D.hwEgg(100,'y'+i)]++;
  [0.4,0.2,0.2,0.2].forEach((p,i)=>assert.ok(Math.abs(c[i]/N-p)<0.015,i+': '+c[i]/N))});
t('шанс растёт с баллом и не выше потолков',()=>{const a=D.eggOdds(85),b=D.eggOdds(95),c=D.eggOdds(100);assert.ok(a[0]<b[0]&&b[0]<c[0]);
  assert.ok(c[0]<=0.6+1e-9&&c[1]<=0.4+1e-9&&c[2]<=0.2+1e-9);assert.deepStrictEqual(D.eggOdds(110),c)});
t('яйцо за ДЗ имеет нужную редкость',()=>{for(let r=1;r<=3;r++)for(let i=0;i<50;i++)assert.strictEqual(D.rarityOf(D.eggGenome(r,'z'+i)),r)});

console.log('время и ускорение');
t('стройка идёт по часам и заканчивается сама',()=>{let s=fresh();s.bal.gold=5000;for(let i=0;i<3;i++)s.bal.xp=D.xpFor(4);
  s=ok(D.apply(s,ctx(),{t:'build',type:'hatchery',x:1,y:1}));const b=s.bld.find(x=>x.type==='hatchery');assert.ok(b.job);
  const later=D.tick(s,ctx({now:T0+4*H+1})).s;assert.ok(!later.bld.find(x=>x.type==='hatchery').job)});
t('карточка срезает 15 минут, самоцвет 30',()=>{let s=fresh();s.bal.gold=5000;s.bal.xp=D.xpFor(4);s=ok(D.apply(s,ctx(),{t:'build',type:'hatchery',x:1,y:1}));
  const id=s.bld.find(x=>x.type==='hatchery').id;s=ok(D.apply(s,ctx({days:{'2026-11-01':4}}),{t:'speed',target:{b:id}}));
  assert.strictEqual(D.jobLeft(s.bld.find(x=>x.id===id).job,T0),4*H-60*D.MIN);
  s.bal.gems=10;s=ok(D.apply(s,ctx({days:{'2026-11-01':4}}),{t:'speed',target:{b:id},gems:2}));assert.strictEqual(D.jobLeft(s.bld.find(x=>x.id===id).job,T0),4*H-120*D.MIN)});
t('самоцветов на ускорение не берётся больше нужного',()=>{let s=fresh();s.bal.gold=5000;s.bal.gems=100;s.bal.xp=D.xpFor(4);s=ok(D.apply(s,ctx(),{t:'build',type:'hatchery',x:1,y:1}));
  const id=s.bld.find(x=>x.type==='hatchery').id,g0=s.bal.gems;s=ok(D.apply(s,ctx(),{t:'speed',target:{b:id},gems:50}));assert.strictEqual(g0-s.bal.gems,8)});

console.log('кормление и Академия');
t('кормление: 4 раза на уровень, потолок от уровня острова',()=>{let s=fresh();s.bal.food=1e5;s.bld.find(b=>b.type==='granary').lvl=8;const id=s.dragons[0].id;
  for(let i=0;i<4;i++)s=ok(D.apply(s,ctx(),{t:'feed',dragon:id}));assert.strictEqual(s.dragons[0].lvl,2);
  for(let i=0;i<40;i++){const r=D.apply(s,ctx(),{t:'feed',dragon:id});if(r.err)break;s=r.s}assert.strictEqual(s.dragons[0].lvl,D.dragonCap(1))});
const withAcad=()=>{const s=fresh();s.bal.gold=D.CAP_GOLD[0];s.bal.xp=D.xpFor(8);s.bld.push({id:'bA',type:'academy',x:1,y:1,lvl:1,job:null});return s};
t('бакалавриат по порядку, уровень дракона и золото проверяются',()=>{let s=withAcad();const d=s.dragons[0];
  assert.ok(D.apply(s,ctx(),{t:'study',dragon:d.id}).err);d.lvl=5;s=ok(D.apply(s,ctx(),{t:'study',dragon:d.id}));
  assert.strictEqual(s.dragons[0].job.kind,'bach');assert.ok(D.apply(s,ctx(),{t:'study',dragon:s.dragons[1].id}).err,'одно место в Академии 1-го уровня');
  s=D.tick(s,ctx({now:T0+2*H})).s;assert.strictEqual(s.dragons[0].acad.b,1)});
t('магистратура только после бакалавриата и по своей стихии',()=>{let s=withAcad();const d=s.dragons[0];d.lvl=30;s.bld.find(b=>b.type==='treasury').lvl=4;s.bal.gold=D.CAP_GOLD[3];
  const el=D.elementsOf(d.g)[0],other=D.ELS.find(e=>e!==el);assert.ok(D.apply(s,ctx(),{t:'study',dragon:d.id,el}).err);
  d.acad.b=4;assert.ok(D.apply(s,ctx(),{t:'study',dragon:d.id,el:other}).err);s=ok(D.apply(s,ctx(),{t:'study',dragon:d.id,el}));
  s=D.tick(s,ctx({now:T0+16*H})).s;assert.strictEqual(s.dragons[0].acad.m[el],1)});

console.log('скрещивание и яйца');
const withNest=()=>{const s=fresh();s.bal.gold=D.CAP_GOLD[0];s.bal.xp=D.xpFor(9);s.bld.push({id:'bN',type:'nest',x:1,y:1,lvl:1,job:null},{id:'bH',type:'hatchery',x:4,y:1,lvl:1,job:null});s.dragons.forEach(d=>d.lvl=5);return s};
t('пара → яйцо через 2 часа → Инкубатор → дракон',()=>{let s=withNest();s=ok(D.apply(s,ctx(),{t:'breed',m:s.dragons[0].id,f:s.dragons[1].id}));
  s=D.tick(s,ctx({now:T0+2*H})).s;assert.strictEqual(s.eggs.length,1);const e=s.eggs[0];
  s=ok(D.apply(s,ctx({now:T0+2*H}),{t:'incubate',egg:e.id}));s=D.tick(s,ctx({now:T0+2*H+D.HATCH_H[e.rar]*H})).s;assert.strictEqual(s.dragons.length,3)});
t('точный прогноз приносит самоцветы, неточный нет',()=>{const run=p=>{let s=withNest();const g0=s.bal.gems,m=s.dragons[0],f=s.dragons[1],el=D.elementsOf(m.g)[0];
    s=ok(D.apply(s,ctx(),{t:'breed',m:m.id,f:f.id,pred:{q:{t:'has',el},p}}));return D.tick(s,ctx({now:T0+2*H})).s.bal.gems-g0};
  assert.strictEqual(run(1),D.PRED_GEMS);assert.strictEqual(run(0.3),0)});

console.log('налёты');
t('добыча не больше 10 %, щит на сутки',()=>{const s=fresh();const r=D.raided(s,T0,100);assert.strictEqual(r.loot.gold,Math.floor(s.bal.gold*0.1));
  assert.ok(D.shielded(r.s,T0+23*H)&&!D.shielded(r.s,T0+25*H));assert.strictEqual(D.lootOf(s,50).gold,Math.floor(s.bal.gold*0.05))});

console.log(`\n${n-fails} из ${n} прошли`);process.exitCode=fails?1:0;
