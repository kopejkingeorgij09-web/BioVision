// Tests the shipped model in the self-contained game. Pass an HTML file or the source module.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const input = fs.readFileSync(process.argv[2] || path.join(__dirname,'..','oplot.html'),'utf8');
const model = input.includes('<!doctype html>') ? input.slice(input.indexOf('const GAME_ELEMENTS'),input.indexOf('const STRUCT')) : input;
const globals = {window:{}};
vm.runInNewContext(model,globals);
const {Genetics:G,GAME_SPECIES:species} = globals.window;
const dragon = (species,level) => ({species,level});
const byElements = a => species.find(s => s.mask === a.reduce((mask,i)=>mask|(1<<i),0));
const mass = (outcomes,n) => outcomes.filter(o=>species[o.species].elements.length===n).reduce((sum,o)=>sum+o.chance,0);
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-10,actual+' vs '+expected);
const equal = (a,b) => assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
const describe = el => ['огня','воды','природы','молнии','земли','света'][el];
assert.equal(species.length,63);
assert.equal(new Set(species.map(s=>s.mask)).size,63);
assert.equal(new Set(species.map(s=>s.name)).size,63);
assert.equal(new Set(species.map(s=>s.shortName)).size,63);
assert.ok(species.every(s=>Boolean(s.shortName) && s.name.includes(s.shortName) && s.elements.every(i=>s.name.includes(describe(i)))));
for(const s of species){
  assert.equal(s.rank,Math.min(s.elements.length,4));
  assert.equal(s.rarity,['','Обычный','Редкий','Эпический','Легендарный'][s.rank]);
  assert.ok(s.art>=0 && s.art<=13 && s.elements.includes(s.element));
  if(!s.parents)assert.equal(s.elements.length,1);
  else assert.ok(G.outcomes(...s.parents.map(id=>dragon(id,1))).some(o=>o.species===s.id && o.chance>0),'unusable recipe '+s.name);
}
equal(G.baseIds,[0,1,2,3,4,14]);
const oldResidents=['Искрик','Капель','Листик','Разрядник','Кремешок','Туманник','Огнецвет','Штормокрыл','Мохоспин','Обсидиан','Аврора','Громовой Бархан','Звездочёт','Солнцевенец'];
const legacyState={dragons:oldResidents.map((_,id)=>dragon(id,id+1)),egg:{species:11,end:12000},book:oldResidents.map((_,i)=>i)};
assert.ok(legacyState.dragons.every((d,i)=>species[d.species].shortName===oldResidents[i] && species[d.species].art===i));
assert.equal(species[legacyState.egg.species].shortName,'Громовой Бархан');
equal(legacyState.book.map(id=>species[id].shortName),oldResidents);
for(const a of species)for(const b of species){
  const p=dragon(a.id,7),q=dragon(b.id,18);
  const possibilities=G.outcomes(p,q);
  equal(possibilities,G.outcomes(q,p));
  near(possibilities.reduce((sum,v)=>sum+v.chance,0),1);
  for(const o of possibilities){
    const mask=species[o.species].mask;
    assert.ok(o.chance>0 && (mask&(a.mask|b.mask))===mask && (mask&a.mask) && (mask&b.mask));
  }
  if(a.id===b.id || (a.rank===1 && b.rank===1)){
    const target=species.find(s=>s.mask===(a.mask|b.mask));
    equal(possibilities,[{species:target.id,chance:1}]);
  }
  if(a.rank===2 && b.rank===2 && a.id!==b.id){
    const epic=mass(possibilities,3), rare=mass(possibilities,2);
    const otherRare=possibilities.filter(o=>species[o.species].rank===2 && ![a.id,b.id].includes(o.species)).reduce((sum,o)=>sum+o.chance,0);
    near(rare+epic,1);assert.ok(epic>0 && epic<otherRare);near(rare,otherRare);
    near(mass(G.outcomes(dragon(a.id,4),dragon(b.id,4)),3),.08);
    near(mass(G.outcomes(dragon(a.id,30),dragon(b.id,30)),3),.4);
    assert.ok(mass(G.outcomes(dragon(a.id,8),q),3)>epic);
    assert.ok(mass(G.outcomes(p,dragon(b.id,19)),3)>epic);
  }
}
const pair = [dragon(byElements([0,1]).id,30),dragon(byElements([2,3]).id,30)];
const outcomes = G.outcomes(...pair), samples=10000, counts=new Map();
for(let i=0;i<samples;i++){
  const result=G.roll(...pair,()=>(i+.5)/samples);
  counts.set(result,1+(counts.get(result)||0));
}
for(const o of outcomes)assert.ok(Math.abs(counts.get(o.species)/samples-o.chance)<.00011);
const reachable = new Set(G.baseIds);
for(let step=0;step<6;step++){
  const current=Array.from(reachable);
  for(const a of current)for(const b of current)for(const o of G.outcomes(dragon(a,1),dragon(b,1)))reachable.add(o.species);
}
assert.equal(reachable.size,63);
console.log('PASS 63 species, 14 legacy IDs, 15 base pairs, all 3969 parent pairs, recipe reachability, chance monotonicity and sampled outcomes');
