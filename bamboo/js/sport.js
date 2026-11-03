/* Зов леса: тренировки. Отдельного раздела нет (убран 3.11.2026), тренировка отмечается в «Привычках» и на «Сегодня».
   Запись — документ w_<id> {date, note}. Нажатие на отмеченный день открывает заметку и «Снять отметку». */
(function(){
const {esc, icon} = B;
B.SPORT_TYPES = {home: 'Тренировка', tread: 'Беговая дорожка', gym: 'Зал', run: 'Бег', bike: 'Велосипед', walk: 'Ходьба', stretch: 'Растяжка', other: 'Другое'};

const onDay = date => B.workouts().filter(w => w.date === date);
/* текст записи: заметка, а у старых записей ещё и упражнения */
B.workoutText = w => {
  const ex = (w.ex || []).filter(e => e.name).map(e => `${e.name}: ${(e.sets || []).map(s => `${s.r}${+s.w ? ' × +' + s.w + ' кг' : ''}`).join(', ')}`);
  return [w.note || '', ex.join('; '), w.min ? B.mins(+w.min) : '', w.dist ? w.dist + ' км' : ''].filter(Boolean).join(' · ');
};
function markDay(date){
  const id = B.uid();
  B.put('w_' + id, {id, date, type: 'home', note: '', at: Date.now()});
  return id;
}
/* снять отметку за день; если в записи есть текст, сначала спросить */
B.unmarkSport = async date => {
  const list = onDay(date);
  if (list.some(w => B.workoutText(w)) && !(await B.confirm('В записи за этот день есть заметка. Снять отметку и удалить её?', 'Удалить', true))) return false;
  list.forEach(w => B.put('w_' + w.id, null));
  return true;
};
B.toggleSport = async date => {
  if (onDay(date).length){ if (await B.unmarkSport(date)) B.toast('Отметка тренировки снята'); return; }
  markDay(date);
  B.toast(`<b class="pos">Тренировка отмечена</b> <button class="toast-btn" data-act="sportOpen" data-d="${date}">Заметка</button>`, 4000);
};

B.acts.sportDay = el => { const d = el.dataset.d; if (onDay(d).length) B.sportSheet(d); else B.toggleSport(d); };
/* тренировка за день: заметка и снятие отметки */
B.sportSheet = d => {
  const list = onDay(d), w = list[0]; if (!w) return;
  B.sheet(`<h2>${icon('run')} Тренировка · ${B.WDF[B.wd(d)]}, ${B.fmt(d)}</h2>
    <label class="field">Заметка<textarea rows="5" data-in="sportNoteOld" data-id="${w.id}" placeholder="Что делал: подтягивания 4 × 8, дорожка 20 минут. Как себя чувствовал.">${esc(w.note || '')}</textarea></label>
    ${list.some(x => (x.ex || []).length || x.min) ? `<p class="muted">${esc(list.map(x => B.workoutText(Object.assign({}, x, {note: ''}))).filter(Boolean).join(' · '))}</p>` : ''}
    <div class="row between"><button class="btn ghost danger" data-act="sportDel" data-d="${d}">${icon('x')} Снять отметку</button><button class="btn primary" data-act="closeSheet">Готово</button></div>`);
};
B.acts.sportOpen = el => B.sportSheet(el.dataset.d);
B.inputs.sportNoteOld = el => { const w = B.get('w_' + el.dataset.id); if (w) B.put('w_' + w.id, Object.assign({}, w, {note: el.value}), true); };
B.acts.sportDel = async el => { if (await B.unmarkSport(el.dataset.d)){ B.closeSheet(); B.toast('Отметка тренировки снята'); } };
})();
