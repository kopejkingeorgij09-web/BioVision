import {boardSize} from './world.mjs';

export const chapters=['Меловые отмели','Вересковые ключи','Медные острова','Ветряные скалы','Соляной пролив','Рифы грозы','Лунный архипелаг','Хрустальная гряда','Затонувшие сады','Пепельные гавани','Зеркальные фьорды','Багряный хребет','Врата затмения','Облачные цитадели','Корона свода'];
export const stagesPerChapter=20,stageCount=chapters.length*stagesPerChapter;
const sites=['Дозор','Переправа','Коса','Каменоломня','Застава','Ключ','Порт','Развилка','Часовня','Мыс','Обсерватория','Ступени','Грот','Маяк','Ворота','Верфь','Пристань','Редут','Бастион','Крепость'];
export function stageNumber(target){const m=/^npc:campaign-([1-9]\d{0,2})$/.exec(target);const n=m?+m[1]:0;return n<=stageCount?n:0;}
export const stageTarget=n=>'npc:campaign-'+n;
export function unlockedStage(s){let i=1;while(i<stageCount&&s.campaign?.best[i]>0)i++;return i;}
export function stageInfo(n){
 if(!Number.isInteger(n)||n<1||n>stageCount)throw Error('Неизвестный уровень кампании');
 const chapter=Math.floor((n-1)/20),step=(n-1)%20+1;
 return {n,chapter,step,boss:step===20,name:sites[step-1]+' · '+chapters[chapter],gold:70+5*n+20*Math.floor(n/20),food:50+4*n+15*Math.floor(n/20)};
}
const sitesByRole={
 core:[[4,4],[5,4],[4,5],[5,5]],
 vault:[[3,3],[6,3],[3,5],[6,5],[4,2],[5,2],[2,5],[7,5]],
 defense:[[3,6],[6,6],[5,7],[4,6],[2,4],[7,4],[5,3],[4,3],[3,2],[6,2],[2,6],[7,6]],
 outer:[[1,6],[8,6],[2,7],[7,7],[3,8],[6,8],[1,4],[8,4],[3,1],[6,1],[1,3],[8,3]]
};
export function campaignWorld(n){
 const info=stageInfo(n),buildings=[];
 let seed=n*731+37;
 function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
 function slots(role){
  const list=sitesByRole[role].map(([c,r])=>[c,r]);
  for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
  return list;
 }
 const core=slots('core'),vault=slots('vault'),defense=slots('defense'),outer=slots('outer');
 const layer=1+Math.floor((n-1)/60),scale=.58+n*.008+Math.floor(n/20)*.026;
 function place(kind,points,stock=0){
  let [c,r]=points.pop();
  if(n%2)c=boardSize-1-c;
  if(Math.floor(n/3)%2)r=boardSize-1-r;
  if(info.chapter%2)[c,r]=[r,c];
  const id=kind==='nest'?'keep':kind+'-'+buildings.length;
  buildings.push({id,kind,col:c,row:r,level:layer,stock,force:scale,durability:scale*(kind==='nest'?1.55:1),...(id==='keep'?{landmark:info.boss?'fortress':'keep'}:{})});
 }
 place('nest',core);place('gold',vault,info.gold);place('food',vault,info.food);place('tower',defense);
 for(const [at,kind] of [[8,'farm'],[15,'home'],[20,'ice'],[36,'mine'],[50,'tower'],[70,'ward'],[90,'gold'],[110,'storm'],[145,'garrison'],[175,'ice'],[200,'tower'],[240,'ward'],[270,'storm']]){
  if(n>=at)place(kind,['ice','ward','storm','tower'].includes(kind)?defense:outer);
 }
 return {name:info.name,shield:0,buildings,dragons:[],stage:n};
}
export function battleStars(sim){
 const targets=sim.targets.filter(t=>t.kind!=='guard'),fallen=targets.filter(t=>t.hp<=0);
 const keep=fallen.some(t=>t.id==='keep'),half=fallen.length*2>=targets.length;
 return fallen.length===targets.length?3:Number(keep)+Number(half);
}
export function campaignEntitlement(n,stars){
 const v=stageInfo(n),ratio=[0,.5,.8,1][stars];
 return {gold:Math.floor(v.gold*ratio),food:Math.floor(v.food*ratio)};
}
