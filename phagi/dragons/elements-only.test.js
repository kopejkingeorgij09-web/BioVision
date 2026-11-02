const assert=require('assert'),G=require('./genetics.js'),S=require('./stats.js');global.DRG=G;const E=require('./economy.js'),L=require('./learning.js');
const a=G.make({sex:'F',E:'F/F',H:'H/H',K:'K/K',C:'c/c',Wg:'Wg/Wg'}),b=G.make({sex:'F',E:'F/F',H:'h/h',K:'k/k',C:'C/C',Wg:'+/+'});
assert.deepEqual(S.of(G.phenotype(a),10,{canFly:true}),S.of(G.phenotype(b),10,{canFly:false}));
assert.equal(G.gameRarity(G.phenotype(a)),G.gameRarity(G.phenotype(b)));
const father=G.make({sex:'M',E:'W/W',Wg:'Wg/Wg'});let matches=0;for(let i=0;i<100;i++){const egg=G.breedElements(a,father,G.rng('new'+i));assert(egg.viable);if(G.phenotype(egg.genome).elements.join('+')==='F+W')matches++;assert.equal(G.validate(egg.genome).length,0)}
assert(matches>90,'большинство детей F+W, редкие мутации допустимы');
assert.equal(L.explain(a,father,'elements','F+W').dead,0);
assert.equal(E.goldRate({genome:a,lvl:10}),E.goldRate({genome:b,lvl:10}));console.log('PASS: только стихии влияют на параметры, редкость и доход; новые яйца жизнеспособны');
