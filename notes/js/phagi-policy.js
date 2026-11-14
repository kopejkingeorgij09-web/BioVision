export const phagiStudent = 'u_a7f09iDQmUe0Pa3S8bZuYQ';

export function ownPhagiEntry(entry) {
  return entry?.student === phagiStudent && /^[\w-]{1,160}$/.test(entry.taskId) &&
    entry.sourcePath === 'tasks/' + entry.taskId && entry.key?.startsWith(entry.sourcePath + '/');
}

export function phagiVisible(item) {
  const source = item.data.phagi;
  return !item.deleted && (!source || !source.excluded &&
    source.sourcePath === 'tasks/' + source.taskId && (!source.student || source.student === phagiStudent));
}

// Keep local ink, attachments and tombstones when the server withdraws a source.
export function reconcilePhagi(item, allowed, ownSources = new Set()) {
  if (!item?.data.phagi || item.deleted) return;
  const source = item.data.phagi;
  const suffix = source.key?.startsWith(source.sourcePath + '/') ? source.key.slice(source.sourcePath.length + 1) : '';
  const fileOwner = suffix.startsWith('S') && suffix.lastIndexOf('-') > 1 ? suffix.slice(1, suffix.lastIndexOf('-')) : null;
  // A replaced PDF must not hide handwriting on an older copy of our own task.
  const ownTask = ownSources.has(source.sourcePath) && source.sourcePath === 'tasks/' + source.taskId &&
    /^[\w-]{1,160}$/.test(suffix) && (!fileOwner || fileOwner === phagiStudent);
  const excluded = !allowed.has(source.key) && !ownTask;
  if (Boolean(source.excluded) === excluded && source.student === phagiStudent) return;
  return { ...item, data: { ...item.data, phagi: { ...source, student: phagiStudent, excluded } },
    modified: Date.now(), operation: crypto.randomUUID(), pending: true };
}
