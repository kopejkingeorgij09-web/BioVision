import {cachedIslandSurface} from './scene.mjs';
import {prepareRig,poseBones,skinVertices,faceMatrix} from './skeleton.mjs';

const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const assets=new Map(), actors=new WeakMap(), visible=new WeakSet();
const observer=new IntersectionObserver(entries=>{
 for(const e of entries){if(e.isIntersecting){visible.add(e.target);hydrate(e.target);sharpen(e.target);}else visible.delete(e.target);}
});
const ns='http://www.w3.org/2000/svg';
const rootUrl=new URL('./art/dragons/',import.meta.url);
let instance=0;
export const dragonAsset=path=>new URL(path+'?v=elemental-1',rootUrl).href;
// The SVG watercolor contains thousands of curves. Paint it once at screen density;
// native SVG triangles then articulate this shared surface on each animation frame.
const paintCache=new Map();
function discardUnusedPaint(){
 if(paintCache.size<=18)return;
 const roots=[document],island=cachedIslandSurface();
 if(island&&!island.isConnected)roots.push(island);
 const retained=new Set(roots.flatMap(root=>[...root.querySelectorAll('.rigged defs image')].map(e=>e.getAttribute('href'))));
 for(const [key,item] of paintCache){if(paintCache.size<=14)break;if(item.url&&!retained.has(item.url)){URL.revokeObjectURL(item.url);paintCache.delete(key);}}
}
async function screenPaint(id,rig,pixels){
 const [w,h]=rig.size;
 const key=id+'@'+pixels;
 if(!paintCache.has(key)){
  discardUnusedPaint();const item={url:null};
  const promise=(async()=>{
    const response=await fetch(dragonAsset(id+'.svg'),{cache:'force-cache'});
    if(!response.ok)throw Error('Не удалось загрузить рисунок дракона');
    const height=Math.ceil(pixels*h/w),drawing=(await response.text()).replace('<svg ', '<svg width="'+pixels+'" height="'+height+'" ');
    const source=new Image(),vector=URL.createObjectURL(new Blob([drawing],{type:'image/svg+xml'}));
    const buffer=document.createElement('canvas');buffer.width=pixels;buffer.height=height;
    try{source.src=vector;await source.decode();buffer.getContext('2d').drawImage(source,0,0);}
    finally{URL.revokeObjectURL(vector);}
    const blob=await new Promise(resolve=>buffer.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Не удалось отрисовать векторную кожу');
    item.url=URL.createObjectURL(blob);return item.url;
  })().catch(e=>{paintCache.delete(key);throw e;});
  item.promise=promise;paintCache.set(key,item);
 }
 return paintCache.get(key).promise;
}
function svgEl(tag,attributes={}){
 const el=document.createElementNS(ns,tag);
 for(const [k,v] of Object.entries(attributes))el.setAttribute(k,v);
 return el;
}
function asset(id){
 if(!assets.has(id)){
  const task=fetch(dragonAsset('rigs/'+id+'.json')).then(async r=>{
   if(!r.ok)throw Error('Скелет '+id);return prepareRig(await r.json());
  }).catch(err=>{assets.delete(id);throw err;});
  assets.set(id,task);
 }
 return assets.get(id);
}
function actorSvg(id,rig,book,paint){
 const key='dr'+(++instance),[w,h]=rig.size,pad=Math.round(w*.12);
 const svg=svgEl('svg',{class:'rigged',viewBox:[-pad,-pad,w+2*pad,h+2*pad].join(' '),'aria-hidden':'true'});
 const defs=svgEl('defs'),skin=svgEl('image',{id:key,width:w,height:h,href:paint});
 defs.append(skin);const surface=svgEl('g',{class:'vector-surface'});svg.append(defs,surface);const groups=[];
 for(let i=0;i<rig.faces.length;i++){
  const {i:a,j:b,k:c}=rig.faces[i],points=[rig.points[a],rig.points[b],rig.points[c]];
  const center=points.reduce((p,v)=>[p[0]+v[0]/3,p[1]+v[1]/3],[0,0]);
  const clip=svgEl('clipPath',{id:key+'c'+i});
  // Neighbouring patches share all edge vertices. Slight underlap covers antialias seams.
  const overlap=.75/Math.max(1,Math.min(...points.map(p=>Math.hypot(p[0]-center[0],p[1]-center[1]))));
  clip.append(svgEl('polygon',{points:points.map(p=>p.map((n,k)=>(n+(n-center[k])*overlap).toFixed(2)).join(',')).join(' ')}));defs.append(clip);
  const g=svgEl('g');g.append(svgEl('use',{href:'#'+key,'clip-path':'url(#'+key+'c'+i+')'}));surface.append(g);groups.push(g);
 }
 let overlay=null;
 if(book){
  // Bind joint markers to the same triangles as the skin, including its correction
  // for tight bends. A separate render of the ideal FK pose would drift off the art.
  const bind=([x,y])=>{
   for(const f of rig.faces){
    const dx=x-f.x,dy=y-f.y,u=f.ux*dx+f.vx*dy,v=f.uy*dx+f.vy*dy;
    if(u>=-.0001&&v>=-.0001&&u+v<=1.0001)return [f.i,f.j,f.k,1-u-v,u,v];
   }
  };
  const g=svgEl('g',{class:'armature'});overlay=rig.bones.map(b=>{
   const link=svgEl('path',{class:b.name.startsWith('far')?'far-bone':'bone'});const dot=svgEl('circle',{r:rig.width*.0068});
   g.append(link,dot);return {link,dot,a:bind(b.a),b:bind(b.b)};
  });svg.append(g);drawBones(overlay,rig,rig.points);
 }
 return {svg,groups,overlay};
}
export const actorMarkup=(id,label='')=>'<span class="actor" data-actor="'+id+'" role="img" aria-label="'+label+'"><img class="rest-pose" loading="lazy" alt="" draggable="false" src="'+dragonAsset(id+'.svg')+'"></span>';
// Request a denser skin only when its physical on-screen dimensions grow.
function skinWidth(el,rig){
 const {width,height}=el.getBoundingClientRect(),[w,h]=rig.size,pad=Math.round(w*.12);
 const displayed=Math.min(width*w/(w+2*pad),height*w/(h+2*pad));
 return Math.max(192,Math.ceil(displayed*(window.devicePixelRatio||1)*1.25/128)*128);
}
function sharpen(el){
 const actor=actors.get(el);if(!actor||!visible.has(el))return;
 const pixels=skinWidth(el,actor.rig);
 if(pixels<=actor.pixels||pixels<=actor.requested)return;
 actor.requested=pixels;
 screenPaint(el.dataset.actor,actor.rig,pixels).then(url=>{
  if(pixels>actor.pixels){actor.image.setAttribute('href',url);actor.pixels=pixels;}
 }).catch(()=>{}).finally(()=>{if(actor.requested===pixels)actor.requested=0;});
}
const sizes=new ResizeObserver(entries=>{for(const {target} of entries)sharpen(target);});
const observed=new Set();
export function mountActors(root){
 const next=new Set(root.querySelectorAll('[data-actor]'));
 for(const el of observed)if(!next.has(el)){observer.unobserve(el);sizes.unobserve(el);visible.delete(el);observed.delete(el);}
 for(const el of next)if(!observed.has(el)){observed.add(el);observer.observe(el);sizes.observe(el);}
}
const preparing=new WeakSet();
function hydrate(el){
 if(actors.has(el)||preparing.has(el))return;preparing.add(el);
  const id=el.dataset.actor;
  asset(id).then(async rig=>{
   if(!el.isConnected)return;
   const book=!!el.closest('.plate');
   const pixels=skinWidth(el,rig),paint=await screenPaint(id,rig,pixels);
   if(!el.isConnected)return;
   const {svg,groups,overlay}=actorSvg(id,rig,book,paint);el.replaceChildren(svg);
   const owner=el.closest('[data-dragon],[data-unit]');
   const seed=owner?.dataset.dragon||owner?.dataset.unit||id;
   actors.set(el,{rig,groups,overlay,image:svg.querySelector('defs image'),pixels,requested:0,pose:'idle',previous:null,changed:0,last:-Infinity,
    phase:(rig.width*13+Array.from(seed).reduce((a,c)=>a+c.charCodeAt(0),0))%97/17});sharpen(el);
  }).catch(()=>{/* The vector rest pose stays visible during a network interruption. */}).finally(()=>preparing.delete(el));
}
function drawBones(overlay,rig,points){
 const move=(binding,rest)=>{
  if(!binding)return rest;
  const [i,j,k,a,b,c]=binding;
  return [0,1].map(axis=>points[i][axis]*a+points[j][axis]*b+points[k][axis]*c);
 };
 for(let i=0;i<rig.bones.length;i++){
  const {link,dot,a,b}=overlay[i];
  const start=move(a,rig.bones[i].a),end=move(b,rig.bones[i].b);
  link.setAttribute('d','M'+start.join(' ')+'L'+end.join(' '));dot.setAttribute('cx',start[0]);dot.setAttribute('cy',start[1]);
 }
}
export function animateActor(el,pose,ms){
 const a=actors.get(el);if(!a||!visible.has(el))return;
 if(reduced.matches){if(a.last!==-Infinity){for(const g of a.groups)g.removeAttribute('transform');if(a.overlay)drawBones(a.overlay,a.rig,a.rig.points);a.last=-Infinity;}return;}
 if(a.pose!==pose){a.previous=a.pose;a.pose=pose;a.changed=ms;}
 if(ms-a.last<(pose==='idle'?50:1000/30)-.7)return;a.last=ms;
 const mats=poseBones(a.rig,pose,ms/1000+a.phase,a.previous,(ms-a.changed)/140);
 const pts=skinVertices(a.rig,mats);
 if(a.overlay&&el.dataset.bones==='on')drawBones(a.overlay,a.rig,pts);
 for(let i=0;i<a.groups.length;i++){
  const m=faceMatrix(a.rig.faces[i],pts);
  a.groups[i].setAttribute('transform','matrix('+m.map(v=>+v.toFixed(4)).join(' ')+')');
 }
}
