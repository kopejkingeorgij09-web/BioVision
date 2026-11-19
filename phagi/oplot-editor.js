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
   function reserve(items){
     if(!items.length)return;
     remember();for(const b of items)Object.assign(b,{x:null,y:null,stowed:true});
   }
   function wallSection(id,count){
     const start=buildings.find(b=>b.id===id&&b.type==='wall'&&!b.stowed);
     if(!start||!Number.isInteger(count)||count<5||count>10)return [];
     const positions=new Map(buildings.filter(b=>b.type==='wall'&&!b.stowed).map(b=>[b.x+','+b.y,b]));
     const section=[start];positions.delete(start.x+','+start.y);
     for(let i=0;i<section.length&&section.length<count;i++){
       const {x,y}=section[i];
       for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
         const key=(x+dx)+','+(y+dy),next=positions.get(key);
         if(next){positions.delete(key);section.push(next);if(section.length===count)break}
       }
     }
     return section;
   }
   function wallDestination(section,cell){
     const first=section[0],cells=[];
     if(!first||!cell||!Number.isInteger(cell.x)||!Number.isInteger(cell.y))return {cells,issue:'Укажи место на острове.'};
     const moving=new Set(section.map(b=>b.id)),others=buildings.filter(b=>!moving.has(b.id));
     for(const b of section)cells.push({id:b.id,level:b.level,x:cell.x+b.x-first.x,y:cell.y+b.y-first.y});
     let issue='';
     if(section.length<5||section.length>10)issue='Для переноса нужны от 5 до 10 соединённых секций.';
     else if(cells.some(p=>p.x<0||p.y<0||p.x>=grid.width||p.y>=grid.height))issue='Часть стены выходит за край острова.';
     else if(cells.some(p=>OplotLayout.at(others,p.x,p.y)))issue='Место занято другой постройкой или стеной.';
     else if(cell.x===first.x&&cell.y===first.y)issue='Выбери новое место для участка.';
     return {cells,issue};
   }
   return {
     base,get buildings(){return buildings},get canUndo(){return !!history.length},
     get dirty(){return key(buildings)!==base},get ready(){return buildings.some(b=>b.type==='keep'&&!b.stowed)},
     matches:live=>key(live)===base,serialize:()=>({base,rows:snapshot(buildings)}),
     setGrid(bounds){grid=bounds},
     wallSection,wallDestination,
     moveWalls(id,count,cell){
       const section=wallSection(id,count),{cells,issue}=wallDestination(section,cell);
       if(section.length!==count||issue)return false;
       remember();section.forEach((b,i)=>{b.x=cells[i].x;b.y=cells[i].y});return true;
     },
     put(id,x,y){
       const b=buildings.find(b=>b.id===id);
       if(!b||!OplotLayout.fits(buildings,b.type,x,y,grid,id))return false;
       if(b.stowed||b.x!==x||b.y!==y){remember();b.x=x;b.y=y;delete b.stowed}
       return true;
     },
     take(id){reserve(buildings.filter(b=>b.id===id&&!b.stowed))},
     clear(){reserve(buildings.filter(b=>!b.stowed))},
     undo(){if(history.length)restore(history.pop())}
   };
 }
 return {create};
})();
