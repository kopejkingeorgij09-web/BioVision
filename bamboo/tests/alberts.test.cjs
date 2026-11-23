const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../js/alberts-model.js'),book=require('../alberts-plan.json');
const state={start:'2026-11-16',deadline:'2026-12-31',current:17,records:[]};
test('seven weekly targets cover exactly the chapter pages through Dec 31 without gaps',()=>{
 const weeks=model.weeks(book,state.start,state.deadline);
 assert.equal(weeks.length,7);assert.equal(weeks.reduce((n,w)=>n+w.pages,0),779);
 assert.equal(weeks[0].pageFrom,18);assert.equal(weeks.at(-1).pageTo,796);assert.equal(weeks.at(-1).to,'2026-12-31');
 weeks.slice(1).forEach((w,i)=>{assert.equal(w.pageFrom,weeks[i].pageTo+1);assert.equal(w.from,model.add(weeks[i].to,1));});
 assert.deepEqual(weeks.map(x=>x.pages),[119,118,119,118,119,118,68]);
 assert.equal(model.status(book,state,'2026-11-16').daily,17);
});
test('confirmed progress counts only the reading day, and a correction removes excess credit',()=>{
 let s=model.log(book,state,35,'2026-11-16');assert.equal(model.pagesOn(s,'2026-11-16'),18);
 s=model.log(book,s,40,'2026-11-18');assert.equal(model.pagesOn(s,'2026-11-17'),0);assert.equal(model.pagesOn(s,'2026-11-18'),5);
 s=model.log(book,s,30,'2026-11-18');assert.equal(s.current,30);assert.equal(model.pagesOn(s,'2026-11-18'),0);assert.equal(model.pagesOn(s,'2026-11-16'),13);
 assert.throws(()=>model.log(book,state,797,'2026-11-16'));assert.throws(()=>model.log(book,state,30.5,'2026-11-16'));
});
test('catch-up uses remaining days and keeps the original weekly goals',()=>{
 const initial=model.status(book,state,'2026-11-16'),late=model.status(book,state,'2026-12-01');
 assert(late.daily>initial.daily);assert(late.lag>0);assert.deepEqual(late.plan,initial.plan);
 assert.equal(model.status(book,state,'2027-01-01').expired,true);assert.equal(model.status(book,state,'2027-01-01').daily,0);
 assert.equal(model.status(book,{...state,current:796},'2026-12-31').complete,true);
});

test('unfinished target survives Monday and deadline; gaps and bookmarks never close it',()=>{
 const manual=model.log(book,state,34,'2026-11-17');
 const reader={t:200,page:220,pages:{34:'2026-11-18',35:'2026-11-18',130:'2026-11-18'}};
 const merged=model.withReader(book,manual,reader);
 for(const day of ['2026-11-23','2027-01-01']){
  const s=model.status(book,merged,day);
  assert.equal(s.current,35);assert.equal(s.resume,220);assert.equal(s.week.pageTo,136);
  assert.equal(s.weekDone,19);assert.equal(s.done,19);
 }
 assert.equal(model.pagesOn(merged,'2026-11-18'),2);
 const advanced=model.log(book,manual,136,'2026-11-23');
 const next=model.status(book,model.withReader(book,{...advanced,markedAt:201},reader),'2026-11-23');
 assert.equal(next.resume,137);assert.equal(next.week.pageFrom,137);assert.equal(next.weekDone,0);
});
