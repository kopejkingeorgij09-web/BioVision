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
test('calendar details come from the occurrence, including building, room and teachers',()=>{
 const event={id:'mirea',start:today+'T14:20',end:today+'T15:50',title:'Информатика · практика',location:'К-215 (В-86)',notes:'РТУ МИРЭА · ХББО-04-26\n4-я пара · чётная неделя\nКожухарь О. Ю.'};
 const item=widgets([],[event])[0];
 assert.equal(item.location,'Корпус В-86 · ауд. К-215');
 assert.equal(item.teacher,'Кожухарь О. Ю.');assert.equal(item.end,event.end);
 const moved={...event,location:'А-61 (МП-1)',teacher:'Другой преподаватель'};
 const updated=widgets([],[{...event,occ:[moved]}])[0];
 assert.equal(updated.location,'Корпус МП-1 · ауд. А-61');assert.equal(updated.teacher,'Другой преподаватель');
});
test('subgroups retain their own teacher and room; unlabelled personal notes stay private',()=>{
 const event={id:'lab',start:today+'T09:00',end:today+'T10:30',title:'Физика · лабораторная',location:'В-321 / В-324',notes:'РТУ МИРЭА · ХББО-04-26\n1-я пара · чётная неделя\n1-я подгруппа — Санжаровский, В-321\n2-я подгруппа — Савинов, В-324'};
 const item=widgets([],[event])[0];
 assert.equal(item.location,'Ауд. В-321 / В-324');
 assert.equal(item.teacher,'1-я п/г · Санжаровский, В-321\n2-я п/г · Савинов, В-324');
 assert.equal(widgets([],[{...event,notes:'Личные заметки: секрет'}])[0].teacher,'');
 assert.equal(widgets([],[{...event,notes:'Преподаватель: Савинкина Е. В.'}])[0].teacher,'Савинкина Е. В.');
 assert.equal(widgets([],[{...event,building:'МП-1',room:'А-233',teacher:'Медведев А. А.'}])[0].location,'Корпус МП-1 · Ауд. А-233');
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
