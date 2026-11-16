/* Both native shells provide this narrow bridge. The web app itself never installs files. */
(()=>{
 const bridge=window.ZovReminder||window.ZovDesktop;if(!bridge||!window.B)return;
 let state={status:'idle',current:''};
 const send=op=>bridge.postMessage(JSON.stringify({op}));
 window.zovUpdateStatus=next=>{state=next;if(location.hash.startsWith('#/settings'))B.render();};
 B.nativeUpdates={settings:()=>`<section class="card"><h2>Обновление приложения</h2><p class="muted">${B.esc(state.message||'Проверь наличие новой версии приложения.')}</p>${state.current?`<p class="hint">Установлена ${B.esc(state.current)}</p>`:''}<div class="row wrap"><button class="btn" data-act="updateCheck" ${state.status==='busy'?'disabled':''}>Проверить обновления</button>${state.status==='available'?'<button class="btn primary" data-act="updateInstall">Скачать и установить</button>':''}</div><p class="hint">Обновление сохраняет записи. Android запросит подтверждение системной установки; на Mac приложение перезапустится.</p></section>`};
 B.acts.updateCheck=()=>send('updateCheck');B.acts.updateInstall=()=>send('updateInstall');send('updateStatus');
})();
