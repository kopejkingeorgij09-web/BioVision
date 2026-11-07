/* Android WebView передаёт файлы календаря и резервные копии системному диалогу. */
(function(){
if (!window.ZovAndroid) return;
let sending = false;
const send = packet => window.ZovAndroid.postMessage(JSON.stringify(packet));
async function download(anchor){
  if (sending) return B.toast('Подожди, пока откроется сохранение файла');
  sending = true;
  try {
    const blob = await (await fetch(anchor.href)).blob();
    if (blob.size > 6 * 1024 * 1024) throw Error('Файл больше 6 МБ');
    const encoded = await new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(Error('Не удалось прочитать файл'));
      reader.readAsDataURL(blob);
    });
    send({op:'start',name:anchor.download||'zov-lesa',mime:(blob.type||'application/octet-stream').split(';')[0]});
    for (let i=0;i<encoded.length;i+=64000) send({op:'chunk',data:encoded.slice(i,i+64000)});
    send({op:'end'});
  } catch (error) { B.toast(B.esc(error.message||'Не удалось сохранить файл')); }
  finally { sending=false; }
}
const ownFile = anchor => anchor?.hasAttribute('download') && /^(blob|data):/.test(anchor.href);
const click = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function(){
  if (ownFile(this)) download(this); else click.call(this);
};
document.addEventListener('click',event => {
  const a = event.target.closest('a[download]');
  if (ownFile(a)){ event.preventDefault(); download(a); }
},true);
})();
