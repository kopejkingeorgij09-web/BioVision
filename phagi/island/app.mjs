import {defenses,defenseText} from './defenses.mjs';
import {cellName} from './board.mjs';
import {species,byId,elements,rarities,roles,skills,signs,stats,distribution,percentages,pairing,starPrices,foodPrice} from './catalog.mjs';
import {buildings,total,capacity,room,available,upgrade,buildCost,gemSpeed,production,homeSize,objectives,unlockPrice,nestTime,hatchTime,npcWorld} from './game.mjs';
import {art,escape as esc,islandMap,battleView,paintBattle,idle} from './paint.mjs';
import {request,pendingKey,tour,identifySession} from './client.mjs';
const $=s=>document.querySelector(s), val=s=>$(s)?.value, btn=(label,a,cl='',disabled=false)=>'<button class="'+cl+'" data-do="'+a+'" '+(disabled?'disabled':'')+'>'+label+'</button>';
const opt=(v,l,sel)=>'<option value="'+esc(v)+'" '+(String(sel)===String(v)?'selected':'')+'>'+esc(l)+'</option>';
const select=(id,html,label)=>'<select aria-label="'+label+'" id="'+id+'">'+html+'</select>';
const row=(name,details,control='')=>'<div class="row"><div><b>'+name+'</b><br><small>'+details+'</small></div>'+control+'</div>';
const panel=(title,body)=>'<section class="panel"><h3>'+title+'</h3>'+body+'</section>';
const labelTypes=s=>s.types.map(t=>signs[t]+' '+elements[t]).join(' · ');
const duration=ms=>{const n=Math.max(0,Math.ceil(ms/1000));return n>=3600?Math.floor(n/3600)+' ч '+Math.floor(n%3600/60)+' мин':n>=60?Math.floor(n/60)+' мин '+n%60+' с':n+' с';};
const date=t=>new Date(t).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
let state,wallet,offset=0,busy=false,chosen='',selectedUnit='',opponents=[],team=[],target='npc:reef',pair=[],filters=['','',''],plotMode=null,toastTimer;
let route=()=>decodeURIComponent(location.hash.slice(1))||'island';
const now=()=>Date.now()+offset, cd=end=>'<time data-end="'+end+'">'+duration(end-now())+'</time>';
const thing=id=>state.buildings.find(b=>b.id===id),dragon=id=>state.dragons.find(d=>d.id===id);
function message(text){$('#notice').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#notice').textContent='',4200);}
function go(page){if(route()===page)render();else location.hash=page;scrollTo(0,0);}
function accept(r){state=r.state;wallet=r.wallet;offset=r.now-Date.now();if(r.islands)opponents=r.islands;}
async function fetchState(){
 const previous=state,r=await request({action:'read'});
 if(busy||state!==previous)return;
 accept(r);render();
}
async function action(cmd,msg,after){
 if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');
 const key=pendingKey();let p;
 try{p=JSON.parse(sessionStorage.getItem(key)||'null');if(p&&JSON.stringify(p.cmd)!==JSON.stringify(cmd)){message('Сначала подтвердите ранее отправленное действие');return;}
   p=p||{op:crypto.randomUUID(),cmd};sessionStorage.setItem(key,JSON.stringify(p));
   const r=await request(cmd,p.op);accept(r);sessionStorage.removeItem(key);
   if(after)after(r);render();if(msg)message(msg);
 }catch(e){if(!e.retry)sessionStorage.removeItem(key);message(e.message);render();}
 finally{busy=false;document.body.removeAttribute('aria-busy');}
}
function availability(d){
 if(d.guard)return 'Гарнизон';if(d.recover>now())return 'Восстановление до '+date(d.recover);
 if(state.raid?.team.some(x=>x.id===d.id))return 'В набеге';
 const e=state.eggs.find(e=>e.parents.includes(d.id)&&e.stage==='nest'&&e.end>now());return e?'В гнезде до '+date(e.end):'Свободен';
}
const docks=[['island','⌂','Остров'],['book','▤','Книга'],['nest','◉','Гнездо'],['raids','⚑','Набеги']];
const shell=(body,section)=>'<header><a href="../">‹ Фаги</a><span>'+(tour?'Мастерская · пробная сцена':'Архипелаг')+'</span><small>Остров драконов</small></header><div class="wallet"><span title="Золото"><i class="coin">•</i>'+total(state,'gold')+'</span><span title="Еда"><i class="fruit">⌁</i>'+total(state,'food')+'</span><span title="Алмазы"><i class="gem">⋄</i>'+wallet.balance+'</span></div><div class="layout">'+body+'</div><nav class="dock">'+docks.map(([p,ico,l])=>btn('<span aria-hidden="true">'+ico+'</span>'+l,'go/'+p,p===section?'active':'')).join('')+'</nav>';
const page=(title,html)=>'<div class="page"><h1>'+title+'</h1>'+html+'</div>';
const islandLink=btn('На остров','go/island');
function roster(){return state.dragons.map(d=>row(esc(byId[d.species].name),'Ур. '+d.level+' · '+d.stars+' ★ · '+availability(d),btn('Осмотреть','go/dragon/'+d.id))).join('');}
function island(){const b=thing(chosen);
 if(plotMode){
 const k=plotMode.kind||thing(plotMode.building)?.kind, i=plotMode.cell,c=buildCost(k);
 const where=i==null?'Коснитесь свободной клетки.':'Клетка '+cellName(i%5,Math.floor(i/5));
 const price=plotMode.action==='move'?'Перемещение бесплатно':c.gold?'Цена '+c.gold+' золота':'Цена '+c.gems+' ◈';
 return islandMap(state,chosen,plotMode)+'<div class="page compact side">'+panel(buildings[k],'<p>'+where+' '+price+'.</p>'+(defenses[k]?'<p>'+defenses[k].role+'</p><small>'+defenseText(k,thing(plotMode.building)?.level||1)+'</small>':'')+'<div class="tools">'+btn('Подтвердить','confirmPlot','primary',i==null)+btn('Отмена','cancelPlot')+'</div>')+'</div>';
 }
 return islandMap(state,chosen)+'<div class="page compact side"><div class="side-intro"><small class="eyebrow">Янтарный берег</small><h2>Управление островом</h2></div>'+(b?buildingPanel(b):panel('Мой остров','<div class="tools">'+btn('Постройки и оборона','go/build','primary')+btn('Испытания','go/trials')+btn('Журнал','go/log')+'</div>'))+'<h2 class="subhead">Мои драконы</h2>'+roster()+'</div>';
}
function buildingPanel(b){const kind=b.kind,u=upgrade(b);let details='';
 if(['food','gold'].includes(kind))details='Запас '+b.stock+' / '+capacity(b)+'. Улучшение добавит 1000 мест.';
 if(['mine','farm'].includes(kind))details='Готово к сбору: '+production(b,now())+'. Темп '+b.level+' за 10 с. '+btn('Собрать','collect/'+b.id,'primary');
 if(kind==='home')details='Занято '+state.dragons.filter(d=>d.home===b.id).length+' из '+homeSize(b)+' мест. Улучшение добавит 4 места.';
 if(kind==='garrison')details='До трёх защитников. Назначение — в карточке дракона.';
 if(defenses[kind])details=defenses[kind].role+'<br>'+defenseText(kind,b.level);
 if(kind==='incubator')details='Параллельное вылупление: '+b.slots+' '+(b.slots===1?btn('Второе место · 40 ◈ (4 нормы)','slot/'+b.id):'');
 if(kind==='nest'||kind==='incubator')details+=' '+btn('К яйцам','go/nest');
 if(defenses[kind]&&b.level<30)details+='<br><small>После улучшения: '+defenseText(kind,b.level+1)+'</small>';
 else if(!defenses[kind])details+='<br><small>Следующий уровень: прочность +25% от базовой.'+({tower:' Урон башни +9.',mine:' Производство +1 за 10 с.',farm:' Производство +1 за 10 с.'}[kind]||'')+'</small>';
 return panel(buildings[kind]+' · '+cellName(b.col,b.row)+' · ур. '+b.level,'<p>'+details+'</p><div class="tools">'+btn('Переместить','move/'+b.id)+(b.finish?'Строительство '+cd(b.finish)+btn('Ускорить · '+gemSpeed(b.finish,now())+' ◈','speedB/'+b.id+'/'+gemSpeed(b.finish,now())):b.level<30?btn('Улучшить до '+(b.level+1)+' · '+u.price+' зол. · '+duration(u.ms),'upgrade/'+b.id):'')+btn('Закрыть','clear')+'</div>');
}
function build(){
 const open=25-state.buildings.length;
 const listing=([k,l])=>{const c=buildCost(k),cost=c.gems?c.gems+' ◈ ('+c.gems/10+' дневных наград)':c.gold+' золота';
 return row('<img class="build-thumb" src="art/'+k+'.webp" alt="">'+l,(defenses[k]?defenses[k].role+' ':'')+cost,btn('Разместить','place/'+k,'',!open));};
 return page('План острова','<p class="muted">5 × 5 клеток · свободно '+open+'.</p><h2>Оборона</h2>'+Object.entries(buildings).filter(([k])=>defenses[k]).map(listing).join('')+'<h2 class="subhead">Хозяйство</h2>'+Object.entries(buildings).filter(([k])=>!defenses[k]).map(listing).join('')+'<h2 class="subhead">На острове</h2>'+state.buildings.map(b=>row(buildings[b.kind],'Клетка '+cellName(b.col,b.row)+' · уровень '+b.level,btn('Выбрать','selectB/'+b.id))).join(''));
}
function book(){
 const list=species.filter(s=>(!filters[0]||s.types.includes(+filters[0]-1))&&(!filters[1]||s.rarity===+filters[1])&&(!filters[2]||(filters[2]==='own'?state.dragons.some(d=>d.species===s.id):!state.seen.includes(s.id))));
 return page('Книга драконов','<p class="muted">Открыто '+state.seen.length+' из '+species.length+' видов</p><div class="filters">'+select('f0',opt('','Стихии')+elements.map((e,i)=>opt(i+1,e,filters[0])).join(''),'Стихия')+select('f1',opt('','Редкость')+rarities.slice(1).map((e,i)=>opt(i+1,e,filters[1])).join(''),'Редкость')+select('f2',opt('','Все виды')+opt('own','Мои',filters[2])+opt('new','Не открыты',filters[2]),'Наличие')+'</div><div class="grid">'+list.map(s=>'<button class="spec" data-do="go/species/'+s.id+'">'+art(s)+'<span class="label"><b>'+esc(s.name)+'</b><small>'+labelTypes(s)+'</small></span></button>').join('')+'</div>');
}
function detail(s,d=null){
 const st=stats(d||{species:s.id,level:1,stars:0}),next=d?stats({...d,level:d.level+1}):null;
 const parents=s.rarity>1?pairing(s.id):[];
 const method=s.rarity===1?(s.id==='s1'||s.id==='s3'?'Стартовая пара острова.':'Экспедиция за золото.'):parents.length?parents.map(p=>p.name).join(' × '):'Скрещивание доступных родителей.';
 let controls='';
 if(d){const isFree=available(state,d,now());
 controls=panel('Рост и назначение','<p>Уровень '+d.level+' / 30 · '+d.stars+' / 5 ★ · '+availability(d)+'</p>'+ (d.level<30?'<p>После кормления: здоровье '+st.hp+' → '+next.hp+', удар '+st.power+' → '+next.power+'. Уровень учитывается при разведении.</p>'+btn('Кормить · '+foodPrice(d.level)+' еды','feed/'+d.id,'primary',!isFree):'')+'<div class="tools">'+btn(d.guard?'Снять из гарнизона':'В гарнизон','guard/'+d.id,'',!d.guard&&!isFree)+btn('Улучшить звезду','go/star/'+d.id,'',!isFree||d.stars===5)+(state.dragons.filter(x=>x.species===d.species).length>1?btn('Отпустить дубликата · +25 зол.','sell/'+d.id,'',!isFree):'')+'</div>');}
 else if(!state.seen.includes(s.id)&&s.rarity===1)controls=panel('Экспедиция','<p>Выберите жилище для нового дракона.</p>'+homes()+btn('Пригласить · '+unlockPrice(state)+' зол.','unlock/'+s.id,'primary'));
 return page(esc(s.name),'<div class="pills"><span>'+rarities[s.rarity]+'</span><span>'+labelTypes(s)+'</span></div><div class="plate">'+(d?.born&&s.id==='s3'&&d.level===1?'<img src="art/baby.webp" alt="Земной детёныш">':art(s,'portrait'))+'<span class="figure">'+s.name+'</span></div>'+(s.id==='s3'?'<div class="lifecycle"><figure><img src="art/egg.webp" alt="Яйцо Янтарного кряжа"><figcaption>Яйцо</figcaption></figure><figure><img src="art/baby.webp" alt="Детёныш Янтарного кряжа"><figcaption>Детёныш</figcaption></figure></div>':'')+controls+panel(roles[s.role]+' · '+skills[s.role],'<p>Здоровье '+st.hp+' · удар '+st.power+' · дальность '+st.range+' · скорость '+st.speed+'</p><small>+25% урона по следующей стихии в круге: '+elements.join(' → ')+' → Огонь.</small>')+panel('Как получить',esc(method))+btn('В книгу','go/book'));
}
function homes(){return select('home',state.buildings.filter(b=>b.kind==='home').map(b=>opt(b.id,buildings.home+' · '+state.dragons.filter(d=>d.home===b.id).length+'/'+homeSize(b))).join(''),'Жилище');}
function nest(){
 const free=state.dragons.filter(d=>available(state,d,now()));if(!free.some(d=>d.id===pair[0]))pair[0]=free[0]?.id;if(!free.some(d=>d.id===pair[1])||pair[0]===pair[1])pair[1]=free.find(d=>d.id!==pair[0])?.id;
 const a=dragon(pair[0]),b=dragon(pair[1]),rows=a&&b?distribution(a,b):[],pct=percentages(rows);
 const choices=i=>select('p'+i,free.map((d,j)=>opt(d.id,byId[d.species].name+' · ур. '+d.level+' · №'+(state.dragons.indexOf(d)+1),pair[i])).join(''),'Родитель '+(i+1));
 const nests=state.buildings.filter(b=>b.kind==='nest'&&!state.eggs.some(e=>e.building===b.id)),inc=state.buildings.filter(b=>b.kind==='incubator'),slots=inc.reduce((n,b)=>n+b.slots-state.eggs.filter(e=>e.building===b.id).length,0);
 const jobs=state.eggs.map(e=>{const ready=e.end<=now(),nest=e.stage==='nest';return panel(nest?'Яйцо в гнезде':'Яйцо в инкубаторе','<img width="44" height="48" style="object-fit:contain;float:right" src="art/egg.webp" alt="Яйцо"><p>'+(ready?(nest?'Родители свободны':'Детёныш готов'):(nest?'Родители заняты ещё ':'До вылупления ')+cd(e.end))+'</p>'+(ready?(nest?select('inc-'+e.id,inc.filter(b=>state.eggs.filter(o=>o.building===b.id).length<b.slots).map(b=>opt(b.id,'Инкубатор · '+b.slots+' мест')).join(''),'Инкубатор')+btn('В инкубатор','incubate/'+e.id,'primary',!slots):homes().replace('id="home"','id="home-'+e.id+'"')+btn('Поселить детёныша','hatch/'+e.id,'primary')):btn('Ускорить · '+gemSpeed(e.end,now())+' ◈','speedE/'+e.id+'/'+gemSpeed(e.end,now()))) );}).join('');
 return page('Гнездо и яйца',jobs+panel('Родительская пара',free.length>=2?'<div class="tools">'+choices(0)+choices(1)+'</div><p>Скрещивание '+duration(nestTime(state))+'. До этого срока оба родителя заняты. Свободно мест в инкубаторах: '+slots+'.</p><h3>Возможные детёныши</h3>'+rows.map((r,i)=>row(byId[r.id].name,rarities[byId[r.id].rarity]+' · вывод '+duration(hatchTime(state,r.id)),'<b>'+pct[i].toLocaleString('ru',{maximumFractionDigits:3})+'%</b>')).join('')+btn('Начать скрещивание','breed/'+(nests[0]?.id||''),'primary',!nests.length):'Нужны два свободных дракона.')+btn('Построить гнездо или инкубатор','go/build'));
}
function trials(){return page('Испытания',panel('Стихия награды',select('symbolType',elements.map((e,i)=>opt(i,e)).join(''),'Стихия символа'))+objectives(state).map(o=>row(o.name,(o.repeat?'Повторяемое · ':'')+Math.min(o.goal,Math.max(0,o.value-o.goal*o.claims))+' / '+o.goal+' · '+o.reward+' символов',btn('Получить','symbol/'+o.id,'',(!o.repeat&&o.claims)||o.value<(o.claims+1)*o.goal))).join('')+panel('Мои символы',elements.map((e,i)=>e+' '+state.symbols[i]).join(' · ')));}
function star(d){const s=byId[d.species],cost=starPrices[d.stars],old=stats(d),next=stats({...d,stars:d.stars+1});
 return page('Звезда дракона',panel(s.name,'<p>'+d.stars+' ★ → '+(d.stars+1)+' ★. Цена '+cost+' символов. Здоровье '+old.hp+' → '+next.hp+', удар '+old.power+' → '+next.power+'.</p>'+s.types.map(t=>'<label class="symbol">'+elements[t]+' · запас '+state.symbols[t]+' <input id="pay'+t+'" type="number" min="0" max="'+state.symbols[t]+'" value="'+(s.types.length===1?Math.min(cost,state.symbols[t]):0)+'"></label>').join('')+btn('Подтвердить расход','star/'+d.id,'primary'))+btn('За символами','go/trials'));}
function raids(){
 if(state.raid){const r=state.raid;if(!r.team.some(u=>u.id===selectedUnit))selectedUnit=r.team[0].id;return battleView(r)+'<div class="page compact side"><div class="side-intro"><small class="eyebrow">Набег</small><h2>Боевой отряд</h2></div><div class="unitlist">'+r.team.map(u=>btn(byId[u.species].name,'unit/'+u.id,selectedUnit===u.id?'active':'')).join('')+'</div><p class="hint">Выберите дракона и флаг для высадки. Коснитесь здания, чтобы назначить цель.</p><p class="target-info" id="target-info" aria-live="off"></p><div class="tools"><button class="primary" id="ability" data-do="skill">Способность</button>'+btn('Отойти','finish')+'</div></div>';}
 const npcs=['reef','pine','summit'].map(k=>{const s=npcWorld(k,now());return {id:'npc:'+k,name:s.name,map:s.buildings,guards:0,shield:0};});
 const all=[...npcs,...opponents],o=all.find(o=>o.id===target)||npcs[0];target=o.id;
 team=team.filter(k=>available(state,dragon(k),now()));
 const expected=k=>Math.min(room(state,k),o.map.filter(b=>b.kind===k).reduce((a,b)=>a+Math.floor(.8*b.stock),0));
 return page('Карта набегов',select('enemy',all.map(o=>opt(o.id,o.name+(o.id.startsWith('npc:')?' · игровой остров':' · игрок'),target)).join(''),'Цель набега')+panel(esc(o.name),'<p>Добыча при разрушении: до '+expected('gold')+' золота и '+expected('food')+' еды.</p><small>Оборона: '+o.map.filter(b=>Object.hasOwn(defenses,b.kind)).map(b=>buildings[b.kind]+' '+b.level).join(', ')+' · защитников '+o.guards+'.</small>')+panel('Отряд · '+team.length+'/3',state.dragons.map(d=>btn((team.includes(d.id)?'✓ ':'')+byId[d.species].name+' · '+availability(d),'team/'+d.id,team.includes(d.id)?'active':'',!available(state,d,now()))).join(' '))+
 '<p class="hint">'+(o.shield>now()?'Щит противника до '+date(o.shield):o.id.startsWith('npc:')?'На игровых островах ваш щит сохраняется.':'Нападение на игрока снимает ваш щит. Потеря ресурсов даёт защитнику 12 часов защиты.')+'</p>'+btn('Начать набег','raid','primary',!team.length||o.shield>now())+' '+btn('Обновить карту','map')+' '+btn('Отчёты','go/log'));
}
function journal(){return page('Журнал острова',panel('Защита острова',state.shield>now()?'Щит до '+date(state.shield):'Щит снят')+panel('Алмазы · '+wallet.balance,Object.entries(wallet.days).sort().reverse().slice(0,20).map(([d,v])=>row(d,v.cards+' карточек','+'+v.gems+' ◈')).join('')||'За 20 зачтённых карточек полагается 10 алмазов.')+state.reports.map(r=>panel((r.incoming?'Защита · ':'Набег · ')+esc(r.enemy),'<p>'+esc(r.reason)+' · '+date(r.time)+'</p>Разрушено: '+(r.destroyed.map(k=>buildings[k]||'Защитник').join(', ')||'0')+'<br>'+ (r.incoming?'Потеряно':'Добыча')+': '+r.loot.gold+' золота, '+r.loot.food+' еды.')).join(''));}
function render(){
 if(!state)return;const [p,k]=route().split('/');let body,sect=p;switch(p){
 case 'book':body=book();break;case 'species':body=byId[k]?detail(byId[k]):book();sect='book';break;
 case 'dragon':body=dragon(k)?detail(byId[dragon(k).species],dragon(k)):island();sect='island';break;
 case 'star':body=dragon(k)?star(dragon(k)):island();sect='island';break;case 'build':body=build();sect='island';break;
 case 'nest':body=nest();break;case 'trials':body=trials();sect='island';break;case 'raids':body=raids();break;case 'log':body=journal();sect='island';break;default:body=island();sect='island';
 }
 $('#app').innerHTML=shell(body,sect);if(sessionStorage.getItem(pendingKey()))$('#app').insertAdjacentHTML('afterbegin','<div class="panel">'+btn('Повторить отправку','retry')+'</div>');
}
async function mapLoad(){try{accept(await request({action:'map'}));render();}catch(e){message(e.message);}}
window.addEventListener('hashchange',()=>{render();if(route()==='raids'&&!state?.raid)mapLoad();});
document.addEventListener('change',e=>{if(!state)return;const id=e.target.id;if(/^f[012]$/.test(id)){filters[+id[1]]=e.target.value;render();}if(/^p[01]$/.test(id)){const i=+id[1],prev=pair[i];pair[i]=e.target.value;if(pair[1-i]===pair[i])pair[1-i]=prev;render();}if(id==='enemy'){target=e.target.value;render();}});
document.addEventListener('click',async e=>{
 const cell=e.target.closest('[data-cell]');if(cell&&plotMode){if(cell.getAttribute('aria-disabled')==='true'){message('Клетка занята');return;}plotMode.cell=Number(cell.dataset.cell);render();return;}
 const el=e.target.closest('button');if(!el||!state||el.disabled)return;
 if(el.dataset.building){chosen=el.dataset.building;render();return;}
 if(el.dataset.dragon){go('dragon/'+el.dataset.dragon);return;}
 const r=state.raid,order=(name,extra={})=>action({action:'order',raid:r.id,unit:selectedUnit,order:name,...extra});
 if(el.dataset.shore!==undefined){await order('land',{shore:+el.dataset.shore});return;}
 if(el.dataset.mark){await order('target',{mark:el.dataset.mark});return;}
 if(el.dataset.unit){if(r.team.some(d=>d.id===el.dataset.unit)){selectedUnit=el.dataset.unit;render();}else await order('target',{mark:el.dataset.unit});return;}
 const [a,k,v]=String(el.dataset.do||'').split('/');
 switch(a){
 case 'go':plotMode=null;go(k+(v?'/'+v:''));break;case 'clear':chosen='';render();break;case 'selectB':chosen=k;go('island');break;
 case 'retry':{const p=JSON.parse(sessionStorage.getItem(pendingKey())||'null');if(p)await action(p.cmd,'Действие подтверждено');break;}
 case 'move':plotMode={action:'move',building:k};go('island');break;
 case 'place':plotMode={action:'build',kind:k};go('island');break;
 case 'cancelPlot':plotMode=null;render();break;
 case 'confirmPlot':{if(plotMode?.cell==null)break;const {cell,...cmd}=plotMode;
   await action({...cmd,col:cell%5,row:Math.floor(cell/5)},'Планировка сохранена',()=>{plotMode=null;});break;}
 case 'collect':case 'upgrade':case 'slot':await action({action:a,building:k},'Остров обновлён');break;
 case 'speedB':case 'speedE':await action({action:'speed',[a==='speedB'?'building':'egg']:k,max:+v},'Готово');break;
 case 'feed':case 'guard':case 'sell':await action({action:a,dragon:k},'Изменения сохранены',a==='sell'?()=>go('island'):null);break;
 case 'star':{const pay=elements.map((_,i)=>Number(val('#pay'+i)||0));await action({action:'star',dragon:k,pay},'Новая звезда! Остаток символов: '+byId[dragon(k).species].types.map(t=>elements[t]+' '+(state.symbols[t]-pay[t])).join(', '),()=>go('dragon/'+k));break;}
 case 'symbol':await action({action:a,type:+val('#symbolType'),objective:k},'Символы получены');break;
 case 'unlock':await action({action:a,species:k,building:val('#home')},'Новый дракон на острове');break;
 case 'breed':await action({action:a,dragon:pair[0],other:pair[1],building:k},'Родители в гнезде');break;
 case 'incubate':case 'hatch':await action({action:a,egg:k,building:val('#'+(a==='hatch'?'home-':'inc-')+k)},a==='hatch'?'Добро пожаловать на остров!':'Яйцо в тепле');break;
 case 'team':if(team.includes(k))team=team.filter(id=>id!==k);else if(team.length<3)team.push(k);else message('В отряде три места');render();break;
 case 'map':await mapLoad();break;case 'raid':await action({action:a,target,team:[...team]},'Выберите берег высадки');break;
 case 'unit':selectedUnit=k;render();break;case 'skill':await order('skill');break;case 'finish':if(r)await action({action:'finish',raid:r.id},'Итог боя сохранён',()=>go('log'));break;
 }
});
document.addEventListener('keydown',e=>{const cell=e.target.closest?.('[data-cell]');if(cell&&(e.key==='Enter'||e.key===' ')){e.preventDefault();cell.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
let lastPaint=0,lastPoll=Date.now(),endedAt=0;
function frame(time){
 if(!document.hidden&&state){
  if(time-lastPaint>(state.raid?12:45)){lastPaint=time;const r=state.raid;
    if(r&&route()==='raids'){const sim=paintBattle(r,now(),selectedUnit);if(!sim?.end)endedAt=0;else if(!endedAt)endedAt=Date.now();if(sim?.end&&Date.now()-endedAt>1050&&!busy&&!sessionStorage.getItem(pendingKey()))action({action:'finish',raid:r.id},'Бой завершён',()=>go('log'));}
    else if(route()==='island')idle(time);
    for(const t of document.querySelectorAll('time[data-end]')){const text=duration(+t.dataset.end-now());if(t.textContent!==text){t.textContent=text;if(text==='0 с'&&!busy)render();}}
  }
  if(Date.now()-lastPoll>15000&&!busy&&!state.raid&&!document.activeElement?.matches('input,select')&&!sessionStorage.getItem(pendingKey())){lastPoll=Date.now();if(['island','log'].includes(route()))fetchState().catch(()=>{});}
 }
 requestAnimationFrame(frame);
}
async function start(){try{await identifySession();await fetchState();if(state.raid&&route()==='island')go('raids');if(route()==='raids'&&!state.raid)await mapLoad();requestAnimationFrame(frame);}
catch(e){$('#app').innerHTML=page('Остров драконов','<p>'+esc(e.message)+'</p><div class="tools"><a class="action" href="../?island=1">Войти в «Фаги»</a><a class="action" href="?tour=1">Открыть пробную сцену</a></div>');}}
start();
