import {btn,opt,select,row,panel,page,moscowDate} from './ui.mjs';
import {shop} from './shop.mjs';
import {warRoom} from './war-room.mjs';
import {replayPage,mountReplay} from './replay-view.mjs';
import {stageInfo,stageTarget,unlockedStage} from './campaign.mjs';
import {nextInvasion} from './progression.mjs';
import {defenses,defenseText} from './defenses.mjs';
import {cellName,project} from './board.mjs';
import {boardSize,position} from './world.mjs';
import {icon} from './icons.mjs';
import {actorMarkup,mountActors,dragonAsset} from './actors.mjs';
import {renderShell} from './scene.mjs';
import {mountCamera,focusCamera,cameraMoving} from './camera.mjs';
import {species,byId,elements,colors,rarities,roles,skills,signs,stats,strength,distribution,percentages,pairing,starPrices,foodPrice} from './catalog.mjs';
import {buildings,total,capacity,available,upgrade,buildCost,gemSpeed,production,homeSize,objectives,unlockPrice,nestTime,hatchTime} from './game.mjs';
import {art,escape as esc,islandMap,battleView,paintBattle,idle,showResident,rotateResidents} from './paint.mjs';
import {request,pendingKey,tour,identifySession} from './client.mjs';
const $=s=>document.querySelector(s),val=s=>$(s)?.value;
const labelTypes=s=>s.types.map(t=>signs[t]+' '+elements[t]).join(' · ');
const elementBadges=s=>s.types.map(t=>'<span class="affinity" style="--affinity:'+colors[t]+'"><i aria-hidden="true">'+signs[t]+'</i>'+elements[t]+'</span>').join('');
const fieldNotes=[
 'В трещинах обсидиановых пластин светится лава. На кончике хвоста горит открытое пламя.',
 'Жаберные веера пропускают свет, а широкий хвостовой плавник изгибается вслед за телом.',
 'Длинные маховые перья лежат внахлёст. Два хвостовых пера расходятся за спиной, как ленты на ветру.',
 'На спине вырастают друзы кварца. Тяжёлые лапы покрыты слоями охристого камня.',
 'Между пластинками коры растёт мох. На рогах распускаются цветы, а вдоль хвоста тянутся листья папоротника.',
 'Золотые жилки разветвляются по синим перепонкам крыльев. Два острия на хвосте похожи на разряд молнии.',
 'Серебристые пластины крыла перекрывают друг друга. На сгибах между ними поблёскивает медь.',
 'Сквозь полые рога видно небо. На спине искрятся светлые вкрапления, а хвост сворачивается в кольцо.',
 'Тёмные перья ложатся на плечи плотной мантией. Из-под неё видны гранатовые рога и красный блеск чешуи.',
 'Тонкие рёбра крыльев расходятся веером. Золотые лучи за головой образуют солнечный венец.',
];
const duration=ms=>{const n=Math.max(0,Math.ceil(ms/1000));return n>=3600?Math.floor(n/3600)+' ч '+Math.floor(n%3600/60)+' мин':n>=60?Math.floor(n/60)+' мин '+n%60+' с':n+' с';};
const date=t=>new Date(t).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
let state,wallet,offset=0,busy=false,chosen='',selectedUnit='',opponents=[],team=[],target='',pair=[],filters=['','','own'],plotMode=null,toastTimer;
let shopTab='owned',warMode='campaign',stage=null,chapter=0,nextAttack=0;
let history=[],hasMore=false,historyRequest=0,historyError='',match=null,matchError='',matchRequest=0;
let route=()=>decodeURIComponent(location.hash.slice(1))||'island';
const now=()=>Date.now()+offset, cd=end=>'<time data-end="'+end+'">'+duration(end-now())+'</time>';
const thing=id=>state.buildings.find(b=>b.id===id),dragon=id=>state.dragons.find(d=>d.id===id);
function message(text){$('#notice').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#notice').textContent='',4200);}
function go(page){if(route()===page)render();else{location.hash=page;scrollTo(0,0);}}
function accept(r){state=r.state;wallet=r.wallet;offset=r.now-Date.now();nextAttack=r.nextInvasion||nextInvasion(r.now);if(r.islands)opponents=r.islands;}
async function fetchState(){
 const previous=state,r=await request({action:'read'});
 if(busy||state!==previous)return;
 const changed=!state||JSON.stringify(r.state)!==JSON.stringify(state)||JSON.stringify(r.wallet)!==JSON.stringify(wallet);
 const newReport=r.state.reports[0],oldReport=state?.reports[0];
 accept(r);if(changed)render();
 if(previous&&newReport&&oldReport?.id!==newReport.id){
  if(newReport.source==='daily')message(newReport.enemy+' · '+newReport.reason+'. Повтор в журнале.');
  if(route()==='log')loadHistory();
 }
}
async function action(cmd,msg,after){
 if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');
 const key=pendingKey();let p;
 try{p=JSON.parse(sessionStorage.getItem(key)||'null');if(p&&JSON.stringify(p.cmd)!==JSON.stringify(cmd)){message('Сначала подтвердите ранее отправленное действие');return;}
   p=p||{op:crypto.randomUUID(),cmd};sessionStorage.setItem(key,JSON.stringify(p));
   const r=await request(cmd,p.op);accept(r);sessionStorage.removeItem(key);
   if(after)after(r);render();if(msg)message(msg);
 }catch(e){
   if(!e.retry){
     sessionStorage.removeItem(key);
     try{
       accept(await request({action:'read'}));
       if(plotMode?.cell!=null&&state.buildings.some(b=>b.id!==plotMode.building&&b.row*boardSize+b.col===plotMode.cell))plotMode.cell=null;
     }catch{}
   }
   message(e.message);render();
 }
 finally{busy=false;document.body.removeAttribute('aria-busy');}
}
function availability(d){
 if(d.guard)return 'Гарнизон';if(d.recover>now())return 'Восстановление до '+date(d.recover);
 if(state.raid?.team.some(x=>x.id===d.id))return 'В набеге';
 const e=state.eggs.find(e=>e.parents.includes(d.id)&&e.stage==='nest'&&e.end>now());return e?'В гнезде до '+date(e.end):'Свободен';
}
const docks=[['island','Остров'],['book','Книга'],['nest','Гнездо'],['raids','Набеги']];
function resource(type,label,n){return '<span class="res res-'+type+'" title="'+label+'" aria-label="'+label+' '+n+'">'+icon(type)+'<b>'+n+'</b></span>';}
function shell(body,section){return '<header><a class="return-link" href="../">'+icon('back')+'Фаги</a><span class="brand">'+icon('dragons')+'Архипелаг</span></header><div class="wallet">'+resource('coin','Золото',total(state,'gold'))+resource('food','Еда',total(state,'food'))+resource('gem','Кристаллы',wallet.balance)+'</div><div class="layout">'+body+'</div><nav class="dock" aria-label="Разделы игры">'+docks.map(([p,l])=>btn(icon(p)+'<span>'+l+'</span>','go/'+p,p===section?'active':'')).join('')+'</nav>';}
const islandLink=btn('На остров','go/island');
function roster(){return state.dragons.slice().sort((a,b)=>strength(b)-strength(a)).map(d=>row(esc(byId[d.species].name),'Сила '+strength(d)+' · Ур. '+d.level+' · '+d.stars+' ★ · '+availability(d),btn('Осмотреть','go/dragon/'+d.id))).join('');}
function island(){const b=thing(chosen);
 if(plotMode){
 const k=plotMode.kind||thing(plotMode.building)?.kind, i=plotMode.cell,c=buildCost(k);
 const where=i==null?'Коснитесь свободной клетки.':'Клетка '+cellName(i%boardSize,Math.floor(i/boardSize));
 const price=plotMode.action==='move'?'Перемещение бесплатно':c.gold?'Цена '+c.gold+' золота':'Цена '+c.gems+' ◈';
 return islandMap(state,chosen,plotMode)+'<div class="page compact side">'+panel(buildings[k],'<p>'+where+' '+price+'.</p>'+(defenses[k]?'<p>'+defenses[k].role+'</p><small>'+defenseText(k,thing(plotMode.building)?.level||1)+'</small>':'')+'<div class="tools">'+btn('Подтвердить','confirmPlot','primary',i==null)+btn('Отмена','cancelPlot')+'</div>')+'</div>';
 }
 return islandMap(state,chosen)+(b?'<aside class="page compact side">'+buildingPanel(b)+'</aside>':'<div class="island-tools">'+btn(icon('build')+'Постройки','go/build','build-action')+btn(icon('dragons')+'Драконы','go/residents')+btn(icon('trials')+'Испытания','go/trials')+btn(icon('log')+'Журнал','go/log')+'</div>');
}
function buildingPanel(b){const kind=b.kind,u=upgrade(b);let details='';
 if(['food','gold'].includes(kind))details='Запас '+b.stock+' / '+capacity(b)+'. Улучшение добавит 1000 мест.';
 if(['mine','farm'].includes(kind))details='Готово к сбору: '+production(b,now())+'. Темп '+b.level+' за 10 с. '+btn('Собрать','collect/'+b.id,'primary');
 if(kind==='home'){
  const residents=state.dragons.filter(d=>d.home===b.id);
  details='Жители · '+residents.length+' / '+homeSize(b)+'<span class="home-residents">'+residents.map(d=>btn(esc(byId[d.species].name),'go/dragon/'+d.id)).join('')+'</span>';
 }
 if(kind==='garrison')details='До трёх защитников. Назначение — в карточке дракона.';
 if(defenses[kind])details=defenses[kind].role+'<br>'+defenseText(kind,b.level);
 if(kind==='incubator')details='Параллельное вылупление: '+b.slots+' '+(b.slots===1?btn('Второе место · 40 ◈ (4 нормы)','slot/'+b.id):'');
 if(kind==='nest'||kind==='incubator')details+=' '+btn('К яйцам','go/nest');
 if(defenses[kind]&&b.level<30)details+='<br><small>После улучшения: '+defenseText(kind,b.level+1)+'</small>';
 else if(!defenses[kind])details+='<br><small>Следующий уровень: прочность +25% от базовой.'+({tower:' Урон башни +9.',mine:' Производство +1 за 10 с.',farm:' Производство +1 за 10 с.'}[kind]||'')+'</small>';
 return panel(buildings[kind]+' · '+cellName(b.col,b.row)+' · ур. '+b.level,'<p>'+details+'</p><div class="tools">'+btn('Переместить','move/'+b.id)+(b.finish?'Строительство '+cd(b.finish)+btn('Ускорить · '+gemSpeed(b.finish,now())+' ◈','speedB/'+b.id+'/'+gemSpeed(b.finish,now())):b.level<30?btn('Улучшить до '+(b.level+1)+' · '+u.price+' зол. · '+duration(u.ms),'upgrade/'+b.id):'')+btn('Закрыть','clear')+'</div>');
}
function book(){
 const own=filters[2]==='own';
 const list=(own?state.dragons.slice().sort((a,b)=>strength(b)-strength(a)||a.id.localeCompare(b.id)).map(d=>({s:byId[d.species],d})):species.map(s=>({s})))
  .filter(({s})=>(!filters[0]||s.types.includes(+filters[0]-1))&&(!filters[1]||s.rarity===+filters[1])&&(filters[2]!=='new'||!state.seen.includes(s.id)));
 const cards=list.map(({s,d})=>'<button class="spec" data-do="go/'+(d?'dragon/'+d.id:'species/'+s.id)+'">'+art(s)+'<span class="label"><b>'+esc(s.name)+'</b><small>'+labelTypes(s)+'</small>'+(d?'<strong>Сила '+strength(d)+'</strong><small>Ур. '+d.level+' · '+d.stars+' ★</small>':'')+'</span></button>').join('');
 return page('Книга драконов','<p class="muted">'+(own?'Мои драконы · по убыванию боевой силы':'Открыто '+state.seen.length+' из '+species.length+' видов')+'</p><div class="filters">'+select('f2',opt('own','Мои драконы',filters[2])+opt('','Все виды · '+species.length,filters[2])+opt('new','Не открыты',filters[2]),'Наличие')+select('f0',opt('','Все стихии')+elements.map((e,i)=>opt(i+1,e,filters[0])).join(''),'Стихия')+select('f1',opt('','Любая редкость')+rarities.slice(1).map((e,i)=>opt(i+1,e,filters[1])).join(''),'Редкость')+'</div>'+(cards?'<div class="grid">'+cards+'</div>':'<p>По выбранным условиям драконов нет.</p>'));
}
function detail(s,d=null){
 const st=stats(d||{species:s.id,level:1,stars:0}),next=d?stats({...d,level:d.level+1}):null;
 const parents=s.rarity>1?pairing(s.id):[];
 const method=s.rarity===1?(s.id==='s1'||s.id==='s3'?'Стартовая пара острова.':'Экспедиция за золото.'):parents.length?parents.map(p=>p.name).join(' × '):'Скрещивание доступных родителей.';
 let controls='';
 if(d){const isFree=available(state,d,now());const own=thing(d.home);
 const options=state.buildings.filter(b=>b.kind==='home'&&b.id!==d.home&&state.dragons.filter(r=>r.home===b.id).length<homeSize(b));
 const housing=panel('Жилище · '+(own?cellName(own.col,own.row):'Остров'),btn('Показать на острове','showHome/'+d.id)+(options.length&&isFree?'<div class="tools">'+select('relocate',options.map(b=>opt(b.id,'Жилище '+cellName(b.col,b.row))).join(''),'Новое жилище')+btn('Переселить','rehome/'+d.id)+'</div>':''));

 controls=housing+panel('Рост и назначение','<p>Уровень '+d.level+' / 30 · '+d.stars+' / 5 ★ · '+availability(d)+'</p>'+ (d.level<30?'<p>После кормления: здоровье '+st.hp+' → '+next.hp+', удар '+st.power+' → '+next.power+'. Уровень учитывается при разведении.</p>'+btn('Кормить · '+foodPrice(d.level)+' еды','feed/'+d.id,'primary',!isFree):'')+'<div class="tools">'+btn(d.guard?'Снять из гарнизона':state.buildings.some(b=>b.kind==='garrison')?'В гарнизон':'Нужен гарнизон · ур. острова 2','guard/'+d.id,'',!d.guard&&(!isFree||!state.buildings.some(b=>b.kind==='garrison')))+btn('Зачаровать · звёзды','go/star/'+d.id,'',!isFree||d.stars===5)+(state.dragons.filter(x=>x.species===d.species).length>1?btn('Отпустить дубликата · +25 зол.','sell/'+d.id,'',!isFree):'')+'</div>');}
 else if(!state.seen.includes(s.id)&&s.rarity===1)controls=panel('Экспедиция','<p>Выберите жилище для нового дракона.</p>'+homes()+btn('Пригласить · '+unlockPrice(state)+' зол.','unlock/'+s.id,'primary'));
 return page(esc(s.name),'<div class="pills"><span>'+rarities[s.rarity]+'</span>'+elementBadges(s)+'</div><div class="plate" style="--element-a:'+colors[s.types[0]]+';--element-b:'+colors[s.types.at(-1)]+'">'+actorMarkup(d?.born&&s.id==='s3'&&d.level===1?'baby':s.id,esc(s.name))+'<button class="bones-toggle" data-do="skeleton" aria-pressed="false">Скелет</button><div class="poses" aria-label="Движение">'+[['idle','Покой'],['walk','Движение'],['attack','Атака']].map(([k,label])=>btn(label,'pose/'+k,k==='idle'?'active':'')).join('')+'</div></div>'+(s.id==='s3'?'<div class="lifecycle"><figure><img src="art/egg.webp" alt="Яйцо Янтарного кряжа"><figcaption>Яйцо</figcaption></figure><figure><img src="'+dragonAsset('thumbs/baby.svg')+'" alt="Детёныш Янтарного кряжа"><figcaption>Детёныш</figcaption></figure></div>':'')+controls+panel(roles[s.role]+' · '+skills[s.role],(s.types.length===1?'<p class="field-note">'+fieldNotes[s.types[0]]+'</p>':'')+'<p>Здоровье '+st.hp+' · удар '+st.power+' · дальность '+st.range+' · скорость '+st.speed+'</p><small>+25% урона по следующей стихии в круге: '+elements.join(' → ')+' → Огонь.</small>')+panel('Как получить',esc(method))+btn('В книгу','go/book'));
}
function homes(){return select('home',state.buildings.filter(b=>b.kind==='home').map(b=>opt(b.id,buildings.home+' '+cellName(b.col,b.row)+' · '+state.dragons.filter(d=>d.home===b.id).length+'/'+homeSize(b))).join(''),'Жилище');}
function nest(){
 const free=state.dragons.filter(d=>available(state,d,now()));if(!free.some(d=>d.id===pair[0]))pair[0]=free[0]?.id;if(!free.some(d=>d.id===pair[1])||pair[0]===pair[1])pair[1]=free.find(d=>d.id!==pair[0])?.id;
 const a=dragon(pair[0]),b=dragon(pair[1]),rows=a&&b?distribution(a,b):[],pct=percentages(rows);
 const choices=i=>select('p'+i,free.map((d,j)=>opt(d.id,byId[d.species].name+' · ур. '+d.level+' · №'+(state.dragons.indexOf(d)+1),pair[i])).join(''),'Родитель '+(i+1));
 const nests=state.buildings.filter(b=>b.kind==='nest'&&!state.eggs.some(e=>e.building===b.id)),inc=state.buildings.filter(b=>b.kind==='incubator'),slots=inc.reduce((n,b)=>n+b.slots-state.eggs.filter(e=>e.building===b.id).length,0);
 const jobs=state.eggs.map(e=>{const ready=e.end<=now(),nest=e.stage==='nest';return panel(nest?'Яйцо в гнезде':'Яйцо в инкубаторе','<img width="44" height="48" style="object-fit:contain;float:right" src="art/egg.webp" alt="Яйцо"><p>'+(ready?(nest?'Родители свободны':'Детёныш готов'):(nest?'Родители заняты ещё ':'До вылупления ')+cd(e.end))+'</p>'+(ready?(nest?select('inc-'+e.id,inc.filter(b=>state.eggs.filter(o=>o.building===b.id).length<b.slots).map(b=>opt(b.id,'Инкубатор · '+b.slots+' мест')).join(''),'Инкубатор')+btn('В инкубатор','incubate/'+e.id,'primary',!slots):homes().replace('id="home"','id="home-'+e.id+'"')+btn('Поселить детёныша','hatch/'+e.id,'primary')):btn('Ускорить · '+gemSpeed(e.end,now())+' ◈','speedE/'+e.id+'/'+gemSpeed(e.end,now()))) );}).join('');
 return page('Гнездо и яйца',jobs+panel('Родительская пара',free.length>=2?'<div class="tools">'+choices(0)+choices(1)+'</div>'+(a&&b&&a.species!==b.species&&byId[a.species].rarity===1&&byId[b.species].rarity===1?'<p class="breeding-guarantee"><b>Гарантирован редкий детёныш</b> · '+esc(labelTypes(byId[rows[0].id]))+'</p>':'')+'<p>Скрещивание '+duration(nestTime(state))+'. До этого срока оба родителя заняты. Свободно мест в инкубаторах: '+slots+'.</p><h3>Возможные детёныши</h3>'+rows.map((r,i)=>row(byId[r.id].name,rarities[byId[r.id].rarity]+' · вывод '+duration(hatchTime(state,r.id)),'<b>'+pct[i].toLocaleString('ru',{maximumFractionDigits:3})+'%</b>')).join('')+btn('Начать скрещивание','breed/'+(nests[0]?.id||''),'primary',!nests.length):'Нужны два свободных дракона.')+btn('Построить гнездо или инкубатор','go/build'));
}
function trials(){return page('Испытания',panel('Стихия награды',select('symbolType',elements.map((e,i)=>opt(i,e)).join(''),'Стихия символа'))+objectives(state).map(o=>row(o.name,(o.repeat?'Повторяемое · ':'')+Math.min(o.goal,Math.max(0,o.value-o.goal*o.claims))+' / '+o.goal+' · '+o.reward+' символов',btn('Получить','symbol/'+o.id,'',(!o.repeat&&o.claims)||o.value<(o.claims+1)*o.goal))).join('')+panel('Мои символы',elements.map((e,i)=>e+' '+state.symbols[i]).join(' · ')));}
function star(d){const s=byId[d.species],cost=starPrices[d.stars],old=stats(d),next=stats({...d,stars:d.stars+1});
 return page('Звёздное зачарование',panel(s.name,'<p>'+d.stars+' ★ → '+(d.stars+1)+' ★. Цена '+cost+' символов. Здоровье '+old.hp+' → '+next.hp+', удар '+old.power+' → '+next.power+'.</p>'+s.types.map(t=>'<label class="symbol">'+elements[t]+' · запас '+state.symbols[t]+' <input id="pay'+t+'" type="number" min="0" max="'+state.symbols[t]+'" value="'+(s.types.length===1?Math.min(cost,state.symbols[t]):0)+'"></label>').join('')+btn('Подтвердить расход','star/'+d.id,'primary'))+btn('За символами','go/trials'));}
function raids(){
 if(state.raid){const r=state.raid;if(!r.team.some(u=>u.id===selectedUnit))selectedUnit=r.team[0].id;return battleView(r)+'<div class="page compact side"><div class="side-intro"><small class="eyebrow">Набег</small><h2>Боевой отряд</h2></div><div class="unitlist">'+r.team.map(u=>btn(byId[u.species].name,'unit/'+u.id,selectedUnit===u.id?'active':'')).join('')+'</div><p class="hint">Выберите дракона и флаг для высадки. Коснитесь здания, чтобы назначить цель.</p><p class="target-info" id="target-info" aria-live="off"></p><div class="tools"><button class="primary" id="ability" data-do="skill">Способность</button>'+btn('Отойти','finish')+'</div></div>';}
 if(stage===null){stage=unlockedStage(state);chapter=stageInfo(stage).chapter;}
 if(warMode==='pvp'&&!opponents.some(o=>o.id===target))target=opponents[0]?.id||'';
 team=team.filter(id=>available(state,dragon(id),now()));
 return warRoom(state,{mode:warMode,stage,chapter,target,opponents,team,due:nextAttack,now:now()});
}
function journal(){
 const entries=history.length?history:state.reports;
 const reports=entries.map(r=>row((r.incoming?'Оборона · ':'Набег · ')+esc(r.enemy),esc(r.reason)+(r.source==='campaign'?' · '+r.stars+'/3 ★ · +'+r.experience+' опыта':'')+' · '+moscowDate(r.time)+' МСК<br>'+(r.incoming?'Потеряно ':'Добыча ')+r.loot.gold+' золота · '+r.loot.food+' еды',btn(r.replay?'Повтор и разбор':'Итог','go/replay/'+r.id))).join('');
 return page('Журнал острова',panel('Следующий налёт','<p>'+moscowDate(nextAttack)+' МСК · волна '+state.invasionLevel+'. После успешной обороны придёт более сильный отряд.</p><p>'+(state.shield>now()?'Щит против игроков до '+moscowDate(state.shield)+' МСК.':'Остров открыт для набегов игроков.')+'</p>')+panel('Боевые записи',reports||'Первый отчёт появится после боя.')+(historyError?btn('Повторить загрузку','history'):'')+(hasMore?btn('Более ранние бои','older'):'')+panel('Кристаллы · '+wallet.balance,row('Стартовый бонус','Одно начисление на игрока','+50 ◈')+Object.entries(wallet.days).sort().reverse().slice(0,20).map(([d,v])=>row(d,v.cards+' карточек','+'+v.gems+' ◈')).join('')));
}
async function loadHistory(append=false){
 const token=++historyRequest;historyError='';
 const last=append?history.at(-1):null;
 try{const data=await request({action:'history',before:last?.time,key:last?.id});
  if(token!==historyRequest||route()!=='log')return;
  const rows=data.result||[];hasMore=rows.length>20;history=[...(append?history:[]),...rows.slice(0,20)];render();
 }catch(e){if(route()==='log'){historyError=e.message;message(e.message);render();}}
}
async function loadMatch(id){
 const token=++matchRequest;match=null;matchError='';render();
 try{const data=await request({action:'recording',id});if(token!==matchRequest||route()!=='replay/'+id)return;match=data.result;render();}
 catch(e){if(token===matchRequest&&route()==='replay/'+id){matchError=e.message;render();}}
}
function render(){
 if(!state)return;const [p,k]=route().split('/');let body,sect=p;switch(p){
 case 'residents':body=page('Мои драконы',roster()+islandLink);sect='island';break;
 case 'book':body=book();break;case 'species':body=byId[k]?detail(byId[k]):book();sect='book';break;
 case 'dragon':body=dragon(k)?detail(byId[dragon(k).species],dragon(k)):book();sect='book';break;
 case 'star':body=dragon(k)?star(dragon(k)):island();sect='island';break;case 'build':body=shop(state,wallet,shopTab);sect='island';break;
 case 'nest':body=nest();break;case 'trials':body=trials();sect='island';break;case 'raids':body=raids();break;case 'replay':body=matchError?page('Повтор боя','<p>'+esc(matchError)+'</p>'+btn('Повторить','loadMatch/'+k)):replayPage(match?.report.id===k?match:null);sect='raids';break;case 'log':body=journal();sect='island';break;default:body=island();sect='island';
 }
 const mapKey=p==='raids'&&state.raid?'battle/'+state.raid.id:(p==='island'?'island':null);
 renderShell($('#app'),shell(body,sect),mapKey);
 const map=$('.map');let focus={x:.5,y:.36};
 if(map&&!map.classList.contains('battle')){
  const points=state.buildings.map(b=>{const p=position(b);return project(p.x,p.y);});
  focus={x:points.reduce((n,p)=>n+p.x,0)/points.length/1000,y:points.reduce((n,p)=>n+p.y,0)/points.length/960+.018};
 }
 mountCamera(map,map?.classList.contains('battle')?'battle/'+state.raid.id:'island',focus);
 mountActors($('#app'));mountReplay(p==='replay'?match?.recording:null);
 $('#app .pending-command')?.remove();if(sessionStorage.getItem(pendingKey()))$('#app').insertAdjacentHTML('afterbegin','<div class="panel pending-command">'+btn('Повторить отправку','retry')+'</div>');
}
async function mapLoad(){try{const previous=state;const r=await request({action:'map'});opponents=r.islands||[];if(!busy&&state===previous)accept(r);if(route()==='raids'&&!state.raid)render();}catch(e){message(e.message);}}
function enter(){
 if(!state)return;
 if(route().startsWith('replay/')){loadMatch(route().slice(7));return;}
 render();
 if(route()==='log'){loadHistory();return;}
 if(route()==='raids'&&warMode==='pvp'&&!state.raid)mapLoad();
}
window.addEventListener('hashchange',enter);
document.addEventListener('change',e=>{if(!state)return;const id=e.target.id;if(/^f[012]$/.test(id)){filters[+id[1]]=e.target.value;render();}if(/^p[01]$/.test(id)){const i=+id[1],prev=pair[i];pair[i]=e.target.value;if(pair[1-i]===pair[i])pair[1-i]=prev;render();}if(id==='enemy'){target=e.target.value;render();}if(id==='chapter'){chapter=Number(e.target.value);stage=chapter*20+1;render();}});
document.addEventListener('click',async e=>{
 const cell=e.target.closest('[data-cell]');if(cell&&plotMode){if(busy)return;if(cell.getAttribute('aria-disabled')==='true'){message('Клетка занята');return;}plotMode.cell=Number(cell.dataset.cell);render();return;}
 const el=e.target.closest('button');if(!el||!state||el.disabled)return;
 if(el.dataset.building){chosen=el.dataset.building;render();return;}
 if(el.dataset.dragon){go('dragon/'+el.dataset.dragon);return;}
 const r=state.raid,order=(name,extra={})=>action({action:'order',raid:r.id,unit:selectedUnit,order:name,...extra});
 if(el.dataset.shore!==undefined){await order('land',{shore:+el.dataset.shore});return;}
 if(el.dataset.mark){await order('target',{mark:el.dataset.mark});return;}
 if(el.dataset.unit){if(r.team.some(d=>d.id===el.dataset.unit)){selectedUnit=el.dataset.unit;render();}else await order('target',{mark:el.dataset.unit});return;}
 const [a,k,v]=String(el.dataset.do||'').split('/');
 switch(a){
 case 'skeleton':{const actor=$('.plate .actor');if(actor){const on=actor.dataset.bones!=='on';actor.dataset.bones=on?'on':'off';el.setAttribute('aria-pressed',String(on));}break;}
 case 'pose':{const actor=$('.plate .actor');if(actor){actor.dataset.pose=k;for(const b of document.querySelectorAll('.poses button'))b.classList.toggle('active',b===el);}break;}
 case 'rehome':await action({action:'rehome',dragon:k,building:val('#relocate')},'Дракон переселился');break;
 case 'residentsPage':rotateResidents(state,k);render();break;
 case 'showHome':{const d=dragon(k);chosen=showResident(state,k)||d.home;const b=thing(chosen);if(b){const p=position(b),f=project(p.x,p.y);focusCamera('island',f.x/1000,f.y/960);}go('island');break;}
 case 'shop':shopTab=k;render();break;
 case 'war':warMode=k;render();if(k==='pvp')mapLoad();break;
 case 'stage':stage=+k;chapter=stageInfo(stage).chapter;render();break;
 case 'history':case 'older':await loadHistory(a==='older');break;
 case 'loadMatch':await loadMatch(k);break;
 case 'campaignClaim':await action({action:'campaignClaim',stage:+k},'Награда переведена на склады');break;
 case 'go':if(k==='book'&&el.closest('.dock'))filters=['','','own'];if(k==='build')shopTab='owned';plotMode=null;go(k+(v?'/'+v:''));break;case 'clear':chosen='';render();break;case 'selectB':chosen=k;go('island');break;
 case 'retry':{const p=JSON.parse(sessionStorage.getItem(pendingKey())||'null');if(p)await action(p.cmd,'Действие подтверждено');break;}
 case 'move':if(busy)break;plotMode={action:'move',building:k};go('island');break;
 case 'place':if(busy)break;plotMode={action:'build',kind:k};go('island');break;
 case 'cancelPlot':plotMode=null;render();break;
 case 'confirmPlot':{if(plotMode?.cell==null)break;const {cell,...cmd}=plotMode;
   await action({...cmd,col:cell%boardSize,row:Math.floor(cell/boardSize)},'Планировка сохранена',()=>{plotMode=null;});break;}
 case 'collect':case 'upgrade':case 'slot':await action({action:a,building:k},'Остров обновлён');break;
 case 'speedB':case 'speedE':await action({action:'speed',[a==='speedB'?'building':'egg']:k,max:+v},'Готово');break;
 case 'feed':case 'guard':case 'sell':await action({action:a,dragon:k},'Изменения сохранены',a==='sell'?()=>go('island'):null);break;
 case 'star':{const pay=elements.map((_,i)=>Number(val('#pay'+i)||0));await action({action:'star',dragon:k,pay},'Новая звезда! Остаток символов: '+byId[dragon(k).species].types.map(t=>elements[t]+' '+(state.symbols[t]-pay[t])).join(', '),()=>go('dragon/'+k));break;}
 case 'symbol':await action({action:a,type:+val('#symbolType'),objective:k},'Символы получены');break;
 case 'unlock':await action({action:a,species:k,building:val('#home')},'Новый дракон на острове');break;
 case 'breed':await action({action:a,dragon:pair[0],other:pair[1],building:k},'Родители в гнезде');break;
 case 'incubate':case 'hatch':await action({action:a,egg:k,building:val('#'+(a==='hatch'?'home-':'inc-')+k)},a==='hatch'?'Добро пожаловать на остров!':'Яйцо в тепле');break;
 case 'team':if(team.includes(k))team=team.filter(id=>id!==k);else if(team.length<3)team.push(k);else message('В отряде три места');render();break;
 case 'map':await mapLoad();break;case 'raid':await action({action:a,target:warMode==='pvp'?target:stageTarget(stage||1),team:[...team]},'Выберите берег высадки');break;
 case 'unit':selectedUnit=k;render();break;case 'skill':await order('skill');break;case 'finish':if(r)await action({action:'finish',raid:r.id},'Итог боя сохранён',()=>go('log'));break;
 }
});
document.addEventListener('keydown',e=>{const cell=e.target.closest?.('[data-cell]');if(cell&&(e.key==='Enter'||e.key===' ')){e.preventDefault();cell.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
let lastPaint=0,lastPoll=Date.now(),endedAt=0;
function frame(time){
 if(!document.hidden&&state){
  if(time-lastPaint>(state.raid||route().startsWith('dragon/')||route().startsWith('species/')?12:42)){lastPaint=time;const r=state.raid;
    if(r&&route()==='raids'){const sim=paintBattle(r,now(),selectedUnit);if(!sim?.end)endedAt=0;else if(!endedAt)endedAt=Date.now();if(sim?.end&&Date.now()-endedAt>1050&&!busy&&!sessionStorage.getItem(pendingKey()))action({action:'finish',raid:r.id},'Бой завершён',()=>go('log'));}
    else if(!cameraMoving())idle(time);
    for(const t of document.querySelectorAll('time[data-end]')){const text=duration(+t.dataset.end-now());if(t.textContent!==text){t.textContent=text;if(text==='0 с'&&!busy)render();}}
  }
  const overdue=nextAttack&&now()>=nextAttack;
  if(Date.now()-lastPoll>(overdue?1500:15000)&&!busy&&!sessionStorage.getItem(pendingKey())){
   if(overdue||(!state.raid&&['island','log'].includes(route())&&!document.activeElement?.matches('input,select'))){lastPoll=Date.now();fetchState().catch(()=>{});}
  }
 }
 requestAnimationFrame(frame);
}
async function start(){try{await identifySession();await fetchState();if(state.raid&&route()==='island')go('raids');if(route()==='log')await loadHistory();if(route().startsWith('replay/'))await loadMatch(route().slice(7));requestAnimationFrame(frame);}
catch(e){$('#app').innerHTML=page('Остров драконов','<p>'+esc(e.message)+'</p><div class="tools"><a class="action" href="../?island=1">Войти в «Фаги»</a><a class="action" href="?tour=1">Открыть пробную сцену</a></div>');}}
start();
