// Test dependencies live outside the application; the site still has no build step.
// NODE_PATH=/tmp/polya-validation/node_modules node --test notes/tests/input.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { parseHTML } = require('linkedom');
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { createSurface } = await import('../js/ink.js');

function setup(strokes = [], board = true, objects = [], extra = {}) {
  frames.clear();
  const { document, window } = parseHTML('<html><body><div id="host"></div></body></html>');
  globalThis.document = document;
  globalThis.window = window;
  const host = document.getElementById('host');
  Object.defineProperties(host, { clientWidth: { value: 1000 }, clientHeight: { value: 600 } });
  const prefs = { tool: 'pen', width: 3, color: '#222', finger: false };
  const controller = new AbortController();
  let saved;
  const surface = createSurface(host, { strokes, texts: [] }, { board, width: 1000, settings: () => prefs,
    signal: controller.signal, objects: () => objects, commit: (value, history, changed) => { saved = { ...value, changed }; }, ...extra });
  const ink = host.querySelector('svg.ink');
  ink.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 600 });
  ink.setPointerCapture = () => {};
  function dispatch(type, data = {}) {
    const event = new window.Event(type, { cancelable: true, bubbles: true });
    Object.assign(event, { pointerId: 1, pointerType: 'pen', button: 0, pressure: .5, clientX: 30, clientY: 50, timeStamp: 10 }, data);
    (data.targetNode ?? ink).dispatchEvent(event);
  }
  function flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); }
  return { host, ink, surface, prefs, controller, dispatch, flush, saved: () => saved };
}

const stroke = (id, x = 10, tool = 'pen') => ({ id, tool, color: '#222', width: 3, points: [[x, 10, .5], [x + 20, 30, .5]] });

test('coalesced samples survive, the final point is exact, and pen-up preserves pressure', () => {
  const t = setup();
  t.dispatch('pointerdown');
  t.dispatch('pointermove', { clientX: 40, getCoalescedEvents: () => [
    { clientX: 35, clientY: 51, pressure: .6, pointerType: 'pen', timeStamp: 11 },
    { clientX: 40, clientY: 52, pressure: .7, pointerType: 'pen', timeStamp: 12 },
  ] });
  t.flush();
  t.dispatch('pointerup', { clientX: 42, clientY: 52, pressure: 0 });
  const points = t.saved().strokes[0].points;
  assert.equal(points.length, 4);
  assert.deepEqual(points.at(-1).slice(0, 2), [42, 52]);
  assert.equal(points.at(-1)[2], points.at(-2)[2]);
});

test('adding a stroke retains existing SVG nodes and focused text fields', () => {
  const t = setup([stroke('old')]);
  const original = t.ink.firstElementChild.firstElementChild;
  t.surface.addTextNear(200, 200);
  const field = t.host.querySelector('textarea');
  t.dispatch('pointerdown'); t.dispatch('pointerup', { clientX: 70 });
  assert.equal(t.ink.firstElementChild.firstElementChild, original);
  assert.equal(t.host.querySelector('textarea'), field);
  assert.equal(t.saved().strokes.length, 2);
});

test('panning is batched once per frame and offscreen strokes reappear', () => {
  const t = setup([stroke('near'), stroke('far', 3000)]);
  const nodes = [...t.ink.firstElementChild.children];
  assert.equal(nodes[1].style.display, 'none');
  const initial = t.ink.firstElementChild.getAttribute('transform');
  for (let i = 0; i < 100; i++) t.dispatch('wheel', { deltaX: 30, deltaY: 0 });
  assert.equal(frames.size, 1);
  assert.equal(t.ink.firstElementChild.getAttribute('transform'), initial);
  t.flush();
  assert.equal(t.surface.view().x, -3000);
  assert.equal(nodes[0].style.display, 'none');
  assert.equal(nodes[1].style.display, '');
  t.dispatch('wheel', { deltaX: -3000, deltaY: 0 }); t.flush();
  assert.equal(nodes[0].style.display, '');
  assert.equal(t.saved(), undefined);
});

test('long strokes freeze completed preview chunks and retain all samples', () => {
  const t = setup(); t.dispatch('pointerdown');
  for (let i = 1; i <= 400; i++) { t.dispatch('pointermove', { clientX: 30 + i, clientY: 50 + Math.sin(i) }); if (i % 20 === 0) t.flush(); }
  const preview = t.ink.children[1];
  assert.ok(preview.children.length >= 3);
  const firstChunk = preview.firstElementChild;
  t.dispatch('pointermove', { clientX: 435 }); t.flush();
  assert.equal(preview.firstElementChild, firstChunk);
  t.dispatch('pointerup', { clientX: 435, pressure: 0 });
  assert.ok(t.saved().strokes[0].points.length >= 400);
  assert.equal(preview.childElementCount, 0);
});

test('palm touches do not move the board while a pen is in contact', () => {
  const t = setup(); t.dispatch('pointerdown');
  t.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch' });
  t.dispatch('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 200 }); t.flush();
  assert.deepEqual(t.surface.view(), { x: 0, y: 0, zoom: 1 });
  t.dispatch('pointercancel'); assert.equal(t.saved(), undefined);
});

test('canceling erasure restores highlight opacity, without deleting the stroke', () => {
  const t = setup([stroke('highlight', 10, 'highlight')]);
  const node = t.ink.firstElementChild.firstElementChild;
  assert.equal(node.getAttribute('opacity'), '0.28');
  t.prefs.tool = 'erase'; t.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  assert.equal(node.style.opacity, '0');
  t.dispatch('pointercancel');
  assert.equal(node.getAttribute('opacity'), '0.28');
  assert.equal(node.style.opacity, '');
  assert.equal(t.saved(), undefined);
});

test('aborting the editor cancels queued painting', () => {
  const t = setup(); t.dispatch('wheel', { deltaX: 5, deltaY: 0 });
  assert.equal(frames.size, 1); t.controller.abort(); assert.equal(frames.size, 0);
});

test('clipboard formats, native results, and failures', async () => {
  setup();
  const { clipboardFiles, readClipboardFiles } = await import('../js/clipboard.js');
  const file = new File(['image'], 'screen.png', { type: 'image/png' });
  assert.deepEqual(clipboardFiles({ files: [file], items: [{ kind: 'file', getAsFile: () => file }] }), [file]);
  assert.deepEqual(clipboardFiles({ items: [{ kind: 'file', getAsFile: () => file }] }), [file]);
  assert.deepEqual(clipboardFiles({ items: [{ kind: 'string' }] }), []);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => [{ types: ['image/png', 'image/jpeg'], getType: async () => file }] } });
  let files = await readClipboardFiles();
  assert.equal(files.length, 1); assert.equal(files[0].type, 'image/png');
  navigator.clipboard.read = async () => { throw new Error('Permission denied'); };
  await assert.rejects(readClipboardFiles(), /Нет доступа/);
  window.NotesAndroid = { readClipboard(id) { queueMicrotask(() => window.notesClipboardResult(id, [], 'Буфер обмена пуст')); } };
  await assert.rejects(readClipboardFiles(), /Буфер обмена пуст/);
  window.NotesAndroid.readClipboard = id => { queueMicrotask(() => window.notesClipboardResult(id, [], '')); };
  assert.deepEqual(await readClipboardFiles(), []);
});

function lasso(t, right = 150, bottom = 150) {
  t.prefs.tool = 'lasso';
  t.dispatch('pointerdown', { clientX: 0, clientY: 0 });
  for (const [clientX, clientY] of [[right, 0], [right, bottom], [0, bottom]]) t.dispatch('pointermove', { clientX, clientY });
  t.dispatch('pointerup', { clientX: 0, clientY: 0 });
}

test('lasso buttons scale handwriting, text and images in a single change', () => {
  let bounds = [50, 50, 80, 64];
  const object = { id: 'image', bounds: () => bounds, preview() {}, commit(next) { bounds = next; return { boardPosition: { x: next[0], y: next[1] }, boardWidth: next[2] }; } };
  const t = setup([stroke('old')], true, [object]);
  t.surface.addTextNear(40, 45);
  lasso(t, 400, 200);
  t.host.querySelector('[aria-label="Увеличить выделение"]').click();
  assert.equal(t.saved().strokes[0].width, 3.75);
  assert.equal(t.saved().texts[0].pt, 15);
  assert.equal(t.saved().changed[0].id, 'image');
  assert.equal(t.saved().changed[0].boardWidth, 100);
});

test('lasso corner resizing previews, commits and cancels without changing the original', () => {
  const t = setup([stroke('old')]); lasso(t);
  const handle = t.host.querySelector('[data-selection-corner="se"]');
  t.dispatch('pointerdown', { targetNode: handle, clientX: 35, clientY: 35 });
  t.dispatch('pointermove', { clientX: 65, clientY: 65 }); t.flush();
  assert.match(t.ink.firstElementChild.firstElementChild.getAttribute('transform'), /matrix\(2 /);
  t.dispatch('pointercancel');
  assert.equal(t.saved(), undefined);
  assert.equal(t.ink.firstElementChild.firstElementChild.getAttribute('transform'), null);
  t.dispatch('pointerdown', { targetNode: t.host.querySelector('[data-selection-corner="se"]'), clientX: 35, clientY: 35 });
  t.dispatch('pointerup', { clientX: 65, clientY: 65 });
  assert.equal(t.saved().strokes[0].width, 6);
  assert.deepEqual(t.saved().strokes[0].points[0].slice(0, 2), [15, 15]);
});


test('0.7.1 lasso copy and duplicate commands preserve polygon geometry', () => {
  let menu, copied;
  const polygon = { ...stroke('polygon'), geometry: 'polygon', points: [[10, 10, .5], [50, 10, .5], [30, 60, .5], [10, 10, .5]] };
  const t = setup([polygon], true, [], { showSelection: value => { if (value) menu = value; }, clipboard: { dismiss() {}, has: () => false, write: data => { copied = data; } } });
  lasso(t); assert.ok(menu); menu.copy();
  assert.equal(copied.strokes[0].geometry, 'polygon');
  menu.duplicate();
  assert.equal(t.saved().strokes.length, 2);
  assert.equal(t.saved().strokes[1].geometry, 'polygon');
  assert.notEqual(t.saved().strokes[1].id, polygon.id);
  assert.deepEqual(t.saved().strokes[1].points[0].slice(0, 2), [28, 28]);
});

test('0.7.1 camera API still notifies the minimap on batched pan', () => {
  let camera;
  const t = setup([], true, [], { onViewChange: value => { camera = value; } });
  t.dispatch('wheel', { deltaX: 40, deltaY: 30 }); t.flush();
  assert.deepEqual(camera, { x: -40, y: -30, zoom: 1 });
  t.surface.jump(1000, 2000, 2);
  assert.deepEqual(t.surface.camera(), { x: 1000, y: 2000, zoom: 2, width: 500, height: 300 });
});

test('0.7.1 hold-to-straighten still saves a shape after smooth preview', async () => {
  const t = setup(); t.prefs.holdShapes = true;
  t.dispatch('pointerdown');
  for (let x = 40; x <= 140; x += 10) t.dispatch('pointermove', { clientX: x, clientY: 50 });
  await new Promise(resolve => setTimeout(resolve, 550));
  t.dispatch('pointerup', { clientX: 140, clientY: 50 });
  assert.equal(t.saved().strokes[0].tool, 'line');
});


test('pen hover and distant lift never append hairlines to a contact', () => {
  const t = setup(); t.dispatch('pointerdown');
  t.dispatch('pointermove', { clientX: 40, pressure: .4, buttons: 1 });
  t.dispatch('pointermove', { clientX: 300, clientY: 300, pressure: 0, buttons: 0 });
  assert.ok(t.saved().strokes[0].points.every(point => point[0] < 50));
  t.dispatch('pointerup', { clientX: 350, pressure: 0 });
  assert.equal(t.saved().strokes.length, 1);
  t.dispatch('pointerdown', { clientX: 100 });
  t.dispatch('pointermove', { clientX: 110, pressure: .5, buttons: 1 });
  t.dispatch('pointerup', { clientX: 400, pressure: 0 });
  assert.equal(t.saved().strokes.length, 2);
  assert.ok(t.saved().strokes[1].points.every(point => point[0] <= 110));
});

test('new contact recovers a missing release without connecting strokes', () => {
  const t = setup(); t.dispatch('pointerdown');
  t.dispatch('pointermove', { clientX: 40 });
  t.dispatch('pointerdown', { clientX: 200 });
  t.dispatch('pointermove', { clientX: 210 });
  t.dispatch('pointerup', { clientX: 211, pressure: 0 });
  assert.equal(t.saved().strokes.length, 2);
  assert.ok(t.saved().strokes[0].points.every(point => point[0] < 50));
  assert.equal(t.saved().strokes[1].points[0][0], 200);
});

test('lasso on handwriting inside a PDF excludes the document', () => {
  let moved = false;
  const object = { id: 'pdf', lasso: false, bounds: () => [-300, -300, 1000, 1500], preview() {}, commit() { moved = true; } };
  const t = setup([stroke('writing')], true, [object]); lasso(t);
  t.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  t.dispatch('pointerup', { clientX: 70, clientY: 50 });
  assert.equal(moved, false);
  assert.equal(t.saved().changed.length, 0);
  assert.equal(t.saved().strokes[0].points[0][0], 60);
});

test('fast sparse eraser samples sweep crossings and the final release', () => {
  const strokes = [40, 100, 160, 220].map(x => ({ ...stroke(String(x)), points: [[x, 0, .5], [x, 100, .5]] }));
  const t = setup(strokes); t.prefs.tool = 'erase';
  t.dispatch('pointerdown', { clientX: 0, clientY: 50 });
  t.dispatch('pointermove', { clientX: 180, clientY: 50, buttons: 1 });
  t.dispatch('pointerup', { clientX: 250, clientY: 50, pressure: 0 });
  assert.equal(t.saved().strokes.length, 0);
});

test('barrel eraser cannot turn into stray pen strokes before lift', () => {
  let tool = 'erase';
  const t = setup([stroke('old')], true, [], { sideTool: () => tool });
  t.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  tool = 'pen';
  t.dispatch('pointermove', { clientX: 70, clientY: 30, buttons: 1 });
  t.dispatch('pointerup', { clientX: 80, clientY: 30, pressure: 0 });
  assert.deepEqual(t.saved().strokes, []);
  t.dispatch('pointerdown', { clientX: 100 }); t.dispatch('pointerup', { clientX: 110 });
  assert.equal(t.saved().strokes.length, 1);
});

test('short contacts render immediately without waiting for a frame', () => {
  const t = setup();
  for (let i = 0; i < 40; i++) {
    t.dispatch('pointerdown', { clientX: 10 + i * 10 });
    t.dispatch('pointermove', { clientX: 15 + i * 10, buttons: 1 });
    assert.ok(t.ink.children[1].firstElementChild);
    t.dispatch('pointerup', { clientX: 18 + i * 10, pressure: 0 });
  }
  assert.equal(t.saved().strokes.length, 40);
});
