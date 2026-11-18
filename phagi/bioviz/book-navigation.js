'use strict';
window.PhagiReading = (() => {
  function read(key) {
    try { return JSON.parse(localStorage.getItem('phagi.reading.' + key)); } catch { return null; }
  }
  function write(key,value) {
    try { localStorage.setItem('phagi.reading.' + key,JSON.stringify(value)); return true; } catch { return false; }
  }
  function marks(book) {
    const list=read('marks.'+book);
    return Array.isArray(list) ? list.filter(m=>m && typeof m.token==='string' && typeof m.id==='string') : [];
  }
  const normal = value => (value || '').toLocaleLowerCase('ru').replaceAll('ё','е');
  const words = value => normal(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(word =>
    word.length >= 4 ? word.replace(/(?:иями|ами|ями|ого|его|ому|ему|ыми|ими|ая|яя|ое|ее|ие|ые|ий|ый|ой|ую|юю|ых|их|ом|ем|ам|ям|ах|ях|ов|ев|[аеиуыяю])$/, '') : word);
  function search(items,query) {
    const tokens=words(query);
    if (!tokens.length) return [];
    return items.map(item=>{
      const title=normal(item.title), hint=normal(item.hint), group=normal(item.group+' '+(item.bookTitle||''));
      const body=normal(item.body);
      const scores=tokens.map(t=>title.includes(t)?8:hint.includes(t)?4:group.includes(t)?2:body.includes(t)?1:0);
      if(scores.includes(0)) return null;
      return {item,score:scores.reduce((a,b)=>a+b,0)+(title.includes(normal(query.trim()))?8:0)};
    }).filter(Boolean).sort((a,b)=>b.score-a.score).map(match=>match.item);
  }
  function excerpt(item,query) {
    if(!item.body)return item.hint;
    const text=item.body.replace(/\s+/g,' ').trim(), lowered=normal(text);
    const positions=words(query).map(t=>lowered.indexOf(t)).filter(i=>i>=0);
    if(!positions.length)return item.hint;
    const pos=Math.min(...positions), near=Math.max(0,pos-39);
    const begin=near?Math.min(pos,text.indexOf(' ',near)+1):0;
    const end=text.indexOf(' ',begin+105);
    return (begin?'…':'')+text.slice(begin,end<0?undefined:end)+(end<0?'':'…');
  }
  function items(key) {
    const book=PhagiBookIndex[key];
    return book.groups.flatMap(g=>g.topics.map(([id,title,hint])=>({key,id,title,hint:hint||'',group:g.name,bookTitle:book.title})));
  }
  function element(tag,cls,text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text)node.textContent=text;
    return node;
  }
  return {read,write,marks,search,excerpt,items,element};
})();
