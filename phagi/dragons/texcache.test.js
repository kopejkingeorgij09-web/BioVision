/* Автотесты кеша текстур: node phagi/dragons/texcache.test.js
   Главное: текстуру, которую держит видимый дракон, кеш не освобождает ни при каком лимите. */
'use strict';
const assert=require('assert');
const {TexCache}=require('./texcache.js');

let fails=0,n=0;const queue=[];
function t(name,fn){queue.push([name,fn])}
const MB=1024*1024;
function mk(budget){const freed=[];const c=new TexCache({budget,free:v=>{freed.push(v.id);v.freed=true}});c.freed=freed;return c}
const tex=(id,mb)=>()=>({id,bytes:mb*MB});

t('одинаковый ключ готовится один раз, повторный запрос берётся из кеша',async()=>{
  const c=mk(10*MB);let made=0;const make=()=>{made++;return {id:'a',bytes:MB}};
  const [x,y]=await Promise.all([c.acquire('a',make),c.acquire('a',make)]);
  assert.strictEqual(made,1);assert.strictEqual(x,y);
  const s=c.stats();assert.strictEqual(s.hits,1);assert.strictEqual(s.misses,1);assert.strictEqual(c.peek('a').refs,2)});

t('занятая текстура не вытесняется даже сверх лимита, свободная вытесняется',async()=>{
  const c=mk(2*MB);
  const a=await c.acquire('a',tex('a',1.5));
  await c.acquire('b',tex('b',1.5));
  assert.ok(!a.freed,'видимая текстура a освобождена');assert.deepStrictEqual(c.freed,[]);
  assert.ok(c.stats().over,'лимит превышен, но обе текстуры заняты');
  c.release('b');
  assert.deepStrictEqual(c.freed,['b']);assert.ok(!a.freed);assert.ok(!c.stats().over)});

t('вытесняются самые давние свободные',async()=>{
  const c=mk(3*MB);
  for(const k of ['a','b','c']){await c.acquire(k,tex(k,1));c.release(k)}
  await c.acquire('a',tex('a',1));c.release('a');   /* a стала самой свежей */
  await c.acquire('d',tex('d',1));c.release('d');
  assert.deepStrictEqual(c.freed,['b'])});

t('лимит меньше занятого: ничего занятого не трогаем, после release укладываемся',async()=>{
  const c=mk(100*MB);
  await c.acquire('a',tex('a',3));await c.acquire('b',tex('b',3));
  c.setBudget(1*MB);assert.deepStrictEqual(c.freed,[]);
  c.release('a');assert.deepStrictEqual(c.freed,['a']);
  c.release('b');assert.deepStrictEqual(c.freed,['a','b']);assert.strictEqual(c.stats().bytes,0)});

t('двойной release не уводит счётчик в минус и не освобождает чужое',async()=>{
  const c=mk(1*MB);
  await c.acquire('a',tex('a',2));await c.acquire('a',tex('a',2));
  c.release('a');assert.deepStrictEqual(c.freed,[]);   /* ещё один держит */
  c.release('a');c.release('a');assert.deepStrictEqual(c.freed,['a']);
  c.release('нет такого')});

t('ошибка подготовки не оставляет ключ в кеше, следующий запрос пробует снова',async()=>{
  const c=mk(10*MB);let k=0;
  await assert.rejects(c.acquire('a',()=>{k++;throw new Error('нет')}));
  const v=await c.acquire('a',()=>{k++;return {id:'a',bytes:1}});
  assert.strictEqual(k,2);assert.strictEqual(v.id,'a')});

t('clear отдаёт свободное, занятое остаётся; clear(true) отдаёт всё',async()=>{
  const c=mk(10*MB);
  await c.acquire('a',tex('a',1));await c.acquire('b',tex('b',1));c.release('b');
  c.clear();assert.deepStrictEqual(c.freed,['b']);assert.ok(c.peek('a'));
  c.clear(true);assert.deepStrictEqual(c.freed,['b','a']);assert.strictEqual(c.stats().count,0)});

t('если кеш очистили, пока текстура готовилась, она освобождается, а не теряется',async()=>{
  const c=mk(10*MB);let go;const p=c.acquire('a',()=>new Promise(r=>{go=r}));
  await Promise.resolve();c.clear(true);go({id:'a',bytes:MB});
  await assert.rejects(p);assert.deepStrictEqual(c.freed,['a'])});

t('drop убирает только свободную готовую текстуру',async()=>{
  const c=mk(10*MB);
  await c.acquire('a',tex('a',1));assert.strictEqual(c.drop('a'),false);assert.deepStrictEqual(c.freed,[]);   /* занята */
  c.release('a');assert.strictEqual(c.drop('a'),true);assert.deepStrictEqual(c.freed,['a']);assert.strictEqual(c.peek('a'),null);
  assert.strictEqual(c.drop('нет такого'),false)});

(async()=>{for(const [name,fn] of queue){n++;try{await fn();console.log('ok  ',name)}catch(e){fails++;console.log('FAIL',name,'\n     ',e.stack.split('\n').slice(0,2).join(' '))}}
  console.log(`\n${n-fails}/${n} тестов прошли`);if(fails)process.exit(1)})();
