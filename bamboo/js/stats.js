/* Зов леса: «Итоги». Неделя, месяц или всё время: опыт по дням, закрытые дни, чтение, спорт, привычки.
   Для недели ещё разбор: причины переносов и вопрос «что меняю на следующей неделе» (документ wk_<понедельник>).
   Внизу перемотка: каким был лес в любой прошлый день. */
(function(){
function dayReport(day, sessions, lessons){
  const d=B.day(day), calc=B.calc().days[day], history=B.boardData.history(day);
  const tasks=B.list('t_'), dateOf=ts=>ts ? B.dayOf(ts) : '';
  const habits=B.list('h_').filter(h=>(!h.created||day>=h.created)&&(!h.archAt||day<h.archAt));
  const shad=Object.entries(B.shad.marks).filter(([,m])=>dateOf(m.at)===day).map(([n,m])=>({
    тема:B.shad.plan.find(p=>p.n===Number(n))?.t || n,статус:B.SHAD_STAGES[m.s],заметка:m.note
  }));
  const calendar=B.calendarView.itemsBetween(day,day,{includeHidden:true});
  const sessionList=sessions.filter(x=>x.day===day);
  return {
    дата:day,главное:(d.top||[]).map(id=>B.task(id)?.title||id),выбранное:d.focus || undefined,
    задачи:tasks.filter(t=>t.due===day||dateOf(t.created)===day||dateOf(t.doneAt)===day).map(t=>({
      название:t.title,срок:t.due||undefined,создана:dateOf(t.created)||undefined,завершена:dateOf(t.doneAt)||undefined,
      календарь:B.proj(t.proj)?.name,заметка:t.notes||undefined})),
    шаги:tasks.flatMap(t=>(t.subs||[]).filter(s=>dateOf(s.doneAt)===day).map(s=>[t.title,s.t])),
    переносы:tasks.flatMap(t=>(t.postpones||[]).filter(p=>dateOf(p.at)===day).map(p=>[t.title,p.from,p.to,p.why])),
    календарь:calendar.map(e=>({тип:e.kind,часть:e.part,дело:e.title,начало:e.start,конец:e.end,отметка:e.done||undefined,повтор:e.ghost||undefined})),
    доска:Object.fromEntries(Object.entries(history).map(([k,rows])=>[{plan:'В планах',active:'В работе',done:'Готово'}[k],rows.map(r=>r.title)])),
    переходы:B.list('boardlog_').filter(x=>dateOf(x.at)===day).sort((a,b)=>a.at-b.at).map(x=>[B.hm(x.at),x.title,x.before,x.lane]),
    привычки:habits.map(h=>({название:h.name,тип:h.kind,цель:h.target,доля:B.habitVal(h,day)})),
    чтение:(d.read||[]).map(r=>({книга:B.books().find(b=>b.id===r.book)?.title || r.book,мин:r.min,страница:r.page})),
    Альбертс:B.alberts?.pagesOn(day)||0,
    тренировки:B.workouts().filter(w=>w.date===day).map(w=>({вид:B.SPORT_TYPES[w.type]||w.type,заметка:w.note})),
    фокус:sessionList.map(x=>({дело:x.title,мин:x.minutes,конец:B.hm(x.at)})),
    ШАД:shad,Фаги:{день:B.phxDay(day),сроки:B.phxOn(day),занятия:(lessons?.lessons||[]).filter(x=>x.day===day)
      .map(x=>({урок:x.title,время:x.start,материалы:x.files,задания:x.tasks})),
      ответы:(lessons?.reviews||[]).filter(x=>String(x.submitted||'').startsWith(day)).map(x=>x.title)},
    итоги:calc?{опыт:calc.xp,источники:calc.p,уровень:B.levelOf(calc.total).L,деревья:B.levelOf(calc.total).trees}:undefined,
    записи:{блокнот:d.notebook,разбор:d.review,мысли:d.notes,план:d.plan,условие:d.when}
  };
}
// The same three components and thresholds apply to both periods, including incomplete weeks.
function efficiency(rows){
  if(!rows.length)return null;
  let productive=0, habitSum=0, habitCount=0, study=0;
  for(const r of rows){
    if(r.доска.Готово.length || r.шаги.length || r.ШАД.length || r.фокус.length)productive++;
    for(const h of r.привычки.filter(h=>h.тип!=='weekly')){habitSum+=h.доля;habitCount++;}
    if(r.Альбертс>0 || r.ШАД.length || r.чтение.reduce((n,x)=>n+(x.мин||0),0)+r.фокус.reduce((n,x)=>n+x.мин,0)>=25)study++;
  }
  return {балл:habitCount?Math.round(50*productive/rows.length+30*habitSum/habitCount+20*study/rows.length):null,
    дней:rows.length,дней_с_результатом:productive,баллы_привычек:habitSum,возможных_отметок:habitCount,учебных_дней:study};
}
function weekPrompt(from=B.weekStart(B.today()), lessons=B.teaching){
  const today=B.today(),start=B.cfg().start, sessions=B.focus.sessions(),days=Array.from({length:7},(_,i)=>B.add(from,i));
  const rows=days.map(d=>dayReport(d,sessions,lessons));
  const tracked=rows.filter(r=>r.дата<=today && r.дата>=start);
  const prev=tracked.map(r=>B.add(r.дата,-7)).filter(d=>d>=start).map(d=>dayReport(d,sessions,null));
  const data={выбранная_неделя:from,конец:days[6],дата_выгрузки:today,начало_учёта:start,
    индекс:efficiency(tracked),предыдущая_неделя:prev.length===tracked.length?efficiency(prev):null,
    уроки_Фагов:lessons&&!lessons.failed?'доступны':'облачные данные недоступны',
    план_изменений:B.get('wk_'+from)?.change,дни:rows};
  return 'Разбери мою неделю по записям «Зова леса». Что получилось, что мешало, какие привычки изменились? Приведи конкретные дни и три решения для следующей недели. Событие в календаре означает план. Отмечай неполные данные и будущие дни. ШАД хранит последнюю известную отметку темы.\\n'
    +'Индекс эффективности v1 (0–100) = округлить(50 × доля дней с результатом + 30 × доля выполненных ежедневных привычек + 20 × доля учебных дней). Результат — завершённое дело, шаг, отметка ШАД или полный фокус-сеанс. Учебный день — страницы Альбертса, отметка ШАД или суммарно 25 минут чтения и фокуса. Мини-версия привычки даёт 0,5. Без наблюдаемых дней или ежедневных привычек балл не определён. Сравни только одинаковые дни недели при сопоставимой полноте учёта. Укажи разницу в баллах и объясни её по компонентам.\\n'
    +JSON.stringify(data,null,2);
}
B.weekPrompt=weekPrompt;
B.acts.aiWeek=async el=>{
  const from=el?.dataset.week || B.weekStart(B.today());
  const prepare=async()=>{
    let feed=B.teaching;
    if(B.cloud){
      try{feed=await BVAUTH.teachingWeek(from);}
      catch{feed=null;}
    }
    return weekPrompt(from,feed);
  };
  const pending=prepare();
  try{
    if(typeof ClipboardItem==='function' && navigator.clipboard?.write){
      await navigator.clipboard.write([new ClipboardItem({'text/plain':pending.then(t=>new Blob([t],{type:'text/plain'}))})]);
    }else await navigator.clipboard.writeText(await pending);
    B.toast('Промпт за неделю скопирован');
  }catch{
    const content=await pending;
    B.sheet(`<h2>Промпт за неделю</h2><textarea id="week-copy" readonly rows="12">${B.esc(content)}</textarea><button class="btn primary" data-act="weekCopyAgain">Скопировать текст</button>`);
    B.acts.weekCopyAgain();
  }
};
B.acts.weekCopyAgain=()=>{
  const field=B.$('#week-copy');if(!field)return;
  field.select();
  if(document.execCommand('copy')){B.closeSheet();B.toast('Промпт за неделю скопирован');}
  else B.toast('Текст выделен. Выбери «Копировать».');
};
const {esc, icon} = B;
let mode = 'week', anchor = null, replay = null, playT = null;

function range(){
  const t = B.today(), c = B.calc();
  if (mode === 'week'){ const ws = anchor || B.weekStart(t); return {from: ws, to: B.add(ws, 6), label: `${B.fmtS(ws)} – ${B.fmtS(B.add(ws, 6))}`}; }
  if (mode === 'month'){
    const a = B.parse(anchor || t.slice(0, 8) + '01'), from = B.ymd(new Date(a.getFullYear(), a.getMonth(), 1, 12)), to = B.ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0, 12));
    return {from, to, label: `${B.MONF[a.getMonth()]} ${a.getFullYear()}`};
  }
  return {from: c.start, to: t, label: `с ${B.fmt(c.start)}`};
}
function days(r){ const out = []; for (let d = r.from; d <= r.to; d = B.add(d, 1)) out.push(d); return out; }

function summary(list){
  const c = B.calc(), t = B.today();
  let xp = 0, good = 0, past = 0, read = 0, sport = 0, hv = 0, hn = 0;
  const hs = B.habits().filter(h => h.kind !== 'weekly');
  list.forEach(d => {
    const r = c.days[d]; if (!r) return;
    xp += r.xp;
    if (d <= t){ past++; if (r.review) good++; }
    read += B.readMin(d);
    if (d <= t) hs.forEach(h => { if (h.created && d < h.created) return; hn++; hv += B.habitVal(h, d); });
  });
  sport = B.workouts().filter(w => list.includes(w.date)).length;
  return {xp, good, past, read, sport, hab: hn ? hv / hn : 0};
}

function xpChart(list){
  const c = B.calc();
  let pts = list.map(d => ({k: d, v: (c.days[d] || {}).xp || 0, r: (c.days[d] || {}).result || '', l: B.parse(d).getDate()}));
  if (pts.length > 45){   // всё время: по неделям
    const by = {}; pts.forEach(p => { const w = B.weekStart(p.k); by[w] = by[w] || {k: w, v: 0, r: 'week', l: B.fmtS(w)}; by[w].v += p.v; });
    pts = Object.values(by);
  }
  const max = Math.max(50, ...pts.map(p => Math.abs(p.v)));
  const step = Math.ceil(pts.length / 8);
  return `<div class="bars ${pts.length > 10 ? 'dense' : ''}">${pts.map((p, i) => `<div class="bar-col r-${p.r}" title="${p.r === 'week' ? 'неделя с ' + p.l : B.fmtW(p.k)}: ${p.v > 0 ? '+' : ''}${p.v} XP">
    <span class="bv">${pts.length <= 10 && p.v ? p.v : ''}</span><span class="bw"><i style="height:${(Math.max(0, p.v) / max * 100).toFixed(1)}%"></i></span>
    <span class="bl">${pts.length <= 10 ? B.WD[B.wd(p.k)] : i % step === 0 ? p.l : ''}</span></div>`).join('')}</div>
    <div class="legend"><span><i class="lgd good"></i>с разбором</span><span><i class="lgd some"></i>без разбора</span><span><i class="lgd empty"></i>пустой</span></div>`;
}

function weekReview(r){
  const reasons = {};
  B.tasks().forEach(t => (t.postpones || []).forEach(p => { const d = B.dayOf(p.at); if (d >= r.from && d <= r.to) if (p.why) reasons[p.why] = (reasons[p.why] || 0) + 1; }));
  const top = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const doc = B.get('wk_' + r.from) || {};
  const c = B.calc(), list = days(r).filter(d => c.days[d]);
  const best = list.slice().sort((a, b) => c.days[b].xp - c.days[a].xp)[0];
  const ended = r.to < B.today() || B.wd(B.today()) >= 5;
  return `<section class="card">
    <h2>${icon('pen')}Разбор недели</h2>
    ${best ? `<p class="muted">Лучший день: ${B.WDF[B.wd(best)]}, ${c.days[best].xp} XP.</p>` : ''}
    ${top.length ? `<div class="sub-h">Почему переносил</div><ul class="plain dots">${top.map(([w, n]) => `<li>${esc(w)} <span class="muted">× ${n}</span></li>`).join('')}</ul>` : '<p class="muted">Переносов не было.</p>'}
    ${B.habits().length ? `<div class="sub-h">Привычки</div><div class="hrates">${B.habits().map(h => { let v = 0, n = 0; days(r).forEach(d => { if (d > B.today() || (h.created && d < h.created)) return; n++; v += B.habitVal(h, d); });
      const rate = h.kind === 'weekly' ? Math.min(1, v / (h.target || 3)) : n ? v / n : 0;
      return `<div class="hrate"><span>${esc(h.name)}</span>${B.bar(rate)}<b class="mono">${Math.round(rate * 100)}%</b></div>`; }).join('')}</div>` : ''}
    ${ended ? `<label class="field">Что меняю на следующей неделе<textarea rows="3" data-in="wkChange" data-w="${r.from}" placeholder="Одно-два конкретных изменения. Например: главные дела ставить на утро">${esc(doc.change || '')}</textarea></label>
      <p class="hint">Ответ будет висеть на главном экране всю следующую неделю.</p>` : '<p class="hint">Поле для плана на следующую неделю откроется в субботу.</p>'}
    <button class="btn ghost" data-act="aiWeek" data-week="${r.from}">${icon('sparkle')} Скопировать промпт за неделю</button>
  </section>`;
}
B.inputs.wkChange = el => B.put('wk_' + el.dataset.w, {change: el.value, at: Date.now()}, true);

/* лес на выбранный день */
function snapshot(date){
  const c = B.calc(), r = c.days[date];
  if (!r) return null;
  const lv = B.levelOf(r.total), ds = {};
  for (const k in c.days) if (k <= date) ds[k] = c.days[k];
  return {level: lv.L, frac: lv.frac, trees: lv.trees, days: ds};
}
function replayCard(){
  const c = B.calc(), all = Object.keys(c.days).sort();
  if (all.length < 2) return '';
  const i = replay == null ? all.length - 1 : Math.min(replay, all.length - 1), d = all[i], s = snapshot(d);
  return `<section class="card">
    <h2>${icon('tree')}Как рос лес</h2>
    <div class="row between"><span id="rpDate">${B.fmtW(d)}</span><b class="mono" id="rpH">${B.fmtTrees(s.trees)} · ур. ${s.level}</b></div>
    <div class="row"><button class="icon-btn" data-act="rpPlay" aria-label="Проиграть">${icon(playT ? 'pause' : 'play')}</button>
      <input type="range" class="grow" min="0" max="${all.length - 1}" value="${i}" data-in="rpSlide" aria-label="День"></div>
    <div class="scene-wrap mini" id="rpScene">${B.forestScene(s)}</div>
  </section>`;
}
function drawReplay(i){
  const c = B.calc(), all = Object.keys(c.days).sort(), d = all[i], s = snapshot(d);
  const box = B.$('#rpScene'); if (!box || !s) return;
  box.innerHTML = B.forestScene(s);
  B.$('#rpDate').textContent = B.fmtW(d); B.$('#rpH').textContent = `${B.fmtTrees(s.trees)} · ур. ${s.level}`;
}
B.inputs.rpSlide = el => { replay = +el.value; drawReplay(replay); };
B.acts.rpPlay = () => {
  if (playT){ clearInterval(playT); playT = null; B.render(); return; }
  const all = Object.keys(B.calc().days).sort();
  replay = (replay == null || replay >= all.length - 1) ? 0 : replay;
  B.render();
  playT = setInterval(() => {
    const sl = B.$('[data-in=rpSlide]');
    if (!sl || replay >= all.length - 1){ clearInterval(playT); playT = null; if (sl) B.render(); return; }
    replay++; sl.value = replay; drawReplay(replay);
  }, Math.max(40, Math.min(250, 6000 / all.length)));
};

B.views.stats = {
  title: 'Итоги',
  render(){
    const r = range(), list = days(r), s = summary(list);
    return `<div class="page stats-page">
      <header class="page-h"><div><div class="eyebrow">Итоги</div><h1>${esc(r.label)}</h1></div>
        <div class="row">${mode !== 'all' ? `<button class="icon-btn" data-act="stShift" data-k="-1" aria-label="Назад">${icon('left')}</button><button class="icon-btn" data-act="stShift" data-k="1" aria-label="Вперёд">${icon('right')}</button>` : ''}</div></header>
      <div class="toggle wide st-mode">${[['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="stMode" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="cols">
        <div class="col">
          <section class="card"><div class="kpis">
            <div class="kpi"><b>${s.good}/${s.past}</b><span>дней с разбором</span></div>
            <div class="kpi"><b>${s.xp > 0 ? '+' : ''}${B.num(s.xp)}</b><span>XP</span></div>
            <div class="kpi"><b>${B.mins(s.read)}</b><span>чтения</span></div>
            <div class="kpi"><b>${s.sport}</b><span>тренировок</span></div>
            <div class="kpi"><b>${Math.round(s.hab * 100)}%</b><span>ежедневных привычек</span></div>
          </div></section>
          <section class="card"><h2>${icon('chart')}Опыт по дням</h2>${xpChart(list)}</section>
          ${mode === 'week' ? weekReview(r) : ''}
        </div>
        <div class="col">${replayCard()}</div>
      </div>
    </div>`;
  },
  mount(){ const b = B.$('#rpScene'); if (b){ const all = Object.keys(B.calc().days).sort(); drawReplay(replay == null ? all.length - 1 : Math.min(replay, all.length - 1)); } }
};
B.acts.stMode = el => { mode = el.dataset.k; anchor = null; B.render(); };
B.acts.stShift = el => {
  const k = +el.dataset.k, r = range();
  if (mode === 'week') anchor = B.add(r.from, 7 * k);
  else { const a = B.parse(r.from); anchor = B.ymd(new Date(a.getFullYear(), a.getMonth() + k, 1, 12)); }
  B.render();
};
})();
