import {buildings} from './game.mjs';
import {byId} from './catalog.mjs';
import {cellName,project} from './board.mjs';
import {escape as esc,structureArt,structureName,page,panel,btn,moscowDate} from './ui.mjs';
import {dragonAsset} from './actors.mjs';

const seconds=t=>Math.floor(t/4)+' с';
function eventText(e,names){
 const a=names.get(e.from)||'Дракон',b=names.get(e.to)||'цель';
 return ({land:a+' высадился · берег '+(Number(e.shore)+1),target:a+' направлен к цели «'+b+'»',skill:a+' применил способность',fire:a+' атакует «'+b+'»',down:'Выбытие из боя · '+b})[e.kind]||e.kind;
}
export function replayPage(match){
 if(!match)return page('Повтор боя','<p role="status">Загружаем запись…</p>'+btn('Назад в журнал','go/log'));
 const {report:r,recording:rec}=match;
 const outcome='<p>'+esc(r.reason)+(r.source==='campaign'?' · '+r.stars+'/3 ★ · +'+r.experience+' опыта':'')+' · '+moscowDate(r.time)+' МСК</p><p>'+(r.incoming?'Потеряно':'Получено')+' '+r.loot.gold+' золота и '+r.loot.food+' еды.</p>';
 const stores=(r.ledger||[]).map(v=>'<tr><th scope="row">'+buildings[v.kind]+' · '+cellName(v.col,v.row)+'</th><td>'+v.before+'</td><td>'+v.after+'</td><td>'+(v.delta>0?'+':'')+v.delta+'</td></tr>').join('');
 const accounting=panel('Ресурсы',outcome+(stores?'<table class="ledger"><thead><tr><th>Хранилище</th><th>До</th><th>После</th><th>Изменение</th></tr></thead><tbody>'+stores+'</tbody></table>':''));
 if(!rec)return page(esc(r.enemy),accounting+'<p>В этом старом отчёте сохранился только итог боя.</p>'+btn('Назад в журнал','go/log'));
 const names=new Map([...rec.targets,...rec.team].map(t=>[t.id,t.species?byId[t.species].name:structureName(t,buildings)]));
 const sprite=(t,i,isTeam)=>{
  const pic=t.species?dragonAsset('thumbs/'+t.species+'.svg'):structureArt(t);
  return '<g data-sprite="'+(isTeam?'a':'d')+i+'"><title>'+esc(names.get(t.id))+'</title><image href="'+pic+'" x="-26" y="-38" width="52" height="47"/><path d="M-14 8h28" stroke="#354646" stroke-width="3"/><path class="health" d="M-14 8h28" pathLength="100" stroke="'+(isTeam?'#ffb26e':'#a7e59c')+'" stroke-width="3"/></g>';
 };
 const frame=rec.frames.at(-1)[0];
 const scene='<div class="recording" data-record="'+esc(r.id)+'"><svg viewBox="55 95 890 475" role="img" aria-label="Поле боя в записи"><image href="art/settlement/map-1100.webp" width="1000" height="960" preserveAspectRatio="none"/>'+rec.targets.map((t,i)=>sprite(t,i,false)).join('')+rec.team.map((t,i)=>sprite(t,i,true)).join('')+'<g class="traces"></g></svg><div class="playback"><button type="button" data-play>Воспроизвести</button><label>Момент боя <input aria-label="Момент боя" type="range" min="0" max="'+frame+'" step="1" value="0" data-seek></label><output>0 с</output><button type="button" data-step>Следующее событие</button></div></div>';
 const timeline=rec.events.map(e=>'<li><button data-tick="'+e.tick+'"><time>'+seconds(e.tick)+'</time> '+esc(eventText(e,names))+'</button></li>').join('');
 const activity=rec.targets.filter(t=>['tower','ice','storm','ward','guard'].includes(t.kind)).map(t=>{
  const d=rec.performance[t.id],status=rec.frames.at(-1)[2][rec.targets.indexOf(t)][2]>0?'уцелел':'выбыл';
  const effect=t.kind==='ice'?'зона замедления':t.kind==='ward'?'защитное поле':(d?.hits||0)+' попаданий · '+(d?.damage||0)+' урона';
  return '<li>'+esc(names.get(t.id))+' · '+effect+' · '+status+'</li>';
 }).join('');
 return page(esc(r.enemy),scene+accounting+panel('Как сработала оборона','<ul>'+activity+'</ul>')+panel('Ход боя',timeline?'<ol class="battle-events">'+timeline+'</ol>':'Приказов и попаданий не было.')+btn('Назад в журнал','go/log'));
}
let dispose;
export function mountReplay(rec){
 dispose?.();dispose=null;
 const box=document.querySelector('.recording');if(!box||!rec)return;
 const slider=box.querySelector('[data-seek]'),play=box.querySelector('[data-play]'),out=box.querySelector('output'),traces=box.querySelector('.traces');
 const all=[...rec.team,...rec.targets],sprites=all.map((_,i)=>box.querySelector('[data-sprite="'+(i<rec.team.length?'a'+i:'d'+(i-rec.team.length))+'"]'));
 let tick=0,raf=0,start=0,index=-1;
 function show(t){
  tick=Math.max(0,Math.min(+slider.max,t));slider.value=String(Math.round(tick));out.textContent=seconds(tick)+' / '+seconds(+slider.max);
  let n=0;while(n+1<rec.frames.length&&rec.frames[n+1][0]<=tick)n++;
  const f=rec.frames[n],next=rec.frames[n+1]||f,blend=next===f?0:(tick-f[0])/(next[0]-f[0]),locations=new Map();
  [...f[1],...f[2]].forEach((a,i)=>{
   const g=sprites[i];if(!a){g.setAttribute('visibility','hidden');return;}g.setAttribute('visibility','visible');
   const b=(i<rec.team.length?next[1][i]:next[2][i-rec.team.length])||a;
   const p=project(a[0]+(b[0]-a[0])*blend,a[1]+(b[1]-a[1])*blend,rec.size);locations.set(all[i].id,p);
   g.setAttribute('transform','translate('+p.x.toFixed(1)+' '+p.y.toFixed(1)+')');
   if(index!==n){g.style.opacity=a[2]>0?'1':'.26';g.querySelector('.health').setAttribute('stroke-dasharray',(100*a[2]/all[i].max)+' 100');}
  });
  if(index!==n){index=n;traces.innerHTML=f[3].map(([a,b])=>{const u=locations.get(a),v=locations.get(b);return u&&v?'<path d="M'+u.x+' '+(u.y-11)+'L'+v.x+' '+(v.y-11)+'" fill="none" stroke="#fff0ab" stroke-width="3"/>':'';}).join('');}
 }
 function pause(){cancelAnimationFrame(raf);raf=0;play.textContent='Воспроизвести';}
 function frame(time){show((time-start)/250);if(tick>=+slider.max)pause();else raf=requestAnimationFrame(frame);}
 play.onclick=()=>{if(raf)return pause();if(tick>=+slider.max)show(0);start=performance.now()-tick*250;play.textContent='Пауза';raf=requestAnimationFrame(frame);};
 slider.oninput=()=>{pause();show(+slider.value);};
 box.querySelector('[data-step]').onclick=()=>{pause();show(rec.events.find(e=>e.tick>tick)?.tick??+slider.max);};
 for(const b of document.querySelectorAll('[data-tick]'))b.onclick=()=>{pause();show(+b.dataset.tick);};
 dispose=pause;show(0);
}
