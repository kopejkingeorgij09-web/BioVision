/* Автотесты живого острова: node phagi/dragons/live.test.js
   Чистая часть live.js: клетки острова, что заслоняет дракона, свободный путь, выбор цели прогулки.
   Рисунок, кадры и нажатия проверяет браузерный сценарий, эти тесты его не заменяют. */
'use strict';
const assert=require('assert');
const G=require('./genetics.js'),D=require('./economy.js'),I=require('./island.js'),LV=require('./live.js').PURE;
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
function rng(seed){let a=seed>>>0;return ()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
/* остров для проверки: весь открыт, половина препятствий расчищена, шесть сред */
function crowded(){const s=D.startState([]);s.land=[];for(let x=0;x<3;x++)for(let y=0;y<3;y++)s.land.push(x+','+y);
  s.clr=D.obstacles(s).filter((o,i)=>i%2===0).map(o=>o.id);s.bld=[];let id=1;
  [['F',4,5],['W',6,5],['T',1,6],['A',7,7],['P',3,7],['N',8,3],['farm',4,1]].forEach(([type,x,y])=>{for(let r=0;r<6;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)
    if(!s.bld.some(b=>b.type===type)&&D.canPlace(s,x+dx,y+dy))s.bld.push({id:'b'+id++,type,x:x+dx,y:y+dy,lvl:1,chest:{amt:0,k0:null},build:null,up:null})});
  return s}
const homeOf=(b,dx,dy)=>{const c=I.P(b.x+1,b.y+1);return [c[0]+dx,c[1]+dy]};

t('клетки сетки и единицы острова переводятся туда и обратно',()=>{
  for(const [i,j] of [[0,0],[3.5,7.25],[11,2]]){const p=LV.toIsle(I,i,j),g=LV.toGrid(I,p[0],p[1]);assert.ok(Math.abs(g[0]-i)<1e-9&&Math.abs(g[1]-j)<1e-9)}
  const p=LV.toIsle(I,5,5),q=I.P(5,5);assert.deepStrictEqual(p,q)});

t('ходить можно только по открытой земле: не по постройкам, препятствиям и закрытым участкам',()=>{
  const s=D.startState([]),m=LV.mapOf(s,D,I);
  s.bld.forEach(b=>{for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)assert.ok(!m.free(b.x+dx+.5,b.y+dy+.5),b.type)});
  D.obstacles(s).forEach(o=>assert.ok(!m.free(o.x+.5,o.y+.5),o.id));
  for(let i=0;i<D.GRID;i++)for(let j=0;j<D.GRID;j++){const ch=Math.floor(i/D.CHUNK)+','+Math.floor(j/D.CHUNK);if(!s.land.includes(ch))assert.ok(!m.free(i+.5,j+.5),ch)}
  assert.ok(!m.free(-0.5,3)&&!m.free(3,12.2))});

t('цель прогулки: свободна, не заслонена, путь свободен и не заслонён, идёт боком к зрителю, не на другом драконе',()=>{
  const s=crowded(),m=LV.mapOf(s,D,I),r=rng(7);let found=0,tries=0;
  const ds=s.bld.filter(b=>D.TYPES[b.type].kind==='hab').flatMap((b,k)=>[[-30,22],[28,22]].map(([dx,dy])=>{const h=homeOf(b,dx,dy);return {home:h,p:h.slice(),to:null,w:60,h:40}}));
  ds.forEach(d=>LV.settle(m,I,d,ds));
  for(let it=0;it<400;it++){const d=ds[it%ds.length];tries++;const p=LV.pickTarget(m,I,d,ds,r);if(!p)continue;found++;
    const g=LV.toGrid(I,p[0],p[1]);assert.ok(m.free(g[0],g[1]),'цель на занятой клетке');
    assert.ok(!LV.hidden(m,p,d.w,d.h),'цель заслонена');assert.ok(LV.pathFree(m,I,d.p,p),'путь занят');
    const dx=p[0]-d.p[0],dy=p[1]-d.p[1];assert.ok(Math.abs(dx)>=14&&Math.abs(dy)<=Math.abs(dx)*0.55);
    for(let k=1;k<6;k++){const q=[d.p[0]+dx*k/6,d.p[1]+dy*k/6];assert.ok(!LV.hidden(m,q,d.w,d.h),'по пути заслонён')}
    ds.forEach(o=>{if(o!==d)assert.ok(Math.hypot(o.p[0]-p[0],(o.p[1]-p[1])*2)>=d.w*0.7,'на другом драконе')});
    d.p=p}
  assert.ok(found>tries*0.4,`целей мало: ${found} из ${tries}`)});

t('дракон, которого дома заслоняет дерево или постройка, переставляется в видную свободную точку рядом',()=>{
  const s=crowded(),m=LV.mapOf(s,D,I);let moved=0;
  s.bld.filter(b=>D.TYPES[b.type].kind==='hab').forEach(b=>[[-30,22],[28,22],[0,30],[46,8]].forEach(([dx,dy])=>{
    const h=homeOf(b,dx,dy),d={home:h,p:h.slice(),w:60,h:40};const was=LV.hidden(m,d.p,d.w,d.h)||!m.free(...LV.toGrid(I,d.p[0],d.p[1]));
    const r=LV.settle(m,I,d,[]);if(was){moved++;assert.ok(r,'не нашлось места');assert.ok(!LV.hidden(m,d.p,d.w,d.h));assert.ok(m.free(...LV.toGrid(I,d.p[0],d.p[1])))}
    else assert.ok(!r&&d.p[0]===h[0])}));
  assert.ok(moved>0,'в проверке нет заслонённых мест')});

t('заслоняет только то, что стоит впереди: дракон ниже основания постройки нарисован поверх неё',()=>{
  const s=D.startState([]);s.clr=D.obstacles(s).map(o=>o.id);s.bld=s.bld.slice(0,1);
  const m=LV.mapOf(s,D,I),b=s.bld[0],c=I.P(b.x+1,b.y+1);
  /* b1 — вольер (4.1): заслоняет только знак среды в глубине, двор перед ним открыт */
  assert.ok(LV.hidden(m,[c[0],c[1]-14],50,40),'за знаком среды должен быть заслонён');
  assert.ok(!LV.hidden(m,[c[0],c[1]+20],50,40),'во дворе не заслонён');
  const f={id:'f',type:'farm',x:8,y:4,lvl:1,plots:[null,null],build:null,up:null};s.bld.push(f);const m2=LV.mapOf(s,D,I),cf=I.P(f.x+1,f.y+1);
  assert.ok(LV.hidden(m2,[cf[0],cf[1]-4],50,40),'за обычной постройкой заслонён');assert.ok(!LV.hidden(m2,[cf[0],cf[1]+20],50,40))});

t('вольер (4.1): дракон гуляет и летает только во дворе своего дома',()=>{
  const s=crowded(),m=LV.mapOf(s,D,I),r=rng(7);let n=0,cov=0;
  s.bld.filter(b=>D.TYPES[b.type].kind==='hab').forEach(b=>{assert.ok(m.yards[b.id],'у среды есть двор');
    const h=homeOf(b,0,21),d={hid:b.id,home:h,p:h.slice(),w:36,h:26};
    LV.settle(m,I,d,[]);if(d.cover){cov++;return}assert.ok(LV.yardHas(m,I,d,d.p),'после settle во дворе');
    for(let i=0;i<60;i++){const air=i%3===0,to=air?LV.yardTarget(m,I,d,[],r,true):LV.pickTarget(m,I,d,[],r);if(!to)continue;n++;
      const g=LV.toGrid(I,to[0],to[1]);assert.ok(LV.inYard(I.YARD,g[0]-b.x,g[1]-b.y),'цель за бортиком: '+b.type);
      if(!air){assert.ok(!LV.hidden(m,to,d.w,d.h));d.p=to}}});
  assert.ok(n>50,'целей мало: '+n);assert.ok(cov<3,'слишком много закрытых дворов: '+cov)});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
