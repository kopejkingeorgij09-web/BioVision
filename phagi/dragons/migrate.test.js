/* Автотесты совместимости сохранений: node phagi/dragons/migrate.test.js
   Старые документы (до острова, без v), нынешние (все сценарии из dev/), неполные и испорченные.
   Главное правило: ничего не обнуляется молча. Неполное дополняется без бесплатного дохода, испорченное не открывается и не пишется. */
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
global.DRG=require('./genetics.js');const G=global.DRG,E=require('./economy.js'),C=require('./campaign.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
const clone=x=>JSON.parse(JSON.stringify(x));
const inc={K:400,food:300,gems:12,best:5};
const fixtures=fs.readdirSync(path.join(__dirname,'dev')).filter(f=>/^isle-.*\.json$/.test(f)).map(f=>[f,require('./dev/'+f)]);
const fresh=()=>E.normalize(E.startState([{id:'d1',name:'Ж',born:'2026-10-01',genome:G.make({sex:'F',E:'F/e'})},{id:'d2',name:'П',born:'2026-10-01',genome:G.make({sex:'M',E:'W/e'})}]),0,null);

t('сохранения из всех сценариев dev/ (геном версии 1): единственная правка — ген E2 = 0/0, остальное как было',()=>{
  assert.ok(fixtures.length>=5,'сценариев '+fixtures.length);
  fixtures.forEach(([f,d])=>{const r=E.repair(d,inc);assert.deepStrictEqual(r.bad,[],f);
    assert.ok(r.fix.every(x=>/^геномы: добавлен ген E2/.test(x)),f+': '+r.fix.join('; '));
    const keep=k=>JSON.stringify(d[k]);['bal','land','credited'].forEach(k=>assert.strictEqual(JSON.stringify(r.s[k]),keep(k),f+': '+k));
    const strip=g=>{const x=JSON.parse(JSON.stringify(g));if(x.A1[0].length===3)x.A1=x.A1.map(h=>h.slice(0,2));delete x.gv;return x};
    r.s.dragons.forEach((x,i)=>{assert.deepStrictEqual(strip(x.genome),strip(d.dragons[i].genome),f+': '+x.id);
      assert.deepStrictEqual(G.phenotype(x.genome),G.phenotype(G.upgrade(d.dragons[i].genome)));assert.deepStrictEqual(G.validate(x.genome),[])});
    const again=E.repair(r.s,inc);assert.deepStrictEqual(again.fix,[],f+': повторный проход ничего не правит')})});

t('свежий остров: repair ничего не меняет, normalize после него даёт то же, что без него',()=>{
  const s=fresh(),r=E.repair(s,inc);assert.deepStrictEqual(r.fix,[]);assert.deepStrictEqual(r.bad,[]);
  assert.deepStrictEqual(E.normalize(r.s,40,inc),E.normalize(s,40,inc))});

t('старый документ без v (Чашка Петри и драконы этапа 1): драконы с теми же id и генотипами переходят на остров',()=>{
  const old={mode:'dragons',dragons:[{id:'d1',name:'Искра',born:'2026-09-30',genome:G.make({sex:'F',E:'F/W',C:'Cb/c'})},{id:'d2',name:'Туман',born:'2026-09-30',genome:G.make({sex:'M',E:'T/e'})}],periods:[{from:'2026-09-30',to:null}]};
  assert.deepStrictEqual(E.repair(old,inc).bad,['документ не версии 2'],'старый документ идёт по пути startState, а не через repair');
  const s=E.normalize(E.startState(old.dragons),0,null);
  assert.deepStrictEqual(s.dragons.map(d=>[d.id,d.name,JSON.stringify(d.genome)]),old.dragons.map(d=>[d.id,d.name,JSON.stringify(d.genome)]));
  s.dragons.forEach(d=>assert.strictEqual(d.lvl,1));
  assert.strictEqual(s.dragons[0].home,'b1','огненно-водный в Кальдере');assert.strictEqual(s.dragons[1].home,null,'земляному на старте дома нет: он в яслях, а не пропал')});

t('неполный v2 (писала старая версия страницы): недостающее дополняется, драконы и постройки на месте',()=>{
  const s=fresh();const d=clone(s);delete d.clr;delete d.seq;delete d.bseq;delete d.credited;delete d.bal.xp;delete d.dragons[0].fed;delete d.dragons[1].lvl;
  delete d.bld.find(b=>b.type==='farm').plots;delete d.bld[0].chest;const snap=JSON.stringify(d);
  const r=E.repair(d,inc);assert.deepStrictEqual(r.bad,[]);assert.ok(r.fix.length>=6,r.fix.join('; '));
  assert.strictEqual(JSON.stringify(d),snap,'исходный документ не меняется');
  assert.deepStrictEqual(r.s.dragons.map(x=>[x.id,x.lvl,x.fed]),[['d1',1,0],['d2',1,0]]);
  assert.strictEqual(r.s.bal.xp,0);assert.strictEqual(r.s.bal.gold,s.bal.gold);
  assert.deepStrictEqual(r.s.bld.find(b=>b.type==='farm').plots,[null,null]);assert.deepStrictEqual(r.s.bld[0].chest,{amt:0,k0:null});
  assert.ok(r.s.seq>2&&r.s.bseq>3,'новые id не совпадут со старыми');
  /* без учтённого дохода старый доход не начисляется второй раз */
  const after=E.normalize(r.s,inc.K,inc);assert.strictEqual(after.bal.food,s.bal.food);assert.strictEqual(after.bal.gems,s.bal.gems);
  /* и с ним можно играть: кормление проходит */
  const f=E.apply(after,{K:inc.K,streak:0,uid:'u',today:'2026-10-28'},{t:'feed',dragon:'d1'});assert.ok(!f.err,f.err)});

t('испорченный v2: драконы, постройки и баланс не чинятся догадкой, а помечаются, документ не меняется',()=>{
  const base=fresh(),cases=[
    [d=>{d.dragons='x'},'драконы'],[d=>{d.dragons[0].genome={sex:'F'}},'дракон Ж'],[d=>{d.dragons[1].lvl=-3},'дракон П: уровень'],
    [d=>{d.bld='x'},'постройки'],[d=>{d.bld[0].type='zz'},'постройка b1'],[d=>{d.bal.gold='много'},'баланс: gold'],[d=>{d.bal=null},'нет баланса'],
    [d=>{d.bal.food=NaN},'баланс: food']];
  cases.forEach(([spoil,want])=>{const d=clone(base);spoil(d);const snap=JSON.stringify(d),r=E.repair(d,inc);
    assert.ok(r.bad.includes(want),want+' → '+JSON.stringify(r.bad));assert.strictEqual(JSON.stringify(d),snap)})});

t('мусор вместо документа: null, строка, массив, другая версия',()=>{
  [null,'x',[],{v:3},{v:'2'},{v:2}].forEach(d=>{const r=E.repair(d,inc);assert.ok(r.bad.length,JSON.stringify(d))})});

t('поход в тех же документах: старые e1…e6 и нынешний pve читаются, мусор отбрасывается',()=>{
  fixtures.forEach(([f,d])=>{const p=C.progress(d);assert.strictEqual(p.v,1,f);Object.keys(p.best).forEach(id=>assert.ok(C.byId(id),f+': '+id))});
  const p=C.progress({v:2,pve:{v:1,best:{e1:3,e6:2,zz:3},wins:{e1:2},at:{e1:'2026-10-20'}}});assert.deepStrictEqual(p.best,{e1:3,e6:2});
  assert.deepStrictEqual(C.progress({v:2,pve:'битый'}).best,{})});

t('геномы и яйца из сценариев: валидны, яйцо в инкубаторе и пара в гнездовье проходят проверку',()=>{
  fixtures.forEach(([f,d])=>{d.dragons.forEach(x=>assert.deepStrictEqual(G.validate(G.upgrade(x.genome)),[],f+': '+x.id));
    d.bld.forEach(b=>{(b.slots||[]).forEach(e=>{if(e)assert.deepStrictEqual(G.validate(G.upgrade(e.genome||e.egg)),[],f+': яйцо '+b.id)})})})});

t('E2: старые яйца и пары после миграции вылупляются тем же фенотипом, зерно и исход не меняются',()=>{
  const d=clone(fixtures.find(([f])=>f==='isle-nurs.json')[1]);const h=d.bld.find(b=>b.type==='hatch');
  const before=h.slots.filter(Boolean).map(e=>G.phenotype(G.upgrade(e.genome)));
  const r=E.repair(d,inc);const after=r.s.bld.find(b=>b.type==='hatch').slots.filter(Boolean);
  assert.deepStrictEqual(after.map(e=>G.phenotype(e.genome)),before);after.forEach(e=>{assert.strictEqual(e.genome.A1[0][2],'0');assert.strictEqual(e.genome.A1[1][2],'0')});
  assert.deepStrictEqual(after.map(e=>[e.at,e.need,e.viable,e.n]),h.slots.filter(Boolean).map(e=>[e.at,e.need,e.viable,e.n]),'таймеры и номер яйца те же');
  /* старый геном без E2 у отпущенного в архиве тоже получает 0/0 */
  const g=clone(fixtures[0][1]);g.gone=[{id:'d99',name:'Старый',genome:clone(g.dragons[0].genome)}];const rg=E.repair(g,inc);
  assert.strictEqual(rg.s.gone[0].genome.A1[0].length,3)});



t('здание с недопустимым уровнем (дом 99, ферма 0.5): сохранение блокируется с объяснением, а не падает дальше',()=>{
  const s=fresh();const d=clone(s);d.bld[0].lvl=99;let r;assert.doesNotThrow(()=>{r=E.repair(d,inc)});
  assert.ok(r.bad.some(x=>/уровень 99/.test(x)),r.bad.join('; '));
  const d2=clone(s);d2.bld[2].lvl=0.5;assert.ok(E.repair(d2,inc).bad.length)});

t('испорченные таймеры, координаты вне карты, повтор номера, улучшение не на следующий уровень',()=>{
  const s=fresh();
  const a=clone(s);a.bld[0].build={at:'вчера',need:10};assert.ok(E.repair(a,inc).bad.some(x=>/стройка/.test(x)));
  const b=clone(s);b.bld[0].x=E.GRID-1;assert.ok(E.repair(b,inc).bad.some(x=>/вне карты/.test(x)));
  const c=clone(s);c.bld[1].id=c.bld[0].id;assert.ok(E.repair(c,inc).bad.some(x=>/повтор/.test(x)));
  const e=clone(s);e.dragons[1].id=e.dragons[0].id;assert.ok(E.repair(e,inc).bad.some(x=>/повтор/.test(x)));
  const f=clone(s);f.bld[0].up={at:0,need:10,skip:0,to:3};assert.ok(E.repair(f,inc).bad.some(x=>/улучшение/.test(x)))});

t('неполный геном яйца в инкубаторе и в гнездовье: блокируется, яйцо не подменяется догадкой',()=>{
  const lab=clone(fixtures.find(([f])=>f==='isle-nurs.json')[1]);
  const h=lab.bld.find(b=>b.type==='hatch'),k=h.slots.findIndex(Boolean);assert.ok(k>=0,'в сценарии есть яйцо');
  delete h.slots[k].genome.A1;const r=E.repair(lab,inc);assert.ok(r.bad.some(x=>/яйцо/.test(x)),r.bad.join('; '));
  const s=fresh();s.bld.push({id:'b9',type:'nest',x:1,y:5,lvl:1,build:null,up:null,pair:{m:'d1',f:'d2',at:0,need:10,skip:0,n:1,egg:{viable:true,genome:{sex:'F'}}}});
  assert.ok(E.repair(s,inc).bad.some(x=>/пара/.test(x)))});

t('дракон ссылается на дом, которого нет: переходит в ясли, геном и уровень на месте',()=>{
  const s=fresh();const d=clone(s);d.dragons[0].home='b77';d.dragons[0].lvl=4;const r=E.repair(d,inc);
  assert.deepStrictEqual(r.bad,[]);assert.strictEqual(r.s.dragons[0].home,null);assert.strictEqual(r.s.dragons[0].nurs,true);
  assert.strictEqual(r.s.dragons[0].lvl,4);assert.deepStrictEqual(r.s.dragons[0].genome,d.dragons[0].genome)});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
