'use strict';
(() => {
  const url=new URL(location.href);
  if(url.searchParams.get('from')!=='phagi' || url.searchParams.has('widget'))return;
  if(!window.PhagiBookIndex || !window.PhagiReading || !window.PhagiBookAppearance){window.ReplicationBook?.showSequence();return;}
  const micro=document.getElementById('microbook');
  if(micro && !window.MicroBookPage)return;
  const key=micro?'microbiology':(document.documentElement.dataset.volume || 'replication'), book=PhagiBookIndex[key];
  const {read,write,marks,items,search,excerpt,element}=PhagiReading;
  const topics=items(key), byId=new Map(topics.map(s=>[s.id,s]));
  for(const group of book.groups){
    if(group.landing)byId.set(group.landing,{id:group.landing,title:group.name,group:book.title});
  }
  const sections=new Map([...document.querySelectorAll('#book .unit')].map(n=>[n.id,n]));
  const root=document.documentElement, prefs=read('settings') || {};
  const wide=matchMedia('(min-width:1000px)'), dark=matchMedia('(prefers-color-scheme:dark)');
  const original=read(key), storedMarks=()=>marks(key);
  root.classList.add('reading-desk');
  root.dataset.book=key;
  if('scrollRestoration' in history)history.scrollRestoration='manual';

  const paths={book:'<path d="M3 5c3-1 6-.7 9 1.4C15 4.3 18 4 21 5v14c-3-1-6-.7-9 1.4C9 18.3 6 18 3 19zM12 6.5v14"/>',menu:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.5M3 12h.5M3 18h.5"/>',mark:'<path d="M6 3.5h12v17l-6-4-6 4z"/>',find:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',zoom:'<path d="M8.5 10.5h5M11 8v5M16 16l5 5"/><circle cx="10.7" cy="10.7" r="7"/>'};
  const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
  const bar=element('header','desk-bar');
  bar.innerHTML='<a class="desk-home" href="../../?bio=library">'+icon('book')+'<span>Книги</span></a><span class="desk-bar-title"></span><div class="desk-tools"><button type="button" data-panel="toc" aria-label="Оглавление" aria-controls="desk-outline">'+icon('menu')+'<span>Оглавление</span></button><button type="button" data-action="mark" aria-label="Поставить закладку" title="Поставить закладку">'+icon('mark')+'</button><button type="button" data-panel="type" aria-label="Настройки чтения" title="Настройки чтения">Аа</button></div><progress max="1" value="0" aria-label="Положение в разделе"></progress>';
  bar.querySelector('.desk-bar-title').textContent=book.title;
  document.body.prepend(bar);
  const rail=element('aside','desk-rail'), pane=element('div','desk-outline');
  pane.id='desk-outline';
  pane.innerHTML='<div class="desk-pane-head"><h2>Оглавление</h2><button type="button" data-dismiss aria-label="Закрыть оглавление">'+icon('close')+'</button></div><label class="desk-find">'+icon('find')+'<input type="search" aria-label="Найти в книге" placeholder="Найти в книге" autocomplete="off"></label><div class="desk-sections"><button type="button" data-view="all">Темы</button><button type="button" data-view="marks">Закладки<span></span></button></div><nav class="desk-list" aria-label="Разделы книги"></nav>';
  const drawer=element('dialog','desk-drawer');drawer.setAttribute('aria-label','Оглавление');
  const settings=element('dialog','desk-dialog');settings.setAttribute('aria-labelledby','desk-settings-title');
  settings.innerHTML='<header><h2 id="desk-settings-title">Настройки чтения</h2><button type="button" data-dismiss aria-label="Закрыть">'+icon('close')+'</button></header><div class="desk-options"><label>Размер букв<select name="size"><option value="17">17 · мелкий</option><option value="19">19 · обычный</option><option value="21">21 · крупный</option><option value="23">23 · очень крупный</option></select></label><label>Шрифт<select name="face"><option value="serif">С засечками</option><option value="sans">Без засечек</option></select></label><label>Ширина строки<select name="width"><option value="standard">Обычная</option><option value="wide">Широкая</option></select></label><label>Цвет страницы<select name="theme"><option value="auto">Как в системе</option><option value="light">Светлый</option><option value="dark">Тёмный</option></select></label></div>';
  if(micro){
    const more=element('div','desk-extras');
    const offline=element('button','','Сохранить учебник офлайн');
    offline.onclick=()=>MicroBookPage.saveOffline(offline);
    const classroom=micro.querySelector('[data-action=classroom]'), session=element('button','','Режим для занятия');
    session.setAttribute('aria-pressed','false');
    session.onclick=()=>{classroom.click();session.setAttribute('aria-pressed',classroom.getAttribute('aria-pressed'));};
    more.append(session,offline);settings.append(more);
  }
  const lightbox=element('dialog','desk-lightbox');
  lightbox.setAttribute('aria-label','Просмотр рисунка');
  lightbox.innerHTML='<header><strong></strong><div><button type="button" data-fit aria-pressed="true">Целиком</button><button type="button" data-enlarge aria-pressed="false">Крупнее</button><button type="button" data-dismiss aria-label="Закрыть рисунок">'+icon('close')+'</button></div></header><div class="desk-image-pan" tabindex="0" aria-label="Увеличенный рисунок. Стрелки перемещают область просмотра"><img alt=""></div><p></p>';
  const notice=element('div','desk-notice');notice.setAttribute('role','status');
  document.body.append(rail,drawer,settings,lightbox,notice);
  const field=pane.querySelector('input'), list=pane.querySelector('nav'), markButton=bar.querySelector('[data-action=mark]'), tocButton=bar.querySelector('[data-panel=toc]');
  const progress=bar.querySelector('progress');
  const openGroups=new Set();
  let route='', paneView='all', railOff=false, activePage=null, settingsPlace=null, sharedImage='', zoomWidth=0;
  let tick=0,saveTimer=0,noticeTimer=0,releaseRestore=()=>{};
  function announce(message){notice.textContent=message;notice.classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('visible'),1700);}
  function applySettings(){
    const theme=PhagiBookAppearance(prefs);
    if(micro)MicroBookPage.setTheme(theme);
    const defaults={size:19,face:'serif',width:'standard',theme:'auto'};
    for(const s of settings.querySelectorAll('select'))s.value=String(prefs[s.name]||defaults[s.name]);
  }
  applySettings();dark.addEventListener('change',applySettings);
  // Positions refer to the original blocks, even when the figure moves next to its explanation.
  function indexBlocks(el) {
    [...el.children].forEach((b,i)=>{b.dataset.place='u'+i;});
    const body=el.querySelector('.mb-body');
    if(body)[...body.children].forEach((b,i)=>{b.dataset.place='p'+i;});
  }
  let positionedBlocks=[];
  // Keep a figure beside the sentence that introduces it while retaining all of the original prose and inline markup.
  function placeFigure(paragraph,figure){
    if(!paragraph || !figure)return;
    const text=paragraph.textContent;
    const stops=[...text.matchAll(/[.!?](?=\s+[А-ЯЁ«])/g)].map(m=>m.index+1);
    const cut=stops.filter(n=>n<=165).pop() || stops[0];
    if(text.length>245 && cut && cut<260 && text.length-cut>70){
      const nodes=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
      let node,offset=cut;
      while((node=nodes.nextNode())){
        if(offset>node.length){offset-=node.length;continue;}
        const range=document.createRange();range.selectNodeContents(paragraph);range.setStart(node,offset);
        const tail=element('p');tail.append(range.extractContents());
        tail.dataset.place=paragraph.dataset.place+'-tail';paragraph.dataset.splitAt=String(cut/text.length);
        paragraph.after(tail);break;
      }
    }
    paragraph.after(figure);
  }
  function markBlocks(section){
    positionedBlocks=[...section.querySelectorAll('[data-place]')].filter(b=>b.getClientRects().length);
  }
  function currentPlace(){
    if(!activePage)return null;
    const top=bar.getBoundingClientRect().bottom+12, r=activePage.getBoundingClientRect();
    const bounded=n=>Math.min(1,Math.max(0,n));
    let nearest=null, distance=-Infinity;
    for(const block of positionedBlocks){
      const box=block.getBoundingClientRect();
      if(box.height && box.top<=top+(block.tagName==='P'?10:2) && box.top>=distance){nearest=block;distance=box.top;}
    }
    const rect=nearest?.getBoundingClientRect();
    return {id:route,label:byId.get(route)?.title||activePage.querySelector('h1,h2')?.textContent||book.title,
      fraction:bounded((top-r.top)/Math.max(1,r.height)),block:nearest?.dataset.place||'',within:rect?bounded((top-rect.top)/rect.height):0,
      excerpt:(nearest?.querySelector('figcaption')?.textContent || nearest?.textContent || '').trim().replace(/\s+/g,' ').slice(0,75)};
  }
  function align(place){
    if(!place || !activePage || place.id!==route)return;
    const blocks=positionedBlocks;
    // Old editions used the direct child's numeric index.
    let block=blocks.find(b=>b.dataset.place===(place.block || ('u'+place.anchor)));
    let within=place.within;
    if(!place.block && block?.dataset.splitAt){
      const split=Number(block.dataset.splitAt);
      if(within>split){
        block=blocks.find(b=>b.dataset.place===block.dataset.place+'-tail')||block;within=(within-split)/(1-split);
      }else within=within/split;
    }
    if(!block && !place.fraction){window.scrollTo({top:0,behavior:'instant'});return;}
    const target=block||activePage, fraction=Number(block?within:place.fraction)||0, rect=target.getBoundingClientRect();
    window.scrollBy({top:rect.top+rect.height*Math.min(1,Math.max(0,fraction))-bar.offsetHeight-12,behavior:'instant'});
  }
  function restore(place){
    releaseRestore();align(place);
    let live=true;
    const afterLayout=()=>requestAnimationFrame(()=>{if(live && place.id===route)align(place);});
    const observer=new ResizeObserver(afterLayout);
    observer.observe(activePage);
    window.addEventListener('load',afterLayout,{once:true});
    document.fonts?.ready.then(afterLayout);
    afterLayout();
    const events=['wheel','touchstart','pointerdown','keydown'];
    const stop=()=>{live=false;observer.disconnect();window.removeEventListener('load',afterLayout);clearTimeout(timeout);events.forEach(e=>window.removeEventListener(e,stop,true));releaseRestore=()=>{};};
    const timeout=setTimeout(stop,2100);
    events.forEach(e=>window.addEventListener(e,stop,{capture:true,passive:true}));
    releaseRestore=stop;
  }
  let markCache=storedMarks();
  function nearby(place){return markCache.find(m=>m.id===place?.id && m.block===place?.block);}
  function meter(){
    tick=0;
    if(!activePage)return;
    const place=currentPlace(),distance=activePage.getBoundingClientRect().bottom;
    progress.value=distance<=innerHeight+2?1:place.fraction;
    const on=Boolean(nearby(place));markButton.setAttribute('aria-pressed',String(on));
    const label=on?'Снять закладку':'Поставить закладку';
    markButton.setAttribute('aria-label',label);markButton.title=label;
  }
  function rememberEntry(place){
    if(!place)return;
    try{history.replaceState({...history.state,readingPlace:place},'');}catch{}
  }
  function persist(){
    if(!activePage || drawer.open || settings.open || lightbox.open)return;
    const place=currentPlace();if(place){write(key,place);rememberEntry(place);}
  }
  function schedule(){if(!tick)tick=requestAnimationFrame(meter);clearTimeout(saveTimer);saveTimer=setTimeout(persist,320);}
  function outlineLink(item,mark){
    const a=element('a','desk-topic',item.title);a.href='#'+encodeURIComponent(item.id);
    if(mark){
      const target=new URL(a.href);target.searchParams.set('mark',mark.token);a.href=target.href;a.dataset.mark=mark.token;
    }
    if(item.id===route)a.setAttribute('aria-current','location');
    return a;
  }
  function drawOutline(){
    const term=field.value.trim();list.replaceChildren();
    pane.querySelector('[data-view=marks] span').textContent=markCache.length?' '+markCache.length:'';
    for(const b of pane.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===paneView));
    if(paneView==='marks'){
      const subset=markCache.filter(m=>!term || (m.label+' '+m.excerpt).toLocaleLowerCase('ru').includes(term.toLocaleLowerCase('ru')));
      if(!subset.length)list.append(element('p','desk-empty',term?'Совпадений нет.':'Поставьте закладку у нужного абзаца кнопкой в верхней панели.'));
      for(const m of subset){
        const a=outlineLink({id:m.id,title:m.label},m);
        if(m.excerpt)a.append(element('small','',m.excerpt+'…'));
        list.append(a);
      }
      return;
    }
    if(term){
      const found=search(topics,term);
      if(!found.length)list.append(element('p','desk-empty','Совпадений нет. Попробуйте другой термин.'));
      for(const item of found){
        const a=outlineLink(item);a.append(element('small','',excerpt(item,term) || item.group));list.append(a);
      }
      return;
    }
    for(const group of book.groups){
      const d=element('details','desk-group');
      const summary=element('summary','',group.name);
      d.open=openGroups.has(group.name);
      d.ontoggle=()=>{if(!d.isConnected)return;if(d.open)openGroups.add(group.name);else openGroups.delete(group.name);};
      d.append(summary);
      if(group.landing)d.append(outlineLink({id:group.landing,title:'Обзор главы'}));
      for(const [id,title] of group.topics)d.append(outlineLink({id,title}));
      list.append(d);
    }
  }
  function movePane(){
    if(wide.matches){if(drawer.open)drawer.close();rail.append(pane);}
    else{drawer.append(pane);}
    root.classList.toggle('desk-with-rail',wide.matches&&!railOff);
    tocButton.setAttribute('aria-expanded',String(wide.matches?!railOff:drawer.open));
  }
  function revealCurrent(){const a=list.querySelector('[aria-current]');if(a && a.offsetParent)list.scrollTop+=a.getBoundingClientRect().top-list.getBoundingClientRect().top-list.clientHeight*.32;}
  function togglePane(){
    if(wide.matches){railOff=!railOff;movePane();if(!railOff)revealCurrent();else schedule();return;}
    drawer.showModal();tocButton.setAttribute('aria-expanded','true');
    pane.querySelector('[data-dismiss]').focus({preventScroll:true});revealCurrent();
  }
  wide.addEventListener('change',movePane);movePane();
  drawer.addEventListener('close',()=>tocButton.setAttribute('aria-expanded',String(wide.matches&&!railOff)));
  field.oninput=()=>{drawOutline();list.scrollTop=0;};
  pane.addEventListener('click',e=>{
    const tab=e.target.closest('[data-view]');
    if(tab){paneView=tab.dataset.view;field.value='';drawOutline();list.scrollTop=0;return;}
    if(e.target.closest('[data-dismiss]')){if(drawer.open)drawer.close();else togglePane();}
  });
  function navTo(id,place,focus=true,push=true){
    if(push && activePage)rememberEntry(currentPlace());
    releaseRestore();
    if(drawer.open)drawer.close();
    if(!micro){
      const target=document.getElementById(id), section=target?.closest('.unit');
      const actual=section?.id || (id==='start' && book.groups.some(g=>g.topics.some(t=>t[0]==='start'))?id:book.first);
      if(push && fragment()!==id)history.pushState(null,'','#'+encodeURIComponent(id));
      showPage(actual);
      if(place)restore(place);
      else if(target && section && target!==section)target.scrollIntoView({block:'start',behavior:'instant'});
      else window.scrollTo({top:0,behavior:'instant'});
    }else{
      if(route!==id)MicroBookPage.open(id,{hash:push,focus:false});
      else if(push && fragment()!==id)history.pushState(null,'','#'+encodeURIComponent(id));
      if(place)restore(place);else window.scrollTo({top:0,behavior:'instant'});
    }
    if(focus)activePage?.querySelector('[data-desk-heading]')?.focus({preventScroll:true});
    schedule();
  }
  function fragment(){try{return decodeURIComponent(location.hash.slice(1));}catch{return '';}}
  pane.addEventListener('click',e=>{
    const a=e.target.closest('a.desk-topic');
    if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();const id=decodeURIComponent(a.hash.slice(1));
    field.value='';paneView='all';navTo(id,markCache.find(m=>m.token===a.dataset.mark));drawOutline();revealCurrent();
  });
  function toggleMark(){
    const place=currentPlace();if(!place)return;
    markCache=storedMarks();const hit=nearby(place);
    const next=hit?markCache.filter(m=>m.token!==hit.token):[{...place,token:crypto.randomUUID()},...markCache];
    if(!write('marks.'+key,next)){announce('Не удалось сохранить закладку в браузере');return;}
    markCache=next;drawOutline();meter();announce(hit?'Закладка снята':'Закладка сохранена');
  }
  window.addEventListener('storage',e=>{if(e.key==='phagi.reading.marks.'+key){markCache=storedMarks();drawOutline();meter();}});
  bar.addEventListener('click',e=>{
    if(e.target.closest('[data-panel=toc]'))togglePane();
    if(e.target.closest('[data-action=mark]'))toggleMark();
    if(e.target.closest('[data-panel=type]')){
      settingsPlace=currentPlace();settings.showModal();
    }
  });
  settings.addEventListener('change',e=>{
    const s=e.target;if(s.tagName!=='SELECT')return;
    prefs[s.name]=s.name==='size'?Number(s.value):s.value;write('settings',prefs);applySettings();align(settingsPlace);
  });
  settings.addEventListener('close',()=>{const place=settingsPlace;settingsPlace=null;requestAnimationFrame(()=>{align(place);schedule();});});
  for(const dialog of [drawer,settings,lightbox]){
    dialog.addEventListener('click',e=>{
      if(e.target.closest('[data-dismiss]')){dialog.close();return;}
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
    });
  }

  function setZoom(enlarged) {
    const img=lightbox.querySelector('img');
    img.style.width=enlarged?Math.max(zoomWidth,lightbox.clientWidth*1.55,760)+'px':'';
    lightbox.classList.toggle('enlarged',enlarged);
    lightbox.querySelector('[data-fit]').setAttribute('aria-pressed',String(!enlarged));
    lightbox.querySelector('[data-enlarge]').setAttribute('aria-pressed',String(enlarged));
    if(!enlarged)lightbox.querySelector('.desk-image-pan').scrollTo(0,0);
  }
  lightbox.querySelector('[data-fit]').onclick=()=>setZoom(false);
  lightbox.querySelector('[data-enlarge]').onclick=()=>setZoom(true);
  lightbox.addEventListener('close',()=>{if(sharedImage)URL.revokeObjectURL(sharedImage);sharedImage='';});
  function openFigure(figure){
    const original=figure.querySelector('img'),svg=figure.querySelector('.mb-diagram-scroll svg');
    if(!original && !svg)return;
    const img=lightbox.querySelector('img');
    if(svg){
      const copy=svg.cloneNode(true);copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
      sharedImage=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    }
    zoomWidth=original?.naturalWidth || svg?.viewBox.baseVal.width || 1000;
    img.src=original?.currentSrc || original?.src || sharedImage;
    img.alt=original?.alt || svg?.getAttribute('aria-label') || '';
    lightbox.querySelector('strong').textContent=figure.querySelector('h2')?.textContent || 'Рисунок';
    lightbox.querySelector('p').textContent=figure.querySelector('figcaption')?.textContent || '';
    lightbox.showModal();setZoom(false);
  }
  function enhanceFigures(el){
    el.querySelectorAll('.plate,.mb-diagram').forEach(figure=>{
      if(figure.querySelector('.desk-zoom'))return;
      const zoom=element('button','desk-zoom');
      zoom.type='button';zoom.innerHTML=icon('zoom')+'<span>Увеличить</span>';zoom.onclick=()=>openFigure(figure);
      const caption=figure.querySelector('figcaption');
      if(caption)caption.before(zoom);else figure.append(zoom);
    });
  }
  document.addEventListener('click',e=>{
    const a=e.target.closest('.plate .zoom');
    if(a && e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();e.stopPropagation();openFigure(a.closest('figure'));}
  },true);

  const localNav=element('details','desk-local');
  localNav.innerHTML='<summary>В этом разделе</summary><nav aria-label="Рисунки и задания раздела"></nav>';
  function shortcuts(el,heading){
    const choices=[
      ['.plate,.mb-diagram','Схема'],['.widget,.mb-model','Модель'],['.motion,.mb-video','Видео'],
      ['.mb-inline-atlas,.mb-body~.mb-atlas','Микрофотографии'],['.table-scroll','Таблица'],
      ['.check,.mb-check','Проверить себя'],['.cite,.mb-references','Источники']
    ];
    const points=choices.map(([sel,label])=>[el.querySelector(sel),label]).filter(([n])=>n);
    const nav=localNav.querySelector('nav');nav.replaceChildren();
    for(const [n,label] of points){
      const b=element('button','',label);b.type='button';
      b.onclick=()=>{if(!matchMedia('(min-width:1380px)').matches)localNav.open=false;n.scrollIntoView({block:'start',behavior:'instant'});if(n.tagName==='DETAILS')n.open=true;n.tabIndex=-1;n.focus({preventScroll:true});};
      nav.append(b);
    }
    if(!points.length){localNav.remove();return;}
    localNav.open=matchMedia('(min-width:1380px)').matches;heading.after(localNav);
  }
  matchMedia('(min-width:1380px)').addEventListener('change',e=>{localNav.open=e.matches;});

  function pager(section){
    const ordered=[...sections.keys()], i=ordered.indexOf(section.id);
    const nav=element('nav','desk-turn');nav.setAttribute('aria-label','Листать разделы');
    for(const [id,word] of [[ordered[i-1],'← Назад'],[ordered[i+1],'Дальше →']]){
      if(!id)continue;const a=element('a');a.href='#'+id;a.rel=id===ordered[i+1]?'next':'prev';
      a.append(element('small','',word),element('strong','',byId.get(id).title));nav.append(a);
    }
    section.append(nav);
  }
  let overview;
  if(!micro){
    const article=document.querySelector('#book .layout article'), player=document.querySelector('.sequence-player');
    overview=element('section','desk-overview');overview.id='start';overview.hidden=true;
    overview.append(element('div','desk-kicker',book.title),element('h1','','Анимация репликации'),player);
    if(player)article.prepend(overview);
    for(const [id,section] of sections){
      indexBlocks(section);const heading=section.querySelector('h2'), intro=section.querySelector(':scope > p');
      const figure=section.querySelector(':scope > figure.plate');
      placeFigure(intro,figure);
      let marker=section.querySelector('.unit-marker');
      if(!marker){marker=element('div','unit-marker');heading.before(marker);}
      const n=[...sections.keys()].indexOf(id)+1;
      marker.textContent=(id==='sources'?'':('§ '+n+'  /  '))+byId.get(id).group;
      if(intro && id!=='sources')intro.classList.add('desk-lead');
      heading.setAttribute('role','heading');heading.setAttribute('aria-level','1');
      enhanceFigures(section);pager(section);
      const item=byId.get(id);item.body=section.textContent;
    }
  }else{
    for(const s of [...MICROBOOK.primer,...MICROBOOK.chapters.flatMap(c=>c.sections)]){
      if(byId.has(s.id))byId.get(s.id).body=s.body.replace(/<[^>]+>/g,' ');
    }
  }
  function showPage(id){
    if(micro && route===id && activePage?.querySelector('[data-desk-heading]'))return;
    localNav.remove();
    if(!micro){
      if(route && id!==route)window.ReplicationBook?.pause();
      for(const [sectionId,section] of sections)section.hidden=sectionId!==id;
      overview.hidden=id!=='start';
      if(id==='start')window.ReplicationBook?.showSequence();
      activePage=id==='start'?overview:sections.get(id);
    }else{
      activePage=micro.querySelector('.mb-main');indexBlocks(activePage);
      const prose=activePage.querySelector('.mb-body'),diagram=activePage.querySelector('.mb-diagram');
      const paragraph=prose?.querySelector(':scope>p');
      placeFigure(paragraph,diagram);
      const meta=activePage.querySelector('.mb-article-meta'), kicker=activePage.querySelector(':scope>.mb-eyebrow');
      if(meta && kicker){
        const minutes=meta.querySelector('span')?.textContent;
        if(minutes)kicker.append(document.createTextNode('  /  '+minutes.replace('~','≈ ')));
        activePage.querySelector('.mb-references')?.before(meta);
      }
      enhanceFigures(activePage);
      const next=activePage.querySelector('.mb-reading-nav');
      if(next)for(const b of next.querySelectorAll('[data-open]')){
        const item=byId.get(b.dataset.open);
        if(item){
          const forward=b.classList.contains('mb-primary');b.replaceChildren(element('small','',forward?'Дальше →':'← Назад'),element('strong','',item.title));
        }
      }
    }
    route=id;
    if(!activePage)return;
    const h=activePage.querySelector(micro?'h1':'h2,h1');
    if(h){
      h.tabIndex=-1;h.dataset.deskHeading='';
      if(!micro || activePage.querySelector('.mb-body'))shortcuts(activePage,h);
      document.title=(byId.get(id)?.title||h.textContent)+' · '+book.title+' · Биовиз';
    }
    const group=book.groups.find(g=>g.landing===id || g.topics.some(([x])=>x===id));
    if(group)openGroups.add(group.name);
    drawOutline();markBlocks(activePage);requestAnimationFrame(revealCurrent);schedule();
  }
  if(micro){
    micro.addEventListener('click',e=>{if(e.target.closest('button[data-open]'))rememberEntry(currentPlace());},true);
    document.addEventListener('micro-route',()=>{releaseRestore();showPage(micro.dataset.route);});
    showPage(micro.dataset.route);
  }else{
    document.getElementById('book').addEventListener('click',e=>{
      const a=e.target.closest('a[href^="#"]');
      if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
      e.preventDefault();navTo(decodeURIComponent(a.hash.slice(1)));
    });
  }
  window.addEventListener('hashchange',()=>{
    const id=fragment()||book.first, entry=history.state?.readingPlace;
    const section=micro?id:document.getElementById(id)?.closest('.unit')?.id||id;
    navTo(id,entry?.id===section?entry:null,true,false);
  });
  const hash=fragment(), requestedMark=markCache.find(m=>m.token===url.searchParams.get('mark')&&m.id===hash);
  const navigationType=performance.getEntriesByType('navigation')[0]?.type;
  const restorable=typeof original?.id==='string' && (byId.has(original.id) || (micro && original.id.startsWith('recall:')));
  const historyPlace=navigationType==='back_forward'?history.state?.readingPlace:null;
  const hashSection=micro?hash:document.getElementById(hash)?.closest('.unit')?.id||hash;
  const place=requestedMark || (historyPlace && historyPlace.id===hashSection?historyPlace:null)
    || ((!hash || (navigationType==='reload' && original?.id===hashSection)) && restorable ? original:null);
  navTo(place?.id||hash||book.first,place,false,false);
  if(requestedMark || !hash){
    url.searchParams.delete('mark');url.hash=route;history.replaceState(history.state,'',url);
  }
  requestAnimationFrame(revealCurrent);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  window.addEventListener('pagehide',persist);document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
  root.dataset.readingReady='true';root.classList.remove('desk-opening');
  meter();
})();
