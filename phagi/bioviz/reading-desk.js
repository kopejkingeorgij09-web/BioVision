/* Shared controls for full-page books. Explicit chapter links take precedence over a saved place. */
(() => {
  const parameters=new URLSearchParams(location.search);
  if(parameters.has('widget')||parameters.get('from')!=='phagi')return;
  const micro = document.getElementById('microbook');
  if (micro && !window.MicroBookPage) return;
  if ('scrollRestoration' in history) history.scrollRestoration='manual';
  const key = micro ? 'microbiology' : 'replication';
  const read = name => { try {return JSON.parse(localStorage.getItem('phagi.reading.' + name));} catch {return null;} };
  const write = (name,value) => {try {localStorage.setItem('phagi.reading.' + name,JSON.stringify(value));} catch {}};
  const prefs = read('settings') || {};
  const page = document.documentElement;
  page.classList.add('reading-desk');
  const bar = document.createElement('header');
  bar.className = 'desk-bar';
  bar.innerHTML = '<a href="../../?bio=library" aria-label="К книгам в Биовизе">← Биовиз</a><span class="desk-current"></span><button type="button" data-panel="toc">Оглавление</button><button type="button" data-panel="type" aria-label="Настройки чтения">Аа</button><progress max="1" value="0" aria-label="Положение в разделе"></progress>';
  document.body.prepend(bar);
  const dlg = document.createElement('dialog');
  dlg.className='desk-dialog';dlg.setAttribute('aria-labelledby','desk-title');
  dlg.innerHTML='<header><h2 id="desk-title"></h2><button type="button" aria-label="Закрыть">×</button></header><div class="desk-content"></div>';
  document.body.append(dlg);
  const content=dlg.querySelector('.desk-content');
  const units=[...document.querySelectorAll('.unit[id]')];
  const toc=micro ? [
    ['home','Обзор учебника'], ...MICROBOOK.primer.map(x=>[x.id,x.title]),
    ...MICROBOOK.chapters.flatMap(c=>[['chapter:'+c.id,c.title],...c.sections.map(s=>[s.id,s.title])]),
    ['guide','Как работать с учебником'],['atlas','Атлас микрофотографий'],['glossary','Словарь'],['recall','Вопросы для повторения'],['sources','Источники']
  ] : [['start','Обзор и анимация'],...units.map(el=>[el.id,el.querySelector('h2')?.textContent || el.id])];
  const labels=new Map(toc);
  const searchText=new Map();
  if(micro){
    const sections=[...MICROBOOK.primer,...MICROBOOK.chapters.flatMap(c=>c.sections)];
    for(const s of sections)searchText.set(s.id,(s.body||'').replace(/<[^>]*>/g,' ').toLocaleLowerCase('ru'));
  }else for(const u of units)searchText.set(u.id,u.textContent.toLocaleLowerCase('ru'));
  let settingsPlace=null;
  const title=bar.querySelector('.desk-current'),progress=bar.querySelector('progress');
  function apply(){
    page.style.setProperty('--desk-size',([17,19,21,23].includes(prefs.size)?prefs.size:19)+'px');
    page.dataset.deskFace=prefs.face==='sans'?'sans':'serif';
    page.dataset.deskWidth=prefs.width==='wide'?'wide':'standard';
  }
  const scheme=matchMedia('(prefers-color-scheme:dark)');
  function palette(){
    const theme=['dark','light'].includes(prefs.theme)?prefs.theme:(scheme.matches?'dark':'light');
    page.dataset.deskTheme=theme;
    if(micro)window.MicroBookPage.setTheme(theme);
  }
  scheme.addEventListener('change',palette);palette();apply();
  if(micro){
    const summary=micro.querySelector('.mb-settings summary');
    if(summary){summary.textContent='Ещё';summary.setAttribute('aria-label','Дополнительные инструменты учебника');}
  }
  function go(id){
    if(!labels.has(id))return;
    if(micro)window.MicroBookPage.open(id);
    else if(id==='start')window.scrollTo(0,0);
    else document.getElementById(id)?.scrollIntoView({block:'start'});
    schedule();
  }
  function outline(){
    content.innerHTML='<label class="desk-search">Найти раздел<input type="search" placeholder="Название или термин" autocomplete="off"></label><div class="desk-list"></div>';
    const input=content.querySelector('input'),list=content.querySelector('.desk-list');
    const render=()=>{
      const term=input.value.trim().toLocaleLowerCase('ru');list.replaceChildren();
      const ordered=term?[...toc].sort((a,b)=>Number(b[1].toLocaleLowerCase('ru').includes(term))-Number(a[1].toLocaleLowerCase('ru').includes(term))):toc;
      for(const [id,label] of ordered){
        if(!label.toLocaleLowerCase('ru').includes(term) && !(term.length>=3 && searchText.get(id)?.includes(term)))continue;
        const button=document.createElement('button');button.type='button';button.textContent=label;
        if(id===current.id)button.setAttribute('aria-current','location');
        button.onclick=()=>{dlg.close();go(id);};list.append(button);
      }
      if(!list.childElementCount)list.textContent='Разделов с таким названием нет.';
    };
    input.oninput=render;render();
  }
  function typography(){
    content.innerHTML='<label>Размер букв<select name="size"><option value="17">17 · мелкий</option><option value="19">19 · обычный</option><option value="21">21 · крупный</option><option value="23">23 · очень крупный</option></select></label><label>Шрифт текста<select name="face"><option value="serif">С засечками</option><option value="sans">Без засечек</option></select></label><label>Ширина строки<select name="width"><option value="standard">Обычная</option><option value="wide">Широкая</option></select></label><label>Цвет страницы<select name="theme"><option value="auto">Как в системе</option><option value="light">Светлый</option><option value="dark">Тёмный</option></select></label>';
    for(const s of content.querySelectorAll('select')){
      s.value=String(prefs[s.name]||({size:19,face:'serif',width:'standard',theme:'auto'})[s.name]);
      s.onchange=()=>{const place=settingsPlace||current;prefs[s.name]=s.name==='size'?Number(s.value):s.value;write('settings',prefs);apply();palette();align(place);schedule();};
    }
  }
  bar.onclick=e=>{const b=e.target.closest('[data-panel]');if(!b)return;
    position();const nav=b.dataset.panel==='toc';settingsPlace=nav?null:{...current};dlg.querySelector('h2').textContent=nav?'Оглавление':'Настройки чтения';
    if(nav)outline();else typography();dlg.showModal();
  };
  dlg.addEventListener('close',()=>{
    if(settingsPlace){const place=settingsPlace;settingsPlace=null;requestAnimationFrame(()=>{align(place);schedule();});}
  });
  dlg.querySelector('header button').onclick=()=>dlg.close();
  dlg.onclick=e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dlg.close();}};
  let current={id:micro?'home':'start',fraction:0}, timer, frame;
  function position(){
    frame=0;
    const top=bar.offsetHeight+10;
    let id,el;
    if(micro){id=micro.dataset.route || 'home';el=micro.querySelector('.mb-main');}
    else{el=units.filter(e=>e.getBoundingClientRect().top<=top+24).pop();id=el?.id||'start';el=el||document.querySelector('.hero');}
    if(!el)return;
    const rect=el.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(top-rect.top)/Math.max(1,rect.height)));
    const blocks=[...el.children];
    const block=blocks.filter(n=>n.getBoundingClientRect().top<=top+2).pop();
    const anchor=block?blocks.indexOf(block):-1;
    const within=block?Math.max(0,Math.min(1,(top-block.getBoundingClientRect().top)/Math.max(1,block.offsetHeight))):0;
    current={id,fraction,anchor,within,label:labels.get(id)||''};progress.value=fraction;title.textContent=labels.get(id)||el.querySelector('h1,h2')?.textContent||'Микробиология';
  }
  function save(){if(dlg.open)return;position();write(key,current);}
  function schedule(){if(!frame)frame=requestAnimationFrame(position);clearTimeout(timer);timer=setTimeout(save,350);}
  if(!micro){
    units.forEach((unit,i)=>{
      const nav=document.createElement('nav');nav.className='desk-turn';nav.setAttribute('aria-label','Переходы по конспекту');
      for(const [next,word] of [[units[i-1],'Назад'],[units[i+1],'Дальше']]){
        if(!next)continue;
        const a=document.createElement('a');a.href='#'+next.id;
        const hint=document.createElement('small');hint.textContent=word;
        a.append(hint,document.createTextNode(labels.get(next.id)));nav.append(a);
      }
      unit.append(nav);
    });
  }
  function align(place){
    const el=micro?micro.querySelector('.mb-main'):document.getElementById(place.id);
    if(!el)return;
    const block=Number.isInteger(place.anchor)&&place.anchor>=0?el.children[place.anchor]:null;
    const target=block||el;
    const fraction=Number(block?place.within:place.fraction)||0;
    window.scrollBy({top:target.getBoundingClientRect().top+Math.max(0,Math.min(1,fraction))*target.offsetHeight-bar.offsetHeight-10,behavior:'instant'});
  }
  const old=read(key);
  const reloaded=performance.getEntriesByType('navigation')[0]?.type==='reload';
  const sameChapterOnReload=reloaded && old && (location.hash==='#'+encodeURIComponent(old.id)||location.hash==='#'+old.id);
  if((!location.hash||sameChapterOnReload) && old && labels.has(old.id) && old.id!=='start' && old.id!=='home'){
    go(old.id);align(old);
    // Fonts, image decoding and on-demand interactives can change preceding heights.
    const observer=new ResizeObserver(()=>align(old));
    observer.observe(document.body);
    const events=['wheel','touchstart','pointerdown','keydown'];
    function release(){observer.disconnect();for(const e of events)window.removeEventListener(e,release,true);}
    for(const e of events)window.addEventListener(e,release,{capture:true,passive:true});
    setTimeout(release,2200);
  }
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  document.addEventListener('micro-route',schedule);
  window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  position();
})();
