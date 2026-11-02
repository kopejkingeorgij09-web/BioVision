/* Кеш текстур драконов, общий для спрайтов C (sprites.js) и рига анимации (rig.js).
   Готовая текстура лежит по ключу (фенотип, стадия возраста, размер). Кто рисует дракона, держит его текстуру
   (acquire … release), и такую текстуру кеш не отдаёт, даже если лимит памяти превышен: видимый дракон
   не может внезапно пропасть. Свободные текстуры вытесняются по давности использования.
   Чистая логика без DOM: освобождение картинок делает функция free, которую передаёт владелец кеша. */
(function(root){
'use strict';

function TexCache(opt){
  opt=opt||{};
  this.budget=opt.budget||24*1024*1024;
  this.free=opt.free||function(){};
  this.map=new Map();   /* ключ → {v, p, refs}; порядок вставки = давность использования */
  this.hits=0;this.misses=0;this.evicted=0}

/* взять текстуру и держать её: обещание значения; make вызывается, только если текстуры ещё нет */
TexCache.prototype.acquire=function(key,make){
  let e=this.map.get(key);
  if(e){this.hits++;this.map.delete(key);this.map.set(key,e);e.refs++;return e.v?Promise.resolve(e.v):e.p}
  this.misses++;
  e={v:null,p:null,refs:1};
  e.p=Promise.resolve().then(make).then(v=>{
    if(this.map.get(key)!==e){this.free(v);throw new Error('кеш очищен, пока готовилась текстура')}
    e.v=v;this.evict();return v},
    err=>{if(this.map.get(key)===e)this.map.delete(key);throw err});
  this.map.set(key,e);
  return e.p};

/* отпустить текстуру: она остаётся в кеше, но теперь её можно вытеснить */
TexCache.prototype.release=function(key){
  const e=this.map.get(key);if(!e)return;
  e.refs=Math.max(0,e.refs-1);this.evict()};

TexCache.prototype.used=function(){let b=0;this.map.forEach(e=>{if(e.v)b+=e.v.bytes||0});return b};

/* вытеснить самые давние свободные, пока не уложимся в лимит; занятые и недоготовленные не трогаем */
TexCache.prototype.evict=function(){
  let b=this.used();
  for(const [k,e] of this.map){
    if(b<=this.budget)break;
    if(!e.v||e.refs>0)continue;
    b-=e.v.bytes||0;this.free(e.v);this.map.delete(k);this.evicted++}};

/* убрать одну свободную текстуру сразу, не дожидаясь лимита (крупная текстура осмотра после закрытия) */
TexCache.prototype.drop=function(key){const e=this.map.get(key);if(!e||!e.v||e.refs>0)return false;this.free(e.v);this.map.delete(key);return true};

TexCache.prototype.setBudget=function(b){this.budget=b;this.evict()};
TexCache.prototype.peek=function(key){const e=this.map.get(key);return e?{ready:!!e.v,refs:e.refs}:null};

/* убрать всё свободное (уход со страницы); force — убрать и занятое, когда рисующих точно не осталось */
TexCache.prototype.clear=function(force){
  for(const [k,e] of this.map){if(e.refs>0&&!force)continue;if(e.v)this.free(e.v);this.map.delete(k)}};

TexCache.prototype.stats=function(){
  let count=0,pinned=0,pinnedBytes=0,pending=0;
  this.map.forEach(e=>{if(!e.v){pending++;return}count++;if(e.refs>0){pinned++;pinnedBytes+=e.v.bytes||0}});
  const bytes=this.used();
  return {count,pending,pinned,pinnedBytes,bytes,budget:this.budget,over:bytes>this.budget,hits:this.hits,misses:this.misses,evicted:this.evicted}};

/* холсты, которые держат текстуры: считаем, чтобы видеть, что после ухода со страницы они не копятся */
let live=0;
function newCanvas(w,h){const cv=document.createElement('canvas');cv.width=w;cv.height=h;live++;return cv}
function dropCanvas(cv){if(cv&&cv.width){cv.width=0;cv.height=0;live--}}
/* значение текстуры: {bytes, parts:{имя:{cv,…}}}; общий кеш для всех драконов страницы */
const freeParts=v=>{if(v&&v.parts)Object.values(v.parts).forEach(p=>dropCanvas(p.cv))};
let shared=null;
const api={TexCache,newCanvas,dropCanvas,liveCanvases:()=>live,freeParts,
  /* на экранах 3× текстуры крупнее: бюджет вдвое больше (4.1) */
  get shared(){return shared||(shared=new TexCache({budget:24*1024*1024*(typeof devicePixelRatio!=='undefined'&&devicePixelRatio>2?2:1),free:freeParts}))}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DRTEX=api;
})(typeof window!=='undefined'?window:globalThis);
