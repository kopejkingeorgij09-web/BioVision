/* Автотесты похода: node phagi/dragons/campaign.test.js
   32 узла в четырёх регионах, прежние e1…e6, открытие по пути без циклов, запись звёзд без потерь и без накрутки,
   старые сохранения, разные составы, карта и проходимость командами без Света и Тьмы (баланс-прогон dev/balance.js). */
'use strict';
const assert=require('assert');
const C=require('./campaign.js'),D=require('./genetics.js'),B=require('./battle.js');
global.MORPH=require('./morph.js');const SH=require('./shape.js'),AN=require('./anim.js'),ST=require('./stats.js');
const Bal=require('./dev/balance.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}

t('четыре региона по восемь узлов, всего 32, id не повторяются, у каждого узла все поля данных',()=>{
  assert.strictEqual(C.REGIONS.length,4);assert.strictEqual(C.NODES.length,32);
  assert.strictEqual(new Set(C.NODES.map(x=>x.id)).size,32);
  C.REGIONS.forEach(r=>{const ns=C.nodesOf(r.id);assert.strictEqual(ns.length,8,r.id);assert.ok(ns[7].boss,'последний узел региона — босс: '+r.id);
    assert.strictEqual(ns.filter(x=>x.boss).length,1,r.id);assert.ok(r.pal&&r.intro&&r.land)});
  C.NODES.forEach(x=>{assert.ok(x.name&&x.story&&x.idea,x.id);assert.ok(['easy','normal','hard'].includes(x.ai),x.id);
    assert.ok(x.team.max>=1&&x.team.max<=3,x.id);assert.ok(x.stars&&x.stars.text,x.id);assert.strictEqual(x.reward.type,'stars');
    assert.ok(x.x>=8&&x.x<=92&&x.y>=8&&x.y<=142,'на карте: '+x.id);if(x.boss)assert.ok(x.bossNote,'босс объясняет механику: '+x.id)});
  assert.strictEqual(new Set(C.REGIONS.map(r=>r.pal.land)).size,4,'палитры регионов разные')});

t('прежние бои e1…e6: те же id, названия и противники, e7 и e8 добавлены в первый регион перед боссом',()=>{
  const old={e1:['Луговая опушка',['Побег','Росток']],e2:['Дымная лощина',['Пепел','Сажа','Уголь']],e3:['Каменный брод',['Гранит','Вихрь','Кремень']],
    e4:['Горячие ключи',['Зной','Омут','Пар']],e5:['Перевал гибридов',['Буря','Корень','Лава']],e6:['Вершина: Хранитель гряды',['Хранитель','Страж Огня','Страж Воды']]};
  Object.entries(old).forEach(([id,[nm,foes]])=>{const b=C.byId(id);assert.strictEqual(b.region,'ember');assert.strictEqual(b.name,nm);assert.deepStrictEqual(b.foes().map(f=>f.name),foes)});
  assert.deepStrictEqual(C.nodesOf('ember').map(x=>x.id),['e1','e2','e3','e4','e5','e7','e8','e6']);
  assert.ok(C.byId('e6').boss);assert.strictEqual(C.byId('e6').foes()[0].lvl,13)});

t('открытие по пути: каждый узел ссылается только на существующие предыдущие, циклов нет, все 32 достижимы',()=>{
  const ids=C.NODES.map(x=>x.id);
  C.NODES.forEach((x,i)=>x.after.forEach(a=>{assert.ok(ids.includes(a),x.id+' → '+a);assert.ok(ids.indexOf(a)<i,'только назад по пути: '+x.id)}));
  let p=C.progress(null);const seen=[];
  for(let k=0;k<40;k++){const g=C.goal(p);if(!g)break;seen.push(g.id);p=C.record(p,g.id,1,'2026-10-28')}
  assert.deepStrictEqual(seen,ids,'проход по целям открывает все узлы по порядку');assert.ok(C.done(p));assert.strictEqual(C.goal(p),null)});

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
  assert.ok(!C.record(p,'s8',3).best.s8);assert.ok(!C.record(p,'zz',3).best.zz)});

t('битые сохранения: мусор отбрасывается, неизвестные id не попадают в прогресс, исходный документ не меняется',()=>{
  assert.deepStrictEqual(C.progress({v:2}),{v:1,best:{},wins:{},at:{}});assert.deepStrictEqual(C.progress({pve:'x'}).best,{});
  const doc={pve:{best:{e1:3,e2:'x',e9:3,e3:5,t1:2,__proto__x:1},wins:{e1:-1,e2:2.5},at:{e1:20261027}}},snap=JSON.stringify(doc);
  const p=C.progress(doc);assert.deepStrictEqual(p.best,{e1:3,t1:2});assert.deepStrictEqual(p.wins,{});assert.deepStrictEqual(p.at,{});
  C.record(p,'e2',3);assert.strictEqual(JSON.stringify(doc),snap)});

t('противники: настоящие генотипы модели, уровни до 20, рекомендуемый уровень не падает, у всех разные id',()=>{
  const ids=new Set();let rec=0;
  C.NODES.forEach(b=>{const f=b.foes();assert.ok(f.length>=1&&f.length<=3,b.id);assert.ok(b.rec>=rec,'рост уровня: '+b.id);rec=b.rec;assert.ok(b.rec<=20);
    f.forEach(x=>{assert.deepStrictEqual(D.validate(x.genome),[]);assert.ok(D.viable(x.genome));assert.ok(x.lvl>=1&&x.lvl<=20,x.id);
      assert.ok(!ids.has(x.id),x.id);ids.add(x.id);x.traits.forEach(k=>assert.ok(B.TRAITS[k],k))})});
  assert.strictEqual(Math.max(...C.NODES.map(x=>x.rec)),20,'последние узлы на потолке драконов')});

t('составы не повторяются: у каждого узла свой набор стихий, особенностей и уровней',()=>{
  const key=b=>b.foes().map(f=>{const ph=D.phenotype(f.genome);return ph.elements.join('')+':'+f.traits.join('+')}).sort().join('|');
  const keys=C.NODES.map(key);assert.strictEqual(new Set(keys).size,32,'повтор состава');
  /* особенности боссов разные в каждом регионе */
  const bt=C.REGIONS.map(r=>C.nodesOf(r.id)[7].foes().map(f=>f.traits.join('+')).join('|'));assert.strictEqual(new Set(bt).size,4)});

t('карта: узлы региона не налезают друг на друга (на телефоне 390 px это не меньше 44 px между центрами)',()=>{
  C.REGIONS.forEach(r=>{const ns=C.nodesOf(r.id);ns.forEach((a,i)=>ns.slice(i+1).forEach(b=>{const d=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(d>=14,`${a.id}–${b.id}: ${d.toFixed(1)}`)}))})});

t('бои с ограничением состава и правила звёзд узла есть и работают в расчёте',()=>{
  assert.ok(C.NODES.some(x=>x.team.max===1)&&C.NODES.some(x=>x.team.max===2));
  const b=new B.Battle({A:[{id:'a',hp:50,atk:10,def:10,spd:10}],B:[{id:'x',hp:50,atk:10,def:10,spd:9}],star3:5});b.winner='A';b.round=5;assert.strictEqual(b.stars(),3);b.round=6;assert.strictEqual(b.stars(),2)});

/* баланс: короткий прогон, полный в dev/balance.js (таблица CAMPAIGN-RU.md) */
const rows=Bal.balance(24);
t('проходимость без Света и Тьмы: лучший состав из обычных драконов выигрывает каждый узел на уровне выше рекомендуемого',()=>{
  rows.forEach(r=>assert.ok(r.at.mix.up.win>=0.75,`${r.id}: ${Math.round(r.at.mix.up.win*100)} % на ${r.L2}-м уровне`))});
t('несколько стратегий: каждый обычный узел проходят хотя бы две из трёх постоянных команд, босса хотя бы одна',()=>{
  rows.forEach(r=>{const ok=['fwt','apf','hyb'].filter(k=>r.at[k].up.win>=0.4).length;assert.ok(ok>=(r.node.boss?1:2),`${r.id}: ${ok}`)})});
t('первые бои лёгкие: в первых пяти узлах любая постоянная команда на два уровня выше выигрывает чаще 80 %',()=>{
  rows.slice(0,5).forEach(r=>['fwt','apf','hyb'].forEach(k=>assert.ok(r.at[k].up.win>=0.8,`${r.id} ${k}`)))});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
