/* Android keeps its own alarm schedule even when this WebView is closed. */
(() => {
  const bridge = window.ZovReminder;
  if (!bridge || !window.B) return;
  const C = B.calData;
  const send = (op, extra) => bridge.postMessage(JSON.stringify({op, ...extra}));
  const validMinutes = value => Number.isInteger(value) && value >= 0 && value <= 525600;
  const horizon = 366;
  let status = null, lastPayload = '', timer;

  function sync(){
    clearTimeout(timer);
    const now = Date.now(), today = B.ymd(new Date(now)), items = [];
    const add = (kind, id, date, start, before, title) => {
      const at = new Date(start).getTime() - before * C.MIN;
      if (at >= now - C.DAY * C.MIN)
        items.push({at, kind, id, date, start, before, title: String(title || '').slice(0, 160)});
    };
    for (const t of B.tasks()){
      const start = t.remind?.at;
      if (!t.done && C.valid(start) && start.length === 16)
        add('task', t.id, t.due || '', start, 0, t.title);
    }
    for (const e of C.events()){
      const alerts = Array.isArray(e.alerts) ? e.alerts.filter(validMinutes) : [];
      if (!alerts.length) continue;
      const until = B.add(today, horizon + Math.ceil(Math.max(...alerts) / C.DAY));
      const occurrences = e.repeat ? C.occurrences(e, B.add(today, -1), until) : [e];
      for (const x of occurrences){
        const date = C.dateOf(x.start), start = x.start.length === 10 ? x.start + 'T09:00' : x.start;
        for (const minutes of alerts) add('event', e.id, date, start, minutes, x.title);
      }
    }
    const nearest = items.sort((a, b) => a.at - b.at).slice(0, 1800).map(({at, ...item}) => item);
    const payload = JSON.stringify({op: 'sync', items: nearest});
    if (payload === lastPayload) return;
    bridge.postMessage(payload);
    lastPayload = payload;
  }

  function queue(){
    clearTimeout(timer);
    timer = setTimeout(sync, 120);
  }

  function refresh(){
    sync();
    send('status');
  }

  let pendingOpen = null, openTimer;
  function tryPending(){
    if (!pendingOpen || location.hash !== pendingOpen.hash) return;
    if (pendingOpen.show()) { pendingOpen = null; clearTimeout(openTimer); }
  }
  B.on('change', tryPending);
  function open({kind, id, date}){
    const hash = kind === 'page' ? '#/' + id : kind === 'event' ? '#/tasks/calendar' : '#/tasks/week';
    const show = () => {
      if (kind === 'page') return true;
      if (kind === 'shad') { if (!B.shad.plan.some(p=>p.n===+id)) return false; B.acts.shadOpen({dataset:{n:id}}); return true; }
      if (kind === 'event') return B.calendarView.openReminder(id, date);
      const t = B.task(id);
      if (!t || t.deleted) return false;
      B.openTask(id);
      return true;
    };
    pendingOpen = {hash, show};
    clearTimeout(openTimer);
    openTimer = setTimeout(() => {
      if (pendingOpen) { pendingOpen = null; B.toast('Запись больше недоступна. Проверь синхронизацию.'); }
    }, 15000);
    if (location.hash === hash) tryPending();
    else { addEventListener('hashchange', tryPending, {once:true}); location.hash=hash; }
  }

  bridge.onmessage = ({data}) => {
    const next = JSON.parse(data);
    const changed = status?.enabled !== next.enabled || status?.exact !== next.exact;
    status = next;
    if (changed && location.hash.startsWith('#/settings')) B.render();
    if (next.open) open(next.open);
  };

  function settings(){
    return `<section class="card">
      <h2>${B.icon('bell')}Уведомления Android</h2>
      <p class="muted">${!status ? 'Проверяю разрешения…' : status.enabled
        ? 'Напоминания о задачах и событиях приходят и при закрытом приложении.'
        : 'Разреши уведомления, чтобы получать напоминания о задачах и событиях.'}</p>
      ${status ? `<div class="row wrap">
        ${status.enabled ? '<button class="btn" data-act="androidTestReminder">Проверить через 15 секунд</button>'
          : '<button class="btn primary" data-act="androidEnableReminders">Разрешить уведомления</button>'}
        ${status.enabled && !status.exact ? '<button class="btn ghost" data-act="androidExactReminders">Разрешить точное время</button>' : ''}
      </div>` : ''}
      ${status?.enabled && !status.exact ? '<p class="hint">Без разрешения на точное время Android может задерживать напоминания.</p>' : ''}
      <p class="hint">Для проверки закрой приложение и дождись уведомления.</p>
      <h2>Виджеты рабочего стола</h2>
      <div class="row wrap"><button class="btn" data-act="androidPinToday">Дела на сегодня</button><button class="btn" data-act="androidPinAgenda">Ближайшие события</button><button class="btn" data-act="androidPinShadToday">ШАД сегодня</button><button class="btn" data-act="androidPinShadProgress">Прогресс ШАДа</button><button class="btn" data-act="androidPinAlberts">Альбертс</button></div>
      <p class="hint">Нажатие на запись открывает её в приложении. Виджеты обновляются после синхронизации; без сети показывают сохранённые данные. Их также можно добавить через меню виджетов Android.</p>
    </section>`;
  }

  function eventField(e){
    const current = e.alerts?.[0] ?? '';
    const times = new Map([['','Без напоминания'], [0,'В момент начала'], [5,'За 5 минут'], [15,'За 15 минут'],
      [30,'За 30 минут'], [60,'За час'], [1440,'За день']]);
    if (!times.has(current) && validMinutes(current)) times.set(current, 'За ' + current + ' мин.');
    return `<label class="field">Уведомление Android<select name="androidAlert" data-current="${B.esc(current)}">${[...times]
      .map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
  }

  function eventAlerts(select, e){
    return select.value === select.dataset.current ? e.alerts || [] : select.value === '' ? [] : [Number(select.value)];
  }

  const enable = () => { if (!status?.enabled) send('enable'); };
  B.androidReminders = {refresh, queue, enable, settings, eventField, eventAlerts};
  B.acts.androidEnableReminders = enable;
  B.acts.androidExactReminders = () => send('exact');
  B.acts.androidTestReminder = () => { send('test'); B.toast('Уведомление через 15 секунд. Можно закрыть приложение.'); };
  B.acts.androidPinToday = () => send('pinToday');
  B.acts.androidPinAgenda = () => send('pinAgenda');
  B.acts.androidPinShadToday = () => send('pinShadToday');
  B.acts.androidPinShadProgress = () => send('pinShadProgress');
  B.acts.androidPinAlberts = () => send('pinAlberts');
  B.acts.androidClearPrivate = () => send('clear');
  B.on('change', queue);
  document.addEventListener('visibilitychange', () => document.hidden ? sync() : refresh());
  refresh();
})();
