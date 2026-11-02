// Service worker БиоВиза: установка как приложения и работа без интернета.
// Файлы с версией в адресе (?v=…) не меняются, поэтому берутся из кеша сразу: так быстрее на слабой связи.
// Остальное (страница, cloud.js, картинки) сначала из сети; если сеть молчит дольше 4 секунд или её нет, из кеша.
// Шрифты Google берутся из кеша и тихо обновляются. Облако (Supabase), 3D-модели и видео не кешируются.
// Список файлов для работы без интернета присылает страница (bioviz/core/offline.js).
const CACHE = 'bioviz-v3';
const FONTS = 'bioviz-fonts';
const SLOW = 4000;

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('./')).catch(() => {})); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bioviz-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const put = (name, req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(name).then(c => c.put(req, copy)).catch(() => {}); } return res; };

function cacheFirst(r) {
  return caches.match(r).then(m => m || fetch(r).then(res => res.type === 'basic' ? put(CACHE, r, res) : res));
}
function fonts(r) {
  return caches.open(FONTS).then(c => c.match(r).then(m => {
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => m || Response.error());
    return m || net;
  }));
}
function networkFirst(r) {
  const nav = r.mode === 'navigate';
  const cached = () => caches.match(r, {ignoreSearch: nav}).then(m => m || (nav ? caches.match('./') : undefined));
  return new Promise(done => {
    let settled = false;
    const finish = v => { if (!settled && v) { settled = true; done(v); } };
    const net = fetch(r).then(res => { if (res.ok && res.type === 'basic') put(CACHE, r, res); return res; });
    net.then(finish, () => cached().then(m => { if (m) finish(m); else { settled = true; done(Response.error()); } }));
    /* связь есть, но очень медленная: отдаём сохранённую копию, а свежая всё равно ляжет в кеш */
    setTimeout(() => { if (!settled) cached().then(finish); }, SLOW);
  });
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(fonts(r)); return; }
  if (u.origin !== location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (u.searchParams.has('v') && !u.searchParams.has('r')) { e.respondWith(cacheFirst(r)); return; }
  e.respondWith(networkFirst(r));
});
