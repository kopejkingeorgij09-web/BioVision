const assert=require('assert'),D=require('./stats.js');
const s={hp:100,atk:25,def:20,spd:10};assert.equal(D.power(s),320);
for(const k of Object.keys(s))assert(D.power({...s,[k]:s[k]+1})>D.power(s));
assert.equal(D.power(s),D.power({...s}));console.log('PASS: абсолютная сила учитывает каждый параметр и стабильна');

const values=[[],['F'],['F','W'],['F','W','T'],['F','W','T','A']].map(els=>D.power({...s,els}));
assert.deepStrictEqual(values,[320,320,368,416,480]);
for(let i=2;i<values.length;i++)assert(values[i]>values[i-1]);
for(const els of [['F'],['F','W'],['F','W','T'],['F','W','T','A']]){
 const ph={breath:'element',elements:els},stats=D.of(ph,10);
 assert.equal(D.power(stats),D.power({...stats,rarityRank:undefined,els}));
 assert.equal(D.power({...stats,rarityRank:undefined,role:undefined,els}),D.power(stats));
}
console.log('PASS: редкость повышает силу при равных параметрах; карточки и бой используют одну формулу');
