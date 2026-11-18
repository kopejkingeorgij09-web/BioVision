import {welcomeGems,nextInvasion} from './progression.mjs';
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
    const archiveKey=demoKey+'/history';
    if(cmd.action==='history'){
      const history=JSON.parse(sessionStorage.getItem(archiveKey)||'[]');
      result=history.map(x=>x.report).filter(x=>cmd.before==null||x.time<cmd.before||x.time===cmd.before&&x.id<cmd.key).slice(0,21);
    }else if(cmd.action==='recording'){
      result=JSON.parse(sessionStorage.getItem(archiveKey)||'[]').find(x=>x.report.id===cmd.id);
      if(!result)throw Error('Запись не найдена');
    }else if(cmd.action!=='read'&&cmd.action!=='map'){
      const target=cmd.target||s.raid?.target||'npc:reef';
      result=apply(s,cmd,{now,credit:welcomeGems,uid:'demo',target,defender:npcWorld(target.slice(4),now),archive:(uid,report,recording)=>{
        const recent=JSON.parse(sessionStorage.getItem(archiveKey)||'[]');
        recent.unshift({report,recording});sessionStorage.setItem(archiveKey,JSON.stringify(recent.slice(0,12)));
      }});
    }
    sessionStorage.setItem(demoKey,JSON.stringify(s));return {state:s,now,nextInvasion:nextInvasion(now),wallet:{balance:welcomeGems-s.spent,credit:welcomeGems,welcome:welcomeGems,days:{}},islands:[],result};
  }
  if(!code())throw Error('Откройте «Фаги» и войдите по ученическому коду.');
  let r;try{r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd,op,code:code(),studentMode:true}),signal:AbortSignal.timeout(18000)});}
  catch{throw Object.assign(Error('Связь прервалась. Повторите отправку сохранённой команды.'),{retry:true});}
  const data=await r.json().catch(()=>({}));if(!r.ok||!data.state)throw Object.assign(Error(data.error||'Облако временно недоступно'),{retry:r.status>=500||!data.error});
  return data;
}
let key='tour-op';
export async function identifySession(){
  if(tour)return;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code()));
  key='island-op/'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export const pendingKey=()=>key;
