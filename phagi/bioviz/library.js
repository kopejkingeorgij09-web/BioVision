'use strict';
(() => {
  const shelf=document.querySelector('#bv-shelf');
  const {read,marks,search,items,element}=PhagiReading;
  const books=shelf.querySelector('.bv-books'), results=shelf.querySelector('.bv-results'), field=shelf.querySelector('input');
  const all=Object.keys(PhagiBookIndex).flatMap(items);
  function link(key,id,mark) {
    const url=new URL('bioviz/'+key+'/',location.href);
    url.searchParams.set('from','phagi');
    if(mark)url.searchParams.set('mark',mark);
    url.hash=id;
    return url.href;
  }
  function listed(key,list) {
    const ul=element('ul');
    for(const [id,title,mark] of list){
      const li=element('li'), a=element('a','',title);
      a.href=link(key,id,mark);li.append(a);ul.append(li);
    }
    return ul;
  }
  function contents(key,target){
    target.replaceChildren();
    const groups=PhagiBookIndex[key].groups;
    const savedMarks=marks(key);
    if(savedMarks.length){
      const d=element('details');d.open=true;d.append(element('summary','','Мои закладки'),
        listed(key,savedMarks.map(m=>[m.id,m.label+(m.excerpt?' · '+m.excerpt:''),m.token])));target.append(d);
    }
    groups.forEach((group,i)=>{
      const d=element('details');d.open=!savedMarks.length && i===0;
      d.append(element('summary','',group.name),listed(key,group.topics));target.append(d);
    });
  }
  function refresh(){
    for(const volume of shelf.querySelectorAll('[data-book]')){
      const key=volume.dataset.book, place=read(key);
      const resume=volume.querySelector('.bv-resume-label'), action=volume.querySelector('.bv-read-link');
      const item=all.find(v=>v.key===key && v.id===place?.id);
      const known=item || (place && PhagiBookIndex[key].groups.find(g=>g.landing===place.id));
      const label=known && (known.title||known.name);
      const canResume=Boolean(label && (place.fraction>0.002 || place.id!==PhagiBookIndex[key].first));
      resume.hidden=!canResume;resume.textContent=canResume?'Вы читали «'+label+'»':'';
      action.textContent=canResume?'Продолжить чтение →':'Читать →';
      if(!volume.querySelector('.bv-topics').hidden)contents(key,volume.querySelector('.bv-topics'));
    }
  }
  shelf.addEventListener('click',e=>{
    const toggle=e.target.closest('.bv-contents-toggle');
    if(!toggle)return;
    const target=document.getElementById(toggle.getAttribute('aria-controls'));
    target.hidden=!target.hidden;toggle.setAttribute('aria-expanded',String(!target.hidden));
    if(!target.hidden)contents(toggle.closest('[data-book]').dataset.book,target);
  });
  function find(){
    const query=field.value.trim();results.hidden=!query;books.hidden=Boolean(query);
    results.replaceChildren();
    const status=shelf.querySelector('.bv-find-status');
    if(!query){status.textContent='';return;}
    const matches=search(all,query), count='Найдено разделов · '+matches.length;
    status.textContent=count;
    if(!matches.length){results.append(element('p','','Совпадений нет. Попробуйте другой термин.'));return;}
    results.append(element('h2','',count));const ul=element('ul');
    for(const item of matches){
      const li=element('li'),a=element('a');a.href=link(item.key,item.id);
      a.append(element('small','',item.bookTitle+' / '+item.group),element('strong','',item.title));
      if(item.hint)a.append(element('span','',item.hint));
      li.append(a);ul.append(li);
    }
    results.append(ul);
  }
  for(const button of shelf.querySelectorAll('.bv-contents-toggle'))button.hidden=false;
  field.closest('label').hidden=false;field.addEventListener('input',find);field.addEventListener('keydown',e=>{
    if(e.key==='Escape'){field.value='';find();}
  });
  window.addEventListener('pageshow',refresh);
  window.addEventListener('storage',refresh);
  window.PhagiShelf={refresh};refresh();find();
})();
