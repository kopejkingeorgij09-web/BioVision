/* Geometry shared by the island editor, save migration, and battle renderer. */
(function(root){
 'use strict';
 const sides=Object.freeze({keep:5,goldstore:4,foodstore:4,den:4,academy:4,archer:3,cannon:3,home:3,farm:3,mine:3,spire:2,wall:1,icetrap:1,firetrap:1});
 const fieldSides=Object.freeze([33,36,40,43,46,50,53]);
 // Two occupied border cells from the previous release may extend either axis.
 const oldBorder=2;
 const production=Object.freeze({mine:4,farm:3,home:.85});
 const size=type=>typeof type==='string'&&Object.hasOwn(sides,type)?sides[type]:0;
 const active=b=>b&&b.stowed!==true&&Number.isInteger(b.x)&&Number.isInteger(b.y);
 function gridAtLevel(level,version=2,buildings){
   const strips=Math.min(12,Math.max(0,Math.floor(level||1)-1));
   const dimension=i=>version===2?fieldSides[i]:10+i;
   const width=dimension(Math.ceil(strips/2)),height=dimension(Math.floor(strips/2));
   if(version!==2||!Array.isArray(buildings))return {width,height};
   let right=width,bottom=height;
   for(const b of buildings){
     if(!active(b))continue;
     const span=size(b.type);
     if(span){right=Math.max(right,b.x+span);bottom=Math.max(bottom,b.y+span)}
   }
   return {width:Math.min(right,width+oldBorder),height:Math.min(bottom,height+oldBorder)};
 }
 function center(b){
   if(!active(b))return null;
   const offset=(size(b.type)-1)/2;return {x:b.x+offset,y:b.y+offset};
 }
 function cells(b){
   const points=[];if(!active(b))return points;
   const n=size(b.type);
   for(let y=b.y;y<b.y+n;y++)for(let x=b.x;x<b.x+n;x++)points.push({x,y});
   return points;
 }
 function at(buildings,x,y){
   return buildings.find(b=>active(b)&&x>=b.x&&y>=b.y&&x<b.x+size(b.type)&&y<b.y+size(b.type))||null;
 }
 function inside(grid,x,y,n){
   return n>0&&Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x+n<=grid.width&&y+n<=grid.height;
 }
 function fits(buildings,type,x,y,grid,excludeId=null){
   const n=size(type);
   return inside(grid,x,y,n)&&!buildings.some(b=>{
     if(!active(b)||b.id===excludeId)return false;
     const m=size(b.type);
     return x<b.x+m&&b.x<x+n&&y<b.y+m&&b.y<y+n;
   });
 }
 function valid(buildings,grid,version=2){
   if(!Array.isArray(buildings)||!grid||![1,2].includes(version)||!Number.isInteger(grid.width)||!Number.isInteger(grid.height)||
      grid.width<1||grid.height<1||grid.width>55||grid.height>55)return false;
   const seen=new Uint8Array(grid.width*grid.height),ids=new Set();let keeps=0;
   for(const b of buildings){
     if(!b||!size(b.type)||typeof b.id!=='string'||ids.has(b.id))return false;
     ids.add(b.id);if(b.type==='keep')keeps++;
     if(b.stowed!==undefined&&typeof b.stowed!=='boolean')return false;
     if(b.pausedStock!==undefined&&(!b.stowed||!Object.hasOwn(production,b.type)||
       !Number.isSafeInteger(b.pausedStock)||b.pausedStock<0||b.pausedStock>b.level*90))return false;
     if(b.stowed){
       if(version!==2||b.type==='keep'||b.x!==null||b.y!==null)return false;
       continue;
     }
     const n=version===2?size(b.type):1;
     if(!inside(grid,b.x,b.y,n))return false;
     for(let y=b.y;y<b.y+n;y++)for(let x=b.x;x<b.x+n;x++){
       const i=y*grid.width+x;if(seen[i])return false;seen[i]=1;
     }
   }
   return keeps===1;
 }
 function legacyXP(state){
   return (state.dragons||[]).reduce((n,d)=>n+10*(d.level-1),0)+
     state.buildings.reduce((n,b)=>n+12*(b.level-1),0)+35*(state.quest||0)+
     25*Object.values(state.campaign||{}).reduce((n,stars)=>n+stars,0);
 }
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const bySize=(a,b)=>size(b.type)-size(a.type)||a.y-b.y||a.x-b.x||cmp(a.id,b.id);
 function wallGroups(walls){
   const key=(x,y)=>x+','+y,remaining=new Map(walls.map(b=>[key(b.x,b.y),b])),groups=[];
   for(const b of walls){
     if(!remaining.delete(key(b.x,b.y)))continue;
     const group=[b];
     for(let i=0;i<group.length;i++){
       const {x,y}=group[i];
       for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
         const k=key(x+dx,y+dy),next=remaining.get(k);
         if(next){remaining.delete(k);group.push(next)}
       }
     }
     groups.push(group);
   }
   return groups.sort((a,b)=>b.length-a.length||bySize(a[0],b[0]));
 }
 function pack(old,grid,oldGrid,order,fixed=null){
   const rows=new Uint32Array(grid.height*2),placed=new Map();
   // The centre of an old tile keeps its relative location on each axis.
   const target=b=>({x:Math.round((b.x+.5)*grid.width/oldGrid.width-size(b.type)/2),
     y:Math.round((b.y+.5)*grid.height/oldGrid.height-size(b.type)/2)});
   function free(x,y,n){
     const bits=(1<<n)-1,shift=x&31,first=bits<<shift,second=shift+n>32?bits>>>(32-shift):0;
     for(let index=2*y+(x>>>5),j=0;j<n;j++,index+=2)
       if((rows[index]&first)||(second&&(rows[index+1]&second)))return false;
     return true;
   }
   function put(b,x,y){
     const n=size(b.type),bits=(1<<n)-1,shift=x&31,first=bits<<shift,second=shift+n>32?bits>>>(32-shift):0;
     for(let index=2*y+(x>>>5),j=0;j<n;j++,index+=2){
       rows[index]|=first;if(second)rows[index+1]|=second;
     }
     placed.set(b.id,{...b,x,y});
   }
   function place(b){
     const n=size(b.type),p=target(b);
     if(order===0&&inside(grid,p.x,p.y,n)&&free(p.x,p.y,n)){put(b,p.x,p.y);return}
     let best=null,lowest=Infinity;
     for(let y=0;y<=grid.height-n;y++)for(let x=0;x<=grid.width-n;x++){
       if(!free(x,y,n))continue;
       const score=order===0?(x-p.x)**2+(y-p.y)**2:order===1?y*grid.width+x:x*grid.height+y;
       if(score<lowest){lowest=score;best={x,y}}
     }
     if(best)put(b,best.x,best.y);
   }
   const sorted=old.slice().sort(bySize);
   // A long existing chain keeps its corners and adjacency after subdivision.
   // One paid old section still corresponds to exactly one paid new section.
   if(fixed)for(const b of sorted)if(fixed.has(b.id)){const p=fixed.get(b.id);put(b,p.x,p.y)}
   for(const b of sorted)if(size(b.type)>1&&!placed.has(b.id))place(b);
   for(const group of wallGroups(sorted.filter(b=>b.type==='wall'))){
     const minX=Math.min(...group.map(b=>b.x)),minY=Math.min(...group.map(b=>b.y));
     const width=Math.max(...group.map(b=>b.x))-minX+1,height=Math.max(...group.map(b=>b.y))-minY+1;
     const dx=Math.round(group.reduce((n,b)=>n+target(b).x-b.x,0)/group.length);
     const dy=Math.round(group.reduce((n,b)=>n+target(b).y-b.y,0)/group.length);
     if(group.every(b=>inside(grid,b.x+dx,b.y+dy,1)&&free(b.x+dx,b.y+dy,1))){
       for(const b of group)put(b,b.x+dx,b.y+dy);
       continue;
     }
     let closest=Infinity,chosen=null;
     for(let y=0;y<=grid.height-height;y++)for(let x=0;x<=grid.width-width;x++){
       const tx=x-minX,ty=y-minY,d=(tx-dx)**2+(ty-dy)**2;
       if(d<closest&&group.every(b=>free(b.x+tx,b.y+ty,1))){closest=d;chosen={tx,ty}}
     }
     if(chosen)for(const b of group)put(b,b.x+chosen.tx,b.y+chosen.ty);
     else for(const b of group)place(b);
   }
   for(const b of sorted)if(size(b.type)===1&&b.type!=='wall')place(b);
   return placed;
 }
 function rectanglePacking(old,grid,mode){
   const placed=new Map(),sorted=old.filter(b=>size(b.type)>1).sort(bySize);
   let free=[{x:0,y:0,w:grid.width,h:grid.height}];
   while(sorted.length){
     let choice=null,best=Infinity;
     const sidesTried=new Set();
     for(let i=0;i<sorted.length;i++){
       const b=sorted[i],n=size(b.type);
       if(sidesTried.has(n)||!placed.size&&b.type!=='keep')continue;
       sidesTried.add(n);
       for(const r of free){
         if(r.w<n||r.h<n)continue;
         const short=Math.min(r.w,r.h)-n,long=Math.max(r.w,r.h)-n,waste=r.w*r.h-n*n;
         const score=mode===0?short*2048+long:mode===1?waste*32+short:mode===2?-n*65536+short*1024+long:-n*65536+waste;
         if(score<best){best=score;choice={i,n,x:r.x,y:r.y}}
       }
     }
     if(!choice)break;
     const {i,n,x,y}=choice;placed.set(sorted.splice(i,1)[0].id,{x,y});
     const parts=[];
     for(const r of free){
       const right=r.x+r.w,bottom=r.y+r.h;
       if(x>=right||x+n<=r.x||y>=bottom||y+n<=r.y){parts.push(r);continue}
       if(x>r.x)parts.push({...r,w:x-r.x});
       if(y>r.y)parts.push({...r,h:y-r.y});
       if(x+n<right)parts.push({...r,x:x+n,w:right-x-n});
       if(y+n<bottom)parts.push({...r,y:y+n,h:bottom-y-n});
     }
     free=parts.filter((r,i)=>!parts.some((q,j)=>j!==i&&q.x<=r.x&&q.y<=r.y&&q.x+q.w>=r.x+r.w&&q.y+q.h>=r.y+r.h&&
       (q.w*q.h>r.w*r.h||j<i)));
   }
   return placed;
 }
 // The nearest-site and corner passes need not find a packing even when all
 // buildings fit. On these tight cases, cover the lowest free row of a column
 // with a square or a single cell, retaining only distinct column profiles.
 function exactPacking(old,grid){
   const types=[5,4,3,2],groups=types.map(n=>old.filter(b=>size(b.type)===n).sort(bySize));
   const cols=new Uint8Array(grid.width),left=groups.map(g=>g.length),chosen=new Map(),dead=new Set();
   const buildings=left.reduce((sum,n)=>sum+n,0);
   const spare=grid.width*grid.height-groups.reduce((sum,g,i)=>sum+types[i]**2*g.length,0);
   let examined=0;
   function slots(n,need,collect){
     const out=collect?[]:null;let count=0;
     // Equal squares can all be shifted up into horizontal bands measured
     // from the grid roof. The occupied column profile is entirely below them.
     for(let y=grid.height-n;y>=0;y-=n){
       let run=0;
       for(let x=0;x<cols.length;x++){
         run=cols[x]<=y?run+1:0;
         if(run===n){
           if(out)out.push({x:x-n+1,y});run=0;
           if(++count===need)return out||true;
         }
       }
     }
     return false;
   }
   function search(count,slack){
     if(!count)return true;
     // Very dense imported bases can require an exponential search. Keep
     // loading bounded even on a phone; unplaced property stays in inventory.
     if(++examined>3000)return false;
     const y=Math.min(...cols),x=cols.indexOf(y);
     if(y===grid.height)return false;
     let end=x+1;while(end<cols.length&&cols[end]===y)end++;
     const profile=String.fromCharCode(...cols),mirror=profile.split('').reverse().join('');
     const key=(profile<mirror?profile:mirror)+':'+left.join();
     if(dead.has(key))return false;
     for(let i=0;i<types.length;i++)if(left[i]){
       const free=slots(types[i],left[i],count===left[i]);
       if(!free){dead.add(key);return false}
       if(left[i]===count){
         const first=groups[i].length-count;
         free.forEach((p,j)=>chosen.set(groups[i][first+j].id,p));return true;
       }
     }
     let attempted=false;
     for(let i=0;i<types.length;i++){
       const n=types[i];
       if(!left[i]||end-x<n||y+n>grid.height)continue;
       const b=groups[i][groups[i].length-left[i]];
       attempted=true;left[i]--;cols.fill(y+n,x,x+n);chosen.set(b.id,{x,y});
       if(search(count-1,slack))return true;
       chosen.delete(b.id);cols.fill(y,x,x+n);left[i]++;
     }
     // A narrow notch cannot hold any pending square until its neighbours'
     // skyline is reached. Collapse the whole empty band in one operation.
     const stop=Math.min(x>0?cols[x-1]:grid.height,end<cols.length?cols[end]:grid.height);
     const length=attempted?1:end-x,height=attempted?1:stop-y,cost=length*height;
     if(slack>=cost){
       cols.fill(y+height,x,x+length);
       if(search(count,slack-cost))return true;
       cols.fill(y,x,x+length);
     }
     dead.add(key);return false;
   }
   return search(buildings,spare)?chosen:null;
 }
 function minimumStowed(old,grid){
   let lower=0;
   // Each square of side s contains floor(s/n)² disjoint n×n squares.
   // At most floor(w/n) × floor(h/n) such squares fit on a rectangular field.
   for(const n of [1,2,3,4]){
     const units=b=>Math.floor(size(b.type)/n)**2;
     let deficit=old.reduce((a,b)=>a+units(b),0)-Math.floor(grid.width/n)*Math.floor(grid.height/n);
     if(deficit<=0)continue;
     const movable=old.filter(b=>b.type!=='keep').map(units).sort((a,b)=>b-a);
     let count=0;while(deficit>0&&count<movable.length)deficit-=movable[count++];
     lower=Math.max(lower,count);
   }
   return lower;
 }
 function migrate(state){
   if(state.layoutVersion===2)return state;
   if(state.layoutVersion!==undefined&&state.layoutVersion!==1)throw new RangeError('Unknown island layout version');
   const xp=Number.isFinite(state.xp)?state.xp:legacyXP(state);
   const grid=gridAtLevel(1+Math.floor(Math.sqrt(Math.max(0,xp)/35))),old=state.buildings;
   // Keep the original deterministic v1 packing for already queued cloud saves.
   grid.width+=oldBorder;grid.height+=oldBorder;
   const oldGrid=gridAtLevel(1+Math.floor(Math.sqrt(Math.max(0,state.xp||0)/35)),1);
   let placed=pack(old,grid,oldGrid,0);
   const maximum=placed.size===old.length?old.length:old.length-minimumStowed(old,grid);
   // Sparse islands stay close to their original sites. On a crowded island
   // try two compact packings before sending anything to permanent storage.
   for(let order=1;placed.size<maximum&&order<=2;order++){
     const compact=pack(old,grid,oldGrid,order);
     if(compact.size>placed.size)placed=compact;
   }
   for(let mode=0;placed.size<maximum&&mode<4;mode++){
     const fixed=rectanglePacking(old,grid,mode),compact=pack(old,grid,oldGrid,0,fixed);
     if(compact.size>placed.size)placed=compact;
   }
   const demand=old.reduce((area,b)=>area+size(b.type)**2,0);
   if(placed.size<maximum&&maximum===old.length&&demand<=grid.width*grid.height){
     const exact=exactPacking(old,grid);
     if(exact)placed=pack(old,grid,oldGrid,0,exact);
   }
   // v1 saves have no snapshot timestamp. Use the cutover instant or the
   // latest confirmed building/raid event for a save written by an older app.
   // Reopening or retrying the same save therefore never mints another harvest.
   const lastRaid=Date.parse(state.lastRaid?.at||state.lastRaid?.day||'')||0;
   const at=Math.max(Date.UTC(2026,10,19,13),lastRaid,...old.map(b=>b.since||0));
   return {...state,xp,layoutVersion:2,buildings:old.map(b=>{
     if(placed.has(b.id))return placed.get(b.id);
     const stored={...b,x:null,y:null,stowed:true};
     if(Object.hasOwn(production,b.type))stored.pausedStock=Math.min(b.level*90,Math.floor((at-b.since)*production[b.type]*b.level/5000));
     return stored;
   })};
 }
 const api=Object.freeze({size,center,cells,at,fits,valid,gridAtLevel,migrate});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.OplotLayout=api;
})(typeof window==='object'?window:null);
