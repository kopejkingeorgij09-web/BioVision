import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogue, filePath, mergeSubmission, student } from '../../supabase/functions/phagi-notes/catalogue.js';
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
