/* Режим бамбука: тренировки. Только отметка «тренировка сделана» и заметка, куда пишешь что угодно.
   Запись — документ w_<id> {date, note}. Старые записи с упражнениями показываются текстом. */
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
  B.xpToast(B.XP.sport, 'тренировка');
};

B.views.sport = {
  title: 'Спорт',
  render(){
    const t = B.today(), ws = B.weekStart(t), goal = B.cfg().sportGoal || 3, all = B.workouts();
    const week = new Set(all.filter(w => w.date >= ws && w.date <= t).map(w => w.date)).size;
    const todayW = onDay(t)[0];
    const mon = new Set(all.filter(w => w.date.startsWith(t.slice(0, 7))).map(w => w.date)).size;
    const days = [...new Set(all.map(w => w.date))].sort().reverse().slice(0, 40);
    return `<div class="page sport-page">
      <header class="page-h"><div><div class="eyebrow">Тренировки</div><h1>Тело в режиме</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card sport-today ${todayW ? 'on' : ''}">
            <button class="sport-btn" data-act="sportDay" data-d="${t}">
              <i>${todayW ? icon('check') : icon('run')}</i>
              <span><b>${todayW ? 'Тренировка сегодня есть' : 'Отметить тренировку'}</b><small>${todayW ? 'нажми ещё раз, чтобы снять' : `+${B.XP.sport} XP`}</small></span>
            </button>
            <label class="field">Заметка
              <textarea rows="4" data-in="sportNote" data-d="${t}" placeholder="Что делал: подтягивания 4 × 8, отжимания +10 кг 3 × 12, дорожка 20 минут. Как себя чувствовал.">${esc(todayW ? (todayW.note || '') : '')}</textarea></label>
            <p class="hint">Если начать писать заметку, тренировка отметится сама.</p>
          </section>
          <section class="card">
            <div class="row">
              <div class="lvl-ring">${B.ring(week / goal, 72)}<b>${week}</b></div>
              <div class="grow"><h2>На этой неделе ${week} из ${goal}</h2>
                <div class="week7">${Array.from({length: 7}, (_, i) => B.add(ws, i)).map(d => { const on = onDay(d).length > 0, can = d <= t && B.diff(d, t) <= 2;
                  return `<button class="d7 ${on ? 'on' : ''} ${d === t ? 'now' : ''}" ${can ? `data-act="sportDay" data-d="${d}"` : 'disabled'} title="${B.fmtW(d)}"><span>${B.WD[B.wd(d)]}</span><i>${on ? icon('check') : ''}</i></button>`; }).join('')}</div>
              </div>
            </div>
            <p class="hint">За этот месяц ${mon} ${B.plural(mon, 'тренировка', 'тренировки', 'тренировок')}. Отметить можно сегодня и два прошлых дня.</p>
          </section>
        </div>
        <div class="col">
          <section class="card">
            <h2>${icon('pen')}Записи</h2>
            ${days.filter(d => d !== t || (todayW && B.workoutText(todayW))).map(d => { const txt = onDay(d).map(B.workoutText).filter(Boolean).join(' · ');
              return `<button class="wrow" data-act="sportOpen" data-d="${d}">
                <span class="wdate"><b>${B.parse(d).getDate()}</b>${B.MON[B.parse(d).getMonth()]}</span>
                <span class="grow"><b>${B.WDF[B.wd(d)]}</b><span class="muted">${txt ? esc(txt) : 'без заметки'}</span></span></button>`; }).join('') || '<p class="empty">Пока ни одной тренировки. Отметь первую.</p>'}
          </section>
        </div>
      </div>
    </div>`;
  }
};
B.acts.sportDay = el => B.toggleSport(el.dataset.d);
let noteT = 0;
B.inputs.sportNote = el => {
  const d = el.dataset.d, v = el.value;
  clearTimeout(noteT);
  noteT = setTimeout(() => {
    let w = onDay(d)[0];
    if (!w){ if (!v.trim()) return; const id = markDay(d); w = B.get('w_' + id); B.xpToast(B.XP.sport, 'тренировка'); }
    B.put('w_' + w.id, Object.assign({}, w, {note: v}), true);
  }, 500);
};
/* старая запись: заметка редактируется в листе */
B.acts.sportOpen = el => {
  const d = el.dataset.d, list = onDay(d), w = list[0]; if (!w) return;
  B.sheet(`<h2>${B.WDF[B.wd(d)]}, ${B.fmt(d)}</h2>
    <label class="field">Заметка<textarea rows="6" data-in="sportNoteOld" data-id="${w.id}">${esc(w.note || '')}</textarea></label>
    ${list.some(x => (x.ex || []).length || x.min) ? `<p class="muted">${esc(list.map(x => B.workoutText(Object.assign({}, x, {note: ''}))).filter(Boolean).join(' · '))}</p>` : ''}
    <div class="row between"><button class="btn ghost danger" data-act="sportDel" data-d="${d}">${icon('trash')} Удалить</button><button class="btn primary" data-act="closeSheet">Готово</button></div>`);
};
B.inputs.sportNoteOld = el => { const w = B.get('w_' + el.dataset.id); if (w) B.put('w_' + w.id, Object.assign({}, w, {note: el.value}), true); };
B.acts.sportDel = async el => { if (await B.unmarkSport(el.dataset.d)) B.closeSheet(); };
})();
