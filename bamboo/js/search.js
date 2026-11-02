/* Режим бамбука: поиск по задачам, дневнику (разборы и мысли), книгам и цитатам, заметкам тренировок. */
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
  if (!words.length) return '<p class="muted">Ищет по задачам и их заметкам, разборам и мыслям в дневнике, книгам и цитатам, заметкам тренировок.</p>';
  const has = text => { const t = String(text || '').toLowerCase(); return words.every(w => t.includes(w)); };
  const groups = [];
  const tasks = B.tasks().filter(t => has(t.title + ' ' + (t.notes || '') + ' ' + (t.subs || []).map(s => s.t).join(' '))).slice(0, 30);
  if (tasks.length) groups.push(['Задачи', 'list', tasks.map(t => `<button class="sr" data-act="openTask" data-id="${t.id}"><b>${hl(t.title, words)}</b><span class="muted">${t.done ? 'сделано' : t.due ? B.rel(t.due) : 'без срока'}${t.proj && t.proj !== 'inbox' ? ' · ' + esc(B.projName(t.proj)) : ''}${t.notes && has(t.notes) ? ' · ' + hl(snip(t.notes, words[0]), words) : ''}</span></button>`)]);
  const jr = [];
  const dates = B.dayDates().reverse();
  dates.forEach(date => {
    const d = B.day(date), rv = d.review || {};
    ['done', 'why', 'tomorrow'].forEach(k => { if (rv[k] && has(rv[k])) jr.push({date, t: rv[k], kind: k === 'why' ? 'что не вышло' : 'разбор'}); });
    (d.notes || []).forEach(n => { if (has(n.t)) jr.push({date, t: n.t, kind: 'мысль'}); });
  });
  if (jr.length) groups.push(['Дневник', 'pen', jr.slice(0, 40).map(x => `<a class="sr" href="#/journal/${x.date}"><b>${B.fmtW(x.date)}</b><span class="muted">${x.kind}: ${hl(snip(x.t, words[0]), words)}</span></a>`)]);
  const bk = [];
  B.books().forEach(b => {
    if (has(b.title + ' ' + (b.author || ''))) bk.push(`<button class="sr" data-act="bookOpen" data-id="${b.id}"><b>${hl(b.title, words)}</b><span class="muted">${hl(b.author || '', words)}</span></button>`);
    (b.notes || []).forEach(n => { if (has(n.t)) bk.push(`<button class="sr" data-act="bookOpen" data-id="${b.id}"><b>${esc(b.title)}</b><span class="muted">${n.k === 'q' ? 'цитата' : 'мысль'}: ${hl(snip(n.t, words[0]), words)}</span></button>`); });
  });
  if (bk.length) groups.push(['Книги', 'book', bk.slice(0, 30)]);
  const ws = B.workouts().filter(w => has(B.workoutText ? B.workoutText(w) : w.note)).slice(0, 20);
  if (ws.length) groups.push(['Тренировки', 'run', ws.map(w => `<a class="sr" href="#/sport"><b>${B.fmtW(w.date)}</b><span class="muted">${hl(snip(B.workoutText(w), words[0]), words)}</span></a>`)]);
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
