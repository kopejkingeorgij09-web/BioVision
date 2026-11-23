/* Calendar arithmetic and reading progress; page numbers match the BioViz PDF. */
(function(root){
const DAY=86400000, valid=d=>/^\d{4}-\d\d-\d\d$/.test(d||'')&&!Number.isNaN(Date.parse(d+'T12:00:00Z'));
const stamp=d=>Date.parse(d+'T12:00:00Z');
const add=(d,n)=>new Date(stamp(d)+n*DAY).toISOString().slice(0,10);
const diff=(a,b)=>Math.round((stamp(b)-stamp(a))/DAY);
const monday=d=>add(d,-((new Date(stamp(d)).getUTCDay()+6)%7));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function weeks(book,start,deadline){
 if(!valid(start)||!valid(deadline)||start>deadline)return [];
 const days=diff(start,deadline)+1,total=book.pages-book.firstPage+1,out=[];
 let from=start,previous=book.firstPage-1;
 while(from<=deadline){
  const to=[add(monday(from),6),deadline].sort()[0];
  const end=book.firstPage-1+Math.round(total*(diff(start,to)+1)/days);
  out.push({from,to,pageFrom:previous+1,pageTo:end,pages:end-previous});
  previous=end;from=add(to,1);
 }
 return out;
}
// A bookmark can jump to any page. Only observations and manual ranges earn credit.
function withReader(book,state,reader){
 const dates=new Map(),counts={};
 function remember(page,date){
  if(page>=book.firstPage&&page<=book.pages&&valid(date)&&(!dates.has(page)||date<dates.get(page)))dates.set(page,date);
 }
 for(const r of state.records||[]){
  for(let p=Math.max(book.firstPage,r.from);p<=Math.min(r.to,book.pages);p++)remember(p,r.date);
 }
 for(const [page,date] of Object.entries(reader?.pages||{}))remember(Number(page),date);
 for(const date of dates.values())counts[date]=(counts[date]||0)+1;
 // Older backups can contain just the manual frontier, without dated entries.
 for(let p=book.firstPage;p<=Math.min(state.current,book.pages);p++)if(!dates.has(p))dates.set(p,null);
 let current=book.firstPage-1;
 while(dates.has(current+1))current++;
 const position=Number(reader?.page);
 const resume=Number.isInteger(position)&&position>=1&&position<=book.pages&&reader.t>(state.markedAt||reader.manualAt||0)
  ?position:Math.min(book.pages,current+1);
 return {...state,current,dates,counts,resume};
}
function status(book,state,today){
 const current=clamp(Math.floor(Number(state.current)||book.firstPage-1),book.firstPage-1,book.pages);
 const plan=weeks(book,state.start,state.deadline),week=today>=state.start?plan.find(w=>current<w.pageTo):null;
 const total=book.pages-book.firstPage+1,done=state.dates?.size??(current-book.firstPage+1),remaining=total-done;
 const left=today>state.deadline?0:diff(today<state.start?state.start:today,state.deadline)+1;
 const elapsed=clamp(diff(state.start,today),0,diff(state.start,state.deadline)+1);
 const expected=book.firstPage-1+Math.round(total*elapsed/(diff(state.start,state.deadline)+1));
 const count=(first,last)=>state.dates?Array.from(state.dates.keys()).filter(p=>p>=first&&p<=last).length:clamp(current-first+1,0,last-first+1);
 return {current,resume:state.resume,count,total,done,remaining,plan,week,daysLeft:left,daily:left?Math.ceil(remaining/left):0,
  weekly:left?Math.ceil(remaining*Math.min(7,left)/left):0,lag:Math.max(0,expected-book.firstPage+1-done),
  weekDone:week?count(week.pageFrom,week.pageTo):0,complete:remaining===0,expired:remaining>0&&left===0};
}
function log(book,state,page,date){
 if(!Number.isInteger(page)||page<book.firstPage-1||page>book.pages||!valid(date))throw Error('Некорректная страница или дата');
 const previous=status(book,state,date).current;
 const records=(state.records||[]).map(r=>({...r,to:Math.min(r.to,page)})).filter(r=>r.from<=r.to);
 if(page>previous)records.push({date,from:previous+1,to:page});
 return {...state,current:page,records};
}
function pagesOn(state,date){
 if(state.counts)return state.counts[date]||0;
 const parts=(state.records||[]).filter(r=>r.date===date).sort((a,b)=>a.from-b.from);let end=0,total=0;
 for(const r of parts){total+=Math.max(0,r.to-Math.max(end,r.from-1));end=Math.max(end,r.to);}
 return total;
}
const api={withReader,weeks,status,log,pagesOn,add,diff};
if(typeof module==='object'&&module.exports)module.exports=api;else root.AlbertsPlan=api;
})(globalThis);
