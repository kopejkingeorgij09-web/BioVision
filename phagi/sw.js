// Service worker: нужен, чтобы сайт можно было установить как приложение.
// Стратегия «сначала сеть»: всегда свежая версия, кеш только на случай отсутствия интернета.
// Запросы к другим доменам (Supabase, шрифты) не трогаем.
const CACHE = 'phagi-v2';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('./')).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('phagi-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Старые версии того же файла (dragons/ui.js?v=8, когда уже есть ?v=9) из кеша убираем, иначе он растёт с каждым обновлением.
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
  e.respondWith(fetch(r).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy).then(() => prune(c, u))); }
    return res;
  }).catch(() => caches.match(r, {ignoreSearch: r.mode === 'navigate'}).then(m => m || (r.mode === 'navigate' ? caches.match('./') : undefined)).then(m => m || Response.error())));
});
