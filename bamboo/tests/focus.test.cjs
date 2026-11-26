const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function studio(){
  let now=new Date(2026,10,26,8).getTime(),seq=0,tick;
  const docs=new Map(),messages=[],sources=[],gains=[],notifications=[],remote=[];
  class Clock extends Date{
    constructor(...args){super(...(args.length?args:[now]));}
    static now(){return now;}
  }
  class Audio{
    state='running';currentTime=0;destination={};
    createGain(){
      const gain={value:0,setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}};
      gains.push(gain);return {gain,connect(){},disconnect(){}};
    }
    createBiquadFilter(){return {frequency:{},gain:{setTargetAtTime(){}},connect(){}};}
    createDynamicsCompressor(){return {threshold:{},knee:{},ratio:{},connect(){}};}
    createBufferSource(){const node={connect(){},disconnect(){},start(at,offset){sources.push({name:this.buffer.name,offset});},stop(){}};return node;}
    async decodeAudioData(raw){return {name:raw,duration:30};}
  }
  const B={acts:{},inputs:{},ver:0,esc:String,icon:()=>'',pad:n=>String(n).padStart(2,'0'),cfg:()=>({}),
    clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),uid:()=>String(++seq),today:()=> '2026-11-26',dayOf:()=> '2026-11-26',add:()=> '2026-11-26',
    get:k=>docs.get(k),list:prefix=>[...docs].filter(([k])=>k.startsWith(prefix)).map(x=>x[1]),
    put(k,v){docs.set(k,v);this.ver++;},on(){},persistLocal(){},render(){},toast:t=>messages.push(t),
    boardData:{all:()=>[],history:()=>({done:[]})}};
  const page={B,Date:Clock,location:{hash:'#/board/focus'},document:{addEventListener(){},querySelector(){return null;}},
    addEventListener(){},setInterval:fn=>{tick=fn;},AudioContext:Audio,ZovDesktop:undefined,
    fetch:async url=>({ok:true,arrayBuffer:async()=>url.split('/').pop().split('.')[0]}),
    Notification:class {static permission='granted';constructor(label){notifications.push(label);}},navigator:{}};
  page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync('bamboo/js/focus.js','utf8'),page);
  return {B,page,messages,sources,notifications,remote,pref:(k,v)=>B.put('focuspref_'+k,{value:v}),
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
test('atmosphere resumes all loops at the saved playhead and reset returns to the start',async()=>{
  const {B,sources,advance}=studio();
  await B.acts.focusSound();await settle();assert.deepEqual(sources.map(s=>s.offset),[0,0]);
  advance(12500);await B.acts.focusSound();assert.equal(B.get('focuspref_sound').elapsed,12500);
  advance(23000);await B.acts.focusSound();await settle();assert.deepEqual(sources.slice(-2).map(s=>s.offset),[12.5,12.5]);
  B.acts.focusAudioReset();assert.equal(B.get('focuspref_sound').value,false);assert.equal(B.get('focuspref_sound').elapsed,0);
  await B.acts.focusSound();await settle();assert.deepEqual(sources.slice(-2).map(s=>s.offset),[0,0]);
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
