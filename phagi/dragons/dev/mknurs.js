/* остров с Инкубатором и двумя готовыми яйцами драконов света, а Храма рассвета нет (откроется на 12-м уровне) */
global.DRG=require('../genetics.js');const E=require('../economy.js'),G=global.DRG;
let s=JSON.parse(require('fs').readFileSync(process.argv[2]));const ctx={K:0,today:'2026-10-27',uid:'u_test1'};
s=E.normalize(s,0,null);s.bal.gold=1e6;
outer:for(let y=1;y<E.GRID-1;y++)for(let x=1;x<E.GRID-1;x++)if(E.canPlace(s,x,y)){const r=E.apply(s,ctx,{t:'build',type:'hatch',x,y});if(!r.err){s=r.s;break outer}}
const h=s.bld.find(b=>b.type==='hatch');delete h.build;
const egg=n=>({n,m:'d1',f:'d2',genome:G.make({sex:n%2?'F':'M',E:'L/L',S:'S/S'}),viable:true,at:0,need:1,skip:5,pred:null});
h.slots=[egg(1),egg(2)];s.bal.gold=250;s.dragons.push({id:'d90',name:'Луч',born:'2026-10-20',genome:G.make({sex:'M',E:'L/L',S:'S/S'}),lvl:1,fed:0,home:null,nurs:true});
console.log(JSON.stringify(s))
