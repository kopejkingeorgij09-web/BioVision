import {apply,need,newIsland,npcWorld,refresh} from '../../../phagi/island/game.mjs';
import {battleSeconds} from '../../../phagi/island/battle.mjs';
import {settleInvasion} from '../../../phagi/island/records.mjs';
import {nextInvasion} from '../../../phagi/island/progression.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
const base=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
class ServiceUnavailable extends Error {}
async function rpc(name:string,args:object){
  const response=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key!,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(!response.ok){console.error('Dragon RPC',name,response.status);if(response.status===403)throw new Error('Требуется личный ученический профиль');throw new ServiceUnavailable('Облако временно недоступно');}
  return await response.json();
}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const read=(uid:string,peer:string|null=null,op:string|null=null)=>rpc('dragon_read',{p_uid:uid,p_peer:peer,p_op:op});
const due=(row:any,now:number)=>row&&Date.parse(row.next_invasion)<=now;
async function settle(uid:string,row:any){
  const scheduled=Date.parse(row.next_invasion);
  refresh(row.state,scheduled);
  const archive=settleInvasion(row.state,scheduled);
  return rpc('dragon_commit',{p_uid:uid,p_op:null,p_result:null,p_changes:[{uid,rev:row.rev,state:row.state,scheduled:row.next_invasion,archive}]});
}
async function worker(uid:string){
  for(let i=0;i<8;i++){const snap=await read(uid);if(!due(snap.me,snap.now))return;await settle(uid,snap.me);}
}
async function run(user:any,cmd:any,op:string|null,depth=0):Promise<any>{
  need(depth<4,'Повторите вход на остров');
  const uid=user.id;let target=cmd.action==='raid'?cmd.target:'';
  for(let attempt=0;attempt<12;attempt++){
    const human=target&&!target.startsWith('npc:');
    need(!human||(target.startsWith('qa-isle-')===uid.startsWith('qa-isle-')&&target!==uid),'Остров недоступен');
    const snap=await read(uid,human?target:null,op),now=snap.now;
    if(due(snap.me,now)){await settle(uid,snap.me);continue;}
    if(human&&due(snap.peer,now)){await settle(target,snap.peer);continue;}
    const wallet=snap.wallet,s=snap.me?.state||newIsland(now,user.name||'Мой остров'),changed=refresh(s,now);
    const view=(result:any=null)=>({state:s,wallet:{...wallet,balance:wallet.credit-s.spent},now,nextInvasion:snap.me?Date.parse(snap.me.next_invasion):nextInvasion(now),result});
    if(snap.receipt)return view(snap.receipt.result);
    if(s.raid&&s.raid.start+battleSeconds*1000<=now&&cmd.action!=='finish'){
      await run(user,{action:'finish',raid:s.raid.id},s.raid.id,depth+1);continue;
    }
    if(['read','map','history','recording'].includes(cmd.action)){
      if(changed||!snap.me){if(!await rpc('dragon_commit',{p_uid:uid,p_op:null,p_result:null,p_changes:[{uid,rev:snap.me?.rev||0,state:s}]}))continue;}
      if(cmd.action==='map')return {...view(),islands:await rpc('dragon_map',{p_uid:uid})};
      if(cmd.action==='history'){
        need(cmd.before==null||Number.isSafeInteger(cmd.before),'Некорректная страница');
        return view(await rpc('dragon_history',{p_uid:uid,p_before:cmd.before??null,p_key:String(cmd.key||'').slice(0,80)}));
      }
      if(cmd.action==='recording'){const match=await rpc('dragon_recording',{p_uid:uid,p_id:String(cmd.id).slice(0,80)});need(match,'Запись не найдена');return view(match);}
      return view();
    }
    if(cmd.action==='finish'&&s.raid&&target!==s.raid.target){target=s.raid.target;continue;}
    const peer=human?snap.peer?.state:target?npcWorld(target.slice(4),now):null;
    if(peer)refresh(peer,now);
    const archives=new Map();
    const result=apply(s,cmd,{now,credit:wallet.credit,defender:peer,uid,target,random:()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296,
      archive:(owner:string,report:any,recording:any)=>archives.set(owner,{report,recording})});
    const changes=[{uid,rev:snap.me?.rev||0,state:s,archive:archives.get(uid)}];
    if(human&&peer)changes.push({uid:target,rev:snap.peer.rev,state:peer,archive:archives.get(target)});
    if(await rpc('dragon_commit',{p_uid:uid,p_op:op,p_result:result??null,p_changes:changes}))return view(result);
  }
  throw new ServiceUnavailable('Остров изменился. Повторите действие.');
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({error:'Используйте POST'},405);
  try{
    const body=await req.text();need(body.length<=6500,'Команда слишком велика');
    const {schedule,code,cmd,op,studentMode}=JSON.parse(body);
    if(schedule!==undefined){
      need(typeof schedule==='string'&&uuid.test(schedule),'Некорректное задание');
      const users=await rpc('dragon_take_ticket',{p_token:schedule});
      if(!users)return reply({error:'Задание истекло'},403);
      for(let i=0;i<users.length;i+=4)await Promise.all(users.slice(i,i+4).map(worker));
      return reply({processed:users.length});
    }
    need(typeof code==='string'&&code.length<=128&&typeof cmd?.action==='string','Некорректная команда');
    const user=await rpc('ph_login',{p_code:code});
    if(!user||(user.isOwner&&studentMode!==true))return reply({error:'Войдите по личному ученическому коду'},403);
    if(user.isOwner){await rpc('ph_dragon_wallet',{p_code:code});user.name='Личный остров';}
    const readonly=['map','read','history','recording'].includes(cmd.action);
    need(readonly||uuid.test(op),'Нужен номер операции');
    if(cmd.action==='raid'){
      need(typeof cmd.target==='string'&&cmd.target.length<=100,'Выберите остров');
      // Previously bookmarked practice islands enter the corresponding campaign stage.
      const prior:Record<string,string>={'npc:reef':'npc:campaign-1','npc:pine':'npc:campaign-20','npc:summit':'npc:campaign-40'};
      if(Object.hasOwn(prior,cmd.target))cmd.target=prior[cmd.target];
    }
    return reply(await run(user,cmd,readonly?null:op));
  }catch(error){return reply({error:error instanceof Error?error.message:'Не удалось выполнить действие'},error instanceof ServiceUnavailable||error instanceof TypeError?503:400);}
});
