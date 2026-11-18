// Retain the camera surface and the already hydrated residents between game commands.
function attrs(current,next,skip=[]){
 for(const {name} of [...current.attributes])if(!skip.includes(name)&&!next.hasAttribute(name))current.removeAttribute(name);
 for(const {name,value} of next.attributes)if(!skip.includes(name)&&current.getAttribute(name)!==value)current.setAttribute(name,value);
}
const key=el=>{
 for(const k of ['building','dragon','unit','mark','egg','shore','do'])if(el.dataset[k]!==undefined)return k+'/'+el.dataset[k];
 return el.localName+':'+(el.classList[0]||'');
};
const terrainMarkup=new WeakMap();
function syncWorld(world,fresh){
 const existing=new Map([...world.children].map(el=>[key(el),el]));
 for(const next of [...fresh.children]){
  const id=key(next),old=existing.get(id);existing.delete(id);
  if(!old){world.append(next);continue;}
  if(next.classList.contains('ground-art')||next.classList.contains('fx'))continue;
  if(next.classList.contains('terrain')){
   const markup=next.innerHTML;if(terrainMarkup.get(old)!==markup){old.replaceChildren(...next.childNodes);terrainMarkup.set(old,markup);}
   continue;
  }
  if(next.querySelector('.actor')){
   const currentActor=old.querySelector('.actor'),newActor=next.querySelector('.actor');
   if(currentActor?.dataset.actor===newActor.dataset.actor){attrs(old,next,next.hasAttribute('data-unit')?['style','class','hidden']:[]);continue;}
  }
  if(old.isEqualNode(next))continue;
  if(next.hasAttribute('data-building')||next.hasAttribute('data-mark')){
   attrs(old,next);
   const meter=old.querySelector('.meter i'),updated=next.querySelector('.meter i');
   if(meter&&updated)attrs(meter,updated);
   const tag=old.querySelector('.tag'),nextTag=next.querySelector('.tag');
   if(tag&&!nextTag)tag.remove();if(nextTag&&!tag)old.append(nextTag);
  }else old.replaceWith(next);
 }
 for(const el of existing.values())el.remove();
}
let cachedIsland,lastMapKey;
export const cachedIslandSurface=()=>cachedIsland;
function patchMap(old,next){
 attrs(old,next);syncWorld(old.querySelector('.map-world'),next.querySelector('.map-world'));
 const hero=old.querySelector('.hero'),updated=next.querySelector('.hero');
 if(hero&&updated&&!hero.isEqualNode(updated))hero.replaceWith(updated);
 return old;
}
export function renderShell(root,html,mapKey){
 const template=document.createElement('template');template.innerHTML=html;
 const fresh=template.content,next=fresh.querySelector('.layout>.map'),old=root.querySelector('.layout>.map');
 if(next&&old&&lastMapKey===mapKey){
  patchMap(old,next);
  const siblings=[...root.querySelector('.layout').children].slice(1),newSiblings=[...fresh.querySelector('.layout').children].slice(1);
  for(let i=0;i<Math.max(siblings.length,newSiblings.length);i++){
   if(!newSiblings[i])siblings[i].remove();
   else if(!siblings[i])old.parentElement.append(newSiblings[i]);
   else if(!siblings[i].isEqualNode(newSiblings[i]))siblings[i].replaceWith(newSiblings[i]);
  }
  const wallet=root.querySelector('.wallet'),replacement=fresh.querySelector('.wallet');
  if(!wallet.isEqualNode(replacement))wallet.replaceWith(replacement);
 }else{
  if(next&&mapKey==='island'&&cachedIsland)next.replaceWith(patchMap(cachedIsland,next));
  root.replaceChildren(fresh);
 }
 if(mapKey==='island')cachedIsland=root.querySelector('.layout>.map');
 lastMapKey=mapKey;
}
