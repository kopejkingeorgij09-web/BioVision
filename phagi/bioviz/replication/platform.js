/* Фаги → Биовиз → Процессы. Текст и модели общие с отдельным изданием конспекта. */
(() => {
  const base = new URL('.', document.currentScript.src);
  const section = BVHOST.root.querySelector('#m-replication');
  const element = section.querySelector('[data-replication-book]');
  const root = element.attachShadow({mode:'open'});
  const sheet = document.createElement('link');
  sheet.rel='stylesheet'; sheet.href=new URL('reader.css?v=2',base);
  const content = document.createElement('div');
  content.className='platform-reading';
  root.append(sheet,content);
  let loading, reader;
  async function load() {
    content.textContent='Загружается конспект…';
    if(!window.ReplicationReader) await bvScript(new URL('reader.js?v=2',base).href);
    const response = await fetch(new URL('index.html?v=2',base));
    if(!response.ok) throw new Error(String(response.status));
    const template = document.createElement('template');
    template.innerHTML=await response.text();
    const parts=['.sequence-player','.layout','#zoom-dialog'].map(selector=>template.content.querySelector(selector));
    for(const part of parts) {
      for(const node of part.querySelectorAll('[src],[poster],a[href]')) {
        for(const key of ['src','poster','href']) {
          const value=node.getAttribute(key);
          if(value && !value.startsWith('#')) node.setAttribute(key,new URL(value,base).href);
        }
      }
    }
    content.replaceChildren(...parts);
    reader=window.ReplicationReader.mount(root,true);
    if(section.hidden||!BVHOST.on) reader.pause();
  }
  function show(){
    if(reader||loading) return;
    loading=load().catch(()=>{
      const retry=document.createElement('button');
      retry.type='button';retry.textContent='Загрузить конспект ещё раз';retry.onclick=show;
      content.replaceChildren(retry);
    }).finally(()=>{loading=null;});
  }
  BV.hooks.replication={show,hide(){reader?.pause();}};
  if(!section.hidden && BVHOST.on) show();
})();
