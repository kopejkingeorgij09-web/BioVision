// Резервная копия библиотеки: один файл .polya без сторонних форматов.
// Устройство: «POLYA1\n», 12 цифр длины заголовка, JSON-заголовок, затем файлы вложений подряд.
// Blob собирается из частей без копирования, поэтому даже большие PDF не раздувают память.

const magic = 'POLYA1\n';

export async function exportBackup(records, blobOf) {
  const files = [], parts = [], missing = [];
  const seen = new Set();
  let offset = 0;
  for (const item of records) {
    if (item.deleted) continue;
    for (const attachment of item.data.attachments ?? []) {
      if (seen.has(attachment.id)) continue;
      seen.add(attachment.id);
      try {
        const blob = await blobOf(attachment.id);
        files.push({ id: attachment.id, mime: attachment.mime ?? blob.type, size: blob.size, offset });
        parts.push(blob);
        offset += blob.size;
      } catch { missing.push(attachment.name ?? attachment.id); }
    }
  }
  const header = new TextEncoder().encode(JSON.stringify({
    format: 'polya-backup', version: 1, created: new Date().toISOString(),
    items: records.map(({ id, data, deleted, modified }) => ({ id, data, deleted, modified })),
    files,
  }));
  const blob = new Blob([magic, String(header.length).padStart(12, '0'), header, ...parts], { type: 'application/octet-stream' });
  return { blob, missing, count: records.filter(item => !item.deleted).length };
}

export async function readBackup(file) {
  const start = new TextDecoder().decode(await file.slice(0, magic.length + 12).arrayBuffer());
  if (!start.startsWith(magic)) throw new Error('Это не резервная копия «Полей»');
  const length = Number(start.slice(magic.length));
  if (!Number.isSafeInteger(length) || length <= 0) throw new Error('Резервная копия повреждена');
  const base = magic.length + 12;
  const header = JSON.parse(new TextDecoder().decode(await file.slice(base, base + length).arrayBuffer()));
  if (header.format !== 'polya-backup' || !Array.isArray(header.items)) throw new Error('Резервная копия повреждена');
  const body = base + length;
  const files = (header.files ?? []).map(entry => ({
    id: entry.id, blob: file.slice(body + entry.offset, body + entry.offset + entry.size, entry.mime),
  }));
  if (files.some(entry => entry.blob.size === 0 && header.files.find(file => file.id === entry.id).size)) {
    throw new Error('Резервная копия обрезана');
  }
  return { items: header.items.filter(item => item && typeof item.id === 'string' && item.data), files, created: header.created };
}

// Сохранение файла: на Android через системный диалог (WebView не умеет скачивать blob:),
// в браузере и на Mac — обычной ссылкой.
let saveRequest = 0;
const saveWaiters = new Map();
window.notesFileSaved = (request, ok, error) => {
  saveWaiters.get(request)?.(ok, error);
  saveWaiters.delete(request);
};

export async function saveFile(blob, name) {
  const android = window.NotesAndroid;
  if (android?.beginSave) {
    const request = ++saveRequest;
    if (!android.beginSave(request, name, blob.type || 'application/octet-stream')) throw new Error('Не удалось начать сохранение');
    const chunk = 3 * 256 * 1024;
    for (let at = 0; at < blob.size; at += chunk) {
      const bytes = new Uint8Array(await blob.slice(at, at + chunk).arrayBuffer());
      let text = '';
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      if (!android.appendSave(request, btoa(text))) throw new Error('Не удалось записать файл');
    }
    return new Promise((resolve, reject) => {
      saveWaiters.set(request, (ok, error) => ok ? resolve(true) : error ? reject(new Error(error)) : resolve(false));
      android.finishSave(request);
    });
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
