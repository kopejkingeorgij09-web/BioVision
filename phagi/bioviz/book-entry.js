/* Only the Phagi edition needs the shared reading controls. Leave widgets and standalone books light. */
(() => {
  const params=new URL(location.href).searchParams;
  if(params.get('from')!=='phagi' || params.has('widget'))return;
  const base=new URL('.',document.currentScript.src);
  const page=document.documentElement;
  const inClassroom=params.get('embed')==='classroom' && window.frameElement?.id==='bv-reader';
  if(inClassroom)page.classList.add('in-classroom');
  window.PhagiChapterLink=fragment=>{
    if(inClassroom){
      history.replaceState(null,'',fragment);
      parent.PhagiBioReader.chapter(window,fragment);
    }else history.pushState(null,'',fragment);
  };
  window.PhagiBookAppearance=prefs=>{
    page.style.setProperty('--desk-size',([17,19,21,23].includes(prefs.size)?prefs.size:19)+'px');
    page.dataset.deskFace=prefs.face==='sans'?'sans':'serif';
    page.dataset.deskWidth=prefs.width==='wide'?'wide':'standard';
    const hostTheme=inClassroom?parent.document.documentElement.dataset.eff:null;
    const theme=['light','dark'].includes(prefs.theme)?prefs.theme:hostTheme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
    page.dataset.deskTheme=theme;
    if(inClassroom){
      const colors=getComputedStyle(parent.document.documentElement);
      const palette={'--desk-bg':'--card','--desk-surface':'--card','--desk-ink':'--text','--desk-line':'--line','--desk-muted':'--muted','--desk-accent':'--ink','--desk-tint':'--soft','--desk-rail':'--bg','--desk-focus':'--focus'};
      for(const [token,host] of Object.entries(palette)){
        if(!prefs.theme||prefs.theme==='auto')page.style.setProperty(token,colors.getPropertyValue(host));
        else page.style.removeProperty(token);
      }
    }
    return theme;
  };
  let prefs={};try{prefs=JSON.parse(localStorage.getItem('phagi.reading.settings'))||{};}catch{}
  window.PhagiBookAppearance(prefs);
  page.classList.add('desk-opening','reading-desk');
  page.classList.toggle('desk-with-rail',matchMedia('(min-width:1000px)').matches);
  // Prevent the browser from fetching a different chapter's plates on the first layout.
  const initial=document.createElement('style');
  if(location.pathname.includes('/replication/')){
    let id=location.hash.slice(1);
    if(!id){try{id=JSON.parse(localStorage.getItem('phagi.reading.replication'))?.id;}catch{}}
    if(!id || !/^[a-z][a-z0-9-]*$/.test(id))id='evidence';
    if(/^source-\d+$/.test(id))id='sources';
    initial.textContent='.hero,.bar,.contents,#book>.sequence-player,#book .unit:not(#'+id+'){display:none}';
    document.head.append(initial);
  }
  function fallback(){
    initial.remove();page.classList.remove('desk-opening','reading-desk','desk-with-rail');
    window.ReplicationBook?.showSequence();
    if(window.MicroBookPage)MicroBookPage.open(document.getElementById('microbook').dataset.route,{hash:false,focus:false});
  }
  for(const path of ['type/type.css?v=1','reading-desk.css?v=5']){
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(path,base);document.head.append(link);
  }
  const scripts=['book-index.js?v=3','book-navigation.js?v=1','reading-desk.js?v=6'].map(path=>new URL(path,base).href);
  for(const src of scripts){
    const link=document.createElement('link');link.rel='preload';link.as='script';link.href=src;document.head.append(link);
  }
  // Native readers use deferred scripts and must finish mounting before their shared shell.
  document.addEventListener('DOMContentLoaded',()=>{
    for(const src of scripts){
      const script=document.createElement('script');script.async=false;script.src=src;script.onerror=fallback;
      if(src===scripts.at(-1))script.onload=()=>{initial.remove();if(!page.dataset.readingReady)fallback();};
      document.head.append(script);
    }
  },{once:true});
})();
