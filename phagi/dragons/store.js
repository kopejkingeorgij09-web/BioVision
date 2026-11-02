/* Сохранение острова: подтверждённое состояние и ожидающие записи (этап 1 доработки Драконов).
   Раньше save() сразу заменял документ в памяти и при ошибке записи только показывал уведомление: следующие действия
   считались от состояния, которого нет на сервере, а свежий снимок с сервера отбрасывался по часам браузера.
   Здесь три вещи раздельно:
   - conf — последнее состояние, которое сервер точно принял (или прислал снимком);
   - tip — то, что видит игрок: conf плюс действия, которые ещё пишутся;
   - status — ok (всё записано), saving (пишется), error (запись не прошла), conflict (документ изменили в другом месте).
   При error и conflict новые действия не принимаются, пока игрок не выберет «Повторить» или «Отменить» (вернуть conf).
   Порядок записей определяет счётчик rev в документе, а не часы: каждая запись rev = conf.rev + 1, с меткой вкладки by
   и номером операции op. Перед записью читаем документ с сервера: если там rev другой и это не наша же запись,
   значит, остров изменили на другом устройстве или в другой вкладке, и мы ничего не перезаписываем.
   Это сужает окно потери, но не закрывает его: между чтением и записью другое устройство может успеть записать.
   Полная гарантия нужна на сервере (запись «только если rev совпал»), её здесь нет. Модуль без DOM, проверяется в store.test.js. */
(function(root){
'use strict';
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
const revOf=d=>d&&Number.isInteger(d.rev)&&d.rev>=0?d.rev:0;
/* тот же ли это документ: счётчик, операция и метка записи. Старые документы без rev и op считаются rev 0 без op;
   метка updatedAt ловит запись старой версией страницы, которая не знает про rev и переписала бы его как есть */
const same=(a,b)=>!a&&!b||!!a&&!!b&&revOf(a)===revOf(b)&&(a.op||null)===(b.op||null)&&(a.updatedAt||null)===(b.updatedAt||null);
/* содержимое без служебной метки записи */
const body=d=>{const x=Object.assign({},d);delete x.rev;delete x.by;delete x.op;return JSON.stringify(x)};
const rid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);

/* io: {read() → Promise<документ|null>, write(документ) → Promise}, tab — метка вкладки, onChange(store) */
function Store(io,o){
  o=o||{};this.io=io;this.tab=o.tab||rid();this.onChange=o.onChange||null;
  this.conf=null;this.tip=null;this.loaded=false;this.status='ok';this.err=null;this.remote=null;
  this.inflight=null;this.sent=null;this.dirty=false;this.flushes=0;this.writes=0;this.seen={};this.seenQ=[]}
Store.prototype.emit=function(){if(this.onChange)try{this.onChange(this)}catch(e){}};
Store.prototype.pending=function(){return this.dirty||!!this.inflight};
/* можно ли сейчас делать новое действие */
Store.prototype.canAct=function(){return this.status!=='error'&&this.status!=='conflict'};
/* какой это снимок по отношению к conf. Решают rev и метка записи (by, op, updatedAt), часы устройства не участвуют:
   same — тот же документ; newer — rev больше; stale — наш же прошлый документ (видели его как conf), пришёл с опозданием;
   legacy — conf без rev и op (документ старой версии страницы), сравнить нельзя, принимаем снимок;
   gone — документ на сервере удалён, а у нас он есть; clash — rev тот же или меньше, а документ другой: его записали в другом месте */
Store.prototype.kind=function(srv){
  const c=this.conf;
  if(same(srv,c))return 'same';
  if(!c)return 'newer';
  if(!srv)return 'gone';
  if(!revOf(c)&&!c.op)return 'legacy';
  if(revOf(srv)>revOf(c))return 'newer';
  if(srv.op&&this.seen[srv.op]===(srv.updatedAt||null)&&revOf(srv)<revOf(c))return 'stale';
  return 'clash'};
/* запомнить документ как подтверждённый: по op потом узнаём свои запоздалые снимки */
Store.prototype.keep=function(d){if(d&&d.op){this.seen[d.op]=d.updatedAt||null;this.seenQ.push(d.op);
  if(this.seenQ.length>64)delete this.seen[this.seenQ.shift()]}};
/* снимок с сервера. Пока есть незаписанные действия, снимок не заменяет то, что видит игрок:
   свой отголосок (наша же запись) пропускаем, чужую запись запоминаем как конфликт.
   Без незаписанных: более новый принимаем, свой старый пропускаем, чужой с тем же или меньшим rev и удаление — конфликт */
Store.prototype.snap=function(srv){
  srv=srv==null?null:clone(srv);
  const first=!this.loaded;this.loaded=true;
  const mine=srv&&srv.by===this.tab&&this.sent&&srv.op===this.sent.op;
  if(mine)return;
  const k=first?'newer':this.kind(srv);
  if(k==='same'||k==='stale')return;
  if(!this.pending()&&this.status!=='error'){
    if(this.status==='conflict')return;            /* игрок ещё не выбрал, что делать */
    if(k==='newer'||k==='legacy'){this.conf=srv;this.tip=srv;this.keep(srv);this.status='ok';this.err=null;this.remote=null;this.emit();return}
    this.remote=srv;this.status='conflict';this.emit();return}
  if(!srv)return;                                  /* при записи пустой сервер поймает flush */
  if(srv.by!==this.tab||k==='clash'){this.remote=srv;if(!this.inflight){this.status='conflict';this.emit()}}};
/* действие: fn(текущее состояние) → новый документ или null. Возвращает новый документ или null, если действие не принято */
Store.prototype.apply=function(fn){
  if(!this.canAct())return null;
  const next=fn(clone(this.tip));if(!next)return null;
  this.tip=next;this.dirty=true;if(this.status==='ok')this.status='saving';this.emit();
  this.flush();return next};
/* записать текущий tip. Записи идут по одной; действия, сделанные во время записи, уходят следующей одной записью */
Store.prototype.flush=function(){
  if(this.inflight||!this.dirty)return this.inflight||Promise.resolve(this.status);
  this.dirty=false;this.flushes++;
  const doc=Object.assign(clone(this.tip),{rev:Math.max(revOf(this.conf),this.floor||0)+1,by:this.tab,op:rid()});
  this.sent=doc;this.status='saving';this.emit();
  const run=(async()=>{
    /* сервер умеет «записать, только если версия та же» (io.cas): одна атомарная запись вместо чтения и записи */
    if(this.io.cas)return this.casWrite(doc);
    let srv;try{srv=await this.io.read()}catch(e){throw {stage:'read',e}}
    /* на сервере должно лежать ровно conf. Если нет: либо наша прошлая запись всё-таки дошла (тот же op), либо чужая */
    if(!same(srv,this.conf)){
      if(srv&&this.lostOp&&srv.op===this.lostOp&&srv.by===this.tab){this.conf=srv;this.keep(srv);doc.rev=revOf(srv)+1;this.lostOp=null;
        /* прошлая запись дошла, а нового с тех пор ничего: писать второй раз не нужно */
        if(body(srv)===body(doc))return srv}
      else{const c=new Error('conflict');c.conflict=true;c.srv=srv;throw c}}
    this.writes++;
    await this.io.write(doc);
    return doc})();
  this.inflight=run.then(d=>{this.inflight=null;this.conf=d;this.keep(d);this.lostOp=null;
      if(this.dirty){this.tip=Object.assign(this.tip,{rev:d.rev,by:d.by,op:d.op});this.status='saving';this.emit();return this.flush()}
      this.tip=d;this.status='ok';this.err=null;this.sent=null;this.emit();return 'ok'},
    e=>{this.inflight=null;this.sent=null;
      if(e&&e.conflict){this.status='conflict';this.remote=e.srv||null;this.err=null;this.dirty=true}
      else{this.status='error';this.err=(e&&e.e)||e;this.dirty=true;if(!(e&&e.stage==='read'))this.lostOp=doc.op}
      this.emit();return this.status});
  return this.inflight};
/* запись через CAS: ожидаем в базе conf (rev и op); ответ {ok} или {ok:false, cur} */
Store.prototype.casWrite=async function(doc){
  const exp=d=>d?[revOf(d),d.op||null]:[null,null];
  let [r,o]=exp(this.conf);this.writes++;let res=await this.io.cas(doc,r,o);
  if(res&&res.ok)return doc;
  const cur=res&&res.cur||null;
  if(cur&&this.lostOp&&cur.op===this.lostOp&&cur.by===this.tab){this.conf=cur;this.keep(cur);this.lostOp=null;
    if(body(cur)===body(doc))return cur;
    doc.rev=revOf(cur)+1;[r,o]=exp(cur);this.writes++;res=await this.io.cas(doc,r,o);if(res&&res.ok)return doc}
  const c=new Error('conflict');c.conflict=true;c.srv=res&&res.cur||cur;throw c};
/* «Повторить»: та же запись ещё раз. Если прошлая дошла до сервера, а ответ потерялся, это видно по op и второй раз не пишется */
Store.prototype.retry=function(){if(this.status!=='error')return Promise.resolve(this.status);this.status='saving';this.dirty=true;this.emit();return this.flush()};
/* «Отменить»: вернуть последнее подтверждённое состояние, незаписанные действия пропадают */
Store.prototype.discard=function(){this.tip=clone(this.conf);this.dirty=false;this.status='ok';this.err=null;this.remote=null;this.lostOp=null;this.emit()};
/* при конфликте «Взять с сервера»: состояние с другого устройства становится текущим, свои незаписанные действия пропадают */
Store.prototype.takeRemote=function(){if(this.status!=='conflict')return;this.conf=clone(this.remote);this.keep(this.conf);this.tip=clone(this.remote);this.dirty=false;
  this.status='ok';this.remote=null;this.emit()};
/* при конфликте «удалён на сервере» (remote пуст) «Записать мою версию»: пишем то, что видит игрок, rev продолжает прежний счёт */
Store.prototype.restore=function(){if(this.status!=='conflict'||this.remote)return Promise.resolve(this.status);
  this.floor=revOf(this.conf);this.conf=null;this.dirty=true;this.status='saving';this.emit();return this.flush()};
/* ждать, пока всё записано (или ошибка): для экрана победы и похожих мест */
Store.prototype.settled=function(){return this.inflight?this.inflight.then(()=>this.inflight?this.settled():this.status):Promise.resolve(this.status)};

const DRSTORE={Store,revOf};
if(typeof module!=='undefined'&&module.exports)module.exports=DRSTORE;else root.DRSTORE=DRSTORE;
})(typeof window!=='undefined'?window:globalThis);
