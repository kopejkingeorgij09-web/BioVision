const assert=require('assert'),D=require('./stats.js');
const s={hp:100,atk:25,def:20,spd:10};assert.equal(D.power(s),320);
for(const k of Object.keys(s))assert(D.power({...s,[k]:s[k]+1})>D.power(s));
assert.equal(D.power(s),D.power({...s}));console.log('PASS: абсолютная сила учитывает каждый параметр и стабильна');
