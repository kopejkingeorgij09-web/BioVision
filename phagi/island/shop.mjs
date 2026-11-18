import {buildings,buildCost,total} from './game.mjs';
import {functions,unlockLevel,islandLevel} from './progression.mjs';
import {defenses} from './defenses.mjs';
import {boardSize,cellName} from './world.mjs';
import {page,btn} from './ui.mjs';
const thumb=k=>'<img width="60" height="60" loading="lazy" src="art/settlement/'+k+'.webp" alt="">';
const role=k=>functions[k]||defenses[k].role;
export function shop(s,wallet,tab){
 const level=islandLevel(s.xp),free=boardSize**2-s.buildings.length,gold=total(s,'gold');
 const owned=s.buildings.slice().sort((a,b)=>buildings[a.kind].localeCompare(buildings[b.kind],'ru')||a.row-b.row||a.col-b.col).map(b=>
  '<li>'+thumb(b.kind)+'<div><h3>'+buildings[b.kind]+'</h3><small>Ур. '+b.level+' · клетка '+cellName(b.col,b.row)+'</small><p>'+role(b.kind)+'</p></div>'+btn('На карте','selectB/'+b.id)+'</li>').join('');
 const offers=Object.keys(buildings).sort((a,b)=>unlockLevel[a]-unlockLevel[b]||buildings[a].localeCompare(buildings[b],'ru')).map(k=>{
  const cost=buildCost(k),amount=cost.gold||cost.gems,balance=cost.gold?gold:wallet.balance,unit=cost.gold?'золота':'кристаллов';
  const locked=level<unlockLevel[k],ownedCount=s.buildings.filter(b=>b.kind===k).length;
  const why=locked?'С уровня '+unlockLevel[k]:!free?'Нет свободных клеток':balance<amount?'Не хватает '+(amount-balance)+' '+unit:'Разместить';
  return '<li class="'+(locked?'locked':'')+'">'+thumb(k)+'<div><h3>'+buildings[k]+'</h3><small>На острове '+ownedCount+'</small><p>'+role(k)+'</p><strong class="price">'+amount+' '+unit+'</strong></div>'+btn(why,'place/'+k,'',locked||!free||balance<amount)+'</li>';
 }).join('');
 return page('Постройки','<p class="muted">Уровень острова '+level+' · свободно '+free+' из '+boardSize**2+' клеток</p><div class="segment shop-switch">'+btn('На острове · '+s.buildings.length,'shop/owned',tab==='owned'?'active':'')+btn('Купить','shop/buy',tab==='buy'?'active':'')+'</div><div class="shop-grid" data-shop="'+tab+'"><section class="inventory"><h2>На острове</h2><ul class="shop-list">'+owned+'</ul></section><section class="offers"><h2>Купить постройку</h2><ul class="shop-list">'+offers+'</ul></section></div>');
}
