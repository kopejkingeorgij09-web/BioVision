const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const widgetSource=fs.readFileSync('bamboo/android/web/widget-data.js','utf8');
function widgets(tasks,events=[],plan=[]){
 const messages=[];
 const B={tasks:()=>tasks,shad:{plan},shadStage:()=>0,on:()=>{},ymd:d=>d.toISOString().slice(0,10),add:(s,n)=>new Date(Date.parse(s)+n*86400000).toISOString().slice(0,10),nextRep:(d,r)=>B.add(d,1),calData:{validDate:d=>/^\d{4}-\d\d-\d\d$/.test(d||''),events:()=>events,occurrences:e=>e.occ||[e],dateOf:d=>d.slice(0,10)}};
 vm.runInNewContext(widgetSource,{window:{B,ZovReminder:{postMessage:s=>messages.push(JSON.parse(s))},addEventListener:()=>{}},B,document:{addEventListener:()=>{}},setTimeout,clearTimeout});
 return messages.at(-1).items;
}
const today=new Date().toISOString().slice(0,10);
test('widget includes unfinished tasks, event occurrences and placed SHAD; excludes completed and undated tasks',()=>{
 const items=widgets([{id:'a',due:today,time:'12:00',title:'Task'},{id:'b',due:today,done:true},{id:'c',title:'Undated'}],[{id:'e',start:today+'T10:00',end:today+'T11:00',title:'Event'}],[{n:5,t:'Complex',wp:true,w:{date:today,from:'11:00'},hp:false}]);
 assert.deepEqual(items.map(x=>x.kind),['event','shad','task']);assert.equal(items[1].id,'5');
});
test('recurrences are expanded, limited and snapshots remove deleted tasks',()=>{
 const items=widgets([{id:'r',due:today,rep:{},title:'Repeat'}]);assert.equal(items.length,15);
 assert.deepEqual(widgets([]),[]);
 assert.equal(widgets(Array.from({length:500},(_,i)=>({id:String(i),due:today,title:'T'}))).length,300);
});
test('one-off lesson retains homework on move; weekly occurrences stay separate',()=>{
 const html=fs.readFileSync('phagi/index.html','utf8');
 const source=html.match(/const lessonTasks=([^;]+);/)[1];
 const tasks=[{id:'own',kind:'task',lesson:{eventId:'shad-w5',date:'2026-11-17'}},{id:'other',kind:'task',lesson:{eventId:'other',date:'2026-11-17'}}];
 const match=vm.runInNewContext(source,{myTasks:()=>tasks});
 assert.equal(match({id:'shad-w5',repeat:'none'},'2026-11-22')[0].id,'own');
 assert.equal(match({id:'shad-w5',repeat:'weekly'},'2026-11-22').length,0);
 assert.equal(match({id:'shad-w5',repeat:'weekly'},'2026-11-17').length,1);
});
