// Запуск: node --test notes/tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNote, rebase } from '../js/merge.js';

const stroke = (id, x = 0) => ({ id, points: [[x, 0, 0.5, 0]], color: '#000', width: 3 });
const note = (pages, extra = {}) => ({ kind: 'pages', title: 'Лекция', layout: 'grid', attachments: [], pages, ...extra });
const ids = page => page.strokes.map(s => s.id);

test('штрихи, добавленные в двух местах, объединяются', () => {
  const base = note([{ id: 'p1', strokes: [stroke('a')], texts: [] }]);
  const ours = note([{ id: 'p1', strokes: [stroke('a'), stroke('ours')], texts: [] }]);
  const theirs = note([{ id: 'p1', strokes: [stroke('a'), stroke('theirs')], texts: [] }]);
  assert.deepEqual(ids(mergeNote(base, ours, theirs).pages[0]), ['a', 'ours', 'theirs']);
});

test('наше удаление штриха сохраняется, их добавление тоже', () => {
  const base = note([{ id: 'p1', strokes: [stroke('a'), stroke('b')], texts: [] }]);
  const ours = note([{ id: 'p1', strokes: [stroke('b')], texts: [] }]);
  const theirs = note([{ id: 'p1', strokes: [stroke('a'), stroke('b'), stroke('c')], texts: [] }]);
  assert.deepEqual(ids(mergeNote(base, ours, theirs).pages[0]), ['b', 'c']);
});

test('их удаление не воскрешается, если мы элемент не трогали', () => {
  const base = note([{ id: 'p1', strokes: [stroke('a'), stroke('b')], texts: [] }]);
  const ours = note([{ id: 'p1', strokes: [stroke('a'), stroke('b'), stroke('n')], texts: [] }]);
  const theirs = note([{ id: 'p1', strokes: [stroke('b')], texts: [] }]);
  assert.deepEqual(ids(mergeNote(base, ours, theirs).pages[0]), ['b', 'n']);
});

test('перемещённый нами штрих берётся наш, новые страницы с обеих сторон остаются', () => {
  const base = note([{ id: 'p1', strokes: [stroke('a', 0)], texts: [] }]);
  const ours = note([{ id: 'p1', strokes: [stroke('a', 50)], texts: [] }, { id: 'p2', strokes: [], texts: [] }]);
  const theirs = note([{ id: 'p1', strokes: [stroke('a', 0)], texts: [] }, { id: 'p3', strokes: [], texts: [] }]);
  const merged = mergeNote(base, ours, theirs);
  assert.equal(merged.pages[0].strokes[0].points[0][0], 50);
  assert.deepEqual(merged.pages.map(p => p.id).sort(), ['p1', 'p2', 'p3']);
});

test('название: меняли только они — берём их', () => {
  const base = note([], { title: 'A' });
  const merged = mergeNote(base, note([], { title: 'A', layout: 'dots' }), note([], { title: 'B' }));
  assert.equal(merged.title, 'B');
  assert.equal(merged.layout, 'dots');
});

test('пометки на вложении (объект по страницам) сливаются', () => {
  const file = marks => ({ id: 'f', name: 'x.pdf', mime: 'application/pdf', marks });
  const base = note([], { attachments: [file({ 1: { strokes: [stroke('a')], texts: [] } })] });
  const ours = note([], { attachments: [file({ 1: { strokes: [stroke('a'), stroke('o')], texts: [] } })] });
  const theirs = note([], { attachments: [file({ 1: { strokes: [stroke('a')], texts: [] }, 2: { strokes: [stroke('t')], texts: [] } })] });
  const merged = mergeNote(base, ours, theirs).attachments[0].marks;
  assert.deepEqual(merged[1].strokes.map(s => s.id), ['a', 'o']);
  assert.deepEqual(merged[2].strokes.map(s => s.id), ['t']);
});

// Сценарий из ревью: две вкладки открыли лист офлайн, обе пишут, каждая от своей версии.
test('две вкладки: ни один штрих не теряется', () => {
  const store = new Map();
  const write = (base, data) => {
    const local = { id: 'n', data, operation: crypto.randomUUID(), pending: false };
    const { record } = rebase(store.get('n'), base, local);
    store.set('n', record);
    return local; // вкладка продолжает работать от своей правки
  };
  const start = { id: 'n', operation: 'o0', revision: 0, data: note([{ id: 'p1', strokes: [], texts: [] }]) };
  store.set('n', start);
  const tabA = write(start, note([{ id: 'p1', strokes: [stroke('A')], texts: [] }]));
  const tabB = write(start, note([{ id: 'p1', strokes: [stroke('B')], texts: [] }]));
  write(tabA, note([{ id: 'p1', strokes: [stroke('A'), stroke('A2')], texts: [] }]));
  write(tabB, note([{ id: 'p1', strokes: [stroke('B'), stroke('B2')], texts: [] }]));
  assert.deepEqual(ids(store.get('n').data.pages[0]).sort(), ['A', 'A2', 'B', 'B2']);
});

test('синхронизация во время письма: правки другого устройства не затираются', () => {
  const base = { id: 'n', operation: 'o1', revision: 3, data: note([{ id: 'p1', strokes: [stroke('a')], texts: [] }]) };
  const fromCloud = { id: 'n', operation: 'cloud', revision: 4, pending: false, data: note([{ id: 'p1', strokes: [stroke('a'), stroke('mac')], texts: [] }]) };
  const local = { id: 'n', operation: 'o2', pending: true, data: note([{ id: 'p1', strokes: [stroke('a'), stroke('pen')], texts: [] }]) };
  const { record, merged } = rebase(fromCloud, base, local);
  assert.equal(merged, true);
  assert.equal(record.revision, 4);
  assert.notEqual(record.operation, 'o2');
  assert.deepEqual(ids(record.data.pages[0]), ['a', 'pen', 'mac']);
});

test('без конкурентов запись идёт как раньше', () => {
  const base = { id: 'n', operation: 'o1', revision: 2, data: note([]) };
  const local = { id: 'n', operation: 'o2', data: note([], { title: 'Новое' }) };
  const { record, merged } = rebase(base, base, local);
  assert.equal(merged, false);
  assert.equal(record.operation, 'o2');
  assert.equal(record.revision, 2);
});
