// The server stores a 5 × 5 square. This single projection is used by terrain,
// taps, construction previews, buildings, range rings and the battle overlay.
export const boardSize=5, tile=100/boardSize;
export function project(x,y){return {x:500+4.05*(x-y),y:200+2.55*(x+y)};}
export function screenStyle(x,y){const p=project(x,y);return 'left:'+p.x/10+'%;top:'+p.y/9.6+'%';}
export function cellName(col,row){return 'АБВГД'[col]+(row+1);}
export const rangeRadii=radius=>[Math.SQRT2*4.05*radius,Math.SQRT2*2.55*radius];
const point=(x,y)=>{const p=project(x,y);return p.x.toFixed(2)+','+p.y.toFixed(2);};
const diamond=(x,y,size)=>[point(x,y),point(x+size,y),point(x+size,y+size),point(x,y+size)].join(' ');
function geology(){
 const parts=[];let seed=18761;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let side=0;side<2;side++)for(let i=0;i<20;i++){
   const a=i/20,b=(i+1)/20;
   const edge=t=>({x:side?500+490*t:10+490*t,y:side?763-308*t:455+308*t});
   const p=edge(a),q=edge(b),base=t=>82+55*Math.sin(Math.PI*(side?1-t:t))+14*Math.sin(9*t);
   const low=(o,t)=>({x:500+(o.x-500)*.91,y:o.y+base(t)});
   const l=low(p,a),r=low(q,b);
   const color=(side?['#4b6171','#526474','#5f6a76','#535e72']:['#b98963','#a47763','#ba8c69','#8f786b'])[i%4];
   parts.push('<path d="M'+p.x+' '+p.y+' L'+q.x+' '+q.y+' '+r.x+' '+r.y+' '+l.x+' '+l.y+'Z" fill="'+color+'"/>',
   '<path d="M'+p.x+' '+p.y+' L'+(q.x-4)+' '+(q.y+23)+' '+l.x+' '+l.y+'Z" fill="#293d55" opacity=".22"/>',
   '<path d="M'+p.x+' '+p.y+' L'+q.x+' '+q.y+' '+(q.x-1)+' '+(q.y+9)+' '+(p.x+1)+' '+(p.y+9)+'Z" fill="'+(side?'#9f9b78':'#e1bd83')+'"/>');
 }
 parts.push('<path d="M500 147 990 455 500 763 10 455Z" fill="url(#rim)" stroke="#c9b78b" stroke-width="3"/>');
 for(let i=0;i<280;i++){const x=rand()*119-9.5,y=rand()*119-9.5;if(x>=-1&&x<=101&&y>=-1&&y<=101)continue;
   const p=project(x,y);parts.push('<path d="M'+p.x.toFixed(1)+' '+p.y.toFixed(1)+'l-3 -1 1 -5 2 3 3 -4 -1 6z" fill="'+(i%2?'#648d70':'#bdba78')+'"/>');}
 return parts.join('');
}
const terrain=geology();
const defs='<defs><linearGradient id="rim" x2=".85" y2="1"><stop stop-color="#e2c78a"/><stop offset=".55" stop-color="#9eb77b"/><stop offset="1" stop-color="#668b70"/></linearGradient><linearGradient id="stream" x2="0" y2="1"><stop stop-color="#fffbd6"/><stop offset=".35" stop-color="#64cdcf"/><stop offset="1" stop-color="#b1e4dc" stop-opacity=".3"/></linearGradient><pattern id="grass" width="24" height="17" patternUnits="userSpaceOnUse"><path d="m3 8 3-1m9 7 2-1m-9-9 2-1" stroke="#465f49" opacity=".28" fill="none"/></pattern></defs>';
const water='<g fill="url(#stream)"><path d="M173 557q14 6 26 16-8 21-7 71 0 24-9 39 0-60-10-126Z"/><path d="M749 606l22-14q-8 18-7 57-1 35-12 64 5-66-3-107Z"/></g>';
function range(t){
 if(!t?.radius)return '';const o=project(t.x,t.y),[rx,ry]=rangeRadii(t.radius);
 return '<ellipse cx="'+o.x+'" cy="'+o.y+'" rx="'+rx+'" ry="'+ry+'" fill="'+t.color+'" fill-opacity=".14" stroke="'+t.color+'" stroke-width="4" stroke-dasharray="10 6" pointer-events="none"/>';
}
export function boardSvg(island,edit=null,ring=null){
 let cells='';for(let row=0;row<boardSize;row++)for(let col=0;col<boardSize;col++){
 const i=row*boardSize+col,occ=island?.buildings.some(b=>b.col===col&&b.row===row),active=edit?.cell===i;
 const paint=edit?(active?'#f7d17c':occ?'#858c74':(col+row)%2?'#afce92':'#bcda9b'):(col+row)%2?'#a5b77c':'#bdc58c';
 const ctr=project(col*tile+tile/2,row*tile+tile/2);
 cells+='<g '+(edit?'role="button" aria-label="'+cellName(col,row)+(occ?' занято':' свободно')+'" aria-disabled="'+!!occ+'" tabindex="'+(occ?-1:0)+'" data-cell="'+i+'"':'')+'><polygon points="'+diamond(col*tile,row*tile,tile)+'" fill="'+paint+'" stroke="'+(active?'#ffe3a0':'#697f5b')+'" stroke-width="'+(active?6:2.4)+'" stroke-linejoin="round"/>';
 if(edit&&!occ)cells+='<text x="'+ctr.x+'" y="'+(ctr.y+7)+'" text-anchor="middle" fill="#243f36" font-family="system-ui" font-size="21" font-weight="700">'+cellName(col,row)+'</text>';cells+='</g>';
 }
 return '<svg class="terrain" viewBox="0 0 1000 960" aria-label="Квадратное поле 5 на 5">'+defs+terrain+water+cells+'<polygon points="'+diamond(0,0,100)+'" fill="url(#grass)" pointer-events="none" stroke="#556e52" stroke-width="5"/>'+range(ring)+'</svg>';
}
