global.DRG=require('../genetics.js');const E=require('../economy.js'),G=global.DRG;
const d=JSON.parse(require('fs').readFileSync(process.argv[2]));
d.bal.xp=E.xpFor(4);d.bal.gold=250;
let s=E.normalize(d,0,null);const ctx={K:0,today:'2026-10-27',uid:'u_test1'};
outer:for(let y=1;y<E.GRID-1;y++)for(let x=1;x<E.GRID-1;x++)if(E.canPlace(s,x,y)){s.bal.gold=1e6;const r=E.apply(s,ctx,{t:'build',type:'nest',x,y});if(!r.err){s=r.s;break outer}}
s.bld.forEach(b=>{if(b.type==='nest'){delete b.build;b.pair=null}});s.bal.gold=250;
/* эпистаз: самка d6 F/F s/s (дремлет), самец d2 W/W S/S; d6 2-го уровня, чтобы видна была подсказка про уровень */
const f=s.dragons.find(x=>x.id==='d6'),m=s.dragons.find(x=>x.id==='d2');
f.genome=G.make({sex:'F',E:'F/F',S:'s/s'});m.genome=G.make({sex:'M',E:'W/W',S:'S/S'});
f.home=s.bld.find(b=>b.type==='N').id;m.home=s.bld.find(b=>b.type==='W').id;
console.log(JSON.stringify(s))
