/* Баланс типов: node phagi/dragons/dev/types.js [боёв на пару, по умолчанию 40] [--dir папка модулей] [--lvl 20] [--md файл]
   28 типов: семь одностихийных (X/e) и 21 двухстихийный (X/Y). Остальные гены у всех одинаковые (как в balance.js).
   Каждый тип против каждого (и против себя), обе стороны по очереди, компьютер «средний» за обоих.
   Слои, чтобы видеть причину перекоса, а не только итог:
   roles — урон стихий нейтральный, эффектов нет (только характеристики ролей);
   matrix — плюс таблица стихий; fx — плюс эффекты; full — всё, компьютер «трудный» за обоих.
   Форматы 1×1, 2×2, 3×3: команда из копий одного типа. --dir позволяет прогнать прежнюю версию модулей для сравнения. */
'use strict';
const path=require('path'),fs=require('fs');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d};
const dir=path.resolve(arg('--dir',path.join(__dirname,'..')));
global.DRG=require(dir+'/genetics.js');const D=global.DRG,B=require(dir+'/battle.js');
global.MORPH=require(dir+'/morph.js');const SH=require(dir+'/shape.js'),AN=require(dir+'/anim.js'),ST=require(dir+'/stats.js');
const N=+process.argv[2]||40,LVL=+arg('--lvl',20);
const EL=['F','W','T','A','P','L','D'],NM={F:'Огонь',W:'Вода',T:'Земля',A:'Воздух',P:'Флора',L:'Свет',D:'Тьма'};
const TYPES=[...EL.map(e=>e+'/e')];for(let i=0;i<EL.length;i++)for(let j=i+1;j<EL.length;j++)TYPES.push(EL[i]+'/'+EL[j]);
const PB={S:'S/S',C:'C/c',H:'H/h',K:'k/k',R:'R1/R2',Wg:'+/+',Q1:'+/-',Q2:'+/-',Q3:'+/-',sex:'M',M:'m/m',N:'N/N'};
const cache=new Map();
function spec(id,E,lvl){let c=cache.get(E+lvl);
  if(!c){const g=D.make(Object.assign({},PB,{E})),ph=D.phenotype(g),M=MORPH.morph(ph,Math.min(lvl,20)),G=SH.build(M),P=AN.profile(M,G.rig),s=ST.of(ph,lvl,P);
    c={els:ph.breath==='element'?ph.elements:[],s,ph};cache.set(E+lvl,c)}
  return {id,lvl,els:c.els,hp:c.s.hp,atk:c.s.atk,def:c.s.def,spd:c.s.spd,skills:c.s.skills}}
const label=E=>E.split('/').filter(x=>x!=='e').map(x=>NM[x]).join('/');
/* слой правил: старые модули не знают опции rules, тогда сравниваем только full */
function play(a,b,size,seed,layer){
  const A=[...Array(size)].map((_,i)=>spec('a'+i,a,LVL)),Bt=[...Array(size)].map((_,i)=>spec('b'+i,b,LVL));
  const ai=layer==='full'?'hard':'normal';
  const rules=layer==='roles'?{matrix:false,fx:false}:layer==='matrix'?{matrix:true,fx:false}:undefined;
  const r=B.simulate(A,Bt,{seed,aiA:ai,aiB:ai,rules});return r.winner==='A'?1:0}
function table(size,layer){
  const w={};TYPES.forEach(t=>w[t]={win:0,n:0,rounds:0});
  TYPES.forEach((a,i)=>TYPES.forEach((b,j)=>{for(let s=1;s<=N;s++){const seed=(i*31+j)*1009+s*7+size*100003;
    const x=play(a,b,size,seed,layer);w[a].win+=x;w[a].n++;w[b].win+=1-x;w[b].n++}}));
  return TYPES.map(t=>({t,rate:w[t].win/w[t].n})).sort((x,y)=>y.rate-x.rate)}
function stats(){return TYPES.map(t=>{const s=spec('x',t,LVL);return {t,hp:s.hp,atk:s.atk,def:s.def,spd:s.spd}})}
if(require.main===module){
  const layers=(arg('--layers','roles,matrix,fx,full')).split(','),sizes=(arg('--sizes','1,3')).split(',').map(Number),out={lvl:LVL,n:N,dir,stats:stats(),res:{}};
  console.log('уровень',LVL,'боёв на пару и сторону',N,'модули',dir);
  out.stats.forEach(s=>console.log(label(s.t).padEnd(12),'HP',s.hp,'ATK',s.atk,'DEF',s.def,'SPD',s.spd));
  layers.forEach(L=>sizes.forEach(z=>{const t=table(z,L);out.res[L+z]=t;
    console.log(`\n${L} ${z}×${z}: разброс ${(t[t.length-1].rate*100).toFixed(1)}–${(t[0].rate*100).toFixed(1)} %`);
    console.log(t.map(x=>label(x.t)+' '+(x.rate*100).toFixed(1)).join(' · '))}));
  const j=arg('--json');if(j)fs.writeFileSync(j,JSON.stringify(out,null,1))}
module.exports={TYPES,spec,table,label};
