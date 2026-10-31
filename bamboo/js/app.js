/* Режим бамбука: оболочка. Навигация, адреса #/раздел[/параметр], тема, вход по коду, настройки, перерисовка. */
(function(){
const {esc, icon} = B;
const NAV = [
  ['today', 'Сегодня', 'today'], ['tasks', 'Задачи', 'list'], ['cal', 'Календарь', 'cal'], ['focus', 'Фокус', 'timer'],
  ['habits', 'Привычки', 'habit'], ['read', 'Чтение', 'book'], ['sport', 'Спорт', 'dumbbell'], ['journal', 'Дневник', 'pen'],
  ['bamboo', 'Бамбук', 'bamboo'], ['stats', 'Итоги', 'chart'], ['settings', 'Настройки', 'gear']
];
const BOTTOM = ['today', 'tasks', 'cal', 'focus'];

/* ---------- тема ---------- */
const LS_THEME = 'bamboo-theme';
function applyTheme(){
  let t = 'auto'; try { t = localStorage.getItem(LS_THEME) || 'auto'; } catch (e) {}
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#151A14' : '#F4EFE4';
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
B.acts.theme = el => { try { localStorage.setItem(LS_THEME, el.dataset.v); } catch (e) {} applyTheme(); B.render(); };

/* ---------- маршрут ---------- */
/* ярлыки Android (долгое нажатие на иконку) и «Поделиться»: открывают быстрый ввод поверх «Сегодня» */
function capture(text, kind){
  B.sheet(`<h2>${kind === 'think' ? 'Мысль' : 'Быстрый ввод'}</h2>
    <textarea id="capText" rows="4" placeholder="${kind === 'think' ? 'Что в голове' : 'Задача: «сдать лабу пт #физика !1» или мысль'}" autofocus>${esc(text || '')}</textarea>
    <p class="hint">${B.quickHint}</p>
    <div class="row end"><button class="btn ${kind === 'think' ? 'primary' : ''}" data-act="capThink">${icon('quote')} В мысли</button><button class="btn ${kind === 'think' ? '' : 'primary'}" data-act="capTask">${icon('plus')} Задача</button></div>`);
  setTimeout(() => { const t = B.$('#capText'); if (t){ t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 120);
}
B.acts.capTask = () => { const v = B.$('#capText').value.trim(); if (!v) return; const tk = B.addQuick(v.split('\n')[0], {}); B.closeSheet(); if (tk) B.toast('Задача: ' + esc(tk.title)); };
B.acts.capThink = () => { const v = B.$('#capText').value.trim(); if (!v) return; B.editDay(B.today(), d => { d.notes = (d.notes || []).concat({t: v, at: Date.now()}); }); B.closeSheet(); B.toast('Мысль записана в дневник'); };
function special(){
  const h = location.hash;
  if (h === '#/new' || h === '#/think'){ history.replaceState(null, '', '#/today'); B.render(true); capture('', h === '#/think' ? 'think' : 'task'); return true; }
  if (h === '#/focus/start'){ history.replaceState(null, '', '#/focus'); B.startFocus(null, null); return true; }
  return false;
}
function shared(){
  const q = new URLSearchParams(location.search);
  if (!q.has('text') && !q.has('title') && !q.has('url')) return;
  const text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join('\n');
  history.replaceState(null, '', location.pathname + '#/today');
  B.render(true); capture(text, 'task');
}

function route(){
  const h = (location.hash || '#/today').replace(/^#\/?/, '').split('/');
  const v = B.views[h[0]] ? h[0] : 'today';
  return {v, arg: h[1] ? decodeURIComponent(h[1]) : ''};
}
let lastKey = '', pending = false;
B.render = force => {
  const main = document.getElementById('main');
  const a = document.activeElement;
  if (force === true && a && main.contains(a)) a.blur();
  else if (a && main.contains(a) && a.matches('input:not([type=checkbox]):not([type=radio]),textarea,select')) { pending = true; return; }
  pending = false;
  const r = route(), key = r.v + '/' + r.arg, same = key === lastKey, y = scrollY;
  const view = B.views[r.v];
  try { main.innerHTML = view.render(r.arg); }
  catch (e) { console.error(e); main.innerHTML = `<div class="page"><section class="card"><h2>Что-то сломалось</h2><pre>${esc(e.stack || e)}</pre></section></div>`; }
  if (view.mount) try { view.mount(r.arg); } catch (e) { console.error(e); }
  if (same) scrollTo(0, y); else { scrollTo(0, 0); lastKey = key; }
  shell(r);
  if (B.timerTick) B.timerTick();
};
document.getElementById('main').addEventListener('focusout', () => setTimeout(() => {
  const a = document.activeElement, main = document.getElementById('main');
  if (pending && !(a && main.contains(a) && a.matches('input,textarea,select'))) B.render();
}, 0));
addEventListener('hashchange', () => { if (special()) return; if (B.sheetOpen()) B.closeSheet(); B.render(true); });
B.on('change', () => B.render());
B.on('sync', () => shell(route()));

/* ---------- каркас: боковая панель, нижнее меню, шапка ---------- */
function shell(r){
  const c = B.calc();
  const side = document.getElementById('side');
  side.innerHTML = `<a class="brand" href="#/today">${icon('bamboo')}<span><b>Режим бамбука</b><small>уровень ${c.level} · ${B.fmtH(c.height)}</small></span></a>
    <nav>${NAV.map(([k, l, ic]) => `<a class="nav-i ${r.v === k ? 'on' : ''}" href="#/${k}">${icon(ic)}<span>${l}</span>${k === 'today' && c.live ? `<em>${icon('flame')}${c.live}</em>` : ''}</a>`).join('')}</nav>
    <div class="side-foot"><span class="sync ${B.sync.mode}"><i></i>${esc(B.sync.text)}</span></div>`;
  const more = !BOTTOM.includes(r.v);
  document.getElementById('bottom').innerHTML = BOTTOM.map(k => { const n = NAV.find(x => x[0] === k); return `<a class="bn ${r.v === k ? 'on' : ''}" href="#/${k}">${icon(n[2])}<span>${n[1]}</span></a>`; }).join('')
    + `<button class="bn ${more ? 'on' : ''}" data-act="more">${icon('more')}<span>${more ? (NAV.find(x => x[0] === r.v) || [0, 'Ещё'])[1] : 'Ещё'}</span></button>`;
  const tb = document.getElementById('topbar');
  tb.querySelector('.tb-lvl').innerHTML = `${icon('flame')}<b>${c.live}</b><span class="tb-sep"></span><b>${c.level}</b><small>ур.</small>`;
  tb.querySelector('.tb-sync').className = 'tb-sync sync ' + B.sync.mode;
  tb.querySelector('.tb-sync').title = B.sync.text;
}
B.acts.more = () => B.sheet(`<h2>Разделы</h2><div class="more-grid">${NAV.filter(n => !BOTTOM.includes(n[0])).map(([k, l, ic]) => `<a class="more-i" href="#/${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</div>`);

/* ---------- настройки ---------- */
B.views.settings = {
  title: 'Настройки',
  render(){
    const cfg = B.cfg(), me = window.BVAUTH && BVAUTH.me;
    let theme = 'auto'; try { theme = localStorage.getItem(LS_THEME) || 'auto'; } catch (e) {}
    return `<div class="page settings-page">
      <header class="page-h"><div><div class="eyebrow">Настройки</div><h1>Режим бамбука</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card">
            <h2>${icon('cloud')}Синхронизация</h2>
            <p><span class="sync ${B.sync.mode}"><i></i>${esc(B.sync.text)}</span></p>
            ${B.cloud ? `<p class="muted">Вход выполнен: ${esc(me ? me.name : '')}. Все записи хранятся в облаке и одинаковы на телефоне и ноутбуке. Копия есть и на устройстве, без интернета всё работает и досылается потом.</p>
              <button class="btn ghost" data-act="logout">${icon('out')} Выйти на этом устройстве</button>`
            : `<p class="muted">Войди тем же кодом учителя, что и в трекере ШАДа. Записи с этого устройства уйдут в облако.</p>
              <div class="add-line"><input id="code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="T-XXXX-XXXX-XXXX-XXXX" data-enter="login"><button class="btn primary" data-act="login">${icon('key')} Войти</button></div>
              <p class="hint" id="loginMsg" aria-live="polite"></p>`}
          </section>
          <section class="card">
            <h2>${icon('sun')}Тема</h2>
            <div class="toggle wide">${[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, l]) => `<button class="${theme === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div>
          </section>
          <section class="card">
            <h2>${icon('star')}Цели</h2>
            <div class="ed-grid">
              <label>Чтение, мин в день<input type="number" min="5" max="600" value="${cfg.readGoal}" data-in="cfgNum" data-k="readGoal"></label>
              <label>Тренировок в неделю<input type="number" min="1" max="14" value="${cfg.sportGoal}" data-in="cfgNum" data-k="sportGoal"></label>
            </div>
            <p class="hint">Цель по чтению меняет и порог привычки «Чтение». Отсчёт опыта идёт с ${B.fmt(cfg.start)}.</p>
          </section>
        </div>
        <div class="col">
          <section class="card">
            <h2>${icon('copy')}Резервная копия</h2>
            <p class="muted">Файл со всеми задачами, привычками, книгами, тренировками и дневником.</p>
            <div class="row"><button class="btn" data-act="export">Скачать копию</button><label class="btn ghost">Загрузить из файла<input type="file" accept="application/json,.json" data-in="import" hidden></label></div>
          </section>
          <section class="card">
            <h2>${icon('chart')}ШАД</h2>
            <p class="muted">Вебы и ДЗ берутся из плана трекера ШАДа${B.shad.plan.length ? ` (${B.shad.plan.length} вебов)` : ''}, отметки общие: поставил стадию здесь, она видна и там.</p>
            <a class="btn ghost" href="../shad/">Открыть трекер ШАДа</a>
          </section>
          <section class="card">
            <h2>${icon('leaf')}На телефон</h2>
            <p class="muted">Открой сайт в Safari или Chrome и выбери «На экран Домой» (iPhone) или «Установить приложение» (Android). Режим бамбука откроется как отдельное приложение.</p>
          </section>
        </div>
      </div>
    </div>`;
  }
};
B.inputs.cfgNum = (el, e) => {
  if (e.type !== 'change') return;
  const v = +el.value; if (!v) return;
  B.setCfg({[el.dataset.k]: v});
  if (el.dataset.k === 'readGoal'){ const h = B.get('h_read'); if (h) B.put('h_read', Object.assign({}, h, {min: v})); }
  if (el.dataset.k === 'sportGoal'){ const h = B.get('h_sport'); if (h) B.put('h_sport', Object.assign({}, h, {target: v})); }
};
B.acts.login = async () => {
  const msg = B.$('#loginMsg'); msg.textContent = 'Проверяю…';
  try {
    const r = await BVAUTH.login(B.$('#code').value);
    if (r.role !== 'admin'){ BVAUTH.logout(); msg.textContent = 'Это код ученика. Нужен код учителя.'; return; }
    msg.textContent = 'Готово, подключаюсь к облаку…';
    location.reload();
  } catch (e) { msg.textContent = e.message; }
};
B.acts.logout = async () => {
  if (!(await B.confirm('Выйти на этом устройстве? Записи останутся в облаке, а здесь будут храниться только локально.', 'Выйти'))) return;
  BVAUTH.logout(); location.reload();
};
B.acts.export = async () => {
  const data = JSON.stringify(B.exportAll(), null, 1);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
  a.download = `bamboo-${B.today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
};
B.inputs.import = async (el, e) => {
  if (e.type !== 'change' || !el.files[0]) return;
  try {
    const obj = JSON.parse(await el.files[0].text());
    if (!(await B.confirm(`Загрузить ${Object.keys(obj.docs || {}).length} записей из файла? Совпадающие записи заменятся.`, 'Загрузить'))) return;
    B.importAll(obj); B.toast('Копия загружена');
  } catch (err) { B.toast(esc(err.message)); }
};

/* ---------- старт ---------- */
B.render();
B.connect().then(() => { B.render(); if (!special()) shared(); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
/* новый день наступает в 4 утра: перерисовать, если вкладка висела открытой */
let lastDay = B.today();
setInterval(() => { if (B.today() !== lastDay){ lastDay = B.today(); B.render(); } }, 60000);
})();
