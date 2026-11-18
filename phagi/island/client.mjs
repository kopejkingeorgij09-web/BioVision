import {newIsland,apply,npcWorld,refresh} from './game.mjs';
export const tour=new URLSearchParams(location.search).has('tour');
const code=()=>localStorage.getItem('ph_code')||'';
const endpoint='https://zonrkvsibojyalhnqutd.supabase.co/functions/v1/dragon-island';
const demoKey='ph_dragon_art_tour_v1';
export async function request(cmd,op=null){
  if(tour){
    let s=JSON.parse(sessionStorage.getItem(demoKey)||'null'),now=Date.now();
    if(!s){s=newIsland(now,'Мастерская');s.dragons.push({...s.dragons[0],id:crypto.randomUUID(),species:'s26'});s.seen.push('s26');}
    refresh(s,now);let result;
    if(cmd.action!=='read'&&cmd.action!=='map'){
      const target=cmd.target||s.raid?.target||'npc:reef';
      result=apply(s,cmd,{now,uid:'demo',target,defender:npcWorld(target.slice(4),now)});
    }
    sessionStorage.setItem(demoKey,JSON.stringify(s));return {state:s,now,wallet:{balance:0,credit:0,days:{}},islands:[],result};
  }
  if(!code())throw Error('Откройте «Фаги» и войдите по ученическому коду.');
  let r;try{r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd,op,code:code(),studentMode:localStorage.getItem("ph_role")==="student"}),signal:AbortSignal.timeout(18000)});}
  catch{throw Object.assign(Error('Связь прервалась. Повторите отправку сохранённой команды.'),{retry:true});}
  const data=await r.json().catch(()=>({}));if(!r.ok||!data.state)throw Object.assign(Error(data.error||'Облако временно недоступно'),{retry:r.status>=500||!data.error});
  return data;
}
export const pendingKey=()=>tour?'tour-op':'island-operation-'+(localStorage.getItem('ph_code')||'').slice(-4);
