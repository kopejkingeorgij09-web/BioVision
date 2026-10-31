/* Режим бамбука: календарь. Месяц с отметками дней, сроки задач, вебы и ДЗ ШАДа, тренировки; ниже выбранный день целиком. */
(function(){
const {esc, icon} = B;

function dayDots(date, c){
  const tasks = B.tasks().filter(t => t.due === date);
  const shad = B.shadOn(date);
  const sport = B.workouts().filter(w => w.date === date).length;
  const r = c.days[date];
  const dots = [];
  shad.forEach(it => dots.push(`<i class="d c-${it.p.c} ${B.shadStage(it.p.n) >= it.need ? 'ok' : ''}"></i>`));
  tasks.slice(0, 4).forEach(t => dots.push(`<i class="d t ${t.done ? 'ok' : ''} p${t.pri}"></i>`));
  if (sport) dots.push(`<i class="d sport"></i>`);
  return {html: dots.slice(0, 6).join(''), n: tasks.length + shad.length, res: r ? r.result : ''};
}

function month(sel, c){
  const d0 = B.parse(sel); const first = B.ymd(new Date(d0.getFullYear(), d0.getMonth(), 1, 12));
  const start = B.weekStart(first), today = B.today();
  let cells = '';
  for (let i = 0; i < 42; i++){
    const d = B.add(start, i), p = B.parse(d);
    if (i >= 35 && p.getMonth() !== d0.getMonth()) break;
    const x = dayDots(d, c);
    cells += `<a class="cday ${p.getMonth() !== d0.getMonth() ? 'other' : ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''} r-${x.res}" href="#/cal/${d}">
      <span class="cnum">${p.getDate()}</span><span class="cdots">${x.html}</span></a>`;
  }
  const prev = B.ymd(new Date(d0.getFullYear(), d0.getMonth() - 1, 1, 12)), next = B.ymd(new Date(d0.getFullYear(), d0.getMonth() + 1, 1, 12));
  return `<section class="card cal">
    <div class="row between cal-h">
      <a class="icon-btn" href="#/cal/${prev}" aria-label="Предыдущий месяц">${icon('left')}</a>
      <h2>${B.MONF[d0.getMonth()]} ${d0.getFullYear()}</h2>
      <a class="icon-btn" href="#/cal/${next}" aria-label="Следующий месяц">${icon('right')}</a>
    </div>
    <div class="cgrid wd">${B.WD.map(w => `<span>${w}</span>`).join('')}</div>
    <div class="cgrid">${cells}</div>
    <div class="legend"><span><i class="lgd good"></i>день закрыт</span><span><i class="lgd fail"></i>провал</span><span><i class="lgd frozen"></i>заморозка</span><span><i class="d t"></i>задача</span><span><i class="d c-m1"></i>ШАД</span><span><i class="d sport"></i>тренировка</span></div>
    ${sel !== today ? `<a class="btn sm ghost" href="#/cal/${today}">К сегодня</a>` : ''}
  </section>`;
}

function dayPanel(date, c){
  const r = c.days[date], d = B.day(date), today = B.today();
  const tasks = B.tasks().filter(t => t.due === date).sort((a, b) => a.done - b.done || (a.time || '99').localeCompare(b.time || '99'));
  const doneThat = B.tasks().filter(t => t.done && t.doneAt && B.dayOf(t.doneAt) === date && t.due !== date);
  const shad = B.shadOn(date);
  const ws = B.workouts().filter(w => w.date === date);
  const rm = B.readMin(date), pomo = (d.pomo || []);
  const res = r ? {good: 'День закрыт', fail: 'День не закрыт', frozen: 'Заморозка', open: 'Идёт', ready: 'Можно закрывать'}[r.result] : '';
  return `<section class="card day-panel">
    <div class="row between"><h2>${B.WDF[B.wd(date)]}, ${B.fmt(date)}</h2>${res ? `<span class="tag r-${r.result}">${res}${r.xp ? ` · ${r.xp > 0 ? '+' : ''}${r.xp} XP` : ''}</span>` : ''}</div>
    ${shad.length ? `<div class="sub-h">ШАД</div>${shad.map(it => B.shadRow(it, date)).join('')}` : ''}
    <div class="sub-h">Задачи со сроком</div>
    ${tasks.length ? `<div class="tasks">${tasks.map(t => B.taskRow(t)).join('')}</div>` : '<p class="empty sm">Нет</p>'}
    ${date >= today ? `<div class="add-line"><input id="calNew" placeholder="Задача на ${B.fmtS(date)}" data-enter="calNew" data-d="${date}"><button class="btn sm" data-act="calNew" data-d="${date}">${icon('plus')}</button></div>` : ''}
    ${doneThat.length ? `<div class="sub-h">Ещё сделано в этот день</div><div class="tasks">${doneThat.map(t => B.taskRow(t)).join('')}</div>` : ''}
    ${date <= today ? `<div class="sub-h">Итоги</div>
      <div class="facts">
        <span>${icon('timer')}${pomo.length} ${B.plural(pomo.length, 'помидор', 'помидора', 'помидоров')}</span>
        <span>${icon('book')}${B.mins(rm)} чтения</span>
        <span>${icon('dumbbell')}${ws.length ? ws.map(w => esc(B.SPORT_TYPES[w.type] || w.type)).join(', ') : 'без тренировки'}</span>
        <span>${icon('habit')}${B.habits().filter(h => B.habitDone(h, date)).length}/${B.habits().length} привычек</span>
      </div>
      <a class="btn sm" href="#/journal/${date}">${icon('pen')} ${B.hasReview(d) ? 'Дневник дня' : 'Написать разбор'}</a>` : ''}
  </section>`;
}

B.views.cal = {
  title: 'Календарь',
  render(arg){
    const sel = /^\d{4}-\d\d-\d\d$/.test(arg || '') ? arg : B.today();
    const c = B.calc();
    return `<div class="page cal-page">
      <header class="page-h"><div><div class="eyebrow">Календарь</div><h1>Вуз, ШАД и всё остальное</h1></div></header>
      <div class="cols cal-cols"><div class="col">${month(sel, c)}</div><div class="col">${dayPanel(sel, c)}</div></div>
    </div>`;
  }
};
B.acts.calNew = el => {
  const v = B.$('#calNew').value.trim(); if (!v) return;
  const tk = B.addQuick(v, {due: el.dataset.d});
  if (tk) B.toast('Добавлено: ' + esc(tk.title));
};
})();
