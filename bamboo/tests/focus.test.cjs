const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function studio(storage=new Map()){
  let now=new Date(2026,10,26,8).getTime(),seq=0,tick;
  const docs=new Map(),messages=[],sources=[],notifications=[],listeners=new Map();
  class Clock extends Date{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  class Audio{
    state='running';currentTime=0;destination={};
    createGain(){
      const gain={value:0,setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}};
      return {gain,connect(){},disconnect(){}};
    }
    createBiquadFilter(){return {frequency:{},gain:{setTargetAtTime(){}},connect(){}};}
    createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},connect(){}};}
    createBufferSource(){const node={connect(){},disconnect(){},start(at,offset){sources.push({name:this.buffer.name,offset});},stop(){}};return node;}
    async decodeAudioData(raw){return {name:raw,duration:30};}
  }
  const B={acts:{},inputs:{},ver:0,esc:String,icon:()=>'',pad:n=>String(n).padStart(2,'0'),cfg:()=>({}),
    clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),uid:()=>String(++seq),today:()=> '2026-11-26',dayOf:()=> '2026-11-26',add:()=> '2026-11-26',
    get:k=>docs.get(k),list:prefix=>[...docs].filter(([k])=>k.startsWith(prefix)).map(x=>x[1]),
    put(k,v){docs.set(k,v);this.ver++;},on(k,fn){listeners.set(k,fn);},persistLocal(){},render(){},toast:t=>messages.push(t),
    fmtW:String, boardData:{all:()=>[],completed:()=>[]}};
  const page={B,Date:Clock,location:{hash:'#/board/focus'},document:{addEventListener(){},querySelector(){return null;}},
    addEventListener(){},setInterval:fn=>{tick=fn;},AudioContext:Audio,ZovDesktop:undefined,
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    fetch:async url=>({ok:true,arrayBuffer:async()=>url.split('/').pop().split('.')[0]}),
    Notification:class {static permission='granted';constructor(label){notifications.push(label);}},navigator:{}};
  page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync('bamboo/js/focus.js','utf8'),page);
  return {B,page,messages,sources,notifications,pref:(k,v)=>B.put('focuspref_'+k,{value:v}),
    receive(k,v){B.put(k,v);listeners.get('change')();},
    advance:ms=>{now+=ms;tick();},tick:()=>tick()};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('both timer modes notify once, pauses postpone the deadline, a reset cancels the alert',async()=>{
  for(const mode of ['timer','pomo']){
    const {B,pref,advance,tick,messages,sources,notifications}=studio();
    pref('mode',mode);pref('work',1);pref('notify',true);B.acts.focusToggle();await settle();
    advance(10000);B.acts.focusToggle();advance(120000);
    assert.equal(messages.length,0);assert.equal(B.focus.widgetSnapshot().until,0);
    B.acts.focusToggle();advance(49999);assert.equal(messages.length,0);advance(1);
    tick();await settle();
    const label=mode==='timer'?'Таймер завершён':'Интервал помодоро завершён';
    assert.deepEqual(messages,[label]);assert.deepEqual(notifications,[label]);
    assert.equal(sources.filter(s=>s.name==='chime').length,1);
    assert.equal(B.focus.sessions().length,1);
    B.acts.focusReset();B.acts.focusToggle();B.acts.focusReset();advance(60000);
    assert.equal(messages.length,1);assert.equal(B.focus.widgetSnapshot().until,0);
    pref('chimeVolume',0);assert.equal(B.focus.widgetSnapshot().chime,false);
  }
});
test('Pomodoro rotation gives the selected short and long breaks and returns to work',()=>{
  const {B,pref,advance}=studio();
  pref('mode','pomo');pref('work',1);pref('short',2);pref('long',4);pref('every',2);
  for(const n of [2,4]){
    B.focus.append('toggle');assert.equal(B.focus.current().timer.phase,'work');advance(60000);
    B.focus.append('toggle');assert.equal(B.focus.current().timer.phase,'break');assert.equal(B.focus.current().timer.total,n*60000);
    advance(n*60000);
  }
  assert.equal(B.focus.sessions().length,2);
});
test('reload within a minute of completion cannot repeat the same notification; stale deadlines stay silent',()=>{
  const storage=new Map(),first=studio(storage);
  first.B.focus.append('toggle');const op=first.B.focus.current();
  first.advance(25*60000);assert.equal(first.messages.length,1);
  const reload=studio(storage);reload.advance(25*60000+15000);
  reload.receive('focusop_'+op.id,op);assert.deepEqual(reload.messages,[]);
  const late=studio();late.advance(26*60000);
  late.receive('focusop_'+op.id,op);assert.deepEqual(late.messages,[]);
});
test('week drilldown lists confirmed completions for the chosen day, including externally marked SHAD',()=>{
  const {B}=studio(),today=B.today();
  B.boardData.completed=()=>[{day:today,title:'Вебинар ШАД'}, {day:'2026-11-25',title:'Вчерашнее дело'}, {day:'',title:'Дата неизвестна'}];
  let sheet;B.sheet=html=>{sheet=html;};B.acts.focusWeek();
  assert.match(sheet,/Выполнено дел · 1/);assert.match(sheet,/✓ Вебинар ШАД/);
  assert.doesNotMatch(sheet,/Вчерашнее дело|Дата неизвестна/);
});
test('atmosphere resumes all loops at the saved playhead and reset returns to the start',async()=>{
  const {B,sources,advance}=studio();
  await B.acts.focusSound();await settle();assert.deepEqual(sources.map(s=>s.offset),[0,0]);
  advance(12500);await B.acts.focusSound();assert.equal(B.get('focuspref_sound').elapsed,12500);
  advance(23000);await B.acts.focusSound();await settle();assert.deepEqual(sources.slice(-2).map(s=>s.offset),[12.5,12.5]);
  B.acts.focusAudioReset();assert.equal(B.get('focuspref_sound').value,false);assert.equal(B.get('focuspref_sound').elapsed,0);
  await B.acts.focusSound();await settle();assert.deepEqual(sources.slice(-2).map(s=>s.offset),[0,0]);
});
test('a second device joins the current mix position, receives pause, resumes and rewinds',async()=>{
  const first=studio(),second=studio(),key='focuspref_sound';
  await first.B.acts.focusSound();first.advance(6500);second.advance(6500);
  second.receive(key,first.B.get(key));
  await second.B.acts.focusSound();await settle();
  assert.deepEqual(second.sources.map(s=>s.offset),[6.5,6.5]);
  await second.B.acts.focusSound();first.receive(key,second.B.get(key));
  first.advance(31000);second.advance(31000);await first.B.acts.focusSound();
  second.receive(key,first.B.get(key));await settle();
  assert.deepEqual(second.sources.slice(-2).map(s=>s.offset),[6.5,6.5]);
  first.B.acts.focusAudioReset();second.receive(key,first.B.get(key));
  await second.B.acts.focusSound();await settle();
  assert.deepEqual(second.sources.slice(-2).map(s=>s.offset),[0,0]);
});
test('new and legacy focus routes consistently expose exactly two tabs',()=>{
  const {B,page}=studio();
  for(const section of ['','studio','customize','themes','atmosphere']){
    page.location.hash='#/board/focus'+(section?'/'+section:'');const html=B.focus.render();
    const nav=html.match(/<nav class="fr-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.equal((nav.match(/<a /g)||[]).length,2);assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
    if(B.focus.isStudio())assert.match(html,/Быстрый микшер/);
    else{assert.equal((html.match(/class="fr-scene"/g)||[]).length,10);assert.match(html,/Теплота звука/);}
  }
});

test('board selection starts one linked work interval and rechecks the target when switching',async()=>{
  const {B,advance}=studio();
  const cards=[{id:'event:talk:2026-11-26',lane:'plan',title:'Занятие'},
    {id:'task:study',lane:'active',title:'Занятие'}];
  B.boardData.all=()=>cards;
  B.boardData.move=(c,lane)=>{c.lane=lane;};
  const pick=i=>B.acts.focusStartCard({dataset:{id:cards[i].id}});
  await pick(0);
  const first=B.focus.current().timer;
  assert.equal(first.card,cards[0].id);assert.equal(cards[0].lane,'active');
  advance(5000);B.focus.append('toggle');
  const paused=B.focus.current();
  await pick(0);assert.equal(B.focus.current(),paused);
  B.confirm=async()=>false;
  await pick(1);assert.equal(B.focus.current(),paused);
  B.confirm=async()=>{cards[1].lane='done';return true;};
  await pick(1);assert.equal(B.focus.current(),paused);
  cards[1].lane='active';B.confirm=async()=>true;
  await pick(1);advance(25*60000);
  assert.deepEqual(Array.from(B.focus.sessions(),s=>s.card),[cards[1].id]);
  assert.equal(cards[1].lane,'active');
});
