'use strict';
// The host owns the address, navigation and theme. Each edition keeps its own reading tools.
const BVS={st:0, on:false, tab:'', previousView:'home', book:'', pending:null};
const bioBooks=['replication','repair','microbiology'];
const bioSections=['library','viz','quiz',...bioBooks];

function bvUrl(tab,fragment='',mark=''){
  const u=new URL(location.href);
  for(const key of ['task','review','lesson','role','date','shadHw','mark','bio'])u.searchParams.delete(key);
  if(tab)u.searchParams.set('bio',tab);
  if(mark)u.searchParams.set('mark',mark);
  u.hash=fragment;
  return u;
}
function bvRoute(){
  const tab=new URL(location.href).searchParams.get('bio');
  return bioSections.includes(tab)?tab:'';
}
function bvOpen(tab,fragment='',mark=''){
  if(!bioSections.includes(tab))return;
  const u=bvUrl(tab,fragment,mark);
  if(u.href!==location.href)history.pushState(null,'',u);
  S.view='bio';
  bvSync();
  render();
  window.scrollTo(0,0);
}
function bvUnloadBook(){
  const frame=document.getElementById('bv-reader');
  if(!frame)return;
  frame.contentWindow?.PhagiBookSession?.save();
  frame.remove();
  BVS.book='';
}
function bvDisplayBook(tab,url){
  const area=document.getElementById('bv-reading');
  if(BVS.book===tab){
    const session=document.getElementById('bv-reader')?.contentWindow?.PhagiBookSession;
    session?.navigate(url.hash,url.searchParams.get('mark'));
    return;
  }
  bvUnloadBook();
  BVS.book=tab;
  const src=new URL('bioviz/'+tab+'/',document.baseURI);
  src.searchParams.set('from','phagi');
  src.searchParams.set('embed','classroom');
  if(url.searchParams.has('mark'))src.searchParams.set('mark',url.searchParams.get('mark'));
  src.hash=url.hash;
  const frame=document.createElement('iframe');
  frame.id='bv-reader';
  frame.title=document.querySelector('.bv-book[data-book="'+tab+'"] h2').textContent;
  frame.src=src.href;
  area.append(frame);
}
window.PhagiBioReader={
  chapter(source,fragment,replace=false){
    const frame=document.getElementById('bv-reader');
    if(!frame || source!==frame.contentWindow || bvRoute()!==BVS.book)return;
    const u=bvUrl(BVS.book,fragment);
    if(u.href!==location.href)history[replace?'replaceState':'pushState'](null,'',u);
  },
  home(source){
    if(document.getElementById('bv-reader')?.contentWindow===source){
      const book=BVS.book;
      bvOpen('library');
      document.querySelector('.bv-book[data-book="'+book+'"] h2 a')?.focus({preventScroll:true});
    }
  }
};
function bvSync(){
  const room=document.getElementById('bv-room'), host=document.getElementById('bvhost');
  const on=S.view==='bio' && ['teacher','student'].includes(S.mode);
  room.hidden=!on;document.body.classList.toggle('bvon',on);
  if(!on){
    if(BVS.on){
      bvUnloadBook();bvFull(false);
      if(bvRoute())history.pushState({phagiView:S.view},'',bvUrl(''));
      if(window.BVHOST){BVHOST.on=false;if(BVS.st===2)BV.pause();}
      BVS.tab='';BVS.pending=null;BVS.want=null;
    }
    BVS.on=false;
    BVS.previousView=S.view;
    return;
  }
  let tab=bvRoute();
  if(!BVS.on && !tab){
    history.replaceState({...history.state,phagiView:BVS.previousView},'');
    history.pushState(null,'',bvUrl('library'));
    tab='library';
  }
  BVS.on=true;
  let command=BVS.want;BVS.want=null;
  if(command){
    const dest=bioSections.includes(command)?command:'quiz';
    if(dest!==tab)history.pushState(null,'',bvUrl(dest));
    tab=dest;
  }
  tab=tab||'library';
  const changed=tab!==BVS.tab;
  BVS.tab=tab;
  const book=bioBooks.includes(tab), work=tab==='viz'||tab==='quiz';
  document.getElementById('bv-shelf').hidden=tab!=='library';
  document.getElementById('bv-reading').hidden=!book;
  document.getElementById('bv-work').hidden=!work;host.hidden=!work;
  for(const a of room.querySelectorAll('.bv-shelf-nav a')){
    if(a.dataset.bio===(book?'library':tab))a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  }
  if(book)bvDisplayBook(tab,new URL(location.href));else bvUnloadBook();
  if(tab==='library'){
    if(window.PhagiShelf)PhagiShelf.refresh();
    else if(!BVS.shelfLoad)BVS.shelfLoad=Promise.all([bvScript('bioviz/book-index.js?v=2'),bvScript('bioviz/book-navigation.js?v=1')])
      .then(()=>bvScript('bioviz/library.js?v=2')).catch(()=>{BVS.shelfLoad=null;});
  }
  if(!work){
    BVS.pending=null;
    if(window.BVHOST?.on){BVHOST.on=false;if(BVS.st===2)BV.pause();bvFull(false);}
    return;
  }
  if(command||changed)BVS.pending=command||tab;
  const waking=window.BVHOST && !BVHOST.on;
  if(window.BVHOST)BVHOST.on=true;
  if(BVS.st===2 && BVS.pending){
    const before=host.shadowRoot.querySelector('.module:not([hidden])');
    bvWant();
    if(waking && before && !before.hidden)BV.resume();
  }
  else if(!BVS.st)bvLoad();
}
document.getElementById('bv-room').addEventListener('click',e=>{
  const a=e.target.closest('a[href]');
  if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const u=new URL(a.href), tab=u.searchParams.get('bio');
  if(u.origin!==location.origin || u.pathname!==location.pathname || !bioSections.includes(tab))return;
  e.preventDefault();bvOpen(tab,u.hash,u.searchParams.get('mark'));
  if(bioBooks.includes(tab))document.getElementById('bv-reader')?.focus({preventScroll:true});
});
window.addEventListener('popstate',e=>{
  if(!['teacher','student'].includes(S.mode))return;
  if(bvRoute())S.view='bio';
  else if(BVS.on)S.view=e.state?.phagiView||BVS.previousView||'home';
  else return;
  BVS.want=null;bvSync();render();
});
function bvModelTools(root){
  const style=document.createElement('link');
  style.rel='stylesheet';style.href='bioviz/classroom-models.css?v=1';
  const bar=document.createElement('div');bar.className='classroom-tools';
  const label=document.createElement('label'), select=document.createElement('select');
  label.append('Модель',select);
  let group=select;
  for(const node of root.querySelectorAll('.side .nav-group,.side [data-go]')){
    if(node.classList.contains('nav-group')){
      group=document.createElement('optgroup');group.label=node.textContent.trim();select.append(group);
    }else if(node.dataset.go!=='quiz'){
      const option=new Option(node.childNodes[0].textContent.trim(),node.dataset.go);group.append(option);
    }
  }
  select.onchange=()=>{if(select.value==='replication')bvOpen('replication');else BV.go(select.value);};
  const voice=root.getElementById('voiceGlobal');
  const full=document.createElement('button');
  full.type='button';full.className='btn ghost';full.dataset.classroomFull='';
  full.textContent='На весь экран';full.setAttribute('aria-pressed','false');
  full.onclick=()=>bvFull(!document.body.classList.contains('bvfull'));
  bar.append(label);
  if(voice)bar.append(voice);
  bar.append(full);
  root.querySelector('main').prepend(bar);root.append(style);
  const sync=()=>{
    const active=root.querySelector('.module:not([hidden])');
    if(!active)return;
    const id=active.id.slice(2);label.hidden=id==='quiz';select.value=id;
    if(BVS.on && BVS.tab==='viz' && id==='quiz')bvOpen('quiz');
    else if(BVS.on && BVS.tab==='quiz' && id!=='quiz')bvOpen('viz');
  };
  const watch=new MutationObserver(sync);
  for(const mod of root.querySelectorAll('.module'))watch.observe(mod,{attributes:true,attributeFilter:['hidden']});
  sync();
}
