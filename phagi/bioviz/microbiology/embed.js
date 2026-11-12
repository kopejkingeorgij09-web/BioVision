(function(){
'use strict';
const base=new URL('.',document.currentScript.src),R=window.BVHOST?.root;
if(!R||!window.BV)return;
const load=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(src+'?v=20261112',base);s.async=false;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
window.MicroBookReady=(async()=>{
for(const f of ['content.js','enrichment.js','sources.js','olympiad.js','models.js','diagrams.js','reader.js'])await load(f);
const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('style.css?v=20261112',base);R.appendChild(link);
const style=document.createElement('style');style.textContent='.mb-embed-controls{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}.mb-embed-controls button{font:inherit;min-height:44px;border:1px solid var(--line);border-radius:9px;padding:8px 14px;background:var(--card);color:var(--text);cursor:pointer}.mb-embed-controls button[aria-pressed=true]{background:var(--ink);color:var(--card)}.mb-legacy[hidden],#microbook[hidden]{display:none!important}';R.appendChild(style);
const section=R.querySelector('#m-prok');if(!section)return;
const legacy=document.createElement('div');legacy.className='mb-legacy';while(section.firstChild)legacy.appendChild(section.firstChild);section.appendChild(legacy);
const bar=document.createElement('div');bar.className='mb-embed-controls';bar.innerHTML='<button data-mb-mode="book" aria-pressed="true">Учебник · занятия 1–4</button><button data-mb-mode="legacy" aria-pressed="false">Прежние модели архитектуры</button>';section.prepend(bar);
const book=document.createElement('div');book.id='microbook';bar.after(book);
const api=window.MicroReader.mount(book,{embedded:true,theme:window.BVHOST.host.getAttribute('data-theme')||'light'});
const original=BV.hooks.prok;let mode='book';
const oldNav=R.querySelector('.nav-item[data-go="prok"]'),nav=document.createElement('button');nav.className='nav-item';nav.textContent='Микробиология · учебник';if(oldNav)oldNav.before(nav);
function apply(){legacy.hidden=mode!=='legacy';book.hidden=mode!=='book';bar.querySelectorAll('[data-mb-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mbMode===mode)));if(!section.hidden){nav.toggleAttribute('aria-current',mode==='book');if(mode==='book'){nav.setAttribute('aria-current','page');oldNav?.removeAttribute('aria-current');const label=R.querySelector('#fbCur');if(label)label.textContent='Микробиология · учебник';}else{oldNav?.setAttribute('aria-current','page');const label=R.querySelector('#fbCur');if(label)label.textContent='Архитектура прокариот';}}}
function choose(next){mode=next;if(mode==='book')original?.hide?.();else original?.show?.();apply();}
BV.hooks.prok={show(){original?.show?.();if(mode==='book')original?.hide?.();apply();},hide(){original?.hide?.();nav.removeAttribute('aria-current');}};
bar.addEventListener('click',e=>{const b=e.target.closest('[data-mb-mode]');if(b)choose(b.dataset.mbMode);});
nav.addEventListener('click',()=>{BV.go('prok');choose('book');R.querySelector('.side')?.classList.remove('open');R.querySelector('.fb-topics')?.setAttribute('aria-expanded','false');BVHOST.top?.();});
oldNav?.addEventListener('click',()=>choose('legacy'));
new MutationObserver(()=>api.setTheme(BVHOST.host.getAttribute('data-theme'))).observe(BVHOST.host,{attributes:true,attributeFilter:['data-theme']});
choose('book');
return api;
})().catch(e=>{console.warn('Учебник по микробиологии не загрузился',e);return null;});
})();
