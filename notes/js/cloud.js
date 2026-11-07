import { acknowledge, list, mergeRemote, preserveConflict, put, read } from './local.js';
import { cloudConfig } from './config.js';

const settings = 'biovision-notes-cloud';
const configuration = JSON.parse(localStorage.getItem(settings) ?? 'null') ?? cloudConfig;
const url = configuration.url.replace(/\/$/, '');
const sessionKey = settings + ':' + url;
let session = JSON.parse(localStorage.getItem(sessionKey) ?? 'null');
let refreshInFlight;
let syncInFlight;

function updateSession(next) {
  session = next?.access_token ? next : null;
  if (session && !session.expires_at) session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
  if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
  else localStorage.removeItem(sessionKey);
}

export const identity = () => session?.user ?? null;
export const libraryId = () => session ? url + ':' + session.user.id : 'local';
export const cloudEnabled = Boolean(url && configuration.key);

class CloudError extends Error {
  constructor(response, body) {
    super(body?.msg || body?.message || body?.error_description || 'Ответ Supabase: ' + response.status);
    this.status = response.status;
    this.code = body?.code ?? body?.error ?? body?.statusCode;
  }
}

async function request(path, { token, body, method = 'GET', type = 'application/json', blob = false } = {}) {
  const headers = { apikey: configuration.key };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = type;
  const response = await fetch(url + path, {
    method, headers,
    body: type === 'application/json' && body !== undefined ? JSON.stringify(body) : body,
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new CloudError(response, await response.json().catch(() => null));
  if (blob) return response.blob();
  if (response.status === 204 || response.headers.get('content-length') === '0') return null;
  return response.json();
}

export async function signIn(email, password) {
  const data = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  });
  updateSession(data);
  return Boolean(session);
}

export async function signInByCode(code) {
  const normalized = code.toLowerCase().replace(/[\s-]/g, '');
  if (!/^[a-f0-9]{32}$/.test(normalized)) throw new Error('Проверь формат персонального кода');
  updateSession(await request('/functions/v1/notes-code', { method: 'POST', body: { code: normalized } }));
  if (!session) throw new Error('Не удалось войти по коду');
}

export async function signOut() {
  if (syncInFlight) await syncInFlight.catch(() => {});
  const token = session?.access_token;
  // Отзываем refresh-токен этого устройства на сервере, а не только забываем его локально.
  if (token) await request('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
  updateSession(null);
}

async function accessToken(force = false) {
  const old = session;
  if (!old) throw new Error('Войди, чтобы синхронизировать заметки');
  if (!force && old.expires_at * 1000 > Date.now() + 60000) return old.access_token;
  if (!refreshInFlight) {
    refreshInFlight = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: old.refresh_token },
    }).then(data => {
      if (session === old) updateSession(data);
      return data.access_token;
    }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function authenticated(path, options) {
  const token = await accessToken();
  try {
    return await request(path, { ...options, token });
  } catch (error) {
    if (error.status !== 401) throw error;
    return request(path, { ...options, token: await accessToken(true) });
  }
}

function filePath(id, privateDownload = false) {
  return '/storage/v1/object/' + (privateDownload ? 'authenticated/' : '') + 'notes-files/' + session.user.id + '/' + encodeURIComponent(id);
}

async function upload(library, item) {
  for (const attachment of item.data.attachments ?? []) {
    const file = await read('files', library, attachment.id);
    if (!file || file.remote) continue;
    try {
      await authenticated(filePath(file.id), { method: 'POST', body: file.blob, type: attachment.mime });
    } catch (error) {
      // Storage can return an existing-object error after a successful upload whose reply was lost.
      if (error.status !== 409 && String(error.code) !== '409' && error.code !== 'Duplicate') throw error;
    }
    await put('files', { ...file, remote: true });
  }
}

export async function attachmentBlob(library, id) {
  const local = await read('files', library, id);
  if (local) return local.blob;
  if (!session || library !== libraryId()) throw new Error('Вложение ещё не скачано');
  const blob = await authenticated(filePath(id, true), { blob: true });
  await put('files', { library, id, blob, remote: true });
  return blob;
}

async function pull(library) {
  const metadata = new Map((await list('items', library)).map(item => [item.id, item]));
  const updates = [];
  let cursor = '';
  for (;;) {
    const rows = await authenticated('/rest/v1/notes_items?select=id,revision&order=id.asc&limit=200' + cursor);
    for (const row of rows) {
      const current = metadata.get(row.id);
      if (!current?.pending && (!current || row.revision > current.revision)) updates.push(row.id);
    }
    if (rows.length < 200) break;
    cursor = '&id=gt.' + rows.at(-1).id;
  }
  for (let index = 0; index < updates.length; index += 20) {
    const ids = updates.slice(index, index + 20);
    const rows = await authenticated('/rest/v1/notes_items?id=in.(' + ids.join(',') + ')');
    for (const remote of rows) await mergeRemote(library, remote);
  }
}

export function synchronize(library) {
  if (!session || library !== libraryId()) return Promise.resolve({ conflicts: 0 });
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    let conflicts = 0;
    let error;
    for (const item of await list('items', library)) {
      if (!item.pending) continue;
      try {
        if (!item.deleted) await upload(library, item);
        const response = await authenticated('/rest/v1/rpc/notes_save', {
          method: 'POST',
          body: { p_id: item.id, p_base: item.revision, p_operation: item.operation, p_data: item.data, p_deleted: item.deleted },
        });
        if (!response.item) throw new Error('Запись не найдена на сервере');
        if (response.saved) await acknowledge(library, item, response.item);
        else if (await preserveConflict(library, item, response.item)) conflicts += 1;
      } catch (problem) {
        if (problem.code === '42501' || problem.status === 403) problem.message = 'Доступ к облаку «Полей» закрыт для этого аккаунта. Заметки остаются на устройстве.';
        error ??= problem;
        if (problem instanceof TypeError || problem.name === 'TimeoutError' || problem.status === 401) break;
      }
    }
    await pull(library);
    return { conflicts, error };
  })().finally(() => { syncInFlight = null; });
  return syncInFlight;
}
