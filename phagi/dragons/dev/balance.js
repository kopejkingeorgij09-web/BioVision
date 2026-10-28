/* Баланс-прогон похода: node phagi/dragons/dev/balance.js [боёв на точку, по умолчанию 80] [--md файл]
   Для каждого из 32 узлов играет компьютер за обе стороны (игрок «средний», противник — сложность узла) и считает
   долю побед и средние звёзды у нескольких команд игрока без Света и Тьмы:
   - «лучший состав»: перебор всех команд из восьми обычных драконов (пять простых стихий и три гибрида), как игрок, который пробует составы;
   - три постоянные команды: Огонь+Вода+Земля, Воздух+Флора+Огонь, гибриды Огонь/Вода + Земля/Флора + Воздух/Огонь.
   В бои на двоих и одного каждая команда берёт своих лучших под противника. Уровни: рекомендуемый и на два выше (не выше 20).
   Генотип драконов игрока средний: рога есть, булавы нет, крылья обычные. Это предположение, а не гарантия:
   настоящий игрок ещё и попадает Точным ударом (+25 %), и ошибается. */
'use strict';
const path=require('path'),fs=require('fs'),dir=path.join(__dirname,'..');
const C=require(dir+'/campaign.js'),D=require(dir+'/genetics.js'),B=require(dir+'/battle.js');
global.MORPH=require(dir+'/morph.js');const SH=require(dir+'/shape.js'),AN=require(dir+'/anim.js'),ST=require(dir+'/stats.js');
const cache=new Map();
function spec(id,g,lvl,traits){const k=JSON.stringify([g,lvl]);let c=cache.get(k);
  if(!c){const ph=D.phenotype(g),M=MORPH.morph(ph,lvl),G=SH.build(M),P=AN.profile(M,G.rig),s=ST.of(ph,lvl,P);c={els:ph.breath==='element'?ph.elements:[],s};cache.set(k,c)}
  return {id,lvl,els:c.els,hp:c.s.hp,atk:c.s.atk,def:c.s.def,spd:c.s.spd,traits:traits||[]}}
const PB={S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',sex:'M',M:'m/m',N:'N/N'};
const POOL=['F/e','W/e','T/e','A/e','P/e','F/W','T/P','A/F'];
const TEAMS=[{k:'mix',name:'лучший состав',from:POOL},{k:'fwt',name:'Огонь+Вода+Земля',from:['F/e','W/e','T/e']},
  {k:'apf',name:'Воздух+Флора+Огонь',from:['A/e','P/e','F/e']},{k:'hyb',name:'гибриды',from:['F/W','T/P','A/F']}];
const mine=(E,L,i)=>spec('p'+i+E,D.make(Object.assign({},PB,{E})),L);
/* выбор команды как по подсказкам подготовки: сколько противников мой дракон бьёт сильной стихией минус сколько бьют его */
function pick(from,foes,max,L){
  const sc=E=>{const d=mine(E,L,0);return foes.reduce((a,f)=>{const o=d.els.length?Math.max(...d.els.map(e=>B.mult(e,f.els))):1,
    i=f.els.length?Math.max(...f.els.map(e=>B.mult(e,d.els))):1;return a+(o-1)*2-(i-1)*1.5},0)+d.hp/400};
  return from.slice().sort((a,b)=>sc(b)-sc(a)).slice(0,max).map((E,i)=>mine(E,L,i))}
/* «лучший состав»: перебор всех команд нужного размера из восьми драконов на коротком прогоне, как игрок, который пробует составы */
const combos=(a,k)=>k===0?[[]]:a.flatMap((x,i)=>combos(a.slice(i+1),k-1).map(c=>[x,...c]));
function best(node,foes,L){let top=null,tv=-1;
  combos(POOL,node.team.max).forEach(c=>{const A=c.map((E,i)=>mine(E,L,i));let v=0;
    for(let s=1;s<=12;s++){const b=B.simulate(A,foes,{seed:s*104729+L,aiA:'normal',aiB:node.ai,star3:node.stars.r3});if(b.winner==='A')v+=1+b.stars()/10}
    if(v>tv){tv=v;top=A}});return top}
function run(node,team,L,n){
  const foes=node.foes().map(f=>spec('x'+f.id,f.genome,f.lvl,f.traits)),A=team.k==='mix'?best(node,foes,L):pick(team.from,foes,node.team.max,L);
  let w=0,st=0,rounds=0;
  for(let s=1;s<=n;s++){const b=B.simulate(A,foes,{seed:s*7919+L,aiA:'normal',aiB:node.ai,star3:node.stars.r3});if(b.winner==='A'){w++;st+=b.stars()}rounds+=b.round}
  return {win:w/n,stars:w?st/w:0,rounds:rounds/n,team:A.map(d=>d.els.join('')||'дым')}}
function balance(n){
  return C.NODES.map(node=>{const L0=node.rec,L2=Math.min(20,node.rec+2),r={id:node.id,node,L0,L2,at:{}};
    TEAMS.forEach(t=>{r.at[t.k]={rec:run(node,t,L0,n),up:run(node,t,L2,n)}});return r})}
const pc=v=>Math.round(v*100)+' %';
const TR={thick:'шкура',shield:'вожак',regen:'регенерация',ward:'закалка',enrage:'гнев'};
const EL={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
function foeText(node){return node.foes().map(f=>{const ph=D.phenotype(f.genome),e=ph.breath==='element'?ph.elements.map(x=>EL[x]).join('/'):'дым';
  return `${f.name} ${f.lvl} (${e}${f.traits.length?', '+f.traits.map(t=>TR[t]).join(', '):''})`}).join('; ')}
function md(rows,n){
  const R=C.REGIONS.map(r=>r.name);
  let out=`# Поход драконов: 32 узла и баланс-прогон\n\nСгенерировано \`node phagi/dragons/dev/balance.js ${n} --md\`. Боёв на каждую точку: ${n}. Игрок «средний» компьютер, противник — сложность узла. `+
    `Команды игрока без Света и Тьмы, генотип средний (рога есть, булавы нет). «Лучший состав» — лучшая команда под бой из восьми драконов (пять простых стихий и гибриды Огонь/Вода, Земля/Флора, Воздух/Огонь), найденная перебором. Постоянные команды в боях на двоих и одного берут своих лучших под противника. `+
    `В клетке доля побед на рекомендуемом уровне → на два уровня выше (не выше 20). Точный удар (+25 %) в прогоне не используется, у живого игрока шансы выше.\n\n`+
    `Награда за все узлы одна: звёзды. Звёзды по умолчанию: 3 без потерь, 2 если выбыл один, 1 за остальные победы. У боссов отмелей, чащи и пиков третья звезда ещё и требует уложиться в число раундов.\n\n`;
  C.REGIONS.forEach(reg=>{out+=`## ${reg.name}\n\n${reg.intro}\n\n| # | id | Бой | Ур. | Команда | ИИ | Противники | Идея | Лучший | О+В+З | В+Ф+О | Гибриды |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    rows.filter(r=>r.node.region===reg.id).forEach(r=>{const x=r.node,c=k=>`${pc(r.at[k].rec.win)} → ${pc(r.at[k].up.win)}`;
      out+=`| ${x.n} | ${x.id} | ${x.boss?'👑 ':''}${x.name} | ${x.rec} | до ${x.team.max} | ${x.ai} | ${foeText(x)} | ${x.idea.replace(/\|/g,'/')} | ${c('mix')} | ${c('fwt')} | ${c('apf')} | ${c('hyb')} |\n`});out+='\n'});
  return out}
if(require.main===module){
  const n=+process.argv[2]||80,rows=balance(n);
  rows.forEach(r=>console.log(r.id.padEnd(3),String(r.L0).padStart(2),'|',TEAMS.map(t=>`${t.k} ${pc(r.at[t.k].rec.win).padStart(5)}→${pc(r.at[t.k].up.win).padStart(5)} ★${r.at[t.k].up.stars.toFixed(1)}`).join(' | '),'|',r.at.mix.rec.team.join(',')));
  const i=process.argv.indexOf('--md');if(i>0){const f=process.argv[i+1]||path.join(dir,'CAMPAIGN-RU.md');fs.writeFileSync(f,md(rows,n));console.log('таблица:',f)}}
module.exports={balance,TEAMS,run,pick};
