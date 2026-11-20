// Run with node phagi/tests/oplot-combat.cjs. Only the test VM exposes a read-only battle snapshot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'oplot.html'), 'utf8');
function section(first, last) {
  const from = html.indexOf(first), to = html.indexOf(last, from);
  assert.ok(from >= 0 && to > from, 'Missing shipped section: ' + first);
  return html.slice(from, to);
}
const genetics = section('const GAME_ELEMENTS', 'const STRUCT');
const combatModule = html.match(/\/\* Battle simulation uses tile coordinates\.[\s\S]*?^\}\)\(\);/m);
assert.ok(combatModule,'Missing shipped Battle module');
const combat = combatModule[0];
const battleAPI = 'return {draw,tick,tap,action,controls};';
assert.ok(combat.includes(battleAPI));
const layout = require('../oplot-layout.js');
const context = {window: {OplotLayout:layout}, Art: {point: (x,y) => ({x,y})}};
vm.runInNewContext(genetics + '\n' + combat.replace(battleAPI,
  'return {draw,tick,tap,action,controls, inspect:()=>({party,enemy,structures,objectives,fury,gridWidth,gridHeight,rally,sparks,time,displayHp})};'), context);
const {Battle, GAME_SPECIES} = context.window;
const species = mask => GAME_SPECIES.find(s => s.mask === mask).id;
const studentTeam = [1,2,4].map(species);
const eliteTeam = [63,63,47,62].map(species);
const fortress = {buildings:[{type:'keep',x:4,y:4,level:1}]};
const inside = (unit, tile) => Math.abs(unit.x-tile.x)<.5 && Math.abs(unit.y-tile.y)<.5;
const living = list => list.filter(o => o.hp>0);
const health = list => list.reduce((sum,o) => sum + o.hp, 0);

// Issue the same orders at the same game times with different numbers of display frames.
function speedTrial(mode,speeds){
  const finishes=[],sounds=[];
  const squad=studentTeam.map(species=>({species,level:8}));
  const game=Battle.start(mode,1,fortress,squad,{finish:r=>finishes.push(r),sound:s=>sounds.push(s)});
  if(mode==='raid'||mode==='boss')squad.forEach(()=>game.action('deploy',0));
  const snapshots=[];
  for(let block=0;block<450&&!finishes.length;block++){
    const speed=speeds[block%speeds.length];
    if(mode==='arena'&&block%3===0)game.action('strike');
    for(let i=0;i<4;i+=speed)game.tick(.1,speed);
    if(block===1||block===9){
      const {time,party,enemy,structures,fury}=game.inspect();
      assert.ok(Math.abs(time-(block+1)*.4)<1e-8);
      snapshots.push([time,fury,...[...party,...enemy,...structures].map(u=>[u.x,u.y,u.hp])]);
    }
  }
  game.tick(.1,4);
  assert.equal(finishes.length,1,mode+' must settle exactly once');
  return {snapshots,sounds,finishes};
}
for(const mode of ['raid','boss','defense','arena']){
  const normal=speedTrial(mode,[1]);
  for(const speeds of [[2],[4],[4,1,2]])assert.deepEqual(speedTrial(mode,speeds),normal,mode+' speed '+speeds);
}

function raid(stage, team, level, enchant, side, order) {
  let result;
  const squad = team.map(species => ({species,level,enchant}));
  const game = Battle.start('raid',stage,fortress,squad,{finish:r=>{assert.equal(result,undefined);result=r;}});
  squad.forEach(()=>game.action('deploy',side));
  const {structures,objectives} = game.inspect();
  assert.equal(new Set(structures.map(b=>b.x+','+b.y)).size,structures.length);
  assert.ok(objectives.every(b => b.type!=='wall'));
  for(let frame=0;frame<1205&&!result;frame++){
    if(frame%12===0 && order){
      const target = living(objectives).find(b=>order==='keep'?b.type==='keep':['archer','spire','cannon'].includes(b.type));
      if(target)game.tap(target.x,target.y,10,10);
    }
    if(game.inspect().fury>=100)game.action('fury');
    game.tick(1/12);
  }
  assert.ok(result,'Raid '+stage+' timed out');
  return result.stars;
}

assert.equal(Battle.stages.length,30);
assert.equal(new Set(Battle.stages).size,30);
for(let stage=1;stage<=6;stage++){
  const scores=[];
  const preview=Battle.start('raid',stage,fortress,[],{}).inspect();
  const walls=preview.structures.filter(b=>b.type==='wall');
  assert.ok(walls.length>=10 && new Set(walls.map(w=>w.x)).size>=3 && new Set(walls.map(w=>w.y)).size>=3);
  for(let side=0;side<4;side++)for(const order of ['', 'keep','towers']){
    scores.push(raid(stage,studentTeam,1,0,side,order));
  }
  if(stage===1){assert.ok(scores.includes(3));assert.ok(scores.some(s=>s<3));}
  else if(stage===2)assert.ok(Math.max(...scores)<3);
  else assert.equal(Math.max(...scores),0,'Starter dragons swept stage '+stage);
}
assert.equal(raid(6,eliteTeam,30,5,0,''),3,'A trained team should be able to finish the first chapter');

// Every sequel island has its own map. Test the same entry directions players can use.
const layouts=new Set();
let previousHealth=0,previousFire=0;
const battery={archer:5.2/1.1,cannon:9/1.85,spire:6.5/1.45};
for(let stage=6;stage<=Battle.stages.length;stage++){
  const {structures}=Battle.start('raid',stage,fortress,[],{}).inspect();
  assert.equal(structures.filter(b=>b.type==='keep').length,1);
  const layoutKey=structures.map(b=>b.x+','+b.y+':'+b.type).sort().join('|');
  assert.ok(!layouts.has(layoutKey),'Repeated map at '+stage);layouts.add(layoutKey);
  const fortHealth=health(structures);
  const fire=structures.reduce((sum,b)=>sum+(battery[b.type]||0)*(1+.22*(b.level-1))*b.attackScale,0);
  assert.ok(fortHealth>previousHealth&&fire>previousFire,'Growing fort budget at '+stage);
  previousHealth=fortHealth;previousFire=fire;
  const scores=[];
  for(const side of [0,1,2,3])for(const order of ['', 'keep','towers'])scores.push(raid(stage,eliteTeam,50,5,side,order));
  assert.ok(scores.includes(3),'Three stars attainable at '+stage);
  if(stage===30){
    assert.ok(scores.includes(0),'The final still punishes a bad approach');
    for(const side of [0,1,2,3])for(const order of ['', 'keep','towers'])assert.equal(raid(stage,eliteTeam,30,5,side,order),0);
  }
}
for(const [index,chapter] of Battle.chapters.entries()){
  if(!index)continue;
  const first=index*6+1,early=Object.fromEntries(Array.from({length:first-1},(_,i)=>[i+1,1]));
  const record=Object.fromEntries(Array.from({length:first-1},(_,i)=>[i+1,3]));
  assert.match(Battle.campaignLock(first,early,12),/звёзды/);
  assert.match(Battle.campaignLock(first,record,chapter.keep-1),/цитадель/);
  assert.equal(Battle.campaignLock(first,record,chapter.keep),'');
  assert.equal(Battle.campaignLock(first-1,record,1),'','Previous victories remain available');
  assert.ok(Battle.campaignLock(first+1,record,12));
}
const launch=1800000000000;
for(const [stage,hours] of [[12,6],[18,12],[24,18]]){
  const record=Object.fromEntries(Array.from({length:stage},(_,i)=>[i+1,3]));
  const scouts=Battle.dispatchScouts(stage,launch);
  assert.equal(scouts.readyAt-launch,hours*3600000);
  assert.match(Battle.campaignLock(stage+1,record,12,scouts,scouts.readyAt-1),/разведки/);
  assert.equal(Battle.campaignLock(stage+1,record,12,scouts,scouts.readyAt),'');
  assert.equal(Battle.campaignLock(stage,record,12,scouts,launch),'');
}
for(const stage of [1,6,13,30])assert.equal(Battle.dispatchScouts(stage,launch),null);
const payout=(previous,stars)=>Object.values(Battle.campaignPayout({stage:6,win:stars>0,stars,gold:100,berries:60},previous,{victory:15,perStage:3,perStar:5}));
assert.deepEqual(payout(0,2),[200,110,43]);
assert.deepEqual(payout(2,3),[50,30,5]);
assert.deepEqual(payout(3,1),[20,12,0]);
assert.deepEqual(payout(0,0),[0,0,0]);

function fencedBase(gap) {
  const buildings=[{type:'keep',x:4,y:4,level:10000}];
  for(let x=2;x<=7;x++)for(let y=2;y<=7;y++){
    if((x===2||x===7||y===2||y===7)&&!gap?.(x,y))buildings.push({type:'wall',x,y,level:10000});
  }
  return {buildings};
}
function invasion(wave,base) {
  const game=Battle.start('defense',wave,base,[],{});
  const walls=game.inspect().structures.filter(b=>b.type==='wall');
  let groundInside=false,groundCrossed=false,dragonInside=false,dragonCrossed=false,dragonLevel=0;
  for(let i=0;i<25*30;i++){
    game.tick(1/30);
    for(const u of living(game.inspect().enemy)){
      const entered=u.x>2.505&&u.x<6.495&&u.y>2.505&&u.y<6.495;
      const crossed=walls.some(w=>w.hp>0&&inside(u,w));
      if(u.kind==='goblin'){groundInside||=entered;groundCrossed||=crossed;}
      else{dragonLevel=u.level;dragonInside||=entered;dragonCrossed||=crossed;}
    }
  }
  assert.ok(walls.every(b=>b.hp>0));
  return {groundInside,groundCrossed,dragonInside,dragonCrossed,dragonLevel};
}
const grounded=invasion(28,fencedBase()), flying=invasion(29,fencedBase());
assert.deepEqual(grounded,{groundInside:false,groundCrossed:false,dragonInside:false,dragonCrossed:false,dragonLevel:20});
assert.deepEqual(flying,{groundInside:false,groundCrossed:false,dragonInside:true,dragonCrossed:true,dragonLevel:21});
const gate=invasion(28,fencedBase((x,y)=>y===7&&(x===4||x===5)));
assert.equal(gate.dragonInside,true);assert.equal(gate.dragonCrossed,false);

function raidWall(level) {
  const g=Battle.start('raid',1,fortress,[{species:species(1),level}],{});
  const {party,structures}=g.inspect(), fighter=party[0], wall=structures.find(b=>b.type==='wall'&&b.x===2&&b.y===4);
  const keep=structures.find(b=>b.type==='keep');
  g.action('deploy',0);g.tap(keep.x,keep.y,10,10);
  let crossed=false,attacked=false;
  for(let i=0;i<280&&fighter.hp>0;i++){
    g.tick(.025);
    if(wall.hp>0&&inside(fighter,wall))crossed=true;
    if(wall.hp<wall.maxHp)attacked=true;
    if(fighter.x>2.51)break;
  }
  return {crossed,attacked,passed:fighter.x>2.51};
}
assert.deepEqual(raidWall(20),{crossed:false,attacked:true,passed:true});
assert.deepEqual(raidWall(21),{crossed:true,attacked:false,passed:true});

const common=Battle.profile(species(1),10);
const legendary=Battle.profile(species(63),10);
assert.ok(legendary.hp>common.hp && legendary.damage>common.damage);
const trained=Battle.profile(species(63),10,5);
assert.equal(trained.hp,legendary.hp);assert.equal(trained.damage,legendary.damage);
for(const property of ['extra','restore','amplify','activeBonus','furyPower']){
  let last=-1;
  for(let enchant=0;enchant<=5;enchant++){
    const value=Battle.profile(species(63),10,enchant).ability[property];
    assert.ok(value>last,property+' stopped improving at '+enchant);last=value;
  }
}
// Every hatchable species keeps one named signature and one leading element.
const signatures=new Set();
for(const sp of GAME_SPECIES){
  const a=Battle.profile(sp.id,10,2).ability;
  assert.ok(a.name&&!signatures.has(a.name));signatures.add(a.name);
  assert.equal(a.leadElement,sp.element);assert.ok(sp.elements.includes(a.leadElement));
  for(const specialty of ['focus','area']){
    const stats=Battle.profile(sp.id,10,2,specialty);
    assert.equal(stats.ability.name,a.name);assert.equal(stats.ability.specialty,specialty);
    assert.equal(stats.ability.focusDamage,Math.round(stats.damage*(1+2*.18)*.40));
    assert.equal(stats.ability.splashDamage,Math.round(stats.damage*(1+2*.18)*.55));
  }
}
assert.equal(signatures.size,63);
function academyDuel(specialty){
  // Earth protects the caster. Its inherited passive does not deal further damage to foes.
  const attacker={species:species(16),level:9,enchant:2,specialty};
  const game=Battle.start('arena',16,fortress,[attacker],{});
  game.action('strike');
  for(let i=0;i<24;i++)game.tick(.04);
  game.action('target',1);
  const {enemy,party,sparks,displayHp}=game.inspect(),before=enemy.map(e=>e.hp);
  game.action('magic');
  const spell=party[0].ability,shot=sparks.findLast(s=>s.source===party[0]&&s.attack?.kind==='ultimate');
  assert.ok(shot);assert.equal(shot.attack.species,attacker.species);assert.equal(shot.attack.specialty,specialty);
  assert.ok(party[0].shield>0,'Earth passive must survive academy training');
  const losses=enemy.map((e,i)=>before[i]-e.hp);
  assert.equal(displayHp(enemy[1]),before[1],'Health bar must wait for the visible projectile');
  for(let i=0;i<16;i++)game.tick(.04);
  assert.equal(displayHp(enemy[1]),enemy[1].hp,'Visible health must drop on impact');
  const affinity=enemy.map(e=>e.elements.some(to=>context.window.strongAgainst(4,to))?1.5:1);
  return {losses,affinity,spell};
}
const plainCast=academyDuel(''),focusedCast=academyDuel('focus'),wideCast=academyDuel('area');
for(let i=0;i<3;i++){
  const bonus=i===1?Math.round(plainCast.spell.focusDamage*plainCast.affinity[i]):0;
  const splash=i===1?0:Math.round(plainCast.spell.splashDamage*plainCast.affinity[i]);
  assert.equal(focusedCast.losses[i]-plainCast.losses[i],bonus,'Focus bonus landed on the wrong arena slot');
  assert.equal(wideCast.losses[i]-plainCast.losses[i],splash,'Sweep bonus landed on the wrong arena slot');
}
function duelDamage(enchant) {
  const team=Array.from({length:3},()=>({species:species(1),level:5,enchant}));
  const game=Battle.start('arena',5,fortress,team,{});
  game.action('target',0);game.action('strike');
  for(let i=0;i<30;i++)game.tick(.04);
  assert.ok(game.controls().buttons.some(b=>b.id==='magic'&&!b.disabled));
  const foes=game.inspect().enemy, before=health(foes);
  game.action('magic');
  return before-health(foes);
}
assert.ok(duelDamage(5)>duelDamage(0),'The arena special did not benefit from training');
function fieldDamage(mode,enchant,specialty='') {
  const squad=[{species:species(1),level:12,enchant,specialty}];
  const base=mode==='defense'?{buildings:[{type:'keep',x:4,y:4,level:50}]}:fortress;
  const game=Battle.start(mode,mode==='defense'?14:2,base,squad,{});
  if(mode!=='defense')game.action('deploy',mode==='boss'?2:0);
  let special=0,furyHit=0;
  for(let i=0;i<1800 && (!special||!furyHit);i++){
    const {party,enemy,structures,fury}=game.inspect();
    const targets=mode==='defense'?enemy:structures.concat(enemy);
    // Isolate measured spell damage from the earlier volleys of a long-range battery.
    party[0].hp=party[0].maxHp;
    if(mode==='defense'){
      structures[0].hp=structures[0].maxHp;
      for(const invader of living(enemy))invader.hp=invader.maxHp=10000;
    }
    const before=health(targets),strikes=party[0].strikes;
    if(fury>=100&&!furyHit){
      game.action('fury');furyHit=before-health(targets);
      const effect=game.inspect().sparks.findLast(e=>e.source===party[0]&&e.attack?.kind==='ultimate'&&e.t===0);
      assert.ok(effect,mode+' fury should emit the caster signature');assert.equal(effect.attack.specialty,specialty);
    }else{
      game.tick(.035);
      if(strikes>0&&party[0].strikes===0&&!special){
        const effect=game.inspect().sparks.findLast(e=>e.source===party[0]&&e.attack?.kind==='ultimate'&&e.t===0);
        assert.ok(effect,mode+' automatic ability should emit the caster signature');assert.equal(effect.attack.specialty,specialty);
        special=before-health(targets);
      }
    }
  }
  return {special,furyHit};
}
for(const mode of ['raid','defense','boss']){
  const base=fieldDamage(mode,0),enhanced=fieldDamage(mode,5);
  for(const specialty of ['focus','area']){
    const qualified=fieldDamage(mode,0,specialty);
    assert.ok(qualified.special>=base.special&&qualified.furyHit>=base.furyHit,mode+' '+specialty+' weakened an attack');
    assert.ok(qualified.special>base.special||qualified.furyHit>base.furyHit,mode+' '+specialty+' never landed its training bonus');
  }
  assert.ok(base.special>0 && enhanced.special>base.special,mode+' passive: '+JSON.stringify([base,enhanced]));
  assert.ok(base.furyHit>0 && enhanced.furyHit>base.furyHit,mode+' fury: '+JSON.stringify([base,enhanced]));
}
// The guardian's dodge order only lifts deployed dragons that have learned to fly.
const mixed = Battle.start('boss',1,fortress,[{species:0,level:20},{species:1,level:21}],{});
mixed.action('deploy',0);mixed.action('deploy',0);mixed.action('evade');
assert.equal(mixed.inspect().party[0].air,0);
assert.ok(mixed.inspect().party[1].air>0);
const young = Battle.start('boss',1,fortress,[{species:0,level:20}],{});
young.action('deploy',0);young.action('evade');
assert.equal(young.inspect().party[0].air,0);
assert.ok(!young.controls().buttons.some(button=>button.id==='evade'));
const artModule=section('/* All island art','/* Battle simulation uses tile coordinates.');
vm.runInNewContext(artModule.replace('Object.freeze({island,point','Object.freeze({objectList,roostLayout,island,point'),context);
const art=context.window.Art;
const residents=Array.from({length:64},(_,i)=>({id:'resident-'+i,species:i%63,level:1+i%30}));
const inland=art.roostLayout({gridSize:33,dragons:residents,buildings:[]});
assert.ok(inland.every(p=>p.x>=2&&p.y>=2&&p.x<31&&p.y<31),'Keep residents and their wings in view at the shoreline');
for(const occupied of [false,true]){
  const buildings=occupied?Array.from({length:100},(_,i)=>({id:'tile-'+i,type:'wall',x:i%10,y:Math.floor(i/10)})):[];
  const island={gridSize:10,homeView:true,dragons:residents,buildings};
  const places=art.roostLayout(island);
  assert.equal(new Set(places.map(p=>p.x+','+p.y)).size,residents.length);
  const drawn=art.objectList(island,390,530,1).filter(o=>o.kind==='dragon');
  assert.deepEqual(new Set(drawn.map(o=>o.item.id)),new Set(residents.map(d=>d.id)));
  assert.equal(art.objectList({...island,dragons:residents.slice(1)},390,530,1).filter(o=>o.kind==='dragon').length,63);
}
const garrison=[{id:'ordinary',species:0,level:1},{id:'rare',species:5,level:10},
  {id:'tie-b',species:0,level:12},{id:'tie-a',species:0,level:12},
  {id:'specialist',species:0,level:12,enchant:3,specialty:'area'},{id:'elder',species:13,level:24}];
const expectedGuard=['elder','specialist','rare','tie-a','tie-b'];
assert.deepEqual(Array.from(Battle.defenders(garrison),d=>d.id),expectedGuard);
assert.deepEqual(Array.from(Battle.start('defense',1,{...fortress,dragons:garrison},[garrison[0]]).inspect().party,d=>d.id),expectedGuard);
assert.equal(Battle.defenders(garrison.slice(0,2)).length,2);

for(const [cols,rows] of [[11,10],[16,16]]){
  const n=Math.max(cols,rows);
  const farm={id:'edge-farm',type:'farm',x:cols-1,y:rows-1,level:1,ready:true};
  const phantom={...farm,id:'out-of-bounds',x:0,y:rows};
  const map={gridSize:n,gridWidth:cols,gridHeight:rows,buildings:[farm,phantom],dragons:[]};
  for(const [w,h] of [[366,437],[827,573]]){
    for(let x=0;x<cols;x++)for(let y=0;y<rows;y++){
      const pt=art.point(x,y,w,h,n),hit=art.cell(pt.x,pt.y,w,h,n);
      assert.ok(hit&&hit.x===x&&hit.y===y&&pt.x>0&&pt.y>0&&pt.x<w&&pt.y<h);
    }
    const top=art.bubblePoint(farm,w,h,0,n),voidBubble=art.bubblePoint(phantom,w,h,0,n);
    assert.equal(art.hit(top.x,top.y,w,h,map,0)?.id,farm.id);
    assert.equal(art.hit(voidBubble.x,voidBubble.y,w,h,map,0),null);
  }
  const corner={type:'keep',x:cols-2,y:rows-2,level:10000};
  const ring=[];
  for(let x=cols-3;x<cols;x++)for(let y=rows-3;y<rows;y++){
    if(x!==corner.x||y!==corner.y)ring.push({type:'wall',x,y,level:10000});
  }
  const base={gridSize:n,gridWidth:cols,gridHeight:rows,buildings:[corner,...ring]};
  for(const mode of ['raid','arena','boss']){
    const fixed=Battle.start(mode,1,base,[],{}).inspect();
    assert.equal(fixed.gridWidth,10);assert.equal(fixed.gridHeight,10);
  }
  const defense=Battle.start('defense',28,base,[],{});
  assert.equal(defense.inspect().gridWidth,cols);assert.equal(defense.inspect().gridHeight,rows);
  defense.tap(cols-1,0,10,10);assert.equal(defense.inspect().rally.x,cols-1);
  defense.tap(0,rows-1,10,10);assert.equal(defense.inspect().rally.y,rows-1);
  const order=defense.inspect().rally;
  defense.tap(0,rows,10,10);assert.equal(defense.inspect().rally,order,'An order hit an unopened row');
  const sides=new Set(),seen=new Set();
  for(let i=0;i<40*30;i++){
    defense.tick(1/30);
    const {enemy,structures}=defense.inspect();
    for(const u of living(enemy)){
      if(!seen.has(u)){
        seen.add(u);
        if(u.x<0)sides.add('west');else if(u.x>cols-1)sides.add('east');
        else if(u.y<0)sides.add('north');else if(u.y>rows-1)sides.add('south');
        else assert.fail('Invader spawned inside the actual island');
      }
      assert.ok(!structures.some(b=>b.type==='wall'&&b.hp>0&&inside(u,b)),'Ground unit crossed a corner wall');
    }
  }
  assert.equal(sides.size,4,'All four actual edges should launch invaders');
  assert.equal(defense.inspect().structures[0].hp,defense.inspect().structures[0].maxHp);
}
// A tap belongs to the occupied ground tile, including the far corner of a
// large keep right next to another building. Stored and moving originals vanish.
for(const [cols,rows] of [[33,33],[33,35],[36,33],[55,55]]){
  const buildings=[
    {id:'keep',type:'keep',x:2,y:3,level:8},
    {id:'vault',type:'goldstore',x:7,y:3,level:4},
    {id:'school',type:'academy',x:2,y:8,level:7},
    {id:'stored',type:'cannon',x:null,y:null,level:2,stowed:true}
  ];
  const layoutState={layoutVersion:2,gridSize:cols,gridWidth:cols,gridHeight:rows,buildings,dragons:[]};
  for(const [w,h] of [[366,437],[827,573]]){
    const picked=(x,y,state=layoutState)=>{
      const p=art.point(x,y,w,h,cols);
      return art.hit(p.x,p.y,w,h,state)?.id??null;
    };
    for(const b of buildings)for(const cell of layout.cells(b)){
      assert.equal(picked(cell.x,cell.y),b.id,'Incorrect footprint hit on '+b.id);
    }
    assert.equal(picked(0,0,{...layoutState,buildings:[buildings[3]]}),null);
    const ghost={...buildings[0],x:13,y:13,valid:true};
    const moving={...layoutState,buildings:[buildings[0]],placementPreview:ghost};
    assert.equal(picked(2,3,moving),null);
    assert.equal(picked(13,13,moving),null,'The ghost cannot intercept the next placement');
    assert.equal(picked(13,13,{...layoutState,buildings:[ghost,...buildings.slice(1)]}),'keep');
  }
  const actual=Battle.start('defense',1,layoutState,[],{}).inspect();
  assert.equal(actual.gridWidth,cols);assert.equal(actual.gridHeight,rows);
  assert.deepEqual(Array.from(actual.structures,b=>[b.id,b.x,b.y,b.span]),
    [['keep',4,5,5],['vault',8.5,4.5,4],['school',3.5,9.5,4]]);
  for(const mode of ['raid','boss','arena']){
    const authored=Battle.start(mode,1,layoutState,[],{}).inspect();
    assert.equal(authored.gridWidth,10);assert.equal(authored.gridHeight,10);
    assert.ok(authored.structures.every(b=>b.span===1));
  }
}

function newDefense(wave,buildings,squad=[]){
  return Battle.start('defense',wave,{layoutVersion:2,gridSize:35,buildings},squad,{});
}
const citadel={id:'castle',type:'keep',level:10000,x:15,y:15};
const siege=newDefense(1,[citadel]),exposedFaces=new Set();
for(let frame=0;frame<50*30;frame++){
  siege.tick(1/30);
  const {enemy,sparks,structures}=siege.inspect(),building=structures[0];
  for(const u of living(enemy)){
    assert.ok(!(Math.abs(u.x-building.x)<2.5&&Math.abs(u.y-building.y)<2.5),
      'Ground attacker walked through the keep');
  }
  for(const shot of sparks.filter(e=>e.kind==='attack'&&e.target===building)){
    const dx=shot.tx-building.x,dy=shot.ty-building.y;
    assert.ok(Math.abs(dx)<=2&&Math.abs(dy)<=2);
    if(Math.abs(dx)===2)exposedFaces.add(dx<0?'west':'east');
    if(Math.abs(dy)===2)exposedFaces.add(dy<0?'north':'south');
  }
}
assert.ok(exposedFaces.size>=3,'Hits should land on the approached sides of the keep');

const ramparts=[];
for(let x=11;x<=23;x++)for(let y=11;y<=23;y++){
  if(x===11||x===23||y===11||y===23)ramparts.push({type:'wall',id:x+','+y,x,y,level:10000});
}
for(const wave of [28,29]){
  const run=newDefense(wave,[citadel,...ramparts]);
  const walls=run.inspect().structures.filter(b=>b.type==='wall');
  let dragonCrossed=false,hitWall=false;
  for(let i=0;i<28*30;i++){
    run.tick(1/30);
    const {enemy,sparks}=run.inspect();
    for(const u of living(enemy)){
      const crosses=walls.some(b=>inside(u,b));
      if(u.kind==='goblin'||u.level<=20)assert.ok(!crosses,'A ground attacker crossed a standing wall');
      else if(crosses)dragonCrossed=true;
    }
    hitWall||=sparks.some(e=>e.target?.type==='wall'&&e.kind==='attack');
  }
  assert.ok(walls.every(b=>b.hp>0));assert.equal(hitWall,true);
  assert.equal(dragonCrossed,wave===29);
}
const guards=newDefense(8,[citadel,
  {id:'vault',type:'goldstore',x:20,y:16,level:10000},
  {id:'farm',type:'farm',x:12,y:17,level:10000}
],[{species:1,level:12},{species:2,level:8}]);
guards.tap(17,17,10,10);
const occupying=(b,p)=>Math.abs(b.x-p.x)<b.half+.499&&Math.abs(b.y-p.y)<b.half+.499;
assert.ok(!guards.inspect().structures.some(b=>occupying(b,guards.inspect().rally)),
  'An order on the keep should guide guards to an accessible tile');
for(let i=0;i<25*30;i++){
  guards.tick(1/30);
  const {party,structures}=guards.inspect();
  for(const u of living(party))assert.ok(!structures.some(b=>b.hp>0&&occupying(b,u)),'A guard phased through a foundation');
}
// The actual defense tick fires from the centre. Keep both a wall and a farm on the firing lane.
for(const type of Object.keys(layout.defenses)){
  const game=Battle.start('defense',1,{layoutVersion:2,buildings:[
    {id:'keep',type:'keep',x:23,y:23},{id:'tower',type,x:6,y:10},
    {id:'wall',type:'wall',x:11,y:11},{id:'farm',type:'farm',x:13,y:10}
  ]},[],{});
  for(let t=0;t<30;t++)game.tick(1/30);
  const {enemy,structures}=game.inspect(),tower=structures.find(b=>b.id==='tower');
  const radius=layout.towerReach(type,1,2);
  Object.assign(enemy[0],{kind:'shadow',level:type==='skybow'?21:1,x:tower.x+radius,y:tower.y,hp:1000,maxHp:1000,speed:0});
  tower.cd=0; game.tick(.01);
  assert.ok(enemy[0].hp<1000,type+' reaches a target on the circle beyond obstacles');
  Object.assign(enemy[0],{x:tower.x+radius,y:tower.y+1,hp:1000});tower.cd=0;game.tick(.01);
  assert.equal(enemy[0].hp,1000,type+' does not reach beyond its circle');
}
console.log('PASS campaign, arena, flight, enchantments, legacy 10–16 and compact 33–53 and legacy 55 grids, footprint picking, moving, four-sided defense and pathfinding');
