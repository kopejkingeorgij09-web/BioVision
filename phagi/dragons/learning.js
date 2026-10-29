/* Данные разбора из того же мейоза, что и игровое потомство. */
(function(root){'use strict';const G=root.DRG||(typeof require==='function'?require('./genetics.js'):null);
const CHR={elements:['A1','A2'],color:['A2'],hornsMace:['A3'],crest:['A3'],shortWings:['A4'],span:['A1','A4'],metal:['sex'],night:['sex'],sex:['sex'],spurs:['sex'],glow:['mt']};
const cache=new Map();
function explain(m,f,trait,value){const key=JSON.stringify([m,f,trait,value]);if(cache.has(key))return cache.get(key);
 const groups=(CHR[trait]||[]).map(c=>{if(c==='mt')return {name:'Митохондрии',loci:['G'],m:[{h:[m.mt],p:1}],f:[{h:['не передаются'],p:1}],mt:true};
 if(c==='sex')return {name:'Половые хромосомы',loci:['M','N','Sp'],m:[{h:['Z',...m.Z[0]],p:.5},{h:['W',m.W],p:.5}],f:G.hapDist(f.Z,G.Z.r).map(x=>({h:['Z',...x.h],p:x.p}))};
 return {name:c,loci:G.CHROMS[c].loci,m:G.hapDist(m[c],G.CHROMS[c].r),f:G.hapDist(f[c],G.CHROMS[c].r)};});
 if(!groups.some(x=>x.name==='A4'))groups.push({name:'Жизнеспособность: Wg',loci:['Wg'],m:G.hapDist([[m.A4[0][0]],[m.A4[1][0]]],[]),f:G.hapDist([[f.A4[0][0]],[f.A4[1][0]]],[])});
 const dead=G.lethalShare(m,f),truth=G.dist(m,f,trait)[value]||0,result={groups,dead,truth,alive:1-dead,favorable:truth*(1-dead)};
 if(cache.size>=24)cache.delete(cache.keys().next().value);cache.set(key,result);return result}
const api={explain};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DRLEARN=api;
})(typeof window!=='undefined'?window:globalThis);
