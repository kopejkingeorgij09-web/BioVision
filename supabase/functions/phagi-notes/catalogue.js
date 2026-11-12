// This account is explicitly linked to the owner's student profile. No login code is stored here.
export const notesUser = '5b7c4303-1206-411b-afc1-04ad394b2715';
export const student = 'u_a7f09iDQmUe0Pa3S8bZuYQ';
export const subjects = { math: 'Математика', eng: 'Английский', bio: 'Биология', other: 'Другие материалы' };
export function catalogue(rows) {
  const result = [], referenced = new Set();
  const submissions = new Map(rows.filter(row => row.path.startsWith('subs/' + student + '/items/')).map(row => [row.path.split('/').at(-1), row.data]));
  for (const { path, data: d } of rows) {
    const collection = path.split('/')[0];
    if (!['tasks', 'events', 'nbooks'].includes(collection) || !d || !d.to?.includes(student)) continue;
    const ownTask = collection === 'tasks' && d.kind === 'task' && d.to?.includes(student);
    const answerFiles = collection === 'tasks' ? (submissions.get(path.split('/')[1])?.files ?? []).filter(f => !f.polyaTask) : [];
    const files = [...answerFiles, ...(d.files ?? []), ...(d.file ? [d.file] : []), ...Object.values(d.ofiles ?? {}).flat()];
    const pdfs = files.filter(f => f && (/pdf/i.test(f.type ?? '') || /\.pdf$/i.test(f.name ?? '')));
    const base = { sourcePath: path, subject: d.subject || 'other', title: d.title || d.topic || path,
      taskId: ownTask ? path.split('/')[1] : null, links: (d.links ?? []).filter(u => /^https:\/\//.test(u)), due: d.due ?? null };
    for (const f of pdfs) {
      const key = path + '/' + f.id;
      if (referenced.has(key)) continue;
      referenced.add(key); referenced.add(f.id);
      result.push({ ...base, key, file: { id: f.id, name: f.name || 'Документ.pdf', mime: 'application/pdf' } });
    }
    // External LMS/ChatGPT links require their own session. Keep the assignment
    // ready for the user to attach the original, without pretending a link is a PDF.
    if (ownTask && !pdfs.length) result.push({ ...base, key: path + '/worksheet', file: null });
  }
  return result;
}
export function filePath(id) {
  if (!/^[\w-]{1,160}$/.test(id)) throw new Error('Неверный идентификатор файла');
  if (id.startsWith('T-')) return 'files/' + id;
  if (id.startsWith('S') && id.lastIndexOf('-') > 1) return 'subs/' + id.slice(1, id.lastIndexOf('-')) + '/files/' + id;
  return null;
}
export function mergeSubmission(previous, taskId, file, operation, now) {
  const files = (previous?.files ?? []).filter(f => f.polyaTask !== taskId);
  return { ...previous, files: [...files, { ...file, polyaTask: taskId }], status: 'submitted', updatedAt: now,
    polyaOperation: operation };
}
