const shell = 'biovision-notes-shell-v1';
const assets = 'biovision-notes-assets-v1';
const files = [
  './', './index.html', './style.css', './icon.svg', './manifest.webmanifest',
  './js/app.js', './js/cloud.js', './js/config.js', './js/ink.js', './js/local.js', './js/media.js', './js/text.js',
];
const vendor = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:katex@0\.19\.1|pdfjs-dist@6\.5\.438)\//;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(shell).then(cache => cache.addAll(files)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('biovision-notes-shell-') && name !== shell).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (vendor.test(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(assets);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone()).catch(() => {});
      return response;
    })());
    return;
  }
  if (url.origin !== location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(shell);
    if (request.mode === 'navigate') return await cache.match('./index.html') || fetch(request);
    return await cache.match(request) || fetch(request);
  })());
});
