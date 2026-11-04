/* Зов леса: поиск по задачам, дневнику (разборы и мысли), книгам и цитатам, заметкам тренировок. */
(function(){
const {esc, icon} = B;
let q = '';

function hl(text, words){
  let s = esc(text);
  words.forEach(w => { if (w) s = s.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); });
  return s;
}
/* кусок текста вокруг первого совпадения */
function snip(text, w){
  const t = String(text || ''), i = t.toLowerCase().indexOf(w);
  if (i < 0) return t.slice(0, 140);
  const a = Math.max(0, i - 50), b = Math.min(t.length, i + 90);
  return (a ? '…' : '') + t.slice(a, b) + (b < t.length ? '…' : '');
}
function results(){
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return '<p class="muted">Ищет по задачам, их заметкам и подзадачам.</p>';
  const has = text => { const t = String(text || '').toLowerCase(); return words.every(w => t.includes(w)); };
  const groups = [];
  const tasks = B.tasks().filter(t => has(t.title + ' ' + (t.notes || '') + ' ' + (t.subs || []).map(s => s.t).join(' '))).slice(0, 30);
  if (tasks.length) groups.push(['Задачи', 'list', tasks.map(t => `<button class="sr" data-act="openTask" data-id="${t.id}"><b>${hl(t.title, words)}</b><span class="muted">${t.done ? 'сделано' : t.due ? B.rel(t.due) : 'без срока'}${t.proj && t.proj !== 'inbox' ? ' · ' + esc(B.projName(t.proj)) : ''}${t.notes && has(t.notes) ? ' · ' + hl(snip(t.notes, words[0]), words) : ''}</span></button>`)]);
  if (!groups.length) return '<p class="empty">Ничего не нашлось.</p>';
  return groups.map(([t, ic, rows]) => `<div class="sub-h">${t} <span class="muted">${rows.length}</span></div><div class="sr-list">${rows.join('')}</div>`).join('');
}

B.views.search = {
  title: 'Поиск',
  render(){
    return `<div class="page search-page">
      <header class="page-h"><div><div class="eyebrow">Поиск</div><h1>Найти что угодно</h1></div></header>
      <section class="card">
        <div class="add-line search-line">${icon('search')}<input id="sq" value="${esc(q)}" placeholder="Слово из задачи, разбора, цитаты…" data-in="sq" autocomplete="off" autofocus></div>
        <div id="sres">${results()}</div>
      </section>
    </div>`;
  },
  mount(){ const i = B.$('#sq'); if (i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
};
let st = 0;
B.inputs.sq = el => { q = el.value; clearTimeout(st); st = setTimeout(() => { const r = B.$('#sres'); if (r) r.innerHTML = results(); }, 120); };
})();
