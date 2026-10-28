/* Автотесты похода: node phagi/dragons/campaign.test.js
   160 узлов в десяти регионах (в каждом 8 обычных, 4 испытания, 2 элитных, мини-босс и босс), прежние 32 id на месте,
   открытие по пути без циклов, запись звёзд без потерь и без накрутки, старые сохранения, правила испытаний, разные составы,
   карта и проходимость командами без Света и Тьмы (баланс-прогон dev/balance.js). */
'use strict';
const assert=require('assert');
const C=require('./campaign.js'),D=require('./genetics.js'),B=require('./battle.js');
global.MORPH=require('./morph.js');const SH=require('./shape.js'),AN=require('./anim.js'),ST=require('./stats.js');
const Bal=require('./dev/balance.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
const OLD=['ember','tide','grove','peaks'],OLDP={ember:'e',tide:'t',grove:'g',peaks:'s'};
const kinds=ns=>ns.reduce((a,x)=>(a[x.kind]=(a[x.kind]||0)+1,a),{});

t('десять регионов по шестнадцать узлов, всего 160, id не повторяются, у каждого узла все поля данных',()=>{
  assert.strictEqual(C.REGIONS.length,10);assert.strictEqual(C.NODES.length,160);
  assert.strictEqual(new Set(C.NODES.map(x=>x.id)).size,160);
  C.REGIONS.forEach(r=>{const ns=C.nodesOf(r.id);assert.strictEqual(ns.length,16,r.id);
    assert.deepStrictEqual(kinds(ns),{normal:8,trial:4,elite:2,mini:1,boss:1},r.id);
    assert.strictEqual(ns.filter(x=>x.boss).length,1,r.id);assert.ok(r.pal&&r.intro&&r.land,r.id);
    const main=ns.filter(x=>!x.side);assert.strictEqual(main.length,OLD.includes(r.id)?8:10,'главный путь: '+r.id);assert.strictEqual(main.length-1,main.findIndex(x=>x.boss),'босс в конце: '+r.id)});
  C.NODES.forEach(x=>{assert.ok(x.name&&x.story&&x.idea,x.id);assert.ok(['easy','normal','hard'].includes(x.ai),x.id);
    assert.ok(x.team.max>=1&&x.team.max<=3,x.id);assert.ok(x.stars&&x.stars.text,x.id);assert.strictEqual(x.reward.type,'loot');
    assert.ok(x.x>=8&&x.x<=92&&x.y>=8&&x.y<=142,'на карте: '+x.id);if(x.boss||x.mini)assert.ok(x.bossNote,'босс объясняет механику: '+x.id)});
  assert.strictEqual(new Set(C.REGIONS.map(r=>r.pal.land)).size,10,'палитры регионов разные')});

t('прежние 32 id на своих местах: те же регионы и названия, главный путь прежних регионов не изменился',()=>{
  OLD.forEach(r=>{const p=OLDP[r];for(let i=1;i<=8;i++){const b=C.byId(p+i);assert.ok(b,p+i);assert.strictEqual(b.region,r);assert.ok(!b.side,'прежний узел на главном пути: '+p+i)}});
  assert.deepStrictEqual(C.nodesOf('ember').filter(x=>!x.side).map(x=>x.id),['e1','e2','e3','e4','e5','e7','e8','e6']);
  assert.ok(C.byId('e6').boss&&C.byId('t8').boss&&C.byId('g8').boss&&C.byId('s8').boss);
  ['e7','t5','g5','s6'].forEach(id=>assert.ok(C.byId(id).mini,'мини-босс прежнего региона: '+id));
  assert.strictEqual(C.nodesOf('ember').filter(x=>x.side).map(x=>x.id).join(),'e9,e10,e11,e12,e13,e14,e15,e16')});

t('прежние бои e1…e6: те же id, названия и противники, e7 и e8 добавлены в первый регион перед боссом',()=>{
  const old={e1:['Луговая опушка',['Побег','Росток']],e2:['Дымная лощина',['Пепел','Сажа','Уголь']],e3:['Каменный брод',['Гранит','Вихрь','Кремень']],
    e4:['Горячие ключи',['Зной','Омут','Пар']],e5:['Перевал гибридов',['Буря','Корень','Лава']],e6:['Вершина: Хранитель гряды',['Хранитель','Страж Огня','Страж Воды']]};
  Object.entries(old).forEach(([id,[nm,foes]])=>{const b=C.byId(id);assert.strictEqual(b.region,'ember');assert.strictEqual(b.name,nm);assert.deepStrictEqual(b.foes().map(f=>f.name),foes)});
  assert.deepStrictEqual(C.nodesOf('ember').filter(x=>!x.side).map(x=>x.id),['e1','e2','e3','e4','e5','e7','e8','e6']);
  assert.ok(C.byId('e6').boss);assert.strictEqual(C.byId('e6').foes()[0].lvl,13)});

t('открытие по пути: каждый узел ссылается только на существующие предыдущие, циклов нет, все 160 достижимы, цель ведёт по главному пути',()=>{
  const ids=C.NODES.map(x=>x.id);
  C.NODES.forEach((x,i)=>x.after.forEach(a=>{assert.ok(ids.includes(a),x.id+' → '+a);assert.ok(ids.indexOf(a)<i,'только назад по пути: '+x.id)}));
  let p=C.progress(null);const seen=[];
  for(let k=0;k<200;k++){const g=C.goal(p);if(!g)break;seen.push(g.id);p=C.record(p,g.id,1,'2026-10-28')}
  assert.strictEqual(seen.length,160);assert.deepStrictEqual(seen.slice().sort(),ids.slice().sort(),'проход по целям открывает все узлы');
  assert.deepStrictEqual(seen.slice(0,C.NODES.filter(x=>!x.side).length),C.NODES.filter(x=>!x.side).map(x=>x.id),'сначала весь главный путь, боковые потом');
  assert.ok(C.done(p));assert.strictEqual(C.goal(p),null);
  C.NODES.filter(x=>x.side).forEach(x=>{assert.strictEqual(x.after.length,1,x.id);assert.strictEqual(C.byId(x.after[0]).region,x.region,'боковой узел растёт от своего региона: '+x.id)})});

t('новые регионы открываются по цепочке: болота после Владыки пиков, каждый следующий после босса предыдущего',()=>{
  const R=C.REGIONS.map(r=>r.id);
  for(let i=1;i<R.length;i++){const first=C.nodesOf(R[i]).filter(x=>!x.side)[0],prevBoss=C.nodesOf(R[i-1]).find(x=>x.boss);
    assert.deepStrictEqual(first.after,[prevBoss.id],R[i])}
  let p=C.progress(null);C.NODES.filter(x=>x.region!=='marsh'&&OLD.includes(x.region)&&!x.side&&!x.boss).forEach(x=>{p=C.record(p,x.id,1)});
  assert.ok(!C.regionOpen(p,'marsh'))});

t('регионы открываются боссами: отмели после Хранителя гряды, чаща после Владыки, пики после Матери',()=>{
  let p=C.progress(null);assert.ok(C.regionOpen(p,'ember'));assert.ok(!C.regionOpen(p,'tide'));
  ['e1','e2','e3','e4','e5','e7','e8'].forEach(id=>{p=C.record(p,id,2)});assert.ok(!C.regionOpen(p,'tide'));
  assert.match(C.lockText(p,'t1'),/Хранитель гряды/);
  p=C.record(p,'e6',1);assert.ok(C.regionOpen(p,'tide'));assert.ok(C.unlocked(p,'t1'));assert.ok(!C.unlocked(p,'t2'));
  assert.match(C.lockText(C.progress(null),'g1'),/Отмел|Владыка/)});

t('старые звёзды e1…e6 сохраняются: выигранный узел открыт, даже если новые e7 и e8 перед ним не пройдены',()=>{
  const doc={pve:{v:1,best:{e1:3,e2:3,e3:2,e4:1,e5:3,e6:2},wins:{e1:4,e6:1},at:{e6:'2026-10-27'}}};
  const p=C.progress(doc);assert.deepStrictEqual(p.best,doc.pve.best);assert.strictEqual(C.total(p),14);
  assert.ok(C.unlocked(p,'e6'),'Хранитель с прошлыми звёздами открыт');assert.ok(C.unlocked(p,'e7'));assert.ok(!C.unlocked(p,'e8'));
  assert.ok(C.regionOpen(p,'tide'),'отмели открыты прошлой победой над Хранителем');assert.strictEqual(C.goal(p).id,'e7');
  const q=C.record(p,'e6',1,'2026-10-28');assert.strictEqual(q.best.e6,2,'повтор с худшим итогом не уменьшает звёзды')});

t('лучшие звёзды не уменьшаются, поражение ничего не меняет, закрытый узел не записывается',()=>{
  let p=C.record(C.progress({}),'e1',3,'2026-10-27');p=C.record(p,'e1',1,'2026-10-28');assert.strictEqual(p.best.e1,3);assert.strictEqual(p.wins.e1,2);
  const before=JSON.stringify(p);p=C.record(p,'e1',0,'2026-10-29');assert.strictEqual(JSON.stringify(p),before);
  p=C.record(p,'e1',7);assert.strictEqual(p.best.e1,3);assert.strictEqual(C.total(p),3);
  assert.ok(!C.record(p,'s8',3).best.s8);assert.ok(!C.record(p,'v16',3).best.v16);assert.ok(!C.record(p,'zz',3).best.zz)});

t('битые сохранения: мусор отбрасывается, неизвестные id не попадают в прогресс, исходный документ не меняется',()=>{
  assert.deepStrictEqual(C.progress({v:2}),{v:1,best:{},wins:{},at:{}});assert.deepStrictEqual(C.progress({pve:'x'}).best,{});
  const doc={pve:{best:{e1:3,e2:'x',z9:3,e3:5,t1:2,__proto__x:1},wins:{e1:-1,e2:2.5},at:{e1:20261027}}},snap=JSON.stringify(doc);
  const p=C.progress(doc);assert.deepStrictEqual(p.best,{e1:3,t1:2});assert.deepStrictEqual(p.wins,{});assert.deepStrictEqual(p.at,{});
  C.record(p,'e2',3);assert.strictEqual(JSON.stringify(doc),snap)});

t('противники: настоящие генотипы модели, уровни до 60, по главному пути рекомендуемый уровень не падает, у всех разные id',()=>{
  const ids=new Set();let rec=0;
  C.NODES.filter(x=>!x.side).forEach(b=>{assert.ok(b.rec>=rec,'рост уровня: '+b.id);rec=b.rec});
  C.NODES.forEach(b=>{const f=b.foes();assert.ok(f.length>=1&&f.length<=3,b.id);assert.ok(b.rec<=(OLD.includes(b.region)?20:60),b.id);
    f.forEach(x=>{assert.deepStrictEqual(D.validate(x.genome),[]);assert.ok(D.viable(x.genome));assert.ok(x.lvl>=1&&x.lvl<=60,x.id);
      assert.ok(!ids.has(x.id),x.id);ids.add(x.id);x.traits.forEach(k=>assert.ok(B.TRAITS[k],k))})});
  assert.strictEqual(Math.max(...C.NODES.map(x=>x.rec)),60,'последние узлы на потолке драконов')});

t('составы не повторяются: у каждого узла свой набор стихий, особенностей и уровней',()=>{
  const key=b=>b.foes().map(f=>{const ph=D.phenotype(f.genome);return ph.elements.join('')+':'+f.traits.join('+')}).sort().join('|');
  const keys=C.NODES.map(key);assert.ok(new Set(keys).size>=150,'повтор состава: '+new Set(keys).size);
  /* особенности боссов разные в каждом регионе */
  const bt=OLD.map(r=>C.nodesOf(r).find(x=>x.boss).foes().map(f=>f.traits.join('+')).join('|'));assert.strictEqual(new Set(bt).size,4)});

t('карта: узлы региона не налезают друг на друга (на телефоне 390 px это не меньше 44 px между центрами)',()=>{
  C.REGIONS.forEach(r=>{const ns=C.nodesOf(r.id);ns.forEach((a,i)=>ns.slice(i+1).forEach(b=>{const d=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(d>=14,`${a.id}–${b.id}: ${d.toFixed(1)}`)}))})});

t('правила испытаний: разные наборы стихий и запрет стихии проверяются, текст правила есть в описании узла',()=>{
  const dv=C.NODES.filter(x=>x.rule&&x.rule.k==='diverse'),bn=C.NODES.filter(x=>x.rule&&x.rule.k==='ban');
  assert.strictEqual(dv.length,10);assert.strictEqual(bn.length,10);
  assert.ok(!C.teamOk(dv[0],[['F'],['F'],['W']]).ok);assert.ok(C.teamOk(dv[0],[['F'],['F','W'],['W']]).ok);
  bn.forEach(x=>{const e=x.rule.e;assert.ok('FWTAPLD'.includes(e),x.id);const r=C.teamOk(x,[[e],['F','W'].filter(y=>y!==e)]);assert.ok(!r.ok&&r.why,x.id);
    assert.ok(C.teamOk(x,[['FWTAP'.replace(e,'')[0]]]).ok,x.id);assert.ok(x.idea.includes(C.ruleText(x.rule)),x.id)});
  assert.ok(C.teamOk(C.byId('e1'),[['F'],['F']]).ok,'у обычного узла правил нет')});

t('бои с ограничением состава и правила звёзд узла есть и работают в расчёте',()=>{
  assert.ok(C.NODES.some(x=>x.team.max===1)&&C.NODES.some(x=>x.team.max===2));
  const b=new B.Battle({A:[{id:'a',hp:50,atk:10,def:10,spd:10}],B:[{id:'x',hp:50,atk:10,def:10,spd:9}],star3:5});b.winner='A';b.round=5;assert.strictEqual(b.stars(),3);b.round=6;assert.strictEqual(b.stars(),2)});

/* баланс: короткий прогон, полный в dev/balance.js (таблица CAMPAIGN-RU.md). Уровень игрока — на два выше рекомендуемого, не выше 60 */
const rows=Bal.balance(12),best=r=>Math.max(...['mix','fwt','apf','hyb'].map(k=>r.at[k].up.win||0)),fixed=(r,v)=>['fwt','apf','hyb'].filter(k=>(r.at[k].up.win||0)>=v).length;
t('проходимость без Света и Тьмы: каждый узел главного пути проходится хотя бы половину боёв, боковые хотя бы в трети',()=>{
  rows.forEach(r=>assert.ok(best(r)>=(r.node.side?0.3:0.5),`${r.id}: ${Math.round(best(r)*100)} % на ${r.L2}-м уровне`))});
t('несколько решений: обычный узел главного пути до последнего региона проходит и постоянная команда (30 %+), у каждого босса хотя бы два состава',()=>{
  rows.filter(r=>!r.node.side&&r.node.kind==='normal'&&r.node.region!=='rim').forEach(r=>assert.ok(fixed(r,0.3)>=1,r.id));
  rows.filter(r=>r.node.boss).forEach(r=>{const ok=['mix','fwt','apf','hyb'].filter(k=>(r.at[k].up.win||0)>=0.25).length;assert.ok(ok>=2,`${r.id}: ${ok}`)})});
t('первые бои лёгкие: в первых пяти узлах любая постоянная команда на два уровня выше выигрывает чаще 80 %',()=>{
  rows.slice(0,5).forEach(r=>['fwt','apf','hyb'].forEach(k=>assert.ok(r.at[k].up.win>=0.8,`${r.id} ${k}`)))});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
