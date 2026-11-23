const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('clock ticks on ten-second boundaries, corrects after sleep, and crosses local midnight',()=>{
  const local = (day,h,m,s,ms=0)=>new Date(2026,10,day,h,m,s,ms).getTime();
  let time=local(23,23,59,46,321), pending=null, delay=0, parent=null;
  const mark={style:{},setAttribute(){},remove(){parent=null;}};
  const document=Object.assign(new EventTarget(),{hidden:false,createElement:()=>mark});
  const window=new EventTarget();
  const dates=['2026-11-23','2026-11-24'];
  const cells=key=>dates.map(day=>({dataset:{[key]:day},classList:{toggle(token,on){this[token]=on;}},
    append(){parent=this;}}));
  const columns=cells('col'), headers=cells('d'), all=cells('all');
  const root={isConnected:true,querySelector:selector=>columns.find(c=>selector.includes(c.dataset.col)),
    querySelectorAll:selector=>({'.ac-col':columns,'.ac-head button':headers,'.ac-allday':all})[selector]};
  const ctx={B:{ymd:d=>'2026-11-'+d.getDate()},window,document,Date:class extends Date {constructor(){super(time);}},
    setTimeout(fn,ms){pending=fn;delay=ms;return 1;},clearTimeout(){pending=null;}};
  vm.runInNewContext(fs.readFileSync('bamboo/js/calendar-clock.js','utf8'),ctx);
  const stop=ctx.B.mountCalendarClock(root);
  function at(seconds){assert.ok(Math.abs(parseFloat(mark.style.top)*864-seconds)<.001);}
  assert.equal(parent,columns[0]);at(86386.321);assert.equal(delay,3679);
  time+=delay;pending();at(86390);assert.equal(delay,10000);
  time+=delay;pending();at(0);assert.equal(parent,columns[1]);
  for(const row of [columns,headers,all])assert.deepEqual(row.map(c=>c.classList.now),[false,true]);
  time=local(24,7,31,19);pending();at(27079);assert.equal(delay,1000);
  document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(pending,null);
  time=local(24,16,23,44);document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));at(59024);
  time=local(24,10,2,3);window.dispatchEvent(new Event('zov-clock-resume'));at(36123);
  time=local(25,6,0,0);window.dispatchEvent(new Event('focus'));assert.equal(parent,null);
  stop();window.dispatchEvent(new Event('pageshow'));assert.equal(pending,null);
});
