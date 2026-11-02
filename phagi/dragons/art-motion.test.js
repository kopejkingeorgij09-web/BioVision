const assert=require('assert'),{point}=require('./art-motion.js');
const idle={time:0,phase:0,walk:0,wing:1,head:0,blink:0},later={...idle,time:1};
for(const [name,p] of Object.entries({tail:[.15,.7],wing:[.4,.2],chest:[.64,.57]}))assert.notDeepStrictEqual(point(...p,idle),point(...p,later),name+' must move independently');
assert.notDeepStrictEqual(point(.8,.95,{...idle,walk:1,phase:.1}),point(.8,.95,{...idle,walk:1,phase:.6}));
assert.notDeepStrictEqual(point(.87,.23,{...idle,blink:1}),point(.87,.23,idle));
assert.deepStrictEqual(point(.2,.8,{...later,reduce:true}),[.2,.8]);
for(let t=0;t<100;t++)for(let u=0;u<=1;u+=.1)for(let v=0;v<=1;v+=.1){const p=point(u,v,{...later,time:t/10,walk:1,phase:t/10,wing:.6,head:.2,blink:t%2});assert(p.every(Number.isFinite));assert(Math.hypot(p[0]-u,p[1]-v)<.2)}
console.log('PASS: independent skin movement, gait, eyelids, reduced motion, bounded finite displacement');
