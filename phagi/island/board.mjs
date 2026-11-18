import {boardSize,tile,cellName} from './world.mjs';
export {boardSize,cellName};

// The playable rhombus lies on the lawn inside the painted cliffs (1000 × 960 viewBox).
const horizontal=387, vertical=174, back=151;
export function project(x,y,size=boardSize){
 const extent=size*tile;
 return {x:500+horizontal*(x-y)/extent,y:back+vertical*(x+y)/extent};
}
export function screenStyle(x,y,size=boardSize){const p=project(x,y,size);return 'left:'+p.x/10+'%;top:'+p.y/9.6+'%';}
export const rangeRadii=(radius,size=boardSize)=>[horizontal,vertical].map(k=>Math.SQRT2*k*radius/(size*tile));
function diamond(col,row,size){
 return [[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>{
  const p=project((col+x)*tile,(row+y)*tile,size);
  return p.x.toFixed(1)+','+p.y.toFixed(1);
 }).join(' ');
}
export function boardSvg(island,edit=null,ring=null,size=boardSize){
 const occupied=new Set(island?.buildings.map(b=>b.row*size+b.col));
 let cells='';
 for(let row=0;row<size;row++)for(let col=0;col<size;col++){
  const i=row*size+col,used=occupied.has(i),selected=edit?.cell===i,ctr=project((col+.5)*tile,(row+.5)*tile,size);
  const controls=edit?' role="button" aria-label="'+cellName(col,row)+(used?' занято':' свободно')+'" aria-disabled="'+used+'" tabindex="'+(used?-1:0)+'" data-cell="'+i+'"':'';
  const shade=selected?'selected':edit&&used?'occupied':(col+row)%2?'odd':'even';
  cells+='<g class="plot '+shade+'"'+controls+'><polygon points="'+diamond(col,row,size)+'" stroke-linejoin="round"/>';
  if(edit&&!used)cells+='<text x="'+ctr.x+'" y="'+(ctr.y+3.8)+'">'+cellName(col,row)+'</text>';
  cells+='</g>';
 }
 let radius='';
 if(ring){const p=project(ring.x,ring.y,size),[rx,ry]=rangeRadii(ring.radius,size);
  radius='<ellipse cx="'+p.x+'" cy="'+p.y+'" rx="'+rx+'" ry="'+ry+'" fill="'+ring.color+'" fill-opacity=".16" stroke="'+ring.color+'" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/>';}
 return '<picture><source type="image/webp" srcset="art/settlement/map-1100.webp 1100w, art/settlement/map-2000.webp 2000w" sizes="(max-width: 700px) 850px, 1800px"><img class="ground-art" src="art/settlement/plateau.svg" alt="" draggable="false"></picture><svg class="terrain" viewBox="0 0 1000 960" aria-label="Квадратное поле '+size+' на '+size+'">'+cells+radius+'</svg>';
}
