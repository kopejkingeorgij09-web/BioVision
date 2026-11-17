/* Exercise course navigation with the real worker code. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('sw.js', 'utf8');
const scope = 'https://example.test/BioVision/';
const old = "const BV_VER='old';";
const fresh = "const BV_VER='new';";

function visit(cached) {
  const listeners = {};
  const messages = [];
  const background = [];
  const timers = new Set();
  let result, resolveFetch, rejectFetch, requested;
  let saved = cached;
  const pending = new Promise((resolve, reject) => {
    resolveFetch = resolve;
    rejectFetch = reject;
  });
  vm.runInNewContext(source, {
    URL, Request, Response, Promise,
    setTimeout(callback) { timers.add(callback); return callback; },
    clearTimeout(callback) { timers.delete(callback); },
    location: { origin: 'https://example.test' },
    self: {
      registration: { scope },
      addEventListener(name, listener) { listeners[name] = listener; },
      clients: { matchAll: async () => [{ postMessage: message => messages.push(message) }] },
    },
    fetch(request, options) {
      requested = { request, options };
      return pending;
    },
    caches: {
      match: async () => saved ? new Response(saved) : undefined,
      open: async () => ({ put: async (key, response) => { saved = await response.text(); } }),
    },
  });
  listeners.fetch({
    request: { url: scope + '?source=installed', method: 'GET', mode: 'navigate', headers: new Headers() },
    respondWith: promise => { result = promise; },
    waitUntil: promise => background.push(promise),
  });
  assert.equal(requested.options.cache, 'no-cache');
  return {
    result, messages,
    current: () => saved,
    receive: (body, options) => resolveFetch(new Response(body, options)),
    disconnect: () => rejectFetch(Error('offline')),
    timeout: () => Array.from(timers).forEach(callback => callback()),
    finish: () => Promise.all(background),
  };
}

(async () => {
  let page = visit(old);
  page.receive(fresh);
  assert.equal(await (await page.result).text(), fresh);
  await page.finish();
  assert.equal(page.current(), fresh);
  assert.equal(page.messages[0].type, 'bv-update');
  assert.equal(page.messages[0].ver, 'new');

  page = visit(old);
  page.timeout();
  assert.equal(await (await page.result).text(), old);
  page.receive(fresh);
  await page.finish();
  assert.equal(page.current(), fresh);
  assert.equal(page.messages[0].ver, 'new');

  page = visit(old);
  page.disconnect();
  assert.equal(await (await page.result).text(), old);
  await page.finish();

  page = visit(old);
  page.receive('Temporarily unavailable', { status: 503 });
  assert.equal(await (await page.result).text(), old);
  assert.equal(page.current(), old);

  page = visit(old);
  page.receive('<html>Placeholder</html>');
  assert.equal(await (await page.result).text(), old);
  assert.equal(page.current(), old);

  page = visit(fresh);
  page.receive(fresh);
  assert.equal(await (await page.result).text(), fresh);
  assert.equal(page.messages.length, 0);

  page = visit();
  page.timeout();
  page.receive(fresh);
  assert.equal(await (await page.result).text(), fresh);
  assert.equal(page.current(), fresh);
  assert.equal(page.messages.length, 0);

  console.log('PASS course navigation: revalidation, slow/offline fallback, server errors, update notification, first visit');
})().catch(error => { console.error(error); process.exitCode = 1; });
