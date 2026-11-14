import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogue, filePath, mergeSubmission, student } from '../../supabase/functions/phagi-notes/catalogue.js';
import { ownPhagiEntry, phagiStudent, phagiVisible, reconcilePhagi } from '../js/phagi-policy.js';
const task = { path: 'tasks/homework', data: { to: [student], kind: 'task', title: 'Математика', subject: 'math', files: [] } };
test('PDFs mistakenly attached to Georgiy answers retain their homework destination', () => {
  const entries = catalogue([task, { path: `subs/${student}/items/homework`, data: { files: [{ id: 'S' + student + '-123', name: 'Workbook.pdf', type: 'application/pdf' }] } }]);
  assert.equal(entries.length, 1); assert.equal(entries[0].taskId, 'homework');
  assert.equal(entries[0].file.name, 'Workbook.pdf'); assert.equal(entries[0].subject, 'math');
});
test('catalogue excludes other students and generated solutions, keeps external assignments', () => {
  const rows = [task, { path: 'tasks/other', data: { ...task.data, to: ['other'], files: [{ id: 'private', name: 'Private.pdf' }] } },
    { path: `subs/${student}/items/homework`, data: { files: [{ id: 'solution', name: 'Решение.pdf', polyaTask: 'homework' }] } }];
  const entries = catalogue(rows); assert.equal(entries.length, 1); assert.equal(entries[0].file, null);
});
test('submitting a revision preserves answer text and other files without duplicate solutions', () => {
  const old = { text: 'Комментарий', link: 'https://example.com', status: 'draft', files: [{ id: 'source' }, { id: 'old', polyaTask: 'hw' }] };
  const next = mergeSubmission(old, 'hw', { id: 'new' }, 'operation', 'now');
  assert.equal(next.text, old.text); assert.equal(next.link, old.link); assert.equal(next.status, 'submitted');
  assert.deepEqual(next.files.map(f => f.id), ['source', 'new']);
  assert.equal(old.files.length, 2);
  assert.equal(filePath('S' + student + '-123'), `subs/${student}/files/S${student}-123`);
  assert.throws(() => filePath('../private'));
});

test('import includes only written homework addressed to Georgiy, never lesson or other student files', () => {
  const ownFile = { id: 'S' + student + '-source', name: 'Моё.pdf' };
  const privateFile = { id: 'Sother-source', name: 'Чужое.pdf' };
  const rows = [
    { ...task, data: { ...task.data, files: [privateFile, { id: '../invalid', name: 'Bad.pdf' }] } },
    { path: `subs/${student}/items/homework`, data: { files: [ownFile] } },
    { path: 'subs/other/items/homework', data: { files: [privateFile] } },
    { path: 'tasks/other', data: { ...task.data, to: ['other'], files: [ownFile] } },
    { path: 'tasks/substr', data: { ...task.data, to: 'prefix-' + student, files: [ownFile] } },
    { path: 'tasks/test', data: { ...task.data, kind: 'test', files: [ownFile] } },
    { path: 'tasks/material', data: { ...task.data, kind: 'material', files: [ownFile] } },
    { path: 'events/teaching', data: { ...task.data, files: [privateFile], ofiles: { '2026-11-14': [ownFile] } } },
    { path: 'nbooks/student-book', data: { ...task.data, file: ownFile } },
  ];
  const entries = catalogue(rows);
  assert.deepEqual(entries.map(entry => entry.file.id), [ownFile.id]);
  assert.equal(entries[0].student, phagiStudent);
  assert.equal(ownPhagiEntry(entries[0]), true);
  assert.throws(() => filePath(privateFile.id), /другого ученика/);
  assert.equal(ownPhagiEntry({ ...entries[0], student: 'other' }), false);
  assert.equal(ownPhagiEntry({ ...entries[0], sourcePath: 'events/teaching' }), false);
});

test('withdrawn imports are hidden reversibly without removing local handwriting or user deletions', () => {
  const source = { key: 'tasks/old/source', sourcePath: 'tasks/old', taskId: 'old' };
  const pages = [{ strokes: [{ id: 'my-ink' }], texts: [] }], attachments = [{ id: 'local-file' }];
  const item = { id: 'note', revision: 7, deleted: false, data: { phagi: source, pages, attachments } };
  const hidden = reconcilePhagi(item, new Set());
  assert.equal(phagiVisible(hidden), false);
  assert.equal(hidden.deleted, false);
  assert.equal(hidden.data.pages, pages);
  assert.equal(hidden.data.attachments, attachments);
  assert.equal(hidden.revision, 7);
  assert.equal(hidden.pending, true);
  assert.equal(reconcilePhagi(hidden, new Set()), undefined);
  const restored = reconcilePhagi(hidden, new Set([source.key]));
  assert.equal(phagiVisible(restored), true);
  assert.equal(restored.data.pages, pages);
  assert.equal(reconcilePhagi({ ...item, deleted: true }, new Set([source.key])), undefined);
  assert.equal(phagiVisible({ data: { phagi: { ...source, sourcePath: 'events/old' } } }), false);
  assert.equal(phagiVisible({ data: { kind: 'board' } }), true);
  assert.equal(reconcilePhagi({ data: { kind: 'board' } }, new Set()), undefined);
  const replaced = reconcilePhagi(item, new Set(['tasks/old/new-pdf']), new Set(['tasks/old']));
  assert.equal(phagiVisible(replaced), true, 'a replacement source PDF must not hide our older handwritten copy');
  const crossFile = { ...item, data: { ...item.data, phagi: { ...source, key: 'tasks/old/Sother-source' } } };
  assert.equal(phagiVisible(reconcilePhagi(crossFile, new Set(), new Set(['tasks/old']))), false);
});
