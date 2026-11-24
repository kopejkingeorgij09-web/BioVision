/* Свободные интервалы. Все границы заданы в минутах от начала календарного дня. */
(function(root){
const step=5;
const fits=(windows,start,end)=>start<end&&windows.some(window=>window.start<=start&&end<=window.end);

function build(start,end,busy,work){
  const occupied=busy.map(interval=>({start:Math.max(start,interval.start),end:Math.min(end,interval.end)}))
    .filter(interval=>interval.start<interval.end).sort((a,b)=>a.start-b.start||a.end-b.end);
  const windows=[];
  let cursor=start, overlap=false;
  for(const interval of occupied){
    if(cursor<interval.start) windows.push({start:cursor,end:interval.start});
    if(interval.start<cursor) overlap=true;
    cursor=Math.max(cursor,interval.end);
  }
  if(cursor<end) windows.push({start:cursor,end});

  const slots=[], unplaced=[], available=windows.map(window=>({...window}));
  let required=0, unknown=0;
  for(const candidate of work){
    if(!candidate.minutes){ unknown++; continue; }
    required+=candidate.minutes;
    const window=available.find(window=>Math.ceil(window.start/step)*step+candidate.minutes<=window.end);
    if(!window){ unplaced.push(candidate); continue; }
    const slotStart=Math.ceil(window.start/step)*step, slotEnd=slotStart+candidate.minutes;
    slots.push({...candidate,start:slotStart,end:slotEnd});
    window.start=slotEnd;
  }
  const free=windows.reduce((sum,window)=>sum+window.end-window.start,0);
  return {windows,free,overlap,required,unknown,slots,unplaced};
}

const api={build,fits};
if(typeof module==='object'&&module.exports)module.exports=api;
else root.ZovDayPlan=api;
})(globalThis);
