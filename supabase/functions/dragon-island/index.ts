import {apply,need,newIsland,npcWorld,refresh} from '../../../phagi/island/game.mjs';
import {battleSeconds} from '../../../phagi/island/battle.mjs';
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
async function run(user:any,cmd:any,op:string|null,depth=0):Promise<any>{
  need(depth<4,'Повторите вход на остров');
  const uid=user.id;
  let target=cmd.action==='raid'?cmd.target:'';
  for(let attempt=0;attempt<10;attempt++){
    const human=target&&!target.startsWith('npc:');
    need(!human||(target.startsWith('qa-isle-')===uid.startsWith('qa-isle-')&&target!==uid),'Остров недоступен');
    const snap=await rpc('dragon_read',{p_uid:uid,p_peer:human?target:null,p_op:op});
    const now=snap.now, wallet=snap.wallet, s=snap.me?.state||newIsland(now,user.name||'Мой остров');
    const oldVersion=s.v;refresh(s,now);
    const view=(result:any=null)=>({state:s,wallet:{...wallet,balance:wallet.credit-s.spent},now,result});
    if(snap.receipt)return view(snap.receipt.result);
    if(s.raid&&s.raid.start+battleSeconds*1000<=now&&cmd.action!=='finish'){
      await run(user,{action:'finish',raid:s.raid.id},s.raid.id,depth+1);continue;
    }
    if(cmd.action==='map')return {...view(),islands:await rpc('dragon_map',{p_uid:uid})};
    if(cmd.action==='read'&&snap.me&&s.v===oldVersion)return view();
    if(cmd.action==='finish'&&s.raid&&target!==s.raid.target){target=s.raid.target;continue;}
    const peer=human?snap.peer?.state:target?npcWorld(target.slice(4),now):null;
    if(peer)refresh(peer,now);
    const result=cmd.action==='read'?null:apply(s,cmd,{now,credit:wallet.credit,defender:peer,uid,target,random:()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296});
    const changes=[{uid,rev:snap.me?.rev||0,state:s}];
    if(human&&peer)changes.push({uid:target,rev:snap.peer.rev,state:peer});
    if(await rpc('dragon_commit',{p_uid:uid,p_op:op,p_result:result??null,p_changes:changes}))return view(result);
  }
  throw new ServiceUnavailable('Остров изменился. Повторите действие.');
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers});
  if(req.method!=='POST')return reply({error:'Используйте POST'},405);
  try{
    const body=await req.text();need(body.length<=6500,'Команда слишком велика');
    const {code,cmd,op,studentMode}=JSON.parse(body);
    need(typeof code==='string'&&code.length<=128&&typeof cmd?.action==='string','Некорректная команда');
    const user=await rpc('ph_login',{p_code:code});
    if(!user||(user.isOwner&&studentMode!==true))return reply({error:'Войдите по личному ученическому коду'},403);
    if(user.isOwner){await rpc('ph_dragon_wallet',{p_code:code});user.name='Личный остров';}
    const read=['map','read'].includes(cmd.action);
    need(read||uuid.test(op),'Нужен номер операции');
    if(cmd.action==='raid')need(typeof cmd.target==='string'&&cmd.target.length<=100,'Выберите остров');
    return reply(await run(user,cmd,read?null:op));
  }catch(error){return reply({error:error instanceof Error?error.message:'Не удалось выполнить действие'},error instanceof ServiceUnavailable||error instanceof TypeError?503:400);}
});
