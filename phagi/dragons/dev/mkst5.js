/* сценарий этапа 5: остров из isle-lab с Инкубатором и журналом наблюдений одной пары, отец потом отпущен
   (журнал показывает генотип из архива). node mkst5.js isle-lab.json > isle-st5.json */
global.DRG=require('../genetics.js');const E=require('../economy.js'),G=global.DRG;
const d=JSON.parse(require('fs').readFileSync(process.argv[2]));
let s=E.normalize(d,0,null),K=0;const ctx=()=>({K,today:'2026-10-27',uid:'u_test1',streak:3});
const ok=a=>{const r=E.apply(s,ctx(),a);if(r.err)throw new Error(a.t+': '+r.err);s=r.s;return r};
s.bal.gold=1e6;s.bal.xp=E.xpFor(6);s.bal.food=1e5;
outer:for(let y=1;y<E.GRID-1;y++)for(let x=1;x<E.GRID-1;x++)if(E.canPlace(s,x,y)){const r=E.apply(s,ctx(),{t:'build',type:'hatch',x,y});if(!r.err){s=r.s;break outer}}
K+=500;s=E.normalize(s,K,null);
const nest=s.bld.find(b=>b.type==='nest'),hb=s.bld.find(b=>b.type==='hatch');nest.build=null;
/* пара: самка F/e C/c × самец W/e C/c — видно расщепление и окраски */
const f=s.dragons.find(x=>x.genome.sex==='F'),m=s.dragons.filter(x=>x.genome.sex==='M').pop();
f.genome=G.make({sex:'F',E:'F/e',C:'C/c',H:'H/h'});m.genome=G.make({sex:'M',E:'W/e',C:'C/c',H:'h/h'});f.lvl=Math.max(f.lvl,4);m.lvl=Math.max(m.lvl,4);
for(let i=0;i<10;i++){ok({t:'breed',id:nest.id,mother:f.id,father:m.id});K+=200;ok({t:'egg',id:nest.id});K+=200;
  hb.slots=s.bld.find(b=>b.id===hb.id).slots;const j=s.bld.find(b=>b.id===hb.id).slots.findIndex(Boolean);
  const r=E.apply(s,ctx(),{t:'hatch',id:hb.id,plot:j});if(r.err){console.error('hatch',r.err);break}s=r.s;
  /* лишних малышей отпускаем, чтобы ясли не заполнились: в журнале они остаются */
  if(i>=2&&s.got&&s.got.baby){const q=E.apply(s,ctx(),{t:"release",dragon:s.got.baby});if(!q.err)s=q.s}}
s.bal.gold=4000;s.bal.food=900;s.bal.gems=40;
/* отец улетает: журнал хранит генотип в архиве */
const r=E.apply(s,ctx(),{t:'release',dragon:m.id});if(r.err)console.error('release',r.err);else s=r.s;
s.credited.lvl=E.level(s);
console.log(JSON.stringify(s))
