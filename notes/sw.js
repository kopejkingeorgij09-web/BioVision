// Версия приходит из app.js (register('./sw.js?v=…')), поэтому новый выпуск всегда ставит новый кеш.
const version = new URL(location.href).searchParams.get('v') || 'dev';
const shell = 'biovision-notes-shell-' + version;
const pdfjs = 'biovision-notes-pdfjs-6.5.438';
const assets = 'biovision-notes-assets-v1';
const files = [
  './', './index.html', './style.css', './icon.svg', './manifest.webmanifest',
  './js/app.js', './js/backup.js', './js/cloud.js', './js/config.js', './js/ink.js', './js/local.js', './js/media.js', './js/merge.js',
  './js/text.js', './js/pen-button.js', './js/utilities.js', './js/board-map.js', './js/note-search.js',
];
const vendor = /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex@0\.19\.1\//;
const scopePath = () => new URL(self.registration.scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(shell).then(cache => cache.addAll(files.map(file => new Request(file, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => (name.startsWith('biovision-notes-shell-') && name !== shell)
      || (name.startsWith('biovision-notes-pdfjs-') && name !== pdfjs)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone()).catch(() => {});
  return response;
}

// Оболочка: сразу из кеша, а в фоне берём свежую копию. Правка app.js без смены версии
// доходит до пользователя со следующего запуска, а не застревает навсегда.
async function staleWhileRevalidate(event, key) {
  const cache = await caches.open(shell);
  const cached = await cache.match(key);
  // Навигационный запрос нельзя пересоздать с параметрами, поэтому для него берём index.html по адресу.
  const network = fetch(typeof key === 'string' ? key : event.request, { cache: 'no-cache' }).then(async response => {
    if (response.ok && response.type === 'basic') await cache.put(key, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (vendor.test(request.url)) { event.respondWith(cacheFirst(assets, request)); return; }
  if (url.origin !== location.origin || !url.pathname.startsWith(scopePath())) return;
  if (url.pathname.startsWith(scopePath() + 'vendor/pdfjs/')) { event.respondWith(cacheFirst(pdfjs, request)); return; }
  if (request.mode === 'navigate') { event.respondWith(staleWhileRevalidate(event, './index.html')); return; }
  event.respondWith(staleWhileRevalidate(event, request));
});
