// Service worker: нужен, чтобы сайт можно было установить как приложение.
// Версионированные ресурсы (?v=...) отдаются сразу из кеша для быстрого старта; HTML и JSON идут сначала в сеть (no-cache мимо кеша GitHub Pages).
// Запросы к другим доменам (Supabase, шрифты) не трогаем.
const CACHE = 'zov-lesa-v21';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('./')).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('bamboo-') || k.startsWith('zov-lesa-')) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  const versioned = u.searchParams.has('v') && !u.pathname.endsWith('.json') && r.mode !== 'navigate';
  const net = () => fetch(r, {cache: 'no-cache'}).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  });
  if (versioned){
    e.respondWith(caches.match(r).then(hit => hit || net()).catch(() => Response.error()));
    return;
  }
  e.respondWith(net().catch(() => caches.match(r, {ignoreSearch: r.mode === 'navigate'}).then(m => m || (r.mode === 'navigate' ? caches.match('./') : undefined)).then(m => m || Response.error())));
});
