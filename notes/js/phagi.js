import { edit, list } from './local.js';
import { libraryId, phagiAvailable, phagiRequest } from './cloud.js';
const names = { math: 'Математика', eng: 'Английский', bio: 'Биология', other: 'Другие материалы' };
export async function stableId(key) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('polya-phagi-v1:' + key)));
  const hex = [...bytes.slice(0, 16)].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
let last = 0;
export function resetPhagiSync() { last = 0; }
export async function syncPhagi(library, force = false) {
  if (!phagiAvailable() || library !== libraryId() || !navigator.onLine || (!force && Date.now() - last < 60000)) return;
  const response = await phagiRequest({ action: 'catalogue' });
  if (library !== libraryId()) return;
  const existing = new Set((await list('items', library)).map(item => item.id));
  async function add(key, data) {
    const id = await stableId(key);
    if (!existing.has(id) && library === libraryId()) {
      // Transactional create-if-missing keeps handwriting and user deletions intact.
      await edit(library, id, current => current ?? { library, id, data, revision: 0, modified: Date.now(),
        operation: crypto.randomUUID(), pending: true, deleted: false });
      existing.add(id);
    }
    return id;
  }
  const root = await add('root', { kind: 'folder', title: 'Фаги естественных наук', parent: null, color: 'green', phagiFolder: true });
  const subjects = new Map();
  for (const subject of new Set(['math', 'eng', ...response.entries.map(item => item.subject)])) {
    subjects.set(subject, await add('subject/' + subject, { kind: 'folder', title: names[subject] ?? subject, parent: root, color: 'green', phagiFolder: true }));
  }
  for (const entry of response.entries) {
    const attachments = entry.file ? [{ id: await stableId('file/' + entry.key), name: entry.file.name, mime: 'application/pdf',
      phagiKey: entry.key, marks: {} }] : [];
    await add('entry/' + entry.key, { kind: 'board', title: entry.file ? entry.file.name.replace(/\.pdf$/i, '') : entry.title,
      parent: subjects.get(entry.subject), paper: 'dots', pages: [{ id: await stableId('page/' + entry.key), strokes: [], texts: [] }],
      attachments, phagi: { key: entry.key, sourcePath: entry.sourcePath, taskId: entry.taskId, title: entry.title, links: entry.links, due: entry.due } });
  }
  last = Date.now();
}
