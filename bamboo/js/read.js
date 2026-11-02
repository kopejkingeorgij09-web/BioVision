/* Режим бамбука: чтение художественной и любой не учебной литературы.
   Минуты в день (секундомер или ручная запись), полка «Читаю / Хочу / Прочитано», цитаты и мысли по книге. */
(function(){
const {esc, icon} = B;
const LS = 'bamboo-read-timer';
let RT = null;
try { RT = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
const saveRT = () => { try { RT ? localStorage.setItem(LS, JSON.stringify(RT)) : localStorage.removeItem(LS); } catch (e) {} };
let shelf = 'reading';

function sessions(){
  const out = [];
  B.list('d_').forEach(d => (d.read || []).forEach(r => out.push(r)));
  return out;
}
const bookMin = (id, ss) => ss.filter(r => r.book === id).reduce((a, r) => a + (r.min || 0), 0);
function logRead(book, min, page){
  min = Math.round(min); if (!(min > 0)) return;
  const t = B.today(), before = B.readMin(t), goal = B.cfg().readGoal || 30;
  B.editDay(t, d => { d.read = (d.read || []).concat({book: book || null, min, page: page || undefined, at: Date.now()}); });
  if (book && page){ const b = B.get('b_' + book); if (b) B.put('b_' + book, Object.assign({}, b, {page}), true); }
  B.toast(`<b class="pos">+${B.mins(min)} чтения</b>${before < goal && before + min >= goal ? ' · цель дня выполнена' : ''}`);
}

function chart(){
  const t = B.today(), goal = B.cfg().readGoal || 30;
  const days = Array.from({length: 30}, (_, i) => B.add(t, i - 29)), vals = days.map(B.readMin);
  const max = Math.max(goal * 1.5, ...vals);
  return `<div class="bars dense" style="--g:${(goal / max).toFixed(3)}">${days.map((d, i) => `<div class="bar-col ${d === t ? 'now' : ''} ${vals[i] >= goal ? 'ok' : ''}" title="${B.fmtW(d)}: ${vals[i]} мин"><span class="bv"></span><span class="bw"><i style="height:${(vals[i] / max * 100).toFixed(1)}%"></i></span>${i % 5 === 4 || i === 29 ? `<span class="bl">${B.parse(d).getDate()}</span>` : '<span class="bl"></span>'}</div>`).join('')}<div class="goal-line"></div></div>
  <p class="hint">Минуты чтения за 30 дней, линия: цель ${goal} мин</p>`;
}

/* прочитанное по годам: книги с оценкой и лучшей цитатой */
function yearsView(list, ss){
  const by = {};
  list.forEach(b => { const y = (b.finished || '').slice(0, 4) || 'без даты'; (by[y] = by[y] || []).push(b); });
  return Object.keys(by).sort().reverse().map(y => `<div class="year-h"><b>${y}</b><span class="muted">${by[y].length} ${B.plural(by[y].length, 'книга', 'книги', 'книг')} · ${B.mins(by[y].reduce((a, b) => a + bookMin(b.id, ss), 0))}</span></div>
    ${by[y].map(b => { const q = (b.notes || []).find(n => n.k === 'q') || (b.notes || [])[0];
      return bookCard(b, ss) + (q ? `<p class="year-q">«${esc(q.t)}»</p>` : ''); }).join('')}`).join('') || '';
}
function bookCard(b, ss){
  const m = bookMin(b.id, ss);
  return `<button class="book ${b.status}" data-act="bookOpen" data-id="${b.id}">
    <span class="spine c-${b.color || 'green'}"></span>
    <span class="book-body"><b>${esc(b.title)}</b><span class="muted">${esc(b.author || '')}</span>
    <span class="book-meta">${m ? `${icon('timer')}${B.mins(m)}` : ''}${b.pages && b.page ? ` · стр. ${b.page}/${b.pages}` : ''}${b.rating ? ` · ${'★'.repeat(b.rating)}` : ''}${(b.notes || []).length ? ` · ${icon('quote')}${b.notes.length}` : ''}</span>
    ${b.pages && b.page && b.status === 'reading' ? B.bar(b.page / b.pages, 'thin') : ''}</span>
  </button>`;
}

B.views.read = {
  title: 'Чтение',
  render(){
    const t = B.today(), goal = B.cfg().readGoal || 30, today = B.readMin(t);
    const ss = sessions(), books = B.books();
    const reading = books.filter(b => b.status === 'reading');
    const year = String(B.parse(t).getFullYear());
    const goalY = B.cfg().bookGoal || 12;
    const doneYear = books.filter(b => b.status === 'done' && (b.finished || '').startsWith(year)).length;
    let week = 0; for (let i = 0; i < 7; i++) week += B.readMin(B.add(t, -i));
    const month = ss.filter(r => B.dayOf(r.at).slice(0, 7) === t.slice(0, 7)).reduce((a, r) => a + r.min, 0);
    const list = books.filter(b => b.status === shelf).sort((a, b) => (b.finished || b.added || '').localeCompare(a.finished || a.added || ''));
    const running = RT ? Math.floor((Date.now() - RT.startAt) / 60000) : 0;
    return `<div class="page read-page">
      <header class="page-h"><div><div class="eyebrow">Чтение</div><h1>Книги, не учебники</h1></div>
        <button class="btn primary" data-act="bookNew">${icon('plus')} Книга</button></header>
      <div class="cols">
        <div class="col">
          <section class="card read-today">
            <div class="row">
              <div class="lvl-ring">${B.ring(today / goal, 72)}<b>${today}</b></div>
              <div class="grow"><h2>Сегодня ${today} из ${goal} мин</h2><p class="muted">${today >= goal ? 'Цель дня есть, привычка отмечена.' : `Осталось ${goal - today} мин.`}</p></div>
            </div>
            ${RT ? `<div class="read-run"><b id="rtClock">${running} мин</b><span class="grow">читаю «${esc((B.get('b_' + RT.book) || {title: 'без книги'}).title)}»</span><button class="btn primary" data-act="rtStop">${icon('stop')} Закончил</button></div>`
              : `<div class="read-log">
                <label class="field">Книга<select id="rBook">${reading.map(b => `<option value="${b.id}">${esc(b.title)}</option>`).join('')}<option value="">Другое</option></select></label>
                <div class="chips">${[10, 15, 20, 30, 45, 60].map(m => `<button class="chip" data-act="readLog" data-m="${m}">+${m} мин</button>`).join('')}</div>
                <div class="row"><label class="field grow">Минут<input id="rMin" type="number" min="1" max="600" inputmode="numeric" placeholder="25"></label><label class="field grow">Дочитал до стр.<input id="rPage" type="number" min="1" inputmode="numeric" placeholder="необязательно"></label></div>
                <div class="row"><button class="btn" data-act="readLog">Записать</button><button class="btn primary" data-act="rtStart">${icon('play')} Начать читать</button></div>
              </div>`}
          </section>
          <section class="card">${chart()}</section>
          <section class="card"><div class="kpis">
            <div class="kpi"><b>${B.mins(week)}</b><span>за 7 дней</span></div>
            <div class="kpi"><b>${B.mins(month)}</b><span>в этом месяце</span></div>
          </div>
          <div class="goal-y"><div class="row between"><span>Цель на ${year}: <b>${doneYear} из ${goalY}</b> ${B.plural(goalY, 'книги', 'книг', 'книг')}</span><button class="btn sm ghost" data-act="bookGoal">изменить</button></div>
            ${B.bar(doneYear / goalY)}<p class="hint">${(() => { const d0 = B.parse(year + '-01-01'), n = Math.max(1, Math.round((B.parse(t) - d0) / 864e5)), pace = goalY * n / 365; return doneYear >= goalY ? 'Цель года выполнена.' : doneYear >= pace ? 'Идёшь с опережением графика.' : `По графику сейчас было бы ${Math.floor(pace)}.`; })()}</p></div>
          </section>
        </div>
        <div class="col">
          <section class="card">
            <div class="toggle wide">${[['reading', 'Читаю'], ['want', 'Хочу'], ['done', 'Прочитано']].map(([k, l]) => `<button class="${shelf === k ? 'on' : ''}" data-act="shelf" data-k="${k}">${l} <span class="muted">${books.filter(b => b.status === k).length}</span></button>`).join('')}</div>
            <div class="shelf">${shelf === 'done' ? yearsView(list, ss) : list.map(b => bookCard(b, ss)).join('') || `<p class="empty">${shelf === 'want' ? 'Добавь книги, которые давно хотел прочитать.' : shelf === 'done' ? 'Здесь будут прочитанные книги.' : 'Сейчас ничего не читаешь. Добавь книгу.'}</p>`}</div>
          </section>
        </div>
      </div>
    </div>`;
  }
};
setInterval(() => { const el = document.getElementById('rtClock'); if (el && RT) el.textContent = Math.floor((Date.now() - RT.startAt) / 60000) + ' мин'; }, 15000);
B.acts.bookGoal = async () => {
  const v = await B.dialog(`<h3>Сколько книг за год</h3><label class="field">Цель<input id="bgN" type="number" min="1" max="200" value="${B.cfg().bookGoal || 12}" autofocus></label>
    <div class="row end"><button class="btn ghost" data-act="dlgNo">Отмена</button><button class="btn primary" data-act="bgOk">Сохранить</button></div>`);
  if (v) B.setCfg({bookGoal: v});
};
B.acts.bgOk = () => { const v = +B.$('#bgN').value; if (v > 0) B.closeDialog(v); };
B.acts.shelf = el => { shelf = el.dataset.k; B.render(); };
B.acts.readLog = el => {
  const min = el.dataset.m ? +el.dataset.m : +B.$('#rMin').value;
  if (!min) { B.$('#rMin').focus(); return; }
  logRead(B.$('#rBook') ? B.$('#rBook').value : null, min, +B.$('#rPage').value || 0);
};
B.acts.rtStart = () => { RT = {book: B.$('#rBook') ? B.$('#rBook').value : null, startAt: Date.now()}; saveRT(); B.render(); };
B.acts.rtStop = async () => {
  if (!RT) return;
  const min = Math.round((Date.now() - RT.startAt) / 60000);
  const page = await B.dialog(`<h3>Чтение: ${B.mins(Math.max(1, min))}</h3>
    <label class="field">На какой странице остановился<input id="rtPage" type="number" min="1" inputmode="numeric" placeholder="необязательно" autofocus></label>
    <div class="row end"><button class="btn primary" data-act="rtOk">Записать</button></div>`);
  logRead(RT.book, Math.max(1, min), page || 0);
  RT = null; saveRT(); B.render();
};
B.acts.rtOk = () => B.closeDialog(+B.$('#rtPage').value || 0);

/* книга */
function bookForm(b){
  b = b || {title: '', author: '', status: 'reading', pages: '', color: 'green'};
  const ss = sessions(), m = b.id ? bookMin(b.id, ss) : 0;
  return `<h2>${b.id ? esc(b.title) : 'Новая книга'}</h2>
    <label class="field">Название<input id="bTitle" value="${esc(b.title)}" ${b.id ? '' : 'autofocus'}></label>
    <div class="ed-grid">
      <label>Автор<input id="bAuthor" value="${esc(b.author || '')}"></label>
      <label>Страниц<input id="bPages" type="number" min="1" value="${b.pages || ''}" placeholder="необязательно"></label>
      <label>Полка<select id="bStatus"><option value="reading" ${b.status === 'reading' ? 'selected' : ''}>Читаю</option><option value="want" ${b.status === 'want' ? 'selected' : ''}>Хочу прочитать</option><option value="done" ${b.status === 'done' ? 'selected' : ''}>Прочитано</option></select></label>
      <label>Цвет корешка<select id="bColor">${B.COLORS.map(c => `<option value="${c}" ${b.color === c ? 'selected' : ''}>${B.COLOR_NAMES[c]}</option>`).join('')}</select></label>
    </div>
    ${b.id ? `<div class="field">Оценка<div class="stars">${[1, 2, 3, 4, 5].map(i => `<button class="${(b.rating || 0) >= i ? 'on' : ''}" data-act="bookRate" data-id="${b.id}" data-r="${i}">${icon('star')}</button>`).join('')}</div></div>
    <p class="muted">${m ? `Прочитано ${B.mins(m)}` : 'Записей чтения пока нет'}${b.started ? ` · начал ${B.fmt(b.started)}` : ''}${b.finished ? ` · дочитал ${B.fmt(b.finished)}` : ''}</p>
    <div class="ed-sec"><div class="sec-h">${icon('quote')} Цитаты и мысли</div>
      <div class="add-line"><textarea id="bNote" rows="2" placeholder="Цитата или своя мысль о книге"></textarea></div>
      <div class="row"><button class="btn sm" data-act="bookNote" data-id="${b.id}" data-k="q">${icon('quote')} Цитата</button><button class="btn sm" data-act="bookNote" data-id="${b.id}" data-k="t">${icon('pen')} Мысль</button></div>
      <div class="notes">${(b.notes || []).slice().reverse().map(n => `<div class="bnote ${n.k}"><p>${esc(n.t)}</p><span class="muted">${B.fmtS(B.dayOf(n.at))}${n.k === 'q' ? ' · цитата' : ''}</span><button class="icon-btn sm" data-act="bookNoteDel" data-id="${b.id}" data-at="${n.at}">${icon('x')}</button></div>`).join('')}</div>
    </div>` : ''}
    <div class="row between">${b.id ? `<button class="btn ghost danger" data-act="bookDel" data-id="${b.id}">${icon('trash')} Удалить</button>` : '<span></span>'}
      <button class="btn primary" data-act="bookSave" data-id="${b.id || ''}">Сохранить</button></div>`;
}
B.acts.bookNew = () => B.sheet(bookForm());
B.acts.bookOpen = el => B.sheet(bookForm(B.get('b_' + el.dataset.id)));
B.acts.bookSave = el => {
  const title = B.$('#bTitle').value.trim(); if (!title) return;
  const id = el.dataset.id || B.uid(), old = B.get('b_' + id) || {id, added: B.today(), notes: []};
  const status = B.$('#bStatus').value, t = B.today();
  const nb = Object.assign({}, old, {title, author: B.$('#bAuthor').value.trim(), pages: +B.$('#bPages').value || 0, status, color: B.$('#bColor').value});
  if (status === 'reading' && !nb.started) nb.started = t;
  if (status === 'done' && !nb.finished){ nb.finished = t; B.toast(`<b class="pos">Книга прочитана.</b> Поставь оценку и запиши главную мысль`); }
  if (status !== 'done') delete nb.finished;
  B.put('b_' + id, nb);
  shelf = status;
  if (status === 'done' && !old.finished) B.sheet(bookForm(nb)); else B.closeSheet();
};
B.acts.bookRate = el => { const b = B.get('b_' + el.dataset.id); const nb = Object.assign({}, b, {rating: +el.dataset.r}); B.put('b_' + b.id, nb, true); B.sheet(bookForm(nb)); };
B.acts.bookNote = el => {
  const v = B.$('#bNote').value.trim(); if (!v) return;
  const b = B.get('b_' + el.dataset.id); const nb = Object.assign({}, b, {notes: (b.notes || []).concat({k: el.dataset.k, t: v, at: Date.now()})});
  B.put('b_' + b.id, nb, true); B.sheet(bookForm(nb));
};
B.acts.bookNoteDel = el => {
  const b = B.get('b_' + el.dataset.id); const nb = Object.assign({}, b, {notes: (b.notes || []).filter(n => String(n.at) !== el.dataset.at)});
  B.put('b_' + b.id, nb, true); B.sheet(bookForm(nb));
};
B.acts.bookDel = async el => {
  const b = B.get('b_' + el.dataset.id);
  if (!(await B.confirm(`Удалить «${esc(b.title)}» вместе с цитатами? Минуты чтения в днях останутся.`, 'Удалить', true))) return;
  B.put('b_' + b.id, null); B.closeSheet();
};
})();
