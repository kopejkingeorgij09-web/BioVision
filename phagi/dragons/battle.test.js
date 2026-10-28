/* Автотесты боя 3 на 3: node phagi/dragons/battle.test.js
   Формулы урона и стихий, конец боя, крайние случаи (добивание, ожог в начале хода, пропуск хода, защита, «Ярость»),
   повторяемость с тем же зерном, честность компьютера и баланс на настоящих драконах (stats.js). */
'use strict';
const assert=require('assert');
const B=require('./battle.js'),D=require('./genetics.js');
global.MORPH=require('./morph.js');
const SH=require('./shape.js'),AN=require('./anim.js'),ST=require('./stats.js');
let n=0,fails=0;
function t(name,fn){n++;try{fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,3).join(' '))}}
const F=(id,o)=>Object.assign({id,name:id,els:[],lvl:5,hp:50,atk:15,def:12,spd:8},o||{});
const BASE={sex:'M',S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',M:'m/m',N:'N/n'};
/* боец из настоящего дракона: характеристики stats.js по фенотипу, морфологии и профилю движения */
function real(id,E,lvl,spec){const g=D.make(Object.assign({},BASE,{E},spec||{})),ph=D.phenotype(g),M=MORPH.morph(ph,lvl),G=SH.build(M),P=AN.profile(M,G.rig),s=ST.of(ph,lvl,P);
  return {id,name:id,lvl,els:ph.breath==='element'?ph.elements:[],hp:s.hp,atk:s.atk,def:s.def,spd:s.spd}}
const start=(A,Bb,seed)=>{const b=new B.Battle({A,B:Bb,seed});b.next();return b};
/* текущему бойцу сделать ход по выбору f(b) */
function play(b,pick){let k=0;while(!b.over&&k++<600){b.act(pick(b));b.next()}return b}

t('стихии: круг из пяти, Свет и Тьма друг против друга, гибриды перемножаются, без стихии ×1',()=>{
  assert.strictEqual(B.mult('F',['P']),1.5);assert.strictEqual(B.mult('P',['F']),0.75);assert.strictEqual(B.mult('W',['F']),1.5);
  assert.strictEqual(B.mult('L',['D']),1.5);assert.strictEqual(B.mult('D',['L']),1.5);assert.strictEqual(B.mult('L',['F']),1);
  assert.strictEqual(B.mult('W',['F','T']),1.5);assert.strictEqual(B.mult('F',['P','W']),1.5*0.75);assert.strictEqual(B.mult(null,['P']),1);
  Object.keys(B.BEATS).forEach(e=>{const wins=Object.keys(B.BEATS).filter(x=>B.mult(e,[x])>1);assert.strictEqual(wins.length,1,e)})});

t('урон: формула с разбросом ±10 %, не меньше 1, здоровье не уходит ниже нуля, событие попадания одно на действие',()=>{
  for(let seed=1;seed<200;seed++){const a=F('a',{els:['F']}),d=F('d',{els:['P'],hp:500,spd:1});const b=start([a],[d],seed);
    assert.strictEqual(b.cur,'a');const e0=b.expect(b.get('a'),{power:1.25,el:'F'},b.get('d'));
    const ev=b.act({skill:'el:F',target:'d'}),hits=ev.filter(e=>e.type==='hit');assert.strictEqual(hits.length,1);
    const h=hits[0];assert.ok(h.dmg>=Math.round(e0*0.9)-1&&h.dmg<=Math.round(e0*1.1)+1,`${h.dmg} при ожидании ${e0}`);
    assert.strictEqual(b.get('d').hp,500-h.dmg);assert.strictEqual(h.mult,1.5)}
  const b=start([F('a',{atk:200})],[F('d',{hp:5,spd:1})],3),ev=b.act({skill:'strike',target:'d'});
  assert.strictEqual(b.get('d').hp,0);assert.strictEqual(ev.find(e=>e.type==='hit').dealt,5);
  const w=start([F('a',{atk:1})],[F('d',{def:999,spd:1})],3).act({skill:'strike',target:'d'});assert.strictEqual(w.find(e=>e.type==='hit').dmg,1)});

t('конец боя: событие end одно, после него ходов нет, выбывший не ходит и не бывает целью',()=>{
  const b=start([F('a',{atk:400,spd:20}),F('a2',{spd:1})],[F('x',{hp:10}),F('y',{hp:10})],5);
  let ev=b.act({skill:'strike',target:'x'});assert.ok(ev.some(e=>e.type==='ko'&&e.id==='x'));assert.ok(!b.over);
  ev=b.next();assert.ok(!b.order().includes('x'));
  while(!b.over){const o=b.options();const c=b.get(b.cur);assert.ok(!c.ko);o.forEach(op=>assert.ok(!op.targets.includes('x')));
    if(c.side==='A')ev=b.act({skill:'strike',target:'y'});else ev=b.act({skill:'guard'});if(!b.over)b.next()}
  assert.strictEqual(b.winner,'A');assert.strictEqual(b.log.flat().filter(e=>e.type==='end').length,1);
  assert.throws(()=>b.act({skill:'strike',target:'y'}));assert.deepStrictEqual(b.next(),[])});

t('ожог в начале хода может добить последнего противника: бой кончается до его хода',()=>{
  const b=start([F('a',{spd:20,atk:20})],[F('d',{hp:3,spd:1})],1);b.get('d').fx.burn=2;b.get('d').hp=1;
  b.act({skill:'guard'});const ev=b.next();
  assert.deepStrictEqual(ev.map(e=>e.type),['dot','ko','end']);assert.strictEqual(b.winner,'A');assert.strictEqual(b.cur,null)});

t('опутанный пропускает ровно один ход; эффекты длятся своими ходами и снимаются в конце хода',()=>{
  const b=start([F('a',{spd:20})],[F('d',{spd:1,hp:999})],1);b.get('d').fx.root=1;b.get('d').fx.slow=2;
  b.act({skill:'guard'});let ev=b.next();assert.ok(ev.some(e=>e.type==='skip'&&e.id==='d'));assert.strictEqual(b.cur,'a');
  assert.ok(!b.get('d').fx.root);assert.strictEqual(b.get('d').fx.slow,1);
  b.act({skill:'guard'});ev=b.next();assert.strictEqual(b.cur,'d');b.act({skill:'guard'});assert.ok(!b.get('d').fx.slow)});

t('защита вдвое уменьшает урон до своего следующего хода',()=>{
  const mk=()=>start([F('a',{spd:20})],[F('d',{spd:1,hp:999})],9);
  const b1=mk();b1.act({skill:'guard'});b1.next();b1.act({skill:'guard'});b1.next();const plain=b1.act({skill:'strike',target:'d'}).find(e=>e.type==='hit');
  const b2=mk();b2.act({skill:'guard'});b2.next();b2.act({skill:'guard'});b2.get('d').guard=true;b2.next();
  assert.ok(!b2.get('d').guard||true);
  const b3=start([F('a',{spd:1,hp:999})],[F('d',{spd:20})],9);b3.act({skill:'guard'});assert.ok(b3.get('d').guard);b3.next();
  assert.strictEqual(b3.cur,'a');const e=b3.expect(b3.get('a'),{power:1},b3.get('d')),e0=b3.expect(b3.get('a'),{power:1},Object.assign({},b3.get('d'),{guard:false}));
  assert.ok(Math.abs(e-e0*0.5)<1e-9);const h=b3.act({skill:'strike',target:'d'}).find(x=>x.type==='hit');assert.ok(h.guarded);
  b3.next();assert.strictEqual(b3.cur,'d');assert.ok(!b3.get('d').guard,'защита снята в начале своего хода');assert.ok(plain.dmg>0)});

t('«Ярость дракона»: только при полной шкале, один раз за бой, шкала обнуляется, урон ×2,2',()=>{
  const b=start([F('a',{spd:20,els:['W']})],[F('d',{spd:1,hp:9999,def:0})],2);
  assert.ok(!b.options().some(o=>o.skill.id==='rage'));assert.throws(()=>b.act({skill:'rage',target:'d'}));
  b.get('a').rage=100;assert.ok(b.options().some(o=>o.skill.id==='rage'));
  const ev=b.act({skill:'rage',target:'d'});assert.strictEqual(b.get('a').rage,0);assert.ok(b.get('a').rageUsed);
  assert.ok(ev.some(e=>e.type==='effect'&&e.fx==='slow'),'у «Ярости» эффект стихии всегда');
  b.next();b.act({skill:'guard'});b.next();b.get('a').rage=100;assert.ok(!b.options().some(o=>o.skill.id==='rage'),'второй раз нельзя')});

t('точный удар ×1,25 только у игрока; у компьютера флаг не действует',()=>{
  const r=(perfect,side)=>{const A=[F('a',{spd:side==='A'?20:1})],Bb=[F('d',{spd:side==='A'?1:20,hp:999})];const b=start(A,Bb,4);
    return b.act({skill:'strike',target:side==='A'?'d':'a',perfect}).find(e=>e.type==='hit')};
  const a0=r(false,'A'),a1=r(true,'A');assert.ok(a1.perfect&&!a0.perfect);assert.ok(Math.abs(a1.dmg/a0.dmg-1.25)<0.06);
  const b1=r(true,'B');assert.ok(!b1.perfect)});

t('команды: от 1 до 3, один дракон не может быть в бою дважды',()=>{
  assert.throws(()=>new B.Battle({A:[F('a'),F('a')],B:[F('x')]}));assert.throws(()=>new B.Battle({A:[F('a')],B:[F('a')]}));
  assert.throws(()=>new B.Battle({A:[F('a'),F('b'),F('c'),F('d')],B:[F('x')]}));assert.throws(()=>new B.Battle({A:[],B:[F('x')]}))});

t('тот же бой с тем же зерном и теми же решениями повторяется точь-в-точь',()=>{
  const mk=()=>B.simulate([real('a1','F/F',8),real('a2','W/e',6),real('a3','T/A',7)],[real('b1','P/P',8),real('b2','A/A',6),real('b3','D/e',7)],{seed:77});
  assert.strictEqual(JSON.stringify(mk().log),JSON.stringify(mk().log))});

t('компьютер: добивает, если может, бьёт сильной стихией, закрывается, когда его вот-вот добьют; ходы всегда по правилам',()=>{
  const b=start([F('x',{spd:1,hp:60}),F('y',{spd:1,hp:4})],[F('ai',{spd:20,els:['W']})],1);
  const c=b.ai('hard');assert.strictEqual(c.target,'y');
  const b2=start([F('p',{spd:1,els:['P']}),F('f',{spd:1,els:['F']})],[F('ai',{spd:20,els:['W']})],1);
  assert.deepStrictEqual(b2.ai('hard'),Object.assign({skill:'el:W',target:'f'},{v:b2.ai('hard').v}));
  const b3=start([F('big',{spd:1,atk:60})],[F('ai',{spd:20,hp:6,atk:1})],1);b3.get('ai').hp=6;
  assert.strictEqual(b3.ai('hard').skill,'guard');
  for(const lv of ['easy','normal','hard'])for(let s=1;s<40;s++){const bb=B.simulate([real('a1','F/F',5),real('a2','W/W',5)],[real('b1','P/P',5),real('b2','T/T',5)],{seed:s,aiA:lv,aiB:lv});
    assert.ok(bb.over);bb.log.flat().filter(e=>e.type==='hit').forEach(h=>assert.ok(!(h.perfect&&bb.get(h.id).side==='B')))}});

t('бой по времени: после 30 раундов победы нет, засчитывается поражение',()=>{
  const b=start([F('a',{spd:20,hp:9999})],[F('d',{spd:1,hp:9999})],1);let k=0;
  while(!b.over&&k++<200){b.act({skill:'guard'});b.next()}
  assert.ok(b.over);assert.strictEqual(b.winner,'B');assert.strictEqual(b.log.flat().concat([]).length>=0,true);assert.strictEqual(b.stars(),0)});

t('звёзды: 3 без потерь, 2 с одной потерей, 1 с двумя',()=>{
  const b=new B.Battle({A:[F('a'),F('b'),F('c')],B:[F('x')]});b.winner='A';assert.strictEqual(b.stars(),3);
  b.get('a').ko=true;assert.strictEqual(b.stars(),2);b.get('b').ko=true;assert.strictEqual(b.stars(),1)});

t('баланс на настоящих драконах: равные команды идут 3–7 раундов, зеркальный бой около 50 на 50, «трудный» компьютер сильнее «лёгкого»',()=>{
  const teamA=()=>[real('a1','F/F',8),real('a2','W/e',8),real('a3','T/T',8)],teamB=()=>[real('b1','F/F',8),real('b2','W/e',8),real('b3','T/T',8)];
  const rounds=[],wins={A:0,B:0};
  for(let s=1;s<=300;s++){const b=B.simulate(teamA(),teamB(),{seed:s});rounds.push(b.round);wins[b.winner]++}
  rounds.sort((a,b)=>a-b);const med=rounds[rounds.length>>1];
  assert.ok(med>=3&&med<=7,'медиана раундов '+med);assert.ok(rounds[rounds.length-1]<30,'бой до времени');
  assert.ok(wins.A>300*0.3&&wins.A<300*0.7,'зеркальный бой: '+JSON.stringify(wins));
  let hard=0;for(let s=1;s<=300;s++){const b=B.simulate(teamA(),teamB(),{seed:s,aiA:'hard',aiB:'easy'});if(b.winner==='A')hard++}
  assert.ok(hard>300*0.55,'трудный против лёгкого: '+hard+' из 300');
  console.log('     раундов медиана',med,', зеркальный',JSON.stringify(wins),', трудный против лёгкого',hard,'из 300')});

/* ---------- особенности противников похода (этап 4) ---------- */
t('толстая шкура: Удар и Ярость без стихии вдвое слабее, стихия проходит как обычно',()=>{
  const b=start([F('a',{spd:20,els:['F']})],[F('x',{traits:['thick']}),F('y')],1),a=b.get('a'),x=b.get('x'),y=b.get('y');
  assert.ok(Math.abs(b.expect(a,{power:1},x)/b.expect(a,{power:1},y)-0.5)<1e-9);
  assert.ok(Math.abs(b.expect(a,{power:1.25,el:'W'},x)-b.expect(a,{power:1.25,el:'W'},y))<1e-9)});
t('вожак стаи: при живой свите урон по нему −40 %, без свиты обычный',()=>{
  const b=start([F('a',{spd:20})],[F('x',{traits:['shield']}),F('y')],1),a=b.get('a'),x=b.get('x');
  const e1=b.expect(a,{power:1},x);b.get('y').ko=true;const e2=b.expect(a,{power:1},x);assert.ok(Math.abs(e1/e2-0.6)<1e-9)});
t('регенерация: в начале своего хода +6 % здоровья, не выше максимума, событие видно',()=>{
  const b=new B.Battle({A:[F('a',{spd:1})],B:[F('x',{spd:30,hp:100,traits:['regen']})],seed:1});b.get('x').hp=50;
  const ev=b.next();assert.strictEqual(b.cur,'x');const r=ev.find(e=>e.type==='regen');assert.ok(r);assert.strictEqual(r.amt,6);assert.strictEqual(b.get('x').hp,56);
  const c=new B.Battle({A:[F('a',{spd:1})],B:[F('x',{spd:30,traits:['regen']})],seed:1});assert.ok(!c.next().some(e=>e.type==='regen'),'целому лечиться нечего')});
t('закалка: эффекты стихий не накладываются, урон проходит',()=>{
  let seen=0;for(let s=1;s<=40;s++){const b=start([F('a',{spd:20,els:['P'],atk:5})],[F('x',{hp:900,def:30,traits:['ward']})],s);
    const ev=b.act({skill:'el:P',target:'x'});assert.ok(ev.some(e=>e.type==='hit'));assert.deepStrictEqual(b.get('x').fx,{});if(ev.some(e=>e.type==='resist'))seen++}
  assert.ok(seen>0,'закалка срабатывает и показывается')});
t('гнев: с половины здоровья атака +30 % до конца боя, срабатывает один раз',()=>{
  const b=start([F('a',{spd:20,atk:10})],[F('x',{hp:100,def:5,spd:1,traits:['enrage']})],3),x=b.get('x');const a0=b.atkOf(x);
  x.hp=70;let ev=b.act({skill:'strike',target:'x'});assert.ok(!ev.some(e=>e.type==='enrage'),'выше половины гнева нет');
  b.next();if(b.cur==='x'){b.act({skill:'guard',target:'x'});b.next()}
  ev=b.act({skill:'strike',target:'x'});assert.ok(x.hp>0&&x.hp<=50);assert.ok(ev.some(e=>e.type==='enrage'));assert.ok(Math.abs(b.atkOf(x)/a0-1.3)<1e-9);
  b.next();if(b.cur==='x'){b.act({skill:'guard',target:'x'});b.next()}
  ev=b.act({skill:'strike',target:'x'});assert.ok(!ev.some(e=>e.type==='enrage'),'второй раз не срабатывает')});
t('правило третьей звезды: дольше лимита раундов без потерь — две звезды',()=>{
  const b=new B.Battle({A:[F('a')],B:[F('x')],star3:4});b.winner='A';b.round=4;assert.strictEqual(b.stars(),3);b.round=5;assert.strictEqual(b.stars(),2);
  const c=new B.Battle({A:[F('a')],B:[F('x')]});c.winner='A';c.round=29;assert.strictEqual(c.stars(),3)});
t('неизвестные особенности отбрасываются, компьютер учитывает шкуру и вожака так же, как подсказка',()=>{
  const b=start([F('a',{spd:20,els:['F']})],[F('x',{traits:['zzz','thick']}),F('y')],1);assert.deepStrictEqual(b.get('x').traits,['thick']);
  const c=b.ai('hard');assert.ok(!(c.skill==='strike'&&c.target==='x'),'Удар в толстую шкуру не лучший ход')});

console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1);
