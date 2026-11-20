// Service worker: нужен, чтобы сайт можно было установить как приложение.
// Стратегия «сначала сеть»: всегда свежая версия, кеш только на случай отсутствия интернета.
// Запросы к другим доменам (Supabase, шрифты) не трогаем.
const CACHE = 'phagi-v36-oplot-circle-defense';
const SHELL = ['./', './cloud.js?v=16', './oplot.html?v=14', './oplot-layout.js?v=5', './oplot-limits.js?v=4', './oplot-editor.js?v=4', './oplot-art/village.js?v=4', './oplot-art/stores.js?v=3', './oplot-art/defenses.js?v=2', './lesson-workspace.js?v=1', './prepare-lesson.js?v=1',
  './lesson-files.js?v=2', './lesson-workspace.css?v=1', './forest/progress.js?v=1', './forest/scene.js?v=1', './forest/forest.css?v=1'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('phagi-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Старые версии того же файла из кеша убираем, иначе он растёт с каждым обновлением.
// Убираем только после того, как новая версия скачана и легла в кеш, поэтому без сети остаётся последняя рабочая.
function prune(c, u) {
  if (!u.search) return;
  return c.keys().then(ks => Promise.all(ks.filter(k => { const x = new URL(k.url); return x.pathname === u.pathname && x.search !== u.search; }).map(k => c.delete(k)))).catch(() => {});
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  // страницу всегда сверяем с сервером (у GitHub Pages кеш браузера на 10 минут), скрипты и картинки берутся как обычно
  const go = r.mode === 'navigate' ? fetch(r.url, {cache: 'no-cache', credentials: 'same-origin'}) : fetch(r);
  e.respondWith(go.then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy).then(() => prune(c, u))); }
    return res;
  }).catch(() => caches.match(r, {ignoreSearch: r.mode === 'navigate'}).then(m => m || (r.mode === 'navigate' ? caches.match('./') : undefined)).then(m => m || Response.error())));
});
