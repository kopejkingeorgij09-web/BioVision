/* Автотесты сохранения острова: node phagi/dragons/store.test.js
   Подставной сервер в памяти: отказ до отправки, ответ потерялся после записи, отказ записи, быстрые действия подряд,
   запоздалый снимок, запись с другого устройства и из другой вкладки, старый документ без rev, неверные часы. */
'use strict';
const assert=require('assert');
const {Store}=require('./store.js');
let n=0,fails=0;const q=[];
function t(name,fn){q.push([name,fn])}
const tick=()=>new Promise(r=>setImmediate(r));
/* сервер: doc — то, что лежит в базе; fail — что сломать в следующем вызове */
function server(doc){const s={doc:doc==null?null:JSON.parse(JSON.stringify(doc)),reads:0,writes:0,fail:{},
  async read(){s.reads++;await tick();if(s.fail.read){s.fail.read--;throw {code:'unavailable'}}return s.doc&&JSON.parse(JSON.stringify(s.doc))},
  async write(d){s.writes++;await tick();if(s.fail.write){s.fail.write--;throw {code:'unavailable'}}
    s.doc=JSON.parse(JSON.stringify(d));if(s.fail.lost){s.fail.lost--;throw {code:'unavailable',message:'ответ потерялся'}}}};return s}
const feed=d=>{d.food-=5;d.fed=(d.fed||0)+1;d.updatedAt='2026-10-28T10:00:0'+(d.fed%10)+'Z';return d};
function mk(doc,o){const sv=server(doc),st=new Store({read:()=>sv.read(),write:d=>sv.write(d)},o);st.snap(doc);return {sv,st}}

t('обычная запись: tip и conf совпадают, rev растёт, в базе ровно то, что видит игрок',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  st.apply(feed);assert.strictEqual(st.status,'saving');assert.strictEqual(st.tip.food,35);
  assert.strictEqual(await st.settled(),'ok');assert.strictEqual(sv.doc.food,35);assert.strictEqual(sv.doc.rev,1);
  assert.deepStrictEqual(st.conf,st.tip)});

t('пять быстрых действий подряд: каждое списано один раз, записей меньше пяти, итог на сервере верный',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  for(let i=0;i<5;i++)st.apply(feed);
  assert.strictEqual(st.tip.food,15);assert.strictEqual(await st.settled(),'ok');
  assert.strictEqual(sv.doc.food,15);assert.strictEqual(sv.doc.fed,5);assert.ok(sv.writes<5,'записей '+sv.writes);assert.strictEqual(st.tip.food,15)});

t('отказ записи: статус error, новые действия не принимаются, «Отменить» возвращает подтверждённое',async()=>{
  const {sv,st}=mk({food:40,fed:0,rev:3});
  sv.fail.write=1;st.apply(feed);assert.strictEqual(await st.settled(),'error');
  assert.strictEqual(st.tip.fed,1);assert.strictEqual(sv.doc.fed,0);
  assert.strictEqual(st.apply(feed),null,'действие при ошибке не принимается');assert.strictEqual(st.tip.fed,1);
  st.discard();assert.strictEqual(st.tip.fed,0);assert.strictEqual(st.tip.food,40);assert.strictEqual(st.status,'ok')});

t('отказ записи и «Повторить»: запись проходит один раз, корм списан один раз',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  sv.fail.write=1;st.apply(feed);await st.settled();assert.strictEqual(st.status,'error');
  assert.strictEqual(await st.retry(),'ok');assert.strictEqual(sv.doc.food,35);assert.strictEqual(sv.doc.fed,1);assert.strictEqual(sv.doc.rev,1)});

t('нет связи ещё до отправки (чтение упало): ничего не записано, после «Повторить» запись одна',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  sv.fail.read=1;st.apply(feed);assert.strictEqual(await st.settled(),'error');assert.strictEqual(sv.writes,0);
  await st.retry();assert.strictEqual(sv.writes,1);assert.strictEqual(sv.doc.fed,1)});

t('запись дошла, а ответ потерялся: «Повторить» узнаёт свою запись и не пишет поверх второй раз ту же трату',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  sv.fail.lost=1;st.apply(feed);assert.strictEqual(await st.settled(),'error');
  assert.strictEqual(sv.doc.fed,1,'на сервере запись уже есть');
  const w0=sv.writes;assert.strictEqual(await st.retry(),'ok');assert.strictEqual(sv.writes,w0,'второй записи нет');assert.strictEqual(sv.doc.fed,1);assert.strictEqual(sv.doc.food,35);assert.strictEqual(sv.doc.rev,1);
  assert.strictEqual(st.status,'ok');assert.strictEqual(st.conf.fed,1)});

t('запоздалый снимок (старый документ) во время записи не откатывает то, что видит игрок',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  st.apply(feed);st.snap({food:40,fed:0});assert.strictEqual(st.tip.fed,1);
  await st.settled();assert.strictEqual(st.tip.fed,1);assert.strictEqual(sv.doc.fed,1)});

t('после ошибки сервер не игнорируется навсегда: «Отменить», и следующий снимок принимается',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  sv.fail.write=1;st.apply(feed);await st.settled();st.discard();
  st.snap({food:100,fed:0,rev:0,updatedAt:'2020-01-01T00:00:00Z'});
  assert.strictEqual(st.tip.food,100,'снимок со «старыми» часами принят, порядок решает rev, а не время')});

t('другое устройство записало, пока у нас нет незаписанного: просто принимаем его снимок',async()=>{
  const {st}=mk({food:40,fed:0,rev:2});
  st.snap({food:10,fed:3,rev:3,by:'other',op:'x'});assert.strictEqual(st.tip.food,10);assert.strictEqual(st.status,'ok')});

t('другое устройство записало до нашей записи: конфликт, наше не перезаписывает чужое, можно взять с сервера',async()=>{
  const {sv,st}=mk({food:40,fed:0,rev:2});
  sv.doc={food:10,fed:3,rev:3,by:'other',op:'x'};
  st.apply(feed);assert.strictEqual(await st.settled(),'conflict');assert.strictEqual(sv.doc.food,10,'чужое не тронуто');
  assert.strictEqual(st.apply(feed),null);st.takeRemote();assert.strictEqual(st.tip.food,10);assert.strictEqual(st.status,'ok')});

t('две вкладки одного устройства: вторая видит конфликт вместо тихой потери',async()=>{
  const sv=server({food:40,fed:0});const io={read:()=>sv.read(),write:d=>sv.write(d)};
  const a=new Store(io,{tab:'A'}),b=new Store(io,{tab:'B'});a.snap(sv.doc);b.snap(sv.doc);
  a.apply(feed);await a.settled();b.apply(feed);assert.strictEqual(await b.settled(),'conflict');
  assert.strictEqual(sv.doc.fed,1);assert.strictEqual(sv.doc.by,'A')});

t('свой отголосок во время записи (облако сразу показывает наш документ) не считается конфликтом',async()=>{
  const sv=server({food:40,fed:0});let st;
  st=new Store({read:()=>sv.read(),write:async d=>{st.snap(d);return sv.write(d)}},{tab:'A'});st.snap(sv.doc);
  st.apply(feed);assert.strictEqual(await st.settled(),'ok');assert.strictEqual(st.status,'ok')});

t('старый документ без rev и op и неизвестные поля: запись сохраняет поля и ставит rev 1',async()=>{
  const old={food:40,fed:0,pve:{v:1,best:{e1:3}},zzz:{keep:true}};const {sv,st}=mk(old);
  st.apply(feed);await st.settled();assert.deepStrictEqual(sv.doc.zzz,{keep:true});assert.deepStrictEqual(sv.doc.pve,{v:1,best:{e1:3}});assert.strictEqual(sv.doc.rev,1)});

t('первый документ (на сервере пусто), и пустой сервер при непустом conf считается конфликтом',async()=>{
  const {sv,st}=mk(null);st.apply(()=>({food:40}));assert.strictEqual(await st.settled(),'ok');assert.strictEqual(sv.doc.rev,1);
  const x=mk({food:5,rev:4});x.sv.doc=null;x.st.apply(feed);assert.strictEqual(await x.st.settled(),'conflict')});

t('запоздалый снимок rev 1 после подтверждённой записи rev 2 не принимается и не меняет статус',async()=>{
  const {sv,st}=mk({food:40,fed:0});
  st.apply(feed);await st.settled();const r1=JSON.parse(JSON.stringify(sv.doc));assert.strictEqual(r1.rev,1);
  st.apply(feed);await st.settled();assert.strictEqual(st.conf.rev,2);
  st.snap(r1);assert.strictEqual(st.tip.rev,2,'остался rev 2');assert.strictEqual(st.tip.fed,2);assert.strictEqual(st.status,'ok')});

t('чужой документ с тем же rev и другим op: конфликт, ничего не подменено',async()=>{
  const {st}=mk({food:40,fed:0,rev:3,by:'A',op:'a3'});
  st.snap({food:1,fed:9,rev:3,by:'B',op:'b3'});assert.strictEqual(st.status,'conflict');assert.strictEqual(st.tip.food,40);
  st.takeRemote();assert.strictEqual(st.tip.food,1)});

t('чужой документ с меньшим rev, которого мы не видели (старая вкладка переписала): конфликт',async()=>{
  const {st}=mk({food:40,fed:0,rev:5,by:'A',op:'a5'});
  st.snap({food:7,fed:0,rev:2,by:'old',op:'o2'});assert.strictEqual(st.status,'conflict');assert.strictEqual(st.tip.food,40)});

t('документ, переписанный страницей без rev поверх нашего: конфликт, а не тихая замена',async()=>{
  const {st}=mk({food:40,fed:0,rev:2,by:'A',op:'a2',updatedAt:'x'});
  st.snap({food:3,fed:0,updatedAt:'y'});assert.strictEqual(st.status,'conflict')});

t('конф без rev и op (старый документ): следующий снимок принимается',async()=>{
  const {st}=mk({food:40,fed:0});st.snap({food:41,fed:0,updatedAt:'z'});assert.strictEqual(st.tip.food,41);assert.strictEqual(st.status,'ok')});

t('документ удалили на сервере: конфликт без «взять с сервера», «Записать мою версию» продолжает rev',async()=>{
  const {sv,st}=mk({food:40,fed:0,rev:4,by:'A',op:'a4'});
  sv.doc=null;st.snap(null);assert.strictEqual(st.status,'conflict');assert.strictEqual(st.remote,null);assert.strictEqual(st.tip.food,40);
  assert.strictEqual(await st.restore(),'ok');assert.strictEqual(sv.doc.food,40);assert.strictEqual(sv.doc.rev,5)});

t('повтор того же подтверждённого снимка ничего не меняет и не вызывает перерисовку',async()=>{
  let em=0;const {st}=mk({food:40,fed:0,rev:2,by:'A',op:'a2'},{onChange:()=>em++});em=0;
  st.snap({food:40,fed:0,rev:2,by:'A',op:'a2'});assert.strictEqual(em,0);assert.strictEqual(st.status,'ok')});

/* сервер с CAS (как ph_set_if): пишет, только если в базе лежит ожидаемая версия; проверка и запись атомарны */
function casServer(doc){const s=server(doc);s.cas=async(d,rev,op)=>{s.writes++;await tick();
  if(s.fail.write){s.fail.write--;throw {code:'unavailable'}}
  const cur=s.doc,cr=cur?(Number.isInteger(cur.rev)?cur.rev:0):null;
  if((cur==null)!==(rev==null)||cur&&(cr!==rev||(cur.op||null)!==op))return {ok:false,cur:cur&&JSON.parse(JSON.stringify(cur))};
  if(d.rev!==(rev==null?0:rev)+1)throw {code:'bad rev'};
  s.doc=JSON.parse(JSON.stringify(d));if(s.fail.lost){s.fail.lost--;throw {code:'unavailable'}}return {ok:true}};return s}
function mkc(doc,o){const sv=casServer(doc),st=new Store({read:()=>sv.read(),write:d=>sv.write(d),cas:(d,r,p)=>sv.cas(d,r,p)},o);st.snap(doc);return {sv,st}}

t('CAS: обычная запись одним вызовом, без чтения перед ней',async()=>{
  const {sv,st}=mkc({food:40,fed:0});st.apply(feed);assert.strictEqual(await st.settled(),'ok');
  assert.strictEqual(sv.reads,0);assert.strictEqual(sv.doc.rev,1);assert.strictEqual(sv.doc.fed,1)});

t('CAS: другое устройство успело записать между нашими действиями: конфликт, его запись цела',async()=>{
  const {sv,st}=mkc({food:40,fed:0,rev:2,by:'A',op:'a2'});
  sv.doc={food:10,fed:3,rev:3,by:'B',op:'b3'};st.apply(feed);assert.strictEqual(await st.settled(),'conflict');
  assert.strictEqual(sv.doc.by,'B');assert.strictEqual(st.remote.food,10)});

t('CAS: ответ потерялся, «Повторить» узнаёт свою запись и не пишет второй раз',async()=>{
  const {sv,st}=mkc({food:40,fed:0});sv.fail.lost=1;st.apply(feed);assert.strictEqual(await st.settled(),'error');
  const w0=sv.writes;assert.strictEqual(await st.retry(),'ok');assert.strictEqual(sv.doc.fed,1);assert.strictEqual(sv.doc.rev,1);assert.strictEqual(sv.writes,w0+1,'один вызов CAS, который вернул нашу же запись')});

t('CAS: две вкладки пишут одновременно, проходит ровно одна',async()=>{
  const sv=casServer({food:40,fed:0});const io={read:()=>sv.read(),write:d=>sv.write(d),cas:(d,r,p)=>sv.cas(d,r,p)};
  const a=new Store(io,{tab:'A'}),b=new Store(io,{tab:'B'});a.snap(sv.doc);b.snap(sv.doc);
  a.apply(feed);b.apply(feed);const r=[await a.settled(),await b.settled()].sort();
  assert.deepStrictEqual(r,['conflict','ok']);assert.strictEqual(sv.doc.fed,1)});

t('CAS: первый документ (в базе пусто) пишется с ожиданием «документа нет»',async()=>{
  const {sv,st}=mkc(null);st.apply(()=>({food:40}));assert.strictEqual(await st.settled(),'ok');assert.strictEqual(sv.doc.rev,1)});

(async()=>{for(const [name,fn] of q){n++;try{await fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,3).join(' '))}}
  console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1)})();
