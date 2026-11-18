const views=new Map();
let active;
function saved(key){
 try{const view=JSON.parse(sessionStorage.getItem('dragon-camera/'+key));return view&&[view.x,view.y,view.zoom].every(Number.isFinite)?view:null;}catch{return null;}
}
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export const cameraControls='<div class="camera-tools" aria-label="Масштаб карты"><button type="button" data-camera="out" aria-label="Отдалить">−</button><button type="button" data-camera="fit" title="Весь остров" aria-label="Показать весь остров"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg></button><button type="button" data-camera="in" aria-label="Приблизить">+</button></div>';
export function mountCamera(section,key,focus){
 if(section&&active?.section===section&&active.key===key)return;
 active?.disconnect();active=null;
 if(!section)return;
 const viewport=section.querySelector('.world-window'),world=section.querySelector('.map-world');
 const v=views.get(key)||saved(key)||{x:focus.x,y:focus.y,zoom:section.classList.contains('battle')?1.25:innerWidth<900?2.18:2};
 v.zoom=clamp(v.zoom,1,3.4);views.set(key,v);
 let width,height,base,rect,frame=0,saveTimer,dragged=false,suppress=0,gesture;
 const buttons=[...section.querySelectorAll('[data-camera]')];let previousZoom,paintedWidth,zoomTimer,continuousZoom=false;
 function save(){try{sessionStorage.setItem('dragon-camera/'+key,JSON.stringify(v));}catch{}}
 function remember(){clearTimeout(saveTimer);saveTimer=setTimeout(save,200);}
 function measure(){rect=viewport.getBoundingClientRect();width=rect.width;height=rect.height;base=Math.min(width*.95,height/.96*.97);paint();}
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint();});}
 const fingers=new Map(),events=new AbortController();
 function paint(){
   if(!width||!height)return;
   const w=base*v.zoom,h=w*.96;
   const limit=(d,extent,mid)=>{if(extent<=d)return mid;const edge=(d/2-24)/extent;return clamp(mid,edge,1-edge);};
   v.x=limit(width,w,v.x);v.y=limit(height,h,v.y);
   if(w<=width)v.x=.5;
   if(h<=height)v.y=v.zoom===1?.46:.37;
   // Lay out artwork at its displayed size. Panning changes only the compositor translation.
   const surface=continuousZoom?base*3.4:w;
   if(paintedWidth!==surface){
     paintedWidth=surface;world.style.width=surface+'px';world.style.height=surface*.96+'px';
     world.style.setProperty('--map-unit',(surface/1000)+'px');
   }
   const transform='translate3d('+(width/2-v.x*w)+'px,'+(height/2-v.y*h)+'px,0)';
   world.style.transform=continuousZoom?transform+' scale('+w/surface+')':transform;
   if(previousZoom===v.zoom)return;previousZoom=v.zoom;
   for(const b of buttons)b.disabled=b.dataset.camera==='out'&&v.zoom<=1.001||b.dataset.camera==='in'&&v.zoom>=3.39;
 }
 // A pinch or wheel burst reuses a surface large enough for its entire zoom range.
 function continuous(){
  continuousZoom=true;clearTimeout(zoomTimer);
  zoomTimer=setTimeout(()=>{continuousZoom=false;schedule();},600);
 }
 function zoom(n,point){
  const old=v.zoom;v.zoom=clamp(n,1,3.4);
  if(point){const w=base*old,w2=base*v.zoom;v.x+=(point.x-width/2)*(1/w-1/w2);v.y+=(point.y-height/2)*(1/w-1/w2)/.96;}
  schedule();remember();
 }
 function fit(){v.zoom=1;v.x=.5;v.y=.46;schedule();remember();}
 function local(e){return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
 function sample(){
  const [a,b]=fingers.values();if(!a)return null;
  return b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2,gap:Math.hypot(a.x-b.x,a.y-b.y)}:{...a,gap:0};
 }
 function start(){const s=sample();gesture=s&&{...s,vx:v.x,vy:v.y,z:v.zoom};}
 viewport.onpointerdown=e=>{
  if(e.button!==0)return;
  if(!fingers.size){dragged=false;rect=viewport.getBoundingClientRect();}
  fingers.set(e.pointerId,local(e));if(fingers.size>=2)dragged=true;start();
 };
 viewport.onpointermove=e=>{
  if(!fingers.has(e.pointerId)||!gesture)return;
  fingers.set(e.pointerId,local(e));const s=sample(),dx=s.x-gesture.x,dy=s.y-gesture.y;
  if(!dragged&&Math.hypot(dx,dy)<5)return;
  dragged=true;if(!viewport.hasPointerCapture(e.pointerId))viewport.setPointerCapture(e.pointerId);
  const oldW=base*gesture.z;
  if(gesture.gap)continuous();
  v.zoom=gesture.gap?clamp(gesture.z*s.gap/gesture.gap,1,3.4):gesture.z;
  const w=base*v.zoom;
  v.x=gesture.vx+(gesture.x-width/2)/oldW-(s.x-width/2)/w;
  v.y=gesture.vy+((gesture.y-height/2)/oldW-(s.y-height/2)/w)/.96;
  schedule();
 };
 function release(e){if(!fingers.delete(e.pointerId))return;if(dragged)suppress=performance.now()+330;remember();start();}
 viewport.onpointerup=viewport.onpointercancel=release;
 viewport.onpointerleave=e=>{if(!viewport.hasPointerCapture(e.pointerId))release(e);};
 viewport.addEventListener('click',e=>{if(e.detail&&performance.now()<suppress){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,signal:events.signal});
 viewport.addEventListener('wheel',e=>{e.preventDefault();continuous();zoom(v.zoom*Math.exp(-e.deltaY*.0024),local(e));},{passive:false,signal:events.signal});
 viewport.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','+','-','='].includes(e.key))return;
  e.preventDefault();
  if(e.key==='Home')return fit();
  if(['-','+','='].includes(e.key))return zoom(v.zoom*(e.key==='-'?1/1.25:1.25));
  const delta=58/(base*v.zoom);v.x+=({'ArrowRight':delta,'ArrowLeft':-delta}[e.key]||0);v.y+=({'ArrowDown':delta,'ArrowUp':-delta}[e.key]||0)/.96;schedule();remember();
 };
 section.querySelector('.camera-tools').onclick=e=>{const dir=e.target.closest('[data-camera]')?.dataset.camera;if(!dir)return;
  if(dir==='fit')fit();else zoom(v.zoom*(dir==='in'?1.3:1/1.3));};
 const observer=new ResizeObserver(measure);observer.observe(viewport);measure();
 active={section,key,paint,disconnect(){events.abort();observer.disconnect();clearTimeout(zoomTimer);cancelAnimationFrame(frame);clearTimeout(saveTimer);save();}};
}
export function focusCamera(key,x,y){const v=views.get(key);if(v){v.x=x;v.y=y;if(active?.key===key)active.paint();}}
