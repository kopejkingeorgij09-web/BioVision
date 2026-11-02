const assert=require('assert'),G=require('./genetics.js'),L=require('./learning.js');
const m=G.make({sex:'F',C:'C/c',Wg:'Wg/+'}),f=G.make({sex:'M',C:'C/c',Wg:'Wg/+'});
const r=L.explain(m,f,'color','pale');assert.equal(r.truth,.25);assert.equal(r.dead,.25);assert.equal(r.alive,.75);assert.equal(r.favorable,.1875);
for(const g of r.groups)for(const who of ['m','f'])assert(Math.abs(g[who].reduce((s,x)=>s+x.p,0)-1)<1e-9);
const w=L.explain(m,f,'shortWings','true');assert(Math.abs(w.truth-2/3)<1e-9);
const sex=L.explain(m,f,'sex','F');assert.equal(sex.truth,.5);console.log('PASS: гаметы, жизнеспособность и условные вероятности');
