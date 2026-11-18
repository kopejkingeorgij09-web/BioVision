import {chapters,stageInfo,stageNumber,stageTarget,unlockedStage,campaignWorld,campaignEntitlement} from './campaign.mjs';
import {buildings,available,room} from './game.mjs';
import {strength,byId} from './catalog.mjs';
import {defenses,defenseStats} from './defenses.mjs';
import {escape as esc,structureArt,structureName,btn,opt,select,panel,page,moscowDate} from './ui.mjs';
import {project} from './board.mjs';
import {targetHealth} from './battle.mjs';
import {position} from './world.mjs';

function plan(bs){
 const pieces=bs.map(b=>({b,p:project(position(b).x,position(b).y)})).sort((a,b)=>a.p.y-b.p.y);
 const xs=pieces.map(v=>v.p.x),ys=pieces.map(v=>v.p.y);
 const width=Math.max(340,Math.max(...xs)-Math.min(...xs)+170),height=Math.max(200,Math.max(...ys)-Math.min(...ys)+115);
 const view=[(Math.max(...xs)+Math.min(...xs)-width)/2,(Math.max(...ys)+Math.min(...ys)-height)/2-12,width,height].join(' ');
 const objects=pieces.map(({b,p})=>'<image x="'+(p.x-29)+'" y="'+(p.y-44)+'" width="58" height="59" href="'+structureArt(b)+'"><title>'+esc(structureName(b,buildings))+' · '+b.level+'</title></image>').join('');
 return '<svg class="fort-plan" viewBox="'+view+'" role="img" aria-label="Разведка острова"><image width="1000" height="960" preserveAspectRatio="none" href="art/settlement/plateau.svg"/>'+objects+'</svg>';
}
export function warRoom(s,{mode,stage,chapter,target,opponents,team,due,now}){
 const limit=unlockedStage(s),personal=mode==='pvp';
 const info=stageInfo(stage),world=personal?opponents.find(o=>o.id===target)||opponents[0]:campaignWorld(stage);
 const teamPanel=panel('Боевой отряд · '+team.length+'/3',s.dragons.slice().sort((a,b)=>strength(b)-strength(a)).map(d=>btn((team.includes(d.id)?'✓ ':'')+byId[d.species].name+' · сила '+strength(d)+(available(s,d,now)?'':' · занят'),'team/'+d.id,team.includes(d.id)?'active':'',!available(s,d,now))).join(' '));
 const heading='<div class="segment">'+btn('Кампания','war/campaign',personal?'':'active')+btn('Острова игроков','war/pvp',personal?'active':'')+'</div>';
 const alarm='<div class="invasion-note"><strong>Оборона · волна '+s.invasionLevel+'</strong><span>Налёт '+moscowDate(due)+' МСК, даже если вы вне игры. Риск — до 20% еды и золота.</span>'+btn('Журнал боёв','go/log')+'</div>';
 let content='';
 if(personal){
  content=select('enemy',opponents.map(o=>opt(o.id,o.name,world?.id)).join('')||opt('','Пока нет соперников'),'Остров соперника')+' '+btn('Обновить','map');
 }else{
  const chapterSelect=select('chapter',chapters.map((v,i)=>opt(i,(i+1)+'. '+v,chapter)).join(''),'Глава кампании');
  const points=Array.from({length:20},(_,i)=>{
   const row=Math.floor(i/5),col=row%2?4-i%5:i%5;
   return [9+col*20+(row%2)*2,13+row*24+(col%2?3:0)];
  });
  const path=points.map(([x,y])=>x*9+','+y*3.1);
  const cleared=path.slice(0,Math.max(0,limit-chapter*20));
  const trail='<svg class="chart-line" viewBox="0 0 900 310" preserveAspectRatio="none" aria-hidden="true"><polyline class="planned" points="'+path.join(' ')+'"/><polyline class="traveled" points="'+cleared.join(' ')+'"/></svg>';
  const nodes=Array.from({length:20},(_,i)=>{
   const n=chapter*20+i+1,best=s.campaign.best[n]||0,locked=n>limit,boss=i===19;
   const status=best?'★'.repeat(best):locked?'': 'В бой';
   return '<button style="left:'+points[i][0]+'%;top:'+points[i][1]+'%" class="stage '+(best?'cleared ':'')+(locked?'locked ':'')+(n===stage?'current ':'')+(boss?'boss':'')+'" data-do="stage/'+n+'" aria-label="Уровень '+n+(boss?', крепость':'')+', звёзд '+best+(locked?', закрыт':'')+'"><strong>'+n+(boss?' ♜':'')+'</strong><small>'+status+'</small></button>';
  });
  content='<div class="chapter-head"><h2>Кампания</h2>'+chapterSelect+'</div><div class="campaign-path chart">'+trail+nodes.join('')+'</div>';
 }
 if(!world)return page('Набеги',heading+content+panel('Острова игроков','Здесь появятся острова других участников.')+alarm);
 const bs=personal?world.map:world.buildings,pay=personal?null:campaignEntitlement(stage,3),paid=s.campaign.paid[stage]||{gold:0,food:0};
 const title=personal?esc(world.name):'Уровень '+stage+' · '+esc(info.name);
 const resources=personal?['gold','food'].map(k=>Math.min(room(s,k),bs.filter(b=>b.kind===k).reduce((n,b)=>n+Math.floor(.8*b.stock),0))):[pay.gold-paid.gold,pay.food-paid.food];
 const defensesHere=bs.filter(b=>defenses[b.kind]);const rating=bs.reduce((n,b)=>n+targetHealth(b)+Math.round((defenseStats(b.kind,b.level)?.damage||0)*(b.force||1)),0);
 const locked=!personal&&stage>limit,shield=personal&&world.shield>now;
 const best=!personal?s.campaign.best[stage]||0:0,entitled=best?campaignEntitlement(stage,best):null;
 const claim=entitled&&(entitled.gold>paid.gold||entitled.food>paid.food)?btn('Забрать остаток награды','campaignClaim/'+stage):'';
 const rules=personal?(shield?'Щит до '+moscowDate(world.shield)+' МСК.':'После ограбления защитник получает 12 часов щита против игроков.'):'Одна звезда открывает следующий уровень. Звёзды дают уничтожение крепости, 50% построек и полная зачистка. Награда выдаётся за лучший результат.';
 return page('Набеги',heading+content+panel(title,'<div class="scout">'+plan(bs)+'<div><b>Доступная добыча</b><p>'+resources[0]+' золота · '+resources[1]+' еды</p><p>Сила обороны '+rating+' · Оборонительных построек '+defensesHere.length+'</p><small>'+rules+'</small>'+claim+'</div></div>')+teamPanel+btn(locked?'Пройдите уровень '+(stage-1):shield?'Остров под щитом':'Начать набег','raid','primary',locked||shield||!team.length)+alarm);
}
