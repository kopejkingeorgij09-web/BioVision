import { notesUser, student } from './catalogue.js';
Deno.env.set('SUPABASE_URL', 'https://phagi.test');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service');
const { handle } = await import('./handler.ts');
const check = (ok: unknown, message = 'Assertion failed') => { if (!ok) throw new Error(message); };
const operation = '12345678-1234-1234-1234-123456789012';
const source = { id: 'Su_a7f09iDQmUe0Pa3S8bZuYQ-source', name: 'Workbook.pdf', type: 'application/pdf' };
Deno.test('owner authentication, private catalogue, atomic PDF hand-in and retries', async () => {
  const native = globalThis.fetch;
  let user = notesUser, writes = 0, conflict = true;
  const documents = new Map<string, { data: any; updated_at: string }>();
  documents.set('tasks/hw', { data: { to: [student], kind: 'task', subject: 'math', title: 'ДЗ', files: [] }, updated_at: 'v1' });
  documents.set(`subs/${student}/items/hw`, { data: { text: 'Текст ответа', files: [source], status: 'draft' }, updated_at: 'v1' });
  documents.set('tasks/private', { data: { to: ['someone-else'], kind: 'task', files: [source] }, updated_at: 'v1' });
  documents.set('events/teaching', { data: { to: [student], files: [source] }, updated_at: 'v1' });
  documents.set('tasks/substring', { data: { to: 'prefix-' + student, kind: 'task', files: [source] }, updated_at: 'v1' });
  documents.set('tasks/cross-file', { data: { to: [student], kind: 'task', files: [{ id: 'Sother-source', name: 'Private.pdf' }] }, updated_at: 'v1' });
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: user });
    check(url.hostname === 'phagi.test', 'Unexpected destination');
    check((options?.headers as Record<string, string>).apikey === 'test-service');
    const query = url.searchParams, path = query.get('path')?.slice(3);
    if (!options?.method || options.method === 'GET') {
      if (path) { const row = documents.get(path); return Response.json(row ? [row] : []); }
      return Response.json([...documents].map(([path, row]) => ({ path, ...row })));
    }
    writes++;
    if (options.method === 'POST') {
      await new Promise(resolve => setTimeout(resolve, 2));
      const body = JSON.parse(String(options.body));
      for (const row of Array.isArray(body) ? body : [body]) documents.set(row.path, row);
      return new Response(null, { status: 204 });
    }
    if (options.method === 'PATCH' && path) {
      const current = documents.get(path)!;
      // Another device edits the answer between read and compare-and-swap.
      if (conflict) { conflict = false; current.data.text = 'Параллельная правка'; current.updated_at = 'v2'; return Response.json([]); }
      check(query.get('updated_at') === 'eq.' + current.updated_at);
      const next = JSON.parse(String(options.body)); documents.set(path, next);
      return Response.json([next]);
    }
    throw new Error('Unexpected database action');
  };
  const request = (body: string | Uint8Array, type = 'application/json', task = 'hw') => new Request('https://edge.test/?task=' + task + '&operation=' + operation,
    { method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': type }, body: typeof body === 'string' ? body : body.slice().buffer });
  try {
    check((await handle(new Request('https://edge.test', { method: 'POST' }))).status === 401);
    user = 'other-user'; check((await handle(request('{"action":"catalogue"}'))).status === 403); check(writes === 0);
    user = notesUser;
    const result = await (await handle(request('{"action":"catalogue"}'))).json();
    check(result.student === student);
    check(result.entries.length === 2); check(result.entries.find((entry: any) => entry.taskId === 'hw').file.name === 'Workbook.pdf');
    check(!result.entries.some((entry: any) => entry.file?.id === 'Sother-source'));
    const forbidden = await handle(request(JSON.stringify({ action: 'file', key: 'tasks/cross-file/Sother-source' })));
    check(forbidden.status === 404);
    const pdf = new TextEncoder().encode('%PDF-1.7\nTest PDF bytes');
    check((await handle(request(pdf, 'application/pdf', 'private'))).status === 403);
    check((await handle(request(pdf, 'application/pdf', 'substring'))).status === 403);
    check((await handle(request(new TextEncoder().encode('invalid'), 'application/pdf'))).status === 400); check(writes === 0);
    const sent = await handle(request(pdf, 'application/pdf')); check(sent.status === 200, await sent.clone().text());
    const answer = documents.get(`subs/${student}/items/hw`)!.data;
    check(answer.text === 'Параллельная правка'); check(answer.status === 'submitted'); check(answer.files.length === 2);
    const file = answer.files[1], path = `subs/${student}/files/${file.id}`;
    check(documents.has(path));
    check(Date.parse(answer.updatedAt) >= Date.parse(documents.get(path)!.updated_at), 'Published answer timestamp preceded file upload; polling could miss it');
    const encoded = documents.get(path + '~0')!.data.d;
    check(atob(encoded).startsWith('%PDF-1.7'));
    const before = writes; check((await handle(request(pdf, 'application/pdf'))).status === 200); check(writes === before, 'Retry wrote duplicate files');
  } finally { globalThis.fetch = native; }
});
