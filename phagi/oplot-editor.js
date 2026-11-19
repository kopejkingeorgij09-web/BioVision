// A layout draft owns positions only. Balances, levels and production always come from the live island.
window.OplotEditor=(()=>{
 const snapshot=buildings=>buildings.map(b=>[b.id,b.stowed?null:b.x,b.stowed?null:b.y]);
 const key=buildings=>JSON.stringify(buildings.map(b=>[b.id,b.type,b.stowed?null:b.x,b.stowed?null:b.y]));
 function create(original,grid,previous){
   const base=key(original),history=[],starting=snapshot(original);
   let buildings=original.map(b=>({...b}));
   function restore(rows){
     if(!Array.isArray(rows)||rows.length!==original.length)return false;
     const placed=[];
     for(let i=0;i<rows.length;i++){
       const row=rows[i],b=original[i];
       if(!Array.isArray(row)||row.length!==3||row[0]!==b.id)return false;
       const [,x,y]=row;
       if(x===null&&y===null){placed.push({...b,x:null,y:null,stowed:true});continue}
       if(!OplotLayout.fits(placed,b.type,x,y,grid))return false;
       const item={...b,x,y};delete item.stowed;placed.push(item);
     }
     buildings=placed;return true;
   }
   if(previous?.base===base&&restore(previous.rows))history.push(starting);
   function remember(){if(history.length>=32)history.shift();history.push(snapshot(buildings))}
   return {
     base,get buildings(){return buildings},get canUndo(){return !!history.length},
     get dirty(){return key(buildings)!==base},get ready(){return buildings.some(b=>b.type==='keep'&&!b.stowed)},
     matches:live=>key(live)===base,serialize:()=>({base,rows:snapshot(buildings)}),
     put(id,x,y){
       const b=buildings.find(b=>b.id===id);
       if(!b||!OplotLayout.fits(buildings,b.type,x,y,grid,id))return false;
       if(b.stowed||b.x!==x||b.y!==y){remember();b.x=x;b.y=y;delete b.stowed}
       return true;
     },
     take(id){
       const b=buildings.find(b=>b.id===id);if(!b||b.stowed)return;
       remember();Object.assign(b,{x:null,y:null,stowed:true});
     },
     clear(){
       if(buildings.every(b=>b.stowed))return;
       remember();for(const b of buildings)Object.assign(b,{x:null,y:null,stowed:true});
     },
     undo(){if(history.length)restore(history.pop())}
   };
 }
 return {create};
})();
