// Service worker: нужен, чтобы сайт можно было установить как приложение.
// Стратегия «сначала сеть»: всегда свежая версия (no-cache мимо HTTP-кеша GitHub Pages на 10 минут), кеш только на случай отсутствия интернета.
// Запросы к другим доменам (Supabase, шрифты) не трогаем.
const CACHE = 'bamboo-v12';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('./')).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bamboo-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  e.respondWith(fetch(r, {cache: 'no-cache'}).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, {ignoreSearch: r.mode === 'navigate'}).then(m => m || (r.mode === 'navigate' ? caches.match('./') : undefined)).then(m => m || Response.error())));
});
