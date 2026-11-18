/* Only the Phagi edition needs the shared reading controls. Leave widgets and standalone books light. */
(() => {
  const params=new URL(location.href).searchParams;
  if(params.get('from')!=='phagi' || params.has('widget'))return;
  const base=new URL('.',document.currentScript.src);
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
  function fallback(){initial.remove();window.ReplicationBook?.showSequence();}
  for(const path of ['type/type.css?v=1','reading-desk.css?v=3']){
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(path,base);document.head.append(link);
  }
  const scripts=['book-index.js?v=1','book-navigation.js?v=1','reading-desk.js?v=3'].map(path=>new URL(path,base).href);
  for(const src of scripts){
    const link=document.createElement('link');link.rel='preload';link.as='script';link.href=src;document.head.append(link);
  }
  // Native readers use deferred scripts and must finish mounting before their shared shell.
  document.addEventListener('DOMContentLoaded',()=>{
    for(const src of scripts){
      const script=document.createElement('script');script.async=false;script.src=src;script.onerror=fallback;
      if(src===scripts.at(-1))script.onload=()=>{initial.remove();if(!document.documentElement.classList.contains('reading-desk'))fallback();};
      document.head.append(script);
    }
  },{once:true});
})();
