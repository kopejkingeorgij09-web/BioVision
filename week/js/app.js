/* Зов леса: оболочка. Навигация, адреса #/раздел[/параметр], тема, вход по коду, настройки, перерисовка. */
(function(){
const {esc, icon} = B;
const NAV = [['tasks', 'Задачи', 'list'], ['search', 'Поиск', 'search'], ['settings', 'Настройки', 'gear']];
const FOOT = ['search', 'settings'];
const BOTTOM = ['tasks', 'search', 'settings'];

/* ---------- тема ---------- */
const LS_THEME = 'week-theme';
function applyTheme(){
  let t = 'auto'; try { t = localStorage.getItem(LS_THEME) || 'auto'; } catch (e) {}
  if (t === 'sakura'){ t = 'light'; try { localStorage.setItem(LS_THEME, t); } catch (e) {} }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || t === 'night' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'night' ? '#0B1A14' : t === 'day' ? '#EAF0E4' : dark ? '#151A14' : '#F4EFE4';
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); if (B.render) B.render(); });
const THEMES = [['light', 'Бумага', '#F4EFE4'], ['dark', 'Тёмная', '#1B211A'], ['night', 'Ночной лес', '#123024'], ['day', 'Лесной день', '#C9D9BE'], ['auto', 'Как в системе', '']];
const curTheme = () => { try { return localStorage.getItem(LS_THEME) || 'auto'; } catch (e) { return 'auto'; } };
const isDark = () => { const t = curTheme(); return t === 'dark' || t === 'night' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); };
const setTheme = v => { try { localStorage.setItem(LS_THEME, v); } catch (e) {} applyTheme(); B.render(); };
B.acts.theme = el => { setTheme(el.dataset.v); B.$$('.swatches .sw').forEach(x => x.classList.toggle('on', x.dataset.v === el.dataset.v)); };
/* кнопка в шапке: по кругу Бумага → Тёмная → Ночной лес → Лесной день → как в системе */
B.acts.themeNext = () => {
  const i = THEMES.findIndex(x => x[0] === curTheme()), n = THEMES[(i + 1) % THEMES.length];
  setTheme(n[0]); B.toast(`Тема: ${n[1]}`, 1200);
};
const swatches = () => `<div class="swatches" role="group" aria-label="Тема">${THEMES.map(([k, l, c]) => `<button class="sw ${curTheme() === k ? 'on' : ''} ${k === 'auto' ? 'auto' : ''}" data-act="theme" data-v="${k}" title="${l}" aria-label="${l}" style="${c ? '--sw:' + c : ''}"></button>`).join('')}</div>`;

/* ---------- маршрут ---------- */
/* ярлыки Android (долгое нажатие на иконку) и «Поделиться»: открывают быстрый ввод поверх «Сегодня» */
function capture(text, kind){
  B.sheet(`<h2>${kind === 'think' ? 'Мысль' : 'Быстрый ввод'}</h2>
    <textarea id="capText" rows="4" placeholder="${kind === 'think' ? 'Что в голове' : 'Задача: «сдать лабу пт #физика !1» или мысль'}" autofocus>${esc(text || '')}</textarea>
    <p class="hint">${B.quickHint}</p>
    <div class="row end"><button class="btn ${kind === 'think' ? '' : 'primary'}" data-act="capTask">${icon('plus')} Задача</button></div>`);
  setTimeout(() => { const t = B.$('#capText'); if (t){ t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 120);
}
B.acts.capTask = () => { const v = B.$('#capText').value.trim(); if (!v) return; const tk = B.addQuick(v.split('\n')[0], {}); B.closeSheet(); if (tk) B.toast('Задача: ' + esc(tk.title)); };
B.acts.capThink = () => { const v = B.$('#capText').value.trim(); if (!v) return; B.editDay(B.today(), d => { d.notes = (d.notes || []).concat({t: v, at: Date.now()}); }); B.closeSheet(); B.toast('Мысль записана в дневник'); };
function special(){
  const h = location.hash;
  if (h === '#/new' || h === '#/think'){ history.replaceState(null, '', '#/tasks'); B.render(true); capture('', h === '#/think' ? 'think' : 'task'); return true; }
  return false;
}
function shared(){
  const q = new URLSearchParams(location.search);
  if (!q.has('text') && !q.has('title') && !q.has('url')) return;
  const text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join('\n');
  history.replaceState(null, '', location.pathname + '#/tasks');
  B.render(true); capture(text, 'task');
}

function route(){
  const h = (location.hash || '#/tasks').replace(/^#\/?/, '').split('/');
  // раздела «Календарь» больше нет: месяц живёт в «Задачах», итоги дня в «Дневнике»; старые ссылки ведут туда
  if (h[0] === 'cal'){ h.splice(0, 2, ...(/^\d{4}-\d\d-\d\d$/.test(h[1] || '') ? ['journal', h[1]] : ['tasks', 'month'])); history.replaceState(null, '', location.pathname + '#/' + h.join('/')); }
  const v = B.views[h[0]] ? h[0] : 'tasks';
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
};
document.getElementById('main').addEventListener('focusout', () => setTimeout(() => {
  const a = document.activeElement, main = document.getElementById('main');
  if (pending && !(a && main.contains(a) && a.matches('input,textarea,select'))) B.render();
}, 0));
addEventListener('hashchange', () => { if (special()) return; if (B.sheetOpen()) B.closeSheet(); B.render(true); });
B.on('change', () => B.render());
B.on('sync', () => shell(route()));

/* ---------- каркас: боковая панель, нижнее меню, шапка ---------- */
/* «Итоги» живут вкладкой внутри «Дневника»: в меню подсвечивается «Дневник» */
const navKey = v => v === 'stats' ? 'journal' : v;
function shell(r){
  r = Object.assign({}, r, {v: navKey(r.v)});
  document.body.classList.toggle('pl-wide', r.v === 'tasks' && !!B.plWide);
  const side = document.getElementById('side');
  side.innerHTML = `<a class="brand" href="#/tasks">${icon('tree')}<span><b>Неделя</b><small>планер задач</small></span></a>
    <nav>${NAV.filter(n => !FOOT.includes(n[0])).map(([k, l, ic]) => `<a class="nav-i ${r.v === k ? 'on' : ''}" href="#/${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <div class="side-foot">
      ${swatches()}
      <div class="row">${FOOT.map(k => { const n = NAV.find(x => x[0] === k); return `<a class="nav-i sm ${r.v === k ? 'on' : ''}" href="#/${k}" title="${n[1]}">${icon(n[2])}<span>${n[1]}</span></a>`; }).join('')}</div>
      <span class="sync ${B.sync.mode}"><i></i>${esc(B.sync.text)}</span>
    </div>`;
  const more = !BOTTOM.includes(r.v);
  document.getElementById('bottom').innerHTML = BOTTOM.map(k => { const n = NAV.find(x => x[0] === k); return `<a class="bn ${r.v === k ? 'on' : ''}" href="#/${k}">${icon(n[2])}<span>${n[1]}</span></a>`; }).join('')
    ;
  const tb = document.getElementById('topbar');
  tb.querySelector('.tb-sync').className = 'tb-sync sync ' + B.sync.mode;
  tb.querySelector('.tb-sync').title = B.sync.text;
  const th = tb.querySelector('.tb-theme'); if (th) th.innerHTML = icon(isDark() ? 'sun' : 'moon');
}
B.acts.more = () => B.sheet(`<h2>Разделы</h2><div class="more-grid">${NAV.filter(n => !BOTTOM.includes(n[0])).map(([k, l, ic]) => `<a class="more-i" href="#/${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</div>
  <div class="sub-h">Тема</div>${swatches()}`);

/* ---------- настройки ---------- */
B.views.settings = {
  title: 'Настройки',
  render(){
    let theme = 'auto'; try { theme = localStorage.getItem(LS_THEME) || 'auto'; } catch (e) {}
    return `<div class="page settings-page">
      <header class="page-h"><div><div class="eyebrow">Настройки</div><h1>Неделя</h1></div></header>
      <div class="cols">
        <div class="col">
          <section class="card">
            <h2>${icon('sun')}Тема</h2>
            <div class="toggle wide themes">${THEMES.map(([k, l]) => `<button class="${theme === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div>
            <p class="hint">Быстро сменить тему можно кнопкой ${isDark() ? 'с солнцем' : 'с луной'} в шапке на телефоне или кружками внизу боковой панели на компьютере.</p>
          </section>
          <section class="card">
            <h2>${icon('key')}Где хранятся задачи</h2>
            <p class="muted">Только в этом браузере на этом устройстве. Никуда не отправляются, регистрация не нужна. Чтобы перенести задачи на другое устройство или не потерять их при очистке браузера, скачай резервную копию.</p>
          </section>
        </div>
        <div class="col">
          <section class="card">
            <h2>${icon('copy')}Резервная копия</h2>
            <p class="muted">Файл со всеми задачами и календарями.</p>
            <div class="row"><button class="btn" data-act="export">Скачать копию</button><label class="btn ghost">Загрузить из файла<input type="file" accept="application/json,.json" data-in="import" hidden></label></div>
          </section>
          <section class="card">
            <h2>${icon('leaf')}На телефон</h2>
            <p class="muted">Открой сайт в Safari или Chrome и выбери «На экран Домой» (iPhone) или «Установить приложение» (Android). Неделя откроется как отдельное приложение.</p>
          </section>
          <section class="card">
            <h2>${icon('list')}Клавиши</h2>
            <p class="muted">На компьютере нажми «?», чтобы увидеть все сочетания.</p>
            <button class="btn ghost" data-act="keysHelp">Показать клавиши</button>
          </section>
        </div>
      </div>
    </div>`;
  }
};
B.acts.export = async () => {
  const data = JSON.stringify(B.exportAll(), null, 1);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
  a.download = `nedelya-${B.today()}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
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
B.connect().then(() => { B.clearUndo(); B.render(); if (!special()) shared(); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
/* новый день наступает в 4 утра: перерисовать, если вкладка висела открытой */
let lastDay = B.today();
setInterval(() => { if (B.today() !== lastDay){ lastDay = B.today(); B.render(); } }, 60000);
})();
