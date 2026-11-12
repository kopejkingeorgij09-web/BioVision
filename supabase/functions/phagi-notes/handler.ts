import { catalogue, filePath, mergeSubmission, notesUser, student } from './catalogue.js';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers = { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' };
async function db(path: string, options: RequestInit = {}) {
  const response = await fetch(url + '/rest/v1/' + path, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Облако Фагов временно недоступно');
  return response.status === 204 ? null : response.json();
}
async function read(path: string) {
  return (await db('ph_docs?select=data&deleted=eq.false&path=eq.' + encodeURIComponent(path)))[0]?.data;
}
function row(path: string, data: unknown) {
  return { path, parent: path.slice(0, path.lastIndexOf('/')), id: path.slice(path.lastIndexOf('/') + 1), data, deleted: false, updated_at: new Date().toISOString() };
}
async function write(rows: unknown[]) {
  await db('ph_docs?on_conflict=path', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
}
async function entries() {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await db('ph_docs?select=path,data&deleted=eq.false&parent=in.(tasks,events,nbooks,subs/' + student + '/items)&order=path&limit=500&offset=' + offset);
    rows.push(...page); if (page.length < 500) return catalogue(rows);
  }
}
export const handle = async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply({ message: 'Метод недоступен' }, 405);
  try {
    // Validate the actual session with the issuing Auth server, never trust decoded JWT claims.
    const authorization = request.headers.get('authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return reply({ message: 'Войди в Поля' }, 401);
    const auth = await fetch('https://swszjkdnzhvnlodapqar.supabase.co/auth/v1/user', { headers: { Authorization: authorization,
      apikey: 'sb_publishable_dclOI9aV3gfN0h6dYR36_A_81KobCGn' }, signal: AbortSignal.timeout(15000) });
    if (!auth.ok) return reply({ message: 'Сессия истекла. Войди ещё раз.' }, 401);
    if ((await auth.json()).id !== notesUser) return reply({ message: 'Синхронизация Фагов недоступна этому аккаунту' }, 403);
    const contentType = request.headers.get('content-type') || '';
    if (contentType.startsWith('application/pdf')) {
      const taskId = new URL(request.url).searchParams.get('task') ?? '';
      const operation = new URL(request.url).searchParams.get('operation') ?? '';
      if (!/^[\w-]{1,160}$/.test(taskId) || !/^[a-f0-9-]{36}$/.test(operation)) return reply({ message: 'Неверное задание' }, 400);
      const task = await read('tasks/' + taskId);
      if (!task || task.kind !== 'task' || !task.to?.includes(student)) return reply({ message: 'Задание недоступно для сдачи' }, 403);
      if (Number(request.headers.get('content-length')) > 20 * 1024 * 1024) return reply({ message: 'PDF больше 20 МиБ' }, 413);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length > 20 * 1024 * 1024 || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') return reply({ message: 'Нужен PDF до 20 МиБ' }, 400);
      const submission = 'subs/' + student + '/items/' + taskId;
      const previous = await read(submission);
      if (previous?.polyaOperation === operation) return reply({ submitted: true, at: previous.updatedAt });
      const id = 'S' + student + '-' + operation.replace(/-/g, '');
      const path = filePath(id)!;
      let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const data = btoa(binary), parts = Math.ceil(data.length / 300000), now = new Date().toISOString();
      const name = (task.title || 'Решение').slice(0, 130) + ' — Поля.pdf';
      for (let i = 0; i < parts; i += 4) await write(Array.from({ length: Math.min(4, parts - i) }, (_, n) => row(path + '~' + (i + n), { d: data.slice((i + n) * 300000, (i + n + 1) * 300000) })));
      await write([row(path, { name, type: 'application/pdf', size: bytes.length, parts, at: now })]);
      // Publish the answer only after every file part is durable. Preserve text and unrelated files.
      let published = false, submittedAt = now;
      for (let attempt = 0; attempt < 4 && !published; attempt++) {
        const records = await db('ph_docs?select=data,updated_at&path=eq.' + encodeURIComponent(submission));
        const latest = records[0];
        submittedAt = new Date().toISOString();
        const data = mergeSubmission(latest?.data, taskId, { id, name, type: 'application/pdf' }, operation, submittedAt);
        const result = latest
          ? await db('ph_docs?path=eq.' + encodeURIComponent(submission) + '&updated_at=eq.' + encodeURIComponent(latest.updated_at), {
              method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ data, deleted: false, updated_at: submittedAt }) })
          : await db('ph_docs?on_conflict=path', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(row(submission, data)) });
        published = result.length > 0;
      }
      if (!published) return reply({ message: 'Ответ изменился на другом устройстве. Повтори отправку.' }, 409);
      return reply({ submitted: true, at: submittedAt });
    }
    if (Number(request.headers.get('content-length')) > 2048) return reply({ message: 'Слишком большой запрос' }, 413);
    const raw = await request.text();
    if (raw.length > 2048) return reply({ message: 'Слишком большой запрос' }, 413);
    const input = JSON.parse(raw);
    const list = await entries();
    if (input.action === 'catalogue') return reply({ entries: list });
    if (input.action !== 'file') return reply({ message: 'Неизвестная команда' }, 400);
    const file = list.find(item => item.key === input.key)?.file;
    if (!file) return reply({ message: 'Файл больше не доступен' }, 404);
    const path = filePath(file.id);
    let blob;
    if (path) {
      const head = await read(path);
      if (!head || !Number.isInteger(head.parts) || head.parts < 1 || head.parts > 100) return reply({ message: 'Файл повреждён' }, 404);
      let data = '';
      for (let i = 0; i < head.parts; i++) { const part = await read(path + '~' + i); if (!part?.d) throw new Error('Не все части PDF доступны'); data += part.d; }
      const binary = atob(data); blob = Uint8Array.from(binary, c => c.charCodeAt(0));
    } else {
      const response = await fetch('https://kopejkingeorgij09-web.github.io/BioVision/phagi/_blob/' + encodeURIComponent(file.id));
      if (!response.ok) return reply({ message: 'Исходный PDF недоступен' }, 404);
      blob = new Uint8Array(await response.arrayBuffer());
    }
    return new Response(blob, { headers: { ...cors, 'Content-Type': 'application/pdf' } });
  } catch (error) { return reply({ message: error instanceof Error ? error.message : 'Не удалось связаться с Фагами' }, 503); }
};
